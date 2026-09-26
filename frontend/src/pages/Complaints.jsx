import React,{useEffect,useMemo,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {api,getUser} from '../services/api';
import {Empty,ErrorBox,Field,ImageField,MultiImageField,Loading,Modal,PageHeader,RowMenu,StatusPill,Toolbar,fmtDateTime,SearchableSelect,PaginationBar} from '../components/Ui';
import {packComplaintImages,parseComplaintImages} from '../complaintMedia';
import {getAccurateLocation} from '../location';
import WardFilter from '../components/WardFilter';
import {useWardFilter} from '../wardFilter';
import {can,isEmployee,isNagarsevak,isMaster,isSubMaster} from '../rbac';

const statuses=['SUBMITTED','PENDING','ASSIGNED','IN_PROGRESS','RESOLVED','REOPENED','CLOSED'];
const blank={houseId:'',citizenPersonId:'',location:'',description:'',reportedImages:[]};
const wa=(mobile,message)=>{let n=String(mobile||'').replace(/\D/g,'');if(n.length===10)n='91'+n;if(n.length<11)throw new Error('Valid mobile number is not available for WhatsApp.');window.open(`https://wa.me/${n}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer')};

export default function Complaints(){
 const user=getUser();const location=useLocation();const {selectedWardId}=useWardFilter();
 const [rows,setRows]=useState(null),[meta,setMeta]=useState({total:0,page:1,limit:25}),[page,setPage]=useState(1),[limit,setLimit]=useState(25),[filters,setFilters]=useState({search:'',status:'',assignedEmployeeId:''});
 const [showFilters,setShowFilters]=useState(false);
 const [people,setPeople]=useState([]),[houses,setHouses]=useState([]),[employees,setEmployees]=useState([]),[nagarsevaks,setNagarsevaks]=useState([]);
 const [open,setOpen]=useState(false),[detail,setDetail]=useState(null),[editing,setEditing]=useState(null),[assigning,setAssigning]=useState(null);
 const [form,setForm]=useState(blank),[error,setError]=useState(''),[busy,setBusy]=useState(false),[locating,setLocating]=useState(false),[previewImage,setPreviewImage]=useState(null);

 const handleGetLocation = async () => {
   try {
     setLocating(true);
     setError('');
     const loc = await getAccurateLocation({ timeout: 15000, desiredAccuracy: 25 });
     setForm(prev => ({
       ...prev,
       location: loc.formatted || loc.address || `GPS: ${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`
     }));
   } catch (err) {
     setError(err.message || 'Could not retrieve GPS location.');
   } finally {
     setLocating(false);
   }
 };

 async function load(nextFilters=filters,nextPage=page,nextLimit=limit){
   try{
    setError('');
    const p={...nextFilters,page:nextPage,limit:nextLimit,wardId:selectedWardId||undefined};
    const r=await api.complaints(p);
    setRows(r.data||[]);setMeta(r.meta||{total:(r.data||[]).length,page:nextPage,limit:nextLimit});
   }catch(e){setError(e.message);setRows([]);setMeta({total:0,page:1,limit:nextLimit})}
 }
 async function loadReferences(){
   try{
     const canViewStaff = can('VIEW_STAFF') || isMaster(user) || isNagarsevak(user);
     const canViewCitizens = can('VIEW_CITIZENS') || isMaster(user) || isNagarsevak(user);
     const canViewHouses = can('VIEW_HOUSES') || isMaster(user) || isNagarsevak(user);
     const [p,h,e,n]=await Promise.all([
       canViewCitizens ? api.persons({limit:500,wardId:selectedWardId||undefined}).catch(()=>({data:[]})) : Promise.resolve({data:[]}),
       canViewHouses ? api.houses({limit:500,wardId:selectedWardId||undefined}).catch(()=>({data:[]})) : Promise.resolve({data:[]}),
       canViewStaff ? api.employees({limit:500,wardId:selectedWardId||undefined}).catch(()=>({data:[]})) : Promise.resolve({data:[]}),
       canViewStaff ? api.corporators({limit:100,page:1,wardId:selectedWardId||undefined}).catch(()=>({data:[]})) : Promise.resolve({data:[]})
     ]);
     setPeople(p.data||[]);setHouses(h.data||[]);setEmployees(e.data||[]);setNagarsevaks(n.data||[]);
   }catch(_){}
 }
 useEffect(()=>{loadReferences()},[selectedWardId]);
 useEffect(()=>{setPage(1)},[selectedWardId,filters.search,filters.status,filters.assignedEmployeeId]);
 useEffect(()=>{const t=setTimeout(()=>load(filters,page,limit),300);return()=>clearTimeout(t)},[selectedWardId,filters.search,filters.status,filters.assignedEmployeeId,page,limit]);
 const pages=Math.max(1,Math.ceil((meta.total||0)/(meta.limit||limit)));
 const wardPeople=people,wardHouses=houses;
 const assignable=employees.filter(e=>isMaster(user)||e.managerUserId===user?.id);
 const visible=useMemo(()=>rows||[],[rows]);

 function resetFilters(){const emptyFilters={search:'',status:'',assignedEmployeeId:''};setFilters(emptyFilters);setPage(1);setShowFilters(false);}
 async function create(e){e.preventDefault();setBusy(true);try{await api.createComplaint({...form,category:'OTHER',priority:'MEDIUM',reportedImages:form.reportedImages||[],reportedImage:packComplaintImages(form.reportedImages||[])});setOpen(false);setForm({...blank});await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function update(e){e.preventDefault();setBusy(true);try{
   await api.updateComplaintStatus(editing.id,{
     status:editing.status,
     comment:editing.comment,
     resolutionNote:editing.resolutionNote,
     resolutionImages:editing.resolutionImages||[],
     resolutionImage:packComplaintImages(editing.resolutionImages||editing.resolutionImage||[])
   });
   setEditing(null);await load()
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 async function assign(){setBusy(true);try{
   if(assigning.assignToSelf){await api.assignComplaint(assigning.id,{assignToSelf:true});}
   else {if(!assigning.employeeId)throw new Error('Please select an employee or take the complaint yourself.');await api.assignComplaint(assigning.id,{employeeId:assigning.employeeId});}
   setAssigning(null);await load()
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 async function openDetail(id){try{setDetail((await api.complaint(id)).data)}catch(e){setError(e.message)}}
 useEffect(()=>{const params=new URLSearchParams(location.search);const id=params.get('open');const status=params.get('status');if(id)openDetail(id);if(status&&statuses.includes(status))setFilters(f=>({...f,status}))},[location.search]);

 const selectedEmployee=employees.find(e=>e.id===assigning?.employeeId);
 const selectedCitizen=people.find(p=>p.id===form.citizenPersonId);
 return <div className="admin-data-page complaints-page">
  <PageHeader kicker="Daily work" title="Complaints" action={can('CREATE_COMPLAINTS')?<button className="primary-btn" onClick={()=>{setError('');setOpen(true)}}>+ New complaint</button>:null}/>
  <ErrorBox error={error}/>
  <section className="panel complaint-filters">
   <div className="filter-panel-head"><div><span className="eyebrow">COMPLAINTS</span><h3>Find a complaint</h3><p>Use search first. Extra filters stay collapsed on mobile.</p></div><div className="filter-actions"><button type="button" className="small-btn filter-toggle" onClick={()=>setShowFilters(v=>!v)}>{showFilters?'Hide filters':'Filters'}{(filters.status||filters.assignedEmployeeId)?' · 1+':''}</button><button type="button" className="small-btn" onClick={resetFilters}>Reset</button></div></div>
   <div className="complaint-filter-grid">
    <WardFilter/>
    <Field className="filter-search" label="Search"><input placeholder="Complaint ID, citizen or mobile…" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/></Field>
    <div className={`complaint-extra-filters ${showFilters?'is-open':''}`}>
      <Field label="Status"><select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">All status</option>{statuses.map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></Field>
      {!isEmployee(user)&&assignable.length>0&&<SearchableSelect label="Employee" value={filters.assignedEmployeeId} onChange={v=>setFilters({...filters,assignedEmployeeId:v})} options={[{value:'',label:'All employees'},...assignable.map(e=>({value:e.id,label:`${e.User?.name||'Employee'}${e.designation?` · ${e.designation}`:''}`}))]} placeholder="Search employee…"/>}
    </div>
   </div>
  </section>
  {!rows?<Loading/>:!visible.length?<Empty>No complaints match the selected filters.</Empty>:<div className="panel table-wrap"><table><thead><tr><th>ID</th><th>Citizen</th><th>Problem</th><th>Ward</th><th>Status</th><th>Assignment</th><th>Created</th><th/></tr></thead><tbody>{visible.map(c=><tr key={c.id}>
   <td data-label="ID"><button className="table-link" onClick={()=>openDetail(c.id)}><strong>{c.complaintNumber}</strong></button></td>
   <td data-label="Citizen">{c.citizen?.fullName||c.submittedBy?.name||'Registered user'}<div className="muted">{c.citizen?.mobile||c.submittedBy?.mobile||c.submittedBy?.email||''}</div></td>
   <td data-label="Problem"><div>{c.description}</div>{parseComplaintImages(c.reportedImages||c.reportedImage)[0]&&<a href={parseComplaintImages(c.reportedImages||c.reportedImage)[0]} target="_blank" rel="noreferrer">{parseComplaintImages(c.reportedImages||c.reportedImage).length>1?`${parseComplaintImages(c.reportedImages||c.reportedImage).length} photos`:'Problem image'}</a>}{c.resolutionImage&&<><br/><a href={c.resolutionImage} target="_blank" rel="noreferrer">Completion image</a></>}</td>
   <td data-label="Ward">{c.ward?.wardNumber||c.house?.area?.ward?.wardNumber||'—'}<div className="muted">{c.ward?.name||c.house?.area?.ward?.name||''}</div></td><td data-label="Status"><StatusPill>{c.status}</StatusPill></td>
   <td data-label="Assignment"><div>Nagarsevak: <strong>{c.assignedNagarsevak?.name||c.assignedEmployee?.manager?.name||'Not assigned'}</strong></div><div className="muted">Employee: {c.assignedEmployee?.User?.name||'Not assigned'}</div></td>
   <td data-label="Created">{fmtDateTime(c.createdAt)}</td>
   <td data-label="Actions"><RowMenu items={[
     {label:'View details',onClick:()=>openDetail(c.id)},
     (isMaster(user)||isNagarsevak(user)||isSubMaster(user))&&{label:'Assign',onClick:()=>setAssigning({id:c.id,complaintNumber:c.complaintNumber,employeeId:c.assignedEmployeeId||'',assignToSelf:false})},
     can('EDIT_COMPLAINTS')&&(isEmployee(user)?c.assignedEmployeeId===user?.employeeProfile?.id:true)&&{label:'Update',onClick:()=>setEditing({...c,comment:'',resolutionNote:c.resolutionNote||'',resolutionImage:c.resolutionImage||null})},
     can('EDIT_COMPLAINTS')&&!isEmployee(user)&&c.status==='RESOLVED'&&{label:'Close',onClick:async()=>{if(!window.confirm(`Close complaint ${c.complaintNumber}?`))return;try{await api.updateComplaintStatus(c.id,{status:'CLOSED',comment:'Closed after resolution.'});await load()}catch(e){setError(e.message)}}},
     c.assignedEmployee?.manager?.mobile&&{label:'WhatsApp Nagarsevak',onClick:()=>{try{wa(c.assignedEmployee.manager.mobile,`Complaint ${c.complaintNumber}: ${c.status}. Please review/coordinate this complaint.`)}catch(e){setError(e.message)}}},
     can('DELETE_COMPLAINTS')&&{label:'Delete',danger:true,onClick:async()=>{if(!window.confirm(`Move complaint ${c.complaintNumber} to recycle bin?`))return;try{await api.deleteComplaint(c.id);await load()}catch(e){setError(e.message)}}}
   ]}/></td>
  </tr>)}</tbody></table></div>}
  {rows&&visible.length>0&&<PaginationBar page={page} pages={pages} total={meta.total||0} limit={limit} onPage={setPage} onLimit={setLimit}/>}

  {open&&<Modal wide title="New complaint" onClose={()=>setOpen(false)}><form className="form-grid admin-form" onSubmit={create}>
   <div className="form-section-title span-2"><strong>Who and where</strong><span>Select the citizen and the house this complaint belongs to.</span></div>
   <SearchableSelect label="Citizen" required value={form.citizenPersonId} onChange={v=>{const p=people.find(x=>x.id===v);setForm({...form,citizenPersonId:v,houseId:p?.family?.house?.id||''})}} options={wardPeople.map(p=>({value:p.id,label:`${p.fullName} · ${p.mobile||'no mobile'}`}))} placeholder="Search citizen…"/>
   <SearchableSelect label="House" required value={form.houseId} onChange={v=>setForm({...form,houseId:v})} options={wardHouses.map(h=>({value:h.id,label:`${h.houseNumber} · ${h.area?.name||''}`}))} placeholder="Search house…"/>
   {selectedCitizen&&<div className="span-2 muted">Selected house: {selectedCitizen.family?.house?.houseNumber||'—'} · {selectedCitizen.family?.house?.address||'—'}</div>}
   <div className="form-section-title span-2"><strong>Problem & Location</strong><span>Describe the issue clearly and provide exact location so the ward team can act.</span></div>
   <Field className="span-2" label="Location / Landmark">
     <div className="location-input-row">
       <input value={form.location || ''} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Enter landmark, street or tap GPS…"/>
       <button type="button" className="gps-fetch-btn" disabled={locating} onClick={handleGetLocation}>
         {locating ? 'Locating…' : 'Exact GPS Location'}
       </button>
     </div>
   </Field>
   <Field className="span-2" label="Problem description"><textarea required minLength="5" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="What is the problem, and where exactly?"/></Field>
   <div className="span-2"><MultiImageField max={5} label="Problem photos (max 5)" values={form.reportedImages||[]} onChange={v=>setForm({...form,reportedImages:v})} cameraLabel="Open camera"/></div>
   <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>setOpen(false)}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Submitting…':'Submit complaint'}</button></div>
  </form></Modal>}

  {assigning&&<Modal title={`Assign ${assigning.complaintNumber}`} onClose={()=>setAssigning(null)}><p className="muted">{isNagarsevak(user)?'You can select an employee or take the complaint yourself.':'Select an available employee from this ward.'}</p>{isNagarsevak(user)&&<label className="self-assign-option"><input type="checkbox" checked={!!assigning.assignToSelf} onChange={e=>setAssigning({...assigning,assignToSelf:e.target.checked,employeeId:e.target.checked?'':assigning.employeeId})}/><span><strong>Take complaint yourself</strong><small>I will handle this complaint myself.</small></span></label>}{!assigning.assignToSelf&&<><SearchableSelect label="Employee" required value={assigning.employeeId} onChange={v=>setAssigning({...assigning,employeeId:v})} options={assignable.map(e=>({value:e.id,label:`${e.User?.name||'Employee'} · ${e.designation||'Field employee'}`}))} placeholder="Search employee…"/></>}<div className="modal-actions"><button type="button" className="ghost-btn" onClick={()=>setAssigning(null)}>Cancel</button><button type="button" className="primary-btn" disabled={(!assigning.assignToSelf&&!assigning.employeeId)||busy} onClick={assign}>{busy?'Assigning…':'Assign complaint'}</button></div></Modal>}

  {editing&&<Modal wide title={`Update ${editing.complaintNumber}`} onClose={()=>setEditing(null)}><form className="form-grid admin-form" onSubmit={update}>
   <div className="form-section-title span-2"><strong>Status update</strong><span>Add a progress note, and a completion photo when the work is done.</span></div>
   <Field label="Status"><select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}>
    {(isEmployee(user)?['ASSIGNED','IN_PROGRESS','RESOLVED']:['SUBMITTED','PENDING','ASSIGNED','IN_PROGRESS','RESOLVED','REOPENED','CLOSED']).map(x=><option key={x}>{x}</option>)}
   </select></Field>
   <Field className="span-2" label="Progress note"><textarea value={editing.comment||''} onChange={e=>setEditing({...editing,comment:e.target.value})}/></Field>
   <Field className="span-2" label="Resolution note"><textarea required={editing.status==='RESOLVED'} value={editing.resolutionNote||''} onChange={e=>setEditing({...editing,resolutionNote:e.target.value})}/></Field>
   {editing.status==='RESOLVED'&&<div className="span-2"><MultiImageField max={5} label="Work completed photos (max 5)" values={editing.resolutionImages||parseComplaintImages(editing.resolutionImage)} onChange={v=>setEditing({...editing,resolutionImages:v,resolutionImage:packComplaintImages(v)})} optional={true} cameraLabel="Take completion photo"/></div>}
   <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>setEditing(null)}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':'Save update'}</button></div>
  </form></Modal>}

  {detail&&<Modal wide title={`${detail.complaintNumber} · Complete complaint details`} onClose={()=>setDetail(null)}>
   <div className="detail-grid complaint-detail-grid">
    <div className="detail-card"><h3>Who submitted this complaint?</h3><p><b>Citizen:</b> {detail.citizen?.fullName||detail.submittedBy?.name||'Registered resident'}</p><p><b>Registered account:</b> {detail.submittedBy?.name||'Not linked / legacy record'}</p><p><b>Mobile:</b> {detail.citizen?.mobile||detail.submittedBy?.mobile||'—'}</p><p><b>Email:</b> {detail.submittedBy?.email||detail.citizen?.email||'—'}</p></div>
    <div className="detail-card"><h3>Complaint information</h3><p><b>Category:</b> {detail.category?.replaceAll('_',' ')||'—'}</p><p><b>Priority:</b> {detail.priority||'—'}</p><p><b>Status:</b> <StatusPill>{detail.status}</StatusPill></p><p><b>Created:</b> {fmtDateTime(detail.createdAt)}</p><p><b>Resolved:</b> {fmtDateTime(detail.resolvedAt)}</p><p><b>Location:</b> {detail.location||'—'}</p><p><b>Problem:</b> {detail.description||'—'}</p></div>
    <div className="detail-card"><h3>Ward & assignment</h3><p><b>Ward:</b> {detail.ward?.wardNumber||detail.house?.area?.ward?.wardNumber||'—'}{detail.ward?.name||detail.house?.area?.ward?.name?` · ${detail.ward?.name||detail.house?.area?.ward?.name}`:''}</p><p><b>Nagarsevak:</b> {detail.assignedNagarsevak?.name||detail.assignedEmployee?.manager?.name||'Not assigned'}</p><p><b>Employee:</b> {detail.assignedEmployee?.User?.name||'Not assigned'}</p><p><b>Employee mobile:</b> {detail.assignedEmployee?.User?.mobile||'—'}</p><p><b>Resolution note:</b> {detail.resolutionNote||'—'}</p></div>
   </div>

   {/* Problem Photos */}
   <div className="detail-card complaint-photo-block" style={{marginTop:'14px'}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
       <h3 style={{margin:0,display:'flex',alignItems:'center',gap:'8px',fontSize:'14px'}}>Images Uploaded by Resident (Problem Photos)</h3>
       <span style={{background:parseComplaintImages(detail.reportedImages||detail.reportedImage).length?'#f0f4f8':'#f8fafc',color:parseComplaintImages(detail.reportedImages||detail.reportedImage).length?'#1e293b':'#64748b',fontWeight:700,padding:'3px 9px',borderRadius:'999px',fontSize:'11px',border:'1px solid #e2e8f0'}}>
         {parseComplaintImages(detail.reportedImages||detail.reportedImage).length?`${parseComplaintImages(detail.reportedImages||detail.reportedImage).length} photos`:'No photos attached'}
       </span>
     </div>
     {parseComplaintImages(detail.reportedImages||detail.reportedImage).length ? (
       <div className="image-grid photo-preview-grid">
         {parseComplaintImages(detail.reportedImages||detail.reportedImage).map((src,i)=>(
           <div key={i} className="complaint-photo-item" onClick={()=>setPreviewImage({src,title:`Problem photo #${i+1} (${detail.complaintNumber})`})}>
             <div className="photo-label">Problem Photo #{i+1}</div>
             <img src={src} alt={`Reported problem ${i+1}`}/>
             <div className="photo-zoom-hint">Tap to enlarge</div>
           </div>
         ))}
       </div>
     ) : (
       <p className="muted" style={{margin:'6px 0 0',fontSize:'12px'}}>Citizen did not attach any photos when submitting this complaint.</p>
     )}
   </div>

   {/* After-Work Photos */}
   <div className="detail-card complaint-photo-block" style={{marginTop:'14px',borderColor:parseComplaintImages(detail.resolutionImages||detail.resolutionImage).length?'#bbf7d0':'#e2e8f0',background:parseComplaintImages(detail.resolutionImages||detail.resolutionImage).length?'#f0fdf4':'#ffffff'}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
       <h3 style={{margin:0,display:'flex',alignItems:'center',gap:'8px',fontSize:'14px'}}>After-Work Images (Employee / Nagarsevak)</h3>
       <span style={{background:parseComplaintImages(detail.resolutionImages||detail.resolutionImage).length?'#dcfce7':'#f8fafc',color:parseComplaintImages(detail.resolutionImages||detail.resolutionImage).length?'#166534':'#64748b',fontWeight:700,padding:'3px 9px',borderRadius:'999px',fontSize:'11px',border:parseComplaintImages(detail.resolutionImages||detail.resolutionImage).length?'1px solid #86efac':'1px solid #e2e8f0'}}>
         {parseComplaintImages(detail.resolutionImages||detail.resolutionImage).length?`${parseComplaintImages(detail.resolutionImages||detail.resolutionImage).length} completion photos`:'Work completion pending'}
       </span>
     </div>
     {parseComplaintImages(detail.resolutionImages||detail.resolutionImage).length ? (
       <div className="image-grid photo-preview-grid">
         {parseComplaintImages(detail.resolutionImages||detail.resolutionImage).map((src,i)=>(
           <div key={i} className="complaint-photo-item" onClick={()=>setPreviewImage({src,title:`Work Completed Photo #${i+1} (${detail.complaintNumber})`})}>
             <div className="photo-label" style={{color:'#166534',background:'#dcfce7'}}>Work Completed #{i+1}</div>
             <img src={src} alt={`Completed work ${i+1}`}/>
             <div className="photo-zoom-hint">Tap to enlarge</div>
           </div>
         ))}
       </div>
     ) : (
       <p className="muted" style={{margin:'6px 0 0',fontSize:'12px'}}>No after-work photos uploaded yet. Can be uploaded when updating status to resolved.</p>
     )}
   </div>

   <div className="detail-card" style={{marginTop:'14px'}}><h3>Activity timeline</h3><div className="complaint-timeline">{(detail.history||[]).length?(detail.history||[]).slice().sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)).map((h,i)=><div className="timeline-item" key={h.id||i}><strong>{h.newStatus?.replaceAll('_',' ')||'Updated'}</strong><small>{fmtDateTime(h.createdAt)} · {h.changedBy?.name||'System'}</small><div>{h.comment||'Status updated'}</div></div>):<div className="muted">No activity recorded.</div>}</div></div>
   <div className="modal-actions">
     <button className="ghost-btn" onClick={()=>setDetail(null)}>Close</button>
     {can('EDIT_COMPLAINTS')&&(isEmployee(user)?detail.assignedEmployeeId===user?.employeeProfile?.id:true)&&<button type="button" className="primary-btn" style={{background:'#2563eb',color:'#fff',display:'inline-flex',alignItems:'center',gap:'6px'}} onClick={()=>{setEditing({...detail,comment:'',resolutionNote:detail.resolutionNote||'',resolutionImages:parseComplaintImages(detail.resolutionImages||detail.resolutionImage),resolutionImage:detail.resolutionImage||null});setDetail(null);}}>Update Status</button>}
     {can('EDIT_COMPLAINTS')&&!isEmployee(user)&&detail.status==='RESOLVED'&&<button className="primary-btn" onClick={async()=>{try{await api.updateComplaintStatus(detail.id,{status:'CLOSED',comment:'Closed after resolution.'});setDetail(null);await load()}catch(e){setError(e.message)}}}>Mark closed</button>}
   </div>
  </Modal>}

  {previewImage && (
    <Modal title={previewImage.title || 'Image Preview'} onClose={() => setPreviewImage(null)}>
      <div style={{ textAlign: 'center', padding: '12px' }}>
        <img src={previewImage.src} alt="Preview" style={{ maxWidth: '100%', maxHeight: '68vh', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 8px 30px rgba(0,0,0,0.18)' }} />
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <a href={previewImage.src} target="_blank" rel="noreferrer" className="small-btn primary-btn">Open full size in new tab</a>
          <button type="button" className="small-btn ghost-btn" onClick={() => setPreviewImage(null)}>Close preview</button>
        </div>
      </div>
    </Modal>
  )}
 </div>
}
