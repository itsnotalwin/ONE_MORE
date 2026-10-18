'use strict';
/* ============================================================
   ONE MORE: THE LAST STROKE — cinematic prologue (experiment).
   A zero-dependency animated film made from procedural ink,
   not an autoplaying remote video or an asset pack.
   Nothing here changes combat, progression or game renderer.
   ============================================================ */
const INTRO = (() => {
  const SCENES = [
    {
      code: '序', chapter: 'PROLOGUE / THE SILENCE',
      title: 'BEFORE THE FIRST MARK',
      line: 'Before there was land or sky, there was a sheet of paper.',
      second: 'It stretched beyond the edges of forever. Perfect. Empty. Waiting.',
      theme: 'birth', seconds: 8,
    },
    {
      code: '筆', chapter: 'I / THE PAINTER',
      title: 'A WORLD IN ONE BREATH',
      line: 'Then the Painter lowered a brush, and silence learned its shape.',
      second: 'Mountains rose from a single stroke. Rivers remembered the sea.',
      theme: 'mountains', seconds: 8,
    },
    {
      code: '影', chapter: 'II / THE OTHER SIDE',
      title: 'EVERY MARK CAST A SHADOW',
      line: 'But the ink on the back of the paper began to move.',
      second: 'The blots were the thoughts the Painter never meant to draw.',
      theme: 'shadows', seconds: 8,
    },
    {
      code: '滅', chapter: 'III / THE GREAT ERASURE',
      title: 'THE WATER CAME',
      line: 'Afraid of what had awakened, the Painter tried to wash it all away.',
      second: 'Ink and mountain. Beast and memory. Everything began to fade.',
      theme: 'erasure', seconds: 9,
    },
    {
      code: '一', chapter: 'IV / WHAT REMAINED',
      title: 'ONE STROKE REFUSED',
      line: 'One unfinished brushstroke held fast to the ruined paper.',
      second: 'It had no name, no master, and no promise except this: endure.',
      theme: 'spirit', seconds: 9,
    },
    {
      code: '巻', chapter: 'V / THE THREE SCROLLS',
      title: 'THREE SHEETS. ONE FATE.',
      line: 'Cross the First Wash. Outlast the Night Scroll. Break the Cinnabar Seal.',
      second: 'At the last edge of the page, the first mistake is still waiting.',
      theme: 'three', seconds: 10,
    },
    {
      code: '續', chapter: 'THE LAST STROKE / YOUR TURN',
      title: 'THE PAGE IS NOT FINISHED.',
      line: 'You cannot save every mark. You can choose what remains.',
      second: 'One more wave. One more brushstroke. One more chance.',
      theme: 'last', seconds: 9,
    },
  ];
  const ARCHIVE = [
    { title: 'PROLOGUE — THE UNSPOKEN PAGE', unlock: 0,
      text: 'Before time had weight, an endless sheet of washi floated in darkness. The Painter shaped it with a brush that could only move forward. Every stroke became a living thing. The world knew no borders, because the paper itself never ended. But the Painter forgot that ink seeps through.' },
    { title: 'SCROLL I — FIRST WASH', unlock: 0,
      text: 'On the first sheet, the ink is still warm. Blots drift without purpose, and divided droplets multiply wherever the brush falters. Here the Last Stroke learns that survival is not purity. Every defeated beast dries into a stain. Each stain records a choice, and the paper remembers all of them.' },
    { title: 'SCROLL II — NIGHT SCROLL', unlock: 10,
      text: 'The second scroll is the reverse of the first. White ink moves through near-black paper. Shadows slip behind the brush. Kage and Shade are not strangers: they are abandoned decisions, strokes the Painter almost made. They pursue the survivor not with hatred, but with the hunger to finally become real.' },
    { title: 'SCROLL III — CINNABAR FIELD', unlock: 20,
      text: 'The third scroll was once the Painter’s signature. Vermilion was supposed to mean completion, yet the seal was pressed before the work was done. Oni and Titan guard a wound where the world is pinned shut. The red ink is not blood: it is the color of an unfinished promise.' },
    { title: 'EPILOGUE — THE UNENDING SHEET', unlock: 30,
      text: 'At the final seal, the Last Stroke discovers that the Painter never meant to erase the world. They had tried to erase the fear of making a mistake. With every surviving mark, the brush proved that a flawed page could still become something beautiful. The seal opens. No border appears. Beyond it waits an endless scroll, not as punishment, but as permission to keep drawing.' },
  ];
  const $ = id => document.getElementById(id);
  const stage = $('screenIntro'), canvas = $('introCanvas'), ctx = canvas.getContext('2d');
  const title = $('introTitle'), line = $('introLine'), second = $('introSecond');
  const code = $('introCode'), chapter = $('introChapter'), counter = $('introCount');
  const nextButton = $('introNext'), soundButton = $('introSound');
  const overlay = $('introContent'), progress = $('introProgress');
  let index = 0, elapsed = 0, lastTime = 0, running = false, visible = false;
  let sceneCache = null, sceneW = 0, sceneH = 0, raf = 0, audio = null, soundOn = false;
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasSeen = () => { try { return sessionStorage.getItem('om_story_seen_v1') === '1'; } catch (_) { return false; } };
  const markSeen = () => { try { sessionStorage.setItem('om_story_seen_v1', '1'); } catch (_) {} };
  function rng(seed) {
    let a = seed | 0;
    return () => {
      a |= 0; a = a + 0x6d2b79f5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function feather(c, x, y, r, seed, color, alpha = 0.5) {
    const random = rng(seed);
    c.save(); c.fillStyle = color; c.globalAlpha = alpha;
    c.beginPath();
    for (let i = 0; i < 17; i++) {
      const a = i / 17 * Math.PI * 2;
      const rr = r * (0.83 + random() * 0.38);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (!i) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath(); c.fill(); c.restore();
  }
  function stroke(c, coords, thick, color, alpha = 1) {
    c.save(); c.strokeStyle = color; c.globalAlpha = alpha;
    c.lineWidth = thick; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    coords.forEach((p,i) => i ? c.lineTo(p[0],p[1]) : c.moveTo(p[0],p[1]));
    c.stroke(); c.restore();
  }
  function mountains(c,w,h,night,random) {
    const ink = night ? '#e9e2d2' : '#1a1714';
    for(let layer=0;layer<4;layer++){
      const y0=h*(0.40+layer*.115);
      const amp=h*(0.16-layer*.025);
      c.beginPath(); c.moveTo(-30,h+30);
      for(let x=-30;x<=w+45;x+=w/18){
        const t=x/w;
        const peak=Math.sin(t*8.2+layer*1.9)*.55+Math.sin(t*17.7+layer)*.21;
        c.lineTo(x,y0-amp*Math.abs(peak)-random()*16);
      }
      c.lineTo(w+40,h+30);c.closePath();
      c.fillStyle=ink;c.globalAlpha=0.035+layer*.07;c.fill();
    }
    c.globalAlpha=1;
    for(let i=0;i<58;i++){
      const x=random()*w, y=h*(.39+random()*.44);
      stroke(c,[[x,y],[x+random()*40-20,y-18-random()*38]],random()*2.3+.2,ink,.12);
    }
  }
  function mountainMist(c,w,h,night) {
    for(let i=0;i<3;i++){
      const y=h*(0.49+i*0.13);
      const g=c.createLinearGradient(0,y-55,0,y+70);
      const p=night?'23,19,15':'237,231,217';
      g.addColorStop(0,'rgba('+p+',0)');
      g.addColorStop(.48,'rgba('+p+',.72)');
      g.addColorStop(1,'rgba('+p+',0)');
      c.fillStyle=g;c.fillRect(0,y-55,w,125);
    }
  }
  function spirit(c,x,y,r,ink,red) {
    feather(c,x,y,r,1928,ink,.93);
    feather(c,x-7,y-7,r*.35,989,ink,.3);
    stroke(c,[[x-r*.6,y+r*.65],[x-r*.5,y+r*1.5],[x-r*.95,y+r*2.4]],r*.22,ink,.56);
    c.fillStyle=red;c.beginPath();c.arc(x+r*.24,y-r*.12,Math.max(2,r*.085),0,Math.PI*2);c.fill();
    c.fillStyle='#ede7d9';c.fillRect(x-r*.22,y-r*.1,r*.14,Math.max(2,r*.07));
  }
  function paintScene(c,w,h,scene) {
    const theme=scene.theme, night=theme==='shadows';
    const paper=night?'#17130f':theme==='three'?'#eadbc4':'#ede7d9';
    const ink=night?'#e9e2d2':'#1a1714',red='#b23a2b';
    const random=rng(5018 + index*771);
    c.fillStyle=paper;c.fillRect(0,0,w,h);
    for(let i=0;i<470;i++){
      const x=random()*w,y=random()*h,l=random()*24+3;
      stroke(c,[[x,y],[x+l,y+random()*3-1.5]],.35,ink,night?.025:.037);
    }
    for(let i=0;i<8;i++){
      const x=random()*w,y=random()*h,r=w*(.04+random()*.16);
      const g=c.createRadialGradient(x,y,0,x,y,r);
      const col=night?'235,227,215':'48,37,28';
      g.addColorStop(0,'rgba('+col+',.055)');g.addColorStop(1,'rgba('+col+',0)');
      c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);
    }
    if(theme==='birth'){
      const x=w*.58,y=h*.46;
      const grad=c.createRadialGradient(x,y,0,x,y,w*.27);
      grad.addColorStop(0,'rgba(26,23,20,.17)');grad.addColorStop(1,'rgba(26,23,20,0)');
      c.fillStyle=grad;c.fillRect(0,0,w,h);
      stroke(c,[[w*.1,h*.7],[w*.28,h*.64],[w*.48,h*.6],[w*.67,h*.49],[w*.82,h*.52]],Math.max(2,w*.018),ink,.82);
      stroke(c,[[w*.1,h*.71],[w*.32,h*.63],[w*.48,h*.615]],Math.max(1,w*.004),ink,.22);
    }else if(theme==='mountains'){
      mountains(c,w,h,false,random);mountainMist(c,w,h,false);
      stroke(c,[[w*.1,h*.86],[w*.3,h*.78],[w*.5,h*.87],[w*.66,h*.73],[w*.88,h*.8]],9,ink,.42);
      for(let i=0;i<6;i++)feather(c,w*(.1+random()*.8),h*(.55+random()*.35),random()*12+3,i+20,ink,.22);
    }else if(theme==='shadows'){
      mountains(c,w,h,true,random);
      for(let i=0;i<18;i++){
        const x=random()*w, y=h*(.26+random()*.5);
        feather(c,x,y,random()*15+4,i*101,ink,.15);
      }
      for(let i=0;i<11;i++){
        const x=w*(.12+random()*.75),y=h*(.32+random()*.4);
        stroke(c,[[x-15,y+15],[x,y-12],[x+15,y+15]],.8,ink,.31);
      }
      mountainMist(c,w,h,true);
    }else if(theme==='erasure'){
      mountains(c,w,h,false,random);
      c.save();c.globalCompositeOperation='destination-out';
      for(let i=0;i<9;i++){
        const y=h*(.2+i*.09);
        stroke(c,[[-70,y],[w*.35,y-18],[w*.72,y+20],[w+70,y-9]],w*.038,'#fff',.20);
      }
      c.restore();
      for(let i=0;i<70;i++)feather(c,random()*w,random()*h,random()*5+1,i*10,ink,.18);
      stroke(c,[[w*.27,h*.1],[w*.36,h*.4],[w*.43,h*.75]],w*.009,red,.74);
    }else if(theme==='spirit'||theme==='last'){
      mountains(c,w,h,false,random);mountainMist(c,w,h,false);
      spirit(c,w*.56,h*.53,Math.min(w,h)*.07,ink,red);
      c.save();c.translate(w*.75,h*.57);c.rotate(-.07);
      c.strokeStyle=red;c.lineWidth=3;c.globalAlpha=.8;
      c.strokeRect(-38,-38,76,76);
      c.fillStyle=red;c.font='54px "Zen Antique", serif';c.textAlign='center';c.textBaseline='middle';c.fillText('一',0,2);
      c.restore();
    }else if(theme==='three'){
      const cols=['#ede7d9','#17130f','#eadbc4'];
      for(let col=0;col<3;col++){
        const x=w*(.10+col*.285),wid=w*.245,y=h*.24,hei=h*.56;
        c.fillStyle=cols[col];c.fillRect(x,y,wid,hei);
        c.strokeStyle=col===1?'#e9e2d2':'#1a1714';c.globalAlpha=.4;
        c.lineWidth=1.5;c.strokeRect(x,y,wid,hei);c.globalAlpha=1;
        c.save();c.beginPath();c.rect(x,y,wid,hei);c.clip();c.translate(x,y);
        mountains(c,wid,hei,col===1,random);
        if(col===2){stroke(c,[[0,hei*.35],[wid*.28,hei*.44],[wid*.8,hei*.2]],7,red,.7);}
        c.restore();
        c.font=Math.round(Math.min(wid*.23,39))+'px "Zen Antique",serif';
        c.fillStyle=col===1?'#e9e2d2':red;c.textAlign='center';
        c.fillText(['一','夜','紅'][col],x+wid*.5,y+hei*.86);
      }
    }
    c.globalAlpha=1;
  }
  function resize() {
    if (!canvas) return;
    const bounds=canvas.getBoundingClientRect();
    const w=Math.max(1,Math.round(bounds.width)),h=Math.max(1,Math.round(bounds.height));
    if(w===sceneW&&h===sceneH&&sceneCache)return;
    sceneW=w;sceneH=h;
    const dpr=Math.min(1.5,window.devicePixelRatio||1);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    sceneCache=document.createElement('canvas');
    sceneCache.width=canvas.width;sceneCache.height=canvas.height;
    const c=sceneCache.getContext('2d');
    c.setTransform(dpr,0,0,dpr,0,0);
    paintScene(c,w,h,SCENES[index]);
  }
  function render(now) {
    if(!visible) return;
    const dt=Math.min(.08,Math.max(0,(now-lastTime)/1000||0));
    lastTime=now;
    if(!document.hidden&&running&&!reduced) {
      elapsed+=dt;
      if(elapsed>=SCENES[index].seconds){ next(); }
    }
    resize();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(sceneCache){
      const move=(!reduced&&running)?Math.sin(now/5700+index)*Math.min(canvas.width*.006,11):0;
      const zoom=(!reduced&&running)?1.024+Math.min(.022,elapsed/SCENES[index].seconds*.022):1;
      const dw=canvas.width*zoom,dh=canvas.height*zoom;
      ctx.drawImage(sceneCache,(canvas.width-dw)/2+move,(canvas.height-dh)/2,dw,dh);
    }
    progress.style.width=(running?(elapsed/SCENES[index].seconds)*100:0).toFixed(1)+'%';
    raf=requestAnimationFrame(render);
  }
  function setScene(n) {
    index=Math.min(SCENES.length-1,Math.max(0,n));elapsed=0;
    const scene=SCENES[index];
    code.textContent=scene.code;chapter.textContent=scene.chapter;
    title.textContent=scene.title;line.textContent=scene.line;second.textContent=scene.second;
    counter.textContent=String(index+1).padStart(2,'0')+' / '+String(SCENES.length).padStart(2,'0');
    nextButton.textContent=index===SCENES.length-1?'ENTER THE SCROLL':'NEXT FRAME';
    overlay.classList.remove('intro-reveal');
    void overlay.offsetWidth;
    overlay.classList.add('intro-reveal');
    const dots=$('introFrames').children;
    for(let i=0;i<dots.length;i++){
      dots[i].classList.toggle('active',i===index);
      dots[i].classList.toggle('visited',i<index);
      dots[i].setAttribute('aria-current',i===index?'step':'false');
    }
    sceneCache=null;
    if(soundOn && running) cue(index);
  }
  function cue(n) {
    if (!audio) return;
    const at=audio.ctx.currentTime, freq=[110,146.8,98,73.4,196,123.5,220][n];
    const osc=audio.ctx.createOscillator(),gain=audio.ctx.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(freq,at);
    osc.frequency.exponentialRampToValueAtTime(freq*.78,at+.75);
    gain.gain.setValueAtTime(.0001,at);
    gain.gain.exponentialRampToValueAtTime(.06,at+.04);
    gain.gain.exponentialRampToValueAtTime(.0001,at+1.4);
    osc.connect(gain);gain.connect(audio.master);osc.start(at);osc.stop(at+1.5);
  }
  function toggleSound() {
    if (!soundOn) {
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC){soundButton.textContent='SOUND UNAVAILABLE';return;}
      try{
        if(!audio){
          const ac=new AC(),master=ac.createGain();
          master.gain.value=.19;master.connect(ac.destination);
          audio={ctx:ac,master};
        }
        audio.ctx.resume().catch(()=>{});
        soundOn=true;cue(index);
      }catch(_){soundOn=false;}
    }else{
      soundOn=false;
      if(audio)audio.ctx.suspend().catch(()=>{});
    }
    soundButton.textContent=soundOn?'SOUND ON':'SOUND OFF';
    soundButton.setAttribute('aria-pressed',String(soundOn));
  }
  function play(force=false) {
    if(!force&&hasSeen())return false;
    if(visible)return true;
    visible=true;running=false;elapsed=0;
    G.mode='intro';UI.show('intro');
    setScene(0);
    $('introStart').classList.remove('hidden');
    stage.setAttribute('aria-hidden','false');
    cancelAnimationFrame(raf);raf=requestAnimationFrame(render);
    return true;
  }
  function start() {
    $('introStart').classList.add('hidden');
    running=true;lastTime=performance.now();
    if(soundOn)cue(index);
  }
  function next() {
    if(!visible)return;
    if(!running){start();return;}
    if(index+1>=SCENES.length){finish();return;}
    setScene(index+1);
  }
  function finish() {
    if(!visible)return;
    markSeen();visible=false;running=false;cancelAnimationFrame(raf);
    stage.setAttribute('aria-hidden','true');
    if(audio)audio.ctx.suspend().catch(()=>{});
    UI.show('title');G.mode='title';
  }
  function openArchive() {
    markSeen();
    const total=CAMPAIGN.totalCompleted();
    const items=ARCHIVE.map((entry,i)=>{
      const unlocked=total>=entry.unlock;
      return '<article class="archive-entry'+(unlocked?'':' sealed')+'"><span class="archive-index">'+
        String(i+1).padStart(2,'0')+'</span><div><h3>'+entry.title+'</h3><p>'+
        (unlocked?entry.text:'THIS SCROLL IS STILL SEALED. COMPLETE '+entry.unlock+' LEVELS TO UNROLL IT.')+
        '</p></div></article>';
    }).join('');
    $('archiveChapters').innerHTML=items;
    G.mode='chronicle';UI.show('chronicle');
  }
  function closeArchive(){G.mode='title';UI.show('title');}
  function handleKey(key) {
    if(G.mode==='intro'){
      if(key==='Escape'){finish();return true;}
      if(key==='Enter'||key==='Space'||key==='ArrowRight'){next();return true;}
      return false;
    }
    if(G.mode==='chronicle'&&(key==='Escape'||key==='Backspace')){closeArchive();return true;}
    return false;
  }
  $('introStartBtn').addEventListener('click',start);
  $('introSkip').addEventListener('click',finish);
  $('introNext').addEventListener('click',next);
  soundButton.addEventListener('click',toggleSound);
  $('replayIntroBtn').addEventListener('click',()=>play(true));
  $('chronicleBtn').addEventListener('click',openArchive);
  $('archiveBack').addEventListener('click',closeArchive);
  window.addEventListener('resize',()=>{sceneCache=null;});
  window.addEventListener('pagehide',()=>{if(audio)audio.ctx.suspend().catch(()=>{});});
  const frames=$('introFrames');
  SCENES.forEach((scene,i)=>{
    const b=document.createElement('button');b.className='intro-frame';
    b.type='button';b.setAttribute('aria-label','Chapter '+(i+1)+': '+scene.title);
    b.addEventListener('click',()=>{if(!running)start();setScene(i);});
    frames.appendChild(b);
  });
  return {play,finish,next,openArchive,handleKey,SCENES,ARCHIVE};
})();
