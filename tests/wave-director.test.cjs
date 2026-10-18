'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const file = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

function harness() {
  const data = new Map(), banners = [];
  const localStorage = {
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, String(value)); },
  };
  const UI = new Proxy({}, {
    get(_obj, key) { return (...args) => {
      if (key === 'banner') banners.push(args);
    }; },
  });
  const SFX = new Proxy({}, { get() { return () => {}; } });
  const context = vm.createContext({ localStorage, UI, SFX });
  for (const p of ['js/config.js', 'js/campaign.js', 'js/wave-director.js', 'js/guardians.js', 'js/game.js']) {
    vm.runInContext(file(p), context, { filename: p });
  }
  const dataRefs = vm.runInContext(
    '({ G, CAMPAIGN, WAVE_DIRECTOR, CFG, AREAS, ENEMIES, ENEMY_WEIGHTS })', context);
  return { ...dataRefs, banners };
}
function args(x, worldIndex, levelNumber, wave) {
  const area = x.AREAS[worldIndex];
  const surge = wave % x.CFG.wave.surgeEvery === 0 && wave !== 10;
  const budget = x.CFG.wave.budget(wave, worldIndex) * area.mult.budget *
    (1 + (levelNumber - 1) * .12) * (surge ? 1.5 : wave === 10 ? 1.2 : 1);
  return {
    worldIndex, levelNumber, wave, budget,
    effectiveWave: worldIndex * 10 + wave, roster: area.roster,
    enemies: x.ENEMIES, weights: x.ENEMY_WEIGHTS,
  };
}

test('exactly 30 unique level identities, ten waves, and eight documented spawn formations', () => {
  const x = harness(), director = x.WAVE_DIRECTOR;
  assert.equal(director.LEVELS.length, 3);
  assert.ok(director.LEVELS.every(world => world.length === 10));
  assert.equal(director.BEATS.length, 10);
  assert.equal(new Set(director.LEVELS.flat().map(stage => stage[0])).size, 30);
  assert.equal(new Set(director.ALLOWED_PATTERNS).size, 8);
  for (let w = 0; w < 3; w++) for (let l = 1; l <= 10; l++) {
    const title = director.level(w, l);
    assert.ok(title.title && title.lead && title.support);
    assert.ok(x.AREAS[w].roster.includes(title.lead));
    assert.ok(x.AREAS[w].roster.includes(title.support));
    assert.ok(director.ALLOWED_PATTERNS.includes(title.signature));
  }
});

test('all 300 planned encounters are deterministic, legal, bounded and readable', () => {
  const x = harness(), patterns = new Set(), signatures = new Set();
  for (let world = 0; world < 3; world++) {
    for (let level = 1; level <= 10; level++) {
      for (let wave = 1; wave <= 10; wave++) {
        const input = args(x, world, level, wave);
        const a = x.WAVE_DIRECTOR.plan(input);
        const b = x.WAVE_DIRECTOR.plan(input);
        assert.deepEqual(Array.from(a.queue), Array.from(b.queue));
        assert.equal(a.seed, b.seed);
        assert.equal(a.pattern, b.pattern);
        assert.equal(a.stage, x.WAVE_DIRECTOR.level(world, level).title);
        assert.ok(a.queue.length > 0 && a.queue.length < 130);
        assert.ok(a.queue.every(type =>
          input.roster.includes(type) && x.ENEMIES[type].intro <= input.effectiveWave),
          'never spawn an enemy before its world unlock');
        assert.ok(a.rate >= .85 && a.rate <= 1.2);
        assert.ok(a.size >= .8 && a.size <= 1.2);
        assert.ok(a.telegraph >= .62);
        assert.ok(a.cue && a.cue.length <= 28);
        const cost = a.queue.reduce((sum, type) => sum + x.ENEMIES[type].cost, 0);
        const extras = world === 0 && (wave === 6 || wave === 9) ? 6
          : world === 1 && [3, 6, 9].includes(wave) ? 9
          : world === 2 && [5, 9].includes(wave) ? 10 : 0;
        assert.ok(cost <= Math.round(input.budget) + extras,
          'authored encounters never inflate normal wave budgets except documented world beats');
        patterns.add(a.pattern);
        signatures.add(a.stage);
      }
    }
  }
  assert.equal(patterns.size, 8);
  assert.equal(signatures.size, 30);
});

