const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const ctrl = require('../controllers/person.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', requireRole('SUPER_ADMIN', 'EMPLOYEE'), ctrl.list);
router.get('/18plus-upcoming', requireRole('SUPER_ADMIN', 'EMPLOYEE'), ctrl.upcoming18);
router.get('/birthdays-upcoming', requireRole('SUPER_ADMIN', 'EMPLOYEE'), ctrl.upcomingBirthdays);

router.get('/:id', ctrl.getById); // citizen self-access enforced inside controller

router.post(
  '/',
  requireRole('SUPER_ADMIN', 'EMPLOYEE'),
  [body('fullName').notEmpty(), body('familyId').isUUID(), body('dob').optional({ nullable: true, checkFalsy: true }).isDate(), body('gender').optional({ nullable: true, checkFalsy: true }).isIn(['MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED'])],
  validate,
  ctrl.create
);

router.patch('/:id', requireRole('SUPER_ADMIN', 'EMPLOYEE'), ctrl.update);

router.patch('/:id/followup', requireRole('SUPER_ADMIN', 'EMPLOYEE'), ctrl.updateFollowup);
router.delete('/:id', requireRole('SUPER_ADMIN', 'EMPLOYEE'), ctrl.remove);

router.patch('/:id/voter-status', requireRole('SUPER_ADMIN', 'EMPLOYEE'), ctrl.updateVoterStatus);

router.post('/:id/death-record', requireRole('SUPER_ADMIN', 'EMPLOYEE'), ctrl.createDeathRecord);
router.post('/:id/death-record/verify', requireRole('SUPER_ADMIN'), ctrl.verifyDeathRecord);

module.exports = router;
