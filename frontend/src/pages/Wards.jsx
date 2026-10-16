import React, { useEffect, useMemo, useState } from 'react';
import { api, getUser } from '../services/api';
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageHeader,
  RowMenu,
  StatusPill
} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { useWardFilter } from '../wardFilter';
import { isMaster, isNagarsevak, isEmployee } from '../rbac';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import { getLanguage } from '../language';
import {
  BuildingIcon,
  UsersIcon,
  ClockIcon,
  SearchIcon,
  EyeIcon,
  EditIcon,
  FileTextIcon,
  MapPinIcon
} from '../components/Icons';

const blank = { wardNumber: '', name: '', description: '', status: 'INACTIVE' };
const emptyArea = { name: '', description: '' };

function activeNagarsevaks(w) {
  const users = w?.users || [];
  const byId = new Map(users.map(u => [String(u.id), u]));
  const activeSubs = (w?.nagarsevakSubscriptions || []).filter(s => String(s.status || '').toUpperCase() === 'ACTIVE');
  if (activeSubs.length) {
    return activeSubs
      .map(s => byId.get(String(s.nagarsevakUserId)) || s.nagarsevak || { id: s.nagarsevakUserId, name: 'Nagarsevak' })
      .filter(u => String(u.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
  }
  return users.filter(
    u =>
      String(u.Role?.name || u.role?.name || '').toUpperCase() === 'NAGARSEVAK' &&
      String(u.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
  );
}

function isActiveWard(w) {
  return String(w?.status || '').toUpperCase() === 'ACTIVE';
}

export default function Wards() {
  const user = getUser();
  const isMr = getLanguage() === 'mr';
  const master = isMaster(user);
  const wardEditor = master || isNagarsevak(user) || isEmployee(user);
  const { selectedWardId } = useWardFilter();

  const [wards, setWards] = useState(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null);
  const [create, setCreate] = useState(null);
  const [detail, setDetail] = useState(null);
  const [areaEdit, setAreaEdit] = useState(null);
  const [areaCreate, setAreaCreate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openChips, setOpenChips] = useState({});

  async function load() {
    try {
      setError('');
      setWards((await api.wards()).data || []);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const base = selectedWardId
      ? (wards || []).filter(w => String(w.id) === String(selectedWardId))
      : wards || [];
    const q = search.trim().toLowerCase();
    return base.filter(w => {
      if (statusFilter === 'ACTIVE' && !isActiveWard(w)) return false;
      if (statusFilter === 'INACTIVE' && isActiveWard(w)) return false;
      if (!q) return true;
      return `${formatWardNumber(w.wardNumber) || ''} ${w.wardNumber || ''} ${w.name || ''} ${w.description || ''} ${(w.areas || [])
        .map(a => `${a.name || ''} ${a.description || ''}`)
        .join(' ')}`.toLowerCase().includes(q);
    });
  }, [wards, selectedWardId, search, statusFilter]);

  const kpiStats = useMemo(() => {
    const list = wards || [];
    return {
      total: list.length,
      active: list.filter(isActiveWard).length,
      inactive: list.filter(w => !isActiveWard(w)).length,
      colonies: list.reduce((n, w) => n + (w.areas || []).length, 0)
    };
  }, [wards]);

  async function saveWard(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const src = edit || create;
      const body = { wardNumber: src.wardNumber, name: src.name || null, description: src.description || null };
      let ward;
      if (edit) ward = (await api.updateWard(edit.id, body)).data;
      else {
        ward = (await api.createWard(body)).data;
        for (const a of (create.areas || []).filter(x => x.name.trim())) {
          await api.createArea(ward.id, { name: a.name, description: a.description || null });
        }
      }
      setEdit(null);
      setCreate(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveArea(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const src = areaEdit || areaCreate;
      const payload = { name: src.name, description: src.description || null };
      if (areaEdit) await api.updateArea(areaEdit.id, payload);
      else await api.createArea(areaCreate.wardId, payload);
      const wardId = areaEdit?.wardId || areaCreate?.wardId || detail?.id;
      setAreaEdit(null);
      setAreaCreate(null);
      await load();
      if (wardId && detail) {
        const fresh = ((await api.wards()).data || []).find(w => String(w.id) === String(wardId));
        if (fresh) setDetail(fresh);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-data-page wards-page" style={{ paddingTop: '8px' }}>
      <PageHeader
        kicker={isMr ? 'वॉर्ड रचना' : 'Ward setup'}
        title={isMr ? 'वॉर्ड व परिसर' : 'Wards & Areas'}
        subtitle={
          isMr
            ? 'वॉर्ड, कॉलनी / परिसर आणि सक्रिय नगरसेवक एका ठिकाणी व्यवस्थापित करा.'
            : 'Manage municipal wards, colonies and active Nagarsevaks from one register.'
        }
        action={
          master ? (
            <button
              className="primary-btn"
              onClick={() => setCreate({ ...blank, areas: [{ ...emptyArea }] })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span>+</span>
              <span>{isMr ? 'वॉर्ड तयार करा' : 'Create ward'}</span>
            </button>
          ) : null
        }
      />
      <ErrorBox error={error} />

      <div className="team-kpi-grid">
        <div
          className={`team-kpi-card ${!statusFilter ? 'active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setStatusFilter('')}
        >
          <div className="team-kpi-icon blue">
            <BuildingIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{wards == null ? '…' : kpiStats.total}</div>
            <div className="team-kpi-label">{isMr ? 'एकूण वॉर्ड' : 'All Wards'}</div>
          </div>
        </div>
        <div
          className={`team-kpi-card ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setStatusFilter(s => (s === 'ACTIVE' ? '' : 'ACTIVE'))}
        >
          <div className="team-kpi-icon green">
            <UsersIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{wards == null ? '…' : kpiStats.active}</div>
            <div className="team-kpi-label">{isMr ? 'सक्रिय वॉर्ड' : 'Active Wards'}</div>
          </div>
        </div>
        <div
          className={`team-kpi-card ${statusFilter === 'INACTIVE' ? 'active' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setStatusFilter(s => (s === 'INACTIVE' ? '' : 'INACTIVE'))}
        >
          <div className="team-kpi-icon amber">
            <ClockIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{wards == null ? '…' : kpiStats.inactive}</div>
            <div className="team-kpi-label">{isMr ? 'निष्क्रिय वॉर्ड' : 'Inactive Wards'}</div>
          </div>
        </div>
        <div className="team-kpi-card">
          <div className="team-kpi-icon purple">
            <MapPinIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{wards == null ? '…' : kpiStats.colonies}</div>
            <div className="team-kpi-label">{isMr ? 'कॉलनी / परिसर' : 'Colonies / Areas'}</div>
          </div>
        </div>
      </div>

      <div className="exec-toolbar-panel">
        <div className="exec-toolbar-row">
          <div className="exec-toolbar-left">
            <div className="exec-search-box">
              <SearchIcon size={15} />
              <input
                placeholder={isMr ? 'वॉर्ड किंवा कॉलनी शोधा…' : 'Search ward or colony…'}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className="search-clear-btn" onClick={() => setSearch('')} title="Clear search">
                  ✕
                </button>
              )}
            </div>
            <div className="exec-quick-ward">
              <WardFilter compact label="" />
            </div>
            <div className="exec-quick-status">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="exec-filter-select">
                <option value="">{isMr ? 'सर्व स्थिती' : 'All status'}</option>
                <option value="ACTIVE">{isMr ? 'सक्रिय' : 'Active'}</option>
                <option value="INACTIVE">{isMr ? 'निष्क्रिय' : 'Inactive'}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {!wards ? (
        <Loading />
      ) : !visible.length ? (
        <Empty>
          {search || statusFilter || selectedWardId
            ? isMr
              ? 'या फिल्टरनुसार कोणतेही वॉर्ड सापडले नाहीत.'
              : 'No wards match the selected filters.'
            : isMr
            ? 'अद्याप वॉर्ड नोंदवलेले नाहीत.'
            : 'No wards have been created yet.'}
        </Empty>
      ) : (
        <div className="ward-grid">
          {visible.map(w => {
            const areas = w.areas || [];
            const nagars = activeNagarsevaks(w);
            const wardNo = formatWardNumber(w.wardNumber) || w.wardNumber || '—';
            const expanded = !!openChips[w.id];
            const shownAreas = expanded ? areas : areas.slice(0, 4);
            const extraAreas = Math.max(0, areas.length - 4);
            return (
              <section key={w.id} className={`ward-card ${isActiveWard(w) ? 'is-open' : 'is-closed'}`}>
                <div className="ward-card-top">
                  <button type="button" className="ward-card-identity" onClick={() => setDetail(w)}>
                    <div className={`exec-avatar ${isActiveWard(w) ? 'green' : 'amber'}`}>
                      {String(wardNo).replace(/^W-?/i, '').slice(0, 2) || 'W'}
                    </div>
                    <div className="ward-card-id-copy">
                      <h3>{wardNo}</h3>
                      <p className="ward-card-name">{w.name || (isMr ? 'नगरपालिका वॉर्ड' : 'Municipal ward')}</p>
                    </div>
                  </button>
                  <StatusPill>{w.status || 'INACTIVE'}</StatusPill>
                </div>

                <p className="ward-card-copy">
                  {w.description || (isMr ? 'या वॉर्डासाठी वर्णन नोंदवलेले नाही.' : 'No description recorded for this ward.')}
                </p>

                <div className="ward-card-stats">
                  <div>
                    <span>{isMr ? 'कॉलनी / परिसर' : 'Colonies'}</span>
                    <strong>{areas.length}</strong>
                  </div>
                  <div>
                    <span>{isMr ? 'नगरसेवक' : 'Nagarsevak'}</span>
                    <strong>
                      {nagars.length
                        ? nagars.length === 1
                          ? nagars[0].name || (isMr ? 'नेमणूक' : 'Assigned')
                          : `${nagars.length} ${isMr ? 'नेमणूक' : 'assigned'}`
                        : isMr
                        ? 'नेमणूक नाही'
                        : 'Not assigned'}
                    </strong>
                  </div>
                </div>

                <div className="ward-card-section">
                  <div className="ward-card-section-label">{isMr ? 'कॉलनी' : 'Areas'}</div>
                  {areas.length ? (
                    <div className="ward-area-chips">
                      {shownAreas.map(a => (
                        <span key={a.id}>{a.name}</span>
                      ))}
                      {extraAreas > 0 && (
                        <button
                          type="button"
                          className="ward-more-btn"
                          onClick={() => setOpenChips(prev => ({ ...prev, [w.id]: !prev[w.id] }))}
                        >
                          {expanded ? (isMr ? 'कमी दाखवा' : 'Show less') : `+${extraAreas} ${isMr ? 'अधिक' : 'more'}`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="ward-card-empty">{isMr ? 'अद्याप कॉलनी जोडलेली नाही.' : 'No colonies added yet.'}</p>
                  )}
                </div>

                <div className="ward-card-section">
                  <div className="ward-card-section-label">{isMr ? 'सक्रिय नगरसेवक' : 'Active Nagarsevaks'}</div>
                  {nagars.length ? (
                    <div className="ward-nagar-chips">
                      {nagars.map(u => (
                        <span key={u.id}>{u.name || (isMr ? 'नगरसेवक' : 'Nagarsevak')}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="ward-card-empty">{isMr ? 'या वॉर्डावर सक्रिय नगरसेवक नाही.' : 'No active Nagarsevak on this ward.'}</p>
                  )}
                </div>

                <div className="ward-card-footer">
                  <button type="button" className="exec-btn-view" onClick={() => setDetail(w)}>
                    <EyeIcon size={13} />
                    <span>{isMr ? 'पहा' : 'View'}</span>
                  </button>
                  <RowMenu
                    menuOnly
                    items={[
                      { label: isMr ? 'तपशील पहा' : 'View details', onClick: () => setDetail(w) },
                      wardEditor && {
                        label: isMr ? 'वॉर्ड संपादित करा' : 'Edit ward',
                        onClick: () => setEdit({ ...blank, ...w })
                      },
                      wardEditor && {
                        label: isMr ? 'कॉलनी जोडा' : 'Add area / colony',
                        onClick: () => setAreaCreate({ wardId: w.id, ...emptyArea })
                      },
                      master && {
                        label: isMr ? 'वॉर्ड हटवा' : 'Delete ward',
                        danger: true,
                        onClick: async () => {
                          if (
                            confirm(
                              isMr
                                ? `${formatWardNumber(w.wardNumber)} रिसायकल बिनमध्ये हलवायचे आहे का?`
                                : `Delete ward ${formatWardNumber(w.wardNumber)}? It will move to the recycle bin.`
                            )
                          ) {
                            try {
                              await api.deleteWard(w.id);
                              await load();
                            } catch (e) {
                              setError(e.message);
                            }
                          }
                        }
                      }
                    ].filter(Boolean)}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}

      {detail && (
        <Modal
          wide
          title={`${formatWardLabel(detail)} · ${isMr ? 'वॉर्ड तपशील' : 'Ward details'}`}
          onClose={() => setDetail(null)}
        >
          <div className="exec-modal-profile-header">
            <div className={`exec-modal-avatar ${isActiveWard(detail) ? 'green' : 'amber'}`}>
              {String(formatWardNumber(detail.wardNumber) || 'W').replace(/^W-?/i, '').slice(0, 2) || 'W'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {formatWardNumber(detail.wardNumber)}
                </h2>
                <StatusPill>{detail.status || 'INACTIVE'}</StatusPill>
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                {detail.name || (isMr ? 'नगरपालिका वॉर्ड' : 'Municipal ward')}
                {(detail.areas || []).length ? ` · ${(detail.areas || []).length} ${isMr ? 'कॉलनी' : 'colonies'}` : ''}
              </div>
            </div>
            {wardEditor && (
              <button
                type="button"
                className="exec-modal-btn primary"
                style={{ height: 34, padding: '0 12px', fontSize: 12 }}
                onClick={() => setAreaCreate({ wardId: detail.id, ...emptyArea })}
              >
                <span>+</span>
                <span>{isMr ? 'कॉलनी जोडा' : 'Add colony'}</span>
              </button>
            )}
          </div>

          <div className="prof-detail-grid">
            <div className="prof-detail-card">
              <div className="prof-card-title">
                <BuildingIcon size={16} />
                <span>{isMr ? 'वॉर्ड माहिती' : 'Ward information'}</span>
              </div>
              <div className="prof-spec-list">
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'वॉर्ड क्रमांक' : 'Ward number'}</span>
                  <span className="prof-spec-v">{formatWardNumber(detail.wardNumber) || '—'}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'नाव' : 'Name'}</span>
                  <span className="prof-spec-v">{detail.name || '—'}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'स्थिती' : 'Status'}</span>
                  <span className="prof-spec-v">
                    <StatusPill>{detail.status || 'INACTIVE'}</StatusPill>
                  </span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'वर्णन' : 'Description'}</span>
                  <span className="prof-spec-v">{detail.description || '—'}</span>
                </div>
              </div>
            </div>
            <div className="prof-detail-card">
              <div className="prof-card-title">
                <UsersIcon size={16} />
                <span>{isMr ? 'सक्रिय नगरसेवक' : 'Active Nagarsevaks'}</span>
              </div>
              <div className="prof-spec-list">
                {activeNagarsevaks(detail).length ? (
                  activeNagarsevaks(detail).map(u => (
                    <div className="prof-spec-row" key={u.id}>
                      <span className="prof-spec-k">{u.name || (isMr ? 'नगरसेवक' : 'Nagarsevak')}</span>
                      <span className="prof-spec-v">{u.mobile || '—'}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    {isMr ? 'या वॉर्डावर अद्याप सक्रिय नगरसेवक नाही.' : 'No active Nagarsevak on this ward yet.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="prof-detail-card" style={{ marginBottom: 16 }}>
            <div className="prof-card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPinIcon size={16} />
                <span>
                  {isMr ? 'कॉलनी / परिसर' : 'Colonies / Areas'} ({(detail.areas || []).length})
                </span>
              </div>
            </div>
            {!(detail.areas || []).length ? (
              <p className="muted" style={{ margin: 0 }}>
                {isMr ? 'अद्याप कॉलनी जोडलेली नाही.' : 'No colonies yet.'}
              </p>
            ) : (
              <div className="prof-spec-list">
                {(detail.areas || []).map(a => (
                  <div className="prof-spec-row" key={a.id} style={{ alignItems: 'center' }}>
                    <span className="prof-spec-k" style={{ textAlign: 'left' }}>
                      <strong>{a.name}</strong>
                      <div className="muted" style={{ fontWeight: 400, marginTop: 2 }}>
                        {a.description || (isMr ? 'वर्णन नाही' : 'No description')}
                      </div>
                    </span>
                    {wardEditor && !a.official ? (
                      <span className="prof-spec-v" style={{ display: 'inline-flex', gap: 6 }}>
                        <button type="button" className="exec-btn-view" onClick={() => setAreaEdit({ ...emptyArea, ...a })}>
                          <EditIcon size={12} />
                          <span>{isMr ? 'संपादित' : 'Edit'}</span>
                        </button>
                        <button
                          type="button"
                          className="small-btn danger"
                          onClick={async () => {
                            if (confirm(isMr ? `${a.name} हटवायचे आहे का?` : `Delete area ${a.name}?`)) {
                              try {
                                await api.deleteArea(a.id);
                                await load();
                                const fresh = ((await api.wards()).data || []).find(x => String(x.id) === String(detail.id));
                                if (fresh) setDetail(fresh);
                              } catch (e) {
                                setError(e.message);
                              }
                            }
                          }}
                        >
                          {isMr ? 'हटवा' : 'Delete'}
                        </button>
                      </span>
                    ) : (
                      <span className="prof-spec-v">—</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="exec-modal-footer">
            <button type="button" className="exec-modal-btn ghost" onClick={() => setDetail(null)}>
              {isMr ? 'बंद करा' : 'Close'}
            </button>
            {wardEditor && (
              <button
                type="button"
                className="exec-modal-btn primary"
                onClick={() => {
                  setDetail(null);
                  setEdit({ ...blank, ...detail });
                }}
              >
                <EditIcon size={13} />
                <span>{isMr ? 'वॉर्ड संपादित करा' : 'Edit ward'}</span>
              </button>
            )}
          </div>
        </Modal>
      )}

      {(edit || create) && (
        <Modal
          wide
          title={edit ? `${isMr ? 'संपादित करा' : 'Edit'} ${formatWardNumber(edit.wardNumber)}` : isMr ? 'वॉर्ड तयार करा' : 'Create ward'}
          onClose={() => {
            setEdit(null);
            setCreate(null);
          }}
        >
          <form className="form-grid admin-form" onSubmit={saveWard}>
            <div className="form-section-title span-2">
              <FileTextIcon size={16} style={{ color: '#0f766e' }} />
              <strong>{isMr ? 'वॉर्ड' : 'Ward'}</strong>
              <span>{isMr ? 'घर, कुटुंब आणि नोंदणीसाठी वापरला जाणारा क्रमांक व नाव.' : 'Number and name used across houses, families and registration.'}</span>
            </div>
            <Field label={isMr ? 'वॉर्ड क्रमांक *' : 'Ward number *'}>
              <input
                required
                value={(edit || create).wardNumber || ''}
                onChange={e => (edit ? setEdit : setCreate)({ ...(edit || create), wardNumber: e.target.value })}
              />
            </Field>
            <Field label={isMr ? 'वॉर्ड नाव (पर्यायी)' : 'Ward name (optional)'}>
              <input
                value={(edit || create).name || ''}
                onChange={e => (edit ? setEdit : setCreate)({ ...(edit || create), name: e.target.value })}
              />
            </Field>
            <Field className="span-2" label={isMr ? 'वर्णन' : 'Ward description'}>
              <textarea
                value={(edit || create).description || ''}
                onChange={e => (edit ? setEdit : setCreate)({ ...(edit || create), description: e.target.value })}
              />
            </Field>
            {!edit && (
              <div className="span-2 ward-area-editor">
                <p className="activation-form-note">
                  {isMr
                    ? 'नवीन वॉर्ड Ward activation वर उघडे होईपर्यंत निष्क्रिय राहतात. निष्क्रिय वॉर्ड नागरिक नोंदणीवर दिसत नाहीत.'
                    : 'New wards stay inactive until you open them on Ward activation. Inactive wards do not appear on resident registration.'}
                </p>
                <div className="section-label">{isMr ? 'या वॉर्डातील कॉलनी / परिसर' : 'Colonies / areas in this ward'}</div>
                {(create.areas || []).map((a, i) => (
                  <div className="ward-area-editor-card" key={i}>
                    <div className="ward-area-editor-head">
                      <strong>
                        {isMr ? 'कॉलनी' : 'Colony'} {i + 1}
                      </strong>
                      {(create.areas || []).length > 1 && (
                        <button
                          type="button"
                          className="small-btn danger"
                          onClick={() => setCreate({ ...create, areas: create.areas.filter((_, j) => j !== i) })}
                        >
                          {isMr ? 'काढा' : 'Remove'}
                        </button>
                      )}
                    </div>
                    <div className="form-grid">
                      <Field label={isMr ? 'कॉलनी / परिसर नाव *' : 'Colony / area name *'}>
                        <input
                          placeholder={isMr ? 'उदा. सावेडी' : 'e.g. Savedi Village'}
                          value={a.name}
                          onChange={e =>
                            setCreate({ ...create, areas: create.areas.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })
                          }
                        />
                      </Field>
                      <Field label={isMr ? 'खूण / नोंद (पर्यायी)' : 'Landmark or note (optional)'}>
                        <input
                          placeholder={isMr ? 'उदा. बस स्टॉप जवळ' : 'e.g. Near bus stop'}
                          value={a.description}
                          onChange={e =>
                            setCreate({
                              ...create,
                              areas: create.areas.map((x, j) => (j === i ? { ...x, description: e.target.value } : x))
                            })
                          }
                        />
                      </Field>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="small-btn"
                  onClick={() => setCreate({ ...create, areas: [...(create.areas || []), { ...emptyArea }] })}
                >
                  + {isMr ? 'आणखी कॉलनी जोडा' : 'Add another colony'}
                </button>
              </div>
            )}
            <div className="modal-actions span-2">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setEdit(null);
                  setCreate(null);
                }}
              >
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button className="primary-btn" disabled={busy}>
                {busy ? (isMr ? 'जतन…' : 'Saving…') : edit ? (isMr ? 'बदल जतन करा' : 'Save changes') : isMr ? 'वॉर्ड तयार करा' : 'Create ward'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {areaEdit && (
        <Modal wide title={`${isMr ? 'कॉलनी संपादित करा' : 'Edit area'} · ${areaEdit.name}`} onClose={() => setAreaEdit(null)}>
          <form className="form-grid admin-form" onSubmit={saveArea}>
            <Field className="span-2" label={isMr ? 'कॉलनी / परिसर नाव *' : 'Area / Colony name *'}>
              <input required value={areaEdit.name} onChange={e => setAreaEdit({ ...areaEdit, name: e.target.value })} />
            </Field>
            <Field className="span-2" label={isMr ? 'वर्णन' : 'Description'}>
              <textarea value={areaEdit.description || ''} onChange={e => setAreaEdit({ ...areaEdit, description: e.target.value })} />
            </Field>
            <div className="modal-actions span-2">
              <button type="button" className="ghost-btn" onClick={() => setAreaEdit(null)}>
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button className="primary-btn" disabled={busy}>
                {isMr ? 'कॉलनी जतन करा' : 'Save area'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {areaCreate && (
        <Modal wide title={isMr ? 'कॉलनी / परिसर जोडा' : 'Add area / colony'} onClose={() => setAreaCreate(null)}>
          <form className="form-grid admin-form" onSubmit={saveArea}>
            <Field className="span-2" label={isMr ? 'कॉलनी / परिसर नाव *' : 'Area / Colony name *'}>
              <input required value={areaCreate.name} onChange={e => setAreaCreate({ ...areaCreate, name: e.target.value })} />
            </Field>
            <Field className="span-2" label={isMr ? 'वर्णन' : 'Description'}>
              <textarea value={areaCreate.description} onChange={e => setAreaCreate({ ...areaCreate, description: e.target.value })} />
            </Field>
            <div className="modal-actions span-2">
              <button type="button" className="ghost-btn" onClick={() => setAreaCreate(null)}>
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button className="primary-btn" disabled={busy}>
                {isMr ? 'कॉलनी जोडा' : 'Add area'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
