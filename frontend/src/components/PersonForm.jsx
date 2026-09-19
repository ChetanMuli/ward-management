import React,{useMemo} from 'react';
import {Field,ImageField,SearchableSelect} from './Ui';

function ageFromDob(dob){
 if(!dob)return '';
 const b=new Date(`${dob}T00:00:00`),t=new Date();
 let age=t.getFullYear()-b.getFullYear();
 const m=t.getMonth()-b.getMonth();
 if(m<0||(m===0&&t.getDate()<b.getDate()))age--;
 return Math.max(0,age);
}

export const emptyPerson={fullName:'',gender:'',dob:'',mobile:'',alternateMobile:'',email:'',occupationType:'',businessName:'',businessAddress:'',companyName:'',employmentType:'',officialVoterIdRef:'',voterIdImage:'',aadhaarImage:'',panCardImage:'',notes:'',isVoter:'',votingWard:'',constituency:'',presenceStatus:'',currentCity:'',livingWith:''};

export function presenceLine(p){
 const where=p?.presenceStatus==='OUT_OF_CITY'
  ? `Out of city${p.currentCity?` · ${p.currentCity}`:''}`
  : p?.presenceStatus==='AT_HOME'?'At this house':'';
 const withWho=p?.livingWith==='SELF'?'Self':p?.livingWith==='FAMILY'?'With family':'';
 return [where,withWho].filter(Boolean).join(' · ');
}

