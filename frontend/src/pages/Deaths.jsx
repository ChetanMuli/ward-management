import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, getUser } from '../services/api';
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageHeader,
  PaginationBar,
  SearchableSelect
} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { useWardFilter } from '../wardFilter';
import { isMaster, isNagarsevak, isEmployee, can } from '../rbac';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import {
  HeartIcon,
  CalendarIcon,
  UsersIcon,
  ClockIcon,
  RefreshCwIcon,
  SearchIcon,
  BuildingIcon,
  MapPinIcon,
  ShieldIcon,
  AlertCircleIcon,
  CheckIcon,
  PhoneIcon,
  FileTextIcon,
  EyeIcon
} from '../components/Icons';

const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const display = s =>
  s
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(new Date(`${s}T00:00:00Z`))
    : '—';

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

function personLabel(p) {
  const ward = p?.family?.house?.area?.ward;
  const house = p?.family?.house?.houseNumber;
  return `${p?.fullName || 'N/A'} · ${p?.mobile || 'No mobile'}${house ? ` · House #${house}` : ''}${
    ward ? ` · ${formatWardLabel(ward, '')}` : ''
  }`;
}

export default function Deaths() {
  const user = getUser();
  const { selectedWardId } = useWardFilter();
  const location = useLocation();

  const [rows, setRows] = useState(null);
  const [people, setPeople] = useState([]);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('latest');
  const [windowKey, setWindowKey] = useState('latest25');
  const [recordStatus, setRecordStatus] = useState('ACTIVE');
  const [dateType, setDateType] = useState('death');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ personId: '', dateOfDeath: '', notes: '' });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const canCreate = isMaster(user) || isNagarsevak(user) || isEmployee(user) || can('CREATE_DEATH_RECORDS', user);

  async function load() {
    try {
      setError('');
      const [d, p] = await Promise.all([
        api.deathRecords({
          limit: 500,
          wardId: selectedWardId || undefined,
          search: search || undefined,
          recordStatus
        }),
        api.persons({ limit: 500, wardId: selectedWardId || undefined })
      ]);
      setRows(d.data || []);
      setPeople(p.data || []);
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }

  useEffect(() => {
    setPage(1);
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [selectedWardId, search, recordStatus]);

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('open');
    if (!id || !rows?.length) return;
    const found = rows.find(
      r => String(r.id) === String(id) || String(r.deathRecordId) === String(id) || String(r.personId) === String(id)
    );
    if (found) setDetail(found);
  }, [location.search, rows]);

  const activePeople = useMemo(() => people.filter(p => p.status !== 'DECEASED'), [people]);

  const windows = useMemo(
    () =>
      filterMode === 'upcoming'
        ? [
            { key: 'next7', label: 'Next 7 days', days: 7 },
            { key: 'next15', label: 'Next 15 days', days: 15 },
            { key: 'next30', label: 'Next 30 days', days: 30 },
            { key: 'next90', label: 'Next 90 days', days: 90 }
          ]
        : filterMode === 'previous'
        ? [
            { key: 'prev7', label: 'Previous 7 days', days: 7 },
            { key: 'prev15', label: 'Previous 15 days', days: 15 },
            { key: 'prev30', label: 'Previous 30 days', days: 30 },
            { key: 'prev90', label: 'Previous 90 days', days: 90 }
          ]
        : [
            { key: 'latest10', label: 'Latest 10 records', count: 10 },
            { key: 'latest25', label: 'Latest 25 records', count: 25 },
            { key: 'latest50', label: 'Latest 50 records', count: 50 },
            { key: 'latest100', label: 'Latest 100 records', count: 100 }
          ],
    [filterMode]
  );

  // Strictly filter rows by selected ward (double-locking client and backend)
  const wardScopedRows = useMemo(() => {
    const list = rows || [];
    if (!selectedWardId) return list;
    return list.filter(r => {
      const p = r.person || r.Person || {};
      const f = p.family || {};
      const h = f.house || {};
      const a = h.area || {};
      const w = a.ward || {};
      const wId = r.wardId || w.id || a.wardId;
      return String(wId) === String(selectedWardId);
    });
  }, [rows, selectedWardId]);

  // Compute KPI statistics over wardScopedRows (Strictly 3 cards: Active, 10th Day Dahava, Restored)
  const stats = useMemo(() => {
    const list = wardScopedRows;
    let activeDeaths = 0;
    let upcomingTenth = 0;
    let restored = 0;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thirtyDaysAhead = new Date(now);
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

    for (const r of list) {
      if (r.recordStatus === 'RESTORED') {
        restored += 1;
      } else {
        activeDeaths += 1;
      }

      if (r.tenthDay) {
        const td = new Date(`${r.tenthDay}T00:00:00Z`);
        if (td >= now && td <= thirtyDaysAhead) upcomingTenth += 1;
      }
    }

    return {
      activeDeaths,
      upcomingTenth,
      restored
    };
  }, [wardScopedRows]);

  // Filtered rows for table
  const visibleRows = useMemo(() => {
    let sorted = [...wardScopedRows].sort(
      (a, b) => new Date(`${b.dateOfDeath}T00:00:00Z`) - new Date(`${a.dateOfDeath}T00:00:00Z`)
    );
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    const dateVal = r => (dateType === 'tenth' ? r.tenthDay : r.dateOfDeath);

    if (filterMode === 'latest') {
      return sorted;
    }
    if (filterMode === 'custom') {
      return sorted.filter(r => {
        const d = dateVal(r);
        return d && (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
      });
    }

    const days = Number(windowKey.replace(filterMode === 'upcoming' ? 'next' : 'prev', '')) || 30;
    const end = new Date(day);
    end.setDate(end.getDate() + days);
    const startD = new Date(day);
    startD.setDate(startD.getDate() - days);

    return sorted.filter(r => {
      const d = dateVal(r);
      if (!d) return false;
      const x = new Date(`${d}T00:00:00`);
      return filterMode === 'upcoming' ? x >= day && x <= end : x < day && x >= startD;
    });
  }, [wardScopedRows, filterMode, windowKey, fromDate, toDate, dateType]);

  useEffect(() => {
    setPage(1);
  }, [filterMode, windowKey, fromDate, toDate, dateType, pageSize]);

  // Paginated Rows
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [visibleRows, page, pageSize]);

  function openCreate() {
    setForm({ personId: '', dateOfDeath: new Date().toISOString().slice(0, 10), notes: '' });
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.createDeath(form.personId, { dateOfDeath: form.dateOfDeath, notes: form.notes });
      setOpen(false);
      await load();
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'success', message: r.message || 'Death record added successfully.' }
        })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function restoreDeath(r) {
    if (
      !confirm(
        `Restore ${r.person?.fullName || 'this citizen'} as active? This will re-enable their profile and voter status.`
      )
    )
      return;
    setBusy(true);
    try {
      await api.restoreDeath(r.id);
      setDetail(null);
      await load();
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'success', message: 'Citizen record restored to active successfully.' }
        })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-data-page deaths-page" style={{ paddingTop: '8px' }}>
      <PageHeader
        title="Death Records"
        subtitle="Manage official death records, coordinate bereavement support, and monitor 10th Day (Dahava) observances."
        action={
          canCreate ? (
            <button
              type="button"
              className="primary-btn"
              onClick={openCreate}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>+ Record Death</span>
            </button>
          ) : null
        }
      />

      <ErrorBox error={error} />

      {/* KPI Overview Cards (Strictly 3 clean cards) */}
      <div className="team-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="team-kpi-card">
          <div className="team-kpi-icon red">
            <HeartIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.activeDeaths}</div>
            <div className="team-kpi-label">Active Death Records</div>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon amber">
            <CalendarIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.upcomingTenth}</div>
            <div className="team-kpi-label">Upcoming 10th Day (Dahava)</div>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon green">
            <RefreshCwIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.restored}</div>
            <div className="team-kpi-label">Restored Records</div>
          </div>
        </div>
      </div>

      {/* Professional Filter Grid */}
      <section className="death-filter-panel">
        <div className="prof-filter-grid">
          {/* Ward Scope */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Ward Scope</label>
            <WardFilter compact label="Ward" />
          </div>

          {/* Search */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Search Deceased Record</label>
            <div className="prof-search-input-wrap">
              <SearchIcon size={16} />
              <input
                placeholder="Name, mobile, family, house…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Record Status */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Record Status</label>
            <select
              className="prof-filter-select"
              value={recordStatus}
              onChange={e => setRecordStatus(e.target.value)}
            >
              <option value="ACTIVE">Active Death Records</option>
              <option value="RESTORED">Restored Records</option>
              <option value="ALL">All Records</option>
            </select>
          </div>

          {/* Record View */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Record View</label>
            <select
              className="prof-filter-select"
              value={filterMode}
              onChange={e => {
                const v = e.target.value;
                setFilterMode(v);
                setWindowKey(v === 'upcoming' ? 'next30' : v === 'previous' ? 'prev30' : 'latest25');
              }}
            >
              <option value="latest">Latest Death Records</option>
              <option value="upcoming">Upcoming Observances</option>
              <option value="previous">Previous Observances</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Milestone Event Type (When filterMode !== 'latest') */}
          {filterMode !== 'latest' && (
            <div className="prof-filter-field">
              <label className="prof-filter-label">Milestone Event</label>
              <select
                className="prof-filter-select"
                value={dateType}
                onChange={e => setDateType(e.target.value)}
              >
                <option value="tenth">10th Day (Dahava)</option>
                <option value="death">Date of Death</option>
              </select>
            </div>
          )}

          {/* Period Window */}
          {filterMode !== 'latest' && filterMode !== 'custom' && (
            <div className="prof-filter-field">
              <label className="prof-filter-label">Period Window</label>
              <select
                className="prof-filter-select"
                value={windowKey}
                onChange={e => setWindowKey(e.target.value)}
              >
                {windows.map(w => (
                  <option key={w.key} value={w.key}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Date Range */}
          {filterMode === 'custom' && (
            <>
              <div className="prof-filter-field">
                <label className="prof-filter-label">From Date</label>
                <input
                  type="date"
                  className="prof-filter-select"
                  style={{ backgroundImage: 'none', paddingRight: '12px' }}
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </div>
              <div className="prof-filter-field">
                <label className="prof-filter-label">To Date</label>
                <input
                  type="date"
                  className="prof-filter-select"
                  style={{ backgroundImage: 'none', paddingRight: '12px' }}
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Clean Filter Status & Reset Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '8px' }}>
          <div className="muted" style={{ fontSize: '12.5px' }}>
            Showing <strong>{visibleRows.length}</strong> {visibleRows.length === 1 ? 'death record' : 'death records'}
          </div>
          <button
            type="button"
            className="small-btn"
            disabled={!search && filterMode === 'latest' && recordStatus === 'ACTIVE' && !fromDate && !toDate}
            onClick={() => {
              setSearch('');
              setFilterMode('latest');
              setRecordStatus('ACTIVE');
              setDateType('death');
              setFromDate('');
              setToDate('');
              setWindowKey('latest25');
            }}
            style={{ height: '32px', minHeight: '32px', padding: '0 14px', fontSize: '12.5px' }}
          >
            Reset Filters
          </button>
        </div>
      </section>

      {/* Main Table */}
      {!rows ? (
        <Loading />
      ) : !visibleRows.length ? (
        <Empty>No death records found for this ward and filter criteria.</Empty>
      ) : (
        <>
          <div className="panel table-wrap">
            <table className="deaths-table">
              <thead>
                <tr>
                  <th>Citizen</th>
                  <th>Family & Residence</th>
                  <th>Date of Death</th>
                  <th>10th Day (Dahava)</th>
                  <th>Status</th>
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

                  // Check if 10th day is soon
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);
                  const tenthDate = r.tenthDay ? new Date(`${r.tenthDay}T00:00:00Z`) : null;
                  const isTenthUpcoming =
                    tenthDate && tenthDate >= now && tenthDate.getTime() - now.getTime() <= 10 * 86400000;

                  return (
                    <tr key={r.id}>
                      {/* Citizen */}
                      <td data-label="Citizen">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="prof-avatar memorial">
                            {getInitials(p.fullName)}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <strong className="prof-text-truncate" style={{ fontSize: '13.5px', color: '#0f172a' }}>
                              {p.fullName || 'Citizen'}
                            </strong>
                            <div className="muted" style={{ fontSize: '11.5px', marginTop: '1px' }}>
                              <span>Age: {p.age ?? '—'}</span>
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
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Family & Residence */}
                      <td data-label="Family & Residence">
                        <div className="death-house-cell" title={[f.familyName, h.houseNumber, a.name, formatWardNumber(w.wardNumber)].filter(Boolean).join(' · ')}>
                          <div className="death-house-name">{f.familyName || 'Family —'}</div>
                          <div className="death-house-addr">
                            {h.houseNumber ? `House ${h.houseNumber}` : 'House —'}
                            {a.name ? ` · ${a.name}` : ''}
                          </div>
                        </div>
                      </td>

                      {/* Date of Death */}
                      <td data-label="Date of Death">
                        <div className="death-date-cell">
                          <CalendarIcon size={14} />
                          <strong>{display(r.dateOfDeath)}</strong>
                        </div>
                      </td>

                      {/* 10th Day (Dahava) */}
                      <td data-label="10th Day (Dahava)">
                        <div className="death-date-cell">
                          <strong>{display(r.tenthDay)}</strong>
                        </div>
                        {isTenthUpcoming && (
                          <span className="milestone-badge today">Upcoming</span>
                        )}
                      </td>

                      {/* Status */}
                      <td data-label="Status">
                        {r.recordStatus === 'RESTORED' ? (
                          <span className="team-badge green">Restored</span>
                        ) : (
                          <span className="team-badge gray">Deceased</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td data-label="Actions" style={{ textAlign: 'center' }}>
                        <div className="exec-action-group">
                          <button
                            type="button"
                            className="exec-btn-view"
                            onClick={() => setDetail(r)}
                            title="View full memorial details and former family"
                          >
                            <EyeIcon size={13} />
                            <span>View</span>
                          </button>
                          {r.recordStatus === 'ACTIVE' && canCreate && (
                            <button
                              type="button"
                              className="exec-btn-edit"
                              onClick={() => restoreDeath(r)}
                              title="Restore this citizen to active status"
                            >
                              <span>Restore</span>
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
          {visibleRows.length > 0 && (
            <PaginationBar
              page={page}
              total={visibleRows.length}
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
          MEMORIAL & RECORD DOSSIER MODAL
          ======================================================== */}
      {detail && (
        <Modal wide title="Memorial & Death Record Dossier" onClose={() => setDetail(null)}>
          {(() => {
            const p = detail.person || {};
            const f = p.family || {};
            const h = f.house || {};
            const a = h.area || {};
            const w = a.ward || {};

            return (
              <>
                {/* Memorial Banner */}
                <div className="memorial-banner">
                  <div className="memorial-ribbon-icon">
                    <HeartIcon size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                        {p.fullName || 'Citizen'}
                      </h3>
                      {detail.recordStatus === 'RESTORED' ? (
                        <span className="team-badge green">Record Restored</span>
                      ) : (
                        <span className="team-badge gray">Deceased Record</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginTop: '6px', fontSize: '12.5px', color: '#64748b' }}>
                      <span>Ward: <strong>{formatWardLabel(w, '—')}</strong></span>
                      <span>Colony: <strong>{a.name || '—'}</strong></span>
                      <span>Family: <strong>{f.familyName || '—'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Observance Milestones Cards (Only 2 cards: Date of Death and 10th Day Dahava) */}
                <div className="observance-milestones" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <div className="observance-card highlight">
                    <div className="observance-card-label">
                      <CalendarIcon size={14} style={{ color: '#dc2626' }} />
                      <span>Date of Death</span>
                    </div>
                    <div className="observance-card-val">{display(detail.dateOfDeath)}</div>
                    <div className="observance-card-meta">Recorded in official register</div>
                  </div>

                  <div className="observance-card">
                    <div className="observance-card-label">
                      <ClockIcon size={14} style={{ color: '#d97706' }} />
                      <span>10th Day Observance (Dahava)</span>
                    </div>
                    <div className="observance-card-val">{display(detail.tenthDay)}</div>
                    <div className="observance-card-meta">Calculated 10th day ritual</div>
                  </div>
                </div>

                {/* 2x2 Grid */}
                <div className="prof-detail-grid">
                  {/* Card 1: Citizen Profile */}
                  <div className="prof-detail-card">
                    <div className="prof-card-title">
                      <ShieldIcon size={16} />
                      <span>Deceased Citizen Profile</span>
                    </div>
                    <div className="prof-spec-list">
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Full Name</span>
                        <span className="prof-spec-v">{p.fullName || '—'}</span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Age at Death</span>
                        <span className="prof-spec-v">{p.age ?? '—'} years</span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Gender</span>
                        <span className="prof-spec-v">{p.gender || '—'}</span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Date of Birth</span>
                        <span className="prof-spec-v">{p.dob ? display(p.dob) : '—'}</span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Mobile Number</span>
                        <span className="prof-spec-v">{p.mobile || '—'}</span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Alternate Mobile</span>
                        <span className="prof-spec-v">{p.alternateMobile || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Household & Residence with Directions */}
                  <div className="prof-detail-card">
                    <div className="prof-card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BuildingIcon size={16} />
                        <span>Family & Residence</span>
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
                        title="Open Google Maps directions to this family's residence"
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
                        <span className="prof-spec-k">Area / Colony</span>
                        <span className="prof-spec-v">{a.name || '—'}</span>
                      </div>
                      <div className="prof-spec-row">
                        <span className="prof-spec-k">Ward</span>
                        <span className="prof-spec-v">{formatWardLabel(w, '—')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 3: Official Record & Audit Details */}
                <div className="prof-detail-card" style={{ marginBottom: '16px' }}>
                  <div className="prof-card-title">
                    <FileTextIcon size={16} />
                    <span>Official Death Record & Audit Details</span>
                  </div>
                  <div className="prof-spec-list">
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Reported By</span>
                      <span className="prof-spec-v">
                        {detail.reportedBy?.name || 'Staff'}{detail.reportedBy?.mobile ? ` (📞 ${detail.reportedBy.mobile})` : ''}
                      </span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Verification Status</span>
                      <span className="prof-spec-v">
                        <span className="team-badge green">{detail.verificationStatus || 'VERIFIED'}</span>
                      </span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Previous Voter Status</span>
                      <span className="prof-spec-v">{detail.previousVoterStatus || 'NOT_SPECIFIED'}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Record Status</span>
                      <span className="prof-spec-v">
                        {detail.recordStatus === 'RESTORED' ? (
                          <span className="team-badge green">
                            Restored {detail.restoredAt ? `on ${display(detail.restoredAt.slice(0, 10))}` : ''}
                          </span>
                        ) : (
                          <span className="team-badge gray">ACTIVE RECORD</span>
                        )}
                      </span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Record Notes</span>
                      <span className="prof-spec-v" style={{ textAlign: 'left', fontStyle: detail.notes ? 'normal' : 'italic', color: detail.notes ? '#0f172a' : '#94a3b8' }}>
                        {detail.notes || 'No special notes recorded.'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 4: Surviving Family Members */}
                <div className="prof-detail-card">
                  <div className="prof-card-title">
                    <UsersIcon size={16} />
                    <span>Family Members in Household ({(f.members || []).filter(m => m.id !== p.id).length})</span>
                  </div>
                  {(f.members || []).filter(m => m.id !== p.id).length ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                      {(f.members || []).filter(m => m.id !== p.id).map(m => (
                        <div
                          key={m.id}
                          style={{
                            padding: '10px 12px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px'
                          }}
                        >
                          <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                            {m.fullName}
                          </strong>
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                            <span>Age: {m.age ?? '—'}</span>
                            {m.mobile && <span> · 📞 {m.mobile}</span>}
                            <span> · {m.status || 'ACTIVE'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                      No other family members recorded in this household.
                    </div>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div className="modal-actions" style={{ marginTop: '20px' }}>
                  <button type="button" className="ghost-btn" onClick={() => setDetail(null)}>
                    Close
                  </button>
                  {detail.recordStatus === 'ACTIVE' && canCreate && (
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => restoreDeath(detail)}
                    >
                      Restore Citizen as Active
                    </button>
                  )}
                </div>
              </>
            );
          })()}
        </Modal>
      )}

      {/* ========================================================
          RECORD DEATH MODAL
          ======================================================== */}
      {open && (
        <Modal wide title="Record Death" onClose={() => setOpen(false)}>
          <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', color: '#991b1b', fontWeight: 600 }}>
              Official Deceased Citizen Registration
            </div>
            <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '3px' }}>
              Recording a death marks the citizen as deceased in the municipal registry, removes them from active rosters, and automatically schedules the 10th Day (Dahava) observance.
            </div>
          </div>

          <form className="form-grid" onSubmit={save}>
            <SearchableSelect
              className="span-2"
              label="Citizen to Mark as Deceased *"
              required
              value={form.personId}
              onChange={v => setForm({ ...form, personId: v })}
              options={activePeople.map(p => ({ value: p.id, label: personLabel(p) }))}
              placeholder="Search citizen by name, mobile, house number…"
            />

            <Field label="Date of Death *">
              <input
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={form.dateOfDeath}
                onChange={e => setForm({ ...form, dateOfDeath: e.target.value })}
              />
            </Field>

            <Field className="span-2" label="Official Notes & Context (Optional)">
              <textarea
                rows={3}
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Enter details of death certificate, hospital or family report…"
              />
            </Field>

            {/* Live Preview of Observance (Only 10th Day Dahava) */}
            <div className="span-2" style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '8px' }}>
                Automatic Observance Schedule Preview
              </div>
              <div style={{ padding: '10px 12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block' }}>10TH DAY (DAHAVA)</span>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                  {form.dateOfDeath ? display(addDays(form.dateOfDeath, 10)) : '—'}
                </strong>
              </div>
            </div>

            <div className="modal-actions span-2">
              <button type="button" className="ghost-btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={busy}>
                {busy ? 'Saving…' : 'Record Death'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
