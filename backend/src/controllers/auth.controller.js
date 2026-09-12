const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../services/audit.service');

function issueToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '20m',
  });
}

/**
 * Staff (SUPER_ADMIN / EMPLOYEE) login - email + password.
 * Citizens use the separate OTP flow below since most won't manage passwords.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email }, include: [Role] });

  if (!user || !user.passwordHash) throw new ApiError(401, 'Invalid credentials');
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new ApiError(401, 'Invalid credentials');
  if (user.status !== 'ACTIVE') throw new ApiError(403, 'Account is not active');

  user.lastLoginAt = new Date();
  await user.save();

  await logAudit({
    user: { id: user.id, roleName: user.Role.name },
    action: 'LOGIN',
    entity: 'User',
    recordId: user.id,
    ipAddress: req.ip,
  });

  return success(res, {
    message: 'Login successful',
    data: { token: issueToken(user), user: { id: user.id, name: user.name, role: user.Role.name } },
  });
});

/**
 * OTP request/verify are stubbed here behind the same interface an SMS
 * provider integration will fill in later (SRS explicitly treats SMS/WhatsApp
 * as pluggable channels subject to provider availability & consent).
 */
const requestOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;
  const user = await User.findOne({ where: { mobile } });
  if (!user) throw new ApiError(404, 'No account found for this mobile number');

  // TODO: generate real OTP, store hashed+expiring value, send via SMS provider.
  return success(res, { message: 'OTP sent (stub - wire up SMS provider in production)' });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;
  const user = await User.findOne({ where: { mobile }, include: [Role] });
  if (!user) throw new ApiError(404, 'No account found for this mobile number');

  // TODO: verify the stored OTP for real; this stub accepts a fixed dev code.
  if (otp !== '000000') throw new ApiError(401, 'Invalid OTP');

  user.lastLoginAt = new Date();
  await user.save();

  return success(res, {
    message: 'Login successful',
    data: { token: issueToken(user), user: { id: user.id, name: user.name, role: user.Role.name } },
  });
});

/** Admin-only: create a staff or citizen login account. */
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, mobile, password, roleName, personId } = req.body;

  const role = await Role.findOne({ where: { name: roleName } });
  if (!role) throw new ApiError(400, `Unknown role: ${roleName}`);

  const passwordHash = password ? await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS) || 12) : null;

  const user = await User.create({
    name, email, mobile, passwordHash, roleId: role.id,
    personId: roleName === 'CITIZEN' ? personId : null,
  });

  await logAudit({
    user: req.user,
    action: 'CREATE_USER',
    entity: 'User',
    recordId: user.id,
    newValue: { name, email, mobile, roleName },
    ipAddress: req.ip,
  });

  return success(res, { message: 'User created', data: { id: user.id }, statusCode: 201 });
});

module.exports = { login, requestOtp, verifyOtp, registerUser };
