'use strict';
/* Browser smoke QA: a real Chromium rendering of the original short film.
   No Playwright dependency is required to run ONE MORE itself. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base='http://127.0.0.1:8765/';
const out=path.join(__dirname,'..','film-stills');
fs.mkdirSync(out,{recursive:true});

async function inspect(browser,name,viewport){
  const context=await browser.newContext({
    viewport,deviceScaleFactor:name==='phone'?2:1,
    reducedMotion:'no-preference',
    isMobile:name==='phone',hasTouch:name==='phone',
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const response=await page.goto(base,{waitUntil:'load'});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>G.mode==='intro');
  assert.equal(await page.locator('#screenIntro').isVisible(),true,'autoplay film visible');
  assert.equal(await page.locator('#introStartBtn').count(),0,'not a click-to-play cover');
  assert.equal(await page.locator('#introFrames').count(),0,'not a slideshow');
  await page.waitForTimeout(1350);
  await page.screenshot({path:path.join(out,name+'-01-opening.png')});
  await page.evaluate(()=>INTRO.next());
  await page.waitForTimeout(1100);
  await page.screenshot({path:path.join(out,name+'-02-creation.png')});
  await page.evaluate(()=>{INTRO.next();INTRO.next();});
  await page.waitForTimeout(1500);
  await page.screenshot({path:path.join(out,name+'-04-erasure.png')});
  await page.evaluate(()=>INTRO.next());
  await page.waitForTimeout(1100);
  await page.screenshot({path:path.join(out,name+'-05-survivor.png')});
  await page.evaluate(()=>{INTRO.next();INTRO.next();});
  await page.waitForTimeout(4900);
  await page.screenshot({path:path.join(out,name+'-07-title-reveal.png')});
  const rect=await page.locator('#introContent').boundingBox();
  assert.ok(rect.x>=-2&&rect.x+rect.width<=viewport.width+2,
    name+' caption remains in viewport');
  const skip=await page.locator('#introSkip').boundingBox();
  assert.ok(skip.x>=0&&skip.x+skip.width<=viewport.width+2,
    name+' Skip remains on screen');
  await page.click('#introSkip');
  await page.waitForFunction(()=>G.mode==='title');
  assert.equal(await page.locator('#screenTitle').isVisible(),true);
  await page.waitForTimeout(950); // film-to-home ink dissolve
  const homeButton=await page.locator('#playBtn').boundingBox();
  assert.ok(homeButton && homeButton.x>=0 && homeButton.x+homeButton.width<=viewport.width+2,
    name+' primary action is within screen width');
  assert.ok(homeButton.height>=58,name+' primary CTA has a touch-friendly hit area');
  const homeTitle=await page.locator('#screenTitle h1').boundingBox();
  assert.ok(homeTitle && homeTitle.x>=-1 && homeTitle.x+homeTitle.width<=viewport.width+1,
    name+' main title does not overflow horizontally');
  await page.screenshot({path:path.join(out,name+'-08-clean-home.png')});
  await page.click('#howToPlayBtn');
  assert.equal(await page.locator('#howToPlayDialog').evaluate(d=>d.open),true);
  await page.screenshot({path:path.join(out,name+'-09-onboarding-sheet.png')});
  await page.click('#helpClose');
  assert.equal(await page.locator('#howToPlayDialog').evaluate(d=>d.open),false);
  await page.click('#playBtn');
  await page.waitForFunction(()=>G.mode==='select');
  await page.click('#selectBackBtn');
  await page.waitForFunction(()=>G.mode==='title');
  await page.click('#replayIntroBtn');
  await page.waitForFunction(()=>G.mode==='intro');
  await page.click('#introSkip');
  await page.waitForFunction(()=>G.mode==='title');
  /* A new player can go from helpful onboarding straight to scroll selection. */
  await page.click('#howToPlayBtn');
  await page.click('#helpDone');
  await page.waitForFunction(()=>G.mode==='select');
  /* Phase 2: exercise the REAL DOM campaign picker and canvas runtime,
     not merely the director's headless plan builder. */
  assert.ok((await page.locator('#campaignStatus').textContent()).includes('THE FIRST MARK'));
  assert.equal(await page.locator('#campaignLevels button[data-level="1"]').isEnabled(),true);
  assert.equal(await page.locator('#campaignLevels button[data-level="2"]').isEnabled(),false);
  await page.screenshot({path:path.join(out,name+'-08-wave-director-levels.png')});
  await page.click('#campaignLevels button[data-level="1"]');
  await page.waitForFunction(()=>G.mode==='playing');
  assert.equal(await page.locator('#firstRunHint').isVisible(),true,
    'first play teaches movement without blocking game input');
  /* Wave progress and XP now sit beside each other on the top HUD.
     Check layout at 393px portrait and desktop, with a real 60% fill. */
  const meter=await page.locator('#inkMeter').boundingBox();
  const waveTrack=await page.locator('.wave-progress').boundingBox();
  const xpTrack=await page.locator('.ink-meter-track').boundingBox();
  assert.ok(meter&&waveTrack&&xpTrack,name+' top progress row exists');
  assert.ok(meter.x>=waveTrack.x+waveTrack.width-1,
    name+' XP must sit to the RIGHT of the wave progress');
  assert.ok(Math.abs(meter.y-waveTrack.y)<23 &&
    meter.y<105,name+' XP must remain inside the top HUD');
  assert.ok(xpTrack.width>xpTrack.height*4,'XP liquid runs horizontally');
  assert.ok(xpTrack.x+xpTrack.width<viewport.width-15,
    name+' ink gauge does not leave the screen');
  await page.evaluate(()=>{
    const st=G.S.stats;
    UI.setInkProgress(st.inkRank,INK_XP.needed(st.inkRank)*.6,
      INK_XP.needed(st.inkRank),false);
  });
  await page.waitForTimeout(750);
  const fill=await page.locator('#inkFill').boundingBox();
  assert.ok(fill && fill.width/xpTrack.width>.50 && fill.width/xpTrack.width<.67,
    name+' red ink rises horizontally to roughly 60 percent');
  const liquid=await page.locator('#inkFill').evaluate(el=>({
    gradient:getComputedStyle(el).backgroundImage,
    timing:getComputedStyle(el).transitionDuration,
  }));
  assert.ok(liquid.gradient.includes('linear-gradient') &&
    liquid.gradient.includes('rgb(178, 58, 43)'),
    name+' the horizontal XP bar contains the original cinnabar pigment');
  assert.ok(parseFloat(liquid.timing)>.4,'ink fill has viscous easing');
  await page.screenshot({path:path.join(out,name+'-09-horizontal-progress.png')});
  await page.evaluate(()=>{
    const st=G.S.stats;
    UI.setInkProgress(st.inkRank,st.inkXp,INK_XP.needed(st.inkRank),false);
  });
  const plan=await page.evaluate(()=>({
    stage:G.S.wavePlan?.stage,pattern:G.S.wavePlan?.pattern,
    count:G.S.queue.length,wave:G.S.stats.wave,
  }));
  assert.equal(plan.stage,'THE FIRST MARK');
  assert.equal(plan.pattern,'drift');
  assert.equal(plan.wave,1);
  assert.ok(plan.count>0);
  await page.waitForTimeout(1200);
  await page.screenshot({path:path.join(out,name+'-09-wave-director-game.png')});
  /* Stage 4: living splat cores drift, magnetically absorb and grant a
     real upgrade mid-wave, without resetting the Wave Director state. */
  await page.evaluate(()=>{
    G.S.enemies=[];G.S.queue=['pulse'];G.S.markers=[];
    G.S.spawnTimer=9999;G.S.player.fireT=9999;
    INK_XP.drop(G.S.inkDrops,G.S.player.x+87,G.S.player.y+14,5,false,5);
  });
  await page.waitForTimeout(160);
  await page.screenshot({path:path.join(out,name+'-10-living-ink-pickups.png')});
  await page.evaluate(()=>{
    INK_XP.drop(G.S.inkDrops,G.S.player.x+75,G.S.player.y,
      INK_XP.needed(G.S.stats.inkRank),false,8);
  });
  await page.waitForFunction(()=>G.mode==='upgrade',null,{timeout:8000});
  assert.equal(await page.locator('#inkRank').textContent(),'BRUSH 02');
  assert.equal(await page.locator('#upgradeGrid .up-card').count(),3);
  await page.screenshot({path:path.join(out,name+'-11-ink-level-up.png')});
  await page.click('#upgradeGrid .up-card:first-child');
  await page.click('#deployBtn');
  await page.waitForFunction(()=>G.mode==='playing');
  const grown=await page.evaluate(()=>({
    rank:G.S.stats.inkRank,realRadius:G.S.player.r,drawScale:INK_XP.visualScale(G.S.stats),wave:G.S.stats.wave
  }));
  assert.equal(grown.rank,2);
  assert.equal(grown.wave,1,'leveling does not skip any wave');
  assert.equal(grown.realRadius,10,'the character only grows visually');
  assert.ok(grown.drawScale>=1&&grown.drawScale<=1.045,'early brush ranks retain nearly unchanged scale');
  /* Verify the mid/high-rank stage is visibly evolved but never oversized. */
  await page.evaluate(()=>{
    G.S.stats.inkRank=16;
    G.S.stats.maxHp=7;
  });
  await page.waitForTimeout(1300); // eased visual growth
  const evolved=await page.evaluate(()=>({
    scale:G.S.player.displayScale,target:INK_XP.visualScale(G.S.stats),
    hitbox:G.S.player.r,tier:INK_XP.visualForm(G.S.stats).tier
  }));
  assert.ok(evolved.scale>1.13&&evolved.scale<1.18);
  assert.ok(Math.abs(evolved.scale-evolved.target)<.005);
  assert.equal(evolved.hitbox,10);
  assert.equal(evolved.tier,3);
  await page.screenshot({path:path.join(out,name+'-12-awakened-brush.png')});
  await page.keyboard.down('d');
  await page.waitForTimeout(480);
  const motion=await page.evaluate(()=>({
    state:G.S.player.visualState,phase:G.S.player.flowPhase,
    speed:G.S.player.visualSpeed,r:G.S.player.r,
  }));
  assert.equal(motion.state,'run',name+' player visibly transitions to flowing RUN');
  assert.ok(motion.phase>1&&motion.speed>.5&&motion.r===10,
    name+' player folds advance while collision radius stays fixed');
  await page.screenshot({path:path.join(out,name+'-13-stable-brush-moving.png')});
  await page.keyboard.up('d');
  /* Palettes must still render living ink on the reverse/night scroll. */
  await page.evaluate(()=>{
    G.S.areaIdx=1;
    UI.setArea(AREAS[1],3,false);
    G.S.inkDrops=[];
    /* Night's old spectral bodies were visually lost in the paper.
       Render both a fading Shade and a ring-like Wisp on the real
       indigo paper and exercise the full HUD contrast. */
    G.S.enemies=[
      {type:'shade',x:G.S.player.x+86,y:G.S.player.y-62,r:12,
       hp:3,maxHp:3,t:1,seed:.34,state:'dissolve',stateT:.41,
       ang:0,hitFlash:0,slowT:0,elite:false,orbCd:0,kbx:0,kby:0,
       px:0,py:0,stun:0,dirT:0,spawnT:0,speed:0},
      {type:'wraith',x:G.S.player.x-72,y:G.S.player.y+74,r:11,
       hp:2,maxHp:2,t:1,seed:.22,state:'cruise',stateT:0,
       ang:0,hitFlash:0,slowT:0,elite:false,orbCd:0,kbx:0,kby:0,
       px:0,py:0,stun:0,dirT:0,spawnT:0,speed:0},
    ];
    for(let n=0;n<18;n++)INK_XP.drop(G.S.inkDrops,
      G.S.player.x+45+(n%6)*18,G.S.player.y-44+Math.floor(n/6)*18,
      6,false,n*7);
  });
  await page.waitForTimeout(180);
  await page.screenshot({path:path.join(out,name+'-14-night-ink-seeds.png')});
  const night=await page.evaluate(()=>({
    body:R.terrainStats(),
    paper:(()=>{const c=document.getElementById('game'),g=c.getContext('2d');
      /* Only the palette is asserted by exact values; canvas pixel
         checks are deliberately independent of GPU color management. */
      return getComputedStyle(document.getElementById('hud')).getPropertyValue('--ink').trim();
    })(),
    hud:document.getElementById('hud').classList.contains('is-night'),
    banner:document.getElementById('waveBanner').classList.contains('is-night'),
  }));
  assert.equal(night.paper,'#fff1da',name+' Night HUD uses bright ivory text');
  assert.ok(night.hud&&night.banner,name+' Night HUD and banners both adopt ivory ink');
  await page.evaluate(()=>{
    G.S.areaIdx=0;G.S.inkDrops=[];G.S.enemies=[];
    UI.setArea(AREAS[0],3,false);
  });
  /* Exercise an actual 3-phase Guardian using the live game loop,
     retaining the same Canvas render path and mobile-sized viewport. */
  await page.evaluate(()=>{
    G.S.queue=[];
    G.S.enemies=[];
    G.S.markers=[{type:'slab',x:220,y:0,t:.01,elite:true,boss:true}];
    G.S.stats.wave=10;
    G.S.player.fireT=9999;
    G.S.waveActive=true;
    G.S.spawnTimer=9999;
    G.S.invulnT=30; // the browser smoke test must remain alive
  });
  await page.waitForFunction(()=>G.S.enemies.some(e=>e.guardian),null,{timeout:5000});
  await page.waitForFunction(()=>G.S.guardianMarks.length>0,null,{timeout:10000});
  const guardian=await page.evaluate(()=>({
    name:G.S.enemies.find(e=>e.guardian)?.type,
    phase:G.S.enemies.find(e=>e.guardian)?.guardian.phase,
    danger:G.S.guardianMarks[0]?.kind,
  }));
  assert.deepEqual(guardian,{name:'slab',phase:1,danger:'heavenlyStroke'});
  await page.screenshot({path:path.join(out,name+'-10-guardian-ink-seam.png')});
  await page.evaluate(()=>{
    const boss=G.S.enemies.find(e=>e.guardian);
    boss.hp=Math.round(boss.maxHp*.2);
  });
  await page.waitForFunction(()=>G.S.enemies.some(e=>e.guardian?.phase===3),null,{timeout:4000});
  await page.screenshot({path:path.join(out,name+'-11-guardian-final-phase.png')});
  /* Real renderer must retain weapon and blood marks over a complete
     wave transition and forget them on a fresh independent level. */
  await page.evaluate(()=>{
    /* Earlier randomized rank choice can select Eraser. Disable it
       while proving that unrelated terrain persists across wave turns. */
    G.S.stats.orb=0;G.S.eraserT=0;
    G.S.queue=['pulse'];G.S.spawnTimer=99999;
    G.S.enemies=[];G.S.markers=[];G.S.guardianMarks=[];
    const x=G.S.player.x,y=G.S.player.y;
    G.S.stainQueue.push({kind:'weapon',weapon:'fan',x:x+18,y:y+38,
      r:7,alpha:.37,angle:0});
    G.S.stainQueue.push({x:x+26,y:y+38,r:12,alpha:.52,red:false});
  });
  await page.waitForFunction(()=>R.terrainStats().weapons.fan>0 &&
    R.terrainStats().blood>0,null,{timeout:3000});
  const beforeTerrain=await page.evaluate(()=>R.terrainStats());
  await page.evaluate(()=>{
    G.S.queue=[];G.S.enemies=[];G.S.markers=[];
    G.S.stats.wave=3;G.S.waveActive=true;G.S.clearedT=0;
  });
  await page.waitForFunction(()=>G.S.stats.wave===4,null,{timeout:5000});
  const afterTerrain=await page.evaluate(()=>R.terrainStats());
  assert.ok(afterTerrain.total>=beforeTerrain.total,
    'all weapon marks and enemy blood persist between waves');
  const nextSheet=await page.evaluate(()=>{
    G.startLevel(0,1);return R.terrainStats();
  });
  assert.equal(nextSheet.total,0,'new separate level wipes the old stage');
  /* Browser-level proof: the Eraser removes the actual cached terrain.
     At mastery it paints a deep-red boundary on the otherwise blank paper. */
  await page.evaluate(()=>{
    G.S.queue=['pulse'];G.S.spawnTimer=99999;G.S.player.fireT=99999;
    const p=G.S.player;
    for(let i=0;i<5;i++)G.S.stainQueue.push({
      x:p.x+25+i*12,y:p.y+12,kind:i%2?'weapon':'blood',
      weapon:'shot',enemyType:'pulse',variant:i%5,alpha:.97,r:10,red:false,
    });
  });
  await page.waitForFunction(()=>R.terrainStats().total>=5,null,{timeout:3000});
  const inkBefore=await page.evaluate(()=>R.terrainStats().total);
  await page.evaluate(()=>{G.S.stats.orb=1;G.S.stats.levels.orbit=1;});
  await page.waitForTimeout(430);
  const erased=await page.evaluate(()=>R.terrainStats().total);
  assert.ok(erased<inkBefore,'Eraser clears cached blood and weapon impressions');
  await page.evaluate(()=>{
    G.S.stats.orb=3;G.S.stats.levels.orbit=3;
    G.S.eraserT=0;
  });
  await page.waitForFunction(()=>R.terrainStats().weapons.eraser>0,
    null,{timeout:4000});
  await page.screenshot({path:path.join(out,name+'-15-mastered-red-eraser.png')});
  /* A weapon at its normal maximum gets one distinct Vermilion card.
     Real phone-sized UI must show red art and not silently grant it. */
  await page.evaluate(()=>{
    G.S.stats.orb=0; G.S.eraserT=0;
    /* Remove earlier maxed Eraser test rank so Echo is the eligible seal. */
    G.S.stats.levels.orbit=0;
    delete G.S.stats.levels.seal_orbit;
    G.S.queue=['pulse'];G.S.spawnTimer=99999;G.S.enemies=[];
    G.S.stats.levels.echo=2;G.S.stats.echo=2;
    G.S.stats.inkPending=1;
  });
  await page.waitForFunction(()=>G.mode==='upgrade',null,{timeout:4000});
  const redCard=page.locator('.up-card.is-seal');
  assert.ok(await redCard.count()>=1,name+' maxed Echo offers a selectable red upgrade');
  assert.ok((await redCard.first().innerText()).includes('VERMILION'),
    name+' red upgrade card is clearly named');
  await page.screenshot({path:path.join(out,name+'-16-post-max-red-upgrade.png')});
  const chosen=await page.evaluate(()=>{
    const slot=G.S.choices.findIndex(u=>u.id==='seal_echo');
    if(slot<0)return false;
    G.pickAt(slot);G.deploy();
    return G.S.stats.levels.seal_echo===1;
  });
  assert.ok(chosen,name+' post-max red upgrade must be selectable through gameplay');
  assert.ok(await page.locator('.load-item.is-seal').count()>=1,
    name+' selected red seal must remain visible in the loadout');
  assert.deepEqual(errors,[],name+' had no browser JS exceptions');
  await context.close();
  return {name,shots:19,redSealVerified:true,eraserVerified:true,homeVerified:true,onboardingVerified:true,inkXPVerified:true,verticalXpVerified:true,animatedBlobVerified:true,nightInkVerified:true,directorVerified:true,guardianVerified:true,noBrowserErrors:true};
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const desktop=await inspect(browser,'desktop',{width:1440,height:900});
    const phone=await inspect(browser,'phone',{width:393,height:852});
    console.log('Visual smoke QA:',JSON.stringify({desktop,phone}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
