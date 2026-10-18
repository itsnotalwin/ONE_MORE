'use strict';
/* ============================================================
   ONE MORE — tuning constants, ink-beast roster, upgrade pool,
   the three scrolls (areas) and the endless paper.
   Edit this file to rebalance the world.
   ============================================================ */

const CFG = {
  player: {
    r: 10,
    speed: 250,        // px/s
    hp: 3,
    invuln: 1.1,       // s of immunity after a hit
    fireCd: 0.42,      // s between volleys
    bulletSpeed: 560,  // px/s
    bulletLife: 0.95,  // s aloft (range = speed * life)
    spread: 0.13,      // rad between extra droplets
  },

  /* the world is unbounded — the brush walks an endless sheet */
  world: {
    spawnPad: 90,      // how far beyond the screen edge beasts are born
    stainCap: 430,     // max dried stains kept on the paper
    stainFade: 0.075,  // alpha lost per second (dried ink fades)
    decoCell: 260,     // world-cell size for ambient paper marks
  },

  wave: {
    wavesPerArea: 10,
    budget: (wInArea, areaIdx) => 7 + wInArea * 3.2 + areaIdx * 2.2,
    surgeEvery: 5,                               // every Nth wave of an area is a SURGE
    surgeMult: 1.5,
    groupInterval: w => Math.max(0.4, 1.45 - w * 0.06),
    /* Opening levels should last longer, not hit harder: space existing
       waves into small calm groups, keeping budget, HP and damage intact.
       Later First Wash levels and every subsequent paper use normal pace. */
    openingPace: (world, level) =>
      world !== 0 ? 1 : level === 1 ? 1.65 :
      level === 2 ? 1.40 : level === 3 ? 1.20 : 1,
    openingGroup: (world, level) =>
      world !== 0 ? 1 : level === 1 ? .67 :
      level === 2 ? .82 : 1,
    groupSize: (w, areaIdx) => 3 + Math.floor(w / 3) + areaIdx,
    concurrentCap: (w, areaIdx) => Math.min(64, 14 + w * 2 + areaIdx * 8),
    hpScale: (base, w, intro) => Math.max(1, Math.round(base * (1 + 0.085 * (w - intro)))),
    spScale: (w, intro) => Math.min(1.32, 1 + 0.007 * (w - intro)),
    eliteHpMult: 5.2,
    eliteR: 1.62,
  },

  /* the endless paper keeps growing teeth */
  endless: { hpGrowth: 1.14, spGrowth: 1.012, budgetGrowth: 1.16 },

  shockwave: { radius: 230, knock: 420 },
  adrenaline: { mult: 1.22, dur: lv => 1.4 + 0.45 * (lv - 1) },

  /* brush skills */
  /* The Eraser is a wide, damage-ticking absence, not orbiting bullets.
     Wide radius is earned; one damage every .8s stays below volley DPS. */
  eraser: { radius: lv => 65 + 35 * (lv - 1), dmgCd: 0.82, erasePeriod: 0.25, skim: 0.13 },
  orbit:   { radius: lv => 65 + 35 * (lv - 1), dmgCd: 0.82 }, // legacy save-compatible alias
  nova:    { period: lv => 6.6 - 0.9 * (lv - 1), radius: lv => 165 + lv * 38, knock: 330, stun: 0.4 },
  ward:    { cd: 22 },
  slow:    { dur: 1.6, mult: 0.55 },
  crit:    { chance: lv => 0.16 * lv },

  /* new weapons */
  fan:    { period: lv => 3.4 - 0.35 * (lv - 1), count: lv => 4 + lv, speed: 430, life: 0.62, spread: 1.15, dmg: 1 },
  trail: { gap: lv => [3.6,3.1,2.7][Math.min(3,Math.max(1,lv))-1], radius: lv => [30,38,46][Math.min(3,Math.max(1,lv))-1], life: lv => [2.8,3,3.2][Math.min(3,Math.max(1,lv))-1], maxPools: lv => lv===1?1:2, tick: .55, dmg: 1, slow: .8 },
  spirit: { period: lv => 3.1 - 0.3 * (lv - 1), count: lv => 1 + lv, speed: 300, turn: 7.5, life: 3.2, dmg: 1 },
  /* Ink Knots trades area damage for brief control of a few ink beasts. */
  knot: { period: lv => 7.2 - 0.35 * (lv - 1), range: 440, span: 155,
          count: lv => lv + 1, life: lv => 1.8 + 0.2 * (lv - 1),
          pulseAt: 0.72, dmg: 1 },

  /* enemy ink globs and needles */
  glob:   { speed: 215, life: 2.4, r: 5 },
  needle: { speed: 470, life: 1.7, r: 3 },

  // total waves cleared → rank, else 'D'
  ranks: [[24, 'S'], [18, 'A'], [12, 'B'], [5, 'C']],

  /* ---- ink engine knobs (consumed by render.js) ---- */
  ink: {
    boilRate: 0.115,        // s per hand-drawn frame (line boil)
    stainFadePerSec: 0.055, // legacy knob (world stains use world.stainFade)
    trailGap: 0.085,        // s between player ink-trail stamps
  },
};

