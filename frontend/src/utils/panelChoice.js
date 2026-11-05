const storageKey = (wardId) => `ward_panel_${wardId || ''}`;
const PICK_FLAG = 'ward_need_panel_pick';

export function getSavedPanelId(wardId) {
  if (!wardId) return '';
  try {
    return String(localStorage.getItem(storageKey(wardId)) || '').trim();
  } catch {
    return '';
  }
}

export function savePanelId(wardId, nagarsevakId) {
  if (!wardId || !nagarsevakId) return;
  try {
    localStorage.setItem(storageKey(wardId), String(nagarsevakId));
  } catch { /* ignore */ }
}

export function markNeedPanelPick() {
  try { sessionStorage.setItem(PICK_FLAG, '1'); } catch { /* ignore */ }
}

export function consumeNeedPanelPick() {
  try {
    const on = sessionStorage.getItem(PICK_FLAG) === '1';
    if (on) sessionStorage.removeItem(PICK_FLAG);
    return on;
  } catch {
    return false;
  }
}

export function peekNeedPanelPick() {
  try {
    return sessionStorage.getItem(PICK_FLAG) === '1';
  } catch {
    return false;
  }
}

export function citizenPortalQuery(wardId) {
  let nagarsevakId = getSavedPanelId(wardId);
  try {
    const fromUrl = typeof window !== 'undefined'
      ? String(new URLSearchParams(window.location.search).get('nagarsevakId') || '').trim()
      : '';
    if (fromUrl) nagarsevakId = fromUrl;
  } catch { /* ignore */ }
  const q = {};
  if (wardId) q.wardId = wardId;
  if (nagarsevakId) q.nagarsevakId = nagarsevakId;
  return q;
}

export function assignedToPanel(row, nagarsevakId) {
  if (!nagarsevakId) return true;
  const owner = row?.assignedNagarsevakUserId || row?.assignedNagarsevak?.id || '';
  return String(owner) === String(nagarsevakId);
}

export function workBelongsToPanel(row, nagarsevakId) {
  if (!nagarsevakId) return true;
  const owner = row?.nagarsevakUserId || row?.nagarsevak_user_id || '';
  return String(owner) === String(nagarsevakId);
}

export function selectPanelWorks(rows, nagarsevakId, { includeUntagged = true } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!nagarsevakId) return list;
  return list.filter((row) => {
    const owner = String(row?.nagarsevakUserId || row?.nagarsevak_user_id || '');
    if (owner === String(nagarsevakId)) return true;
    if (includeUntagged && !owner) return true;
    return false;
  });
}

export function activePanelsFromPortal(data) {
  const rows = Array.isArray(data?.purchasedNagarsevaks)
    ? data.purchasedNagarsevaks
    : (Array.isArray(data?.nagarsevaks) ? data.nagarsevaks : []);
  return rows.filter((n) => n && n.id && !n.isDemo);
}
