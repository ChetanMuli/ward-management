const { Op } = require('sequelize');
const { House, Family, Person, PersonDocument, VoterProfile, Complaint, Area, Ward, User, Role } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { assertHouse, assertFamily, assertPerson, assertComplaint, getScope, allowedWardIds, isWardAllowed } = require('../services/wardScope');
const { logAudit } = require('../../services/audit.service');
const { daysTo18thBirthday, daysToNextBirthday, daysFromBirthday } = require('../../services/age.service');
const { nagarsevakPublicByIds } = require('../../utils/photo');

const familyInclude = [
  { model: Person, as: 'members', where: { status: 'ACTIVE' }, required: false, include: [{ model: VoterProfile, as: 'voterProfile' }] },
  { model: House, as: 'house', include: [{ model: Area, as: 'area', include: [{ model: Ward, as: 'ward' }] }] },
];
const personInclude = [
  {
    model: Family,
    as: 'family',
    include: [
      { model: House, as: 'house', include: [{ model: Area, as: 'area', include: [{ model: Ward, as: 'ward' }] }] },
      { model: Person, as: 'members', where: { status: 'ACTIVE' }, required: false, include: [{ model: VoterProfile, as: 'voterProfile' }] },
    ],
  },
  { model: VoterProfile, as: 'voterProfile' },
];
const personDetailInclude = [
  ...personInclude,
  { model: PersonDocument, as: 'documents' },
];

function cleanCoord(v){
  if(v===''||v==null) return null;
  const n=Number(v);
  if(!Number.isFinite(n)||Math.abs(n)<1e-4) return null;
  return n;
}

function pairCoords(lat,lng){
  const latitude=cleanCoord(lat);
  const longitude=cleanCoord(lng);
  if(latitude==null||longitude==null) return {latitude:null,longitude:null};
  return {latitude,longitude};
}

function calculateAgeSafe(dob){
  if(!dob) return 0;
  const birth=new Date(dob);
  const today=new Date();
  let age=today.getFullYear()-birth.getFullYear();
  const m=today.getMonth()-birth.getMonth();
  if(m<0 || (m===0 && today.getDate()<birth.getDate())) age--;
  return Math.max(age,0);
}

function applyPresence(target, body){
  if(!('presenceStatus' in body) && !('livingWith' in body) && !('currentCity' in body)) return target;
  const status=String(body.presenceStatus||'').toUpperCase();
  const living=String(body.livingWith||'').toUpperCase();
  target.presenceStatus=['AT_HOME','OUT_OF_CITY'].includes(status)?status:null;
  target.livingWith=['FAMILY','SELF'].includes(living)?living:null;
  const city=String(body.currentCity||'').trim();
  target.currentCity=target.presenceStatus==='OUT_OF_CITY'?(city||null):null;
  if(target.presenceStatus==='OUT_OF_CITY' && !target.currentCity){
    throw new ApiError(400,'Enter the city where this family member is staying now.');
  }
  return target;
}

function pagination(q) {
  const limit = Math.min(Number(q.limit) || 100, 500);
  const page = Math.max(Number(q.page) || 1, 1);
  return { limit, offset: (page - 1) * limit, page };
}

