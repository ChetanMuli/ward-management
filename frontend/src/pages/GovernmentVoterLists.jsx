import React,{useEffect,useMemo,useRef,useState} from 'react';
import * as XLSX from 'xlsx';
import {api,getUser} from '../services/api';
import {can,isNagarsevak,isSubMaster} from '../rbac';
import {Empty,ErrorBox,Field,Loading,PageHeader,PaginationBar,RowMenu,StatusPill,SearchableSelect} from '../components/Ui';

const formatBytes=n=>{const x=Number(n||0);if(x<1024)return `${x} B`;if(x<1024*1024)return `${(x/1024).toFixed(1)} KB`;return `${(x/1024/1024).toFixed(1)} MB`};
const formatDate=v=>v?new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
const wardKey=r=>String((Array.isArray(r?.wardIds)&&r.wardIds[0])||'');

function downloadCsv(rows,name){
 if(!rows.length)return;
 const keys=[...new Set(rows.flatMap(r=>Object.keys(r||{})))];
 const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
 const csv=[keys.map(esc).join(','),...rows.map(r=>keys.map(k=>esc(r?.[k])).join(','))].join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name.endsWith('.csv')?name:`${name}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadXlsx(rows,name){
 if(!rows.length)return;
 const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Voter List');XLSX.writeFile(wb,name.endsWith('.xlsx')?name:`${name}.xlsx`);
}

export default function GovernmentVoterLists(){
 const user=getUser();
 const nagarsevak=isNagarsevak(user);
 const subMaster=isSubMaster(user);
 const canUpload=nagarsevak||can('CREATE_GOVERNMENT_VOTER_LISTS',user);
 const ownWard=nagarsevak?String(user?.wardId||''):'';
 const [rows,setRows]=useState(null),[error,setError]=useState(''),[file,setFile]=useState(null),[busy,setBusy]=useState(false),inputRef=useRef(null);
 const [wards,setWards]=useState([]);
 const [uploadWardId,setUploadWardId]=useState(ownWard);
 const [filterWardId,setFilterWardId]=useState(ownWard);
 const [detail,setDetail]=useState(null);
 const [detailSearch,setDetailSearch]=useState(''),[detailPage,setDetailPage]=useState(1),[detailSize,setDetailSize]=useState(25);

 const wardOptions=useMemo(()=>{
  const list=wards||[];
  if(nagarsevak) return list.filter(w=>String(w.id)===ownWard);
  if(subMaster&&Array.isArray(user?.wardIds)&&user.wardIds.length) return list.filter(w=>user.wardIds.map(String).includes(String(w.id)));
  return list;
 },[wards,nagarsevak,subMaster,ownWard,user?.wardIds]);

 function wardLabel(id){
  const w=wards.find(x=>String(x.id)===String(id));
  if(!w) return id?'Unknown ward':'Ward not set';
  return `${w.wardNumber}${w.name?` · ${w.name}`:''}`;
 }

 async function load(){
  try{
   setError('');
   const [lists,wardResponse]=await Promise.all([api.governmentVoterLists(),api.wards()]);
   setRows(lists.data||[]);
   setWards(wardResponse.data||[]);
  }catch(e){setError(e.message);setRows([])}
 }
 useEffect(()=>{load()},[]);

 async function upload(e){
  e.preventDefault();
  const wardId=nagarsevak?ownWard:uploadWardId;
  if(!file) return setError('Please select the government voter-list PDF (or XLSX / CSV).');
  if(file.size>100*1024*1024) return setError('File must be 100 MB or smaller.');
  if(!wardId) return setError('Select the ward this official list belongs to.');
  setBusy(true);setError('');
  try{
   await api.uploadGovernmentVoterList(file,{
    wardIds:[String(wardId)],
    assignmentMode:'ALL_NAGARSEVAKS',
    assignedNagarsevakIds:[]
   });
   setFile(null);if(inputRef.current)inputRef.current.value='';
   if(!nagarsevak) setFilterWardId(String(wardId));
   await load();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }

 async function extract(id){
  setBusy(true);setError('');
  try{
   await api.extractGovernmentVoterList(id);
   await load();
   await openDetails(id);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function openDetails(id){
  try{
   setError('');
   const d=(await api.governmentVoterList(id)).data;
   setDetail(d);setDetailSearch('');setDetailPage(1);
  }catch(e){setError(e.message)}
 }
 async function remove(id){
  if(!confirm('Move this government voter list to Recycle Bin? Extracted names stay recoverable for 30 days.')) return;
  setBusy(true);setError('');
  try{
   await api.deleteGovernmentVoterList(id);
   if(detail?.id===id) setDetail(null);
   await load();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }

 const visibleLists=useMemo(()=>{
  const list=rows||[];
  if(!filterWardId) return list;
  return list.filter(r=>wardKey(r)===String(filterWardId));
 },[rows,filterWardId]);

 const preview=useMemo(()=>Array.isArray(detail?.extractedData)?detail.extractedData:[],[detail]);
 const filtered=useMemo(()=>{
  const q=detailSearch.trim().toLowerCase();
  if(!q) return preview;
  return preview.filter(r=>Object.values(r||{}).some(v=>String(v??'').toLowerCase().includes(q)));
 },[preview,detailSearch]);
 const columns=Object.keys(filtered[0]||preview[0]||{});
 const totalPages=Math.max(1,Math.ceil(filtered.length/detailSize));
 const safePage=Math.min(detailPage,totalPages);
 const pageRows=filtered.slice((safePage-1)*detailSize,safePage*detailSize);
 useEffect(()=>{if(detailPage!==safePage)setDetailPage(safePage)},[detailPage,safePage]);

 return <div className="admin-data-page government-voter-page">
  <PageHeader title="Government voter lists" subtitle="Upload the official Election Commission PDF for one ward. Extracted names stay in this section and are not merged into citizen records."/>
  <ErrorBox error={error}/>

  {canUpload&&<section className="panel government-voter-upload-panel">
   <div className="panel-title"><div><h3>Add government voter list</h3><span>PDF, XLSX or CSV · one ward · maximum 100 MB</span></div></div>
   {nagarsevak&&<div className="info-note">This file is saved for your ward only: {wardLabel(ownWard)}.</div>}
   <form className="government-voter-upload" onSubmit={upload}>
    {!nagarsevak&&<SearchableSelect label="Ward" required value={uploadWardId} onChange={setUploadWardId} options={wardOptions.map(w=>({value:String(w.id),label:`${w.wardNumber}${w.name?` · ${w.name}`:''}`}))} placeholder="Select one ward…"/>}
    <Field label="Government voter-list file">
     <input ref={inputRef} type="file" accept=".pdf,.xlsx,.csv,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>setFile(e.target.files?.[0]||null)}/>
    </Field>
    <div className="government-voter-upload-info">{file?<><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></>:<span>Choose the PDF you received for this ward.</span>}</div>
    <button className="primary-btn" disabled={busy||!file}>{busy?'Extracting…':'Upload & extract'}</button>
   </form>
  </section>}

  <section className="panel">
   <div className="panel-title"><div><h3>Lists by ward</h3><span>Open a file to see every extracted name below.</span></div></div>
   {!nagarsevak&&<div className="filter-toolbar government-voter-filter">
    <SearchableSelect label="Show ward" value={filterWardId} onChange={v=>{setFilterWardId(v);if(detail&&wardKey(detail)!==String(v)&&v)setDetail(null)}} options={[{value:'',label:'All wards'},...wardOptions.map(w=>({value:String(w.id),label:`${w.wardNumber}${w.name?` · ${w.name}`:''}`}))]} placeholder="All wards"/>
   </div>}
   {rows===null?<Loading/>:!visibleLists.length?<Empty>{filterWardId?'No government voter list is uploaded for this ward yet.':'No government voter lists uploaded yet.'}</Empty>:<div className="table-wrap government-voter-table"><table><thead><tr><th>File</th><th>Ward</th><th>Type</th><th>Extracted</th><th>Uploaded by</th><th>Date</th><th>Actions</th></tr></thead><tbody>{visibleLists.map(r=>{
    const selected=detail?.id===r.id;
    return (
     <tr key={r.id} className={selected?'is-selected':''}>
      <td data-label="File"><strong>{r.originalFileName}</strong><div className="muted">{formatBytes(r.fileSize)}</div></td>
      <td data-label="Ward">{wardLabel(wardKey(r))}</td>
      <td data-label="Type"><StatusPill>{r.fileType}</StatusPill></td>
      <td data-label="Extracted">{r.extractedCount||0} records</td>
      <td data-label="Uploaded by">{r.uploader?.name||'—'}</td>
      <td data-label="Date">{formatDate(r.createdAt||r.created_at)}</td>
      <td data-label="Actions"><RowMenu items={[
       {label:selected?'Showing data':'View extracted data',onClick:()=>openDetails(r.id)},
       {label:'Extract again',onClick:()=>extract(r.id)},
       {label:'Download PDF',onClick:()=>api.downloadGovernmentVoterList(r.id).catch(e=>setError(e.message))},
       r.extractedCount>0&&{label:'Extracted Excel',onClick:async()=>{try{const d=detail?.id===r.id?detail:(await api.governmentVoterList(r.id)).data;const data=Array.isArray(d?.extractedData)?d.extractedData:[];if(!data.length)throw new Error('No extracted records are available for this list.');downloadXlsx(data,`${String(r.originalFileName||'voter-list').replace(/\.(pdf|xlsx|csv)$/i,'')}-extracted`)}catch(e){setError(e.message)}}},
       {label:'Delete',danger:true,onClick:()=>remove(r.id)}
      ]}/></td>
     </tr>
    );
   })}</tbody></table></div>}
  </section>

  {detail&&<section className="panel government-voter-data-panel">
   <div className="panel-title">
    <div>
     <h3>{detail.originalFileName}</h3>
     <span>{wardLabel(wardKey(detail))} · {detail.extractedCount||0} extracted records · independent government source</span>
    </div>
    <button type="button" className="ghost-btn" onClick={()=>setDetail(null)}>Close data</button>
   </div>
   <div className="government-voter-summary">
    <div><span>Ward</span><strong>{wardLabel(wardKey(detail))}</strong></div>
    <div><span>File type</span><strong>{detail.fileType}</strong></div>
    <div><span>Records extracted</span><strong>{detail.extractedCount||0}</strong></div>
    <div><span>Uploaded</span><strong>{formatDate(detail.createdAt||detail.created_at)}</strong></div>
   </div>
   <div className="government-voter-detail-toolbar">
    <input className="grow" placeholder="Search name, EPIC, serial, house, age, gender…" value={detailSearch} onChange={e=>{setDetailSearch(e.target.value);setDetailPage(1)}}/>
    <button className="small-btn" disabled={!filtered.length} onClick={()=>downloadCsv(filtered,`${String(detail.originalFileName).replace(/\.(pdf|xlsx|csv)$/i,'')}-extracted`)}>Export CSV</button>
    <button className="small-btn" disabled={!filtered.length} onClick={()=>downloadXlsx(filtered,`${String(detail.originalFileName).replace(/\.(pdf|xlsx|csv)$/i,'')}-extracted`)}>Export Excel</button>
    <button className="small-btn" onClick={()=>api.downloadGovernmentVoterList(detail.id).catch(e=>setError(e.message))}>Download original</button>
   </div>
   {!filtered.length?<Empty>No extracted rows match this search. Upload the PDF again or choose Extract again if the original file is still on the server.</Empty>:<div className="table-wrap government-voter-preview"><table><thead><tr>{columns.map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{pageRows.map((row,i)=><tr key={i}>{columns.map(k=><td key={k}>{String(row?.[k]??'')}</td>)}</tr>)}</tbody></table></div>}
   {filtered.length>0&&<PaginationBar page={safePage} pages={totalPages} total={filtered.length} limit={detailSize} onPage={setDetailPage} onLimit={n=>{setDetailSize(n);setDetailPage(1)}}/>}
  </section>}
 </div>;
}
