const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const store = new Map();

function keyFor(identifier) {
  return String(identifier || '').trim().toLowerCase();
}

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

async function issue(identifier, meta = {}) {
  const key = keyFor(identifier);
  const otp = generateOtp();
  store.set(key, {
    hash: await bcrypt.hash(otp, 10),
    expires: Date.now() + TTL_MS,
    attempts: 0,
    userId: meta.userId || null,
    channel: meta.channel || 'email',
  });
  return otp;
}

async function consume(identifier, otp) {
  const key = keyFor(identifier);
  const rec = store.get(key);
  if (!rec) return { ok: false, reason: 'No verification code was found. Please request a new one.' };
  if (Date.now() > rec.expires) {
    store.delete(key);
    return { ok: false, reason: 'That code has expired. Please request a new one.' };
  }
  rec.attempts += 1;
  if (rec.attempts > MAX_ATTEMPTS) {
    store.delete(key);
    return { ok: false, reason: 'Too many incorrect attempts. Please request a new code.' };
  }
  if (!(await bcrypt.compare(String(otp || ''), rec.hash))) {
    return { ok: false, reason: 'Invalid verification code.' };
  }
  store.delete(key);
  return { ok: true, userId: rec.userId };
}

module.exports = { issue, consume, TTL_MS };