async function scopeAreaIds(req, requestedWardId) {
  const { areaIds: employeeAreaIds } = await getScope(req);
  const requestedAreaId=req.query.areaId||null;
  if(requestedAreaId){
    const area=await Area.findByPk(requestedAreaId,{attributes:['id','wardId']});
    if(!area) throw new ApiError(400,'Area not found');
    if(!isWardAllowed(req, area.wardId)) throw new ApiError(403,'Cross-ward area access denied');
    if(requestedWardId && area.wardId!==requestedWardId) throw new ApiError(400,'Selected colony does not belong to the selected ward');
    if(req.user.roleName==='EMPLOYEE' && employeeAreaIds && !employeeAreaIds.includes(area.id)) throw new ApiError(403,'You are not assigned to this colony');
    return {wardId:area.wardId, areaIds:[area.id]};
  }
  const allowed=allowedWardIds(req);
  if (requestedWardId) {
    if(!isWardAllowed(req, requestedWardId)) throw new ApiError(403,'You do not have access to this ward');
    const areas=await Area.findAll({where:{wardId:requestedWardId},attributes:['id']});
    let ids=areas.map(a=>a.id);
    if(req.user.roleName==='EMPLOYEE' && employeeAreaIds) ids=ids.filter(id=>employeeAreaIds.includes(id));
    return {wardId:requestedWardId,areaIds:ids};
  }
  if (allowed===null) return { wardId:null, areaIds:null };
  const areas=await Area.findAll({where:{wardId:{[Op.in]:allowed.length?allowed:['00000000-0000-0000-0000-000000000000']}},attributes:['id']});
  let ids=areas.map(a=>a.id);
  if(req.user.roleName==='EMPLOYEE' && employeeAreaIds) ids=ids.filter(id=>employeeAreaIds.includes(id));
  return {wardId:allowed.length===1?allowed[0]:null,areaIds:ids};
}

async function familyIdsForAreas(areaIds) {
  if (!areaIds) return null;
  const houses = await House.findAll({ where: { areaId: { [Op.in]: areaIds.length ? areaIds : ['00000000-0000-0000-0000-000000000000'] } }, attributes: ['id'] });
  const houseIds = houses.map(h => h.id);
  if (!houseIds.length) return [];
  const families = await Family.findAll({ where: { houseId: { [Op.in]: houseIds } }, attributes: ['id'] });
  return families.map(f => f.id);
}

async function houseWhere(req, extra = {}) {
  const { areaIds } = await scopeAreaIds(req, req.query.wardId);
  const where = { ...extra };
  if (areaIds) where.areaId = { [Op.in]: areaIds.length ? areaIds : ['00000000-0000-0000-0000-000000000000'] };
  return where;
}

async function assertRequestedWard(req, wardId) {
  if (!wardId) return;
  const ward = await Ward.findByPk(wardId);
  if (!ward) throw new ApiError(400, 'Ward not found');
  if (!isWardAllowed(req, wardId)) {
    throw new ApiError(403, 'Cross-ward access denied');
  }
}

const houses = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  await assertRequestedWard(req, req.query.wardId);
  const where = await houseWhere(req);
  for (const k of ['ownership', 'houseType', 'status', 'areaId']) if (req.query[k]) where[k] = req.query[k];
  if (req.query.search) {
    where[Op.or] = [
      { houseNumber: { [Op.like]: `%${req.query.search}%` } },
      { address: { [Op.like]: `%${req.query.search}%` } },
      { ownerName: { [Op.like]: `%${req.query.search}%` } },
      { ownerMobile: { [Op.like]: `%${req.query.search}%` } },
      { city: { [Op.like]: `%${req.query.search}%` } },
      { pincode: { [Op.like]: `%${req.query.search}%` } },
      { landmark: { [Op.like]: `%${req.query.search}%` } },
    ];
  }
  const r = await House.findAndCountAll({
    where,
    include: [{ model: Area, as: 'area', include: [{ model: Ward, as: 'ward' }] }],
    limit, offset, order: [['createdAt', 'DESC']], distinct: true,
  });
  return success(res, { data: r.rows, meta: { total: r.count, page, limit } });
});

const house = asyncHandler(async (req, res) => success(res, { data: await assertHouse(req.params.id, req) }));

const families = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  await assertRequestedWard(req, req.query.wardId);
  const { areaIds } = await scopeAreaIds(req, req.query.wardId);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.familyName) where.familyName = { [Op.like]: `%${req.query.familyName}%` };
  if (req.query.search) where[Op.or] = [
    { familyName: { [Op.like]: `%${req.query.search}%` } },
    { '$house.houseNumber$': { [Op.like]: `%${req.query.search}%` } },
    { '$house.address$': { [Op.like]: `%${req.query.search}%` } },
  ];
  const include = [...familyInclude];
  if (areaIds) {
    include[1] = { ...include[1], where: { areaId: { [Op.in]: areaIds.length ? areaIds : ['00000000-0000-0000-0000-000000000000'] } }, required: true };
  }
  const r = await Family.findAndCountAll({ where, include, limit, offset, distinct: true, order: [['createdAt', 'DESC'], ['familyName', 'ASC']] });
  return success(res, { data: r.rows, meta: { total: r.count, page, limit } });
});
const family = asyncHandler(async (req, res) => { const row = await assertFamily(req.params.id, req); const full = await Family.findByPk(row.id, { include: familyInclude }); return success(res, { data: full }); });

