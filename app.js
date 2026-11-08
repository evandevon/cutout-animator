'use strict';
/* Cutout Animator
   A recording is stored as movement data plus audio clips rather than as video:
     scene.take = { dur, tracks:{itemId:[[t,x,y,s,r,flip,tilt],…]}, voices:[{assetId,t}], fx:[{t,ref}] }
   That keeps a finished scene editable, keeps toolbars out of the picture, works on iPads
   (which can't capture the screen from a web page), and lets export render every frame exactly. */
(() => {
const $=id=>document.getElementById(id);
const W=1280,H=720,MX=300,MY=90,VW=W+MX*2,VH=H+MY*2;
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
const blankScene=n=>({id:uid(),pads:[],name:'Scene '+n,backdrop:{type:'preset',id:'sky'},ambience:null,music:null,items:[],take:null});
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
  const it={id:uid(),assetId:a.id,x:W/2+[0,-300,300,-150,150][n%5],y:H*.58+((n%3)-1)*30,s:k,r:0,flip:false,anim:(project.scenes.flatMap(q=>q.items).find(i=>i.assetId===a.id&&i.anim)||{}).anim||null,fixed:!!(project.scenes.flatMap(q=>q.items).find(i=>i.assetId===a.id)||{}).fixed}; s.items.push(it); selId=it.id; return it; }

/* ---------- drawing ---------- */
function drawBackdrop(c,b){
  if(b.type==='color'){ c.fillStyle=b.color; c.fillRect(0,0,W,H); return; }
  if(b.type==='asset'){ const a=project.assets[b.id], im=a&&imgs.get(a.id); if(im){ const k=Math.max(W/im.naturalWidth,H/im.naturalHeight), w=im.naturalWidth*k, h=im.naturalHeight*k; c.drawImage(im,(W-w)/2,(H-h)/2,w,h); return; } c.fillStyle='#ddd'; c.fillRect(0,0,W,H); return; }
  const p=PRESETS[b.id]||PRESETS.sky, g=c.createLinearGradient(0,0,0,H); g.addColorStop(0,p.stops[0]); g.addColorStop(1,p.stops[1]); c.fillStyle=g; c.fillRect(0,0,W,H);
  if(p.stars){ c.fillStyle='#fff'; for(let i=0;i<70;i++){ const x=(i*347)%W,y=(i*193)%(H*.7); c.fillRect(x,y,i%5?2:4,i%5?2:4); } c.beginPath(); c.arc(1050,120,50,0,7); c.fillStyle='#fdf6c9'; c.fill(); }
  if(p.ground){ const y=H*(p.high?.5:.8); c.fillStyle=p.ground; c.beginPath(); c.moveTo(0,y); for(let x=0;x<=W;x+=40) c.lineTo(x,y+Math.sin(x/170)*16+Math.sin(x/61)*5); c.lineTo(W,H); c.lineTo(0,H); c.closePath(); c.fill(); }
}
/* Alive cutouts sway as a pure function of time, so preview, recording, playback and export all match,
   and the setting can be changed after recording. */
function animAt(it,h,t){ let n=0; for(const ch of it.id) n=(n*31+ch.charCodeAt(0))%9973; const f=n/9973*6.283,a=clamp(h/300,.4,1.6),none={x:0,y:0,r:0,s:1};
  switch(it.anim){
    case 'sway': return {x:0,y:0,r:.028*Math.sin(.61*t+f)+.009*Math.sin(1.47*t+4*f),s:1,sy:1+.016*Math.sin(1.7*t+2*f),feet:true}; // rocks and breathes from the feet, which barely move
    case 'hop': return {x:0,y:-a*34*Math.abs(Math.sin(2.8*t+f)),r:.04*Math.sin(2.8*t+f),s:1};
    case 'float': return {x:a*7*Math.sin(.6*t+f),y:a*14*Math.sin(1.15*t+f),r:.06*Math.sin(.9*t+2*f),s:1};
    case 'spin': return {x:0,y:0,r:1.5*t,s:1};
    default: return none; } }
/* ---------- transforms: one matrix per cutout, so a cutout stuck to another follows it ----------
   A stuck cutout's x, y, s and r are measured in its master's own picture, not on the stage. */
const I6=[1,0,0,1,0,0];
const mmul=(m,n)=>[m[0]*n[0]+m[2]*n[1],m[1]*n[0]+m[3]*n[1],m[0]*n[2]+m[2]*n[3],m[1]*n[2]+m[3]*n[3],m[0]*n[4]+m[2]*n[5]+m[4],m[1]*n[4]+m[3]*n[5]+m[5]];
const mT=(x,y)=>[1,0,0,1,x,y],mR=t=>{ const c=Math.cos(t),s=Math.sin(t); return [c,s,-s,c,0,0]; },mS=(x,y)=>[x,0,0,y,0,0];
const minv=m=>{ const d=(m[0]*m[3]-m[1]*m[2])||1e-9; return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d]; };
const mapp=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const mlin=(m,x,y)=>[m[0]*x+m[2]*y,m[1]*x+m[3]*y];
const mdet=m=>m[0]*m[3]-m[1]*m[2];
function mdecomp(m){ const s=Math.hypot(m[2],m[3]),r=Math.atan2(-m[2],m[3]); return {x:m[4],y:m[5],s,r,flip:(m[0]*Math.cos(r)+m[1]*Math.sin(r))<0}; }
const ANIM0={x:0,y:0,r:0,s:1};
function localMat(it,p,im,t){ const h0=im?im.naturalHeight:0,fl=p.flip?-1:1,v=t==null?ANIM0:animAt(it,h0*p.s,t);
  if(v.feet) return [mT(p.x,p.y),mR(p.r+(p.tilt||0)),mS(fl*p.s,p.s),mT(0,h0/2),mR(v.r),mS(1,v.sy),mT(0,-h0/2)].reduce(mmul);
  return [mT(p.x+v.x,p.y+v.y),mR(p.r+(p.tilt||0)+v.r),mS(fl*p.s*v.s,p.s*v.s)].reduce(mmul); }
function sceneMats(scene,poseOf,t,anim=true){ const by=new Map(scene.items.map(i=>[i.id,i])),out=new Map();
  const get=(it,depth)=>{ let r=out.get(it.id); if(r) return r; const im=imgs.get(it.assetId),p=poseOf(it),par=it.link&&depth<16?by.get(it.link):null,P=par?get(par,depth+1).m:I6;
    r={it,p,P,im,m:mmul(P,localMat(it,p,im,anim?t:null))}; out.set(it.id,r); return r; };
  for(const it of scene.items) get(it,0); return out; }
function drawWith(c,e){ if(!e||!e.im) return; const m=e.m,w=e.im.naturalWidth,h=e.im.naturalHeight; c.save(); c.transform(m[0],m[1],m[2],m[3],m[4],m[5]); c.drawImage(e.im,-w/2,-h/2,w,h); c.restore(); }
function cornersOf(e){ if(!e||!e.im) return null; const w=e.im.naturalWidth/2,h=e.im.naturalHeight/2,A=(x,y)=>mapp(e.m,x,y); return {tl:A(-w,-h),tr:A(w,-h),br:A(w,h),bl:A(-w,h)}; }
function drawScene(c,scene,poseOf,t=0,mats){ mats=mats||sceneMats(scene,poseOf,t); c.save(); c.beginPath(); c.rect(0,0,W,H); c.clip(); drawBackdrop(c,scene.backdrop); for(const it of scene.items) drawWith(c,mats.get(it.id)); c.restore(); }
const loopOn=it=>!!(it.loop&&it.loop.on);
function loopPose(it,t){ if(!loopOn(it)) return it; const F=it.loop.frames,D=it.loop.dur,T=((t%D)+D)%D; let a=0,b=F.length-1; while(b-a>1){ const m=(a+b)>>1; if(F[m][0]<=T) a=m; else b=m; } const A=F[a],B=F[b],k=clamp((T-A[0])/((B[0]-A[0])||1),0,1),L=i=>A[i]+(B[i]-A[i])*k;
  return {x:it.x+L(1),y:it.y+L(2),s:it.s*L(3),r:it.r+L(4),flip:it.flip,tilt:0}; }
function poseAt(it,take,t){
  const f=take&&take.tracks[it.id]; if(!f||!f.length||t<f[0][0]) return loopPose(it,t);
  const l=f[f.length-1]; if(t>=l[0]) return {x:l[1],y:l[2],s:l[3],r:l[4],flip:!!l[5],tilt:l[6]};
  let a=0,b=f.length-1; while(b-a>1){ const m=(a+b)>>1; if(f[m][0]<=t) a=m; else b=m; }
  const A=f[a],B=f[b],k=(t-A[0])/((B[0]-A[0])||1),L=i=>A[i]+(B[i]-A[i])*k;
  return {x:L(1),y:L(2),s:L(3),r:L(4),flip:!!A[5],tilt:L(6)};
}

const cv=$('stage'),ctx=cv.getContext('2d'); let vs=1,dpr=1;
function resize(){ const wr=$('stageWrap'),cs=getComputedStyle(wr),b={width:wr.clientWidth,height:wr.clientHeight-parseFloat(cs.paddingTop)}; if(!b.width||b.height<=0) return; dpr=Math.min(2.5,devicePixelRatio||1); const k=Math.min(b.width/VW,b.height/VH),cw=Math.floor(VW*k),ch=Math.floor(VH*k);
  cv.style.width=cw+'px'; cv.style.height=ch+'px'; cv.width=Math.floor(cw*dpr); cv.height=Math.floor(ch*dpr); vs=cv.width/VW; }
