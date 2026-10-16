import React, { useEffect, useMemo, useState } from 'react';
import { api, getUser } from '../services/api';
import {
  ErrorBox,
  Empty,
  Field,
  Loading,
  Modal,
  PageHeader,
  SearchableSelect,
  fmtDateTime
} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { isMaster, isSubMaster, isNagarsevak, isEmployee } from '../rbac';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWardFilter } from '../wardFilter';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import {
  BellIcon,
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  UsersIcon,
  SearchIcon,
  EyeIcon,
  CheckIcon,
  AlertCircleIcon,
  FileTextIcon,
  BuildingIcon
} from '../components/Icons';

function prettyType(v) {
  return v === 'EVENT' ? 'Community Event' : 'Official Ward Notice';
}

function prettyAudience(v) {
  return (
    {
      CITIZEN: 'Ward Citizens',
      NAGARSEVAK: 'Nagarsevak',
      EMPLOYEE: 'Employees',
      ALL_STAFF: 'Nagarsevak & Employees'
    }[v] || v || '—'
  );
}

function fmtEventDateTime(v) {
  if (!v) return '—';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(d);
  } catch {
    return String(v);
  }
}

export default function WardUpdates({ autoOpen = false }) {
  const user = getUser();
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedWardId } = useWardFilter();

  const master = isMaster(user);
  const sub = isSubMaster(user);
  const canManage = master || sub || isNagarsevak(user) || isEmployee(user);
  const isCitizen = String(user?.role || '').toUpperCase() === 'CITIZEN';

  // Check if we are on the dedicated compose subsection (/ward-updates/new)
  const isCreatePage = location.pathname === '/ward-updates/new' || (autoOpen && canManage);

  // Listing state
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25, pages: 1 });
  const [type, setType] = useState('');
  const [status, setStatus] = useState('PUBLISHED');
  const [audienceFilter, setAudienceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [error, setError] = useState('');
  const [wards, setWards] = useState([]);
  const [selectedUpdate, setSelectedUpdate] = useState(null);

  // Compose form state (used for dedicated /ward-updates/new page)
  const fixedWard = !master && !sub ? user?.wardId || user?.ward?.id || '' : '';
  const [composeType, setComposeType] = useState('WARD_UPDATE');
  const [composeTitle, setComposeTitle] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [composeWardId, setComposeWardId] = useState(fixedWard || selectedWardId || '');
  const [composeAudience, setComposeAudience] = useState('CITIZEN');
  const [composeEventDate, setComposeEventDate] = useState('');
  const [composeLocation, setComposeLocation] = useState('');
  const [composeBusy, setComposeBusy] = useState(false);
  const [composeSuccess, setComposeSuccess] = useState('');

  useEffect(() => {
    if (canManage && (master || sub)) {
      api.wards().then(r => setWards(r.data || [])).catch(e => setError(e.message));
    }
  }, [master, sub, canManage]);

  useEffect(() => {
    if (!composeWardId && fixedWard) setComposeWardId(fixedWard);
    else if (!composeWardId && selectedWardId) setComposeWardId(selectedWardId);
  }, [fixedWard, selectedWardId, composeWardId]);

  useEffect(() => {
    setPage(1);
  }, [selectedWardId, type, status, audienceFilter, search]);

  useEffect(() => {
    if (isCreatePage) return; // Don't fetch list when solely on dedicated create page
    let live = true;
    const timer = setTimeout(async () => {
      try {
        setError('');
        const r = await api.wardUpdates({
          page,
          limit,
          search: search.trim(),
          type: type || undefined,
          status,
          wardId: selectedWardId || undefined
        });
        if (!live) return;
        setRows(r.data || []);
        setMeta(r.meta || { total: (r.data || []).length, page, limit, pages: 1 });
      } catch (e) {
        if (live) {
          setRows([]);
          setError(e.message);
        }
      }
    }, 160);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [page, limit, search, type, status, selectedWardId, isCreatePage]);

  // Deep-link popup
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('open');
    if (!id || !rows?.length) return;
    const found = rows.find(r => String(r.id) === String(id));
    if (found) setSelectedUpdate(found);
  }, [location.search, rows]);

  // Client-side ward scoping (double-locking)
  const wardScopedRows = useMemo(() => {
    const list = rows || [];
    if (!selectedWardId) return list;
    return list.filter(r => {
      const wId = r.wardId || r.ward?.id;
      return String(wId) === String(selectedWardId);
    });
  }, [rows, selectedWardId]);

  // Filtered rows
  const visibleRows = useMemo(() => {
    let list = wardScopedRows;
    if (audienceFilter) {
      list = list.filter(r => r.audience === audienceFilter);
    }
    return list;
  }, [wardScopedRows, audienceFilter]);

  // KPI Statistics
  const stats = useMemo(() => {
    const list = wardScopedRows;
    let published = 0;
    let events = 0;
    let notices = 0;
    let archived = 0;
    for (const r of list) {
      if (r.status === 'PUBLISHED') published += 1;
      if (r.status === 'ARCHIVED') archived += 1;
      if (r.type === 'EVENT') events += 1;
      if (r.type === 'WARD_UPDATE') notices += 1;
    }
    return {
      published,
      events,
      notices,
      archived,
      total: list.length
    };
  }, [wardScopedRows]);

  async function archive(id) {
    if (!window.confirm('Archive this update? It will be moved from active ward feeds to archived records.')) return;
    try {
      await api.archiveWardUpdate(id);
      setRows(x => (x || []).map(r => (r.id === id ? { ...r, status: 'ARCHIVED' } : r)));
    } catch (e) {
      setError(e.message);
    }
  }

  // Handle compose publish
  async function handleComposeSubmit(e) {
    e.preventDefault();
    if (!composeWardId) {
      setError('Please select an active publishing ward.');
      return;
    }
    setComposeBusy(true);
    setError('');
    setComposeSuccess('');
    try {
      await api.createWardUpdate({
        type: composeType,
        title: composeTitle.trim(),
        message: composeMessage.trim(),
        wardId: composeWardId,
        audience: composeAudience,
        eventDate: composeEventDate || undefined,
        location: composeLocation.trim() || undefined
      });
      setComposeSuccess('Update published successfully! Notifications have been sent to recipients.');
      setTimeout(() => {
        navigate('/ward-updates');
      }, 1000);
    } catch (e) {
      setError(e.message);
    } finally {
      setComposeBusy(false);
    }
  }

  const audienceOptions =
    master || sub
      ? [
          { value: 'CITIZEN', label: 'Ward Citizens' },
          { value: 'NAGARSEVAK', label: 'Nagarsevaks' },
          { value: 'EMPLOYEE', label: 'Employees' },
          { value: 'ALL_STAFF', label: 'All Staff (Nagarsevak & Employees)' }
        ]
      : [{ value: 'CITIZEN', label: 'Ward Citizens' }];

  // =========================================================================
  // SUBSECTION 2: DEDICATED CREATE WARD UPDATE / EVENT VIEW (/ward-updates/new)
  // =========================================================================
  if (isCreatePage && canManage) {
    const selectedWardObj = wards.find(w => w.id === composeWardId) || user?.ward;
    const previewWardLabel = selectedWardObj ? formatWardLabel(selectedWardObj) : 'Ward Scope';

    return (
      <div className="admin-data-page ward-updates-page" style={{ paddingTop: '8px' }}>
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: '8px' }}>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => navigate('/ward-updates')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '4px 8px', color: '#64748b' }}
          >
            <span>← Back to All Updates & Events</span>
          </button>
        </div>

        <PageHeader
          title="Create Ward Update / Event"
          subtitle="Publish official civic announcements, advisories, or schedule community ward meetings for ward residents and field teams."
        />

        <ErrorBox error={error} />
        {composeSuccess && (
          <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: 600 }}>
            {composeSuccess}
          </div>
        )}

        {/* 2-Column Compose & Live Preview Hub */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', alignItems: 'start' }}>
          {/* Left Column: Compose Form */}
          <section className="prof-card" style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <form onSubmit={handleComposeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Type Switcher Tabs */}
              <div>
                <label className="prof-filter-label" style={{ marginBottom: '6px', display: 'block' }}>
                  Publication Category *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setComposeType('WARD_UPDATE')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: composeType === 'WARD_UPDATE' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: composeType === 'WARD_UPDATE' ? '#f0f9ff' : '#ffffff',
                      color: composeType === 'WARD_UPDATE' ? '#0369a1' : '#475569'
                    }}
                  >
                    <BellIcon size={16} />
                    <span>Official Notice</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setComposeType('EVENT')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: composeType === 'EVENT' ? '2px solid #d97706' : '1px solid #cbd5e1',
                      background: composeType === 'EVENT' ? '#fffbeb' : '#ffffff',
                      color: composeType === 'EVENT' ? '#b45309' : '#475569'
                    }}
                  >
                    <CalendarIcon size={16} />
                    <span>Community Event</span>
                  </button>
                </div>
              </div>

              {/* Scope & Audience Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {master || sub ? (
                  <SearchableSelect
                    label="Publishing Ward *"
                    required
                    value={composeWardId}
                    onChange={setComposeWardId}
                    options={wards.map(w => ({ value: w.id, label: formatWardLabel(w) }))}
                    placeholder="Select ward…"
                  />
                ) : (
                  <div className="prof-filter-field">
                    <label className="prof-filter-label">Publishing Ward</label>
                    <div style={{ padding: '9px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                      {formatWardLabel(user?.ward, 'Assigned Ward')}
                    </div>
                  </div>
                )}

                <Field label="Target Audience *">
                  <select
                    className="prof-filter-select"
                    value={composeAudience}
                    onChange={e => setComposeAudience(e.target.value)}
                  >
                    {audienceOptions.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Conditional Event Date & Location */}
              {composeType === 'EVENT' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', background: '#fffbeb', padding: '14px', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                  <Field label="Event Date & Time *">
                    <input
                      type="datetime-local"
                      required={composeType === 'EVENT'}
                      value={composeEventDate}
                      onChange={e => setComposeEventDate(e.target.value)}
                    />
                  </Field>

                  <Field label="Event Venue / Location">
                    <input
                      maxLength="300"
                      value={composeLocation}
                      onChange={e => setComposeLocation(e.target.value)}
                      placeholder="e.g. Ward Office / Samaj Mandir"
                    />
                  </Field>
                </div>
              )}

              {/* Announcement Title */}
              <Field label="Announcement Title *">
                <input
                  required
                  maxLength="180"
                  value={composeTitle}
                  onChange={e => setComposeTitle(e.target.value)}
                  placeholder={composeType === 'EVENT' ? 'e.g. Public Health Checkup Camp & Vaccination Drive' : 'e.g. Scheduled Water Supply Maintenance Notice'}
                />
              </Field>

              {/* Details & Message */}
              <Field label="Announcement Message / Details *">
                <textarea
                  required
                  rows="6"
                  maxLength="10000"
                  value={composeMessage}
                  onChange={e => setComposeMessage(e.target.value)}
                  placeholder="Provide comprehensive details, timings, beneficiary instructions, or contact details for citizens…"
                />
              </Field>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => navigate('/ward-updates')}
                  disabled={composeBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={composeBusy || !composeWardId}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: '130px', justifyContent: 'center' }}
                >
                  <CheckIcon size={16} />
                  <span>{composeBusy ? 'Publishing…' : composeType === 'EVENT' ? 'Publish Event' : 'Publish Notice'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Right Column: Real-time Live Announcement Preview */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Live Resident Preview
              </div>
              <span className="team-badge gray" style={{ fontSize: '10.5px' }}>
                Interactive Feed Card
              </span>
            </div>

            <article
              className="prof-card"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
              }}
            >
              {/* Header Badges */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span
                  className={`team-badge ${composeType === 'EVENT' ? 'amber' : 'blue'}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}
                >
                  {composeType === 'EVENT' ? <CalendarIcon size={13} /> : <BellIcon size={13} />}
                  <span>{composeType === 'EVENT' ? 'Community Event' : 'Official Notice'}</span>
                </span>
                <span className="muted" style={{ fontSize: '11.5px', fontWeight: 600 }}>
                  {previewWardLabel}
                </span>
              </div>

              {/* Title */}
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 700, lineHeight: 1.3 }}>
                {composeTitle || 'Title will appear here…'}
              </h3>

              {/* Event Box (if event) */}
              {composeType === 'EVENT' && (
                <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '10px 12px', border: '1px solid #fef3c7', fontSize: '12px', color: '#92400e', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CalendarIcon size={13} style={{ color: '#d97706' }} />
                    <strong>{composeEventDate ? fmtEventDateTime(composeEventDate) : 'Date & time not selected yet'}</strong>
                  </div>
                  {composeLocation && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPinIcon size={13} style={{ color: '#d97706' }} />
                      <span>{composeLocation}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Message Body */}
              <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {composeMessage || 'Message details and advisory instructions will appear here as you type…'}
              </p>

              {/* Footer Meta */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #f1f5f9', fontSize: '11.5px', color: '#64748b' }}>
                <span className="team-badge gray" style={{ fontSize: '10.5px' }}>
                  Audience: {prettyAudience(composeAudience)}
                </span>
                <span>By: {user?.name || 'Authorized Official'} · Today</span>
              </div>
            </article>
          </aside>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SUBSECTION 1: ALL UPDATES & EVENTS HUB (/ward-updates)
  // =========================================================================
  return (
    <div className={isCitizen ? 'civic-dir-shell' : 'admin-data-page ward-updates-page'} style={isCitizen ? undefined : { paddingTop: '8px' }}>
      <PageHeader
        kicker={isCitizen ? 'Ward notices' : undefined}
        title="Ward Updates & Events"
        subtitle={
          isCitizen
            ? 'Official notices and community events for your registered ward.'
            : 'Broadcast official civic announcements, track active advisories, and coordinate community events across wards.'
        }
        action={
          canManage ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => navigate('/ward-updates/new')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>+ Create Update / Event</span>
            </button>
          ) : null
        }
      />

      <ErrorBox error={error} />

      {isCitizen ? (
        <div className="civic-metric-grid civic-metric-3">
          <article className="civic-metric">
            <div className="civic-metric-copy">
              <strong>{stats.published}</strong>
              <span>Published</span>
            </div>
            <div className="civic-metric-ico is-green"><CheckIcon size={18} /></div>
          </article>
          <article className="civic-metric">
            <div className="civic-metric-copy">
              <strong>{stats.events}</strong>
              <span>Events</span>
            </div>
            <div className="civic-metric-ico is-amber"><CalendarIcon size={18} /></div>
          </article>
          <article className="civic-metric">
            <div className="civic-metric-copy">
              <strong>{stats.notices}</strong>
              <span>Notices</span>
            </div>
            <div className="civic-metric-ico is-blue"><BellIcon size={18} /></div>
          </article>
        </div>
      ) : (
      <div className="team-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginBottom: '16px' }}>
        <div className="team-kpi-card">
          <div className="team-kpi-icon green">
            <CheckIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.published}</div>
            <div className="team-kpi-label">Active & Published</div>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon amber">
            <CalendarIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.events}</div>
            <div className="team-kpi-label">Community Events</div>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon blue">
            <BellIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.notices}</div>
            <div className="team-kpi-label">Official Notices</div>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon gray">
            <AlertCircleIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.archived}</div>
            <div className="team-kpi-label">Archived Records</div>
          </div>
        </div>
      </div>
      )}

      {isCitizen ? (
        <div className="civic-dir-toolbar">
          <div className="civic-dir-search">
            <SearchIcon size={16} />
            <input
              placeholder="Search notices and events…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="civic-dir-select"
            value={type}
            onChange={e => setType(e.target.value)}
            aria-label="Category"
          >
            <option value="">All categories</option>
            <option value="WARD_UPDATE">Official notices</option>
            <option value="EVENT">Community events</option>
          </select>
          <button
            type="button"
            className="civic-dir-reset"
            disabled={!search && !type}
            onClick={() => { setSearch(''); setType(''); setPage(1); }}
          >
            Reset
          </button>
        </div>
      ) : (
      <section className="death-filter-panel updates-filter-panel" style={{ marginBottom: '16px' }}>
        <div className="prof-filter-grid">
          {/* Ward Scope */}
          {canManage && (
            <div className="prof-filter-field">
              <label className="prof-filter-label">Ward Scope</label>
              <WardFilter compact label="Ward" />
            </div>
          )}

          {/* Quick Search */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Search Announcements</label>
            <div className="prof-search-input-wrap">
              <SearchIcon size={16} />
              <input
                placeholder="Title, message details, venue…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Category</label>
            <select
              className="prof-filter-select"
              value={type}
              onChange={e => setType(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="WARD_UPDATE">Official Notices</option>
              <option value="EVENT">Community Events</option>
            </select>
          </div>

          {/* Status Filter */}
          {canManage && (
            <div className="prof-filter-field">
              <label className="prof-filter-label">Publication Status</label>
              <select
                className="prof-filter-select"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="PUBLISHED">Published (Active)</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          )}

          {/* Audience Filter */}
          {canManage && (
            <div className="prof-filter-field">
              <label className="prof-filter-label">Target Audience</label>
              <select
                className="prof-filter-select"
                value={audienceFilter}
                onChange={e => setAudienceFilter(e.target.value)}
              >
                <option value="">All Audiences</option>
                <option value="CITIZEN">Ward Citizens</option>
                <option value="NAGARSEVAK">Nagarsevaks</option>
                <option value="EMPLOYEE">Employees</option>
                <option value="ALL_STAFF">All Staff</option>
              </select>
            </div>
          )}
        </div>

        {/* Clean Filter Status & Reset Action Bar */}
        <div className="updates-filter-status">
          <div className="muted updates-filter-count">
            Showing <strong>{visibleRows.length}</strong> {visibleRows.length === 1 ? 'announcement' : 'announcements'}
          </div>
          <button
            type="button"
            className="small-btn"
            disabled={!search && !type && status === 'PUBLISHED' && !audienceFilter}
            onClick={() => {
              setSearch('');
              setType('');
              setStatus('PUBLISHED');
              setAudienceFilter('');
              setPage(1);
            }}
            style={{ height: '32px', minHeight: '32px', padding: '0 14px', fontSize: '12.5px' }}
          >
            Reset Filters
          </button>
        </div>
      </section>
      )}

      {/* Main Announcements Grid */}
      {!rows ? (
        <Loading />
      ) : !visibleRows.length ? (
        <Empty>{status === 'ARCHIVED' ? 'No archived updates found.' : 'No ward updates or events match your filter criteria.'}</Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {visibleRows.map(u => {
            const isEvt = u.type === 'EVENT';
            const isPub = u.status === 'PUBLISHED';

            return (
              <article
                className="prof-card"
                key={u.id}
                onClick={() => setSelectedUpdate(u)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                {/* Header: Type Badge & Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      className={`team-badge ${isEvt ? 'amber' : 'blue'}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}
                    >
                      {isEvt ? <CalendarIcon size={12} /> : <BellIcon size={12} />}
                      <span>{isEvt ? 'Community Event' : 'Official Notice'}</span>
                    </span>
                    {!isCitizen && (
                      <span className="team-badge gray" style={{ fontSize: '10.5px' }}>
                        {prettyAudience(u.audience)}
                      </span>
                    )}
                  </div>

                  <span
                    className={`team-badge ${isPub ? 'green' : 'gray'}`}
                    style={{ fontSize: '11px', fontWeight: 600 }}
                  >
                    {u.status}
                  </span>
                </div>

                {/* Title */}
                <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: 700, lineHeight: 1.35 }}>
                  {u.title}
                </h3>

                {/* Event Schedule Box (if event) */}
                {isEvt && (
                  <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '10px 12px', border: '1px solid #fef3c7', fontSize: '12px', color: '#92400e', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CalendarIcon size={13} style={{ color: '#d97706', flexShrink: 0 }} />
                      <strong className="prof-text-truncate">{fmtEventDateTime(u.eventDate)}</strong>
                    </div>
                    {u.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPinIcon size={13} style={{ color: '#d97706', flexShrink: 0 }} />
                        <span className="prof-text-truncate">{u.location}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Message Body Preview */}
                <p
                  className="muted"
                  style={{
                    margin: 0,
                    fontSize: '12.5px',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {u.message}
                </p>

                {/* Meta Specifications */}
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '3px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BuildingIcon size={12} style={{ color: '#94a3b8' }} />
                    <span className="prof-text-truncate">
                      <strong>Ward: </strong>
                      {formatWardLabel(u.ward)}
                    </span>
                  </div>
                  <div>
                    <span>Published: </span>
                    <strong style={{ color: '#334155' }}>{fmtDateTime(u.publishedAt || u.createdAt)}</strong>
                    {u.createdBy?.name ? (
                      <span> · By {u.createdBy.name}</span>
                    ) : null}
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="btn-action outline-blue"
                    onClick={() => setSelectedUpdate(u)}
                    style={{ flex: 1, justifyContent: 'center' }}
                    title="View full notice, schedule, and audience specifications"
                  >
                    <EyeIcon size={13} />
                    <span>View Details</span>
                  </button>

                  {canManage && isPub && (
                    <button
                      type="button"
                      className="btn-action"
                      onClick={() => archive(u.id)}
                      title="Archive this announcement"
                      style={{ padding: '0 10px', color: '#64748b' }}
                    >
                      <span>Archive</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {visibleRows.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '12px 16px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
          <div className="muted" style={{ fontSize: '12.5px' }}>
            Showing Page <strong>{page}</strong> of <strong>{meta.pages || 1}</strong> ({meta.total || visibleRows.length} total)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="small-btn"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="small-btn"
              disabled={page >= (meta.pages || 1)}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {selectedUpdate && (
        <Modal wide title={`${selectedUpdate.title} · Announcement Details`} onClose={() => setSelectedUpdate(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Banner */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '17px', color: '#0f172a' }}>{selectedUpdate.title}</strong>
                  <span className={`team-badge ${selectedUpdate.type === 'EVENT' ? 'amber' : 'blue'}`}>
                    {selectedUpdate.type === 'EVENT' ? 'Event' : 'Notice'}
                  </span>
                  <span className={`team-badge ${selectedUpdate.status === 'PUBLISHED' ? 'green' : 'gray'}`}>
                    {selectedUpdate.status}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: '12.5px' }}>
                  <span>Published: {fmtDateTime(selectedUpdate.publishedAt || selectedUpdate.createdAt)}</span>
                  <span> · By: {selectedUpdate.createdBy?.name || 'System Official'}</span>
                </div>
              </div>

              {canManage && selectedUpdate.status === 'PUBLISHED' && (
                <button
                  type="button"
                  className="small-btn"
                  onClick={() => {
                    archive(selectedUpdate.id);
                    setSelectedUpdate(null);
                  }}
                  style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                >
                  Archive Notice
                </button>
              )}
            </div>

            {/* Specifications Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Card 1: Ward & Scope */}
              <div className="prof-detail-card">
                <div className="prof-card-title">
                  <BuildingIcon size={16} />
                  <span>Ward Scope</span>
                </div>
                <div className="prof-spec-list">
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Assigned Ward:</span>
                    <strong className="prof-spec-value">{formatWardLabel(selectedUpdate.ward)}</strong>
                  </div>
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Target Audience:</span>
                    <span className="prof-spec-value">{prettyAudience(selectedUpdate.audience)}</span>
                  </div>
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Status:</span>
                    <span className="prof-spec-value">{selectedUpdate.status}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Schedule & Venue */}
              <div className="prof-detail-card">
                <div className="prof-card-title">
                  <CalendarIcon size={16} />
                  <span>Event & Schedule</span>
                </div>
                <div className="prof-spec-list">
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Event Date / Time:</span>
                    <strong className="prof-spec-value">{fmtEventDateTime(selectedUpdate.eventDate)}</strong>
                  </div>
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Venue / Location:</span>
                    <span className="prof-spec-value">{selectedUpdate.location || '—'}</span>
                  </div>
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Notice Type:</span>
                    <span className="prof-spec-value">{prettyType(selectedUpdate.type)}</span>
                  </div>
                </div>
              </div>

              {/* Full Message Details */}
              <div className="prof-detail-card" style={{ gridColumn: '1 / -1' }}>
                <div className="prof-card-title">
                  <FileTextIcon size={16} />
                  <span>Full Announcement Message</span>
                </div>
                <div style={{ padding: '14px 16px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13.5px', color: '#1e293b', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {selectedUpdate.message || '—'}
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button type="button" className="ghost-btn" onClick={() => setSelectedUpdate(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
