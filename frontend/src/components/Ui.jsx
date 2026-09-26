import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

export function scrollMainToTop(){
 const jump=()=>{
  window.scrollTo(0,0);
  if(document.documentElement) document.documentElement.scrollTop=0;
  if(document.body) document.body.scrollTop=0;
  document.querySelectorAll('.content,.user-main,.user-page-main').forEach(el=>{el.scrollTop=0});
 };
 jump();
 requestAnimationFrame(jump);
}

export function PaginationBar({page=1,pages=1,total=0,limit=10,onPage,onLimit,limits=[10,25,50,100]}){
 if(!total) return null;
 const start=(page-1)*limit+1;
 const end=Math.min(page*limit,total);
 const window=[];
 const last=Math.max(1,pages);
 const from=Math.max(1,page-2);
 const to=Math.min(last,page+2);
 if(from>1) window.push(1);
 if(from>2) window.push('…');
 for(let n=from;n<=to;n+=1) window.push(n);
 if(to<last-1) window.push('…');
 if(to<last) window.push(last);
 const go=n=>{onPage(Math.max(1,Math.min(last,n)));scrollMainToTop();};
 return (
  <div className="global-pagination" aria-label="Pagination">
   <div className="pagination-meta">
    <div className="pagination-info">Showing {start}–{end} of {total}</div>
    <label className="pagination-size">Rows per page
     <select value={limit} onChange={e=>{onLimit(Number(e.target.value));onPage(1);scrollMainToTop();}}>
      {limits.map(n=><option key={n} value={n}>{n}</option>)}
     </select>
    </label>
   </div>
   <nav className="pagination-nav pagination-controls" aria-label="Pages">
    <button type="button" className="small-btn pag-edge pag-first" disabled={page<=1} onClick={()=>go(1)}>First</button>
    <button type="button" className="small-btn pag-step" disabled={page<=1} onClick={()=>go(page-1)}>Previous</button>
    {window.map((n,i)=>n==='…'?<span key={`gap-${i}`} className="pagination-gap">…</span>:<button type="button" key={n} className={`small-btn pagination-page ${n===page?'is-current':''}`} onClick={()=>go(n)}>{n}</button>)}
    <button type="button" className="small-btn pag-step" disabled={page>=last} onClick={()=>go(page+1)}>Next</button>
    <button type="button" className="small-btn pag-edge pag-last" disabled={page>=last} onClick={()=>go(last)}>Last</button>
   </nav>
  </div>
 );
}

export function PageHeader({kicker,title,subtitle,action,children}){
 return <div className="page-header"><div className="page-header-title-box">{kicker&&<span className="page-kicker">{kicker}</span>}<h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action||children}</div>;
}
export function StatCard({label,value,hint,tone='',onClick}){
 const Tag=onClick?'button':'div';
 return (
  <Tag type={onClick?'button':undefined} className={`stat-card ${tone} ${onClick?'stat-card-link':''}`} onClick={onClick}>
   <span>{label}</span>
   <strong>{value??'—'}</strong>
   {hint&&<small>{hint}</small>}
  </Tag>
 );
}
export function Empty({children='No records found.'}){return <div className="empty empty-pro"><div className="empty-mark" aria-hidden="true">◇</div><p>{children}</p></div>}
export function Loading({label='Loading…'}){return <div className="loading loading-pro" role="status"><span className="spinner"/><span>{label}</span></div>}
export function ErrorBox({error}){
 useEffect(()=>{
  if(!error) return;
  window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:error}}));
 },[error]);
 return null;
}
export function SuccessBox({message,onClose}){if(!message)return null;return <div className="success-toast" role="status"><div><strong>Success</strong><div>{message}</div></div><button onClick={onClose} aria-label="Close">×</button></div>}
export function StatusPill({children}){const k=String(children||'').toLowerCase().replaceAll('_','-');return <span className={`pill pill-${k}`}>{String(children||'—').replaceAll('_',' ')}</span>}
export function Modal({title,onClose,children,wide=false,layer=1,footer}){
 useEffect(()=>{document.body.classList.add('modal-open');return()=>document.body.classList.remove('modal-open')},[]);
 const z=Number(layer)>1?280:210;
 const node=<div className={`modal-backdrop ${layer>1?'modal-backdrop-stack':''}`} ref={el=>{if(el)el.style.setProperty('z-index',String(z),'important')}} onPointerDown={onClose}><div className={`modal ${wide?'modal-wide':''} ${footer?'modal-with-footer':''}`} onPointerDown={e=>e.stopPropagation()}><div className="modal-header"><div><h2>{title}</h2></div><button type="button" className="icon-btn" onClick={onClose}>×</button></div>{footer?(<><div className="modal-body">{children}</div><div className="modal-footer">{footer}</div></>):children}</div></div>;
 return typeof document!=='undefined'?createPortal(node,document.body):node;
}

