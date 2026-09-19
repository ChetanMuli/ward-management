const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  Ward,
  User,
  Role,
  WardNagarsevakSubscription,
  NagarsevakUser,
  Employee,
  WardSubscriptionEvent,
} = require('../models');
const Chat = require('./chat.store');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('./audit.service');
const { notifyUsers } = require('./notify.service');
const { canResidentSeeNagarsevak } = require('./wardActivation.rules');
const { decorateNagarsevakPhotos } = require('../utils/photo');

const PUBLIC_NAGAR_ATTRS = ['id', 'name', 'email', 'mobile', 'wardId', 'status', 'roleId'];
const COMPANY_NAME = 'Kairo IT Solutions PVT LTD';
const COMPANY_EMAIL = 'chetan.a2zithub@gmail.com';
const COMPANY_MOBILE = '8523697410';
const PANEL_CONTACT = `${COMPANY_NAME}\nEmail: ${COMPANY_EMAIL}\nMobile: ${COMPANY_MOBILE}`;

function panelOffLoginMessage(kind = 'nagarsevak') {
  if (kind === 'employee') {
    return `Your Nagarsevak panel has been deactivated, so employee login is closed.\n\nPlease contact:\n${PANEL_CONTACT}`;
  }
  return `Your WardDesk panel has been deactivated. You cannot sign in until Master Admin activates it again.\n\nPlease contact:\n${PANEL_CONTACT}`;
}

async function logSubscriptionEvent({ subscription, action, fromStatus, toStatus, actor, notes, actedAt }) {
  if (!subscription?.id || !action) return null;
  try {
    return await WardSubscriptionEvent.create({
      id: crypto.randomUUID(),
      subscriptionId: subscription.id,
      wardId: subscription.wardId,
      nagarsevakUserId: subscription.nagarsevakUserId,
      action,
      fromStatus: fromStatus || null,
      toStatus: toStatus || null,
      actedBy: actor?.id || null,
      actedAt: actedAt || new Date(),
      notes: notes || null,
    });
  } catch (err) {
    console.error('[SUBSCRIPTION EVENT]', err.message);
    return null;
  }
}

async function roleId(name) {
  const role = await Role.findOne({ where: { name }, attributes: ['id'] });
  return role?.id || null;
}

async function ensureMembershipRow(groupId, userId) {
  let member = await Chat.Member.findOne({ where: { groupId, userId } });
  if (member) return member;
  try {
    return await Chat.Member.create({
      id: crypto.randomUUID(), groupId, userId, joinedAt: new Date(),
    });
  } catch (error) {
    if (error?.name !== 'SequelizeUniqueConstraintError') throw error;
    return Chat.Member.findOne({ where: { groupId, userId } });
  }
}

async function getWard(wardId) {
  if (!wardId) return null;
  return Ward.findByPk(wardId, {
    attributes: ['id', 'wardNumber', 'name', 'status', 'activatedAt', 'activatedBy', 'deactivatedAt', 'deactivatedBy'],
  });
}

function isWardActive(ward) {
  return String(ward?.status || '').toUpperCase() === 'ACTIVE';
}

async function getVisibleNagarsevakIds(wardId) {
  const ward = await getWard(wardId);
  if (!ward || !isWardActive(ward)) return [];
  const nagarRole = await roleId('NAGARSEVAK');
  if (!nagarRole) return [];
  const subs = await WardNagarsevakSubscription.findAll({
    where: { wardId, status: 'ACTIVE' },
    attributes: ['nagarsevakUserId'],
  });
  const subIds = subs.map((s) => s.nagarsevakUserId);
  if (!subIds.length) return [];
  const users = await User.findAll({
    where: { id: { [Op.in]: subIds }, roleId: nagarRole, wardId, status: 'ACTIVE' },
    attributes: ['id'],
  });
  return users.map((u) => u.id);
}

async function getVisibleNagarsevaks(wardId) {
  const ids = await getVisibleNagarsevakIds(wardId);
  if (!ids.length) return [];
  return User.findAll({
    where: { id: { [Op.in]: ids }, status: 'ACTIVE' },
    attributes: PUBLIC_NAGAR_ATTRS,
    order: [['name', 'ASC']],
  });
}