export default function PersonForm({value,onChange,families=[],wards=[],hideFamily=false,onSubmit,onCancel,busy=false}){
 const form=value||emptyPerson;
 const age=useMemo(()=>ageFromDob(form.dob),[form.dob]);
 const set=(key,val)=>onChange({...form,[key]:val});
 const occupation=form.occupationType||'';
 const isAdult=age!==''&&age>=18;
 const voterChoice=isAdult?form.isVoter:'';
 const voterOptions=wards.map(w=>({value:w.wardNumber,label:`${w.wardNumber}${w.name?` · ${w.name}`:''}`}));
 return <form className="form-grid person-form" onSubmit={onSubmit}>
  {!hideFamily&&<Field className="span-2" label="Family *"><SearchableSelect required value={form.familyId||''} onChange={v=>set('familyId',v)} options={families.map(f=>({value:f.id,label:`${f.familyName||'Unnamed family'} · ${[f.house?.apartment?.name,f.house?.houseNumber].filter(Boolean).join(' / ')||'No house'}${f.nativeVillage?` · Native village ${f.nativeVillage}`:''}`}))} placeholder="Search family…"/></Field>}

  <div className="form-section-title span-2"><strong>Basic details</strong><span>Enter the citizen's actual information. No field is pre-selected.</span></div>
  <Field label="Full name *"><input required value={form.fullName||''} onChange={e=>set('fullName',e.target.value)} placeholder="Enter full name or N/A" autoComplete="name"/></Field>
  <Field label="Mobile number *"><input required type="text" maxLength={10} value={form.mobile||''} onChange={e=>{const v=e.target.value.toUpperCase();set('mobile',v==='N/A'?'N/A':v.replace(/\D/g,'').slice(0,10))}} placeholder="10 digit mobile or N/A" autoComplete="tel"/></Field>
  <Field label="Gender"><select value={form.gender||''} onChange={e=>set('gender',e.target.value)}><option value="">Not specified / N/A</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></Field>
  <Field label="Date of birth (optional)"><input type="date" max={new Date().toISOString().slice(0,10)} value={form.dob||''} onChange={e=>set('dob',e.target.value)}/>{age!==''&&<div className="age-display"><b>{age}</b><span>years old</span></div>}</Field>
  <Field label="Alternate mobile (optional)"><input type="text" maxLength={10} value={form.alternateMobile||''} onChange={e=>{const v=e.target.value.toUpperCase();set('alternateMobile',v==='N/A'?'N/A':v.replace(/\D/g,'').slice(0,10))}} placeholder="Optional 10 digit number or N/A"/></Field>
  <Field label="Email (optional)"><input type="email" value={form.email||''} onChange={e=>set('email',e.target.value)} placeholder="Optional email" autoComplete="email"/></Field>

  <div className="form-section-title span-2"><strong>Voter information</strong><span>For citizens below 18, voter status is automatically Non-Voter. For adults, choose the actual voter status.</span></div>
  {!isAdult&&age!==''&&<div className="info-note span-2">This citizen is below 18, so voter status will automatically be <b>Non-Voter</b>.</div>}
  {age===''&&<div className="info-note span-2">DOB is not available. Age, birthday and 18+ calculations will remain unavailable until a DOB is entered.</div>}
  {isAdult&&<>
   <Field label="Voter status (optional)"><select value={voterChoice||''} onChange={e=>{const v=e.target.value;onChange({...form,isVoter:v,officialVoterIdRef:v==='VOTER'?form.officialVoterIdRef:'',votingWard:v==='VOTER'?form.votingWard:'',constituency:v==='VOTER'?form.constituency:''})}}><option value="">Not specified / N/A</option><option value="VOTER">Voter</option><option value="NON_VOTER">Non-Voter</option></select></Field>
   {voterChoice==='VOTER'&&<SearchableSelect label="Voting ward (optional)" value={form.votingWard||''} onChange={v=>set('votingWard',v)} options={voterOptions} placeholder="Search voting ward…"/>}
   {voterChoice==='VOTER'&&<Field label="Voter ID number (optional)"><input value={form.officialVoterIdRef||''} onChange={e=>set('officialVoterIdRef',e.target.value.toUpperCase())} placeholder="Optional voter ID number"/></Field>}
   {voterChoice==='VOTER'&&<Field label="Constituency (optional)"><input value={form.constituency||''} onChange={e=>set('constituency',e.target.value)} placeholder="Optional constituency"/></Field>}
  </>}

  <div className="form-section-title span-2"><strong>Occupation</strong><span>Choose one. Extra fields appear only when required.</span></div>
  <Field className="span-2" label="Occupation type"><select value={occupation} onChange={e=>{const v=e.target.value;onChange({...form,occupationType:v,businessName:v==='BUSINESS'?form.businessName:'',businessAddress:v==='BUSINESS'?form.businessAddress:'',companyName:v==='SERVICE'?form.companyName:'',employmentType:v==='SERVICE'?form.employmentType:''})}}><option value="">Not specified / N/A</option><option value="BUSINESS">Business</option><option value="SERVICE">Service</option><option value="OTHER">Not specified / Student / Homemaker / Retired / Other</option></select></Field>
  {occupation==='BUSINESS'&&<><Field label="Business name"><input value={form.businessName||''} onChange={e=>set('businessName',e.target.value)} placeholder="Enter business name"/></Field><Field label="Business address"><textarea value={form.businessAddress||''} onChange={e=>set('businessAddress',e.target.value)} placeholder="Enter business address"/></Field></>}
  {occupation==='SERVICE'&&<><Field label="Company / organisation name"><input value={form.companyName||''} onChange={e=>set('companyName',e.target.value)} placeholder="Enter company / organisation"/></Field><Field label="Service type"><select value={form.employmentType||''} onChange={e=>set('employmentType',e.target.value)}><option value="">Not specified / N/A</option><option value="PRIVATE">Private</option><option value="GOVERNMENT">Government</option></select></Field></>}

  <div className="form-section-title span-2"><strong>Where they are now</strong><span>Record if this member stays at the house, or is currently out of the city — with family or on their own.</span></div>
  <Field label="Current place"><select value={form.presenceStatus||''} onChange={e=>onChange({...form,presenceStatus:e.target.value,currentCity:e.target.value==='OUT_OF_CITY'?form.currentCity:''})}><option value="">Not specified</option><option value="AT_HOME">At this house</option><option value="OUT_OF_CITY">Out of this city</option></select></Field>
  <Field label="Staying with"><select value={form.livingWith||''} onChange={e=>set('livingWith',e.target.value)}><option value="">Not specified</option><option value="FAMILY">With family</option><option value="SELF">Self</option></select></Field>
  {form.presenceStatus==='OUT_OF_CITY'&&<Field className="span-2" label="Current city *"><input required value={form.currentCity||''} onChange={e=>set('currentCity',e.target.value)} placeholder="City where this member is staying now"/></Field>}

  <div className="form-section-title span-2"><strong>Identity documents</strong><span>All documents are optional. Use camera on mobile or choose an existing image.</span></div>
  <ImageField label="Voter ID image" value={form.voterIdImage||''} onChange={v=>set('voterIdImage',v)} cameraLabel="Take voter ID photo"/>
  <ImageField label="Aadhaar card image" value={form.aadhaarImage||''} onChange={v=>set('aadhaarImage',v)} cameraLabel="Take Aadhaar photo"/>
  <ImageField label="PAN card image" value={form.panCardImage||''} onChange={v=>set('panCardImage',v)} cameraLabel="Take PAN photo"/>

  <div className="form-section-title span-2"><strong>Notes</strong><span>Optional internal notes for field staff.</span></div>
  <Field className="span-2 notes-field" label="Notes (optional)"><textarea rows="4" value={form.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Add any useful internal note…"/></Field>
  <div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={onCancel}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Saving…':'Save member'}</button></div>
 </form>;
}
