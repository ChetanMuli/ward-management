const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { Complaint, ComplaintHistory, House, Area, Ward, Employee, User, Role, Person, Family } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { logAudit } = require('../../services/audit.service');
const { assertComplaint, isWardAllowed } = require('../services/wardScope');

const SLA_HOURS = { CRITICAL:24, HIGH:48, MEDIUM:72, LOW:168 };
const STATUSES = ['SUBMITTED','PENDING','ASSIGNED','IN_PROGRESS','RESOLVED','REOPENED','CLOSED'];
function wardCode(wardNumber){ return String(wardNumber||'WARD').trim().replace(/[^A-Za-z0-9]+/g,'').toUpperCase() || 'WARD'; }
function complaintNo(wardNumber){ const d=new Date(); const stamp=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0'),String(d.getHours()).padStart(2,'0'),String(d.getMinutes()).padStart(2,'0')].join(''); return `CMP-${wardCode(wardNumber)}-${stamp}-${uuidv4().slice(0,6).toUpperCase()}`; }
async function complaintWithContext(id){
  return Complaint.findByPk(id,{include:[
    {model:Person,as:'citizen',include:[{model:Family,as:'family',include:[{model:House,as:'house',include:[{model:Area,as:'area',include:[{model:Ward,as:'ward'}]}]}]}]},
    {model:House,as:'house',include:[{model:Area,as:'area',include:[{model:Ward,as:'ward'}]}]},
    {model:Employee,as:'assignedEmployee',include:[{model:User,as:'User',attributes:['id','name','email','mobile','wardId']},{model:User,as:'manager',attributes:['id','name','email','mobile','wardId']}]},
    {model:User,as:'submittedBy',attributes:['id','name','email','mobile','wardId']},
    {model:Ward,as:'ward',attributes:['id','wardNumber','name']},
    {model:User,as:'assignedNagarsevak',attributes:['id','name','email','mobile','wardId']},
    {model:ComplaintHistory,as:'history',include:[{model:User,as:'changedBy',attributes:['id','name','mobile']}]},
  ]});
}
async function notify(userId,type,title,message,channel='IN_APP',senderUserId=null,actionUrl=null){
  const { notifyUser } = require('../../services/notify.service');
  await notifyUser({ userId, type, title, message, senderUserId, actionUrl, channel });
}
function prettyStatus(status){
  return String(status||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
}
function cleanImage(value){
  if(value==null||value==='')return null;
  if(typeof value!=='string'||value.length>1500000) throw new ApiError(400,'Image is too large. Please upload a smaller image (max about 1.5 MB).');
  if(!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(value)) throw new ApiError(400,'Only JPG, PNG or WEBP images are supported.');
  return value;
}

const list = asyncHandler(async(req,res)=>{
  const page=Math.max(Number(req.query.page)||1,1);
  const limit=Math.min(Math.max(Number(req.query.limit)||25,1),100);
  const offset=(page-1)*limit;
  const where={};
  for(const k of ['status','priority','category','assignedEmployeeId','assignedNagarsevakUserId']) if(req.query[k]) where[k]=req.query[k];

  if(req.user.roleName==='CITIZEN'){
    where.submittedByUserId=req.user.id;
  } else if(req.user.roleName==='EMPLOYEE'){
    if(!req.user.employeeProfile?.id) throw new ApiError(403,'Employee profile is missing');
    where.assignedEmployeeId=req.user.employeeProfile.id;
  }

  const allowed=await (async()=>{ const {allowedWardIds}=require('../services/wardScope'); return allowedWardIds(req); })();
  const requestedWardId=req.query.wardId||null;
  if(requestedWardId&&!isWardAllowed(req,requestedWardId)) throw new ApiError(403,'Complaint belongs to another ward');
  if(req.user.roleName==='CITIZEN' && requestedWardId && requestedWardId!==req.user.wardId) throw new ApiError(403,'Complaint belongs to another ward');

  if(req.user.roleName!=='CITIZEN'){
    const scopeWardIds=requestedWardId?[requestedWardId]:allowed;
    if(scopeWardIds!==null){
      const ids=scopeWardIds.length?scopeWardIds:['00000000-0000-0000-0000-000000000000'];
      where[Op.or]=[{wardId:{[Op.in]:ids}},{'$house.area.ward.id$':{[Op.in]:ids}}];
    }
  }

  const search=String(req.query.search||'').trim();
  if(search){
    const searchOr=[
      {complaintNumber:{[Op.like]:`%${search}%`}},{description:{[Op.like]:`%${search}%`}},{location:{[Op.like]:`%${search}%`}},
      {'$citizen.fullName$':{[Op.like]:`%${search}%`}},{'$citizen.mobile$':{[Op.like]:`%${search}%`}},
      {'$submittedBy.name$':{[Op.like]:`%${search}%`}},{'$submittedBy.mobile$':{[Op.like]:`%${search}%`}},
      {'$assignedEmployee.User.name$':{[Op.like]:`%${search}%`}},{'$assignedNagarsevak.name$':{[Op.like]:`%${search}%`}}
    ];
    where[Op.and]=[...(where[Op.and]||[]),{[Op.or]:searchOr}];
  }

  const include=[
    {model:House,as:'house',required:false,include:[{model:Area,as:'area',required:false,include:[{model:Ward,as:'ward',required:false}]}]},
    {model:Employee,as:'assignedEmployee',required:false,include:[{model:User,as:'User',attributes:['id','name','mobile']},{model:User,as:'manager',attributes:['id','name','mobile']}]},
    {model:Person,as:'citizen',required:false,attributes:['id','fullName','mobile']},
    {model:User,as:'submittedBy',required:false,attributes:['id','name','email','mobile','wardId']},
    {model:Ward,as:'ward',required:false,attributes:['id','wardNumber','name']},
    {model:User,as:'assignedNagarsevak',required:false,attributes:['id','name','email','mobile','wardId']},
  ];

  const r=await Complaint.findAndCountAll({where,include,order:[['createdAt','DESC']],limit,offset,distinct:true,subQuery:false});
  return success(res,{data:r.rows,meta:{total:r.count,page,limit,pages:Math.max(1,Math.ceil(r.count/limit))}});
});

const MANAGEMENT_ROLES=['SUPER_ADMIN','SUB_MASTER_ADMIN','NAGARSEVAK'];
const canManageComplaint = role => MANAGEMENT_ROLES.includes(role);

async function notifyComplaintCitizen(complaint, type, title, message, senderUserId) {
  const recipients=new Set();
  if(complaint.submittedByUserId) recipients.add(complaint.submittedByUserId);
  if(complaint.citizenPersonId){
    const linked=await User.findOne({where:{personId:complaint.citizenPersonId,status:'ACTIVE'},attributes:['id']});
    if(linked?.id) recipients.add(linked.id);
  }
  if(!complaint.submittedByUserId && complaint.citizenPersonId){
    const citizen=await Person.findByPk(complaint.citizenPersonId,{include:[{model:User,as:'loginAccount',attributes:['id','status']}]});
    if(citizen?.loginAccount?.status==='ACTIVE') recipients.add(citizen.loginAccount.id);
  }
  for(const userId of recipients){
    await notify(userId,type,title,message,'IN_APP',senderUserId,`/my-complaints?open=${complaint.id}`);
  }
}

const create = asyncHandler(async(req,res)=>{
  const {houseId,category,description,priority='MEDIUM',citizenPersonId,assignedNagarsevakUserId,location}=req.body;
  const reportedImage=cleanImage(req.body.reportedImage);

  if(req.user.roleName==='CITIZEN'){
    const wardId=req.user.wardId;
    if(!wardId) throw new ApiError(400,'Your account is not assigned to a ward');
    if(!category || !STATUSES.includes('SUBMITTED')) throw new ApiError(400,'Complaint category is required');
    if(!String(description||'').trim()) throw new ApiError(400,'Complaint description is required');

    let nagarsevak=null;
    const { isNagarsevakVisibleInWard, getVisibleNagarsevaks } = require('../../services/wardActivation.service');
    if(assignedNagarsevakUserId){
      const visible=await isNagarsevakVisibleInWard(wardId, assignedNagarsevakUserId);
      if(!visible) throw new ApiError(400,'Please select an active purchased Nagarsevak from your ward');
      const nr=await Role.findOne({where:{name:'NAGARSEVAK'}});
      nagarsevak=nr?await User.findOne({where:{id:assignedNagarsevakUserId,roleId:nr.id,wardId,status:'ACTIVE'}}):null;
      if(!nagarsevak) throw new ApiError(400,'Please select an active Nagarsevak from your ward');
    } else {
      const visible=await getVisibleNagarsevaks(wardId);
      nagarsevak=visible[0]||null;
    }

    const ward=await Ward.findByPk(wardId,{attributes:['id','wardNumber','name']});
    const complaint=await Complaint.create({
      complaintNumber:complaintNo(ward?.wardNumber),submittedByUserId:req.user.id,wardId,citizenPersonId:null,houseId:null,
      assignedNagarsevakUserId:nagarsevak?.id||null,category,description:String(description).trim(),location:String(location||'').trim()||null,
      priority,status:'SUBMITTED',slaDueAt:new Date(Date.now()+(SLA_HOURS[priority]||72)*3600000),reportedImage
    });
    await ComplaintHistory.create({complaintId:complaint.id,newStatus:'SUBMITTED',changedByUserId:req.user.id,comment:'Complaint submitted by registered ward user'});
    const { notifyMastersAndWardStaff } = require('../../services/notify.service');
    await notifyMastersAndWardStaff(wardId, {
      senderUserId: req.user.id,
      type: 'COMPLAINT_NEW',
      title: 'New ward complaint',
      message: `${complaint.complaintNumber} was submitted in ${ward?.wardNumber || 'a ward'}.`,
      actionUrl: `/complaints?open=${complaint.id}`,
    });
    await logAudit({user:req.user,action:'CREATE_COMPLAINT',entity:'Complaint',recordId:complaint.id,newValue:{...req.body,submittedByUserId:req.user.id,wardId,reportedImage:reportedImage?'[image]':null},ipAddress:req.ip});
    return success(res,{statusCode:201,data:await complaintWithContext(complaint.id),message:'Complaint submitted successfully'});
  }

  const house=await House.findByPk(houseId,{include:[{model:Area,as:'area'}]});
  if(!house)throw new ApiError(400,'Referenced house does not exist');
  const wardId=house.area?.wardId;
  if(!isWardAllowed(req,wardId))throw new ApiError(403,'Complaint belongs to another ward');
  const citizenId=citizenPersonId;
  if(!citizenId)throw new ApiError(400,'citizenPersonId is required');
  const citizen=await Person.findByPk(citizenId,{include:[{model:Family,as:'family',include:[{model:House,as:'house'}]}]});
  if(!citizen)throw new ApiError(400,'Citizen not found');
  if(citizen.family?.house?.id!==house.id)throw new ApiError(400,'Selected citizen does not belong to the selected house');
  let nagarsevak=null;
  if(assignedNagarsevakUserId){
    const nr=await Role.findOne({where:{name:'NAGARSEVAK'}});
    nagarsevak=nr?await User.findOne({where:{id:assignedNagarsevakUserId,roleId:nr.id,wardId,status:'ACTIVE'}}):null;
    if(!nagarsevak) throw new ApiError(400,'Selected Nagarsevak is not active in this ward');
  }
  const ward=await Ward.findByPk(wardId,{attributes:['id','wardNumber','name']});
  const complaint=await Complaint.create({complaintNumber:complaintNo(ward?.wardNumber),citizenPersonId:citizenId,houseId,wardId,assignedNagarsevakUserId:nagarsevak?.id||null,category,description,location:String(location||'').trim()||null,priority,status:'SUBMITTED',slaDueAt:new Date(Date.now()+(SLA_HOURS[priority]||72)*3600000),reportedImage});
  await ComplaintHistory.create({complaintId:complaint.id,newStatus:'SUBMITTED',changedByUserId:req.user.id,comment:'Complaint created'});
  await notifyComplaintCitizen(complaint,'COMPLAINT_NEW','A complaint was registered',`${complaint.complaintNumber} has been submitted for you.`,req.user.id);
  const { notifyMastersAndWardStaff } = require('../../services/notify.service');
  await notifyMastersAndWardStaff(wardId, {
    senderUserId: req.user.id,
    type: 'COMPLAINT_NEW',
    title: 'New ward complaint',
    message: `${complaint.complaintNumber} was submitted in ${ward?.wardNumber || 'a ward'}.`,
    actionUrl: `/complaints?open=${complaint.id}`,
  });
  await logAudit({user:req.user,action:'CREATE_COMPLAINT',entity:'Complaint',recordId:complaint.id,newValue:{...req.body,reportedImage:reportedImage?'[image]':null},ipAddress:req.ip});
  return success(res,{statusCode:201,data:await complaintWithContext(complaint.id),message:'Complaint submitted'});
});

const assign = asyncHandler(async(req,res)=>{
  const { employeeId, assignToSelf=false } = req.body;
  const complaint=await Complaint.findByPk(req.params.id,{include:[{model:House,as:'house',include:[{model:Area,as:'area'}]}]});
  if(!complaint)throw new ApiError(404,'Complaint not found');
  const wardId=complaint.wardId||complaint.house?.area?.wardId;
  if(!isWardAllowed(req,wardId))throw new ApiError(403,'You can assign complaints only in your accessible wards');
  if(!canManageComplaint(req.user.roleName))throw new ApiError(403,'Only ward management can assign complaints');
  if(['RESOLVED','CLOSED'].includes(complaint.status))throw new ApiError(400,'A resolved or closed complaint cannot be assigned. Reopen it first.');

  let employee=null;
  let nagarsevak=null;
  if(assignToSelf===true || String(assignToSelf).toLowerCase()==='true'){
    if(req.user.roleName!=='NAGARSEVAK') throw new ApiError(403,'Only a Nagarsevak can take a complaint directly');
    if(req.user.wardId!==wardId) throw new ApiError(403,'You can take complaints only from your own ward');
    nagarsevak=req.user;
  } else {
    if(!employeeId) throw new ApiError(400,'Please select an employee or choose self assignment');
    employee=await Employee.findByPk(employeeId,{include:[{model:User,as:'User'},{model:User,as:'manager'}]});
    if(!employee||employee.status!=='ACTIVE')throw new ApiError(400,'Employee not found or inactive');
    if(employee.wardId!==wardId)throw new ApiError(400,'Employee must belong to the complaint ward');
    if(req.user.roleName==='NAGARSEVAK'&&employee.managerUserId!==req.user.id)throw new ApiError(403,'You can assign only to employees under your account');
    nagarsevak=employee.manager||null;
  }

  const oldStatus=complaint.status;
  await complaint.update({
    assignedEmployeeId:employee?.id||null,
    assignedNagarsevakUserId:nagarsevak?.id||complaint.assignedNagarsevakUserId||null,
    status:'ASSIGNED'
  });
  await ComplaintHistory.create({
    complaintId:complaint.id,oldStatus,newStatus:'ASSIGNED',changedByUserId:req.user.id,
    comment:employee?`Assigned to ${employee.User?.name||employee.id}`:`Taken directly by ${nagarsevak?.name||req.user.name}`
  });
  if(employee){
    await notify(employee.userId,'COMPLAINT_ASSIGNED','Complaint assigned',`${complaint.complaintNumber} is assigned to you. Please start the work.`, 'IN_APP', req.user.id, `/complaints?open=${complaint.id}`);
    if(employee.managerUserId && employee.managerUserId!==req.user.id) await notify(employee.managerUserId,'COMPLAINT_ASSIGNED','Complaint assigned to employee',`${complaint.complaintNumber} is assigned to ${employee.User?.name||'your employee'}.`, 'IN_APP', req.user.id, `/complaints?open=${complaint.id}`);
    await notifyComplaintCitizen(complaint,'COMPLAINT_ASSIGNED','Your complaint was assigned',`${complaint.complaintNumber} has been assigned to ${employee.User?.name||'a field employee'}.`,req.user.id);
  }else{
    await notifyComplaintCitizen(complaint,'COMPLAINT_ASSIGNED','Your complaint is being handled',`${complaint.complaintNumber} is now with ${nagarsevak?.name||req.user.name}.`,req.user.id);
  }
  const { notifyMastersAndWardStaff } = require('../../services/notify.service');
  await notifyMastersAndWardStaff(wardId, {
    senderUserId: req.user.id,
    type: 'COMPLAINT_ASSIGNED',
    title: 'Complaint assigned',
    message: employee?`${complaint.complaintNumber} is assigned to ${employee.User?.name||'an employee'}.`:`${complaint.complaintNumber} is now with ${nagarsevak?.name||req.user.name}.`,
    actionUrl: `/complaints?open=${complaint.id}`,
  });
  await logAudit({user:req.user,action:'ASSIGN_COMPLAINT',entity:'Complaint',recordId:complaint.id,oldValue:{status:oldStatus},newValue:{employeeId:employee?.id||null,nagarsevakUserId:nagarsevak?.id||null,status:'ASSIGNED'},ipAddress:req.ip});
  return success(res,{data:await complaintWithContext(complaint.id),message:employee?'Complaint assigned to employee':'Complaint assigned to Nagarsevak'});
});
const updateStatus = asyncHandler(async(req,res)=>{
  const {status,comment,resolutionNote,resolutionImage}=req.body;
  if(!STATUSES.includes(status))throw new ApiError(400,'Invalid complaint status');
  const complaint=await Complaint.findByPk(req.params.id,{include:[{model:House,as:'house',include:[{model:Area,as:'area'}]}]});
  if(!complaint)throw new ApiError(404,'Complaint not found');
  const wardId=complaint.wardId||complaint.house?.area?.wardId;
  if(!isWardAllowed(req,wardId))throw new ApiError(403,'Complaint belongs to another ward');
  if(req.user.roleName==='EMPLOYEE'&&complaint.assignedEmployeeId!==req.user.employeeProfile?.id)throw new ApiError(403,'You can update only complaints assigned to you');

  const current=complaint.status;
  const role=req.user.roleName;
  const management=canManageComplaint(role);

  if(role==='EMPLOYEE'){
    if(!['ASSIGNED','IN_PROGRESS','REOPENED'].includes(current)) throw new ApiError(409,`Employee cannot update a ${current.replaceAll('_',' ')} complaint`);
    if(!['IN_PROGRESS','RESOLVED'].includes(status)) throw new ApiError(400,'Employee can only move a complaint to IN PROGRESS or RESOLVED');
    if(current==='ASSIGNED'&&status==='RESOLVED') throw new ApiError(400,'Start the work with IN PROGRESS before resolving it');
  } else if(management){
    const allowedTransitions={
      SUBMITTED:['PENDING','ASSIGNED'],
      PENDING:['ASSIGNED','CLOSED','REOPENED'],
      ASSIGNED:['PENDING','REOPENED'],
      IN_PROGRESS:['REOPENED'],
      RESOLVED:['CLOSED','REOPENED'],
      REOPENED:['PENDING','ASSIGNED','CLOSED']
    };
    if(!allowedTransitions[current]?.includes(status)){
      throw new ApiError(400,`Cannot change complaint from ${current.replaceAll('_',' ')} to ${status.replaceAll('_',' ')}`);
    }
    if(status==='CLOSED'&&current!=='RESOLVED') throw new ApiError(400,'A complaint can be closed only after it is resolved');
  } else {
    throw new ApiError(403,'You do not have permission to update complaints');
  }

  if(status==='RESOLVED'&&!String(resolutionNote||'').trim())throw new ApiError(400,'Resolution note is mandatory when resolving');

  const image=status==='RESOLVED'?cleanImage(resolutionImage):undefined;
  const oldStatus=complaint.status;
  await complaint.update({
    status,
    resolutionNote:resolutionNote||complaint.resolutionNote,
    resolutionImage:image===undefined?complaint.resolutionImage:image,
    resolvedAt:status==='RESOLVED'?new Date():status==='REOPENED'?null:complaint.resolvedAt
  });
  await ComplaintHistory.create({complaintId:complaint.id,oldStatus,newStatus:status,changedByUserId:req.user.id,comment:comment||null});

  const statusText=prettyStatus(status);
  await notifyComplaintCitizen(
    complaint,
    'COMPLAINT_STATUS',
    'Your complaint was updated',
    `${complaint.complaintNumber} is now ${statusText}.${comment?` ${comment}`:''}`,
    req.user.id
  );

  const { notifyMastersAndWardStaff } = require('../../services/notify.service');
  await notifyMastersAndWardStaff(wardId, {
    senderUserId: req.user.id,
    type: 'COMPLAINT_STATUS',
    title: 'Complaint status changed',
    message: `${complaint.complaintNumber} is now ${statusText}.`,
    actionUrl: `/complaints?open=${complaint.id}`,
  });

  await logAudit({user:req.user,action:'UPDATE_COMPLAINT_STATUS',entity:'Complaint',recordId:complaint.id,oldValue:{status:oldStatus},newValue:{status},ipAddress:req.ip});
  return success(res,{data:await complaintWithContext(complaint.id),message:'Complaint updated'});
});

const detail = asyncHandler(async(req,res)=>{
  await assertComplaint(req.params.id,req);
  const data=await complaintWithContext(req.params.id);
  return success(res,{data});
});

module.exports={list,create,assign,updateStatus,detail};