function optionSearchText(o){return [o.search,o.label,o.title,o.hint,o.badge].filter(Boolean).join(' ').toLowerCase()}
export function SearchableSelect({label, value, onChange, options=[], placeholder='Search or select…', searchPlaceholder='Type to search…', disabled=false, required=false, className='', loading=false}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[menuStyle,setMenuStyle]=useState({});
 const controlRef=useRef(null), menuRef=useRef(null), searchRef=useRef(null), optionsRef=useRef(null);
 const position=()=>{
  const wrap=controlRef.current;if(!wrap)return;
  const el=wrap.querySelector('.searchable-control')||wrap;
  const r=el.getBoundingClientRect();
  const mobile=window.innerWidth<=800;
  const viewportH=window.innerHeight;
  const width=Math.min(r.width,window.innerWidth-16);
  const left=Math.max(8,Math.min(r.left,window.innerWidth-width-8));
  const pad=10;
  const spaceBelow=Math.max(0,viewportH-r.bottom-pad);
  const spaceAbove=Math.max(0,r.top-pad);
  const desired=Math.min(mobile?Math.floor(viewportH*0.58):380, mobile?480:380);
  let above=spaceBelow<Math.min(220,desired)&&spaceAbove>spaceBelow;
  let available=above?spaceAbove:spaceBelow;
  if(available<200){above=false;available=viewportH-(pad*2);}
  const maxHeight=Math.max(180,Math.min(desired,available));
  let top=above?r.top-maxHeight-6:r.bottom+6;
  if(top<pad)top=pad;
  if(top+maxHeight>viewportH-pad)top=Math.max(pad,viewportH-pad-maxHeight);
  setMenuStyle({position:'fixed',left,top,width,height:maxHeight,maxHeight,overflow:'hidden',display:'flex',flexDirection:'column',boxSizing:'border-box',touchAction:'auto','--picker-w':`${width}px`});
 };
 const selected=options.find(o=>String(o.value)===String(value));
 const filtered=options.filter(o=>optionSearchText(o).includes(query.trim().toLowerCase()));
 const choose=v=>{onChange(v);setQuery('');setOpen(false)};
 useLayoutEffect(()=>{if(!open)return;position();requestAnimationFrame(()=>{if(window.innerWidth>800) searchRef.current?.focus(); if(optionsRef.current) optionsRef.current.scrollTop=0});const s=()=>position();window.addEventListener('scroll',s,true);window.addEventListener('resize',s);return()=>{window.removeEventListener('scroll',s,true);window.removeEventListener('resize',s)}},[open,filtered.length]);
 useEffect(()=>{
  if(!open)return;
  const close=e=>{if(controlRef.current&&!controlRef.current.contains(e.target)&&menuRef.current&&!menuRef.current.contains(e.target)){setOpen(false);setQuery('')}};
  const esc=e=>{if(e.key==='Escape'){setOpen(false);setQuery('')}};
  const closeOverlay=()=>{setOpen(false);setQuery('')};
  document.addEventListener('pointerdown',close,true);document.addEventListener('keydown',esc);window.addEventListener('ward:close-overlays',closeOverlay);
  return()=>{document.removeEventListener('pointerdown',close,true);document.removeEventListener('keydown',esc);window.removeEventListener('ward:close-overlays',closeOverlay)};
 },[open]);
 const menu=open&&!disabled&&typeof document!=='undefined'?createPortal(
  <div ref={menuRef} className="searchable-menu searchable-menu-portal" style={menuStyle} role="listbox" onPointerDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}>
   <div className="searchable-menu-search"><span>⌕</span><input ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder={searchPlaceholder} autoComplete="off"/></div>
   <div ref={optionsRef} className="searchable-options">
    {loading?<div className="searchable-empty">Loading options…</div>:filtered.length?filtered.map(o=><button type="button" key={String(o.value)} className={`searchable-option ${o.badge?'has-badge':''} ${String(o.value)===String(value)?'selected':''}`} onClick={()=>choose(o.value)}>{o.badge&&<span className="option-badge">{o.badge}</span>}<span className="option-copy"><strong>{o.title||o.label}</strong>{o.hint&&<small>{o.hint}</small>}</span>{String(o.value)===String(value)&&<span className="option-check">✓</span>}</button>):<div className="searchable-empty">No matches found</div>}
   </div>
   {!loading&&<div className="searchable-menu-meta">{query?`${filtered.length} match${filtered.length===1?'':'es'}`:`${options.length} option${options.length===1?'':'s'}`}</div>}
  </div>,document.body):null;
 return <div className={`searchable-select ${className}`} ref={controlRef}>
  {label&&<div className="section-label">{label}{required?' *':''}</div>}
  <div className={`searchable-control ${open?'is-open':''} ${disabled?'is-disabled':''}`}>
   <button type="button" className="searchable-display" disabled={disabled} onClick={()=>{setOpen(v=>!v);if(open)setQuery('')}} aria-expanded={open} aria-haspopup="listbox">
    <span className={selected?'has-value':'placeholder'}>{loading&&!selected?'Loading…':(selected?.label||placeholder)}</span></button><button type="button" className={`searchable-chevron ${open?'open':''}`} onClick={()=>{if(!disabled){setOpen(v=>!v);if(open)setQuery('')}}} aria-label={open?'Close options':'Open options'}>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5"/></svg>
    </button>
    {required&&<input className="searchable-required" type="text" required value={value||''} onChange={()=>{}} tabIndex={-1} aria-hidden="true"/>}
    {value&&!disabled&&<button type="button" className="searchable-clear" onClick={()=>choose('')} aria-label="Clear selection">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8"/></svg>
    </button>}
  </div>{menu}
 </div>;
}
export function Field({label,children,className='',hint}){return <label className={className}>{label}{children}{hint?<small className="field-hint">{hint}</small>:null}</label>}
export function fmtDate(v){if(!v)return '—';return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(v))}
export function fmtDateTime(v){if(!v)return '—';return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}
export function Toolbar({children,className=''}){return <div className={`toolbar filter-toolbar ${className}`.trim()}>{children}</div>}
export function EmptyState(){return <div className="empty-state">Nothing to show for these filters.</div>}

