const { Op } = require('sequelize');
const { Shop, Area, Ward } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { logAudit } = require('../../services/audit.service');
const { allowedWardIds, isWardAllowed } = require('../services/wardScope');

function emptyToNull(v){ return v===''||v==null?null:String(v).trim()||null; }
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
function shopFields(body){
  const kind=String(body.kind||'SHOP').toUpperCase()==='OFFICE'?'OFFICE':'SHOP';
  const ownershipRaw=String(body.ownership||'').toUpperCase();
  const ownership=['OWN','RENT','OTHER'].includes(ownershipRaw)?ownershipRaw:null;
  const categoryPick=emptyToNull(body.category);
  const custom=emptyToNull(body.categoryCustom);
  const category=categoryPick==='Other'?(custom||'Other'):categoryPick;
  return {
    name:String(body.name||'').trim(),
    kind,
    category,
    address:String(body.address||'').trim(),
    landmark:emptyToNull(body.landmark),
    ownerName:emptyToNull(body.ownerName),
    ownerMobile:emptyToNull(body.ownerMobile),
    ownership,
    openingHours:emptyToNull(body.openingHours),
    notes:emptyToNull(body.notes),
    status:body.status||'ACTIVE',
    ...pairCoords(body.latitude,body.longitude)
  };
}
const include=[{model:Area,as:'area',include:[{model:Ward,as:'ward',attributes:['id','wardNumber','name']}]}];

function canEdit(req){
  return ['SUPER_ADMIN','NAGARSEVAK','EMPLOYEE'].includes(req.user.roleName)
    || (req.user.roleName==='SUB_MASTER_ADMIN' && Array.isArray(req.user.permissions) && (req.user.permissions.includes('EDIT_HOUSES')||req.user.permissions.includes('CREATE_HOUSES')));
}

const list=asyncHandler(async(req,res)=>{
  const where={};
  const ids=allowedWardIds(req);
  const areaWhere={};
  if(ids!==null) areaWhere.wardId=ids.length===1?ids[0]:{[Op.in]:ids.length?ids:['00000000-0000-0000-0000-000000000000']};
  if(req.query.wardId){
    if(!isWardAllowed(req,req.query.wardId)) throw new ApiError(403,'You do not have access to this ward');
    areaWhere.wardId=req.query.wardId;
  }
  if(req.query.areaId) where.areaId=req.query.areaId;
  if(req.query.kind) where.kind=String(req.query.kind).toUpperCase();
  const search=String(req.query.search||'').trim();
  if(search){
    where[Op.or]=[
      {name:{[Op.like]:`%${search}%`}},
      {address:{[Op.like]:`%${search}%`}},
      {landmark:{[Op.like]:`%${search}%`}},
      {ownerName:{[Op.like]:`%${search}%`}},
      {ownerMobile:{[Op.like]:`%${search}%`}},
      {category:{[Op.like]:`%${search}%`}},
    ];
  }
  const rows=await Shop.findAll({
    where,
    include:[{model:Area,as:'area',where:Object.keys(areaWhere).length?areaWhere:undefined,required:true,include:[{model:Ward,as:'ward',attributes:['id','wardNumber','name']}]}],
    order:[['name','ASC']]
  });
  return success(res,{data:rows});
});

const detail=asyncHandler(async(req,res)=>{
  const row=await Shop.findByPk(req.params.id,{include});
  if(!row) throw new ApiError(404,'Shop / office not found');
  if(!isWardAllowed(req,row.area?.wardId)) throw new ApiError(403,'You do not have access to this ward');
  return success(res,{data:row});
});

const create=asyncHandler(async(req,res)=>{
  if(!canEdit(req)) throw new ApiError(403,'You cannot add shops or offices');
  const area=await Area.findByPk(req.body.areaId);
  if(!area) throw new ApiError(400,'Colony / area is required');
  if(!isWardAllowed(req,area.wardId)) throw new ApiError(403,'You do not have access to this ward');
  const fields=shopFields(req.body);
  if(!fields.name) throw new ApiError(400,'Name is required');
  if(!fields.address) throw new ApiError(400,'Address is required');
  if(!fields.ownership) throw new ApiError(400,'Select whether this place is owned or rented');
  const row=await Shop.create({...fields,areaId:area.id});
  await logAudit({user:req.user,action:'CREATE_SHOP',entity:'Shop',recordId:row.id,newValue:req.body,ipAddress:req.ip});
  const full=await Shop.findByPk(row.id,{include});
  return success(res,{statusCode:201,data:full,message:'Shop / office added'});
});

const update=asyncHandler(async(req,res)=>{
  if(!canEdit(req)) throw new ApiError(403,'You cannot edit this shop / office');
  const row=await Shop.findByPk(req.params.id,{include});
  if(!row) throw new ApiError(404,'Shop / office not found');
  if(!isWardAllowed(req,row.area?.wardId)) throw new ApiError(403,'You do not have access to this ward');
  const old=row.toJSON();
  const patch=shopFields({...old,...req.body});
  if(req.body.areaId){
    const area=await Area.findByPk(req.body.areaId);
    if(!area) throw new ApiError(400,'Colony / area is required');
    if(!isWardAllowed(req,area.wardId)) throw new ApiError(403,'You do not have access to this ward');
    patch.areaId=area.id;
  }
  if(!patch.name) throw new ApiError(400,'Name is required');
  if(!patch.address) throw new ApiError(400,'Address is required');
  if(!patch.ownership) throw new ApiError(400,'Select whether this place is owned or rented');
  await row.update(patch);
  await logAudit({user:req.user,action:'UPDATE_SHOP',entity:'Shop',recordId:row.id,oldValue:old,newValue:req.body,ipAddress:req.ip});
  const full=await Shop.findByPk(row.id,{include});
  return success(res,{data:full,message:'Shop / office updated'});
});

const remove=asyncHandler(async(req,res)=>{
  if(!canEdit(req)) throw new ApiError(403,'You cannot remove this shop / office');
  const row=await Shop.findByPk(req.params.id,{include});
  if(!row) throw new ApiError(404,'Shop / office not found');
  if(!isWardAllowed(req,row.area?.wardId)) throw new ApiError(403,'You do not have access to this ward');
  await row.destroy();
  await logAudit({user:req.user,action:'SOFT_DELETE_SHOP',entity:'Shop',recordId:row.id,newValue:{deleted:true},ipAddress:req.ip});
  return success(res,{message:'Shop / office moved to recycle bin'});
});

module.exports={list,detail,create,update,remove};
