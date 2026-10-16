import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageHeader,
  PaginationBar
} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { useWardFilter } from '../wardFilter';
import { can } from '../rbac';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import {
  UsersIcon,
  UserPlusIcon,
  ClockIcon,
  CheckIcon,
  PhoneIcon,
  CalendarIcon,
  SearchIcon,
  AlertCircleIcon,
  ShieldIcon,
  MapPinIcon,
  BuildingIcon,
  EyeIcon,
  EditIcon
} from '../components/Icons';

const STATUS_CONFIG = {
  NOT_CONTACTED: { label: 'Not Contacted', tone: 'gray' },
  CONTACTED: { label: 'Contacted', tone: 'purple' },
  DOCUMENTS_PENDING: { label: 'Doc Pending', tone: 'amber' },
  GUIDANCE_GIVEN: { label: 'Guidance Given', tone: 'blue' },
  COMPLETED: { label: 'Enrolled', tone: 'green' },
  OTHER: { label: 'Other', tone: 'gray' }
};

const QUICK_PRESETS = [
  'Form 6 Voter Enrolment Guidance Provided',
  'Aadhaar & Age Proof Collected',
  'Voter Helpline App Assisted',
  'Documents Pending Verification',
  'Family Contacted for Follow-up',
  'Citizen Already Applied Online'
];

function eighteenthDate(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  return new Date(d.getFullYear() + 18, d.getMonth(), d.getDate());
}

function fmtDate(d) {
  return d
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d))
    : '—';
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function doorLabel(house) {
  const raw = String(house?.houseNumber || '').trim();
  if (!raw) return '';
  if (/^(flat|फ्लॅट|house|घर|plot|प्लॉट|row)\b/i.test(raw)) return raw;
  return `House ${raw}`;
}

function houseAddressBlock(house) {
  const door = doorLabel(house);
  const addr = String(house?.address || '').trim();
  const landmark = String(house?.landmark || '').trim();
  const extra = [addr, landmark].filter(Boolean).join(' · ');
  return { door: door || 'House not recorded', extra };
}