const persons = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  await assertRequestedWard(req, req.query.wardId);
  const { areaIds } = await scopeAreaIds(req, req.query.wardId);
  const where = { status: req.query.status || 'ACTIVE' };
  if (req.query.familyId) where.familyId = req.query.familyId;
  if (req.query.search) {
    const search=String(req.query.search).trim();
    where[Op.or] = [
      { fullName: { [Op.like]: `%${search}%` } },
      { mobile: { [Op.like]: `%${search}%` } },
      { alternateMobile: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { occupation: { [Op.like]: `%${search}%` } },
      { occupationType: { [Op.like]: `%${search}%` } },
      { businessName: { [Op.like]: `%${search}%` } },
      { businessAddress: { [Op.like]: `%${search}%` } },
      { companyName: { [Op.like]: `%${search}%` } },
      { employmentType: { [Op.like]: `%${search}%` } },
      { relationshipToHead: { [Op.like]: `%${search}%` } },
      { presenceStatus: { [Op.like]: `%${search}%` } },
      { currentCity: { [Op.like]: `%${search}%` } },
      { livingWith: { [Op.like]: `%${search}%` } },
      { followupStatus: { [Op.like]: `%${search}%` } },
      { gender: { [Op.like]: `%${search}%` } },
      { notes: { [Op.like]: `%${search}%` } },
    ];
  }
  const include = [...personInclude];
  if (req.query.voterStatus) {
    const status=String(req.query.voterStatus).toUpperCase();
    if (!['VOTER','NON_VOTER','NOT_SPECIFIED'].includes(status)) throw new ApiError(400,'Invalid voter status');
    include[1] = { ...include[1], where:{status}, required:true };
  }
  if (areaIds) {
    const familyIds = await familyIdsForAreas(areaIds);
    where.familyId = { [Op.in]: familyIds.length ? familyIds : ['00000000-0000-0000-0000-000000000000'] };
  }
  const r = await Person.findAndCountAll({ where, include, limit, offset, distinct: true, order: [['fullName', 'ASC']] });
  return success(res, { data: r.rows, meta: { total: r.count, page, limit } });
});
const person = asyncHandler(async (req, res) => {
  const p = await assertPerson(req.params.id, req);
  const full = await Person.findByPk(p.id, { include: personDetailInclude });
  return success(res, { data: full });
});

const voters = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  await assertRequestedWard(req, req.query.wardId);
  const { areaIds } = await scopeAreaIds(req, req.query.wardId);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  const search=String(req.query.search||'').trim();
  if(search) where[Op.or]=[
    {status:{[Op.like]:`%${search}%`}},
    {votingWard:{[Op.like]:`%${search}%`}},
    {officialVoterIdRef:{[Op.like]:`%${search}%`}},
    {notes:{[Op.like]:`%${search}%`}},
    {'$Person.fullName$':{[Op.like]:`%${search}%`}},
    {'$Person.mobile$':{[Op.like]:`%${search}%`}},
    {'$Person.alternateMobile$':{[Op.like]:`%${search}%`}},
    {'$Person.occupation$':{[Op.like]:`%${search}%`}},
    {'$Person.occupationType$':{[Op.like]:`%${search}%`}},
    {'$Person.businessName$':{[Op.like]:`%${search}%`}},
    {'$Person.companyName$':{[Op.like]:`%${search}%`}},
  ];
  const include = [{ model: Person, as: 'Person', where:{status:'ACTIVE'}, required:true, include: [{ model: Family, as: 'family', include: [{ model: House, as: 'house', include: [{ model: Area, as: 'area', include: [{ model: Ward, as: 'ward' }] }] }] }] }];
  if (areaIds) {
    const familyIds = await familyIdsForAreas(areaIds);
    const families = familyIds.length ? await Family.findAll({ where:{id:{[Op.in]:familyIds}}, attributes:['id'] }) : [];
    const ids = families.map(f=>f.id);
    const personsInWard = ids.length ? await Person.findAll({ where:{familyId:{[Op.in]:ids}}, attributes:['id'] }) : [];
    where.personId = { [Op.in]: personsInWard.length ? personsInWard.map(p=>p.id) : ['00000000-0000-0000-0000-000000000000'] };
  }
  const r = await VoterProfile.findAndCountAll({ where, include, limit, offset, distinct: true });
  return success(res, { data: r.rows, meta: { total: r.count, page, limit } });
});