export function SearchableMultiSelect({label,value=[],onChange,options=[],placeholder='Search and select…',className=''}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[menuStyle,setMenuStyle]=useState({});
 const controlRef=useRef(null),menuRef=useRef(null),searchRef=useRef(null),optionsRef=useRef(null);
 const selectedValues=Array.isArray(value)?value:[];
 const selected=options.filter(o=>selectedValues.map(String).includes(String(o.value)));
 const filtered=options.filter(o=>String(o.label||'').toLowerCase().includes(query.trim().toLowerCase()));
 const position=()=>{
  const wrap=controlRef.current;if(!wrap)return;
  const el=wrap.querySelector('.searchable-control')||wrap;
  const r=el.getBoundingClientRect();
  const mobile=window.innerWidth<=800;
  const viewportH=window.innerHeight;
  const width=Math.min(r.width,window.innerWidth-16);
  const left=Math.max(8,Math.min(r.left,window.innerWidth-width-8));
  const pad=10;
  const spaceBelow=Math.max(0,viewportH-r.bottom-pad);
  const spaceAbove=Math.max(0,r.top-pad);
  const desired=Math.min(mobile?Math.floor(viewportH*0.58):380,mobile?480:380);
  let above=spaceBelow<Math.min(220,desired)&&spaceAbove>spaceBelow;
  let available=above?spaceAbove:spaceBelow;
  if(available<200){above=false;available=viewportH-(pad*2);}
  const maxHeight=Math.max(180,Math.min(desired,available));
  let top=above?r.top-maxHeight-6:r.bottom+6;
  if(top<pad)top=pad;
  if(top+maxHeight>viewportH-pad)top=Math.max(pad,viewportH-pad-maxHeight);
  setMenuStyle({position:'fixed',left,top,width,height:maxHeight,maxHeight,overflow:'hidden',display:'flex',flexDirection:'column',boxSizing:'border-box',touchAction:'auto','--picker-w':`${width}px`});
 };
 useLayoutEffect(()=>{if(!open)return;position();requestAnimationFrame(()=>{if(window.innerWidth>800) searchRef.current?.focus(); if(optionsRef.current) optionsRef.current.scrollTop=0});const s=()=>position();window.addEventListener('scroll',s,true);window.addEventListener('resize',s);return()=>{window.removeEventListener('scroll',s,true);window.removeEventListener('resize',s)}},[open,filtered.length]);
 useEffect(()=>{if(!open)return;const close=e=>{if(!controlRef.current?.contains(e.target)&&!menuRef.current?.contains(e.target)){setOpen(false);setQuery('')}};const esc=e=>{if(e.key==='Escape'){setOpen(false);setQuery('')}};const closeOverlay=()=>{setOpen(false);setQuery('')};document.addEventListener('pointerdown',close,true);document.addEventListener('mousedown',close,true);document.addEventListener('keydown',esc);window.addEventListener('ward:close-overlays',closeOverlay);return()=>{document.removeEventListener('pointerdown',close,true);document.removeEventListener('mousedown',close,true);document.removeEventListener('keydown',esc);window.removeEventListener('ward:close-overlays',closeOverlay)}},[open]);
 const toggle=id=>{const key=String(id);const next=selectedValues.map(String).includes(key)?selectedValues.filter(x=>String(x)!==key):[...selectedValues,id];onChange(next)};
 const selectAll=()=>onChange(filtered.map(o=>o.value));
 const clearAll=()=>onChange([]);
 const menu=open?createPortal(<div ref={menuRef} className="searchable-menu searchable-menu-portal multi-select-menu" style={menuStyle} onPointerDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}><div className="searchable-menu-search"><span>⌕</span><input ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Type to search…" autoComplete="off"/></div><div className="multi-select-actions"><button type="button" className="small-btn" onClick={selectAll}>Select all shown</button><button type="button" className="small-btn" onClick={clearAll}>Clear all</button></div><div ref={optionsRef} className="searchable-options">{filtered.length?filtered.map(o=>{const checked=selectedValues.map(String).includes(String(o.value));return <button type="button" key={o.value} className={`searchable-option ${checked?'selected':''}`} onClick={()=>toggle(o.value)}><span>{o.label}</span><span>{checked?'✓':''}</span></button>}):<div className="searchable-empty">No matches found</div>}</div></div>,document.body):null;
 return <div className={`searchable-select ${className}`} ref={controlRef}><div className="section-label">{label}</div><div className={`searchable-control ${open?'is-open':''}`}><button type="button" className="searchable-display" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-haspopup="listbox"><span className={selected.length?'has-value':'placeholder'}>{selected.length?`${selected.length} selected`:placeholder}</span></button><button type="button" className={`searchable-chevron ${open?'open':''}`} onClick={()=>setOpen(v=>!v)} aria-label={open?'Close options':'Open options'}>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5"/></svg>
    </button>{selected.length>0&&<button type="button" className="searchable-clear" onClick={()=>onChange([])} aria-label="Clear selection">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8"/></svg>
    </button>}</div>{menu}</div>;
}

