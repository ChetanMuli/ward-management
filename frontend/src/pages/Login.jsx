import React,{useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api,getUser,setSession} from '../services/api';

export const COMPANY_NAME='Kairo IT Solutions PVT LTD';
export const COMPANY_EMAIL='chetan.a2zithub@gmail.com';
export const COMPANY_MOBILE='8523697410';
export const copyrightLine=`© ${new Date().getFullYear()} ${COMPANY_NAME}`;

function IconUser(){
 return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-3.6 0-8.25 1.8-8.25 5.25V21h16.5v-1.5c0-3.45-4.65-5.25-8.25-5.25Z"/></svg>;
}
function IconPhone(){
 return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7.2 3.75h2.1c.5 0 .93.33 1.08.81l.9 2.85a1.13 1.13 0 0 1-.27 1.14l-1.32 1.32a12.3 12.3 0 0 0 5.52 5.52l1.32-1.32a1.13 1.13 0 0 1 1.14-.27l2.85.9c.48.15.81.58.81 1.08v2.1c0 .62-.5 1.12-1.12 1.12C10.86 20 4 13.14 4 4.87 4 4.25 4.5 3.75 5.12 3.75Z"/></svg>;
}
function IconLock(){
 return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M17.25 10.5h-.75V8.25a4.5 4.5 0 0 0-9 0V10.5h-.75A1.5 1.5 0 0 0 5.25 12v7.5A1.5 1.5 0 0 0 6.75 21h10.5a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5Zm-6 0h1.5V8.25a.75.75 0 0 0-1.5 0Z"/></svg>;
}
function IconEye({off}){
 return off
  ? <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 5.25c-5 0-9.2 3.08-10.7 7.5 1.5 4.42 5.7 7.5 10.7 7.5s9.2-3.08 10.7-7.5C21.2 8.33 17 5.25 12 5.25Zm0 12A4.5 4.5 0 1 1 16.5 13 4.5 4.5 0 0 1 12 17.25Z"/></svg>
  : <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3.22 3.22a.75.75 0 0 0-1.06 1.06l2.1 2.1C2.5 8.05 1.1 10.3.3 12.75c1.5 4.42 5.7 7.5 10.7 7.5 2.12 0 4.1-.56 5.82-1.53l3.96 3.96a.75.75 0 0 0 1.06-1.06Zm8.53 13.28A4.5 4.5 0 0 1 7.5 12c0-.4.05-.78.16-1.15l4.09 4.1c-.37.1-.75.15-1.15.15Zm9.95-3.75c-.5 1.47-1.32 2.78-2.38 3.86l-2.2-2.2A4.47 4.47 0 0 0 16.5 12a4.5 4.5 0 0 0-5.4-4.41L8.72 5.2A10.8 10.8 0 0 1 12 4.75c5 0 9.2 3.08 10.7 7.5Z"/></svg>;
}

function PasswordField({label,value,onChange,placeholder,autoComplete='current-password',show,onToggle,required=true}){
 return <label>{label}
  <span className="auth-input">
   <IconLock/>
   <input type={show?'text':'password'} autoComplete={autoComplete} value={value} onChange={e=>onChange(e.target.value)} required={required} placeholder={placeholder}/>
   <button type="button" className="auth-eye" onClick={onToggle} aria-label={show?'Hide password':'Show password'}>
    <IconEye off={show}/>
   </button>
  </span>
 </label>;
}

function AuthShell({admin,title,lead,children}){
 return <div className={`login-page-v2 auth-simple ${admin?'admin-login':'citizen-login'}`}>
  <div className="auth-simple-wrap">
   <div className="auth-simple-logo">
    <span className="brand-mark">W</span>
    <strong>WardDesk</strong>
   </div>
   <span className="auth-panel-pill">{admin?'Staff workspace':'Resident workspace'}</span>
   <h1>{title}</h1>
   <p className="auth-simple-lead">{lead}</p>
   {children}
   <p className="auth-simple-foot">Secure session · 30-minute timeout<br/>{copyrightLine}</p>
   <div className="auth-simple-apps" aria-hidden="true">
    <span>Complaints</span>
    <span>Schemes</span>
    <span>Messages</span>
    <span>Notices</span>
   </div>
  </div>
 </div>;
}

