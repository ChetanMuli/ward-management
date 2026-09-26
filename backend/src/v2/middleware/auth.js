const jwt = require('jsonwebtoken');
const { User, Role, Employee, Ward } = require('../../models');
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { normalisePermissions, ALL_PERMISSIONS, resolveFieldPermissions } = require('../utils/permissions');

const authenticateV2 = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication token is required');

  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch (_) { throw new ApiError(401, 'Invalid or expired token'); }

  const user = await User.findByPk(payload.sub, {
    include: [
      { model: Role },
      { model: Ward, as: 'ward' },
      { model: Employee, as: 'employeeProfile', include: [{ model: User, as: 'manager', attributes: ['id','name','email','mobile','wardId'] }] },
    ],
  });
  if (!user || user.status !== 'ACTIVE') throw new ApiError(401, 'Account is not active');

  const roleName = user.Role.name;
  const employee = user.employeeProfile;
  let permissions = roleName === 'SUPER_ADMIN'
    ? ALL_PERMISSIONS
    : roleName === 'NAGARSEVAK' || roleName === 'EMPLOYEE'
      ? resolveFieldPermissions(roleName, roleName === 'EMPLOYEE' ? employee?.permissions : user.permissions)
      : normalisePermissions(roleName === 'SUB_MASTER_ADMIN' || roleName === 'SOCIAL_WORKER' || roleName === 'CANDIDATE' ? user.permissions : employee?.permissions);

  // Citizen-facing pages are service pages, not admin permission-managed modules.
  // Give every active citizen the read/send capabilities required by the WardDesk
  // resident portal so the UI never exposes raw RBAC errors for normal navigation.
  // Ward scope is still enforced by the controllers, so a citizen can only see
  // data belonging to their registered ward.
  if (roleName === 'CITIZEN') {
    const citizenPortalPermissions = [
      'VIEW_DASHBOARD', 'VIEW_WARDS', 'VIEW_WARD_INFORMATION', 'VIEW_WARD_UPDATES',
      'VIEW_SCHEMES', 'VIEW_COMPLAINTS', 'CREATE_COMPLAINTS', 'VIEW_CHAT',
      'SEND_CHAT', 'VIEW_NOTIFICATIONS'
    ];
    for (const permission of citizenPortalPermissions) {
      if (!permissions.includes(permission)) permissions.push(permission);
    }
  }
  const wardIds = roleName === 'SUB_MASTER_ADMIN' ? (Array.isArray(user.wardIds) ? user.wardIds : []) : [];
  const wardId = (roleName === 'SUPER_ADMIN' || roleName === 'SUB_MASTER_ADMIN') ? null : (user.wardId || employee?.wardId || null);
  if (!['SUPER_ADMIN','SUB_MASTER_ADMIN'].includes(roleName) && !wardId) {
    throw new ApiError(403, 'Your account is not assigned to a ward');
  }

  let nagarsevakProfile = null;
  if (roleName === 'NAGARSEVAK') {
    nagarsevakProfile = {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      wardSeat: user.getDataValue('wardSeat') || null,
      partyName: user.getDataValue('partyName') || null,
      photo: user.getDataValue('photo') || null,
    };
  } else if (roleName === 'EMPLOYEE') {
    const mgr = employee?.manager;
    let nagarData = null;
    if (mgr?.id) {
      const { NagarsevakUser } = require('../../models/roleLogins.model');
      nagarData = await NagarsevakUser.findByPk(mgr.id);
    }
    if (nagarData) {
      nagarsevakProfile = {
        id: nagarData.id,
        name: nagarData.name || mgr.name,
        mobile: nagarData.mobile || mgr.mobile,
        wardSeat: nagarData.wardSeat || null,
        partyName: nagarData.partyName || null,
        photo: nagarData.photo || null,
      };
    } else if (mgr) {
      nagarsevakProfile = {
        id: mgr.id,
        name: mgr.name,
        mobile: mgr.mobile,
        wardSeat: null,
        partyName: null,
        photo: null,
      };
    }
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    roleName,
    personId: user.personId,
    wardId,
    wardIds,
    ward: user.ward || (employee?.ward || null),
    employeeProfile: employee || null,
    permissions,
    photo: roleName === 'NAGARSEVAK' ? (user.getDataValue('photo') || null) : null,
    wardSeat: roleName === 'NAGARSEVAK' ? (user.getDataValue('wardSeat') || null) : null,
    partyName: roleName === 'NAGARSEVAK' ? (user.getDataValue('partyName') || null) : null,
    nagarsevak: nagarsevakProfile,
  };
  next();
});

function requireV2Role(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.roleName)) throw new ApiError(403, 'You do not have permission for this action');
    next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user.permissions.includes(permission)) throw new ApiError(403, `Permission '${permission}' is required`);
    next();
  };
}

module.exports = { authenticateV2, requireV2Role, requirePermission };
