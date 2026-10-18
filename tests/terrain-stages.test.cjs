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
  for(const weapon of ['echo','fan','eraser','nova','trail','spirit','knot','ward','shock']){
    assert.ok(source.includes("'"+weapon+"'"),'missing '+weapon+' mark vocabulary');
  }
  assert.ok(source.includes("kind:'weapon',weapon"));
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
    assert.ok(render.includes(name+':') || render.includes(name+' :'),
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
  assert.ok(game.includes("return b.kind==='blade'?'fan':b.kind==='echo'?'echo':null"),
    'only acquired Fan and Echo projectiles may paint a flight path');
  assert.ok(game.includes("markWeapon('spirit',sp.x,sp.y"));
  assert.ok(game.includes('Math.max(.78,opts.alpha??.9)'));
  assert.ok(game.includes('function awakenedWeapon('));
  assert.ok(render.includes("const AWAKEN_RED = '#ac1538'"));
  assert.ok(render.includes('function eraseTerrain('));
  assert.ok(render.includes('if(removed.size)stains=stains.filter('));
});
test('default weapon never paints terrain while moving, on hit, at expiry or after mastery',()=>{
  const {G}=harness();
  G.startLevel(0,1);
  G.S.queue=['pulse'];G.S.spawnTimer=99999;G.S.player.fireT=99999;
  G.S.stats.levels.heavy=4;
  G.S.stats.levels.rapid=5;
  G.S.stats.levels.pierce=3;
  G.S.stats.levels.split=3;
  G.S.stats.levels.velo=3;
  const baseBullet=(fields={})=>({
    x:-120,y:0,vx:560,vy:0,ang:0,dmg:1,hits:1,
    age:0,life:.9,kind:'drop',...fields
  });
  // A high-rank normal shot crossing empty paper has no terrain effect.
  G.S.bullets.push(baseBullet());
  G.update(.05);G.update(.05);
  assert.ok(!G.S.stainQueue.some(m=>m.kind==='weapon'&&m.weapon==='shot'));
  // An expiring base projectile still cannot stamp an end-of-life blot.
  G.S.bullets.push(baseBullet({life:.015}));
  G.update(.05);
  assert.ok(!G.S.stainQueue.some(m=>m.kind==='weapon'&&m.weapon==='shot'));
  // Damage can still generate enemy blood, but not a separate shot imprint.
  G.S.enemies.push({x:0,y:0,r:12,hp:15,maxHp:15,
    speed:0,type:'pulse',seed:.1,hitFlash:0,kbx:0,kby:0,
    state:'cruise',stateT:20,slowT:0,orbCd:0,spawnT:0,
    ang:0,dirT:0,elite:false});
  G.S.bullets.push(baseBullet({x:-28,vx:560}));
  G.update(.05);
  assert.ok(!G.S.stainQueue.some(m=>m.kind==='weapon'&&m.weapon==='shot'),
    'the starter auto-fire never inks the world directly');
});
test('acquired Echo and Fan shots still leave ordinary black and awakened red marks',()=>{
  const {G}=harness();
  G.startLevel(0,1);
  G.S.queue=['pulse'];G.S.spawnTimer=99999;G.S.player.fireT=99999;
  G.S.bullets.push({x:-120,y:0,vx:560,vy:0,ang:0,dmg:1,hits:1,
    age:0,life:.9,kind:'echo'});
  G.update(.05);G.update(.05);
  assert.ok(G.S.stainQueue.some(m=>m.weapon==='echo'&&!m.red),
    'the distinct Echo skill continues painting black');
  G.S.stats.levels.echo=2;
  G.S.bullets.push({x:-120,y:30,vx:560,vy:0,ang:0,dmg:1,hits:1,
    age:0,life:.9,kind:'echo'});
  G.update(.05);G.update(.05);
  assert.ok(G.S.stainQueue.some(m=>m.weapon==='echo'&&m.red),
    'mastered Echo becomes lacquer-crimson');
  G.S.stats.levels.fan=4;
  G.S.bullets.push({x:-120,y:60,vx:560,vy:0,ang:0,dmg:1,hits:1,
    age:0,life:.9,kind:'blade',spin:0});
  G.update(.05);G.update(.05);
  assert.ok(G.S.stainQueue.some(m=>m.weapon==='fan'&&m.red),
    'mastered Folded Fan still paints the paper');
});
test('mastered movement contributes a sparse red terrain seal without changing speed or hitbox',()=>{
  const {G}=harness();
  G.startLevel(0,1);
  G.S.queue=['pulse'];G.S.spawnTimer=99999;G.S.player.fireT=99999;
  G.S.stats.levels.over=4;
  const radius=G.S.player.r;
  G.S.inputVec.x=1;
  G.update(.05);
  assert.equal(G.S.player.r,radius);
  assert.ok(G.S.stainQueue.some(m=>m.weapon==='over'&&m.red));
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
  assert.ok(render.includes("const weapon=q.kind==='weapon'?q.weapon:''"));
  assert.ok(render.includes('const list=stainCells.get('));
  assert.ok(!render.includes('while (stains.length > CFG.world.stainCap)'),
    'do not silently evict early stage blood or weapon marks');
  assert.ok(render.includes('Stage memory is intentionally permanent'));
  assert.ok(render.includes('function terrainStats()'));
  assert.ok(render.includes('stampCache.set(key,sprite)'),
    'cache variants instead of allocating one canvas per individual hit');
});
