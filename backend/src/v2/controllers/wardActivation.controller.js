const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const { success } = require('../../utils/apiResponse');
const {
  listActivationBoard,
  listNagarsevakSubscriptions,
  notifyExpiredNagarsevakSubscriptions,
  setWardActivation,
  setNagarsevakPurchase,
  getResidentWardSnapshot,
  syncWardCommunityMembership,
} = require('../../services/wardActivation.service');
const { setPublicOpenWard, createStaffInvite } = require('../../services/registrationInvite.service');
const { formatWardLabel } = require('../../utils/wardFormat');

function requireMaster(req) {
  if (req.user?.roleName !== 'SUPER_ADMIN') throw new ApiError(403, 'Only Master Admin can manage ward activation and purchases.');
}

function requireAdminDesk(req) {
  if (!['SUPER_ADMIN', 'SUB_MASTER_ADMIN'].includes(req.user?.roleName)) {
    throw new ApiError(403, 'Only Master Admin or Sub Master Admin can use this section.');
  }
}

const board = asyncHandler(async (req, res) => {
  requireMaster(req);
  const data = await listActivationBoard();
  return success(res, { data });
});

const subscriptions = asyncHandler(async (req, res) => {
  requireAdminDesk(req);
  notifyExpiredNagarsevakSubscriptions().catch((err) => {
    console.error('[SUBSCRIPTION NOTIFY FAILURE]', err.message);
  });
  const data = await listNagarsevakSubscriptions();
  return success(res, { data });
});

const myWard = asyncHandler(async (req, res) => {
  if (req.user.roleName === 'CITIZEN') {
    const data = await getResidentWardSnapshot(req.user);
    return success(res, { data });
  }
  if (!req.user.wardId && req.user.roleName !== 'SUPER_ADMIN' && req.user.roleName !== 'SUB_MASTER_ADMIN') {
    throw new ApiError(403, 'Your account is not assigned to a ward');
  }
  const data = await getResidentWardSnapshot(req.user);
  return success(res, { data });
});

const setWard = asyncHandler(async (req, res) => {
  requireMaster(req);
  const ward = await setWardActivation(req.params.wardId, req.body.status, req.user, req.ip);
  return success(res, {
    data: ward,
    message: ward.status === 'ACTIVE' ? 'Ward activated. Open public signup separately if residents should register without a staff link.' : 'Ward deactivated. This ward is hidden from resident registration and Nagarsevak directories.',
  });
});

const setPurchase = asyncHandler(async (req, res) => {
  requireAdminDesk(req);
  const sub = await setNagarsevakPurchase({
    wardId: req.params.wardId,
    nagarsevakUserId: req.body.nagarsevakUserId,
    status: req.body.status,
    actor: req.user,
    ipAddress: req.ip,
    notes: req.body.notes,
  });
  return success(res, {
    data: sub,
    message: sub.status === 'ACTIVE'
      ? 'Nagarsevak activated. They and their employees can sign in, and residents of this ward can see them.'
      : 'Nagarsevak deactivated. Login for this Nagarsevak and their employees is paused, and residents will no longer see this profile.',
  });
});

const sync = asyncHandler(async (req, res) => {
  requireMaster(req);
  const data = await syncWardCommunityMembership(req.params.wardId);
  return success(res, { data, message: 'Ward community membership synchronized.' });
});

const setRegistrationOpen = asyncHandler(async (req, res) => {
  requireMaster(req);
  const open = req.body.open !== false && req.body.open !== 'false' && req.body.open !== 0;
  const ward = await setPublicOpenWard(open ? req.params.wardId : null, req.user);
  return success(res, {
    data: ward,
    message: ward
      ? `Public signup is now only for ${formatWardLabel(ward, 'this ward')}. Other wards stay closed unless a staff link is used.`
      : 'Public signup is closed. Residents can still register with a Nagarsevak or employee link.',
  });
});

const createRegistrationInvite = asyncHandler(async (req, res) => {
  const role = String(req.user?.roleName || '').toUpperCase();
  if (!['SUPER_ADMIN', 'SUB_MASTER_ADMIN', 'NAGARSEVAK', 'EMPLOYEE'].includes(role)) {
    throw new ApiError(403, 'You cannot share a ward registration link.');
  }
  const data = await createStaffInvite(
    req.user,
    req.body?.wardId || req.query?.wardId,
    { rotate: req.body?.rotate === true || req.body?.rotate === 'true' }
  );
  return success(res, { data, message: 'Share this link with residents of the selected ward.' });
});

module.exports = { board, myWard, setWard, setPurchase, sync, subscriptions, setRegistrationOpen, createRegistrationInvite };
