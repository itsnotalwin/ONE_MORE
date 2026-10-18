'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function harness(){
  const values=new Map(),events=[],paper={resets:0};
  const localStorage={getItem(k){return values.get(k)||null;},setItem(k,v){values.set(k,String(v));}};
  const UI=new Proxy({},{get(_o,k){return (...a)=>events.push([k,a]);}});
  const SFX=new Proxy({},{get(){return ()=>{};}});
  const R={resetStains(){paper.resets++;},eraseTerrain(x,y,r){(paper.erases||(paper.erases=[])).push({x,y,r});return 0;}};
  const ctx=vm.createContext({localStorage,UI,SFX,R});
  for(const f of ['js/config.js','js/campaign.js','js/wave-director.js','js/guardians.js','js/ink-xp.js','js/game.js'])
    vm.runInContext(file(f),ctx,{filename:f});
  const G=vm.runInContext('G',ctx);
  return {G,paper,events};
}
test('every authored offensive or defensive weapon has its own terrain impression',()=>{
  const source=file('js/game.js');
  for(const weapon of ['shot','echo','fan','eraser','nova','trail','spirit','knot','ward','shock']){
    assert.ok(source.includes("'"+weapon+"'"),'missing '+weapon+' mark vocabulary');
  }
  assert.ok(source.includes("kind: 'weapon', weapon"));
  assert.ok(source.includes("markWeapon('eraser',cx+Math.cos(theta)"));
  assert.ok(source.includes("markWeapon('nova', S.player.x"));
  assert.ok(source.includes("markWeapon('trail', pd.x"));
  assert.ok(source.includes("markWeapon('spirit', x0"));
  assert.ok(source.includes("markWeapon('knot', e.x"));
  assert.ok(source.includes("markWeapon('ward', S.player.x"));
  assert.ok(source.includes("markWeapon('shock', S.player.x"));
});
test('Eraser is a far-reaching balanced damage field with expanding radius and real map cleanup',()=>{
  const {G,paper}=harness();
  G.startLevel(0,1);
  G.S.stats.orb=1;G.S.stats.levels.orbit=1;
  G.S.player.fireT=9999;
  G.S.queue=['pulse'];G.S.spawnTimer=9999;G.S.markers=[];
  G.update(.05);
  assert.equal(paper.erases.length,1,'the field actually requests terrain erasure');
  assert.equal(paper.erases[0].r,135,'initial field has a far larger range than old orbit');
  G.update(.1);
  assert.equal(paper.erases.length,1,'erasure is throttled for mobile');
  G.S.stats.orb=3;G.S.stats.levels.orbit=3;
  G.update(.20);
  assert.equal(paper.erases.at(-1).r,205,'upgrades expand the area substantially');
  assert.ok(G.S.stainQueue.some(m=>m.weapon==='eraser'&&m.red),
    'maxed Eraser makes a deep red boundary outside its own clearing field');
});
test('all enemy sprites retain their style, with at least five splatter compositions each',()=>{
  const render=file('js/render.js');
  const config=file('js/config.js');
  const families=vm.runInNewContext(config+'; Object.keys(ENEMIES)');
  for(const name of families){
    assert.ok(render.includes(name+':') || render.includes(name+':{'),
      'a distinctive black ink hand is assigned to '+name);
  }
  assert.ok(render.includes('function paintEnemyBlood('));
  assert.ok(render.includes('v/5')&&render.includes('v%3'));
  assert.ok(render.includes('BLOOD_HANDS[type]'));
  assert.ok(render.includes('bloodVariant'));
});
test('black weapon flights and maxed red techniques paint the paper without altering combat',()=>{
  const game=file('js/game.js'),render=file('js/render.js');
  assert.ok(game.includes('function paintFlight('));
  assert.ok(game.includes('if(travel>0)paintFlight('));
  assert.ok(game.includes("markWeapon('spirit',sp.x,sp.y"));
  assert.ok(game.includes('Math.max(.78,opts.alpha??.9)'));
  assert.ok(game.includes('function awakenedWeapon('));
  assert.ok(render.includes("const AWAKEN_RED = '#ac1538'"));
  assert.ok(render.includes('function eraseTerrain('));
  assert.ok(render.includes('if(removed.size)stains=stains.filter('));
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