function getDirectionsUrl(house) {
  if (house?.latitude && house?.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${house.latitude},${house.longitude}`;
  }
  const parts = [
    house?.houseNumber ? `House ${house.houseNumber}` : '',
    house?.address,
    house?.landmark,
    house?.area?.name
  ].filter(Boolean);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parts.join(', ') || 'Ahilyanagar')}`;
}

export default function FollowUp18() {
  const { selectedWardId } = useWardFilter();
  const [days, setDays] = useState(90);
  const [fromDays, setFromDays] = useState(0);
  const [view, setView] = useState('upcoming');
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [voterFilter, setVoterFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [openAddr, setOpenAddr] = useState({});

  async function load() {
    try {
      setError('');
      const res = await api.upcoming18(days, selectedWardId || undefined, fromDays);
      setRows(res.data || []);
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }

  useEffect(() => {
    setRows(null);
    setPage(1);
    load();
  }, [days, fromDays, selectedWardId]);

  // Strictly filter rows by selected ward (double-locking client and backend)
  const wardScopedRows = useMemo(() => {
    const list = rows || [];
    if (!selectedWardId) return list;
    return list.filter(x => {
      const p = x.person || {};
      const f = p.family || {};
      const h = f.house || {};
      const a = h.area || {};
      const w = a.ward || {};
      const wId = x.wardId || w.id || a.wardId;
      return String(wId) === String(selectedWardId);
    });
  }, [rows, selectedWardId]);

  // Compute KPI statistics over strictly scoped ward items
  const stats = useMemo(() => {
    const list = wardScopedRows;
    let pending = 0;
    let guided = 0;
    let completed = 0;
    let registeredVoter = 0;

    for (const item of list) {
      const p = item.person || {};
      const s = p.followupStatus;
      if (!s || s === 'NOT_CONTACTED' || s === 'DOCUMENTS_PENDING') pending += 1;
      if (s === 'GUIDANCE_GIVEN' || s === 'CONTACTED') guided += 1;
      if (s === 'COMPLETED') completed += 1;
      if (p.voterProfile?.status === 'VOTER') registeredVoter += 1;
    }

    return {
      total: list.length,
      pending,
      guided,
      completed,
      registeredVoter
    };
  }, [wardScopedRows]);

  // Filtered rows for table
  const filtered = useMemo(() => {
    let list = wardScopedRows;

    if (view === 'already') {
      list = list.filter(x => x.daysTo18 <= 0);
    } else {
      list = list.filter(x => x.daysTo18 >= 0);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(x => {
        const p = x.person || {};
        const f = p.family || {};
        const h = f.house || {};
        const a = h.area || {};
        return (
          (p.fullName && p.fullName.toLowerCase().includes(q)) ||
          (p.mobile && p.mobile.includes(q)) ||
          (f.familyName && f.familyName.toLowerCase().includes(q)) ||
          (h.houseNumber && h.houseNumber.toLowerCase().includes(q)) ||
          (a.name && a.name.toLowerCase().includes(q))
        );
      });
    }

    if (statusFilter) {
      list = list.filter(x => (x.person?.followupStatus || 'NOT_CONTACTED') === statusFilter);
    }

    if (voterFilter) {
      list = list.filter(x => (x.person?.voterProfile?.status || 'NOT_SPECIFIED') === voterFilter);
    }

    return [...list].sort((a, b) => {
      if (view === 'already') {
        return Math.abs(a.daysTo18) - Math.abs(b.daysTo18);
      }
      return a.daysTo18 - b.daysTo18;
    });
  }, [wardScopedRows, view, search, statusFilter, voterFilter]);

  // Paginated list
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [view, search, statusFilter, voterFilter, pageSize]);

  // Save Follow-up Update
  async function saveFollowUp(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updatePerson(editing.person.id, {
        followupStatus: editing.person.followupStatus,
        followupDate: editing.person.followupDate,
        followupNotes: editing.person.followupNotes
      });
      setEditing(null);
      await load();
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'success', message: '18+ follow-up record updated successfully.' }
        })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-data-page followup18-page" style={{ paddingTop: '8px' }}>
      <PageHeader
        title="18+ Follow-up"
        subtitle="Identify youth reaching 18 years, guide new voter enrollment, and track karyakarta outreach."
      />

      <ErrorBox error={error} />

      {/* KPI Overview Cards */}
      <div className="team-kpi-grid">
        <div className="team-kpi-card">
          <div className="team-kpi-icon blue">
            <UsersIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.total}</div>
            <div className="team-kpi-label">Youth in Window</div>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon amber">
            <AlertCircleIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.pending}</div>
            <div className="team-kpi-label">Needs Outreach / Pending</div>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon purple">
            <UserPlusIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.guided}</div>
            <div className="team-kpi-label">Guided / In Progress</div>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon green">
            <CheckIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.registeredVoter || stats.completed}</div>
            <div className="team-kpi-label">Registered Voters</div>
          </div>
        </div>
      </div>

      {/* Professional Cohesive Filter Panel */}
      <section className="followup-filter-panel">
        <div className="prof-filter-grid">
          {/* Ward Selector */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Ward Scope</label>
            <WardFilter compact label="Ward" />
          </div>

          {/* Quick Search */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Search Citizen</label>
            <div className="prof-search-input-wrap">
              <SearchIcon size={16} />
              <input
                placeholder="Name, mobile, family, house…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Milestone View */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Milestone View</label>
            <select
              className="prof-filter-select"
              value={view}
              onChange={e => {
                const v = e.target.value;
                setView(v);
                if (v === 'upcoming') {
                  setFromDays(0);
                  setDays(90);
                } else {
                  setFromDays(-15);
                  setDays(0);
                }
              }}
            >
              <option value="upcoming">Upcoming 18th Birthdays</option>
              <option value="already">Recently Turned 18</option>
            </select>
          </div>

          {/* Time Window */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Time Window</label>
            {view === 'upcoming' ? (
              <select
                className="prof-filter-select"
                value={days}
                onChange={e => {
                  setFromDays(0);
                  setDays(Number(e.target.value));
                }}
              >
                <option value={30}>Next 30 days</option>
                <option value={60}>Next 60 days</option>
                <option value={90}>Next 90 days</option>
                <option value={180}>Next 180 days</option>
              </select>
            ) : (
              <select
                className="prof-filter-select"
                value={fromDays}
                onChange={e => {
                  const n = Number(e.target.value);
                  setFromDays(n);
                  setDays(0);
                }}
              >
                <option value={-7}>Past 7 days</option>
                <option value={-15}>Past 15 days</option>
                <option value={-30}>Past 30 days</option>
                <option value={-90}>Past 90 days</option>
              </select>
            )}
          </div>

          {/* Outreach Status */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Outreach Status</label>
            <select
              className="prof-filter-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All Follow-up Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
                <option key={k} value={k}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          {/* Voter Status */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Voter Status</label>
            <select
              className="prof-filter-select"
              value={voterFilter}
              onChange={e => setVoterFilter(e.target.value)}
            >
              <option value="">All Voter Statuses</option>
              <option value="VOTER">Registered Voter</option>
              <option value="NON_VOTER">Non-Voter</option>
              <option value="NOT_SPECIFIED">Not Specified</option>
            </select>
          </div>
        </div>

        {/* Clean Filter Status & Reset Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '8px' }}>
          <div className="muted" style={{ fontSize: '12.5px' }}>
            Showing <strong>{filtered.length}</strong> {filtered.length === 1 ? 'citizen record' : 'citizen records'}
          </div>
          <button
            type="button"
            className="small-btn"
            disabled={!search && !statusFilter && !voterFilter && view === 'upcoming' && days === 90}
            onClick={() => {
              setSearch('');
              setStatusFilter('');
              setVoterFilter('');
              setView('upcoming');
              setDays(90);
              setFromDays(0);
            }}
            style={{ height: '32px', minHeight: '32px', padding: '0 14px', fontSize: '12.5px' }}
          >
            Reset Filters
          </button>
        </div>
      </section>

      {/* Main Table View */}
      {!rows ? (
        <Loading />
      ) : !filtered.length ? (
        <Empty>
          {view === 'already'
            ? 'No citizens completed their 18th birthday in the selected ward and period.'
            : 'No upcoming 18th birthdays found for this ward and filter criteria.'}
        </Empty>
      ) : (
        <>
          <div className="panel table-wrap">
            <table className="followup18-table">
              <thead>
                <tr>
                  <th>Citizen</th>
                  <th>18th Milestone</th>
                  <th>Ward & Colony</th>
                  <th>Household & Family</th>
                  <th>Voter Status</th>
                  <th>Follow-up</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map(r => {
                  const p = r.person || {};
                  const f = p.family || {};
                  const h = f.house || {};
                  const a = h.area || {};
                  const w = a.ward || {};
                  const st = p.followupStatus || 'NOT_CONTACTED';
                  const stConfig = STATUS_CONFIG[st] || { label: st, tone: 'gray' };

                  return (
                    <tr key={p.id}>
                      {/* Citizen */}
                      <td data-label="Citizen">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="prof-avatar">
                            {getInitials(p.fullName)}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <strong className="prof-text-truncate" style={{ fontSize: '13.5px', color: '#0f172a' }}>
                              {p.fullName}
                            </strong>
                            <div className="muted" style={{ fontSize: '11.5px', marginTop: '1px' }}>
                              <span>DOB: {fmtDate(p.dob)}</span>
                              {p.gender ? <span> · {p.gender}</span> : null}
                            </div>
                            {p.mobile ? (
                              <a
                                href={`tel:${p.mobile}`}
                                className="prof-contact-link notranslate"
                                translate="no"
                              >
                                <PhoneIcon size={12} />
                                <span>{p.mobile}</span>
                              </a>
                            ) : (
                              <span className="muted" style={{ fontSize: '11px' }}>No mobile</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 18th Milestone */}
                      <td data-label="18th Milestone">
                        <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', whiteSpace: 'nowrap' }}>
                          {fmtDate(eighteenthDate(p.dob))}
                        </strong>
                        <div style={{ marginTop: '3px' }}>
                          {r.daysTo18 === 0 ? (
                            <span className="milestone-badge today">
                              <ClockIcon size={12} />
                              <span>Today!</span>
                            </span>
                          ) : r.daysTo18 > 0 ? (
                            <span className="milestone-badge upcoming">
                              <ClockIcon size={12} />
                              <span>In {r.daysTo18}d</span>
                            </span>
                          ) : (
                            <span className="milestone-badge completed">
                              <CheckIcon size={12} />
                              <span>{Math.abs(r.daysTo18)}d ago</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Ward & Colony */}
                      <td data-label="Ward & Colony">
                        <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                          {formatWardNumber(w.wardNumber) || 'Ward —'}
                        </strong>
                        <div className="muted prof-text-truncate" style={{ fontSize: '11.5px', marginTop: '1px' }} title={a.name}>
                          {a.name || '—'}
                        </div>
                      </td>

                      {/* Household & Family */}
                      <td data-label="Household & Family">
                        {(() => {
                          const block = houseAddressBlock(h);
                          const expanded = !!openAddr[p.id];
                          const long = (block.extra || '').length > 42;
                          return (
                            <div className={`fu18-house-cell ${expanded ? 'is-open' : ''}`}>
                              <div className="fu18-house-name">{f.familyName || 'Family —'}</div>
                              {block.door ? <div className="fu18-house-line">{block.door}</div> : null}
                              {block.extra ? (
                                <div className="fu18-house-addr" title={block.extra}>{block.extra}</div>
                              ) : null}
                              {long ? (
                                <button
                                  type="button"
                                  className="fu18-more"
                                  onClick={() => setOpenAddr(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                                >
                                  {expanded ? 'Less' : 'More'}
                                </button>
                              ) : null}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Voter Status */}
                      <td data-label="Voter Status">
                        {p.voterProfile?.status === 'VOTER' ? (
                          <span className="team-badge green">
                            <CheckIcon size={11} /> Registered
                          </span>
                        ) : p.voterProfile?.status === 'NON_VOTER' ? (
                          <span className="team-badge amber">Non-Voter</span>
                        ) : (
                          <span className="team-badge gray">Not Specified</span>
                        )}
                      </td>

                      {/* Follow-up Status */}
                      <td data-label="Follow-up">
                        <div className="fu18-follow-cell">
                          <span className={`team-badge ${stConfig.tone}`}>{stConfig.label}</span>
                          {p.followupDate ? <span className="fu18-follow-date">{fmtDate(p.followupDate)}</span> : null}
                        </div>
                      </td>

                      {/* Actions */}
                      <td data-label="Actions">
                        <div className="exec-action-group">
                          <button
                            type="button"
                            className="exec-btn-view"
                            onClick={() => setSelected(r)}
                            title="View full citizen & household details"
                          >
                            <EyeIcon size={13} />
                            <span>View</span>
                          </button>
                          {can('EDIT_18PLUS') && (
                            <button
                              type="button"
                              className="exec-btn-edit"
                              onClick={() =>
                                setEditing({
                                  person: {
                                    ...p,
                                    followupStatus: p.followupStatus || 'GUIDANCE_GIVEN',
                                    followupDate: p.followupDate || new Date().toISOString().slice(0, 10),
                                    followupNotes: p.followupNotes || ''
                                  }
                                })
                              }
                              title="Update follow-up progress and notes"
                            >
                              <EditIcon size={12} />
                              <span>Update</span>
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

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <PaginationBar
              page={page}
              total={filtered.length}
              limit={pageSize}
              onPage={setPage}
              onLimit={n => {
                setPageSize(n);
                setPage(1);
              }}
            />
          )}
        </>
      )}

      {/* ========================================================
          EXECUTIVE 18+ CITIZEN DOSSIER MODAL
          ======================================================== */}
      {selected && (
        <Modal wide title="18+ Citizen Dossier" onClose={() => setSelected(null)}>
          {(() => {
            const p = selected.person || {};
            const f = p.family || {};
            const h = f.house || {};
            const a = h.area || {};
            const w = a.ward || {};
            const st = p.followupStatus || 'NOT_CONTACTED';
            const stConfig = STATUS_CONFIG[st] || { label: st, tone: 'gray' };

            return (
              <>
                {/* Header Banner */}
                <div className="prof-detail-header">
                  <div className="prof-avatar" style={{ width: '56px', height: '56px', fontSize: '20px' }}>
                    {getInitials(p.fullName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                        {p.fullName}
                      </h3>
                      <span className={`team-badge ${stConfig.tone}`}>{stConfig.label}</span>
                      {selected.daysTo18 === 0 ? (
                        <span className="milestone-badge today">
                          <ClockIcon size={12} /> Today!
                        </span>
                      ) : selected.daysTo18 > 0 ? (
                        <span className="milestone-badge upcoming">
                          <ClockIcon size={12} /> In {selected.daysTo18} days
                        </span>
                      ) : (
                        <span className="milestone-badge completed">
                          <CheckIcon size={12} /> Turned 18 ({Math.abs(selected.daysTo18)}d ago)
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginTop: '6px', fontSize: '12.5px', color: '#64748b' }}>
                      <span>Ward: <strong>{formatWardLabel(w, '—')}</strong></span>
                      <span>Colony: <strong>{a.name || '—'}</strong></span>
                      {p.mobile && (
                        <a href={`tel:${p.mobile}`} style={{ color: '#1e40af', textDecoration: 'none', fontWeight: 600 }}>
                          📞 {p.mobile}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2x2 Grid */}
                <div className="prof-detail-grid">
                  {/* Card 1: Citizen Profile */}
                  <div className="prof-detail-card">
                    <div className="prof-card-title">
                      <ShieldIcon size={16} />
                      <span>Citizen Profile & Age Milestone</span>
                    </div>
                    <div className="prof-spec-list">
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Full Name</span>
                        <span className="prof-spec-v">{p.fullName}</span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Date of Birth</span>
                        <span className="prof-spec-v">{fmtDate(p.dob)}</span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">18th Birthday Date</span>
                        <span className="prof-spec-v">{fmtDate(eighteenthDate(p.dob))}</span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Current Age</span>
                        <span className="prof-spec-v">{p.age ?? '17-18'} years</span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Gender</span>
                        <span className="prof-spec-v">{p.gender || '—'}</span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Contact Mobile</span>
                        <span className="prof-spec-v">{p.mobile || '—'}</span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Alternate Mobile</span>
                        <span className="prof-spec-v">{p.alternateMobile || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Voter Registration & Outreach */}
                  <div className="prof-detail-card">
                    <div className="prof-card-title">
                      <UserPlusIcon size={16} />
                      <span>Voter Registration & Outreach</span>
                    </div>
                    <div className="prof-spec-list">
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Voter Status</span>
                        <span className="prof-spec-v">
                          {p.voterProfile?.status === 'VOTER' ? (
                            <span className="team-badge green">Registered Voter</span>
                          ) : p.voterProfile?.status === 'NON_VOTER' ? (
                            <span className="team-badge amber">Non-Voter</span>
                          ) : (
                            <span className="team-badge gray">Not Specified</span>
                          )}
                        </span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Official Voter ID (EPIC)</span>
                        <span className="prof-spec-v">{p.voterProfile?.officialVoterIdRef || 'Pending Enrolment'}</span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Follow-up Status</span>
                        <span className="prof-spec-v">
                          <span className={`team-badge ${stConfig.tone}`}>{stConfig.label}</span>
                        </span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Last Follow-up Date</span>
                        <span className="prof-spec-v">{p.followupDate ? fmtDate(p.followupDate) : 'Not yet contacted'}</span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Follow-up Notes</span>
                        <span className="prof-spec-v" style={{ textAlign: 'left', fontStyle: p.followupNotes ? 'normal' : 'italic', color: p.followupNotes ? '#0f172a' : '#94a3b8' }}>
                          {p.followupNotes || 'No outreach notes recorded yet.'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 3: Household & Residence with Directions */}
                <div className="prof-detail-card" style={{ marginBottom: '16px' }}>
                  <div className="prof-card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BuildingIcon size={16} />
                      <span>Household & Family Residence</span>
                    </div>
                    {/* Home Directions Button */}
                    <a
                      href={getDirectionsUrl(h)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="primary-btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        padding: '4px 12px',
                        textDecoration: 'none'
                      }}
                      title="Open Google Maps directions to this citizen's residence"
                    >
                      <MapPinIcon size={14} />
                      <span>Home Direction</span>
                    </a>
                  </div>
                  <div className="prof-spec-list">
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Family Name</span>
                      <span className="prof-spec-v">{f.familyName || '—'}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">House Number</span>
                      <span className="prof-spec-v">{h.houseNumber || '—'}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Full Address</span>
                      <span className="prof-spec-v">{h.address || '—'}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Colony / Area & Ward</span>
                      <span className="prof-spec-v">{a.name ? `${a.name} · ` : ''}{formatWardLabel(w, '—')}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Property Owner</span>
                      <span className="prof-spec-v">
                        {h.ownerName || '—'}{h.ownerMobile ? ` (${h.ownerMobile})` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 4: Complete Family Members */}
                <div className="prof-detail-card">
                  <div className="prof-card-title">
                    <UsersIcon size={16} />
                    <span>Family Members Living in Household ({(f.members || []).length})</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                    {(f.members || []).map(m => (
                      <div
                        key={m.id}
                        style={{
                          padding: '10px 12px',
                          background: m.id === p.id ? '#eff6ff' : '#f8fafc',
                          border: m.id === p.id ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }}
                      >
                        <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                          {m.fullName} {m.id === p.id && <span className="team-badge blue" style={{ fontSize: '10px' }}>This Youth</span>}
                        </strong>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                          <span>Age: {m.age ?? (m.dob ? `${new Date().getFullYear() - new Date(m.dob).getFullYear()}` : '—')}</span>
                          {m.mobile && <span> · 📞 {m.mobile}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="modal-actions" style={{ marginTop: '20px' }}>
                  <button type="button" className="ghost-btn" onClick={() => setSelected(null)}>
                    Close
                  </button>
                  {can('EDIT_18PLUS') && (
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => {
                        const targetPerson = p;
                        setSelected(null);
                        setEditing({
                          person: {
                            ...targetPerson,
                            followupStatus: targetPerson.followupStatus || 'GUIDANCE_GIVEN',
                            followupDate: targetPerson.followupDate || new Date().toISOString().slice(0, 10),
                            followupNotes: targetPerson.followupNotes || ''
                          }
                        });
                      }}
                    >
                      Update Follow-up
                    </button>
                  )}
                </div>
              </>
            );
          })()}
        </Modal>
      )}

      {/* ========================================================
          UPDATE FOLLOW-UP MODAL
          ======================================================== */}
      {editing && (
        <Modal wide title={`18+ Follow-up · ${editing.person.fullName}`} onClose={() => setEditing(null)}>
          <div style={{ padding: '12px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', color: '#0f172a' }}>
              <strong>Citizen:</strong> {editing.person.fullName}
              {editing.person.mobile && <span> · 📞 {editing.person.mobile}</span>}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              18th Birthday: <strong>{fmtDate(eighteenthDate(editing.person.dob))}</strong>
              {editing.person.family?.house?.houseNumber && <span> · House #{editing.person.family?.house?.houseNumber}</span>}
              {editing.person.family?.house?.address && <span>, {editing.person.family?.house?.address}</span>}
            </div>
          </div>

          <form className="form-grid" onSubmit={saveFollowUp}>
            <Field label="Follow-up status *">
              <select
                className="prof-filter-select"
                value={editing.person.followupStatus || ''}
                onChange={e =>
                  setEditing({
                    ...editing,
                    person: { ...editing.person, followupStatus: e.target.value }
                  })
                }
                required
              >
                <option value="">Select status</option>
                {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
                  <option key={k} value={k}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Follow-up date *">
              <input
                type="date"
                required
                value={editing.person.followupDate || ''}
                onChange={e =>
                  setEditing({
                    ...editing,
                    person: { ...editing.person, followupDate: e.target.value }
                  })
                }
              />
            </Field>

            <div className="span-2">
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Quick Guidance Checklist & Presets
              </label>
              <div className="preset-chips">
                {QUICK_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="preset-chip"
                    onClick={() => {
                      const curNotes = editing.person.followupNotes ? `${editing.person.followupNotes.trim()}; ` : '';
                      setEditing({
                        ...editing,
                        person: { ...editing.person, followupNotes: `${curNotes}${preset}` }
                      });
                    }}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            <Field className="span-2" label="Outreach Notes & Citizen Response">
              <textarea
                rows={4}
                value={editing.person.followupNotes || ''}
                onChange={e =>
                  setEditing({
                    ...editing,
                    person: { ...editing.person, followupNotes: e.target.value }
                  })
                }
                placeholder="Enter details of conversation with youth/family, voter registration status, documents collected, or follow-up schedule…"
              />
            </Field>

            <div className="modal-actions span-2">
              <button type="button" className="ghost-btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? 'Saving…' : 'Save Follow-up'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
