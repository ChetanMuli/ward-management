import React, { useEffect, useMemo, useState } from 'react';
import {
  api,
  getUser
} from '../services/api';

import {
  ErrorBox,
  Empty,
  Field,
  FaceAvatar,
  CirclePhotoField,
  Loading,
  Modal,
  StatusPill,
  Toolbar,
  SearchableSelect,
  SearchableMultiSelect,
  PaginationBar,
  RowMenu
} from '../components/Ui';

import WardFilter from '../components/WardFilter';
import { useWardFilter } from '../wardFilter';

import {
  can,
  isMaster,
  isSubMaster,
  isNagarsevak
} from '../rbac';

import PasswordResetModal from '../components/PasswordResetModal';
import PermissionEditor, { ALL_PERMISSIONS } from '../components/PermissionEditor';
import { formatWardLabel } from '../wardFormat';
import TeamNav from '../components/TeamNav';
import { PhoneIcon, UsersIcon, UserCheckIcon, BuildingIcon, ZapIcon, EyeIcon, MapPinIcon, ShieldIcon, LockIcon } from '../components/Icons';


const empty = {
  name: '',
  email: '',
  mobile: '',
  password: '',
  wardId: '',
  wardSeat: '',
  partyName: '',
  officialAddress: '',
  photo: '',
  bio: '',
  officeTimings: '',
  whatsapp: '',
  designation: 'Ward Employee',
  assignedAreaIds: [],
  permissions: [],
  managerUserId: '',
  status: 'ACTIVE'
};

const allPermissions = ALL_PERMISSIONS;


