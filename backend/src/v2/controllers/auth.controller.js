const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User, Role, Ward, Employee } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { normalisePermissions, ALL_PERMISSIONS } = require('../utils/permissions');
const { syncWardCommunityMembership } = require('../../services/wardActivation.service');
const otpStore = require('../../services/otp.service');

const COMPANY = 'Kairo IT Solutions PVT LTD';
const STAFF_ROLES = new Set(['SUPER_ADMIN', 'SUB_MASTER_ADMIN', 'NAGARSEVAK', 'EMPLOYEE', 'SOCIAL_WORKER', 'CANDIDATE']);
const STAFF_RESET_MESSAGE = `Staff passwords are reset by ${COMPANY}. Nagarsevak, Employee, Sub Master Admin and Master Admin accounts cannot be recovered from this screen. Please contact our team.`;

function echoOtpEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.AUTH_OTP_ECHO === '1';
}

function maskDestination(value, channel) {
  const raw = String(value || '');
  if (channel === 'mobile') {
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 4) return 'your registered mobile';
    return `${digits.slice(0, 2)}******${digits.slice(-2)}`;
  }
  const [name, domain] = raw.split('@');
  if (!name || !domain) return 'your registered email';
  return `${name.slice(0, 2)}***@${domain}`;
}

async function findAccount(identifier) {
  const raw = String(identifier || '').trim();
  const email = raw.toLowerCase();
  const mobile = raw.replace(/\D/g, '');
  const clauses = [];
  if (email.includes('@')) clauses.push({ email });
  if (mobile.length === 10) clauses.push({ mobile });
  if (!clauses.length) {
    clauses.push({ email });
    if (mobile) clauses.push({ mobile });
  }
  return User.findOne({
    where: { [Op.or]: clauses },
    include: [{ model: Role }],
  });
}

function issueToken(user) {
  // The browser enforces the 30-minute inactivity policy. Keep the JWT long enough
  // that an actively working user is never signed out just because the original
  // 20-minute legacy JWT lifetime elapsed.
  const configured = String(process.env.JWT_EXPIRES_IN || '').trim();
  const expiresIn = configured && configured !== '20m' ? configured : '24h';
  return jwt.sign({ sub: user.id, role: user.Role?.name || user.accountKind || null }, process.env.JWT_SECRET, { expiresIn });
}