new ResizeObserver(resize).observe($('stageWrap'));
function poseNow(it){ if(mode==='rec') return live.get(it.id)||it; if(mode==='play'&&playing) return poseAt(it,playing.scene.take,playing.t); if(mode==='setup'&&it.id!==selId&&loopOn(it)) return loopPose(it,performance.now()/1000); return it; }
function nowT(){ const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches; return mode==='rec'&&rec?recTime():playing?playing.t:reduce?0:performance.now()/1000; }
function matsNow(){ return sceneMats(playing?playing.scene:cur(),poseNow,nowT()); }
const centreOf=e=>mapp(e.m,0,0);
function render(){
  const scene=playing?playing.scene:cur(),px=1/vs*dpr;
  ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='#2d2730'; ctx.fillRect(0,0,cv.width,cv.height);
  ctx.setTransform(vs,0,0,vs,MX*vs,MY*vs); ctx.imageSmoothingQuality='high';
  if(mode!=='play'){ ctx.fillStyle='#ffffff38'; ctx.font='800 26px "Nunito",sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText('OFF STAGE',-MX/2,-MY+14); ctx.fillText('OFF STAGE',W+MX/2,-MY+14); }
  const T=nowT(),mats=sceneMats(scene,poseNow,T);
  drawScene(ctx,scene,poseNow,T,mats);
  // Off-stage "wings": cutouts stay visible here for the performer, but the video crops them out.
  ctx.save(); ctx.globalAlpha=.55; for(const it of scene.items){ const e=mats.get(it.id),c=cornersOf(e); if(!c) continue; const xs=[c.tl[0],c.tr[0],c.br[0],c.bl[0]],ys=[c.tl[1],c.tr[1],c.br[1],c.bl[1]];
    if(Math.min(...xs)<0||Math.max(...xs)>W||Math.min(...ys)<0||Math.max(...ys)>H){ ctx.save(); ctx.beginPath(); ctx.rect(-MX,-MY,VW,VH); ctx.rect(0,0,W,H); ctx.clip('evenodd'); drawWith(ctx,e); ctx.restore(); } } ctx.restore();
  ctx.strokeStyle=mode==='rec'?'#ff4a33':'#fff'; ctx.lineWidth=(mode==='rec'?5:2)/vs*dpr; ctx.strokeRect(0,0,W,H);
  const badge=(x,y,ch,fill)=>{ ctx.beginPath(); ctx.arc(x,y,15*px,0,7); ctx.fillStyle=fill||'#fffaf0'; ctx.fill(); ctx.lineWidth=2*px; ctx.strokeStyle='#2a2320'; ctx.stroke(); ctx.fillStyle='#2a2320'; ctx.fillText(ch,x,y+1*px); };
  if(mode==='setup'){ ctx.font=`${Math.round(20*px)}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    for(const s of scene.items){ if(!s.fixed) continue; const c=cornersOf(mats.get(s.id)); if(!c) continue; badge(Math.min(c.tl[0],c.tr[0],c.br[0],c.bl[0])+14*px,Math.min(c.tl[1],c.tr[1],c.br[1],c.bl[1])+14*px,'📌'); }
    // links: shown only for the selected cutout and whatever it is stuck to, to keep the stage tidy
    for(const s of scene.items){ if(!s.link||(s.id!==selId&&s.link!==selId)) continue; const e=mats.get(s.id),f=mats.get(s.link); if(!e||!f) continue; const a=centreOf(e),b=centreOf(f);
      ctx.setLineDash([10*px,7*px]); ctx.lineWidth=4*px; ctx.strokeStyle='#2a2320'; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); ctx.lineWidth=2*px; ctx.strokeStyle='#ffe08a'; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(a[0],a[1],7*px,0,7); ctx.fillStyle='#ffe08a'; ctx.fill(); ctx.stroke(); }
    if(linkPick){ ctx.font=`${Math.round(24*px)}px sans-serif`; for(const o of linkCands()){ const e=mats.get(o.id); if(!e) continue; const [x,y]=centreOf(e); ctx.beginPath(); ctx.arc(x,y,28*px,0,7); ctx.fillStyle='#ffe08a'; ctx.fill(); ctx.lineWidth=3*px; ctx.strokeStyle='#2a2320'; ctx.stroke(); ctx.fillStyle='#2a2320'; ctx.fillText('🔗',x,y+1*px); } } }
  if((mode==='setup'||mode==='rec'||mode==='count')&&!linkPick){ ctx.font=`${Math.round(22*px)}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; const held=new Set([...grabs.values()].filter(g=>g.group).map(g=>g.id));
    for(const s of scene.items){ if(!scene.items.some(o=>o.link===s.id)) continue; const e=mats.get(s.id); if(!e) continue; const [x,y]=centreOf(e),on=held.has(s.id); ctx.beginPath(); ctx.arc(x,y,(on?26:22)*px,0,7); ctx.fillStyle=on?'#fff3c4':'#ffe08aee'; ctx.fill(); ctx.lineWidth=3*px; ctx.strokeStyle='#2a2320'; ctx.stroke(); ctx.fillStyle='#2a2320'; ctx.fillText('🔗',x,y+1*px); } }
  const it=sel();
  if(it&&mode!=='play'){ const c=cornersOf(mats.get(it.id)); if(c){ ctx.setLineDash([8*px,6*px]); ctx.lineWidth=2*px; ctx.strokeStyle='#fff'; ctx.beginPath(); ctx.moveTo(...c.tl); ctx.lineTo(...c.tr); ctx.lineTo(...c.br); ctx.lineTo(...c.bl); ctx.closePath(); ctx.stroke(); ctx.strokeStyle='#000'; ctx.lineDashOffset=8*px; ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset=0;
      if(!linkPick){ ctx.beginPath(); ctx.arc(c.tr[0],c.tr[1],13*px,0,7); ctx.fillStyle='#0b6e6e'; ctx.fill(); ctx.lineWidth=2.5*px; ctx.strokeStyle='#fff'; ctx.stroke(); } } }
}

/* ---------- pointer control: every finger moves its own cutout ---------- */
const live=new Map(); let rec=null; const grabs=new Map();
const world=e=>{ const r=cv.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*VW-MX,(e.clientY-r.top)/r.height*VH-MY]; };
/* Scenery can't be grabbed while recording, so taps go through to the cutouts behind it.
   While setting up, movable cutouts are picked first and scenery only if nothing else is there. */
let hitGroup=false;
function hit(x,y){ hitGroup=false; const mats=matsNow(); return hitAny(x,y,false,mats)||(mode==='setup'?hitAny(x,y,true,mats):null); }
function pixelHit(e,x,y){ if(!e||!e.im) return false; const [lx,ly]=mapp(minv(e.m),x,y),w=e.im.naturalWidth,h=e.im.naturalHeight,pad=10/Math.max(.01,Math.hypot(e.m[2],e.m[3]));
  if(Math.abs(lx)>w/2+pad||Math.abs(ly)>h/2+pad) return false; const hm=hitMaps.get(e.it.assetId); if(!hm) return true;
  const u=(lx/w+.5)*hm.w|0,v=(ly/h+.5)*hm.h|0; for(let b=-2;b<=2;b++)for(let a=-2;a<=2;a++){ const X=u+a,Y=v+b; if(X>=0&&Y>=0&&X<hm.w&&Y<hm.h&&hm.d[(Y*hm.w+X)*4+3]>40) return true; } return false; }
function movableMaster(it){ let p=it,n=0; while(p&&p.link&&n++<16){ p=cur().items.find(i=>i.id===p.link); if(p&&!p.fixed) return p; } return null; }
function hitAny(x,y,scenery,mats){
  const items=cur().items; for(let i=items.length-1;i>=0;i--){ const it=items[i]; if(!pixelHit(mats.get(it.id),x,y)) continue;
    if(scenery){ if(it.fixed) return it; continue; }
    if(!it.fixed) return it;
    if(mode==='rec'){ const m=movableMaster(it); if(m){ hitGroup=true; return m; } } } // a pinned cutout stuck to another hands the tap to its master
  return null;
}
function target(it){ if(mode==='rec'){ touchRec(it); return live.get(it.id); } return it; }
function touchRec(it){ if(rec&&rec.layer&&!rec.over[it.id]) rec.over[it.id]=recTime(); }
function parentMat(it){ if(!it.link) return I6; const e=matsNow().get(it.id); return e?e.P:I6; }
function centreW(it,p){ return mapp(parentMat(it),p.x,p.y); }
function placeCentre(it,p,wx,wy){ const [x,y]=mapp(minv(parentMat(it)),wx,wy); p.x=x; p.y=y; }
const turnSign=it=>mdet(parentMat(it))<0?-1:1;
/* Moving a master on its own: the cutouts stuck to it stay where they are on the stage.
   (Grab the 🔗 circle in its middle to take them along.) */
function keepKids(it,change){ const sc=cur(),kids=sc.items.filter(o=>o.link===it.id); if(!kids.length){ change(); return; }
  const before=sceneMats(sc,poseNow,0,false),Wk=kids.map(k=>before.get(k.id).m); change();
  const e=sceneMats(sc,poseNow,0,false).get(it.id); if(!e) return; const Pi=minv(e.m);
  kids.forEach((k,i)=>{ if([...grabs.values()].some(g=>g.id===k.id)) return; const q=target(k),d=mdecomp(mmul(Pi,Wk[i])); q.x=d.x; q.y=d.y; q.s=d.s; q.r=d.r-(q.tilt||0); q.flip=d.flip; }); }
const hasKids=it=>cur().items.some(o=>o.link===it.id);
function chainAt(x,y,touch){ if(mode!=='setup'&&mode!=='rec') return null; const mats=matsNow(),items=cur().items,R=(touch?34:26)/vs*dpr; for(let i=items.length-1;i>=0;i--){ const it=items[i]; if(!hasKids(it)) continue; const e=mats.get(it.id); if(!e) continue; const [cx,cy]=centreOf(e); if(Math.hypot(x-cx,y-cy)<R) return it; } return null; }
const groupGrab=id=>[...grabs.values()].some(g=>g.id===id&&g.group);
function clampFor(it,p){ if(it.link) p.s=clamp(p.s,.005,60); else clampPose(p); }
function clampPose(p){ p.x=clamp(p.x,-MX+20,W+MX-20); p.y=clamp(p.y,-MY+20,H+MY-20); p.s=clamp(p.s,.03,8); }
let setupMoved=false,teach=null,linkPick=null;
const nameOf=it=>(project.assets[it.assetId]||{}).name||'it';
function isAbove(anc,o){ let p=o,n=0; const sc=cur(); while(p&&p.link&&n++<16){ if(p.link===anc.id) return true; p=sc.items.find(i=>i.id===p.link); } return false; } // is o stuck (directly or not) to anc?
const linkCands=()=>{ const it=cur().items.find(i=>i.id===(linkPick&&linkPick.id)); return it?cur().items.filter(o=>o.id!==it.id&&!isAbove(it,o)):[]; };
function showHint(t){ $('teachHint').textContent=t; $('teachHint').hidden=!t; }
function linkCancel(){ linkPick=null; showHint(''); }
function linkStart(){ const it=sel(); if(!it||mode!=='setup') return; if(teach){ teach=null; }
  if(it.link){ checkpoint(); relink(cur(),it,null); updateItemBar(); dirty(); toast('Unstuck. '+nameOf(it)+' moves on its own again.',2200); return; }
  if(linkPick){ linkCancel(); return; } linkPick={id:it.id}; if(!linkCands().length){ linkCancel(); toast('Add another cutout first, so this one has something to stick to.'); return; }
  showHint('Tap what '+nameOf(it)+' should stick to'); }
function pickLink(x,y){ const child=cur().items.find(i=>i.id===linkPick.id),mats=matsNow(),cands=linkCands(); let best=null,bd=40/vs*dpr;
  for(const o of cands){ const e=mats.get(o.id); if(!e) continue; const [cx,cy]=centreOf(e),d=Math.hypot(x-cx,y-cy); if(d<bd){ bd=d; best=o; } }
  if(!best) for(let i=cur().items.length-1;i>=0;i--){ const o=cur().items[i]; if(cands.includes(o)&&pixelHit(mats.get(o.id),x,y)){ best=o; break; } }
  linkCancel(); if(!best||!child) return; checkpoint(); relink(cur(),child,best.id); selId=child.id; updateItemBar(); dirty();
  toast(nameOf(child)+' is stuck to '+nameOf(best)+'. Drag the 🔗 in the middle of '+nameOf(best)+' to move them together.',3600); }
/* Change what a cutout is stuck to without it jumping: its pose, recorded movement and taught move are
   converted from the old master's space to the new one's. */
function relink(scene,it,to){
  const base=sceneMats(scene,i=>i,0,false),oldP=base.get(it.id).P,newP=to?base.get(to).m:I6,im=imgs.get(it.assetId),conv=(P0,P1,q)=>{ const w=mmul(P0,localMat(it,{...q,tilt:0},im,null)),d=mdecomp(mmul(minv(P1),w)); return {x:d.x,y:d.y,s:d.s,r:d.r,flip:d.flip}; };
  Object.assign(it,conv(oldP,newP,it));
  if(it.loop&&it.loop.frames){ const flipR=Math.sign(mdet(oldP))*Math.sign(mdet(newP)),L=mmul(minv(newP),oldP); it.loop.frames=it.loop.frames.map(f=>{ const [dx,dy]=mlin(L,f[1],f[2]); return [f[0],r3(dx),r3(dy),f[3],r3(f[4]*flipR)]; }); }
  const tr=scene.take&&scene.take.tracks[it.id];
  if(tr) scene.take.tracks[it.id]=tr.map(f=>{ const ms=sceneMats(scene,i=>poseAt(i,scene.take,f[0]),f[0],false),P0=ms.get(it.id).P,P1=to?ms.get(to).m:I6,q=conv(P0,P1,{x:f[1],y:f[2],s:f[3],r:f[4],flip:!!f[5]}); return [f[0],r3(q.x),r3(q.y),r3(q.s),r3(q.r),q.flip?1:0,f[6]]; });
  if(to) it.link=to; else delete it.link;
}
function unstickFrom(scene,ids){ for(const o of scene.items) if(o.link&&ids.includes(o.link)&&!ids.includes(o.id)){ const m=scene.items.find(i=>i.id===o.link); relink(scene,o,m&&m.link&&!ids.includes(m.link)?m.link:null); } }
function teachStart(){ const it=sel(); if(!it) return; linkCancel(); if(teach){ teach=null; showHint(''); return; } teach={id:it.id,active:false}; showHint('Drag it the way it should move, then let go'); }
function teachTick(now){ if(!teach||!teach.active) return; const it=cur().items.find(i=>i.id===teach.id); if(!it) return; const t=(now-teach.t0)/1000; if(t-teach.lastT<1/30) return; teach.lastT=t; const s=teach.start; teach.frames.push([r3(t),r3(it.x-s.x),r3(it.y-s.y),r3(it.s/s.s),r3(it.r-s.r)]); }
function teachEnd(){ const it=cur().items.find(i=>i.id===teach.id),T=teach; teach=null; $('teachHint').hidden=true; if(!it) return; const s=T.start,F=T.frames; const far=F.reduce((a,f)=>Math.max(a,Math.hypot(f[1],f[2])),0),last=F[F.length-1];
  Object.assign(it,{x:s.x,y:s.y,s:s.s,r:s.r});
  if(!last||last[0]<.25||(far<12&&!F.some(f=>Math.abs(f[3]-1)>.05||Math.abs(f[4])>.1))){ toast('Drag it further to teach a move.'); return; }
  const backT=Math.min(1,.25+Math.hypot(last[1],last[2])/500),dur=r3(last[0]+backT); it.loop={on:true,dur,frames:[[0,0,0,1,0],...F,[dur,0,0,1,0]]}; selId=null; updateItemBar(); dirty(); toast('It will repeat that move. Press Record when you are ready.'); }
