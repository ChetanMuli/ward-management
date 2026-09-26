import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Navigate,NavLink,Route,Routes,useLocation,useNavigate} from 'react-router-dom';
import {api,clearSession,getUser} from './services/api';
import {can,isMaster,isSubMaster,isNagarsevak,isEmployee,roleOf,canModule,permissionsOf} from './rbac';
import {initLanguage,setLanguage as applyLanguage,switchLanguage} from './language';
import Login from './pages/Login'; import WardInformation from './pages/WardInformation'; import Register from './pages/Register'; import Users from './pages/Users'; import GovernmentVoterLists from './pages/GovernmentVoterLists'; import Dashboard from './pages/Dashboard'; import Houses from './pages/Houses'; import People from './pages/People'; import Families from './pages/Families'; import Shops from './pages/Shops'; import Voters from './pages/Voters'; import Complaints from './pages/Complaints'; import Birthdays from './pages/Birthdays'; import FollowUp18 from './pages/FollowUp18'; import Wards from './pages/Wards'; import Reports from './pages/Reports'; import RecycleBin from './pages/RecycleBin'; import Schemes from './pages/Schemes'; import Staff from './pages/Staff';
import Stakeholders from './pages/Stakeholders';
import Groups from './pages/Groups'; import Deaths from './pages/Deaths'; import SubAdmins from './pages/SubAdmins'; import WardUpdates from './pages/WardUpdates'; import UserPanel from './pages/UserPanel'; import UserComplaints from './pages/UserComplaints'; import ElectionData from './pages/ElectionData'; import WardActivation from './pages/WardActivation'; import NagarsevakSubscriptions from './pages/NagarsevakSubscriptions';
import Schedules from './pages/Schedules';
import {Modal,PaginationBar,ProfileAvatar,FaceAvatar,CirclePhotoField,scrollMainToTop} from './components/Ui';
import {notificationTarget} from './utils/notificationTarget';

function ScheduleNavIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-1.5px' }}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

