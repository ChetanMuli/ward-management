'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Ward, User } = require('../models');
const ApiError = require('../utils/ApiError');

const INVITE_TYP = 'ward_reg';
const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LEN = 6;

function inviteSecret() {
  return process.env.JWT_SECRET;
}

function publicWard(ward) {
  if (!ward) return null;
  return {
    id: ward.id,
    wardNumber: ward.wardNumber,
    name: ward.name,
    status: ward.status,
    registrationOpen: !!ward.registrationOpen,
  };
}

function randomInviteCode() {
  let out = '';
  const bytes = crypto.randomBytes(CODE_LEN);
  for (let i = 0; i < CODE_LEN; i += 1) out += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return out;
}

function isJwtInvite(token) {
  const raw = String(token || '').trim();
  return raw.split('.').length === 3 && raw.length > 40;
}

async function issueInviteCode(ward, { rotate = false } = {}) {
  const existing = String(ward.registrationInviteCode || '').trim().toUpperCase();
  if (existing && !rotate) return existing;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomInviteCode();
    try {
      await ward.update({ registrationInviteCode: code });
      return code;
    } catch (err) {
      if (err?.name !== 'SequelizeUniqueConstraintError') throw err;
    }
  }
  throw new ApiError(500, 'Unable to create a registration link. Try again.');
}

async function getPublicOpenWards() {
  const [rows] = await Ward.sequelize.query(
    `SELECT id, ward_number AS wardNumber, name, status, registration_open AS registrationOpen
     FROM wards
     WHERE registration_open = 1 AND status = 'ACTIVE' AND deleted_at IS NULL
     ORDER BY ward_number ASC`
  );
  return (rows || []).map((row) => ({
    id: String(row.id),
    wardNumber: row.wardNumber,
    name: row.name,
    status: row.status,
    registrationOpen: true,
  }));
}

async function getPublicOpenWard() {
  const open = await getPublicOpenWards();
  return open[0] || null;
}

async function setWardRegistrationOpen(wardId, open, actor) {
  const ward = await Ward.findByPk(wardId);
  if (!ward) throw new ApiError(404, 'Ward not found');
  if (open && String(ward.status).toUpperCase() !== 'ACTIVE') {
    throw new ApiError(400, 'Activate this ward first, then open it for public signup.');
  }
  const sequelize = Ward.sequelize;
  await sequelize.query(
    'UPDATE wards SET registration_open = :flag WHERE id = :id AND deleted_at IS NULL',
    { replacements: { flag: open ? 1 : 0, id: ward.id } }
  );
  void actor;
  return ward.reload();
}

async function setPublicOpenWard(wardId, actor) {
  const id = wardId !== null && wardId !== undefined && String(wardId).trim() !== '' && wardId !== false
    ? wardId
    : null;
  if (!id) return null;
  return setWardRegistrationOpen(id, true, actor);
}

async function clearOpenIfDeactivated(ward) {
  if (!ward) return;
  if (String(ward.status).toUpperCase() !== 'ACTIVE' && ward.registrationOpen) {
    await ward.update({ registrationOpen: false });
  }
}

function verifyInviteToken(token) {
  const raw = String(token || '').trim();
  if (!raw) throw new ApiError(400, 'Registration link is missing.');
  if (!isJwtInvite(raw)) return { typ: INVITE_TYP, code: raw.toUpperCase() };
  let payload;
  try {
    payload = jwt.verify(raw, inviteSecret());
  } catch (_) {
    throw new ApiError(400, 'This registration link is invalid or has expired. Ask your ward staff for a new link.');
  }
  if (payload.typ !== INVITE_TYP || !payload.wardId) {
    throw new ApiError(400, 'This registration link is not valid.');
  }
  return payload;
}

