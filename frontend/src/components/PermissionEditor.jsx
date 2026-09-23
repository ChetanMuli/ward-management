import React, { useMemo, useState } from 'react';

export const PERMISSION_MODULES = [
  {
    id: 'OVERVIEW',
    title: 'Overview & Ward Info',
    icon: '📊',
    description: 'Dashboard landing, ward profile, official announcements and alerts.',
    items: [
      { id: 'VIEW_DASHBOARD', label: 'View Dashboard', desc: 'Ward summary metrics, KPIs and daily counts', scope: 'READ', locked: true },
      { id: 'VIEW_WARD_INFORMATION', label: 'Ward Profile & Boundaries', desc: 'Ward boundary, demographic info and demographic facts', scope: 'READ' },
      { id: 'VIEW_WARD_UPDATES', label: 'Ward Announcements', desc: 'Official updates, circulars and local public news', scope: 'READ' },
      { id: 'VIEW_NOTIFICATIONS', label: 'System Notifications', desc: 'Internal broadcast alerts and admin messages', scope: 'READ' },
    ],
  },
  {
    id: 'COMPLAINTS',
    title: 'Complaints & Daily Issues',
    icon: '🛠️',
    description: 'Citizen grievance tracking, assignment to staff, and field resolution.',
    items: [
      { id: 'VIEW_COMPLAINTS', label: 'View Complaints', desc: 'Browse and search all complaints filed in the ward', scope: 'READ' },
      { id: 'CREATE_COMPLAINTS', label: 'Register Complaints', desc: 'File new complaints on behalf of ward citizens', scope: 'WRITE' },
      { id: 'EDIT_COMPLAINTS', label: 'Update & Resolve', desc: 'Change progress status, add notes and upload proof photos', scope: 'WRITE' },
      { id: 'ASSIGN_COMPLAINTS', label: 'Assign Staff', desc: 'Delegate complaints to specific field employees', scope: 'ADMIN' },
      { id: 'DELETE_COMPLAINTS', label: 'Delete Complaints', desc: 'Permanently remove duplicate, invalid or spam complaints', scope: 'DELETE' },
    ],
  },
  {
    id: 'PROPERTIES',
    title: 'Houses, Families & Citizens',
    icon: '🏠',
    description: 'Ward geographic survey, houses, apartments, family units and residents.',
    items: [
      { id: 'VIEW_HOUSES', label: 'View Houses', desc: 'Browse residential and commercial buildings', scope: 'READ' },
      { id: 'CREATE_HOUSES', label: 'Add Houses', desc: 'Register new house / building addresses and GPS', scope: 'WRITE' },
      { id: 'EDIT_HOUSES', label: 'Edit Houses', desc: 'Modify house address, landmark, colony and building name', scope: 'WRITE' },
      { id: 'DELETE_HOUSES', label: 'Delete Houses', desc: 'Remove house records from ward registry', scope: 'DELETE' },
      { id: 'VIEW_FAMILIES', label: 'View Families', desc: 'Browse family heads and household member trees', scope: 'READ' },
      { id: 'CREATE_FAMILIES', label: 'Add Families', desc: 'Register new household units and ration card info', scope: 'WRITE' },
      { id: 'EDIT_FAMILIES', label: 'Edit Families', desc: 'Update head of family, ration category, and details', scope: 'WRITE' },
      { id: 'DELETE_FAMILIES', label: 'Delete Families', desc: 'Remove family units from ward registry', scope: 'DELETE' },
      { id: 'VIEW_CITIZENS', label: 'View Citizens', desc: 'Search and browse resident profiles in the ward', scope: 'READ' },
      { id: 'CREATE_CITIZENS', label: 'Add Citizens', desc: 'Enroll new citizens and family members', scope: 'WRITE' },
      { id: 'EDIT_CITIZENS', label: 'Edit Citizens', desc: 'Update mobile number, education, occupation and details', scope: 'WRITE' },
      { id: 'DELETE_CITIZENS', label: 'Delete Citizens', desc: 'Remove resident profiles from ward directory', scope: 'DELETE' },
    ],
  },
  {
    id: 'ELECTIONS',
    title: 'Elections & Voter Directory',
    icon: '🗳️',
    description: 'Voter search, 18+ first-time voters, birthday records, and voter lists.',
    items: [
      { id: 'VIEW_VOTERS', label: 'Search Voters', desc: 'Search voters by EPIC number, name, booth or age', scope: 'READ' },
      { id: 'EDIT_VOTERS', label: 'Edit Voter Info', desc: 'Update voter phone, occupation, party leaning and notes', scope: 'WRITE' },
      { id: 'VIEW_18PLUS', label: '18+ First-Time Voters', desc: 'Track upcoming and newly turned 18 eligible voters', scope: 'READ' },
      { id: 'EDIT_18PLUS', label: 'Update 18+ Status', desc: 'Log voter registration follow-up and verification calls', scope: 'WRITE' },
      { id: 'VIEW_BIRTHDAYS', label: 'Birthday Greetings', desc: 'Daily birthday lists for phone/SMS greetings and outreach', scope: 'READ' },
      { id: 'VIEW_GOVERNMENT_VOTER_LISTS', label: 'Govt Voter Lists', desc: 'Browse official uploaded electoral rolls and booth PDFs', scope: 'READ' },
      { id: 'CREATE_GOVERNMENT_VOTER_LISTS', label: 'Upload Voter Rolls', desc: 'Upload scanned or digital electoral rolls', scope: 'WRITE' },
      { id: 'VIEW_ELECTION_DATA', label: 'Booth & Election Data', desc: 'Historical booth statistics, past voting and trends', scope: 'READ' },
    ],
  },
  {
    id: 'WELFARE',
    title: 'Welfare & Public Services',
    icon: '🤝',
    description: 'Government schemes, beneficiaries, and public health/death registers.',
    items: [
      { id: 'VIEW_SCHEMES', label: 'View Schemes', desc: 'Browse state and central welfare schemes', scope: 'READ' },
      { id: 'CREATE_SCHEMES', label: 'Add Schemes', desc: 'Publish new public assistance and benefits scheme', scope: 'WRITE' },
      { id: 'EDIT_SCHEMES', label: 'Edit Schemes', desc: 'Update scheme eligibility criteria and required documents', scope: 'WRITE' },
      { id: 'DELETE_SCHEMES', label: 'Delete Schemes', desc: 'Remove welfare schemes from ward portal', scope: 'DELETE' },
      { id: 'VIEW_DEATH_RECORDS', label: 'View Death Records', desc: 'Browse deceased citizens register and certificates', scope: 'READ' },
      { id: 'CREATE_DEATH_RECORDS', label: 'Log Death Records', desc: 'Record death certificates and dates for official record', scope: 'WRITE' },
    ],
  },
  {
    id: 'CHAT',
    title: 'Community Chat & Messaging',
    icon: '💬',
    description: 'Ward all-chat, direct communication, and custom announcement groups.',
    items: [
      { id: 'VIEW_CHAT', label: 'View Chat & Channels', desc: 'Access ward all-chat and community messaging channels', scope: 'READ' },
      { id: 'SEND_CHAT', label: 'Send Messages & Files', desc: 'Send text messages, photos, videos, and PDFs in chat', scope: 'WRITE' },
      { id: 'CREATE_CHAT_GROUP', label: 'Create Chat Groups', desc: 'Start new ward community, staff, or broadcast groups', scope: 'WRITE' },
      { id: 'MANAGE_CHAT_GROUP', label: 'Manage Groups', desc: 'Add/remove group members and configure group settings', scope: 'ADMIN' },
    ],
  },
  {
    id: 'ADMINISTRATION',
    title: 'Administration & System Control',
    icon: '⚙️',
    description: 'Staff delegation, registered accounts, reports export, audit and bin.',
    adminOnly: true,
    items: [
      { id: 'VIEW_STAFF', label: 'View Ward Staff', desc: 'Browse ward employees, staff list, and assignments', scope: 'READ', adminOnly: true },
      { id: 'CREATE_STAFF', label: 'Create Staff', desc: 'Add new ward employee logins and designations', scope: 'WRITE', adminOnly: true },
      { id: 'EDIT_STAFF', label: 'Edit Staff & Perms', desc: 'Update designations, assigned areas, and permissions', scope: 'WRITE', adminOnly: true },
      { id: 'DELETE_STAFF', label: 'Delete Staff', desc: 'Deactivate or remove employee accounts', scope: 'DELETE', adminOnly: true },
      { id: 'VIEW_USERS', label: 'View Registered Users', desc: 'Browse registered resident login accounts', scope: 'READ', adminOnly: true },
      { id: 'EDIT_USERS', label: 'Edit User Accounts', desc: 'Suspend, reset password, or update resident logins', scope: 'WRITE', adminOnly: true },
      { id: 'DELETE_USERS', label: 'Delete User Accounts', desc: 'Move citizen accounts to recycle bin', scope: 'DELETE', adminOnly: true },
      { id: 'VIEW_WARDS', label: 'View Wards', desc: 'Browse all registered municipal wards and boundaries', scope: 'READ' },
      { id: 'CREATE_WARDS', label: 'Create Wards', desc: 'Register new municipal wards (Master Admin only)', scope: 'ADMIN', masterOnly: true },
      { id: 'EDIT_WARDS', label: 'Edit Ward Info', desc: 'Update ward areas, colonies, and apartments', scope: 'WRITE' },
      { id: 'DELETE_WARDS', label: 'Delete Wards', desc: 'Remove wards from system (Master Admin only)', scope: 'DELETE', masterOnly: true },
      { id: 'EXPORT_DATA', label: 'Export Reports & Excel', desc: 'Download Excel exports of voter & household data', scope: 'WRITE' },
      { id: 'VIEW_AUDIT', label: 'View Audit Trail', desc: 'Security audit logs of all user actions (Master Admin only)', scope: 'READ', masterOnly: true },
      { id: 'VIEW_RECYCLE_BIN', label: 'View Recycle Bin', desc: 'Access deleted records archive and history', scope: 'READ' },
      { id: 'RESTORE_RECYCLE_BIN', label: 'Restore from Bin', desc: 'Recover deleted records back to live database', scope: 'WRITE' },
    ],
  },
];