const complaints = asyncHandler(async (req, res) => {
  const { limit, offset, page } = pagination(req.query);
  await assertRequestedWard(req, req.query.wardId);
  const { areaIds } = await scopeAreaIds(req, req.query.wardId);
  const where = {};
  for (const k of ['status', 'priority', 'category', 'assignedEmployeeId']) if (req.query[k]) where[k] = req.query[k];

  // Employees can never broaden their complaint scope.
  if(req.user.roleName==='EMPLOYEE'){
    if(!req.user.employeeProfile?.id) throw new ApiError(403,'Employee profile is missing');
    where.assignedEmployeeId=req.user.employeeProfile.id;
  }

  // Date/time filters are applied to the server-side createdAt field.
  const hasFrom=req.query.fromDate||req.query.fromTime;
  const hasTo=req.query.toDate||req.query.toTime;
  if(hasFrom||hasTo){
    const from=`${req.query.fromDate||'1970-01-01'}T${req.query.fromTime||'00:00'}:00`;
    const to=`${req.query.toDate||'2999-12-31'}T${req.query.toTime||'23:59'}:59`;
    where.createdAt={[Op.gte]:new Date(from),[Op.lte]:new Date(to)};
  }

  const search=String(req.query.search||'').trim();
  if(search){
    where[Op.or]=[
      { complaintNumber:{[Op.like]:`%${search}%`} },
      { description:{[Op.like]:`%${search}%`} },
      { '$citizen.fullName$':{[Op.like]:`%${search}%`} },
      { '$citizen.mobile$':{[Op.like]:`%${search}%`} },
    ];
  }

  const include = [
    { model: Person, as: 'citizen', include: [{ model: Family, as: 'family', include: [{ model: House, as: 'house' }] }] },
    { model: House, as: 'house', include: [{ model: Area, as: 'area', include: [{ model: Ward, as: 'ward' }] }] },
    { model: require('../../models').Employee, as: 'assignedEmployee', include: [{ model: require('../../models').User, as: 'manager', attributes: ['id', 'name', 'email', 'mobile'] }, { model: require('../../models').User, as: 'User', attributes: ['id', 'name', 'email', 'mobile'] }] },
  ];
  if (areaIds) include[1] = { ...include[1], where: { areaId: { [Op.in]: areaIds.length ? areaIds : ['00000000-0000-0000-0000-000000000000'] } }, required: true };
  const r = await Complaint.findAndCountAll({ where, include, limit, offset, order: [['createdAt', 'DESC']], distinct: true, subQuery:false });
  return success(res, { data: r.rows, meta: { total: r.count, page, limit } });
});
const complaint = asyncHandler(async (req, res) => success(res, { data: await assertComplaint(req.params.id, req) }));

