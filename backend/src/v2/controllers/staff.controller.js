const { ensureNagarsevakGroup, archiveNagarsevakGroup, reconcileWardGroupMembers } = require('./chat.controller');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User, Role, Employee, Ward, Area, Person, Family, House, WardNagarsevakSubscription } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { logAudit } = require('../../services/audit.service');
const { normalisePermissions, ALL_PERMISSIONS } = require('../utils/permissions');
const { allowedWardIds, isWardAllowed } = require('../services/wardScope');
const { getVisibleNagarsevaks, isWardActive, syncWardCommunityMembership, ensureNagarsevakSubscription, publicNagarsevak } = require('../../services/wardActivation.service');
const { syncLogin } = require('../../services/accountStore');
const { sanitisePhoto, decorateNagarsevakPhotos, nagarsevakPublicByIds } = require('../../utils/photo');

async function role(name) {
  const r = await Role.findOne({ where: { name } });
  if (!r) throw new ApiError(400, `Role ${name} is not available. Run the RBAC migration first.`);
  return r;
}

async function checkWard(wardId, req) {
  if (!wardId) throw new ApiError(400, 'wardId is required');
  const ward = await Ward.findByPk(wardId);
  if (!ward) throw new ApiError(400, 'Ward not found');
  if (!isWardAllowed(req, wardId)) throw new ApiError(403, 'You can manage staff only in an accessible ward');
  return ward;
}

const listCorporators = asyncHandler(async (req, res) => {
  const where = {};
  const allowed=allowedWardIds(req);
  if (allowed!==null) where.wardId = allowed.length===1 ? allowed[0] : { [require('sequelize').Op.in]: allowed.length?allowed:['00000000-0000-0000-0000-000000000000'] };
  if (req.query.wardId) {
    if (!isWardAllowed(req, req.query.wardId)) throw new ApiError(403, 'Cross-ward access denied');
    where.wardId = req.query.wardId;
  }
  if (req.query.status) where.status = req.query.status;
  const search = String(req.query.search || '').trim();
  if (search) {
    const { Op } = require('sequelize');
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { mobile: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } }
    ];
  }
  const rawPage = Number.parseInt(req.query.page, 10);
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 25;
  const r = await role('NAGARSEVAK');
  const result = await User.findAndCountAll({
    where: { ...where, roleId: r.id },
    include: [{ model: Ward, as: 'ward', attributes: ['id', 'wardNumber', 'name', 'status'] }],
    order: [['name','ASC']],
    limit,
    offset:(page-1)*limit,
    distinct:true
  });
  const ids = result.rows.map((u) => u.id);
  const subs = ids.length
    ? await WardNagarsevakSubscription.findAll({
      where: { nagarsevakUserId: { [Op.in]: ids }, status: 'ACTIVE' },
      attributes: ['nagarsevakUserId', 'wardId', 'status'],
    })
    : [];
  const activeSub = new Set(subs.map((s) => `${s.nagarsevakUserId}:${s.wardId}`));
  const photos = await nagarsevakPublicByIds(ids);
  return success(res, {
    data: result.rows.map(u => {
      const extra = photos.get(String(u.id));
      const wardActive = String(u.ward?.status || '').toUpperCase() === 'ACTIVE';
      const residentVisible = u.status === 'ACTIVE' && wardActive && activeSub.has(`${u.id}:${u.wardId}`);
      return {
        id:u.id,name:u.name,email:u.email,mobile:u.mobile,status:u.status,wardId:u.wardId,ward:u.ward,
        wardSeat: extra?.wardSeat || u.wardSeat || null,
        partyName: extra?.partyName || u.partyName || null,
        officialAddress:u.officialAddress,photo: extra?.photo || u.photo || null,
        permissions:normalisePermissions(u.permissions),
        wardStatus: u.ward?.status || null,
        wardActive,
        activationStatus: residentVisible ? 'ACTIVE' : 'INACTIVE',
        residentVisible,
      };
    }),
    meta:{ total:result.count, page, limit, pages:Math.max(1,Math.ceil(result.count/limit)) }
  });
});

