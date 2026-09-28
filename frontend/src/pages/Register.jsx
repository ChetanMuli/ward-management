import React,{useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api} from '../services/api';
import {AuthShell} from './Login';
import {initLanguage, ensureCurrentLanguage, getLanguage} from '../language';

const KEY='ward_register_draft';
const empty={name:'',email:'',mobile:'',wardId:'',password:'',confirmPassword:''};

export default function Register(){
 const navigate=useNavigate();
 const currentLang=getLanguage();
 const isMr=currentLang==='mr';
 const [wards,setWards]=useState([]);
 const [loadingWards,setLoadingWards]=useState(true);
 const [form,setForm]=useState(()=>{try{return {...empty,...JSON.parse(sessionStorage.getItem(KEY)||'{}')}}catch{return {...empty}}});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [done,setDone]=useState(false);

 useEffect(()=>{
  initLanguage();
  ensureCurrentLanguage();
 },[]);

 useEffect(()=>{api.registrationWards().then(r=>{const open=(r.data||[]).filter(w=>String(w.status||'ACTIVE').toUpperCase()==='ACTIVE');setWards(open);setForm(f=>open.some(w=>String(w.id)===String(f.wardId))?f:{...f,wardId:''});}).catch(e=>setError(e.message)).finally(()=>setLoadingWards(false))},[]);
 useEffect(()=>{try{const safe={...form,password:'',confirmPassword:''};sessionStorage.setItem(KEY,JSON.stringify(safe))}catch{}},[form]);
 const update=(key,value)=>setForm(f=>({...f,[key]:value}));
 async function submit(e){
  e.preventDefault();
  setError('');
  if(form.mobile.replace(/\D/g,'').length!==10) return setError(isMr?'मोबाईल क्रमांक बरोबर १० अंकांचा असावा.':'Mobile must be exactly 10 digits.');
  if(form.password.length<8) return setError(isMr?'पासवर्ड किमान ८ अक्षरांचा असावा.':'Password must be at least 8 characters.');
  if(form.password!==form.confirmPassword) return setError(isMr?'नवीन पासवर्ड आणि कन्फर्म पासवर्ड जुळत नाहीत.':'Password and confirm password do not match.');
  setBusy(true);
  try{
   await api.registerCitizen({...form,mobile:form.mobile.replace(/\D/g,'')});
   sessionStorage.removeItem(KEY);
   setDone(true);
  }catch(e){setError(e.message||(isMr?'नोंदणी अयशस्वी झाली.':'Registration failed.'))}
  finally{setBusy(false)}
 }

 const shell=(title,lead,card)=>(
  <AuthShell admin={false} register pageLabel={isMr?'नागरिक नोंदणी':'Resident registration'} title={title} lead={lead}>
   {card}
  </AuthShell>
 );

 if(done){
  return shell(isMr?'खाते तयार झाले':'Account ready',isMr?'तुमचे वॉर्ड खाते तयार झाले आहे. पुढे जाण्यासाठी साइन इन करा.':'Your ward account is created. Sign in to continue.',
   <div className="login-v2-card auth-simple-card">
    <p className="auth-done-copy">{isMr?'WardDesk उघडण्यासाठी तुमचा ईमेल आणि पासवर्ड वापरा.':'Use your email and password to open WardDesk.'}</p>
    <button className="primary-btn full login-v2-submit" onClick={()=>navigate('/login',{replace:true})}>{isMr?'साइन इन करा':'Sign in'}</button>
   </div>
  );
 }

 return shell(isMr?'तुमचे खाते तयार करा':'Create your account',isMr?'अपडेट्स, योजना, संदेश आणि तक्रारींसाठी एकदाच नोंदणी करा.':'Register once for updates, schemes, messages and complaints.',
  <form onSubmit={submit} className="login-v2-card auth-simple-card">
   {error&&<div className="error-box">{error}</div>}
   <div className="auth-field-row">
    <label>{isMr?'पूर्ण नाव':'Full name'}
     <input value={form.name} onChange={e=>update('name',e.target.value)} maxLength="120" autoComplete="name" required placeholder={isMr?'तुमचे पूर्ण नाव':'Your full name'}/>
    </label>
    <label>{isMr?'ईमेल':'Email'}
     <span className="auth-input"><span className="auth-ico"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.4" y="5.6" width="17.2" height="12.8" rx="2.2"/><path d="m4.2 7.4 7.8 5.4 7.8-5.4"/></svg></span>
      <span className="auth-split" aria-hidden="true"/>
      <input type="email" value={form.email} onChange={e=>update('email',e.target.value.toLowerCase())} autoComplete="email" required placeholder="you@example.com"/>
     </span>
    </label>
   </div>
   <div className="auth-field-row">
    <label>{isMr?'मोबाईल':'Mobile'}
     <input inputMode="numeric" value={form.mobile} onChange={e=>update('mobile',e.target.value.replace(/\D/g,'').slice(0,10))} maxLength="10" autoComplete="tel" required placeholder={isMr?'१०-अंकी मोबाईल नंबर':'10-digit mobile'}/>
    </label>
    <label className="register-ward-field">{isMr?'वॉर्ड':'Ward'}
     <select value={form.wardId} onChange={e=>update('wardId',e.target.value)} required disabled={loadingWards||!wards.length}>
      <option value="">{loadingWards?(isMr?'वॉर्ड लोड होत आहेत…':'Loading wards…'):(wards.length?(isMr?'तुमचा वॉर्ड निवडा':'Select your ward'):(isMr?'नोंदणीसाठी कोणतेही वॉर्ड उघडे नाहीत':'No wards are open for registration'))}</option>
      {wards.map(w=><option key={w.id} value={w.id}>{w.wardNumber}{w.name?` · ${w.name}`:''}</option>)}
     </select>
    </label>
   </div>
   <div className="auth-field-row">
    <label>{isMr?'पासवर्ड':'Password'}
     <span className="auth-input"><span className="auth-ico"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5.2" y="10.4" width="13.6" height="9.2" rx="2"/><path d="M8.2 10.4V8.2a3.8 3.8 0 0 1 7.6 0v2.2"/></svg></span>
      <span className="auth-split" aria-hidden="true"/>
      <input type="password" value={form.password} onChange={e=>update('password',e.target.value)} minLength="8" autoComplete="new-password" required placeholder={isMr?'किमान ८ अक्षरे':'At least 8 characters'}/>
     </span>
    </label>
    <label>{isMr?'पासवर्ड पुष्टी करा':'Confirm password'}
     <span className="auth-input"><span className="auth-ico"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5.2" y="10.4" width="13.6" height="9.2" rx="2"/><path d="M8.2 10.4V8.2a3.8 3.8 0 0 1 7.6 0v2.2"/></svg></span>
      <span className="auth-split" aria-hidden="true"/>
      <input type="password" value={form.confirmPassword} onChange={e=>update('confirmPassword',e.target.value)} minLength="8" autoComplete="new-password" required placeholder={isMr?'पासवर्ड पुन्हा टाका':'Re-enter password'}/>
     </span>
    </label>
   </div>
   <button className="primary-btn full login-v2-submit" disabled={busy||loadingWards||!wards.length}>{busy?(isMr?'खाते तयार करत आहे…':'Creating account…'):(isMr?'खाते तयार करा':'Create account')}</button>
   <div className="auth-simple-links auth-link-center">
    <button type="button" className="link-btn" onClick={()=>navigate('/login')}>{isMr?'आधीच नोंदणी केली आहे का? साइन इन करा':'Already registered?'}</button>
   </div>
  </form>
 );
}
