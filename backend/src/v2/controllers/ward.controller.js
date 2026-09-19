const { Op } = require('sequelize');
const { Ward, Area, Apartment, User, Role, WardNagarsevakSubscription } = require('../../models');
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
 const rows=await Ward.findAll({where,include:[{model:Area,as:'areas'},{model:Apartment,as:'apartments',required:false,include:[{model:Area,as:'area',attributes:['id','name']}]},{model:User,as:'users',attributes:['id','name','mobile','status','roleId'],required:false,include:[{model:Role,attributes:['name'],required:false,where:{name:'NAGARSEVAK'}}]},{model:WardNagarsevakSubscription,as:'nagarsevakSubscriptions',attributes:['id','nagarsevakUserId','status'],required:false,include:[{model:User,as:'nagarsevak',attributes:['id','name','mobile','status'],required:false}]}],order:[['wardNumber','ASC']]});
 if(req.user.roleName==='CITIZEN'){
  const { getVisibleNagarsevakIds } = require('../../services/wardActivation.service');
  const visible=new Set((await getVisibleNagarsevakIds(req.user.wardId)).map(String));
  const sanitized=rows.map(row=>{
   const json=row.toJSON();
   json.users=(json.users||[]).filter(u=>visible.has(String(u.id)));
   json.nagarsevakSubscriptions=(json.nagarsevakSubscriptions||[]).filter(s=>visible.has(String(s.nagarsevakUserId)));
   return json;
  });
  return success(res,{data:sanitized});
 }
 return success(res,{data:rows});
});
const create=asyncHandler(async(req,res)=>{if(req.user.roleName!=='SUPER_ADMIN')throw new ApiError(403,'Only Master Admin can create wards');const payload={...req.body,status:'INACTIVE'};delete payload.areas;['city','district','pincode','latitude','longitude'].forEach(k=>{if(payload[k]==='')payload[k]=null});const ward=await Ward.create(payload);await ensureWardGroup(ward.id);await syncWardCommunityMembership(ward.id).catch(()=>{});await logAudit({user:req.user,action:'CREATE_WARD',entity:'Ward',recordId:ward.id,newValue:payload,ipAddress:req.ip});return success(res,{statusCode:201,data:ward,message:'Ward created as inactive. Activate it from Ward activation before residents can register.'});});
function canEditWardPlaces(req){
  return ['SUPER_ADMIN','NAGARSEVAK','EMPLOYEE'].includes(req.user.roleName)
    || (req.user.roleName==='SUB_MASTER_ADMIN' && Array.isArray(req.user.permissions) && req.user.permissions.includes('EDIT_WARDS'));
}
function emptyToNull(v){return v===''||v==null?null:v}

function apartmentFields(body){
  const floors=body.floors===''||body.floors==null?null:Number(body.floors);
  const latitude=body.latitude===''||body.latitude==null?null:Number(body.latitude);
  const longitude=body.longitude===''||body.longitude==null?null:Number(body.longitude);
  const geo=Number.isFinite(latitude)&&Number.isFinite(longitude)?{latitude,longitude}:{latitude:null,longitude:null};
  return {
    name:String(body.name||'').trim(),
    address:emptyToNull(body.address),
    landmark:emptyToNull(body.landmark),
    floors:Number.isFinite(floors)&&floors>0?Math.round(floors):null,
    notes:emptyToNull(body.notes),
    latitude:geo.latitude,
    longitude:geo.longitude,
    status:body.status||'ACTIVE'
  };
}
function areaFields(body){
 return {
  name:body.name,
  description:body.description||'',
  status:body.status||'ACTIVE',
  city:emptyToNull(body.city),
  pincode:emptyToNull(body.pincode),
  landmark:emptyToNull(body.landmark),
  latitude:emptyToNull(body.latitude),
  longitude:emptyToNull(body.longitude)
 };
}
const createArea=asyncHandler(async(req,res)=>{if(!canEditWardPlaces(req))throw new ApiError(403,'You cannot add colonies in this ward');if(!isWardAllowed(req,req.params.wardId))throw new ApiError(403,'You do not have access to this ward');const ward=await Ward.findByPk(req.params.wardId);if(!ward)throw new ApiError(404,'Ward not found');const area=await Area.create({...areaFields(req.body),wardId:ward.id});await logAudit({user:req.user,action:'CREATE_AREA',entity:'Area',recordId:area.id,newValue:req.body,ipAddress:req.ip});return success(res,{statusCode:201,data:area,message:'Area created'});});
const updateArea=asyncHandler(async(req,res)=>{const area=await Area.findByPk(req.params.id);
 if(!isWardAllowed(req,area?.wardId))throw new ApiError(403,'You do not have access to this ward');if(!area)throw new ApiError(404,'Area not found');if(!canEditWardPlaces(req))throw new ApiError(403,'You cannot edit this colony');const old=area.toJSON();await area.update(areaFields({...old,...req.body}));await logAudit({user:req.user,action:'UPDATE_AREA',entity:'Area',recordId:area.id,oldValue:old,newValue:req.body,ipAddress:req.ip});return success(res,{data:area,message:'Area updated'});});