const listUsers = asyncHandler(async (req, res) => {
  // Users are application accounts only. Administrative citizen/person data
  // belongs to People / Families / Houses and must never be mixed into Users.
  // This endpoint intentionally exposes only CITIZEN login accounts.
  const citizenRole = await role('CITIZEN');
  const where = { roleId: citizenRole.id };

  const allowed = allowedWardIds(req);
  const requestedWardId = String(req.query.wardId || '').trim();

  if (requestedWardId && !isWardAllowed(req, requestedWardId)) {
    throw new ApiError(403, 'Cross-ward access denied');
  }

  if (requestedWardId) {
    where.wardId = requestedWardId;
  } else if (allowed !== null) {
    where.wardId = {
      [Op.in]: allowed.length
        ? allowed
        : ['00000000-0000-0000-0000-000000000000']
    };
  }

  const status = String(req.query.status || '').trim().toUpperCase();
  // Deleted citizen accounts live only in Recycle Bin and must never appear in Users.
  if (['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
    where.status = status;
  } else {
    where.status = { [Op.ne]: 'DELETED' };
  }

  const search = String(req.query.search || '').trim();
  if (search) {
    const like = `%${search}%`;
    where[Op.or] = [
      { name: { [Op.like]: like } },
      { email: { [Op.like]: like } },
      { mobile: { [Op.like]: like } }
    ];
  }

  const rawPage = Number.parseInt(req.query.page, 10);
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 100)
    : 25;

  const result = await User.findAndCountAll({
    where,
    paranoid: true,
    include: [
      { model: Ward, as: 'ward', attributes: ['id', 'wardNumber', 'name'] }
    ],
    attributes: [
      'id', 'name', 'email', 'mobile', 'wardId', 'status',
      'lastLoginAt', 'createdAt', 'roleId'
    ],
    order: [['name', 'ASC']],
    limit,
    offset: (page - 1) * limit,
    distinct: true
  });

  return success(res, {
    data: result.rows.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      mobile: u.mobile,
      wardId: u.wardId,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      role: 'CITIZEN',
      ward: u.ward,
      registeredAppUser: true,
      person: null
    })),
    meta: {
      total: result.count,
      page,
      limit,
      pages: Math.max(1, Math.ceil(result.count / limit))
    }
  });
});

const createCorporator = asyncHandler(async (req, res) => {
  const { name, email, mobile, password, wardId, partyName, wardSeat, officialAddress } = req.body;
  const photo = sanitisePhoto(req.body.photo);
  await checkWard(wardId, req);
  const r = await role('NAGARSEVAK');
  const existingEmail = await User.findOne({ where: { email } });
  if (existingEmail) throw new ApiError(409, 'This email / login ID is already in use');
  const existingMobile = await User.findOne({ where: { mobile } });
  if (existingMobile) throw new ApiError(409, 'This mobile number is already in use');
  const permissions = Object.prototype.hasOwnProperty.call(req.body, 'permissions')
    ? [...new Set(['VIEW_DASHBOARD', ...normalisePermissions(req.body.permissions)])]
    : [...ALL_PERMISSIONS];
  const user = await User.create({ name, email, mobile, partyName: partyName || null, wardSeat: wardSeat || null, officialAddress: officialAddress || null, photo: photo || null, passwordHash: await bcrypt.hash(password, 12), roleId:r.id, wardId, permissions, status:'INACTIVE' });
  await ensureNagarsevakSubscription(wardId, user.id, 'PENDING');
  await logAudit({ user:req.user, action:'CREATE_NAGARSEVAK', entity:'User', recordId:user.id, newValue:{name,email,mobile,wardId,status:'INACTIVE'}, ipAddress:req.ip });
  return success(res,{statusCode:201,message:'Nagarsevak added to the ward. Activate the ward, then activate this Nagarsevak on Ward activation.',data:{id:user.id,name:user.name,email:user.email,mobile:user.mobile,wardId,status:user.status}});
});

