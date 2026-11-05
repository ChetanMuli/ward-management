'use strict';

const {
  WardPortalConfig,
  WardGalleryItem,
  Ward,
  User,
  NagarsevakUser,
  Role,
} = require('../../models');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { success } = require('../../utils/apiResponse');
const { isWardAllowed } = require('../services/wardScope');
const { persistDataUrl, persistVideoUrl, persistImageFields, publicImageUrl, persistInBackground, writePortalFile, retireIfReplaced, retirePortalUrl } = require('../../utils/portalMedia');
const path = require('path');
  const {
  CIVIC_DEFAULT_HERO,
  isProtectedCustomWard,
  isCampaignStockUrl,
  isGenericDefaultHero,
  resolveCitizenHeroUrl,
} = require('../../utils/defaultCitizenPortal');
const { getActiveNagarsevakIds, getVisibleNagarsevakIds } = require('../../services/wardActivation.service');
const portalLayout = require('../../services/portalLayout.service');
const { Op } = require('sequelize');

function asMeta(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return { ...value };
  return {};
}

const DEFAULT_PORTAL_CONFIG = {
  heroBannerUrl: CIVIC_DEFAULT_HERO,
  heroTitleEn: '',
  heroTitleMr: '',
  heroSubtitleEn: '',
  heroSubtitleMr: '',
  heroBadgeEn: '',
  heroBadgeMr: '',
  ctaPrimaryTextEn: 'Raise a complaint',
  ctaPrimaryTextMr: 'तक्रार नोंदवा',
  ctaPrimaryLink: '/my-complaints',
  ctaSecondaryTextEn: 'View Work',
  ctaSecondaryTextMr: 'विकास कामे पहा',
  ctaSecondaryLink: '/gallery',
  showGalleryPreview: true,
  minimalWorkCount: 4,
};

function asDashboardFlag(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (Buffer.isBuffer(value)) return Boolean(value[0]);
  if (value && typeof value === 'object' && Array.isArray(value.data)) return Boolean(value.data[0]);
  return false;
}

function canManage(req) {
  const role = req.user?.roleName;
  return ['SUPER_ADMIN', 'SUB_MASTER_ADMIN', 'NAGARSEVAK'].includes(role);
}

function requestedWardId(req) {
  if (req.query?.wardId !== undefined && req.query.wardId !== '') return String(req.query.wardId);
  if (req.body?.wardId !== undefined && req.body.wardId !== '') return String(req.body.wardId);
  return null;
}

/** Citizen portal is always per-ward. Nagarsevak is locked to their ward. */
async function resolveWardId(req, { forWrite = false } = {}) {
  const role = req.user?.roleName;
  if (role === 'NAGARSEVAK' || role === 'CITIZEN' || role === 'EMPLOYEE') return req.user.wardId || null;

  const explicit = requestedWardId(req);
  if (explicit) {
    if (req.user && ['SUPER_ADMIN', 'SUB_MASTER_ADMIN'].includes(role) && !isWardAllowed(req, explicit)) {
      throw new ApiError(403, 'You do not have access to this ward portal.');
    }
    return explicit;
  }

  if (req.user?.wardId) return req.user.wardId;
  if (forWrite) return null;
  return null;
}

function looksLikeStat(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  if (s.length > 12) return false;
  return /[\d०-९]/.test(s) || /[%+]/.test(s);
}

