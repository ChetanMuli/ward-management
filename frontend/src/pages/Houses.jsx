import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
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
import { filterByWard, useWardFilter } from '../wardFilter';
import { can, canModule, isNagarsevak, isEmployee } from '../rbac';
import { directionsUrl, geoPayload, hasCoords, housePlace, isFlatHome } from '../location';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import LocationPicker, { MapPreview } from '../components/LocationMap';
import { getLanguage } from '../language';
import {
  HomeIcon,
  BuildingIcon,
  UsersIcon,
  MapPinIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  SearchIcon,
  FileTextIcon
} from '../components/Icons';

const blank = {
  houseNumber: '',
  wardId: '',
  areaId: '',
  apartmentId: '',
  dwelling: 'INDEPENDENT',
  address: '',
  landmark: '',
  city: '',
  houseType: 'INDEPENDENT_HOUSE',
  ownership: 'OWN',
  ownerName: '',
  ownerMobile: '',
  latitude: '',
  longitude: '',
  notes: ''
};

const emptyApartment = {
  name: '',
  wardId: '',
  areaId: '',
  floors: '',
  address: '',
  landmark: '',
  latitude: '',
  longitude: ''
};

function ownershipLabel(v, isMr = false) {
  if (v === 'OWN') return isMr ? 'स्वतःची जागा (Own)' : 'Own';
  if (v === 'RENT') return isMr ? 'भाड्याने (Rent)' : 'Rent';
  if (v === 'OTHER') return isMr ? 'इतर (Other)' : 'Other';
  return '—';
}

function houseTypeLabel(type, isMr = false) {
  if (!type) return '—';
  const t = String(type).toUpperCase();
  if (t === 'INDEPENDENT_HOUSE') return isMr ? 'स्वतंत्र घर' : 'Independent House';
  if (t === 'FLAT') return isMr ? 'फ्लॅट' : 'Apartment Flat';
  if (t === 'CHAWL') return isMr ? 'चाळ' : 'Chawl';
  if (t === 'BUNGALOW') return isMr ? 'बंगला' : 'Bungalow';
  if (t === 'ROW_HOUSE') return isMr ? 'रो हाऊस' : 'Row House';
  return type.replaceAll('_', ' ');
}

function doorLabel(house, isFlat, isMr = false) {
  const raw = String(house?.houseNumber || '').trim();
  if (!raw) return isFlat ? (isMr ? 'फ्लॅट' : 'Flat') : isMr ? 'घर' : 'House';
  if (/^(flat|फ्लॅट|house|घर|plot|प्लॉट)\b/i.test(raw)) return raw;
  return isFlat ? (isMr ? `फ्लॅट ${raw}` : `Flat ${raw}`) : isMr ? `घर ${raw}` : `House ${raw}`;
}

function houseAddressText(house) {
  const addr = String(house?.address || '').trim();
  const landmark = String(house?.landmark || '').trim();
  if (addr && landmark && !addr.toLowerCase().includes(landmark.toLowerCase())) {
    return `${addr} · ${landmark}`;
  }
  return addr || landmark || '';
}