const updateCorporator = asyncHandler(async (req,res)=>{
  const r=await role('NAGARSEVAK');
  const user=await User.findOne({where:{id:req.params.id,roleId:r.id}});
  if(!user) throw new ApiError(404,'Nagarsevak not found');
  await checkWard(req.body.wardId || user.wardId, req);
  const old=user.toJSON();
  const oldWardId=user.wardId;
  const patch={...req.body};
  delete patch.password; delete patch.roleId;
  for (const key of ['name','email','mobile','wardId','partyName','wardSeat','officialAddress','status']) { if (Object.prototype.hasOwnProperty.call(req.body, key)) patch[key] = req.body[key]; }
  if (Object.prototype.hasOwnProperty.call(req.body, 'photo')) patch.photo = sanitisePhoto(req.body.photo);
  Object.keys(patch).filter(k => !['name','email','mobile','wardId','partyName','wardSeat','officialAddress','photo','status','permissions','passwordHash'].includes(k)).forEach(k => delete patch[k]);
  if(patch.passwordHash) delete patch.passwordHash;
  if(Object.prototype.hasOwnProperty.call(req.body, 'permissions')) {
    if(req.user.roleName !== 'SUPER_ADMIN') throw new ApiError(403, 'Only Master Admin can manage Nagarsevak permissions');
    patch.permissions=[...new Set(['VIEW_DASHBOARD', ...normalisePermissions(req.body.permissions)])];
  }
  if(req.body.password) patch.passwordHash=await bcrypt.hash(req.body.password,12);
  if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
    const nextStatus = String(patch.status || '').toUpperCase();
    if (!['SUSPENDED', 'INACTIVE'].includes(nextStatus)) delete patch.status;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'photo')) {
    user.setDataValue('photo', patch.photo);
    user._loginPhoto = patch.photo;
  }
  await user.update(patch);
  if (Object.prototype.hasOwnProperty.call(req.body, 'photo')) {
    user.setDataValue('photo', patch.photo);
    await syncLogin(user, Role);
  }
  if (String(oldWardId || '') !== String(user.wardId || '')) {
    if (oldWardId) {
      await WardNagarsevakSubscription.update(
        { status: 'DEACTIVATED', deactivatedAt: new Date() },
        { where: { nagarsevakUserId: user.id, wardId: oldWardId } }
      );
    }
    if (user.wardId) await ensureNagarsevakSubscription(user.wardId, user.id, 'PENDING');
    if (user.status === 'ACTIVE') await user.update({ status: 'INACTIVE' });
    await reconcileWardGroupMembers(oldWardId);
    await reconcileWardGroupMembers(user.wardId);
    await syncWardCommunityMembership(oldWardId).catch(() => {});
    await syncWardCommunityMembership(user.wardId).catch(() => {});
  } else {
    if (user.wardId) await ensureNagarsevakSubscription(user.wardId, user.id);
    await syncWardCommunityMembership(user.wardId).catch(() => {});
  }
  if (user.status === 'ACTIVE') await ensureNagarsevakGroup(user.id);
  else await archiveNagarsevakGroup(user.id);
  await logAudit({user:req.user,action:'UPDATE_NAGARSEVAK',entity:'User',recordId:user.id,oldValue:old,newValue:req.body,ipAddress:req.ip});
  return success(res,{data:{...user.toJSON(),permissions:normalisePermissions(user.permissions)},message:'Nagarsevak updated'});
});


