import React,{useState} from 'react';
import {api} from '../services/api';
import {Field,Modal} from './Ui';

const addDays=(s,n)=>{const d=new Date(`${s}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const addYears=(s,n)=>{const d=new Date(`${s}T00:00:00Z`),y=d.getUTCFullYear()+n,m=d.getUTCMonth(),day=d.getUTCDate();d.setUTCFullYear(y,m,day);if(m===1&&day===29&&d.getUTCMonth()!==1)d.setUTCFullYear(y,1,28);return d.toISOString().slice(0,10)};
const display=s=>s?new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(`${s}T00:00:00Z`)):'—';

export default function DeathAction({person,onSaved,onClose,label='Mark deceased',trigger=true}){
 const [open,setOpen]=useState(!trigger),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[notes,setNotes]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!person) return null;
 function close(){setOpen(false);onClose?.()}
 async function save(e){e.preventDefault();setBusy(true);setError('');try{const r=await api.createDeath(person.id,{dateOfDeath:date,notes});setOpen(false);setDate(new Date().toISOString().slice(0,10));setNotes('');window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'success',message:r.message||`${person.fullName} marked as deceased successfully.`}}));onSaved?.(r.data);onClose?.()}catch(e){setError(e.message)}finally{setBusy(false)}}
 const show=trigger?open:true;
 return <>
  {trigger&&<button type="button" className="small-btn danger death-action-btn" onClick={()=>{setDate(new Date().toISOString().slice(0,10));setError('');setOpen(true)}}>{label}</button>}
  {show&&<Modal wide title={`Record death · ${person.fullName||'Citizen'}`} onClose={close}>
   {error&&<div className="error-inline">{error}</div>}
   <form className="form-grid" onSubmit={save}>
    <div className="detail-card span-2"><h3>Citizen selected</h3><p><b>Name:</b> {person.fullName||'N/A'}</p><p><b>Mobile:</b> {person.mobile||'N/A'}</p><p><b>Family:</b> {person.family?.familyName||'N/A'}</p><p><b>House:</b> {person.family?.house?.houseNumber||'N/A'}</p><p><b>Ward:</b> {person.family?.house?.area?.ward?.wardNumber||'N/A'}</p></div>
    <Field label="Date of death"><input type="date" required max={new Date().toISOString().slice(0,10)} value={date} onChange={e=>setDate(e.target.value)}/></Field>
    <Field className="span-2" label="Notes (optional)"><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional death record notes"/></Field>
    <div className="detail-card span-2"><h3>Automatic dates</h3><p><b>10th day (Dahava):</b> {date?display(addDays(date,10)):'—'}</p><p><b>1st yearly Shraddha:</b> {date?display(addYears(date,1)):'—'}</p><p className="muted">After saving, this citizen is removed from active citizen/family/voter lists and retained only in Death Records.</p></div>
    <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={close}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':'Confirm death record'}</button></div>
   </form>
  </Modal>}
 </>;
}
