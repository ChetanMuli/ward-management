import React,{useEffect,useState} from 'react';
import {api,getUser} from '../services/api';
import {isMaster} from '../rbac';
import {Empty,ErrorBox,Loading,Modal,PageHeader,StatusPill} from '../components/Ui';

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
   <ErrorBox error={error}/>
   {rows===null?<Loading/>:!rows.length?<Empty>No wards found.</Empty>:(
    <div className="panel table-wrap">
     <table className="activation-board-table">
      <thead>
       <tr>
        <th>Ward</th>
        <th>Ward status</th>
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
          <td data-label="Ward"><div className="cell-value"><strong>{w.wardNumber}</strong><div className="muted">{w.name||'—'}</div></div></td>
          <td data-label="Ward status"><StatusPill>{w.status}</StatusPill></td>
          <td data-label="Active Nagarsevaks"><div className="activation-count"><strong>{count}</strong><span>{count===1?'active':'active'}</span></div></td>
          <td data-label="Residents"><strong>{w.residentCount||0}</strong></td>
          <td data-label="Actions">
           <div className="activation-row-actions">
            {w.status==='ACTIVE'
             ?<button type="button" className="small-btn danger" onClick={()=>setConfirm({kind:'ward-off',ward:w})}>Deactivate ward</button>
             :<button type="button" className="small-btn" onClick={()=>setConfirm({kind:'ward-on',ward:w})}>Activate ward</button>}
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

   {pick&&<Modal wide title={`${pick.wardNumber} · Nagarsevak activation`} onClose={()=>setPick(null)}>
    <p className="activation-confirm-copy">
     {pick.status==='ACTIVE'
      ? 'Activate every Nagarsevak who should be visible to residents of this ward. Inactive profiles stay in administration only and cannot sign in.'
      : 'Activate this ward first. Nagarsevak login and resident visibility stay closed until the ward is open.'}
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
           <div><dt>Email</dt><dd>{n.email||'—'}</dd></div>
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

   {confirm?.kind==='ward-on'&&<Confirm title={`Activate ${confirm.ward.wardNumber}?`} message="Residents will be able to register for this ward. Then activate each Nagarsevak who should appear to residents and be able to sign in." confirmLabel="Activate ward" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setWardActivation(confirm.ward.id,{status:'ACTIVE'}))}/>}
   {confirm?.kind==='ward-off'&&<Confirm title={`Deactivate ${confirm.ward.wardNumber}?`} message="This ward will be removed from resident registration. Nagarsevak profiles will be hidden from residents. Historical records stay in the database." confirmLabel="Deactivate ward" tone="danger" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setWardActivation(confirm.ward.id,{status:'INACTIVE'}))}/>}
   {confirm?.kind==='nagar-on'&&<Confirm title={`Activate ${confirm.nagar.name}?`} message={`${confirm.nagar.name} will be able to sign in with their employees, and residents of ${confirm.ward.wardNumber} will see them. Other active Nagarsevaks in this ward stay visible.`} confirmLabel="Activate Nagarsevak" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setNagarsevakPurchase(confirm.ward.id,{nagarsevakUserId:confirm.nagar.id,status:'ACTIVE'}),{keepList:true})}/>}
   {confirm?.kind==='nagar-off'&&<Confirm title={`Deactivate ${confirm.nagar.name}?`} message="This Nagarsevak and their employees will not be able to sign in. Residents will no longer see this profile. Other active Nagarsevaks are not changed." confirmLabel="Deactivate Nagarsevak" tone="danger" busy={busy} onClose={()=>setConfirm(null)} onConfirm={()=>run(()=>api.setNagarsevakPurchase(confirm.ward.id,{nagarsevakUserId:confirm.nagar.id,status:'DEACTIVATED'}),{keepList:true})}/>}
  </div>
 );
}
