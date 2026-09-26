import React,{useEffect,useMemo,useState} from 'react';
import {api} from '../services/api';
import {Empty,ErrorBox,Loading,Modal,PageHeader,Toolbar,SearchableSelect,FaceAvatar,isDataImage} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {useWardFilter} from '../wardFilter';

const previousWindows=[
 {key:'yesterday',label:'Yesterday',from:-1,to:-1},
 {key:'day2past',label:'Day before yesterday',from:-2,to:-2},
 {key:'previous8',label:'Previous 8 days',from:-8,to:-1},
 {key:'custom',label:'Custom previous range',from:0,to:0}
];
const upcomingWindows=[
 {key:'today',label:'Today',from:0,to:0},
 {key:'tomorrow',label:'Tomorrow',from:1,to:1},
 {key:'day2',label:'Day after tomorrow',from:2,to:2},
 {key:'next7',label:'Next 7 days',from:0,to:6},
 {key:'next30',label:'Next 30 days',from:0,to:29},
 {key:'next90',label:'Next 90 days',from:0,to:89},
 {key:'custom',label:'Custom upcoming range',from:0,to:0}
];

function birthdayMessage(name,nagarsevak){return `Happy Birthday ${name}! Wishing you a wonderful year filled with happiness, good health and success. — ${nagarsevak||'Nagarsevak'}`}
function fmtDate(d){return d?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(d)): '—'}
function partyMark(party=''){const p=String(party||'').toLowerCase();if(p.includes('bharatiya janata'))return 'BJP';if(p.includes('nationalist congress'))return 'NCP';if(p.includes('congress'))return 'INC';if(p.includes('shiv sena'))return 'SS';if(p.includes('bahujan'))return 'BSP';return String(party||'Party').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'P'}