const upcoming18 = asyncHandler(async (req, res) => {
  const rawDays = Number(req.query.days);
  const days = Number.isFinite(rawDays) ? Math.max(rawDays, 0) : 90;
  const fromDays = Number.isFinite(Number(req.query.fromDays)) ? Number(req.query.fromDays) : 0;
  await assertRequestedWard(req, req.query.wardId);
  const { areaIds } = await scopeAreaIds(req, req.query.wardId);
  const where = { status: 'ACTIVE' };
  const include = [...personInclude];
  if (areaIds) { const familyIds = await familyIdsForAreas(areaIds); where.familyId = { [Op.in]: familyIds.length ? familyIds : ['00000000-0000-0000-0000-000000000000'] }; }
  const rows = await Person.findAll({ where, include });
  const data = rows.filter(p => p.dob).map(p => ({ person: p, daysTo18: daysTo18thBirthday(p.dob) }))
    .filter(x => x.daysTo18 !== null && x.daysTo18 >= fromDays && x.daysTo18 <= days)
    .sort((a, b) => a.daysTo18 - b.daysTo18);
  return success(res, { data });
});
const birthdays = asyncHandler(async (req, res) => {
  const days = Math.max(Number(req.query.days) || 30, 1);
  const fromDays = Number.isFinite(Number(req.query.fromDays)) ? Number(req.query.fromDays) : 0;
  await assertRequestedWard(req, req.query.wardId);
  const { areaIds } = await scopeAreaIds(req, req.query.wardId);
  const where = { status: 'ACTIVE' };
  const include = [...personInclude];
  if (areaIds) { const familyIds = await familyIdsForAreas(areaIds); where.familyId = { [Op.in]: familyIds.length ? familyIds : ['00000000-0000-0000-0000-000000000000'] }; }
  const rows = await Person.findAll({ where, include });
  const nr=await Role.findOne({where:{name:'NAGARSEVAK'}});
  const councillorRows=nr?await User.findAll({where:{roleId:nr.id,status:'ACTIVE'},attributes:['id','name','mobile','wardId','roleId']}):[];
  const nagarPhotos=await nagarsevakPublicByIds(councillorRows.map(u=>u.id));
  const councillorByWard=new Map(councillorRows.map(u=>[u.wardId,u]));
  const data = rows.filter(p => p.dob).map(p => {
    const wardId=p.family?.house?.area?.wardId || p.family?.house?.area?.ward?.id;
    const n=councillorByWard.get(wardId);
    const extra=n?nagarPhotos.get(String(n.id)):null;
    return { person:p, nagarsevak:n?{id:n.id,name:n.name,mobile:n.mobile,partyName:extra?.partyName||n.partyName||n.getDataValue?.('partyName')||null,wardSeat:extra?.wardSeat||n.wardSeat||n.getDataValue?.('wardSeat')||null,photo:extra?.photo||n.getDataValue?.('photo')||n.photo||null}:null, daysToBirthday:daysFromBirthday(p.dob) };
  }).filter(x => x.daysToBirthday >= fromDays && x.daysToBirthday <= (fromDays + days - 1)).sort((a,b)=>a.daysToBirthday-b.daysToBirthday);
  return success(res, { data });
});

