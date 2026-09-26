import React,{useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api,getUser} from '../services/api';
import {ErrorBox,Loading,PageHeader,StatusPill} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {useWardFilter} from '../wardFilter';
import {can,isMaster} from '../rbac';

const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('en-IN'):'—';

export default function WardInformation(){
 const user=getUser(); const master=isMaster(user); const canManageNagarsevak=master||can('EDIT_STAFF',user); const navigate=useNavigate(); const {selectedWardId}=useWardFilter();
 const [wards,setWards]=useState([]),[error,setError]=useState('');
 useEffect(()=>{api.wards().then(r=>setWards(r.data||[])).catch(e=>setError(e.message))},[]);
 const selected=useMemo(()=>selectedWardId?wards.find(w=>String(w.id)===String(selectedWardId)):wards[0], [wards,selectedWardId]);
 if(error)return <><PageHeader title="Ward Information"/><ErrorBox error={error}/></>;
 if(!wards.length)return <Loading/>;
 const areas=(selected?.areas||[]).filter(a=>String(a.status||'ACTIVE')==='ACTIVE');
 return <div>
  <PageHeader title="Ward Information"/>
  <section className="ward-info-selector panel">
   <div><span className="eyebrow">WARD SELECTION</span><p className="muted">{master?'Master Admin can inspect all 17 wards.':'Select the ward available to your account.'}</p></div>
   <WardFilter label="Select ward"/>
  </section>
  <section className="ward-info-hero panel">
   <div className="ward-info-hero-title"><span className="eyebrow">MUNICIPAL WARD</span><h1>{selected?.wardNumber||'—'}</h1><h2>{selected?.name||'Ahilyanagar Municipal Corporation Ward'}</h2><p>{selected?.description||'Ahilyanagar Municipal Corporation service area.'}</p></div>
   <div className="ward-info-hero-actions">{selected?.officialMapUrl&&<a className="primary-btn" href={selected.officialMapUrl} target="_blank" rel="noreferrer">View official AMC map ↗</a>} {selected?.officialSourceUrl&&<a className="ghost-btn" href={selected.officialSourceUrl} target="_blank" rel="noreferrer">AMC election source ↗</a>}</div>
  </section>
  <div className="stat-grid ward-info-stats">
   <div className="glance-card"><span>2011 population</span><strong>{fmt(selected?.population2011)}</strong><small>AMC ward-structure reference</small></div>
   <div className="glance-card"><span>SC population</span><strong>{fmt(selected?.scPopulation2011)}</strong><small>2011 reference</small></div>
   <div className="glance-card"><span>ST population</span><strong>{fmt(selected?.stPopulation2011)}</strong><small>2011 reference</small></div>
   <div className="glance-card"><span>Corporator seats</span><strong>{selected?.seatCount||4}</strong><small>Current 2025–26 directory</small></div>
  </div>
  <div className="two-col ward-info-grid">
   <section className="panel"><div className="panel-title"><div><h3>Key areas / colonies</h3><span>Application locality labels linked to this ward.</span></div><span className="scope-chip">{areas.length} areas</span></div>{areas.length?<div className="ward-info-area-list">{areas.map(a=><div className="ward-info-area" key={a.id}><strong>{a.name}</strong><span>{a.description||'Ahilyanagar'}</span></div>)}</div>:<p className="muted">No active areas configured.</p>}<p className="ward-info-note">For the legally authoritative boundary, use the linked AMC ward composition map rather than treating locality labels as the complete boundary description.</p></section>
   <section className="panel"><div className="panel-title"><div><h3>Official sources</h3><span>Use these links for verification.</span></div></div><div className="source-list">{selected?.officialMapUrl&&<a href={selected.officialMapUrl} target="_blank" rel="noreferrer"><strong>Final ward composition map</strong><span>{selected.officialMapUrl}</span></a>}<a href={selected?.officialSourceUrl||'https://amc.gov.in/en/election/'} target="_blank" rel="noreferrer"><strong>AMC Election Department</strong><span>Ward structure, polling lists and final voter-list resources</span></a><a href="https://amc.gov.in/en/corporates/" target="_blank" rel="noreferrer"><strong>AMC Corporators Directory</strong><span>Current 2025–26 elected member names, parties and mobile numbers</span></a></div></section>
  </div>
  <section className="panel ward-info-representatives"><div className="panel-title"><div><h3>Current Nagarsevak / Corporator information</h3><span>Official AMC directory data for this ward.</span></div><StatusPill>{(selected?.users||[]).filter(u=>String(u?.status)==='ACTIVE').filter(u=>String(u?.Role?.name||'').toUpperCase()==='NAGARSEVAK').length} seats</StatusPill></div><p className="muted">The application stores the official directory name, seat, party, mobile and published address for presentation/reference. Login credentials are application accounts, not AMC website credentials.</p><div className="ward-rep-grid">{(selected?.users||[]).filter(u=>String(u?.status)==='ACTIVE').filter(u=>String(u?.Role?.name||'').toUpperCase()==='NAGARSEVAK').map(u=><article className="ward-rep-card" key={u.id}><span className="eyebrow">{u.wardSeat||'NAGARSEVAK'}</span><h3>{u.name}</h3><p><b>Party:</b> {u.partyName||'—'}</p><p><b>Mobile:</b> <a href={`tel:${u.mobile}`}>{u.mobile||'—'}</a></p><p><b>Published address:</b> {u.officialAddress||'—'}</p>{canManageNagarsevak&&<button type="button" className="small-btn" onClick={()=>navigate('/staff')}>Edit Nagarsevak</button>}</article>)}</div></section>
 </div>;
}
