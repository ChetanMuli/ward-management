const jwt = require('jsonwebtoken');
const { User, Role, Employee } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Verifies the JWT, loads the current user + role + (if applicable) employee
 * profile, and attaches it to req.user. Every protected route depends on this
 * running first - RBAC checks below assume req.user is already populated.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) throw new ApiError(401, 'Authentication token is required');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new ApiError(401, 'Invalid or expired token');
  }

  const user = await User.findByPk(payload.sub, {
    include: [
      { model: Role },
      { model: Employee, as: 'employeeProfile' },
    ],
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new ApiError(401, 'Account is not active');
  }

  req.user = {
    id: user.id,
    email: user.email,
    roleName: user.Role.name,
    wardId: user.wardId,
    personId: user.personId,
    employeeProfile: user.employeeProfile || null,
  };

  next();
});

module.exports = { authenticate };