export function isMobileOrTouch(){
 if(typeof window==='undefined') return false;
 return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
   (window.innerWidth <= 800 && ('ontouchstart' in window || navigator.maxTouchPoints > 0));
}

export async function compressImageFile(file, maxDimension=1280, quality=0.72){
 if(!file) return null;
 if(!file.type || !file.type.startsWith('image/')){
  window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:'Please select a valid image file.'}}));
  return null;
 }
 if(file.size > 15 * 1024 * 1024){
  window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:'Image must be smaller than 15 MB.'}}));
  return null;
 }
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>{
   const img=new Image();
   img.onload=()=>{
    try{
     const origW=img.naturalWidth||img.width||1280;
     const origH=img.naturalHeight||img.height||720;
     const scale=Math.min(1, maxDimension / Math.max(origW, origH));
     const w=Math.max(1, Math.round(origW * scale));
     const h=Math.max(1, Math.round(origH * scale));
     const canvas=document.createElement('canvas');
     canvas.width=w;
     canvas.height=h;
     const ctx=canvas.getContext('2d');
     if(!ctx) return reject(new Error('Canvas unavailable'));
     ctx.drawImage(img,0,0,w,h);
     let out=canvas.toDataURL('image/jpeg',quality);
     if(out.length > 1400000) out=canvas.toDataURL('image/jpeg', Math.max(0.5, quality - 0.18));
     resolve(out);
    }catch(err){reject(err);}
   };
   img.onerror=()=>reject(new Error('Image decode failed'));
   img.src=String(reader.result||'');
  };
  reader.onerror=()=>reject(new Error('File read failed'));
  reader.readAsDataURL(file);
 });
}

function CameraModal({open,onClose,onCapture,cameraLabel='Camera'}){
 const videoRef=useRef(null),canvasRef=useRef(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[facing,setFacing]=useState('environment');
 const [hasStream,setHasStream]=useState(false);

 useEffect(()=>{
  if(!open)return;
  let activeStream=null;setError('');setBusy(true);setHasStream(false);

  async function initCamera(){
   if(!navigator.mediaDevices?.getUserMedia){
    setError('Live webcam preview is not supported on this browser or requires HTTPS. Use device camera or file below:');
    setBusy(false);return;
   }
   try{
    let stream;
    try{
     stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720}},audio:false});
    }catch(_){
     stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    }
    activeStream=stream;
    if(videoRef.current){
     videoRef.current.srcObject=stream;
     await videoRef.current.play().catch(()=>{});
     setHasStream(true);
    }
    setBusy(false);
   }catch(err){
    const denied=err?.name==='NotAllowedError'||err?.name==='PermissionDeniedError';
    const notFound=err?.name==='NotFoundError'||err?.name==='DevicesNotFoundError';
    setError(denied?'Camera access was denied. Allow camera permissions or use device camera below.':(notFound?'No camera detected on this system. You can choose a photo from your device below:':(err?.message||'Unable to start camera.')));
    setBusy(false);
   }
  }
  initCamera();
  return()=>{
   if(activeStream?.getTracks)activeStream.getTracks().forEach(t=>t.stop());
   if(videoRef.current)videoRef.current.srcObject=null;
   setHasStream(false);
  };
 },[open,facing]);

 const snap=()=>{
  const video=videoRef.current;if(!video||video.readyState<2)return;
  const canvas=canvasRef.current||document.createElement('canvas');canvasRef.current=canvas;
  const max=1280,scale=Math.min(1,max/Math.max(video.videoWidth||1280,video.videoHeight||720));
  canvas.width=Math.max(1,Math.round((video.videoWidth||1280)*scale));canvas.height=Math.max(1,Math.round((video.videoHeight||720)*scale));
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  let data=canvas.toDataURL('image/jpeg',.72);if(data.length>1450000)data=canvas.toDataURL('image/jpeg',.58);
  onCapture(data);onClose();
 };

 const handleFileCapture=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
   const data=await compressImageFile(file,1280,.72);
   if(data){onCapture(data);onClose();}
  }catch(err){
   window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:err?.message||'Could not read image'}}));
  }
  e.target.value='';
 };

 if(!open)return null;

 return <div className="camera-modal-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className="camera-modal" onPointerDown={e=>e.stopPropagation()}>
   <div className="camera-modal-head">
    <strong>{cameraLabel}</strong>
    <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
   </div>
   {error ? (
    <div className="camera-error" style={{padding:'24px 16px',textAlign:'center'}}>
     <p style={{margin:'0 0 16px',fontSize:'13px',color:'#b42318',lineHeight:'1.5'}}>{error}</p>
     <div style={{display:'flex',gap:'10px',justifyContent:'center',flexWrap:'wrap'}}>
      <label className="primary-btn" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer',minHeight:'42px',padding:'8px 16px'}}>
       <input type="file" accept="image/*" capture="environment" className="camera-hidden-input" onChange={handleFileCapture}/>
       Take photo with device camera
      </label>
      <label className="ghost-btn" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer',minHeight:'42px',padding:'8px 16px'}}>
       <input type="file" accept="image/*" className="camera-hidden-input" onChange={handleFileCapture}/>
       Choose from device
      </label>
     </div>
    </div>
   ) : (
    <div className="camera-preview-wrap">
     <video ref={videoRef} playsInline muted autoPlay/>
     <span className="camera-frame"/>
    </div>
   )}
   <div className="camera-actions" style={{display:'flex',gap:'8px',justifyContent:'space-between',flexWrap:'wrap',alignItems:'center',marginTop:'12px'}}>
    <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
     {!error && hasStream && (
      <button type="button" className="small-btn" onClick={()=>setFacing(f=>f==='environment'?'user':'environment')}>
       Switch camera
      </button>
     )}
     <label className="small-btn" style={{cursor:'pointer',display:'inline-flex',alignItems:'center'}}>
      <input type="file" accept="image/*" capture="environment" className="camera-hidden-input" onChange={handleFileCapture}/>
      Device camera
     </label>
     <label className="small-btn" style={{cursor:'pointer',display:'inline-flex',alignItems:'center'}}>
      <input type="file" accept="image/*" className="camera-hidden-input" onChange={handleFileCapture}/>
      Choose file
     </label>
    </div>
    <div style={{display:'flex',gap:'8px'}}>
     <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
     {!error && (
      <button type="button" className="primary-btn" disabled={busy || !hasStream} onClick={snap}>
       {busy ? 'Starting…' : 'Capture photo'}
      </button>
     )}
    </div>
   </div>
  </div>
 </div>;
}

