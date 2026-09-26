import React,{useEffect,useMemo,useState} from 'react';
import {api} from '../services/api';
import {Empty,ErrorBox,Field,Loading,Modal,PageHeader,PaginationBar,RowMenu,Toolbar,SearchableSelect} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {filterByWard,useWardFilter} from '../wardFilter';
import {can,canModule,isNagarsevak,isEmployee} from '../rbac';
import {directionsUrl,geoPayload,hasCoords} from '../location';
import LocationPicker,{DirectionsLink,MapPreview} from '../components/LocationMap';

const blank={name:'',kind:'SHOP',category:'',categoryCustom:'',wardId:'',areaId:'',address:'',landmark:'',ownerName:'',ownerMobile:'',ownership:'',openingHours:'',notes:'',latitude:'',longitude:''};
const CATEGORIES=['Grocery','Medical / Pharmacy','Hardware','Electrical','Clothing','Hotel / Restaurant','Salon','Mobile / Electronics','Bank / Finance','Clinic','Advocate','Other'];
function categoryParts(category){
 const value=String(category||'').trim();
 if(!value) return {category:'',categoryCustom:''};
 if(CATEGORIES.includes(value) && value!=='Other') return {category:value,categoryCustom:''};
 return {category:'Other',categoryCustom:value==='Other'?'':value};
}
function ownershipLabel(v){return v==='OWN'?'Own':v==='RENT'?'Rent':v==='OTHER'?'Other':'—'}

