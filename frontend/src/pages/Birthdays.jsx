import React,{useEffect,useMemo,useState} from 'react';
import {api} from '../services/api';
import {Empty,ErrorBox,Loading,Modal,PageHeader,Toolbar,SearchableSelect} from '../components/Ui';
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

function birthdayMessage(name,nagarsevak){return `Happy Birthday ${name}! 🎉 Wishing you a wonderful year filled with happiness, good health and success. — ${nagarsevak||'Nagarsevak'}`}
function fmtDate(d){return d?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(d)): '—'}
function partyMark(party=''){const p=String(party||'').toLowerCase();if(p.includes('bharatiya janata'))return 'BJP';if(p.includes('nationalist congress'))return 'NCP';if(p.includes('congress'))return 'INC';if(p.includes('shiv sena'))return 'SS';if(p.includes('bahujan'))return 'BSP';return String(party||'Party').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'P'}



function printBirthdayCard(record){
 const person=record?.person||{};
 const n=record?.nagarsevak||{};
 const escape=(v)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const dob=person.dob?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(person.dob)):'—';
 const party=n.partyName?`<div class="party"><span>${escape(partyMark(n.partyName))}</span><b>${escape(n.partyName)}</b></div>`:'';
 const w=window.open('','_blank','width=900,height=700');
 if(!w){alert('Please allow pop-ups for WardDesk to print the birthday card.');return;}
 w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Birthday Card - ${escape(person.fullName||'Citizen')}</title><style>
 @page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;width:100%;min-height:100%;font-family:Arial,"Noto Sans Devanagari",sans-serif;background:#fff;color:#172033}
 body{padding:16mm}.card{min-height:265mm;border:2px solid #172033;border-radius:18px;padding:25mm 18mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative;overflow:hidden}
 .bar{position:absolute;left:0;right:0;top:0;height:8mm;background:#172033}.cake{font-size:52px;margin-bottom:10px}.kicker{font-size:18px;font-weight:800}.name{font-size:36px;margin:14px 0;line-height:1.2}.wish{font-size:15px;line-height:1.8;max-width:145mm;color:#526074}.details{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:145mm;max-width:100%;margin:22px 0}.detail{border:1px solid #dfe5ed;border-radius:10px;padding:12px}.detail small{display:block;color:#7b8798}.detail b{display:block;margin-top:5px}.party{display:flex;align-items:center;gap:10px;border:1px solid #dbe3ed;border-radius:999px;padding:8px 14px}.party span{width:38px;height:38px;border:2px solid #172033;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:900}.sign{margin-top:25px;color:#68758a}.sign b{display:block;font-size:17px;color:#172033;margin-top:4px}
 @media print{body{padding:0}.card{border:0;border-radius:0;min-height:297mm;height:297mm;padding:25mm 18mm}}
 </style></head><body><div class="card"><div class="bar"></div><div class="cake">🎂</div><div class="kicker">वाढदिवसाच्या हार्दिक शुभेच्छा</div><div class="name">${escape(person.fullName||'नागरिक')}</div><div class="wish">तुम्हाला वाढदिवसाच्या मनःपूर्वक शुभेच्छा! तुमचे आयुष्य आनंद, उत्तम आरोग्य, यश आणि समृद्धीने भरलेले जावो.</div><div class="details"><div class="detail"><small>जन्मतारीख</small><b>${escape(dob)}</b></div><div class="detail"><small>वय</small><b>${escape(person.age??'—')} वर्षे</b></div></div>${party}<div class="sign">आपला<b>${escape(n.name||'नगरसेवक')}</b></div></div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));window.addEventListener('afterprint',()=>setTimeout(()=>window.close(),300));</script></body></html>`);
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
    return <article className="birthday-card" key={p.id}><div className="confetti">✦</div><span className="eyebrow">BIRTHDAY</span><h2>{r.daysToBirthday===0?'Today':r.daysToBirthday===-1?'Yesterday':r.daysToBirthday===-2?'Day before yesterday':r.daysToBirthday<0?`${Math.abs(r.daysToBirthday)} days ago`:`In ${r.daysToBirthday} days`}</h2><h3>{p.fullName}</h3><p>{fmtDate(p.dob)} · {p.age??'Age unavailable'}{p.gender?` · ${p.gender}`:''}</p><div className="birthday-house"><b>Mobile:</b> {p.mobile||'N/A'}<br/><b>House:</b> {h?.houseNumber||'N/A'}<br/><b>Address:</b> {h?.address||'N/A'}<br/><b>Colony:</b> {a?.name||'N/A'} · <b>Ward:</b> {w?.wardNumber||'N/A'}<br/><b>Family:</b> {f?.familyName||'N/A'}</div><div className="card-actions"><button className="primary-outline" onClick={()=>setSelected(r)}>View full details</button>{phone.length===10&&<a className="whatsapp-btn" target="_blank" rel="noreferrer" href={`https://wa.me/91${phone}?text=${text}`}>WhatsApp</a>}<button className="small-btn" onClick={()=>printBirthdayCard(r)}>Print birthday card</button></div></article>
  })}</div>}
  {selected&&<Modal wide title={`Birthday details · ${selected.person.fullName}`} onClose={()=>setSelected(null)}><div className="detail-grid">
   <div className="detail-card"><h3>Citizen</h3><p><b>Name:</b> {selected.person.fullName}</p><p><b>DOB:</b> {fmtDate(selected.person.dob)}</p><p><b>Age:</b> {selected.person.age??'N/A'}</p><p><b>Gender:</b> {selected.person.gender||'N/A'}</p><p><b>Mobile:</b> {selected.person.mobile||'N/A'}</p><p><b>Alternate:</b> {selected.person.alternateMobile||'N/A'}</p></div>
   <div className="detail-card"><h3>Household</h3><p><b>Family:</b> {selected.person.family?.familyName||'N/A'}</p><p><b>House:</b> {selected.person.family?.house?.houseNumber||'N/A'}</p><p><b>Address:</b> {selected.person.family?.house?.address||'N/A'}</p><p><b>Landmark:</b> {selected.person.family?.house?.landmark||'N/A'}</p></div>
   <div className="detail-card"><h3>Ward & colony</h3><p><b>Ward:</b> {selected.person.family?.house?.area?.ward?.wardNumber||'N/A'}{selected.person.family?.house?.area?.ward?.name?` · ${selected.person.family.house.area.ward.name}`:''}</p><p><b>Colony / Area:</b> {selected.person.family?.house?.area?.name||'N/A'}</p><p><b>Birthday:</b> {fmtDate(selected.person.dob)}</p><p><b>Days:</b> {selected.daysToBirthday===0?'Today':selected.daysToBirthday}</p></div>
  </div><div className="detail-card"><h3>Family members</h3>{(selected.person.family?.members||[]).map(m=><p key={m.id}>{m.fullName} · {m.mobile||'N/A'} · {m.age??'Age N/A'} years</p>)}</div></Modal>}
 </div>;
}
