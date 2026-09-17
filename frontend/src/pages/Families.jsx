import React,{useEffect,useMemo,useState} from 'react';
import {api} from '../services/api';
import {Empty,ErrorBox,Field,Loading,Modal,PageHeader,RowMenu,StatusPill,Toolbar,SearchableSelect} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import {filterByWard,useWardFilter} from '../wardFilter';
import {can,canModule,isNagarsevak,isEmployee} from '../rbac';
import PersonForm,{emptyPerson,presenceLine} from '../components/PersonForm';
import DeathAction from '../components/DeathAction';
import {geoPayload,hasCoords,housePlace,placeLine,directionsUrl} from '../location';
import LocationPicker,{DirectionsLink,MapPreview} from '../components/LocationMap';

function canPinHouse(){
 return can('EDIT_HOUSES')||canModule('HOUSES','EDIT')||can('EDIT_FAMILIES')||canModule('FAMILIES','EDIT')||can('CREATE_HOUSES')||isNagarsevak()||isEmployee();
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
 const [rows,setRows]=useState(null),[houses,setHouses]=useState([]),[wards,setWards]=useState([]),[search,setSearch]=useState('');
 const [detail,setDetail]=useState(null),[edit,setEdit]=useState(null),[add,setAdd]=useState(null);
 const [memberForm,setMemberForm]=useState(null),[editingMember,setEditingMember]=useState(null),[memberFamilyId,setMemberFamilyId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[deathPerson,setDeathPerson]=useState(null);
 const [houseLoc,setHouseLoc]=useState(null),[locFamilyId,setLocFamilyId]=useState(''),[locReturn,setLocReturn]=useState(false);
 const pin=canPinHouse();
 async function load(){try{setError('');setRows((await api.families({limit:500,wardId:selectedWardId||undefined})).data||[])}catch(e){setError(e.message)}}
 useEffect(()=>{load();Promise.all([api.houses({limit:500,wardId:selectedWardId||undefined}),api.wards()]).then(([h,w])=>{setHouses(h.data||[]);setWards(w.data||[])}).catch(e=>setError(e.message))},[selectedWardId]);
 const visible=useMemo(()=>filterByWard(rows||[],selectedWardId).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).filter(f=>{if(!search)return true;const members=(f.members||[]).filter(m=>m.status!=='DECEASED').map(m=>`${m.fullName||''} ${m.mobile||''}`).join(' ');return `${f.familyName||''} ${f.id} ${f.house?.houseNumber||''} ${members}`.toLowerCase().includes(search.toLowerCase())}),[rows,selectedWardId,search]);
 const wardHouses=houses.filter(h=>!selectedWardId||h.area?.wardId===selectedWardId||h.area?.ward?.id===selectedWardId).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
 async function openFamily(id){try{setError('');setDetail((await api.family(id)).data)}catch(e){setError(e.message)}}
 async function saveFamily(e){e.preventDefault();setBusy(true);try{const payload={familyName:(edit||add).familyName,houseId:(edit||add).houseId,notes:(edit||add).notes};if(edit)await api.updateFamily(edit.id,payload);else await api.createFamily(payload);setEdit(null);setAdd(null);await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
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
  <PageHeader kicker="People & houses" title="Families" subtitle="Each family lives at a house. Save the house GPS when you visit, then tap Directions to navigate there." action={can('CREATE_FAMILIES')?<button className="primary-btn" onClick={()=>setAdd({familyName:'',houseId:'',notes:''})}>+ Add family</button>:null}/>
  <ErrorBox error={error}/>
  <Toolbar><WardFilter/><input className="grow" placeholder="Search family, member, house number…" value={search} onChange={e=>setSearch(e.target.value)}/></Toolbar>
  {!rows?<Loading/>:!visible.length?<Empty>No families found for this ward/filter.</Empty>:<div className="family-grid">{visible.map(f=><article className="family-card" key={f.id}>
   <div className="family-card-top"><div><span className="eyebrow">FAMILY</span><h3>{f.familyName||'Unnamed family'}</h3></div><span className="muted">{(f.members||[]).filter(m=>m.status!=='DECEASED').length} active members</span></div>
   <div className="family-meta"><div><span>House</span><strong>{f.house?.houseNumber||'—'}</strong></div><div><span>Members</span><strong>{(f.members||[]).filter(m=>m.status!=='DECEASED').length}</strong></div><div><span>Ward</span><strong>{f.house?.area?.ward?.wardNumber||'—'}</strong></div></div>
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
     can('EDIT_FAMILIES')&&{label:'Edit',onClick:()=>setEdit({...f})},
     can('DELETE_FAMILIES')&&{label:'Delete',danger:true,onClick:async()=>{if(confirm('Move family to recycle bin?')){try{await api.deleteFamily(f.id);await load()}catch(e){setError(e.message)}}}}
   ]}/></div>
  </article>)}</div>}

  {detail&&<Modal wide title={`${detail.familyName||'Family'} · Complete family`} onClose={()=>{setDetail(null);setMemberForm(null);setEditingMember(null);setMemberFamilyId('')}}>
   <div className="detail-grid">
    <div className="detail-card"><h3>Household</h3><p><b>Path:</b> {housePlace(detail.house)||'—'}</p><p><b>House:</b> {detail.house?.houseNumber||'—'}</p><p><b>Address:</b> {detail.house?.address||'—'}</p><p><b>Landmark:</b> {detail.house?.landmark||'—'}</p><p><b>City / pincode:</b> {placeLine([detail.house?.city||detail.house?.area?.city,detail.house?.pincode||detail.house?.area?.pincode])||'—'}</p><p><b>Ward:</b> {detail.house?.area?.ward?.wardNumber||'—'} · {detail.house?.area?.ward?.name||''}</p><p><b>Colony:</b> {detail.house?.area?.name||'—'}</p></div>
    <div className="detail-card"><h3>Go to this home</h3>
     <MapPreview lat={detail.house?.latitude} lng={detail.house?.longitude} label={detail.house?.houseNumber?`House ${detail.house.houseNumber}`:'This home'}>
      {pin&&<button type="button" className="small-btn loc-update-btn" onClick={()=>openHouseLoc(detail.house,detail.id,true)}>Update location</button>}
     </MapPreview>
    </div>
    <div className="detail-card"><h3>Family actions</h3><p className="muted">Every saved member becomes a citizen automatically. DOB drives age, birthdays and 18+ follow-up. Voter / Non-Voter is optional for adults.</p>{can('CREATE_CITIZENS')&&<button className="primary-btn" onClick={()=>{setEditingMember(null);setMemberFamilyId(detail.id);setMemberForm({...emptyPerson,familyId:detail.id});setDetail(null)}}>+ Add family member</button>}</div>
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
    <LocationPicker key={houseLoc.id} value={houseLoc} onChange={next=>setHouseLoc({...houseLoc,...next})} centerFrom={[houseLoc.area,houseLoc.area?.ward]} hint="Use GPS at the house door so the next visit can open directions."/>
    <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={closeHouseLoc}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':'Save location'}</button></div>
   </form>
  </Modal>}

  {memberForm&&<Modal wide title={editingMember?`Edit family member · ${editingMember.fullName||'Member'}`:'Add family member'} onClose={()=>{setMemberForm(null);setEditingMember(null);setMemberFamilyId('')}}><PersonForm value={memberForm} onChange={setMemberForm} hideFamily wards={wards} onSubmit={saveMember} onCancel={()=>{setMemberForm(null);setEditingMember(null);setMemberFamilyId('')}} busy={busy}/></Modal>}

  {(edit||add)&&<Modal wide title={edit?`Edit ${edit.familyName||'Family'}`:'Add family'} onClose={()=>{setEdit(null);setAdd(null)}}><form className="form-grid admin-form" onSubmit={saveFamily}><div className="form-section-title span-2"><strong>Household</strong><span>Link this family to the house whose exact pin you already recorded.</span></div><Field label="Family name"><input required value={(edit||add).familyName||''} onChange={e=>(edit?setEdit:setAdd)({...((edit||add)),familyName:e.target.value})} placeholder="e.g. Patil family"/></Field><Field label="House"><SearchableSelect required value={(edit||add).houseId||''} onChange={v=>(edit?setEdit:setAdd)({...((edit||add)),houseId:v})} options={wardHouses.map(h=>({value:h.id,label:placeLine([h.houseNumber,h.area?.name,h.address,hasCoords(h.latitude,h.longitude)?'pinned':''])}))} placeholder="Search house number, colony, address…"/></Field><Field className="span-2" label="Notes"><textarea value={(edit||add).notes||''} onChange={e=>(edit?setEdit:setAdd)({...((edit||add)),notes:e.target.value})} placeholder="Optional household note"/></Field><div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>{setEdit(null);setAdd(null)}}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':edit?'Save changes':'Create family'}</button></div></form></Modal>}
  {deathPerson&&<DeathAction trigger={false} person={deathPerson} onSaved={()=>{if(detail?.id)openFamily(detail.id);load()}} onClose={()=>setDeathPerson(null)}/>}
 </div>;
}
