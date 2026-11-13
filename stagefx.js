/* Stage effects, drawn in stage units (W x H) on whatever canvas the scene is drawn on (the stage, a thumbnail or the video):
   - Shadow puppet scenes: a warm, lamp-lit paper screen; cutouts become soft-edged silhouettes; the backdrop becomes faint scenery.
   - Water: below the sea level, a subtle blue-green layer with a gently bobbing, hand-cut wavy edge, and a slight ripple
     that also moves everything under it (backdrop and cutouts).
   - Day and night: the scene is tinted as the sun moves across the sky and sets, then the moon rises. 💡 light cutouts
     light up a warm circle around themselves in the dark. */
const StageFX=(()=>{
  const STEP=1/12, stepT=t=>Math.floor(t/STEP)*STEP;
  const rng=s=>()=>((s=Math.imul(s^s>>>15,2246822519)+0x9e3779b9>>>0)/4294967296);
  const INK='#21170f';
  const mk=(w,h)=>{ const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(w)); c.height=Math.max(1,Math.round(h)); return c; };

  /* ---------- shadow puppet screen ---------- */
  let screenC=null;
  /* Cream paper like an old book page: soft faint blotches, little clusters of paler mottling, scattered tiny dark specks
     and fine grain (no fibres or lines). Then lit warmly from behind by the lamp: brightest in the middle, deeper amber at the edges. */
  function screenTexture(W,H){ if(screenC&&screenC.width===W) return screenC; const c=mk(W,H),g=c.getContext('2d'),r=rng(4242);
    g.fillStyle='rgb(248,231,210)'; g.fillRect(0,0,W,H);
    const bw=22,bh=13,b=mk(bw,bh),bg=b.getContext('2d'),bd=bg.createImageData(bw,bh); // large soft blotches, very faint
    for(let i=0;i<bw*bh;i++){ const v=r(),lt=v>.5; bd.data[i*4]=lt?255:200; bd.data[i*4+1]=lt?252:170; bd.data[i*4+2]=lt?245:130; bd.data[i*4+3]=Math.round(Math.abs(v-.5)*2*30); }
    bg.putImageData(bd,0,0); g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high'; g.drawImage(b,0,0,W,H);
    for(let k=0;k<420;k++){ const cx=r()*W,cy=r()*H,n=4+r()*12,sp=4+r()*14; g.fillStyle=`rgba(255,251,242,${.25+r()*.3})`; // pale mottled flecks, in little clusters
      for(let i=0;i<n;i++){ const s=.7+r()*2.2; g.beginPath(); g.ellipse(cx+(r()-.5)*sp*2,cy+(r()-.5)*sp,s,s*(.5+r()*.6),r()*3,0,7); g.fill(); } }
    for(let k=0;k<520;k++){ const s=.35+Math.pow(r(),3)*1.4; g.fillStyle=`rgba(${110+r()*40|0},${80+r()*30|0},${50+r()*25|0},${.25+r()*.45})`; g.beginPath(); g.arc(r()*W,r()*H,s,0,7); g.fill(); } // tiny dark specks
    for(let k=0;k<3;k++){ const x=r()*W,y=r()*H; for(let i=0;i<8;i++){ g.fillStyle='rgba(170,120,60,.18)'; g.beginPath(); g.arc(x+(r()-.5)*7,y+(r()-.5)*7,.8+r()*1.6,0,7); g.fill(); } } // a couple of small foxing marks
    const gd=g.getImageData(0,0,W,H),D=gd.data; for(let i=0;i<D.length;i+=4){ const n=(r()-.5)*7; D[i]+=n; D[i+1]+=n; D[i+2]+=n*.9; } g.putImageData(gd,0,0); // fine grain
    g.globalCompositeOperation='multiply'; const rg=g.createRadialGradient(W*.5,H*.46,10,W*.5,H*.5,W*.72); // lamplight from behind
    rg.addColorStop(0,'rgb(255,250,236)'); rg.addColorStop(.45,'rgb(252,226,180)'); rg.addColorStop(.8,'rgb(232,178,112)'); rg.addColorStop(1,'rgb(190,128,70)'); g.fillStyle=rg; g.fillRect(0,0,W,H);
    g.globalCompositeOperation='source-over'; screenC=c; return c; }
  // The backdrop as faint scenery painted on the screen: darker parts of the drawing become darker shadow.
  const sceneryCache=new Map();
  function scenery(key,W,H,draw){ let c=sceneryCache.get(key); if(c) return c; const w=Math.round(W/2),h=Math.round(H/2); c=mk(w,h); const g=c.getContext('2d',{willReadFrequently:true}); g.scale(.5,.5); const ready=draw(g)!==false;
    const d=g.getImageData(0,0,w,h),D=d.data; for(let i=0;i<D.length;i+=4){ const L=(.3*D[i]+.59*D[i+1]+.11*D[i+2])/255; D[i+3]=Math.round(255*Math.max(0,Math.min(1,(.92-L)*1.25))*.5*(D[i+3]/255)); D[i]=33; D[i+1]=23; D[i+2]=15; }
    g.putImageData(d,0,0); if(ready){ if(sceneryCache.size>30) sceneryCache.clear(); sceneryCache.set(key,c); } return c; }
  const screenCache=new Map();
  function screen(c,W,H,t,key,drawBack){ let S=screenCache.get(key);
    if(!S){ S=mk(W,H); const g=S.getContext('2d'); g.drawImage(screenTexture(W,H),0,0); let ready=true; if(drawBack){ const sc=scenery(key,W,H,d=>{ const r=drawBack(d); ready=r!==false; return r; }); g.drawImage(sc,0,0,W,H); }
      if(ready){ if(screenCache.size>12) screenCache.clear(); screenCache.set(key,S); } }
    c.drawImage(S,0,0,W,H);
    const q=stepT(t),f=.018+.014*Math.sin(q*7.3)*Math.sin(q*2.1+1); c.fillStyle=`rgba(60,30,5,${Math.max(0,f)})`; c.fillRect(0,0,W,H); } // a lamp flickers very slightly
  const sils=new WeakMap();
  function silhouette(im){ let S=sils.get(im); if(S) return S; const w=im.naturalWidth,h=im.naturalHeight; if(!w||!h||!im.complete) return null; const b=Math.max(1.5,Math.max(w,h)*.006),pad=Math.ceil(b*3);
    const sh=mk(w,h),sg=sh.getContext('2d'); sg.drawImage(im,0,0); sg.globalCompositeOperation='source-in'; sg.fillStyle=INK; sg.fillRect(0,0,w,h);
    const c=mk(w+2*pad,h+2*pad),g=c.getContext('2d'); g.shadowColor='rgba(33,23,15,.7)'; g.shadowBlur=b; g.drawImage(sh,pad,pad); S={c,pad}; sils.set(im,S); return S; }

  /* ---------- water ---------- */
  const fleck=rng(77); const FLECKS=Array.from({length:16},()=>({x:fleck(),y:fleck(),l:10+fleck()*18,v:4+fleck()*8}));
  const noise=(()=>{ const r=rng(919),a=[]; for(let i=0;i<64;i++) a.push(r()-.5); return x=>{ const i=Math.floor(x/60),f=x/60-i,A=a[(i%64+64)%64],B=a[((i+1)%64+64)%64]; return A+(B-A)*f; }; })();
  const edgeY=(x,y0,q)=>y0+2.6*Math.sin(x/97+q*.9)+1.3*Math.sin(x/43+2.1+q*.6)+1.6*noise(x)+1.2*Math.sin(q*1.25);
  function wavePath(c,W,H,y0,q){ c.beginPath(); c.moveTo(-10,H+10); for(let x=-10;x<=W+10;x+=16) c.lineTo(x,edgeY(x,y0,q)); c.lineTo(W+10,H+10); c.closePath(); }
  let snap=null;
  function water(c,W,H,sea,t,shadow){ if(sea==null) return; const y0=sea*H,q=stepT(t);
    if(shadow){ c.save(); wavePath(c,W,H,y0,q); c.fillStyle='rgba(33,23,15,.9)'; c.fill(); c.restore(); return; } // a cardboard wave strip, in shadow: hard, wavy edge
    // In colour the water fades in softly, so it blends with whatever waterline a child has drawn, straight or sloping.
    const F=34,top=y0-F,T=c.getTransform(),sx=T.a,dx0=T.e,dy0=T.f+top*T.d,dw=Math.round(W*sx),dh=Math.round((H-top)*T.d);
    c.save(); c.beginPath(); c.rect(0,top,W,H-top); c.clip();
    if(dw>0&&dh>0&&c.canvas){ // ripple: everything under the water shifts sideways a little, in bands, building up below the surface
      if(!snap) snap=mk(dw,dh); if(snap.width!==dw||snap.height!==dh){ snap.width=dw; snap.height=dh; } const sg=snap.getContext('2d'); sg.clearRect(0,0,dw,dh); sg.drawImage(c.canvas,dx0,dy0,dw,dh,0,0,dw,dh);
      c.setTransform(1,0,0,1,0,0); const band=Math.max(3,Math.round(4*T.d)),amp=1.95*sx,fd=2*F*T.d;
      for(let y=0;y<dh;y+=band){ const o=amp*Math.sin(y/(9*T.d)+q*2.2)*Math.min(1,y/fd); if(Math.abs(o)<.05) continue; c.drawImage(snap,0,y,dw,band,dx0+o,dy0+y,dw,band); }
      c.setTransform(T); }
    const g=c.createLinearGradient(0,top,0,H); g.addColorStop(0,'rgba(55,155,170,0)'); g.addColorStop(Math.min(.9,2*F/(H-top)),'rgba(55,155,170,.17)'); g.addColorStop(1,'rgba(25,95,125,.3)'); c.fillStyle=g; c.fillRect(0,top,W,H-top);
    c.lineCap='round'; for(const f of FLECKS){ const x=((f.x*W+f.v*q*6)%W+W)%W,y=y0+14+f.y*(H-y0-20); if(y>H-4) continue; c.strokeStyle='rgba(235,250,255,.16)'; c.lineWidth=2.2; c.beginPath(); c.moveTo(x,y); c.lineTo(x+f.l,y); c.stroke(); }
    c.restore(); }

  /* ---------- day and night ---------- */
  const TINT=[[0,[255,255,255]],[.3,[255,250,238]],[.5,[255,232,204]],[.6,[246,200,178]],[.7,[172,150,190]],[.82,[112,124,176]],[1,[80,92,150]]];
  function tintAt(v){ for(let i=1;i<TINT.length;i++){ const [a,A]=TINT[i-1],[b,B]=TINT[i]; if(v<=b){ const k=(v-a)/(b-a); return A.map((x,j)=>Math.round(x+(B[j]-x)*k)); } } return TINT[TINT.length-1][1]; }
  const arcPos=(W,H,hz,deg)=>{ const a=deg*Math.PI/180; return [W*.5+W*.42*Math.cos(a),hz-(hz-H*.08)*Math.sin(a)]; };
  function glow(c,x,y,R,rgb,a){ if(a<=.003) return; const g=c.createRadialGradient(x,y,0,x,y,R); g.addColorStop(0,`rgba(${rgb},${a})`); g.addColorStop(.35,`rgba(${rgb},${a*.45})`); g.addColorStop(1,`rgba(${rgb},0)`); c.fillStyle=g; c.fillRect(x-R,y-R,2*R,2*R); }
  let map=null;
  function daylight(c,W,H,v,hz,lights){ if(!(v>.01)) return; const T=c.getTransform(),cw=c.canvas.width,ch=c.canvas.height,tint=tintAt(v),d=1-(.3*tint[0]+.59*tint[1]+.11*tint[2])/255;
    const Q=4,mw=Math.ceil(cw/Q),mh=Math.ceil(ch/Q); // the light map is soft, so a quarter-size one looks the same and is much quicker
    if(!map) map=mk(mw,mh); if(map.width!==mw||map.height!==mh){ map.width=mw; map.height=mh; } const m=map.getContext('2d');
    m.setTransform(1,0,0,1,0,0); m.globalCompositeOperation='source-over'; m.fillStyle='#fff'; m.fillRect(0,0,mw,mh); m.setTransform(T.a/Q,T.b/Q,T.c/Q,T.d/Q,T.e/Q,T.f/Q); m.fillStyle=`rgb(${tint})`; m.fillRect(0,0,W,H);
    for(const L of lights){ const g=m.createRadialGradient(L.x,L.y,0,L.x,L.y,L.R); g.addColorStop(0,'rgba(255,250,236,1)'); g.addColorStop(.45,'rgba(255,240,215,.75)'); g.addColorStop(1,'rgba(255,240,215,0)'); m.fillStyle=g; m.fillRect(L.x-L.R,L.y-L.R,2*L.R,2*L.R); }
    c.save(); c.setTransform(1,0,0,1,0,0); c.globalCompositeOperation='multiply'; c.imageSmoothingEnabled=true; c.drawImage(map,0,0,mw*Q,mh*Q); c.restore();
    if(v>.3&&v<.8){ const a=Math.sin((v-.3)/.5*Math.PI)*.75,g=c.createLinearGradient(0,0,0,hz); g.addColorStop(0,'rgba(120,80,170,'+(a*.5)+')'); g.addColorStop(.55,'rgba(255,150,90,'+(a*.6)+')'); g.addColorStop(1,'rgba(255,120,60,'+a+')'); // a warm sky, glowing most near the horizon
      c.save(); c.globalCompositeOperation='soft-light'; c.fillStyle=g; c.fillRect(0,0,W,H); c.restore(); }
    c.save(); c.globalCompositeOperation='screen';
    if(v<.68){ const deg=90-(v/.62)*98,[x,y]=arcPos(W,H,hz,deg),low=Math.max(0,1-Math.max(0,deg)/40); // the sun: high and pale at midday, low, orange and pink as it sets
      const rgb=low<.5?'255,236,190':'255,170,110'; glow(c,x,y,W*(.22+.1*low),rgb,(.16+.2*low)*(deg<-4?Math.max(0,1+(deg+4)/6):1)); }
    if(v>.55&&v<.85){ const a=Math.sin((v-.55)/.3*Math.PI)*.2; glow(c,W*.95,hz,W*.32,'235,140,170',a); } // afterglow over the horizon
    if(v>.72){ const k=(v-.72)/.28,[x,y]=arcPos(W,H,hz,180-k*55); glow(c,x,y,W*.2,'190,215,255',.1+.14*k); } // the moon rises on the left
    for(const L of lights) glow(c,L.x,L.y,L.R*.8,'255,190,95',.32*d);
    c.restore(); }
  return {screen,silhouette,water,daylight,tintAt};
})();