const login = asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier ?? req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const { Op } = require('sequelize');
  const user = await User.findOne({ where: { [Op.or]: [{ email: identifier }, { mobile: identifier.replace(/\D/g, '') }] }, include: [{ model: Role }, { model: Ward, as: 'ward' }, { model: Employee, as: 'employeeProfile', include: [{ model: User, as: 'manager', attributes: ['id','name','email','mobile','wardId'] }] }] });
  if (!user || !user.passwordHash) throw new ApiError(401, 'Invalid credentials');
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new ApiError(401, 'Invalid credentials');
  if (user.status !== 'ACTIVE') throw new ApiError(403, 'Account is not active');

  const roleName = user.Role.name;
  const employee = user.employeeProfile;
  const { assertNagarsevakLoginAllowed, assertEmployeeLoginAllowed } = require('../../services/wardActivation.service');
  if (roleName === 'NAGARSEVAK') await assertNagarsevakLoginAllowed(user);
  if (roleName === 'EMPLOYEE') await assertEmployeeLoginAllowed(employee);
  let permissions = roleName === 'SUPER_ADMIN' ? ALL_PERMISSIONS : roleName === 'NAGARSEVAK' ? normalisePermissions(user.permissions) : roleName === 'SUB_MASTER_ADMIN' ? normalisePermissions(user.permissions) : normalisePermissions(employee?.permissions);
  // Core ward-operations access for field roles. These are read/operational
  // capabilities only; destructive/admin privileges remain permission based.
  const coreRolePermissions = roleName === 'NAGARSEVAK'
    ? ['VIEW_DASHBOARD','VIEW_WARD_INFORMATION','VIEW_WARD_UPDATES','VIEW_NOTIFICATIONS','VIEW_HOUSES','VIEW_FAMILIES','VIEW_CITIZENS','VIEW_VOTERS','VIEW_COMPLAINTS','ASSIGN_COMPLAINTS','VIEW_18PLUS','VIEW_BIRTHDAYS','EXPORT_DATA','VIEW_SCHEMES','VIEW_DEATH_RECORDS','VIEW_CHAT','SEND_CHAT','VIEW_RECYCLE_BIN','RESTORE_RECYCLE_BIN','VIEW_USERS','VIEW_WARDS','VIEW_STAFF']
    : roleName === 'EMPLOYEE'
      ? ['VIEW_DASHBOARD','VIEW_WARD_INFORMATION','VIEW_WARD_UPDATES','VIEW_NOTIFICATIONS','VIEW_HOUSES','VIEW_FAMILIES','VIEW_CITIZENS','VIEW_VOTERS','VIEW_COMPLAINTS','VIEW_18PLUS','VIEW_BIRTHDAYS','EXPORT_DATA','VIEW_SCHEMES','VIEW_DEATH_RECORDS','VIEW_CHAT','SEND_CHAT','VIEW_RECYCLE_BIN','RESTORE_RECYCLE_BIN','VIEW_USERS','VIEW_WARDS']
      : [];
  permissions = [...new Set([...permissions, ...coreRolePermissions])];
  const wardIds = roleName === 'SUB_MASTER_ADMIN' ? (Array.isArray(user.wardIds) ? user.wardIds : []) : [];
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
  const wardId = (roleName === 'SUPER_ADMIN' || roleName === 'SUB_MASTER_ADMIN') ? null : (user.wardId || employee?.wardId);
  if (!['SUPER_ADMIN','SUB_MASTER_ADMIN'].includes(roleName) && !wardId) throw new ApiError(403, 'Your account is not assigned to a ward');

  user.lastLoginAt = new Date();
  await user.save();
  return success(res, {
    message: 'Login successful',
    data: {
      token: issueToken(user),
      user: { id: user.id, name: user.name, email: user.email, mobile: user.mobile, role: roleName, wardId, wardIds, ward: user.ward, employeeProfile: employee || null, permissions },
    },
  });
});

const registrationWards = asyncHandler(async (req, res) => {
  const wards = await Ward.findAll({
    where: { status: 'ACTIVE' },
    attributes: ['id', 'wardNumber', 'name'],
    order: [['wardNumber', 'ASC']]
  });
  return success(res, { data: wards });
});

const registerCitizen = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const mobile = String(req.body.mobile || '').replace(/\D/g, '');
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');
  const wardId = String(req.body.wardId || '').trim();

  if (!name) throw new ApiError(400, 'Full name is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'Please enter a valid email address');
  }
  if (!/^\d{10}$/.test(mobile)) {
    throw new ApiError(400, 'Mobile must be exactly 10 digits');
  }
  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }
  if (password !== confirmPassword) {
    throw new ApiError(400, 'Password and confirm password do not match');
  }

  const ward = await Ward.findOne({
    where: { id: wardId, status: 'ACTIVE' },
    attributes: ['id', 'wardNumber', 'name']
  });
  if (!ward) throw new ApiError(400, 'Please select a valid active ward');

  const citizenRole = await Role.findOne({ where: { name: 'CITIZEN' } });
  if (!citizenRole) throw new ApiError(500, 'Citizen role is not configured');

  const [existingEmail, existingMobile] = await Promise.all([
    User.findOne({ where: { email } }),
    User.findOne({ where: { mobile } })
  ]);
  if (existingEmail) throw new ApiError(409, 'This email / login ID is already registered');
  if (existingMobile) throw new ApiError(409, 'This mobile number is already registered');

  const user = await User.create({
    name,
    email,
    mobile,
    passwordHash: await bcrypt.hash(password, 12),
    roleId: citizenRole.id,
    personId: null,
    wardId: ward.id,
    status: 'ACTIVE'
  });

  await syncWardCommunityMembership(ward.id).catch(() => {});

  return success(res, {
    statusCode: 201,
    message: 'Registration successful. You can now sign in.',
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: 'CITIZEN',
      ward: { id: ward.id, wardNumber: ward.wardNumber, name: ward.name }
    }
  });
});

