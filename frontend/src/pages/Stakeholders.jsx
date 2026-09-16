import React,{useEffect,useMemo,useState} from 'react';
import {api} from '../services/api';
import {Empty,ErrorBox,Loading,Modal,PageHeader,SearchableSelect} from '../components/Ui';

const P=[
 {id:'VIEW_DASHBOARD',label:'Dashboard'},
 {id:'VIEW_CHAT',label:'Chat & Groups'},
 {id:'VIEW_HOUSES',label:'Houses'},
 {id:'VIEW_FAMILIES',label:'Families'},
 {id:'VIEW_CITIZENS',label:'Citizens'},
 {id:'VIEW_VOTERS',label:'Voters'},
 {id:'VIEW_COMPLAINTS',label:'View complaints'},
 {id:'CREATE_COMPLAINTS',label:'Create complaints'},
 {id:'EDIT_COMPLAINTS',label:'Edit complaints'},
 {id:'ASSIGN_COMPLAINTS',label:'Assign complaints'},
 {id:'VIEW_BIRTHDAYS',label:'Birthdays'},
 {id:'VIEW_SCHEMES',label:'Schemes'},
 {id:'VIEW_WARD_INFORMATION',label:'Ward information'},
 {id:'VIEW_ELECTION_DATA',label:'Election data'},
 {id:'VIEW_WARD_UPDATES',label:'Ward updates'}
];

function typeLabel(role){
 if(role==='SOCIAL_WORKER') return 'Social Worker (Samaj Sevak)';
 if(role==='CANDIDATE') return 'Former Nagarsevak / Candidate';
 return role||'—';
}

export default function Stakeholders(){
 const [rows,setRows]=useState(null),[wards,setWards]=useState([]),[edit,setEdit]=useState(null),[error,setError]=useState('');
 const [wardId,setWardId]=useState(''),[type,setType]=useState(''),[search,setSearch]=useState('');
 const load=()=>api.stakeholders().then(r=>setRows(r.data||[])).catch(e=>setError(e.message));
 useEffect(()=>{load();api.wards().then(r=>setWards(r.data||[])).catch(e=>setError(e.message))},[]);
 const filtered=useMemo(()=>{
  const q=search.trim().toLowerCase();
  return (rows||[]).filter(r=>(!wardId||String(r.wardId)===String(wardId))&&(!type||r.role===type)&&(!q||[r.name,r.email,r.mobile,r.ward?.wardNumber,r.ward?.name,typeLabel(r.role)].filter(Boolean).some(v=>String(v).toLowerCase().includes(q))));
 },[rows,wardId,type,search]);
 if(!rows)return <Loading/>;
 const wardOptions=[{value:'',label:'All wards'},...wards.map(w=>({value:String(w.id),label:`${w.wardNumber}${w.name?` · ${w.name}`:''}`}))];
 return (
  <div className="community-page">
   <PageHeader
    title="Community Members"
    subtitle="Create a login for a former Nagarsevak who is no longer elected, or for a Samaj Sevak (social worker) who needs WardDesk. Then choose exactly which screens they can open."
    action={<button className="primary-btn" onClick={()=>setEdit({new:true,type:'SOCIAL_WORKER',permissions:['VIEW_DASHBOARD','VIEW_CHAT']})}>+ Add community member</button>}
   />
   <ErrorBox error={error}/>
   <div className="info-note community-intro">Use this section when someone is not the sitting Nagarsevak but still needs the software — for example an unelected former Nagarsevak, or a social worker. Sitting Nagarsevaks stay in Nagarsevak & Employees. Move an unelected Nagarsevak from that page, or add a new Samaj Sevak here and grant permissions.</div>
   <div className="filter-toolbar community-filter-toolbar">
    <SearchableSelect label="Ward" value={wardId} onChange={setWardId} options={wardOptions} placeholder="All wards"/>
    <label>Type
     <select value={type} onChange={e=>setType(e.target.value)}>
      <option value="">All types</option>
      <option value="SOCIAL_WORKER">Social Worker (Samaj Sevak)</option>
      <option value="CANDIDATE">Former Nagarsevak / Candidate</option>
     </select>
    </label>
    <label className="grow">Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email, mobile, ward…"/></label>
    <button type="button" className="small-btn" onClick={()=>{setWardId('');setType('');setSearch('')}}>Clear filters</button>
   </div>
   {!filtered.length?<Empty>No community members match the selected filters.</Empty>:<div className="panel"><div className="table-wrap"><table>
    <thead><tr><th>Name</th><th>Type</th><th>Ward</th><th>Mobile</th><th>Permissions</th><th>Action</th></tr></thead>
    <tbody>{filtered.map(r=>(
     <tr key={r.id}>
      <td><strong>{r.name}</strong><div className="muted">{r.email||'—'}</div></td>
      <td>{typeLabel(r.role)}</td>
      <td>{r.ward?.wardNumber||'—'}{r.ward?.name?` · ${r.ward.name}`:''}</td>
      <td>{r.mobile||'—'}</td>
      <td>{r.permissions?.length||0} granted</td>
      <td><button className="small-btn" onClick={()=>setEdit(r)}>Permissions</button></td>
     </tr>
    ))}</tbody>
   </table></div></div>}
   {edit&&<Modal wide title={edit.new?'Add community member':`Permissions · ${edit.name}`} onClose={()=>setEdit(null)}>
    <StakeholderForm value={edit} wards={wards} onClose={()=>setEdit(null)} onSaved={()=>{setEdit(null);load()}}/>
   </Modal>}
  </div>
 );
}

