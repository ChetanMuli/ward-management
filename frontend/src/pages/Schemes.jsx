import React,{useEffect,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {api,getUser} from '../services/api';
import {Empty,ErrorBox,Field,Loading,Modal,PageHeader,RowMenu,SearchableSelect,StatusPill,Toolbar} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {isMaster,isSubMaster,isNagarsevak} from '../rbac';
import {useWardFilter} from '../wardFilter';

const prettyRole=r=>r?r.toLowerCase().replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase()):'';
const blank={title:'',description:'',benefits:'',eligibility:'',minAge:'',maxAge:'',gender:'ALL',audience:'',wardId:'',applicationUrl:'',contactInfo:'',startDate:'',endDate:'',status:'PUBLISHED'};

export default function Schemes(){
 const user=getUser(),location=useLocation(),master=isMaster(user),sub=isSubMaster(user),councillor=isNagarsevak(user);
 const isCitizen=String(user?.role||'').toUpperCase()==='CITIZEN';
 const {selectedWardId}=useWardFilter();
 const [rows,setRows]=useState(null),[wards,setWards]=useState([]),[search,setSearch]=useState(''),[status,setStatus]=useState(''),[edit,setEdit]=useState(null),[form,setForm]=useState(blank),[error,setError]=useState(''),[detail,setDetail]=useState(null),[busy,setBusy]=useState(false),[schemeNotify,setSchemeNotify]=useState(null),[schemeNotifyForm,setSchemeNotifyForm]=useState({title:'',message:''});

 async function load(){try{setError('');const r=await api.schemes({search,status:isCitizen?'PUBLISHED':status,wardId:selectedWardId||undefined});setRows(r.data||[])}catch(e){setError(e.message)}}
 useEffect(()=>{const t=setTimeout(load,220);return()=>clearTimeout(t)},[search,status,selectedWardId,isCitizen]);
 useEffect(()=>{const id=new URLSearchParams(location.search).get('open');if(!id||!rows?.length)return;const found=rows.find(r=>String(r.id)===String(id));if(found)setDetail(found)},[location.search,rows]);
 useEffect(()=>{
  if(!(master||sub)) return;
  api.wards().then(r=>setWards(r.data||[])).catch(e=>setError(e.message));
 },[master,sub]);

 const canEdit=master||sub||councillor;
 const canNotify=master||councillor;

 function openSchemeNotify(r){
   const fixedWardId=r.wardId||r.ward?.id||'';
   setError('');
   if(!fixedWardId){
     setError('This scheme has no publishing ward. Edit the scheme and select its ward first.');
     return;
   }
   setSchemeNotify(r);
   setSchemeNotifyForm({title:`Scheme: ${r.title}`,message:`Please review the published scheme "${r.title}" and its eligibility/details.`});
 }

 async function sendSchemeNotify(e){
   e.preventDefault();
   const fixedWardId=schemeNotify?.wardId||schemeNotify?.ward?.id||'';
   if(!fixedWardId){setError('This scheme has no publishing ward. Edit the scheme and select its ward first.');return;}
   setBusy(true);
   try{
     await api.sendSchemeNotification({schemeId:schemeNotify.id,targetWardId:fixedWardId,selectAll:true,title:schemeNotifyForm.title,message:schemeNotifyForm.message});
     setSchemeNotify(null);
   }catch(e){setError(e.message)}finally{setBusy(false)}
 }

 function openCreate(){
   const fixed=councillor?selectedWardId||user?.wardId||'':selectedWardId||'';
   setForm({...blank,wardId:fixed});
   setEdit('create');
 }
 function openEdit(r){setForm({...blank,...r,wardId:r.wardId||r.ward?.id||''});setEdit(r)}

 async function save(e){
   e.preventDefault();
   if(!form.wardId){setError('Please select the publishing ward for this scheme.');return;}
   setBusy(true);
   try{
     const d={...form,minAge:form.minAge===''?null:Number(form.minAge),maxAge:form.maxAge===''?null:Number(form.maxAge),wardId:form.wardId};
     if(edit==='create')await api.createScheme(d);else await api.updateScheme(edit.id,d);
     setEdit(null);await load();
   }catch(e){setError(e.message)}finally{setBusy(false)}
 }

 const wardLabel=(r)=>r.ward?.wardNumber||'Ward not assigned';
 const creatorLabel=(r)=>`${r.createdByName||r.createdBy?.name||'System'}${(r.createdByRole||r.createdBy?.Role?.name)?` · ${prettyRole(r.createdByRole||r.createdBy.Role.name)}`:''}`;

 return <div className={isCitizen?'user-schemes-page':'admin-schemes-page'}>
  <PageHeader
   kicker={isCitizen?'Your ward':'Daily work'}
   title={isCitizen?'Schemes for you':'Schemes & benefits'}
   action={canEdit?<button className="primary-btn" onClick={openCreate}>+ Add scheme</button>:null}
  />
  <ErrorBox error={error}/>
  <Toolbar className={isCitizen?'toolbar-schemes toolbar-schemes-citizen':'toolbar-schemes'}>
   {!isCitizen&&<WardFilter/>}
   <label className="filter-field"><span className="section-label">Search</span><input className="grow" placeholder="Search schemes…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   {!isCitizen&&<label className="filter-field"><span className="section-label">Status</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All status</option><option value="PUBLISHED">Published</option><option value="DRAFT">Draft</option><option value="CLOSED">Closed</option></select></label>}
  </Toolbar>
  {rows===null?<Loading/>:!rows.length?<Empty>No schemes match your filters.</Empty>:<div className="scheme-grid">{rows.map(r=><article className="scheme-card" key={r.id}>
    <div className="scheme-card-head"><span className="eyebrow">SCHEME</span><StatusPill>{r.status}</StatusPill></div>
    <h2>{r.title}</h2><p>{r.description}</p>
    <div className="scheme-tags"><span>{r.gender==='ALL'?'For everyone':r.gender==='FEMALE'?'For women':r.gender==='MALE'?'For men':'For other genders'}</span>{(r.minAge!=null||r.maxAge!=null)&&<span>Age {r.minAge??0}–{r.maxAge??'+'}</span>}{r.audience&&<span>{r.audience}</span>}</div>
    <div className="scheme-meta"><b>Published in ward:</b> {wardLabel(r)}{r.ward?.name?` · ${r.ward.name}`:''}</div>
    <div className="scheme-meta"><b>Published by:</b> {creatorLabel(r)}</div>
    <div className="card-actions"><RowMenu items={[
     {label:'View details',onClick:()=>setDetail(r)},
     canNotify&&r.status==='PUBLISHED'&&r.ward?.id&&{label:'Notify ward',onClick:()=>openSchemeNotify(r)},
     canEdit&&{label:'Edit',onClick:()=>openEdit(r)},
     canEdit&&{label:'Delete',danger:true,onClick:async()=>{if(confirm(`Delete ${r.title}?`)){try{await api.deleteScheme(r.id);await load()}catch(e){setError(e.message)}}}}
    ]}/></div>
  </article>)}</div>}

  {detail&&<Modal wide title={`${detail.title} · Scheme details`} onClose={()=>setDetail(null)}><div className="detail-grid"><div className="detail-card"><h3>Overview</h3><p><b>Description:</b> {detail.description||'N/A'}</p><p><b>Benefits:</b> {detail.benefits||'N/A'}</p><p><b>Status:</b> {detail.status}</p><p><b>Published in ward:</b> {wardLabel(detail)}{detail.ward?.name?` · ${detail.ward.name}`:''}</p><p><b>Published by:</b> {creatorLabel(detail)}</p></div><div className="detail-card"><h3>Eligibility</h3><p><b>Age:</b> {detail.minAge??'Any'} – {detail.maxAge??'Any'}</p><p><b>Gender:</b> {detail.gender==='FEMALE'?'Female':detail.gender==='MALE'?'Male':detail.gender==='OTHER'?'Other':'Everyone'}</p><p><b>Who is it for:</b> {detail.audience||'All eligible residents'}</p><p><b>Eligibility notes:</b> {detail.eligibility||'N/A'}</p></div><div className="detail-card"><h3>How to apply</h3><p><b>Application:</b> {detail.applicationUrl?<a href={detail.applicationUrl} target="_blank" rel="noreferrer">Open application</a>:'N/A'}</p><p><b>Contact:</b> {detail.contactInfo||'N/A'}</p><p><b>Available:</b> {detail.startDate||'Any'} → {detail.endDate||'Open'}</p></div></div></Modal>}

  {schemeNotify&&<Modal wide title={`Send notification · ${schemeNotify.title}`} onClose={()=>setSchemeNotify(null)}><form className="form-grid scheme-notify-form" onSubmit={sendSchemeNotify}>
    <div className="span-2 notification-ward-box"><div className="section-label">Send notification only to the scheme's publishing ward *</div><div className="scheme-fixed-ward"><strong>{wardLabel(schemeNotify)}</strong>{schemeNotify.ward?.name?` · ${schemeNotify.ward.name}`:''}</div><div className="muted">Only active citizen members linked to this ward will receive this scheme notification. Another ward cannot be selected.</div></div>
    <Field className="span-2" label="Title"><input required value={schemeNotifyForm.title} onChange={e=>setSchemeNotifyForm({...schemeNotifyForm,title:e.target.value})}/></Field>
    <Field className="span-2" label="Message"><textarea required rows="5" value={schemeNotifyForm.message} onChange={e=>setSchemeNotifyForm({...schemeNotifyForm,message:e.target.value})}/></Field>
    <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>setSchemeNotify(null)}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Sending…':'Send notification'}</button></div>
  </form></Modal>}

  {edit&&<Modal wide title={edit==='create'?'Add new scheme':'Edit scheme'} onClose={()=>setEdit(null)}><form className="form-grid scheme-form" onSubmit={save}>
    <Field className="span-2" label="Scheme name"><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Women support scheme"/></Field>
    <Field className="span-2" label="Description"><textarea required value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="What does the scheme provide?"/></Field>
    <Field className="span-2" label="Benefits"><textarea value={form.benefits} onChange={e=>setForm({...form,benefits:e.target.value})} placeholder="Benefit amount, service, subsidy, etc."/></Field>
    <Field label="Minimum age"><input type="number" min="0" value={form.minAge} onChange={e=>setForm({...form,minAge:e.target.value})} placeholder="Any"/></Field>
    <Field label="Maximum age"><input type="number" min="0" value={form.maxAge} onChange={e=>setForm({...form,maxAge:e.target.value})} placeholder="Any"/></Field>
    <Field label="Gender eligibility"><select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option value="ALL">Everyone</option><option value="FEMALE">Females / Women</option><option value="MALE">Males / Men</option><option value="OTHER">Other</option></select></Field>
    <Field label="Who is it for?"><input value={form.audience} onChange={e=>setForm({...form,audience:e.target.value})} placeholder="e.g. Students, senior citizens"/></Field>
    <SearchableSelect label="Publishing ward" required value={form.wardId} disabled={councillor} onChange={v=>setForm({...form,wardId:v})} options={wards.map(w=>({value:w.id,label:`${w.wardNumber}${w.name?` · ${w.name}`:''}`}))} placeholder="Select publishing ward…"/>
    {councillor&&<div className="ward-fixed-note"><strong>Ward locked to your assigned ward.</strong></div>}
    <Field label="Status"><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="PUBLISHED">Published</option><option value="DRAFT">Draft</option><option value="CLOSED">Closed</option></select></Field>
    <Field label="Start date"><input type="date" value={form.startDate||''} onChange={e=>setForm({...form,startDate:e.target.value})}/></Field>
    <Field label="End date"><input type="date" value={form.endDate||''} min={form.startDate||undefined} onChange={e=>setForm({...form,endDate:e.target.value})}/></Field>
    <Field className="span-2" label="Eligibility details"><textarea value={form.eligibility} onChange={e=>setForm({...form,eligibility:e.target.value})} placeholder="Documents, income limit, residence requirement, etc."/></Field>
    <Field label="Application link (optional)"><input type="url" value={form.applicationUrl} onChange={e=>setForm({...form,applicationUrl:e.target.value})}/></Field>
    <Field label="Contact / helpline"><input value={form.contactInfo} onChange={e=>setForm({...form,contactInfo:e.target.value})}/></Field>
    <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>setEdit(null)}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':edit==='create'?'Publish scheme':'Save changes'}</button></div>
  </form></Modal>}
 </div>;
}
