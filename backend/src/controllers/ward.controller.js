const { Ward, Area } = require('../models');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../services/audit.service');

const list = asyncHandler(async (req, res) => {
  const wards = await Ward.findAll({ include: [{ model: Area, as: 'areas' }] });
  return success(res, { data: wards });
});

const getById = asyncHandler(async (req, res) => {
  const ward = await Ward.findByPk(req.params.id, { include: [{ model: Area, as: 'areas' }] });
  if (!ward) throw new ApiError(404, 'Ward not found');
  return success(res, { data: ward });
});

const create = asyncHandler(async (req, res) => {
  const ward = await Ward.create(req.body);
  await logAudit({ user: req.user, action: 'CREATE_WARD', entity: 'Ward', recordId: ward.id, newValue: req.body, ipAddress: req.ip });
  return success(res, { data: ward, statusCode: 201, message: 'Ward created' });
});

const update = asyncHandler(async (req, res) => {
  const ward = await Ward.findByPk(req.params.id);
  if (!ward) throw new ApiError(404, 'Ward not found');
  const oldValue = ward.toJSON();
  await ward.update(req.body);
  await logAudit({ user: req.user, action: 'UPDATE_WARD', entity: 'Ward', recordId: ward.id, oldValue, newValue: req.body, ipAddress: req.ip });
  return success(res, { data: ward, message: 'Ward updated' });
});

const remove = asyncHandler(async (req,res)=>{ const ward=await Ward.findByPk(req.params.id); if(!ward) throw new ApiError(404,'Ward not found'); await ward.destroy(); await logAudit({user:req.user,action:'SOFT_DELETE_WARD',entity:'Ward',recordId:ward.id,newValue:{deleted:true},ipAddress:req.ip}); return success(res,{message:'Ward moved to recycle bin'}); });

const removeArea = asyncHandler(async(req,res)=>{const area=await Area.findByPk(req.params.areaId);if(!area)throw new ApiError(404,'Area not found');await area.destroy();await logAudit({user:req.user,action:'SOFT_DELETE_AREA',entity:'Area',recordId:area.id,newValue:{deleted:true},ipAddress:req.ip});return success(res,{message:'Area moved to recycle bin'});});

// --- Area (nested under Ward) ---

const createArea = asyncHandler(async (req, res) => {
  const ward = await Ward.findByPk(req.params.wardId);
  if (!ward) throw new ApiError(404, 'Ward not found');
  const area = await Area.create({ ...req.body, wardId: ward.id });
  await logAudit({ user: req.user, action: 'CREATE_AREA', entity: 'Area', recordId: area.id, newValue: req.body, ipAddress: req.ip });
  return success(res, { data: area, statusCode: 201, message: 'Area created' });
});

const updateArea = asyncHandler(async (req, res) => {
  const area = await Area.findByPk(req.params.areaId);
  if (!area) throw new ApiError(404, 'Area not found');
  const oldValue = area.toJSON();
  await area.update(req.body);
  await logAudit({ user: req.user, action: 'UPDATE_AREA', entity: 'Area', recordId: area.id, oldValue, newValue: req.body, ipAddress: req.ip });
  return success(res, { data: area, message: 'Area updated' });
});

module.exports = { list, getById, create, update, remove, createArea, updateArea, removeArea };