function sameText(a, b) {
  return String(a || '').replace(/\s+/g, ' ').trim().toLowerCase()
    === String(b || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function serializeHighlightCards(list) {
  if (!Array.isArray(list)) return [];
  return list.map((a, idx) => {
    if (!a) return null;
    if (typeof a === 'string') {
      const parts = a.split('|').map((s) => s.trim()).filter(Boolean);
      if (!parts.length) return null;
      const first = parts[0];
      const asStat = looksLikeStat(first);
      return {
        id: `ach-${idx + 1}`,
        icon: '🏆',
        metric: asStat ? first : '',
        metricEn: asStat ? first : '',
        label: asStat ? (parts[1] || '') : first,
        labelEn: asStat ? (parts[1] || '') : first,
        desc: asStat ? (parts[2] || '') : (parts[1] || ''),
        descEn: asStat ? (parts[2] || '') : (parts[1] || ''),
      };
    }
    let metric = String(a.metric || a.metricMr || '').trim();
    let metricEn = String(a.metricEn || '').trim() || metric;
    let label = String(a.label || a.labelMr || a.title || '').trim();
    let labelEn = String(a.labelEn || a.titleEn || '').trim() || label;
    let desc = String(a.desc || a.descMr || '').trim();
    let descEn = String(a.descEn || '').trim() || desc;
    if (metric && !looksLikeStat(metric)) {
      if (!label) label = metric;
      metric = '';
    }
    if (metricEn && !looksLikeStat(metricEn)) {
      if (!labelEn) labelEn = metricEn;
      metricEn = '';
    }
    if (metric && sameText(metric, label)) metric = '';
    if (metricEn && sameText(metricEn, labelEn || label)) metricEn = '';
    if (desc && (sameText(desc, label) || sameText(desc, metric))) desc = '';
    if (descEn && (sameText(descEn, labelEn || label) || sameText(descEn, metricEn || metric))) descEn = '';
    if (![metric, metricEn, label, labelEn, desc, descEn].some(Boolean)) return null;
    return {
      id: a.id || `ach-${idx + 1}`,
      icon: String(a.icon || '🏆').trim().slice(0, 8) || '🏆',
      metric: metric || metricEn,
      metricEn: metricEn || metric,
      label: label || labelEn,
      labelEn: labelEn || label,
      desc: desc || descEn,
      descEn: descEn || desc,
    };
  }).filter(Boolean).slice(0, 8);
}

function serializeNagarsevak(nagarUser) {
  if (!nagarUser) return null;
  const acc = nagarUser.nagarsevakAccount || {};
  let achievements = acc.achievements;
  if (typeof achievements === 'string') {
    try { achievements = JSON.parse(achievements); } catch (_) { achievements = []; }
  }
  return {
    id: nagarUser.id,
    name: nagarUser.name,
    email: nagarUser.email,
    mobile: nagarUser.mobile,
    wardSeat: acc.wardSeat || null,
    partyName: acc.partyName || null,
    officialAddress: acc.officialAddress || null,
    photo: (typeof nagarUser.getDataValue === 'function' ? nagarUser.getDataValue('photo') : null) || acc.photo || null,
    bio: acc.bio || null,
    officeTimings: acc.officeTimings || null,
    whatsapp: acc.whatsapp || null,
    achievements: serializeHighlightCards(achievements),
    socialLinks: acc.socialLinks || {},
  };
}

async function loadWardNagarsevaks(wardId, { includeInactive = false } = {}) {
  if (!wardId) return [];
  const nagarRole = await Role.findOne({ where: { name: 'NAGARSEVAK' }, attributes: ['id'] });
  if (!nagarRole) return [];
  const where = { roleId: nagarRole.id, wardId };
  if (!includeInactive) where.status = 'ACTIVE';
  const rows = await User.findAll({
    where,
    attributes: ['id', 'name', 'email', 'mobile', 'wardId', 'status'],
    include: [{
      model: NagarsevakUser,
      as: 'nagarsevakAccount',
      attributes: [
        'wardSeat', 'partyName', 'officialAddress', 'bio', 'officeTimings', 'whatsapp', 'achievements', 'socialLinks',
        [
          NagarsevakUser.sequelize.literal("CASE WHEN `nagarsevakAccount`.`photo` LIKE 'data:%' THEN NULL ELSE `nagarsevakAccount`.`photo` END"),
          'photo',
        ],
      ],
      required: false,
    }],
    order: [['createdAt', 'ASC']],
  });
  return rows.map(serializeNagarsevak).filter(Boolean);
}

function mergeConfig(row, ward) {
  const json = row ? (typeof row.toJSON === 'function' ? row.toJSON() : row) : {};
  json.meta = asMeta(json.meta);
  return {
    ...DEFAULT_PORTAL_CONFIG,
    ...json,
    heroBannerUrl: json.heroBannerUrl || DEFAULT_PORTAL_CONFIG.heroBannerUrl,
    meta: json.meta,
    wardId: json.wardId || ward?.id || null,
    isCustomized: Boolean(row && row.wardId),
  };
}

const PANEL_OVERLAY_FIELDS = [
  'heroBannerUrl',
  'heroTitleEn',
  'heroTitleMr',
  'heroSubtitleEn',
  'heroSubtitleMr',
  'heroBadgeEn',
  'heroBadgeMr',
  'ctaPrimaryTextEn',
  'ctaPrimaryTextMr',
  'ctaPrimaryLink',
  'ctaSecondaryTextEn',
  'ctaSecondaryTextMr',
  'ctaSecondaryLink',
  'showGalleryPreview',
  'minimalWorkCount',
];

function readPanelOverlay(meta, nagarsevakId) {
  const parsed = asMeta(meta);
  const id = String(nagarsevakId || '').trim();
  if (!id || !parsed.panels || typeof parsed.panels !== 'object') return null;
  const overlay = parsed.panels[id];
  return overlay && typeof overlay === 'object' ? overlay : null;
}

function blankPanelConfig(configData) {
  const meta = { ...(configData.meta && typeof configData.meta === 'object' ? configData.meta : {}) };
  meta.complaintsBannerUrl = '';
  meta.galleryBannerUrl = '';
  meta.dashboardWorkOrder = [];
  meta.repPhoto = '';
  return {
    ...configData,
    heroBannerUrl: CIVIC_DEFAULT_HERO,
    complaintsBannerUrl: '',
    galleryBannerUrl: '',
    dashboardWorkOrder: [],
    meta,
  };
}

function sameAsset(a, b) {
  const left = String(a || '').trim().split('?')[0].replace(/^\/api/, '');
  const right = String(b || '').trim().split('?')[0].replace(/^\/api/, '');
  return Boolean(left && right && left === right);
}

function applyPanelOverlay(configData, nagarsevakId, { ownerId, wardSnapshot } = {}) {
  const overlay = readPanelOverlay(configData?.meta, nagarsevakId);
  const next = blankPanelConfig(configData);
  if (!overlay) return next;
  for (const key of PANEL_OVERLAY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(overlay, key)) next[key] = overlay[key];
  }
  if (Object.prototype.hasOwnProperty.call(overlay, 'complaintsBannerUrl')) {
    next.meta.complaintsBannerUrl = overlay.complaintsBannerUrl;
    next.complaintsBannerUrl = overlay.complaintsBannerUrl;
  }
  if (Object.prototype.hasOwnProperty.call(overlay, 'galleryBannerUrl')) {
    next.meta.galleryBannerUrl = overlay.galleryBannerUrl;
    next.galleryBannerUrl = overlay.galleryBannerUrl;
  }
  if (Object.prototype.hasOwnProperty.call(overlay, 'dashboardWorkOrder')) {
    next.meta.dashboardWorkOrder = overlay.dashboardWorkOrder;
    next.dashboardWorkOrder = overlay.dashboardWorkOrder;
  }
  const isOwner = ownerId && String(nagarsevakId) === String(ownerId);
  const customHero = overlay.heroBannerUrl && !isGenericDefaultHero(overlay.heroBannerUrl);
  if (customHero) {
    next.heroBannerUrl = overlay.heroBannerUrl;
  } else if (overlay.useCivicHero || isGenericDefaultHero(overlay.heroBannerUrl) || isGenericDefaultHero(next.heroBannerUrl)) {
    next.heroBannerUrl = CIVIC_DEFAULT_HERO;
  } else if (!isOwner && wardSnapshot && sameAsset(next.heroBannerUrl, wardSnapshot.heroBannerUrl)) {
    next.heroBannerUrl = CIVIC_DEFAULT_HERO;
  }
  if (!isOwner && wardSnapshot) {
    if (sameAsset(next.complaintsBannerUrl, wardSnapshot.complaintsBannerUrl)) {
      next.complaintsBannerUrl = '';
      next.meta.complaintsBannerUrl = '';
    }
    if (sameAsset(next.galleryBannerUrl, wardSnapshot.galleryBannerUrl)) {
      next.galleryBannerUrl = '';
      next.meta.galleryBannerUrl = '';
    }
  }
  if (isGenericDefaultHero(next.heroBannerUrl)) {
    next.heroBannerUrl = CIVIC_DEFAULT_HERO;
  } else {
    next.heroBannerUrl = publicImageUrl(next.heroBannerUrl, CIVIC_DEFAULT_HERO);
  }
  next.complaintsBannerUrl = publicImageUrl(next.complaintsBannerUrl, '');
  next.galleryBannerUrl = publicImageUrl(next.galleryBannerUrl, '');
  next.meta.complaintsBannerUrl = publicImageUrl(next.meta.complaintsBannerUrl, '');
  next.meta.galleryBannerUrl = publicImageUrl(next.meta.galleryBannerUrl, '');
  return next;
}

function snapshotWardBanners(configData) {
  const overlay = {};
  for (const key of PANEL_OVERLAY_FIELDS) {
    if (configData[key] !== undefined) overlay[key] = configData[key];
  }
  overlay.complaintsBannerUrl = configData.complaintsBannerUrl || configData.meta?.complaintsBannerUrl || '';
  overlay.galleryBannerUrl = configData.galleryBannerUrl || configData.meta?.galleryBannerUrl || '';
  overlay.dashboardWorkOrder = Array.isArray(configData.dashboardWorkOrder)
    ? configData.dashboardWorkOrder
    : (Array.isArray(configData.meta?.dashboardWorkOrder) ? configData.meta.dashboardWorkOrder : []);
  return overlay;
}

function resolveLegacyOwnerId(configData, nagarsevaks, fallbackId) {
  const meta = configData?.meta && typeof configData.meta === 'object' ? configData.meta : {};
  const repName = String(meta.repName || '').trim().toLowerCase();
  if (repName) {
    const exact = nagarsevaks.find((n) => String(n.name || '').trim().toLowerCase() === repName);
    if (exact) return String(exact.id);
    const first = repName.split(/\s+/)[0];
    const partial = nagarsevaks.find((n) => String(n.name || '').toLowerCase().includes(first));
    if (partial) return String(partial.id);
  }
  return fallbackId ? String(fallbackId) : '';
}

/**
 * GET /api/v2/portal-config
 * Fetch portal banner, headlines, CTA, and leader spotlight info for ONE ward.
 */
const getPortalConfig = asyncHandler(async (req, res) => {
  const wardId = await resolveWardId(req, { forWrite: false });
  let configRow = null;
  if (wardId) {
    const portalAttrs = Object.keys(WardPortalConfig.rawAttributes).filter((k) => k !== 'heroBannerUrl');
    configRow = await WardPortalConfig.findOne({
      where: { wardId },
      attributes: [
        ...portalAttrs,
        [
          WardPortalConfig.sequelize.literal("CASE WHEN `hero_banner_url` LIKE 'data:%' THEN '/hero-ward-default.jpg' ELSE `hero_banner_url` END"),
          'heroBannerUrl',
        ],
      ],
    });
  }
  const ward = wardId ? await Ward.findByPk(wardId, { attributes: ['id', 'wardNumber', 'name', 'status'] }) : null;
  let configData = mergeConfig(configRow, ward);
  if (wardId) configData.wardId = wardId;

  const persistJobs = [];
  if (configRow && configData.heroBannerUrl && String(configData.heroBannerUrl).startsWith('data:image/')) {
    configData.heroBannerUrl = DEFAULT_PORTAL_CONFIG.heroBannerUrl;
    persistJobs.push(async () => {
      const rawHero = configRow.heroBannerUrl;
      if (!rawHero || !String(rawHero).startsWith('data:image/')) return;
      const fileUrl = persistDataUrl(rawHero, `hero-${String(wardId || 'ward').slice(0, 8)}`);
      if (fileUrl && !String(fileUrl).startsWith('data:')) await configRow.update({ heroBannerUrl: fileUrl });
    });
  }
  configData.heroBannerUrl = publicImageUrl(configData.heroBannerUrl, DEFAULT_PORTAL_CONFIG.heroBannerUrl);

  if (configRow && configData.meta && typeof configData.meta === 'object') {
    const meta = { ...configData.meta };
    if (meta.repPhoto && String(meta.repPhoto).startsWith('data:image/')) {
      const fileUrl = persistDataUrl(meta.repPhoto, `rep-${String(wardId || 'ward').slice(0, 8)}`);
      if (fileUrl && !String(fileUrl).startsWith('data:')) {
        meta.repPhoto = fileUrl;
        persistJobs.push(() => configRow.update({ meta }));
      } else {
        meta.repPhoto = '';
      }
    }
    meta.repPhoto = publicImageUrl(meta.repPhoto, '');
    meta.complaintsBannerUrl = publicImageUrl(meta.complaintsBannerUrl, '');
    meta.galleryBannerUrl = publicImageUrl(meta.galleryBannerUrl, '');
    configData.meta = meta;
  }
  await portalLayout.attachLayout(wardId, configData, persistJobs);

  const manager = canManage(req);
  const visibleIds = wardId ? (await getVisibleNagarsevakIds(wardId)).map(String) : [];
  const activeIds = wardId ? (await getActiveNagarsevakIds(wardId)).map(String) : [];
  const requestedId = String(req.query.nagarsevakId || '').trim();
  const nagarsevaks = await loadWardNagarsevaks(wardId, { includeInactive: manager });
  const editorIds = manager ? activeIds : visibleIds;
  const featuredId = (requestedId && editorIds.includes(requestedId))
    ? requestedId
    : (visibleIds.includes(String(configData.featuredNagarsevakUserId || ''))
      ? String(configData.featuredNagarsevakUserId)
      : (visibleIds[0] || (manager ? (activeIds[0] || '') : '')));
  const legacyOwnerId = visibleIds.includes(String(configData.featuredNagarsevakUserId || ''))
    ? String(configData.featuredNagarsevakUserId)
    : (visibleIds[0] || activeIds[0] || '');
  nagarsevaks.sort((a, b) => {
    if (String(a.id) === String(featuredId)) return -1;
    if (String(b.id) === String(featuredId)) return 1;
    return 0;
  });
  for (const nagar of nagarsevaks) {
    if (nagar?.photo && String(nagar.photo).startsWith('data:image/')) {
      const raw = nagar.photo;
      persistJobs.push(async () => {
        const fileUrl = persistDataUrl(raw, `nagar-${String(nagar.id || 'p').slice(0, 8)}`);
        if (fileUrl && !String(fileUrl).startsWith('data:')) {
          const acc = await NagarsevakUser.findByPk(nagar.id);
          if (acc) await acc.update({ photo: fileUrl });
        }
      });
      nagar.photo = '';
    }
    if (nagar) nagar.photo = publicImageUrl(nagar.photo, '');
  }

  const purchased = nagarsevaks.filter((n) => visibleIds.includes(String(n.id)));
  const activeNagarsevaks = nagarsevaks.filter((n) => activeIds.includes(String(n.id)));
  const ownerId = resolveLegacyOwnerId(configData, nagarsevaks, legacyOwnerId);
  const wardSnapshot = snapshotWardBanners(configData);
  if (featuredId) {
    configData = applyPanelOverlay(configData, featuredId, { ownerId, wardSnapshot });
  }
  const wardInactive = String(ward?.status || '').toUpperCase() !== 'ACTIVE';
  const demoMode = !purchased.length || wardInactive;
  if (demoMode && !manager) {
    configData.heroBannerUrl = CIVIC_DEFAULT_HERO;
    if (isCampaignStockUrl(configData.complaintsBannerUrl)) configData.complaintsBannerUrl = '';
    if (isCampaignStockUrl(configData.galleryBannerUrl)) configData.galleryBannerUrl = '';
    if (configData.meta && typeof configData.meta === 'object') {
      if (isCampaignStockUrl(configData.meta.complaintsBannerUrl)) configData.meta.complaintsBannerUrl = '';
      if (isCampaignStockUrl(configData.meta.galleryBannerUrl)) configData.meta.galleryBannerUrl = '';
    }
  } else if (!demoMode) {
    configData.heroBannerUrl = resolveCitizenHeroUrl(configData.heroBannerUrl, { demoMode: false });
  }
  const nagarsevak = nagarsevaks.find((n) => String(n.id) === String(featuredId))
    || purchased.find((n) => String(n.id) === String(req.user?.id))
    || purchased[0]
    || nagarsevaks[0]
    || null;

  persistInBackground(persistJobs);
  return success(res, {
    data: {
      config: {
        ...configData,
        demoMode,
        selectedNagarsevakUserId: featuredId || null,
        purchasedNagarsevakUserId: (req.user?.roleName === 'NAGARSEVAK' && purchased.some((n) => String(n.id) === String(req.user.id)))
          ? req.user.id
          : (featuredId || purchased[0]?.id || null),
      },
      ward: ward ? { id: ward.id, wardNumber: ward.wardNumber, name: ward.name, status: ward.status } : null,
      nagarsevak,
      nagarsevaks: manager ? activeNagarsevaks : purchased,
      purchasedNagarsevaks: purchased,
      activation: {
        wardActive: !wardInactive,
        purchasedCount: purchased.length,
        purchasedNagarsevakUserId: (req.user?.roleName === 'NAGARSEVAK' && purchased.some((n) => String(n.id) === String(req.user.id)))
          ? req.user.id
          : (featuredId || purchased[0]?.id || null),
        demoMode,
      },
    },
  });
});

/**
 * PATCH /api/v2/portal-config
 * Update portal config and/or Nagarsevak spotlight details
 */
const updatePortalConfig = asyncHandler(async (req, res) => {
  if (!canManage(req)) {
    throw new ApiError(403, 'You do not have permission to manage the Citizen Portal.');
  }

  const wardId = await resolveWardId(req, { forWrite: true });
  if (!wardId) {
    throw new ApiError(400, 'Select a ward before saving the citizen portal.');
  }

  let config = await WardPortalConfig.findOne({ where: { wardId } });
  const isCreate = !config;

  const allowedFields = [
    'heroBannerUrl',
    'heroTitleEn',
    'heroTitleMr',
    'heroSubtitleEn',
    'heroSubtitleMr',
    'heroBadgeEn',
    'heroBadgeMr',
    'ctaPrimaryTextEn',
    'ctaPrimaryTextMr',
    'ctaPrimaryLink',
    'ctaSecondaryTextEn',
    'ctaSecondaryTextMr',
    'ctaSecondaryLink',
    'showGalleryPreview',
    'minimalWorkCount',
    'featuredNagarsevakUserId',
    'meta',
  ];

  const patch = { updatedBy: req.user.id };
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      patch[field] = req.body[field];
    }
  }
  const prevHero = config?.heroBannerUrl;
  persistImageFields(patch, ['heroBannerUrl'], `hero-${String(wardId).slice(0, 8)}`);
  if (typeof patch.heroBannerUrl === 'string' && patch.heroBannerUrl.startsWith('data:')) {
    throw new ApiError(400, 'Could not store the hero banner on the server. Check that the uploads/portal folder is writable.');
  }
  if (typeof patch.heroBannerUrl === 'string') {
    patch.heroBannerUrl = publicImageUrl(patch.heroBannerUrl, patch.heroBannerUrl);
  }

  const existingMeta = asMeta(config && config.meta);
  if (Object.prototype.hasOwnProperty.call(req.body, 'dashboardWorkOrder')) {
    const ids = Array.isArray(req.body.dashboardWorkOrder) ? req.body.dashboardWorkOrder.map(String).filter(Boolean) : [];
    patch.meta = { ...existingMeta, ...(patch.meta && typeof patch.meta === 'object' ? patch.meta : {}), dashboardWorkOrder: ids };
  } else if (patch.meta && typeof patch.meta === 'object') {
    patch.meta = { ...existingMeta, ...patch.meta };
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'complaintsBannerUrl') || Object.prototype.hasOwnProperty.call(req.body, 'galleryBannerUrl')) {
    patch.meta = { ...existingMeta, ...(patch.meta && typeof patch.meta === 'object' ? patch.meta : {}) };
    if (Object.prototype.hasOwnProperty.call(req.body, 'complaintsBannerUrl')) {
      patch.meta.complaintsBannerUrl = req.body.complaintsBannerUrl;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'galleryBannerUrl')) {
      patch.meta.galleryBannerUrl = req.body.galleryBannerUrl;
    }
  }
  if (patch.meta && typeof patch.meta === 'object') {
    persistImageFields(patch.meta, ['repPhoto'], `rep-${String(wardId).slice(0, 8)}`);
    persistImageFields(patch.meta, ['complaintsBannerUrl'], `complaints-${String(wardId).slice(0, 8)}`);
    persistImageFields(patch.meta, ['galleryBannerUrl'], `gallery-${String(wardId).slice(0, 8)}`);
    retireIfReplaced(existingMeta.repPhoto, patch.meta.repPhoto);
    retireIfReplaced(existingMeta.complaintsBannerUrl, patch.meta.complaintsBannerUrl);
    retireIfReplaced(existingMeta.galleryBannerUrl, patch.meta.galleryBannerUrl);
    for (const key of Object.keys(patch.meta)) {
      if (typeof patch.meta[key] === 'string' && patch.meta[key].startsWith('data:')) {
        const stored = persistDataUrl(patch.meta[key], `meta-${key}`);
        patch.meta[key] = stored && !String(stored).startsWith('data:') ? stored : (existingMeta[key] && !String(existingMeta[key]).startsWith('data:') ? existingMeta[key] : '');
      }
    }
  }

  const panelId = String(req.body.nagarsevakUserId || req.body.nagarsevakId || req.body.nagarsevak?.id || '').trim();
  if (panelId) {
    const incomingMeta = (patch.meta && typeof patch.meta === 'object') ? { ...patch.meta } : {};
    delete incomingMeta.panels;
    const nextMeta = { ...existingMeta, ...incomingMeta, panels: { ...(existingMeta.panels && typeof existingMeta.panels === 'object' ? existingMeta.panels : {}) } };
    const overlay = { ...((nextMeta.panels[panelId] && typeof nextMeta.panels[panelId] === 'object') ? nextMeta.panels[panelId] : {}) };
    for (const field of PANEL_OVERLAY_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(patch, field)) {
        overlay[field] = patch[field];
        delete patch[field];
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'complaintsBannerUrl')) {
      overlay.complaintsBannerUrl = Object.prototype.hasOwnProperty.call(nextMeta, 'complaintsBannerUrl')
        ? nextMeta.complaintsBannerUrl
        : req.body.complaintsBannerUrl;
      delete nextMeta.complaintsBannerUrl;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'galleryBannerUrl')) {
      overlay.galleryBannerUrl = Object.prototype.hasOwnProperty.call(nextMeta, 'galleryBannerUrl')
        ? nextMeta.galleryBannerUrl
        : req.body.galleryBannerUrl;
      delete nextMeta.galleryBannerUrl;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'dashboardWorkOrder')) {
      overlay.dashboardWorkOrder = nextMeta.dashboardWorkOrder;
      delete nextMeta.dashboardWorkOrder;
    }
    persistImageFields(overlay, ['heroBannerUrl'], `hero-p-${String(panelId).slice(0, 8)}`);
    if (typeof overlay.heroBannerUrl === 'string' && overlay.heroBannerUrl.startsWith('data:')) {
      throw new ApiError(400, 'Could not store the hero banner on the server. Check that the uploads/portal folder is writable.');
    }
    const hasCustomHero = overlay.heroBannerUrl && !isGenericDefaultHero(overlay.heroBannerUrl);
    overlay.useCivicHero = hasCustomHero
      ? false
      : (Object.prototype.hasOwnProperty.call(req.body, 'useCivicHero')
        ? Boolean(req.body.useCivicHero)
        : true);
    if (overlay.useCivicHero) overlay.heroBannerUrl = CIVIC_DEFAULT_HERO;
    persistImageFields(overlay, ['complaintsBannerUrl'], `complaints-p-${String(panelId).slice(0, 8)}`);
    persistImageFields(overlay, ['galleryBannerUrl'], `gallery-p-${String(panelId).slice(0, 8)}`);
    nextMeta.panels = { ...(nextMeta.panels && typeof nextMeta.panels === 'object' ? nextMeta.panels : {}), [panelId]: overlay };
    patch.meta = JSON.parse(JSON.stringify(nextMeta));
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'featuredNagarsevakUserId') && patch.featuredNagarsevakUserId && !panelId) {
    const visibleIds = (await getVisibleNagarsevakIds(wardId)).map(String);
    if (!visibleIds.includes(String(patch.featuredNagarsevakUserId))) {
      throw new ApiError(400, 'Show only a Nagarsevak you have already activated for this ward.');
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'heroBannerUrl')) {
    retireIfReplaced(prevHero, patch.heroBannerUrl);
  }

  if (isCreate) {
    patch.wardId = wardId;
    config = await WardPortalConfig.create(patch);
  } else {
    if (patch.meta) {
      config.set('meta', patch.meta);
      config.changed('meta', true);
    }
    await config.update(patch);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'dashboardWorkOrder') && !panelId) {
    const ids = Array.isArray(req.body.dashboardWorkOrder) ? req.body.dashboardWorkOrder.map(String).filter(Boolean) : [];
    await portalLayout.setHomeWorkIds(wardId, ids);
  }

  if (!panelId) {
    const bannerUrls = {};
    if (Object.prototype.hasOwnProperty.call(patch, 'heroBannerUrl') || Object.prototype.hasOwnProperty.call(req.body, 'heroBannerUrl')) {
      bannerUrls.homeBannerUrl = patch.heroBannerUrl || req.body.heroBannerUrl;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'complaintsBannerUrl') || patch.meta?.complaintsBannerUrl !== undefined) {
      bannerUrls.complaintsBannerUrl = req.body.complaintsBannerUrl !== undefined ? req.body.complaintsBannerUrl : patch.meta.complaintsBannerUrl;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'galleryBannerUrl') || patch.meta?.galleryBannerUrl !== undefined) {
      bannerUrls.galleryBannerUrl = req.body.galleryBannerUrl !== undefined ? req.body.galleryBannerUrl : patch.meta.galleryBannerUrl;
    }
    if (Object.keys(bannerUrls).length) {
      await portalLayout.upsertBanners(wardId, bannerUrls, req.user.id);
    }
  }

  // Update Nagarsevak details if provided in request
  const nagarData = req.body.nagarsevak;
  let updatedNagarsevak = null;
  if (nagarData && typeof nagarData === 'object') {
    const nagarRole = await Role.findOne({ where: { name: 'NAGARSEVAK' } });
    let targetNagar = null;

    if (req.user.roleName === 'NAGARSEVAK') {
      targetNagar = await User.findByPk(req.user.id);
    } else if (wardId && nagarRole) {
      if (nagarData.id) {
        targetNagar = await User.findOne({
          where: { id: nagarData.id, roleId: nagarRole.id, wardId },
        });
        if (!targetNagar) throw new ApiError(400, 'That nagarsevak does not belong to this ward.');
      } else {
        throw new ApiError(400, 'Select which nagarsevak to update before saving.');
      }
    }

    if (targetNagar) {
      const userPatch = {};
      if (nagarData.name && String(nagarData.name).trim()) userPatch.name = String(nagarData.name).trim();
      if (nagarData.mobile && /^\d{10}$/.test(String(nagarData.mobile))) userPatch.mobile = String(nagarData.mobile).trim();
      if (nagarData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(nagarData.email))) userPatch.email = String(nagarData.email).trim();

      if (Object.keys(userPatch).length) {
        await targetNagar.update(userPatch);
      }

      // Update role login nagarsevak account
      let acc = await NagarsevakUser.findByPk(targetNagar.id);
      const accPatch = {};
      for (const k of ['wardSeat', 'partyName', 'officialAddress', 'photo', 'bio', 'officeTimings', 'whatsapp', 'achievements', 'socialLinks']) {
        if (Object.prototype.hasOwnProperty.call(nagarData, k)) {
          accPatch[k] = k === 'achievements' ? serializeHighlightCards(nagarData[k]) : nagarData[k];
          targetNagar.setDataValue(k, nagarData[k]);
        }
      }
      persistImageFields(accPatch, ['photo'], `nagar-${String(targetNagar.id).slice(0, 8)}`);
      if (Object.prototype.hasOwnProperty.call(accPatch, 'photo')) {
        retireIfReplaced(acc?.photo, accPatch.photo);
      }

      if (acc) {
        await acc.update(accPatch);
      } else {
        await NagarsevakUser.create({ id: targetNagar.id, ...accPatch });
      }

      updatedNagarsevak = {
        id: targetNagar.id,
        name: targetNagar.name,
        email: targetNagar.email,
        mobile: targetNagar.mobile,
        ...accPatch,
      };
    }
  }

  const nagarsevaks = await loadWardNagarsevaks(wardId);
  const featuredId = config.featuredNagarsevakUserId;
  const featured = nagarsevaks.find((n) => String(n.id) === String(featuredId))
    || updatedNagarsevak
    || nagarsevaks[0]
    || null;

  const saved = typeof config.toJSON === 'function' ? config.toJSON() : config;
  const ownerId = resolveLegacyOwnerId(saved, nagarsevaks, String(featuredId || ''));
  const shown = panelId
    ? applyPanelOverlay(saved, panelId, { ownerId, wardSnapshot: snapshotWardBanners(saved) })
    : saved;
  return success(res, {
    message: 'Portal configuration updated successfully.',
    data: {
      config: shown,
      nagarsevak: featured,
      nagarsevaks,
    },
  });
});

