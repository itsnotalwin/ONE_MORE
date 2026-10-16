'use strict';
/* ============================================================
   ONE MORE — tuning constants, ink-beast roster, upgrade pool
   Edit this file to rebalance the arena.
   ============================================================ */

const CFG = {
  arenaInset: 14,

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

  wave: {
    budget: w => 7 + w * 4,                      // spawn points per wave
    surgeEvery: 5,                               // every Nth wave is a SURGE
    surgeMult: 1.6,                              // budget multiplier on surges
    groupInterval: w => Math.max(0.45, 1.5 - w * 0.07),
    groupSize: w => 3 + Math.floor(w / 3),
    concurrentCap: w => Math.min(40, 12 + w * 2),
    hpScale: (base, w, intro) => Math.max(1, Math.round(base * (1 + 0.09 * (w - intro)))),
    spScale: (w, intro) => Math.min(1.35, 1 + 0.008 * (w - intro)),
  },

  shockwave: { radius: 230, knock: 420 },
  adrenaline: { mult: 1.22, dur: lv => 1.4 + 0.45 * (lv - 1) },

  /* new brush skills */
  orbit:   { radius: lv => 40 + lv * 5, speed: 2.7, dmgCd: 0.45 },
  nova:    { period: lv => 6.6 - 0.9 * (lv - 1), radius: lv => 165 + lv * 38, knock: 330, stun: 0.4 },
  ward:    { cd: 22 },
  slow:    { dur: 1.6, mult: 0.55 },
  crit:    { chance: lv => 0.16 * lv },

  /* enemy ink globs (the spitter's volley) */
  glob:    { speed: 215, life: 2.4, r: 5 },

  // waves cleared → rank, else 'D'
  ranks: [[15, 'S'], [11, 'A'], [7, 'B'], [3, 'C']],

  /* ---- ink engine knobs (consumed by render.js) ---- */
  ink: {
    boilRate: 0.115,        // s per hand-drawn frame (line boil)
    stainFadePerSec: 0.055, // how fast dried ink fades from the paper
    trailGap: 0.085,        // s between player ink-trail stamps
  },
};

/* The ink-born. Every creature is a living blot of sumi ink. */
const ENEMIES = {
  pulse:     { name: 'BLOT',  trait: 'DRIFTER', cost: 1, intro: 1,  hp: 2,  r: 12, speed: 92,  score: 10, shape: 'circle'  },
  dart:      { name: 'SPEAR', trait: 'LUNGER',  cost: 2, intro: 2,  hp: 1,  r: 9,  speed: 80,  score: 15, shape: 'tri'     },
  spit:      { name: 'SPIT',  trait: 'GUNNER',  cost: 3, intro: 4,  hp: 2,  r: 11, speed: 74,  score: 25, shape: 'spit'    },
  moth:      { name: 'MOTH',  trait: 'ERRATIC', cost: 2, intro: 5,  hp: 2,  r: 10, speed: 122, score: 20, shape: 'moth'    },
  split:     { name: 'DRIP',  trait: 'DIVIDER', cost: 2, intro: 6,  hp: 3,  r: 12, speed: 95,  score: 15, shape: 'diamond' },
  slab:      { name: 'BRUTE', trait: 'BRUISER', cost: 3, intro: 8,  hp: 8,  r: 17, speed: 42,  score: 30, shape: 'square'  },
  shade:     { name: 'SHADE', trait: 'PHANTOM', cost: 3, intro: 7,  hp: 3,  r: 12, speed: 88,  score: 35, shape: 'shade'   },
  wraith:    { name: 'WISP',  trait: 'WEAVER',  cost: 2, intro: 10, hp: 2,  r: 11, speed: 105, score: 20, shape: 'ring'    },
  titan:     { name: 'TITAN', trait: 'MOTHER',  cost: 5, intro: 12, hp: 18, r: 28, speed: 24,  score: 90, shape: 'titan'   },
  pulseling: { name: 'BLIP',  trait: 'SHARD',   cost: 0, intro: 6,  hp: 1,  r: 6,  speed: 150, score: 5,  shape: 'dot'     },
};

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
  { id: 'orbit',  name: 'Ink Orbit',    desc: 'A droplet circles the brush, grinding what it touches.',     max: 3, apply: s => { s.orb += 1; } },
  { id: 'nova',   name: 'Black Tide',   desc: 'Every few breaths the ink surges outward, shoving all back.', max: 3, apply: s => { s.nova += 1; } },
  { id: 'slow',   name: 'Wet Paper',    desc: 'Struck beasts wade through soaked paper — slowed briefly.',  max: 2, apply: s => { s.slow += 1; } },
  { id: 'crit',   name: 'Crimson Tip',  desc: 'One stroke in six bites twice as deep. Deeper per rank.',    max: 2, apply: s => { s.crit += 1; } },
  { id: 'ward',   name: 'Paper Ward',   desc: 'A dry talisman swallows one hit whole, then reforms.',       max: 1, apply: s => { s.ward = true; } },
];
