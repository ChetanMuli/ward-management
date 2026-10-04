const ApiError = require('./ApiError');

function sanitisePhoto(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const photo = String(value);
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(photo)) {
    throw new ApiError(400, 'Photo must be a JPEG, PNG or WebP image');
  }
  if (photo.length > 1600000) throw new ApiError(400, 'Photo is too large. Crop it closer and try again.');
  return photo;
}

async function nagarsevakPublicByIds(ids) {
  const unique = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const { NagarsevakUser } = require('../models/roleLogins.model');
  const photoCol = [
    NagarsevakUser.sequelize.literal("CASE WHEN `photo` LIKE 'data:%' THEN NULL ELSE `photo` END"),
    'photo',
  ];
  const fullAttrs = [
    'id', 'name', 'mobile', 'partyName', 'wardSeat',
    'officialAddress', 'bio', 'officeTimings', 'whatsapp',
    'achievements', 'socialLinks',
    photoCol,
  ];
  const safeAttrs = ['id', 'name', 'mobile', 'partyName', 'wardSeat', 'officialAddress', photoCol];
  let rows;
  try {
    rows = await NagarsevakUser.findAll({ where: { id: unique }, attributes: fullAttrs });
  } catch (err) {
    if (!/Unknown column/i.test(String(err.message || ''))) throw err;
    rows = await NagarsevakUser.findAll({ where: { id: unique }, attributes: safeAttrs });
  }
  return new Map(rows.map((row) => {
    let achievements = row.achievements;
    if (typeof achievements === 'string' && achievements.trim()) {
      try { achievements = JSON.parse(achievements); } catch (_) { achievements = []; }
    }
    let socialLinks = row.socialLinks;
    if (typeof socialLinks === 'string' && socialLinks.trim()) {
      try { socialLinks = JSON.parse(socialLinks); } catch (_) { socialLinks = {}; }
    }
    return [String(row.id), {
      id: row.id,
      name: row.name,
      mobile: row.mobile || null,
      partyName: row.partyName || null,
      wardSeat: row.wardSeat || null,
      photo: row.photo && String(row.photo).startsWith('data:') ? null : (row.photo || null),
      officialAddress: row.officialAddress || null,
      bio: row.bio || null,
      officeTimings: row.officeTimings || null,
      whatsapp: row.whatsapp || null,
      gallery: null,
      achievements: Array.isArray(achievements) ? achievements : null,
      socialLinks: socialLinks && typeof socialLinks === 'object' ? socialLinks : null,
    }];
  }));
}

async function decorateNagarsevakPhotos(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return list;
  const extras = await nagarsevakPublicByIds(list.map((n) => n?.id));
  return list.map((n) => {
    if (!n) return n;
    const extra = extras.get(String(n.id));
    if (!extra) return n;
    return {
      ...n,
      partyName: extra.partyName || n.partyName || null,
      wardSeat: extra.wardSeat || n.wardSeat || null,
      photo: extra.photo || n.photo || null,
      officialAddress: extra.officialAddress || n.officialAddress || null,
      bio: extra.bio || n.bio || null,
      officeTimings: extra.officeTimings || n.officeTimings || null,
      whatsapp: extra.whatsapp || n.whatsapp || null,
      gallery: extra.gallery || n.gallery || null,
      achievements: extra.achievements || n.achievements || null,
      socialLinks: extra.socialLinks || n.socialLinks || null,
    };
  });
}

module.exports = { sanitisePhoto, nagarsevakPublicByIds, decorateNagarsevakPhotos };
