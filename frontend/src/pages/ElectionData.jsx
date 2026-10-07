import React,{useEffect,useMemo,useState} from 'react';
import {api,getUser} from '../services/api';
import {roleOf} from '../rbac';
import {ErrorBox,Loading,PageHeader} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {useWardFilter} from '../wardFilter';
import {formatWardNumber, wardDigits} from '../wardFormat';

function LinkBtn({href, children, primary}){
  if(!href) return null;
  return <a className={primary?'primary-btn':'small-btn'} href={href} target="_blank" rel="noreferrer">{children}</a>;
}

export default function ElectionData(){
 const mr=localStorage.getItem('ward_language')==='mr';
 const user=getUser(); const role=roleOf(user);
 const {selectedWardId,wards,canSelect}=useWardFilter();
 const [data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{api.electionData().then(r=>setData(r.data||r)).catch(e=>setError(e.message||'Unable to load election data.'));},[]);
 const selectedDigits=wardDigits(wards.find(w=>String(w.id)===String(selectedWardId))?.wardNumber);
 const rows=useMemo(()=>{
  const all=data?.rows||[];
  if(!canSelect || !selectedDigits) return all;
  return all.filter(r=>wardDigits(r.ward)===selectedDigits);
 },[data,canSelect,selectedDigits]);
 if(!data) return <div className="admin-data-page election-data-page"><PageHeader title={mr?'निवडणूक माहिती':'Election data'}/>{error?<ErrorBox error={error}/>:<Loading/>}</div>;
 const total=rows.reduce((n,r)=>n+Number(r.count||0),0);
 const ownWard=wardDigits(user?.ward?.wardNumber||user?.wardNumber);
 const citySir=(data.sirLists||[]).find(x=>x.ac===225)||(data.sirLists||[])[0];
 const locked=role==='NAGARSEVAK'||role==='EMPLOYEE';
 return <div className="election-data-page">
  <PageHeader title={mr?'निवडणूक माहिती':'Election data'}/>
  <ErrorBox error={error}/>
  <section className="ward-info-selector panel election-ward-filter">
   <div><span className="eyebrow">{mr?'प्रभाग':'WARD'}</span><p className="muted">{locked?(mr?'नगरसेवक / कर्मचारी खाते फक्त आपल्या प्रभागाची यादी दाखवते.':'Your account can open only the lists for your assigned ward.'):(mr?'प्रभाग निवडा. रिकामे = सर्व १७ प्रभाग.':'Select a ward. None / All shows every AMC ward list.')}</p></div>
   <WardFilter label={mr?'प्रभाग निवडा':'Select ward'}/>
  </section>
  <div className="election-source-grid">
   <section className="panel election-source-card">
    <span className="eyebrow">SIR 2026 · AC 225</span>
    <h2>{mr?'अहिल्यानगर शहर SIR यादी':'Ahilyanagar City SIR list'}</h2>
    <p>{mr?'जिल्हा निवडणूक कार्यालय — अहिल्यानगर शहर (विधानसभा २२५) ASDD यादी: अनुपस्थित / स्थलांतरित / मृत / दुबार. इतर विधानसभा यादी येथे दाखवल्या जात नाहीत.':'District Election Office — Ahilyanagar City (Assembly Constituency 225) ASDD list: Absent / Shifted / Dead / Duplicate. Other assembly constituencies are not shown here.'}</p>
    <div className="card-actions">
     <LinkBtn href={citySir?.asddUrl||data.sirUrl} primary>{mr?'अहिल्यानगर SIR ASDD उघडा':'Open Ahilyanagar SIR ASDD'}</LinkBtn>
     <LinkBtn href={citySir?.earlierUrl||data.sirEarlierUrl}>{mr?'मे २०२६ यादी':'May 2026 list'}</LinkBtn>
     <LinkBtn href={data.sirDistrictUrl}>{mr?'जिल्हा निवडणूक कार्यालय':'District Election Office'}</LinkBtn>
    </div>
   </section>
   <section className="panel election-source-card">
    <span className="eyebrow">AMC 2025–26</span>
    <h2>{mr?'महापालिका सर्वसाधारण निवडणूक':'Municipal general election'}</h2>
    <p>{mr?'अहिल्यानगर मनपा प्रभाग यादी. नगरसेवकाला फक्त आपल्या प्रभागाची अंतिम यादी, मतदान केंद्र आणि नकाशा दिसेल.':'Ahilyanagar Municipal Corporation ward lists. A Nagarsevak account receives only that ward’s final list, polling-station folder, and map.'}</p>
    <div className="card-actions">
     <LinkBtn href={data.amcElectionUrl} primary>{mr?'AMC निवडणूक विभाग':'AMC Election Department'}</LinkBtn>
     <LinkBtn href={data.gazetteUrl}>{mr?'राजपत्र १९ जाने २०२६':'Gazette 19 Jan 2026'}</LinkBtn>
     <LinkBtn href={data.draftRollSirUrl}>Draft Roll SIR</LinkBtn>
    </div>
   </section>
  </div>

  <section className="panel election-ward-panel">
   <div className="panel-title"><div><h3>{locked&&ownWard?`${mr?'तुमचा प्रभाग':'Your ward'} · ${formatWardNumber(ownWard)}`:(selectedDigits?`${mr?'निवडलेला प्रभाग':'Selected ward'} · ${formatWardNumber(selectedDigits)}`:(mr?'प्रभागनिहाय अंतिम मतदार यादी':'Ward-wise final voter lists'))}</h3><span>{mr?'AMC अंतिम यादी · १५ डिसेंबर २०२५ · अहिल्यानगर शहर SIR AC २२५':'AMC final lists · 15 December 2025 · Ahilyanagar City SIR AC 225'}</span></div><strong>{total.toLocaleString('en-IN')} {mr?'एकूण':'total'}</strong></div>
   <div className="table-wrap"><table>
    <thead><tr><th>{mr?'प्रभाग':'Ward'}</th><th>{mr?'अंतिम मतदार':'Final electors'}</th><th>{mr?'वसाहती':'Colonies'}</th><th>{mr?'अंतिम यादी':'Final list'}</th><th>{mr?'सुधारणा':'Correction'}</th><th>{mr?'मतदान केंद्र':'Polling stations'}</th><th>{mr?'प्रभाग नकाशा':'Ward map'}</th><th>{mr?'अहिल्यानगर SIR':'Ahilyanagar SIR'}</th></tr></thead>
    <tbody>{rows.length?rows.map(r=><tr key={r.ward}>
     <td data-label={mr?'प्रभाग':'Ward'}><strong>{formatWardNumber(r.ward)}</strong></td>
     <td data-label={mr?'अंतिम मतदार':'Final electors'}><strong>{Number(r.count||0).toLocaleString('en-IN')}</strong></td>
     <td data-label={mr?'वसाहती':'Colonies'}><span className="election-colony-cell">{(r.colonies||[]).join(', ')||'—'}</span></td>
     <td data-label={mr?'अंतिम यादी':'Final list'}><a className="table-link" href={r.finalListUrl||r.url} target="_blank" rel="noreferrer">{mr?'यादी ↗':'Open list ↗'}</a></td>
     <td data-label={mr?'सुधारणा':'Correction'}>{r.supplementUrl?<a className="table-link" href={r.supplementUrl} target="_blank" rel="noreferrer">{mr?'सुधारित ↗':'Corrected ↗'}</a>:<span className="muted">—</span>}</td>
     <td data-label={mr?'मतदान केंद्र':'Polling stations'}><a className="table-link" href={r.pollingFolderUrl} target="_blank" rel="noreferrer">{mr?'फोल्डर ↗':'Folder ↗'}</a></td>
     <td data-label={mr?'नकाशा':'Map'}><a className="table-link" href={r.mapUrl} target="_blank" rel="noreferrer">{mr?'नकाशा ↗':'Map ↗'}</a></td>
     <td data-label={mr?'अहिल्यानगर SIR':'Ahilyanagar SIR'}><a className="table-link" href={citySir?.asddUrl||data.sirUrl} target="_blank" rel="noreferrer">{mr?'SIR ↗':'SIR ↗'}</a></td>
    </tr>):<tr><td colSpan="8"><p className="muted">{mr?'या प्रभागासाठी यादी उपलब्ध नाही.':'No list for this ward.'}</p></td></tr>}</tbody>
   </table></div>
  </section>

  <div className="election-source-grid">
   <section className="panel">
    <div className="panel-title"><div><h3>{mr?'अधिकृत कागदपत्रे':'Official documents'}</h3><span>{mr?'मनपा निवडणूक विभाग':'AMC Election Department'}</span></div></div>
    <div className="source-list">
     <a href={data.boothListUrl} target="_blank" rel="noreferrer"><strong>{mr?'बूथ पत्ता यादी (३० डिसेंबर २०२५)':'Booth address list (30 Dec 2025)'}</strong><span>{mr?'सर्व १७ प्रभागांची एकत्रित यादी':'Consolidated list for all 17 wards'}</span></a>
     <a href={data.gazetteUrl} target="_blank" rel="noreferrer"><strong>{mr?'महाराष्ट्र राजपत्र — १९ जानेवारी २०२६':'Maharashtra gazette — 19 January 2026'}</strong><span>{mr?'अहिल्यानगर मनपा सर्वसाधारण निवडणूक अधिसूचना':'AMC general election notification'}</span></a>
     <a href={data.finalWardNoticeUrl} target="_blank" rel="noreferrer"><strong>{mr?'अंतिम प्रभाग रचना सूचना':'Final ward composition notice'}</strong><span>22 January 2026</span></a>
     {(data.results||[]).filter(r=>{
       if(!selectedDigits) return true;
       const n=Number(selectedDigits);
       return (r.wardNos||[]).includes(n);
     }).map(r=><a key={r.label} href={r.url} target="_blank" rel="noreferrer"><strong>{mr?'मतमोजणी निकाल':'Counting result'} · {mr?r.labelMr:r.label}</strong><span>20 January 2026</span></a>)}
    </div>
   </section>
   <section className="panel">
    <div className="panel-title"><div><h3>{mr?'निवडणूक संपर्क':'Election contact'}</h3><span>{data.contact?.department}</span></div></div>
    {data.contact&&<div className="election-facts">
     <div><small>{mr?'विभाग प्रमुख':'Department head'}</small><strong>{data.contact.head}</strong></div>
     <div><small>{mr?'मोबाइल':'Mobile'}</small><strong><a href={`tel:${data.contact.mobile}`}>{data.contact.mobile}</a></strong></div>
     <div><small>Email</small><strong><a href={`mailto:${data.contact.email}`}>{data.contact.email}</a></strong></div>
     <div><small>{mr?'टोल-फ्री':'Toll-free'}</small><strong><a href={`tel:${data.contact.helpline.replace(/\s/g,'')}`}>{data.contact.helpline}</a></strong></div>
     <div><small>{mr?'आचारसंहिता कक्ष':'Code of conduct room'}</small><strong><a href={`tel:${String(data.contact.controlRoom||'').replace(/\s/g,'')}`}>{data.contact.controlRoom}</a></strong></div>
     <div><small>{mr?'आचारसंहिता ईमेल':'Conduct email'}</small><strong><a href={`mailto:${data.contact.conductEmail}`}>{data.contact.conductEmail}</a></strong></div>
    </div>}
    {!locked&&<>
     <div className="panel-title election-subhead"><div><h3>{mr?'स्वीकृत नगरसेवक कागदपत्रे':'Accepted Nagarsevak documents'}</h3><span>{mr?'AMC पोर्टलवर प्रकाशित. संपूर्ण ६८ जागांची यादी नाही.':'Published on the AMC portal. This is not the full 68-seat directory.'}</span></div></div>
     <div className="source-list">{(data.acceptedNagarsevak||[]).map(p=><a key={p.url} href={p.url} target="_blank" rel="noreferrer"><strong>{mr?p.nameMr:p.name}</strong><span>{mr?'स्वीकृत नगरसेवक कागदपत्र':'Accepted Nagarsevak document'}</span></a>)}</div>
    </>}
   </section>
  </div>
 </div>;
}
