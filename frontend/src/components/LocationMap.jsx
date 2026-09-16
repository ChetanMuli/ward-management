import React,{useEffect,useRef,useState} from 'react';
import {centerOf,directionsUrl,fmtCoord,hasCoords,mapsViewUrl,osmTileUrl} from '../location';

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
 return (
  <a
   className={`loc-go ${className}`.trim()}
   href={directionsUrl(lat,lng)}
   target="_blank"
   rel="noopener noreferrer"
   title="Open driving directions in Google Maps"
   aria-label={`${label} in Google Maps`}
  >{label}</a>
 );
}

export function MapPreview({lat,lng,label='This home',children}){
 if(!hasCoords(lat,lng)) return (
  <div className="loc-empty-box">
   <p className="loc-empty">No exact door pin yet. When you are standing at this house, tap Update location and use GPS.</p>
   {children}
  </div>
 );
 const view=mapsViewUrl(lat,lng);
 const dir=directionsUrl(lat,lng);
 const tile=osmTileUrl(lat,lng,17);
 return (
  <div className="loc-preview-stack">
   <div className="loc-preview">
    <a className="loc-thumb" href={dir} target="_blank" rel="noopener noreferrer" aria-label={`Get directions to ${label}`}>
     {tile&&<img src={tile} alt="" />}
     <span className="loc-thumb-pin" aria-hidden="true"/>
    </a>
    <div className="loc-preview-meta">
     <strong>{label}</strong>
     <span className="loc-coords">{fmtCoord(lat)}, {fmtCoord(lng)}</span>
     <span className="loc-preview-hint">Opens Google Maps from your current location</span>
     <div className="loc-actions">
      <a className="loc-go" href={dir} target="_blank" rel="noopener noreferrer">Get directions</a>
      <a className="loc-go loc-go-view" href={view} target="_blank" rel="noopener noreferrer">Open map</a>
     </div>
    </div>
   </div>
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
 const [gpsBusy,setGpsBusy]=useState(false);
 const centerKey=(centerFrom||[]).map(x=>`${x?.latitude||''},${x?.longitude||''}`).join('|');
 const pinned=hasCoords(value?.latitude,value?.longitude);

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

 function applyPin(lat,lng,source=''){
  if(!hasCoords(lat,lng)){
   setNote('That pin is not valid. Stand at the house door and use GPS, or tap the map.');
   return false;
  }
  const latitude=Number(lat).toFixed(7);
  const longitude=Number(lng).toFixed(7);
  emit({latitude,longitude});
  if(window.L) putMarker(window.L,Number(latitude),Number(longitude));
  reverse(latitude,longitude);
  if(source) setNote(source);
  return true;
 }

 useEffect(()=>{
  let dead=false;
  let ro;
  loadLeaflet().then(L=>{
   if(dead||!boxRef.current||mapRef.current) return;
   const start=hasCoords(valueRef.current?.latitude,valueRef.current?.longitude)
    ? {lat:Number(valueRef.current.latitude),lng:Number(valueRef.current.longitude),zoom:18}
    : centerOf(...centerFrom);
   const map=L.map(boxRef.current,{scrollWheelZoom:true,tap:true,tapTolerance:18}).setView([start.lat,start.lng],start.zoom);
   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,
    attribution:'&copy; OpenStreetMap'
   }).addTo(map);
   map.on('click',e=>{
    if(!hasCoords(e.latlng.lat,e.latlng.lng)){
     setNote('That map point is not valid. Tap closer to the house.');
     return;
    }
    applyPin(e.latlng.lat,e.latlng.lng,'Map pin set. Drag or tap again if this is not the door.');
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
  }).catch(()=>setNote('Map could not load. You can still use GPS or type coordinates.'));
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
   setNote(rows.length?'Select a result, then tap the map for the exact door.':'No match. Try the colony name, or pin the map.');
  }catch{
   setHits([]);
   setNote('Search is unavailable. Pin the map or use GPS.');
  }
 }

 function pickHit(h){
  if(!hasCoords(h.lat,h.lon)){
   setNote('That search result has no valid pin. Tap the map instead.');
   return;
  }
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
  setGpsBusy(true);
  setNote('Reading GPS at this door…');
  navigator.geolocation.getCurrentPosition(pos=>{
   setGpsBusy(false);
   const {latitude,longitude,accuracy}=pos.coords;
   if(!hasCoords(latitude,longitude)){
    setNote('GPS returned an invalid pin. Move to open sky and try again.');
    return;
   }
   const meters=Math.round(Number(accuracy)||0);
   const quality=meters>80
    ? `Pin set, but GPS is about ${meters} m off. Stay at the door and tap Use GPS again, or tap the map.`
    : `GPS pin set${meters?` (±${meters} m)`:''}. Tap the map if the marker is not on the house.`;
   applyPin(latitude,longitude,quality);
  },err=>{
   setGpsBusy(false);
   if(err?.code===1) setNote('Allow location permission, then tap Use GPS again.');
   else if(err?.code===3) setNote('GPS timed out. Stand outside at the door and try again.');
   else setNote('Could not read GPS. Allow location and try again.');
  },{enableHighAccuracy:true,timeout:18000,maximumAge:0});
 }

 return (
  <div className="loc-picker span-2">
   <div className="loc-picker-bar">
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search colony, landmark or house address…" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();search();}}}/>
    <button type="button" className="small-btn" onClick={search}>Search</button>
    <button type="button" className="primary-btn loc-gps-btn" onClick={useGps} disabled={gpsBusy}>{gpsBusy?'Reading GPS…':'Use GPS at this home'}</button>
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
   <p className={`loc-hint ${pinned?'is-pinned':''}`}>
    {hint||'Stand at the house door, tap Use GPS, or tap the map. Later, tap Directions to drive here.'}
    {note?` ${note}`:''}
    {pinned?` Saved pin: ${fmtCoord(value.latitude)}, ${fmtCoord(value.longitude)}`:''}
   </p>
  </div>
 );
}