const changePassword = asyncHandler(async(req,res)=>{
  const user=await User.findByPk(req.user.id);
  if(!user) throw new ApiError(404,'Account not found');
  const password=String(req.body.password||'');
  if(password.length<8) throw new ApiError(400,'New password must be at least 8 characters');
  if(req.body.confirmPassword!==undefined && password!==String(req.body.confirmPassword)) throw new ApiError(400,'New password and confirm password do not match');
  await user.update({passwordHash:await bcrypt.hash(password,12)});
  return success(res,{message:'Password changed successfully'});
});

const updateProfile = asyncHandler(async(req,res)=>{
  const user=await User.findByPk(req.user.id);
  if(!user) throw new ApiError(404,'Account not found');
  const patch={};
  for(const k of ['name','email','mobile']) if(k in req.body) patch[k]=String(req.body[k]??'').trim();
  if(!patch.name || !String(patch.name).trim()) throw new ApiError(400,'Name is required');
  if(patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(patch.email))) throw new ApiError(400,'Please enter a valid email');
  if(patch.mobile && !/^\d{10}$/.test(String(patch.mobile))) throw new ApiError(400,'Mobile must be exactly 10 digits');
  if(patch.email && patch.email!==user.email){const exists=await User.findOne({where:{email:patch.email}});if(exists)throw new ApiError(409,'This email / login ID is already in use');}
  if(patch.mobile && patch.mobile!==user.mobile){const exists=await User.findOne({where:{mobile:patch.mobile}});if(exists)throw new ApiError(409,'This mobile number is already in use');}
  await user.update(patch);
  return success(res,{data:{id:user.id,name:user.name,email:user.email,mobile:user.mobile},message:'Profile updated'});
});

const forgotRequest = asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  const channel = String(req.body.channel || 'email').toLowerCase() === 'mobile' ? 'mobile' : 'email';
  const audience = String(req.body.audience || 'citizen').toLowerCase() === 'staff' ? 'staff' : 'citizen';
  if (!identifier) throw new ApiError(400, 'Email or mobile is required');

  if (audience === 'staff') {
    return success(res, {
      message: STAFF_RESET_MESSAGE,
      data: { requiresSupport: true, company: COMPANY },
    });
  }

  const user = await findAccount(identifier);
  const roleName = user?.Role?.name || '';
  if (user && STAFF_ROLES.has(roleName)) {
    return success(res, {
      message: STAFF_RESET_MESSAGE,
      data: { requiresSupport: true, company: COMPANY },
    });
  }

  const generic = 'If an account exists for this email or mobile, we sent a verification code.';
  if (!user || roleName !== 'CITIZEN' || user.status !== 'ACTIVE') {
    return success(res, { message: generic, data: { sent: true, channel } });
  }

  const destination = channel === 'mobile' ? user.mobile : user.email;
  const otp = await otpStore.issue(`${user.id}:${channel}`, { userId: user.id, channel });
  console.info(`[auth] password reset ${channel} code for ${user.email || user.mobile}: ${otp}`);
  return success(res, {
    message: `${generic} Check ${maskDestination(destination, channel)}.`,
    data: {
      sent: true,
      channel,
      destination: maskDestination(destination, channel),
      ...(echoOtpEnabled() ? { debugOtp: otp } : {}),
    },
  });
});

const forgotReset = asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  const otp = String(req.body.otp || '').trim();
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');
  const channel = String(req.body.channel || 'email').toLowerCase() === 'mobile' ? 'mobile' : 'email';
  if (password.length < 8) throw new ApiError(400, 'New password must be at least 8 characters');
  if (password !== confirmPassword) throw new ApiError(400, 'Password and confirm password do not match');

  const user = await findAccount(identifier);
  if (!user || user.Role?.name !== 'CITIZEN') {
    throw new ApiError(400, 'Invalid verification code.');
  }
  const checked = await otpStore.consume(`${user.id}:${channel}`, otp);
  if (!checked.ok) throw new ApiError(400, checked.reason);
  await user.update({ passwordHash: await bcrypt.hash(password, 12) });
  return success(res, { message: 'Password updated. You can now sign in.' });
});

module.exports = { login, updateProfile, changePassword, registrationWards, registerCitizen, forgotRequest, forgotReset };
