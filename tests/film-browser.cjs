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
  await page.click('#replayIntroBtn');
  await page.waitForFunction(()=>G.mode==='intro');
  assert.deepEqual(errors,[],name+' had no browser JS exceptions');
  await context.close();
  return {name,shots:5,noBrowserErrors:true};
}
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const desktop=await inspect(browser,'desktop',{width:1440,height:900});
    const phone=await inspect(browser,'phone',{width:393,height:852});
    console.log('Visual smoke QA:',JSON.stringify({desktop,phone}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