function beforeMove(){ if(mode==='setup'&&!setupMoved){ setupMoved=true; checkpoint(); } }
let lastTap={t:0,id:null};
function rebase(id){ // when fingers join or leave a cutout, restart the gesture from its present pose
  const pts=[...grabs.values()].filter(g=>g.id===id), it=cur().items.find(i=>i.id===id); if(!it) return; const p=poseNow(it),[cx,cy]=centreW(it,p);
  if(pts.length===1&&pts[0].kind==='drag'){ pts[0].ox=cx-pts[0].x; pts[0].oy=cy-pts[0].y; }
  if(pts.length>=2){ const [a,b]=pts; it.__g={d:Math.hypot(a.x-b.x,a.y-b.y)||1,a:Math.atan2(b.y-a.y,b.x-a.x),s:p.s,r:p.r,cx,cy,mx:(a.x+b.x)/2,my:(a.y+b.y)/2}; }
}
cv.addEventListener('pointerdown',e=>{
  if(mode==='play'||mode==='count'){ return; } e.preventDefault(); cv.focus({preventScroll:true}); try{ cv.setPointerCapture(e.pointerId); }catch(_){}
  const [x,y]=world(e); setupMoved=false;
  if(linkPick){ pickLink(x,y); return; }
  const s=sel(); if(s&&!grabs.size&&!teach){ const c=cornersOf(matsNow().get(s.id)); if(c&&Math.hypot(x-c.tr[0],y-c.tr[1])<(e.pointerType==='touch'?34:24)/vs*dpr){ const p=poseNow(s),[cx,cy]=centreW(s,p); grabs.set(e.pointerId,{id:s.id,kind:'handle',x,y,d0:Math.hypot(x-cx,y-cy)||1,a0:Math.atan2(y-cy,x-cx),s0:p.s,r0:p.r,moved:true}); return; } }
  const ch=!teach&&chainAt(x,y,e.pointerType==='touch');
  if(ch){ selId=ch.id; updateItemBar(); grabs.set(e.pointerId,{id:ch.id,kind:'drag',group:true,x,y,sx:x,sy:y,t:performance.now(),moved:false,ox:0,oy:0}); rebase(ch.id); return; }
  let it=hit(x,y);
  if(!it&&mode==='setup'&&grabs.size===1){ const g=[...grabs.values()][0]; it=cur().items.find(i=>i.id===g.id)||null; }
  if(!it){ if(!grabs.size){ selId=null; updateItemBar(); } return; }
  if(teach&&it.id!==teach.id) return;
  selId=it.id; updateItemBar(); if(teach&&!teach.active&&mode==='setup'){ checkpoint(); setupMoved=true; Object.assign(teach,{active:true,t0:performance.now(),lastT:-1,frames:[],start:{x:it.x,y:it.y,s:it.s,r:it.r}}); }
  grabs.set(e.pointerId,{id:it.id,kind:'drag',group:hitGroup,x,y,sx:x,sy:y,t:performance.now(),moved:false,ox:0,oy:0}); rebase(it.id);
});
cv.addEventListener('pointermove',e=>{
  const g=grabs.get(e.pointerId); if(!g) return; e.preventDefault(); const [x,y]=world(e); g.x=x; g.y=y;
  const it=cur().items.find(i=>i.id===g.id); if(!it) return;
  if(g.kind==='handle'){ beforeMove(); keepKids(it,()=>{ const p=target(it),[cx,cy]=centreW(it,p); p.s=g.s0*Math.hypot(x-cx,y-cy)/g.d0; p.r=g.r0+(Math.atan2(y-cy,x-cx)-g.a0)*turnSign(it); clampFor(it,p); }); dirtyIf(); return; }
  if(!g.moved&&Math.hypot(x-g.sx,y-g.sy)>4) g.moved=true; if(!g.moved) return;
  const pts=[...grabs.values()].filter(q=>q.id===g.id); beforeMove();
  const move=()=>{ const p=target(it);
    if(pts.length>=2&&it.__g){ const [a,b]=pts,G=it.__g; p.s=G.s*Math.hypot(a.x-b.x,a.y-b.y)/G.d; p.r=G.r+(Math.atan2(b.y-a.y,b.x-a.x)-G.a)*turnSign(it); placeCentre(it,p,G.cx+(a.x+b.x)/2-G.mx,G.cy+(a.y+b.y)/2-G.my); }
    else placeCentre(it,p,x+g.ox,y+g.oy);
    clampFor(it,p); };
  if(groupGrab(it.id)) move(); else keepKids(it,move); dirtyIf();
});
function dirtyIf(){ if(mode==='setup') dirty(); }
function endPtr(e){
  const g=grabs.get(e.pointerId); if(!g) return; grabs.delete(e.pointerId); rebase(g.id); if(teach&&teach.active&&teach.id===g.id&&![...grabs.values()].some(q=>q.id===g.id)){ teachEnd(); return; }
  if(g.kind==='drag'&&!g.moved&&performance.now()-g.t<320){ const n=performance.now(); if(lastTap.id===g.id&&n-lastTap.t<340){ flip(); lastTap={t:0,id:null}; } else lastTap={t:n,id:g.id}; }
}
cv.addEventListener('pointerup',endPtr); cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('wheel',e=>{ if(mode==='play'||mode==='count') return; const [x,y]=world(e),it=hit(x,y)||sel(); if(!it) return; e.preventDefault(); selId=it.id; updateItemBar(); if(mode==='setup'&&!cv.__wheel){ checkpoint(); cv.__wheel=setTimeout(()=>cv.__wheel=0,500); } keepKids(it,()=>{ const p=target(it); if(e.shiftKey) p.r+=e.deltaY*.0025; else p.s=clamp(p.s*Math.exp(-e.deltaY*.0012),.005,60); }); dirtyIf(); },{passive:false});

function flip(){ const it=sel(); if(!it) return; if(mode==='setup') checkpoint(); keepKids(it,()=>{ const p=target(it); p.flip=!p.flip; }); dirtyIf(); }

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
  if(voiceWanted){ await micOn(); micOK=!!Sound.mic.stream; if(!micOK) toast("The microphone isn't available, so this recording has no voice."); }
  mode='count'; setLive(true); $('countdown').hidden=false;
  const buf=await preload(scene); for(const r of scenePads(scene)) Sound.buffer(r,project.assets).catch(()=>{});
  for(const n of [3,2,1]){ $('countdown').textContent=n; await new Promise(r=>setTimeout(r,700)); }
  $('countdown').hidden=true; beginTake(scene,layer,buf);
}
function beginTake(scene,layer,buf){
  const c=Sound.audioCtx(); live.clear();
  for(const it of scene.items){ const p=layer?poseAt(it,scene.take,0):it; live.set(it.id,{x:p.x,y:p.y,s:p.s,r:p.r,flip:!!p.flip,tilt:p.tilt||0}); }
  const t0=c.currentTime+.04;
  rec={scene,layer:!!layer,t0,tracks:{},last:{},over:{},loopS:{},fx:[],prevT:0,lastPush:{},vel:{}};
  for(const [id,p] of live) rec.last[id]={...p};
  stopAudio=Sound.schedule(c,Sound.master(c),scene,t0,buf,mixNow(),{dur:Infinity,withTake:!!layer});
  if(micOK) Sound.micCollect();
  mode='rec'; $('nextSceneBtn').hidden=!nextOpen();
}
const nextOpen=()=>{ const i=project.scenes.indexOf(cur()),n=project.scenes[i+1]; return !!(n&&!n.take)&&!rec?.layer; };
function sample(t,dt){
  for(const it of rec.scene.items){
    const p=live.get(it.id); if(!p) continue; const id=it.id;
    if(rec.layer&&!rec.over[id]&&(rec.scene.take.tracks[id]||!loopOn(it))){ const q=poseAt(it,rec.scene.take,t); Object.assign(p,{x:q.x,y:q.y,s:q.s,r:q.r,flip:!!q.flip,tilt:q.tilt||0}); rec.last[id]={...p}; rec.prevT=t; continue; }
    if(loopOn(it)){ // the loop pauses while held, then glides back to where it was grabbed and carries on
      const st=rec.loopS[id]||(rec.loopS[id]={clock:t}), held=[...grabs.values()].some(g=>g.id===id);
      if(held){ if(!st.held){ st.held=true; st.back=st.glide?st.glide.to:{x:p.x,y:p.y,s:p.s,r:p.r}; st.glide=null; } }
      else if(st.held){ st.held=false; st.glide={t:0,from:{x:p.x,y:p.y,s:p.s,r:p.r},to:st.back}; }
      else if(st.glide){ st.glide.t+=dt/.5; const k=Math.min(1,st.glide.t),e=k*k*(3-2*k),A=st.glide.from,B=st.glide.to; p.x=A.x+(B.x-A.x)*e; p.y=A.y+(B.y-A.y)*e; p.s=A.s+(B.s-A.s)*e; p.r=A.r+(B.r-A.r)*e; if(k>=1) st.glide=null; }
      else { st.clock+=dt; const q=loopPose(it,st.clock); p.x=q.x; p.y=q.y; p.s=q.s; p.r=q.r; }
    }
    const l=rec.last[id];
    { const vx=(p.x-l.x)/Math.max(dt,.001), held=[...grabs.values()].some(g=>g.id===id)||loopOn(it), goal=held?clamp(vx*.00028,-.2,.2):0; p.tilt+=(goal-p.tilt)*Math.min(1,dt*11); if(Math.abs(p.tilt)<.001) p.tilt=0; }
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
function stopRecording(){ if(mode==='count') return; if(mode!=='rec') return; finishTake(); micOK=false; mode='setup'; setLive(false); refreshAll(); dirty(); toast('Recorded! Press Play to watch it.'); }
async function nextScene(){ if(mode!=='rec'||!nextOpen()) return; const i=project.scenes.indexOf(cur()); finishTake(); const n=project.scenes[i+1]; curId=n.id; selId=null; mode='count'; const buf=await preload(n); renderScenes(); showScript(); renderPads(); beginTake(n,false,buf); }
function showScript(){ const s=cur(),a=(mode==='rec'||mode==='count')&&s.script&&project.assets[s.script],v=$('scriptView'); v.hidden=!a; if(a){ if(!a.__u) a.__u=URL.createObjectURL(a.blob); $('scriptImg').src=a.__u; } }
function setLive(on){ document.body.classList.toggle('live',on); showScript(); renderPads(); $('transport').hidden=on; $('recBar').hidden=!on; $('stopBtn').querySelector('.sq').hidden=false; $('stopBtn').lastChild.textContent=' Stop'; $('timer').hidden=false; $('micLevelWrap').hidden=!micOK; $('nextSceneBtn').hidden=true; $('timer').textContent='0:00'; resize(); }

/* ---------- live microphone meter and picker ---------- */
function micPref(v){ try{ if(v===undefined) return localStorage.getItem('ca-mic')||''; localStorage.setItem('ca-mic',v); }catch(_){ return ''; } }
function paintMeter(){ const l=Sound.mic.stream?Sound.mic.level:0, pct=l>.002?clamp((20*Math.log10(l)+50)/50,0,1)*100:0; document.querySelectorAll('.micBar').forEach(b=>{ b.style.width=pct+'%'; b.classList.toggle('hot',l>.92); }); }
function micUI(msg){ const on=!!Sound.mic.stream,want=$('voiceOn').checked; $('micMeter').hidden=!on; $('micEnable').hidden=on||!want||!!msg; $('micMsg').hidden=!msg; $('micMsg').textContent=msg||''; if(!on) $('micSel').hidden=true; }
async function micList(){ if(!navigator.mediaDevices||!navigator.mediaDevices.enumerateDevices) return; const ds=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput'&&d.deviceId!=='default'&&d.deviceId!=='communications'), active=Sound.mic.stream&&Sound.mic.stream.getAudioTracks()[0]?.getSettings().deviceId;
  for(const s of [$('micSel'),$('sfxMicSel')]){ s.innerHTML=''; ds.forEach((d,i)=>{ const o=document.createElement('option'); o.value=d.deviceId; o.textContent=d.label||'Microphone '+(i+1); s.append(o); }); if(active&&ds.some(d=>d.deviceId===active)) s.value=active; }
  $('micSel').hidden=!Sound.mic.stream||ds.length<2; $('sfxMicWrap').hidden=!Sound.mic.stream||!ds.length; }
async function micOn(){ if(!$('voiceOn').checked) return; try{ await Sound.micStart(micPref()); micUI(); await micList(); }catch(e){ console.warn(e); micUI(e.name==='NotAllowedError'?'Microphone is blocked in the browser settings':"Can't find a microphone"); } }
async function micInit(){ let st='prompt'; try{ st=(await navigator.permissions.query({name:'microphone'})).state; }catch(_){} if(st==='granted') micOn(); else micUI(st==='denied'?'Microphone is blocked in the browser settings':''); }

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
  if(mode==='rec'&&rec){ const t=recTime(); if(t>=0){ sample(t,dt); $('timer').textContent=fmt(t); } }
  paintMeter(); teachTick(now);
  if(mode==='play'&&playing){ playing.t=Sound.audioCtx().currentTime-playing.t0; $('timer').textContent=fmt(playing.t); if(playing.t>=playing.scene.take.dur&&!playing.ended){ playing.ended=true; stopAudio=null; playNext(); } if(playing&&playing.ended) playing.t=playing.scene.take.dur; }
  render();
}

/* ---------- UI lists ---------- */
function thumbURL(a){ return a.__u||(a.__u=URL.createObjectURL(a.blob)); }
function renderCast(){ const box=$('castList'); box.innerHTML=''; for(const id of project.cast){ const a=project.assets[id]; if(!a) continue; const b=document.createElement('button'); b.className='thumb'; b.setAttribute('aria-label','Put '+(a.name||'cutout')+' on stage'); const im=new Image(); im.src=thumbURL(a); im.alt=''; b.append(im);
    const x=document.createElement('span'); x.className='x'; x.textContent='×'; x.setAttribute('role','button'); x.setAttribute('aria-label','Delete cutout'); x.onclick=async ev=>{ ev.stopPropagation(); const used=project.scenes.some(s=>s.items.some(i=>i.assetId===id)); if(used&&!await ask('Remove this cutout?','It will disappear from every scene that uses it.',[['Keep it',null],['Remove',1,'danger']])) return; checkpoint(); project.cast=project.cast.filter(c=>c!==id); project.scenes.forEach(s=>{ const gone=s.items.filter(i=>i.assetId===id).map(i=>i.id); unstickFrom(s,gone); s.items=s.items.filter(i=>i.assetId!==id); if(s.take) gone.forEach(g=>delete s.take.tracks[g]); }); selId=null; refreshAll(); dirty(); }; b.append(x);
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
const scenePads=(s=cur())=>(s.pads||[]).filter(r=>project.pads.includes(r));
function padName(r){ const a=project.assets[r.slice(6)]; return a?a.name:'?'; }
function renderPads(){ const box=$('padRow'); box.innerHTML=''; renderPadList(); scenePads().forEach((r,i)=>{ const b=document.createElement('button'); b.className='pad'; b.innerHTML=(i<9?`<kbd>${i+1}</kbd> `:'')+(isMine(r)?'🎤 ':'🔊 '); b.append(padName(r)); b.onpointerdown=e=>{ e.preventDefault(); hitPad(r); }; b.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); hitPad(r); } };
    if(mode==='setup'){ const x=document.createElement('span'); x.className='trash'; x.textContent='🗑'; x.setAttribute('role','button'); x.setAttribute('aria-label','Hide the '+padName(r)+' button on this scene'); x.onpointerdown=e=>{ e.stopPropagation(); e.preventDefault(); }; x.onclick=e=>{ e.stopPropagation(); checkpoint(); cur().pads=(cur().pads||[]).filter(q=>q!==r); renderPads(); dirty(); toast('Hidden on this scene. Tick it in the Sounds tab to bring it back.',2200); }; b.append(x); }
    box.append(b); }); box.hidden=!scenePads().length||mode==='play'; document.querySelectorAll('#sfxLib input').forEach(c=>{ c.checked=project.pads.includes(refForLib(c.value)); }); resize(); }
