'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function boot(){
  const events=[],store=new Map();
  const localStorage={getItem(k){return store.get(k)||null;},
    setItem(k,v){store.set(k,String(v));}};
  const UI=new Proxy({},{get(_o,k){return (...args)=>events.push({k,args});}});
  const SFX=new Proxy({},{get(){return ()=>{};}});
  const R={resetStains(){},eraseTerrain(){return 0;}};
  const context=vm.createContext({localStorage,UI,SFX,R});
  for(const f of ['js/config.js','js/campaign.js','js/wave-director.js',
    'js/guardians.js','js/ink-xp.js','js/game.js'])
    vm.runInContext(read(f),context,{filename:f});
  return {...vm.runInContext('({G,GUARDIANS,CFG})',context),events};
}
function enem(x=110,y=0){
  return {type:'pulse',x,y,r:12,hp:18,maxHp:18,t:0,seed:.42,
    speed:0,state:'cruise',stateT:0,hitFlash:0,slowT:0,
    orbCd:0,kbx:0,kby:0,stun:0,ang:0,elite:false,dirT:0,spawnT:0};
}
function safeStage(G){
  G.startLevel(0,1);
  G.S.queue=['pulse'];G.S.spawnTimer=99999;
  G.S.markers=[];G.S.player.fireT=99999;
}
test('ink-soul cycles between true flowing running, anticipation and idle without changing hitbox',()=>{
  const {G}=boot();safeStage(G);
  const p=G.S.player,r=p.r;
  assert.equal(p.visualState,'idle');
  G.S.inputVec.x=1;
  G.update(.02);
  assert.equal(p.visualState,'anticipate');
  for(let i=0;i<8;i++)G.update(.03);
  assert.equal(p.visualState,'run');
  assert.ok(p.flowPhase>3,'a repeatable legless two-fold run cycle is advancing');
  assert.ok(p.visualSpeed>.7);
  G.S.inputVec.x=0;
  G.update(.03);
  assert.equal(p.visualState,'brake');
  for(let i=0;i<14;i++)G.update(.03);
  assert.equal(p.visualState,'idle');
  assert.equal(p.r,r,'animation never alters the physics circle');
  assert.ok(p.visualSpeed<.06);
});
test('hit and meaningful XP absorption trigger bounded independent ink-soul gestures',()=>{
  const {G}=boot();safeStage(G);
  const p=G.S.player;
  G.S.enemies.push(enem(0,0));
  G.update(.02);
  assert.ok(p.hitPulse>0,'damage compresses the spirit');
  G.S.enemies=[];G.S.invulnT=100;
  G.S.inkDrops.push({x:0,y:0,vx:0,vy:0,value:90,
    age:0,life:7,seed:2,r:4});
  const renderer=read('js/render.js');
  assert.ok(renderer.includes('p.absorbPulse'));
  assert.ok(renderer.includes('p.rankPulse'));
  assert.ok(renderer.includes('Math.sin(p.flowPhase||0)'));
});
test('First Wash has a flat ivory tile path and excludes ambient decor',()=>{
  const render=read('js/render.js'),start=render.indexOf('function buildTile(');
  const stop=render.indexOf('function ensureTiles(',start);
  const tile=render.slice(start,stop);
  assert.ok(tile.includes("if(key==='pale')"));
  assert.ok(tile.includes('for(let i=0;i<20;i++)'));
  assert.ok(tile.includes('for(let i=0;i<9;i++)'));
  assert.ok(tile.indexOf("if(key==='pale')")<tile.indexOf('/* laid lines'));
  assert.ok(tile.includes('return c;'));
  assert.ok(render.includes("if(themeKey!=='pale')drawDecor("));
  assert.ok(render.includes("themeKey==='pale' ? .025 : .17"));
});
test('divine Guardian uses the same tapered Bezier for collision and illustration',()=>{
  const {GUARDIANS:D}=boot(),viewport={width:393,height:852};
  const p={x:0,y:0,r:10};
  const one=D.attack(0,1,true,{x:220,y:0},p,viewport,0);
  assert.equal(one.marks[0].kind,'heavenlyStroke');
  assert.equal(one.marks[0].points.length,35);
  assert.ok(one.marks[0].points[0].width<one.marks[0].points[17].width);
  assert.ok(D.hits(one.marks[0],p));
  assert.ok(!D.hits(one.marks[0],{x:180,y:155,r:10}));
  const two=D.attack(0,2,true,{x:220,y:0},p,viewport,2);
  assert.equal(two.marks.length,2);
  assert.ok(two.marks[1].delay>0);
  const three=D.attack(0,3,true,{x:220,y:0},p,viewport,2);
  assert.equal(three.marks.length,3);
  assert.ok(three.marks.some(m=>m.style==='hook'));
  assert.equal(D.attack(1,1,true,{x:0,y:0},p,viewport).marks[0].kind,'line');
  assert.equal(D.attack(2,1,true,{x:0,y:0},p,viewport).marks[0].kind,'seal');
  const render=read('js/render.js');
  assert.ok(render.includes("mark.kind==='heavenlyStroke'"));
});
test('Suiteki makes one connected snail trail, not stationary circular puddles',()=>{
  const {G,CFG}=boot();safeStage(G);
  G.S.stats.trailW=1;G.S.stats.levels.trail=1;
  G.S.enemies.push(enem(250,80));
  G.S.inputVec.x=1;
  for(let i=0;i<9;i++)G.update(.05);
  assert.ok(G.S.puddles.length>=5,'wet trail accumulates behind sustained movement');
  assert.equal(G.S.puddles[0].r,5.5,'thin at first rank');
  for(let i=0;i<G.S.puddles.length;i++){
    const pd=G.S.puddles[i];
    assert.equal(pd.isSuiteki,true);
    assert.ok(pd.x>pd.x0,'segments follow movement rather than spawn a blob');
    if(i>0)assert.ok(Math.abs(pd.x0-G.S.puddles[i-1].x)<.001,
      'neighboring brush segments join seamlessly');
  }
  G.S.inputVec.x=0;
  for(const pd of G.S.puddles)pd.life=.01;
  G.update(.05);
  assert.equal(G.S.puddles.length,0);
  assert.ok(!G.S.stainQueue.some(q=>q.weapon==='trail'),
    'nonmastered wet ink dries without permanent terrain marks');
  G.S.stats.trailW=3;G.S.stats.levels.trail=3;
  G.S.inputVec.x=1;
  for(let i=0;i<7;i++)G.update(.05);
  assert.ok(G.S.puddles.length>2);
  assert.equal(G.S.puddles[0].r,8.5);
  G.S.inputVec.x=0;
  for(const pd of G.S.puddles)pd.life=.01;
  G.update(.05);
  assert.ok(G.S.stainQueue.some(q=>q.weapon==='trail'&&!q.red),
    'mastered snail trail leaves black connected marks');
  G.S.stats.levels.seal_trail=1;
  G.S.inputVec.x=1;
  for(let i=0;i<6;i++)G.update(.05);
  G.S.inputVec.x=0;
  for(const pd of G.S.puddles)pd.life=.01;
  G.update(.05);
  assert.ok(G.S.stainQueue.some(q=>q.weapon==='trail'&&q.red),
    'a selected post-max seal changes only the dried trail pigment');
  assert.equal(CFG.trail.gap(1),12);
  assert.equal(CFG.trail.maxPools(3),112);
  assert.equal(CFG.trail.tick,.55);
});
test('overlapping Suiteki spills share one global damage timer',()=>{
  const {G}=boot();safeStage(G);
  const e=enem(130,0);
  G.S.enemies.push(e);
  for(let i=0;i<2;i++)G.S.puddles.push({
    x0:122,y0:0,x:136,y:0,r:8.5,life:1,max:3,
    sequence:i,seed:i,isSuiteki:true});
  G.update(.05);
  assert.equal(e.hp,17);
  G.update(.05);
  assert.equal(e.hp,17,'overlap does not stack damage every frame');
  assert.ok((e.suitekiT||0)>0);
  assert.ok((e.suitekiNextT||0)>.5);
});
