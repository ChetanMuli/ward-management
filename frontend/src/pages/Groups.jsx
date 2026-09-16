import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {api,getUser} from '../services/api';
import {ErrorBox,FaceAvatar,Loading,Modal,PageHeader,SearchableSelect,initialsOf} from '../components/Ui';
import {can,isMaster,isSubMaster,isNagarsevak,roleOf} from '../rbac';
import {useWardFilter} from '../wardFilter';

function isAllChat(g){return g?.type==='WARD'||g?.channel==='ALL'}
function groupTitle(g){
  if(isAllChat(g)) return g.ward ? `${g.ward.wardNumber}${g.ward.name?` · ${g.ward.name}`:''}` : (g.name||'All chat');
  if(g.type==='NAGARSEVAK') return g.nagarsevak?.name || g.name || 'Nagarsevak';
  return g.name;
}
function groupSubtitle(g){
  if(isAllChat(g)) return 'All chat · everyone in this ward';
  if(g.type==='NAGARSEVAK') return 'Nagarsevak group · ward members';
  return g.mode==='BROADCAST'?'Broadcast group':'Community group';
}
function lastPreview(m){
  if(!m) return 'No messages yet';
  if(m.messageType==='IMAGE') return '📷 Photo';
  if(m.messageType==='VIDEO') return '🎬 Video';
  if(m.messageType==='PDF') return '📄 PDF';
  return m.content||'Message';
}
function GroupFace({g}){
  if(isAllChat(g)) return <span className="wa-avatar community">W</span>;
  if(g.type==='NAGARSEVAK') return <FaceAvatar name={g.nagarsevak?.name||groupTitle(g)} photo={g.nagarsevak?.photo} className="wa-avatar nagar"/>;
  return <span className="wa-avatar">{initialsOf(groupTitle(g))}</span>;
}

