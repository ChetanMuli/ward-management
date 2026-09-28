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
  AllChatMessage,
  GroupChatMessage,
  WardChatMessage,
} = require('../../models');
const fs = require('fs');
const path = require('path');
const GOV_STORAGE = path.resolve(__dirname, '../../../storage/government-voter-lists');
const CHAT_STORAGE = path.resolve(process.env.CHAT_UPLOAD_DIR || path.join(__dirname, '../../../uploads/chat'));
const { success } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

async function cleanupAuditLogs(days = 2) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return AuditLog.destroy({ where: { createdAt: { [Op.lt]: cutoff } } });
}

// Any data moved to the Recycle Bin (manual delete or 75-day auto-archive)
// is permanently deleted after staying in the Recycle Bin for 30 days.
async function cleanupRecycleBin(days = 30) {
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
    AllChatMessage,
    GroupChatMessage,
    WardChatMessage,
  ];

  for (const Model of models) {
    if (!Model) continue;
    try {
      const deletedCol = Model.options?.deletedAt || Model.rawAttributes?.deletedAt?.field || 'deletedAt';
      // Clean up chat attachments if applicable
      if ([AllChatMessage, GroupChatMessage, WardChatMessage].includes(Model)) {
        try {
          const expiredMsgs = await Model.findAll({
            where: { [deletedCol]: { [Op.lt]: cutoff } },
            paranoid: false,
            attributes: ['id', 'imagePath'],
            limit: 500,
          });
          for (const row of expiredMsgs) {
            if (row.imagePath) {
              const file = path.join(CHAT_STORAGE, path.basename(row.imagePath));
              try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) {}
            }
          }
        } catch (_) {}
      }

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