const updatePerson = asyncHandler(async (req, res) => {
  const p = await assertPerson(req.params.id, req);
  const allowed = ['fullName','gender','dob','mobile','alternateMobile','email','occupation','occupationType','businessName','businessAddress','companyName','employmentType','followupStatus','followupDate','followupNotes','status','notes','voterIdImage','aadhaarImage','panCardImage','presenceStatus','currentCity','livingWith'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
  applyPresence(patch, req.body);

  if ('fullName' in patch) patch.fullName = String(patch.fullName || '').trim() || 'N/A';
  if ('gender' in patch) patch.gender = patch.gender || 'NOT_SPECIFIED';
  if ('dob' in patch && patch.dob === '') patch.dob = null;
  if ('occupationType' in patch) patch.occupationType = patch.occupationType || 'OTHER';
  for(const k of ['email','alternateMobile','notes']) if(patch[k]==='') patch[k]=null;
  if(patch.mobile==='') patch.mobile=null;
  if(patch.mobile && patch.mobile!=='N/A' && !/^\d{10}$/.test(String(patch.mobile))) throw new ApiError(400,'Mobile must be exactly 10 digits or N/A');
  if(patch.alternateMobile && patch.alternateMobile!=='N/A' && !/^\d{10}$/.test(String(patch.alternateMobile))) throw new ApiError(400,'Alternate mobile must be exactly 10 digits or N/A');
  if(patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(patch.email))) throw new ApiError(400,'Please enter a valid email or leave it blank');

  if(patch.occupationType==='BUSINESS'){
    patch.occupation='BUSINESS';
    patch.businessName=(patch.businessName||'').trim()||'N/A';
    patch.businessAddress=(patch.businessAddress||'').trim()||'N/A';
    patch.companyName=null; patch.employmentType=null;
  } else if(patch.occupationType==='SERVICE'){
    patch.occupation='SERVICE';
    patch.companyName=(patch.companyName||'').trim()||'N/A';
    patch.employmentType=['PRIVATE','GOVERNMENT'].includes(patch.employmentType)?patch.employmentType:null;
    patch.businessName=null; patch.businessAddress=null;
  } else if(patch.occupationType==='OTHER'){
    patch.businessName=null; patch.businessAddress=null; patch.companyName=null; patch.employmentType=null;
    patch.occupation=patch.occupation||'OTHER';
  }

  await p.update(patch);
  let voter=await VoterProfile.findOne({where:{personId:p.id}});
  const age=calculateAgeSafe(p.dob);
  if(!voter) voter=await VoterProfile.create({personId:p.id,status:age<18&&p.dob?'NON_VOTER':'NOT_SPECIFIED'});
  if(age<18 && p.dob){
    await voter.update({status:'NON_VOTER',officialVoterIdRef:null,votingWard:null,constituency:null});
  } else if('isVoter' in req.body){
    if(!['VOTER','NON_VOTER'].includes(req.body.isVoter)) throw new ApiError(400,'Please select Voter or Non-Voter');
    await voter.update({status:req.body.isVoter,officialVoterIdRef:req.body.isVoter==='VOTER'?(req.body.officialVoterIdRef||null):null,votingWard:req.body.isVoter==='VOTER'?(req.body.votingWard||null):null,constituency:req.body.isVoter==='VOTER'?(req.body.constituency||null):null});
  } else if('officialVoterIdRef' in req.body || 'votingWard' in req.body || 'constituency' in req.body){
    await voter.update({officialVoterIdRef:req.body.officialVoterIdRef||null,votingWard:req.body.votingWard||null,constituency:req.body.constituency||null});
  }
  await logAudit({user:req.user,action:'UPDATE_CITIZEN',entity:'Person',recordId:p.id,oldValue:p.toJSON(),newValue:req.body,ipAddress:req.ip});
  const full=await Person.findByPk(p.id,{include:personDetailInclude});
  return success(res, { data: full, message: 'Citizen updated' });
});
const updateVoter = asyncHandler(async (req, res) => {
  const p = await assertPerson(req.params.personId, req);
  let voter = await VoterProfile.findOne({ where: { personId: p.id } });
  if (!voter) voter = await VoterProfile.create({ personId: p.id, status: 'NOT_SPECIFIED' });
  const age = calculateAgeSafe(p.dob);
  const requested = req.body.status || 'NOT_SPECIFIED';
  if (!['VOTER','NON_VOTER','NOT_SPECIFIED'].includes(requested)) throw new ApiError(400,'Voter status must be Voter, Non-Voter or Not specified');
  const status = (p.dob && age < 18) ? 'NON_VOTER' : requested;
  await voter.update({
    status,
    officialVoterIdRef: status==='VOTER' ? (req.body.officialVoterIdRef||null) : null,
    votingWard: status==='VOTER' ? (req.body.votingWard||null) : null,
    constituency: status==='VOTER' ? (req.body.constituency||null) : null,
    voterCenter: status==='VOTER' ? (req.body.voterCenter||null) : null,
    voterRoom: status==='VOTER' ? (req.body.voterRoom||null) : null,
    notes: req.body.notes||null
  });
  return success(res, { data: voter, message: 'Voter status updated' });
});