export function ImageField({label,value,onChange,optional=true,cameraLabel='Take photo'}){
 const [cameraOpen,setCameraOpen]=useState(false);
 const isMobile=isMobileOrTouch();

 const handleFile=async e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  try{
   const data=await compressImageFile(file,1280,.72);
   if(data) onChange(data);
  }catch(err){
   window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:err?.message||'Could not process image.'}}));
  }
  e.target.value='';
 };

 const openDesktopCamera=()=>{
  setCameraOpen(true);
 };

 return (
  <div className="image-field">
   <div className="section-label">{label}{optional?' (optional)':''}</div>
   <div className="image-input-actions">
    {isMobile ? (
     <label className="upload-btn camera-upload">
      <input type="file" accept="image/*" capture="environment" className="camera-hidden-input" onChange={handleFile}/>
      <span>{cameraLabel}</span>
     </label>
    ) : (
     <button type="button" className="upload-btn camera-upload" onClick={openDesktopCamera}>
      <span>{cameraLabel}</span>
     </button>
    )}
    <label className="upload-btn secondary-upload">
     <input type="file" accept="image/*" className="camera-hidden-input" onChange={handleFile}/>
     <span>Choose from device</span>
    </label>
   </div>
   {value && (
    <div className="image-preview">
     <img src={value} alt={`${label} preview`}/>
     <button type="button" className="small-btn danger" onClick={()=>onChange('')}>Remove</button>
    </div>
   )}
   <CameraModal open={cameraOpen} onClose={()=>setCameraOpen(false)} onCapture={data=>onChange(data)} cameraLabel={cameraLabel}/>
  </div>
 );
}

