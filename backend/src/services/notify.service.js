const crypto = require('crypto');
const { Op } = require('sequelize');
const { Notification, User, Role } = require('../models');
const outbound = require('./outbound.service');

function queueOutbound(userIds, payload) {
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))]
    .filter((id) => id !== String(payload?.senderUserId || ''));
  if (!ids.length || payload?.outbound === false) return;
  if (!outbound.isConfigured()) return;
  setImmediate(() => {
    deliverOutbound(ids, payload).catch((err) => {
      console.error('[OUTBOUND QUEUE FAILURE]', err.message);
    });
  });
}

async function deliverOutbound(userIds, payload) {
  const users = await User.findAll({
    where: { id: { [Op.in]: userIds } },
    attributes: ['id', 'name', 'email', 'mobile'],
  });
  for (const user of users) {
    try {
      await outbound.deliverNotice({
        email: user.email,
        mobile: user.mobile,
        title: payload.title,
        message: payload.message,
      });
    } catch (err) {
      console.error('[OUTBOUND USER FAILURE]', { userId: user.id, error: err.message });
    }
  }
}

async function notifyUser({ userId, type, title, message, senderUserId = null, actionUrl = null, channel = 'IN_APP' }) {
  if (!userId) return null;
  if (senderUserId && String(userId) === String(senderUserId)) return null;
  try {
    const row = await Notification.create({
      userId,
      senderUserId,
      type,
      channel,
      title,
      message,
      isRead: false,
      sentAt: new Date(),
      actionUrl,
    });
    queueOutbound([userId], { title, message, senderUserId });
    return row;
  } catch (err) {
    console.error('[NOTIFY FAILURE]', { userId, type, error: err.message });
    return null;
  }
}

async function notifyUsers(userIds, payload) {
  const sender = String(payload?.senderUserId || '');
  const ids = [...new Set((userIds || []).filter(Boolean).map(String))]
    .filter((id) => !sender || id !== sender);
  if (!ids.length) return 0;
  const rows = ids.map((userId) => ({
    id: crypto.randomUUID(),
    userId,
    senderUserId: payload.senderUserId || null,
    type: payload.type,
    channel: payload.channel || 'IN_APP',
    title: payload.title,
    message: payload.message,
    isRead: false,
    sentAt: new Date(),
    actionUrl: payload.actionUrl || null,
  }));
  try {
    for (let i = 0; i < rows.length; i += 200) {
      await Notification.bulkCreate(rows.slice(i, i + 200), { ignoreDuplicates: true });
    }
    queueOutbound(ids, payload);
    return rows.length;
  } catch (err) {
    console.error('[NOTIFY BULK FAILURE]', { count: ids.length, type: payload.type, error: err.message });
    return 0;
  }
}

async function idsForRoles(roleNames, extraWhere = {}) {
  const names = Array.isArray(roleNames) ? roleNames : [roleNames];
  const roles = await Role.findAll({ where: { name: { [Op.in]: names } }, attributes: ['id'] });
  if (!roles.length) return [];
  const users = await User.findAll({
    where: { status: 'ACTIVE', roleId: { [Op.in]: roles.map((r) => r.id) }, ...extraWhere },
    attributes: ['id'],
  });
  return users.map((u) => u.id);
}

async function notifyMastersAndWardStaff(wardId, payload) {
  const masterIds = await idsForRoles(['SUPER_ADMIN']);
  const staffIds = wardId ? await idsForRoles(['NAGARSEVAK', 'EMPLOYEE'], { wardId }) : [];
  const { SubAdminUser } = require('../models/roleLogins.model');
  const subs = await SubAdminUser.findAll({ where: { status: 'ACTIVE' }, attributes: ['id', 'wardIds'] });
  const subIds = subs
    .filter((u) => {
      const ids = Array.isArray(u.wardIds) ? u.wardIds.map(String) : [];
      return wardId ? ids.includes(String(wardId)) : ids.length > 0;
    })
    .map((u) => u.id);
  return notifyUsers([...masterIds, ...staffIds, ...subIds], payload);
}

async function notifyWardCitizens(wardId, payload) {
  if (!wardId) return 0;
  const ids = await idsForRoles(['CITIZEN'], { wardId });
  return notifyUsers(ids, payload);
}

module.exports = { notifyUser, notifyUsers, notifyMastersAndWardStaff, notifyWardCitizens, idsForRoles };
