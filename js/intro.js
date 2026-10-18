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
  const stage=$('screenIntro'), canvas=$('introCanvas'), ctx=canvas.getContext('2d');
  const overlay=$('introContent'), title=$('introTitle'), line=$('introLine'), second=$('introSecond');
  const code=$('introCode'), chapter=$('introChapter'), clock=$('introCount');
  const soundButton=$('introSound'), progress=$('introProgress');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LENGTH=SCENES.reduce((n,s)=>n+s.seconds,0);
  let index=0,elapsed=0,prior=null,dissolve=1,visible=false,lastTime=0;
  let raf=0,audio=null,soundOn=false,sceneW=1,sceneH=1;

  function selectScene(n){
    const prev=index;
    if(visible&&n!==prev)prior={index:prev,time:SCENES[prev].seconds,duration:SCENES[prev].seconds};
    index=Math.max(0,Math.min(SCENES.length-1,n));elapsed=0;dissolve=0;
    const s=SCENES[index];
    title.textContent=s.title;line.textContent=s.line;second.textContent=s.second;
    chapter.textContent=s.chapter;code.textContent=s.code;
    stage.classList.toggle('is-night',s.theme==='shadows');
    stage.classList.toggle('is-finale',index===SCENES.length-1);
    overlay.classList.remove('intro-text-in','intro-text-main','intro-text-end');
    /* For screen readers, the scene narration is one self-contained beat. */
  }
  function sizeCanvas(){
    const rect=canvas.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
    if(w===sceneW&&h===sceneH)return;
    sceneW=w;sceneH=h;
    const dpr=Math.min(1.5,window.devicePixelRatio||1);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  }
  function sceneProgress(){
    let t=elapsed;
    for(let i=0;i<index;i++)t+=SCENES[i].seconds;
    return Math.min(1,t/LENGTH);
  }
  function render(now){
    if(!visible)return;
    const dt=Math.max(0,Math.min(.08,(now-lastTime)/1000||0));
    lastTime=now;
    if(!document.hidden){
      elapsed+=dt;dissolve=Math.min(1,dissolve+dt/1.3);
      if(elapsed>=SCENES[index].seconds){
        if(index===SCENES.length-1){finish();return;}
        selectScene(index+1);
      }
    }
    sizeCanvas();
    ctx.save();
    ctx.setTransform(canvas.width/sceneW,0,0,canvas.height/sceneH,0,0);
    FILM.scene(ctx,sceneW,sceneH,index,elapsed,SCENES[index].seconds,reduced);
    if(prior&&dissolve<1&&!reduced){
      ctx.globalAlpha=Math.pow(1-dissolve,1.5);
      FILM.scene(ctx,sceneW,sceneH,prior.index,prior.time,prior.duration,reduced);
      ctx.globalAlpha=1;
    }
    ctx.restore();
    /* Let the film lead. Captions arrive after the picture begins moving. */
    overlay.classList.toggle('intro-text-in',elapsed>=1.1&&elapsed<SCENES[index].seconds-.65);
    overlay.classList.toggle('intro-text-main',elapsed>=2.25);
    overlay.classList.toggle('intro-text-end',elapsed>=3.45);
    const passed=sceneProgress()*LENGTH;
    const two=n=>String(Math.floor(n)).padStart(2,'0');
    clock.textContent=two(Math.floor(passed/60))+':'+two(passed%60)+' / '+two(Math.floor(LENGTH/60))+':'+two(LENGTH%60);
    progress.style.width=(100*sceneProgress()).toFixed(2)+'%';
    raf=requestAnimationFrame(render);
  }
  function cue(n){
    if(!audio||!soundOn)return;
    const now=audio.ctx.currentTime,notes=[110,146.8,98,73.4,196,123.5,220];
    const base=notes[n]||110;
    for(let i=0;i<3;i++){
      const oscillator=audio.ctx.createOscillator(),gain=audio.ctx.createGain();
      oscillator.type=i===1?'triangle':'sine';
      oscillator.frequency.setValueAtTime(base*(i===0?1:i===1?1.5:2),now);
      oscillator.frequency.exponentialRampToValueAtTime(base*(i===0?.75:i===1?1.2:1.65),now+1.75);
      gain.gain.setValueAtTime(.0001,now+i*.13);
      gain.gain.exponentialRampToValueAtTime(i===0?.043:.015,now+.16+i*.13);
      gain.gain.exponentialRampToValueAtTime(.0001,now+2.25+i*.15);
      oscillator.connect(gain);gain.connect(audio.master);
      oscillator.start(now+i*.13);oscillator.stop(now+2.8);
    }
  }
  function toggleSound(){
    if(soundOn){
      soundOn=false;
      if(audio)audio.ctx.suspend().catch(()=>{});
    }else{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC){soundButton.textContent='SOUND UNAVAILABLE';return;}
      try{
        if(!audio){
          const ctx=new AC(),master=ctx.createGain();
          master.gain.value=.21;master.connect(ctx.destination);
          audio={ctx,master};
        }
        audio.ctx.resume().then(()=>cue(index)).catch(()=>{});
        soundOn=true;
      }catch(_){soundOn=false;}
    }
    soundButton.textContent=soundOn?'SOUND ON':'SOUND OFF';
    soundButton.setAttribute('aria-pressed',String(soundOn));
  }
  function play(){
    if(visible)return true;
    visible=true;prior=null;
    G.mode='intro';UI.show('intro');
    selectScene(0);
    lastTime=performance.now();
    stage.setAttribute('aria-hidden','false');
    if(soundOn&&audio)audio.ctx.resume().catch(()=>{});
    cancelAnimationFrame(raf);raf=requestAnimationFrame(render);
    return true;
  }
  function finish(){
    if(!visible)return;
    visible=false;cancelAnimationFrame(raf);stage.setAttribute('aria-hidden','true');
    if(audio)audio.ctx.suspend().catch(()=>{});
    G.mode='title';UI.show('title');
  }
  function next(){
    if(!visible)return;
    if(index===SCENES.length-1)finish();else selectScene(index+1);
  }
  function openArchive(){
    const total=CAMPAIGN.totalCompleted();
    $('archiveChapters').innerHTML=ARCHIVE.map((entry,i)=>{
      const unlocked=total>=entry.unlock;
      return '<article class="archive-entry'+(unlocked?'':' sealed')+'"><span class="archive-index">'+
        String(i+1).padStart(2,'0')+'</span><div><h3>'+entry.title+'</h3><p>'+
        (unlocked?entry.text:'THIS SCROLL IS STILL SEALED. COMPLETE '+entry.unlock+' LEVELS TO UNROLL IT.')+
        '</p></div></article>';
    }).join('');
    G.mode='chronicle';UI.show('chronicle');
  }
  function closeArchive(){G.mode='title';UI.show('title');}
  function handleKey(k){
    if(G.mode==='intro'){
      if(k==='Escape'){finish();return true;}
      if(k==='Enter'||k==='Space'||k==='ArrowRight'){next();return true;}
      return false;
    }
    if(G.mode==='chronicle'&&(k==='Escape'||k==='Backspace')){closeArchive();return true;}
    return false;
  }
  $('introSkip').addEventListener('click',finish);
  soundButton.addEventListener('click',toggleSound);
  $('replayIntroBtn').addEventListener('click',play);
  $('chronicleBtn').addEventListener('click',openArchive);
  $('archiveBack').addEventListener('click',closeArchive);
  window.addEventListener('pagehide',()=>{if(audio)audio.ctx.suspend().catch(()=>{});});
  return {play,finish,next,openArchive,handleKey,SCENES,ARCHIVE};
})();
