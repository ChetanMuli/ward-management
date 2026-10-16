import React, { useEffect, useMemo, useState } from 'react';
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
import { useWardFilter } from '../wardFilter';
import { can, canModule, isNagarsevak, isEmployee } from '../rbac';
import { directionsUrl, geoPayload, hasCoords } from '../location';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import LocationPicker, { DirectionsLink, MapPreview } from '../components/LocationMap';
import { getLanguage } from '../language';
import {
  StoreIcon,
  BuildingIcon,
  UsersIcon,
  MapPinIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  EditIcon,
  SearchIcon,
  PhoneIcon,
  FileTextIcon
} from '../components/Icons';

const blank = {
  name: '',
  kind: 'SHOP',
  category: '',
  categoryCustom: '',
  wardId: '',
  areaId: '',
  address: '',
  landmark: '',
  ownerName: '',
  ownerMobile: '',
  propertyOwnerName: '',
  propertyOwnerMobile: '',
  ownership: 'OWN',
  openingHours: '',
  notes: '',
  latitude: '',
  longitude: ''
};

const CATEGORIES = [
  'Grocery',
  'Medical / Pharmacy',
  'Hardware',
  'Electrical',
  'Clothing',
  'Hotel / Restaurant',
  'Salon',
  'Mobile / Electronics',
  'Bank / Finance',
  'Clinic',
  'Advocate',
  'Other'
];

function categoryParts(category) {
  const value = String(category || '').trim();
  if (!value) return { category: '', categoryCustom: '' };
  if (CATEGORIES.includes(value) && value !== 'Other') return { category: value, categoryCustom: '' };
  return { category: 'Other', categoryCustom: value === 'Other' ? '' : value };
}

function ownershipLabel(v, isMr = false) {
  if (v === 'OWN') return isMr ? 'स्वतःची (Own)' : 'Own';
  if (v === 'RENT') return isMr ? 'भाड्याने (Rent)' : 'Rent';
  if (v === 'OTHER') return isMr ? 'इतर (Other)' : 'Other';
  return '—';
}

