'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const file = p => fs.readFileSync(path.join(root,p),'utf8');
function harness(reduced=false) {
  const nodes=new Map(), frames=[],calls=[];
  let savedProgress=0,lastScreen=null;
  const gradient=()=>({addColorStop(){}});
  const c=new Proxy({}, {
    get(target,key) {
      if (key in target) return target[key];
      if (key==='createRadialGradient'||key==='createLinearGradient')return gradient;
      if (key==='measureText')return text=>({width:text.length*65});
      return (...args)=>{calls.push({method:key,args});};
    },
    set(target,key,value){target[key]=value;return true;}
  });
  const node=id=>({
    id,width:0,height:0,children:[],textContent:'',innerHTML:'',style:{},attrs:{},listeners:{},
    classList:{add(){},remove(){},toggle(){}},
    getBoundingClientRect(){return {width:800,height:580};},
    getContext(){return c;},
    setAttribute(name,value){this.attrs[name]=value;},
    addEventListener(name,fn){this.listeners[name]=fn;},
    click(){this.listeners.click?.();},
  });
  const document={
    hidden:false,
    getElementById(id){if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id);},
    createElement(tag){return node(tag);}
  };
  const G={mode:'title'};
  const UI={show(name){lastScreen=name;}};
  const CAMPAIGN={totalCompleted(){return savedProgress;}};
  const window={devicePixelRatio:1,matchMedia(){return {matches:reduced};},addEventListener(){}};
  const context=vm.createContext({
    document,window,G,UI,CAMPAIGN,
    performance:{now(){return 0;}},
    requestAnimationFrame(fn){frames.push(fn);return frames.length;},
    cancelAnimationFrame(){},
  });
  for(const p of ['js/film.js','js/intro.js'])vm.runInContext(file(p),context,{filename:p});
  return {
    INTRO:vm.runInContext('INTRO',context),
    FILM:vm.runInContext('FILM',context),
    G,nodes,frames,c,calls,
    get lastScreen(){return lastScreen;},
    set savedProgress(n){savedProgress=n;},
    get savedProgress(){return savedProgress;}
  };
}
test('every page launch starts a skippable automatic short film, not a click-through slideshow',()=>{
  const x=harness(),{INTRO,G,nodes,frames}=x;
  assert.equal(INTRO.SCENES.length,7);
  assert.equal(INTRO.SCENES.reduce((a,b)=>a+b.seconds,0),61);
  assert.ok(INTRO.SCENES.every(s=>s.title&&s.line&&s.second));
  assert.ok(INTRO.play());
  assert.equal(G.mode,'intro');
  assert.equal(nodes.get('introTitle').textContent,'BEFORE THE FIRST MARK');
  const firstFrame=frames.shift();
  assert.doesNotThrow(()=>firstFrame(1200));
  assert.ok(x.calls.length>100,'film actually draws procedurally, not just text');
  assert.equal(INTRO.handleKey('ArrowRight'),true);
  assert.equal(nodes.get('introTitle').textContent,'A WORLD IN ONE BREATH');
  assert.equal(INTRO.handleKey('Escape'),true);
  assert.equal(G.mode,'title');
  assert.ok(INTRO.play(),'visiting again starts the film, without a seen flag');
  nodes.get('introSkip').click();
  assert.equal(G.mode,'title');
  assert.ok(INTRO.play(),'replay also works immediately after skip');
});
test('all seven scenes animate the subject, camera/world, paint and final title',()=>{
  const x=harness(),{FILM,c,calls}=x;
  for(let i=0;i<7;i++){
    calls.length=0;
    assert.doesNotThrow(()=>FILM.scene(c,800,580,i,1.1,[8,8,8,9,9,10,9][i],false));
    const early=JSON.stringify(calls.filter(v=>v.method==='lineTo'||v.method==='arc'||v.method==='rect'||v.method==='fillText').slice(-100));
    calls.length=0;
    assert.doesNotThrow(()=>FILM.scene(c,800,580,i,6.5,[8,8,8,9,9,10,9][i],false));
    const late=JSON.stringify(calls.filter(v=>v.method==='lineTo'||v.method==='arc'||v.method==='rect'||v.method==='fillText').slice(-100));
    assert.notEqual(early,late,'scene '+i+' contains actual motion, not frozen art');
  }
  assert.ok(file('js/film.js').includes('function erasure('));
  assert.ok(file('js/film.js').includes('function survivor('));
  assert.ok(file('js/film.js').includes('function finale('));
  assert.ok(file('js/film.js').includes('function shadows('));
});
test('final reel ends at game title; reduced-motion mode still advances the film',()=>{
  const x=harness(true),{INTRO,G,frames}=x;
  x.savedProgress=20;
  INTRO.play();
  const cb=frames.shift();assert.doesNotThrow(()=>cb(2000));
  for(let i=0;i<7;i++)INTRO.next();
  assert.equal(G.mode,'title');
  assert.equal(x.lastScreen,'title');
  assert.equal(x.savedProgress,20);
});
test('story archive remains unlock-gated and original game assets are untouched',()=>{
  const x=harness(),{INTRO,G,nodes}=x;
  x.savedProgress=0;INTRO.openArchive();
  assert.ok(nodes.get('archiveChapters').innerHTML.includes('STILL SEALED'));
  x.savedProgress=20;INTRO.openArchive();
  assert.ok(nodes.get('archiveChapters').innerHTML.includes('Kage and Shade'));
  x.savedProgress=30;INTRO.openArchive();
  assert.ok(nodes.get('archiveChapters').innerHTML.includes('At the final seal,'));
  assert.ok(INTRO.handleKey('Escape'));
  assert.equal(G.mode,'title');
  const html=file('index.html'),js=file('js/intro.js'),main=file('js/main.js');
  assert.ok(html.includes('<script src="./js/film.js"></script>'));
  assert.ok(html.indexOf('film.js')<html.indexOf('intro.js'));
  assert.ok(!html.includes('id="introFrames"'));
  assert.ok(!html.includes('id="introStartBtn"'));
  assert.ok(main.includes('INTRO.play()'),'game entry auto-plays film');
  assert.ok(!js.includes('sessionStorage'),'no once-per-visit shortcuts');
  assert.ok(!/\.mp4|\.webm/.test(html+js),'no external video needed');
  assert.ok(file('js/render.js').includes('function drawEnemy('));
  assert.ok(file('docs/GAME_BIBLE.md').includes('Sprite sheet inventory: **NONE**'));
});