function StakeholderForm({value,wards,onClose,onSaved}){
 const draftKey=`ward_stakeholder_draft_${value.new?'new':value.id}`;
 const [f,setF]=useState(()=>{
  const base={name:value.name||'',email:value.email||'',mobile:value.mobile||'',password:'',wardId:value.wardId||'',type:value.type||value.role||'SOCIAL_WORKER',permissions:value.permissions||['VIEW_DASHBOARD','VIEW_CHAT']};
  try{return {...base,...JSON.parse(sessionStorage.getItem(draftKey)||'{}'),password:''}}catch{return base}
 });
 const [busy,setBusy]=useState(false),[err,setErr]=useState('');
 useEffect(()=>{try{sessionStorage.setItem(draftKey,JSON.stringify({...f,password:''}))}catch{}},[f,draftKey]);
 const toggle=p=>setF(x=>({...x,permissions:x.permissions.includes(p)?x.permissions.filter(a=>a!==p):[...x.permissions,p]}));
 async function save(e){
  e.preventDefault();setBusy(true);setErr('');
  try{
   if(value.new)await api.createStakeholder(f);
   else await api.updateStakeholder(value.id,f);
   try{sessionStorage.removeItem(draftKey)}catch{}
   onSaved();
  }catch(e){setErr(e.message)}finally{setBusy(false)}
 }
 return (
  <form className="form-grid" onSubmit={save}>
   {err&&<div className="error-box span-2">{err}</div>}
   <p className="muted span-2">Grant only the modules this person should use. Dashboard and Chat stay available so they can sign in.</p>
   <label>Name<input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label>
   <label>Type
    <select value={f.type} disabled={!value.new} onChange={e=>setF({...f,type:e.target.value})}>
     <option value="SOCIAL_WORKER">Social Worker (Samaj Sevak)</option>
     <option value="CANDIDATE">Former Nagarsevak / Candidate</option>
    </select>
   </label>
   <label>Email<input type="email" required value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label>
   <label>Mobile<input required maxLength="10" value={f.mobile} onChange={e=>setF({...f,mobile:e.target.value.replace(/\D/g,'').slice(0,10)})}/></label>
   <label>Ward
    <select required value={f.wardId} onChange={e=>setF({...f,wardId:e.target.value})}>
     <option value="">Select ward</option>
     {wards.map(w=><option key={w.id} value={w.id}>{w.wardNumber} · {w.name}</option>)}
    </select>
   </label>
   {value.new&&<label>Password<input type="password" minLength="8" required value={f.password} onChange={e=>setF({...f,password:e.target.value})} autoComplete="new-password"/></label>}
   <div className="span-2">
    <h3>Permissions</h3>
    <div className="community-perm-grid">
     {P.map(p=>(
      <label key={p.id} className="community-perm-check">
       <input type="checkbox" checked={f.permissions.includes(p.id)} onChange={()=>toggle(p.id)}/>
       <span>{p.label}</span>
      </label>
     ))}
    </div>
   </div>
   <div className="modal-actions span-2">
    <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
    <button className="primary-btn" disabled={busy}>{busy?'Saving…':'Save permissions'}</button>
   </div>
  </form>
 );
}
