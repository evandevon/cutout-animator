'use strict';
/* Printable template sheets: find the corner squares, straighten the page, pull out each box.
   Measurements are millimetres on a landscape A4 sheet. Printing it larger (e.g. A3) works the same.
   tools/make_templates.py draws the PDFs from these same numbers. */
const Template=(()=>{
  const $=id=>document.getElementById(id);
  const L={W:297,H:210,marks:[[13,13],[284,13],[284,197],[13,197]],
    bg:{x:10,y:22,w:160,h:90},script:{x:10,y:118,w:160,h:70},
    chars:[{x:176,y:22,w:53,h:38},{x:234,y:22,w:53,h:38},{x:176,y:72,w:53,h:38},{x:234,y:72,w:53,h:38}],
    tickSize:6,animDy:39.5,animSize:5,animDx:[0,13.5,27,40.5],cols:[176,201],rowY:i=>128+i*9.5};
  const AMB=[['syn:rain','Rain'],['syn:wind','Wind'],['syn:ocean','Ocean'],['syn:forest','Forest']];
  const MUS=[['mus:happy','Happy'],['mus:adventure','Adventure'],['mus:spooky','Spooky'],['mus:sleepy','Sleepy']];
  const ANIM=[['sway','Sway'],['hop','Hop'],['float','Float'],['spin','Spin']];
  // Blank paper between the boxes: used to measure the lighting across the page, so shadows and warm light can be evened out.
  const PAPER=[]; for(let y=30;y<=185;y+=15){ PAPER.push([5,y],[292,y],[173,y]); } for(let y=26;y<=58;y+=8) PAPER.push([231.5,y],[231.5,y+50]); for(let y=132;y<=176;y+=11) PAPER.push([209.5,y],[246,y]); for(let x=30;x<=270;x+=20) PAPER.push([x,191]);
  const INSET=2, DETECT_EDGE=1000, WORK_EDGE=2200, PX_MM=6;

  /* ---- finding the page ---- */
  function detect(cv){
    const k=Math.min(1,DETECT_EDGE/Math.max(cv.width,cv.height)),w=Math.max(8,Math.round(cv.width*k)),h=Math.max(8,Math.round(cv.height*k));
    const c=document.createElement('canvas'); c.width=w;c.height=h; const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(cv,0,0,w,h);
    const d=g.getImageData(0,0,w,h).data,N=w*h,gray=new Uint8Array(N),hist=new Uint32Array(256);
    for(let i=0,q=0;i<N;i++,q+=4){ const v=(d[q]*3+d[q+1]*6+d[q+2])/10|0; gray[i]=v; hist[v]++; }
    let acc=0,paper=255; for(let v=0;v<256;v++){ acc+=hist[v]; if(acc>N*.6){ paper=v; break; } }
    const cut=Math.max(35,paper*.5),lab=new Int32Array(N),comps=[],long=Math.max(w,h),stack=[];
    for(let s=0;s<N;s++){ if(gray[s]>=cut||lab[s]) continue; const id=comps.length+1; let x0=w,x1=0,y0=h,y1=0,n=0; stack.length=0; stack.push(s); lab[s]=id;
      while(stack.length){ const i=stack.pop(),x=i%w,y=(i/w)|0; n++; if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
        if(x>0&&gray[i-1]<cut&&!lab[i-1]){lab[i-1]=id;stack.push(i-1);} if(x<w-1&&gray[i+1]<cut&&!lab[i+1]){lab[i+1]=id;stack.push(i+1);}
        if(y>0&&gray[i-w]<cut&&!lab[i-w]){lab[i-w]=id;stack.push(i-w);} if(y<h-1&&gray[i+w]<cut&&!lab[i+w]){lab[i+w]=id;stack.push(i+w);} }
      comps.push({x0,x1,y0,y1,n}); }
    const cand=comps.map(o=>{ const bw=o.x1-o.x0+1,bh=o.y1-o.y0+1; return {...o,bw,bh,cx:(o.x0+o.x1)/2,cy:(o.y0+o.y1)/2,fill:o.n/(bw*bh)}; })
      .filter(o=>{ const a=o.bw/o.bh,m=Math.max(o.bw,o.bh); return a>.55&&a<1.8&&m>long*.009&&m<long*.07&&o.fill>.55; });
    if(cand.length<4) return null;
    const corners=[[0,0],[w,0],[w,h],[0,h]],picked=[];
    for(const [X,Y] of corners){ let best=null,bd=1e12; for(const o of cand){ const D=Math.hypot(o.cx-X,o.cy-Y); if(D<bd&&!picked.includes(o)){ bd=D; best=o; } } if(!best) return null; picked.push(best); }
    const sizes=picked.map(o=>Math.max(o.bw,o.bh)); if(Math.max(...sizes)>Math.min(...sizes)*2.2) return null; // must be alike: rules out stray drawing marks
    // The top-left square has a white centre, which shows which way up the page is.
    const hollow=picked.map(o=>{ const r=Math.max(1,o.bw*.12|0); let lit=0,t=0; for(let y=o.cy-r|0;y<=o.cy+r;y++)for(let x=o.cx-r|0;x<=o.cx+r;x++){ t++; if(gray[y*w+x]>=cut) lit++; } return lit/t; });
    let start=0; hollow.forEach((v,i)=>{ if(v>hollow[start]) start=i; }); if(hollow[start]<.5) return null;
    if(hollow.filter(v=>v>.5).length!==1) return null;
    const pts=[0,1,2,3].map(i=>{ const o=picked[(start+i)%4]; return [o.cx/k,o.cy/k]; });
    // Going clockwise round the page, the far side must be longer than the near side for a landscape sheet.
    const len=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),top=len(pts[0],pts[1]),side=len(pts[1],pts[2]); const r=top/side,want=(L.marks[1][0]-L.marks[0][0])/(L.marks[2][1]-L.marks[1][1]);
    if(r<want*.6||r>want*1.6) return null;
    return {pts,paper};
  }
  function homography(from,to){ // maps template millimetres to image pixels
    const A=[]; for(let i=0;i<4;i++){ const [x,y]=from[i],[u,v]=to[i]; A.push([x,y,1,0,0,0,-u*x,-u*y,u]); A.push([0,0,0,x,y,1,-v*x,-v*y,v]); }
    for(let i=0;i<8;i++){ let p=i; for(let r=i+1;r<8;r++) if(Math.abs(A[r][i])>Math.abs(A[p][i])) p=r; [A[i],A[p]]=[A[p],A[i]]; const f=A[i][i]; if(!f) return null; for(let c=i;c<9;c++) A[i][c]/=f; for(let r=0;r<8;r++) if(r!==i){ const m=A[r][i]; if(m) for(let c=i;c<9;c++) A[r][c]-=m*A[i][c]; } }
    return [A[0][8],A[1][8],A[2][8],A[3][8],A[4][8],A[5][8],A[6][8],A[7][8],1];
  }
  function lightField(src,sw,sh,H){ // fit a smooth curved surface per colour channel to the paper samples
    const pts=[]; for(const [x,y] of PAPER){ const c=warp(src,sw,sh,H,{x:x-1.5,y:y-1.5,w:3,h:3},4,null),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,ch=[[],[],[]]; for(let q=0;q<d.length;q+=4) for(let k=0;k<3;k++) ch[k].push(d[q+k]); pts.push([x/297,y/210,...ch.map(a=>{ a.sort((m,n)=>m-n); return a[Math.floor(a.length*.75)]; })]); }
    const basis=(u,v)=>[1,u,v,u*u,u*v,v*v],coef=[];
    for(let k=0;k<3;k++){ const A=Array.from({length:6},()=>new Array(7).fill(0)); for(const p of pts){ const b=basis(p[0],p[1]); for(let i=0;i<6;i++){ for(let j=0;j<6;j++) A[i][j]+=b[i]*b[j]; A[i][6]+=b[i]*p[2+k]; } }
      for(let i=0;i<6;i++) A[i][i]+=1e-6; for(let i=0;i<6;i++){ let pv=i; for(let r=i+1;r<6;r++) if(Math.abs(A[r][i])>Math.abs(A[pv][i])) pv=r; [A[i],A[pv]]=[A[pv],A[i]]; const f=A[i][i]; for(let c=i;c<7;c++) A[i][c]/=f; for(let r=0;r<6;r++) if(r!==i){ const m=A[r][i]; for(let c=i;c<7;c++) A[r][c]-=m*A[i][c]; } }
      coef.push(A.map(r=>r[6])); }
    return (mx,my)=>{ const b=basis(mx/297,my/210); return coef.map(cf=>{ let v=0; for(let i=0;i<6;i++) v+=cf[i]*b[i]; return 250/Math.max(40,Math.min(255,v)); }); };
  }
  function warp(src,sw,sh,H,b,pxmm,light){ // bilinear sample of one box, straightened
    const w=Math.round(b.w*pxmm),h=Math.round(b.h*pxmm),c=document.createElement('canvas'); c.width=w;c.height=h; const g=c.getContext('2d'),o=g.createImageData(w,h),out=o.data;
    for(let j=0,q=0;j<h;j++){ const my=b.y+(j+.5)/pxmm; for(let i=0;i<w;i++,q+=4){ const mx=b.x+(i+.5)/pxmm,z=H[6]*mx+H[7]*my+1,u=(H[0]*mx+H[1]*my+H[2])/z,v=(H[3]*mx+H[4]*my+H[5])/z,x0=u|0,y0=v|0;
        if(x0<0||y0<0||x0>=sw-1||y0>=sh-1){ out[q]=out[q+1]=out[q+2]=255; out[q+3]=255; continue; }
        const fx=u-x0,fy=v-y0,p=(y0*sw+x0)*4,a=(1-fx)*(1-fy),bb=fx*(1-fy),cc=(1-fx)*fy,dd=fx*fy;
        const g=light?light(mx,my):null; for(let k=0;k<3;k++){ const v=src[p+k]*a+src[p+4+k]*bb+src[p+sw*4+k]*cc+src[p+sw*4+4+k]*dd; out[q+k]=g?v*g[k]:v; } out[q+3]=255; } }
    g.putImageData(o,0,0); return c;
  }
  const inset=b=>({x:b.x+INSET,y:b.y+INSET,w:b.w-INSET*2,h:b.h-INSET*2});
  function unprint(c,x,y,w,h,pm){ // whiten the printed grey box border, but not children's ink drawn over it
    const g=c.getContext('2d',{willReadFrequently:true}),o=g.getImageData(0,0,c.width,c.height),d=o.data,W=c.width,band=.8*pm;
    for(let j=0;j<c.height;j++)for(let i=0;i<W;i++){ const near=(Math.abs(i-x)<band||Math.abs(i-x-w)<band)&&j>y-band&&j<y+h+band||(Math.abs(j-y)<band||Math.abs(j-y-h)<band)&&i>x-band&&i<x+w+band; if(!near) continue;
      const q=(j*W+i)*4,mx=Math.max(d[q],d[q+1],d[q+2]),mn=Math.min(d[q],d[q+1],d[q+2]); if(mx-mn<28&&mn>140) d[q]=d[q+1]=d[q+2]=250; }
    g.putImageData(o,0,0);
  }
  function inked(c,paper){ const d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data; let n=0; const lim=paper*.78; for(let q=0;q<d.length;q+=4){ const mx=Math.max(d[q],d[q+1],d[q+2]),mn=Math.min(d[q],d[q+1],d[q+2]); if((d[q]+d[q+1]+d[q+2])/3<lim||mx-mn>40) n++; } return n/(d.length/4); }
  function whiten(c,paper){ const g=Math.min(1.6,Math.max(1,250/paper)); if(g<=1.01) return c; const x=c.getContext('2d'),o=x.getImageData(0,0,c.width,c.height),d=o.data; for(let q=0;q<d.length;q+=4){ d[q]*=g;d[q+1]*=g;d[q+2]*=g; } x.putImageData(o,0,0); return c; }

  /* ---- one sheet ---- */
  async function processCanvas(cv,name){
    const f=detect(cv); if(!f) return {name,error:"Couldn't find the four corner squares"};
    const sw=cv.width,sh=cv.height,src=cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,sw,sh).data,H=homography(L.marks,f.pts); if(!H) return {name,error:'The page is too skewed'};
    const light=lightField(src,sw,sh,H),P=250;
    const tick=(x,y,s=L.tickSize)=>{ const c=warp(src,sw,sh,H,{x:x+1.1,y:y+1.1,w:s-2.2,h:s-2.2},8,light); return inked(c,P)>.16; };
    const pickOne=(list,col)=>{ const i=list.findIndex((_,n)=>tick(L.cols[col],L.rowY(n))); return i<0?null:list[i][0]; };
    const bgC=warp(src,sw,sh,H,inset(L.bg),10,light),scriptC=warp(src,sw,sh,H,inset(L.script),9,light);
    const sheet={name,amb:pickOne(AMB,0),mus:pickOne(MUS,1),chars:[],
      bg:inked(bgC,P)>.004?bgC:null,script:inked(scriptC,P)>.003?scriptC:null};
    for(const b of L.chars){
      // Look a little past the box, in case the drawing goes over its edge.
      const pm=PX_MM*1.4,M=8,big={x:Math.max(3,b.x-M),y:Math.max(3,b.y-M),w:0,h:0}; big.w=Math.min(294,b.x+b.w+M)-big.x; big.h=Math.min(207,b.y+b.h+M)-big.y;
      const c=warp(src,sw,sh,H,big,pm,light),ib=inset(b),rect=[ib.x-big.x,ib.y-big.y,ib.x+ib.w-big.x,ib.y+ib.h-big.y].map(v=>Math.round(v*pm));
      unprint(c,(b.x-big.x)*pm,(b.y-big.y)*pm,b.w*pm,b.h*pm,pm);
      const tol=1.2,outer=[b.x-tol-big.x,b.y-tol-big.y,b.x+b.w+tol-big.x,b.y+b.h+tol-big.y].map(v=>Math.round(v*pm)),cut=await Cut.autoCut(c,rect,outer); if(!cut) continue;
      let raw=c,r2=rect; if(!cut.outside){ raw=document.createElement('canvas'); const bx=[b.x-big.x,b.y-big.y].map(v=>Math.round(v*pm)); raw.width=Math.round(b.w*pm); raw.height=Math.round(b.h*pm); raw.getContext('2d').drawImage(c,-bx[0],-bx[1]); r2=[rect[0]-bx[0],rect[1]-bx[1],rect[2]-bx[0],rect[3]-bx[1]]; }
      const k=L.animDx.findIndex(dx=>tick(b.x+dx,b.y+L.animDy,L.animSize)); sheet.chars.push({raw,rect:r2,cut,over:cut.outside,anim:k<0?null:ANIM[k][0]}); }
    if(!sheet.bg&&!sheet.script&&!sheet.chars.length) sheet.error='This sheet looks blank';
    return sheet;
  }
  const toWork=(img,w,h)=>{ const k=Math.min(1,WORK_EDGE/Math.max(w,h)),c=document.createElement('canvas'); c.width=Math.round(w*k); c.height=Math.round(h*k); c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,c.width,c.height); return c; };
  async function pagesOf(file,each){
    const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
    if(isPdf){ if(!window.pdfjsLib) throw new Error('PDF reader missing'); pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf/pdf.worker.min.js'; const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
      for(let p=1;p<=pdf.numPages;p++){ const page=await pdf.getPage(p),v0=page.getViewport({scale:1}),v=page.getViewport({scale:Math.min(4,WORK_EDGE/Math.max(v0.width,v0.height))}),c=document.createElement('canvas'); c.width=v.width|0;c.height=v.height|0; await page.render({canvasContext:c.getContext('2d',{willReadFrequently:true}),viewport:v}).promise; page.cleanup(); await each(c,file.name+' p'+p,pdf.numPages); } pdf.destroy(); return; }
    let bmp; try{ bmp=await createImageBitmap(file,{imageOrientation:'from-image'}); }catch(_){ bmp=null; }
    if(bmp){ const c=toWork(bmp,bmp.width,bmp.height); bmp.close&&bmp.close(); await each(c,file.name,1); return; }
    const u=URL.createObjectURL(file),im=new Image(); im.src=u; await im.decode(); const c=toWork(im,im.naturalWidth,im.naturalHeight); URL.revokeObjectURL(u); await each(c,file.name,1);
  }

  /* ---- dialog ---- */
  let sheets=[],onAdd=null,toast=()=>{},stream=null,camT=0,devs=[],devI=0,busy=false;
  const tick=()=>new Promise(r=>setTimeout(r));
  async function addFiles(files){
    if(busy) return; busy=true; $('tplAdd').disabled=true; const t0=performance.now(); let done=0;
    for(const file of files){ try{ await pagesOf(file,async(c,nm,total)=>{ $('tplStatus').textContent=`Reading sheet ${sheets.length+1}…`; await tick(); const s=await processCanvas(c,nm); sheets.push(s); done++; renderRow(s); $('tplRows').lastChild?.scrollIntoView({block:'nearest'}); count(); await tick(); }); }
      catch(e){ console.warn(e); const s={name:file.name,error:"That file couldn't be opened"}; sheets.push(s); renderRow(s); } }
    busy=false; window.__tplLast={sheets:done,ms:performance.now()-t0}; count();
  }
  const usable=()=>sheets.filter(s=>!s.error);
  function count(){ const n=usable().length,bad=sheets.length-n; $('tplStatus').textContent=sheets.length?`${n} sheet${n===1?'':'s'} ready`+(bad?`, ${bad} need${bad===1?'s':''} another try`:''):''; $('tplAdd').disabled=!n||busy; $('tplAdd').textContent=n?`✓ Add ${n} scene${n===1?'':'s'}`:'✓ Add scenes'; $('tplEmpty').hidden=!!sheets.length; }
  function canvasThumb(c,cls){ const im=new Image(); im.src=c.toDataURL('image/jpeg',.7); im.alt=''; im.className=cls||''; return im; }
  const labelOf=(list,r)=>(list.find(x=>x[0]===r)||[])[1];
  function renderRow(s){
    const row=document.createElement('div'); row.className='tplRow'+(s.error?' bad':''); s.row=row;
    const head=document.createElement('div'); head.className='tplHead'; const b=document.createElement('b'); b.textContent=s.error?s.error:s.name; head.append(b);
    const del=document.createElement('button'); del.className='small'; del.textContent='✕'; del.setAttribute('aria-label','Remove this sheet'); del.onclick=()=>{ sheets=sheets.filter(x=>x!==s); row.remove(); count(); }; head.append(del); row.append(head);
    if(s.error){ const p=document.createElement('p'); p.className='hint'; p.textContent=s.name+'. Make sure all four corner squares are in the picture, then try again.'; row.append(p); $('tplRows').append(row); return; }
    const w=document.createElement('div'); w.className='tplThumbs';
    const fig=(cap,el)=>{ const f=document.createElement('figure'); f.append(el); const c=document.createElement('figcaption'); c.textContent=cap; f.append(c); w.append(f); return f; };
    if(s.bg) fig('Backdrop',canvasThumb(s.bg)); else { const e=document.createElement('div'); e.className='tplNone'; e.textContent='none'; fig('Backdrop',e); }
    s.chars.forEach((ch,i)=>{ const btn=document.createElement('button'); btn.className='thumb'; btn.title='Tap to fix this cutout'; btn.setAttribute('aria-label','Fix character '+(i+1)); const im=new Image(); im.alt=''; im.src=URL.createObjectURL(ch.cut.blob); btn.append(im);
      btn.onclick=()=>Cut.edit(ch.raw,cut=>{ ch.cut=cut; im.src=URL.createObjectURL(cut.blob); },ch.rect); const cap=(ch.anim?ANIM.find(a=>a[0]===ch.anim)[1]:'Still')+(ch.over?' · past the box':''); const f=fig(cap,btn); if(ch.over){ f.classList.add('over'); btn.title='This drawing went past its box. Tap to check it.'; } });
    if(s.script) fig('Script',canvasThumb(s.script,'wideimg'));
    row.append(w);
    const a=document.createElement('p'); a.className='hint'; const parts=[]; if(s.amb) parts.push('Background sound: '+labelOf(AMB,s.amb)); if(s.mus) parts.push('Music: '+labelOf(MUS,s.mus)); a.textContent=parts.join(' · ')||'No sounds ticked'; row.append(a);
    $('tplRows').append(row);
  }
  function stopCam(){ clearInterval(camT); if(stream) stream.getTracks().forEach(t=>t.stop()); stream=null; $('tplVideo').srcObject=null; $('tplCam').hidden=true; }
  function grab(){ const v=$('tplVideo'); if(!v.videoWidth) return null; return toWork(v,v.videoWidth,v.videoHeight); }
  async function startCam(){ if(stream){ stopCam(); return; } $('tplCam').hidden=false; const st=$('tplCamMsg'); st.textContent='Starting camera…';
    try{ const c={width:{ideal:2560},height:{ideal:1440}}; if(devs[devI]) c.deviceId={exact:devs[devI].deviceId}; else c.facingMode={ideal:'environment'}; stream=await navigator.mediaDevices.getUserMedia({video:c,audio:false}); const v=$('tplVideo'); v.srcObject=stream; await v.play().catch(()=>{}); devs=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput'); $('tplCamNext').hidden=devs.length<2;
      camT=setInterval(()=>{ const g=grab(); if(!g) return; const ok=detect(g); st.textContent=ok?'✓ Sheet found. Press Capture.':'Show the whole sheet with all four corner squares'; st.classList.toggle('found',!!ok); $('tplSnap').classList.toggle('primary',!!ok); },450);
    }catch(e){ st.textContent="The camera isn't available on this device."; stream=null; } }
  async function snap(){ const g=grab(); if(!g||busy) return; const st=$('tplCamMsg'); busy=true; const s=await processCanvas(g,'Webcam sheet '+(sheets.length+1)); busy=false; if(s.error){ st.textContent=s.error+'. Try again.'; return; } sheets.push(s); renderRow(s); count(); toast('Got it. Put the next sheet under the camera.'); }
  function close(){ stopCam(); $('tplDlg').close(); }
  function open(){ sheets=[]; $('tplRows').innerHTML=''; count(); $('tplDlg').showModal(); }
  function init(o){ ({onAdd,toast}=o);
    $('tplChoose').onclick=()=>$('tplInput').click(); $('tplInput').onchange=e=>{ const f=[...e.target.files]; e.target.value=''; if(f.length) addFiles(f); };
    $('tplWebcam').onclick=startCam; $('tplSnap').onclick=snap; $('tplCamNext').onclick=()=>{ devI=(devI+1)%devs.length; stopCam(); startCam(); };
    $('tplClose').onclick=close; $('tplDlg').addEventListener('cancel',stopCam);
    $('tplAdd').onclick=async()=>{ const u=usable(); if(!u.length) return; $('tplAdd').disabled=true; await onAdd(u); close(); };
    const d=$('tplDlg'); d.addEventListener('dragover',e=>e.preventDefault()); d.addEventListener('drop',e=>{ e.preventDefault(); const f=[...e.dataTransfer.files]; if(f.length) addFiles(f); });
    d.addEventListener('keydown',e=>{ if(e.code==='Space'&&stream&&!$('capDlg').open&&e.target.tagName!=='BUTTON'){ e.preventDefault(); snap(); } });
  }
  return {init,open,L,AMB,MUS,ANIM,detect,processCanvas};
})();