const refForLib=path=>{ const id=Object.keys(project.assets).find(k=>project.assets[k].libPath===path); return id?'asset:'+id:''; };
const isMine=r=>{ const a=project.assets[r.slice(6)]; return !!(a&&a.mine); };
function renderPadList(){ const box=$('padList'); if(!box) return; box.innerHTML=''; $('padListHead').hidden=!project.pads.length; const on=cur().pads||[];
  project.pads.forEach(r=>{ const row=document.createElement('div'); row.className='padItem'; const l=document.createElement('label'); l.className='check'; const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=on.includes(r); cb.setAttribute('aria-label','Show '+padName(r)+' as a button on this scene'); cb.onchange=()=>{ checkpoint(); const s=cur(); s.pads=(s.pads||[]).filter(x=>x!==r); if(cb.checked) s.pads.push(r); renderPads(); dirty(); };
    const n=document.createElement('span'); n.textContent=(isMine(r)?'🎤 ':'🔊 ')+padName(r); l.append(cb,n);
    const pl=document.createElement('button'); pl.className='small'; pl.textContent='▶'; pl.setAttribute('aria-label','Play '+padName(r)); pl.onclick=()=>hitPad(r);
    const ed=document.createElement('button'); ed.className='small'; ed.textContent='✏️'; ed.setAttribute('aria-label','Rename or trim '+padName(r)); ed.onclick=()=>sfxEdit(r);
    const d=document.createElement('button'); d.className='small'; d.textContent='🗑'; d.setAttribute('aria-label','Delete '+padName(r)); d.onclick=()=>{ checkpoint(); dropSound(r); renderPads(); dirty(); toast('Deleted. Undo brings it back.',1800); };
    row.append(l,pl,ed,d); box.append(row); }); }
function dropSound(r){ project.pads=project.pads.filter(x=>x!==r); for(const s of project.scenes) if(s.pads) s.pads=s.pads.filter(x=>x!==r); }
function addSound(r){ if(!project.pads.includes(r)) project.pads.push(r); const s=cur(); s.pads=s.pads||[]; if(!s.pads.includes(r)) s.pads.push(r); }
async function hitPad(r){ const c=Sound.audioCtx(),at=mode==='rec'&&rec?recTime():null; try{ const b=await Sound.buffer(r,project.assets); if(!b) return; const s=c.createBufferSource(),g=c.createGain(); s.buffer=b; g.gain.value=project.mix.fx; s.connect(g); g.connect(Sound.master(c)); s.start(); if(at!==null&&mode==='rec'&&rec) rec.fx.push({t:r3(at),ref:r}); }catch(e){ toast("That sound couldn't be played."); } }
async function libRef(path,nm){ let r=refForLib(path); if(r) return r; const q=await fetch('sounds/'+path.split('/').map(encodeURIComponent).join('/')); if(!q.ok) throw 0; const blob=await q.blob(),a=addAsset('audio',blob,nm||path.split('/').pop().replace(/\.[^.]+$/,'')); a.libPath=path; return 'asset:'+a.id; }
async function renderLibrary(){ const box=$('sfxLib'); if(box.dataset.done) return; box.dataset.done=1;
  try{ const m=await (await fetch('sounds/manifest.json')).json(); for(const cat in m){ const d=document.createElement('details'),s=document.createElement('summary'); s.textContent=cat==='Other'?'More':cat; d.append(s); const w=document.createElement('div'); w.className='libItems'; for(const path of m[cat]){ const nm=path.split('/').pop().replace(/\.[^.]+$/,''),l=document.createElement('label'); l.className='check'; const c=document.createElement('input'); c.type='checkbox'; c.value=path; l.append(c,' '+nm); c.onchange=async()=>{ try{ checkpoint(); if(c.checked){ const r=await libRef(path,nm); addSound(r); hitPad(r); } else dropSound(refForLib(path)); renderPads(); dirty(); }catch(_){ toast("That sound couldn't be loaded."); c.checked=false; } };
      const pv=document.createElement('button'); pv.className='small libPrev'; pv.textContent='▶'; pv.setAttribute('aria-label','Listen to '+nm); pv.onclick=()=>previewLib(path,pv); const row=document.createElement('div'); row.className='libRow'; row.append(pv,l); w.append(row); } d.append(w); box.append(d); } renderPads(); }
  catch(_){ box.innerHTML='<p class="hint">The sound list needs a connection.</p>'; } }
let libPv=null;
function stopLibPreview(){ if(!libPv) return; try{ libPv.src.stop(); }catch(_){} libPv.btn.textContent='▶'; libPv.btn.setAttribute('aria-label',libPv.btn.getAttribute('aria-label').replace('Stop','Listen to')); libPv=null; }
async function previewLib(path,btn){ const same=libPv&&libPv.btn===btn; stopLibPreview(); if(same) return; const c=Sound.audioCtx(),me={btn,src:null}; libPv=me; btn.textContent='■'; btn.setAttribute('aria-label',btn.getAttribute('aria-label').replace('Listen to','Stop'));
  try{ const q=await fetch('sounds/'+path.split('/').map(encodeURIComponent).join('/')); if(!q.ok) throw 0; const buf=await decodeBlob(await q.blob()); if(libPv!==me) return; const s=c.createBufferSource(); s.buffer=buf; s.connect(Sound.master(c)); s.onended=()=>{ if(libPv===me) stopLibPreview(); }; me.src=s; s.start(); }catch(_){ if(libPv===me) stopLibPreview(); toast("That sound couldn't be played."); } }
function drawThumb(c,s){ const g=c.getContext('2d'); g.setTransform(c.width/W,0,0,c.height/H,0,0); drawScene(g,s,it=>it); }
function renderScenes(){ if(sd) return; /* don't rebuild the strip under a finger that's dragging it */ const box=$('sceneList'),keep=box.scrollLeft; box.innerHTML=''; project.scenes.forEach((s,i)=>{ const on=s.id===(playing?playing.scene.id:curId),b=document.createElement('button'); b.className='scene'+(on?' on':''); b.dataset.id=s.id; b.title='Hold and drag to move'; b.setAttribute('aria-label','Scene '+(i+1)+(s.take?', recorded':'')+'. Shift and arrow keys move it.');
    const c=document.createElement('canvas'); c.width=186;c.height=105; drawThumb(c,s); b.append(c); const n=document.createElement('span'); n.className='num'; n.textContent=i+1; b.append(n);
    if(s.take){ const t=document.createElement('span'); t.className='tick'; t.textContent=fmt(s.take.dur); b.append(t); }
    if(on&&mode==='setup'){ const x=document.createElement('span'); x.className='trash'; x.textContent='🗑'; x.setAttribute('role','button'); x.setAttribute('aria-label','Delete scene '+(i+1)); x.onpointerdown=e=>e.stopPropagation(); x.onclick=e=>{ e.stopPropagation(); deleteScene(); }; b.append(x); }
    b.onclick=()=>{ if(mode!=='setup'||sceneDragged) return; curId=s.id; selId=null; refreshAll(); };
    b.addEventListener('pointerdown',e=>sceneDown(e,b)); b.oncontextmenu=e=>e.preventDefault();
    b.onkeydown=e=>{ if(mode!=='setup') return; if(e.shiftKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){ e.preventDefault(); e.stopPropagation(); curId=s.id; moveScene(e.key==='ArrowLeft'?-1:1); $('sceneList').querySelector('.scene.on')?.focus(); } else if(e.key==='Delete'){ e.preventDefault(); e.stopPropagation(); curId=s.id; deleteScene(); } };
    box.append(b); });
  const con=document.createElement('button'); con.id='contScene'; con.innerHTML='<span aria-hidden="true">➡</span> Continue story'; con.title='New scene that starts where the selected scene finishes, with the same cutouts, backdrop and sounds'; con.disabled=!cur().items.length; con.onclick=continueStory; box.append(con);
  const add=document.createElement('button'); add.id='addScene'; add.innerHTML='<span class="plus" aria-hidden="true">＋</span> Blank'; add.title='Add a new blank scene'; add.setAttribute('aria-label','Add a blank scene'); add.onclick=addScene; box.append(add);
  box.scrollLeft=keep; }
