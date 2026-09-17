import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {api,clearSession,getUser,setSession} from '../services/api';
import {Field,ImageField,Loading,Modal,ProfileAvatar,FaceAvatar} from '../components/Ui';

function typeLabel(v,mr){return mr?(v==='EVENT'?'कार्यक्रम':'वॉर्ड अपडेट'):(v==='EVENT'?'Event':'Ward update');}
function fmt(v){return v?new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—';}

export default function UserPanel(){
 const navigate=useNavigate(),location=useLocation(),user=getUser(),mr=(localStorage.getItem('ward_language')||'en')==='mr';
 const [language,setLanguage]=useState(mr?'mr':'en'),[updates,setUpdates]=useState(null),[updateTotal,setUpdateTotal]=useState(null),[schemes,setSchemes]=useState(null),[messages,setMessages]=useState(null),[complaints,setComplaints]=useState(null),[complaintTotal,setComplaintTotal]=useState(null),[team,setTeam]=useState(null),[snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[menu,setMenu]=useState(false),[mobileMenu,setMobileMenu]=useState(false),[profile,setProfile]=useState(false),[showNotifications,setShowNotifications]=useState(false),[selectedNotification,setSelectedNotification]=useState(null),[toast,setToast]=useState(null);
 const accountRef=useRef(null),notificationRef=useRef(null),seenNotes=useRef(new Set()),primedNotes=useRef(false);
 const ward=user?.ward;
 const unread=useMemo(()=>Array.isArray(messages)?messages.filter(n=>n.direction!=='SENT'&&!n.isRead).length:0,[messages]);
 const text=language==='mr'?{home:'मुख्यपृष्ठ',updates:'वॉर्ड अपडेट्स',schemes:'योजना',messages:'संदेश',complaints:'माझ्या तक्रारी',welcome:'स्वागत आहे',desc:'तुमच्या वॉर्डमधील अपडेट्स, कार्यक्रम, योजना आणि तक्रारींची माहिती एका ठिकाणी.',ward:'तुमचा वॉर्ड',team:'तुमचा वॉर्ड टीम',nagarsevak:'नगरसेवक',employees:'कर्मचारी',latest:'ताजे अपडेट्स',benefits:'तुमच्यासाठी योजना',noUpdates:'अजून अपडेट नाहीत',account:'माझे खाते',statUpdates:'वॉर्ड अपडेट्स',statComplaints:'तक्रारी',statSchemes:'योजना',statMessages:'संदेश',publishedUpdates:'प्रकाशित अपडेट्स',myComplaints:'माझ्या तक्रारी',publishedSchemes:'प्रकाशित योजना',unreadMessages:'न वाचलेले संदेश',profile:'प्रोफाइल',logout:'बाहेर पडा'}:{home:'Home',updates:'Updates & Events',schemes:'Schemes',messages:'Messages',complaints:'My Complaints',welcome:'Welcome',desc:'WardDesk is your digital ward desk for complaints, schemes and notices. One secure account keeps you connected to your local ward office.',ward:'Your Ward',team:'Your Ward Team',nagarsevak:'Nagarsevak',employees:'Employees',latest:'Latest from your ward',benefits:'Schemes for you',noUpdates:'No updates yet',account:'My Account',statUpdates:'WARD UPDATES',statComplaints:'COMPLAINTS',statSchemes:'SCHEMES',statMessages:'MESSAGES',publishedUpdates:'Published updates',myComplaints:'My complaints',publishedSchemes:'Published schemes',unreadMessages:'Unread messages',profile:'My profile',logout:'Sign out'};

 const load=async()=>{
  setError('');
  const results=await Promise.allSettled([
   api.wardUpdates({page:1,limit:5,status:'PUBLISHED'}),
   api.schemes({status:'PUBLISHED'}),
   api.notifications(),
   api.complaints({page:1,limit:50}),
   api.wardTeam(),
   api.myWard()
  ]);
  const [u,s,n,c,t,w]=results;
  if(u.status==='fulfilled') { setUpdates(u.value?.data||[]); setUpdateTotal(Number.isFinite(Number(u.value?.meta?.total)) ? Number(u.value.meta.total) : (u.value?.data||[]).length); } else { setUpdates([]); setUpdateTotal(0); }
  if(s.status==='fulfilled') setSchemes((s.value?.data||[]).slice(0,4)); else setSchemes([]);
  if(n.status==='fulfilled'){
   const rows=n.value?.data||[];
   if(primedNotes.current){
    const fresh=rows.find(x=>x.direction!=='SENT'&&!x.isRead&&!seenNotes.current.has(x.id)&&/COMPLAINT|SCHEME|NAGARSEVAK_ACTIVATED|WARD_/.test(String(x.type||'').toUpperCase()));
    if(fresh) setToast({type:'success',title:fresh.title||'Update',message:fresh.message||''});
   }
   primedNotes.current=true;
   seenNotes.current=new Set(rows.map(x=>x.id));
   setMessages(rows);
  } else { setMessages([]); }
  if(c.status==='fulfilled') { setComplaints(c.value?.data||[]); setComplaintTotal(Number.isFinite(Number(c.value?.meta?.total)) ? Number(c.value.meta.total) : (c.value?.data||[]).length); } else { setComplaints([]); setComplaintTotal(0); }
  if(t.status==='fulfilled') setTeam(t.value?.data||null); else setTeam(null);
  if(w.status==='fulfilled') setSnapshot(w.value?.data||null);
  const failed=results.find(x=>x.status==='rejected');
  if(failed) setError(failed.reason?.message||'Some ward information could not be loaded.');
 };
 useEffect(()=>{load();const t=setInterval(load,12000);const onVis=()=>{if(document.visibilityState==='visible')load();};window.addEventListener('focus',load);document.addEventListener('visibilitychange',onVis);return()=>{clearInterval(t);window.removeEventListener('focus',load);document.removeEventListener('visibilitychange',onVis)}},[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),5000);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{const close=e=>{if(accountRef.current&&!accountRef.current.contains(e.target))setMenu(false);if(notificationRef.current&&!notificationRef.current.contains(e.target))setShowNotifications(false);if(!e.target.closest('.user-mobile-menu')&&!e.target.closest('.user-nav'))setMobileMenu(false)};document.addEventListener('pointerdown',close,true);return()=>document.removeEventListener('pointerdown',close,true)},[]);
 useEffect(()=>{const token=localStorage.getItem('ward_token');if(!token)return;try{const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));const ms=Number(payload.exp)*1000-Date.now();if(ms<=0){clearSession();window.location.replace('/login');return}const t=setTimeout(()=>{clearSession();window.location.replace('/login')},ms+250);return()=>clearTimeout(t)}catch{clearSession();window.location.replace('/login')}},[]);
 const go=p=>{setMenu(false);setMobileMenu(false);setShowNotifications(false);navigate(p)};
 const markNotification=async(id)=>{try{await api.markNotificationRead(id);setMessages(xs=>(xs||[]).map(n=>n.id===id?{...n,isRead:true}:n))}catch(e){setError(e.message)}};
 const openNotification=async(n)=>{try{if(!n?.isRead)await api.markNotificationRead(n.id);setMessages(xs=>(xs||[]).map(x=>x.id===n.id?{...x,isRead:true}:x));setShowNotifications(false);const target=String(n?.actionUrl||'').trim();if(target.startsWith('/')){go(target);return;}setSelectedNotification(n);}catch(e){setError(e.message)}};
 const markAllNotifications=async()=>{try{await api.markAllNotificationsRead();setMessages(xs=>(xs||[]).map(n=>n.direction==='SENT'?n:{...n,isRead:true}))}catch(e){setError(e.message)}};
 const clearAllNotifications=async()=>{try{await api.clearNotifications();setMessages([])}catch(e){setError(e.message)}};
 const toggleLanguage=()=>{const n=language==='en'?'mr':'en';localStorage.setItem('ward_language',n);setLanguage(n);window.dispatchEvent(new CustomEvent('ward:language',{detail:n}));};
 const logout=()=>{clearSession();setMenu(false);setMobileMenu(false);window.location.replace('/login')};
 return <div className="user-portal">
  <header className="user-topbar"><div className="user-brand" onClick={()=>go('/')} role="button" tabIndex={0}><div className="user-brand-mark">W</div><div><strong>WardDesk</strong><span>Your Ward · Digital Services</span></div></div>
   <nav className={`user-nav ${mobileMenu?'is-open':''}`}><button className={`user-nav-link ${location.pathname==='/'?'active':''}`} onClick={()=>go('/')}>{text.home}</button><button className={`user-nav-link ${location.pathname.startsWith('/ward-updates')?'active':''}`} onClick={()=>go('/ward-updates')}>{text.updates}</button><button className={`user-nav-link ${location.pathname.startsWith('/schemes')?'active':''}`} onClick={()=>go('/schemes')}>{text.schemes}</button><button className={`user-nav-link ${location.pathname.startsWith('/my-complaints')?'active':''}`} onClick={()=>go('/my-complaints')}>{text.complaints}{complaintTotal>0&&<span className="user-nav-badge">{complaintTotal>99?'99+':complaintTotal}</span>}</button><button className={`user-nav-link ${location.pathname.startsWith('/groups')?'active':''}`} onClick={()=>go('/groups')}>{language==='mr'?'गट व चॅट':'Groups & Chat'}{unread>0&&<span className="user-nav-badge">{unread}</span>}</button></nav>
   <div className="user-actions"><button className="user-language-btn" onClick={toggleLanguage}>{language==='en'?'मराठी':'English'}</button><div className="user-notification-wrap" ref={notificationRef}><button type="button" className="user-icon-btn" onClick={()=>{setMenu(false);setMobileMenu(false);setShowNotifications(v=>!v)}} aria-label="Notifications">🔔{unread>0&&<span className="user-notification-dot">{unread>9?'9+':unread}</span>}</button>{showNotifications&&<div className="user-notification-popover"><div className="user-notification-head"><strong>{language==='mr'?'सूचना':'Notifications'}</strong><div>{unread>0&&<button type="button" onClick={markAllNotifications}>{language==='mr'?'सर्व वाचले':'Mark all read'}</button>}<button type="button" onClick={clearAllNotifications}>{language==='mr'?'साफ करा':'Clear'}</button></div></div>{!(messages||[]).filter(n=>n.direction!=='SENT').length?<div className="user-notification-empty">{language==='mr'?'कोणत्याही सूचना नाहीत':'No notifications'}</div>:(messages||[]).filter(n=>n.direction!=='SENT').map(n=><button type="button" key={n.id} className={`user-notification-item ${n.isRead?'read':''}`} onClick={()=>openNotification(n)}><strong>{n.title||'Notification'}</strong><span>{n.message||''}</span><small>{n.sender?.name?`From: ${n.sender.name} · `:''}{n.createdAt?new Date(n.createdAt).toLocaleString('en-IN'):''}</small></button>)}<button type="button" className="user-notification-open-chat" onClick={()=>go('/groups')}>{language==='mr'?'गट व चॅट उघडा →':'Open Groups & Chat →'}</button></div>}</div><div className="user-account-wrap" ref={accountRef}><button className="user-account" onClick={()=>{setMobileMenu(false);setMenu(v=>!v)}}><ProfileAvatar name={user?.name} size="sm"/><span className="user-account-text"><b>{user?.name||'Ward User'}</b><small>{ward?.wardNumber||'My Ward'}</small></span></button>{menu&&<div className="user-account-menu"><div className="user-menu-summary"><strong>{user?.name}</strong><span>{user?.email}</span><small>{ward?.wardNumber}{ward?.name?` · ${ward.name}`:''}</small></div><button onClick={()=>{setMenu(false);setProfile(true)}}>{text.profile}</button><button onClick={logout} className="danger-link">{text.logout}</button></div>}</div><button className="user-mobile-menu" onClick={()=>{setMenu(false);setMobileMenu(v=>!v)}} aria-label="Menu">☰</button></div>
  </header>
  <main className="user-main">
   {error&&<div className="user-error"><span>{error}</span><button onClick={load}>Retry</button></div>}
   {toast&&<div className={`global-toast ${toast.type==='error'?'global-toast-error':'global-toast-success'}`} role="status"><div><strong>{toast.title||'Update'}</strong><div>{toast.message}</div></div><button type="button" onClick={()=>setToast(null)} aria-label="Close">×</button></div>}
   <section className="user-hero"><div className="user-hero-copy"><span className="user-kicker">{text.welcome.toUpperCase()} · WARD DESK</span><h1>{text.welcome}, {user?.name?.split(' ')[0]||'Citizen'}.</h1><p>{text.desc}</p><div className="user-ward-chip"><span>⌖</span><div><small>{text.ward.toUpperCase()}</small><strong>{ward?.wardNumber||'Ward'}{ward?.name?` · ${ward.name}`:''}</strong></div></div><div className="user-hero-actions"><button type="button" className="primary-btn" onClick={()=>go('/my-complaints')}>{language==='mr'?'तक्रार नोंदवा':'Raise a complaint'}</button><button type="button" className="ghost-btn" onClick={()=>go('/ward-updates')}>{language==='mr'?'अपडेट्स पहा':'View updates'}</button></div></div><div className="user-hero-card"><div className="user-hero-icon">W</div><div><strong>{language==='mr'?'तुमच्या वॉर्डची सर्व माहिती':'Everything for your ward'}</strong><span>{language==='mr'?'नोंदणीकृत वॉर्ड खात्यातून अपडेट्स, योजना आणि तक्रारी ट्रॅक करा.':'Updates, schemes and complaint tracking in one secure account.'}</span></div></div></section>
   <section className="user-stat-grid"><button onClick={()=>go('/ward-updates')} className="user-stat-card"><span className="user-stat-icon">◈</span><div><small>{text.statUpdates}</small><strong>{updateTotal===null?'—':updateTotal}</strong><span>{text.publishedUpdates}</span></div></button><button onClick={()=>go('/my-complaints')} className="user-stat-card"><span className="user-stat-icon">⚑</span><div><small>{text.statComplaints}</small><strong>{complaintTotal===null?'—':complaintTotal}</strong><span>{text.myComplaints}</span></div></button><button onClick={()=>go('/schemes')} className="user-stat-card"><span className="user-stat-icon">◇</span><div><small>{text.statSchemes}</small><strong>{schemes===null?'—':schemes.length}</strong><span>{text.publishedSchemes}</span></div></button><button onClick={()=>setShowNotifications(true)} className="user-stat-card"><span className="user-stat-icon">🔔</span><div><small>{language==='mr'?'सूचना':'NOTIFICATIONS'}</small><strong>{unread}</strong><span>{language==='mr'?'न वाचलेल्या सूचना':'Unread notifications'}</span></div></button></section>
   <section className="user-panel-card ward-team-user-card"><div className="user-section-head"><div><span className="user-kicker">{text.ward.toUpperCase()}</span><h2>{snapshot?.ward?.number||team?.ward?.wardNumber||ward?.wardNumber}{snapshot?.ward?.name||team?.ward?.name?` · ${snapshot?.ward?.name||team?.ward?.name}`:''}</h2><p>{snapshot?.community?.name||(language==='mr'?'वॉर्ड समुदाय':'Ward Community')}{snapshot?.ward?.status?` · ${snapshot.ward.status}`:''}</p></div><button className="user-text-btn" onClick={()=>go('/groups')}>{language==='mr'?'समुदाय उघडा →':'Open community →'}</button></div><div className="ward-team-user-grid ward-team-user-grid-four">{(snapshot?.nagarsevaks?.length?snapshot.nagarsevaks:team?.nagarsevaks||[]).length?(snapshot?.nagarsevaks?.length?snapshot.nagarsevaks:team.nagarsevaks).map(n=><div className="ward-team-person" key={n.id}><FaceAvatar name={n.name} photo={n.photo}/><div><strong>{n.name}</strong><span>{n.partyName||(language==='mr'?'तुमचे नगरसेवक':'Your Nagarsevak')}</span><a href={n.mobile?`tel:${n.mobile}`:'#'} onClick={e=>{if(!n.mobile)e.preventDefault()}}>{n.mobile||'No mobile'}</a></div></div>):<div className="user-mini-empty user-nagar-empty"><strong>{language==='mr'?'तुमच्या वॉर्डची माहिती लवकरच दिसेल.':'Your ward representative will appear here soon.'}</strong><span>{language==='mr'?'तुमच्या वॉर्डसाठी नगरसेवक प्रोफाइल सध्या उपलब्ध नाही. समुदाय आणि वॉर्ड सेवा सुरू राहतील.':'Nagarsevak details for your ward are not available yet. You can still use ward updates, schemes and community services.'}</span></div>}</div></section>
   <section className="user-content-grid"><div className="user-panel-card user-updates-panel"><div className="user-section-head"><div><span className="user-kicker">{text.latest.toUpperCase()}</span><h2>{text.latest}</h2><p>{language==='mr'?`${ward?.wardNumber||'तुमच्या वॉर्ड'} साठी प्रकाशित माहिती`:`Published for residents of ${ward?.wardNumber||'your ward'}`}</p></div><button onClick={()=>go('/ward-updates')} className="user-text-btn">{language==='mr'?'सर्व पहा →':'View all →'}</button></div>{updates===null?<Loading/>:!updates.length?<div className="user-empty"><div>◌</div><strong>{text.noUpdates}</strong><span>{language==='mr'?'तुमच्या वॉर्ड टीमने अजून नवीन अपडेट किंवा कार्यक्रम प्रकाशित केलेला नाही.':'Your ward team has not published a new update or event.'}</span></div>:<div className="user-update-list">{updates.map(x=><button key={x.id} className="user-update-item" onClick={()=>go('/ward-updates')}><div className={`user-type-icon ${x.type==='EVENT'?'event':''}`}>{x.type==='EVENT'?'★':'◈'}</div><div className="user-update-body"><div className="user-item-top"><span>{typeLabel(x.type,language==='mr')}</span>{x.eventDate&&<time>{fmt(x.eventDate)}</time>}</div><h3>{x.title}</h3><p>{x.message}</p><small>{x.location?`${x.location} · `:''}{fmt(x.publishedAt||x.createdAt)}</small></div><span className="user-item-arrow">›</span></button>)}</div>}</div>
    <aside className="user-side-stack"><div className="user-panel-card"><div className="user-section-head compact"><div><span className="user-kicker">{text.benefits.toUpperCase()}</span><h2>{text.benefits}</h2></div><button onClick={()=>go('/schemes')} className="user-text-btn">{language==='mr'?'सर्व पहा →':'View all →'}</button></div>{schemes===null?<Loading/>:!schemes.length?<div className="user-mini-empty">{language==='mr'?'सध्या कोणतीही योजना उपलब्ध नाही.':'No published schemes are available right now.'}</div>:<div className="user-scheme-list">{schemes.map(s=><button key={s.id} onClick={()=>go('/schemes')} className="user-scheme-item"><span className="scheme-mini-icon">◇</span><div><strong>{s.title}</strong><small>{s.audience||'Eligible residents'} · {s.ward?.wardNumber||ward?.wardNumber||'Your ward'}</small></div><span>›</span></button>)}</div>}</div><div className="user-panel-card user-profile-card"><span className="user-kicker">{text.account.toUpperCase()}</span><div className="user-profile-identity"><ProfileAvatar name={user?.name} size="lg"/><div className="user-profile-facts"><strong>{user?.name||'Resident'}</strong><div className="user-profile-line"><span>{language==='mr'?'ईमेल':'Email'}</span><b>{user?.email||'—'}</b></div><div className="user-profile-line"><span>{language==='mr'?'मोबाईल':'Mobile'}</span><b>{user?.mobile||'—'}</b></div></div></div><div className="user-profile-ward"><span>{text.ward}</span><strong>{ward?.wardNumber||'—'}{ward?.name?` · ${ward.name}`:''}</strong></div><button className="user-secondary-btn" onClick={()=>setProfile(true)}>{text.profile}</button></div></aside></section>
  </main>
  {selectedNotification&&<Modal title={selectedNotification.title||'Notification'} onClose={()=>setSelectedNotification(null)}>
   <div className="notification-detail-body"><p>{selectedNotification.message||''}</p><small>{selectedNotification.sender?.name?`From ${selectedNotification.sender.name} · `:''}{selectedNotification.createdAt?new Date(selectedNotification.createdAt).toLocaleString('en-IN'):''}</small></div>
   <div className="modal-actions"><button type="button" className="primary-btn" onClick={()=>{const target=String(selectedNotification.actionUrl||'').trim();const type=String(selectedNotification.type||'');setSelectedNotification(null);if(target.startsWith('/'))go(target);else if(type.includes('COMPLAINT'))go('/my-complaints');else if(type.includes('SCHEME'))go('/schemes');else if(type.includes('WARD_UPDATE')||type.includes('WARD_EVENT'))go('/ward-updates');else go('/groups')}}>{language==='mr'?'संबंधित विभाग उघडा':'Open related section'}</button><button type="button" className="ghost-btn" onClick={()=>setSelectedNotification(null)}>{language==='mr'?'बंद करा':'Close'}</button></div>
  </Modal>}
  <footer className="user-footer"><span>© {new Date().getFullYear()} Kairo IT Solutions PVT LTD</span><span>{language==='mr'?'सुरक्षित वॉर्ड खाते':'Secure registered ward account'}</span></footer>
  {profile&&<UserProfileModal user={user} language={language} onClose={()=>setProfile(false)} onSaved={u=>{localStorage.setItem('ward_user',JSON.stringify({...user,...u}));setProfile(false);window.location.reload()}}/>}
 </div>;
}
function UserProfileModal({user,language,onClose,onSaved}){
 const mr=language==='mr';
 const [form,setForm]=useState({name:user?.name||'',email:user?.email||'',mobile:user?.mobile||'',password:'',confirmPassword:''}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(e){
  e.preventDefault();setBusy(true);setError('');
  try{
   if(form.password&&form.password!==form.confirmPassword) throw new Error(mr?'पासवर्ड जुळत नाही.':'Passwords do not match.');
   const r=await api.updateProfile({name:form.name.trim(),email:form.email.trim(),mobile:form.mobile.replace(/\D/g,'')});
   if(form.password) await api.changePassword({password:form.password,confirmPassword:form.confirmPassword});
   onSaved(r.data);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return (
  <Modal wide title={mr?'माझे प्रोफाइल':'My profile'} onClose={onClose}>
   <form className="form-grid profile-edit-grid" onSubmit={save}>
    {error&&<div className="error-inline span-2">{error}</div>}
    <div className="profile-hero span-2">
     <FaceAvatar name={form.name||user?.name} photo={user?.photo} className="profile-hero-face"/>
     <div className="profile-hero-copy">
      <strong>{form.name||user?.name||'—'}</strong>
      <span>{mr?'निवासी':'Resident'}</span>
      <small>{form.email||user?.email||'—'}</small>
     </div>
    </div>
    <div className="profile-section span-2">
     <span className="profile-section-label">{mr?'वैयक्तिक माहिती':'Personal details'}</span>
     <div className="form-grid profile-fields">
      <Field label={mr?'पूर्ण नाव':'Full name'}><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
      <Field label={mr?'ईमेल':'Email'}><input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field>
      <Field label={mr?'मोबाईल':'Mobile'}><input required maxLength="10" inputMode="numeric" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value.replace(/\D/g,'').slice(0,10)})}/></Field>
     </div>
    </div>
    <div className="detail-card span-2 profile-access-card">
     <h3>{mr?'नोंदणीकृत वॉर्ड':'Registered ward'}</h3>
     <p><b>{mr?'वॉर्ड':'Ward'}</b> {user?.ward?.wardNumber||'—'}{user?.ward?.name?` · ${user.ward.name}`:''}</p>
     <p><b>{mr?'खाते':'Account'}</b> {mr?'निवासी':'Resident'}</p>
     <small>{mr?'वॉर्ड बदलण्यासाठी प्रशासनाशी संपर्क करा.':'Contact administration to change your registered ward.'}</small>
    </div>
    <div className="span-2 password-change-box">
     <div><strong>{mr?'सुरक्षा':'Security'}</strong><span>{mr?'सध्याचा पासवर्ड ठेवण्यासाठी रिकामा ठेवा.':'Leave blank to keep your current password.'}</span></div>
     <div className="form-grid password-change-grid">
      <Field label={mr?'नवीन पासवर्ड':'New password'}><input type="password" minLength="8" autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></Field>
      <Field label={mr?'पुन्हा पासवर्ड':'Confirm password'}><input type="password" minLength="8" autoComplete="new-password" value={form.confirmPassword} onChange={e=>setForm({...form,confirmPassword:e.target.value})}/></Field>
     </div>
    </div>
    <div className="modal-actions span-2">
     <button type="button" className="ghost-btn" onClick={onClose}>{mr?'रद्द':'Cancel'}</button>
     <button className="primary-btn" disabled={busy}>{busy?(mr?'सेव्ह होत आहे…':'Saving…'):(mr?'सेव्ह करा':'Save changes')}</button>
    </div>
   </form>
  </Modal>
 );
}
