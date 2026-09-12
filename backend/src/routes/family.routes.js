const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const ctrl = require('../controllers/family.controller');

const router = express.Router();

router.use(authenticate, requireRole('SUPER_ADMIN', 'EMPLOYEE'));

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', [body('houseId').isUUID()], validate, ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.delete('/:id', ctrl.remove);

module.exports = router;
