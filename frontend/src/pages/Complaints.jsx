import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, getUser } from '../services/api';
import {
  Empty,
  ErrorBox,
  Field,
  MultiImageField,
  Loading,
  Modal,
  PageHeader,
  StatusPill,
  fmtDateTime,
  SearchableSelect,
  PaginationBar
} from '../components/Ui';
import { packComplaintImages, parseComplaintImages } from '../complaintMedia';
import { getAccurateLocation } from '../location';
import WardFilter from '../components/WardFilter';
import { useWardFilter } from '../wardFilter';
import { can, isEmployee, isNagarsevak, isMaster, isSubMaster } from '../rbac';
import { COMPLAINT_CATEGORIES } from './UserComplaints';
import ComplaintTimeline from '../components/ComplaintTimeline';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import {
  PhoneIcon,
  SearchIcon,
  MapPinIcon,
  UserCheckIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
  RefreshCwIcon,
  ClockIcon,
  CheckIcon,
  AlertCircleIcon,
  FileTextIcon,
  FilterIcon,
  ShieldIcon
} from '../components/Icons';

const statuses = ['SUBMITTED', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'CLOSED'];

const STATUS_FILTER_OPTIONS = [
  { value: 'SUBMITTED', label: 'Open (New)' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REOPENED', label: 'Reopened' },
  { value: 'CLOSED', label: 'Closed' }
];

const PRIORITY_FILTER_OPTIONS = [
  { value: 'CRITICAL', label: '🔴 Critical' },
  { value: 'HIGH', label: '🟠 High' },
  { value: 'MEDIUM', label: '🟡 Medium' },
  { value: 'LOW', label: '🟢 Low' }
];

const blank = {
  houseId: '',
  citizenPersonId: '',
  category: 'WATER',
  customCategory: '',
  priority: 'MEDIUM',
  location: '',
  description: '',
  reportedImages: []
};

function getInitials(name) {
  if (!name) return 'C';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function getCategoryLabel(catKey) {
  if (!catKey) return 'Civic Issue';
  const found = COMPLAINT_CATEGORIES.find(([k]) => k === catKey);
  if (found) return found[1];
  return String(catKey).replaceAll('_', ' ');
}

function fmtDateOnly(val) {
  if (!val) return '—';
  const d = new Date(val);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTimeOnly(val) {
  if (!val) return '';
  const d = new Date(val);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function openDirections(locationStr, house, wardName) {
  let query = String(locationStr || '').trim();
  if (!query && house) {
    query = [house.houseNumber ? `House #${house.houseNumber}` : '', house.address, house.area?.name]
      .filter(Boolean)
      .join(', ');
  }
  if (!query) {
    alert('No location or address is available for this complaint.');
    return;
  }
  const gpsMatch = query.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  let destination = query;
  if (gpsMatch) {
    destination = `${gpsMatch[1]},${gpsMatch[2]}`;
  } else if (
    wardName &&
    !destination.toLowerCase().includes('ahmednagar') &&
    !destination.toLowerCase().includes('ahilyanagar')
  ) {
    destination = `${destination}, ${wardName}, Ahilyanagar`;
  }
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
    '_blank',
    'noopener,noreferrer'
  );
}

export function formatStatusLabel(status) {
  if (!status) return '';
  const s = String(status).toUpperCase();
  if (s === 'SUBMITTED' || s === 'OPEN') return 'Open';
  if (s === 'IN_PROGRESS') return 'In Progress';
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function getTimelineDescription(h, complaint, isMr = false) {
  const custom = String(h?.comment || '').trim();
  if (custom) return custom;
  if (h?.newStatus === 'RESOLVED' && complaint?.resolutionNote) {
    return complaint.resolutionNote;
  }
  const s = h?.newStatus;
  if (!h?.oldStatus || s === 'SUBMITTED' || s === 'OPEN') {
    return isMr
      ? 'तक्रार प्राप्त झाली असून वॉर्ड कामकाजासाठी नोंदवली गेली आहे.'
      : 'Complaint received and recorded in the ward system.';
  }
  if (s === 'ASSIGNED') {
    return isMr
      ? 'तक्रार क्षेत्रीय कर्मचारी / पथकाकडे सोपवण्यात आली आहे.'
      : 'Complaint assigned to field staff for execution.';
  }
  if (s === 'IN_PROGRESS') {
    return isMr
      ? 'कर्मचाऱ्यांकडून प्रत्यक्ष काम सुरू करण्यात आले आहे.'
      : 'Field work started and in progress.';
  }
  if (s === 'PENDING') {
    return isMr
      ? 'तपासणी किंवा साहित्याच्या उपलब्धतेसाठी तक्रार प्रलंबित ठेवली आहे.'
      : 'Marked pending for site inspection or materials.';
  }
  if (s === 'RESOLVED') {
    return isMr
      ? 'समस्येचे काम यशस्वीरीत्या पूर्ण झाले आहे.'
      : 'Work successfully completed and resolved.';
  }
  if (s === 'CLOSED') {
    return isMr
      ? 'तक्रार पडताळणीअंती बंद करण्यात आली आहे.'
      : 'Complaint verified and closed.';
  }
  if (s === 'REOPENED') {
    return isMr
      ? 'पुढील तपासणी अथवा कामासाठी तक्रार पुन्हा उघडण्यात आली आहे.'
      : 'Complaint reopened for further review or follow-up.';
  }
  return isMr ? 'स्थिती अद्ययावत केली गेली.' : `Status updated to ${formatStatusLabel(s)}.`;
}

export function getUpdateStatusOptions(currentStatus, isEmp) {
  if (isEmp) {
    return ['IN_PROGRESS', 'RESOLVED'];
  }
  if (currentStatus === 'RESOLVED') {
    return ['RESOLVED', 'CLOSED', 'REOPENED'];
  }
  if (currentStatus === 'CLOSED') {
    return ['CLOSED', 'REOPENED'];
  }
  return ['IN_PROGRESS', 'RESOLVED', 'PENDING'];
}

export default function Complaints() {
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const toggleExpanded = id =>
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const user = getUser();
  const location = useLocation();
  const { selectedWardId } = useWardFilter();

  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    category: '',
    assignedEmployeeId: '',
    fromDate: '',
    toDate: ''
  });

  const [showFilters, setShowFilters] = useState(false);

  const [kpiStats, setKpiStats] = useState({
    total: 0,
    pendingOpen: 0,
    inProgress: 0,
    resolvedClosed: 0
  });

  const [people, setPeople] = useState([]);
  const [houses, setHouses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [nagarsevaks, setNagarsevaks] = useState([]);

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [removing, setRemoving] = useState(null);

  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const handleGetLocation = async () => {
    try {
      setLocating(true);
      setError('');
      const loc = await getAccurateLocation({ timeout: 22000, desiredAccuracy: 20 });
      setForm(prev => ({
        ...prev,
        location: loc.formatted || loc.address || `GPS: ${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`
      }));
    } catch (err) {
      setError(err.message || 'Could not retrieve GPS location.');
    } finally {
      setLocating(false);
    }
  };

  async function load(nextFilters = filters, nextPage = page, nextLimit = limit) {
    try {
      setError('');
      const p = {
        ...nextFilters,
        page: nextPage,
        limit: nextLimit,
        wardId: selectedWardId || undefined,
        fromDate: /^\d{4}-\d{2}-\d{2}$/.test(nextFilters.fromDate || '') ? nextFilters.fromDate : undefined,
        toDate: /^\d{4}-\d{2}-\d{2}$/.test(nextFilters.toDate || '') ? nextFilters.toDate : undefined,
        category: nextFilters.category || undefined,
        status: nextFilters.status || undefined,
        priority: nextFilters.priority || undefined,
        assignedEmployeeId: nextFilters.assignedEmployeeId || undefined,
        search: nextFilters.search ? String(nextFilters.search).trim() : undefined
      };
      const r = await api.complaints(p);
      setRows(r.data || []);
      setMeta(r.meta || { total: (r.data || []).length, page: nextPage, limit: nextLimit });
    } catch (e) {
      setError(e.message);
      setRows([]);
      setMeta({ total: 0, page: 1, limit: nextLimit });
    }
  }

  async function loadKpiStats() {
    try {
      const res = await api.complaints({
        limit: 100,
        wardId: selectedWardId || undefined
      });
      const items = res.data || [];
      let pendingOpen = 0;
      let inProgress = 0;
      let resolvedClosed = 0;
      items.forEach(c => {
        const s = String(c.status || '').toUpperCase();
        if (['SUBMITTED', 'OPEN', 'PENDING', 'REOPENED'].includes(s)) {
          pendingOpen++;
        } else if (['ASSIGNED', 'IN_PROGRESS'].includes(s)) {
          inProgress++;
        } else if (['RESOLVED', 'CLOSED'].includes(s)) {
          resolvedClosed++;
        }
      });
      setKpiStats({
        total: res.meta?.total || items.length,
        pendingOpen,
        inProgress,
        resolvedClosed
      });
    } catch (_) {}
  }

  async function loadReferences() {
    try {
      const canViewStaff = can('VIEW_STAFF') || isMaster(user) || isNagarsevak(user);
      const canViewCitizens = can('VIEW_CITIZENS') || isMaster(user) || isNagarsevak(user);
      const canViewHouses = can('VIEW_HOUSES') || isMaster(user) || isNagarsevak(user);
      const [p, h, e, n] = await Promise.all([
        canViewCitizens
          ? api.persons({ limit: 500, wardId: selectedWardId || undefined }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        canViewHouses
          ? api.houses({ limit: 500, wardId: selectedWardId || undefined }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        canViewStaff
          ? api.employees({ limit: 500, wardId: selectedWardId || undefined }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        canViewStaff
          ? api.corporators({ limit: 100, page: 1, wardId: selectedWardId || undefined }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] })
      ]);
      setPeople(p.data || []);
      setHouses(h.data || []);
      setEmployees(e.data || []);
      setNagarsevaks(n.data || []);
    } catch (_) {}
  }

  useEffect(() => {
    loadReferences();
    loadKpiStats();
  }, [selectedWardId]);

  useEffect(() => {
    setPage(1);
  }, [
    selectedWardId,
    filters.search,
    filters.status,
    filters.priority,
    filters.category,
    filters.assignedEmployeeId,
    filters.fromDate,
    filters.toDate
  ]);

  useEffect(() => {
    const t = setTimeout(() => load(filters, page, limit), 250);
    return () => clearTimeout(t);
  }, [
    selectedWardId,
    filters.search,
    filters.status,
    filters.priority,
    filters.category,
    filters.assignedEmployeeId,
    filters.fromDate,
    filters.toDate,
    page,
    limit
  ]);

  const pages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || limit)));
  const wardPeople = people;
  const wardHouses = houses;
  const assignable = employees.filter(
    e => isMaster(user) || isSubMaster(user) || String(e.managerUserId) === String(user?.id)
  );
  const visible = useMemo(() => rows || [], [rows]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category) count++;
    if (filters.assignedEmployeeId) count++;
    if (filters.fromDate) count++;
    if (filters.toDate) count++;
    return count;
  }, [filters.category, filters.assignedEmployeeId, filters.fromDate, filters.toDate]);

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.status ||
    filters.priority ||
    filters.category ||
    filters.assignedEmployeeId ||
    filters.fromDate ||
    filters.toDate
  );

  function resetFilters() {
    setFilters({
      search: '',
      status: '',
      priority: '',
      category: '',
      assignedEmployeeId: '',
      fromDate: '',
      toDate: ''
    });
    setPage(1);
  }

  const canDeleteComplaint = (isMaster(user) || isSubMaster(user) || isNagarsevak(user)) && can('DELETE_COMPLAINTS');

  async function create(e) {
    e.preventDefault();
    if (form.category === 'OTHER' && !String(form.customCategory || '').trim()) {
      setError('Please specify the complaint type in the text box.');
      return;
    }
    setBusy(true);
    try {
      const chosenCat = COMPLAINT_CATEGORIES.find(c => c[0] === form.category);
      const catLabel = chosenCat ? chosenCat[1] : form.category;
      const finalDescription =
        String(form.description || '').trim() || String(form.customCategory || '').trim() || catLabel;
      const finalCategory =
        form.category === 'OTHER' && form.customCategory.trim() ? form.customCategory.trim() : form.category;
      await api.createComplaint({
        ...form,
        category: finalCategory,
        customCategory: form.customCategory.trim(),
        description: finalDescription,
        priority: form.priority || 'MEDIUM',
        reportedImages: form.reportedImages || [],
        reportedImage: packComplaintImages(form.reportedImages || [])
      });
      setOpen(false);
      setForm({ ...blank });
      await Promise.all([load(), loadKpiStats()]);
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'success',
            message: 'Complaint submitted successfully.'
          }
        })
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function update(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const commentToSend =
        String(editing.comment || '').trim() ||
        (editing.status === 'RESOLVED' ? String(editing.resolutionNote || '').trim() : '');
      await api.updateComplaintStatus(editing.id, {
        status: editing.status,
        comment: commentToSend,
        resolutionNote: editing.resolutionNote,
        resolutionImages: editing.resolutionImages || [],
        resolutionImage: packComplaintImages(editing.resolutionImages || editing.resolutionImage || [])
      });
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'success',
            message: `Complaint ${editing.complaintNumber} status updated successfully.`
          }
        })
      );
      setEditing(null);
      await Promise.all([load(), loadKpiStats()]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function assign() {
    setBusy(true);
    try {
      if (assigning.assignToSelf) {
        await api.assignComplaint(assigning.id, { assignToSelf: true });
      } else {
        if (!assigning.employeeId) throw new Error('Please select an employee or take the complaint yourself.');
        await api.assignComplaint(assigning.id, { employeeId: assigning.employeeId });
      }
      const actionWord = assigning.isReassign ? 'reassigned' : 'assigned';
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'success',
            message: `Complaint ${assigning.complaintNumber} ${actionWord} successfully.`
          }
        })
      );
      setAssigning(null);
      await Promise.all([load(), loadKpiStats()]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(id) {
    try {
      setDetail((await api.complaint(id)).data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('open');
    const status = params.get('status');
    if (id) openDetail(id);
    if (status && statuses.includes(status)) setFilters(f => ({ ...f, status }));
  }, [location.search]);

  const selectedCitizen = people.find(p => p.id === form.citizenPersonId);

  return (
    <div className="admin-data-page complaints-page" style={{ paddingTop: '8px' }}>
      <PageHeader
        kicker="Citizen Grievances & Civic Works"
        title="Complaints"
        subtitle="Track, prioritize, assign, and resolve municipal ward complaints and civic issues."
        action={
          can('CREATE_COMPLAINTS') ? (
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                setError('');
                setForm({ ...blank });
                setOpen(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>+ New Complaint</span>
            </button>
          ) : null
        }
      />

      <ErrorBox error={error} />

      {/* KPI Overview Cards (4 interactive executive cards) */}
      <div className="team-kpi-grid complaint-kpi-grid">
        <div
          className={`team-kpi-card ${!filters.status ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setFilters(f => ({ ...f, status: '' }))}
          title="Click to view all complaints"
        >
          <div className="team-kpi-icon blue">
            <FileTextIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiStats.total}</div>
            <div className="team-kpi-label">Total Complaints</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${['SUBMITTED', 'PENDING', 'REOPENED'].includes(filters.status) ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setFilters(f => ({ ...f, status: f.status === 'SUBMITTED' ? '' : 'SUBMITTED' }))}
          title="Click to view open/submitted complaints"
        >
          <div className="team-kpi-icon amber">
            <ClockIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiStats.pendingOpen}</div>
            <div className="team-kpi-label">Open & Pending</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${['ASSIGNED', 'IN_PROGRESS'].includes(filters.status) ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setFilters(f => ({ ...f, status: f.status === 'IN_PROGRESS' ? '' : 'IN_PROGRESS' }))}
          title="Click to view complaints in progress"
        >
          <div className="team-kpi-icon purple">
            <RefreshCwIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiStats.inProgress}</div>
            <div className="team-kpi-label">In Progress & Assigned</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${['RESOLVED', 'CLOSED'].includes(filters.status) ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setFilters(f => ({ ...f, status: f.status === 'RESOLVED' ? '' : 'RESOLVED' }))}
          title="Click to view resolved & closed complaints"
        >
          <div className="team-kpi-icon green">
            <CheckIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiStats.resolvedClosed}</div>
            <div className="team-kpi-label">Resolved & Closed</div>
          </div>
        </div>
      </div>

      {/* Professional Search & Filter Toolbar with OPEN FILTER toggle */}
      <div className="complaint-toolbar-panel">
        <div className="complaint-toolbar-row">
          {/* Quick Search */}
          <div className="complaint-search-box">
            <SearchIcon size={16} />
            <input
              placeholder="Search complaint, resident, mobile…"
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
            />
            {filters.search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setFilters({ ...filters, search: '' })}
                title="Clear search input"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Ward Filter */}
          <div className="complaint-quick-ward">
            <WardFilter compact label="" />
          </div>

          {/* Quick Status & Priority Dropdowns */}
          <div className="complaint-quick-filters-row">
            <div className="complaint-quick-status">
              <select
                value={filters.status}
                onChange={e => setFilters({ ...filters, status: e.target.value })}
                className="prof-filter-select"
                style={{ height: '36px', minHeight: '36px', fontSize: '12.5px' }}
              >
                <option value="">All Statuses</option>
                {STATUS_FILTER_OPTIONS.map(x => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="complaint-quick-priority">
              <select
                value={filters.priority}
                onChange={e => setFilters({ ...filters, priority: e.target.value })}
                className="prof-filter-select"
                style={{ height: '36px', minHeight: '36px', fontSize: '12.5px' }}
              >
                <option value="">All Priorities</option>
                {PRIORITY_FILTER_OPTIONS.map(x => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Toolbar Action Buttons */}
          <div className="complaint-toolbar-actions">
            {/* OPEN / HIDE FILTERS BUTTON */}
            <button
              type="button"
              className={`filter-toggle-btn ${showFilters ? 'is-active' : ''}`}
              onClick={() => setShowFilters(prev => !prev)}
              title={showFilters ? 'Hide detailed filters' : 'Open detailed filters'}
            >
              <FilterIcon size={14} />
              <span>{showFilters ? 'Hide Filters' : 'Open Filters'}</span>
              {activeFilterCount > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    background: showFilters ? '#3b82f6' : '#eff6ff',
                    color: showFilters ? '#ffffff' : '#1d4ed8',
                    fontWeight: 800,
                    marginLeft: '3px'
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                className="btn-action"
                onClick={resetFilters}
                style={{ height: '36px', padding: '0 11px', color: '#64748b' }}
                title="Reset all search & filter options"
              >
                <RefreshCwIcon size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* EXPANDABLE ADVANCED FILTER PANEL */}
        {showFilters && (
          <div className="complaint-expanded-filters">
            <div
              className="prof-filter-grid"
              style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}
            >
              {/* Category */}
              <div className="prof-filter-field">
                <label className="prof-filter-label">Category</label>
                <select
                  className="prof-filter-select"
                  value={filters.category}
                  onChange={e => setFilters({ ...filters, category: e.target.value })}
                >
                  <option value="">All Categories</option>
                  {COMPLAINT_CATEGORIES.map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assigned Staff (when not employee) */}
              {!isEmployee(user) && assignable.length > 0 && (
                <div className="prof-filter-field">
                  <label className="prof-filter-label">Assigned Worker</label>
                  <select
                    className="prof-filter-select"
                    value={filters.assignedEmployeeId}
                    onChange={e => setFilters({ ...filters, assignedEmployeeId: e.target.value })}
                  >
                    <option value="">All Assigned Staff</option>
                    {assignable.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.User?.name || 'Employee'}
                        {e.designation ? ` · ${e.designation}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* From Date */}
              <div className="prof-filter-field">
                <label className="prof-filter-label">From Date</label>
                <input
                  type="date"
                  className="prof-filter-select"
                  style={{ backgroundImage: 'none', paddingRight: '12px' }}
                  value={filters.fromDate}
                  onChange={e => setFilters({ ...filters, fromDate: e.target.value })}
                />
              </div>

              {/* To Date */}
              <div className="prof-filter-field">
                <label className="prof-filter-label">To Date</label>
                <input
                  type="date"
                  className="prof-filter-select"
                  style={{ backgroundImage: 'none', paddingRight: '12px' }}
                  value={filters.toDate}
                  onChange={e => setFilters({ ...filters, toDate: e.target.value })}
                />
              </div>
            </div>

            {/* Filter Panel Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px solid #f1f5f9',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <div className="muted" style={{ fontSize: '12px' }}>
                Showing <strong>{visible.length}</strong> of <strong>{meta.total || 0}</strong> complaints
                {filters.status && ` · Status: ${formatStatusLabel(filters.status)}`}
              </div>
              <div style={{ display: 'inline-flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-action"
                  style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                >
                  Clear Filters
                </button>
                <button
                  type="button"
                  className="btn-action"
                  style={{ height: '30px', padding: '0 10px', fontSize: '12px' }}
                  onClick={() => setShowFilters(false)}
                >
                  Close Filter Panel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Complaints Table */}
      {!rows ? (
        <Loading />
      ) : !visible.length ? (
        <Empty>No complaints match the selected filters.</Empty>
      ) : (
        <div className="panel table-wrap">
          <table style={{ tableLayout: 'auto', minWidth: '1280px', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '175px', minWidth: '175px' }}>Complaint #</th>
                <th style={{ width: '185px', minWidth: '185px' }}>Citizen & Contact</th>
                <th style={{ width: '255px', minWidth: '255px' }}>Issue & Location</th>
                <th style={{ width: '110px', minWidth: '110px' }}>Ward / Area</th>
                <th className="th-center" style={{ width: '105px', minWidth: '105px', textAlign: 'center' }}>
                  Status
                </th>
                <th style={{ width: '160px', minWidth: '160px' }}>Assignment</th>
                <th style={{ width: '280px', minWidth: '280px', textAlign: 'center' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map(c => {
                const imgCount = parseComplaintImages(c.reportedImages || c.reportedImage).length;
                const priorityClass = `priority-${String(c.priority || 'MEDIUM').toLowerCase()}`;
                const canAssignComplaint =
                  (isMaster(user) || isNagarsevak(user) || isSubMaster(user)) &&
                  !['RESOLVED', 'CLOSED'].includes(c.status);
                const canEditComplaint =
                  can('EDIT_COMPLAINTS') &&
                  (isEmployee(user) ? c.assignedEmployeeId === user?.employeeProfile?.id : true);

                return (
                  <tr key={c.id}>
                    {/* Complaint # & Priority */}
                    <td data-label="Complaint #">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>
                          <button
                            type="button"
                            className="complaint-id-badge"
                            onClick={() => openDetail(c.id)}
                            title="Click to view full details"
                          >
                            {c.complaintNumber}
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          <span className={`priority-tag ${priorityClass}`}>
                            {c.priority || 'MEDIUM'}
                          </span>
                        </div>
                        <div
                          className="muted"
                          style={{
                            fontSize: '10.5px',
                            color: '#64748b',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <ClockIcon size={10} style={{ flexShrink: 0 }} />
                          <span>{fmtDateOnly(c.createdAt)}, {fmtTimeOnly(c.createdAt)}</span>
                        </div>
                      </div>
                    </td>

                    {/* Citizen & Contact */}
                    <td data-label="Citizen & Contact">
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <div
                          className="prof-avatar"
                          style={{
                            width: '32px',
                            height: '32px',
                            minWidth: '32px',
                            fontSize: '11.5px',
                            borderRadius: '8px',
                            flexShrink: 0,
                            marginTop: '2px'
                          }}
                        >
                          {getInitials(c.citizen?.fullName || c.submittedBy?.name || 'C')}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: '#0f172a',
                              lineHeight: 1.3,
                              wordBreak: 'break-word'
                            }}
                            title={c.citizen?.fullName || c.submittedBy?.name}
                          >
                            {c.citizen?.fullName || c.submittedBy?.name || 'Registered Resident'}
                          </div>
                          {c.citizen?.mobile || c.submittedBy?.mobile ? (
                            <a
                              href={`tel:${c.citizen?.mobile || c.submittedBy?.mobile}`}
                              className="prof-contact-link notranslate"
                              translate="no"
                              style={{
                                fontSize: '11.5px',
                                fontWeight: 600,
                                gap: '4px',
                                marginTop: '2px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                color: '#2563eb',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <PhoneIcon size={11} style={{ flexShrink: 0 }} />
                              <span>{c.citizen?.mobile || c.submittedBy?.mobile}</span>
                            </a>
                          ) : (
                            <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                              No mobile
                            </div>
                          )}
                          {c.submittedBy?.name && c.citizen?.fullName && c.submittedBy.name !== c.citizen.fullName && (
                            <div
                              className="muted"
                              style={{ fontSize: '10.5px', marginTop: '1px', color: '#64748b' }}
                            >
                              By: {c.submittedBy.name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category & Problem */}
                    <td data-label="Category & Problem">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span className="prof-category-pill">{getCategoryLabel(c.category)}</span>
                          {imgCount > 0 && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                color: '#065f46',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}
                            >
                              📷 {imgCount}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.4 }}>
                          {c.description && c.description.length > 55 ? (
                            <span>
                              {expandedIds.has(c.id) ? c.description : `${c.description.slice(0, 55)}… `}
                              <button
                                type="button"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  color: '#2563eb',
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  cursor: 'pointer'
                                }}
                                onClick={e => {
                                  e.stopPropagation();
                                  toggleExpanded(c.id);
                                }}
                              >
                                {expandedIds.has(c.id) ? 'Less' : 'More'}
                              </button>
                            </span>
                          ) : (
                            <span>{c.description || '—'}</span>
                          )}
                        </div>

                        {(c.location || c.house?.address) && (
                          <div className="complaint-loc-row">
                            <div className="complaint-loc-text">
                              <MapPinIcon size={12} />
                              <span title={c.location || c.house?.address}>
                                {c.location ||
                                  `${c.house?.houseNumber ? `#${c.house.houseNumber}, ` : ''}${
                                    c.house?.address || ''
                                  }`}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="table-directions-btn"
                              title="Get directions in Google Maps"
                              onClick={e => {
                                e.stopPropagation();
                                openDirections(c.location, c.house, c.ward?.name || c.house?.area?.ward?.name);
                              }}
                            >
                              <MapPinIcon size={12} />
                              <span>Directions</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Ward / Area */}
                    <td data-label="Ward / Area">
                      <span className="prof-ward-badge">
                        {formatWardNumber(c.ward?.wardNumber || c.house?.area?.ward?.wardNumber) || 'Ward —'}
                      </span>
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: '#475569',
                          fontWeight: 500,
                          marginTop: '3px',
                          lineHeight: 1.25,
                          wordBreak: 'break-word'
                        }}
                        title={c.ward?.name || c.house?.area?.name}
                      >
                        {c.ward?.name || c.house?.area?.ward?.name || c.house?.area?.name || '—'}
                      </div>
                    </td>

                    {/* Status */}
                    <td data-label="Status" className="td-center" style={{ textAlign: 'center' }}>
                      <StatusPill>{c.status}</StatusPill>
                      {c.status === 'RESOLVED' && c.resolvedAt && (
                        <div className="muted" style={{ fontSize: '10px', marginTop: '3px', color: '#059669', fontWeight: 600 }}>
                          {fmtDateOnly(c.resolvedAt)}
                        </div>
                      )}
                    </td>

                    {/* Assignment: Nagarsevak & Field Worker */}
                    <td data-label="Assignment">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11.5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 800,
                              padding: '1px 4px',
                              borderRadius: '3px',
                              background: '#f1f5f9',
                              color: '#475569',
                              letterSpacing: '0.03em'
                            }}
                          >
                            NAGAR
                          </span>
                          <strong
                            style={{
                              fontSize: '11.5px',
                              color: '#0f172a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={c.assignedNagarsevak?.name || c.assignedEmployee?.manager?.name}
                          >
                            {c.assignedNagarsevak?.name || c.assignedEmployee?.manager?.name || 'Unassigned'}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 800,
                              padding: '1px 4px',
                              borderRadius: '3px',
                              background: c.assignedEmployee?.User?.name ? '#e0e7ff' : '#f1f5f9',
                              color: c.assignedEmployee?.User?.name ? '#3730a3' : '#94a3b8',
                              letterSpacing: '0.03em'
                            }}
                          >
                            STAFF
                          </span>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: c.assignedEmployee?.User?.name ? 600 : 400,
                              color: c.assignedEmployee?.User?.name ? '#1e293b' : '#94a3b8',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={c.assignedEmployee?.User?.name}
                          >
                            {c.assignedEmployee?.User?.name || 'Not assigned'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Actions: Clean responsive group (View, Assign/Reassign, Update, Delete) */}
                    <td data-label="Actions" style={{ textAlign: 'center' }}>
                      <div className="complaint-actions-grid">
                        <button
                          type="button"
                          className="btn-action outline-blue"
                          title="View full complaint details"
                          onClick={() => openDetail(c.id)}
                        >
                          <EyeIcon size={12} />
                          <span>View</span>
                        </button>

                        {canAssignComplaint && (
                          <button
                            type="button"
                            className="btn-action complaint-btn-assign"
                            title={
                              c.assignedEmployeeId || c.assignedEmployee
                                ? 'Reassign to another staff member'
                                : 'Assign to field staff'
                            }
                            onClick={() =>
                              setAssigning({
                                id: c.id,
                                complaintNumber: c.complaintNumber,
                                employeeId: c.assignedEmployeeId || '',
                                assignToSelf: false,
                                isReassign: Boolean(c.assignedEmployeeId || c.assignedEmployee),
                                currentEmployeeName: c.assignedEmployee?.User?.name || '',
                                currentNagarsevakName:
                                  c.assignedNagarsevak?.name || c.assignedEmployee?.manager?.name || '',
                                currentStatus: c.status
                              })
                            }
                          >
                            <UserCheckIcon size={12} />
                            <span>{c.assignedEmployeeId || c.assignedEmployee ? 'Reassign' : 'Assign'}</span>
                          </button>
                        )}

                        {canEditComplaint && (
                          <button
                            type="button"
                            className="btn-action exec-btn-edit"
                            title="Update complaint status & progress"
                            onClick={() =>
                              setEditing({
                                ...c,
                                _originalStatus: c.status,
                                comment: '',
                                resolutionNote: c.resolutionNote || '',
                                resolutionImage: c.resolutionImage || null,
                                resolutionImages: parseComplaintImages(c.resolutionImages || c.resolutionImage),
                                showInlineReassign: false,
                                reassignEmployeeId: c.assignedEmployeeId || '',
                                reassignToSelf: false
                              })
                            }
                          >
                            <EditIcon size={12} />
                            <span>Update</span>
                          </button>
                        )}

                        {canDeleteComplaint && (
                          <button
                            type="button"
                            className="btn-action danger"
                            title="Delete complaint"
                            onClick={() => setRemoving(c)}
                          >
                            <TrashIcon size={12} />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows && visible.length > 0 && (
        <PaginationBar page={page} pages={pages} total={meta.total || 0} limit={limit} onPage={setPage} onLimit={setLimit} />
      )}

      {/* New Complaint Modal */}
      {open && (
        <Modal wide title="New Complaint" onClose={() => setOpen(false)}>
          <form className="form-grid admin-form" onSubmit={create}>
            <div className="form-section-title span-2">
              <strong>Who and Where</strong>
              <span>Select the citizen and the registered house this grievance belongs to.</span>
            </div>

            <SearchableSelect
              label="Citizen"
              required
              value={form.citizenPersonId}
              onChange={v => {
                const p = people.find(x => x.id === v);
                setForm({ ...form, citizenPersonId: v, houseId: p?.family?.house?.id || '' });
              }}
              options={wardPeople.map(p => ({
                value: p.id,
                label: `${p.fullName} · ${p.mobile || 'No mobile'}`
              }))}
              placeholder="Search citizen by name or mobile…"
            />

            <SearchableSelect
              label="House"
              required
              value={form.houseId}
              onChange={v => setForm({ ...form, houseId: v })}
              options={wardHouses.map(h => ({
                value: h.id,
                label: `${h.houseNumber ? `House #${h.houseNumber}` : 'House'} · ${h.area?.name || h.address || ''}`
              }))}
              placeholder="Search house number or area…"
            />

            {selectedCitizen && (
              <div className="span-2 muted" style={{ fontSize: '12px' }}>
                Selected citizen’s linked address:{' '}
                <strong>
                  {selectedCitizen.family?.house?.houseNumber ? `House #${selectedCitizen.family?.house?.houseNumber}, ` : ''}
                  {selectedCitizen.family?.house?.address || '—'}
                </strong>
              </div>
            )}

            <div className="form-section-title span-2" style={{ marginTop: '10px' }}>
              <strong>Problem & Location</strong>
              <span>Describe the issue clearly and provide exact location so the ward team can act swiftly.</span>
            </div>

            <Field label="Complaint Category">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {COMPLAINT_CATEGORIES.map(([v, en]) => (
                  <option key={v} value={v}>
                    {en}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Priority Level">
              <select value={form.priority || 'MEDIUM'} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option value="CRITICAL">🔴 Critical Priority</option>
                <option value="HIGH">🟠 High Priority</option>
                <option value="MEDIUM">🟡 Medium Priority (Standard)</option>
                <option value="LOW">🟢 Low Priority</option>
              </select>
            </Field>

            {form.category === 'OTHER' && (
              <Field className="span-2" label="Specify complaint type *">
                <input
                  required
                  value={form.customCategory}
                  onChange={e => setForm({ ...form, customCategory: e.target.value })}
                  placeholder="e.g. Drainage line choke, stray dogs, pipeline leak..."
                />
              </Field>
            )}

            <Field className="span-2" label="Location / Landmark">
              <div className="location-input-row">
                <input
                  value={form.location || ''}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="Enter landmark, street name, or fetch GPS…"
                />
                <button
                  type="button"
                  className="gps-fetch-btn"
                  disabled={locating}
                  onClick={handleGetLocation}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <MapPinIcon size={14} />
                  <span>{locating ? 'Locating…' : 'Exact GPS Location'}</span>
                </button>
              </div>
            </Field>

            <Field className="span-2" label="Problem description (optional)">
              <textarea
                rows={3}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What is the problem? (Optional - defaults to category name if left blank)"
              />
            </Field>

            <div className="span-2">
              <MultiImageField
                max={5}
                label="Problem photos (max 5)"
                values={form.reportedImages || []}
                onChange={v => setForm({ ...form, reportedImages: v })}
                cameraLabel="Open camera"
              />
            </div>

            <div
              className="modal-actions span-2"
              style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}
            >
              <button type="button" className="btn-action" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-action primary" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit Complaint'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Assignment / Reassignment Modal */}
      {assigning && (
        <Modal
          title={`${assigning.isReassign ? 'Reassign' : 'Assign'} ${assigning.complaintNumber}`}
          onClose={() => setAssigning(null)}
        >
          {assigning.isReassign ? (
            <div className="assignment-status-banner reassign-mode">
              <div className="status-banner-icon" style={{ color: '#2563eb' }}>
                <RefreshCwIcon size={20} />
              </div>
              <div className="status-banner-info">
                <div className="status-banner-header">
                  <strong>Current Assignment</strong>
                  <span className="reassign-pill">Reassignment</span>
                </div>
                <p className="status-banner-detail" style={{ margin: '4px 0', fontSize: '13px' }}>
                  Worker: <strong>{assigning.currentEmployeeName || 'Assigned employee'}</strong>
                  {assigning.currentNagarsevakName && (
                    <>
                      {' '}
                      · Nagarsevak: <strong>{assigning.currentNagarsevakName}</strong>
                    </>
                  )}
                </p>
                <small className="status-banner-sub">
                  Select a new staff member below to reassign this complaint, or take it yourself.
                </small>
              </div>
            </div>
          ) : (
            <div className="assignment-status-banner assign-mode">
              <div className="status-banner-icon" style={{ color: '#059669' }}>
                <UserCheckIcon size={20} />
              </div>
              <div className="status-banner-info">
                <div className="status-banner-header">
                  <strong>Complaint Assignment</strong>
                  <span className="assign-pill">New Assignment</span>
                </div>
                <small className="status-banner-sub">
                  {isNagarsevak(user)
                    ? 'You can assign a field worker under your team or take this complaint directly.'
                    : 'Select an available staff worker from this ward.'}
                </small>
              </div>
            </div>
          )}

          {isNagarsevak(user) && (
            <label className="self-assign-option" style={{ marginBottom: '14px' }}>
              <input
                type="checkbox"
                checked={!!assigning.assignToSelf}
                onChange={e =>
                  setAssigning({
                    ...assigning,
                    assignToSelf: e.target.checked,
                    employeeId: e.target.checked ? '' : assigning.employeeId
                  })
                }
              />
              <span>
                <strong>Take complaint yourself</strong>
                <small>I will personally supervise and resolve this grievance on-site.</small>
              </span>
            </label>
          )}

          {!assigning.assignToSelf && (
            <SearchableSelect
              label={assigning.isReassign ? 'Select New Staff Member' : 'Assign To Staff Member'}
              required
              value={assigning.employeeId}
              onChange={v => setAssigning({ ...assigning, employeeId: v })}
              options={assignable.map(e => ({
                value: e.id,
                label: `${e.User?.name || 'Employee'} · ${e.designation || 'Field Staff'}${
                  e.id === assigning.employeeId && assigning.isReassign ? ' (Current)' : ''
                }`
              }))}
              placeholder={assigning.isReassign ? 'Select new worker…' : 'Search staff member…'}
            />
          )}

          <div
            className="modal-actions"
            style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}
          >
            <button type="button" className="btn-action" onClick={() => setAssigning(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-action primary"
              disabled={(!assigning.assignToSelf && !assigning.employeeId) || busy}
              onClick={assign}
            >
              {busy
                ? assigning.isReassign
                  ? 'Reassigning…'
                  : 'Assigning…'
                : assigning.isReassign
                ? 'Reassign Complaint'
                : 'Assign Complaint'}
            </button>
          </div>
        </Modal>
      )}

      {/* Update Status Modal */}
      {editing && (
        <Modal wide title={`Update ${editing.complaintNumber}`} onClose={() => setEditing(null)}>
          <form className="form-grid admin-form" onSubmit={update}>
            <div className="form-section-title span-2">
              <strong>Status Update & Work Progress</strong>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                Current status: <StatusPill>{editing._originalStatus || editing.status}</StatusPill> · Select next status
                and record progress notes
              </span>
            </div>

            <Field label="New Status *" className="span-2">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <select
                  value={editing.status}
                  onChange={e => setEditing({ ...editing, status: e.target.value })}
                  style={{ maxWidth: '320px', fontWeight: 600 }}
                >
                  {getUpdateStatusOptions(editing._originalStatus || editing.status, isEmployee(user)).map(x => (
                    <option key={x} value={x}>
                      {x === 'IN_PROGRESS' ? 'In Progress' : x.charAt(0) + x.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
                <StatusPill>{editing.status}</StatusPill>
              </div>
            </Field>

            {editing.status === 'RESOLVED' ? (
              <>
                <Field className="span-2" label="Resolution Note (optional)">
                  <textarea
                    placeholder="Describe the work done to resolve this complaint (e.g., pipeline repaired, street light replaced)..."
                    rows={3}
                    value={editing.resolutionNote || ''}
                    onChange={e => setEditing({ ...editing, resolutionNote: e.target.value })}
                  />
                </Field>
                <div className="span-2">
                  <MultiImageField
                    max={5}
                    label="Work completed photos (max 5)"
                    values={editing.resolutionImages || parseComplaintImages(editing.resolutionImage)}
                    onChange={v =>
                      setEditing({
                        ...editing,
                        resolutionImages: v,
                        resolutionImage: packComplaintImages(v)
                      })
                    }
                    optional={true}
                    cameraLabel="Take completion photo"
                  />
                </div>
                <Field className="span-2" label="Additional remarks (optional)">
                  <textarea
                    placeholder="Optional additional remarks or verification notes..."
                    rows={2}
                    value={editing.comment || ''}
                    onChange={e => setEditing({ ...editing, comment: e.target.value })}
                  />
                </Field>
              </>
            ) : (
              <Field className="span-2" label="Progress note / remarks (optional)">
                <textarea
                  placeholder="Add progress note or remarks about work currently underway..."
                  rows={3}
                  value={editing.comment || ''}
                  onChange={e => setEditing({ ...editing, comment: e.target.value })}
                />
              </Field>
            )}

            <div
              className="modal-actions span-2"
              style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}
            >
              <button type="button" className="btn-action" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-action primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save Status Update'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Details Modal */}
      {detail && (
        <Modal wide title={`${detail.complaintNumber} · Complete Complaint Details`} onClose={() => setDetail(null)}>
          {/* Top Banner / Summary Bar */}
          <div className="complaint-detail-header-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="complaint-detail-id-pill">{detail.complaintNumber}</span>
                <span className={`priority-tag priority-${String(detail.priority || 'MEDIUM').toLowerCase()}`}>
                  {detail.priority || 'MEDIUM'}
                </span>
                <span className="prof-category-pill">{getCategoryLabel(detail.category)}</span>
                <StatusPill>{detail.status}</StatusPill>
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {can('EDIT_COMPLAINTS') && (isEmployee(user) ? detail.assignedEmployeeId === user?.employeeProfile?.id : true) && (
                  <button
                    type="button"
                    className="btn-action primary"
                    style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                    onClick={() => {
                      setEditing({
                        ...detail,
                        _originalStatus: detail.status,
                        comment: '',
                        resolutionNote: detail.resolutionNote || '',
                        resolutionImage: detail.resolutionImage || null,
                        resolutionImages: parseComplaintImages(detail.resolutionImages || detail.resolutionImage),
                        showInlineReassign: false,
                        reassignEmployeeId: detail.assignedEmployeeId || '',
                        reassignToSelf: false
                      });
                      setDetail(null);
                    }}
                  >
                    <EditIcon size={12} />
                    <span>Update Status</span>
                  </button>
                )}
              </div>
            </div>

            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ClockIcon size={13} style={{ color: '#0284c7' }} />
                <span>Registered: <strong>{fmtDateTime(detail.createdAt)}</strong></span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <MapPinIcon size={13} style={{ color: '#059669' }} />
                <span>Ward: <strong>{formatWardLabel(detail.ward || detail.house?.area?.ward)}</strong></span>
              </span>
              {detail.resolvedAt && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#059669', fontWeight: 600 }}>
                  <CheckIcon size={13} />
                  <span>Resolved: <strong>{fmtDateTime(detail.resolvedAt)}</strong></span>
                </span>
              )}
            </div>
          </div>

          {/* 2-Column Responsive Information Layout */}
          <div className="complaint-detail-grid-v2">
            {/* Left Column: Problem & Location */}
            <div>
              {/* Grievance Statement */}
              <div className="complaint-detail-section-card">
                <div className="complaint-detail-section-title">
                  <FileTextIcon size={15} style={{ color: '#2563eb' }} />
                  <span>Problem Statement & Details</span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '6px' }}>
                  Category: <strong style={{ color: '#0f172a' }}>{getCategoryLabel(detail.category)}</strong>
                  {detail.customCategory && (
                    <span style={{ marginLeft: '6px', color: '#2563eb' }}>({detail.customCategory})</span>
                  )}
                </div>
                <div className="complaint-problem-box">
                  {detail.description || 'No detailed description provided by the citizen.'}
                </div>
              </div>

              {/* Location & Navigation */}
              <div className="complaint-detail-section-card">
                <div className="complaint-detail-section-title">
                  <MapPinIcon size={15} style={{ color: '#059669' }} />
                  <span>Location & Resident Address</span>
                </div>

                <div className="complaint-detail-info-row">
                  <span className="complaint-detail-label">Landmark / GPS</span>
                  <span className="complaint-detail-value" style={{ fontWeight: 600 }}>
                    {detail.location || '—'}
                  </span>
                </div>

                <div className="complaint-detail-info-row">
                  <span className="complaint-detail-label">House & Area</span>
                  <span className="complaint-detail-value">
                    {detail.house
                      ? `${detail.house.houseNumber ? `House #${detail.house.houseNumber}, ` : ''}${detail.house.address || ''}${detail.house.area?.name ? ` · ${detail.house.area.name}` : ''}`
                      : '—'}
                  </span>
                </div>

                <div className="complaint-detail-info-row">
                  <span className="complaint-detail-label">Ward Jurisdiction</span>
                  <span className="complaint-detail-value">
                    {formatWardLabel(detail.ward || detail.house?.area?.ward)}
                  </span>
                </div>

                {(detail.location || detail.house?.address) && (
                  <div className="complaint-detail-directions">
                    <button
                      type="button"
                      className="table-directions-btn table-directions-btn-lg"
                      onClick={() =>
                        openDirections(detail.location, detail.house, detail.ward?.name || detail.house?.area?.ward?.name)
                      }
                    >
                      <MapPinIcon size={14} />
                      <span>Get Directions in Google Maps</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Resolution / Completion Note (if available) */}
              {(detail.resolutionNote || detail.resolvedAt || ['RESOLVED', 'CLOSED'].includes(detail.status)) && (
                <div
                  className="complaint-detail-section-card"
                  style={{
                    borderColor: '#bbf7d0',
                    background: '#f0fdf4'
                  }}
                >
                  <div className="complaint-detail-section-title" style={{ color: '#166534', borderColor: '#bbf7d0' }}>
                    <CheckIcon size={15} style={{ color: '#166534' }} />
                    <span>Work Completion & Resolution Notes</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#166534', lineHeight: 1.5, margin: '6px 0' }}>
                    {detail.resolutionNote || 'Work marked completed and verified by ward staff.'}
                  </div>
                  {detail.resolvedAt && (
                    <div style={{ fontSize: '11px', color: '#15803d', marginTop: '4px' }}>
                      Resolved on: <strong>{fmtDateTime(detail.resolvedAt)}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: People, Accountability & Assignment */}
            <div>
              {/* Resident / Citizen Profile */}
              <div className="complaint-detail-section-card">
                <div className="complaint-detail-section-title">
                  <UserCheckIcon size={15} style={{ color: '#0284c7' }} />
                  <span>Resident & Submitter Profile</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                  <div
                    className="prof-avatar"
                    style={{
                      width: '38px',
                      height: '38px',
                      minWidth: '38px',
                      fontSize: '13px',
                      borderRadius: '8px'
                    }}
                  >
                    {getInitials(detail.citizen?.fullName || detail.submittedBy?.name || 'C')}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>
                      {detail.citizen?.fullName || detail.submittedBy?.name || 'Registered Resident'}
                    </strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {detail.citizen ? 'Registered Citizen Record' : 'Submitted via User Portal'}
                    </span>
                  </div>
                </div>

                <div className="complaint-detail-info-row">
                  <span className="complaint-detail-label">Contact Number</span>
                  <span className="complaint-detail-value">
                    {detail.citizen?.mobile || detail.submittedBy?.mobile ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <a
                          href={`tel:${detail.citizen?.mobile || detail.submittedBy?.mobile}`}
                          style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <PhoneIcon size={12} />
                          <span>{detail.citizen?.mobile || detail.submittedBy?.mobile}</span>
                        </a>
                        <a
                          href={`https://wa.me/91${String(detail.citizen?.mobile || detail.submittedBy?.mobile).replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-action"
                          style={{
                            height: '22px',
                            padding: '0 6px',
                            fontSize: '10.5px',
                            color: '#15803d',
                            borderColor: '#86efac',
                            background: '#dcfce7',
                            fontWeight: 700
                          }}
                          title="Chat on WhatsApp"
                        >
                          WhatsApp
                        </a>
                      </div>
                    ) : (
                      <span className="muted">No mobile recorded</span>
                    )}
                  </span>
                </div>

                <div className="complaint-detail-info-row">
                  <span className="complaint-detail-label">Email Address</span>
                  <span className="complaint-detail-value" style={{ wordBreak: 'break-all' }}>
                    {detail.submittedBy?.email || detail.citizen?.email ? (
                      <a
                        href={`mailto:${detail.submittedBy?.email || detail.citizen?.email}`}
                        style={{ color: '#2563eb', textDecoration: 'none' }}
                      >
                        {detail.submittedBy?.email || detail.citizen?.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>

                {detail.submittedBy?.name && (
                  <div className="complaint-detail-info-row">
                    <span className="complaint-detail-label">Portal Submitter</span>
                    <span className="complaint-detail-value">
                      {detail.submittedBy.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Ward Leadership & Field Staff Assignment */}
              <div className="complaint-detail-section-card">
                <div className="complaint-detail-section-title">
                  <ShieldIcon size={15} style={{ color: '#4338ca' }} />
                  <span>Ward Leadership & Assignment</span>
                </div>

                <div className="complaint-detail-info-row">
                  <span className="complaint-detail-label">Nagarsevak</span>
                  <span className="complaint-detail-value">
                    <strong style={{ color: '#1e1b4b' }}>
                      {detail.assignedNagarsevak?.name || detail.assignedEmployee?.manager?.name || 'Unassigned'}
                    </strong>
                    {detail.assignedNagarsevak?.mobile && (
                      <div style={{ fontSize: '11px', marginTop: '2px' }}>
                        <a
                          href={`tel:${detail.assignedNagarsevak.mobile}`}
                          style={{ color: '#4338ca', textDecoration: 'none', fontWeight: 600 }}
                        >
                          📞 {detail.assignedNagarsevak.mobile}
                        </a>
                      </div>
                    )}
                  </span>
                </div>

                <div className="complaint-detail-info-row">
                  <span className="complaint-detail-label">Assigned Worker</span>
                  <span className="complaint-detail-value">
                    {detail.assignedEmployee?.User?.name ? (
                      <div>
                        <strong style={{ color: '#0f172a' }}>{detail.assignedEmployee.User.name}</strong>
                        {detail.assignedEmployee.designation && (
                          <div className="muted" style={{ fontSize: '11px' }}>
                            {detail.assignedEmployee.designation}
                          </div>
                        )}
                        {detail.assignedEmployee.User.mobile && (
                          <div style={{ fontSize: '11px', marginTop: '2px' }}>
                            <a
                              href={`tel:${detail.assignedEmployee.User.mobile}`}
                              style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
                            >
                              📞 {detail.assignedEmployee.User.mobile}
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#b45309',
                          background: '#fef3c7',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontWeight: 700
                        }}
                      >
                        Not assigned yet
                      </span>
                    )}
                  </span>
                </div>

                {/* Quick Reassign/Assign Button inside card */}
                {(isMaster(user) || isNagarsevak(user) || isSubMaster(user)) && !['RESOLVED', 'CLOSED'].includes(detail.status) && (
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn-action"
                      style={{ color: '#4338ca', borderColor: '#c7d2fe', background: '#eef2ff', fontWeight: 700, fontSize: '11.5px', height: '28px' }}
                      onClick={() => {
                        setAssigning({
                          id: detail.id,
                          complaintNumber: detail.complaintNumber,
                          employeeId: detail.assignedEmployeeId || '',
                          assignToSelf: false,
                          isReassign: Boolean(detail.assignedEmployeeId || detail.assignedEmployee),
                          currentEmployeeName: detail.assignedEmployee?.User?.name || '',
                          currentNagarsevakName: detail.assignedNagarsevak?.name || detail.assignedEmployee?.manager?.name || '',
                          currentStatus: detail.status
                        });
                        setDetail(null);
                      }}
                    >
                      <UserCheckIcon size={12} />
                      <span>{detail.assignedEmployeeId || detail.assignedEmployee ? 'Reassign to Another Worker' : 'Assign to Worker'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Problem Photos (Citizen Uploaded) */}
          <div className="detail-card complaint-photo-block" style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                Images Uploaded by Resident (Problem Photos)
              </h3>
              <span
                style={{
                  background: parseComplaintImages(detail.reportedImages || detail.reportedImage).length
                    ? '#f0f4f8'
                    : '#f8fafc',
                  color: parseComplaintImages(detail.reportedImages || detail.reportedImage).length
                    ? '#1e293b'
                    : '#64748b',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  border: '1px solid #e2e8f0'
                }}
              >
                {parseComplaintImages(detail.reportedImages || detail.reportedImage).length
                  ? `${parseComplaintImages(detail.reportedImages || detail.reportedImage).length} photos`
                  : 'No photos attached'}
              </span>
            </div>
            {parseComplaintImages(detail.reportedImages || detail.reportedImage).length ? (
              <div className="image-grid photo-preview-grid">
                {parseComplaintImages(detail.reportedImages || detail.reportedImage).map((src, i) => (
                  <div
                    key={i}
                    className="complaint-photo-item"
                    onClick={() =>
                      setPreviewImage({
                        src,
                        title: `Problem photo #${i + 1} (${detail.complaintNumber})`
                      })
                    }
                  >
                    <div className="photo-label">Problem Photo #{i + 1}</div>
                    <img src={src} alt={`Reported problem ${i + 1}`} />
                    <div className="photo-zoom-hint">Tap to enlarge</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: '6px 0 0', fontSize: '12px' }}>
                Citizen did not attach any photos when submitting this complaint.
              </p>
            )}
          </div>

          {/* After-Work Photos (Completion) */}
          <div
            className="detail-card complaint-photo-block"
            style={{
              marginTop: '14px',
              borderColor: parseComplaintImages(detail.resolutionImages || detail.resolutionImage).length
                ? '#bbf7d0'
                : '#e2e8f0',
              background: parseComplaintImages(detail.resolutionImages || detail.resolutionImage).length
                ? '#f0fdf4'
                : '#ffffff'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                After-Work Completion Photos (Field Staff / Nagarsevak)
              </h3>
              <span
                style={{
                  background: parseComplaintImages(detail.resolutionImages || detail.resolutionImage).length
                    ? '#dcfce7'
                    : '#f8fafc',
                  color: parseComplaintImages(detail.resolutionImages || detail.resolutionImage).length
                    ? '#166534'
                    : '#64748b',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  border: parseComplaintImages(detail.resolutionImages || detail.resolutionImage).length
                    ? '1px solid #86efac'
                    : '1px solid #e2e8f0'
                }}
              >
                {parseComplaintImages(detail.resolutionImages || detail.resolutionImage).length
                  ? `${parseComplaintImages(detail.resolutionImages || detail.resolutionImage).length} completion photos`
                  : 'Work completion pending'}
              </span>
            </div>
            {parseComplaintImages(detail.resolutionImages || detail.resolutionImage).length ? (
              <div className="image-grid photo-preview-grid">
                {parseComplaintImages(detail.resolutionImages || detail.resolutionImage).map((src, i) => (
                  <div
                    key={i}
                    className="complaint-photo-item"
                    onClick={() =>
                      setPreviewImage({
                        src,
                        title: `Work Completed Photo #${i + 1} (${detail.complaintNumber})`
                      })
                    }
                  >
                    <div className="photo-label" style={{ color: '#166534', background: '#dcfce7' }}>
                      Work Completed #{i + 1}
                    </div>
                    <img src={src} alt={`Completed work ${i + 1}`} />
                    <div className="photo-zoom-hint">Tap to enlarge</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: '6px 0 0', fontSize: '12px' }}>
                No completion photos uploaded yet. They can be added when updating the complaint status to resolved.
              </p>
            )}
          </div>

          {/* Stepper Timeline */}
          <div className="detail-card" style={{ marginTop: '14px' }}>
            <ComplaintTimeline history={detail.history} complaint={detail} isMr={false} />
          </div>

          {/* Modal Actions */}
          <div
            className="modal-actions complaint-detail-modal-footer"
            style={{
              marginTop: '18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <button type="button" className="btn-action complaint-modal-close-btn" onClick={() => setDetail(null)}>
              Close
            </button>
            <div className="complaint-modal-action-group" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {(detail.location || detail.house?.address) && (
                <button
                  type="button"
                  className="table-directions-btn table-directions-btn-lg"
                  onClick={() =>
                    openDirections(detail.location, detail.house, detail.ward?.name || detail.house?.area?.ward?.name)
                  }
                >
                  <MapPinIcon size={13} />
                  <span>Get Directions</span>
                </button>
              )}
              {(isMaster(user) || isNagarsevak(user) || isSubMaster(user)) &&
                !['RESOLVED', 'CLOSED'].includes(detail.status) && (
                  <button
                    type="button"
                    className="btn-action"
                    style={{ color: '#4338ca', borderColor: '#c7d2fe', background: '#eef2ff' }}
                    onClick={() => {
                      setAssigning({
                        id: detail.id,
                        complaintNumber: detail.complaintNumber,
                        employeeId: detail.assignedEmployeeId || '',
                        assignToSelf: false,
                        isReassign: Boolean(detail.assignedEmployeeId || detail.assignedEmployee),
                        currentEmployeeName: detail.assignedEmployee?.User?.name || '',
                        currentNagarsevakName:
                          detail.assignedNagarsevak?.name || detail.assignedEmployee?.manager?.name || '',
                        currentStatus: detail.status
                      });
                      setDetail(null);
                    }}
                  >
                    <UserCheckIcon size={14} />
                    <span>{Boolean(detail.assignedEmployeeId || detail.assignedEmployee) ? 'Reassign' : 'Assign'}</span>
                  </button>
                )}
              {can('EDIT_COMPLAINTS') &&
                (isEmployee(user) ? detail.assignedEmployeeId === user?.employeeProfile?.id : true) && (
                  <button
                    type="button"
                    className="btn-action primary"
                    onClick={() => {
                      const initialStatus =
                        detail.status === 'SUBMITTED' || detail.status === 'ASSIGNED' ? 'IN_PROGRESS' : detail.status;
                      setEditing({
                        ...detail,
                        status: initialStatus,
                        _originalStatus: detail.status,
                        comment: '',
                        resolutionNote: detail.resolutionNote || '',
                        resolutionImages: parseComplaintImages(detail.resolutionImages || detail.resolutionImage),
                        resolutionImage: detail.resolutionImage || null
                      });
                      setDetail(null);
                    }}
                  >
                    <EditIcon size={13} />
                    <span>Update Status</span>
                  </button>
                )}
              {can('EDIT_COMPLAINTS') && !isEmployee(user) && detail.status === 'RESOLVED' && (
                <button
                  type="button"
                  className="btn-action success"
                  onClick={async () => {
                    try {
                      await api.updateComplaintStatus(detail.id, {
                        status: 'CLOSED',
                        comment: 'Verified and closed after resolution.'
                      });
                      setDetail(null);
                      await Promise.all([load(), loadKpiStats()]);
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  <CheckIcon size={14} />
                  <span>Mark Closed</span>
                </button>
              )}
              {canDeleteComplaint && (
                <button
                  type="button"
                  className="btn-action danger"
                  onClick={() => setRemoving(detail)}
                >
                  <TrashIcon size={14} />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {removing && (
        <Modal title={`Delete ${removing.complaintNumber}?`} onClose={() => !busy && setRemoving(null)}>
          <p className="activation-confirm-copy">
            This complaint will be removed from the ward desk and from the citizen’s My Complaints. It stays in the
            Recycle Bin for 30 days if you need to restore it.
          </p>
          <dl className="nagar-activation-facts" style={{ margin: '12px 0 16px' }}>
            <div>
              <dt>Ward</dt>
              <dd>
                {formatWardNumber(removing.ward?.wardNumber || removing.house?.area?.ward?.wardNumber) || '—'}
                {removing.ward?.name || removing.house?.area?.ward?.name
                  ? ` · ${removing.ward?.name || removing.house?.area?.ward?.name}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Citizen</dt>
              <dd>{removing.citizen?.fullName || removing.submittedBy?.name || 'Registered Resident'}</dd>
            </div>
            <div>
              <dt>Mobile</dt>
              <dd>{removing.citizen?.mobile || removing.submittedBy?.mobile || '—'}</dd>
            </div>
            <div className="span-2">
              <dt>Problem</dt>
              <dd>{removing.description || removing.category || '—'}</dd>
            </div>
          </dl>
          <div
            className="modal-actions"
            style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}
          >
            <button type="button" className="btn-action" disabled={busy} onClick={() => setRemoving(null)}>
              Keep Complaint
            </button>
            <button
              type="button"
              className="btn-action danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.deleteComplaint(removing.id);
                  setRemoving(null);
                  setDetail(null);
                  await Promise.all([load(), loadKpiStats()]);
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Please wait…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <Modal title={previewImage.title || 'Image Preview'} onClose={() => setPreviewImage(null)}>
          <div style={{ textAlign: 'center', padding: '12px' }}>
            <img
              src={previewImage.src}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '68vh',
                borderRadius: '12px',
                objectFit: 'contain',
                boxShadow: '0 8px 30px rgba(0,0,0,0.18)'
              }}
            />
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                className="btn-action primary"
                onClick={() => {
                  const w = window.open('');
                  if (w) {
                    w.document.write(
                      `<!DOCTYPE html><html><head><title>${
                        previewImage.title || 'Complaint Photo'
                      }</title><style>body{margin:0;background:#0f172a;display:grid;place-items:center;min-height:100vh;}img{max-width:100%;max-height:100vh;object-fit:contain;box-shadow:0 10px 40px rgba(0,0,0,0.5);}</style></head><body><img src="${
                        previewImage.src
                      }" alt="Photo"/></body></html>`
                    );
                    w.document.close();
                  }
                }}
              >
                Open Full Size in New Window
              </button>
              <button type="button" className="btn-action" onClick={() => setPreviewImage(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