async function createStaffInvite(user, requestedWardId, { rotate = false } = {}) {
  const role = String(user?.roleName || '');
  const adminDesk = ['SUPER_ADMIN', 'SUB_MASTER_ADMIN'].includes(role);
  const staffDesk = ['NAGARSEVAK', 'EMPLOYEE'].includes(role);
  if (!adminDesk && !staffDesk) {
    throw new ApiError(403, 'You cannot share a ward registration link.');
  }

  let wardId;
  if (staffDesk) {
    wardId = user.wardId;
    if (!wardId) throw new ApiError(400, 'Your account is not assigned to a ward.');
  } else {
    wardId = String(requestedWardId || '').trim();
    if (!wardId) throw new ApiError(400, 'Select a ward to create the registration link.');
    if (role === 'SUB_MASTER_ADMIN') {
      const allowed = Array.isArray(user.wardIds) ? user.wardIds.map(String) : [];
      if (!allowed.includes(String(wardId))) {
        throw new ApiError(403, 'You do not have access to this ward.');
      }
    }
  }

  const ward = await Ward.findByPk(wardId, {
    attributes: ['id', 'wardNumber', 'name', 'status', 'registrationOpen', 'registrationInviteCode'],
  });
  if (!ward) throw new ApiError(404, 'Ward not found');
  if (String(ward.status).toUpperCase() !== 'ACTIVE') {
    throw new ApiError(400, 'This ward is not active. Activate it before sharing a registration link.');
  }
  const token = await issueInviteCode(ward, { rotate });
  return {
    token,
    path: `/r/${token}`,
    ward: publicWard(ward),
    invitedBy: { id: user.id, name: user.name, role },
    expiresInDays: 30,
  };
}

async function resolveSignupWard({ inviteToken, requestedWardId }) {
  const invite = String(inviteToken || '').trim();
  if (invite) {
    const payload = verifyInviteToken(invite);
    let ward = null;
    if (payload.wardId) {
      ward = await Ward.findOne({
        where: { id: payload.wardId, status: 'ACTIVE' },
        attributes: ['id', 'wardNumber', 'name', 'status', 'registrationOpen'],
      });
    } else if (payload.code) {
      ward = await Ward.findOne({
        where: { registrationInviteCode: payload.code, status: 'ACTIVE' },
        attributes: ['id', 'wardNumber', 'name', 'status', 'registrationOpen'],
      });
    }
    if (!ward) throw new ApiError(400, 'This registration link is invalid or has expired. Ask your ward staff for a new link.');
    if (requestedWardId && String(requestedWardId) !== String(ward.id)) {
      throw new ApiError(400, 'This form is locked to the ward on your registration link.');
    }
    const inviter = payload.by
      ? await User.findByPk(payload.by, { attributes: ['id', 'name'] })
      : null;
    return {
      ward,
      source: 'invite',
      invitedBy: inviter ? { id: inviter.id, name: inviter.name, role: payload.role || null } : null,
    };
  }

  const openWards = await getPublicOpenWards();
  if (!openWards.length) {
    throw new ApiError(400, 'Public registration is closed. Use the registration link from your ward Nagarsevak or employee.');
  }
  if (requestedWardId) {
    const picked = openWards.find((w) => String(w.id) === String(requestedWardId));
    if (!picked) {
      throw new ApiError(400, 'Select a ward that is currently open for registration.');
    }
    return { ward: picked, source: 'open', invitedBy: null };
  }
  if (openWards.length === 1) {
    return { ward: openWards[0], source: 'open', invitedBy: null };
  }
  throw new ApiError(400, 'Select your ward from the list.');
}

async function listRegistrationOptions(inviteToken) {
  const invite = String(inviteToken || '').trim();
  if (invite) {
    const resolved = await resolveSignupWard({ inviteToken: invite });
    return {
      wards: [publicWard(resolved.ward)],
      source: 'invite',
      invitedBy: resolved.invitedBy,
      locked: true,
    };
  }
  const openWards = await getPublicOpenWards();
  return {
    wards: openWards.map(publicWard),
    source: openWards.length ? 'open' : 'closed',
    invitedBy: null,
    locked: openWards.length <= 1,
  };
}

module.exports = {
  publicWard,
  getPublicOpenWard,
  getPublicOpenWards,
  setPublicOpenWard,
  setWardRegistrationOpen,
  clearOpenIfDeactivated,
  createStaffInvite,
  resolveSignupWard,
  listRegistrationOptions,
};
