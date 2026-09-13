import React,{useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api} from '../services/api';
import {copyrightLine} from './Login';

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

 const shell=(title,lead,card)=>(
  <div className="login-page-v2 auth-simple citizen-login register-page">
   <div className="auth-blob auth-blob-a" aria-hidden="true"/>
   <div className="auth-blob auth-blob-b" aria-hidden="true"/>
   <div className="auth-simple-wrap">
    <div className="auth-simple-logo">
     <span className="brand-mark">W</span>
     <strong>WardDesk</strong>
    </div>
    <h1>{title}</h1>
    <p className="auth-simple-lead">{lead}</p>
    {card}
    <p className="auth-simple-foot">Secure session · 30-minute timeout<br/>{copyrightLine}</p>
    <div className="auth-simple-apps" aria-hidden="true">
     <span>Complaints</span>
     <span>Schemes</span>
     <span>Messages</span>
     <span>Notices</span>
    </div>
  </div>
 </div>
 );

 if(done){
  return shell('Account ready','Your ward account is created. Sign in to continue.',
   <div className="login-v2-card auth-simple-card">
    <p className="auth-done-copy">Use your email and password to open WardDesk.</p>
    <button className="primary-btn full login-v2-submit" onClick={()=>navigate('/login',{replace:true})}>Sign in</button>
   </div>
  );
 }

 return shell('Create your account','Register once for updates, schemes, messages and complaints.',
  <form onSubmit={submit} className="login-v2-card auth-simple-card">
   {error&&<div className="error-box">{error}</div>}
   <div className="auth-field-row">
    <label>Full name
     <input value={form.name} onChange={e=>update('name',e.target.value)} maxLength="120" autoComplete="name" required placeholder="Your full name"/>
    </label>
    <label>Email
     <input type="email" value={form.email} onChange={e=>update('email',e.target.value.toLowerCase())} autoComplete="email" required placeholder="you@example.com"/>
    </label>
   </div>
   <div className="auth-field-row">
    <label>Mobile
     <input inputMode="numeric" value={form.mobile} onChange={e=>update('mobile',e.target.value.replace(/\D/g,'').slice(0,10))} maxLength="10" autoComplete="tel" required placeholder="10-digit mobile"/>
    </label>
    <label className="register-ward-field">Ward
     <select value={form.wardId} onChange={e=>update('wardId',e.target.value)} required disabled={loadingWards||!wards.length}>
      <option value="">{loadingWards?'Loading wards…':(wards.length?'Select your ward':'No wards are open for registration')}</option>
      {wards.map(w=><option key={w.id} value={w.id}>{w.wardNumber}{w.name?` · ${w.name}`:''}</option>)}
     </select>
    </label>
   </div>
   <div className="auth-field-row">
    <label>Password
     <input type="password" value={form.password} onChange={e=>update('password',e.target.value)} minLength="8" autoComplete="new-password" required placeholder="At least 8 characters"/>
    </label>
    <label>Confirm password
     <input type="password" value={form.confirmPassword} onChange={e=>update('confirmPassword',e.target.value)} minLength="8" autoComplete="new-password" required placeholder="Re-enter password"/>
    </label>
   </div>
   <button className="primary-btn full login-v2-submit" disabled={busy||loadingWards||!wards.length}>{busy?'Creating account…':'Create account'}</button>
   <div className="auth-simple-links">
    <button type="button" className="link-btn" onClick={()=>navigate('/login')}>Already registered?</button>
    <button type="button" className="link-btn" onClick={()=>navigate('/admin')}>Staff login</button>
   </div>
  </form>
 );
}