const convertCorporator = asyncHandler(async (req, res) => {
  if (req.user.roleName !== 'SUPER_ADMIN') throw new ApiError(403, 'Only the Master Admin can remove a Nagarsevak from the Nagarsevak directory');
  const targetRoleName = String(req.body.targetRole || '').trim().toUpperCase();
  if (!['SOCIAL_WORKER', 'CANDIDATE'].includes(targetRoleName)) throw new ApiError(400, 'Select Social Worker or Election Candidate');
  const nagRole = await role('NAGARSEVAK');
  const targetRole = await role(targetRoleName);
  const user = await User.findOne({ where: { id: req.params.id, roleId: nagRole.id } });
  if (!user) throw new ApiError(404, 'Nagarsevak not found');
  const wardId = user.wardId;
  const managed = await Employee.findAll({ where: { managerUserId: user.id }, attributes: ['id', 'userId'] });
  let replacementManagerId = String(req.body.replacementManagerUserId || '').trim() || null;
  if (managed.length) {
    if (!replacementManagerId) throw new ApiError(409, `This Nagarsevak manages ${managed.length} employee(s). Select another Nagarsevak before moving this account to Community Members.`);
    const replacement = await User.findOne({ where: { id: replacementManagerId, roleId: nagRole.id, wardId, status: 'ACTIVE' } });
    if (!replacement || replacement.id === user.id) throw new ApiError(400, 'Replacement manager must be another active Nagarsevak in the same ward');
    await Employee.update({ managerUserId: replacement.id }, { where: { managerUserId: user.id } });
  }
  const old = user.toJSON();
  await user.update({ roleId: targetRole.id, status: 'ACTIVE', permissions: [...new Set(['VIEW_DASHBOARD', 'VIEW_CHAT', ...normalisePermissions(req.body.permissions || [])])] });
  await archiveNagarsevakGroup(user.id);
  await reconcileWardGroupMembers(wardId);
  await logAudit({ user:req.user, action:'CONVERT_NAGARSEVAK_TO_COMMUNITY_MEMBER', entity:'User', recordId:user.id, oldValue:old, newValue:{targetRole:targetRoleName,replacementManagerUserId:replacementManagerId}, ipAddress:req.ip });
  return success(res, { message:`${old.name} moved to Community Members as ${targetRoleName === 'CANDIDATE' ? 'Former Nagarsevak / Candidate' : 'Social Worker (Samaj Sevak)'}.`, data:{id:user.id,name:user.name,role:targetRoleName,wardId:user.wardId} });
});

const listEmployees = asyncHandler(async(req,res)=>{
  const where={};
  const allowed=allowedWardIds(req);
  if(allowed!==null) where.wardId=allowed.length===1?allowed[0]:{[require('sequelize').Op.in]:allowed.length?allowed:['00000000-0000-0000-0000-000000000000']};
  if(req.query.wardId) { if(!isWardAllowed(req,req.query.wardId)) throw new ApiError(403,'Cross-ward access denied'); where.wardId=req.query.wardId; }
  if(req.query.status) where.status=req.query.status;
  if(req.user.roleName==='EMPLOYEE') where.userId=req.user.id;
  if(req.user.roleName==='NAGARSEVAK') where.managerUserId=req.user.id;
  const rawPage = Number.parseInt(req.query.page, 10);
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 25;
  const result=await Employee.findAndCountAll({
    where,
    include:[
      {model:User,as:'User',required:false},
      {model:Ward,as:'ward',required:false},
      {model:User,as:'manager',attributes:['id','name','email','mobile','wardId'],required:false}
    ],
    order:[[{model:User,as:'User'},'name','ASC']],
    limit,
    offset:(page-1)*limit,
    distinct:true
  });
  return success(res,{data:result.rows,meta:{total:result.count,page,limit,pages:Math.max(1,Math.ceil(result.count/limit))}});
});

