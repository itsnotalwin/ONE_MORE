'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function make(completed=[0,0,0]){
  const stored=new Map([['om_campaign_v1',JSON.stringify({version:1,completed})]]);
  const localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,String(v))};
  const events=[];
  const UI=new Proxy({},{get(_o,k){return (...a)=>events.push({key:k,args:a});}});
  const SFX=new Proxy({},{get(){return ()=>{};}});
  const R={resetStains(){},eraseTerrain(){return 0;}};
  const context=vm.createContext({localStorage,UI,SFX,R});
  for(const p of ['js/config.js','js/campaign.js','js/wave-director.js',
    'js/guardians.js','js/ink-xp.js','js/game.js'])
    vm.runInContext(file(p),context,{filename:p});
  return {...vm.runInContext('({G,CAMPAIGN,STARTERS,CFG})',context),stored,events};
}
function enemy(x=100,y=0){
  return {type:'pulse',x,y,r:12,hp:90,maxHp:90,t:0,seed:.4,
    speed:0,state:'cruise',stateT:0,hitFlash:0,slowT:0,
    orbCd:0,kbx:0,kby:0,stun:0,ang:0,elite:false,dirT:0,spawnT:0};
}
function run(weapon,x=100,extras=[]){
  const o=make([10,10,9]);
  assert.ok(o.G.setStarter(weapon),'starter unlocked by campaign completion');
  assert.ok(o.G.startLevel(0,1));
  const S=o.G.S;S.queue=['pulse'];S.spawnTimer=9999;S.markers=[];
  S.player.fireT=0;
  S.enemies=[enemy(x),...extras.map(z=>enemy(z))];
  return {...o,S};
}
test('six instruments unlock at authored milestones and earlier levels remain replayable',()=>{
  const o=make([0,0,0]);
  assert.equal(o.STARTERS.length,6);
  assert.deepEqual(Array.from(o.STARTERS,w=>w.id),
    ['gun','brush','quill','mallet','thread','cutter']);
  assert.ok(o.G.starterUnlocked('gun'));
  for(const w of o.STARTERS.slice(1))assert.ok(!o.G.starterUnlocked(w.id));
  assert.equal(o.G.setStarter('cutter'),false);
  assert.equal(o.G.getStarter(),'gun');
  o.CAMPAIGN.complete(0,1);o.CAMPAIGN.complete(0,2);
  assert.ok(o.G.starterUnlocked('brush'));
  assert.ok(o.G.setStarter('brush'));
  assert.ok(o.G.startLevel(0,1));
  assert.equal(o.G.S.starter,'brush','new instrument can replay first stage');
  assert.equal(o.G.S.stats.shots,1,'rankup stats reset for each run');
  assert.equal(o.G.getStarter(),'brush','choice persisted independently');
});
test('first completion grants a starter announcement, but replay does not grant it twice',()=>{
  const o=make([1,0,0]),S=o.G.S;
  function finish(){
    S.queue=[];S.markers=[];S.enemies=[];
    S.waveActive=true;S.spawnTimer=9999;S.stats.wave=10;S.clearedT=0;
    o.G.update(.05);o.G.update(1.2);
    assert.equal(o.G.mode,'over');
    return o.events.filter(e=>e.key==='showOver').at(-1).args[0];
  }
  assert.ok(o.G.startLevel(0,2));
  const reward=finish();
  assert.equal(reward.newlyUnlocked.id,'brush');
  assert.ok(o.G.starterUnlocked('brush'));
  assert.ok(o.G.startLevel(0,2));
  const replay=finish();
  assert.equal(replay.newlyUnlocked,null);
});
test('late Night Scroll weapons can be carried into original First Wash',()=>{
  const o=run('cutter',85);
  assert.equal(o.S.worldIndex,0);
  assert.equal(o.S.starter,'cutter');
  assert.equal(o.G.getStarter(),'cutter');
  assert.equal(o.G.setStarter('needle_fake'),false);
  assert.equal(o.S.starter,'cutter','no changes to an active run');
});
test('default gun preserves basic bullet, muzzle and learned damage upgrades',()=>{
  const o=run('gun',300);
  o.S.stats.dmg=3;o.S.stats.shots=2;o.G.update(.05);
  assert.equal(o.S.starterCount,1);
  assert.equal(o.S.bullets.filter(b=>b.kind==='drop').length,2);
  assert.ok(o.S.bullets.every(b=>b.dmg===3));
  assert.ok(o.S.primaryFx.some(f=>f.kind==='gun'));
  for(let i=0;i<3;i++){o.S.player.fireT=0;o.G.update(.01);}
  assert.equal(o.S.starterCount,4);
  assert.ok(o.S.bullets.some(b=>b.kind==='drop'));
  assert.ok(!o.S.stainQueue.some(q=>q.kind==='weapon'),
    'even enhanced gun never stamps the map');
});
/* Shoot a stationary 4px-radius Blot through the real automatic fire
   and swept projectile collision path, without changing enemy AI or game
   balance. Compare all earned Twin Stroke ranks to the unupgraded gun. */
