import React,{useEffect,useMemo,useState} from 'react';
import {api} from '../services/api';
import {Empty,ErrorBox,Field,Loading,Modal,PageHeader,PaginationBar,RowMenu,Toolbar,SearchableSelect} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {filterByWard,useWardFilter} from '../wardFilter';
import {can} from '../rbac';

const blank={houseNumber:'',wardId:'',areaId:'',address:'',landmark:'',houseType:'',ownership:'',ownerName:'',ownerMobile:'',latitude:'',longitude:'',notes:''};

export default function Houses(){
 const {selectedWardId}=useWardFilter();
 const [rows,setRows]=useState(null),[wards,setWards]=useState([]),[filters,setFilters]=useState({search:'',ownership:'',houseType:''}),[edit,setEdit]=useState(null),[add,setAdd]=useState(null),[detail,setDetail]=useState(null),[error,setError]=useState('');
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(25);

 async function load(){try{setError('');setRows((await api.houses({limit:500,...filters,wardId:selectedWardId||undefined})).data||[])}catch(e){setError(e.message)}}
 useEffect(()=>{const t=setTimeout(()=>load(),250);return()=>clearTimeout(t)},[selectedWardId,filters.search,filters.ownership,filters.houseType]);
 useEffect(()=>{api.wards().then(r=>setWards(r.data||[])).catch(e=>setError(e.message))},[]);
 useEffect(()=>{setPage(1)},[selectedWardId,filters.search,filters.ownership,filters.houseType]);

 const visible=useMemo(()=>filterByWard(rows||[],selectedWardId).filter(h=>!filters.search||`${h.houseNumber||''} ${h.address||''} ${h.ownerName||''} ${h.ownerMobile||''} ${h.area?.name||''}`.toLowerCase().includes(filters.search.toLowerCase())),[rows,selectedWardId,filters.search]);
 const total=visible.length;
 const pages=Math.max(1,Math.ceil(total/pageSize));
 const currentPage=Math.min(page,pages);
 const pageRows=visible.slice((currentPage-1)*pageSize,currentPage*pageSize);
 const wardOptions=wards.map(w=>({value:w.id,label:`${w.wardNumber} · ${w.name||''}`}));
 const form=edit||add;
 const formWardId=form?.wardId||form?.area?.wardId||form?.area?.ward?.id||'';
 const formAreas=(wards.find(w=>String(w.id)===String(formWardId))?.areas||[]).map(a=>({value:a.id,label:a.name}));
 function openAdd(){setAdd({...blank,wardId:selectedWardId||''});}
 function openEdit(h){setEdit({...h,wardId:h.area?.wardId||h.area?.ward?.id||''});}
 function changeForm(next){if(edit)setEdit(next);else setAdd(next)}
 async function save(e){e.preventDefault();try{const payload={...form};delete payload.wardId;delete payload.area;delete payload.families;if(edit)await api.updateHouse(edit.id,payload);else await api.createHouse(payload);setEdit(null);setAdd(null);await load()}catch(e){setError(e.message)}}
 return <div className="admin-data-page houses-page">
  <PageHeader kicker="People & houses" title="Houses" subtitle="Maintain a clean ward → colony → house hierarchy. Owner details are optional." action={can('CREATE_HOUSES')?<button className="primary-btn" onClick={openAdd}>+ Add house</button>:null}/>
  <ErrorBox error={error}/>
  <Toolbar><WardFilter/><input className="grow" placeholder="Search house number, address, owner, colony…" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/><select value={filters.ownership} onChange={e=>setFilters({...filters,ownership:e.target.value})}><option value="">All ownership</option><option>OWN</option><option>RENT</option><option>OTHER</option></select><select value={filters.houseType} onChange={e=>setFilters({...filters,houseType:e.target.value})}><option value="">All house types</option><option>INDEPENDENT_HOUSE</option><option>FLAT</option><option>CHAWL</option><option>OTHER</option></select></Toolbar>
  {!rows?<Loading/>:!total?<Empty>No houses found for this ward/filter.</Empty>:<>
   <div className="panel table-wrap"><table><thead><tr><th>House</th><th>Area / Colony</th><th>Address</th><th>Owner</th><th></th></tr></thead><tbody>{pageRows.map(h=><tr key={h.id}><td data-label="House"><button className="table-link" onClick={()=>api.house(h.id).then(r=>setDetail(r.data)).catch(e=>setError(e.message))}><strong>{h.houseNumber}</strong></button><div className="muted">{h.houseType?.replaceAll('_',' ')||'—'}</div></td><td data-label="Area / Colony">{h.area?.ward?.wardNumber||'—'}<div className="muted">{h.area?.name||'—'}</div></td><td data-label="Address">{h.address}<div className="muted">{h.landmark||''}</div></td><td data-label="Owner">{h.ownerName||'—'}<div className="muted">{h.ownerMobile||''}</div></td><td data-label="Actions"><RowMenu items={[
     {label:'View details',onClick:()=>api.house(h.id).then(r=>setDetail(r.data)).catch(e=>setError(e.message))},
     can('EDIT_HOUSES')&&{label:'Edit',onClick:()=>openEdit(h)},
     can('DELETE_HOUSES')&&{label:'Delete',danger:true,onClick:async()=>{if(confirm('Move house to recycle bin?')){try{await api.deleteHouse(h.id);await load()}catch(e){setError(e.message)}}}}
    ]}/></td></tr>)}</tbody></table></div>
   <PaginationBar page={currentPage} pages={pages} total={total} limit={pageSize} onPage={setPage} onLimit={setPageSize}/>
  </>}
  {detail&&<Modal wide title={`${detail.houseNumber} · House profile`} onClose={()=>setDetail(null)}><div className="detail-grid"><div className="detail-card"><h3>Location</h3><p><b>Ward:</b> {detail.area?.ward?.wardNumber||'—'} · {detail.area?.ward?.name||''}</p><p><b>Colony / Area:</b> {detail.area?.name||'—'}</p><p><b>Address:</b> {detail.address||'—'}</p><p><b>Landmark:</b> {detail.landmark||'—'}</p></div><div className="detail-card"><h3>Ownership</h3><p><b>Type:</b> {detail.houseType?.replaceAll('_',' ')||'—'}</p><p><b>Ownership:</b> {detail.ownership||'—'}</p><p><b>Owner:</b> {detail.ownerName||'—'}</p><p><b>Owner mobile:</b> {detail.ownerMobile||'—'}</p></div><div className="detail-card"><h3>Families</h3>{(detail.families||[]).map(f=><div className="member-card" key={f.id}><strong>{f.familyName||'Unnamed family'}</strong><span>{f.members?.length||0} members</span></div>)}{!(detail.families||[]).length&&<span className="muted">No family linked yet.</span>}</div></div></Modal>}
  {form&&<Modal wide title={edit?`Edit ${edit.houseNumber}`:'Add house'} onClose={()=>{setEdit(null);setAdd(null)}}><form className="form-grid" onSubmit={save}>
   <Field label="Ward *"><SearchableSelect required value={formWardId} onChange={v=>changeForm({...form,wardId:v,areaId:''})} options={wardOptions} placeholder="Search ward…"/></Field>
   <Field label="Colony / Area *"><SearchableSelect required value={form.areaId||''} onChange={v=>changeForm({...form,areaId:v})} options={formAreas} placeholder={formWardId?'Search colony / area…':'Select ward first'}/></Field>
   <Field label="House number *"><input required value={form.houseNumber||''} onChange={e=>changeForm({...form,houseNumber:e.target.value})} placeholder="e.g. H-101"/></Field>
   <Field label="House type *"><select required value={form.houseType||''} onChange={e=>changeForm({...form,houseType:e.target.value})}><option value="">Select house type</option><option>INDEPENDENT_HOUSE</option><option>FLAT</option><option>CHAWL</option><option>OTHER</option></select></Field>
   <Field className="span-2" label="Complete address *"><textarea required value={form.address||''} onChange={e=>changeForm({...form,address:e.target.value})} placeholder="Full address"/></Field>
   <Field label="Landmark (optional)"><input value={form.landmark||''} onChange={e=>changeForm({...form,landmark:e.target.value})} placeholder="Optional landmark"/></Field>
   <Field label="Ownership *"><select required value={form.ownership||''} onChange={e=>changeForm({...form,ownership:e.target.value})}><option value="">Select ownership</option><option>OWN</option><option>RENT</option><option>OTHER</option></select></Field>
   <Field label="Owner name (optional)"><input value={form.ownerName||''} onChange={e=>changeForm({...form,ownerName:e.target.value})} placeholder="Optional"/></Field>
   <Field label="Owner mobile (optional)"><input inputMode="numeric" maxLength={10} value={form.ownerMobile||''} onChange={e=>changeForm({...form,ownerMobile:e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="Optional 10 digit mobile"/></Field>
   <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>{setEdit(null);setAdd(null)}}>Cancel</button><button className="primary-btn">{edit?'Save changes':'Save house'}</button></div>
  </form></Modal>}
 </div>;
}