export const ALL_PERMISSIONS = [...new Set(PERMISSION_MODULES.flatMap(m => m.items.map(i => i.id)))];

export const PRESETS = {
  EMPLOYEE_FIELD: {
    id: 'EMPLOYEE_FIELD',
    label: '⚡ Field Staff (Standard)',
    badge: 'Recommended',
    description: 'Everyday ward worker: Houses, Families, Citizens, Complaints, Voter Search, Chat & Schemes',
    perms: [
      'VIEW_DASHBOARD', 'VIEW_WARD_INFORMATION', 'VIEW_WARD_UPDATES', 'VIEW_NOTIFICATIONS',
      'VIEW_HOUSES', 'CREATE_HOUSES', 'EDIT_HOUSES',
      'VIEW_FAMILIES', 'CREATE_FAMILIES', 'EDIT_FAMILIES',
      'VIEW_CITIZENS', 'CREATE_CITIZENS', 'EDIT_CITIZENS',
      'VIEW_VOTERS', 'VIEW_18PLUS', 'VIEW_BIRTHDAYS',
      'VIEW_COMPLAINTS', 'CREATE_COMPLAINTS', 'EDIT_COMPLAINTS',
      'VIEW_SCHEMES', 'VIEW_DEATH_RECORDS', 'CREATE_DEATH_RECORDS',
      'VIEW_CHAT', 'SEND_CHAT', 'VIEW_RECYCLE_BIN', 'VIEW_WARDS', 'VIEW_ELECTION_DATA'
    ],
  },
  EMPLOYEE_COMPLAINTS: {
    id: 'EMPLOYEE_COMPLAINTS',
    label: '🛠️ Complaints Resolver',
    badge: 'Focused',
    description: 'Handles citizen grievances, field inspection, status updates, photos and chat only',
    perms: [
      'VIEW_DASHBOARD', 'VIEW_WARD_INFORMATION', 'VIEW_NOTIFICATIONS',
      'VIEW_COMPLAINTS', 'CREATE_COMPLAINTS', 'EDIT_COMPLAINTS',
      'VIEW_CHAT', 'SEND_CHAT', 'VIEW_WARDS'
    ],
  },
  EMPLOYEE_SURVEY: {
    id: 'EMPLOYEE_SURVEY',
    label: '📋 Voter Survey & Census',
    badge: 'Data Collection',
    description: 'Door-to-door surveying, voter registry, 18+ new voters, birthdays and house surveys',
    perms: [
      'VIEW_DASHBOARD', 'VIEW_WARD_INFORMATION', 'VIEW_NOTIFICATIONS',
      'VIEW_HOUSES', 'CREATE_HOUSES', 'EDIT_HOUSES',
      'VIEW_FAMILIES', 'CREATE_FAMILIES', 'EDIT_FAMILIES',
      'VIEW_CITIZENS', 'CREATE_CITIZENS', 'EDIT_CITIZENS',
      'VIEW_VOTERS', 'EDIT_VOTERS', 'VIEW_18PLUS', 'EDIT_18PLUS',
      'VIEW_BIRTHDAYS', 'VIEW_GOVERNMENT_VOTER_LISTS',
      'VIEW_CHAT', 'SEND_CHAT', 'VIEW_WARDS'
    ],
  },
  NAGARSEVAK_FULL: {
    id: 'NAGARSEVAK_FULL',
    label: '🏛️ Full Ward Administration',
    badge: 'Complete Access',
    description: 'Complete suite of ward representative operations, complaints assignment and staff management',
    perms: [
      'VIEW_DASHBOARD', 'VIEW_WARD_INFORMATION', 'VIEW_WARD_UPDATES', 'VIEW_NOTIFICATIONS',
      'VIEW_HOUSES', 'CREATE_HOUSES', 'EDIT_HOUSES',
      'VIEW_FAMILIES', 'CREATE_FAMILIES', 'EDIT_FAMILIES',
      'VIEW_CITIZENS', 'CREATE_CITIZENS', 'EDIT_CITIZENS',
      'VIEW_VOTERS', 'VIEW_COMPLAINTS', 'ASSIGN_COMPLAINTS', 'EDIT_COMPLAINTS',
      'VIEW_18PLUS', 'VIEW_BIRTHDAYS', 'EXPORT_DATA', 'VIEW_SCHEMES',
      'VIEW_DEATH_RECORDS', 'CREATE_DEATH_RECORDS', 'VIEW_CHAT', 'SEND_CHAT',
      'VIEW_RECYCLE_BIN', 'RESTORE_RECYCLE_BIN', 'VIEW_USERS', 'VIEW_WARDS',
      'VIEW_ELECTION_DATA', 'VIEW_GOVERNMENT_VOTER_LISTS', 'CREATE_GOVERNMENT_VOTER_LISTS',
      'VIEW_STAFF', 'CREATE_STAFF', 'EDIT_STAFF', 'DELETE_STAFF'
    ],
  },
};

