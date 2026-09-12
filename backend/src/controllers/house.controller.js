const { Op } = require('sequelize');
const { House, Family, Person, Complaint } = require('../models');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../services/audit.service');

const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, search, verificationStatus, areaId, ownership, houseType, status } = req.query;
  const where = {};

  // Employee scoping is applied here, not just hidden in the UI (SRS section 6).
  if (req.scopedAreaIds) where.areaId = { [Op.in]: req.scopedAreaIds };
  if (areaId) where.areaId = areaId;
  if (verificationStatus) where.verificationStatus = verificationStatus;
  if (ownership) where.ownership = ownership;
  if (houseType) where.houseType = houseType;
  if (status) where.status = status;
  if (ownership) where.ownership = ownership;
  if (houseType) where.houseType = houseType;
  if (status) where.status = status;
  if (search) where[Op.or] = [{ houseNumber: { [Op.like]: `%${search}%` } }, { address: { [Op.like]: `%${search}%` } }, { ownerName: { [Op.like]: `%${search}%` } }];

  const { rows, count } = await House.findAndCountAll({
    where,
    limit: Number(limit),
    offset: (Number(page) - 1) * Number(limit),
    order: [['createdAt', 'DESC']],
  });

  return success(res, {
    data: rows,
    meta: { total: count, page: Number(page), limit: Number(limit) },
  });
});

const getById = asyncHandler(async (req, res) => {
  const house = await House.findByPk(req.params.id, {
    include: [
      {
        model: Family, as: 'families',
        include: [{ model: Person, as: 'members' }],
      },
      { model: Complaint, as: 'complaints' },
    ],
  });
  if (!house) throw new ApiError(404, 'House not found');

  if (req.scopedAreaIds && !req.scopedAreaIds.includes(house.areaId)) {
    throw new ApiError(403, 'You are not authorized to view this house');
  }

  return success(res, { data: house });
});

const create = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  for (const key of ['latitude', 'longitude', 'ownerName', 'ownerMobile', 'landmark', 'notes']) {
    if (payload[key] === '') payload[key] = null;
  }
  const house = await House.create(payload);
  await logAudit({ user: req.user, action: 'CREATE_HOUSE', entity: 'House', recordId: house.id, newValue: req.body, ipAddress: req.ip });
  return success(res, { data: house, statusCode: 201, message: 'House created' });
});

const update = asyncHandler(async (req, res) => {
  const house = await House.findByPk(req.params.id);
  if (!house) throw new ApiError(404, 'House not found');
  const oldValue = house.toJSON();
  await house.update(req.body);
  await logAudit({ user: req.user, action: 'UPDATE_HOUSE', entity: 'House', recordId: house.id, oldValue, newValue: req.body, ipAddress: req.ip });
  return success(res, { data: house, message: 'House updated' });
});

const remove = asyncHandler(async (req,res)=>{
  const house=await House.findByPk(req.params.id);
  if(!house) throw new ApiError(404,'House not found');
  await house.destroy();
  await logAudit({user:req.user,action:'SOFT_DELETE_HOUSE',entity:'House',recordId:house.id,newValue:{deleted:true},ipAddress:req.ip});
  return success(res,{message:'House moved to recycle bin'});
});

const verify = asyncHandler(async (req, res) => {
  const house = await House.findByPk(req.params.id);
  if (!house) throw new ApiError(404, 'House not found');
  const oldValue = { verificationStatus: house.verificationStatus };
  await house.update({ verificationStatus: 'VERIFIED', lastVerifiedAt: new Date() });
  await logAudit({ user: req.user, action: 'VERIFY_HOUSE', entity: 'House', recordId: house.id, oldValue, newValue: { verificationStatus: 'VERIFIED' }, ipAddress: req.ip });
  return success(res, { data: house, message: 'House marked as verified' });
});

module.exports = { list, getById, create, update, verify, remove };
