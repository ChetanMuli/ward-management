import React, { useEffect, useState, useCallback } from 'react';
import { api, getUser } from '../services/api';
import { PageHeader, ErrorBox, Loading, Modal, StatCard } from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { isMaster, isSubMaster, isNagarsevak, isEmployee } from '../rbac';
import { useWardFilter } from '../wardFilter';
import { exportScheduleToPdf } from '../schedulePdf';

const SCHEDULE_CATEGORIES = [
  { key: 'VISIT', label: 'Field / Site Visit', color: '#0284c7', bg: '#e0f2fe' },
  { key: 'MEETING', label: 'Official Meeting', color: '#7c3aed', bg: '#ede9fe' },
  { key: 'INSPECTION', label: 'Ward Inspection', color: '#d97706', bg: '#fef3c7' },
  { key: 'EVENT', label: 'Event / Program', color: '#059669', bg: '#d1fae5' },
  { key: 'CITIZEN_HEARING', label: 'Citizen Hearing', color: '#dc2626', bg: '#fee2e2' },
  { key: 'OTHER', label: 'Other Work', color: '#475569', bg: '#f1f5f9' },
];

const SCHEDULE_PRIORITIES = [
  { key: 'URGENT', label: 'Urgent', color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
  { key: 'HIGH', label: 'High', color: '#c2410c', bg: '#ffedd5', border: '#fdba74' },
  { key: 'MEDIUM', label: 'Medium', color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
  { key: 'LOW', label: 'Low', color: '#334155', bg: '#f1f5f9', border: '#cbd5e1' },
];

function getCategoryMeta(catKey) {
  return SCHEDULE_CATEGORIES.find((c) => c.key === catKey) || SCHEDULE_CATEGORIES[0];
}

function getPriorityMeta(priKey) {
  return SCHEDULE_PRIORITIES.find((p) => p.key === priKey) || SCHEDULE_PRIORITIES[2];
}

function getTodayDateStr() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

function getYesterdayDateStr() {
  const dt = new Date();
  dt.setDate(dt.getDate() - 1);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dt);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

function getTomorrowDateStr() {
  const dt = new Date();
  dt.setDate(dt.getDate() + 1);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dt);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

function formatScheduleDate(dateStr) {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    return dt.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch (_) {
    return dateStr;
  }
}

function formatWeekDisplayRange(startStr, endStr) {
  if (!startStr || !endStr) return '';
  const [, sm, sd] = startStr.split('-');
  const [, em, ed] = endStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const smName = months[Number(sm) - 1] || sm;
  const emName = months[Number(em) - 1] || em;
  if (sm === em) {
    return `${Number(sd)} - ${Number(ed)} ${smName}`;
  }
  return `${Number(sd)} ${smName} - ${Number(ed)} ${emName}`;
}

function formatMonthDisplay(dateStr) {
  if (!dateStr) return '';
  const [y, m] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mName = months[Number(m) - 1] || m;
  return `${mName} ${y}`;
}

export default function Schedules() {
  const user = getUser();
  const master = isMaster(user);
  const subMaster = isSubMaster(user);
  const nagar = isNagarsevak(user);
  const employee = isEmployee(user);
  const admin = master || subMaster;

  const { selectedWardId: selected, canSelect } = useWardFilter();

  const [schedules, setSchedules] = useState([]);
  const [scheduleSummary, setScheduleSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters (Category filter removed per user requirement)
  const [scheduleFilter, setScheduleFilter] = useState('today');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState('');
  const [schedulePriority, setSchedulePriority] = useState('');
  const [scheduleCreatedBy, setScheduleCreatedBy] = useState('');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [selectedNagarId, setSelectedNagarId] = useState('');

  // PDF Export Modal State (Multi-Select Report Periods)
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfReportTypes, setPdfReportTypes] = useState(['today', 'yesterday_remaining']);
  const [pdfStatusFilter, setPdfStatusFilter] = useState('ALL');
  const [pdfReportStyle, setPdfReportStyle] = useState('standard'); // 'standard' | 'detailed' | 'custom'
  const [showAdvancedPdfOptions, setShowAdvancedPdfOptions] = useState(false);
  const [pdfOrientation, setPdfOrientation] = useState('landscape');
  const [pdfIncludeStats, setPdfIncludeStats] = useState(true);
  const [pdfColumns, setPdfColumns] = useState({
    date: true,
    time: true,
    title: true,
    notes: false,
    category: true,
    priority: true,
    location: true,
    status: true,
    creator: false,
    completion: false,
  });
  const [pdfExporting, setPdfExporting] = useState(false);

  // Modals & In-flight states
  const [scheduleMarkingId, setScheduleMarkingId] = useState(null);
  const [scheduleModal, setScheduleModal] = useState({ isOpen: false, mode: 'create', item: null });
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    scheduledDate: '',
    scheduledTime: '',
    location: '',
    category: 'VISIT',
    priority: 'MEDIUM',
    description: '',
    nagarsevakUserId: ''
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [corporatorsList, setCorporatorsList] = useState([]);
  const [empManagerInfo, setEmpManagerInfo] = useState(null);

  // Load managing Nagarsevak for employee
  useEffect(() => {
    if (employee) {
      api.myWard()
        .then((r) => {
          if (r?.data?.nagarsevak) {
            setEmpManagerInfo(r.data.nagarsevak);
          }
        })
        .catch(() => {});
    }
  }, [employee]);

  // Load corporators for admin
  useEffect(() => {
    if (admin) {
      api.corporators(selected ? { wardId: selected } : {})
        .then((r) => setCorporatorsList(r?.data || []))
        .catch(() => {});
    }
  }, [admin, selected]);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        wardId: selected || undefined,
        nagarsevakUserId: admin && selectedNagarId ? selectedNagarId : undefined,
        filterPreset: scheduleFilter !== 'custom' ? scheduleFilter : undefined,
        date: scheduleDate || undefined,
        status: scheduleStatus || undefined,
        priority: schedulePriority || undefined,
        createdByType: scheduleCreatedBy || undefined,
        search: scheduleSearch.trim() || undefined,
      };
      const res = await api.schedules(params);
      setSchedules(res?.data || []);
      const summary = res?.meta?.summary || res?.summary || null;
      if (summary) {
        setScheduleSummary(summary);
      }
    } catch (err) {
      setError(err.message || 'Failed to load schedule items');
    } finally {
      setLoading(false);
    }
  }, [selected, selectedNagarId, scheduleFilter, scheduleDate, scheduleStatus, schedulePriority, scheduleCreatedBy, scheduleSearch, admin]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handleMoveToToday = async (item) => {
    if (!item?.id) return;
    try {
      await api.updateSchedule(item.id, {
        scheduledDate: getTodayDateStr(),
      });
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'success',
            message: `✓ Task moved to Today's Agenda: "${item.title}"`
          }
        })
      );
      loadSchedules();
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'error',
            message: err.message || 'Failed to move task to today'
          }
        })
      );
    }
  };

  const handleToggleScheduleStatus = async (item, targetStatus = null) => {
    if (!item) return;
    const newStatus = targetStatus || (item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED');
    setScheduleMarkingId(item.id);
    try {
      const res = await api.updateScheduleStatus(item.id, { status: newStatus });
      const updatedItem = res?.data;
      setSchedules((prev) =>
        prev.map((s) => (s.id === item.id ? (updatedItem || { ...s, status: newStatus }) : s))
      );
      loadSchedules();
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'error', message: err.message || 'Failed to update schedule status' }
        })
      );
    } finally {
      setScheduleMarkingId(null);
    }
  };

  const openAddScheduleModal = () => {
    const defaultDate = scheduleDate || scheduleSummary?.todayStr || getTodayDateStr();
    let defaultNagarId = '';
    if (nagar) {
      defaultNagarId = user.id;
    } else if (employee) {
      defaultNagarId = empManagerInfo?.id || user?.employeeProfile?.managerUserId || '';
    } else if (selectedNagarId) {
      defaultNagarId = selectedNagarId;
    } else if (corporatorsList.length > 0) {
      defaultNagarId = corporatorsList[0].id;
    }

    setScheduleForm({
      title: '',
      scheduledDate: defaultDate,
      scheduledTime: '',
      location: '',
      category: 'VISIT',
      priority: 'MEDIUM',
      description: '',
      nagarsevakUserId: defaultNagarId,
    });
    setScheduleModal({ isOpen: true, mode: 'create', item: null });
  };

  const openEditScheduleModal = (item) => {
    setScheduleForm({
      title: item.title || '',
      scheduledDate: item.scheduledDate || '',
      scheduledTime: item.scheduledTime || '',
      location: item.location || '',
      category: item.category || 'VISIT',
      priority: item.priority || 'MEDIUM',
      description: item.description || '',
      nagarsevakUserId: item.nagarsevakUserId || '',
    });
    setScheduleModal({ isOpen: true, mode: 'edit', item });
  };

  const handleSaveSchedule = async (e) => {
    if (e) e.preventDefault();
    if (!scheduleForm.title.trim()) {
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'error', message: 'Work / Task title is required.' }
        })
      );
      return;
    }
    if (!scheduleForm.scheduledDate) {
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'error', message: 'Scheduled date is required.' }
        })
      );
      return;
    }

    setScheduleSaving(true);
    try {
      if (scheduleModal.mode === 'create') {
        const payload = {
          ...scheduleForm,
          title: scheduleForm.title.trim(),
          location: scheduleForm.location ? scheduleForm.location.trim() : undefined,
          description: scheduleForm.description ? scheduleForm.description.trim() : undefined,
          scheduledTime: scheduleForm.scheduledTime ? scheduleForm.scheduledTime.trim() : undefined,
          nagarsevakUserId: employee ? (empManagerInfo?.id || undefined) : (scheduleForm.nagarsevakUserId || undefined),
          wardId: selected || undefined,
        };
        await api.createSchedule(payload);
        window.dispatchEvent(
          new CustomEvent('ward:toast', {
            detail: { type: 'success', message: 'Schedule task created successfully!' }
          })
        );
      } else {
        const payload = {
          ...scheduleForm,
          title: scheduleForm.title.trim(),
          location: scheduleForm.location ? scheduleForm.location.trim() : null,
          description: scheduleForm.description ? scheduleForm.description.trim() : null,
          scheduledTime: scheduleForm.scheduledTime ? scheduleForm.scheduledTime.trim() : null,
        };
        await api.updateSchedule(scheduleModal.item.id, payload);
        window.dispatchEvent(
          new CustomEvent('ward:toast', {
            detail: { type: 'success', message: 'Schedule task updated successfully!' }
          })
        );
      }
      setScheduleModal({ isOpen: false, mode: 'create', item: null });
      loadSchedules();
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'error', message: err.message || 'Failed to save schedule task' }
        })
      );
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleDeleteSchedule = async (item) => {
    if (!item?.id) return;
    if (!window.confirm(`Are you sure you want to delete "${item.title}" from the daily schedule?`)) {
      return;
    }
    try {
      await api.deleteSchedule(item.id);
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'success', message: 'Schedule item deleted successfully.' }
        })
      );
      loadSchedules();
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'error', message: err.message || 'Failed to delete schedule item' }
        })
      );
    }
  };

  const togglePdfReportType = (typeKey) => {
    setPdfReportTypes((prev) => {
      if (prev.includes(typeKey)) {
        if (prev.length <= 1) return prev; // Keep at least one selected
        return prev.filter((t) => t !== typeKey);
      }
      return [...prev, typeKey];
    });
  };

  const handleOpenPdfModal = () => {
    if (['today', 'yesterday_remaining', 'week', 'last_week'].includes(scheduleFilter)) {
      setPdfReportTypes([scheduleFilter]);
    } else {
      setPdfReportTypes(['today', 'yesterday_remaining']);
    }
    setPdfModalOpen(true);
  };

  const handleSelectReportStyle = (style) => {
    setPdfReportStyle(style);
    if (style === 'standard') {
      setPdfColumns({
        date: true,
        time: true,
        title: true,
        notes: false,
        category: true,
        priority: true,
        location: true,
        status: true,
        creator: false,
        completion: false,
      });
    } else if (style === 'detailed') {
      setPdfColumns({
        date: true,
        time: true,
        title: true,
        notes: true,
        category: true,
        priority: true,
        location: true,
        status: true,
        creator: true,
        completion: true,
      });
    }
  };

  const togglePdfColumn = (key) => {
    setPdfColumns((prev) => ({ ...prev, [key]: !prev[key] }));
    setPdfReportStyle('custom');
  };

  const handleSelectAllColumns = () => {
    setPdfReportStyle('custom');
    setPdfColumns({
      date: true,
      time: true,
      title: true,
      notes: true,
      category: true,
      priority: true,
      location: true,
      status: true,
      creator: true,
      completion: true,
    });
  };

  const handleSelectStandardColumns = () => {
    handleSelectReportStyle('standard');
  };

  const handleSelectMinimalColumns = () => {
    setPdfReportStyle('custom');
    setPdfColumns({
      date: true,
      time: true,
      title: true,
      notes: false,
      category: false,
      priority: true,
      location: true,
      status: true,
      creator: false,
      completion: false,
    });
  };

  const handleExecutePdfExport = async () => {
    if (!pdfReportTypes || pdfReportTypes.length === 0) {
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'error', message: 'Please select at least one schedule report period to export.' }
        })
      );
      return;
    }

    setPdfExporting(true);
    try {
      const scope = selected ? `Ward ID: ${selected}` : 'All Municipal Wards';
      const nagarName = nagar ? user.name : (admin && selectedNagarId ? corporatorsList.find(c => c.id === selectedNagarId)?.name : '');

      // Fetch tasks for all selected periods concurrently
      const fetchPromises = pdfReportTypes.map(async (preset) => {
        const params = {
          wardId: selected || undefined,
          nagarsevakUserId: admin && selectedNagarId ? selectedNagarId : undefined,
          filterPreset: preset,
          status: pdfStatusFilter !== 'ALL' ? pdfStatusFilter : undefined,
          limit: 250,
        };
        const res = await api.schedules(params);
        return res?.data || [];
      });

      const results = await Promise.all(fetchPromises);

      // Deduplicate items by ID
      const seenIds = new Set();
      const itemsToExport = [];
      for (const list of results) {
        for (const item of list) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            itemsToExport.push(item);
          }
        }
      }

      // Chronological sort: scheduledDate ascending, then scheduledTime ascending
      itemsToExport.sort((a, b) => {
        if (a.scheduledDate !== b.scheduledDate) {
          return a.scheduledDate.localeCompare(b.scheduledDate);
        }
        return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
      });

      const reportLabels = {
        today: "Today's Action Plan",
        yesterday_remaining: "Yesterday's Pending Tasks",
        week: "This Week's Action Plan",
        last_week: "Last Week's Work Review",
      };

      const selectedLabels = pdfReportTypes.map((t) => reportLabels[t] || t);
      const combinedTitle = selectedLabels.length === 4
        ? "Comprehensive Municipal Report (All 4 Periods)"
        : selectedLabels.join(' + ');

      const statusSuffix = pdfStatusFilter === 'COMPLETED' ? ' [Completed Only]' : pdfStatusFilter === 'INCOMPLETE' ? ' [Pending Only]' : '';
      const filterLabel = combinedTitle + statusSuffix;
      const periodType = pdfReportTypes.join('-') + (pdfStatusFilter !== 'ALL' ? `-${pdfStatusFilter.toLowerCase()}` : '');

      exportScheduleToPdf(itemsToExport, {
        title: 'Nagarsevak Daily Schedule & Action Plan Report',
        scope,
        filterLabel,
        nagarName,
        columns: pdfColumns,
        orientation: pdfOrientation,
        includeStats: pdfIncludeStats,
        periodType,
      });

      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'success',
            message: `✓ Combined PDF report (${itemsToExport.length} tasks) downloaded successfully.`
          }
        })
      );
      setPdfModalOpen(false);
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'error', message: err.message || 'Failed to generate PDF report' }
        })
      );
    } finally {
      setPdfExporting(false);
    }
  };

  const activeFilterTitle =
    scheduleFilter === 'yesterday_remaining'
      ? "Yesterday's Remaining Work"
      : scheduleFilter === 'yesterday'
      ? "Yesterday's Full Schedule"
      : scheduleFilter === 'week'
      ? "This Week's Action Plan"
      : scheduleFilter === 'week_done'
      ? "This Week's Completed Tasks"
      : scheduleFilter === 'week_remaining'
      ? "This Week's Remaining Tasks"
      : scheduleFilter === 'last_week'
      ? "Last Week's Work Review"
      : scheduleFilter === 'last_week_done'
      ? "Last Week's Completed Tasks"
      : scheduleFilter === 'month'
      ? "This Month's Action Plan"
      : scheduleFilter === 'month_done'
      ? "This Month's Completed Tasks"
      : scheduleFilter === 'month_remaining'
      ? "This Month's Remaining Tasks"
      : scheduleFilter === 'overdue'
      ? "All Past Overdue Tasks"
      : scheduleFilter === 'tomorrow'
      ? "Tomorrow's Agenda"
      : scheduleFilter === 'all'
      ? "All Schedules Archive"
      : scheduleDate
      ? `Date: ${formatScheduleDate(scheduleDate)}`
      : "Today's Action Plan";

  return (
    <div className="schedules-page">
      <PageHeader
        kicker={admin ? 'Administrative Oversight' : nagar ? 'Nagarsevak Workspace' : 'Field Operations'}
        title="Daily Schedule & Action Plan"
        subtitle="Manage scheduled site visits, citizen hearings, official meetings, and field inspections. Track remaining and completed work."
        action={
          <div className="schedule-header-actions-wrap">
            <button
              type="button"
              className="export-pdf-btn"
              onClick={handleOpenPdfModal}
              title="Download customized PDF report for today, yesterday, this week, or month"
            >
              <span>Export PDF</span>
            </button>
            <button
              type="button"
              className="schedule-add-btn"
              onClick={openAddScheduleModal}
            >
              <span>+ Add Schedule Item</span>
            </button>
          </div>
        }
      />

      <ErrorBox error={error} />

      {/* Ward & Nagarsevak Scope Selector (for Admin) */}
      {canSelect && (
        <section className="schedules-scope-bar">
          <div className="schedules-scope-info">
            <span className="schedules-scope-kicker">WARD & NAGARSEVAK SCOPE</span>
            <h3 className="schedules-scope-title">Filter Schedule by Ward & Nagarsevak</h3>
            <p className="schedules-scope-desc">Select a ward and corporator to view or manage their daily action plan.</p>
          </div>
          <div className="schedules-scope-selectors">
            <div className="schedules-scope-field">
              <span className="scope-field-label">Select Ward:</span>
              <WardFilter label="" />
            </div>
            {corporatorsList.length > 0 && (
              <div className="schedules-scope-field">
                <span className="scope-field-label">Select Nagarsevak:</span>
                <select
                  id="sched-select-nagar"
                  className="schedules-scope-select"
                  value={selectedNagarId}
                  onChange={(e) => setSelectedNagarId(e.target.value)}
                >
                  <option value="">All Nagarsevaks in Ward</option>
                  {corporatorsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.ward?.wardNumber ? `(Ward ${c.ward.wardNumber})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>
      )}

      {/* WORKFLOW CONTROLS & SCHEDULE HUB */}
      <section className="dash-schedule-section panel">
        <div className="schedule-section-header">
          <div className="schedule-header-left">
            <div className="schedule-kicker">DAILY WORKFLOW & ACTION HUB</div>
            <h3 className="schedule-title">{activeFilterTitle}</h3>
            <p className="schedule-subtitle">Connected schedule workflow for Nagarsevak and field staff. Select a quick view or choose from the dropdown below.</p>
          </div>

          <div className="schedule-metrics-pills">
            <div className="metric-pill pill-total" title="Total tasks currently listed in this view">
              <span className="pill-dot dot-blue"></span>
              <span className="pill-num">{schedules.length}</span>
              <span className="pill-text">Listed</span>
            </div>
            <div className="metric-pill pill-done" title="Completed tasks currently listed in this view">
              <span className="pill-dot dot-green"></span>
              <span className="pill-num">{schedules.filter((s) => s.status === 'COMPLETED').length}</span>
              <span className="pill-text">Completed</span>
            </div>
            <div className="metric-pill pill-pending" title="Pending tasks currently listed in this view">
              <span className="pill-dot dot-amber"></span>
              <span className="pill-num">{schedules.filter((s) => s.status !== 'COMPLETED').length}</span>
              <span className="pill-text">Pending</span>
            </div>
            {Number(scheduleSummary?.overdueRemaining || 0) > 0 && (
              <div className="metric-pill pill-overdue" title="Past overdue tasks still pending">
                <span className="pill-dot dot-red"></span>
                <span className="pill-num">{scheduleSummary.overdueRemaining}</span>
                <span className="pill-text">Overdue</span>
              </div>
            )}
          </div>
        </div>

        {/* 1-CLICK CONNECTED QUICK-FILTER PILLS BAR */}
        <div className="schedule-workflow-pills-bar">
          <span className="workflow-pills-label">Quick Views:</span>
          
          <button
            type="button"
            className={`workflow-pill-btn ${scheduleFilter === 'today' && !scheduleDate ? 'active' : ''}`}
            onClick={() => { setScheduleFilter('today'); setScheduleDate(''); }}
            title="View today's scheduled action plan"
          >
            <span className="pill-title">Today's Agenda</span>
            <span className="pill-counter">{scheduleSummary?.todayCompleted ?? 0}/{scheduleSummary?.todayTotal ?? 0} Done</span>
          </button>

          <button
            type="button"
            className={`workflow-pill-btn pill-btn-warning ${scheduleFilter === 'yesterday_remaining' && !scheduleDate ? 'active' : ''}`}
            onClick={() => { setScheduleFilter('yesterday_remaining'); setScheduleDate(''); }}
            title="View yesterday's tasks that remained incomplete"
          >
            <span className="pill-title">Yesterday's Pending</span>
            <span className={`pill-counter ${Number(scheduleSummary?.yesterdayRemaining || 0) > 0 ? 'pill-alert-tag' : 'pill-done-tag'}`}>
              {scheduleSummary?.yesterdayRemaining ?? 0} Incomplete
            </span>
          </button>

          <button
            type="button"
            className={`workflow-pill-btn ${['week', 'week_done', 'week_remaining'].includes(scheduleFilter) && !scheduleDate ? 'active' : ''}`}
            onClick={() => { setScheduleFilter('week'); setScheduleDate(''); }}
            title="View action plan for this current week"
          >
            <span className="pill-title">This Week</span>
            <span className="pill-counter">{scheduleSummary?.weekCompleted ?? 0}/{scheduleSummary?.weekTotal ?? 0} Done</span>
          </button>

          <button
            type="button"
            className={`workflow-pill-btn ${['last_week', 'last_week_done'].includes(scheduleFilter) && !scheduleDate ? 'active' : ''}`}
            onClick={() => { setScheduleFilter('last_week'); setScheduleDate(''); }}
            title="Review what work was scheduled & done last week"
          >
            <span className="pill-title">Last Week's Review</span>
            <span className="pill-counter">{scheduleSummary?.lastWeekCompleted ?? 0}/{scheduleSummary?.lastWeekTotal ?? 0} Done</span>
          </button>

          <button
            type="button"
            className={`workflow-pill-btn ${['month', 'month_done', 'month_remaining'].includes(scheduleFilter) && !scheduleDate ? 'active' : ''}`}
            onClick={() => { setScheduleFilter('month'); setScheduleDate(''); }}
            title="View municipal progress for this month"
          >
            <span className="pill-title">This Month</span>
            <span className="pill-counter">{scheduleSummary?.monthCompleted ?? 0}/{scheduleSummary?.monthTotal ?? 0} Done</span>
          </button>

          {Number(scheduleSummary?.overdueRemaining || 0) > 0 && (
            <button
              type="button"
              className={`workflow-pill-btn pill-btn-danger ${scheduleFilter === 'overdue' && !scheduleDate ? 'active' : ''}`}
              onClick={() => { setScheduleFilter('overdue'); setScheduleDate(''); }}
              title="View all past overdue tasks that are still pending"
            >
              <span className="pill-title">Overdue</span>
              <span className="pill-counter pill-alert-tag">{scheduleSummary.overdueRemaining} Pending</span>
            </button>
          )}
        </div>

        {/* UNIFIED CONTROLS TOOLBAR */}
        <div className="schedule-toolbar-unified">
          {/* PRIMARY PERIOD / VIEW DROPDOWN SELECTOR */}
          <div className="toolbar-col toolbar-col-period">
            <label htmlFor="schedule-period-select">Schedule Period / View:</label>
            <select
              id="schedule-period-select"
              className="schedule-period-select"
              value={scheduleDate ? 'custom' : scheduleFilter}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'custom') {
                  if (!scheduleDate) setScheduleDate(getTodayDateStr());
                  setScheduleFilter('custom');
                } else {
                  setScheduleDate('');
                  setScheduleFilter(val);
                }
              }}
            >
              <optgroup label="Daily Agendas">
                <option value="today">Today's Action Plan ({scheduleSummary?.todayTotal ?? 0})</option>
                <option value="yesterday_remaining">Yesterday's Remaining Work ({scheduleSummary?.yesterdayRemaining ?? 0})</option>
                <option value="yesterday">Yesterday's Full Schedule ({scheduleSummary?.yesterdayTotal ?? 0})</option>
                <option value="tomorrow">Tomorrow's Agenda</option>
              </optgroup>
              <optgroup label="Weekly Agendas">
                <option value="week">This Week's Action Plan ({scheduleSummary?.weekTotal ?? 0})</option>
                <option value="week_done">This Week's Completed Tasks ({scheduleSummary?.weekCompleted ?? 0})</option>
                <option value="week_remaining">This Week's Remaining Tasks ({scheduleSummary?.weekPending ?? 0})</option>
                <option value="last_week">Last Week's Review ({scheduleSummary?.lastWeekTotal ?? 0})</option>
                <option value="last_week_done">Last Week's Completed Tasks ({scheduleSummary?.lastWeekCompleted ?? 0})</option>
              </optgroup>
              <optgroup label="Monthly Agendas">
                <option value="month">This Month's Action Plan ({scheduleSummary?.monthTotal ?? 0})</option>
                <option value="month_done">This Month's Completed Tasks ({scheduleSummary?.monthCompleted ?? 0})</option>
                <option value="month_remaining">This Month's Remaining Tasks ({scheduleSummary?.monthRemaining ?? 0})</option>
              </optgroup>
              <optgroup label="Archive & Overdue">
                <option value="overdue">All Past Overdue Tasks ({scheduleSummary?.overdueRemaining ?? 0})</option>
                <option value="all">All Records Archive</option>
                {scheduleDate && <option value="custom">Custom Date: {formatScheduleDate(scheduleDate)}</option>}
              </optgroup>
            </select>
          </div>
          <div className="toolbar-col toolbar-col-date">
            <label htmlFor="schedule-full-date">Date:</label>
            <div className="input-with-clear">
              <input
                id="schedule-full-date"
                type="date"
                value={scheduleDate}
                onChange={(e) => {
                  setScheduleDate(e.target.value);
                  setScheduleFilter('custom');
                }}
                title="Select a specific date"
              />
              {scheduleDate && (
                <button
                  type="button"
                  className="clear-date-btn"
                  onClick={() => { setScheduleDate(''); setScheduleFilter('today'); }}
                  title="Reset date"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="toolbar-col">
            <label htmlFor="schedule-full-status">Status:</label>
            <select
              id="schedule-full-status"
              value={scheduleStatus}
              onChange={(e) => setScheduleStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="toolbar-col">
            <label htmlFor="schedule-full-priority">Priority:</label>
            <select
              id="schedule-full-priority"
              value={schedulePriority}
              onChange={(e) => setSchedulePriority(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {!employee && (
            <div className="toolbar-col">
              <label htmlFor="schedule-full-created">Added By:</label>
              <select
                id="schedule-full-created"
                value={scheduleCreatedBy}
                onChange={(e) => setScheduleCreatedBy(e.target.value)}
              >
                <option value="">All Creators</option>
                <option value="SELF">Self (Nagarsevak)</option>
                <option value="EMPLOYEE">Field Staff</option>
              </select>
            </div>
          )}

          <div className="toolbar-col toolbar-col-search">
            <label htmlFor="schedule-search-input">Search:</label>
            <div className="input-with-clear">
              <input
                id="schedule-search-input"
                type="text"
                placeholder="Title, location, staff name..."
                value={scheduleSearch}
                onChange={(e) => setScheduleSearch(e.target.value)}
              />
              {scheduleSearch && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setScheduleSearch('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {(scheduleDate || scheduleStatus || schedulePriority || scheduleCreatedBy || scheduleSearch || scheduleFilter !== 'today') && (
            <div className="toolbar-col toolbar-col-reset">
              <button
                type="button"
                className="reset-filters-btn"
                onClick={() => {
                  setScheduleFilter('today');
                  setScheduleDate('');
                  setScheduleStatus('');
                  setSchedulePriority('');
                  setScheduleCreatedBy('');
                  setScheduleSearch('');
                }}
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {/* Schedule List */}
        <div className="schedule-items-container">
          {/* Yesterday carry-over alert notice */}
          {scheduleFilter === 'yesterday_remaining' && schedules.length > 0 && (
            <div className="yesterday-carryover-banner">
              <div className="carryover-content">
                <strong>Yesterday's Incomplete Tasks ({schedules.length})</strong>
                <span>These tasks were scheduled for yesterday ({formatScheduleDate(getYesterdayDateStr())}) and remain pending. Mark them done or click "Move to Today" to carry them into today's action plan.</span>
              </div>
            </div>
          )}

          {loading ? (
            <Loading />
          ) : schedules.length === 0 ? (
            <div className="schedule-empty-state">
              <h4>
                {scheduleFilter === 'yesterday_remaining'
                  ? 'No Remaining Work From Yesterday'
                  : scheduleFilter === 'month_remaining'
                  ? 'No Remaining Work For This Month'
                  : scheduleFilter === 'overdue'
                  ? 'No Overdue Remaining Work'
                  : scheduleFilter === 'today'
                  ? "No Schedule Items for Today"
                  : 'No Schedule Items Found'}
              </h4>
              <p>
                {scheduleFilter === 'yesterday_remaining'
                  ? 'All tasks from yesterday have been marked as completed! Excellent job.'
                  : scheduleFilter === 'month_remaining'
                  ? 'All scheduled tasks for this calendar month are cleared!'
                  : scheduleFilter === 'overdue'
                  ? 'There are no overdue pending tasks.'
                  : scheduleFilter === 'today'
                  ? 'Click "+ Add Schedule Item" above to schedule site visits, citizen hearings, or meetings for today.'
                  : 'Try selecting another date or clearing active filters.'}
              </p>
              <button
                type="button"
                className="primary-btn empty-action-btn"
                onClick={openAddScheduleModal}
              >
                + Add Schedule Item
              </button>
            </div>
          ) : (
            <div className="schedule-list">
              {schedules.map((item) => {
                const isCompleted = item.status === 'COMPLETED';
                const catMeta = getCategoryMeta(item.category);
                const priMeta = getPriorityMeta(item.priority);
                const isMarking = scheduleMarkingId === item.id;
                const canEdit =
                  admin ||
                  nagar ||
                  employee ||
                  item.createdByUserId === user.id;

                const isPastOverdue =
                  !isCompleted &&
                  scheduleSummary?.todayStr &&
                  item.scheduledDate < scheduleSummary.todayStr;

                return (
                  <div
                    key={item.id}
                    className={`schedule-card ${isCompleted ? 'card-completed' : ''} ${isPastOverdue ? 'card-overdue' : ''}`}
                  >
                    {/* Checkbox toggle */}
                    <div className="schedule-card-left">
                      <button
                        type="button"
                        className={`schedule-check-toggle ${isCompleted ? 'checked' : ''}`}
                        onClick={() => handleToggleScheduleStatus(item)}
                        disabled={isMarking}
                        title={isCompleted ? 'Mark as Incomplete (Undo)' : 'Mark as Done'}
                      >
                        {isMarking ? (
                          <span className="toggle-spinner"></span>
                        ) : isCompleted ? (
                          <span className="check-icon">✓</span>
                        ) : (
                          <span className="uncheck-icon">○</span>
                        )}
                      </button>
                    </div>

                    {/* Content */}
                    <div className="schedule-card-content">
                      <div className="schedule-card-tags">
                        <span
                          className="priority-badge"
                          style={{ color: priMeta.color, background: priMeta.bg, borderColor: priMeta.border }}
                        >
                          {priMeta.label}
                        </span>

                        <span
                          className="category-badge"
                          style={{ color: catMeta.color, background: catMeta.bg }}
                        >
                          {catMeta.label}
                        </span>

                        {isCompleted ? (
                          <span className="status-badge badge-status-completed">Completed</span>
                        ) : item.status === 'IN_PROGRESS' ? (
                          <span className="status-badge badge-status-inprogress">In Progress</span>
                        ) : isPastOverdue ? (
                          <span className="status-badge badge-status-overdue">Overdue</span>
                        ) : (
                          <span className="status-badge badge-status-pending">Pending</span>
                        )}

                        <span className="date-time-badge">
                          {formatScheduleDate(item.scheduledDate)}
                          {item.scheduledTime ? ` · ${item.scheduledTime}` : ''}
                        </span>
                      </div>

                      <h4 className={`schedule-item-title ${isCompleted ? 'title-completed' : ''}`}>
                        {item.title}
                      </h4>

                      {item.location && (
                        <div className="schedule-item-meta location-meta">
                          <span className="meta-text">{item.location}</span>
                        </div>
                      )}

                      {item.description && (
                        <div className="schedule-item-desc">
                          {item.description}
                        </div>
                      )}

                      <div className="schedule-item-footer">
                        <div className="attribution-line">
                          {item.creator?.role?.name === 'NAGARSEVAK' || item.createdByUserId === item.nagarsevakUserId ? (
                            <span className="attr-self">Self-added by Nagarsevak</span>
                          ) : (
                            <span className="attr-emp">
                              Added by Field Staff: <strong>{item.creator?.name || 'Employee'}</strong>
                            </span>
                          )}
                        </div>

                        {isCompleted && (
                          <div className="completion-info">
                            <span>
                              Done {item.completedAt ? new Date(item.completedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                              {item.completedBy?.name ? ` by ${item.completedBy.name}` : ''}
                            </span>
                            {item.completionNote && (
                              <span className="completion-note">Note: "{item.completionNote}"</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="schedule-card-actions">
                      <button
                        type="button"
                        className={`schedule-btn-toggle ${isCompleted ? 'btn-reopen' : 'btn-done'}`}
                        onClick={() => handleToggleScheduleStatus(item)}
                        disabled={isMarking}
                        title={isCompleted ? 'Mark as Incomplete' : 'Mark as Completed'}
                      >
                        {isCompleted ? 'Reopen' : 'Mark Done'}
                      </button>

                      {/* Quick Move to Today action for past incomplete tasks */}
                      {canEdit && !isCompleted && item.scheduledDate < (scheduleSummary?.todayStr || getTodayDateStr()) && (
                        <button
                          type="button"
                          className="schedule-btn-move"
                          onClick={() => handleMoveToToday(item)}
                          title="Reschedule this task to Today's Agenda"
                        >
                          Move to Today
                        </button>
                      )}

                      {canEdit && (
                        <button
                          type="button"
                          className="schedule-btn-edit"
                          onClick={() => openEditScheduleModal(item)}
                          title="Edit schedule task"
                        >
                          Edit
                        </button>
                      )}

                      {canEdit && (
                        <button
                          type="button"
                          className="schedule-btn-delete"
                          onClick={() => handleDeleteSchedule(item)}
                          title="Delete schedule task"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* PROFESSIONAL ADD / EDIT MODAL */}
      {scheduleModal.isOpen && (
        <Modal
          wide
          title={scheduleModal.mode === 'create' ? 'Add Schedule Item' : 'Edit Scheduled Task'}
          onClose={() => setScheduleModal({ isOpen: false, mode: 'create', item: null })}
        >
          <form onSubmit={handleSaveSchedule} className="schedule-modal-professional">
            {/* Employee Target Alert */}
            {employee && (
              <div className="schedule-emp-banner">
                <div className="banner-text">
                  <strong>Adding to Nagarsevak's Daily Schedule:</strong>{' '}
                  {empManagerInfo?.name || 'Managing Nagarsevak'}
                  <span className="banner-sub">This action plan will be visible on Nagarsevak's dashboard and they will be notified.</span>
                </div>
              </div>
            )}

            {/* Admin Nagarsevak Selection */}
            {admin && corporatorsList.length > 0 && (
              <div className="form-field-group">
                <label htmlFor="modal-sched-nagarsevak">
                  <span className="field-title">Responsible Nagarsevak <span className="req-star">*</span></span>
                  <span className="field-subtitle">Select the corporator whose daily action plan will include this work</span>
                </label>
                <select
                  id="modal-sched-nagarsevak"
                  className="prof-select"
                  required
                  value={scheduleForm.nagarsevakUserId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, nagarsevakUserId: e.target.value })}
                >
                  <option value="">Select Nagarsevak</option>
                  {corporatorsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.ward?.wardNumber ? `(Ward ${c.ward.wardNumber})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Work Title */}
            <div className="form-field-group">
              <label htmlFor="modal-sched-title">
                <span className="field-title">Work Title / Agenda <span className="req-star">*</span></span>
                <span className="field-subtitle">Clear description of work, site visit, or meeting agenda</span>
              </label>
              <input
                id="modal-sched-title"
                className="prof-input"
                type="text"
                required
                placeholder="e.g. Ward 14 Drainage Line Inspection with Junior Engineer"
                value={scheduleForm.title}
                onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
              />
            </div>

            {/* Date and Time Row with Quick Date Chips */}
            <div className="prof-grid-2">
              <div className="form-field-group">
                <div className="field-label-with-chips">
                  <label htmlFor="modal-sched-date">
                    <span className="field-title">Scheduled Date <span className="req-star">*</span></span>
                  </label>
                  <div className="date-quick-chips">
                    <button
                      type="button"
                      className={`quick-chip ${scheduleForm.scheduledDate === getTodayDateStr() ? 'active' : ''}`}
                      onClick={() => setScheduleForm({ ...scheduleForm, scheduledDate: getTodayDateStr() })}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className={`quick-chip ${scheduleForm.scheduledDate === getTomorrowDateStr() ? 'active' : ''}`}
                      onClick={() => setScheduleForm({ ...scheduleForm, scheduledDate: getTomorrowDateStr() })}
                    >
                      Tomorrow
                    </button>
                  </div>
                </div>
                <input
                  id="modal-sched-date"
                  className="prof-input"
                  type="date"
                  required
                  value={scheduleForm.scheduledDate}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledDate: e.target.value })}
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="modal-sched-time">
                  <span className="field-title">Scheduled Time / Slot</span>
                  <span className="field-subtitle">e.g. 10:30 AM, Morning 9:00 AM, Evening 5:00 PM</span>
                </label>
                <input
                  id="modal-sched-time"
                  className="prof-input"
                  type="text"
                  placeholder="e.g. 10:30 AM"
                  value={scheduleForm.scheduledTime}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledTime: e.target.value })}
                />
              </div>
            </div>

            {/* Priority and Location Row */}
            <div className="prof-grid-2">
              <div className="form-field-group">
                <label htmlFor="modal-sched-priority">
                  <span className="field-title">Priority Level <span className="req-star">*</span></span>
                  <span className="field-subtitle">Urgency and importance</span>
                </label>
                <select
                  id="modal-sched-priority"
                  className="prof-select"
                  value={scheduleForm.priority}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, priority: e.target.value })}
                >
                  <option value="MEDIUM">Routine / Medium</option>
                  <option value="HIGH">High Priority</option>
                  <option value="URGENT">Urgent</option>
                  <option value="LOW">Low / Normal</option>
                </select>
              </div>

              <div className="form-field-group">
                <label htmlFor="modal-sched-loc">
                  <span className="field-title">Location / Area / Landmark</span>
                  <span className="field-subtitle">Colony, street, chowk or municipal hall</span>
                </label>
                <input
                  id="modal-sched-loc"
                  className="prof-input"
                  type="text"
                  placeholder="e.g. Shivaji Chowk near Water Tank"
                  value={scheduleForm.location}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                />
              </div>
            </div>

            {/* Discussion Points & Notes */}
            <div className="form-field-group">
              <label htmlFor="modal-sched-desc">
                <span className="field-title">Action Notes & Deliverables (Optional)</span>
                <span className="field-subtitle">Key discussion points, attending officials or citizens, instructions</span>
              </label>
              <textarea
                id="modal-sched-desc"
                className="prof-textarea"
                rows={2}
                placeholder="e.g. Review water pipeline repair progress with Junior Engineer, note citizen concerns..."
                value={scheduleForm.description}
                onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
              />
            </div>

            {/* Actions */}
            <div className="prof-modal-actions">
              <button
                type="button"
                className="ghost-btn prof-btn-cancel"
                onClick={() => setScheduleModal({ isOpen: false, mode: 'create', item: null })}
                disabled={scheduleSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-btn prof-btn-submit"
                disabled={scheduleSaving}
              >
                {scheduleSaving ? 'Saving…' : scheduleModal.mode === 'create' ? 'Save Schedule' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* PDF EXPORT SELECTION MODAL */}
      {pdfModalOpen && (
        <Modal
          wide
          title="Export Schedule PDF Report"
          onClose={() => !pdfExporting && setPdfModalOpen(false)}
        >
          <div className="pdf-modal-container">
            <div className="pdf-modal-header-desc">
              <p>
                Generate an official, print-ready PDF schedule report for the Nagarsevak and field staff. You can multi-select multiple periods (e.g. combine Today's Agenda and Yesterday's Pending Tasks) into a single unified report.
              </p>
            </div>

            {/* STEP 1: CHOOSE SCHEDULE REPORTS (MULTI-SELECT) */}
            <div className="pdf-modal-section">
              <label className="pdf-section-label">
                <span className="pdf-label-number">1</span>
                <span className="pdf-label-text">Select Schedule Reports to Include (Multi-Select)</span>
              </label>

              {/* 1-Click Preset Combinations */}
              <div className="pdf-presets-bar">
                <span className="presets-label">Quick Presets:</span>
                <button
                  type="button"
                  className={`pdf-preset-pill featured-preset ${
                    pdfReportTypes.length === 2 &&
                    pdfReportTypes.includes('today') &&
                    pdfReportTypes.includes('yesterday_remaining')
                      ? 'active-preset'
                      : ''
                  }`}
                  onClick={() => setPdfReportTypes(['today', 'yesterday_remaining'])}
                  title="Combine Today's Agenda with Yesterday's Incomplete Tasks"
                >
                  Today + Yesterday's Pending
                </button>
                <button
                  type="button"
                  className={`pdf-preset-pill ${
                    pdfReportTypes.length === 1 && pdfReportTypes.includes('today') ? 'active-preset' : ''
                  }`}
                  onClick={() => setPdfReportTypes(['today'])}
                >
                  Today's Plan
                </button>
                <button
                  type="button"
                  className={`pdf-preset-pill ${
                    pdfReportTypes.length === 1 && pdfReportTypes.includes('yesterday_remaining') ? 'active-preset' : ''
                  }`}
                  onClick={() => setPdfReportTypes(['yesterday_remaining'])}
                >
                  Yesterday's Pending
                </button>
                <button
                  type="button"
                  className={`pdf-preset-pill ${
                    pdfReportTypes.length === 1 && pdfReportTypes.includes('week') ? 'active-preset' : ''
                  }`}
                  onClick={() => setPdfReportTypes(['week'])}
                >
                  This Week
                </button>
                <button
                  type="button"
                  className={`pdf-preset-pill ${
                    pdfReportTypes.length === 1 && pdfReportTypes.includes('last_week') ? 'active-preset' : ''
                  }`}
                  onClick={() => setPdfReportTypes(['last_week'])}
                >
                  Last Week Review
                </button>
                <button
                  type="button"
                  className={`pdf-preset-pill ${pdfReportTypes.length === 4 ? 'active-preset' : ''}`}
                  onClick={() => setPdfReportTypes(['today', 'yesterday_remaining', 'week', 'last_week'])}
                >
                  Select All 4
                </button>
              </div>

              {/* The 4 Essential Report Cards */}
              <div className="pdf-report-cards-grid">
                {/* 1. Today's Action Plan */}
                <div
                  className={`pdf-report-card ${pdfReportTypes.includes('today') ? 'selected' : ''}`}
                  onClick={() => togglePdfReportType('today')}
                >
                  <div className="report-card-top">
                    <div className="report-card-checkbox-wrap">
                      <div className="report-card-checkbox">
                        {pdfReportTypes.includes('today') ? '✓' : ''}
                      </div>
                      <span className="report-card-kicker">DAILY AGENDA</span>
                    </div>
                    <span className="report-card-badge">{scheduleSummary?.todayTotal ?? 0} tasks</span>
                  </div>
                  <h4 className="report-card-title">Today's Action Plan</h4>
                  <p className="report-card-desc">Scheduled site visits, official meetings, and citizen hearings for today.</p>
                </div>

                {/* 2. Yesterday's Pending */}
                <div
                  className={`pdf-report-card ${pdfReportTypes.includes('yesterday_remaining') ? 'selected' : ''}`}
                  onClick={() => togglePdfReportType('yesterday_remaining')}
                >
                  <div className="report-card-top">
                    <div className="report-card-checkbox-wrap">
                      <div className="report-card-checkbox">
                        {pdfReportTypes.includes('yesterday_remaining') ? '✓' : ''}
                      </div>
                      <span className="report-card-kicker">PENDING FOLLOW-UP</span>
                    </div>
                    <span
                      className={`report-card-badge ${
                        Number(scheduleSummary?.yesterdayRemaining || 0) > 0 ? 'badge-alert' : 'badge-clear'
                      }`}
                    >
                      {scheduleSummary?.yesterdayRemaining ?? 0} pending
                    </span>
                  </div>
                  <h4 className="report-card-title">Yesterday's Pending Tasks</h4>
                  <p className="report-card-desc">Tasks scheduled for yesterday that remained incomplete and need urgent follow-up.</p>
                </div>

                {/* 3. This Week's Plan */}
                <div
                  className={`pdf-report-card ${pdfReportTypes.includes('week') ? 'selected' : ''}`}
                  onClick={() => togglePdfReportType('week')}
                >
                  <div className="report-card-top">
                    <div className="report-card-checkbox-wrap">
                      <div className="report-card-checkbox">
                        {pdfReportTypes.includes('week') ? '✓' : ''}
                      </div>
                      <span className="report-card-kicker">WEEKLY PLAN</span>
                    </div>
                    <span className="report-card-badge">{scheduleSummary?.weekTotal ?? 0} tasks</span>
                  </div>
                  <h4 className="report-card-title">This Week's Action Plan</h4>
                  <p className="report-card-desc">Full municipal schedule and site inspections from Monday to Sunday for the ward.</p>
                </div>

                {/* 4. Last Week's Review */}
                <div
                  className={`pdf-report-card ${pdfReportTypes.includes('last_week') ? 'selected' : ''}`}
                  onClick={() => togglePdfReportType('last_week')}
                >
                  <div className="report-card-top">
                    <div className="report-card-checkbox-wrap">
                      <div className="report-card-checkbox">
                        {pdfReportTypes.includes('last_week') ? '✓' : ''}
                      </div>
                      <span className="report-card-kicker">PAST REVIEW</span>
                    </div>
                    <span className="report-card-badge">{scheduleSummary?.lastWeekTotal ?? 0} tasks</span>
                  </div>
                  <h4 className="report-card-title">Last Week's Work Review</h4>
                  <p className="report-card-desc">Comprehensive review of what municipal work was carried out and completed last week.</p>
                </div>
              </div>

              {/* Selection Summary Indicator */}
              <div className={`pdf-selection-summary ${pdfReportTypes.length > 1 ? 'multiple-selected' : ''}`}>
                <div className="summary-check-icon">✓</div>
                <div className="summary-content">
                  <div className="summary-title">
                    <strong>Selected ({pdfReportTypes.length} of 4):</strong>{' '}
                    {pdfReportTypes
                      .map((t) =>
                        t === 'today'
                          ? "Today's Action Plan"
                          : t === 'yesterday_remaining'
                          ? "Yesterday's Pending Tasks"
                          : t === 'week'
                          ? "This Week's Plan"
                          : "Last Week's Review"
                      )
                      .join(' + ')}
                  </div>
                  <div className="summary-hint">
                    {pdfReportTypes.length > 1
                      ? 'All tasks from these periods will be merged and organized chronologically in 1 combined PDF.'
                      : 'Exporting tasks for this selected period in 1 official PDF.'}
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 2: SELECT STATUS FILTER */}
            <div className="pdf-modal-section">
              <label className="pdf-section-label">
                <span className="pdf-label-number">2</span>
                <span className="pdf-label-text">Filter by Task Status</span>
              </label>

              <div className="pdf-status-pills">
                <button
                  type="button"
                  className={`pdf-status-pill ${pdfStatusFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setPdfStatusFilter('ALL')}
                >
                  All Tasks (Both Completed & Pending)
                </button>
                <button
                  type="button"
                  className={`pdf-status-pill ${pdfStatusFilter === 'COMPLETED' ? 'active' : ''}`}
                  onClick={() => setPdfStatusFilter('COMPLETED')}
                >
                  Completed Work Only
                </button>
                <button
                  type="button"
                  className={`pdf-status-pill ${pdfStatusFilter === 'INCOMPLETE' ? 'active' : ''}`}
                  onClick={() => setPdfStatusFilter('INCOMPLETE')}
                >
                  Pending Tasks Only
                </button>
              </div>
            </div>

            {/* STEP 3: REPORT DETAIL LEVEL / STYLE */}
            <div className="pdf-modal-section">
              <label className="pdf-section-label">
                <span className="pdf-label-number">3</span>
                <span className="pdf-label-text">Choose Report Detail Level (Format)</span>
              </label>

              <div className="pdf-style-cards-grid">
                {/* Executive Summary */}
                <div
                  className={`pdf-style-card ${pdfReportStyle === 'standard' ? 'selected' : ''}`}
                  onClick={() => handleSelectReportStyle('standard')}
                >
                  <div className="style-card-header">
                    <span className="style-badge-tag">Recommended</span>
                    <input
                      type="radio"
                      name="pdfReportStyle"
                      checked={pdfReportStyle === 'standard'}
                      onChange={() => handleSelectReportStyle('standard')}
                    />
                  </div>
                  <h4 className="style-card-title">Executive Summary Report</h4>
                  <p className="style-card-desc">
                    Clean, concise single-page layout: Date, Time, Work Title, Location, Priority & Status. Best for ward meetings and printing.
                  </p>
                </div>

                {/* Comprehensive Detailed */}
                <div
                  className={`pdf-style-card ${pdfReportStyle === 'detailed' ? 'selected' : ''}`}
                  onClick={() => handleSelectReportStyle('detailed')}
                >
                  <div className="style-card-header">
                    <span className="style-badge-tag tag-detailed">Comprehensive</span>
                    <input
                      type="radio"
                      name="pdfReportStyle"
                      checked={pdfReportStyle === 'detailed'}
                      onChange={() => handleSelectReportStyle('detailed')}
                    />
                  </div>
                  <h4 className="style-card-title">Comprehensive Detailed Report</h4>
                  <p className="style-card-desc">
                    Includes full Action Notes, Nature of Work, Added By staff name, and Completion timestamps/notes. Best for official documentation.
                  </p>
                </div>
              </div>

              {/* COLLAPSIBLE ADVANCED CUSTOMIZATION DRAWER */}
              <div className="pdf-advanced-collapsible-wrap">
                <button
                  type="button"
                  className="pdf-toggle-advanced-btn"
                  onClick={() => setShowAdvancedPdfOptions((prev) => !prev)}
                >
                  <span>{showAdvancedPdfOptions ? 'Hide Column & Layout Customization ▲' : 'Customize Columns & Page Layout (Optional) ▼'}</span>
                  <span className="toggle-btn-sub">
                    {showAdvancedPdfOptions ? 'Collapse settings' : `${Object.values(pdfColumns).filter(Boolean).length} columns · ${pdfOrientation === 'landscape' ? 'Landscape' : 'Portrait'}`}
                  </span>
                </button>

                {showAdvancedPdfOptions && (
                  <div className="pdf-advanced-drawer">
                    <div className="drawer-subheading">
                      <span>Select Table Columns to Include:</span>
                      <div className="pdf-col-presets">
                        <button type="button" className="pdf-preset-btn" onClick={handleSelectAllColumns}>
                          All
                        </button>
                        <button type="button" className="pdf-preset-btn" onClick={handleSelectStandardColumns}>
                          Standard
                        </button>
                        <button type="button" className="pdf-preset-btn" onClick={handleSelectMinimalColumns}>
                          Compact
                        </button>
                      </div>
                    </div>

                    <div className="pdf-columns-grid">
                      <label className={`pdf-column-checkbox-card ${pdfColumns.date ? 'checked' : ''}`}>
                        <input type="checkbox" checked={!!pdfColumns.date} onChange={() => togglePdfColumn('date')} />
                        <div className="col-info">
                          <span className="col-title">Date</span>
                          <span className="col-desc">Scheduled date</span>
                        </div>
                      </label>

                      <label className={`pdf-column-checkbox-card ${pdfColumns.time ? 'checked' : ''}`}>
                        <input type="checkbox" checked={!!pdfColumns.time} onChange={() => togglePdfColumn('time')} />
                        <div className="col-info">
                          <span className="col-title">Time / Slot</span>
                          <span className="col-desc">Appointment time</span>
                        </div>
                      </label>

                      <label className={`pdf-column-checkbox-card ${pdfColumns.title ? 'checked' : ''}`}>
                        <input type="checkbox" checked={!!pdfColumns.title} onChange={() => togglePdfColumn('title')} />
                        <div className="col-info">
                          <span className="col-title">Work Title</span>
                          <span className="col-desc">Subject & agenda</span>
                        </div>
                      </label>

                      <label className={`pdf-column-checkbox-card ${pdfColumns.notes ? 'checked' : ''}`}>
                        <input type="checkbox" checked={!!pdfColumns.notes} onChange={() => togglePdfColumn('notes')} />
                        <div className="col-info">
                          <span className="col-title">Action Notes</span>
                          <span className="col-desc">Remarks & notes</span>
                        </div>
                      </label>

                      <label className={`pdf-column-checkbox-card ${pdfColumns.location ? 'checked' : ''}`}>
                        <input type="checkbox" checked={!!pdfColumns.location} onChange={() => togglePdfColumn('location')} />
                        <div className="col-info">
                          <span className="col-title">Location</span>
                          <span className="col-desc">Area & landmark</span>
                        </div>
                      </label>

                      <label className={`pdf-column-checkbox-card ${pdfColumns.category ? 'checked' : ''}`}>
                        <input type="checkbox" checked={!!pdfColumns.category} onChange={() => togglePdfColumn('category')} />
                        <div className="col-info">
                          <span className="col-title">Nature of Work</span>
                          <span className="col-desc">Visit, meeting, etc.</span>
                        </div>
                      </label>

                      <label className={`pdf-column-checkbox-card ${pdfColumns.priority ? 'checked' : ''}`}>
                        <input type="checkbox" checked={!!pdfColumns.priority} onChange={() => togglePdfColumn('priority')} />
                        <div className="col-info">
                          <span className="col-title">Priority</span>
                          <span className="col-desc">Urgent, high, medium</span>
                        </div>
                      </label>

                      <label className={`pdf-column-checkbox-card ${pdfColumns.status ? 'checked' : ''}`}>
                        <input type="checkbox" checked={!!pdfColumns.status} onChange={() => togglePdfColumn('status')} />
                        <div className="col-info">
                          <span className="col-title">Status</span>
                          <span className="col-desc">Completed or pending</span>
                        </div>
                      </label>

                      <label className={`pdf-column-checkbox-card ${pdfColumns.creator ? 'checked' : ''}`}>
                        <input type="checkbox" checked={!!pdfColumns.creator} onChange={() => togglePdfColumn('creator')} />
                        <div className="col-info">
                          <span className="col-title">Added By</span>
                          <span className="col-desc">Self or staff name</span>
                        </div>
                      </label>

                      <label className={`pdf-column-checkbox-card ${pdfColumns.completion ? 'checked' : ''}`}>
                        <input type="checkbox" checked={!!pdfColumns.completion} onChange={() => togglePdfColumn('completion')} />
                        <div className="col-info">
                          <span className="col-title">Completion</span>
                          <span className="col-desc">Done time & notes</span>
                        </div>
                      </label>
                    </div>

                    <div className="pdf-layout-options-grid" style={{ marginTop: '14px' }}>
                      <div className="pdf-layout-box">
                        <span className="layout-box-label">Page Orientation:</span>
                        <div className="pdf-orientation-pills">
                          <button
                            type="button"
                            className={`pdf-orient-btn ${pdfOrientation === 'landscape' ? 'active' : ''}`}
                            onClick={() => setPdfOrientation('landscape')}
                          >
                            Landscape (Wide Table)
                          </button>
                          <button
                            type="button"
                            className={`pdf-orient-btn ${pdfOrientation === 'portrait' ? 'active' : ''}`}
                            onClick={() => setPdfOrientation('portrait')}
                          >
                            Portrait (Vertical)
                          </button>
                        </div>
                      </div>

                      <div className="pdf-layout-box">
                        <span className="layout-box-label">KPI Summary Header:</span>
                        <label className="pdf-checkbox-inline">
                          <input
                            type="checkbox"
                            checked={pdfIncludeStats}
                            onChange={(e) => setPdfIncludeStats(e.target.checked)}
                          />
                          <span>Include Total, Done, Pending & Completion % summary box</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Explanatory Notice & Live Summary Strip */}
            <div className="pdf-active-summary-strip">
              <div className="summary-strip-item">
                <span className="strip-label">Report Period:</span>
                <strong className="strip-val">
                  {pdfReportTypes
                    .map((t) =>
                      t === 'today'
                        ? "Today's Action Plan"
                        : t === 'yesterday_remaining'
                        ? "Yesterday's Pending"
                        : t === 'week'
                        ? "This Week's Plan"
                        : "Last Week's Review"
                    )
                    .join(' + ') || 'None selected'}{' '}
                  ({pdfReportTypes.length} period{pdfReportTypes.length !== 1 ? 's' : ''})
                </strong>
              </div>
              <div className="summary-strip-item">
                <span className="strip-label">Status Filter:</span>
                <strong className="strip-val">
                  {pdfStatusFilter === 'ALL'
                    ? 'All Tasks'
                    : pdfStatusFilter === 'COMPLETED'
                    ? 'Completed Only'
                    : 'Pending Only'}
                </strong>
              </div>
              <div className="summary-strip-item">
                <span className="strip-label">Format:</span>
                <strong className="strip-val">
                  {pdfReportStyle === 'standard'
                    ? 'Executive Summary'
                    : pdfReportStyle === 'detailed'
                    ? 'Detailed Report'
                    : 'Custom Columns'}{' '}
                  ({Object.values(pdfColumns).filter(Boolean).length} fields · {pdfOrientation === 'landscape' ? 'Landscape' : 'Portrait'})
                </strong>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="prof-modal-actions pdf-modal-footer">
              <button
                type="button"
                className="ghost-btn prof-btn-cancel"
                onClick={() => setPdfModalOpen(false)}
                disabled={pdfExporting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn prof-btn-submit"
                onClick={handleExecutePdfExport}
                disabled={pdfExporting || pdfReportTypes.length === 0}
              >
                {pdfExporting ? 'Generating Combined PDF…' : `Download Combined PDF (${pdfReportTypes.length})`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