const createEmployee = asyncHandler(async(req,res)=>{
  const {name,email,mobile,password,wardId,designation,assignedAreaIds=[],permissions=[],managerUserId}=req.body;
  await checkWard(wardId,req);
  let manager=null;
  const effectiveManagerUserId = String(managerUserId || (req.user.roleName === 'NAGARSEVAK' ? req.user.id : '') || '');
  if (!effectiveManagerUserId) throw new ApiError(400, 'Managing Nagarsevak is required');
  manager=await User.findByPk(effectiveManagerUserId,{include:[{model:Role},{model:Ward,as:'ward'}]}); if(!manager || manager.Role.name!=='NAGARSEVAK') throw new ApiError(400,'Managing user must be a Nagarsevak'); if(manager.wardId!==wardId) throw new ApiError(400,'Nagarsevak and employee must belong to the same ward'); if(req.user.roleName==='NAGARSEVAK'&&manager.id!==req.user.id) throw new ApiError(403,'You can create employees only under your account');
  const [r,existingEmail,existingMobile]=await Promise.all([
    role('EMPLOYEE'),
    User.findOne({where:{email}}),
    User.findOne({where:{mobile}})
  ]);
  if(existingEmail) throw new ApiError(409,'This email / login ID is already in use');
  if(existingMobile) throw new ApiError(409,'This mobile number is already in use');
  const areas=await Area.findAll({where:{id:assignedAreaIds}});
  if(areas.some(a=>a.wardId!==wardId)) throw new ApiError(400,'Every assigned area must belong to the employee ward');
  const user=await User.create({name,email,mobile,passwordHash:await bcrypt.hash(password,12),roleId:r.id,wardId,status:'ACTIVE'});
  const employee=await Employee.create({userId:user.id,wardId,managerUserId:effectiveManagerUserId,designation:designation||'Ward Employee',assignedAreaIds,permissions:[...new Set(['VIEW_DASHBOARD',...normalisePermissions(permissions)])],status:'ACTIVE'});
  await syncLogin(user, Role, { isCreate: true }).catch(() => {});
  await logAudit({user:req.user,action:'CREATE_EMPLOYEE',entity:'Employee',recordId:employee.id,newValue:{name,email,mobile,wardId,designation,assignedAreaIds,permissions,managerUserId:effectiveManagerUserId},ipAddress:req.ip});
  await syncWardCommunityMembership(wardId).catch(() => {});
  return success(res,{statusCode:201,message:'Employee created',data:{id:employee.id,userId:user.id,name,email,mobile,wardId,managerUserId:employee.managerUserId,permissions:employee.permissions,assignedAreaIds}});
});

const updateEmployee = asyncHandler(async(req,res)=>{
  const employee=await Employee.findByPk(req.params.id,{include:[{model:User,as:'User'}]});
  if(!employee) throw new ApiError(404,'Employee not found');
  await checkWard(req.body.wardId || employee.wardId,req);
  const wardId=req.body.wardId||employee.wardId;
  const targetManagerId = ('managerUserId' in req.body) ? req.body.managerUserId : employee.managerUserId;
  if(!targetManagerId) throw new ApiError(400,'Managing Nagarsevak is required');
  if (targetManagerId) { const manager=await User.findByPk(targetManagerId,{include:[{model:Role}]}); if(!manager || manager.Role.name!=='NAGARSEVAK') throw new ApiError(400,'Managing user must be a Nagarsevak'); if(manager.wardId!==wardId) throw new ApiError(400,'Nagarsevak and employee must belong to the same ward'); if(req.user.roleName==='NAGARSEVAK'&&manager.id!==req.user.id) throw new ApiError(403,'You can manage only employees under your account'); }
  if(req.body.assignedAreaIds){const areas=await Area.findAll({where:{id:req.body.assignedAreaIds}});if(areas.some(a=>a.wardId!==wardId))throw new ApiError(400,'Assigned area belongs to another ward');}
  const old={employee:employee.toJSON(),user:employee.User?.toJSON()};
  const ep={}; const up={};
  for(const k of ['designation','assignedAreaIds','permissions','wardId','managerUserId']) if(k in req.body) ep[k]=k==='permissions'?[...new Set(['VIEW_DASHBOARD',...normalisePermissions(req.body[k])])]:req.body[k];
  for(const k of ['name','email','mobile','status','wardId']) if(k in req.body) up[k]=req.body[k];
  if(req.body.password) up.passwordHash=await bcrypt.hash(req.body.password,12);
  await employee.update(ep); if(employee.User) await employee.User.update(up);
  await logAudit({user:req.user,action:'UPDATE_EMPLOYEE',entity:'Employee',recordId:employee.id,oldValue:old,newValue:req.body,ipAddress:req.ip});
  return success(res,{data:employee,message:'Employee updated'});
});



