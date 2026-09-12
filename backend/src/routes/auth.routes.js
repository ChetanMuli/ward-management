const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const ctrl = require('../controllers/auth.controller');

const router = express.Router();

// SRS section 27: rate limiting on auth endpoints (especially OTP) is mandatory.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

router.post(
  '/login',
  authLimiter,
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  ctrl.login
);

router.post(
  '/otp/request',
  authLimiter,
  [body('mobile').notEmpty()],
  validate,
  ctrl.requestOtp
);

router.post(
  '/otp/verify',
  authLimiter,
  [body('mobile').notEmpty(), body('otp').isLength({ min: 4, max: 6 })],
  validate,
  ctrl.verifyOtp
);

router.post(
  '/register',
  authenticate,
  requireRole('SUPER_ADMIN'),
  [
    body('name').notEmpty(),
    body('roleName').isIn(['SUPER_ADMIN', 'EMPLOYEE', 'CITIZEN']),
    body('email').optional().isEmail(),
    body('mobile').optional().notEmpty(),
  ],
  validate,
  ctrl.registerUser
);

module.exports = router;