export default function Login({mode='user'}){
 const admin=mode==='admin';
 const [identifier,setIdentifier]=useState('');
 const [emailId,setEmailId]=useState('');
 const [mobileId,setMobileId]=useState('');
 const [password,setPassword]=useState('');
 const [showPassword,setShowPassword]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [view,setView]=useState('login');
 const [channel,setChannel]=useState('email');
 const [otp,setOtp]=useState('');
 const [newPassword,setNewPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [showNew,setShowNew]=useState(false);
 const [showConfirm,setShowConfirm]=useState(false);
 const [debugOtp,setDebugOtp]=useState('');
 const [sentTo,setSentTo]=useState('');
 const navigate=useNavigate();
 const forgotValue=channel==='mobile'?mobileId:emailId;

 useEffect(()=>{
  const u=getUser();
  if(!u) return;
  const dest=String(u.role||'').toUpperCase()==='CITIZEN'?'/':'/admin';
  window.location.replace(dest);
 },[admin]);

 useEffect(()=>{if(sessionStorage.getItem('ward_session_expired')==='1'){sessionStorage.removeItem('ward_session_expired');setNotice('Your previous session expired. Please sign in again.');}},[]);

 function goLogin(){
  setError('');
  setNotice('');
  setDebugOtp('');
  setSentTo('');
  setOtp('');
  setNewPassword('');
  setConfirmPassword('');
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
  const raw=identifier.trim();
  const digits=raw.replace(/\D/g,'');
  if(digits.length===10 && !raw.includes('@')){
   setChannel('mobile');
   setMobileId(digits);
  }else{
   setChannel('email');
   setEmailId(raw);
   if(digits.length===10) setMobileId(digits);
  }
  setView(admin?'staff-help':'forgot');
 }

 function switchChannel(next){
  setChannel(next);
  setError('');
 }

 async function submit(e){
  e.preventDefault();
  setError('');
  setBusy(true);
  try{
   const result=await api.login(identifier.trim(),password);
   const role=String(result.data.user?.role||'').toUpperCase();
   const citizen=role==='CITIZEN';
   if(!admin&&!citizen) throw new Error('This is an administration account. Please use the administration login.');
   if(admin&&citizen) throw new Error('This is a resident account. Please use the resident login.');
   setSession(result.data.token,result.data.user);
   const dest=admin?'/admin':'/';
   try{window.history.replaceState({wardSignedIn:1},'',dest);}catch{}
   window.location.replace(dest);
   return;
  }catch(e){
   setError(e.message||'Unable to sign in.');
  }finally{
   setBusy(false);
  }
 }

 async function requestCode(e){
  e.preventDefault();
  setError('');
  const value=String(forgotValue||'').trim();
  if(channel==='mobile' && !/^\d{10}$/.test(value)){
   setError('Enter your registered 10-digit mobile number.');
   return;
  }
  if(channel==='email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){
   setError('Enter your registered email address.');
   return;
  }
  setBusy(true);
  try{
   const result=await api.forgotRequest({identifier:value,channel,audience:'citizen'});
   if(result.data?.requiresSupport){
    setError('Enter the email or mobile of your resident account.');
    return;
   }
   setNotice(result.data?.destination
    ? `We sent a 6-digit code to ${result.data.destination}.`
    : (result.message||'If an account exists, we sent a verification code.'));
   setSentTo(result.data?.destination||'');
   setDebugOtp(result.data?.debugOtp||'');
   setOtp(result.data?.debugOtp||'');
   setView('reset');
  }catch(e){
   setError(e.message||'Unable to send a verification code.');
  }finally{
   setBusy(false);
  }
 }

 async function resetPassword(e){
  e.preventDefault();
  setError('');
  if(newPassword!==confirmPassword) return setError('Password and confirm password do not match.');
  setBusy(true);
  try{
   await api.forgotReset({identifier:String(forgotValue||'').trim(),otp:otp.trim(),password:newPassword,confirmPassword,channel});
   setPassword('');
   setOtp('');
   setNewPassword('');
   setConfirmPassword('');
   setDebugOtp('');
   setNotice('Password updated. You can now sign in.');
   setView('login');
  }catch(e){
   setError(e.message||'Unable to update password.');
  }finally{
   setBusy(false);
  }
 }

 if(view==='staff-help'){
  return <AuthShell admin={true} title="Forgot password" lead="Staff passwords are restored by our team">
   <div className="login-v2-card auth-simple-card">
    <p className="auth-staff-copy">Nagarsevak, Employee, Sub Master Admin and Master Admin passwords cannot be reset from this screen.</p>
    <p className="auth-staff-copy">Please contact <strong>{COMPANY_NAME}</strong>. We will verify your account and issue a new password.</p>
    <div className="auth-company-contact">
     <div><span>Demo email</span><a href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a></div>
     <div><span>Demo mobile</span><a href={`tel:${COMPANY_MOBILE}`}>{COMPANY_MOBILE}</a></div>
    </div>
    <button type="button" className="primary-btn full login-v2-submit" onClick={goLogin}>Back to sign in</button>
   </div>
  </AuthShell>;
 }

 if(view==='forgot'){
  return <AuthShell admin={false} title="Forgot password" lead="Choose email or mobile OTP for your resident account">
   <form onSubmit={requestCode} className="login-v2-card auth-simple-card">
    {error&&<div className="error-box">{error}</div>}
    <div className="auth-channel" role="group" aria-label="Verification method">
     <button type="button" className={channel==='email'?'on':''} onClick={()=>switchChannel('email')}>Email</button>
     <button type="button" className={channel==='mobile'?'on':''} onClick={()=>switchChannel('mobile')}>Mobile OTP</button>
    </div>
    {channel==='mobile'
     ? <label>Registered mobile
        <span className="auth-input">
         <IconPhone/>
         <input type="tel" inputMode="numeric" autoComplete="tel" value={mobileId} onChange={e=>setMobileId(e.target.value.replace(/\D/g,'').slice(0,10))} required placeholder="10-digit mobile number" maxLength="10" pattern="\d{10}"/>
        </span>
       </label>
     : <label>Registered email
        <span className="auth-input">
         <IconUser/>
         <input type="email" inputMode="email" autoComplete="email" value={emailId} onChange={e=>setEmailId(e.target.value)} required placeholder="you@example.com"/>
        </span>
       </label>}
    <button type="submit" className="primary-btn full login-v2-submit" disabled={busy}>{busy?'Sending code…':'Send verification code'}</button>
    <div className="auth-simple-links auth-flow-links">
     <button type="button" className="link-btn" onClick={goLogin}>Back to sign in</button>
    </div>
   </form>
  </AuthShell>;
 }

 if(view==='reset'){
  return <AuthShell admin={false} title="Verify and reset" lead={sentTo?`Enter the 6-digit code sent to ${sentTo}`:'Enter the 6-digit code and choose a new password'}>
   <form onSubmit={resetPassword} className="login-v2-card auth-simple-card">
    {notice&&<div className="info-note login-session-notice">{notice}</div>}
    {debugOtp&&<button type="button" className="auth-demo-code" onClick={()=>setOtp(debugOtp)}>
     <span>Demo code</span>
     <strong>{debugOtp}</strong>
     <small>Tap to fill</small>
    </button>}
    {error&&<div className="error-box">{error}</div>}
    <label>Verification code
     <span className="auth-input auth-otp-input">
      <input type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} required placeholder="••••••" maxLength="6"/>
     </span>
    </label>
    <PasswordField label="New password" value={newPassword} onChange={setNewPassword} placeholder="At least 8 characters" autoComplete="new-password" show={showNew} onToggle={()=>setShowNew(v=>!v)}/>
    <PasswordField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter password" autoComplete="new-password" show={showConfirm} onToggle={()=>setShowConfirm(v=>!v)}/>
    <button type="submit" className="primary-btn full login-v2-submit" disabled={busy}>{busy?'Updating…':'Update password'}</button>
    <div className="auth-simple-links auth-login-links is-admin">
     <button type="button" className="link-btn" onClick={()=>setView('forgot')}>Resend code</button>
     <button type="button" className="link-btn" onClick={goLogin}>Back to sign in</button>
    </div>
   </form>
  </AuthShell>;
 }

 return <AuthShell admin={admin} title={admin?'Staff sign in':'Resident sign in'} lead={admin?'Master Admin, Nagarsevak and Employees':'Access your registered ward account'}>
  <form onSubmit={submit} className="login-v2-card auth-simple-card">
   {notice&&<div className="info-note login-session-notice">{notice}</div>}
   {error&&<div className="error-box">{error}</div>}
   <label>Your email or mobile
    <span className="auth-input">
     <IconUser/>
     <input type="text" inputMode="email" autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} required placeholder="e.g. you@example.com"/>
    </span>
   </label>
   <PasswordField label="Your password" value={password} onChange={setPassword} placeholder="Enter your password" show={showPassword} onToggle={()=>setShowPassword(v=>!v)}/>
   <button type="submit" className="primary-btn full login-v2-submit" disabled={busy}>
    {busy?'Signing in…':'Sign in'}
   </button>
   <div className={`auth-simple-links auth-login-links ${admin?'is-admin':'is-resident'}`}>
    {!admin&&<button type="button" className="link-btn" onClick={()=>navigate('/register')}>Create account</button>}
    <button type="button" className="link-btn" onClick={openForgot}>Forgot password?</button>
    {admin
     ? <button type="button" className="link-btn" onClick={()=>navigate('/login')}>Resident login</button>
     : <button type="button" className="link-btn" onClick={()=>navigate('/admin')}>Staff login</button>}
   </div>
  </form>
 </AuthShell>;
}
