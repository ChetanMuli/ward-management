import React,{useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api} from '../services/api';

const KEY='ward_register_draft';
const empty={name:'',email:'',mobile:'',wardId:'',password:'',confirmPassword:''};

export default function Register(){
 const navigate=useNavigate();
 const [wards,setWards]=useState([]);
 const [loadingWards,setLoadingWards]=useState(true);
 const [form,setForm]=useState(()=>{try{return {...empty,...JSON.parse(sessionStorage.getItem(KEY)||'{}')}}catch{return {...empty}}});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [done,setDone]=useState(false);
 useEffect(()=>{api.registrationWards().then(r=>{const open=(r.data||[]).filter(w=>String(w.status||'ACTIVE').toUpperCase()==='ACTIVE');setWards(open);setForm(f=>open.some(w=>String(w.id)===String(f.wardId))?f:{...f,wardId:''});}).catch(e=>setError(e.message)).finally(()=>setLoadingWards(false))},[]);
 useEffect(()=>{try{const safe={...form,password:'',confirmPassword:''};sessionStorage.setItem(KEY,JSON.stringify(safe))}catch{}},[form]);
 const update=(key,value)=>setForm(f=>({...f,[key]:value}));
 async function submit(e){
  e.preventDefault();
  setError('');
  if(form.mobile.replace(/\D/g,'').length!==10) return setError('Mobile must be exactly 10 digits.');
  if(form.password.length<8) return setError('Password must be at least 8 characters.');
  if(form.password!==form.confirmPassword) return setError('Password and confirm password do not match.');
  setBusy(true);
  try{
   await api.registerCitizen({...form,mobile:form.mobile.replace(/\D/g,'')});
   sessionStorage.removeItem(KEY);
   setDone(true);
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 }

 const layout=(panel)=>(
  <div className="login-page-v2 citizen-login register-page">
   <div className="login-v2-brand">
    <div className="brand-mark">W</div>
    <div><strong>WardDesk</strong><span>Digital Ward Services</span></div>
   </div>
   <div className="login-v2-layout">
    <section className="login-v2-hero">
     <span className="eyebrow">YOUR WARD · DIGITAL SERVICES</span>
     <h1>{done?'Welcome to WardDesk.':'Create your ward account.'}</h1>
     <p>{done?'Your registered ward account is ready. Sign in to receive updates, schemes, messages and complaint tracking.':'Register once to receive ward updates, events, schemes, messages and complaint tracking from one secure resident account.'}</p>
     <div className="login-v2-points">
      <span>✓ Secure access</span><span>✓ Ward-specific information</span><span>✓ Mobile friendly</span>
     </div>
     <div className="login-v2-role-card">
      <div className="login-v2-role-icon">W</div>
      <div><strong>Registered residents</strong><span>One secure account linked to your ward</span></div>
     </div>
    </section>
    <section className="login-v2-panel">{panel}</section>
   </div>
  </div>
 );

 if(done){
  return layout(
   <div className="login-v2-card">
    <div className="login-mode-badge resident"><span>WARD RESIDENT</span><b>Account ready</b></div>
    <div className="login-v2-mobile-brand"><div className="brand-mark">W</div><strong>WardDesk</strong></div>
    <span className="eyebrow">REGISTRATION COMPLETE</span>
    <h2>Account created</h2>
    <p>Your WardDesk account is ready. Sign in with your email and password.</p>
    <button className="primary-btn full login-v2-submit" onClick={()=>navigate('/login',{replace:true})}>Go to sign in</button>
    <div className="login-v2-footer"><span>🔒 Secure session</span><span>30-minute inactivity timeout</span></div>
   </div>
  );
 }

 return layout(
  <form onSubmit={submit} className="login-v2-card">
   <div className="login-mode-badge resident"><span>WARD RESIDENT</span><b>Create registered citizen access</b></div>
   <div className="login-v2-mobile-brand"><div className="brand-mark">W</div><strong>WardDesk</strong></div>
   <span className="eyebrow">WARD USER REGISTRATION</span>
   <h2>Create your account</h2>
   <p>Enter your details and choose the ward you live in. You can sign in as soon as the account is created.</p>
   {error&&<div className="error-box">{error}</div>}
   <label>Full name
    <input value={form.name} onChange={e=>update('name',e.target.value)} maxLength="120" autoComplete="name" required placeholder="Your full name"/>
   </label>
   <label>Email
    <input type="email" value={form.email} onChange={e=>update('email',e.target.value.toLowerCase())} autoComplete="email" required placeholder="you@example.com"/>
   </label>
   <label>Mobile
    <input inputMode="numeric" value={form.mobile} onChange={e=>update('mobile',e.target.value.replace(/\D/g,'').slice(0,10))} maxLength="10" autoComplete="tel" required placeholder="10-digit mobile"/>
   </label>
   <label className="register-ward-field">Ward
    <select value={form.wardId} onChange={e=>update('wardId',e.target.value)} required disabled={loadingWards||!wards.length}>
     <option value="">{loadingWards?'Loading wards…':(wards.length?'Select your ward':'No wards are open for registration')}</option>
     {wards.map(w=><option key={w.id} value={w.id}>{w.wardNumber}{w.name?` · ${w.name}`:''}</option>)}
    </select>
   </label>
   <label>Password
    <input type="password" value={form.password} onChange={e=>update('password',e.target.value)} minLength="8" autoComplete="new-password" required placeholder="At least 8 characters"/>
   </label>
   <label>Confirm password
    <input type="password" value={form.confirmPassword} onChange={e=>update('confirmPassword',e.target.value)} minLength="8" autoComplete="new-password" required placeholder="Re-enter password"/>
   </label>
   <button className="primary-btn full login-v2-submit" disabled={busy||loadingWards||!wards.length}>{busy?'Creating account…':'Create account'}</button>
   <div className="login-v2-switch">Already registered? <button type="button" className="link-btn" onClick={()=>navigate('/login')}>Sign in to WardDesk</button></div>
   <div className="login-v2-switch"><span>Staff or administration?</span> <button type="button" className="link-btn" onClick={()=>navigate('/admin')}>Sign in to the workspace</button></div>
   <div className="login-v2-footer"><span>🔒 Secure session</span><span>30-minute inactivity timeout</span></div>
  </form>
 );
}
