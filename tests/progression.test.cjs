'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const file = p => fs.readFileSync(path.join(root, p), 'utf8');

function harness(deniedStorage = false) {
  const saved = new Map();
  const storage = {
    getItem(k) { if (deniedStorage) throw new Error('Storage blocked'); return saved.get(k) ?? null; },
    setItem(k, v) { if (deniedStorage) throw new Error('Storage blocked'); saved.set(k, String(v)); },
  };
  const events = { result: null };
  const UI = new Proxy({}, {
    get(_obj, k) { return (...args) => { if (k === 'showOver') events.result = args[0]; }; },
  });
  const SFX = new Proxy({}, { get() { return () => {}; } });
  const context = vm.createContext({ localStorage: storage, UI, SFX });
  for (const p of ['js/config.js', 'js/campaign.js', 'js/wave-director.js', 'js/guardians.js', 'js/game.js']) {
    vm.runInContext(file(p), context, { filename: p });
  }
  const { G, CAMPAIGN } = vm.runInContext('({ G, CAMPAIGN })', context);
  return { G, CAMPAIGN, saved, events };
}

function clearLevel(G) {
  for (let wave = 1; wave <= 10; wave++) {
    assert.equal(G.S.stats.wave, wave);
    G.S.queue = [];
    G.S.markers = [];
    G.S.enemies = [];
    G.update(0.05);
    G.update(0.60);
    if (wave !== 10) {
      assert.equal(G.mode, 'upgrade');
      G.pickAt(0);
      G.deploy();
      assert.equal(G.mode, 'playing');
    }
  }
  assert.equal(G.mode, 'over');
}

test('only the frontier level is playable and save values are clamped', () => {
  const { G, CAMPAIGN } = harness();
  assert.ok(CAMPAIGN.canPlay(0, 1));
  assert.equal(CAMPAIGN.canPlay(0, 2), false);
  assert.equal(CAMPAIGN.canPlay(1, 1), false);
  assert.equal(G.startLevel(0, 10), false);
  assert.equal(G.startLevel(1, 1), false);
  assert.equal(G.startLevel(0, 1), true);
  clearLevel(G);
  assert.equal(CAMPAIGN.read().completed[0], 1);
  assert.equal(CAMPAIGN.canPlay(0, 2), true);
  assert.equal(CAMPAIGN.canPlay(0, 3), false);
  assert.equal(G.startLevel(0, 2), true);
  assert.equal(G.S.stats.wave, 1);
  assert.equal(G.S.stats.levels.rapid, undefined);
  assert.equal(G.startLevel(0, 1), true); // Replay old levels.
});

test('failure returns to the current stage, retaining unlocks', () => {
  const { G, CAMPAIGN } = harness();
  G.startLevel(0, 1);
  // Simulate the result state after a failed run without changing campaign progress.
  G.S.mode = 'over';
  G.S.lastVictory = false;
  G.retryOrNext();
  assert.equal(G.S.level, 1);
  assert.equal(G.S.stats.wave, 1);
  assert.equal(CAMPAIGN.read().completed[0], 0);
});

test('storage-restricted sessions still advance in memory', () => {
  const { CAMPAIGN } = harness(true);
  assert.equal(CAMPAIGN.canPlay(0, 2), false);
  CAMPAIGN.complete(0, 1);
  assert.equal(CAMPAIGN.canPlay(0, 2), true);
});

