'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(process.env.PORTAL_UPLOAD_DIR || path.join(__dirname, '../../uploads/portal'));
try { fs.mkdirSync(ROOT, { recursive: true }); } catch (_) {}

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
  if (!buf.length || buf.length > 4 * 1024 * 1024) return str;
  const ext = /png/i.test(m[1]) ? 'png' : /webp/i.test(m[1]) ? 'webp' : 'jpg';
  const name = `${String(prefix || 'img').replace(/[^a-z0-9_-]/gi, '').slice(0, 40)}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  try {
    fs.writeFileSync(path.join(ROOT, name), buf);
  } catch (_) {
    return str;
  }
  return `/uploads/portal/${name}`;
}

function persistImageFields(obj, keys, prefix) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    if (typeof obj[key] === 'string' && obj[key].startsWith('data:image/')) {
      obj[key] = persistDataUrl(obj[key], prefix || key);
    }
  }
  return obj;
}

function publicImageUrl(value, fallback = '') {
  if (value == null) return fallback;
  const str = String(value).trim();
  if (!str || str.startsWith('data:')) return fallback;
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

module.exports = { persistDataUrl, persistImageFields, publicImageUrl, persistInBackground, ROOT };