async function isNagarsevakVisibleInWard(wardId, nagarsevakUserId) {
  if (!wardId || !nagarsevakUserId) return false;
  const ids = await getVisibleNagarsevakIds(wardId);
  return ids.some((id) => String(id) === String(nagarsevakUserId));
}

async function assertResidentCanSeeNagarsevak(req, nagarsevakUserId) {
  if (req.user?.roleName !== 'CITIZEN') return true;
  const wardId = req.user.wardId;
  if (!wardId) throw new ApiError(403, 'Your account is not assigned to a ward');
  const ok = await isNagarsevakVisibleInWard(wardId, nagarsevakUserId);
  if (!ok) throw new ApiError(404, 'Nagarsevak not found');
  return true;
}

function publicNagarsevak(user) {
  if (!user) return null;
  const row = typeof user.toJSON === 'function' ? user.toJSON() : user;
  const photo = (typeof user.getDataValue === 'function' ? user.getDataValue('photo') : null) || row.photo || null;
  return {
    id: row.id,
    name: row.name,
    mobile: row.mobile || null,
    email: row.email || null,
    partyName: (typeof user.getDataValue === 'function' ? user.getDataValue('partyName') : null) || row.partyName || null,
    wardSeat: (typeof user.getDataValue === 'function' ? user.getDataValue('wardSeat') : null) || row.wardSeat || null,
    photo,
    status: 'ACTIVE',
  };
}

async function eligibleResidentIds(wardId) {
  const citizenRole = await roleId('CITIZEN');
  if (!citizenRole) return [];
  const rows = await User.findAll({
    where: { wardId, roleId: citizenRole, status: 'ACTIVE' },
    attributes: ['id'],
  });
  return rows.map((u) => u.id);
}

async function eligibleCommunityUserIds(wardId, visibleNagarsevakIds) {
  const citizenRole = await roleId('CITIZEN');
  const where = { wardId, status: 'ACTIVE' };
  if (citizenRole) where.roleId = citizenRole;
  const users = await User.findAll({ where, attributes: ['id'] });
  const ids = users.map((u) => u.id);
  for (const id of visibleNagarsevakIds || []) ids.push(id);
  return [...new Set(ids.map(String))];
}

async function ensureWardCommunityGroup(ward) {
  if (!ward) return null;
  const name = `Ward ${ward.wardNumber}${ward.name ? ` · ${ward.name}` : ''} Community`;
  const [group] = await Chat.findOrCreate({
    where: { wardId: ward.id, type: 'WARD' },
    defaults: {
      id: crypto.randomUUID(),
      wardId: ward.id,
      name,
      type: 'WARD',
      createdByUserId: null,
      isActive: true,
      mode: 'CHAT',
    },
  });
  if (!group.isActive || group.name !== name) await group.update({ name, isActive: true, mode: 'CHAT' });
  return group;
}

async function ensureNagarsevakChatGroup(user) {
  if (!user?.id || !user.wardId) return null;
  const name = `Nagarsevak · ${user.name}`;
  const existing = await Chat.findOne({ where: { nagarsevakUserId: user.id, type: 'NAGARSEVAK' } });
  if (existing) {
    await existing.update({ wardId: user.wardId, isActive: true, name, mode: 'CHAT' });
    return existing;
  }
  return Chat.create({
    wardId: user.wardId,
    name,
    type: 'NAGARSEVAK',
    nagarsevakUserId: user.id,
    createdByUserId: null,
    isActive: true,
    mode: 'CHAT',
  });
}

async function replaceGroupMembers(groupId, allowedUserIds) {
  await Chat.Member.reconcile(groupId, allowedUserIds);
}

async function syncWardCommunityMembership(wardId) {
  const ward = await getWard(wardId);
  if (!ward) return { wardId, communityId: null, visibleNagarsevakIds: [] };
  const visibleIds = await getVisibleNagarsevakIds(wardId);
  const community = await ensureWardCommunityGroup(ward);
  const communityMembers = await eligibleCommunityUserIds(wardId, visibleIds);
  if (community) await replaceGroupMembers(community.id, communityMembers);

  const nagarRole = await roleId('NAGARSEVAK');
  const allNagars = nagarRole
    ? await User.findAll({ where: { wardId, roleId: nagarRole }, attributes: ['id', 'name', 'wardId', 'status'] })
    : [];
  const residentsAndStaff = await eligibleCommunityUserIds(wardId, []);
  const visibleSet = new Set(visibleIds.map(String));

  for (const nagar of allNagars) {
    if (visibleSet.has(String(nagar.id)) && nagar.status === 'ACTIVE') {
      const group = await ensureNagarsevakChatGroup(nagar);
      if (!group) continue;
      await replaceGroupMembers(group.id, [...residentsAndStaff, nagar.id]);
    } else {
      await Chat.update(
        { isActive: false },
        { where: { nagarsevakUserId: nagar.id, type: 'NAGARSEVAK' } }
      );
    }
  }

  return {
    wardId,
    wardStatus: ward.status,
    communityId: community?.id || null,
    visibleNagarsevakIds: visibleIds,
  };
}