function moveScene(d){ const i=project.scenes.indexOf(cur()),j=i+d; if(j<0||j>=project.scenes.length) return; checkpoint(); const [m]=project.scenes.splice(i,1); project.scenes.splice(j,0,m); renderScenes(); dirty(); }
async function deleteScene(){ if(mode!=='setup') return; if(project.scenes.length<2){ toast('A story needs at least one scene.'); return; } const s=cur(); if((s.take||s.items.length)&&!await ask('Delete scene '+(project.scenes.indexOf(s)+1)+'?',(s.take?'Its recording goes too. ':'')+'You can Undo.',[['Keep it',null],['Delete',1,'danger']])) return; checkpoint(); const i=project.scenes.indexOf(s); project.scenes.splice(i,1); curId=project.scenes[Math.max(0,i-1)].id; selId=null; refreshAll(); dirty(); }
/* Reorder scenes by dragging: mouse drags straight away; touch needs a short hold, so a swipe still scrolls the strip. */
let sd=null,sceneDragged=false;
function sceneDown(e,b){ if(mode!=='setup'||e.button>0) return; sd={b,id:e.pointerId,x:e.clientX,y:e.clientY,on:false,pan:false,scroll0:$('sceneList').scrollLeft,touch:e.pointerType!=='mouse'}; if(sd.touch) sd.timer=setTimeout(()=>{ if(sd&&!sd.on) liftScene(); },380); }
function liftScene(){ sd.on=true; sd.b.classList.add('lifted'); try{ sd.b.setPointerCapture(sd.id); }catch(_){} try{ navigator.vibrate&&navigator.vibrate(15); }catch(_){} }
window.addEventListener('pointermove',e=>{ if(!sd||e.pointerId!==sd.id) return; const box=$('sceneList');
  if(sd.pan){ box.scrollLeft=sd.scroll0-(e.clientX-sd.x); return; } // thumbnails don't let the browser scroll (it fights the drag), so a swipe scrolls them here
  if(!sd.on){ if(Math.hypot(e.clientX-sd.x,e.clientY-sd.y)<8) return; if(sd.touch){ clearTimeout(sd.timer); sd.pan=true; return; } liftScene(); }
  placeScene(e.clientX); const r=box.getBoundingClientRect(); if(e.clientX<r.left+40) box.scrollLeft-=14; else if(e.clientX>r.right-40) box.scrollLeft+=14; });
function placeScene(cx){ const box=$('sceneList'); const others=[...box.querySelectorAll('.scene')].filter(o=>o!==sd.b), before=others.find(o=>{ const r=o.getBoundingClientRect(); return cx<r.left+r.width/2; })||$('contScene');
  if(sd.b.nextSibling!==before) box.insertBefore(sd.b,before); }
const sceneUp=e=>{ if(!sd||e.pointerId!==sd.id) return; clearTimeout(sd.timer); if(sd.on&&e.type==='pointerup') placeScene(e.clientX); const was=sd; sd=null; if(was.pan){ sceneDragged=true; setTimeout(()=>sceneDragged=false,50); } if(!was.on) return; was.b.classList.remove('lifted');
  const order=[...$('sceneList').querySelectorAll('.scene')].map(o=>o.dataset.id); sceneDragged=true; setTimeout(()=>sceneDragged=false,50);
  if(order.join()!==project.scenes.map(s=>s.id).join()){ checkpoint(); project.scenes.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id)); dirty(); } curId=was.b.dataset.id; selId=null; refreshAll(); };
window.addEventListener('pointerup',sceneUp); window.addEventListener('pointercancel',sceneUp);
$('sceneList').addEventListener('touchmove',e=>{ if(sd&&sd.on) e.preventDefault(); },{passive:false});
function showCurrentScene(){ const on=$('sceneList').querySelector('.scene.on'); if(on) on.scrollIntoView({block:'nearest',inline:'nearest'}); }
function continueStory(){ if(mode!=='setup') return; checkpoint(); const prev=cur(),end=prev.take?prev.take.dur:0,n=blankScene(project.scenes.length+1); n.backdrop={...prev.backdrop}; n.ambience=prev.ambience; n.music=prev.music; n.pads=[...(prev.pads||[])]; const ids=new Map(prev.items.map(i=>[i.id,uid()])); n.items=prev.items.map(it=>{ const q=poseAt(it,prev.take,end); return {id:ids.get(it.id),...(it.link&&ids.has(it.link)?{link:ids.get(it.link)}:{}),assetId:it.assetId,x:q.x,y:q.y,s:q.s,r:q.r,flip:!!q.flip,anim:it.anim||null,fixed:!!it.fixed,...(it.loop?{loop:JSON.parse(JSON.stringify(it.loop))}:{})}; }); project.scenes.splice(project.scenes.indexOf(prev)+1,0,n); curId=n.id; selId=null; refreshAll(); showCurrentScene(); dirty(); toast('New scene: carry on from where the last one finished.'); }
function addScene(){ if(mode!=='setup') return; checkpoint(); const n=blankScene(project.scenes.length+1); project.scenes.push(n); curId=n.id; selId=null; refreshAll(); showCurrentScene(); dirty(); }
function updateItemBar(){ const it=sel(); $('itemBar').hidden=!it||mode!=='setup'; if(it){ { const f=$('itFixed'); f.classList.toggle('on',!!it.fixed); f.setAttribute('aria-pressed',!!it.fixed); const l=$('itLink'),m=it.link&&cur().items.find(i=>i.id===it.link); l.classList.toggle('on',!!m); l.innerHTML=m?'🔗<span class="lab2"> Unstick</span>':'🔗<span class="lab2"> Stick to…</span>'; l.setAttribute('aria-label',m?'Stuck to '+nameOf(m)+'. Press to unstick':'Stick to another cutout'); l.title=m?'Stuck to '+nameOf(m)+'. Press to unstick.':'Make this follow another cutout'; } document.querySelectorAll('[data-anim]').forEach(b=>{ const on=it.anim===b.dataset.anim; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on); }); const l=$('itLoop'),has=!!it.loop; $('itLoopRedo').hidden=!has; l.innerHTML=has?(it.loop.on?'🔁<span class="lab2"> Move: on</span>':'🔁<span class="lab2"> Move: off</span>'):'🔁<span class="lab2"> Teach a move</span>'; l.classList.toggle('on',has&&it.loop.on); l.setAttribute('aria-label',has?(it.loop.on?'Looping move is on':'Looping move is off'):'Teach a looping move'); } }
function refreshTransport(){ const s=cur(),any=project.scenes.some(x=>x.take); $('playBtn').hidden=$('layerBtn').hidden=!s.take; $('playAllBtn').hidden=project.scenes.filter(x=>x.take).length<2; $('recBtn').lastChild.textContent=s.take?' Redo':' Record'; }
function refreshAll(){ $('projName').value=project.name; renderCast(); renderBack(); renderSoundTab(); renderScenes(); updateItemBar(); refreshTransport(); refreshHint(); undoBtns(); }

/* ---------- project files ---------- */
const extOf=b=>({'image/png':'png','image/jpeg':'jpg','audio/wav':'wav','audio/mpeg':'mp3','audio/mp4':'m4a','audio/ogg':'ogg'}[b.type]||'bin');
const safeName=()=>(project.name||'animation').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')||'animation';
function saveDownload(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),60000); }
function usedAssets(){ const u=new Set([...project.cast,...project.backdrops]); const ref=r=>{ if(r&&r.startsWith('asset:')) u.add(r.slice(6)); }; project.pads.forEach(ref);
  for(const s of project.scenes){ if(s.backdrop.type==='asset') u.add(s.backdrop.id); ref(s.ambience); ref(s.music); s.items.forEach(i=>u.add(i.assetId)); if(s.script) u.add(s.script); if(s.take){ (s.take.voices||[]).forEach(v=>u.add(v.assetId)); (s.take.fx||[]).forEach(f=>ref(f.ref)); } } return u; }
async function saveProject(){ toast('Saving…',60000); const z=new JSZip(),meta={},used=usedAssets();
  for(const id of used){ const a=project.assets[id]; if(!a) continue; const file='assets/'+id+'.'+extOf(a.blob); z.file(file,a.blob); meta[id]={id,mine:a.mine,libId:a.libId,kind:a.kind,name:a.name,w:a.w,h:a.h,file,type:a.blob.type,libPath:a.libPath,userSound:a.userSound}; }
  const {assets,...rest}=project; z.file('project.json',JSON.stringify({app:'cutout-animator',...rest,assets:meta}));
  const blob=await z.generateAsync({type:'blob',compression:'STORE'}); const d=new Date(),st=d.toISOString().slice(0,10)+'_'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0');
  saveDownload(blob,safeName()+'_'+st+'.cutz'); toast('Project saved to your downloads. Open it here any time to keep editing.'); }
async function openProject(file){ try{ const z=await JSZip.loadAsync(file),pj=z.file('project.json'); if(!pj) throw 0; const p=JSON.parse(await pj.async('string')); if(p.app!=='cutout-animator') throw 0; const metas=p.assets; p.assets={};
    for(const id in metas){ const m=metas[id],b=await z.file(m.file).async('blob'); p.assets[id]={...m,blob:new Blob([b],{type:m.type})}; }
    await adopt(p); undoStack=[]; redoStack=[]; refreshAll(); dirty(); toast('Opened '+p.name); }
  catch(e){ console.warn(e); toast("That isn't a Cutout Animator project file (.cutz)."); } }
async function adopt(p){ imgs.clear(); hitMaps.clear(); p.mix=p.mix||{voice:1,ambience:.5,music:.4,fx:1}; project=p; curId=p.curId&&p.scenes.find(s=>s.id===p.curId)?p.curId:p.scenes[0].id; delete project.curId; delete project.savedAt; project.pads=project.pads||[]; for(const s of project.scenes) if(!s.pads) s.pads=[...project.pads]; /* older projects showed every button on every scene */ for(const s of project.scenes) for(const i of s.items) if(i.alive){ i.anim='sway'; delete i.alive; } selId=null; for(const a of Object.values(project.assets)) if(a.kind!=='audio'){ try{ await loadImg(a); }catch(_){ } } }

/* ---------- video export ---------- */
async function mixAll(scenes,total){ const sr=48000,off=new OfflineAudioContext(2,Math.max(1,Math.ceil(total*sr)),sr); let at=0; for(const s of scenes){ const buf=await preload(s); Sound.schedule(off,Sound.master(off),s,at,buf,project.mix,{dur:s.take.dur,withTake:true}); at+=s.take.dur; } return off.startRendering(); }
function frameAt(c,scenes,t,cw){ let a=0; for(const s of scenes){ if(t<a+s.take.dur||s===scenes[scenes.length-1]){ const l=t-a; c.setTransform(cw/W,0,0,cw/W,0,0); drawScene(c,s,it=>poseAt(it,s.take,l),l); return; } a+=s.take.dur; } }
/* Timers are throttled in hidden tabs (down to once a minute), so the fast path never waits on one.
   A MessageChannel yield and the encoders' own events keep running at full speed in the background. */
const yieldNow=()=>new Promise(r=>{ const m=new MessageChannel(); m.port1.onmessage=()=>{ m.port1.close(); r(); }; m.port2.postMessage(0); });
const CANCEL=new Error('cancelled'),HIDDEN=new Error('hidden'); let expCancel=false;
const checkCancel=()=>{ if(expCancel) throw CANCEL; };
async function drain(enc,limit,getErr){ // wait for the encoder to catch up: this is what keeps slow computers from running out of memory
  let spins=0;const start=performance.now();
  while(enc.encodeQueueSize>limit){ checkCancel(); if(getErr()) throw getErr();
    if('ondequeue' in enc) await new Promise(r=>{ const m=()=>{ enc.removeEventListener('dequeue',m); clearTimeout(t); r(); },t=setTimeout(m,250); enc.addEventListener('dequeue',m); });
    else await yieldNow();
    if(performance.now()-start>120000) throw new Error('The video encoder stopped responding.'); if(++spins%64===0) await yieldNow(); }
}
async function encodeAudio(buf,choice){ const out=[]; let err=null; const n=buf.numberOfChannels,sr=buf.sampleRate,e=new AudioEncoder({output:(chunk,meta)=>out.push({chunk,meta}),error:x=>err=x}); e.configure({codec:choice.enc,sampleRate:sr,numberOfChannels:n,bitrate:160000});
  const ch=[...Array(n).keys()].map(i=>buf.getChannelData(i)); for(let s=0;s<buf.length;s+=1024){ checkCancel(); if(err) throw err; const len=Math.min(1024,buf.length-s),pl=new Float32Array(len*n); ch.forEach((c,i)=>pl.set(c.subarray(s,s+len),i*len)); const d=new AudioData({format:'f32-planar',sampleRate:sr,numberOfFrames:len,numberOfChannels:n,timestamp:Math.round(s/sr*1e6),data:pl}); try{ e.encode(d); }finally{ d.close(); } await drain(e,10,()=>err); if(s%(1024*64)===0) await yieldNow(); }
  await e.flush(); e.close(); if(err) throw err; if(!out.length) throw new Error('no audio'); return out; }
