const { Op } = require('sequelize');
const { Ward, Area, House, Family, Person, Complaint } = require('../../models');
const ApiError = require('../../utils/ApiError');

function allowedWardIds(req) {
  if (req.user.roleName === 'SUPER_ADMIN') return null;
  if (req.user.roleName === 'SUB_MASTER_ADMIN') return Array.isArray(req.user.wardIds) ? req.user.wardIds : [];
  return req.user.wardId ? [req.user.wardId] : [];
}
function isWardAllowed(req, wardId) {
  if (!wardId) return false;
  const ids=allowedWardIds(req);
  if (ids===null) return true;
  const id=String(wardId);
  return ids.map(String).includes(id);
}
async function getScope(req) {
  const ids=allowedWardIds(req);
  if (ids===null) return { wardId: null, wardIds: null, areaIds: null };
  if (!ids.length) return { wardId: null, wardIds: [], areaIds: [] };
  const areas = await Area.findAll({ where: { wardId: { [Op.in]: ids } }, attributes: ['id'] });
  return { wardId: ids.length===1 ? ids[0] : null, wardIds: ids, areaIds: areas.map(a=>a.id) };
}

function applyWardQuery(where, req, field = 'wardId') {
  const ids=allowedWardIds(req);
  if (ids!==null) where[field] = ids.length===1 ? ids[0] : { [Op.in]: ids.length ? ids : ['00000000-0000-0000-0000-000000000000'] };
  return where;
}

async function assertWard(wardId, req) {
  if (!isWardAllowed(req, wardId)) throw new ApiError(403, 'You do not have access to this ward');
}

async function assertHouse(houseId, req) {
  const house = await House.findByPk(houseId, { include: [{ model: Area, as: 'area', include: [{ model: Ward, as: 'ward' }] }] });
  if (!house) throw new ApiError(404, 'House not found');
  if (!isWardAllowed(req, house.area?.wardId)) throw new ApiError(403, 'House belongs to another ward');
  return house;
}

async function assertFamily(familyId, req) {
  const family = await Family.findByPk(familyId, { include: [{ model: House, as: 'house', include: [{ model: Area, as: 'area' }] }] });
  if (!family) throw new ApiError(404, 'Family not found');
  if (!isWardAllowed(req, family.house?.area?.wardId)) throw new ApiError(403, 'Family belongs to another ward');
  return family;
}

async function assertPerson(personId, req) {
  const person = await Person.findByPk(personId, { include: [{ model: Family, as: 'family', include: [{ model: House, as: 'house', include: [{ model: Area, as: 'area' }] }] }] });
  if (!person) throw new ApiError(404, 'Citizen not found');
  if (!isWardAllowed(req, person.family?.house?.area?.wardId)) throw new ApiError(403, 'Citizen belongs to another ward');
  return person;
}

async function assertComplaint(complaintId, req) {
  const complaint = await Complaint.findByPk(complaintId, { include: [{ model: House, as: 'house', include: [{ model: Area, as: 'area' }] }] });
  if (!complaint) throw new ApiError(404, 'Complaint not found');
  const wardId = complaint.wardId || complaint.house?.area?.wardId;
  if (!isWardAllowed(req, wardId)) throw new ApiError(403, 'Complaint belongs to another ward');
  if (req.user.roleName === 'CITIZEN' && complaint.submittedByUserId !== req.user.id) throw new ApiError(403, 'You can view only your own complaints');
  if (req.user.roleName === 'EMPLOYEE' && complaint.assignedEmployeeId !== req.user.employeeProfile?.id) throw new ApiError(403, 'Complaint is not assigned to you');
  return complaint;
}

module.exports = { getScope, allowedWardIds, isWardAllowed, applyWardQuery, assertWard, assertHouse, assertFamily, assertPerson, assertComplaint };
