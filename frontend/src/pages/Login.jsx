import React,{useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api,getUser,setSession} from '../services/api';
import BrandIcon from '../components/BrandIcon';
import {switchLanguage, initLanguage, ensureCurrentLanguage, getLanguage} from '../language';

export const COMPANY_NAME='Kairo IT Solutions PVT LTD';
export const COMPANY_EMAIL='chetan.a2zithub@gmail.com';
export const COMPANY_MOBILE='8523697410';
export const copyrightLine=`© ${new Date().getFullYear()} ${COMPANY_NAME}`;

function AuthError({error}){
 if(!error) return null;
 const isMr=getLanguage()==='mr';
 const lines=String(error).split('\n').map(v=>v.trim()).filter(Boolean);
 const panelOff=/deactivated|panel is not active|not open yet/i.test(error);
 return (
  <div className={`error-box ${panelOff?'login-panel-off':''}`}>
   {lines.map((line,i)=><p key={i}>{line}</p>)}
   {panelOff&&<CompanyContact isMr={isMr}/>}
  </div>
 );
}

function IconMail(){
 return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.4" y="5.6" width="17.2" height="12.8" rx="2.2"/><path d="m4.2 7.4 7.8 5.4 7.8-5.4"/></svg>;
}
function IconLock(){
 return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5.2" y="10.4" width="13.6" height="9.2" rx="2"/><path d="M8.2 10.4V8.2a3.8 3.8 0 0 1 7.6 0v2.2"/></svg>;
}
function IconEye({off}){
 return off
  ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.2 12s3.4-6.2 8.8-6.2S20.8 12 20.8 12 17.4 18.2 12 18.2 3.2 12 3.2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>
  : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 5 16 14"/><path d="M9.9 9.7A3 3 0 0 0 12 15a3 3 0 0 0 2.9-2.1"/><path d="M6.6 7.4C4.6 8.8 3.2 12 3.2 12s3.4 6.2 8.8 6.2c1.5 0 2.9-.4 4.1-1"/><path d="M17.5 14.8c1.8-1.3 3.3-3.4 3.3-2.8 0 0-3.4-6.2-8.8-6.2-.7 0-1.4.1-2 .2"/></svg>;
}

