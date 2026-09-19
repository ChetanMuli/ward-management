import React,{useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api,getUser} from '../services/api';
import {ErrorBox,Loading,Modal,PageHeader,StatCard,StatusPill,FaceAvatar} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {isEmployee,isMaster,isNagarsevak,can} from '../rbac';
import {useWardFilter} from '../wardFilter';
import {hasCoords} from '../location';
import {DirectionsLink} from '../components/LocationMap';

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
function TodayColumn({title,count,empty,items,kind,onOpen}){
  return (
    <div className={`today-col today-col-${kind}`}>
      <div className="today-col-head">
        <div>
          <h4>{title}</h4>
          <span>{count} today</span>
        </div>
        <strong>{count}</strong>
      </div>
      {!items.length
        ? <p className="muted">{empty}</p>
        : <ul className="today-event-list">{items.map(ev=>(
          <li key={ev.id}>
            <div className={`today-event today-${kind}`}>
              <button type="button" className="today-event-main" onClick={()=>onOpen(ev)}>
                <strong>{ev.name}</strong>
                <small>{ev.house?`House ${ev.house}`:'House not linked'}{ev.address?` · ${ev.address}`:''}</small>
              </button>
              {hasCoords(ev.latitude,ev.longitude)
                ? <DirectionsLink lat={ev.latitude} lng={ev.longitude} label="Directions"/>
                : <span className="muted today-no-pin">No pin</span>}
            </div>
          </li>
        ))}</ul>}
    </div>
  );
}