const deleteCorporator = asyncHandler(async(req,res)=>{
  if(!['SUPER_ADMIN'].includes(req.user.roleName)) throw new ApiError(403,'Only the Master Admin can delete Nagarsevak accounts');
  const r=await role('NAGARSEVAK');
  const user=await User.findOne({where:{id:req.params.id,roleId:r.id}});
  if(!user) throw new ApiError(404,'Nagarsevak not found');
  // Keep employee records for reassignment, but prevent their login until a new manager is assigned.
  const managed=await Employee.findAll({where:{managerUserId:user.id},attributes:['userId']});
  const managedUserIds=managed.map(x=>x.userId).filter(Boolean);
  if(managedUserIds.length) await User.update({status:'SUSPENDED'},{where:{id:managedUserIds}});
  await Employee.update({managerUserId:null,status:'INACTIVE'},{where:{managerUserId:user.id}});
  await User.update({status:'SUSPENDED'},{where:{id:user.id}});
  await archiveNagarsevakGroup(user.id);
  await user.destroy();
  await logAudit({user:req.user,action:'DELETE_NAGARSEVAK',entity:'User',recordId:req.params.id,oldValue:{name:user.name,email:user.email,wardId:user.wardId},ipAddress:req.ip});
  return success(res,{message:'Nagarsevak deleted successfully. Managed employees were kept inactive for reassignment.'});
});

const deleteEmployee = asyncHandler(async(req,res)=>{
  const employee=await Employee.findByPk(req.params.id,{include:[{model:User,as:'User'}]});
  if(!employee) throw new ApiError(404,'Employee not found');
  await checkWard(employee.wardId,req);
  if(req.user.roleName==='NAGARSEVAK' && employee.managerUserId!==req.user.id) throw new ApiError(403,'You can delete only employees under your account');
  const old=employee.User?.toJSON();
  await employee.destroy();
  if(employee.User) await employee.User.destroy();
  await logAudit({user:req.user,action:'DELETE_EMPLOYEE',entity:'Employee',recordId:req.params.id,oldValue:old,ipAddress:req.ip});
  return success(res,{message:'Employee deleted successfully'});
});

const listSubAdmins = asyncHandler(async (req,res)=>{
  const r=await role('SUB_MASTER_ADMIN');
  const rows=await User.findAll({where:{roleId:r.id},attributes:['id','name','email','mobile','status','roleId','createdAt','lastLoginAt'],order:[['name','ASC']]});
  return success(res,{data:rows.map(u=>u.toJSON())});
});

const createSubAdmin = asyncHandler(async(req,res)=>{
  if(req.user.roleName!=='SUPER_ADMIN') throw new ApiError(403,'Only the Master Admin can create Sub Master Admin accounts');
  const {name,email,mobile,password,permissions=[],wardIds=[]}=req.body;
  const r=await role('SUB_MASTER_ADMIN');
  if(await User.findOne({where:{email}})) throw new ApiError(409,'This email / login ID is already in use');
  if(await User.findOne({where:{mobile}})) throw new ApiError(409,'This mobile number is already in use');
  const cleanWardIds=[...new Set((Array.isArray(wardIds)?wardIds:[]).map(String))];
  const wards=cleanWardIds.length?await Ward.findAll({where:{id:cleanWardIds},attributes:['id']}):[];
  if(wards.length!==cleanWardIds.length) throw new ApiError(400,'One or more selected wards do not exist');
  const user=await User.create({name,email,mobile,passwordHash:await bcrypt.hash(password,12),roleId:r.id,permissions:normalisePermissions(permissions),wardIds:cleanWardIds,status:'ACTIVE'});
  await logAudit({user:req.user,action:'CREATE_SUB_MASTER_ADMIN',entity:'User',recordId:user.id,newValue:{name,email,mobile,wardIds:user.wardIds,permissions:user.permissions},ipAddress:req.ip});
  return success(res,{statusCode:201,message:'Sub Master Admin created',data:{id:user.id,name:user.name,email:user.email,mobile:user.mobile,status:user.status,permissions:user.permissions,wardIds:user.wardIds}});
});

