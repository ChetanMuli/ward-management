const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { User, Ward, Role } = require('../../models');
const Chat = require('../../services/chat.store');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const { allowedWardIds, isWardAllowed } = require('../services/wardScope');
const { getVisibleNagarsevakIds, isNagarsevakVisibleInWard, syncWardCommunityMembership } = require('../../services/wardActivation.service');

const uploadDir = path.resolve(process.env.CHAT_UPLOAD_DIR || path.join(__dirname, '..', '..', '..', 'uploads', 'chat'));
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (_) {}
const RETENTION_DAYS = 40;

async function cleanupOldMessages() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let removed = 0;
  for (let batch = 0; batch < 20; batch += 1) {
    const old = await Chat.Message.findAll({
      where: { createdAt: { [Op.lt]: cutoff } },
      attributes: ['id', 'imagePath'],
      limit: 500,
    });
    if (!old.length) break;
    for (const row of old) {
      if (row.imagePath) {
        const file = path.join(uploadDir, path.basename(row.imagePath));
        try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) {}
      }
    }
    await Chat.Message.destroy({ where: { id: { [Op.in]: old.map((x) => x.id) } } });
    removed += old.length;
    if (old.length < 500) break;
  }
  if (removed) console.info(`[CHAT] removed ${removed} messages older than ${RETENTION_DAYS} days`);
  return removed;
}

// Opportunistic cleanup keeps both DB rows and uploaded images under control.
setInterval(() => cleanupOldMessages().catch(() => {}), 6 * 60 * 60 * 1000).unref();

async function ensureMembershipRow(groupId, userId) {
  let member = await Chat.Member.findOne({ where: { groupId, userId } });
  if (member) return member;
  try {
    return await Chat.Member.create({
      id: crypto.randomUUID(), groupId, userId, joinedAt: new Date()
    });
  } catch (error) {
    // A concurrent request or an old duplicate-safe insert may have created the
    // row between findOne() and create(). The membership operation is idempotent.
    if (error?.name !== 'SequelizeUniqueConstraintError') throw error;
    member = await Chat.Member.findOne({ where: { groupId, userId } });
    if (!member) throw error;
    return member;
  }
}


async function ensureWardGroup(wardId) {
  if (!wardId) return null;
  const ward = await Ward.findByPk(wardId);
  if (!ward || ward.status !== 'ACTIVE') return null;
  const name = `Ward ${ward.wardNumber}${ward.name ? ` · ${ward.name}` : ''} Community`;
  const [group] = await Chat.findOrCreate({
    where: { wardId, type: 'WARD' },
    defaults: { id: crypto.randomUUID(), wardId, name, type:'WARD', createdByUserId:null, isActive:true, mode:'CHAT' }
  });
  if (!group.isActive || group.name !== name) await group.update({ name, isActive:true, mode:'CHAT' });
  await reconcileWardGroupMembers(wardId);
  return group;
}

async function archiveWardGroups(wardId) {
  if (!wardId) return;
  await Chat.update({ isActive:false }, { where:{ wardId } });
}

async function nagarsevakRoleId() {
  const role = await Role.findOne({ where: { name: 'NAGARSEVAK' }, attributes: ['id'] });
  return role?.id || null;
}

function memberIdsForGroup(group, users, nagarRoleId, visibleNagarsevakIds) {
  const visible = new Set((visibleNagarsevakIds || []).map(String));
  if (group.type === 'NAGARSEVAK' && nagarRoleId) {
    const ownerVisible = visible.has(String(group.nagarsevakUserId));
    if (!ownerVisible) {
      return users.filter(u => String(u.id) === String(group.nagarsevakUserId)).map(u => u.id);
    }
    return users
      .filter(u => String(u.roleId) !== String(nagarRoleId) || String(u.id) === String(group.nagarsevakUserId))
      .map(u => u.id);
  }
  if (group.type === 'WARD' && nagarRoleId) {
    return users
      .filter(u => String(u.roleId) !== String(nagarRoleId) || visible.has(String(u.id)))
      .map(u => u.id);
  }
  return users.map(u => u.id);
}

