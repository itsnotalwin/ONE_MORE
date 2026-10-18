'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function harness(){
  const values=new Map(),events=[],paper={resets:0};
  const localStorage={getItem(k){return values.get(k)||null;},setItem(k,v){values.set(k,String(v));}};
  const UI=new Proxy({},{get(_o,k){return (...a)=>events.push([k,a]);}});
  const SFX=new Proxy({},{get(){return ()=>{};}});
  const R={resetStains(){paper.resets++;}};
  const ctx=vm.createContext({localStorage,UI,SFX,R});
  for(const f of ['js/config.js','js/campaign.js','js/wave-director.js','js/guardians.js','js/ink-xp.js','js/game.js'])
    vm.runInContext(file(f),ctx,{filename:f});
  const G=vm.runInContext('G',ctx);
  return {G,paper,events};
}
test('every authored offensive or defensive weapon has its own terrain impression',()=>{
  const source=file('js/game.js');
  for(const weapon of ['shot','echo','fan','orbit','nova','trail','spirit','knot','ward','shock']){
    assert.ok(source.includes("'"+weapon+"'"),'missing '+weapon+' mark vocabulary');
  }
  assert.ok(source.includes("kind: 'weapon', weapon"));
  assert.ok(source.includes("markWeapon('orbit', ox, oy"));
  assert.ok(source.includes("markWeapon('nova', S.player.x"));
  assert.ok(source.includes("markWeapon('trail', pd.x"));
  assert.ok(source.includes("markWeapon('spirit', x0"));
  assert.ok(source.includes("markWeapon('knot', e.x"));
  assert.ok(source.includes("markWeapon('ward', S.player.x"));
  assert.ok(source.includes("markWeapon('shock', S.player.x"));
});
test('weapon marks live through the full 10-wave level, not just the current wave',()=>{
  const {G,paper}=harness();
  assert.equal(G.startLevel(0,1),true);
  const resets=paper.resets;
  const q={kind:'weapon',weapon:'fan',x:23,y:45,r:7,alpha:.3};
  G.S.stainQueue.push(q);
  G.S.queue=[];G.S.enemies=[];G.S.markers=[];
  G.update(.05);G.update(.60);G.update(.60);
  assert.equal(G.S.stats.wave,2);
  assert.equal(G.S.stainQueue.some(q=>q.weapon==='fan'),true);
  assert.equal(paper.resets,resets,'wave transition never erases previous paint');
  G.S.enemies=[];G.S.markers=[];G.S.queue=[];
  G.S.stats.wave=10;G.S.waveActive=true;G.S.clearedT=0;
  G.update(.05);G.update(.60);G.update(.60);
  assert.equal(G.mode,'over');
  assert.equal(paper.resets,resets+1,'marks clear only after stage completion');
});
test('failed or abandoned stage resets paper before starting a new independent run',()=>{
  const {G,paper}=harness();
  G.startLevel(0,1);
  const a=paper.resets;
  G.S.stainQueue.push({kind:'weapon',weapon:'nova',x:0,y:0,r:19});
  G.abandon();
  assert.equal(paper.resets,a+1);
  assert.equal(G.S.stainQueue.length,0);
  G.startLevel(0,1);
  assert.equal(paper.resets,a+2);
  assert.equal(G.S.stainQueue.length,0);
});
test('endless retains stamps for 10 waves then unrolls a new sheet',()=>{
  const {G,paper}=harness();
  G.startRun('endless');
  const first=paper.resets;
  for(let n=1;n<=10;n++){
    G.S.stats.wave=n;
    G.S.queue=[];G.S.markers=[];G.S.enemies=[];
    G.S.waveActive=true;G.S.clearedT=0;
    G.update(.05);G.update(.60);G.update(.60);
    if(n<10)assert.equal(paper.resets,first);
  }
  assert.equal(G.S.stats.wave,11);
  assert.equal(paper.resets,first+1);
});
test('renderer caches black stains by world cell and never fades them mid-stage',()=>{
  const render=file('js/render.js');
  assert.ok(render.includes('const stainCells = new Map()'));
  assert.ok(render.includes('function paintWeaponImprint('));
  assert.ok(render.includes("const weapon = q.kind === 'weapon' ? q.weapon : ''"));
  assert.ok(render.includes('const list=stainCells.get('));
  assert.ok(!render.includes('while (stains.length > CFG.world.stainCap)'),
    'do not silently evict early stage blood or weapon marks');
  assert.ok(render.includes('Stage memory is intentionally permanent'));
  assert.ok(render.includes('function terrainStats()'));
  assert.ok(render.includes('stampCache.set(key,sprite)'),
    'cache variants instead of allocating one canvas per individual hit');
});
