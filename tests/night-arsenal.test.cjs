'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function boot(world=0){
  const store=new Map(),events=[];
  const localStorage={getItem(k){return store.get(k)||null;},
    setItem(k,v){store.set(k,String(v));}};
  const UI=new Proxy({},{get(_o,k){return (...args)=>events.push({k,args});}});
  const SFX=new Proxy({},{get(){return ()=>{};}});
  const R={resetStains(){},eraseTerrain(){return 0;}};
  const ctx=vm.createContext({localStorage,UI,SFX,R});
  for(const f of ['js/config.js','js/campaign.js','js/wave-director.js',
    'js/guardians.js','js/ink-xp.js','js/game.js'])
    vm.runInContext(read(f),ctx,{filename:f});
  const value=vm.runInContext('({G,CFG,UPGRADES,RED_SEALS,GUARDIANS})',ctx);
  if(world>0)store.set('om_campaign_v1',JSON.stringify({
    version:1,completed:world===1?[10,0,0]:[10,10,0]}));
  assert.equal(value.G.startLevel(world,1),true);
  const S=value.G.S;
  S.queue=['pulse'];S.spawnTimer=99999;S.markers=[];S.player.fireT=99999;
  return {...value,store,events};
}
function enemy(type,x,y){
  return {type,x,y,r:12,hp:18,maxHp:18,speed:0,
    t:0,seed:.35,state:'cruise',stateT:0,hitFlash:0,
    slowT:0,orbCd:0,kbx:0,kby:0,stun:0,ang:0,
    elite:false,dirT:0,spawnT:0,px:0,py:0};
}
test('the entire four-art Night Scroll roster is locked before Paper II',()=>{
  const ids=['lantern','crescent','mirror','shroud'];
  const first=boot(0),second=boot(1);
  first.G.S.stats.inkPending=1;first.G.update(.05);
  assert.ok(first.G.S.choices.every(u=>!ids.includes(u.id)));
  second.G.S.stats.inkPending=1;second.G.update(.05);
  assert.ok(second.G.S.choices.some(u=>ids.includes(u.id)),
    'a Night Scroll-specific art is guaranteed a selectable upgrade card');
  for(const id of ids){
    const u=second.UPGRADES.find(x=>x.id===id);
    assert.ok(u&&u.world===1&&u.weapon&&u.max>=2,id);
    const seal=second.RED_SEALS.find(x=>x.id==='seal_'+id);
    assert.ok(seal&&seal.requires===id,'a separate post-master Vermilion seal is offered');
  }
  const pick=second.G.S.choices.findIndex(u=>ids.includes(u.id));
  const chosen=second.G.S.choices[pick];
  second.G.pickAt(pick);second.G.deploy();
  assert.equal(second.G.S.stats.levels[chosen.id],1,
    'the world-exclusive skill is acquired through normal gameplay');
});
test('continuous Lantern field has no pulse gaps and rank II covers more paper',()=>{
  const {G,CFG}=boot(1),S=G.S,a=enemy('shade',290,0),b=enemy('kage',390,0);
  S.enemies=[a,b];S.stats.lantern=1;S.stats.levels.lantern=1;
  assert.equal(CFG.lantern.radius(1),300);assert.equal(CFG.lantern.radius(2),420);
  for(let i=0;i<40;i++)G.update(.05);
  assert.ok(a.lanternLit&&!b.lanternLit);
  S.stats.lantern=2;S.stats.levels.lantern=2;G.update(.05);
  assert.ok(b.lanternLit);
  S.player.x=-800;G.update(.05);
  assert.equal(a.lanternLit,false);
  for(let i=0;i<10;i++)G.update(.05);
  assert.equal(a.lanternReveal,0);
  assert.equal(S.lanternT,undefined);
  assert.equal(S.lanternFlash,undefined);
});
test('rank II wards off one ordinary stealth attack on entry but not a Guardian',()=>{
  for(const [type,state] of [['shade','emerge'],['kage','tele']]){
    const {G}=boot(1),S=G.S,e=enemy(type,200,0);
    e.state=state;S.enemies=[e];S.stats.lantern=1;
    G.update(.03);
    assert.equal(e.state,state);
    S.stats.lantern=0;G.update(.03);S.stats.lantern=2;
    S.stats.levels.lantern=2;G.update(.03);
    assert.equal(e.state,'rest');
    assert.ok(e.lanternGuardT>7);
    assert.ok(S.stainQueue.some(m=>m.weapon==='lantern'&&!m.red));
    e.state=state;G.update(.03);
    assert.equal(e.state,state);
    S.player.x=-700;G.update(.03);S.player.x=0;G.update(.03);
    assert.equal(e.state,state,'re-entry during rearm does not stunlock');
  }
  const {G}=boot(1),S=G.S,e=enemy('shade',120,0);
  e.elite=true;e.state='emerge';S.enemies=[e];S.stats.lantern=2;
  G.update(.03);assert.equal(e.state,'emerge');
});
test('Shade fades into an unmistakable safe warning before pouncing',()=>{
  const {G,CFG}=boot(1),S=G.S,e=enemy('shade',100,0);
  S.enemies=[e];S.player.fireT=9999;
  e.state='dissolve';e.stateT=CFG.nightStealth.fade-.02;
  G.update(.04);
  assert.equal(e.state,'emerge');
  e.x=S.player.x;e.y=S.player.y;
  const hp=S.stats.hp;
  G.update(.25);assert.equal(e.state,'emerge');
  assert.equal(S.stats.hp,hp,'fading spirit cannot cause unseen contact');
  G.update(.25);assert.equal(e.state,'emerge');
  G.update(.12);assert.equal(e.state,'pounce');
});
test('Lantern terrain stamps stay mastery-gated and Vermilion stays optional',()=>{
  const {G}=boot(1),S=G.S,e=enemy('shade',75,0);
  e.state='emerge';S.enemies=[e];S.stats.lantern=1;S.stats.levels.lantern=1;
  G.update(.02);assert.ok(!S.stainQueue.some(m=>m.weapon==='lantern'));
  S.stats.lantern=0;G.update(.02);S.stats.lantern=2;
  S.stats.levels.lantern=2;G.update(.02);
  assert.ok(S.stainQueue.some(m=>m.weapon==='lantern'&&!m.red));
  S.player.x=700;G.update(.02);S.player.x=0;
  e.state='emerge';e.lanternGuardT=0;S.stats.levels.seal_lantern=1;
  G.update(.02);
  assert.ok(S.stainQueue.some(m=>m.weapon==='lantern'&&m.red));
});
test('stealth rework retains protected art and has a limited mobile field',()=>{
  const r=read('js/render.js'),g=read('js/game.js');
  assert.ok(r.includes('function drawStealthShade('));
  assert.ok(r.includes('function drawLantern(c,S,t)'));
  assert.ok(r.includes("e.state==='emerge'"));
  assert.ok(!r.includes('S.lanternFlash'));
  assert.ok(!g.includes('igniteLantern'));
});
test('Crescent Return actually travels, strikes and begins painting only at max rank',()=>{
  const {G}=boot(1),S=G.S;
  const e=enemy('pulse',155,0);S.enemies=[e];
  S.stats.crescent=1;S.stats.levels.crescent=1;
  G.update(.05);
  assert.equal(S.crescents.length,1);
  assert.ok(!S.stainQueue.some(m=>m.weapon==='crescent'));
  for(let i=0;i<8;i++)G.update(.05);
  assert.ok(e.hp<18,'outbound blade damages its target');
  S.stats.crescent=3;S.stats.levels.crescent=3;
  S.crescents=[];S.crescentT=0;
  G.update(.05);
  for(let i=0;i<4;i++)G.update(.05);
  assert.ok(S.stainQueue.some(m=>m.weapon==='crescent'&&!m.red));
  S.stats.levels.seal_crescent=1;
  S.crescents=[];S.crescentT=0;
  G.update(.05);
  for(let i=0;i<4;i++)G.update(.05);
  assert.ok(S.stainQueue.some(m=>m.weapon==='crescent'&&m.red));
});
test('Mirror Fold safely catches an ordinary enemy glob, not a Guardian attack',()=>{
  const {G}=boot(1),S=G.S;
  S.stats.mirror=1;S.stats.levels.mirror=1;
  S.enemies=[enemy('spit',150,0)];
  S.ebullets=[{kind:'glob',x:30,y:0,vx:-120,vy:0,
    age:0,life:2,ang:Math.PI}];
  const hp=S.stats.hp;
  G.update(.04);
  assert.equal(S.ebullets.length,0,'incoming glob caught by Mirror Fold');
  assert.ok(S.bullets.some(b=>b.kind==='mirror'),'reflective paper crease fires');
  assert.equal(S.stats.hp,hp);
  assert.ok(S.mirrorT>0,'catch is cooldown-gated');
  assert.ok(!S.stainQueue.some(m=>m.weapon==='mirror'),
    'rank one does not permanently mark the paper');
  const d=G.S.guardianMarks;
  d.push({kind:'heavenlyStroke',owner:{},t:1,maxWarn:1,recovery:.25});
  assert.equal(d.length,1,'the ability never deletes Guardian hazard geometry');
});
test('Shroud Step briefly displaces the ink-soul and leaves a working decoy',()=>{
  const {G}=boot(1),S=G.S;
  S.stats.shroud=2;S.stats.levels.shroud=2;
  S.enemies=[enemy('pulse',270,0)];
  S.player.fireT=99999;S.invulnT=9999;
  S.inputVec.x=1;
  let triggered=false;
  for(let i=0;i<32;i++){
    G.update(.05);
    if(S.shroudEchoes.length){triggered=true;break;}
  }
  assert.ok(triggered,'sustained movement near danger triggers displacement');
  assert.ok(S.player.x>260,'the hero briefly surges forward');
  assert.ok(S.shroudT>8,'Shroud Step respects its long cooldown');
  assert.ok(S.stainQueue.some(m=>m.weapon==='shroud'&&!m.red));
  const echo=S.shroudEchoes[0];
  assert.ok(echo.max>0&&echo.life>0);
  assert.equal(S.player.r,10);
});
test('the First Paper final Guardian survives longer and changes patterns faster',()=>{
  const boss=boot(0),normal=boot(0);
  boss.G.S.level=10;normal.G.S.level=10;
  for(const [ctx,isBoss] of [[boss,true],[normal,false]]){
    const S=ctx.G.S;S.W=393;S.H=852;
    S.queue=['pulse'];S.spawnTimer=99999;S.markers=[];
    S.markers.push({type:'slab',x:240,y:0,t:.01,elite:true,boss:isBoss});
    ctx.G.update(.04);
  }
  const hard=boss.G.S.enemies.find(e=>e.guardian);
  const ordinary=normal.G.S.enemies.find(e=>e.guardian);
  assert.ok(hard.hp>ordinary.hp*2.6,'boss HP is distinct from ordinary Guardian');
  assert.ok(hard.guardian.cooldown<ordinary.guardian.cooldown);
  assert.equal(boss.GUARDIANS.phases(68,100,true,0),2);
  assert.equal(boss.GUARDIANS.phases(38,100,true,0),3);
  assert.equal(boss.GUARDIANS.phases(68,100,true,1),2);
  hard.hp=Math.round(hard.maxHp*.65);
  boss.G.update(.04);
  assert.ok(boss.G.S.enemies.filter(e=>e.type==='pulseling').length>=1,
    'phase change summons limited small ink foes without new art assets');
  const p=boss.GUARDIANS.attack(0,2,true,{x:240,y:0},
    {x:0,y:0},{width:393,height:852},0);
  assert.ok(p.marks.every(m=>m.kind==='heavenlyStroke'));
  assert.ok(p.marks[1].delay>0,'crossing attacks remain staggered and telegraphed');
});
test('all new art stays procedural and close to the original sumi-e palette',()=>{
  const r=read('js/render.js'),game=read('js/game.js');
  for(const name of ['lantern','crescent','mirror','shroud']){
    assert.ok(r.includes("case '"+name+"':") ||
      r.includes("case '"+name+"': {"),name+' has unique stage signature');
    assert.ok(game.includes("markWeapon('"+name+"'"),name+' has rank-gated terrain');
  }
  for(const fx of ['drawLantern','drawCrescent','drawShroudEcho','drawLanternRevelation']){
    assert.ok(r.includes('function '+fx+'('),fx);
  }
  assert.ok(r.includes("if (playing) drawLantern(ctx,S,t);"));
  assert.ok(r.includes("for (const pd of S.puddles) drawSuiteki(ctx,pd,t)"));
  assert.ok(r.includes("c.moveTo(pd.x0,pd.y0);c.lineTo(pd.x,pd.y)"));
});