export function MultiImageField({label,values=[],onChange,optional=true,max=5,cameraLabel='Open camera'}){
 const [cameraOpen,setCameraOpen]=useState(false);
 const isMobile=isMobileOrTouch();
 const photos=(values||[]).filter(Boolean).slice(0,max);

 const addFiles=async files=>{
  const list=Array.from(files||[]).filter(f=>f&&f.type&&f.type.startsWith('image/'));
  if(!list.length)return;
  const next=[...photos];
  for(const file of list){
   if(next.length>=max)break;
   try{
    const data=await compressImageFile(file,1100,.65);
    if(data) next.push(data);
   }catch(_){}
  }
  onChange(next);
 };

 const handleNativeCapture=async e=>{
  if(photos.length>=max){
   window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:`Maximum ${max} photos reached.`}}));
   return;
  }
  await addFiles(e.target.files);
  e.target.value='';
 };

 const handleDesktopCameraClick=()=>{
  if(photos.length>=max){
   window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:`Maximum ${max} photos reached.`}}));
   return;
  }
  setCameraOpen(true);
 };

 const isMax=photos.length>=max;

 return (
  <div className="image-field">
   <div className="section-label">
    {label}{optional?' (optional)':''}{photos.length?` · ${photos.length}/${max}`:''}
   </div>
   <div className="image-input-actions">
    {isMobile ? (
     <label className={`upload-btn camera-upload ${isMax?'is-disabled':''}`}>
      <input type="file" accept="image/*" capture="environment" disabled={isMax} className="camera-hidden-input" onChange={handleNativeCapture}/>
      <span>{cameraLabel}</span>
     </label>
    ) : (
     <button type="button" className={`upload-btn camera-upload ${isMax?'is-disabled':''}`} disabled={isMax} onClick={handleDesktopCameraClick}>
      <span>{cameraLabel}</span>
     </button>
    )}
    <label className={`upload-btn secondary-upload ${isMax?'is-disabled':''}`}>
     <input type="file" accept="image/*" multiple disabled={isMax} className="camera-hidden-input" onChange={handleNativeCapture}/>
     <span>Choose from device</span>
    </label>
   </div>
   {photos.length>0&&(
    <div className="image-preview-grid">
     {photos.map((src,i)=>(
      <div className="image-preview" key={`${i}-${src.slice(-12)}`}>
       <img src={src} alt={`${label} ${i+1}`}/>
       <button type="button" className="small-btn danger" onClick={()=>onChange(photos.filter((_,idx)=>idx!==i))}>Remove</button>
      </div>
     ))}
    </div>
   )}
   {photos.length<max&&(
    <p className="muted" style={{marginTop:8}}>Add photos of the problem (up to {max} photos).</p>
   )}
   <CameraModal open={cameraOpen} onClose={()=>setCameraOpen(false)} onCapture={data=>{if(photos.length<max)onChange([...photos,data]);}} cameraLabel={cameraLabel}/>
  </div>
 );
}