const updateSubAdmin = asyncHandler(async(req,res)=>{
  if(req.user.roleName!=='SUPER_ADMIN') throw new ApiError(403,'Only the Master Admin can manage Sub Master Admin accounts');
  const r=await role('SUB_MASTER_ADMIN');
  const user=await User.findOne({where:{id:req.params.id,roleId:r.id}});
  if(!user) throw new ApiError(404,'Sub Master Admin not found');
  const old=user.toJSON(), patch={};
  for(const k of ['name','email','mobile','status']) if(k in req.body) patch[k]=req.body[k];
  if('permissions' in req.body) patch.permissions=normalisePermissions(req.body.permissions);
  if('wardIds' in req.body){const clean=[...new Set((Array.isArray(req.body.wardIds)?req.body.wardIds:[]).map(String))];const wards=clean.length?await Ward.findAll({where:{id:clean},attributes:['id']}):[];if(wards.length!==clean.length)throw new ApiError(400,'One or more selected wards do not exist');patch.wardIds=clean;}
  if(req.body.password) patch.passwordHash=await bcrypt.hash(req.body.password,12);
  await user.update(patch);
  await logAudit({user:req.user,action:'UPDATE_SUB_MASTER_ADMIN',entity:'User',recordId:user.id,oldValue:old,newValue:req.body,ipAddress:req.ip});
  return success(res,{data:{id:user.id,name:user.name,email:user.email,mobile:user.mobile,status:user.status,permissions:user.permissions,wardIds:user.wardIds},message:'Sub Master Admin updated'});
});


const resetUserPassword = asyncHandler(async(req,res)=>{
  if(req.user.roleName!=='SUPER_ADMIN') throw new ApiError(403,'Only the Master Admin can reset another account password');
  const password=String(req.body.password||'');
  if(password.length<8) throw new ApiError(400,'New password must be at least 8 characters');
  const user=await User.findByPk(req.params.userId,{include:[{model:Role}]});
  if(!user) throw new ApiError(404,'Account not found');
  if(user.Role.name==='SUPER_ADMIN') throw new ApiError(400,'The primary Master Admin password must be changed from the Master Admin profile');
  await user.update({passwordHash:await bcrypt.hash(password,12)});
  await logAudit({user:req.user,action:'RESET_ACCOUNT_PASSWORD',entity:'User',recordId:user.id,newValue:{role:user.Role.name},ipAddress:req.ip});
  return success(res,{message:`Password reset successfully for ${user.name}`});
});



const updateUser = asyncHandler(async (req,res)=>{
  const citizenRole = await role('CITIZEN');
  const user = await User.findOne({where:{id:req.params.id,roleId:citizenRole.id},include:[{model:Ward,as:'ward'}]});
  if(!user) throw new ApiError(404,'Registered user not found');

  const currentWard=user.wardId;
  const targetWard='wardId' in req.body ? String(req.body.wardId||'').trim() : currentWard;
  if(!targetWard) throw new ApiError(400,'Ward is required');
  await checkWard(targetWard,req);

  const patch={};
  if('name' in req.body){patch.name=String(req.body.name||'').trim();if(!patch.name)throw new ApiError(400,'Name is required');}
  if('email' in req.body){patch.email=String(req.body.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email))throw new ApiError(400,'Valid email is required');}
  if('mobile' in req.body){patch.mobile=String(req.body.mobile||'').replace(/\D/g,'');if(!/^\d{10}$/.test(patch.mobile))throw new ApiError(400,'Mobile must be exactly 10 digits');}
  if('status' in req.body){const status=String(req.body.status||'').toUpperCase();if(!['ACTIVE','INACTIVE','SUSPENDED','DELETED'].includes(status))throw new ApiError(400,'Invalid user status');patch.status=status;}
  if('wardId' in req.body)patch.wardId=targetWard;
  if(req.body.password){const password=String(req.body.password);if(password.length<8)throw new ApiError(400,'Password must be at least 8 characters');patch.passwordHash=await bcrypt.hash(password,12);}

  if(patch.email && patch.email!==user.email){const exists=await User.findOne({where:{email:patch.email,id:{[Op.ne]:user.id}}});if(exists)throw new ApiError(409,'This email / login ID is already in use');}
  if(patch.mobile && patch.mobile!==user.mobile){const exists=await User.findOne({where:{mobile:patch.mobile,id:{[Op.ne]:user.id}}});if(exists)throw new ApiError(409,'This mobile number is already in use');}

  const old=user.toJSON();
  await user.update(patch);
  await syncWardCommunityMembership(currentWard).catch(() => {});
  if (String(currentWard || '') !== String(user.wardId || '')) {
    await syncWardCommunityMembership(user.wardId).catch(() => {});
  }
  await logAudit({user:req.user,action:'UPDATE_REGISTERED_USER',entity:'User',recordId:user.id,oldValue:old,newValue:{...req.body,password:req.body.password?'[changed]':undefined},ipAddress:req.ip});
  const fresh=await User.findByPk(user.id,{include:[{model:Ward,as:'ward',attributes:['id','wardNumber','name']}]});
  return success(res,{data:{id:fresh.id,name:fresh.name,email:fresh.email,mobile:fresh.mobile,wardId:fresh.wardId,status:fresh.status,lastLoginAt:fresh.lastLoginAt,createdAt:fresh.createdAt,ward:fresh.ward},message:'Registered user updated'});
});