async function exportWebCodecs(scenes,total,audio,cw,ch,prog){
  if(typeof VideoEncoder==='undefined'||typeof AudioEncoder==='undefined'||!window.Mp4Muxer) return null;
  const fps=30,bitrate=cw>1280?8e6:5e6; let codec=null; for(const k of ['avc1.640028','avc1.4d0028','avc1.42002a','avc1.42001f']){ try{ if((await VideoEncoder.isConfigSupported({codec:k,width:cw,height:ch,bitrate})).supported){ codec=k; break; } }catch(_){} } if(!codec) return null;
  let ac=null; for(const c of [{enc:'mp4a.40.2',mux:'aac'},{enc:'opus',mux:'opus'}]){ try{ if((await AudioEncoder.isConfigSupported({codec:c.enc,sampleRate:audio.sampleRate,numberOfChannels:2,bitrate:160000})).supported){ ac=c; break; } }catch(_){} } if(!ac) return null;
  prog('Encoding sound…',.03); const chunks=await encodeAudio(audio,ac);
  const mux=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:'avc',width:cw,height:ch},audio:{codec:ac.mux,numberOfChannels:2,sampleRate:audio.sampleRate},fastStart:'in-memory',firstTimestampBehavior:'offset'});
  chunks.forEach(({chunk,meta})=>mux.addAudioChunk(chunk,meta));
  let err=null,got=0; const enc=new VideoEncoder({output:(c,m)=>{ got++; mux.addVideoChunk(c,m); },error:e=>err=e}); enc.configure({codec,width:cw,height:ch,bitrate,framerate:fps});
  const cn=document.createElement('canvas'); cn.width=cw;cn.height=ch; const c=cn.getContext('2d',{alpha:false}); c.imageSmoothingQuality='high'; const N=Math.ceil(total*fps);
  try{
    for(let i=0;i<N;i++){ checkCancel(); if(err) throw err; frameAt(c,scenes,i/fps,cw); const f=new VideoFrame(cn,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)}); enc.encode(f,{keyFrame:i%60===0}); f.close(); await drain(enc,4,()=>err); if(i%3===0) await yieldNow(); if(i%10===0) prog('Making video… '+Math.round(i/N*100)+'%',.05+.93*i/N); }
    await enc.flush(); if(err) throw err; if(got<N) throw new Error('Some frames were lost.');
  }finally{ try{ enc.close(); }catch(_){} }
  mux.finalize(); window.__expStats={path:'webcodecs',frames:got,expected:N}; return {blob:new Blob([mux.target.buffer],{type:'video/mp4'}),ext:'mp4'};
}
async function exportRealtime(scenes,total,audio,cw,ch,prog){ // older browsers without the encoders: the only way is to play it through once, with this tab showing
  if(document.hidden) throw HIDDEN;
  const cn=document.createElement('canvas'); cn.width=cw;cn.height=ch; const c=cn.getContext('2d'),ac=Sound.audioCtx(),dst=ac.createMediaStreamDestination(),st=cn.captureStream(30); dst.stream.getAudioTracks().forEach(t=>st.addTrack(t));
  const type=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t)); if(!type) throw new Error('This browser cannot record video.');
  const mr=new MediaRecorder(st,{mimeType:type,videoBitsPerSecond:cw>1280?8e6:5e6}),parts=[]; mr.ondataavailable=e=>e.data.size&&parts.push(e.data); const done=new Promise(r=>mr.onstop=r);
  frameAt(c,scenes,0,cw); mr.start(1000); const s=ac.createBufferSource(); s.buffer=audio; s.connect(dst); const t0=ac.currentTime+.05; s.start(t0); let gaps=0,last=0,stop=null;
  try{
    await new Promise((res,rej)=>{ const onHide=()=>{ if(document.hidden) rej(HIDDEN); }; document.addEventListener('visibilitychange',onHide); stop=()=>document.removeEventListener('visibilitychange',onHide); const go=(now)=>{ if(expCancel) return rej(CANCEL); if(document.hidden) return rej(HIDDEN); if(last&&now-last>250) gaps++; last=now; const t=ac.currentTime-t0; if(t>=total) return res(); frameAt(c,scenes,Math.max(0,t),cw); prog('Keep this tab showing while it records… '+Math.round(t/total*100)+'%',t/total); requestAnimationFrame(go); }; requestAnimationFrame(go); });
    await new Promise(r=>setTimeout(r,150));
  }catch(e){ try{ s.stop(); }catch(_){} mr.stop(); await done; st.getTracks().forEach(t=>t.stop()); throw e; }
  finally{ stop&&stop(); }
  mr.stop(); await done; st.getTracks().forEach(t=>t.stop()); const base=type.split(';')[0]; window.__expStats={path:'realtime',gaps}; return {blob:new Blob(parts,{type:base}),ext:base==='video/mp4'?'mp4':'webm',jumpy:gaps>3};
}
async function makeOne(scenes,total,cw,chh,prog){ prog('Mixing sound…',.01); const audio=await mixAll(scenes,total); let r=null; try{ r=await exportWebCodecs(scenes,total,audio,cw,chh,prog); }catch(e){ if(e===CANCEL) throw e; console.warn('fast export failed',e); }
  while(!r){ try{ r=await exportRealtime(scenes,total,audio,cw,chh,prog); }catch(e){ if(e!==HIDDEN) throw e; prog('Paused. On this browser the video can only be made while this tab is showing. It will start again when you come back.',0); await new Promise(res=>{ let iv; const f=()=>{ if(!document.hidden||expCancel){ document.removeEventListener('visibilitychange',f); clearInterval(iv); res(); } }; iv=setInterval(f,500); document.addEventListener('visibilitychange',f); f(); }); checkCancel(); } }
  return r; }
let expResults=[];
function showResult(i){ const r=expResults[i]; $('expVideo').src=r.url; }
async function runExport(){ const all=project.scenes.filter(s=>s.take),cw=+$('expSize').value,chh=Math.round(cw*H/W/2)*2,each=document.querySelector('input[name=expKind]:checked').value==='each'&&all.length>1;
  const jobs=each?all.map(s=>({scenes:[s],n:project.scenes.indexOf(s)+1})):[{scenes:all}]; expCancel=false; expResults.forEach(r=>URL.revokeObjectURL(r.url)); expResults=[];
  $('expSetup').hidden=true; $('expRun').hidden=false; $('expCancelRun').disabled=false; let lock=null; try{ lock=await navigator.wakeLock?.request('screen'); }catch(_){}
  const guard=e=>{ e.preventDefault(); e.returnValue=''; }; window.addEventListener('beforeunload',guard);
  try{ Sound.audioCtx(); for(let j=0;j<jobs.length;j++){ const J=jobs[j],total=J.scenes.reduce((a,s)=>a+s.take.dur,0),pre=jobs.length>1?`Scene ${j+1} of ${jobs.length}. `:'',prog=(m,v)=>{ $('expStatus').textContent=pre+m; $('expProg').value=(j+v)/jobs.length; };
      const r=await makeOne(J.scenes,total,cw,chh,prog); expResults.push({...r,url:URL.createObjectURL(r.blob),dur:total,name:safeName()+(J.n?`_scene_${String(J.n).padStart(2,'0')}`:'')+'.'+r.ext,label:J.n?'Scene '+J.n:'Whole story'}); }
    window.__lastExport=expResults[0]; window.__lastExports=expResults; const size=expResults.reduce((a,r)=>a+r.blob.size,0),ext=expResults[0].ext;
    showResult(0); const one=expResults.length===1,dl=$('expDl'); dl.hidden=!one; $('expZip').hidden=one; if(one){ dl.href=expResults[0].url; dl.download=expResults[0].name; }
    const list=$('expList'); list.innerHTML=''; if(!one) expResults.forEach((r,i)=>{ const row=document.createElement('div'); row.className='expRow'; const b=document.createElement('b'); b.textContent=`${r.label} (${fmt(r.dur)})`; const w=document.createElement('button'); w.textContent='▶ Watch'; w.onclick=()=>{ showResult(i); $('expVideo').play().catch(()=>{}); }; const a=document.createElement('a'); a.className='btn'; a.textContent='Download'; a.href=r.url; a.download=r.name; row.append(b,w,a); list.append(row); });
    $('expNote').textContent=(one?fmt(expResults[0].dur)+' long, ':expResults.length+' videos, ')+(size/1048576).toFixed(1)+' MB, '+ext.toUpperCase()+'.'+(ext==='webm'?' This browser makes WebM, which plays in Chrome and most editors. Safari or Edge may give you MP4.':'')+(expResults.some(r=>r.jumpy)?' This computer struggled, so the movement may look jumpy. Try the 720p size.':'');
    const files=expResults.map(r=>new File([r.blob],r.name,{type:r.blob.type})); $('expShare').hidden=!(navigator.canShare&&navigator.canShare({files})); $('expShare').onclick=()=>navigator.share({files}).catch(()=>{});
    $('expRun').hidden=true; $('expDone').hidden=false; }
  catch(e){ $('exportDlg').close(); if(e!==CANCEL){ console.error(e); toast('The video could not be made: '+(e.message||e),8000); } }
  finally{ window.removeEventListener('beforeunload',guard); try{ lock&&lock.release(); }catch(_){} } }
async function downloadZip(){ const z=new JSZip(); expResults.forEach(r=>z.file(r.name,r.blob)); const blob=await z.generateAsync({type:'blob',compression:'STORE'}); saveDownload(blob,safeName()+'_scenes.zip'); }

/* ---------- words ---------- */
async function addWords(){ const t=await ask('Add words','Type a title, a label or a speech bubble.',[['Cancel',null],['Add','__input','primary']],''); if(!t||!t.trim()) return; const txt=t.trim().slice(0,80),lines=txt.split('\n'),fs=96,c=document.createElement('canvas'),g=c.getContext('2d'),font=`800 ${fs}px ui-rounded,"Trebuchet MS",sans-serif`; g.font=font; const w=Math.ceil(g.measureText(txt).width)+56,h=fs+60; c.width=w;c.height=h; g.font=font; g.textBaseline='middle'; g.textAlign='center'; g.lineJoin='round'; g.lineWidth=18; g.strokeStyle='#fff'; g.strokeText(txt,w/2,h/2); g.fillStyle='#2a2320'; g.fillText(txt,w/2,h/2);
  const blob=await new Promise(r=>c.toBlob(r,'image/png')); checkpoint(); const a=addAsset('cutout',blob,txt,w,h); await loadImg(a); project.cast.push(a.id); const it=placeCutout(a); it.s=Math.min(1,900/w); it.y=H*.2; renderCast(); updateItemBar(); dirty(); }

/* ---------- record, trim and rename sound effects ---------- */
let sfxTimer=0,sfxT0=0,sfxX={mode:'new',ref:null,buf:null,a:0,b:0,blob:null,play:null};
const sfxDur=()=>sfxX.buf?sfxX.buf.duration:0;
function sfxState(s){ $('sfxRecBox').hidden=s==='done'; $('sfxDoneBox').hidden=s!=='done'; $('sfxAgain').hidden=sfxX.mode!=='new'; $('sfxRecGo').innerHTML=s==='rec'?'<span class="sq"></span> Stop':'<span class="dot"></span> Record'; $('sfxRecGo').classList.toggle('going',s==='rec'); $('sfxTime').textContent=s==='rec'?'0.0 s':''; if(s==='done') requestAnimationFrame(sfxDraw); }
async function decodeBlob(blob){ const c=Sound.audioCtx(),ab=await blob.arrayBuffer(); return new Promise((res,rej)=>{ const q=c.decodeAudioData(ab,res,rej); if(q&&q.catch) q.catch(rej); }); }
async function sfxOpen(){ if(mode!=='setup') return; sfxX={mode:'new',ref:null,buf:null,a:0,b:0,blob:null}; $('sfxTitle').textContent='Record a sound effect'; $('sfxKeep').textContent='✓ Make it a button'; $('sfxName').value='My sound '+(project.pads.filter(isMine).length+1); sfxState('idle'); $('sfxMsg').textContent=''; $('sfxDlg').showModal();
  try{ await Sound.micStart(micPref()); micUI(); await micList(); }catch(e){ $('sfxMicWrap').hidden=true; $('sfxMsg').textContent=e.name==='NotAllowedError'?'The microphone is blocked in the browser settings.':"Can't find a microphone."; } }
async function sfxEdit(ref){ if(mode!=='setup') return; const a=project.assets[ref.slice(6)]; if(!a) return; let buf; try{ buf=await decodeBlob(a.blob); }catch(_){ toast("That sound couldn't be opened."); return; }
  sfxX={mode:'edit',ref,buf,a:0,b:buf.duration,blob:a.blob}; $('sfxTitle').textContent='Change this sound'; $('sfxKeep').textContent='✓ Save'; $('sfxName').value=a.name; $('sfxMsg').textContent=''; sfxSync(); $('sfxDlg').showModal(); sfxState('done'); }