export default function Houses() {
  const navigate = useNavigate();
  const { selectedWardId } = useWardFilter();
  const isMr = getLanguage() === 'mr';
  const [searchParams] = useSearchParams();

  const [rows, setRows] = useState(null);
  const [wards, setWards] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    ownership: '',
    homeKind: '',
    areaId: ''
  });

  const [edit, setEdit] = useState(null);
  const [add, setAdd] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [listTotal, setListTotal] = useState(0);
  const [houseLoc, setHouseLoc] = useState(null);
  const [busyLoc, setBusyLoc] = useState(false);

  const [apartmentForm, setApartmentForm] = useState(null);
  const [busyApt, setBusyApt] = useState(false);

  const canAdd = can('CREATE_HOUSES') || canModule('HOUSES', 'CREATE') || isNagarsevak() || isEmployee();
  const canAddApt = canAdd || can('EDIT_WARDS') || canModule('WARDS', 'EDIT');
  const canPin = can('EDIT_HOUSES') || canModule('HOUSES', 'EDIT') || can('CREATE_HOUSES') || isNagarsevak() || isEmployee();

  async function load() {
    try {
      setError('');
      const res = await api.houses({
        page,
        limit: pageSize,
        search: filters.search || undefined,
        ownership: filters.ownership || undefined,
        homeKind: filters.homeKind || undefined,
        areaId: filters.areaId || undefined,
        apartmentId: searchParams.get('apartmentId') || undefined,
        wardId: selectedWardId || undefined
      });
      setRows(res.data || []);
      setListTotal(Number(res.meta?.total) || 0);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadPlaces() {
    try {
      const [w, a] = await Promise.all([api.wards(), api.apartments()]);
      setWards(w.data || []);
      setApartments(a.data || []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
  }, [selectedWardId, filters.search, filters.ownership, filters.homeKind, filters.areaId, page, pageSize, searchParams]);

  useEffect(() => {
    loadPlaces();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [selectedWardId, filters.search, filters.ownership, filters.homeKind, filters.areaId]);

  const wardScopedRows = useMemo(() => filterByWard(rows || [], selectedWardId), [rows, selectedWardId]);

  const kpiStats = useMemo(() => {
    const total = wardScopedRows.length;
    const houses = wardScopedRows.filter(h => !isFlatHome(h)).length;
    const flats = wardScopedRows.filter(isFlatHome).length;
    const rented = wardScopedRows.filter(h => h.ownership === 'RENT').length;
    const owned = wardScopedRows.filter(h => h.ownership === 'OWN').length;
    return { total, houses, flats, rented, owned };
  }, [wardScopedRows]);

  const visible = wardScopedRows;
  const total = listTotal || visible.length;
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const currentPage = Math.min(page, pages);
  const pageRows = visible;

  const wardOptions = wards.map(w => ({ value: w.id, label: formatWardLabel(w) }));
  const colonyFilterOptions = (
    selectedWardId
      ? wards.find(w => String(w.id) === String(selectedWardId))?.areas || []
      : wards.flatMap(w => w.areas || [])
  ).map(a => ({ id: a.id, name: a.name }));

  const form = edit || add;
  const formWardId = form?.wardId || form?.area?.wardId || form?.area?.ward?.id || '';
  const formAreas = (
    formWardId
      ? wards.find(w => String(w.id) === String(formWardId))?.areas || []
      : wards.flatMap(w => (w.areas || []).map(a => ({ ...a, wardNumber: w.wardNumber })))
  ).map(a => ({
    value: a.id,
    label: a.name,
    hint: !formWardId && a.wardNumber ? formatWardNumber(a.wardNumber) : ''
  }));

  function pickArea(v) {
    let wId = formWardId;
    if (!wId && v) {
      const pW = wards.find(w => (w.areas || []).some(a => String(a.id) === String(v)));
      if (pW) wId = pW.id;
    }
    changeForm({ ...form, areaId: v, wardId: wId || form?.wardId });
  }

  const selectedArea = (wards.find(w => String(w.id) === String(formWardId))?.areas || []).find(
    a => String(a.id) === String(form?.areaId)
  );
  const selectedWard = wards.find(w => String(w.id) === String(formWardId));
  const openedApt = useRef('');
  const wardApartments = apartments.filter(a => {
    if (!formWardId) return true;
    return String(a.wardId || a.ward?.id || a.area?.wardId || '') === String(formWardId);
  });

  useEffect(() => {
    const apt = searchParams.get('apartmentId');
    if (!apt || add || edit) return;
    if (openedApt.current === String(apt)) return;
    const found = apartments.find(a => String(a.id) === String(apt));
    if (!found) return;
    openedApt.current = String(apt);
    setAdd({
      ...blank,
      dwelling: 'APARTMENT',
      houseType: 'FLAT',
      wardId: found.wardId || found.ward?.id || '',
      areaId: found.areaId,
      apartmentId: found.id
    });
  }, [apartments, searchParams, add, edit]);

  function pickApartment(id, base = form) {
    const apt = apartments.find(x => String(x.id) === String(id));
    return {
      ...base,
      dwelling: 'APARTMENT',
      houseType: 'FLAT',
      apartmentId: id,
      wardId: apt?.wardId || apt?.ward?.id || base.wardId,
      areaId: apt?.areaId || base.areaId
    };
  }

  function openAdd() {
    const apt = searchParams.get('apartmentId');
    const found = apartments.find(a => String(a.id) === String(apt));
    if (found) setAdd(pickApartment(found.id, { ...blank, city: '' }));
    else
      setAdd({
        ...blank,
        wardId: selectedWardId || '',
        dwelling: filters.homeKind === 'flat' ? 'APARTMENT' : 'INDEPENDENT',
        houseType: filters.homeKind === 'flat' ? 'FLAT' : 'INDEPENDENT_HOUSE'
      });
  }

  function openAddApartment(fromForm = false) {
    const src = fromForm ? form : null;
    setApartmentForm({
      ...emptyApartment,
      fromForm: !!fromForm,
      wardId: src?.wardId || selectedWardId || '',
      areaId: src?.areaId || ''
    });
  }

  function openEdit(h) {
    setEdit({
      ...blank,
      ...h,
      dwelling: h.apartmentId || h.apartment?.id ? 'APARTMENT' : 'INDEPENDENT',
      houseType: h.apartmentId || h.apartment?.id ? 'FLAT' : h.houseType || 'INDEPENDENT_HOUSE',
      wardId: h.area?.wardId || h.area?.ward?.id || '',
      apartmentId: h.apartmentId || h.apartment?.id || '',
      latitude: hasCoords(h.latitude, h.longitude) ? h.latitude ?? '' : '',
      longitude: hasCoords(h.latitude, h.longitude) ? h.longitude ?? '' : '',
      city: h.city || ''
    });
  }

  function changeForm(next) {
    if (edit) setEdit(next);
    else setAdd(next);
  }

  async function saveApartment(e) {
    e.preventDefault();
    if (!apartmentForm) return;
    setBusyApt(true);
    try {
      const saved = (
        await api.createApartment({
          name: apartmentForm.name,
          areaId: apartmentForm.areaId,
          floors: apartmentForm.floors || null,
          address: apartmentForm.address || null,
          landmark: apartmentForm.landmark || null,
          ...geoPayload(apartmentForm, ['latitude', 'longitude'])
        })
      ).data;
      const fromForm = apartmentForm.fromForm;
      const nextHouse = {
        ...(edit || add || blank),
        dwelling: 'APARTMENT',
        houseType: 'FLAT',
        apartmentId: saved?.id || '',
        wardId: saved?.wardId || apartmentForm.wardId,
        areaId: saved?.areaId || apartmentForm.areaId
      };
      setApartmentForm(null);
      await loadPlaces();
      if (fromForm && saved?.id) changeForm(nextHouse);
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'success',
            message: isMr ? 'अपार्टमेंट यशस्वीरित्या नोंदवले.' : 'Apartment registered successfully.'
          }
        })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyApt(false);
    }
  }

  function openHouseLoc(h, fromDetail = false) {
    if (!h) return;
    setHouseLoc({
      id: h.id,
      houseNumber: h.houseNumber,
      latitude: hasCoords(h.latitude, h.longitude) ? h.latitude : '',
      longitude: hasCoords(h.latitude, h.longitude) ? h.longitude : '',
      area: h.area || null,
      fromDetail
    });
    if (fromDetail) setDetail(null);
  }

  async function saveHouseLoc(e) {
    e.preventDefault();
    if (!houseLoc?.id) return;
    if (!hasCoords(houseLoc.latitude, houseLoc.longitude)) {
      setError(isMr ? 'कृपया Use GPS दाबा किंवा नकाशावर टॅप करून अचूक स्थान सेट करा.' : 'Use GPS or tap the map to set the exact door pin before saving.');
      return;
    }
    setBusyLoc(true);
    try {
      await api.updateHouse(houseLoc.id, geoPayload(houseLoc, ['latitude', 'longitude']));
      const id = houseLoc.id;
      const reopen = houseLoc.fromDetail;
      setHouseLoc(null);
      await load();
      if (reopen) setDetail((await api.house(id)).data);
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'success',
            message: isMr ? 'घराचे जीपीएस स्थान यशस्वीरित्या अद्यतनित केले.' : 'House GPS location updated.'
          }
        })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyLoc(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    try {
      const isFlat = form.dwelling === 'APARTMENT' || form.houseType === 'FLAT';
      if (isFlat && !form.apartmentId) {
        throw new Error(isMr ? 'कृपया हा फ्लॅट ज्या इमारतीचा/अपार्टमेंटचा आहे ते निवडा.' : 'Select the apartment this flat belongs to.');
      }
      if (!form.areaId) {
        throw new Error(isMr ? 'कृपया कॉलनी / परिसर निवडा.' : 'Please select a colony / area.');
      }
      const payload = {
        houseNumber: form.houseNumber?.trim(),
        areaId: form.areaId,
        apartmentId: isFlat ? form.apartmentId || null : null,
        address: form.address?.trim(),
        landmark: form.landmark?.trim() || null,
        houseType: isFlat ? 'FLAT' : form.houseType || 'INDEPENDENT_HOUSE',
        ownership: form.ownership || 'OWN',
        ownerName: form.ownerName?.trim() || null,
        ownerMobile: form.ownerMobile?.trim() || null,
        notes: form.notes?.trim() || null,
        ...geoPayload(form, ['city', 'latitude', 'longitude'])
      };
      let saved = null;
      if (edit) {
        saved = (await api.updateHouse(edit.id, payload)).data;
        window.dispatchEvent(
          new CustomEvent('ward:toast', {
            detail: {
              type: 'success',
              message: isMr ? 'घराची माहिती अद्यतनित केली.' : 'House updated successfully.'
            }
          })
        );
      } else {
        saved = (await api.createHouse(payload)).data;
        window.dispatchEvent(
          new CustomEvent('ward:toast', {
            detail: {
              type: 'success',
              message: isMr ? 'नवीन घर / फ्लॅट यशस्वीरित्या जोडले.' : 'House / flat created successfully.'
            }
          })
        );
      }

      const inApt = !!payload.apartmentId;
      setEdit(null);
      setAdd(null);
      await load();

      if (
        !edit &&
        saved?.id &&
        (can('CREATE_FAMILIES') || isNagarsevak() || isEmployee()) &&
        window.confirm(
          isMr
            ? inApt
              ? 'फ्लॅट जतन केला आहे. या फ्लॅटमध्ये राहणारे कुटुंब आता जोडायचे का?'
              : 'घर जतन केले आहे. या घरात राहणारे कुटुंब आता जोडायचे का?'
            : inApt
            ? 'Flat saved in this apartment. Add a family who lives here now?'
            : 'House saved. Add a family who lives here now?'
        )
      ) {
        navigate(`/families?houseId=${saved.id}`);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="admin-data-page houses-page" style={{ paddingTop: '8px' }}>
      <PageHeader
        kicker={isMr ? 'गृह व निवास नोंदणी' : 'Residential Properties & Household Units'}
        title={isMr ? 'घरे व इमारती (Houses)' : 'Houses'}
        subtitle={
          isMr
            ? 'वॉर्डमधील सर्व स्वतंत्र घरे, निवासी इमारती, अपार्टमेंट्स, फ्लॅट्स, मालक व जीपीएस पत्ते व्यवस्थापित करा.'
            : 'Audit household dwellings, apartment towers, door numbers, premise ownership, and Google Maps GPS navigation.'
        }
        action={
          canAdd || canAddApt ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {canAddApt && (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => openAddApartment(false)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <BuildingIcon size={14} />
                  <span>{isMr ? 'इमारत जोडा' : 'Add Apartment'}</span>
                </button>
              )}
              {canAdd && (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={openAdd}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <span>+</span>
                  <span>{isMr ? 'घर / फ्लॅट जोडा' : 'Add House'}</span>
                </button>
              )}
            </div>
          ) : null
        }
      />

      <ErrorBox error={error} />

      {/* 4 Interactive KPI Metric Cards - 1 Single Row */}
      <div className="team-kpi-grid">
        <div
          className={`team-kpi-card ${!filters.homeKind && !filters.ownership ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setFilters(f => ({ ...f, homeKind: '', ownership: '' }))}
          title={isMr ? 'सर्व घरे पाहण्यासाठी क्लिक करा' : 'Click to view all dwellings'}
        >
          <div className="team-kpi-icon blue">
            <HomeIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{!rows ? '…' : kpiStats.total}</div>
            <div className="team-kpi-label">{isMr ? 'एकूण निवासस्थाने' : 'All Dwellings'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filters.homeKind === 'house' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() =>
            setFilters(f => ({
              ...f,
              homeKind: f.homeKind === 'house' ? '' : 'house',
              ownership: ''
            }))
          }
          title={isMr ? 'स्वतंत्र घरे पाहण्यासाठी क्लिक करा' : 'Click to filter independent houses'}
        >
          <div className="team-kpi-icon green">
            <HomeIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{!rows ? '…' : kpiStats.houses}</div>
            <div className="team-kpi-label">{isMr ? 'स्वतंत्र घरे' : 'Independent Houses'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filters.homeKind === 'flat' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() =>
            setFilters(f => ({
              ...f,
              homeKind: f.homeKind === 'flat' ? '' : 'flat',
              ownership: ''
            }))
          }
          title={isMr ? 'फ्लॅट्स व इमारती पाहण्यासाठी क्लिक करा' : 'Click to filter apartment flats'}
        >
          <div className="team-kpi-icon purple">
            <BuildingIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{!rows ? '…' : kpiStats.flats}</div>
            <div className="team-kpi-label">{isMr ? 'फ्लॅट्स / इमारती' : 'Apartment Flats'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filters.ownership === 'RENT' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() =>
            setFilters(f => ({
              ...f,
              ownership: f.ownership === 'RENT' ? '' : 'RENT',
              homeKind: ''
            }))
          }
          title={isMr ? 'भाड्याने दिलेली घरे पाहण्यासाठी क्लिक करा' : 'Click to filter rented premises'}
        >
          <div className="team-kpi-icon amber">
            <ClockIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{!rows ? '…' : kpiStats.rented}</div>
            <div className="team-kpi-label">{isMr ? 'भाड्याची घरे' : 'Rented Premises'}</div>
          </div>
        </div>
      </div>

      {/* Professional Search & Filter Toolbar - Single Line */}
      <div className="exec-toolbar-panel">
        <div className="exec-toolbar-row">
          <div className="exec-toolbar-left">
            <div className="exec-search-box">
              <SearchIcon size={15} />
              <input
                placeholder={isMr ? 'घर क्र., पत्ता, मालक शोधा…' : 'Search door, address, owner…'}
                value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
              />
              {filters.search && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setFilters({ ...filters, search: '' })}
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
                value={filters.areaId || ''}
                onChange={e => setFilters({ ...filters, areaId: e.target.value })}
                className="exec-filter-select"
              >
                <option value="">{isMr ? 'सर्व कॉलनी' : 'All colonies'}</option>
                {colonyFilterOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="exec-quick-status">
              <select
                value={filters.homeKind || ''}
                onChange={e => setFilters({ ...filters, homeKind: e.target.value })}
                className="exec-filter-select"
              >
                <option value="">{isMr ? 'सर्व निवास प्रकार' : 'All Dwellings'}</option>
                <option value="house">{isMr ? 'स्वतंत्र घरे' : 'Houses'}</option>
                <option value="flat">{isMr ? 'फ्लॅट्स / इमारती' : 'Flats'}</option>
              </select>
            </div>

            <div className="exec-quick-presence">
              <select
                value={filters.ownership || ''}
                onChange={e => setFilters({ ...filters, ownership: e.target.value })}
                className="exec-filter-select"
              >
                <option value="">{isMr ? 'सर्व मालकी' : 'All Ownership'}</option>
                <option value="OWN">{isMr ? 'स्वतःची (Owned)' : 'Owned'}</option>
                <option value="RENT">{isMr ? 'भाड्याने (Rented)' : 'Rented'}</option>
                <option value="OTHER">{isMr ? 'इतर (Other)' : 'Other'}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Symmetrical Houses Table */}
      {!rows ? (
        <Loading />
      ) : !total ? (
        <Empty>
          {filters.search || filters.areaId || filters.homeKind || filters.ownership
            ? isMr
              ? 'या फिल्टरनुसार कोणतीही घरे सापडली नाहीत.'
              : 'No houses match the selected filters.'
            : isMr
            ? 'या वॉर्डमध्ये कोणतीही घरे नोंदवलेली नाहीत.'
            : 'No houses found for the selected ward.'}
        </Empty>
      ) : (
        <>
          <div className="panel table-wrap houses-table-wrap">
            <table className="houses-table">
              <thead>
                <tr>
                  <th>{isMr ? 'घर' : 'House'}</th>
                  <th>{isMr ? 'पत्ता' : 'Address'}</th>
                  <th>{isMr ? 'रहिवासी वॉर्ड' : 'Resident Ward'}</th>
                  <th>{isMr ? 'कुटुंब' : 'Family'}</th>
                  <th>{isMr ? 'स्थान' : 'Location'}</th>
                  <th style={{ textAlign: 'center' }}>{isMr ? 'कृती' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(h => {
                  const isFlat = isFlatHome(h);
                  const aptName = h.apartment?.name || '';
                  const wardNo = formatWardNumber(h.area?.ward?.wardNumber);
                  const isOwn = h.ownership === 'OWN';
                  const familiesCount = (h.families || []).length;
                  const primaryFamily = (h.families || [])[0];

                  return (
                    <tr key={h.id}>
                      <td data-label="House">
                        <div className="exec-cell-user">
                          <div
                            className={`exec-avatar ${isFlat ? 'blue' : 'green'}`}
                            onClick={() =>
                              api
                                .house(h.id)
                                .then(r => setDetail(r.data))
                                .catch(e => setError(e.message))
                            }
                            style={{ cursor: 'pointer' }}
                            title={isMr ? 'तपशील पाहण्यासाठी क्लिक करा' : 'Click to view details'}
                          >
                            {isFlat ? <BuildingIcon size={16} /> : <HomeIcon size={16} />}
                          </div>
                          <div className="exec-cell-meta">
                            <button
                              type="button"
                              onClick={() =>
                                api
                                  .house(h.id)
                                  .then(r => setDetail(r.data))
                                  .catch(e => setError(e.message))
                              }
                              className="exec-cell-name family-name-pill"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                margin: 0,
                                font: 'inherit',
                                fontWeight: 700,
                                color: '#0f172a',
                                textAlign: 'left',
                                cursor: 'pointer'
                              }}
                              title={isMr ? 'तपशील पाहण्यासाठी क्लिक करा' : 'Click to view details'}
                            >
                              {doorLabel(h, isFlat, isMr)}
                            </button>
                            <div className="house-cell-tags">
                              <span className={`house-type-chip ${isFlat ? 'flat' : 'house'}`}>
                                {isFlat ? (isMr ? 'फ्लॅट' : 'Flat') : (isMr ? 'घर' : 'House')}
                              </span>
                              <span className={`shop-ownership-badge ${isOwn ? 'own' : 'rent'}`}>
                                {ownershipLabel(h.ownership, isMr)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td data-label="Address">
                        <div className="house-addr-cell">
                          {isFlat && aptName ? (
                            <div className="house-addr-apt-wrap" style={{ marginBottom: 3 }}>
                              <span className="residence-apt-chip" title={`${isMr ? 'अपार्टमेंट' : 'Apartment'}: ${aptName}`}>
                                🏢 {aptName}
                              </span>
                            </div>
                          ) : null}
                          <div className="house-addr-line" title={houseAddressText(h) || ''}>
                            {houseAddressText(h) || (isMr ? 'पत्ता नोंद नाही' : 'Address not recorded')}
                          </div>
                          <div className="house-addr-meta">
                            <span className="residence-colony-tag">📍 {h.area?.name || (isMr ? 'कॉलनी नोंद नाही' : 'Colony unassigned')}</span>
                            {h.city || h.area?.city ? <span className="house-addr-city" style={{ color: '#64748b', fontSize: 11.5, fontWeight: 500 }}>· {h.city || h.area?.city}</span> : null}
                          </div>
                        </div>
                      </td>

                      <td data-label="Resident Ward">
                        {wardNo ? (
                          <span className="ward-pill-badge">{wardNo}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>

                      <td data-label="Family">
                        <div className="house-family-cell">
                          {familiesCount > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                              <span className="house-family-name" title={primaryFamily?.familyName || ''}>
                                {primaryFamily?.familyName
                                  ? `${primaryFamily.familyName} ${isMr ? 'कुटुंब' : 'Family'}`
                                  : `${familiesCount} ${isMr ? 'कुटुंबे' : 'Families'}`}
                              </span>
                              {primaryFamily?.members && primaryFamily.members.length > 0 && (
                                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                                  {primaryFamily.members.length} {isMr ? 'सदस्य' : 'members'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>{isMr ? 'कुटुंब नोंद नाही' : 'No family linked'}</span>
                          )}
                        </div>
                      </td>

                      <td data-label="Location">
                        <div className="house-loc-cell">
                          {hasCoords(h.latitude, h.longitude) ? (
                            <a
                              href={directionsUrl(h.latitude, h.longitude)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="exec-btn-dir"
                              onClick={e => e.stopPropagation()}
                              title={isMr ? 'गुगल मॅप्सवर घराचा मार्ग पहा' : 'View directions in Google Maps'}
                            >
                              <MapPinIcon size={12} />
                              <span>{isMr ? 'दिशा' : 'Directions'}</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              className={`exec-btn-dir ${canPin ? 'pin-needed' : 'disabled'}`}
                              onClick={() => canPin && openHouseLoc(h, false)}
                              disabled={!canPin}
                              title={
                                canPin
                                  ? isMr
                                    ? 'स्थान पिन करण्यासाठी क्लिक करा'
                                    : 'Click to pin GPS location'
                                  : isMr
                                  ? 'स्थान जतन नाही'
                                  : 'Location not saved'
                              }
                            >
                              <MapPinIcon size={12} />
                              <span>{canPin ? (isMr ? 'पिन करा' : 'Pin now') : (isMr ? 'पिन नाही' : 'No Pin')}</span>
                            </button>
                          )}
                        </div>
                      </td>

                      <td data-label="Actions" style={{ textAlign: 'center' }}>
                        <div className="exec-action-group">
                          <button
                            type="button"
                            className="exec-btn-view"
                            onClick={() =>
                              api
                                .house(h.id)
                                .then(r => setDetail(r.data))
                                .catch(e => setError(e.message))
                            }
                            title={isMr ? 'तपशील पहा' : 'View house profile'}
                          >
                            <EyeIcon size={13} />
                            <span>{isMr ? 'पहा' : 'View'}</span>
                          </button>
                          <RowMenu
                            menuOnly
                            items={[
                              {
                                label: isMr ? 'तपशील पहा' : 'View details',
                                onClick: () =>
                                  api
                                    .house(h.id)
                                    .then(r => setDetail(r.data))
                                    .catch(e => setError(e.message))
                              },
                              hasCoords(h.latitude, h.longitude) && {
                                label: isMr ? 'गुगल मॅप्सवर दिशा' : 'Get directions',
                                onClick: () =>
                                  window.open(directionsUrl(h.latitude, h.longitude), '_blank', 'noopener')
                              },
                              canPin && {
                                label: isMr ? 'स्थान पिन / अद्यतन करा' : 'Update GPS pin',
                                onClick: () => openHouseLoc(h, false)
                              },
                              (can('CREATE_FAMILIES') || isNagarsevak() || isEmployee()) && {
                                label: isMr ? '+ येथे कुटुंब जोडा' : '+ Add family here',
                                onClick: () => navigate(`/families?houseId=${h.id}`)
                              },
                              can('EDIT_HOUSES') && {
                                label: isMr ? 'माहिती संपादित करा' : 'Edit house',
                                onClick: () => openEdit(h)
                              },
                              can('DELETE_HOUSES') && {
                                label: isMr ? 'घर हटवा' : 'Delete house',
                                danger: true,
                                onClick: async () => {
                                  if (
                                    confirm(
                                      isMr
                                        ? 'हे घर रिसायकल बिनमध्ये हलवायचे आहे का?'
                                        : 'Move house to recycle bin?'
                                    )
                                  ) {
                                    try {
                                      await api.deleteHouse(h.id);
                                      await load();
                                      window.dispatchEvent(
                                        new CustomEvent('ward:toast', {
                                          detail: {
                                            type: 'success',
                                            message: isMr ? 'घर काढण्यात आले.' : 'House removed.'
                                          }
                                        })
                                      );
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

          <PaginationBar
            page={currentPage}
            pages={pages}
            total={total}
            limit={pageSize}
            onPage={setPage}
            onLimit={setPageSize}
          />
        </>
      )}

      {/* Executive House Details Modal */}
      {detail && (
        <Modal
          wide
          title={`${isFlatHome(detail) ? (isMr ? 'फ्लॅट' : 'Flat') : isMr ? 'घर' : 'House'} ${detail.houseNumber || ''} · ${isMr ? 'निवास तपशील' : 'Property Profile'}`}
          onClose={() => setDetail(null)}
        >
          <div className="exec-modal-profile-header">
            <div className={`exec-modal-avatar ${isFlatHome(detail) ? 'blue' : 'green'}`}>
              {isFlatHome(detail) ? <BuildingIcon size={20} /> : <HomeIcon size={20} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {isFlatHome(detail)
                    ? isMr
                      ? `फ्लॅट क्र. ${detail.houseNumber || '—'}`
                      : `Flat ${detail.houseNumber || '—'}`
                    : isMr
                    ? `घर क्र. ${detail.houseNumber || '—'}`
                    : `House #${detail.houseNumber || '—'}`}
                </h2>
                {isFlatHome(detail) && (
                  <span
                    style={{
                      background: '#f3e8ff',
                      color: '#6b21a8',
                      border: '1px solid #d8b4fe',
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 700
                    }}
                  >
                    🏢 {detail.apartment?.name || (isMr ? 'अपार्टमेंट' : 'Apartment')}
                  </span>
                )}
                <span
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    color: '#475569',
                    borderRadius: 6,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 600
                  }}
                >
                  {isFlatHome(detail)
                    ? isMr
                      ? 'फ्लॅट (Apartment Flat)'
                      : 'Apartment Flat'
                    : houseTypeLabel(detail.houseType, isMr)}
                </span>
                <span className={`shop-ownership-badge ${detail.ownership === 'OWN' ? 'own' : 'rent'}`}>
                  {ownershipLabel(detail.ownership, isMr)}
                </span>
              </div>
              <div
                className="muted"
                style={{
                  fontSize: 12.5,
                  marginTop: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap'
                }}
              >
                <span>{formatWardLabel(detail.area?.ward)}</span>
                <span>•</span>
                <span>{detail.area?.name || '—'}</span>
                <span>•</span>
                <span>{detail.city || detail.area?.city || 'Ahilyanagar'}</span>
              </div>
            </div>

            {can('CREATE_FAMILIES') && (
              <button
                type="button"
                className="exec-modal-btn primary"
                style={{ height: 34, padding: '0 12px', fontSize: 12 }}
                onClick={() => navigate(`/families?houseId=${detail.id}`)}
              >
                <span>+</span>
                <span>{isMr ? 'कुटुंब जोडा' : 'Add Family'}</span>
              </button>
            )}
          </div>

          <div className="prof-detail-grid">
            <div className="prof-detail-card">
              <div className="prof-card-title">
                <BuildingIcon size={16} />
                <span>{isMr ? 'घर व पत्ता' : 'House & Address'}</span>
              </div>
              <div className="prof-spec-list">
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isFlatHome(detail) ? (isMr ? 'फ्लॅट क्रमांक' : 'Flat Number') : (isMr ? 'घर क्रमांक' : 'House Number')}</span>
                  <span className="prof-spec-v">{detail.houseNumber || '—'}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'निवास प्रकार' : 'Dwelling Type'}</span>
                  <span className="prof-spec-v">
                    {isFlatHome(detail) ? (isMr ? 'फ्लॅट' : 'Apartment Flat') : houseTypeLabel(detail.houseType, isMr)}
                  </span>
                </div>
                {isFlatHome(detail) && (
                  <div className="prof-spec-row">
                    <span className="prof-spec-k">{isMr ? 'इमारत / अपार्टमेंट' : 'Apartment'}</span>
                    <span className="prof-spec-v">{detail.apartment?.name || '—'}</span>
                  </div>
                )}
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'जागा मालकी' : 'Ownership'}</span>
                  <span className="prof-spec-v">
                    <span className={`shop-ownership-badge ${detail.ownership === 'OWN' ? 'own' : 'rent'}`}>
                      {ownershipLabel(detail.ownership, isMr)}
                    </span>
                  </span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'वॉर्ड' : 'Ward'}</span>
                  <span className="prof-spec-v">{formatWardLabel(detail.area?.ward, '—')}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'कॉलनी / परिसर' : 'Colony / Area'}</span>
                  <span className="prof-spec-v">{detail.area?.name || '—'}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'संपूर्ण पत्ता' : 'Full Address'}</span>
                  <span className="prof-spec-v">{detail.address || housePlace(detail) || '—'}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'जवळची खूण' : 'Landmark'}</span>
                  <span className="prof-spec-v">{detail.landmark || '—'}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'शहर / पिन' : 'City / PIN'}</span>
                  <span className="prof-spec-v">
                    {[detail.city || detail.area?.city || 'Ahilyanagar', detail.pincode].filter(Boolean).join(' · ') || '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="prof-detail-card">
              <div className="prof-card-title">
                <FileTextIcon size={16} />
                <span>{isMr ? 'मालक व कुटुंब' : 'Owner & Household'}</span>
              </div>
              <div className="prof-spec-list">
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'जागा मालक' : 'Property Owner'}</span>
                  <span className="prof-spec-v">{detail.ownerName || (isMr ? 'नोंद नाही' : 'Not recorded')}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'मालक मोबाईल' : 'Owner Mobile'}</span>
                  <span className="prof-spec-v">
                    {detail.ownerMobile ? (
                      <a href={`tel:${detail.ownerMobile}`} style={{ color: '#0369a1', fontWeight: 600, textDecoration: 'none' }}>
                        {detail.ownerMobile}
                      </a>
                    ) : '—'}
                  </span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'कुटुंबे' : 'Families'}</span>
                  <span className="prof-spec-v">{(detail.families || []).length || 0}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'नोंदी / शेरा' : 'Notes'}</span>
                  <span className="prof-spec-v">{detail.notes || (isMr ? 'कोणतीही नोंद नाही' : 'No notes')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="prof-detail-card" style={{ marginBottom: 16 }}>
            <div className="prof-card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPinIcon size={16} />
                <span>{isMr ? 'नकाशा व अचूक स्थान' : 'GPS Location'}</span>
              </div>
              {hasCoords(detail.latitude, detail.longitude) && (
                <a
                  href={directionsUrl(detail.latitude, detail.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="primary-btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 12px', textDecoration: 'none' }}
                >
                  <MapPinIcon size={14} />
                  <span>{isMr ? 'घर दिशा' : 'Home Direction'}</span>
                </a>
              )}
            </div>
            <MapPreview
              lat={detail.latitude}
              lng={detail.longitude}
              label={`${isFlatHome(detail) ? 'Flat' : 'House'} ${detail.houseNumber || ''}`}
            >
              {canPin && (
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="small-btn loc-update-btn" onClick={() => openHouseLoc(detail, true)}>
                    {isMr ? 'स्थान अपडेट करा' : 'Update Pin'}
                  </button>
                </div>
              )}
            </MapPreview>
          </div>

          {/* Families in this house */}
          <div className="exec-detail-card" style={{ marginTop: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                paddingBottom: 8,
                borderBottom: '1.5px solid #e2e8f0'
              }}
            >
              <div>
                <h3 style={{ margin: 0, padding: 0, border: 'none' }}>
                  👥 {isMr ? 'या घरामध्ये वास्तव्यास कुटुंबे' : 'Families Living in this House'} (
                  {(detail.families || []).length})
                </h3>
                <span className="muted" style={{ fontSize: 11.5 }}>
                  {isMr
                    ? 'एका घरामध्ये / फ्लॅटमध्ये एकाहून अधिक कुटुंबे राहू शकतात.'
                    : 'Multiple families can reside in a single house or flat.'}
                </span>
              </div>
              {can('CREATE_FAMILIES') && (
                <button
                  type="button"
                  className="exec-modal-btn primary"
                  style={{ height: 30, padding: '0 10px', fontSize: 11.5 }}
                  onClick={() => navigate(`/families?houseId=${detail.id}`)}
                >
                  <span>+</span>
                  <span>{isMr ? 'कुटुंब जोडा' : 'Add Family'}</span>
                </button>
              )}
            </div>

            {!(detail.families || []).length ? (
              <p className="muted" style={{ margin: '14px 0 4px', fontStyle: 'italic', fontSize: 12.5 }}>
                {isMr ? 'या घराशी अद्याप कोणतेही कुटुंब जोडलेले नाही.' : 'No families linked to this house yet.'}
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginTop: 12 }}>
                {detail.families.map(f => (
                  <div
                    key={f.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                        {f.familyName ? `${f.familyName} ${isMr ? 'कुटुंब' : 'Family'}` : (isMr ? 'अनामित कुटुंब' : 'Family')}
                      </strong>
                      <span
                        style={{
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#065f46',
                          borderRadius: 4,
                          padding: '1px 5px',
                          fontSize: '10.5px',
                          fontWeight: 700
                        }}
                      >
                        👥 {f.members?.length || 0} {isMr ? 'सदस्य' : 'Members'}
                      </span>
                    </div>
                    {f.nativeVillage && (
                      <div className="muted" style={{ fontSize: '11px' }}>
                        🌾 {f.nativeVillage}
                      </div>
                    )}
                    <button
                      type="button"
                      className="exec-modal-btn"
                      style={{ marginTop: 6, height: 26, fontSize: 11, alignSelf: 'flex-start' }}
                      onClick={() => navigate(`/families?search=${encodeURIComponent(f.familyName || '')}`)}
                    >
                      {isMr ? 'कुटुंब पहा →' : 'View Family →'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Update Location Modal */}
      {houseLoc && (
        <Modal
          wide
          title={`${isMr ? 'स्थान अपडेट करा' : 'Update Location'} · ${isMr ? 'घर' : 'House'} ${houseLoc.houseNumber || ''}`}
          onClose={() => {
            const reopen = houseLoc.fromDetail;
            const id = houseLoc.id;
            setHouseLoc(null);
            if (reopen) api.house(id).then(r => setDetail(r.data)).catch(() => {});
          }}
        >
          <form className="form-grid admin-form compact-modal-form" onSubmit={saveHouseLoc}>
            <div className="exec-form-section span-2">
              <div className="exec-form-section-title">
                <MapPinIcon size={14} style={{ color: '#0f766e' }} />
                <span>{isMr ? 'घराचे अचूक जीपीएस स्थान' : 'Exact Home GPS Location'}</span>
              </div>
              <div className="exec-form-section-desc">
                {isMr
                  ? 'जीपीएसद्वारे केवळ पिन जतन केला जातो. पत्ता, खूण आणि शहर आधीप्रमाणेच राहते.'
                  : 'GPS saves only the door pin. Address, landmark, and city remain as they are.'}
              </div>
            </div>
            <ErrorBox error={error} />
            <LocationPicker
              key={houseLoc.id}
              value={houseLoc}
              onChange={next =>
                setHouseLoc(cur => ({ ...cur, latitude: next.latitude, longitude: next.longitude }))
              }
              centerFrom={[houseLoc.area, houseLoc.area?.ward]}
              hint={
                isMr
                  ? 'दरवाज्याजवळ उभे राहून Use GPS दाबा किंवा नकाशावर टॅप करून पिन सेट करा.'
                  : 'Stand at the door and tap Use GPS or tap the map to position the pin.'
              }
            />
            <div className="modal-actions span-2">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  const reopen = houseLoc.fromDetail;
                  const id = houseLoc.id;
                  setHouseLoc(null);
                  if (reopen) api.house(id).then(r => setDetail(r.data)).catch(() => {});
                }}
              >
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button className="primary-btn" disabled={busyLoc}>
                {busyLoc ? (isMr ? 'जतन करत आहे…' : 'Saving…') : isMr ? 'स्थान जतन करा' : 'Save Location'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add / Edit House Modal */}
      {form && (
        <Modal
          wide
          title={
            edit
              ? isMr
                ? `घर संपादित करा · ${edit.houseNumber}`
                : `Edit House · ${edit.houseNumber}`
              : isMr
              ? 'नवीन घर / फ्लॅट नोंदवा'
              : 'Add House / Flat'
          }
          onClose={() => {
            setEdit(null);
            setAdd(null);
          }}
        >
          <form className="form-grid admin-form compact-modal-form" onSubmit={save}>
            <div className="exec-form-section span-2">
              <div className="exec-form-section-title">
                <HomeIcon size={14} style={{ color: '#0f766e' }} />
                <span>{isMr ? '१. घर / फ्लॅट स्थान व प्रकार' : '1. Location & Property Type'}</span>
              </div>
              <div className="exec-form-section-desc">
                {isMr
                  ? 'स्वतंत्र घर किंवा इमारतीमधील फ्लॅट निवडा. इमारत नसल्यास आधी इमारत जोडा.'
                  : 'Choose between an independent house or a flat inside an apartment.'}
              </div>
            </div>

            <Field label={isMr ? 'वॉर्ड *' : 'Ward *'}>
              <SearchableSelect
                required
                value={formWardId}
                onChange={v => changeForm({ ...form, wardId: v, areaId: '', apartmentId: '' })}
                options={wardOptions}
                placeholder={isMr ? 'वॉर्ड निवडा…' : 'Search ward…'}
              />
            </Field>

            <Field label={isMr ? 'कॉलनी / परिसर *' : 'Colony / Area *'}>
              <SearchableSelect
                required
                value={form.areaId || ''}
                onChange={pickArea}
                options={formAreas}
                placeholder={
                  formWardId
                    ? isMr
                      ? 'कॉलनी निवडा…'
                      : 'Search colony…'
                    : isMr
                    ? 'प्रथम वॉर्ड निवडा'
                    : 'Select ward first'
                }
              />
            </Field>

            <Field className="span-2" label={isMr ? 'निवास प्रकार *' : 'Dwelling Type *'}>
              <SearchableSelect
                required
                value={form.dwelling || 'INDEPENDENT'}
                onChange={dwelling =>
                  changeForm({
                    ...form,
                    dwelling,
                    apartmentId: dwelling === 'APARTMENT' ? form.apartmentId : '',
                    houseType: dwelling === 'APARTMENT' ? 'FLAT' : 'INDEPENDENT_HOUSE'
                  })
                }
                options={[
                  { value: 'INDEPENDENT', label: isMr ? '🏡 स्वतंत्र घर (Independent House)' : 'Independent house' },
                  { value: 'APARTMENT', label: isMr ? '🏢 फ्लॅट / अपार्टमेंट (Apartment Flat)' : 'Flat (inside apartment)' }
                ]}
                placeholder={isMr ? 'निवास प्रकार निवडा…' : 'Select house type…'}
              />
            </Field>

            {form.dwelling === 'APARTMENT' && (
              <div className="span-2 apt-pick-row">
                <Field label={isMr ? 'अपार्टमेंट / इमारत *' : 'Apartment *'}>
                  <SearchableSelect
                    required
                    value={form.apartmentId || ''}
                    onChange={v => changeForm(pickApartment(v, form))}
                    options={wardApartments.map(a => ({
                      value: a.id,
                      label: a.name,
                      hint: a.area?.name || ''
                    }))}
                    placeholder={
                      wardApartments.length
                        ? isMr
                          ? 'इमारत निवडा…'
                          : 'Search apartment…'
                        : isMr
                        ? 'इमारत उपलब्ध नाही — नवीन जोडा'
                        : 'No apartment yet — add one'
                    }
                  />
                </Field>
                {canAddApt && (
                  <button
                    type="button"
                    className="small-btn apt-add-inline"
                    onClick={() => openAddApartment(true)}
                  >
                    {isMr ? '+ नवीन इमारत' : '+ Add apartment'}
                  </button>
                )}
              </div>
            )}

            <Field label={form.dwelling === 'APARTMENT' ? (isMr ? 'फ्लॅट क्रमांक *' : 'Flat Number *') : isMr ? 'घर क्रमांक *' : 'House Number *'}>
              <input
                required
                value={form.houseNumber || ''}
                onChange={e => changeForm({ ...form, houseNumber: e.target.value })}
                placeholder={form.dwelling === 'APARTMENT' ? 'e.g. A-101' : 'e.g. H-101'}
              />
            </Field>

            {form.dwelling !== 'APARTMENT' && (
              <Field label={isMr ? 'बांधकाम प्रकार' : 'Building Type'}>
                <SearchableSelect
                  value={form.houseType || 'INDEPENDENT_HOUSE'}
                  onChange={v => changeForm({ ...form, houseType: v })}
                  options={[
                    { value: 'INDEPENDENT_HOUSE', label: isMr ? 'स्वतंत्र घर' : 'Independent house' },
                    { value: 'BUNGALOW', label: isMr ? 'बंगला' : 'Bungalow' },
                    { value: 'ROW_HOUSE', label: isMr ? 'रो हाऊस' : 'Row House' },
                    { value: 'CHAWL', label: isMr ? 'चाळ' : 'Chawl' },
                    { value: 'OTHER', label: isMr ? 'इतर' : 'Other' }
                  ]}
                  placeholder={isMr ? 'प्रकार निवडा…' : 'Building type'}
                />
              </Field>
            )}

            <Field label={isMr ? 'जागा मालकी' : 'Premise Ownership'}>
              <select
                value={form.ownership || 'OWN'}
                onChange={e => changeForm({ ...form, ownership: e.target.value })}
                className="modal-select"
              >
                <option value="OWN">{isMr ? 'स्वतःची जागा (Own)' : 'Own'}</option>
                <option value="RENT">{isMr ? 'भाड्याने (Rent)' : 'Rent'}</option>
                <option value="OTHER">{isMr ? 'इतर (Other)' : 'Other'}</option>
              </select>
            </Field>

            <Field className="span-2" label={isMr ? 'संपूर्ण पत्ता *' : 'Complete Address *'}>
              <textarea
                required
                value={form.address || ''}
                onChange={e => changeForm({ ...form, address: e.target.value })}
                placeholder={isMr ? 'घर क्र., गल्ली, कॉलनी किंवा विंग' : 'House number, street, colony or wing'}
              />
            </Field>

            <Field label={isMr ? 'जवळची खूण (ऐच्छिक)' : 'Landmark (Optional)'}>
              <input
                value={form.landmark || ''}
                onChange={e => changeForm({ ...form, landmark: e.target.value })}
                placeholder={isMr ? 'जवळची खूण' : 'Nearby landmark'}
              />
            </Field>

            <Field label={isMr ? 'शहर / गाव' : 'City / Town'}>
              <input
                value={form.city || ''}
                onChange={e => changeForm({ ...form, city: e.target.value })}
                placeholder={isMr ? 'शहर' : 'City'}
              />
            </Field>

            <div className="exec-form-section span-2">
              <div className="exec-form-section-title">
                <UsersIcon size={14} style={{ color: '#0f766e' }} />
                <span>{isMr ? '२. जागा मालक माहिती (ऐच्छिक)' : '2. Property Owner Information'}</span>
              </div>
              <div className="exec-form-section-desc">
                {isMr
                  ? 'घर मालकाची माहिती उपलब्ध नसल्यास रिकामे ठेवू शकता.'
                  : 'Leave blank if property owner details are not available yet.'}
              </div>
            </div>

            <Field label={isMr ? 'मालकाचे नाव' : 'Owner Name'}>
              <input
                value={form.ownerName || ''}
                onChange={e => changeForm({ ...form, ownerName: e.target.value })}
                placeholder={isMr ? 'घर मालकाचे नाव' : 'Owner full name'}
              />
            </Field>

            <Field label={isMr ? 'मालक मोबाईल' : 'Owner Mobile'}>
              <input
                inputMode="numeric"
                maxLength={10}
                value={form.ownerMobile || ''}
                onChange={e =>
                  changeForm({ ...form, ownerMobile: e.target.value.replace(/\D/g, '').slice(0, 10) })
                }
                placeholder={isMr ? '१० अंकी मोबाईल' : '10 digit mobile'}
              />
            </Field>

            <div className="exec-form-section span-2">
              <div className="exec-form-section-title">
                <MapPinIcon size={14} style={{ color: '#0f766e' }} />
                <span>{isMr ? '३. अचूक जीपीएस स्थान' : '3. Exact GPS Location'}</span>
              </div>
              <div className="exec-form-section-desc">
                {isMr
                  ? 'दरवाज्याजवळ उभे राहून Use GPS दाबा.'
                  : 'Stand at the door and tap Use GPS. Only latitude and longitude are saved.'}
              </div>
            </div>

            <LocationPicker
              key={edit?.id || 'new-house'}
              value={form}
              onChange={next =>
                changeForm({ ...form, latitude: next.latitude, longitude: next.longitude })
              }
              centerFrom={[
                selectedArea,
                selectedWard,
                wardApartments.find(a => String(a.id) === String(form.apartmentId))
              ]}
              hint={isMr ? 'दरवाज्याजवळ उभे राहून स्थान पिन करा.' : 'Stand at the door and tap Use GPS.'}
            />

            <div className="modal-actions span-2">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setEdit(null);
                  setAdd(null);
                }}
              >
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button className="primary-btn">
                {edit ? (isMr ? 'बदल जतन करा' : 'Save Changes') : isMr ? 'घर जतन करा' : 'Save House'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Apartment Modal */}
      {apartmentForm && (
        <Modal
          wide
          layer={form ? 2 : 1}
          title={isMr ? 'नवीन इमारत / अपार्टमेंट नोंदवा' : 'Add Apartment Building'}
          onClose={() => setApartmentForm(null)}
        >
          <form className="form-grid admin-form compact-modal-form" onSubmit={saveApartment}>
            <div className="exec-form-section span-2">
              <div className="exec-form-section-title">
                <BuildingIcon size={14} style={{ color: '#0f766e' }} />
                <span>{isMr ? 'इमारत / सोसायटी माहिती' : 'Apartment & Building Details'}</span>
              </div>
              <div className="exec-form-section-desc">
                {isMr
                  ? 'इमारतीची नोंदणी करा, त्यानंतर प्रत्येक फ्लॅट जोडताना ही इमारत निवडता येईल.'
                  : 'Register the building first. Then add each flat as a dwelling unit under this building.'}
              </div>
            </div>

            <Field label={isMr ? 'वॉर्ड *' : 'Ward *'}>
              <SearchableSelect
                required
                value={apartmentForm.wardId || ''}
                onChange={v => setApartmentForm({ ...apartmentForm, wardId: v, areaId: '' })}
                options={wardOptions}
                placeholder={isMr ? 'वॉर्ड निवडा…' : 'Search ward…'}
              />
            </Field>

            <Field label={isMr ? 'कॉलनी / परिसर *' : 'Colony / Area *'}>
              <SearchableSelect
                required
                value={apartmentForm.areaId || ''}
                onChange={v => setApartmentForm({ ...apartmentForm, areaId: v })}
                options={(
                  (wards.find(w => String(w.id) === String(apartmentForm.wardId))?.areas) || []
                ).map(a => ({ value: a.id, label: a.name }))}
                placeholder={
                  apartmentForm.wardId
                    ? isMr
                      ? 'कॉलनी निवडा…'
                      : 'Search colony…'
                    : isMr
                    ? 'प्रथम वॉर्ड निवडा'
                    : 'Select ward first'
                }
              />
            </Field>

            <Field className="span-2" label={isMr ? 'अपार्टमेंट / इमारतीचे नाव *' : 'Apartment Name *'}>
              <input
                required
                value={apartmentForm.name || ''}
                onChange={e => setApartmentForm({ ...apartmentForm, name: e.target.value })}
                placeholder={isMr ? 'उदा. साई रेसिडेन्सी' : 'e.g. Sai Residency'}
              />
            </Field>

            <Field label={isMr ? 'मजले (ऐच्छिक)' : 'Floors (Optional)'}>
              <input
                inputMode="numeric"
                value={apartmentForm.floors || ''}
                onChange={e =>
                  setApartmentForm({ ...apartmentForm, floors: e.target.value.replace(/\D/g, '') })
                }
                placeholder="e.g. 7"
              />
            </Field>

            <Field label={isMr ? 'जवळची खूण (ऐच्छिक)' : 'Landmark (Optional)'}>
              <input
                value={apartmentForm.landmark || ''}
                onChange={e => setApartmentForm({ ...apartmentForm, landmark: e.target.value })}
                placeholder={isMr ? 'जवळची खूण' : 'Nearby landmark'}
              />
            </Field>

            <Field className="span-2" label={isMr ? 'पत्ता (ऐच्छिक)' : 'Address (Optional)'}>
              <textarea
                value={apartmentForm.address || ''}
                onChange={e => setApartmentForm({ ...apartmentForm, address: e.target.value })}
                placeholder={isMr ? 'रस्ता, गेट, विंग' : 'Street, gate, wing'}
              />
            </Field>

            <div className="exec-form-section span-2">
              <div className="exec-form-section-title">
                <MapPinIcon size={14} style={{ color: '#0f766e' }} />
                <span>{isMr ? 'इमारतीचे अचूक स्थान' : 'Apartment GPS Location'}</span>
              </div>
              <div className="exec-form-section-desc">
                {isMr
                  ? 'इमारतीच्या मुख्य गेटवर उभे राहून Use GPS दाबा.'
                  : 'Stand at the apartment entrance and tap Use GPS.'}
              </div>
            </div>

            <LocationPicker
              key={`apt-${apartmentForm.wardId || 'new'}-${apartmentForm.areaId || ''}`}
              value={apartmentForm}
              onChange={next =>
                setApartmentForm(cur => ({ ...cur, latitude: next.latitude, longitude: next.longitude }))
              }
              centerFrom={[
                (wards.find(w => String(w.id) === String(apartmentForm.wardId))?.areas || []).find(
                  a => String(a.id) === String(apartmentForm.areaId)
                ),
                wards.find(w => String(w.id) === String(apartmentForm.wardId))
              ]}
              hint={isMr ? 'मुख्य गेटवर उभे राहून स्थान पिन करा.' : 'Stand at the apartment gate.'}
            />

            <div className="modal-actions span-2">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setApartmentForm(null)}
              >
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button className="primary-btn" disabled={busyApt}>
                {busyApt
                  ? isMr
                    ? 'नोंदवत आहे…'
                    : 'Saving…'
                  : isMr
                  ? 'इमारत जतन करा'
                  : 'Add Apartment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