async function visibleIdsByWard(wardIds) {
  const map = new Map();
  for (const wardId of [...new Set((wardIds || []).filter(Boolean))]) {
    map.set(String(wardId), await getVisibleNagarsevakIds(wardId));
  }
  return map;
}

async function syncGroupMembers(group, users, nagarRoleId, visibleNagarsevakIds) {
  const allowedUserIds = memberIdsForGroup(group, users, nagarRoleId, visibleNagarsevakIds);
  if (allowedUserIds.length) {
    await Chat.Member.destroy({
      where: { groupId: group.id, userId: { [Op.notIn]: allowedUserIds } }
    });
    for (const userId of allowedUserIds) await ensureMembershipRow(group.id, userId);
  } else {
    await Chat.Member.destroy({ where: { groupId: group.id } });
  }
}

async function ensureNagarsevakGroup(nagarsevakUserId, options = {}) {
  const user = await User.findByPk(nagarsevakUserId);
  if (!user || user.status !== 'ACTIVE' || !user.wardId) return null;
  const existing = await Chat.findOne({
    where: { nagarsevakUserId: user.id, type: 'NAGARSEVAK' }
  });
  const ward = options.wardId || user.wardId;
  const name = `Nagarsevak · ${user.name}`;
  const group = existing
    ? await existing.update({ wardId: ward, isActive: true, name, mode: 'CHAT' })
    : await Chat.create({
        wardId: ward,
        name,
        type: 'NAGARSEVAK',
        nagarsevakUserId: user.id,
        createdByUserId: null,
        isActive: true,
        mode: 'CHAT'
      });

  const [activeUsers, nagarRoleId, visibleIds] = await Promise.all([
    User.findAll({ where: { wardId: ward, status: 'ACTIVE' }, attributes: ['id', 'roleId'] }),
    nagarsevakRoleId(),
    getVisibleNagarsevakIds(ward)
  ]);
  await syncGroupMembers(group, activeUsers, nagarRoleId, visibleIds);
  await ensureMembershipRow(group.id, user.id);
  return group;
}

async function ensureAllNagarsevakGroups(wardId) {
  if (!wardId) return;
  const nagarRoleId = await nagarsevakRoleId();
  if (!nagarRoleId) return;
  const rows = await User.findAll({
    where: { wardId, roleId: nagarRoleId, status: 'ACTIVE' },
    attributes: ['id']
  });
  for (const row of rows) await ensureNagarsevakGroup(row.id, { wardId });
}

async function archiveNagarsevakGroup(nagarsevakUserId) {
  await Chat.update(
    { isActive: false },
    { where: { nagarsevakUserId, type: 'NAGARSEVAK' } }
  );
}

async function ensureMembership(groupId, userId, roleName = null) {
  const [group, user] = await Promise.all([
    Chat.findByPk(groupId),
    User.findByPk(userId),
  ]);
  if (!group || !user || user.status !== 'ACTIVE') throw new ApiError(404, 'Chat group or user not found');
  const reqLike = { user: { id: user.id, wardId: user.wardId, wardIds: user.wardIds, roleName } };
  if (group.wardId && !isWardAllowed(reqLike, group.wardId)) {
    throw new ApiError(403, 'This chat group is outside your ward');
  }
  if (roleName === 'CITIZEN' && group.wardId && String(group.wardId) !== String(user.wardId)) {
    throw new ApiError(403, 'You can only access chat groups in your registered ward');
  }
  if (group.type === 'NAGARSEVAK' && roleName === 'CITIZEN') {
    const visible = await isNagarsevakVisibleInWard(group.wardId, group.nagarsevakUserId);
    if (!visible) throw new ApiError(404, 'Chat group not found');
  }
  if (group.type === 'NAGARSEVAK' && roleName === 'NAGARSEVAK' && String(group.nagarsevakUserId) !== String(userId)) {
    throw new ApiError(403, 'You can access only your Nagarsevak group and the ward community.');
  }
  const member = await ensureMembershipRow(groupId, userId);
  return { group, member };
}