async function setWardActivation(wardId, nextStatus, actor, ipAddress) {
  const ward = await Ward.findByPk(wardId);
  if (!ward) throw new ApiError(404, 'Ward not found');
  const status = String(nextStatus || '').toUpperCase();
  if (!['ACTIVE', 'INACTIVE'].includes(status)) throw new ApiError(400, 'Ward status must be ACTIVE or INACTIVE');
  const previous = ward.status;
  const now = new Date();
  const patch = { status };
  if (status === 'ACTIVE') {
    patch.activatedAt = now;
    patch.activatedBy = actor?.id || null;
  } else {
    patch.deactivatedAt = now;
    patch.deactivatedBy = actor?.id || null;
  }
  await ward.update(patch);
  await syncWardCommunityMembership(ward.id);
  await logAudit({
    user: actor,
    action: status === 'ACTIVE' ? 'ACTIVATE_WARD' : 'DEACTIVATE_WARD',
    entity: 'Ward',
    recordId: ward.id,
    oldValue: { status: previous },
    newValue: { status, wardNumber: ward.wardNumber },
    ipAddress,
  });
  if (status === 'ACTIVE' && previous !== 'ACTIVE') {
    const visible = await getVisibleNagarsevaks(ward.id);
    if (visible.length) {
      const residentIds = await eligibleResidentIds(ward.id);
      await notifyUsers(residentIds, {
        senderUserId: actor?.id || null,
        type: 'WARD_ACTIVATED',
        title: 'Your ward is now active',
        message: `${ward.wardNumber}${ward.name ? ` · ${ward.name}` : ''} is now active. ${visible[0].name} is available in Ward Community.`,
        actionUrl: '/groups',
      });
    }
  }
  return ward.reload();
}

async function ensureNagarsevakSubscription(wardId, nagarsevakUserId, status = 'PENDING') {
  if (!wardId || !nagarsevakUserId) return null;
  const [sub] = await WardNagarsevakSubscription.findOrCreate({
    where: { wardId, nagarsevakUserId },
    defaults: {
      id: crypto.randomUUID(),
      wardId,
      nagarsevakUserId,
      status: status || 'PENDING',
    },
  });
  return sub;
}

async function isNagarsevakAccessActive(nagarsevakUserId, wardId = null) {
  if (!nagarsevakUserId) return false;
  const where = { nagarsevakUserId, status: 'ACTIVE' };
  if (wardId) where.wardId = wardId;
  const sub = await WardNagarsevakSubscription.findOne({ where, attributes: ['id'] });
  return !!sub;
}

async function assertNagarsevakLoginAllowed(user) {
  const ward = await getWard(user?.wardId);
  if (!isWardActive(ward)) {
    throw new ApiError(403, `This ward is not open yet.\n\nPlease contact:\n${PANEL_CONTACT}`);
  }
  const ok = await isNagarsevakAccessActive(user?.id, user?.wardId || null);
  if (!ok) {
    throw new ApiError(403, panelOffLoginMessage('nagarsevak'));
  }
}

async function assertEmployeeLoginAllowed(employee) {
  const managerId = employee?.managerUserId;
  if (!managerId) return;
  const manager = await User.findByPk(managerId, { attributes: ['id', 'status', 'wardId'] });
  if (!manager || manager.status !== 'ACTIVE') {
    throw new ApiError(403, panelOffLoginMessage('employee'));
  }
  const ok = await isNagarsevakAccessActive(manager.id, manager.wardId || employee.wardId || null);
  if (!ok) {
    throw new ApiError(403, panelOffLoginMessage('employee'));
  }
}