const navSections=[
 {id:'overview',en:'Overview',mr:'आढावा',items:[
  ['/dashboard','Dashboard','⌂','DASHBOARD']
 ]},
 {id:'setup',en:'Ward setup',mr:'वॉर्ड मांडणी',items:[
  ['/wards','Wards & Areas','▦','WARDS'],
  ['/ward-information','Ward Information','⌖','WARD_INFORMATION']
 ]},
 {id:'people',en:'People & houses',mr:'नागरिक व घरे',items:[
  ['/houses','Houses','⌂','HOUSES'],
  ['/families','Families','👪','FAMILIES'],
  ['/shops','Shops & Offices','▣','SHOPS'],
  ['/people','All Citizens','●','PEOPLE'],
  ['/voters','Voter / Non-Voter','✓','VOTERS'],
  ['/users','Registered Users','●','USERS']
 ]},
 {id:'work',en:'Daily work',mr:'दैनंदिन काम',items:[
   ['/schedules','Daily Schedule',<ScheduleNavIcon key="sched-icon" />,'SCHEDULES'],
   ['/complaints','Complaints','⚑','COMPLAINTS'],
  ['__WARD_UPDATES__','Ward Updates & Events','▣','WARD_UPDATES_GROUP'],
  ['/schemes','Schemes & Benefits','◇','SCHEMES'],
  ['/birthdays','Birthdays','★','BIRTHDAYS'],
  ['/follow-up-18','18+ Follow-up','18','FOLLOWUP'],
  ['/deaths','Death Records','†','DEATH']
 ]},
 {id:'election',en:'Election',mr:'निवडणूक',items:[
  ['/government-voter-lists','Government Voter Lists','▤','GOVERNMENT_VOTER_LISTS'],
  ['/election-data','Election Data','◉','ELECTION_DATA']
 ]},
 {id:'team',en:'Team & access',mr:'टीम व प्रवेश',items:[
  ['/staff','Nagarsevak & Employees','♙','STAFF'],
  ['/ward-activation','Ward activation','●','WARD_ACTIVATION'],
  ['/nagarsevak-subscriptions','Nagarsevak subscriptions','◷','NAGARSEVAK_SUBSCRIPTIONS'],
  ['/stakeholders','Community Members','◈','STAKEHOLDERS'],
  ['/sub-admins','Sub Master Admins','♙','SUBADMINS']
 ]},
 {id:'tools',en:'Tools',mr:'साधने',items:[
  ['/groups','All chat & Groups','▣','CHAT'],
  ['/reports','Reports & Export','⇩','REPORTS'],
  ['/recycle-bin','Recycle Bin','♻','RECYCLE']
 ]}
];
const mrNav={'Daily Schedule':'दैनिक वेळापत्रक','All chat & Groups':'ऑल चॅट व गट','Groups & Chat':'गट व चॅट',Dashboard:'डॅशबोर्ड','Wards & Areas':'वॉर्ड व परिसर','Ward Information':'वॉर्डची संपूर्ण माहिती','Nagarsevak & Employees':'नगरसेवक व कर्मचारी','Ward activation':'वॉर्ड सक्रियता','Nagarsevak subscriptions':'नगरसेवक सदस्यता','Community Members':'समुदाय सदस्य','Registered Users':'नोंदणीकृत वापरकर्ते','Sub Master Admins':'सब मास्टर अ‍ॅडमिन','Houses':'घरे','Families':'कुटुंबे','Shops & Offices':'दुकाने व कार्यालये','All Citizens':'सर्व नागरिक','Voter / Non-Voter':'मतदार / अमतदार','Government Voter Lists':'शासकीय मतदार यादी','Election Data':'निवडणूक माहिती','Birthdays':'वाढदिवस','18+ Follow-up':'१८+ फॉलो-अप','Death Records':'मृत्यू नोंद','Complaints':'तक्रारी','Schemes & Benefits':'योजना व लाभ','Reports & Export':'अहवाल व एक्सपोर्ट','Audit Logs':'ऑडिट लॉग','Ward Updates & Events':'वॉर्ड अपडेट्स व कार्यक्रम','All Ward Updates':'सर्व वॉर्ड अपडेट्स','New Update / Event':'नवीन अपडेट / कार्यक्रम','Recycle Bin':'रिसायकल बिन'};
const pageTitles={
 '/':'Dashboard','/login':'Resident login','/register':'Resident registration','/admin':'Admin login','/dashboard':'Dashboard','/schedules':'Daily Schedule & Action Plan','/wards':'Wards & Areas','/ward-information':'Ward Information','/staff':'Nagarsevak & Employees','/ward-activation':'Ward activation','/nagarsevak-subscriptions':'Nagarsevak subscriptions','/stakeholders':'Community Members','/users':'Registered Ward Users','/sub-admins':'Sub Master Admins','/houses':'Houses','/families':'Families','/shops':'Shops & Offices','/people':'All Citizens','/voters':'Voter / Non-Voter','/government-voter-lists':'Government Voter Lists','/election-data':'Election Data','/ward-updates':'Ward Updates & Events','/ward-updates/new':'Create Ward Update / Event','/birthdays':'Birthdays','/follow-up-18':'18+ Follow-up','/deaths':'Death Records','/complaints':'Complaints','/schemes':'Schemes & Benefits','/reports':'Reports & Export','/groups':'All chat & Groups','/recycle-bin':'Recycle Bin'
};
const pageTitle=(path,user)=>{
 if(path==='/staff' && !(isMaster(user)||isSubMaster(user))) return 'Employees';
 return pageTitles[path]||'WardDesk';
};
const ROLE_LABELS={SUPER_ADMIN:'Master Admin',SUB_MASTER_ADMIN:'Sub Master Admin',NAGARSEVAK:'Nagarsevak',EMPLOYEE:'Field Employee',CITIZEN:'Resident',SOCIAL_WORKER:'Social Worker',CANDIDATE:'Election Candidate'};
function prettyRole(u){const r=String(typeof u==='string'?u:(u?.role||u?.roleName||'')).toUpperCase();return ROLE_LABELS[r]||(r?r.replaceAll('_',' '):'User')}
function workspaceLabel(user){if(isMaster(user))return 'Master administration';if(isSubMaster(user))return 'Sub Master Admin workspace';if(isNagarsevak(user))return 'Nagarsevak workspace';if(String(user?.role||'').toUpperCase()==='CITIZEN')return 'Resident workspace';return 'Field employee workspace'}
const pageHelp={
 '/':'See ward numbers, people and complaint work at a glance.',
 '/admin':'Sign in to the staff workspace.',
 '/dashboard':'See ward numbers, people and complaint work at a glance.',
 '/schedules':'Nagarsevak daily schedule, site visits, meetings, and action plan.',
 '/wards':'Create wards and colonies. Exact home location is saved when a team member visits the house.',
 '/houses':'When you visit a home, save GPS at the door. Tap the location later to open maps and get directions.',
 '/families':'Each family lives at a house. Open directions from the house location.',
 '/shops':'Register shops and offices in the ward and save their exact location.',
 '/ward-information':'Official ward facts, maps and published information.',
 '/people':'Search every citizen by name, mobile, job or address.',
 '/voters':'See who is marked as a voter in the family register.',
 '/users':'Registered login accounts for this ward system.',
 '/complaints':'Track civic complaints from report to resolution.',
 '/ward-updates':'Publish notices and events for residents.',
 '/ward-updates/new':'Create a ward notice or event.',
 '/schemes':'Publish government and local benefits residents can use.',
 '/birthdays':'Upcoming birthdays in the selected ward.',
 '/follow-up-18':'People turning 18 — useful for voter follow-up.',
 '/deaths':'Record deaths so family registers stay accurate.',
 '/government-voter-lists':'Official voter lists for election work.',
 '/election-data':'Election information from official sources.',
 '/staff':'Master Admin manages Nagarsevaks. Nagarsevak and employee workspaces show employees for the ward.',
 '/ward-activation':'Activate wards and Nagarsevaks. Residents only see Nagarsevaks who are active for their ward.',
 '/nagarsevak-subscriptions':'See when each Nagarsevak was added and when their 1-year subscription ends.',
 '/stakeholders':'Community members and social workers.',
 '/sub-admins':'Additional admin accounts and their permissions.',
 '/groups':'Internal chat groups for ward teams and residents.',
 '/reports':'Export ward data for reviews and reports.',
 '/recycle-bin':'Restore records that were deleted by mistake.'
};
function pageSection(path,language='en'){const hit=navSections.find(s=>s.items.some(([to])=>to===path||(to==='__WARD_UPDATES__'&&String(path).startsWith('/ward-updates'))));if(!hit)return language==='mr'?'वॉर्डडेस्क':'WardDesk';return language==='mr'?hit.mr:hit.en}
const roleName=u=>String(u?.role||u?.roleName||'').toUpperCase();
const NAV_VIEW={
 DASHBOARD:['VIEW_DASHBOARD'],
 WARDS:['VIEW_WARDS'],
 WARD_INFORMATION:['VIEW_WARD_INFORMATION'],
 HOUSES:['VIEW_HOUSES'],
 FAMILIES:['VIEW_FAMILIES'],
 SHOPS:['VIEW_HOUSES'],
 PEOPLE:['VIEW_CITIZENS'],
 VOTERS:['VIEW_VOTERS'],
 USERS:['VIEW_USERS'],
 COMPLAINTS:['VIEW_COMPLAINTS'],
 WARD_UPDATES:['VIEW_WARD_UPDATES'],
 WARD_UPDATES_GROUP:['VIEW_WARD_UPDATES'],
 SCHEMES:['VIEW_SCHEMES'],
 BIRTHDAYS:['VIEW_BIRTHDAYS'],
 FOLLOWUP:['VIEW_18PLUS'],
 DEATH:['VIEW_DEATH_RECORDS'],
 STAFF:['VIEW_STAFF'],
 CHAT:['VIEW_CHAT'],
 REPORTS:['EXPORT_DATA'],
 RECYCLE:['VIEW_RECYCLE_BIN'],
 GOVERNMENT_VOTER_LISTS:['VIEW_GOVERNMENT_VOTER_LISTS'],
 ELECTION_DATA:['VIEW_ELECTION_DATA'],
 NOTIFICATIONS:['VIEW_NOTIFICATIONS'],
 SCHEDULES:['VIEW_SCHEDULES']
};
const allowed=(key,u)=>{
 if(!u) return false;
 if(isMaster(u)) return true;
 if(key==='SUBADMINS') return false;
 if(key==='WARD_ACTIVATION') return false;
 if(key==='NAGARSEVAK_SUBSCRIPTIONS') return isSubMaster(u);
 if(key==='STAKEHOLDERS') return false;
 if(key==='USERS' && isEmployee(u)) return false;
 if(key==='STAFF' && isEmployee(u)) return false;
 if(key==='SCHEDULES') {
  if (isSubMaster(u)) return true;
  if (isNagarsevak(u) || isEmployee(u)) {
    const ps = permissionsOf(u).map((p) => String(p).toUpperCase());
    const hasScheduleKeys = ps.some((p) => p.includes('SCHEDULES'));
    return hasScheduleKeys ? can('VIEW_SCHEDULES', u) : true;
  }
  return false;
 }
 const needed=NAV_VIEW[key];
 if(needed) return needed.some(p=>can(p,u));
 return canModule(key,'VIEW',u);
};
const staffNavLabel=(u)=>(isMaster(u)||isSubMaster(u))?'Nagarsevak & Employees':'Employees';
function AdminNavItem({to,label,icon,itemKey,language,user,updatesOpen,setUpdatesOpen,navRef,sidebarScrollKey,sidebarGo,chatUnread=0}){
 if(itemKey==='WARD_UPDATES_GROUP') return (
  <div className={`nav-group ${updatesOpen?'open':''}`}>
   <button type="button" className="nav-group-toggle" onClick={()=>{const pos=navRef.current?.scrollTop||0;try{sessionStorage.setItem(sidebarScrollKey,String(pos))}catch{};setUpdatesOpen(v=>!v);requestAnimationFrame(()=>{if(navRef.current)navRef.current.scrollTop=pos})}} aria-expanded={updatesOpen}>
    <span className="nav-icon">{icon}</span><span className="nav-group-label">{language==='mr'?'वॉर्ड अपडेट्स व कार्यक्रम':'Ward Updates & Events'}</span><span className={`nav-chevron ${updatesOpen?'expanded':''}`} aria-hidden="true"></span>
   </button>
   {updatesOpen&&<div className="nav-group-menu">
    <NavLink to="/ward-updates" onClick={e=>sidebarGo(e,'/ward-updates')}><span>•</span><span>{language==='mr'?'सर्व अपडेट्स व कार्यक्रम':'All Updates & Events'}</span></NavLink>
    {!String(user?.role||'').toUpperCase().includes('CITIZEN')&&<NavLink to="/ward-updates/new" onClick={e=>sidebarGo(e,'/ward-updates/new')}><span>＋</span><span>{language==='mr'?'नवीन अपडेट / कार्यक्रम':'Create Update / Event'}</span></NavLink>}
   </div>}
  </div>
 );
 return <NavLink to={to} end={to==='/dashboard'} onClick={e=>sidebarGo(e,to)}><span className="nav-icon">{icon}</span><span>{itemKey==='STAFF'?(language==='mr'?((isMaster(user)||isSubMaster(user))?'नगरसेवक व कर्मचारी':'कर्मचारी'):staffNavLabel(user)):(language==='mr'?(mrNav[label]||label):label)}</span>{itemKey==='CHAT'&&chatUnread>0&&<span className="nav-chat-badge notranslate" translate="no">{chatUnread>99?'99+':chatUnread}</span>}</NavLink>;
}
function Protected({children}){return getUser()?children:<Navigate to="/" replace/>}
function HomeEntry(){const u=getUser(); if(!u) return <Login mode="user"/>; if(String(u.role||'').toUpperCase()==='CITIZEN') return <CitizenOnly><UserPanel/></CitizenOnly>; return <Navigate to="/dashboard" replace/>}
function sessionLoginPath(){
 let role='';
 try{role=String(JSON.parse(localStorage.getItem('ward_user')||'{}')?.role||'').toUpperCase()}catch{}
 return role==='CITIZEN'?'/login':'/admin';
}
function expireSessionHard(){
 const path=sessionLoginPath();
 sessionStorage.setItem('ward_session_expired','1');
 clearSession();
 window.location.replace(path);
}
function AdminEntry(){const u=getUser(); if(!u) return <Login mode="admin"/>; if(String(u.role||'').toUpperCase()==='CITIZEN') return <Navigate to="/" replace/>; return <Navigate to="/dashboard" replace/>}
function CitizenShell({children}){
 const navigate=useNavigate(),location=useLocation(),user=getUser();
 const [menu,setMenu]=useState(false),[mobileNav,setMobileNav]=useState(false),[notifications,setNotifications]=useState([]),[language,setLanguage]=useState(()=>localStorage.getItem('ward_language')||'en'),[accountOpen,setAccountOpen]=useState(false),[welcome,setWelcome]=useState(false),[showNotifications,setShowNotifications]=useState(false),[noteToast,setNoteToast]=useState(null);
 const receivedNotifications=useMemo(()=>notifications.filter(n=>n.direction!=='SENT'),[notifications]);
 const unread=useMemo(()=>receivedNotifications.filter(n=>!n.isRead).length,[receivedNotifications]);
 const [chatUnread,setChatUnread]=useState(0);
 const accountRef=React.useRef(null);
 const notificationRef=useRef(null);
 const mobileMenuRef=useRef(null);
 const seenNotes=useRef(new Set());
 const primedNotes=useRef(false);
 useEffect(()=>{const close=e=>{if(accountRef.current&&!accountRef.current.contains(e.target))setMenu(false);if(notificationRef.current&&!notificationRef.current.contains(e.target))setShowNotifications(false);if(mobileMenuRef.current&&!mobileMenuRef.current.contains(e.target))setMobileNav(false)};document.addEventListener('pointerdown',close,true);return()=>document.removeEventListener('pointerdown',close,true)},[]);
 useEffect(()=>{
  let live=true;
  const load=()=>api.notifications().then(r=>{
   if(!live)return;
   const rows=(r.data||[]).filter(n=>n.direction!=='SENT');
   if(primedNotes.current){
    const fresh=rows.find(n=>!n.isRead && !seenNotes.current.has(n.id) && /NAGARSEVAK_ACTIVATED|WARD_ACTIVATED|WARD_|CHAT|MESSAGE/.test(String(n.type||'').toUpperCase()));
    if(fresh) setNoteToast({title:fresh.title||'Update',message:fresh.message||''});
   }
   primedNotes.current=true;
   seenNotes.current=new Set(rows.map(n=>n.id));
   setNotifications(rows);
  }).catch(()=>{});
  load();
  const t=setInterval(load,12000);
  const onFocus=()=>load();
  const onVis=()=>{if(document.visibilityState==='visible')load();};
  window.addEventListener('focus',onFocus);
  document.addEventListener('visibilitychange',onVis);
  return()=>{live=false;clearInterval(t);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVis)};
 },[]);
 useEffect(()=>{initLanguage();applyLanguage(language)},[language]);
 useEffect(()=>{document.title=`${pageTitle(location.pathname,user)} · WardDesk`;const token=localStorage.getItem('ward_token');if(!token)return;let timer;try{const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));const ms=Number(payload.exp)*1000-Date.now();if(ms<=0){sessionStorage.setItem('ward_session_expired','1');clearSession();window.location.replace('/login');return}timer=setTimeout(()=>{sessionStorage.setItem('ward_session_expired','1');clearSession();window.location.replace('/login')},ms+250)}catch{sessionStorage.setItem('ward_session_expired','1');clearSession();window.location.replace('/login')}return()=>clearTimeout(timer) },[location.pathname]);
 useEffect(()=>{
  let live=true;
  const loadChat=()=>api.chatGroups().then(r=>{
   if(!live)return;
   setChatUnread((r.data||[]).reduce((n,g)=>n+Number(g.unreadCount||0),0));
  }).catch(()=>{});
  loadChat();
  const t=setInterval(loadChat,8000);
  const onFocus=()=>loadChat();
  const onVis=()=>{if(document.visibilityState==='visible')loadChat();};
  window.addEventListener('focus',onFocus);
  window.addEventListener('ward:chat-refresh',onFocus);
  document.addEventListener('visibilitychange',onVis);
  return()=>{live=false;clearInterval(t);window.removeEventListener('focus',onFocus);window.removeEventListener('ward:chat-refresh',onFocus);document.removeEventListener('visibilitychange',onVis)};
 },[location.pathname]);
 useEffect(()=>{if(!noteToast)return;const t=setTimeout(()=>setNoteToast(null),5000);return()=>clearTimeout(t)},[noteToast]);
 useEffect(()=>{
  const handler=e=>{
   const d=e.detail||{};
   setNoteToast({title:d.type==='error'?'Action failed':(d.title||'Update'),message:d.message||'',type:d.type||'success'});
  };
  window.addEventListener('ward:toast',handler);
  return()=>window.removeEventListener('ward:toast',handler);
 },[]);
 useEffect(()=>{if(location.state?.welcome){setWelcome(true);navigate(location.pathname,{replace:true,state:null});setTimeout(()=>setWelcome(false),4500);}},[location.pathname,location.state,navigate]);
 useEffect(()=>{
  setMobileNav(false);setMenu(false);setShowNotifications(false);
  scrollMainToTop();
  const t=setTimeout(scrollMainToTop,80);
  return()=>clearTimeout(t);
 },[location.pathname]);
 const logout=()=>{clearSession();window.location.replace('/login')}; const toggleLanguage=()=>switchLanguage(language==='en'?'mr':'en');
 const go=p=>{setMenu(false);setMobileNav(false);setShowNotifications(false);navigate(p)};
 const markNotification=async(id)=>{try{await api.markNotificationRead(id);setNotifications(xs=>xs.map(n=>n.id===id?{...n,isRead:true}:n));}catch(e){window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:e.message}}))}};
 const openNotification=async(n)=>{try{if(n?.direction!=='SENT'&&!n?.isRead)await api.markNotificationRead(n.id);setNotifications(xs=>xs.map(x=>x.id===n.id?{...x,isRead:true}:x));setShowNotifications(false);navigate(notificationTarget(n,'citizen'));}catch(e){window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:e.message}}))}};
 useEffect(()=>{
  const openNotes=()=>setShowNotifications(true);
  const openProfile=()=>setAccountOpen(true);
  window.addEventListener('ward:open-notifications',openNotes);
  window.addEventListener('ward:open-profile',openProfile);
  return()=>{window.removeEventListener('ward:open-notifications',openNotes);window.removeEventListener('ward:open-profile',openProfile)};
 },[]);
 const markAllNotifications=async()=>{try{await api.markAllNotificationsRead();setNotifications(xs=>xs.map(n=>n.direction==='SENT'?n:{...n,isRead:true}));}catch(e){window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:e.message}}))}};
 const clearAllNotifications=async()=>{try{await api.clearNotifications();setNotifications([])}catch(e){window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:e.message}}))}};
 return <div className="user-portal">
  <header className="user-topbar">
   <div className="user-brand" onClick={()=>go('/')} role="button" tabIndex={0}><div className="user-brand-mark notranslate" translate="no">W</div><div><strong className="notranslate" translate="no">WardDesk</strong><span>Your Ward · Digital Services</span></div></div>
   <nav className={`user-nav user-nav-static ${mobileNav?'is-open':''}`}>
    <button className={`user-nav-link ${location.pathname==='/'?'active':''}`} onClick={()=>go('/')}>{language==='mr'?'मुख्यपृष्ठ':'Home'}</button>
    <button className={`user-nav-link ${location.pathname.startsWith('/ward-updates')?'active':''}`} onClick={()=>go('/ward-updates')}>{language==='mr'?'वॉर्ड अपडेट्स':'Updates & Events'}</button>
    <button className={`user-nav-link ${location.pathname.startsWith('/schemes')?'active':''}`} onClick={()=>go('/schemes')}>{language==='mr'?'योजना':'Schemes'}</button>
    <button className={`user-nav-link ${location.pathname.startsWith('/my-complaints')?'active':''}`} onClick={()=>go('/my-complaints')}>{language==='mr'?'माझ्या तक्रारी':'My Complaints'}</button>
    <button className={`user-nav-link ${location.pathname.startsWith('/groups')?'active':''}`} onClick={()=>go('/groups')}><span className="user-nav-link-text">{language==='mr'?'गट व चॅट':'Groups & Chat'}</span>{chatUnread>0&&<span className="user-nav-badge chat-unread notranslate" translate="no">{chatUnread>99?'99+':chatUnread}</span>}</button>
   </nav>
    <div className="user-actions"><button type="button" className="user-language-btn notranslate" translate="no" onClick={toggleLanguage}>{language==='en'?'मराठी':'English'}</button><div className="user-notification-wrap" ref={notificationRef}><button type="button" className="user-icon-btn" onClick={()=>{setMenu(false);setMobileNav(false);setShowNotifications(v=>!v)}} aria-label="Notifications" title="Notifications"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{display:'inline-block',verticalAlign:'middle'}}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>{unread>0&&<span className="user-notification-dot">{unread>9?'9+':unread}</span>}</button>{showNotifications&&<div className="user-notification-popover"><div className="user-notification-head"><strong>{language==='mr'?'सूचना':'Notifications'}</strong><div>{unread>0&&<button type="button" onClick={markAllNotifications}>{language==='mr'?'सर्व वाचले':'Mark all read'}</button>}<button type="button" onClick={clearAllNotifications}>{language==='mr'?'साफ करा':'Clear'}</button></div></div>{!notifications.length?<div className="user-notification-empty">{language==='mr'?'कोणत्याही सूचना नाहीत':'No notifications'}</div>:notifications.map(n=><button type="button" key={n.id} className={`user-notification-item ${n.isRead?'read':''}`} onClick={()=>openNotification(n)}><strong>{n.title||'Notification'}</strong><span>{n.message||''}</span><small>{n.sender?.name?`From: ${n.sender.name} · `:''}{n.createdAt?new Date(n.createdAt).toLocaleString('en-IN'):''}</small></button>)}</div>}</div><div className="user-account-wrap" ref={accountRef}><button className="user-account" onClick={()=>{setMobileNav(false);setMenu(v=>!v)}}><ProfileAvatar name={user?.name} size="sm"/><span className="user-account-text"><b>{user?.name}</b><small>{user?.ward?.wardNumber||'My Ward'}</small></span></button>{menu&&<div className="user-account-menu"><div className="user-menu-summary"><strong>{user?.name}</strong><span>{user?.email}</span><small>{user?.ward?.wardNumber}{user?.ward?.name?` · ${user.ward.name}`:''}</small></div><button onClick={()=>{setMenu(false);setAccountOpen(true)}}>My profile</button><button onClick={logout} className="danger-link">Sign out</button></div>}</div><div className="user-mobile-menu-wrap" ref={mobileMenuRef}><button type="button" className={`user-mobile-menu ${mobileNav?'is-active':''}`} onClick={()=>{setMenu(false);setShowNotifications(false);setMobileNav(v=>!v)}} aria-label="Open navigation menu" aria-expanded={mobileNav}>{mobileNav?'✕':'☰'}</button>{mobileNav&&<div className="user-quick-menu-popover" role="menu"><div className="user-quick-menu-header"><ProfileAvatar name={user?.name} size="sm"/><div className="user-quick-menu-user"><strong>{user?.name||'Citizen'}</strong><span>{user?.email||user?.mobile||'Registered resident'}</span><small>{user?.ward?.wardNumber?`${user.ward.wardNumber}${user.ward.name?` · ${user.ward.name}`:''}`:'Ward Citizen'}</small></div></div><div className="user-quick-menu-links"><button type="button" className={`user-quick-menu-item ${location.pathname==='/'?'active':''}`} onClick={()=>go('/')}><span className="quick-text">{language==='mr'?'मुख्यपृष्ठ':'Home'}</span></button><button type="button" className={`user-quick-menu-item ${location.pathname.startsWith('/ward-updates')?'active':''}`} onClick={()=>go('/ward-updates')}><span className="quick-text">{language==='mr'?'वॉर्ड अपडेट्स':'Updates & Events'}</span></button><button type="button" className={`user-quick-menu-item ${location.pathname.startsWith('/schemes')?'active':''}`} onClick={()=>go('/schemes')}><span className="quick-text">{language==='mr'?'शासकीय योजना':'Government Schemes'}</span></button><button type="button" className={`user-quick-menu-item ${location.pathname.startsWith('/my-complaints')?'active':''}`} onClick={()=>go('/my-complaints')}><span className="quick-text">{language==='mr'?'माझ्या तक्रारी':'My Complaints'}</span></button><button type="button" className={`user-quick-menu-item ${location.pathname.startsWith('/groups')?'active':''}`} onClick={()=>go('/groups')}><span className="quick-text">{language==='mr'?'गट व चॅट':'Groups & Chat'}</span>{chatUnread>0&&<span className="user-nav-badge chat-unread notranslate" translate="no">{chatUnread>99?'99+':chatUnread}</span>}</button></div><div className="user-quick-menu-divider"/><div className="user-quick-menu-actions"><button type="button" className="user-quick-menu-item" onClick={()=>{setMobileNav(false);setAccountOpen(true);}}><span className="quick-text">{language==='mr'?'माझे प्रोफाइल':'My Profile'}</span></button><button type="button" className="user-quick-menu-item" onClick={()=>{setMobileNav(false);setShowNotifications(true);}}><span className="quick-text">{language==='mr'?'सूचना':'Notifications'}</span>{unread>0&&<span className="user-nav-badge notranslate" translate="no">{unread>9?'9+':unread}</span>}</button><button type="button" className="user-quick-menu-item notranslate" translate="no" onClick={()=>{toggleLanguage();setMobileNav(false);}}><span className="quick-text">{language==='en'?'मराठी मध्ये बदला':'Switch to English'}</span></button><button type="button" className="user-quick-menu-item danger-link" onClick={()=>{setMobileNav(false);logout();}}><span className="quick-text">{language==='mr'?'लॉग आउट':'Sign Out'}</span></button></div></div>}</div></div>
  </header>
  <main className="user-main user-page-main">{children}</main>
  {noteToast&&<div className={`global-toast ${noteToast.type==='error'?'global-toast-error':'global-toast-success'}`} role={noteToast.type==='error'?'alert':'status'}><div><strong>{noteToast.title}</strong><div>{noteToast.message}</div></div><button type="button" onClick={()=>setNoteToast(null)} aria-label="Close">×</button></div>}
  {welcome&&<div className="global-toast global-toast-success user-welcome-toast" role="status"><div><strong>{language==='mr'?'यशस्वी':'Success'}</strong><div>{language==='mr'?`पुन्हा स्वागत आहे, ${user?.name||'वापरकर्ता'}`:`Welcome back, ${user?.name||'User'}`}</div></div><button type="button" onClick={()=>setWelcome(false)} aria-label="Close">×</button></div>}<footer className="user-footer"><span>© {new Date().getFullYear()} Kairo IT Solutions PVT LTD</span><span>Secure registered ward account</span></footer>{accountOpen&&<Modal wide title="My profile" onClose={()=>setAccountOpen(false)}><ProfileEditor user={user} role="CITIZEN" onClose={()=>setAccountOpen(false)} onSaved={()=>window.location.reload()}/></Modal>}
 </div>;
}