export default function Staff() {

  const user = getUser();

  const master = isMaster(user);
  const sub = isSubMaster(user);
  const councillor = isNagarsevak(user);

  const {
    selectedWardId
  } = useWardFilter();


  const [nagarsevaks, setNagarsevaks] = useState(null);
  const [employees, setEmployees] = useState(null);

  const [wards, setWards] = useState([]);
  const [areas, setAreas] = useState([]);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);


  /*
   * PAGINATION
   */

  const [nMeta, setNMeta] = useState({
    total: 0,
    page: 1,
    limit: 25
  });

  const [eMeta, setEMeta] = useState({
    total: 0,
    page: 1,
    limit: 25
  });

  const [nPage, setNPage] = useState(1);
  const [ePage, setEPage] = useState(1);

  const [nLimit, setNLimit] = useState(25);
  const [eLimit, setELimit] = useState(25);


  /*
   * FULL LISTS
   * Used only for selectors such as
   * Managing Nagarsevak.
   */

  const [allN, setAllN] = useState([]);
  const [allE, setAllE] = useState([]);


  const staffDraft = (()=>{ try { return JSON.parse(sessionStorage.getItem('ward_staff_draft')||'null') } catch { return null; } })();
  const staffEditDraft = (()=>{ try { return JSON.parse(sessionStorage.getItem('ward_staff_edit')||'null') } catch { return null; } })();
  const [tab, setTab] = useState(staffDraft?.tab || (master || sub ? 'NAGARSEVAK' : 'EMPLOYEE'));
  const [edit, setEdit] = useState(staffEditDraft?.new ? 'create' : (staffEditDraft?.id ? {id:staffEditDraft.id} : null));
  const [form, setForm] = useState(staffDraft?.form || {...empty});

  useEffect(()=>{ try { sessionStorage.setItem('ward_staff_draft',JSON.stringify({tab,form})) ; if(edit) sessionStorage.setItem('ward_staff_edit',JSON.stringify({id:edit==='create'?null:edit.id,new:edit==='create'})); else sessionStorage.removeItem('ward_staff_edit'); } catch {} },[tab,form,edit]);
  useEffect(()=>{ if(!(master||sub) && tab!=='EMPLOYEE') setTab('EMPLOYEE'); },[master,sub,tab]);


  const [detail, setDetail] = useState(null);

  const [perm, setPerm] = useState(null);
  const [permValues, setPermValues] = useState([]);
  const [areasModal, setAreasModal] = useState(null);

  const [resetUser, setResetUser] = useState(null);
  const [convertTarget, setConvertTarget] = useState(null);
  const [convertForm, setConvertForm] = useState({ targetRole: 'SOCIAL_WORKER', replacementManagerUserId: '' });

  const [notify, setNotify] = useState(false);

  const [notifyForm, setNotifyForm] = useState({
    targetUserIds: [],
    title: '',
    message: ''
  });


  /*
   * LOAD DATA
   */

  async function load() {

    try {

      setError('');

      const [
        nsResponse,
        employeeResponse,
        allNsResponse,
        allEmployeeResponse,
        wardsResponse
      ] = await Promise.all([

        (master || sub)
          ? api.corporators({
              page: nPage,
              limit: nLimit,
              wardId: selectedWardId || undefined
            })
          : Promise.resolve({
              data: [],
              meta: {
                total: 0,
                page: nPage,
                limit: nLimit
              }
            }),

        api.employees({
          page: ePage,
          limit: eLimit,
          wardId:
            selectedWardId || undefined,
          managerUserId: councillor ? user?.id : undefined
        }),

        (master || sub)
          ? api.corporators({
              page: 1,
              limit: 100,
              wardId:
                selectedWardId || undefined
            })
          : Promise.resolve({
              data: []
            }),

        api.employees({
          page: 1,
          limit: 500,
          wardId:
            selectedWardId || undefined,
          managerUserId: councillor ? user?.id : undefined
        }),

        api.wards()
      ]);


      setNagarsevaks(
        nsResponse?.data || []
      );

      setNMeta(
        nsResponse?.meta || {
          total:
            (nsResponse?.data || []).length,
          page: nPage,
          limit: nLimit
        }
      );


      setEmployees(
        employeeResponse?.data || []
      );

      setEMeta(
        employeeResponse?.meta || {
          total:
            (employeeResponse?.data || []).length,
          page: ePage,
          limit: eLimit
        }
      );


      setAllN(
        allNsResponse?.data || []
      );

      setAllE(
        allEmployeeResponse?.data || []
      );


      const wardList =
        wardsResponse?.data || [];

      setWards(wardList);


      const selectedWard =
        selectedWardId
          ? wardList.find(
              w => String(w.id) === String(selectedWardId)
            )
          : null;


      setAreas(
        selectedWard?.areas || []
      );

    } catch (err) {

      setError(
        err?.message ||
        'Unable to load staff data.'
      );

    }

  }


  useEffect(() => {

    setNPage(1);
    setEPage(1);

  }, [
    selectedWardId,
    master,
    sub
  ]);


  useEffect(() => {

    load();

  }, [
    selectedWardId,
    master,
    sub,
    councillor,
    nPage,
    nLimit,
    ePage,
    eLimit
  ]);


  /*
   * SEARCH & FILTER VALUES
   */
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');

  const visibleN = nagarsevaks || [];

  const visibleE = useMemo(() => {
    return (employees || []).filter(e => {
      if (councillor) {
        return String(e.managerUserId || e.manager?.id || '') === String(user?.id || '');
      }
      if (selectedManagerId) {
        return String(e.managerUserId || e.manager?.id || '') === String(selectedManagerId);
      }
      return true;
    });
  }, [employees, councillor, user?.id, selectedManagerId]);

  const filteredN = useMemo(() => {
    const list = visibleN;
    const q = staffSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(n => {
      const hay = [
        n.name,
        n.email,
        n.mobile,
        n.partyName,
        n.wardSeat,
        n.ward?.wardNumber,
        n.ward?.name,
        n.status
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [visibleN, staffSearch]);

  const filteredE = useMemo(() => {
    const list = visibleE;
    const q = staffSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(e => {
      const hay = [
        e.User?.name,
        e.name,
        e.User?.email,
        e.email,
        e.User?.mobile,
        e.mobile,
        e.designation,
        e.ward?.wardNumber,
        e.ward?.name,
        e.manager?.name,
        e.User?.status,
        e.status
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [visibleE, staffSearch]);

  const nTotal = Number(nMeta?.total || 0);
  const eTotal = Number(eMeta?.total || 0);

  const nStats = useMemo(() => {
    const list = allN?.length ? allN : visibleN;
    return {
      total: nTotal || list.length,
      active: list.filter(n => String(n.status || '').toUpperCase() === 'ACTIVE').length,
      wardActive: list.filter(n => String(n.wardStatus || n.ward?.status || '').toUpperCase() === 'ACTIVE').length,
      visible: list.filter(n => !!n.residentVisible).length
    };
  }, [allN, visibleN, nTotal]);

  const eStats = useMemo(() => {
    const list = allE?.length ? allE : visibleE;
    const filteredList = list.filter(e => {
      if (!councillor) return true;
      return String(e.managerUserId || e.manager?.id || '') === String(user?.id || '');
    });
    return {
      total: eTotal || filteredList.length,
      active: filteredList.filter(e => String(e.User?.status || e.status || '').toUpperCase() === 'ACTIVE').length,
      assignedColonies: filteredList.filter(e => parseAreaIds(e.assignedAreaIds).length > 0).length,
      wardsCovered: new Set(filteredList.map(e => e.wardId || e.ward?.id).filter(Boolean)).size
    };
  }, [allE, visibleE, eTotal, councillor, user?.id]);


  const nPages =
    Math.max(
      1,
      Math.ceil(
        nTotal /
        Number(nMeta?.limit || nLimit || 25)
      )
    );


  const ePages =
    Math.max(
      1,
      Math.ceil(
        eTotal /
        Number(eMeta?.limit || eLimit || 25)
      )
    );


  const nStart =
    nTotal === 0
      ? 0
      : ((nPage - 1) * nLimit) + 1;


  const nEnd =
    Math.min(
      nPage * nLimit,
      nTotal
    );


  const eStart =
    eTotal === 0
      ? 0
      : ((ePage - 1) * eLimit) + 1;


  const eEnd =
    Math.min(
      ePage * eLimit,
      eTotal
    );


  /*
   * WARD OPTIONS
   */

  const wardOptions = useMemo(() => {

    return [...wards].sort(
      (a, b) =>
        String(
          a?.wardNumber ?? ''
        ).localeCompare(
          String(
            b?.wardNumber ?? ''
          ),
          undefined,
          {
            numeric: true,
            sensitivity: 'base'
          }
        )
    );

  }, [wards]);

  const allAreasMap = useMemo(() => {
    const map = new Map();
    (wards || []).forEach(w => {
      (w.areas || []).forEach(a => {
        if (a && a.id) {
          map.set(String(a.id), a.name || a.areaName || `Area #${a.id}`);
        }
      });
    });
    (areas || []).forEach(a => {
      if (a && a.id) {
        map.set(String(a.id), a.name || a.areaName || `Area #${a.id}`);
      }
    });
    (employees || []).forEach(e => {
      if (Array.isArray(e.assignedAreas)) {
        e.assignedAreas.forEach(a => {
          if (a && a.id) {
            map.set(String(a.id), a.name || a.areaName || `Area #${a.id}`);
          }
        });
      }
    });
    return map;
  }, [wards, areas, employees]);

  function parseAreaIds(val) {
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === 'string' && val.trim()) {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch (_) {
        return [];
      }
    }
    return [];
  }

  function getEmployeeAreaLabel(e) {
    const ids = parseAreaIds(e.assignedAreaIds);
    if (!ids.length) return 'All ward areas';
    const names = ids.map(id => allAreasMap.get(String(id)) || `Area #${id}`);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} (+${names.length - 2} more)`;
  }


  const wardForForm =
    wardOptions.find(
      w =>
        String(w.id) ===
        String(form.wardId)
    );


  const formAreas =
    wardForForm?.areas ||
    areas ||
    [];


  /*
   * MANAGER OPTIONS
   */

  const managerOptions =
    (allN || []).filter(
      n =>
        !form.wardId ||
        String(n.wardId) ===
        String(form.wardId)
    );


  const canStaff = master || can('EDIT_STAFF', user);


  /*
   * CREATE / EDIT NAGARSEVAK
   */

  function openNagarsevak(record = null) {

    if (record) {

      setForm({
        ...empty,
        ...record,
        password: '',
        role: 'NAGARSEVAK',
        wardId:
          record.wardId ||
          record.ward?.id ||
          '',
        status:
          record.status ||
          'ACTIVE',
        permissions:
          Array.isArray(record.permissions) ? record.permissions : []
      });

      setEdit(record);

    } else {

      setForm({
        ...empty,
        wardId:
          selectedWardId ||
          '',
        role: 'NAGARSEVAK',
        status: 'INACTIVE',
        permissions: [...allPermissions]
      });

      setEdit('create');

    }

    setTab('NAGARSEVAK');
  }


  /*
   * CREATE / EDIT EMPLOYEE
   */

  function openEmployee(record = null) {

    if (record) {

      setForm({
        ...empty,

        name:
          record.User?.name ||
          record.name ||
          '',

        email:
          record.User?.email ||
          record.email ||
          '',

        mobile:
          record.User?.mobile ||
          record.mobile ||
          '',

        password: '',

        wardId:
          record.wardId ||
          record.ward?.id ||
          record.User?.wardId ||
          selectedWardId ||
          user?.wardId ||
          '',

        designation:
          record.designation ||
          'Ward Employee',

        assignedAreaIds:
          parseAreaIds(record.assignedAreaIds),

        permissions:
          Array.isArray(record.permissions) ? record.permissions : parseAreaIds(record.permissions),

        managerUserId:
          record.managerUserId ||
          record.manager?.id ||
          '',

        status:
          record.User?.status ||
          record.status ||
          'ACTIVE'
      });

      setEdit(record);

    } else {

      setForm({
        ...empty,
        wardId: selectedWardId || user?.wardId || '',
        managerUserId: councillor ? String(user?.id || '') : '',
        permissions: [
          'VIEW_DASHBOARD','VIEW_WARD_INFORMATION','VIEW_WARD_UPDATES','VIEW_NOTIFICATIONS',
          'VIEW_HOUSES','CREATE_HOUSES','EDIT_HOUSES','VIEW_FAMILIES','CREATE_FAMILIES','EDIT_FAMILIES',
          'VIEW_CITIZENS','CREATE_CITIZENS','EDIT_CITIZENS','VIEW_VOTERS','VIEW_COMPLAINTS','EDIT_COMPLAINTS',
          'VIEW_18PLUS','VIEW_BIRTHDAYS','EXPORT_DATA','VIEW_SCHEMES','VIEW_DEATH_RECORDS','CREATE_DEATH_RECORDS',
          'VIEW_HOSPITALS','CREATE_HOSPITALS','EDIT_HOSPITALS','DELETE_HOSPITALS',
          'VIEW_CHAT','SEND_CHAT','VIEW_RECYCLE_BIN','RESTORE_RECYCLE_BIN','VIEW_WARDS','VIEW_ELECTION_DATA'
        ],
      });

      setEdit('create');

    }

    setTab('EMPLOYEE');
  }


  /*
   * SAVE ACCOUNT
   */

  async function save(event) {

    event.preventDefault();

    setBusy(true);
    setError('');

    try {

      if (tab === 'NAGARSEVAK') {

        if (!form.wardId) {
          throw new Error('Select a ward for this Nagarsevak.');
        }

        const data = {
          name: form.name,
          email: form.email,
          mobile: form.mobile,
          password:
            form.password ||
            undefined,
          wardId: form.wardId,
          wardSeat: form.wardSeat || null,
          partyName: form.partyName || null,
          officialAddress: form.officialAddress || null,
          photo: form.photo || null,
          bio: form.bio || null,
          officeTimings: form.officeTimings || null,
          whatsapp: form.whatsapp || null,
          permissions:
            Array.isArray(form.permissions) ? form.permissions : [],
          status: edit === 'create' ? 'INACTIVE' : (form.status || 'INACTIVE')
        };


        if (edit === 'create') {

          await api.createCorporator(data);

        } else {

          await api.updateCorporator(
            edit.id,
            data
          );

        }

      } else {

        const data = {
          name: form.name,
          email: form.email,
          mobile: form.mobile,
          password:
            form.password ||
            undefined,

          wardId: form.wardId,

          designation:
            form.designation,

          assignedAreaIds:
            form.assignedAreaIds || [],

          managerUserId:
            form.managerUserId ||
            (councillor ? String(user?.id || '') : undefined),

          permissions:
            form.permissions || [],

          status:
            form.status ||
            'ACTIVE'
        };


        if (edit === 'create') {

          await api.createEmployee(data);

        } else {

          await api.updateEmployee(
            edit.id,
            data
          );

        }

      }


      setEdit(null);
      try { sessionStorage.removeItem('ward_staff_draft'); sessionStorage.removeItem('ward_staff_edit'); } catch {}

      await load();
      window.dispatchEvent(new CustomEvent('ward:permissions-updated'));

      window.dispatchEvent(
        new CustomEvent(
          'ward:toast',
          {
            detail: {
              type: 'success',
              message:
                tab === 'NAGARSEVAK' && edit === 'create'
                  ? 'Nagarsevak added as inactive. Activate the ward, then activate this Nagarsevak on Ward activation.'
                  : `${tab === 'NAGARSEVAK' ? 'Nagarsevak' : 'Employee'} saved successfully.`
            }
          }
        )
      );


    } catch (err) {

      setError(
        err?.message ||
        'Unable to save account.'
      );

    } finally {

      setBusy(false);

    }

  }


  /*
   * AREA
   */

  function toggleArea(id) {

    setForm(current => {

      const currentAreas =
        current.assignedAreaIds || [];


      const exists =
        currentAreas.includes(id);


      return {
        ...current,

        assignedAreaIds:
          exists
            ? currentAreas.filter(
                x => x !== id
              )
            : [
                ...currentAreas,
                id
              ]
      };

    });

  }


  /*
   * PERMISSIONS
   */

  function togglePermission(permission) {

    setPermValues(current => {

      if (
        current.includes(permission)
      ) {

        return current.filter(
          p => p !== permission
        );

      }

      return [
        ...current,
        permission
      ];

    });

  }


  function toggleGroup(permissions) {

    setPermValues(current => {

      const allSelected =
        permissions.every(
          permission =>
            current.includes(permission)
        );


      if (allSelected) {

        return current.filter(
          permission =>
            !permissions.includes(permission)
        );

      }


      return [
        ...new Set([
          ...current,
          ...permissions
        ])
      ];

    });

  }


  /*
   * DELETE ACCOUNT
   */

  async function deleteAccount(
    kind,
    item
  ) {

    const name =
      kind === 'NAGARSEVAK'
        ? item?.name
        : item?.User?.name ||
          item?.name ||
          'Employee';


    if (
      !window.confirm(
        `Delete ${name}? This will remove the login account.`
      )
    ) {

      return;

    }


    setBusy(true);

    try {

      if (
        kind === 'NAGARSEVAK'
      ) {

        await api.deleteCorporator(
          item.id
        );

      } else {

        await api.deleteEmployee(
          item.id
        );

      }


      await load();


      window.dispatchEvent(
        new CustomEvent(
          'ward:toast',
          {
            detail: {
              type: 'success',
              message:
                `${name} deleted successfully.`
            }
          }
        )
      );


    } catch (err) {

      setError(
        err?.message ||
        'Unable to delete account.'
      );

    } finally {

      setBusy(false);

    }

  }


  function openConvert(record) {
    setConvertTarget(record);
    setConvertForm({ targetRole: 'SOCIAL_WORKER', replacementManagerUserId: '' });
  }

  async function convertNagarsevak(event) {
    event.preventDefault();
    if (!convertTarget) return;
    setBusy(true);
    setError('');
    try {
      await api.convertCorporator(convertTarget.id, convertForm);
      setConvertTarget(null);
      await load();
      window.dispatchEvent(new CustomEvent('ward:toast', { detail: { type:'success', message:`${convertTarget.name} moved to Community Members.` } }));
    } catch (err) {
      setError(err?.message || 'Unable to move this Nagarsevak to Community Members.');
    } finally {
      setBusy(false);
    }
  }

  /*
   * NOTIFICATION
   */

  function openNotify() {

    setNotifyForm({
      targetUserIds: [],
      title: '',
      message: ''
    });

    setNotify(true);

  }


  async function sendNotify(event) {

    event.preventDefault();

    if (
      !notifyForm.targetUserIds?.length
    ) {

      setError(
        'Please select at least one recipient.'
      );

      return;

    }


    setBusy(true);

    try {

      await api.sendNotification({
        targetUserIds:
          notifyForm.targetUserIds,

        title:
          notifyForm.title,

        message:
          notifyForm.message
      });


      setNotify(false);


      window.dispatchEvent(
        new CustomEvent(
          'ward:toast',
          {
            detail: {
              type: 'success',
              message:
                'Notification sent successfully.'
            }
          }
        )
      );


    } catch (err) {

      setError(
        err?.message ||
        'Unable to send notification.'
      );

    } finally {

      setBusy(false);

    }

  }


  /*
   * RECIPIENT OPTIONS
   */

  const recipientOptions =
    useMemo(() => {

      const nagarsevakOptions =
        (allN || []).map(
          n => ({
            value:
              n.userId ||
              n.User?.id ||
              n.id,

            label:
              `${n.name || 'Nagarsevak'} · Nagarsevak`
          })
        );


      const employeeOptions =
        (allE || []).map(
          e => ({
            value:
              e.userId ||
              e.User?.id ||
              e.id,

            label:
              `${e.User?.name || e.name || 'Employee'} · Employee`
          })
        );


      return [
        ...nagarsevakOptions,
        ...employeeOptions
      ];

    }, [
      allN,
      allE
    ]);


  return (
    <div className="staff-page admin-data-page">

      <TeamNav current="staff" />

      <ErrorBox error={error} />

      {tab === 'NAGARSEVAK' ? (
        <div className="team-kpi-grid">
          <div className="team-kpi-card">
            <div className="team-kpi-icon blue"><UsersIcon size={20} /></div>
            <div className="team-kpi-info">
              <div className="team-kpi-val">{nStats.total}</div>
              <div className="team-kpi-label">Total Nagarsevaks</div>
            </div>
          </div>
          <div className="team-kpi-card">
            <div className="team-kpi-icon green"><UserCheckIcon size={20} /></div>
            <div className="team-kpi-info">
              <div className="team-kpi-val">{nStats.active}</div>
              <div className="team-kpi-label">Active Accounts</div>
            </div>
          </div>
          <div className="team-kpi-card">
            <div className="team-kpi-icon purple"><BuildingIcon size={20} /></div>
            <div className="team-kpi-info">
              <div className="team-kpi-val">{nStats.wardActive}</div>
              <div className="team-kpi-label">Active Wards</div>
            </div>
          </div>
          <div className="team-kpi-card">
            <div className="team-kpi-icon amber"><EyeIcon size={20} /></div>
            <div className="team-kpi-info">
              <div className="team-kpi-val">{nStats.visible}</div>
              <div className="team-kpi-label">Visible to Residents</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="team-kpi-grid">
          <div className="team-kpi-card">
            <div className="team-kpi-icon blue"><UsersIcon size={20} /></div>
            <div className="team-kpi-info">
              <div className="team-kpi-val">{eStats.total}</div>
              <div className="team-kpi-label">Total Employees</div>
            </div>
          </div>
          <div className="team-kpi-card">
            <div className="team-kpi-icon green"><ZapIcon size={20} /></div>
            <div className="team-kpi-info">
              <div className="team-kpi-val">{eStats.active}</div>
              <div className="team-kpi-label">Active Employees</div>
            </div>
          </div>
          <div className="team-kpi-card">
            <div className="team-kpi-icon purple"><MapPinIcon size={20} /></div>
            <div className="team-kpi-info">
              <div className="team-kpi-val">{eStats.assignedColonies}</div>
              <div className="team-kpi-label">Colony Assigned</div>
            </div>
          </div>
          <div className="team-kpi-card">
            <div className="team-kpi-icon amber"><BuildingIcon size={20} /></div>
            <div className="team-kpi-info">
              <div className="team-kpi-val">{eStats.wardsCovered}</div>
              <div className="team-kpi-label">Wards Staffed</div>
            </div>
          </div>
        </div>
      )}

      <div className="tabs">

        {(master || sub) && (
          <button
            className={
              tab === 'NAGARSEVAK'
                ? 'tab active'
                : 'tab'
            }

            onClick={() =>
              setTab('NAGARSEVAK')
            }
          >
            Nagarsevaks ({nTotal})
          </button>
        )}

        <button
          className={
            tab === 'EMPLOYEE'
              ? 'tab active'
              : 'tab'
          }

          onClick={() =>
            setTab('EMPLOYEE')
          }
        >
          Employees ({eTotal})
        </button>

      </div>

      <Toolbar>

        <div style={{ flex: '1 1 200px', minWidth: '160px' }}>
          <input
            type="search"
            style={{ width: '100%', minHeight: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }}
            placeholder={tab === 'NAGARSEVAK' ? "Search by name, mobile, ward..." : "Search staff by name, mobile, designation..."}
            value={staffSearch}
            onChange={e => setStaffSearch(e.target.value)}
          />
        </div>

        <WardFilter />

        {tab === 'EMPLOYEE' && (master || sub) && (
          <div style={{ flex: '1 1 220px', minWidth: '180px' }}>
            <SearchableSelect
              label="Managing Nagarsevak"
              value={selectedManagerId}
              onChange={v => { setSelectedManagerId(v); setEPage(1); }}
              options={[
                { value: '', label: 'All Nagarsevaks (all employees)' },
                ...(allN || []).filter(n => !selectedWardId || String(n.wardId) === String(selectedWardId)).map(n => ({
                  value: n.id,
                  label: `${n.name} (Ward ${n.ward?.wardNumber || ''})`
                }))
              ]}
              placeholder="All Nagarsevaks"
            />
          </div>
        )}

        {master && (
          <button
            className="ghost-btn"
            onClick={openNotify}
          >
            Send notification
          </button>
        )}

        <button
          className="primary-btn"
          onClick={() =>
            tab === 'NAGARSEVAK'
              ? openNagarsevak()
              : openEmployee()
          }
        >
          + Add {
            tab === 'NAGARSEVAK'
              ? 'Nagarsevak'
              : 'Employee'
          }
        </button>

      </Toolbar>

      {councillor && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', marginBottom: '16px' }}>
          <UserCheckIcon size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
          <div style={{ fontSize: '13px', color: '#166534' }}>
            <strong>Your office team:</strong> Employees reporting to <strong>{user?.name}</strong> for this ward.
          </div>
        </div>
      )}

      {tab === 'EMPLOYEE' && !councillor && selectedManagerId && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UsersIcon size={16} style={{ color: '#2563eb' }} />
            <span style={{ fontSize: '13px', color: '#1e3a8a' }}>
              Employees under <strong>{(allN || []).find(n => String(n.id) === String(selectedManagerId))?.name || 'Selected Nagarsevak'}</strong> ({filteredE.length})
            </span>
          </div>
          <button
            type="button"
            className="small-btn"
            onClick={() => setSelectedManagerId('')}
            style={{ fontSize: '12px' }}
          >
            Show all employees
          </button>
        </div>
      )}


      {/*
       * NAGARSEVAK TABLE
       *
       * Fragment is important here.
       * Table and pagination are siblings.
       */}

      {tab === 'NAGARSEVAK' ? (

        nagarsevaks === null ? (

          <Loading />

        ) : !filteredN.length ? (

          <Empty>
            {staffSearch ? 'No Nagarsevak accounts match your search.' : 'No Nagarsevak accounts for this ward.'}
          </Empty>

        ) : (

          <>

            <div className="panel table-wrap staff-table">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '24%' }}>Nagarsevak</th>
                    <th style={{ width: '20%' }}>Ward & Seat</th>
                    <th style={{ width: '20%' }}>Contact & Login</th>
                    <th className="th-center" style={{ width: '10%', textAlign: 'center' }}>Account</th>
                    <th className="th-center" style={{ width: '10%', textAlign: 'center' }}>Ward Status</th>
                    <th className="th-center" style={{ width: '10%', textAlign: 'center' }}>Resident View</th>
                    <th className="th-center" style={{ width: '12%', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredN.map(n => (
                    <tr key={n.id}>
                      <td data-label="Nagarsevak">
                        <div className="staff-face-cell">
                          <FaceAvatar name={n.name} photo={n.photo} className="staff-face"/>
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ display: 'block', color: 'var(--text, #0f172a)', fontSize: '13.5px' }}>{n.name}</strong>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '3px' }}>
                              <span className="team-badge blue">Nagarsevak</span>
                              {n.partyName ? <span className="team-badge gray">{n.partyName}</span> : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Ward & Seat">
                        <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                          {formatWardLabel(n.ward)}
                        </strong>
                        <div style={{ marginTop: '3px' }}>
                          {n.wardSeat ? <span className="team-badge amber">Seat {n.wardSeat}</span> : <span className="muted" style={{ fontSize: '12px' }}>General Seat</span>}
                        </div>
                      </td>
                      <td data-label="Contact & Login">
                        <div className="cell-value">
                          <span className="user-email-val" style={{ textTransform: 'lowercase', display: 'block' }}>
                            {n.email ? String(n.email).toLowerCase() : '—'}
                          </span>
                          {n.mobile ? (
                            <a href={`tel:${n.mobile}`} className="team-contact-link notranslate" translate="no" style={{ marginTop: '2px' }}>
                              <PhoneIcon size={12} />
                              <span>{n.mobile}</span>
                            </a>
                          ) : <span className="muted">—</span>}
                        </div>
                      </td>
                      <td data-label="Account" className="td-center" style={{ textAlign: 'center' }}>
                        <div className="cell-value" style={{ justifyContent: 'center' }}>
                          <StatusPill>{n.status || 'INACTIVE'}</StatusPill>
                        </div>
                      </td>
                      <td data-label="Ward status" className="td-center" style={{ textAlign: 'center' }}>
                        <div className="cell-value" style={{ justifyContent: 'center' }}>
                          <StatusPill>{n.wardStatus || n.ward?.status || 'INACTIVE'}</StatusPill>
                        </div>
                      </td>
                      <td data-label="Resident view" className="td-center" style={{ textAlign: 'center' }}>
                        <div className="cell-value" style={{ justifyContent: 'center' }}>
                          <StatusPill>{n.residentVisible ? 'VISIBLE' : 'HIDDEN'}</StatusPill>
                        </div>
                      </td>
                      <td data-label="Actions" className="staff-actions td-center" style={{ textAlign: 'center' }}>
                        <div className="team-action-btns" style={{ justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn-action outline-blue"
                            onClick={()=>setDetail({kind:'NAGARSEVAK',data:n})}
                            title="View details"
                          >
                            View
                          </button>
                          {canStaff && (
                            <button
                              type="button"
                              className="btn-action"
                              onClick={()=>openNagarsevak(n)}
                              title="Edit Nagarsevak account"
                            >
                              Edit
                            </button>
                          )}
                          <RowMenu
                            menuOnly
                            items={[
                              master && { label: 'Reset password', onClick: () => setResetUser(n) },
                              master && { label: 'Permissions', onClick: () => { setPerm({ kind: 'NAGARSEVAK', data: n }); setPermValues(Array.isArray(n.permissions) ? n.permissions : []); } },
                              master && { label: 'Move to Community', danger: true, onClick: () => openConvert(n) },
                              master && { label: 'Delete account', danger: true, onClick: () => deleteAccount('NAGARSEVAK', n) }
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>


            <StaffPagination
              start={nStart}
              end={nEnd}
              total={nTotal}
              page={nPage}
              pages={nPages}
              limit={nLimit}
              setPage={setNPage}
              setLimit={setNLimit}
            />

          </>

        )

      ) : (

        /*
         * EMPLOYEE TABLE
         */

        employees === null ? (

          <Loading />

        ) : !filteredE.length ? (

          <Empty>
            {staffSearch ? 'No employees match your search.' : (councillor ? 'No employees under your account.' : 'No employees for this ward.')}
          </Empty>

        ) : (

          <>

            <div className="panel table-wrap staff-table">

              <table>

                <thead>

                  <tr>
                    <th style={{ width: '22%' }}>Employee</th>
                    {(master || sub) && <th style={{ width: '16%' }}>Ward</th>}
                    {(master || sub) && <th style={{ width: '18%' }}>Managing Nagarsevak</th>}
                    <th style={{ width: '16%' }}>Assigned Areas</th>
                    <th style={{ width: '14%' }}>Login</th>
                    <th className="th-center" style={{ width: '8%', textAlign: 'center' }}>Status</th>
                    <th className="th-center" style={{ width: '12%', textAlign: 'center' }}>Actions</th>
                  </tr>

                </thead>


                <tbody>

                  {filteredE.map(
                    e => {
                      const ids = parseAreaIds(e.assignedAreaIds);
                      return (
                        <tr key={e.id}>

                          <td data-label="Employee">
                            <div className="team-user-cell">
                              <div className="team-avatar-initials" style={{ background: '#0284c7' }}>
                                {(e.User?.name || e.name || 'W').slice(0, 2).toUpperCase()}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <strong style={{ display: 'block', color: 'var(--text, #0f172a)', fontSize: '14px' }}>
                                  {e.User?.name || e.name || '—'}
                                </strong>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                                  <span className="team-badge gray">{e.designation || 'Field Staff'}</span>
                                  {(e.mobile || e.User?.mobile) ? (
                                    <a href={`tel:${e.mobile || e.User?.mobile}`} className="team-contact-link notranslate" translate="no">
                                      <PhoneIcon size={12} />
                                      <span>{e.mobile || e.User?.mobile}</span>
                                    </a>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </td>


                          {(master || sub) && (
                            <td data-label="Ward">
                              {formatWardLabel(e.ward, e.wardId || '—')}
                              {e.ward?.name ? <div className="muted">{e.ward.name}</div> : null}
                            </td>
                          )}


                          {(master || sub) && (
                            <td data-label="Managing Nagarsevak">
                              {e.manager?.name ? (
                                <div>
                                  <strong style={{ display: 'block' }}>{e.manager.name}</strong>
                                  {e.manager.mobile ? (
                                    <a href={`tel:${e.manager.mobile}`} className="team-contact-link notranslate" translate="no">
                                      <PhoneIcon size={12} />
                                      <span>{e.manager.mobile}</span>
                                    </a>
                                  ) : null}
                                </div>
                              ) : '—'}
                            </td>
                          )}


                          <td data-label="Assigned Areas">
                            <button
                              type="button"
                              className="staff-area-btn"
                              onClick={() => {
                                setAreasModal({
                                  employeeName: e.User?.name || e.name || 'Employee',
                                  areas: ids.map(id => allAreasMap.get(String(id)) || `Area #${id}`),
                                  allAssigned: ids.length === 0,
                                  wardNumber: e.ward?.wardNumber || e.wardId || ''
                                });
                              }}
                              title="Click to view all assigned areas"
                            >
                              <span className="staff-area-text">{getEmployeeAreaLabel(e)}</span>
                            </button>
                            <div className="muted">
                              {ids.length === 0
                                ? 'All areas in ward'
                                : `${ids.length} colony/area${ids.length > 1 ? 's' : ''}`}
                            </div>
                          </td>


                          <td data-label="Login">
                            <span className="user-email-val" style={{ textTransform: 'lowercase' }}>
                              {(e.User?.email || e.email) ? String(e.User?.email || e.email).toLowerCase() : '—'}
                            </span>
                            <div className="muted">{e.role || 'FIELD_STAFF'}</div>
                          </td>


                          <td data-label="Status" className="td-center" style={{ textAlign: 'center' }}>
                            <div className="cell-value" style={{ justifyContent: 'center' }}>
                              <StatusPill>
                                {e.User?.status ||
                                  e.status ||
                                  'ACTIVE'}
                              </StatusPill>
                            </div>
                          </td>


                          <td data-label="Actions" className="staff-actions td-center" style={{ textAlign: 'center' }}>
                            <div className="team-action-btns" style={{ justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="btn-action outline-blue"
                                onClick={()=>setDetail({kind:'EMPLOYEE',data:e})}
                                title="View employee details"
                              >
                                View
                              </button>
                              {canStaff && (
                                <button
                                  type="button"
                                  className="btn-action"
                                  onClick={()=>openEmployee(e)}
                                  title="Edit employee details"
                                >
                                  Edit
                                </button>
                              )}
                              <RowMenu
                                menuOnly
                                items={[
                                  (master || sub || councillor) && { label: 'Permissions', onClick: () => { setPerm({ kind: 'EMPLOYEE', data: e }); setPermValues(e.permissions || []); } },
                                  master && { label: 'Reset password', onClick: () => setResetUser(e.User || e) },
                                  canStaff && { label: 'Delete account', danger: true, onClick: () => deleteAccount('EMPLOYEE', e) }
                                ]}
                              />
                            </div>
                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>


            <StaffPagination
              start={eStart}
              end={eEnd}
              total={eTotal}
              page={ePage}
              pages={ePages}
              limit={eLimit}
              setPage={setEPage}
              setLimit={setELimit}
            />

          </>

        )

      )}


      {/*
       * EXECUTIVE DETAILS MODAL
       */}

      {detail && (
        <Modal
          wide
          title={detail.kind === 'NAGARSEVAK' ? 'Nagarsevak profile' : 'Employee details'}
          onClose={() => setDetail(null)}
          footer={
            <div className="modal-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {canStaff && (
                  <button
                    type="button"
                    className="small-btn primary"
                    onClick={() => {
                      const item = detail.data;
                      const isNagar = detail.kind === 'NAGARSEVAK';
                      setDetail(null);
                      if (isNagar) openNagarsevak(item);
                      else openEmployee(item);
                    }}
                  >
                    Edit {detail.kind === 'NAGARSEVAK' ? 'Nagarsevak' : 'Employee'}
                  </button>
                )}
                {canStaff && (
                  <button
                    type="button"
                    className="small-btn"
                    onClick={() => {
                      const item = detail.data;
                      setDetail(null);
                      setResetUser(detail.kind === 'EMPLOYEE' && item.User ? item.User : item);
                    }}
                  >
                    Reset Password
                  </button>
                )}
              </div>
              <button type="button" className="primary-btn" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
          }
        >
          {detail.kind === 'NAGARSEVAK' ? (
            <>
              {/* Executive Header Banner */}
              <div className="prof-detail-header">
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <FaceAvatar name={detail.data.name} photo={detail.data.photo} className="staff-face-lg" style={{ width: '64px', height: '64px', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{detail.data.name}</h3>
                    {detail.data.partyName ? <span className="team-badge gray">{detail.data.partyName}</span> : null}
                    <span className="team-badge blue">{formatWardLabel(detail.data.ward)}</span>
                    {detail.data.wardSeat ? <span className="team-badge amber">Seat {detail.data.wardSeat}</span> : null}
                    <StatusPill>{detail.data.status || 'ACTIVE'}</StatusPill>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' }}>
                    {detail.data.mobile && (
                      <a href={`tel:${detail.data.mobile}`} className="team-contact-link notranslate" translate="no" style={{ color: '#1e40af', fontWeight: 600 }}>
                        <PhoneIcon size={12} />
                        <span>{detail.data.mobile}</span>
                      </a>
                    )}
                    {detail.data.email && (
                      <a href={`mailto:${detail.data.email}`} style={{ color: '#1e40af', textDecoration: 'none', fontWeight: 600 }}>
                        {detail.data.email}
                      </a>
                    )}
                    <span>
                      Resident App: <strong style={{ color: detail.data.residentVisible ? '#16a34a' : '#64748b' }}>{detail.data.residentVisible ? 'Visible to Residents' : 'Hidden from Residents'}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="prof-detail-grid">
                {/* Official Municipal Representation Card */}
                <div className="prof-detail-card">
                  <div className="prof-card-title">
                    <ShieldIcon size={16} />
                    <span>Official Representation & Ward Scope</span>
                  </div>
                  <div className="prof-spec-list">
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Representative Name</span>
                      <span className="prof-spec-v">{detail.data.name}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Official Role</span>
                      <span className="prof-spec-v">Nagarsevak (Ward Elected Representative)</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Political Party</span>
                      <span className="prof-spec-v">{detail.data.partyName || 'Independent'}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Assigned Ward</span>
                      <span className="prof-spec-v">{formatWardLabel(detail.data.ward)}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Electoral Ward Seat</span>
                      <span className="prof-spec-v">{detail.data.wardSeat ? `Seat ${detail.data.wardSeat}` : 'General Ward Seat'}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Official Office Address</span>
                      <span className="prof-spec-v" style={{ textAlign: 'right', maxWidth: '65%' }}>
                        {detail.data.officialAddress || 'No published office address entered.'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Account, Governance & Public Access Card */}
                <div className="prof-detail-card">
                  <div className="prof-card-title">
                    <BuildingIcon size={16} />
                    <span>Account, Access & System Governance</span>
                  </div>
                  <div className="prof-spec-list">
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Official Email / Login ID</span>
                      <span className="prof-spec-v">
                        <a href={`mailto:${detail.data.email}`} style={{ color: '#1e40af', textDecoration: 'none' }}>
                          {detail.data.email ? String(detail.data.email).toLowerCase() : '—'}
                        </a>
                      </span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Direct Contact Mobile</span>
                      <span className="prof-spec-v">
                        {detail.data.mobile ? (
                          <a href={`tel:${detail.data.mobile}`} style={{ color: '#1e40af', textDecoration: 'none' }}>
                            {detail.data.mobile}
                          </a>
                        ) : '—'}
                      </span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Portal Account Status</span>
                      <span className="prof-spec-v">
                        <StatusPill>{detail.data.status || 'ACTIVE'}</StatusPill>
                      </span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Ward System Status</span>
                      <span className="prof-spec-v">
                        <StatusPill>{detail.data.wardStatus || detail.data.ward?.status || 'INACTIVE'}</StatusPill>
                      </span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Resident Mobile App View</span>
                      <span className="prof-spec-v">
                        <StatusPill>{detail.data.residentVisible ? 'VISIBLE' : 'HIDDEN'}</StatusPill>
                      </span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Active Employees</span>
                      <span className="prof-spec-v">
                        {(() => {
                          const nid = String(detail.data?.id);
                          const workers = (employees || []).filter(e => String(e.managerUserId || e.manager?.id) === nid || String(e.wardId) === String(detail.data?.wardId));
                          return workers.length ? `${workers.length} employees assigned` : 'No employees assigned yet';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Employees assigned to this Nagarsevak */}
              <div className="prof-detail-card" style={{ marginTop: '4px' }}>
                <div className="prof-card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UsersIcon size={16} />
                    <span>Ward Office Employees & Field Staff</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {(() => {
                      const nid = String(detail.data?.id);
                      const workers = (employees || []).filter(e => String(e.managerUserId || e.manager?.id) === nid || String(e.wardId) === String(detail.data?.wardId));
                      return workers.length ? <span className="team-badge green">{workers.length} Assigned Staff</span> : null;
                    })()}
                    {canStaff && (
                      <button
                        type="button"
                        className="small-btn primary"
                        style={{ fontSize: '12px', padding: '3px 10px' }}
                        onClick={() => {
                          const targetNagar = detail.data;
                          setDetail(null);
                          openEmployee(null, targetNagar.id);
                        }}
                      >
                        + Add employee
                      </button>
                    )}
                  </div>
                </div>
                {(() => {
                  const nid = String(detail.data?.id);
                  const workers = (employees || []).filter(e => String(e.managerUserId || e.manager?.id) === nid || String(e.wardId) === String(detail.data?.wardId));
                  if (!workers.length) {
                    return (
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                        No employees are assigned under this Nagarsevak. Add them from the Employees tab.
                      </p>
                    );
                  }
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px', marginTop: '6px' }}>
                      {workers.map(w => (
                        <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                          <div className="team-avatar-initials" style={{ width: '32px', height: '32px', fontSize: '12px', background: '#0284c7' }}>
                            {(w.User?.name || w.name || 'W').slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {w.User?.name || w.name}
                            </strong>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              {w.designation || 'Field Staff'}
                              {(w.mobile || w.User?.mobile) ? ` · ${w.mobile || w.User?.mobile}` : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </>
          ) : (
            /* Employee Details Modal */
            <>
              <div className="prof-detail-header">
                <div className="team-avatar-initials" style={{ width: '56px', height: '56px', fontSize: '20px', background: '#0284c7', flexShrink: 0 }}>
                  {(detail.data.User?.name || detail.data.name || 'W').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{detail.data.User?.name || detail.data.name}</h3>
                    <span className="team-badge gray">{detail.data.designation || 'Ward Employee'}</span>
                    <span className="team-badge blue">{formatWardLabel(detail.data.ward, detail.data.wardId || '—')}</span>
                    <StatusPill>{detail.data.status || detail.data.User?.status || 'ACTIVE'}</StatusPill>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' }}>
                    {(detail.data.mobile || detail.data.User?.mobile) && (
                      <a href={`tel:${detail.data.mobile || detail.data.User?.mobile}`} className="team-contact-link notranslate" translate="no" style={{ color: '#1e40af', fontWeight: 600 }}>
                        <PhoneIcon size={12} />
                        <span>{detail.data.mobile || detail.data.User?.mobile}</span>
                      </a>
                    )}
                    {(detail.data.email || detail.data.User?.email) && (
                      <a href={`mailto:${detail.data.email || detail.data.User?.email}`} style={{ color: '#1e40af', textDecoration: 'none', fontWeight: 600 }}>
                        {detail.data.email || detail.data.User?.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="prof-detail-grid">
                <div className="prof-detail-card">
                  <div className="prof-card-title">
                    <ShieldIcon size={16} />
                    <span>Employee profile</span>
                  </div>
                  <div className="prof-spec-list">
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Full Name</span>
                      <span className="prof-spec-v">{detail.data.User?.name || detail.data.name}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Official Designation</span>
                      <span className="prof-spec-v">{detail.data.designation || 'Ward Employee'}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Assigned Ward</span>
                      <span className="prof-spec-v">{formatWardLabel(detail.data.ward, detail.data.wardId || '—')}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Managing Nagarsevak</span>
                      <span className="prof-spec-v">{detail.data.manager?.name || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="prof-detail-card">
                  <div className="prof-card-title">
                    <BuildingIcon size={16} />
                    <span>Credentials & Access</span>
                  </div>
                  <div className="prof-spec-list">
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Official Login Email</span>
                      <span className="prof-spec-v">{detail.data.User?.email || detail.data.email || '—'}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Contact Mobile</span>
                      <span className="prof-spec-v">{detail.data.User?.mobile || detail.data.mobile || '—'}</span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Account Status</span>
                      <span className="prof-spec-v"><StatusPill>{detail.data.status || detail.data.User?.status || 'ACTIVE'}</StatusPill></span>
                    </div>
                    <div className="prof-spec-row">
                      <span className="prof-spec-k">Granted Permissions</span>
                      <span className="prof-spec-v">{(detail.data.permissions || []).length} permissions</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Assigned Areas Card */}
              <div className="prof-detail-card" style={{ marginTop: '4px' }}>
                <div className="prof-card-title">
                  <MapPinIcon size={16} />
                  <span>Assigned Colonies & Ward Areas</span>
                </div>
                <div className="prof-ward-pills-wrap">
                  {(() => {
                    const ids = parseAreaIds(detail.data.assignedAreaIds);
                    if (!ids.length) return <span className="prof-ward-pill">All Ward Areas Assigned</span>;
                    const names = ids.map(id => allAreasMap.get(String(id))).filter(Boolean);
                    if (!names.length) return <span className="prof-ward-pill">{ids.length} Area(s) Assigned</span>;
                    return names.map((name, i) => (
                      <span key={i} className="prof-ward-pill">
                        <strong>{name}</strong>
                      </span>
                    ));
                  })()}
                </div>
              </div>
            </>
          )}
        </Modal>
      )}


      {/*
       * ACCOUNT FORM
       */}

      {edit && (

        <Modal
          wide
          title={
            edit === 'create'
              ? `Create ${
                  tab === 'NAGARSEVAK'
                    ? 'Nagarsevak'
                    : 'Employee'
                }`
              : `Edit ${
                  tab === 'NAGARSEVAK'
                    ? 'Nagarsevak'
                    : 'Employee'
                }`
          }
          onClose={() =>
            setEdit(null)
          }
        >

          <form
            id="staff-account-form"
            className="form-grid"
            onSubmit={save}
          >

            {tab !== 'NAGARSEVAK' && (
              <div className="span-2" style={{ padding: '8px 12px', background: 'var(--bg-subtle, #f8fafc)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>
                <UsersIcon size={14} style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '6px' }} /><strong>Employee:</strong> Field staff working under the Nagarsevak office.
              </div>
            )}

            <Field label="Full name">

              <input
                required
                value={form.name}
                onChange={event =>
                  setForm({
                    ...form,
                    name:
                      event.target.value
                  })
                }
              />

            </Field>


            <SearchableSelect
              label="Ward"
              required
              value={form.wardId}
              disabled={
                !master &&
                !sub
              }
              onChange={value =>
                setForm({
                  ...form,
                  wardId: value,
                  managerUserId: '',
                  assignedAreaIds: []
                })
              }
              options={wardOptions.map(
                ward => ({
                  value: ward.id,
                  label:
                    formatWardLabel(ward)
                })
              )}
            />


            <Field label="Email / Login ID">

              <input
                type="email"
                required
                value={form.email}
                onChange={event =>
                  setForm({
                    ...form,
                    email:
                      event.target.value
                  })
                }
              />

            </Field>


            <Field label="Mobile">

              <input
                required
                inputMode="numeric"
                value={form.mobile}
                onChange={event =>
                  setForm({
                    ...form,
                    mobile:
                      event.target.value
                        .replace(/\D/g, '')
                        .slice(0, 10)
                  })
                }
              />

            </Field>


            {tab === 'NAGARSEVAK' ? (
              <div className="span-2 activation-form-note">
                {edit === 'create'
                  ? 'This Nagarsevak is added to the selected ward as inactive. Open Ward activation, activate the ward first, then activate this Nagarsevak so they and their employees can sign in.'
                  : 'Login and resident visibility are controlled on Ward activation. Do not use this form to open access.'}
              </div>
            ) : (
            <Field label="Account access">

              <select
                value={
                  form.status ||
                  'ACTIVE'
                }
                onChange={event =>
                  setForm({
                    ...form,
                    status:
                      event.target.value
                  })
                }
              >

                <option value="ACTIVE">
                  Active
                </option>

                <option value="SUSPENDED">
                  Suspended
                </option>

              </select>

            </Field>
            )}


            <Field
              label={
                edit === 'create'
                  ? 'Password'
                  : 'New password'
              }
            >

              <input
                type="password"
                minLength="6"
                required={
                  edit === 'create'
                }
                value={form.password}
                onChange={event =>
                  setForm({
                    ...form,
                    password:
                      event.target.value
                  })
                }
              />

            </Field>


            {tab === 'NAGARSEVAK' ? (

              <>
                <Field label="Account role">
                  <input value="NAGARSEVAK" disabled readOnly />
                </Field>
                <Field label="Ward seat / Seat no.">
                  <input
                    value={form.wardSeat || ''}
                    onChange={event => setForm({ ...form, wardSeat: event.target.value })}
                    placeholder="e.g. W-01 / Seat 1"
                  />
                </Field>
                <Field label="Party">
                  <input
                    value={form.partyName || ''}
                    onChange={event => setForm({ ...form, partyName: event.target.value })}
                    placeholder="Party name"
                  />
                </Field>
                <Field label="WhatsApp Direct Number">
                  <input
                    value={form.whatsapp || ''}
                    onChange={event => setForm({ ...form, whatsapp: event.target.value })}
                    placeholder="e.g. 9822000000"
                  />
                </Field>
                <Field label="Office Timings / कार्यालयीन वेळ">
                  <input
                    value={form.officeTimings || ''}
                    onChange={event => setForm({ ...form, officeTimings: event.target.value })}
                    placeholder="e.g. सकाळी ९ ते १ | सायं ५ ते ९"
                  />
                </Field>
                <Field className="span-2" label="Bio / Vision / ध्येय व संकल्प">
                  <textarea
                    rows="3"
                    value={form.bio || ''}
                    onChange={event => setForm({ ...form, bio: event.target.value })}
                    placeholder="Brief bio, vision statement or citizen message for your ward..."
                  />
                </Field>
                <Field className="span-2" label="Official / published address">
                  <textarea
                    rows="2"
                    value={form.officialAddress || ''}
                    onChange={event => setForm({ ...form, officialAddress: event.target.value })}
                    placeholder="Office address / public contact address"
                  />
                </Field>
                <div className="span-2">
                  <CirclePhotoField
                    label="Nagarsevak photo"
                    name={form.name || 'Nagarsevak'}
                    value={form.photo || ''}
                    onChange={value => setForm({ ...form, photo: value })}
                  />
                </div>
              </>

            ) : (

              <>

                <Field label="Designation">

                  <input
                    required
                    value={
                      form.designation
                    }
                    onChange={event =>
                      setForm({
                        ...form,
                        designation:
                          event.target.value
                      })
                    }
                  />

                </Field>


                {councillor ? (
                  <Field className="span-2" label="Managing Nagarsevak (Your Office)">
                    <input value={`${user?.name || 'Your account'} · Ward Elected Representative (Locked to your office)`} disabled readOnly />
                  </Field>
                ) : (
                  <div className="span-2">
                    <SearchableSelect
                      label="Managing Nagarsevak *"
                      required
                      value={form.managerUserId}
                      onChange={value => {
                        const chosen = (allN || []).find(n => String(n.id) === String(value) || String(n.userId) === String(value));
                        setForm({
                          ...form,
                          managerUserId: value,
                          ...(chosen && chosen.wardId ? { wardId: chosen.wardId } : {})
                        });
                      }}
                      options={managerOptions.map(manager => ({
                        value: manager.userId || manager.id,
                        label: `${manager.name || 'Nagarsevak'}${manager.ward ? ` · ${formatWardLabel(manager.ward, '')}` : ''}`
                      }))}
                      placeholder="Search or select managing Nagarsevak…"
                    />
                    <small className="muted" style={{ display: 'block', marginTop: '4px', fontSize: '11.5px', color: '#64748b' }}>
                      Every field worker reports directly to a specific Nagarsevak and works exclusively with their assigned tasks.
                    </small>
                  </div>
                )}


                <div className="span-2">

                  <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span>Assigned areas / colonies</span>
                    {formAreas.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="small-btn"
                          onClick={() => setForm({ ...form, assignedAreaIds: formAreas.map(a => String(a.id)) })}
                        >
                          Select all areas
                        </button>
                        <button
                          type="button"
                          className="small-btn"
                          onClick={() => setForm({ ...form, assignedAreaIds: [] })}
                        >
                          Clear (all ward)
                        </button>
                      </div>
                    )}
                  </div>


                  <div className="checkbox-grid">

                    {formAreas.length ? (

                      formAreas.map(
                        area => (

                          <label
                            key={area.id}
                            className="check-item"
                          >

                            <input
                              type="checkbox"
                              checked={
                                parseAreaIds(
                                  form.assignedAreaIds
                                ).includes(
                                  String(area.id)
                                )
                              }
                              onChange={() =>
                                toggleArea(
                                  String(area.id)
                                )
                              }
                            />

                            <span>
                              {area.name ||
                                area.areaName ||
                                'Area'}
                            </span>

                          </label>

                        )
                      )

                    ) : (

                      <div className="muted">
                        No areas available for
                        this ward.
                      </div>

                    )}

                  </div>

                </div>

                <div className="span-2" style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                  <PermissionEditor
                    role="EMPLOYEE"
                    values={form.permissions || []}
                    onChange={perms => setForm({ ...form, permissions: perms })}
                    isMasterAdmin={master}
                  />
                </div>

              </>

            )}

            {tab === 'NAGARSEVAK' && master && (
              <div className="span-2" style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                <PermissionEditor
                  role="NAGARSEVAK"
                  values={form.permissions || []}
                  onChange={perms => setForm({ ...form, permissions: perms })}
                  isMasterAdmin={master}
                />
              </div>
            )}

          </form>


          {/*
           * IMPORTANT:
           * Actions are OUTSIDE form content.
           * This prevents Save button from appearing
           * inside permission/field area.
           */}

          <div className="modal-actions staff-form-actions">

            <button
              type="button"
              className="ghost-btn"
              onClick={() =>
                setEdit(null)
              }
              disabled={busy}
            >
              Cancel
            </button>


            <button
              form="staff-account-form"
              type="submit"
              className="primary-btn"
              disabled={busy}
            >
              {busy
                ? 'Saving...'
                : 'Save'}
            </button>

          </div>

        </Modal>

      )}


      {/*
       * NOTIFICATION MODAL
       */}

      {notify && (

        <Modal
          wide
          title="Send staff notification"
          onClose={() =>
            setNotify(false)
          }
        >

          <form
            id="staff-notification-form"
            className="form-grid"
            onSubmit={sendNotify}
          >

            <SearchableMultiSelect
              className="span-2"
              label="Send to"
              value={
                notifyForm.targetUserIds
              }
              onChange={values =>
                setNotifyForm({
                  ...notifyForm,
                  targetUserIds:
                    values
                })
              }
              options={
                recipientOptions
              }
            />


            <Field label="Title">

              <input
                required
                value={
                  notifyForm.title
                }
                onChange={event =>
                  setNotifyForm({
                    ...notifyForm,
                    title:
                      event.target.value
                  })
                }
              />

            </Field>


            <Field
              className="span-2"
              label="Message"
            >

              <textarea
                required
                rows="5"
                value={
                  notifyForm.message
                }
                onChange={event =>
                  setNotifyForm({
                    ...notifyForm,
                    message:
                      event.target.value
                  })
                }
              />

            </Field>

          </form>


          <div className="modal-actions">

            <button
              type="button"
              className="ghost-btn"
              onClick={() =>
                setNotify(false)
              }
            >
              Cancel
            </button>


            <button
              form="staff-notification-form"
              type="submit"
              className="primary-btn"
              disabled={busy}
            >
              {busy
                ? 'Sending...'
                : 'Send notification'}
            </button>

          </div>

        </Modal>

      )}


      {convertTarget && (
        <Modal
          wide
          title={`Move ${convertTarget.name} to Community Members`}
          onClose={() => setConvertTarget(null)}
        >
          <form id="convert-nagarsevak-form" className="form-grid" onSubmit={convertNagarsevak}>
            <div className="info-note span-2">
              Use this when the Nagarsevak is no longer elected, or when they should continue as a Samaj Sevak (social worker). The same login and ward stay, the Nagarsevak chat group is archived, and you then set permissions on Community Members. If this person still manages employees, choose another active Nagarsevak in the same ward first.
            </div>
            <Field label="New community role">
              <select value={convertForm.targetRole} onChange={e => setConvertForm({ ...convertForm, targetRole: e.target.value })}>
                <option value="SOCIAL_WORKER">Social Worker (Samaj Sevak)</option>
                <option value="CANDIDATE">Former Nagarsevak / Candidate</option>
              </select>
            </Field>
            <SearchableSelect
              label="Replacement Nagarsevak for managed employees (if required)"
              value={convertForm.replacementManagerUserId}
              onChange={v => setConvertForm({ ...convertForm, replacementManagerUserId: v })}
              options={managerOptions.filter(n => String(n.id) !== String(convertTarget.id)).map(n => ({ value: n.id, label: `${n.name || 'Nagarsevak'}${n.ward ? ` · ${formatWardLabel(n.ward, '')}` : ''}` }))}
              placeholder="Select replacement manager if needed…"
            />
            <div className="modal-actions span-2">
              <button type="button" className="ghost-btn" onClick={() => setConvertTarget(null)} disabled={busy}>Cancel</button>
              <button className="primary-btn" disabled={busy}>{busy ? 'Moving…' : 'Move to Community Members'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/*
       * PASSWORD RESET
       */}

      {resetUser && (

        <PasswordResetModal
          user={resetUser}
          onClose={() =>
            setResetUser(null)
          }
          onSaved={async () => {
            setResetUser(null);
            await load();
          }}
        />

      )}


      {/*
       * PERMISSION MODAL
       */}

      {perm && (

        <Modal
          wide
          title={
            `Access for ${perm.data.User?.name || perm.data.name || (perm.kind === 'EMPLOYEE' ? 'employee' : 'Nagarsevak')}`
          }
          onClose={() =>
            setPerm(null)
          }
          footer={
            <div className="modal-actions permission-modal-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() =>
                  setPerm(null)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-btn"
                disabled={busy}
                onClick={async () => {
                  try {
                    setBusy(true);
                    const accountId = perm.data.id;

                    if (perm.kind === 'NAGARSEVAK') {
                      await api.updateCorporator(
                        accountId,
                        { permissions: permValues }
                      );
                    } else if (
                      typeof api.updateEmployeePermissions ===
                      'function'
                    ) {
                      await api.updateEmployeePermissions(
                        accountId,
                        { permissions: permValues }
                      );
                    } else if (
                      typeof api.updateEmployee ===
                      'function'
                    ) {
                      await api.updateEmployee(
                        accountId,
                        { permissions: permValues }
                      );
                    } else {
                      throw new Error(
                        'Permission update API is not available.'
                      );
                    }

                    setPerm(null);

                    await load();
                    window.dispatchEvent(new CustomEvent('ward:permissions-updated'));

                    window.dispatchEvent(
                      new CustomEvent(
                        'ward:toast',
                        {
                          detail: {
                            type:
                              'success',
                            message:
                              'Permissions saved successfully.'
                          }
                        }
                      )
                    );

                  } catch (err) {
                    setError(
                      err?.message ||
                      'Unable to save permissions.'
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy
                  ? 'Saving...'
                  : 'Save access'}
              </button>
            </div>
          }
        >

          <PermissionEditor
            role={perm.kind === 'EMPLOYEE' ? 'EMPLOYEE' : 'NAGARSEVAK'}
            values={permValues}
            onChange={setPermValues}
            isMasterAdmin={master}
          />

        </Modal>

      )}

      {/* Assigned Areas Modal */}
      {areasModal && (
        <Modal
          title={`Assigned Areas · ${areasModal.employeeName}`}
          onClose={() => setAreasModal(null)}
        >
          <div className="assigned-areas-modal-content">
            <p className="muted" style={{ marginBottom: '14px', fontSize: '13px' }}>
              {areasModal.allAssigned
                ? 'This employee is assigned to all areas and colonies across the entire ward.'
                : `Showing all ${areasModal.areas.length} assigned areas/colonies:`}
            </p>
            {areasModal.allAssigned ? (
              <div className="all-ward-areas-notice">
                <strong>All Ward Areas</strong>
                <span>Full coverage across all colonies and streets in the ward.</span>
              </div>
            ) : (
              <div className="assigned-areas-chip-grid">
                {areasModal.areas.map((colony, idx) => (
                  <div key={idx} className="assigned-colony-chip">
                    <span className="colony-dot"></span>
                    <span className="colony-name">{colony}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="primary-btn" onClick={() => setAreasModal(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}


/*
 * STAFF PAGINATION
 *
 * ONLY ONE paginator is rendered for each table.
 */

function StaffPagination({
  start,
  end,
  total,
  page,
  pages,
  limit,
  setPage,
  setLimit
}) {
  return (
    <PaginationBar
      page={page}
      pages={pages}
      total={total}
      limit={limit}
      onPage={setPage}
      onLimit={setLimit}
    />
  );
}