const createHouse = asyncHandler(async (req, res) => {
  const { areaId } = req.body;

  if (!areaId) {
    throw new ApiError(400, 'Area is required');
  }

  const area = await Area.findByPk(areaId);

  if (!area) {
    throw new ApiError(400, 'Area not found');
  }

  if (
    req.user.roleName !== 'SUPER_ADMIN' &&
    area.wardId !== req.user.wardId
  ) {
    throw new ApiError(403, 'Area belongs to another ward');
  }

  const payload = { ...req.body };

  const geo=pairCoords(payload.latitude,payload.longitude);
  payload.latitude=geo.latitude;
  payload.longitude=geo.longitude;

  // Owner information is optional
  payload.ownerName =
    payload.ownerName === '' ? null : payload.ownerName;

  payload.ownerMobile =
    payload.ownerMobile === '' ? null : payload.ownerMobile;

  payload.city = payload.city === '' ? null : payload.city;
  payload.pincode = payload.pincode === '' ? null : payload.pincode;

  // Remove accidental undefined values
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  const row = await House.create(payload);

  await logAudit({
    user: req.user,
    action: 'CREATE_HOUSE',
    entity: 'House',
    recordId: row.id,
    newValue: payload,
    ipAddress: req.ip
  });

  return success(res, {
    statusCode: 201,
    data: row,
    message: 'House created successfully'
  });
});

