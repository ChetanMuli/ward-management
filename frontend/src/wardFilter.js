import { useEffect, useMemo, useState } from 'react';
import { getUser, api, getWardScope, setWardScope } from './services/api';
import { isMaster, isSubMaster, userWardId } from './rbac';

export function wardIdFromRow(row) {
  return row?.wardId || row?.ward?.id || row?.ward_id ||
    row?.area?.wardId || row?.area?.ward?.id ||
    row?.house?.area?.wardId || row?.house?.area?.ward?.id ||
    row?.family?.house?.area?.wardId || row?.family?.house?.area?.ward?.id ||
    row?.person?.family?.house?.area?.wardId || row?.person?.family?.house?.area?.ward?.id ||
    row?.newValue?.wardId || row?.oldValue?.wardId || row?.record?.wardId || row?.User?.wardId || row?.Person?.family?.house?.area?.wardId || row?.Person?.family?.house?.area?.ward?.id || row?.User?.wardId || row?.User?.ward?.id || row?.user?.wardId || row?.user?.ward?.id || null;
}

export function filterByWard(rows = [], selectedWardId = '') {
  if (!selectedWardId) return rows;
  return rows.filter(row => String(wardIdFromRow(row) || '') === String(selectedWardId));
}

export function useWardFilter() {
  const user = getUser();
  const master = isMaster(user);
  const canSelect = master || isSubMaster(user);
  const fixedWardId = userWardId(user);
  const [wards, setWards] = useState([]);
  const [loadingWards, setLoadingWards] = useState(!!canSelect);
  const [selectedWardId, setSelected] = useState(() => canSelect ? (getWardScope() || '') : (fixedWardId || ''));

  useEffect(() => {
    let active = true;
    // Residents already have their registered ward in the authenticated user
    // payload. Do not call the administration ward endpoint just to render a
    // filter; that endpoint is intentionally permission-protected.
    if (!canSelect) {
      if (fixedWardId && user?.ward) setWards([{
        id: fixedWardId,
        wardNumber: user.ward.wardNumber,
        name: user.ward.name
      }]);
      else setWards([]);
      setLoadingWards(false);
      return () => { active = false; };
    }
    setLoadingWards(true);
    api.wards().then(r => { if (active) setWards(r.data || []); }).catch(() => { if (active) setWards([]); }).finally(() => { if (active) setLoadingWards(false); });
    return () => { active = false; };
  }, [canSelect, fixedWardId, user?.ward?.id]);

  useEffect(() => {
    const onScope = e => setSelected(e.detail || '');
    window.addEventListener('ward-scope-changed', onScope);
    return () => window.removeEventListener('ward-scope-changed', onScope);
  }, []);

  useEffect(() => {
    if (!canSelect && fixedWardId && selectedWardId !== fixedWardId) setSelected(fixedWardId);
  }, [master, fixedWardId, selectedWardId]);

  const ward = useMemo(() => wards.find(w => String(w.id) === String(selectedWardId)) || null, [wards, selectedWardId]);

  useEffect(() => {
    if (!canSelect || !selectedWardId || !wards.length) return;
    if (!wards.some(w => String(w.id) === String(selectedWardId))) {
      setSelected('');
      setWardScope('');
      window.dispatchEvent(new CustomEvent('ward-scope-changed', { detail: '' }));
    }
  }, [canSelect, selectedWardId, wards]);

  function setWardId(id) {
    if (!canSelect) return;
    const nextId = id ? String(id) : '';
    setSelected(nextId);
    setWardScope(nextId);
    window.dispatchEvent(new CustomEvent('ward-scope-changed', { detail: nextId }));
  }

  return { wards, selectedWardId: canSelect ? selectedWardId : fixedWardId || '', setWardId, ward, master, canSelect, fixedWardId, loadingWards };
}