export function initialsOf(name='User'){return String(name||'User').split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'U'}
export function isDataImage(value){return typeof value==='string' && /^data:image\//i.test(value.trim())}
export function isUsablePhoto(value){
 const src=typeof value==='string'?value.trim():'';
 if(!src||src==='null'||src==='undefined') return false;
 return /^(data:image\/[a-z0-9.+-]+;base64,|blob:|https?:\/\/|\/(?!\/))/i.test(src);
}
export function FaceAvatar({name='User',photo,className=''}){
 const src=typeof photo==='string'?photo.trim():'';
 const [broken,setBroken]=useState(false);
 useEffect(()=>{setBroken(false)},[src]);
 if(isUsablePhoto(src)&&!broken){
  return <img className={`user-avatar user-avatar-photo notranslate ${className}`.trim()} src={src} alt={name||'Profile'} translate="no" onError={()=>setBroken(true)}/>;
 }
 return <div className={`user-avatar user-avatar-fallback notranslate ${className}`.trim()} aria-hidden="true" translate="no"><span>{initialsOf(name)}</span></div>;
}
export function CirclePhotoField({label='Profile photo',name,value,onChange,optional=true}){
 const fileRef=useRef(null),dragRef=useRef(null),natRef=useRef({w:1,h:1}),posRef=useRef({x:0,y:0}),zoomRef=useRef(1);
 const STAGE=Math.min(280, typeof window==='undefined'?280:Math.max(220, Math.min(280, window.innerWidth-56)));
 const [open,setOpen]=useState(false),[src,setSrc]=useState(''),[zoom,setZoom]=useState(1),[pos,setPos]=useState({x:0,y:0}),[nat,setNat]=useState({w:1,h:1}),[ready,setReady]=useState(false);
 const cover=STAGE/Math.min(nat.w||1,nat.h||1);
 const scale=cover*zoom;
 const dw=(nat.w||1)*scale, dh=(nat.h||1)*scale;
 function clamp(next, w=nat.w, h=nat.h, z=zoom){
  const c=STAGE/Math.min(w||1,h||1);
  const s=c*z;
  const maxX=Math.max(0,((w||1)*s-STAGE)/2);
  const maxY=Math.max(0,((h||1)*s-STAGE)/2);
  return {x:Math.min(maxX,Math.max(-maxX,next.x||0)),y:Math.min(maxY,Math.max(-maxY,next.y||0))};
 }
 function openCrop(data){
  setSrc(data);setZoom(1);zoomRef.current=1;setPos({x:0,y:0});posRef.current={x:0,y:0};setNat({w:1,h:1});setReady(false);setOpen(true);
 }
 function readFile(file){
  if(!file)return;
  if(!file.type.startsWith('image/')){window.dispatchEvent(new CustomEvent('ward:toast',{detail:{type:'error',message:'Please select an image file.'}}));return;}
  const reader=new FileReader();
  reader.onload=()=>openCrop(String(reader.result||''));
  reader.readAsDataURL(file);
 }
 useEffect(()=>{posRef.current=pos;},[pos]);
 useEffect(()=>{zoomRef.current=zoom;setPos(p=>clamp(p,nat.w,nat.h,zoom));},[zoom,nat.w,nat.h]);
 useEffect(()=>{
  if(!open)return;
  const move=e=>{
   if(!dragRef.current)return;
   e.preventDefault();
   const next=clamp({x:e.clientX-dragRef.current.x,y:e.clientY-dragRef.current.y},natRef.current.w,natRef.current.h,zoomRef.current);
   posRef.current=next;setPos(next);
  };
  const up=()=>{dragRef.current=null};
  window.addEventListener('pointermove',move,{passive:false});
  window.addEventListener('pointerup',up);
  window.addEventListener('pointercancel',up);
  return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up)};
 },[open]);
 function onPointerDown(e){
  e.preventDefault();e.stopPropagation();
  dragRef.current={x:e.clientX-posRef.current.x,y:e.clientY-posRef.current.y};
 }
 function apply(){
  if(!src||!ready)return;
  const img=new Image();
  img.onload=()=>{
   const w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
   const size=400,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
   const ctx=canvas.getContext('2d');if(!ctx)return;
   const z=zoomRef.current, p=posRef.current;
   const s=(STAGE/Math.min(w,h))*z;
   const left=(STAGE-w*s)/2+p.x;
   const top=(STAGE-h*s)/2+p.y;
   const srcSize=STAGE/s;
   ctx.fillStyle='#0b1624';ctx.fillRect(0,0,size,size);
   ctx.beginPath();ctx.arc(size/2,size/2,size/2,0,Math.PI*2);ctx.closePath();ctx.clip();
   ctx.drawImage(img,-left/s,-top/s,srcSize,srcSize,0,0,size,size);
   let data=canvas.toDataURL('image/jpeg',.86);
   if(data.length>1450000) data=canvas.toDataURL('image/jpeg',.68);
   onChange(data);setOpen(false);setSrc('');
  };
  img.src=src;
 }
 const node=open?(
  <div className="photo-crop-backdrop" onPointerDown={()=>{setOpen(false);setSrc('')}}>
   <div className="photo-crop-modal" onPointerDown={e=>e.stopPropagation()}>
    <div className="modal-header"><div><h2>Adjust profile photo</h2><span>Drag to centre the face, then zoom until it fills the circle.</span></div><button type="button" className="icon-btn" onClick={()=>{setOpen(false);setSrc('')}}>×</button></div>
    <div className="photo-crop-stage" style={{width:STAGE,height:STAGE}} onPointerDown={onPointerDown}>
     {src&&<img src={src} alt="" draggable="false" onLoad={e=>{const w=e.currentTarget.naturalWidth||1,h=e.currentTarget.naturalHeight||1;natRef.current={w,h};setNat({w,h});setReady(true);setPos(p=>clamp(p,w,h,zoomRef.current));}} style={{width:dw,height:dh,left:(STAGE-dw)/2+pos.x,top:(STAGE-dh)/2+pos.y}}/>}
     <span className="photo-crop-ring" aria-hidden="true"/>
    </div>
    <label className="photo-crop-zoom">Zoom<input type="range" min="1" max="3" step="0.02" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
    <div className="modal-actions">
     <button type="button" className="ghost-btn" onClick={()=>{setOpen(false);setSrc('')}}>Cancel</button>
     <button type="button" className="primary-btn" disabled={!ready} onClick={apply}>{ready?'Use this photo':'Loading…'}</button>
    </div>
   </div>
  </div>
 ):null;
 return (
  <div className="circle-photo-field">
   <div className="section-label">{label}{optional?' (optional)':''}</div>
   <div className="circle-photo-row">
    <FaceAvatar name={name||'User'} photo={value} className="staff-face-lg"/>
    <div className="circle-photo-actions">
     <label className="small-btn" style={{cursor:'pointer',display:'inline-flex',alignItems:'center'}}>
      <input type="file" accept="image/*" capture="user" className="camera-hidden-input" onChange={e=>{readFile(e.target.files?.[0]);e.target.value=''}}/>
      Take photo
     </label>
     <button type="button" className="small-btn" onClick={()=>fileRef.current?.click()}>{value?'Change photo':'Choose photo'}</button>
     {value?<button type="button" className="small-btn" onClick={()=>openCrop(value)}>Adjust photo</button>:null}
     {value?<button type="button" className="small-btn danger" onClick={()=>onChange('')}>Remove</button>:null}
     <p className="muted">Crop the face into the circle. This photo is used on the ward dashboard and birthday card.</p>
    </div>
    <input ref={fileRef} className="image-file-input-native" type="file" accept="image/*" onChange={e=>{readFile(e.target.files?.[0]);e.target.value=''}}/>
   </div>
   {typeof document!=='undefined'&&node?createPortal(node,document.body):node}
  </div>
 );
}
export function ProfileAvatar({name='User',size='md',className=''}){
 return (
  <span className={`user-profile-avatar ${size==='lg'?'large':size==='sm'?'small':''} ${className}`.trim()} role="img" aria-label={name}>
   <svg className="user-profile-logo" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="24" cy="24" r="24" fill="#0c1422"/>
    <circle cx="24" cy="18.2" r="7.4" fill="#e8eef6"/>
    <path d="M10.2 40.8c2.2-8.2 7.9-12.6 13.8-12.6s11.6 4.4 13.8 12.6" fill="#e8eef6"/>
   </svg>
  </span>
 );
}

