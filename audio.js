'use strict';
/* Sounds: built-in ambience and music are generated in code, so they work offline,
   have no licensing questions, and only their name needs saving in a project. */
const Sound = (() => {
  const SR = 32000;
  const AMBIENCE = { rain:'Rain', wind:'Wind', ocean:'Ocean waves', underwater:'Underwater', forest:'Forest birds', night:'Night crickets', fire:'Campfire' };
  const MUSIC = { happy:'Happy', adventure:'Adventure', spooky:'Spooky', sleepy:'Sleepy', silly:'Silly', sad:'Sad', tense:'Tense', musicbox:'Music box', gongs:'Bells & gongs', lantern:'Lantern' };

  function rng(seed){ let s=seed>>>0; return ()=>{ s=(s+0x6D2B79F5)>>>0; let t=s; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
  function noiseLoop(len, fill, xf=SR){ // fills len+xf samples, then cross-fades the tail over the head so it loops
    const a=new Float32Array(len+xf); fill(a);
    for(let i=0;i<xf;i++){ const k=i/xf; a[i]=a[i]*k+a[len+i]*(1-k); }
    return a.subarray(0,len);
  }
  const brown=(a,r,gain=1)=>{ let v=0; for(let i=0;i<a.length;i++){ v=(v+(r()*2-1)*.02)*.998; a[i]+=v*gain*3; } };
  const white=(a,r,gain=1)=>{ let lp=0; for(let i=0;i<a.length;i++){ const w=r()*2-1; lp+=.5*(w-lp); a[i]+=(w-lp)*gain; } };
  function blip(a,at,dur,f0,f1,amp){ // chirp written with wrap-around, so it is seamless at the loop point
    const n=Math.floor(dur*SR); let ph=0;
    for(let i=0;i<n;i++){ const k=i/n, f=f0+(f1-f0)*k; ph+=2*Math.PI*f/SR; const j=(at+i)%a.length; a[j]+=Math.sin(ph)*amp*Math.sin(Math.PI*k); }
  }
  function ambience(id){
    const L=SR*16, r=rng(id.length*977+13);
    const a=noiseLoop(L,b=>{
      if(id==='rain'){ white(b,r,.11); brown(b,r,.25); }
      if(id==='wind'){ const t=new Float32Array(b.length); brown(t,r,1); for(let i=0;i<b.length;i++) b[i]=t[i]*(.75+.5*Math.sin(i/SR*2*Math.PI/8)+.25*Math.sin(i/SR*2*Math.PI/3.2)); }
      if(id==='ocean'){ const t=new Float32Array(b.length); brown(t,r,.8); white(t,r,.14); for(let i=0;i<b.length;i++){ const w=Math.pow(.5+.5*Math.sin(i/SR*2*Math.PI/5.33),2); b[i]=t[i]*(.25+w); } }
      if(id==='underwater'){ brown(b,r,.9); }
      if(id==='forest'){ brown(b,r,.25); }
      if(id==='night'){ brown(b,r,.12); }
      if(id==='fire'){ brown(b,r,.55); }
    });
    if(id==='rain') for(let k=0;k<160;k++) blip(a,Math.floor(r()*L),.012,1400+r()*2200,600+r()*500,.05+r()*.06);
    if(id==='underwater') for(let k=0;k<30;k++){ const f=260+r()*420; blip(a,Math.floor(r()*L),.07+r()*.1,f,f*1.9,.1); }
    if(id==='forest') for(let k=0;k<22;k++){ const at=Math.floor(r()*L), f=2300+r()*1700, c=1+Math.floor(r()*4); for(let j=0;j<c;j++) blip(a,at+Math.floor(j*.14*SR),.09,f,f*(r()<.5?1.35:.75),.07); }
    if(id==='night') for(let k=0;k<64;k++){ const at=Math.floor(k*L/64+r()*800); if(k%8<5) for(let j=0;j<3;j++) blip(a,at+Math.floor(j*.028*SR),.02,4700,4700,.05); }
    if(id==='fire') for(let k=0;k<210;k++){ const at=Math.floor(r()*L), n=20+Math.floor(r()*70), amp=.08+r()*r()*.45; for(let i=0;i<n;i++) a[(at+i)%L]+=(r()*2-1)*amp*(1-i/n); }
    return a;
  }

  const hz=m=>440*Math.pow(2,(m-69)/12);
  function note(a,beatS,beat,beats,midi,amp,kind){
    const at=Math.floor(beat*beatS*SR), n=Math.floor(beats*beatS*SR), f=hz(midi);
    for(let i=0;i<n;i++){
      const t=i/SR, dec=kind==='pad'?Math.min(1,i/(.25*SR))*Math.min(1,(n-i)/(.25*SR)):Math.exp(-t*(kind==='bass'?5:kind==='xylo'?11:6))*Math.min(1,i/60);
      const w=2*Math.PI*f*t; let v;
      if(kind==='bass') v=Math.sin(w)+.35*Math.sin(2*w);
      else if(kind==='xylo') v=Math.sin(w)+.4*Math.sin(3.9*w);
      else if(kind==='pad') v=Math.sin(w)+.3*Math.sin(2.003*w);
      else v=Math.sin(w)+.45*Math.sin(2*w)+.2*Math.sin(3*w);
      a[(at+i)%a.length]+=v*dec*amp;
    }
  }
  const SONGS={
    happy:{bpm:112,chords:[[60,64,67],[65,69,72],[67,71,74],[60,64,67]],lead:[0,2,4,2,1,2,0,1],kind:'pluck',bass:[0,1,2,3]},
    adventure:{bpm:124,chords:[[57,60,64],[53,57,60],[55,59,62],[52,56,59]],lead:[0,0,2,0,1,2,1,0],kind:'pluck',bass:[0,0,2,0,0,0,2,1]},
    spooky:{bpm:64,chords:[[50,53,57],[49,52,56],[50,53,58],[46,50,53]],lead:[2,-1,-1,1,-1,0,-1,-1],kind:'xylo',pad:true},
    sleepy:{bpm:66,chords:[[60,64,67],[57,60,64],[53,57,60],[55,59,62]],lead:[0,1,2,1,0,1,2,1],kind:'xylo',pad:true},
    silly:{bpm:132,chords:[[60,64,67],[60,64,67],[65,69,72],[67,71,74]],lead:[2,-1,1,0,2,2,-1,0],kind:'xylo',bass:[0,2,0,2,0,2,0,2]},
    // slow minor chords (Am F C E) with a falling tune
    sad:{bpm:70,chords:[[57,60,64],[53,57,60],[48,52,55],[52,56,59]],lead:[2,-1,1,-1,0,-1,-1,-1],kind:'pluck',pad:true},
    // a pulsing low note on every beat under creeping chords, like something is about to happen
    tense:{bpm:104,chords:[[52,55,59],[52,55,60],[52,55,59],[51,54,58]],lead:[0,-1,-1,0,-1,1,-1,-1],kind:'pluck',pad:true,bass:[0,0,0,0]},
  };
  /* ---- instruments for the three storyteller tunes (written into a looping buffer, wrapping at the end) ---- */
  function tone(a,at,dur,midi,amp,kind){ const f=hz(midi),s0=Math.floor(at*SR),n=Math.floor(dur*SR),L=a.length,TAU=2*Math.PI/SR;
    amp*=1.25; // level with the other music styles
    // each partial: [frequency multiple, level, decay per second]; decays are stepped per sample (much quicker than Math.exp each time)
    const P={box:[[1,1,2.6],[2,.45,5],[5.4,.22,11]],
             bronze:[[1,.55,1.7],[1.006,.44,1.7],[2.76,.25,4.7],[5.4,.11,8.7]],
             gong:[[1,.5,.55],[1.48,.27,.55],[2.03,.17,.55],[2.97,.1,.55]],
             zither:[[1,1,3.5],[2.0014,.5,5.4],[3.0021,.33,7.3],[4.0028,.25,9.2],[5.0035,.2,11.1]],
             block:[[880/f,1,55],[1460/f,.6,55]]}[kind]||[[1,1,4]];
    const atk=kind==='gong'?SR*.03:40,am=kind==='gong'?2*Math.PI*2.4/SR:0;
    for(const [m,lv,dk] of P){ const w=f*m*TAU,step=Math.exp(-dk/SR),ne=Math.min(n,Math.ceil(Math.log(Math.max(1,lv*amp/3e-4))/dk*SR)); let env=lv*amp,ph=kind==='gong'&&m===1.48?.3:0; // stop once it's too quiet to hear
      for(let i=0;i<ne;i++){ const on=i<atk?i/atk:1; a[(s0+i)%L]+=Math.sin(ph)*env*on*(am?1+.25*Math.sin(am*i):1); ph+=w; env*=step; } } }
  /* Music box: a slow three-beat lullaby (an original tune), like the music for a silhouette fairy tale. */
  function musicBox(){ const beat=60/84,bars=16,L=Math.round(bars*3*beat*SR),a=new Float32Array(L),r=rng(31);
    const C=[[60,64,67],[57,60,64],[53,57,60],[55,59,62],[60,64,67],[57,60,64],[50,53,57],[55,59,62],[60,64,67],[52,55,59],[53,57,60],[60,64,67],[50,53,57],[55,59,62],[60,64,67],[60,64,67]];
    const M=[[76,79,84],[83,81,76],[77,81,84],[83,79,74],[76,79,84],[86,84,81],[77,81,86],[83,0,0],[84,83,84],[83,79,76],[81,84,81],[79,76,72],[74,77,81],[79,83,86],[84,0,0],[0,0,0]];
    for(let b=0;b<bars;b++){ const t=b*3*beat,ch=C[b]; tone(a,t,3.5,ch[0],.11,'box'); tone(a,t+beat,2.4,ch[1]+12,.045,'box'); tone(a,t+beat,2.4,ch[2]+12,.04,'box'); tone(a,t+2*beat,2.4,ch[1]+12,.04,'box'); tone(a,t+2*beat,2.4,ch[2]+12,.035,'box');
      M[b].forEach((m,k)=>{ if(m) tone(a,t+k*beat+(r()-.5)*.012,3,m,.12,'box'); }); }
    return a; }
  /* Bells & gongs: inspired by the gamelan that accompanies wayang kulit. A five-note scale, a core tune on every beat,
     quicker high bells weaving around it, small gongs marking the quarters and a big gong at the end of each cycle. */
  function bellsGongs(){ const beat=60/72,N=32,L=Math.round(N*beat*SR),a=new Float32Array(L),P={1:62,2:64,3:67,5:69,6:71,7:59};
    const core=[3,2,3,5,6,5,3,2,1,2,3,5,3,2,7,6, 5,6,5,3,2,3,5,6,1,6,5,3,2,3,2,1];
    core.forEach((n,i)=>{ const t=i*beat; tone(a,t,3.2,P[n]+12,.1,'bronze'); const nx=P[core[(i+1)%N]]+24; tone(a,t+beat*.5,1.6,nx,.035,'bronze'); tone(a,t+beat*.75,1.6,nx,.03,'bronze');
      if(i%16===15) tone(a,t,9,38,.3,'gong'); else if(i%4===3) tone(a,t,4,50,.12,'gong'); });
    return a; }
  /* Lantern: a calm plucked tune on a zither-like string (an original tune in a five-note scale), with a soft wooden tick. */
  function lantern(){ const beat=60/76,bars=8,L=Math.round(bars*4*beat*SR),a=new Float32Array(L),e=beat/2;
    const M=[[76,0,79,0,81,79,76,0],[74,0,0,76,72,0,0,0],[79,0,81,0,84,81,79,0],[76,0,0,79,74,0,0,0],[81,0,84,0,86,84,81,0],[79,0,76,79,81,0,0,0],[76,74,72,0,69,0,72,0],[74,0,0,0,72,0,0,0]];
    const B=[48,45,48,43,45,48,45,43];
    for(let b=0;b<bars;b++){ const t=b*4*beat; tone(a,t,4,B[b],.12,'zither'); tone(a,t+2*beat,3,B[b]+7,.07,'zither');
      M[b].forEach((m,k)=>{ if(m) tone(a,t+k*e,2.2,m,.13,'zither'); });
      for(const k of [1,3]) tone(a,t+k*beat,.15,0,.035,'block'); if(b%2) tone(a,t+3.5*beat,.15,0,.022,'block'); }
    return a; }
  const GEN={musicbox:musicBox,gongs:bellsGongs,lantern};
  function music(id){ if(GEN[id]) return GEN[id]();
    const s=SONGS[id], beatS=60/s.bpm, bars=8, L=Math.round(bars*4*beatS*SR), a=new Float32Array(L);
    for(let b=0;b<bars;b++){
      const ch=s.chords[b%s.chords.length], base=b*4;
      if(s.pad) ch.forEach(m=>note(a,beatS,base,4,m-12,.05,'pad'));
      if(s.bass) for(let k=0;k<4;k++){ const nn=ch[s.bass[(k*s.bass.length/4+b)%s.bass.length|0]%3]; note(a,beatS,base+k,.95,nn-24,.17,'bass'); }
      else note(a,beatS,base,3.8,ch[0]-24,.1,'bass');
      s.lead.forEach((d,k)=>{ if(d>=0&&!(b%4===3&&k>5)) note(a,beatS,base+k/2,1.2,ch[d%3]+12+(d>2?12:0),.1,s.kind); });
    }
    return a;
  }

  function toBuffer(ctx,data){ const b=ctx.createBuffer(1,data.length,SR); b.copyToChannel(data,0);
    let p=0; for(let i=0;i<data.length;i+=7) p=Math.max(p,Math.abs(data[i])); if(p>.8){ const c=b.getChannelData(0),g=.8/p; for(let i=0;i<c.length;i++) c[i]*=g; } return b; }

  /* Echo cancelling is off by default: on Windows it makes the browser a "phone call", and many
     laptops then turn the speakers right down (or send sound only to headphones). */
  const S={aec:false,sink:''};
  let ctx=null;
  /* Keep the speakers awake. Many speakers (Bluetooth, HDMI/TV, USB, and some laptop sound chips) switch off after a few
     seconds of silence and take up to a second to wake, so the first moment of a recording or preview went missing.
     A far-too-quiet-to-hear hiss (about -75 dB) keeps them on while someone is using the page. It goes straight to the
     speakers, never into recordings or videos. Returns true if they were already awake. */
  let keep=null,keepUntil=0,keepT=null;
  function wake(sec=60,reset){ const c=audioCtx(),was=!!keep,until=performance.now()+sec*1000; keepUntil=reset?until:Math.max(keepUntil,until);
    if(!keep){ const b=c.createBuffer(1,c.sampleRate,c.sampleRate),d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*1.8e-4;
      const s=c.createBufferSource(),g=c.createGain(); s.buffer=b; s.loop=true; s.connect(g).connect(c.destination); s.start(); keep=s;
      const check=()=>{ if(performance.now()<keepUntil){ keepT=setTimeout(check,1000); return; } try{ keep.stop(); }catch(_){} keep=null; }; clearTimeout(keepT); keepT=setTimeout(check,1000); }
    return was; }
  function audioCtx(){ if(!ctx){ ctx=new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'}); if(S.sink&&ctx.setSinkId) ctx.setSinkId(S.sink).catch(()=>{}); } if(ctx.state!=='running') ctx.resume().catch(()=>{}); return ctx; }

  const cache=new Map();
  /* ref: 'syn:rain' | 'mus:happy' | 'asset:<id>' */
  async function buffer(ref,assets){
    if(!ref) return null;
    if(cache.has(ref)) return cache.get(ref);
    const c=audioCtx(); let b=null;
    const [t,id]=[ref.slice(0,ref.indexOf(':')),ref.slice(ref.indexOf(':')+1)];
    if(t==='syn') b=toBuffer(c,ambience(id));
    else if(t==='mus') b=toBuffer(c,music(id));
    else { const a=assets[id]; if(!a) return null; const ab=await a.blob.arrayBuffer(); b=await new Promise((res,rej)=>{ const p=c.decodeAudioData(ab,res,rej); if(p&&p.catch) p.catch(rej); }); }
    cache.set(ref,b); return b;
  }

  /* Used by both live playback and the offline mix-down, so what you hear is what exports.
     o.from: start this far into the scene (for trimming and the preview timeline). o.dur: how long to play;
     everything, voices and effects included, stops there, so a trimmed scene doesn't spill into the next.
     The voice goes through its own bus: take.vol boosts quiet voices, with a compressor so loud bits don't distort. */
  function schedule(c,dest,scene,at,buffers,mix,o){
    const nodes=[],from=Math.max(0,o.from||0),dur=o.dur,end=isFinite(dur)?at+dur:Infinity;
    const vb=c.createGain(),vc=c.createDynamicsCompressor(); vc.knee.value=10; vc.attack.value=.004; vc.release.value=.25; vb.connect(vc); vc.connect(dest);
    const setVoice=v=>{ v=Math.max(0,isFinite(+v)?+v:1); const n=c.currentTime||0; vb.gain.setValueAtTime(mix.voice*v,n);
      vc.threshold.setValueAtTime(v>1?-10-6*Math.log2(v):0,n); vc.ratio.setValueAtTime(v>1?4:1,n); };
    setVoice(scene.take?.vol??1);
    const play=(buf,t,vol,loop,out)=>{
      if(!buf) return; const s=c.createBufferSource(); s.buffer=buf; s.loop=!!loop;
      const g=c.createGain(); s.connect(g); g.connect(out||dest);
      if(loop){ s.start(at,from%buf.duration); g.gain.setValueAtTime(0,at); g.gain.linearRampToValueAtTime(vol,at+.25);
        if(isFinite(dur)){ g.gain.setValueAtTime(vol,Math.max(at+.25,end-.25)); g.gain.linearRampToValueAtTime(0,end); s.stop(end); } }
      else { const rel=t-from; if(rel>=dur) return; if(rel>=0) s.start(at+rel); else { if(-rel>=buf.duration) return; s.start(at,-rel); }
        g.gain.value=vol; if(isFinite(dur)){ g.gain.setValueAtTime(vol,Math.max(at,end-.03)); g.gain.linearRampToValueAtTime(0,end); s.stop(end+.01); } }
      nodes.push({s,g});
    };
    play(buffers(scene.ambience),0,mix.ambience,true);
    play(buffers(scene.music),0,mix.music,true);
    if(o.withTake&&scene.take){
      for(const v of scene.take.voices||[]) play(buffers('asset:'+v.assetId),v.t,1,false,vb);
      for(const f of scene.take.fx||[]) play(buffers(f.ref),f.t,mix.fx,false);
    }
    const stop=()=>{ const n=c.currentTime; for(const {s,g} of nodes){ try{ g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0,n,.04); s.stop(n+.2); }catch(_){} } };
    stop.setVoice=setVoice; return stop;
  }
  // A gentle limiter on the final mix, so voice + music + effects don't distort.
  function master(c){ if(!c.__master){ const m=c.createDynamicsCompressor(); m.threshold.value=-8; m.knee.value=8; m.ratio.value=12; m.attack.value=.003; m.release.value=.2; m.connect(c.destination); c.__master=m; } return c.__master; }
  function refsFor(scene){
    const r=[scene.ambience,scene.music].filter(Boolean);
    if(scene.take){ (scene.take.voices||[]).forEach(v=>r.push('asset:'+v.assetId)); (scene.take.fx||[]).forEach(f=>r.push(f.ref)); }
    return r;
  }

  /* Microphone: raw samples via AudioWorklet (ScriptProcessor as a fallback), so scenes
     can run straight on from one another with no gap and no recorder format problems. */
  const mic={stream:null,node:null,src:null,sink:null,chunks:null,level:0,waiters:[]};
  /* Each block of samples carries the audio clock time it was captured at, so a take can be lined up exactly with the moment recording began. */
  const WORKLET=`class Cap extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage({t:currentTime,d:c.slice(0)});return true}}registerProcessor('cap',Cap)`;
  function onSamples(m){ const s=m.d; let p=0,live=false; for(let i=0;i<s.length;i+=8){ const a=Math.abs(s[i]); if(a>p) p=a; if(a) live=true; } mic.level=Math.max(p,mic.level*.85); if(live&&mic.waiters.length){ const w=mic.waiters; mic.waiters=[]; w.forEach(f=>f()); } if(mic.chunks) mic.chunks.push(m); }
  // Resolves once the microphone is really sending sound (a freshly opened microphone can take a moment to wake up).
  function micReady(ms=1500){ return new Promise(r=>{ const t=setTimeout(()=>{ mic.waiters=mic.waiters.filter(f=>f!==go); r(false); },ms), go=()=>{ clearTimeout(t); r(true); }; mic.waiters.push(go); }); }
  let micBusy=null;
  function micStart(deviceId){ if(mic.stream) return Promise.resolve(true); if(!micBusy) micBusy=micOpen(deviceId).finally(()=>micBusy=null); return micBusy; }
  async function micOpen(deviceId){
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) return false;
    const c=audioCtx(), base={echoCancellation:S.aec,noiseSuppression:S.aec,autoGainControl:S.aec};
    try{ mic.stream=await navigator.mediaDevices.getUserMedia({audio:deviceId?{...base,deviceId:{exact:deviceId}}:base}); }
    catch(e){ if(!deviceId||e.name==='NotAllowedError') throw e; mic.stream=await navigator.mediaDevices.getUserMedia({audio:base}); } // that microphone has gone: use the default
    mic.src=c.createMediaStreamSource(mic.stream);
    mic.sink=c.createGain(); mic.sink.gain.value=0; mic.sink.connect(c.destination);
    try{
      if(!c.__capLoaded){ await c.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET],{type:'text/javascript'}))); c.__capLoaded=true; }
      mic.node=new AudioWorkletNode(c,'cap',{numberOfOutputs:1});
      mic.node.port.onmessage=e=>onSamples(e.data);
    }catch(_){
      mic.node=c.createScriptProcessor(2048,1,1);
      mic.node.onaudioprocess=e=>onSamples({t:c.currentTime-e.inputBuffer.duration,d:e.inputBuffer.getChannelData(0).slice(0)});
    }
    mic.src.connect(mic.node); mic.node.connect(mic.sink);
    return true;
  }
  function micCollect(){ mic.chunks=[]; }
  const micCollecting=()=>!!mic.chunks;
  /* The voice for a take, starting exactly at audio time t0: anything captured before t0 is dropped,
     and if the microphone was late or skipped, silence fills the gap so the voice stays in step with the movement. */
  function micTake(t0){
    const ch=mic.chunks; mic.chunks=null; if(!ch||!ch.length) return null;
    const sr=audioCtx().sampleRate, out=[]; let pos=0;
    for(const {t,d} of ch){
      let at=t0==null?pos:Math.round((t-t0)*sr), seg=d;
      if(at+seg.length<=0) continue;
      if(at<0){ seg=seg.subarray(-at); at=0; }
      if(at-pos>sr*.03){ out.push(new Float32Array(at-pos)); pos=at; }   // a real gap: keep the timing
      out.push(seg); pos+=seg.length;                                        // small clock wobble: just carry on
    }
    if(!pos) return null; mic.lateBy=t0==null?0:Math.max(0,(ch.find(c=>c.t+c.d.length/sr>t0)||{t:t0}).t-t0);
    return wav(out,pos,sr);
  }
  // For recorded sound effects: cut the silence before and after, keeping a little breathing room.
  function micTakeTrimmed(){
    const ch=mic.chunks; mic.chunks=null; if(!ch||!ch.length) return null;
    const n=ch.reduce((x,y)=>x+y.d.length,0),all=new Float32Array(n); let o=0; for(const {d} of ch){ all.set(d,o); o+=d.length; }
    const sr=audioCtx().sampleRate,win=Math.round(sr*.01); let peak=0; for(let i=0;i<n;i++) peak=Math.max(peak,Math.abs(all[i])); if(peak<.03) return null;
    const lim=Math.max(.015,peak*.08),loud=i=>{ for(let j=i;j<Math.min(n,i+win);j++) if(Math.abs(all[j])>lim) return true; return false; };
    let s=0; while(s<n&&!loud(s)) s+=win; let e=n-win; while(e>s&&!loud(e)) e-=win;
    s=Math.max(0,s-Math.round(sr*.06)); e=Math.min(n,e+win+Math.round(sr*.15)); const cut=all.slice(s,e),fade=Math.min(cut.length,Math.round(sr*.01));
    for(let i=0;i<fade;i++){ cut[i]*=i/fade; cut[cut.length-1-i]*=i/fade; }
    return wav([cut],cut.length,sr);
  }
  function micStop(){
    if(mic.stream) mic.stream.getTracks().forEach(t=>t.stop());
    try{ mic.src&&mic.src.disconnect(); mic.node&&mic.node.disconnect(); mic.sink&&mic.sink.disconnect(); }catch(_){}
    Object.assign(mic,{stream:null,node:null,src:null,sink:null,chunks:null,level:0});
  }
  function wav(chunks,n,sr){
    const b=new ArrayBuffer(44+n*2), v=new DataView(b), w=(o,s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
    w(0,'RIFF'); v.setUint32(4,36+n*2,true); w(8,'WAVEfmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
    v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true); w(36,'data'); v.setUint32(40,n*2,true);
    let o=44; for(const c of chunks) for(let i=0;i<c.length;i++,o+=2){ const s=Math.max(-1,Math.min(1,c[i])); v.setInt16(o,s<0?s*32768:s*32767,true); }
    return new Blob([b],{type:'audio/wav'});
  }
  function setAec(v){ S.aec=!!v; }
  function setSink(id){ S.sink=id||''; if(ctx&&ctx.setSinkId) ctx.setSinkId(S.sink).catch(()=>{}); }
  function testTone(){ const c=audioCtx(),t=c.currentTime+.05; [523.25,659.25,783.99].forEach((f,i)=>{ const o=c.createOscillator(),g=c.createGain(); o.type='triangle'; o.frequency.value=f; g.gain.setValueAtTime(0,t+i*.18); g.gain.linearRampToValueAtTime(.35,t+i*.18+.02); g.gain.exponentialRampToValueAtTime(.001,t+i*.18+.5); o.connect(g); g.connect(master(c)); o.start(t+i*.18); o.stop(t+i*.18+.55); }); }
  return {get aec(){ return S.aec; },wake,setAec,setSink,testTone,canPickOutput:typeof AudioContext!=='undefined'&&'setSinkId' in AudioContext.prototype,wav,master,AMBIENCE,MUSIC,audioCtx,buffer,schedule,refsFor,mic,micStart,micReady,micCollect,micCollecting,micTake,micTakeTrimmed,micStop};
})();
