const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const ctrl = require('../controllers/dashboard.controller');

const router = express.Router();

router.get('/summary', authenticate, requireRole('SUPER_ADMIN', 'NAGARSEVAK', 'EMPLOYEE'), ctrl.summary);

module.exports = router;