function strokeProps(){
 return {viewBox:'0 0 24 24',width:'16',height:'16',fill:'none',stroke:'currentColor',strokeWidth:'1.8',strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':'true'};
}
function AppGlyph({name}){
 const p=strokeProps();
 if(name==='complaints') return <svg {...p}><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4.4V3.6h6v.8M8.5 10h7M8.5 13.5h7M8.5 17h4.5"/></svg>;
 if(name==='schemes') return <svg {...p}><path d="M4.5 10.2 12 5.5l7.5 4.7V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19Z"/><path d="M9.5 20.5v-6h5v6"/></svg>;
 if(name==='messages') return <svg {...p}><path d="M4.5 6.5h11A1.5 1.5 0 0 1 17 8v6.2l-3.4-2H4.5A1.5 1.5 0 0 1 3 10.7V8a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M8.2 14.8h8.4L21 18.2V11.4A1.4 1.4 0 0 0 19.6 10H17"/></svg>;
 if(name==='notices') return <svg {...p}><path d="M5 9.2h3.1L14.2 5v14l-6.1-4.2H5V9.2Z"/><path d="M17.4 9.3a3.4 3.4 0 0 1 0 5.4M19.6 7.4a6 6 0 0 1 0 9.2"/></svg>;
 if(name==='wards') return <svg {...p}><path d="M12 21s-6.2-5.4-6.2-10.1a6.2 6.2 0 1 1 12.4 0C18.2 15.6 12 21 12 21Z"/><circle cx="12" cy="10.6" r="2.2"/></svg>;
 if(name==='houses') return <svg {...p}><path d="M4.8 11.2 12 5.2l7.2 6V19.5A1.3 1.3 0 0 1 17.9 20.8H6.1A1.3 1.3 0 0 1 4.8 19.5Z"/><path d="M10 20.8v-6h4v6"/></svg>;
 if(name==='families') return <svg {...p}><circle cx="9" cy="8" r="2.4"/><circle cx="16.2" cy="8.6" r="2"/><path d="M3.8 18.8v-.8c0-1.8 2.1-3.2 5.2-3.2 1 0 1.9.2 2.6.5"/><path d="M12.8 18.8v-.7c0-1.5 1.4-2.7 3.8-2.7s3.8 1.2 3.8 2.7v.7"/></svg>;
 return <svg {...p}><path d="M7 4.5h8.2L20 9.3V19.5H7Z"/><path d="M15.2 4.5V9.3H20M9.4 12h7.2M9.4 15.2h7.2M9.4 18.4h4.6"/></svg>;
}
const RESIDENT_APPS=[
 {cls:'auth-logo-complaints',en:'Complaints',mr:'तक्रारी',icon:'complaints'},
 {cls:'auth-logo-schemes',en:'Schemes',mr:'योजना',icon:'schemes'},
 {cls:'auth-logo-messages',en:'Messages',mr:'संदेश',icon:'messages'},
 {cls:'auth-logo-notices',en:'Notices',mr:'सूचना',icon:'notices'}
];
const ADMIN_APPS=[
 {cls:'auth-logo-wards',en:'Wards',mr:'वॉर्ड',icon:'wards'},
 {cls:'auth-logo-houses',en:'Houses',mr:'घरे',icon:'houses'},
 {cls:'auth-logo-families',en:'Families',mr:'कुटुंबे',icon:'families'},
 {cls:'auth-logo-reports',en:'Reports',mr:'अहवाल',icon:'reports'}
];
function AuthApps({admin,isMr}){
 const items=admin?ADMIN_APPS:RESIDENT_APPS;
 return <div className="auth-simple-apps" aria-hidden="true">
  {items.map(item=>(
   <span key={item.en} className="auth-app">
    <span className={`auth-app-logo ${item.cls}`}><AppGlyph name={item.icon}/></span>
    <em>{isMr?item.mr:item.en}</em>
   </span>
  ))}
 </div>;
}

function CompanyContact({isMr}){
 return (
  <div className="auth-company-contact">
   <div><span>{isMr?'ईमेल':'Email'}</span><a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a></div>
   <div><span>{isMr?'मोबाईल':'Mobile'}</span><a href={`tel:${COMPANY_MOBILE}`}>{COMPANY_MOBILE}</a></div>
  </div>
 );
}

function SupportNote({isMr}){
 return <div className="auth-support-note">
  <p>{isMr?'जर तुम्हाला ईमेलद्वारे कोड मिळाला नाही, तर समर्थनाशी संपर्क साधा.':'If you do not receive the code by email, contact support.'}</p>
  <CompanyContact isMr={isMr}/>
 </div>;
}

function AuthAbout({admin,isMr}){
 return <p className="auth-about">
  {admin
   ? <><span>{isMr?'वॉर्ड नोंदी आणि क्षेत्रीय कामांसाठी प्रशासकीय कार्यक्षेत्र.':'The municipal workspace for ward records and field work.'}</span><span>{isMr?'या डेस्कवरून घरे, कुटुंबे, तक्रारी आणि अहवाल व्यवस्थापित करा.':'Manage houses, families, complaints and reports from this desk.'}</span></>
   : <><span>{isMr?'तक्रारी, योजना आणि सूचनांसाठी डिजिटल वॉर्ड डेस्क.':'The digital ward desk for complaints, schemes and notices.'}</span><span>{isMr?'एका खात्यातून तुमच्या स्थानिक वॉर्ड कार्यालयाशी जोडलेले रहा.':'Stay connected to your local ward office from one account.'}</span></>}
 </p>;
}

export function AuthShell({admin,title,lead,pageLabel,register,children}){
 const currentLang=getLanguage();
 const isMr=currentLang==='mr';
 const defaultLabel=admin
  ? (isMr?'प्रशासकीय लॉगिन':'Admin login')
  : (register?(isMr?'नागरिक नोंदणी':'Resident registration'):(isMr?'नागरिक लॉगिन':'Resident login'));
 const label=pageLabel||defaultLabel;

 useEffect(()=>{
  document.title=`${label} · WardDesk`;
  initLanguage();
  ensureCurrentLanguage();
 },[label]);

 const footText=isMr
  ? `© ${new Date().getFullYear()} ${COMPANY_NAME} · सर्व हक्क राखीव`
  : copyrightLine;

 return <div className={`login-page-v2 auth-simple ${admin?'admin-login':'citizen-login'}${register?' register-page':''}`} data-auth={admin?'admin-login':(register?'user-register':'user-login')}>
  <button type="button" className="language-btn login-language-btn notranslate" translate="no" onClick={()=>switchLanguage(currentLang==='en'?'mr':'en')} title={isMr?'Change to English':'मराठी मध्ये बदला'}>
   {currentLang==='en'?'मराठी':'English'}
  </button>
  <div className="auth-blob auth-blob-c" aria-hidden="true"/>
  <div className="auth-blob auth-blob-d" aria-hidden="true"/>
  <div className="auth-simple-wrap">
   <div className="auth-blob auth-blob-a" aria-hidden="true"/>
   <div className="auth-blob auth-blob-b" aria-hidden="true"/>
   <div className="auth-simple-logo">
    <span className="brand-mark notranslate" translate="no"><BrandIcon size={34} variant="light" /></span>
    <strong className="notranslate" translate="no">WardDesk</strong>
   </div>
   <p className="auth-page-tag">{label}</p>
   <h1>{title}</h1>
   {lead?<p className="auth-simple-lead">{lead}</p>:null}
   <div className="auth-card-stack">
    {children}
    <AuthApps admin={admin} isMr={isMr}/>
   </div>
   <AuthAbout admin={admin} isMr={isMr}/>
   <p className="auth-simple-foot">{footText}</p>
  </div>
 </div>;
}

function PasswordField({label,value,onChange,placeholder,autoComplete='current-password',show,onToggle,required=true}){
 return <label>{label}
  <span className="auth-input">
   <span className="auth-ico"><IconLock/></span>
   <span className="auth-split" aria-hidden="true"/>
   <input type={show?'text':'password'} autoComplete={autoComplete} value={value} onChange={e=>onChange(e.target.value)} required={required} placeholder={placeholder}/>
   <button type="button" className="auth-eye" onClick={onToggle} aria-label={show?'Hide password':'Show password'}>
    <IconEye off={show}/>
   </button>
  </span>
 </label>;
}

export default function Login({mode='user'}){
 const admin=mode==='admin';
 const currentLang=getLanguage();
 const isMr=currentLang==='mr';
 const [identifier,setIdentifier]=useState('');
 const [emailId,setEmailId]=useState('');
 const [password,setPassword]=useState('');
 const [showPassword,setShowPassword]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [view,setView]=useState('login');
 const [otp,setOtp]=useState('');
 const [newPassword,setNewPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [showNew,setShowNew]=useState(false);
 const [showConfirm,setShowConfirm]=useState(false);
 const [debugOtp,setDebugOtp]=useState('');
 const [sentTo,setSentTo]=useState('');
 const [mailFailed,setMailFailed]=useState(false);
 const navigate=useNavigate();
 const forgotValue=emailId;

 useEffect(()=>{
  initLanguage();
  ensureCurrentLanguage();
 },[]);

 useEffect(()=>{
  const u=getUser();
  if(!u) return;
  const dest=String(u.role||'').toUpperCase()==='CITIZEN'?'/':'/dashboard';
  window.location.replace(dest);
 },[admin]);

 useEffect(()=>{
  if(sessionStorage.getItem('ward_session_expired')==='1'){
   sessionStorage.removeItem('ward_session_expired');
   setNotice(isMr?'तुमचे मागील सत्र कालबाह्य झाले आहे. कृपया पुन्हा साइन इन करा.':'Your previous session expired. Please sign in again.');
  }
 },[isMr]);

 function goLogin(){
  setError('');
  setNotice('');
  setDebugOtp('');
  setSentTo('');
  setOtp('');
  setNewPassword('');
  setConfirmPassword('');
  setMailFailed(false);
  setView('login');
 }

 function openForgot(){
  setError('');
  setNotice('');
  setOtp('');
  setNewPassword('');
  setConfirmPassword('');
  setDebugOtp('');
  setSentTo('');
  setMailFailed(false);
  const raw=identifier.trim();
  setEmailId(raw.includes('@')?raw:'');
  setView(admin?'staff-help':'forgot');
 }

 async function submit(e){
  e.preventDefault();
  setError('');
  setBusy(true);
  try{
   const result=await api.login(identifier.trim(),password);
   const role=String(result.data.user?.role||'').toUpperCase();
   const citizen=role==='CITIZEN';
   if(!admin&&!citizen) throw new Error(isMr?'हे प्रशासकीय खाते आहे. /admin वर साइन इन करा.':'This is an administration account. Sign in at /admin.');
   if(admin&&citizen) throw new Error(isMr?'हे नागरिक खाते आहे. /login वर साइन इन करा.':'This is a resident account. Sign in at /login.');
   setSession(result.data.token,result.data.user);
   const dest=admin?'/dashboard':'/';
   try{window.history.replaceState({wardSignedIn:1},'',dest);}catch{}
   window.location.replace(dest);
   return;
  }catch(e){
   setError(e.message||(isMr?'साइन इन करण्यात अडचण आली.':'Unable to sign in.'));
  }finally{
   setBusy(false);
  }
 }

 async function requestCode(e){
  e.preventDefault();
  setError('');
  setMailFailed(false);
  const value=String(forgotValue||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){
   setError(isMr?'तुमचा नोंदणीकृत ईमेल पत्ता टाका.':'Enter your registered email address.');
   return;
  }
  setBusy(true);
  try{
   const result=await api.forgotRequest({identifier:value,channel:'email',audience:'citizen'});
   if(result.data?.mailFailed || result.data?.requiresSupport){
    setMailFailed(true);
    setError(result.message||(isMr?'आम्ही तुमच्या ईमेलवर पडताळणी कोड पाठवू शकलो नाही.':'We could not send a verification code to your email.'));
    return;
   }
   setNotice(result.data?.destination
    ? (isMr?`आम्ही ${result.data.destination} वर ६-अंकी कोड पाठवला आहे.`:`We sent a 6-digit code to ${result.data.destination}.`)
    : (result.message||(isMr?'खाते अस्तित्वात असल्यास, आम्ही पडताळणी कोड पाठवला आहे.':'If an account exists, we sent a verification code.')));
   setSentTo(result.data?.destination||'');
   setDebugOtp(result.data?.debugOtp||'');
   setOtp(result.data?.debugOtp||'');
   setView('reset');
  }catch(e){
   setMailFailed(true);
   setError(e.message||(isMr?'ईमेलद्वारे पडताळणी कोड पाठवण्यात अक्षम.':'Unable to send a verification code by email.'));
  }finally{
   setBusy(false);
  }
 }

 async function resetPassword(e){
  e.preventDefault();
  setError('');
  if(newPassword!==confirmPassword) return setError(isMr?'नवीन पासवर्ड आणि कन्फर्म पासवर्ड जुळत नाहीत.':'Password and confirm password do not match.');
  setBusy(true);
  try{
   await api.forgotReset({identifier:String(forgotValue||'').trim(),otp:otp.trim(),password:newPassword,confirmPassword,channel:'email'});
   setPassword('');
   setOtp('');
   setNewPassword('');
   setConfirmPassword('');
   setDebugOtp('');
   setNotice(isMr?'पासवर्ड अपडेट केला. तुम्ही आता साइन इन करू शकता.':'Password updated. You can now sign in.');
   setView('login');
  }catch(e){
   setError(e.message||(isMr?'पासवर्ड अपडेट करण्यात अक्षम.':'Unable to update password.'));
  }finally{
   setBusy(false);
  }
 }

 if(view==='support'){
  return <AuthShell admin={admin} pageLabel={admin?(isMr?'प्रशासकीय मदत':'Admin support'):(isMr?'नागरिक मदत':'Resident support')} title={isMr?'मदत व सहाय्य':'Support'}>
   <div className="login-v2-card auth-simple-card">
    <p className="auth-staff-copy">{isMr?'तुम्हाला काही अडचण असल्यास, आमच्याशी संपर्क साधा.':'If you have any problem, contact us.'}</p>
    <CompanyContact isMr={isMr}/>
    <button type="button" className="primary-btn full login-v2-submit" onClick={goLogin}>{isMr?'साइन इन वर परत जा':'Back to sign in'}</button>
   </div>
  </AuthShell>;
 }

 if(view==='staff-help'){
  return <AuthShell admin={true} title={isMr?'पासवर्ड विसरलात':'Forgot password'} lead={isMr?'कर्मचाऱ्यांचे पासवर्ड आमच्या टीमद्वारे पुनर्संचयित केले जातात':'Staff passwords are restored by our team'}>
   <div className="login-v2-card auth-simple-card">
    <p className="auth-staff-copy">{isMr?'नगरसेवक, कर्मचारी, सब मास्टर अ‍ॅडमिन आणि मास्टर अ‍ॅडमिनचे पासवर्ड या स्क्रीनवरून रीसेट करता येत नाहीत.':'Nagarsevak, Employee, Sub Master Admin and Master Admin passwords cannot be reset from this screen.'}</p>
    <p className="auth-staff-copy">{isMr?<>कृपया <strong>{COMPANY_NAME}</strong> शी संपर्क साधा. आम्ही तुमचे खाते सत्यापित करू आणि नवीन पासवर्ड जारी करू.</>:<>Please contact <strong>{COMPANY_NAME}</strong>. We will verify your account and issue a new password.</>}</p>
    <CompanyContact isMr={isMr}/>
    <button type="button" className="primary-btn full login-v2-submit" onClick={goLogin}>{isMr?'साइन इन वर परत जा':'Back to sign in'}</button>
   </div>
  </AuthShell>;
 }

 if(view==='forgot'){
  return <AuthShell admin={false} title={isMr?'पासवर्ड विसरलात':'Forgot password'} lead={isMr?'आम्ही तुमच्या नोंदणीकृत ईमेलवर ६-अंकी कोड पाठवू':'We will send a 6-digit code to your registered email'}>
   <form onSubmit={requestCode} className="login-v2-card auth-simple-card">
    {error&&<AuthError error={error}/>}
    <label>{isMr?'नोंदणीकृत ईमेल':'Registered email'}
     <span className="auth-input">
      <span className="auth-ico"><IconMail/></span>
      <span className="auth-split" aria-hidden="true"/>
      <input type="email" inputMode="email" autoComplete="email" value={emailId} onChange={e=>setEmailId(e.target.value)} required placeholder="you@example.com"/>
     </span>
    </label>
    <button type="submit" className="primary-btn full login-v2-submit" disabled={busy}>{busy?(isMr?'कोड पाठवत आहे…':'Sending code…'):(isMr?'सत्यापन कोड पाठवा':'Send verification code')}</button>
    <SupportNote isMr={isMr}/>
    <div className="auth-simple-links auth-flow-links auth-link-center">
     <button type="button" className="link-btn" onClick={goLogin}>{isMr?'साइन इन वर परत जा':'Back to sign in'}</button>
    </div>
   </form>
  </AuthShell>;
 }

 if(view==='reset'){
  return <AuthShell admin={false} title={isMr?'सत्यापित करा आणि पासवर्ड बदला':'Verify and reset'} lead={sentTo?(isMr?`${sentTo} वर पाठवलेला ६-अंकी कोड टाका`:`Enter the 6-digit code sent to ${sentTo}`):(isMr?'६-अंकी कोड टाका आणि नवीन पासवर्ड निवडा':'Enter the 6-digit code and choose a new password')}>
   <form onSubmit={resetPassword} className="login-v2-card auth-simple-card">
    {notice&&<div className="info-note login-session-notice">{notice}</div>}
    {debugOtp&&<button type="button" className="auth-demo-code" onClick={()=>setOtp(debugOtp)}>
     <span>{isMr?'डेमो कोड':'Demo code'}</span>
     <strong>{debugOtp}</strong>
     <small>{isMr?'भरण्यासाठी टॅप करा':'Tap to fill'}</small>
    </button>}
    {error&&<AuthError error={error}/>}
    <label>{isMr?'सत्यापन कोड':'Verification code'}
     <span className="auth-input auth-otp-input">
      <input type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} required placeholder="••••••" maxLength="6"/>
     </span>
    </label>
    <PasswordField label={isMr?'नवीन पासवर्ड':'New password'} value={newPassword} onChange={setNewPassword} placeholder={isMr?'किमान ८ अक्षरे':'At least 8 characters'} autoComplete="new-password" show={showNew} onToggle={()=>setShowNew(v=>!v)}/>
    <PasswordField label={isMr?'पासवर्ड पुष्टी करा':'Confirm password'} value={confirmPassword} onChange={setConfirmPassword} placeholder={isMr?'पासवर्ड पुन्हा टाका':'Re-enter password'} autoComplete="new-password" show={showConfirm} onToggle={()=>setShowConfirm(v=>!v)}/>
    <button type="submit" className="primary-btn full login-v2-submit" disabled={busy}>{busy?(isMr?'अपडेट करत आहे…':'Updating…'):(isMr?'पासवर्ड बदला':'Update password')}</button>
    <SupportNote isMr={isMr}/>
    <div className="auth-simple-links auth-login-links is-admin">
     <button type="button" className="link-btn" onClick={()=>setView('forgot')}>{isMr?'कोड पुन्हा पाठवा':'Resend code'}</button>
     <button type="button" className="link-btn" onClick={goLogin}>{isMr?'साइन इन वर परत जा':'Back to sign in'}</button>
    </div>
   </form>
  </AuthShell>;
 }

 return <AuthShell admin={admin} title={isMr?'पुन्हा स्वागत आहे':'Good to see you again'} lead={admin?(isMr?'मास्टर अ‍ॅडमिन, नगरसेवक आणि कर्मचाऱ्यांसाठी प्रशासकीय कार्यक्षेत्र':'Staff workspace for Master Admin, Nagarsevak and Employees'):(isMr?'तुमच्या नोंदणीकृत वॉर्ड खात्यात प्रवेश करा':'Access your registered ward account')}>
  <form onSubmit={submit} className="login-v2-card auth-simple-card">
   {notice&&<div className="info-note login-session-notice">{notice}</div>}
   {error&&<AuthError error={error}/>}
   <label>{isMr?'तुमचा ईमेल किंवा मोबाईल':'Your email or mobile'}
    <span className="auth-input">
     <span className="auth-ico"><IconMail/></span>
     <span className="auth-split" aria-hidden="true"/>
     <input type="text" inputMode="email" autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} required placeholder={isMr?'उदा. you@example.com किंवा 10-अंकी मोबाईल':'e.g. you@example.com'}/>
    </span>
   </label>
   <PasswordField label={isMr?'तुमचा पासवर्ड':'Your password'} value={password} onChange={setPassword} placeholder={isMr?'तुमचा पासवर्ड टाका':'Enter your password'} show={showPassword} onToggle={()=>setShowPassword(v=>!v)}/>
   <button type="submit" className="primary-btn full login-v2-submit" disabled={busy}>
    {busy?(isMr?'साइन इन करत आहे…':'Signing in…'):(isMr?'साइन इन करा':'Sign in')}
   </button>
   <div className={`auth-login-actions ${admin?'is-admin':'is-resident'}`}>
    {!admin&&<>
     <button type="button" className="link-btn" onClick={()=>navigate('/register')}>{isMr?'नवीन खाते तयार करा':'Create account'}</button>
     <span className="auth-link-sep" aria-hidden="true">|</span>
    </>}
    <button type="button" className="link-btn" onClick={()=>{setError('');setNotice('');setView('support');}}>{isMr?'मदत व सहाय्य':'Support'}</button>
    <span className="auth-link-sep" aria-hidden="true">|</span>
    <button type="button" className="link-btn" onClick={openForgot}>{isMr?'पासवर्ड विसरलात?':'Forgot password?'}</button>
   </div>
  </form>
 </AuthShell>;
}
