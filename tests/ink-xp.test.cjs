'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function setup(){
  const saved=new Map(),events=[];
  const localStorage={getItem(k){return saved.get(k)||null;},setItem(k,v){saved.set(k,String(v));}};
  const UI=new Proxy({}, {get(_o,k){return (...a)=>events.push([k,a]);}});
  const SFX=new Proxy({},{get(){return ()=>{};}});
  const context=vm.createContext({localStorage,UI,SFX});
  for(const file of ['js/config.js','js/campaign.js','js/wave-director.js','js/guardians.js','js/ink-xp.js','js/game.js'])
    vm.runInContext(src(file),context,{filename:file});
  const {INK_XP,G}=vm.runInContext('({ INK_XP,G })',context);
  return {INK_XP,G,events};
}
function addDrop(G,value,x=24,y=0){
  G.S.inkDrops.push({x,y,value,age:0,homing:false,vx:0,vy:0,pulse:0});
}
function tick(G,n=40){for(let i=0;i<n&&G.mode==='playing';i++)G.update(.05);}
test('enemy XP scales to later stages but remains positive and bounded',()=>{
  const {INK_XP}=setup(),def={cost:2,hp:3},e={elite:false},elite={elite:true,guardian:{boss:true}};
  const first=INK_XP.value(def,e,{wave:1,worldIndex:0,level:1});
  const late=INK_XP.value(def,e,{wave:9,worldIndex:2,level:8});
  assert.ok(first>=1);
  assert.ok(late>first&&late<first*3,'late game provides more living ink');
  assert.ok(INK_XP.value(def,elite,{wave:10,worldIndex:2,level:10})>late);
  assert.ok(INK_XP.needed(9)>INK_XP.needed(3) && INK_XP.needed(3)>INK_XP.needed(1));
});
test('earned XP levels up with remainder and never drops multiple rewards',()=>{
  const {INK_XP}=setup(),s={inkXp:0,inkRank:1,inkPending:0};
  const threshold=INK_XP.needed(1),later=INK_XP.needed(2);
  assert.equal(INK_XP.grant(s,threshold+later+6),2);
  assert.equal(s.inkRank,3);
  assert.equal(s.inkPending,2);
  assert.equal(s.inkXp,6);
});
test('splat cores pull toward the brush when near, and all fly home at wave-end',()=>{
  const {INK_XP}=setup(),drops=[],p={x:0,y:0,inkRank:1},absorbed=[];
  INK_XP.drop(drops,65,0,11,false,1);
  assert.equal(drops.length,1);
  for(let i=0;i<30;i++)INK_XP.update(drops,p,.05,false,v=>absorbed.push(v));
  assert.equal(drops.length,0);
  assert.equal(absorbed.reduce((a,b)=>a+b,0),11);
  INK_XP.drop(drops,850,0,34,true,2);
  assert.equal(drops.length,5);
  for(let i=0;i<25;i++)INK_XP.update(drops,p,.05,true,v=>absorbed.push(v));
  assert.equal(drops.length,0);
  assert.equal(absorbed.reduce((a,b)=>a+b,0),45);
});
test('XP upgrades interrupt the current fight and resume the SAME wave',()=>{
  const {G,INK_XP}=setup();G.startLevel(0,1);
  G.S.queue=['pulse'];G.S.spawnTimer=999;
  addDrop(G,INK_XP.needed(1));
  tick(G);
  assert.equal(G.mode,'upgrade');
  assert.equal(G.S.stats.inkRank,2);
  assert.equal(G.S.stats.inkPending,1);
  assert.equal(G.S.stats.wave,1);
  assert.equal(G.S.waveActive,true);
  G.pickAt(0);G.deploy();
  assert.equal(G.mode,'playing');
  assert.equal(G.S.stats.wave,1,'no wave skipped by upgrade choice');
  assert.equal(G.S.stats.inkPending,0);
});
test('multiple XP ranks queue choices one at a time, no reward loss',()=>{
  const {G,INK_XP}=setup();G.startLevel(0,1);
  G.S.queue=['pulse'];G.S.spawnTimer=999;
  addDrop(G,INK_XP.needed(1)+INK_XP.needed(2)+1);
  tick(G);
  assert.equal(G.mode,'upgrade');
  assert.equal(G.S.stats.inkRank,3);
  assert.equal(G.S.stats.inkPending,2);
  G.pickAt(0);G.deploy();
  assert.equal(G.mode,'upgrade');
  assert.equal(G.S.stats.inkPending,1);
  G.pickAt(0);G.deploy();
  assert.equal(G.mode,'playing');
  assert.equal(G.S.stats.inkPending,0);
});
test('all uncollected ink is retrieved before the next wave starts',()=>{
  const {G}=setup();G.startLevel(0,1);
  G.S.enemies=[];G.S.queue=[];G.S.markers=[];
  addDrop(G,11,1300,1200);
  tick(G,30);
  assert.equal(G.S.stats.wave,2);
  assert.equal(G.S.stats.inkCollected,11);
  assert.equal(G.S.inkDrops.length,0);
  assert.equal(G.mode,'playing');
});
test('new runs clear loot and rank; growth is visual only, not a larger hitbox',()=>{
  const {G,INK_XP}=setup();G.startLevel(0,1);
  const radius=G.S.player.r;
  G.S.stats.inkRank=12;G.S.stats.maxHp=7;
  assert.ok(INK_XP.visualScale(G.S.stats)>1.4);
  assert.ok(INK_XP.visualScale(G.S.stats)<=1.55);
  assert.equal(G.S.player.r,radius,'the actual collision hitbox is unchanged');
  addDrop(G,99);
  G.startLevel(0,1);
  assert.equal(G.S.stats.inkRank,1);
  assert.equal(G.S.stats.inkXp,0);
  assert.equal(G.S.inkDrops.length,0);
  assert.equal(INK_XP.visualScale(G.S.stats),1);
});
test('ink rank earned at wave clear does not stall the next wave',()=>{
  const {G,INK_XP}=setup();G.startLevel(0,1);
  G.S.enemies=[];G.S.queue=[];G.S.markers=[];
  addDrop(G,INK_XP.needed(1),1500,1800);
  tick(G,40);
  assert.equal(G.mode,'upgrade');
  assert.equal(G.S.clearedT<=0,true);
  G.pickAt(0);G.deploy();
  assert.equal(G.mode,'playing');
  assert.equal(G.S.stats.wave,2,'resume next wave after the last earned choice');
});
test('elite loot cap safely merges value instead of discarding XP',()=>{
  const {INK_XP}=setup(),drops=[];
  for(let i=0;i<500;i++)INK_XP.drop(drops,i,0,8,false,i);
  assert.ok(drops.length<=INK_XP.CFG_XP.maxDrops);
  assert.equal(drops.reduce((s,d)=>s+d.value,0),500*8);
});
test('mobile HUD and the original sumi-e renderer use the new XP independently',()=>{
  const html=src('index.html'),render=src('js/render.js'),css=src('css/ink-xp.css');
  assert.ok(html.includes('id="inkMeter"'));
  assert.ok(html.includes('id="inkRank"'));
  assert.ok(html.includes('<script src="./js/ink-xp.js"></script>'));
  assert.ok(html.indexOf('/js/ink-xp.js')<html.indexOf('/js/game.js'));
  assert.ok(render.includes('INK_XP.draw(ctx, S, t, INK, PAPER, RED)'));
  assert.ok(render.includes('INK_XP.visualScale(S.stats)'));
  assert.ok(css.includes('env(safe-area-inset-bottom)'));
  assert.ok(src('js/render.js').includes('function drawEnemy('));
});
