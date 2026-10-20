'use strict';
/* Browser smoke QA: the compact GLM opening and preserved original short film.
   No Playwright dependency is required to run ONE MORE itself. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base='http://127.0.0.1:8765/';
const out=path.join(__dirname,'..','film-stills');
fs.mkdirSync(out,{recursive:true});

/* An overflow:hidden wrapper must not disguise clipped content. */
async function assertViewportFit(page,selector,viewport,label){
  const m=await page.locator(selector).evaluate(el=>{
    const r=el.getBoundingClientRect();
    return {top:r.top,bottom:r.bottom,height:el.clientHeight,scroll:el.scrollHeight,
      width:el.clientWidth,scrollWidth:el.scrollWidth};
  });
  assert.ok(m.top>=-3 && m.bottom<=viewport.height+3,
    label+' stays within the visible screen: '+JSON.stringify(m));
  assert.ok(m.scroll<=m.height+3 && m.scrollWidth<=m.width+3,
    label+' fits without concealed scrollable content: '+JSON.stringify(m));
}

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
  const artURLs=[
    './icons/icon-192.png','./icons/icon-512.png',
    './icons/icon-512-maskable.png','./icons/apple-touch-icon.png',
    './assets/hero-atlas.webp','./assets/hero-atlas-night.webp'
  ];
  for(const url of artURLs){
    const result=await page.evaluate(async url=>{
      const r=await fetch(url);return {status:r.status,size:(await r.blob()).size};
    },url);
    assert.equal(result.status,200,name+' can load '+url);
    assert.ok(result.size>10000,name+' has nontrivial art for '+url);
  }
  /* Catch the actual iPhone bug: every atlas tile must have transparent
     corners, rather than a painted/off-white rectangular background. */
  const cleanAtlas=await page.evaluate(async()=>{
    const results=[];
    for(const suffix of ['', '-night']){
      const image=new Image();
      image.src='./assets/hero-atlas'+suffix+'.webp?v=clean2';
      await image.decode();
      const canvas=document.createElement('canvas');
      canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const cx=canvas.getContext('2d',{willReadFrequently:true});
      cx.drawImage(image,0,0);
      const pixels=cx.getImageData(0,0,canvas.width,canvas.height).data;
      const alpha=(x,y)=>pixels[(y*canvas.width+x)*4+3];
      let badCorners=0,badEdges=0,solidSamples=0;
      for(let row=0;row<4;row++)for(let col=0;col<6;col++){
        const left=col*192,top=row*192;
        for(const [x,y] of [[3,3],[188,3],[3,188],[188,188]]){
          if(alpha(left+x,top+y)>8)badCorners++;
        }
        /* A fade across each tile boundary eliminates clipped brush
           marks that could otherwise look like a square on iPhone. */
        for(const [x,y] of [[96,2],[96,189],[2,96],[189,96]]){
          if(alpha(left+x,top+y)>8)badEdges++;
        }
        for(let y=16;y<176;y+=16)for(let x=16;x<176;x+=16){
          if(alpha(left+x,top+y)>220)solidSamples++;
        }
      }
      results.push({w:image.naturalWidth,h:image.naturalHeight,
        badCorners,badEdges,solidSamples});
    }
    return results;
  });
  for(const a of cleanAtlas){
    assert.deepEqual([a.w,a.h],[1152,768],name+' four-row hero atlas dimensions');
    assert.equal(a.badCorners,0,name+' hero tiles must never have visible square corners');
    assert.equal(a.badEdges,0,name+' hero cells must not draw rectangular crop boundaries');
    assert.ok(a.solidSamples>200,name+' hero atlas must contain real painted frames');
  }
  await page.waitForFunction(()=>G.mode==='opening');
  assert.equal(await page.locator('#openingSkip').isVisible(),true,
    'standalone ink opening starts automatically');
  assert.equal(await page.locator('#screenIntro').isVisible(),false,
    'original story film does not play until WATCH FILM');
  const canvasBounds=await page.locator('#game').boundingBox();
  assert.ok(canvasBounds&&Math.abs(canvasBounds.y)<2&&
    Math.abs(canvasBounds.height-viewport.height)<2&&
    Math.abs(canvasBounds.width-viewport.width)<2,
    name+' actual Canvas covers the entire viewport, not merely the menu');
  assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),
    '#131009',name+' dark opening covers phone browser safe-area backing');
  assert.equal(await page.evaluate(()=>document.documentElement.style.backgroundColor),
    'rgb(19, 16, 9)',name+' document colour follows the black opening');
  assert.equal(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content'),
    'yes',name+' allows installation as an iPhone Home Screen web app');
  assert.equal(await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute('content'),
    'black-translucent',name+' uses transparent iOS status-bar mode');
  const manifest=await page.evaluate(async()=>{
    const href=document.querySelector('link[rel="manifest"]')?.getAttribute('href');
    if(!href)return null;
    const response=await fetch(href);
    return response.ok?response.json():null;
  });
  assert.equal(manifest?.display,'standalone',name+' installable app keeps game full-bleed');
  assert.equal(manifest?.start_url,'./',name+' manifest remains within ONE_MORE Pages scope');
  await page.evaluate(()=>OPENING.seek(1.55));
  await page.waitForTimeout(110);
  const dropAtTop=await page.evaluate(()=>{
    const c=document.getElementById('game'),g=c.getContext('2d');
    const x=Math.floor(c.width/2),h=Math.max(8,Math.floor(c.height*.08));
    const d=g.getImageData(Math.max(0,x-12),0,25,h).data;
    let bright=0;
    for(let i=0;i<d.length;i+=4)if(d[i]>160&&d[i+1]>150&&d[i+2]>140)bright++;
    return bright;
  });
  assert.ok(dropAtTop>10,name+' ink droplet enters from top edge, not below the GUI');
  for(const [t,shot] of [[1.8,'01-ink-drop'],[3.2,'02-paper-flood'],
    [7.5,'03-brush-strokes'],[11.8,'04-living-ink'],
    [15.3,'05-ink-spirit'],[16.4,'06-hanko']]){
    await page.evaluate(t=>OPENING.seek(t),t);
    await page.waitForTimeout(110);
    await page.screenshot({path:path.join(out,name+'-'+shot+'.png')});
    assert.equal(await page.evaluate(()=>OPENING.isLive()),true,
      name+' GLM opening keeps animating through '+shot);
  }
  /* Full-bleed paper must cover the upper corners before the flood ends. */
  await page.evaluate(()=>OPENING.seek(5.15));
  await page.waitForTimeout(110);
  const topCorners=await page.evaluate(()=>{
    const c=document.getElementById('game'),g=c.getContext('2d');
    const read=x=>Array.from(g.getImageData(x,2,1,1).data).slice(0,3);
    return [read(2),read(c.width-3)];
  });
  assert.ok(topCorners.every(rgb=>rgb[0]>120&&rgb[1]>110&&rgb[2]>100),
    name+' flood washes over both top canvas corners: '+JSON.stringify(topCorners));
  assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),
    '#ede7d9',name+' mobile status-bar backing becomes paper after flood');
  assert.equal(await page.evaluate(()=>document.documentElement.style.backgroundColor),
    'rgb(237, 231, 217)',name+' document colour changes with the paper flood');
  if(name==='phone'){
    const opening=await page.evaluate(()=>{
      const get=()=>document.getElementById('openingSkip').getBoundingClientRect().top;
      const current=get();
      document.documentElement.style.setProperty('--om-top-ui-nudge','0px');
      const initial=get();
      document.documentElement.style.removeProperty('--om-top-ui-nudge');
      return current-initial;
    });
    assert.ok(Math.abs(opening-12)<1,
      'the opening skip is also lowered 12px on phones');
  }
  const skip=await page.locator('#openingSkip').boundingBox();
  assert.ok(skip&&skip.x>=0&&skip.x+skip.width<=viewport.width+2,
    name+' Skip remains within desktop or phone width');
  assert.ok(skip.y>=0&&skip.y+skip.height<=viewport.height+2,
    name+' Skip remains within desktop or phone height');
  await page.click('#openingSkip');
  await page.waitForFunction(()=>G.mode==='title');
  assert.equal(await page.locator('#screenTitle').isVisible(),true);
  assert.equal(await page.locator('#openingSkip').isVisible(),false);
  assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),
    '#ede7d9',name+' ordinary game backdrop returns after opening');
  await page.waitForTimeout(150);
  const homeBleed=await page.evaluate(()=>{
    const el=document.getElementById('screenTitle');
    const css=getComputedStyle(el),rim=getComputedStyle(el,'::before');
    const r=el.getBoundingClientRect();
    return {background:css.backgroundColor,texture:rim.backgroundImage,
      fade:rim.webkitMaskImage||rim.maskImage,
      upper:r.top,lower:r.bottom,width:r.width,
      underlay:document.documentElement.style.backgroundColor,
      extraOverlay:document.querySelector('#statusBarInk')};
  });
  if(name==='phone'){
    assert.equal(homeBleed.background,'rgb(237, 231, 217)',
      'the home page must finish in the same flat paper as the system chrome');
    assert.ok(homeBleed.fade.includes('linear-gradient')&&
      homeBleed.fade.includes('100%'),
      'the home shading must soften to nothing at both edges: '+homeBleed.fade);
    assert.equal(homeBleed.extraOverlay,null,'no extra bar overlay is present');
  }
  assert.ok(Math.abs(homeBleed.upper)<2&&Math.abs(homeBleed.lower-viewport.height)<2,
    name+' home paint still fills the available viewport');
  if(name==='phone'){
    const g=await page.evaluate(()=>{
      const rect=selector=>{
        const r=document.querySelector(selector).getBoundingClientRect();
        return {x:r.x,y:r.y,bottom:r.bottom};
      };
      const get=()=>({brand:rect('.home-brand'),bottom:rect('.home-bottom'),
        canvas:rect('#game')});
      const a=get();
      document.documentElement.style.setProperty('--om-top-ui-nudge','0px');
      const b=get();
      document.documentElement.style.removeProperty('--om-top-ui-nudge');
      return {a,b};
    });
    assert.ok(Math.abs(g.a.brand.y-g.b.brand.y-12)<1,'home masthead clears status bar');
    assert.ok(Math.abs(g.a.brand.x-g.b.brand.x)<1,'home horizontal layout preserved');
    assert.ok(Math.abs(g.a.bottom.bottom-g.b.bottom.bottom)<1,'bottom menu unchanged');
    assert.ok(Math.abs(g.a.canvas.bottom-g.b.canvas.bottom)<1,'full-screen ink unchanged');
  }
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
  assert.equal(await page.locator('.home-help-steps > div:visible').count(),1);
  await page.click('#helpNext');
  assert.equal(await page.locator('#helpPage').textContent(),'02 / 03');
  await assertViewportFit(page,'#howToPlayDialog',viewport,name+' manual');
  await page.screenshot({path:path.join(out,name+'-09-onboarding-sheet.png')});
  await page.click('#helpClose');
  assert.equal(await page.locator('#howToPlayDialog').evaluate(d=>d.open),false);
  await page.click('#playBtn');
  await page.waitForFunction(()=>G.mode==='select');
  await page.click('#selectBackBtn');
  await page.waitForFunction(()=>G.mode==='title');
  await page.click('#replayIntroBtn');
  await page.waitForFunction(()=>G.mode==='intro');
  if(name==='phone'){
    const shift=await page.evaluate(()=>{
      const get=()=>document.getElementById('introSkip').getBoundingClientRect().top;
      const a=get();
      document.documentElement.style.setProperty('--om-top-ui-nudge','0px');
      const b=get();
      document.documentElement.style.removeProperty('--om-top-ui-nudge');
      return a-b;
    });
    assert.ok(Math.abs(shift-12)<1,'film top actions are also lowered slightly');
  }
  await page.click('#introSkip');
  await page.waitForFunction(()=>G.mode==='title');
  /* A new player can go from helpful onboarding straight to scroll selection. */
  await page.click('#howToPlayBtn');
  await page.click('#helpDone');
  await page.waitForFunction(()=>G.mode==='select');
  /* Phase 2: exercise the REAL DOM campaign picker and canvas runtime,
     not merely the director's headless plan builder. */
  assert.ok((await page.locator('#campaignStatus').textContent()).includes('THE FIRST MARK'));
  if(name==='phone'){
    const shift=await page.evaluate(()=>{
      const get=()=>({
        heading:document.querySelector('.campaign-heading').getBoundingClientRect(),
        footer:document.querySelector('.campaign-footer').getBoundingClientRect()
      });
      const a=get();
      document.documentElement.style.setProperty('--om-top-ui-nudge','0px');
      const b=get();
      document.documentElement.style.removeProperty('--om-top-ui-nudge');
      return {top:a.heading.top-b.heading.top,
        x:a.heading.x-b.heading.x,footerBottom:a.footer.bottom-b.footer.bottom};
    });
    assert.ok(shift.top>=8&&shift.top<=13,'campaign heading gets top clearance: '+JSON.stringify(shift));
    assert.ok(Math.abs(shift.x)<1,'campaign header horizontal position fixed');
    assert.ok(Math.abs(shift.footerBottom)<1,'campaign bottom remains fixed');
  }
  await assertViewportFit(page,'#campaignScrolls',viewport,name+' scroll picker');
  await assertViewportFit(page,'.campaign-footer',viewport,name+' journey actions');
  assert.equal(await page.locator('#campaignLevels button[data-level="1"]').isEnabled(),true);
  assert.equal(await page.locator('#campaignLevels button[data-level="2"]').isEnabled(),false);
  assert.equal(await page.locator('#starterGrid .starter-card').count(),6,
    name+' shows all six unlockable starter instruments');
  assert.equal(await page.locator('#starterGrid .starter-card:disabled').count(),5,
    name+' only the original gun should be unlocked on a fresh campaign');
  assert.equal(await page.locator('#starterGrid [data-starter="gun"]').getAttribute('aria-pressed'),'true');
  await page.click('#campaignTabWeapons');
  assert.equal(await page.locator('#campaignWeapons').isVisible(),true);
  await assertViewportFit(page,'#campaignWeapons',viewport,name+' weapon picker');
  await page.screenshot({path:path.join(out,name+'-17-starter-armory-locked.png')});
  await page.click('#campaignTabLevels');
  assert.equal(await page.locator('#campaignStages').isVisible(),true);
  await assertViewportFit(page,'#campaignStages',viewport,name+' level picker');
  await page.screenshot({path:path.join(out,name+'-08-wave-director-levels.png')});
  await page.click('#campaignLevels button[data-level="1"]');
  await page.waitForFunction(()=>G.mode==='playing');
  if(name==='phone'){
    /* Simulate real iPhone cutout + home indicator. Chromium otherwise
       reports safe-area-inset-* as zero on the Playwright runner. */
    const safeHud=await page.evaluate(()=>{
      const nodes=['.hud-tl','.hud-tr','.hud-bl','.hud-br'];
      const before=nodes.map(s=>document.querySelector(s).getBoundingClientRect());
      document.documentElement.style.setProperty('--om-safe-top','59px');
      document.documentElement.style.setProperty('--om-safe-bottom','34px');
      const after=nodes.map(s=>document.querySelector(s).getBoundingClientRect());
      const hp=document.getElementById('hudHp').getBoundingClientRect();
      return {
        topLeft:{before:before[0].top,after:after[0].top,x:after[0].x,oldX:before[0].x},
        topRight:{before:before[1].top,after:after[1].top,x:after[1].x,oldX:before[1].x},
        bottomLeft:{before:before[2].bottom,after:after[2].bottom},
        bottomRight:{before:before[3].bottom,after:after[3].bottom},
        hearts:hp.top,
      };
    });
    assert.ok(Math.abs(safeHud.topLeft.after-safeHud.topLeft.before-59)<1);
    assert.ok(Math.abs(safeHud.topRight.after-safeHud.topRight.before-59)<1);
    assert.ok(Math.abs(safeHud.topLeft.x-safeHud.topLeft.oldX)<1);
    assert.ok(Math.abs(safeHud.topRight.x-safeHud.topRight.oldX)<1);
    assert.ok(safeHud.hearts>=99,'hearts stay below the translucent status region');
    assert.ok(Math.abs(safeHud.topLeft.before-42)<2,
      'top-left HUD is lowered 16px, not moved horizontally');
    assert.ok(Math.abs(safeHud.topRight.before-40)<2,
      'hearts and score start 16px lower, below the system blur');
    assert.ok(Math.abs(safeHud.bottomLeft.after-safeHud.bottomLeft.before+34)<1);
    assert.ok(Math.abs(safeHud.bottomRight.after-safeHud.bottomRight.before+34)<1);
    await page.screenshot({path:path.join(out,'phone-23-safe-hud.png')});
    await page.evaluate(()=>{
      document.documentElement.style.removeProperty('--om-safe-top');
      document.documentElement.style.removeProperty('--om-safe-bottom');
    });
  }
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
  /* The ink gun is actual Canvas ink, not just projectile coordinates.
     Hold simulation still, rotate only the aim and compare the region
     beyond the character's collision circle where its gun must sit. */
  const gunArt=await page.evaluate(()=>{
    const ctx=document.getElementById('game').getContext('2d');
    const S=G.S,p=S.player,prior=G.mode;
    const aim=p.aim,eye=p.visualAim,shake=S.shake;
    G.mode='paused';S.shake=0;
    const d=S.dpr;
    const x=Math.max(0,Math.round((S.W/2+p.x-S.cam.x+13)*d));
    const y=Math.max(0,Math.round((S.H/2+p.y-S.cam.y-5)*d));
    const w=Math.min(ctx.canvas.width-x,Math.round(13*d));
    const h=Math.min(ctx.canvas.height-y,Math.round(10*d));
    const frame=angle=>{
      p.aim=angle;p.visualAim=angle;
      R.draw(ctx,84.25);
      return ctx.getImageData(x,y,w,h).data;
    };
    const front=frame(0),back=frame(Math.PI);
    let changed=0;
    for(let i=0;i<front.length;i+=4)
      if(Math.abs(front[i]-back[i])+Math.abs(front[i+1]-back[i+1])+
         Math.abs(front[i+2]-back[i+2])>55)changed++;
    /* Restore before continuing the progression/browser film. */
    p.aim=aim;p.visualAim=eye;G.mode=prior;S.shake=shake;
    R.draw(ctx,84.25);
    return {changed,hitbox:p.r,muzzle:CFG.player.muzzle};
  });
  assert.ok(gunArt.changed>7,name+' drawn gun changes muzzle-side Canvas pixels when aiming (changed '+gunArt.changed+')');
  assert.equal(gunArt.hitbox,10);
  assert.equal(gunArt.muzzle,20);
  await page.screenshot({path:path.join(out,name+'-09b-handheld-ink-gun.png')});

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
  /* Real Canvas pixel proof: two static frames at opposite RUN stride
     phases must differ in the character's outline, not just flowPhase.
     The game is paused only for these two synchronous drawings; the
     subsequent browser journey continues normally. */
  const silhouette=await page.evaluate(()=>{
    const mode=G.mode,p=G.S.player;
    const oldPhase=p.flowPhase,oldSpeed=p.visualSpeed,oldState=p.visualState;
    const ctx=document.getElementById('game').getContext('2d');
    const dpr=G.S.dpr;
    const x=Math.max(0,Math.round((G.S.W/2+p.x-G.S.cam.x-25)*dpr));
    const y=Math.max(0,Math.round((G.S.H/2+p.y-G.S.cam.y-25)*dpr));
    const w=Math.min(ctx.canvas.width-x,Math.round(50*dpr));
    const h=Math.min(ctx.canvas.height-y,Math.round(50*dpr));
    G.mode='paused';G.S.shake=0;p.visualSpeed=1;p.visualState='run';
    const frame=phase=>{
      p.flowPhase=phase;
      R.draw(ctx,82.5);
      return ctx.getImageData(x,y,w,h).data;
    };
    const first=frame(Math.PI/2),second=frame(3*Math.PI/2);
    let changed=0;
    for(let i=0;i<first.length;i+=4){
      if(Math.abs(first[i]-second[i])+Math.abs(first[i+1]-second[i+1])+
        Math.abs(first[i+2]-second[i+2])>45)changed++;
    }
    p.flowPhase=oldPhase;p.visualSpeed=oldSpeed;
    p.visualState=oldState;G.mode=mode;
    return {changed,dpr};
  });
  assert.ok(silhouette.changed>18,
    name+' Canvas ink-soul must visibly reshape between opposite RUN poses (changed '+silhouette.changed+' pixels)');
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
  assert.equal(await page.evaluate(()=>document.documentElement.style.backgroundColor),
    'rgb(36, 43, 57)',name+' Night Scroll matches indigo document paper');
  await page.evaluate(()=>{
    G.S.areaIdx=2;
    UI.setArea(AREAS[2],3,false);
  });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.documentElement.style.backgroundColor),
    'rgb(234, 219, 196)',name+' Cinnabar paper changes document colour without moving HUD');
  await page.evaluate(()=>{
    G.S.areaIdx=0;G.S.inkDrops=[];G.S.enemies=[];
    UI.setArea(AREAS[0],3,false);
  });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.documentElement.style.backgroundColor),
    'rgb(237, 231, 217)',name+' returning to First Wash restores pale paper');
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
  /* Phase 7: actually draw all four Night Scroll arts on the live
     Canvas and walk long enough to create a continuous Suiteki ribbon. */
  await page.evaluate(()=>{
    G.startLevel(0,1);
    G.S.areaIdx=1;UI.setArea(AREAS[1],3,false);
    const S=G.S,p=S.player;
    S.queue=['pulse'];S.spawnTimer=99999;S.markers=[];p.fireT=99999;
    S.stats.lantern=2;S.stats.crescent=3;
    S.stats.mirror=3;S.stats.shroud=2;S.stats.trailW=3;
    for(const [k,v] of [['lantern',2],['crescent',3],['mirror',3],
      ['shroud',2],['trail',3]])S.stats.levels[k]=v;
    S.crescentT=0;S.mirrorT=0;
    S.shroudT=0;S.shroudMotion=1.05;S.invulnT=30;
    S.enemies=[{
      type:'shade',x:p.x+225,y:p.y,r:12,hp:350,maxHp:350,
      t:1,seed:.32,state:'tele',stateT:0,ang:0,hitFlash:0,
      slowT:0,elite:false,orbCd:0,kbx:0,kby:0,
      px:0,py:0,stun:0,dirT:0,spawnT:0,speed:0,
    }];
    S.ebullets=[{
      kind:'glob',x:p.x+26,y:p.y,vx:-80,vy:0,
      age:0,life:2,ang:Math.PI,
    }];
  });
  await page.keyboard.down('d');
  await page.waitForTimeout(420);
  await page.keyboard.up('d');
  const nightArts=await page.evaluate(()=>({
    mirrorT:G.S.mirrorT,wet:G.S.puddles.length,
    lantern:G.S.stats.lantern,crescent:G.S.stats.crescent,
    shroud:G.S.stats.shroud,moon:G.S.crescents.length,
    mode:G.mode,
  }));
  assert.ok(nightArts.wet>=3,name+' Suiteki trails behind walking spirit');
  assert.ok(nightArts.mirrorT>0,name+' Mirror catches a real enemy shot');
  assert.ok(nightArts.moon>=1,name+' Crescent Return exists in world space');
  assert.ok(nightArts.lantern===2&&nightArts.shroud===2);
  assert.equal(nightArts.mode,'playing');
  await page.screenshot({path:path.join(out,name+'-17-night-arts-and-snail-trail.png')});
  /* Real mobile and desktop captures of both always-on Lantern ranks. */
  await page.evaluate(()=>{
    const S=G.S,p=S.player;
    S.stats.crescent=0;S.stats.shroud=0;S.stats.mirror=0;
    S.stats.trailW=0;S.puddles=[];S.crescents=[];
    S.enemies=[{type:'shade',x:p.x+110,y:p.y,r:12,hp:60,maxHp:60,
      t:1,seed:.52,state:'emerge',stateT:.12,ang:Math.PI,hitFlash:0,
      slowT:0,elite:false,orbCd:0,kbx:0,kby:0,
      px:0,py:0,stun:0,dirT:0,spawnT:0,speed:0}];
    S.stats.lantern=1;S.stats.levels.lantern=1;
  });
  await page.waitForTimeout(90);
  assert.equal(await page.evaluate(()=>G.S.enemies[0].lanternLit),true);
  await page.screenshot({path:path.join(out,name+'-21-lantern-continuous-rank1.png')});
  await page.evaluate(()=>{G.S.stats.lantern=2;G.S.stats.levels.lantern=2;});
  await page.waitForTimeout(90);
  assert.equal(await page.evaluate(()=>G.S.enemies[0].lanternLit),true);
  await page.screenshot({path:path.join(out,name+'-22-lantern-rank2-shade-warning.png')});
  await page.evaluate(()=>{
    G.startLevel(0,1);
    G.S.queue=['pulse'];G.S.spawnTimer=99999;
    G.S.markers=[];G.S.player.fireT=99999;
    G.S.stats.trailW=3;G.S.stats.levels.trail=3;
  });
  await page.keyboard.down('d');
  await page.waitForTimeout(420);
  await page.keyboard.up('d');
  const snail=await page.evaluate(()=>({
    wet:G.S.puddles.length,
    joined:G.S.puddles.slice(1).every((v,i)=>
      Math.hypot(v.x0-G.S.puddles[i].x,
        v.y0-G.S.puddles[i].y)<.002),
    width:G.S.puddles[0]?.r,
  }));
  assert.ok(snail.wet>=3&&snail.joined&&snail.width===8.5,
    name+' actual moving Suiteki ribbon joins seamlessly without blobs');
  await page.screenshot({path:path.join(out,name+'-18-joined-ivory-washi-trail.png')});
  /* Weapon ownership comes from existing campaign clears. Selecting a
     newly unlocked weapon is persistent and applies when replaying the
     FIRST paper, on both phone and desktop browser renderers. */
  await page.evaluate(()=>{
    localStorage.setItem('om_campaign_v1',JSON.stringify({
      version:1,completed:[10,10,9],
    }));
    G.openCampaign(0);
  });
  await page.waitForFunction(()=>G.mode==='select');
  assert.equal(await page.locator('#starterGrid .starter-card:not(:disabled)').count(),6,
    name+' all starter cards earned across the campaign');
  await page.click('#campaignTabWeapons');
  await page.locator('#starterGrid [data-starter="brush"]').click();
  assert.equal(await page.locator('#starterGrid [data-starter="brush"]').getAttribute('aria-pressed'),'true',
    name+' selected Great Brush card announces itself accessibly');
  await page.screenshot({path:path.join(out,name+'-18-starter-armory-unlocked.png')});
  await page.click('#campaignTabLevels');
  await page.locator('#campaignLevels button[data-level="1"]').click();
  assert.equal(await page.evaluate(()=>G.S.starter),'brush',
    name+' earned melee brush usable immediately when replaying Paper 1');
  const stroke=await page.evaluate(()=>{
    const S=G.S,p=S.player;
    S.queue=['pulse'];S.spawnTimer=99999;S.markers=[];
    S.enemies=[{type:'pulse',x:p.x+55,y:p.y,r:12,
      hp:35,maxHp:35,speed:0,t:0,seed:.41,state:'cruise',
      stateT:0,hitFlash:0,slowT:0,elite:false,kbx:0,kby:0,
      orbCd:0,stun:0,ang:0,dirT:0,spawnT:0}];
    p.fireT=0;G.update(.03);
    return {hits:S.enemies[0].hp<35,
      kind:S.primaryFx.at(-1)?.kind,marks:S.stainQueue.filter(q=>q.kind==='weapon').length,
      radius:p.r};
  });
  assert.deepEqual(stroke,{hits:true,kind:'brush',marks:0,radius:10},
    name+' Great Brush visibly swings, hits and never paints the map');
  await page.screenshot({path:path.join(out,name+'-19-great-brush-first-paper.png')});
  await page.evaluate(()=>G.openCampaign(0));
  await page.click('#campaignTabWeapons');
  await page.locator('#starterGrid [data-starter="quill"]').click();
  await page.click('#campaignTabLevels');
  await page.locator('#campaignLevels button[data-level="1"]').click();
  const quill=await page.evaluate(()=>{
    const S=G.S,p=S.player;
    S.queue=['pulse'];S.spawnTimer=99999;S.markers=[];
    S.enemies=[{type:'pulse',x:p.x+250,y:p.y,r:12,
      hp:35,maxHp:35,speed:0,t:0,seed:.42,state:'cruise',
      stateT:0,hitFlash:0,slowT:0,elite:false,kbx:0,kby:0,
      orbCd:0,stun:0,ang:0,dirT:0,spawnT:0}];
    p.fireT=0;G.update(.03);
    return {starter:S.starter,needle:S.bullets.some(b=>b.kind==='needleQuill'),
      marks:S.stainQueue.some(q=>q.kind==='weapon')};
  });
  assert.deepEqual(quill,{starter:'quill',needle:true,marks:false},
    name+' a second earned ranged weapon works on early Paper 1');
  await page.screenshot({path:path.join(out,name+'-20-needle-quill-first-paper.png')});
  assert.deepEqual(errors,[],name+' had no browser JS exceptions');
  await context.close();
  return {name,shots:21,phase7Verified:true,redSealVerified:true,eraserVerified:true,homeVerified:true,onboardingVerified:true,inkXPVerified:true,verticalXpVerified:true,animatedBlobVerified:true,nightInkVerified:true,directorVerified:true,guardianVerified:true,noBrowserErrors:true};
}
async function inspectShort(browser,name,viewport){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base,{waitUntil:'load'});
  await page.click('#openingSkip');
  await page.waitForFunction(()=>G.mode==='title');
  await assertViewportFit(page,'.home-content',viewport,name+' title');
  await page.click('#howToPlayBtn');
  await assertViewportFit(page,'#howToPlayDialog',viewport,name+' how to play');
  await page.click('#helpNext');
  await page.click('#helpNext');
  assert.equal(await page.locator('#helpPage').textContent(),'03 / 03');
  await page.click('#helpClose');
  await page.click('#playBtn');
  await page.waitForFunction(()=>G.mode==='select');
  for(const [tab,pane] of [['Scrolls','campaignScrolls'],['Weapons','campaignWeapons'],['Levels','campaignStages']]){
    await page.click('#campaignTab'+tab);
    await assertViewportFit(page,'#'+pane,viewport,name+' '+tab);
    await assertViewportFit(page,'.campaign-footer',viewport,name+' navigation');
  }
  await page.click('#selectBackBtn');
  await page.click('#chronicleBtn');
  for(let i=0;i<5;i++){
    await assertViewportFit(page,'.archive-chapters',viewport,name+' chronicle chapter '+i);
    if(i<4)await page.click('#archiveNext');
  }
  if(name==='short-landscape'){
    const extra=await page.evaluate(()=>getComputedStyle(document.documentElement)
      .getPropertyValue('--om-top-ui-nudge').trim());
    assert.equal(extra,'','no extra shift for cramped landscape screens');
  }
  await page.click('#archiveBack');
  assert.deepEqual(errors,[],name+' browser errors');
  await context.close();
  return {name,viewport,noInnerScrolling:true};
}