export default function Dashboard(){
 const user=getUser(); const navigate=useNavigate();
 const [data,setData]=useState(null),[detail,setDetail]=useState(null),[error,setError]=useState(''),[refreshing,setRefreshing]=useState(false),[chatUnread,setChatUnread]=useState(0);
 const {selectedWardId:selected,canSelect}=useWardFilter();
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
 useEffect(()=>{
  let live=true;
  const loadChat=()=>api.chatGroups(selected?{wardId:selected}:{}).then(r=>{
   if(!live)return;
   setChatUnread((r.data||[]).reduce((n,g)=>n+Number(g.unreadCount||0),0));
  }).catch(()=>{});
  loadChat();
  const t=setInterval(loadChat,15000);
  window.addEventListener('ward:chat-refresh',loadChat);
  return()=>{live=false;clearInterval(t);window.removeEventListener('ward:chat-refresh',loadChat)};
 },[selected]);
 if(error&&!data)return <><PageHeader title="Dashboard"/><ErrorBox error={error}/></>;
 if(!data)return <Loading/>;
 const master=isMaster(user),nagar=isNagarsevak(user),employee=isEmployee(user);const status=data.statusCounts||{};
 const field=nagar||employee;
 const title=master?'Master dashboard':nagar?'Nagarsevak dashboard':'Employee dashboard';
 const subtitle=master?'See people, households and complaint work across every ward you manage.':nagar?'Your ward today — who has a birthday, Dahava or Varshashraddha, plus open work.':'Same field view as your Nagarsevak — today\'s visits, directions and assigned work.';
 const scopeText=data.ward?`${data.ward.wardNumber} · ${data.ward.name}`:'All wards';
 const openTo=(path)=>navigate(path);
 const recent=data.recentComplaints||[];
 const events=data.todayEvents||[];
 const birthdays=events.filter(ev=>ev.kind==='BIRTHDAY');
 const dahava=events.filter(ev=>ev.kind==='DAHAVA');
 const varsha=events.filter(ev=>ev.kind==='ANNIVERSARY');
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
  {canSelect&&<section className="dashboard-scope-panel">
   <div className="dashboard-scope-copy"><span className="eyebrow">DASHBOARD FILTER</span><h3>View dashboard by ward</h3><p>Choose a ward to see its houses, citizens, voters and complaints. The same ward stays selected in Complaints and other sections.</p></div>
   <div className="dashboard-scope-control"><WardFilter label="Select ward"/></div>
   <div className="scope-chip"><span>SHOWING DATA FOR</span><strong>{scopeText}</strong><small>{refreshing?'Updating…':`Updated ${new Date(data.generatedAt||Date.now()).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`}</small></div>
  </section>}
  {!canSelect&&<div className="scope-chip dashboard-fixed-scope"><span>SHOWING DATA FOR</span><strong>{scopeText}</strong><small>{refreshing?'Updating…':`Updated ${new Date(data.generatedAt||Date.now()).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`}</small></div>}
  {data.ward&&master&&<section className="panel dashboard-ward-summary"><div className="dashboard-ward-title"><span className="eyebrow">CURRENT WARD</span><h2>{data.ward.wardNumber}</h2><h3>{data.ward.name||'Ahilyanagar Municipal Corporation Ward'}</h3></div><div className="dashboard-ward-facts"><div><span>Population (2011)</span><strong>{Number(data.ward.population2011||0).toLocaleString('en-IN')}</strong></div><div><span>Key areas</span><strong>{Number(data.ward.areaCount||0)}</strong></div><div><span>Open complaints</span><strong>{data.openComplaints||0}</strong></div><div><span>Official map</span><a href={data.ward.officialMapUrl} target="_blank" rel="noreferrer">View AMC map ↗</a></div></div></section>}
  {field&&<section className="panel profile-banner"><FaceAvatar name={data.user?.name||getUser()?.name} photo={data.user?.photo||getUser()?.photo} className="staff-face-lg"/><div><span className="eyebrow">{nagar?'NAGARSEVAK':'EMPLOYEE'}</span><h2>{data.user?.name}</h2><p>{scopeText}{data.employee?.designation?` · ${data.employee.designation}`:''}</p></div><div className="profile-quick"><div><span>Open work</span><strong>{data.openComplaints}</strong></div>{nagar&&<div><span>Employees</span><strong>{data.managedEmployees}</strong></div>}{employee&&<div><span>Nagarsevak</span><strong>{data.employee?.manager?.name||'—'}</strong></div>}</div></section>}
  {field&&<section className="panel today-ward-panel">
   <div className="panel-title"><div><h3>Today in your ward</h3><span>Who has a birthday, Dahava (10th day) or Varshashraddha (1st year). Open directions to visit the house.</span></div></div>
   <div className="today-col-grid">
    <TodayColumn title="Birthdays" kind="birthday" count={data.todayBirthdays||birthdays.length} empty="No birthday in this ward today." items={birthdays} onOpen={()=>openTo('/birthdays')}/>
    <TodayColumn title="Dahava (10th day)" kind="dahava" count={data.todayDahava||dahava.length} empty="No Dahava in this ward today." items={dahava} onOpen={()=>openTo('/deaths')}/>
    <TodayColumn title="Varshashraddha (1st year)" kind="anniversary" count={data.todayVarshashraddha||varsha.length} empty="No Varshashraddha in this ward today." items={varsha} onOpen={()=>openTo('/deaths')}/>
   </div>
  </section>}
  <section className="panel dashboard-info-panel">
   <div className="panel-title"><div><h3>{field?'Ward work':'Ward information'}</h3><span>Live counts for {scopeText}. Tap a card to open that section.</span></div></div>
   <div className="stat-grid">
    {can('VIEW_HOUSES')&&<StatCard label="Houses" value={data.houses} hint="Registered households" onClick={()=>openTo('/houses')}/>}
    {can('VIEW_FAMILIES')&&<StatCard label="Families" value={data.families} hint="Registered family records" onClick={()=>openTo('/families')}/>}
    {can('VIEW_CITIZENS')&&<StatCard label="Citizens" value={data.persons} hint="Active residents" onClick={()=>openTo('/people')}/>}
    {can('VIEW_COMPLAINTS')&&<StatCard label="Open complaints" value={data.openComplaints||0} hint={`${data.complaints||0} total`} onClick={()=>openTo('/complaints')}/>}
    {can('VIEW_VOTERS')&&<StatCard label="Voters" value={data.voters} hint={`${data.nonVoters||0} non-voters`} onClick={()=>openTo('/voters')}/>}
    {!field&&<StatCard label="Birthdays today" value={data.todayBirthdays||0} hint="In this ward today" onClick={()=>openTo('/birthdays')}/>}
    {can('VIEW_BIRTHDAYS')&&<StatCard label="Birthdays next 30" value={data.birthdaysNext30} hint="Upcoming wishes" onClick={()=>openTo('/birthdays')}/>}
    {can('VIEW_18PLUS')&&<StatCard label="18+ next 90 days" value={data.upcoming18Next90} hint="Follow-up candidates" onClick={()=>openTo('/follow-up-18')}/>}
    {master&&<StatCard label="Nagarsevaks" value={data.corporatorCount} hint="Active ward leaders" onClick={()=>openTo('/staff')}/>}
    {nagar&&can('VIEW_STAFF')&&<StatCard label="My employees" value={data.managedEmployees} hint="Directly managed" onClick={()=>openTo('/staff')}/>}
    {can('VIEW_CHAT')&&<StatCard label="Groups & Chat" value={chatUnread} hint={chatUnread?`${chatUnread} unread message${chatUnread===1?'':'s'}`:'Open ward chat'} onClick={()=>openTo('/groups')}/>}
   </div>
  </section>
  <div className="two-col dashboard-lower">
   <section className="panel complaint-status-panel"><div className="panel-title"><div><h3>Complaint status</h3><span>Live breakdown for {scopeText}.</span></div>{can('VIEW_COMPLAINTS')&&<button type="button" className="small-btn" onClick={()=>openTo('/complaints')}>Open list</button>}</div>
    <div className="status-card-grid">{complaintLabels.map(s=>{const meta=statusMeta[s];return <button type="button" className={`status-card status-${String(s).toLowerCase().replaceAll('_','-')}`} key={s} onClick={()=>can('VIEW_COMPLAINTS')&&openTo(`/complaints?status=${s}`)}><span className="status-card-label">{meta.label}</span><strong>{status[s]||0}</strong><small>{meta.hint}</small></button>})}</div>
   </section>
   <section className="panel"><div className="panel-title"><div><h3>Recent complaints</h3><span>{recent.length?`${recent.length} latest items in this scope.`:'New complaints will appear here.'}</span></div></div>{!recent.length?<p className="muted">No complaints in this ward scope yet.</p>:<div className="status-list dashboard-recent">{recent.map(c=><div className="status-row recent-row" key={c.id}><div><strong>{c.complaintNumber}</strong><span>{c.citizen?.fullName||c.submittedBy?.name||'Citizen'} · {wardLabel(c)}</span><small className="recent-problem">{snippet(c.description)}</small><small className="recent-assign">Nagarsevak: {c.assignedNagarsevak?.name||c.assignedEmployee?.manager?.name||'Not assigned'} · Employee: {c.assignedEmployee?.User?.name||'Not assigned'}</small></div><div className="recent-actions"><StatusPill>{c.status}</StatusPill><button className="small-btn view-btn" onClick={async()=>{try{setDetail((await api.complaint(c.id)).data)}catch(e){setError(e.message)}}}>View</button></div></div>)}</div>}</section>
  </div>
  {detail&&<Modal wide title={`${detail.complaintNumber} · Complete complaint details`} onClose={()=>setDetail(null)}><div className="detail-grid complaint-detail-grid"><div className="detail-card"><h3>Who submitted this?</h3><p><b>Citizen:</b> {detail.citizen?.fullName||detail.submittedBy?.name||'Registered resident'}</p><p><b>Registered account:</b> {detail.submittedBy?.name||'Not linked / legacy record'}</p><p><b>Mobile:</b> {detail.citizen?.mobile||detail.submittedBy?.mobile||'—'}</p><p><b>Email:</b> {detail.submittedBy?.email||detail.citizen?.email||'—'}</p></div><div className="detail-card"><h3>Complaint</h3><p><b>Category:</b> {detail.category?.replaceAll('_',' ')||'—'}</p><p><b>Priority:</b> {detail.priority||'—'}</p><p><b>Status:</b> <StatusPill>{detail.status}</StatusPill></p><p><b>Created:</b> {detail.createdAt?new Date(detail.createdAt).toLocaleString('en-IN'):'—'}</p><p><b>Location:</b> {detail.location||'—'}</p><p><b>Problem:</b> {detail.description||'—'}</p></div><div className="detail-card"><h3>Assignment</h3><p><b>Ward:</b> {detail.ward?.wardNumber||detail.house?.area?.ward?.wardNumber||'—'}{detail.ward?.name||detail.house?.area?.ward?.name?` · ${detail.ward?.name||detail.house?.area?.ward?.name}`:''}</p><p><b>Nagarsevak:</b> {detail.assignedNagarsevak?.name||detail.assignedEmployee?.manager?.name||'Not assigned'}</p><p><b>Employee:</b> {detail.assignedEmployee?.User?.name||'Not assigned'}</p><p><b>Resolution:</b> {detail.resolutionNote||'—'}</p></div></div>{(detail.reportedImage||detail.resolutionImage)&&<div className="detail-card"><h3>Photos</h3><div className="image-grid">{detail.reportedImage&&<div><strong>Problem reported</strong><img src={detail.reportedImage} alt="Reported problem"/></div>}{detail.resolutionImage&&<div><strong>Work completed</strong><img src={detail.resolutionImage} alt="Completed work"/></div>}</div></div>}<div className="detail-card"><h3>Activity timeline</h3><div className="complaint-timeline">{(detail.history||[]).length?(detail.history||[]).slice().sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)).map((h,i)=><div className="timeline-item" key={h.id||i}><strong>{h.newStatus?.replaceAll('_',' ')||'Updated'}</strong><small>{new Date(h.createdAt).toLocaleString('en-IN')} · {h.changedBy?.name||'System'}</small><div>{h.comment||'Status updated'}</div></div>):<div className="muted">No activity recorded.</div>}</div></div><div className="modal-actions"><button className="ghost-btn" onClick={()=>setDetail(null)}>Close</button><button className="primary-btn" onClick={()=>{setDetail(null);navigate(`/complaints?open=${detail.id}`)}}>Open in Complaints</button></div></Modal>}
 </div>;
}