async function syncActiveWardMembers(groupRows) {
  const targetGroups = groupRows.filter(g => ['WARD','CUSTOM','NAGARSEVAK'].includes(g.type));
  const wardIds = [...new Set(targetGroups.map(g => g.wardId).filter(Boolean))];
  if (!wardIds.length) return;
  const [activeUsers, nagarRoleId, visibleMap] = await Promise.all([
    User.findAll({
      where: { wardId: { [Op.in]: wardIds }, status: 'ACTIVE' },
      attributes: ['id','wardId','roleId']
    }),
    nagarsevakRoleId(),
    visibleIdsByWard(wardIds)
  ]);
  const usersByWard = new Map();
  for (const u of activeUsers) {
    const key = String(u.wardId);
    if (!usersByWard.has(key)) usersByWard.set(key, []);
    usersByWard.get(key).push(u);
  }
  for (const group of targetGroups) {
    await syncGroupMembers(group, usersByWard.get(String(group.wardId)) || [], nagarRoleId, visibleMap.get(String(group.wardId)) || []);
  }
}

async function reconcileWardGroupMembers(wardId) {
  if (!wardId) return;
  const groups = await Chat.findAll({
    where: { wardId, isActive: true, type: { [Op.in]: ['WARD', 'CUSTOM', 'NAGARSEVAK'] } },
    attributes: ['id', 'type', 'nagarsevakUserId', 'wardId']
  });
  if (!groups.length) return;
  const [activeUsers, nagarRoleId, visibleIds] = await Promise.all([
    User.findAll({ where: { wardId, status: 'ACTIVE' }, attributes: ['id', 'roleId'] }),
    nagarsevakRoleId(),
    getVisibleNagarsevakIds(wardId)
  ]);
  for (const group of groups) await syncGroupMembers(group, activeUsers, nagarRoleId, visibleIds);
}

async function ensureUserGroups(user) {
  if (!user.wardId) return;
  if (user.roleName === 'CITIZEN') {
    await syncWardCommunityMembership(user.wardId);
    return;
  }
  const wardGroup = await Chat.findOne({ where: { wardId: user.wardId, type: 'WARD', isActive: true } });
  if (wardGroup) await ensureMembershipRow(wardGroup.id, user.id);
  if (user.roleName === 'NAGARSEVAK') await ensureNagarsevakGroup(user.id);
}

const listGroups = asyncHandler(async (req, res) => {
  await cleanupOldMessages();
  await ensureUserGroups(req.user);
  const allowedForGroups = allowedWardIds(req);
  const visibleWardIds = req.user.roleName === 'SUPER_ADMIN'
    ? (await Ward.findAll({ where:{ status:'ACTIVE' }, attributes:['id'] })).map(w=>w.id)
    : (allowedForGroups || []).filter(Boolean);
  if (req.user.roleName === 'NAGARSEVAK' || req.user.roleName === 'EMPLOYEE' || req.user.roleName === 'CITIZEN') {
    if (req.user.wardId) {
      await ensureWardGroup(req.user.wardId);
      await ensureAllNagarsevakGroups(req.user.wardId);
    }
  } else {
    for (const wardId of visibleWardIds) {
      await ensureWardGroup(wardId);
      await ensureAllNagarsevakGroups(wardId);
    }
  }
  const rows = await Chat.findAll({
    where: { isActive: true },
    include: [
      { model: Ward, as: 'ward', attributes: ['id', 'wardNumber', 'name'] },
      { model: User, as: 'nagarsevak', attributes: ['id', 'name', 'mobile', 'roleId'] },
      { model: User, as: 'createdBy', attributes: ['id', 'name'] },
    ],
    order: [['type', 'ASC'], ['name', 'ASC']],
  });
  const citizenVisible = req.user.roleName === 'CITIZEN' && req.user.wardId
    ? new Set((await getVisibleNagarsevakIds(req.user.wardId)).map(String))
    : null;
  const allowed = allowedForGroups;
  const visibleRows = rows.filter(g => {
    const inWard = req.user.roleName === 'SUPER_ADMIN' || String(g.wardId) === String(req.user.wardId || '') || (allowed && allowed.map(String).includes(String(g.wardId)));
    if (!inWard) return false;
    if (req.user.roleName === 'NAGARSEVAK') {
      return g.type === 'WARD' || (g.type === 'NAGARSEVAK' && String(g.nagarsevakUserId) === String(req.user.id));
    }
    if (req.user.roleName === 'CITIZEN') {
      if (String(g.wardId) !== String(req.user.wardId)) return false;
      if (g.type === 'WARD') return true;
      if (g.type === 'NAGARSEVAK') return citizenVisible.has(String(g.nagarsevakUserId));
      return g.type === 'CUSTOM';
    }
    return true;
  });
  await syncActiveWardMembers(visibleRows);
  const memberships = await Chat.Member.findAll({ where: { userId: req.user.id }, attributes: ['groupId'] });
  const ids = new Set(memberships.map(x => x.groupId));
  if (req.user.roleName === 'SUPER_ADMIN' || req.user.roleName === 'SUB_MASTER_ADMIN') {
    visibleRows.forEach((g) => ids.add(g.id));
  }
  const data = visibleRows.map(g => ({
      ...g.toJSON(),
      isMember: ids.has(g.id),
      canClear: true,
      canManage: req.user.roleName === 'SUPER_ADMIN' || (g.type === 'CUSTOM' && g.createdByUserId === req.user.id),
    }));
  return success(res, { data });
});