/**
 * GET /api/v2/gallery-items
 * Fetch published gallery items and videos (or all if admin/nagarsevak)
 */
const listGalleryItems = asyncHandler(async (req, res) => {
  const wardId = await resolveWardId(req, { forWrite: false });
  if (!wardId) {
    return success(res, { data: [], total: 0 });
  }
  const where = { wardId };

  // Citizens and unauthenticated visitors only see PUBLISHED items
  const isManager = req.user && ['SUPER_ADMIN', 'SUB_MASTER_ADMIN', 'NAGARSEVAK'].includes(req.user.roleName);
  if (!isManager || req.query.status === 'PUBLISHED') {
    where.status = 'PUBLISHED';
  } else if (req.query.status) {
    where.status = req.query.status;
  }

  if (req.query.category && req.query.category !== 'ALL') {
    where.category = req.query.category;
  }

  if (req.query.mediaType) {
    where.mediaType = req.query.mediaType;
  }

  const panelId = String(req.query.nagarsevakId || '').trim();
  if (panelId) {
    const cfg = await WardPortalConfig.findOne({ where: { wardId }, attributes: ['featuredNagarsevakUserId'] });
    const visibleIds = (await getVisibleNagarsevakIds(wardId)).map(String);
    const activeIds = (await getActiveNagarsevakIds(wardId)).map(String);
    const legacyOwnerId = visibleIds.includes(String(cfg?.featuredNagarsevakUserId || ''))
      ? String(cfg.featuredNagarsevakUserId)
      : (visibleIds[0] || activeIds[0] || '');
    if (legacyOwnerId && String(panelId) === String(legacyOwnerId)) {
      where[Op.or] = [
        { nagarsevakUserId: panelId },
        { nagarsevakUserId: null },
      ];
    } else {
      where.nagarsevakUserId = panelId;
    }
  }

  const dashboardFilter = req.query.showOnDashboard;
  if (dashboardFilter !== undefined) {
    where.showOnDashboard = asDashboardFlag(dashboardFilter);
  }

  const items = await WardGalleryItem.findAll({
    where,
    attributes: [
      'id', 'wardId', 'nagarsevakUserId', 'title', 'titleMr', 'category', 'categoryLabel', 'categoryLabelMr',
      'mediaType', 'videoUrl', 'duration', 'date', 'dateFormatted', 'dateFormattedMr', 'location', 'badge',
      'description', 'descriptionMr', 'status', 'orderIndex', 'showOnDashboard', 'createdAt', 'updatedAt',
      [
        WardGalleryItem.sequelize.literal("CASE WHEN `media_url` LIKE 'data:%' THEN '/gallery/water-pipeline.svg' ELSE `media_url` END"),
        'mediaUrl',
      ],
    ],
    order: [
      ['orderIndex', 'ASC'],
      ['date', 'DESC'],
      ['createdAt', 'DESC'],
    ],
  });

  persistInBackground([async () => {
    const heavy = await WardGalleryItem.findAll({
      where: {
        ...where,
        mediaUrl: { [Op.like]: 'data:%' },
      },
      attributes: ['id', 'mediaUrl'],
    }).catch(() => []);
    for (const item of heavy || []) {
      if (!item.mediaUrl || !String(item.mediaUrl).startsWith('data:image/')) continue;
      const fileUrl = persistDataUrl(item.mediaUrl, `work-${String(item.id).slice(0, 8)}`);
      if (fileUrl && !String(fileUrl).startsWith('data:')) await item.update({ mediaUrl: fileUrl });
    }
  }]);

  const rows = items.map((row) => {
    const json = typeof row.toJSON === 'function' ? row.toJSON() : row;
    json.showOnDashboard = asDashboardFlag(json.showOnDashboard);
    json.mediaUrl = publicImageUrl(json.mediaUrl, json.mediaUrl || '');
    json.videoUrl = publicImageUrl(json.videoUrl, json.videoUrl || '');
    return json;
  });
  const homeIds = await portalLayout.listHomeWorkIds(wardId);
  if (homeIds.length) {
    rows.forEach((json) => {
      const idx = homeIds.indexOf(String(json.id));
      if (idx !== -1) {
        json.showOnDashboard = true;
        json.homeOrderIndex = idx;
      }
    });
  }

  if (!isManager) {
    const ward = await Ward.findByPk(wardId, { attributes: ['id', 'wardNumber', 'name', 'status'] });
    const visibleIds = (await getVisibleNagarsevakIds(wardId)).map(String);
    const unsold = !visibleIds.length && !isProtectedCustomWard(ward);
    if (unsold) {
      return success(res, { data: [], total: 0, demo: false });
    }
  }

  if (!rows.length && !isManager) {
    return success(res, { data: [], total: 0, demo: false });
  }

  return success(res, {
    data: rows,
    total: rows.length,
    demo: false,
  });
});

