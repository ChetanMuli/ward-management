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
  PageHeader,
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
  designation: 'Ward Employee',
  assignedAreaIds: [],
  permissions: [],
  managerUserId: '',
  status: 'ACTIVE'
};


const permissionMap = {
  DASHBOARD: [
    'VIEW_DASHBOARD'
  ],

  WARD_INFORMATION: [
    'VIEW_WARD_INFORMATION'
  ],

  ELECTION_DATA: [
    'VIEW_ELECTION_DATA'
  ],

  WARD_UPDATES: [
    'VIEW_WARD_UPDATES'
  ],

  NOTIFICATIONS: [
    'VIEW_NOTIFICATIONS'
  ],

  CHAT: [
    'VIEW_CHAT',
    'SEND_CHAT',
    'CREATE_CHAT_GROUP',
    'MANAGE_CHAT_GROUP'
  ],

  USERS: [
    'VIEW_USERS',
    'EDIT_USERS',
    'DELETE_USERS'
  ],

  WARDS: [
    'VIEW_WARDS',
    'CREATE_WARDS',
    'EDIT_WARDS',
    'DELETE_WARDS'
  ],

  STAFF: [
    'VIEW_STAFF',
    'CREATE_STAFF',
    'EDIT_STAFF',
    'DELETE_STAFF'
  ],

  HOUSES: [
    'VIEW_HOUSES',
    'CREATE_HOUSES',
    'EDIT_HOUSES',
    'DELETE_HOUSES'
  ],

  FAMILIES: [
    'VIEW_FAMILIES',
    'CREATE_FAMILIES',
    'EDIT_FAMILIES',
    'DELETE_FAMILIES'
  ],

  PEOPLE: [
    'VIEW_CITIZENS',
    'CREATE_CITIZENS',
    'EDIT_CITIZENS',
    'DELETE_CITIZENS'
  ],

  VOTERS: [
    'VIEW_VOTERS',
    'EDIT_VOTERS'
  ],

  GOVERNMENT_VOTER_LISTS: [
    'VIEW_GOVERNMENT_VOTER_LISTS',
    'CREATE_GOVERNMENT_VOTER_LISTS'
  ],

  BIRTHDAYS: [
    'VIEW_BIRTHDAYS'
  ],

  FOLLOWUP: [
    'VIEW_18PLUS',
    'EDIT_18PLUS'
  ],

  COMPLAINTS: [
    'VIEW_COMPLAINTS',
    'CREATE_COMPLAINTS',
    'EDIT_COMPLAINTS',
    'DELETE_COMPLAINTS'
  ],

  REPORTS: [
    'EXPORT_DATA'
  ],

  AUDIT: [
    'VIEW_AUDIT'
  ],

  RECYCLE: [
    'VIEW_RECYCLE_BIN',
    'RESTORE_RECYCLE_BIN'
  ],

  SCHEMES: [
    'VIEW_SCHEMES',
    'CREATE_SCHEMES',
    'EDIT_SCHEMES',
    'DELETE_SCHEMES'
  ],

  DEATH: [
    'VIEW_DEATH_RECORDS',
    'CREATE_DEATH_RECORDS'
  ]
};


