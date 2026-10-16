import React, { useEffect, useMemo, useState } from 'react';
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
  SearchableSelect
} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { useWardFilter } from '../wardFilter';
import { can, isNagarsevak, isEmployee, isMaster } from '../rbac';
import { directionsUrl, hasCoords } from '../location';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import LocationPicker from '../components/LocationMap';
import { getLanguage } from '../language';
import {
  HeartIcon,
  MapPinIcon,
  PhoneIcon,
  ClockIcon,
  EyeIcon,
  EditIcon,
  SearchIcon,
  CheckIcon,
  BuildingIcon
} from '../components/Icons';

const TYPES = [
  { value: 'GOVERNMENT', en: 'Government', mr: 'शासकीय' },
  { value: 'PRIVATE', en: 'Private', mr: 'खासगी' },
  { value: 'TRUST', en: 'Trust / Charitable', mr: 'ट्रस्ट / सेवाभावी' },
  { value: 'CLINIC', en: 'Clinic', mr: 'क्लिनिक' },
  { value: 'PHC', en: 'PHC / UHC', mr: 'प्राथमिक आरोग्य केंद्र' },
  { value: 'AYUSH', en: 'AYUSH', mr: 'आयुष' },
  { value: 'OTHER', en: 'Other', mr: 'इतर' }
];

const blank = {
  name: '',
  type: 'PRIVATE',
  wardId: '',
  areaId: '',
  address: '',
  landmark: '',
  phone: '',
  emergencyPhone: '',
  openingHours: '',
  facilities: '',
  notes: '',
  status: 'ACTIVE',
  latitude: '',
  longitude: ''
};