function printBirthdayCard(record){
 const person=record?.person||{};
 const n=record?.nagarsevak||{};
 const ward=person.family?.house?.area?.ward||{};
 const escape=(v)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const dob=person.dob?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(person.dob)):'—';
 const photo=isDataImage(n.photo)?n.photo:'';
 const initials=String(n.name||'नगरसेवक').split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'न';
 const photoHtml=photo
  ?`<img class="portrait" src="${photo}" alt="${escape(n.name||'नगरसेवक')}"/>`
  :`<div class="portrait portrait-fallback">${escape(initials)}</div>`;
 const party=n.partyName?`<div class="party"><span>${escape(partyMark(n.partyName))}</span><b>${escape(n.partyName)}</b></div>`:'';
 const wardLine=[ward.wardNumber,ward.name].filter(Boolean).join(' · ')||'—';
 const w=window.open('','_blank','width=920,height=760');
 if(!w){alert('Please allow pop-ups for WardDesk to print the birthday card.');return;}
 w.document.write(`<!doctype html>
<html lang="mr">
<head>
<meta charset="utf-8">
<title>वाढदिवस पत्रिका · ${escape(person.fullName||'नागरिक')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Tiro+Devanagari+Marathi:wght@400&display=swap" rel="stylesheet">
<style>
@page{size:A4 portrait;margin:10mm}
*{box-sizing:border-box}
html,body{margin:0;width:100%;min-height:100%;background:#ece7dc;color:#0b1624;font-family:"Noto Sans Devanagari",Arial,sans-serif}
body{padding:8mm}
.sheet{width:190mm;min-height:277mm;margin:0 auto;padding:8mm;background:
  radial-gradient(circle at 8% 12%,rgba(197,164,110,.18),transparent 36%),
  radial-gradient(circle at 92% 88%,rgba(11,22,36,.08),transparent 32%),
  linear-gradient(180deg,#fffdf8,#f4eee3);border:1.2mm solid #0b1624;border-radius:6mm;position:relative;overflow:hidden}
.sheet:before{content:"";position:absolute;inset:4mm;border:0.45mm solid #c5a46e;border-radius:4.4mm;pointer-events:none}
.inner{position:relative;z-index:1;min-height:261mm;display:flex;flex-direction:column;align-items:center;text-align:center;padding:8mm 10mm 7mm}
.brand{display:flex;align-items:center;gap:10px;letter-spacing:.12em;text-transform:uppercase;font-size:11px;font-weight:800;color:#0b1624}
.mark{width:34px;height:34px;border-radius:9px;background:#0b1624;color:#fff;display:grid;place-items:center;font-size:16px;font-weight:800;letter-spacing:0}
.office{margin-top:6px;font-size:13px;font-weight:700;color:#6b5740}
.portrait-wrap{margin:14px 0 8px;width:46mm;height:46mm;padding:3mm;border-radius:50%;background:linear-gradient(180deg,#f3e2b8,#c5a46e 55%,#8b6b32);box-shadow:0 10px 24px rgba(11,22,36,.16)}
.portrait{width:100%;height:100%;object-fit:cover;border-radius:50%;border:2px solid #fff;background:#0b1624}
.portrait-fallback{display:grid;place-items:center;color:#fff;font-size:22px;font-weight:800}
.nagar-name{font-family:"Tiro Devanagari Marathi","Noto Sans Devanagari",serif;font-size:26px;line-height:1.25;margin:4px 0 2px}
.role{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a7458}
.party{display:inline-flex;align-items:center;gap:8px;margin-top:10px;padding:6px 14px 6px 6px;border:1px solid #d8c9a8;border-radius:999px;background:#fff}
.party span{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#0b1624;color:#f3e2b8;font-size:10px;font-weight:800}
.rule{width:42mm;height:1px;background:linear-gradient(90deg,transparent,#c5a46e,transparent);margin:16px 0 12px}
.kicker{font-size:20px;font-weight:800;color:#9a3412}
.citizen{font-family:"Tiro Devanagari Marathi","Noto Sans Devanagari",serif;font-size:34px;line-height:1.25;margin:8px 0 10px}
.wish{max-width:148mm;font-size:15px;line-height:1.85;color:#3f4b5c}
.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%;max-width:158mm;margin:18px 0 8px}
.fact{border:1px solid #e4d7bf;background:#fff;border-radius:12px;padding:12px 10px}
.fact small{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#8a7458;font-weight:800}
.fact b{display:block;margin-top:6px;font-size:14px}
.sign{margin-top:auto;padding-top:18px}
.sign small{display:block;color:#8a7458;font-size:12px}
.sign b{display:block;font-size:18px;margin-top:4px}
.sign span{display:block;margin-top:3px;font-size:12px;color:#5c6b7c}
@media print{body{padding:0;background:#fff}.sheet{width:auto;min-height:277mm;border-radius:0;box-shadow:none}}
</style>
</head>
<body>
 <article class="sheet">
  <div class="inner">
   <div class="brand"><span class="mark">W</span><span>WardDesk · नगरसेवक कार्यालय</span></div>
   <div class="office">वॉर्ड ${escape(wardLine)}</div>
   <div class="portrait-wrap">${photoHtml}</div>
   <div class="nagar-name">${escape(n.name||'नगरसेवक')}</div>
   <div class="role">नगरसेवक</div>
   ${party}
   <div class="rule"></div>
   <div class="kicker">वाढदिवसाच्या हार्दिक शुभेच्छा</div>
   <div class="citizen">${escape(person.fullName||'नागरिक')}</div>
   <p class="wish">तुम्हाला वाढदिवसाच्या मनःपूर्वक शुभेच्छा! तुमचे आयुष्य आनंद, उत्तम आरोग्य, यश आणि समृद्धीने भरलेले जावो. आपल्या कुटुंबाच्या सुख-समृद्धीची नगरसेवक कार्यालयाकडून सदैव अपेक्षा.</p>
   <div class="facts">
    <div class="fact"><small>जन्मतारीख</small><b>${escape(dob)}</b></div>
    <div class="fact"><small>वय</small><b>${escape(person.age??'—')} वर्षे</b></div>
    <div class="fact"><small>वॉर्ड</small><b>${escape(wardLine)}</b></div>
   </div>
   <div class="sign">
    <small>आपला</small>
    <b>${escape(n.name||'नगरसेवक')}</b>
    ${n.partyName?`<span>${escape(n.partyName)}</span>`:''}
   </div>
  </div>
 </article>
 <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));window.addEventListener('afterprint',()=>setTimeout(()=>window.close(),300));</script>
</body>
</html>`);
 w.document.close();w.focus();
}

