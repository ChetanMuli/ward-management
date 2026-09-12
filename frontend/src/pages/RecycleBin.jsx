import React,{useEffect,useMemo,useState} from 'react';
import {getUser} from '../services/api';
import {api} from '../services/api';
import {Empty,ErrorBox,Loading,PageHeader,StatusPill,Toolbar,fmtDate,Modal} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {filterByWard,useWardFilter} from '../wardFilter';
import {isMaster} from '../rbac';

const labelize=k=>String(k||'').replaceAll('_',' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\b\w/g,m=>m.toUpperCase());
const value=v=>v===null||v===undefined||v===''?'N/A':typeof v==='object'?JSON.stringify(v):String(v);
function RecordDetails({item}){
 const r=item?.record||{}; const e=item?.entity||'';
 const common=[['ID',r.id],['Created',r.createdAt?new Date(r.createdAt).toLocaleString('en-IN'):null],['Deleted',r.deletedAt?new Date(r.deletedAt).toLocaleString('en-IN'):null]];
 const groups={
  Person:{title:'Citizen information',fields:[['Name',r.fullName],['Mobile',r.mobile],['Email',r.email],['Date of birth',r.dob],['Gender',r.gender],['Occupation',r.occupationType],['Business',r.businessName],['Company',r.companyName],['Employment',r.employmentType],['Notes',r.notes]]},
  Family:{title:'Family information',fields:[['Family name',r.familyName],['House ID',r.houseId],['Notes',r.notes]]},
  House:{title:'House information',fields:[['House number',r.houseNumber],['Address',r.address],['Landmark',r.landmark],['House type',r.houseType],['Ownership',r.ownership],['Owner name',r.ownerName],['Owner mobile',r.ownerMobile],['Notes',r.notes]]},
  Ward:{title:'Ward information',fields:[['Ward number',r.wardNumber],['Ward name',r.name],['Description',r.description],['Account access',r.accountStatus||r.status]]},
  Area:{title:'Colony / Area information',fields:[['Name',r.name],['Description',r.description],['Ward ID',r.wardId]]},
  Complaint:{title:'Complaint information',fields:[['Complaint number',r.complaintNumber],['Citizen',r.citizenPersonId],['House',r.houseId],['Status',r.status],['Description',r.description],['Resolution',r.resolutionNote],['Assigned employee',r.assignedEmployeeId]]},
  VoterProfile:{title:'Voter information',fields:[['Status',r.status],['Voting ward',r.votingWard],['Voter ID',r.officialVoterIdRef],['Constituency',r.constituency],['Notes',r.notes]]},
  GovernmentVoterList:{title:'Government voter list',fields:[['File name',r.originalFileName],['File type',r.fileType],['File size',r.fileSize],['Extracted records',r.extractedCount],['Uploaded by',r.uploadedBy]]}
 };
 const g=groups[e]||{title:'Record information',fields:Object.entries(r).filter(([k])=>!['createdAt','updatedAt','deletedAt'].includes(k)).slice(0,18)};
 return <div className="recycle-detail-stack"><div className="recycle-record-head"><StatusPill>{e||'Record'}</StatusPill><div><h3>{g.title}</h3><span>{r.id||'Record ID unavailable'}</span></div></div><div className="detail-grid recycle-detail-grid"><div className="detail-card"><h3>Record</h3>{common.map(([k,v])=><p key={k}><b>{k}:</b> {value(v)}</p>)}</div><div className="detail-card recycle-fields"><h3>Details</h3>{g.fields.map(([k,v])=><p key={k}><b>{labelize(k)}:</b> {value(v)}</p>)}</div></div></div>;
}

export default function RecycleBin(){
 const {selectedWardId}=useWardFilter(); const user=getUser(); const [rows,setRows]=useState(null),[type,setType]=useState(''),[detail,setDetail]=useState(null),[error,setError]=useState('');
 async function load(){try{setError('');setRows((await api.recycleBin(type?{type}:{limit:500})).data||[])}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[type,selectedWardId]);
 const visible=useMemo(()=>filterByWard(rows||[],selectedWardId),[rows,selectedWardId]);
 async function restore(r){try{await api.restore(r.entity,r.record.id);setDetail(null);await load()}catch(e){setError(e.message)}}
 return <div className="admin-data-page recycle-page">
  <PageHeader title="Recycle bin" subtitle="Deleted records remain recoverable for 30 days, then are permanently removed." action={isMaster(user)?<button className="ghost-btn danger" onClick={async()=>{if(!confirm('Permanently clear all records currently in the recycle bin? This cannot be undone.'))return;try{await api.clearRecycleBin();setRows([]);window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'success',message:'Recycle bin cleared permanently.'}}))}catch(e){setError(e.message)}}}>Clear recycle bin</button>:null}/>
  <ErrorBox error={error}/>
  <section className="panel recycle-filter-panel"><div className="filter-panel-head"><div><span className="eyebrow">RECOVERABLE DATA</span><h3>Find deleted records</h3><p>Review complete record information before restoring.</p></div><span className="auto-filter-badge">● Auto updated</span></div><Toolbar><WardFilter/><label className="filter-field"><span className="section-label">Record type</span><select value={type} onChange={e=>setType(e.target.value)}><option value="">All types</option>{['Person','Family','House','Ward','Area','Complaint','VoterProfile','GovernmentVoterList'].map(x=><option key={x}>{x}</option>)}</select></label></Toolbar></section>
  {!rows?<Loading/>:!visible.length?<Empty>Recycle bin is empty for this ward.</Empty>:<div className="panel table-wrap"><table><thead><tr><th>Type</th><th>Record</th><th>Deleted</th><th>Ward context</th><th></th></tr></thead><tbody>{visible.map((x,i)=><tr key={`${x.entity}-${x.record?.id}-${i}`}><td data-label="Type"><StatusPill>{x.entity}</StatusPill></td><td data-label="Record"><strong>{x.record?.fullName||x.record?.familyName||x.record?.houseNumber||x.record?.wardNumber||x.record?.name||x.record?.complaintNumber||x.record?.id}</strong><div className="muted">{x.record?.id||'No ID'}</div></td><td data-label="Deleted">{fmtDate(x.record?.deletedAt)}</td><td data-label="Ward context">{x.record?.wardNumber||x.record?.ward?.wardNumber||x.record?.wardId||'N/A'}</td><td data-label="Actions"><div className="card-actions"><button className="small-btn view-btn" onClick={()=>setDetail(x)}>View details</button><button className="small-btn" onClick={()=>restore(x)}>Restore</button></div></td></tr>)}</tbody></table></div>}
  {detail&&<Modal wide title={`${detail.entity||'Record'} · Deleted record details`} onClose={()=>setDetail(null)}><RecordDetails item={detail}/><div className="modal-actions"><button className="ghost-btn" onClick={()=>setDetail(null)}>Close</button><button className="primary-btn" onClick={()=>restore(detail)}>Restore record</button></div></Modal>}
 </div>
}