async function setNagarsevakPurchase({ wardId, nagarsevakUserId, status, actor, ipAddress, notes }) {
  const ward = await Ward.findByPk(wardId);
  if (!ward) throw new ApiError(404, 'Ward not found');
  if (!nagarsevakUserId) throw new ApiError(400, 'Nagarsevak is required');
  const nagarRole = await roleId('NAGARSEVAK');
  const user = await User.findOne({
    where: { id: nagarsevakUserId, roleId: nagarRole },
    attributes: ['id', 'name', 'email', 'mobile', 'wardId', 'status', 'roleId'],
  });
  if (!user) throw new ApiError(404, 'Nagarsevak not found');

  const next = String(status || '').toUpperCase();
  if (!['PENDING', 'ACTIVE', 'INACTIVE', 'DEACTIVATED'].includes(next)) {
    throw new ApiError(400, 'Invalid Nagarsevak activation status');
  }

  if (next === 'ACTIVE' && !isWardActive(ward)) {
    throw new ApiError(400, 'Activate this ward first, then activate the Nagarsevak.');
  }

  if (String(user.wardId) !== String(wardId)) {
    await user.update({ wardId });
  }

  const [sub, created] = await WardNagarsevakSubscription.findOrCreate({
    where: { wardId, nagarsevakUserId: user.id },
    defaults: {
      id: crypto.randomUUID(),
      wardId,
      nagarsevakUserId: user.id,
      status: 'PENDING',
    },
  });
  const previous = sub.status;
  const now = new Date();
  const patch = { status: next, notes: notes || sub.notes || null };
  if (next === 'ACTIVE') {
    patch.purchasedAt = sub.purchasedAt || now;
    patch.activatedAt = now;
    patch.activatedBy = actor?.id || null;
    patch.expiryNotifiedAt = null;
  } else if (['INACTIVE', 'DEACTIVATED'].includes(next)) {
    patch.deactivatedAt = now;
    patch.deactivatedBy = actor?.id || null;
  }
  await sub.update(patch);
  const eventAction = next === 'ACTIVE'
    ? (previous === 'ACTIVE' ? 'NOTES_UPDATED' : (previous && previous !== 'PENDING' ? 'REACTIVATED' : 'ACTIVATED'))
    : (['INACTIVE', 'DEACTIVATED'].includes(next) ? 'DEACTIVATED' : (created ? 'CREATED' : 'NOTES_UPDATED'));
  await logSubscriptionEvent({
    subscription: sub,
    action: created && next !== 'PENDING' ? (next === 'ACTIVE' ? 'ACTIVATED' : eventAction) : eventAction,
    fromStatus: created ? null : previous,
    toStatus: next,
    actor,
    notes: notes || null,
  });
  if (next === 'ACTIVE') {
    if (user.status !== 'ACTIVE') await user.update({ status: 'ACTIVE' });
    const team = await Employee.findAll({ where: { managerUserId: user.id }, attributes: ['userId'] });
    const empIds = team.map((row) => row.userId).filter(Boolean);
    if (empIds.length) await User.update({ status: 'ACTIVE' }, { where: { id: empIds, status: 'INACTIVE' } });
  } else if (['INACTIVE', 'DEACTIVATED'].includes(next)) {
    if (user.status === 'ACTIVE') await user.update({ status: 'INACTIVE' });
    const team = await Employee.findAll({ where: { managerUserId: user.id }, attributes: ['userId'] });
    const empIds = team.map((row) => row.userId).filter(Boolean);
    if (empIds.length) await User.update({ status: 'INACTIVE' }, { where: { id: empIds, status: 'ACTIVE' } });
  }
  await syncWardCommunityMembership(wardId);

  await logAudit({
    user: actor,
    action: next === 'ACTIVE' ? 'ACTIVATE_NAGARSEVAK_PURCHASE' : 'DEACTIVATE_NAGARSEVAK_PURCHASE',
    entity: 'WardNagarsevakSubscription',
    recordId: sub.id,
    oldValue: { status: previous, wardId, nagarsevakUserId: user.id, created },
    newValue: { status: next, wardNumber: ward.wardNumber, nagarsevak: user.name },
    ipAddress,
  });

  if (next === 'ACTIVE' && previous !== 'ACTIVE') {
    const residentIds = await eligibleResidentIds(wardId);
    await notifyUsers(residentIds, {
      senderUserId: actor?.id || null,
      type: 'NAGARSEVAK_ACTIVATED',
      title: `Your Nagarsevak is now available`,
      message: `${user.name} is now available for ${ward.wardNumber}${ward.name ? ` · ${ward.name}` : ''}. Open Ward Community to connect.`,
      actionUrl: '/groups',
    });
  }

  return sub.reload();
}

