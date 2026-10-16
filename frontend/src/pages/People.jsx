import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import {
  Empty,
  ErrorBox,
  Loading,
  Modal,
  PageHeader,
  PaginationBar,
  RowMenu,
  SearchableSelect
} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { useWardFilter } from '../wardFilter';
import { can } from '../rbac';
import PersonForm, { emptyPerson, presenceLine } from '../components/PersonForm';
import DeathAction from '../components/DeathAction';
import {
  directionsUrl,
  hasCoords,
  nativePlaceLine,
  presenceApiQuery,
  PEOPLE_PLACE_OPTIONS
} from '../location';
import { formatWardNumber } from '../wardFormat';
import { MapPreview } from '../components/LocationMap';
import {
  SearchIcon,
  UsersIcon,
  UserCheckIcon,
  UserXIcon,
  BuildingIcon,
  ClockIcon,
  EyeIcon,
  EditIcon,
  RefreshCwIcon,
  PhoneIcon,
  CheckIcon,
  MapPinIcon,
  ShieldIcon,
  CalendarIcon
} from '../components/Icons';
import { getLanguage } from '../language';

function getInitials(name) {
  if (!name) return 'C';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function occupationLabel(p) {
  if (p.isRetired || p.occupationType === 'RETIRED') {
    return `Retired${p.retiredFrom ? ` (${p.retiredFrom}${p.retiredService ? ` · ${p.retiredService}` : ''})` : p.retiredService ? ` (${p.retiredService})` : ''}`;
  }
  if (p.occupationType === 'BUSINESS') return `Business · ${p.businessName || 'N/A'}`;
  if (p.occupationType === 'SERVICE') return `${p.companyName || 'Service'} · ${p.employmentType || 'N/A'}`;
  return p.occupation || 'Other';
}

export default function People() {
  const { selectedWardId } = useWardFilter();
  const isMr = getLanguage() === 'mr';

  const [rows, setRows] = useState(null);
  const [families, setFamilies] = useState([]);
  const [wards, setWards] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25 });
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    occupationType: '',
    employmentType: '',
    isRetired: '',
    voterStatus: '',
    presenceStatus: '',
    areaId: '',
    gender: '',
    ageGroup: '',
    occupationCategory: ''
  });

  const [kpiStats, setKpiStats] = useState({ total: 0, voters: 0, nonVoters: 0, working: 0, seniors: 0 });
  const [kpiLoading, setKpiLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [edit, setEdit] = useState(null);
  const [add, setAdd] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deathPerson, setDeathPerson] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  const colonyOptions = useMemo(() => {
    const list = selectedWardId
      ? (wards.find(w => String(w.id) === String(selectedWardId))?.areas || [])
      : wards.flatMap(w => w.areas || []);
    return list.map(a => ({ value: a.id, label: a.name }));
  }, [wards, selectedWardId]);

  const activeFiltersCount = [
    filters.occupationType,
    filters.occupationCategory,
    filters.employmentType,
    filters.isRetired,
    filters.voterStatus,
    filters.presenceStatus,
    filters.areaId,
    filters.gender,
    filters.ageGroup
  ].filter(Boolean).length;

  const advancedFiltersActiveCount = [
    filters.occupationType,
    filters.employmentType,
    filters.presenceStatus,
    filters.areaId,
    filters.gender,
    filters.ageGroup
  ].filter(Boolean).length;

  function clearAllFilters() {
    setFilters({
      occupationType: '',
      occupationCategory: '',
      employmentType: '',
      isRetired: '',
      voterStatus: '',
      presenceStatus: '',
      areaId: '',
      gender: '',
      ageGroup: ''
    });
    setSearch('');
    setPage(1);
  }

  async function loadKpiStats() {
    setKpiLoading(true);
    const empty = { total: 0, voters: 0, nonVoters: 0, working: 0, seniors: 0 };
    try {
      const res = await api.personKpis({
        wardId: selectedWardId || undefined
      });
      const d = res?.data || {};
      setKpiStats({
        total: Number(d.total) || 0,
        voters: Number(d.voters) || 0,
        nonVoters: Number(d.nonVoters) || 0,
        working: Number(d.working) || 0,
        seniors: Number(d.seniors) || 0
      });
    } catch (_) {
      try {
        const dRes = await api.dashboard({ wardId: selectedWardId || undefined });
        const d = dRes?.data || {};
        setKpiStats({
          total: Number(d.persons || d.totalCitizens || 0) || 0,
          voters: Number(d.voters) || 0,
          nonVoters: Number(d.nonVoters) || 0,
          working: 0,
          seniors: 0
        });
      } catch {
        setKpiStats(empty);
      }
    } finally {
      setKpiLoading(false);
    }
  }

  async function load() {
    try {
      setError('');
      const extra = presenceApiQuery(filters.presenceStatus);
      const r = await api.persons({
        page,
        limit,
        search: search.trim() || undefined,
        wardId: selectedWardId || undefined,
        status: 'ACTIVE',
        voterStatus: filters.voterStatus || extra.voterStatus || undefined,
        presenceStatus:
          extra.presenceStatus ||
          (filters.presenceStatus === 'AT_HOME' || filters.presenceStatus === 'OUT_OF_CITY'
            ? filters.presenceStatus
            : undefined),
        occupationType: filters.occupationType || undefined,
        occupationCategory: filters.occupationCategory || undefined,
        employmentType: filters.employmentType || undefined,
        isRetired: filters.isRetired || undefined,
        gender: filters.gender || undefined,
        ageGroup: filters.ageGroup || undefined,
        areaId: filters.areaId || undefined
      });
      setRows(r.data || []);
      setMeta(r.meta || { total: (r.data || []).length, page, limit });
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [selectedWardId, search, filters]);

  useEffect(() => {
    const t = setTimeout(load, 220);
    return () => clearTimeout(t);
  }, [selectedWardId, search, filters, page, limit]);

  useEffect(() => {
    loadKpiStats();
  }, [selectedWardId]);

  useEffect(() => {
    Promise.all([api.families({ limit: 500, wardId: selectedWardId || undefined }), api.wards()])
      .then(([f, w]) => {
        setFamilies(f.data || []);
        setWards(w.data || []);
      })
      .catch(e => setError(e.message));
  }, [selectedWardId]);

  const total = Number(meta.total || 0);
  const pages = Math.max(1, Math.ceil(total / limit));
  const hasActiveFilters = Boolean(search || activeFiltersCount > 0);

  async function openPerson(id) {
    try {
      setError('');
      const r = await api.person(id);
      if (!r?.data) throw new Error('Citizen details could not be loaded.');
      setDetail(r.data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...(edit || add) };
      delete payload.age;
      delete payload.voterProfile;
      delete payload.family;
      delete payload.house;
      delete payload.documents;
      delete payload.birthday;
      delete payload.deathObservance;
      delete payload.deathRecord;
      if (edit) await api.updatePerson(edit.id, payload);
      else await api.createPerson(payload);
      setEdit(null);
      setAdd(null);
      await Promise.all([load(), loadKpiStats()]);
      if (detail?.id) await openPerson(detail.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const wardFamilies = families.filter(
    f => !selectedWardId || f.house?.area?.wardId === selectedWardId || f.house?.area?.ward?.id === selectedWardId
  );

  return (
    <div className="admin-data-page people-page" style={{ paddingTop: '8px' }}>
      <PageHeader
        kicker={isMr ? 'नागरिक व कुटुंबे' : 'People & Households'}
        title={isMr ? 'सर्व नागरिक' : 'All Citizens'}
        subtitle={
          isMr
            ? 'वॉर्डातील सर्व नागरिकांची माहिती, व्यवसाय, मतदार पात्रता, निवासस्थान व कुटुंब तपशील व्यवस्थापित करा.'
            : 'Manage citizen demographics, occupation, voting eligibility, residence, and family records.'
        }
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="exec-page-refresh-btn"
              onClick={() => {
                load();
                loadKpiStats();
              }}
              title="Refresh citizens list"
            >
              <RefreshCwIcon size={14} />
              <span>{isMr ? 'ताजे करा' : 'Refresh'}</span>
            </button>
            {can('CREATE_CITIZENS') && (
              <button
                type="button"
                className="primary-btn"
                onClick={() => setAdd({ ...emptyPerson, familyId: '' })}
                style={{ height: '36px', minHeight: '36px', fontSize: '13px', fontWeight: 600, padding: '0 14px' }}
              >
                + {isMr ? 'नागरिक जोडा' : 'Add Citizen'}
              </button>
            )}
          </div>
        }
      />

      <ErrorBox error={error} />

      {/* 5 Interactive Executive KPI Cards */}
      <div className="team-kpi-grid cols-5">
        <div
          className={`team-kpi-card ${!filters.voterStatus && !filters.occupationCategory && !filters.isRetired ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={clearAllFilters}
          title={isMr ? 'सर्व नागरिक पाहण्यासाठी क्लिक करा' : 'Click to view all citizens'}
        >
          <div className="team-kpi-icon blue">
            <UsersIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiLoading ? '…' : Number(kpiStats.total || 0)}</div>
            <div className="team-kpi-label">{isMr ? 'एकूण नागरिक' : 'Total Citizens'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filters.voterStatus === 'VOTER' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() =>
            setFilters(f => ({
              ...f,
              voterStatus: f.voterStatus === 'VOTER' ? '' : 'VOTER',
              occupationCategory: '',
              isRetired: ''
            }))
          }
          title={isMr ? 'केवळ नोंदणीकृत मतदार पाहण्यासाठी क्लिक करा' : 'Click to filter verified voters'}
        >
          <div className="team-kpi-icon green">
            <UserCheckIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiLoading ? '…' : Number(kpiStats.voters || 0)}</div>
            <div className="team-kpi-label">{isMr ? 'नोंदणीकृत मतदार' : 'Verified Voters'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filters.voterStatus === 'NON_VOTER' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() =>
            setFilters(f => ({
              ...f,
              voterStatus: f.voterStatus === 'NON_VOTER' ? '' : 'NON_VOTER',
              occupationCategory: '',
              isRetired: ''
            }))
          }
          title={isMr ? 'केवळ अमतदार नागरिक पाहण्यासाठी क्लिक करा' : 'Click to filter non-voters'}
        >
          <div className="team-kpi-icon red">
            <UserXIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiLoading ? '…' : Number(kpiStats.nonVoters || 0)}</div>
            <div className="team-kpi-label">{isMr ? 'अमतदार नागरिक' : 'Non-Voters'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filters.occupationCategory === 'WORKING' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() =>
            setFilters(f => ({
              ...f,
              occupationCategory: f.occupationCategory === 'WORKING' ? '' : 'WORKING',
              voterStatus: '',
              isRetired: ''
            }))
          }
          title={isMr ? 'नोकरी किंवा व्यवसायातील नागरिक' : 'Click to filter working/business'}
        >
          <div className="team-kpi-icon purple">
            <BuildingIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiLoading ? '…' : Number(kpiStats.working || 0)}</div>
            <div className="team-kpi-label">{isMr ? 'नोकरी व व्यवसाय' : 'Working / Business'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filters.isRetired === 'true' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() =>
            setFilters(f => ({
              ...f,
              isRetired: f.isRetired === 'true' ? '' : 'true',
              voterStatus: '',
              occupationCategory: ''
            }))
          }
          title={isMr ? 'निवृत्त / ज्येष्ठ नागरिक' : 'Click to filter senior citizens'}
        >
          <div className="team-kpi-icon amber">
            <ClockIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiLoading ? '…' : Number(kpiStats.seniors || 0)}</div>
            <div className="team-kpi-label">{isMr ? 'ज्येष्ठ / निवृत्त' : 'Seniors & Retired'}</div>
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
                placeholder={isMr ? 'नाव, मोबाईल, व्यवसाय किंवा गाव शोधा…' : 'Search name, mobile, job or colony…'}
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
                value={filters.voterStatus}
                onChange={e => setFilters({ ...filters, voterStatus: e.target.value })}
                className="exec-filter-select"
              >
                <option value="">{isMr ? 'सर्व मतदार स्थिती' : 'All Voter Status'}</option>
                <option value="VOTER">{isMr ? '✓ मतदार' : '✓ Verified Voters'}</option>
                <option value="NON_VOTER">{isMr ? '✕ अमतदार' : '✕ Non-Voters'}</option>
                <option value="NOT_SPECIFIED">{isMr ? '? अनिर्णित' : '? Unspecified'}</option>
              </select>
            </div>

            <button
              type="button"
              className={`exec-filter-toggle-btn ${showFilters || advancedFiltersActiveCount > 0 ? 'active' : ''}`}
              onClick={() => setShowFilters(v => !v)}
              title={isMr ? 'अधिक फिल्टर्स उघडा/बंद करा' : 'Toggle more filters'}
            >
              <span>{isMr ? 'अधिक फिल्टर्स' : 'Filters'}</span>
              {advancedFiltersActiveCount > 0 && <span className="filter-badge">{advancedFiltersActiveCount}</span>}
              <span>{showFilters ? '▲' : '▼'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filter Drawer */}
      {showFilters && (
        <div className="citizen-advanced-filters">
          <SearchableSelect
            value={filters.presenceStatus}
            onChange={v => setFilters({ ...filters, presenceStatus: v })}
            options={PEOPLE_PLACE_OPTIONS}
            placeholder={isMr ? 'सध्याचे निवासस्थान' : 'Where now'}
          />
          <SearchableSelect
            value={filters.areaId}
            onChange={v => setFilters({ ...filters, areaId: v })}
            options={[{ value: '', label: isMr ? 'सर्व कॉलनी / परिसर' : 'All colonies' }, ...colonyOptions]}
            placeholder={isMr ? 'कॉलनी / परिसर' : 'Colony / Area'}
          />
          <SearchableSelect
            value={filters.gender}
            onChange={v => setFilters({ ...filters, gender: v })}
            options={[
              { value: '', label: isMr ? 'सर्व लिंग' : 'All genders' },
              { value: 'MALE', label: isMr ? 'पुरुष (Male)' : 'Male' },
              { value: 'FEMALE', label: isMr ? 'महिला (Female)' : 'Female' },
              { value: 'OTHER', label: isMr ? 'इतर (Other)' : 'Other' }
            ]}
            placeholder={isMr ? 'लिंग' : 'Gender'}
          />
          <SearchableSelect
            value={filters.ageGroup}
            onChange={v => setFilters({ ...filters, ageGroup: v })}
            options={[
              { value: '', label: isMr ? 'सर्व वयोगट' : 'All age groups' },
              { value: 'ADULT', label: isMr ? '१८+ प्रौढ नागरिक' : '18+ Adults' },
              { value: 'SENIOR', label: isMr ? '६०+ ज्येष्ठ नागरिक' : '60+ Senior citizens' },
              { value: 'YOUTH', label: isMr ? '१८ पेक्षा कमी' : 'Below 18' }
            ]}
            placeholder={isMr ? 'वयोगट' : 'Age group'}
          />
          <SearchableSelect
            value={filters.occupationType}
            onChange={v =>
              setFilters({
                ...filters,
                occupationType: v,
                employmentType: v === 'BUSINESS' || v === 'OTHER' || v === 'RETIRED' ? '' : filters.employmentType
              })
            }
            options={[
              { value: '', label: isMr ? 'सर्व व्यवसाय' : 'All occupations' },
              { value: 'BUSINESS', label: isMr ? 'व्यवसाय (Business)' : 'Business' },
              { value: 'SERVICE', label: isMr ? 'नोकरी (Service)' : 'Service' },
              { value: 'RETIRED', label: isMr ? 'निवृत्त (Retired)' : 'Retired' },
              { value: 'OTHER', label: isMr ? 'इतर / गृहिणी / विद्यार्थी' : 'Other / Homemaker / Student' }
            ]}
            placeholder={isMr ? 'व्यवसाय' : 'Occupation'}
          />
          <SearchableSelect
            value={filters.employmentType}
            onChange={v => setFilters({ ...filters, employmentType: v, occupationType: v ? 'SERVICE' : filters.occupationType })}
            options={[
              { value: '', label: isMr ? 'सरकारी / खाजगी' : 'Govt / Private' },
              { value: 'GOVERNMENT', label: isMr ? 'सरकारी नोकरी' : 'Government service' },
              { value: 'PRIVATE', label: isMr ? 'खाजगी नोकरी' : 'Private service' }
            ]}
            placeholder={isMr ? 'नोकरी प्रकार' : 'Service type'}
          />
          <button type="button" className="ghost-btn clear-filters-btn" onClick={clearAllFilters}>
            {isMr ? 'सर्व फिल्टर्स रीसेट करा' : 'Reset filters'}
          </button>
        </div>
      )}

      {/* Main Citizens Table */}
      {!rows ? (
        <Loading />
      ) : !rows.length ? (
        <Empty>
          {activeFiltersCount > 0
            ? isMr
              ? 'या फिल्टरनुसार कोणतेही नागरिक सापडले नाहीत.'
              : 'No citizens match the selected filters.'
            : isMr
            ? 'या वॉर्डमध्ये कोणतेही नागरिक सापडले नाहीत.'
            : 'No citizens found for the selected ward/search.'}
        </Empty>
      ) : (
        <div className="panel table-wrap citizens-table-wrap">
          <table className="citizens-table">
            <thead>
              <tr>
                <th>{isMr ? 'नागरिक' : 'Citizen'}</th>
                <th>{isMr ? 'घर आणि कुटुंब' : 'Residence & Family'}</th>
                <th>{isMr ? 'रहिवासी वॉर्ड' : 'Resident Ward'}</th>
                <th>{isMr ? 'व्यवसाय / नोकरी' : 'Occupation & Job'}</th>
                <th>{isMr ? 'मतदार पात्रता' : 'Voter Status'}</th>
                <th style={{ textAlign: 'center' }}>{isMr ? 'कृती' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => {
                const initials = getInitials(p.fullName);
                const wardNo = formatWardNumber(p.family?.house?.area?.ward?.wardNumber);
                const vStatus = p.voterProfile?.status || 'NOT_SPECIFIED';

                return (
                  <tr key={p.id}>
                    <td data-label="Citizen">
                      <div className="exec-cell-user">
                        <div
                          className={`exec-avatar ${vStatus === 'VOTER' ? 'green' : vStatus === 'NON_VOTER' ? 'blue' : 'amber'}`}
                          onClick={() => openPerson(p.id)}
                          style={{ cursor: 'pointer' }}
                          title={isMr ? 'तपशील पाहण्यासाठी क्लिक करा' : 'Click to view details'}
                        >
                          {initials}
                        </div>
                        <div className="exec-cell-meta">
                          <button
                            type="button"
                            onClick={() => openPerson(p.id)}
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
                            title={isMr ? 'तपशील पाहण्यासाठी क्लिक करा' : 'Click to view citizen profile'}
                          >
                            {p.fullName || '—'}
                          </button>
                          <span className="exec-cell-sub">
                            {p.age != null && <span>{p.age} yrs</span>}
                            {p.gender && <span>· {p.gender}</span>}
                            {p.mobile ? (
                              <>
                                <span>·</span>
                                <a href={`tel:${p.mobile}`} title="Click to call">
                                  <PhoneIcon size={11} style={{ display: 'inline', marginRight: '3px', verticalAlign: '-1px' }} />
                                  {p.mobile}
                                </a>
                              </>
                            ) : null}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td data-label="Residence & Family">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                          {p.family?.house?.houseNumber ? `House #${p.family.house.houseNumber}` : 'House N/A'}
                        </div>
                        <div className="muted" style={{ fontSize: '11.5px', marginTop: '1px' }}>
                          {p.family?.house?.area?.name || p.family?.familyName || 'Family unlinked'}
                        </div>
                        {hasCoords(p.family?.house?.latitude, p.family?.house?.longitude) ? (
                          <a
                            href={directionsUrl(p.family.house.latitude, p.family.house.longitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="voter-loc-dir-btn"
                            onClick={e => e.stopPropagation()}
                            title={isMr ? 'गुगल मॅप्सवर घराचा मार्ग / दिशा पहा' : 'Open driving directions to this house in Google Maps'}
                          >
                            <MapPinIcon size={11} />
                            <span>{isMr ? 'दिशा' : 'Directions'}</span>
                          </a>
                        ) : (
                          <span className="voter-loc-dir-empty" title={isMr ? 'घराचे अचूक जीपीएस स्थान उपलब्ध नाही' : 'GPS coordinates not saved'}>
                            <MapPinIcon size={10} style={{ opacity: 0.4 }} />
                            <span>{isMr ? 'पिन नाही' : 'No pin'}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td data-label="Resident Ward">
                      {wardNo ? (
                        <span className="ward-pill-badge">{wardNo}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>

                    <td data-label="Occupation & Job">
                      <div>
                        {p.isRetired || p.occupationType === 'RETIRED' ? (
                          <span className="prof-category-pill" style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#92400e' }}>
                            Retired (निवृत्त)
                          </span>
                        ) : p.occupationType === 'BUSINESS' ? (
                          <span className="prof-category-pill" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
                            Business
                          </span>
                        ) : p.occupationType === 'SERVICE' ? (
                          <span className="prof-category-pill" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e40af' }}>
                            Service · {p.employmentType || 'Private'}
                          </span>
                        ) : (
                          <span className="muted" style={{ fontSize: '12px' }}>
                            {p.occupation || 'Homemaker / Other'}
                          </span>
                        )}
                        {(p.businessName || p.companyName || p.retiredFrom) && (
                          <div className="muted" style={{ fontSize: '11px', marginTop: '2px', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.businessName || p.companyName || p.retiredFrom}>
                            {p.businessName || p.companyName || p.retiredFrom}
                          </div>
                        )}
                      </div>
                    </td>

                    <td data-label="Voter Status">
                      {vStatus === 'VOTER' ? (
                        <span className="voter-status-badge voter">
                          <CheckIcon size={12} />
                          <span>{isMr ? 'मतदार' : 'Voter'}</span>
                        </span>
                      ) : vStatus === 'NON_VOTER' ? (
                        <span className="voter-status-badge non-voter">
                          <span>✕</span>
                          <span>{isMr ? 'अमतदार' : 'Non-Voter'}</span>
                        </span>
                      ) : (
                        <span className="voter-status-badge not-specified">
                          <span>?</span>
                          <span>{isMr ? 'अस्पष्ट' : 'Not Specified'}</span>
                        </span>
                      )}
                    </td>

                    <td data-label="Actions" style={{ textAlign: 'center' }}>
                      <div className="exec-action-group" style={{ justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="exec-btn-view"
                          onClick={() => openPerson(p.id)}
                          title="View citizen details and family register"
                        >
                          <EyeIcon size={13} />
                          <span>{isMr ? 'तपशील' : 'View'}</span>
                        </button>

                        {can('EDIT_CITIZENS') && (
                          <button
                            type="button"
                            className="exec-btn-edit"
                            onClick={async () => {
                              try {
                                setError('');
                                const r = await api.person(p.id);
                                const row = r?.data || p;
                                setEdit({
                                  ...row,
                                  isRetired: !!row.isRetired,
                                  retiredFrom: row.retiredFrom || '',
                                  retiredService: row.retiredService || '',
                                  isVoter: row.voterProfile?.status === 'VOTER' ? 'VOTER' : row.voterProfile?.status === 'NON_VOTER' ? 'NON_VOTER' : '',
                                  officialVoterIdRef: row.voterProfile?.officialVoterIdRef || '',
                                  votingWard: row.voterProfile?.votingWard || '',
                                  constituency: row.voterProfile?.constituency || ''
                                });
                              } catch (e) {
                                setError(e.message);
                              }
                            }}
                            title={isMr ? 'नागरिक माहिती संपादित करा' : 'Edit citizen details'}
                          >
                            <EditIcon size={13} />
                            <span>{isMr ? 'संपादित करा' : 'Edit'}</span>
                          </button>
                        )}

                        <RowMenu
                          menuOnly
                          items={[
                            {
                              label: isMr ? 'तपशील पहा' : 'View profile details',
                              onClick: () => openPerson(p.id)
                            },
                            hasCoords(p.family?.house?.latitude, p.family?.house?.longitude) && {
                              label: isMr ? 'घराचा मार्ग (Google Maps)' : 'House directions (Google Maps)',
                              onClick: () => window.open(directionsUrl(p.family.house.latitude, p.family.house.longitude), '_blank', 'noopener,noreferrer')
                            },
                            can('CREATE_DEATH_RECORDS') && {
                              label: isMr ? 'मृत्यू नोंद करा' : 'Mark deceased',
                              danger: true,
                              onClick: () => setDeathPerson(p)
                            },
                            can('DELETE_CITIZENS') && {
                              label: isMr ? 'हटवा (रिसायकल बिन)' : 'Move to recycle bin',
                              danger: true,
                              onClick: async () => {
                                if (confirm('Move citizen to recycle bin?')) {
                                  try {
                                    await api.deletePerson(p.id);
                                    await load();
                                    await loadKpiStats();
                                  } catch (e) {
                                    setError(e.message);
                                  }
                                }
                              }
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

      {/* Citizen Profile Detail Modal */}
      {detail && (
        <Modal
          wide
          title={`${detail.fullName || 'Citizen'} · ${isMr ? 'संपूर्ण नागरिक प्रोफाइल' : 'Complete Citizen Profile'}`}
          onClose={() => setDetail(null)}
        >
          {/* Executive Header Banner */}
          <div className="exec-modal-profile-header">
            <div className="exec-modal-avatar">
              {getInitials(detail.fullName)}
            </div>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 700, color: '#0f172a' }}>
                  {detail.fullName || '—'}
                </h2>
                {detail.voterProfile?.status === 'VOTER' ? (
                  <span className="voter-status-badge voter">
                    <CheckIcon size={12} />
                    <span>{isMr ? '✓ नोंदणीकृत मतदार' : '✓ Verified Voter'}</span>
                  </span>
                ) : detail.voterProfile?.status === 'NON_VOTER' ? (
                  <span className="voter-status-badge non-voter">
                    <span>✕</span>
                    <span>{isMr ? 'अमतदार' : 'Non-Voter'}</span>
                  </span>
                ) : (
                  <span className="voter-status-badge not-specified">
                    <span>?</span>
                    <span>{isMr ? 'अनिर्णित मतदार' : 'Unspecified'}</span>
                  </span>
                )}

                {detail.isRetired || detail.occupationType === 'RETIRED' ? (
                  <span className="prof-category-pill" style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#92400e' }}>
                    🎖️ {isMr ? 'निवृत्त (Retired)' : 'Retired'}
                  </span>
                ) : detail.occupationType === 'BUSINESS' ? (
                  <span className="prof-category-pill" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
                    🏢 {isMr ? 'व्यवसाय (Business)' : 'Business'}
                  </span>
                ) : detail.occupationType === 'SERVICE' ? (
                  <span className="prof-category-pill" style={{ background: '#f0f9ff', borderColor: '#bae6fd', color: '#0369a1' }}>
                    💼 {isMr ? 'नोकरी (Service)' : 'Service'}
                  </span>
                ) : null}

                {detail.family?.house?.area?.ward?.wardNumber && (
                  <span className="ward-pill-badge">
                    {formatWardNumber(detail.family.house.area.ward.wardNumber)}
                  </span>
                )}
              </div>

              {/* Quick Contact & Details Ribbon */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', fontSize: '12.5px', color: '#475569', flexWrap: 'wrap' }}>
                {detail.age != null && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <strong>{detail.age}</strong> {isMr ? 'वर्षे' : 'years'} {detail.gender ? `· ${detail.gender}` : ''}
                  </span>
                )}

                {detail.mobile && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <PhoneIcon size={12} style={{ color: '#0f766e' }} />
                    <a href={`tel:${detail.mobile}`} style={{ color: '#0f766e', fontWeight: 600, textDecoration: 'none' }}>
                      {detail.mobile}
                    </a>
                  </span>
                )}

                {detail.email && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span>✉️</span>
                    <a href={`mailto:${detail.email}`} style={{ color: '#0284c7', textDecoration: 'none' }}>
                      {detail.email}
                    </a>
                  </span>
                )}

                {presenceLine(detail) && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#e2e8f0', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                    {presenceLine(detail)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="exec-detail-grid">
            {/* Card 1: Personal Demographics */}
            <div className="exec-detail-card">
              <h3>
                <UsersIcon size={14} style={{ color: '#0f766e' }} />
                <span>{isMr ? 'व्यक्तिगत व कुटुंब माहिती' : 'Personal Demographics'}</span>
              </h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'पूर्ण नाव' : 'Full Name'}</span>
                <span className="exec-detail-val">{detail.fullName || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'जन्मतारीख व वय' : 'DOB & Age'}</span>
                <span className="exec-detail-val">
                  {detail.dob || '—'} {detail.age != null ? `(${detail.age} ${isMr ? 'वर्षे' : 'yrs'})` : ''}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'लिंग' : 'Gender'}</span>
                <span className="exec-detail-val">{detail.gender || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'सध्याची उपस्थिती' : 'Current Presence'}</span>
                <span className="exec-detail-val">{presenceLine(detail) || (isMr ? 'घरी उपस्थित' : 'At Home')}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'मूळ गाव / परिसर' : 'Native Village'}</span>
                <span className="exec-detail-val">{nativePlaceLine(detail.family) || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'प्राथमिक मोबाईल' : 'Primary Mobile'}</span>
                <span className="exec-detail-val">
                  {detail.mobile ? (
                    <a href={`tel:${detail.mobile}`} style={{ color: '#0f766e', textDecoration: 'none', fontWeight: 600 }}>
                      {detail.mobile}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              {detail.alternateMobile && (
                <div className="exec-detail-row">
                  <span className="exec-detail-label">{isMr ? 'पर्यायी मोबाईल' : 'Alternate Mobile'}</span>
                  <span className="exec-detail-val">
                    <a href={`tel:${detail.alternateMobile}`} style={{ color: '#0f766e', textDecoration: 'none', fontWeight: 600 }}>
                      {detail.alternateMobile}
                    </a>
                  </span>
                </div>
              )}
            </div>

            {/* Card 2: Occupation & Work Profile */}
            <div className="exec-detail-card">
              <h3>
                <BuildingIcon size={14} style={{ color: '#0f766e' }} />
                <span>{isMr ? 'व्यवसाय व नोकरी तपशील' : 'Occupation & Work Profile'}</span>
              </h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'व्यवसाय प्रकार' : 'Occupation Type'}</span>
                <span className="exec-detail-val">
                  {detail.isRetired || detail.occupationType === 'RETIRED'
                    ? (isMr ? 'निवृत्त (Retired)' : 'Retired')
                    : detail.occupationType || detail.occupation || '—'}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'हुद्दा / पद' : 'Role / Occupation'}</span>
                <span className="exec-detail-val">{detail.occupation || '—'}</span>
              </div>
              {detail.occupationType === 'BUSINESS' ? (
                <>
                  <div className="exec-detail-row">
                    <span className="exec-detail-label">{isMr ? 'व्यवसाय / फर्मचे नाव' : 'Business Name'}</span>
                    <span className="exec-detail-val">{detail.businessName || '—'}</span>
                  </div>
                  <div className="exec-detail-row">
                    <span className="exec-detail-label">{isMr ? 'व्यवसायाचा पत्ता' : 'Business Address'}</span>
                    <span className="exec-detail-val">{detail.businessAddress || '—'}</span>
                  </div>
                </>
              ) : detail.occupationType === 'SERVICE' ? (
                <>
                  <div className="exec-detail-row">
                    <span className="exec-detail-label">{isMr ? 'कंपनी / खाते' : 'Company / Dept'}</span>
                    <span className="exec-detail-val">{detail.companyName || '—'}</span>
                  </div>
                  <div className="exec-detail-row">
                    <span className="exec-detail-label">{isMr ? 'नोकरीचे क्षेत्र' : 'Employment Type'}</span>
                    <span className="exec-detail-val">
                      {detail.employmentType === 'GOVERNMENT'
                        ? (isMr ? 'सरकारी नोकरी (Govt)' : 'Government Service')
                        : detail.employmentType === 'PRIVATE'
                        ? (isMr ? 'खाजगी नोकरी (Private)' : 'Private Sector')
                        : detail.employmentType || '—'}
                    </span>
                  </div>
                </>
              ) : detail.isRetired || detail.occupationType === 'RETIRED' ? (
                <>
                  <div className="exec-detail-row">
                    <span className="exec-detail-label">{isMr ? 'निवृत्ती विभाग' : 'Retired From'}</span>
                    <span className="exec-detail-val">{detail.retiredFrom || '—'}</span>
                  </div>
                  <div className="exec-detail-row">
                    <span className="exec-detail-label">{isMr ? 'माजी हुद्दा' : 'Service / Role'}</span>
                    <span className="exec-detail-val">{detail.retiredService || '—'}</span>
                  </div>
                </>
              ) : (
                <div className="exec-detail-row">
                  <span className="exec-detail-label">{isMr ? 'तपशील' : 'Occupation Note'}</span>
                  <span className="exec-detail-val">{detail.occupation || (isMr ? 'गृहिणी / विद्यार्थी / इतर' : 'Homemaker / Student / Other')}</span>
                </div>
              )}
              {detail.notes && (
                <div className="exec-detail-row">
                  <span className="exec-detail-label">{isMr ? 'विशेष नोंद' : 'Notes'}</span>
                  <span className="exec-detail-val">{detail.notes}</span>
                </div>
              )}
            </div>

            {/* Card 3: Residence & Household Information */}
            <div className="exec-detail-card">
              <h3>
                <MapPinIcon size={14} style={{ color: '#0f766e' }} />
                <span>{isMr ? 'घर व रहिवासी पत्ता' : 'Residence & Family House'}</span>
              </h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'कुटुंबाचे नाव' : 'Family Name'}</span>
                <span className="exec-detail-val">{detail.family?.familyName || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'घर क्रमांक' : 'House Number'}</span>
                <span className="exec-detail-val">
                  {detail.family?.house?.houseNumber ? `#${detail.family.house.houseNumber}` : '—'}
                </span>
              </div>
              {detail.family?.house?.apartment?.name && (
                <div className="exec-detail-row">
                  <span className="exec-detail-label">{isMr ? 'इमारत / अपार्टमेंट' : 'Apartment / Bldg'}</span>
                  <span className="exec-detail-val">{detail.family.house.apartment.name}</span>
                </div>
              )}
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'कॉलनी / परिसर' : 'Colony / Area'}</span>
                <span className="exec-detail-val">{detail.family?.house?.area?.name || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'रहिवासी प्रभाग' : 'Resident Ward'}</span>
                <span className="exec-detail-val">
                  <span className="ward-pill-badge">
                    {formatWardNumber(detail.family?.house?.area?.ward?.wardNumber) || '—'}
                  </span>
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'संपूर्ण पत्ता' : 'Address'}</span>
                <span className="exec-detail-val">{detail.family?.house?.address || '—'}</span>
              </div>
              {hasCoords(detail.family?.house?.latitude, detail.family?.house?.longitude) && (
                <>
                  <div className="exec-detail-row">
                    <span className="exec-detail-label">{isMr ? 'जीपीएस स्थान' : 'GPS Coordinates'}</span>
                    <span className="exec-detail-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>
                        {Number(detail.family.house.latitude).toFixed(5)}, {Number(detail.family.house.longitude).toFixed(5)}
                      </span>
                      <a
                        href={directionsUrl(detail.family.house.latitude, detail.family.house.longitude)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="voter-loc-dir-btn"
                        style={{ marginTop: 0 }}
                        title="Open Google Maps directions"
                      >
                        <MapPinIcon size={11} />
                        <span>{isMr ? 'मार्ग' : 'Directions'}</span>
                      </a>
                    </span>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <MapPreview
                      lat={detail.family.house.latitude}
                      lng={detail.family.house.longitude}
                      label={`House #${detail.family.house.houseNumber || ''}`}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Card 4: Voter Details */}
            <div className="exec-detail-card">
              <h3>
                <ShieldIcon size={14} style={{ color: '#0f766e' }} />
                <span>{isMr ? 'मतदार नोंदणी व यादी माहिती' : 'Voter Registration Status'}</span>
              </h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'मतदार स्थिती' : 'Voter Status'}</span>
                <span className="exec-detail-val">
                  {detail.voterProfile?.status === 'VOTER'
                    ? (isMr ? '✓ नोंदणीकृत मतदार' : 'Verified Registered Voter')
                    : detail.voterProfile?.status === 'NON_VOTER'
                    ? (isMr ? '✕ अमतदार' : 'Non-Voter')
                    : (isMr ? '? अनिर्णित' : 'Not Specified')}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'अधिकृत मतदार ओळखपत्र' : 'Official Voter ID'}</span>
                <span className="exec-detail-val">
                  {detail.voterProfile?.officialVoterIdRef ? (
                    <span className="epic-id-badge">{detail.voterProfile.officialVoterIdRef}</span>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'मतदान प्रभाग' : 'Voting Ward'}</span>
                <span className="exec-detail-val">
                  {detail.voterProfile?.votingWard ? (
                    <span className="ward-pill-badge">{formatWardNumber(detail.voterProfile.votingWard)}</span>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'विधानसभा मतदारसंघ' : 'Constituency'}</span>
                <span className="exec-detail-val">{detail.voterProfile?.constituency || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'मतदान केंद्र' : 'Polling Center'}</span>
                <span className="exec-detail-val">{detail.voterProfile?.voterCenter || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'बूथ क्रमांक' : 'Booth Number'}</span>
                <span className="exec-detail-val">{detail.voterProfile?.boothNumber || '—'}</span>
              </div>
            </div>
          </div>

          {/* Household Members */}
          {detail.family?.members?.length > 0 && (
            <div className="exec-detail-card" style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1.5px solid #e2e8f0', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, padding: 0, border: 'none' }}>
                  <UsersIcon size={14} style={{ color: '#0f766e' }} />
                  <span>{isMr ? `एकाच घरातील कुटुंबीय (${detail.family.members.length})` : `Family Members in Same House (${detail.family.members.length})`}</span>
                </h3>
                <span className="muted" style={{ fontSize: '11px' }}>
                  {isMr ? 'तपशील पाहण्यासाठी सदस्यावर क्लिक करा' : 'Click a member to view profile'}
                </span>
              </div>
              <div className="member-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                {detail.family.members.map(m => {
                  const isCurrent = m.id === detail.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => !isCurrent && openPerson(m.id)}
                      className={`member-card ${isCurrent ? 'current-member' : ''}`}
                      style={{
                        padding: '10px 12px',
                        background: isCurrent ? '#f0fdfa' : '#f8fafc',
                        border: isCurrent ? '1.5px solid #0f766e' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        cursor: isCurrent ? 'default' : 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      title={isCurrent ? 'Currently viewing' : 'Click to view citizen'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <strong style={{ fontSize: '13px', color: isCurrent ? '#0f766e' : '#0f172a' }}>
                          {m.fullName} {isCurrent && <span style={{ fontSize: '10px', color: '#0f766e' }}>({isMr ? 'सध्याचे' : 'Current'})</span>}
                        </strong>
                        {m.voterProfile?.status === 'VOTER' ? (
                          <span style={{ fontSize: '10.5px', color: '#059669', fontWeight: 700 }}>✓ Voter</span>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#64748b' }}>Non-Voter</span>
                        )}
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {[m.age != null ? `${m.age} yrs` : null, m.gender].filter(Boolean).join(' · ') || 'Family member'}
                      </span>
                      {m.mobile && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                          <span style={{ fontSize: '11px', color: '#0f766e', fontWeight: 600 }}>
                            📞 {m.mobile}
                          </span>
                          <a
                            href={`tel:${m.mobile}`}
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: '10.5px', color: '#0f766e', textDecoration: 'none', background: '#ecfdf5', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}
                          >
                            Call
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Uploaded Documents */}
          {(() => {
            const vDoc = detail.documents?.find(d => d.docType === 'VOTER_ID')?.content || detail.voterIdImage;
            const aDoc = detail.documents?.find(d => d.docType === 'AADHAAR')?.content || detail.aadhaarImage;
            const pDoc = detail.documents?.find(d => d.docType === 'PAN')?.content || detail.panCardImage;
            const hasAnyDocs = Boolean(vDoc || aDoc || pDoc);

            return (
              <div className="exec-detail-card" style={{ marginBottom: '18px' }}>
                <h3>
                  <CalendarIcon size={14} style={{ color: '#0f766e' }} />
                  <span>{isMr ? 'ओळखपत्रे व कागदपत्रे' : 'Identity Documents'}</span>
                </h3>
                {hasAnyDocs ? (
                  <div className="image-grid" style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {vDoc && (
                      <div
                        style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#f8fafc', cursor: 'pointer' }}
                        onClick={() => setLightboxImg({ src: vDoc, title: 'Voter ID' })}
                        title="Click to enlarge"
                      >
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Voter ID</span>
                          <span style={{ fontSize: '10px', color: '#0f766e' }}>🔍 Enlarge</span>
                        </div>
                        <img src={vDoc} alt="Voter ID" style={{ maxHeight: '110px', maxWidth: '180px', borderRadius: '6px', objectFit: 'cover' }} />
                      </div>
                    )}
                    {aDoc && (
                      <div
                        style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#f8fafc', cursor: 'pointer' }}
                        onClick={() => setLightboxImg({ src: aDoc, title: 'Aadhaar Card' })}
                        title="Click to enlarge"
                      >
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Aadhaar</span>
                          <span style={{ fontSize: '10px', color: '#0f766e' }}>🔍 Enlarge</span>
                        </div>
                        <img src={aDoc} alt="Aadhaar" style={{ maxHeight: '110px', maxWidth: '180px', borderRadius: '6px', objectFit: 'cover' }} />
                      </div>
                    )}
                    {pDoc && (
                      <div
                        style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#f8fafc', cursor: 'pointer' }}
                        onClick={() => setLightboxImg({ src: pDoc, title: 'PAN Card' })}
                        title="Click to enlarge"
                      >
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>PAN Card</span>
                          <span style={{ fontSize: '10px', color: '#0f766e' }}>🔍 Enlarge</span>
                        </div>
                        <img src={pDoc} alt="PAN" style={{ maxHeight: '110px', maxWidth: '180px', borderRadius: '6px', objectFit: 'cover' }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: '12.5px', margin: '4px 0' }}>
                    {isMr ? 'या नागरिकासाठी कोणतीही ओळखपत्रे अपलोड केलेली नाहीत.' : 'No identity documents uploaded for this citizen.'}
                  </p>
                )}
              </div>
            );
          })()}

          <div className="exec-modal-footer">
            <button type="button" className="exec-modal-btn ghost" onClick={() => setDetail(null)}>
              {isMr ? 'बंद करा' : 'Close'}
            </button>
            {hasCoords(detail.family?.house?.latitude, detail.family?.house?.longitude) && (
              <a
                href={directionsUrl(detail.family.house.latitude, detail.family.house.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="exec-modal-btn dir"
                title={isMr ? 'गुगल मॅप्सवर घराचा मार्ग / दिशा पहा' : 'Get driving directions to this house in Google Maps'}
              >
                <MapPinIcon size={14} />
                <span>{isMr ? 'घराचा मार्ग पहा' : 'Get House Directions'}</span>
              </a>
            )}
            {can('CREATE_DEATH_RECORDS') && (
              <button
                type="button"
                className="exec-modal-btn danger"
                onClick={() => {
                  setDeathPerson(detail);
                  setDetail(null);
                }}
                title="Record death"
              >
                <span>{isMr ? 'मृत्यू नोंद करा' : 'Mark Deceased'}</span>
              </button>
            )}
            {can('EDIT_CITIZENS') && (
              <button
                type="button"
                className="exec-modal-btn primary"
                onClick={() => {
                  setEdit({
                    ...detail,
                    isRetired: !!detail.isRetired,
                    retiredFrom: detail.retiredFrom || '',
                    retiredService: detail.retiredService || '',
                    isVoter:
                      detail.voterProfile?.status === 'VOTER'
                        ? 'VOTER'
                        : detail.voterProfile?.status === 'NON_VOTER'
                        ? 'NON_VOTER'
                        : '',
                    officialVoterIdRef: detail.voterProfile?.officialVoterIdRef || '',
                    votingWard: detail.voterProfile?.votingWard || '',
                    constituency: detail.voterProfile?.constituency || ''
                  });
                  setDetail(null);
                }}
              >
                <EditIcon size={14} />
                <span>{isMr ? 'प्रोफाइल संपादित करा' : 'Edit Profile'}</span>
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Document Lightbox Modal */}
      {lightboxImg && (
        <Modal
          title={lightboxImg.title || 'Document Preview'}
          onClose={() => setLightboxImg(null)}
        >
          <div style={{ textAlign: 'center', padding: '12px' }}>
            <img
              src={lightboxImg.src}
              alt={lightboxImg.title}
              style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
            />
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <a
                href={lightboxImg.src}
                download={`${lightboxImg.title || 'document'}.png`}
                className="btn btn-secondary"
                target="_blank"
                rel="noreferrer"
              >
                Download
              </a>
              <button
                type="button"
                className="primary-btn"
                onClick={() => setLightboxImg(null)}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit / Add Citizen Modal */}
      {(edit || add) && (
        <Modal
          wide
          title={edit ? `Edit ${edit.fullName}` : isMr ? 'नवीन नागरिक जोडा' : 'Add Citizen'}
          onClose={() => {
            setEdit(null);
            setAdd(null);
          }}
        >
          <PersonForm
            value={edit || add}
            onChange={edit ? setEdit : setAdd}
            families={wardFamilies}
            wards={wards}
            onSubmit={save}
            onCancel={() => {
              setEdit(null);
              setAdd(null);
            }}
            busy={busy}
          />
        </Modal>
      )}

      {/* Mark Deceased Modal */}
      {deathPerson && (
        <DeathAction
          trigger={false}
          person={deathPerson}
          onSaved={load}
          onClose={() => setDeathPerson(null)}
        />
      )}
    </div>
  );
}