function getInitials(name) {
  if (!name) return 'SO';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Shops() {
  const { selectedWardId } = useWardFilter();
  const isMr = getLanguage() === 'mr';

  const [rows, setRows] = useState(null);
  const [wards, setWards] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    kind: '',
    ownership: '',
    areaId: ''
  });
  const [edit, setEdit] = useState(null);
  const [add, setAdd] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [listTotal, setListTotal] = useState(0);
  const [kpiStats, setKpiStats] = useState({ total: 0, shops: 0, offices: 0, owned: 0, rented: 0 });
  const [shopLoc, setShopLoc] = useState(null);
  const [busyLoc, setBusyLoc] = useState(false);
  const [busy, setBusy] = useState(false);

  const canAdd = can('CREATE_HOUSES') || canModule('HOUSES', 'CREATE') || isNagarsevak() || isEmployee();
  const canPin = can('EDIT_HOUSES') || canModule('HOUSES', 'EDIT') || canAdd;

  async function load() {
    try {
      setError('');
      const res = await api.shops({
        page,
        limit: pageSize,
        wardId: selectedWardId || undefined,
        areaId: filters.areaId || undefined,
        kind: filters.kind || undefined,
        ownership: filters.ownership || undefined,
        search: filters.search || undefined
      });
      setRows(res.data || []);
      setListTotal(Number(res.meta?.total) || 0);
      if (res.meta?.kpis) setKpiStats(res.meta.kpis);
    } catch (e) {
      setError(e.message);
      setRows([]);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [selectedWardId, filters.search, filters.kind, filters.ownership, filters.areaId, page, pageSize]);

  useEffect(() => {
    api.wards()
      .then(w => setWards(w.data || []))
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [selectedWardId, filters.search, filters.kind, filters.ownership, filters.areaId]);

  const visible = rows || [];
  const total = listTotal;
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const currentPage = Math.min(page, pages);
  const pageRows = visible;

  const wardOptions = wards.map(w => ({ value: w.id, label: formatWardLabel(w) }));
  const colonyOptions = (
    selectedWardId
      ? wards.find(w => String(w.id) === String(selectedWardId))?.areas || []
      : wards.flatMap(w => w.areas || [])
  ).map(a => ({ value: a.id, label: a.name }));

  const hasActiveFilters = Boolean(
    filters.search || filters.kind || filters.ownership || filters.areaId
  );

  const form = edit || add;
  const formWardId = form?.wardId || form?.area?.wardId || form?.area?.ward?.id || '';
  const formAreas = (wards.find(w => String(w.id) === String(formWardId))?.areas || []).map(a => ({
    value: a.id,
    label: a.name
  }));
  const selectedArea = (wards.find(w => String(w.id) === String(formWardId))?.areas || []).find(
    a => String(a.id) === String(form?.areaId)
  );
  const selectedWard = wards.find(w => String(w.id) === String(formWardId));

  function openAdd() {
    setAdd({ ...blank, wardId: selectedWardId || '', kind: filters.kind || 'SHOP' });
  }

  function openEdit(s) {
    setEdit({
      ...blank,
      ...s,
      ...categoryParts(s.category),
      wardId: s.area?.wardId || s.area?.ward?.id || '',
      areaId: s.areaId || s.area?.id || '',
      ownership: s.ownership || 'OWN',
      propertyOwnerName: s.propertyOwnerName || '',
      propertyOwnerMobile: s.propertyOwnerMobile || '',
      latitude: hasCoords(s.latitude, s.longitude) ? s.latitude : '',
      longitude: hasCoords(s.latitude, s.longitude) ? s.longitude : ''
    });
  }

  function changeForm(next) {
    if (edit) setEdit(next);
    else setAdd(next);
  }

  async function openDetailModal(id) {
    try {
      setError('');
      const res = await api.shop(id);
      setDetail(res.data);
    } catch (e) {
      setError(e.message);
    }
  }

  function openShopLoc(s, fromDetail = false) {
    if (!s) return;
    setShopLoc({
      id: s.id,
      name: s.name,
      latitude: hasCoords(s.latitude, s.longitude) ? s.latitude : '',
      longitude: hasCoords(s.latitude, s.longitude) ? s.longitude : '',
      area: s.area || null,
      fromDetail
    });
    if (fromDetail) setDetail(null);
  }

  async function saveShopLoc(e) {
    e.preventDefault();
    if (!shopLoc?.id) return;
    if (!hasCoords(shopLoc.latitude, shopLoc.longitude)) {
      setError(isMr ? 'कृपया Use GPS दाबा किंवा नकाशावर टॅप करून पिन सेट करा.' : 'Use GPS or tap the map to set the shop pin.');
      return;
    }
    setBusyLoc(true);
    try {
      await api.updateShop(shopLoc.id, geoPayload(shopLoc, ['latitude', 'longitude']));
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'success',
            message: isMr ? 'जीपीएस स्थान यशस्वीरित्या अद्यतनित केले.' : 'GPS location updated successfully.'
          }
        })
      );
      const id = shopLoc.id;
      const reopen = shopLoc.fromDetail;
      setShopLoc(null);
      await load();
      if (reopen) {
        const refreshed = await api.shop(id);
        setDetail(refreshed.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyLoc(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const category = form.category === 'Other' ? (form.categoryCustom || '').trim() : form.category;
      if (form.category === 'Other' && !category) {
        throw new Error(isMr ? 'कृपया श्रेणीचे नाव लिहा.' : 'Write the category name.');
      }
      if (!form.areaId) {
        throw new Error(isMr ? 'कृपया कॉलनी / परिसर निवडा.' : 'Please select a colony / area.');
      }
      const ownership = form.ownership || 'OWN';
      const payload = {
        name: form.name?.trim(),
        kind: form.kind || 'SHOP',
        category: category || null,
        categoryCustom: form.category === 'Other' ? form.categoryCustom : null,
        areaId: form.areaId,
        address: form.address?.trim(),
        landmark: form.landmark?.trim() || null,
        ownerName: form.ownerName?.trim() || null,
        ownerMobile: form.ownerMobile?.trim() || null,
        propertyOwnerName: form.propertyOwnerName?.trim() || null,
        propertyOwnerMobile: form.propertyOwnerMobile?.trim() || null,
        ownership,
        openingHours: form.openingHours?.trim() || null,
        notes: form.notes?.trim() || null,
        ...geoPayload(form, ['latitude', 'longitude'])
      };

      if (edit) {
        await api.updateShop(edit.id, payload);
        window.dispatchEvent(
          new CustomEvent('ward:toast', {
            detail: {
              type: 'success',
              message: isMr ? `"${form.name}" माहिती अद्यतनित केली.` : `"${form.name}" updated successfully.`
            }
          })
        );
      } else {
        await api.createShop(payload);
        window.dispatchEvent(
          new CustomEvent('ward:toast', {
            detail: {
              type: 'success',
              message: isMr ? `"${form.name}" यशस्वीरित्या नोंदवले.` : `"${form.name}" registered successfully.`
            }
          })
        );
      }
      setEdit(null);
      setAdd(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-data-page shops-page" style={{ paddingTop: '8px' }}>
      <PageHeader
        kicker={isMr ? 'स्थानिक व्यवसाय व वाणिज्य नोंदणी' : 'Commercial Establishments & Civic Register'}
        title={isMr ? 'दुकाने आणि कार्यालये' : 'Shops & Offices'}
        subtitle={
          isMr
            ? 'वॉर्डमधील सर्व व्यापारी दुकाने, व्यावसायिक कार्यालये, मालक, भाडेकरू माहिती व जीपीएस स्थाने व्यवस्थापित करा.'
            : 'Audit commercial stores, corporate offices, premise ownership, proprietor contacts, and Google Maps navigation.'
        }
        action={
          canAdd ? (
            <button
              type="button"
              className="primary-btn"
              onClick={openAdd}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span>+</span>
              <span>{isMr ? 'दुकान / कार्यालय जोडा' : 'Add Shop / Office'}</span>
            </button>
          ) : null
        }
      />

      <ErrorBox error={error} />

      {/* 5 Interactive KPI Cards - 1 Single Row */}
      <div className="team-kpi-grid">
        <div
          className={`team-kpi-card ${!filters.kind && !filters.ownership ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setFilters(f => ({ ...f, kind: '', ownership: '' }))}
          title={isMr ? 'सर्व आस्थापने पाहण्यासाठी क्लिक करा' : 'Click to view all establishments'}
        >
          <div className="team-kpi-icon blue">
            <StoreIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{!rows ? '…' : kpiStats.total}</div>
            <div className="team-kpi-label">{isMr ? 'एकूण आस्थापने' : 'All Establishments'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filters.kind === 'SHOP' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() =>
            setFilters(f => ({
              ...f,
              kind: f.kind === 'SHOP' ? '' : 'SHOP',
              ownership: ''
            }))
          }
          title={isMr ? 'केवळ दुकाने पाहण्यासाठी क्लिक करा' : 'Click to filter commercial shops'}
        >
          <div className="team-kpi-icon green">
            <StoreIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{!rows ? '…' : kpiStats.shops}</div>
            <div className="team-kpi-label">{isMr ? 'व्यावसायिक दुकाने' : 'Commercial Shops'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filters.kind === 'OFFICE' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() =>
            setFilters(f => ({
              ...f,
              kind: f.kind === 'OFFICE' ? '' : 'OFFICE',
              ownership: ''
            }))
          }
          title={isMr ? 'केवळ कार्यालये पाहण्यासाठी क्लिक करा' : 'Click to filter offices & firms'}
        >
          <div className="team-kpi-icon purple">
            <BuildingIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{!rows ? '…' : kpiStats.offices}</div>
            <div className="team-kpi-label">{isMr ? 'कार्यालये / फर्म्स' : 'Offices & Firms'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filters.ownership === 'OWN' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() =>
            setFilters(f => ({
              ...f,
              ownership: f.ownership === 'OWN' ? '' : 'OWN',
              kind: ''
            }))
          }
          title={isMr ? 'स्वतःची जागा असलेले प्रतिष्ठाने' : 'Click to filter owned premises'}
        >
          <div className="team-kpi-icon green">
            <CheckIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{!rows ? '…' : kpiStats.owned}</div>
            <div className="team-kpi-label">{isMr ? 'स्वतःची जागा' : 'Owned Premises'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filters.ownership === 'RENT' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() =>
            setFilters(f => ({
              ...f,
              ownership: f.ownership === 'RENT' ? '' : 'RENT',
              kind: ''
            }))
          }
          title={isMr ? 'भाड्याने घेतलेली प्रतिष्ठाने' : 'Click to filter rented premises'}
        >
          <div className="team-kpi-icon amber">
            <ClockIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{!rows ? '…' : kpiStats.rented}</div>
            <div className="team-kpi-label">{isMr ? 'भाड्याची जागा' : 'Rented Premises'}</div>
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
                onChange={e => setFilters({ ...filters, areaId: e.target.value })}
                className="exec-filter-select"
              >
                <option value="">{isMr ? 'सर्व कॉलनी' : 'All colonies'}</option>
                {colonyOptions.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="exec-quick-status">
              <select
                value={filters.kind}
                onChange={e => setFilters({ ...filters, kind: e.target.value })}
                className="exec-filter-select"
              >
                <option value="">{isMr ? 'सर्व प्रकार' : 'All Types'}</option>
                <option value="SHOP">{isMr ? 'दुकान (Shops)' : 'Shops'}</option>
                <option value="OFFICE">{isMr ? 'कार्यालय (Offices)' : 'Offices'}</option>
              </select>
            </div>

            <div className="exec-quick-presence">
              <select
                value={filters.ownership}
                onChange={e => setFilters({ ...filters, ownership: e.target.value })}
                className="exec-filter-select"
              >
                <option value="">{isMr ? 'सर्व मालकी' : 'All Ownerships'}</option>
                <option value="OWN">{isMr ? 'स्वतःची (Owned)' : 'Owned'}</option>
                <option value="RENT">{isMr ? 'भाड्याने (Rented)' : 'Rented'}</option>
                <option value="OTHER">{isMr ? 'इतर (Other)' : 'Other'}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Symmetrical Table */}
      {!rows ? (
        <Loading />
      ) : !total ? (
        <Empty>
          {hasActiveFilters
            ? isMr
              ? 'या फिल्टरनुसार कोणतीही दुकाने किंवा कार्यालये सापडली नाहीत.'
              : 'No shops or offices match the selected filters.'
            : isMr
            ? 'या वॉर्डमध्ये कोणतीही दुकाने किंवा कार्यालये नोंदवलेली नाहीत.'
            : 'No shops or offices found for the selected ward.'}
        </Empty>
      ) : (
        <>
          <div className="panel table-wrap shops-table-wrap">
            <table className="shops-table">
              <thead>
                <tr>
                  <th>{isMr ? 'दुकान / कार्यालय' : 'Shop / Office'}</th>
                  <th>{isMr ? 'मालक / संपर्क' : 'Owner / Contact'}</th>
                  <th>{isMr ? 'रहिवासी वॉर्ड' : 'Resident Ward'}</th>
                  <th>{isMr ? 'पत्ता आणि कॉलनी' : 'Address & Colony'}</th>
                  <th>{isMr ? 'स्थान' : 'Location'}</th>
                  <th style={{ textAlign: 'center' }}>{isMr ? 'कृती' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(s => {
                  const initials = getInitials(s.name);
                  const wardNo = formatWardNumber(s.area?.ward?.wardNumber);
                  const isOffice = s.kind === 'OFFICE';
                  const isOwn = s.ownership === 'OWN';

                  return (
                    <tr key={s.id}>
                      <td data-label="Shop / Office">
                        <div className="exec-cell-user">
                          <div
                            className={`exec-avatar ${isOffice ? 'blue' : 'green'}`}
                            onClick={() => openDetailModal(s.id)}
                            style={{ cursor: 'pointer' }}
                            title={isMr ? 'तपशील पाहण्यासाठी क्लिक करा' : 'Click to view details'}
                          >
                            {initials}
                          </div>
                          <div className="exec-cell-meta">
                            <button
                              type="button"
                              onClick={() => openDetailModal(s.id)}
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
                              title={isMr ? 'तपशील पाहण्यासाठी क्लिक करा' : 'Click to view details'}
                            >
                              {s.name}
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                              <span className={`shop-kind-badge ${isOffice ? 'office' : 'shop'}`}>
                                {isOffice ? <BuildingIcon size={11} /> : <StoreIcon size={11} />}
                                {isOffice ? (isMr ? 'कार्यालय' : 'Office') : (isMr ? 'दुकान' : 'Shop')}
                              </span>
                              {s.category && (
                                <span className="muted" style={{ fontSize: 11, fontWeight: 500 }}>
                                  {s.category}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td data-label="Owner / Contact">
                        <div className="cell-value">
                          <strong style={{ color: '#0f172a', fontSize: '13px' }}>{s.ownerName || '—'}</strong>
                          {s.ownerMobile ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <a
                                href={`tel:${s.ownerMobile}`}
                                style={{
                                  fontSize: '12px',
                                  color: '#0284c7',
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}
                                title={isMr ? 'कॉल करण्यासाठी क्लिक करा' : 'Click to call'}
                              >
                                <PhoneIcon size={11} />
                                {s.ownerMobile}
                              </a>
                            </div>
                          ) : (
                            <div className="muted" style={{ fontSize: '11.5px', marginTop: 2 }}>
                              {s.ownerName ? (isMr ? 'मोबाईल नाही' : 'No mobile') : '—'}
                            </div>
                          )}
                          {s.propertyOwnerName && (
                            <div className="muted" style={{ fontSize: '10.5px', marginTop: 3, color: '#64748b' }}>
                              {isMr ? 'जागा मालक:' : 'Premise owner:'} {s.propertyOwnerName}
                            </div>
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

                      <td data-label="Address & Colony">
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#1e293b', lineHeight: 1.35 }}>
                            {s.address}
                          </div>
                          <div
                            className="muted"
                            style={{
                              fontSize: '11.5px',
                              marginTop: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              flexWrap: 'wrap'
                            }}
                          >
                            <span>{s.area?.name || '—'}</span>
                            {s.landmark && <span>· {s.landmark}</span>}
                            <span className={`shop-ownership-badge ${isOwn ? 'own' : 'rent'}`}>
                              {ownershipLabel(s.ownership, isMr)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td data-label="Location">
                        {hasCoords(s.latitude, s.longitude) ? (
                          <a
                            href={directionsUrl(s.latitude, s.longitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="exec-btn-dir"
                            onClick={e => e.stopPropagation()}
                            title={isMr ? 'गुगल मॅप्सवर दिशा पहा' : 'View driving directions in Google Maps'}
                          >
                            <MapPinIcon size={12} />
                            <span>{isMr ? 'दिशा' : 'Directions'}</span>
                          </a>
                        ) : (
                          <span
                            className="exec-btn-dir disabled"
                            title={isMr ? 'स्थान पिन केलेले नाही' : 'Location not saved'}
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
                            onClick={() => openDetailModal(s.id)}
                            title={isMr ? 'तपशील पहा' : 'View establishment details'}
                          >
                            <EyeIcon size={13} />
                            <span>{isMr ? 'पहा' : 'View'}</span>
                          </button>

                          {canAdd && (
                            <button
                              type="button"
                              className="exec-btn-edit"
                              onClick={() => openEdit(s)}
                              title={isMr ? 'माहिती संपादित करा' : 'Edit details'}
                            >
                              <EditIcon size={13} />
                              <span>{isMr ? 'संपादित' : 'Edit'}</span>
                            </button>
                          )}

                          <RowMenu
                            menuOnly
                            items={[
                              { label: isMr ? 'तपशील पहा' : 'View details', onClick: () => openDetailModal(s.id) },
                              hasCoords(s.latitude, s.longitude) && {
                                label: isMr ? 'गुगल मॅप्सवर दिशा' : 'Get directions',
                                onClick: () => window.open(directionsUrl(s.latitude, s.longitude), '_blank', 'noopener')
                              },
                              canPin && {
                                label: isMr ? 'स्थान बदला / पिन करा' : 'Update GPS pin',
                                onClick: () => openShopLoc(s, false)
                              },
                              canAdd && {
                                label: isMr ? 'संपादित करा' : 'Edit',
                                onClick: () => openEdit(s)
                              },
                              can('DELETE_HOUSES') && {
                                label: isMr ? 'हटवा' : 'Delete',
                                danger: true,
                                onClick: async () => {
                                  if (
                                    confirm(
                                      isMr
                                        ? 'हे दुकान / कार्यालय हटवायचे आहे का?'
                                        : 'Move this shop / office to the recycle bin?'
                                    )
                                  ) {
                                    try {
                                      await api.deleteShop(s.id);
                                      window.dispatchEvent(
                                        new CustomEvent('ward:toast', {
                                          detail: {
                                            type: 'success',
                                            message: isMr ? 'आस्थापना यशस्वीरित्या हटवली.' : 'Establishment removed.'
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

      {/* Executive View Details Modal */}
      {detail && (
        <Modal
          wide
          title={`${detail.name} · ${
            detail.kind === 'OFFICE' ? (isMr ? 'कार्यालय' : 'Office') : isMr ? 'दुकान' : 'Shop'
          }`}
          onClose={() => setDetail(null)}
        >
          <div className="exec-modal-profile-header">
            <div
              className={`exec-modal-avatar ${detail.kind === 'OFFICE' ? 'blue' : 'green'}`}
              style={{
                background:
                  detail.kind === 'OFFICE'
                    ? 'linear-gradient(135deg, #1e40af, #3b82f6)'
                    : 'linear-gradient(135deg, #065f46, #10b981)'
              }}
            >
              {getInitials(detail.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{detail.name}</h2>
                <span className={`shop-kind-badge ${detail.kind === 'OFFICE' ? 'office' : 'shop'}`}>
                  {detail.kind === 'OFFICE' ? <BuildingIcon size={12} /> : <StoreIcon size={12} />}
                  {detail.kind === 'OFFICE' ? (isMr ? 'कार्यालय' : 'Office') : isMr ? 'दुकान' : 'Shop'}
                </span>
                {detail.category && (
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
                    {detail.category}
                  </span>
                )}
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
                {detail.openingHours && (
                  <>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <ClockIcon size={12} />
                      {detail.openingHours}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="exec-detail-grid">
            {/* Card 1: Business Profile */}
            <div className="exec-detail-card">
              <h3>
                <StoreIcon size={14} style={{ color: '#0f766e' }} />
                <span>{isMr ? 'व्यवसायाची माहिती' : 'Establishment Profile'}</span>
              </h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'व्यवसायाचे नाव' : 'Trade Name'}</span>
                <span className="exec-detail-val">{detail.name}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'प्रकार' : 'Type'}</span>
                <span className="exec-detail-val">
                  {detail.kind === 'OFFICE'
                    ? isMr
                      ? 'कार्यालय / फर्म'
                      : 'Office / Firm'
                    : isMr
                    ? 'व्यावसायिक दुकान'
                    : 'Commercial Shop'}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'श्रेणी' : 'Category'}</span>
                <span className="exec-detail-val">{detail.category || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'कामकाजाची वेळ' : 'Hours'}</span>
                <span className="exec-detail-val">{detail.openingHours || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'वॉर्ड व कॉलनी' : 'Ward & Colony'}</span>
                <span className="exec-detail-val">
                  {formatWardNumber(detail.area?.ward?.wardNumber)} · {detail.area?.name || '—'}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'पत्ता' : 'Full Address'}</span>
                <span className="exec-detail-val">{detail.address || '—'}</span>
              </div>
              {detail.landmark && (
                <div className="exec-detail-row">
                  <span className="exec-detail-label">{isMr ? 'खूण (Landmark)' : 'Landmark'}</span>
                  <span className="exec-detail-val">{detail.landmark}</span>
                </div>
              )}
            </div>

            {/* Card 2: Ownership & Proprietor */}
            <div className="exec-detail-card">
              <h3>
                <UsersIcon size={14} style={{ color: '#0f766e' }} />
                <span>{isMr ? 'मालक व जागा मालकी' : 'Proprietor & Ownership'}</span>
              </h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'जागा मालकी' : 'Premise Ownership'}</span>
                <span className="exec-detail-val">
                  <span className={`shop-ownership-badge ${detail.ownership === 'OWN' ? 'own' : 'rent'}`}>
                    {ownershipLabel(detail.ownership, isMr)}
                  </span>
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'दुकानदार / इन-चार्ज' : 'Store Proprietor'}</span>
                <span className="exec-detail-val">{detail.ownerName || (isMr ? 'नोंद नाही' : 'Not recorded')}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'मोबाईल नंबर' : 'Owner Mobile'}</span>
                <span className="exec-detail-val">
                  {detail.ownerMobile ? (
                    <a href={`tel:${detail.ownerMobile}`} style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>
                      {detail.ownerMobile}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'जागा मालक (Landlord)' : 'Premise Landlord'}</span>
                <span className="exec-detail-val">
                  {detail.propertyOwnerName || (isMr ? 'नोंद नाही' : 'Not recorded')}
                </span>
              </div>
              {detail.propertyOwnerMobile && (
                <div className="exec-detail-row">
                  <span className="exec-detail-label">{isMr ? 'जागा मालक मोबाईल' : 'Landlord Mobile'}</span>
                  <span className="exec-detail-val">
                    <a
                      href={`tel:${detail.propertyOwnerMobile}`}
                      style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}
                    >
                      {detail.propertyOwnerMobile}
                    </a>
                  </span>
                </div>
              )}
              <div className="exec-detail-row">
                <span className="exec-detail-label">{isMr ? 'नोंदी / शेरा' : 'Internal Notes'}</span>
                <span className="exec-detail-val" style={{ fontStyle: detail.notes ? 'normal' : 'italic' }}>
                  {detail.notes || (isMr ? 'कोणतीही नोंद नाही' : 'No notes')}
                </span>
              </div>
            </div>

            {/* Card 3: GPS Navigation */}
            <div className="exec-detail-card">
              <h3>
                <MapPinIcon size={14} style={{ color: '#0f766e' }} />
                <span>{isMr ? 'नकाशा व दिशा' : 'GPS Location & Navigation'}</span>
              </h3>
              <MapPreview lat={detail.latitude} lng={detail.longitude} label={detail.name}>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {hasCoords(detail.latitude, detail.longitude) && (
                    <a
                      href={directionsUrl(detail.latitude, detail.longitude)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="exec-modal-btn dir"
                      style={{ padding: '0 12px', height: 32, fontSize: 12 }}
                    >
                      <MapPinIcon size={13} />
                      <span>{isMr ? 'गुगल मॅप्स दिशा' : 'Google Maps Directions'}</span>
                    </a>
                  )}
                  {canPin && (
                    <button
                      type="button"
                      className="small-btn loc-update-btn"
                      style={{ height: 32, fontSize: 12 }}
                      onClick={() => openShopLoc(detail, true)}
                    >
                      {isMr ? 'स्थान अपडेट करा' : 'Update Location'}
                    </button>
                  )}
                </div>
              </MapPreview>
            </div>
          </div>

          <div className="exec-modal-footer">
            <button type="button" className="exec-modal-btn ghost" onClick={() => setDetail(null)}>
              {isMr ? 'बंद करा' : 'Close'}
            </button>
            {canAdd && (
              <button
                type="button"
                className="exec-modal-btn primary"
                onClick={() => {
                  const d = detail;
                  setDetail(null);
                  openEdit(d);
                }}
              >
                <EditIcon size={13} />
                <span>{isMr ? 'संपादित करा' : 'Edit Establishment'}</span>
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Update Location Modal */}
      {shopLoc && (
        <Modal
          wide
          title={
            isMr
              ? `अचूक स्थान अपडेट करा · ${shopLoc.name || ''}`
              : `Update GPS Location · ${shopLoc.name || ''}`
          }
          onClose={() => {
            const reopen = shopLoc.fromDetail;
            const id = shopLoc.id;
            setShopLoc(null);
            if (reopen) api.shop(id).then(r => setDetail(r.data)).catch(() => {});
          }}
        >
          <form
            className="admin-form"
            onSubmit={saveShopLoc}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div className="exec-form-section" style={{ margin: 0 }}>
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <MapPinIcon size={16} style={{ color: '#0f766e' }} />
                  <span>{isMr ? 'दुकान / कार्यालय अचूक जीपीएस पिन' : 'Exact Establishment GPS Pin'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'प्रवेशद्वारावर उभे राहून Use GPS दाबा' : 'Stand at the entrance and tap Use GPS'}
                </span>
              </div>

              <ErrorBox error={error} />

              <LocationPicker
                key={shopLoc.id}
                value={shopLoc}
                onChange={next =>
                  setShopLoc(cur => ({ ...cur, latitude: next.latitude, longitude: next.longitude }))
                }
                centerFrom={[shopLoc.area, shopLoc.area?.ward]}
                hint={
                  isMr
                    ? 'दुकान / कार्यालयाच्या प्रवेशद्वारावर उभे राहून Use GPS दाबा.'
                    : 'Stand at the entrance and tap Use GPS.'
                }
              />
            </div>

            <div className="exec-modal-footer">
              <button
                type="button"
                className="exec-modal-btn ghost"
                onClick={() => {
                  const reopen = shopLoc.fromDetail;
                  const id = shopLoc.id;
                  setShopLoc(null);
                  if (reopen) api.shop(id).then(r => setDetail(r.data)).catch(() => {});
                }}
              >
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button type="submit" className="exec-modal-btn primary" disabled={busyLoc}>
                {busyLoc
                  ? isMr
                    ? 'जतन करत आहे…'
                    : 'Saving…'
                  : isMr
                  ? 'स्थान जतन करा'
                  : 'Save Location Pin'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Redesigned, Professional 5-Section Modal Form */}
      {form && (
        <Modal
          wide
          title={
            edit
              ? isMr
                ? `${edit.name} - माहिती संपादित करा`
                : `Edit ${edit.name}`
              : isMr
              ? 'नवीन दुकान / कार्यालय जोडा'
              : 'Add Shop / Office'
          }
          onClose={() => {
            setEdit(null);
            setAdd(null);
          }}
        >
          <form
            className="admin-form"
            onSubmit={save}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <ErrorBox error={error} />

            {/* Section 1: Establishment Profile */}
            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <StoreIcon size={16} style={{ color: '#0f766e' }} />
                  <span>{isMr ? '१. व्यवसायाची माहिती' : '1. Establishment Details'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'प्रकार, नाव व व्यवसायाची श्रेणी' : 'Establishment type, trade name and commercial category'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <Field label={isMr ? 'आस्थापना प्रकार *' : 'Establishment Type *'}>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => changeForm({ ...form, kind: 'SHOP' })}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: (form.kind || 'SHOP') === 'SHOP' ? '2px solid #059669' : '1px solid #cbd5e1',
                        background: (form.kind || 'SHOP') === 'SHOP' ? '#ecfdf5' : '#ffffff',
                        color: (form.kind || 'SHOP') === 'SHOP' ? '#065f46' : '#475569',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <StoreIcon size={16} />
                      <span>{isMr ? 'दुकान (Shop)' : 'Shop'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => changeForm({ ...form, kind: 'OFFICE' })}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: form.kind === 'OFFICE' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: form.kind === 'OFFICE' ? '#eff6ff' : '#ffffff',
                        color: form.kind === 'OFFICE' ? '#1e40af' : '#475569',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <BuildingIcon size={16} />
                      <span>{isMr ? 'कार्यालय (Office)' : 'Office'}</span>
                    </button>
                  </div>
                </Field>

                <Field label={isMr ? 'व्यवसायाची श्रेणी' : 'Trade Category'}>
                  <SearchableSelect
                    value={form.category || ''}
                    onChange={v =>
                      changeForm({
                        ...form,
                        category: v,
                        categoryCustom: v === 'Other' ? form.categoryCustom : ''
                      })
                    }
                    options={CATEGORIES.map(c => ({ value: c, label: c }))}
                    placeholder={isMr ? 'श्रेणी निवडा…' : 'Select category…'}
                  />
                </Field>
              </div>

              {form.category === 'Other' && (
                <Field label={isMr ? 'इतर श्रेणीचे नाव लिहा *' : 'Specify Custom Category *'}>
                  <input
                    required
                    value={form.categoryCustom || ''}
                    onChange={e => changeForm({ ...form, categoryCustom: e.target.value })}
                    placeholder={
                      isMr
                        ? 'उदा. स्टेशनरी, मिठाई, बेकरी, टेलरिंग इत्यादी'
                        : 'e.g. Stationery, Sweet Mart, Bakery, Tailor'
                    }
                  />
                </Field>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                <Field label={isMr ? 'दुकान / कार्यालय / फर्मचे नाव *' : 'Establishment / Business Name *'}>
                  <input
                    required
                    value={form.name || ''}
                    onChange={e => changeForm({ ...form, name: e.target.value })}
                    placeholder={
                      isMr
                        ? 'उदा. श्री गणेश मेडिकल, कुलकर्णी असोसिएट्स, महालक्ष्मी सुपर मार्केट'
                        : 'e.g. Shree Ganesh Medical, Kulkarni CA Firm, Mahavir Grocery'
                    }
                  />
                </Field>

                <Field label={isMr ? 'कामकाजाची वेळ (पर्यायी)' : 'Operating Hours (Optional)'}>
                  <input
                    value={form.openingHours || ''}
                    onChange={e => changeForm({ ...form, openingHours: e.target.value })}
                    placeholder={isMr ? 'उदा. स. ९:०० ते रा. ९:०० किंवा १०am – ८pm' : 'e.g. 9:00 AM – 9:00 PM'}
                  />
                </Field>
              </div>
            </div>

            {/* Section 2: Address & Civic Area */}
            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <MapPinIcon size={16} style={{ color: '#0f766e' }} />
                  <span>{isMr ? '२. पत्ता आणि कॉलनी परिसर' : '2. Address & Civic Location'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr ? 'वॉर्ड, कॉलनी आणि परिसरातील पत्ता' : 'Civic ward, neighborhood colony and street address'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <Field label={isMr ? 'वॉर्ड निवडा *' : 'Civic Ward *'}>
                  <SearchableSelect
                    required
                    value={formWardId}
                    onChange={v => changeForm({ ...form, wardId: v, areaId: '' })}
                    options={wardOptions}
                    placeholder={isMr ? 'वॉर्ड निवडा…' : 'Select ward…'}
                  />
                </Field>

                <Field label={isMr ? 'कॉलनी / परिसर *' : 'Colony / Area *'}>
                  <SearchableSelect
                    required
                    value={form.areaId || ''}
                    onChange={v => changeForm({ ...form, areaId: v })}
                    options={formAreas}
                    placeholder={
                      formWardId
                        ? isMr
                          ? 'कॉलनी निवडा…'
                          : 'Select colony…'
                        : isMr
                        ? 'आधी वॉर्ड निवडा'
                        : 'Select ward first'
                    }
                  />
                </Field>
              </div>

              <Field label={isMr ? 'संपूर्ण पत्ता (गाळा क्र., इमारत, रस्ता) *' : 'Complete Address (Shop No., Building, Street) *'}>
                <textarea
                  required
                  rows={2}
                  value={form.address || ''}
                  onChange={e => changeForm({ ...form, address: e.target.value })}
                  placeholder={
                    isMr
                      ? 'उदा. दुकान क्र. ४, तळमजला, शिवनेरी कॉम्प्लेक्स, मुख्य रस्ता'
                      : 'e.g. Shop No. 4, Ground Floor, Shivneri Complex, Main Road'
                  }
                />
              </Field>

              <Field label={isMr ? 'जवळची प्रसिद्ध खूण / चौक (पर्यायी)' : 'Nearby Landmark / Square (Optional)'}>
                <input
                  value={form.landmark || ''}
                  onChange={e => changeForm({ ...form, landmark: e.target.value })}
                  placeholder={
                    isMr ? 'उदा. जुन्या सावेडी नाक्याजवळ, एसबीआय बँकेसमोर' : 'e.g. Near Old Savedi Naka, Opp. State Bank'
                  }
                />
              </Field>
            </div>

            {/* Section 3: Proprietor & Premise Ownership */}
            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <UsersIcon size={16} style={{ color: '#0f766e' }} />
                  <span>{isMr ? '३. दुकानदार आणि जागा मालकी' : '3. Proprietor & Premise Ownership'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr
                    ? 'जागा स्वतःची की भाड्याची, दुकानदार व जागा मालक संपर्क'
                    : 'Premise ownership, proprietor in-charge and building landlord contacts'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <Field label={isMr ? 'जागा मालकी प्रकार' : 'Premise Ownership'}>
                  <SearchableSelect
                    value={form.ownership || 'OWN'}
                    onChange={v => changeForm({ ...form, ownership: v })}
                    options={[
                      { value: 'OWN', label: isMr ? 'स्वतःची जागा (Own Premise)' : 'Own Premise' },
                      { value: 'RENT', label: isMr ? 'भाड्याची जागा (Rented Premise)' : 'Rented Premise' },
                      { value: 'OTHER', label: isMr ? 'इतर (Other)' : 'Other' }
                    ]}
                    placeholder={isMr ? 'मालकी निवडा…' : 'Select ownership…'}
                  />
                </Field>

                <Field label={isMr ? 'दुकानदार / इन-चार्ज पूर्ण नाव' : 'Proprietor / In-Charge Name'}>
                  <input
                    value={form.ownerName || ''}
                    onChange={e => changeForm({ ...form, ownerName: e.target.value })}
                    placeholder={isMr ? 'दुकानदार किंवा व्यवस्थापकाचे नाव' : 'Store proprietor or manager name'}
                  />
                </Field>

                <Field label={isMr ? 'दुकानदार मोबाईल क्रमांक' : 'Proprietor Mobile'}>
                  <input
                    inputMode="numeric"
                    maxLength={10}
                    value={form.ownerMobile || ''}
                    onChange={e =>
                      changeForm({ ...form, ownerMobile: e.target.value.replace(/\D/g, '').slice(0, 10) })
                    }
                    placeholder={isMr ? '१० अंकी मोबाईल क्रमांक' : '10-digit mobile number'}
                  />
                </Field>
              </div>

              {/* Landlord details (especially if RENT) */}
              <div
                style={{
                  background: form.ownership === 'RENT' ? '#f0f9ff' : '#f8fafc',
                  border: form.ownership === 'RENT' ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginTop: 4
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: form.ownership === 'RENT' ? '#0369a1' : '#475569',
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <span>
                    🏢 {isMr ? 'जागा मालक (इमारत / गाळा मालक) तपशील' : 'Premise Landlord (Property Owner) Details'}
                  </span>
                  {form.ownership === 'RENT' && (
                    <span
                      style={{
                        background: '#0284c7',
                        color: '#fff',
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontWeight: 600
                      }}
                    >
                      {isMr ? 'भाड्याने असल्यास महत्त्वाचे' : 'Important for rented premises'}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <Field label={isMr ? 'जागा मालकाचे पूर्ण नाव (पर्यायी)' : 'Property Owner / Landlord Name'}>
                    <input
                      value={form.propertyOwnerName || ''}
                      onChange={e => changeForm({ ...form, propertyOwnerName: e.target.value })}
                      placeholder={isMr ? 'इमारत किंवा गाळा मालकाचे नाव' : 'Building or property landlord name'}
                    />
                  </Field>

                  <Field label={isMr ? 'जागा मालकाचा मोबाईल (पर्यायी)' : 'Property Owner Mobile'}>
                    <input
                      inputMode="numeric"
                      maxLength={10}
                      value={form.propertyOwnerMobile || ''}
                      onChange={e =>
                        changeForm({
                          ...form,
                          propertyOwnerMobile: e.target.value.replace(/\D/g, '').slice(0, 10)
                        })
                      }
                      placeholder={isMr ? 'जागा मालक १० अंकी मोबाईल' : 'Landlord 10-digit mobile'}
                    />
                  </Field>
                </div>
              </div>
            </div>

            {/* Section 4: GPS Pin */}
            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <MapPinIcon size={16} style={{ color: '#0f766e' }} />
                  <span>{isMr ? '४. नकाशावरील अचूक स्थान (GPS पिन)' : '4. Exact GPS Map Pin'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr
                    ? 'दुकान किंवा कार्यालयाच्या प्रवेशद्वारावर अचूक पिन करा'
                    : 'Pin accurate coordinates for navigation and civic inspection'}
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
                      <strong>{isMr ? 'जीपीएस पिन सेट आहे:' : 'GPS Pin Active:'}</strong> Lat{' '}
                      {Number(form.latitude).toFixed(6)}, Lng {Number(form.longitude).toFixed(6)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => changeForm({ ...form, latitude: '', longitude: '' })}
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
                      : 'No GPS coordinates saved yet. Tap "Use GPS" below or click on the map to pin the door.'}
                  </span>
                </div>
              )}

              <LocationPicker
                key={edit?.id || 'new-shop'}
                value={form}
                onChange={next =>
                  changeForm({ ...form, latitude: next.latitude, longitude: next.longitude })
                }
                centerFrom={[selectedArea, selectedWard]}
                hint={
                  isMr
                    ? 'दुकान किंवा कार्यालयाच्या प्रवेशद्वारावर उभे राहून Use GPS दाबा.'
                    : 'Stand at the shop or office door and tap Use GPS.'
                }
              />
            </div>

            {/* Section 5: Remarks & Notes */}
            <div className="exec-form-section">
              <div className="exec-form-section-header">
                <div className="exec-form-section-title">
                  <FileTextIcon size={16} style={{ color: '#0f766e' }} />
                  <span>{isMr ? '५. नोंदी व शेरा (पर्यायी)' : '5. Additional Notes & Remarks'}</span>
                </div>
                <span className="exec-form-section-desc">
                  {isMr
                    ? 'स्थानिक सर्वेक्षण, परवाना किंवा नागरिकांसाठी महत्त्वाची माहिती'
                    : 'Optional internal notes, trade license, or survey comments'}
                </span>
              </div>

              <Field label={isMr ? 'विशेष नोंद किंवा शेरा' : 'Notes & Remarks'}>
                <textarea
                  rows={2}
                  value={form.notes || ''}
                  onChange={e => changeForm({ ...form, notes: e.target.value })}
                  placeholder={
                    isMr
                      ? 'उदा. महापालिका परवाना क्रमांक, नोंदणी, विशेष सेवा किंवा स्थानिक माहिती…'
                      : 'Add any civic notes, trade license reference, or survey remarks…'
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
                  ? '+ दुकान / कार्यालय नोंदवा'
                  : '+ Register Establishment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