async function getResidentWardSnapshot(user) {
  const wardId = user?.wardId;
  const ward = await getWard(wardId);
  if (!ward) {
    return { ward: null, nagarsevak: null, nagarsevaks: [], employees: [], community: null };
  }
  const visible = isWardActive(ward) ? await getVisibleNagarsevaks(wardId) : [];
  const nagarsevaks = await decorateNagarsevakPhotos(visible.map(publicNagarsevak));
  const community = await Chat.findOne({
    where: { wardId, type: 'WARD', isActive: true },
    attributes: ['id', 'name', 'isActive'],
  });
  return {
    ward: {
      id: ward.id,
      number: ward.wardNumber,
      name: ward.name,
      status: ward.status,
    },
    nagarsevak: nagarsevaks[0] || null,
    nagarsevaks,
    employees: [],
    community: community ? { id: community.id, name: community.name, active: !!community.isActive } : null,
  };
}

async function listActivationBoard() {
  const nagarRole = await roleId('NAGARSEVAK');
  const citizenRole = await roleId('CITIZEN');
  const wards = await Ward.findAll({
    attributes: ['id', 'wardNumber', 'name', 'status', 'activatedAt', 'deactivatedAt'],
    order: [['wardNumber', 'ASC']],
  });
  const wardIds = wards.map((w) => w.id);
  const [subs, nagars, residentCounts, communities] = await Promise.all([
    WardNagarsevakSubscription.findAll({
      where: { wardId: { [Op.in]: wardIds.length ? wardIds : ['00000000-0000-0000-0000-000000000000'] } },
    }),
    nagarRole
      ? User.findAll({
        where: { roleId: nagarRole, wardId: { [Op.in]: wardIds.length ? wardIds : ['00000000-0000-0000-0000-000000000000'] } },
        attributes: ['id', 'name', 'email', 'mobile', 'wardId', 'status', 'roleId'],
        include: [{
          model: NagarsevakUser,
          as: 'nagarsevakAccount',
          attributes: ['wardSeat', 'partyName', 'officialAddress', 'photo'],
          required: false,
        }],
        order: [['name', 'ASC']],
      })
      : [],
    citizenRole
      ? User.findAll({
        where: { roleId: citizenRole, status: 'ACTIVE', wardId: { [Op.in]: wardIds.length ? wardIds : ['00000000-0000-0000-0000-000000000000'] } },
        attributes: ['id', 'wardId'],
      })
      : [],
    Chat.findAll({
      where: { type: 'WARD', wardId: { [Op.in]: wardIds.length ? wardIds : ['00000000-0000-0000-0000-000000000000'] } },
      attributes: ['id', 'wardId', 'name', 'isActive'],
    }),
  ]);

  const subByWard = new Map();
  for (const s of subs) {
    const key = String(s.wardId);
    if (!subByWard.has(key)) subByWard.set(key, []);
    subByWard.get(key).push(s);
  }
  const nagarByWard = new Map();
  for (const n of nagars) {
    const key = String(n.wardId);
    if (!nagarByWard.has(key)) nagarByWard.set(key, []);
    nagarByWard.get(key).push(n);
  }
  const residentsByWard = new Map();
  for (const r of residentCounts) {
    const key = String(r.wardId);
    residentsByWard.set(key, (residentsByWard.get(key) || 0) + 1);
  }
  const communityByWard = new Map(communities.map((c) => [String(c.wardId), c]));

  return wards.map((ward) => {
    const list = nagarByWard.get(String(ward.id)) || [];
    const subscriptions = subByWard.get(String(ward.id)) || [];
    const purchased = subscriptions.filter((s) => s.status === 'ACTIVE').map((s) => {
      const n = list.find((u) => String(u.id) === String(s.nagarsevakUserId));
      return n ? { ...publicNagarsevak(n), purchaseStatus: s.status, purchasedAt: s.purchasedAt, activatedAt: s.activatedAt } : null;
    }).filter(Boolean);
    const community = communityByWard.get(String(ward.id));
    return {
      id: ward.id,
      wardNumber: ward.wardNumber,
      name: ward.name,
      status: ward.status,
      activatedAt: ward.activatedAt,
      deactivatedAt: ward.deactivatedAt,
      purchasedNagarsevaks: purchased,
      purchasedNagarsevak: purchased[0] || null,
      nagarsevaks: list.map((n) => {
        const sub = subscriptions.find((s) => String(s.nagarsevakUserId) === String(n.id));
        const account = n.nagarsevakAccount || {};
        return {
          id: n.id,
          name: n.name,
          email: n.email,
          mobile: n.mobile,
          wardSeat: account.wardSeat || null,
          partyName: account.partyName || null,
          officialAddress: account.officialAddress || null,
          photo: account.photo || (typeof n.getDataValue === 'function' ? n.getDataValue('photo') : null) || n.photo || null,
          accountStatus: n.status,
          purchaseStatus: sub?.status || 'PENDING',
          purchasedAt: sub?.purchasedAt || null,
          activatedAt: sub?.activatedAt || null,
        };
      }),
      activeNagarsevakCount: purchased.length,
      community: community ? { id: community.id, name: community.name, active: !!community.isActive } : null,
      residentCount: residentsByWard.get(String(ward.id)) || 0,
    };
  });
}

