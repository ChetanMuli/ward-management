import React,{useEffect,useMemo,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {api,getUser} from '../services/api';
import {Empty,ErrorBox,Field,Loading,Modal,PageHeader,SearchableSelect,Toolbar,fmtDate} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {useWardFilter} from '../wardFilter';
import {isMaster,isNagarsevak,isEmployee,can} from '../rbac';

const addDays=(s,n)=>{const d=new Date(`${s}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const addYears=(s,n)=>{const d=new Date(`${s}T00:00:00Z`),y=d.getUTCFullYear()+n,m=d.getUTCMonth(),day=d.getUTCDate();d.setUTCFullYear(y,m,day);if(m===1&&day===29&&d.getUTCMonth()!==1)d.setUTCFullYear(y,1,28);return d.toISOString().slice(0,10)};
const display=s=>s?new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(`${s}T00:00:00Z`)):'—';

function personLabel(p){
 const ward=p?.family?.house?.area?.ward;
 const house=p?.family?.house?.houseNumber;
 return `${p?.fullName||'N/A'} · ${p?.mobile||'N/A'}${house?` · ${house}`:''}${ward?` · ${ward.wardNumber}`:''}`;
}

export default function Deaths(){
 const user=getUser(),{selectedWardId}=useWardFilter();
 const location=useLocation();
 const [rows,setRows]=useState(null),[people,setPeople]=useState([]),[search,setSearch]=useState(''),[filterMode,setFilterMode]=useState('latest'),[windowKey,setWindowKey]=useState('latest25'),[recordStatus,setRecordStatus]=useState('ACTIVE'),[detail,setDetail]=useState(null),[fromDate,setFromDate]=useState(''),[toDate,setToDate]=useState(''),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(25),[dateType,setDateType]=useState('death'),[form,setForm]=useState({personId:'',dateOfDeath:'',notes:''}),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const canCreate=isMaster(user)||isNagarsevak(user)||isEmployee(user)||can('CREATE_DEATH_RECORDS',user);

 async function load(){
  try{setError('');const [d,p]=await Promise.all([
    api.deathRecords({limit:500,wardId:selectedWardId||undefined,search:search||undefined,recordStatus}),
    api.persons({limit:500,wardId:selectedWardId||undefined})
  ]);setRows(d.data||[]);setPeople(p.data||[]);}
  catch(e){setError(e.message);setRows([])}
 }
 useEffect(()=>{setPage(1);const t=setTimeout(load,250);return()=>clearTimeout(t)},[selectedWardId,search,recordStatus]);
 useEffect(()=>{
  const id=new URLSearchParams(location.search).get('open');
  if(!id||!rows?.length)return;
  const found=rows.find(r=>String(r.id)===String(id)||String(r.deathRecordId)===String(id)||String(r.personId)===String(id));
  if(found)setDetail(found);
 },[location.search,rows]);
 const activePeople=useMemo(()=>people.filter(p=>p.status!=='DECEASED'),[people]);
 const windows=useMemo(()=>filterMode==='upcoming'?[{key:'next7',label:'Next 7 days',days:7},{key:'next15',label:'Next 15 days',days:15},{key:'next30',label:'Next 30 days',days:30},{key:'next90',label:'Next 90 days',days:90}]:filterMode==='previous'?[{key:'prev7',label:'Previous 7 days',days:7},{key:'prev15',label:'Previous 15 days',days:15},{key:'prev30',label:'Previous 30 days',days:30},{key:'prev90',label:'Previous 90 days',days:90}]:[{key:'latest10',label:'Latest 10 records',count:10},{key:'latest25',label:'Latest 25 records',count:25},{key:'latest50',label:'Latest 50 records',count:50},{key:'latest100',label:'Latest 100 records',count:100}], [filterMode]);
 const visibleRows=useMemo(()=>{
  const sorted=[...(rows||[])].sort((a,b)=>new Date(`${b.dateOfDeath}T00:00:00Z`)-new Date(`${a.dateOfDeath}T00:00:00Z`));
  const day=new Date();day.setHours(0,0,0,0);
  const dateVal=(r)=>dateType==='anniversary'?r.firstDeathAnniversary:dateType==='tenth'?r.tenthDay:r.dateOfDeath;
  if(filterMode==='latest'){return sorted}
  if(filterMode==='custom'){return sorted.filter(r=>{const d=dateVal(r);return d&&(!fromDate||d>=fromDate)&&(!toDate||d<=toDate)})}
  const days=Number(windowKey.replace(filterMode==='upcoming'?'next':'prev',''))||30;
  const end=new Date(day);end.setDate(end.getDate()+days);const startD=new Date(day);startD.setDate(startD.getDate()-days);
  return sorted.filter(r=>{const d=dateVal(r);if(!d)return false;const x=new Date(`${d}T00:00:00`);return filterMode==='upcoming'?x>=day&&x<=end:x<day&&x>=startD});
 },[rows,filterMode,windowKey,fromDate,toDate,dateType]);
 useEffect(()=>{setPage(1)},[filterMode,windowKey,fromDate,toDate,dateType]);
 useEffect(()=>{const total=Math.max(1,Math.ceil(visibleRows.length/pageSize));if(page>total)setPage(total)},[visibleRows.length,page,pageSize]);
 function openCreate(){setForm({personId:'',dateOfDeath:new Date().toISOString().slice(0,10),notes:''});setOpen(true)}
 async function save(e){e.preventDefault();setBusy(true);try{
   const r=await api.createDeath(form.personId,{dateOfDeath:form.dateOfDeath,notes:form.notes});
   setOpen(false);await load();window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'success',message:r.message||'Death record added successfully.'}}));
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 async function restoreDeath(r){if(!confirm(`Restore ${r.person?.fullName||'this citizen'} as active?`))return;setBusy(true);try{await api.restoreDeath(r.id);setDetail(null);await load();}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div className="admin-data-page deaths-page">
  <PageHeader title="Death records" subtitle="Record a citizen's death without deleting historical data. The person is removed from active family/citizen lists and remains available here with full history." action={canCreate?<button className="primary-btn" onClick={openCreate}>+ Record death</button>:null}/>
  <ErrorBox error={error}/>
  <section className="panel death-filter-panel"><div className="death-filter-grid"><WardFilter/><SearchableSelect label="Record status" value={recordStatus} onChange={setRecordStatus} options={[{value:'ACTIVE',label:'Active death records'},{value:'RESTORED',label:'Restored records'},{value:'ALL',label:'All records'}]} placeholder="Select status…"/><SearchableSelect label="Record view" value={filterMode} onChange={v=>{setFilterMode(v);setWindowKey(v==='upcoming'?'next30':v==='previous'?'prev30':'latest25')}} options={[{value:'latest',label:'Latest records'},{value:'upcoming',label:'Upcoming events'},{value:'previous',label:'Previous events'},{value:'custom',label:'Custom date range'}]} placeholder="Select view…"/><SearchableSelect label="Date type" value={dateType} onChange={setDateType} options={[{value:'death',label:'Death date'},{value:'tenth',label:'10th day (Dahava)'},{value:'anniversary',label:'1st yearly Shraddha'}]} placeholder="Select date type…"/>{filterMode!=='latest'&&filterMode!=='custom'&&<SearchableSelect label="Period" value={windowKey} onChange={setWindowKey} options={windows.map(w=>({value:w.key,label:w.label}))} placeholder="Select period…"/>}<Field className="filter-search" label="Search"><input placeholder="Name, mobile, family, house, ward…" value={search} onChange={e=>setSearch(e.target.value)}/></Field>{filterMode==='custom'&&<><Field label="From date"><input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></Field><Field label="To date"><input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></Field></>}</div></section>
    {!rows?<Loading/>:!visibleRows.length?<Empty>No death records found for this ward/filter.</Empty>:<div className="panel table-wrap"><table><thead><tr><th>Citizen</th><th>Family / House</th><th>Date of death</th><th>10th day</th><th>1st death anniversary</th><th>Ward</th><th>Status</th><th/></tr></thead><tbody>{visibleRows.slice((Math.min(page,Math.max(1,Math.ceil(visibleRows.length/pageSize)))-1)*pageSize,Math.min(page,Math.max(1,Math.ceil(visibleRows.length/pageSize)))*pageSize).map(r=>{const p=r.person;return <tr key={r.id}>
   <td data-label="Citizen"><strong>{p?.fullName||'N/A'}</strong><div className="muted">{p?.mobile||'N/A'}</div></td>
   <td data-label="Family / House">{p?.family?.familyName||'N/A'}<div className="muted">{p?.family?.house?.houseNumber||'N/A'}</div></td>
   <td data-label="Date of death">{display(r.dateOfDeath)}</td><td data-label="10th day">{display(r.tenthDay)}</td><td data-label="1st death anniversary">{display(r.firstDeathAnniversary)}</td>
   <td data-label="Ward">{p?.family?.house?.area?.ward?.wardNumber||'N/A'}{p?.family?.house?.area?.name&&<div className="muted">{p.family.house.area.name}</div>}</td>
   <td data-label="Status">{r.recordStatus==='RESTORED'?'Restored':'Active'}</td>
   <td data-label="Actions"><div className="card-actions"><button className="small-btn view-btn" onClick={()=>setDetail(r)}>View full details</button>{r.recordStatus==='ACTIVE'&&<button className="small-btn" onClick={()=>restoreDeath(r)}>Restore</button>}</div></td>
  </tr>})}</tbody></table></div>}
  {rows&&visibleRows.length>0&&<div className="global-pagination death-pagination"><div className="pagination-meta"><div className="pagination-info">Showing {(Math.min(page,Math.max(1,Math.ceil(visibleRows.length/pageSize)))-1)*pageSize+1}–{Math.min(Math.min(page,Math.max(1,Math.ceil(visibleRows.length/pageSize)))*pageSize,visibleRows.length)} of {visibleRows.length}</div><label className="pagination-size">Rows per page<select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}}><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label></div><nav className="pagination-nav pagination-controls"><button className="small-btn" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button><span>Page {Math.min(page,Math.max(1,Math.ceil(visibleRows.length/pageSize)))} of {Math.max(1,Math.ceil(visibleRows.length/pageSize))}</span><button className="small-btn" disabled={page>=Math.max(1,Math.ceil(visibleRows.length/pageSize))} onClick={()=>setPage(p=>p+1)}>Next</button></nav></div>}
  {detail&&<Modal wide title={`${detail.person?.fullName||'Citizen'} · Death record`} onClose={()=>setDetail(null)}>
   {(()=>{const p=detail.person||{},f=p.family||{},h=f.house||{},a=h.area||{},w=a.ward||{};return <div>
    <div className="death-highlight"><div><span>Date of death</span><strong>{display(detail.dateOfDeath)}</strong></div><div><span>10th day (Dahava)</span><strong>{display(detail.tenthDay)}</strong></div><div><span>1st yearly Shraddha</span><strong>{display(detail.firstDeathAnniversary)}</strong></div></div>
    <div className="detail-grid death-detail-grid">
     <div className="detail-card"><h3>Citizen</h3><p><b>Name:</b> {p.fullName||'N/A'}</p><p><b>Mobile:</b> {p.mobile||'N/A'}</p><p><b>Alternate mobile:</b> {p.alternateMobile||'N/A'}</p><p><b>Email:</b> {p.email||'N/A'}</p><p><b>DOB / Age:</b> {p.dob||'N/A'} · {p.age??'N/A'}</p><p><b>Gender:</b> {p.gender||'N/A'}</p></div>
     <div className="detail-card"><h3>Family & household</h3><p><b>Family:</b> {f.familyName||'N/A'}</p><p><b>House:</b> {h.houseNumber||'N/A'}</p><p><b>Address:</b> {h.address||'N/A'}</p><p><b>Area / Colony:</b> {a.name||'N/A'}</p><p><b>Ward:</b> {w.wardNumber||'N/A'} {w.name?`· ${w.name}`:''}</p></div>
     <div className="detail-card"><h3>Occupation & voter</h3><p><b>Occupation:</b> {p.occupation||p.occupationType||'N/A'}</p><p><b>Business:</b> {p.businessName||'N/A'}</p><p><b>Company:</b> {p.companyName||'N/A'}</p><p><b>Employment:</b> {p.employmentType||'N/A'}</p><p><b>Voter status:</b> {p.voterProfile?.status||'N/A'}</p><p><b>Voter ID:</b> {p.voterProfile?.officialVoterIdRef||'N/A'}</p></div>
    </div>
    <div className="detail-card"><h3>Death record</h3><p><b>Reported by:</b> {detail.reportedBy?.name||'N/A'} · {detail.reportedBy?.mobile||'N/A'}</p><p><b>Verification:</b> {detail.verificationStatus||'N/A'}</p><p><b>Previous voter status:</b> {detail.previousVoterStatus||'N/A'}</p><p><b>Record status:</b> {detail.recordStatus||'N/A'}{detail.restoredAt?` · Restored ${display(detail.restoredAt.slice(0,10))}`:''}</p><p><b>Notes:</b> {detail.notes||'N/A'}</p></div>
    <div className="detail-card"><h3>Former family members</h3>{(f.members||[]).filter(m=>m.id!==p.id).length?<div className="member-grid">{(f.members||[]).filter(m=>m.id!==p.id).map(m=><div className="member-card" key={m.id}><strong>{m.fullName}</strong><span>{m.age??'N/A'} years · {m.mobile||'N/A'}</span><span>{m.status||'ACTIVE'}</span></div>)}</div>:<p>No other family members recorded.</p>}</div>
   </div>})()}
   <div className="modal-actions"><button className="ghost-btn" onClick={()=>setDetail(null)}>Close</button>{detail.recordStatus==='ACTIVE'&&<button className="primary-btn" onClick={()=>restoreDeath(detail)}>Restore citizen</button>}</div>
  </Modal>}
  {open&&<Modal wide title="Record death" onClose={()=>setOpen(false)}><form className="form-grid" onSubmit={save}>
   <SearchableSelect className="span-2" label="Citizen" required value={form.personId} onChange={v=>setForm({...form,personId:v})} options={activePeople.map(p=>({value:p.id,label:personLabel(p)}))} placeholder="Search citizen to mark as deceased…"/>
   <Field label="Date of death"><input type="date" required max={new Date().toISOString().slice(0,10)} value={form.dateOfDeath} onChange={e=>setForm({...form,dateOfDeath:e.target.value})}/></Field>
   <Field className="span-2" label="Notes (optional)"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Optional death record notes"/></Field>
   <div className="detail-card span-2"><h3>Automatic dates</h3><p><b>10th day:</b> {form.dateOfDeath?display(addDays(form.dateOfDeath,10)):'—'}</p><p><b>1st yearly Shraddha:</b> {form.dateOfDeath?display(addYears(form.dateOfDeath,1)):'—'}</p><p className="muted">The death date is stored as the historical record. The citizen remains available in Death Records and is removed from active family/citizen lists.</p></div>
   <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>setOpen(false)}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':'Record death'}</button></div>
  </form></Modal>}
 </div>
}
