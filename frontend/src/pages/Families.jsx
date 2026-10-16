import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import PersonForm, { emptyPerson, presenceLine } from '../components/PersonForm';
import DeathAction from '../components/DeathAction';
import {
  geoPayload,
  hasCoords,
  housePlace,
  directionsUrl,
  MAHARASHTRA_DISTRICTS,
  isFlatHome,
  homePickOption,
  isOutOfCity,
  isVoterPerson
} from '../location';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import { emptyNativePlace } from '../nativePlace';
import LocationPicker, { MapPreview } from '../components/LocationMap';
import { getLanguage } from '../language';
import {
  UsersIcon,
  BuildingIcon,
  MapPinIcon,
  SearchIcon,
  CheckIcon,
  EyeIcon,
  EditIcon,
  FileTextIcon
} from '../components/Icons';

function canPinHouse() {
  return (
    can('EDIT_HOUSES') ||
    canModule('HOUSES', 'EDIT') ||
    can('EDIT_FAMILIES') ||
    canModule('FAMILIES', 'EDIT') ||
    can('CREATE_HOUSES') ||
    isNagarsevak() ||
    isEmployee()
  );
}

function emptyFamily(houseId = '', extra = {}) {
  return {
    familyName: '',
    houseId,
    dwelling: '',
    apartmentId: '',
    flatNumber: '',
    ownership: 'OWN',
    ownerName: '',
    latitude: '',
    longitude: '',
    notes: '',
    ...emptyNativePlace,
    ...extra
  };
}

function locForm(house) {
  if (!house) return null;
  return {
    id: house.id,
    houseNumber: house.houseNumber,
    latitude: hasCoords(house.latitude, house.longitude) ? house.latitude : '',
    longitude: hasCoords(house.latitude, house.longitude) ? house.longitude : '',
    area: house.area || null
  };
}