/**
 * POST /api/v2/gallery-items
 * Add a new development work / video to the gallery
 */
const createGalleryItem = asyncHandler(async (req, res) => {
  if (!canManage(req)) {
    throw new ApiError(403, 'Permission denied.');
  }

  const wardId = await resolveWardId(req, { forWrite: true });
  if (!wardId) {
    throw new ApiError(400, 'Select a ward before adding gallery items.');
  }
  const {
    title,
    titleMr,
    category = 'DEVELOPMENT',
    categoryLabel,
    categoryLabelMr,
    mediaType = 'image',
    mediaUrl,
    videoUrl,
    duration,
    date,
    dateFormatted,
    dateFormattedMr,
    location,
    badge,
    description,
    descriptionMr,
    status = 'PUBLISHED',
    orderIndex,
    showOnDashboard = false,
  } = req.body;

  if (!title || !String(title).trim()) {
    throw new ApiError(400, 'Title is required');
  }
  if (!mediaUrl && !videoUrl) {
    throw new ApiError(400, 'Please provide an image or video URL/file');
  }

  let finalOrder = Number.isInteger(Number(orderIndex)) ? Number(orderIndex) : 0;
  if (!Object.prototype.hasOwnProperty.call(req.body, 'orderIndex')) {
    const maxOrder = await WardGalleryItem.max('orderIndex', { where: wardId ? { wardId } : {} });
    finalOrder = Number.isFinite(maxOrder) ? maxOrder + 1 : 0;
  }

  const storedMedia = persistDataUrl(mediaUrl, `work-${String(wardId).slice(0, 8)}`);
  const storedVideo = persistVideoUrl(videoUrl, `vid-${String(wardId).slice(0, 8)}`);

  const ownerId = req.user.roleName === 'NAGARSEVAK'
    ? req.user.id
    : (req.body.nagarsevakUserId || null);

  const item = await WardGalleryItem.create({
    wardId,
    nagarsevakUserId: ownerId,
    title: String(title).trim(),
    titleMr: titleMr ? String(titleMr).trim() : null,
    category: String(category).toUpperCase(),
    categoryLabel: categoryLabel || null,
    categoryLabelMr: categoryLabelMr || null,
    mediaType: mediaType === 'video' ? 'video' : 'image',
    mediaUrl: storedMedia || (mediaType === 'video' ? '/gallery/road-construction.svg' : ''),
    videoUrl: storedVideo || null,
    duration: duration || null,
    date: date || new Date().toISOString().split('T')[0],
    dateFormatted: dateFormatted || null,
    dateFormattedMr: dateFormattedMr || null,
    location: location || null,
    badge: badge || null,
    description: description || null,
    descriptionMr: descriptionMr || null,
    status: status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
    orderIndex: finalOrder,
    showOnDashboard: asDashboardFlag(showOnDashboard),
  });

  if (asDashboardFlag(showOnDashboard)) {
    await portalLayout.addHomeWork(wardId, item.id);
  }

  return success(res, {
    message: 'Development work / gallery item created successfully.',
    data: item,
  });
});

