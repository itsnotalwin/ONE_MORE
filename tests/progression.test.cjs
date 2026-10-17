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
  for (const p of ['js/config.js', 'js/campaign.js', 'js/game.js']) {
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

test('original renderer, audio, and pre-existing CSS are frozen', () => {
  function gitBlobHash(s) {
    return crypto.createHash('sha1').update(Buffer.concat([
      Buffer.from('blob ' + Buffer.byteLength(s) + '\0'), Buffer.from(s),
    ])).digest('hex');
  }
  assert.equal(gitBlobHash(file('js/render.js')), 'af35ba9b8e7dbad5d5690749d7e3f960c8a1c74a');
  assert.equal(gitBlobHash(file('js/audio.js')), '50c75c3f74d20ff5f51232731ad8260c8881b635');
  const css = file('css/style.css');
  assert.ok(css.includes('CAMPAIGN SELECTION'));
  const original = css.slice(0, css.indexOf('\n/* ============================================================\n   CAMPAIGN SELECTION'));
  assert.equal(gitBlobHash(original), '7438ce27c87e88b507e76abcfbc45fe420ffc1db');
});
