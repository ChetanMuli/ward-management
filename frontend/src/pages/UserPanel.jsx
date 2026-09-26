import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api,getUser} from '../services/api';
import {Loading,FaceAvatar} from '../components/Ui';
import BrandIcon from '../components/BrandIcon';

function typeLabel(v,mr){return mr?(v==='EVENT'?'कार्यक्रम':'वॉर्ड अपडेट'):(v==='EVENT'?'Event':'Ward update');}
function fmt(v){return v?new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—';}
function residentNagarsevaks(snapshot,team){
  const rows=snapshot?.nagarsevaks?.length?snapshot.nagarsevaks:(team?.nagarsevaks||[]);
  return (Array.isArray(rows)?rows:[]).filter(n=>n&&n.id&&!n.employeeProfile&&!n.designation);
}

export default function UserPanel(){
 const navigate=useNavigate(),user=getUser(),mr=(localStorage.getItem('ward_language')||'en')==='mr';
 const [language]=useState(mr?'mr':'en'),[updates,setUpdates]=useState(null),[updateTotal,setUpdateTotal]=useState(null),[schemes,setSchemes]=useState(null),[messages,setMessages]=useState(null),[complaints,setComplaints]=useState(null),[complaintTotal,setComplaintTotal]=useState(null),[team,setTeam]=useState(null),[snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[toast,setToast]=useState(null);
 const seenNotes=useRef(new Set()),primedNotes=useRef(false);
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
 const go=p=>navigate(p);
 return <>
   {error&&<div className="user-error"><span>{error}</span><button onClick={load}>Retry</button></div>}
   {toast&&<div className={`global-toast ${toast.type==='error'?'global-toast-error':'global-toast-success'}`} role="status"><div><strong>{toast.title||'Update'}</strong><div>{toast.message}</div></div><button type="button" onClick={()=>setToast(null)} aria-label="Close">×</button></div>}
   <section className="user-hero"><div className="user-hero-copy"><span className="user-kicker">{text.welcome.toUpperCase()} · WARD DESK</span><h1>{text.welcome}, {user?.name?.split(' ')[0]||'Citizen'}.</h1><p>{text.desc}</p><div className="user-ward-chip"><span>⌖</span><div><small>{text.ward.toUpperCase()}</small><strong>{ward?.wardNumber||'Ward'}{ward?.name?` · ${ward.name}`:''}</strong></div></div><div className="user-hero-actions"><button type="button" className="primary-btn" onClick={()=>go('/my-complaints')}>{language==='mr'?'तक्रार नोंदवा':'Raise a complaint'}</button><button type="button" className="ghost-btn" onClick={()=>go('/ward-updates')}>{language==='mr'?'अपडेट्स पहा':'View updates'}</button></div></div><div className="user-hero-card"><div className="user-hero-icon"><BrandIcon size={34} variant="light" /></div><div><strong>{language==='mr'?'तुमच्या वॉर्डची सर्व माहिती':'Everything for your ward'}</strong><span>{language==='mr'?'नोंदणीकृत वॉर्ड खात्यातून अपडेट्स, योजना आणि तक्रारी ट्रॅक करा.':'Updates, schemes and complaint tracking in one secure account.'}</span></div></div></section>
   <section className="user-stat-grid"><button onClick={()=>go('/ward-updates')} className="user-stat-card"><span className="user-stat-icon">◈</span><div><small>{text.statUpdates}</small><strong>{updateTotal===null?'—':updateTotal}</strong><span>{text.publishedUpdates}</span></div></button><button onClick={()=>go('/my-complaints')} className="user-stat-card"><span className="user-stat-icon">⚑</span><div><small>{text.statComplaints}</small><strong>{complaintTotal===null?'—':complaintTotal}</strong><span>{text.myComplaints}</span></div></button><button onClick={()=>go('/schemes')} className="user-stat-card"><span className="user-stat-icon">◇</span><div><small>{text.statSchemes}</small><strong>{schemes===null?'—':schemes.length}</strong><span>{text.publishedSchemes}</span></div></button><button onClick={()=>window.dispatchEvent(new CustomEvent('ward:open-notifications'))} className="user-stat-card"><span className="user-stat-icon">🔔</span><div><small>{language==='mr'?'सूचना':'NOTIFICATIONS'}</small><strong>{unread}</strong><span>{language==='mr'?'न वाचलेल्या सूचना':'Unread notifications'}</span></div></button></section>
   <section className="user-panel-card ward-team-user-card"><div className="user-section-head"><div><span className="user-kicker">{text.nagarsevak.toUpperCase()}</span><h2>{snapshot?.ward?.number||team?.ward?.wardNumber||ward?.wardNumber}{snapshot?.ward?.name||team?.ward?.name?` · ${snapshot?.ward?.name||team?.ward?.name}`:''}</h2><p>{snapshot?.community?.name||(language==='mr'?'वॉर्ड समुदाय':'Ward Community')}{snapshot?.ward?.status?` · ${snapshot.ward.status}`:''}</p></div><button className="user-text-btn" onClick={()=>go('/groups')}>{language==='mr'?'समुदाय उघडा →':'Open community →'}</button></div><div className="ward-team-user-grid ward-team-user-grid-four">{residentNagarsevaks(snapshot,team).length?residentNagarsevaks(snapshot,team).map(n=><div className="ward-team-person" key={n.id}><FaceAvatar name={n.name} photo={n.photo}/><div><strong>{n.name}</strong><span>{n.partyName||(language==='mr'?'तुमचे नगरसेवक':'Your Nagarsevak')}</span><a href={n.mobile?`tel:${n.mobile}`:'#'} onClick={e=>{if(!n.mobile)e.preventDefault()}}>{n.mobile||'No mobile'}</a></div></div>):<div className="user-mini-empty user-nagar-empty"><strong>{language==='mr'?'तुमच्या वॉर्डची माहिती लवकरच दिसेल.':'Your ward representative will appear here soon.'}</strong><span>{language==='mr'?'तुमच्या वॉर्डसाठी नगरसेवक प्रोफाइल सध्या उपलब्ध नाही. समुदाय आणि वॉर्ड सेवा सुरू राहतील.':'Nagarsevak details for your ward are not available yet. You can still use ward updates, schemes and community services.'}</span></div>}</div></section>
   <section className="user-content-grid"><div className="user-panel-card user-updates-panel"><div className="user-section-head"><div><span className="user-kicker">{text.latest.toUpperCase()}</span><h2>{text.latest}</h2><p>{language==='mr'?`${ward?.wardNumber||'तुमच्या वॉर्ड'} साठी प्रकाशित माहिती`:`Published for residents of ${ward?.wardNumber||'your ward'}`}</p></div><button onClick={()=>go('/ward-updates')} className="user-text-btn">{language==='mr'?'सर्व पहा →':'View all →'}</button></div>{updates===null?<Loading/>:!updates.length?<div className="user-empty"><div>◌</div><strong>{text.noUpdates}</strong><span>{language==='mr'?'तुमच्या वॉर्ड टीमने अजून नवीन अपडेट किंवा कार्यक्रम प्रकाशित केलेला नाही.':'Your ward team has not published a new update or event.'}</span></div>:<div className="user-update-list">{updates.map(x=><button key={x.id} className="user-update-item" onClick={()=>go('/ward-updates')}><div className={`user-type-icon ${x.type==='EVENT'?'event':''}`}>{x.type==='EVENT'?'★':'◈'}</div><div className="user-update-body"><div className="user-item-top"><span>{typeLabel(x.type,language==='mr')}</span>{x.eventDate&&<time>{fmt(x.eventDate)}</time>}</div><h3>{x.title}</h3><p>{x.message}</p><small>{x.location?`${x.location} · `:''}{fmt(x.publishedAt||x.createdAt)}</small></div><span className="user-item-arrow">›</span></button>)}</div>}</div>
    <aside className="user-side-stack"><div className="user-panel-card"><div className="user-section-head compact"><div><span className="user-kicker">{text.benefits.toUpperCase()}</span><h2>{text.benefits}</h2></div><button onClick={()=>go('/schemes')} className="user-text-btn">{language==='mr'?'सर्व पहा →':'View all →'}</button></div>{schemes===null?<Loading/>:!schemes.length?<div className="user-mini-empty">{language==='mr'?'सध्या कोणतीही योजना उपलब्ध नाही.':'No published schemes are available right now.'}</div>:<div className="user-scheme-list">{schemes.map(s=><button key={s.id} onClick={()=>go('/schemes')} className="user-scheme-item"><span className="scheme-mini-icon">◇</span><div><strong>{s.title}</strong><small>{s.audience||'Eligible residents'} · {s.ward?.wardNumber||ward?.wardNumber||'Your ward'}</small></div><span>›</span></button>)}</div>}</div></aside></section>
  </>
}
