export const AHILYANAGAR={lat:19.0948,lng:74.7480,label:'Ahilyanagar'};

export function hasCoords(lat,lng){
 const la=Number(lat),lo=Number(lng);
 if(!Number.isFinite(la)||!Number.isFinite(lo)) return false;
 if(Math.abs(la)<0.0001&&Math.abs(lo)<0.0001) return false;
 return Math.abs(la)<=90&&Math.abs(lo)<=180;
}

export function fmtCoord(v){
 const n=Number(v);
 return Number.isFinite(n)?n.toFixed(6):'';
}

export function numOrEmpty(v){
 if(v===''||v==null) return '';
 const n=Number(v);
 return Number.isFinite(n)?String(n):'';
}

function cleanCoord(v){
 if(v===''||v==null) return null;
 const n=Number(v);
 if(!Number.isFinite(n)) return null;
 if(Math.abs(n)<0.0001) return null;
 return n;
}

export function geoPayload(form,keys=['city','district','pincode','landmark','latitude','longitude']){
 const out={};
 for(const k of keys){
  if(!(k in (form||{}))) continue;
  const v=form[k];
  if(k==='latitude'||k==='longitude') out[k]=cleanCoord(v);
  else out[k]=(v===''||v==null)?null:String(v).trim()||null;
 }
 if(('latitude' in out)||('longitude' in out)){
  if(!hasCoords(out.latitude,out.longitude)){
   if('latitude' in out) out.latitude=null;
   if('longitude' in out) out.longitude=null;
  }
 }
 return out;
}

export function osmEmbed(lat,lng,zoomPad=0.0024){
 const la=Number(lat),lo=Number(lng);
 return `https://www.openstreetmap.org/export/embed.html?bbox=${lo-zoomPad}%2C${la-zoomPad}%2C${lo+zoomPad}%2C${la+zoomPad}&layer=mapnik&marker=${la}%2C${lo}`;
}

export function osmOpenUrl(lat,lng){
 return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}

export function osmTileUrl(lat,lng,zoom=17){
 const la=Number(lat),lo=Number(lng);
 if(!hasCoords(la,lo)) return '';
 const n=2**zoom;
 const x=Math.floor((lo+180)/360*n);
 const latRad=la*Math.PI/180;
 const y=Math.floor((1-Math.log(Math.tan(latRad)+1/Math.cos(latRad))/Math.PI)/2*n);
 return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

function mapsQuery(lat,lng){
 return `${Number(lat).toFixed(7)},${Number(lng).toFixed(7)}`;
}

export function mapsViewUrl(lat,lng){
 return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery(lat,lng))}`;
}

export function directionsUrl(lat,lng){
 return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery(lat,lng))}&travelmode=driving`;
}

export function placeLine(parts){
 return parts.map(p=>String(p||'').trim()).filter(Boolean).join(' · ');
}

export function housePlace(house){
 if(!house) return '';
 const area=house.area||{};
 const ward=area.ward||{};
 return placeLine([
  house.houseNumber&&`House ${house.houseNumber}`,
  area.name,
  ward.wardNumber&&`Ward ${ward.wardNumber}`,
  house.landmark||area.landmark,
  house.city||area.city||ward.city,
  house.pincode||area.pincode||ward.pincode
 ]);
}

export function areaPlace(area,ward){
 const w=ward||area?.ward||{};
 return placeLine([
  area?.name,
  area?.landmark,
  area?.city||w.city,
  w.district,
  area?.pincode||w.pincode,
  w.wardNumber&&`Ward ${w.wardNumber}`
 ]);
}

export function centerOf(...items){
 for(const item of items){
  if(hasCoords(item?.latitude,item?.longitude)) return {lat:Number(item.latitude),lng:Number(item.longitude),zoom:17};
 }
 return {lat:AHILYANAGAR.lat,lng:AHILYANAGAR.lng,zoom:13};
}
