const API_BASE_URL=(import.meta.env.VITE_API_BASE_URL||'/api').replace(/\/$/,'');
export const getToken=()=>localStorage.getItem('ward_token');
export const setSession=(token,user)=>{localStorage.setItem('ward_token',token);localStorage.setItem('ward_user',JSON.stringify(user));localStorage.setItem('ward_last_activity',String(Date.now()));localStorage.removeItem('ward_scope');};
export const clearSession=()=>{localStorage.removeItem('ward_token');localStorage.removeItem('ward_user');localStorage.removeItem('ward_scope');localStorage.removeItem('ward_last_activity');};
export const getUser=()=>{
 try{
  const raw=localStorage.getItem('ward_user'); const token=localStorage.getItem('ward_token');
  if(!raw||!token)return null;
  const part=token.split('.')[1]; if(!part)return null;
  const payload=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));
  if(Number(payload.exp)*1000<=Date.now()){clearSession();return null;}
  return JSON.parse(raw);
 }catch{return null}
};
export const getWardScope=()=>localStorage.getItem('ward_scope')||'';
export const setWardScope=id=>id?localStorage.setItem('ward_scope',id):localStorage.removeItem('ward_scope');

async function request(path,options={}){
 const headers={...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})};
 const token=getToken();
 const isPublicAuth=path.includes('/auth/');
 if(token&&!isPublicAuth) headers.Authorization=`Bearer ${token}`;
 let response;
 try {
   response=await fetch(`${API_BASE_URL}${path}`,{...options,headers});
 } catch (_) {
   throw new Error('Unable to reach the server. Please check your connection and try again.');
 }
 let payload=null; try{payload=await response.json()}catch{}
 if(response.status===401){if(token){clearSession();window.dispatchEvent(new CustomEvent('ward:session-expired'));throw new Error('Session expired. Please sign in again.');}throw new Error(payload?.message||payload?.error||'Invalid credentials');}
 if(!response.ok){
  const detail=Array.isArray(payload?.errors)
    ? payload.errors.map(x=>x.msg||x.message||x.path).filter(Boolean).join('; ')
    : (payload?.errors && typeof payload.errors==='object' ? Object.values(payload.errors).flat().join('; ') : '');
  const statusText=response.status===409?'This record already exists or conflicts with existing data.'
    : response.status===422?'Please check the highlighted information and try again.'
    : response.status===403?'You are not allowed to perform this action.'
    : response.status===404?'The requested record was not found.'
    : '';
  const message=[payload?.message||payload?.error||statusText||`Request failed (${response.status})`,detail].filter(Boolean).join(': ');
  throw new Error(message);
 }
 if(options.method && ['POST','PATCH','DELETE'].includes(String(options.method).toUpperCase()) && !path.includes('/auth/')){
   const message=payload?.message||actionSuccessMessage(path,String(options.method).toUpperCase());
   window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'success',message}}));
 }
 return payload;
}
function actionSuccessMessage(path,method){
 const parts=path.split('/').filter(Boolean);
 const names={wards:'ward',areas:'area',houses:'house',shops:'shop / office',apartments:'apartment',families:'family',persons:'citizen',voters:'voter status',complaints:'complaint',employees:'employee',corporators:'Nagarsevak',profile:'profile',notifications:'notification', 'maintenance':'maintenance', 'sub-admins':'Sub Master Admin', schemes:'scheme', deaths:'death record', 'ward-activations':'ward activation', 'nagarsevak-subscriptions':'Nagarsevak subscription'};
 const name=path.includes('/death')?'death record':(names[parts[2]]||names[parts[1]]||'record');
 if(method==='POST') return `${name.charAt(0).toUpperCase()+name.slice(1)} created successfully.`;
 if(method==='PATCH') return `${name.charAt(0).toUpperCase()+name.slice(1)} updated successfully.`;
 if(method==='DELETE') return `${name.charAt(0).toUpperCase()+name.slice(1)} deleted successfully.`;
 return 'Action completed successfully.';
}
const qs=p=>{const clean=Object.entries(p||{}).filter(([,v])=>v!==undefined&&v!==null&&v!=='');return clean.length?'?'+new URLSearchParams(clean):''};
const v2=(path,p={})=>request(`/v2${path}${qs(p)}`);
const v2Request=(path,options={})=>request(`/v2${path}`,options);

