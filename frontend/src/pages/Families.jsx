import React,{useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {api} from '../services/api';
import {Empty,ErrorBox,Field,Loading,Modal,PageHeader,RowMenu,StatusPill,Toolbar,SearchableSelect} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {filterByWard,useWardFilter} from '../wardFilter';
import {can,canModule,isNagarsevak,isEmployee} from '../rbac';
import PersonForm,{emptyPerson,presenceLine} from '../components/PersonForm';
import DeathAction from '../components/DeathAction';
import {geoPayload,hasCoords,housePlace,placeLine,nativePlaceLine,directionsUrl,MAHARASHTRA_DISTRICTS,isFlatHome,homePickOption,isOutOfCity,isVoterPerson,PEOPLE_PLACE_OPTIONS} from '../location';
import {emptyNativePlace} from '../nativePlace';
import LocationPicker,{DirectionsLink,MapPreview} from '../components/LocationMap';

function canPinHouse(){
 return can('EDIT_HOUSES')||canModule('HOUSES','EDIT')||can('EDIT_FAMILIES')||canModule('FAMILIES','EDIT')||can('CREATE_HOUSES')||isNagarsevak()||isEmployee();
}

function emptyFamily(houseId='',extra={}){
 return {familyName:'',houseId,dwelling:'',apartmentId:'',notes:'',...emptyNativePlace,...extra};
}
function locForm(house){
 if(!house) return null;
 return {
  id:house.id,
  houseNumber:house.houseNumber,
  latitude:hasCoords(house.latitude,house.longitude)?house.latitude:'',
  longitude:hasCoords(house.latitude,house.longitude)?house.longitude:'',
  area:house.area||null
 };
}

export default function Families(){
 const {selectedWardId}=useWardFilter();
 const [searchParams,setSearchParams]=useSearchParams();
 const [rows,setRows]=useState(null),[houses,setHouses]=useState([]),[wards,setWards]=useState([]),[apartments,setApartments]=useState([]);
 const [filters,setFilters]=useState({search:'',areaId:'',homeKind:'',apartmentId:'',peopleFilter:''});
 const [detail,setDetail]=useState(null),[edit,setEdit]=useState(null),[add,setAdd]=useState(null);
 const [memberForm,setMemberForm]=useState(null),[editingMember,setEditingMember]=useState(null),[memberFamilyId,setMemberFamilyId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[deathPerson,setDeathPerson]=useState(null);
 const [houseLoc,setHouseLoc]=useState(null),[locFamilyId,setLocFamilyId]=useState(''),[locReturn,setLocReturn]=useState(false);
 const pin=canPinHouse();
 async function load(){try{setError('');setRows((await api.families({limit:500,wardId:selectedWardId||undefined})).data||[])}catch(e){setError(e.message)}}
 useEffect(()=>{load();Promise.all([api.houses({limit:500,wardId:selectedWardId||undefined}),api.wards(),api.apartments({wardId:selectedWardId||undefined})]).then(([h,w,a])=>{setHouses(h.data||[]);setWards(w.data||[]);setApartments(a.data||[])}).catch(e=>setError(e.message))},[selectedWardId]);
 useEffect(()=>{
  const apt=searchParams.get('apartmentId');
  const area=searchParams.get('areaId');
  if(apt) setFilters(f=>({...f,homeKind:'FLAT',apartmentId:apt}));
  if(area) setFilters(f=>({...f,areaId:area}));
 },[searchParams]);
 const visible=useMemo(()=>filterByWard(rows||[],selectedWardId).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).filter(f=>{
  const hid=searchParams.get('houseId');
  if(hid && String(f.houseId||f.house?.id||'')!==String(hid)) return false;
  if(filters.areaId && String(f.house?.areaId||f.house?.area?.id||'')!==String(filters.areaId)) return false;
  if(filters.homeKind==='HOUSE' && isFlatHome(f.house)) return false;
  if(filters.homeKind==='FLAT' && !isFlatHome(f.house)) return false;
  if(filters.apartmentId && String(f.house?.apartmentId||f.house?.apartment?.id||'')!==String(filters.apartmentId)) return false;
  const live=(f.members||[]).filter(m=>m.status!=='DECEASED');
  if(filters.peopleFilter==='OUT_OF_CITY' && !live.some(isOutOfCity)) return false;
  if(filters.peopleFilter==='OUT_VOTER' && !live.some(m=>isOutOfCity(m)&&isVoterPerson(m))) return false;
  if(filters.peopleFilter==='VOTER' && !live.some(isVoterPerson)) return false;
  if(filters.peopleFilter==='AT_HOME' && !live.some(m=>String(m.presenceStatus||'').toUpperCase()==='AT_HOME')) return false;
  if(!filters.search) return true;
  const members=(f.members||[]).filter(m=>m.status!=='DECEASED').map(m=>`${m.fullName||''} ${m.mobile||''}`).join(' ');
  return `${f.familyName||''} ${f.house?.houseNumber||''} ${f.house?.apartment?.name||''} ${f.house?.area?.name||''} ${f.nativeVillage||''} ${f.nativeDistrict||''} ${members}`.toLowerCase().includes(filters.search.toLowerCase());
 }),[rows,selectedWardId,filters,searchParams]);
 const colonyOptions=(selectedWardId?(wards.find(w=>String(w.id)===String(selectedWardId))?.areas||[]):wards.flatMap(w=>w.areas||[]));
 const colonyCounts=useMemo(()=>{
  const map=new Map();
  (rows||[]).forEach(f=>{
   if(selectedWardId && !filterByWard([f],selectedWardId).length) return;
   const id=String(f.house?.areaId||f.house?.area?.id||'');
   if(!id) return;
   map.set(id,(map.get(id)||0)+1);
  });
  return map;
 },[rows,selectedWardId]);
 const apartmentCounts=useMemo(()=>{
  const map=new Map();
  (rows||[]).forEach(f=>{
   const id=String(f.house?.apartmentId||f.house?.apartment?.id||'');
   if(!id) return;
   map.set(id,(map.get(id)||0)+1);
  });
  return map;
 },[rows]);
 const form=edit||add;
 const formHouses=houses.filter(h=>{
  if(selectedWardId && !(h.area?.wardId===selectedWardId||h.area?.ward?.id===selectedWardId)) return false;
  return true;
 });
 const independentHouses=formHouses.filter(h=>!isFlatHome(h)).sort((a,b)=>String(a.houseNumber||'').localeCompare(String(b.houseNumber||''),undefined,{numeric:true}));
 const formFlats=formHouses.filter(h=>{
  if(!isFlatHome(h)) return false;
  if(form?.apartmentId && String(h.apartmentId||h.apartment?.id||'')!==String(form.apartmentId)) return false;
  return true;
 }).sort((a,b)=>String(a.houseNumber||'').localeCompare(String(b.houseNumber||''),undefined,{numeric:true}));
 const formApartments=apartments.filter(a=>{
  if(selectedWardId && String(a.wardId||a.ward?.id||a.area?.wardId||'')!==String(selectedWardId)) return false;
  return true;
 });
 const listedApartments=formApartments.filter(a=>!filters.areaId||String(a.areaId||a.area?.id||'')===String(filters.areaId));
 const districtOptions=useMemo(()=>{
  const list=MAHARASHTRA_DISTRICTS.map(d=>({value:d,label:d}));
  const cur=form?.nativeDistrict;
  if(cur && !list.some(d=>d.value===cur)) list.unshift({value:cur,label:cur});
  return list;
 },[form?.nativeDistrict]);
 const canAddFamily=can('CREATE_FAMILIES')||canModule('FAMILIES','CREATE')||isNagarsevak()||isEmployee();
 useEffect(()=>{
  const houseId=searchParams.get('houseId');
  if(!canAddFamily || add || edit) return;
  if(houseId && houses.some(h=>String(h.id)===String(houseId))){
   const h=houses.find(x=>String(x.id)===String(houseId));
   setAdd(emptyFamily(houseId,{dwelling:isFlatHome(h)?'FLAT':'HOUSE',apartmentId:h.apartmentId||h.apartment?.id||''}));
   setSearchParams(prev=>{const n=new URLSearchParams(prev);n.delete('houseId');return n;},{replace:true});
  }
 },[houses,searchParams,add,edit,canAddFamily,setSearchParams]);
 function patchForm(next){(edit?setEdit:setAdd)(next)}
 function setDwelling(dwelling){
  patchForm({...form,dwelling,houseId:'',apartmentId:dwelling==='FLAT'?form.apartmentId:''});
 }
 function pickApartmentForFamily(apartmentId){
  patchForm({...form,dwelling:'FLAT',apartmentId,houseId:''});
 }
 function familyFromHouse(f){
  const h=f.house||{};
  return {...emptyFamily(),...f,houseId:f.houseId||h.id||'',dwelling:isFlatHome(h)?'FLAT':'HOUSE',apartmentId:h.apartmentId||h.apartment?.id||''};
 }
 async function openFamily(id){try{setError('');setDetail((await api.family(id)).data)}catch(e){setError(e.message)}}
 async function saveFamily(e){
  e.preventDefault();
  setBusy(true);
  try{
   const src=edit||add;
   if(!src.dwelling) throw new Error('Choose whether they live in a house or a flat.');
   if(!src.houseId) throw new Error(src.dwelling==='FLAT'?'Select the flat number.':'Select the house.');
   const payload={familyName:src.familyName,houseId:src.houseId,notes:src.notes,nativeVillage:src.nativeVillage,nativeTaluka:src.nativeTaluka,nativeDistrict:src.nativeDistrict,nativeState:'Maharashtra'};
   if(edit) await api.updateFamily(edit.id,payload);
   else await api.createFamily(payload);
   setEdit(null);setAdd(null);await load();
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 }
 async function saveMember(e){e.preventDefault();const familyId=memberFamilyId||detail?.id;if(!familyId)return;setBusy(true);try{const payload={...memberForm,familyId};delete payload.age;delete payload.voterProfile;delete payload.family;delete payload.house;if(editingMember)await api.updatePerson(editingMember.id,payload);else await api.createPerson(payload);setMemberForm(null);setEditingMember(null);setMemberFamilyId('');await load();if(familyId)await openFamily(familyId)}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function deleteMember(id){if(!confirm('Remove this family member?'))return;try{await api.deletePerson(id);await openFamily(detail.id);await load()}catch(e){setError(e.message)}}
 function openHouseLoc(house,familyId,fromDetail=false){
  if(!house?.id) return;
  setLocFamilyId(familyId||detail?.id||'');
  setLocReturn(!!fromDetail);
  if(fromDetail) setDetail(null);
  setHouseLoc(locForm(house));
 }
 async function saveHouseLoc(e){
  e.preventDefault();
  if(!houseLoc?.id) return;
  if(!hasCoords(houseLoc.latitude,houseLoc.longitude)){
   setError('Use GPS or tap the map to set the exact door pin before saving.');
   return;
  }
  setBusy(true);
  try{
   await api.updateHouse(houseLoc.id,geoPayload(houseLoc,['latitude','longitude']));
   const familyId=locFamilyId;
   const reopen=locReturn;
   setHouseLoc(null);setLocFamilyId('');setLocReturn(false);
   await load();
   if(reopen&&familyId) await openFamily(familyId);
  }catch(err){setError(err.message)}
  finally{setBusy(false)}
 }
 function closeHouseLoc(){
  const familyId=locFamilyId;
  const reopen=locReturn;
  setHouseLoc(null);setLocFamilyId('');setLocReturn(false);
  if(reopen&&familyId) openFamily(familyId);
 }

 return <div>
  <PageHeader kicker="People & houses" title="Families" subtitle="Choose House or Flat first, then the house / flat number. Filter by colony to see who lives where." action={canAddFamily?<button className="primary-btn" onClick={()=>setAdd(emptyFamily())}>+ Add family</button>:null}/>
  <ErrorBox error={error}/>
  <Toolbar>
   <WardFilter/>
   <SearchableSelect value={filters.areaId} onChange={v=>setFilters({...filters,areaId:v,apartmentId:''})} options={[{value:'',label:'All colonies'},...colonyOptions.map(a=>({value:a.id,label:a.name,hint:colonyCounts.get(String(a.id))?`${colonyCounts.get(String(a.id))} families`:''}))]} placeholder="Search colony…"/>
   <SearchableSelect value={filters.homeKind} onChange={v=>setFilters({...filters,homeKind:v,apartmentId:v==='HOUSE'?'':filters.apartmentId})} options={[{value:'',label:'House / Flat'},{value:'HOUSE',label:'Houses'},{value:'FLAT',label:'Flats'}]} placeholder="House / Flat"/>
   {filters.homeKind!=='HOUSE'&&<SearchableSelect value={filters.apartmentId} onChange={v=>{setFilters({...filters,apartmentId:v,homeKind:v?'FLAT':filters.homeKind});setSearchParams(prev=>{const n=new URLSearchParams(prev);n.delete('apartmentId');return n},{replace:true})}} options={[{value:'',label:'All apartments'},...listedApartments.map(a=>({value:a.id,label:a.name,hint:apartmentCounts.get(String(a.id))?`${apartmentCounts.get(String(a.id))} families`:''}))]} placeholder="Search apartment…"/>}
   <SearchableSelect value={filters.peopleFilter} onChange={v=>setFilters({...filters,peopleFilter:v})} options={PEOPLE_PLACE_OPTIONS} placeholder="People filter"/>
   <input className="grow" placeholder="Search family, member, house or flat…" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})}/>
  </Toolbar>
  {!!visible.length&&<p className="family-scope-bar">{visible.length} {visible.length===1?'family':'families'}{filters.areaId?` in ${colonyOptions.find(a=>String(a.id)===String(filters.areaId))?.name||'this colony'}`:''}{filters.homeKind==='HOUSE'?' in independent houses':''}{filters.homeKind==='FLAT'||filters.apartmentId?` in ${filters.apartmentId?(formApartments.find(a=>String(a.id)===String(filters.apartmentId))?.name||'this apartment'):'flats'}`:''}{filters.peopleFilter==='OUT_VOTER'?' with out of city voters':filters.peopleFilter==='OUT_OF_CITY'?' with out of city members':filters.peopleFilter==='VOTER'?' with voters':filters.peopleFilter==='AT_HOME'?' with members at this house':''}.</p>}
  {!rows?<Loading/>:!visible.length?<Empty>{filters.peopleFilter==='OUT_VOTER'?'No families with out of city voters for this filter.':filters.peopleFilter==='OUT_OF_CITY'?'No families with out of city members for this filter.':filters.apartmentId||filters.homeKind==='FLAT'?'No families in this flat / apartment yet. Add a family and pick the flat number.':filters.areaId?'No families in this colony yet.':'No families found for this ward/filter.'}</Empty>:<div className="family-grid">{visible.map(f=><article className="family-card" key={f.id}>
   <div className="family-card-top"><div><span className="eyebrow">FAMILY</span><h3>{f.familyName||'Unnamed family'}</h3></div><span className="muted">{(f.members||[]).filter(m=>m.status!=='DECEASED').length} active members{(f.members||[]).some(m=>m.status!=='DECEASED'&&isOutOfCity(m))?` · ${(f.members||[]).filter(m=>m.status!=='DECEASED'&&isOutOfCity(m)).length} out of city`:''}</span></div>
   <div className="family-meta"><div><span>{isFlatHome(f.house)?'Flat':'House'}</span><strong className="plain-cell">{placeLine([isFlatHome(f.house)?f.house?.apartment?.name:'',f.house?.houseNumber])||'—'}</strong></div><div><span>Colony</span><strong>{f.house?.area?.name||'—'}</strong></div><div><span className="notranslate" translate="no">Native village</span><strong>{f.nativeVillage||'—'}</strong></div></div>
   <p className="family-address">{housePlace(f.house)||f.house?.address||'No address'}</p>
   <div className="family-loc-row">
    {hasCoords(f.house?.latitude,f.house?.longitude)?<DirectionsLink lat={f.house.latitude} lng={f.house.longitude} label="Directions"/>:<span className="muted">Location not saved</span>}
    {pin&&<button type="button" className="small-btn" onClick={()=>openHouseLoc(f.house,f.id)}>Update location</button>}
   </div>
   <div className="member-mini-list">{(f.members||[]).filter(m=>m.status!=='DECEASED').slice(0,5).map(m=><span key={m.id}>{m.fullName}</span>)}{(f.members||[]).filter(m=>m.status!=='DECEASED').length>5&&<span>+{(f.members||[]).filter(m=>m.status!=='DECEASED').length-5} more</span>}</div>
   <div className="card-actions"><RowMenu items={[
     {label:'View details',onClick:()=>openFamily(f.id)},
     hasCoords(f.house?.latitude,f.house?.longitude)&&{label:'Get directions',onClick:()=>window.open(directionsUrl(f.house.latitude,f.house.longitude),'_blank','noopener')},
     pin&&{label:'Update location',onClick:()=>openHouseLoc(f.house,f.id)},
     can('EDIT_FAMILIES')&&{label:'Edit',onClick:()=>setEdit(familyFromHouse(f))},
     can('DELETE_FAMILIES')&&{label:'Delete',danger:true,onClick:async()=>{if(confirm('Move family to recycle bin?')){try{await api.deleteFamily(f.id);await load()}catch(e){setError(e.message)}}}}
   ]}/></div>
  </article>)}</div>}

  {detail&&<Modal wide title={`${detail.familyName||'Family'} · Complete family`} onClose={()=>{setDetail(null);setMemberForm(null);setEditingMember(null);setMemberFamilyId('')}}>
   <div className="detail-grid">
    <div className="detail-card"><h3>Household</h3><p><b>Path:</b> {housePlace(detail.house)||'—'}</p><p><b>Lives in:</b> {isFlatHome(detail.house)?'Flat':'House'}</p><p><b>Apartment:</b> {detail.house?.apartment?.name||'—'}</p><p><b>{isFlatHome(detail.house)?'Flat number':'House number'}:</b> {detail.house?.houseNumber||'—'}</p><p><b>Address:</b> {detail.house?.address||'—'}</p><p><b>Landmark:</b> {detail.house?.landmark||'—'}</p><p><b>City:</b> {detail.house?.city||detail.house?.area?.city||'—'}</p><p><b>Ward:</b> {detail.house?.area?.ward?.wardNumber||'—'} · {detail.house?.area?.ward?.name||''}</p><p><b>Colony:</b> {detail.house?.area?.name||'—'}</p></div>
    <div className="detail-card"><h3>Go to this home</h3>
     <MapPreview lat={detail.house?.latitude} lng={detail.house?.longitude} label={detail.house?.houseNumber?`House ${detail.house.houseNumber}`:'This home'}>
      {pin&&<button type="button" className="small-btn loc-update-btn" onClick={()=>openHouseLoc(detail.house,detail.id,true)}>Update location</button>}
     </MapPreview>
    </div>
    <div className="detail-card"><h3>Family actions</h3><p><b className="notranslate" translate="no">Native village:</b> {nativePlaceLine(detail)||'Not recorded'}</p><p className="muted">Every saved member becomes a citizen automatically. DOB drives age, birthdays and 18+ follow-up. Voter / Non-Voter is optional for adults.</p>{can('CREATE_CITIZENS')&&<button className="primary-btn" onClick={()=>{setEditingMember(null);setMemberFamilyId(detail.id);setMemberForm({...emptyPerson,familyId:detail.id});setDetail(null)}}>+ Add family member</button>}</div>
   </div>
   <div className="detail-card"><div className="panel-title"><div><h3>Family members ({(detail.members||[]).filter(m=>m.status!=='DECEASED').length})</h3><span>Members appear here immediately after saving. Add, edit or remove members at any time.</span></div></div>{!(detail.members||[]).filter(m=>m.status!=='DECEASED').length?<Empty>No active members. Add a member.</Empty>:<div className="member-grid">{(detail.members||[]).filter(m=>m.status!=='DECEASED').map(m=><div className="member-card rich-member" key={m.id}><div><strong>{m.fullName}</strong><span>{m.age==null?'Age not available':`${m.age} years`} · {m.mobile||'No mobile'}</span><span>{m.occupationType==='BUSINESS'?`Business: ${m.businessName||'—'}`:m.occupationType==='SERVICE'?`Service: ${m.companyName||'—'} ({m.employmentType||'—'})`:'Other occupation'}</span><span>{m.voterProfile?.status==='VOTER'?'Voter':'Non-Voter'}</span>{presenceLine(m)?<span>{presenceLine(m)}</span>:null}</div><div className="card-actions"><RowMenu items={[
     can('EDIT_CITIZENS')&&{label:'Edit',onClick:()=>{setEditingMember(m);setMemberFamilyId(detail.id);setMemberForm({...emptyPerson,...m,isVoter:m.voterProfile?.status==='VOTER'?'VOTER':m.voterProfile?.status==='NON_VOTER'?'NON_VOTER':'',officialVoterIdRef:m.voterProfile?.officialVoterIdRef||'',votingWard:m.voterProfile?.votingWard||'',constituency:m.voterProfile?.constituency||''});setDetail(null)}},
     can('CREATE_DEATH_RECORDS')&&{label:'Mark deceased',danger:true,onClick:()=>setDeathPerson(m)},
     can('DELETE_CITIZENS')&&{label:'Remove',danger:true,onClick:()=>deleteMember(m.id)}
    ]}/></div></div>)}</div>}</div>
  </Modal>}

  {houseLoc&&<Modal wide title={`Update location · House ${houseLoc.houseNumber||''}`} onClose={closeHouseLoc}>
   <form className="form-grid admin-form" onSubmit={saveHouseLoc}>
    <div className="form-section-title span-2"><strong>Exact home location</strong><span>Stand at the door, tap Use GPS, or tap the map. This pin is saved on the house for every family member.</span></div>
    <ErrorBox error={error}/>
    <LocationPicker key={houseLoc.id} value={houseLoc} onChange={next=>setHouseLoc(cur=>({...cur,latitude:next.latitude,longitude:next.longitude}))} centerFrom={[houseLoc.area,houseLoc.area?.ward]} hint="Stand at the door and tap Use GPS. Only the map pin is saved."/>
    <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={closeHouseLoc}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':'Save location'}</button></div>
   </form>
  </Modal>}

  {memberForm&&<Modal wide title={editingMember?`Edit family member · ${editingMember.fullName||'Member'}`:'Add family member'} onClose={()=>{setMemberForm(null);setEditingMember(null);setMemberFamilyId('')}}><PersonForm value={memberForm} onChange={setMemberForm} hideFamily wards={wards} onSubmit={saveMember} onCancel={()=>{setMemberForm(null);setEditingMember(null);setMemberFamilyId('')}} busy={busy}/></Modal>}

  {(edit||add)&&<Modal wide title={edit?`Edit ${edit.familyName||'Family'}`:'Add family'} onClose={()=>{setEdit(null);setAdd(null)}}>
   <form className="form-grid admin-form" onSubmit={saveFamily}>
    <div className="form-section-title span-2"><strong>Where they live now</strong><span>Choose House or Flat first. Then pick the house number or the apartment and flat number. More than one family can live in the same home.</span></div>
    <Field className="span-2" label="Family name *"><input required value={form.familyName||''} onChange={e=>patchForm({...form,familyName:e.target.value})} placeholder="e.g. Patil family"/></Field>
    <Field className="span-2" label="They live in *"><select required value={form.dwelling||''} onChange={e=>setDwelling(e.target.value)}><option value="">House or Flat</option><option value="HOUSE">House</option><option value="FLAT">Flat</option></select></Field>
    {form.dwelling==='HOUSE'&&<Field className="span-2" label="House number *"><SearchableSelect required value={form.houseId||''} onChange={v=>patchForm({...form,houseId:v})} options={independentHouses.map(homePickOption)} placeholder={independentHouses.length?'Search house number…':'No independent houses yet'}/></Field>}
    {form.dwelling==='FLAT'&&<>
     <Field label="Apartment *"><SearchableSelect required value={form.apartmentId||''} onChange={pickApartmentForFamily} options={formApartments.map(a=>({value:a.id,label:a.name,hint:a.area?.name||''}))} placeholder={formApartments.length?'Search apartment…':'No apartment yet — add one in Houses'}/></Field>
     <Field label="Flat number *"><SearchableSelect required value={form.houseId||''} onChange={v=>patchForm({...form,houseId:v})} options={formFlats.map(homePickOption)} placeholder={form.apartmentId?(formFlats.length?'Search flat number…':'No flats in this apartment yet'):'Select apartment first'}/></Field>
    </>}
    {form.dwelling==='FLAT'&&form.apartmentId&&!formFlats.length&&<p className="muted span-2">No flats saved in this apartment yet. Add a house, choose Flat, then pick this apartment.</p>}
    <div className="form-section-title span-2"><strong className="notranslate" translate="no">Native village</strong><span>Village is required. Taluka is optional. District is Maharashtra only — there is no other state option.</span></div>
    <Field className="span-2" label={<span className="notranslate" translate="no">Native village *</span>}><input required value={form.nativeVillage||''} onChange={e=>patchForm({...form,nativeVillage:e.target.value,nativeState:'Maharashtra'})} placeholder="e.g. Savedi, Pathardi, Kopargaon"/></Field>
    <Field label="Taluka (optional)"><input value={form.nativeTaluka||''} onChange={e=>patchForm({...form,nativeTaluka:e.target.value,nativeState:'Maharashtra'})} placeholder="Taluka"/></Field>
    <Field label="District"><SearchableSelect value={form.nativeDistrict||''} onChange={v=>patchForm({...form,nativeDistrict:v,nativeState:'Maharashtra'})} options={districtOptions} placeholder="Search district…"/></Field>
    <Field label="State"><input value="Maharashtra" readOnly disabled/></Field>
    <Field className="span-2" label="Notes"><textarea value={form.notes||''} onChange={e=>patchForm({...form,notes:e.target.value})} placeholder="Optional household note"/></Field>
    <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>{setEdit(null);setAdd(null)}}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':edit?'Save changes':'Create family'}</button></div>
   </form>
  </Modal>}
  {deathPerson&&<DeathAction trigger={false} person={deathPerson} onSaved={()=>{if(detail?.id)openFamily(detail.id);load()}} onClose={()=>setDeathPerson(null)}/>}
 </div>;
}
