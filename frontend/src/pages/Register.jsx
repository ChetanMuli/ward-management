import React,{useEffect,useState,useRef} from 'react';
import {useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {api} from '../services/api';
import {AuthShell} from './Login';
import {formatWardLabel, formatWardNumber} from '../wardFormat';
import {getLanguage, initLanguage, ensureCurrentLanguage} from '../language';

const KEY='ward_register_draft';
const empty={name:'',email:'',mobile:'',wardId:'',password:'',confirmPassword:''};

function IconWardPin() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6.2-5.4-6.2-10.1a6.2 6.2 0 1 1 12.4 0C18.2 15.6 12 21 12 21Z" />
      <circle cx="12" cy="10.6" r="2.2" />
    </svg>
  );
}

function WardSelectField({ wards, selectedWardId, onSelect, loading, inviteLocked, selectedWard, isMr, error }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (loading) {
    return (
      <div className="auth-input ward-reg-trigger is-loading">
        <span className="auth-ico"><IconWardPin /></span>
        <span className="auth-split" aria-hidden="true" />
        <span className="ward-reg-placeholder">{isMr ? 'वॉर्ड माहिती लोड होत आहे…' : 'Loading available wards…'}</span>
      </div>
    );
  }

  if (inviteLocked) {
    return (
      <div className="auth-input ward-reg-trigger is-locked">
        <span className="auth-ico"><IconWardPin /></span>
        <span className="auth-split" aria-hidden="true" />
        <div className="ward-reg-locked-copy">
          <strong>{formatWardLabel(selectedWard)}</strong>
          <span>{isMr ? 'नोंदणी लिंक या वॉर्डसाठी निश्चित आहे' : 'Assigned ward for your registration link'}</span>
        </div>
        <span className="ward-reg-lock-icon" title="Locked by invite link">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
        </span>
        <input type="hidden" name="wardId" value={selectedWardId || ''} />
      </div>
    );
  }

  if (!wards.length) {
    return (
      <div className="auth-input ward-reg-trigger is-closed">
        <span className="auth-ico"><IconWardPin /></span>
        <span className="auth-split" aria-hidden="true" />
        <span className="ward-reg-placeholder is-closed">
          {error ? (isMr ? 'वॉर्ड लोड करता आला नाही' : 'Unable to load ward') : (isMr ? 'नोंदणीसाठी वॉर्ड उपलब्ध नाही' : 'No ward is open for registration')}
        </span>
      </div>
    );
  }

  const selected = wards.find(w => String(w.id) === String(selectedWardId));
  const showSearch = wards.length > 7;
  const filtered = showSearch && search.trim()
    ? wards.filter(w => {
        const q = search.trim().toLowerCase();
        const text = `${formatWardNumber(w.wardNumber)} ${w.name || ''} ${formatWardLabel(w)}`.toLowerCase();
        return text.includes(q);
      })
    : wards;

  return (
    <div className={`ward-reg-wrap ${open ? 'is-open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={`auth-input ward-reg-trigger ${open ? 'is-focused' : ''} ${selected ? 'has-value' : ''}`}
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="auth-ico"><IconWardPin /></span>
        <span className="auth-split" aria-hidden="true" />
        <span className="ward-reg-value-text">
          {selected ? formatWardLabel(selected) : (isMr ? 'आपला वॉर्ड निवडा…' : 'Select your ward…')}
        </span>
        <span className={`ward-reg-chevron ${open ? 'is-rotated' : ''}`}>
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 8 10 12 14 8" />
          </svg>
        </span>
      </button>

      <input type="hidden" name="wardId" value={selectedWardId || ''} />

      {open && (
        <div className="ward-reg-dropdown" role="listbox">
          {showSearch && (
            <div className="ward-reg-search-box">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isMr ? 'वॉर्ड क्रमांक किंवा नाव शोधा…' : 'Search ward number or name…'}
              />
              {search && (
                <button type="button" className="ward-reg-search-clear" onClick={() => setSearch('')}>✕</button>
              )}
            </div>
          )}

          <div className="ward-reg-list">
            {filtered.length === 0 ? (
              <div className="ward-reg-empty">{isMr ? 'कोणताही वॉर्ड सापडला नाही' : 'No matching wards found'}</div>
            ) : (
              filtered.map(w => {
                const isSelected = String(w.id) === String(selectedWardId);
                const wardNo = formatWardNumber(w.wardNumber);
                const wardName = w.name || wardNo;
                return (
                  <button
                    type="button"
                    key={w.id}
                    className={`ward-reg-item ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      onSelect(w.id);
                      setOpen(false);
                      setSearch('');
                    }}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="ward-reg-badge">{wardNo}</span>
                    <span className="ward-reg-item-info">
                      <span className="ward-reg-item-name">{wardName}</span>
                      <span className="ward-reg-item-hint">{isMr ? 'महानगरपालिका वॉर्ड' : 'Municipal ward'}</span>
                    </span>
                    {isSelected && (
                      <span className="ward-reg-check">
                        <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="4 10 8 14 16 6" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Register(){
 const navigate=useNavigate();
 const {code}=useParams();
 const [params]=useSearchParams();
 const invite=String(code||params.get('invite')||params.get('c')||'').trim();
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

 useEffect(()=>{
  setLoadingWards(true);
  api.registrationWards(invite||undefined).then(r=>{
   const raw=r?.data;
   const open=Array.isArray(raw)?raw:(Array.isArray(raw?.wards)?raw.wards:[]);
   setWards(open);
   setForm(f=>({
    ...f,
    wardId: open.length===1 ? open[0].id : (open.some(w=>String(w.id)===String(f.wardId))?f.wardId:'')
   }));
  }).catch(e=>setError(e.message)).finally(()=>setLoadingWards(false));
 },[invite]);
 useEffect(()=>{try{const safe={...form,password:'',confirmPassword:''};sessionStorage.setItem(KEY,JSON.stringify(safe))}catch{}},[form]);
 const update=(key,value)=>setForm(f=>({...f,[key]:value}));

 async function submit(e){
  e.preventDefault();
  setError('');
  if(!form.wardId) {
   return setError(
    wards.length
     ? (isMr ? 'कृपया आपला वॉर्ड निवडा.' : 'Please select your ward.')
     : (isMr ? 'नोंदणीसाठी वॉर्ड उपलब्ध नाही.' : 'No ward is open for registration.')
   );
  }
  if(form.mobile.replace(/\D/g,'').length!==10) return setError(isMr?'मोबाईल क्रमांक बरोबर १० अंकांचा असावा.':'Mobile must be exactly 10 digits.');
  if(form.password.length<8) return setError(isMr?'पासवर्ड किमान ८ अक्षरांचा असावा.':'Password must be at least 8 characters.');
  if(form.password!==form.confirmPassword) return setError(isMr?'नवीन पासवर्ड आणि कन्फर्म पासवर्ड जुळत नाहीत.':'Password and confirm password do not match.');
  setBusy(true);
  try{
   await api.registerCitizen({...form,mobile:form.mobile.replace(/\D/g,''),invite:invite||undefined});
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

 const inviteLocked=Boolean(invite) && wards.length===1;
 const selectedWard=wards.find(w=>String(w.id)===String(form.wardId))||(inviteLocked?wards[0]:null);
 const closed=!loadingWards&&!wards.length&&!error;

 return shell(isMr?'तुमचे खाते तयार करा':'Create your account',isMr?'अपडेट्स, योजना, संदेश आणि तक्रारींसाठी एकदाच नोंदणी करा.':'Register once for updates, schemes, messages and complaints.',
  <form onSubmit={submit} className="login-v2-card auth-simple-card">
   {error&&<div className="error-box">{error}</div>}
   {closed&&<div className="error-box">{isMr?'सध्या नोंदणी उपलब्ध नाही. कृपया आपल्या वॉर्ड कार्यालयाशी संपर्क साधा.':'Registration is not available at this time. Please contact your ward office.'}</div>}
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
     <WardSelectField
      wards={wards}
      selectedWardId={form.wardId}
      onSelect={id => update('wardId', id)}
      loading={loadingWards}
      inviteLocked={inviteLocked}
      selectedWard={selectedWard}
      isMr={isMr}
      error={error}
     />
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
