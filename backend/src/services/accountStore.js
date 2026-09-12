const {
  AdminUser,
  SubAdminUser,
  NagarsevakUser,
  EmployeeUser,
  CitizenUser,
  CommunityUser,
} = require('../models/roleLogins.model');

const ROLE_MODELS = {
  SUPER_ADMIN: AdminUser,
  SUB_MASTER_ADMIN: SubAdminUser,
  NAGARSEVAK: NagarsevakUser,
  EMPLOYEE: EmployeeUser,
  CITIZEN: CitizenUser,
  SOCIAL_WORKER: CommunityUser,
  CANDIDATE: CommunityUser,
};

let roleCache = null;

async function loadRoleMap(Role) {
  if (roleCache) return roleCache;
  const rows = await Role.findAll({ attributes: ['id', 'name'] });
  roleCache = {
    byId: Object.fromEntries(rows.map(r => [String(r.id), r.name])),
    byName: Object.fromEntries(rows.map(r => [r.name, String(r.id)])),
  };
  return roleCache;
}

function invalidateRoleCache() {
  roleCache = null;
}

function instancesFromFind(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result.filter(Boolean);
  if (result.rows && Array.isArray(result.rows)) return result.rows.filter(Boolean);
  if (typeof result.get === 'function') return [result];
  return [];
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

function applyLoginFields(user, login, roleName) {
  if (!user || !login) return;
  user.setDataValue('passwordHash', login.passwordHash || null);
  user.setDataValue('permissions', asArray(login.permissions));
  user.setDataValue('wardIds', asArray(login.wardIds));
  user.setDataValue('wardSeat', login.wardSeat ?? null);
  user.setDataValue('partyName', login.partyName ?? null);
  user.setDataValue('officialAddress', login.officialAddress ?? null);
  user.setDataValue('accountKind', roleName);
  user.loginAccount = login;
}

function payloadFromUser(user, roleName, isCreate = false) {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    status: user.status || 'ACTIVE',
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    lastLoginAt: user.lastLoginAt || null,
    wardId: user.wardId || null,
    deletedAt: user.deletedAt || null,
  };
  const passwordHash = user.getDataValue('passwordHash') || user._loginPasswordHash || null;
  if (passwordHash) payload.passwordHash = passwordHash;
  const permissions = user.getDataValue('permissions');
  const wardIds = user.getDataValue('wardIds');
  if (roleName === 'SUB_MASTER_ADMIN') {
    if (isCreate || permissions !== undefined) payload.permissions = asArray(permissions);
    if (isCreate || wardIds !== undefined) payload.wardIds = asArray(wardIds);
  }
  if (roleName === 'NAGARSEVAK') {
    if (isCreate || permissions !== undefined) payload.permissions = asArray(permissions);
    if (isCreate || user.getDataValue('wardSeat') !== undefined) payload.wardSeat = user.getDataValue('wardSeat') || null;
    if (isCreate || user.getDataValue('partyName') !== undefined) payload.partyName = user.getDataValue('partyName') || null;
    if (isCreate || user.getDataValue('officialAddress') !== undefined) payload.officialAddress = user.getDataValue('officialAddress') || null;
  }
  if (roleName === 'CITIZEN') payload.personId = user.personId || null;
  if (roleName === 'SOCIAL_WORKER' || roleName === 'CANDIDATE') {
    if (isCreate || permissions !== undefined) payload.permissions = asArray(permissions);
    payload.memberRole = roleName;
  }
  return payload;
}

async function removeFromOtherTables(userId, keepModel, transaction) {
  await Promise.all(Object.values(ROLE_MODELS).map(Model => {
    if (Model === keepModel) return null;
    return Model.destroy({ where: { id: userId }, force: true, transaction });
  }));
}

async function syncLogin(user, Role, options = {}) {
  if (!user?.id || !user.roleId) return;
  const map = await loadRoleMap(Role);
  const roleName = map.byId[String(user.roleId)];
  const Model = ROLE_MODELS[roleName];
  if (!Model) return;
  const transaction = options.transaction;
  const payload = payloadFromUser(user, roleName, options.isCreate === true);
  const existing = await Model.findByPk(user.id, { transaction, paranoid: false });
  if (existing) {
    if (!payload.passwordHash) delete payload.passwordHash;
    await existing.update(payload, { transaction });
    if (user.deletedAt && !existing.deletedAt) await existing.destroy({ transaction });
    if (!user.deletedAt && existing.deletedAt) await existing.restore({ transaction });
  } else {
    if (!payload.passwordHash) payload.passwordHash = null;
    await Model.create(payload, { transaction, paranoid: false });
  }
  await removeFromOtherTables(user.id, Model, transaction);
}

async function hydrateUsers(result, Role) {
  const users = instancesFromFind(result);
  if (!users.length) return;
  const map = await loadRoleMap(Role);
  const grouped = {};
  for (const user of users) {
    const roleName = map.byId[String(user.roleId)];
    if (!roleName || !ROLE_MODELS[roleName]) continue;
    (grouped[roleName] ||= []).push(user);
  }
  await Promise.all(Object.entries(grouped).map(async ([roleName, rows]) => {
    const Model = ROLE_MODELS[roleName];
    const logins = await Model.findAll({
      where: { id: rows.map(u => u.id) },
      paranoid: false,
    });
    const byId = Object.fromEntries(logins.map(row => [String(row.id), row]));
    for (const user of rows) applyLoginFields(user, byId[String(user.id)], roleName);
  }));
}

function bindUserHooks(User, Role) {
  User.addHook('beforeCreate', (user) => {
    user._loginPasswordHash = user.getDataValue('passwordHash') || user._loginPasswordHash;
  });
  User.addHook('beforeUpdate', (user) => {
    user._loginPasswordHash = user.getDataValue('passwordHash') || user._loginPasswordHash;
  });
  User.addHook('afterFind', async (result) => {
    await hydrateUsers(result, Role);
  });
  User.addHook('afterCreate', async (user, options) => {
    await syncLogin(user, Role, { ...options, isCreate: true });
  });
  User.addHook('afterUpdate', async (user, options) => {
    await syncLogin(user, Role, options);
  });
  User.addHook('afterDestroy', async (user, options) => {
    await syncLogin(user, Role, options);
  });
  User.addHook('afterRestore', async (user, options) => {
    user.deletedAt = null;
    await syncLogin(user, Role, options);
  });
}

module.exports = {
  ROLE_MODELS,
  loadRoleMap,
  invalidateRoleCache,
  bindUserHooks,
  hydrateUsers,
  syncLogin,
};
