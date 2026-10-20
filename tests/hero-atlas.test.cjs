'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');

test('both new hero atlases are transparent four-row 6x4 WebP images',()=>{
  for(const name of ['hero-atlas.webp','hero-atlas-night.webp']){
    const file=fs.readFileSync(path.join(root,'assets',name));
    assert.ok(file.length>20000&&file.length<700000,name+' mobile-sized asset');
    assert.equal(file.toString('ascii',0,4),'RIFF');
    assert.equal(file.toString('ascii',8,12),'WEBP');
    assert.equal(file.toString('ascii',12,16),'VP8X','extended WebP with alpha');
    assert.ok(file[20]&0x10,'alpha transparency enabled: '+name);
    assert.equal(file.readUIntLE(24,3)+1,1152,'6 columns of 192px');
    assert.equal(file.readUIntLE(27,3)+1,768,'4 rows of 192px');
  }
});
test('renderer selects only valid cells and preserves the procedural fallback',()=>{
  const render=fs.readFileSync(path.join(root,'js/render.js'),'utf8');
  const from=render.indexOf('  function paintHeroSprite(');
  const to=render.indexOf('  function drawPlayer(',from);
  assert.ok(from>0&&to>from);
  const sprite=render.slice(from,to);
  assert.ok(sprite.includes('image.naturalWidth!==1152'));
  assert.ok(sprite.includes('image.naturalHeight!==768'));
  assert.ok(sprite.includes('frame*192,row*192,192,192'));
  assert.ok(sprite.includes('row=3;start=4;count=2'));
  assert.ok(sprite.includes('row=3;start=3;count=1'));
  assert.ok(sprite.includes('row=3;count=3'));
  assert.ok(sprite.includes('row=2;count=6'));
  assert.ok(sprite.includes('row=1;count=6'));
  assert.ok(render.slice(to,to+1800).includes('if(!paintHeroSprite(c,p,S,t))'),
    'procedural hero remains available if asset fails');
});