export const api={
 login:(identifier,password)=>v2Request('/auth/login',{method:'POST',body:JSON.stringify({identifier,password})}),
 forgotRequest:d=>v2Request('/auth/forgot/request',{method:'POST',body:JSON.stringify(d)}),
 forgotReset:d=>v2Request('/auth/forgot/reset',{method:'POST',body:JSON.stringify(d)}),
 registrationWards:()=>v2('/auth/registration-wards'),
 registerCitizen:d=>v2Request('/auth/register',{method:'POST',body:JSON.stringify(d)}),
 me:()=>v2('/me'),
 updateProfile:d=>v2Request('/profile',{method:'PATCH',body:JSON.stringify(d)}),
 changePassword:d=>v2Request('/profile/password',{method:'POST',body:JSON.stringify(d)}),
 permissions:()=>v2('/permissions'),
 subAdmins:()=>v2('/sub-admins'),
 createSubAdmin:d=>v2Request('/sub-admins',{method:'POST',body:JSON.stringify(d)}),
 updateSubAdmin:(id,d)=>v2Request(`/sub-admins/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
 resetUserPassword:(userId,d)=>v2Request(`/staff/password-reset/${userId}`,{method:'POST',body:JSON.stringify(d)}),
 schemes:(p={})=>v2('/schemes',p),
 createScheme:d=>v2Request('/schemes',{method:'POST',body:JSON.stringify(d)}),
 updateScheme:(id,d)=>v2Request(`/schemes/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
 deleteScheme:id=>v2Request(`/schemes/${id}`,{method:'DELETE'}),
 deathRecords:(p={})=>v2('/death-records',p),
 restoreDeath:id=>v2Request(`/death-records/${id}/restore`,{method:'POST'}),
 governmentVoterLists:(p={})=>v2('/government-voter-lists',p),
 electionData:()=>v2('/election-data'),
 governmentVoterList:id=>v2(`/government-voter-lists/${id}`),
 uploadGovernmentVoterList:(file,options={})=>{const token=getToken();return fetch(`${API_BASE_URL}/v2/government-voter-lists`,{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:(()=>{const f=new FormData();f.append('file',file);if(options.wardIds)f.append('wardIds',JSON.stringify(options.wardIds));if(options.assignmentMode)f.append('assignmentMode',options.assignmentMode);if(options.assignedNagarsevakIds)f.append('assignedNagarsevakIds',JSON.stringify(options.assignedNagarsevakIds));return f;})()}).then(async r=>{const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.message||`Upload failed (${r.status})`);window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'success',message:d?.message||'Government voter list uploaded successfully.'}}));return d;})},
 extractGovernmentVoterList:id=>v2Request(`/government-voter-lists/${id}/extract`,{method:'POST'}),
 deleteGovernmentVoterList:id=>v2Request(`/government-voter-lists/${id}`,{method:'DELETE'}),
 downloadGovernmentVoterList:async id=>{const token=getToken();const r=await fetch(`${API_BASE_URL}/v2/government-voter-lists/${id}/download`,{headers:token?{Authorization:`Bearer ${token}`}:{}});if(!r.ok)throw new Error((await r.json().catch(()=>null))?.message||`Download failed (${r.status})`);const blob=await r.blob();const cd=r.headers.get('content-disposition')||'';const match=cd.match(/filename=\"?([^\";]+)\"?/i);const filename=match?.[1]||'government-voter-list';const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);},
 createDeath:(personId,d)=>v2Request(`/persons/${personId}/death`,{method:'POST',body:JSON.stringify(d)}),
 wards:()=>v2('/wards'),
 createWard:d=>v2Request('/wards',{method:'POST',body:JSON.stringify(d)}),
 updateWard:(id,d)=>v2Request(`/wards/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
 deleteWard:id=>v2Request(`/wards/${id}`,{method:'DELETE'}),
 updateArea:(id,d)=>v2Request(`/areas/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
 deleteArea:id=>v2Request(`/areas/${id}`,{method:'DELETE'}),
 createArea:(wardId,d)=>v2Request(`/wards/${wardId}/areas`,{method:'POST',body:JSON.stringify(d)}),
 apartments:(p={})=>v2('/apartments',p),
 createApartment:d=>v2Request('/apartments',{method:'POST',body:JSON.stringify(d)}),
 updateApartment:(id,d)=>v2Request(`/apartments/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
 deleteApartment:id=>v2Request(`/apartments/${id}`,{method:'DELETE'}),
 dashboard:(p={})=>v2('/dashboard',p),
 houses:(p={})=>v2('/houses',p),
 house:id=>v2(`/houses/${id}`),
 createHouse:d=>v2Request('/houses',{method:'POST',body:JSON.stringify(d)}),
 updateHouse:(id,d)=>v2Request(`/houses/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
 deleteHouse:id=>v2Request(`/houses/${id}`,{method:'DELETE'}),
 shops:(p={})=>v2('/shops',p),
 shop:id=>v2(`/shops/${id}`),
 createShop:d=>v2Request('/shops',{method:'POST',body:JSON.stringify(d)}),
 updateShop:(id,d)=>v2Request(`/shops/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
 deleteShop:id=>v2Request(`/shops/${id}`,{method:'DELETE'}),
 verifyHouse:id=>request(`/houses/${id}/verify`,{method:'POST'}),
 families:(p={})=>v2('/families',p),
 family:id=>v2(`/families/${id}`),
 createFamily:d=>v2Request('/families',{method:'POST',body:JSON.stringify(d)}),
 updateFamily:(id,d)=>v2Request(`/families/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
 deleteFamily:id=>v2Request(`/families/${id}`,{method:'DELETE'}),
 persons:(p={})=>v2('/persons',p),
 person:id=>v2(`/persons/${id}`),
 createPerson:d=>v2Request('/persons',{method:'POST',body:JSON.stringify(d)}),
 updatePerson:(id,d)=>v2Request(`/persons/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
 deletePerson:id=>v2Request(`/persons/${id}`,{method:'DELETE'}),
 voters:(p={})=>v2('/voters',p),
 updateVoter:(id,d)=>v2Request(`/voters/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
 birthdays:(days=30,wardId,fromDays=0)=>v2('/birthdays',{days,wardId,fromDays}),
 upcoming18:(days=90,wardId,fromDays=0)=>v2('/18plus',{days,wardId,fromDays}),
 complaints:(p={})=>v2('/complaints',p),
 complaint:id=>v2(`/complaints/${id}`),
 createComplaint:d=>v2Request('/complaints',{method:'POST',body:JSON.stringify(d)}),
 assignComplaint:(id,d)=>v2Request(`/complaints/${id}/assign`,{method:'POST',body:JSON.stringify(d)}),
 updateComplaintStatus:(id,d)=>v2Request(`/complaints/${id}/status`,{method:'PATCH',body:JSON.stringify(d)}),
 notifications:()=>v2('/notifications'),
 stakeholders:()=>v2('/stakeholders'),
 createStakeholder:d=>v2Request('/stakeholders',{method:'POST',body:JSON.stringify(d)}),
 updateStakeholder:(id,d)=>v2Request(`/stakeholders/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
 deleteStakeholder:id=>v2Request(`/stakeholders/${id}`,{method:'DELETE'}),
 chatGroups:(params={})=>v2('/chat/groups',params),
 createChatGroup:d=>v2Request('/chat/groups',{method:'POST',body:JSON.stringify(d)}),
 deleteChatGroup:id=>v2Request(`/chat/groups/${id}`,{method:'DELETE'}),
 joinChatGroup:id=>v2Request(`/chat/groups/${id}/join`,{method:'POST'}),
 leaveChatGroup:id=>v2Request(`/chat/groups/${id}/leave`,{method:'POST'}),
 chatMessages:(id,params={})=>v2(`/chat/groups/${id}/messages`,params),
 sendChatMessage:(id,d)=>v2Request(`/chat/groups/${id}/messages`,{method:'POST',body:JSON.stringify(d)}),
 chatImageUrl:(groupId,messageId)=>`${API_BASE_URL}/v2/chat/groups/${groupId}/messages/${messageId}/image`,
 chatAttachmentBlob:async(groupId,messageId)=>{const token=getToken();const r=await fetch(`${API_BASE_URL}/v2/chat/groups/${groupId}/messages/${messageId}/image`,{headers:token?{Authorization:`Bearer ${token}`}:{}});if(!r.ok)throw new Error((await r.json().catch(()=>null))?.message||`Attachment unavailable (${r.status})`);return URL.createObjectURL(await r.blob());}, clearChat:(id)=>v2Request(`/chat/groups/${id}/clear`,{method:'PATCH'}),
 markChatRead:(id)=>v2Request(`/chat/groups/${id}/read`,{method:'PATCH'}),
 notificationRecipients:(audience,wardId)=>v2('/notifications/recipients',{audience,wardId}),
 markNotificationRead:id=>v2Request(`/notifications/${id}/read`,{method:'PATCH'}),
 markAllNotificationsRead:()=>v2Request('/notifications/read-all',{method:'PATCH'}),
clearNotifications:()=>v2Request('/notifications/clear',{method:'DELETE'}),
 deleteComplaint:id=>v2Request(`/complaints/${id}`,{method:'DELETE'}),
 auditLogs:(p={})=>request('/audit-logs'+qs(p)),
 clearAuditLogs:()=>v2Request('/maintenance/audit/clear',{method:'POST'}),
 recycleBin:(p={})=>v2('/recycle-bin',p),
 restore:(entity,id)=>v2Request(`/recycle-bin/${entity}/${id}/restore`,{method:'POST'}),
 clearRecycleBin:()=>v2Request('/maintenance/recycle/clear',{method:'POST'}),
 corporators:(p={})=>v2('/corporators',p),
 createCorporator:d=>v2Request('/corporators',{method:'POST',body:JSON.stringify(d)}),
 updateCorporator:(id,d)=>v2Request(`/corporators/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
 convertCorporator:(id,d)=>v2Request(`/corporators/${id}/convert-to-community`,{method:'POST',body:JSON.stringify(d)}),
 deleteCorporator:id=>v2Request(`/corporators/${id}`,{method:'DELETE'}),
 users:(p={})=>v2('/users',p),
updateUser:(id,d)=>v2Request(`/users/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
deleteUser:id=>v2Request(`/users/${id}`,{method:'DELETE'}),
wardTeam:(wardId)=>v2('/ward-team',wardId?{wardId}:{}),
myWard:()=>v2('/me/ward'),
wardActivations:()=>v2('/ward-activations'),
nagarsevakSubscriptions:(p={})=>v2('/nagarsevak-subscriptions',p),
setWardActivation:(wardId,d)=>v2Request(`/ward-activations/${wardId}/ward`,{method:'PATCH',body:JSON.stringify(d)}),
setNagarsevakPurchase:(wardId,d)=>v2Request(`/ward-activations/${wardId}/nagarsevak`,{method:'PATCH',body:JSON.stringify(d)}),
syncWardCommunity:(wardId)=>v2Request(`/ward-activations/${wardId}/sync`,{method:'POST'}),
wardUpdates:(p={})=>v2('/ward-updates',p),
createWardUpdate:d=>v2Request('/ward-updates',{method:'POST',body:JSON.stringify(d)}),
archiveWardUpdate:id=>v2Request(`/ward-updates/${id}/archive`,{method:'PATCH'}),
 employees:(p={})=>v2('/employees',p),
 createEmployee:d=>v2Request('/employees',{method:'POST',body:JSON.stringify(d)}),
 updateEmployee:(id,d)=>v2Request(`/employees/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
 updateEmployeePermissions:(id,d)=>v2Request(`/employees/${id}`,{method:'PATCH',body:JSON.stringify(d)}),
 deleteEmployee:id=>v2Request(`/employees/${id}`,{method:'DELETE'}),
 sendNotification:d=>v2Request('/notifications/send',{method:'POST',body:JSON.stringify(d)}),
 schemeRecipients:(schemeId)=>v2(`/notifications/scheme-recipients`,{schemeId}),
 sendSchemeNotification:d=>v2Request('/notifications/scheme',{method:'POST',body:JSON.stringify(d)}),
};
