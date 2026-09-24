const { Op }=require('sequelize');
const { Ward,Area,House,Family,Person,VoterProfile,Complaint,GovernmentVoterList,User,Role,Shop,NagarsevakSchedule }=require('../../models');
const {success}=require('../../utils/apiResponse');
const asyncHandler=require('../../utils/asyncHandler');
const ApiError=require('../../utils/ApiError');
const {getScope,allowedWardIds,isWardAllowed}=require('../services/wardScope');
const registry={Ward,Area,House,Family,Person,VoterProfile,Complaint,GovernmentVoterList,User,Shop,NagarsevakSchedule};
const list=asyncHandler(async(req,res)=>{
 const type=req.query.type;
 const entries=type&&registry[type]?[[type,registry[type]]]:Object.entries(registry);
 const out=[];
 const allowed=allowedWardIds(req);
 const scopedWardIds=allowed===null?null:(allowed||[]);
 const wardIds=scopedWardIds?.length?scopedWardIds:['00000000-0000-0000-0000-000000000000'];
 const areaIds=allowed===null?null:(await Area.findAll({where:{wardId:{[Op.in]:wardIds}},attributes:['id']})).map(a=>a.id);
 const scopedAreaIds=areaIds?.length?areaIds:['00000000-0000-0000-0000-000000000000'];
 for(const [entity,Model] of entries){
  const deletedCol=Model.options.deletedAt||Model.rawAttributes.deletedAt?.field||'deletedAt';
  let where={[deletedCol]:{[Op.ne]:null}};
  let include=[];
  if(allowed!==null){
   if(entity==='Ward') where.id={[Op.in]:wardIds};
   else if(entity==='Area') where.wardId={[Op.in]:wardIds};
   else if(entity==='House') include=[{model:Area,as:'area',where:{id:{[Op.in]:scopedAreaIds}},required:true}];
   else if(entity==='Shop') include=[{model:Area,as:'area',where:{id:{[Op.in]:scopedAreaIds}},required:true}];
   else if(entity==='Family') include=[{model:House,as:'house',include:[{model:Area,as:'area',where:{id:{[Op.in]:scopedAreaIds}},required:true}],required:true}];
   else if(entity==='Person') include=[{model:Family,as:'family',include:[{model:House,as:'house',include:[{model:Area,as:'area',where:{id:{[Op.in]:scopedAreaIds}},required:true}],required:true}],required:true}];
   else if(entity==='VoterProfile') include=[{model:Person,as:'Person',required:true,include:[{model:Family,as:'family',required:true,include:[{model:House,as:'house',required:true,include:[{model:Area,as:'area',where:{id:{[Op.in]:scopedAreaIds}},required:true}]}]}]}];
   else if(entity==='Complaint') include=[{model:House,as:'house',where:{areaId:{[Op.in]:scopedAreaIds}},required:true}];
   else if(entity==='NagarsevakSchedule') where.wardId={[Op.in]:wardIds};
   else if(entity==='User') include=[{model:Role,where:{name:'CITIZEN'},required:true}];
   else if(entity==='GovernmentVoterList') continue; // No ward relation is stored for uploaded government files.
  }
  // Registered citizens only are shown in the User recycle bin.
  if(entity==='User'){
   const citizenRole=await Role.findOne({where:{name:'CITIZEN'}});
   if(!citizenRole)continue;
   include=[{model:Role,where:{id:citizenRole.id},required:true}];
   if(allowed!==null) where.wardId={[Op.in]:wardIds};
  }
  if(['GovernmentVoterList','User'].includes(entity)){
   try{
    const definition=await Model.sequelize.getQueryInterface().describeTable(Model.getTableName());
    if(!definition.deleted_at)continue;
   }catch(e){continue;}
  }
  const records=await Model.findAll({where,paranoid:false,include,order:[[deletedCol,'DESC']],limit:100});
  records.forEach(record=>out.push({entity,record}));
 }
 out.sort((a,b)=>new Date(b.record.deletedAt)-new Date(a.record.deletedAt));
 return success(res,{data:out.slice(0,300)});
});
const restore=asyncHandler(async(req,res)=>{
 const entity=req.params.entity;
 const Model=registry[entity];
 if(!Model)throw new ApiError(400,'Unsupported recycle-bin entity');
 const row=await Model.findByPk(req.params.id,{paranoid:false});
 if(!row||!row.deletedAt)throw new ApiError(404,'Deleted record not found');
 if(req.user.roleName!=='SUPER_ADMIN'){
   if(entity==='GovernmentVoterList') throw new ApiError(403,'Only the Master Admin can restore a government voter list');
   if(entity==='Ward' && !isWardAllowed(req,row.id)) throw new ApiError(403,'Cross-ward access denied');
   if(entity==='Area' && !isWardAllowed(req,row.wardId)) throw new ApiError(403,'Cross-ward access denied');
   if(entity==='House'){ const h=await row.getArea(); if(!isWardAllowed(req,h?.wardId))throw new ApiError(403,'Cross-ward access denied'); }
   if(entity==='Shop'){ const h=await row.getArea(); if(!isWardAllowed(req,h?.wardId))throw new ApiError(403,'Cross-ward access denied'); }
   if(entity==='Family'){ const f=await row.getHouse({include:[{model:Area,as:'area'}]}); if(!isWardAllowed(req,f?.area?.wardId))throw new ApiError(403,'Cross-ward access denied'); }
   if(entity==='Person'){ const f=await row.getFamily({include:[{model:House,as:'house',include:[{model:Area,as:'area'}]}]}); if(!isWardAllowed(req,f?.house?.area?.wardId))throw new ApiError(403,'Cross-ward access denied'); }
   if(entity==='VoterProfile'){ const person=await row.getPerson({include:[{model:Family,as:'family',include:[{model:House,as:'house',include:[{model:Area,as:'area'}]}]}]}); if(!isWardAllowed(req,person?.family?.house?.area?.wardId))throw new ApiError(403,'Cross-ward access denied'); }
   if(entity==='Complaint'){ const h=await row.getHouse({include:[{model:Area,as:'area'}]}); if(!isWardAllowed(req,row.wardId||h?.area?.wardId))throw new ApiError(403,'Cross-ward access denied'); }
   if(entity==='NagarsevakSchedule' && !isWardAllowed(req,row.wardId)) throw new ApiError(403,'Cross-ward access denied');
   if(entity==='User'){ const citizenRole=await Role.findOne({where:{name:'CITIZEN'}}); if(!citizenRole||String(row.roleId)!==String(citizenRole.id)||!isWardAllowed(req,row.wardId))throw new ApiError(403,'Cross-ward access denied'); }
 }
 await row.restore();
 if(entity==='User' && row.status==='DELETED') await row.update({status:'ACTIVE'});
 return success(res,{data:row,message:`${entity} restored`});
});
module.exports={list,restore};