export default function Birthdays(){
 const {selectedWardId}=useWardFilter();
 const saved=(()=>{try{return JSON.parse(sessionStorage.getItem('ward_birthdays_filters')||'{}')}catch{return {}}})();
 const [mode,setMode]=useState(saved.mode||'upcoming'),[windowKey,setWindowKey]=useState(saved.windowKey||'next30'),[customFrom,setCustomFrom]=useState(saved.customFrom||''),[customTo,setCustomTo]=useState(saved.customTo||'');
 useEffect(()=>{try{sessionStorage.setItem('ward_birthdays_filters',JSON.stringify({mode,windowKey,customFrom,customTo}))}catch{}},[mode,windowKey,customFrom,customTo]);
 const [rows,setRows]=useState(null),[selected,setSelected]=useState(null),[error,setError]=useState('');
 const windows=mode==='previous'?previousWindows:upcomingWindows;
 const win=windows.find(x=>x.key===windowKey)||windows[0];

 const customDays=useMemo(()=>{
   if(!customFrom||!customTo)return null;
   const today=new Date();today.setHours(0,0,0,0);
   const a=new Date(`${customFrom}T00:00:00`),b=new Date(`${customTo}T00:00:00`);
   if(b<a)return null;
   return {from:Math.floor((a-today)/86400000),to:Math.floor((b-today)/86400000)};
 },[customFrom,customTo]);

 useEffect(()=>{
   const range=windowKey==='custom'&&customDays?customDays:win;
   if(windowKey==='custom'&&!customDays){setRows([]);return;}
   setRows(null);setError('');
   const days=Math.max(range.to-range.from+1,1);
   api.birthdays(days,selectedWardId||undefined,range.from)
    .then(r=>setRows(r.data||[])).catch(e=>setError(e.message));
 },[windowKey,customDays?.from,customDays?.to,selectedWardId]);

 const visible=useMemo(()=>rows||[],[rows]);

 return <div>
  <PageHeader title="Birthday management" subtitle="Find birthdays by exact day or a future range. Open any person for complete household information."/>
  <ErrorBox error={error}/>
  <div className="filter-toolbar birthday-filter-toolbar">
  <WardFilter/>
  <SearchableSelect label="Birthday type" value={mode} onChange={v=>{setMode(v);setWindowKey(v==='previous'?'previous8':'next30');setCustomFrom('');setCustomTo('')}} options={[{value:'previous',label:'Previous birthdays'},{value:'upcoming',label:'Upcoming birthdays'}]} placeholder="Select type…"/>
  <SearchableSelect label={mode==='previous'?'Previous window':'Upcoming window'} value={windowKey} onChange={setWindowKey} options={windows.map(w=>({value:w.key,label:w.label}))} placeholder="Select window…"/>
  </div>
  {windowKey==='custom'&&<div className="panel filter-grid"><label>From date<input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/></label><label>To date<input type="date" value={customTo} min={customFrom||undefined} onChange={e=>setCustomTo(e.target.value)}/></label></div>}
  {!rows?<Loading/>:!visible.length?<Empty>No birthdays for the selected day/range.</Empty>:<div className="birthday-grid">{visible.map(r=>{
    const p=r.person,f=p.family,h=f?.house,a=h?.area,w=a?.ward,phone=(p.mobile||'').replace(/\D/g,''),text=encodeURIComponent(birthdayMessage(p.fullName,r.nagarsevak?.name));
    return <article className="birthday-card" key={p.id}><div className="confetti">✦</div><span className="eyebrow">BIRTHDAY</span><h2>{r.daysToBirthday===0?'Today':r.daysToBirthday===-1?'Yesterday':r.daysToBirthday===-2?'Day before yesterday':r.daysToBirthday<0?`${Math.abs(r.daysToBirthday)} days ago`:`In ${r.daysToBirthday} days`}</h2><h3>{p.fullName}</h3><p>{fmtDate(p.dob)} · {p.age??'Age unavailable'}{p.gender?` · ${p.gender}`:''}</p><div className="birthday-house"><b>Mobile:</b> {p.mobile||'N/A'}<br/><b>House:</b> {h?.houseNumber||'N/A'}<br/><b>Address:</b> {h?.address||'N/A'}<br/><b>Colony:</b> {a?.name||'N/A'} · <b>Ward:</b> {w?.wardNumber||'N/A'}<br/><b>Family:</b> {f?.familyName||'N/A'}</div><div className="birthday-nagar"><FaceAvatar name={r.nagarsevak?.name||'Nagarsevak'} photo={r.nagarsevak?.photo}/><div><small>नगरसेवक</small><strong>{r.nagarsevak?.name||'—'}</strong>{r.nagarsevak?.partyName?<span>{r.nagarsevak.partyName}</span>:null}</div></div><div className="card-actions"><button className="primary-outline" onClick={()=>setSelected(r)}>View full details</button>{phone.length===10&&<a className="whatsapp-btn" target="_blank" rel="noreferrer" href={`https://wa.me/91${phone}?text=${text}`}>WhatsApp</a>}<button className="small-btn" onClick={()=>printBirthdayCard(r)}>Print birthday card</button></div></article>
  })}</div>}
  {selected&&<Modal wide title={`Birthday details · ${selected.person.fullName}`} onClose={()=>setSelected(null)}><div className="detail-grid">
   <div className="detail-card"><h3>Citizen</h3><p><b>Name:</b> {selected.person.fullName}</p><p><b>DOB:</b> {fmtDate(selected.person.dob)}</p><p><b>Age:</b> {selected.person.age??'N/A'}</p><p><b>Gender:</b> {selected.person.gender||'N/A'}</p><p><b>Mobile:</b> {selected.person.mobile||'N/A'}</p><p><b>Alternate:</b> {selected.person.alternateMobile||'N/A'}</p></div>
   <div className="detail-card"><h3>Household</h3><p><b>Family:</b> {selected.person.family?.familyName||'N/A'}</p><p><b>House:</b> {selected.person.family?.house?.houseNumber||'N/A'}</p><p><b>Address:</b> {selected.person.family?.house?.address||'N/A'}</p><p><b>Landmark:</b> {selected.person.family?.house?.landmark||'N/A'}</p></div>
   <div className="detail-card"><h3>Ward & colony</h3><p><b>Ward:</b> {selected.person.family?.house?.area?.ward?.wardNumber||'N/A'}{selected.person.family?.house?.area?.ward?.name?` · ${selected.person.family.house.area.ward.name}`:''}</p><p><b>Colony / Area:</b> {selected.person.family?.house?.area?.name||'N/A'}</p><p><b>Birthday:</b> {fmtDate(selected.person.dob)}</p><p><b>Days:</b> {selected.daysToBirthday===0?'Today':selected.daysToBirthday}</p></div>
  </div><div className="detail-card birthday-nagar-detail"><h3>नगरसेवक</h3><div className="birthday-nagar"><FaceAvatar name={selected.nagarsevak?.name||'Nagarsevak'} photo={selected.nagarsevak?.photo} className="staff-face-lg"/><div><strong>{selected.nagarsevak?.name||'—'}</strong><span>{selected.nagarsevak?.partyName||'Nagarsevak'}</span>{selected.nagarsevak?.mobile?<p>{selected.nagarsevak.mobile}</p>:null}</div></div></div><div className="detail-card"><h3>Family members</h3>{(selected.person.family?.members||[]).map(m=><p key={m.id}>{m.fullName} · {m.mobile||'N/A'} · {m.age??'Age N/A'} years</p>)}</div><div className="modal-actions"><button type="button" className="primary-btn" onClick={()=>printBirthdayCard(selected)}>Print birthday card</button></div></Modal>}
 </div>;
}