test('original world signatures still feature on their established waves', () => {
  const x = harness();
  for (let level = 1; level <= 10; level++) {
    for (const wave of [6, 9])
      assert.ok(x.WAVE_DIRECTOR.plan(args(x, 0, level, wave)).queue.filter(t => t === 'split').length >= 3);
    for (const wave of [3, 6, 9])
      assert.ok(x.WAVE_DIRECTOR.plan(args(x, 1, level, wave)).queue.filter(t => t === 'shade').length >= 2);
    for (const wave of [5, 9])
      assert.ok(x.WAVE_DIRECTOR.plan(args(x, 2, level, wave)).queue.filter(t => t === 'oni').length >= 2);
  }
});

test('flanks are meaningful and predictable, with no position outside four supported edges', () => {
  const x = harness();
  for (const p of x.WAVE_DIRECTOR.ALLOWED_PATTERNS) {
    const wave = x.WAVE_DIRECTOR.plan(args(x, 0, 8, 8));
    wave.pattern = p;
    const sides = [];
    for (let group = 0; group < 6; group++)
      for (let i = 0; i < 5; i++) sides.push(x.WAVE_DIRECTOR.side(wave, group, i));
    assert.ok(sides.every(s => Number.isInteger(s) && s >= 0 && s < 4));
    assert.ok(new Set(sides).size >= 2, 'no unavoidable permanent one-sided spawn');
  }
});

test('Journey uses authored sequence, warns before spawning, and resets plan across runs', () => {
  const x = harness(), { G, CAMPAIGN } = x;
  assert.equal(G.startLevel(0, 1), true);
  assert.equal(G.S.wavePlan.stage, 'THE FIRST MARK');
  assert.equal(G.S.wavePlan.pattern, 'drift');
  assert.ok(G.S.queue.length > 0);
  G.S.W = 393; G.S.H = 852; G.S.player.fireT = 9999;
  G.update(1.4);
  assert.ok(G.S.markers.length > 0);
  assert.ok(G.S.markers.length <= 6);
  assert.ok(G.S.markers.every(marker =>
    Math.abs(marker.x) > G.S.W / 2 || Math.abs(marker.y) > G.S.H / 2));
  assert.ok(G.S.markers.every(marker => marker.t >= .69), 'spawn warnings remain visible');
  assert.ok(G.S.wavePlan.group >= 1);
  G.startLevel(0, 1);
  assert.equal(G.S.wavePlan.group, 0);
  assert.equal(G.S.wavePlan.stage, 'THE FIRST MARK');
  assert.equal(CAMPAIGN.read().completed[0], 0, 'encounter planning never writes campaign completion');
  G.startRun('endless');
  assert.equal(G.S.wavePlan, null, 'Endless is unchanged by the new Journey director');
});

test('campaign UI exposes level identity and wave warning cue without new artwork', () => {
  const ui = file('js/ui.js'), html = file('index.html');
  assert.ok(ui.includes('WAVE_DIRECTOR.level(selectedWorld, level)'));
  assert.ok(ui.includes('NEXT:'));
  assert.ok(ui.includes("cue || 'INCOMING'"));
  assert.ok(html.includes('<script src="./js/wave-director.js"></script>'));
  assert.ok(html.indexOf('/js/wave-director.js') < html.indexOf('/js/game.js'));
  assert.ok(file('js/render.js').includes('function drawEnemy('));
  assert.ok(!file('js/wave-director.js').includes('document.createElement'));
});
