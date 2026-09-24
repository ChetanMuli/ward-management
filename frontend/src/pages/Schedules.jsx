import React, { useEffect, useState, useCallback } from 'react';
import { api, getUser } from '../services/api';
import { PageHeader, ErrorBox, Loading, Modal, SearchableSelect, PaginationBar, RowMenu } from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { isMaster, isSubMaster, isNagarsevak, isEmployee } from '../rbac';
import { useWardFilter } from '../wardFilter';
import { exportScheduleToPdf } from '../schedulePdf';

const CATEGORIES = [
  { key: 'VISIT', label: 'Site visit' },
  { key: 'MEETING', label: 'Meeting' },
  { key: 'INSPECTION', label: 'Inspection' },
  { key: 'EVENT', label: 'Event' },
  { key: 'CITIZEN_HEARING', label: 'Citizen hearing' },
  { key: 'OTHER', label: 'Other' },
];

const PRIORITIES = [
  { key: 'URGENT', label: 'Urgent' },
  { key: 'HIGH', label: 'High' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'LOW', label: 'Low' },
];

const PRIMARY_TABS = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'day_after', label: 'Day after' },
  { key: 'yesterday_remaining', label: 'Yesterday pending' },
];

const MORE_PERIODS = [
  { key: 'yesterday', label: 'Yesterday — full' },
  { key: 'week', label: 'This week' },
  { key: 'next_week', label: 'Upcoming week' },
  { key: 'last_week', label: 'Last week' },
  { key: 'month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'all', label: 'All dates' },
];

const PDF_OPTIONS = [
  { key: 'today', label: "Today's schedule" },
  { key: 'tomorrow', label: "Tomorrow's schedule" },
  { key: 'day_after', label: 'Day after tomorrow' },
  { key: 'yesterday', label: 'Yesterday — full' },
  { key: 'yesterday_remaining', label: 'Yesterday — remaining' },
  { key: 'week', label: 'This week' },
  { key: 'next_week', label: 'Upcoming week' },
  { key: 'last_week', label: 'Last week — full' },
  { key: 'last_week_remaining', label: 'Last week — remaining' },
  { key: 'month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'overdue', label: 'Overdue pending' },
];

const emptyForm = {
  title: '',
  scheduledDate: '',
  scheduledTime: '',
  location: '',
  category: 'VISIT',
  priority: 'MEDIUM',
  description: '',
  nagarsevakUserId: '',
  assignTo: 'NAGARSEVAK',
  assignedEmployeeUserId: '',
};

function assigneeLabel(item) {
  if (item?.assignedEmployee?.name) return `Assigned to employee: ${item.assignedEmployee.name}`;
  return item?.nagarsevak?.name ? `Assigned to Nagarsevak: ${item.nagarsevak.name}` : 'Assigned to Nagarsevak';
}

function kolkataDate(offsetDays = 0) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
}

function formatScheduleDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('-');
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function toast(type, message) {
  window.dispatchEvent(new CustomEvent('ward:toast', { detail: { type, message } }));
}

export default function Schedules() {
  const user = getUser();
  const master = isMaster(user);
  const subMaster = isSubMaster(user);
  const nagar = isNagarsevak(user);
  const employee = isEmployee(user);
  const admin = master || subMaster;
  const { selectedWardId: selected } = useWardFilter();

  const [schedules, setSchedules] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('today');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedNagarId, setSelectedNagarId] = useState('');
  const [corporators, setCorporators] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [empManager, setEmpManager] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [modal, setModal] = useState({ open: false, mode: 'create', item: null });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfType, setPdfType] = useState('today');
  const [pdfStatus, setPdfStatus] = useState('ALL');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [assignModal, setAssignModal] = useState({ open: false, item: null, assignTo: 'EMPLOYEE', assignedEmployeeUserId: '' });
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (employee) {
      api.myWard()
        .then((r) => { if (r?.data?.nagarsevak) setEmpManager(r.data.nagarsevak); })
        .catch(() => {});
    }
  }, [employee]);

  useEffect(() => {
    if (admin) {
      api.corporators(selected ? { wardId: selected } : {})
        .then((r) => setCorporators(r?.data || []))
        .catch(() => {});
    }
  }, [admin, selected]);

  useEffect(() => {
    const nagarRow = corporators.find((c) => String(c.id) === String(selectedNagarId)) || corporators[0];
    const wardId = selected || nagarRow?.wardId || user?.wardId;
    if (!wardId) {
      setEmployees([]);
      return;
    }
    api.wardTeam(wardId)
      .then((r) => {
        const mapped = (r?.data?.employees || []).map((e) => ({
          id: e.id,
          name: e.name,
          managerUserId: e.employeeProfile?.managerUserId,
        }));
        const managerId = nagar ? user.id : (selectedNagarId || nagarRow?.id);
        setEmployees(
          managerId
            ? mapped.filter((e) => !e.managerUserId || String(e.managerUserId) === String(managerId))
            : mapped
        );
      })
      .catch(() => setEmployees([]));
  }, [selected, nagar, user?.id, user?.wardId, selectedNagarId, corporators]);

  useEffect(() => {
    setPage(1);
  }, [selected, selectedNagarId, filter, search, limit]);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.schedules({
        wardId: selected || undefined,
        nagarsevakUserId: admin && selectedNagarId ? selectedNagarId : undefined,
        filterPreset: filter,
        search: search.trim() || undefined,
        page,
        limit,
      });
      setSchedules(res?.data || []);
      if (res?.meta?.summary) setSummary(res.meta.summary);
      setMeta({
        total: res?.meta?.total || 0,
        page: res?.meta?.page || page,
        pages: res?.meta?.pages || 1,
        limit: res?.meta?.limit || limit,
      });
    } catch (err) {
      setError(err.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [selected, selectedNagarId, filter, search, admin, page, limit]);

  useEffect(() => {
    const t = setTimeout(loadSchedules, search ? 280 : 0);
    return () => clearTimeout(t);
  }, [loadSchedules, search]);

  const tabCount = (key) => {
    if (!summary) return 0;
    return ({
      today: summary.todayTotal,
      tomorrow: summary.tomorrowTotal,
      day_after: summary.dayAfterTotal,
      yesterday_remaining: summary.yesterdayRemaining,
      yesterday: summary.yesterdayTotal,
      week: summary.weekTotal,
      next_week: summary.nextWeekTotal,
      last_week: summary.lastWeekTotal,
      month: summary.monthTotal,
      last_month: summary.lastMonthTotal,
      overdue: summary.overdueRemaining,
    })[key] ?? 0;
  };

  const defaultNagarId = () => {
    if (nagar) return user.id;
    if (employee) return empManager?.id || user?.employeeProfile?.managerUserId || '';
    return selectedNagarId || (corporators[0]?.id || '');
  };

  const loadEmployeesForNagarsevak = (id) => {
    const row = corporators.find((c) => c.id === id);
    if (!row?.wardId) return;
    api.wardTeam(row.wardId).then((r) => {
      setEmployees((r?.data?.employees || []).map((emp) => ({
        id: emp.id,
        name: emp.name,
        managerUserId: emp.employeeProfile?.managerUserId,
      })).filter((emp) => !emp.managerUserId || String(emp.managerUserId) === String(id)));
    }).catch(() => {});
  };

  const openAdd = () => {
    const dateMap = { tomorrow: 1, day_after: 2, yesterday: -1, yesterday_remaining: -1 };
    setForm({
      ...emptyForm,
      scheduledDate: kolkataDate(dateMap[filter] ?? 0),
      nagarsevakUserId: defaultNagarId(),
      assignTo: employee ? 'NAGARSEVAK' : (employees.length ? 'EMPLOYEE' : 'NAGARSEVAK'),
    });
    setModal({ open: true, mode: 'create', item: null });
  };

  const openEdit = (item) => {
    setForm({
      title: item.title || '',
      scheduledDate: item.scheduledDate || '',
      scheduledTime: item.scheduledTime || '',
      location: item.location || '',
      category: item.category || 'VISIT',
      priority: item.priority || 'MEDIUM',
      description: item.description || '',
      nagarsevakUserId: item.nagarsevakUserId || '',
      assignTo: item.assignedEmployeeUserId ? 'EMPLOYEE' : 'NAGARSEVAK',
      assignedEmployeeUserId: item.assignedEmployeeUserId || '',
    });
    setModal({ open: true, mode: 'edit', item });
  };

  const save = async (e) => {
    e?.preventDefault();
    if (!form.title.trim()) return toast('error', 'Work title is required.');
    if (!form.scheduledDate) return toast('error', 'Date is required.');
    if (admin && modal.mode === 'create' && !form.nagarsevakUserId) {
      return toast('error', 'Select a Nagarsevak before adding work.');
    }
    if (form.assignTo === 'EMPLOYEE' && !form.assignedEmployeeUserId) {
      return toast('error', 'Select an employee, or assign this work to Nagarsevak.');
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        scheduledDate: form.scheduledDate,
        scheduledTime: form.scheduledTime.trim() || undefined,
        location: form.location.trim() || undefined,
        category: form.category,
        priority: form.priority,
        description: form.description.trim() || undefined,
        nagarsevakUserId: employee ? (empManager?.id || form.nagarsevakUserId || undefined) : (form.nagarsevakUserId || undefined),
        assignTo: form.assignTo || 'NAGARSEVAK',
        assignedEmployeeUserId: form.assignTo === 'EMPLOYEE' ? (form.assignedEmployeeUserId || null) : null,
        wardId: selected || undefined,
      };
      if (modal.mode === 'create') await api.createSchedule(payload);
      else await api.updateSchedule(modal.item.id, payload);
      setModal({ open: false, mode: 'create', item: null });
      loadSchedules();
    } catch (err) {
      toast('error', err.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (item) => {
    const newStatus = item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    setMarkingId(item.id);
    try {
      const res = await api.updateScheduleStatus(item.id, { status: newStatus });
      setSchedules((prev) => prev.map((s) => (s.id === item.id ? (res?.data || { ...s, status: newStatus }) : s)));
      loadSchedules();
    } catch (err) {
      toast('error', err.message || 'Could not update status');
    } finally {
      setMarkingId(null);
    }
  };

  const removeItem = async (item) => {
    if (!window.confirm(`Move "${item.title}" to recycle bin?`)) return;
    try {
      await api.deleteSchedule(item.id);
      loadSchedules();
    } catch (err) {
      toast('error', err.message || 'Failed to delete');
    }
  };

  const openAssign = (item) => {
    if (item.wardId) {
      api.wardTeam(item.wardId)
        .then((r) => {
          setEmployees((r?.data?.employees || []).map((emp) => ({
            id: emp.id,
            name: emp.name,
            managerUserId: emp.employeeProfile?.managerUserId,
          })));
        })
        .catch(() => {});
    }
    setAssignModal({
      open: true,
      item,
      assignTo: item.assignedEmployeeUserId ? 'EMPLOYEE' : (employees.length ? 'EMPLOYEE' : 'NAGARSEVAK'),
      assignedEmployeeUserId: item.assignedEmployeeUserId || '',
    });
  };

  const saveAssign = async (e) => {
    e?.preventDefault();
    if (!assignModal.item) return;
    if (assignModal.assignTo === 'EMPLOYEE' && !assignModal.assignedEmployeeUserId) {
      return toast('error', 'Select an employee to move this work.');
    }
    setAssigning(true);
    try {
      await api.assignSchedule(assignModal.item.id, {
        assignTo: assignModal.assignTo,
        assignedEmployeeUserId: assignModal.assignTo === 'EMPLOYEE' ? assignModal.assignedEmployeeUserId : null,
      });
      setAssignModal({ open: false, item: null, assignTo: 'EMPLOYEE', assignedEmployeeUserId: '' });
      loadSchedules();
    } catch (err) {
      toast('error', err.message || 'Could not reassign work');
    } finally {
      setAssigning(false);
    }
  };

  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      const res = await api.schedules({
        wardId: selected || undefined,
        nagarsevakUserId: admin && selectedNagarId ? selectedNagarId : undefined,
        filterPreset: pdfType,
        status: pdfStatus !== 'ALL' ? pdfStatus : undefined,
        limit: 200,
      });
      const opt = PDF_OPTIONS.find((o) => o.key === pdfType);
      exportScheduleToPdf(res?.data || [], {
        title: 'Daily Schedule Report',
        scope: selected ? 'Selected ward' : 'All wards',
        filterLabel: `${opt?.label || pdfType}${pdfStatus === 'COMPLETED' ? ' · completed' : pdfStatus === 'INCOMPLETE' ? ' · remaining' : ''}`,
        nagarName: nagar ? user.name : (admin && selectedNagarId ? corporators.find((c) => c.id === selectedNagarId)?.name : empManager?.name || ''),
        periodType: pdfType,
      });
      setPdfOpen(false);
    } catch (err) {
      toast('error', err.message || 'PDF export failed');
    } finally {
      setPdfBusy(false);
    }
  };

  const canEdit = nagar || employee || admin;
  const moreActive = MORE_PERIODS.some((p) => p.key === filter);
  const nagarOptions = [
    { value: '', label: 'All Nagarsevaks', title: 'All Nagarsevaks', hint: 'Every corporator in this scope' },
    ...corporators.map((c) => ({ value: c.id, label: c.name, title: c.name, hint: c.ward?.name ? `Ward ${c.ward.wardNumber || ''} · ${c.ward.name}` : 'Nagarsevak' })),
  ];

  return (
    <div className="schedules-page">
      <PageHeader
        kicker="Daily work"
        title="Daily Schedule"
        subtitle="Nagarsevak and employees can assign work to each other. After 60 days, items move to Recycle bin."
        action={
          <div className="sched-head-actions">
            <button type="button" className="ghost-btn" onClick={() => { setPdfType(filter === 'all' ? 'today' : filter); setPdfOpen(true); }}>Export PDF</button>
            <button type="button" className="primary-btn" onClick={openAdd}>+ Add work</button>
          </div>
        }
      />
      <ErrorBox error={error} />

      {admin && (
        <section className="panel sched-scope">
          <WardFilter label="Ward" />
          <SearchableSelect
            label="Nagarsevak"
            value={selectedNagarId}
            onChange={setSelectedNagarId}
            options={nagarOptions}
            placeholder="All Nagarsevaks"
            searchPlaceholder="Search Nagarsevak…"
          />
        </section>
      )}

      <section className="panel sched-board">
        <div className="sched-stats">
          <div className="sched-stat"><strong>{summary?.todayTotal ?? 0}</strong><span>Today</span></div>
          <div className="sched-stat is-done"><strong>{summary?.todayCompleted ?? 0}</strong><span>Done</span></div>
          <div className="sched-stat is-pending"><strong>{summary?.todayPending ?? 0}</strong><span>Pending</span></div>
          {employee
            ? <div className="sched-stat is-assign"><strong>{summary?.assignedToMe ?? 0}</strong><span>Assigned to me</span></div>
            : <div className="sched-stat is-overdue"><strong>{summary?.overdueRemaining ?? 0}</strong><span>Overdue</span></div>}
        </div>

        <div className="sched-period-row">
          <div className="sched-tabs" role="tablist">
            {PRIMARY_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`sched-tab ${filter === tab.key ? 'is-active' : ''}`}
                onClick={() => setFilter(tab.key)}
              >
                <span>{tab.label}</span>
                <em className={tab.key === 'yesterday_remaining' && tabCount(tab.key) > 0 ? 'is-alert' : ''}>{tabCount(tab.key)}</em>
              </button>
            ))}
          </div>
          <SearchableSelect
            className={`sched-more-period ${moreActive ? 'is-selected' : ''}`}
            label=""
            value={moreActive ? filter : ''}
            onChange={(v) => setFilter(v || 'today')}
            options={MORE_PERIODS.map((p) => ({ value: p.key, label: `${p.label} (${tabCount(p.key)})`, title: p.label, hint: `${tabCount(p.key)} items` }))}
            placeholder="More periods"
            searchPlaceholder="Search period…"
          />
        </div>

        <div className="sched-search-wrap">
          <input
            type="search"
            className="sched-search"
            placeholder="Search work, place or notes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="sched-list-wrap">
          {loading ? (
            <Loading label="Loading schedule…" />
          ) : schedules.length === 0 ? (
            <div className="schedule-empty-state">
              <h4>No work in this view</h4>
              <p>Add a visit, meeting or assigned task for the selected period.</p>
              <button type="button" className="primary-btn" onClick={openAdd}>+ Add work</button>
            </div>
          ) : (
            <div className="sched-list">
              {schedules.map((item) => {
                const done = item.status === 'COMPLETED';
                const overdue = !done && summary?.todayStr && item.scheduledDate < summary.todayStr;
                return (
                  <article key={item.id} className={`sched-card ${done ? 'is-done' : ''} ${overdue ? 'is-overdue' : ''}`}>
                    <div className="sched-card-main">
                      <button
                        type="button"
                        className={`sched-tick ${done ? 'is-checked' : ''}`}
                        onClick={() => toggleDone(item)}
                        disabled={markingId === item.id}
                        aria-label={done ? 'Mark pending' : 'Mark done'}
                      >
                        {done ? '✓' : ''}
                      </button>
                      <div className="sched-card-body">
                        <div className="sched-tags">
                          <span className={`tag-pri pri-${item.priority}`}>{item.priority}</span>
                          <span className="tag-cat">{CATEGORIES.find((c) => c.key === item.category)?.label || item.category}</span>
                          <span className={`tag-st ${done ? 'st-done' : overdue ? 'st-over' : 'st-pend'}`}>{done ? 'Completed' : overdue ? 'Overdue' : 'Pending'}</span>
                          <span className="tag-date">{formatScheduleDate(item.scheduledDate)}{item.scheduledTime ? ` · ${item.scheduledTime}` : ''}</span>
                        </div>
                        <h4 className={done ? 'is-strike' : ''}>{item.title}</h4>
                        {item.location ? <p className="sched-loc">{item.location}</p> : null}
                        {item.description ? <p className="sched-notes">{item.description}</p> : null}
                        <p className="sched-meta">
                          {assigneeLabel(item)}
                          {item.creator?.name ? ` · Added by ${item.creator.name}` : ''}
                          {done && item.completedBy?.name ? ` · Done by ${item.completedBy.name}` : ''}
                        </p>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="sched-card-actions">
                        <RowMenu
                          items={[
                            {
                              label: done ? 'Reopen' : 'Mark done',
                              className: `small-btn ${done ? 'ghost-btn' : 'view-btn'}`,
                              onClick: () => toggleDone(item),
                            },
                            !done && summary?.todayStr && item.scheduledDate < summary.todayStr && {
                              label: 'Move to today',
                              onClick: async () => {
                                try {
                                  await api.updateSchedule(item.id, { scheduledDate: summary.todayStr });
                                  loadSchedules();
                                } catch (err) {
                                  toast('error', err.message || 'Could not move to today');
                                }
                              },
                            },
                            !done && { label: 'Reassign / Move', onClick: () => openAssign(item) },
                            { label: 'Edit', onClick: () => openEdit(item) },
                            { label: 'Delete', danger: true, onClick: () => removeItem(item) },
                          ].filter(Boolean)}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <PaginationBar
          page={meta.page}
          pages={meta.pages}
          total={meta.total}
          limit={limit}
          onPage={setPage}
          onLimit={(n) => { setLimit(n); setPage(1); }}
        />
      </section>

      {modal.open && (
        <Modal title={modal.mode === 'create' ? 'Add schedule work' : 'Edit schedule work'} onClose={() => setModal({ open: false, mode: 'create', item: null })}>
          <form onSubmit={save} className="sched-form">
            <label className="sched-field">
              <span>Work title *</span>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Drainage inspection, ward office meeting" />
            </label>
            <div className="date-chip-row">
              {[
                { d: kolkataDate(0), l: 'Today' },
                { d: kolkataDate(1), l: 'Tomorrow' },
                { d: kolkataDate(2), l: 'Day after' },
              ].map((c) => (
                <button key={c.d} type="button" className={`date-chip ${form.scheduledDate === c.d ? 'active' : ''}`} onClick={() => setForm({ ...form, scheduledDate: c.d })}>
                  {c.l}
                </button>
              ))}
            </div>
            <div className="sched-form-grid">
              <label className="sched-field">
                <span>Date *</span>
                <input type="date" required value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
              </label>
              <label className="sched-field">
                <span>Time</span>
                <input placeholder="10:30 AM" value={form.scheduledTime} onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} />
              </label>
            </div>
            {admin && (
              <SearchableSelect
                label="Nagarsevak"
                required
                value={form.nagarsevakUserId}
                onChange={(id) => {
                  setForm({ ...form, nagarsevakUserId: id, assignedEmployeeUserId: '' });
                  if (id) loadEmployeesForNagarsevak(id);
                }}
                options={corporators.map((c) => ({ value: c.id, label: c.name, title: c.name }))}
                placeholder="Select Nagarsevak"
                searchPlaceholder="Search Nagarsevak…"
              />
            )}
            <SearchableSelect
              label="Assign this work to"
              value={form.assignTo}
              onChange={(v) => setForm({ ...form, assignTo: v || 'NAGARSEVAK', assignedEmployeeUserId: v === 'EMPLOYEE' ? form.assignedEmployeeUserId : '' })}
              options={[
                { value: 'NAGARSEVAK', label: 'Nagarsevak', title: 'Nagarsevak', hint: 'Keep this work with the Nagarsevak' },
                { value: 'EMPLOYEE', label: 'Employee', title: 'Employee', hint: employees.length ? 'Move this work to a ward employee' : 'No employees in this ward yet' },
              ]}
              placeholder="Who should do this?"
            />
            {form.assignTo === 'EMPLOYEE' && (
              <SearchableSelect
                label="Employee"
                value={form.assignedEmployeeUserId}
                onChange={(id) => setForm({ ...form, assignedEmployeeUserId: id })}
                options={employees.map((e) => ({ value: e.id, label: e.name, title: e.name }))}
                placeholder={employees.length ? 'Select employee' : 'No employees available'}
                searchPlaceholder="Search employee…"
              />
            )}
            <div className="sched-form-grid">
              <SearchableSelect
                label="Type"
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v || 'VISIT' })}
                options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
                placeholder="Type of work"
              />
              <SearchableSelect
                label="Priority"
                value={form.priority}
                onChange={(v) => setForm({ ...form, priority: v || 'MEDIUM' })}
                options={PRIORITIES.map((p) => ({ value: p.key, label: p.label }))}
                placeholder="Priority"
              />
            </div>
            <label className="sched-field">
              <span>Location</span>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
            <label className="sched-field">
              <span>Notes</span>
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setModal({ open: false, mode: 'create', item: null })}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : 'Save work'}</button>
            </div>
          </form>
        </Modal>
      )}

      {pdfOpen && (
        <Modal title="Export schedule PDF" onClose={() => setPdfOpen(false)}>
          <div className="sched-form">
            <SearchableSelect
              label="Report"
              value={pdfType}
              onChange={(v) => setPdfType(v || 'today')}
              options={PDF_OPTIONS.map((o) => ({ value: o.key, label: o.label, title: o.label }))}
              placeholder="Choose report"
              searchPlaceholder="Search report type…"
            />
            <SearchableSelect
              label="Status"
              value={pdfStatus}
              onChange={(v) => setPdfStatus(v || 'ALL')}
              options={[
                { value: 'ALL', label: 'All work' },
                { value: 'INCOMPLETE', label: 'Remaining only' },
                { value: 'COMPLETED', label: 'Completed only' },
              ]}
              placeholder="Status"
            />
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setPdfOpen(false)}>Cancel</button>
              <button type="button" className="primary-btn" disabled={pdfBusy} onClick={exportPdf}>
                {pdfBusy ? 'Preparing…' : 'Download PDF'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {assignModal.open && (
        <Modal title="Reassign / Move work" onClose={() => setAssignModal({ open: false, item: null, assignTo: 'EMPLOYEE', assignedEmployeeUserId: '' })}>
          <form onSubmit={saveAssign} className="sched-form">
            <p className="sched-notes">{assignModal.item?.title}</p>
            <SearchableSelect
              label="Move to"
              value={assignModal.assignTo}
              onChange={(v) => setAssignModal({ ...assignModal, assignTo: v || 'NAGARSEVAK' })}
              options={[
                { value: 'NAGARSEVAK', label: 'Nagarsevak', title: 'Nagarsevak' },
                { value: 'EMPLOYEE', label: 'Employee', title: 'Employee' },
              ]}
              placeholder="Move to"
            />
            {assignModal.assignTo === 'EMPLOYEE' && (
              <SearchableSelect
                label="Employee"
                value={assignModal.assignedEmployeeUserId}
                onChange={(id) => setAssignModal({ ...assignModal, assignedEmployeeUserId: id })}
                options={employees.map((e) => ({ value: e.id, label: e.name, title: e.name }))}
                placeholder={employees.length ? 'Select employee' : 'No employees in this ward'}
                searchPlaceholder="Search employee…"
              />
            )}
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setAssignModal({ open: false, item: null, assignTo: 'EMPLOYEE', assignedEmployeeUserId: '' })}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={assigning}>{assigning ? 'Moving…' : 'Move work'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
