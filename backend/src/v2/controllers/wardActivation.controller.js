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

function requireMaster(req) {
  if (req.user?.roleName !== 'SUPER_ADMIN') throw new ApiError(403, 'Only Master Admin can manage ward activation and purchases.');
}

const board = asyncHandler(async (req, res) => {
  requireMaster(req);
  const data = await listActivationBoard();
  return success(res, { data });
});

const subscriptions = asyncHandler(async (req, res) => {
  requireMaster(req);
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
    message: ward.status === 'ACTIVE' ? 'Ward activated. Residents of this ward can now see active Nagarsevaks.' : 'Ward deactivated. This ward is hidden from resident registration and Nagarsevak directories.',
  });
});

const setPurchase = asyncHandler(async (req, res) => {
  requireMaster(req);
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

module.exports = { board, myWard, setWard, setPurchase, sync, subscriptions };
