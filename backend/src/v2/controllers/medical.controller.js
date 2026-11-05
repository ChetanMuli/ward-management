const { Op } = require('sequelize');
const { MedicalStore, Area, Ward } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { logAudit } = require('../../services/audit.service');
const { allowedWardIds, isWardAllowed } = require('../services/wardScope');

const TYPES = ['ALLOPATHIC', 'AYURVEDIC', 'HOMOEOPATHIC', 'GENERIC', 'WHOLESALE_RETAIL', 'OTHER'];
const EMPTY_ID = '00000000-0000-0000-0000-000000000000';
const LIST_ATTR = [
  'id', 'wardId', 'areaId', 'name', 'type', 'address', 'landmark',
  'phone', 'openingHours', 'is24x7', 'homeDelivery',
  'facilities', 'notes', 'latitude', 'longitude', 'status', 'updatedAt',
];

function emptyToNull(v) { return v === '' || v == null ? null : String(v).trim() || null; }
function cleanCoord(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) < 1e-4) return null;
  return n;
}
function pairCoords(lat, lng) {
  const latitude = cleanCoord(lat);
  const longitude = cleanCoord(lng);
  if (latitude == null || longitude == null) return { latitude: null, longitude: null };
  return { latitude, longitude };
}

function toBoolean(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function medicalFields(body) {
  const typeRaw = String(body.type || 'ALLOPATHIC').toUpperCase();
  const type = TYPES.includes(typeRaw) ? typeRaw : 'ALLOPATHIC';
  const status = String(body.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  return {
    name: String(body.name || '').trim().slice(0, 180),
    type,
    address: String(body.address || '').trim().slice(0, 2000),
    landmark: emptyToNull(body.landmark)?.slice(0, 180) || null,
    phone: emptyToNull(body.phone)?.slice(0, 20) || null,
    emergencyPhone: null,
    openingHours: emptyToNull(body.openingHours)?.slice(0, 120) || null,
    is24x7: toBoolean(body.is24x7),
    homeDelivery: toBoolean(body.homeDelivery),
    facilities: emptyToNull(body.facilities)?.slice(0, 2000) || null,
    notes: emptyToNull(body.notes)?.slice(0, 2000) || null,
    status,
    ...pairCoords(body.latitude, body.longitude),
  };
}

const include = [
  { model: Ward, as: 'ward', attributes: ['id', 'wardNumber', 'name'] },
  { model: Area, as: 'area', attributes: ['id', 'name', 'wardId'], required: false },
];

function canManage(req) {
  return ['SUPER_ADMIN', 'NAGARSEVAK', 'EMPLOYEE'].includes(req.user.roleName)
    || (req.user.roleName === 'SUB_MASTER_ADMIN' && Array.isArray(req.user.permissions)
      && (req.user.permissions.includes('CREATE_MEDICALS') || req.user.permissions.includes('EDIT_MEDICALS')));
}

function canDelete(req) {
  return ['SUPER_ADMIN', 'NAGARSEVAK', 'EMPLOYEE'].includes(req.user.roleName)
    || (req.user.roleName === 'SUB_MASTER_ADMIN' && Array.isArray(req.user.permissions) && req.user.permissions.includes('DELETE_MEDICALS'));
}

function applyWardScope(req, where) {
  const ids = allowedWardIds(req);
  if (ids !== null) {
    where.wardId = ids.length === 1 ? ids[0] : { [Op.in]: ids.length ? ids : [EMPTY_ID] };
  }
  if (req.query.wardId) {
    if (!isWardAllowed(req, req.query.wardId)) throw new ApiError(403, 'You do not have access to this ward');
    where.wardId = req.query.wardId;
  }
}

function scopedWhere(req, { listFilters = true } = {}) {
  const where = {};
  applyWardScope(req, where);
  if (req.query.areaId) where.areaId = req.query.areaId;
  if (req.user.roleName === 'CITIZEN') where.status = 'ACTIVE';
  else if (req.query.status) {
    const s = String(req.query.status).toUpperCase();
    if (s === 'ACTIVE' || s === 'INACTIVE') where.status = s;
  }
  if (!listFilters) return where;

  if (req.query.type) {
    const t = String(req.query.type).toUpperCase();
    if (TYPES.includes(t)) where.type = t;
  }
  if (req.query.is24x7 === '1' || req.query.is24x7 === 'true') {
    where.is24x7 = true;
  }
  if (req.query.homeDelivery === '1' || req.query.homeDelivery === 'true') {
    where.homeDelivery = true;
  }
  if (req.query.mapped === '1' || req.query.mapped === 'true') {
    where.latitude = { [Op.ne]: null };
    where.longitude = { [Op.ne]: null };
  }
  const search = String(req.query.search || '').trim().slice(0, 60).replace(/[%_]/g, '');
  if (search) {
    const like = `%${search}%`;
    where[Op.or] = [
      { name: { [Op.like]: like } },
      { phone: { [Op.like]: like } },
      { address: { [Op.like]: like } },
      { landmark: { [Op.like]: like } },
    ];
  }
  return where;
}

const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const where = scopedWhere(req, { listFilters: true });
  const kpiWhere = scopedWhere(req, { listFilters: false });

  const [result, totalAll, is24x7Count, deliveryCount, mappedCount] = await Promise.all([
    MedicalStore.findAndCountAll({
      where,
      include,
      attributes: LIST_ATTR,
      order: [['is24x7', 'DESC'], ['name', 'ASC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    }),
    MedicalStore.count({ where: kpiWhere }),
    MedicalStore.count({ where: { ...kpiWhere, is24x7: true } }),
    MedicalStore.count({ where: { ...kpiWhere, homeDelivery: true } }),
    MedicalStore.count({
      where: { ...kpiWhere, latitude: { [Op.ne]: null }, longitude: { [Op.ne]: null } },
    }),
  ]);

  return success(res, {
    data: result.rows,
    meta: {
      total: result.count,
      page,
      limit,
      pages: Math.ceil(result.count / limit) || 1,
      kpis: { total: totalAll, is24x7: is24x7Count, homeDelivery: deliveryCount, mapped: mappedCount },
    },
  });
});

const detail = asyncHandler(async (req, res) => {
  const where = { id: req.params.id };
  applyWardScope(req, where);
  const row = await MedicalStore.findOne({ where, include });
  if (!row) throw new ApiError(404, 'Medical store not found or access denied');
  return success(res, { data: row });
});

const create = asyncHandler(async (req, res) => {
  if (!canManage(req)) throw new ApiError(403, 'Permission denied');
  const wardId = req.body.wardId || req.user.wardId;
  if (!wardId) throw new ApiError(400, 'Ward is required');
  if (!isWardAllowed(req, wardId)) throw new ApiError(403, 'You do not have access to this ward');

  const fields = medicalFields(req.body);
  if (!fields.name) throw new ApiError(400, 'Name is required');

  if (req.body.areaId) {
    const area = await Area.findOne({ where: { id: req.body.areaId, wardId } });
    if (!area) throw new ApiError(400, 'Selected area does not belong to the ward');
  }

  const created = await MedicalStore.create({
    ...fields,
    wardId,
    areaId: req.body.areaId || null,
    createdByUserId: req.user.id,
  });

  await logAudit(req, {
    action: 'CREATE_MEDICAL',
    entity: 'MedicalStore',
    entityId: created.id,
    details: { name: created.name, wardId, areaId: created.areaId },
  });

  const full = await MedicalStore.findByPk(created.id, { include });
  return success(res, { data: full, statusCode: 201 });
});

const update = asyncHandler(async (req, res) => {
  if (!canManage(req)) throw new ApiError(403, 'Permission denied');
  const where = { id: req.params.id };
  applyWardScope(req, where);
  const row = await MedicalStore.findOne({ where });
  if (!row) throw new ApiError(404, 'Medical store not found or access denied');

  const nextWardId = req.body.wardId || row.wardId;
  if (!isWardAllowed(req, nextWardId)) throw new ApiError(403, 'You do not have access to this ward');

  const patch = medicalFields({ ...row.toJSON(), ...req.body });
  if (!patch.name) throw new ApiError(400, 'Name is required');

  const nextAreaId = req.body.areaId !== undefined ? (req.body.areaId || null) : row.areaId;
  if (nextAreaId) {
    const area = await Area.findOne({ where: { id: nextAreaId, wardId: nextWardId } });
    if (!area) throw new ApiError(400, 'Selected area does not belong to the target ward');
  }

  await row.update({
    ...patch,
    wardId: nextWardId,
    areaId: nextAreaId,
  });

  await logAudit(req, {
    action: 'UPDATE_MEDICAL',
    entity: 'MedicalStore',
    entityId: row.id,
    details: { name: row.name, wardId: row.wardId, areaId: row.areaId },
  });

  const full = await MedicalStore.findByPk(row.id, { include });
  return success(res, { data: full });
});

const remove = asyncHandler(async (req, res) => {
  if (!canDelete(req)) throw new ApiError(403, 'Permission denied');
  const where = { id: req.params.id };
  applyWardScope(req, where);
  const row = await MedicalStore.findOne({ where });
  if (!row) throw new ApiError(404, 'Medical store not found or access denied');

  await row.destroy();

  await logAudit(req, {
    action: 'DELETE_MEDICAL',
    entity: 'MedicalStore',
    entityId: row.id,
    details: { name: row.name, wardId: row.wardId },
  });

  return success(res, { data: { id: req.params.id }, message: 'Medical store deleted successfully' });
});

module.exports = {
  list,
  detail,
  create,
  update,
  remove,
};
