const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole, scopeToOwnPerson } = require('../middleware/rbac.middleware');
const ctrl = require('../controllers/complaint.controller');

const router = express.Router();

router.use(authenticate);

router.get('/overdue', requireRole('SUPER_ADMIN', 'EMPLOYEE'), ctrl.overdue);
router.get('/', scopeToOwnPerson, ctrl.list);
router.get('/:id', ctrl.getById);

router.post(
  '/',
  [body('houseId').isUUID(), body('category').notEmpty(), body('description').notEmpty()],
  validate,
  ctrl.create
);

router.post('/:id/assign', requireRole('SUPER_ADMIN'), [body('employeeId').isUUID()], validate, ctrl.assign);
router.delete('/:id', requireRole('SUPER_ADMIN'), ctrl.remove);
router.patch('/:id/status', requireRole('SUPER_ADMIN', 'EMPLOYEE'), [body('status').notEmpty()], validate, ctrl.updateStatus);

module.exports = router;