const createGroup = asyncHandler(async (req, res) => {
  if (!['SUPER_ADMIN', 'SUB_MASTER_ADMIN', 'NAGARSEVAK'].includes(req.user.roleName)) throw new ApiError(403, 'Only Admin or Nagarsevak can create groups');
  const name = String(req.body.name || '').trim();
  const mode = String(req.body.mode || 'CHAT').toUpperCase();
  if (!name) throw new ApiError(400, 'Group name is required');
  if (!['CHAT','BROADCAST'].includes(mode)) throw new ApiError(400, 'Invalid group mode');
  const wardId = String(req.body.wardId || req.user.wardId || '').trim();
  if (!wardId || !isWardAllowed(req, wardId)) throw new ApiError(403, 'You can create groups only in an accessible ward');
  const ward = await Ward.findByPk(wardId);
  if (!ward) throw new ApiError(404, 'Ward not found');

  const group = await Chat.create({
    wardId,
    name,
    mode,
    type: 'CUSTOM',
    createdByUserId: req.user.id,
    isActive: true,
  });

  // New community groups automatically include every active account in that ward.
  const activeUsers = await User.findAll({
    where: { wardId, status: 'ACTIVE' },
    attributes: ['id'],
  });
  const members = activeUsers.map(u => ({ id: crypto.randomUUID(), groupId: group.id, userId: u.id, joinedAt: new Date() }));
  if (!members.some(m => m.userId === req.user.id)) members.push({ id: crypto.randomUUID(), groupId: group.id, userId: req.user.id, joinedAt: new Date() });
  if (members.length) await Chat.Member.bulkCreate(members, { ignoreDuplicates: true });

  return success(res, { statusCode: 201, message: 'Group created and active ward users were added automatically.', data: { ...group.toJSON(), memberCount: members.length } });
});

const deleteGroup = asyncHandler(async (req, res) => {
  const group = await Chat.findByPk(req.params.id);
  if (!group || !group.isActive) throw new ApiError(404, 'Chat group not found');
  if (group.type !== 'CUSTOM') throw new ApiError(400, 'System groups cannot be deleted');
  if (req.user.roleName !== 'SUPER_ADMIN' && group.createdByUserId !== req.user.id) throw new ApiError(403, 'Only the group creator or Master Admin can delete this group');
  await group.update({ isActive: false });
  return success(res, { message: 'Group archived.' });
});

