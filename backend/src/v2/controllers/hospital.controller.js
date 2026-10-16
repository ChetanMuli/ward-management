const { Op } = require('sequelize');
const { Hospital, Area, Ward } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { logAudit } = require('../../services/audit.service');
const { allowedWardIds, isWardAllowed } = require('../services/wardScope');

const TYPES = ['GOVERNMENT', 'PRIVATE', 'TRUST', 'CLINIC', 'PHC', 'AYUSH', 'OTHER'];
const EMPTY_ID = '00000000-0000-0000-0000-000000000000';
const LIST_ATTR = [
  'id', 'wardId', 'areaId', 'name', 'type', 'address', 'landmark',
  'phone', 'emergencyPhone', 'openingHours', 'latitude', 'longitude', 'status', 'updatedAt',
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

function hospitalFields(body) {
  const typeRaw = String(body.type || 'PRIVATE').toUpperCase();
  const type = TYPES.includes(typeRaw) ? typeRaw : 'PRIVATE';
  const status = String(body.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  return {
    name: String(body.name || '').trim().slice(0, 180),
    type,
    address: String(body.address || '').trim().slice(0, 2000),
    landmark: emptyToNull(body.landmark)?.slice(0, 180) || null,
    phone: emptyToNull(body.phone)?.slice(0, 20) || null,
    emergencyPhone: emptyToNull(body.emergencyPhone)?.slice(0, 20) || null,
    openingHours: emptyToNull(body.openingHours)?.slice(0, 120) || null,
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
      && (req.user.permissions.includes('CREATE_HOSPITALS') || req.user.permissions.includes('EDIT_HOSPITALS')));
}

function canDelete(req) {
  return ['SUPER_ADMIN', 'NAGARSEVAK', 'EMPLOYEE'].includes(req.user.roleName)
    || (req.user.roleName === 'SUB_MASTER_ADMIN' && Array.isArray(req.user.permissions) && req.user.permissions.includes('DELETE_HOSPITALS'));
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
  const group = String(req.query.typeGroup || '').toLowerCase();
  if (group === 'gov') where.type = { [Op.in]: ['GOVERNMENT', 'PHC'] };
  if (group === 'private') where.type = { [Op.in]: ['PRIVATE', 'CLINIC'] };
  if (req.query.mapped === '1' || req.query.mapped === 'true') {
    where.latitude = { [Op.ne]: null };
    where.longitude = { [Op.ne]: null };
  }
  const search = String(req.query.search || '').trim().slice(0, 60).replace(/[%_]/g, '');
  if (search) {
    const like = `%${search}%`;
    const cityWide = !req.query.wardId && allowedWardIds(req) === null;
    where[Op.or] = cityWide
      ? [{ name: { [Op.like]: like } }, { phone: { [Op.like]: `${search}%` } }]
      : [
        { name: { [Op.like]: like } },
        { phone: { [Op.like]: `${search}%` } },
        { landmark: { [Op.like]: like } },
        { address: { [Op.like]: like } },
      ];
  }
  return where;
}

const list = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 50);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const where = scopedWhere(req);
  const kpiWhere = scopedWhere(req, { listFilters: false });

  const [result, totalAll, government, privateCount, mapped] = await Promise.all([
    Hospital.findAndCountAll({
      where,
      include,
      attributes: LIST_ATTR,
      limit,
      offset: (page - 1) * limit,
      order: [['name', 'ASC'], ['id', 'ASC']],
      subQuery: false,
    }),
    Hospital.count({ where: kpiWhere }),
    Hospital.count({ where: { ...kpiWhere, type: { [Op.in]: ['GOVERNMENT', 'PHC'] } } }),
    Hospital.count({ where: { ...kpiWhere, type: { [Op.in]: ['PRIVATE', 'CLINIC'] } } }),
    Hospital.count({
      where: { ...kpiWhere, latitude: { [Op.ne]: null }, longitude: { [Op.ne]: null } },
    }),
  ]);

  return success(res, {
    data: result.rows,
    meta: {
      total: result.count,
      page,
      limit,
      kpis: { total: totalAll, government, private: privateCount, mapped },
    },
  });
});

const detail = asyncHandler(async (req, res) => {
  const row = await Hospital.findByPk(req.params.id, { include });
  if (!row) throw new ApiError(404, 'Hospital not found');
  if (!isWardAllowed(req, row.wardId)) throw new ApiError(403, 'You do not have access to this ward');
  if (req.user.roleName === 'CITIZEN' && row.status !== 'ACTIVE') throw new ApiError(404, 'Hospital not found');
  return success(res, { data: row });
});