export function RowMenu({items=[], menuOnly=false}){
 const [open,setOpen]=useState(false);
 const ref=useRef(null);
 const toggleRef=useRef(null);
 const popRef=useRef(null);
 const visible=(items||[]).filter(Boolean);
 const rest=menuOnly?visible:visible.slice(1);
 function place(){
  const btn=toggleRef.current;
  const pop=popRef.current;
  if(!btn||!pop)return;
  const r=btn.getBoundingClientRect();
  const vw=window.innerWidth;
  const vh=window.innerHeight;
  const pad=10;
  if(r.bottom<pad||r.top>vh-pad) return;
  const mobile=vw<=800;
  const width=mobile?Math.min(vw-pad*2,Math.max(r.width,220)):Math.min(220,Math.max(188,vw-24));
  let left=mobile?Math.min(Math.max(pad,r.left),vw-width-pad):r.right-width;
  if(left<pad)left=pad;
  if(left+width>vw-pad) left=Math.max(pad,vw-width-pad);
  const itemH=mobile?44:36;
  const estH=Math.min(vh*0.6,12+rest.length*itemH);
  const spaceBelow=vh-r.bottom-pad;
  const spaceAbove=r.top-pad;
  const openUp=spaceBelow<Math.min(estH,140)&&spaceAbove>spaceBelow;
  const maxH=Math.max(96,Math.min(estH,openUp?spaceAbove-6:spaceBelow-6));
  const top=openUp?Math.max(pad,r.top-maxH-6):Math.min(r.bottom+6,Math.max(pad,vh-maxH-pad));
  const set=(k,v)=>pop.style.setProperty(k,v,'important');
  set('position','fixed');
  set('top',`${Math.round(top)}px`);
  set('left',`${Math.round(left)}px`);
  set('width',`${Math.round(width)}px`);
  set('max-width',`${Math.round(width)}px`);
  set('max-height',`${Math.round(maxH)}px`);
  set('bottom','auto');
  set('right','auto');
  set('z-index','120');
 }
 useLayoutEffect(()=>{if(open)place();},[open,rest.length]);
 useEffect(()=>{
  if(!open)return;
  const close=e=>{if(ref.current&&!ref.current.contains(e.target)&&!e.target.closest('.row-menu-pop'))setOpen(false)};
  const onMove=()=>{
   if(onMove.raf) cancelAnimationFrame(onMove.raf);
   onMove.raf=requestAnimationFrame(()=>{
    const btn=toggleRef.current;
    if(!btn)return;
    const r=btn.getBoundingClientRect();
    if(r.bottom<8||r.top>window.innerHeight-8){setOpen(false);return;}
    place();
   });
  };
  document.addEventListener('pointerdown',close,true);
  window.addEventListener('resize',onMove);
  window.addEventListener('scroll',onMove,true);
  document.addEventListener('scroll',onMove,true);
  document.documentElement.addEventListener('scroll',onMove);
  window.visualViewport?.addEventListener('resize',onMove);
  window.visualViewport?.addEventListener('scroll',onMove);
  return()=>{
   if(onMove.raf) cancelAnimationFrame(onMove.raf);
   document.removeEventListener('pointerdown',close,true);
   window.removeEventListener('resize',onMove);
   window.removeEventListener('scroll',onMove,true);
   document.removeEventListener('scroll',onMove,true);
   document.documentElement.removeEventListener('scroll',onMove);
   window.visualViewport?.removeEventListener('resize',onMove);
   window.visualViewport?.removeEventListener('scroll',onMove);
  };
 },[open,rest.length]);
 if(!visible.length)return null;
 const [primary]=visible;
 return (
  <div className={`row-menu ${open?'is-open':''} ${menuOnly?'is-menu-only':''}`} ref={ref}>
   {!menuOnly && primary ? (
     <button type="button" className={primary.danger?'small-btn danger':(primary.className||'small-btn view-btn')} onClick={primary.onClick}>{primary.label}</button>
   ) : null}
   {(menuOnly || rest.length>0)&&(
    <>
     <button type="button" ref={toggleRef} className="small-btn row-menu-toggle" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>More</button>
     {open&&createPortal(
      <>
       <div className="row-menu-scrim" onPointerDown={()=>setOpen(false)}/>
       <div className="row-menu-pop" role="menu" ref={node=>{popRef.current=node;if(node)place();}}>
        {rest.map((item,i)=>(
         item.node
          ? <div key={item.label||i} className={`row-menu-node ${item.danger?'danger':''}`}>{item.node}</div>
          : <button type="button" key={item.label||i} className={item.danger?'danger':''} onClick={()=>{setOpen(false);item.onClick?.()}}>{item.label}</button>
        ))}
       </div>
      </>
     ,document.body)}
    </>
   )}
  </div>
 );
}