const listMessages = asyncHandler(async (req, res) => {
  await cleanupOldMessages();
  const { group, member } = await ensureMembership(req.params.id, req.user.id, req.user.roleName);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const before = req.query.before ? new Date(req.query.before) : null;
  const after = req.query.after ? new Date(req.query.after) : null;
  const where = { groupId: group.id };
  const effectiveAfter = [after, member.lastClearedAt].filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime()).pop() || null;
  if (before && !Number.isNaN(before.getTime()) && effectiveAfter && !Number.isNaN(effectiveAfter.getTime())) {
    where.createdAt = { [Op.gt]: effectiveAfter, [Op.lt]: before };
  } else if (before && !Number.isNaN(before.getTime())) {
    where.createdAt = { [Op.lt]: before };
  } else if (effectiveAfter && !Number.isNaN(effectiveAfter.getTime())) {
    where.createdAt = { [Op.gt]: effectiveAfter };
  }
  const rows = await Chat.Message.findAll({
    where,
    include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'mobile'] }],
    order: [['createdAt', 'DESC']],
    limit,
  });
  rows.reverse();
  return success(res, { data: rows });
});

const sendMessage = asyncHandler(async (req, res) => {
  await cleanupOldMessages();
  const { group } = await ensureMembership(req.params.id, req.user.id, req.user.roleName);
  if (req.user.roleName === 'CITIZEN' && group.type === 'NAGARSEVAK') {
    const visible = await isNagarsevakVisibleInWard(group.wardId, group.nagarsevakUserId);
    if (!visible) throw new ApiError(403, 'This Nagarsevak is not available for chat.');
  }
  if (group.mode === 'BROADCAST' && req.user.roleName !== 'SUPER_ADMIN' && group.createdByUserId !== req.user.id) {
    throw new ApiError(403, 'Only the group owner or Master Admin can send in a broadcast group');
  }
  const type = String(req.body.messageType || 'TEXT').toUpperCase();
  if (!['TEXT', 'IMAGE', 'PDF', 'VIDEO'].includes(type)) throw new ApiError(400, 'Invalid message type');
  const content = String(req.body.content || '').trim();
  if (type === 'TEXT' && !content) throw new ApiError(400, 'Message cannot be empty');
  let imagePath = null, imageMime = null;
  if (type === 'IMAGE' || type === 'PDF' || type === 'VIDEO') {
    const data = String(req.body.imageData || '');
    imageMime = String(req.body.imageMime || '').toLowerCase();
    const imageMatch = data.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
    const pdfMatch = data.match(/^data:application\/pdf;base64,(.+)$/i);
    const videoMatch = data.match(/^data:video\/(mp4|webm|quicktime);base64,(.+)$/i);
    if (type === 'IMAGE' && !imageMatch) throw new ApiError(400, 'Only JPG, PNG or WEBP images are allowed');
    if (type === 'PDF' && !pdfMatch) throw new ApiError(400, 'Only PDF files are allowed');
    if (type === 'VIDEO' && !videoMatch) throw new ApiError(400, 'Only MP4, WEBM or MOV videos are allowed');
    if (data.length > 17 * 1024 * 1024) throw new ApiError(413, 'Attachment is too large. Maximum 12 MB.');
    const ext = type === 'PDF'
      ? 'pdf'
      : type === 'VIDEO'
        ? (videoMatch[1].toLowerCase() === 'quicktime' ? 'mov' : videoMatch[1].toLowerCase())
        : (imageMatch[1].toLowerCase() === 'jpeg' ? 'jpg' : imageMatch[1].toLowerCase());
    const payload = type === 'PDF' ? pdfMatch[1] : type === 'VIDEO' ? videoMatch[2] : imageMatch[2];
    imagePath = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(uploadDir, imagePath), Buffer.from(payload, 'base64'));
    imageMime = type === 'PDF'
      ? 'application/pdf'
      : type === 'VIDEO'
        ? (imageMime || `video/${ext === 'mov' ? 'quicktime' : ext}`)
        : (imageMime || `image/${ext === 'jpg' ? 'jpeg' : ext}`);
  }
  const row = await Chat.Message.create({
    groupId: group.id,
    senderUserId: req.user.id,
    recipientUserId: null,
    messageType: type,
    content: content || null,
    imageMime: imageMime || null,
    imagePath: imagePath || null
  });
  const full = await Chat.Message.findByPk(row.id, { include: [{ model: User, as: 'sender', attributes: ['id', 'name', 'mobile'] }] });
  return success(res, { statusCode: 201, data: full });
});

