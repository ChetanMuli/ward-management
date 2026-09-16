import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Navigate,NavLink,Route,Routes,useLocation,useNavigate} from 'react-router-dom';
import {api,clearSession,getUser} from './services/api';
import {can,isMaster,isSubMaster,isNagarsevak,isEmployee,roleOf,canModule} from './rbac';
import {initLanguage,setLanguage as applyLanguage} from './language';
import Login from './pages/Login'; import WardInformation from './pages/WardInformation'; import Register from './pages/Register'; import Users from './pages/Users'; import GovernmentVoterLists from './pages/GovernmentVoterLists'; import Dashboard from './pages/Dashboard'; import Houses from './pages/Houses'; import People from './pages/People'; import Families from './pages/Families'; import Voters from './pages/Voters'; import Complaints from './pages/Complaints'; import Birthdays from './pages/Birthdays'; import FollowUp18 from './pages/FollowUp18'; import Wards from './pages/Wards'; import Reports from './pages/Reports'; import RecycleBin from './pages/RecycleBin'; import Schemes from './pages/Schemes'; import Staff from './pages/Staff';
import Stakeholders from './pages/Stakeholders';
import Groups from './pages/Groups'; import Deaths from './pages/Deaths'; import SubAdmins from './pages/SubAdmins'; import WardUpdates from './pages/WardUpdates'; import UserPanel from './pages/UserPanel'; import UserComplaints from './pages/UserComplaints'; import ElectionData from './pages/ElectionData'; import WardActivation from './pages/WardActivation';
import {Modal,PaginationBar,ProfileAvatar,FaceAvatar,CirclePhotoField,scrollMainToTop} from './components/Ui';