const updateHouse = asyncHandler(async (req,res) => { const row=await assertHouse(req.params.id,req); const patch={...req.body}; for(const k of ['ownerName','ownerMobile','landmark','notes','city','pincode']) if(patch[k]==='') patch[k]=null; if('latitude' in patch || 'longitude' in patch){ const geo=pairCoords(patch.latitude ?? row.latitude, patch.longitude ?? row.longitude); patch.latitude=geo.latitude; patch.longitude=geo.longitude; } if(patch.areaId){const area=await Area.findByPk(req.body.areaId);if(!area)throw new ApiError(400,'Area not found');if(req.user.roleName!=='SUPER_ADMIN'&&area.wardId!==req.user.wardId)throw new ApiError(403,'Area belongs to another ward');} const old=row.toJSON(); await row.update(patch); await logAudit({user:req.user,action:'UPDATE_HOUSE',entity:'House',recordId:row.id,oldValue:old,newValue:patch,ipAddress:req.ip}); return success(res,{data:row,message:'House updated'}); });
const deleteHouse = asyncHandler(async(req,res)=>{const row=await assertHouse(req.params.id,req);await row.destroy();await logAudit({user:req.user,action:'SOFT_DELETE_HOUSE',entity:'House',recordId:row.id,newValue:{deleted:true},ipAddress:req.ip});return success(res,{message:'House moved to recycle bin'});});
const createFamily = asyncHandler(async(req,res)=>{await assertHouse(req.body.houseId,req);const row=await Family.create(req.body);await logAudit({user:req.user,action:'CREATE_FAMILY',entity:'Family',recordId:row.id,newValue:req.body,ipAddress:req.ip});return success(res,{statusCode:201,data:row,message:'Family created'});});
const updateFamily = asyncHandler(async(req,res)=>{const row=await assertFamily(req.params.id,req);if(req.body.houseId)await assertHouse(req.body.houseId,req);const old=row.toJSON();await row.update(req.body);await logAudit({user:req.user,action:'UPDATE_FAMILY',entity:'Family',recordId:row.id,oldValue:old,newValue:req.body,ipAddress:req.ip});return success(res,{data:row,message:'Family updated'});});
const deleteFamily = asyncHandler(async(req,res)=>{const row=await assertFamily(req.params.id,req);await row.destroy();await logAudit({user:req.user,action:'SOFT_DELETE_FAMILY',entity:'Family',recordId:row.id,newValue:{deleted:true},ipAddress:req.ip});return success(res,{message:'Family moved to recycle bin'});});
const createPerson = asyncHandler(async(req,res)=>{
  await assertFamily(req.body.familyId,req);
  const allowed=['familyId','fullName','gender','dob','mobile','alternateMobile','email','occupation','occupationType','businessName','businessAddress','companyName','employmentType','notes','voterIdImage','aadhaarImage','panCardImage','followupStatus','followupDate','followupNotes','presenceStatus','currentCity','livingWith'];
  const payload={};
  for(const k of allowed) if(k in req.body) payload[k]=req.body[k];
  applyPresence(payload, req.body);

  // Only the family link is structurally required. Unknown personal information
  // can be left blank or recorded as N/A without creating fake defaults.
  payload.fullName=(payload.fullName||'').trim()||'N/A';
  payload.gender=payload.gender||'NOT_SPECIFIED';
  payload.occupationType=payload.occupationType||'OTHER';
  if(payload.mobile==='') payload.mobile=null;
  if(payload.mobile && payload.mobile!=='N/A' && !/^\d{10}$/.test(String(payload.mobile))) throw new ApiError(400,'Mobile must be exactly 10 digits or N/A');
  if(payload.alternateMobile==='') payload.alternateMobile=null;
  if(payload.alternateMobile && payload.alternateMobile!=='N/A' && !/^\d{10}$/.test(String(payload.alternateMobile))) throw new ApiError(400,'Alternate mobile must be exactly 10 digits or N/A');
  for(const k of ['email','notes','dob']) if(payload[k]==='') payload[k]=null;
  if(payload.email) { const ok=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email)); if(!ok) throw new ApiError(400,'Please enter a valid email or leave it blank'); }

  if(payload.occupationType==='BUSINESS'){
    payload.occupation='BUSINESS';
    payload.businessName=(payload.businessName||'').trim()||'N/A';
    payload.businessAddress=(payload.businessAddress||'').trim()||'N/A';
    payload.companyName=null; payload.employmentType=null;
  } else if(payload.occupationType==='SERVICE'){
    payload.occupation='SERVICE';
    payload.companyName=(payload.companyName||'').trim()||'N/A';
    payload.employmentType=['PRIVATE','GOVERNMENT'].includes(payload.employmentType)?payload.employmentType:null;
    payload.businessName=null; payload.businessAddress=null;
  } else {
    payload.businessName=null; payload.businessAddress=null; payload.companyName=null; payload.employmentType=null;
  }

  const age=calculateAgeSafe(payload.dob);
  let voterStatus='NOT_SPECIFIED';
  if(age<18 && payload.dob) voterStatus='NON_VOTER';
  else if(age>=18 && ['VOTER','NON_VOTER'].includes(req.body.isVoter)) voterStatus=req.body.isVoter;
  payload.status='ACTIVE';

  const row=await Person.create(payload);
  await VoterProfile.create({
    personId:row.id,
    status:voterStatus,
    officialVoterIdRef:voterStatus==='VOTER'?(req.body.officialVoterIdRef||null):null,
    votingWard:voterStatus==='VOTER'?(req.body.votingWard||null):null,
    constituency:voterStatus==='VOTER'?(req.body.constituency||null):null
  });
  await logAudit({user:req.user,action:'CREATE_CITIZEN',entity:'Person',recordId:row.id,newValue:req.body,ipAddress:req.ip});
  const full=await Person.findByPk(row.id,{include:personDetailInclude});
  return success(res,{statusCode:201,data:full,message:'Citizen created and added to family registers'});
});
const deletePerson = asyncHandler(async(req,res)=>{const row=await assertPerson(req.params.id,req);await row.destroy();await logAudit({user:req.user,action:'SOFT_DELETE_CITIZEN',entity:'Person',recordId:row.id,newValue:{deleted:true},ipAddress:req.ip});return success(res,{message:'Citizen moved to recycle bin'});});
const deleteComplaint = asyncHandler(async(req,res)=>{const row=await assertComplaint(req.params.id,req);await row.destroy();await logAudit({user:req.user,action:'SOFT_DELETE_COMPLAINT',entity:'Complaint',recordId:row.id,newValue:{deleted:true},ipAddress:req.ip});return success(res,{message:'Complaint moved to recycle bin'});});

module.exports={houses,house,createHouse,updateHouse,deleteHouse,families,family,createFamily,updateFamily,deleteFamily,persons,person,createPerson,updatePerson,deletePerson,voters,updateVoter,complaints,complaint,deleteComplaint,upcoming18,birthdays};