/**
 * PATCH /api/v2/gallery-items/:id
 * Edit an existing gallery work item
 */
const updateGalleryItem = asyncHandler(async (req, res) => {
  if (!canManage(req)) {
    throw new ApiError(403, 'Permission denied.');
  }

  const item = await WardGalleryItem.findByPk(req.params.id);
  if (!item) {
    throw new ApiError(404, 'Gallery item not found');
  }

  if (req.user.roleName === 'NAGARSEVAK' && item.wardId !== req.user.wardId) {
    throw new ApiError(403, 'You can only edit gallery items in your assigned ward.');
  }
  if (['SUPER_ADMIN', 'SUB_MASTER_ADMIN'].includes(req.user.roleName) && item.wardId && !isWardAllowed(req, item.wardId)) {
    throw new ApiError(403, 'You do not have access to this ward portal.');
  }

  const updatable = [
    'title',
    'titleMr',
    'category',
    'categoryLabel',
    'categoryLabelMr',
    'mediaType',
    'mediaUrl',
    'videoUrl',
    'duration',
    'date',
    'dateFormatted',
    'dateFormattedMr',
    'location',
    'badge',
    'description',
    'descriptionMr',
    'status',
    'orderIndex',
    'showOnDashboard',
    'nagarsevakUserId',
  ];

  const patch = {};
  for (const f of updatable) {
    if (Object.prototype.hasOwnProperty.call(req.body, f)) {
      patch[f] = req.body[f];
    }
  }
  persistImageFields(patch, ['mediaUrl'], `work-${String(item.id).slice(0, 8)}`);
  if (typeof patch.videoUrl === 'string') {
    patch.videoUrl = persistVideoUrl(patch.videoUrl, `vid-${String(item.id).slice(0, 8)}`);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'mediaUrl')) retireIfReplaced(item.mediaUrl, patch.mediaUrl);
  if (Object.prototype.hasOwnProperty.call(patch, 'videoUrl')) retireIfReplaced(item.videoUrl, patch.videoUrl);
  if (Object.prototype.hasOwnProperty.call(patch, 'showOnDashboard')) {
    patch.showOnDashboard = asDashboardFlag(patch.showOnDashboard);
  }

  await item.update(patch);
  if (Object.prototype.hasOwnProperty.call(patch, 'showOnDashboard')) {
    if (patch.showOnDashboard) await portalLayout.addHomeWork(item.wardId, item.id);
    else await portalLayout.removeHomeWork(item.wardId, item.id);
  }
  const json = item.toJSON();
  json.showOnDashboard = asDashboardFlag(json.showOnDashboard);

  return success(res, {
    message: 'Gallery item updated successfully.',
    data: json,
  });
});

