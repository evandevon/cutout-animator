'use strict';
/* Cutout Animator
   A recording is stored as movement data plus audio clips rather than as video:
     scene.take = { dur, tracks:{itemId:[[t,x,y,s,r,flip,tilt],…]}, voices:[{assetId,t}], fx:[{t,ref}] }
   That keeps a finished scene editable, keeps toolbars out of the picture, works on iPads
   (which can't capture the screen from a web page), and lets export render every frame exactly. */
(() => {
const $=id=>document.getElementById(id);
const W=1280,H=720,MX=150,MY=90,VW=W+MX*2,VH=H+MY*2;
const uid=()=>Math.random().toString(36).slice(2,10);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const fmt=t=>{ t=Math.max(0,t); return Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'); };

const PRESETS={
  sky:{name:'Sky',stops:['#6ec3f0','#d8f1fb'],ground:'#7fc06a'},
  sea:{name:'Under the sea',stops:['#1b8fb5','#063a5c'],ground:'#d9c58c'},
  night:{name:'Night',stops:['#0d1440','#32407e'],ground:'#1a2a24',stars:true},
  sunset:{name:'Sunset',stops:['#f2795a','#fcd37a'],ground:'#5a3b4f'},
  grass:{name:'Field',stops:['#bfe7f7','#eff9fd'],ground:'#63a84d',high:true},
  paper:{name:'Paper',stops:['#fbf6e8','#f2e9d2']},
};

let project,undoStack=[],redoStack=[],curId,selId=null,mode='setup',tab='cast';
const imgs=new Map(),hitMaps=new Map();
const blankScene=n=>({id:uid(),name:'Scene '+n,backdrop:{type:'preset',id:'sky'},ambience:null,music:null,items:[],take:null});
const newProject=()=>({version:1,name:'My animation',assets:{},cast:[],backdrops:[],pads:[],scenes:[blankScene(1)],mix:{voice:1,ambience:.5,music:.4,fx:1},wobble:true});
const cur=()=>project.scenes.find(s=>s.id===curId)||project.scenes[0];
const sel=()=>cur().items.find(i=>i.id===selId)||null;

function toast(m,ms=3200){ const t=$('toast'); t.textContent=m; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true,ms); }
function ask(title,msg,buttons,input){ return new Promise(res=>{ $('askTitle').textContent=title; $('askMsg').textContent=msg||''; const inp=$('askInput'); inp.hidden=input===undefined; inp.value=input||'';
  const box=$('askBtns'); box.innerHTML=''; for(const [label,val,cls] of buttons){ const b=document.createElement('button'); b.textContent=label; if(cls) b.className=cls; b.onclick=()=>{ $('askDlg').close(); res(val==='__input'?inp.value:val); }; box.append(b); }
  $('askDlg').oncancel=()=>res(null); $('askDlg').showModal(); if(input!==undefined) inp.focus(); }); }

/* ---------- undo & autosave ---------- */
const snap=()=>JSON.stringify({scenes:project.scenes,cast:project.cast,backdrops:project.backdrops,pads:project.pads,mix:project.mix});
function checkpoint(){ undoStack.push(snap()); if(undoStack.length>40) undoStack.shift(); redoStack=[]; undoBtns(); }
function restoreSnap(s){ Object.assign(project,JSON.parse(s)); if(!project.scenes.find(x=>x.id===curId)) curId=project.scenes[0].id; selId=null; refreshAll(); dirty(); }
function undo(){ if(mode!=='setup'||!undoStack.length) return; redoStack.push(snap()); restoreSnap(undoStack.pop()); undoBtns(); }
function redo(){ if(mode!=='setup'||!redoStack.length) return; undoStack.push(snap()); restoreSnap(redoStack.pop()); undoBtns(); }
function undoBtns(){ $('undoBtn').disabled=!undoStack.length; $('redoBtn').disabled=!redoStack.length; }
let saveT,thumbT;
function dirty(){ clearTimeout(saveT); saveT=setTimeout(autosave,1200); clearTimeout(thumbT); thumbT=setTimeout(renderScenes,250); }
const DB=()=>new Promise((res,rej)=>{ const r=indexedDB.open('cutout-animator',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
async function autosave(){ if(mode!=='setup') return dirty(); try{ const d=await DB(); await new Promise((res,rej)=>{ const t=d.transaction('kv','readwrite'); t.objectStore('kv').put({...project,savedAt:Date.now(),curId},'auto'); t.oncomplete=res; t.onerror=()=>rej(t.error); }); d.close(); }catch(e){ console.warn('autosave',e); } }
async function loadAuto(){ try{ const d=await DB(); const v=await new Promise((res,rej)=>{ const q=d.transaction('kv').objectStore('kv').get('auto'); q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); }); d.close(); return v; }catch(_){ return null; } }

/* ---------- assets ---------- */
async function loadImg(a){
  if(imgs.has(a.id)) return imgs.get(a.id);
  const im=new Image(); im.src=URL.createObjectURL(a.blob); await im.decode(); imgs.set(a.id,im);
  if(a.kind==='cutout'){ const k=Math.min(1,96/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas'); c.width=Math.max(1,im.naturalWidth*k|0); c.height=Math.max(1,im.naturalHeight*k|0);
    const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(im,0,0,c.width,c.height); hitMaps.set(a.id,{w:c.width,h:c.height,d:g.getImageData(0,0,c.width,c.height).data}); }
  return im;
}
function addAsset(kind,blob,name,w,h){ const a={id:uid(),kind,blob,name,w,h}; project.assets[a.id]=a; return a; }
function placeCutout(a){ const k=Math.min(420/a.h,520/a.w,1.4), s=cur(), n=s.items.length;
  const it={id:uid(),assetId:a.id,x:W/2+[0,-300,300,-150,150][n%5],y:H*.58+((n%3)-1)*30,s:k,r:0,flip:false}; s.items.push(it); selId=it.id; return it; }

/* ---------- drawing ---------- */
function drawBackdrop(c,b){
  if(b.type==='color'){ c.fillStyle=b.color; c.fillRect(0,0,W,H); return; }
  if(b.type==='asset'){ const a=project.assets[b.id], im=a&&imgs.get(a.id); if(im){ const k=Math.max(W/im.naturalWidth,H/im.naturalHeight), w=im.naturalWidth*k, h=im.naturalHeight*k; c.drawImage(im,(W-w)/2,(H-h)/2,w,h); return; } c.fillStyle='#ddd'; c.fillRect(0,0,W,H); return; }
  const p=PRESETS[b.id]||PRESETS.sky, g=c.createLinearGradient(0,0,0,H); g.addColorStop(0,p.stops[0]); g.addColorStop(1,p.stops[1]); c.fillStyle=g; c.fillRect(0,0,W,H);
  if(p.stars){ c.fillStyle='#fff'; for(let i=0;i<70;i++){ const x=(i*347)%W,y=(i*193)%(H*.7); c.fillRect(x,y,i%5?2:4,i%5?2:4); } c.beginPath(); c.arc(1050,120,50,0,7); c.fillStyle='#fdf6c9'; c.fill(); }
  if(p.ground){ const y=H*(p.high?.5:.8); c.fillStyle=p.ground; c.beginPath(); c.moveTo(0,y); for(let x=0;x<=W;x+=40) c.lineTo(x,y+Math.sin(x/170)*16+Math.sin(x/61)*5); c.lineTo(W,H); c.lineTo(0,H); c.closePath(); c.fill(); }
}
function drawItem(c,it,p){ const im=imgs.get(it.assetId); if(!im) return; const w=im.naturalWidth*p.s,h=im.naturalHeight*p.s; c.save(); c.translate(p.x,p.y); c.rotate(p.r+(p.tilt||0)); c.scale(p.flip?-1:1,1); c.drawImage(im,-w/2,-h/2,w,h); c.restore(); }
function drawScene(c,scene,poseOf){ c.save(); c.beginPath(); c.rect(0,0,W,H); c.clip(); drawBackdrop(c,scene.backdrop); for(const it of scene.items) drawItem(c,it,poseOf(it)); c.restore(); }
function poseAt(it,take,t){
  const f=take&&take.tracks[it.id]; if(!f||!f.length||t<f[0][0]) return it;
  const l=f[f.length-1]; if(t>=l[0]) return {x:l[1],y:l[2],s:l[3],r:l[4],flip:!!l[5],tilt:l[6]};
  let a=0,b=f.length-1; while(b-a>1){ const m=(a+b)>>1; if(f[m][0]<=t) a=m; else b=m; }
  const A=f[a],B=f[b],k=(t-A[0])/((B[0]-A[0])||1),L=i=>A[i]+(B[i]-A[i])*k;
  return {x:L(1),y:L(2),s:L(3),r:L(4),flip:!!A[5],tilt:L(6)};
}

const cv=$('stage'),ctx=cv.getContext('2d'); let vs=1,dpr=1;
function resize(){ const b=$('stageWrap').getBoundingClientRect(); if(!b.width||!b.height) return; dpr=Math.min(2.5,devicePixelRatio||1); const k=Math.min(b.width/VW,b.height/VH),cw=Math.floor(VW*k),ch=Math.floor(VH*k);
  cv.style.width=cw+'px'; cv.style.height=ch+'px'; cv.width=Math.floor(cw*dpr); cv.height=Math.floor(ch*dpr); vs=cv.width/VW; }
new ResizeObserver(resize).observe($('stageWrap'));
function corners(it,p){ const im=imgs.get(it.assetId); if(!im) return null; const hw=im.naturalWidth*p.s/2,hh=im.naturalHeight*p.s/2,cs=Math.cos(p.r),sn=Math.sin(p.r),R=(x,y)=>[p.x+x*cs-y*sn,p.y+x*sn+y*cs]; return {tl:R(-hw,-hh),tr:R(hw,-hh),br:R(hw,hh),bl:R(-hw,hh)}; }
function poseNow(it){ if(mode==='rec') return live.get(it.id)||it; if(mode==='play'&&playing) return poseAt(it,playing.scene.take,playing.t); return it; }
function render(){
  const scene=playing?playing.scene:cur();
  ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='#2d2730'; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.setTransform(vs,0,0,vs,MX*vs,MY*vs); ctx.imageSmoothingQuality='high';
  drawScene(ctx,scene,poseNow);
  // Off-stage "wings": cutouts stay visible here for the performer, but the video crops them out.
  ctx.save(); ctx.globalAlpha=.55; for(const it of scene.items){ const p=poseNow(it),c=corners(it,p); if(!c) continue; const xs=[c.tl[0],c.tr[0],c.br[0],c.bl[0]],ys=[c.tl[1],c.tr[1],c.br[1],c.bl[1]];
    if(Math.min(...xs)<0||Math.max(...xs)>W||Math.min(...ys)<0||Math.max(...ys)>H){ ctx.save(); ctx.beginPath(); ctx.rect(-MX,-MY,VW,VH); ctx.rect(0,0,W,H); ctx.clip('evenodd'); drawItem(ctx,it,p); ctx.restore(); } } ctx.restore();
  ctx.strokeStyle=mode==='rec'?'#ff4a33':'#fff'; ctx.lineWidth=(mode==='rec'?5:2)/vs*dpr; ctx.strokeRect(0,0,W,H);
  const it=sel();
  if(it&&mode!=='play'){ const p=poseNow(it),c=corners(it,p); if(c){ const px=1/vs*dpr; ctx.setLineDash([8*px,6*px]); ctx.lineWidth=2*px; ctx.strokeStyle='#fff'; ctx.beginPath(); ctx.moveTo(...c.tl); ctx.lineTo(...c.tr); ctx.lineTo(...c.br); ctx.lineTo(...c.bl); ctx.closePath(); ctx.stroke(); ctx.strokeStyle='#000'; ctx.lineDashOffset=8*px; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset=0;
      ctx.beginPath(); ctx.arc(c.tr[0],c.tr[1],13*px,0,7); ctx.fillStyle='#0b6e6e'; ctx.fill(); ctx.lineWidth=2.5*px; ctx.strokeStyle='#fff'; ctx.stroke(); } }
}

/* ---------- pointer control: every finger moves its own cutout ---------- */
const live=new Map(); let rec=null; const grabs=new Map();
const world=e=>{ const r=cv.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*VW-MX,(e.clientY-r.top)/r.height*VH-MY]; };
function hit(x,y){
  const items=cur().items; for(let i=items.length-1;i>=0;i--){ const it=items[i],p=poseNow(it),im=imgs.get(it.assetId),hm=hitMaps.get(it.assetId); if(!im) continue;
    const dx=x-p.x,dy=y-p.y,cs=Math.cos(-p.r),sn=Math.sin(-p.r); let lx=dx*cs-dy*sn; const ly=dx*sn+dy*cs; const w=im.naturalWidth*p.s,h=im.naturalHeight*p.s;
    if(Math.abs(lx)>w/2+10||Math.abs(ly)>h/2+10) continue; if(p.flip) lx=-lx; if(!hm) return it;
    const u=(lx/w+.5)*hm.w|0,v=(ly/h+.5)*hm.h|0; for(let b=-2;b<=2;b++)for(let a=-2;a<=2;a++){ const X=u+a,Y=v+b; if(X>=0&&Y>=0&&X<hm.w&&Y<hm.h&&hm.d[(Y*hm.w+X)*4+3]>40) return it; } }
  return null;
}
function target(it){ if(mode==='rec'){ touchRec(it); return live.get(it.id); } return it; }
function touchRec(it){ if(rec&&rec.layer&&!rec.over[it.id]) rec.over[it.id]=recTime(); }
function clampPose(p){ p.x=clamp(p.x,-MX+20,W+MX-20); p.y=clamp(p.y,-MY+20,H+MY-20); p.s=clamp(p.s,.03,8); }
let setupMoved=false;
function beforeMove(){ if(mode==='setup'&&!setupMoved){ setupMoved=true; checkpoint(); } }
let lastTap={t:0,id:null};
function rebase(id){ // when fingers join or leave a cutout, restart the gesture from its present pose
  const pts=[...grabs.values()].filter(g=>g.id===id), it=cur().items.find(i=>i.id===id); if(!it) return; const p=poseNow(it);
  if(pts.length===1&&pts[0].kind==='drag'){ pts[0].ox=p.x-pts[0].x; pts[0].oy=p.y-pts[0].y; }
  if(pts.length>=2){ const [a,b]=pts; it.__g={d:Math.hypot(a.x-b.x,a.y-b.y)||1,a:Math.atan2(b.y-a.y,b.x-a.x),s:p.s,r:p.r,x:p.x,y:p.y,mx:(a.x+b.x)/2,my:(a.y+b.y)/2}; }
}
cv.addEventListener('pointerdown',e=>{
  if(mode==='play'||mode==='count'){ return; } e.preventDefault(); cv.focus({preventScroll:true}); try{ cv.setPointerCapture(e.pointerId); }catch(_){}
  const [x,y]=world(e); setupMoved=false;
  const s=sel(); if(s&&!grabs.size){ const c=corners(s,poseNow(s)); if(c&&Math.hypot(x-c.tr[0],y-c.tr[1])<(e.pointerType==='touch'?34:24)/vs*dpr){ const p=poseNow(s); grabs.set(e.pointerId,{id:s.id,kind:'handle',x,y,d0:Math.hypot(x-p.x,y-p.y)||1,a0:Math.atan2(y-p.y,x-p.x),s0:p.s,r0:p.r,moved:true}); return; } }
  let it=hit(x,y);
  if(!it&&mode==='setup'&&grabs.size===1){ const g=[...grabs.values()][0]; it=cur().items.find(i=>i.id===g.id)||null; }
  if(!it){ if(!grabs.size){ selId=null; updateItemBar(); } return; }
  selId=it.id; updateItemBar(); grabs.set(e.pointerId,{id:it.id,kind:'drag',x,y,sx:x,sy:y,t:performance.now(),moved:false,ox:0,oy:0}); rebase(it.id);
});
cv.addEventListener('pointermove',e=>{
  const g=grabs.get(e.pointerId); if(!g) return; e.preventDefault(); const [x,y]=world(e); g.x=x; g.y=y;
  const it=cur().items.find(i=>i.id===g.id); if(!it) return;
  if(g.kind==='handle'){ beforeMove(); const p=target(it); p.s=clamp(g.s0*Math.hypot(x-p.x,y-p.y)/g.d0,.03,8); p.r=g.r0+Math.atan2(y-p.y,x-p.x)-g.a0; dirtyIf(); return; }
  if(!g.moved&&Math.hypot(x-g.sx,y-g.sy)>4) g.moved=true; if(!g.moved) return;
  const pts=[...grabs.values()].filter(q=>q.id===g.id); beforeMove(); const p=target(it);
  if(pts.length>=2&&it.__g){ const [a,b]=pts,G=it.__g; p.s=G.s*Math.hypot(a.x-b.x,a.y-b.y)/G.d; p.r=G.r+Math.atan2(b.y-a.y,b.x-a.x)-G.a; p.x=G.x+(a.x+b.x)/2-G.mx; p.y=G.y+(a.y+b.y)/2-G.my; }
  else { p.x=x+g.ox; p.y=y+g.oy; }
  clampPose(p); dirtyIf();
});
function dirtyIf(){ if(mode==='setup') dirty(); }
function endPtr(e){
  const g=grabs.get(e.pointerId); if(!g) return; grabs.delete(e.pointerId); rebase(g.id);
  if(g.kind==='drag'&&!g.moved&&performance.now()-g.t<320){ const n=performance.now(); if(lastTap.id===g.id&&n-lastTap.t<340){ flip(); lastTap={t:0,id:null}; } else lastTap={t:n,id:g.id}; }
}
cv.addEventListener('pointerup',endPtr); cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('wheel',e=>{ if(mode==='play'||mode==='count') return; const [x,y]=world(e),it=hit(x,y)||sel(); if(!it) return; e.preventDefault(); selId=it.id; updateItemBar(); if(mode==='setup'&&!cv.__wheel){ checkpoint(); cv.__wheel=setTimeout(()=>cv.__wheel=0,500); } const p=target(it); if(e.shiftKey) p.r+=e.deltaY*.0025; else { p.s=clamp(p.s*Math.exp(-e.deltaY*.0012),.03,8); } dirtyIf(); },{passive:false});

function flip(){ const it=sel(); if(!it) return; if(mode==='setup') checkpoint(); const p=target(it); p.flip=!p.flip; dirtyIf(); }

/* ---------- recording ---------- */
const recTime=()=>Sound.audioCtx().currentTime-rec.t0;
let stopAudio=null,voiceWanted=true,micOK=false,rafId=0,lastTick=0;
async function preload(scene){ const assets=project.assets,map=new Map(); for(const r of Sound.refsFor(scene)){ try{ map.set(r,await Sound.buffer(r,assets)); }catch(e){ console.warn('sound',r,e); } } return r=>map.get(r)||null; }
function mixNow(){ return project.mix; }
async function startRecording(layer){
  if(mode!=='setup') return; const scene=cur();
  if(!scene.items.length&&!layer){ const v=await ask('Nothing on stage yet','Add a cutout first, or record anyway to narrate over just the backdrop.',[['Go back',null],['Record anyway',1,'primary']]); if(!v) return; }
  if(scene.take&&!layer){ const v=await ask('Replace this recording?','Scene '+(project.scenes.indexOf(scene)+1)+' already has a recording. You can Undo afterwards.',[['Keep it',null],['Replace','y','danger']]); if(!v) return; }
  Sound.audioCtx(); selId=layer?selId:null; updateItemBar();
  voiceWanted=$('voiceOn').checked; micOK=false;
  if(voiceWanted){ try{ micOK=await Sound.micStart(); }catch(e){ console.warn(e); } if(!micOK) toast("The microphone isn't available, so this take has no voice. Check site permissions."); }
  mode='count'; setLive(true); $('countdown').hidden=false;
  const buf=await preload(scene);
  for(const n of [3,2,1]){ $('countdown').textContent=n; await new Promise(r=>setTimeout(r,700)); }
  $('countdown').hidden=true; beginTake(scene,layer,buf);
}
function beginTake(scene,layer,buf){
  const c=Sound.audioCtx(); live.clear();
  for(const it of scene.items){ const p=layer?poseAt(it,scene.take,0):it; live.set(it.id,{x:p.x,y:p.y,s:p.s,r:p.r,flip:!!p.flip,tilt:p.tilt||0}); }
  const t0=c.currentTime+.04;
  rec={scene,layer:!!layer,t0,tracks:{},last:{},over:{},fx:[],prevT:0,lastPush:{},vel:{}};
  for(const [id,p] of live) rec.last[id]={...p};
  stopAudio=Sound.schedule(c,Sound.master(c),scene,t0,buf,mixNow(),{dur:Infinity,withTake:!!layer});
  if(micOK) Sound.micCollect();
  mode='rec'; renderPads(); $('nextSceneBtn').hidden=!nextOpen();
}
const nextOpen=()=>{ const i=project.scenes.indexOf(cur()),n=project.scenes[i+1]; return !!(n&&!n.take)&&!rec?.layer; };
function sample(t,dt){
  for(const it of rec.scene.items){
    const p=live.get(it.id); if(!p) continue; const id=it.id;
    if(rec.layer&&!rec.over[id]){ const q=poseAt(it,rec.scene.take,t); Object.assign(p,{x:q.x,y:q.y,s:q.s,r:q.r,flip:!!q.flip,tilt:q.tilt||0}); rec.last[id]={...p}; rec.prevT=t; continue; }
    const l=rec.last[id];
    if(project.wobble){ const vx=(p.x-l.x)/Math.max(dt,.001), held=[...grabs.values()].some(g=>g.id===id), goal=held?clamp(vx*.00028,-.2,.2):0; p.tilt+=(goal-p.tilt)*Math.min(1,dt*11); if(Math.abs(p.tilt)<.001) p.tilt=0; } else p.tilt=0;
    const changed=Math.abs(p.x-l.x)>.05||Math.abs(p.y-l.y)>.05||Math.abs(p.s-l.s)>.0005||Math.abs(p.r-l.r)>.0005||p.flip!==l.flip||Math.abs(p.tilt-l.tilt)>.001;
    if(!changed) continue;
    const tr=rec.tracks[id]||(rec.tracks[id]=[]), lp=rec.lastPush[id]||-1;
    if(t-lp<.024) { continue; }
    if(tr.length===0||t-lp>.09) tr.push(frame(Math.max(0,t-dt),l));   // hold the rest pose right up to this move
    tr.push(frame(t,p)); rec.lastPush[id]=t; rec.last[id]={...p};
  }
}
const r3=n=>Math.round(n*1000)/1000;
const frame=(t,p)=>[r3(t),r3(p.x),r3(p.y),r3(p.s),r3(p.r),p.flip?1:0,r3(p.tilt)];
function finishTake(){
  if(!rec) return; const t=recTime(), scene=rec.scene;
  sample(t,1/60);
  for(const it of scene.items){ const tr=rec.tracks[it.id],p=live.get(it.id); if(tr&&p&&Math.abs(tr[tr.length-1][1]-p.x)+Math.abs(tr[tr.length-1][2]-p.y)>.05) tr.push(frame(t,p)); }
  checkpoint();
  let voice=null; if(micOK){ const b=Sound.micTake(); if(b){ const a=addAsset('audio',b,'Voice '+new Date().toLocaleTimeString()); voice={assetId:a.id,t:0}; } }
  if(rec.layer&&scene.take){
    const old=scene.take, tracks={...old.tracks};
    for(const id of Object.keys(rec.tracks)){ const T=rec.over[id]??0; tracks[id]=(old.tracks[id]||[]).filter(f=>f[0]<T).concat(rec.tracks[id]); }
    scene.take={dur:Math.max(old.dur,t),tracks,voices:[...(old.voices||[]),...(voice?[voice]:[])],fx:[...(old.fx||[]),...rec.fx].sort((a,b)=>a.t-b.t)};
  } else scene.take={dur:t,tracks:rec.tracks,voices:voice?[voice]:[],fx:rec.fx};
  if(stopAudio){ stopAudio(); stopAudio=null; }
  grabs.clear(); rec=null; live.clear();
}
function stopRecording(){ if(mode==='count') return; if(mode!=='rec') return; finishTake(); Sound.micStop(); micOK=false; mode='setup'; setLive(false); refreshAll(); dirty(); toast('Recorded! Press Play to watch it.'); }
async function nextScene(){ if(mode!=='rec'||!nextOpen()) return; const i=project.scenes.indexOf(cur()); finishTake(); const n=project.scenes[i+1]; curId=n.id; selId=null; mode='count'; const buf=await preload(n); renderScenes(); beginTake(n,false,buf); }
function setLive(on){ document.body.classList.toggle('live',on); $('transport').hidden=on; $('recBar').hidden=!on; $('stopBtn').querySelector('.sq').hidden=false; $('stopBtn').lastChild.textContent=' Stop'; $('timer').hidden=false; $('micLevelWrap').hidden=!micOK; $('nextSceneBtn').hidden=true; $('padLive').hidden=mode==='play'; $('timer').textContent='0:00'; resize(); }

/* ---------- playback ---------- */
let playing=null,playQueue=[];
async function play(scenes){
  if(mode!=='setup') return; playQueue=scenes.filter(s=>s.take); if(!playQueue.length) return; Sound.audioCtx(); mode='play'; selId=null; updateItemBar(); setLive(true); await playNext();
}
async function playNext(){
  const scene=playQueue.shift(); if(!scene){ stopPlay(); return; }
  curId=scene.id; renderScenes(); const buf=await preload(scene); if(mode!=='play') return; const c=Sound.audioCtx(), t0=c.currentTime+.06;
  stopAudio=Sound.schedule(c,Sound.master(c),scene,t0,buf,mixNow(),{dur:scene.take.dur,withTake:true});
  playing={scene,t0,t:0};
}
function stopPlay(){ if(stopAudio){ stopAudio(); stopAudio=null; } playing=null; playQueue=[]; mode='setup'; setLive(false); refreshAll(); }

function tick(now){
  rafId=requestAnimationFrame(tick); const dt=Math.min(.1,(now-lastTick)/1000||.016); lastTick=now;
  if(mode==='rec'&&rec){ const t=recTime(); if(t>=0){ sample(t,dt); $('timer').textContent=fmt(t); } if(micOK) $('micLevel').style.width=Math.min(100,Sound.mic.level*180)+'%'; }
  if(mode==='play'&&playing){ playing.t=Sound.audioCtx().currentTime-playing.t0; $('timer').textContent=fmt(playing.t); if(playing.t>=playing.scene.take.dur&&!playing.ended){ playing.ended=true; stopAudio=null; playNext(); } if(playing&&playing.ended) playing.t=playing.scene.take.dur; }
  render();
}

/* ---------- UI lists ---------- */
function thumbURL(a){ return a.__u||(a.__u=URL.createObjectURL(a.blob)); }
function renderCast(){ const box=$('castList'); box.innerHTML=''; for(const id of project.cast){ const a=project.assets[id]; if(!a) continue; const b=document.createElement('button'); b.className='thumb'; b.setAttribute('aria-label','Put '+(a.name||'cutout')+' on stage'); const im=new Image(); im.src=thumbURL(a); im.alt=''; b.append(im);
    const x=document.createElement('span'); x.className='x'; x.textContent='×'; x.setAttribute('role','button'); x.setAttribute('aria-label','Delete cutout'); x.onclick=async ev=>{ ev.stopPropagation(); const used=project.scenes.some(s=>s.items.some(i=>i.assetId===id)); if(used&&!await ask('Remove this cutout?','It will disappear from every scene that uses it.',[['Keep it',null],['Remove',1,'danger']])) return; checkpoint(); project.cast=project.cast.filter(c=>c!==id); project.scenes.forEach(s=>{ const gone=s.items.filter(i=>i.assetId===id).map(i=>i.id); s.items=s.items.filter(i=>i.assetId!==id); if(s.take) gone.forEach(g=>delete s.take.tracks[g]); }); selId=null; refreshAll(); dirty(); }; b.append(x);
    b.onclick=()=>{ if(mode!=='setup') return; checkpoint(); placeCutout(a); updateItemBar(); refreshHint(); dirty(); }; box.append(b); } refreshHint(); }
function refreshHint(){ $('emptyHint').hidden=!!cur().items.length||mode!=='setup'||!!cur().take; }
function renderBack(){ const box=$('backList'),sc=cur(); box.innerHTML='';
  const add=(label,bd,paint,del)=>{ const b=document.createElement('button'); b.className='thumb'; const same=JSON.stringify(sc.backdrop)===JSON.stringify(bd); b.classList.toggle('on',same); b.setAttribute('aria-pressed',same); paint(b); const l=document.createElement('span'); l.className='lab'; l.textContent=label; b.append(l);
    if(del){ const x=document.createElement('span'); x.className='x'; x.textContent='×'; x.setAttribute('aria-label','Delete backdrop'); x.onclick=ev=>{ ev.stopPropagation(); del(); }; b.append(x); }
    b.onclick=()=>{ checkpoint(); cur().backdrop=bd; renderBack(); dirty(); }; box.append(b); };
  for(const id of project.backdrops){ const a=project.assets[id]; if(!a) continue; add(a.name||'Photo',{type:'asset',id},b=>{ const im=new Image(); im.src=thumbURL(a); im.alt=''; b.append(im); },()=>{ checkpoint(); project.backdrops=project.backdrops.filter(x=>x!==id); project.scenes.forEach(s=>{ if(s.backdrop.id===id) s.backdrop={type:'preset',id:'sky'}; }); refreshAll(); dirty(); }); }
  for(const id in PRESETS) add(PRESETS[id].name,{type:'preset',id},b=>{ const c=document.createElement('canvas'); c.width=160;c.height=90; const g=c.getContext('2d'); g.scale(160/W,90/H); drawBackdrop(g,{type:'preset',id}); b.append(c); });
  if(sc.backdrop.type==='color') $('backColor').value=sc.backdrop.color;
}
function fillSelect(sel,builtin,prefix,val){ sel.innerHTML=''; const o=(v,t)=>{ const e=document.createElement('option'); e.value=v; e.textContent=t; sel.append(e); }; o('','None'); for(const k in builtin) o(prefix+':'+k,builtin[k]); for(const id in project.assets){ const a=project.assets[id]; if(a.kind==='audio'&&a.userSound) o('asset:'+id,a.name); } sel.value=val||''; }
function renderSoundTab(){ const s=cur(); fillSelect($('ambSel'),Sound.AMBIENCE,'syn',s.ambience); fillSelect($('musSel'),Sound.MUSIC,'mus',s.music);
  const m=project.mix; $('mixVoice').value=m.voice; $('mixAmb').value=m.ambience; $('mixMus').value=m.music; $('mixFx').value=m.fx; renderPads(); }
const padName=r=>{ if(r.startsWith('asset:')){ const a=project.assets[r.slice(6)]; return a?a.name:'?'; } return r; };
function renderPads(){
  const mk=(box,edit)=>{ box.innerHTML=''; project.pads.forEach((r,i)=>{ const b=document.createElement('button'); b.textContent=padName(r); b.onclick=()=>hitPad(r); if(edit){ const x=document.createElement('span'); x.className='x'; x.textContent='×'; x.setAttribute('aria-label','Remove effect'); x.onclick=ev=>{ ev.stopPropagation(); checkpoint(); project.pads.splice(i,1); renderPads(); dirty(); }; b.append(x); } box.append(b); }); };
  mk($('padEdit'),true); mk($('padLive'),false);
}
async function hitPad(r){ const c=Sound.audioCtx(); try{ const b=await Sound.buffer(r,project.assets); if(!b) return; const s=c.createBufferSource(),g=c.createGain(); s.buffer=b; g.gain.value=project.mix.fx; s.connect(g); g.connect(Sound.master(c)); s.start(); if(mode==='rec'&&rec) rec.fx.push({t:r3(recTime()),ref:r}); }catch(e){ toast("That sound couldn't be played."); } }
async function renderLibrary(){ const box=$('sfxLib'); if(box.dataset.done) return; box.dataset.done=1;
  try{ const m=await (await fetch('sounds/manifest.json')).json(); for(const cat in m){ const d=document.createElement('details'),s=document.createElement('summary'); s.textContent='＋ '+cat; d.append(s); const w=document.createElement('div'); w.className='libItems'; for(const path of m[cat]){ const nm=path.split('/').pop().replace(/\.[^.]+$/,''); const b=document.createElement('button'); b.textContent=nm; b.onclick=()=>addLibSound(path,nm); w.append(b); } d.append(w); box.append(d); } }
  catch(_){ box.innerHTML='<p class="hint">The effects library needs a connection. Your own sound files still work.</p>'; } }
async function addLibSound(path,nm){ try{ const r=await fetch('sounds/'+path.split('/').map(encodeURIComponent).join('/')); if(!r.ok) throw 0; const blob=await r.blob(); let id=Object.keys(project.assets).find(k=>project.assets[k].libPath===path); if(!id){ const a=addAsset('audio',blob,nm); a.libPath=path; id=a.id; } const ref='asset:'+id; hitPad(ref); if(!project.pads.includes(ref)){ checkpoint(); project.pads.push(ref); renderPads(); dirty(); } }catch(_){ toast("That sound couldn't be loaded."); } }
function drawThumb(c,s){ const g=c.getContext('2d'); g.setTransform(c.width/W,0,0,c.height/H,0,0); drawScene(g,s,it=>it); }
function renderScenes(){ const box=$('sceneList'); box.innerHTML=''; project.scenes.forEach((s,i)=>{ const b=document.createElement('button'); b.className='scene'+(s.id===(playing?playing.scene.id:curId)?' on':''); b.setAttribute('aria-label','Scene '+(i+1)+(s.take?', recorded':''));
    const c=document.createElement('canvas'); c.width=186;c.height=105; drawThumb(c,s); b.append(c); const n=document.createElement('span'); n.className='num'; n.textContent=i+1; b.append(n);
    if(s.take){ const t=document.createElement('span'); t.className='tick'; t.textContent=fmt(s.take.dur); b.append(t); }
    b.onclick=()=>{ if(mode!=='setup') return; curId=s.id; selId=null; refreshAll(); };
    b.draggable=true; b.ondragstart=e=>{ e.dataTransfer.setData('text/plain',i); }; b.ondragover=e=>e.preventDefault(); b.ondrop=e=>{ e.preventDefault(); const from=+e.dataTransfer.getData('text/plain'); if(from===i) return; checkpoint(); const [m]=project.scenes.splice(from,1); project.scenes.splice(i,0,m); renderScenes(); dirty(); };
    box.append(b); }); }
function updateItemBar(){ $('itemBar').hidden=!sel()||mode!=='setup'; }
function refreshTransport(){ const s=cur(),any=project.scenes.some(x=>x.take); $('playBtn').disabled=!s.take; $('layerBtn').disabled=!s.take; $('playAllBtn').disabled=!any; $('takeInfo').textContent=s.take?'Scene '+(project.scenes.indexOf(s)+1)+' recorded: '+fmt(s.take.dur):''; $('recBtn').lastChild.textContent=s.take?' Record again':' Record'; }
function refreshAll(){ $('projName').value=project.name; $('wobble').checked=project.wobble; renderCast(); renderBack(); renderSoundTab(); renderScenes(); updateItemBar(); refreshTransport(); refreshHint(); undoBtns(); }

/* ---------- project files ---------- */
const extOf=b=>({'image/png':'png','image/jpeg':'jpg','audio/wav':'wav','audio/mpeg':'mp3','audio/mp4':'m4a','audio/ogg':'ogg'}[b.type]||'bin');
const safeName=()=>(project.name||'animation').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')||'animation';
function saveDownload(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),60000); }
function usedAssets(){ const u=new Set([...project.cast,...project.backdrops]); const ref=r=>{ if(r&&r.startsWith('asset:')) u.add(r.slice(6)); }; project.pads.forEach(ref);
  for(const s of project.scenes){ if(s.backdrop.type==='asset') u.add(s.backdrop.id); ref(s.ambience); ref(s.music); s.items.forEach(i=>u.add(i.assetId)); if(s.take){ (s.take.voices||[]).forEach(v=>u.add(v.assetId)); (s.take.fx||[]).forEach(f=>ref(f.ref)); } } return u; }
async function saveProject(){ toast('Saving…',60000); const z=new JSZip(),meta={},used=usedAssets();
  for(const id of used){ const a=project.assets[id]; if(!a) continue; const file='assets/'+id+'.'+extOf(a.blob); z.file(file,a.blob); meta[id]={id,kind:a.kind,name:a.name,w:a.w,h:a.h,file,type:a.blob.type,libPath:a.libPath,userSound:a.userSound}; }
  const {assets,...rest}=project; z.file('project.json',JSON.stringify({app:'cutout-animator',...rest,assets:meta}));
  const blob=await z.generateAsync({type:'blob',compression:'STORE'}); const d=new Date(),st=d.toISOString().slice(0,10)+'_'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0');
  saveDownload(blob,safeName()+'_'+st+'.cutz'); toast('Project saved to your downloads. Open it here any time to keep editing.'); }
async function openProject(file){ try{ const z=await JSZip.loadAsync(file),pj=z.file('project.json'); if(!pj) throw 0; const p=JSON.parse(await pj.async('string')); if(p.app!=='cutout-animator') throw 0; const metas=p.assets; p.assets={};
    for(const id in metas){ const m=metas[id],b=await z.file(m.file).async('blob'); p.assets[id]={...m,blob:new Blob([b],{type:m.type})}; }
    await adopt(p); undoStack=[]; redoStack=[]; refreshAll(); dirty(); toast('Opened '+p.name); }
  catch(e){ console.warn(e); toast("That isn't a Cutout Animator project file (.cutz)."); } }
async function adopt(p){ imgs.clear(); hitMaps.clear(); p.mix=p.mix||{voice:1,ambience:.5,music:.4,fx:1}; project=p; curId=p.curId&&p.scenes.find(s=>s.id===p.curId)?p.curId:p.scenes[0].id; delete project.curId; delete project.savedAt; selId=null; for(const a of Object.values(project.assets)) if(a.kind!=='audio'){ try{ await loadImg(a); }catch(_){ } } }

/* ---------- video export ---------- */
async function mixAll(scenes,total){ const sr=48000,off=new OfflineAudioContext(2,Math.max(1,Math.ceil(total*sr)),sr); let at=0; for(const s of scenes){ const buf=await preload(s); Sound.schedule(off,Sound.master(off),s,at,buf,project.mix,{dur:s.take.dur,withTake:true}); at+=s.take.dur; } return off.startRendering(); }
function frameAt(c,scenes,t,cw){ let a=0; for(const s of scenes){ if(t<a+s.take.dur||s===scenes[scenes.length-1]){ const l=t-a; c.setTransform(cw/W,0,0,cw/W,0,0); drawScene(c,s,it=>poseAt(it,s.take,l)); return; } a+=s.take.dur; } }
async function encodeAudio(buf,choice){ const out=[]; let err=null; const n=buf.numberOfChannels,sr=buf.sampleRate,e=new AudioEncoder({output:(chunk,meta)=>out.push({chunk,meta}),error:x=>err=x}); e.configure({codec:choice.enc,sampleRate:sr,numberOfChannels:n,bitrate:160000});
  const ch=[...Array(n).keys()].map(i=>buf.getChannelData(i)); for(let s=0;s<buf.length;s+=1024){ if(err) throw err; const len=Math.min(1024,buf.length-s),pl=new Float32Array(len*n); ch.forEach((c,i)=>pl.set(c.subarray(s,s+len),i*len)); const d=new AudioData({format:'f32-planar',sampleRate:sr,numberOfFrames:len,numberOfChannels:n,timestamp:Math.round(s/sr*1e6),data:pl}); try{ e.encode(d); }finally{ d.close(); } while(e.encodeQueueSize>10) await new Promise(r=>setTimeout(r)); }
  await e.flush(); e.close(); if(err) throw err; if(!out.length) throw new Error('no audio'); return out; }
async function exportWebCodecs(scenes,total,audio,cw,ch,prog){
  if(typeof VideoEncoder==='undefined'||typeof AudioEncoder==='undefined'||!window.Mp4Muxer) return null;
  const fps=30,bitrate=cw>1280?8e6:5e6; let codec=null; for(const k of ['avc1.640028','avc1.4d0028','avc1.42002a','avc1.42001f']){ try{ if((await VideoEncoder.isConfigSupported({codec:k,width:cw,height:ch,bitrate})).supported){ codec=k; break; } }catch(_){} } if(!codec) return null;
  let ac=null; for(const c of [{enc:'mp4a.40.2',mux:'aac'},{enc:'opus',mux:'opus'}]){ try{ if((await AudioEncoder.isConfigSupported({codec:c.enc,sampleRate:audio.sampleRate,numberOfChannels:2,bitrate:160000})).supported){ ac=c; break; } }catch(_){} } if(!ac) return null;
  prog('Encoding sound…',.03); const chunks=await encodeAudio(audio,ac);
  const mux=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:'avc',width:cw,height:ch},audio:{codec:ac.mux,numberOfChannels:2,sampleRate:audio.sampleRate},fastStart:'in-memory',firstTimestampBehavior:'offset'});
  chunks.forEach(({chunk,meta})=>mux.addAudioChunk(chunk,meta));
  let err=null; const enc=new VideoEncoder({output:(c,m)=>mux.addVideoChunk(c,m),error:e=>err=e}); enc.configure({codec,width:cw,height:ch,bitrate,framerate:fps});
  const cn=document.createElement('canvas'); cn.width=cw;cn.height=ch; const c=cn.getContext('2d'); c.imageSmoothingQuality='high'; const N=Math.ceil(total*fps);
  for(let i=0;i<N;i++){ if(err) throw err; frameAt(c,scenes,i/fps,cw); const f=new VideoFrame(cn,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)}); enc.encode(f,{keyFrame:i%60===0}); f.close(); while(enc.encodeQueueSize>4) await new Promise(r=>setTimeout(r)); if(i%10===0) prog('Making video… '+Math.round(i/N*100)+'%',.05+.93*i/N); }
  await enc.flush(); enc.close(); if(err) throw err; mux.finalize(); return {blob:new Blob([mux.target.buffer],{type:'video/mp4'}),ext:'mp4'};
}
async function exportRealtime(scenes,total,audio,cw,ch,prog){ // browsers without the encoders: play it through once, in real time
  const cn=document.createElement('canvas'); cn.width=cw;cn.height=ch; const c=cn.getContext('2d'),ac=Sound.audioCtx(),dst=ac.createMediaStreamDestination(),st=cn.captureStream(30); dst.stream.getAudioTracks().forEach(t=>st.addTrack(t));
  const type=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t)); if(!type) throw new Error('This browser cannot record video.');
  const mr=new MediaRecorder(st,{mimeType:type,videoBitsPerSecond:cw>1280?8e6:5e6}),parts=[]; mr.ondataavailable=e=>e.data.size&&parts.push(e.data); const done=new Promise(r=>mr.onstop=r);
  frameAt(c,scenes,0,cw); mr.start(1000); const s=ac.createBufferSource(); s.buffer=audio; s.connect(dst); const t0=ac.currentTime+.05; s.start(t0);
  await new Promise(res=>{ const go=()=>{ const t=ac.currentTime-t0; if(t>=total) return res(); frameAt(c,scenes,Math.max(0,t),cw); prog('Recording your video. Keep this tab open… '+Math.round(t/total*100)+'%',t/total); requestAnimationFrame(go); }; go(); });
  await new Promise(r=>setTimeout(r,150)); mr.stop(); await done; st.getTracks().forEach(t=>t.stop()); const base=type.split(';')[0]; return {blob:new Blob(parts,{type:base}),ext:base==='video/mp4'?'mp4':'webm'};
}
async function runExport(){ const scenes=project.scenes.filter(s=>s.take),total=scenes.reduce((a,s)=>a+s.take.dur,0),cw=+$('expSize').value,chh=Math.round(cw*H/W/2)*2;
  $('expSetup').hidden=true; $('expRun').hidden=false; const prog=(m,v)=>{ $('expStatus').textContent=m; $('expProg').value=v; };
  try{ Sound.audioCtx(); prog('Mixing sound…',.01); const audio=await mixAll(scenes,total); let r=null; try{ r=await exportWebCodecs(scenes,total,audio,cw,chh,prog); }catch(e){ console.warn('fast export failed',e); } if(!r) r=await exportRealtime(scenes,total,audio,cw,chh,prog);
    const url=URL.createObjectURL(r.blob),nm=safeName()+'.'+r.ext; window.__lastExport=r; $('expVideo').src=url; $('expDl').href=url; $('expDl').download=nm; $('expNote').textContent=`${fmt(total)} long, ${(r.blob.size/1048576).toFixed(1)} MB, ${r.ext.toUpperCase()}.`+(r.ext==='webm'?' This browser makes WebM, which plays in Chrome and most editors. Safari or Edge may give you MP4.':'');
    const file=new File([r.blob],nm,{type:r.blob.type}); $('expShare').hidden=!(navigator.canShare&&navigator.canShare({files:[file]})); $('expShare').onclick=()=>navigator.share({files:[file]}).catch(()=>{});
    $('expRun').hidden=true; $('expDone').hidden=false; }
  catch(e){ console.error(e); $('exportDlg').close(); toast('The video could not be made: '+(e.message||e),8000); } }

