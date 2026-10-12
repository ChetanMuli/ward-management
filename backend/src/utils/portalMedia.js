'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(process.env.PORTAL_UPLOAD_DIR || path.join(__dirname, '../../uploads/portal'));
try { fs.mkdirSync(ROOT, { recursive: true }); } catch (_) {}

function writePortalFile(buf, ext, prefix = 'file') {
  const name = `${String(prefix || 'file').replace(/[^a-z0-9_-]/gi, '').slice(0, 40)}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(path.join(ROOT, name), buf);
  return `/api/uploads/portal/${name}`;
}

function persistDataUrl(value, prefix = 'img') {
  if (value == null) return value;
  const str = String(value).trim();
  if (!str) return str;
  if (!str.startsWith('data:image/')) return str;
  const m = str.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!m) return str;
  let buf;
  try {
    buf = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
  } catch (_) {
    return str;
  }
  if (!buf.length || buf.length > 8 * 1024 * 1024) return str;
  const ext = /png/i.test(m[1]) ? 'png' : /webp/i.test(m[1]) ? 'webp' : 'jpg';
  try {
    return writePortalFile(buf, ext, prefix);
  } catch (err) {
    console.error('[PORTAL MEDIA WRITE]', ROOT, err.message);
    return str;
  }
}

function persistVideoUrl(value, prefix = 'vid') {
  if (value == null) return value;
  const str = String(value).trim();
  if (!str) return str;
  if (!str.startsWith('data:video/')) return publicImageUrl(str, str);
  const m = str.match(/^data:video\/(mp4|webm|ogg|quicktime);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!m) return str;
  let buf;
  try {
    buf = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
  } catch (_) {
    return str;
  }
  if (!buf.length || buf.length > 60 * 1024 * 1024) return str;
  const ext = /webm/i.test(m[1]) ? 'webm' : /ogg/i.test(m[1]) ? 'ogg' : 'mp4';
  try {
    return writePortalFile(buf, ext, prefix);
  } catch (err) {
    console.error('[PORTAL VIDEO WRITE]', ROOT, err.message);
    return str;
  }
}

function persistImageFields(obj, keys, prefix) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    if (typeof obj[key] === 'string' && obj[key].startsWith('data:image/')) {
      obj[key] = persistDataUrl(obj[key], prefix || key);
    }
    if (typeof obj[key] === 'string') {
      obj[key] = publicImageUrl(obj[key], obj[key]);
    }
  }
  return obj;
}

function publicImageUrl(value, fallback = '') {
  if (value == null) return fallback;
  const str = String(value).trim();
  if (!str || str.startsWith('data:')) return fallback;
  if (str.startsWith('/uploads/')) return `/api${str}`;
  if (str.startsWith('uploads/')) return `/api/${str}`;
  return str;
}

function persistInBackground(jobs) {
  if (!Array.isArray(jobs) || !jobs.length) return;
  setImmediate(() => {
    Promise.all(jobs.map(async (job) => {
      try {
        if (typeof job !== 'function') return;
        await job();
      } catch (_) {}
    })).catch(() => {});
  });
}

const RETIRE_MS = 8 * 24 * 60 * 60 * 1000;
const RETIRE_FILE = path.join(ROOT, '.retired.json');

function portalFileName(value) {
  const str = String(value || '').trim().split('?')[0];
  const m = str.match(/(?:\/api)?\/uploads\/portal\/([^/?#]+)$/i);
  if (!m) return '';
  const name = path.basename(decodeURIComponent(m[1]));
  if (!name || name.startsWith('.') || name.includes('..')) return '';
  return name;
}

function readRetiredMap() {
  try {
    const data = JSON.parse(fs.readFileSync(RETIRE_FILE, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeRetiredMap(map) {
  try {
    fs.writeFileSync(RETIRE_FILE, JSON.stringify(map));
  } catch (err) {
    console.error('[PORTAL MEDIA RETIRE WRITE]', err.message);
  }
}

function retirePortalUrl(url) {
  const name = portalFileName(url);
  if (!name) return;
  if (!fs.existsSync(path.join(ROOT, name))) return;
  const map = readRetiredMap();
  if (!map[name]) map[name] = Date.now();
  writeRetiredMap(map);
}

function unretirePortalUrl(url) {
  const name = portalFileName(url);
  if (!name) return;
  const map = readRetiredMap();
  if (!map[name]) return;
  delete map[name];
  writeRetiredMap(map);
}

function retireIfReplaced(oldUrl, newUrl) {
  const prev = portalFileName(oldUrl);
  const next = portalFileName(newUrl);
  if (prev && prev !== next) retirePortalUrl(oldUrl);
  if (next) unretirePortalUrl(newUrl);
}

function walkStrings(value, visit) {
  if (typeof value === 'string') visit(value);
  else if (Array.isArray(value)) value.forEach((item) => walkStrings(item, visit));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => walkStrings(item, visit));
}

async function collectLivePortalNames() {
  const names = new Set();
  const absorb = (value) => {
    const name = portalFileName(value);
    if (name) names.add(name);
  };
  try {
    const {
      WardPortalConfig,
      WardPortalBanner,
      WardGalleryItem,
      NagarsevakUser,
    } = require('../models');
    const configs = await WardPortalConfig.findAll({ attributes: ['heroBannerUrl', 'meta'] });
    for (const row of configs) {
      absorb(row.heroBannerUrl);
      walkStrings(row.meta, absorb);
    }
    const banners = await WardPortalBanner.findAll({
      attributes: ['homeBannerUrl', 'complaintsBannerUrl', 'galleryBannerUrl'],
    }).catch(() => []);
    for (const row of banners || []) {
      absorb(row.homeBannerUrl);
      absorb(row.complaintsBannerUrl);
      absorb(row.galleryBannerUrl);
    }
    const items = await WardGalleryItem.findAll({ attributes: ['mediaUrl', 'videoUrl'] });
    for (const row of items) {
      absorb(row.mediaUrl);
      absorb(row.videoUrl);
    }
    const nagars = await NagarsevakUser.findAll({ attributes: ['photo'] });
    for (const row of nagars) absorb(row.photo);
  } catch (err) {
    console.error('[PORTAL MEDIA LIVE SCAN]', err.message);
  }
  return names;
}

async function sweepPortalUploads({ maxAgeMs = RETIRE_MS } = {}) {
  const live = await collectLivePortalNames();
  const retired = readRetiredMap();
  const now = Date.now();
  let deleted = 0;
  let kept = 0;
  let files = [];
  try {
    files = fs.readdirSync(ROOT);
  } catch (err) {
    console.error('[PORTAL MEDIA SWEEP]', err.message);
    return { deleted: 0, kept: 0 };
  }
  const nextRetired = { ...retired };
  for (const name of files) {
    if (!name || name.startsWith('.')) continue;
    const full = path.join(ROOT, name);
    let st;
    try { st = fs.statSync(full); } catch { continue; }
    if (!st.isFile()) continue;
    if (live.has(name)) {
      delete nextRetired[name];
      kept += 1;
      continue;
    }
    const retiredAt = Number(retired[name] || 0);
    const age = retiredAt ? (now - retiredAt) : (now - Number(st.mtimeMs || 0));
    if (age >= maxAgeMs) {
      try {
        fs.unlinkSync(full);
        delete nextRetired[name];
        deleted += 1;
      } catch (err) {
        console.error('[PORTAL MEDIA DELETE]', name, err.message);
      }
    } else {
      kept += 1;
    }
  }
  Object.keys(nextRetired).forEach((name) => {
    if (!fs.existsSync(path.join(ROOT, name))) delete nextRetired[name];
  });
  writeRetiredMap(nextRetired);
  if (deleted) console.log(`[PORTAL MEDIA SWEEP] removed ${deleted} unused portal file(s) older than 8 days`);
  return { deleted, kept };
}

module.exports = {
  persistDataUrl,
  persistVideoUrl,
  persistImageFields,
  publicImageUrl,
  persistInBackground,
  writePortalFile,
  retirePortalUrl,
  retireIfReplaced,
  sweepPortalUploads,
  ROOT,
};
