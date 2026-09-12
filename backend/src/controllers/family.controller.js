const { Op } = require('sequelize');
const { Family, Person, House, Area, Ward, VoterProfile } = require('../models');
const ApiError=require('../utils/ApiError');
const {success}=require('../utils/apiResponse');
const asyncHandler=require('../utils/asyncHandler');
const {logAudit}=require('../services/audit.service');
const include=[
 {model:Person,as:'members',include:[{model:VoterProfile,as:'voterProfile'}]},
 {model:House,as:'house',include:[{model:Area,as:'area',include:[{model:Ward,as:'ward'}]}]},
];
const list=asyncHandler(async(req,res)=>{
 const {page=1,limit=50,search,houseId,status,areaId}=req.query; const where={};
 if(houseId) where.houseId=houseId; if(status) where.status=status;
 if(search) where[Op.or]=[{familyName:{[Op.like]:`%${search}%`}},{id:search}];
 const inc=include.map(x=>x.as==='house'&&areaId?{...x,where:{areaId},required:true}:x);
 const {rows,count}=await Family.findAndCountAll({where,include:inc,order:[['familyName','ASC'],['createdAt','DESC']],limit:Math.min(Number(limit)||50,200),offset:((Number(page)||1)-1)*(Number(limit)||50),distinct:true});
 return success(res,{data:rows,meta:{total:count,page:Number(page)||1,limit:Number(limit)||50}});
});
const getById=asyncHandler(async(req,res)=>{const family=await Family.findByPk(req.params.id,{include});if(!family)throw new ApiError(404,'Family not found');return success(res,{data:family});});
const create=asyncHandler(async(req,res)=>{const {houseId,familyName,notes,status='ACTIVE'}=req.body;const house=await House.findByPk(houseId);if(!house)throw new ApiError(400,'Referenced house does not exist');const family=await Family.create({houseId,familyName,notes,status});await logAudit({user:req.user,action:'CREATE_FAMILY',entity:'Family',recordId:family.id,newValue:req.body,ipAddress:req.ip});return success(res,{data:family,statusCode:201,message:'Family created'});});
const update=asyncHandler(async(req,res)=>{const family=await Family.findByPk(req.params.id);if(!family)throw new ApiError(404,'Family not found');const oldValue=family.toJSON();await family.update(req.body);await logAudit({user:req.user,action:'UPDATE_FAMILY',entity:'Family',recordId:family.id,oldValue,newValue:req.body,ipAddress:req.ip});return success(res,{data:family,message:'Family updated'});});
const remove=asyncHandler(async(req,res)=>{const family=await Family.findByPk(req.params.id);if(!family)throw new ApiError(404,'Family not found');await family.destroy();await logAudit({user:req.user,action:'SOFT_DELETE_FAMILY',entity:'Family',recordId:family.id,newValue:{deleted:true},ipAddress:req.ip});return success(res,{message:'Family moved to recycle bin'});});
module.exports={list,getById,create,update,remove};
