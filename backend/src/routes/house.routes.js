const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole, scopeToEmployeeAreas } = require('../middleware/rbac.middleware');
const ctrl = require('../controllers/house.controller');

const router = express.Router();

router.use(authenticate, requireRole('SUPER_ADMIN', 'EMPLOYEE'), scopeToEmployeeAreas);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);

router.post(
  '/',
  [body('houseNumber').notEmpty(), body('areaId').isUUID(), body('address').notEmpty()],
  validate,
  ctrl.create
);

router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.delete('/:id', ctrl.remove);
router.post('/:id/verify', ctrl.verify);

module.exports = router;