/* ---------- words ---------- */
async function addWords(){ const t=await ask('Add words','Type a title, a label or a speech bubble.',[['Cancel',null],['Add','__input','primary']],''); if(!t||!t.trim()) return; const txt=t.trim().slice(0,80),lines=txt.split('\n'),fs=96,c=document.createElement('canvas'),g=c.getContext('2d'),font=`800 ${fs}px ui-rounded,"Trebuchet MS",sans-serif`; g.font=font; const w=Math.ceil(g.measureText(txt).width)+56,h=fs+60; c.width=w;c.height=h; g.font=font; g.textBaseline='middle'; g.textAlign='center'; g.lineJoin='round'; g.lineWidth=18; g.strokeStyle='#fff'; g.strokeText(txt,w/2,h/2); g.fillStyle='#2a2320'; g.fillText(txt,w/2,h/2);
  const blob=await new Promise(r=>c.toBlob(r,'image/png')); checkpoint(); const a=addAsset('cutout',blob,txt,w,h); await loadImg(a); project.cast.push(a.id); const it=placeCutout(a); it.s=Math.min(1,900/w); it.y=H*.2; renderCast(); updateItemBar(); dirty(); }

/* ---------- wiring ---------- */
function wire(){
  document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; document.querySelectorAll('.tabs button').forEach(x=>{ x.classList.toggle('on',x===b); x.setAttribute('aria-selected',x===b); }); for(const t of ['cast','back','sound']) $('tab-'+t).hidden=t!==tab; if(tab==='sound') renderLibrary(); });
  Cut.init({toast,
    onCutout:async(blob,w,h)=>{ checkpoint(); const n=project.cast.length+1,a=addAsset('cutout',blob,'Cutout '+n,w,h); await loadImg(a); project.cast.push(a.id); placeCutout(a); renderCast(); updateItemBar(); dirty(); },
    onBackdrop:async(blob,w,h)=>{ checkpoint(); const a=addAsset('backdrop',blob,'Photo '+(project.backdrops.length+1),w,h); await loadImg(a); project.backdrops.push(a.id); cur().backdrop={type:'asset',id:a.id}; renderBack(); dirty(); }});
  $('addDrawing').onclick=()=>Cut.open('cutout'); $('addBackdrop').onclick=()=>Cut.open('backdrop'); $('addWords').onclick=addWords;
  $('backColor').oninput=e=>{ cur().backdrop={type:'color',color:e.target.value}; renderBack(); dirty(); }; $('backColor').onchange=()=>{};
  $('ambSel').onchange=e=>{ checkpoint(); stopPrev(); cur().ambience=e.target.value||null; dirty(); }; $('musSel').onchange=e=>{ checkpoint(); stopPrev(); cur().music=e.target.value||null; dirty(); };
  let prevStop=null,prevBtn=null; const stopPrev=()=>{ if(prevStop){ prevStop(); prevStop=null; prevBtn.textContent='▶'; } };
  const prev=(btn,get,key)=>btn.onclick=async()=>{ if(prevBtn===btn&&prevStop){ stopPrev(); return; } stopPrev(); const r=get(); if(!r) return; const c=Sound.audioCtx(),b=await Sound.buffer(r,project.assets),fake={ambience:key==='ambience'?r:null,music:key==='music'?r:null}; prevStop=Sound.schedule(c,Sound.master(c),fake,c.currentTime+.02,x=>x===r?b:null,project.mix,{dur:Infinity}); prevBtn=btn; btn.textContent='■'; };
  prev($('ambPrev'),()=>$('ambSel').value,'ambience'); prev($('musPrev'),()=>$('musSel').value,'music');
  $('uploadSound').onclick=()=>$('soundInput').click();
  $('soundInput').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f) return; const nm=f.name.replace(/\.[^.]+$/,''); const a=addAsset('audio',f.slice(0,f.size,f.type||'audio/mpeg'),nm); a.userSound=true; try{ await Sound.buffer('asset:'+a.id,project.assets); }catch(_){ delete project.assets[a.id]; toast("That sound file couldn't be opened."); return; } const c=await ask('Use “'+nm+'” as…','',[['Background sound','amb'],['Music','mus'],['Effect button','pad']]); if(!c) return; checkpoint(); const ref='asset:'+a.id; if(c==='amb') cur().ambience=ref; if(c==='mus') cur().music=ref; if(c==='pad') project.pads.push(ref); renderSoundTab(); dirty(); };
  const mx=(id,key)=>{ $(id).oninput=e=>{ project.mix[key]=+e.target.value; dirty(); }; }; mx('mixVoice','voice'); mx('mixAmb','ambience'); mx('mixMus','music'); mx('mixFx','fx');
  $('recBtn').onclick=()=>startRecording(false); $('layerBtn').onclick=()=>startRecording(true); $('stopBtn').onclick=()=>{ mode==='play'?stopPlay():stopRecording(); }; $('nextSceneBtn').onclick=nextScene;
  $('playBtn').onclick=()=>play([cur()]); $('playAllBtn').onclick=()=>play(project.scenes);
  $('wobble').onchange=e=>{ project.wobble=e.target.checked; dirty(); }; $('projName').oninput=e=>{ project.name=e.target.value; dirty(); };
  $('itFlip').onclick=flip;
  const reorder=d=>{ const s=cur(),i=s.items.findIndex(x=>x.id===selId); if(i<0) return; const j=clamp(i+d,0,s.items.length-1); if(i===j) return; checkpoint(); const [m]=s.items.splice(i,1); s.items.splice(j,0,m); dirty(); };
  $('itFwd').onclick=()=>reorder(1); $('itBack').onclick=()=>reorder(-1);
  $('itDup').onclick=()=>{ const it=sel(); if(!it) return; checkpoint(); const n={...it,id:uid(),x:it.x+40,y:it.y+30}; cur().items.push(n); selId=n.id; dirty(); };
  const removeSel=()=>{ const it=sel(); if(!it) return; checkpoint(); const s=cur(); s.items=s.items.filter(x=>x.id!==it.id); if(s.take) delete s.take.tracks[it.id]; selId=null; updateItemBar(); refreshHint(); dirty(); };
  $('itDel').onclick=removeSel;
  $('addScene').onclick=()=>{ checkpoint(); const prev=cur(),n=blankScene(project.scenes.length+1); n.backdrop={...prev.backdrop}; project.scenes.splice(project.scenes.indexOf(prev)+1,0,n); curId=n.id; selId=null; refreshAll(); dirty(); };
  $('dupScene').onclick=()=>{ checkpoint(); const prev=cur(),n=JSON.parse(JSON.stringify(prev)); n.id=uid(); n.name='Scene '+(project.scenes.length+1); const end=prev.take?prev.take.dur:0; n.items=prev.items.map(it=>{ const p=poseAt(it,prev.take,end); return {id:uid(),assetId:it.assetId,x:p.x,y:p.y,s:p.s,r:p.r,flip:!!p.flip}; }); n.take=null; project.scenes.splice(project.scenes.indexOf(prev)+1,0,n); curId=n.id; selId=null; refreshAll(); dirty(); };
  $('delScene').onclick=async()=>{ if(project.scenes.length<2){ toast('A project needs at least one scene.'); return; } if(cur().take&&!await ask('Delete this scene?','Its recording goes too. You can Undo.',[['Keep it',null],['Delete',1,'danger']])) return; checkpoint(); const i=project.scenes.indexOf(cur()); project.scenes.splice(i,1); curId=project.scenes[Math.max(0,i-1)].id; selId=null; refreshAll(); dirty(); };
  $('undoBtn').onclick=undo; $('redoBtn').onclick=redo;
  $('newBtn').onclick=async()=>{ if(!await ask('Start a new project?','Anything you have not saved as a project file will be lost.',[['Cancel',null],['Start new',1,'danger']])) return; await adopt(newProject()); undoStack=[]; redoStack=[]; refreshAll(); autosave(); };
  $('saveBtn').onclick=saveProject; $('openBtn').onclick=()=>$('openInput').click(); $('openInput').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; if(f) openProject(f); };
  $('helpBtn').onclick=()=>$('helpDlg').showModal(); $('helpClose').onclick=()=>$('helpDlg').close();
  $('exportBtn').onclick=()=>{ const ss=project.scenes.filter(s=>s.take); if(!ss.length){ toast('Record a scene first.'); return; } const skipped=project.scenes.length-ss.length; $('expInfo').textContent=`${ss.length} scene${ss.length>1?'s':''}, ${fmt(ss.reduce((a,s)=>a+s.take.dur,0))} long.`+(skipped?` ${skipped} scene${skipped>1?'s have':' has'} no recording and will be skipped.`:''); $('expSetup').hidden=false; $('expRun').hidden=true; $('expDone').hidden=true; $('exportDlg').showModal(); };
  $('expCancel').onclick=$('expClose').onclick=()=>{ $('expVideo').pause(); $('exportDlg').close(); }; $('expGo').onclick=runExport;
  window.addEventListener('keydown',e=>{
    const tag=e.target.tagName; if(tag==='INPUT'&&e.target.type!=='range'&&e.target.type!=='checkbox'||tag==='SELECT'||document.querySelector('dialog[open]')) return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; } if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); return; } if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){ e.preventDefault(); saveProject(); return; } if(e.ctrlKey||e.metaKey) return;
    if(e.key==='Escape'){ if(mode==='rec') stopRecording(); if(mode==='play') stopPlay(); return; }
    if(mode==='setup'&&(e.key==='r'||e.key==='R')){ startRecording(false); return; }
    if(mode!=='setup'&&mode!=='rec') return;
    if(e.key==='Tab'&&document.activeElement===cv){ const it=cur().items; if(it.length){ e.preventDefault(); const i=it.findIndex(x=>x.id===selId); selId=it[(i+(e.shiftKey?-1:1)+it.length)%it.length].id; updateItemBar(); } return; }
    const it=sel(); if(!it) return; const st=e.shiftKey?40:10; let done=true; const once=()=>{ if(mode==='setup'&&!e.repeat) checkpoint(); return target(it); };
    switch(e.key){ case 'ArrowLeft': once().x-=st; break; case 'ArrowRight': once().x+=st; break; case 'ArrowUp': once().y-=st; break; case 'ArrowDown': once().y+=st; break; case '[': once().s*=.94; break; case ']': once().s*=1.06; break; case ',': once().r-=.08; break; case '.': once().r+=.08; break; case 'f': case 'F': flip(); break; case 'Delete': case 'Backspace': if(mode==='setup') removeSel(); break; default: done=false; }
    if(done){ e.preventDefault(); const p=mode==='rec'?live.get(it.id):it; if(p) clampPose(p); dirtyIf(); }
  });
  window.addEventListener('beforeunload',()=>{ clearTimeout(saveT); });
}

/* ---------- start ---------- */
(async()=>{
  project=newProject(); curId=project.scenes[0].id; wire(); resize(); refreshAll(); rafId=requestAnimationFrame(tick);
  window.CutoutApp={get project(){ return project; },get mode(){ return mode; },get playing(){ return playing&&{id:playing.scene.id,t:playing.t,ended:playing.ended}; },get queue(){ return playQueue.length; },poseAt};
  const saved=await loadAuto();
  if(saved&&(saved.cast?.length||saved.scenes?.some(s=>s.take||s.items?.length))){
    const when=saved.savedAt?new Date(saved.savedAt).toLocaleString():'earlier';
    const v=await ask('Carry on with “'+saved.name+'”?','Last worked on '+when+'. Starting new clears it from this device.',[['Start new',0],['Carry on',1,'primary']]);
    if(v){ await adopt(saved); refreshAll(); } else autosave();
  }
})();
})();
