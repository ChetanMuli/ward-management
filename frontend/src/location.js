export const AHILYANAGAR={lat:19.0948,lng:74.7480,label:'Ahilyanagar'};

export function hasCoords(lat,lng){
 const la=Number(lat),lo=Number(lng);
 if(!Number.isFinite(la)||!Number.isFinite(lo)) return false;
 if(Math.abs(la)<0.0001&&Math.abs(lo)<0.0001) return false;
 return Math.abs(la)<=90&&Math.abs(lo)<=180;
}

export function isCityFallbackPin(lat,lng){
 return Math.abs(Number(lat)-AHILYANAGAR.lat)<0.000051 && Math.abs(Number(lng)-AHILYANAGAR.lng)<0.000051;
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

export function mapsEmbedUrl(lat,lng,zoom=18){
 const q=mapsQuery(lat,lng);
 return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&hl=en&output=embed`;
}

export function geoAppUrl(lat,lng){
 return `geo:${Number(lat)},${Number(lng)}?q=${encodeURIComponent(mapsQuery(lat,lng))}`;
}

export function directionsUrl(lat,lng){
 return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery(lat,lng))}&travelmode=driving`;
}

export function placeLine(parts){
 return parts.map(p=>String(p||'').trim()).filter(Boolean).join(' · ');
}

export function nativePlaceLine(row){
 if(!row) return '';
 return placeLine([
  row.nativeVillage,
  row.nativeTaluka&&`Tal. ${row.nativeTaluka}`,
  row.nativeDistrict&&`Dist. ${row.nativeDistrict}`,
  row.nativeState
 ]);
}

export const MAHARASHTRA_DISTRICTS=[
 'Ahilyanagar','Akola','Amravati','Beed','Bhandara','Buldhana','Chandrapur','Chhatrapati Sambhajinagar',
 'Dharashiv','Dhule','Gadchiroli','Gondia','Hingoli','Jalgaon','Jalna','Kolhapur','Latur','Mumbai City',
 'Mumbai Suburban','Nagpur','Nanded','Nandurbar','Nashik','Palghar','Parbhani','Pune','Raigad','Ratnagiri',
 'Sangli','Satara','Sindhudurg','Solapur','Thane','Wardha','Washim','Yavatmal'
];

export function isFlatHome(house){
 if(!house) return false;
 return !!(house.apartmentId||house.apartment?.id||String(house.houseType||'').toUpperCase()==='FLAT');
}

export function homePickOption(house){
 if(!house) return {value:'',label:'',hint:''};
 const colony=house.area?.name||'';
 if(isFlatHome(house)){
  return {
   value:house.id,
   label:`Flat ${house.houseNumber||'—'}`,
   hint:placeLine([house.apartment?.name,colony]),
   search:`${house.houseNumber||''} ${house.apartment?.name||''} ${colony} flat`
  };
 }
 return {
  value:house.id,
  label:`House ${house.houseNumber||'—'}`,
  hint:colony,
  search:`${house.houseNumber||''} ${colony} house`
 };
}

export function housePlace(house){
 if(!house) return '';
 const area=house.area||{};
 const ward=area.ward||{};
 return placeLine([
  house.apartment?.name,
  house.houseNumber&&(house.apartmentId||house.apartment?'Flat '+house.houseNumber:'House '+house.houseNumber),
  area.name,
  ward.wardNumber&&`Ward ${ward.wardNumber}`,
  house.landmark||area.landmark,
  house.city||area.city||ward.city
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

export function isOutOfCity(p){
 return String(p?.presenceStatus||'').toUpperCase()==='OUT_OF_CITY';
}
export function isVoterPerson(p){
 return String(p?.voterProfile?.status||p?.VoterProfile?.status||p?.status||'').toUpperCase()==='VOTER';
}
export const PEOPLE_PLACE_OPTIONS=[
 {value:'',label:'All people'},
 {value:'AT_HOME',label:'At this house'},
 {value:'OUT_OF_CITY',label:'Out of city'},
 {value:'OUT_VOTER',label:'Out of city voters'},
 {value:'VOTER',label:'Voters'}
];
export function presenceApiQuery(filter){
 if(filter==='OUT_VOTER') return {presenceStatus:'OUT_OF_CITY',voterStatus:'VOTER',status:'VOTER'};
 if(filter==='OUT_OF_CITY') return {presenceStatus:'OUT_OF_CITY'};
 if(filter==='AT_HOME') return {presenceStatus:'AT_HOME'};
 if(filter==='VOTER') return {voterStatus:'VOTER',status:'VOTER'};
 if(filter==='NON_VOTER') return {voterStatus:'NON_VOTER',status:'NON_VOTER'};
 return {};
}
