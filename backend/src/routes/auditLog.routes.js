const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');
const { AuditLog } = require('../models');

const router = express.Router();

// Read-only by design: no POST/PATCH/DELETE routes exist for audit logs anywhere in this app.
router.get('/', authenticate, requireRole('SUPER_ADMIN'), asyncHandler(async (req, res) => {
  const { entity, recordId, page = 1, limit = 50 } = req.query;
  const where = {};
  if (entity) where.entity = entity;
  if (recordId) where.recordId = recordId;

  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: Number(limit),
    offset: (Number(page) - 1) * Number(limit),
  });

  return success(res, { data: rows, meta: { total: count, page: Number(page), limit: Number(limit) } });
}));

module.exports = router;
