const { Op } = require('sequelize');
const { Ward, Area, User, Role } = require('../../models');
const ApiError=require('../../utils/ApiError');
const {success}=require('../../utils/apiResponse');
const asyncHandler=require('../../utils/asyncHandler');
const {logAudit}=require('../../services/audit.service');
const {allowedWardIds,isWardAllowed}=require('../services/wardScope');
const {ensureWardGroup,archiveWardGroups}=require('./chat.controller');
const {syncWardCommunityMembership,setWardActivation}=require('../../services/wardActivation.service');

const list=asyncHandler(async(req,res)=>{
 const where={}; const ids=allowedWardIds(req); if(ids!==null) where.id=ids.length===1?ids[0]:{[Op.in]:ids.length?ids:['00000000-0000-0000-0000-000000000000']};
 if(req.user.roleName==='CITIZEN'){
  if(!req.user.wardId) throw new ApiError(403,'Your account is not assigned to a ward');
  if(req.query.wardId && String(req.query.wardId)!==String(req.user.wardId)) throw new ApiError(403,'You can only view your registered ward');
  where.id=req.user.wardId;
 }
 const rows=await Ward.findAll({where,include:[{model:Area,as:'areas'},{model:User,as:'users',attributes:['id','name','mobile','status','roleId'],required:false,include:[{model:Role,attributes:['name'],required:false,where:{name:'NAGARSEVAK'}}]}],order:[['wardNumber','ASC']]});
 if(req.user.roleName==='CITIZEN'){
  const { getVisibleNagarsevakIds } = require('../../services/wardActivation.service');
  const visible=new Set((await getVisibleNagarsevakIds(req.user.wardId)).map(String));
  const sanitized=rows.map(row=>{
   const json=row.toJSON();
   json.users=(json.users||[]).filter(u=>visible.has(String(u.id)));
   return json;
  });
  return success(res,{data:sanitized});
 }
 return success(res,{data:rows});
});
const create=asyncHandler(async(req,res)=>{if(req.user.roleName!=='SUPER_ADMIN')throw new ApiError(403,'Only Master Admin can create wards');const payload={...req.body,status:'INACTIVE'};const ward=await Ward.create(payload);await ensureWardGroup(ward.id);await syncWardCommunityMembership(ward.id).catch(()=>{});await logAudit({user:req.user,action:'CREATE_WARD',entity:'Ward',recordId:ward.id,newValue:payload,ipAddress:req.ip});return success(res,{statusCode:201,data:ward,message:'Ward created as inactive. Activate it from Ward activation before residents can register.'});});
const createArea=asyncHandler(async(req,res)=>{if(!isWardAllowed(req,req.params.wardId))throw new ApiError(403,'You do not have access to this ward');const ward=await Ward.findByPk(req.params.wardId);if(!ward)throw new ApiError(404,'Ward not found');const area=await Area.create({name:req.body.name,description:req.body.description||'',status:req.body.status||'ACTIVE',wardId:ward.id});await logAudit({user:req.user,action:'CREATE_AREA',entity:'Area',recordId:area.id,newValue:req.body,ipAddress:req.ip});return success(res,{statusCode:201,data:area,message:'Area created'});});
const updateArea=asyncHandler(async(req,res)=>{const area=await Area.findByPk(req.params.id);
 if(!isWardAllowed(req,area?.wardId))throw new ApiError(403,'You do not have access to this ward');if(!area)throw new ApiError(404,'Area not found');const old=area.toJSON();await area.update({name:req.body.name,description:req.body.description,status:req.body.status});await logAudit({user:req.user,action:'UPDATE_AREA',entity:'Area',recordId:area.id,oldValue:old,newValue:req.body,ipAddress:req.ip});return success(res,{data:area,message:'Area updated'});});
const remove=asyncHandler(async(req,res)=>{const ward=await Ward.findByPk(req.params.id);if(!ward)throw new ApiError(404,'Ward not found');if(req.user.roleName!=='SUPER_ADMIN')throw new ApiError(403,'Only Super Admin can delete a ward');await archiveWardGroups(ward.id);await ward.destroy();await logAudit({user:req.user,action:'SOFT_DELETE_WARD',entity:'Ward',recordId:ward.id,newValue:{deleted:true},ipAddress:req.ip});return success(res,{message:'Ward moved to recycle bin'});});
const removeArea=asyncHandler(async(req,res)=>{const area=await Area.findByPk(req.params.id);
 if(!isWardAllowed(req,area?.wardId))throw new ApiError(403,'You do not have access to this ward');if(!area)throw new ApiError(404,'Area not found');await area.destroy();return success(res,{message:'Area moved to recycle bin'});});
const update=asyncHandler(async(req,res)=>{const ward=await Ward.findByPk(req.params.id);if(!ward)throw new ApiError(404,'Ward not found');if(!isWardAllowed(req,ward.id))throw new ApiError(403,'Cross-ward access denied');
 if(Object.prototype.hasOwnProperty.call(req.body,'status') && String(req.body.status||'').toUpperCase()!==String(ward.status||'').toUpperCase()){
  if(req.user.roleName!=='SUPER_ADMIN') throw new ApiError(403,'Only Master Admin can change ward activation status');
  const updated=await setWardActivation(ward.id, req.body.status, req.user, req.ip);
  const rest={...req.body}; delete rest.status;
  if(Object.keys(rest).length) await updated.update(rest);
  await ensureWardGroup(ward.id);
  return success(res,{data:await Ward.findByPk(ward.id),message:'Ward updated'});
 }
 const old=ward.toJSON();await ward.update(req.body);await ensureWardGroup(ward.id);await syncWardCommunityMembership(ward.id).catch(()=>{});await logAudit({user:req.user,action:'UPDATE_WARD',entity:'Ward',recordId:ward.id,oldValue:old,newValue:req.body,ipAddress:req.ip});return success(res,{data:ward,message:'Ward updated'});});
module.exports={list,create,update,remove,createArea,updateArea,removeArea};