/* The ink-born. Every creature is a living blot of sumi ink. */
const ENEMIES = {
  pulse:     { name: 'BLOT',   trait: 'DRIFTER',  cost: 1, intro: 1,  hp: 2,  r: 12, speed: 92,  score: 10, shape: 'circle'  },
  dart:      { name: 'SPEAR',  trait: 'LUNGER',   cost: 2, intro: 2,  hp: 1,  r: 9,  speed: 80,  score: 15, shape: 'tri'     },
  spit:      { name: 'SPIT',   trait: 'GUNNER',   cost: 3, intro: 4,  hp: 2,  r: 11, speed: 74,  score: 25, shape: 'spit'    },
  moth:      { name: 'MOTH',   trait: 'ERRATIC',  cost: 2, intro: 5,  hp: 2,  r: 10, speed: 122, score: 20, shape: 'moth'    },
  split:     { name: 'DRIP',   trait: 'DIVIDER',  cost: 2, intro: 6,  hp: 3,  r: 12, speed: 95,  score: 15, shape: 'diamond' },
  slab:      { name: 'BRUTE',  trait: 'BRUISER',  cost: 3, intro: 8,  hp: 8,  r: 17, speed: 42,  score: 30, shape: 'square'  },
  shade:     { name: 'SHADE',  trait: 'PHANTOM',  cost: 3, intro: 7,  hp: 3,  r: 12, speed: 88,  score: 35, shape: 'shade'   },
  wraith:    { name: 'WISP',   trait: 'WEAVER',   cost: 2, intro: 10, hp: 2,  r: 11, speed: 105, score: 20, shape: 'ring'    },
  titan:     { name: 'TITAN',  trait: 'MOTHER',   cost: 5, intro: 12, hp: 18, r: 28, speed: 24,  score: 90, shape: 'titan'   },
  pulseling: { name: 'BLIP',   trait: 'SHARD',    cost: 1, intro: 6,  hp: 1,  r: 6,  speed: 150, score: 5,  shape: 'dot'     },
  kage:      { name: 'KAGE',   trait: 'STALKER',  cost: 3, intro: 11, hp: 3,  r: 12, speed: 118, score: 40, shape: 'kage'    },
  stilt:     { name: 'STILT',  trait: 'SNIPER',   cost: 3, intro: 12, hp: 2,  r: 11, speed: 62,  score: 45, shape: 'stilt'   },
  oni:       { name: 'ONI',    trait: 'CHARGER',  cost: 4, intro: 21, hp: 10, r: 18, speed: 44,  score: 60, shape: 'oni'     },
  crane:     { name: 'CRANE',  trait: 'SWOOPER',  cost: 2, intro: 22, hp: 2,  r: 11, speed: 205, score: 25, shape: 'crane'   },
};

/* default weights used by the spawn roll (per roster enemy) */
const ENEMY_WEIGHTS = {
  pulse: 5, dart: 3, spit: 2.2, moth: 2.4, split: 2.1, slab: 1.5,
  shade: 1.7, wraith: 1.9, titan: 0.8, kage: 1.6, stilt: 1.4, oni: 1.2, crane: 1.8,
};

/* ------------------------------------------------------------
   THE THREE SCROLLS — each area is a different sheet of paper.
   Ten waves a sheet; the tenth bears a Guardian.
   ------------------------------------------------------------ */
const AREAS = [
  {
    id: 'I', name: 'FIRST WASH', kanji: '一', theme: 'pale',
    desc: 'Fresh washi. The first strokes land soft.',
    mult: { hp: 1, sp: 1, budget: 1 },
    roster: ['pulse', 'dart', 'spit', 'moth', 'split', 'wraith', 'slab'],
    elite: 'slab',
    mechanic: 'SPLIT BLOOM',
  },
  {
    id: 'II', name: 'NIGHT SCROLL', kanji: '夜', theme: 'dark',
    desc: 'Indigo-dyed night washi. Pale spirits can no longer hide in its grain.',
    mult: { hp: 1.65, sp: 1.09, budget: 1.48 },
    roster: ['wraith', 'shade', 'moth', 'kage', 'stilt', 'dart', 'pulseling'],
    elite: 'shade',
    mechanic: 'PHANTOM AMBUSH',
  },
  {
    id: 'III', name: 'CINNABAR FIELD', kanji: '紅', theme: 'red',
    desc: 'A vermillion wash dries underfoot. The last stroke is heaviest.',
    mult: { hp: 2.35, sp: 1.1, budget: 1.75 },
    roster: ['slab', 'spit', 'oni', 'crane', 'split', 'titan', 'kage'],
    elite: 'oni',
    mechanic: 'CRIMSON RUSH',
  },
];

