import ComplaintTimeline from '../components/ComplaintTimeline';
import React,{useEffect,useMemo,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {api,getUser} from '../services/api';
import {Empty,Field,MultiImageField,Loading,Modal,PageHeader,SearchableSelect,StatusPill,FaceAvatar} from '../components/Ui';
import {packComplaintImages,parseComplaintImages} from '../complaintMedia';
import {openDirections, getTimelineDescription, formatStatusLabel} from './Complaints';
import {getAccurateLocation} from '../location';
import {formatWardLabel} from '../wardFormat';

export const COMPLAINT_CATEGORIES=[
  ['WATER','Water Supply','पाणी पुरवठा'],
  ['ROADS','Roads & Potholes','रस्ते आणि खड्डे'],
  ['STREET_LIGHTS','Street Lights','पथदिवे / स्ट्रीट लाईट'],
  ['GARBAGE','Garbage & Solid Waste','कचरा व्यवस्थापन'],
  ['DRAINAGE','Drainage & Sewage','ड्रेनेज आणि सांडपाणी'],
  ['SANITATION','Public Sanitation & Toilets','सार्वजनिक स्वच्छता'],
  ['HEALTH','Health & Hygiene','आरोग्य व स्वच्छता'],
  ['PARKS_TREES','Parks & Tree Trimming','उद्याने व झाडे छाटणी'],
  ['ENCROACHMENT','Encroachment & Illegal Works','अतिक्रमण'],
  ['STRAY_ANIMALS','Stray Animals & Dogs','मोकाट जनावरे व कुत्रे'],
  ['POLLUTION','Noise / Air Pollution','ध्वनी / हवा प्रदूषण'],
  ['PROPERTY_TAX','Property Tax & Assessment','मालमत्ता कर'],
  ['OTHER','Other (Please specify)','इतर समस्या']
];

const PRIORITIES=[['LOW','Low'],['MEDIUM','Medium'],['HIGH','High'],['CRITICAL','Critical']];
function fmt(v){return v?new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—'}
function statusText(s){return String(s||'').replaceAll('_',' ')}

export default function UserComplaints({language='en'}){
 const user=getUser(),location=useLocation(),mr=language==='mr';
 const [rows,setRows]=useState(null),[team,setTeam]=useState(null),[open,setOpen]=useState(false),[detail,setDetail]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[statusFilter,setStatusFilter]=useState(''),[categoryFilter,setCategoryFilter]=useState(''),[priorityFilter,setPriorityFilter]=useState(''),[nagarsevakFilter,setNagarsevakFilter]=useState(''),[search,setSearch]=useState('');
 const [locating,setLocating]=useState(false);
 const [previewPhoto,setPreviewPhoto]=useState(null);
 const [form,setForm]=useState({category:'WATER',customCategory:'',description:'',priority:'MEDIUM',assignedNagarsevakUserId:'__ALL__',location:'',reportedImages:[]});
 const [portalNagarsevaks,setPortalNagarsevaks]=useState([]);
 const [portalConfig,setPortalConfig]=useState(null);
 function cachedHero(){
  try{
    const v=localStorage.getItem(`ward_complaints_banner_${user?.wardId||''}`);
    if(v&&!String(v).startsWith('data:')&&!/hero-campaign-banner|hero-gauri-ajinkya|hero-poster-card/i.test(v)) return v;
  }catch{/* ignore */}
  return null;
 }
 const labels=mr?{title:'माझ्या तक्रारी',sub:'तुमच्या वॉर्डमध्ये नोंदवलेल्या तक्रारी आणि त्यांची प्रगती येथे पहा.',new:'नवीन तक्रार',empty:'अजून कोणतीही तक्रार नोंदवलेली नाही.',category:'तक्रारीचा प्रकार',description:'तक्रारीचे वर्णन',priority:'प्राधान्य',nagarsevak:'नगरसेवक निवडा',location:'ठिकाण / लँडमार्क',photo:'तक्रारीचे फोटो',submit:'तक्रार नोंदवा',cancel:'रद्द करा'}:{title:'My Complaints',sub:'Track complaints submitted from your registered ward account and follow every status update.',new:'New complaint',empty:'You have not submitted any complaints yet.',category:'Complaint category',description:'Describe the problem',priority:'Priority',nagarsevak:'Choose Nagarsevak',location:'Location / landmark',photo:'Problem photos',submit:'Submit complaint',cancel:'Cancel'};

 async function load(){try{setError('');const [c,t,pc]=await Promise.all([api.complaints({page:1,limit:40}),api.wardTeam(),api.portalConfig(user?.wardId?{wardId:user.wardId}:{})]);setRows(c.data||[]);setTeam(t.data||null);const cfg=pc.data?.config||pc.data||null;setPortalConfig(cfg);const complaintsBanner=cfg?.complaintsBannerUrl||cfg?.meta?.complaintsBannerUrl;if(complaintsBanner&&!String(complaintsBanner).startsWith('data:')){try{localStorage.setItem(`ward_complaints_banner_${user?.wardId||''}`,complaintsBanner)}catch{}}setPortalNagarsevaks(Array.isArray(pc.data?.nagarsevaks)?pc.data.nagarsevaks:(pc.data?.nagarsevak?[pc.data.nagarsevak]:[]))}catch(e){setRows([]);setError(e.message)}}
 useEffect(()=>{load()},[]);
 useEffect(()=>{
   const onPortalUpdate=()=>load();
   window.addEventListener('ward:portal-updated',onPortalUpdate);
   const onStorage=(e)=>{if(e.key==='ward_portal_updated')onPortalUpdate();};
   window.addEventListener('storage',onStorage);
   return()=>{window.removeEventListener('ward:portal-updated',onPortalUpdate);window.removeEventListener('storage',onStorage);};
 },[]);
 useEffect(()=>{const id=new URLSearchParams(location.search).get('open');if(!id)return;api.complaint(id).then(r=>setDetail(r.data)).catch(e=>setError(e.message))},[location.search]);
 const nagarsevaks=useMemo(()=>{
   if(portalNagarsevaks.length) return portalNagarsevaks.filter(n=>n&&n.id&&!n.isDemo);
   return team?.nagarsevaks||[];
 },[team, portalNagarsevaks]);
 const liveComplaints=(portalConfig?.complaintsBannerUrl||portalConfig?.meta?.complaintsBannerUrl||'');
 const liveHero=(liveComplaints&&!String(liveComplaints).startsWith('data:'))?liveComplaints:null;
 const heroBanner=liveHero||cachedHero()||null;
 const nextAction=(status)=>({SUBMITTED:mr?'तक्रार नोंद झाली असून नगरसेवक / कर्मचाऱ्यांकडे पाठवली आहे.':'Complaint is open and waiting for ward assignment/action.',PENDING:mr?'तक्रारीवर पुढील कार्यवाहीची प्रतीक्षा.':'Waiting for the next ward action.',ASSIGNED:mr?'नियुक्त कर्मचारी काम सुरू करेल.':'Assigned employee should start the work.',IN_PROGRESS:mr?'काम सुरू आहे; पूर्ण झाल्यावर फोटोसह अपडेट होईल.':'Work is in progress; the responsible person should update it when completed.',RESOLVED:mr?'काम पूर्ण झाले आहे; प्रशासनाकडून बंद करण्याची प्रक्रिया बाकी.':'Work is marked complete; ward management can close the complaint.',REOPENED:mr?'तक्रार पुन्हा उघडली आहे; पुढील कार्यवाही अपेक्षित.':'Complaint was reopened and needs further action.',CLOSED:mr?'तक्रार बंद करण्यात आली आहे.':'Complaint is closed.'}[status]||'—');

 const getCategoryName=(cat)=>{
   const found=COMPLAINT_CATEGORIES.find(x=>x[0]===cat);
   if(found) return mr ? found[2] : found[1];
   return String(cat||'').replaceAll('_',' ');
 };

 const filteredRows=useMemo(()=>{
   const q=search.trim().toLowerCase();
   return (rows||[]).filter(c=>{
     const text=[c.complaintNumber,c.description,c.location,c.assignedNagarsevak?.name,c.assignedEmployee?.User?.name].map(v=>String(v||'').toLowerCase()).join(' ');
     const statusMatches = !statusFilter || (statusFilter === 'SUBMITTED' ? (c.status === 'SUBMITTED' || c.status === 'OPEN') : c.status === statusFilter);
     return statusMatches && (!categoryFilter||c.category===categoryFilter)&&(!priorityFilter||c.priority===priorityFilter)&&(!nagarsevakFilter||String(c.assignedNagarsevak?.id||'')===String(nagarsevakFilter))&&(!q||text.includes(q));
   });
 },[rows,statusFilter,categoryFilter,priorityFilter,nagarsevakFilter,search]);

 const statusFlow=['SUBMITTED','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED'];
 const flowIndex=(status)=>status==='PENDING'?1:status==='REOPENED'?1:Math.max(0,statusFlow.indexOf(status));
 const statusLabel=(status)=>({SUBMITTED:mr?'खुली (नवीन)':'Open',ASSIGNED:mr?'नियुक्त':'Assigned',IN_PROGRESS:mr?'काम सुरू':'In progress',RESOLVED:mr?'पूर्ण':'Resolved',CLOSED:mr?'बंद':'Closed'}[status]||statusText(status));

 const handleGetLocation = async () => {
   try {
     setLocating(true);
     setError('');
     const loc = await getAccurateLocation({ timeout: 22000, desiredAccuracy: 20 });
     setForm(prev => ({
       ...prev,
       location: loc.formatted || loc.address || `GPS: ${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`
     }));
   } catch (err) {
     setError(err.message || (mr ? 'GPS स्थान मिळवता आले नाही.' : 'Could not retrieve GPS location.'));
   } finally {
     setLocating(false);
   }
 };

 const openNew=()=>{
   setForm({category:'WATER',customCategory:'',description:'',priority:'MEDIUM',assignedNagarsevakUserId:'__ALL__',location:'',reportedImages:[]});
   setError('');
   setOpen(true);
 };

 async function submit(e){
   e.preventDefault();
   if(!form.assignedNagarsevakUserId){
     setError(mr?'कृपया नगरसेवक किंवा सर्व नगरसेवक निवडा.':'Please select a Nagarsevak or All.');
     return;
   }
   if(form.category==='OTHER' && !String(form.customCategory||'').trim()){
     setError(mr?'कृपया इतर तक्रारीचा प्रकार लिहा.':'Please write your complaint type in the box.');
     return;
   }
   setBusy(true);
   setError('');
   try{
     const chosenCat = COMPLAINT_CATEGORIES.find(x=>x[0]===form.category);
     const catLabel = chosenCat ? (mr ? chosenCat[2] : chosenCat[1]) : form.category;
     const finalDescription = String(form.description||'').trim() || String(form.customCategory||'').trim() || catLabel;
     const finalCategory = form.category==='OTHER' && form.customCategory.trim() ? form.customCategory.trim() : form.category;
     const payload={
       category: finalCategory,
       customCategory: form.customCategory.trim(),
       description: finalDescription,
       priority: form.priority,
       assignedNagarsevakUserId: form.assignedNagarsevakUserId==='__ALL__'?'':form.assignedNagarsevakUserId,
       location: form.location,
       reportedImages: form.reportedImages,
       reportedImage: packComplaintImages(form.reportedImages)
     };
     const r=await api.createComplaint(payload);
     setOpen(false);
     await load();
     if(r?.data) setDetail(r.data);
   }catch(e){
     setError(e.message);
   }finally{
     setBusy(false);
   }
 }

 return <div className="user-complaints-page">
  <PageHeader title={labels.title} action={<button className="primary-btn" onClick={openNew}>+ {labels.new}</button>}/>
  <div className="user-complaint-filterbar">
   <label><span>{mr?'शोध':'Search'}</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={mr?'क्रमांक, समस्या, ठिकाण…':'Complaint no., problem, location…'}/></label>
   <label><span>{mr?'स्थिती':'Status'}</span>
     <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
       <option value="">{mr?'सर्व स्थिती':'All statuses'}</option>
       <option value="SUBMITTED">{mr?'खुली (नवीन)':'Open (New)'}</option>
       <option value="ASSIGNED">{mr?'नियुक्त':'Assigned'}</option>
       <option value="IN_PROGRESS">{mr?'काम सुरू':'In progress'}</option>
       <option value="RESOLVED">{mr?'पूर्ण':'Resolved'}</option>
       <option value="PENDING">{mr?'प्रलंबित':'Pending'}</option>
       <option value="REOPENED">{mr?'पुन्हा उघडली':'Reopened'}</option>
       <option value="CLOSED">{mr?'बंद':'Closed'}</option>
     </select>
   </label>
   <label><span>{mr?'प्रकार':'Category'}</span>
     <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}>
       <option value="">{mr?'सर्व प्रकार':'All categories'}</option>
       {COMPLAINT_CATEGORIES.map(([v,en,mrLabel])=><option key={v} value={v}>{mr?mrLabel:en}</option>)}
     </select>
   </label>
   <label><span>{mr?'प्राधान्य':'Priority'}</span>
     <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}>
       <option value="">{mr?'सर्व':'All priorities'}</option>
       {PRIORITIES.map(([v,l])=><option key={v} value={v}>{mr?({LOW:'कमी',MEDIUM:'मध्यम',HIGH:'जास्त',CRITICAL:'तातडीचे'}[v]||l):l}</option>)}
     </select>
   </label>
   <label><span>{mr?'नगरसेवक':'Nagarsevak'}</span>
     <select value={nagarsevakFilter} onChange={e=>setNagarsevakFilter(e.target.value)}>
       <option value="">{mr?'सर्व नगरसेवक':'All Nagarsevaks'}</option>
       {nagarsevaks.map(n=><option key={n.id} value={n.id}>{n.name}{n.mobile?` · ${n.mobile}`:''}</option>)}
     </select>
   </label>
   <button type="button" className="small-btn" onClick={()=>{setSearch('');setStatusFilter('');setCategoryFilter('');setPriorityFilter('');setNagarsevakFilter('')}}>{mr?'फिल्टर साफ करा':'Clear filters'}</button>
 </div>
  {error&&<div className="user-error"><span>{error}</span><button onClick={load}>Retry</button></div>}
  <section className={`ward-info-card ${heroBanner?'has-portal-banner':''}`} style={heroBanner?{'--portal-hero-bg':`url("${String(heroBanner).replace(/"/g,'')}")`}:undefined}>
   {heroBanner?<img className="ward-info-banner-photo" src={heroBanner} alt="" onError={(e)=>{e.currentTarget.style.display='none'}}/>:null}
   <div className="ward-info-main">
    <span className="user-kicker">{mr?'तुमचा वॉर्ड':'Your ward'}</span>
    <h2>{formatWardLabel(team?.ward||user?.ward,'')}</h2>
   </div>
   <div className="nagar-info-list">{nagarsevaks.length?nagarsevaks.slice(0,1).map(n=>{
     const photoSrc = (typeof n.photo === 'string' && n.photo.trim()) ? n.photo.trim() : '';
     const formattedName = n.name || (mr ? 'माननीय नगरसेवक' : 'Ward Nagarsevak');
     const roleOrParty = [n.partyName, n.wardSeat, mr ? 'नगरसेवक' : 'Corporator'].filter(Boolean).join(' · ');
     return (
       <article className="nagar-info-card" key={n.id}>
         <div className="nagar-avatar-wrap">
           <FaceAvatar name={formattedName} photo={photoSrc}/>
         </div>
         <div className="nagar-info-copy">
           <strong>{formattedName}</strong>
           <span>{roleOrParty}</span>
           {n.mobile?<a href={`tel:${n.mobile}`} className="nagar-info-phone">📞 {n.mobile}</a>:<span>{mr?'मोबाईल उपलब्ध नाही':'No mobile'}</span>}
         </div>
       </article>
     );
   }):<div className="user-nagar-empty"><strong>{mr?'नगरसेवक प्रोफाइल सध्या उपलब्ध नाही.':'Nagarsevak details are not available yet.'}</strong></div>}</div>
  </section>
  {rows===null?<Loading/>:!filteredRows.length?<Empty>{search||statusFilter||categoryFilter||priorityFilter||nagarsevakFilter?(mr?'फिल्टरनुसार तक्रार सापडली नाही.':'No complaints match the selected filters.') : labels.empty}</Empty>:<><div className="complaint-results-summary">{mr?`${filteredRows.length} तक्रारी दिसत आहेत`:`Showing ${filteredRows.length} complaint${filteredRows.length===1?'':'s'}`}</div><div className="user-complaint-list">{filteredRows.map(c=><article className="user-complaint-card" key={c.id}><div className="user-complaint-card-head"><div><span className="complaint-number">{c.complaintNumber}</span><h3>{c.description}</h3></div><StatusPill>{c.status}</StatusPill></div><div className="user-complaint-meta"><span>{getCategoryName(c.category)}</span><span>{c.priority}</span><span>{fmt(c.createdAt)}</span></div><div className="complaint-status-stepper" aria-label={`Complaint status: ${c.status}`}>
 {statusFlow.map((stage,i)=>{const active=flowIndex(c.status)>=i;return <div className={`complaint-status-step ${active?'done':''} ${c.status===stage?'current':''}`} key={stage}><span className="complaint-status-dot">{active?'✓':i+1}</span><small>{statusLabel(stage)}</small></div>})}
 </div>
 {c.status==='PENDING'&&<div className="complaint-status-note">⏳ {nextAction(c.status)}</div>}
 {c.status==='REOPENED'&&<div className="complaint-status-note">↻ {nextAction(c.status)}</div>}
 <p className="user-complaint-assignment">
  <b>{mr?'नगरसेवक:':'Nagarsevak:'}</b> {c.assignedNagarsevak?.name||'Not assigned'}{c.assignedNagarsevak?.mobile&&<a href={`tel:${c.assignedNagarsevak.mobile}`} className="complaint-contact-link"> · {c.assignedNagarsevak.mobile}</a>}
 </p><div className="card-actions"><button className="small-btn view-btn" onClick={async()=>{try{const r=await api.complaint(c.id);setDetail(r.data)}catch(e){setError(e.message)}}}>{mr?'तपशील पहा':'View details'}</button></div></article>)}</div></>}

  {open&&<Modal wide title={labels.new} onClose={()=>setOpen(false)}>
    <form className="form-grid user-complaint-form admin-form" onSubmit={submit}>
      <div className="form-section-title span-2">
        <strong>{mr?'तक्रारीची माहिती':'Complaint details'}</strong>
        <span>{mr?'प्रकार, प्राधान्य आणि नगरसेवक निवडा.':'Choose the type, priority and who should receive it.'}</span>
      </div>
      <Field label={labels.category}>
        <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
          {COMPLAINT_CATEGORIES.map(([v,en,mrLabel])=><option key={v} value={v}>{mr?mrLabel:en}</option>)}
        </select>
      </Field>
      <Field label={labels.priority}>
        <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
          {PRIORITIES.map(([v,l])=><option key={v} value={v}>{mr?({LOW:'कमी',MEDIUM:'मध्यम',HIGH:'जास्त',CRITICAL:'तातडीचे'}[v]||l):l}</option>)}
        </select>
      </Field>
      {form.category==='OTHER' && (
        <Field className="span-2" label={mr?'तक्रारीचा प्रकार लिहा *':'Specify Complaint Type *'}>
          <input
            required
            value={form.customCategory}
            onChange={e=>setForm({...form,customCategory:e.target.value})}
            placeholder={mr?'उदा. जलवाहिनी फुटणे, अनधिकृत बॅनर, तुंबलेले पाणी…':'e.g. Broken water pipe, unauthorized hoarding, foul smell…'}
          />
        </Field>
      )}
      <SearchableSelect className="span-2" label={`${labels.nagarsevak}${nagarsevaks.length?' *':''}`} required={!!nagarsevaks.length} value={form.assignedNagarsevakUserId} onChange={v=>setForm({...form,assignedNagarsevakUserId:v})} options={nagarsevaks.length?[{value:'__ALL__',label:mr?'सर्व नगरसेवक (उपलब्ध नगरसेवकाकडे पाठवा)':'All Nagarsevaks (send to an available ward Nagarsevak)'},...nagarsevaks.map(n=>({value:n.id,label:`${n.name} · ${n.mobile||'No mobile'}`}))]:[{value:'__ALL__',label:mr?'नगरसेवक अद्याप उपलब्ध नाही':'Nagarsevak not available yet'}]} placeholder={mr?'नगरसेवक शोधा…':'Search active Nagarsevak…'}/>
      <div className="span-2 complaint-form-help">{nagarsevaks.length?(mr?'फक्त तुमच्या वॉर्डासाठी उपलब्ध नगरसेवक येथे दिसतील.':'Only Nagarsevaks currently available for your ward are shown.'):(mr?'या वॉर्डासाठी नगरसेवक प्रोफाइल सध्या उपलब्ध नाही. तक्रार नोंदवता येईल.':'Nagarsevak details are not available yet. You can still submit the complaint.')}</div>
      <div className="form-section-title span-2">
        <strong>{mr?'समस्या':'Problem'}</strong>
        <span>{mr?'ठिकाण, वर्णन (पर्यायी) आणि फोटो जोडता येतील.':'Add the location, optional description and photos.'}</span>
      </div>
      <Field className="span-2" label={labels.location}>
        <div className="location-input-row">
          <input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder={mr?'उदा. मुख्य रस्ता, सोसायटी गेट किंवा अचूक GPS मिळवा…':'e.g. Main road, landmark or tap GPS…'}/>
          <button type="button" className="gps-fetch-btn" disabled={locating} onClick={handleGetLocation}>
            {locating ? (mr ? 'शोधत आहे…' : 'Locating…') : (mr ? 'अचूक स्थान (GPS)' : 'Exact GPS Location')}
          </button>
        </div>
      </Field>
      <Field className="span-2" label={`${labels.description} ${mr?'(पर्यायी)':'(optional)'}`}>
        <textarea
          rows={4}
          value={form.description}
          onChange={e=>setForm({...form,description:e.target.value})}
          placeholder={mr?'समस्या सविस्तर लिहा (पर्यायी - न लिहिल्यास प्रकाराचे नाव वापरले जाईल)…':'Describe the problem clearly (optional - defaults to complaint type if left empty)…'}
        />
      </Field>
      <div className="span-2">
        <MultiImageField
          max={5}
          label={labels.photo}
          values={form.reportedImages||[]}
          onChange={v=>setForm({...form,reportedImages:v})}
          cameraLabel={mr?'कॅमेरा उघडा':'Open camera'}
        />
      </div>
      <div className="modal-actions span-2">
        <button type="button" className="ghost-btn" onClick={()=>setOpen(false)}>{labels.cancel}</button>
        <button className="primary-btn" disabled={busy}>{busy?(mr?'नोंदवत आहे…':'Submitting…'):labels.submit}</button>
      </div>
    </form>
  </Modal>}

  {detail&&<Modal wide title={`${detail.complaintNumber} · ${mr?'तक्रार तपशील':'Complaint details'}`} onClose={()=>setDetail(null)}>
    <div className="detail-grid">
      <div className="detail-card">
        <h3>{mr?'तक्रार':'Complaint'}</h3>
        <p><b>{mr?'स्थिती:':'Status:'}</b> <StatusPill>{detail.status}</StatusPill></p>
        <p><b>{mr?'प्रकार:':'Category:'}</b> {getCategoryName(detail.category)}</p>
        <p><b>{mr?'प्राधान्य:':'Priority:'}</b> {detail.priority}</p>
        <p><b>{mr?'नोंदवली:':'Submitted:'}</b> {fmt(detail.createdAt)}</p>
        <p><b>{mr?'समस्या:':'Problem:'}</b> {detail.description}</p>
        {detail.location&&<div>
          <p><b>{mr?'ठिकाण:':'Location:'}</b> {detail.location}</p>
          <button type="button" className="small-btn directions-btn" style={{marginTop:'4px',marginBottom:'8px',display:'inline-flex',alignItems:'center',gap:'5px'}} onClick={()=>openDirections(detail.location,detail.house,team?.ward?.name||user?.ward?.name)}>
            🗺️ {mr?'गुगल मॅप्सवर दिशा पहा':'Get Directions in Google Maps'}
          </button>
        </div>}
      </div>
      <div className="detail-card complaint-detail-status-card">
        <h3>{mr?'तक्रारीची प्रगती':'Complaint progress'}</h3>
        <div className="complaint-status-stepper complaint-status-stepper-detail">
          {statusFlow.map((stage,i)=>{const active=flowIndex(detail.status)>=i;return <div className={`complaint-status-step ${active?'done':''} ${detail.status===stage?'current':''}`} key={stage}><span className="complaint-status-dot">{active?'✓':i+1}</span><small>{statusLabel(stage)}</small></div>})}
        </div>
        <p className="complaint-next-action"><b>{mr?'पुढील कृती:':'Next action:'}</b> {nextAction(detail.status)}</p>
      </div>
      <div className="detail-card">
        <h3>{mr?'जबाबदारी':'Assignment'}</h3>
        <p><b>{mr?'नगरसेवक:':'Nagarsevak:'}</b> {detail.assignedNagarsevak?.name||'Not assigned'} {detail.assignedNagarsevak?.mobile&&` · ${detail.assignedNagarsevak.mobile}`}</p>
        <p><b>{mr?'कर्मचारी:':'Employee:'}</b> {detail.assignedEmployee?.User?.name||'Not assigned'} {detail.assignedEmployee?.User?.mobile&&` · ${detail.assignedEmployee.User.mobile}`}</p>
        <p><b>{mr?'निराकरण:':'Resolution:'}</b> {detail.resolutionNote||'—'}</p>
      </div>
    </div>
    {(parseComplaintImages(detail.reportedImages?.length?detail.reportedImages:detail.reportedImage).length||detail.resolutionImage)&&(
      <div className="detail-card" style={{marginTop:'14px'}}>
        <h3>{mr?'फोटो (तपशील पाहण्यासाठी फोटोवर टॅप करा)':'Photos (Tap on photo to view full size)'}</h3>
        <div className="image-grid photo-preview-grid">
          {parseComplaintImages(detail.reportedImages?.length?detail.reportedImages:detail.reportedImage).map((src,i)=>(
            <div key={i} className="complaint-photo-item" onClick={()=>setPreviewPhoto({src,title:`${mr?'तक्रारीचा फोटो':'Problem photo'} #${i+1} (${detail.complaintNumber})`})}>
              <div className="photo-label">{mr?`तक्रारीचा फोटो #${i+1}`:`Problem photo #${i+1}`}</div>
              <img src={src} alt={`Problem ${i+1}`}/>
              <div className="photo-zoom-hint">{mr?'मोठा पाहण्यासाठी टॅप करा':'Tap to enlarge'}</div>
            </div>
          ))}
          {detail.resolutionImage&&(
            <div className="complaint-photo-item" onClick={()=>setPreviewPhoto({src:detail.resolutionImage,title:`${mr?'काम पूर्ण फोटो':'Completion photo'} (${detail.complaintNumber})`})}>
              <div className="photo-label" style={{color:'#166534',background:'#dcfce7'}}>{mr?'काम पूर्ण फोटो':'Completion photo'}</div>
              <img src={detail.resolutionImage} alt="Completion"/>
              <div className="photo-zoom-hint">{mr?'मोठा पाहण्यासाठी टॅप करा':'Tap to enlarge'}</div>
            </div>
          )}
        </div>
      </div>
    )}
    <div className="detail-card" style={{marginTop:'14px'}}>
      <ComplaintTimeline history={detail.history} complaint={detail} isMr={mr} />
    </div>
  </Modal>}

  {previewPhoto&&(
    <Modal title={previewPhoto.title||'Photo Preview'} onClose={()=>setPreviewPhoto(null)}>
      <div style={{textAlign:'center',padding:'12px'}}>
        <img src={previewPhoto.src} alt="Preview" style={{maxWidth:'100%',maxHeight:'68vh',borderRadius:'12px',objectFit:'contain',boxShadow:'0 8px 30px rgba(0,0,0,0.18)'}}/>
        <div style={{marginTop:'16px',display:'flex',justifyContent:'center',gap:'12px'}}>
          <button type="button" className="small-btn primary-btn" onClick={()=>{
            const w=window.open('');
            if(w){
              w.document.write(`<!DOCTYPE html><html><head><title>${previewPhoto.title||'Photo'}</title><style>body{margin:0;background:#0f172a;display:grid;place-items:center;min-height:100vh;}img{max-width:100%;max-height:100vh;object-fit:contain;box-shadow:0 10px 40px rgba(0,0,0,0.5);}</style></head><body><img src="${previewPhoto.src}" alt="Photo"/></body></html>`);
              w.document.close();
            }
          }}>
            {mr?'नवीन विंडोमध्ये पूर्ण आकार पहा':'View full size in new window'}
          </button>
          <button type="button" className="small-btn ghost-btn" onClick={()=>setPreviewPhoto(null)}>{mr?'बंद करा':'Close'}</button>
        </div>
      </div>
    </Modal>
  )}
 </div>;
}
