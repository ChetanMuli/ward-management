const { AuditLog } = require('../models');

/**
 * Records an immutable audit entry. Called explicitly from controllers after
 * every create/update/status-change/approve/export action - never optional,
 * per SRS section 26.
 */
async function logAudit({ user, action, entity, recordId, oldValue, newValue, ipAddress }) {
  try {
    await AuditLog.create({
      userId: user ? user.id : null,
      role: user ? user.roleName : 'SYSTEM',
      action,
      entity,
      recordId,
      oldValue: oldValue || null,
      newValue: newValue || null,
      ipAddress: ipAddress || null,
    });
  } catch (err) {
    // Audit logging must never crash the primary request, but must be loud
    // in server logs so gaps in the trail are noticed and fixed.
    console.error('[AUDIT LOG FAILURE]', { action, entity, recordId, error: err.message });
  }
}

module.exports = { logAudit };