async function inspectIOSStandaloneBleed(browser){
  /* Emulate iOS PWA bottom safe-area gaps of 34 and 59 CSS pixels. */
  const context=await browser.newContext({
    viewport:{width:393,height:793},screen:{width:393,height:852},
    isMobile:true,hasTouch:true,deviceScaleFactor:2,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
  });
  await context.addInitScript(()=>{
    Object.defineProperty(navigator,'standalone',{configurable:true,value:true});
  });
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'load'});
  const first=await page.evaluate(()=>({
    standalone:document.documentElement.classList.contains('om-pwa-standalone'),
    width:document.getElementById('stage').clientWidth,
    hudTop:document.querySelector('.hud-tr').getBoundingClientRect().top
  }));
  assert.ok(first.standalone,'installed iPhone detection is active');
  assert.equal(first.width,393,'no horizontal geometry changes');
  for(const gap of [34,59]){
    await page.evaluate(gap=>
      document.documentElement.style.setProperty('--om-pwa-fill-bottom',gap+'px'),gap);
    await page.waitForFunction(gap=>
      document.getElementById('stage').clientHeight>=793+gap&&
      G.S.H>=793+gap,gap);
    const data=await page.evaluate(()=>{
      const stage=document.getElementById('stage').getBoundingClientRect();
      const canvas=document.getElementById('game').getBoundingClientRect();
      return {bottom:stage.bottom,canvasBottom:canvas.bottom,
        buffer:G.S.H,width:stage.width,
        hudTop:document.querySelector('.hud-tr').getBoundingClientRect().top};
    });
    assert.ok(data.bottom>=793+gap-1&&data.canvasBottom>=793+gap-1,
      'ink stage fills actual iOS bottom safe area: '+JSON.stringify(data));
    assert.ok(data.buffer>=793+gap,
      'ink backbuffer covers added pixels without stretching');
    assert.equal(data.width,393,'no horizontal layout change');
    assert.equal(data.hudTop,first.hudTop,'top HUD must not move');
  }
  await context.close();
  return {fullScreenBackbuffer:true,mode:'standalone',testedGaps:[34,59]};
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const desktop=await inspect(browser,'desktop',{width:1440,height:900});
    const phone=await inspect(browser,'phone',{width:393,height:852});
    const smallPortrait=await inspectShort(browser,'small-portrait',{width:360,height:640});
    const shortLandscape=await inspectShort(browser,'short-landscape',{width:844,height:390});
    const iosStandAlone=await inspectIOSStandaloneBleed(browser);
    console.log('Visual smoke QA:',JSON.stringify({desktop,phone,smallPortrait,shortLandscape,iosStandAlone}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