const navSections=[
 {id:'overview',en:'Overview',mr:'आढावा',items:[
  ['/admin','Dashboard','⌂','DASHBOARD']
 ]},
 {id:'setup',en:'Ward setup',mr:'वॉर्ड मांडणी',items:[
  ['/wards','Wards & Areas','▦','WARDS'],
  ['/ward-information','Ward Information','⌖','WARD_INFORMATION']
 ]},
 {id:'people',en:'People & houses',mr:'नागरिक व घरे',items:[
  ['/houses','Houses','⌂','HOUSES'],
  ['/families','Families','👪','FAMILIES'],
  ['/people','All Citizens','●','PEOPLE'],
  ['/voters','Voter / Non-Voter','✓','VOTERS'],
  ['/users','Registered Users','●','USERS']
 ]},
 {id:'work',en:'Daily work',mr:'दैनंदिन काम',items:[
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
  ['/stakeholders','Community Members','◈','STAKEHOLDERS'],
  ['/sub-admins','Sub Master Admins','♙','SUBADMINS']
 ]},
 {id:'tools',en:'Tools',mr:'साधने',items:[
  ['/groups','All chat & Groups','▣','CHAT'],
  ['/reports','Reports & Export','⇩','REPORTS'],
  ['/recycle-bin','Recycle Bin','♻','RECYCLE']
 ]}
];
const mrNav={'All chat & Groups':'ऑल चॅट व गट','Groups & Chat':'गट व चॅट',Dashboard:'डॅशबोर्ड','Wards & Areas':'वॉर्ड व परिसर','Ward Information':'वॉर्डची संपूर्ण माहिती','Nagarsevak & Employees':'नगरसेवक व कर्मचारी','Ward activation':'वॉर्ड सक्रियता','Community Members':'समुदाय सदस्य','Registered Users':'नोंदणीकृत वापरकर्ते','Sub Master Admins':'सब मास्टर अ‍ॅडमिन','Houses':'घरे','Families':'कुटुंबे','All Citizens':'सर्व नागरिक','Voter / Non-Voter':'मतदार / अमतदार','Government Voter Lists':'शासकीय मतदार यादी','Election Data':'निवडणूक माहिती','Birthdays':'वाढदिवस','18+ Follow-up':'१८+ फॉलो-अप','Death Records':'मृत्यू नोंद','Complaints':'तक्रारी','Schemes & Benefits':'योजना व लाभ','Reports & Export':'अहवाल व एक्सपोर्ट','Audit Logs':'ऑडिट लॉग','Ward Updates & Events':'वॉर्ड अपडेट्स व कार्यक्रम','All Ward Updates':'सर्व वॉर्ड अपडेट्स','New Update / Event':'नवीन अपडेट / कार्यक्रम','Recycle Bin':'रिसायकल बिन'};
const pageTitles={
 '/':'Dashboard','/login':'Resident login','/register':'Resident registration','/admin':'Dashboard','/wards':'Wards & Areas','/ward-information':'Ward Information','/staff':'Nagarsevak & Employees','/ward-activation':'Ward activation','/stakeholders':'Community Members','/users':'Registered Ward Users','/sub-admins':'Sub Master Admins','/houses':'Houses','/families':'Families','/people':'All Citizens','/voters':'Voter / Non-Voter','/government-voter-lists':'Government Voter Lists','/election-data':'Election Data','/ward-updates':'Ward Updates & Events','/ward-updates/new':'Create Ward Update / Event','/birthdays':'Birthdays','/follow-up-18':'18+ Follow-up','/deaths':'Death Records','/complaints':'Complaints','/schemes':'Schemes & Benefits','/reports':'Reports & Export','/groups':'All chat & Groups','/recycle-bin':'Recycle Bin'
};
const pageTitle=path=>pageTitles[path]||'WardDesk';
const ROLE_LABELS={SUPER_ADMIN:'Master Admin',SUB_MASTER_ADMIN:'Sub Master Admin',NAGARSEVAK:'Nagarsevak',EMPLOYEE:'Field Employee',CITIZEN:'Resident',SOCIAL_WORKER:'Social Worker',CANDIDATE:'Election Candidate'};
function prettyRole(u){const r=String(typeof u==='string'?u:(u?.role||u?.roleName||'')).toUpperCase();return ROLE_LABELS[r]||(r?r.replaceAll('_',' '):'User')}
function workspaceLabel(user){if(isMaster(user))return 'Master administration';if(isSubMaster(user))return 'Sub Master Admin workspace';if(isNagarsevak(user))return 'Nagarsevak workspace';if(String(user?.role||'').toUpperCase()==='CITIZEN')return 'Resident workspace';return 'Field employee workspace'}
const pageHelp={
 '/':'See ward numbers, people and complaint work at a glance.',
 '/admin':'See ward numbers, people and complaint work at a glance.',
 '/wards':'Create wards and colonies. Exact home location is saved when a team member visits the house.',
 '/houses':'When you visit a home, save GPS at the door. Tap the location later to open maps and get directions.',
 '/families':'Each family lives at a house. Open directions from the house location.',
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
 '/staff':'Nagarsevaks and the employees who work with them.',
 '/ward-activation':'Activate wards and Nagarsevaks. Residents only see Nagarsevaks who are active for their ward.',
 '/stakeholders':'Community members and social workers.',
 '/sub-admins':'Additional admin accounts and their permissions.',
 '/groups':'Internal chat groups for ward teams and residents.',
 '/reports':'Export ward data for reviews and reports.',
 '/recycle-bin':'Restore records that were deleted by mistake.'
};
function pageSection(path,language='en'){const hit=navSections.find(s=>s.items.some(([to])=>to===path||(to==='__WARD_UPDATES__'&&String(path).startsWith('/ward-updates'))));if(!hit)return language==='mr'?'वॉर्डडेस्क':'WardDesk';return language==='mr'?hit.mr:hit.en}
const roleName=u=>String(u?.role||u?.roleName||'').toUpperCase();
const rolePanelAccess=(key,u)=>{
 const r=roleName(u);
 if(r==='SUPER_ADMIN') return true;
 if(r==='NAGARSEVAK' && ['DASHBOARD','WARDS','WARD_INFORMATION','WARD_UPDATES','NOTIFICATIONS','HOUSES','FAMILIES','PEOPLE','VOTERS','BIRTHDAYS','FOLLOWUP','DEATH','COMPLAINTS','SCHEMES','CHAT','REPORTS','RECYCLE','USERS','STAFF'].includes(key)) return true;
 if(r==='EMPLOYEE' && ['DASHBOARD','WARDS','WARD_INFORMATION','WARD_UPDATES','NOTIFICATIONS','HOUSES','FAMILIES','PEOPLE','VOTERS','BIRTHDAYS','FOLLOWUP','DEATH','COMPLAINTS','SCHEMES','CHAT','REPORTS','RECYCLE'].includes(key)) return true;
 return false;
};
const allowed=(key,u)=>{
 if(rolePanelAccess(key,u)) return true;
 if(key==='USERS' && isEmployee(u)) return false;
 if(key==='NOTIFICATIONS') return can('VIEW_NOTIFICATIONS',u);
 if(key==='WARD_UPDATES'||key==='WARD_UPDATES_GROUP') return can('VIEW_WARD_UPDATES',u);
 if(key==='USERS') return can('VIEW_USERS',u);
 if(key==='WARDS') return can('VIEW_WARDS',u);
 if(key==='WARD_INFORMATION') return can('VIEW_WARD_INFORMATION',u)||can('VIEW_WARDS',u);
 if(key==='SUBADMINS') return isMaster(u);
 if(key==='WARD_ACTIVATION') return isMaster(u);
 if(key==='GOVERNMENT_VOTER_LISTS') return can('VIEW_GOVERNMENT_VOTER_LISTS',u);
 if(key==='ELECTION_DATA') return can('VIEW_ELECTION_DATA',u);
 if(key==='STAFF') return can('VIEW_STAFF',u);
 if(key==='STAKEHOLDERS') return isMaster(u);
 if(key==='DEATH') return can('VIEW_DEATH_RECORDS',u);
 return canModule(key,'VIEW',u);
};
function AdminNavItem({to,label,icon,itemKey,language,user,updatesOpen,setUpdatesOpen,navRef,sidebarScrollKey,sidebarGo}){
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
 return <NavLink to={to} end={to==='/admin'} onClick={e=>sidebarGo(e,to)}><span className="nav-icon">{icon}</span><span>{language==='mr'?(mrNav[label]||label):label}</span></NavLink>;
}
function Protected({children}){return getUser()?children:<Navigate to="/" replace/>}
function HomeEntry(){const u=getUser(); if(!u) return <Login mode="user"/>; if(String(u.role||'').toUpperCase()==='CITIZEN') return <UserPanel/>; return <Navigate to="/admin" replace/>}
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
function AdminEntry(){const u=getUser(); if(!u) return <Login mode="admin"/>; if(String(u.role||'').toUpperCase()==='CITIZEN') return <Navigate to="/" replace/>; return <Shell><Dashboard/></Shell>}
function CitizenShell({children}){
 const navigate=useNavigate(),location=useLocation(),user=getUser();
 const [menu,setMenu]=useState(false),[mobileNav,setMobileNav]=useState(false),[notifications,setNotifications]=useState([]),[language,setLanguage]=useState(()=>localStorage.getItem('ward_language')||'en'),[accountOpen,setAccountOpen]=useState(false),[welcome,setWelcome]=useState(false),[showNotifications,setShowNotifications]=useState(false),[selectedNotification,setSelectedNotification]=useState(null),[noteToast,setNoteToast]=useState(null);
 const receivedNotifications=useMemo(()=>notifications.filter(n=>n.direction!=='SENT'),[notifications]);
 const unread=useMemo(()=>receivedNotifications.filter(n=>!n.isRead).length,[receivedNotifications]);
 const accountRef=React.useRef(null);
 const notificationRef=useRef(null);
 const seenNotes=useRef(new Set());
 const primedNotes=useRef(false);
 useEffect(()=>{const close=e=>{if(accountRef.current&&!accountRef.current.contains(e.target))setMenu(false);if(notificationRef.current&&!notificationRef.current.contains(e.target))setShowNotifications(false);if(!e.target.closest('.user-mobile-menu')&&!e.target.closest('.user-nav'))setMobileNav(false)};document.addEventListener('pointerdown',close,true);return()=>document.removeEventListener('pointerdown',close,true)},[]);
 useEffect(()=>{
  let live=true;
  const load=()=>api.notifications().then(r=>{
   if(!live)return;
   const rows=(r.data||[]).filter(n=>n.direction!=='SENT');
   if(primedNotes.current){
    const fresh=rows.find(n=>!n.isRead && !seenNotes.current.has(n.id) && /NAGARSEVAK_ACTIVATED|WARD_ACTIVATED|WARD_/.test(String(n.type||'').toUpperCase()));
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
 useEffect(()=>{document.title=`${pageTitle(location.pathname)} · WardDesk`;const token=localStorage.getItem('ward_token');if(!token)return;let timer;try{const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));const ms=Number(payload.exp)*1000-Date.now();if(ms<=0){sessionStorage.setItem('ward_session_expired','1');clearSession();window.location.replace('/login');return}timer=setTimeout(()=>{sessionStorage.setItem('ward_session_expired','1');clearSession();window.location.replace('/login')},ms+250)}catch{sessionStorage.setItem('ward_session_expired','1');clearSession();window.location.replace('/login')}return()=>clearTimeout(timer)},[location.pathname]);
 useEffect(()=>{if(!noteToast)return;const t=setTimeout(()=>setNoteToast(null),5000);return()=>clearTimeout(t)},[noteToast]);
 useEffect(()=>{if(location.state?.welcome){setWelcome(true);navigate(location.pathname,{replace:true,state:null});setTimeout(()=>setWelcome(false),4500);}},[location.pathname,location.state,navigate]);
 useEffect(()=>{
  setMobileNav(false);setMenu(false);setShowNotifications(false);
  scrollMainToTop();
  const t=setTimeout(scrollMainToTop,80);
  return()=>clearTimeout(t);
 },[location.pathname]);
 const logout=()=>{clearSession();window.location.replace('/login')}; const toggleLanguage=()=>{const n=language==='en'?'mr':'en';localStorage.setItem('ward_language',n);setLanguage(n);window.location.reload()};
 const go=p=>{setMenu(false);setMobileNav(false);setShowNotifications(false);navigate(p)};
 const markNotification=async(id)=>{try{await api.markNotificationRead(id);setNotifications(xs=>xs.map(n=>n.id===id?{...n,isRead:true}:n));}catch(e){window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:e.message}}))}};
 const openNotification=async(n)=>{try{if(n?.direction!=='SENT'&&!n?.isRead)await api.markNotificationRead(n.id);setNotifications(xs=>xs.map(x=>x.id===n.id?{...x,isRead:true}:x));setShowNotifications(false);const target=String(n?.actionUrl||'').trim();if(target.startsWith('/')){navigate(target);return;}setSelectedNotification(n);}catch(e){window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:e.message}}))}};
 const markAllNotifications=async()=>{try{await api.markAllNotificationsRead();setNotifications(xs=>xs.map(n=>n.direction==='SENT'?n:{...n,isRead:true}));}catch(e){window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:e.message}}))}};
 const clearAllNotifications=async()=>{try{await api.clearNotifications();setNotifications([])}catch(e){window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:e.message}}))}};
 return <div className="user-portal">
  <header className="user-topbar">
   <div className="user-brand" onClick={()=>go('/')} role="button" tabIndex={0}><div className="user-brand-mark">W</div><div><strong>WardDesk</strong><span>Your Ward · Digital Services</span></div></div>
   <nav className={`user-nav user-nav-static ${mobileNav?'is-open':''}`}>
    <button className={`user-nav-link ${location.pathname==='/'?'active':''}`} onClick={()=>go('/')}>{language==='mr'?'मुख्यपृष्ठ':'Home'}</button>
    <button className={`user-nav-link ${location.pathname.startsWith('/ward-updates')?'active':''}`} onClick={()=>go('/ward-updates')}>{language==='mr'?'वॉर्ड अपडेट्स':'Updates & Events'}</button>
    <button className={`user-nav-link ${location.pathname.startsWith('/schemes')?'active':''}`} onClick={()=>go('/schemes')}>{language==='mr'?'योजना':'Schemes'}</button>
    <button className={`user-nav-link ${location.pathname.startsWith('/my-complaints')?'active':''}`} onClick={()=>go('/my-complaints')}>{language==='mr'?'माझ्या तक्रारी':'My Complaints'}</button>
    <button className={`user-nav-link ${location.pathname.startsWith('/groups')?'active':''}`} onClick={()=>go('/groups')}>{language==='mr'?'गट व चॅट':'Groups & Chat'}{unread>0&&<span className="user-nav-badge">{unread}</span>}</button>
   </nav>
   <div className="user-actions"><button className="user-language-btn" onClick={toggleLanguage}>{language==='en'?'मराठी':'English'}</button><div className="user-notification-wrap" ref={notificationRef}><button type="button" className="user-icon-btn" onClick={()=>{setMenu(false);setMobileNav(false);setShowNotifications(v=>!v)}} aria-label="Notifications">🔔{unread>0&&<span className="user-notification-dot">{unread>9?'9+':unread}</span>}</button>{showNotifications&&<div className="user-notification-popover"><div className="user-notification-head"><strong>{language==='mr'?'सूचना':'Notifications'}</strong><div>{unread>0&&<button type="button" onClick={markAllNotifications}>{language==='mr'?'सर्व वाचले':'Mark all read'}</button>}<button type="button" onClick={clearAllNotifications}>{language==='mr'?'साफ करा':'Clear'}</button></div></div>{!notifications.length?<div className="user-notification-empty">{language==='mr'?'कोणत्याही सूचना नाहीत':'No notifications'}</div>:notifications.map(n=><button type="button" key={n.id} className={`user-notification-item ${n.isRead?'read':''}`} onClick={()=>openNotification(n)}><strong>{n.title||'Notification'}</strong><span>{n.message||''}</span><small>{n.sender?.name?`From: ${n.sender.name} · `:''}{n.createdAt?new Date(n.createdAt).toLocaleString('en-IN'):''}</small></button>)}</div>}</div><div className="user-account-wrap" ref={accountRef}><button className="user-account" onClick={()=>{setMobileNav(false);setMenu(v=>!v)}}><ProfileAvatar name={user?.name} size="sm"/><span className="user-account-text"><b>{user?.name}</b><small>{user?.ward?.wardNumber||'My Ward'}</small></span></button>{menu&&<div className="user-account-menu"><div className="user-menu-summary"><strong>{user?.name}</strong><span>{user?.email}</span><small>{user?.ward?.wardNumber}{user?.ward?.name?` · ${user.ward.name}`:''}</small></div><button onClick={()=>{setMenu(false);setAccountOpen(true)}}>My profile</button><button onClick={logout} className="danger-link">Sign out</button></div>}</div><button className="user-mobile-menu" onClick={()=>{setMenu(false);setMobileNav(v=>!v)}} aria-label="Open menu">☰</button></div>
  </header>
  <main className="user-main user-page-main">{children}</main>
  {noteToast&&<div className="global-toast global-toast-success" role="status"><div><strong>{noteToast.title}</strong><div>{noteToast.message}</div></div><button type="button" onClick={()=>setNoteToast(null)} aria-label="Close">×</button></div>}
  {welcome&&<div className="global-toast global-toast-success user-welcome-toast" role="status"><div><strong>{language==='mr'?'यशस्वी':'Success'}</strong><div>{language==='mr'?`पुन्हा स्वागत आहे, ${user?.name||'वापरकर्ता'} 👋`:`Welcome back, ${user?.name||'User'} 👋`}</div></div><button type="button" onClick={()=>setWelcome(false)} aria-label="Close">×</button></div>}<footer className="user-footer"><span>© {new Date().getFullYear()} Kairo IT Solutions PVT LTD</span><span>Secure registered ward account</span></footer>{accountOpen&&<Modal wide title="My profile" onClose={()=>setAccountOpen(false)}><ProfileEditor user={user} role="CITIZEN" onClose={()=>setAccountOpen(false)} onSaved={()=>window.location.reload()}/></Modal>}{selectedNotification&&<Modal title={selectedNotification.title||'Notification'} onClose={()=>setSelectedNotification(null)}><div className="notification-detail-body"><p>{selectedNotification.message||''}</p><small>{selectedNotification.sender?.name?`From ${selectedNotification.sender.name}`:''}</small></div><div className="modal-actions"><button type="button" className="primary-btn" onClick={()=>{const target=String(selectedNotification.actionUrl||'').trim();const type=String(selectedNotification.type||'');setSelectedNotification(null);if(target.startsWith('/'))go(target);else if(type.includes('COMPLAINT'))go('/my-complaints');else if(type.includes('SCHEME'))go('/schemes');else go('/groups')}}>Open related section</button><button type="button" className="ghost-btn" onClick={()=>setSelectedNotification(null)}>Close</button></div></Modal>}
 </div>;
}

