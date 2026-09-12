/**
 * Pure visibility rules. Backend APIs must use these — never frontend hiding.
 * A resident sees a Nagarsevak only when every condition is true.
 */
function canResidentSeeNagarsevak({
  residentWardId,
  wardId,
  wardStatus,
  nagarsevakWardId,
  nagarsevakStatus,
  subscriptionStatus,
}) {
  if (!residentWardId || !wardId || String(residentWardId) !== String(wardId)) return false;
  if (String(wardStatus || '').toUpperCase() !== 'ACTIVE') return false;
  if (nagarsevakWardId && String(nagarsevakWardId) !== String(wardId)) return false;
  if (String(nagarsevakStatus || '').toUpperCase() !== 'ACTIVE') return false;
  return String(subscriptionStatus || '').toUpperCase() === 'ACTIVE';
}

function isPurchasedActive(status) {
  return String(status || '').toUpperCase() === 'ACTIVE';
}

module.exports = { canResidentSeeNagarsevak, isPurchasedActive };
