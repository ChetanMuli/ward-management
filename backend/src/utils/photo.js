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
  const rows = await NagarsevakUser.findAll({
    where: { id: unique },
    attributes: ['id', 'name', 'mobile', 'photo', 'partyName', 'wardSeat'],
  });
  return new Map(rows.map((row) => [String(row.id), {
    id: row.id,
    name: row.name,
    mobile: row.mobile || null,
    partyName: row.partyName || null,
    wardSeat: row.wardSeat || null,
    photo: row.photo || null,
  }]));
}

async function decorateNagarsevakPhotos(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return list;
  const photos = await nagarsevakPublicByIds(list.map((n) => n?.id));
  return list.map((n) => {
    if (!n) return n;
    const extra = photos.get(String(n.id));
    return extra?.photo ? { ...n, photo: extra.photo } : n;
  });
}

module.exports = { sanitisePhoto, nagarsevakPublicByIds, decorateNagarsevakPhotos };