test('all 30 levels, 300 waves, world mechanics, world bosses and Endless', () => {
  const { G, CAMPAIGN, events } = harness();
  let strongerBosses = 0;
  for (let world = 0; world < 3; world++) {
    assert.equal(CAMPAIGN.isWorldUnlocked(world), true);
    for (let level = 1; level <= 10; level++) {
      assert.equal(G.startLevel(world, level), true);
      assert.equal(G.S.areaIdx, world);
      for (let wave = 1; wave <= 10; wave++) {
        if (world === 0 && wave === 6) assert.ok(G.S.queue.includes('split'));
        if (world === 1 && wave === 3) assert.ok(G.S.queue.includes('shade'));
        if (world === 2 && wave === 5) assert.ok(G.S.queue.includes('oni'));
        if (wave === 10) {
          const guardian = G.S.markers.find(m => m.elite);
          assert.ok(guardian);
          assert.equal(Boolean(guardian.boss), level === 10);
          if (guardian.boss) strongerBosses++;
        }
        G.S.queue = [];
        G.S.markers = [];
        G.S.enemies = [];
        G.update(0.05);
        G.update(0.60);
        if (wave < 10) {
          assert.equal(G.mode, 'upgrade');
          G.pickAt(0);
          G.deploy();
        }
      }
      assert.equal(G.mode, 'over');
      assert.equal(events.result.waves, 10);
      assert.equal(CAMPAIGN.read().completed[world], level);
    }
  }
  assert.equal(strongerBosses, 3);
  assert.equal(CAMPAIGN.totalCompleted(), 30);
  assert.equal(events.result.finalCampaign, true);
  assert.equal(events.result.nextStage, null);
  G.continueEndless();
  assert.equal(G.mode, 'playing');
  assert.equal(G.S.runMode, 'endless');
  assert.equal(G.S.stats.wave, 1);
});

test('original artwork and sound outside the removed weapon stay unchanged', () => {
  // Hash unchanged sections from the last Hanko-freeze reference, excluding
  // *only* its weapon-specific painter/audio and the one draw call.
  const fnv = s => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  /* Phase 3 added only three guarded drawing fragments. Strip those
     additions and hash the exact original combat renderer contract. */
  let renderer = file('js/render.js');
  const bossStart = renderer.indexOf('  /* Phase 3 additions reuse');
  const bossEnd = renderer.indexOf('  function drawRing(c, r) {', bossStart);
  assert.ok(bossStart > 0 && bossEnd > bossStart);
  renderer = renderer.slice(0, bossStart) + renderer.slice(bossEnd);
  const barStart = renderer.indexOf('    /* Minimal ink-seal integrity line');
  const barEnd = renderer.indexOf('    c.restore();\n  }\n', barStart);
  assert.ok(barStart > 0 && barEnd > barStart);
  renderer = renderer.slice(0, barStart) + renderer.slice(barEnd);
  renderer = renderer.replace(
    '    for (const mark of S.guardianMarks || []) drawGuardianHazard(ctx, mark, t);\n','');
  assert.equal(fnv(renderer), '84b72d7e', 'all original gameplay rendering remains byte-for-byte intact');
  const rb = renderer.indexOf('  /* Ink Knots — thin, breathing brush threads');
  const re = renderer.indexOf('  /* spirit scribes — lesser brushes hunting alone */', rb);
  const call = '    for (const knot of S.knots) drawKnot(ctx, knot, t);';
  const rc = renderer.indexOf(call, re);
  assert.ok(rb > 0 && re > rb && rc > re);
  assert.deepEqual([
    fnv(renderer.slice(0, rb)),
    fnv(renderer.slice(re, rc)),
    fnv(renderer.slice(rc + call.length)),
  ], ['f174f6ee', 'f3a0b841', '754cf65c']);

  const audio = file('js/audio.js');
  const ab = audio.indexOf('    /* ink knots tighten like a quiet plucked thread */');
  const afterTag = '    /* the sniper fires its needle */';
  const ae = audio.indexOf(afterTag, ab);
  assert.ok(ab > 0 && ae > ab);
  assert.deepEqual([
    fnv(audio.slice(0, ab)),
    fnv(audio.slice(ae + afterTag.length)),
  ], ['624df8f1', '355365eb']);

  const css = file('css/style.css');
  assert.ok(css.includes('CAMPAIGN SELECTION'));
  const original = css.slice(0, css.indexOf('\n/* ============================================================\n   CAMPAIGN SELECTION'));
  const gitBlobHash = text => crypto.createHash('sha1').update(Buffer.concat([
    Buffer.from('blob ' + Buffer.byteLength(text) + '\0'), Buffer.from(text),
  ])).digest('hex');
  assert.equal(gitBlobHash(original), '7438ce27c87e88b507e76abcfbc45fe420ffc1db');
});

