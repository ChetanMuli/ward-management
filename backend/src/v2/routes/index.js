const express=require('express');
const rateLimit=require('express-rate-limit');
const {body}=require('express-validator');
const validate=require('../../middleware/validate.middleware');
const {authenticateV2,requireV2Role,requirePermission}=require('../middleware/auth');
const auth=require('../controllers/auth.controller');
const staff=require('../controllers/staff.controller');
const wards=require('../controllers/ward.controller');
const dashboard=require('../controllers/dashboard.controller');
const data=require('../controllers/data.controller');
const exporter=require('../controllers/export.controller');
const recycle=require('../controllers/recycle.controller');
const complaints=require('../controllers/complaint.controller');
const notifications=require('../controllers/notification.controller');
const schemes=require('../controllers/scheme.controller');
const maintenance=require('../controllers/maintenance.controller');
const deaths=require('../controllers/death.controller');
const governmentVoterLists=require('../controllers/governmentVoterList.controller');
const wardUpdates=require('../controllers/wardUpdate.controller');
const chat=require('../controllers/chat.controller');
const election=require('../controllers/election.controller');
const stakeholder=require('../controllers/stakeholder.controller');
const wardActivation=require('../controllers/wardActivation.controller');
const multer=require('multer');
const voterListUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:100*1024*1024},fileFilter:(req,file,cb)=>{const ext=require('path').extname(file.originalname||'').toLowerCase();cb(null,['.pdf','.xlsx','.csv'].includes(ext));}});
const router=express.Router();
const registrationLimiter=rateLimit({windowMs:15*60*1000,max:10,standardHeaders:true,legacyHeaders:false});

router.get('/auth/registration-wards',registrationLimiter,auth.registrationWards);
router.post('/auth/register',registrationLimiter,[
  body('name').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('mobile').matches(/^\d{10}$/).withMessage('Mobile must be exactly 10 digits'),
  body('wardId').isUUID().withMessage('Valid ward is required'),
  body('password').isLength({min:8}).withMessage('Password must be at least 8 characters'),
  body('confirmPassword').custom((v,{req})=>v===req.body.password).withMessage('Passwords do not match')
],validate,auth.registerCitizen);