const remove=asyncHandler(async(req,res)=>{const ward=await Ward.findByPk(req.params.id);if(!ward)throw new ApiError(404,'Ward not found');if(req.user.roleName!=='SUPER_ADMIN')throw new ApiError(403,'Only Super Admin can delete a ward');await archiveWardGroups(ward.id);await ward.destroy();await logAudit({user:req.user,action:'SOFT_DELETE_WARD',entity:'Ward',recordId:ward.id,newValue:{deleted:true},ipAddress:req.ip});return success(res,{message:'Ward moved to recycle bin'});});
const removeArea=asyncHandler(async(req,res)=>{const area=await Area.findByPk(req.params.id);
 if(!isWardAllowed(req,area?.wardId))throw new ApiError(403,'You do not have access to this ward');if(!area)throw new ApiError(404,'Area not found');await area.destroy();return success(res,{message:'Area moved to recycle bin'});});
const update=asyncHandler(async(req,res)=>{const ward=await Ward.findByPk(req.params.id);if(!ward)throw new ApiError(404,'Ward not found');if(!isWardAllowed(req,ward.id))throw new ApiError(403,'Cross-ward access denied');
 if(Object.prototype.hasOwnProperty.call(req.body,'status') && String(req.body.status||'').toUpperCase()!==String(ward.status||'').toUpperCase()){
  if(req.user.roleName!=='SUPER_ADMIN') throw new ApiError(403,'Only Master Admin can change ward activation status');
  const updated=await setWardActivation(ward.id, req.body.status, req.user, req.ip);
  const rest={...req.body}; delete rest.status;
  ['city','district','pincode','latitude','longitude'].forEach(k=>{if(rest[k]==='')rest[k]=null});
  if(Object.keys(rest).length) await updated.update(rest);
  await ensureWardGroup(ward.id);
  return success(res,{data:await Ward.findByPk(ward.id),message:'Ward updated'});
 }
 const old=ward.toJSON();const patch={...req.body};['city','district','pincode','latitude','longitude'].forEach(k=>{if(patch[k]==='')patch[k]=null});await ward.update(patch);await ensureWardGroup(ward.id);await syncWardCommunityMembership(ward.id).catch(()=>{});await logAudit({user:req.user,action:'UPDATE_WARD',entity:'Ward',recordId:ward.id,oldValue:old,newValue:req.body,ipAddress:req.ip});return success(res,{data:ward,message:'Ward updated'});});
const listApartments=asyncHandler(async(req,res)=>{
  const where={};
  const ids=allowedWardIds(req);
  if(ids!==null) where.wardId=ids.length===1?ids[0]:{[Op.in]:ids.length?ids:['00000000-0000-0000-0000-000000000000']};
  if(req.query.wardId){
    if(!isWardAllowed(req,req.query.wardId)) throw new ApiError(403,'You do not have access to this ward');
    where.wardId=req.query.wardId;
  }
  if(req.query.areaId) where.areaId=req.query.areaId;
  const rows=await Apartment.findAll({
    where,
    include:[{model:Area,as:'area',attributes:['id','name']},{model:Ward,as:'ward',attributes:['id','wardNumber','name']}],
    order:[['name','ASC']]
  });
  return success(res,{data:rows});
});
const createApartment=asyncHandler(async(req,res)=>{
  if(!canEditWardPlaces(req)) throw new ApiError(403,'You cannot add apartments in this ward');
  const area=await Area.findByPk(req.body.areaId);
  if(!area) throw new ApiError(400,'Colony / area is required');
  if(!isWardAllowed(req,area.wardId)) throw new ApiError(403,'You do not have access to this ward');
  const fields=apartmentFields(req.body);
  if(!fields.name) throw new ApiError(400,'Apartment name is required');
  const row=await Apartment.create({...fields,wardId:area.wardId,areaId:area.id});
  await logAudit({user:req.user,action:'CREATE_APARTMENT',entity:'Apartment',recordId:row.id,newValue:req.body,ipAddress:req.ip});
  return success(res,{statusCode:201,data:row,message:'Apartment added. Add flats/units next, then residents in each flat.'});
});
const updateApartment=asyncHandler(async(req,res)=>{
  if(!canEditWardPlaces(req)) throw new ApiError(403,'You cannot edit this apartment');
  const row=await Apartment.findByPk(req.params.id);
  if(!row) throw new ApiError(404,'Apartment not found');
  if(!isWardAllowed(req,row.wardId)) throw new ApiError(403,'You do not have access to this ward');
  const old=row.toJSON();
  const patch=apartmentFields({...old,...req.body});
  if(req.body.areaId){
    const area=await Area.findByPk(req.body.areaId);
    if(!area||String(area.wardId)!==String(row.wardId)) throw new ApiError(400,'Apartment must stay in a colony of the same ward');
    patch.areaId=area.id;
  }
  await row.update(patch);
  await logAudit({user:req.user,action:'UPDATE_APARTMENT',entity:'Apartment',recordId:row.id,oldValue:old,newValue:req.body,ipAddress:req.ip});
  return success(res,{data:row,message:'Apartment updated'});
});
const removeApartment=asyncHandler(async(req,res)=>{
  if(!canEditWardPlaces(req)) throw new ApiError(403,'You cannot remove this apartment');
  const row=await Apartment.findByPk(req.params.id);
  if(!row) throw new ApiError(404,'Apartment not found');
  if(!isWardAllowed(req,row.wardId)) throw new ApiError(403,'You do not have access to this ward');
  await row.destroy();
  await logAudit({user:req.user,action:'SOFT_DELETE_APARTMENT',entity:'Apartment',recordId:row.id,newValue:{deleted:true},ipAddress:req.ip});
  return success(res,{message:'Apartment moved to recycle bin'});
});
module.exports={list,create,update,remove,createArea,updateArea,removeArea,listApartments,createApartment,updateApartment,removeApartment};