function ProfileEditor({user,role,onClose,onSaved}){
 const isNagar=String(role||user?.role||'').toUpperCase()==='NAGARSEVAK';
 const [form,setForm]=useState({name:String(user?.name||'').trim(),email:String(user?.email||'').trim(),mobile:String(user?.mobile||'').replace(/\D/g,'').slice(0,10),password:'',confirmPassword:'',photo:user?.photo||''});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  api.me().then(r=>{
   const next=r?.data?.user||{};
   setForm(f=>({...f,photo:f.photo||next.photo||'',name:f.name||next.name||'',email:f.email||next.email||'',mobile:f.mobile||String(next.mobile||'').replace(/\D/g,'').slice(0,10)}));
  }).catch(()=>{});
 },[isNagar]);
 async function save(e){
  e.preventDefault();setBusy(true);setError('');
  try{
   const payload={name:form.name.trim(),email:form.email.trim(),mobile:form.mobile.trim()};
   if(isNagar) payload.photo=form.photo||null;
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) throw new Error('Please enter a valid email address.');
   if(form.password&&form.password!==form.confirmPassword) throw new Error('New password and confirm password do not match.');
   const r=await api.updateProfile(payload);
   if(form.password) await api.changePassword({password:form.password,confirmPassword:form.confirmPassword});
   onSaved(r.data);
  }catch(e){
   setError(e.message);
   window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:e.message}}));
  }finally{setBusy(false)}
 }
 const wardText=user?.ward?.wardNumber||((user?.wardIds||[]).length?`${user.wardIds.length} assigned wards`:'All wards');
 return (
  <div className="profile-editor">
   {error&&<div className="error-inline">{error}</div>}
   <form className="form-grid profile-edit-grid" onSubmit={save}>
    <div className="profile-hero span-2">
     <FaceAvatar name={form.name||user?.name} photo={form.photo||user?.photo} className="profile-hero-face"/>
     <div className="profile-hero-copy">
      <strong>{form.name||user?.name||'Your profile'}</strong>
      <span>{prettyRole(role||user?.role)}</span>
      <small>{form.email||user?.email||'—'}</small>
     </div>
    </div>
    {isNagar&&<div className="span-2"><CirclePhotoField label="Profile photo" name={form.name||user?.name} value={form.photo} onChange={v=>setForm({...form,photo:v})}/></div>}
    <div className="profile-section span-2">
     <span className="profile-section-label">Personal details</span>
     <div className="form-grid profile-fields">
      <label>Full name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
      <label>Email<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
      <label>Mobile<input required maxLength="10" inputMode="numeric" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value.replace(/\D/g,'').slice(0,10)})}/></label>
     </div>
    </div>
    <div className="span-2 password-change-box">
     <div><strong>Security</strong><span>Leave blank to keep your current password. New password must be at least 8 characters.</span></div>
     <div className="form-grid password-change-grid">
      <label>New password<input type="password" minLength="8" autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
      <label>Confirm password<input type="password" minLength="8" autoComplete="new-password" value={form.confirmPassword} onChange={e=>setForm({...form,confirmPassword:e.target.value})}/></label>
     </div>
    </div>
    <div className="detail-card span-2 profile-access-card">
     <h3>Access</h3>
     <p><b>Role</b> {prettyRole(role)}</p>
     <p><b>Ward</b> {wardText}{user?.ward?.name?` · ${user.ward.name}`:''}</p>
     {user?.employeeProfile?.designation&&<p><b>Designation</b> {user.employeeProfile.designation}</p>}
     <p><b>Login</b> {user?.email||'—'}</p>
    </div>
    <div className="modal-actions span-2">
     <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
     <button className="primary-btn" disabled={busy}>{busy?'Saving…':'Save profile'}</button>
    </div>
   </form>
  </div>
 );
}

