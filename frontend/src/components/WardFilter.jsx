import React from 'react';
import {useWardFilter} from '../wardFilter';
import {SearchableSelect} from './Ui';
import {formatWardLabel, formatWardNumber} from '../wardFormat';

export default function WardFilter({compact=true,label='Ward'}){
 const {wards,selectedWardId,setWardId,master,canSelect,fixedWardId,loadingWards}=useWardFilter();
 const options=[
  ...(canSelect?[{
    value:'',
    badge:'ALL',
    title:master?(loadingWards?'All wards':`All ${wards.length||0} wards`):'All assigned wards',
    hint:master?'City-wide view':'Every ward you can access',
    label:master?(loadingWards?'All wards':`All ${wards.length||0} wards`):'All assigned wards',
    search:`all wards city ${wards.map(w=>`${formatWardNumber(w.wardNumber)} ${w.name||''}`).join(' ')}`
  }]:[]),
  ...wards.map(w=>({
    value:String(w.id),
    badge:formatWardNumber(w.wardNumber),
    title:w.name||formatWardNumber(w.wardNumber),
    hint:w.name?`${formatWardNumber(w.wardNumber)} · Municipal ward`:formatWardNumber(w.wardNumber),
    label:formatWardLabel(w,''),
    search:`${formatWardNumber(w.wardNumber)} ${w.wardNumber||''} ${w.name||''}`
  }))
 ];
 const current=wards.find(w=>String(w.id)===String(selectedWardId||fixedWardId));
 const locked=current?[{
  value:String(current.id),
  badge:formatWardNumber(current.wardNumber),
  title:current.name||formatWardNumber(current.wardNumber),
  hint:'Assigned ward',
  label:formatWardLabel(current,'')
 }]:[{value:selectedWardId||fixedWardId||'',label:'Assigned ward'}];
 return <div className={`ward-filter ward-picker ${compact?'ward-filter-compact':''}`}>
  {canSelect
    ?<SearchableSelect className="ward-picker-select" compact={compact} label={label} value={selectedWardId} onChange={setWardId} options={options} placeholder="Search ward number or name…" searchPlaceholder="Search Ward 06, Savedi…" loading={loadingWards}/>
    :<SearchableSelect className="ward-picker-select" label={label} value={selectedWardId||fixedWardId||''} onChange={()=>{}} disabled options={locked} placeholder="Assigned ward…"/>}
 </div>;
}
