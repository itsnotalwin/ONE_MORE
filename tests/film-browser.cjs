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
  assert.ok(grown.drawScale>1,'new rank looks visibly bigger');
  await page.screenshot({path:path.join(out,name+'-12-grown-brush.png')});
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
  assert.deepEqual(guardian,{name:'slab',phase:1,danger:'line'});
  await page.screenshot({path:path.join(out,name+'-10-guardian-ink-seam.png')});
  await page.evaluate(()=>{
    const boss=G.S.enemies.find(e=>e.guardian);
    boss.hp=Math.round(boss.maxHp*.2);
  });
  await page.waitForFunction(()=>G.S.enemies.some(e=>e.guardian?.phase===3),null,{timeout:4000});
  await page.screenshot({path:path.join(out,name+'-11-guardian-final-phase.png')});
  assert.deepEqual(errors,[],name+' had no browser JS exceptions');
  await context.close();
  return {name,shots:14,homeVerified:true,onboardingVerified:true,inkXPVerified:true,directorVerified:true,guardianVerified:true,noBrowserErrors:true};
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const desktop=await inspect(browser,'desktop',{width:1440,height:900});
    const phone=await inspect(browser,'phone',{width:393,height:852});
    console.log('Visual smoke QA:',JSON.stringify({desktop,phone}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