function addCalendarYears(value, years) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setFullYear(date.getFullYear() + years);
  return date;
}

function describeSubscriptionCycle({ purchaseStatus, activatedAt, now = new Date() }) {
  const live = String(purchaseStatus || '').toUpperCase() === 'ACTIVE';
  const expiresAt = activatedAt ? addCalendarYears(activatedAt, 1) : null;
  const daysLeft = expiresAt == null ? null : Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000);
  if (!live) {
    const off = ['INACTIVE', 'DEACTIVATED'].includes(String(purchaseStatus || '').toUpperCase());
    return { expiresAt, daysLeft, cycle: off ? 'PANEL_OFF' : 'NOT_ACTIVATED', panelOn: false };
  }
  if (expiresAt && daysLeft <= 0) return { expiresAt, daysLeft, cycle: 'YEAR_ENDED', panelOn: true };
  if (expiresAt && daysLeft <= 30) return { expiresAt, daysLeft, cycle: 'EXPIRING', panelOn: true };
  return { expiresAt, daysLeft, cycle: 'ACTIVE', panelOn: true };
}

async function listNagarsevakSubscriptions() {
  const nagarRole = await roleId('NAGARSEVAK');
  if (!nagarRole) return [];
  const now = new Date();
  const [nagars, subs] = await Promise.all([
    User.findAll({
      where: { roleId: nagarRole },
      attributes: ['id', 'name', 'email', 'mobile', 'wardId', 'status', 'createdAt'],
      include: [{ model: Ward, as: 'ward', attributes: ['id', 'wardNumber', 'name', 'status'], required: false }],
      order: [['createdAt', 'DESC']],
    }),
    WardNagarsevakSubscription.findAll(),
  ]);
  return nagars.map((n) => {
    const sub = subs.find((s) => String(s.nagarsevakUserId) === String(n.id) && String(s.wardId) === String(n.wardId))
      || subs.find((s) => String(s.nagarsevakUserId) === String(n.id));
    const addedAt = n.createdAt || null;
    const purchaseStatus = sub?.status || 'PENDING';
    const activatedAt = sub?.activatedAt || sub?.purchasedAt || null;
    const wardStatus = String(n.ward?.status || '').toUpperCase() || 'INACTIVE';
    const wardActive = wardStatus === 'ACTIVE';
    const { expiresAt, daysLeft, cycle, panelOn } = describeSubscriptionCycle({ purchaseStatus, activatedAt, now });
    return {
      id: n.id,
      name: n.name,
      email: n.email,
      mobile: n.mobile,
      status: n.status,
      wardId: n.wardId,
      ward: n.ward ? { id: n.ward.id, wardNumber: n.ward.wardNumber, name: n.ward.name, status: n.ward.status || 'INACTIVE' } : null,
      wardStatus,
      wardActive,
      addedAt,
      activatedAt,
      deactivatedAt: sub?.deactivatedAt || null,
      purchaseStatus,
      expiresAt,
      daysLeft,
      cycle,
      panelOn,
      canActivate: wardActive,
      subscriptionId: sub?.id || null,
      expiryNotifiedAt: sub?.expiryNotifiedAt || null,
    };
  });
}

