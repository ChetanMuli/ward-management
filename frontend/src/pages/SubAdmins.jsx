import React, { useEffect, useMemo, useState } from 'react';
import { api, getUser } from '../services/api';
import { isMaster } from '../rbac';
import { Empty, ErrorBox, Field, Loading, Modal, PageHeader, StatusPill } from '../components/Ui';
import PasswordResetModal from '../components/PasswordResetModal';
import PermissionEditor from '../components/PermissionEditor';
import { formatWardLabel } from '../wardFormat';
import TeamNav from '../components/TeamNav';
import { ShieldIcon, ZapIcon, BuildingIcon, LockIcon, PhoneIcon, SearchIcon, EyeIcon, EditIcon } from '../components/Icons';

const blank = { name: '', email: '', mobile: '', password: '', status: 'ACTIVE', permissions: [], wardIds: [] };

function loginParts(value) {
  if (!value) return { date: 'Never', time: '' };
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return { date: 'Never', time: '' };
    return {
      date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      time: d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    };
  } catch {
    return { date: 'Never', time: '' };
  }
}

export default function SubAdmins() {
  const user = getUser();
  const master = isMaster(user);
  const [rows, setRows] = useState(null);
  const [wards, setWards] = useState([]);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.wards().then(r => setWards(r.data || [])).catch(e => setError(e.message));
  }, []);

  async function load() {
    try {
      setError('');
      setRows((await api.subAdmins()).data || []);
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const list = rows || [];
    return {
      total: list.length,
      active: list.filter(a => a.status === 'ACTIVE').length,
      wardsAssigned: new Set(list.flatMap(a => a.wardIds || [])).size,
      avgPerms: list.length ? Math.round(list.reduce((acc, a) => acc + (a.permissions || []).length, 0) / list.length) : 0
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const list = rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(a => {
      const hay = [a.name, a.email, a.mobile, a.status].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  if (!master) {
    return (
      <div className="admin-data-page subadmins-page">
        <PageHeader title="Sub-admins" />
        <div className="empty">You do not have access to this section.</div>
      </div>
    );
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const d = {
        name: form.name,
        email: form.email,
        mobile: form.mobile,
        password: form.password || undefined,
        status: form.status,
        permissions: form.permissions,
        wardIds: form.wardIds
      };
      if (edit === 'create') await api.createSubAdmin(d);
      else await api.updateSubAdmin(edit.id, d);
      setEdit(null);
      await load();
      window.dispatchEvent(new CustomEvent('ward:permissions-updated'));
      window.dispatchEvent(new CustomEvent('ward:toast', { detail: { type: 'success', message: 'Sub Master Admin saved successfully.' } }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-data-page subadmins-page">
      <PageHeader
        title="Sub-admins"
        action={
          <button className="primary-btn" onClick={() => { setForm({ ...blank }); setEdit('create'); }}>
            Add
          </button>
        }
      />

      <TeamNav current="subadmins" />

      <ErrorBox error={error} />

      <div className="team-kpi-grid">
        <div className="team-kpi-card">
          <div className="team-kpi-icon blue">
            <ShieldIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.total}</div>
            <div className="team-kpi-label">Total Sub-Admins</div>
          </div>
        </div>
        <div className="team-kpi-card">
          <div className="team-kpi-icon green">
            <ZapIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.active}</div>
            <div className="team-kpi-label">Active Accounts</div>
          </div>
        </div>
        <div className="team-kpi-card">
          <div className="team-kpi-icon purple">
            <BuildingIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.wardsAssigned}</div>
            <div className="team-kpi-label">Wards Assigned</div>
          </div>
        </div>
        <div className="team-kpi-card">
          <div className="team-kpi-icon amber">
            <LockIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{stats.avgPerms}</div>
            <div className="team-kpi-label">Avg Permissions</div>
          </div>
        </div>
      </div>

      <div className="exec-toolbar-panel">
        <div className="exec-toolbar-row">
          <div className="exec-toolbar-left">
            <div className="exec-search-box">
              <SearchIcon size={15} />
              <input
                placeholder="Search sub-admins by name, email or mobile…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className="search-clear-btn" onClick={() => setSearch('')} title="Clear search">
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {rows === null ? (
        <Loading />
      ) : !filtered.length ? (
        <Empty>{search ? 'No Sub Master Admins match your search.' : 'No Sub Master Admin accounts yet.'}</Empty>
      ) : (
        <div className="panel table-wrap subadmins-table-wrap">
          <table className="subadmins-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Contact & Login</th>
                <th>Access</th>
                <th>Wards</th>
                <th>Permissions</th>
                <th>Last Login</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const login = loginParts(a.lastLoginAt);
                const wardCount = (a.wardIds || []).length;
                const permCount = (a.permissions || []).length;
                return (
                <tr key={a.id}>
                  <td data-label="Admin">
                    <div className="exec-cell-user">
                      <div className="exec-avatar purple">
                        {(a.name || 'SA').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="exec-cell-meta">
                        <span className="exec-cell-name">{a.name || '—'}</span>
                        <span className="exec-cell-sub">Sub Master Admin</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="Contact & Login">
                    <div className="house-addr-cell">
                      <div className="house-addr-line">{a.email || '—'}</div>
                      {a.mobile ? (
                        <a href={`tel:${a.mobile}`} className="team-contact-link notranslate" translate="no">
                          <PhoneIcon size={12} />
                          <span>{a.mobile}</span>
                        </a>
                      ) : (
                        <div className="house-addr-meta">No mobile</div>
                      )}
                    </div>
                  </td>
                  <td data-label="Access">
                    <StatusPill>{a.status}</StatusPill>
                  </td>
                  <td data-label="Wards">
                    {wardCount ? (
                      <span className="team-badge blue">{wardCount} assigned</span>
                    ) : (
                      <span className="team-badge gray">None assigned</span>
                    )}
                  </td>
                  <td data-label="Permissions">
                    <span className="team-badge green">{permCount} granted</span>
                  </td>
                  <td data-label="Last Login">
                    <div className="subadmin-login-cell">
                      <strong>{login.date}</strong>
                      {login.time ? <span>{login.time}</span> : null}
                    </div>
                  </td>
                  <td data-label="Actions" style={{ textAlign: 'center' }}>
                    <div className="exec-action-group">
                      <button
                        type="button"
                        className="exec-btn-view"
                        onClick={() => setDetail(a)}
                        title="View admin profile & permissions"
                      >
                        <EyeIcon size={13} />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        className="btn-action"
                        onClick={() => { setForm({ ...blank, ...a, password: '' }); setEdit(a); }}
                        title="Edit admin and ward access"
                      >
                        <EditIcon size={12} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="btn-action"
                        onClick={() => setResetUser(a)}
                        title="Reset password"
                      >
                        Password
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <Modal
          wide
          title={edit === 'create' ? 'Create Sub Master Admin' : 'Edit Sub Master Admin'}
          onClose={() => setEdit(null)}
          footer={
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button form="sub-admin-form-v13" className="primary-btn" disabled={busy}>
                {busy ? 'Saving…' : 'Save Sub Master Admin'}
              </button>
            </div>
          }
        >
          <form id="sub-admin-form-v13" className="form-grid" onSubmit={save}>
            <Field label="Full name">
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email / Login ID">
              <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Mobile">
              <input
                required
                maxLength="10"
                value={form.mobile}
                onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              />
            </Field>
            <Field label={edit === 'create' ? 'Password' : 'New password'}>
              <input
                type="password"
                minLength="8"
                required={edit === 'create'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Field label="Account access">
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </Field>
            <div className="span-2 ward-access-editor">
              <div className="permission-section-head">
                <strong>Ward access</strong>
                <button
                  type="button"
                  className="small-btn"
                  onClick={() =>
                    setForm({
                      ...form,
                      wardIds: form.wardIds?.length === wards.length ? [] : wards.map(w => w.id)
                    })
                  }
                >
                  {form.wardIds?.length === wards.length ? 'Clear' : 'Select all wards'}
                </button>
              </div>
              <div className="ward-access-grid">
                {wards.map(w => (
                  <label key={w.id} className="ward-access-option">
                    <input
                      type="checkbox"
                      checked={(form.wardIds || []).includes(w.id)}
                      onChange={e =>
                        setForm({
                          ...form,
                          wardIds: e.target.checked
                            ? [...(form.wardIds || []), w.id]
                            : (form.wardIds || []).filter(id => id !== w.id)
                        })
                      }
                    />
                    <span>{formatWardLabel(w)}</span>
                  </label>
                ))}
              </div>
              <small className="muted">
                This Sub Master Admin will see only the selected wards. No ward selected means no ward data access.
              </small>
            </div>
          </form>
          <PermissionEditor
            role="SUB_MASTER_ADMIN"
            values={form.permissions || []}
            onChange={v => setForm({ ...form, permissions: v })}
            isMasterAdmin={true}
          />
        </Modal>
      )}

      {resetUser && <PasswordResetModal user={resetUser} onClose={() => setResetUser(null)} onSaved={load} />}

      {detail && (
        <Modal 
          wide 
          title="Sub Master Admin Details" 
          onClose={() => setDetail(null)}
          footer={
            <div className="modal-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="small-btn"
                  onClick={() => {
                    const target = detail;
                    setDetail(null);
                    setForm({ ...blank, ...target, password: '' });
                    setEdit(target);
                  }}
                >
                  Edit Admin & Access
                </button>
                <button
                  type="button"
                  className="small-btn"
                  onClick={() => {
                    const target = detail;
                    setDetail(null);
                    setResetUser(target);
                  }}
                >
                  Reset Password
                </button>
              </div>
              <button type="button" className="primary-btn" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
          }
        >
          {/* Executive Header Banner */}
          <div className="prof-detail-header">
            <div className="team-avatar-initials subadmin" style={{ width: '56px', height: '56px', fontSize: '20px', flexShrink: 0 }}>
              {(detail.name || 'SA').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{detail.name}</h3>
                <span className="team-badge purple">Sub Master Admin</span>
                <StatusPill>{detail.status}</StatusPill>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' }}>
                <span>Email: <strong style={{ color: '#1e293b' }}>{detail.email || '—'}</strong></span>
                {detail.mobile && (
                  <span>Mobile: <strong style={{ color: '#1e293b' }}>{detail.mobile}</strong></span>
                )}
                <span>Last login: <strong style={{ color: '#1e293b' }}>{detail.lastLoginAt ? new Date(detail.lastLoginAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}</strong></span>
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="prof-detail-grid">
            {/* Account & Security Card */}
            <div className="prof-detail-card">
              <div className="prof-card-title">
                <ShieldIcon size={16} />
                <span>Account & Access Details</span>
              </div>
              <div className="prof-spec-list">
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Full Name</span>
                  <span className="prof-spec-v">{detail.name}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Official Email</span>
                  <span className="prof-spec-v">
                    <a href={`mailto:${detail.email}`} style={{ color: '#1e40af', textDecoration: 'none', fontWeight: 600 }}>
                      {detail.email || '—'}
                    </a>
                  </span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Mobile Number</span>
                  <span className="prof-spec-v">
                    {detail.mobile ? (
                      <a href={`tel:${detail.mobile}`} style={{ color: '#1e40af', textDecoration: 'none', fontWeight: 600 }}>
                        {detail.mobile}
                      </a>
                    ) : '—'}
                  </span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Role Authority</span>
                  <span className="prof-spec-v">Sub Master Admin (Delegated Ward Admin)</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Account Status</span>
                  <span className="prof-spec-v">
                    <StatusPill>{detail.status}</StatusPill>
                  </span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">Last Session</span>
                  <span className="prof-spec-v">
                    {detail.lastLoginAt ? new Date(detail.lastLoginAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never logged in yet'}
                  </span>
                </div>
              </div>
            </div>

            {/* Ward Scope Card */}
            <div className="prof-detail-card">
              <div className="prof-card-title" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BuildingIcon size={16} />
                  <span>Assigned Ward Scope</span>
                </div>
                <span className="team-badge blue">
                  {(detail.wardIds || []).length} Assigned
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px 0' }}>
                This Sub Master Admin is granted operational access only to the following wards:
              </p>
              {(detail.wardIds || []).length > 0 ? (
                <div className="prof-ward-pills-wrap">
                  {wards
                    .filter(w => (detail.wardIds || []).includes(w.id))
                    .map(w => (
                      <span key={w.id} className="prof-ward-pill">
                        <strong>{formatWardLabel(w)}</strong>
                      </span>
                    ))}
                </div>
              ) : (
                <div className="empty" style={{ padding: '20px', fontSize: '13px' }}>
                  No wards assigned yet. This account has no active ward scope.
                </div>
              )}
            </div>
          </div>

          {/* Granted Permissions Section */}
          <div className="prof-detail-card">
            <div className="prof-card-title" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LockIcon size={16} />
                <span>Granted System Permissions & Capabilities</span>
              </div>
              <span className="team-badge green">
                {(detail.permissions || []).length} Capabilities Granted
              </span>
            </div>
            {(detail.permissions || []).length > 0 ? (
              <div className="prof-perms-wrap">
                {(detail.permissions || []).map(p => (
                  <span key={p} className="prof-perm-tag">
                    <span className="prof-perm-dot" />
                    <span>{p.replace(/:/g, ' → ').replace(/_/g, ' ')}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="empty" style={{ padding: '20px', fontSize: '13px' }}>
                No specific permissions granted yet.
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
