export function notificationTarget(n, audience='staff'){
 const citizen=audience==='citizen';
 const type=String(n?.type||'').toUpperCase();
 const raw=String(n?.actionUrl||'').trim();

 function rewrite(url){
  if(!url.startsWith('/')) return url;
  if(citizen){
   if(url==='/complaints'||url.startsWith('/complaints?')) return url.replace(/^\/complaints/,'/my-complaints');
   if(/^\/(deaths|birthdays|follow-up-18|nagarsevak-subscriptions|dashboard|staff|houses|families|people|voters)(\?|$)/.test(url)) return '/';
  }else if(url==='/my-complaints'||url.startsWith('/my-complaints?')){
   return url.replace(/^\/my-complaints/,'/complaints');
  }
  return url;
 }

 if(raw.startsWith('/')) return rewrite(raw);
 if(/COMPLAINT/.test(type)) return citizen?'/my-complaints':'/complaints';
 if(/SCHEME/.test(type)) return '/schemes';
 if(/WARD_UPDATE|WARD_EVENT/.test(type)) return '/ward-updates';
 if(/WARD_ACTIVATED|NAGARSEVAK_ACTIVATED/.test(type)) return citizen?'/':'/dashboard';
 if(/DEATH/.test(type)) return citizen?'/':'/deaths';
 if(/BIRTHDAY/.test(type)) return citizen?'/':'/birthdays';
 if(/18PLUS|FOLLOW/.test(type)) return citizen?'/':'/follow-up-18';
 if(/SUBSCRIPTION/.test(type)) return citizen?'/':'/nagarsevak-subscriptions';
 if(/CHAT|DIRECT_MESSAGE|^MESSAGE$/.test(type)) return '/groups';
 return citizen?'/':'/dashboard';
}