function ProfileEditor({user,role,onClose,onSaved}){
 const isNagar=String(role||user?.role||'').toUpperCase()==='NAGARSEVAK';
 const [form,setForm]=useState({name:String(user?.name||'').trim(),email:String(user?.email||'').trim(),mobile:String(user?.mobile||'').replace(/\D/g,'').slice(0,10),password:'',confirmPassword:'',photo:user?.photo||''});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  if(!isNagar)return;
  api.me().then(r=>{
   const photo=r?.data?.user?.photo;
   if(photo) setForm(f=>f.photo?f:{...f,photo});
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
    {isNagar&&<div className="span-2"><CirclePhotoField label="Profile photo" value={form.photo} onChange={v=>setForm({...form,photo:v})}/></div>}
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

 if(['/deaths','/people','/voters','/complaints','/government-voter-lists','/staff','/users','/houses'].includes(location.pathname)||!state.count)return null;
 const totalPages=Math.max(1,Math.ceil(state.count/pageSize));
 const current=Math.min(page,totalPages);
 const go=p=>setPage(Math.max(1,Math.min(totalPages,p)));
 return <PaginationBar page={current} pages={totalPages} total={state.count} limit={pageSize} onPage={go} onLimit={n=>{setPageSize(n);setPage(1)}}/>;
}
function Shell({children}){
 const navigate=useNavigate(),location=useLocation(),user=getUser(),navRef=useRef(null),[open,setOpen]=useState(false),[language,setLanguage]=useState(()=>localStorage.getItem('ward_language')||'en'),[notifications,setNotifications]=useState([]),[showNotifications,setShowNotifications]=useState(false),[selectedNotification,setSelectedNotification]=useState(null),[showProfile,setShowProfile]=useState(false),[toast,setToast]=useState(null),[updatesOpen,setUpdatesOpen]=useState(()=>location.pathname.startsWith('/ward-updates'));
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
 useEffect(()=>{document.title=`${pageTitle(location.pathname)} · WardDesk`},[location.pathname]);
 useEffect(()=>{
  let live=true;
  let primed=false;
  let seen=new Set();
  const load=()=>api.notifications().then(r=>{
   if(!live)return;
   const rows=(r.data||[]).filter(n=>n.direction!=='SENT');
   if(primed){
    const fresh=rows.find(n=>!n.isRead && !seen.has(n.id) && /COMPLAINT|SCHEME|NAGARSEVAK_ACTIVATED|WARD_/.test(String(n.type||'').toUpperCase()));
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
  const handler=e=>setToast(e.detail||null);
  window.addEventListener('ward:toast',handler);
  return()=>window.removeEventListener('ward:toast',handler);
 },[]);
 useEffect(()=>{
  if(location.state?.signedOut){setToast({type:'success',message:'You have been signed out successfully.'});navigate('/admin',{replace:true,state:null});return;}
  if(location.state?.sessionExpired){setToast({type:'error',message:'Your 30-minute inactive session has expired. Please sign in again.'});navigate('/admin',{replace:true,state:null});return;}
  if(location.state?.welcome){
   setToast({type:'success',message:`Welcome back, ${user?.name||'User'} 👋`});
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
 const logout=()=>{if(!window.confirm('Are you sure you want to sign out?'))return;clearSession();setOpen(false);setShowNotifications(false);setShowProfile(false);window.location.replace('/admin')}; const role=roleOf(user);
 const visibleSections=navSections.map(s=>({...s,items:s.items.filter(([, , ,key])=>allowed(key,user))})).filter(s=>s.items.length);
 const pretty=prettyRole(user);
 const help=pageHelp[location.pathname]||workspaceLabel(user);
 const sectionName=pageSection(location.pathname,language);
 return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a><aside className={`sidebar ${open?'open':''}`}><div className="brand"><div className="brand-mark">W</div><div><strong>WardDesk</strong><span>Municipal workspace</span></div></div><nav ref={navRef} aria-label="Main">{visibleSections.map(section=><div className="nav-section" key={section.id}><div className="nav-section-label">{language==='mr'?section.mr:section.en}</div>{section.items.map(([to,label,icon,key])=><AdminNavItem key={key} to={to} label={label} icon={icon} itemKey={key} language={language} user={user} updatesOpen={updatesOpen} setUpdatesOpen={setUpdatesOpen} navRef={navRef} sidebarScrollKey={sidebarScrollKey} sidebarGo={sidebarGo}/>)}</div>)}</nav><div className="sidebar-footer"><div className="security-note">● Secure session · {pretty}</div><button className="logout-btn" onClick={logout}>Sign out</button></div></aside>{open&&<button className="scrim" onClick={()=>setOpen(false)}/>}<main className="main"><header className="topbar"><div className="admin-mobile-brand" aria-hidden="true">W</div><button className="menu-btn" onClick={()=>setOpen(v=>!v)}>☰</button><div className="topbar-context"><div className="eyebrow">{sectionName}</div><div className="topbar-title">{pageTitle(location.pathname)}</div><div className="topbar-workspace">{help}</div></div><div className="topbar-spacer"/><button type="button" className="language-btn" onClick={()=>setLanguage(v=>{const n=v==='en'?'mr':'en';localStorage.setItem('ward_language',n);applyLanguage(n);return n})} title="Change language">{language==='en'?'मराठी':'English'}</button><div className="notification-wrap"><button className="notification-btn" onClick={()=>setShowNotifications(v=>!v)}>🔔{receivedNotifications.filter(n=>!n.isRead).length>0&&<span className="notification-count">{receivedNotifications.filter(n=>!n.isRead).length}</span>}</button>{showNotifications&&<div className="notification-popover"><div className="notification-popover-head"><strong>Notifications</strong>{notifications.length>0&&<div className="card-actions">{notifications.some(n=>!n.isRead)&&<button type="button" className="small-btn" onClick={async()=>{await api.markAllNotificationsRead();setNotifications(x=>x.map(a=>a.direction==='SENT'?a:{...a,isRead:true}))}}>Mark all read</button>}<button type="button" className="small-btn danger" onClick={async()=>{if(!window.confirm('Clear all notifications?'))return;await api.clearNotifications();setNotifications([])}}>Clear</button></div>}</div>{!notifications.length?<div className="muted notification-empty">No notifications</div>:notifications.map(n=><button key={n.id} className={`notification-item ${n.isRead?'read':''}`} onClick={async()=>{try{if(!n.isRead){await api.markNotificationRead(n.id);setNotifications(x=>x.map(a=>a.id===n.id?{...a,isRead:true}:a))}}catch(e){window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:e.message}}))}setSelectedNotification(n);setShowNotifications(false)}}><strong>{n.title}</strong><span>{n.message}</span><small>From: {n.sender?.name||'System'} · {n.type?.replaceAll('_',' ')||'Notification'} · {n.createdAt?new Date(n.createdAt).toLocaleString('en-IN'):''}</small></button>)}<button type="button" className="notification-view-all" onClick={()=>{setShowNotifications(false);navigate('/groups')}}>Open Groups & Chat</button></div>}</div><button className="user-chip user-chip-button" onClick={()=>setShowProfile(true)} aria-label="Open profile"><FaceAvatar name={user?.name} photo={user?.photo} className="user-chip-face"/><div className="user-text"><strong>{user?.name}</strong><span>{pretty}</span></div></button></header><div className="content" id="main-content">{children}<GlobalPagination/></div><footer className="app-footer"><span>© {new Date().getFullYear()} Kairo IT Solutions PVT LTD</span><span>Secure administration workspace · {pretty}</span></footer>{toast&&<div className={`global-toast ${toast.type==='error'?'global-toast-error':'global-toast-success'}`} role={toast.type==='error'?'alert':'status'}><div><strong>{toast.type==='error'?'Action failed':'Success'}</strong><div>{toast.message}</div></div><button type="button" onClick={()=>setToast(null)} aria-label="Close">×</button></div>}{selectedNotification&&<div className="modal-backdrop" onPointerDown={()=>setSelectedNotification(null)}><div className="modal notification-detail-modal" onPointerDown={e=>e.stopPropagation()}><div className="modal-header"><div><h2>{selectedNotification.title}</h2><span>{selectedNotification.sender?.name?`From ${selectedNotification.sender.name}`:'WardDesk notification'}</span></div><button type="button" className="icon-btn" onClick={()=>setSelectedNotification(null)}>×</button></div><div className="notification-detail-body"><p>{selectedNotification.message}</p><small>{selectedNotification.createdAt?new Date(selectedNotification.createdAt).toLocaleString('en-IN'):''}</small></div><div className="modal-actions"><button type="button" className="primary-btn" onClick={()=>{const target=String(selectedNotification.actionUrl||'').trim();const t=String(selectedNotification.type||'');setSelectedNotification(null);if(target.startsWith('/'))navigate(target);else if(t.includes('COMPLAINT'))navigate('/complaints');else if(t.includes('SCHEME'))navigate('/schemes');else if(t.includes('WARD_UPDATE')||t.includes('WARD_EVENT'))navigate('/ward-updates');else if(t.includes('18PLUS'))navigate('/follow-up-18');else if(t.includes('CHAT')||t.includes('MESSAGE'))navigate('/groups')}}>Open related section</button><button type="button" className="ghost-btn" onClick={()=>setSelectedNotification(null)}>Close</button></div></div></div>}{showProfile&&<div className="modal-backdrop" onPointerDown={()=>setShowProfile(false)}><div className="modal profile-modal" onPointerDown={e=>e.stopPropagation()}><div className="modal-header profile-modal-header"><div><h2>My profile</h2><span>Update your name, contact details and password</span></div><button type="button" className="icon-btn" onClick={()=>setShowProfile(false)}>×</button></div><div className="profile-summary"><FaceAvatar name={user?.name} photo={user?.photo} className="staff-face-lg"/><div><h3>{user?.name}</h3><span>{pretty}</span></div></div><ProfileEditor user={user} role={role} onClose={()=>setShowProfile(false)} onSaved={(u)=>{localStorage.setItem('ward_user',JSON.stringify({...user,...u}));setShowProfile(false);window.location.reload()}}/></div></div>}</main></div>
}
function CitizenOnly({children}){const u=getUser();if(!u)return <Navigate to="/login" replace/>;if(String(u.role||'').toUpperCase()!=='CITIZEN')return <Navigate to="/admin" replace/>;return <CitizenShell>{children}</CitizenShell>}
function Guard({permission,children}){
 const u=getUser();
 let ok=rolePanelAccess(permission,u);
 if(!ok){
  if(permission==='WARD_UPDATES') ok=isMaster(u)||isSubMaster(u)||isNagarsevak(u)||isEmployee(u)||roleName(u)==='CITIZEN';
  else if(permission==='USERS') ok=isMaster(u)||isSubMaster(u)||isNagarsevak(u);
  else if(permission==='WARDS') ok=isMaster(u)||isNagarsevak(u)||isEmployee(u)||canModule('WARDS','VIEW',u);
  else if(permission==='STAFF') ok=isMaster(u)||isNagarsevak(u)||(isSubMaster(u)&&canModule('STAFF','VIEW',u));
  else if(permission==='STAKEHOLDERS') ok=isMaster(u);
  else if(permission==='DEATH') ok=can('VIEW_DEATH_RECORDS',u);
  else ok=canModule(permission,'VIEW',u);
 }
 return ok?children:<Navigate to="/" replace/>;
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
 if(u&&String(u.role||'').toUpperCase()==='CITIZEN')return <Navigate to="/" replace/>; return <Navigate to="/admin" replace/>;
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
 return String(u.role||'').toUpperCase()==='CITIZEN'?'/':'/admin';
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
  <Route path="/login" element={getUser()?(String(getUser()?.role||'').toUpperCase()==='CITIZEN'?<Navigate to="/" replace/>:<Navigate to="/admin" replace/>):<Login mode="user"/>}/>
  <Route path="/admin/login" element={<Navigate to="/admin" replace/>}/>
  <Route path="/register" element={getUser()?<Navigate to="/" replace/>:<Register/>}/>

  {/* Shared URLs: the same path serves the citizen portal for citizens and the administration page for staff. */}
  <Route path="/ward-updates" element={<RolePage citizen={<CitizenShell><WardUpdates/></CitizenShell>} admin={<AdminOnly><WardUpdates/></AdminOnly>}/>} />
  <Route path="/ward-updates/new" element={<AdminOnly><WardUpdates autoOpen/></AdminOnly>}/>
  <Route path="/schemes" element={<RolePage citizen={<CitizenShell><Schemes/></CitizenShell>} admin={<AdminOnly><Schemes/></AdminOnly>}/>} />
  <Route path="/messages" element={<Navigate to="/groups" replace/>}/>
  <Route path="/groups" element={<RolePage citizen={<CitizenShell><Groups/></CitizenShell>} admin={<AdminOnly><Guard permission="CHAT"><Groups/></Guard></AdminOnly>}/>} />
  <Route path="/my-complaints" element={<CitizenOnly><UserComplaints language={(localStorage.getItem('ward_language')||'en')}/></CitizenOnly>}/>


  {/* Administration */}
  <Route path="/dashboard" element={<AdminOnly><Dashboard/></AdminOnly>}/>
  <Route path="/wards" element={<AdminOnly><Guard permission="WARDS"><Wards/></Guard></AdminOnly>}/>
  <Route path="/ward-information" element={<AdminOnly><WardInformation/></AdminOnly>}/>
  <Route path="/election-data" element={<AdminOnly><ElectionData/></AdminOnly>}/>
  <Route path="/stakeholders" element={<AdminOnly><Guard permission="STAKEHOLDERS"><Stakeholders/></Guard></AdminOnly>}/>
  <Route path="/staff" element={<AdminOnly><Guard permission="STAFF"><Staff/></Guard></AdminOnly>}/>
  <Route path="/ward-activation" element={<AdminOnly><WardActivation/></AdminOnly>}/>
  <Route path="/users" element={<AdminOnly><Guard permission="USERS"><Users/></Guard></AdminOnly>}/>
  <Route path="/sub-admins" element={<AdminOnly><SubAdmins/></AdminOnly>}/>
  <Route path="/houses" element={<AdminOnly><Guard permission="HOUSES"><Houses/></Guard></AdminOnly>}/>
  <Route path="/families" element={<AdminOnly><Guard permission="FAMILIES"><Families/></Guard></AdminOnly>}/>
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
