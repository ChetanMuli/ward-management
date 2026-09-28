const { Op } = require('sequelize');
const {
  AuditLog,
  Ward,
  Area,
  Apartment,
  House,
  Shop,
  Family,
  Person,
  VoterProfile,
  Complaint,
  GovernmentVoterList,
  NagarsevakSchedule,
  DeathRecord,
  WardUpdate,
  Scheme,
  User,
  AdminUser,
  SubAdminUser,
  NagarsevakUser,
  EmployeeUser,
  CitizenUser,
  CommunityUser,
} = require('../../models');
const fs = require('fs');
const path = require('path');
const GOV_STORAGE = path.resolve(__dirname, '../../../storage/government-voter-lists');
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

async function cleanupAuditLogs(days = 2) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return AuditLog.destroy({ where: { createdAt: { [Op.lt]: cutoff } } });
}

async function cleanupRecycleBin(days = 60) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let total = 0;
  const models = [
    Ward,
    Area,
    Apartment,
    House,
    Shop,
    Family,
    Person,
    VoterProfile,
    Complaint,
    NagarsevakSchedule,
    DeathRecord,
    WardUpdate,
    Scheme,
    User,
    AdminUser,
    SubAdminUser,
    NagarsevakUser,
    EmployeeUser,
    CitizenUser,
    CommunityUser,
  ];

  for (const Model of models) {
    try {
      const deletedCol = Model.options.deletedAt || Model.rawAttributes?.deletedAt?.field || 'deletedAt';
      const count = await Model.destroy({
        where: { [deletedCol]: { [Op.lt]: cutoff } },
        paranoid: false,
        force: true,
      });
      total += (count || 0);
    } catch (_) {}
  }

  try {
    const gov = await GovernmentVoterList.findAll({
      where: { deletedAt: { [Op.lt]: cutoff } },
      paranoid: false,
    });
    for (const row of gov) {
      try {
        await fs.promises.unlink(path.join(GOV_STORAGE, row.storedFileName));
      } catch (_) {}
      await row.destroy({ force: true });
      total += 1;
    }
  } catch (_) {}

  return total;
}

const clearAudit = asyncHandler(async (req, res) => {
  const count = await AuditLog.destroy({ where: {} });
  return success(res, { data: { deleted: count }, message: `${count} audit log${count === 1 ? '' : 's'} cleared successfully` });
});

const clearRecycle = asyncHandler(async (req, res) => {
  const count = await cleanupRecycleBin(0);
  return success(res, { data: { deleted: count }, message: `${count} recycle record${count === 1 ? '' : 's'} permanently cleared` });
});

const maintenance = asyncHandler(async (req, res) => {
  const audit = await cleanupAuditLogs(2);
  const recycle = await cleanupRecycleBin(60);
  return success(res, { data: { auditDeleted: audit, recycleDeleted: recycle } });
});

module.exports = { cleanupAuditLogs, cleanupRecycleBin, clearAudit, clearRecycle, maintenance };