function GlobalPagination(){
 const location=useLocation();
 const [state,setState]=useState({root:null,count:0});
 const [page,setPage]=useState(1);
 const [pageSize,setPageSize]=useState(10);

 useEffect(()=>{
  setPage(1);
  scrollMainToTop();
  let active=true;
  const scan=()=>{
   if(!active)return;
   const selectors=['.table-wrap tbody','.ward-grid','.family-grid','.scheme-grid','.birthday-grid'];
   let root=null;
   for(const sel of selectors){
    const candidates=[...document.querySelectorAll(sel)].filter(el=>!el.closest('.modal') && el.offsetParent!==null);
    const found=candidates.find(el=>el.children.length>0);
    if(found){root=found;break;}
   }
   const count=root?[...root.children].filter(el=>!(el.matches?.('tr') && el.querySelector('td[colspan], th[colspan]'))).length:0;
   setState(prev=>prev.root===root&&prev.count===count?prev:{root,count});
  };
  scan();
  const observer=new MutationObserver(scan);
  observer.observe(document.querySelector('.content')||document.body,{childList:true,subtree:true});
  window.addEventListener('resize',scan);
  return()=>{active=false;observer.disconnect();window.removeEventListener('resize',scan)};
 },[location.pathname]);

 useEffect(()=>{
  const root=state.root;
  if(!root||!state.count)return;
  const items=[...root.children];
  const totalPages=Math.max(1,Math.ceil(items.length/pageSize));
  const safePage=Math.min(page,totalPages);
  if(safePage!==page){setPage(safePage);return;}
  items.forEach((el,i)=>{el.style.display=(i>=(safePage-1)*pageSize&&i<safePage*pageSize)?'':'none';});
  return()=>items.forEach(el=>{el.style.display='';});
 },[state.root,state.count,page,pageSize]);

 if(['/deaths','/people','/voters','/complaints','/government-voter-lists','/staff','/users','/houses','/nagarsevak-subscriptions'].includes(location.pathname)||!state.count)return null;
 const totalPages=Math.max(1,Math.ceil(state.count/pageSize));
 const current=Math.min(page,totalPages);
 const go=p=>setPage(Math.max(1,Math.min(totalPages,p)));
 return <PaginationBar page={current} pages={totalPages} total={state.count} limit={pageSize} onPage={go} onLimit={n=>{setPageSize(n);setPage(1)}}/>;
}
function Shell({children}){
 const navigate=useNavigate(),location=useLocation(),navRef=useRef(null),[open,setOpen]=useState(false),[language,setLanguage]=useState(()=>localStorage.getItem('ward_language')||'en'),[notifications,setNotifications]=useState([]),[showNotifications,setShowNotifications]=useState(false),[showProfile,setShowProfile]=useState(false),[toast,setToast]=useState(null),[updatesOpen,setUpdatesOpen]=useState(()=>location.pathname.startsWith('/ward-updates')),[chatUnread,setChatUnread]=useState(0),[userVersion,setUserVersion]=useState(0);
 const user=getUser();
 void userVersion;
 const receivedNotifications=useMemo(()=>notifications.filter(n=>n.direction!=='SENT'),[notifications]);
 const sidebarScrollKey='ward_sidebar_scroll_top';
 const rememberSidebar=()=>{ window.dispatchEvent(new CustomEvent('ward:close-overlays')); setOpen(false); if(navRef.current){ const value=navRef.current.scrollTop; try{sessionStorage.setItem(sidebarScrollKey,String(value))}catch{} } };
 const sidebarGo=(e,to)=>{
  e.preventDefault();
  rememberSidebar();
  e.currentTarget.blur();
  navigate(to,{replace:true});
 };
 useEffect(()=>{
  setUpdatesOpen(location.pathname.startsWith('/ward-updates'));
  setOpen(false);setShowNotifications(false);setShowProfile(false);
  scrollMainToTop();
  const restore=()=>{
   if(!navRef.current)return;
   let value=0; try{value=Number(sessionStorage.getItem(sidebarScrollKey)||0)}catch{}
   if(Number.isFinite(value)) navRef.current.scrollTop=Math.max(0,value);
  };
  requestAnimationFrame(()=>{scrollMainToTop();restore();});
  const t=setTimeout(()=>{scrollMainToTop();restore();},80);
  return()=>clearTimeout(t);
 },[location.pathname]);
 useEffect(()=>{
  const nav=navRef.current;if(!nav)return;
  const save=()=>{try{sessionStorage.setItem(sidebarScrollKey,String(nav.scrollTop))}catch{}};
  nav.addEventListener('scroll',save,{passive:true});
  return()=>nav.removeEventListener('scroll',save);
 },[]);
 useEffect(()=>{const onKey=e=>{if(e.key==='Escape'){setOpen(false);setShowNotifications(false);setShowProfile(false)}};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[]);
 useEffect(()=>{document.title=`${pageTitle(location.pathname,user)} · WardDesk`},[location.pathname,user]);
 useEffect(()=>{
  let live=true;
  const syncUser=()=>{
   api.me().then(r=>{
    if(!live) return;
    const next=r?.data?.user;
    const cur=getUser();
    if(!next||!cur) return;
    const prevPerms=JSON.stringify(cur.permissions||[]);
    const nextPerms=JSON.stringify(next.permissions||[]);
    const updated={
     ...cur,
     ...next,
     permissions:next.permissions??cur.permissions,
     role:next.roleName||next.role||cur.role,
     roleName:next.roleName||next.roleName||cur.role
    };
    localStorage.setItem('ward_user',JSON.stringify(updated));
    if(prevPerms!==nextPerms||cur.name!==next.name||cur.role!==(next.roleName||next.role)){
     setUserVersion(v=>v+1);
    }
   }).catch(()=>{});
  };
  syncUser();
  const t=setInterval(syncUser,10000);
  const onFocus=()=>syncUser();
  const onPermChange=()=>syncUser();
  const onVis=()=>{if(document.visibilityState==='visible')syncUser();};
  window.addEventListener('focus',onFocus);
  window.addEventListener('ward:permissions-updated',onPermChange);
  document.addEventListener('visibilitychange',onVis);
  return()=>{
   live=false;
   clearInterval(t);
   window.removeEventListener('focus',onFocus);
   window.removeEventListener('ward:permissions-updated',onPermChange);
   document.removeEventListener('visibilitychange',onVis);
  };
 },[]);
 useEffect(()=>{
  let live=true;
  let primed=false;
  let seen=new Set();
  const load=()=>api.notifications().then(r=>{
   if(!live)return;
   const rows=(r.data||[]).filter(n=>n.direction!=='SENT');
   if(primed){
    const fresh=rows.find(n=>!n.isRead && !seen.has(n.id) && /COMPLAINT|SCHEME|NAGARSEVAK_ACTIVATED|WARD_|DEATH_|BIRTHDAY_|SCHEDULE/.test(String(n.type||'').toUpperCase()));
    if(fresh) window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'success',message:`${fresh.title}: ${fresh.message}`}}));
   }
   primed=true;
   seen=new Set(rows.map(n=>n.id));
   setNotifications(rows);
  }).catch(()=>{});
  load();
  const t=setInterval(load,12000);
  const onFocus=()=>load();
  const onVis=()=>{if(document.visibilityState==='visible')load();};
  window.addEventListener('focus',onFocus);
  document.addEventListener('visibilitychange',onVis);
  return()=>{live=false;clearInterval(t);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVis)};
 },[]);
 useEffect(()=>{
  let live=true;
  const loadChat=()=>api.chatGroups().then(r=>{
   if(!live)return;
   setChatUnread((r.data||[]).reduce((n,g)=>n+Number(g.unreadCount||0),0));
  }).catch(()=>{});
  loadChat();
  const t=setInterval(loadChat,8000);
  const onFocus=()=>loadChat();
  const onVis=()=>{if(document.visibilityState==='visible')loadChat();};
  window.addEventListener('focus',onFocus);
  window.addEventListener('ward:chat-refresh',onFocus);
  document.addEventListener('visibilitychange',onVis);
  return()=>{live=false;clearInterval(t);window.removeEventListener('focus',onFocus);window.removeEventListener('ward:chat-refresh',onFocus);document.removeEventListener('visibilitychange',onVis)};
 },[location.pathname]);
 useEffect(()=>{
  const handler=e=>setToast(e.detail||null);
  window.addEventListener('ward:toast',handler);
  return()=>window.removeEventListener('ward:toast',handler);
 },[]);
 useEffect(()=>{
  if(location.state?.signedOut){setToast({type:'success',message:'You have been signed out successfully.'});navigate('/admin',{replace:true,state:null});return;}
  if(location.state?.sessionExpired){setToast({type:'error',message:'Your 30-minute inactive session has expired. Please sign in again.'});navigate('/admin',{replace:true,state:null});return;}
  if(location.state?.welcome){
   setToast({type:'success',message:`Welcome back, ${user?.name||'User'}`});
   navigate(location.pathname,{replace:true,state:null});
  }
 },[location.pathname,location.state,user?.name,navigate]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),4500);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{
  const expire=()=>{sessionStorage.setItem('ward_session_expired','1');clearSession();setShowNotifications(false);setShowProfile(false);navigate('/admin',{replace:true})};
  window.addEventListener('ward:session-expired',expire);
  const token=localStorage.getItem('ward_token'); if(!token)return()=>window.removeEventListener('ward:session-expired',expire);
  let timer;
  try{const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));const ms=(Number(payload.exp)*1000)-Date.now();if(ms<=0)expire();else timer=setTimeout(expire,ms+250);}catch{}
  return()=>{clearTimeout(timer);window.removeEventListener('ward:session-expired',expire)};
 },[navigate]);
 useEffect(()=>{initLanguage();},[]);
 useEffect(()=>{applyLanguage(language)},[language]);
 useEffect(()=>{
  const labelTables=()=>{
   document.querySelectorAll('table').forEach(table=>{
    table.classList.add('responsive-table');
    const heads=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(tr=>{
     [...tr.children].forEach((td,i)=>{
      if(td.tagName!=='TD')return;
      const existing=String(td.getAttribute('data-label')||'').trim();
      const fromHead=heads[i]||'';
      const hasAction=!!td.querySelector('button,a,.card-actions,.staff-action-grid,.staff-actions');
      const label=fromHead||existing||(hasAction?'Actions':'');
      if(label) td.setAttribute('data-label',label);
      else td.removeAttribute('data-label');
     });
    });
   });
  };
  labelTables();
  const observer=new MutationObserver(labelTables);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[]);
 useEffect(()=>{document.body.classList.toggle('nav-open',open);return()=>document.body.classList.remove('nav-open')},[open]);
 useEffect(()=>{if(showProfile)document.body.classList.add('modal-open');else document.body.classList.remove('modal-open');return()=>document.body.classList.remove('modal-open')},[showProfile]);
 useEffect(()=>{
  if(!showNotifications)return;
  const close=e=>{if(!e.target.closest('.notification-wrap'))setShowNotifications(false)};
  document.addEventListener('pointerdown',close);
  return()=>document.removeEventListener('pointerdown',close);
 },[showNotifications]);
 const openNotification=async(n)=>{try{if(!n.isRead){await api.markNotificationRead(n.id);setNotifications(x=>x.map(a=>a.id===n.id?{...a,isRead:true}:a))}setShowNotifications(false);navigate(notificationTarget(n,'staff'));}catch(e){window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:e.message}}))}};
 const logout=()=>{if(!window.confirm('Are you sure you want to sign out?'))return;clearSession();setOpen(false);setShowNotifications(false);setShowProfile(false);window.location.replace('/admin')}; const role=roleOf(user);
 const visibleSections=navSections.map(s=>({...s,items:s.items.filter(([, , ,key])=>allowed(key,user))})).filter(s=>s.items.length);
 const pretty=prettyRole(user);
 const help=pageHelp[location.pathname]||workspaceLabel(user);
 const sectionName=pageSection(location.pathname,language);
 const chipName=String(user?.name||'').trim()||pretty;
 const chipRole=chipName.toLowerCase()===String(pretty||'').trim().toLowerCase()?'':pretty;
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a><aside className={`sidebar ${open?'open':''}`}><div className="brand"><div className="brand-mark notranslate" translate="no">W</div><div><strong className="notranslate" translate="no">WardDesk</strong><span>Municipal workspace</span></div></div><nav ref={navRef} aria-label="Main">{visibleSections.map(section=><div className="nav-section" key={section.id}><div className="nav-section-label">{language==='mr'?section.mr:section.en}</div>{section.items.map(([to,label,icon,key])=><AdminNavItem key={key} to={to} label={label} icon={icon} itemKey={key} language={language} user={user} updatesOpen={updatesOpen} setUpdatesOpen={setUpdatesOpen} navRef={navRef} sidebarScrollKey={sidebarScrollKey} sidebarGo={sidebarGo} chatUnread={chatUnread}/>)}</div>)}</nav><div className="sidebar-footer"><button className="logout-btn" onClick={logout}>Sign out</button></div></aside>{open&&<button className="scrim" onClick={()=>setOpen(false)}/>}<main className="main"><header className="topbar"><div className="admin-mobile-brand notranslate" translate="no" aria-hidden="true">W</div><button className="menu-btn" onClick={()=>setOpen(v=>!v)}>☰</button><div className="topbar-context"><div className="eyebrow">{sectionName}</div><div className="topbar-title">{pageTitle(location.pathname)}</div></div><div className="topbar-actions"><button type="button" className="language-btn notranslate" translate="no" onClick={()=>switchLanguage(language==='en'?'mr':'en')} title="Change language">{language==='en'?'मराठी':'English'}</button><div className="notification-wrap"><button className="notification-btn" onClick={()=>setShowNotifications(v=>!v)} aria-label="Notifications" title="Notifications"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{display:'inline-block',verticalAlign:'middle'}}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>{receivedNotifications.filter(n=>!n.isRead).length>0&&<span className="notification-count">{receivedNotifications.filter(n=>!n.isRead).length}</span>}</button>{showNotifications&&<div className="notification-popover"><div className="notification-popover-head"><strong>Notifications</strong>{notifications.length>0&&<div className="card-actions">{notifications.some(n=>!n.isRead)&&<button type="button" className="small-btn" onClick={async()=>{await api.markAllNotificationsRead();setNotifications(x=>x.map(a=>a.direction==='SENT'?a:{...a,isRead:true}))}}>Mark all read</button>}<button type="button" className="small-btn danger" onClick={async()=>{if(!window.confirm('Clear all notifications?'))return;await api.clearNotifications();setNotifications([])}}>Clear</button></div>}</div>{!notifications.length?<div className="muted notification-empty">No notifications</div>:notifications.map(n=><button key={n.id} className={`notification-item ${n.isRead?'read':''} ${/SCHEDULE/.test(n.type)?'notification-item-schedule':''}`} onClick={()=>openNotification(n)}><div className="notification-item-title-row"><strong>{n.title}</strong>{/SCHEDULE/.test(n.type)&&<span className="notification-schedule-tag">Schedule</span>}</div><span>{n.message}</span><small>From: {n.sender?.name||'System'} · {n.type?.replaceAll('_',' ')||'Notification'} · {n.createdAt?new Date(n.createdAt).toLocaleString('en-IN'):''}</small></button>)}</div>}</div><button className="user-chip user-chip-button" onClick={()=>setShowProfile(true)} aria-label="Open profile"><FaceAvatar name={chipName} photo={user?.photo} className="user-chip-face"/><div className="user-text notranslate" translate="no"><strong>{chipName}</strong>{chipRole?<span>{chipRole}</span>:null}</div></button></div></header><div className="content" id="main-content">{children}<GlobalPagination/></div><footer className="app-footer"><span>© {new Date().getFullYear()} Kairo IT Solutions PVT LTD</span><span>Secure administration workspace · {pretty}</span></footer>{toast&&<div className={`global-toast ${toast.type==='error'?'global-toast-error':'global-toast-success'}`} role={toast.type==='error'?'alert':'status'}><div><strong>{toast.type==='error'?'Action failed':'Success'}</strong><div>{toast.message}</div></div><button type="button" onClick={()=>setToast(null)} aria-label="Close">×</button></div>}{showProfile&&<div className="modal-backdrop" onPointerDown={()=>setShowProfile(false)}><div className="modal profile-modal" onPointerDown={e=>e.stopPropagation()}><div className="modal-header profile-modal-header"><div><h2>My profile</h2><span>Update your photo, contact details and password</span></div><button type="button" className="icon-btn" onClick={()=>setShowProfile(false)}>×</button></div><ProfileEditor user={user} role={role} onClose={()=>setShowProfile(false)} onSaved={(u)=>{localStorage.setItem('ward_user',JSON.stringify({...user,...u}));setShowProfile(false);window.location.reload()}}/></div></div>}</main></div>
}
function CitizenOnly({children}){const u=getUser();if(!u)return <Navigate to="/login" replace/>;if(String(u.role||'').toUpperCase()!=='CITIZEN')return <Navigate to="/dashboard" replace/>;return <CitizenShell>{children}</CitizenShell>}
function Guard({permission,children}){
 const u=getUser();
 if(roleName(u)==='CITIZEN') return <Navigate to="/" replace/>;
 const ok=allowed(permission,u);
 return ok?children:<Navigate to="/dashboard" replace/>;
}
function AdminOnly({children}){
 const u=getUser();
 if(!u)return <Navigate to="/admin" replace/>;
 if(String(u.role||'').toUpperCase()==='CITIZEN')return <Navigate to="/" replace/>;

 return <Shell>{children}</Shell>;
}
function RolePage({citizen,admin}){
 const u=getUser();
 if(!u)return <Navigate to={admin?'/admin':'/login'} replace/>;
 if(String(u.role||'').toUpperCase()==='CITIZEN')return citizen;
 return admin;
}
function Fallback(){
 const u=getUser();
 if(u&&String(u.role||'').toUpperCase()==='CITIZEN')return <Navigate to="/" replace/>; return <Navigate to="/dashboard" replace/>;
}
class AppErrorBoundary extends React.Component {
 constructor(props){ super(props); this.state={error:null}; }
 static getDerivedStateFromError(error){ return {error}; }
 componentDidCatch(error,info){ console.error('WardDesk UI error',error,info); }
 render(){
  if(this.state.error){
   return <div className="app-crash-screen"><div className="app-crash-card"><div className="brand-mark">W</div><span className="eyebrow">WARD DESK</span><h1>Something went wrong</h1><p>The page could not be rendered. Your saved data and session are still protected.</p><pre>{this.state.error?.message||'Unexpected UI error'}</pre><div className="card-actions"><button className="primary-btn" onClick={()=>window.location.reload()}>Reload page</button><button className="ghost-btn" onClick={()=>{this.setState({error:null});window.history.back()}}>Go back</button></div></div></div>;
  }
  return this.props.children;
 }
}

