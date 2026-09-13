const { Op } = require('sequelize');
const { WardUpdate, Ward, User, Role, Person, Family, House, Area } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { allowedWardIds, isWardAllowed } = require('../services/wardScope');

const UPDATE_ROLES = new Set(['SUPER_ADMIN', 'SUB_MASTER_ADMIN', 'NAGARSEVAK', 'EMPLOYEE']);
const STAFF_AUDIENCES = new Set(['NAGARSEVAK', 'EMPLOYEE', 'ALL_STAFF']);

function assertUpdateRole(req) {
  if (!UPDATE_ROLES.has(req.user.roleName)) {
    throw new ApiError(403, 'You do not have permission to manage ward updates');
  }
}

function normaliseAudience(value) {
  const v = String(value || 'CITIZEN').trim().toUpperCase();
  return ['CITIZEN', 'NAGARSEVAK', 'EMPLOYEE', 'ALL_STAFF'].includes(v) ? v : null;
}

async function citizenRecipients(wardId) {
  const citizenRole = await Role.findOne({ where: { name: 'CITIZEN' } });
  if (!citizenRole) return [];
  return User.findAll({
    where: { status: 'ACTIVE', roleId: citizenRole.id, wardId },
    attributes: ['id', 'name', 'email', 'mobile', 'wardId']
  });
}

async function staffRecipients(wardId, audience) {
  const roleNames = audience === 'ALL_STAFF' ? ['NAGARSEVAK', 'EMPLOYEE'] : [audience];
  const roles = await Role.findAll({ where: { name: { [Op.in]: roleNames } } });
  if (!roles.length) return [];
  return User.findAll({
    where: {
      status: 'ACTIVE',
      roleId: { [Op.in]: roles.map(r => r.id) },
      wardId
    },
    attributes: ['id', 'name', 'email', 'mobile', 'wardId']
  });
}

async function recipientsFor(wardId, audience) {
  return audience === 'CITIZEN' ? citizenRecipients(wardId) : staffRecipients(wardId, audience);
}

