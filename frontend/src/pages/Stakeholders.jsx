import React,{useEffect,useMemo,useState} from 'react';
import {api} from '../services/api';
import {Empty,ErrorBox,Loading,Modal,PageHeader,SearchableSelect} from '../components/Ui';
import {formatWardLabel} from '../wardFormat';
import TeamNav from '../components/TeamNav';
import { UsersIcon, UserCheckIcon, BuildingIcon, ShieldIcon, PhoneIcon } from '../components/Icons';

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

 async function deleteMember(record) {
  if (!window.confirm(`Delete community member ${record.name}? This will remove their login account.`)) return;
  setError('');
  try {
   await api.deleteStakeholder(record.id);
   await load();
   window.dispatchEvent(new CustomEvent('ward:toast', { detail: { type: 'success', message: `${record.name} removed successfully.` } }));
  } catch (e) {
   setError(e.message || 'Unable to delete community member.');
  }
 }

 const stats = useMemo(() => {
  const list = rows || [];
  return {
   total: list.length,
   socialWorkers: list.filter(r => r.role === 'SOCIAL_WORKER').length,
   candidates: list.filter(r => r.role === 'CANDIDATE').length,
   wardsCovered: new Set(list.map(r => r.wardId).filter(Boolean)).size
  };
 }, [rows]);

 const filtered=useMemo(()=>{
  const q=search.trim().toLowerCase();
  return (rows||[]).filter(r=>(!wardId||String(r.wardId)===String(wardId))&&(!type||r.role===type)&&(!q||[r.name,r.email,r.mobile,r.ward?.wardNumber,r.ward?.name,typeLabel(r.role)].filter(Boolean).some(v=>String(v).toLowerCase().includes(q))));
 },[rows,wardId,type,search]);
 if(!rows)return <Loading/>;
 const wardOptions=[{value:'',label:'All wards'},...wards.map(w=>({value:String(w.id),label:formatWardLabel(w)}))];
 return (
  <div className="community-page">
   <PageHeader
    title="Community Members"
    action={<button className="primary-btn" onClick={()=>setEdit({new:true,type:'SOCIAL_WORKER',permissions:['VIEW_DASHBOARD','VIEW_CHAT']})}>+ Add community member</button>}
   />

   <TeamNav current="stakeholders" />

   <ErrorBox error={error}/>

   <div className="team-kpi-grid">
    <div className="team-kpi-card">
     <div className="team-kpi-icon blue">
      <UsersIcon size={20} />
     </div>
     <div className="team-kpi-info">
      <div className="team-kpi-val">{stats.total}</div>
      <div className="team-kpi-label">Total Members</div>
     </div>
    </div>
    <div className="team-kpi-card">
     <div className="team-kpi-icon green">
      <UserCheckIcon size={20} />
     </div>
     <div className="team-kpi-info">
      <div className="team-kpi-val">{stats.socialWorkers}</div>
      <div className="team-kpi-label">Social Workers</div>
     </div>
    </div>
    <div className="team-kpi-card">
     <div className="team-kpi-icon purple">
      <BuildingIcon size={20} />
     </div>
     <div className="team-kpi-info">
      <div className="team-kpi-val">{stats.candidates}</div>
      <div className="team-kpi-label">Former Nagarsevaks</div>
     </div>
    </div>
    <div className="team-kpi-card">
     <div className="team-kpi-icon amber">
      <ShieldIcon size={20} />
     </div>
     <div className="team-kpi-info">
      <div className="team-kpi-val">{stats.wardsCovered}</div>
      <div className="team-kpi-label">Wards Covered</div>
     </div>
    </div>
   </div>

   <div className="info-note community-intro" style={{ marginBottom: '16px' }}>Use this section when someone is not the sitting Nagarsevak but still needs the software — for example an unelected former Nagarsevak, or a social worker. Sitting Nagarsevaks stay in Nagarsevak & Employees. Move an unelected Nagarsevak from that page, or add a new Samaj Sevak here and grant permissions.</div>
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
    <thead><tr><th>Name</th><th>Type</th><th>Ward</th><th>Mobile</th><th>Permissions</th><th style={{ textAlign: 'center' }}>Action</th></tr></thead>
    <tbody>{filtered.map(r=>(
     <tr key={r.id}>
      <td data-label="Name">
       <div className="team-user-cell">
        <div className="team-avatar-initials community">
         {(r.name || 'C').slice(0, 2).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
         <strong style={{ display: 'block', color: 'var(--text, #0f172a)' }}>{r.name}</strong>
         <div className="muted">{r.email||'—'}</div>
        </div>
       </div>
      </td>
      <td data-label="Type">
       <span className={`team-badge ${r.role==='SOCIAL_WORKER'?'green':'purple'}`}>
        {typeLabel(r.role)}
       </span>
      </td>
      <td data-label="Ward">{formatWardLabel(r.ward)}</td>
      <td data-label="Mobile">
       {r.mobile ? (
        <a href={`tel:${r.mobile}`} className="team-contact-link notranslate" translate="no">
         <PhoneIcon size={12} />
         <span>{r.mobile}</span>
        </a>
       ) : '—'}
      </td>
      <td data-label="Permissions">
       <span className="team-badge blue">
        {r.permissions?.length||0} granted
       </span>
      </td>
      <td data-label="Actions" style={{ textAlign: 'center' }}>
       <div className="team-action-btns" style={{ justifyContent: 'center' }}>
        <button
         type="button"
         className="btn-action outline-blue"
         onClick={()=>setEdit(r)}
         title="Edit profile & permissions"
        >
         Edit & Access
        </button>
        <button
         type="button"
         className="btn-action danger"
         onClick={()=>deleteMember(r)}
         title="Delete community member"
        >
         Delete
        </button>
       </div>
      </td>
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
     {wards.map(w=><option key={w.id} value={w.id}>{formatWardLabel(w)}</option>)}
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
