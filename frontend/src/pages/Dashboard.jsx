import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getUser } from '../services/api';
import { ErrorBox, Loading, Modal, PageHeader, StatCard, StatusPill, FaceAvatar, Field, MultiImageField, RowMenu } from '../components/Ui';
import { parseComplaintImages, packComplaintImages } from '../complaintMedia';
import WardFilter from '../components/WardFilter';
import { isEmployee, isMaster, isSubMaster, isNagarsevak, can, permissionsOf } from '../rbac';
import { useWardFilter } from '../wardFilter';
import { exportScheduleToPdf } from '../schedulePdf';
const complaintLabels = ['SUBMITTED', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const PIPELINE_STAGES = [
  { key: 'SUBMITTED', label: '1. Submitted', sub: 'New issue filed', color: '#6366f1', step: '01' },
  { key: 'PENDING', label: '2. Pending', sub: 'Awaiting triage', color: '#f59e0b', step: '02' },
  { key: 'ASSIGNED', label: '3. Assigned', sub: 'With field team', color: '#0ea5e9', step: '03' },
  { key: 'IN_PROGRESS', label: '4. In Progress', sub: 'Work on-site', color: '#8b5cf6', step: '04' },
  { key: 'RESOLVED', label: '5. Resolved', sub: 'Fixed & verified', color: '#10b981', step: '05' },
  { key: 'CLOSED', label: '6. Closed', sub: 'Archived record', color: '#64748b', step: '06' },
];

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

function scheduleAssigneeText(item) {
  if (item?.assignedEmployee?.name) return `Assigned to employee: ${item.assignedEmployee.name}`;
  return item?.nagarsevak?.name ? `Assigned to Nagarsevak: ${item.nagarsevak.name}` : 'Assigned to Nagarsevak';
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

function wardLabel(row) {
  const number = row?.ward?.wardNumber || row?.house?.area?.ward?.wardNumber;
  const name = row?.ward?.name || row?.house?.area?.ward?.name;
  if (!number && !name) return 'Ward not linked';
  return name ? `${number} · ${name}` : number;
}

function snippet(text, n = 90) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 'No problem description';
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function resolveNagarsevakName(user, data) {
  if (isNagarsevak(user)) {
    return data?.user?.name || user?.name || 'Nagarsevak';
  }
  if (data?.employee?.manager?.name) {
    return data.employee.manager.name;
  }
  if (user?.employeeProfile?.manager?.name) {
    return user.employeeProfile.manager.name;
  }
  if (data?.teamNagarsevaks && data.teamNagarsevaks.length > 0 && data.teamNagarsevaks[0]?.name) {
    return data.teamNagarsevaks[0].name;
  }
  if (data?.ward?.nagarsevak?.name) {
    return data.ward.nagarsevak.name;
  }
  if (data?.corporatorName) {
    return data.corporatorName;
  }
  const wNo = data?.ward?.wardNumber || user?.ward?.wardNumber;
  return wNo ? `नगरसेवक (प्रभाग क्र. ${wNo})` : 'नगरसेवक';
}

function getCitizenDirectionsUrl(item) {
  if (!item) return '';
  const lat = item.latitude || item.family?.house?.latitude || item._activeEvent?.latitude;
  const lng = item.longitude || item.family?.house?.longitude || item._activeEvent?.longitude;
  if (lat && lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  const houseNo = item.house || item.family?.house?.houseNumber;
  const apt = item.family?.house?.apartment?.name;
  const addr = item.address || item.family?.house?.address;
  const area = item.family?.house?.area?.name;
  const wardName = item.family?.house?.area?.ward?.name;
  const wardNo = item.family?.house?.area?.ward?.wardNumber;

  const parts = [
    houseNo ? `House ${houseNo}` : '',
    apt,
    addr,
    area,
    wardName,
    wardNo ? `Ward ${wardNo}` : '',
  ].filter(Boolean);

  if (parts.length > 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
  }
  if (item.fullName || item.name) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.fullName || item.name)}`;
  }
  return '';
}

function getGreetingPayload(ev, user, ward, data) {
  const nagarName = resolveNagarsevakName(user, data);
  const wardStr = ward?.wardNumber ? `वॉर्ड क्र. ${ward.wardNumber}` : '';
  const wardTitle = wardStr ? (ward?.name ? `${wardStr} (${ward.name})` : wardStr) : '';

  if (ev.kind === 'BIRTHDAY') {
    return {
      title: 'Birthday Greetings',
      titleMr: 'वाढदिवसाच्या हार्दिक शुभेच्छा',
      theme: 'birthday',
      isSolemn: false,
      senderDisplayName: nagarName,
      senderRole: 'नगरसेवक / Corporator',
      cardTitle: 'HAPPY BIRTHDAY',
      cardSubtitle: 'वाढदिवसाच्या मनःपूर्वक हार्दिक शुभेच्छा!',
      cardBody: `प्रिय ${ev.name} जी, आपणास वाढदिवसाच्या मनःपूर्वक हार्दिक शुभेच्छा! ईश्वर आपणास उत्तम आरोग्य, दीर्घायुष्य आणि सुख-समृद्धी लाभो हीच प्रार्थना.`,
      defaultMessage: `सस्नेह नमस्कार ${ev.name} जी,\n\nआपणास वाढदिवसाच्या मनःपूर्वक हार्दिक शुभेच्छा!\nआपणास उत्तम आरोग्य, दीर्घायुष्य आणि भरभराटीचे जीवन लाभो हीच ईश्वरचरणी प्रार्थना.\n\n- सस्नेह शुभेच्छुक,\n${nagarName}\n${wardTitle ? 'नगरसेवक, ' + wardTitle : 'नगरसेवक कार्यालय'}`
    };
  }

  if (ev.kind === 'DAHAVA') {
    return {
      title: '10th Day Observance (दहावा)',
      titleMr: 'दहावा - भावपूर्ण श्रद्धांजली',
      theme: 'dahava',
      isSolemn: true,
      senderDisplayName: nagarName,
      senderRole: 'नगरसेवक / Corporator',
      cardTitle: 'भावपूर्ण श्रद्धांजली',
      cardSubtitle: 'दहावा - विनम्र आदरांजली',
      cardBody: `स्व. ${ev.name} यांच्या पवित्र स्मृतीस भावपूर्ण श्रद्धांजली. त्यांच्या आत्म्यास चिरशांती लाभो आणि कुटुंबियांना हे दुःख सहन करण्याचे बळ मिळो हीच प्रार्थना.`,
      defaultMessage: `भावपूर्ण श्रद्धांजली,\n\nस्व. ${ev.name} यांच्या दहाव्या निमित्त त्यांच्या पवित्र स्मृतीस विनम्र आदरांजली.\nईश्वर त्यांच्या आत्म्यास चिरशांती देवो आणि कुटुंबियांना हे अतीव दुःख सहन करण्याचे बळ देवो हीच प्रार्थना.\n\n- विनम्र अभिवादन,\n${nagarName}\n${wardTitle ? 'नगरसेवक, ' + wardTitle : 'नगरसेवक कार्यालय'}`
    };
  }

  return {
    title: '1st Year Remembrance (वर्षश्राद्ध)',
    titleMr: 'प्रथम पुण्यस्मरण / वर्षश्राद्ध',
    theme: 'anniversary',
    isSolemn: true,
    senderDisplayName: nagarName,
    senderRole: 'नगरसेवक / Corporator',
    cardTitle: 'प्रथम पुण्यस्मरण',
    cardSubtitle: 'वर्षश्राद्ध - विनम्र आदरांजली',
    cardBody: `स्व. ${ev.name} यांच्या प्रथम पुण्यस्मरण / वर्षश्राद्ध दिनी त्यांच्या पावन स्मृतीस कोटी कोटी प्रणाम व विनम्र आदरांजली. ईश्वर त्यांच्या आत्म्यास चिरशांती देवो.`,
    defaultMessage: `विनम्र आदरांजली,\n\nस्व. ${ev.name} यांच्या प्रथम पुण्यस्मरण / वर्षश्राद्ध दिनी त्यांच्या पावन स्मृतीस कोटी कोटी प्रणाम व विनम्र आदरांजली.\nत्यांच्या आठवणी कायम आपल्या हृदयात अमर राहतील. ईश्वर त्यांच्या आत्म्यास चिरशांती देवो हीच प्रार्थना.\n\n- विनम्र अभिवादन,\n${nagarName}\n${wardTitle ? 'नगरसेवक, ' + wardTitle : 'नगरसेवक कार्यालय'}`
  };
}

function TodayAgendaColumn({ title, count, empty, items, kind, onOpen, onViewDetails }) {
  const subtitle = kind === 'birthday'
    ? `${count} birthday${count === 1 ? '' : 's'} today`
    : kind === 'dahava'
    ? `${count} 10th-day observance${count === 1 ? '' : 's'} today`
    : `${count} 1st-year remembrance${count === 1 ? '' : 's'} today`;

  return (
    <div className={`dash-agenda-card agenda-${kind}`}>
      <div className="agenda-card-head">
        <div className="agenda-head-left">
          <span className={`agenda-kind-indicator kind-${kind}`}></span>
          <div>
            <h4>{title}</h4>
            <span className="agenda-subtitle">{subtitle}</span>
          </div>
        </div>
        <div className="agenda-count-badge">{count}</div>
      </div>

      <div className="agenda-body">
        {items.length === 0 ? (
          <div className="agenda-empty">
            <p>{empty}</p>
          </div>
        ) : (
          <ul className="agenda-item-list">
            {items.map((ev) => (
              <li key={ev.id} className="agenda-item">
                <div className="agenda-item-main">
                  <div className="agenda-person">
                    <button
                      type="button"
                      className="agenda-name-btn"
                      onClick={() => onViewDetails && onViewDetails(ev)}
                      title="Click to view citizen profile"
                    >
                      {ev.name}
                    </button>
                    {ev.kind === 'BIRTHDAY' && <span className="agenda-tag tag-bday">Birthday</span>}
                    {ev.kind === 'DAHAVA' && <span className="agenda-tag tag-dahava">10th Day</span>}
                    {ev.kind === 'ANNIVERSARY' && <span className="agenda-tag tag-year">1st Year</span>}
                  </div>
                  <div className="agenda-address">
                    <span className="agenda-house">
                      {ev.house ? `House ${ev.house}` : 'House not linked'}
                    </span>
                    {ev.address ? ` · ${ev.address}` : ''}
                  </div>
                </div>

                <div className="agenda-item-actions">
                  <button
                    type="button"
                    className="small-btn view-btn agenda-view-btn"
                    onClick={() => onViewDetails && onViewDetails(ev)}
                    title={`View full details for ${ev.name}`}
                  >
                    View
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {count > 0 && onOpen && (
        <div className="agenda-footer">
          <button type="button" className="agenda-open-btn" onClick={onOpen}>
            View all {title.toLowerCase()} →
          </button>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const user = getUser();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const [citizenDetail, setCitizenDetail] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);

  const { selectedWardId: selected, canSelect } = useWardFilter();

  const [whatsappModal, setWhatsappModal] = useState(null);
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [waCopied, setWaCopied] = useState(false);

  const todayKey = new Date().toISOString().slice(0, 10);
  const [sentGreetingIds, setSentGreetingIds] = useState(() => {
    try {
      const stored = localStorage.getItem(`ward_sent_greetings_${todayKey}`);
      return stored ? JSON.parse(stored) : [];
    } catch (_) {
      return [];
    }
  });

  const recordGreetingSent = (evId) => {
    if (!evId) return;
    setSentGreetingIds((prev) => {
      const idStr = String(evId);
      if (prev.includes(idStr)) return prev;
      const next = [...prev, idStr];
      try {
        localStorage.setItem(`ward_sent_greetings_${todayKey}`, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  // Daily Schedule — Nagarsevak + Employee dashboard only
  const [schedules, setSchedules] = useState([]);
  const [scheduleSummary, setScheduleSummary] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleFilter, setScheduleFilter] = useState('today');
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
    nagarsevakUserId: '',
    assignTo: 'NAGARSEVAK',
    assignedEmployeeUserId: '',
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleEmployees, setScheduleEmployees] = useState([]);
  const [scheduleAssign, setScheduleAssign] = useState({ open: false, item: null, assignTo: 'EMPLOYEE', assignedEmployeeUserId: '' });
  const [scheduleAssigning, setScheduleAssigning] = useState(false);

  const canViewSchedule = (isNagarsevak(user) || isEmployee(user)) && (
    can('VIEW_SCHEDULES') ||
    !permissionsOf(user).some((p) => String(p).toUpperCase().includes('SCHEDULES'))
  );

  const loadSchedules = React.useCallback(async () => {
    if (!canViewSchedule) return;
    setScheduleLoading(true);
    try {
      const params = {
        wardId: selected || undefined,
        filterPreset: scheduleFilter,
      };
      const res = await api.schedules(params);
      setSchedules(res?.data || []);
      const summary = res?.meta?.summary || res?.summary || null;
      if (summary) setScheduleSummary(summary);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setScheduleLoading(false);
    }
  }, [canViewSchedule, selected, scheduleFilter]);

  useEffect(() => {
    if (!canViewSchedule) return;
    api.wardTeam(selected || user?.wardId)
      .then((r) => {
        const list = r?.data?.employees || [];
        setScheduleEmployees(list.map((e) => ({
          id: e.id,
          name: e.name,
          managerUserId: e.employeeProfile?.managerUserId,
        })));
      })
      .catch(() => setScheduleEmployees([]));
  }, [canViewSchedule, selected, user?.wardId]);

  const handleExportDashboardSchedulePdf = () => {
    const filterLabel =
      scheduleFilter === 'yesterday_remaining'
        ? "Yesterday's Remaining Tasks"
        : scheduleFilter === 'yesterday'
        ? "Yesterday's Full Work"
        : "Today's Work";
    exportScheduleToPdf(schedules, {
      title: 'Daily Schedule & Action Plan',
      filterLabel,
      nagarName: user?.name || 'Ward team',
      periodType: scheduleFilter,
    });
  };

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
            message: `✓ Task moved to Today's Agenda: "${item.title}"`,
          },
        })
      );
      loadSchedules();
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'error',
            message: err.message || 'Failed to move task to today',
          },
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
    const defaultDate =
      scheduleFilter === 'tomorrow'
        ? (scheduleSummary?.tomorrowStr || getTodayDateStr())
        : scheduleFilter === 'day_after'
        ? (scheduleSummary?.dayAfterStr || getTodayDateStr())
        : scheduleFilter === 'yesterday' || scheduleFilter === 'yesterday_remaining'
        ? (scheduleSummary?.yesterdayStr || getTodayDateStr())
        : (scheduleSummary?.todayStr || getTodayDateStr());
    let defaultNagarId = '';
    if (isNagarsevak(user)) {
      defaultNagarId = user.id;
    } else if (isEmployee(user)) {
      defaultNagarId = data?.employee?.manager?.id || user?.employeeProfile?.managerUserId || '';
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
      assignTo: isEmployee(user) ? 'NAGARSEVAK' : (scheduleEmployees.length ? 'EMPLOYEE' : 'NAGARSEVAK'),
      assignedEmployeeUserId: '',
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
      assignTo: item.assignedEmployeeUserId ? 'EMPLOYEE' : 'NAGARSEVAK',
      assignedEmployeeUserId: item.assignedEmployeeUserId || '',
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
    if (scheduleForm.assignTo === 'EMPLOYEE' && !scheduleForm.assignedEmployeeUserId) {
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'error', message: 'Select an employee, or assign this work to Nagarsevak.' }
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
          nagarsevakUserId: scheduleForm.nagarsevakUserId || undefined,
          assignTo: scheduleForm.assignTo || 'NAGARSEVAK',
          assignedEmployeeUserId: scheduleForm.assignTo === 'EMPLOYEE' ? (scheduleForm.assignedEmployeeUserId || null) : null,
          wardId: selected || undefined,
        };
        await api.createSchedule(payload);
      } else {
        const payload = {
          ...scheduleForm,
          title: scheduleForm.title.trim(),
          location: scheduleForm.location ? scheduleForm.location.trim() : null,
          description: scheduleForm.description ? scheduleForm.description.trim() : null,
          scheduledTime: scheduleForm.scheduledTime ? scheduleForm.scheduledTime.trim() : null,
          assignTo: scheduleForm.assignTo || 'NAGARSEVAK',
          assignedEmployeeUserId: scheduleForm.assignTo === 'EMPLOYEE' ? (scheduleForm.assignedEmployeeUserId || null) : null,
        };
        await api.updateSchedule(scheduleModal.item.id, payload);
      }
      setScheduleModal({ isOpen: false, mode: 'create', item: null });
      loadSchedules();
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'error', message: err.message || 'Failed to save schedule item' }
        })
      );
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleDeleteSchedule = async (item) => {
    if (!item?.id) return;
    if (!window.confirm(`Move "${item.title}" to recycle bin?`)) {
      return;
    }
    try {
      await api.deleteSchedule(item.id);
      loadSchedules();
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'error', message: err.message || 'Failed to delete schedule item' }
        })
      );
    }
  };

  const openScheduleAssign = (item) => {
    if (item.wardId) {
      api.wardTeam(item.wardId)
        .then((r) => {
          const list = r?.data?.employees || [];
          setScheduleEmployees(list.map((e) => ({
            id: e.id,
            name: e.name,
            managerUserId: e.employeeProfile?.managerUserId,
          })));
        })
        .catch(() => {});
    }
    setScheduleAssign({
      open: true,
      item,
      assignTo: item.assignedEmployeeUserId ? 'EMPLOYEE' : (scheduleEmployees.length ? 'EMPLOYEE' : 'NAGARSEVAK'),
      assignedEmployeeUserId: item.assignedEmployeeUserId || '',
    });
  };

  const handleSaveScheduleAssign = async (e) => {
    e?.preventDefault();
    if (!scheduleAssign.item) return;
    if (scheduleAssign.assignTo === 'EMPLOYEE' && !scheduleAssign.assignedEmployeeUserId) {
      window.dispatchEvent(new CustomEvent('ward:toast', { detail: { type: 'error', message: 'Select an employee to move this work.' } }));
      return;
    }
    setScheduleAssigning(true);
    try {
      await api.assignSchedule(scheduleAssign.item.id, {
        assignTo: scheduleAssign.assignTo,
        assignedEmployeeUserId: scheduleAssign.assignTo === 'EMPLOYEE' ? scheduleAssign.assignedEmployeeUserId : null,
      });
      setScheduleAssign({ open: false, item: null, assignTo: 'EMPLOYEE', assignedEmployeeUserId: '' });
      loadSchedules();
    } catch (err) {
      window.dispatchEvent(new CustomEvent('ward:toast', { detail: { type: 'error', message: err.message || 'Could not reassign work' } }));
    } finally {
      setScheduleAssigning(false);
    }
  };

  const openCitizenDetails = async (ev) => {
    try {
      setError('');
      let personData = null;
      if (ev.personId) {
        try {
          const res = await api.person(ev.personId);
          personData = res?.data;
        } catch (_) {}
      }
      if (!personData && ev.name) {
        try {
          const res = await api.persons({ search: ev.name, limit: 1 });
          if (res?.data?.[0]?.id) {
            const fullRes = await api.person(res.data[0].id);
            personData = fullRes?.data || res.data[0];
          }
        } catch (_) {}
      }
      if (!personData) {
        personData = {
          id: ev.personId,
          fullName: ev.name,
          mobile: ev.mobile || ev.alternateMobile || '—',
          dob: ev.dob || '—',
          family: {
            familyName: ev.name?.split(' ').slice(-1)[0] || '—',
            house: {
              houseNumber: ev.house || '—',
              address: ev.address || '—',
              latitude: ev.latitude || null,
              longitude: ev.longitude || null,
            }
          }
        };
      } else {
        if (!personData.mobile && ev.mobile) personData.mobile = ev.mobile;
        if (!personData.family) personData.family = {};
        if (!personData.family.house) personData.family.house = {};
        if (ev.house && !personData.family.house.houseNumber) personData.family.house.houseNumber = ev.house;
        if (ev.address && !personData.family.house.address) personData.family.house.address = ev.address;
        if (ev.latitude && !personData.family.house.latitude) personData.family.house.latitude = ev.latitude;
        if (ev.longitude && !personData.family.house.longitude) personData.family.house.longitude = ev.longitude;
      }
      personData._activeEvent = ev;
      setCitizenDetail(personData);
    } catch (err) {
      setError(err.message || 'Could not load citizen details');
    }
  };

  const openWhatsapp = async (ev) => {
    const payload = getGreetingPayload(ev, user, data?.ward, data);
    const initialPhone = ev.mobile || ev.alternateMobile || '';
    setWhatsappModal({ ev, payload });
    setWaPhone(initialPhone);
    setWaMessage(payload.defaultMessage);
    setWaCopied(false);

    if (!initialPhone && (ev.personId || ev.name)) {
      try {
        let p = null;
        if (ev.personId) {
          const r = await api.person(ev.personId);
          p = r?.data;
        }
        if (!p && ev.name) {
          const r = await api.persons({ search: ev.name, limit: 1 });
          p = r?.data?.[0];
        }
        const resolvedPhone = p?.mobile || p?.alternateMobile || '';
        if (resolvedPhone) {
          setWaPhone(resolvedPhone);
          setWhatsappModal((prev) =>
            prev ? { ...prev, ev: { ...prev.ev, mobile: resolvedPhone, personId: p?.id || prev.ev.personId } } : null
          );
        }
      } catch (_) {}
    }
  };

  const handleSendWhatsapp = () => {
    const raw = String(waPhone || '').replace(/\D/g, '');
    let phone = raw;
    if (phone.length === 10) {
      phone = '91' + phone;
    }
    const url = phone
      ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(waMessage)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(waMessage)}`;
    window.open(url, '_blank');

    if (whatsappModal?.ev?.id) {
      recordGreetingSent(whatsappModal.ev.id);
    }
    setWhatsappModal(null);
  };

  const handleCopyWhatsapp = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(waMessage);
      setWaCopied(true);
      setTimeout(() => setWaCopied(false), 2000);
    }
  };

  const [updatingComplaint, setUpdatingComplaint] = useState(null);
  const [updateForm, setUpdateForm] = useState({
    status: '',
    comment: '',
    resolutionNote: '',
    resolutionImages: []
  });
  const [updateBusy, setUpdateBusy] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const canUpdateComplaint = (complaint) => {
    if (!complaint) return false;
    if (isMaster(user) || isSubMaster(user) || isNagarsevak(user) || can('EDIT_COMPLAINTS')) return true;
    if (isEmployee(user) && complaint.assignedEmployeeId === user?.employeeProfile?.id) return true;
    return false;
  };

  const initUpdateComplaint = (complaint) => {
    if (!complaint) return;
    const existingResolutionImages = parseComplaintImages(complaint.resolutionImages || complaint.resolutionImage);
    const current = complaint.status || 'SUBMITTED';
    let defaultStatus = current;
    if (isEmployee(user)) {
      if (current === 'ASSIGNED') defaultStatus = 'IN_PROGRESS';
      else if (current === 'IN_PROGRESS') defaultStatus = 'RESOLVED';
    } else {
      if (current === 'SUBMITTED' || current === 'PENDING') defaultStatus = 'ASSIGNED';
      else if (current === 'ASSIGNED') defaultStatus = 'IN_PROGRESS';
      else if (current === 'IN_PROGRESS') defaultStatus = 'RESOLVED';
    }

    setUpdateForm({
      status: defaultStatus,
      comment: '',
      resolutionNote: complaint.resolutionNote || '',
      resolutionImages: existingResolutionImages
    });
    setUpdatingComplaint(complaint);
  };

  const getAllowedStatuses = (currentStatus) => {
    if (isEmployee(user)) {
      if (currentStatus === 'ASSIGNED') return ['ASSIGNED', 'IN_PROGRESS'];
      return ['IN_PROGRESS', 'RESOLVED'];
    }
    const transitions = {
      SUBMITTED: ['SUBMITTED', 'PENDING', 'ASSIGNED', 'IN_PROGRESS'],
      PENDING: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'],
      ASSIGNED: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED'],
      IN_PROGRESS: ['IN_PROGRESS', 'RESOLVED', 'REOPENED'],
      RESOLVED: ['RESOLVED', 'CLOSED', 'REOPENED'],
      REOPENED: ['REOPENED', 'ASSIGNED', 'IN_PROGRESS'],
      CLOSED: ['CLOSED', 'REOPENED']
    };
    return transitions[currentStatus] || ['SUBMITTED', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  };

  const loadDashboard = React.useCallback(() => {
    setRefreshing(true);
    api
      .dashboard({ wardId: selected || undefined })
      .then((r) => {
        setData(r.data);
        setError('');
      })
      .catch((e) => {
        setError(e.message);
      })
      .finally(() => {
        setRefreshing(false);
      });
  }, [selected]);

  const handleSaveStatus = async (e) => {
    if (e) e.preventDefault();
    if (!updatingComplaint) return;
    if (updateForm.status === 'RESOLVED' && !String(updateForm.resolutionNote || '').trim()) {
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'error', message: 'Resolution note is mandatory when resolving a complaint.' }
        })
      );
      return;
    }
    setUpdateBusy(true);
    try {
      const payload = {
        status: updateForm.status,
        comment: updateForm.comment ? updateForm.comment.trim() : undefined,
        resolutionNote: updateForm.resolutionNote ? updateForm.resolutionNote.trim() : undefined,
        resolutionImages: updateForm.resolutionImages || [],
        resolutionImage: packComplaintImages(updateForm.resolutionImages || [])
      };
      const r = await api.updateComplaintStatus(updatingComplaint.id, payload);
      if (detail && detail.id === updatingComplaint.id) {
        setDetail(r.data);
      }
      setUpdatingComplaint(null);
      loadDashboard();
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'success',
            message: `Complaint ${updatingComplaint.complaintNumber} updated to ${updateForm.status.replaceAll('_', ' ')}`
          }
        })
      );
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: { type: 'error', message: err.message || 'Failed to update complaint status' }
        })
      );
    } finally {
      setUpdateBusy(false);
    }
  };

  useEffect(() => {
    setError('');
    loadDashboard();
    const timer = setInterval(loadDashboard, 30000);
    return () => {
      clearInterval(timer);
    };
  }, [loadDashboard]);

  useEffect(() => {
    let live = true;
    const loadChat = () =>
      api
        .chatGroups(selected ? { wardId: selected } : {})
        .then((r) => {
          if (!live) return;
          setChatUnread(
            (r.data || []).reduce((n, g) => n + Number(g.unreadCount || 0), 0)
          );
        })
        .catch(() => {});
    loadChat();
    const t = setInterval(loadChat, 15000);
    window.addEventListener('ward:chat-refresh', loadChat);
    return () => {
      live = false;
      clearInterval(t);
      window.removeEventListener('ward:chat-refresh', loadChat);
    };
  }, [selected]);

  if (error && !data) {
    return (
      <div className="admin-dashboard-page">
        <PageHeader kicker="Overview" title="Dashboard" />
        <ErrorBox error={error} />
      </div>
    );
  }
  if (!data) return <Loading />;

  const master = isMaster(user);
  const subMaster = isSubMaster(user);
  const nagar = isNagarsevak(user);
  const employee = isEmployee(user);
  const field = nagar || employee;

  const status = data.statusCounts || {};
  const title = master
    ? 'Master Administration Dashboard'
    : subMaster
    ? 'Sub Master Admin Dashboard'
    : nagar
    ? 'Nagarsevak Executive Workspace'
    : 'Field Employee Duty Workspace';

  const subtitle = master
    ? 'City-wide counts, staff, and ward health at a glance.'
    : nagar
    ? 'Today’s work, complaints, and field team for this ward.'
    : 'Assigned areas, complaints, and today’s schedule.';

  const scopeText = data.ward
    ? `${data.ward.wardNumber} · ${data.ward.name || 'Municipal Ward'}`
    : 'All Municipal Wards';

  const openTo = (path) => navigate(path);
  const recent = data.recentComplaints || [];
  const allEvents = data.todayEvents || [];
  const events = allEvents.filter((ev) => !sentGreetingIds.includes(String(ev.id)));
  const birthdays = events.filter((ev) => ev.kind === 'BIRTHDAY');
  const dahava = events.filter((ev) => ev.kind === 'DAHAVA');
  const varsha = events.filter((ev) => ev.kind === 'ANNIVERSARY');

  // Enriched employee & nagarsevak data from controller
  const empManager = data.employee?.manager;
  const assignedAreas = data.employee?.assignedAreas || [];
  const myEmployees = data.myEmployees || [];

  return (
    <div className={`admin-dashboard-page ${field ? 'is-field-desk' : 'is-admin-desk'}`}>
      {!field && (
      <div className="dash-top-bar">
        <div>
          <div className="dash-kicker">MUNICIPAL DESK · OVERVIEW</div>
          <h1 className="dash-heading">{title}</h1>
          <p className="dash-subheading">{subtitle}</p>
        </div>

        <div className="dash-scope-badge">
          <span className="scope-dot"></span>
          <div className="scope-meta">
            <span className="scope-title">ACTIVE SCOPE</span>
            <strong>{scopeText}</strong>
          </div>
          {refreshing && <span className="scope-syncing">Syncing…</span>}
        </div>
      </div>
      )}

      <ErrorBox error={error} />

      {/* Ward Selector for Master/SubMaster */}
      {canSelect && (
        <section className="panel dashboard-scope-panel">
          <div className="dashboard-scope-copy">
            <span className="eyebrow">WARD</span>
            <h3>Choose a ward</h3>
            <p>Numbers below follow this ward. Leave as all wards for the full city view.</p>
          </div>
          <div className="dashboard-scope-control">
            <WardFilter label="Select ward" />
          </div>
        </section>
      )}

      {/* EXECUTIVE DUTY HERO BANNER (Nagarsevak & Field Employee) */}
      {field && (
        <section className="dash-hero-card">
          <div className="dash-hero-content">
            <div className="dash-hero-avatar-wrap">
              <FaceAvatar
                name={data.user?.name || user?.name}
                photo={data.user?.photo || user?.photo}
                className="dash-hero-avatar"
              />
              <span className={`dash-role-badge ${nagar ? 'badge-nagar' : 'badge-emp'}`}>
                {nagar ? 'Nagarsevak' : 'Employee'}
              </span>
            </div>

            <div className="dash-hero-details">
              <div className="dash-hero-title-row">
                <h2>{data.user?.name || user?.name}</h2>
                <span className="dash-status-pill">On duty</span>
              </div>

              <div className="dash-meta-pills">
                <span className="dash-meta-pill">
                  <strong>Ward:</strong> {scopeText}
                </span>

                {nagar && data.user?.wardSeat && (
                  <span className="dash-meta-pill">
                    <strong>Seat:</strong> {data.user.wardSeat}
                  </span>
                )}

                {nagar && data.user?.partyName && (
                  <span className="dash-meta-pill">
                    <strong>Party:</strong> {data.user.partyName}
                  </span>
                )}

                {employee && (
                  <span className="dash-meta-pill">
                    <strong>Designation:</strong> {data.employee?.designation || 'Field Officer'}
                  </span>
                )}

                {employee && empManager && (
                  <span className="dash-meta-pill dash-manager-pill">
                    <strong>Under Nagarsevak:</strong>{' '}
                    <a href={`tel:${empManager.mobile}`} className="dash-tel-link" title="Tap to call">
                      {empManager.name} ({empManager.mobile || 'Call'})
                    </a>
                  </span>
                )}
              </div>

              {/* Employee assigned areas / colonies */}
              {employee && (
                <div className="dash-colonies-wrap">
                  <span className="dash-colonies-label">Assigned Colonies / Areas:</span>
                  {assignedAreas.length > 0 ? (
                    <div className="dash-colonies-tags">
                      {assignedAreas.map((a) => (
                        <span key={a.id} className="dash-colony-tag">
                          {a.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="dash-all-areas-tag">Full Ward Coverage (All Areas)</span>
                  )}
                </div>
              )}

              {/* Nagarsevak official office */}
              {nagar && data.user?.officialAddress && (
                <div className="dash-office-line">
                  <span><strong>Public Office:</strong> {data.user.officialAddress}</span>
                </div>
              )}
            </div>
          </div>

          <div className="dash-duty-strip" aria-label="Today at a glance">
            {canViewSchedule && (
              <button type="button" className="dash-duty-tile tile-schedule" onClick={() => openTo('/schedules')}>
                <div className="dash-duty-tile-top">
                  <span className="dash-duty-tag">Schedule</span>
                  <span className="dash-duty-arrow">→</span>
                </div>
                <span className="dash-duty-value">{Number(scheduleSummary?.todayPending || 0)}</span>
                <span className="dash-duty-label">Pending tasks today</span>
              </button>
            )}
            <button type="button" className="dash-duty-tile tile-agenda" onClick={() => document.querySelector('.dash-agenda-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <div className="dash-duty-tile-top">
                <span className="dash-duty-tag">Visits & Agenda</span>
                <span className="dash-duty-arrow">↓</span>
              </div>
              <span className="dash-duty-value">{birthdays.length + dahava.length + varsha.length}</span>
              <span className="dash-duty-label">Today's field agenda</span>
            </button>
            {can('VIEW_COMPLAINTS') && (
              <button type="button" className="dash-duty-tile tile-complaints" onClick={() => openTo('/complaints')}>
                <div className="dash-duty-tile-top">
                  <span className="dash-duty-tag">Complaints</span>
                  <span className="dash-duty-arrow">→</span>
                </div>
                <span className="dash-duty-value">{Number(data.openComplaints || 0)}</span>
                <span className="dash-duty-label">Open civic issues</span>
              </button>
            )}
            {can('VIEW_CHAT') && (
              <button type="button" className="dash-duty-tile tile-chat" onClick={() => openTo('/groups')}>
                <div className="dash-duty-tile-top">
                  <span className="dash-duty-tag">Ward Chat</span>
                  <span className="dash-duty-arrow">→</span>
                </div>
                <span className="dash-duty-value">{chatUnread}</span>
                <span className="dash-duty-label">{chatUnread > 0 ? `${chatUnread} unread messages` : 'Team discussions'}</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* TODAY'S FIELD SCHEDULE (Birthdays, Dahava, Varshashraddha) */}
      {field && (
        <section className="dash-agenda-section">
          <div className="dash-section-header">
            <div>
              <h3>Today's Field Agenda</h3>
            </div>
            <div className="agenda-total-chip">
              <span>Today's Total:</span>
              <strong>{birthdays.length + dahava.length + varsha.length}</strong>
            </div>
          </div>

          <div className="dash-agenda-grid">
            <TodayAgendaColumn
              title="Birthdays"
              kind="birthday"
              count={birthdays.length}
              empty="No birthdays in this ward today."
              items={birthdays}
              onOpen={() => openTo('/birthdays')}
              onSendWhatsapp={openWhatsapp}
              onViewDetails={openCitizenDetails}
            />

            <TodayAgendaColumn
              title="Dahava (10th Day)"
              kind="dahava"
              count={dahava.length}
              empty="No 10th-day observances today."
              items={dahava}
              onOpen={() => openTo('/deaths')}
              onSendWhatsapp={openWhatsapp}
              onViewDetails={openCitizenDetails}
            />

            <TodayAgendaColumn
              title="Varshashraddha (1st Year)"
              kind="anniversary"
              count={varsha.length}
              empty="No 1st-year remembrances today."
              items={varsha}
              onOpen={() => openTo('/deaths')}
              onSendWhatsapp={openWhatsapp}
              onViewDetails={openCitizenDetails}
            />
          </div>
        </section>
      )}

      {/* Daily Schedule — Nagarsevak & Employee dashboard */}
      {canViewSchedule && (
        <section className="dash-schedule-section panel">
          <div className="schedule-section-header">
            <div className="schedule-header-left">
              <div className="schedule-kicker">DAILY WORK</div>
              <div className="schedule-title-wrap">
                <h3 className="schedule-title">Daily Schedule</h3>
                <div className="agenda-total-chip schedule-total-chip">
                  <span>Total Scheduled Today:</span>
                  <strong>{scheduleSummary?.todayTotal ?? 0}</strong>
                </div>
              </div>
              <p className="schedule-subtitle">
                {employee
                  ? 'Today and yesterday’s ward tasks. Tick when done, or move work to Nagarsevak.'
                  : 'Plan today, tomorrow and the day after. Assign work to staff or keep it with Nagarsevak. Tick when complete.'}
              </p>
            </div>

            <div className="schedule-header-actions">
              <div className="schedule-metrics-pills">
                <div className="metric-pill pill-total">
                  <span className="pill-num">
                    {scheduleFilter === 'yesterday'
                      ? (scheduleSummary?.yesterdayTotal ?? 0)
                      : (scheduleSummary?.todayTotal ?? 0)}
                  </span>
                  <span className="pill-text">Total</span>
                </div>
                <div className="metric-pill pill-done">
                  <span className="pill-num">
                    {scheduleFilter === 'yesterday'
                      ? (scheduleSummary?.yesterdayCompleted ?? 0)
                      : (scheduleSummary?.todayCompleted ?? 0)}
                  </span>
                  <span className="pill-text">Done</span>
                </div>
                <div className="metric-pill pill-pending">
                  <span className="pill-num">
                    {scheduleFilter === 'yesterday'
                      ? (scheduleSummary?.yesterdayRemaining ?? 0)
                      : (scheduleSummary?.todayPending ?? 0)}
                  </span>
                  <span className="pill-text">Pending</span>
                </div>
              </div>

              <div className="schedule-header-btn-group">
                <button type="button" className="schedule-export-btn" onClick={handleExportDashboardSchedulePdf}>
                  Export PDF
                </button>
                <button type="button" className="primary-btn schedule-add-btn" onClick={openAddScheduleModal}>
                  + Add
                </button>
                <button type="button" className="schedule-view-all-btn" onClick={() => navigate('/schedules')}>
                  Full list →
                </button>
              </div>
            </div>
          </div>

          <div className="schedule-filter-tabs-wrapper">
            <div className="schedule-filter-tabs" role="tablist">
              <button
                type="button"
                className={`schedule-tab ${scheduleFilter === 'today' ? 'active' : ''}`}
                onClick={() => setScheduleFilter('today')}
              >
                <span className="tab-label">Today</span>
                <span className="tab-badge">{scheduleSummary?.todayTotal ?? 0}</span>
              </button>
              <button
                type="button"
                className={`schedule-tab ${scheduleFilter === 'tomorrow' ? 'active' : ''}`}
                onClick={() => setScheduleFilter('tomorrow')}
              >
                <span className="tab-label">Tomorrow</span>
                <span className="tab-badge">{scheduleSummary?.tomorrowTotal ?? 0}</span>
              </button>
              <button
                type="button"
                className={`schedule-tab ${scheduleFilter === 'day_after' ? 'active' : ''}`}
                onClick={() => setScheduleFilter('day_after')}
              >
                <span className="tab-label">Day after</span>
                <span className="tab-badge">{scheduleSummary?.dayAfterTotal ?? 0}</span>
              </button>
              <button
                type="button"
                className={`schedule-tab ${scheduleFilter === 'yesterday_remaining' ? 'active' : ''}`}
                onClick={() => setScheduleFilter('yesterday_remaining')}
              >
                <span className="tab-label">Yesterday pending</span>
                <span className={`tab-badge ${Number(scheduleSummary?.yesterdayRemaining || 0) > 0 ? 'badge-warning-pulse' : ''}`}>
                  {scheduleSummary?.yesterdayRemaining ?? 0}
                </span>
              </button>
              <button
                type="button"
                className={`schedule-tab ${scheduleFilter === 'yesterday' ? 'active' : ''}`}
                onClick={() => setScheduleFilter('yesterday')}
              >
                <span className="tab-label">Yesterday</span>
                <span className="tab-badge">{scheduleSummary?.yesterdayTotal ?? 0}</span>
              </button>
            </div>
          </div>

          {/* Pending work alert notice on Dashboard */}
          {Number(scheduleSummary?.yesterdayRemaining || 0) > 0 && scheduleFilter === 'today' && (
            <div className="dashboard-pending-alert-banner">
              <div className="pending-alert-content">
                <span className="pending-alert-badge">Pending Follow-up</span>
                <span className="pending-alert-text">
                  You have <strong>{scheduleSummary.yesterdayRemaining} incomplete task(s)</strong> from yesterday.
                </span>
              </div>
              <button
                type="button"
                className="pending-alert-action-btn"
                onClick={() => setScheduleFilter('yesterday_remaining')}
              >
                View Yesterday's Pending →
              </button>
            </div>
          )}

          <div className="schedule-items-container">
            {scheduleLoading ? (
              <div className="schedule-loading">
                <div className="schedule-spinner"></div>
                <span>Loading schedule…</span>
              </div>
            ) : schedules.length === 0 ? (
              <div className="schedule-empty-state">
                <h4>
                  {scheduleFilter === 'yesterday_remaining'
                    ? 'No remaining tasks from yesterday'
                    : scheduleFilter === 'yesterday'
                    ? 'No work logged yesterday'
                    : scheduleFilter === 'tomorrow'
                    ? 'No tasks for tomorrow'
                    : scheduleFilter === 'day_after'
                    ? 'No tasks for the day after tomorrow'
                    : 'No tasks for today'}
                </h4>
                <p>
                  {scheduleFilter === 'yesterday_remaining'
                    ? 'All tasks from yesterday were successfully completed!'
                    : scheduleFilter === 'yesterday'
                    ? 'Nothing was scheduled for yesterday in this ward.'
                    : 'Add a visit, meeting, or follow-up for today.'}
                </p>
                {scheduleFilter === 'today' && (
                  <button type="button" className="primary-btn empty-action-btn" onClick={openAddScheduleModal}>
                    + Add schedule item
                  </button>
                )}
              </div>
            ) : (
              <div className="schedule-list">
                {schedules.map((item) => {
                  const isCompleted = item.status === 'COMPLETED';
                  const catMeta = getCategoryMeta(item.category);
                  const priMeta = getPriorityMeta(item.priority);
                  const isMarking = scheduleMarkingId === item.id;
                  const canEdit = nagar || employee || item.createdByUserId === user.id;
                  const isPastOverdue =
                    !isCompleted &&
                    scheduleSummary?.todayStr &&
                    item.scheduledDate < scheduleSummary.todayStr;

                  return (
                    <article
                      key={item.id}
                      className={`schedule-card ${isCompleted ? 'card-completed' : ''} ${isPastOverdue ? 'card-overdue' : ''}`}
                    >
                      <div className="schedule-card-main">
                      <div className="schedule-card-left">
                        <button
                          type="button"
                          className={`schedule-check-toggle ${isCompleted ? 'checked' : ''}`}
                          onClick={() => handleToggleScheduleStatus(item)}
                          disabled={isMarking}
                          aria-label={isCompleted ? 'Mark as pending' : 'Mark as completed'}
                          title={isCompleted ? 'Undo — mark pending' : 'Mark completed'}
                        >
                          {isMarking ? (
                            <span className="toggle-spinner"></span>
                          ) : isCompleted ? (
                            <span className="check-icon">✓</span>
                          ) : (
                            <span className="uncheck-icon" />
                          )}
                        </button>
                      </div>

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

                        {item.location ? (
                          <div className="schedule-item-meta location-meta">
                            <span className="meta-text">{item.location}</span>
                          </div>
                        ) : null}

                        {item.description ? (
                          <div className="schedule-item-desc">{item.description}</div>
                        ) : null}

                        <div className="schedule-item-footer">
                          <div className="attribution-line">
                            {scheduleAssigneeText(item)}
                            {item.creator?.name ? ` · Added by ${item.creator.name}` : ''}
                          </div>
                          {isCompleted && item.completedBy?.name ? (
                            <div className="completion-info">
                              <span>Done by {item.completedBy.name}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      </div>

                      <div className="schedule-card-actions">
                        <RowMenu
                          items={[
                            {
                              label: isCompleted ? 'Reopen' : 'Mark done',
                              className: `small-btn ${isCompleted ? 'ghost-btn' : 'view-btn'}`,
                              onClick: () => handleToggleScheduleStatus(item),
                            },
                            canEdit && !isCompleted && item.scheduledDate < (scheduleSummary?.todayStr || getTodayDateStr()) && {
                              label: 'Move to today',
                              onClick: () => handleMoveToToday(item),
                            },
                            canEdit && !isCompleted && {
                              label: 'Reassign / Move',
                              onClick: () => openScheduleAssign(item),
                            },
                            canEdit && { label: 'Edit', onClick: () => openEditScheduleModal(item) },
                            canEdit && { label: 'Delete', danger: true, onClick: () => handleDeleteSchedule(item) },
                          ].filter(Boolean)}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* COMPLAINT RESOLUTION PIPELINE — Nagarsevak & Employee only */}
      {field && can('VIEW_COMPLAINTS') && (
        <section className="dash-pipeline-section panel">
          <div className="panel-title">
            <div>
              <h3>Complaints Pipeline</h3>
            </div>
            <button
              type="button"
              className="small-btn primary-btn"
              onClick={() => openTo('/complaints')}
            >
              Open Complaints Board →
            </button>
          </div>

          <div className="dash-pipeline-grid">
            {PIPELINE_STAGES.map((st) => {
              const count = status[st.key] || 0;
              return (
                <button
                  type="button"
                  key={st.key}
                  className={`pipeline-stage-card stage-${st.key.toLowerCase().replaceAll('_', '-')}`}
                  onClick={() => openTo(`/complaints?status=${st.key}`)}
                >
                  <div className="stage-top">
                    <span className="stage-step-num">{st.step}</span>
                    <strong className="stage-count">{count}</strong>
                  </div>
                  <div className="stage-name">{st.label}</div>
                  <div className="stage-sub">{st.sub}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* KEY METRICS & LIVE STATS (Guard-checked) */}
      <section className="panel dashboard-info-panel">
        <div className="panel-title">
          <div>
            <h3>{field ? 'This ward' : 'City & ward counts'}</h3>
          </div>
        </div>

        <div className="stat-grid">
          {can('VIEW_HOUSES') && (
            <StatCard
              label="Houses"
              value={data.houses}
              hint="Registered residential buildings"
              onClick={() => openTo('/houses')}
            />
          )}

          {can('VIEW_HOUSES') && (
            <StatCard
              label="Apartments"
              value={data.apartments || 0}
              hint="Multi-unit societies"
              onClick={() => openTo('/houses')}
            />
          )}

          {can('VIEW_FAMILIES') && (
            <StatCard
              label="Families"
              value={data.families}
              hint="Registered households"
              onClick={() => openTo('/families')}
            />
          )}

          {can('VIEW_CITIZENS') && (
            <StatCard
              label="Citizens"
              value={data.persons}
              hint="Active resident directory"
              onClick={() => openTo('/people')}
            />
          )}

          {can('VIEW_COMPLAINTS') && (
            <StatCard
              label="Open Complaints"
              value={data.openComplaints || 0}
              hint={`${data.complaints || 0} total registered`}
              onClick={() => openTo('/complaints')}
            />
          )}

          {can('VIEW_VOTERS') && (
            <StatCard
              label="Voters"
              value={data.voters}
              hint={`${data.nonVoters || 0} non-voters registered`}
              onClick={() => openTo('/voters')}
            />
          )}

          {can('VIEW_BIRTHDAYS') && (
            <StatCard
              label="Birthdays Next 30 Days"
              value={data.birthdaysNext30}
              hint="Upcoming citizen wishes"
              onClick={() => openTo('/birthdays')}
            />
          )}

          {can('VIEW_18PLUS') && (
            <StatCard
              label="18+ First-Time Voters"
              value={data.upcoming18Next90}
              hint="Next 90 days follow-ups"
              onClick={() => openTo('/follow-up-18')}
            />
          )}

          {master && (
            <StatCard
              label="Nagarsevaks"
              value={data.corporatorCount}
              hint="Active municipal leaders"
              onClick={() => openTo('/staff')}
            />
          )}

          {nagar && can('VIEW_STAFF') && (
            <StatCard
              label="My Field Staff"
              value={data.managedEmployees || myEmployees.length}
              hint="Active ward field team"
              onClick={() => openTo('/staff')}
            />
          )}

          {can('VIEW_CHAT') && (
            <StatCard
              label="Groups & Messages"
              value={chatUnread}
              hint={
                chatUnread
                  ? `${chatUnread} unread message${chatUnread === 1 ? '' : 's'}`
                  : 'Ward communication chat'
              }
              onClick={() => openTo('/groups')}
            />
          )}
        </div>
      </section>

      {/* LOWER SECTION: RECENT COMPLAINTS & TEAM */}
      <div className="two-col dashboard-lower">
        {/* Recent Complaints Stream */}
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>Recent Complaints</h3>
            </div>
            {can('VIEW_COMPLAINTS') && (
              <button
                type="button"
                className="small-btn"
                onClick={() => openTo('/complaints')}
              >
                View all
              </button>
            )}
          </div>

          {!recent.length ? (
            <p className="muted" style={{ padding: '20px', textAlign: 'center' }}>
              No complaints filed in this ward scope yet.
            </p>
          ) : (
            <div className="status-list dashboard-recent">
              {recent.map((c) => (
                <div className="status-row recent-row" key={c.id}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong>{c.complaintNumber}</strong>
                      {c.priority && (
                        <span className={`priority-tag priority-${String(c.priority).toLowerCase()}`}>
                          {c.priority}
                        </span>
                      )}
                    </div>
                    <span>
                      {c.citizen?.fullName || c.submittedBy?.name || 'Citizen'} · {wardLabel(c)}
                    </span>
                    <small className="recent-problem">{snippet(c.description)}</small>
                    <small className="recent-assign">
                      Nagarsevak: {c.assignedNagarsevak?.name || c.assignedEmployee?.manager?.name || 'Not assigned'} ·
                      Employee: {c.assignedEmployee?.User?.name || 'Not assigned'}
                    </small>
                  </div>
                  <div className="recent-actions">
                    <StatusPill>{c.status}</StatusPill>
                    <button
                      className="small-btn view-btn"
                      onClick={async () => {
                        try {
                          setDetail((await api.complaint(c.id)).data);
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* TEAM & CONTACTS DECK */}
        {field && (
          <section className="panel dash-team-panel">
            <div className="panel-title">
              <div>
                <h3>{nagar ? 'My Field Employees' : 'Reporting Officer & Ward Team'}</h3>
              </div>
              {nagar && can('VIEW_STAFF') && (
                <button
                  type="button"
                  className="small-btn"
                  onClick={() => openTo('/staff')}
                >
                  Manage Team
                </button>
              )}
            </div>

            {/* If Employee: Show Nagarsevak Contact Card */}
            {employee && empManager && (
              <div className="dash-manager-card">
                <div className="manager-card-top">
                  <FaceAvatar
                    name={empManager.name}
                    photo={empManager.photo}
                    className="manager-avatar"
                  />
                  <div>
                    <span className="manager-tag">MANAGING NAGARSEVAK</span>
                    <h4 className="manager-name">{empManager.name}</h4>
                    {empManager.partyName && (
                      <span className="manager-party">{empManager.partyName}</span>
                    )}
                    {empManager.wardSeat && (
                      <span className="manager-seat"> · {empManager.wardSeat}</span>
                    )}
                  </div>
                </div>

                <div className="manager-card-actions">
                  {empManager.mobile && (
                    <a
                      href={`tel:${empManager.mobile}`}
                      className="primary-btn manager-call-btn"
                    >
                      Call Nagarsevak ({empManager.mobile})
                    </a>
                  )}
                  {can('VIEW_CHAT') && (
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => openTo('/groups')}
                    >
                      Message in Chat
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* If Nagarsevak: List Managed Employees */}
            {nagar && (
              <div className="dash-emp-list">
                {!myEmployees.length ? (
                  <div className="agenda-empty" style={{ padding: '24px 16px' }}>
                    <p>No active employees registered under this Nagarsevak yet.</p>
                    {can('VIEW_STAFF') && (
                      <button
                        type="button"
                        className="small-btn primary-btn"
                        style={{ marginTop: '10px' }}
                        onClick={() => openTo('/staff')}
                      >
                        + Add Ward Employee
                      </button>
                    )}
                  </div>
                ) : (
                  myEmployees.map((emp) => (
                    <div key={emp.id} className="dash-emp-card">
                      <div className="emp-card-left">
                        <FaceAvatar name={emp.name} className="emp-avatar" />
                        <div>
                          <strong>{emp.name}</strong>
                          <span className="emp-desig">{emp.designation}</span>
                        </div>
                      </div>
                      <div className="emp-card-right">
                        {emp.mobile && (
                          <a href={`tel:${emp.mobile}`} className="small-btn emp-call-btn">
                            {emp.mobile}
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Complaint Details Modal */}
      {detail && (
        <Modal
          wide
          title={`${detail.complaintNumber} · Complete Complaint Details`}
          onClose={() => setDetail(null)}
        >
          <div className="detail-grid complaint-detail-grid">
            <div className="detail-card">
              <h3>Who submitted this?</h3>
              <p>
                <b>Citizen:</b> {detail.citizen?.fullName || detail.submittedBy?.name || 'Registered resident'}
              </p>
              <p>
                <b>Registered account:</b> {detail.submittedBy?.name || 'Not linked / legacy record'}
              </p>
              <p>
                <b>Mobile:</b> {detail.citizen?.mobile || detail.submittedBy?.mobile || '—'}
              </p>
              <p>
                <b>Email:</b> {detail.submittedBy?.email || detail.citizen?.email || '—'}
              </p>
            </div>
            <div className="detail-card">
              <h3>Complaint</h3>
              <p>
                <b>Category:</b> {detail.category?.replaceAll('_', ' ') || '—'}
              </p>
              <p>
                <b>Priority:</b> {detail.priority || '—'}
              </p>
              <p>
                <b>Status:</b> <StatusPill>{detail.status}</StatusPill>
              </p>
              <p>
                <b>Created:</b> {detail.createdAt ? new Date(detail.createdAt).toLocaleString('en-IN') : '—'}
              </p>
              <p>
                <b>Location:</b> {detail.location || '—'}
              </p>
              <p>
                <b>Problem:</b> {detail.description || '—'}
              </p>
            </div>
            <div className="detail-card">
              <h3>Assignment</h3>
              <p>
                <b>Ward:</b>{' '}
                {detail.ward?.wardNumber || detail.house?.area?.ward?.wardNumber || '—'}
                {detail.ward?.name || detail.house?.area?.ward?.name
                  ? ` · ${detail.ward?.name || detail.house?.area?.ward?.name}`
                  : ''}
              </p>
              <p>
                <b>Nagarsevak:</b>{' '}
                {detail.assignedNagarsevak?.name || detail.assignedEmployee?.manager?.name || 'Not assigned'}
              </p>
              <p>
                <b>Employee:</b> {detail.assignedEmployee?.User?.name || 'Not assigned'}
              </p>
              <p>
                <b>Resolution:</b> {detail.resolutionNote || '—'}
              </p>
            </div>
          </div>

          {/* Photos Uploaded by Resident & After-Work Photos */}
          {(() => {
            const reportedPhotos = parseComplaintImages(detail.reportedImages || detail.reportedImage);
            const resolutionPhotos = parseComplaintImages(detail.resolutionImages || detail.resolutionImage);
            const canUpdate = canUpdateComplaint(detail);
            return (
              <>
                <div className="detail-card complaint-photo-block" style={{ marginTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                      Images Uploaded by Resident (Problem Photos)
                    </h3>
                    <span
                      style={{
                        background: reportedPhotos.length ? '#f0f4f8' : '#f8fafc',
                        color: reportedPhotos.length ? '#1e293b' : '#64748b',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      {reportedPhotos.length ? `${reportedPhotos.length} photo${reportedPhotos.length > 1 ? 's' : ''}` : 'No photos attached'}
                    </span>
                  </div>
                  {reportedPhotos.length ? (
                    <div className="image-grid photo-preview-grid">
                      {reportedPhotos.map((src, idx) => (
                        <div
                          key={idx}
                          className="complaint-photo-item"
                          onClick={() => setPreviewImage({ src, title: `Problem photo #${idx + 1} (${detail.complaintNumber})` })}
                        >
                          <div className="photo-label">Problem Photo #{idx + 1}</div>
                          <img src={src} alt={`Problem photo ${idx + 1}`} />
                          <div className="photo-zoom-hint">Tap to enlarge</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ margin: '6px 0 0', fontSize: '12px' }}>
                      Citizen did not upload any images when filing this complaint.
                    </p>
                  )}
                </div>

                {/* Photos Uploaded After Work by Employee / Nagarsevak */}
                <div
                  className="detail-card complaint-photo-block"
                  style={{
                    marginTop: '14px',
                    borderColor: resolutionPhotos.length ? '#bbf7d0' : '#e2e8f0',
                    background: resolutionPhotos.length ? '#f0fdf4' : '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                      After-Work Images (Employee / Nagarsevak)
                    </h3>
                    <span
                      style={{
                        background: resolutionPhotos.length ? '#dcfce7' : '#f8fafc',
                        color: resolutionPhotos.length ? '#166534' : '#64748b',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        border: resolutionPhotos.length ? '1px solid #86efac' : '1px solid #e2e8f0'
                      }}
                    >
                      {resolutionPhotos.length ? `${resolutionPhotos.length} completion photo${resolutionPhotos.length > 1 ? 's' : ''}` : 'Work completion pending'}
                    </span>
                  </div>
                  {resolutionPhotos.length ? (
                    <div className="image-grid photo-preview-grid">
                      {resolutionPhotos.map((src, idx) => (
                        <div
                          key={idx}
                          className="complaint-photo-item"
                          onClick={() => setPreviewImage({ src, title: `Work Completed Photo #${idx + 1} (${detail.complaintNumber})` })}
                        >
                          <div className="photo-label" style={{ color: '#166534', background: '#dcfce7' }}>
                            Work Completed #{idx + 1}
                          </div>
                          <img src={src} alt={`Completed work ${idx + 1}`} />
                          <div className="photo-zoom-hint">Tap to enlarge</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
                      <p className="muted" style={{ margin: 0, fontSize: '12px' }}>
                        No after-work photos uploaded yet. Field employee or Nagarsevak can upload photos during status update.
                      </p>
                      {canUpdate && (
                        <button
                          type="button"
                          className="small-btn primary-btn"
                          onClick={() => initUpdateComplaint(detail)}
                        >
                          Upload Work Photos
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          <div className="detail-card" style={{ marginTop: '14px' }}>
            <h3>Activity timeline</h3>
            <div className="complaint-timeline">
              {(detail.history || []).length ? (
                (detail.history || [])
                  .slice()
                  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                  .map((h, i) => (
                    <div className="timeline-item" key={h.id || i}>
                      <strong>{h.newStatus?.replaceAll('_', ' ') || 'Updated'}</strong>
                      <small>
                        {new Date(h.createdAt).toLocaleString('en-IN')} · {h.changedBy?.name || 'System'}
                      </small>
                      <div>{h.comment || 'Status updated'}</div>
                    </div>
                  ))
              ) : (
                <div className="muted">No activity recorded.</div>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button className="ghost-btn" onClick={() => setDetail(null)}>
              Close
            </button>
            {canUpdateComplaint(detail) && (
              <button
                type="button"
                className="primary-btn"
                style={{ background: '#2563eb', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => initUpdateComplaint(detail)}
              >
                Update Status
              </button>
            )}
            <button
              className="ghost-btn"
              onClick={() => {
                setDetail(null);
                navigate(`/complaints?open=${detail.id}`);
              }}
            >
              Open in Complaints Board →
            </button>
          </div>
        </Modal>
      )}

      {/* Update Complaint Status Modal */}
      {updatingComplaint && (
        <Modal
          wide
          title={`Update Status · ${updatingComplaint.complaintNumber}`}
          onClose={() => setUpdatingComplaint(null)}
        >
          <form className="form-grid admin-form" onSubmit={handleSaveStatus}>
            <div className="form-section-title span-2">
              <strong>Status & Resolution Update</strong>
              <span>
                Current status:{' '}
                <StatusPill>{updatingComplaint.status}</StatusPill> · Update status, add notes, and upload work completion photos.
              </span>
            </div>

            <Field label="New Status *">
              <select
                value={updateForm.status}
                onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                required
              >
                {getAllowedStatuses(updatingComplaint.status).map((st) => (
                  <option key={st} value={st}>
                    {st.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </Field>

            <Field className="span-2" label="Progress note / comment">
              <textarea
                placeholder="Describe current status, actions taken, or progress updates…"
                rows={2}
                value={updateForm.comment}
                onChange={(e) => setUpdateForm({ ...updateForm, comment: e.target.value })}
              />
            </Field>

            <Field
              className="span-2"
              label={`Resolution note ${updateForm.status === 'RESOLVED' ? '*' : '(optional)'}`}
            >
              <textarea
                required={updateForm.status === 'RESOLVED'}
                placeholder={
                  updateForm.status === 'RESOLVED'
                    ? 'Mandatory: Explain how the problem was resolved…'
                    : 'Notes on final resolution or work performed…'
                }
                rows={3}
                value={updateForm.resolutionNote}
                onChange={(e) => setUpdateForm({ ...updateForm, resolutionNote: e.target.value })}
              />
            </Field>

            <div className="span-2">
              <MultiImageField
                max={5}
                label="After-work / resolution photos from Employee/Nagarsevak (max 5)"
                values={updateForm.resolutionImages || []}
                onChange={(v) => setUpdateForm({ ...updateForm, resolutionImages: v })}
                cameraLabel="Take work photo"
              />
            </div>

            <div className="modal-actions span-2">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setUpdatingComplaint(null)}
                disabled={updateBusy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-btn"
                disabled={updateBusy}
                style={{ background: '#2563eb', color: '#fff' }}
              >
                {updateBusy ? 'Saving update…' : 'Save Status Update'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Image Lightbox Preview Modal */}
      {previewImage && (
        <Modal
          title={previewImage.title || 'Image Preview'}
          onClose={() => setPreviewImage(null)}
        >
          <div style={{ textAlign: 'center', padding: '12px' }}>
            <img
              src={previewImage.src}
              alt={previewImage.title || 'Preview'}
              style={{
                maxWidth: '100%',
                maxHeight: '68vh',
                borderRadius: '12px',
                objectFit: 'contain',
                boxShadow: '0 8px 30px rgba(0,0,0,0.18)'
              }}
            />
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <a
                href={previewImage.src}
                target="_blank"
                rel="noreferrer"
                className="small-btn primary-btn"
              >
                Open full size in new tab
              </a>
              <button
                type="button"
                className="small-btn ghost-btn"
                onClick={() => setPreviewImage(null)}
              >
                Close preview
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Citizen Complete Profile Modal */}
      {citizenDetail && (() => {
        const activeEv = citizenDetail._activeEvent;
        const isSolemn = activeEv?.kind === 'DAHAVA' || activeEv?.kind === 'ANNIVERSARY';
        const directionsUrl = getCitizenDirectionsUrl(citizenDetail);

        return (
          <Modal
            wide
            title={`${citizenDetail.fullName} · Complete Citizen Profile`}
            onClose={() => setCitizenDetail(null)}
          >
            {activeEv && (
              <div
                className={`citizen-event-banner banner-${activeEv.kind?.toLowerCase()}`}
                style={{
                  padding: '10px 14px',
                  marginBottom: '16px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  background: activeEv.kind === 'BIRTHDAY' ? '#eff6ff' : '#f8fafc',
                  border: `1px solid ${activeEv.kind === 'BIRTHDAY' ? '#bfdbfe' : '#cbd5e1'}`,
                  color: activeEv.kind === 'BIRTHDAY' ? '#1d4ed8' : '#334155',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '14px' }}>
                  <span>
                    {activeEv.kind === 'BIRTHDAY'
                      ? "Today's Birthday (वाढदिवस)"
                      : activeEv.kind === 'DAHAVA'
                      ? "Today's 10th Day Observance · दहावा (भावपूर्ण श्रद्धांजली)"
                      : "Today's 1st Year Remembrance · वर्षश्राद्ध (प्रथम पुण्यस्मरण)"}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {activeEv.house ? `House ${activeEv.house}` : 'House record'}
                  </span>
                  {directionsUrl && (
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="small-btn view-btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        textDecoration: 'none',
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: '#ffffff',
                      }}
                      title="Open GPS Directions in Google Maps"
                    >
                      Directions
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="detail-grid citizen-profile-grid">
              <div className="detail-card">
                <h3>Personal Details</h3>
                <p><b>Full Name:</b> {citizenDetail.fullName}</p>
                <p><b>Mobile:</b> {citizenDetail.mobile || '—'}</p>
                {citizenDetail.alternateMobile && <p><b>Alternate Mobile:</b> {citizenDetail.alternateMobile}</p>}
                <p><b>Date of Birth:</b> {citizenDetail.dob || '—'}</p>
                <p><b>Age:</b> {citizenDetail.age != null ? `${citizenDetail.age} years` : '—'}</p>
                <p><b>Gender:</b> {citizenDetail.gender || '—'}</p>
                {citizenDetail.bloodGroup && <p><b>Blood Group:</b> {citizenDetail.bloodGroup}</p>}
                <p><b>Email:</b> {citizenDetail.email || '—'}</p>
                {citizenDetail.presenceStatus && (
                  <p><b>Current Residence:</b> {citizenDetail.presenceStatus === 'OUT_OF_CITY' ? `Out of city (${citizenDetail.currentCity || 'Other'})` : 'At home'}</p>
                )}
              </div>

              <div className="detail-card">
                <h3>Residence & Ward</h3>
                <p><b>House Number:</b> {citizenDetail.family?.house?.houseNumber || activeEv?.house || '—'}</p>
                {citizenDetail.family?.house?.apartment?.name && (
                  <p><b>Apartment / Society:</b> {citizenDetail.family.house.apartment.name}</p>
                )}
                <p><b>Colony / Area:</b> {citizenDetail.family?.house?.area?.name || '—'}</p>
                <p><b>Ward:</b> {citizenDetail.family?.house?.area?.ward?.wardNumber ? `Ward ${citizenDetail.family.house.area.ward.wardNumber}` : '—'}{citizenDetail.family?.house?.area?.ward?.name ? ` · ${citizenDetail.family.house.area.ward.name}` : ''}</p>
                <p><b>Address:</b> {citizenDetail.family?.house?.address || activeEv?.address || '—'}</p>
                {citizenDetail.family?.house?.landmark && (
                  <p><b>Landmark:</b> {citizenDetail.family.house.landmark}</p>
                )}
                {(citizenDetail.family?.house?.latitude || activeEv?.latitude) && (
                  <p><b>GPS Coordinates:</b> {citizenDetail.family?.house?.latitude || activeEv?.latitude}, {citizenDetail.family?.house?.longitude || activeEv?.longitude}</p>
                )}
                {directionsUrl && (
                  <div style={{ marginTop: '10px' }}>
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="small-btn view-btn"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontWeight: 600 }}
                    >
                      Open Location / Directions on Map
                    </a>
                  </div>
                )}
              </div>

              <div className="detail-card">
                <h3>Voter & Occupation</h3>
                <p><b>Voter Status:</b> <StatusPill>{citizenDetail.voterProfile?.status || 'NOT_SPECIFIED'}</StatusPill></p>
                {citizenDetail.voterProfile?.officialVoterIdRef && (
                  <p><b>Voter ID / EPIC:</b> {citizenDetail.voterProfile.officialVoterIdRef}</p>
                )}
                {citizenDetail.voterProfile?.votingWard && (
                  <p><b>Voting Ward:</b> {citizenDetail.voterProfile.votingWard}</p>
                )}
                <p><b>Family Name:</b> {citizenDetail.family?.familyName || '—'}</p>
                {citizenDetail.family?.nativeVillage && (
                  <p><b>Native Village:</b> {citizenDetail.family.nativeVillage}</p>
                )}
                <p><b>Occupation:</b> {citizenDetail.occupationType === 'BUSINESS' ? `Business · ${citizenDetail.businessName || '—'}` : citizenDetail.occupationType === 'SERVICE' ? `Service · ${citizenDetail.companyName || '—'}` : (citizenDetail.occupation || '—')}</p>
              </div>
            </div>

            {citizenDetail.family?.members && citizenDetail.family.members.length > 1 && (
              <div className="detail-card" style={{ marginTop: '14px' }}>
                <h3>Family Members ({citizenDetail.family.members.length})</h3>
                <div className="member-grid">
                  {citizenDetail.family.members.map((m) => (
                    <div className="member-card" key={m.id}>
                      <strong>{m.fullName}</strong>
                      <span>{m.age != null ? `${m.age} yrs` : ''} {m.mobile ? `· ${m.mobile}` : ''}</span>
                      <span>{m.gender || ''} · {m.relationWithHead || 'Member'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions citizen-modal-actions" style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
              <button type="button" className="ghost-btn" onClick={() => setCitizenDetail(null)}>
                Close
              </button>

              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="small-btn view-btn citizen-directions-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    border: '1px solid #0284c7',
                    background: '#f0f9ff',
                    color: '#0369a1',
                  }}
                  title="Navigate to citizen residence with Google Maps"
                >
                  Directions
                </a>
              )}

              <button
                type="button"
                className="primary-btn citizen-wa-action-btn"
                style={{
                  background: isSolemn ? '#334155' : '#059669',
                  borderColor: isSolemn ? '#1e293b' : '#047857',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  color: '#ffffff',
                }}
                onClick={() => {
                  const evToSend = activeEv ? {
                    ...activeEv,
                    name: activeEv.name || citizenDetail.fullName,
                    mobile: activeEv.mobile || citizenDetail.mobile || citizenDetail.alternateMobile,
                    personId: citizenDetail.id || activeEv.personId,
                    house: activeEv.house || citizenDetail.family?.house?.houseNumber,
                    address: activeEv.address || citizenDetail.family?.house?.address || citizenDetail.family?.house?.area?.name,
                    latitude: activeEv.latitude || citizenDetail.family?.house?.latitude,
                    longitude: activeEv.longitude || citizenDetail.family?.house?.longitude,
                  } : {
                    name: citizenDetail.fullName,
                    mobile: citizenDetail.mobile || citizenDetail.alternateMobile,
                    personId: citizenDetail.id,
                    house: citizenDetail.family?.house?.houseNumber,
                    address: citizenDetail.family?.house?.address || citizenDetail.family?.house?.area?.name,
                    latitude: citizenDetail.family?.house?.latitude,
                    longitude: citizenDetail.family?.house?.longitude,
                    kind: 'BIRTHDAY',
                  };
                  setCitizenDetail(null);
                  openWhatsapp(evToSend);
                }}
              >
                {isSolemn ? (
                  activeEv?.kind === 'DAHAVA' ? 'Send Condolence Message' : 'Send Remembrance Message'
                ) : (
                  'Send WhatsApp Greeting'
                )}
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* WhatsApp Greeting / Solemn Tribute Card & Message Modal */}
      {whatsappModal && (
        <Modal
          wide
          title={`${whatsappModal.payload.title} · ${whatsappModal.ev.name}`}
          onClose={() => setWhatsappModal(null)}
        >
          <div className="wa-card-modal-content">
            {/* Digital Greeting / Tribute Card Preview */}
            <div className={`wa-greeting-card wa-theme-${whatsappModal.payload.theme}`}>
              <div className="wa-card-header">
                <span className="wa-card-scope">
                  {data?.ward?.wardNumber ? `WARD ${data.ward.wardNumber}` : 'MUNICIPAL WARD'}
                  {data?.ward?.name ? ` · ${data.ward.name.toUpperCase()}` : ''}
                </span>
                <span className="wa-card-badge">{whatsappModal.payload.titleMr}</span>
              </div>

              <div className="wa-card-main">
                <div className="wa-card-kicker">{whatsappModal.payload.cardTitle}</div>
                <h2 className="wa-card-name">{whatsappModal.ev.name}</h2>
                <p className="wa-card-body">{whatsappModal.payload.cardBody}</p>
              </div>

              <div className="wa-card-footer">
                <div className="wa-card-sender">
                  <span className="sender-from">{whatsappModal.payload.isSolemn ? 'सादर प्रणाम:' : 'From:'}</span>
                  <strong>{whatsappModal.payload.senderDisplayName || resolveNagarsevakName(user, data)}</strong>
                  <span className="sender-role">
                    {whatsappModal.payload.senderRole || 'नगरसेवक / Corporator'}
                  </span>
                </div>
                {whatsappModal.ev.house && (
                  <div className="wa-card-loc">
                    <span>House:</span> {whatsappModal.ev.house}
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp Message and Recipient Controls */}
            <div className="wa-controls-panel">
              <div className="wa-input-group">
                <label htmlFor="wa-recipient-phone">
                  <strong>Recipient Mobile Number</strong>
                  <span className="field-hint">
                    {whatsappModal.ev.mobile
                      ? 'Mobile number loaded automatically from citizen record'
                      : 'Enter 10-digit mobile number for WhatsApp'}
                  </span>
                </label>
                <input
                  id="wa-recipient-phone"
                  type="tel"
                  className="wa-phone-input"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div className="wa-input-group">
                <label htmlFor="wa-message-text">
                  <strong>WhatsApp Message Text</strong>
                  <span className="field-hint">
                    {whatsappModal.payload.isSolemn
                      ? 'Solemn condolence text with Nagarsevak sign-off'
                      : 'Customizable greeting text'}
                  </span>
                </label>
                <textarea
                  id="wa-message-text"
                  className="wa-message-textarea"
                  rows={5}
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                />
              </div>

              <div className="modal-actions wa-action-row">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setWhatsappModal(null)}
                >
                  Close
                </button>
                {getCitizenDirectionsUrl(whatsappModal.ev) && (
                  <a
                    href={getCitizenDirectionsUrl(whatsappModal.ev)}
                    target="_blank"
                    rel="noreferrer"
                    className="ghost-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                    title="Get directions to citizen house"
                  >
                    Directions
                  </a>
                )}
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => openCitizenDetails(whatsappModal.ev)}
                  title="View citizen profile and contact details"
                >
                  View Details
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={handleCopyWhatsapp}
                >
                  {waCopied ? 'Copied to Clipboard' : 'Copy Message'}
                </button>
                <button
                  type="button"
                  className="primary-btn wa-send-btn"
                  style={whatsappModal.payload.isSolemn ? { background: '#334155', borderColor: '#1e293b' } : {}}
                  onClick={handleSendWhatsapp}
                >
                  {whatsappModal.payload.isSolemn ? 'Send Condolence on WhatsApp' : 'Send on WhatsApp'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Edit Schedule Modal */}
      {scheduleModal.isOpen && (
        <Modal
          title={scheduleModal.mode === 'create' ? 'Add Schedule Item' : 'Edit Schedule Item'}
          onClose={() => setScheduleModal({ isOpen: false, mode: 'create', item: null })}
        >
          <form onSubmit={handleSaveSchedule} className="schedule-modal-professional">
            {/* Work Title */}
            <div className="form-field-group">
              <label htmlFor="modal-sched-title">
                <span className="field-title">Work Title / Agenda <span className="req-star">*</span></span>
                <span className="field-subtitle">Specific task, site visit, or meeting agenda</span>
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

            {/* Date and Time Row */}
            <div className="prof-grid-2">
              <div className="form-field-group">
                <label htmlFor="modal-sched-date">
                  <span className="field-title">Scheduled Date <span className="req-star">*</span></span>
                </label>
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
                  <span className="field-title">Scheduled Time</span>
                  <span className="field-subtitle">e.g. 10:30 AM or 16:00</span>
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

            <div className="form-field-group">
              <label htmlFor="modal-sched-assign-to">
                <span className="field-title">Assign this work to</span>
              </label>
              <select
                id="modal-sched-assign-to"
                className="prof-select"
                value={scheduleForm.assignTo || 'NAGARSEVAK'}
                onChange={(e) => setScheduleForm({
                  ...scheduleForm,
                  assignTo: e.target.value,
                  assignedEmployeeUserId: e.target.value === 'EMPLOYEE' ? scheduleForm.assignedEmployeeUserId : '',
                })}
              >
                <option value="NAGARSEVAK">Nagarsevak</option>
                <option value="EMPLOYEE">Employee</option>
              </select>
            </div>
            {scheduleForm.assignTo === 'EMPLOYEE' && (
              <div className="form-field-group">
                <label htmlFor="modal-sched-assign">
                  <span className="field-title">Employee</span>
                </label>
                <select
                  id="modal-sched-assign"
                  className="prof-select"
                  value={scheduleForm.assignedEmployeeUserId || ''}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, assignedEmployeeUserId: e.target.value })}
                >
                  <option value="">{scheduleEmployees.length ? 'Select employee' : 'No employees in this ward'}</option>
                  {scheduleEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Priority and Location Row */}
            <div className="prof-grid-2">
              <div className="form-field-group">
                <label htmlFor="modal-sched-priority">
                  <span className="field-title">Priority <span className="req-star">*</span></span>
                </label>
                <select
                  id="modal-sched-priority"
                  className="prof-select"
                  value={scheduleForm.priority}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, priority: e.target.value })}
                >
                  {SCHEDULE_PRIORITIES.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field-group">
                <label htmlFor="modal-sched-location">
                  <span className="field-title">Location / Colony / Landmark</span>
                </label>
                <input
                  id="modal-sched-location"
                  className="prof-input"
                  type="text"
                  placeholder="e.g. Shanti Nagar Main Road, Near Water Tank"
                  value={scheduleForm.location}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                />
              </div>
            </div>

            {/* Detailed Notes */}
            <div className="form-field-group">
              <label htmlFor="modal-sched-desc">
                <span className="field-title">Action Notes & Deliverables (Optional)</span>
                <span className="field-subtitle">Key discussion points, citizen attendees, or specific instructions</span>
              </label>
              <textarea
                id="modal-sched-desc"
                className="prof-textarea"
                rows={2}
                placeholder="Enter any additional details or background..."
                value={scheduleForm.description}
                onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
              />
            </div>

            <div className="prof-modal-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setScheduleModal({ isOpen: false, mode: 'create', item: null })}
                disabled={scheduleSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-btn"
                disabled={scheduleSaving}
              >
                {scheduleSaving ? 'Saving…' : scheduleModal.mode === 'create' ? 'Add to Schedule' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {scheduleAssign.open && (
        <Modal
          title="Reassign / Move work"
          onClose={() => setScheduleAssign({ open: false, item: null, assignTo: 'EMPLOYEE', assignedEmployeeUserId: '' })}
        >
          <form onSubmit={handleSaveScheduleAssign} className="schedule-modal-professional">
            <p className="field-subtitle">{scheduleAssign.item?.title}</p>
            <div className="form-field-group">
              <label>
                <span className="field-title">Move to</span>
              </label>
              <select
                className="prof-select"
                value={scheduleAssign.assignTo}
                onChange={(e) => setScheduleAssign({ ...scheduleAssign, assignTo: e.target.value })}
              >
                <option value="NAGARSEVAK">Nagarsevak</option>
                <option value="EMPLOYEE">Employee</option>
              </select>
            </div>
            {scheduleAssign.assignTo === 'EMPLOYEE' && (
              <div className="form-field-group">
                <label>
                  <span className="field-title">Employee</span>
                </label>
                <select
                  className="prof-select"
                  value={scheduleAssign.assignedEmployeeUserId}
                  onChange={(e) => setScheduleAssign({ ...scheduleAssign, assignedEmployeeUserId: e.target.value })}
                >
                  <option value="">{scheduleEmployees.length ? 'Select employee' : 'No employees in this ward'}</option>
                  {scheduleEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="prof-modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setScheduleAssign({ open: false, item: null, assignTo: 'EMPLOYEE', assignedEmployeeUserId: '' })}>Cancel</button>
              <button type="submit" className="primary-btn" disabled={scheduleAssigning}>{scheduleAssigning ? 'Moving…' : 'Move work'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