export default function PermissionEditor({ role = 'EMPLOYEE', values = [], onChange, isMasterAdmin = false }) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'GRANTED' | 'RESTRICTED'
  const [collapsedModules, setCollapsedModules] = useState({});

  const safeValues = useMemo(() => {
    return Array.isArray(values) ? values.filter(Boolean) : [];
  }, [values]);

  const isEmp = role === 'EMPLOYEE';
  const isNagar = role === 'NAGARSEVAK';

  // Filter modules and items according to the active role
  const visibleModules = useMemo(() => {
    return PERMISSION_MODULES.map(mod => {
      const items = mod.items.filter(item => {
        if (isEmp && (item.adminOnly || item.masterOnly)) return false;
        if (isNagar && item.masterOnly) return false;
        if (!isMasterAdmin && item.masterOnly) return false;
        return true;
      });
      return { ...mod, items };
    }).filter(mod => mod.items.length > 0);
  }, [isEmp, isNagar, isMasterAdmin]);

  const allAvailablePermissions = useMemo(() => {
    return visibleModules.flatMap(m => m.items.map(i => i.id));
  }, [visibleModules]);

  const grantedCount = useMemo(() => {
    return allAvailablePermissions.filter(p => safeValues.includes(p)).length;
  }, [allAvailablePermissions, safeValues]);

  const restrictedCount = allAvailablePermissions.length - grantedCount;
  const percentGranted = allAvailablePermissions.length > 0
    ? Math.round((grantedCount / allAvailablePermissions.length) * 100)
    : 0;

  // Search & Filter items
  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();

    return visibleModules.map(mod => {
      const matchMod = mod.title.toLowerCase().includes(q) || mod.description.toLowerCase().includes(q);

      const items = mod.items.filter(item => {
        // Status filter: ALL | GRANTED | RESTRICTED
        const isGranted = safeValues.includes(item.id);
        if (filterMode === 'GRANTED' && !isGranted) return false;
        if (filterMode === 'RESTRICTED' && isGranted) return false;

        if (!q) return true;
        return (
          matchMod ||
          item.label.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.scope.toLowerCase().includes(q)
        );
      });

      return { ...mod, items };
    }).filter(mod => mod.items.length > 0);
  }, [visibleModules, safeValues, search, filterMode]);

  function togglePermission(id) {
    if (id === 'VIEW_DASHBOARD') return; // Mandatory default
    if (safeValues.includes(id)) {
      onChange(safeValues.filter(p => p !== id));
    } else {
      onChange([...new Set([...safeValues, id])]);
    }
  }

  function toggleModule(mod) {
    const modItemIds = mod.items.map(i => i.id).filter(id => id !== 'VIEW_DASHBOARD');
    const allSelected = modItemIds.every(id => safeValues.includes(id));
    if (allSelected) {
      onChange(safeValues.filter(p => !modItemIds.includes(p)));
    } else {
      onChange([...new Set([...safeValues, ...modItemIds, 'VIEW_DASHBOARD'])]);
    }
  }

  function toggleCollapse(modId) {
    setCollapsedModules(prev => ({
      ...prev,
      [modId]: !prev[modId],
    }));
  }

  function expandAll() {
    setCollapsedModules({});
  }

  function collapseAll() {
    const all = {};
    visibleModules.forEach(m => { all[m.id] = true; });
    setCollapsedModules(all);
  }

  function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    const clean = preset.perms.filter(p => allAvailablePermissions.includes(p));
    onChange([...new Set(['VIEW_DASHBOARD', ...clean])]);
  }

  function selectAll() {
    onChange([...new Set(['VIEW_DASHBOARD', ...allAvailablePermissions])]);
  }

  function clearAll() {
    onChange(['VIEW_DASHBOARD']);
  }

  // Check if a preset is currently active
  const activePresetKey = useMemo(() => {
    for (const [key, p] of Object.entries(PRESETS)) {
      const needed = p.perms.filter(id => allAvailablePermissions.includes(id));
      if (needed.length === 0) continue;
      const exactMatch =
        needed.length === safeValues.length &&
        needed.every(id => safeValues.includes(id));
      if (exactMatch) return key;
    }
    return null;
  }, [allAvailablePermissions, safeValues]);

  return (
    <div className="perm-v2-container">
      {/* 1. Header Overview & Progress Bar */}
      <div className="perm-v2-header">
        <div className="perm-v2-header-top">
          <div className="perm-v2-title-box">
            <div className="perm-v2-role-tag">
              {isEmp ? '👷‍♂️ FIELD EMPLOYEE' : isNagar ? '🏛️ NAGARSEVAK REPRESENTATIVE' : '🛡️ ADMINISTRATION ACCOUNT'}
            </div>
            <h3 className="perm-v2-title">
              {isEmp ? 'Employee Field Permissions' : isNagar ? 'Nagarsevak Ward Permissions' : 'Account Access Controls'}
            </h3>
            <p className="perm-v2-desc">
              {isEmp
                ? 'Field employees operate under their managing Nagarsevak. Toggle permissions below to grant or restrict specific modules, data records, and field tasks.'
                : isNagar
                ? 'Ward representatives have primary authority over citizen grievances, surveys, census data, and staff delegation.'
                : 'Configure fine-grained module access, edit privileges, and administrative controls for this account.'}
            </p>
          </div>

          <div className="perm-v2-stat-card">
            <div className="perm-v2-stat-number">
              <span className="perm-v2-stat-granted">{grantedCount}</span>
              <span className="perm-v2-stat-total"> / {allAvailablePermissions.length}</span>
            </div>
            <div className="perm-v2-stat-label">Active Permissions ({percentGranted}%)</div>
            <div className="perm-v2-progress-track">
              <div
                className="perm-v2-progress-fill"
                style={{ width: `${percentGranted}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. One-Click Quick Presets */}
        <div className="perm-v2-presets-section">
          <div className="perm-v2-presets-title">
            <span>⚡ Quick Role Presets:</span>
            <small className="perm-v2-presets-hint">Click a preset to instantly apply standard permission sets</small>
          </div>
          <div className="perm-v2-presets-list">
            {isEmp && (
              <>
                <button
                  type="button"
                  className={`perm-v2-preset-pill ${activePresetKey === 'EMPLOYEE_FIELD' ? 'is-active' : ''}`}
                  onClick={() => applyPreset('EMPLOYEE_FIELD')}
                  title={PRESETS.EMPLOYEE_FIELD.description}
                >
                  <span className="perm-v2-pill-icon">⚡</span>
                  <strong>Field Staff (Standard)</strong>
                  <span className="perm-v2-pill-badge">Recommended</span>
                </button>

                <button
                  type="button"
                  className={`perm-v2-preset-pill ${activePresetKey === 'EMPLOYEE_COMPLAINTS' ? 'is-active' : ''}`}
                  onClick={() => applyPreset('EMPLOYEE_COMPLAINTS')}
                  title={PRESETS.EMPLOYEE_COMPLAINTS.description}
                >
                  <span className="perm-v2-pill-icon">🛠️</span>
                  <strong>Complaints Resolver</strong>
                </button>

                <button
                  type="button"
                  className={`perm-v2-preset-pill ${activePresetKey === 'EMPLOYEE_SURVEY' ? 'is-active' : ''}`}
                  onClick={() => applyPreset('EMPLOYEE_SURVEY')}
                  title={PRESETS.EMPLOYEE_SURVEY.description}
                >
                  <span className="perm-v2-pill-icon">📋</span>
                  <strong>Voter & Survey Census</strong>
                </button>
              </>
            )}

            {isNagar && (
              <button
                type="button"
                className={`perm-v2-preset-pill ${activePresetKey === 'NAGARSEVAK_FULL' ? 'is-active' : ''}`}
                onClick={() => applyPreset('NAGARSEVAK_FULL')}
                title={PRESETS.NAGARSEVAK_FULL.description}
              >
                <span className="perm-v2-pill-icon">🏛️</span>
                <strong>Full Ward Administration</strong>
                <span className="perm-v2-pill-badge">All Powers</span>
              </button>
            )}

            <button
              type="button"
              className="perm-v2-preset-pill action-grant"
              onClick={selectAll}
              title="Grant all available permissions to this account"
            >
              <span>✓</span>
              <strong>Grant All</strong>
            </button>

            <button
              type="button"
              className="perm-v2-preset-pill action-revoke"
              onClick={clearAll}
              title="Revoke all permissions except default dashboard landing"
            >
              <span>✕</span>
              <strong>Revoke All</strong>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="perm-v2-controls-bar">
        <div className="perm-v2-search-box">
          <span className="perm-v2-search-icon">🔍</span>
          <input
            type="search"
            className="perm-v2-search-input"
            placeholder="Search permissions (e.g. complaints, voters, chat, delete, export)…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="perm-v2-search-clear"
              onClick={() => setSearch('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Tabs: ALL, GRANTED, RESTRICTED */}
        <div className="perm-v2-filter-tabs">
          <button
            type="button"
            className={`perm-v2-filter-tab ${filterMode === 'ALL' ? 'is-active' : ''}`}
            onClick={() => setFilterMode('ALL')}
          >
            All ({allAvailablePermissions.length})
          </button>
          <button
            type="button"
            className={`perm-v2-filter-tab is-granted ${filterMode === 'GRANTED' ? 'is-active' : ''}`}
            onClick={() => setFilterMode('GRANTED')}
          >
            ✓ Allowed ({grantedCount})
          </button>
          <button
            type="button"
            className={`perm-v2-filter-tab is-restricted ${filterMode === 'RESTRICTED' ? 'is-active' : ''}`}
            onClick={() => setFilterMode('RESTRICTED')}
          >
            ✕ Restricted ({restrictedCount})
          </button>
        </div>

        {/* Global Expand / Collapse */}
        <div className="perm-v2-view-toggles">
          <button
            type="button"
            className="perm-v2-view-btn"
            onClick={expandAll}
            title="Expand all modules"
          >
            ▾ Expand all
          </button>
          <button
            type="button"
            className="perm-v2-view-btn"
            onClick={collapseAll}
            title="Collapse all modules"
          >
            ▴ Collapse all
          </button>
        </div>
      </div>

      {/* 4. Modules List */}
      <div className="perm-v2-modules-list">
        {!filteredModules.length ? (
          <div className="perm-v2-empty">
            <span className="perm-v2-empty-icon">🔍</span>
            <h4>No permissions found</h4>
            <p>
              No permissions match your current filter{' '}
              {search && <strong>"{search}"</strong>}{' '}
              {filterMode !== 'ALL' && <span>with status <strong>{filterMode.toLowerCase()}</strong></span>}.
            </p>
            <button
              type="button"
              className="perm-v2-empty-reset"
              onClick={() => { setSearch(''); setFilterMode('ALL'); }}
            >
              Reset Search & Filters
            </button>
          </div>
        ) : (
          filteredModules.map(mod => {
            const isCollapsed = Boolean(collapsedModules[mod.id]);
            const modItemIds = mod.items.map(i => i.id);
            const activeInMod = modItemIds.filter(id => safeValues.includes(id)).length;
            const allActive = activeInMod === mod.items.length;
            const noneActive = activeInMod === 0;

            return (
              <div
                key={mod.id}
                className={`perm-v2-card ${allActive ? 'is-all-active' : activeInMod > 0 ? 'is-partial' : 'is-none'}`}
              >
                {/* Module Header */}
                <div
                  className="perm-v2-card-header"
                  onClick={() => toggleCollapse(mod.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggleCollapse(mod.id); }}
                >
                  <div className="perm-v2-card-head-left">
                    <span className="perm-v2-card-icon">{mod.icon}</span>
                    <div className="perm-v2-card-titles">
                      <div className="perm-v2-card-title-row">
                        <h4 className="perm-v2-card-title">{mod.title}</h4>
                        <span className="perm-v2-card-count">
                          {mod.items.length} {mod.items.length === 1 ? 'action' : 'actions'}
                        </span>
                      </div>
                      <p className="perm-v2-card-desc">{mod.description}</p>
                    </div>
                  </div>

                  <div className="perm-v2-card-head-right" onClick={e => e.stopPropagation()}>
                    {/* Status Pill */}
                    <span className={`perm-v2-status-pill ${allActive ? 'is-full' : activeInMod > 0 ? 'is-part' : 'is-off'}`}>
                      {allActive ? (
                        <>✓ All {mod.items.length} Allowed</>
                      ) : activeInMod > 0 ? (
                        <>{activeInMod} of {mod.items.length} Allowed</>
                      ) : (
                        <>Restricted (0/{mod.items.length})</>
                      )}
                    </span>

                    {/* Enable/Disable Module Button */}
                    <button
                      type="button"
                      className={`perm-v2-mod-toggle-btn ${allActive ? 'is-active' : ''}`}
                      onClick={() => toggleModule(mod)}
                      title={allActive ? 'Disable all permissions in this module' : 'Enable all permissions in this module'}
                    >
                      {allActive ? 'Disable All' : 'Enable All'}
                    </button>

                    {/* Expand/Collapse Caret */}
                    <button
                      type="button"
                      className="perm-v2-caret-btn"
                      onClick={() => toggleCollapse(mod.id)}
                      aria-label={isCollapsed ? 'Expand module' : 'Collapse module'}
                    >
                      {isCollapsed ? '▼' : '▲'}
                    </button>
                  </div>
                </div>

                {/* Module Items Body */}
                {!isCollapsed && (
                  <div className="perm-v2-card-body">
                    <div className="perm-v2-items-grid">
                      {mod.items.map(item => {
                        const isGranted = safeValues.includes(item.id);
                        const isDashboard = item.id === 'VIEW_DASHBOARD';

                        return (
                          <div
                            key={item.id}
                            className={`perm-v2-item-tile ${isGranted ? 'is-granted' : 'is-restricted'} ${isDashboard ? 'is-locked' : ''}`}
                            onClick={() => togglePermission(item.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') togglePermission(item.id); }}
                          >
                            <div className="perm-v2-item-content">
                              <div className="perm-v2-item-top">
                                <span className="perm-v2-item-label">{item.label}</span>
                                {item.scope && (
                                  <span className={`perm-v2-scope-tag scope-${item.scope.toLowerCase()}`}>
                                    {item.scope === 'READ' ? 'View' : item.scope === 'WRITE' ? 'Create/Edit' : item.scope === 'DELETE' ? 'Delete' : 'Admin'}
                                  </span>
                                )}
                              </div>
                              <p className="perm-v2-item-desc">{item.desc}</p>
                              {isDashboard && (
                                <div className="perm-v2-locked-note">
                                  <span>🔒</span> Mandatory default permission for system login
                                </div>
                              )}
                            </div>

                            <div className="perm-v2-item-action" onClick={e => e.stopPropagation()}>
                              {/* Large Interactive Switch */}
                              <label className={`perm-v2-switch ${isDashboard ? 'is-disabled' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={isGranted}
                                  disabled={isDashboard}
                                  onChange={() => togglePermission(item.id)}
                                />
                                <span className="perm-v2-slider" />
                              </label>
                              <span className={`perm-v2-toggle-state ${isGranted ? 'state-allowed' : 'state-restricted'}`}>
                                {isGranted ? 'ALLOWED' : 'RESTRICTED'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
