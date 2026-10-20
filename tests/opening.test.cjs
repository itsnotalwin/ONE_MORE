'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/opening.js'),'utf8');
function harness(reduced=false){
  let calls=0,done=0;
  const context=new Proxy({},{
    get(target,key){
      if(key in target)return target[key];
      if(key==='createRadialGradient'||key==='createLinearGradient')
        return ()=>({addColorStop(){}});
      if(key==='measureText')return t=>({width:String(t).length*11});
      return ()=>{calls++;};
    },set(target,key,value){target[key]=value;return true;}
  });
  const document={
    fonts:{load(){return Promise.resolve([]);}},
    createElement(){return {width:0,height:0,getContext(){return context;}};}
  };
  const G={S:{W:800,H:580,dpr:1,reduced}};
  const sandbox=vm.createContext({G,document});
  vm.runInContext(source,sandbox,{filename:'js/opening.js'});
  const OPENING=vm.runInContext('OPENING',sandbox);
  OPENING.onEnd=()=>done++;
  return {OPENING,context,G,done:()=>done,calls:()=>calls};
}
test('GLM opening is independent of gameplay and draws its whole sequence',()=>{
  const x=harness(),o=x.OPENING;
  o.start();assert.equal(o.isLive(),true);
  for(const t of [0.7,2.5,3.2,5.4,7.6,9.3,11.6,14.9,16.3,17.1]){
    o.seek(t);
    assert.doesNotThrow(()=>o.draw(x.context,t));
  }
  assert.ok(x.calls()>300,'procedural opening draws real ink geometry');
  o.seek(1.55);o.draw(x.context,1.55);
  assert.equal(o.isRimPaper(),false,'top begins as dark void');
  o.seek(5.15);o.draw(x.context,5.15);
  assert.equal(o.isRimPaper(),true,'ink wash covers even the top corners');
  assert.equal(x.G.S.H,580,'canvas changes never resize the gameplay world');
  assert.equal(x.G.S.W,800,'screen dimensions are unchanged');
  assert.equal(x.done(),0,'drawing does not change gameplay screens');
});
test('skip fades to title once and is repeatable without touching stored progress',()=>{
  const x=harness(),o=x.OPENING;
  o.start();o.skip();o.skip();
  o.update(.16);assert.equal(x.done(),0);
  o.update(.17);assert.equal(x.done(),1);
  assert.equal(o.isLive(),false);
  o.update(.2);assert.equal(x.done(),1,'handoff occurs just once');
  o.start();o.skip();o.update(.4);assert.equal(x.done(),2);
});
test('opening completes naturally and reduced motion never forces heavy shakes',()=>{
  const x=harness(true),o=x.OPENING;
  o.start();o.seek(17.4);o.draw(x.context,17.4);
  o.update(.2);
  assert.equal(x.done(),1);
});
test('original cinematic and combat renderer are not replaced by GLM files',()=>{
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');
  const main=read('js/main.js'),html=read('index.html');
  assert.ok(main.includes('OPENING.draw(ctx,now/1000)'));
  assert.ok(main.includes("if (m === 'intro' || m === 'chronicle') return;"));
  assert.ok(read('js/intro.js').includes('const INTRO ='));
  assert.ok(read('js/film.js').includes('const FILM ='));
  assert.ok(read('js/render.js').includes('function drawEnemy('));
  assert.ok(html.includes('<script src="./js/opening.js"></script>'));
  assert.ok(html.includes('id="openingSkip"'));
  assert.ok(html.includes('id="replayIntroBtn"'));
  assert.ok(html.includes('name="apple-mobile-web-app-capable" content="yes"'));
  assert.ok(html.includes('name="apple-mobile-web-app-status-bar-style" content="black-translucent"'),
    'iOS standalone must extend the actual canvas behind the Dynamic Island');
  assert.ok(html.includes('viewport-fit=cover'));
  assert.ok(html.includes('rel="manifest" href="./manifest.webmanifest"'));
  const manifest=JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.start_url,'./');
  assert.equal(manifest.scope,'./');
  assert.ok(read('css/viewport.css').includes('#stage,.screen{height:100%;height:100dvh}'));
  assert.ok(read('js/main.js').includes('const w = stage.clientWidth;'),
    'canvas continues to fill the same stage with no button repositioning');
  assert.ok(!html.includes('src="./js/cutscene.js"'),'GLM gameplay modules not copied');
});
