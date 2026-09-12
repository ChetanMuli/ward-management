const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const ctrl = require('../controllers/ward.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);

router.post(
  '/',
  requireRole('SUPER_ADMIN'),
  [body('wardNumber').notEmpty()],
  validate,
  ctrl.create
);

router.patch('/:id', requireRole('SUPER_ADMIN'), ctrl.update);
router.delete('/:id', requireRole('SUPER_ADMIN'), ctrl.remove);

router.post(
  '/:wardId/areas',
  requireRole('SUPER_ADMIN'),
  [body('name').notEmpty()],
  validate,
  ctrl.createArea
);

router.patch('/areas/:areaId', requireRole('SUPER_ADMIN'), ctrl.updateArea);
router.delete('/areas/:areaId', requireRole('SUPER_ADMIN'), ctrl.removeArea);

module.exports = router;
