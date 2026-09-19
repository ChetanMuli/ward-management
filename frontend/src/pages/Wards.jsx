import React,{useEffect,useMemo,useState} from 'react';
import {api,getUser} from '../services/api';
import {ErrorBox,Field,Loading,Modal,PageHeader,RowMenu,StatusPill,Toolbar} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {useWardFilter} from '../wardFilter';
import {isMaster,isNagarsevak,isEmployee} from '../rbac';

const blank={wardNumber:'',name:'',description:'',status:'INACTIVE'};
const emptyArea={name:'',description:''};

function activeNagarsevaks(w){
 const users=w?.users||[];
 const byId=new Map(users.map(u=>[String(u.id),u]));
 const activeSubs=(w?.nagarsevakSubscriptions||[]).filter(s=>String(s.status||'').toUpperCase()==='ACTIVE');
 if(activeSubs.length){
  return activeSubs.map(s=>byId.get(String(s.nagarsevakUserId))||s.nagarsevak||{id:s.nagarsevakUserId,name:'Nagarsevak'}).filter(u=>String(u.status||'ACTIVE').toUpperCase()==='ACTIVE');
 }
 return users.filter(u=>String(u.Role?.name||u.role?.name||'').toUpperCase()==='NAGARSEVAK' && String(u.status||'ACTIVE').toUpperCase()==='ACTIVE');
}

