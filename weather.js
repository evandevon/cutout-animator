/* Weather that kids switch on and off while they perform: rain, snow, bubbles, leaves, sparkles and petals.
   It sits in front of everything. Each drop, flake or leaf is a little hand-cut paper shape, and they move in small
   steps (12 a second), like stop-motion, rather than gliding. Positions are a pure function of the scene time,
   so Preview and the video show exactly what was performed. */
const Weather=(()=>{
  const KINDS=[
    {k:'rain',icon:'🌧',name:'Rain'},{k:'snow',icon:'❄️',name:'Snow'},{k:'bubbles',icon:'🫧',name:'Bubbles'},
    {k:'leaves',icon:'🍂',name:'Leaves'},{k:'sparkles',icon:'✨',name:'Sparkles'},{k:'petals',icon:'🌸',name:'Petals'}];
  const FADE=.8,STEP=1/12;
  // a small seeded random number source, so every run makes the same weather
  const rng=s=>()=>((s=Math.imul(s^s>>>15,2246822519)+0x9e3779b9>>>0)/4294967296);
  // a slightly wobbly outline, like something cut with scissors
  function cutPath(g,pts,r){ g.beginPath(); pts.forEach(([x,y],i)=>{ const j=(r()-.5)*.08,X=x*(1+j),Y=y*(1+j); i?g.lineTo(X,Y):g.moveTo(X,Y); }); g.closePath(); }
  function sprite(kind,variant){
    const S=64,c=document.createElement('canvas'); c.width=c.height=S; const g=c.getContext('2d'),r=rng(97+variant*131+kind.length*7);
    g.translate(S/2,S/2); g.lineJoin='round'; const paper=(fill,lw=2.2)=>{ g.shadowColor='rgba(0,0,0,.18)'; g.shadowBlur=3; g.shadowOffsetY=1.5; g.fillStyle=fill; g.fill(); g.shadowColor='transparent'; g.lineWidth=lw; g.strokeStyle='rgba(40,30,30,.35)'; g.stroke(); };
    if(kind==='rain'){ const p=[]; for(let i=0;i<10;i++){ const a=i/10*Math.PI*2; p.push([Math.cos(a)*5,Math.sin(a)*(a>Math.PI?22:8)]); } cutPath(g,p,r); paper(['#cfe6ff','#b7d8fb','#e3f1ff'][variant%3],1.6); }
    else if(kind==='snow'){ const p=[],n=9; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2,R=14+r()*7; p.push([Math.cos(a)*R,Math.sin(a)*R]); } cutPath(g,p,r); paper('#ffffff',1.8); }
    else if(kind==='bubbles'){ g.beginPath(); g.arc(0,0,22,0,7); g.fillStyle='rgba(190,230,255,.28)'; g.fill(); g.lineWidth=3; g.strokeStyle='rgba(255,255,255,.85)'; g.stroke(); g.lineWidth=1.5; g.strokeStyle='rgba(60,120,170,.35)'; g.stroke();
      g.beginPath(); g.ellipse(-8,-9,6,3.5,-.7,0,7); g.fillStyle='rgba(255,255,255,.9)'; g.fill(); }
    else if(kind==='leaves'){ const p=[]; for(let i=0;i<=12;i++){ const t=i/12; p.push([-24+48*t,-Math.sin(t*Math.PI)*12]); } for(let i=11;i>0;i--){ const t=i/12; p.push([-24+48*t,Math.sin(t*Math.PI)*12]); }
      cutPath(g,p,r); paper(['#e2832f','#c9502d','#e7b23a','#a8663a'][variant%4]); g.beginPath(); g.moveTo(-22,0); g.lineTo(22,0); g.lineWidth=1.5; g.strokeStyle='rgba(80,40,20,.45)'; g.stroke(); }
    else if(kind==='sparkles'){ const p=[]; for(let i=0;i<8;i++){ const a=i/8*Math.PI*2-Math.PI/2,R=i%2?7:24; p.push([Math.cos(a)*R,Math.sin(a)*R]); } cutPath(g,p,r); paper(['#ffe46b','#fff6c4','#ffd23f'][variant%3],1.6); }
    else { const p=[]; for(let i=0;i<14;i++){ const a=i/14*Math.PI*2; p.push([Math.cos(a)*18*(1-.25*Math.cos(a*2)),Math.sin(a)*11]); } cutPath(g,p,r); paper(['#f6b3cf','#f9cde0','#ee98bd'][variant%3]); }
    return c; }
  const sprites=new Map(); const spr=(k,v,dark)=>{ const key=k+v+(dark?'d':''); let c=sprites.get(key); if(!c){ c=sprite(k,v); if(dark){ const g=c.getContext('2d'); g.setTransform(1,0,0,1,0,0); g.shadowColor='transparent'; g.globalCompositeOperation='source-in'; g.fillStyle='rgba(33,23,15,.85)'; g.fillRect(0,0,64,64); } sprites.set(key,c); } return c; }; // dark: as shadows, for shadow puppet scenes
  // how each kind moves: count, size (stage px), speed (px/s), sideways drift, sway and spin
  const CFG={rain:{n:75,size:[16,26],vy:[700,950],vx:-160,sway:0,spin:0,tilt:.17},snow:{n:70,size:[10,22],vy:[45,95],vx:12,sway:26,spin:.8},
    bubbles:{n:28,size:[22,58],vy:[-140,-60],vx:0,sway:22,spin:0},leaves:{n:24,size:[34,54],vy:[60,120],vx:150,sway:40,spin:2.4},
    sparkles:{n:38,size:[16,34],vy:[-14,14],vx:0,sway:10,spin:.4,twinkle:true},petals:{n:30,size:[18,30],vy:[50,95],vx:70,sway:30,spin:1.8}};
  function drawKind(g,k,t,alpha,W,H,dark,dens=1){ const C=CFG[k],r=rng(k.length*1000+k.charCodeAt(0)),tq=Math.floor(t/STEP)*STEP,M=80,T=g.getTransform(),ga=g.globalAlpha;
    const n=Math.round(C.n*dens); for(let i=0;i<C.n;i++){ const x0=r()*(W+2*M),y0=r()*(H+2*M),sz=C.size[0]+r()*(C.size[1]-C.size[0]),vy=C.vy[0]+r()*(C.vy[1]-C.vy[0]),ph=r()*6.28,v=i%4,dir=r()<.5?-1:1;
      const span=H+2*M,wrapW=W+2*M; let y=((y0+vy*tq)%span+span)%span-M,x=((x0+C.vx*tq*(.6+.4*(i%3)/2)+Math.sin(tq*1.3+ph)*C.sway)%wrapW+wrapW)%wrapW-M;
      let a=alpha,s=sz/40; if(C.twinkle){ const tw=.5+.5*Math.sin(tq*3.1+ph); s*=.55+.6*tw; a*=.35+.65*tw; }
      if(i>=n) continue; const ang=C.tilt||(C.spin*tq*dir+ph),cs=Math.cos(ang)*s,sn=Math.sin(ang)*s; g.globalAlpha=ga*a;
      g.setTransform(T.a*cs+T.c*sn,T.b*cs+T.d*sn,-T.a*sn+T.c*cs,-T.b*sn+T.d*cs,T.a*x+T.c*y+T.e,T.b*x+T.d*y+T.f); g.drawImage(spr(k,v,dark),-32,-32); }
    g.setTransform(T); g.globalAlpha=ga; }
  /* What's on at scene time t: the scene's starting weather, then the taps made while recording (events: {t, k, on}).
     Each kind fades in or out over FADE seconds after a tap. */
  function levels(start,events,t){ const out={};
    for(const {k} of KINDS){ let on=!!(start&&start.includes(k)),te=-1e9,was=on; for(const e of events||[]){ if(e.k!==k||e.t>t) continue; was=on; on=e.on; te=e.t; }
      const f=Math.min(1,(t-te)/FADE),v=on?(was?1:f):(was?1-f:0); if(v>0) out[k]=v; } return out; }
  function draw(g,start,events,t,W,H,dark,dens){ const L=levels(start,events,t); for(const k in L) drawKind(g,k,t,L[k],W,H,dark,dens); }
  const isOn=(start,events,t,k)=>{ let on=!!(start&&start.includes(k)); for(const e of events||[]) if(e.k===k&&e.t<=t) on=e.on; return on; };
  return {KINDS,draw,levels,isOn};
})();
