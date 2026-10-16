import React,{useEffect,useMemo,useState} from 'react';
import {api,getUser} from '../services/api';
import {isMaster} from '../rbac';
import {Empty,ErrorBox,Loading,Modal,PageHeader,StatusPill} from '../components/Ui';
import {formatWardLabel, formatWardNumber} from '../wardFormat';
import TeamNav from '../components/TeamNav';
import { BuildingIcon, ZapIcon, LockOpenIcon, UsersIcon, PhoneIcon, SearchIcon } from '../components/Icons';

function Confirm({title,message,confirmLabel,tone='primary',busy,onClose,onConfirm}){
 return (
  <Modal title={title} onClose={onClose} layer={2}>
   <p className="activation-confirm-copy">{message}</p>
   <div className="modal-actions">
    <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>Cancel</button>
    <button type="button" className={tone==='danger'?'primary-btn danger':'primary-btn'} disabled={busy} onClick={onConfirm}>{busy?'Please wait…':confirmLabel}</button>
   </div>
  </Modal>
 );
}

function fmtWhen(v){
 if(!v) return null;
 try{return new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});}catch{return null;}
}

export default function WardActivation(){
 const user=getUser();
 const master=isMaster(user);
 const [rows,setRows]=useState(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [confirm,setConfirm]=useState(null);
 const [pick,setPick]=useState(null);
 const [search,setSearch]=useState('');
 const [statusFilter,setStatusFilter]=useState('ALL');

 async function load(){
  try{
   setError('');
   const data=(await api.wardActivations()).data||[];
   setRows(data);
   setPick(current=>{
    if(!current) return null;
    return data.find(w=>String(w.id)===String(current.id))||current;
   });
   return data;
  }catch(e){setError(e.message);setRows([]);return [];}
 }
 useEffect(()=>{if(master)load();},[master]);

 const stats = useMemo(() => {
  const list = rows || [];
  return {
   total: list.length,
   active: list.filter(w => w.status === 'ACTIVE').length,
   regOpen: list.filter(w => !!w.registrationOpen).length,
   activeNagarsevaks: list.reduce((sum, w) => sum + Number(w.activeNagarsevakCount ?? (w.purchasedNagarsevaks || []).length), 0)
  };
 }, [rows]);

 const filteredRows = useMemo(() => {
  const list = rows || [];
  const q = search.trim().toLowerCase();
  return list.filter(w => {
   if (statusFilter === 'ACTIVE' && w.status !== 'ACTIVE') return false;
   if (statusFilter === 'INACTIVE' && w.status === 'ACTIVE') return false;
   if (statusFilter === 'REG_OPEN' && !w.registrationOpen) return false;
   if (!q) return true;
   const hay = [formatWardNumber(w.wardNumber), w.name, w.status].filter(Boolean).join(' ').toLowerCase();
   return hay.includes(q);
  });
 }, [rows, search, statusFilter]);

 async function run(action,{keepList=false}={}){
  setBusy(true);
  try{
   await action();
   setConfirm(null);
   if(!keepList) setPick(null);
   await load();
   window.dispatchEvent(new CustomEvent('ward:wards-changed'));
   window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'success',message:'Activation updated.'}}));
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }

 if(!master){
  return <div className="admin-data-page"><PageHeader title="Ward activation"/><div className="empty">You do not have access to this section.</div></div>;
 }

 return (
  <div className="admin-data-page ward-activation-page">
   <PageHeader
    title="Ward activation"
    action={<button className="ghost-btn" onClick={load}>Refresh</button>}
   />

   <TeamNav current="activation" />

   <div className="team-kpi-grid">
    <div className="team-kpi-card">
     <div className="team-kpi-icon blue">
      <BuildingIcon size={20} />
     </div>
     <div className="team-kpi-info">
      <div className="team-kpi-val">{stats.total}</div>
      <div className="team-kpi-label">Total Wards</div>
     </div>
    </div>
    <div className="team-kpi-card">
     <div className="team-kpi-icon green">
      <ZapIcon size={20} />
     </div>
     <div className="team-kpi-info">
      <div className="team-kpi-val">{stats.active}</div>
      <div className="team-kpi-label">Active Wards</div>
     </div>
    </div>
    <div className="team-kpi-card">
     <div className="team-kpi-icon purple">
      <LockOpenIcon size={20} />
     </div>
     <div className="team-kpi-info">
      <div className="team-kpi-val">{stats.regOpen}</div>
      <div className="team-kpi-label">Registration Open</div>
     </div>
    </div>
    <div className="team-kpi-card">
     <div className="team-kpi-icon amber">
      <UsersIcon size={20} />
     </div>
     <div className="team-kpi-info">
      <div className="team-kpi-val">{stats.activeNagarsevaks}</div>
      <div className="team-kpi-label">Active Nagarsevaks</div>
     </div>
    </div>
   </div>

   <div className="exec-toolbar-panel">
    <div className="exec-toolbar-row">
     <div className="exec-toolbar-left">
      <div className="exec-search-box">
       <SearchIcon size={15} />
       <input
        placeholder="Search by ward number or name…"
        value={search}
        onChange={e=>setSearch(e.target.value)}
       />
       {search && (
        <button type="button" className="search-clear-btn" onClick={()=>setSearch('')} title="Clear search">✕</button>
       )}
      </div>
      <div className="exec-quick-status">
       <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="exec-filter-select">
        <option value="ALL">All wards</option>
        <option value="ACTIVE">Active wards</option>
        <option value="INACTIVE">Inactive wards</option>
        <option value="REG_OPEN">Registration open</option>
       </select>
      </div>
     </div>
    </div>
   </div>

   {rows?.some(w=>w.registrationOpen)?(
    <p className="activation-confirm-copy" style={{ marginBottom: '14px' }}>Create account is open for {rows.filter(w=>w.registrationOpen).map(w=>formatWardLabel(w)).join(', ')}. Residents pick their ward from the registration list.</p>
   ):(
    <p className="activation-confirm-copy" style={{ marginBottom: '14px' }}>Create account is closed. Open registration for one or more wards below, or ask staff to share their ward registration link.</p>
   )}
   <ErrorBox error={error}/>
   {rows===null?<Loading/>:!filteredRows.length?<Empty>{search || statusFilter !== 'ALL' ? 'No wards match the filters.' : 'No wards found.'}</Empty>:(
    <div className="panel table-wrap">
     <table className="activation-board-table">
      <thead>
       <tr>
        <th style={{ width: '20%' }}>Ward</th>
        <th style={{ width: '12%' }}>Ward status</th>
        <th style={{ width: '15%' }}>Registration</th>
        <th style={{ width: '23%' }}>Active Nagarsevak</th>
        <th style={{ width: '16%' }}>Residents & App Users</th>
        <th style={{ textAlign: 'center' }}>Actions</th>
       </tr>
      </thead>
      <tbody>
       {filteredRows.map(w=>{
        const activeNagars = w.purchasedNagarsevaks || [];
        const hasActiveNagar = activeNagars.length > 0;
        const totalNagars = w.nagarsevaks || [];

        return (
         <tr key={w.id}>
          <td data-label="Ward">
           <div className="cell-value">
            <strong style={{ fontSize: '14px', color: 'var(--text, #0f172a)' }}>{formatWardNumber(w.wardNumber)}</strong>
            <div style={{ color: '#475569', fontSize: '12px', marginTop: '1px' }}>{w.name || '—'}</div>
            {w.status === 'ACTIVE' && w.activatedAt && (
             <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Active since {new Date(w.activatedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
             </div>
            )}
           </div>
          </td>
          <td data-label="Ward status">
           <StatusPill>{w.status}</StatusPill>
          </td>
          <td data-label="Registration">
           {w.registrationOpen ? (
            <div>
             <span className="team-badge green">OPEN</span>
             <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>Public signups allowed</div>
            </div>
           ) : (
            <div>
             <span className="team-badge gray">{w.status === 'ACTIVE' ? 'CLOSED' : '—'}</span>
             <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>Direct links only</div>
            </div>
           )}
          </td>
          <td data-label="Active Nagarsevak">
           {hasActiveNagar ? (
            <div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <strong style={{ fontSize: '13px', color: '#0f172a' }}>{activeNagars[0].name}</strong>
              <span className="team-badge green">Active</span>
             </div>
             <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '3px', flexWrap: 'wrap', fontSize: '12px' }}>
              {activeNagars[0].partyName && <span style={{ color: '#64748b' }}>{activeNagars[0].partyName}</span>}
              {activeNagars[0].mobile && (
               <a href={`tel:${activeNagars[0].mobile}`} className="team-contact-link notranslate" translate="no">
                <PhoneIcon size={12} />
                <span>{activeNagars[0].mobile}</span>
               </a>
              )}
             </div>
             {activeNagars.length > 1 && (
              <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '2px' }}>
               +{activeNagars.length - 1} more active
              </div>
             )}
            </div>
           ) : totalNagars.length > 0 ? (
            <div>
             <span className="team-badge amber">{totalNagars.length} assigned (Inactive)</span>
             <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>Click Manage to activate</div>
            </div>
           ) : (
            <span className="team-badge gray">None assigned</span>
           )}
          </td>
          <td data-label="Residents & App Users">
           <div className="activation-count">
            <strong>{Number(w.residentCount || 0).toLocaleString('en-IN')}</strong>
            <span style={{ fontSize: '11px', color: '#64748b' }}>surveyed citizens</span>
           </div>
           <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{Number(w.registeredCount || 0).toLocaleString('en-IN')}</span> app logins
           </div>
          </td>
          <td data-label="Actions" style={{ textAlign: 'center' }}>
           <div className="activation-row-actions">
            <button
             type="button"
             className="btn-action btn-manage-ward"
             onClick={()=>setPick(w)}
             title="Manage and activate Nagarsevak for this ward"
            >
             Manage Nagarsevak
            </button>
            {w.status==='ACTIVE' ? (
             <button
              type="button"
              className="btn-action btn-ward-deactivate"
              onClick={()=>setConfirm({kind:'ward-off',ward:w})}
              title="Deactivate this ward"
             >
              Deactivate Ward
             </button>
            ) : (
             <button
              type="button"
              className="btn-action btn-ward-activate"
              onClick={()=>setConfirm({kind:'ward-on',ward:w})}
              title="Activate this ward"
             >
              Activate Ward
             </button>
            )}
            {w.status==='ACTIVE' && !w.registrationOpen && (
             <button
              type="button"
              className="btn-action btn-reg-open"
              onClick={()=>setConfirm({kind:'signup-on',ward:w})}
              title="Open resident registration for this ward"
             >
              Open Registration
             </button>
            )}
            {w.registrationOpen && (
             <button
              type="button"
              className="btn-action btn-reg-close"
              onClick={()=>setConfirm({kind:'signup-off',ward:w})}
              title="Close resident registration for this ward"
             >
              Close Registration
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

   {pick&&<Modal wide title={`${formatWardNumber(pick.wardNumber)} · Nagarsevak activation`} onClose={()=>setPick(null)}>
    <p className="activation-confirm-copy">
     {pick.status==='ACTIVE'
      ? 'Activate only the Nagarsevak who purchased this ward. Residents will see that one profile. Other seats stay in administration and cannot sign in.'
      : 'Activate this ward first, then activate the buyer. Resident registration stays closed until the ward is open.'}
    </p>
    {!pick.nagarsevaks?.length?<Empty>No Nagarsevak accounts are assigned to this ward yet. Create them under Nagarsevak & Employees and select this ward.</Empty>:(
     <div className="nagar-activation-list">
      {pick.nagarsevaks.map(n=>{
       const visible=n.purchaseStatus==='ACTIVE';
       return (
        <article className={`nagar-activation-card ${visible?'is-active':''}`} key={n.id}>
          <div className="nagar-activation-main">
          <div className="nagar-activation-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
           <div className="team-avatar-initials" style={{ background: '#1e3a8a' }}>
            {(n.name || 'N').slice(0, 2).toUpperCase()}
           </div>
           <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>{n.name}</strong>
            <div className="nagar-activation-pills" style={{ marginTop: '4px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
             <StatusPill>{n.accountStatus==='ACTIVE'?'ACCOUNT ACTIVE':'ACCOUNT INACTIVE'}</StatusPill>
             <StatusPill>{visible?'VISIBLE TO CITIZENS':'HIDDEN'}</StatusPill>
            </div>
           </div>
          </div>
          <dl className="nagar-activation-facts">
           <div><dt>Mobile</dt><dd>{n.mobile ? <a href={`tel:${n.mobile}`} className="team-contact-link notranslate" translate="no">{n.mobile}</a> : '—'}</dd></div>
           <div><dt>Email</dt><dd className="user-email-val" style={{ textTransform: 'lowercase' }}>{n.email ? String(n.email).toLowerCase() : '—'}</dd></div>
           <div><dt>Party</dt><dd>{n.partyName||'—'}</dd></div>
           <div><dt>Seat</dt><dd>{n.wardSeat||'—'}</dd></div>
           {n.officialAddress?<div className="span-2"><dt>Address</dt><dd>{n.officialAddress}</dd></div>:null}
           {fmtWhen(n.activatedAt)?<div className="span-2"><dt>Activated</dt><dd>{fmtWhen(n.activatedAt)}</dd></div>:null}
          </dl>
         </div>
         <div className="nagar-activation-action">
          {visible ? (
           <button
            type="button"
            className="btn-action btn-ward-deactivate"
            onClick={()=>setConfirm({kind:'nagar-off',ward:pick,nagar:n})}
            title="Deactivate this Nagarsevak profile"
           >
            Deactivate Profile
           </button>
          ) : (
           <button
            type="button"
            className="btn-action btn-ward-activate"
            disabled={pick.status!=='ACTIVE'}
            title={pick.status==='ACTIVE'?'Activate this Nagarsevak profile':'Activate the ward first'}
            onClick={()=>setConfirm({kind:'nagar-on',ward:pick,nagar:n})}
           >
            Activate Profile
           </button>
          )}
         </div>
        </article>
       );
      })}
     </div>
    )}
    <div className="modal-actions"><button type="button" className="ghost-btn" onClick={()=>setPick(null)}>Close</button></div>
   </Modal>}

   {confirm?.kind==='ward-on'&&<Confirm title={`Activate ${formatWardNumber(confirm.ward.wardNumber)}?`} message="This ward will go live for the portal and Nagarsevak profiles. Open registration separately if residents should see this ward in the Create account list." confirmLabel="Activate ward" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setWardActivation(confirm.ward.id,{status:'ACTIVE'}))}/>}
   {confirm?.kind==='ward-off'&&<Confirm title={`Deactivate ${formatWardNumber(confirm.ward.wardNumber)}?`} message="This ward will close for registration and Nagarsevak profiles will be hidden from residents. Historical records stay in the database." confirmLabel="Deactivate ward" tone="danger" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setWardActivation(confirm.ward.id,{status:'INACTIVE'}))}/>}
   {confirm?.kind==='signup-on'&&<Confirm title={`Open registration for ${formatWardNumber(confirm.ward.wardNumber)}?`} message="This ward will be added to the Create account ward list. Other open wards stay open, so residents can choose from every ward you have opened." confirmLabel="Open registration" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setWardRegistrationOpen(confirm.ward.id,true))}/>}
   {confirm?.kind==='signup-off'&&<Confirm title={`Close registration for ${formatWardNumber(confirm.ward.wardNumber)}?`} message="This ward will leave the Create account list. Other open wards stay open. Residents may still register with a Nagarsevak or employee link." confirmLabel="Close registration" tone="danger" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setWardRegistrationOpen(confirm.ward.id,false))}/>}
   {confirm?.kind==='nagar-on'&&<Confirm title={`Activate ${confirm.nagar.name}?`} message={`${confirm.nagar.name} will be the only Nagarsevak residents of ${formatWardNumber(confirm.ward.wardNumber)} can see. Any other active Nagarsevak in this ward will be turned off automatically. Then fill their photo and works in Portal Management.`} confirmLabel="Activate Nagarsevak" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setNagarsevakPurchase(confirm.ward.id,{nagarsevakUserId:confirm.nagar.id,status:'ACTIVE'}),{keepList:true})}/>}
   {confirm?.kind==='nagar-off'&&<Confirm title={`Deactivate ${confirm.nagar.name}?`} message="This Nagarsevak and their employees will not be able to sign in. Residents will see the shared demo page until another Nagarsevak is activated." confirmLabel="Deactivate Nagarsevak" tone="danger" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setNagarsevakPurchase(confirm.ward.id,{nagarsevakUserId:confirm.nagar.id,status:'DEACTIVATED'}),{keepList:true})}/>}
  </div>
 );
}
