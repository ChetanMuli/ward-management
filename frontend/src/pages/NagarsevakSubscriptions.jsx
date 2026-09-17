import React,{useEffect,useMemo,useState} from 'react';
import {api,getUser} from '../services/api';
import {isMaster,isSubMaster} from '../rbac';
import {Empty,ErrorBox,Loading,Modal,PageHeader,PaginationBar,SearchableSelect,StatusPill} from '../components/Ui';

function fmtDate(v){
 if(!v) return '—';
 try{return new Date(v).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}catch{return '—';}
}

function cycleLabel(cycle){
 if(cycle==='YEAR_ENDED'||cycle==='EXPIRED') return 'Year ended';
 if(cycle==='EXPIRING') return 'Ending soon';
 if(cycle==='ACTIVE') return 'Active Year';
 if(cycle==='PANEL_OFF') return 'Panel off';
 return 'Not activated';
}

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

export default function NagarsevakSubscriptions(){
 const user=getUser();
 const canManage=isMaster(user)||isSubMaster(user);
 const [rows,setRows]=useState(null);
 const [error,setError]=useState('');
 const [wards,setWards]=useState([]);
 const [wardId,setWardId]=useState('');
 const [status,setStatus]=useState('ALL');
 const [q,setQ]=useState('');
 const [page,setPage]=useState(1);
 const [limit,setLimit]=useState(10);
 const [busy,setBusy]=useState(false);
 const [confirm,setConfirm]=useState(null);

 function load(){
  if(!canManage) return;
  setError('');
  return api.nagarsevakSubscriptions().then(r=>setRows(r?.data||[])).catch(e=>{setError(e.message);setRows([]);});
 }

 useEffect(()=>{
  if(!canManage) return;
  api.wards().then(r=>setWards(r?.data||[])).catch(()=>setWards([]));
 },[canManage]);

 useEffect(()=>{load();},[canManage]);

 async function applyStatus(row,next){
  if(!row?.wardId){setError('This Nagarsevak is not assigned to a ward.');return;}
  if(next==='ACTIVE' && !row.wardActive){
   setError('Activate this ward first, then you can activate the Nagarsevak panel.');
   setConfirm(null);
   return;
  }
  setBusy(true);setError('');
  try{
   await api.setNagarsevakPurchase(row.wardId,{nagarsevakUserId:row.id,status:next});
   setConfirm(null);
   await load();
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 }

 const filtered=useMemo(()=>{
  const term=q.trim().toLowerCase();
  return (rows||[]).filter(r=>{
   if(wardId && String(r.wardId)!==String(wardId)) return false;
   if(status==='PANEL_ON'){if(!r.panelOn) return false;}
   else if(status!=='ALL' && r.cycle!==status) return false;
   if(term){
    const hay=[r.name,r.email,r.mobile,r.ward?.wardNumber,r.ward?.name].filter(Boolean).join(' ').toLowerCase();
    if(!hay.includes(term)) return false;
   }
   return true;
  });
 },[rows,wardId,status,q]);

 useEffect(()=>{setPage(1);},[wardId,status,q]);

 const pages=Math.max(1,Math.ceil(filtered.length/limit));
 const current=Math.min(page,pages);
 const slice=filtered.slice((current-1)*limit,current*limit);
 const counts=useMemo(()=>{
  const list=rows||[];
  return {
   all:list.length,
   panelOn:list.filter(r=>r.panelOn).length,
   yearEnded:list.filter(r=>r.cycle==='YEAR_ENDED').length,
   panelOff:list.filter(r=>r.cycle==='PANEL_OFF'||r.cycle==='NOT_ACTIVATED').length,
  };
 },[rows]);

 if(!canManage) return <div className="admin-data-page nagarsevak-sub-page"><PageHeader kicker="Team & access" title="Nagarsevak subscriptions" subtitle="Only Master Admin and Sub Master Admin can review subscription dates."/><Empty>Admin desk access is required.</Empty></div>;

 return (
  <div className="admin-data-page nagarsevak-sub-page">
   <PageHeader kicker="Team & access" title="Nagarsevak subscriptions" subtitle="The 1-year clock starts only when you activate a Nagarsevak. When the year ends, login stays open until you deactivate the panel yourself."/>
   <ErrorBox error={error}/>
   <div className="stat-grid sub-stat-grid">
    <div className="stat-card"><span>All</span><strong>{counts.all}</strong></div>
    <div className="stat-card"><span>Panel on</span><strong>{counts.panelOn}</strong></div>
    <div className="stat-card"><span>Year ended</span><strong>{counts.yearEnded}</strong></div>
    <div className="stat-card"><span>Panel off</span><strong>{counts.panelOff}</strong></div>
   </div>
   <div className="filter-toolbar sub-filter-bar">
    <label className="grow">Search
     <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Name, mobile or ward"/>
    </label>
    <SearchableSelect label="Ward" value={wardId} onChange={setWardId} options={[{value:'',label:'All wards'},...wards.map(w=>({value:w.id,label:`${w.wardNumber}${w.name?` · ${w.name}`:''}`}))]} placeholder="All wards"/>
    <label>Status
     <select value={status} onChange={e=>setStatus(e.target.value)}>
      <option value="ALL">All statuses</option>
      <option value="PANEL_ON">Panel on</option>
      <option value="ACTIVE">Active Year</option>
      <option value="EXPIRING">Ending in 30 days</option>
      <option value="YEAR_ENDED">Year ended</option>
      <option value="PANEL_OFF">Panel off</option>
      <option value="NOT_ACTIVATED">Not activated</option>
     </select>
    </label>
   </div>
   {rows===null?<Loading/>:!filtered.length?<Empty>No Nagarsevak subscriptions match these filters.</Empty>:(
    <>
     <div className="panel table-wrap">
      <table>
       <thead>
        <tr>
         <th>Nagarsevak</th>
         <th>Ward</th>
         <th>Ward status</th>
         <th>Added by admin</th>
         <th>Activated</th>
         <th>Deactivated</th>
         <th>1-year ends</th>
         <th>Days left</th>
         <th>Status</th>
         <th>Panel</th>
        </tr>
       </thead>
       <tbody>
        {slice.map(r=>{
         const on=!!r.panelOn;
         return (
          <tr key={r.id} className={r.cycle==='YEAR_ENDED'||r.cycle==='EXPIRED'?'is-expired':r.cycle==='EXPIRING'?'is-expiring':!on?'is-panel-off':''}>
           <td data-label="Nagarsevak"><div className="cell-value"><strong>{r.name}</strong><div className="muted">{r.mobile||r.email||'—'}</div></div></td>
           <td data-label="Ward">{r.ward?.wardNumber||'—'}{r.ward?.name?` · ${r.ward.name}`:''}</td>
           <td data-label="Ward status"><StatusPill>{r.wardActive?'WARD ACTIVE':'WARD CLOSED'}</StatusPill></td>
           <td data-label="Added by admin">{fmtDate(r.addedAt)}</td>
           <td data-label="Activated">{fmtDate(r.activatedAt)}</td>
           <td data-label="Deactivated">{on?'—':fmtDate(r.deactivatedAt)}</td>
           <td data-label="1-year ends">{fmtDate(r.expiresAt)}</td>
           <td data-label="Days left">{!on||r.daysLeft==null?'—':r.daysLeft<=0?'0':r.daysLeft}</td>
           <td data-label="Status"><StatusPill>{cycleLabel(r.cycle)}</StatusPill></td>
           <td data-label="Panel">
            <div className="activation-row-actions sub-panel-actions">
             {on
              ?<button type="button" className="small-btn danger" disabled={busy||!r.wardId} onClick={()=>setConfirm({kind:'off',row:r})}>Deactivate</button>
              : r.wardActive
               ?<button type="button" className="small-btn" disabled={busy||!r.wardId} onClick={()=>setConfirm({kind:'on',row:r})}>Activate</button>
               :<span className="ward-closed-note">Activate this ward first</span>}
             {r.cycle==='YEAR_ENDED'&&on&&<button type="button" className="small-btn" disabled={busy||!r.wardId} onClick={()=>setConfirm({kind:'renew',row:r})}>Start new year</button>}
            </div>
           </td>
          </tr>
         );
        })}
       </tbody>
      </table>
     </div>
     <PaginationBar page={current} pages={pages} total={filtered.length} limit={limit} onPage={setPage} onLimit={n=>{setLimit(n);setPage(1)}}/>
    </>
   )}
   {confirm?.kind==='on'&&<Confirm title={`Activate ${confirm.row.name}?`} message={`${confirm.row.name} and their employees will be able to sign in. Residents of this ward will see them. The 1-year clock starts from today.`} confirmLabel="Activate panel" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>applyStatus(confirm.row,'ACTIVE')}/>}
   {confirm?.kind==='off'&&<Confirm title={`Deactivate ${confirm.row.name}?`} message="This Nagarsevak and their employees will not be able to sign in. They will see a panel-deactivated message with our contact email and mobile. The 1-year term does not turn the panel off by itself." confirmLabel="Deactivate panel" tone="danger" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>applyStatus(confirm.row,'DEACTIVATED')}/>}
   {confirm?.kind==='renew'&&<Confirm title={`Start a new year for ${confirm.row.name}?`} message="The panel stays on. The 1-year clock restarts from today. Use this after payment is received." confirmLabel="Start new year" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>applyStatus(confirm.row,'ACTIVE')}/>}
  </div>
 );
}
