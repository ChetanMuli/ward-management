import { formatWardNumber } from './wardFormat';

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
  formatWardNumber(ward.wardNumber),
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
  formatWardNumber(w.wardNumber),
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

async function reverseAddress(lat, lng) {
  try {
    const ctrl = new AbortController();
    const tId = setTimeout(() => ctrl.abort(), 2500);
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept-Language': 'en' } }).catch(() => null);
    clearTimeout(tId);
    if (res && res.ok) {
      const data = await res.json().catch(() => ({}));
      const addr = data.address || {};
      return [
        addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood,
        addr.residential || addr.city_district || addr.quarter,
        addr.city || addr.town || addr.village,
        addr.postcode
      ].filter(Boolean).join(', ');
    }
  } catch (_) {}
  return '';
}

function gpsErrorMessage(err) {
  const code = err?.code;
  if (code === 1) return 'Allow location permission in the browser, then try again.';
  if (code === 2) return 'Turn on GPS / Location services, then try again.';
  if (code === 3) return 'GPS timed out. Stand outside in the open and try again.';
  return err?.message || 'Could not retrieve GPS location.';
}

export function getAccurateLocation(options = {}) {
  const phone = typeof window !== 'undefined' && window.matchMedia?.('(max-width:800px)')?.matches;
  const { timeout = phone ? 22000 : 16000, desiredAccuracy = phone ? 20 : 25 } = options;
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return reject(new Error('GPS location is not supported on this device.'));
    }
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return reject(new Error('GPS needs HTTPS. Open the site with https:// and try again.'));
    }

    let bestPos = null;
    let watchId = null;
    let timer = null;
    let resolved = false;

    const cleanup = () => {
      if (watchId !== null) {
        try { navigator.geolocation.clearWatch(watchId); } catch (_) {}
        watchId = null;
      }
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const finish = async (pos, source = 'gps') => {
      if (resolved || !pos?.coords) return;
      resolved = true;
      cleanup();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy || 0);
      const address = await reverseAddress(lat, lng);
      resolve({
        latitude: lat,
        longitude: lng,
        accuracy,
        source,
        address: address || '',
        formatted: address
          ? `${address} (GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)} ±${accuracy}m)`
          : `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)} (±${accuracy}m)`
      });
    };

    const failOrNetwork = (err) => {
      if (bestPos) return finish(bestPos);
      cleanup();
      reject(new Error(gpsErrorMessage(err)));
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        bestPos = pos;
        if ((pos.coords?.accuracy || 9999) <= desiredAccuracy) finish(pos);
      },
      () => {},
      { enableHighAccuracy: true, timeout: Math.min(8000, timeout), maximumAge: 0 }
    );

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const acc = pos.coords?.accuracy || 9999;
          if (!bestPos || acc < (bestPos.coords?.accuracy || 9999)) bestPos = pos;
          if (acc <= desiredAccuracy) finish(pos);
        },
        (err) => { failOrNetwork(err); },
        { enableHighAccuracy: true, timeout, maximumAge: 0 }
      );
    } catch (e) {
      failOrNetwork(e);
    }

    timer = setTimeout(() => {
      if (bestPos) finish(bestPos);
      else failOrNetwork({ code: 3 });
    }, timeout);
  });
}

