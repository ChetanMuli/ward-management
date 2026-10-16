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
  SearchableSelect
} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { isMaster, isSubMaster, isNagarsevak } from '../rbac';
import { useWardFilter } from '../wardFilter';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import {
  CheckIcon,
  AlertCircleIcon,
  ClockIcon,
  FileTextIcon,
  SearchIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
  BellIcon,
  ExternalLinkIcon,
  BuildingIcon,
  PhoneIcon,
  UsersIcon
} from '../components/Icons';

const prettyRole = r => (r ? r.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, m => m.toUpperCase()) : '');
const blank = {
  title: '',
  description: '',
  benefits: '',
  eligibility: '',
  minAge: '',
  maxAge: '',
  gender: 'ALL',
  audience: '',
  wardId: '',
  applicationUrl: '',
  contactInfo: '',
  startDate: '',
  endDate: '',
  status: 'PUBLISHED'
};

let _schemesCache = null;

export default function Schemes() {
  const user = getUser();
  const location = useLocation();
  const master = isMaster(user);
  const sub = isSubMaster(user);
  const councillor = isNagarsevak(user);
  const isCitizen = String(user?.role || '').toUpperCase() === 'CITIZEN';
  const { selectedWardId } = useWardFilter();

  const [rows, setRows] = useState(() => _schemesCache || null);
  const [wards, setWards] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [schemeNotify, setSchemeNotify] = useState(null);
  const [schemeNotifyForm, setSchemeNotifyForm] = useState({ title: '', message: '' });

  async function load() {
    try {
      setError('');
      const r = await api.schemes({
        search: search || undefined,
        status: isCitizen ? 'PUBLISHED' : status || undefined,
        wardId: selectedWardId || undefined
      });
      const list = r.data || [];
      setRows(list);
      if (!search && !status && !selectedWardId) _schemesCache = list;
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 220);
    return () => clearTimeout(t);
  }, [search, status, selectedWardId, isCitizen]);

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('open');
    if (!id || !rows?.length) return;
    const found = rows.find(r => String(r.id) === String(id));
    if (found) setDetail(found);
  }, [location.search, rows]);

  useEffect(() => {
    if (!(master || sub)) return;
    api.wards().then(r => setWards(r.data || [])).catch(e => setError(e.message));
  }, [master, sub]);

  const canEdit = master || sub || councillor;
  const canNotify = master || councillor;

  function openSchemeNotify(r) {
    const fixedWardId = r.wardId || r.ward?.id || '';
    setError('');
    if (!fixedWardId) {
      setError('This scheme has no publishing ward. Edit the scheme and select its ward first.');
      return;
    }
    setSchemeNotify(r);
    setSchemeNotifyForm({
      title: `Scheme: ${r.title}`,
      message: `Please review the published scheme "${r.title}" and its eligibility/details.`
    });
  }

  async function sendSchemeNotify(e) {
    e.preventDefault();
    const fixedWardId = schemeNotify?.wardId || schemeNotify?.ward?.id || '';
    if (!fixedWardId) {
      setError('This scheme has no publishing ward. Edit the scheme and select its ward first.');
      return;
    }
    setBusy(true);
    try {
      await api.sendSchemeNotification({
        schemeId: schemeNotify.id,
        targetWardId: fixedWardId,
        selectAll: true,
        title: schemeNotifyForm.title,
        message: schemeNotifyForm.message
      });
      setSchemeNotify(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    const fixed = councillor ? selectedWardId || user?.wardId || '' : selectedWardId || '';
    setForm({ ...blank, wardId: fixed });
    setEdit('create');
  }

  function openEdit(r) {
    setForm({ ...blank, ...r, wardId: r.wardId || r.ward?.id || '' });
    setEdit(r);
  }

  async function save(e) {
    e.preventDefault();
    if (!form.wardId) {
      setError('Please select the publishing ward for this scheme.');
      return;
    }
    setBusy(true);
    try {
      const d = {
        ...form,
        minAge: form.minAge === '' ? null : Number(form.minAge),
        maxAge: form.maxAge === '' ? null : Number(form.maxAge),
        wardId: form.wardId
      };
      if (edit === 'create') await api.createScheme(d);
      else await api.updateScheme(edit.id, d);
      setEdit(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const wardLabel = r => formatWardLabel(r.ward, 'Ward not assigned');
  const creatorLabel = r =>
    `${r.createdByName || r.createdBy?.name || 'System'}${
      r.createdByRole || r.createdBy?.Role?.name
        ? ` · ${prettyRole(r.createdByRole || r.createdBy.Role.name)}`
        : ''
    }`;

  // Client-side ward scoping (double-locking)
  const wardScopedRows = useMemo(() => {
    const list = rows || [];
    if (!selectedWardId) return list;
    return list.filter(r => {
      const wId = r.wardId || r.ward?.id;
      return String(wId) === String(selectedWardId);
    });
  }, [rows, selectedWardId]);

  // Client-side gender & audience filter
  const visibleRows = useMemo(() => {
    let list = wardScopedRows;
    if (genderFilter) {
      list = list.filter(r => r.gender === genderFilter);
    }
    return list;
  }, [wardScopedRows, genderFilter]);

  // KPI Statistics
  const stats = useMemo(() => {
    const list = wardScopedRows;
    let published = 0;
    let draft = 0;
    let closed = 0;
    for (const r of list) {
      if (r.status === 'PUBLISHED') published += 1;
      else if (r.status === 'DRAFT') draft += 1;
      else if (r.status === 'CLOSED') closed += 1;
    }
    return {
      total: list.length,
      published,
      draft,
      closed
    };
  }, [wardScopedRows]);

  return (
    <div className={isCitizen ? 'civic-dir-shell' : 'admin-data-page admin-schemes-page'} style={isCitizen ? undefined : { paddingTop: '8px' }}>
      <PageHeader
        kicker={isCitizen ? 'Citizen Welfare' : 'Public Welfare Programs'}
        title={isCitizen ? 'Government Schemes for You' : 'Schemes & Benefits'}
        subtitle={
          isCitizen
            ? 'Welfare programs and benefits available for residents of your registered ward.'
            : 'Publish government welfare programs, manage citizen eligibility criteria, and broadcast assistance to ward residents.'
        }
        action={
          canEdit ? (
            <button
              type="button"
              className="primary-btn"
              onClick={openCreate}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>+ New Scheme</span>
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
              <span>Active</span>
            </div>
            <div className="civic-metric-ico is-green"><CheckIcon size={18} /></div>
          </article>
          <article className="civic-metric">
            <div className="civic-metric-copy">
              <strong>{stats.total}</strong>
              <span>Total schemes</span>
            </div>
            <div className="civic-metric-ico is-blue"><FileTextIcon size={18} /></div>
          </article>
          <article className="civic-metric">
            <div className="civic-metric-copy">
              <strong>{wardScopedRows.filter(r => !r.gender || r.gender === 'ALL').length}</strong>
              <span>For everyone</span>
            </div>
            <div className="civic-metric-ico is-amber"><UsersIcon size={18} /></div>
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
          <div className="team-kpi-icon blue">
            <FileTextIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.total}</div>
            <div className="team-kpi-label">Total Schemes</div>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon amber">
            <ClockIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.draft}</div>
            <div className="team-kpi-label">Draft Schemes</div>
          </div>
        </div>

        <div className="team-kpi-card">
          <div className="team-kpi-icon gray">
            <AlertCircleIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.closed}</div>
            <div className="team-kpi-label">Closed / Archived</div>
          </div>
        </div>
      </div>
      )}

      {isCitizen ? (
        <div className="civic-dir-toolbar">
          <div className="civic-dir-search">
            <SearchIcon size={16} />
            <input
              placeholder="Search schemes, benefits, eligibility…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="civic-dir-select"
            value={genderFilter}
            onChange={e => setGenderFilter(e.target.value)}
            aria-label="Beneficiaries"
          >
            <option value="">All beneficiaries</option>
            <option value="ALL">For everyone</option>
            <option value="FEMALE">Women</option>
            <option value="MALE">Men</option>
            <option value="OTHER">Other</option>
          </select>
          <button
            type="button"
            className="civic-dir-reset"
            disabled={!search && !genderFilter}
            onClick={() => { setSearch(''); setGenderFilter(''); }}
          >
            Reset
          </button>
        </div>
      ) : (
      <section className="death-filter-panel" style={{ marginBottom: '16px' }}>
        <div className="prof-filter-grid">
          {/* Ward Scope */}
          {!isCitizen && (
            <div className="prof-filter-field">
              <label className="prof-filter-label">Ward Scope</label>
              <WardFilter compact label="Ward" />
            </div>
          )}

          {/* Quick Search */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Search Schemes</label>
            <div className="prof-search-input-wrap">
              <SearchIcon size={16} />
              <input
                placeholder="Title, benefits, eligibility, audience…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Status Filter */}
          {!isCitizen && (
            <div className="prof-filter-field">
              <label className="prof-filter-label">Scheme Status</label>
              <select
                className="prof-filter-select"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          )}

          {/* Target Beneficiaries / Gender */}
          <div className="prof-filter-field">
            <label className="prof-filter-label">Target Beneficiaries</label>
            <select
              className="prof-filter-select"
              value={genderFilter}
              onChange={e => setGenderFilter(e.target.value)}
            >
              <option value="">All Beneficiaries</option>
              <option value="ALL">For Everyone</option>
              <option value="FEMALE">Females / Women</option>
              <option value="MALE">Males / Men</option>
              <option value="OTHER">Other Genders</option>
            </select>
          </div>
        </div>

        {/* Clean Filter Status & Reset Action Bar */}
        <div className="updates-filter-status civic-dir-status">
          <div className="muted updates-filter-count">
            Showing <strong>{visibleRows.length}</strong> {visibleRows.length === 1 ? 'scheme' : 'schemes'}
          </div>
          <button
            type="button"
            className="small-btn"
            disabled={!search && !status && !genderFilter}
            onClick={() => {
              setSearch('');
              setStatus('');
              setGenderFilter('');
            }}
            style={{ height: '32px', minHeight: '32px', padding: '0 14px', fontSize: '12.5px' }}
          >
            Reset Filters
          </button>
        </div>
      </section>
      )}

      {/* Main Schemes Grid */}
      {rows === null ? (
        <Loading />
      ) : !visibleRows.length ? (
        <Empty>No schemes match your filter criteria.</Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {visibleRows.map(r => {
            const isPub = r.status === 'PUBLISHED';
            const isDft = r.status === 'DRAFT';

            return (
              <article
                className="prof-card"
                key={r.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  position: 'relative'
                }}
              >
                {/* Header: Status Pill & Ward */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span
                    className={`team-badge ${isPub ? 'green' : isDft ? 'amber' : 'gray'}`}
                    style={{ fontWeight: 700, fontSize: '11px' }}
                  >
                    {r.status}
                  </span>
                  <span className="muted prof-text-truncate" style={{ fontSize: '11.5px', fontWeight: 600 }}>
                    {wardLabel(r)}
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#0f172a', fontWeight: 700, lineHeight: 1.3 }}>
                    {r.title}
                  </h3>
                  <p
                    className="muted"
                    style={{
                      margin: 0,
                      fontSize: '12.5px',
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {r.description}
                  </p>
                </div>

                {/* Key Benefits Callout */}
                {r.benefits && (
                  <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#1e293b', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>
                      Key Benefits
                    </div>
                    <div className="prof-text-truncate" style={{ fontWeight: 600 }}>
                      {r.benefits}
                    </div>
                  </div>
                )}

                {/* Eligibility Tag Row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px' }}>
                  <span style={{ padding: '3px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', fontWeight: 600 }}>
                    {r.gender === 'ALL'
                      ? 'All Genders'
                      : r.gender === 'FEMALE'
                      ? 'Women / Girls'
                      : r.gender === 'MALE'
                      ? 'Men / Boys'
                      : 'Other Genders'}
                  </span>
                  {(r.minAge != null || r.maxAge != null) && (
                    <span style={{ padding: '3px 8px', background: '#fef3c7', color: '#92400e', borderRadius: '4px', fontWeight: 600 }}>
                      Age {r.minAge ?? 0}–{r.maxAge ?? '+'}
                    </span>
                  )}
                  {r.audience && (
                    <span style={{ padding: '3px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '4px', fontWeight: 600 }}>
                      {r.audience}
                    </span>
                  )}
                </div>

                {/* Meta Info */}
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div>
                    <span>Published by: </span>
                    <strong style={{ color: '#334155' }}>{creatorLabel(r)}</strong>
                  </div>
                  {(r.startDate || r.endDate) && (
                    <div>
                      <span>Validity: </span>
                      <strong style={{ color: '#334155' }}>
                        {r.startDate || 'Open'} → {r.endDate || 'Ongoing'}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Action Buttons Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-action outline-blue"
                    onClick={() => setDetail(r)}
                    style={{ flex: 1, justifyContent: 'center' }}
                    title="View full scheme overview and eligibility specifications"
                  >
                    <EyeIcon size={13} />
                    <span>Details</span>
                  </button>

                  {canNotify && r.status === 'PUBLISHED' && r.ward?.id && (
                    <button
                      type="button"
                      className="btn-action"
                      onClick={() => openSchemeNotify(r)}
                      title="Send notification to ward citizens"
                      style={{ padding: '0 10px', color: '#d97706', borderColor: '#fde68a' }}
                    >
                      <BellIcon size={13} />
                      <span>Notify</span>
                    </button>
                  )}

                  {canEdit && (
                    <button
                      type="button"
                      className="btn-action"
                      onClick={() => openEdit(r)}
                      title="Edit scheme details"
                      style={{ padding: '0 10px' }}
                    >
                      <EditIcon size={13} />
                      <span>Edit</span>
                    </button>
                  )}

                  {canEdit && (
                    <button
                      type="button"
                      className="btn-action"
                      style={{ padding: '0 8px', color: '#ef4444' }}
                      title="Delete scheme"
                      onClick={async () => {
                        if (confirm(`Delete scheme "${r.title}"?`)) {
                          try {
                            await api.deleteScheme(r.id);
                            await load();
                          } catch (e) {
                            setError(e.message);
                          }
                        }
                      }}
                    >
                      <TrashIcon size={13} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* View Details Modal */}
      {detail && (
        <Modal wide title={`${detail.title} · Scheme Details`} onClose={() => setDetail(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Banner */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '17px', color: '#0f172a' }}>{detail.title}</strong>
                  <span className={`team-badge ${detail.status === 'PUBLISHED' ? 'green' : detail.status === 'DRAFT' ? 'amber' : 'gray'}`}>
                    {detail.status}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: '12.5px' }}>
                  <span>Published in: {wardLabel(detail)}</span>
                  <span> · Published by: {creatorLabel(detail)}</span>
                </div>
              </div>

              {canNotify && detail.status === 'PUBLISHED' && detail.ward?.id && (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    openSchemeNotify(detail);
                    setDetail(null);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
                >
                  <BellIcon size={14} />
                  <span>Notify Ward Citizens</span>
                </button>
              )}
            </div>

            {/* Structured Specifications Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Card 1: Overview & Benefits */}
              <div className="prof-detail-card">
                <div className="prof-card-title">
                  <FileTextIcon size={16} />
                  <span>Overview & Benefits</span>
                </div>
                <div className="prof-spec-list">
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Description:</span>
                    <span className="prof-spec-value">{detail.description || '—'}</span>
                  </div>
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Benefits:</span>
                    <strong className="prof-spec-value">{detail.benefits || '—'}</strong>
                  </div>
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Valid Period:</span>
                    <span className="prof-spec-value">
                      {detail.startDate || 'Open'} → {detail.endDate || 'Ongoing'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Eligibility Criteria */}
              <div className="prof-detail-card">
                <div className="prof-card-title">
                  <UsersIcon size={16} />
                  <span>Eligibility & Criteria</span>
                </div>
                <div className="prof-spec-list">
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Target Audience:</span>
                    <strong className="prof-spec-value">{detail.audience || 'All eligible residents'}</strong>
                  </div>
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Gender:</span>
                    <span className="prof-spec-value">
                      {detail.gender === 'FEMALE' ? 'Female Only' : detail.gender === 'MALE' ? 'Male Only' : detail.gender === 'OTHER' ? 'Other' : 'Everyone (All)'}
                    </span>
                  </div>
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Age Requirement:</span>
                    <span className="prof-spec-value">
                      {detail.minAge != null || detail.maxAge != null ? `${detail.minAge ?? 0} to ${detail.maxAge ?? '+'} years` : 'Any age'}
                    </span>
                  </div>
                  {detail.eligibility ? (
                    <div className="prof-spec-row">
                      <span className="prof-spec-label">Notes & Docs:</span>
                      <span className="prof-spec-value">{detail.eligibility}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Card 3: Application & Helpline */}
              <div className="prof-detail-card">
                <div className="prof-card-title">
                  <BuildingIcon size={16} />
                  <span>How to Apply</span>
                </div>
                <div className="prof-spec-list">
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Application Link:</span>
                    <span className="prof-spec-value">
                      {detail.applicationUrl ? (
                        <a
                          href={detail.applicationUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span>Open Application Portal</span>
                          <ExternalLinkIcon size={12} />
                        </a>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Helpline / Contact:</span>
                    <span className="prof-spec-value">{detail.contactInfo || '—'}</span>
                  </div>
                  <div className="prof-spec-row">
                    <span className="prof-spec-label">Publishing Ward:</span>
                    <span className="prof-spec-value">{wardLabel(detail)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button type="button" className="ghost-btn" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Notify Ward Modal */}
      {schemeNotify && (
        <Modal wide title={`Send Notification · ${schemeNotify.title}`} onClose={() => setSchemeNotify(null)}>
          <form className="form-grid scheme-notify-form" onSubmit={sendSchemeNotify}>
            <div className="span-2" style={{ padding: '12px 16px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div className="section-label" style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                Broadcast Ward Audience
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0284c7' }}>
                {wardLabel(schemeNotify)}
              </div>
              <div className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                Active residents registered in this ward will receive this notification immediately in their mobile/portal feeds.
              </div>
            </div>

            <Field className="span-2" label="Notification Title">
              <input
                required
                value={schemeNotifyForm.title}
                onChange={e => setSchemeNotifyForm({ ...schemeNotifyForm, title: e.target.value })}
              />
            </Field>

            <Field className="span-2" label="Notification Message">
              <textarea
                required
                rows="5"
                value={schemeNotifyForm.message}
                onChange={e => setSchemeNotifyForm({ ...schemeNotifyForm, message: e.target.value })}
              />
            </Field>

            <div className="modal-actions span-2" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button type="button" className="ghost-btn" onClick={() => setSchemeNotify(null)}>
                Cancel
              </button>
              <button className="primary-btn" disabled={busy}>
                {busy ? 'Sending…' : 'Send Notification'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add / Edit Scheme Modal */}
      {edit && (
        <Modal wide title={edit === 'create' ? 'Add New Scheme' : 'Edit Scheme'} onClose={() => setEdit(null)}>
          <form className="form-grid scheme-form" onSubmit={save}>
            <Field className="span-2" label="Scheme Name *">
              <input
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Free Computer Training for Ward Youth"
              />
            </Field>

            <Field className="span-2" label="Description *">
              <textarea
                required
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What assistance or program does this scheme provide?"
              />
            </Field>

            <Field className="span-2" label="Benefits *">
              <textarea
                value={form.benefits}
                onChange={e => setForm({ ...form, benefits: e.target.value })}
                placeholder="Benefit amount, subsidy percentage, kits, free health checkups, etc."
              />
            </Field>

            <Field label="Minimum Age">
              <input
                type="number"
                min="0"
                value={form.minAge}
                onChange={e => setForm({ ...form, minAge: e.target.value })}
                placeholder="Any"
              />
            </Field>

            <Field label="Maximum Age">
              <input
                type="number"
                min="0"
                value={form.maxAge}
                onChange={e => setForm({ ...form, maxAge: e.target.value })}
                placeholder="Any"
              />
            </Field>

            <Field label="Gender Eligibility">
              <select
                value={form.gender}
                onChange={e => setForm({ ...form, gender: e.target.value })}
              >
                <option value="ALL">Everyone (All Genders)</option>
                <option value="FEMALE">Females / Women</option>
                <option value="MALE">Males / Men</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>

            <Field label="Target Audience">
              <input
                value={form.audience}
                onChange={e => setForm({ ...form, audience: e.target.value })}
                placeholder="e.g. Students, Senior Citizens, Farmers"
              />
            </Field>

            <SearchableSelect
              label="Publishing Ward *"
              required
              value={form.wardId}
              disabled={councillor}
              onChange={v => setForm({ ...form, wardId: v })}
              options={wards.map(w => ({ value: w.id, label: formatWardLabel(w) }))}
              placeholder="Select publishing ward…"
            />

            {councillor && (
              <div className="ward-fixed-note" style={{ gridColumn: '1 / -1', fontSize: '12px', color: '#64748b' }}>
                Ward automatically scoped to your assigned ward.
              </div>
            )}

            <Field label="Scheme Status">
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
              >
                <option value="PUBLISHED">Published (Active)</option>
                <option value="DRAFT">Draft</option>
                <option value="CLOSED">Closed (Archived)</option>
              </select>
            </Field>

            <Field label="Start Date">
              <input
                type="date"
                value={form.startDate || ''}
                onChange={e => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>

            <Field label="End Date">
              <input
                type="date"
                value={form.endDate || ''}
                min={form.startDate || undefined}
                onChange={e => setForm({ ...form, endDate: e.target.value })}
              />
            </Field>

            <Field className="span-2" label="Eligibility & Document Requirements">
              <textarea
                value={form.eligibility}
                onChange={e => setForm({ ...form, eligibility: e.target.value })}
                placeholder="Income limit, required documents (Aadhaar, Ration Card), residence proof, etc."
              />
            </Field>

            <Field label="Application Link (Portal URL)">
              <input
                type="url"
                value={form.applicationUrl}
                onChange={e => setForm({ ...form, applicationUrl: e.target.value })}
                placeholder="https://..."
              />
            </Field>

            <Field label="Helpline / Contact Number">
              <input
                value={form.contactInfo}
                onChange={e => setForm({ ...form, contactInfo: e.target.value })}
                placeholder="e.g. 0241-XXXXXXX or Mobile"
              />
            </Field>

            <div className="modal-actions span-2" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button type="button" className="ghost-btn" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button className="primary-btn" disabled={busy}>
                {busy ? 'Saving…' : edit === 'create' ? 'Publish Scheme' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