function sfxStart(){ if(!Sound.mic.stream) return; Sound.audioCtx(); Sound.micCollect(); sfxT0=performance.now(); sfxState('rec'); sfxTimer=setInterval(()=>{ const s=(performance.now()-sfxT0)/1000; $('sfxTime').textContent=s.toFixed(1)+' s'; if(s>=10) sfxStop(); },100); }
async function sfxStop(){ clearInterval(sfxTimer); const b=Sound.micTakeTrimmed(); if(!b){ sfxState('idle'); $('sfxMsg').textContent="That was too quiet. Get closer to the microphone and try again."; return; }
  sfxX.blob=b; sfxX.buf=await decodeBlob(b); sfxX.a=0; sfxX.b=sfxX.buf.duration; $('sfxMsg').textContent=''; sfxSync(); sfxState('done'); sfxPlay(); }
function sfxSync(){ const d=sfxDur()||1; $('sfxA').value=Math.round(sfxX.a/d*1000); $('sfxB').value=Math.round(sfxX.b/d*1000); $('sfxLen').textContent=(sfxX.b-sfxX.a).toFixed(1)+' s'; sfxDraw(); }
function sfxSet(which,t){ const d=sfxDur(),gap=Math.min(.1,d/4); if(which==='a') sfxX.a=clamp(t,0,sfxX.b-gap); else sfxX.b=clamp(t,sfxX.a+gap,d); sfxSync(); }
function sfxDraw(){ const cv=$('sfxWave'),buf=sfxX.buf; if(!buf||!cv.isConnected) return; const dpr=Math.min(2,devicePixelRatio||1),w=Math.max(10,cv.clientWidth),h=cv.clientHeight||120; if(cv.width!==Math.round(w*dpr)){ cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr); } const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,w,h);
  const d=buf.getChannelData(0),n=d.length,X=t=>t/buf.duration*w; g.fillStyle='#fff'; g.fillRect(0,0,w,h);
  for(let x=0;x<w;x++){ const s=Math.floor(x/w*n),e=Math.floor((x+1)/w*n); let lo=0,hi=0; for(let i=s;i<e;i+=4){ if(d[i]<lo) lo=d[i]; if(d[i]>hi) hi=d[i]; } const t=x/w*buf.duration,inside=t>=sfxX.a&&t<=sfxX.b; g.fillStyle=inside?'#0b6e6e':'#c9c2b4'; g.fillRect(x,h/2-hi*h*.45-1,1,Math.max(2,(hi-lo)*h*.45+2)); }
  g.fillStyle='#2a232055'; g.fillRect(0,0,X(sfxX.a),h); g.fillRect(X(sfxX.b),0,w-X(sfxX.b),h);
  for(const t of [sfxX.a,sfxX.b]){ const x=X(t); g.fillStyle='#e07a00'; g.fillRect(x-2,0,4,h); g.beginPath(); g.arc(x,h/2,9,0,7); g.fill(); g.strokeStyle='#fff'; g.lineWidth=2; g.stroke(); }
  if(sfxX.play){ const x=X(sfxX.play()); g.fillStyle='#c8321e'; g.fillRect(x-1,0,2,h); requestAnimationFrame(sfxDraw); } }
let sfxSrc=null;
function sfxPlay(){ if(!sfxX.buf) return; const c=Sound.audioCtx(); try{ sfxSrc&&sfxSrc.stop(); }catch(_){} const s=c.createBufferSource(),t0=c.currentTime,len=sfxX.b-sfxX.a; s.buffer=sfxX.buf; s.connect(Sound.master(c)); s.start(0,sfxX.a,len); sfxSrc=s; const a=sfxX.a; sfxX.play=()=>{ const t=a+(c.currentTime-t0); if(t>=a+len){ sfxX.play=null; } return Math.min(t,a+len); }; s.onended=()=>{ sfxX.play=null; sfxDraw(); }; sfxDraw(); }
function sfxClose(){ clearInterval(sfxTimer); try{ sfxSrc&&sfxSrc.stop(); }catch(_){} sfxX.play=null; Sound.mic.chunks=null; $('sfxDlg').close(); if(!$('voiceOn').checked){ Sound.micStop(); micUI(); } }
function sfxTrimmed(){ const buf=sfxX.buf,d=buf.duration; if(sfxX.a<.005&&sfxX.b>d-.005) return sfxX.blob; const sr=buf.sampleRate,s=Math.floor(sfxX.a*sr),e=Math.ceil(sfxX.b*sr),ch=buf.numberOfChannels,out=new Float32Array(e-s);
  for(let k=0;k<ch;k++){ const c=buf.getChannelData(k); for(let i=s;i<e;i++) out[i-s]+=c[i]/ch; } const f=Math.min(out.length>>1,Math.round(sr*.008)); for(let i=0;i<f;i++){ out[i]*=i/f; out[out.length-1-i]*=i/f; } return Sound.wav([out],out.length,sr); }
function swapRef(from,to){ const f=r=>r===from?to:r; project.pads=project.pads.map(f); for(const s of project.scenes){ if(s.pads) s.pads=s.pads.map(f); s.ambience=f(s.ambience); s.music=f(s.music); if(s.take&&s.take.fx) s.take.fx.forEach(x=>x.ref=f(x.ref)); } }
function sfxKeep(){ if(!sfxX.buf) return; const nm=($('sfxName').value||'My sound').trim().slice(0,30),blob=sfxTrimmed(); checkpoint();
  if(sfxX.mode==='new'){ const a=addAsset('audio',blob,nm); a.mine=true; addSound('asset:'+a.id); toast('“'+nm+'” is ready, and its button is on this scene.'); }
  else { const old=project.assets[sfxX.ref.slice(6)]; if(blob===sfxX.blob) old.name=nm; else { const a=addAsset('audio',blob,nm); a.mine=old.mine; a.userSound=old.userSound; swapRef(sfxX.ref,'asset:'+a.id); } toast('Saved. Scenes that use this sound use the new version.'); } // a new asset keeps Undo working
  renderPads(); renderSoundTab(); dirty(); sfxClose(); }
function sfxWire(){ const cv=$('sfxWave'); let drag=null; const tAt=e=>{ const r=cv.getBoundingClientRect(); return clamp((e.clientX-r.left)/r.width,0,1)*sfxDur(); };
  cv.addEventListener('pointerdown',e=>{ if(!sfxX.buf) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); const t=tAt(e); drag=Math.abs(t-sfxX.a)<=Math.abs(t-sfxX.b)?'a':'b'; sfxSet(drag,t); });
  cv.addEventListener('pointermove',e=>{ if(drag) sfxSet(drag,tAt(e)); }); const up=()=>{ if(drag){ drag=null; sfxPlay(); } }; cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  $('sfxA').oninput=e=>sfxSet('a',e.target.value/1000*sfxDur()); $('sfxB').oninput=e=>sfxSet('b',e.target.value/1000*sfxDur()); $('sfxA').onchange=$('sfxB').onchange=sfxPlay; }

/* ---------- template sheets ---------- */
async function importSheets(sheets){ checkpoint();
  const blank=project.scenes.length===1&&!project.scenes[0].items.length&&!project.scenes[0].take, added=[], base=blank?0:project.scenes.length;
  const jpg=c=>new Promise(r=>c.toBlob(r,'image/jpeg',.88));
  for(const sh of sheets){ const n=blankScene(base+added.length+1);
    if(sh.bg){ const a=addAsset('backdrop',await jpg(sh.bg),'Sheet '+(base+added.length+1),sh.bg.width,sh.bg.height); await loadImg(a); project.backdrops.push(a.id); n.backdrop={type:'asset',id:a.id}; }
    if(sh.script){ const a=addAsset('script',await jpg(sh.script),'Script',sh.script.width,sh.script.height); n.script=a.id; }
    n.ambience=sh.amb; n.music=sh.mus;
    const count=sh.chars.length; for(let i=0;i<count;i++){ const ch=sh.chars[i],a=addAsset('cutout',ch.cut.blob,'Cutout',ch.cut.w,ch.cut.h); await loadImg(a); project.cast.push(a.id); const k=Math.min(320/a.h,300/a.w,1.6); n.items.push({id:uid(),assetId:a.id,x:W*(i+1)/(count+1),y:H*.6,s:k,r:0,flip:false,anim:ch.anim||null}); }
    added.push(n); }
  project.scenes=blank?added:project.scenes.concat(added); curId=added[0].id; selId=null; refreshAll(); showCurrentScene(); dirty(); toast(sheets.length+(sheets.length===1?' scene':' scenes')+' added.'); }

