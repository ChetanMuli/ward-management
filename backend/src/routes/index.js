const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/wards', require('./ward.routes'));
router.use('/houses', require('./house.routes'));
router.use('/families', require('./family.routes'));
router.use('/persons', require('./person.routes'));
router.use('/complaints', require('./complaint.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/audit-logs', require('./auditLog.routes'));
router.use('/recycle-bin', require('./recycleBin.routes'));

module.exports = router;
