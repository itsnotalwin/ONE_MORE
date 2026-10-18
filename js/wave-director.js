'use strict';
/* ============================================================
   ONE MORE — WAVE DIRECTOR 2.0
   Encounter choreography, not new enemy art or power creep.
   Pure plans: no DOM, timers, renderer, persistence or Math.random.
   All 30 Journey stages have an authored identity. Endless retains
   the original randomized generator and spawning cadence.
   ============================================================ */
const WAVE_DIRECTOR = (() => {
  const LEVELS = [
    [
      ['THE FIRST MARK', 'pulse', 'dart', 'drift'],
      ['THE PAPER EDGE', 'dart', 'pulse', 'pincer'],
      ['CROSSING STROKES', 'dart', 'moth', 'cross'],
      ['THE INK WELL', 'spit', 'pulse', 'lane'],
      ['THE RESTLESS BRUSH', 'moth', 'spit', 'spiral'],
      ['DIVIDED DROPLETS', 'split', 'moth', 'pincer'],
      ['THE UNFINISHED LINE', 'split', 'spit', 'feint'],
      ['THE WEIGHT OF INK', 'slab', 'split', 'siege'],
      ['A THOUSAND MARKS', 'moth', 'split', 'surround'],
      ['FIRST SEAL', 'slab', 'split', 'siege'],
    ],
    [
      ['THE REVERSE SIDE', 'wraith', 'shade', 'drift'],
      ['WHISPERING PAPER', 'shade', 'wraith', 'feint'],
      ['FALSE FOOTSTEPS', 'kage', 'shade', 'pincer'],
      ['PALE NEEDLES', 'stilt', 'wraith', 'lane'],
      ['THE HIDDEN GATHERING', 'shade', 'kage', 'surround'],
      ['DARK CROSSING', 'kage', 'stilt', 'cross'],
      ['THE VANISHING HAND', 'shade', 'stilt', 'feint'],
      ['DRAWN FROM BEHIND', 'kage', 'moth', 'spiral'],
      ['THE UNWRITTEN CROWD', 'wraith', 'kage', 'surround'],
      ['NIGHT SEAL', 'shade', 'stilt', 'siege'],
    ],
    [
      ['THE RED MARGIN', 'slab', 'crane', 'drift'],
      ['FOLDED WINGS', 'crane', 'split', 'spiral'],
      ['CINNABAR RUSH', 'oni', 'crane', 'lane'],
      ['THE SPLIT SEAL', 'split', 'oni', 'pincer'],
      ['THE RED PROCESSION', 'oni', 'slab', 'cross'],
      ['BENEATH THE SIGNATURE', 'titan', 'slab', 'siege'],
      ['THE INK DOES NOT YIELD', 'oni', 'spit', 'feint'],
      ['CIRCLE OF CRANES', 'crane', 'titan', 'surround'],
      ['THE LAST RED LINE', 'titan', 'oni', 'pincer'],
      ['THE UNFINISHED SEAL', 'oni', 'titan', 'siege'],
    ],
  ];
  /* A stage has its own focus; each wave has a new combat beat.
     Stage pattern influences waves 3, 6, 8, 9. */
  const BEATS = [
    { pattern: 'drift', cue: 'FIRST INK', rate: 1.12, size: 0.85 },
    { pattern: 'lane', cue: 'THE LINE APPROACHES', rate: 1.06, size: 0.92 },
    { pattern: null, cue: 'THE SIDES CLOSE', rate: 1.05, size: 0.94 },
    { pattern: 'cross', cue: 'CROSSING STROKES', rate: 1, size: 1.0 },
    { pattern: 'surround', cue: 'THE INK GATHERS', rate: 0.97, size: 1.05 },
    { pattern: null, cue: 'THE OTHER FLANK', rate: 0.95, size: 1.06 },
    { pattern: 'feint', cue: 'A FALSE OPENING', rate: 1.12, size: .94 },
    { pattern: null, cue: 'THE BRUSH IS TESTED', rate: 0.93, size: 1.12 },
    { pattern: null, cue: 'THE PAGE CLOSES IN', rate: .91, size: 1.12 },
    { pattern: 'siege', cue: 'THE GUARDIAN WAKES', rate: 1.10, size: .93 },
  ];
  const SPECIALS = [
    { 6: ['split', 'split', 'split'], 9: ['split', 'split', 'split'] },
    { 3: ['shade', 'shade', 'kage'], 6: ['shade', 'shade', 'kage'], 9: ['shade', 'shade', 'kage'] },
    { 5: ['oni', 'oni', 'crane'], 9: ['oni', 'oni', 'crane'] },
  ];
  const ALLOWED_PATTERNS = ['drift', 'pincer', 'cross', 'lane', 'spiral', 'feint', 'surround', 'siege'];

  function rng(seed) {
    let a = seed | 0;
    return () => {
      a = a + 0x6d2b79f5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, random) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function level(worldIndex, levelNumber) {
    const data = LEVELS[worldIndex]?.[levelNumber - 1];
    if (!data) return null;
    return {
      title: data[0], lead: data[1], support: data[2],
      signature: data[3], worldIndex, level: levelNumber,
    };
  }
  function plan({ worldIndex, levelNumber, wave, budget, effectiveWave, roster, enemies, weights }) {
    const stage = level(worldIndex, levelNumber);
    const beat = BEATS[wave - 1];
    if (!stage || !beat) throw new Error('Invalid Journey level or wave');
    const seed = (0x5eed ^ ((worldIndex + 1) * 13007) ^
      (levelNumber * 1009) ^ (wave * 7919)) >>> 0;
    const random = rng(seed);
    const available = roster.filter(type => enemies[type] &&
      enemies[type].cost > 0 && enemies[type].intro <= effectiveWave);
    if (!available.length) throw new Error('Journey roster has no legal enemy');
    const lead = available.includes(stage.lead) ? stage.lead : available[0];
    const support = available.includes(stage.support) ? stage.support : available[0];
    const pattern = beat.pattern || stage.signature;
    const candidates = [];
    let remaining = Math.max(0, Math.round(budget));
    /* Signature enemies are prominent but never consume the whole budget.
       Neither boss HP nor player damage is modified by the director. */
    const spotlight = [lead, support, lead];
    for (const type of spotlight) {
      const cost = enemies[type].cost;
      if (remaining >= cost && cost <= budget * .34) {
        candidates.push(type);
        remaining -= cost;
      }
    }
    const pool = available.filter(type => enemies[type].cost <= budget);
    for (let guard = 0; remaining > 0 && guard < 650; guard++) {
      const legal = pool.filter(type => enemies[type].cost <= remaining);
      if (!legal.length) break;
      const total = legal.reduce((sum, type) => sum +
        (weights[type] || 1) * (type === lead ? 2.8 : type === support ? 1.8 : .7), 0);
      let roll = random() * total, chosen = legal[0];
      for (const type of legal) {
        roll -= (weights[type] || 1) * (type === lead ? 2.8 : type === support ? 1.8 : .7);
        if (roll <= 0) { chosen = type; break; }
      }
      candidates.push(chosen);
      remaining -= enemies[chosen].cost;
    }
    const extras = SPECIALS[worldIndex][wave] || [];
    for (const type of extras) {
      if (available.includes(type)) candidates.push(type);
    }
    /* Stage focus appears early, but the rest is mixed so that the level
       doesn't create a monotonous line of the same enemy. */
    const first = candidates.splice(0, Math.min(2, candidates.length));
    shuffle(candidates, random);
    const ordered = first.concat(candidates);
    return {
      stage: stage.title, lead, support, pattern, cue: beat.cue,
      seed, rate: beat.rate, size: beat.size,
      telegraph: wave >= 7 ? .78 : .70,
      /* Queue remains an array of enemy IDs for backward-compatible
         campaign tests and all existing wave / kill code. */
      queue: ordered.reverse(),
      wave, worldIndex, levelNumber, group: 0,
    };
  }
  function side(plan, group, index) {
    const base = plan.seed % 4;
    const g = Math.max(0, group | 0), i = Math.max(0, index | 0);
    switch (plan.pattern) {
      case 'pincer': return (base + (i % 2) * 2 + Math.floor(g / 2)) % 4;
      case 'lane': return (base + (Math.floor(g / 2) % 2) * 2) % 4;
      case 'cross': return (base + i * 2 + g % 2) % 4;
      case 'spiral': return (base + g + Math.floor(i / 2)) % 4;
      case 'feint': return (base + (g % 3 === 2 ? 2 : 0) + (i % 3 === 2 ? 1 : 0)) % 4;
      case 'surround': return (base + i + g) % 4;
      case 'siege': return (base + Math.floor(g / 2) + (i % 2) * 2) % 4;
      default: return (base + (g * 3) + i) % 4;
    }
  }
  return { LEVELS, BEATS, ALLOWED_PATTERNS, level, plan, side };
})();
