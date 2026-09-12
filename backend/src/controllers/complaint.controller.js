const { v4: uuidv4 } = require('uuid');
const { Complaint, ComplaintHistory, House } = require('../models');
const ApiError = require('../utils/ApiError');
const { success } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../services/audit.service');

// SRS section 18: SLA hours are "examples only" - kept as simple config here,
// promote to a DB-backed SLAPolicy table (per category+priority) at P2.
const SLA_HOURS = { CRITICAL: 24, HIGH: 48, MEDIUM: 72, LOW: 168 };

function generateComplaintNumber() {
  return `CMP-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;
}

const list = asyncHandler(async (req, res) => {
  const { status, priority, category, personId } = req.query;
  const where = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (category) where.category = category;

  // Citizen scoping: scopeToOwnPerson middleware forces personId onto req.query.
  if (personId) where.citizenPersonId = personId;

  const complaints = await Complaint.findAll({ where, order: [['createdAt', 'DESC']] });
  return success(res, { data: complaints });
});

const getById = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findByPk(req.params.id, { include: [{ model: ComplaintHistory, as: 'history' }] });
  if (!complaint) throw new ApiError(404, 'Complaint not found');

  if (req.user.roleName === 'CITIZEN' && complaint.citizenPersonId !== req.user.personId) {
    throw new ApiError(403, 'You may only view your own complaints');
  }
  return success(res, { data: complaint });
});

const create = asyncHandler(async (req, res) => {
  const { houseId, category, description, priority = 'MEDIUM' } = req.body;

  const house = await House.findByPk(houseId);
  if (!house) throw new ApiError(400, 'Referenced house does not exist');

  const citizenPersonId = req.user.roleName === 'CITIZEN' ? req.user.personId : req.body.citizenPersonId;
  if (!citizenPersonId) throw new ApiError(400, 'citizenPersonId is required');

  const slaDueAt = new Date(Date.now() + (SLA_HOURS[priority] || SLA_HOURS.MEDIUM) * 60 * 60 * 1000);

  const complaint = await Complaint.create({
    complaintNumber: generateComplaintNumber(),
    citizenPersonId, houseId, category, description, priority,
    status: 'SUBMITTED',
    slaDueAt,
  });

  await ComplaintHistory.create({
    complaintId: complaint.id, oldStatus: null, newStatus: 'SUBMITTED',
    changedByUserId: req.user.id, comment: 'Complaint created',
  });

  await logAudit({ user: req.user, action: 'CREATE_COMPLAINT', entity: 'Complaint', recordId: complaint.id, newValue: req.body, ipAddress: req.ip });
  // TODO: notify(assignedEmployee/Admin) via the notification service once channels are wired.

  return success(res, { data: complaint, statusCode: 201, message: 'Complaint submitted' });
});

const assign = asyncHandler(async (req, res) => {
  const { employeeId } = req.body;
  const complaint = await Complaint.findByPk(req.params.id);
  if (!complaint) throw new ApiError(404, 'Complaint not found');

  const oldStatus = complaint.status;
  await complaint.update({ assignedEmployeeId: employeeId, status: 'ASSIGNED' });

  await ComplaintHistory.create({
    complaintId: complaint.id, oldStatus, newStatus: 'ASSIGNED',
    changedByUserId: req.user.id, comment: `Assigned to employee ${employeeId}`,
  });

  await logAudit({ user: req.user, action: 'ASSIGN_COMPLAINT', entity: 'Complaint', recordId: complaint.id, oldValue: { status: oldStatus }, newValue: { employeeId, status: 'ASSIGNED' }, ipAddress: req.ip });
  return success(res, { data: complaint, message: 'Complaint assigned' });
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status, comment, resolutionNote } = req.body;
  const complaint = await Complaint.findByPk(req.params.id);
  if (!complaint) throw new ApiError(404, 'Complaint not found');

  if (status === 'RESOLVED' && !resolutionNote) {
    throw new ApiError(400, 'resolutionNote is mandatory when resolving a complaint');
  }

  const oldStatus = complaint.status;
  await complaint.update({
    status,
    resolutionNote: resolutionNote || complaint.resolutionNote,
    resolvedAt: status === 'RESOLVED' ? new Date() : complaint.resolvedAt,
  });

  await ComplaintHistory.create({
    complaintId: complaint.id, oldStatus, newStatus: status,
    changedByUserId: req.user.id, comment,
  });

  await logAudit({ user: req.user, action: 'UPDATE_COMPLAINT_STATUS', entity: 'Complaint', recordId: complaint.id, oldValue: { status: oldStatus }, newValue: { status }, ipAddress: req.ip });
  return success(res, { data: complaint, message: 'Complaint status updated' });
});

const remove = asyncHandler(async(req,res)=>{ const complaint=await Complaint.findByPk(req.params.id); if(!complaint) throw new ApiError(404,'Complaint not found'); await complaint.destroy(); await logAudit({user:req.user,action:'SOFT_DELETE_COMPLAINT',entity:'Complaint',recordId:complaint.id,newValue:{deleted:true},ipAddress:req.ip}); return success(res,{message:'Complaint moved to recycle bin'}); });

/** Overdue complaints for the escalation dashboard (SRS section 18). */
const overdue = asyncHandler(async (req, res) => {
  const { Op } = require('sequelize');
  const complaints = await Complaint.findAll({
    where: {
      slaDueAt: { [Op.lt]: new Date() },
      status: { [Op.notIn]: ['RESOLVED', 'CLOSED'] },
    },
    order: [['slaDueAt', 'ASC']],
  });
  return success(res, { data: complaints });
});

module.exports = { list, getById, create, assign, updateStatus, remove, overdue };
