const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Person, Family, House, VoterProfile, DeathRecord, Area, Ward } = require('../models');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../services/audit.service');
const { findPossibleDuplicates } = require('../services/duplicateDetection.service');
const { daysTo18thBirthday, daysToNextBirthday } = require('../services/age.service');

const familyInclude = { model: Family, as: 'family', include: [
  { model: Person, as: 'members', attributes: ['id','fullName','gender','dob','mobile','alternateMobile','occupationType','businessName','companyName'] },
  { model: House, as: 'house', include: [{ model: Area, as: 'area', include: [{ model: Ward, as: 'ward' }] }] }
] };
const fullInclude = [familyInclude, { model: VoterProfile, as: 'voterProfile' }, { model: DeathRecord, as: 'deathRecord' }];

const list = asyncHandler(async (req,res)=>{
  const {page=1,limit=200,search,status,voterStatus,areaId,familyId,ageMin,ageMax,wardId}=req.query;
  const where={}; if(status) where.status=status; if(familyId) where.familyId=familyId;
  if(search) where[Op.or]=[{fullName:{[Op.like]:`%${search}%`}},{mobile:{[Op.like]:`%${search}%`}},{id:search}];
  const houseArea = { model: Area, as: 'area', include: [{ model: Ward, as: 'ward', ...(wardId ? { where: { id: wardId }, required: true } : {}) }] };
  const include=[{...familyInclude, include:[{model:House,as:'house',include:[houseArea], ...(areaId?{where:{areaId},required:true}:{})}]},  ...(voterStatus?[{model:VoterProfile,as:'voterProfile',where:{status:voterStatus},required:true}]:[{model:VoterProfile,as:'voterProfile'}])];
  let people=await Person.findAll({where,include,order:[['fullName','ASC']]});
  if(ageMin||ageMax) people=people.filter(p=>{const age=Number(p.age);return(!ageMin||age>=Number(ageMin))&&(!ageMax||age<=Number(ageMax));});
  const lim=Math.min(Number(limit)||200,500), off=((Number(page)||1)-1)*lim;
  return success(res,{data:people.slice(off,off+lim),meta:{total:people.length,page:Number(page)||1,limit:lim}});
});
const getById=asyncHandler(async(req,res)=>{const person=await Person.findByPk(req.params.id,{include:fullInclude});if(!person)throw new ApiError(404,'Person not found');if(req.user.roleName==='CITIZEN'&&person.id!==req.user.personId)throw new ApiError(403,'You may only view your own record');return success(res,{data:person});});
const create=asyncHandler(async(req,res)=>{const {fullName,dob,mobile,familyId,force}=req.body;const duplicates=await findPossibleDuplicates({fullName,dob,mobile,familyId});if(duplicates.length&&!force)return success(res,{message:'Possible duplicate citizen record found. Resubmit with force=true to proceed anyway.',data:{duplicates},statusCode:409});const payload={...req.body};
  for(const key of ['email','alternateMobile','mobile','occupation','occupationType','businessName','businessAddress','companyName','employmentType','officialVoterIdRef','votingWard','constituency','notes','voterIdImage','aadhaarImage','panCardImage','dob']){
    if(payload[key]==='') payload[key]=null;
  }
  if(payload.gender==='') payload.gender='NOT_SPECIFIED';
  payload.status='ACTIVE';
  const person=await Person.create({...payload,createdBy:req.user.id});
  await VoterProfile.create({personId:person.id,status:payload.isVoter==='VOTER'?'VOTER':payload.isVoter==='NON_VOTER'?'NON_VOTER':'NOT_SPECIFIED',officialVoterIdRef:payload.officialVoterIdRef||null,votingWard:payload.votingWard||null,constituency:payload.constituency||null});await logAudit({user:req.user,action:'CREATE_PERSON',entity:'Person',recordId:person.id,newValue:req.body,ipAddress:req.ip});return success(res,{data:person,statusCode:201,message:'Person created'});});
const update=asyncHandler(async(req,res)=>{const person=await Person.findByPk(req.params.id);if(!person)throw new ApiError(404,'Person not found');if(req.user.roleName==='CITIZEN')throw new ApiError(403,'Submit a Profile Update Request instead of editing directly');const oldValue=person.toJSON();const payload={...req.body};
  for(const key of ['email','alternateMobile','mobile','occupation','occupationType','businessName','businessAddress','companyName','employmentType','officialVoterIdRef','votingWard','constituency','notes','voterIdImage','aadhaarImage','panCardImage','dob']) if(payload[key]==='') payload[key]=null;
  if(payload.gender==='') payload.gender='NOT_SPECIFIED';
  delete payload.isVoter;
  await person.update({...payload,updatedBy:req.user.id});
  if(payload.officialVoterIdRef!==undefined||payload.votingWard!==undefined||req.body.isVoter!==undefined||payload.constituency!==undefined){
    const vp=await VoterProfile.findOne({where:{personId:person.id}});
    if(vp) await vp.update({status:req.body.isVoter==='VOTER'?'VOTER':req.body.isVoter==='NON_VOTER'?'NON_VOTER':undefined,officialVoterIdRef:payload.officialVoterIdRef,votingWard:payload.votingWard,constituency:payload.constituency});
  }await logAudit({user:req.user,action:'UPDATE_PERSON',entity:'Person',recordId:person.id,oldValue,newValue:req.body,ipAddress:req.ip});return success(res,{data:person,message:'Person updated'});});
