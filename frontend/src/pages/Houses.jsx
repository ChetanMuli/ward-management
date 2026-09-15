import React,{useEffect,useMemo,useState} from 'react';
import {api} from '../services/api';
import {Empty,ErrorBox,Field,Loading,Modal,PageHeader,PaginationBar,RowMenu,Toolbar,SearchableSelect} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {filterByWard,useWardFilter} from '../wardFilter';
import {can,canModule,isNagarsevak,isEmployee} from '../rbac';
import {directionsUrl,geoPayload,hasCoords,housePlace,placeLine} from '../location';
import LocationPicker,{DirectionsLink,MapPreview} from '../components/LocationMap';

const blank={houseNumber:'',wardId:'',areaId:'',address:'',landmark:'',city:'',pincode:'',houseType:'',ownership:'',ownerName:'',ownerMobile:'',latitude:'',longitude:'',notes:''};

export default function Houses(){
 const {selectedWardId}=useWardFilter();
 const [rows,setRows]=useState(null),[wards,setWards]=useState([]),[filters,setFilters]=useState({search:'',ownership:'',houseType:''}),[edit,setEdit]=useState(null),[add,setAdd]=useState(null),[detail,setDetail]=useState(null),[error,setError]=useState('');
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(25),[houseLoc,setHouseLoc]=useState(null),[busyLoc,setBusyLoc]=useState(false);
 const canPin=can('EDIT_HOUSES')||canModule('HOUSES','EDIT')||can('CREATE_HOUSES')||isNagarsevak()||isEmployee();

 async function load(){try{setError('');setRows((await api.houses({limit:500,...filters,wardId:selectedWardId||undefined})).data||[])}catch(e){setError(e.message)}}
 useEffect(()=>{const t=setTimeout(()=>load(),250);return()=>clearTimeout(t)},[selectedWardId,filters.search,filters.ownership,filters.houseType]);
 useEffect(()=>{api.wards().then(r=>setWards(r.data||[])).catch(e=>setError(e.message))},[]);
 useEffect(()=>{setPage(1)},[selectedWardId,filters.search,filters.ownership,filters.houseType]);

 const visible=useMemo(()=>filterByWard(rows||[],selectedWardId).filter(h=>!filters.search||`${h.houseNumber||''} ${h.address||''} ${h.ownerName||''} ${h.ownerMobile||''} ${h.area?.name||''} ${h.city||''} ${h.pincode||''} ${h.landmark||''}`.toLowerCase().includes(filters.search.toLowerCase())),[rows,selectedWardId,filters.search]);
 const total=visible.length;
 const pages=Math.max(1,Math.ceil(total/pageSize));
 const currentPage=Math.min(page,pages);
 const pageRows=visible.slice((currentPage-1)*pageSize,currentPage*pageSize);
 const wardOptions=wards.map(w=>({value:w.id,label:`${w.wardNumber} · ${w.name||''}`}));
 const form=edit||add;
 const formWardId=form?.wardId||form?.area?.wardId||form?.area?.ward?.id||'';
 const formAreas=(wards.find(w=>String(w.id)===String(formWardId))?.areas||[]).map(a=>({value:a.id,label:a.name}));
 const selectedArea=(wards.find(w=>String(w.id)===String(formWardId))?.areas||[]).find(a=>String(a.id)===String(form?.areaId));
 const selectedWard=wards.find(w=>String(w.id)===String(formWardId));
 function openAdd(){setAdd({...blank,wardId:selectedWardId||''});}
 function openEdit(h){setEdit({...blank,...h,wardId:h.area?.wardId||h.area?.ward?.id||'',latitude:hasCoords(h.latitude,h.longitude)?(h.latitude??''):'',longitude:hasCoords(h.latitude,h.longitude)?(h.longitude??''):'',city:h.city||h.area?.city||'',pincode:h.pincode||h.area?.pincode||''});}
 function changeForm(next){if(edit)setEdit(next);else setAdd(next)}
 function openHouseLoc(h,fromDetail=false){
  if(!h) return;
  setHouseLoc({id:h.id,houseNumber:h.houseNumber,latitude:hasCoords(h.latitude,h.longitude)?h.latitude:'',longitude:hasCoords(h.latitude,h.longitude)?h.longitude:'',area:h.area||null,fromDetail});
  if(fromDetail) setDetail(null);
 }
 async function saveHouseLoc(e){
  e.preventDefault();
  if(!houseLoc?.id) return;
  setBusyLoc(true);
  try{
   await api.updateHouse(houseLoc.id,geoPayload(houseLoc,['latitude','longitude']));
   const id=houseLoc.id;
   const reopen=houseLoc.fromDetail;
   setHouseLoc(null);
   await load();
   if(reopen) setDetail((await api.house(id)).data);
  }catch(err){setError(err.message)}
  finally{setBusyLoc(false)}
 }
 async function save(e){e.preventDefault();try{const payload={houseNumber:form.houseNumber,areaId:form.areaId,address:form.address,landmark:form.landmark||null,houseType:form.houseType,ownership:form.ownership,ownerName:form.ownerName||null,ownerMobile:form.ownerMobile||null,notes:form.notes||null,...geoPayload(form,['city','pincode','latitude','longitude'])};if(edit)await api.updateHouse(edit.id,payload);else await api.createHouse(payload);setEdit(null);setAdd(null);await load()}catch(e){setError(e.message)}}
 return <div className="admin-data-page houses-page">
  <PageHeader kicker="People & houses" title="Houses" subtitle="When you visit a home, save the exact door with GPS. Later, tap the location to open maps and get directions." action={can('CREATE_HOUSES')?<button className="primary-btn" onClick={openAdd}>+ Add house</button>:null}/>
  <ErrorBox error={error}/>
  <Toolbar><WardFilter/><input className="grow" placeholder="Search house number, address, owner, colony…" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/><select value={filters.ownership} onChange={e=>setFilters({...filters,ownership:e.target.value})}><option value="">All ownership</option><option>OWN</option><option>RENT</option><option>OTHER</option></select><select value={filters.houseType} onChange={e=>setFilters({...filters,houseType:e.target.value})}><option value="">All house types</option><option>INDEPENDENT_HOUSE</option><option>FLAT</option><option>CHAWL</option><option>OTHER</option></select></Toolbar>
  {!rows?<Loading/>:!total?<Empty>No houses found for this ward/filter.</Empty>:<>
   <div className="panel table-wrap houses-table"><table><thead><tr><th>House</th><th>Area / Colony</th><th>Address</th><th>Location</th><th>Owner</th><th></th></tr></thead><tbody>{pageRows.map(h=><tr key={h.id}><td data-label="House"><button className="table-link" onClick={()=>api.house(h.id).then(r=>setDetail(r.data)).catch(e=>setError(e.message))}><strong>{h.houseNumber}</strong></button><div className="muted">{h.houseType?.replaceAll('_',' ')||'—'}</div></td><td data-label="Area / Colony">{h.area?.ward?.wardNumber||'—'}<div className="muted">{h.area?.name||'—'}</div></td><td data-label="Address">{h.address}<div className="muted">{placeLine([h.landmark,h.city||h.area?.city,h.pincode||h.area?.pincode])}</div></td><td data-label="Location"><div className="loc-cell">{hasCoords(h.latitude,h.longitude)?<DirectionsLink lat={h.latitude} lng={h.longitude} label="Directions"/>:<span className="muted">Not saved</span>}</div></td><td data-label="Owner">{h.ownerName||'—'}<div className="muted">{h.ownerMobile||''}</div></td><td data-label="Actions"><RowMenu items={[
     {label:'View details',onClick:()=>api.house(h.id).then(r=>setDetail(r.data)).catch(e=>setError(e.message))},
     hasCoords(h.latitude,h.longitude)&&{label:'Get directions',onClick:()=>window.open(directionsUrl(h.latitude,h.longitude),'_blank','noopener')},
     canPin&&{label:'Update location',onClick:()=>openHouseLoc(h,false)},
     can('EDIT_HOUSES')&&{label:'Edit',onClick:()=>openEdit(h)},
     can('DELETE_HOUSES')&&{label:'Delete',danger:true,onClick:async()=>{if(confirm('Move house to recycle bin?')){try{await api.deleteHouse(h.id);await load()}catch(e){setError(e.message)}}}}
    ]}/></td></tr>)}</tbody></table></div>
   <PaginationBar page={currentPage} pages={pages} total={total} limit={pageSize} onPage={setPage} onLimit={setPageSize}/>
  </>}
  {detail&&<Modal wide title={`${detail.houseNumber} · House profile`} onClose={()=>setDetail(null)}><div className="detail-grid"><div className="detail-card"><h3>Location</h3><p><b>Path:</b> {housePlace(detail)||'—'}</p><p><b>Ward:</b> {detail.area?.ward?.wardNumber||'—'} · {detail.area?.ward?.name||''}</p><p><b>Colony / Area:</b> {detail.area?.name||'—'}</p><p><b>Address:</b> {detail.address||'—'}</p><p><b>Landmark:</b> {detail.landmark||'—'}</p><p><b>City / pincode:</b> {placeLine([detail.city||detail.area?.city,detail.pincode||detail.area?.pincode])||'—'}</p></div><div className="detail-card"><h3>Go to this home</h3><MapPreview lat={detail.latitude} lng={detail.longitude} label={`House ${detail.houseNumber}`}>{canPin&&<button type="button" className="small-btn loc-update-btn" onClick={()=>openHouseLoc(detail,true)}>Update location</button>}</MapPreview></div><div className="detail-card"><h3>Ownership</h3><p><b>Type:</b> {detail.houseType?.replaceAll('_',' ')||'—'}</p><p><b>Ownership:</b> {detail.ownership||'—'}</p><p><b>Owner:</b> {detail.ownerName||'—'}</p><p><b>Owner mobile:</b> {detail.ownerMobile||'—'}</p></div><div className="detail-card"><h3>Families</h3>{(detail.families||[]).map(f=><div className="member-card" key={f.id}><strong>{f.familyName||'Unnamed family'}</strong><span>{f.members?.length||0} members</span></div>)}{!(detail.families||[]).length&&<span className="muted">No family linked yet.</span>}</div></div></Modal>}
  {houseLoc&&<Modal wide title={`Update location · House ${houseLoc.houseNumber||''}`} onClose={()=>{const reopen=houseLoc.fromDetail;const id=houseLoc.id;setHouseLoc(null);if(reopen) api.house(id).then(r=>setDetail(r.data)).catch(()=>{});}}><form className="form-grid admin-form" onSubmit={saveHouseLoc}><div className="form-section-title span-2"><strong>Exact home location</strong><span>Stand at the door, tap Use GPS, or tap the map. Families inherit this pin.</span></div><LocationPicker key={houseLoc.id} value={houseLoc} onChange={next=>setHouseLoc({...houseLoc,...next})} centerFrom={[houseLoc.area,houseLoc.area?.ward]} hint="Use GPS at the house door so the next visit can open directions."/><div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>{const reopen=houseLoc.fromDetail;const id=houseLoc.id;setHouseLoc(null);if(reopen) api.house(id).then(r=>setDetail(r.data)).catch(()=>{});}}>Cancel</button><button className="primary-btn" disabled={busyLoc}>{busyLoc?'Saving…':'Save location'}</button></div></form></Modal>}
  {form&&<Modal wide title={edit?`Edit ${edit.houseNumber}`:'Add house'} onClose={()=>{setEdit(null);setAdd(null)}}><form className="form-grid admin-form" onSubmit={save}>
   <div className="form-section-title span-2"><strong>Ward & colony</strong><span>Pick the ward and colony first. Exact GPS is saved when you are standing at this home.</span></div>
   <Field label="Ward *"><SearchableSelect required value={formWardId} onChange={v=>changeForm({...form,wardId:v,areaId:''})} options={wardOptions} placeholder="Search ward…"/></Field>
   <Field label="Colony / Area *"><SearchableSelect required value={form.areaId||''} onChange={v=>{const a=(wards.find(w=>String(w.id)===String(formWardId))?.areas||[]).find(x=>String(x.id)===String(v));const w=selectedWard;changeForm({...form,areaId:v,city:form.city||a?.city||w?.city||'',pincode:form.pincode||a?.pincode||w?.pincode||''})}} options={formAreas} placeholder={formWardId?'Search colony / area…':'Select ward first'}/></Field>
   <Field label="House number *"><input required value={form.houseNumber||''} onChange={e=>changeForm({...form,houseNumber:e.target.value})} placeholder="e.g. H-101"/></Field>
   <Field label="House type *"><select required value={form.houseType||''} onChange={e=>changeForm({...form,houseType:e.target.value})}><option value="">Select house type</option><option value="INDEPENDENT_HOUSE">Independent house</option><option value="FLAT">Flat</option><option value="CHAWL">Chawl</option><option value="OTHER">Other</option></select></Field>
   <Field className="span-2" label="Complete address *"><textarea required value={form.address||''} onChange={e=>changeForm({...form,address:e.target.value})} placeholder="House number, street, colony"/></Field>
   <Field label="Landmark (optional)"><input value={form.landmark||''} onChange={e=>changeForm({...form,landmark:e.target.value})} placeholder="Nearby landmark"/></Field>
   <Field label="City / town"><input value={form.city||''} onChange={e=>changeForm({...form,city:e.target.value})} placeholder="City"/></Field>
   <Field label="Pincode"><input inputMode="numeric" maxLength={6} value={form.pincode||''} onChange={e=>changeForm({...form,pincode:e.target.value.replace(/\D/g,'').slice(0,6)})} placeholder="6-digit pincode"/></Field>
   <Field label="Ownership *"><select required value={form.ownership||''} onChange={e=>changeForm({...form,ownership:e.target.value})}><option value="">Select ownership</option><option value="OWN">Own</option><option value="RENT">Rent</option><option value="OTHER">Other</option></select></Field>
   <div className="form-section-title span-2"><strong>Exact home location</strong><span>Stand at the door, tap Use GPS, or tap the map. Families inherit this pin. Later, tap Open directions to navigate here.</span></div>
   <LocationPicker key={`${form.areaId||'none'}-${edit?.id||'new'}`} value={form} onChange={next=>changeForm({...form,...next})} centerFrom={[selectedArea,selectedWard]} hint="You are collecting this home. Use GPS at the door so the next visit can open directions."/>
   <div className="form-section-title span-2"><strong>Owner (optional)</strong><span>Leave blank if the owner details are not available yet.</span></div>
   <Field label="Owner name (optional)"><input value={form.ownerName||''} onChange={e=>changeForm({...form,ownerName:e.target.value})} placeholder="Owner full name"/></Field>
   <Field label="Owner mobile (optional)"><input inputMode="numeric" maxLength={10} value={form.ownerMobile||''} onChange={e=>changeForm({...form,ownerMobile:e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="10 digit mobile"/></Field>
   <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>{setEdit(null);setAdd(null)}}>Cancel</button><button className="primary-btn">{edit?'Save changes':'Save house'}</button></div>
  </form></Modal>}
 </div>;
}
