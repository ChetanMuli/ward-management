const { Op } = require('sequelize');
const { Scheme, Ward, User, Role, Notification, Person, Family, House, Area } = require('../../models');
const ApiError=require('../../utils/ApiError');
const { success }=require('../../utils/apiResponse');
const asyncHandler=require('../../utils/asyncHandler');
const { logAudit }=require('../../services/audit.service');
const { allowedWardIds, isWardAllowed }=require('../services/wardScope');

function canManage(req){ return ['SUPER_ADMIN','SUB_MASTER_ADMIN','NAGARSEVAK'].includes(req.user.roleName); }

async function notifySchemePublished(req, scheme) {
  const targetWardId = String(scheme.wardId || '').trim();
  if (!targetWardId) return;

  const ward = await Ward.findByPk(targetWardId, { attributes: ['id','wardNumber','name'] });
  const payload = {
    senderUserId: req.user.id,
    type: 'SCHEME_PUBLISHED',
    title: 'New scheme published',
    message: `${scheme.title} is now available in ${ward?.wardNumber || 'your ward'}. Open Schemes & Benefits for details.`,
    actionUrl: `/schemes?open=${scheme.id}`,
  };
  const { notifyWardCitizens, notifyMastersAndWardStaff } = require('../../services/notify.service');
  await notifyWardCitizens(targetWardId, payload);
  await notifyMastersAndWardStaff(targetWardId, payload);
}

function scopeWhere(req){
  const ids=allowedWardIds(req);
  if(ids===null) return {};
  return {wardId:ids.length===1?ids[0]:{[Op.in]:ids.length?ids:['00000000-0000-0000-0000-000000000000']}};
}
const list=asyncHandler(async(req,res)=>{
  const where={...scopeWhere(req)};
  if(req.query.status) where.status=req.query.status;
  if(req.query.search) where[Op.or]=[
    {title:{[Op.like]:`%${req.query.search}%`}},
    {description:{[Op.like]:`%${req.query.search}%`}},
    {audience:{[Op.like]:`%${req.query.search}%`}}
  ];
  const rows=await Scheme.findAll({where,include:[
    {model:Ward,as:'ward',attributes:['id','wardNumber','name']},
    {model:User,as:'createdBy',attributes:['id','name','email','mobile'],include:[{model:Role,attributes:['id','name']}]},
  ],order:[['createdAt','DESC']]});
  return success(res,{data:rows.map(r=>{const x=r.toJSON(); x.createdByName=x.createdBy?.name||'System'; x.createdByRole=x.createdBy?.Role?.name||null; return x;})});
});
const create=asyncHandler(async(req,res)=>{
  if(!canManage(req)) throw new ApiError(403,'Only authorised ward administrators can publish schemes');
  const body={...req.body};
  if(req.user.roleName==='NAGARSEVAK') body.wardId=req.user.wardId;
  if(!body.wardId) throw new ApiError(400,'Publishing ward is required for every scheme');
  if(!isWardAllowed(req,body.wardId)) throw new ApiError(403,'Scheme must belong to an accessible ward');
  if(body.minAge!==null&&body.minAge!==undefined&&body.minAge!=='' && Number(body.minAge)<0) throw new ApiError(400,'Minimum age cannot be negative');
  if(body.maxAge!==null&&body.maxAge!==undefined&&body.maxAge!=='' && Number(body.maxAge)<0) throw new ApiError(400,'Maximum age cannot be negative');
  if(body.minAge!==''&&body.maxAge!==''&&body.minAge!=null&&body.maxAge!=null&&Number(body.minAge)>Number(body.maxAge)) throw new ApiError(400,'Minimum age cannot be greater than maximum age');
  if(body.startDate&&body.endDate&&body.startDate>body.endDate) throw new ApiError(400,'End date must be after start date');
  const row=await Scheme.create({...body,createdByUserId:req.user.id});
  await logAudit({user:req.user,action:'CREATE_SCHEME',entity:'Scheme',recordId:row.id,newValue:body,ipAddress:req.ip});
  if (row.status === 'PUBLISHED') await notifySchemePublished(req, row);
  return success(res,{statusCode:201,data:row,message:'Scheme published successfully'});
});
const update=asyncHandler(async(req,res)=>{
  const row=await Scheme.findByPk(req.params.id); if(!row) throw new ApiError(404,'Scheme not found');
  if(row.wardId && !isWardAllowed(req,row.wardId)) throw new ApiError(403,'You cannot manage a scheme outside your accessible wards');
  if(req.user.roleName==='NAGARSEVAK'&&row.wardId!==req.user.wardId) throw new ApiError(403,'You can edit schemes only in your ward');
  const patch={...req.body}; delete patch.createdByUserId;
  if(req.user.roleName==='NAGARSEVAK') patch.wardId=req.user.wardId;
  const nextWardId=patch.wardId||row.wardId;
  if(!nextWardId) throw new ApiError(400,'Publishing ward is required for every scheme');
  if(!isWardAllowed(req,nextWardId)) throw new ApiError(403,'Scheme must belong to an accessible ward');
  patch.wardId=nextWardId;
  if(patch.startDate&&patch.endDate&&patch.startDate>patch.endDate) throw new ApiError(400,'End date must be after start date');
  const old=row.toJSON(); await row.update(patch);
  await logAudit({user:req.user,action:'UPDATE_SCHEME',entity:'Scheme',recordId:row.id,oldValue:old,newValue:patch,ipAddress:req.ip});
  if (old.status !== 'PUBLISHED' && row.status === 'PUBLISHED') await notifySchemePublished(req, row);
  return success(res,{data:row,message:'Scheme updated successfully'});
});
const remove=asyncHandler(async(req,res)=>{
  const row=await Scheme.findByPk(req.params.id); if(!row) throw new ApiError(404,'Scheme not found');
  if(row.wardId && !isWardAllowed(req,row.wardId)) throw new ApiError(403,'You cannot delete a scheme outside your accessible wards');
  if(req.user.roleName==='NAGARSEVAK'&&row.wardId!==req.user.wardId) throw new ApiError(403,'You can delete schemes only in your ward');
  await row.destroy(); await logAudit({user:req.user,action:'DELETE_SCHEME',entity:'Scheme',recordId:row.id,ipAddress:req.ip});
  return success(res,{message:'Scheme deleted successfully'});
});
module.exports={list,create,update,remove};
