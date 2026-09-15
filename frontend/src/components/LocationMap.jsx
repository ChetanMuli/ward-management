import React,{useEffect,useRef,useState} from 'react';
import {centerOf,directionsUrl,fmtCoord,hasCoords} from '../location';

let leafletLoader;
function loadLeaflet(){
 if(window.L) return Promise.resolve(window.L);
 if(leafletLoader) return leafletLoader;
 leafletLoader=new Promise((resolve,reject)=>{
  if(!document.querySelector('link[data-leaflet]')){
   const css=document.createElement('link');
   css.rel='stylesheet';
   css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
   css.setAttribute('data-leaflet','1');
   document.head.appendChild(css);
  }
  const s=document.createElement('script');
  s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  s.onload=()=>resolve(window.L);
  s.onerror=()=>reject(new Error('Map library failed to load'));
  document.body.appendChild(s);
 });
 return leafletLoader;
}

function nominatimHeaders(){
 return {Accept:'application/json'};
}

function fromNominatim(address={},display=''){
 const a=address||{};
 const road=[a.house_number,a.road].filter(Boolean).join(' ');
 const locality=a.suburb||a.neighbourhood||a.quarter||'';
 return {
  city:a.city||a.town||a.village||a.county||'',
  district:a.state_district||a.county||a.state||'',
  pincode:a.postcode||'',
  landmark:a.suburb||a.neighbourhood||a.amenity||a.building||'',
  address:[road,locality,a.city||a.town||a.village].filter(Boolean).join(', ')||display||''
 };
}

function fillEmpty(cur,next){
 const out={};
 for(const [k,v] of Object.entries(next)){
  if(!v) continue;
  if(k!=='city'&&k!=='pincode'&&!(k in (cur||{}))) continue;
  if(!String(cur?.[k]||'').trim()) out[k]=v;
 }
 return out;
}

export function DirectionsLink({lat,lng,label='Directions',className=''}){
 if(!hasCoords(lat,lng)) return <span className="muted">Not saved</span>;
 return <a className={`loc-go ${className}`.trim()} href={directionsUrl(lat,lng)} target="_blank" rel="noreferrer">{label}</a>;
}

export function MapPreview({lat,lng,label='This home',children}){
 if(!hasCoords(lat,lng)) return (
  <div className="loc-empty-box">
   <p className="loc-empty">No exact location yet. When you are at this house, tap Update location and use GPS.</p>
   {children}
  </div>
 );
 return (
  <div className="loc-preview-stack">
   <a className="loc-go-card" href={directionsUrl(lat,lng)} target="_blank" rel="noreferrer">
    <strong>{label}</strong>
    <span>Tap to open maps and get driving directions</span>
    <em>{fmtCoord(lat)}, {fmtCoord(lng)}</em>
   </a>
   {children}
  </div>
 );
}

