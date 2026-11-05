import React, { useEffect, useMemo, useState } from 'react';
import { api, getUser } from '../services/api';
import { isMaster, isSubMaster } from '../rbac';
import { Empty, ErrorBox, Loading, Modal, PageHeader, SearchableSelect, StatusPill } from '../components/Ui';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import TeamNav from '../components/TeamNav';
import { EyeIcon, PhoneIcon, SearchIcon, UsersIcon, ZapIcon } from '../components/Icons';

function Confirm({ title, message, confirmLabel, tone = 'primary', busy, onClose, onConfirm }) {
  return (
    <Modal title={title} onClose={onClose} layer={2}>
      <p className="activation-confirm-copy">{message}</p>
      <div className="modal-actions">
        <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className={tone === 'danger' ? 'primary-btn danger' : 'primary-btn'} disabled={busy} onClick={onConfirm}>
          {busy ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

function fmtWhen(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export default function ActivePanels() {
  const user = getUser();
  const canManage = isMaster(user) || isSubMaster(user);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState('');
  const [wardId, setWardId] = useState('');
  const [status, setStatus] = useState('ALL');

  function load() {
    if (!canManage) return;
    setError('');
    return api.nagarsevakSubscriptions()
      .then((r) => setRows(r?.data || []))
      .catch((e) => {
        setError(e.message);
        setRows([]);
      });
  }

  useEffect(() => { load(); }, [canManage]);

  const wards = useMemo(() => {
    const map = new Map();
    (rows || []).forEach((n) => {
      if (!n.wardId || !n.ward) return;
      if (!map.has(String(n.wardId))) map.set(String(n.wardId), n.ward);
    });
    return [...map.values()].sort((a, b) => String(a.wardNumber || '').localeCompare(String(b.wardNumber || ''), undefined, { numeric: true }));
  }, [rows]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byWard = new Map();
    (rows || []).forEach((n) => {
      if (wardId && String(n.wardId) !== String(wardId)) return;
      const visible = !!n.residentVisible && n.wardActive;
      if (status === 'VISIBLE' && !visible) return;
      if (status === 'HIDDEN' && visible) return;
      if (q) {
        const hay = [n.name, n.mobile, n.email, n.ward?.name, n.ward?.wardNumber].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return;
      }
      const key = String(n.wardId || 'none');
      if (!byWard.has(key)) {
        byWard.set(key, {
          wardId: n.wardId,
          ward: n.ward,
          wardActive: !!n.wardActive,
          people: [],
        });
      }
      byWard.get(key).people.push(n);
    });
    return [...byWard.values()].sort((a, b) => formatWardLabel(a.ward).localeCompare(formatWardLabel(b.ward)));
  }, [rows, search, wardId, status]);

  const stats = useMemo(() => {
    const list = rows || [];
    const visible = list.filter((n) => n.residentVisible && n.wardActive);
    const hidden = list.filter((n) => !(n.residentVisible && n.wardActive));
    const multi = new Map();
    visible.forEach((n) => multi.set(String(n.wardId), (multi.get(String(n.wardId)) || 0) + 1));
    return {
      total: list.length,
      visible: visible.length,
      hidden: hidden.length,
      multiWards: [...multi.values()].filter((n) => n > 1).length,
    };
  }, [rows]);

  async function apply(n, visible) {
    if (!n?.wardId) {
      setError('This Nagarsevak is not assigned to a ward.');
      return;
    }
    if (visible && !n.wardActive) {
      setError('Activate this ward first, then you can show this Nagarsevak to residents.');
      setConfirm(null);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.setNagarsevakResidentVisible(n.wardId, { nagarsevakUserId: n.id, visible });
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <div className="admin-data-page">
        <PageHeader title="Active panels" />
        <Empty>Admin desk access is required.</Empty>
      </div>
    );
  }

  return (
    <div className="admin-data-page active-panels-page">
      <PageHeader
        kicker="Citizen visibility"
        title="Active Nagarsevak panels"
        subtitle="Show or hide each Nagarsevak independently. An active panel can stay hidden from residents. Hidden names do not appear on Home, Gallery or Complaints."
        action={<button type="button" className="ghost-btn" onClick={load}>Refresh</button>}
      />

      <TeamNav current="active-panels" />
      <ErrorBox error={error} />

      <div className="team-kpi-grid">
        <div className="team-kpi-card">
          <div className="team-kpi-icon blue"><UsersIcon size={20} /></div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.total}</div>
            <div className="team-kpi-label">Assigned Nagarsevaks</div>
          </div>
        </div>
        <div className="team-kpi-card">
          <div className="team-kpi-icon green"><EyeIcon size={20} /></div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.visible}</div>
            <div className="team-kpi-label">Visible to residents</div>
          </div>
        </div>
        <div className="team-kpi-card">
          <div className="team-kpi-icon amber"><ZapIcon size={20} /></div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.multiWards}</div>
            <div className="team-kpi-label">Wards with 2+ panels</div>
          </div>
        </div>
        <div className="team-kpi-card">
          <div className="team-kpi-icon gray">
            <UsersIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.hidden}</div>
            <div className="team-kpi-label">Hidden from residents</div>
          </div>
        </div>
      </div>

      <div className="exec-toolbar-panel">
        <div className="exec-toolbar-row">
          <div className="exec-toolbar-left">
            <div className="exec-search-box">
              <SearchIcon size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, mobile or ward…" />
            </div>
            <div className="exec-quick-ward">
              <SearchableSelect
                compact
                label=""
                value={wardId}
                onChange={setWardId}
                options={[{ value: '', label: 'All wards' }, ...wards.map((w) => ({ value: w.id, label: formatWardLabel(w) }))]}
                placeholder="All wards"
                clearable={false}
              />
            </div>
            <div className="exec-quick-status">
              <SearchableSelect
                compact
                label=""
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'ALL', label: 'All profiles' },
                  { value: 'VISIBLE', label: 'Visible only' },
                  { value: 'HIDDEN', label: 'Hidden only' },
                ]}
                placeholder="All profiles"
                clearable={false}
              />
            </div>
          </div>
        </div>
      </div>

      {rows === null ? <Loading /> : !grouped.length ? (
        <Empty>{search || wardId || status !== 'ALL' ? 'No Nagarsevaks match these filters.' : 'No Nagarsevak accounts found.'}</Empty>
      ) : (
        <div className="active-panels-grid">
          {grouped.map((group) => {
            const liveCount = group.people.filter((n) => n.residentVisible && n.wardActive).length;
            return (
              <section key={group.wardId || 'none'} className="active-panels-ward">
                <header className="active-panels-ward-head">
                  <div>
                    <strong>{group.ward ? formatWardLabel(group.ward) : 'No ward assigned'}</strong>
                    <span>{group.wardActive ? 'Ward live' : 'Ward inactive — activate ward first'}</span>
                  </div>
                  <StatusPill>{liveCount ? `${liveCount} visible` : 'None visible'}</StatusPill>
                </header>
                <div className="active-panels-people">
                  {group.people.map((n) => {
                    const visible = !!n.residentVisible && n.wardActive;
                    const panelOn = n.purchaseStatus === 'ACTIVE';
                    return (
                      <article key={n.id} className={`active-panels-card ${visible ? 'is-visible' : 'is-hidden'}`}>
                        <div className="active-panels-card-copy">
                          <div className="active-panels-name-row">
                            <b>{n.name}</b>
                            <StatusPill>{panelOn ? 'PANEL ON' : 'PANEL OFF'}</StatusPill>
                            <StatusPill>{visible ? 'VISIBLE TO CITIZENS' : 'HIDDEN'}</StatusPill>
                          </div>
                          <p>
                            {[n.mobile, n.email].filter(Boolean).join(' · ') || 'No contact'}
                          </p>
                          <small>
                            {visible ? `Showing since ${fmtWhen(n.activatedAt)}` : 'Not shown on resident Home, Gallery or Complaints'}
                          </small>
                          {n.mobile ? (
                            <a href={`tel:${n.mobile}`} className="team-contact-link">
                              <PhoneIcon size={12} />
                              <span>{n.mobile}</span>
                            </a>
                          ) : null}
                        </div>
                        <div className="active-panels-card-action">
                          {visible ? (
                            <button
                              type="button"
                              className="btn-action btn-ward-deactivate"
                              onClick={() => setConfirm({ kind: 'off', n })}
                            >
                              Hide from residents
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-action btn-ward-activate"
                              disabled={!n.wardActive}
                              title={n.wardActive ? 'Show this Nagarsevak to residents' : 'Activate the ward first'}
                              onClick={() => setConfirm({ kind: 'on', n })}
                            >
                              Show to residents
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {confirm?.kind === 'on' && (
        <Confirm
          title={`Show ${confirm.n.name}?`}
          message={`${confirm.n.name} will appear for residents of ${formatWardNumber(confirm.n.ward?.wardNumber) || 'this ward'}. Other visible Nagarsevaks in the same ward stay visible.`}
          confirmLabel="Show to residents"
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={() => apply(confirm.n, true)}
        />
      )}
      {confirm?.kind === 'off' && (
        <Confirm
          title={`Hide ${confirm.n.name}?`}
          message="Residents will no longer see this Nagarsevak anywhere. Other visible panels in the same ward stay on."
          confirmLabel="Hide from residents"
          tone="danger"
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={() => apply(confirm.n, false)}
        />
      )}
    </div>
  );
}
