import React,{useEffect,useRef,useState} from 'react';
import {centerOf,directionsUrl,fmtCoord,geoAppUrl,hasCoords,isCityFallbackPin,mapsEmbedUrl,mapsViewUrl,osmTileUrl} from '../location';

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

function isPhone(){
 if(typeof window==='undefined') return false;
 return window.matchMedia('(max-width:800px)').matches;
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
 const app=geoAppUrl(lat,lng);
 const embed=mapsEmbedUrl(lat,lng,18);
 const tile=osmTileUrl(lat,lng,17);
 const phone=isPhone();
 return (
  <div className="loc-preview-stack">
   <div className="loc-preview">
    {phone?(
     <iframe className="loc-thumb loc-gmaps" title={label} src={embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/>
    ):(
     <a className="loc-thumb" href={dir} target="_blank" rel="noopener noreferrer" aria-label={`Get directions to ${label}`}>
      {tile&&<img src={tile} alt="" />}
      <span className="loc-thumb-pin" aria-hidden="true"/>
     </a>
    )}
    <div className="loc-preview-meta">
     <strong>{label}</strong>
     <span className="loc-coords">{fmtCoord(lat)}, {fmtCoord(lng)}</span>
     <span className="loc-preview-hint">Opens Google Maps from your current location</span>
     <div className="loc-actions">
      <a className="loc-go" href={phone?app:dir} target="_blank" rel="noopener noreferrer">Get directions</a>
      <a className="loc-go loc-go-view" href={view} target="_blank" rel="noopener noreferrer">Open Google Maps</a>
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
 const [phone,setPhone]=useState(()=>isPhone());
 const centerKey=(centerFrom||[]).map(x=>`${x?.latitude||''},${x?.longitude||''}`).join('|');
 const pinned=hasCoords(value?.latitude,value?.longitude);
 const fallback=centerOf(...centerFrom);
 const embedSrc=mapsEmbedUrl(pinned?value.latitude:fallback.lat,pinned?value.longitude:fallback.lng,pinned?18:fallback.zoom||13);

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
  if(!phone && window.L) putMarker(window.L,Number(latitude),Number(longitude));
  if(source) setNote(source);
  return true;
 }

 useEffect(()=>{
  const mq=window.matchMedia('(max-width:800px)');
  const sync=()=>setPhone(mq.matches);
  sync();
  mq.addEventListener('change',sync);
  return ()=>mq.removeEventListener('change',sync);
 },[]);

 useEffect(()=>{
  if(phone){
   if(mapRef.current){mapRef.current.remove();mapRef.current=null;markerRef.current=null;}
   return undefined;
  }
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
    applyPin(e.latlng.lat,e.latlng.lng,'Map pin set. Address fields are left as you typed.');
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
  }).catch(()=>setNote('Map could not load. You can still use GPS.'));
  return ()=>{
   dead=true;
   if(ro) ro.disconnect();
   if(mapRef.current){mapRef.current.remove();mapRef.current=null;markerRef.current=null;}
  };
 },[phone]);

 useEffect(()=>{
  if(phone) return;
  const L=window.L;
  const map=mapRef.current;
  if(!L||!map) return;
  if(hasCoords(value?.latitude,value?.longitude)){
   putMarker(L,Number(value.latitude),Number(value.longitude));
   return;
  }
  const c=centerOf(...centerFrom);
  map.setView([c.lat,c.lng],c.zoom);
 },[value?.latitude,value?.longitude,centerKey,phone]);

 async function lookup(url){
  const r=await fetch(url,{headers:{Accept:'application/json'}});
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
   setNote(rows.length?'Select a result to set the pin only. Address stays as you typed.':'No match. Use GPS or tap the map.');
  }catch{
   setHits([]);
   setNote('Search is unavailable. Use GPS or tap the map.');
  }
 }

 function pickHit(h){
  if(!hasCoords(h.lat,h.lon)){
   setNote('That search result has no valid pin. Use GPS instead.');
   return;
  }
  applyPin(h.lat,h.lon,'Pin set from search. Address fields were not changed.');
  setHits([]);
  setQuery(h.display_name);
 }

 function useGps(){
  if(!navigator.geolocation) return setNote('GPS is not available on this device.');
  if(typeof window!=='undefined' && !window.isSecureContext) return setNote('GPS needs https. Open this page on the live site and try again.');
  setGpsBusy(true);
  setNote('Reading exact GPS at this door. Stay still for a few seconds…');
  const done=(pos,extra='')=>{
   setGpsBusy(false);
   const {latitude,longitude,accuracy}=pos.coords||{};
   if(!hasCoords(latitude,longitude) || (isCityFallbackPin(latitude,longitude) && Number(accuracy||9999)>250)){
    setNote('GPS could not lock the door pin. Stand outside, allow location, then tap Use GPS again.');
    return;
   }
   const meters=Math.round(Number(accuracy)||0);
   applyPin(latitude,longitude, meters>60
    ? `Location pin set, about ${meters} m off. Address was not filled. Stay at the door and tap Use GPS again.${extra}`
    : `Location pin set${meters?` (±${meters} m)`:''}. Address was not filled.${extra}`);
   if(!phone && window.L && mapRef.current){
    try{mapRef.current.invalidateSize();putMarker(window.L,Number(latitude),Number(longitude));}catch{/* map optional */}
   }
  };
  const fail=(code)=>{
   setGpsBusy(false);
   if(code===1) setNote('Allow location permission for this site, then tap Use GPS again.');
   else if(code===2) setNote('Turn on device location services, then tap Use GPS again.');
   else if(code===3) setNote('GPS timed out. Stand outside at the door with a clear sky and try again.');
   else setNote('Could not read GPS. Allow location and try again.');
  };
  navigator.geolocation.getCurrentPosition(
   pos=>done(pos),
   ()=>{
    navigator.geolocation.getCurrentPosition(
     pos=>done(pos,' (approximate)'),
     e=>fail(e?.code),
     {enableHighAccuracy:false,timeout:16000,maximumAge:20000}
    );
   },
   {enableHighAccuracy:true,timeout:20000,maximumAge:0}
  );
 }

 const openMapsHref=pinned?mapsViewUrl(value.latitude,value.longitude):'https://www.google.com/maps';

 return (
  <div className="loc-picker span-2">
   <div className="loc-picker-bar">
    {!phone&&<>
     <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search colony or landmark to set the pin…" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();search();}}}/>
     <button type="button" className="small-btn" onClick={search}>Search</button>
    </>}
    <button type="button" className="primary-btn loc-gps-btn" onClick={useGps} disabled={gpsBusy}>{gpsBusy?'Reading GPS…':'Use GPS at this home'}</button>
    {phone&&<a className="small-btn loc-gmaps-btn" href={openMapsHref} target="_blank" rel="noopener noreferrer">Open Google Maps</a>}
   </div>
   {!!hits.length&&<div className="loc-hits">{hits.map(h=><button type="button" key={h.place_id} onClick={()=>pickHit(h)}>{h.display_name}</button>)}</div>}
   {phone?(
    <iframe className="loc-map loc-gmaps" title="Google Maps" src={embedSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/>
   ):(
    <div className="loc-map" ref={boxRef}/>
   )}
   <div className="loc-coord-row">
    <label>Latitude
     <input inputMode="decimal" value={value?.latitude??''} onChange={e=>emit({latitude:e.target.value})} placeholder="Use GPS"/>
    </label>
    <label>Longitude
     <input inputMode="decimal" value={value?.longitude??''} onChange={e=>emit({longitude:e.target.value})} placeholder="Use GPS"/>
    </label>
   </div>
   {phone&&pinned&&<a className="loc-go loc-go-view" href={openMapsHref} target="_blank" rel="noopener noreferrer">View this pin in Google Maps</a>}
   <p className={`loc-hint ${pinned?'is-pinned':''}`}>
    {hint||(phone?'Stand at the door and tap Use GPS. Only the map pin is saved.':'Stand at the house door, tap Use GPS, or tap the map. Only the pin is saved.')}
    {note?` ${note}`:''}
    {pinned?` Saved pin: ${fmtCoord(value.latitude)}, ${fmtCoord(value.longitude)}`:''}
   </p>
  </div>
 );
}
