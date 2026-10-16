import React, { useEffect, useMemo, useState } from 'react';
import { api, getUser } from '../services/api';
import { isMaster, isSubMaster } from '../rbac';
import { Empty, ErrorBox, Loading, Modal, PageHeader, PaginationBar, SearchableSelect, StatusPill } from '../components/Ui';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import TeamNav from '../components/TeamNav';
import { UsersIcon, ZapIcon, ClockIcon, AlertCircleIcon, PhoneIcon, BuildingIcon, CalendarIcon, ShieldIcon, EyeIcon, SearchIcon } from '../components/Icons';

function fmtDate(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function cycleLabel(cycle) {
  if (cycle === 'YEAR_ENDED' || cycle === 'EXPIRED') return 'Year ended';
  if (cycle === 'EXPIRING') return 'Ending soon';
  if (cycle === 'ACTIVE') return 'Active Year';
  if (cycle === 'PANEL_OFF') return 'Panel off';
  return 'Pending';
}

function cycleBadge(cycle) {
  if (cycle === 'YEAR_ENDED' || cycle === 'EXPIRED') return { label: 'Year ended', tone: 'red' };
  if (cycle === 'EXPIRING') return { label: 'Ending soon', tone: 'amber' };
  if (cycle === 'ACTIVE') return { label: 'Active', tone: 'green' };
  if (cycle === 'PANEL_OFF') return { label: 'Panel off', tone: 'gray' };
  return { label: 'Pending', tone: 'amber' };
}

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

export default function NagarsevakSubscriptions() {
  const user = getUser();
  const canManage = isMaster(user) || isSubMaster(user);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [wards, setWards] = useState([]);
  const [wardId, setWardId] = useState('');
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [detail, setDetail] = useState(null);

  function load() {
    if (!canManage) return;
    setError('');
    return api.nagarsevakSubscriptions()
      .then(r => setRows(r?.data || []))
      .catch(e => {
        setError(e.message);
        setRows([]);
      });
  }

  useEffect(() => {
    if (!canManage) return;
    api.wards().then(r => setWards(r?.data || [])).catch(() => setWards([]));
  }, [canManage]);

  useEffect(() => {
    load();
  }, [canManage]);

  async function applyStatus(row, next) {
    if (!row?.wardId) {
      setError('This Nagarsevak is not assigned to a ward.');
      return;
    }
    if (next === 'ACTIVE' && !row.wardActive) {
      setError('Activate this ward first, then you can activate the Nagarsevak panel.');
      setConfirm(null);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.setNagarsevakPurchase(row.wardId, { nagarsevakUserId: row.id, status: next });
      setConfirm(null);
      if (detail && detail.id === row.id) {
        setDetail(null);
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows || []).filter(r => {
      if (wardId && String(r.wardId) !== String(wardId)) return false;
      if (status === 'PANEL_ON') {
        if (!r.panelOn) return false;
      } else if (status !== 'ALL' && r.cycle !== status) {
        return false;
      }
      if (term) {
        const hay = [r.name, r.email, r.mobile, r.ward?.wardNumber, r.ward?.name].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, wardId, status, q]);

  useEffect(() => {
    setPage(1);
  }, [wardId, status, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / limit));
  const current = Math.min(page, pages);
  const slice = filtered.slice((current - 1) * limit, current * limit);
  const counts = useMemo(() => {
    const list = rows || [];
    return {
      all: list.length,
      panelOn: list.filter(r => r.panelOn).length,
      expiring: list.filter(r => r.cycle === 'EXPIRING').length,
      yearEnded: list.filter(r => r.cycle === 'YEAR_ENDED' || r.cycle === 'EXPIRED').length,
      panelOff: list.filter(r => r.cycle === 'PANEL_OFF' || r.cycle === 'NOT_ACTIVATED').length,
    };
  }, [rows]);

  if (!canManage) {
    return (
      <div className="admin-data-page nagarsevak-sub-page">
        <PageHeader title="Subscriptions" />
        <Empty>Admin desk access is required.</Empty>
      </div>
    );
  }

  return (
    <div className="admin-data-page nagarsevak-sub-page">
      <PageHeader title="Subscriptions" />

      <TeamNav current="subscriptions" />

      <ErrorBox error={error} />

      <div className="team-kpi-grid">
        <div className="team-kpi-card">
          <div className="team-kpi-icon blue">
            <UsersIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{counts.all}</div>
            <div className="team-kpi-label">Total Subscriptions</div>
          </div>
        </div>
        <div className="team-kpi-card">
          <div className="team-kpi-icon green">
            <ZapIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{counts.panelOn}</div>
            <div className="team-kpi-label">Active Panels (On)</div>
          </div>
        </div>
        <div className="team-kpi-card">
          <div className="team-kpi-icon amber">
            <ClockIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{counts.expiring}</div>
            <div className="team-kpi-label">Ending in 30 Days</div>
          </div>
        </div>
        <div className="team-kpi-card">
          <div className="team-kpi-icon red">
            <AlertCircleIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{counts.yearEnded}</div>
            <div className="team-kpi-label">Year Ended / Expired</div>
          </div>
        </div>
      </div>

      <div className="exec-toolbar-panel">
        <div className="exec-toolbar-row">
          <div className="exec-toolbar-left">
            <div className="exec-search-box">
              <SearchIcon size={15} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, mobile or ward…" />
              {q && (
                <button type="button" className="search-clear-btn" onClick={() => setQ('')} title="Clear search">✕</button>
              )}
            </div>
            <div className="exec-quick-ward">
              <SearchableSelect
                compact
                label=""
                value={wardId}
                onChange={setWardId}
                options={[{ value: '', label: 'All wards' }, ...wards.map(w => ({ value: w.id, label: formatWardLabel(w) }))]}
                placeholder="All wards"
              />
            </div>
            <div className="exec-quick-status">
              <select value={status} onChange={e => setStatus(e.target.value)} className="exec-filter-select">
                <option value="ALL">All statuses</option>
                <option value="PANEL_ON">Panel on</option>
                <option value="ACTIVE">Active year</option>
                <option value="EXPIRING">Ending in 30 days</option>
                <option value="YEAR_ENDED">Year ended</option>
                <option value="PANEL_OFF">Panel off</option>
                <option value="NOT_ACTIVATED">Pending</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {rows === null ? (
        <Loading />
      ) : !filtered.length ? (
        <Empty>No Nagarsevak subscriptions match these filters.</Empty>
      ) : (
        <>
          <div className="panel table-wrap nagar-sub-table-wrap">
            <table className="nagar-sub-table">
              <thead>
                <tr>
                  <th>Nagarsevak</th>
                  <th>Ward</th>
                  <th>Subscription Term</th>
                  <th>Days Left</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {slice.map(r => {
                  const on = !!r.panelOn;
                  const badge = cycleBadge(r.cycle);
                  return (
                    <tr key={r.id} className={r.cycle === 'YEAR_ENDED' || r.cycle === 'EXPIRED' ? 'is-expired' : r.cycle === 'EXPIRING' ? 'is-expiring' : !on ? 'is-panel-off' : ''}>
                      <td data-label="Nagarsevak">
                        <div className="exec-cell-user">
                          <div className="exec-avatar">
                            {(r.name || 'N').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="exec-cell-meta">
                            <span className="exec-cell-name">{r.name || '—'}</span>
                            {r.mobile ? (
                              <a href={`tel:${r.mobile}`} className="team-contact-link notranslate" translate="no">
                                <PhoneIcon size={12} />
                                <span>{r.mobile}</span>
                              </a>
                            ) : (
                              <span className="exec-cell-sub">{r.email || 'No contact'}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td data-label="Ward">
                        <div className="house-addr-cell">
                          <div className="house-family-name">{formatWardNumber(r.ward?.wardNumber) || 'No ward'}</div>
                          <div className="house-addr-meta">{r.ward?.name || 'Not assigned'}</div>
                          <span className={`team-badge ${r.wardActive ? 'green' : 'gray'}`}>
                            {r.wardActive ? 'Ward active' : 'Ward inactive'}
                          </span>
                        </div>
                      </td>
                      <td data-label="Subscription Term">
                        <div className="house-addr-cell">
                          {r.activatedAt ? (
                            <>
                              <div className="house-family-name">
                                {fmtDate(r.activatedAt)} – {fmtDate(r.expiresAt)}
                              </div>
                              <div className="house-addr-meta">
                                {on ? `Assigned ${fmtDate(r.addedAt)}` : `Deactivated ${fmtDate(r.deactivatedAt)}`}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="house-family-name">Pending activation</div>
                              <div className="house-addr-meta">Assigned {fmtDate(r.addedAt)}</div>
                            </>
                          )}
                        </div>
                      </td>
                      <td data-label="Days Left">
                        {!on || r.daysLeft == null ? (
                          <span className="muted">—</span>
                        ) : r.daysLeft <= 0 ? (
                          <span className="team-badge red">0 days</span>
                        ) : r.daysLeft <= 30 ? (
                          <span className="team-badge amber">{r.daysLeft} days</span>
                        ) : (
                          <span className="team-badge green">{r.daysLeft} days</span>
                        )}
                      </td>
                      <td data-label="Status">
                        <span className={`team-badge ${badge.tone}`}>{badge.label}</span>
                      </td>
                      <td data-label="Actions" style={{ textAlign: 'center' }}>
                        <div className="exec-action-group">
                          <button
                            type="button"
                            className="exec-btn-view"
                            onClick={() => setDetail(r)}
                            title="View subscription and tenure details"
                          >
                            <EyeIcon size={13} />
                            <span>View</span>
                          </button>
                          {on ? (
                            <button
                              type="button"
                              className="btn-action btn-ward-deactivate"
                              disabled={busy || !r.wardId}
                              onClick={() => setConfirm({ kind: 'off', row: r })}
                              title="Deactivate Nagarsevak panel access"
                            >
                              Deactivate
                            </button>
                          ) : r.wardActive ? (
                            <button
                              type="button"
                              className="btn-action btn-ward-activate"
                              disabled={busy || !r.wardId}
                              onClick={() => setConfirm({ kind: 'on', row: r })}
                              title="Activate Nagarsevak panel"
                            >
                              Activate
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-action"
                              disabled
                              title="Activate this ward first in Ward activation"
                            >
                              Activate ward first
                            </button>
                          )}
                          {r.cycle === 'YEAR_ENDED' && on && (
                            <button
                              type="button"
                              className="btn-action btn-reg-open"
                              disabled={busy || !r.wardId}
                              onClick={() => setConfirm({ kind: 'renew', row: r })}
                              title="Restart 1-year clock"
                            >
                              New year
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar page={current} pages={pages} total={filtered.length} limit={limit} onPage={setPage} onLimit={n => { setLimit(n); setPage(1); }} />
        </>
      )}

      {/* Subscription View Details Modal */}
      {detail && (
        <Modal
          wide
          title="Nagarsevak Subscription Details"
          onClose={() => setDetail(null)}
          footer={
            <div className="modal-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {detail.panelOn ? (
                  <button
                    type="button"
                    className="small-btn danger"
                    disabled={busy || !detail.wardId}
                    onClick={() => {
                      const row = detail;
                      setDetail(null);
                      setConfirm({ kind: 'off', row });
                    }}
                  >
                    Deactivate Panel
                  </button>
                ) : detail.wardActive ? (
                  <button
                    type="button"
                    className="small-btn primary"
                    disabled={busy || !detail.wardId}
                    onClick={() => {
                      const row = detail;
                      setDetail(null);
                      setConfirm({ kind: 'on', row });
                    }}
                  >
                    Activate Panel
                  </button>
                ) : null}
                {detail.cycle === 'YEAR_ENDED' && detail.panelOn && (
                  <button
                    type="button"
                    className="small-btn primary"
                    disabled={busy || !detail.wardId}
                    onClick={() => {
                      const row = detail;
                      setDetail(null);
                      setConfirm({ kind: 'renew', row });
                    }}
                  >
                    Start New Year
                  </button>
                )}
              </div>
              <button type="button" className="primary-btn" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
          }
        >
          {/* Executive Header Banner */}
          <div className="prof-detail-header">
            <div className="team-avatar-initials" style={{ width: '56px', height: '56px', fontSize: '20px', background: '#1e3a8a', flexShrink: 0 }}>
              {(detail.name || 'N').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{detail.name}</h3>
                <span className="team-badge blue">{formatWardLabel(detail.ward)}</span>
                <StatusPill>{cycleLabel(detail.cycle)}</StatusPill>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' }}>
                {detail.mobile && (
                  <span>Mobile: <strong style={{ color: '#1e293b' }}>{detail.mobile}</strong></span>
                )}
                {detail.email && (
                  <span>Email: <strong style={{ color: '#1e293b' }}>{detail.email}</strong></span>
                )}
                <span>Added to Ward Desk: <strong style={{ color: '#1e293b' }}>{fmtDate(detail.addedAt)}</strong></span>
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="prof-detail-grid">
            {/* Subscription Term Card */}
            <div className="prof-detail-card">
              <div className="prof-card-title">
                <ClockIcon size={16} />
                <span>Subscription Lifecycle & Dates</span>
              </div>
              <div className="prof-spec-list">
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Lifecycle Status</span>
                  <span className="prof-spec-v">
                    <StatusPill>{cycleLabel(detail.cycle)}</StatusPill>
                  </span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">1-Year Term</span>
                  <span className="prof-spec-v">
                    {detail.activatedAt ? `${fmtDate(detail.activatedAt)} → ${fmtDate(detail.expiresAt)}` : 'Not activated yet'}
                  </span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Days Remaining</span>
                  <span className="prof-spec-v">
                    {!detail.panelOn || detail.daysLeft == null ? (
                      '—'
                    ) : detail.daysLeft <= 0 ? (
                      <span className="team-badge red">Term Expired (0 days)</span>
                    ) : detail.daysLeft <= 30 ? (
                      <span className="team-badge amber">{detail.daysLeft} days remaining</span>
                    ) : (
                      <span className="team-badge green">{detail.daysLeft} days remaining</span>
                    )}
                  </span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Activation Date</span>
                  <span className="prof-spec-v">{fmtDate(detail.activatedAt)}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Expiration Date</span>
                  <span className="prof-spec-v">{fmtDate(detail.expiresAt)}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Last Deactivated</span>
                  <span className="prof-spec-v">{detail.deactivatedAt ? fmtDate(detail.deactivatedAt) : 'None'}</span>
                </div>
              </div>
            </div>

            {/* Ward & Access Scope Card */}
            <div className="prof-detail-card">
              <div className="prof-card-title">
                <BuildingIcon size={16} />
                <span>Ward & Operational Access</span>
              </div>
              <div className="prof-spec-list">
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Assigned Ward</span>
                  <span className="prof-spec-v">{formatWardLabel(detail.ward)}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Ward System Status</span>
                  <span className="prof-spec-v">
                    {detail.wardActive ? (
                      <span className="team-badge green">Ward Active (Citizen Services Live)</span>
                    ) : (
                      <span className="team-badge gray">Ward Inactive / Closed</span>
                    )}
                  </span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Panel Access</span>
                  <span className="prof-spec-v">
                    {detail.panelOn ? (
                      <span className="team-badge green">Panel ON (Staff & Leader Online)</span>
                    ) : (
                      <span className="team-badge red">Panel OFF (Sign-in Restricted)</span>
                    )}
                  </span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Role Type</span>
                  <span className="prof-spec-v">Nagarsevak (Ward Elected Representative)</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Contact Phone</span>
                  <span className="prof-spec-v">
                    {detail.mobile ? (
                      <a href={`tel:${detail.mobile}`} style={{ color: '#1e40af', textDecoration: 'none', fontWeight: 600 }}>
                        {detail.mobile}
                      </a>
                    ) : '—'}
                  </span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Contact Email</span>
                  <span className="prof-spec-v">
                    {detail.email ? (
                      <a href={`mailto:${detail.email}`} style={{ color: '#1e40af', textDecoration: 'none', fontWeight: 600 }}>
                        {detail.email}
                      </a>
                    ) : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Impact Notice */}
          <div className="prof-detail-card" style={{ marginTop: '4px' }}>
            <div className="prof-card-title">
              <ShieldIcon size={16} />
              <span>Operational Status & Policy</span>
            </div>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#334155' }}>
              {detail.panelOn ? (
                <>
                  <strong>Panel is Active:</strong> {detail.name} and their designated ward office employees have full access to sign in, view complaints, resolve citizen issues, and post community updates. The 1-year subscription clock runs continuously until expiration.
                </>
              ) : (
                <>
                  <strong>Panel is Currently Deactivated:</strong> Access to the administrative portal is blocked for this Nagarsevak and their ward team. Residents attempting to contact or submit to this panel will see a deactivated notice until an administrator activates the panel.
                </>
              )}
            </p>
          </div>
        </Modal>
      )}

      {confirm?.kind === 'on' && (
        <Confirm
          title={`Activate ${confirm.row.name}?`}
          message={`${confirm.row.name} and their employees will be able to sign in. Residents of this ward will see them. The 1-year clock starts from today.`}
          confirmLabel="Activate panel"
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={() => applyStatus(confirm.row, 'ACTIVE')}
        />
      )}
      {confirm?.kind === 'off' && (
        <Confirm
          title={`Deactivate ${confirm.row.name}?`}
          message="This Nagarsevak and their employees will not be able to sign in. They will see a panel-deactivated message with our contact email and mobile. The 1-year term does not turn the panel off by itself."
          confirmLabel="Deactivate panel"
          tone="danger"
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={() => applyStatus(confirm.row, 'DEACTIVATED')}
        />
      )}
      {confirm?.kind === 'renew' && (
        <Confirm
          title={`Start a new year for ${confirm.row.name}?`}
          message="The panel stays on. The 1-year clock restarts from today. Use this after payment is received."
          confirmLabel="Start new year"
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={() => applyStatus(confirm.row, 'ACTIVE')}
        />
      )}
    </div>
  );
}
