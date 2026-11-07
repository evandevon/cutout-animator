'use strict';
/* Take or choose a photo, then cut the drawing out. Paper removal is the Classroom Aquarium
   method (seed dark/coloured pixels, grow, flood the paper in from the edges, tidy up), with
   additions for puppets: lighting is normalised to the paper's own brightness, white areas
   enclosed by the drawing can be kept, and small specks are dropped. */
const Cut = (() => {
  const $=id=>document.getElementById(id);
  const MAX_EDGE=1200, OUT_EDGE=1000;
  let onCutout=null,onBackdrop=null,toast=()=>{};
  let stream=null,devices=[],devIdx=0,mode='cutout';
  let whiteGain=1,src=null,W=0,H=0,pix=null,hasAlpha=false,auto=null,edit=null,undo=[],tool='lasso',view=null,stroke=null;
  const cv=$('cutCanvas'), cx=cv.getContext('2d');

  function autoMask(p,w,h,threshold,keepHoles){
    const N=w*h, st=new Uint8Array(N), bright=new Float32Array(N), cw=new Float32Array(N);
    const samples=[]; const add=i=>{ const q=i*4; samples.push((p[q]+p[q+1]+p[q+2])/3); };
    const step=Math.max(1,Math.floor((w+h)/400));
    for(let x=0;x<w;x+=step){ add(x); add((h-1)*w+x); } for(let y=0;y<h;y+=step){ add(y*w); add(y*w+w-1); }
    samples.sort((a,b)=>a-b);
    const paper=Math.max(60,samples[Math.floor(samples.length*.6)]||255), gain=Math.min(2.2,235/paper);
    whiteGain=Math.min(1.6,Math.max(1,250/paper));
    const DARK=threshold*.6, SAT=34, WHITE=225, BIAS=35;
    const ccx=(w-1)/2,ccy=(h-1)/2,maxR=Math.hypot(ccx,ccy);
    for(let i=0,q=0;i<N;i++,q+=4){
      const r=p[q],g=p[q+1],b=p[q+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b),br=(r+g+b)/3*gain;
      bright[i]=br; const x=i%w,y=(i/w)|0; const k=Math.max(0,1-Math.hypot(x-ccx,y-ccy)/maxR); cw[i]=k;
      st[i]=((mx-mn)*gain>=SAT||br<=DARK+BIAS*k)?1:0;
    }
    for(let pass=0;pass<3;pass++){
      const addl=[];
      for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){ const i=y*w+x; if(st[i]||bright[i]>WHITE) continue;
        const n=(st[i-1]?1:0)+(st[i+1]?1:0)+(st[i-w]?1:0)+(st[i+w]?1:0)+(st[i-w-1]?1:0)+(st[i-w+1]?1:0)+(st[i+w-1]?1:0)+(st[i+w+1]?1:0);
        if(n>=4-2*cw[i]) addl.push(i); }
      if(!addl.length) break; for(const i of addl) st[i]=1;
    }
    const stack=[], seed=i=>{ if(st[i]===0){ st[i]=2; stack.push(i); } };
    for(let x=0;x<w;x++){ seed(x); seed((h-1)*w+x); } for(let y=0;y<h;y++){ seed(y*w); seed(y*w+w-1); }
    while(stack.length){ const i=stack.pop(),x=i%w;
      if(x>0&&st[i-1]===0){st[i-1]=2;stack.push(i-1);} if(x<w-1&&st[i+1]===0){st[i+1]=2;stack.push(i+1);}
      if(i>=w&&st[i-w]===0){st[i-w]=2;stack.push(i-w);} if(i<N-w&&st[i+w]===0){st[i+w]=2;stack.push(i+w);} }
    // st===0 now means enclosed by the drawing, such as an uncoloured face inside its outline.
    let keep=new Uint8Array(N); for(let i=0;i<N;i++) keep[i]=st[i]===1||(keepHoles&&st[i]===0)?1:0;
    const morph=(s,er)=>{ const o=new Uint8Array(N); for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const i=y*w+x; let on=0;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ const xx=x+dx,yy=y+dy; if(xx>=0&&yy>=0&&xx<w&&yy<h&&s[yy*w+xx]) on++; }
        o[i]=er?(9-on>=6?0:s[i]):(on>=6?1:s[i]); } return o; };
    keep=morph(morph(keep,true),false);
    // Drop specks: islands much smaller than the biggest piece.
    const lab=new Int32Array(N),sizes=[0]; let id=0;
    for(let i=0;i<N;i++){ if(!keep[i]||lab[i]) continue; id++; let c=0; const s=[i]; lab[i]=id;
      while(s.length){ const j=s.pop(),x=j%w; c++;
        if(x>0&&keep[j-1]&&!lab[j-1]){lab[j-1]=id;s.push(j-1);} if(x<w-1&&keep[j+1]&&!lab[j+1]){lab[j+1]=id;s.push(j+1);}
        if(j>=w&&keep[j-w]&&!lab[j-w]){lab[j-w]=id;s.push(j-w);} if(j<N-w&&keep[j+w]&&!lab[j+w]){lab[j+w]=id;s.push(j+w);} }
      sizes.push(c); }
    const big=Math.max(0,...sizes), min=Math.max(12,Math.min(big*.004,N*.0004));
    for(let i=0;i<N;i++) if(keep[i]&&sizes[lab[i]]<min) keep[i]=0;
    return keep;
  }

  /* Keep only the pieces that reach into rect [x0,y0,x1,y1]: a drawing that goes past its box comes along whole,
     while labels, tickboxes and neighbouring drawings around it are left out (Add brings them back if wanted). */
  function inRect(keep,w,h,r){
    const lab=new Int32Array(w*h),ok=[false]; let id=0; const st=[];
    for(let s=0;s<w*h;s++){ if(!keep[s]||lab[s]) continue; id++; let hit=false; st.length=0; st.push(s); lab[s]=id;
      while(st.length){ const i=st.pop(),x=i%w,y=(i/w)|0; if(!hit&&x>=r[0]&&x<r[2]&&y>=r[1]&&y<r[3]) hit=true;
        if(x>0&&keep[i-1]&&!lab[i-1]){lab[i-1]=id;st.push(i-1);} if(x<w-1&&keep[i+1]&&!lab[i+1]){lab[i+1]=id;st.push(i+1);}
        if(i>=w&&keep[i-w]&&!lab[i-w]){lab[i-w]=id;st.push(i-w);} if(i<w*h-w&&keep[i+w]&&!lab[i+w]){lab[i+w]=id;st.push(i+w);} }
      ok.push(hit); }
    const out=new Uint8Array(w*h); for(let i=0;i<w*h;i++) if(keep[i]&&ok[lab[i]]) out[i]=1; return out;
  }
  let editRect=null;
  function recompute(){
    whiteGain=1;
    if(hasAlpha){ auto=new Uint8Array(W*H); for(let i=0;i<W*H;i++) auto[i]=pix[i*4+3]>128?1:0; }
    else if($('autoPaper').checked){ auto=autoMask(pix,W,H,+$('thresh').value,$('keepHoles').checked); if(editRect) auto=inRect(auto,W,H,editRect); }
    else auto=new Uint8Array(W*H).fill(1);
    $('threshWrap').style.opacity=$('holesWrap').style.opacity=$('autoPaper').checked?1:.4;
    draw();
  }
  const kept=i=>edit[i]===1||(auto[i]&&edit[i]!==-1);

  const maskCv=document.createElement('canvas');
  let hover=null;
  function draw(rebuild=true){
    if(!src) return;
    fit();
    if(rebuild){ maskCv.width=W; maskCv.height=H; const m=maskCv.getContext('2d'), d=m.createImageData(W,H);
    for(let i=0,q=0;i<W*H;i++,q+=4) if(kept(i)){ d.data[q]=pix[q]*whiteGain;d.data[q+1]=pix[q+1]*whiteGain;d.data[q+2]=pix[q+2]*whiteGain;d.data[q+3]=255; }
    m.putImageData(d,0,0); }
    cx.setTransform(1,0,0,1,0,0); cx.clearRect(0,0,cv.width,cv.height);
    const sq=Math.ceil(12*view.dpr); for(let y=0;y<cv.height;y+=sq)for(let x=0;x<cv.width;x+=sq){ cx.fillStyle=((x+y)/sq)%2?'#cfe8e8':'#fff'; cx.fillRect(x,y,sq,sq); }
    cx.globalAlpha=.38; cx.drawImage(src,0,0,cv.width,cv.height); cx.globalAlpha=1; // faint original, so you can see what Add will bring back
    cx.drawImage(maskCv,0,0,cv.width,cv.height);
    if(stroke&&tool==='lasso'&&stroke.pts.length>1){ cx.beginPath(); stroke.pts.forEach((p,i)=>{ const X=p[0]*view.k,Y=p[1]*view.k; i?cx.lineTo(X,Y):cx.moveTo(X,Y); }); cx.strokeStyle='#e0301e'; cx.lineWidth=3*view.dpr; cx.setLineDash([10*view.dpr,6*view.dpr]); cx.stroke(); cx.setLineDash([]); }
    if(hover&&(tool==='erase'||tool==='restore')){ const R=+$('brush').value/2*view.dpr,X=hover[0]*view.k,Y=hover[1]*view.k; cx.beginPath(); cx.arc(X,Y,R,0,7); cx.lineWidth=3*view.dpr; cx.strokeStyle='#fff'; cx.stroke(); cx.lineWidth=1.5*view.dpr; cx.strokeStyle=tool==='erase'?'#e0301e':'#0b6e6e'; cx.setLineDash([5*view.dpr,4*view.dpr]); cx.stroke(); cx.setLineDash([]); }
  }
  function fit(){
    const box=cv.parentElement.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio||1), s=Math.min(box.width/W,box.height/H);
    const cw=Math.max(1,Math.floor(W*s)), ch=Math.max(1,Math.floor(H*s));
    if(cv.width!==Math.floor(cw*dpr)||cv.height!==Math.floor(ch*dpr)){ cv.width=Math.floor(cw*dpr); cv.height=Math.floor(ch*dpr); cv.style.width=cw+'px'; cv.style.height=ch+'px'; }
    view={k:cv.width/W,dpr,css:cw/W};
  }
  const pos=e=>{ const r=cv.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*W,(e.clientY-r.top)/r.height*H]; };
  const pushUndo=()=>{ undo.push(edit.slice()); if(undo.length>15) undo.shift(); };
  function stamp([x,y],val){ const r=+$('brush').value/ view.css/2; const x0=Math.max(0,Math.floor(x-r)),x1=Math.min(W-1,Math.ceil(x+r)),y0=Math.max(0,Math.floor(y-r)),y1=Math.min(H-1,Math.ceil(y+r));
    for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++) if((xx-x)**2+(yy-y)**2<=r*r) edit[yy*W+xx]=val; }
  function line(a,b,val){ const d=Math.hypot(b[0]-a[0],b[1]-a[1]), r=+$('brush').value/view.css/2, n=Math.max(1,Math.ceil(d/Math.max(1,r/2))); for(let i=0;i<=n;i++) stamp([a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n],val); }
  function magic([x,y]){
    const X=x|0,Y=y|0; if(X<0||Y<0||X>=W||Y>=H) return;
    const s=Y*W+X,q=s*4,R=pix[q],G=pix[q+1],B=pix[q+2],seen=new Uint8Array(W*H),st=[s]; seen[s]=1;
    while(st.length){ const i=st.pop(); edit[i]=-1; const j=i%W;
      for(const n of [j>0?i-1:-1,j<W-1?i+1:-1,i>=W?i-W:-1,i<W*H-W?i+W:-1]){ if(n<0||seen[n]) continue; const p=n*4;
        if(Math.abs(pix[p]-R)+Math.abs(pix[p+1]-G)+Math.abs(pix[p+2]-B)<70){ seen[n]=1; st.push(n); } } }
  }
  function lassoApply(pts){
    if(pts.length<3) return;
    const c=document.createElement('canvas'); c.width=W;c.height=H; const g=c.getContext('2d',{willReadFrequently:true});
    g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.closePath(); g.fill();
    const a=g.getImageData(0,0,W,H).data; for(let i=0;i<W*H;i++) if(a[i*4+3]<128) edit[i]=-1;
  }
  cv.addEventListener('pointerdown',e=>{ if(!src) return; cv.setPointerCapture(e.pointerId); e.preventDefault(); const p=pos(e); pushUndo();
    if(tool==='magic'){ magic(p); draw(); return; }
    stroke={pts:[p]}; if(tool!=='lasso'){ stamp(p,tool==='erase'?-1:1); draw(); } });
  cv.addEventListener('pointermove',e=>{ hover=pos(e); if(!stroke){ if(tool==='erase'||tool==='restore') draw(false); return; } const p=pos(e),l=stroke.pts[stroke.pts.length-1]; stroke.pts.push(p);
    if(tool!=='lasso') line(l,p,tool==='erase'?-1:1); draw(); });
  const end=e=>{ if(e&&e.pointerType&&e.pointerType!=='mouse') hover=null; if(!stroke) return; if(tool==='lasso') lassoApply(stroke.pts); stroke=null; draw(); };
  cv.addEventListener('pointerleave',e=>{ if(e.pointerType!=='mouse'&&stroke) return; hover=null; if(src) draw(false); }); $('brush').addEventListener('input',()=>{ if(src){ if(!hover){ const r=cv.getBoundingClientRect(); hover=[W/2,H/2]; } draw(false); } });
  cv.addEventListener('pointerup',end); cv.addEventListener('pointercancel',end);

  function setImage(source,sw,sh){
    const k=Math.min(1,MAX_EDGE/Math.max(sw,sh)); W=Math.max(2,Math.round(sw*k)); H=Math.max(2,Math.round(sh*k)); if(editRect&&k<1) editRect=editRect.map(v=>Math.round(v*k));
    src=document.createElement('canvas'); src.width=W; src.height=H;
    const g=src.getContext('2d',{willReadFrequently:true}); g.drawImage(source,0,0,W,H);
    pix=g.getImageData(0,0,W,H).data;
    hasAlpha=false; for(let i=3;i<pix.length;i+=4) if(pix[i]<250){ hasAlpha=true; break; }
    edit=new Int8Array(W*H); undo=[];
    stopCam(); $('capSource').hidden=true; $('capCut').hidden=false;
    $('cutDone').hidden=$('cutAnother').hidden=mode==='backdrop'; $('cutBackdrop').classList.toggle('primary',mode==='backdrop');
    document.querySelectorAll('#capCut .toolRow, #capCut .stack, #capCut .check').forEach(x=>x.style.display=mode==='backdrop'?'none':'');
    $('cutBackdrop').textContent=mode==='backdrop'?'✓ Use as backdrop':'Use whole photo as backdrop';
    requestAnimationFrame(recompute);
  }
  async function fromBlob(blob){
    const u=URL.createObjectURL(blob), im=new Image();
    try{ im.src=u; await im.decode(); setImage(im,im.naturalWidth,im.naturalHeight); }
    catch(_){ toast("That picture couldn't be opened. Try a PNG or JPEG."); }
    finally{ URL.revokeObjectURL(u); }
  }
  function rebake(fn,rot){
    const c=document.createElement('canvas'); c.width=rot?H:W; c.height=rot?W:H; const g=c.getContext('2d',{willReadFrequently:true}); fn(g,c); g.drawImage(src,0,0);
    const ne=new Int8Array(c.width*c.height), oW=W,oH=H;
    for(let y=0;y<oH;y++)for(let x=0;x<oW;x++){ const v=edit[y*oW+x]; if(!v) continue; const nx=rot?oH-1-y:oW-1-x, ny=rot?x:y; ne[ny*c.width+nx]=v; }
    src=c; W=c.width; H=c.height; pix=g.getImageData(0,0,W,H).data; edit=ne; undo=[]; recompute();
  }

  /* Bulk path for template sheets: no editor, default settings. */
  async function autoCut(canvas,rect,outer){
    const w=canvas.width,h=canvas.height,p=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data,saved=whiteGain,R=rect||[0,0,w,h],area=(R[2]-R[0])*(R[3]-R[1]),F=k=>rect?inRect(k,w,h,rect):k; let keep=F(autoMask(p,w,h,190,true)),cnt=0; for(let i=0;i<keep.length;i++) cnt+=keep[i]; let faint=false; if(cnt<area*.01){ keep=F(autoMask(p,w,h,262,true)); faint=true; } const g=whiteGain; whiteGain=saved;
    const ink=v=>faint?Math.max(0,255-(255-v*g)*2.4):v*g; // light pencil: darken the lines so they show up on the stage
    let x0=w,y0=h,x1=-1,y1=-1,n=0; for(let y=0;y<h;y++)for(let x=0;x<w;x++) if(keep[y*w+x]){ n++; if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y; }
    if(n<area*.002) return null;
    const O=outer||R,outside=!!rect&&(x0<O[0]||y0<O[1]||x1>=O[2]||y1>=O[3]);
    const cw=x1-x0+1,ch=y1-y0+1,c=document.createElement('canvas'); c.width=cw;c.height=ch; const x=c.getContext('2d'),d=x.createImageData(cw,ch);
    for(let yy=0;yy<ch;yy++)for(let xx=0;xx<cw;xx++){ const i=(yy+y0)*w+xx+x0; if(!keep[i]) continue; const q=i*4,o=(yy*cw+xx)*4; let s=0,t=0; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ const X=xx+x0+dx,Y=yy+y0+dy; if(X>=0&&Y>=0&&X<w&&Y<h){ s+=keep[Y*w+X]; t++; } } d.data[o]=ink(p[q]);d.data[o+1]=ink(p[q+1]);d.data[o+2]=ink(p[q+2]);d.data[o+3]=Math.round(255*Math.min(1,s/t*1.25)); }
    x.putImageData(d,0,0); const blob=await new Promise(r=>c.toBlob(r,'image/png')); return {blob,w:cw,h:ch,outside};
  }
  let fixDone=null;
  function editBox(canvas,done,rect){ fixDone=done; editRect=rect||null; mode='cutout'; $('capTitle').textContent='Fix this cutout'; $('capDlg').showModal(); setImage(canvas,canvas.width,canvas.height); $('cutBackdrop').hidden=$('cutAnother').hidden=$('cutRetake').hidden=true; $('cutDone').textContent='✓ Use this cutout'; }

  async function finish(another){
    let x0=W,y0=H,x1=-1,y1=-1; const k=new Uint8Array(W*H);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){ const i=y*W+x; if(kept(i)){ k[i]=1; if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y; } }
    if(x1<0){ toast('Nothing is left to keep. Try “Start again”.'); return; }
    const cw=x1-x0+1,ch=y1-y0+1,c=document.createElement('canvas'); c.width=cw;c.height=ch; const g=c.getContext('2d'),d=g.createImageData(cw,ch);
    for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){ const i=(y+y0)*W+x+x0,q=i*4,o=(y*cw+x)*4; if(!k[i]){ // transparent, but keep edge colour to avoid dark halos when scaled
          continue; }
      let s=0,n=0; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){ const xx=x+x0+dx,yy=y+y0+dy; if(xx>=0&&yy>=0&&xx<W&&yy<H){ s+=k[yy*W+xx]; n++; } }
      d.data[o]=pix[q]*whiteGain;d.data[o+1]=pix[q+1]*whiteGain;d.data[o+2]=pix[q+2]*whiteGain;d.data[o+3]=Math.round(255*Math.min(1,(s/n)*1.25)); }
    g.putImageData(d,0,0);
    const z=Math.min(1,OUT_EDGE/Math.max(cw,ch)); let out=c;
    if(z<1){ out=document.createElement('canvas'); out.width=Math.round(cw*z); out.height=Math.round(ch*z); const o=out.getContext('2d'); o.imageSmoothingQuality='high'; o.drawImage(c,0,0,out.width,out.height); }
    const blob=await new Promise(r=>out.toBlob(r,'image/png'));
    if(fixDone){ const f=fixDone; f({blob,w:out.width,h:out.height}); close(); return; }
    await onCutout(blob,out.width,out.height);
    if(another){
      // Blank out what was just taken, so the next cut is whatever else is on the page.
      pushUndo(); for(let i=0;i<W*H;i++) if(k[i]) edit[i]=-1; draw();
      toast('Added. Draw around the next one, or use “Add”.');
    } else close();
  }
  async function asBackdrop(){
    const blob=await new Promise(r=>src.toBlob(r,'image/jpeg',.88));
    await onBackdrop(blob,W,H); close();
  }

  async function startCam(){
    stopCam(); const msg=$('camMsg'); msg.textContent='Starting camera…';
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ msg.textContent='No camera here. Choose a picture instead.'; return; }
    try{
      const v={width:{ideal:1920},height:{ideal:1080}};
      if(devices[devIdx]) v.deviceId={exact:devices[devIdx].deviceId}; else v.facingMode={ideal:'environment'};
      stream=await navigator.mediaDevices.getUserMedia({video:v,audio:false});
      const vid=$('camVideo'); vid.srcObject=stream; await vid.play().catch(()=>{}); msg.textContent='';
      devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
      $('camSwitch').hidden=devices.length<2;
      if(!$('capDlg').open) stopCam();
    }catch(e){ msg.textContent="The camera isn't available. It may be blocked on this device. You can still choose or paste a picture."; }
  }
  function stopCam(){ if(stream) stream.getTracks().forEach(t=>t.stop()); stream=null; $('camVideo').srcObject=null; }
  function showSource(){ src=null; $('capCut').hidden=true; $('capSource').hidden=false; startCam(); }
  function open(m){ mode=m; $('capTitle').textContent=m==='backdrop'?'Add a backdrop':'Add a drawing'; $('capDlg').showModal(); showSource(); }
  function close(){ stopCam(); src=null; fixDone=null; editRect=null; $('cutBackdrop').hidden=$('cutRetake').hidden=false; $('cutDone').textContent='✓ Add to stage'; $('capDlg').close(); }

  function init(o){
    ({onCutout,onBackdrop,toast}=o);
    $('capClose').onclick=close; $('capDlg').addEventListener('cancel',()=>stopCam());
    $('snapBtn').onclick=()=>{ const v=$('camVideo'); if(!v.videoWidth){ toast('The camera is not ready yet.'); return; } setImage(v,v.videoWidth,v.videoHeight); };
    $('camSwitch').onclick=()=>{ if(devices.length){ devIdx=(devIdx+1)%devices.length; startCam(); } };
    $('uploadImg').onclick=()=>$('imgInput').click();
    $('imgInput').onchange=e=>{ const f=e.target.files[0]; e.target.value=''; if(f) fromBlob(f); };
    $('pasteImg').onclick=async()=>{ try{ for(const it of await navigator.clipboard.read()){ const t=it.types.find(x=>x.startsWith('image/')); if(t){ fromBlob(await it.getType(t)); return; } } toast('No picture on the clipboard.'); }catch(_){ toast('Press Ctrl+V (or Cmd+V) to paste instead.'); } };
    window.addEventListener('paste',e=>{ if(!$('capDlg').open) return; for(const it of e.clipboardData.items) if(it.type.startsWith('image/')){ fromBlob(it.getAsFile()); e.preventDefault(); return; } });
    let t; const deb=()=>{ clearTimeout(t); t=setTimeout(recompute,60); };
    $('thresh').oninput=deb; $('autoPaper').onchange=recompute; $('keepHoles').onchange=recompute;
    document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{ tool=b.dataset.tool; document.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('on',x===b)); });
    $('cutUndo').onclick=()=>{ if(undo.length){ edit=undo.pop(); draw(); } };
    $('cutReset').onclick=()=>{ pushUndo(); edit.fill(0); draw(); };
    $('cutRot').onclick=()=>rebake((g,c)=>{ g.translate(c.width,0); g.rotate(Math.PI/2); },true);
    $('cutFlip').onclick=()=>rebake((g,c)=>{ g.translate(c.width,0); g.scale(-1,1); },false);
    $('cutDone').onclick=()=>finish(false); $('cutAnother').onclick=()=>finish(true);
    $('cutBackdrop').onclick=asBackdrop; $('cutRetake').onclick=showSource;
    window.addEventListener('resize',()=>{ if($('capDlg').open&&src) draw(); });
  }
  return {init,open,autoCut,edit:editBox};
})();