async function notifyExpiredNagarsevakSubscriptions() {
  const { idsForRoles, notifyUsers } = require('./notify.service');
  let rows = [];
  try {
    rows = await listNagarsevakSubscriptions();
  } catch (err) {
    console.error('[SUBSCRIPTION LIST FAILURE]', err.message);
    return 0;
  }
  const expired = rows.filter((row) => row.cycle === 'YEAR_ENDED' && row.panelOn);
  if (!expired.length) return 0;
  const masterIds = await idsForRoles(['SUPER_ADMIN']);
  if (!masterIds.length) return 0;
  let sent = 0;
  for (const row of expired) {
    if (row.expiryNotifiedAt) continue;
    const when = row.expiresAt ? new Date(row.expiresAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'today';
    try {
      await notifyUsers(masterIds, {
        type: 'NAGARSEVAK_SUBSCRIPTION_EXPIRED',
        title: 'Nagarsevak 1-year subscription ended',
        message: `${row.name}'s 1-year term ended on ${when}. The panel is still on until you deactivate it manually.`,
        actionUrl: '/nagarsevak-subscriptions',
      });
      if (row.subscriptionId) {
        await WardNagarsevakSubscription.update(
          { expiryNotifiedAt: new Date() },
          { where: { id: row.subscriptionId } }
        );
        await logSubscriptionEvent({
          subscription: { id: row.subscriptionId, wardId: row.wardId, nagarsevakUserId: row.id },
          action: 'YEAR_ENDED_NOTIFIED',
          fromStatus: row.purchaseStatus,
          toStatus: row.purchaseStatus,
        });
      } else if (row.wardId) {
        const sub = await ensureNagarsevakSubscription(row.wardId, row.id, row.purchaseStatus || 'PENDING');
        if (sub?.id) {
          await sub.update({ expiryNotifiedAt: new Date() }).catch(() => {});
        }
      }
      sent += 1;
    } catch (err) {
      console.error('[SUBSCRIPTION NOTIFY FAILURE]', { id: row.id, error: err.message });
    }
  }
  return sent;
}

async function notifyWardFieldStaff(wardId, payload) {
  if (!wardId) return 0;
  const nagarRole = await roleId('NAGARSEVAK');
  const empRole = await roleId('EMPLOYEE');
  const roleIds = [nagarRole, empRole].filter(Boolean);
  if (!roleIds.length) return 0;
  const users = await User.findAll({
    where: { wardId, status: 'ACTIVE', roleId: { [Op.in]: roleIds } },
    attributes: ['id', 'roleId'],
  });
  const allowedNagar = [];
  for (const row of users) {
    if (nagarRole && String(row.roleId) === String(nagarRole) && await isNagarsevakAccessActive(row.id, wardId)) {
      allowedNagar.push(row.id);
    }
  }
  if (!allowedNagar.length) return 0;
  const empUserIds = users.filter((row) => empRole && String(row.roleId) === String(empRole)).map((row) => row.id);
  let allowedEmp = [];
  if (empUserIds.length) {
    const team = await Employee.findAll({
      where: { userId: { [Op.in]: empUserIds }, managerUserId: { [Op.in]: allowedNagar } },
      attributes: ['userId'],
    });
    allowedEmp = team.map((row) => row.userId).filter(Boolean);
  }
  return notifyUsers([...allowedNagar, ...allowedEmp], payload);
}

module.exports = {
  canResidentSeeNagarsevak,
  getWard,
  isWardActive,
  getVisibleNagarsevakIds,
  getVisibleNagarsevaks,
  isNagarsevakVisibleInWard,
  assertResidentCanSeeNagarsevak,
  publicNagarsevak,
  syncWardCommunityMembership,
  setWardActivation,
  setNagarsevakPurchase,
  getResidentWardSnapshot,
  listActivationBoard,
  listNagarsevakSubscriptions,
  notifyExpiredNagarsevakSubscriptions,
  notifyWardFieldStaff,
  ensureNagarsevakSubscription,
  isNagarsevakAccessActive,
  assertNagarsevakLoginAllowed,
  assertEmployeeLoginAllowed,
  PUBLIC_NAGAR_ATTRS,
};
