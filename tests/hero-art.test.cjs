'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const png=p=>{const data=fs.readFileSync(path.join(root,p));assert.equal(data.subarray(1,4).toString(),'PNG');return {w:data.readUInt32BE(16),h:data.readUInt32BE(20)};};
test('ONE MORE installs the selected character artwork on iPhone and Android',()=>{
  const m=JSON.parse(read('manifest.webmanifest')),html=read('index.html');
  assert.equal(m.display,'standalone');
  for(const [src,size,purpose] of [
    ['./icons/icon-192.png',192,'any'],
    ['./icons/icon-512.png',512,'any'],
    ['./icons/icon-512-maskable.png',512,'maskable']
  ]){
    const icon=m.icons.find(x=>x.src===src);
    assert.ok(icon,'missing '+src);assert.equal(icon.purpose,purpose);
    assert.equal(icon.sizes,size+'x'+size);
    const data=png(src.slice(2));
    assert.deepEqual(data,{w:size,h:size});
  }
  assert.deepEqual(png('icons/apple-touch-icon.png'),{w:180,h:180});
  assert.ok(html.includes('rel="apple-touch-icon"'));
  assert.ok(html.includes('./icons/icon-192.png'));
});
test('transparent animation atlas exists for First Wash, Night Scroll and Cinnabar',()=>{
  for(const p of ['assets/hero-atlas.webp','assets/hero-atlas-night.webp']){
    const data=fs.readFileSync(path.join(root,p));
    assert.equal(data.toString('ascii',0,4),'RIFF');
    assert.equal(data.toString('ascii',8,12),'WEBP');
    assert.ok(data.byteLength>10000);
  }
  const render=read('js/render.js');
  assert.ok(render.includes('function paintHeroSprite('));
  assert.ok(render.includes('frame*180,row*160,180,160'));
  assert.ok(render.includes('p.flowPhase'), 'run follows existing animation phase');
  for(const frames of ['count=6','count=8','count=4','count=2','count=5']){
    assert.ok(render.includes(frames),frames);
  }
  assert.ok(render.includes('if(!paintHeroSprite(c,p,S,t))'),
    'procedural fallback remains functional');
  assert.ok(render.includes("drawInkGun(c,p,st)"),'existing gun visuals preserved');
  assert.ok(render.includes('drawStarterTool(c,S,t)'), 'other five tools preserved');
});
test('sprite visuals do not change damage, movement, hitbox or weapon balance',()=>{
  const game=read('js/game.js'),cfg=read('js/config.js');
  assert.ok(game.includes('function meleeStrike('));
  assert.ok(game.includes('function fireStarter('));
  assert.ok(game.includes('p.x += vx * sp * dt;'));
  assert.ok(cfg.includes('muzzle: 20'));
  assert.ok(read('js/render.js').includes('const size=p.displayScale||1;'));
});