function getInitials(name) {
  if (!name) return 'FM';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function ownershipLabel(v, isMr = false) {
  if (v === 'OWN') return isMr ? 'स्वतःची जागा (Own)' : 'Own';
  if (v === 'RENT') return isMr ? 'भाड्याने (Rent)' : 'Rent';
  if (v === 'OTHER') return isMr ? 'इतर (Other)' : 'Other';
  return '—';
}

function ResidenceHouseCell({ house, isMr, aptName }) {
  if (!house) {
    return <span className="muted" style={{ fontStyle: 'italic', fontSize: '12px' }}>{isMr ? 'घर जोडलेले नाही' : 'No house linked'}</span>;
  }
  const flat = isFlatHome(house);
  const raw = String(house.houseNumber || '').trim();
  const doorText = !raw
    ? (flat ? (isMr ? 'फ्लॅट' : 'Flat') : isMr ? 'घर' : 'House')
    : /^(flat|फ्लॅट|house|घर|plot|प्लॉट)\b/i.test(raw)
      ? raw
      : flat
        ? (isMr ? `फ्लॅट ${raw}` : `Flat ${raw}`)
        : isMr
          ? `घर ${raw}`
          : `House ${raw}`;
  const apt = aptName || house.apartment?.name || '';
  const area = house.area?.name || '';
  const addr = String(house.address || '').trim();
  const landmark = String(house.landmark || '').trim();
  const line = addr && landmark && !addr.toLowerCase().includes(landmark.toLowerCase())
    ? `${addr} · ${landmark}`
    : addr || landmark || '';
  const city = house.city || house.area?.city || '';

  return (
    <div className="residence-cell">
      <div className="residence-row-top">
        <span className="residence-door-title">{doorText}</span>
        <span className={`house-type-chip ${flat ? 'flat' : 'house'}`}>
          {flat ? (isMr ? 'फ्लॅट' : 'Flat') : (isMr ? 'घर' : 'House')}
        </span>
        <span className={`shop-ownership-badge ${house.ownership === 'OWN' ? 'own' : 'rent'}`}>
          {ownershipLabel(house.ownership, isMr)}
        </span>
      </div>
      {flat && apt ? (
        <div className="residence-apt-line">
          <span className="residence-apt-chip" title={`${isMr ? 'इमारत / अपार्टमेंट' : 'Apartment'}: ${apt}`}>
            {apt}
          </span>
        </div>
      ) : null}
      {line ? (
        <div className="residence-address-text" title={line}>
          {line}
        </div>
      ) : (
        <div className="residence-address-text muted" style={{ fontStyle: 'italic', fontSize: '11.5px' }}>
          {isMr ? 'पत्ता नोंद नाही' : 'Address not recorded'}
        </div>
      )}
      {(area || city) && (
        <div className="residence-colony-line">
          {area && <span className="residence-colony-tag">{area}</span>}
          {city && <span className="residence-city-sub">· {city}</span>}
        </div>
      )}
    </div>
  );
}

export default function Families() {
  const { selectedWardId } = useWardFilter();
  const isMr = getLanguage() === 'mr';
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState(null);
  const [houses, setHouses] = useState([]);
  const [wards, setWards] = useState([]);
  const [apartments, setApartments] = useState([]);

  const [filters, setFilters] = useState({
    search: '',
    areaId: '',
    homeKind: '',
    apartmentId: '',
    peopleFilter: ''
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [listTotal, setListTotal] = useState(0);

  const [detail, setDetail] = useState(null);
  const [edit, setEdit] = useState(null);
  const [add, setAdd] = useState(null);

  const [memberForm, setMemberForm] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [memberFamilyId, setMemberFamilyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deathPerson, setDeathPerson] = useState(null);
  const [memberDetail, setMemberDetail] = useState(null);

  const [houseLoc, setHouseLoc] = useState(null);
  const [locFamilyId, setLocFamilyId] = useState('');
  const [locReturn, setLocReturn] = useState(false);
  const pin = canPinHouse();
  const canAddFamily =
    can('CREATE_FAMILIES') || canModule('FAMILIES', 'CREATE') || isNagarsevak() || isEmployee();

  async function load() {
    try {
      setError('');
      const res = await api.families({ page, limit: pageSize, wardId: selectedWardId || undefined });
      setRows(res.data || []);
      setListTotal(Number(res.meta?.total) || 0);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [selectedWardId, page, pageSize]);

  useEffect(() => {
    Promise.all([
      api.houses({ limit: 50, wardId: selectedWardId || undefined }),
      api.wards(),
      api.apartments({ wardId: selectedWardId || undefined })
    ])
      .then(([h, w, a]) => {
        setHouses(h.data || []);
        setWards(w.data || []);
        setApartments(a.data || []);
      })
      .catch(e => setError(e.message));
  }, [selectedWardId]);

  useEffect(() => {
    const apt = searchParams.get('apartmentId');
    const area = searchParams.get('areaId');
    if (apt) setFilters(f => ({ ...f, homeKind: 'FLAT', apartmentId: apt }));
    if (area) setFilters(f => ({ ...f, areaId: area }));
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [
    selectedWardId,
    filters.search,
    filters.areaId,
    filters.homeKind,
    filters.apartmentId,
    filters.peopleFilter
  ]);

  // Scoped rows by selected ward for accurate KPI counts
  const wardScopedRows = useMemo(() => {
    return filterByWard(rows || [], selectedWardId);
  }, [rows, selectedWardId]);

  // Interactive KPI Metrics
  const kpiStats = useMemo(() => {
    const total = wardScopedRows.length;
    const housesCount = wardScopedRows.filter(f => !isFlatHome(f.house)).length;
    const flatsCount = wardScopedRows.filter(f => isFlatHome(f.house)).length;
    const votersCount = wardScopedRows.filter(f =>
      (f.members || []).some(m => m.status !== 'DECEASED' && isVoterPerson(m))
    ).length;
    const migrantsCount = wardScopedRows.filter(
      f =>
        (f.members || []).some(m => m.status !== 'DECEASED' && isOutOfCity(m)) ||
        Boolean(f.nativeVillage)
    ).length;
    return {
      total,
      houses: housesCount,
      flats: flatsCount,
      voters: votersCount,
      migrants: migrantsCount
    };
  }, [wardScopedRows]);

  // Visible filtered rows
  const visible = useMemo(() => {
    return wardScopedRows
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .filter(f => {
        const hid = searchParams.get('houseId');
        if (hid && String(f.houseId || f.house?.id || '') !== String(hid)) return false;
        if (filters.areaId && String(f.house?.areaId || f.house?.area?.id || '') !== String(filters.areaId))
          return false;
        if (filters.homeKind === 'HOUSE' && isFlatHome(f.house)) return false;
        if (filters.homeKind === 'FLAT' && !isFlatHome(f.house)) return false;
        if (
          filters.apartmentId &&
          String(f.house?.apartmentId || f.house?.apartment?.id || '') !== String(filters.apartmentId)
        )
          return false;

        const live = (f.members || []).filter(m => m.status !== 'DECEASED');
        if (filters.peopleFilter === 'OUT_OF_CITY' && !live.some(isOutOfCity)) return false;
        if (filters.peopleFilter === 'OUT_VOTER' && !live.some(m => isOutOfCity(m) && isVoterPerson(m)))
          return false;
        if (filters.peopleFilter === 'VOTER' && !live.some(isVoterPerson)) return false;
        if (
          filters.peopleFilter === 'AT_HOME' &&
          !live.some(m => String(m.presenceStatus || '').toUpperCase() === 'AT_HOME')
        )
          return false;

        if (!filters.search) return true;
        const q = filters.search.trim().toLowerCase();
        const members = live.map(m => `${m.fullName || ''} ${m.mobile || ''}`).join(' ');
        const searchTarget = `${f.familyName || ''} ${f.house?.houseNumber || ''} ${
          f.house?.apartment?.name || ''
        } ${f.house?.area?.name || ''} ${f.nativeVillage || ''} ${f.nativeDistrict || ''} ${members}`.toLowerCase();
        return searchTarget.includes(q);
      });
  }, [wardScopedRows, filters, searchParams]);

  const total = listTotal || visible.length;
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const currentPage = Math.min(page, pages);
  const pageRows = visible;

  const colonyOptions = selectedWardId
    ? wards.find(w => String(w.id) === String(selectedWardId))?.areas || []
    : wards.flatMap(w => w.areas || []);

  const form = edit || add;
  const formHouses = houses.filter(h => {
    if (selectedWardId && !(h.area?.wardId === selectedWardId || h.area?.ward?.id === selectedWardId))
      return false;
    return true;
  });
  const independentHouses = formHouses
    .filter(h => !isFlatHome(h))
    .sort((a, b) => String(a.houseNumber || '').localeCompare(String(b.houseNumber || ''), undefined, { numeric: true }));

  const formApartments = apartments.filter(a => {
    if (selectedWardId && String(a.wardId || a.ward?.id || a.area?.wardId || '') !== String(selectedWardId))
      return false;
    return true;
  });
  const listedApartments = formApartments.filter(
    a => !filters.areaId || String(a.areaId || a.area?.id || '') === String(filters.areaId)
  );

  const getAptName = house => {
    if (!house) return '';
    if (house.apartment?.name) return house.apartment.name;
    const aptId = house.apartmentId || house.apartment?.id;
    if (aptId) {
      const found = apartments.find(a => String(a.id) === String(aptId));
      if (found?.name) return found.name;
    }
    return '';
  };

  const resolveHouse = house => {
    if (!house) return null;
    const aptName = getAptName(house);
    if (aptName && !house.apartment?.name) {
      return { ...house, apartment: { ...(house.apartment || {}), name: aptName } };
    }
    return house;
  };

  const districtOptions = useMemo(() => {
    const list = MAHARASHTRA_DISTRICTS.map(d => ({ value: d, label: d }));
    const cur = form?.nativeDistrict;
    if (cur && !list.some(d => d.value === cur)) list.unshift({ value: cur, label: cur });
    return list;
  }, [form?.nativeDistrict]);

  useEffect(() => {
    const houseId = searchParams.get('houseId');
    if (!canAddFamily || add || edit) return;
    if (houseId && houses.some(h => String(h.id) === String(houseId))) {
      const h = houses.find(x => String(x.id) === String(houseId));
      setAdd(
        emptyFamily(houseId, {
          dwelling: isFlatHome(h) ? 'FLAT' : 'HOUSE',
          apartmentId: h.apartmentId || h.apartment?.id || ''
        })
      );
      setSearchParams(
        prev => {
          const n = new URLSearchParams(prev);
          n.delete('houseId');
          return n;
        },
        { replace: true }
      );
    }
  }, [houses, searchParams, add, edit, canAddFamily, setSearchParams]);

  function patchForm(next) {
    (edit ? setEdit : setAdd)(next);
  }

  function setDwelling(dwelling) {
    patchForm({
      ...form,
      dwelling,
      houseId: '',
      apartmentId: dwelling === 'FLAT' ? form.apartmentId : '',
      flatNumber: dwelling === 'FLAT' ? form.flatNumber : ''
    });
  }

  function pickApartmentForFamily(apartmentId) {
    const apt = formApartments.find(a => String(a.id) === String(apartmentId));
    patchForm({
      ...form,
      dwelling: 'FLAT',
      apartmentId,
      latitude: hasCoords(apt?.latitude, apt?.longitude) ? apt.latitude : form.latitude || '',
      longitude: hasCoords(apt?.latitude, apt?.longitude) ? apt.longitude : form.longitude || ''
    });
  }

  function familyFromHouse(f) {
    const h = f.house || {};
    const isFlat = isFlatHome(h);
    return {
      ...emptyFamily(),
      ...f,
      houseId: f.houseId || h.id || '',
      flatNumber: isFlat ? h.houseNumber || '' : '',
      dwelling: isFlat ? 'FLAT' : 'HOUSE',
      apartmentId: h.apartmentId || h.apartment?.id || '',
      ownership: h.ownership || 'OWN',
      ownerName: h.ownerName || '',
      latitude: hasCoords(h.latitude, h.longitude) ? h.latitude : '',
      longitude: hasCoords(h.latitude, h.longitude) ? h.longitude : ''
    };
  }

  async function openFamily(id) {
    try {
      setError('');
      const res = await api.family(id);
      setDetail(res.data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveFamily(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const src = edit || add;
      if (!src.dwelling) throw new Error(isMr ? 'कृपया घर की फ्लॅट निवडा.' : 'Choose whether they live in a house or a flat.');
      let targetHouseId = src.houseId;

      if (src.dwelling === 'FLAT') {
        if (!src.apartmentId) throw new Error(isMr ? 'कृपया इमारत / अपार्टमेंट निवडा.' : 'Select the apartment this flat belongs to.');
        if (!src.flatNumber?.trim()) throw new Error(isMr ? 'कृपया फ्लॅट क्रमांक लिहा.' : 'Please enter the flat number.');
        const apt = formApartments.find(a => String(a.id) === String(src.apartmentId));
        let flatHouse = houses.find(
          h =>
            String(h.apartmentId || h.apartment?.id || '') === String(src.apartmentId) &&
            String(h.houseNumber || '').trim().toLowerCase() === String(src.flatNumber).trim().toLowerCase()
        );
        if (!flatHouse) {
          const housePayload = {
            houseNumber: src.flatNumber.trim(),
            apartmentId: src.apartmentId,
            areaId: apt?.areaId || apt?.area?.id,
            address: apt?.address || `${apt?.name || 'Apartment'}, Flat ${src.flatNumber.trim()}`,
            landmark: apt?.landmark || null,
            city: apt?.city || apt?.area?.city || 'Ahilyanagar',
            houseType: 'FLAT',
            ownership: src.ownership || 'OWN',
            ownerName: src.ownerName?.trim() || null,
            latitude: hasCoords(src.latitude, src.longitude) ? src.latitude : apt?.latitude || null,
            longitude: hasCoords(src.latitude, src.longitude) ? src.longitude : apt?.longitude || null
          };
          const created = (await api.createHouse(housePayload)).data;
          targetHouseId = created.id;
        } else {
          targetHouseId = flatHouse.id;
          const patch = {};
          if (src.ownership && src.ownership !== flatHouse.ownership) patch.ownership = src.ownership;
          if (src.ownerName !== undefined && src.ownerName !== flatHouse.ownerName)
            patch.ownerName = src.ownerName.trim() || null;
          if (hasCoords(src.latitude, src.longitude)) {
            patch.latitude = src.latitude;
            patch.longitude = src.longitude;
          }
          if (Object.keys(patch).length > 0) {
            await api.updateHouse(flatHouse.id, patch).catch(() => {});
          }
        }
      } else {
        if (!targetHouseId) throw new Error(isMr ? 'कृपया घर क्रमांक निवडा.' : 'Please select the house number.');
        const currentH = houses.find(h => String(h.id) === String(targetHouseId));
        const patch = {};
        if (src.ownership && src.ownership !== currentH?.ownership) patch.ownership = src.ownership;
        if (src.ownerName !== undefined && src.ownerName !== currentH?.ownerName)
          patch.ownerName = src.ownerName.trim() || null;
        if (hasCoords(src.latitude, src.longitude)) {
          patch.latitude = src.latitude;
          patch.longitude = src.longitude;
        }
        if (Object.keys(patch).length > 0) {
          await api.updateHouse(targetHouseId, patch).catch(() => {});
        }
      }

      const payload = {
        familyName: src.familyName?.trim(),
        houseId: targetHouseId,
        notes: src.notes?.trim() || null,
        nativeVillage: src.nativeVillage?.trim() || null,
        nativeTaluka: src.nativeTaluka?.trim() || null,
        nativeDistrict: src.nativeDistrict || null,
        nativeState: 'Maharashtra'
      };

      if (edit) {
        await api.updateFamily(edit.id, payload);
        window.dispatchEvent(
          new CustomEvent('ward:toast', {
            detail: {
              type: 'success',
              message: isMr ? `"${src.familyName}" कुटुंब माहिती अद्यतनित केली.` : `"${src.familyName}" updated successfully.`
            }
          })
        );
      } else {
        await api.createFamily(payload);
        window.dispatchEvent(
          new CustomEvent('ward:toast', {
            detail: {
              type: 'success',
              message: isMr ? `"${src.familyName}" कुटुंब यशस्वीरित्या जोडले.` : `"${src.familyName}" created successfully.`
            }
          })
        );
      }

      setEdit(null);
      setAdd(null);
      const [freshFam, freshHouses] = await Promise.all([
        api.families({ limit: 500, wardId: selectedWardId || undefined }),
        api.houses({ limit: 500, wardId: selectedWardId || undefined })
      ]);
      setRows(freshFam.data || []);
      setHouses(freshHouses.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveMember(e) {
    e.preventDefault();
    const familyId = memberFamilyId || detail?.id;
    if (!familyId) return;
    setBusy(true);
    try {
      const payload = { ...memberForm, familyId };
      delete payload.age;
      delete payload.voterProfile;
      delete payload.family;
      delete payload.house;
      if (editingMember) {
        await api.updatePerson(editingMember.id, payload);
        window.dispatchEvent(
          new CustomEvent('ward:toast', {
            detail: {
              type: 'success',
              message: isMr ? 'सदस्याची माहिती अद्यतनित केली.' : 'Member updated successfully.'
            }
          })
        );
      } else {
        await api.createPerson(payload);
        window.dispatchEvent(
          new CustomEvent('ward:toast', {
            detail: {
              type: 'success',
              message: isMr ? 'नवीन सदस्य कुटुंबामध्ये जोडला.' : 'Member added to family.'
            }
          })
        );
      }
      setMemberForm(null);
      setEditingMember(null);
      setMemberFamilyId('');
      await load();
      if (familyId) await openFamily(familyId);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteMember(id) {
    if (!confirm(isMr ? 'या सदस्याला कुटुंबामधून काढायचे आहे का?' : 'Remove this family member?')) return;
    try {
      await api.deletePerson(id);
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'success',
            message: isMr ? 'सदस्य काढण्यात आला.' : 'Member removed.'
          }
        })
      );
      if (detail?.id) await openFamily(detail.id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function openHouseLoc(house, familyId, fromDetail = false) {
    if (!house?.id) return;
    setLocFamilyId(familyId || detail?.id || '');
    setLocReturn(Boolean(fromDetail));
    if (fromDetail) setDetail(null);
    setHouseLoc(locForm(house));
  }

  async function saveHouseLoc(e) {
    e.preventDefault();
    if (!houseLoc?.id) return;
    if (!hasCoords(houseLoc.latitude, houseLoc.longitude)) {
      setError(isMr ? 'कृपया Use GPS दाबा किंवा नकाशावर टॅप करून अचूक स्थान सेट करा.' : 'Use GPS or tap the map to set the exact door pin before saving.');
      return;
    }
    setBusy(true);
    try {
      await api.updateHouse(houseLoc.id, geoPayload(houseLoc, ['latitude', 'longitude']));
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'success',
            message: isMr ? 'घराचे जीपीएस स्थान यशस्वीरित्या जतन केले.' : 'House location pin saved.'
          }
        })
      );
      const familyId = locFamilyId;
      const reopen = locReturn;
      setHouseLoc(null);
      setLocFamilyId('');
      setLocReturn(false);
      await load();
      if (reopen && familyId) await openFamily(familyId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function closeHouseLoc() {
    const familyId = locFamilyId;
    const reopen = locReturn;
    setHouseLoc(null);
    setLocFamilyId('');
    setLocReturn(false);
    if (reopen && familyId) openFamily(familyId);
  }

  return (
    <div className="admin-data-page families-page" style={{ paddingTop: '8px' }}>
      <PageHeader
        kicker={isMr ? 'कुटुंब व रहिवासी नोंदणी' : 'Household & Residency Register'}
        title={isMr ? 'कुटुंबे (Families)' : 'Families'}
        subtitle={
          isMr
            ? 'वॉर्डमधील सर्व कुटुंबे, निवासस्थाने, सदस्य आणि मतदार स्थिती व्यवस्थापित करा.'
            : 'Manage ward families, houses, members, voter status and home directions.'
        }
        action={
          canAddFamily ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => setAdd(emptyFamily())}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span>+</span>
              <span>{isMr ? 'कुटुंब जोडा' : 'Add Family'}</span>
            </button>
          ) : null
        }
      />

      <ErrorBox error={error} />

      {/* 4 Interactive KPI Metric Cards - 1 Single Row */}
      <div className="team-kpi-grid">
        <div
          className={`team-kpi-card ${!filters.homeKind && !filters.peopleFilter ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setFilters(f => ({ ...f, homeKind: '', peopleFilter: '' }))}
          title={isMr ? 'सर्व कुटुंबे पाहण्यासाठी क्लिक करा' : 'Click to view all families'}
        >
          <div className="team-kpi-icon blue">
            <UsersIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{!rows ? '…' : kpiStats.total}</div>
            <div className="team-kpi-label">{isMr ? 'एकूण कुटुंबे' : 'Total Families'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filters.homeKind === 'HOUSE' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() =>
            setFilters(f => ({
              ...f,
              homeKind: f.homeKind === 'HOUSE' ? '' : 'HOUSE',
              peopleFilter: ''
            }))
          }
          title={isMr ? 'स्वतंत्र घरांमध्ये राहणारी कुटुंबे' : 'Click to filter independent houses'}
        >
          <div className="team-kpi-icon green">
            <BuildingIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{!rows ? '…' : kpiStats.houses}</div>
            <div className="team-kpi-label">{isMr ? 'स्वतंत्र घरे' : 'Independent Houses'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filters.homeKind === 'FLAT' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() =>
            setFilters(f => ({
              ...f,
              homeKind: f.homeKind === 'FLAT' ? '' : 'FLAT',
              peopleFilter: ''
            }))
          }
          title={isMr ? 'फ्लॅट / इमारतीमध्ये राहणारी कुटुंबे' : 'Click to filter apartment flats'}
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
          className={`team-kpi-card ${filters.peopleFilter === 'OUT_OF_CITY' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() =>
            setFilters(f => ({
              ...f,
              peopleFilter: f.peopleFilter === 'OUT_OF_CITY' ? '' : 'OUT_OF_CITY',
              homeKind: ''
            }))
          }
          title={isMr ? 'बाहेरगावचे / मूळ गावाची नोंद असलेली कुटुंबे' : 'Click to filter native / migrant families'}
        >
          <div className="team-kpi-icon amber">
            <MapPinIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{!rows ? '…' : kpiStats.migrants}</div>
            <div className="team-kpi-label">{isMr ? 'बाहेरगाव / मूळ गाव' : 'Native / Migrants'}</div>
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
                placeholder={isMr ? 'शोधा…' : 'Search…'}
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
                onChange={e => setFilters({ ...filters, areaId: e.target.value, apartmentId: '' })}
                className="exec-filter-select"
              >
                <option value="">{isMr ? 'सर्व कॉलनी' : 'All colonies'}</option>
                {colonyOptions.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="exec-quick-status">
              <select
                value={filters.homeKind}
                onChange={v =>
                  setFilters({
                    ...filters,
                    homeKind: v.target.value,
                    apartmentId: v.target.value === 'HOUSE' ? '' : filters.apartmentId
                  })
                }
                className="exec-filter-select"
              >
                <option value="">{isMr ? 'सर्व निवास' : 'All Dwellings'}</option>
                <option value="HOUSE">{isMr ? 'स्वतंत्र घरे' : 'Houses'}</option>
                <option value="FLAT">{isMr ? 'फ्लॅट्स' : 'Flats'}</option>
              </select>
            </div>

            {filters.homeKind === 'FLAT' && (
              <div className="exec-quick-status">
                <select
                  value={filters.apartmentId || ''}
                  onChange={e => setFilters({ ...filters, apartmentId: e.target.value })}
                  className="exec-filter-select"
                >
                  <option value="">{isMr ? 'सर्व इमारती' : 'All apartments'}</option>
                  {listedApartments.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="exec-quick-presence">
              <select
                value={filters.peopleFilter}
                onChange={e => setFilters({ ...filters, peopleFilter: e.target.value })}
                className="exec-filter-select"
              >
                <option value="">{isMr ? 'सर्व सदस्य स्थिती' : 'All Presence'}</option>
                <option value="VOTER">{isMr ? '✓ मतदार कुटुंबे' : 'Voter Families'}</option>
                <option value="AT_HOME">{isMr ? 'घरी उपस्थित' : 'At Home'}</option>
                <option value="OUT_OF_CITY">{isMr ? 'बाहेरगावी असलेले' : 'Out of City'}</option>
                <option value="OUT_VOTER">{isMr ? 'बाहेरगावी मतदार' : 'Out-Voters'}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Symmetrical Families Table */}
      {!rows ? (
        <Loading />
      ) : !total ? (
        <Empty>
          {filters.search || filters.areaId || filters.homeKind || filters.peopleFilter || filters.apartmentId
            ? isMr
              ? 'या फिल्टरनुसार कोणतीही कुटुंबे सापडली नाहीत.'
              : 'No families match the selected filters.'
            : isMr
            ? 'या वॉर्डमध्ये कोणतीही कुटुंबे नोंदवलेली नाहीत.'
            : 'No families found for the selected ward.'}
        </Empty>
      ) : (
        <>
          <div className="panel table-wrap families-table-wrap">
            <table className="families-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>{isMr ? 'कुटुंब' : 'Family'}</th>
                  <th style={{ textAlign: 'left' }}>{isMr ? 'घर आणि निवासस्थान' : 'Residence & House'}</th>
                  <th style={{ textAlign: 'center' }}>{isMr ? 'रहिवासी वॉर्ड' : 'Resident Ward'}</th>
                  <th style={{ textAlign: 'center' }}>{isMr ? 'स्थान' : 'Location'}</th>
                  <th style={{ textAlign: 'center' }}>{isMr ? 'कृती' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(f => {
                  const initials = getInitials(f.familyName);
                  const wardNo = formatWardNumber(f.house?.area?.ward?.wardNumber);
                  const liveMembers = (f.members || []).filter(m => m.status !== 'DECEASED');
                  const voterCount = liveMembers.filter(isVoterPerson).length;

                  return (
                    <tr key={f.id}>
                      <td data-label="Family">
                        <div className="exec-cell-user">
                          <div
                            className="exec-avatar green"
                            onClick={() => openFamily(f.id)}
                            style={{ cursor: 'pointer' }}
                            title={isMr ? 'तपशील पाहण्यासाठी क्लिक करा' : 'Click to view details'}
                          >
                            {initials}
                          </div>
                          <div className="exec-cell-meta">
                            <button
                              type="button"
                              onClick={() => openFamily(f.id)}
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
                              {f.familyName
                                ? `${f.familyName} ${isMr ? 'कुटुंब' : 'Family'}`
                                : (isMr ? 'अनामित कुटुंब' : 'Unnamed Family')}
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  background: '#f1f5f9',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 6,
                                  padding: '1px 6px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#334155'
                                }}
                              >
                                {liveMembers.length} {isMr ? 'सदस्य' : 'Members'}
                              </span>
                              {voterCount > 0 && (
                                <span
                                  style={{
                                    background: '#ecfdf5',
                                    border: '1px solid #a7f3d0',
                                    color: '#065f46',
                                    borderRadius: 6,
                                    padding: '1px 6px',
                                    fontSize: '11px',
                                    fontWeight: 600
                                  }}
                                >
                                  ✓ {voterCount} {isMr ? 'मतदार' : 'Voters'}
                                </span>
                              )}
                            </div>
                            {f.nativeVillage && (
                              <div className="muted" style={{ fontSize: '11px', marginTop: 3 }}>
                                {f.nativeVillage}{f.nativeDistrict ? ` (${f.nativeDistrict})` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td data-label="Residence & House">
                        <ResidenceHouseCell house={resolveHouse(f.house)} isMr={isMr} aptName={getAptName(f.house)} />
                      </td>

                      <td data-label="Resident Ward" style={{ textAlign: 'center' }}>
                        {wardNo ? (
                          <span className="ward-pill-badge">{wardNo}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>

                      <td data-label="Location" style={{ textAlign: 'center' }}>
                        {hasCoords(f.house?.latitude, f.house?.longitude) ? (
                          <a
                            href={directionsUrl(f.house.latitude, f.house.longitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="exec-btn-dir"
                            onClick={e => e.stopPropagation()}
                            title={isMr ? 'गुगल मॅप्सवर घराचा मार्ग पहा' : 'View driving directions in Google Maps'}
                          >
                            <MapPinIcon size={12} />
                            <span>{isMr ? 'दिशा' : 'Directions'}</span>
                          </a>
                        ) : (
                          <span
                            className="exec-btn-dir disabled"
                            title={isMr ? 'घराचे स्थान पिन केलेले नाही' : 'House location not saved'}
                          >
                            <MapPinIcon size={12} style={{ opacity: 0.4 }} />
                            <span>{isMr ? 'पिन नाही' : 'No Pin'}</span>
                          </span>
                        )}
                      </td>

                      <td data-label="Actions" style={{ textAlign: 'center' }}>
                        <div className="exec-action-group">
                          <button
                            type="button"
                            className="exec-btn-view"
                            onClick={() => openFamily(f.id)}
                            title={isMr ? 'तपशील पहा' : 'View family details'}
                          >
                            <EyeIcon size={13} />
                            <span>{isMr ? 'पहा' : 'View'}</span>
                          </button>

                          {can('EDIT_FAMILIES') && (
                            <button
                              type="button"
                              className="exec-btn-edit"
                              onClick={() => setEdit(familyFromHouse(f))}
                              title={isMr ? 'कुटुंब माहिती संपादित करा' : 'Edit family'}
                            >
                              <EditIcon size={13} />
                              <span>{isMr ? 'संपादित' : 'Edit'}</span>
                            </button>
                          )}

                          <RowMenu
                            menuOnly
                            items={[
                              { label: isMr ? 'तपशील पहा' : 'View details', onClick: () => openFamily(f.id) },
                              can('CREATE_CITIZENS') && {
                                label: isMr ? '+ नवीन सदस्य जोडा' : '+ Add member',
                                onClick: () => {
                                  setEditingMember(null);
                                  setMemberFamilyId(f.id);
                                  setMemberForm({ ...emptyPerson, familyId: f.id });
                                }
                              },
                              hasCoords(f.house?.latitude, f.house?.longitude) && {
                                label: isMr ? 'गुगल मॅप्सवर दिशा' : 'Get directions',
                                onClick: () =>
                                  window.open(
                                    directionsUrl(f.house.latitude, f.house.longitude),
                                    '_blank',
                                    'noopener'
                                  )
                              },
                              pin && {
                                label: isMr ? 'घराचे स्थान बदला (GPS)' : 'Update house location',
                                onClick: () => openHouseLoc(f.house, f.id)
                              },
                              can('EDIT_FAMILIES') && {
                                label: isMr ? 'कुटुंब संपादित करा' : 'Edit family',
                                onClick: () => setEdit(familyFromHouse(f))
                              },
                              can('DELETE_FAMILIES') && {
                                label: isMr ? 'कुटुंब हटवा' : 'Delete family',
                                danger: true,
                                onClick: async () => {
                                  if (
                                    confirm(
                                      isMr
                                        ? 'हे कुटुंब हटवायचे आहे का?'
                                        : 'Move family to recycle bin?'
                                    )
                                  ) {
                                    try {
                                      await api.deleteFamily(f.id);
                                      window.dispatchEvent(
                                        new CustomEvent('ward:toast', {
                                          detail: {
                                            type: 'success',
                                            message: isMr ? 'कुटुंब यशस्वीरित्या हटवले.' : 'Family removed.'
                                          }
                                        })
                                      );
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

      {/* Executive Family Details Modal */}
      {detail && (
        <Modal
          wide
          title={`${detail.familyName ? `${detail.familyName} ${isMr ? 'कुटुंब' : 'Family'}` : 'Family'} · ${isMr ? 'कुटुंब तपशील' : 'Household Register'}`}
          onClose={() => {
            setDetail(null);
            setMemberForm(null);
            setEditingMember(null);
            setMemberFamilyId('');
          }}
        >
          <div className="exec-modal-profile-header">
            <div className="exec-modal-avatar green">
              {getInitials(detail.familyName)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {detail.familyName
                    ? `${detail.familyName} ${isMr ? 'कुटुंब' : 'Family'}`
                    : (isMr ? 'अनामित कुटुंब' : 'Family')}
                </h2>
                <span
                  style={{
                    background: isFlatHome(detail.house) ? '#f3e8ff' : '#f1f5f9',
                    border: `1px solid ${isFlatHome(detail.house) ? '#d8b4fe' : '#e2e8f0'}`,
                    color: isFlatHome(detail.house) ? '#6b21a8' : '#475569',
                    borderRadius: 6,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 600
                  }}
                >
                  {isFlatHome(detail.house)
                    ? `${getAptName(detail.house) || detail.house?.apartment?.name || (isMr ? 'अपार्टमेंट' : 'Apartment')} · ${isMr ? 'फ्लॅट' : 'Flat'} ${detail.house?.houseNumber || ''}`
                    : isMr
                    ? 'स्वतंत्र घर (House)'
                    : 'Independent House'}
                </span>
                <span className={`shop-ownership-badge ${detail.house?.ownership === 'OWN' ? 'own' : 'rent'}`}>
                  {ownershipLabel(detail.house?.ownership, isMr)}
                </span>
                <span
                  style={{
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    color: '#065f46',
                    borderRadius: 6,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  {(detail.members || []).filter(m => m.status !== 'DECEASED').length}{' '}
                  {isMr ? 'सदस्य' : 'Members'}
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
                <span>{formatWardLabel(detail.house?.area?.ward)}</span>
                <span>•</span>
                <span>{detail.house?.area?.name || '—'}</span>
                {detail.nativeVillage && (
                  <>
                    <span>•</span>
                    <span>
                      {detail.nativeVillage}
                      {detail.nativeDistrict ? `, ${detail.nativeDistrict}` : ''}
                    </span>
                  </>
                )}
              </div>
            </div>

            {can('CREATE_CITIZENS') && (
              <button
                type="button"
                className="exec-modal-btn primary"
                style={{ height: 34, padding: '0 12px', fontSize: 12 }}
                onClick={() => {
                  setEditingMember(null);
                  setMemberFamilyId(detail.id);
                  setMemberForm({ ...emptyPerson, familyId: detail.id });
                }}
              >
                <span>+</span>
                <span>{isMr ? 'सदस्य जोडा' : 'Add Member'}</span>
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
                  <span className="prof-spec-k">{isMr ? 'निवास प्रकार' : 'Dwelling Type'}</span>
                  <span className="prof-spec-v">
                    {isFlatHome(detail.house) ? (isMr ? 'फ्लॅट' : 'Apartment Flat') : isMr ? 'स्वतंत्र घर' : 'Independent House'}
                  </span>
                </div>
                {isFlatHome(detail.house) && (
                  <div className="prof-spec-row">
                    <span className="prof-spec-k">{isMr ? 'इमारत / अपार्टमेंट' : 'Apartment'}</span>
                    <span className="prof-spec-v">{getAptName(detail.house) || '—'}</span>
                  </div>
                )}
                <div className="prof-spec-row">
                  <span className="prof-spec-k">
                    {isFlatHome(detail.house) ? (isMr ? 'फ्लॅट क्र.' : 'Flat No.') : isMr ? 'घर क्र.' : 'House No.'}
                  </span>
                  <span className="prof-spec-v">{detail.house?.houseNumber || '—'}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'जागा मालकी' : 'Ownership'}</span>
                  <span className="prof-spec-v">
                    <span className={`shop-ownership-badge ${detail.house?.ownership === 'OWN' ? 'own' : 'rent'}`}>
                      {ownershipLabel(detail.house?.ownership, isMr)}
                    </span>
                  </span>
                </div>
                {detail.house?.ownerName && (
                  <div className="prof-spec-row">
                    <span className="prof-spec-k">{isMr ? 'घर मालक' : 'Property Owner'}</span>
                    <span className="prof-spec-v">{detail.house.ownerName}</span>
                  </div>
                )}
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'वॉर्ड' : 'Ward'}</span>
                  <span className="prof-spec-v">{formatWardLabel(detail.house?.area?.ward, '—')}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'कॉलनी' : 'Colony'}</span>
                  <span className="prof-spec-v">{detail.house?.area?.name || '—'}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'संपूर्ण पत्ता' : 'Full Address'}</span>
                  <span className="prof-spec-v">{detail.house?.address || housePlace(resolveHouse(detail.house)) || '—'}</span>
                </div>
                {detail.house?.landmark && (
                  <div className="prof-spec-row">
                    <span className="prof-spec-k">{isMr ? 'जवळची खूण' : 'Landmark'}</span>
                    <span className="prof-spec-v">{detail.house.landmark}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="prof-detail-card">
              <div className="prof-card-title">
                <FileTextIcon size={16} />
                <span>{isMr ? 'मूळ गाव व शेरा' : 'Native Place & Notes'}</span>
              </div>
              <div className="prof-spec-list">
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'मूळ गाव' : 'Native Village'}</span>
                  <span className="prof-spec-v">{detail.nativeVillage || (isMr ? 'नोंद नाही' : 'Not recorded')}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'तालुका' : 'Taluka'}</span>
                  <span className="prof-spec-v">{detail.nativeTaluka || '—'}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'जिल्हा' : 'District'}</span>
                  <span className="prof-spec-v">{detail.nativeDistrict || '—'}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'राज्य' : 'State'}</span>
                  <span className="prof-spec-v">{detail.nativeState || 'Maharashtra'}</span>
                </div>
                <div className="prof-spec-row">
                  <span className="prof-spec-k">{isMr ? 'सदस्य' : 'Members'}</span>
                  <span className="prof-spec-v">{(detail.members || []).filter(m => m.status !== 'DECEASED').length}</span>
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
              {hasCoords(detail.house?.latitude, detail.house?.longitude) && (
                <a
                  href={directionsUrl(detail.house.latitude, detail.house.longitude)}
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
              lat={detail.house?.latitude}
              lng={detail.house?.longitude}
              label={detail.house?.houseNumber ? `House ${detail.house.houseNumber}` : detail.familyName}
            >
              {pin && (
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="small-btn loc-update-btn" onClick={() => openHouseLoc(detail.house, detail.id, true)}>
                    {isMr ? 'स्थान अपडेट करा' : 'Update Location'}
                  </button>
                </div>
              )}
            </MapPreview>
          </div>

          {/* Family Members Section */}
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
                  {isMr ? 'कुटुंबातील सदस्य' : 'Household Members'} (
                  {(detail.members || []).filter(m => m.status !== 'DECEASED').length})
                </h3>
                <span className="muted" style={{ fontSize: 11.5 }}>
                  {isMr
                    ? 'या कुटुंबातील सर्व नोंदणीकृत नागरिक आणि मतदार'
                    : 'Active citizens and voters associated with this household'}
                </span>
              </div>
              {can('CREATE_CITIZENS') && (
                <button
                  type="button"
                  className="primary-btn"
                  style={{ padding: '5px 12px', fontSize: 12, height: 30 }}
                  onClick={() => {
                    setEditingMember(null);
                    setMemberFamilyId(detail.id);
                    setMemberForm({ ...emptyPerson, familyId: detail.id });
                  }}
                >
                  + {isMr ? 'सदस्य जोडा' : 'Add Member'}
                </button>
              )}
            </div>

            {!(detail.members || []).filter(m => m.status !== 'DECEASED').length ? (
              <Empty>{isMr ? 'या कुटुंबामध्ये अजून कोणतेही सदस्य जोडलेले नाहीत.' : 'No active members in this family yet.'}</Empty>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 12,
                  marginTop: 12
                }}
              >
                {(detail.members || [])
                  .filter(m => m.status !== 'DECEASED')
                  .map(m => {
                    const isVoter = isVoterPerson(m);
                    return (
                      <div
                        key={m.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                          <div>
                            <button
                              type="button"
                              onClick={() => setMemberDetail(m)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                margin: 0,
                                font: 'inherit',
                                fontWeight: 700,
                                fontSize: 13.5,
                                color: '#0f172a',
                                cursor: 'pointer',
                                textAlign: 'left'
                              }}
                              title="View member details"
                            >
                              {m.fullName}
                            </button>
                            <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                              {m.age != null ? `${m.age} yrs` : 'Age N/A'}
                              {m.gender ? ` · ${m.gender}` : ''}
                              {m.mobile && ` · ${m.mobile}`}
                            </div>
                          </div>
                          <span
                            style={{
                              background: isVoter ? '#ecfdf5' : '#f1f5f9',
                              border: `1px solid ${isVoter ? '#a7f3d0' : '#cbd5e1'}`,
                              color: isVoter ? '#065f46' : '#475569',
                              fontSize: 10.5,
                              fontWeight: 700,
                              borderRadius: 4,
                              padding: '1px 6px'
                            }}
                          >
                            {isVoter ? (isMr ? '✓ मतदार' : '✓ Voter') : isMr ? 'अमतदार' : 'Non-Voter'}
                          </span>
                        </div>

                        <div className="muted" style={{ fontSize: 11 }}>
                          {m.occupationType ? (
                            <span>💼 {m.occupationType}</span>
                          ) : (
                            <span>{m.occupation || '—'}</span>
                          )}
                          {presenceLine(m) && <span> · {presenceLine(m)}</span>}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                          <RowMenu
                            items={[
                              { label: isMr ? 'माहिती पहा' : 'View details', onClick: () => setMemberDetail(m) },
                              can('EDIT_CITIZENS') && {
                                label: isMr ? 'संपादित करा' : 'Edit member',
                                onClick: () => {
                                  setEditingMember(m);
                                  setMemberFamilyId(detail.id);
                                  setMemberForm({
                                    ...emptyPerson,
                                    ...m,
                                    isRetired: Boolean(m.isRetired),
                                    retiredFrom: m.retiredFrom || '',
                                    retiredService: m.retiredService || '',
                                    isVoter:
                                      m.voterProfile?.status === 'VOTER'
                                        ? 'VOTER'
                                        : m.voterProfile?.status === 'NON_VOTER'
                                        ? 'NON_VOTER'
                                        : '',
                                    officialVoterIdRef: m.voterProfile?.officialVoterIdRef || '',
                                    votingWard: m.voterProfile?.votingWard || '',
                                    constituency: m.voterProfile?.constituency || ''
                                  });
                                }
                              },
                              can('CREATE_DEATH_RECORDS') && {
                                label: isMr ? 'मृत्यू नोंद करा' : 'Mark deceased',
                                danger: true,
                                onClick: () => setDeathPerson(m)
                              },
                              can('DELETE_CITIZENS') && {
                                label: isMr ? 'काढून टाका' : 'Remove from family',
                                danger: true,
                                onClick: () => deleteMember(m.id)
                              }
                            ].filter(Boolean)}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="exec-modal-footer">
            <button
              type="button"
              className="exec-modal-btn ghost"
              onClick={() => {
                setDetail(null);
                setMemberForm(null);
                setEditingMember(null);
                setMemberFamilyId('');
              }}
            >
              {isMr ? 'बंद करा' : 'Close'}
            </button>
            {can('EDIT_FAMILIES') && (
              <button
                type="button"
                className="exec-modal-btn primary"
                onClick={() => {
                  const f = detail;
                  setDetail(null);
                  setEdit(familyFromHouse(f));
                }}
              >
                <EditIcon size={13} />
                <span>{isMr ? 'कुटुंब संपादित करा' : 'Edit Family'}</span>
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Member Details Modal */}
      {memberDetail && (
        <Modal
          wide
          layer={2}
          title={`${memberDetail.fullName} · ${isMr ? 'सदस्य तपशील' : 'Member Details'}`}
          onClose={() => setMemberDetail(null)}
        >
          <div className="exec-detail-grid">
            <div className="exec-detail-card">
              <h3>{isMr ? 'वैयक्तिक माहिती' : 'Personal Information'}</h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'पूर्ण नाव' : 'Full Name'}</span>
                <span className="exec-detail-val">{memberDetail.fullName}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'मोबाईल' : 'Mobile'}</span>
                <span className="exec-detail-val">{memberDetail.mobile || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'जन्मदिनांक / वय' : 'DOB / Age'}</span>
                <span className="exec-detail-val">
                  {memberDetail.dob || '—'} ·{' '}
                  {memberDetail.age == null ? '—' : `${memberDetail.age} years`}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'लिंग' : 'Gender'}</span>
                <span className="exec-detail-val">{memberDetail.gender || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'सध्याचे स्थान' : 'Where Now'}</span>
                <span className="exec-detail-val">{presenceLine(memberDetail) || 'At home'}</span>
              </div>
            </div>

            <div className="exec-detail-card">
              <h3>{isMr ? 'व्यवसाय / नोकरी माहिती' : 'Occupation & Job'}</h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'प्रकार' : 'Type'}</span>
                <span className="exec-detail-val">{memberDetail.occupationType || '—'}</span>
              </div>
              {memberDetail.occupationType === 'BUSINESS' ? (
                <>
                  <div className="exec-detail-row">
                    <span className="exec-detail-label">{isMr ? 'व्यवसाय' : 'Business'}</span>
                    <span className="exec-detail-val">{memberDetail.businessName || '—'}</span>
                  </div>
                  <div className="exec-detail-row">
                    <span className="exec-detail-label">{isMr ? 'पत्ता' : 'Address'}</span>
                    <span className="exec-detail-val">{memberDetail.businessAddress || '—'}</span>
                  </div>
                </>
              ) : memberDetail.occupationType === 'SERVICE' ? (
                <>
                  <div className="exec-detail-row">
                    <span className="exec-detail-label">{isMr ? 'कंपनी' : 'Company'}</span>
                    <span className="exec-detail-val">{memberDetail.companyName || '—'}</span>
                  </div>
                  <div className="exec-detail-row">
                    <span className="exec-detail-label">{isMr ? 'नोकरी प्रकार' : 'Employment'}</span>
                    <span className="exec-detail-val">{memberDetail.employmentType || '—'}</span>
                  </div>
                </>
              ) : memberDetail.isRetired || memberDetail.occupationType === 'RETIRED' ? (
                <>
                  <div className="exec-detail-row">
                    <span className="exec-detail-label">{isMr ? 'स्थिती' : 'Status'}</span>
                    <span className="exec-detail-val">
                      <span className="status-pill warn">{isMr ? 'निवृत्त (Retired)' : 'Retired'}</span>
                    </span>
                  </div>
                  <div className="exec-detail-row">
                    <span className="exec-detail-label">{isMr ? 'निवृत्त संस्था' : 'Retired From'}</span>
                    <span className="exec-detail-val">{memberDetail.retiredFrom || '—'}</span>
                  </div>
                </>
              ) : (
                <div className="exec-detail-row">
                  <span className="exec-detail-label">{isMr ? 'व्यवसाय' : 'Occupation'}</span>
                  <span className="exec-detail-val">{memberDetail.occupation || '—'}</span>
                </div>
              )}
            </div>

            <div className="exec-detail-card">
              <h3>{isMr ? 'मतदार माहिती' : 'Voter Status'}</h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'मतदार पात्रता' : 'Status'}</span>
                <span className="exec-detail-val">{memberDetail.voterProfile?.status || 'NOT_SPECIFIED'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'मतदार ओळखपत्र (EPIC)' : 'Voter ID (EPIC)'}</span>
                <span className="exec-detail-val">{memberDetail.voterProfile?.officialVoterIdRef || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'मतदान वॉर्ड' : 'Voting Ward'}</span>
                <span className="exec-detail-val">{memberDetail.voterProfile?.votingWard || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'मतदारसंघ' : 'Constituency'}</span>
                <span className="exec-detail-val">{memberDetail.voterProfile?.constituency || '—'}</span>
              </div>
            </div>
          </div>

          <div className="exec-modal-footer">
            <button type="button" className="exec-modal-btn ghost" onClick={() => setMemberDetail(null)}>
              {isMr ? 'बंद करा' : 'Close'}
            </button>
            {can('EDIT_CITIZENS') && (
              <button
                type="button"
                className="exec-modal-btn primary"
                onClick={() => {
                  const m = memberDetail;
                  setMemberDetail(null);
                  setEditingMember(m);
                  setMemberFamilyId(detail?.id || m.familyId || '');
                  setMemberForm({
                    ...emptyPerson,
                    ...m,
                    isRetired: Boolean(m.isRetired),
                    retiredFrom: m.retiredFrom || '',
                    retiredService: m.retiredService || '',
                    isVoter:
                      m.voterProfile?.status === 'VOTER'
                        ? 'VOTER'
                        : m.voterProfile?.status === 'NON_VOTER'
                        ? 'NON_VOTER'
                        : '',
                    officialVoterIdRef: m.voterProfile?.officialVoterIdRef || '',
                    votingWard: m.voterProfile?.votingWard || '',
                    constituency: m.voterProfile?.constituency || ''
                  });
                }}
              >
                <EditIcon size={13} />
                <span>{isMr ? 'सदस्य संपादित करा' : 'Edit Member'}</span>
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* House Location GPS Modal */}
      {houseLoc && (
        <Modal
          wide
          title={
            isMr
              ? `घराचे अचूक स्थान अपडेट करा · House ${houseLoc.houseNumber || ''}`
              : `Update Location · House ${houseLoc.houseNumber || ''}`
          }
          onClose={closeHouseLoc}
        >
          <form className="admin-form" onSubmit={saveHouseLoc} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="exec-form-section" style={{ margin: 0 }}>
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <MapPinIcon size={16} style={{ color: '#0f766e' }} />
                  <span>{isMr ? 'घराचे अचूक जीपीएस स्थान' : 'Exact Home GPS Location'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'प्रवेशद्वारावर उभे राहून Use GPS दाबा' : 'Stand at the front door and tap Use GPS'}
                </span>
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
                    ? 'घराच्या प्रवेशद्वारावर उभे राहून Use GPS दाबा.'
                    : 'Stand at the door and tap Use GPS. Only the map pin is saved.'
                }
              />
            </div>

            <div className="exec-modal-footer">
              <button type="button" className="exec-modal-btn ghost" onClick={closeHouseLoc}>
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button type="submit" className="exec-modal-btn primary" disabled={busy}>
                {busy ? (isMr ? 'जतन करत आहे…' : 'Saving…') : isMr ? 'स्थान जतन करा' : 'Save Location'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add / Edit Member PersonForm Modal */}
      {memberForm && (
        <Modal
          wide
          title={
            editingMember
              ? isMr
                ? `सदस्य संपादित करा · ${editingMember.fullName || 'Member'}`
                : `Edit Family Member · ${editingMember.fullName || 'Member'}`
              : isMr
              ? 'नवीन कुटुंब सदस्य जोडा'
              : 'Add Family Member'
          }
          onClose={() => {
            setMemberForm(null);
            setEditingMember(null);
            setMemberFamilyId('');
          }}
        >
          <PersonForm
            value={memberForm}
            onChange={setMemberForm}
            hideFamily
            wards={wards}
            onSubmit={saveMember}
            onCancel={() => {
              setMemberForm(null);
              setEditingMember(null);
              setMemberFamilyId('');
            }}
            busy={busy}
          />
        </Modal>
      )}

      {/* Redesigned 4-Section Professional Family Form Modal */}
      {(edit || add) && (
        <Modal
          wide
          title={
            edit
              ? isMr
                ? `${edit.familyName || 'कुटुंब'} - माहिती संपादित करा`
                : `Edit ${edit.familyName || 'Family'}`
              : isMr
              ? 'नवीन कुटुंब जोडा'
              : 'Add New Family'
          }
          onClose={() => {
            setEdit(null);
            setAdd(null);
          }}
        >
          <form className="admin-form" onSubmit={saveFamily} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ErrorBox error={error} />

            {/* Section 1: Family Basic Info */}
            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <UsersIcon size={16} style={{ color: '#0f766e' }} />
                  <span>{isMr ? '१. कुटुंबाची माहिती' : '1. Family Details'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'कुटुंबाचे नाव आणि राहत्या घराचा प्रकार' : 'Family name and dwelling classification'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                <Field label={isMr ? 'कुटुंबाचे नाव (आडनाव / कुटुंब नाव) *' : 'Family Name (Surname / Family) *'}>
                  <input
                    required
                    value={form.familyName || ''}
                    onChange={e => patchForm({ ...form, familyName: e.target.value })}
                    placeholder={isMr ? 'उदा. पाटील कुटुंब, देशमुख कुटुंब' : 'e.g. Patil family, Deshmukh household'}
                  />
                </Field>

                <Field label={isMr ? 'निवास प्रकार निवडा *' : 'Dwelling Type *'}>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setDwelling('HOUSE')}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: form.dwelling === 'HOUSE' ? '2px solid #059669' : '1px solid #cbd5e1',
                        background: form.dwelling === 'HOUSE' ? '#ecfdf5' : '#ffffff',
                        color: form.dwelling === 'HOUSE' ? '#065f46' : '#475569',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <BuildingIcon size={16} />
                      <span>{isMr ? 'स्वतंत्र घर (House)' : 'Independent House'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDwelling('FLAT')}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: form.dwelling === 'FLAT' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: form.dwelling === 'FLAT' ? '#eff6ff' : '#ffffff',
                        color: form.dwelling === 'FLAT' ? '#1e40af' : '#475569',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <BuildingIcon size={16} />
                      <span>{isMr ? 'फ्लॅट (Apartment)' : 'Apartment Flat'}</span>
                    </button>
                  </div>
                </Field>
              </div>
            </div>

            {/* Section 2: Residence & House Details */}
            {form.dwelling === 'HOUSE' && (
              <div className="exec-form-section">
                <div className="exec-form-section-header">
                  <div className="exec-form-section-title">
                    <BuildingIcon size={16} style={{ color: '#0f766e' }} />
                    <span>{isMr ? '२. स्वतंत्र घर निवड' : '2. House Selection & Ownership'}</span>
                  </div>
                  <span className="exec-form-section-desc">
                    {isMr ? 'घर क्रमांक व जागा मालकी प्रकार' : 'House number and premise ownership status'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                  <Field label={isMr ? 'घर क्रमांक निवडा *' : 'House Number *'}>
                    <SearchableSelect
                      required
                      value={form.houseId || ''}
                      onChange={v => {
                        const h = houses.find(x => String(x.id) === String(v));
                        patchForm({
                          ...form,
                          houseId: v,
                          ownership: h?.ownership || form.ownership || 'OWN',
                          ownerName: h?.ownerName || form.ownerName || '',
                          latitude: hasCoords(h?.latitude, h?.longitude) ? h.latitude : form.latitude || '',
                          longitude: hasCoords(h?.latitude, h?.longitude) ? h.longitude : form.longitude || ''
                        });
                      }}
                      options={independentHouses.map(homePickOption)}
                      placeholder={
                        independentHouses.length
                          ? isMr
                            ? 'घर क्रमांक शोधा…'
                            : 'Search house number…'
                          : isMr
                          ? 'अजून स्वतंत्र घरे नाहीत'
                          : 'No independent houses registered yet'
                      }
                    />
                  </Field>

                  <Field label={isMr ? 'घर मालकी प्रकार *' : 'House Ownership *'}>
                    <SearchableSelect
                      required
                      value={form.ownership || 'OWN'}
                      onChange={v => patchForm({ ...form, ownership: v })}
                      options={[
                        { value: 'OWN', label: isMr ? 'स्वतःची जागा (Own)' : 'Own' },
                        { value: 'RENT', label: isMr ? 'भाड्याची जागा (Rented)' : 'Rented' }
                      ]}
                      placeholder={isMr ? 'मालकी निवडा…' : 'Select ownership…'}
                    />
                  </Field>

                  <Field label={isMr ? 'घर मालकाचे नाव (पर्यायी)' : 'House Owner Name (Optional)'}>
                    <input
                      value={form.ownerName || ''}
                      onChange={e => patchForm({ ...form, ownerName: e.target.value })}
                      placeholder={isMr ? 'घर मालकाचे नाव' : 'Building / property owner name'}
                    />
                  </Field>
                </div>
              </div>
            )}

            {form.dwelling === 'FLAT' && (
              <div className="exec-form-section">
                <div className="exec-form-section-header">
                  <div className="exec-form-section-title">
                    <BuildingIcon size={16} style={{ color: '#0f766e' }} />
                    <span>{isMr ? '२. इमारत व फ्लॅट क्रमांक' : '2. Apartment & Flat Details'}</span>
                  </div>
                  <span className="exec-form-section-desc">
                    {isMr ? 'इमारत नाव व फ्लॅट क्रमांक' : 'Select apartment building and enter flat number'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <Field label={isMr ? 'इमारत / अपार्टमेंट *' : 'Apartment Building *'}>
                    <SearchableSelect
                      required
                      value={form.apartmentId || ''}
                      onChange={pickApartmentForFamily}
                      options={formApartments.map(a => ({
                        value: a.id,
                        label: a.name,
                        hint: a.area?.name || ''
                      }))}
                      placeholder={
                        formApartments.length
                          ? isMr
                            ? 'इमारत शोधा…'
                            : 'Search apartment…'
                          : isMr
                          ? 'अजून इमारती नाहीत'
                          : 'No apartments found'
                      }
                    />
                  </Field>

                  <Field label={isMr ? 'फ्लॅट क्रमांक *' : 'Flat Number *'}>
                    <input
                      required
                      value={form.flatNumber || ''}
                      onChange={e => patchForm({ ...form, flatNumber: e.target.value })}
                      placeholder={isMr ? 'उदा. 101, A-202, Flat 3B' : 'e.g. 101, A-202, Flat 3B'}
                    />
                  </Field>

                  <Field label={isMr ? 'फ्लॅट मालकी प्रकार *' : 'Flat Ownership *'}>
                    <SearchableSelect
                      required
                      value={form.ownership || 'OWN'}
                      onChange={v => patchForm({ ...form, ownership: v })}
                      options={[
                        { value: 'OWN', label: isMr ? 'स्वतःची जागा (Own)' : 'Own' },
                        { value: 'RENT', label: isMr ? 'भाड्याची जागा (Rented)' : 'Rented' }
                      ]}
                      placeholder={isMr ? 'मालकी निवडा…' : 'Select ownership…'}
                    />
                  </Field>

                  <Field label={isMr ? 'फ्लॅट मालकाचे नाव (पर्यायी)' : 'Flat Owner Name (Optional)'}>
                    <input
                      value={form.ownerName || ''}
                      onChange={e => patchForm({ ...form, ownerName: e.target.value })}
                      placeholder={isMr ? 'फ्लॅट मालकाचे पूर्ण नाव' : 'Flat owner full name'}
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* Section 3: GPS Pin */}
            {form.dwelling && (
              <div className="exec-form-section">
                <div className="exec-form-section-header">
                  <div className="exec-form-section-title">
                    <MapPinIcon size={16} style={{ color: '#0f766e' }} />
                    <span>{isMr ? '३. घराचे अचूक जीपीएस स्थान' : '3. Exact Home GPS Location'}</span>
                  </div>
                  <span className="exec-form-section-desc">
                    {isMr
                      ? 'प्रवेशद्वारावर उभे राहून Use GPS दाबा. हे स्थान कुटुंबातील सर्व सदस्यांना लागू होते.'
                      : 'Stand at the front door and tap Use GPS. Saved for all household members.'}
                  </span>
                </div>

                {hasCoords(form.latitude, form.longitude) ? (
                  <div
                    style={{
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      color: '#065f46',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckIcon size={15} style={{ color: '#059669' }} />
                      <span>
                        <strong>{isMr ? 'जीपीएस पिन सक्रिय आहे:' : 'GPS Pin Active:'}</strong> Lat{' '}
                        {Number(form.latitude).toFixed(6)}, Lng {Number(form.longitude).toFixed(6)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => patchForm({ ...form, latitude: '', longitude: '' })}
                      style={{
                        color: '#dc2626',
                        border: '1px solid #fca5a5',
                        background: '#fff',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      title={isMr ? 'पिन काढा' : 'Remove pin'}
                    >
                      ✕ {isMr ? 'पिन काढा' : 'Remove pin'}
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      color: '#92400e',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <MapPinIcon size={14} style={{ color: '#d97706' }} />
                    <span>
                      {isMr
                        ? 'अजून जीपीएस पिन सेट केलेला नाही. खालील नकाशावर "Use GPS" दाबा किंवा अचूक जागेवर टॅप करा.'
                        : 'No GPS pin set yet. Stand at the door and tap "Use GPS" below or click on the map.'}
                    </span>
                  </div>
                )}

                <LocationPicker
                  key={edit?.id || form.apartmentId || form.houseId || 'family-loc-picker'}
                  value={form}
                  onChange={next => patchForm({ ...form, latitude: next.latitude, longitude: next.longitude })}
                  centerFrom={[
                    form.dwelling === 'FLAT'
                      ? formApartments.find(a => String(a.id) === String(form.apartmentId))?.area
                      : houses.find(h => String(h.id) === String(form.houseId))?.area,
                    form.dwelling === 'FLAT'
                      ? formApartments.find(a => String(a.id) === String(form.apartmentId))
                      : houses.find(h => String(h.id) === String(form.houseId))?.area?.ward
                  ]}
                  hint={
                    isMr
                      ? 'घराच्या प्रवेशद्वारावर उभे राहून Use GPS दाबा.'
                      : 'Stand at the door and tap Use GPS.'
                  }
                />
              </div>
            )}

            {/* Section 4: Native Roots & Notes */}
            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <FileTextIcon size={16} style={{ color: '#0f766e' }} />
                  <span>{isMr ? '४. मूळ गाव व शेरा (पर्यायी)' : '4. Native Roots & Notes (Optional)'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'गावाकडील मूळ माहिती व कुटुंबाची नोंद' : 'Ancestral origins and household survey notes'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <Field label={isMr ? 'मूळ गाव' : 'Native Village'}>
                  <input
                    value={form.nativeVillage || ''}
                    onChange={e => patchForm({ ...form, nativeVillage: e.target.value, nativeState: 'Maharashtra' })}
                    placeholder={isMr ? 'उदा. सावेडी, पाथर्डी, कोपरगाव' : 'e.g. Savedi, Pathardi, Kopargaon'}
                  />
                </Field>

                <Field label={isMr ? 'तालुका' : 'Taluka'}>
                  <input
                    value={form.nativeTaluka || ''}
                    onChange={e => patchForm({ ...form, nativeTaluka: e.target.value, nativeState: 'Maharashtra' })}
                    placeholder={isMr ? 'तालुका नाव' : 'Taluka'}
                  />
                </Field>

                <Field label={isMr ? 'जिल्हा' : 'District'}>
                  <SearchableSelect
                    value={form.nativeDistrict || ''}
                    onChange={v => patchForm({ ...form, nativeDistrict: v, nativeState: 'Maharashtra' })}
                    options={districtOptions}
                    placeholder={isMr ? 'जिल्हा शोधा…' : 'Search district…'}
                  />
                </Field>

                <Field label={isMr ? 'राज्य' : 'State'}>
                  <input value="Maharashtra" readOnly disabled />
                </Field>
              </div>

              <Field label={isMr ? 'कुटुंब शेरा / विशेष नोंद' : 'Household Notes & Remarks'}>
                <textarea
                  rows={2}
                  value={form.notes || ''}
                  onChange={e => patchForm({ ...form, notes: e.target.value })}
                  placeholder={
                    isMr
                      ? 'काही विशेष नोंद किंवा सर्वेक्षण माहिती असल्यास येथे लिहा…'
                      : 'Add any survey remarks, social schemes, or notes here…'
                  }
                />
              </Field>
            </div>

            <div className="exec-modal-footer">
              <button
                type="button"
                className="exec-modal-btn ghost"
                onClick={() => {
                  setEdit(null);
                  setAdd(null);
                }}
              >
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button type="submit" className="exec-modal-btn primary" disabled={busy}>
                {busy
                  ? isMr
                    ? 'जतन करत आहे…'
                    : 'Saving…'
                  : edit
                  ? isMr
                    ? 'बदल जतन करा'
                    : 'Save Changes'
                  : isMr
                  ? '+ कुटुंब जतन करा'
                  : '+ Create Family'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deathPerson && (
        <DeathAction
          trigger={false}
          person={deathPerson}
          onSaved={() => {
            if (detail?.id) openFamily(detail.id);
            load();
          }}
          onClose={() => setDeathPerson(null)}
        />
      )}
    </div>
  );
}
