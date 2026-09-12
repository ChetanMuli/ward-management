const { Op } = require('sequelize');
const { Ward, Area, House, Family, Person, VoterProfile, Complaint, User, Role } = require('../models');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../services/audit.service');
const registry = { Ward, Area, House, Family, Person, VoterProfile, Complaint, User };
const list = asyncHandler(async (req,res)=>{
  const requested=req.query.type;
  const models=requested && registry[requested] ? [[requested,registry[requested]]] : Object.entries(registry);
  const rows=[];
  for(const [entity,Model] of models){
    const where={deletedAt:{[Op.ne]:null}};
    if(entity==='User'){
      const citizenRole=await Role.findOne({where:{name:'CITIZEN'},attributes:['id']});
      if(!citizenRole) continue;
      where.roleId=citizenRole.id;
    }
    const records=await Model.findAll({where,paranoid:false,order:[['deletedAt','DESC']],limit:100});
    records.forEach(record=>rows.push({entity,record}));
  }
  rows.sort((a,b)=>new Date(b.record.deletedAt)-new Date(a.record.deletedAt));
  return success(res,{data:rows.slice(0,300)});
});
const restore=asyncHandler(async(req,res)=>{
  const Model=registry[req.params.entity];
  if(!Model) throw new ApiError(400,'Unsupported recycle-bin entity');
  const record=await Model.findByPk(req.params.id,{paranoid:false});
  if(!record || !record.deletedAt) throw new ApiError(404,'Deleted record not found');
  await record.restore();
  if(req.params.entity==='User' && record.status==='DELETED') await record.update({status:'ACTIVE'});
  await logAudit({user:req.user,action:'RESTORE_RECORD',entity:req.params.entity,recordId:record.id,newValue:{restored:true},ipAddress:req.ip});
  return success(res,{data:record,message:`${req.params.entity} restored`});
});
module.exports={list,restore};
