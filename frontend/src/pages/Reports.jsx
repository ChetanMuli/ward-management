import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ErrorBox, PageHeader, SearchableSelect, Toolbar } from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { useWardFilter } from '../wardFilter';
import { formatWardLabel, formatWardNumber } from '../wardFormat';

const configs = {
  'all-data': { title: 'All data pack (सर्व मुख्य डेटा)', bundle: true },
  'all-reports': { title: 'All report types (प्रत्येक अहवाल)', bundle: true },
  citizens: { title: 'Citizen report (नागरिक अहवाल)' },
  voters: { title: 'Voters report (मतदार अहवाल)' },
  nonVoters: { title: 'Non-voters report (अमतदार अहवाल)' },
  retiredPersons: { title: 'Retired persons report (निवृत्त नागरिक)' },
  outOfCity: { title: 'Out of city people (गावाबाहेर नागरिक)' },
  outOfCityVoters: { title: 'Out of city voters (गावाबाहेर मतदार)' },
  families: { title: 'Family report (कुटुंब अहवाल)' },
  houses: { title: 'House report (घर / मालमत्ता अहवाल)' },
  shops: { title: 'Shops & offices (दुकाने व व्यावसायिक आस्थापने)' },
  birthdays: { title: 'Birthday report (वाढदिवस अहवाल)' },
  followup: { title: '18+ Follow-up report (१८+ नवीन मतदार नोंदणी)' },
  complaints: { title: 'Complaints report (तक्रारी अहवाल)' },
  wards: { title: 'Ward / Area report (प्रभाग माहिती)' }
};

const SHEET_LABELS = {
  citizens: 'Citizens',
  voters: 'Voters',
  nonVoters: 'Non-voters',
  retiredPersons: 'Retired',
  outOfCity: 'Out of city',
  outOfCityVoters: 'Out of city voters',
  families: 'Families',
  houses: 'Houses',
  shops: 'Shops & offices',
  birthdays: 'Birthdays',
  followup: '18+ follow-up',
  complaints: 'Complaints',
  wards: 'Wards & areas',
};

const AGE_SUPPORT_TYPES = ['all-data', 'all-reports', 'citizens', 'retiredPersons', 'voters', 'nonVoters', 'outOfCity', 'outOfCityVoters', 'birthdays', 'followup'];
const GENDER_SUPPORT_TYPES = ['all-data', 'all-reports', 'citizens', 'retiredPersons', 'voters', 'nonVoters', 'outOfCity', 'outOfCityVoters', 'birthdays', 'followup'];
const VOTER_SUPPORT_TYPES = ['all-data', 'all-reports', 'citizens', 'retiredPersons', 'outOfCity'];
const PRESENCE_SUPPORT_TYPES = ['all-data', 'all-reports', 'citizens', 'retiredPersons', 'voters', 'nonVoters'];

