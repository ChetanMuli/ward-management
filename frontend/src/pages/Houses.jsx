import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {api} from '../services/api';
import {Empty,ErrorBox,Field,Loading,Modal,PageHeader,PaginationBar,RowMenu,Toolbar,SearchableSelect} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {filterByWard,useWardFilter} from '../wardFilter';
import {can,canModule,isNagarsevak,isEmployee} from '../rbac';
import {directionsUrl,geoPayload,hasCoords,housePlace,isFlatHome,placeLine} from '../location';
import LocationPicker,{DirectionsLink,MapPreview} from '../components/LocationMap';

const blank={houseNumber:'',wardId:'',areaId:'',apartmentId:'',dwelling:'INDEPENDENT',address:'',landmark:'',city:'',houseType:'INDEPENDENT_HOUSE',ownership:'',ownerName:'',ownerMobile:'',latitude:'',longitude:'',notes:''};
const emptyApartment={name:'',wardId:'',areaId:'',floors:'',address:'',landmark:'',latitude:'',longitude:''};

export default function Houses(){
 const navigate=useNavigate();
 const {selectedWardId}=useWardFilter();
 const [searchParams]=useSearchParams();
 const [rows,setRows]=useState(null),[wards,setWards]=useState([]),[apartments,setApartments]=useState([]),[filters,setFilters]=useState({search:'',ownership:'',homeKind:'',areaId:''}),[edit,setEdit]=useState(null),[add,setAdd]=useState(null),[detail,setDetail]=useState(null),[error,setError]=useState('');
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(25),[houseLoc,setHouseLoc]=useState(null),[busyLoc,setBusyLoc]=useState(false);
 const [apartmentForm,setApartmentForm]=useState(null),[busyApt,setBusyApt]=useState(false);
 const canAdd=can('CREATE_HOUSES')||canModule('HOUSES','CREATE')||isNagarsevak()||isEmployee();
 const canAddApt=canAdd||can('EDIT_WARDS')||canModule('WARDS','EDIT');
 const canPin=can('EDIT_HOUSES')||canModule('HOUSES','EDIT')||can('CREATE_HOUSES')||isNagarsevak()||isEmployee();

 async function load(){try{setError('');setRows((await api.houses({limit:500,search:filters.search||undefined,ownership:filters.ownership||undefined,wardId:selectedWardId||undefined})).data||[])}catch(e){setError(e.message)}}
 async function loadPlaces(){
  try{
   const [w,a]=await Promise.all([api.wards(),api.apartments()]);
   setWards(w.data||[]);
   setApartments(a.data||[]);
  }catch(e){setError(e.message)}
 }
 useEffect(()=>{const t=setTimeout(()=>load(),250);return()=>clearTimeout(t)},[selectedWardId,filters.search,filters.ownership,filters.homeKind,filters.areaId]);
 useEffect(()=>{loadPlaces()},[]);
 useEffect(()=>{setPage(1)},[selectedWardId,filters.search,filters.ownership,filters.homeKind,filters.areaId]);

 const visible=useMemo(()=>filterByWard(rows||[],selectedWardId).filter(h=>{
  const apt=searchParams.get('apartmentId');
  if(apt && String(h.apartmentId||h.apartment?.id||'')!==String(apt)) return false;
  if(filters.homeKind==='house' && isFlatHome(h)) return false;
  if(filters.homeKind==='flat' && !isFlatHome(h)) return false;
  if(filters.areaId && String(h.areaId||h.area?.id||'')!==String(filters.areaId)) return false;
  return !filters.search||`${h.houseNumber||''} ${h.address||''} ${h.ownerName||''} ${h.ownerMobile||''} ${h.area?.name||''} ${h.apartment?.name||''} ${h.city||''} ${h.landmark||''}`.toLowerCase().includes(filters.search.toLowerCase());
 }),[rows,selectedWardId,filters.search,filters.homeKind,filters.areaId,searchParams]);
 const total=visible.length;
 const pages=Math.max(1,Math.ceil(total/pageSize));
 const currentPage=Math.min(page,pages);
 const pageRows=visible.slice((currentPage-1)*pageSize,currentPage*pageSize);
 const wardOptions=wards.map(w=>({value:w.id,label:`${w.wardNumber} · ${w.name||''}`}));
 const colonyFilterOptions=(selectedWardId?(wards.find(w=>String(w.id)===String(selectedWardId))?.areas||[]):wards.flatMap(w=>w.areas||[])).map(a=>({id:a.id,name:a.name}));
 const form=edit||add;
 const formWardId=form?.wardId||form?.area?.wardId||form?.area?.ward?.id||'';
 const formAreas=(wards.find(w=>String(w.id)===String(formWardId))?.areas||[]).map(a=>({value:a.id,label:a.name}));
 const selectedArea=(wards.find(w=>String(w.id)===String(formWardId))?.areas||[]).find(a=>String(a.id)===String(form?.areaId));
 const selectedWard=wards.find(w=>String(w.id)===String(formWardId));
 const openedApt=useRef('');
 const wardApartments=apartments.filter(a=>{
  if(!formWardId) return true;
  return String(a.wardId||a.ward?.id||a.area?.wardId||'')===String(formWardId);
 });
 useEffect(()=>{
  const apt=searchParams.get('apartmentId');
  if(!apt||add||edit) return;
  if(openedApt.current===String(apt)) return;
  const found=apartments.find(a=>String(a.id)===String(apt));
  if(!found) return;
  openedApt.current=String(apt);
  setAdd({...blank,dwelling:'APARTMENT',houseType:'FLAT',wardId:found.wardId||found.ward?.id||'',areaId:found.areaId,apartmentId:found.id});
 },[apartments,searchParams,add,edit]);
 function pickApartment(id,base=form){
  const apt=apartments.find(x=>String(x.id)===String(id));
  return {
   ...base,
   dwelling:'APARTMENT',
   houseType:'FLAT',
   apartmentId:id,
   wardId:apt?.wardId||apt?.ward?.id||base.wardId,
   areaId:apt?.areaId||base.areaId
  };
 }
 function openAdd(){
  const apt=searchParams.get('apartmentId');
  const found=apartments.find(a=>String(a.id)===String(apt));
  if(found) setAdd(pickApartment(found.id,{...blank,city:''}));
  else setAdd({...blank,wardId:selectedWardId||'',dwelling:filters.homeKind==='flat'?'APARTMENT':'INDEPENDENT',houseType:filters.homeKind==='flat'?'FLAT':'INDEPENDENT_HOUSE'});
 }
 function openAddApartment(fromForm=false){
  const src=fromForm?form:null;
  setApartmentForm({
   ...emptyApartment,
   fromForm:!!fromForm,
   wardId:src?.wardId||selectedWardId||'',
   areaId:src?.areaId||''
  });
 }
 function openEdit(h){setEdit({...blank,...h,dwelling:(h.apartmentId||h.apartment?.id)?'APARTMENT':'INDEPENDENT',houseType:(h.apartmentId||h.apartment?.id)?'FLAT':(h.houseType||'INDEPENDENT_HOUSE'),wardId:h.area?.wardId||h.area?.ward?.id||'',apartmentId:h.apartmentId||h.apartment?.id||'',latitude:hasCoords(h.latitude,h.longitude)?(h.latitude??''):'',longitude:hasCoords(h.latitude,h.longitude)?(h.longitude??''):'',city:h.city||''});}
 function changeForm(next){if(edit)setEdit(next);else setAdd(next)}
 async function saveApartment(e){
  e.preventDefault();
  if(!apartmentForm) return;
  setBusyApt(true);
  try{
   const saved=(await api.createApartment({name:apartmentForm.name,areaId:apartmentForm.areaId,floors:apartmentForm.floors||null,address:apartmentForm.address||null,landmark:apartmentForm.landmark||null,...geoPayload(apartmentForm,['latitude','longitude'])})).data;
   const fromForm=apartmentForm.fromForm;
   const nextHouse={...(edit||add||blank),dwelling:'APARTMENT',houseType:'FLAT',apartmentId:saved?.id||'',wardId:saved?.wardId||apartmentForm.wardId,areaId:saved?.areaId||apartmentForm.areaId};
   setApartmentForm(null);
   await loadPlaces();
   if(fromForm && saved?.id) changeForm(nextHouse);
  }catch(err){setError(err.message)}
  finally{setBusyApt(false)}
 }
 function openHouseLoc(h,fromDetail=false){
  if(!h) return;
  setHouseLoc({id:h.id,houseNumber:h.houseNumber,latitude:hasCoords(h.latitude,h.longitude)?h.latitude:'',longitude:hasCoords(h.latitude,h.longitude)?h.longitude:'',area:h.area||null,fromDetail});
  if(fromDetail) setDetail(null);
 }
 async function saveHouseLoc(e){
  e.preventDefault();
  if(!houseLoc?.id) return;
  if(!hasCoords(houseLoc.latitude,houseLoc.longitude)){
   setError('Use GPS or tap the map to set the exact door pin before saving.');
   return;
  }
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
 async function save(e){
  e.preventDefault();
  try{
   const isFlat=form.dwelling==='APARTMENT'||form.houseType==='FLAT';
   if(isFlat && !form.apartmentId) throw new Error('Select the apartment this flat belongs to.');
   const payload={houseNumber:form.houseNumber,areaId:form.areaId,apartmentId:isFlat?(form.apartmentId||null):null,address:form.address,landmark:form.landmark||null,houseType:isFlat?'FLAT':(form.houseType||'INDEPENDENT_HOUSE'),ownership:form.ownership,ownerName:form.ownerName||null,ownerMobile:form.ownerMobile||null,notes:form.notes||null,...geoPayload(form,['city','latitude','longitude'])};
   let saved=null;
   if(edit) saved=(await api.updateHouse(edit.id,payload)).data;
   else saved=(await api.createHouse(payload)).data;
   const inApt=!!payload.apartmentId;
   setEdit(null);setAdd(null);await load();
   if(!edit && saved?.id && (can('CREATE_FAMILIES')||isNagarsevak()||isEmployee()) && window.confirm(inApt?'House saved in this apartment. Add a family who lives here now?':'House saved. Add a family who lives here now?')){
    navigate(`/families?houseId=${saved.id}`);
   }
  }catch(e){setError(e.message)}
 }
 return <div className="admin-data-page houses-page">
  <PageHeader kicker="People & houses" title="Houses" subtitle="Add the apartment first if needed, then add each flat in it. GPS saves only the map pin — it does not fill address." action={(canAdd||canAddApt)?<div className="card-actions houses-header-actions">{canAddApt&&<button type="button" className="ghost-btn" onClick={()=>openAddApartment(false)}>+ Add apartment</button>}{canAdd&&<button type="button" className="primary-btn" onClick={openAdd}>+ Add house</button>}</div>:null}/>
  <ErrorBox error={error}/>
  <Toolbar>
   <WardFilter/>
   <input className="grow" placeholder="Search house or flat number, address, owner…" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/>
   <SearchableSelect value={filters.areaId} onChange={v=>setFilters({...filters,areaId:v})} options={[{value:'',label:'All colonies'},...colonyFilterOptions.map(a=>({value:a.id,label:a.name}))]} placeholder="Search colony…"/>
   <SearchableSelect value={filters.homeKind} onChange={v=>setFilters({...filters,homeKind:v})} options={[{value:'',label:'House / Flat'},{value:'house',label:'Houses'},{value:'flat',label:'Flats'}]} placeholder="House / Flat"/>
   <SearchableSelect value={filters.ownership} onChange={v=>setFilters({...filters,ownership:v})} options={[{value:'',label:'All ownership'},{value:'OWN',label:'Own'},{value:'RENT',label:'Rent'},{value:'OTHER',label:'Other'}]} placeholder="Ownership"/>
  </Toolbar>
  {!rows?<Loading/>:!total?<Empty>No houses found for this ward/filter.</Empty>:<>
   <div className="panel table-wrap houses-table"><table><thead><tr><th>House</th><th>Area / Colony</th><th>Address</th><th>Location</th><th>Owner</th><th></th></tr></thead><tbody>{pageRows.map(h=><tr key={h.id}><td data-label="House"><button className="table-link" onClick={()=>api.house(h.id).then(r=>setDetail(r.data)).catch(e=>setError(e.message))}><strong>{h.houseNumber}</strong></button><div className="muted">{h.houseType?.replaceAll('_',' ')||'—'}</div></td><td data-label="Area / Colony">{h.area?.ward?.wardNumber||'—'}<div className="muted">{placeLine([h.apartment?.name,h.area?.name])||'—'}</div></td><td data-label="Address">{h.address}<div className="muted">{placeLine([h.landmark,h.city||h.area?.city])}</div></td><td data-label="Location"><div className="loc-cell">{hasCoords(h.latitude,h.longitude)?<DirectionsLink lat={h.latitude} lng={h.longitude} label="Directions"/>:<span className="muted">Not saved</span>}</div></td><td data-label="Owner">{h.ownerName||'—'}<div className="muted">{h.ownerMobile||''}</div></td><td data-label="Actions"><RowMenu items={[
     {label:'View details',onClick:()=>api.house(h.id).then(r=>setDetail(r.data)).catch(e=>setError(e.message))},
     hasCoords(h.latitude,h.longitude)&&{label:'Get directions',onClick:()=>window.open(directionsUrl(h.latitude,h.longitude),'_blank','noopener')},
     canPin&&{label:'Update location',onClick:()=>openHouseLoc(h,false)},
     can('EDIT_HOUSES')&&{label:'Edit',onClick:()=>openEdit(h)},
     can('DELETE_HOUSES')&&{label:'Delete',danger:true,onClick:async()=>{if(confirm('Move house to recycle bin?')){try{await api.deleteHouse(h.id);await load()}catch(e){setError(e.message)}}}}
    ]}/></td></tr>)}</tbody></table></div>
   <PaginationBar page={currentPage} pages={pages} total={total} limit={pageSize} onPage={setPage} onLimit={setPageSize}/>
  </>}
  {detail&&<Modal wide title={`${detail.houseNumber} · House profile`} onClose={()=>setDetail(null)}><div className="detail-grid"><div className="detail-card"><h3>Location</h3><p><b>Path:</b> {housePlace(detail)||'—'}</p><p><b>Ward:</b> {detail.area?.ward?.wardNumber||'—'} · {detail.area?.ward?.name||''}</p><p><b>Colony / Area:</b> {detail.area?.name||'—'}</p><p><b>Apartment:</b> {detail.apartment?.name||'Independent house'}</p><p><b>Address:</b> {detail.address||'—'}</p><p><b>Landmark:</b> {detail.landmark||'—'}</p><p><b>City:</b> {detail.city||detail.area?.city||'—'}</p></div><div className="detail-card"><h3>Go to this home</h3><MapPreview lat={detail.latitude} lng={detail.longitude} label={`House ${detail.houseNumber}`}>{canPin&&<button type="button" className="small-btn loc-update-btn" onClick={()=>openHouseLoc(detail,true)}>Update location</button>}</MapPreview></div><div className="detail-card"><h3>Ownership</h3><p><b>Type:</b> {detail.houseType?.replaceAll('_',' ')||'—'}</p><p><b>Ownership:</b> {detail.ownership||'—'}</p><p><b>Owner:</b> {detail.ownerName||'—'}</p><p><b>Owner mobile:</b> {detail.ownerMobile||'—'}</p></div><div className="detail-card"><h3>Families in this house</h3><p className="muted">One house (or apartment unit) can have more than one family. Add each family separately, then add members.</p>{(detail.families||[]).map(f=><div className="member-card" key={f.id}><strong>{f.familyName||'Unnamed family'}</strong><span>{f.members?.length||0} members{f.nativeVillage?` · मूल गाव: ${f.nativeVillage}`:''}</span></div>)}{!(detail.families||[]).length&&<span className="muted">No family linked yet.</span>}{(can('CREATE_FAMILIES')||isNagarsevak()||isEmployee())&&<button type="button" className="small-btn" style={{marginTop:10}} onClick={()=>navigate(`/families?houseId=${detail.id}`)}>+ Add family here</button>}</div></div></Modal>}
  {houseLoc&&<Modal wide title={`Update location · House ${houseLoc.houseNumber||''}`} onClose={()=>{const reopen=houseLoc.fromDetail;const id=houseLoc.id;setHouseLoc(null);if(reopen) api.house(id).then(r=>setDetail(r.data)).catch(()=>{});}}><form className="form-grid admin-form" onSubmit={saveHouseLoc}><div className="form-section-title span-2"><strong>Exact home location</strong><span>GPS saves only the pin. Address, landmark and city stay as they are.</span></div><ErrorBox error={error}/><LocationPicker key={houseLoc.id} value={houseLoc} onChange={next=>setHouseLoc(cur=>({...cur,latitude:next.latitude,longitude:next.longitude}))} centerFrom={[houseLoc.area,houseLoc.area?.ward]} hint="Stand at the door and tap Use GPS. On the phone this opens Google Maps."/><div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>{const reopen=houseLoc.fromDetail;const id=houseLoc.id;setHouseLoc(null);if(reopen) api.house(id).then(r=>setDetail(r.data)).catch(()=>{});}}>Cancel</button><button className="primary-btn" disabled={busyLoc}>{busyLoc?'Saving…':'Save location'}</button></div></form></Modal>}
  {form&&<Modal wide title={edit?`Edit ${edit.houseNumber}`:'Add house'} onClose={()=>{setEdit(null);setAdd(null)}}><form className="form-grid admin-form" onSubmit={save}>
   <div className="form-section-title span-2"><strong>Where is this house?</strong><span>Independent house, or a flat inside an apartment. Add the apartment first if it is not in the list yet.</span></div>
   <Field label="Ward *"><SearchableSelect required value={formWardId} onChange={v=>changeForm({...form,wardId:v,areaId:'',apartmentId:''})} options={wardOptions} placeholder="Search ward…"/></Field>
   <Field label="Colony / Area *"><SearchableSelect required value={form.areaId||''} onChange={v=>changeForm({...form,areaId:v})} options={formAreas} placeholder={formWardId?'Search colony / area…':'Select ward first'}/></Field>
   <Field className="span-2" label="House type *"><select required value={form.dwelling||'INDEPENDENT'} onChange={e=>{const dwelling=e.target.value;changeForm({...form,dwelling,apartmentId:dwelling==='APARTMENT'?form.apartmentId:'',houseType:dwelling==='APARTMENT'?'FLAT':'INDEPENDENT_HOUSE'})}}><option value="INDEPENDENT">Independent house</option><option value="APARTMENT">Flat</option></select></Field>
   {form.dwelling==='APARTMENT'&&<div className="span-2 apt-pick-row"><Field label="Apartment *"><SearchableSelect required value={form.apartmentId||''} onChange={v=>changeForm(pickApartment(v,form))} options={wardApartments.map(a=>({value:a.id,label:a.name,hint:a.area?.name||''}))} placeholder={wardApartments.length?'Search apartment…':'No apartment yet — add one'}/></Field>{canAddApt&&<button type="button" className="small-btn apt-add-inline" onClick={()=>openAddApartment(true)}>+ Add apartment</button>}{formWardId&&!wardApartments.length&&<p className="muted apt-empty-hint">No apartment in this ward yet. Add the building first, then select it here.</p>}</div>}
   <Field label={form.dwelling==='APARTMENT'?'Flat number *':'House number *'}><input required value={form.houseNumber||''} onChange={e=>changeForm({...form,houseNumber:e.target.value})} placeholder={form.dwelling==='APARTMENT'?'e.g. A-101':'e.g. H-101'}/></Field>
   {form.dwelling!=='APARTMENT'&&<Field label="Building type"><select value={form.houseType||'INDEPENDENT_HOUSE'} onChange={e=>changeForm({...form,houseType:e.target.value})}><option value="INDEPENDENT_HOUSE">Independent house</option><option value="CHAWL">Chawl</option><option value="OTHER">Other</option></select></Field>}
   <Field className="span-2" label="Complete address *"><textarea required value={form.address||''} onChange={e=>changeForm({...form,address:e.target.value})} placeholder="House number, street, colony or apartment wing"/></Field>
   <Field label="Landmark (optional)"><input value={form.landmark||''} onChange={e=>changeForm({...form,landmark:e.target.value})} placeholder="Nearby landmark"/></Field>
   <Field label="City / town"><input value={form.city||''} onChange={e=>changeForm({...form,city:e.target.value})} placeholder="City"/></Field>
   <Field label="Ownership *"><select required value={form.ownership||''} onChange={e=>changeForm({...form,ownership:e.target.value})}><option value="">Select ownership</option><option value="OWN">Own</option><option value="RENT">Rent</option><option value="OTHER">Other</option></select></Field>
   <div className="form-section-title span-2"><strong>Exact home location</strong><span>Use GPS for the pin only. Address, landmark and city are not auto-filled.</span></div>
   <LocationPicker key={edit?.id||'new-house'} value={form} onChange={next=>changeForm({...form,latitude:next.latitude,longitude:next.longitude})} centerFrom={[selectedArea,selectedWard,wardApartments.find(a=>String(a.id)===String(form.apartmentId))]} hint="Stand at the door and tap Use GPS. Only latitude and longitude are saved."/>
   <div className="form-section-title span-2"><strong>Owner (optional)</strong><span>Leave blank if the owner details are not available yet.</span></div>
   <Field label="Owner name (optional)"><input value={form.ownerName||''} onChange={e=>changeForm({...form,ownerName:e.target.value})} placeholder="Owner full name"/></Field>
   <Field label="Owner mobile (optional)"><input inputMode="numeric" maxLength={10} value={form.ownerMobile||''} onChange={e=>changeForm({...form,ownerMobile:e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="10 digit mobile"/></Field>
   <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>{setEdit(null);setAdd(null)}}>Cancel</button><button className="primary-btn">{edit?'Save changes':'Save house'}</button></div>
  </form></Modal>}
  {apartmentForm&&<Modal wide layer={form?2:1} title="Add apartment" onClose={()=>setApartmentForm(null)}>
   <form className="form-grid admin-form" onSubmit={saveApartment}>
    <div className="form-section-title span-2"><strong>Apartment / building</strong><span>Register the building. Then add each flat as a house and select this apartment.</span></div>
    <Field label="Ward *"><SearchableSelect required value={apartmentForm.wardId||''} onChange={v=>setApartmentForm({...apartmentForm,wardId:v,areaId:''})} options={wardOptions} placeholder="Search ward…"/></Field>
    <Field label="Colony / Area *"><SearchableSelect required value={apartmentForm.areaId||''} onChange={v=>setApartmentForm({...apartmentForm,areaId:v})} options={((wards.find(w=>String(w.id)===String(apartmentForm.wardId))?.areas)||[]).map(a=>({value:a.id,label:a.name}))} placeholder={apartmentForm.wardId?'Search colony…':'Select ward first'}/></Field>
    <Field className="span-2" label="Apartment name *"><input required value={apartmentForm.name||''} onChange={e=>setApartmentForm({...apartmentForm,name:e.target.value})} placeholder="e.g. Sai Residency"/></Field>
    <Field label="Floors (optional)"><input inputMode="numeric" value={apartmentForm.floors||''} onChange={e=>setApartmentForm({...apartmentForm,floors:e.target.value.replace(/\D/g,'')})} placeholder="e.g. 7"/></Field>
    <Field label="Landmark (optional)"><input value={apartmentForm.landmark||''} onChange={e=>setApartmentForm({...apartmentForm,landmark:e.target.value})} placeholder="Nearby landmark"/></Field>
    <Field className="span-2" label="Address (optional)"><textarea value={apartmentForm.address||''} onChange={e=>setApartmentForm({...apartmentForm,address:e.target.value})} placeholder="Street, gate, wing"/></Field>
    <div className="form-section-title span-2"><strong>Apartment location</strong><span>GPS saves only the building pin. Address is not auto-filled.</span></div>
    <LocationPicker key={`apt-${apartmentForm.wardId||'new'}-${apartmentForm.areaId||''}`} value={apartmentForm} onChange={next=>setApartmentForm(cur=>({...cur,latitude:next.latitude,longitude:next.longitude}))} centerFrom={[(wards.find(w=>String(w.id)===String(apartmentForm.wardId))?.areas||[]).find(a=>String(a.id)===String(apartmentForm.areaId)),wards.find(w=>String(w.id)===String(apartmentForm.wardId))]} hint="Stand at the apartment gate and tap Use GPS. Only latitude and longitude are saved."/>
    <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>setApartmentForm(null)}>Cancel</button><button className="primary-btn" disabled={busyApt}>{busyApt?'Saving…':'Add apartment'}</button></div>
   </form>
  </Modal>}
 </div>;
}
