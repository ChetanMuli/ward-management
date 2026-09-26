import React,{useEffect,useState} from 'react';
import {api,getUser} from '../services/api';
import {roleOf} from '../rbac';
import {ErrorBox,Loading,PageHeader} from '../components/Ui';

export default function ElectionData(){
 const mr=localStorage.getItem('ward_language')==='mr';
 const user=getUser(); const role=roleOf(user);
 const [data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{api.electionData().then(r=>setData(r.data||r)).catch(e=>setError(e.message||'Unable to load election data.'));},[]);
 if(!data) return <div className="admin-data-page election-data-page"><PageHeader title={mr?'निवडणूक माहिती':'Election data'}/>{error?<ErrorBox error={error}/>:<Loading/>}</div>;
 const rows=data.rows||[]; const total=rows.reduce((n,r)=>n+Number(r.count||0),0);
 const ownWard=String(user?.ward?.wardNumber||user?.wardNumber||'').replace(/^W-?/i,'').padStart(2,'0');
 return <div>
  <PageHeader title={mr?'निवडणूक माहिती':'Election data'}/>
  <ErrorBox error={error}/>
  <div className="election-source-grid">
   <section className="panel election-source-card"><span className="eyebrow">SIR 2026</span><h2>{mr?'विशेष सखोल पुनरीक्षण':'Special Intensive Revision'}</h2><p>{mr?'अधिकृत ASDD यादी.':'Official ASDD list for Assembly Constituency 225, Ahmednagar City.'}</p><div className="card-actions"><a className="primary-btn" href={data.sirUrl} target="_blank" rel="noreferrer">Open SIR 2026 ASDD list</a><a className="small-btn" href={data.sirDistrictUrl} target="_blank" rel="noreferrer">Official District Election Office</a></div></section>
   <section className="panel election-source-card election-warning"><span className="eyebrow">DATA NOTE</span><h2>{mr?'वॉर्डनुसार अचूकता':'Ward-wise accuracy'}</h2><p>{mr?'खाली अधिकृत AMC अंतिम मतदार यादीचा वॉर्डनुसार बेसलाइन दिला आहे.':'The table below uses the official AMC final voter-list baseline for each municipal ward.'}</p><a className="small-btn" href={data.amcElectionUrl} target="_blank" rel="noreferrer">AMC official Election Department</a></section>
  </div>
  <section className="panel election-ward-panel">
   <div className="panel-title"><div><h3>{role==='NAGARSEVAK'&&ownWard?`Your ward final voter baseline · W-${ownWard}`:'Ward-wise final voter baseline'}</h3><span>Official AMC final voter list · published 15 December 2025</span></div><strong>{total.toLocaleString('en-IN')} total</strong></div>
   <div className="table-wrap"><table><thead><tr><th>Ward</th><th>Final electors</th><th>Official list</th><th>SIR 2026</th></tr></thead><tbody>{rows.map(r=><tr key={r.ward}><td data-label="Ward"><strong>{r.ward}</strong></td><td data-label="Final electors"><strong>{Number(r.count||0).toLocaleString('en-IN')}</strong></td><td data-label="Official list"><a className="table-link" href={r.url} target="_blank" rel="noreferrer">Open final list ↗</a></td><td data-label="SIR 2026"><a className="table-link" href={data.sirUrl} target="_blank" rel="noreferrer">AC 225 ASDD ↗</a></td></tr>)}</tbody></table></div>
  </section>
  {role==='NAGARSEVAK'&&ownWard&&<div className="info-note">Your Nagarsevak account is restricted to Ward W-{ownWard}. Other ward election data is not returned by the server.</div>}
 </div>;
}
