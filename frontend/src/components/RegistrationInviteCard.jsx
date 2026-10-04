import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getUser } from '../services/api';
import { isEmployee, isMaster, isNagarsevak, isSubMaster } from '../rbac';
import { SearchableSelect } from './Ui';
import { formatWardLabel, formatWardNumber } from '../wardFormat';

function isActiveWard(w) {
  return String(w?.status || '').toUpperCase() === 'ACTIVE';
}

export default function RegistrationInviteCard({ embedded = true }) {
  const user = getUser();
  const adminDesk = isMaster(user) || isSubMaster(user);
  const staffDesk = isNagarsevak(user) || isEmployee(user);
  const allowed = adminDesk || staffDesk;
  const [wards, setWards] = useState([]);
  const [wardId, setWardId] = useState('');
  const [link, setLink] = useState('');
  const [ward, setWard] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const wardOptions = useMemo(
    () => wards.filter(isActiveWard).map((w) => ({
      value: String(w.id),
      label: formatWardLabel(w),
      badge: formatWardNumber(w.wardNumber),
      title: w.name || formatWardNumber(w.wardNumber),
      hint: 'Active ward',
      search: `${formatWardNumber(w.wardNumber)} ${w.wardNumber || ''} ${w.name || ''}`,
    })),
    [wards]
  );

  const loadWards = useCallback(async () => {
    if (!adminDesk) return;
    try {
      const r = await api.wards({ light: 1 });
      setWards(r.data || []);
    } catch (e) {
      setError(e.message || 'Unable to load wards.');
    }
  }, [adminDesk]);

  const loadInvite = useCallback(async (selectedId, forceNew = false) => {
    if (!allowed) return;
    if (adminDesk && !selectedId) {
      setLink('');
      setWard(null);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.createRegistrationInvite(adminDesk ? selectedId : undefined, { rotate: !!forceNew });
      const token = res?.data?.token || '';
      const path = res?.data?.path || (token ? `/r/${token}` : '');
      const origin = window.location.origin.replace(/\/$/, '');
      setLink(path ? `${origin}${path}` : '');
      setWard(res?.data?.ward || null);
    } catch (e) {
      setError(e.message || 'Unable to prepare the registration link.');
      setLink('');
      setWard(null);
    } finally {
      setBusy(false);
    }
  }, [allowed, adminDesk]);

  useEffect(() => {
    if (!adminDesk) return undefined;
    loadWards();
    const refresh = () => loadWards();
    window.addEventListener('focus', refresh);
    window.addEventListener('ward:wards-changed', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('ward:wards-changed', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [adminDesk, loadWards]);

  useEffect(() => {
    if (!allowed) return;
    if (adminDesk) {
      loadInvite(wardId);
      return;
    }
    loadInvite();
  }, [allowed, adminDesk, wardId, loadInvite]);

  useEffect(() => {
    if (!adminDesk || !wardId) return;
    if (!wards.some((w) => String(w.id) === String(wardId) && isActiveWard(w))) {
      setWardId('');
      setLink('');
      setWard(null);
    }
  }, [adminDesk, wardId, wards]);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Unable to copy. Select the link and copy it manually.');
    }
  }

  if (!allowed) return null;
  const wardLabel = ward
    ? formatWardLabel(ward)
    : (adminDesk ? 'Select a ward' : (formatWardNumber(user?.ward?.wardNumber) || 'this ward'));

  return (
    <section className={`panel registration-invite-card ${embedded ? '' : 'is-page'}`}>
      <div className="registration-invite-copy">
        <span className="eyebrow">RESIDENT REGISTRATION</span>
        <h3>{wardLabel}</h3>
        <p>
          {adminDesk
            ? 'Choose an active ward first. The registration form is locked to that ward when a resident opens this link.'
            : 'Share this official registration link with residents of this ward. The registration form is assigned to this ward automatically.'}
        </p>
      </div>
      {adminDesk ? (
        <SearchableSelect
          label="Ward"
          required
          value={wardId}
          onChange={setWardId}
          options={wardOptions}
          placeholder={wardOptions.length ? 'Select one active ward…' : 'Activate a ward first…'}
          searchPlaceholder="Search Ward 06, Savedi…"
        />
      ) : null}
      {error ? <div className="error-box">{error}</div> : null}
      <div className="registration-invite-link-row">
        <input
          readOnly
          value={busy ? 'Preparing link…' : (link || (adminDesk && !wardId ? 'Select a ward to generate a link' : ''))}
          onFocus={(e) => e.target.select()}
          aria-label="Registration link"
        />
        <button type="button" className="primary-btn" disabled={busy || !link} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
      </div>
      <div className="registration-invite-actions">
        <button type="button" className="ghost-btn" disabled={busy || (adminDesk && !wardId)} onClick={() => loadInvite(adminDesk ? wardId : undefined, true)}>Generate new link</button>
      </div>
    </section>
  );
}
