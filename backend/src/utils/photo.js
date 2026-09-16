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

module.exports = { sanitisePhoto };
