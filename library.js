'use strict';
/* Premade cutouts, drawn in code as original simple cartoons. Nothing to download and no licences to track.
   Each one is turned into an ordinary cutout when added, so it can be moved, looped and saved like a drawing. */
const Library=(()=>{
  const K='#2a2320';
  const r=(x,y,w,h,f,rx=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}"/>`;
  const c=(x,y,R,f)=>`<circle cx="${x}" cy="${y}" r="${R}" fill="${f}"/>`;
  const e=(x,y,a,b,f,rot=0)=>`<ellipse cx="${x}" cy="${y}" rx="${a}" ry="${b}" fill="${f}"${rot?` transform="rotate(${rot} ${x} ${y})"`:''}/>`;
  const p=(d,f='none')=>`<path d="${d}" fill="${f}"/>`;
  const dot=(x,y,R=5)=>`<circle cx="${x}" cy="${y}" r="${R}" fill="${K}" stroke="none"/>`;
  const svg=(w,h,body,sw=5)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="-8 -8 ${w+16} ${h+16}"><g stroke="${K}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

  /* ---- people ---- */
  const SK=['#f8d3b0','#e8b184','#c58a5a','#8d5a36','#5f3b24'];
  function hairBack(s,col,hy){ if(s==='long') return p(`M${100-50} ${hy+2} Q${100-58} ${hy+90} ${100-44} ${hy+100} L${100+44} ${hy+100} Q${100+58} ${hy+90} ${100+50} ${hy+2} Z`,col); if(s==='scarf') return p(`M46 ${hy-4} Q42 ${hy+84} 62 ${hy+96} L138 ${hy+96} Q158 ${hy+84} 154 ${hy-4} Q100 ${hy-74} 46 ${hy-4} Z`,col); if(s==='bun') return c(100,hy-52,20,col); if(s==='plaits') return r(40,hy-2,18,76,col,9)+r(142,hy-2,18,76,col,9); return ''; }
  function hairFront(s,col,hy){ switch(s){
    case 'short': return p(`M52 ${hy} Q50 ${hy-50} 100 ${hy-50} Q150 ${hy-50} 148 ${hy} Q130 ${hy-24} 100 ${hy-24} Q70 ${hy-24} 52 ${hy} Z`,col);
    case 'long': case 'bun': case 'plaits': return p(`M52 ${hy+4} Q48 ${hy-50} 100 ${hy-50} Q152 ${hy-50} 148 ${hy+4} Q128 ${hy-26} 100 ${hy-28} Q72 ${hy-26} 52 ${hy+4} Z`,col);
    case 'curly': return [[58,-8],[66,-30],[84,-44],[104,-48],[124,-42],[138,-26],[144,-6]].map(([x,y])=>c(x,hy+y,17,col)).join('');
    case 'cap': return p(`M54 ${hy-8} Q56 ${hy-52} 100 ${hy-52} Q144 ${hy-52} 146 ${hy-8} Z`,col)+r(136,hy-16,38,10,col,5);
    case 'scarf': return p(`M50 ${hy+4} Q48 ${hy-54} 100 ${hy-54} Q152 ${hy-54} 150 ${hy+4} Q130 ${hy-26} 100 ${hy-26} Q70 ${hy-26} 50 ${hy+4} Z`,col)+p(`M58 ${hy+34} Q100 ${hy+64} 142 ${hy+34} L150 ${hy+54} Q100 ${hy+78} 50 ${hy+54} Z`,col);
    case 'bald': return ''; default: return ''; } }
  function face(hy,o={}){ let s=dot(82,hy+4)+dot(118,hy+4)+p(`M84 ${hy+22} Q100 ${hy+36} 116 ${hy+22}`);
    if(o.glasses) s+=`<circle cx="82" cy="${hy+4}" r="12" fill="none"/><circle cx="118" cy="${hy+4}" r="12" fill="none"/>`+p(`M94 ${hy+4} L106 ${hy+4}`);
    if(o.patch) s+=c(118,hy+4,11,K)+p(`M56 ${hy-14} L146 ${hy+6}`);
    if(o.beard) s+=p(`M56 ${hy+8} Q60 ${hy+66} 100 ${hy+70} Q140 ${hy+66} 144 ${hy+8} Q130 ${hy+18} 116 ${hy+16} Q100 ${hy+26} 84 ${hy+16} Q70 ${hy+18} 56 ${hy+8} Z`,o.beard)+p(`M88 ${hy+30} Q100 ${hy+38} 112 ${hy+30}`);
    return s; }
  function person(o){ const adult=o.adult!==false,skin=o.skin||SK[0],hy=62; // hy = eye line
    const tTop=hy+46,tH=adult?104:82,lH=adult?104:72,bot=tTop+tH,total=bot+lH+18,top=o.top||'#3b82c4',legs=o.legs||'#39506b',shoe=o.shoes||K;
    let s=hairBack(o.hair,o.hairCol||'#4a2c17',hy)+(o.back||'');
    if(o.dress) s+=r(74,bot-6,16,lH+4,skin)+r(110,bot-6,16,lH+4,skin);
    else s+=r(66,bot-6,30,lH+4,legs,4)+r(104,bot-6,30,lH+4,legs,4);
    s+=r(58,bot+lH-8,42,20,shoe,9)+r(100,bot+lH-8,42,20,shoe,9);
    s+=r(38,tTop+6,22,tH-22,o.sleeve||top,10)+r(140,tTop+6,22,tH-22,o.sleeve||top,10)+c(49,tTop+tH-14,12,o.hand||skin)+c(151,tTop+tH-14,12,o.hand||skin);
    if(o.dress) s+=p(`M66 ${tTop} L134 ${tTop} L${160} ${bot+26} L${40} ${bot+26} Z`,top); else s+=r(58,tTop,84,tH,top,14);
    s+=(o.chest||'');
    s+=r(88,hy+34,24,20,skin)+c(100,hy,50,o.hair==='scarf'?skin:skin)+face(hy,o)+hairFront(o.hair,o.hairCol||'#4a2c17',hy)+(o.hat||'');
    return o.hat?`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="${total+90}" viewBox="-8 -80 216 ${total+98}"><g stroke="${K}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${s}</g></svg>`:svg(200,total,s); }
  const stripes=(y0,n,gap,col)=>Array.from({length:n},(_,i)=>r(61,y0+i*gap,78,gap/2,col)).join('');
  const P=[
    ['boy','Boy',{adult:false,hair:'short',top:'#e2574c',legs:'#3b5f8a'}],
    ['girl','Girl',{adult:false,skin:SK[3],hair:'plaits',hairCol:'#1f1512',top:'#f2b632',dress:true,shoes:'#c0392b'}],
    ['kid-curly','Kid with curls',{adult:false,skin:SK[2],hair:'curly',hairCol:'#2a1a12',top:'#3fa66b',legs:'#6a4c93'}],
    ['kid-glasses','Kid with glasses',{adult:false,skin:SK[1],hair:'short',hairCol:'#1f1512',glasses:true,top:'#7e57c2',legs:'#2d3e50'}],
    ['kid-scarf','Kid in a headscarf',{adult:false,skin:SK[1],hair:'scarf',hairCol:'#2a9d8f',top:'#2a9d8f',legs:'#e9c46a'}],
    ['man','Man',{skin:SK[2],hair:'short',hairCol:'#1f1512',top:'#2f7fb8',legs:'#3a3a48'}],
    ['woman','Woman',{hair:'long',hairCol:'#b5651d',top:'#d6457a',legs:'#34495e'}],
    ['woman2','Woman with a bun',{skin:SK[4],hair:'bun',hairCol:'#17100d',top:'#e9a23b',dress:true,shoes:'#7b3f00'}],
    ['man-beard','Man with a beard',{skin:SK[0],hair:'short',hairCol:'#7a4a21',beard:'#7a4a21',top:'#4f9d69',legs:'#4a3b2a'}],
    ['grandma','Grandma',{skin:SK[1],hair:'bun',hairCol:'#d9d9d9',glasses:true,top:'#9b6fb5',dress:true,shoes:'#5a4a6a'}],
    ['grandpa','Grandpa',{skin:SK[3],hair:'bald',glasses:true,beard:'#e4e4e4',top:'#8a7a5c',legs:'#55606e'}],
    ['pirate','Pirate',{hair:'short',hairCol:'#2a1a12',patch:true,beard:'#2a1a12',top:'#fff',chest:stripes(120,5,20,'#c8321e'),sleeve:'#c8321e',legs:'#2f3a55',hat:p('M38 26 Q100 -30 162 26 Q100 8 38 26 Z','#22202a')+c(100,10,6,'#fff')}],
    ['knight','Knight',{skin:SK[1],hair:'bald',top:'#aab4c0',legs:'#7f8a96',sleeve:'#8d98a5',hand:'#7f8a96',shoes:'#5c6570',chest:p('M100 124 L100 200 M72 150 L128 150'),hat:p('M50 52 Q50 4 100 4 Q150 4 150 52 L150 40 L50 40 Z','#aab4c0')+p('M100 4 Q118 -22 134 -8 Q116 -6 108 8','#c8321e')}],
    ['princess','Royal',{skin:SK[3],hair:'long',hairCol:'#1f1512',top:'#e36fa5',dress:true,shoes:'#b0417a',hat:p('M68 18 L68 -14 L84 4 L100 -18 L116 4 L132 -14 L132 18 Z','#f4c430')}],
    ['wizard','Wizard',{skin:SK[0],hair:'bald',beard:'#f2f2f2',top:'#3f4aa0',dress:true,shoes:'#2a2f66',hat:p('M44 22 L100 -66 L156 22 Q100 2 44 22 Z','#3f4aa0')+dot(96,-14,5)+dot(112,4,4)}],
    ['chef','Chef',{skin:SK[2],hair:'short',hairCol:'#1f1512',top:'#fafafa',legs:'#55606e',chest:dot(100,136,4)+dot(100,160,4)+dot(100,184,4),hat:p('M60 18 L60 -16 Q44 -44 72 -44 Q84 -66 106 -50 Q140 -60 140 -28 L140 18 Q100 6 60 18 Z','#fff')}],
    ['astronaut','Astronaut',{skin:SK[1],hair:'bald',top:'#f0f0f0',legs:'#dcdcdc',sleeve:'#e4e4e4',hand:'#b9c2cc',shoes:'#8a93a0',chest:r(78,132,44,30,'#3b82c4',4),back:r(30,110,140,90,'#b9c2cc',12),hat:`<circle cx="100" cy="62" r="60" fill="#cfe9f5" fill-opacity=".35"/>`}],
  ];
  function wheelchair(){ const hy=62,skin=SK[1]; let s=c(116,300,62,'#eef2f6')+c(116,300,18,'#8a93a0')+p('M116 238 L116 362 M54 300 L178 300')+c(30,344,18,'#8a93a0');
    s+=p('M150 130 L150 240 L60 240 L34 340','none')+r(58,150,84,92,'#3fa0d6',14)+r(44,230,64,28,'#34495e',8)+r(26,240,28,86,'#34495e',8)+r(10,318,44,18,K,8)+r(44,160,22,60,'#3fa0d6',10)+c(55,226,12,skin);
    s+=r(88,hy+34,24,24,skin)+c(100,hy,50,skin)+face(hy)+hairFront('short','#b5651d',hy); return svg(190,366,s); }

  /* ---- animals ---- */
  function quad(o){ const b=o.body,d=o.dark||b,W=340,H=o.h||230; let s='';
    s+=(o.tail||'')+r(84,130,28,88,d,8)+r(218,130,28,88,d,8);
    s+=r(60,128,28,92,b,8)+r(196,128,28,92,b,8)+e(160,110,110,62,b)+(o.marks||'')+(o.head||''); return svg(W,H,s); }
  const dogHead=(b,ear,nose=K)=>c(268,70,52,b)+e(240,44,18,38,ear,18)+e(298,44,18,38,ear,-18)+e(292,88,28,20,'#fff4e3')+e(304,80,10,8,nose)+dot(256,62)+dot(292,58)+p('M284 100 Q296 110 308 98');
  const catHead=(b,inner)=>c(268,72,48,b)+p('M226 50 L228 6 L262 26 Z',b)+p('M274 26 L308 6 L310 50 Z',b)+p('M236 38 L237 20 L250 28 Z',inner)+dot(252,66)+dot(286,66)+p('M262 84 L274 84 L268 92 Z',inner)+p('M268 92 Q258 104 250 96 M268 92 Q278 104 286 96 M226 80 L196 74 M226 90 L196 94 M310 80 L340 74 M310 90 L340 94');
  const A=[
    ['dog','Dog',quad({body:'#c98a4b',dark:'#a86f39',tail:p('M54 100 Q18 70 30 40','none').replace('fill="none"','fill="none" stroke-width="16"'),head:dogHead('#c98a4b','#8a5a2b'),marks:e(150,88,34,24,'#8a5a2b')})],
    ['puppy','Spotty puppy',quad({body:'#fafafa',dark:'#e3e3e3',tail:p('M54 100 Q24 90 26 60','none').replace('fill="none"','fill="none" stroke-width="14"'),head:dogHead('#fafafa','#3a3030'),marks:c(120,96,20,'#3a3030')+c(190,120,14,'#3a3030')})],
    ['cat','Cat',quad({body:'#ef9d3f',dark:'#d48429',tail:p('M54 100 Q10 80 26 26','none').replace('fill="none"','fill="none" stroke-width="16"'),head:catHead('#ef9d3f','#f7c7c0'),marks:p('M120 52 L126 92 M156 48 L158 92 M192 52 L188 92')})],
    ['horse','Horse',svg(340,290,p('M60 110 Q20 130 30 200 Q50 170 66 150','#4a2c17')+r(84,180,26,100,'#8a5a2b',6)+r(218,180,26,100,'#8a5a2b',6)+r(60,180,26,104,'#a56c36',6)+r(196,180,26,104,'#a56c36',6)+e(150,150,105,58,'#a56c36')+p('M214 130 L250 40 L304 44 L300 92 L270 92 L250 170 Z','#a56c36')+p('M246 40 Q222 70 212 118 L232 96 L250 54','#4a2c17')+p('M256 42 L260 14 L278 40 Z','#a56c36')+dot(278,60)+e(302,80,12,16,'#7d4f24'))],
    ['cow','Cow',quad({body:'#fafafa',dark:'#e7e7e7',tail:p('M54 90 Q30 110 34 160','none').replace('fill="none"','fill="none" stroke-width="10"'),marks:e(120,92,30,24,K)+e(200,128,22,18,K),head:p('M226 22 Q220 0 240 4 L246 24 Z M310 22 Q316 0 296 4 L290 24 Z','#e9d9a8')+e(226,50,20,12,'#fafafa')+e(310,50,20,12,'#fafafa')+c(268,66,46,'#fafafa')+e(268,98,36,24,'#f4b8c4')+dot(254,96,4)+dot(282,96,4)+dot(250,58)+dot(286,58)})],
    ['pig','Pig',quad({body:'#f4a9b8',dark:'#e58fa1',h:220,tail:p('M52 100 q-22 -12 -14 -26 q12 -8 14 6','none'),head:c(268,76,50,'#f4a9b8')+p('M232 40 L226 8 L260 28 Z M304 40 L310 8 L276 28 Z','#f4a9b8')+e(278,88,24,18,'#e58fa1')+dot(270,88,4)+dot(286,88,4)+dot(250,62)+dot(292,60)})],
    ['sheep','Sheep',svg(320,230,r(90,130,20,90,K)+r(210,130,20,90,K)+[[80,100],[120,66],[170,58],[220,70],[250,110],[210,146],[160,152],[110,146],[150,104]].map(([x,y])=>c(x,y,38,'#fafafa')).join('')+e(270,90,36,44,'#3a3030')+e(232,70,18,10,'#3a3030')+c(262,80,6,'#fff')+c(290,80,6,'#fff')+dot(262,80,3)+dot(290,80,3))],
    ['rabbit','Rabbit',svg(220,300,e(70,60,20,60,'#efe9df')+e(140,60,20,60,'#efe9df')+e(70,64,8,42,'#f4b8c4')+e(140,64,8,42,'#f4b8c4')+e(105,214,70,76,'#efe9df')+c(105,120,58,'#efe9df')+e(105,226,38,48,'#fff')+e(60,280,30,14,'#efe9df')+e(150,280,30,14,'#efe9df')+dot(84,112)+dot(126,112)+p('M98 130 L112 130 L105 138 Z','#f4b8c4')+p('M105 138 Q95 150 88 142 M105 138 Q115 150 122 142'))],
    ['bird','Bird',svg(260,190,p('M40 92 L0 62 L6 112 Z','#2f7fb8')+e(120,100,84,62,'#3fa0d6')+e(116,118,48,36,'#cfe9f5')+p('M90 84 Q126 64 150 104 Q110 124 90 84 Z','#2f7fb8')+c(170,66,38,'#3fa0d6')+p('M204 56 L250 70 L204 84 Z','#f2b632')+dot(180,58)+p('M104 160 L100 186 M138 160 L142 186'))],
    ['owl','Owl',svg(220,270,p('M44 40 L60 76 L90 50 Z M176 40 L160 76 L130 50 Z','#8a5a2b')+e(110,146,86,112,'#8a5a2b')+e(110,190,52,62,'#e9d9a8')+e(30,160,18,60,'#6e4620',12)+e(190,160,18,60,'#6e4620',-12)+c(76,92,32,'#fff')+c(144,92,32,'#fff')+dot(76,92,12)+dot(144,92,12)+p('M100 114 L120 114 L110 134 Z','#f2b632')+p('M90 200 l10 12 l10 -12 l10 12 l10 -12')+p('M84 256 L84 240 M136 256 L136 240'))],
    ['fish','Fish',svg(300,180,p('M60 90 L6 34 L6 146 Z','#f2702b')+p('M130 34 Q170 -6 200 34 Z','#f2702b')+e(160,90,112,66,'#f79a4b')+p('M110 34 Q84 90 110 146 Q130 90 110 34 Z M180 26 Q156 90 180 154 Q200 90 180 26 Z','#fff')+c(234,74,18,'#fff')+dot(238,74,8)+p('M252 112 Q240 120 230 112'))],
    ['frog','Frog',svg(280,200,e(60,178,44,16,'#3f9e4d')+e(220,178,44,16,'#3f9e4d')+e(140,126,106,66,'#57b85e')+c(82,52,34,'#57b85e')+c(198,52,34,'#57b85e')+c(82,50,20,'#fff')+c(198,50,20,'#fff')+dot(84,52,9)+dot(200,52,9)+p('M72 120 Q140 170 208 120')+e(140,162,56,20,'#cfeab3'))],
    ['elephant','Elephant',svg(350,270,p('M38 110 Q10 130 22 170','none')+r(84,170,44,92,'#7f8a96',8)+r(206,170,44,92,'#7f8a96',8)+e(150,126,118,84,'#9aa5b1')+e(232,100,48,66,'#7f8a96')+c(278,96,52,'#9aa5b1')+p('M304 128 Q330 200 300 240 L326 246 Q358 190 330 112 Z','#9aa5b1')+p('M286 146 L276 180 L300 158 Z','#fff')+dot(292,84))],
    ['lion','Lion',quad({body:'#e9b44c',dark:'#d19c35',tail:p('M54 100 Q18 110 20 150','none').replace('fill="none"','fill="none" stroke-width="10"')+c(20,158,14,'#a65f1b'),head:Array.from({length:12},(_,i)=>c(268+Math.cos(i*.5236)*50,74+Math.sin(i*.5236)*50,20,'#a65f1b')).join('')+c(268,74,48,'#f2c666')+dot(250,64)+dot(286,64)+p('M260 82 L276 82 L268 92 Z',K)+p('M268 92 Q258 104 250 96 M268 92 Q278 104 286 96')})],
    ['bear','Bear',svg(240,290,c(62,56,28,'#8a5a2b')+c(178,56,28,'#8a5a2b')+e(50,272,36,16,'#6e4620')+e(190,272,36,16,'#6e4620')+e(120,198,86,84,'#8a5a2b')+e(120,212,50,54,'#c79a6a')+e(36,180,20,50,'#6e4620',20)+e(204,180,20,50,'#6e4620',-20)+c(120,92,66,'#8a5a2b')+e(120,112,30,24,'#c79a6a')+e(120,102,10,7,K)+dot(92,80)+dot(148,80)+p('M120 110 Q110 124 102 118 M120 110 Q130 124 138 118'))],
    ['dino','Dinosaur',svg(380,260,p('M70 130 Q10 150 0 100 Q40 110 96 90','#6fbf5c')+[[110,62],[148,48],[186,50],[222,66]].map(([x,y])=>p(`M${x-18} ${y+14} L${x} ${y-22} L${x+18} ${y+14} Z`,'#e9a23b')).join('')+r(100,160,36,92,'#5aa648',10)+r(200,160,36,92,'#5aa648',10)+e(160,130,104,70,'#6fbf5c')+p('M236 110 Q260 60 280 44 L330 40 Q372 46 366 84 Q356 104 310 98 Q280 104 268 150 Z','#6fbf5c')+dot(322,62)+p('M366 80 Q340 90 316 84')+c(130,122,12,'#5aa648')+c(180,150,10,'#5aa648'))],
    ['turtle','Turtle',svg(310,170,e(82,146,28,18,'#57b85e')+e(214,146,28,18,'#57b85e')+p('M34 120 L8 128 L34 108 Z','#57b85e')+c(262,92,34,'#57b85e')+p('M40 126 Q40 20 150 20 Q250 20 250 126 Z','#8a5a2b')+p('M110 40 L92 88 L126 124 M190 40 L208 88 L174 124 M92 88 L208 88')+dot(272,84)+p('M266 104 Q278 110 288 100'))],
    ['butterfly','Butterfly',svg(240,190,e(66,62,62,52,'#e36fa5',-20)+e(174,62,62,52,'#e36fa5',20)+e(74,142,44,38,'#f2b632',20)+e(166,142,44,38,'#f2b632',-20)+c(62,62,20,'#fff')+c(178,62,20,'#fff')+e(120,100,12,62,'#3a3030')+p('M116 42 Q100 12 88 12 M124 42 Q140 12 152 12'))],
  ];

  /* ---- nature ---- */
  const N=[
    ['tree','Tree',svg(240,320,r(94,190,52,124,'#8a5a2b',6)+[[60,150,56],[180,150,56],[120,84,76],[120,170,62]].map(([x,y,R])=>c(x,y,R,'#58a84e')).join('').replace(/stroke-width/g,'stroke-width')+p('M108 230 L120 250 M130 270 L142 256'))],
    ['pine','Pine tree',svg(220,330,r(90,270,40,56,'#7a4a21',4)+p('M110 150 L206 284 L14 284 Z','#2f8050')+p('M110 80 L186 196 L34 196 Z','#378f5a')+p('M110 6 L166 112 L54 112 Z','#41a067'))],
    ['palm','Palm tree',svg(290,340,p('M136 334 Q124 220 156 120 L180 124 Q156 220 176 334 Z','#a56c36')+p('M168 120 Q110 60 30 96 Q100 96 168 120 Z M168 120 Q190 40 270 40 Q210 70 168 120 Z M168 120 Q90 20 60 20 Q130 40 168 120 Z M168 120 Q250 90 286 146 Q230 110 168 120 Z M168 120 Q120 130 76 190 Q110 120 168 120 Z','#49a652')+c(154,132,14,'#7a4a21')+c(182,134,14,'#7a4a21'))],
    ['bush','Bush',svg(250,150,[[50,100,46],[120,74,66],[196,98,50]].map(([x,y,R])=>c(x,y,R,'#58a84e')).join('')+r(20,112,210,32,'#58a84e',16)+`<g stroke="none">`+[[50,100,43],[120,74,63],[196,98,47]].map(([x,y,R])=>c(x,y,R,'#58a84e')).join('')+r(23,108,204,33,'#58a84e',14)+`</g>`)],
    ['flower','Flower',svg(130,260,p('M65 110 L65 254')+p('M65 200 Q24 180 16 210 Q40 226 65 214 Z','#58a84e')+Array.from({length:6},(_,i)=>c(65+Math.cos(i*1.047)*36,62+Math.sin(i*1.047)*36,22,'#e36fa5')).join('')+c(65,62,20,'#f2c43a'))],
    ['rock','Rock',svg(240,140,p('M10 134 L34 60 L92 16 L170 26 L222 80 L232 134 Z','#9aa0a6')+p('M92 16 L110 70 L170 26 M110 70 L80 134'))],
    ['mountain','Mountain',svg(380,260,p('M4 254 L190 8 L376 254 Z','#7f8a96')+p('M190 8 L132 84 L164 72 L190 96 L218 72 L248 84 Z','#fafafa'))],
    ['cloud','Cloud',svg(280,140,[[60,92,44],[130,62,58],[206,88,48]].map(([x,y,R])=>c(x,y,R,'#fff')).join('')+r(36,88,204,44,'#fff',22)+`<g stroke="none">`+[[60,92,41],[130,62,55],[206,88,45]].map(([x,y,R])=>c(x,y,R,'#fff')).join('')+r(38,86,200,44,'#fff',20)+`</g>`)],
    ['sun','Sun',svg(240,240,Array.from({length:12},(_,i)=>{const a=i*.5236;return p(`M${120+Math.cos(a)*70} ${120+Math.sin(a)*70} L${120+Math.cos(a)*112} ${120+Math.sin(a)*112}`);}).join('').replace(/fill="none"/g,'fill="none" stroke="#f2a31b" stroke-width="12"')+c(120,120,66,'#f7c62f')+dot(100,110,6)+dot(140,110,6)+p('M96 136 Q120 158 144 136'))],
    ['moon','Moon',svg(170,210,p('M130 8 A100 100 0 1 0 130 202 A125 125 0 0 1 130 8 Z','#f4e08a')+dot(42,92,5)+p('M36 128 Q50 140 64 130'))],
    ['star','Star',svg(200,190,p('M100 6 L128 68 L194 74 L144 118 L160 184 L100 148 L40 184 L56 118 L6 74 L72 68 Z','#f7c62f'))],
  ];

  /* ---- buildings ---- */
  const B=[
    ['house','House',svg(320,300,r(40,130,240,164,'#f2d7a6')+p('M12 138 L160 14 L308 138 Z','#c8503c')+r(228,34,32,70,'#8a5a2b')+r(130,204,60,90,'#7a4a21',4)+c(178,250,5,'#f2c43a')+r(62,164,48,48,'#bfe3f5')+r(210,164,48,48,'#bfe3f5')+p('M86 164 L86 212 M62 188 L110 188 M234 164 L234 212 M210 188 L258 188'))],
    ['cottage','Cottage',svg(300,240,r(30,110,240,124,'#fafafa')+p('M6 118 Q150 -30 294 118 Z','#d9a441')+p('M50 80 L70 100 M110 50 L126 76 M180 48 L170 76 M240 78 L224 100')+r(122,156,56,78,'#3f7f9c',28)+c(62,158,22,'#bfe3f5')+c(238,158,22,'#bfe3f5'))],
    ['apartment','Tall building',svg(200,360,r(14,10,172,344,'#8fa3b5')+Array.from({length:15},(_,i)=>r(34+(i%3)*50,30+Math.floor(i/3)*58,32,38,i%4?'#fce9a4':'#bfe3f5')).join('')+r(76,306,48,48,'#55606e'))],
    ['shop','Shop',svg(310,260,r(20,70,270,184,'#f7e7c6')+r(36,110,104,84,'#bfe3f5')+r(186,120,70,134,'#3fa66b',4)+p('M10 20 L300 20 L300 76 Q280 100 262 76 Q244 100 226 76 Q208 100 190 76 Q172 100 154 76 Q136 100 118 76 Q100 100 82 76 Q64 100 46 76 Q28 100 10 76 Z','#e2574c')+c(240,190,5,'#f2c43a'))],
    ['school','School',svg(380,270,r(30,110,320,154,'#d9694a')+p('M130 110 L190 56 L250 110 Z','#8a3a28')+r(186,6,4,50,K)+p('M190 8 L226 18 L190 30 Z','#3b82c4')+c(190,82,14,'#fafafa')+r(164,180,52,84,'#5a3a22')+[56,106,248,298].map(x=>r(x,140,34,44,'#bfe3f5')).join(''))],
    ['barn','Barn',svg(320,270,r(30,110,260,154,'#c8503c')+p('M30 112 L70 40 L250 40 L290 112 Z','#7a3326')+r(110,170,100,94,'#fafafa')+p('M110 170 L210 264 M210 170 L110 264')+r(136,66,48,36,'#fafafa'))],
    ['castle','Castle',svg(400,340,r(20,100,84,234,'#b4bcc6')+r(296,100,84,234,'#b4bcc6')+r(90,160,220,174,'#c4ccd4')+[20,48,76,296,324,352].map(x=>r(x,78,24,26,'#b4bcc6')).join('')+[100,140,180,220,260].map(x=>r(x,136,26,28,'#c4ccd4')).join('')+p('M14 80 L62 14 L110 80 Z','#3f4aa0')+p('M290 80 L338 14 L386 80 Z','#3f4aa0')+r(60,0,4,16,K)+p('M64 2 L90 10 L64 18 Z','#c8321e')+r(336,0,4,16,K)+p('M340 2 L366 10 L340 18 Z','#c8321e')+p('M156 334 L156 250 Q200 196 244 250 L244 334 Z','#5a3a22')+p('M178 228 L178 334 M200 216 L200 334 M222 228 L222 334')+r(48,170,28,48,'#2a2d3e',14)+r(324,170,28,48,'#2a2d3e',14))],
    ['tent','Tent',svg(300,220,p('M10 214 L150 12 L290 214 Z','#e9a23b')+p('M150 90 L108 214 L192 214 Z','#3a3030')+p('M150 12 L150 90'))],
    ['lighthouse','Lighthouse',svg(180,380,p('M40 374 L60 110 L120 110 L140 374 Z','#fafafa')+p('M56 170 L124 170 L128 226 L52 226 Z M48 282 L132 282 L136 336 L44 336 Z','#d9402b')+r(44,96,92,16,'#3a3030')+r(58,50,64,48,'#f7e27a')+p('M50 52 L90 12 L130 52 Z','#d9402b')+r(74,330,32,44,'#5a3a22',14))],
  ];

  /* ---- vehicles ---- */
  const wheel=(x,y,R=26)=>c(x,y,R,'#2f2f36')+c(x,y,R*.42,'#cfd5db');
  const V=[
    ['car','Car',svg(360,170,p('M16 120 Q14 76 66 72 L108 22 L238 22 L290 72 Q344 76 344 120 L344 136 L16 136 Z','#e2574c')+p('M122 36 L92 72 L170 72 L170 36 Z M186 36 L186 72 L268 72 L226 36 Z','#bfe3f5')+e(330,96,10,12,'#fce9a4')+wheel(88,136)+wheel(270,136))],
    ['bus','Bus',svg(420,190,r(10,14,400,136,'#f2b632',16)+[34,100,166,232].map(x=>r(x,36,54,46,'#bfe3f5')).join('')+r(300,36,92,108,'#bfe3f5')+p('M346 36 L346 144')+r(10,96,290,10,'#2a2320')+wheel(90,150,28)+wheel(320,150,28))],
    ['truck','Truck',svg(390,190,r(10,20,240,124,'#3b82c4',4)+p('M254 54 L330 54 L378 100 L378 144 L254 144 Z','#e2574c')+p('M278 70 L322 70 L352 100 L278 100 Z','#bfe3f5')+wheel(84,146,28)+wheel(310,146,28))],
    ['firetruck','Fire truck',svg(400,190,r(10,50,380,96,'#d9402b',8)+p('M284 50 L300 12 L370 12 L390 60 Z','#d9402b')+p('M304 24 L362 24 L374 56 L296 56 Z','#bfe3f5')+r(30,28,230,12,'#cfd5db')+[60,100,140,180,220].map(x=>p(`M${x} 28 L${x} 40`)).join('')+r(30,90,230,12,'#f7f7f7')+c(330,8,8,'#3fa0d6')+wheel(84,146,28)+wheel(320,146,28))],
    ['ship','Pirate ship',svg(420,420,r(204,30,12,300,'#7a4a21')+p('M120 50 Q210 90 300 50 L316 150 Q210 186 104 150 Z','#efe6d2')+p('M84 170 Q210 216 336 170 L356 278 Q210 320 64 278 Z','#efe6d2')+p('M210 30 L210 2 L262 14 L210 28 Z',K)+c(226,14,4,'#fff')+p('M14 294 L80 306 L340 306 L406 262 L392 344 Q380 400 330 406 L90 406 Q44 400 32 350 Z','#8a5a2b')+p('M32 340 L396 330 M42 372 L382 366')+[110,190,270].map(x=>c(x,352,12,'#2a2320')).join(''))],
    ['boat','Rowboat',svg(320,120,p('M6 26 L314 26 Q290 112 220 112 L90 112 Q30 112 6 26 Z','#b5763a')+p('M20 56 L300 56')+p('M50 0 L150 80','none').replace('fill="none"','fill="none" stroke-width="9"'))],
    ['sailboat','Sailboat',svg(290,300,p('M146 8 L146 216')+p('M154 22 L260 196 L154 196 Z','#fafafa')+p('M138 60 L44 196 L138 196 Z','#e36fa5')+p('M14 216 L276 216 Q256 292 200 292 L84 292 Q30 292 14 216 Z','#3b82c4'))],
    ['plane','Plane',svg(420,190,p('M18 44 L58 44 L92 92 L60 96 Z','#d9402b')+p('M30 110 Q30 70 90 70 L340 70 Q406 76 412 110 Q406 138 340 138 L70 138 Q30 136 30 110 Z','#f2f4f6')+p('M170 104 L250 104 L170 186 L132 186 Z','#d9402b')+p('M348 82 Q380 86 394 106 L348 106 Z','#bfe3f5')+[120,160,200,240,280].map(x=>c(x,92,9,'#bfe3f5')).join(''))],
    ['rocket','Rocket',svg(190,340,p('M42 220 L6 300 L54 280 Z M148 220 L184 300 L136 280 Z','#d9402b')+p('M70 280 L120 280 L95 336 Z','#f2a31b')+p('M95 6 Q164 80 146 280 L44 280 Q26 80 95 6 Z','#f2f4f6')+p('M95 6 Q124 36 138 76 L52 76 Q66 36 95 6 Z','#d9402b')+c(95,136,30,'#bfe3f5'))],
    ['train','Train',svg(360,240,r(34,84,214,110,'#2f7fb8',10)+r(220,30,110,164,'#d9402b',8)+r(240,50,70,54,'#bfe3f5')+p('M70 84 L60 30 L120 30 L110 84 Z','#3a3030')+e(90,26,36,10,'#3a3030')+wheel(84,198,28)+wheel(180,198,28)+wheel(280,198,28)+p('M34 180 L6 216 L34 216 Z','#3a3030'))],
    ['bike','Bike',svg(320,190,c(66,126,54,'none')+c(254,126,54,'none')+c(66,126,6,K)+c(254,126,6,K)+p('M66 126 L126 50 L216 50 L254 126 M126 50 L160 126 L66 126 M160 126 L216 50 M216 50 L206 22 L240 22 M126 50 L116 34 M98 32 L136 32','none').replace('fill="none"','fill="none" stroke="#c8321e" stroke-width="8"'))],
  ];

  /* ---- things ---- */
  const T=[
    ['chest','Treasure chest',svg(260,200,p('M20 86 Q20 16 130 16 Q240 16 240 86 Z','#a56c36')+r(20,86,220,106,'#8a5a2b')+r(112,72,36,44,'#f2c43a',4)+dot(130,92,6)+r(44,16,14,176,'#f2c43a')+r(202,16,14,176,'#f2c43a'))],
    ['ball','Ball',svg(160,160,c(80,80,72,'#e2574c')+p('M16 58 Q80 90 144 58 M16 102 Q80 134 144 102','none').replace('fill="none"','fill="none" stroke="#fff" stroke-width="12"'))],
    ['balloon','Balloon',svg(150,300,p('M75 182 Q50 240 90 292')+e(75,92,66,86,'#d9402b')+p('M64 178 L86 178 L75 164 Z','#d9402b')+e(50,62,12,20,'#fff',20))],
    ['crown','Crown',svg(220,150,p('M12 144 L12 36 L60 86 L110 8 L160 86 L208 36 L208 144 Z','#f4c430')+c(60,120,10,'#d9402b')+c(110,120,10,'#3b82c4')+c(160,120,10,'#3fa66b'))],
    ['key','Key',svg(230,110,c(54,54,44,'#f4c430')+c(54,54,16,'#fff')+r(94,42,124,24,'#f4c430')+r(172,62,16,30,'#f4c430')+r(202,62,16,30,'#f4c430'))],
    ['book','Book',svg(240,170,p('M120 26 Q70 0 12 18 L12 150 Q70 132 120 158 Q170 132 228 150 L228 18 Q170 0 120 26 Z','#fafafa')+p('M120 26 L120 158 M40 46 Q70 42 100 54 M40 76 Q70 72 100 84 M140 54 Q170 42 200 46 M140 84 Q170 72 200 76'))],
    ['umbrella','Umbrella',svg(240,270,p('M120 120 L120 240 Q120 266 96 262 Q80 258 82 240','none')+p('M8 124 Q120 -60 232 124 Q204 96 176 124 Q148 96 120 124 Q92 96 64 124 Q36 96 8 124 Z','#6a4c93'))],
    ['gift','Present',svg(200,200,r(14,70,172,124,'#3fa0d6')+r(6,46,188,34,'#2f7fb8')+r(88,46,24,148,'#f2c43a')+p('M100 46 Q50 -10 40 26 Q44 46 100 46 Z M100 46 Q150 -10 160 26 Q156 46 100 46 Z','#f2c43a'))],
    ['sign','Sign',svg(240,250,r(106,110,28,134,'#8a5a2b')+p('M10 14 L196 14 L232 62 L196 110 L10 110 Z','#d9a441')+p('M36 48 L170 48 M36 76 L140 76'))],
    ['bench','Bench',svg(290,170,r(16,18,258,30,'#a56c36',4)+r(16,58,258,30,'#a56c36',4)+r(6,98,278,26,'#8a5a2b',4)+r(30,124,20,42,'#3a3a48')+r(240,124,20,42,'#3a3a48'))],
    ['ufo','Flying saucer',svg(280,150,e(140,58,58,50,'#bfe3f5')+e(140,92,132,34,'#9aa5b1')+[50,100,180,230].map((x,i)=>c(x,94,9,i%2?'#f2c43a':'#e36fa5')).join(''))],
    ['robot','Robot',svg(220,300,r(100,8,20,32,'#8a93a0')+c(110,10,9,'#d9402b')+r(44,36,132,90,'#b4bcc6',12)+c(82,78,16,'#bfe3f5')+c(138,78,16,'#bfe3f5')+dot(82,78,6)+dot(138,78,6)+r(80,102,60,12,K)+r(30,134,160,104,'#8fa3b5',10)+r(70,156,80,44,'#fce9a4',4)+r(6,140,24,74,'#b4bcc6',10)+r(190,140,24,74,'#b4bcc6',10)+r(56,238,38,54,'#b4bcc6',6)+r(126,238,38,54,'#b4bcc6',6))],
  ];

  const items=[];
  const add=(cat,alive,list)=>list.forEach(([id,name,art])=>items.push({id,name,cat,alive,svg:art}));
  add('People',true,P.map(([id,n,o])=>[id,n,person(o)])); items.push({id:'wheelchair',name:'Kid in a wheelchair',cat:'People',alive:true,svg:wheelchair()});
  add('Animals',true,A); add('Nature',false,N); add('Buildings',false,B); add('Vehicles',false,V); add('Things',false,T);
  items.find(i=>i.id==='robot').alive=true;
  const CATS=['People','Animals','Nature','Buildings','Vehicles','Things'];

  /* Rasterise with a paper-white edge, so premade pieces look cut out like students' drawings. */
  async function raster(item,maxEdge){
    const im=new Image(); im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(item.svg); await im.decode();
    const nw=im.naturalWidth||+item.svg.match(/width="(\d+)"/)[1],nh=im.naturalHeight||+item.svg.match(/height="(\d+)"/)[1],k=maxEdge/Math.max(nw,nh),pad=Math.round(maxEdge*.014),w=Math.round(nw*k)+pad*2,h=Math.round(nh*k)+pad*2,cv=document.createElement('canvas'); cv.width=w;cv.height=h; const g=cv.getContext('2d');
    for(let i=0;i<16;i++){ const a=i/8*Math.PI; g.drawImage(im,pad+Math.cos(a)*pad,pad+Math.sin(a)*pad,w-pad*2,h-pad*2); }
    g.globalCompositeOperation='source-in'; g.fillStyle='#fff'; g.fillRect(0,0,w,h); g.globalCompositeOperation='source-over'; g.drawImage(im,pad,pad,w-pad*2,h-pad*2);
    return cv;
  }
  async function toCutout(item){ const cv=await raster(item,900); const blob=await new Promise(r=>cv.toBlob(r,'image/png')); return {blob,w:cv.width,h:cv.height}; }

  /* ---- picker ---- */
  const $=id=>document.getElementById(id); let cat='People',onPick=null;
  function render(){ const tabs=$('libTabs'),grid=$('libGrid'); tabs.innerHTML=''; for(const n of CATS){ const b=document.createElement('button'); b.textContent=n; b.className=n===cat?'on':''; b.setAttribute('aria-pressed',n===cat); b.onclick=()=>{ cat=n; render(); }; tabs.append(b); }
    grid.innerHTML=''; grid.scrollTop=0; for(const it of items.filter(i=>i.cat===cat)){ const b=document.createElement('button'); b.className='libItem'; b.setAttribute('aria-label','Add '+it.name); const im=new Image(); im.alt=''; im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(it.svg); const s=document.createElement('span'); s.textContent=it.name; b.append(im,s); b.onclick=async()=>{ b.classList.add('added'); await onPick(it); }; grid.append(b); } }
  function open(){ render(); $('libDlg').showModal(); }
  function init(o){ onPick=o.onPick; $('libClose').onclick=()=>$('libDlg').close(); }
  return {init,open,items,CATS,toCutout};
})();
