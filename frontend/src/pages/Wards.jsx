import React,{useEffect,useMemo,useState} from 'react';
import {api} from '../services/api';
import {ErrorBox,Field,Loading,Modal,PageHeader,RowMenu,StatusPill,Toolbar} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {useWardFilter} from '../wardFilter';
import {isMaster,isNagarsevak,isEmployee} from '../rbac';
import {getUser} from '../services/api';

const blank={wardNumber:'',name:'',description:'',status:'INACTIVE'};
const emptyArea={name:'',description:'',status:'ACTIVE'};

export default function Wards(){
 const user=getUser(),master=isMaster(user),wardEditor=master||isNagarsevak(user)||isEmployee(user),{selectedWardId}=useWardFilter();
 const [wards,setWards]=useState(null),[error,setError]=useState(''),[edit,setEdit]=useState(null),[create,setCreate]=useState(null),[detail,setDetail]=useState(null),[areaEdit,setAreaEdit]=useState(null),[areaCreate,setAreaCreate]=useState(null),[busy,setBusy]=useState(false),[search,setSearch]=useState('');
 async function load(){try{setError('');setWards((await api.wards()).data||[])}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[]);
 const visible=useMemo(()=>{const base=selectedWardId?(wards||[]).filter(w=>String(w.id)===String(selectedWardId)):(wards||[]);const q=search.trim().toLowerCase();if(!q)return base;return base.filter(w=>`${w.wardNumber||''} ${w.name||''} ${w.description||''} ${(w.areas||[]).map(a=>`${a.name||''} ${a.description||''}`).join(' ')}`.toLowerCase().includes(q));},[wards,selectedWardId,search]);
 async function saveWard(e){e.preventDefault();setBusy(true);try{let ward;if(edit){ward=(await api.updateWard(edit.id,{wardNumber:edit.wardNumber,name:edit.name||null,description:edit.description||null})).data}else{ward=(await api.createWard({wardNumber:create.wardNumber,name:create.name||null,description:create.description||null})).data;for(const a of (create.areas||[]).filter(x=>x.name.trim()))await api.createArea(ward.id,{name:a.name,description:a.description||null})}setEdit(null);setCreate(null);await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function saveArea(e){e.preventDefault();setBusy(true);try{if(areaEdit)await api.updateArea(areaEdit.id,{name:areaEdit.name,description:areaEdit.description||null});else await api.createArea(areaCreate.wardId,{name:areaCreate.name,description:areaCreate.description||null});setAreaEdit(null);setAreaCreate(null);await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div className="wards-page">
  <PageHeader kicker="Ward setup" title="Wards & areas" subtitle="Create each ward and maintain its colonies / areas. Every house, family and citizen is linked through this hierarchy." action={master?<button className="primary-btn" onClick={()=>setCreate({...blank,areas:[{...emptyArea}]})}>+ Create ward</button>:null}/>
  <ErrorBox error={error}/>
  <Toolbar><WardFilter/><input className="grow" placeholder="Search ward, colony / area…" value={search} onChange={e=>setSearch(e.target.value)}/></Toolbar>
  {!wards?<Loading/>:<div className="ward-grid">{visible.map(w=>{
   const areas=w.areas||[];
   return (
    <section className={`ward-card ${String(w.status||'').toUpperCase()==='ACTIVE'?'is-open':'is-closed'}`} key={w.id}>
     <div className="ward-card-top">
      <div>
       <span className="eyebrow">WARD</span>
       <h3>{w.wardNumber}</h3>
       <p className="ward-card-name">{w.name||'Ahilyanagar Municipal Corporation ward'}</p>
      </div>
      <StatusPill>{w.status||'INACTIVE'}</StatusPill>
     </div>
     <p className="ward-card-copy">{w.description||'No description'}</p>
     <div className="ward-card-stats">
      <div><span>Areas</span><strong>{areas.length}</strong></div>
      <div><span>Registration</span><strong>{String(w.status||'').toUpperCase()==='ACTIVE'?'Open':'Closed'}</strong></div>
     </div>
     <div className="ward-area-chips">{areas.slice(0,4).map(a=><span key={a.id}>{a.name}</span>)}{areas.length>4&&<span>+{areas.length-4} more</span>}{!areas.length&&<span className="muted">No areas yet</span>}</div>
     <div className="ward-card-footer">
      <RowMenu items={[
       {label:'View details',onClick:()=>setDetail(w)},
       wardEditor&&{label:'Edit ward',onClick:()=>setEdit({...w})},
       wardEditor&&{label:'Add area / colony',onClick:()=>setAreaCreate({wardId:w.id,...emptyArea})},
       master&&{label:'Delete ward',danger:true,onClick:async()=>{if(confirm(`Delete ward ${w.wardNumber}? It will move to the recycle bin.`)){try{await api.deleteWard(w.id);await load()}catch(e){setError(e.message)}}}}
      ]}/>
     </div>
     <div className="area-list">{areas.map(a=><div className="area-item" key={a.id}><div><strong>{a.name}</strong><span>{a.description||'Area / Colony'}</span></div>{wardEditor&&<div className="card-actions"><button className="small-btn" onClick={()=>setAreaEdit({...a})}>Edit</button><button className="small-btn danger" onClick={async()=>{if(confirm(`Delete area ${a.name}?`)){try{await api.deleteArea(a.id);load()}catch(e){setError(e.message)}}}}>Delete</button></div>}</div>)}</div>
    </section>
   );
  })}</div>}
  {detail&&<Modal wide title={`${detail.wardNumber}${detail.name?` · ${detail.name}`:''} · Ward details`} onClose={()=>setDetail(null)}><div className="detail-grid"><div className="detail-card"><h3>Ward</h3><p><b>Ward number:</b> {detail.wardNumber||'—'}</p><p><b>Activation:</b> <StatusPill>{detail.status||'INACTIVE'}</StatusPill></p><p><b>Name:</b> {detail.name||'N/A'}</p><p><b>Description:</b> {detail.description||'N/A'}</p></div><div className="detail-card"><h3>Areas / Colonies</h3><p><b>Total:</b> {(detail.areas||[]).length}</p>{(detail.areas||[]).map(a=><p key={a.id}><b>{a.name}</b> · {a.description||'No description'}</p>)}</div><div className="detail-card"><h3>Hierarchy</h3><p>Ward → Colony / Area → House → Family → Citizen</p><p className="muted">All records shown under this ward are scoped through this hierarchy. Activate the ward on Ward activation before residents can register.</p></div></div><div className="modal-actions"><button className="ghost-btn" onClick={()=>setDetail(null)}>Close</button></div></Modal>}
  {(edit||create)&&<Modal wide title={edit?`Edit ${edit.wardNumber}`:'Create ward'} onClose={()=>{setEdit(null);setCreate(null)}}><form className="form-grid" onSubmit={saveWard}><Field label="Ward number"><input required value={(edit||create).wardNumber||''} onChange={e=>(edit?setEdit:setCreate)({...((edit||create)),wardNumber:e.target.value})}/></Field><Field label="Ward name (optional)"><input value={(edit||create).name||''} onChange={e=>(edit?setEdit:setCreate)({...((edit||create)),name:e.target.value})}/></Field><Field className="span-2" label="Ward description"><textarea value={(edit||create).description||''} onChange={e=>(edit?setEdit:setCreate)({...((edit||create)),description:e.target.value})}/></Field>{!edit&&<div className="span-2"><p className="activation-form-note">New wards stay inactive until you open them on Ward activation. Inactive wards do not appear on resident registration.</p><div className="section-label">Areas / Colonies in this ward</div>{(create.areas||[]).map((a,i)=><div className="inline-form-row" key={i}><input placeholder="Area / Colony name" value={a.name} onChange={e=>setCreate({...create,areas:create.areas.map((x,j)=>j===i?{...x,name:e.target.value}:x)})}/><input placeholder="Description / location" value={a.description} onChange={e=>setCreate({...create,areas:create.areas.map((x,j)=>j===i?{...x,description:e.target.value}:x)})}/><button type="button" className="small-btn danger" onClick={()=>setCreate({...create,areas:create.areas.filter((_,j)=>j!==i)})}>Remove</button></div>)}<button type="button" className="small-btn" onClick={()=>setCreate({...create,areas:[...(create.areas||[]),{...emptyArea}]})}>+ Add another area</button></div>}<div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>{setEdit(null);setCreate(null)}}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':edit?'Save changes':'Create ward'}</button></div></form></Modal>}
  {areaEdit&&<Modal title={`Edit area · ${areaEdit.name}`} onClose={()=>setAreaEdit(null)}><form className="form-grid" onSubmit={saveArea}><Field label="Area / Colony name"><input required value={areaEdit.name} onChange={e=>setAreaEdit({...areaEdit,name:e.target.value})}/></Field><Field className="span-2" label="Description / location"><textarea value={areaEdit.description||''} onChange={e=>setAreaEdit({...areaEdit,description:e.target.value})}/></Field><div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>setAreaEdit(null)}>Cancel</button><button className="primary-btn">Save area</button></div></form></Modal>}
  {areaCreate&&<Modal title="Add area / colony" onClose={()=>setAreaCreate(null)}><form className="form-grid" onSubmit={saveArea}><Field className="span-2" label="Area / Colony name"><input required value={areaCreate.name} onChange={e=>setAreaCreate({...areaCreate,name:e.target.value})}/></Field><Field className="span-2" label="Description / location"><textarea value={areaCreate.description} onChange={e=>setAreaCreate({...areaCreate,description:e.target.value})}/></Field><div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>setAreaCreate(null)}>Cancel</button><button className="primary-btn">Add area</button></div></form></Modal>}
 </div>;
}
