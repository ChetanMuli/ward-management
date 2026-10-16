import React, { useEffect, useState, useMemo } from 'react';
import { api, getUser } from '../services/api';
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageHeader,
  PaginationBar,
  RowMenu,
  SearchableSelect,
  StatusPill
} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { isMaster, isSubMaster } from '../rbac';
import { useWardFilter } from '../wardFilter';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import {
  SearchIcon,
  UsersIcon,
  UserCheckIcon,
  ShieldIcon,
  ClockIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
  RefreshCwIcon,
  PhoneIcon,
  AlertCircleIcon,
  CalendarIcon,
  CheckIcon
} from '../components/Icons';
import { getLanguage } from '../language';

function formatDate(value) {
  if (!value) return 'Never';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
}

function formatDateOnly(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
}

function accountUsage(lastLogin) {
  if (!lastLogin) return 'Never logged in';
  const days = Math.floor((Date.now() - new Date(lastLogin).getTime()) / 86400000);
  if (days === 0) return 'Logged in today';
  if (days === 1) return 'Logged in yesterday';
  if (days < 7) return `Logged in ${days} days ago`;
  return 'Previously active';
}

function getUserInitials(name) {
  if (!name) return 'U';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Users() {
  const current = getUser();
  const { selectedWardId } = useWardFilter();
  const isMr = getLanguage() === 'mr';

  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25, pages: 1 });
  const [wards, setWards] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [kpiStats, setKpiStats] = useState({ total: 0, active: 0, inactive: 0, suspended: 0 });
  const [edit, setEdit] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const master = isMaster(current);
  const sub = isSubMaster(current);

  async function loadKpiStats() {
    try {
      const res = await api.users({
        limit: 100,
        wardId: selectedWardId || undefined
      });
      const items = res.data || [];
      let active = 0;
      let inactive = 0;
      let suspended = 0;
      items.forEach(u => {
        const s = String(u.status || '').toUpperCase();
        if (s === 'ACTIVE') active++;
        else if (s === 'INACTIVE') inactive++;
        else if (s === 'SUSPENDED') suspended++;
      });
      setKpiStats({
        total: res.meta?.total || items.length,
        active,
        inactive,
        suspended
      });
    } catch (_) {}
  }

  async function load() {
    try {
      setError('');
      const r = await api.users({
        page,
        limit,
        search: search.trim(),
        status: status || undefined,
        wardId: selectedWardId || undefined
      });
      setRows(r.data || []);
      setMeta(r.meta || { total: (r.data || []).length, page, limit, pages: 1 });
    } catch (e) {
      setRows([]);
      setError(e.message);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [selectedWardId, search, status]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [page, limit, selectedWardId, search, status]);

  useEffect(() => {
    loadKpiStats();
  }, [selectedWardId]);

  useEffect(() => {
    api.wards()
      .then(r => setWards(r.data || []))
      .catch(() => {});
  }, []);



  function openEdit(u) {
    setEdit({
      id: u.id,
      name: u.name || '',
      email: u.email || '',
      mobile: u.mobile || '',
      wardId: u.wardId || u.ward?.id || '',
      status: u.status || 'ACTIVE',
      password: '',
      confirmPassword: ''
    });
  }

  async function save(e) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    setError('');
    try {
      if (edit.password && edit.password !== edit.confirmPassword) {
        throw new Error('New password and confirm password do not match.');
      }
      const payload = {
        name: edit.name.trim(),
        email: edit.email.trim(),
        mobile: edit.mobile.replace(/\D/g, ''),
        wardId: edit.wardId,
        status: edit.status
      };
      if (edit.password) payload.password = edit.password;
      await api.updateUser(edit.id, payload);
      setEdit(null);
      await Promise.all([load(), loadKpiStats()]);
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'success',
            message: `User account "${payload.name}" updated successfully.`
          }
        })
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(u) {
    if (!confirm(`Delete registered user account for "${u.name}"? The account will be marked deleted and moved to Recycle Bin.`)) {
      return;
    }
    try {
      await api.deleteUser(u.id);
      await Promise.all([load(), loadKpiStats()]);
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'info',
            message: `User account "${u.name}" deleted.`
          }
        })
      );
    } catch (e) {
      setError(e.message);
    }
  }

  async function setStatusAction(u, next) {
    try {
      await api.updateUser(u.id, { status: next });
      await Promise.all([load(), loadKpiStats()]);
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'success',
            message: `User account "${u.name}" marked as ${next.toLowerCase()}.`
          }
        })
      );
    } catch (e) {
      setError(e.message);
    }
  }

  const total = meta.total || 0;
  const pages = Math.max(1, meta.pages || Math.ceil(total / limit) || 1);
  const hasActiveFilters = Boolean(search || status);

  return (
    <div className="admin-data-page users-page" style={{ paddingTop: '8px' }}>
      <PageHeader
        kicker={isMr ? 'नागरिक आणि रहिवासी खाती' : 'Citizens & Resident Accounts'}
        title={isMr ? 'नोंदणीकृत वॉर्ड वापरकर्ते' : 'Registered Ward Users'}
        subtitle={
          isMr
            ? 'रहिवासी पोर्टल खाती, लॉगिन क्रेडेंशियल, वॉर्ड वाटप आणि वापरकर्ता परवानग्या व्यवस्थापित करा.'
            : 'Manage resident portal accounts, login credentials, ward allocations, and resident permissions.'
        }
        action={
          <button
            type="button"
            className="exec-page-refresh-btn"
            onClick={() => {
              load();
              loadKpiStats();
            }}
            title="Refresh user accounts list"
          >
            <RefreshCwIcon size={14} />
            <span>{isMr ? 'ताजे करा' : 'Refresh'}</span>
          </button>
        }
      />

      <ErrorBox error={error} />

      {/* 4 Interactive Executive KPI Cards */}
      <div className="team-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <div
          className={`team-kpi-card ${!status ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setStatus('')}
          title="Click to view all registered users"
        >
          <div className="team-kpi-icon blue">
            <UsersIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{total}</div>
            <div className="team-kpi-label">{isMr ? 'एकूण वापरकर्ते' : 'Total Registered'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${status === 'ACTIVE' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setStatus(prev => (prev === 'ACTIVE' ? '' : 'ACTIVE'))}
          title="Click to filter active accounts"
        >
          <div className="team-kpi-icon green">
            <UserCheckIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiStats.active}</div>
            <div className="team-kpi-label">{isMr ? 'सक्रिय वापरकर्ते' : 'Active Residents'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${status === 'INACTIVE' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setStatus(prev => (prev === 'INACTIVE' ? '' : 'INACTIVE'))}
          title="Click to filter inactive accounts"
        >
          <div className="team-kpi-icon amber">
            <ClockIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiStats.inactive}</div>
            <div className="team-kpi-label">{isMr ? 'अक्रिय / प्रलंबित' : 'Inactive / Pending'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${status === 'SUSPENDED' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setStatus(prev => (prev === 'SUSPENDED' ? '' : 'SUSPENDED'))}
          title="Click to filter suspended accounts"
        >
          <div className="team-kpi-icon red">
            <ShieldIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiStats.suspended}</div>
            <div className="team-kpi-label">{isMr ? 'निलंबित खाती' : 'Suspended Accounts'}</div>
          </div>
        </div>
      </div>

      {/* Professional Search & Filter Toolbar */}
      <div className="exec-toolbar-panel">
        <div className="exec-toolbar-row">
          <div className="exec-toolbar-left">
            <div className="exec-search-box">
              <SearchIcon size={16} />
              <input
                placeholder={isMr ? 'नाव, मोबाईल किंवा ईमेल शोधा…' : 'Search name, mobile or email…'}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearch('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="exec-quick-ward">
              <WardFilter compact label="" />
            </div>

            <div className="exec-quick-status">
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="exec-filter-select"
              >
                <option value="">{isMr ? 'सर्व स्थिती (All Status)' : 'All Statuses'}</option>
                <option value="ACTIVE">{isMr ? 'सक्रिय (Active)' : 'Active'}</option>
                <option value="INACTIVE">{isMr ? 'अक्रिय (Inactive)' : 'Inactive'}</option>
                <option value="SUSPENDED">{isMr ? 'निलंबित (Suspended)' : 'Suspended'}</option>
              </select>
            </div>
          </div>

          <div className="exec-toolbar-right">
            {hasActiveFilters && (
              <button
                type="button"
                className="exec-btn-clear"
                onClick={() => {
                  setSearch('');
                  setStatus('');
                  setPage(1);
                }}
              >
                ✕ {isMr ? 'फिल्टर साफ करा' : 'Clear Filters'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      {!rows ? (
        <Loading />
      ) : !rows.length ? (
        <Empty>{isMr ? 'कोणतेही नोंदणीकृत वॉर्ड वापरकर्ते सापडले नाहीत.' : 'No registered application users found.'}</Empty>
      ) : (
        <div className="panel table-wrap users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>{isMr ? 'वापरकर्ता' : 'Citizen User'}</th>
                <th>{isMr ? 'वॉर्ड' : 'Assigned Ward'}</th>
                <th>{isMr ? 'स्थिती' : 'Account Status'}</th>
                <th>{isMr ? 'शेवटचे लॉगिन' : 'Last Login Activity'}</th>
                <th>{isMr ? 'नोंदणी तारीख' : 'Registered Date'}</th>
                <th style={{ textAlign: 'center' }}>{isMr ? 'कृती' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(u => {
                const initials = getUserInitials(u.name);
                const s = String(u.status || 'ACTIVE').toUpperCase();
                return (
                  <tr key={u.id}>
                    <td data-label="Citizen User">
                      <div className="exec-cell-user">
                        <div
                          className={`exec-avatar ${s === 'ACTIVE' ? '' : s === 'SUSPENDED' ? 'amber' : 'blue'}`}
                          onClick={() => setDetail(u)}
                          style={{ cursor: 'pointer' }}
                          title={isMr ? 'तपशील पाहण्यासाठी क्लिक करा' : 'Click to view user details'}
                        >
                          {initials}
                        </div>
                        <div className="exec-cell-meta">
                          <button
                            type="button"
                            onClick={() => setDetail(u)}
                            className="exec-cell-name"
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              margin: 0,
                              font: 'inherit',
                              fontWeight: 600,
                              color: '#0f172a',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'inline-block'
                            }}
                            title={isMr ? 'तपशील पाहण्यासाठी क्लिक करा' : 'Click to view user details'}
                          >
                            {u.name || '—'}
                          </button>
                          <span className="exec-cell-sub">
                            {u.mobile ? (
                              <a href={`tel:${u.mobile}`} title="Click to call">
                                <PhoneIcon size={12} style={{ display: 'inline', marginRight: '3px', verticalAlign: '-1px' }} />
                                {u.mobile}
                              </a>
                            ) : (
                              <span className="muted">No mobile</span>
                            )}
                            {u.email && (
                              <>
                                <span>·</span>
                                <span
                                  className="user-email-val"
                                  style={{ textTransform: 'lowercase', fontVariant: 'normal' }}
                                  title={u.email}
                                >
                                  {String(u.email).toLowerCase()}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td data-label="Assigned Ward">
                      {u.ward ? (
                        <div>
                          <span className="ward-pill-badge">
                            {formatWardNumber(u.ward.wardNumber)}
                          </span>
                          <div className="muted" style={{ fontSize: '11.5px', marginTop: '2px' }}>
                            {u.ward.name || 'Municipal Ward'}
                          </div>
                        </div>
                      ) : (
                        <span className="muted">Ward not linked</span>
                      )}
                    </td>

                    <td data-label="Account Status">
                      <StatusPill>{u.status || 'ACTIVE'}</StatusPill>
                    </td>

                    <td data-label="Last Login Activity">
                      {u.lastLoginAt ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#1e293b' }}>
                            {formatDate(u.lastLoginAt)}
                          </div>
                          <div className="muted" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <ClockIcon size={11} />
                            {accountUsage(u.lastLoginAt)}
                          </div>
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: '12px' }}>Never logged in</span>
                      )}
                    </td>

                    <td data-label="Registered Date">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px' }}>
                        <CalendarIcon size={13} style={{ color: '#94a3b8' }} />
                        <span>{formatDateOnly(u.createdAt)}</span>
                      </div>
                    </td>

                    <td data-label="Actions" style={{ textAlign: 'center' }}>
                      <div className="exec-action-group">
                        <button
                          type="button"
                          className="exec-btn-view"
                          onClick={() => setDetail(u)}
                          title="View complete user profile"
                        >
                          <EyeIcon size={13} />
                          <span>{isMr ? 'पहा' : 'View'}</span>
                        </button>
                        <button
                          type="button"
                          className="exec-btn-edit"
                          onClick={() => openEdit(u)}
                          title="Edit user credentials and ward"
                        >
                          <EditIcon size={13} />
                          <span>{isMr ? 'संपादित करा' : 'Edit'}</span>
                        </button>
                        <RowMenu
                          menuOnly
                          items={[
                            u.status === 'ACTIVE'
                              ? {
                                  label: isMr ? 'खाते निलंबित करा' : 'Suspend account',
                                  onClick: () => setStatusAction(u, 'SUSPENDED')
                                }
                              : {
                                  label: isMr ? 'खाते सक्रिय करा' : 'Activate account',
                                  onClick: () => setStatusAction(u, 'ACTIVE')
                                },
                            u.status !== 'DELETED' && {
                              label: isMr ? 'खाते हटवा' : 'Delete account',
                              danger: true,
                              onClick: () => remove(u)
                            }
                          ].filter(Boolean)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows && (
        <PaginationBar
          page={page}
          pages={pages}
          total={total}
          limit={limit}
          onPage={setPage}
          onLimit={setLimit}
        />
      )}

      {/* Executive User Details Modal */}
      {detail && (
        <Modal
          wide
          title={`${detail.name || 'Citizen'} · ${isMr ? 'वापरकर्ता प्रोफाइल' : 'User Account Profile'}`}
          onClose={() => setDetail(null)}
        >
          <div className="exec-modal-profile-header">
            <div className="exec-modal-avatar">
              {getUserInitials(detail.name)}
            </div>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  {detail.name || '—'}
                </h2>
                <StatusPill>{detail.status || 'ACTIVE'}</StatusPill>
                <span className="ward-pill-badge" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}>
                  Resident Portal Account
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
                <span>Account ID: <code style={{ fontSize: '11px', background: '#e2e8f0', padding: '1px 5px', borderRadius: '4px' }}>{detail.id}</code></span>
              </div>
            </div>
          </div>

          <div className="exec-detail-grid">
            <div className="exec-detail-card">
              <h3>
                <PhoneIcon size={14} style={{ color: '#0f766e' }} />
                <span>Contact & Login Credentials</span>
              </h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Full Name</span>
                <span className="exec-detail-val">{detail.name || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Mobile Number</span>
                <span className="exec-detail-val">
                  {detail.mobile ? (
                    <a href={`tel:${detail.mobile}`} style={{ color: '#0f766e', textDecoration: 'none' }}>
                      {detail.mobile}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Email / Login ID</span>
                <span className="exec-detail-val" style={{ textTransform: 'lowercase' }}>
                  {detail.email || '—'}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Account Security</span>
                <span className="exec-detail-val" style={{ color: '#059669' }}>
                  ✓ Password Protected
                </span>
              </div>
            </div>

            <div className="exec-detail-card">
              <h3>
                <ShieldIcon size={14} style={{ color: '#0f766e' }} />
                <span>Ward & Jurisdiction</span>
              </h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Assigned Ward</span>
                <span className="exec-detail-val">
                  <span className="ward-pill-badge">{formatWardLabel(detail.ward)}</span>
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Ward Number</span>
                <span className="exec-detail-val">{formatWardNumber(detail.ward?.wardNumber) || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Municipality</span>
                <span className="exec-detail-val">Ahilyanagar Municipal Corporation</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Account Role</span>
                <span className="exec-detail-val">Verified Resident Citizen</span>
              </div>
            </div>

            <div className="exec-detail-card">
              <h3>
                <ClockIcon size={14} style={{ color: '#0f766e' }} />
                <span>Activity & Portal Access</span>
              </h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Account Created</span>
                <span className="exec-detail-val">{formatDate(detail.createdAt)}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Last Login</span>
                <span className="exec-detail-val">{formatDate(detail.lastLoginAt)}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Session Status</span>
                <span className="exec-detail-val">{accountUsage(detail.lastLoginAt)}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Account State</span>
                <span className="exec-detail-val"><StatusPill>{detail.status}</StatusPill></span>
              </div>
            </div>
          </div>

          <div className="exec-modal-footer">
            <button type="button" className="exec-modal-btn ghost" onClick={() => setDetail(null)}>
              {isMr ? 'बंद करा' : 'Close'}
            </button>
            {detail.status === 'ACTIVE' ? (
              <button
                type="button"
                className="exec-modal-btn danger"
                onClick={() => {
                  setStatusAction(detail, 'SUSPENDED');
                  setDetail(null);
                }}
              >
                <ShieldIcon size={14} />
                <span>{isMr ? 'खाते निलंबित करा' : 'Suspend Account'}</span>
              </button>
            ) : (
              <button
                type="button"
                className="exec-modal-btn success"
                onClick={() => {
                  setStatusAction(detail, 'ACTIVE');
                  setDetail(null);
                }}
              >
                <CheckIcon size={14} />
                <span>{isMr ? 'खाते सक्रिय करा' : 'Activate Account'}</span>
              </button>
            )}
            <button
              type="button"
              className="exec-modal-btn primary"
              onClick={() => {
                const u = detail;
                setDetail(null);
                openEdit(u);
              }}
            >
              <EditIcon size={14} />
              <span>{isMr ? 'संपूर्ण खाते संपादित करा' : 'Edit Full Account'}</span>
            </button>
          </div>
        </Modal>
      )}

      {/* Edit User Modal */}
      {edit && (
        <Modal wide title={`Edit ${edit.name || 'Registered User'}`} onClose={() => setEdit(null)}>
          <form className="form-grid" onSubmit={save}>
            <Field label="Full Name">
              <input
                required
                value={edit.name}
                onChange={e => setEdit({ ...edit, name: e.target.value })}
                placeholder="Citizen full name"
              />
            </Field>

            <Field label="Email / Login ID">
              <input
                type="email"
                required
                value={edit.email}
                onChange={e => setEdit({ ...edit, email: e.target.value })}
                placeholder="citizen@example.com"
              />
            </Field>

            <Field label="Mobile (10 digits)">
              <input
                required
                maxLength="10"
                value={edit.mobile}
                onChange={e =>
                  setEdit({ ...edit, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })
                }
                placeholder="9876543210"
              />
            </Field>

            <SearchableSelect
              label="Registered Ward"
              required
              value={edit.wardId}
              onChange={v => setEdit({ ...edit, wardId: v })}
              options={wards.map(w => ({ value: w.id, label: formatWardLabel(w) }))}
              placeholder="Select ward…"
            />

            <Field label="Account Status">
              <select
                value={edit.status}
                onChange={e => setEdit({ ...edit, status: e.target.value })}
              >
                <option value="ACTIVE">Active (Can log in)</option>
                <option value="INACTIVE">Inactive (Pending verification)</option>
                <option value="SUSPENDED">Suspended (Access blocked)</option>
              </select>
            </Field>

            <div className="span-2 password-change-box" style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                Reset Password (Optional)
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                Leave both password fields blank to keep the current resident password unchanged.
              </div>
              <div className="form-grid password-change-grid" style={{ marginTop: '8px' }}>
                <Field label="New Password">
                  <input
                    type="password"
                    minLength="8"
                    value={edit.password}
                    onChange={e => setEdit({ ...edit, password: e.target.value })}
                    placeholder="Minimum 8 characters"
                  />
                </Field>
                <Field label="Confirm Password">
                  <input
                    type="password"
                    minLength="8"
                    value={edit.confirmPassword}
                    onChange={e => setEdit({ ...edit, confirmPassword: e.target.value })}
                    placeholder="Re-type new password"
                  />
                </Field>
              </div>
            </div>

            <div className="exec-modal-footer span-2">
              <button type="button" className="exec-modal-btn ghost" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button type="submit" className="exec-modal-btn primary" disabled={busy}>
                {busy ? 'Saving changes…' : 'Save Full Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
