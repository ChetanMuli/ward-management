import React,{useEffect,useState} from 'react';
import {api,getUser} from '../services/api';
import {isMaster} from '../rbac';
import {Empty,ErrorBox,Loading,Modal,PageHeader,StatusPill} from '../components/Ui';
import {formatWardLabel, formatWardNumber} from '../wardFormat';

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
  return <div className="admin-data-page"><PageHeader kicker="Team & access" title="Ward activation"/><div className="empty">You do not have access to this section.</div></div>;
 }

 return (
  <div className="admin-data-page ward-activation-page">
   <PageHeader
    kicker="Team & access"
    title="Ward activation"
    action={<button className="ghost-btn" onClick={load}>Refresh</button>}
   />
   {rows?.some(w=>w.registrationOpen)?(
    <p className="activation-confirm-copy">Create account is assigned to {formatWardLabel(rows.find(w=>w.registrationOpen))}. Nagarsevak and employees may still issue a registration link for their own ward.</p>
   ):(
    <p className="activation-confirm-copy">Create account is closed. Open registration for one ward below, or ask staff to share their ward registration link.</p>
   )}
   <ErrorBox error={error}/>
   {rows===null?<Loading/>:!rows.length?<Empty>No wards found.</Empty>:(
    <div className="panel table-wrap">
     <table className="activation-board-table">
      <thead>
       <tr>
        <th>Ward</th>
        <th>Ward status</th>
        <th>Registration</th>
        <th>Active Nagarsevaks</th>
        <th>Residents</th>
        <th>Actions</th>
       </tr>
      </thead>
      <tbody>
       {rows.map(w=>{
        const count=Number(w.activeNagarsevakCount ?? (w.purchasedNagarsevaks||[]).length);
        return (
         <tr key={w.id}>
          <td data-label="Ward"><div className="cell-value"><strong>{formatWardNumber(w.wardNumber)}</strong><div className="muted">{w.name||'—'}</div></div></td>
          <td data-label="Ward status"><StatusPill>{w.status}</StatusPill></td>
          <td data-label="Registration">
           {w.registrationOpen
            ?<StatusPill>OPEN</StatusPill>
            :<span className="muted">{w.status==='ACTIVE'?'Closed':'—'}</span>}
          </td>
          <td data-label="Active Nagarsevaks"><div className="activation-count"><strong>{count}</strong><span>{count===1?'active':'active'}</span></div></td>
          <td data-label="Residents"><strong>{w.residentCount||0}</strong></td>
          <td data-label="Actions">
           <div className="activation-row-actions">
            {w.status==='ACTIVE'
             ?<button type="button" className="small-btn danger" onClick={()=>setConfirm({kind:'ward-off',ward:w})}>Deactivate ward</button>
             :<button type="button" className="small-btn" onClick={()=>setConfirm({kind:'ward-on',ward:w})}>Activate ward</button>}
            {w.status==='ACTIVE' && !w.registrationOpen
             ?<button type="button" className="small-btn" onClick={()=>setConfirm({kind:'signup-on',ward:w})}>Open registration</button>
             :null}
            {w.registrationOpen
             ?<button type="button" className="small-btn danger" onClick={()=>setConfirm({kind:'signup-off',ward:w})}>Close registration</button>
             :null}
            <button type="button" className="small-btn" onClick={()=>setPick(w)}>Manage Nagarsevaks</button>
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
          <div className="nagar-activation-title">
           <strong>{n.name}</strong>
           <div className="nagar-activation-pills">
            <StatusPill>{n.accountStatus==='ACTIVE'?'ACCOUNT ACTIVE':'ACCOUNT INACTIVE'}</StatusPill>
            <StatusPill>{visible?'VISIBLE':'HIDDEN'}</StatusPill>
           </div>
          </div>
          <dl className="nagar-activation-facts">
           <div><dt>Mobile</dt><dd>{n.mobile||'—'}</dd></div>
           <div><dt>Email</dt><dd className="user-email-val" style={{ textTransform: 'lowercase' }}>{n.email ? String(n.email).toLowerCase() : '—'}</dd></div>
           <div><dt>Party</dt><dd>{n.partyName||'—'}</dd></div>
           <div><dt>Seat</dt><dd>{n.wardSeat||'—'}</dd></div>
           {n.officialAddress?<div className="span-2"><dt>Address</dt><dd>{n.officialAddress}</dd></div>:null}
           {fmtWhen(n.activatedAt)?<div className="span-2"><dt>Activated</dt><dd>{fmtWhen(n.activatedAt)}</dd></div>:null}
          </dl>
         </div>
         <div className="nagar-activation-action">
          {visible
           ?<button type="button" className="small-btn danger" onClick={()=>setConfirm({kind:'nagar-off',ward:pick,nagar:n})}>Deactivate</button>
           :<button type="button" className="small-btn" disabled={pick.status!=='ACTIVE'} title={pick.status==='ACTIVE'?'':'Activate the ward first'} onClick={()=>setConfirm({kind:'nagar-on',ward:pick,nagar:n})}>Activate</button>}
         </div>
        </article>
       );
      })}
     </div>
    )}
    <div className="modal-actions"><button type="button" className="ghost-btn" onClick={()=>setPick(null)}>Close</button></div>
   </Modal>}

   {confirm?.kind==='ward-on'&&<Confirm title={`Activate ${formatWardNumber(confirm.ward.wardNumber)}?`} message="This ward will go live for the portal and Nagarsevak profiles. Create account still uses only the ward marked Open registration. Staff can issue a registration link for this ward from Resident registration." confirmLabel="Activate ward" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setWardActivation(confirm.ward.id,{status:'ACTIVE'}))}/>}
   {confirm?.kind==='ward-off'&&<Confirm title={`Deactivate ${formatWardNumber(confirm.ward.wardNumber)}?`} message="This ward will close for registration and Nagarsevak profiles will be hidden from residents. Historical records stay in the database." confirmLabel="Deactivate ward" tone="danger" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setWardActivation(confirm.ward.id,{status:'INACTIVE'}))}/>}
   {confirm?.kind==='signup-on'&&<Confirm title={`Open registration for ${formatWardNumber(confirm.ward.wardNumber)}?`} message="Create account will be assigned to this ward only. Any other open ward will close. Nagarsevak and employees may still issue a registration link for their own ward." confirmLabel="Open this ward" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setWardRegistrationOpen(confirm.ward.id,true))}/>}
   {confirm?.kind==='signup-off'&&<Confirm title={`Close registration for ${formatWardNumber(confirm.ward.wardNumber)}?`} message="Create account will not assign a ward until you open another. Residents may still register with a Nagarsevak or employee link." confirmLabel="Close registration" tone="danger" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setWardRegistrationOpen(confirm.ward.id,false))}/>}
   {confirm?.kind==='nagar-on'&&<Confirm title={`Activate ${confirm.nagar.name}?`} message={`${confirm.nagar.name} will be the only Nagarsevak residents of ${formatWardNumber(confirm.ward.wardNumber)} can see. Any other active Nagarsevak in this ward will be turned off automatically. Then fill their photo and works in Portal Management.`} confirmLabel="Activate Nagarsevak" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setNagarsevakPurchase(confirm.ward.id,{nagarsevakUserId:confirm.nagar.id,status:'ACTIVE'}),{keepList:true})}/>}
   {confirm?.kind==='nagar-off'&&<Confirm title={`Deactivate ${confirm.nagar.name}?`} message="This Nagarsevak and their employees will not be able to sign in. Residents will see the shared demo page until another Nagarsevak is activated." confirmLabel="Deactivate Nagarsevak" tone="danger" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setNagarsevakPurchase(confirm.ward.id,{nagarsevakUserId:confirm.nagar.id,status:'DEACTIVATED'}),{keepList:true})}/>}
  </div>
 );
}