router.post('/auth/login',[body('identifier').trim().notEmpty().withMessage('Email or mobile is required'),body('password').notEmpty().withMessage('Password is required')],validate,auth.login);
const forgotLimiter=rateLimit({windowMs:15*60*1000,max:8,standardHeaders:true,legacyHeaders:false});
router.post('/auth/forgot/request',forgotLimiter,[
  body('identifier').trim().notEmpty().withMessage('Email or mobile is required'),
  body('channel').optional().isIn(['email','mobile']),
  body('audience').optional().isIn(['citizen','staff'])
],validate,auth.forgotRequest);
router.post('/auth/forgot/reset',forgotLimiter,[
  body('identifier').trim().notEmpty().withMessage('Email or mobile is required'),
  body('otp').isLength({min:6,max:6}).withMessage('Enter the 6-digit code'),
  body('password').isLength({min:8}).withMessage('Password must be at least 8 characters'),
  body('confirmPassword').custom((v,{req})=>v===req.body.password).withMessage('Passwords do not match'),
  body('channel').optional().isIn(['email','mobile'])
],validate,auth.forgotReset);
router.use(authenticateV2);
router.get('/permissions',staff.permissions);
// Community Members are an administration-only module. Keep its API explicit
// rather than relying on a non-existent VIEW_STAKEHOLDERS permission.
router.get('/stakeholders',requireV2Role('SUPER_ADMIN'),stakeholder.list);
router.post('/stakeholders',requireV2Role('SUPER_ADMIN'),stakeholder.create);
router.patch('/stakeholders/:id',requireV2Role('SUPER_ADMIN'),stakeholder.update);
router.delete('/stakeholders/:id',requireV2Role('SUPER_ADMIN'),stakeholder.remove);
router.get('/sub-admins',requireV2Role('SUPER_ADMIN'),staff.listSubAdmins);
router.post('/sub-admins',requireV2Role('SUPER_ADMIN'),[
  body('name').trim().notEmpty().withMessage('Full name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('mobile').trim().matches(/^\d{10}$/).withMessage('Mobile must be exactly 10 digits'),
  body('password').isLength({min:8}).withMessage('Password must be at least 8 characters')
],validate,staff.createSubAdmin);
router.patch('/sub-admins/:id',requireV2Role('SUPER_ADMIN'),staff.updateSubAdmin);
router.get('/chat/groups',requirePermission('VIEW_CHAT'),chat.listGroups);
router.post('/chat/groups',requirePermission('CREATE_CHAT_GROUP'),chat.createGroup);
router.delete('/chat/groups/:id',requirePermission('MANAGE_CHAT_GROUP'),chat.deleteGroup);
router.post('/chat/groups/:id/join',requirePermission('VIEW_CHAT'),chat.joinGroup);
router.post('/chat/groups/:id/leave',requirePermission('VIEW_CHAT'),chat.leaveGroup);
router.get('/chat/groups/:id/messages',requirePermission('VIEW_CHAT'),chat.listMessages);
router.post('/chat/groups/:id/messages',requirePermission('SEND_CHAT'),chat.sendMessage);
router.get('/chat/groups/:id/messages/:messageId/image',requirePermission('VIEW_CHAT'),chat.image);
router.patch('/chat/groups/:id/clear',requirePermission('VIEW_CHAT'),chat.clearChat);
router.patch('/chat/groups/:id/read',requirePermission('VIEW_CHAT'),chat.markRead);
router.get('/notifications',requirePermission('VIEW_NOTIFICATIONS'),notifications.list);
router.get('/ward-updates',wardUpdates.list);
router.post('/ward-updates',wardUpdates.create);
router.patch('/ward-updates/:id/archive',wardUpdates.archive);
router.post('/maintenance/audit/clear',requireV2Role('SUPER_ADMIN'),maintenance.clearAudit);
router.post('/maintenance/recycle/clear',requireV2Role('SUPER_ADMIN'),maintenance.clearRecycle);
router.patch('/notifications/:id/read',requirePermission('VIEW_NOTIFICATIONS'),notifications.markRead);
router.patch('/notifications/read-all',requirePermission('VIEW_NOTIFICATIONS'),notifications.markAllRead);
router.delete('/notifications/clear',requirePermission('VIEW_NOTIFICATIONS'),notifications.clearAll);
router.get('/notifications/recipients',notifications.recipients);
router.post('/notifications/send',notifications.send);
router.get('/notifications/scheme-recipients',notifications.schemeRecipients);
router.post('/notifications/scheme',notifications.sendScheme);
router.get('/me',(req,res)=>res.json({success:true,data:{user:req.user}}));
router.get('/me/ward',wardActivation.myWard);
router.get('/ward-activations',requireV2Role('SUPER_ADMIN'),wardActivation.board);
router.patch('/ward-activations/:wardId/ward',requireV2Role('SUPER_ADMIN'),wardActivation.setWard);
router.patch('/ward-activations/:wardId/nagarsevak',requireV2Role('SUPER_ADMIN'),wardActivation.setPurchase);
router.post('/ward-activations/:wardId/sync',requireV2Role('SUPER_ADMIN'),wardActivation.sync);
router.patch('/profile',auth.updateProfile);
router.post('/profile/password',auth.changePassword);
router.get('/wards',requirePermission('VIEW_WARDS'),wards.list);
router.post('/wards',requirePermission('CREATE_WARDS'),[body('wardNumber').notEmpty()],validate,wards.create);
router.patch('/wards/:id',requirePermission('EDIT_WARDS'),wards.update);
router.delete('/wards/:id',requirePermission('DELETE_WARDS'),wards.remove);
router.post('/wards/:wardId/areas',requirePermission('CREATE_WARDS'),wards.createArea);
router.patch('/areas/:id',requirePermission('EDIT_WARDS'),wards.updateArea);
router.delete('/areas/:id',requirePermission('DELETE_WARDS'),wards.removeArea);

router.get('/corporators',requirePermission('VIEW_STAFF'),staff.listCorporators);
router.post('/corporators',requirePermission('CREATE_STAFF'),[
  body('name').trim().notEmpty().withMessage('Full name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('mobile').trim().matches(/^\d{10}$/).withMessage('Mobile must be exactly 10 digits'),
  body('wardId').isUUID().withMessage('Valid ward is required'),
  body('password').isLength({min:6}).withMessage('Password must be at least 6 characters')
],validate,staff.createCorporator);
router.patch('/corporators/:id',requirePermission('EDIT_STAFF'),staff.updateCorporator);
router.post('/corporators/:id/convert-to-community',requireV2Role('SUPER_ADMIN'),requirePermission('EDIT_STAFF'),staff.convertCorporator);
router.delete('/corporators/:id',requireV2Role('SUPER_ADMIN'),requirePermission('DELETE_STAFF'),staff.deleteCorporator);

router.get('/employees',requirePermission('VIEW_STAFF'),staff.listEmployees);
router.get('/users',requirePermission('VIEW_USERS'),staff.listUsers);
router.patch('/users/:id',requirePermission('EDIT_USERS'),staff.updateUser);
router.delete('/users/:id',requirePermission('DELETE_USERS'),staff.deleteUser);
router.get('/ward-team',staff.listWardTeam);
router.post('/employees',requirePermission('CREATE_STAFF'),[
  body('name').trim().notEmpty().withMessage('Full name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('mobile').trim().matches(/^\d{10}$/).withMessage('Mobile must be exactly 10 digits'),
  body('wardId').isUUID().withMessage('Valid ward is required'),
  body('password').isLength({min:6}).withMessage('Password must be at least 6 characters'),
  body('managerUserId').optional().isUUID().withMessage('Managing Nagarsevak must be a valid account')
],validate,staff.createEmployee);
router.patch('/employees/:id',requirePermission('EDIT_STAFF'),staff.updateEmployee);
router.delete('/employees/:id',requirePermission('DELETE_STAFF'),staff.deleteEmployee);
router.post('/staff/password-reset/:userId',requireV2Role('SUPER_ADMIN'),staff.resetUserPassword);

router.get('/dashboard',requirePermission('VIEW_DASHBOARD'),dashboard.summary);
router.get('/houses',requirePermission('VIEW_HOUSES'),data.houses);
router.post('/houses',requirePermission('CREATE_HOUSES'),data.createHouse);
router.patch('/houses/:id',requirePermission('EDIT_HOUSES'),data.updateHouse);
router.delete('/houses/:id',requirePermission('DELETE_HOUSES'),data.deleteHouse);
router.get('/houses/:id',requirePermission('VIEW_HOUSES'),data.house);
router.get('/families',requirePermission('VIEW_FAMILIES'),data.families);
router.post('/families',requirePermission('CREATE_FAMILIES'),data.createFamily);
router.patch('/families/:id',requirePermission('EDIT_FAMILIES'),data.updateFamily);
router.delete('/families/:id',requirePermission('DELETE_FAMILIES'),data.deleteFamily);
router.get('/families/:id',requirePermission('VIEW_FAMILIES'),data.family);
router.get('/persons',requirePermission('VIEW_CITIZENS'),data.persons);
router.post('/persons',requirePermission('CREATE_CITIZENS'),data.createPerson);
router.delete('/persons/:id',requirePermission('DELETE_CITIZENS'),data.deletePerson);
router.get('/persons/:id',requirePermission('VIEW_CITIZENS'),data.person);
router.patch('/persons/:id',requirePermission('EDIT_CITIZENS'),data.updatePerson);
router.get('/voters',requirePermission('VIEW_VOTERS'),data.voters);
router.patch('/voters/:personId',requirePermission('EDIT_VOTERS'),data.updateVoter);
router.get('/complaints',(req,res,next)=>req.user.roleName==='CITIZEN'?next():requirePermission('VIEW_COMPLAINTS')(req,res,next),complaints.list);
router.post('/complaints',(req,res,next)=>req.user.roleName==='CITIZEN'?next():requirePermission('CREATE_COMPLAINTS')(req,res,next),complaints.create);
router.post('/complaints/:id/assign',requireV2Role('SUPER_ADMIN','SUB_MASTER_ADMIN','NAGARSEVAK'),complaints.assign);
router.patch('/complaints/:id/status',requirePermission('EDIT_COMPLAINTS'),complaints.updateStatus);
router.delete('/complaints/:id',requirePermission('DELETE_COMPLAINTS'),data.deleteComplaint);
router.get('/complaints/:id',(req,res,next)=>req.user.roleName==='CITIZEN'?next():requirePermission('VIEW_COMPLAINTS')(req,res,next),complaints.detail);
router.get('/18plus',requirePermission('VIEW_18PLUS'),data.upcoming18);
router.get('/death-records',requirePermission('VIEW_DEATH_RECORDS'),deaths.list);
router.post('/death-records/:id/restore',requirePermission('CREATE_DEATH_RECORDS'),deaths.restore);
router.get('/government-voter-lists',requirePermission('VIEW_GOVERNMENT_VOTER_LISTS'),governmentVoterLists.list);
router.get('/election-data',requirePermission('VIEW_ELECTION_DATA'),election.list);
router.get('/government-voter-lists/:id',requirePermission('VIEW_GOVERNMENT_VOTER_LISTS'),governmentVoterLists.details);
router.get('/government-voter-lists/:id/download',requirePermission('VIEW_GOVERNMENT_VOTER_LISTS'),governmentVoterLists.download);
router.post('/government-voter-lists',requirePermission('CREATE_GOVERNMENT_VOTER_LISTS'),voterListUpload.single('file'),governmentVoterLists.upload);
router.post('/government-voter-lists/:id/extract',requirePermission('CREATE_GOVERNMENT_VOTER_LISTS'),governmentVoterLists.extract);
router.delete('/government-voter-lists/:id',requirePermission('CREATE_GOVERNMENT_VOTER_LISTS'),governmentVoterLists.remove);
router.post('/persons/:personId/death',requirePermission('CREATE_DEATH_RECORDS'),deaths.create);
router.get('/birthdays',requirePermission('VIEW_BIRTHDAYS'),data.birthdays);
router.get('/schemes',requirePermission('VIEW_SCHEMES'),schemes.list);
router.post('/schemes',requirePermission('CREATE_SCHEMES'),schemes.create);
router.patch('/schemes/:id',requirePermission('EDIT_SCHEMES'),schemes.update);
router.delete('/schemes/:id',requirePermission('DELETE_SCHEMES'),schemes.remove);
router.get('/export/:type',requirePermission('EXPORT_DATA'),exporter.exportData);
router.get('/recycle-bin',requirePermission('VIEW_RECYCLE_BIN'),recycle.list);
router.post('/recycle-bin/:entity/:id/restore',requirePermission('RESTORE_RECYCLE_BIN'),recycle.restore);

module.exports=router;
