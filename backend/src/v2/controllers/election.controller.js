const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { success } = require('../../utils/apiResponse');
const { wardDigits } = require('../../utils/wardFormat');
const { electionPayload } = require('../data/amcElectionDocs');

function ownWardDigits(user) {
  return wardDigits(user.ward?.wardNumber || user.wardNumber);
}

function visibleRows(user, rows, requestedDigits) {
  const role = user.roleName;
  if (role === 'NAGARSEVAK' || role === 'EMPLOYEE') {
    const own = ownWardDigits(user);
    if (role === 'NAGARSEVAK' && !own) throw new ApiError(403, 'Your Nagarsevak account is not assigned to a ward.');
    if (own) return rows.filter((r) => wardDigits(r.ward) === own);
  }
  if (requestedDigits) return rows.filter((r) => wardDigits(r.ward) === requestedDigits);
  return rows;
}

function annexFor(rows) {
  const nos = new Set(rows.map((r) => Number(r.wardNo)));
  return (electionPayload.results || []).filter((item) => (item.wardNos || []).some((n) => nos.has(Number(n))));
}

const list = asyncHandler(async (req, res) => {
  const requested = wardDigits(req.query.ward || req.query.wardNumber || '');
  const rows = visibleRows(req.user, electionPayload.rows, requested);
  const citySir = (electionPayload.sirLists || []).find((x) => x.ac === 225) || electionPayload.sirLists?.[0] || null;
  return success(res, {
    data: {
      ...electionPayload,
      sirLists: citySir ? [citySir] : [],
      sirUrl: citySir?.asddUrl || electionPayload.sirUrl,
      sirEarlierUrl: citySir?.earlierUrl || electionPayload.sirEarlierUrl,
      rows,
      results: annexFor(rows),
      scopedWard: rows.length === 1 ? rows[0].ward : null,
    },
  });
});

module.exports = { list };
