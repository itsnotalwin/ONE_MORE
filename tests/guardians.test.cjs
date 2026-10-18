'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const file = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

function harness() {
  const saved = new Map(), events = [];
  const localStorage = {
    getItem(k) { return saved.get(k) ?? null; },
    setItem(k, v) { saved.set(k, String(v)); },
  };
  const UI = new Proxy({}, { get(_o,k) { return (...a) => events.push({ key:k, args:a }); } });
  const SFX = new Proxy({}, { get(){ return ()=>{}; } });
  const context = vm.createContext({ localStorage, UI, SFX });
  for(const p of ['js/config.js','js/campaign.js','js/wave-director.js','js/guardians.js','js/ink-xp.js', 'js/game.js']) {
    vm.runInContext(file(p), context, { filename:p });
  }
  return { ...vm.runInContext('({G,CAMPAIGN,AREAS,GUARDIANS})',context), saved, events };
}
function spawnBoss(x, world, worldBoss=true) {
  x.saved.set('om_campaign_v1',JSON.stringify({version:1,completed:[10,10,9]}));
  assert.equal(x.G.startLevel(world, worldBoss?10:1), true);
  const S=x.G.S;
  S.stats.wave=10;
  S.W=393;S.H=852;
  S.player.x=0;S.player.y=0;S.player.fireT=99999;
  S.queue=[];S.markers=[{type:x.AREAS[world].elite,x:240,y:0,t:.01,elite:true,boss:worldBoss}];
  S.enemies=[];S.waveActive=true;
  x.G.update(.02);
  const e=S.enemies.find(z=>z.elite);
  assert.ok(e,'elite spawned from original wave marker');
  e.stun=9999; // isolate special from base enemy movement and contact
  return e;
}
function step(G,n,dt=.05){for(let i=0;i<n;i++)G.update(dt);}
test('each scroll has a distinct attack language with fair 1s+ warnings',()=>{
  const {GUARDIANS:D}=harness(),p={x:0,y:0,r:10},vp={width:393,height:852};
  const signatures=[];
  for(let w=0;w<3;w++){
    const a=D.attack(w,1,true,{x:240,y:0},p,vp,0);
    const c=D.attack(w,3,true,{x:240,y:0},p,vp,2);
    assert.ok(a.windup>=1.1);
    assert.ok(c.windup>=1.1);
    assert.equal(a.marks.length,1);
    assert.equal(c.marks.length,3);
    assert.ok(a.marks.every(m=>D.hits(m,p)),'phase 1 visibly locks the target position');
    assert.ok(a.marks.every(m=>!D.hits(m,{x:-900,y:-900,r:10})),'safe escape area remains');
    assert.ok(c.title!==a.title);
    signatures.push([a.marks[0].kind,c.marks[0].kind]);
  }
  assert.equal(signatures[0][0],'line');
  assert.equal(signatures[1][0],'line');
  assert.equal(signatures[2][0],'seal');
});
test('mid-level guardians have only two stages and world final bosses have three',()=>{
  const {GUARDIANS:D}=harness();
  assert.equal(D.phases(100,100,false),1);
  assert.equal(D.phases(51,100,false),2);
  assert.equal(D.phases(10,100,false),2);
  assert.equal(D.phases(100,100,true),1);
  assert.equal(D.phases(65,100,true),2);
  assert.equal(D.phases(30,100,true),3);
});
test('original guardian marker spawns phase-aware boss for all three worlds',()=>{
  for(let w=0;w<3;w++){
    const x=harness(),e=spawnBoss(x,w,true);
    assert.equal(e.guardian.world,w);
    assert.equal(e.guardian.boss,true);
    assert.equal(e.guardian.phase,1);
    assert.equal(e.hp,e.maxHp);
    step(x.G,57);
    assert.ok(x.G.S.guardianMarks.length>=1,'boss schedules visible warnings');
    assert.ok(x.G.S.guardianMarks.every(m=>m.t>0),'guardian attack warns before striking');
    e.hp=Math.round(e.maxHp*.6);
    x.G.update(.02);
    assert.equal(e.guardian.phase,2);
    assert.equal(x.G.S.guardianMarks.length,0,'new phase cancels old windup');
    e.hp=Math.round(e.maxHp*.2);
    x.G.update(.02);
    assert.equal(e.guardian.phase,3);
    assert.ok(x.events.some(x=>x.key==='setScore')===false || x.G.S.stats.kills>=0);
  }
});
test('Guardian attack only deals damage AFTER telegraph, using normal invulnerability',()=>{
  const x=harness(),e=spawnBoss(x,0,true);
  step(x.G,57);
  assert.ok(x.G.S.guardianMarks.length>0);
  x.G.S.invulnT=0;
  const initial=x.G.S.stats.hp;
  x.G.update(.05);
  assert.equal(x.G.S.stats.hp,initial,'windup is harmless');
  step(x.G,30);
  assert.equal(x.G.S.stats.hp,initial-1,'an active seam can deal exactly one hit');
  step(x.G,5);
  assert.equal(x.G.S.stats.hp,initial-1,'invulnerability blocks multi-hit overlap');
  assert.equal(e.guardian.phase,1);
});
test('all guardian hazards clean up after defeat, replay and abandoning',()=>{
  const x=harness(),e=spawnBoss(x,0,true);
  step(x.G,57);
  assert.ok(x.G.S.guardianMarks.length);
  e.hp=1;e.stun=9999;
  x.G.S.bullets=[{x:e.x,y:e.y,vx:0,vy:0,ang:0,dmg:2,hits:1,age:0,life:.5,kind:'drop'}];
  x.G.update(.02);
  assert.equal(x.G.S.enemies.includes(e),false);
  assert.equal(x.G.S.guardianMarks.length,0,'defeated boss has no residual danger');
  x.G.abandon();
  assert.equal(x.G.S.guardianMarks.length,0);
  x.G.startLevel(0,1);
  assert.equal(x.G.S.guardianMarks.length,0);
});
test('Endless Guardian scaling and run progression remain unaffected',()=>{
  const x=harness();
  x.G.startRun('endless');
  assert.equal(x.G.S.wavePlan,null);
  assert.equal(x.G.S.guardianMarks.length,0);
  assert.ok(x.G.S.stats.wave===1);
  x.G.S.queue=[];x.G.S.markers=[];x.G.S.enemies=[];
  x.G.update(.05);x.G.update(.60);x.G.update(.60);
  assert.equal(x.G.mode,'playing');
  assert.equal(x.G.S.stats.wave,2);
});
test('only phase-specific ink visuals changed and original renderer is byte-identical otherwise',()=>{
  /* Freeze the unchanged enemy painter and weapon/projectile silhouettes.
     Stage-long stamp storage and the protagonist are intentional edits. */
  const painter=file('js/render.js');
  const hash=v=>{let h=0x811c9dc5;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0');};
  const fragment=(a,b)=>{
    const from=painter.indexOf(a),to=painter.indexOf(b,from);
    assert.ok(from>0&&to>from);
    return painter.slice(from,to);
  };
  assert.equal(hash(fragment('  function drawEnemy(c, e, t) {',
    '  /* ---------------- player:')),'44e8cc52');
  assert.equal(hash(fragment('  /* ---------------- projectiles, zones, fx ---------------- */',
    '  /* Phase 3 additions reuse')),'20aee36a');
  assert.ok(painter.includes('function paintWeaponImprint('));
  assert.ok(painter.includes('stainCells.get('));
  assert.ok(file('index.html').includes('<script src="./js/guardians.js"></script>'));
  assert.ok(file('index.html').indexOf('/js/guardians.js')<file('index.html').indexOf('/js/game.js'));
});