test('Ink Knots delays damage, targets at most four, and never sweeps the horde', () => {
  const { G } = harness();
  function enemy(x, y) {
    return {
      type: 'pulse', x, y, r: 12, hp: 8, maxHp: 8, speed: 0,
      elite: false, ang: 0, t: 0, hitFlash: 0, kbx: 0, kby: 0,
      state: 'cruise', stateT: 1, seed: 0, stun: 0, slowT: 0,
      orbCd: 0, dirT: 0, spawnT: 0, px: 0, py: 0,
    };
  }
  for (let rank = 1; rank <= 3; rank++) {
    assert.ok(G.startLevel(0, 1));
    G.S.stats.knot = rank;
    G.S.knotT = 0;
    G.S.player.fireT = 1000; // Isolate the weapon from normal autofire.
    G.S.queue = [];
    G.S.markers = [];
    G.S.waveActive = false;
    G.S.clearedT = 0;
    G.S.enemies = Array.from({ length: 12 }, (_, i) =>
      enemy(140 + i % 4 * 32, (Math.floor(i / 4) - 1) * 35));
    const hp = G.S.enemies.map(e => e.hp);

    G.update(0.08);
    assert.equal(G.S.knots.length, 1);
    assert.equal(G.S.knots[0].members.length, rank + 1);
    assert.equal(G.S.enemies.reduce((v, e, i) => v + hp[i] - e.hp, 0), 0, 'no instant attack');

    G.update(0.66);
    const first = G.S.enemies.reduce((v, e, i) => v + hp[i] - e.hp, 0);
    assert.equal(first, rank + 1, 'exactly one damage for each bound target');

    G.update(0.66);
    const second = G.S.enemies.reduce((v, e, i) => v + hp[i] - e.hp, 0);
    assert.equal(second, first, 'no repeated pulse / chain wipe');
    assert.ok(G.S.enemies.some(e => e.hp === 8), 'some horde members remain untouched');
    assert.ok(G.S.knots.some(k => k.members.some(e => e.slowT > 0)), 'knots slow bound enemies');
  }
  G.startLevel(0, 1);
  assert.equal(G.S.knots.length, 0, 'temporary knots reset every run');

  const cfg = file('js/config.js');
  const game = file('js/game.js');
  const ui = file('js/ui.js');
  const audio = file('js/audio.js');
  assert.ok(cfg.includes("name: 'Ink Knots'"));
  assert.ok(ui.includes('knot:'));
  assert.ok(audio.includes('knot()'));
  for (const source of [cfg, game, ui, audio, file('js/render.js')]) {
    assert.doesNotMatch(source, /hanko/i, 'no legacy Hanko weapon remains');
  }
});

test('mobile upgrade screen retains all three choices in compact grid layout', () => {
  const css = file('css/style.css');
  const mobile = css.slice(css.indexOf('UPGRADE CHOICES — keep all three'));
  assert.ok(mobile.includes('@media (max-width: 720px)'));
  assert.match(mobile, /\.screen-upgrade \.upgrade-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(mobile, /\.screen-upgrade \.up-card\s*\{\s*display:\s*grid/);
  assert.match(mobile, /\.screen-upgrade \.panel\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 16px\)/);
  assert.ok(mobile.includes('@media (min-width: 721px) and (max-height: 520px)'));
  const html = file('index.html');
  assert.ok(html.includes('id="upgradeGrid"'));
  assert.ok(html.includes('id="deployBtn"'));
});
