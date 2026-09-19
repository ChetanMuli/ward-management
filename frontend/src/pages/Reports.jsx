import React,{useEffect,useMemo,useState} from 'react';
import {api} from '../services/api'; import * as XLSX from 'xlsx'; import jsPDF from 'jspdf'; import autoTable from 'jspdf-autotable';
import {ErrorBox,Loading,PageHeader,SearchableSelect,Toolbar} from '../components/Ui'; import WardFilter from '../components/WardFilter'; import {filterByWard,useWardFilter} from '../wardFilter';
const configs={
 citizens:{title:'Citizen report',get:(wardId,areaId)=>api.persons({limit:500,wardId,areaId}),map:p=>({Name:p.fullName,DOB:p.dob,Age:p.age,Mobile:p.mobile||'',WhereNow:p.presenceStatus==='OUT_OF_CITY'?'Out of city':p.presenceStatus==='AT_HOME'?'At this house':'',CurrentCity:p.currentCity||'',Family:p.family?.familyName||'',House:p.family?.house?.houseNumber||'',Address:p.family?.house?.address||'',Colony:p.family?.house?.area?.name||'',Ward:p.family?.house?.area?.ward?.wardNumber||'',Voter:p.voterProfile?.status||''})},
 outOfCity:{title:'Out of city people',get:(wardId,areaId)=>api.persons({limit:500,wardId,areaId,presenceStatus:'OUT_OF_CITY'}),map:p=>({Name:p.fullName,DOB:p.dob,Age:p.age,Mobile:p.mobile||'',CurrentCity:p.currentCity||'',LivingWith:p.livingWith||'',Family:p.family?.familyName||'',House:p.family?.house?.houseNumber||'',Colony:p.family?.house?.area?.name||'',Ward:p.family?.house?.area?.ward?.wardNumber||'',Voter:p.voterProfile?.status||''})},
 outOfCityVoters:{title:'Out of city voters',get:(wardId,areaId)=>api.voters({limit:500,wardId,areaId,status:'VOTER',presenceStatus:'OUT_OF_CITY'}),map:r=>{const p=r.Person||r.person||{};return {Name:p.fullName||r.fullName||'',Age:p.age??'',Mobile:p.mobile||'',CurrentCity:p.currentCity||'',Family:p.family?.familyName||'',House:p.family?.house?.houseNumber||'',Colony:p.family?.house?.area?.name||'',Ward:p.family?.house?.area?.ward?.wardNumber||'',VoterStatus:r.status||'',VotingWard:r.votingWard||''}}},
 families:{title:'Family report',get:(wardId,areaId)=>api.families({limit:500,wardId,areaId}),map:f=>({Family:f.familyName||'',House:f.house?.houseNumber||'',Address:f.house?.address||'',Colony:f.house?.area?.name||'',Ward:f.house?.area?.ward?.wardNumber||'',Members:f.members?.length||0})},
 houses:{title:'House report',get:(wardId,areaId)=>api.houses({limit:500,wardId,areaId}),map:h=>({House:h.houseNumber,Address:h.address,Ownership:h.ownership,Type:h.houseType,Colony:h.area?.name||'',Ward:h.area?.ward?.wardNumber||'',Owner:h.ownerName||'',Mobile:h.ownerMobile||''})},
 shops:{title:'Shops & offices',get:(wardId,areaId)=>api.shops({limit:500,wardId,areaId}),map:s=>({Name:s.name,Type:s.kind==='OFFICE'?'Office':'Shop',Category:s.category||'',Ownership:s.ownership||'',Owner:s.ownerName||'',Mobile:s.ownerMobile||'',Address:s.address||'',Colony:s.area?.name||'',Ward:s.area?.ward?.wardNumber||''})},
 voters:{title:'Voters report',get:(wardId,areaId)=>api.voters({limit:500,wardId,areaId,status:'VOTER'}),map:r=>{const p=r.Person||r.person||{};return {Name:p.fullName||r.fullName||'',Age:p.age??'',Mobile:p.mobile||'',WhereNow:p.presenceStatus==='OUT_OF_CITY'?'Out of city':p.presenceStatus==='AT_HOME'?'At this house':'',CurrentCity:p.currentCity||'',Family:p.family?.familyName||'',House:p.family?.house?.houseNumber||'',Colony:p.family?.house?.area?.name||'',Ward:p.family?.house?.area?.ward?.wardNumber||'',VoterStatus:r.status||'',VotingWard:r.votingWard||''}}},
 nonVoters:{title:'Non-voters report',get:(wardId,areaId)=>api.voters({limit:500,wardId,areaId,status:'NON_VOTER'}),map:r=>{const p=r.Person||r.person||{};return {Name:p.fullName||r.fullName||'',Age:p.age??'',Mobile:p.mobile||'',WhereNow:p.presenceStatus==='OUT_OF_CITY'?'Out of city':p.presenceStatus==='AT_HOME'?'At this house':'',CurrentCity:p.currentCity||'',Family:p.family?.familyName||'',House:p.family?.house?.houseNumber||'',Colony:p.family?.house?.area?.name||'',Ward:p.family?.house?.area?.ward?.wardNumber||'',VoterStatus:r.status||''}}},
 birthdays:{title:'Birthday report',get:(wardId)=>api.birthdays(90,wardId,0),map:r=>({Name:r.person.fullName,DOB:r.person.dob,Age:r.person.age,Mobile:r.person.mobile||'',Family:r.person.family?.familyName||'',House:r.person.family?.house?.houseNumber||'',Address:r.person.family?.house?.address||'',Colony:r.person.family?.house?.area?.name||'',Ward:r.person.family?.house?.area?.ward?.wardNumber||'',DaysToBirthday:r.daysToBirthday})},
 followup:{title:'18+ Follow-up report',get:(wardId)=>api.upcoming18(90,wardId),map:r=>({Name:r.person.fullName,DOB:r.person.dob,Age:r.person.age,Mobile:r.person.mobile||'',Family:r.person.family?.familyName||'',House:r.person.family?.house?.houseNumber||'',Address:r.person.family?.house?.address||'',Colony:r.person.family?.house?.area?.name||'',Ward:r.person.family?.house?.area?.ward?.wardNumber||'',DaysTo18:r.daysTo18,FollowUp:r.person.followupStatus||'NOT_CONTACTED'})},
 complaints:{title:'Complaint report',get:(wardId,areaId)=>api.complaints({limit:500,wardId,areaId}),map:c=>({Complaint:c.complaintNumber,Status:c.status,Ward:c.house?.area?.ward?.wardNumber||'',Colony:c.house?.area?.name||'',House:c.house?.houseNumber||'',Citizen:c.citizen?.fullName||c.citizenPersonId,Description:c.description})},
 wards:{title:'Ward / Area report',get:()=>api.wards(),map:w=>({Ward:w.wardNumber,Name:w.name,Areas:(w.areas||[]).map(a=>a.name).join(', ')})}
};
function rowAreaId(row){return row?.areaId||row?.area?.id||row?.house?.areaId||row?.house?.area?.id||row?.family?.house?.areaId||row?.family?.house?.area?.id||row?.person?.family?.house?.areaId||row?.person?.family?.house?.area?.id||row?.Person?.family?.house?.areaId||row?.Person?.family?.house?.area?.id||null}
export default function Reports(){const {selectedWardId,wards}=useWardFilter();const [type,setType]=useState('citizens'),[areaId,setAreaId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const ward=wards.find(w=>w.id===selectedWardId);const areas=useMemo(()=>selectedWardId?(ward?.areas||[]):wards.flatMap(w=>(w.areas||[]).map(a=>({...a,wardNumber:w.wardNumber}))),[wards,ward,selectedWardId]);useEffect(()=>setAreaId(''),[selectedWardId]);
 async function getRows(){
   setBusy(true);setError('');
   try{
     const raw=(await configs[type].get(selectedWardId||undefined,areaId||undefined)).data||[];
     let filtered=filterByWard(raw,selectedWardId);
     if(areaId)filtered=filtered.filter(r=>rowAreaId(r)===areaId);
     return {rows:filtered.map(configs[type].map),error:''};
   }catch(e){setError(e.message);return {rows:[],error:e.message}}
   finally{setBusy(false)}
 }
 async function excel(){
   const result=await getRows(); const rows=result.rows;
   if(!rows.length){if(!result.error)setError('No data found for the selected ward / colony.');return;}
   const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Report');
   XLSX.writeFile(wb,`ward-${type}${areaId?'-colony':''}-report.xlsx`);
 }
 async function pdf(){
   const result=await getRows(); const rows=result.rows;
   if(!rows.length){if(!result.error)setError('No data found for the selected ward / colony.');return;}
   const doc=new jsPDF({orientation:'landscape'});const scope=selectedWardId?(ward?.wardNumber||'Selected ward'):'All wards';
   doc.text(`${configs[type].title} · ${scope}${areaId?' · Colony filtered':''}`,14,15);
   autoTable(doc,{startY:22,head:[Object.keys(rows[0])],body:rows.map(r=>Object.values(r).map(v=>String(v??''))),styles:{fontSize:7}});
   doc.save(`ward-${type}${areaId?'-colony':''}-report.pdf`);
 }
 const areaOptions=[{value:'',label:selectedWardId?'All colonies':'All colonies / areas'},...areas.map(a=>({value:a.id,label:`${a.wardNumber?a.wardNumber+' · ':''}${a.name}`}))];
 const typeOptions=Object.entries(configs).map(([k,v])=>({value:k,label:v.title}));
 return <div><PageHeader kicker="Tools" title="Reports & export" subtitle="Export data by ward and, when required, by colony / area. Choose Voters report or Non-voters report to extract only that list."/><ErrorBox error={error}/><section className="panel report-panel"><Toolbar><WardFilter/><SearchableSelect label="Colony / Area" value={areaId} onChange={setAreaId} options={areaOptions} placeholder="Search colony…"/><SearchableSelect label="Report" value={type} onChange={setType} options={typeOptions} placeholder="Search report type…"/></Toolbar><div className="report-scope-note">Scope: <b>{selectedWardId?(ward?.wardNumber||'Selected ward'):'All wards'}</b> · <b>{areaId?(areas.find(a=>a.id===areaId)?.name||'Selected colony'):'All colonies'}</b></div><div className="export-actions"><button className="primary-btn" disabled={busy} onClick={excel}>{busy?'Preparing…':'⇩ Export Excel'}</button><button className="ghost-btn" disabled={busy} onClick={pdf}>{busy?'Preparing…':'▣ Export PDF'}</button></div></section></div>}
