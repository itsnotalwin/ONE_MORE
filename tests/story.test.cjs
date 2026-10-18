'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const file = p => fs.readFileSync(path.join(root,p),'utf8');

function storyHarness() {
  const nodes = new Map(), session = new Map(), renderFrames = [];
  let savedProgress = 0, lastScreen = null;
  const fakeContext = new Proxy({}, {
    get(target,key) {
      if(key === 'createRadialGradient'||key === 'createLinearGradient') return () => ({addColorStop(){}});
      if(key === 'canvas') return {};
      if(key in target) return target[key];
      return () => {};
    },
    set(target,key,value) {target[key]=value;return true;},
  });
  const mkNode = id => ({
    id,
    children:[],
    className:'',
    textContent:'',
    innerHTML:'',
    width: 0,height:0, style:{},
    attrs:{},listeners:{},
    classList: { add(){}, remove(){}, toggle(){} },
    appendChild(child){this.children.push(child);return child;},
    setAttribute(key,value){this.attrs[key]=value;},
    getBoundingClientRect(){return {width:920,height:620};},
    getContext(){return fakeContext;},
    addEventListener(name,fn){this.listeners[name]=fn;},
    click(){this.listeners.click?.();},
  });
  const document = {
    hidden: false,
    getElementById(id) {
      if(!nodes.has(id))nodes.set(id,mkNode(id));
      return nodes.get(id);
    },
    createElement(tag) { return mkNode(tag); },
  };
  const sessionStorage = {
    getItem(k){return session.get(k)||null;},
    setItem(k,v){session.set(k,String(v));},
  };
  const G = {mode:'title'};
  const UI = {show(screen){lastScreen=screen;}};
  const CAMPAIGN = {totalCompleted(){return savedProgress;}};
  const window = {
    devicePixelRatio:1,
    matchMedia(){return {matches:false};},
    addEventListener(){},
  };
  const context=vm.createContext({
    document,window,sessionStorage,G,UI,CAMPAIGN,Math,
    performance:{now(){return 0;}},
    requestAnimationFrame(fn){renderFrames.push(fn);return renderFrames.length;},
    cancelAnimationFrame(){},
  });
  vm.runInContext(file('js/intro.js'),context,{filename:'js/intro.js'});
  return {
    INTRO:vm.runInContext('INTRO',context),G,nodes,renderFrames,
    get lastScreen(){return lastScreen;},
    set savedProgress(value){savedProgress=value;},
    get savedProgress(){return savedProgress;},
  };
}

test('the experimental cinematic has seven authored, captioned and skippable scenes',()=>{
  const {INTRO,G,nodes,renderFrames,lastScreen}=storyHarness();
  assert.equal(INTRO.SCENES.length,7);
  assert.equal(INTRO.SCENES.reduce((sum,s)=>sum+s.seconds,0),61);
  assert.ok(INTRO.SCENES.every(scene=>scene.title&&scene.line&&scene.second));
  assert.ok(INTRO.play());
  assert.equal(G.mode,'intro');
  assert.equal(nodes.get('introFrames').children.length,7);
  assert.equal(nodes.get('introTitle').textContent,'BEFORE THE FIRST MARK');
  nodes.get('introStartBtn').click();
  // Render a real timeline step through a mocked Canvas 2D surface.
  const paint = renderFrames.shift();
  assert.doesNotThrow(()=>paint(1000));
  INTRO.next();
  assert.equal(nodes.get('introTitle').textContent,'A WORLD IN ONE BREATH');
  assert.ok(INTRO.handleKey('ArrowRight'));
  assert.equal(nodes.get('introTitle').textContent,'EVERY MARK CAST A SHADOW');
  assert.equal(INTRO.handleKey('Escape'),true);
  assert.equal(G.mode,'title');
  assert.equal(INTRO.play(),false,'do not force repeat in same session');
  assert.ok(INTRO.play(true),'replay button allows replay at will');
  nodes.get('introCoverSkip').click();
  assert.equal(G.mode,'title','cover skip works immediately');
});

test('ending all seven frames returns to title without changing campaign state',()=>{
  const x=storyHarness(), {INTRO,G}=x;
  x.savedProgress=10;
  INTRO.play();
  x.nodes.get('introStartBtn').click();
  for(let i=0;i<7;i++)INTRO.next();
  assert.equal(G.mode,'title');
  assert.equal(x.lastScreen,'title');
  assert.equal(x.savedProgress,10);
});

test('Chronicle locks act spoilers until existing campaign milestones',()=>{
  const x=storyHarness(), {INTRO,G,nodes}=x;
  x.savedProgress=0;INTRO.openArchive();
  let text=nodes.get('archiveChapters').innerHTML;
  assert.ok(text.includes('SCROLL I'));
  assert.ok(text.includes('STILL SEALED'));
  assert.ok(!text.includes('Kage and Shade'));
  x.savedProgress=20;INTRO.openArchive();
  text=nodes.get('archiveChapters').innerHTML;
  assert.ok(text.includes('Kage and Shade'));
  assert.ok(!text.includes('At the final seal,'));
  x.savedProgress=30;INTRO.openArchive();
  text=nodes.get('archiveChapters').innerHTML;
  assert.ok(text.includes('At the final seal,'));
  assert.ok(INTRO.handleKey('Escape'));
  assert.equal(G.mode,'title');
});

test('experimental additions do not modify existing combat code or require movie assets',()=>{
  const html=file('index.html'),css=file('css/intro.css'),js=file('js/intro.js');
  const original=file('js/render.js');
  assert.ok(html.includes('<script src="./js/intro.js"></script>'));
  assert.ok(html.includes('id="screenIntro"'));
  assert.ok(html.includes('id="screenChronicle"'));
  assert.ok(html.includes('id="introCoverSkip"'));
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.ok(js.includes('getBoundingClientRect'));
  assert.ok(js.includes('sessionStorage'));
  assert.ok(!/<video\b|\.mp4|\.webm/i.test(html+js),'no remote video or encoded movie requirement');
  assert.ok(original.includes('function drawEnemy('));
  assert.ok(file('docs/GAME_BIBLE.md').includes('Sprite sheet inventory: **NONE**'));
  assert.ok(file('README.md').includes('docs/images/last-stroke-hero.svg'));
});