const allPermissions = [
  ...new Set(
    Object.values(permissionMap).flat()
  )
];


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
   * PAGINATION VALUES
   */

  const visibleN =
    nagarsevaks || [];

  const visibleE =
    (employees || []).filter(e => {
      if (!councillor) return true;
      return String(e.managerUserId || e.manager?.id || '') === String(user?.id || '');
    });


  const nTotal =
    Number(nMeta?.total || 0);

  const eTotal =
    Number(eMeta?.total || 0);


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
          record.assignedAreaIds ||
          [],

        permissions:
          record.permissions ||
          [],

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

      <PageHeader
        title={
          master
            ? 'Staff administration'
            : sub
              ? 'Sub-admin & staff administration'
              : 'Ward employee administration'
        }

        subtitle={
          (master || sub)
            ? 'Manage Nagarsevak and Employee access separately.'
            : 'Manage employees for your ward.'
        }
      />


      <ErrorBox error={error} />


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

        <WardFilter />


        {master && (
          <button
            className="ghost-btn"
            onClick={openNotify}
          >
            🔔 Send notification
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


      {/*
       * NAGARSEVAK TABLE
       *
       * Fragment is important here.
       * Table and pagination are siblings.
       */}

      {tab === 'NAGARSEVAK' ? (

        nagarsevaks === null ? (

          <Loading />

        ) : !visibleN.length ? (

          <Empty>
            No Nagarsevak accounts for this ward.
          </Empty>

        ) : (

          <>

            <div className="panel table-wrap staff-table-scroll">

              <table className="staff-data-table staff-nagar-table">

                <thead>

                  <tr>
                    <th>Nagarsevak</th>
                    <th>Ward / Seat</th>
                    <th>Party</th>
                    <th>Mobile</th>
                    <th>Login</th>
                    <th>Account</th>
                    <th>Ward status</th>
                    <th>Resident view</th>
                    <th />
                  </tr>

                </thead>


                <tbody>

                  {visibleN.map(
                    n => (

                      <tr key={n.id}>

                        <td data-label="Nagarsevak">
                          <div className="staff-face-cell">
                            <FaceAvatar name={n.name} photo={n.photo} className="staff-face"/>
                            <div>
                              <strong>{n.name}</strong>
                              <div className="muted">NAGARSEVAK</div>
                            </div>
                          </div>
                        </td>


                        <td data-label="Ward / Seat">

                          {n.ward?.wardNumber ||
                            '—'}

                          {n.ward?.name
                            ? ` · ${n.ward.name}`
                            : ''}
                          {n.wardSeat ? <div className="muted">Seat {n.wardSeat}</div> : null}

                        </td>


                        <td data-label="Party">
                          {n.partyName || '—'}
                        </td>


                        <td data-label="Mobile">
                          {n.mobile || '—'}
                        </td>


                        <td data-label="Login">
                          {n.email || '—'}
                        </td>


                        <td data-label="Account">

                          <StatusPill>
                            {n.status ||
                              'INACTIVE'}
                          </StatusPill>

                        </td>


                        <td data-label="Ward status">

                          <StatusPill>
                            {n.wardStatus ||
                              n.ward?.status ||
                              'INACTIVE'}
                          </StatusPill>

                        </td>


                        <td data-label="Resident view">

                          <StatusPill>
                            {n.residentVisible
                              ? 'VISIBLE'
                              : 'HIDDEN'}
                          </StatusPill>

                        </td>


                        <td data-label="Actions" className="staff-actions">
                          <RowMenu items={[
                            {label:'View details',onClick:()=>setDetail({kind:'NAGARSEVAK',data:n})},
                            master&&{label:'Reset password',onClick:()=>setResetUser(n)},
                            canStaff&&{label:'Edit',onClick:()=>openNagarsevak(n)},
                            master&&{label:'Move to Community',danger:true,onClick:()=>openConvert(n)},
                            master&&{label:'Permissions',onClick:()=>{setPerm({kind:'NAGARSEVAK',data:n});setPermValues(Array.isArray(n.permissions)?n.permissions:[])}},
                            master&&{label:'Delete',danger:true,onClick:()=>deleteAccount('NAGARSEVAK',n)}
                          ]}/>
                        </td>

                      </tr>

                    )
                  )}

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

        ) : !visibleE.length ? (

          <Empty>
            {councillor ? 'No employees under your account.' : 'No employees for this ward.'}
          </Empty>

        ) : (

          <>

            <div className="panel table-wrap staff-table-scroll">

              <table className="staff-data-table">

                <thead>

                  <tr>
                    <th>Employee</th>
                    <th>Ward</th>
                    <th>Managing Nagarsevak</th>
                    <th>Areas</th>
                    <th>Login</th>
                    <th>Status</th>
                    <th />
                  </tr>

                </thead>


                <tbody>

                  {visibleE.map(
                    e => (

                      <tr key={e.id}>

                        <td data-label="Employee">

                          <strong>
                            {e.User?.name ||
                              e.name ||
                              '—'}
                          </strong>

                          <div className="muted">
                            {e.designation ||
                              'Employee'}
                          </div>

                        </td>


                        <td data-label="Ward">
                          {e.ward?.wardNumber ||
                            e.wardId ||
                            '—'}
                        </td>


                        <td data-label="Managing Nagarsevak">
                          {e.manager?.name ||
                            '—'}
                        </td>


                        <td data-label="Areas">
                          {(e.assignedAreaIds || [])
                            .length
                            ? (e.assignedAreaIds || [])
                                .length
                            : 'All assigned'}
                        </td>


                        <td data-label="Login">
                          {e.User?.email ||
                            e.email ||
                            '—'}
                        </td>


                        <td data-label="Status">

                          <StatusPill>
                            {e.User?.status ||
                              e.status ||
                              'ACTIVE'}
                          </StatusPill>

                        </td>


                        <td data-label="Actions" className="staff-actions">
                          <RowMenu items={[
                            {label:'View details',onClick:()=>setDetail({kind:'EMPLOYEE',data:e})},
                            master&&{label:'Reset password',onClick:()=>setResetUser(e.User||e)},
                            canStaff&&{label:'Edit',onClick:()=>openEmployee(e)},
                            (master||sub||councillor)&&{label:'Permissions',onClick:()=>{setPerm({kind:'EMPLOYEE',data:e});setPermValues(e.permissions||[])}},
                            canStaff&&{label:'Delete',danger:true,onClick:()=>deleteAccount('EMPLOYEE',e)}
                          ]}/>
                        </td>

                      </tr>

                    )
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
       * DETAILS MODAL
       */}

      {detail && (

        <Modal
          wide
          title={
            detail.kind === 'NAGARSEVAK'
              ? 'Nagarsevak details'
              : 'Employee details'
          }
          onClose={() =>
            setDetail(null)
          }
        >

          <div className="detail-grid">

            <div className="detail-card">

              <h3>
                Account
              </h3>


              <p>
                <b>Name:</b>{' '}
                {detail.kind === 'EMPLOYEE'
                  ? (
                      detail.data.User?.name ||
                      detail.data.name ||
                      '—'
                    )
                  : (
                      detail.data.name ||
                      '—'
                    )}
              </p>


              <p>
                <b>Role:</b>{' '}

                {detail.kind === 'NAGARSEVAK'
                  ? 'Nagarsevak'
                  : 'Ward Employee'}
              </p>


              <p>
                <b>Email:</b>{' '}

                {detail.kind === 'EMPLOYEE'
                  ? (
                      detail.data.User?.email ||
                      detail.data.email ||
                      '—'
                    )
                  : (
                      detail.data.email ||
                      '—'
                    )}
              </p>


              <p>
                <b>Mobile:</b>{' '}

                {detail.kind === 'EMPLOYEE'
                  ? (
                      detail.data.User?.mobile ||
                      detail.data.mobile ||
                      '—'
                    )
                  : (
                      detail.data.mobile ||
                      '—'
                    )}
              </p>

              {detail.kind === 'NAGARSEVAK' && (
                <>
                  <div className="staff-detail-photo">
                    <FaceAvatar name={detail.data.name} photo={detail.data.photo} className="staff-face-lg"/>
                    <div>
                      <strong>{detail.data.name}</strong>
                      <span>{detail.data.partyName || 'Nagarsevak'}</span>
                    </div>
                  </div>
                  <p><b>Ward seat:</b> {detail.data.wardSeat || '—'}</p>
                  <p><b>Party:</b> {detail.data.partyName || '—'}</p>
                  <p><b>Published address:</b> {detail.data.officialAddress || '—'}</p>
                  <p><b>Ward status:</b> <StatusPill>{detail.data.wardStatus || detail.data.ward?.status || 'INACTIVE'}</StatusPill></p>
                  <p><b>Resident view:</b> <StatusPill>{detail.data.residentVisible ? 'VISIBLE' : 'HIDDEN'}</StatusPill></p>
                </>
              )}

            </div>


            <div className="detail-card">

              <h3>
                Scope
              </h3>


              <p>

                <b>Ward:</b>{' '}

                {detail.data.ward?.wardNumber ||
                  detail.data.wardId ||
                  '—'}

                {detail.data.ward?.name
                  ? ` · ${detail.data.ward.name}`
                  : ''}

              </p>


              {detail.kind === 'EMPLOYEE' && (

                <>
                  <p>
                    <b>Designation:</b>{' '}
                    {detail.data.designation ||
                      'Employee'}
                  </p>


                  <p>
                    <b>Managing Nagarsevak:</b>{' '}
                    {detail.data.manager?.name ||
                      '—'}
                  </p>


                  <p>
                    <b>Assigned areas:</b>{' '}
                    {(detail.data.assignedAreaIds ||
                      []).length ||
                      'All assigned'}
                  </p>
                </>

              )}

            </div>


            {detail.kind === 'EMPLOYEE' && (

              <div className="detail-card">

                <h3>
                  Permissions
                </h3>


                <p>
                  {(detail.data.permissions ||
                    []).length}{' '}
                  permissions granted.
                </p>

              </div>

            )}

          </div>

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
                    `${ward.wardNumber || ''}${
                      ward.name
                        ? ` · ${ward.name}`
                        : ''
                    }`
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
                <Field className="span-2" label="Official / published address">
                  <textarea
                    rows="3"
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
                  <Field className="span-2" label="Managing Nagarsevak">
                    <input value={`${user?.name || 'Your account'} · Your account`} disabled readOnly />
                  </Field>
                ) : (
                  <SearchableSelect
                    className="span-2"
                    label="Managing Nagarsevak"
                    required
                    value={form.managerUserId}
                    onChange={value => setForm({...form,managerUserId:value})}
                    options={managerOptions.map(manager=>({
                      value: manager.userId || manager.id,
                      label: `${manager.name || 'Nagarsevak'}${manager.ward?.wardNumber ? ` · Ward ${manager.ward.wardNumber}` : ''}`
                    }))}
                    placeholder="Search or select…"
                  />
                )}


                <div className="span-2">

                  <div className="section-label">
                    Assigned areas / colonies
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
                                (
                                  form.assignedAreaIds ||
                                  []
                                ).includes(
                                  area.id
                                )
                              }
                              onChange={() =>
                                toggleArea(
                                  area.id
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

              </>

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
              options={managerOptions.filter(n => String(n.id) !== String(convertTarget.id)).map(n => ({ value: n.id, label: `${n.name || 'Nagarsevak'}${n.ward?.wardNumber ? ` · Ward ${n.ward.wardNumber}` : ''}` }))}
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
            `Permissions · ${perm.data.User?.name || perm.data.name || ''}`
          }
          onClose={() =>
            setPerm(null)
          }
        >

          <PermissionEditor
            values={permValues}
            onChange={
              setPermValues
            }
          />


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

                  const accountId =
                    perm.data.id;

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
                : 'Save permissions'}
            </button>

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


/*
 * PERMISSION EDITOR
 */

function PermissionEditor({
  values,
  onChange
}) {

  const safeValues =
    values || [];


  function togglePermission(
    permission
  ) {

    if (
      safeValues.includes(
        permission
      )
    ) {

      onChange(
        safeValues.filter(
          p =>
            p !== permission
        )
      );

      return;

    }


    onChange([
      ...safeValues,
      permission
    ]);

  }


  function toggleGroup(
    permissions
  ) {

    const allSelected =
      permissions.every(
        permission =>
          safeValues.includes(
            permission
          )
      );


    if (allSelected) {

      onChange(
        safeValues.filter(
          permission =>
            !permissions.includes(
              permission
            )
        )
      );

      return;

    }


    onChange([
      ...new Set([
        ...safeValues,
        ...permissions
      ])
    ]);

  }


  const allSelected =
    allPermissions.length > 0 &&
    allPermissions.every(
      permission =>
        safeValues.includes(
          permission
        )
    );


  function toggleAll() {

    if (allSelected) {

      onChange([]);

    } else {

      onChange([
        ...allPermissions
      ]);

    }

  }


  return (

    <div className="permission-editor">

      <div className="permission-editor-head">

        <div>

          <strong>
            Section permissions
          </strong>

          <span>
            Select exactly what this
            account can access.
          </span>

        </div>


        <button
          type="button"
          className="small-btn"
          onClick={
            toggleAll
          }
        >
          {allSelected
            ? 'Clear all'
            : 'Select all'}
        </button>

      </div>


      <div className="permission-grid permission-grid-cards">

        {Object.entries(
          permissionMap
        ).map(
          ([module, permissions]) => {

            const complete =
              permissions.every(
                permission =>
                  safeValues.includes(
                    permission
                  )
              );


            return (

              <section
                key={module}
                className="permission-card"
              >

                <div className="permission-card-head">

                  <label>

                    <input
                      type="checkbox"
                      checked={
                        complete
                      }
                      onChange={() =>
                        toggleGroup(
                          permissions
                        )
                      }
                    />

                    <strong>
                      {module
                        .replaceAll(
                          '_',
                          ' '
                        )}
                    </strong>

                  </label>

                </div>


                <div className="permission-items">

                  {permissions.map(
                    permission => (

                      <label
                        key={permission}
                        className="permission-item"
                      >

                        <input
                          type="checkbox"
                          checked={
                            safeValues.includes(
                              permission
                            )
                          }
                          onChange={() =>
                            togglePermission(
                              permission
                            )
                          }
                        />

                        <span>
                          {permission}
                        </span>

                      </label>

                    )
                  )}

                </div>

              </section>

            );

          }
        )}

      </div>

    </div>

  );
}