export default function Reports() {
  const { selectedWardId, ward } = useWardFilter();
  const [wards, setWards] = useState([]);
  const [type, setType] = useState('all-data');
  const [areaId, setAreaId] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [gender, setGender] = useState('');
  const [voterStatus, setVoterStatus] = useState('');
  const [presenceStatus, setPresenceStatus] = useState('');
  const [complaintStatus, setComplaintStatus] = useState('');
  const [search, setSearch] = useState('');

  const [count, setCount] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [counting, setCounting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyFormat, setBusyFormat] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.wards().then(r => setWards(r.data || [])).catch(() => setWards([]));
  }, []);
  const selectedWard = wards.find(w => String(w.id) === String(selectedWardId)) || ward;
  const areas = useMemo(() => {
    return selectedWardId
      ? (selectedWard?.areas || selectedWard?.Areas || [])
      : wards.flatMap(w => (w.areas || w.Areas || []).map(a => ({ ...a, wardNumber: w.wardNumber })));
  }, [wards, selectedWard, selectedWardId]);
  const areaFilterList = useMemo(() => areas.filter(a => a.id && !a.official && !String(a.id).startsWith('display-')), [areas]);

  useEffect(() => {
    setAreaId('');
  }, [selectedWardId]);

  const hasAgeSupport = AGE_SUPPORT_TYPES.includes(type);
  const hasGenderSupport = GENDER_SUPPORT_TYPES.includes(type);
  const hasVoterSupport = VOTER_SUPPORT_TYPES.includes(type);
  const hasPresenceSupport = PRESENCE_SUPPORT_TYPES.includes(type);
  const isComplaints = type === 'complaints' || type === 'all-data' || type === 'all-reports';
  const isBundle = type === 'all-data' || type === 'all-reports';
  const sheetCount = breakdown ? Object.keys(breakdown).length : (isBundle ? (type === 'all-reports' ? 13 : 6) : 1);

  const ageFilterLabel = {
    '': 'All ages',
    'senior': '60+ Senior citizens',
    'adult': '18 – 59 Adults',
    'youth': '18 – 25 Youth',
    'below18': 'Below 18',
    'custom': `Age ${minAge || 0} to ${maxAge || 'max'}`
  }[ageFilter] || '';

  function buildParams() {
    const p = {};
    if (selectedWardId) p.wardId = selectedWardId;
    if (areaId) p.areaId = areaId;
    if (hasAgeSupport && ageFilter) {
      p.ageFilter = ageFilter;
      if (ageFilter === 'custom') {
        if (minAge !== '') p.minAge = minAge;
        if (maxAge !== '') p.maxAge = maxAge;
      }
    }
    if (hasGenderSupport && gender) p.gender = gender;
    if (hasVoterSupport && voterStatus) p.voterStatus = voterStatus;
    if (hasPresenceSupport && presenceStatus) p.presenceStatus = presenceStatus;
    if (isComplaints && complaintStatus) p.status = complaintStatus;
    if (search.trim()) p.search = search.trim();
    return p;
  }

  useEffect(() => {
    let cancelled = false;
    setCounting(true);
    const timer = setTimeout(async () => {
      try {
        const p = buildParams();
        const res = await api.exportCount(type, p);
        if (!cancelled) {
          setCount(typeof res.count === 'number' ? res.count : null);
          setBreakdown(res.breakdown || null);
          setCounting(false);
        }
      } catch (err) {
        if (!cancelled) {
          setCounting(false);
          setCount(null);
          setBreakdown(null);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [type, selectedWardId, areaId, ageFilter, minAge, maxAge, gender, voterStatus, presenceStatus, complaintStatus, search]);

  function clearFilters() {
    setAreaId('');
    setAgeFilter('');
    setMinAge('');
    setMaxAge('');
    setGender('');
    setVoterStatus('');
    setPresenceStatus('');
    setComplaintStatus('');
    setSearch('');
  }

  const hasActiveFilters = Boolean(
    areaId || ageFilter || minAge || maxAge || gender || voterStatus || presenceStatus || complaintStatus || search
  );

  async function excel() {
    setBusy(true);
    setBusyFormat('xlsx');
    setError('');
    try {
      const p = buildParams();
      await api.exportDownload(type, { ...p, format: 'xlsx' });
      window.dispatchEvent(new CustomEvent('ward:toast', {
        detail: { type: 'success', message: isBundle
          ? 'Excel downloaded — each dataset is on its own sheet.'
          : `Excel downloaded for ${configs[type]?.title || type}.` }
      }));
    } catch (e) {
      setError(e.message || 'Excel export failed. Please try again.');
    } finally {
      setBusy(false);
      setBusyFormat('');
    }
  }

  async function pdf() {
    if (isBundle) {
      setError('Combined export is Excel only. Choose one report type for PDF.');
      return;
    }
    setBusy(true);
    setBusyFormat('pdf');
    setError('');
    try {
      const p = buildParams();
      const res = await api.exportRows(type, p);
      const rows = res.data || [];
      if (!rows.length) {
        setError('No data found for the selected criteria.');
        return;
      }
      const doc = new jsPDF({ orientation: 'landscape' });
      const scopeText = selectedWardId ? formatWardLabel(selectedWard, 'Selected ward') : 'All wards';
      const colonyObj = areas.find(a => a.id === areaId);
      const colonyText = areaId ? (colonyObj?.name || 'Selected colony') : 'All colonies';
      const title = configs[type]?.title || 'Ward Report';

      doc.setFontSize(13);
      doc.text(title, 14, 12);
      doc.setFontSize(8);
      doc.setTextColor(80, 90, 110);
      const subtitle = `Scope: ${scopeText} · ${colonyText}${hasAgeSupport && ageFilter ? ` · Age: ${ageFilterLabel}` : ''}${hasGenderSupport && gender ? ` · Gender: ${gender}` : ''} | Generated: ${new Date().toLocaleDateString('en-IN')} | Total: ${res.count || rows.length} records`;
      doc.text(subtitle, 14, 17);

      const headers = Object.keys(rows[0]);
      const body = rows.slice(0, 1500).map(r => headers.map(h => {
        const v = r[h];
        return (v === null || v === undefined || v === '') ? '—' : String(v);
      }));
      const columnStyles = {};
      headers.forEach((h, i) => {
        const key = h.toLowerCase();
        const center = /age|ward|count|pincode|page|serial|mobile|phone|dob|date|gender|status|type|house no/.test(key);
        columnStyles[i] = { halign: center ? 'center' : 'left', overflow: 'linebreak' };
      });

      autoTable(doc, {
        startY: 22,
        head: [headers],
        body,
        theme: 'grid',
        tableWidth: 'auto',
        styles: { fontSize: 7, cellPadding: { top: 2.2, bottom: 2.2, left: 2.4, right: 2.4 }, valign: 'middle', overflow: 'linebreak', lineColor: [226, 232, 240], lineWidth: 0.2 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 7.5, cellPadding: 3 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles,
        margin: { left: 8, right: 8, top: 22, bottom: 12 },
        didDrawPage: function (data) {
          doc.setFontSize(7.5);
          doc.setTextColor(140);
          const pageStr = `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`;
          doc.text(pageStr, doc.internal.pageSize.width - 28, doc.internal.pageSize.height - 6);
        }
      });

      if (rows.length > 1500) {
        window.dispatchEvent(new CustomEvent('ward:toast', {
          detail: { type: 'info', message: `PDF generated with first 1,500 records. For all ${res.count || rows.length} records, download the Excel file.` }
        }));
      }
      doc.save(`ward-${type}${areaId ? '-colony' : ''}-${Date.now()}.pdf`);
    } catch (e) {
      setError(e.message || 'PDF export failed. Please try again.');
    } finally {
      setBusy(false);
      setBusyFormat('');
    }
  }

  const areaOptions = [
    { value: '', label: 'None' },
    ...areaFilterList.map(a => ({
      value: a.id,
      label: `${a.wardNumber ? formatWardNumber(a.wardNumber) + ' · ' : ''}${a.name}`
    }))
  ];

  const typeOptions = [
    { value: 'all-data', label: configs['all-data'].title, hint: '6 Excel sheets · citizens, families, houses, shops, complaints, wards' },
    { value: 'all-reports', label: configs['all-reports'].title, hint: 'Every report type as a separate Excel sheet' },
    ...Object.entries(configs)
      .filter(([k]) => k !== 'all-data' && k !== 'all-reports')
      .map(([k, v]) => ({ value: k, label: v.title }))
  ];

  const ageOptions = [
    { value: '', label: 'None' },
    { value: 'senior', label: '60+ Senior citizens (ज्येष्ठ नागरिक)' },
    { value: 'adult', label: '18 – 59 Adults (प्रौढ नागरिक)' },
    { value: 'youth', label: '18 – 25 Youth (तरुण नागरिक)' },
    { value: 'below18', label: 'Below 18 Children / Minors (१८ वर्षांखालील)' },
    { value: 'custom', label: 'Custom age range (विशिष्ट वयोगट)...' }
  ];

  const genderOptions = [
    { value: '', label: 'None' },
    { value: 'MALE', label: 'Male (पुरुष)' },
    { value: 'FEMALE', label: 'Female (स्त्री / महिला)' },
    { value: 'OTHER', label: 'Other (इतर)' }
  ];

  const voterOptions = [
    { value: '', label: 'None' },
    { value: 'VOTER', label: 'Voters only (मतदार)' },
    { value: 'NON_VOTER', label: 'Non-voters only (अमतदार)' },
    { value: 'NOT_SPECIFIED', label: 'Not specified (नोंद नसलेले)' }
  ];

  const presenceOptions = [
    { value: '', label: 'None' },
    { value: 'AT_HOME', label: 'At house (घरी उपस्थित)' },
    { value: 'OUT_OF_CITY', label: 'Out of city (गावाबाहेर / परगावी)' }
  ];

  const complaintOptions = [
    { value: '', label: 'None' },
    { value: 'PENDING', label: 'Pending (प्रलंबित)' },
    { value: 'IN_PROGRESS', label: 'In progress (प्रगतीपथावर)' },
    { value: 'RESOLVED', label: 'Resolved (निकाली काढलेली)' },
    { value: 'REJECTED', label: 'Rejected (नाकारलेली)' }
  ];

  return (
    <div className="reports-page">
      <PageHeader
        kicker="Tools"
        title="Reports & export"
        subtitle="Pick a ward, then choose all data or one report. Leave extra filters on None unless you need to narrow the list."
      />
      <ErrorBox error={error} />
      <section className="panel report-panel">
        <Toolbar>
          <WardFilter />
          <SearchableSelect
            label="Colony / Area"
            value={areaId}
            onChange={setAreaId}
            options={areaOptions}
            placeholder="None"
          />
          <SearchableSelect
            label="What to export"
            value={type}
            clearable={false}
            onChange={v => {
              setType(v || 'all-data');
              setAgeFilter('');
              setGender('');
              setVoterStatus('');
              setPresenceStatus('');
              setComplaintStatus('');
              setBreakdown(null);
            }}
            options={typeOptions}
            placeholder="All data or one report…"
            searchPlaceholder="Search export type…"
          />
          {hasAgeSupport && (
            <SearchableSelect
              label="Age filter"
              value={ageFilter}
              onChange={setAgeFilter}
              options={ageOptions}
              placeholder="None"
            />
          )}
        </Toolbar>

        {hasAgeSupport && ageFilter === 'custom' && (
          <div className="report-age-range">
            <label>
              Min age
              <input
                type="number"
                min="0"
                max="120"
                inputMode="numeric"
                value={minAge}
                onChange={e => setMinAge(e.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              Max age
              <input
                type="number"
                min="0"
                max="120"
                inputMode="numeric"
                value={maxAge}
                onChange={e => setMaxAge(e.target.value)}
                placeholder="100"
              />
            </label>
          </div>
        )}

        <Toolbar className="report-extra-filters">
          {hasGenderSupport && (
            <SearchableSelect
              label="Gender filter"
              value={gender}
              onChange={setGender}
              options={genderOptions}
              placeholder="None"
            />
          )}
          {hasVoterSupport && (
            <SearchableSelect
              label="Voter status"
              value={voterStatus}
              onChange={setVoterStatus}
              options={voterOptions}
              placeholder="None"
            />
          )}
          {hasPresenceSupport && (
            <SearchableSelect
              label="Where now"
              value={presenceStatus}
              onChange={setPresenceStatus}
              options={presenceOptions}
              placeholder="None"
            />
          )}
          {isComplaints && (
            <SearchableSelect
              label="Complaint status"
              value={complaintStatus}
              onChange={setComplaintStatus}
              options={complaintOptions}
              placeholder="None"
            />
          )}
          <div className="report-search-field">
            <span className="section-label">Search keyword</span>
            <input
              type="search"
              enterKeyHint="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, mobile, etc.…"
            />
          </div>
        </Toolbar>

        <div className="report-scope-bar">
          <div className="report-scope-copy">
            Scope: <b>{selectedWardId ? formatWardLabel(selectedWard, 'Selected ward') : 'All wards'}</b> · <b>{areaId ? (areas.find(a => a.id === areaId)?.name || 'Selected colony') : 'All colonies'}</b>
            {hasAgeSupport && ageFilter && <> · Age: <b>{ageFilterLabel}</b></>}
            {hasGenderSupport && gender && <> · Gender: <b>{gender === 'MALE' ? 'Male (पुरुष)' : gender === 'FEMALE' ? 'Female (स्त्री)' : gender}</b></>}
            {hasVoterSupport && voterStatus && <> · Voter: <b>{voterStatus}</b></>}
            {hasPresenceSupport && presenceStatus && <> · Living: <b>{presenceStatus === 'OUT_OF_CITY' ? 'Out of city' : 'At house'}</b></>}
            {isComplaints && complaintStatus && <> · Status: <b>{complaintStatus}</b></>}
            {search && <> · Keyword: <i>"{search}"</i></>}
          </div>
          <div className="report-count-badge">
            {counting
              ? 'Calculating records…'
              : isBundle
                ? `Ready: ${count !== null ? Number(count).toLocaleString('en-IN') : '0'} rows · ${sheetCount} sheets`
                : `Ready to export: ${count !== null ? Number(count).toLocaleString('en-IN') : '0'} records`}
          </div>
        </div>

        {isBundle && breakdown && !counting && (
          <div className="report-sheet-chips">
            {Object.entries(breakdown).map(([key, n]) => (
              <span key={key}>{SHEET_LABELS[key] || key}: {Number(n).toLocaleString('en-IN')}</span>
            ))}
          </div>
        )}
        <div className="export-actions">
          <button
            className="primary-btn"
            disabled={busy || counting}
            onClick={excel}
          >
            {busy && busyFormat === 'xlsx' ? 'Exporting…' : <><span>⤓</span> {isBundle ? 'Export all as Excel' : 'Export Excel'}</>}
          </button>
          <button
            className="ghost-btn"
            disabled={busy || isBundle}
            title={isBundle ? 'PDF is available after you pick one report type' : 'Export PDF'}
            onClick={pdf}
          >
            {busy && busyFormat === 'pdf' ? 'Preparing PDF…' : <><span>🗎</span> Export PDF</>}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              className="ghost-btn report-reset"
              onClick={clearFilters}
            >
              ↺ Reset filters
            </button>
          )}
        </div>
        {isBundle && (
          <p className="report-pdf-note">PDF is for a single report. Combined export downloads Excel only.</p>
        )}
      </section>
    </div>
  );
}
