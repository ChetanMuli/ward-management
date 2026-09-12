const ApiError = require('../utils/ApiError');

/**
 * Route-level role gate. This is ONE of three enforcement layers required by
 * the SRS (section 6/27): UI hides buttons, this checks the role, and every
 * service/repository call additionally scopes queries by area/person (see
 * scopeToEmployeeAreas / scopeToOwnPerson below). Never rely on this alone.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) throw new ApiError(401, 'Not authenticated');
    if (!allowedRoles.includes(req.user.roleName)) {
      throw new ApiError(403, `Role '${req.user.roleName}' is not permitted to perform this action`);
    }
    next();
  };
}

/**
 * For EMPLOYEE requests, restricts data access to their assigned areas.
 * SUPER_ADMIN bypasses this entirely. Attaches req.scopedAreaIds (null = no
 * restriction) for controllers to apply in their WHERE clauses.
 */
function scopeToEmployeeAreas(req, res, next) {
  if (req.user.roleName === 'SUPER_ADMIN') {
    req.scopedAreaIds = null;
  } else if (req.user.roleName === 'EMPLOYEE') {
    req.scopedAreaIds = req.user.employeeProfile ? req.user.employeeProfile.assignedAreaIds : [];
  } else {
    throw new ApiError(403, 'This resource is not available to your role');
  }
  next();
}

/**
 * For CITIZEN requests, forces every query back to their own Person record.
 * A citizen must never be able to search or view another resident's data.
 */
function scopeToOwnPerson(req, res, next) {
  if (req.user.roleName !== 'CITIZEN') return next();
  if (!req.user.personId) throw new ApiError(403, 'Citizen account is not linked to a person record');
  req.query.personId = req.user.personId; // overrides any client-supplied value
  next();
}

module.exports = { requireRole, scopeToEmployeeAreas, scopeToOwnPerson };
