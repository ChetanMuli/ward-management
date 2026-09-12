import React,{useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api,setSession} from '../services/api';

export default function Login({mode='user'}){
 const admin=mode==='admin';
 const [identifier,setIdentifier]=useState('');
 const [password,setPassword]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const navigate=useNavigate();
 const [notice,setNotice]=useState('');
 useEffect(()=>{if(sessionStorage.getItem('ward_session_expired')==='1'){sessionStorage.removeItem('ward_session_expired');setNotice('Your previous session expired. Please sign in again.');}},[]);

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
   // Force the authenticated shell to mount immediately. This also fixes the
   // admin login case where /admin is already the current route and a normal
   // navigate() can leave the login component mounted until a manual refresh.
   window.location.replace(admin?'/admin':'/');
   return;
  }catch(e){
   setError(e.message||'Unable to sign in.');
  }finally{
   setBusy(false);
  }
 }

 return <div className={`login-page-v2 ${admin?'admin-login':'citizen-login'}`}>
  <div className="login-v2-brand">
   <div className="brand-mark">W</div>
   <div><strong>WardDesk</strong><span>{admin?'Staff administration workspace':'Digital Ward Services'}</span></div>
  </div>
  <div className="login-v2-layout">
   <section className="login-v2-hero">
    <span className="eyebrow">{admin?'STAFF ADMINISTRATION PORTAL':'YOUR WARD · DIGITAL SERVICES'}</span>
    <h1>{admin?'Staff administration. One secure municipal workspace.':'Your ward. Your services. One secure place.'}</h1>
    <p>{admin?'This page is only for Master Admin, Sub Master, Nagarsevak and Employees. Residents must use the resident login.':'Get ward updates, civic schemes, messages and complaint tracking from one registered resident account.'}</p>
    <div className="login-v2-points">
     {admin?<><span>✓ Staff workspace</span><span>✓ Role-based access</span><span>✓ Secure session</span></>:<><span>✓ Secure access</span><span>✓ Ward-specific information</span><span>✓ Mobile friendly</span></>}
    </div>
    <div className="login-v2-role-card">
     <div className="login-v2-role-icon">{admin?'A':'W'}</div>
     <div><strong>{admin?'Administration team':'Registered residents'}</strong><span>{admin?'Master Admin · Sub Master · Nagarsevak · Employee':'One secure account linked to your ward'}</span></div>
    </div>
   </section>
   <section className="login-v2-panel">
    <form onSubmit={submit} className="login-v2-card">
     {admin&&<div className="login-staff-banner"><strong>Staff administration</strong><span>Not for residents · Master Admin · Nagarsevak · Employee</span></div>}
     <div className={`login-mode-badge ${admin?'admin':'resident'}`}>
      <span>{admin?'STAFF WORKSPACE':'WARD RESIDENT'}</span>
      <b>{admin?'Master Admin · Nagarsevak · Employee':'Registered citizen access'}</b>
     </div>
     <div className="login-v2-mobile-brand"><div className="brand-mark">W</div><strong>WardDesk</strong></div>
     <span className="eyebrow">{admin?'STAFF WORKSPACE LOGIN':'WARD USER LOGIN'}</span>
     <h2>{admin?'Administration sign in':'Welcome back'}</h2>
     <p>{admin?'Use your staff email or 10-digit mobile. This workspace is only for Master Admin, Sub Master, Nagarsevak and Employees.':'Use your email or 10-digit mobile number to open your ward account.'}</p>
     {notice&&<div className="info-note login-session-notice">{notice}</div>}
     {error&&<div className="error-box">{error}</div>}
     <label>Email or mobile number
      <input type="text" inputMode="email" autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} required placeholder="you@example.com or 10-digit mobile"/>
     </label>
     <label>Password
      <input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Enter your password"/>
     </label>
     <button type="submit" className="primary-btn full login-v2-submit" disabled={busy}>
      {busy?'Signing in…':admin?'Sign in to administration':'Sign in to WardDesk'}
     </button>
     {!admin&&<div className="login-v2-switch">New to WardDesk? <button type="button" className="link-btn" onClick={()=>navigate('/register')}>Create your ward account</button></div>}
     {!admin&&<div className="login-v2-switch"><span>Staff or administration?</span> <button type="button" className="link-btn" onClick={()=>navigate('/admin')}>Open staff workspace login</button></div>}
     {admin&&<div className="login-v2-switch"><span>Resident of a ward?</span> <button type="button" className="link-btn" onClick={()=>navigate('/login')}>Open resident login</button></div>}
     <div className="login-v2-footer"><span>🔒 Secure session</span><span>30-minute inactivity timeout</span></div>
    </form>
   </section>
  </div>
 </div>;
}