export default function LocationPicker({value,onChange,hint,centerFrom=[]}){
 const boxRef=useRef(null);
 const mapRef=useRef(null);
 const markerRef=useRef(null);
 const valueRef=useRef(value);
 valueRef.current=value;
 const [query,setQuery]=useState('');
 const [hits,setHits]=useState([]);
 const [note,setNote]=useState('');
 const centerKey=(centerFrom||[]).map(x=>`${x?.latitude||''},${x?.longitude||''}`).join('|');

 function emit(next){
  onChange({...valueRef.current,...next});
 }

 function putMarker(L,la,lo){
  const map=mapRef.current;
  if(!map) return;
  if(markerRef.current) markerRef.current.setLatLng([la,lo]);
  else markerRef.current=L.marker([la,lo]).addTo(map);
  map.setView([la,lo],18);
 }

 useEffect(()=>{
  let dead=false;
  let ro;
  loadLeaflet().then(L=>{
   if(dead||!boxRef.current||mapRef.current) return;
   const start=hasCoords(valueRef.current?.latitude,valueRef.current?.longitude)
    ? {lat:Number(valueRef.current.latitude),lng:Number(valueRef.current.longitude),zoom:18}
    : centerOf(...centerFrom);
   const map=L.map(boxRef.current,{scrollWheelZoom:true}).setView([start.lat,start.lng],start.zoom);
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,
    attribution:'&copy; OpenStreetMap'
   }).addTo(map);
   map.on('click',e=>{
    const latitude=e.latlng.lat.toFixed(7);
    const longitude=e.latlng.lng.toFixed(7);
    emit({latitude,longitude});
    putMarker(L,e.latlng.lat,e.latlng.lng);
    reverse(latitude,longitude);
   });
   mapRef.current=map;
   if(hasCoords(valueRef.current?.latitude,valueRef.current?.longitude)){
    putMarker(L,Number(valueRef.current.latitude),Number(valueRef.current.longitude));
   }
   const bump=()=>map.invalidateSize();
   setTimeout(bump,80);
   setTimeout(bump,320);
   setTimeout(bump,800);
   if(window.ResizeObserver&&boxRef.current){
    ro=new ResizeObserver(bump);
    ro.observe(boxRef.current);
   }
  }).catch(()=>setNote('Map could not load. You can still type coordinates.'));
  return ()=>{
   dead=true;
   if(ro) ro.disconnect();
   if(mapRef.current){mapRef.current.remove();mapRef.current=null;markerRef.current=null;}
  };
 },[]);

 useEffect(()=>{
  const L=window.L;
  const map=mapRef.current;
  if(!L||!map) return;
  if(hasCoords(value?.latitude,value?.longitude)){
   putMarker(L,Number(value.latitude),Number(value.longitude));
   return;
  }
  const c=centerOf(...centerFrom);
  map.setView([c.lat,c.lng],c.zoom);
 },[value?.latitude,value?.longitude,centerKey]);

 async function reverse(lat,lng){
  try{
   const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18&accept-language=en`,{headers:nominatimHeaders()});
   if(!r.ok) return;
   const j=await r.json();
   const cur=valueRef.current||{};
   emit({latitude:lat,longitude:lng,...fillEmpty(cur,fromNominatim(j.address,j.display_name))});
  }catch{/* ignore lookup failures */}
 }

 async function lookup(url){
  const r=await fetch(url,{headers:nominatimHeaders()});
  const rows=await r.json();
  return Array.isArray(rows)?rows:[];
 }

 async function search(){
  if(!query.trim()) return;
  setNote('Searching near this ward…');
  try{
   const c=centerOf(...centerFrom);
   const pad=0.08;
   const q=encodeURIComponent(query.trim());
   const base=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=in&addressdetails=1&accept-language=en&q=${q}`;
   let rows=await lookup(`${base}&viewbox=${c.lng-pad},${c.lat+pad},${c.lng+pad},${c.lat-pad}&bounded=1`);
   if(!rows.length) rows=await lookup(base);
   setHits(rows);
   setNote(rows.length?'Select a result, or tap the map for the exact door.':'No match. Try the colony name, or pin the map.');
  }catch{
   setHits([]);
   setNote('Search is unavailable. Pin the map or use GPS.');
  }
 }

 function pickHit(h){
  const latitude=Number(h.lat).toFixed(7);
  const longitude=Number(h.lon).toFixed(7);
  const cur=valueRef.current||{};
  emit({latitude,longitude,...fillEmpty(cur,fromNominatim(h.address,h.display_name))});
  if(window.L) putMarker(window.L,Number(h.lat),Number(h.lon));
  setHits([]);
  setQuery(h.display_name);
  setNote('Pin set from search. Tap the map if you need the exact house.');
 }

 function useGps(){
  if(!navigator.geolocation) return setNote('GPS is not available on this device.');
  setNote('Reading GPS…');
  navigator.geolocation.getCurrentPosition(pos=>{
   const latitude=pos.coords.latitude.toFixed(7);
   const longitude=pos.coords.longitude.toFixed(7);
   emit({latitude,longitude});
   if(window.L) putMarker(window.L,pos.coords.latitude,pos.coords.longitude);
   reverse(latitude,longitude);
   setNote('GPS pin set. Adjust on the map if the marker is not on the house.');
  },()=>setNote('Could not read GPS. Allow location and try again.'),{enableHighAccuracy:true,timeout:14000});
 }

 return (
  <div className="loc-picker span-2">
   <div className="loc-picker-bar">
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search colony, landmark or house address…" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();search();}}}/>
    <button type="button" className="small-btn" onClick={search}>Search</button>
    <button type="button" className="primary-btn" onClick={useGps}>Use GPS at this home</button>
   </div>
   {!!hits.length&&<div className="loc-hits">{hits.map(h=><button type="button" key={h.place_id} onClick={()=>pickHit(h)}>{h.display_name}</button>)}</div>}
   <div className="loc-map" ref={boxRef}/>
   <div className="loc-coord-row">
    <label>Latitude
     <input inputMode="decimal" value={value?.latitude??''} onChange={e=>emit({latitude:e.target.value})} placeholder="19.094800"/>
    </label>
    <label>Longitude
     <input inputMode="decimal" value={value?.longitude??''} onChange={e=>emit({longitude:e.target.value})} placeholder="74.748000"/>
    </label>
   </div>
   <p className="loc-hint">{hint||'Stand at the house door, tap Use GPS, or tap the map. Later, tap the location to get directions.'}{note?` ${note}`:''}{hasCoords(value?.latitude,value?.longitude)?` Pin: ${fmtCoord(value.latitude)}, ${fmtCoord(value.longitude)}`:''}</p>
  </div>
 );
}
