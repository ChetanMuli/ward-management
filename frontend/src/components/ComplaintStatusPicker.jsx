import React, { useState, useRef, useEffect } from 'react';

export const COMPLAINT_STATUS_META = {
  SUBMITTED: {
    key: 'SUBMITTED',
    label: 'Submitted',
    icon: '📝',
    color: '#475569',
    bgColor: '#f1f5f9',
    borderColor: '#cbd5e1',
    badgeBg: '#e2e8f0',
    dotColor: '#64748b',
    description: 'New complaint reported by citizen; awaiting initial review'
  },
  PENDING: {
    key: 'PENDING',
    label: 'Pending',
    icon: '⏳',
    color: '#b45309',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    badgeBg: '#fef3c7',
    dotColor: '#f59e0b',
    description: 'Under review; awaiting action plan or employee assignment'
  },
  ASSIGNED: {
    key: 'ASSIGNED',
    label: 'Assigned',
    icon: '👤',
    color: '#1d4ed8',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    badgeBg: '#dbeafe',
    dotColor: '#3b82f6',
    description: 'Assigned to field employee or Nagarsevak for field execution'
  },
  IN_PROGRESS: {
    key: 'IN_PROGRESS',
    label: 'In Progress',
    icon: '⚙️',
    color: '#6d28d9',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    badgeBg: '#ede9fe',
    dotColor: '#8b5cf6',
    description: 'Repairs or ground work is actively underway'
  },
  RESOLVED: {
    key: 'RESOLVED',
    label: 'Resolved',
    icon: '✅',
    color: '#15803d',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    badgeBg: '#dcfce7',
    dotColor: '#22c55e',
    description: 'Work completed; after-work photos and resolution note required'
  },
  REOPENED: {
    key: 'REOPENED',
    label: 'Reopened',
    icon: '🔄',
    color: '#c2410c',
    bgColor: '#fff7ed',
    borderColor: '#fed7aa',
    badgeBg: '#ffedd5',
    dotColor: '#f97316',
    description: 'Issue reported unresolved; reopened for further investigation'
  },
  CLOSED: {
    key: 'CLOSED',
    label: 'Closed',
    icon: '🔒',
    color: '#334155',
    bgColor: '#f8fafc',
    borderColor: '#cbd5e1',
    badgeBg: '#e2e8f0',
    dotColor: '#475569',
    description: 'Complaint verified and officially closed'
  }
};

export function getAllowedComplaintStatuses(currentStatus, isEmp = false) {
  if (isEmp) {
    if (currentStatus === 'ASSIGNED') return ['ASSIGNED', 'IN_PROGRESS'];
    if (currentStatus === 'IN_PROGRESS') return ['IN_PROGRESS', 'RESOLVED'];
    if (currentStatus === 'REOPENED') return ['REOPENED', 'IN_PROGRESS', 'RESOLVED'];
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
}

export default function ComplaintStatusPicker({
  value,
  onChange,
  currentStatus,
  isEmployee = false,
  label = 'Complaint Status'
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const allowedStatuses = getAllowedComplaintStatuses(currentStatus || value, isEmployee);
  const activeMeta = COMPLAINT_STATUS_META[value] || COMPLAINT_STATUS_META.SUBMITTED;

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [open]);

  // Handle keyboard escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="status-picker-wrapper" ref={containerRef}>
      <div className="status-picker-head">
        <label className="status-picker-label">
          {label} <span className="status-required-dot">*</span>
        </label>
        <span className="status-current-badge">
          Current: <strong>{(currentStatus || value).replaceAll('_', ' ')}</strong>
        </span>
      </div>

      {/* Quick-select segmented pills for fast 1-click status change */}
      <div className="status-quick-pills" role="radiogroup" aria-label="Quick select status">
        {allowedStatuses.map((st) => {
          const meta = COMPLAINT_STATUS_META[st] || {};
          const isSelected = value === st;
          const isCurrent = currentStatus === st;
          return (
            <button
              key={st}
              type="button"
              className={`quick-status-chip ${isSelected ? 'is-selected' : ''}`}
              style={{
                '--chip-color': meta.color || '#334155',
                '--chip-bg': isSelected ? meta.bgColor || '#eff6ff' : '#ffffff',
                '--chip-border': isSelected ? meta.color || '#2563eb' : '#e2e8f0'
              }}
              onClick={() => {
                onChange(st);
                setOpen(false);
              }}
            >
              <span className="chip-icon">{meta.icon}</span>
              <span className="chip-label">{meta.label}</span>
              {isCurrent && <span className="chip-current-dot" title="Current status" />}
              {isSelected && <span className="chip-check">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Interactive Trigger Box with rich info */}
      <div
        className={`status-trigger-card ${open ? 'is-active' : ''}`}
        tabIndex={0}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(!open);
          }
        }}
        style={{
          '--active-color': activeMeta.color,
          '--active-bg': activeMeta.bgColor,
          '--active-border': activeMeta.borderColor
        }}
      >
        <div className="status-trigger-badge">
          <span className="trigger-icon">{activeMeta.icon}</span>
          <span className="trigger-dot" style={{ backgroundColor: activeMeta.dotColor }} />
        </div>

        <div className="status-trigger-info">
          <div className="status-trigger-title-row">
            <strong className="status-trigger-title" style={{ color: activeMeta.color }}>
              {activeMeta.label}
            </strong>
            {currentStatus && value === currentStatus && (
              <span className="status-trigger-tag">Unchanged</span>
            )}
            {currentStatus && value !== currentStatus && (
              <span className="status-trigger-tag tag-new">Target status</span>
            )}
          </div>
          <p className="status-trigger-desc">{activeMeta.description}</p>
        </div>

        <div className="status-trigger-arrow" aria-hidden="true">
          <span className={`chevron-arrow ${open ? 'arrow-up' : 'arrow-down'}`}>▼</span>
        </div>
      </div>

      {/* Rich Dropdown Menu */}
      {open && (
        <div className="status-picker-dropdown" role="listbox">
          <div className="dropdown-section-title">
            <span>Select Next Status</span>
            <small>Allowed workflow transitions</small>
          </div>

          <div className="dropdown-options-list">
            {allowedStatuses.map((st) => {
              const meta = COMPLAINT_STATUS_META[st] || {};
              const isSelected = value === st;
              const isCurrent = currentStatus === st;

              return (
                <div
                  key={st}
                  role="option"
                  aria-selected={isSelected}
                  className={`status-dropdown-option ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    onChange(st);
                    setOpen(false);
                  }}
                  style={{
                    '--opt-color': meta.color,
                    '--opt-bg': meta.bgColor
                  }}
                >
                  <div className="opt-icon-badge" style={{ backgroundColor: meta.badgeBg, color: meta.color }}>
                    <span>{meta.icon}</span>
                  </div>

                  <div className="opt-content">
                    <div className="opt-title-row">
                      <span className="opt-name" style={{ color: meta.color, fontWeight: isSelected ? 800 : 700 }}>
                        {meta.label}
                      </span>
                      {isCurrent && <span className="opt-current-badge">Current</span>}
                    </div>
                    <span className="opt-desc">{meta.description}</span>
                  </div>

                  <div className="opt-indicator">
                    {isSelected ? (
                      <span className="opt-selected-check" style={{ color: meta.color }}>
                        ✓
                      </span>
                    ) : (
                      <span className="opt-select-action">Select</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