export default function Wards(){
 const user=getUser(),master=isMaster(user),wardEditor=master||isNagarsevak(user)||isEmployee(user),{selectedWardId}=useWardFilter();
 const [wards,setWards]=useState(null),[error,setError]=useState(''),[edit,setEdit]=useState(null),[create,setCreate]=useState(null),[detail,setDetail]=useState(null),[areaEdit,setAreaEdit]=useState(null),[areaCreate,setAreaCreate]=useState(null),[busy,setBusy]=useState(false),[search,setSearch]=useState(''),[openChips,setOpenChips]=useState({});
 async function load(){try{setError('');setWards((await api.wards()).data||[])}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[]);
 const visible=useMemo(()=>{const base=selectedWardId?(wards||[]).filter(w=>String(w.id)===String(selectedWardId)):(wards||[]);const q=search.trim().toLowerCase();if(!q)return base;return base.filter(w=>`${w.wardNumber||''} ${w.name||''} ${w.description||''} ${(w.areas||[]).map(a=>`${a.name||''} ${a.description||''}`).join(' ')}`.toLowerCase().includes(q));},[wards,selectedWardId,search]);

 async function saveWard(e){
  e.preventDefault();setBusy(true);
  try{
   const src=edit||create;
   const body={wardNumber:src.wardNumber,name:src.name||null,description:src.description||null};
   let ward;
   if(edit) ward=(await api.updateWard(edit.id,body)).data;
   else{
    ward=(await api.createWard(body)).data;
    for(const a of (create.areas||[]).filter(x=>x.name.trim())) await api.createArea(ward.id,{name:a.name,description:a.description||null});
   }
   setEdit(null);setCreate(null);await load();
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 }
 async function saveArea(e){
  e.preventDefault();setBusy(true);
  try{
   const src=areaEdit||areaCreate;
   const payload={name:src.name,description:src.description||null};
   if(areaEdit) await api.updateArea(areaEdit.id,payload);
   else await api.createArea(areaCreate.wardId,payload);
   setAreaEdit(null);setAreaCreate(null);await load();
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 }

 return <div className="wards-page">
  <PageHeader kicker="Ward setup" title="Wards & areas" subtitle="Create each ward and its colonies. Exact home location is captured when your team visits the house." action={master?<button className="primary-btn" onClick={()=>setCreate({...blank,areas:[{...emptyArea}]})}>+ Create ward</button>:null}/>
  <ErrorBox error={error}/>
  <Toolbar><WardFilter/><input className="grow" placeholder="Search ward or colony…" value={search} onChange={e=>setSearch(e.target.value)}/></Toolbar>
  {!wards?<Loading/>:<div className="ward-grid">{visible.map(w=>{
   const areas=w.areas||[];
   const nagars=activeNagarsevaks(w);
   return (
    <section className={`ward-card ${String(w.status||'').toUpperCase()==='ACTIVE'?'is-open':'is-closed'}`} key={w.id}>
     <div className="ward-card-top">
      <div>
       <span className="eyebrow">WARD</span>
       <h3>{w.wardNumber}</h3>
       <p className="ward-card-name">{w.name||'Municipal ward'}</p>
      </div>
      <StatusPill>{w.status||'INACTIVE'}</StatusPill>
     </div>
     <p className="ward-card-copy">{w.description||'Add colonies so houses can be registered under this ward.'}</p>
     <div className="ward-card-stats">
      <div><span>Areas</span><strong>{areas.length}</strong></div>
      <div><span>Active nagarsevaks</span><strong>{nagars.length}</strong></div>
     </div>
     <div className="ward-area-chips">{(openChips[`a-${w.id}`]?areas:areas.slice(0,4)).map(a=><span key={a.id}>{a.name}</span>)}{areas.length>4&&<button type="button" className="ward-more-btn" onClick={()=>setOpenChips(s=>({...s,[`a-${w.id}`]:!s[`a-${w.id}`]}))}>{openChips[`a-${w.id}`]?'Show less':`+${areas.length-4} more`}</button>}{!areas.length&&<span className="muted">No areas yet</span>}</div>
     <div className="ward-nagar-chips">{nagars.length?(openChips[`n-${w.id}`]?nagars:nagars.slice(0,3)).map(u=><span key={u.id}>{u.name||'Nagarsevak'}</span>):<span className="muted">No active nagarsevak</span>}{nagars.length>3&&<button type="button" className="ward-more-btn" onClick={()=>setOpenChips(s=>({...s,[`n-${w.id}`]:!s[`n-${w.id}`]}))}>{openChips[`n-${w.id}`]?'Show less':`+${nagars.length-3} more`}</button>}</div>
     <div className="ward-card-footer">
      <RowMenu items={[
       {label:'View details',onClick:()=>setDetail(w)},
       wardEditor&&{label:'Edit ward',onClick:()=>setEdit({...blank,...w})},
       wardEditor&&{label:'Add area / colony',onClick:()=>setAreaCreate({wardId:w.id,...emptyArea})},
       master&&{label:'Delete ward',danger:true,onClick:async()=>{if(confirm(`Delete ward ${w.wardNumber}? It will move to the recycle bin.`)){try{await api.deleteWard(w.id);await load()}catch(e){setError(e.message)}}}}
      ]}/>
     </div>
     <div className="area-list">{areas.map(a=><div className="area-item" key={a.id}><div><strong>{a.name}</strong><span>{a.description||'Colony / area in this ward'}</span></div>{wardEditor&&<div className="card-actions"><button className="small-btn" onClick={()=>setAreaEdit({...emptyArea,...a})}>Edit</button><button className="small-btn danger" onClick={async()=>{if(confirm(`Delete area ${a.name}?`)){try{await api.deleteArea(a.id);load()}catch(e){setError(e.message)}}}}>Delete</button></div>}</div>)}</div>
    </section>
   );
  })}</div>}

  {detail&&<Modal wide title={`${detail.wardNumber}${detail.name?` · ${detail.name}`:''} · Ward details`} onClose={()=>setDetail(null)}>
   <div className="detail-grid">
    <div className="detail-card"><h3>Ward</h3><p><b>Ward number:</b> {detail.wardNumber||'—'}</p><p><b>Activation:</b> <StatusPill>{detail.status||'INACTIVE'}</StatusPill></p><p><b>Name:</b> {detail.name||'N/A'}</p><p><b>Description:</b> {detail.description||'N/A'}</p></div>
    <div className="detail-card"><h3>Active nagarsevaks</h3>{activeNagarsevaks(detail).length?activeNagarsevaks(detail).map(u=><p key={u.id}><b>{u.name||'Nagarsevak'}</b>{u.mobile?` · ${u.mobile}`:''}</p>):<p className="muted">No active nagarsevak on this ward yet.</p>}</div>
    <div className="detail-card span-2"><h3>Areas / Colonies</h3>{(detail.areas||[]).length?(detail.areas||[]).map(a=><div className="area-detail-row" key={a.id}><div><b>{a.name}</b><span>{a.description||'No description'}</span></div></div>):<p className="muted">No colonies yet.</p>}</div>
   </div>
   <div className="modal-actions"><button className="ghost-btn" onClick={()=>setDetail(null)}>Close</button></div>
  </Modal>}

  {(edit||create)&&<Modal wide title={edit?`Edit ${edit.wardNumber}`:'Create ward'} onClose={()=>{setEdit(null);setCreate(null)}}>
   <form className="form-grid admin-form" onSubmit={saveWard}>
    <div className="form-section-title span-2"><strong>Ward</strong><span>Number and name used across houses, families and registration.</span></div>
    <Field label="Ward number *"><input required value={(edit||create).wardNumber||''} onChange={e=>(edit?setEdit:setCreate)({...((edit||create)),wardNumber:e.target.value})}/></Field>
    <Field label="Ward name (optional)"><input value={(edit||create).name||''} onChange={e=>(edit?setEdit:setCreate)({...((edit||create)),name:e.target.value})}/></Field>
    <Field className="span-2" label="Ward description"><textarea value={(edit||create).description||''} onChange={e=>(edit?setEdit:setCreate)({...((edit||create)),description:e.target.value})}/></Field>
    {!edit&&<div className="span-2 ward-area-editor">
     <p className="activation-form-note">New wards stay inactive until you open them on Ward activation. Inactive wards do not appear on resident registration.</p>
     <div className="section-label">Colonies / areas in this ward</div>
     {(create.areas||[]).map((a,i)=>(
      <div className="ward-area-editor-card" key={i}>
       <div className="ward-area-editor-head">
        <strong>Colony {i+1}</strong>
        {(create.areas||[]).length>1&&<button type="button" className="small-btn danger" onClick={()=>setCreate({...create,areas:create.areas.filter((_,j)=>j!==i)})}>Remove</button>}
       </div>
       <div className="form-grid">
        <Field label="Colony / area name *"><input placeholder="e.g. Savedi Village" value={a.name} onChange={e=>setCreate({...create,areas:create.areas.map((x,j)=>j===i?{...x,name:e.target.value}:x)})}/></Field>
        <Field label="Landmark or note (optional)"><input placeholder="e.g. Near bus stop" value={a.description} onChange={e=>setCreate({...create,areas:create.areas.map((x,j)=>j===i?{...x,description:e.target.value}:x)})}/></Field>
       </div>
      </div>
     ))}
     <button type="button" className="small-btn" onClick={()=>setCreate({...create,areas:[...(create.areas||[]),{...emptyArea}]})}>+ Add another colony</button>
    </div>}
    <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>{setEdit(null);setCreate(null)}}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':edit?'Save changes':'Create ward'}</button></div>
   </form>
  </Modal>}

  {areaEdit&&<Modal wide title={`Edit area · ${areaEdit.name}`} onClose={()=>setAreaEdit(null)}>
   <form className="form-grid admin-form" onSubmit={saveArea}>
    <Field className="span-2" label="Area / Colony name *"><input required value={areaEdit.name} onChange={e=>setAreaEdit({...areaEdit,name:e.target.value})}/></Field>
    <Field className="span-2" label="Description"><textarea value={areaEdit.description||''} onChange={e=>setAreaEdit({...areaEdit,description:e.target.value})}/></Field>
    <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>setAreaEdit(null)}>Cancel</button><button className="primary-btn" disabled={busy}>Save area</button></div>
   </form>
  </Modal>}

  {areaCreate&&<Modal wide title="Add area / colony" onClose={()=>setAreaCreate(null)}>
   <form className="form-grid admin-form" onSubmit={saveArea}>
    <Field className="span-2" label="Area / Colony name *"><input required value={areaCreate.name} onChange={e=>setAreaCreate({...areaCreate,name:e.target.value})}/></Field>
    <Field className="span-2" label="Description"><textarea value={areaCreate.description} onChange={e=>setAreaCreate({...areaCreate,description:e.target.value})}/></Field>
    <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>setAreaCreate(null)}>Cancel</button><button className="primary-btn" disabled={busy}>Add area</button></div>
   </form>
  </Modal>}
 </div>;
}
