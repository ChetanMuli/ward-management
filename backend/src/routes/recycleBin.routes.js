const express=require('express');
const {authenticate}=require('../middleware/auth.middleware');
const {requireRole}=require('../middleware/rbac.middleware');
const ctrl=require('../controllers/recycleBin.controller');
const router=express.Router();
router.use(authenticate,requireRole('SUPER_ADMIN'));
router.get('/',ctrl.list);
router.post('/:entity/:id/restore',ctrl.restore);
module.exports=router;
