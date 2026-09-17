import React,{useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api,getUser} from '../services/api';
import {ErrorBox,Loading,Modal,PageHeader,StatCard,StatusPill,FaceAvatar} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {isEmployee,isMaster,isNagarsevak} from '../rbac';
import {useWardFilter} from '../wardFilter';

const complaintLabels=['SUBMITTED','PENDING','ASSIGNED','IN_PROGRESS','RESOLVED','REOPENED','CLOSED'];
function wardLabel(row){
  const number=row?.ward?.wardNumber||row?.house?.area?.ward?.wardNumber;
  const name=row?.ward?.name||row?.house?.area?.ward?.name;
  if(!number&&!name) return 'Ward not linked';
  return name?`${number} · ${name}`:number;
}
function snippet(text,n=90){
  const t=String(text||'').replace(/\s+/g,' ').trim();
  if(!t) return 'No problem description';
  return t.length>n?`${t.slice(0,n)}…`:t;
}

export default function Dashboard(){
 const user=getUser(); const navigate=useNavigate();
 const [data,setData]=useState(null),[detail,setDetail]=useState(null),[error,setError]=useState(''),[refreshing,setRefreshing]=useState(false);
 const {selectedWardId:selected}=useWardFilter();
 useEffect(()=>{
  let live=true;
  const load=()=>{
   setRefreshing(true);
   api.dashboard({wardId:selected||undefined}).then(r=>{if(live){setData(r.data);setError('')}}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setRefreshing(false)});
  };
  setError('');load();
  const timer=setInterval(load,30000);
  return()=>{live=false;clearInterval(timer)};
 },[selected]);
 if(error&&!data)return <><PageHeader title="Dashboard"/><ErrorBox error={error}/></>;
 if(!data)return <Loading/>;
 const master=isMaster(user),nagar=isNagarsevak(user),employee=isEmployee(user);const status=data.statusCounts||{};
 const title=master?'Master dashboard':nagar?'Nagarsevak dashboard':'Employee dashboard';
 const subtitle=master?'See people, households and complaint work across every ward you manage.':nagar?'Your ward at a glance — people, households, complaints and team.':'Your assigned ward and field work at a glance.';
 const scopeText=data.ward?`${data.ward.wardNumber} · ${data.ward.name}`:'All wards';
 const openTo=(path)=>navigate(path);
 const recent=data.recentComplaints||[];
 const statusMeta={
  SUBMITTED:{label:'Submitted',hint:'Just received'},
  PENDING:{label:'Pending',hint:'Waiting to assign'},
  ASSIGNED:{label:'Assigned',hint:'With the team'},
  IN_PROGRESS:{label:'In progress',hint:'Work underway'},
  RESOLVED:{label:'Resolved',hint:'Ready to close'},
  REOPENED:{label:'Reopened',hint:'Needs follow-up'},
  CLOSED:{label:'Closed',hint:'Completed'}
 };
 return <div className="admin-dashboard-page">
  <PageHeader kicker="Overview" title={title} subtitle={subtitle}/>
  <ErrorBox error={error}/>
  <section className="dashboard-scope-panel">
   <div className="dashboard-scope-copy"><span className="eyebrow">DASHBOARD FILTER</span><h3>View dashboard by ward</h3><p>Choose a ward to see its houses, citizens, voters and complaints. The same ward stays selected in Complaints and other sections.</p></div>
   <div className="dashboard-scope-control"><WardFilter label="Select ward"/></div>
   <div className="scope-chip"><span>SHOWING DATA FOR</span><strong>{scopeText}</strong><small>{refreshing?'Updating…':`Updated ${new Date(data.generatedAt||Date.now()).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`}</small></div>
  </section>
  {data.ward&&<section className="panel dashboard-ward-summary"><div className="dashboard-ward-title"><span className="eyebrow">CURRENT WARD</span><h2>{data.ward.wardNumber}</h2><h3>{data.ward.name||'Ahilyanagar Municipal Corporation Ward'}</h3></div><div className="dashboard-ward-facts"><div><span>Population (2011)</span><strong>{Number(data.ward.population2011||0).toLocaleString('en-IN')}</strong></div><div><span>Key areas</span><strong>{Number(data.ward.areaCount||0)}</strong></div><div><span>Open complaints</span><strong>{data.openComplaints||0}</strong></div><div><span>Official map</span><a href={data.ward.officialMapUrl} target="_blank" rel="noreferrer">View AMC map ↗</a></div></div></section>}
  {(nagar||employee)&&<section className="panel profile-banner"><FaceAvatar name={data.user?.name||getUser()?.name} photo={data.user?.photo||getUser()?.photo} className="staff-face-lg"/><div><span className="eyebrow">{nagar?'NAGARSEVAK':'EMPLOYEE'}</span><h2>{data.user?.name}</h2><p>{scopeText}{data.employee?.designation?` · ${data.employee.designation}`:''}</p></div><div className="profile-quick"><div><span>Open work</span><strong>{data.openComplaints}</strong></div>{nagar&&<div><span>Employees</span><strong>{data.managedEmployees}</strong></div>}{employee&&<div><span>Manager</span><strong>{data.employee?.manager?.name||'—'}</strong></div>}</div></section>}
  {(nagar||employee)&&<section className="panel today-ward-panel">
   <div className="panel-title"><div><h3>Today in your ward</h3><span>Short list of whose day it is — birthday, 10th day (Dahava) and 1st year.</span></div></div>
   {!(data.todayEvents||[]).length
    ? <p className="muted">No birthday, Dahava or 1st year in this ward today.</p>
    : <ul className="today-event-list">
      {(data.todayEvents||[]).map(ev=>(
       <li key={ev.id}>
        <button type="button" className={`today-event today-${String(ev.kind||'').toLowerCase()}`} onClick={()=>openTo(ev.kind==='BIRTHDAY'?'/birthdays':'/deaths')}>
         <span className="today-event-kind">{ev.label}</span>
         <strong>{ev.name}</strong>
         <small>{ev.house?`House ${ev.house}`:'Ward record'}</small>
        </button>
       </li>
      ))}
     </ul>}
  </section>}
  <section className="panel dashboard-info-panel">
   <div className="panel-title"><div><h3>Ward information</h3><span>Live counts for {scopeText}. Tap a card to open that section.</span></div></div>
   <div className="stat-grid">
    <StatCard label="Houses" value={data.houses} hint="Registered households" onClick={()=>openTo('/houses')}/>
    <StatCard label="Families" value={data.families} hint="Registered family records" onClick={()=>openTo('/families')}/>
    <StatCard label="Citizens" value={data.persons} hint="Active residents" onClick={()=>openTo('/people')}/>
    <StatCard label="Total complaints" value={data.complaints||0} hint={`${data.openComplaints||0} still open`} onClick={()=>openTo('/complaints')}/>
    <StatCard label="Voters" value={data.voters} hint={`${data.nonVoters||0} non-voters`} onClick={()=>openTo('/voters')}/>
    <StatCard label="Birthdays next 30" value={data.birthdaysNext30} hint="Upcoming wishes" onClick={()=>openTo('/birthdays')}/>
    <StatCard label="18+ next 90 days" value={data.upcoming18Next90} hint="Follow-up candidates" onClick={()=>openTo('/follow-up-18')}/>
    {master&&<StatCard label="Nagarsevaks" value={data.corporatorCount} hint="Active ward leaders" onClick={()=>openTo('/staff')}/>}
    {nagar&&<StatCard label="My employees" value={data.managedEmployees} hint="Directly managed" onClick={()=>openTo('/staff')}/>}
   </div>
  </section>
  <div className="two-col dashboard-lower">
   <section className="panel complaint-status-panel"><div className="panel-title"><div><h3>Complaint status</h3><span>Live breakdown for {scopeText}.</span></div><button type="button" className="small-btn" onClick={()=>openTo('/complaints')}>Open list</button></div>
    <div className="status-card-grid">{complaintLabels.map(s=>{const meta=statusMeta[s];return <button type="button" className={`status-card status-${String(s).toLowerCase().replaceAll('_','-')}`} key={s} onClick={()=>openTo(`/complaints?status=${s}`)}><span className="status-card-label">{meta.label}</span><strong>{status[s]||0}</strong><small>{meta.hint}</small></button>})}</div>
   </section>
   <section className="panel"><div className="panel-title"><div><h3>Recent complaints</h3><span>{recent.length?`${recent.length} latest items in this scope.`:'New complaints will appear here.'}</span></div></div>{!recent.length?<p className="muted">No complaints in this ward scope yet.</p>:<div className="status-list dashboard-recent">{recent.map(c=><div className="status-row recent-row" key={c.id}><div><strong>{c.complaintNumber}</strong><span>{c.citizen?.fullName||c.submittedBy?.name||'Citizen'} · {wardLabel(c)}</span><small className="recent-problem">{snippet(c.description)}</small><small className="recent-assign">Nagarsevak: {c.assignedNagarsevak?.name||c.assignedEmployee?.manager?.name||'Not assigned'} · Employee: {c.assignedEmployee?.User?.name||'Not assigned'}</small></div><div className="recent-actions"><StatusPill>{c.status}</StatusPill><button className="small-btn view-btn" onClick={async()=>{try{setDetail((await api.complaint(c.id)).data)}catch(e){setError(e.message)}}}>View</button></div></div>)}</div>}</section>
  </div>
  {detail&&<Modal wide title={`${detail.complaintNumber} · Complete complaint details`} onClose={()=>setDetail(null)}><div className="detail-grid complaint-detail-grid"><div className="detail-card"><h3>Who submitted this?</h3><p><b>Citizen:</b> {detail.citizen?.fullName||detail.submittedBy?.name||'Registered resident'}</p><p><b>Registered account:</b> {detail.submittedBy?.name||'Not linked / legacy record'}</p><p><b>Mobile:</b> {detail.citizen?.mobile||detail.submittedBy?.mobile||'—'}</p><p><b>Email:</b> {detail.submittedBy?.email||detail.citizen?.email||'—'}</p></div><div className="detail-card"><h3>Complaint</h3><p><b>Category:</b> {detail.category?.replaceAll('_',' ')||'—'}</p><p><b>Priority:</b> {detail.priority||'—'}</p><p><b>Status:</b> <StatusPill>{detail.status}</StatusPill></p><p><b>Created:</b> {detail.createdAt?new Date(detail.createdAt).toLocaleString('en-IN'):'—'}</p><p><b>Location:</b> {detail.location||'—'}</p><p><b>Problem:</b> {detail.description||'—'}</p></div><div className="detail-card"><h3>Assignment</h3><p><b>Ward:</b> {detail.ward?.wardNumber||detail.house?.area?.ward?.wardNumber||'—'}{detail.ward?.name||detail.house?.area?.ward?.name?` · ${detail.ward?.name||detail.house?.area?.ward?.name}`:''}</p><p><b>Nagarsevak:</b> {detail.assignedNagarsevak?.name||detail.assignedEmployee?.manager?.name||'Not assigned'}</p><p><b>Employee:</b> {detail.assignedEmployee?.User?.name||'Not assigned'}</p><p><b>Resolution:</b> {detail.resolutionNote||'—'}</p></div></div>{(detail.reportedImage||detail.resolutionImage)&&<div className="detail-card"><h3>Photos</h3><div className="image-grid">{detail.reportedImage&&<div><strong>Problem reported</strong><img src={detail.reportedImage} alt="Reported problem"/></div>}{detail.resolutionImage&&<div><strong>Work completed</strong><img src={detail.resolutionImage} alt="Completed work"/></div>}</div></div>}<div className="detail-card"><h3>Activity timeline</h3><div className="complaint-timeline">{(detail.history||[]).length?(detail.history||[]).slice().sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)).map((h,i)=><div className="timeline-item" key={h.id||i}><strong>{h.newStatus?.replaceAll('_',' ')||'Updated'}</strong><small>{new Date(h.createdAt).toLocaleString('en-IN')} · {h.changedBy?.name||'System'}</small><div>{h.comment||'Status updated'}</div></div>):<div className="muted">No activity recorded.</div>}</div></div><div className="modal-actions"><button className="ghost-btn" onClick={()=>setDetail(null)}>Close</button><button className="primary-btn" onClick={()=>{setDetail(null);navigate(`/complaints?open=${detail.id}`)}}>Open in Complaints</button></div></Modal>}
 </div>;
}
