import React,{useEffect,useState} from 'react';
import {api,getUser} from '../services/api';
import {Empty,ErrorBox,Field,Loading,Modal,PageHeader,PaginationBar,RowMenu,SearchableSelect,StatusPill,Toolbar} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {isMaster,isSubMaster} from '../rbac';
import {useWardFilter} from '../wardFilter';

function formatDate(value){if(!value)return 'Never';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function accountUsage(lastLogin){if(!lastLogin)return 'Never logged in';const days=Math.floor((Date.now()-new Date(lastLogin).getTime())/86400000);if(days===0)return 'Logged in today';if(days===1)return 'Logged in yesterday';if(days<7)return `Logged in ${days} days ago`;return 'Previously active';}

export default function Users(){
 const current=getUser(),{selectedWardId}=useWardFilter();
 const [rows,setRows]=useState(null),[meta,setMeta]=useState({total:0,page:1,limit:25,pages:1});
 const [wards,setWards]=useState([]),[search,setSearch]=useState(''),[status,setStatus]=useState(''),[page,setPage]=useState(1),[limit,setLimit]=useState(25);
 const [edit,setEdit]=useState(null),[detail,setDetail]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const master=isMaster(current),sub=isSubMaster(current);
 const canManage=true;

 async function load(){try{setError('');const r=await api.users({page,limit,search:search.trim(),status:status||undefined,wardId:selectedWardId||undefined});setRows(r.data||[]);setMeta(r.meta||{total:(r.data||[]).length,page,limit,pages:1});}catch(e){setRows([]);setError(e.message)}}
 useEffect(()=>{setPage(1)},[selectedWardId,search,status]);
 useEffect(()=>{const t=setTimeout(load,180);return()=>clearTimeout(t)},[page,limit,selectedWardId,search,status]);
 useEffect(()=>{api.wards().then(r=>setWards(r.data||[])).catch(()=>{})},[]);

 function openEdit(u){setEdit({id:u.id,name:u.name||'',email:u.email||'',mobile:u.mobile||'',wardId:u.wardId||u.ward?.id||'',status:u.status||'ACTIVE',password:'',confirmPassword:''});}
 async function save(e){e.preventDefault();if(!edit)return;setBusy(true);setError('');try{if(edit.password&&edit.password!==edit.confirmPassword)throw new Error('New password and confirm password do not match.');const payload={name:edit.name.trim(),email:edit.email.trim(),mobile:edit.mobile.replace(/\D/g,''),wardId:edit.wardId,status:edit.status};if(edit.password)payload.password=edit.password;await api.updateUser(edit.id,payload);setEdit(null);await load();}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function remove(u){if(!confirm(`Delete registered user ${u.name}? The account will be disabled and marked deleted.`))return;try{await api.deleteUser(u.id);await load()}catch(e){setError(e.message)}}
 async function setStatusAction(u,next){try{await api.updateUser(u.id,{status:next});await load()}catch(e){setError(e.message)}}
 const total=meta.total||0,pages=Math.max(1,meta.pages||Math.ceil(total/limit)||1);
 return <div className="admin-data-page users-page">
  <PageHeader kicker="People & houses" title="Registered Ward Users" subtitle="Manage people who created an account in the WardDesk application. Administrative citizen records remain separate."/>
  <ErrorBox error={error}/>
  <Toolbar><WardFilter/><input className="grow" placeholder="Search registered name, mobile or email…" value={search} onChange={e=>setSearch(e.target.value)}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SUSPENDED">Suspended</option></select><button className="small-btn" type="button" onClick={()=>{setSearch('');setStatus('');setPage(1)}}>Clear</button></Toolbar>
  <div className="users-summary-grid"><div className="users-summary-card"><span>Registered users</span><strong>{total}</strong></div><div className="users-summary-card"><span>Active</span><strong>{(rows||[]).filter(u=>u.status==='ACTIVE').length}</strong></div><div className="users-summary-card"><span>Suspended</span><strong>{(rows||[]).filter(u=>u.status==='SUSPENDED').length}</strong></div><div className="users-summary-card"><span>Scope</span><strong>{master?'All wards':sub?'Assigned wards':current?.ward?.wardNumber||'My ward'}</strong></div></div>
  {!rows?<Loading/>:!rows.length?<Empty>No registered application users found.</Empty>:<div className="panel table-wrap users-table-wrap"><table className="users-table"><thead><tr><th>User</th><th>Ward</th><th>Status</th><th>Last login</th><th>Registered</th><th>Actions</th></tr></thead><tbody>{rows.map(u=><tr key={u.id}>
   <td data-label="User"><strong>{u.name||'—'}</strong><div className="muted">{u.mobile||'No mobile'}</div><div className="muted">{u.email||'No email'}</div></td>
   <td data-label="Ward"><strong>{u.ward?.wardNumber||'—'}</strong><div className="muted">{u.ward?.name||'Ward not linked'}</div></td>
   <td data-label="Status"><StatusPill>{u.status||'—'}</StatusPill></td>
   <td data-label="Last login">{u.lastLoginAt?<><strong>{formatDate(u.lastLoginAt)}</strong><div className="muted">{accountUsage(u.lastLoginAt)}</div></>:<span className="muted">Never logged in</span>}</td>
   <td data-label="Registered">{formatDate(u.createdAt)}</td>
   <td data-label="Actions"><RowMenu items={[
     {label:'View details',onClick:()=>setDetail(u)},
     u.status!=='DELETED'&&{label:'Edit',onClick:()=>openEdit(u)},
     u.status==='ACTIVE'&&{label:'Suspend',onClick:()=>setStatusAction(u,'SUSPENDED')},
     u.status==='SUSPENDED'&&{label:'Activate',onClick:()=>setStatusAction(u,'ACTIVE')},
     u.status!=='DELETED'&&{label:'Delete',danger:true,onClick:()=>remove(u)}
   ]}/></td>
  </tr>)}</tbody></table></div>}
  {rows&&<PaginationBar page={page} pages={pages} total={total} limit={limit} onPage={setPage} onLimit={setLimit}/>}

  {detail&&<Modal wide title={`${detail.name} · Registered user details`} onClose={()=>setDetail(null)}><div className="user-detail-grid"><div className="detail-card"><h3>Account information</h3><p><b>Name:</b> {detail.name||'—'}</p><p><b>Email / Login:</b> {detail.email||'—'}</p><p><b>Mobile:</b> {detail.mobile||'—'}</p><p><b>Status:</b> <StatusPill>{detail.status}</StatusPill></p><p><b>Account ID:</b> <span className="muted">{detail.id}</span></p></div><div className="detail-card"><h3>Ward & activity</h3><p><b>Ward:</b> {detail.ward?.wardNumber||'—'}{detail.ward?.name?` · ${detail.ward.name}`:''}</p><p><b>Registered:</b> {formatDate(detail.createdAt)}</p><p><b>Last login:</b> {formatDate(detail.lastLoginAt)}</p><p><b>Usage:</b> {accountUsage(detail.lastLoginAt)}</p><p><b>Account type:</b> Registered Ward User</p></div></div><div className="modal-actions"><button className="ghost-btn" onClick={()=>setDetail(null)}>Close</button><button className="primary-btn" onClick={()=>{setDetail(null);openEdit(detail)}}>Edit full account</button></div></Modal>}
  {edit&&<Modal wide title={`Edit ${edit.name||'registered user'}`} onClose={()=>setEdit(null)}><form className="form-grid" onSubmit={save}><Field label="Full name"><input required value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/></Field><Field label="Email / Login ID"><input type="email" required value={edit.email} onChange={e=>setEdit({...edit,email:e.target.value})}/></Field><Field label="Mobile"><input required maxLength="10" value={edit.mobile} onChange={e=>setEdit({...edit,mobile:e.target.value.replace(/\D/g,'').slice(0,10)})}/></Field><SearchableSelect label="Registered ward" required value={edit.wardId} onChange={v=>setEdit({...edit,wardId:v})} options={wards.map(w=>({value:w.id,label:`${w.wardNumber}${w.name?` · ${w.name}`:''}`}))} placeholder="Select ward…"/><Field label="Account status"><select value={edit.status} onChange={e=>setEdit({...edit,status:e.target.value})}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="SUSPENDED">Suspended</option></select></Field><div className="span-2 password-change-box"><strong>Reset password (optional)</strong><span>Leave blank to keep the current password.</span><div className="form-grid password-change-grid"><Field label="New password"><input type="password" minLength="8" value={edit.password} onChange={e=>setEdit({...edit,password:e.target.value})}/></Field><Field label="Confirm password"><input type="password" minLength="8" value={edit.confirmPassword} onChange={e=>setEdit({...edit,confirmPassword:e.target.value})}/></Field></div></div><div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>setEdit(null)}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':'Save full account'}</button></div></form></Modal>}
 </div>;
}
