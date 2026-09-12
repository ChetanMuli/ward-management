import React from 'react';
import {useWardFilter} from '../wardFilter';
import {SearchableSelect} from './Ui';

export default function WardFilter({compact=false,label='Ward'}){
 const {wards,selectedWardId,setWardId,master,canSelect,fixedWardId,loadingWards}=useWardFilter();
 const options=[
  ...(canSelect?[{
    value:'',
    badge:'ALL',
    title:master?(loadingWards?'All wards':`All ${wards.length||0} wards`):'All assigned wards',
    hint:master?'City-wide view':'Every ward you can access',
    label:master?(loadingWards?'All wards':`All ${wards.length||0} wards`):'All assigned wards',
    search:`all wards city ${wards.map(w=>`${w.wardNumber} ${w.name||''}`).join(' ')}`
  }]:[]),
  ...wards.map(w=>({
    value:String(w.id),
    badge:w.wardNumber,
    title:w.name||w.wardNumber,
    hint:w.name?`${w.wardNumber} · Municipal ward`:w.wardNumber,
    label:`${w.wardNumber}${w.name?` · ${w.name}`:''}`,
    search:`${w.wardNumber} ${w.name||''}`
  }))
 ];
 const current=wards.find(w=>String(w.id)===String(selectedWardId||fixedWardId));
 const locked=current?[{
  value:String(current.id),
  badge:current.wardNumber,
  title:current.name||current.wardNumber,
  hint:'Assigned ward',
  label:`${current.wardNumber}${current.name?` · ${current.name}`:''}`
 }]:[{value:selectedWardId||fixedWardId||'',label:'Assigned ward'}];
 return <div className={`ward-filter ward-picker ${compact?'ward-filter-compact':''}`}>
  {canSelect
    ?<SearchableSelect className="ward-picker-select" label={label} value={selectedWardId} onChange={setWardId} options={options} placeholder="Search ward number or name…" searchPlaceholder="Search W-06, Savedi…" loading={loadingWards}/>
    :<SearchableSelect className="ward-picker-select" label={label} value={selectedWardId||fixedWardId||''} onChange={()=>{}} disabled options={locked} placeholder="Assigned ward…"/>}
 </div>;
}