function GroupPage(){
 const user=getUser();
 const master=isMaster(user),sub=isSubMaster(user),councillor=isNagarsevak(user),citizen=roleOf(user)==='CITIZEN';
 const {wards,selectedWardId:scopedWardId,canSelect}=useWardFilter();
 const canCreate=can('CREATE_CHAT_GROUP',user)||master;
 const [groups,setGroups]=useState(null),[active,setActive]=useState(null),[messages,setMessages]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[compose,setCompose]=useState(''),[pendingAttachment,setPendingAttachment]=useState(null),[chatOpen,setChatOpen]=useState(false);
 const saved=(()=>{try{return JSON.parse(sessionStorage.getItem('ward_groups_filters')||'{}')}catch{return {}}})();
 const [wardId,setWardId]=useState(saved.wardId||''),[nagarsevakId,setNagarsevakId]=useState(saved.nagarsevakId||''),[groupId,setGroupId]=useState(saved.groupId||''),[search,setSearch]=useState(saved.search||'');
 const [create,setCreate]=useState(false),[form,setForm]=useState({name:user?.wardId?'':'',wardId:user?.wardId||'',mode:'CHAT'});
 const fileRef=useRef(null); const bottom=useRef(null); const [searchParams]=useSearchParams();

 useEffect(()=>{
  const next = citizen || councillor ? (user?.wardId || user?.ward?.id || '') : (scopedWardId || (!canSelect ? (user?.wardId || user?.ward?.id || '') : ''));
  if(next) setWardId(String(next));
 },[scopedWardId,canSelect,citizen,councillor,user?.wardId,user?.ward?.id]);
 useEffect(()=>{try{sessionStorage.setItem('ward_groups_filters',JSON.stringify({wardId,nagarsevakId,groupId,search}))}catch{}},[wardId,nagarsevakId,groupId,search]);

 const loadGroups=(id=wardId)=>api.chatGroups(id?{wardId:id}:{}).then(r=>setGroups(r.data||[])).catch(e=>{setError(e.message||'Unable to load chats.');setGroups([])});
 useEffect(()=>{loadGroups(wardId)},[wardId]);

 const accessibleGroups=useMemo(()=>{
  if(!wardId) return [];
  const base=(groups||[]).filter(g=>String(g.wardId)===String(wardId));
  return base.filter(g=>{
    if(citizen) return isAllChat(g)||g.type==='NAGARSEVAK';
    if(!search.trim()) return true;
    const q=search.trim().toLowerCase();
    return [g.name,g.ward?.wardNumber,g.ward?.name,g.nagarsevak?.name].filter(Boolean).some(v=>String(v).toLowerCase().includes(q));
   }).sort((a,b)=>{
    const rank=g=>isAllChat(g)?0:g.type==='NAGARSEVAK'?1:2;
   return rank(a)-rank(b)||groupTitle(a).localeCompare(groupTitle(b));
  });
 },[groups,wardId,search,citizen]);

 const nagarsevaks=useMemo(()=>{
  const map=new Map();
  (groups||[]).filter(g=>g.type==='NAGARSEVAK'&&(!wardId||String(g.wardId)===String(wardId))).forEach(g=>{
   const n=g.nagarsevak;
   if(n?.id&&!map.has(n.id))map.set(n.id,{id:n.id,name:n.name,wardId:g.wardId,ward:g.ward});
  });
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
 },[groups,wardId]);

 const filteredGroups=useMemo(()=>{
  return accessibleGroups.filter(g=>{
   if(citizen) return true;
   if(councillor && g.type==='NAGARSEVAK' && String(g.nagarsevakUserId)!==String(user?.id)) return false;
   if(councillor && g.type==='CUSTOM') return false;
   if(nagarsevakId && !(g.type==='NAGARSEVAK'&&String(g.nagarsevakUserId)===String(nagarsevakId))) return false;
   if(groupId && String(g.id)!==String(groupId)) return false;
   return true;
  });
 },[accessibleGroups,nagarsevakId,groupId,citizen,councillor,user?.id]);

 const groupOptions=useMemo(()=>{
  const source=nagarsevakId
    ? accessibleGroups.filter(g=>g.type==='NAGARSEVAK'&&String(g.nagarsevakUserId)===String(nagarsevakId))
    : accessibleGroups;
  return source.map(g=>({value:String(g.id),label:`${groupTitle(g)} · ${isAllChat(g)?'All chat':g.type==='NAGARSEVAK'?'Nagarsevak group':'Group'}`}));
 },[accessibleGroups,nagarsevakId]);

 useEffect(()=>{
  if(nagarsevakId && !nagarsevaks.some(n=>String(n.id)===String(nagarsevakId))) setNagarsevakId('');
 },[nagarsevaks,nagarsevakId]);
 useEffect(()=>{
  if(groupId && !filteredGroups.some(g=>String(g.id)===String(groupId))) setGroupId('');
 },[filteredGroups,groupId]);
 useEffect(()=>{
  if(!filteredGroups.length){setActive(null);return;}
  const requested=searchParams.get('group');
  if(requested){
    const requestedGroup=filteredGroups.find(g=>String(g.id)===String(requested));
    if(requestedGroup){setActive(requestedGroup);setChatOpen(true);return;}
  }
  setActive(a=>a&&filteredGroups.some(g=>g.id===a.id)?filteredGroups.find(g=>g.id===a.id):filteredGroups[0]);
 },[filteredGroups,searchParams]);

 useEffect(()=>{
  if(!active){setMessages([]);return;}
  setPendingAttachment(null);
  let live=true;
  const load=()=>api.chatMessages(active.id,{limit:100}).then(r=>{if(live)setMessages(r.data||[])}).catch(e=>{if(live)setError(e.message)});
  load();
  api.markChatRead(active.id).catch(()=>{});
  const t=setInterval(load,5000);
  return()=>{live=false;clearInterval(t)};
 },[active?.id]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'})},[messages.length,active?.id]);

 async function createGroup(e){
  e.preventDefault();setBusy(true);setError('');
  try{await api.createChatGroup(form);setCreate(false);setForm({name:'',wardId:wardId||user?.wardId||'',mode:'CHAT'});await loadGroups();}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function send(){
  if(!active||(!compose.trim()&&!pendingAttachment))return;setBusy(true);setError('');
  try{
   if(pendingAttachment) await api.sendChatMessage(active.id,{messageType:pendingAttachment.type,imageMime:pendingAttachment.mime,imageData:pendingAttachment.data});
   if(compose.trim()) await api.sendChatMessage(active.id,{messageType:'TEXT',content:compose.trim()});
   setCompose('');setPendingAttachment(null);if(fileRef.current)fileRef.current.value='';
   const r=await api.chatMessages(active.id,{limit:100});setMessages(r.data||[]);await api.markChatRead(active.id).catch(()=>{});
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function chooseAttachment(file){
  if(!active||!file)return;setError('');
  const name=file.name||'';
  const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(name);
  const isVideo=file.type.startsWith('video/')||/\.(mp4|webm|mov)$/i.test(name);
  const isImage=file.type.startsWith('image/');
  if(!isImage&&!isPdf&&!isVideo){setError('Please select a photo, video (MP4/WEBM/MOV) or PDF.');if(fileRef.current)fileRef.current.value='';return;}
  if(file.size>12*1024*1024){setError('Attachment must be smaller than 12 MB.');if(fileRef.current)fileRef.current.value='';return;}
  try{
   if(isImage){
    const data=await readImage(file);
    setPendingAttachment({data,name:name||'Photo',type:'IMAGE',mime:'image/jpeg'});
   }else if(isVideo){
    let data=await readFileData(file);
    const mime=file.type==='video/quicktime'||/\.mov$/i.test(name)?'video/quicktime':file.type==='video/webm'?'video/webm':'video/mp4';
    if(typeof data==='string' && !/^data:video\//i.test(data)){
      const payload=String(data).split(',')[1]||'';
      data=`data:${mime};base64,${payload}`;
    }
    setPendingAttachment({data,name:name||'Video',type:'VIDEO',mime});
   }else{
    const data=await readFileData(file);
    setPendingAttachment({data,name:name||'Document.pdf',type:'PDF',mime:'application/pdf'});
   }
  }catch(e){setError('Could not read the selected attachment.');}
 }
 async function removeGroup(g){if(!window.confirm(`Archive “${g.name}”?`))return;setBusy(true);try{await api.deleteChatGroup(g.id);await loadGroups()}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function clearMyChat(){
  if(!active) return;
  if(!window.confirm('Clear this chat only on your account? Other people keep their messages. Chats older than 40 days are deleted for everyone.')) return;
  try{
   await api.clearChat(active.id);
   setMessages([]);
  }catch(e){setError(e.message)}
 }
 function openGroup(g){setActive(g);setChatOpen(true)}

 const wardOptions=wards.map(w=>({value:String(w.id),label:`${w.wardNumber}${w.name?` · ${w.name}`:''}`}));
 const nagOptions=nagarsevaks.map(n=>({value:String(n.id),label:`${n.name}${n.ward?.wardNumber?` · ${n.ward.wardNumber}`:''}`}));
 const canSend=active?.isMember&&((active.mode!=='BROADCAST')||active.canManage||master);

 if(!groups)return <div className="groups-page"><PageHeader kicker="Chat" title="All chat & Groups"/><Loading/></div>;
 if(error&&!groups.length)return <div className="groups-page"><PageHeader kicker="Chat" title="All chat & Groups"/><ErrorBox error={error}/><button type="button" className="small-btn" onClick={()=>{setError('');setGroups(null);loadGroups()}}>Try again</button></div>;
 return <div className={`groups-page ${chatOpen?'chat-open':''}`}>
  <PageHeader kicker="Chat" title="All chat & Groups" subtitle={citizen?(accessibleGroups.some(g=>g.type==='NAGARSEVAK')?'Ward All chat and your Nagarsevak group.':'All chat is available. Your Nagarsevak group will appear here when your ward representative is available.'):councillor?'Your ward All chat and your personal Nagarsevak group. Other Nagarsevak chats stay private to them.':'All chat includes everyone in the ward. Groups are Nagarsevak and custom chats.'} action={canCreate?<button className="primary-btn" onClick={()=>setCreate(true)}>+ Create group</button>:null}/>
  <ErrorBox error={error}/>

 {!citizen&&!councillor&&<><div className="group-filters">
   <SearchableSelect label="Ward" value={wardId} onChange={v=>{setWardId(v);setNagarsevakId('');setGroupId('')}} options={wardOptions} disabled={!canSelect} placeholder={canSelect?'Select ward first…':'Assigned ward'}/>
   <SearchableSelect label="Nagarsevak" value={nagarsevakId} onChange={v=>{setNagarsevakId(v);setGroupId('')}} options={[{value:'',label:'All Nagarsevaks'},...nagOptions]} placeholder="All Nagarsevaks"/>
   <SearchableSelect label="Group" value={groupId} onChange={setGroupId} options={[{value:'',label:nagarsevakId?'All groups for this Nagarsevak':'All groups in this ward'},...groupOptions]} disabled={!wardId} placeholder="All groups in this ward"/>
   <label className="group-filter-search">Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search group / Nagarsevak…"/></label>
  </div>
  {!wardId&&<div className="info-note">Select a Ward first to view its groups.</div>}</>}

  <div className="group-layout wa-chat">
   <aside className="group-list">
    {(() => {
      const allChats=filteredGroups.filter(isAllChat);
      const groupChats=filteredGroups.filter(g=>!isAllChat(g));
      const item=(g)=>{
        const last=messages.length&&active?.id===g.id?messages[messages.length-1]:null;
        return <button key={g.id} className={`group-item wa-item ${active?.id===g.id?'active':''}`} onClick={()=>openGroup(g)}>
         <GroupFace g={g}/>
         <span className="wa-item-copy">
          <strong>{groupTitle(g)}</strong>
          <small>{last?lastPreview(last):groupSubtitle(g)}</small>
         </span>
        </button>;
      };
      if(!wardId) return <div className="group-no-items">Select a ward to view its chats.</div>;
      if(!filteredGroups.length) return <div className="group-no-items">No chats in this ward yet.</div>;
      return <>
       <div className="group-section-title">All chat <span>{allChats.length}</span></div>
       {allChats.length?allChats.map(item):<div className="group-no-items">No All chat for this ward yet.</div>}
       <div className="group-section-title">Groups <span>{groupChats.length}</span></div>
       {groupChats.length?groupChats.map(item):<div className="group-no-items">No groups in this ward yet.</div>}
      </>;
    })()}
   </aside>
   <section className="group-chat-panel">
    {!active?<div className="group-empty">Select a chat to start messaging.</div>:<>
      <header className="group-chat-header">
       <button type="button" className="wa-back" onClick={()=>setChatOpen(false)} aria-label="Back to chats">‹</button>
       <GroupFace g={active}/>
       <div className="wa-head-copy"><span className="eyebrow">{isAllChat(active)?'ALL CHAT':active.type==='NAGARSEVAK'?'NAGARSEVAK GROUP':'GROUP'}</span><h2>{groupTitle(active)}</h2><p>{groupSubtitle(active)}{active.ward?.wardNumber?` · ${active.ward.wardNumber}`:''}</p></div>
       {(active.isMember||master||sub||active.type!=='CUSTOM')&&<button type="button" className="wa-clear-btn" onClick={clearMyChat}>Clear</button>}
       <div className="card-actions">{active.type==='CUSTOM'&&active.isMember&&<button className="small-btn" onClick={()=>api.leaveChatGroup(active.id).then(loadGroups).catch(e=>setError(e.message))}>Leave</button>}{active.type==='CUSTOM'&&!active.isMember&&<button className="small-btn" onClick={()=>api.joinChatGroup(active.id).then(loadGroups).catch(e=>setError(e.message))}>Join</button>}{active.canManage&&active.type==='CUSTOM'&&<button className="small-btn danger" onClick={()=>removeGroup(active)}>Archive</button>}</div>
      </header>
      <div className="group-messages wa-messages">{!active.isMember?<div className="group-empty">Join this group to view and send messages.</div>:!messages.length?<div className="group-empty">No messages yet. Say hello to the group.</div>:messages.map(m=><div key={m.id} className={`group-message ${m.senderUserId===user?.id?'mine':''}`}><div className="group-bubble"><strong>{m.senderUserId===user?.id?'You':m.sender?.name||'User'}</strong>{m.messageType==='IMAGE'?<ChatAttachment groupId={active.id} messageId={m.id} type="IMAGE"/>:m.messageType==='VIDEO'?<ChatAttachment groupId={active.id} messageId={m.id} type="VIDEO"/>:m.messageType==='PDF'?<ChatAttachment groupId={active.id} messageId={m.id} type="PDF"/>:<p>{m.content}</p>}<small>{m.createdAt?new Date(m.createdAt).toLocaleString('en-IN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}):''}</small></div></div>)}<div ref={bottom}/></div>
      {canSend&&<div className="group-composer wa-composer">{pendingAttachment&&<div className="pending-chat-image"><span>{pendingAttachment.type==='PDF'?'📄':pendingAttachment.type==='VIDEO'?'🎬':'📷'} {pendingAttachment.name}</span><button type="button" className="small-btn danger" onClick={()=>{setPendingAttachment(null);if(fileRef.current)fileRef.current.value=''}}>Remove</button></div>}<div className="wa-compose-row"><label className="chat-image-picker wa-attach" title="Attach photo, video or PDF">📎<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,application/pdf,.pdf,.mp4,.webm,.mov" onChange={e=>chooseAttachment(e.target.files?.[0])}/></label><textarea rows="1" value={compose} onChange={e=>setCompose(e.target.value)} placeholder="Type a message" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}/><button className="primary-btn wa-send" disabled={busy||(!compose.trim()&&!pendingAttachment)} onClick={send}>{busy?'…':'Send'}</button></div></div>}
    </>}
   </section>
  </div>

  {create&&<Modal title="Create group" onClose={()=>setCreate(false)}><form className="form-grid" onSubmit={createGroup}><label className="span-2">Group name<input required maxLength="160" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Ward Development Team"/></label>{(master||sub)&&<div className="span-2"><SearchableSelect label="Ward" value={form.wardId} onChange={v=>setForm({...form,wardId:v})} options={wardOptions} placeholder="Select ward"/></div>}<label className="span-2">Group type<select value={form.mode} onChange={e=>setForm({...form,mode:e.target.value})}><option value="CHAT">Group chat — everyone can send</option><option value="BROADCAST">Broadcast — only group owner/admin can send</option></select></label><div className="info-note span-2">Ward members are added automatically. All chat stays separate from these groups. Each Nagarsevak already has a personal group.</div><div className="modal-actions span-2"><button type="button" className="ghost-btn" onClick={()=>setCreate(false)}>Cancel</button><button className="primary-btn" disabled={busy}>{busy?'Creating…':'Create group'}</button></div></form></Modal>}
 </div>
}
function ChatAttachment({groupId,messageId,type}){
 const [src,setSrc]=useState('');
 const [failed,setFailed]=useState(false);
 useEffect(()=>{let live=true;let url='';api.chatAttachmentBlob(groupId,messageId).then(u=>{url=u;if(live)setSrc(u);else URL.revokeObjectURL(u)}).catch(()=>{if(live)setFailed(true)});return()=>{live=false;if(url)URL.revokeObjectURL(url)}},[groupId,messageId]);
 if(failed) return <div className="chat-image-error">{type==='PDF'?'PDF unavailable':type==='VIDEO'?'Video unavailable':'Image unavailable'}</div>;
 if(!src) return <div className="chat-image-loading">Loading {type==='PDF'?'PDF':type==='VIDEO'?'video':'image'}…</div>;
 if(type==='PDF') return <div className="chat-pdf-attachment"><a className="small-btn" href={src} target="_blank" rel="noreferrer">📄 Open PDF</a><iframe title="Shared PDF" src={src}/></div>;
 if(type==='VIDEO') return <video className="chat-video" src={src} controls playsInline preload="metadata"/>;
 return <img className="chat-image" src={src} alt="Shared"/>;
}
function readFileData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
function readImage(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const max=1280,s=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));const ctx=c.getContext('2d');if(!ctx)return reject(new Error('Image processing is unavailable.'));ctx.drawImage(img,0,0,c.width,c.height);let data=c.toDataURL('image/jpeg',.72);if(data.length>1450000)data=c.toDataURL('image/jpeg',.58);resolve(data);};img.onerror=reject;img.src=r.result};r.onerror=reject;r.readAsDataURL(file)})}
export default GroupPage;