/**
 * DELETE /api/v2/gallery-items/:id
 * Remove a gallery work item
 */
const deleteGalleryItem = asyncHandler(async (req, res) => {
  if (!canManage(req)) {
    throw new ApiError(403, 'Permission denied.');
  }

  const item = await WardGalleryItem.findByPk(req.params.id);
  if (!item) {
    throw new ApiError(404, 'Gallery item not found');
  }

  if (req.user.roleName === 'NAGARSEVAK' && item.wardId !== req.user.wardId) {
    throw new ApiError(403, 'You can only delete gallery items in your assigned ward.');
  }
  if (['SUPER_ADMIN', 'SUB_MASTER_ADMIN'].includes(req.user.roleName) && item.wardId && !isWardAllowed(req, item.wardId)) {
    throw new ApiError(403, 'You do not have access to this ward portal.');
  }

  await portalLayout.removeHomeWork(item.wardId, item.id);
  retirePortalUrl(item.mediaUrl);
  retirePortalUrl(item.videoUrl);
  await item.destroy();

  return success(res, {
    message: 'Gallery item deleted successfully.',
  });
});

/**
 * POST /api/v2/gallery-items/reorder
 * Reorder gallery items
 */
const reorderGalleryItems = asyncHandler(async (req, res) => {
  if (!canManage(req)) {
    throw new ApiError(403, 'Permission denied.');
  }

  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    throw new ApiError(400, 'Send the new card order to save.');
  }
  const wardId = await resolveWardId(req, { forWrite: true });
  for (const entry of items) {
    if (!entry?.id || !Number.isFinite(Number(entry.orderIndex))) continue;
    const where = { id: entry.id };
    if (req.user.roleName === 'NAGARSEVAK') where.wardId = req.user.wardId;
    else if (wardId) where.wardId = wardId;
    await WardGalleryItem.update(
      { orderIndex: Number(entry.orderIndex) },
      { where }
    );
  }

  return success(res, {
    message: 'Items reordered successfully.',
  });
});

