'use strict';

const crypto = require('crypto');
const { WardPortalBanner, WardHomeWork, WardGalleryItem } = require('../models');
const { persistDataUrl, persistImageFields, publicImageUrl } = require('../utils/portalMedia');

function pickHeroUrl(primary, secondary) {
  const a = publicImageUrl(primary, '');
  if (a && !String(a).startsWith('data:')) return a;
  const b = publicImageUrl(secondary, '');
  return b && !String(b).startsWith('data:') ? b : '';
}

function newId() {
  return crypto.randomUUID();
}

function asFlag(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (Buffer.isBuffer(value)) return Boolean(value[0]);
  if (value && typeof value === 'object' && Array.isArray(value.data)) return Boolean(value.data[0]);
  return false;
}

async function getBanners(wardId) {
  if (!wardId) return null;
  try {
    return await WardPortalBanner.findOne({ where: { wardId } });
  } catch {
    return null;
  }
}

async function upsertBanners(wardId, urls = {}, userId = null) {
  if (!wardId) return null;
  let existing = null;
  try {
    existing = await WardPortalBanner.findOne({ where: { wardId } });
  } catch {
    return null;
  }
  const patch = { updatedBy: userId || null };
  if (urls.homeBannerUrl !== undefined) patch.homeBannerUrl = urls.homeBannerUrl;
  if (urls.complaintsBannerUrl !== undefined) patch.complaintsBannerUrl = urls.complaintsBannerUrl;
  if (urls.galleryBannerUrl !== undefined) patch.galleryBannerUrl = urls.galleryBannerUrl;
  persistImageFields(patch, ['homeBannerUrl'], `home-${String(wardId).slice(0, 8)}`);
  persistImageFields(patch, ['complaintsBannerUrl'], `complaints-${String(wardId).slice(0, 8)}`);
  persistImageFields(patch, ['galleryBannerUrl'], `gallery-${String(wardId).slice(0, 8)}`);
  for (const key of ['homeBannerUrl', 'complaintsBannerUrl', 'galleryBannerUrl']) {
    if (typeof patch[key] === 'string' && patch[key].startsWith('data:')) {
      const stored = persistDataUrl(patch[key], `${key}-${String(wardId).slice(0, 8)}`);
      const prev = existing ? existing[key] : '';
      patch[key] = stored && !String(stored).startsWith('data:')
        ? stored
        : (prev && !String(prev).startsWith('data:') ? prev : '');
    }
  }
  if (existing) {
    await existing.update(patch);
    return existing;
  }
  return WardPortalBanner.create({ id: newId(), wardId, ...patch });
}

async function listHomeWorkIds(wardId) {
  if (!wardId) return [];
  try {
    const rows = await WardHomeWork.findAll({
      where: { wardId },
      order: [['orderIndex', 'ASC'], ['createdAt', 'ASC']],
      attributes: ['galleryItemId'],
    });
    return rows.map((row) => String(row.galleryItemId));
  } catch {
    return [];
  }
}

async function setHomeWorkIds(wardId, ids) {
  if (!wardId) return [];
  const unique = [...new Set((ids || []).map(String).filter(Boolean))];
  let valid = unique;
  try {
    const found = await WardGalleryItem.findAll({
      where: { wardId, id: unique },
      attributes: ['id'],
    });
    const ok = new Set(found.map((row) => String(row.id)));
    valid = unique.filter((id) => ok.has(id));
  } catch {
    /* keep unique */
  }
  await WardHomeWork.destroy({ where: { wardId } }).catch(() => {});
  if (valid.length) {
    await WardHomeWork.bulkCreate(valid.map((galleryItemId, orderIndex) => ({
      id: newId(),
      wardId,
      galleryItemId,
      orderIndex,
    })));
  }
  await WardGalleryItem.update({ showOnDashboard: false }, { where: { wardId } }).catch(() => {});
  if (valid.length) {
    await WardGalleryItem.update({ showOnDashboard: true }, { where: { wardId, id: valid } }).catch(() => {});
  }
  return valid;
}

async function addHomeWork(wardId, galleryItemId) {
  const ids = await listHomeWorkIds(wardId);
  const next = String(galleryItemId);
  if (ids.includes(next)) return ids;
  return setHomeWorkIds(wardId, [...ids, next]);
}

async function removeHomeWork(wardId, galleryItemId) {
  const ids = await listHomeWorkIds(wardId);
  return setHomeWorkIds(wardId, ids.filter((id) => id !== String(galleryItemId)));
}

async function attachLayout(wardId, configData, persistJobs = []) {
  if (!wardId || !configData) return configData;
  const meta = (configData.meta && typeof configData.meta === 'object') ? { ...configData.meta } : {};
  let banners = await getBanners(wardId);
  if (!banners) {
    persistJobs.push(async () => {
      await upsertBanners(wardId, {
        homeBannerUrl: configData.heroBannerUrl || '',
        complaintsBannerUrl: meta.complaintsBannerUrl || configData.complaintsBannerUrl || '',
        galleryBannerUrl: meta.galleryBannerUrl || configData.galleryBannerUrl || '',
      });
    });
  }
  const homeUrl = pickHeroUrl(configData.heroBannerUrl, banners?.homeBannerUrl) || publicImageUrl(configData.heroBannerUrl, '');
  const complaintsUrl = publicImageUrl(banners?.complaintsBannerUrl || meta.complaintsBannerUrl || configData.complaintsBannerUrl, '');
  const galleryUrl = publicImageUrl(banners?.galleryBannerUrl || meta.galleryBannerUrl || configData.galleryBannerUrl, '');
  configData.heroBannerUrl = homeUrl;
  configData.complaintsBannerUrl = complaintsUrl;
  configData.galleryBannerUrl = galleryUrl;
  meta.complaintsBannerUrl = complaintsUrl;
  meta.galleryBannerUrl = galleryUrl;

  let homeIds = await listHomeWorkIds(wardId);
  if (!homeIds.length) {
    const fromMeta = Array.isArray(meta.dashboardWorkOrder) ? meta.dashboardWorkOrder.map(String).filter(Boolean) : [];
    if (fromMeta.length) {
      homeIds = fromMeta;
      persistJobs.push(async () => { await setHomeWorkIds(wardId, fromMeta); });
    } else {
      try {
        const starred = await WardGalleryItem.findAll({
          where: { wardId, showOnDashboard: true },
          attributes: ['id', 'orderIndex'],
          order: [['orderIndex', 'ASC']],
        });
        homeIds = starred.map((row) => String(row.id));
      } catch {
        homeIds = [];
      }
    }
  }
  configData.dashboardWorkOrder = homeIds;
  meta.dashboardWorkOrder = homeIds;
  configData.meta = meta;
  return configData;
}

module.exports = {
  asFlag,
  getBanners,
  upsertBanners,
  listHomeWorkIds,
  setHomeWorkIds,
  addHomeWork,
  removeHomeWork,
  attachLayout,
};