function typeLabel(value, isMr) {
  const hit = TYPES.find(t => t.value === value);
  return hit ? (isMr ? hit.mr : hit.en) : value || '—';
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'H';
  return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function HospitalCard({ h, isMr, onOpen }) {
  const pinned = hasCoords(h.latitude, h.longitude);
  return (
    <article className="hospital-card">
      <div className="hospital-card-top">
        <span className={`hospital-type-chip type-${String(h.type || '').toLowerCase()}`}>
          {typeLabel(h.type, isMr)}
        </span>
        {h.status === 'INACTIVE' && (
          <span className="team-badge gray">{isMr ? 'निष्क्रिय' : 'Inactive'}</span>
        )}
      </div>
      <h3>{h.name}</h3>
      <p className="hospital-card-addr">
        {h.address}
        {h.landmark ? ` · ${h.landmark}` : ''}
      </p>
      <div className="hospital-card-meta">
        {h.area?.name && <span>{h.area.name}</span>}
        <span>{formatWardNumber(h.ward?.wardNumber) || formatWardLabel(h.ward) || '—'}</span>
      </div>
      {h.openingHours && (
        <div className="hospital-card-line">
          <ClockIcon size={13} />
          <span>{h.openingHours}</span>
        </div>
      )}
      {h.phone && (
        <a className="hospital-card-line" href={`tel:${h.phone}`}>
          <PhoneIcon size={13} />
          <span>{h.phone}</span>
        </a>
      )}
      {h.emergencyPhone && (
        <a className="hospital-card-line is-emergency" href={`tel:${h.emergencyPhone}`}>
          <PhoneIcon size={13} />
          <span>{isMr ? 'आणीबाणी' : 'Emergency'}: {h.emergencyPhone}</span>
        </a>
      )}
      {h.facilities && <p className="hospital-card-facilities">{h.facilities}</p>}
      <div className="hospital-card-actions">
        {onOpen && (
          <button type="button" className="exec-btn-view" onClick={() => onOpen(h)}>
            <EyeIcon size={13} />
            <span>{isMr ? 'तपशील' : 'Details'}</span>
          </button>
        )}
        {pinned && (
          <a
            className="table-directions-btn"
            href={directionsUrl(h.latitude, h.longitude)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPinIcon size={13} />
            <span>{isMr ? 'दिशा' : 'Directions'}</span>
          </a>
        )}
      </div>
    </article>
  );
}

export default function Hospitals() {
  const user = getUser();
  const isMr = getLanguage() === 'mr';
  const isCitizen = String(user?.role || '').toUpperCase() === 'CITIZEN';
  const { selectedWardId } = useWardFilter();
  const canAdd = can('CREATE_HOSPITALS') || isNagarsevak() || isEmployee() || isMaster();
  const canEdit = can('EDIT_HOSPITALS') || canAdd;
  const canDelete = can('DELETE_HOSPITALS') || isNagarsevak() || isMaster() || isEmployee();
  const wardLocked = isNagarsevak() || isEmployee();

  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState({ total: 0, government: 0, private: 0, mapped: 0 });
  const [wards, setWards] = useState([]);
  const [filters, setFilters] = useState({ search: '', type: '', status: '', areaId: '', typeGroup: '', mappedOnly: false });
  const [searchText, setSearchText] = useState('');
  const [form, setForm] = useState(blank);
  const [edit, setEdit] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  async function load(nextPage = page, nextLimit = pageSize, nextFilters = filters) {
    try {
      setError('');
      const res = await api.hospitals({
        wardId: selectedWardId || undefined,
        type: nextFilters.type || undefined,
        typeGroup: nextFilters.typeGroup || undefined,
        mapped: nextFilters.mappedOnly ? '1' : undefined,
        status: isCitizen ? undefined : nextFilters.status || undefined,
        areaId: nextFilters.areaId || undefined,
        search: nextFilters.search || undefined,
        page: nextPage,
        limit: nextLimit
      });
      setRows(res.data || []);
      setTotal(Number(res.meta?.total) || 0);
      if (res.meta?.kpis) setKpis(res.meta.kpis);
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters(f => (f.search === searchText ? f : { ...f, search: searchText }));
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchText]);

  useEffect(() => {
    setPage(1);
  }, [selectedWardId, filters.type, filters.status, filters.areaId, filters.typeGroup, filters.mappedOnly]);

  useEffect(() => {
    load(page, pageSize, filters);
  }, [selectedWardId, filters.type, filters.status, filters.areaId, filters.typeGroup, filters.mappedOnly, filters.search, page, pageSize]);

  useEffect(() => {
    if (isCitizen) return;
    api.wards().then(w => setWards(w.data || [])).catch(e => setError(e.message));
  }, [isCitizen]);

  const colonyOptions = useMemo(() => {
    const source = selectedWardId
      ? (wards || []).filter(w => String(w.id) === String(selectedWardId))
      : (wards || []);
    return source.flatMap(w => (w.areas || []).map(a => ({ value: a.id, label: a.name })));
  }, [wards, selectedWardId]);

  const hasActiveFilters = Boolean(filters.search || filters.type || filters.status || filters.areaId || filters.typeGroup || filters.mappedOnly);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const formWardId = form.wardId || user?.wardId || selectedWardId || '';
  const formAreas = useMemo(() => {
    const ward = (wards || []).find(w => String(w.id) === String(formWardId));
    return (ward?.areas || []).map(a => ({ value: a.id, label: a.name }));
  }, [wards, formWardId]);
  const selectedWard = (wards || []).find(w => String(w.id) === String(formWardId));
  const selectedArea = (selectedWard?.areas || []).find(a => String(a.id) === String(form.areaId));

  function setKpi(next) {
    setPage(1);
    setFilters(f => ({ ...f, type: '', ...next }));
  }

  function openAdd() {
    setForm({
      ...blank,
      wardId: selectedWardId || user?.wardId || wards[0]?.id || '',
      type: 'PRIVATE',
      status: 'ACTIVE'
    });
    setEdit('create');
  }

  function openEdit(h) {
    setForm({
      ...blank,
      ...h,
      wardId: h.wardId || h.ward?.id || '',
      areaId: h.areaId || h.area?.id || '',
      latitude: h.latitude || '',
      longitude: h.longitude || ''
    });
    setEdit(h);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { ...form, wardId: formWardId };
      if (edit === 'create') await api.createHospital(payload);
      else await api.updateHospital(edit.id, payload);
      setEdit(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(h) {
    if (!window.confirm(isMr ? 'हे हॉस्पिटल रिसायकल बिनमध्ये हलवायचे आहे का?' : 'Move this hospital to recycle bin?')) return;
    try {
      await api.deleteHospital(h.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (isCitizen) {
    return (
      <div className="user-hospitals-page">
        <PageHeader
          kicker={isMr ? 'प्रभाग आरोग्य सेवा' : 'Ward health directory'}
          title={isMr ? 'हॉस्पिटल्स' : 'Hospitals in your ward'}
          subtitle={
            isMr
              ? 'तुमच्या वॉर्डमधील रुग्णालये, क्लिनिक आणि आणीबाणी संपर्क. फक्त माहिती पहा — नोंद नागरी सेवक किंवा कर्मचारी करतात.'
              : 'Hospitals and clinics in your registered ward. This directory is for viewing only.'
          }
        />
        <ErrorBox error={error} />
        <div className="exec-toolbar-panel user-hospital-filterbar">
          <div className="exec-toolbar-row">
            <div className="exec-toolbar-left">
              <div className="exec-search-box">
                <SearchIcon size={15} />
                <input
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder={isMr ? 'नाव, पत्ता, फोन…' : 'Name, address, phone…'}
                />
                {searchText && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => { setSearchText(''); setFilters(f => ({ ...f, search: '' })); setPage(1); }}
                    title={isMr ? 'शोध साफ करा' : 'Clear search'}
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="exec-quick-status">
                <select
                  className="exec-filter-select"
                  value={filters.type}
                  onChange={e => { setFilters(f => ({ ...f, type: e.target.value, typeGroup: '' })); setPage(1); }}
                  aria-label={isMr ? 'प्रकार' : 'Type'}
                >
                  <option value="">{isMr ? 'सर्व प्रकार' : 'All types'}</option>
                  {TYPES.map(t => (
                    <option key={t.value} value={t.value}>{isMr ? t.mr : t.en}</option>
                  ))}
                </select>
              </div>
              <div className="exec-quick-status">
                <select
                  className="exec-filter-select"
                  value={filters.typeGroup}
                  onChange={e => { setFilters(f => ({ ...f, typeGroup: e.target.value, type: '' })); setPage(1); }}
                  aria-label={isMr ? 'गट' : 'Group'}
                >
                  <option value="">{isMr ? 'सर्व गट' : 'All groups'}</option>
                  <option value="gov">{isMr ? 'शासकीय / PHC' : 'Government / PHC'}</option>
                  <option value="private">{isMr ? 'खासगी / क्लिनिक' : 'Private / Clinic'}</option>
                </select>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="small-btn"
                  onClick={() => {
                    setSearchText('');
                    setFilters({ search: '', type: '', status: '', areaId: '', typeGroup: '', mappedOnly: false });
                    setPage(1);
                  }}
                >
                  {isMr ? 'फिल्टर साफ करा' : 'Clear filters'}
                </button>
              )}
            </div>
          </div>
        </div>
        {rows === null ? (
          <Loading />
        ) : !rows.length ? (
          <Empty title={hasActiveFilters ? (isMr ? 'फिल्टरनुसार हॉस्पिटल सापडले नाही.' : 'No hospitals match the selected filters.') : (isMr ? 'हॉस्पिटल नोंद नाही' : 'No hospitals listed yet')} />
        ) : (
          <>
            <div className="hospital-card-grid">
              {rows.map(h => (
                <HospitalCard key={h.id} h={h} isMr={isMr} onOpen={setDetail} />
              ))}
            </div>
            <PaginationBar page={page} pages={pages} total={total} limit={pageSize} onPage={setPage} onLimit={setPageSize} />
          </>
        )}
        {detail && (
          <Modal title={detail.name} onClose={() => setDetail(null)}>
            <HospitalCard h={detail} isMr={isMr} />
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="admin-data-page hospitals-page" style={{ paddingTop: 8 }}>
      <PageHeader
        kicker={isMr ? 'वॉर्ड आरोग्य नोंदणी' : 'Ward health register'}
        title={isMr ? 'हॉस्पिटल्स' : 'Hospitals in our ward'}
        subtitle={
          isMr
            ? 'नगरसेवक आणि कर्मचारी रुग्णालये, पत्ता आणि नकाशावरील स्थान जोडू शकतात. नागरिकांना फक्त तपशील दिसतो.'
            : 'Nagarsevak and field staff can add hospitals with address and map location. Residents see details only.'
        }
        action={
          canAdd ? (
            <button type="button" className="primary-btn" onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>+</span>
              <span>{isMr ? 'हॉस्पिटल जोडा' : 'Add hospital'}</span>
            </button>
          ) : null
        }
      />
      <ErrorBox error={error} />

      <div className="team-kpi-grid">
        <div
          className={`team-kpi-card ${!filters.typeGroup && !filters.mappedOnly && !filters.type ? 'active' : ''}`}
          onClick={() => setKpi({ typeGroup: '', mappedOnly: false })}
          title={isMr ? 'सर्व हॉस्पिटल्स' : 'View all hospitals'}
        >
          <div className="team-kpi-icon blue"><HeartIcon size={20} /></div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{rows === null ? '…' : kpis.total}</div>
            <div className="team-kpi-label">{isMr ? 'एकूण हॉस्पिटल्स' : 'All hospitals'}</div>
          </div>
        </div>
        <div
          className={`team-kpi-card ${filters.typeGroup === 'gov' ? 'active' : ''}`}
          onClick={() => setKpi({ typeGroup: filters.typeGroup === 'gov' ? '' : 'gov', mappedOnly: false })}
          title={isMr ? 'शासकीय / PHC' : 'Government and PHC'}
        >
          <div className="team-kpi-icon green"><BuildingIcon size={20} /></div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{rows === null ? '…' : kpis.government}</div>
            <div className="team-kpi-label">{isMr ? 'शासकीय / PHC' : 'Government / PHC'}</div>
          </div>
        </div>
        <div
          className={`team-kpi-card ${filters.typeGroup === 'private' ? 'active' : ''}`}
          onClick={() => setKpi({ typeGroup: filters.typeGroup === 'private' ? '' : 'private', mappedOnly: false })}
          title={isMr ? 'खासगी / क्लिनिक' : 'Private and clinics'}
        >
          <div className="team-kpi-icon purple"><HeartIcon size={20} /></div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{rows === null ? '…' : kpis.private}</div>
            <div className="team-kpi-label">{isMr ? 'खासगी / क्लिनिक' : 'Private / Clinic'}</div>
          </div>
        </div>
        <div
          className={`team-kpi-card ${filters.mappedOnly ? 'active' : ''}`}
          onClick={() => setKpi({ mappedOnly: !filters.mappedOnly, typeGroup: '' })}
          title={isMr ? 'नकाशावर पिन असलेली' : 'Mapped locations'}
        >
          <div className="team-kpi-icon teal"><MapPinIcon size={20} /></div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{rows === null ? '…' : kpis.mapped}</div>
            <div className="team-kpi-label">{isMr ? 'नकाशावर पिन' : 'Mapped'}</div>
          </div>
        </div>
      </div>

      <div className="exec-toolbar-panel">
        <div className="exec-toolbar-row">
          <div className="exec-toolbar-left">
            <div className="exec-search-box">
              <SearchIcon size={15} />
              <input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder={isMr ? 'शोधा…' : 'Search…'}
              />
              {searchText && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => { setSearchText(''); setFilters(f => ({ ...f, search: '' })); setPage(1); }}
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
                className="exec-filter-select"
                value={filters.areaId}
                onChange={e => { setFilters(f => ({ ...f, areaId: e.target.value })); setPage(1); }}
              >
                <option value="">{isMr ? 'सर्व कॉलनी' : 'All colonies'}</option>
                {colonyOptions.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="exec-quick-status">
              <select
                className="exec-filter-select"
                value={filters.type}
                onChange={e => { setFilters(f => ({ ...f, type: e.target.value, typeGroup: '' })); setPage(1); }}
              >
                <option value="">{isMr ? 'सर्व प्रकार' : 'All types'}</option>
                {TYPES.map(t => (
                  <option key={t.value} value={t.value}>{isMr ? t.mr : t.en}</option>
                ))}
              </select>
            </div>
            <div className="exec-quick-presence">
              <select
                className="exec-filter-select"
                value={filters.status}
                onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}
              >
                <option value="">{isMr ? 'सर्व स्थिती' : 'All status'}</option>
                <option value="ACTIVE">{isMr ? 'सक्रिय' : 'Active'}</option>
                <option value="INACTIVE">{isMr ? 'निष्क्रिय' : 'Inactive'}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {rows === null ? (
        <Loading />
      ) : !rows.length ? (
        <Empty>
          {hasActiveFilters
            ? (isMr ? 'या फिल्टरनुसार हॉस्पिटल सापडले नाही.' : 'No hospitals match the selected filters.')
            : (isMr ? 'या वॉर्डमध्ये अद्याप हॉस्पिटल नोंद नाही.' : 'No hospitals found for the selected ward.')}
        </Empty>
      ) : (
        <div className="panel table-wrap hospitals-table-wrap">
          <table className="hospitals-table">
            <thead>
              <tr>
                <th>{isMr ? 'हॉस्पिटल' : 'Hospital'}</th>
                <th>{isMr ? 'पत्ता व कॉलनी' : 'Address & colony'}</th>
                <th>{isMr ? 'संपर्क' : 'Contact'}</th>
                <th>{isMr ? 'स्थान' : 'Location'}</th>
                <th>{isMr ? 'स्थिती' : 'Status'}</th>
                <th style={{ textAlign: 'center' }}>{isMr ? 'कृती' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(h => (
                <tr key={h.id}>
                  <td data-label="Hospital">
                    <div className="exec-cell-user">
                      <button type="button" className="exec-avatar teal" onClick={() => setDetail(h)} title={h.name}>
                        {getInitials(h.name)}
                      </button>
                      <div className="exec-cell-meta">
                        <button type="button" className="exec-cell-name" onClick={() => setDetail(h)}>{h.name}</button>
                        <div className="hospital-cell-tags">
                          <span className={`hospital-type-chip type-${String(h.type || '').toLowerCase()}`}>
                            {typeLabel(h.type, isMr)}
                          </span>
                          {h.openingHours && <span className="muted">{h.openingHours}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Address">
                    <div className="hospital-addr-cell">{h.address || '—'}</div>
                    <div className="muted">{[h.landmark, h.area?.name, formatWardNumber(h.ward?.wardNumber)].filter(Boolean).join(' · ') || '—'}</div>
                  </td>
                  <td data-label="Contact">
                    {h.phone ? <a className="hospital-phone-link" href={`tel:${h.phone}`}>{h.phone}</a> : <span className="muted">—</span>}
                    {h.emergencyPhone && (
                      <div className="hospital-emergency-mini">{isMr ? 'आणीबाणी' : 'Emergency'}: {h.emergencyPhone}</div>
                    )}
                  </td>
                  <td data-label="Location">
                    {hasCoords(h.latitude, h.longitude) ? (
                      <a className="table-directions-btn" href={directionsUrl(h.latitude, h.longitude)} target="_blank" rel="noopener noreferrer">
                        <MapPinIcon size={12} />
                        <span>{isMr ? 'दिशा' : 'Directions'}</span>
                      </a>
                    ) : (
                      <span className="muted">{isMr ? 'पिन नाही' : 'No pin'}</span>
                    )}
                  </td>
                  <td data-label="Status">
                    <span className={`team-badge ${h.status === 'ACTIVE' ? 'green' : 'gray'}`}>
                      {h.status === 'ACTIVE' ? (isMr ? 'सक्रिय' : 'Active') : (isMr ? 'निष्क्रिय' : 'Inactive')}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <div className="exec-action-group">
                      <button type="button" className="exec-btn-view" onClick={() => setDetail(h)}>
                        <EyeIcon size={13} />
                        <span>{isMr ? 'पहा' : 'View'}</span>
                      </button>
                      {canEdit && (
                        <button type="button" className="exec-btn-edit" onClick={() => openEdit(h)}>
                          <EditIcon size={13} />
                          <span>{isMr ? 'संपादित' : 'Edit'}</span>
                        </button>
                      )}
                      <RowMenu
                        menuOnly
                        items={[
                          { label: isMr ? 'तपशील' : 'View details', onClick: () => setDetail(h) },
                          canEdit && { label: isMr ? 'संपादित करा' : 'Edit', onClick: () => openEdit(h) },
                          canDelete && { label: isMr ? 'हटवा' : 'Delete', danger: true, onClick: () => remove(h) }
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar
            page={page}
            pages={pages}
            total={total}
            limit={pageSize}
            onPage={setPage}
            onLimit={(n) => { setPageSize(n); setPage(1); }}
          />
        </div>
      )}

      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <HospitalCard h={detail} isMr={isMr} />
          {canEdit && (
            <div className="exec-modal-footer">
              <button type="button" className="exec-modal-btn ghost" onClick={() => setDetail(null)}>{isMr ? 'बंद' : 'Close'}</button>
              <button type="button" className="exec-modal-btn primary" onClick={() => { setDetail(null); openEdit(detail); }}>
                {isMr ? 'संपादित करा' : 'Edit hospital'}
              </button>
            </div>
          )}
        </Modal>
      )}

      {edit && (
        <Modal
          wide
          title={edit === 'create' ? (isMr ? 'नवीन हॉस्पिटल जोडा' : 'Add hospital') : (isMr ? `${edit.name} — संपादित करा` : `Edit ${edit.name}`)}
          onClose={() => setEdit(null)}
        >
          <form className="admin-form hospital-form" onSubmit={save}>
            <ErrorBox error={error} />

            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <HeartIcon size={16} style={{ color: '#0f766e' }} />
                  <span>{isMr ? '१. हॉस्पिटल माहिती' : '1. Hospital details'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'नाव, प्रकार आणि नागरिकांना दिसणारी स्थिती' : 'Name, facility type and public visibility'}
                </span>
              </div>
              <Field label={isMr ? 'हॉस्पिटल / क्लिनिकचे नाव *' : 'Hospital / clinic name *'}>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={isMr ? 'उदा. सिव्हिल हॉस्पिटल, साई क्लिनिक' : 'e.g. Civil Hospital, Sai Clinic'} />
              </Field>
              <Field label={isMr ? 'प्रकार' : 'Facility type'}>
                <div className="hospital-type-picks">
                  {TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      className={`hospital-type-pick ${form.type === t.value ? 'is-on' : ''}`}
                      onClick={() => setForm({ ...form, type: t.value })}
                    >
                      {isMr ? t.mr : t.en}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="hospital-form-grid">
                <Field label={isMr ? 'स्थिती' : 'Status'}>
                  <SearchableSelect
                    value={form.status}
                    onChange={v => setForm({ ...form, status: v })}
                    options={[
                      { value: 'ACTIVE', label: isMr ? 'सक्रिय (नागरिकांना दिसेल)' : 'Active (visible to residents)' },
                      { value: 'INACTIVE', label: isMr ? 'निष्क्रिय' : 'Inactive' }
                    ]}
                  />
                </Field>
                <Field label={isMr ? 'कामकाजाची वेळ' : 'Opening hours'}>
                  <input value={form.openingHours} onChange={e => setForm({ ...form, openingHours: e.target.value })} placeholder={isMr ? 'उदा. २४ तास / स. ९ ते रा. ९' : 'e.g. 24 hours / 9 AM – 9 PM'} />
                </Field>
              </div>
            </div>

            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <MapPinIcon size={16} style={{ color: '#0f766e' }} />
                  <span>{isMr ? '२. पत्ता आणि कॉलनी' : '2. Address & colony'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'पर्यायी — वॉर्ड, परिसर आणि पत्ता' : 'Optional — ward, colony and street address'}
                </span>
              </div>
              <div className="hospital-form-grid">
                <Field label={isMr ? 'वॉर्ड' : 'Ward'}>
                  {wardLocked ? (
                    <input readOnly value={formatWardLabel(user?.ward) || formatWardNumber(user?.ward?.wardNumber) || (isMr ? 'नियुक्त वॉर्ड' : 'Assigned ward')} />
                  ) : (
                    <SearchableSelect
                      value={formWardId}
                      onChange={v => setForm({ ...form, wardId: v, areaId: '' })}
                      options={(wards || []).map(w => ({ value: w.id, label: formatWardLabel(w) }))}
                      placeholder={isMr ? 'वॉर्ड निवडा…' : 'Select ward…'}
                    />
                  )}
                </Field>
                <Field label={isMr ? 'कॉलनी / परिसर' : 'Colony / Area'}>
                  <SearchableSelect
                    value={form.areaId || ''}
                    onChange={v => setForm({ ...form, areaId: v })}
                    options={formAreas}
                    placeholder={isMr ? 'पर्यायी' : 'Optional'}
                  />
                </Field>
              </div>
              <Field label={isMr ? 'पूर्ण पत्ता' : 'Full address'}>
                <textarea rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder={isMr ? 'रस्ता, परिसर, पिनकोड (पर्यायी)' : 'Street, area, pincode (optional)'} />
              </Field>
              <Field label={isMr ? 'खूण' : 'Landmark'}>
                <input value={form.landmark} onChange={e => setForm({ ...form, landmark: e.target.value })} placeholder={isMr ? 'उदा. बस स्टँड जवळ' : 'e.g. Near bus stand'} />
              </Field>
            </div>

            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <PhoneIcon size={16} style={{ color: '#0f766e' }} />
                  <span>{isMr ? '३. संपर्क, सुविधा आणि नकाशा' : '3. Contact, facilities and map'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'फोन, आणीबाणी आणि प्रवेशद्वाराचा पिन' : 'Phone, emergency contact and entrance pin'}
                </span>
              </div>
              <div className="hospital-form-grid">
                <Field label={isMr ? 'फोन' : 'Phone'}>
                  <input inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0241-XXXXXXX" />
                </Field>
                <Field label={isMr ? 'आणीबाणी फोन' : 'Emergency phone'}>
                  <input inputMode="tel" value={form.emergencyPhone} onChange={e => setForm({ ...form, emergencyPhone: e.target.value })} placeholder="108 / local casualty" />
                </Field>
              </div>
              <Field label={isMr ? 'सुविधा (ICU, रक्तपेढी, इ.)' : 'Facilities (ICU, blood bank, etc.)'}>
                <textarea rows={2} value={form.facilities} onChange={e => setForm({ ...form, facilities: e.target.value })} />
              </Field>
              <Field label={isMr ? 'नोंद' : 'Internal notes'}>
                <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </Field>
              {hasCoords(form.latitude, form.longitude) ? (
                <div className="hospital-pin-ok">
                  <CheckIcon size={15} />
                  <span>Lat {Number(form.latitude).toFixed(6)}, Lng {Number(form.longitude).toFixed(6)}</span>
                </div>
              ) : (
                <p className="muted">{isMr ? 'गेटवर उभे राहून Use GPS दाबा किंवा नकाशावर टॅप करा.' : 'Stand at the gate and tap Use GPS, or pin the entrance on the map.'}</p>
              )}
              <LocationPicker
                key={edit === 'create' ? 'new-hospital' : edit.id}
                value={form}
                onChange={next => setForm({ ...form, latitude: next.latitude, longitude: next.longitude })}
                centerFrom={[selectedArea, selectedWard]}
                hint={isMr ? 'हॉस्पिटल गेटवर उभे राहून Use GPS दाबा.' : 'Stand at the hospital gate and tap Use GPS.'}
              />
            </div>

            <div className="exec-modal-footer">
              <button type="button" className="exec-modal-btn ghost" onClick={() => setEdit(null)}>{isMr ? 'रद्द करा' : 'Cancel'}</button>
              <button type="submit" className="exec-modal-btn primary" disabled={busy}>
                {busy ? (isMr ? 'जतन करत आहे…' : 'Saving…') : (isMr ? 'हॉस्पिटल जतन करा' : 'Save hospital')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