export default function Shops(){
 const {selectedWardId}=useWardFilter();
 const [rows,setRows]=useState(null),[wards,setWards]=useState([]),[filters,setFilters]=useState({search:'',kind:'',areaId:''});
 const [edit,setEdit]=useState(null),[add,setAdd]=useState(null),[detail,setDetail]=useState(null),[error,setError]=useState('');
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(25),[shopLoc,setShopLoc]=useState(null),[busyLoc,setBusyLoc]=useState(false);
 const canAdd=can('CREATE_HOUSES')||canModule('HOUSES','CREATE')||isNagarsevak()||isEmployee();
 const canPin=can('EDIT_HOUSES')||canModule('HOUSES','EDIT')||canAdd;

 async function load(){
  try{
   setError('');
   setRows((await api.shops({limit:500,search:filters.search||undefined,kind:filters.kind||undefined,wardId:selectedWardId||undefined})).data||[]);
  }catch(e){setError(e.message)}
 }
 useEffect(()=>{const t=setTimeout(load,250);return()=>clearTimeout(t)},[selectedWardId,filters.search,filters.kind]);
 useEffect(()=>{api.wards().then(w=>setWards(w.data||[])).catch(e=>setError(e.message))},[]);
 useEffect(()=>{setPage(1)},[selectedWardId,filters.search,filters.kind,filters.areaId]);

 const visible=useMemo(()=>filterByWard(rows||[],selectedWardId).filter(s=>{
  if(filters.areaId && String(s.areaId||s.area?.id||'')!==String(filters.areaId)) return false;
  return true;
 }),[rows,selectedWardId,filters.areaId]);
 const total=visible.length;
 const pages=Math.max(1,Math.ceil(total/pageSize));
 const currentPage=Math.min(page,pages);
 const pageRows=visible.slice((currentPage-1)*pageSize,currentPage*pageSize);
 const wardOptions=wards.map(w=>({value:w.id,label:`${w.wardNumber} · ${w.name||''}`}));
 const colonyOptions=(selectedWardId?(wards.find(w=>String(w.id)===String(selectedWardId))?.areas||[]):wards.flatMap(w=>w.areas||[])).map(a=>({value:a.id,label:a.name}));
 const form=edit||add;
 const formWardId=form?.wardId||form?.area?.wardId||form?.area?.ward?.id||'';
 const formAreas=(wards.find(w=>String(w.id)===String(formWardId))?.areas||[]).map(a=>({value:a.id,label:a.name}));
 const selectedArea=(wards.find(w=>String(w.id)===String(formWardId))?.areas||[]).find(a=>String(a.id)===String(form?.areaId));
 const selectedWard=wards.find(w=>String(w.id)===String(formWardId));

 function openAdd(){setAdd({...blank,wardId:selectedWardId||'',kind:filters.kind||'SHOP'})}
 function openEdit(s){setEdit({...blank,...s,...categoryParts(s.category),wardId:s.area?.wardId||s.area?.ward?.id||'',areaId:s.areaId||s.area?.id||'',ownership:s.ownership||'',latitude:hasCoords(s.latitude,s.longitude)?s.latitude:'',longitude:hasCoords(s.latitude,s.longitude)?s.longitude:''})}
 function changeForm(next){if(edit)setEdit(next);else setAdd(next)}
 function openShopLoc(s,fromDetail=false){
  if(!s) return;
  setShopLoc({id:s.id,name:s.name,latitude:hasCoords(s.latitude,s.longitude)?s.latitude:'',longitude:hasCoords(s.latitude,s.longitude)?s.longitude:'',area:s.area||null,fromDetail});
  if(fromDetail) setDetail(null);
 }
 async function saveShopLoc(e){
  e.preventDefault();
  if(!shopLoc?.id) return;
  if(!hasCoords(shopLoc.latitude,shopLoc.longitude)){setError('Use GPS or tap the map to set the shop pin.');return;}
  setBusyLoc(true);
  try{
   await api.updateShop(shopLoc.id,geoPayload(shopLoc,['latitude','longitude']));
   const id=shopLoc.id; const reopen=shopLoc.fromDetail;
   setShopLoc(null); await load();
   if(reopen) setDetail((await api.shop(id)).data);
  }catch(err){setError(err.message)}
  finally{setBusyLoc(false)}
 }
 async function save(e){
  e.preventDefault();
  try{
   const category=form.category==='Other'?(form.categoryCustom||'').trim():form.category;
   if(form.category==='Other' && !category) throw new Error('Write the category name.');
   if(!form.ownership) throw new Error('Select whether this place is owned or rented.');
   const payload={name:form.name,kind:form.kind,category:category||null,categoryCustom:form.category==='Other'?form.categoryCustom:null,areaId:form.areaId,address:form.address,landmark:form.landmark||null,ownerName:form.ownerName||null,ownerMobile:form.ownerMobile||null,ownership:form.ownership,openingHours:form.openingHours||null,notes:form.notes||null,...geoPayload(form,['latitude','longitude'])};
   if(edit) await api.updateShop(edit.id,payload);
   else await api.createShop(payload);
   setEdit(null);setAdd(null);await load();
  }catch(err){setError(err.message)}
 }

 return <div className="admin-data-page shops-page">
  <PageHeader kicker="People & houses" title="Shops & offices" action={canAdd?<button className="primary-btn" onClick={openAdd}>+ Add shop / office</button>:null}/>
  <ErrorBox error={error}/>
  <Toolbar>
   <WardFilter/>
   <input className="grow" placeholder="Search shop, office, owner, address…" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/>
   <SearchableSelect value={filters.areaId} onChange={v=>setFilters({...filters,areaId:v})} options={[{value:'',label:'All colonies'},...colonyOptions]} placeholder="Search colony…"/>
   <SearchableSelect value={filters.kind} onChange={v=>setFilters({...filters,kind:v})} options={[{value:'',label:'Shop / Office'},{value:'SHOP',label:'Shops'},{value:'OFFICE',label:'Offices'}]} placeholder="Shop / Office"/>
  </Toolbar>
  {!rows?<Loading/>:!total?<Empty>No shops or offices found for this ward/filter.</Empty>:<>
   <div className="panel table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Colony</th><th>Owner</th><th>Location</th><th></th></tr></thead><tbody>{pageRows.map(s=><tr key={s.id}>
    <td data-label="Name"><button className="table-link" onClick={()=>api.shop(s.id).then(r=>setDetail(r.data)).catch(e=>setError(e.message))}><strong>{s.name}</strong></button><div className="muted">{s.category||s.address||'—'}</div></td>
    <td data-label="Type">{s.kind==='OFFICE'?'Office':'Shop'}<div className="muted">{ownershipLabel(s.ownership)}</div></td>
    <td data-label="Colony">{s.area?.ward?.wardNumber||'—'}<div className="muted">{s.area?.name||'—'}</div></td>
    <td data-label="Owner">{s.ownerName||'—'}<div className="muted">{s.ownerMobile||''}</div></td>
    <td data-label="Location"><div className="loc-cell">{hasCoords(s.latitude,s.longitude)?<DirectionsLink lat={s.latitude} lng={s.longitude} label="Directions"/>:<span className="muted">Not saved</span>}</div></td>
    <td data-label="Actions"><RowMenu items={[
     {label:'View details',onClick:()=>api.shop(s.id).then(r=>setDetail(r.data)).catch(e=>setError(e.message))},
     hasCoords(s.latitude,s.longitude)&&{label:'Get directions',onClick:()=>window.open(directionsUrl(s.latitude,s.longitude),'_blank','noopener')},
     canPin&&{label:'Update location',onClick:()=>openShopLoc(s,false)},
     canAdd&&{label:'Edit',onClick:()=>openEdit(s)},
     can('DELETE_HOUSES')&&{label:'Delete',danger:true,onClick:async()=>{if(confirm('Move this shop / office to the recycle bin?')){try{await api.deleteShop(s.id);await load()}catch(e){setError(e.message)}}}}
    ]}/></td>
   </tr>)}</tbody></table></div>
   <PaginationBar page={currentPage} pages={pages} total={total} limit={pageSize} onPage={setPage} onLimit={setPageSize}/>
  </>}
  {detail&&<Modal wide title={`${detail.name} · ${detail.kind==='OFFICE'?'Office':'Shop'}`} onClose={()=>setDetail(null)}>
   <div className="detail-grid">
    <div className="detail-card"><h3>Place</h3><p><b>Type:</b> {detail.kind==='OFFICE'?'Office':'Shop'}</p><p><b>Category:</b> {detail.category||'—'}</p><p><b>Ownership:</b> {ownershipLabel(detail.ownership)}</p><p><b>Ward:</b> {detail.area?.ward?.wardNumber||'—'} · {detail.area?.ward?.name||''}</p><p><b>Colony:</b> {detail.area?.name||'—'}</p><p><b>Address:</b> {detail.address||'—'}</p><p><b>Landmark:</b> {detail.landmark||'—'}</p><p><b>Hours:</b> {detail.openingHours||'—'}</p></div>
    <div className="detail-card"><h3>Go here</h3><MapPreview lat={detail.latitude} lng={detail.longitude} label={detail.name}>{canPin&&<button type="button" className="small-btn loc-update-btn" onClick={()=>openShopLoc(detail,true)}>Update location</button>}</MapPreview></div>
    <div className="detail-card"><h3>Owner / contact</h3><p><b>Name:</b> {detail.ownerName||'—'}</p><p><b>Mobile:</b> {detail.ownerMobile||'—'}</p><p><b>Notes:</b> {detail.notes||'—'}</p></div>
   </div>
  </Modal>}
  {shopLoc&&<Modal wide title={`Update location · ${shopLoc.name||''}`} onClose={()=>{const reopen=shopLoc.fromDetail;const id=shopLoc.id;setShopLoc(null);if(reopen) api.shop(id).then(r=>setDetail(r.data)).catch(()=>{});}}>
   <form className="form-grid admin-form" onSubmit={saveShopLoc}>
    <div className="form-section-title span-2"><strong>Exact shop / office location</strong><span>GPS saves only the pin.</span></div>
    <ErrorBox error={error}/>
    <LocationPicker key={shopLoc.id} value={shopLoc} onChange={next=>setShopLoc(cur=>({...cur,latitude:next.latitude,longitude:next.longitude}))} centerFrom={[shopLoc.area,shopLoc.area?.ward]} hint="Stand at the entrance and tap Use GPS."/>
    <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>{const reopen=shopLoc.fromDetail;const id=shopLoc.id;setShopLoc(null);if(reopen) api.shop(id).then(r=>setDetail(r.data)).catch(()=>{});}}>Cancel</button><button className="primary-btn" disabled={busyLoc}>{busyLoc?'Saving…':'Save location'}</button></div>
   </form>
  </Modal>}
  {form&&<Modal wide title={edit?`Edit ${edit.name}`:'Add shop / office'} onClose={()=>{setEdit(null);setAdd(null)}}>
   <form className="form-grid admin-form" onSubmit={save}>
    <div className="form-section-title span-2"><strong>Shop or office</strong><span>Register the place in this ward, then pin its location.</span></div>
    <Field label="Ward *"><SearchableSelect required value={formWardId} onChange={v=>changeForm({...form,wardId:v,areaId:''})} options={wardOptions} placeholder="Search ward…"/></Field>
    <Field label="Colony / Area *"><SearchableSelect required value={form.areaId||''} onChange={v=>changeForm({...form,areaId:v})} options={formAreas} placeholder={formWardId?'Search colony…':'Select ward first'}/></Field>
    <Field label="Type *"><select required value={form.kind||'SHOP'} onChange={e=>changeForm({...form,kind:e.target.value})}><option value="SHOP">Shop</option><option value="OFFICE">Office</option></select></Field>
    <Field label="Ownership *"><select required value={form.ownership||''} onChange={e=>changeForm({...form,ownership:e.target.value})}><option value="">Owned or rented</option><option value="OWN">Own</option><option value="RENT">Rent</option><option value="OTHER">Other</option></select></Field>
    <Field label="Category"><SearchableSelect value={form.category||''} onChange={v=>changeForm({...form,category:v,categoryCustom:v==='Other'?form.categoryCustom:''})} options={CATEGORIES.map(c=>({value:c,label:c}))} placeholder="Search category…"/></Field>
    {form.category==='Other'&&<Field label="Write category *"><input required value={form.categoryCustom||''} onChange={e=>changeForm({...form,categoryCustom:e.target.value})} placeholder="e.g. Stationery, Sweet shop"/></Field>}
    <Field className="span-2" label="Name *"><input required value={form.name||''} onChange={e=>changeForm({...form,name:e.target.value})} placeholder="e.g. Shree Medical, Kulkarni Associates"/></Field>
    <Field className="span-2" label="Complete address *"><textarea required value={form.address||''} onChange={e=>changeForm({...form,address:e.target.value})} placeholder="Shop number, street, market"/></Field>
    <Field label="Landmark (optional)"><input value={form.landmark||''} onChange={e=>changeForm({...form,landmark:e.target.value})} placeholder="Nearby landmark"/></Field>
    <Field label="Opening hours (optional)"><input value={form.openingHours||''} onChange={e=>changeForm({...form,openingHours:e.target.value})} placeholder="e.g. 9am – 9pm"/></Field>
    <Field label="Owner name"><input value={form.ownerName||''} onChange={e=>changeForm({...form,ownerName:e.target.value})} placeholder="Owner / in-charge"/></Field>
    <Field label="Owner mobile"><input inputMode="numeric" maxLength={10} value={form.ownerMobile||''} onChange={e=>changeForm({...form,ownerMobile:e.target.value.replace(/\D/g,'').slice(0,10)})} placeholder="10 digit mobile"/></Field>
    <div className="form-section-title span-2"><strong>Location</strong><span>Use GPS at the entrance. Only the pin is saved.</span></div>
    <LocationPicker key={edit?.id||'new-shop'} value={form} onChange={next=>changeForm({...form,latitude:next.latitude,longitude:next.longitude})} centerFrom={[selectedArea,selectedWard]} hint="Stand at the shop or office door and tap Use GPS."/>
    <Field className="span-2" label="Notes"><textarea value={form.notes||''} onChange={e=>changeForm({...form,notes:e.target.value})} placeholder="Optional note"/></Field>
    <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>{setEdit(null);setAdd(null)}}>Cancel</button><button className="primary-btn">{edit?'Save changes':'Save shop / office'}</button></div>
   </form>
  </Modal>}
 </div>;
}