const list = asyncHandler(async (req, res) => {
  const roleName = req.user.roleName;
  const isCitizen = roleName === 'CITIZEN';

  if (!UPDATE_ROLES.has(roleName) && !isCitizen) {
    throw new ApiError(403, 'You do not have permission to view ward updates');
  }

  const requestedWardId = String(req.query.wardId || '').trim();
  const where = {};

  if (isCitizen) {
    const ownWardId = String(req.user.wardId || '').trim();
    if (!ownWardId) throw new ApiError(403, 'Your account is not assigned to a ward');
    if (requestedWardId && requestedWardId !== ownWardId) {
      throw new ApiError(403, 'You can view updates only for your assigned ward');
    }
    where.wardId = ownWardId;
    where.audience = 'CITIZEN';
    where.status = 'PUBLISHED';
  } else {
    const allowed = allowedWardIds(req);
    if (requestedWardId && !isWardAllowed(req, requestedWardId)) {
      throw new ApiError(403, 'Cross-ward access denied');
    }
    const ids = requestedWardId ? [requestedWardId] : allowed;
    if (ids !== null) {
      where.wardId = { [Op.in]: ids.length ? ids : ['00000000-0000-0000-0000-000000000000'] };
    }

    const type = String(req.query.type || '').trim().toUpperCase();
    if (['WARD_UPDATE', 'EVENT'].includes(type)) where.type = type;

    const status = String(req.query.status || 'PUBLISHED').trim().toUpperCase();
    if (['PUBLISHED', 'ARCHIVED'].includes(status)) where.status = status;
  }

  const type = String(req.query.type || '').trim().toUpperCase();
  if (!isCitizen && ['WARD_UPDATE', 'EVENT'].includes(type)) where.type = type;

  const search = String(req.query.search || '').trim();
  if (search) {
    where[Op.or] = [
      { title: { [Op.like]: `%${search}%` } },
      { message: { [Op.like]: `%${search}%` } },
      { location: { [Op.like]: `%${search}%` } }
    ];
  }

  const pageRaw = Number.parseInt(req.query.page, 10);
  const limitRaw = Number.parseInt(req.query.limit, 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25;

  const result = await WardUpdate.findAndCountAll({
    where,
    include: [
      { model: Ward, as: 'ward', attributes: ['id', 'wardNumber', 'name'] },
      { model: User, as: 'createdBy', attributes: ['id', 'name', 'wardId'] }
    ],
    order: [['publishedAt', 'DESC'], ['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    distinct: true
  });

  return success(res, {
    data: result.rows,
    meta: { total: result.count, page, limit, pages: Math.max(1, Math.ceil(result.count / limit)) }
  });
});

const create = asyncHandler(async (req, res) => {
  assertUpdateRole(req);

  const type = String(req.body.type || 'WARD_UPDATE').trim().toUpperCase();
  if (!['WARD_UPDATE', 'EVENT'].includes(type)) throw new ApiError(400, 'Choose a valid update type');

  const title = String(req.body.title || '').trim();
  const message = String(req.body.message || '').trim();
  if (!title) throw new ApiError(400, 'Title is required');
  if (!message) throw new ApiError(400, 'Update message is required');

  const wardId = String(req.body.wardId || '').trim();
  if (!wardId || !isWardAllowed(req, wardId)) throw new ApiError(403, 'Choose an accessible ward');

  const ward = await Ward.findByPk(wardId, { attributes: ['id', 'wardNumber', 'name'] });
  if (!ward) throw new ApiError(404, 'Ward not found');

  const audience = normaliseAudience(req.body.audience);
  if (!audience) throw new ApiError(400, 'Choose a valid audience');

  if (['NAGARSEVAK', 'EMPLOYEE'].includes(req.user.roleName) && audience !== 'CITIZEN') {
    throw new ApiError(403, 'Nagarsevak and Employee can publish updates only to ward citizens');
  }

  const eventDate = req.body.eventDate ? new Date(req.body.eventDate) : null;
  if (eventDate && Number.isNaN(eventDate.getTime())) throw new ApiError(400, 'Invalid event date');

  const recipients = await recipientsFor(wardId, audience);
  const update = await WardUpdate.create({
    wardId, type, title, message, eventDate,
    location: String(req.body.location || '').trim() || null,
    audience, status: 'PUBLISHED',
    publishedAt: new Date(), createdByUserId: req.user.id
  });

  if (recipients.length) {
    await NotificationBulkCreate(recipients, update, req.user.id);
  }
  const { notifyMastersAndWardStaff } = require('../../services/notify.service');
  await notifyMastersAndWardStaff(wardId, {
    senderUserId: req.user.id,
    type: update.type === 'EVENT' ? 'WARD_EVENT' : 'WARD_UPDATE',
    title: update.title,
    message: update.message,
    actionUrl: `/ward-updates?open=${update.id}`,
  });

  return success(res, {
    statusCode: 201,
    message: recipients.length
      ? `${type === 'EVENT' ? 'Event' : 'Ward update'} published and notification sent to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}`
      : `${type === 'EVENT' ? 'Event' : 'Ward update'} published. No active recipients were found for this audience.`,
    data: { update, recipientCount: recipients.length }
  });
});

async function NotificationBulkCreate(recipients, update, senderUserId) {
  const ids = recipients
    .filter(u => u.id !== senderUserId)
    .map(u => u.id);
  if (!ids.length) return;
  const { notifyUsers } = require('../../services/notify.service');
  await notifyUsers(ids, {
    senderUserId,
    type: update.type === 'EVENT' ? 'WARD_EVENT' : 'WARD_UPDATE',
    title: update.title,
    message: update.message,
    actionUrl: `/ward-updates?open=${update.id}`,
  });
}

const archive = asyncHandler(async (req, res) => {
  assertUpdateRole(req);
  const update = await WardUpdate.findByPk(req.params.id);
  if (!update) throw new ApiError(404, 'Ward update not found');
  if (!isWardAllowed(req, update.wardId)) throw new ApiError(403, 'Cross-ward access denied');
  await update.update({ status: 'ARCHIVED' });
  return success(res, { message: 'Ward update archived', data: update });
});

module.exports = { list, create, archive };