const image = asyncHandler(async (req, res) => {
  const { group } = await ensureMembership(req.params.id, req.user.id, req.user.roleName);
  const row = await Chat.Message.findOne({ where: { id: req.params.messageId, groupId: group.id, messageType: { [Op.in]: ['IMAGE', 'PDF', 'VIDEO'] } } });
  if (!row || !row.imagePath) throw new ApiError(404, 'Attachment not found');
  const file = path.join(uploadDir, path.basename(row.imagePath));
  if (!fs.existsSync(file)) throw new ApiError(404, 'Attachment file not found');
  const fallbackMime = row.messageType === 'PDF' ? 'application/pdf' : row.messageType === 'VIDEO' ? 'video/mp4' : 'image/jpeg';
  res.set('Content-Type', row.imageMime || fallbackMime);
  if (row.messageType === 'PDF') res.set('Content-Disposition', 'inline');
  res.set('Cache-Control', 'private, max-age=3600');
  return res.sendFile(file);
});

const joinGroup = asyncHandler(async (req, res) => {
  const group = await Chat.findByPk(req.params.id);
  if (!group || !group.isActive) throw new ApiError(404, 'Chat group not found');
  if (req.user.roleName !== 'SUPER_ADMIN' && group.wardId !== req.user.wardId) throw new ApiError(403, 'You can join only groups in your ward');
  if (group.type === 'NAGARSEVAK' && req.user.roleName === 'CITIZEN') {
    const visible = await isNagarsevakVisibleInWard(group.wardId, group.nagarsevakUserId);
    if (!visible) throw new ApiError(404, 'Chat group not found');
  }
  if (group.type === 'NAGARSEVAK' && req.user.roleName === 'NAGARSEVAK' && String(group.nagarsevakUserId) !== String(req.user.id)) {
    throw new ApiError(403, 'You can access only your Nagarsevak group and the ward community.');
  }
  await Chat.Member.findOrCreate({ where: { groupId: group.id, userId: req.user.id }, defaults: { joinedAt: new Date() } });
  return success(res, { message: 'Joined group' });
});

const leaveGroup = asyncHandler(async (req, res) => {
  const group = await Chat.findByPk(req.params.id);
  if (!group) throw new ApiError(404, 'Chat group not found');
  if (group.type === 'WARD' || group.type === 'NAGARSEVAK') throw new ApiError(400, 'Ward community and Nagarsevak groups cannot be left');
  if (group.type === 'CUSTOM' && group.createdByUserId === req.user.id) throw new ApiError(400, 'Group creator cannot leave their own group. Archive it instead.');
  await Chat.Member.destroy({ where: { groupId: group.id, userId: req.user.id } });
  return success(res, { message: 'Left group' });
});

const clearChat = asyncHandler(async (req, res) => {
  const { member } = await ensureMembership(req.params.id, req.user.id, req.user.roleName);
  await member.update({ lastClearedAt: new Date(), lastReadAt: new Date() });
  return success(res, { message: 'Chat cleared for your account.' });
});

const markRead = asyncHandler(async (req, res) => {
  const { member } = await ensureMembership(req.params.id, req.user.id, req.user.roleName);
  await member.update({ lastReadAt: new Date() });
  return success(res, { message: 'Chat marked as read' });
});

module.exports = { listGroups, createGroup, deleteGroup, listMessages, sendMessage, image, clearChat, markRead, joinGroup, leaveGroup, cleanupOldMessages, ensureNagarsevakGroup, archiveNagarsevakGroup, reconcileWardGroupMembers, ensureWardGroup, archiveWardGroups, ensureAllNagarsevakGroups };
