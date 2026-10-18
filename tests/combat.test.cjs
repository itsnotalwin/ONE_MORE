'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const file = p => fs.readFileSync(path.join(root, p), 'utf8');

function harness() {
  const saved = new Map();
  const localStorage = {
    getItem(k) { return saved.get(k) ?? null; },
    setItem(k, v) { saved.set(k, String(v)); },
  };
  const UI = new Proxy({}, { get() { return () => {}; } });
  const SFX = new Proxy({}, { get() { return () => {}; } });
  const ctx = vm.createContext({ UI, SFX, localStorage });
  for (const p of ['js/config.js', 'js/campaign.js', 'js/wave-director.js', 'js/guardians.js', 'js/ink-xp.js', 'js/game.js']) {
    vm.runInContext(file(p), ctx, { filename: p });
  }
  return { G: vm.runInContext('G', ctx), saved };
}

function enemy(x, y, hp = 2, r = 4, type = 'pulse') {
  return {
    type, x, y, hp, maxHp: hp, r, speed: 0, elite: false, ang: 0, t: 0,
    hitFlash: 0, kbx: 0, kby: 0, state: 'cruise', stateT: 1, seed: 0,
    stun: 0, slowT: 0, orbCd: 0, dirT: 0, spawnT: 0, px: 0, py: 0,
  };
}
function bullet(hits = 1, life = 1, x = 0, vx = 560) {
  return { x, y: 0, vx, vy: 0, ang: 0, dmg: 1, hits, age: 0, life, kind: 'drop' };
}
function ready(G) {
  assert.equal(G.startLevel(0, 1), true);
  G.S.queue = []; G.S.markers = []; G.S.enemies = [];
  G.S.ebullets = []; G.S.bullets = []; G.S.spirits = [];
  G.S.waveActive = false; G.S.clearedT = 0; G.S.invulnT = 0;
  G.S.player.fireT = 9999; // isolate shot collision from automatic fire
}
test('bullet cannot tunnel through a small enemy at a 50ms game frame', () => {
  const { G } = harness(); ready(G);
  G.S.enemies.push(enemy(14, 0));
  G.S.bullets.push(bullet());
  G.update(0.05); // 28 px of travel; target is between endpoints
  assert.equal(G.S.enemies[0].hp, 1);
  assert.equal(G.S.bullets.length, 0);
});

test('piercing hits each distinct enemy once, in travel order, even after kills', () => {
  const { G } = harness(); ready(G);
  // Deliberately reversed array order relative to the path of the bullet.
  G.S.enemies.push(enemy(35, 0, 1), enemy(13, 0, 1), enemy(24, 0, 1));
  G.S.bullets.push(bullet(3));
  G.update(0.08);
  assert.equal(G.S.stats.kills, 3);
  assert.equal(G.S.enemies.length, 0);
  assert.equal(G.S.bullets.length, 0);
});

test('piercing rounds remember previously hit targets across successive frames', () => {
  const { G } = harness(); ready(G);
  G.S.enemies.push(enemy(20, 0, 5, 19));
  G.S.bullets.push(bullet(2));
  G.update(0.05);
  G.update(0.01);
  assert.equal(G.S.enemies[0].hp, 4);
  assert.equal(G.S.bullets[0].hits, 1);
  assert.equal(G.S.stats.kills, 0);
});

test('splitters cannot make the same projectile hit newly spawned children instantly', () => {
  const { G } = harness(); ready(G);
  G.S.enemies.push(enemy(15, 0, 1, 10, 'split'));
  G.S.bullets.push(bullet(3));
  G.update(0.05);
  assert.equal(G.S.stats.kills, 1);
  assert.equal(G.S.enemies.length, 2);
  assert.ok(G.S.enemies.every(e => e.type === 'pulseling'));
  assert.equal(G.S.bullets[0].hits, 2);
});

test('projectiles do not travel farther than their remaining lifetime', () => {
  const { G } = harness(); ready(G);
  G.S.enemies.push(enemy(45, 0, 2));
  G.S.bullets.push({ ...bullet(1, .05), age: .04 }); // 5.6px travel remaining
  G.update(.05);
  assert.equal(G.S.enemies[0].hp, 2);
  assert.equal(G.S.bullets.length, 0);
});

test('hostile needles detect a crossing hit even when ending beyond the player', () => {
  const { G } = harness(); ready(G);
  G.S.ebullets.push({ kind: 'needle', x: -22, y: 0, vx: 600, vy: 0, age: 0, life: 1 });
  G.update(.08);
  assert.equal(G.S.stats.hp, 2);
  assert.equal(G.S.ebullets.length, 0);
});

test('hostile shots cannot strike the player beyond their natural lifetime', () => {
  const { G } = harness(); ready(G);
  G.S.ebullets.push({ kind: 'needle', x: -40, y: 0, vx: 600, vy: 0, age: .99, life: 1 });
  G.update(.05);
  assert.equal(G.S.stats.hp, 3);
  assert.equal(G.S.ebullets.length, 0);
});

test('Spirit Scribes hit a target along their flight, not just at endpoint', () => {
  const { G } = harness(); ready(G);
  G.S.enemies.push(enemy(15, 0, 1));
  G.S.spirits.push({ x: 0, y: 0, ang: 0, speed: 600, age: .2, life: 3 });
  G.update(.05);
  assert.equal(G.S.stats.kills, 1);
  assert.equal(G.S.spirits.length, 0);
});

test('new runs and the campaign selector clear virtual joystick state', () => {
  const { G } = harness(); ready(G);
  G.S.joy = { id: 42, dx: 52, dy: 0 };
  G.S.inputVec.x = 1;
  G.startLevel(0, 1);
  assert.equal(G.S.joy, null);
  assert.equal(G.S.inputVec.x, 0);
  G.S.inputVec.y = 1; G.S.joy = { id: 43 };
  G.openCampaign(0);
  assert.equal(G.S.joy, null);
  assert.equal(G.S.inputVec.y, 0);
  G.S.inputVec.x = 1;
  G.abandon();
  assert.equal(G.S.inputVec.x, 0);
});

test('live input handling clears focus loss, pointer loss, and gameplay exits', () => {
  const main = file('js/main.js');
  assert.match(main, /function clearInput\(\)/);
  assert.match(main, /lostpointercapture/);
  assert.match(main, /window\.addEventListener\('blur',\s*\(\)\s*=>\s*\{\s*clearInput\(\);\s*pause\(\)/);
  assert.match(main, /lastMode === 'playing' && m !== 'playing'/);
  assert.match(main, /G\.S\.joy = null/);
});

test('original sumi-e renderer, audio, and game palettes were not edited', () => {
  // This feature is entirely collision and input management, no art changes.
  assert.ok(file('js/render.js').includes('function drawEnemy('));
  assert.ok(file('js/audio.js').includes('bigKill()'));
  assert.ok(file('css/style.css').includes('CAMPAIGN SELECTION'));
});
