import React,{useEffect,useState} from 'react';
import {api} from '../services/api';
import {Empty,ErrorBox,Loading,Modal,PageHeader,PaginationBar,RowMenu,StatusPill} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {useWardFilter} from '../wardFilter';
import {can} from '../rbac';
import PersonForm,{emptyPerson,presenceLine} from '../components/PersonForm';
import DeathAction from '../components/DeathAction';
import {housePlace,placeLine} from '../location';
import {MapPreview} from '../components/LocationMap';

function occupationLabel(p){
 if(p.occupationType==='BUSINESS') return `Business · ${p.businessName||'N/A'}`;
 if(p.occupationType==='SERVICE') return `${p.companyName||'Service'} · ${p.employmentType||'N/A'}`;
 return p.occupation||'Other';
}

export default function People(){
 const {selectedWardId}=useWardFilter();
 const [rows,setRows]=useState(null),[families,setFamilies]=useState([]),[wards,setWards]=useState([]);
 const [search,setSearch]=useState(''),[page,setPage]=useState(1),[limit,setLimit]=useState(25),[meta,setMeta]=useState({total:0,page:1,limit:25});
 const [showFilters,setShowFilters]=useState(false),[voterStatus,setVoterStatus]=useState('');
 const [detail,setDetail]=useState(null),[edit,setEdit]=useState(null),[add,setAdd]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){
  try{
   setError('');
   const r=await api.persons({page,limit,search:search.trim(),wardId:selectedWardId||undefined,status:'ACTIVE',voterStatus:voterStatus||undefined});
   setRows(r.data||[]);setMeta(r.meta||{total:(r.data||[]).length,page,limit});
  }catch(e){setError(e.message);setRows([])}
 }
 useEffect(()=>{setPage(1)},[selectedWardId,search,voterStatus]);
 useEffect(()=>{const t=setTimeout(load,220);return()=>clearTimeout(t)},[selectedWardId,search,voterStatus,page,limit]);
 useEffect(()=>{
  Promise.all([api.families({limit:500,wardId:selectedWardId||undefined}),api.wards()])
   .then(([f,w])=>{setFamilies(f.data||[]);setWards(w.data||[])})
   .catch(e=>setError(e.message));
 },[selectedWardId]);
 const total=Number(meta.total||0),pages=Math.max(1,Math.ceil(total/limit));
 async function openPerson(id){try{setError('');const r=await api.person(id);if(!r?.data)throw new Error('Citizen details could not be loaded.');setDetail(r.data)}catch(e){setError(e.message)}}
 async function save(e){e.preventDefault();setBusy(true);try{const payload={...((edit||add))};delete payload.age;delete payload.voterProfile;delete payload.family;delete payload.house;delete payload.documents;delete payload.birthday;delete payload.deathObservance;delete payload.deathRecord;if(edit)await api.updatePerson(edit.id,payload);else await api.createPerson(payload);setEdit(null);setAdd(null);await load();if(detail?.id)await openPerson(detail.id)}catch(e){setError(e.message)}finally{setBusy(false)}}
 const wardFamilies=families.filter(f=>!selectedWardId||f.house?.area?.wardId===selectedWardId||f.house?.area?.ward?.id===selectedWardId);
 return <div className="admin-data-page people-page">
  <PageHeader kicker="People & houses" title="All citizens" subtitle="Search the complete citizen register by name, mobile, job, company, business or other profile information." action={can('CREATE_CITIZENS')?<button className="primary-btn" onClick={()=>setAdd({...emptyPerson,familyId:''})}>+ Add citizen</button>:null}/>
  <ErrorBox error={error}/>
  <div className="citizen-search-bar">
   <WardFilter/>
   <input className="citizen-main-search" placeholder="Search name, mobile, job, company, business…" value={search} onChange={e=>setSearch(e.target.value)}/>
   <button type="button" className={`small-btn ${showFilters?'active-filter':''}`} onClick={()=>setShowFilters(v=>!v)}>Filters {showFilters?'▲':'▼'}</button>
  </div>
  {showFilters&&<div className="citizen-advanced-filters"><label>Voter status<select value={voterStatus} onChange={e=>setVoterStatus(e.target.value)}><option value="">All</option><option value="VOTER">Voter</option><option value="NON_VOTER">Non-Voter</option></select></label><button type="button" className="small-btn" onClick={()=>{setVoterStatus('');setSearch('')}}>Clear filters</button></div>}
  {!rows?<Loading/>:!rows.length?<Empty>No citizens found for the selected ward/search.</Empty>:<div className="panel table-wrap"><table><thead><tr><th>Citizen</th><th>DOB / Age</th><th>Family</th><th>Occupation / Job</th><th>House / Ward</th><th>Voter</th><th/></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td data-label="Citizen"><button className="table-link" onClick={()=>openPerson(p.id)}><strong>{p.fullName}</strong></button><div className="muted">{p.mobile||'—'}</div></td><td data-label="DOB / Age">{p.dob||'—'}<div className="muted">{p.age==null?'Age not available':`${p.age} years`}</div></td><td data-label="Family">{p.family?.familyName||'—'}</td><td data-label="Occupation / Job">{occupationLabel(p)}</td><td data-label="House / Ward">{p.family?.house?.houseNumber||'—'}<div className="muted">{p.family?.house?.area?.ward?.wardNumber||''}</div></td><td data-label="Voter"><StatusPill>{p.voterProfile?.status||'NOT_SPECIFIED'}</StatusPill></td><td data-label="Actions"><RowMenu items={[
     {label:'View details',onClick:()=>openPerson(p.id)},
     can('EDIT_CITIZENS')&&{label:'Edit',onClick:async()=>{try{setError('');const r=await api.person(p.id);const row=r?.data||p;setEdit({...row,isVoter:row.voterProfile?.status==='VOTER'?'VOTER':row.voterProfile?.status==='NON_VOTER'?'NON_VOTER':'',officialVoterIdRef:row.voterProfile?.officialVoterIdRef||'',votingWard:row.voterProfile?.votingWard||'',constituency:row.voterProfile?.constituency||''})}catch(e){setError(e.message)}}},
     can('CREATE_DEATH_RECORDS')&&{label:'Mark deceased',danger:true,node:<DeathAction person={p} onSaved={load}/>},
     can('DELETE_CITIZENS')&&{label:'Delete',danger:true,onClick:async()=>{if(confirm('Move citizen to recycle bin?')){try{await api.deletePerson(p.id);await load()}catch(e){setError(e.message)}}}}
    ]}/></td></tr>)}</tbody></table></div>}
  {rows&&<PaginationBar page={page} pages={pages} total={total} limit={limit} onPage={setPage} onLimit={setLimit}/>}
  {detail&&<Modal wide title={`${detail.fullName} · Complete profile`} onClose={()=>setDetail(null)}><div className="detail-grid"><div className="detail-card"><h3>Citizen</h3><p><b>Name:</b> {detail.fullName}</p><p><b>Mobile:</b> {detail.mobile||'—'}</p><p><b>DOB / Age:</b> {detail.dob||'—'} · {detail.age==null?'—':`${detail.age} years`}</p><p><b>Gender:</b> {detail.gender||'—'}</p><p><b>Email:</b> {detail.email||'—'}</p><p><b>Where now:</b> {presenceLine(detail)||'—'}</p></div><div className="detail-card"><h3>Occupation / Job</h3><p><b>Type:</b> {detail.occupationType||'—'}</p>{detail.occupationType==='BUSINESS'?<><p><b>Business:</b> {detail.businessName||'—'}</p><p><b>Business address:</b> {detail.businessAddress||'—'}</p></>:detail.occupationType==='SERVICE'?<><p><b>Company:</b> {detail.companyName||'—'}</p><p><b>Employment:</b> {detail.employmentType||'—'}</p></>:<p><b>Occupation:</b> {detail.occupation||'—'}</p>}</div><div className="detail-card"><h3>Voter</h3><p><b>Status:</b> {detail.voterProfile?.status||'NOT_SPECIFIED'}</p><p><b>Voting ward:</b> {detail.voterProfile?.votingWard||'—'}</p><p><b>Voter ID:</b> {detail.voterProfile?.officialVoterIdRef||'—'}</p><p><b>Constituency:</b> {detail.voterProfile?.constituency||'—'}</p></div></div><div className="detail-card"><h3>Family & household</h3><p><b>Family:</b> {detail.family?.familyName||'—'}</p><p><b>Path:</b> {housePlace(detail.family?.house)||'—'}</p><p><b>House:</b> {detail.family?.house?.houseNumber||'—'}</p><p><b>Address:</b> {detail.family?.house?.address||'—'}</p><p><b>City / pincode:</b> {placeLine([detail.family?.house?.city||detail.family?.house?.area?.city,detail.family?.house?.pincode||detail.family?.house?.area?.pincode])||'—'}</p><p><b>Ward:</b> {detail.family?.house?.area?.ward?.wardNumber||'—'} · {detail.family?.house?.area?.ward?.name||''}</p><p><b>Colony:</b> {detail.family?.house?.area?.name||'—'}</p><MapPreview lat={detail.family?.house?.latitude} lng={detail.family?.house?.longitude} label={detail.family?.house?.houseNumber?`House ${detail.family.house.houseNumber}`:'This home'}/><div className="member-grid">{(detail.family?.members||[]).map(m=><div className="member-card" key={m.id}><strong>{m.fullName}</strong><span>{m.age==null?'Age unavailable':`${m.age} years`} · {m.mobile||'—'}</span><span>{occupationLabel(m)}</span>{presenceLine(m)?<span>{presenceLine(m)}</span>:null}</div>)}</div></div><div className="detail-card"><h3>Documents</h3><div className="image-grid">{detail.voterIdImage&&<div><strong>Voter ID</strong><img src={detail.voterIdImage} alt="Voter ID"/></div>}{detail.aadhaarImage&&<div><strong>Aadhaar</strong><img src={detail.aadhaarImage} alt="Aadhaar"/></div>}{detail.panCardImage&&<div><strong>PAN</strong><img src={detail.panCardImage} alt="PAN"/></div>}{!detail.voterIdImage&&!detail.aadhaarImage&&!detail.panCardImage&&<p className="muted">No optional documents uploaded.</p>}</div></div><div className="modal-actions"><button className="ghost-btn" onClick={()=>setDetail(null)}>Close</button>{can('EDIT_CITIZENS')&&<button className="primary-btn" onClick={()=>{setEdit({...detail,isVoter:detail.voterProfile?.status==='VOTER'?'VOTER':detail.voterProfile?.status==='NON_VOTER'?'NON_VOTER':'',officialVoterIdRef:detail.voterProfile?.officialVoterIdRef||'',votingWard:detail.voterProfile?.votingWard||'',constituency:detail.voterProfile?.constituency||''});setDetail(null)}}>Edit profile</button>}</div></Modal>}
  {(edit||add)&&<Modal wide title={edit?`Edit ${edit.fullName}`:'Add citizen'} onClose={()=>{setEdit(null);setAdd(null)}}><PersonForm value={edit||add} onChange={edit?setEdit:setAdd} families={wardFamilies} wards={wards} onSubmit={save} onCancel={()=>{setEdit(null);setAdd(null)}} busy={busy}/></Modal>}
 </div>;
}
