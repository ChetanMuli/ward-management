import React,{useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api,getUser} from '../services/api';
import {ErrorBox,Loading,PageHeader,StatusPill} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {useWardFilter} from '../wardFilter';
import {can,isMaster} from '../rbac';
import {formatWardNumber, wardDigits} from '../wardFormat';

const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('en-IN'):'—';

export default function WardInformation(){
 const user=getUser(); const master=isMaster(user); const canManageNagarsevak=master||can('EDIT_STAFF',user); const navigate=useNavigate(); const {selectedWardId}=useWardFilter();
 const [wards,setWards]=useState([]),[election,setElection]=useState(null),[error,setError]=useState('');
 useEffect(()=>{
  Promise.all([api.wards(), api.electionData().catch(()=>null)])
   .then(([w,e])=>{setWards(w.data||[]); setElection(e?.data||e||null);})
   .catch(e=>setError(e.message));
 },[]);
 const selected=useMemo(()=>selectedWardId?wards.find(w=>String(w.id)===String(selectedWardId)):wards[0], [wards,selectedWardId]);
 const docs=useMemo(()=>{
  const own=wardDigits(selected?.wardNumber);
  return (election?.rows||[]).find(r=>wardDigits(r.ward)===own)||null;
 },[election,selected]);
 if(error)return <><PageHeader title="Ward Information"/><ErrorBox error={error}/></>;
 if(!wards.length)return <Loading/>;
 const dbAreas=(selected?.areas||selected?.Areas||[]).filter(a=>String(a.status||'ACTIVE').toUpperCase()!=='INACTIVE');
 const officialColonies=docs?.colonies||[];
 const seen=new Set(dbAreas.map(a=>String(a.name||'').trim().toLowerCase()).filter(Boolean));
 const areas=[
  ...dbAreas,
  ...officialColonies.filter(name=>!seen.has(String(name).trim().toLowerCase())).map((name,i)=>({id:`official-${docs?.ward||i}`,name,description:`${name}, Ahilyanagar`,official:true}))
 ];
 const nagarsevaks=(selected?.users||[]).filter(u=>String(u?.status)==='ACTIVE').filter(u=>String(u?.Role?.name||'').toUpperCase()==='NAGARSEVAK');
 const mapUrl=docs?.mapUrl||selected?.officialMapUrl;
 const contact=election?.contact;
 return <div className="ward-information-page">
  <PageHeader title="Ward Information"/>
  <section className="ward-info-selector panel">
   <div><span className="eyebrow">WARD SELECTION</span><p className="muted">{master?'Master Admin can inspect all 17 Ahilyanagar Municipal Corporation wards.':'Select the ward available to your account.'}</p></div>
   <WardFilter label="Select ward"/>
  </section>
  <section className="ward-info-hero panel">
   <div className="ward-info-hero-title"><span className="eyebrow">AMC GENERAL ELECTION 2025–26</span><h1>{formatWardNumber(selected?.wardNumber)||'—'}</h1><h2>{selected?.name||'Ahilyanagar Municipal Corporation Ward'}</h2><p>{selected?.description||'Ahilyanagar Municipal Corporation service area. Assembly Constituency 225 — Ahmednagar City.'}</p></div>
   <div className="ward-info-hero-actions">
    {mapUrl&&<a className="primary-btn" href={mapUrl} target="_blank" rel="noreferrer">Official ward map ↗</a>}
    {docs?.finalListUrl&&<a className="ghost-btn" href={docs.finalListUrl} target="_blank" rel="noreferrer">Final voter list ↗</a>}
    <a className="ghost-btn" href={election?.amcElectionUrl||selected?.officialSourceUrl||'https://amc.gov.in/en/election/'} target="_blank" rel="noreferrer">AMC election source ↗</a>
   </div>
  </section>
  <div className="stat-grid ward-info-stats">
   <div className="glance-card"><span>Final electors</span><strong>{fmt(docs?.count)}</strong><small>AMC final list · 15 Dec 2025</small></div>
   <div className="glance-card"><span>2011 population</span><strong>{fmt(selected?.population2011)}</strong><small>Census reference for this ward</small></div>
   <div className="glance-card"><span>SC / ST (2011)</span><strong>{fmt(selected?.scPopulation2011)} / {fmt(selected?.stPopulation2011)}</strong><small>Census reference</small></div>
   <div className="glance-card"><span>Corporator seats</span><strong>{selected?.seatCount||4}</strong><small>AMC 2025–26 ward structure</small></div>
  </div>
  <div className="two-col ward-info-grid">
   <section className="panel"><div className="panel-title"><div><h3>Key areas / colonies</h3><span>Colonies for {formatWardNumber(selected?.wardNumber)}. Saved areas plus the official AMC locality list.</span></div><span className="scope-chip">{areas.length} areas</span></div>{areas.length?<div className="ward-info-area-list">{areas.map(a=><div className="ward-info-area" key={a.id}><strong>{a.name}</strong><span>{a.description||'Ahilyanagar'}</span></div>)}</div>:<p className="muted">{selectedWardId?'No colonies found for this ward.':'Select a ward to see its colony / area list.'}</p>}<p className="ward-info-note">Use the official AMC ward composition map for the legal boundary. Locality labels here are for field work, not a substitute for the gazette map.</p></section>
   <section className="panel"><div className="panel-title"><div><h3>Official 2025–26 documents</h3><span>Ahilyanagar Municipal Corporation Election Department</span></div></div>
    <div className="source-list">
     {docs?.finalListUrl&&<a href={docs.finalListUrl} target="_blank" rel="noreferrer"><strong>Final voter list</strong><span>General Election 2025–26 · published 15 December 2025</span></a>}
     {docs?.supplementUrl&&<a href={docs.supplementUrl} target="_blank" rel="noreferrer"><strong>Corrected voter list</strong><span>Official supplement for this ward</span></a>}
     {docs?.draftListUrl&&<a href={docs.draftListUrl} target="_blank" rel="noreferrer"><strong>Draft voter list</strong><span>November 2025 draft roll</span></a>}
     {docs?.pollingFolderUrl&&<a href={docs.pollingFolderUrl} target="_blank" rel="noreferrer"><strong>Polling-station list</strong><span>Official AMC folder for this ward</span></a>}
     {docs?.mapUrl&&<a href={docs.mapUrl} target="_blank" rel="noreferrer"><strong>Final ward composition map</strong><span>Signed AMC map for this ward</span></a>}
     {election?.boothListUrl&&<a href={election.boothListUrl} target="_blank" rel="noreferrer"><strong>All-ward booth address list</strong><span>Updated 30 December 2025</span></a>}
     {election?.gazetteUrl&&<a href={election.gazetteUrl} target="_blank" rel="noreferrer"><strong>Maharashtra gazette</strong><span>19 January 2026 · AMC general election</span></a>}
     <a href={election?.sirUrl||'https://cdn.s3waas.gov.in/s345fbc6d3e05ebd93369ce542e8f2322d/uploads/2026/09/17882428071705.pdf'} target="_blank" rel="noreferrer"><strong>Ahilyanagar SIR 2026 ASDD · AC 225</strong><span>Ahilyanagar City · District Election Office · September 2026</span></a>
     <a href="https://amc.gov.in/en/corporates/" target="_blank" rel="noreferrer"><strong>AMC Corporators Directory</strong><span>Published names, parties and contact numbers</span></a>
    </div>
   </section>
  </div>
  {contact&&<section className="panel"><div className="panel-title"><div><h3>Election office contact</h3><span>{contact.department}</span></div></div>
   <div className="election-facts">
    <div><small>Department head</small><strong>{contact.head}</strong></div>
    <div><small>Mobile</small><strong><a href={`tel:${contact.mobile}`}>{contact.mobile}</a></strong></div>
    <div><small>Email</small><strong><a href={`mailto:${contact.email}`}>{contact.email}</a></strong></div>
    <div><small>Toll-free</small><strong><a href={`tel:${contact.helpline.replace(/\s/g,'')}`}>{contact.helpline}</a></strong></div>
    <div><small>Code of conduct</small><strong><a href={`tel:${contact.controlRoom.replace(/\s/g,'')}`}>{contact.controlRoom}</a></strong></div>
    <div><small>Conduct email</small><strong><a href={`mailto:${contact.conductEmail}`}>{contact.conductEmail}</a></strong></div>
   </div>
  </section>}
  <section className="panel ward-info-representatives"><div className="panel-title"><div><h3>Current Nagarsevak / Corporator information</h3><span>Application directory for this ward. Cross-check against AMC published documents.</span></div><StatusPill>{nagarsevaks.length} seats</StatusPill></div>
   <p className="muted">Login credentials are application accounts, not AMC website credentials. AMC has also published a small set of accepted Nagarsevak documents on the election page; those PDFs are listed on Election Data and are not a complete 68-seat replacement list.</p>
   <div className="ward-rep-grid">{nagarsevaks.map(u=><article className="ward-rep-card" key={u.id}><span className="eyebrow">{u.wardSeat||'NAGARSEVAK'}</span><h3>{u.name}</h3><p><b>Party:</b> {u.partyName||'—'}</p>{u.mobile?<p><b>Mobile:</b> <a href={`tel:${u.mobile}`}>{u.mobile}</a></p>:null}<p><b>Published address:</b> {u.officialAddress||'—'}</p>{canManageNagarsevak&&<button type="button" className="small-btn" onClick={()=>navigate('/staff')}>Edit Nagarsevak</button>}</article>)}</div>
  </section>
 </div>;
}