const uploadPortalMedia = asyncHandler(async (req, res) => {
  if (!canManage(req)) {
    throw new ApiError(403, 'Permission denied.');
  }
  const file = req.file;
  if (!file || !file.buffer || !file.buffer.length) {
    throw new ApiError(400, 'Please choose a video or image file.');
  }
  const mime = String(file.mimetype || '').toLowerCase();
  const orig = String(file.originalname || '').toLowerCase();
  let ext = 'bin';
  if (mime.includes('webm') || orig.endsWith('.webm')) ext = 'webm';
  else if (mime.includes('ogg') || orig.endsWith('.ogg')) ext = 'ogg';
  else if (mime.includes('mp4') || mime.includes('quicktime') || orig.endsWith('.mp4') || orig.endsWith('.mov')) ext = 'mp4';
  else if (mime.includes('png') || orig.endsWith('.png')) ext = 'png';
  else if (mime.includes('webp') || orig.endsWith('.webp')) ext = 'webp';
  else if (mime.includes('jpeg') || mime.includes('jpg') || orig.endsWith('.jpg') || orig.endsWith('.jpeg')) ext = 'jpg';
  else if (mime.startsWith('video/')) ext = 'mp4';
  else if (mime.startsWith('image/')) ext = 'jpg';
  else {
    throw new ApiError(400, 'Only MP4/WebM video or image files are allowed.');
  }
  let url;
  try {
    url = writePortalFile(file.buffer, ext, mime.startsWith('video/') ? 'vid' : 'img');
  } catch (err) {
    console.error('[PORTAL MEDIA UPLOAD]', err.message);
    throw new ApiError(500, 'Could not save the uploaded file.');
  }
  return success(res, {
    message: 'File uploaded.',
    data: { url, mime: file.mimetype, size: file.size, name: path.basename(url) },
  });
});

module.exports = {
  getPortalConfig,
  updatePortalConfig,
  listGalleryItems,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  reorderGalleryItems,
  uploadPortalMedia,
};