const deleteUser = asyncHandler(async(req,res)=>{
  const citizenRole=await role('CITIZEN');
  const user=await User.findOne({where:{id:req.params.id,roleId:citizenRole.id}});
  if(!user)throw new ApiError(404,'Registered user not found');
  if(!isWardAllowed(req,user.wardId))throw new ApiError(403,'Cross-ward access denied');
  if(user.id===req.user.id)throw new ApiError(400,'You cannot delete your own account');
  const oldStatus=user.status;
  await user.update({status:'DELETED'});
  await user.destroy();
  await logAudit({user:req.user,action:'DELETE_REGISTERED_USER',entity:'User',recordId:user.id,oldValue:{name:user.name,email:user.email,mobile:user.mobile,wardId:user.wardId,status:oldStatus},newValue:{status:'DELETED',recycleBin:true},ipAddress:req.ip});
  return success(res,{message:'Registered user moved to recycle bin'});
});

const listWardTeam = asyncHandler(async(req,res)=>{
  const wardId=req.user.roleName==='SUPER_ADMIN'?String(req.query.wardId||'').trim():req.user.wardId;
  if(!wardId)throw new ApiError(400,'Ward is required');
  if(!isWardAllowed(req,wardId))throw new ApiError(403,'Cross-ward access denied');
  if(req.user.roleName==='CITIZEN' && String(req.query.wardId||'') && String(req.query.wardId)!==String(req.user.wardId)){
    throw new ApiError(403,'You can only view your registered ward');
  }
  const er=await role('EMPLOYEE');
  const ward=await Ward.findByPk(wardId,{attributes:['id','wardNumber','name','status']});
  if(!ward)throw new ApiError(404,'Ward not found');
  const residentFacing=req.user.roleName==='CITIZEN';
  const employees=residentFacing?[]:await User.findAll({where:{roleId:er.id,wardId,status:'ACTIVE'},attributes:['id','name','email','mobile','wardId'],include:[{model:Employee,as:'employeeProfile',attributes:['designation','managerUserId']}] ,order:[['name','ASC']]});
  let nagarsevaks;
  if(residentFacing){
    nagarsevaks = isWardActive(ward) ? await decorateNagarsevakPhotos((await getVisibleNagarsevaks(wardId)).map(publicNagarsevak)) : [];
  }else{
    const nr=await role('NAGARSEVAK');
    const rows=await User.findAll({where:{roleId:nr.id,wardId,status:'ACTIVE'},attributes:['id','name','email','mobile','wardId','roleId'],order:[['name','ASC']]});
    nagarsevaks=await decorateNagarsevakPhotos(rows.map(publicNagarsevak));
  }
  return success(res,{data:{ward,nagarsevaks,employees,nagarsevakCount:nagarsevaks.length,employeeCount:employees.length,wardStatus:ward.status}});
});

const permissions = asyncHandler(async(req,res)=>success(res,{data:{permissions:ALL_PERMISSIONS}}));

module.exports={listCorporators,createCorporator,updateCorporator,convertCorporator,deleteCorporator,listEmployees,createEmployee,updateEmployee,deleteEmployee,listUsers,updateUser,deleteUser,listWardTeam,permissions,listSubAdmins,createSubAdmin,updateSubAdmin,resetUserPassword};