function signedInHome(){
 const u=getUser();
 if(!u) return '';
 return String(u.role||'').toUpperCase()==='CITIZEN'?'/':'/dashboard';
}
function bounceAuthPagesIfSignedIn(){
 const dest=signedInHome();
 if(!dest) return;
 const path=window.location.pathname;
 const loginView=typeof document!=='undefined'&&document.querySelector('.login-page-v2');
 if(path==='/login'||path==='/register'||path==='/admin/login'||(loginView&&(path==='/'||path==='/admin'))){
  if(path===dest&&!loginView) return;
  window.history.replaceState(null,'',dest);
  window.location.replace(dest);
 }
}

export default function App(){
 useEffect(()=>{
  bounceAuthPagesIfSignedIn();
  const onShow=e=>{if(e.persisted) bounceAuthPagesIfSignedIn();};
  window.addEventListener('pageshow',onShow);
  window.addEventListener('popstate',bounceAuthPagesIfSignedIn);
  return()=>{window.removeEventListener('pageshow',onShow);window.removeEventListener('popstate',bounceAuthPagesIfSignedIn);};
 },[]);
 useEffect(()=>{
  const IDLE_MS=30*60*1000, KEY='ward_last_activity';
  const token=localStorage.getItem('ward_token');
  if(!token)return;
  let tokenIssuedAt=0;
  try{const part=token.split('.')[1];const payload=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));tokenIssuedAt=Number(payload.iat)*1000||0;}catch{}
  let last=Number(localStorage.getItem(KEY)||0);
  if(!Number.isFinite(last)||last<=0) last=tokenIssuedAt||Date.now();
  if(!localStorage.getItem(KEY)) localStorage.setItem(KEY,String(last));
  const expire=()=>expireSessionHard();
  const activity=()=>{const now=Date.now();if(now-last>1000){last=now;localStorage.setItem(KEY,String(now));}};
  const events=['pointerdown','pointermove','mousemove','keydown','touchstart','scroll','click'];
  events.forEach(e=>window.addEventListener(e,activity,{passive:true}));
  const check=()=>{if(Date.now()-last>=IDLE_MS)expire();};
  check(); const timer=setInterval(check,15000);
  return()=>{clearInterval(timer);events.forEach(e=>window.removeEventListener(e,activity));};
 },[]);
 return <AppErrorBoundary><Routes>
  <Route path="/" element={<HomeEntry/>}/>
  <Route path="/admin" element={<AdminEntry/>}/>
  <Route path="/login" element={getUser()?(String(getUser()?.role||'').toUpperCase()==='CITIZEN'?<Navigate to="/" replace/>:<Navigate to="/dashboard" replace/>):<Login mode="user"/>}/>
  <Route path="/admin/login" element={<Navigate to="/admin" replace/>}/>
  <Route path="/register" element={getUser()?<Navigate to="/" replace/>:<Register/>}/>

  {/* Shared URLs: the same path serves the citizen portal for citizens and the administration page for staff. */}
  <Route path="/ward-updates" element={<RolePage citizen={<CitizenShell><WardUpdates/></CitizenShell>} admin={<AdminOnly><Guard permission="WARD_UPDATES"><WardUpdates/></Guard></AdminOnly>}/>} />
  <Route path="/ward-updates/new" element={<AdminOnly><Guard permission="WARD_UPDATES"><WardUpdates autoOpen/></Guard></AdminOnly>}/>
  <Route path="/schemes" element={<RolePage citizen={<CitizenShell><Schemes/></CitizenShell>} admin={<AdminOnly><Guard permission="SCHEMES"><Schemes/></Guard></AdminOnly>}/>} />
  <Route path="/messages" element={<Navigate to="/groups" replace/>}/>
  <Route path="/groups" element={<RolePage citizen={<CitizenShell><Groups/></CitizenShell>} admin={<AdminOnly><Guard permission="CHAT"><Groups/></Guard></AdminOnly>}/>} />
  <Route path="/my-complaints" element={<CitizenOnly><UserComplaints language={(localStorage.getItem('ward_language')||'en')}/></CitizenOnly>}/>


  {/* Administration */}
  <Route path="/dashboard" element={<AdminOnly><Dashboard/></AdminOnly>}/>
  <Route path="/schedules" element={<AdminOnly><Guard permission="SCHEDULES"><Schedules/></Guard></AdminOnly>}/>
  <Route path="/wards" element={<AdminOnly><Guard permission="WARDS"><Wards/></Guard></AdminOnly>}/>
  <Route path="/ward-information" element={<AdminOnly><Guard permission="WARD_INFORMATION"><WardInformation/></Guard></AdminOnly>}/>
  <Route path="/election-data" element={<AdminOnly><Guard permission="ELECTION_DATA"><ElectionData/></Guard></AdminOnly>}/>
  <Route path="/stakeholders" element={<AdminOnly>{isMaster(getUser()) ? <Stakeholders/> : <Navigate to="/dashboard" replace/>}</AdminOnly>}/>
  <Route path="/staff" element={<AdminOnly><Guard permission="STAFF"><Staff/></Guard></AdminOnly>}/>
  <Route path="/ward-activation" element={<AdminOnly>{isMaster(getUser()) ? <WardActivation/> : <Navigate to="/dashboard" replace/>}</AdminOnly>}/>
  <Route path="/nagarsevak-subscriptions" element={<AdminOnly><Guard permission="NAGARSEVAK_SUBSCRIPTIONS"><NagarsevakSubscriptions/></Guard></AdminOnly>}/>
  <Route path="/users" element={<AdminOnly><Guard permission="USERS"><Users/></Guard></AdminOnly>}/>
  <Route path="/sub-admins" element={<AdminOnly>{isMaster(getUser()) ? <SubAdmins/> : <Navigate to="/dashboard" replace/>}</AdminOnly>}/>
  <Route path="/houses" element={<AdminOnly><Guard permission="HOUSES"><Houses/></Guard></AdminOnly>}/>
  <Route path="/families" element={<AdminOnly><Guard permission="FAMILIES"><Families/></Guard></AdminOnly>}/>
  <Route path="/shops" element={<AdminOnly><Guard permission="SHOPS"><Shops/></Guard></AdminOnly>}/>
  <Route path="/people" element={<AdminOnly><Guard permission="PEOPLE"><People/></Guard></AdminOnly>}/>
  <Route path="/voters" element={<AdminOnly><Guard permission="VOTERS"><Voters/></Guard></AdminOnly>}/>
  <Route path="/government-voter-lists" element={<AdminOnly><Guard permission="GOVERNMENT_VOTER_LISTS"><GovernmentVoterLists/></Guard></AdminOnly>}/>
  <Route path="/birthdays" element={<AdminOnly><Guard permission="BIRTHDAYS"><Birthdays/></Guard></AdminOnly>}/>
  <Route path="/follow-up-18" element={<AdminOnly><Guard permission="FOLLOWUP"><FollowUp18/></Guard></AdminOnly>}/>
  <Route path="/deaths" element={<AdminOnly><Guard permission="DEATH"><Deaths/></Guard></AdminOnly>}/>
  <Route path="/complaints" element={<AdminOnly><Guard permission="COMPLAINTS"><Complaints/></Guard></AdminOnly>}/>
  <Route path="/reports" element={<AdminOnly><Guard permission="REPORTS"><Reports/></Guard></AdminOnly>}/>
  <Route path="/recycle-bin" element={<AdminOnly><Guard permission="RECYCLE"><RecycleBin/></Guard></AdminOnly>}/>
  <Route path="*" element={<Fallback/>}/>
 </Routes></AppErrorBoundary>;
}