const create = asyncHandler(async (req, res) => {
  if (!canManage(req)) throw new ApiError(403, 'You cannot add hospitals');
  let wardId = req.body.wardId || req.user.wardId;
  if (req.user.roleName === 'NAGARSEVAK' || req.user.roleName === 'EMPLOYEE') {
    wardId = req.user.wardId;
  }
  if (!wardId) throw new ApiError(400, 'Ward is required');
  if (!isWardAllowed(req, wardId)) throw new ApiError(403, 'You do not have access to this ward');

  let areaId = emptyToNull(req.body.areaId);
  if (areaId) {
    const area = await Area.findByPk(areaId, { attributes: ['id', 'wardId'] });
    if (!area) throw new ApiError(400, 'Colony / area is invalid');
    if (String(area.wardId) !== String(wardId)) throw new ApiError(400, 'Area does not belong to the selected ward');
  }

  const fields = hospitalFields(req.body);
  if (!fields.name) throw new ApiError(400, 'Hospital name is required');

  const row = await Hospital.create({
    ...fields,
    wardId,
    areaId,
    createdByUserId: req.user.id,
  });
  await logAudit({
    user: req.user,
    action: 'CREATE_HOSPITAL',
    entity: 'Hospital',
    recordId: row.id,
    newValue: { name: fields.name, type: fields.type, wardId },
    ipAddress: req.ip,
  });
  const full = await Hospital.findByPk(row.id, { include, attributes: LIST_ATTR.concat(['facilities', 'notes']) });
  return success(res, { statusCode: 201, data: full, message: 'Hospital added' });
});

const update = asyncHandler(async (req, res) => {
  if (!canManage(req)) throw new ApiError(403, 'You cannot edit this hospital');
  const row = await Hospital.findByPk(req.params.id);
  if (!row) throw new ApiError(404, 'Hospital not found');
  if (!isWardAllowed(req, row.wardId)) throw new ApiError(403, 'You do not have access to this ward');
  const old = { name: row.name, type: row.type, status: row.status, wardId: row.wardId };
  const patch = hospitalFields({ ...row.toJSON(), ...req.body });

  if (req.body.wardId && ['SUPER_ADMIN', 'SUB_MASTER_ADMIN'].includes(req.user.roleName)) {
    if (!isWardAllowed(req, req.body.wardId)) throw new ApiError(403, 'You do not have access to this ward');
    patch.wardId = req.body.wardId;
  }

  if (req.body.areaId !== undefined) {
    const areaId = emptyToNull(req.body.areaId);
    if (areaId) {
      const area = await Area.findByPk(areaId, { attributes: ['id', 'wardId'] });
      if (!area) throw new ApiError(400, 'Colony / area is invalid');
      const wardId = patch.wardId || row.wardId;
      if (String(area.wardId) !== String(wardId)) throw new ApiError(400, 'Area does not belong to the selected ward');
      patch.areaId = area.id;
    } else {
      patch.areaId = null;
    }
  }

  if (!patch.name) throw new ApiError(400, 'Hospital name is required');
  await row.update(patch);
  await logAudit({
    user: req.user,
    action: 'UPDATE_HOSPITAL',
    entity: 'Hospital',
    recordId: row.id,
    oldValue: old,
    newValue: { name: patch.name, type: patch.type, status: patch.status },
    ipAddress: req.ip,
  });
  const full = await Hospital.findByPk(row.id, { include, attributes: LIST_ATTR.concat(['facilities', 'notes']) });
  return success(res, { data: full, message: 'Hospital updated' });
});

const remove = asyncHandler(async (req, res) => {
  if (!canDelete(req)) throw new ApiError(403, 'You cannot remove this hospital');
  const row = await Hospital.findByPk(req.params.id, { attributes: ['id', 'wardId', 'name'] });
  if (!row) throw new ApiError(404, 'Hospital not found');
  if (!isWardAllowed(req, row.wardId)) throw new ApiError(403, 'You do not have access to this ward');
  await row.destroy();
  await logAudit({
    user: req.user,
    action: 'SOFT_DELETE_HOSPITAL',
    entity: 'Hospital',
    recordId: row.id,
    newValue: { deleted: true, name: row.name },
    ipAddress: req.ip,
  });
  return success(res, { message: 'Hospital moved to recycle bin' });
});

module.exports = { list, detail, create, update, remove };