const updateVoterStatus=asyncHandler(async(req,res)=>{const voterProfile=await VoterProfile.findOne({where:{personId:req.params.id}});if(!voterProfile)throw new ApiError(404,'Voter profile not found for this person');const {status,constituency,votingWard,officialVoterIdRef,notes}=req.body;const oldValue=voterProfile.toJSON();await voterProfile.update({status,constituency,votingWard,officialVoterIdRef,notes,verifiedBy:req.user.id,verifiedAt:new Date()});await logAudit({user:req.user,action:'UPDATE_VOTER_STATUS',entity:'VoterProfile',recordId:voterProfile.id,oldValue,newValue:req.body,ipAddress:req.ip});return success(res,{data:voterProfile,message:'Voter status updated'});});
const updateFollowup=asyncHandler(async(req,res)=>{const person=await Person.findByPk(req.params.id);if(!person)throw new ApiError(404,'Person not found');const allowed=['NOT_CONTACTED','CONTACTED','DOCUMENTS_PENDING','GUIDANCE_GIVEN','COMPLETED','OTHER'];if(req.body.followupStatus&&!allowed.includes(req.body.followupStatus))throw new ApiError(400,'Invalid follow-up status');const oldValue=person.toJSON();await person.update({followupStatus:req.body.followupStatus,followupDate:req.body.followupDate,followupNotes:req.body.followupNotes,followupEmployeeId:req.user.id});await logAudit({user:req.user,action:'UPDATE_18PLUS_FOLLOWUP',entity:'Person',recordId:person.id,oldValue,newValue:req.body,ipAddress:req.ip});return success(res,{data:person,message:'18+ follow-up updated'});});
const remove=asyncHandler(async(req,res)=>{const person=await Person.findByPk(req.params.id);if(!person)throw new ApiError(404,'Person not found');await person.destroy();await logAudit({user:req.user,action:'SOFT_DELETE_PERSON',entity:'Person',recordId:person.id,newValue:{deleted:true},ipAddress:req.ip});return success(res,{message:'Citizen moved to recycle bin'});});
const createDeathRecord=asyncHandler(async(req,res)=>{const person=await Person.findByPk(req.params.id);if(!person)throw new ApiError(404,'Person not found');if(person.status==='DECEASED')throw new ApiError(400,'Person is already marked deceased');const {dateOfDeath,documentRef,notes}=req.body;const record=await sequelize.transaction(async t=>DeathRecord.create({personId:person.id,dateOfDeath,reportedBy:req.user.id,documentRef,notes,verificationStatus:'PENDING'},{transaction:t}));await logAudit({user:req.user,action:'CREATE_DEATH_RECORD',entity:'DeathRecord',recordId:record.id,newValue:req.body,ipAddress:req.ip});return success(res,{data:record,statusCode:201,message:'Death record submitted for verification'});});
const verifyDeathRecord=asyncHandler(async(req,res)=>{const deathRecord=await DeathRecord.findOne({where:{personId:req.params.id}});if(!deathRecord)throw new ApiError(404,'Death record not found');await sequelize.transaction(async t=>{await deathRecord.update({verificationStatus:'VERIFIED',verifiedBy:req.user.id,verifiedAt:new Date()},{transaction:t});await Person.update({status:'DECEASED'},{where:{id:req.params.id},transaction:t});await VoterProfile.update({status:'DECEASED'},{where:{personId:req.params.id},transaction:t});});await logAudit({user:req.user,action:'VERIFY_DEATH_RECORD',entity:'DeathRecord',recordId:deathRecord.id,newValue:{verificationStatus:'VERIFIED'},ipAddress:req.ip});return success(res,{message:'Death record verified; person marked as Deceased'});});
const upcoming18=asyncHandler(async(req,res)=>{const days=Number(req.query.days||30);const wardId=req.query.wardId;
  const candidates=await Person.findAll({where:{status:'ACTIVE'},include:[{...familyInclude,include:[{model:House,as:'house',include:[{model:Area,as:'area',include:[{model:Ward,as:'ward',...(wardId?{where:{id:wardId},required:true}:{})}]}]}]}, {model:VoterProfile,as:'voterProfile'}]});
  const data=candidates.map(person=>({person,daysTo18:daysTo18thBirthday(person.dob)})).filter(x=>x.daysTo18!==null&&x.daysTo18<=days).sort((a,b)=>a.daysTo18-b.daysTo18);
  return success(res,{data});
});
const upcomingBirthdays=asyncHandler(async(req,res)=>{const days=Number(req.query.days||30);const wardId=req.query.wardId;
  const people=await Person.findAll({where:{status:'ACTIVE'},include:[{...familyInclude,include:[{model:House,as:'house',include:[{model:Area,as:'area',include:[{model:Ward,as:'ward',...(wardId?{where:{id:wardId},required:true}:{})}]}]}]}, {model:VoterProfile,as:'voterProfile'}]});
  const data=people.map(person=>({person,daysToBirthday:daysToNextBirthday(person.dob)})).filter(x=>x.daysToBirthday!==null&&x.daysToBirthday<=days).sort((a,b)=>a.daysToBirthday-b.daysToBirthday);return success(res,{data});
});
module.exports={list,getById,create,update,updateVoterStatus,updateFollowup,remove,createDeathRecord,verifyDeathRecord,upcoming18,upcomingBirthdays};