/* ---------- wiring ---------- */
function wire(){
  document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; document.querySelectorAll('.tabs button').forEach(x=>{ x.classList.toggle('on',x===b); x.setAttribute('aria-selected',x===b); }); stopLibPreview(); for(const t of ['cast','back','sound']) $('tab-'+t).hidden=t!==tab; if(tab==='sound') renderLibrary(); });
  Cut.init({toast,
    onCutout:async(blob,w,h)=>{ checkpoint(); const n=project.cast.length+1,a=addAsset('cutout',blob,'Cutout '+n,w,h); await loadImg(a); project.cast.push(a.id); placeCutout(a); renderCast(); updateItemBar(); dirty(); },
    onBackdrop:async(blob,w,h)=>{ checkpoint(); const a=addAsset('backdrop',blob,'Photo '+(project.backdrops.length+1),w,h); await loadImg(a); project.backdrops.push(a.id); cur().backdrop={type:'asset',id:a.id}; renderBack(); dirty(); }});
  Template.init({toast,onAdd:importSheets});
  Library.init({onPick:async item=>{ checkpoint(); let a=Object.values(project.assets).find(x=>x.libId===item.id&&x.kind==='cutout'); if(!a){ const c=await Library.toCutout(item); a=addAsset('cutout',c.blob,item.name,c.w,c.h); a.libId=item.id; await loadImg(a); } if(!project.cast.includes(a.id)) project.cast.push(a.id); const it=placeCutout(a); it.anim=item.alive?'sway':null; if(item.scenery) it.fixed=true; updateItemBar(); renderCast(); updateItemBar(); dirty(); toast(item.name+' added to the stage.',1500); }});
  $('addLibrary').onclick=()=>Library.open(); $('startLib').onclick=()=>Library.open(); $('startDraw').onclick=()=>Cut.open('cutout');
  const pref=(k,v)=>{ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(_){ return null; } };
  Sound.setAec(pref('ca-aec')==='1'); $('aecToggle').checked=Sound.aec;
  $('aecToggle').onchange=async e=>{ pref('ca-aec',e.target.checked?'1':''); Sound.setAec(e.target.checked); if(Sound.mic.stream){ Sound.micStop(); await micOn(); } };
  const fillOut=async()=>{ if(!Sound.canPickOutput||!navigator.mediaDevices?.enumerateDevices) return; const ds=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audiooutput'&&d.deviceId!=='communications'),s=$('outSel'); s.innerHTML=''; ds.forEach((d,i)=>{ const o=document.createElement('option'); o.value=d.deviceId==='default'?'':d.deviceId; o.textContent=d.deviceId==='default'?'Computer default':(d.label||'Speaker '+(i+1)); s.append(o); }); s.value=pref('ca-out')||''; if(s.selectedIndex<0) s.value=''; $('outWrap').hidden=ds.length<2; };
  if(pref('ca-out')) Sound.setSink(pref('ca-out'));
  $('outSel').onchange=e=>{ pref('ca-out',e.target.value); Sound.setSink(e.target.value); Sound.testTone(); };
  $('testSound').onclick=()=>Sound.testTone();
  $('menuBtn').addEventListener('click',fillOut);
  const setLib=v=>{ $('sfxLibWrap').hidden=!v; $('libToggle').checked=v; try{ localStorage.setItem('ca-sfxlib',v?'1':''); }catch(_){} if(!v) stopLibPreview(); };
  try{ setLib(localStorage.getItem('ca-sfxlib')==='1'); }catch(_){ setLib(false); } $('libToggle').onchange=e=>setLib(e.target.checked);
  const setBig=v=>{ document.documentElement.classList.toggle('bigUI',v); $('bigUI').checked=v; try{ localStorage.setItem('ca-big',v?'1':''); }catch(_){} resize(); };
  try{ setBig(localStorage.getItem('ca-big')==='1'); }catch(_){} $('bigUI').onchange=e=>setBig(e.target.checked);
  const fs=document.documentElement; if(!fs.requestFullscreen) $('fsBtn').hidden=true; $('fsBtn').onclick=()=>{ $('menuDlg').close(); document.fullscreenElement?document.exitFullscreen():fs.requestFullscreen().catch(()=>{}); };
  $('addDrawing').onclick=()=>Cut.open('cutout'); $('addBackdrop').onclick=()=>Cut.open('backdrop'); $('addWords').onclick=addWords;
  $('backColor').oninput=e=>{ cur().backdrop={type:'color',color:e.target.value}; renderBack(); dirty(); }; $('backColor').onchange=()=>{};
  $('ambSel').onchange=e=>{ checkpoint(); stopPrev(); cur().ambience=e.target.value||null; dirty(); }; $('musSel').onchange=e=>{ checkpoint(); stopPrev(); cur().music=e.target.value||null; dirty(); };
  let prevStop=null,prevBtn=null; const stopPrev=()=>{ if(prevStop){ prevStop(); prevStop=null; prevBtn.textContent='▶'; } };
  const prev=(btn,get,key)=>btn.onclick=async()=>{ if(prevBtn===btn&&prevStop){ stopPrev(); return; } stopPrev(); const r=get(); if(!r) return; const c=Sound.audioCtx(),b=await Sound.buffer(r,project.assets),fake={ambience:key==='ambience'?r:null,music:key==='music'?r:null}; prevStop=Sound.schedule(c,Sound.master(c),fake,c.currentTime+.02,x=>x===r?b:null,project.mix,{dur:Infinity}); prevBtn=btn; btn.textContent='■'; };
  prev($('ambPrev'),()=>$('ambSel').value,'ambience'); prev($('musPrev'),()=>$('musSel').value,'music');
  $('recSfx').onclick=sfxOpen; $('sfxRecGo').onclick=()=>$('sfxRecGo').classList.contains('going')?sfxStop():sfxStart(); $('sfxAgain').onclick=()=>{ sfxX.buf=null; sfxState('idle'); }; sfxWire(); $('sfxPlay').onclick=sfxPlay; $('sfxKeep').onclick=sfxKeep; $('sfxCancel').onclick=sfxClose; $('sfxDlg').addEventListener('cancel',e=>{ e.preventDefault(); sfxClose(); });
  $('uploadSound').onclick=()=>$('soundInput').click();
  $('soundInput').onchange=async e=>{ const f=e.target.files[0]; e.target.value=''; if(!f) return; const nm=f.name.replace(/\.[^.]+$/,''); const a=addAsset('audio',f.slice(0,f.size,f.type||'audio/mpeg'),nm); a.userSound=true; try{ await Sound.buffer('asset:'+a.id,project.assets); }catch(_){ delete project.assets[a.id]; toast("That sound file couldn't be opened."); return; } const c=await ask('Use “'+nm+'” as…','',[['Background sound','amb'],['Music','mus'],['Sound effect button','pad']]); if(!c) return; checkpoint(); const ref='asset:'+a.id; if(c==='amb') cur().ambience=ref; if(c==='mus') cur().music=ref; if(c==='pad'){ a.mine=true; project.pads.push(ref); } renderSoundTab(); dirty(); };
  const mx=(id,key)=>{ $(id).oninput=e=>{ project.mix[key]=+e.target.value; dirty(); }; }; mx('mixVoice','voice'); mx('mixAmb','ambience'); mx('mixMus','music'); mx('mixFx','fx');
  $('micEnable').onclick=micOn;
  $('voiceOn').onchange=e=>{ if(e.target.checked) micOn(); else { Sound.micStop(); micUI(); } };
  $('micSel').onchange=async e=>{ micPref(e.target.value); Sound.micStop(); await micOn(); };
  $('sfxMicSel').onchange=async e=>{ if($('sfxRecGo').classList.contains('going')) return; micPref(e.target.value); Sound.micStop(); try{ await Sound.micStart(e.target.value); }catch(_){ $('sfxMsg').textContent="That microphone couldn't be opened."; } micUI(); await micList(); };
  if(navigator.mediaDevices&&navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange',()=>{ if(mode==='setup') micList(); });
  document.addEventListener('visibilitychange',()=>{ if(mode!=='setup') return; if(document.hidden){ if(Sound.mic.stream){ Sound.micStop(); micUI.resume=true; } } else if(micUI.resume){ micUI.resume=false; micOn(); } }); // don't hold the mic while the tab is hidden
  window.addEventListener('pointerdown',()=>Sound.audioCtx(),{once:true});
  $('recBtn').onclick=()=>startRecording(false); $('layerBtn').onclick=()=>startRecording(true); $('stopBtn').onclick=()=>{ mode==='play'?stopPlay():stopRecording(); }; $('nextSceneBtn').onclick=nextScene;
  $('playBtn').onclick=()=>play([cur()]); $('playAllBtn').onclick=()=>play(project.scenes);
  $('projName').oninput=e=>{ project.name=e.target.value; dirty(); };
  $('itFlip').onclick=flip;
  $('itLink').onclick=linkStart;
  $('itFixed').onclick=()=>{ const it=sel(); if(!it) return; checkpoint(); it.fixed=!it.fixed; updateItemBar(); dirty(); toast(it.fixed?'Pinned: it stays put while recording, and taps go through it.':'Not pinned: you can drag it while recording.',2400); };
  $('itLoop').onclick=()=>{ const it=sel(); if(!it) return; if(it.loop){ checkpoint(); it.loop.on=!it.loop.on; updateItemBar(); dirty(); } else teachStart(); };
  $('itLoopRedo').onclick=teachStart;
  document.querySelectorAll('[data-anim]').forEach(b=>b.onclick=()=>{ const it=sel(); if(!it) return; checkpoint(); const v=b.dataset.anim; it.anim=it.anim===v?null:v; updateItemBar(); dirty(); toast(it.anim?b.getAttribute('aria-label'):'No animation',1000); });
  const reorder=d=>{ const s=cur(),i=s.items.findIndex(x=>x.id===selId); if(i<0) return; const j=clamp(i+d,0,s.items.length-1); if(i===j) return; checkpoint(); const [m]=s.items.splice(i,1); s.items.splice(j,0,m); dirty(); };
  $('itFwd').onclick=()=>reorder(1); $('itBack').onclick=()=>reorder(-1);
  $('itDup').onclick=()=>{ const it=sel(); if(!it) return; checkpoint(); const n={...it,id:uid(),x:it.x+40,y:it.y+30}; cur().items.push(n); selId=n.id; dirty(); };
  const removeSel=()=>{ const it=sel(); if(!it) return; checkpoint(); const s=cur(); unstickFrom(s,[it.id]); s.items=s.items.filter(x=>x.id!==it.id); if(s.take) delete s.take.tracks[it.id]; selId=null; updateItemBar(); refreshHint(); dirty(); };
  $('itDel').onclick=removeSel;
  $('undoBtn').onclick=undo; $('redoBtn').onclick=redo;
  $('newBtn').onclick=async()=>{ $('menuDlg').close(); if(!await ask('Start a new project?','Anything you have not saved as a project file will be lost.',[['Cancel',null],['Start new',1,'danger']])) return; await adopt(newProject()); undoStack=[]; redoStack=[]; refreshAll(); autosave(); };
  $('saveBtn').onclick=saveProject; $('openBtn').onclick=()=>{ $('menuDlg').close(); $('openInput').click(); }; $('openInput').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; if(f) openProject(f); };
  $('scriptView').onclick=()=>$('scriptView').hidden=true; $('tplBtn').onclick=()=>{ $('menuDlg').close(); Template.open(); }; $('menuBtn').onclick=()=>$('menuDlg').showModal(); $('menuClose').onclick=()=>$('menuDlg').close(); $('helpBtn').onclick=()=>{ $('menuDlg').close(); $('helpDlg').showModal(); }; $('helpClose').onclick=()=>$('helpDlg').close();
  $('exportBtn').onclick=()=>{ const ss=project.scenes.filter(s=>s.take); if(!ss.length){ toast('Record a scene first.'); return; } const skipped=project.scenes.length-ss.length; $('expInfo').textContent=`${ss.length} scene${ss.length>1?'s':''}, ${fmt(ss.reduce((a,s)=>a+s.take.dur,0))} long.`+(skipped?` ${skipped} scene${skipped>1?'s have':' has'} no recording and will be skipped.`:''); $('expKindWrap').hidden=ss.length<2; document.querySelector('input[name=expKind][value=all]').checked=true; $('expSetup').hidden=false; $('expRun').hidden=true; $('expDone').hidden=true; $('exportDlg').showModal(); };
  $('expCancelRun').onclick=()=>{ expCancel=true; $('expCancelRun').disabled=true; $('expStatus').textContent='Stopping…'; }; $('exportDlg').addEventListener('cancel',e=>{ if(!$('expRun').hidden) e.preventDefault(); }); $('expZip').onclick=downloadZip;
  $('expCancel').onclick=$('expClose').onclick=()=>{ $('expVideo').pause(); $('exportDlg').close(); }; $('expGo').onclick=runExport;
  window.addEventListener('keydown',e=>{
    const tag=e.target.tagName; if(tag==='INPUT'&&e.target.type!=='range'&&e.target.type!=='checkbox'||tag==='SELECT'||document.querySelector('dialog[open]')) return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?redo():undo(); return; } if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); return; } if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){ e.preventDefault(); saveProject(); return; } if(e.ctrlKey||e.metaKey) return;
    if(e.key==='Escape'&&linkPick){ linkCancel(); return; }
    if(e.key==='Escape'){ if(mode==='rec') stopRecording(); if(mode==='play') stopPlay(); return; }
    if(mode==='setup'&&(e.key==='r'||e.key==='R')){ startRecording(false); return; }
    if(/^[1-9]$/.test(e.key)&&(mode==='rec'||mode==='setup')){ const r=scenePads()[+e.key-1]; if(r) hitPad(r); return; }
    if(mode!=='setup'&&mode!=='rec') return;
    if(e.key==='Tab'&&document.activeElement===cv){ const it=cur().items.filter(x=>mode!=='rec'||!x.fixed); if(it.length){ e.preventDefault(); const i=it.findIndex(x=>x.id===selId); selId=it[(i+(e.shiftKey?-1:1)+it.length)%it.length].id; updateItemBar(); } return; }
    const it=sel(); if(!it) return; const st=e.shiftKey?40:10; let done=true; const once=()=>{ if(mode==='setup'&&!e.repeat) checkpoint(); return target(it); };
    const nudge=(dx,dy)=>{ const q=once(),[cx,cy]=centreW(it,q); placeCentre(it,q,cx+dx,cy+dy); };
    if(e.key==='f'||e.key==='F'){ flip(); e.preventDefault(); return; }
    if(e.key==='Delete'||e.key==='Backspace'){ if(mode==='setup') removeSel(); e.preventDefault(); return; }
    keepKids(it,()=>{ switch(e.key){ case 'ArrowLeft': nudge(-st,0); break; case 'ArrowRight': nudge(st,0); break; case 'ArrowUp': nudge(0,-st); break; case 'ArrowDown': nudge(0,st); break; case '[': once().s*=.94; break; case ']': once().s*=1.06; break; case ',': once().r-=.08; break; case '.': once().r+=.08; break; case 'f': case 'F': flip(); break; case 'Delete': case 'Backspace': if(mode==='setup') removeSel(); break; default: done=false; }
    if(done){ const p=mode==='rec'?live.get(it.id):it; if(p) clampFor(it,p); } });
    if(done){ e.preventDefault(); dirtyIf(); }
  });
  window.addEventListener('beforeunload',()=>{ clearTimeout(saveT); });
}

/* ---------- start ---------- */
(async()=>{
  project=newProject(); curId=project.scenes[0].id; wire(); resize(); refreshAll(); rafId=requestAnimationFrame(tick); micInit();
  window.CutoutApp={get project(){ return project; },get mode(){ return mode; },get playing(){ return playing&&{id:playing.scene.id,t:playing.t,ended:playing.ended}; },get queue(){ return playQueue.length; },poseAt,mats:(s,f,t,a)=>sceneMats(s,f,t,a),selName:()=>sel()&&nameOf(sel()),select:i=>{ selId=cur().items[i].id; updateItemBar(); },livePose:id=>{ const p=live.get(id); return p&&{x:Math.round(p.x),y:Math.round(p.y)}; }};
  const saved=await loadAuto();
  if(saved&&(saved.cast?.length||saved.pads?.length||saved.scenes?.some(s=>s.take||s.items?.length))){
    const when=saved.savedAt?new Date(saved.savedAt).toLocaleString():'earlier';
    const v=await ask('Carry on with “'+saved.name+'”?','Last worked on '+when+'. Starting new clears it from this device.',[['Start new',0],['Carry on',1,'primary']]);
    if(v){ await adopt(saved); refreshAll(); } else autosave();
  }
})();
})();
