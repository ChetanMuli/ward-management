import React,{useEffect,useMemo,useState} from 'react';
import {api,getUser} from '../services/api';
import {ErrorBox,Empty,Field,Loading,Modal,PageHeader,SearchableSelect,StatusPill,fmtDateTime} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {isMaster,isSubMaster,isNagarsevak,isEmployee} from '../rbac';
import {useLocation,useNavigate} from 'react-router-dom';
import {useWardFilter} from '../wardFilter';

function prettyType(v){return v==='EVENT'?'Event':'Ward update'}
function prettyAudience(v){
  return ({CITIZEN:'Ward citizens',NAGARSEVAK:'Nagarsevak',EMPLOYEE:'Employees',ALL_STAFF:'Nagarsevak & Employees'})[v]||v||'—';
}
function displayDate(v){
  if(!v)return '';
  const d=new Date(v);
  return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,16);
}

function UpdateForm({onClose,onSaved,wards,currentUser,initialOpen=true}){
  const master=isMaster(currentUser), sub=isSubMaster(currentUser);
  const fixedWard=!master&&!sub ? (currentUser?.wardId||currentUser?.ward?.id||'') : '';
  const [type,setType]=useState('WARD_UPDATE'),[title,setTitle]=useState(''),[message,setMessage]=useState('');
  const [wardId,setWardId]=useState(fixedWard),[audience,setAudience]=useState('CITIZEN');
  const [eventDate,setEventDate]=useState(''),[location,setLocation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{if(!wardId&&fixedWard)setWardId(fixedWard)},[fixedWard,wardId]);

  const audienceOptions = master||sub
    ? [
      {value:'CITIZEN',label:'Ward citizens'},
      {value:'NAGARSEVAK',label:'Nagarsevak'},
      {value:'EMPLOYEE',label:'Employees'},
      {value:'ALL_STAFF',label:'Nagarsevak & Employees'},
    ]
    : [{value:'CITIZEN',label:'Ward citizens'}];

  async function save(e){
    e.preventDefault();setBusy(true);setError('');
    try{
      const r=await api.createWardUpdate({type,title:title.trim(),message:message.trim(),wardId,audience,eventDate:eventDate||undefined,location:location.trim()||undefined});
      onSaved(r);
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  return <Modal wide title={type==='EVENT'?'Create event':'Create ward update'} onClose={onClose}>
    <form className="form-grid ward-update-form" onSubmit={save}>
      <div className="span-2 update-compose-note">
        <strong>Publish a ward update or event</strong>
        <span>{master||sub?'Choose the ward and who should receive the notification.':'This will be published to active citizens of your assigned ward.'}</span>
      </div>
      <Field label="Type">
        <select value={type} onChange={e=>setType(e.target.value)}>
          <option value="WARD_UPDATE">Ward update</option>
          <option value="EVENT">Event</option>
        </select>
      </Field>
      {master||sub
        ? <SearchableSelect label="Ward" required value={wardId} onChange={setWardId} options={wards.map(w=>({value:w.id,label:`${w.wardNumber}${w.name?` · ${w.name}`:''}`}))} placeholder="Select ward"/>
        : <div className="update-scope-field"><div className="section-label">Ward</div><div className="scope-chip">{currentUser?.ward?.wardNumber||'Your assigned ward'}{currentUser?.ward?.name?` · ${currentUser.ward.name}`:''}</div></div>}
      <Field label="Audience">
        <select value={audience} onChange={e=>setAudience(e.target.value)}>
          {audienceOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label={type==='EVENT'?'Event date & time':'Date & time (optional)'}>
        <input type="datetime-local" value={eventDate} onChange={e=>setEventDate(e.target.value)}/>
      </Field>
      <Field label="Location (optional)"><input maxLength="300" value={location} onChange={e=>setLocation(e.target.value)} placeholder={type==='EVENT'?'e.g. Ward office / community hall':'Optional location'}/></Field>
      <Field className="span-2" label="Title"><input required maxLength="180" value={title} onChange={e=>setTitle(e.target.value)} placeholder={type==='EVENT'?'Event title':'Update title'}/></Field>
      <Field className="span-2" label="Message / details"><textarea required rows="7" maxLength="10000" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write the update or event details…"/></Field>
      {error&&<div className="span-2"><ErrorBox error={error}/></div>}
      <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={onClose}>Cancel</button><button className="primary-btn" disabled={busy||!wardId}>{busy?'Publishing…':type==='EVENT'?'Publish event':'Publish update'}</button></div>
    </form>
  </Modal>;
}

export default function WardUpdates({autoOpen=false}){
  const user=getUser(),location=useLocation(),navigate=useNavigate(),{selectedWardId}=useWardFilter();
  const master=isMaster(user),sub=isSubMaster(user);
  const canManage=master||sub||isNagarsevak(user)||isEmployee(user);
  const isCitizen=String(user?.role||'').toUpperCase()==='CITIZEN';
  const [rows,setRows]=useState(null),[meta,setMeta]=useState({total:0,page:1,limit:25,pages:1});
  const [type,setType]=useState(''),[status,setStatus]=useState('PUBLISHED'),[search,setSearch]=useState('');
  const [page,setPage]=useState(1),[limit,setLimit]=useState(25),[error,setError]=useState(''),[compose,setCompose]=useState(canManage&&autoOpen),[wards,setWards]=useState([]),[selectedUpdate,setSelectedUpdate]=useState(null);
  const scopeLabel=master?'all wards':sub?'assigned wards':(user?.ward?.wardNumber||'your ward');

  useEffect(()=>{if(canManage&&(master||sub))api.wards().then(r=>setWards(r.data||[])).catch(e=>setError(e.message))},[master,sub]);
  useEffect(()=>{setPage(1)},[selectedWardId,type,status,search]);
  useEffect(()=>{
    let live=true;
    const timer=setTimeout(async()=>{
      try{
        setError('');
        const r=await api.wardUpdates({page,limit,search:search.trim(),type:type||undefined,status,wardId:selectedWardId||undefined});
        if(!live)return;
        setRows(r.data||[]);setMeta(r.meta||{total:(r.data||[]).length,page,limit,pages:1});
      }catch(e){if(live){setRows([]);setError(e.message)}}
    },160);
    return()=>{live=false;clearTimeout(timer)};
  },[page,limit,search,type,status,selectedWardId]);

  useEffect(()=>{const id=new URLSearchParams(location.search).get('open');if(!id||!rows?.length)return;const found=rows.find(r=>String(r.id)===String(id));if(found)setSelectedUpdate(found)},[location.search,rows]);
  const total=Number(meta.total||0),pages=Math.max(1,Number(meta.pages)||Math.ceil(total/limit)||1);
  const start=total?(page-1)*limit+1:0,end=Math.min(page*limit,total);

  async function archive(id){
    if(!window.confirm('Archive this update? It will no longer appear in the published list.'))return;
    try{await api.archiveWardUpdate(id);setRows(x=>(x||[]).filter(r=>r.id!==id));setMeta(m=>({...m,total:Math.max(0,Number(m.total||0)-1)}));}
    catch(e){setError(e.message)}
  }

  const openCreate=()=>{
    if(!canManage)return;
    setCompose(true);
    navigate('/ward-updates',{replace:true});
  };
  return <div className="ward-updates-page">
    <PageHeader title="Ward Updates & Events" subtitle={isCitizen?`Ward information and events published for registered users of your ward.`:`Publish important ward information, events and notifications. Showing ${scopeLabel}.`} action={canManage?<div className="card-actions"><button className="primary-btn" onClick={openCreate}>＋ New update / event</button></div>:null}/>
    <ErrorBox error={error}/>
    <div className="ward-updates-filter-bar">
      {canManage&&<WardFilter/>}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title, details, location…"/>
      <label>Type<select value={type} onChange={e=>setType(e.target.value)}><option value="">All types</option><option value="WARD_UPDATE">Ward update</option><option value="EVENT">Event</option></select></label>
      {canManage&&<label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label>}
      <button className="small-btn" onClick={()=>{setSearch('');setType('');if(canManage)setStatus('PUBLISHED');setPage(1)}}>Clear filters</button>
    </div>
    {!rows?<Loading/>:!rows.length?<Empty>{status==='ARCHIVED'?'No archived updates found.':'No ward updates or events found.'}</Empty>:
      <div className="ward-update-list">{rows.map(u=>
        <article className={`ward-update-card ${selectedUpdate?.id===u.id?'is-selected':''}`} key={u.id} onClick={()=>setSelectedUpdate(u)}>
          <div className="ward-update-head">
            <div><div className="ward-update-tags"><StatusPill>{u.type}</StatusPill><span className="update-audience">{prettyAudience(u.audience)}</span></div><h3>{u.title}</h3></div>
            <StatusPill>{u.status}</StatusPill>
          </div>
          <p>{u.message}</p>
          <div className="ward-update-meta">
            <span><b>Ward:</b> {u.ward?.wardNumber||'—'}{u.ward?.name?` · ${u.ward.name}`:''}</span>
            <span><b>Published:</b> {fmtDateTime(u.publishedAt||u.createdAt)}</span>
            {u.eventDate&&<span><b>Event:</b> {fmtDateTime(u.eventDate)}</span>}
            {u.location&&<span><b>Location:</b> {u.location}</span>}
            <span><b>By:</b> {u.createdBy?.name||'—'}</span>
          </div>
          {canManage&&status==='PUBLISHED'&&<div className="ward-update-actions"><button className="small-btn danger" onClick={e=>{e.stopPropagation();archive(u.id)}}>Archive</button></div>}
        </article>
      )}</div>}
    {rows&&rows.length>0&&<div className="users-pagination">
      <div>Showing {start}–{end} of {total}</div>
      <label>Rows <select value={limit} onChange={e=>{setLimit(Number(e.target.value));setPage(1)}}><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
      <button className="small-btn" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {pages}</span><button className="small-btn" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Next</button>
    </div>}
    {selectedUpdate&&<Modal wide title={`${selectedUpdate.title} · ${selectedUpdate.type==='EVENT'?'Event':'Ward update'} details`} onClose={()=>setSelectedUpdate(null)}><div className="detail-grid"><div className="detail-card"><h3>Update</h3><p><b>Title:</b> {selectedUpdate.title||'—'}</p><p><b>Type:</b> {prettyType(selectedUpdate.type)}</p><p><b>Status:</b> <StatusPill>{selectedUpdate.status}</StatusPill></p><p><b>Published:</b> {fmtDateTime(selectedUpdate.publishedAt||selectedUpdate.createdAt)}</p><p><b>By:</b> {selectedUpdate.createdBy?.name||'—'}</p></div><div className="detail-card"><h3>Ward & event</h3><p><b>Ward:</b> {selectedUpdate.ward?.wardNumber||'—'}{selectedUpdate.ward?.name?` · ${selectedUpdate.ward.name}`:''}</p><p><b>Audience:</b> {prettyAudience(selectedUpdate.audience)}</p><p><b>Event:</b> {selectedUpdate.eventDate?fmtDateTime(selectedUpdate.eventDate):'—'}</p><p><b>Location:</b> {selectedUpdate.location||'—'}</p></div></div><div className="detail-card"><h3>Full message</h3><p style={{whiteSpace:'pre-wrap'}}>{selectedUpdate.message||'—'}</p></div><div className="modal-actions"><button className="ghost-btn" onClick={()=>setSelectedUpdate(null)}>Close</button></div></Modal>}
    {compose&&<UpdateForm currentUser={user} wards={wards} onClose={()=>{setCompose(false);if(canManage&&autoOpen)navigate('/ward-updates',{replace:true})}} onSaved={async r=>{setCompose(false);navigate('/ward-updates',{replace:true});setStatus('PUBLISHED');setPage(1);const fresh=await api.wardUpdates({page:1,limit,search:search.trim(),type:type||undefined,status:'PUBLISHED',wardId:selectedWardId||undefined});setRows(fresh.data||[]);setMeta(fresh.meta||meta);}}/>}
  </div>;
}