const UPGRADES = [
  { id: 'rapid',  name: 'Quick Hand',   desc: '−15% time between volleys. The brush barely lifts.',         max: 5, apply: s => { s.fireCdMult *= 0.85; } },
  { id: 'heavy',  name: 'Bitter Ink',   desc: '+1 damage per droplet. Dense, dark, final.',                 max: 4, apply: s => { s.dmg += 1; } },
  { id: 'split',  name: 'Twin Stroke',  desc: '+1 droplet per volley, fanned like brush hairs.',            max: 3, apply: s => { s.shots += 1; } },
  { id: 'pierce', name: 'Through Mist', desc: 'Droplets pass through +1 target before breaking.',           max: 3, apply: s => { s.pierce += 1; } },
  { id: 'velo',   name: 'Flick',        desc: '+22% droplet speed. Reach grows with the wrist.',            max: 3, apply: s => { s.bulletSpeedMult *= 1.22; } },
  { id: 'over',   name: 'Fleeting Foot',desc: '+12% movement. Be elsewhere before the ink lands.',          max: 4, apply: s => { s.moveMult *= 1.12; } },
  { id: 'plate',  name: 'Thick Ink',    desc: '+1 max integrity and restore 1. You dilute slower.',         max: 3, apply: s => { s.maxHp += 1; s.hp = Math.min(s.maxHp, s.hp + 1); } },
  { id: 'adren',  name: 'Red Seal',     desc: 'Every kill presses a seal: a short 1.2× stride surge.',      max: 3, apply: s => { s.adren += 1; } },
  { id: 'shock',  name: 'Ink Burst',    desc: 'Taking a hit splashes everything nearby away. Once per hit.', max: 1, apply: s => { s.shock = true; } },
  { id: 'echo',   name: 'Echo Stroke',  desc: 'A mirrored volley answers behind your back. +1 droplet.',    max: 2, apply: s => { s.echo += 1; } },
  { id: 'orbit',  name: 'The Eraser',   desc: 'A distant clearing field wipes ink from the paper and gently damages beasts. Radius grows each rank.', max: 3, weapon: true, apply: s => { s.orb += 1; } },
  { id: 'nova',   name: 'Black Tide',   desc: 'Every few breaths the ink surges outward, shoving all back.', max: 3, apply: s => { s.nova += 1; } },
  { id: 'slow',   name: 'Wet Paper',    desc: 'Struck beasts wade through soaked paper — slowed briefly.',  max: 2, apply: s => { s.slow += 1; } },
  { id: 'crit',   name: 'Crimson Tip',  desc: 'One stroke in six bites twice as deep. Deeper per rank.',    max: 2, apply: s => { s.crit += 1; } },
  { id: 'ward',   name: 'Paper Ward',   desc: 'A dry talisman swallows one hit whole, then reforms.',       max: 1, apply: s => { s.ward = true; } },
  /* ---- new weapons ---- */
  { id: 'fan',    name: 'Folded Fan',   desc: 'Every few breaths the fan snaps open — a spray of paper blades.', max: 4, weapon: true, apply: s => { s.fan += 1; } },
  { id: 'trail',  name: 'Suiteki Leak', desc: 'Tip water onto an inkstone: a slow ink spill spreads, slowing and hurting enemies.', max: 3, weapon: true, apply: s => { s.trailW += 1; } },
  { id: 'spirit', name: 'Spirit Scribes',desc: 'Lesser brushes wake and hunt on their own, seeking the nearest blot.', max: 3, weapon: true, apply: s => { s.spirit += 1; } },
  { id: 'knot',   name: 'Ink Knots',     desc: 'Bind a few nearby beasts with living ink. Slow them, then deal 1 delayed damage.', max: 3, weapon: true, apply: s => { s.knot += 1; } },
];

/* Terrain painting is a reward for mastering a technique, not something
   every newly acquired weapon does. Red ink is a separate post-mastery
   choice, offered in the normal three-card rank-up interface. The starter
   ink shot is deliberately absent and never marks the paper. */
const TERRAIN_SKILL_KEYS = Object.freeze({
  echo:'echo', fan:'fan', trail:'trail', spirit:'spirit', knot:'knot',
  eraser:'orbit', nova:'nova', ward:'ward', shock:'shock',
  over:'over', plate:'plate', adren:'adren', crit:'crit', slow:'slow',
});
const RED_SEALS = Object.entries(TERRAIN_SKILL_KEYS).map(([mark, skill]) => {
  const original = UPGRADES.find(u => u.id === skill);
  return {
    id:'seal_'+skill, name:original.name+' · Vermilion',
    desc:'A final red seal. Your mastered '+original.name+
      ' now stains the paper with deep lacquer-crimson ink.',
    max:1, seal:true, weapon:!!original.weapon,
    redSealOf:skill, terrainKind:mark, requires:skill,
    apply:() => {}, /* chosen flag is stored in stats.levels by deploy() */
  };
});