function twinStrokeTrial(distance,shots){
  const o=run('gun',distance),S=o.S,e=S.enemies[0];
  e.r=4;e.hp=100;e.maxHp=100;e.stun=100;
  S.stats.shots=shots;S.player.fireT=0;
  o.G.update(.001);
  const fired=S.bullets.filter(b=>b.kind==='drop');
  assert.equal(fired.length,shots,'each rank adds exactly one droplet');
  assert.ok(fired.some(b=>Math.abs(b.ang-S.player.aim)<1e-10),
    'one shot must remain aimed exactly at the enemy');
  for(const b of fired){
    assert.equal(b.dmg,1,'damage per droplet unchanged');
    assert.equal(b.life,o.CFG.player.bulletLife,'lifetime unchanged');
    assert.ok(Math.abs(Math.hypot(b.vx,b.vy)-o.CFG.player.bulletSpeed)<1e-8,
      'projectile speed unchanged');
    assert.ok(Math.abs(b.x-(S.player.x+o.CFG.player.muzzle+
      b.vx*.001))<1e-6,'all gun shots leave the original muzzle');
  }
  assert.equal(S.player.fireT,o.CFG.player.fireCd,
    'Twin Stroke cannot change the gun fire rate');
  S.player.fireT=9999;
  for(let i=0;i<25;i++){
    /* Remove only knockback drift so each angle can be tested against
       the same stationary small hitbox rather than combat displacement. */
    e.x=distance;e.y=0;e.kbx=0;e.kby=0;
    o.G.update(.04);
  }
  return {hits:100-e.hp,angles:fired.map(b=>b.ang)};
}
for(const [label,distance] of [
  ['close',55],['medium',240],['distant',480],
]){
  test('Twin Stroke '+label+' accuracy against a 4px enemy at '+distance+'px',()=>{
    assert.equal(twinStrokeTrial(distance,1).hits,1,'original aimed shot hits');
    for(const shots of [2,3,4]){
      const result=twinStrokeTrial(distance,shots);
      assert.equal(result.hits,shots,
        'rank '+(shots-1)+' additional droplets must not straddle the small target');
      assert.equal(result.angles.length,shots);
    }
  });
}
test('Twin Stroke keeps its close fan and narrows only when needed',()=>{
  const near=twinStrokeTrial(55,3),far=twinStrokeTrial(480,3);
  const width=angles=>Math.max(...angles)-Math.min(...angles);
  assert.ok(width(near)>.25,'close-up brush-fan identity remains visible');
  assert.ok(width(far)<.03,'long-range small-enemy shots converge');
});
test('Great Brush deals actual melee damage and earns wider third sweep',()=>{
  const o=run('brush',64);
  const first=o.S.enemies[0].hp;
  o.G.update(.05);
  assert.ok(o.S.enemies[0].hp<first);
  assert.ok(o.S.primaryFx.some(f=>f.kind==='brush'));
  for(let i=0;i<2;i++){o.S.player.fireT=0;o.G.update(.05);}
  assert.ok(o.S.primaryFx.some(f=>f.kind==='brush'&&f.special));
  assert.ok(!o.S.stainQueue.some(q=>q.kind==='weapon'));
});
test('Needle Quill fires piercing needles with a stronger fourth',()=>{
  const o=run('quill',290);
  o.G.update(.02);
  assert.ok(o.S.bullets.some(b=>b.kind==='needleQuill'&&b.hits===2));
  for(let i=0;i<3;i++){o.S.player.fireT=0;o.G.update(.02);}
  assert.ok(o.S.bullets.some(b=>b.kind==='needleQuill'&&b.hits>=4));
  assert.ok(o.S.primaryFx.some(f=>f.kind==='quill'&&f.special));
});
test('Inkstone Mallet knocks locally with a larger third impact',()=>{
  const o=run('mallet',82);
  o.G.update(.02);
  assert.ok(o.S.enemies[0].hp<90);
  for(let i=0;i<2;i++){o.S.player.fireT=0;o.G.update(.02);}
  assert.ok(o.S.primaryFx.some(f=>f.kind==='mallet'&&f.special&&f.reach>=80));
  assert.ok(!o.S.stainQueue.some(q=>q.kind==='weapon'));
});
test('Silk Spool chains, slows, and adds a third target on its special',()=>{
  const o=run('thread',125,[175,223]);
  o.G.update(.02);
  assert.ok(o.S.primaryFx.some(f=>f.kind==='thread'&&f.segments.length===2));
  assert.ok(o.S.enemies[0].slowT>0);
  for(let i=0;i<2;i++){o.S.player.fireT=0;o.G.update(.02);}
  assert.ok(o.S.primaryFx.some(f=>f.kind==='thread'&&f.special&&f.segments.length===3));
});
test('Paper Cutter slashes up close and throws a temporary returning folded edge',()=>{
  const o=run('cutter',65);
  o.G.update(.02);
  assert.ok(o.S.enemies[0].hp<90);
  for(let i=0;i<3;i++){o.S.player.fireT=0;o.G.update(.02);}
  assert.ok(o.S.bullets.some(b=>b.kind==='paperEdge'));
  assert.ok(o.S.primaryFx.some(f=>f.kind==='cutter'&&f.special));
  const edge=o.S.bullets.find(b=>b.kind==='paperEdge');
  edge.age=edge.life*.55;
  const oldX=edge.x;
  o.S.player.fireT=9999;o.G.update(.02);
  assert.ok(edge.x<oldX,'the paper edge turns back toward its wielder');
});
function attackAtRange(weapon,distance,prior=0,radius=12,speedMult=1){
  const o=run(weapon,distance),e=o.S.enemies[0];
  e.r=radius;
  o.S.starterCount=prior;
  o.S.stats.bulletSpeedMult=speedMult;
  o.G.update(.001);
  return {...o,e,fired:o.S.starterCount===prior+1};
}
test('normal melee swings fire only within actual hit geometry including enemy radius',()=>{
  for(const radius of [6,12,24]){
    const reaches=[
      ['brush',65+radius],
      ['mallet',34+55*.92+radius],
      ['cutter',62+radius],
    ];
    for(const [weapon,limit] of reaches){
      const inside=attackAtRange(weapon,limit-.2,0,radius);
      assert.ok(inside.fired,weapon+' must fire inside its hit boundary');
      assert.ok(inside.e.hp<90,weapon+' must damage inside its hit boundary');
      const outside=attackAtRange(weapon,limit+.2,0,radius);
      assert.equal(outside.fired,false,weapon+' must wait beyond its hit boundary');
      assert.equal(outside.S.starterCount,0,'out-of-reach target must not consume attack count');
      assert.equal(outside.S.primaryFx.length,0,'out-of-reach target must not animate an empty swing');
      assert.equal(outside.S.player.fireT,.08,'out-of-reach target uses short retry, not attack cooldown');
    }
  }
});
test('third Brush and Mallet swings respect expanded special impact geometry',()=>{
  for(const [weapon,limit] of [
    ['brush',82+12],['mallet',34+82*.92+12],
  ]){
    const inside=attackAtRange(weapon,limit-.2,2);
    assert.ok(inside.fired,weapon+' special must trigger at expanded reach');
    assert.ok(inside.e.hp<90,weapon+' special must actually deal damage');
    assert.ok(inside.S.primaryFx.some(f=>f.kind===weapon&&f.special));
    const outside=attackAtRange(weapon,limit+.2,2);
    assert.equal(outside.fired,false,weapon+' must not waste pending special');
    assert.equal(outside.S.starterCount,2,'special counter must be preserved');
  }
});
test('Paper Cutter waits for melee range, except when its fourth returning edge can hit',()=>{
  assert.equal(attackAtRange('cutter',150).fired,false,'normal cut cannot hit distant enemy');
  const special=attackAtRange('cutter',150,3);
  assert.ok(special.fired,'fourth cut may use actual outbound edge range');
  assert.ok(special.S.bullets.some(b=>b.kind==='paperEdge'));
  for(let i=0;i<10;i++)special.G.update(.045);
  assert.ok(special.e.hp<90,'returning edge can actually reach distant target');
  const limit=15+390*.8*.52+12+3;
  assert.equal(attackAtRange('cutter',limit-.2,3).fired,true);
  assert.equal(attackAtRange('cutter',limit+.2,3).fired,false);
  assert.equal(attackAtRange('cutter',215,3,12,1.4).fired,true,
    'projectile speed upgrade extends only actual special range');
  assert.equal(attackAtRange('cutter',215,0,12,1.4).fired,false,
    'speed upgrade never extends ordinary Cutter melee');
});
test('waiting for reachable melee enemies preserves the next special and weapon cadence',()=>{
  for(const [weapon,prior,far,near] of [
    ['brush',2,120,80],['mallet',2,160,95],['cutter',3,215,65],
  ]){
    const o=attackAtRange(weapon,far,prior),S=o.S;
    assert.equal(o.fired,false);
    o.e.x=near;
    S.player.fireT=0;
    o.G.update(.001);
    assert.equal(S.starterCount,prior+1,weapon+' special should fire once in range');
    assert.ok(S.primaryFx.some(f=>f.kind===weapon&&f.special));
    const instrument=o.STARTERS.find(w=>w.id===weapon);
    assert.ok(Math.abs(S.player.fireT-o.CFG.player.fireCd*instrument.delay)<1e-9,
      weapon+' attack cadence must remain unchanged');
  }
});
test('starter silhouettes are not terrain signatures; mastery, XP and night arts remain',()=>{
  const src=file('js/game.js'),renderer=file('js/render.js');
  assert.ok(src.includes('function fireStarter('));
  assert.ok(src.includes('function fireEchoVolley('));
  assert.ok(src.includes("return b.kind==='blade'?'fan'"));
  assert.ok(renderer.includes('function drawStarterTool('));
  assert.ok(renderer.includes('function drawPrimaryFx('));
  assert.ok(renderer.includes('function drawPrimaryProjectile('));
  assert.ok(renderer.includes("if((S.starter||'gun')==='gun')drawInkGun("));
  assert.ok(src.includes('const seals=shuffle(RED_SEALS.filter('));
  assert.ok(src.includes("st.levels[u.id]||0"));
});
test('armory is keyboard-accessible and has visible mobile responsive selection',()=>{
  const ui=file('js/ui.js'),html=file('index.html'),css=file('css/style.css');
  assert.ok(ui.includes('function renderStarters('));
  assert.ok(ui.includes('aria-pressed='));
  assert.ok(html.includes('id="starterGrid"'));
  assert.ok(html.indexOf('id="starterGrid"')<html.indexOf('id="campaignLevels"'));
  assert.ok(css.includes('.starter-card:focus-visible'));
  assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
  assert.ok(file('js/main.js').includes("G.setStarter(b.dataset.starter)"));
});
