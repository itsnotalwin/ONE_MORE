'use strict';
/* ============================================================
   ONE MORE — game core: state, areas, waves, entities, weapons
   The world is an unbounded sheet of paper; the camera follows
   the brush. Three scrolls of ten waves, then the endless sheet.
   ============================================================ */

const G = (() => {
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  /* ---------------- state ---------------- */
  const S = {
    mode: 'title',
    W: 0, H: 0, dpr: 1,
    reduced: false,

    player: { x: 0, y: 0, r: CFG.player.r, aim: 0, fireT: 0, recoil: 0 },
    cam: { x: 0, y: 0 },
    stats: null,
    runMode: 'journey',            // 'journey' | 'endless'
    areaIdx: 0,
    worldIndex: 0, level: 1, lastVictory: false, nextStage: null,

    bullets: [], ebullets: [], enemies: [], markers: [], particles: [], popups: [], rings: [], idle: [],
    puddles: [], spirits: [], knots: [], guardianMarks: [],
    stainQueue: [], inkDrops: [], inkRecall: false,
    queue: [], waveInitial: 0, waveActive: false, spawnTimer: 0, clearedT: 0,
    wavePlan: null,

    invulnT: 0, adrenT: 0, shake: 0, dyingT: 0, novaT: 0, clockT: 0,
    fanT: 2.2, spiritT: 1.6, knotT: 3.6, trailT: 0,
    choices: [], selected: null,

    joy: null,
    inputVec: { x: 0, y: 0 },
  };

  function freshStats() {
    return {
      fireCdMult: 1, dmg: 1, shots: 1, pierce: 0, moveMult: 1,
      maxHp: CFG.player.hp, hp: CFG.player.hp, bulletSpeedMult: 1,
      adren: 0, shock: false, levels: {},
      echo: 0, orb: 0, nova: 0, slow: 0, crit: 0, ward: false, wardCd: 0,
      fan: 0, trailW: 0, spirit: 0, knot: 0,
      score: 0, kills: 0, time: 0, wave: 0,
      inkRank: 1, inkXp: 0, inkPending: 0, inkCollected: 0,
    };
  }

  /* ---------------- persistence ---------------- */
  const getBest = () => store.get('om_best_v1', null);
  const getRuns = () => store.get('om_runs_v1', 0);

  /* ---------------- helpers ---------------- */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* which scroll are we on, and how hard has the endless paper grown */
  function areaStateFor(w) {
    if (S.runMode === 'journey') {
      const area = AREAS[S.worldIndex];
      const difficulty = S.level - 1;
      return {
        cycle: S.worldIndex, waveInArea: w, themeIdx: S.worldIndex, area,
        effectiveWave: S.worldIndex * CFG.wave.wavesPerArea + w,
        hp: area.mult.hp * (1 + difficulty * 0.10),
        sp: area.mult.sp * (1 + difficulty * 0.012),
        budget: area.mult.budget * (1 + difficulty * 0.12),
        isElite: w === CFG.wave.wavesPerArea,
      };
    }
    const per = CFG.wave.wavesPerArea;
    const cycle = Math.floor((w - 1) / per);
    const waveInArea = ((w - 1) % per) + 1;
    const themeIdx = S.runMode === 'endless'
      ? cycle % AREAS.length
      : Math.min(cycle, AREAS.length - 1);
    const area = AREAS[themeIdx];
    let hp = area.mult.hp, sp = area.mult.sp, budget = area.mult.budget;
    if (S.runMode === 'endless' && cycle >= AREAS.length) {
      const k = cycle - (AREAS.length - 1);
      hp *= Math.pow(CFG.endless.hpGrowth, k);
      sp *= Math.pow(CFG.endless.spGrowth, k);
      budget *= Math.pow(CFG.endless.budgetGrowth, k);
    }
    return { cycle, waveInArea, themeIdx, area, hp, sp, budget, effectiveWave: w, isElite: waveInArea === per };
  }

  /* a birth point just past the edge of the eye — measured to the
     view RECTANGLE, so spawns always land off-screen on every side */
  function edgePoint(sideHint) {
    const pad = CFG.world.spawnPad;
    for (let tries = 0; tries < 10; tries++) {
      const a = (sideHint != null && tries < 2)
        ? sideHint * (Math.PI / 2) + rand(-0.35, 0.35)
        : rand(0, TAU);
      const cx = Math.cos(a), cy = Math.sin(a);
      const ax = Math.abs(cx) > 1e-4 ? (S.W / 2 + pad) / Math.abs(cx) : Infinity;
      const ay = Math.abs(cy) > 1e-4 ? (S.H / 2 + pad) / Math.abs(cy) : Infinity;
      const t = Math.min(ax, ay) + rand(10, 130);
      return { x: S.player.x + cx * t, y: S.player.y + cy * t };
    }
  }

  function burst(x, y, r, big) {
    const n = big ? 26 : Math.round(clamp(r, 6, 14)) + 4;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(50, big ? 340 : 240);
      S.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rot: rand(0, 6.28), vr: rand(-9, 9),
        size: rand(2, big ? 6 : 4.4),
        shape: ['tri', 'dot', 'line'][Math.floor(Math.random() * 3)],
        life: rand(0.3, big ? 0.9 : 0.6), max: 1,
      });
      const p = S.particles[S.particles.length - 1];
      p.max = p.life;
    }
  }

  /* ---------------- enemies ---------------- */
  function spawnEnemy(type, x, y, opts = {}) {
    const def = ENEMIES[type];
    const w = S.stats.wave;
    const st = areaStateFor(w);
    let hp = CFG.wave.hpScale(def.hp, st.effectiveWave, def.intro) * st.hp;
    let r = def.r;
    let speed = def.speed * CFG.wave.spScale(st.effectiveWave, def.intro) * st.sp;
    if (opts.elite) {
      hp = Math.round(hp * CFG.wave.eliteHpMult);
      r = Math.round(r * CFG.wave.eliteR);
      speed *= 0.86;
      if (opts.boss) { hp *= 1.8; r = Math.round(r * 1.2); }
    }
    hp = Math.max(1, Math.round(hp));
    const e = {
      type, x, y, r, hp, maxHp: hp,
      speed, elite: !!opts.elite,
      ang: Math.atan2(S.player.y - y, S.player.x - x),
      t: rand(0, 10), hitFlash: 0, kbx: 0, kby: 0,
      state: 'cruise', stateT: rand(0.3, 1.5), seed: rand(0, 6.28), stun: 0,
      slowT: 0, orbCd: 0, dirT: 0, spawnT: type === 'titan' ? 2.5 : 0,
      px: 0, py: 0, // kage perch / crane pass target
      guardian: opts.elite ? {
        world: st.themeIdx, boss: !!opts.boss, phase: 1,
        cast: 0, cooldown: opts.boss ? 2.6 : 3.0,
      } : null,
    };
    S.enemies.push(e);
    S.rings.push({ x, y, max: r * 2.4, life: 0.3, maxLife: 0.3 });
    return e;
  }

  function killEnemy(e) {
    /* A fallen Guardian cannot leave unavoidable delayed attacks behind. */
    if (e.guardian) S.guardianMarks = S.guardianMarks.filter(m => m.owner !== e);
    const def = ENEMIES[e.type];
    const mult = 1 + 0.15 * Math.max(0, areaStateFor(S.stats.wave).effectiveWave - 1);
    const pts = Math.round((def.score * mult * (e.elite ? 6 : 1)) / 5) * 5;
    S.stats.score += pts;
    S.stats.kills++;
    UI.setScore(S.stats.score);
    S.popups.push({
      x: e.x, y: e.y - e.r - 4,
      txt: e.elite ? 'GUARDIAN +' + pts : '+' + pts,
      life: e.elite ? 1.4 : 0.7, max: e.elite ? 1.4 : 0.7, red: e.elite,
    });
    burst(e.x, e.y, e.r, e.type === 'titan' || e.elite);
    S.stainQueue.push({
      x: e.x, y: e.y, r: e.r * (e.elite ? 2.2 : 1.45),
      alpha: e.elite ? 0.6 : 0.5,
      red: e.elite || e.type === 'oni',
    });
    /* The living heart of the stain can be reclaimed. The dried splat
       remains on the paper as a visual record of the battle. */
    INK_XP.drop(S.inkDrops, e.x, e.y,
      INK_XP.value(def, e, { wave:S.stats.wave, worldIndex:S.worldIndex, level:S.level }),
      !!e.elite, S.stats.kills);
    if (e.type === 'slab' || e.type === 'titan' || e.type === 'oni' || e.elite) SFX.bigKill(); else SFX.kill();
    if (e.elite) { S.shake = Math.max(S.shake, 9); }
    if (e.type === 'split') {
      for (const s of [-1, 1]) {
        const c = spawnEnemy('pulseling', e.x + s * 10, e.y + rand(-6, 6));
        c.kbx = s * 190; c.kby = rand(-70, 70);
      }
    }
    if (e.type === 'titan') {
      /* the mother bursts — her brood scatters */
      for (let i = 0; i < 3; i++) {
        const a = rand(0, 6.28);
        const c = spawnEnemy('pulseling', e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20);
        c.kbx = Math.cos(a) * 230; c.kby = Math.sin(a) * 230;
      }
    }
    if (S.stats.adren > 0) S.adrenT = CFG.adrenaline.dur(S.stats.adren);
  }

  function nearestEnemy(x, y, maxD) {
    const p = (x == null) ? S.player : { x, y };
    let best = null, bd = maxD != null ? maxD * maxD : Infinity;
    for (const e of S.enemies) {
      const dx = e.x - p.x, dy = e.y - p.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /* ---------------- waves ---------------- */
  function buildQueue(budget, wave, roster) {
    const pool = roster.filter(k => ENEMIES[k].cost > 0 && ENEMIES[k].intro <= wave);
    const q = [];
    let guard = 0;
    while (budget > 0 && guard++ < 700) {
      const avail = pool.filter(k => ENEMIES[k].cost <= budget);
      if (!avail.length) break;
      let total = 0;
      for (const k of avail) total += (ENEMY_WEIGHTS[k] || 1);
      let r = Math.random() * total, pick = avail[0];
      for (const k of avail) { r -= (ENEMY_WEIGHTS[k] || 1); if (r <= 0) { pick = k; break; } }
      q.push(pick);
      budget -= ENEMIES[pick].cost;
    }
    return shuffle(q);
  }

  function startWave(n) {
    S.inkRecall = false;
    S.guardianMarks = [];
    const st = S.stats;
    st.wave = n;
    const as = areaStateFor(n);
    S.areaIdx = as.themeIdx;
    const surge = !as.isElite && as.waveInArea % CFG.wave.surgeEvery === 0;
    let budget = CFG.wave.budget(as.waveInArea, as.cycle) * as.budget;
    if (surge) budget *= CFG.wave.surgeMult;
    if (as.isElite) budget *= 1.2;
    /* Journey: each of 30 levels has a distinct encounter score.
       Endless: preserve the historical random queue and side behavior. */
    S.wavePlan = S.runMode === 'journey'
      ? WAVE_DIRECTOR.plan({
          worldIndex: S.worldIndex,
          levelNumber: S.level,
          wave: n,
          budget,
          effectiveWave: as.effectiveWave,
          roster: as.area.roster,
          enemies: ENEMIES,
          weights: ENEMY_WEIGHTS,
        })
      : null;
    S.queue = S.wavePlan
      ? S.wavePlan.queue.slice()
      : buildQueue(Math.round(budget), as.effectiveWave, as.area.roster);
    S.waveInitial = S.queue.length + (as.isElite ? 1 : 0);
    S.waveActive = true;
    S.spawnTimer = S.wavePlan ? S.wavePlan.rate : 1.0;
    S.clearedT = 0;
    UI.setWave(as.waveInArea);
    UI.setArea(as.area, as.waveInArea, as.isElite);
    UI.setProgress(0);
    if (as.waveInArea === 1) {
      /* the scroll turns — a new sheet of paper */
      UI.areaBanner(as.area, as.cycle, S.runMode === 'endless' && as.cycle >= AREAS.length, S.runMode === 'journey' ? S.level : null);
      SFX.gong();
    } else {
      UI.banner(as.waveInArea, surge, as.isElite, S.runMode === 'journey' && S.level === CAMPAIGN.LEVELS_PER_WORLD,
        S.wavePlan?.cue || null);
      SFX.wave(surge || as.isElite);
    }
    if (as.isElite) {
      /* the Guardian of the sheet enters */
      const pt = edgePoint();
      S.markers.push({ type: as.area.elite, x: pt.x, y: pt.y, t: 1.7, elite: true,
        boss: S.runMode === 'journey' && S.level === CAMPAIGN.LEVELS_PER_WORLD });
    }
  }

  function pickUpgrades(n) {
    const st = S.stats;
    const avail = shuffle(UPGRADES.filter(u => (st.levels[u.id] || 0) < u.max));
    const out = avail.slice(0, n);
    let i = 0;
    while (out.length < n) {
      const k = i++;
      out.push({
        id: 'patch' + k, name: 'Fresh Water', patch: true,
        desc: 'Restore 1 integrity. Clean water for a tired brush.',
        apply: s => { s.hp = Math.min(s.maxHp, s.hp + 1); },
      });
    }
    return out;
  }

  function openUpgrade() {
    if (S.mode !== 'playing' || S.stats.inkPending <= 0) return;
    S.mode = 'upgrade';
    /* globs still aloft settle into the paper */
    for (const b of S.ebullets) S.stainQueue.push({ x: b.x, y: b.y, r: 2.4, alpha: 0.22 });
    S.ebullets.length = 0;
    S.choices = pickUpgrades(3);
    S.selected = null;
    const as = areaStateFor(S.stats.wave);
    UI.setUpgradeHeader(as.waveInArea, as.area, S.stats.wave + 1, 'ink', S.stats.inkRank);
    UI.fillUpgrades(S.choices, S.stats.levels);
    UI.markSelected(null);
    const nxt = areaStateFor(S.stats.wave + 1);
    UI.setDeploy(false, nxt.waveInArea === 1 ? nxt.area : null, nxt.waveInArea, nxt.cycle, S.waveActive);
    UI.show('upgrade');
    SFX.wave();
  }

  /* ---------------- flow ---------------- */
  function startRun(mode, worldIndex = 0, level = 1) {
    if (mode !== 'endless' && !CAMPAIGN.canPlay(worldIndex, level)) return false;
    S.runMode = mode === 'endless' ? 'endless' : 'journey';
    S.worldIndex = S.runMode === 'endless' ? 0 : worldIndex;
    S.level = S.runMode === 'endless' ? 1 : level;
    S.lastVictory = false;
    S.nextStage = null;
    S.stats = freshStats();
    S.bullets = []; S.ebullets = []; S.enemies = []; S.markers = [];
    S.particles = []; S.popups = []; S.rings = []; S.stainQueue = [];
    S.inkDrops = []; S.inkRecall = false;
    S.puddles = []; S.spirits = []; S.knots = []; S.guardianMarks = [];
    S.queue = []; S.wavePlan = null; S.waveInitial = 0; S.waveActive = false;
    S.invulnT = 0; S.adrenT = 0; S.shake = 0; S.dyingT = 0; S.novaT = 0;
    S.fanT = 2.2; S.spiritT = 1.6; S.knotT = 3.6; S.trailT = 0;
    S.choices = []; S.selected = null; S.idle = [];
    /* Each run begins with neutral controls, even after a lost pointer event. */
    S.joy = null;
    S.inputVec.x = 0; S.inputVec.y = 0;
    S.clockT = 0; clockT = 0;
    S.areaIdx = S.worldIndex;

    const runs = getRuns() + 1;
    store.set('om_runs_v1', runs);

    const p = S.player;
    p.x = 0; p.y = 0;
    p.fireT = 0.3; p.recoil = 0;
    S.cam.x = 0; S.cam.y = 0;

    UI.show(null);
    UI.hud(true);
    UI.setMode(S.runMode, S.level);
    UI.setScore(0);
    UI.setInkProgress(S.stats.inkRank, S.stats.inkXp, INK_XP.needed(S.stats.inkRank), true);
    UI.setHp(S.stats.hp, S.stats.maxHp);
    UI.setLoadout({});
    S.mode = 'playing';
    startWave(1);
    return true;
  }

  function startLevel(worldIndex, level) { return startRun('journey', worldIndex, level); }

  function openCampaign(worldIndex = S.worldIndex) {
    S.joy = null;
    S.inputVec.x = 0; S.inputVec.y = 0;
    const progress = CAMPAIGN.read();
    if (!CAMPAIGN.isWorldUnlocked(worldIndex, progress)) worldIndex = 0;
    S.worldIndex = worldIndex;
    S.mode = 'select';
    UI.hud(false);
    UI.renderCampaign(progress, worldIndex);
    UI.show('select');
    initAttract();
  }

  function retryOrNext() {
    if (S.mode !== 'over') return;
    if (S.runMode === 'endless') return startRun('endless');
    if (!S.lastVictory) return startLevel(S.worldIndex, S.level);
    if (!S.nextStage) return openCampaign(S.worldIndex);
    return startLevel(S.nextStage.worldIndex, S.nextStage.level);
  }

  function continueEndless() {
    if (S.mode !== 'over') return;
    startRun('endless');
  }

  function abandon() {
    S.mode = 'title';
    S.joy = null;
    S.inputVec.x = 0; S.inputVec.y = 0;
    S.bullets = []; S.ebullets = []; S.enemies = []; S.markers = [];
    S.particles = []; S.popups = []; S.rings = []; S.stainQueue = []; S.queue = [];
    S.inkDrops = []; S.inkRecall = false;
    S.puddles = []; S.spirits = []; S.knots = []; S.guardianMarks = [];
    UI.hud(false);
    UI.show('title');
    UI.setBest(getBest());
    UI.setRunNo(getRuns() + 1);
    initAttract();
  }

  function deploy() {
    if (S.mode !== 'upgrade' || S.selected == null) return;
    const u = S.choices[S.selected];
    u.apply(S.stats);
    if (!u.patch) S.stats.levels[u.id] = (S.stats.levels[u.id] || 0) + 1;
    UI.setHp(S.stats.hp, S.stats.maxHp);
    UI.setLoadout(S.stats.levels);
    S.stats.inkPending = Math.max(0, S.stats.inkPending - 1);
    SFX.deploy();
    UI.show(null);
    S.mode = 'playing';
    /* XP choices resume the same fight rather than skipping waves.
       A burst of absorbed ink can queue more than one choice. */
    if(S.stats.inkPending > 0) openUpgrade();
    else if(!S.waveActive && S.clearedT <= 0) {
      /* Last ink was absorbed after the victory pause. Continue exactly
         once after the player has accepted every earned upgrade. */
      if(S.runMode === 'journey' && S.stats.wave >= CAMPAIGN.WAVES_PER_LEVEL) showOver(true);
      else startWave(S.stats.wave + 1);
    }
  }

  function pickAt(i) {
    if (S.mode !== 'upgrade') return;
    const u = S.choices[i];
    if (!u) return;
    if (S.selected === i) { deploy(); return; }
    S.selected = i;
    UI.markSelected(i);
    const nxt = areaStateFor(S.stats.wave + 1);
    UI.setDeploy(true, nxt.waveInArea === 1 ? nxt.area : null, nxt.waveInArea, nxt.cycle, S.waveActive);
    SFX.pick();
  }

  function die() {
    S.mode = 'dying';
    S.dyingT = 1.05;
    S.shake = S.reduced ? 0 : 13;
    burst(S.player.x, S.player.y, 16, true);
    /* the brush spills everything it has left */
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 70;
      S.stainQueue.push({
        x: S.player.x + Math.cos(a) * d,
        y: S.player.y + Math.sin(a) * d,
        r: 9 + Math.random() * 22, alpha: 0.6,
      });
    }
    SFX.over();
  }

  function showOver(victory) {
    const st = S.stats;
    const cleared = victory ? st.wave : Math.max(0, st.wave - 1);
    S.lastVictory = !!victory;
    S.nextStage = null;
    if (victory && S.runMode === 'journey') {
      CAMPAIGN.complete(S.worldIndex, S.level);
      S.nextStage = CAMPAIGN.next(S.worldIndex, S.level);
    }
    let rank = 'D';
    const ranks = S.runMode === 'journey' ? [[10, 'S'], [8, 'A'], [6, 'B'], [3, 'C']] : CFG.ranks;
    for (const [min, r] of ranks) { if (cleared >= min) { rank = r; break; } }
    const best = getBest();
    const nb = st.score > (best ? best.score : 0);
    if (nb) store.set('om_best_v1', { score: st.score, wave: cleared });
    if (victory) SFX.victory();
    UI.showOver({
      run: getRuns(), waves: cleared, kills: st.kills,
      time: st.time, score: st.score, rank, inkRank: st.inkRank, newBest: nb,
      mode: S.runMode, victory: !!victory,
      worldIndex: S.worldIndex, level: S.level, nextStage: S.nextStage,
      finalCampaign: S.runMode === 'journey' && !S.nextStage,
    });
    UI.hud(false);
    UI.show('over');
    S.mode = 'over';
  }

  function takeHit() {
    const st = S.stats;
    /* the paper ward drinks the blow */
    if (st.ward && st.wardCd <= 0) {
      st.wardCd = CFG.ward.cd;
      S.invulnT = Math.max(S.invulnT, 0.7);
      burst(S.player.x, S.player.y, 12, false);
      S.rings.push({ x: S.player.x, y: S.player.y, max: 64, life: 0.32, maxLife: 0.32 });
      S.shake = Math.max(S.shake, 4);
      SFX.ward();
      return;
    }
    st.hp--;
    S.invulnT = CFG.player.invuln;
    if (!S.reduced) S.shake = 8;
    for (let i = 0; i < 3; i++) {
      S.stainQueue.push({
        x: S.player.x + (Math.random() - 0.5) * 26,
        y: S.player.y + (Math.random() - 0.5) * 26,
        r: 4 + Math.random() * 7, alpha: 0.42,
      });
    }
    UI.flash();
    UI.setHp(st.hp, st.maxHp);
    SFX.hurt();
    if (st.shock) {
      S.rings.push({ x: S.player.x, y: S.player.y, max: CFG.shockwave.radius, life: 0.45, maxLife: 0.45 });
      for (const e of S.enemies) {
        const dx = e.x - S.player.x, dy = e.y - S.player.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < CFG.shockwave.radius) {
          const k = CFG.shockwave.knock * (1 - d / CFG.shockwave.radius + 0.3);
          e.kbx += (dx / d) * k;
          e.kby += (dy / d) * k;
          e.stun = Math.max(e.stun, 0.5);
        }
      }
    }
    if (st.hp <= 0) die();
  }

  /* ---------------- weapons: the new strokes ---------------- */
  function fireFan() {
    const p = S.player, st = S.stats;
    const n = CFG.fan.count(st.fan);
    const spread = CFG.fan.spread;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
      const a = p.aim + off;
      S.bullets.push({
        x: p.x + Math.cos(a) * 13, y: p.y + Math.sin(a) * 13,
        vx: Math.cos(a) * CFG.fan.speed, vy: Math.sin(a) * CFG.fan.speed,
        ang: a, dmg: CFG.fan.dmg, hits: 2, age: 0, life: CFG.fan.life,
        kind: 'blade', spin: (i % 2 ? 1 : -1) * rand(9, 14),
      });
    }
    SFX.fan();
  }

  function dropTrail() {
    const st = S.stats;
    S.puddles.push({
      x: S.player.x + rand(-4, 4), y: S.player.y + rand(-4, 4),
      r: CFG.trail.radius(st.trailW), life: CFG.trail.life, max: CFG.trail.life,
      tickT: 0.1, seed: (Math.random() * 1e9) | 0,
    });
    if (S.puddles.length > 26) S.puddles.shift();
  }

  function fireSpirits() {
    const st = S.stats;
    for (let i = 0; i < CFG.spirit.count(st.spirit); i++) {
      const a = rand(0, TAU);
      S.spirits.push({
        x: S.player.x + Math.cos(a) * 12, y: S.player.y + Math.sin(a) * 12,
        ang: a, speed: CFG.spirit.speed * rand(0.9, 1.1),
        age: 0, life: CFG.spirit.life, seed: (Math.random() * 1e9) | 0,
      });
    }
    SFX.spirit();
  }

  /* Bind a small nearby cluster, not the entire horde. */
  function castKnot() {
    const anchor = nearestEnemy(S.player.x, S.player.y, CFG.knot.range);
    if (!anchor) { S.knotT = 0.6; return; }
    const span2 = CFG.knot.span * CFG.knot.span;
    const members = [anchor];
    const nearby = S.enemies.filter(e => {
      if (e === anchor) return false;
      const dx = e.x - anchor.x, dy = e.y - anchor.y;
      return dx * dx + dy * dy <= span2;
    }).sort((a, b) =>
      ((a.x - anchor.x) ** 2 + (a.y - anchor.y) ** 2) -
      ((b.x - anchor.x) ** 2 + (b.y - anchor.y) ** 2));
    members.push(...nearby.slice(0, CFG.knot.count(S.stats.knot) - 1));
    S.knots.push({
      members, life: CFG.knot.life(S.stats.knot),
      max: CFG.knot.life(S.stats.knot), pulseT: CFG.knot.pulseAt,
      pulsed: false, seed: (Math.random() * 1e9) | 0,
    });
    S.knotT = CFG.knot.period(S.stats.knot);
    SFX.knot();
  }

  /* A brief slow plus one delayed point per chosen target.
     Level upgrades add targets, never large-area instant damage. */
  function updateKnots(dt) {
    for (let i = S.knots.length - 1; i >= 0; i--) {
      const knot = S.knots[i];
      knot.life -= dt;
      knot.pulseT -= dt;
      knot.members = knot.members.filter(e => S.enemies.includes(e));
      if (knot.life <= 0 || !knot.members.length) {
        S.knots.splice(i, 1);
        continue;
      }
      for (const e of knot.members) e.slowT = Math.max(e.slowT, 0.20);
      if (!knot.pulsed && knot.pulseT <= 0) {
        knot.pulsed = true;
        for (const e of knot.members) {
          const idx = S.enemies.indexOf(e);
          if (idx === -1) continue;
          e.hp -= CFG.knot.dmg;
          e.hitFlash = Math.max(e.hitFlash, 0.08);
          if (e.hp <= 0) {
            S.enemies.splice(idx, 1);
            killEnemy(e);
          }
        }
        SFX.hit();
      }
    }
  }

  /* ---------------- updates ---------------- */
  function updatePlayer(dt) {
    const p = S.player, st = S.stats;
    let vx = S.inputVec.x, vy = S.inputVec.y;
    const m = Math.hypot(vx, vy);
    if (m > 1) { vx /= m; vy /= m; }
    const sp = CFG.player.speed * st.moveMult * (S.adrenT > 0 ? CFG.adrenaline.mult : 1);
    p.x += vx * sp * dt;
    p.y += vy * sp * dt;
    /* the sheet is endless — nothing clamps the brush */

    /* the camera drifts after the brush */
    const k = 1 - Math.exp(-7.5 * dt);
    S.cam.x += (p.x - S.cam.x) * k;
    S.cam.y += (p.y - S.cam.y) * k;

    if (S.adrenT > 0) S.adrenT -= dt;
    if (S.invulnT > 0) S.invulnT -= dt;
    if (st.wardCd > 0) st.wardCd -= dt;
    if (p.recoil > 0) p.recoil -= dt * 14;

    /* black tide: the ink breathes outward on its own rhythm */
    if (st.nova > 0) {
      if (S.novaT <= 0) S.novaT = CFG.nova.period(st.nova);
      S.novaT -= dt;
      if (S.novaT <= 0) fireNova();
    }

    /* folded fan: a spray of paper blades */
    if (st.fan > 0) {
      S.fanT -= dt;
      if (S.fanT <= 0) { S.fanT = CFG.fan.period(st.fan); if (nearestEnemy()) fireFan(); }
    }

    /* ink trail: smears that bite */
    if (st.trailW > 0) {
      S.trailT -= dt;
      if (S.trailT <= 0 && m > 0.25) { S.trailT = CFG.trail.gap(st.trailW); dropTrail(); }
    }

    /* spirit scribes: lesser brushes that hunt alone */
    if (st.spirit > 0) {
      S.spiritT -= dt;
      if (S.spiritT <= 0) { S.spiritT = CFG.spirit.period(st.spirit); if (nearestEnemy()) fireSpirits(); }
    }

    /* ink knots: selective control of the nearest cluster */
    if (st.knot > 0) {
      S.knotT -= dt;
      if (S.knotT <= 0) castKnot();
    }

    /* ink orbit: droplets grind what they graze */
    if (st.orb > 0) {
      const orbR = CFG.orbit.radius(st.orb);
      const base = G_time();
      for (let i = 0; i < st.orb; i++) {
        const a = base * CFG.orbit.speed + (i / st.orb) * TAU;
        const ox = p.x + Math.cos(a) * orbR, oy = p.y + Math.sin(a) * orbR;
        for (let kk = S.enemies.length - 1; kk >= 0; kk--) {
          const e = S.enemies[kk];
          if (e.orbCd > 0) continue;
          const dx = e.x - ox, dy = e.y - oy;
          const rr = e.r + 5.5;
          if (dx * dx + dy * dy <= rr * rr) {
            e.hp -= 1;
            e.orbCd = CFG.orbit.dmgCd;
            e.hitFlash = 0.08;
            const d = Math.hypot(dx, dy) || 1;
            e.kbx += (dx / d) * 170; e.kby += (dy / d) * 170;
            SFX.hit();
            if (e.hp <= 0) { S.enemies.splice(kk, 1); killEnemy(e); }
            break;
          }
        }
      }
    }

    p.fireT -= dt;
    if (p.fireT <= 0) {
      const tgt = nearestEnemy();
      if (tgt) {
        p.aim = Math.atan2(tgt.y - p.y, tgt.x - p.x);
        fireVolley();
        p.fireT = CFG.player.fireCd * st.fireCdMult;
      } else {
        p.fireT = 0.08;
      }
    }
  }

  const TAU = Math.PI * 2;
  let clockT = 0; /* driven from update(); used for orbital phase */
  function G_time() { return clockT; }
  function fireNova() {
    const st = S.stats;
    const rad = CFG.nova.radius(st.nova);
    S.rings.push({ x: S.player.x, y: S.player.y, max: rad, life: 0.5, maxLife: 0.5 });
    for (let k = S.enemies.length - 1; k >= 0; k--) {
      const e = S.enemies[k];
      const dx = e.x - S.player.x, dy = e.y - S.player.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < rad) {
        const k2 = CFG.nova.knock * (1 - d / rad + 0.3);
        e.kbx += (dx / d) * k2;
        e.kby += (dy / d) * k2;
        e.stun = Math.max(e.stun, CFG.nova.stun);
        e.hp -= 1;
        e.hitFlash = 0.08;
        if (e.hp <= 0) { S.enemies.splice(k, 1); killEnemy(e); }
      }
    }
    S.shake = Math.max(S.shake, 3);
    SFX.nova();
  }

  function fireVolley() {
    const p = S.player, st = S.stats;
    const n = st.shots;
    const spread = CFG.player.spread * (n - 1);
    const spd = CFG.player.bulletSpeed * st.bulletSpeedMult;
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
      const a = p.aim + off;
      S.bullets.push({
        x: p.x + Math.cos(a) * 13, y: p.y + Math.sin(a) * 13,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        ang: a, dmg: st.dmg, hits: 1 + st.pierce, age: 0, life: CFG.player.bulletLife,
        kind: 'drop',
      });
    }
    /* echo stroke: the mirrored volley answers from behind */
    if (st.echo > 0) {
      const en = st.echo;
      const espread = 0.24 * (en - 1);
      for (let i = 0; i < en; i++) {
        const off = en === 1 ? 0 : -espread / 2 + (espread * i) / (en - 1);
        const a = p.aim + Math.PI + off;
        S.bullets.push({
          x: p.x + Math.cos(a) * 13, y: p.y + Math.sin(a) * 13,
          vx: Math.cos(a) * spd * 0.92, vy: Math.sin(a) * spd * 0.92,
          ang: a, dmg: st.dmg, hits: 1 + st.pierce, age: 0, life: CFG.player.bulletLife,
          kind: 'drop',
        });
      }
    }
    p.recoil = 1;
    SFX.shoot();
  }

  /* A projectile can cover 28+ pixels in one 50ms phone frame.
     Store its true traveled segment instead of sampling the endpoint. */
  function moveBullets(dt, expire = true) {
    for (let i = S.bullets.length - 1; i >= 0; i--) {
      const b = S.bullets[i];
      b.prevX = b.x; b.prevY = b.y;
      const travel = Math.max(0, Math.min(dt, b.life - b.age));
      b.x += b.vx * travel; b.y += b.vy * travel; b.age += dt;
      if (expire && b.age > b.life) {
        S.stainQueue.push({ x: b.x, y: b.y, r: 2.6, alpha: 0.3 });
        S.bullets.splice(i, 1);
      }
    }
  }

  /* Earliest entry time of a line segment into a circular hitbox.
     t=0 also covers a bullet spawned inside its target. */
  function segmentCircleHit(x0, y0, x1, y1, cx, cy, radius) {
    const vx = x1 - x0, vy = y1 - y0;
    const dx = x0 - cx, dy = y0 - cy;
    const c = dx * dx + dy * dy - radius * radius;
    if (c <= 0) return 0;
    const a = vx * vx + vy * vy;
    if (a <= 1e-10) return null;
    const b = 2 * (dx * vx + dy * vy);
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : null;
  }

  function damageEnemy(e, idx, dmg, knock, ang) {
    const st = S.stats;
    const critCh = CFG.crit.chance(st.crit);
    let d = dmg;
    if (critCh > 0 && Math.random() < critCh) {
      d *= 2;
      S.popups.push({ x: e.x, y: e.y - e.r - 6, txt: '×2', life: 0.55, max: 0.55, red: true });
    }
    if (st.slow > 0) e.slowT = CFG.slow.dur;
    e.hp -= d;
    e.hitFlash = 0.08;
    if (knock) {
      const kf = e.elite ? 0.15 : (e.type === 'slab' || e.type === 'oni' ? 0.12 : 0.55);
      e.kbx += Math.cos(ang) * 240 * kf;
      e.kby += Math.sin(ang) * 240 * kf;
    }
    if (e.hp <= 0) {
      S.enemies.splice(idx, 1);
      killEnemy(e);
      return true;
    }
    return false;
  }

  function updateBullets(dt) {
    /* Delaying expiry until after collision lets a bullet hit an enemy at
       the end of its lifespan without traveling beyond its range. */
    moveBullets(dt, false);
    for (let i = S.bullets.length - 1; i >= 0; i--) {
      const b = S.bullets[i];
      const x0 = b.prevX, y0 = b.prevY;
      const contacts = [];
      const alreadyHit = b.hitEnemies || (b.hitEnemies = new Set());
      /* Snapshot the targets so a dying splitter cannot inject its new
         children into the same shot's collision pass. */
      for (const e of S.enemies) {
        if (alreadyHit.has(e)) continue;
        const time = segmentCircleHit(x0, y0, b.x, b.y, e.x, e.y, e.r + 3);
        if (time !== null) contacts.push({ e, time });
      }
      contacts.sort((a, b) => a.time - b.time);
      let spent = false;
      for (const { e, time } of contacts) {
        const index = S.enemies.indexOf(e);
        if (index === -1) continue; // removed by a prior kill effect
        alreadyHit.add(e);
        SFX.hit();
        b.hits--;
        damageEnemy(e, index, b.dmg, true, Math.atan2(b.vy, b.vx));
        if (b.hits <= 0) {
          const hx = x0 + (b.x - x0) * time;
          const hy = y0 + (b.y - y0) * time;
          if (b.kind === 'blade') burst(hx, hy, 3, false);
          S.bullets.splice(i, 1);
          spent = true;
          break;
        }
      }
      if (!spent && b.age > b.life) {
        S.stainQueue.push({ x: b.x, y: b.y, r: 2.6, alpha: 0.3 });
        S.bullets.splice(i, 1);
      }
    }
  }

  function updatePuddles(dt) {
    for (let i = S.puddles.length - 1; i >= 0; i--) {
      const pd = S.puddles[i];
      pd.life -= dt;
      pd.tickT -= dt;
      if (pd.life <= 0) {
        S.stainQueue.push({ x: pd.x, y: pd.y, r: pd.r * 0.5, alpha: 0.16 });
        S.puddles.splice(i, 1);
        continue;
      }
      if (pd.tickT <= 0) {
        pd.tickT = CFG.trail.tick;
        let bit = false;
        for (let j = S.enemies.length - 1; j >= 0; j--) {
          const e = S.enemies[j];
          const dx = e.x - pd.x, dy = e.y - pd.y;
          const rr = e.r + pd.r * 0.85;
          if (dx * dx + dy * dy <= rr * rr) {
            e.slowT = Math.max(e.slowT, 0.55);
            e.hp -= CFG.trail.dmg;
            e.hitFlash = 0.07;
            bit = true;
            if (e.hp <= 0) { S.enemies.splice(j, 1); killEnemy(e); }
          }
        }
        if (bit && Math.random() < 0.5) SFX.hit();
      }
    }
  }

  function updateSpirits(dt) {
    for (let i = S.spirits.length - 1; i >= 0; i--) {
      const sp = S.spirits[i];
      sp.age += dt;
      if (sp.age > sp.life) {
        S.stainQueue.push({ x: sp.x, y: sp.y, r: 2.2, alpha: 0.2 });
        S.spirits.splice(i, 1);
        continue;
      }
      /* home toward the nearest beast */
      const tgt = nearestEnemy(sp.x, sp.y, 640);
      if (tgt) {
        const want = Math.atan2(tgt.y - sp.y, tgt.x - sp.x);
        let diff = want - sp.ang;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        const turn = CFG.spirit.turn * dt;
        sp.ang += clamp(diff, -turn, turn);
      }
      const x0 = sp.x, y0 = sp.y;
      sp.x += Math.cos(sp.ang) * sp.speed * dt;
      sp.y += Math.sin(sp.ang) * sp.speed * dt;
      if (sp.age < 0.12) continue; /* grace period after leaving the brush */
      let closest = null, firstT = Infinity;
      for (const e of S.enemies) {
        const t = segmentCircleHit(x0, y0, sp.x, sp.y, e.x, e.y, e.r + 4);
        if (t !== null && t < firstT) { closest = e; firstT = t; }
      }
      if (closest) {
        const idx = S.enemies.indexOf(closest);
        if (idx !== -1) {
          damageEnemy(closest, idx, CFG.spirit.dmg, true, sp.ang);
          burst(x0 + (sp.x - x0) * firstT, y0 + (sp.y - y0) * firstT, 4, false);
          S.spirits.splice(i, 1);
        }
      }
    }
  }

  function updateEnemies(dt) {
    const p = S.player;
    for (const e of S.enemies) {
      e.t += dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.orbCd > 0) e.orbCd -= dt;
      if (e.slowT > 0) e.slowT -= dt;
      if (e.stun > 0) {
        e.stun -= dt;
      } else {
        const dx = p.x - e.x, dy = p.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const ux = dx / d, uy = dy / d;
        const sm = e.slowT > 0 ? CFG.slow.mult : 1; /* soaked paper drags */
        let vx = 0, vy = 0;
        switch (e.type) {
          case 'pulse':
          case 'pulseling':
            vx = ux * e.speed * sm; vy = uy * e.speed * sm;
            e.ang = Math.atan2(uy, ux);
            break;
          case 'slab':
          case 'titan':
            vx = ux * e.speed * sm; vy = uy * e.speed * sm;
            e.ang = Math.atan2(uy, ux);
            /* the mother sheds her brood */
            if (e.type === 'titan') {
              e.spawnT -= dt;
              if (e.spawnT <= 0 && S.enemies.length < CFG.wave.concurrentCap(S.stats.wave, S.areaIdx)) {
                e.spawnT = 4.2;
                for (let i = 0; i < 2; i++) {
                  const a = rand(0, 6.28);
                  const c = spawnEnemy('pulseling', e.x + Math.cos(a) * (e.r + 8), e.y + Math.sin(a) * (e.r + 8));
                  c.kbx = Math.cos(a) * 200; c.kby = Math.sin(a) * 200;
                }
                S.rings.push({ x: e.x, y: e.y, max: e.r * 2.1, life: 0.4, maxLife: 0.4 });
              }
            }
            break;
          case 'dart':
            if (e.state === 'cruise') {
              vx = ux * e.speed * sm; vy = uy * e.speed * sm;
              e.ang = Math.atan2(uy, ux);
              e.stateT += dt;
              if (d < 300 && e.stateT > 1.6) { e.state = 'tele'; e.stateT = 0; SFX.wind(); }
            } else if (e.state === 'tele') {
              e.stateT += dt;
              if (e.stateT > 0.42) { e.state = 'dash'; e.stateT = 0; }
            } else if (e.state === 'dash') {
              e.stateT += dt;
              vx = Math.cos(e.ang) * 460; vy = Math.sin(e.ang) * 460;
              if (e.stateT > 0.42) { e.state = 'rest'; e.stateT = 0; }
            } else { /* rest */
              e.stateT += dt;
              if (e.stateT > 0.7) { e.state = 'cruise'; e.stateT = 1.0; }
            }
            break;
          case 'spit': /* keeps its distance and lobs ink */
            if (e.state === 'cruise') {
              e.ang = Math.atan2(uy, ux);
              if (d > 270) { vx = ux * e.speed * sm; vy = uy * e.speed * sm; }
              else { /* strafe sideways */
                const sdir = Math.sin(e.seed + e.t * 0.7) > 0 ? 1 : -1;
                vx = -uy * e.speed * 0.85 * sm * sdir;
                vy = ux * e.speed * 0.85 * sm * sdir;
              }
              e.stateT += dt;
              if (d < 330 && e.stateT > 1.5) { e.state = 'tele'; e.stateT = 0; SFX.wind(); }
            } else if (e.state === 'tele') {
              e.stateT += dt;
              if (e.stateT > 0.5) {
                e.state = 'spit'; e.stateT = 0;
                const ga = Math.atan2(p.y - e.y, p.x - e.x);
                S.ebullets.push({
                  kind: 'glob',
                  x: e.x + Math.cos(ga) * (e.r + 4), y: e.y + Math.sin(ga) * (e.r + 4),
                  vx: Math.cos(ga) * CFG.glob.speed, vy: Math.sin(ga) * CFG.glob.speed,
                  ang: ga, age: 0, life: CFG.glob.life,
                });
                SFX.glob();
              }
            } else if (e.state === 'spit') {
              e.stateT += dt;
              if (e.stateT > 0.25) { e.state = 'rest'; e.stateT = 0; }
            } else { /* rest */
              e.stateT += dt;
              if (e.stateT > 0.8) { e.state = 'cruise'; e.stateT = 0; }
            }
            break;
          case 'moth': { /* erratic: fresh heading every few beats */
            e.dirT -= dt;
            if (e.dirT <= 0) {
              e.dirT = rand(0.3, 0.75);
              e.ang = Math.atan2(uy, ux) + rand(-1.15, 1.15);
            }
            const burst = e.speed * (0.65 + 0.55 * Math.abs(Math.sin(e.t * 5 + e.seed)));
            vx = Math.cos(e.ang) * burst * sm;
            vy = Math.sin(e.ang) * burst * sm;
            break;
          }
          case 'shade': /* dissolves, blinks at your back, pounces */
            if (e.state === 'cruise') {
              vx = ux * e.speed * sm; vy = uy * e.speed * sm;
              e.ang = Math.atan2(uy, ux);
              e.stateT += dt;
              if (d < 320 && e.stateT > 1.3) { e.state = 'dissolve'; e.stateT = 0; }
            } else if (e.state === 'dissolve') {
              e.stateT += dt;
              if (e.stateT > 0.55) {
                /* the blink: a stain is left where it stood */
                S.stainQueue.push({ x: e.x, y: e.y, r: e.r * 0.9, alpha: 0.35 });
                const ba = rand(0, 6.28), bd = rand(56, 96);
                e.x = p.x + Math.cos(ba) * bd;
                e.y = p.y + Math.sin(ba) * bd;
                S.stainQueue.push({ x: e.x, y: e.y, r: e.r * 1.1, alpha: 0.4 });
                S.rings.push({ x: e.x, y: e.y, max: e.r * 2.2, life: 0.3, maxLife: 0.3 });
                e.ang = Math.atan2(p.y - e.y, p.x - e.x);
                e.state = 'pounce'; e.stateT = 0;
                SFX.blink();
              }
            } else if (e.state === 'pounce') {
              e.stateT += dt;
              vx = Math.cos(e.ang) * 300 * sm; vy = Math.sin(e.ang) * 300 * sm;
              if (e.stateT > 0.45) { e.state = 'rest'; e.stateT = 0; }
            } else { /* rest — briefly solid, briefly fair */
              e.stateT += dt;
              if (e.stateT > 0.85) { e.state = 'cruise'; e.stateT = 0; }
            }
            break;
          case 'wraith': {
            const wob = Math.sin(e.t * 3.4 + e.seed) * 0.85;
            vx = (ux - uy * wob) * e.speed * sm;
            vy = (uy + ux * wob) * e.speed * sm;
            e.ang = Math.atan2(vy, vx);
            break;
          }
          case 'split':
            vx = ux * e.speed * sm; vy = uy * e.speed * sm;
            e.ang += dt * 1.2;
            break;
          case 'kage': { /* circles you like a stain, then cuts straight through */
            if (e.state === 'cruise') {
              /* perch on a ring around the player */
              const ringD = clamp(d, 150, 240);
              const tangent = Math.atan2(uy, ux) + (e.seed > 3.14 ? 1 : -1) * Math.PI / 2;
              const pull = clamp((d - ringD) * 2.2, -60, 60);
              vx = (Math.cos(tangent) * e.speed + ux * pull) * sm;
              vy = (Math.sin(tangent) * e.speed + uy * pull) * sm;
              e.ang = Math.atan2(uy, ux);
              e.stateT += dt;
              if (d < 260 && e.stateT > 1.3 + (e.seed % 0.7)) { e.state = 'tele'; e.stateT = 0; SFX.wind(); }
            } else if (e.state === 'tele') {
              e.stateT += dt;
              if (e.stateT > 0.5) {
                e.ang = Math.atan2(p.y - e.y, p.x - e.x);
                e.px = Math.cos(e.ang); e.py = Math.sin(e.ang);
                e.state = 'dash'; e.stateT = 0;
                SFX.blink();
              }
            } else if (e.state === 'dash') {
              e.stateT += dt;
              vx = e.px * 540 * sm; vy = e.py * 540 * sm;
              if (e.stateT > 0.34) { e.state = 'rest'; e.stateT = 0; }
            } else { /* rest */
              e.stateT += dt;
              if (e.stateT > 0.9) { e.state = 'cruise'; e.stateT = 0; }
            }
            break;
          }
          case 'stilt': { /* keeps far, draws a hair-thin line, then fires a needle */
            if (e.state === 'cruise') {
              e.ang = Math.atan2(uy, ux);
              if (d < 330) { vx = -ux * e.speed * sm; vy = -uy * e.speed * sm; } /* back away */
              else if (d > 440) { vx = ux * e.speed * sm; vy = uy * e.speed * sm; }
              else { /* glide sideways along its perch */
                const sdir = Math.sin(e.seed * 3 + e.t * 0.5) > 0 ? 1 : -1;
                vx = -uy * e.speed * sm * sdir;
                vy = ux * e.speed * sm * sdir;
              }
              e.stateT += dt;
              if (d < 520 && e.stateT > 1.7) { e.state = 'aim'; e.stateT = 0; SFX.wind(); }
            } else if (e.state === 'aim') {
              e.ang = Math.atan2(p.y - e.y, p.x - e.x);
              e.stateT += dt;
              if (e.stateT > 0.66) {
                e.state = 'fire'; e.stateT = 0;
                S.ebullets.push({
                  kind: 'needle',
                  x: e.x + Math.cos(e.ang) * (e.r + 6), y: e.y + Math.sin(e.ang) * (e.r + 6),
                  vx: Math.cos(e.ang) * CFG.needle.speed, vy: Math.sin(e.ang) * CFG.needle.speed,
                  ang: e.ang, age: 0, life: CFG.needle.life,
                });
                SFX.needle();
              }
            } else if (e.state === 'fire') {
              e.stateT += dt;
              if (e.stateT > 0.3) { e.state = 'rest'; e.stateT = 0; }
            } else { /* rest */
              e.stateT += dt;
              if (e.stateT > 0.7) { e.state = 'cruise'; e.stateT = 0; }
            }
            break;
          }
          case 'oni': { /* a heavy charge: windup, then a straight bulldozer run */
            if (e.state === 'cruise') {
              vx = ux * e.speed * sm; vy = uy * e.speed * sm;
              e.ang = Math.atan2(uy, ux);
              e.stateT += dt;
              if (d < 340 && e.stateT > 1.4) { e.state = 'windup'; e.stateT = 0; SFX.wind(); }
            } else if (e.state === 'windup') {
              e.stateT += dt;
              if (e.stateT > 0.62) {
                e.ang = Math.atan2(p.y - e.y, p.x - e.x);
                e.px = Math.cos(e.ang); e.py = Math.sin(e.ang);
                e.state = 'charge'; e.stateT = 0;
              }
            } else if (e.state === 'charge') {
              e.stateT += dt;
              vx = e.px * 470; vy = e.py * 470;
              if (e.stateT > 0.6) { e.state = 'skid'; e.stateT = 0; }
            } else if (e.state === 'skid') {
              e.stateT += dt;
              vx = e.px * 120; vy = e.py * 120;
              if (e.stateT > 0.5) { e.state = 'cruise'; e.stateT = 0; }
            }
            break;
          }
          case 'crane': { /* swoops past in long arcs, never lingers */
            if (e.state === 'cruise' || e.state === 'loop') {
              /* line up the next pass: aim beyond the player */
              e.dirT -= dt;
              if (e.dirT <= 0) {
                e.dirT = 0.4;
                const side = (e.seed + Math.floor(e.t)) % 2 === 0 ? 1 : -1;
                const tx = p.x + -uy * 90 * side;
                const ty = p.y + ux * 90 * side;
                e.ang = Math.atan2(ty - e.y, tx - e.x);
                e.state = 'pass';
              }
              e.stateT += dt;
              vx = Math.cos(e.ang) * e.speed * 0.55;
              vy = Math.sin(e.ang) * e.speed * 0.55;
            } else if (e.state === 'pass') {
              e.stateT += dt;
              vx = Math.cos(e.ang) * e.speed * sm;
              vy = Math.sin(e.ang) * e.speed * sm;
              if (e.stateT > 0.9 && d > 220) { e.state = 'loop'; e.stateT = 0; e.dirT = 0.15; }
            }
            break;
          }
        }
        e.x += vx * dt; e.y += vy * dt;
      }
      e.x += e.kbx * dt; e.y += e.kby * dt;
      const decay = Math.exp(-8 * dt);
      e.kbx *= decay; e.kby *= decay;
    }

    /* soft separation so enemies don't stack */
    for (let i = 0; i < S.enemies.length; i++) {
      for (let j = i + 1; j < S.enemies.length; j++) {
        const a = S.enemies[i], b = S.enemies[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = (a.r + b.r) * 0.8;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.35;
          a.x -= dx * push; a.y -= dy * push;
          b.x += dx * push; b.y += dy * push;
        }
      }
    }

    /* contact damage */
    if (S.invulnT <= 0) {
      for (const e of S.enemies) {
        const dx = e.x - p.x, dy = e.y - p.y;
        const rr = e.r + p.r - 2;
        if (dx * dx + dy * dy < rr * rr) { takeHit(); break; }
      }
    }
  }

  /* the spitter's ink and the sniper's needles, flying back at you */
  function updateEbullets(dt) {
    const p = S.player;
    for (let i = S.ebullets.length - 1; i >= 0; i--) {
      const b = S.ebullets[i];
      const x0 = b.x, y0 = b.y;
      const travel = Math.max(0, Math.min(dt, b.life - b.age));
      b.x += b.vx * travel; b.y += b.vy * travel; b.age += dt;
      if (S.invulnT <= 0) {
        const br = b.kind === 'needle' ? CFG.needle.r : CFG.glob.r;
        const rr = p.r - 1 + br;
        const hitT = segmentCircleHit(x0, y0, b.x, b.y, p.x, p.y, rr);
        if (hitT !== null) {
          S.ebullets.splice(i, 1);
          S.stainQueue.push({
            x: x0 + (b.x - x0) * hitT,
            y: y0 + (b.y - y0) * hitT,
            r: 3.4, alpha: 0.4,
          });
          takeHit();
          continue;
        }
      }
      if (b.age > b.life) {
        S.stainQueue.push({ x: b.x, y: b.y, r: 2.4, alpha: 0.22 });
        S.ebullets.splice(i, 1);
      }
    }
  }

  function updateMarkers(dt) {
    for (let i = S.markers.length - 1; i >= 0; i--) {
      const mk = S.markers[i];
      mk.t -= dt;
      if (mk.t <= 0) {
        S.markers.splice(i, 1);
        S.stainQueue.push({ x: mk.x, y: mk.y, r: ENEMIES[mk.type].r * (mk.elite ? 2 : 1.1), alpha: mk.elite ? 0.55 : 0.42, red: !!mk.elite });
        spawnEnemy(mk.type, mk.x, mk.y, { elite: !!mk.elite, boss: !!mk.boss });
        if (mk.elite) { S.shake = Math.max(S.shake, 7); SFX.elite(); }
      }
    }
  }

  /* ---------------- Phase 3 / the three ink Guardians ----------------
     The boss director only schedules marked attacks. Original enemy movement,
     line-boil sprites, weapon damage and HP scaling stay intact. */
  function updateGuardians(dt) {
    for (const e of S.enemies) {
      const g = e.guardian;
      if (!g) continue;
      const nextPhase = GUARDIANS.phases(e.hp, e.maxHp, g.boss);
      if (nextPhase > g.phase) {
        g.phase = nextPhase;
        g.cooldown = Math.max(g.cooldown, 1.15);
        S.guardianMarks = S.guardianMarks.filter(m => m.owner !== e);
        S.popups.push({
          x: e.x, y: e.y - e.r - 18,
          txt: GUARDIANS.titles[g.world][g.phase - 1],
          life: 1.5, max: 1.5, red: true,
        });
        S.rings.push({ x: e.x, y: e.y, max: e.r * 2.6,
          life: .6, maxLife: .6, red: true });
        SFX.wind();
      }
      g.cooldown -= dt;
      if (g.cooldown > 0) continue;
      const cast = GUARDIANS.attack(
        g.world, g.phase, g.boss,
        { x: e.x, y: e.y }, { x: S.player.x, y: S.player.y },
        { width: S.W || 800, height: S.H || 600 }, g.cast++,
      );
      for (const mark of cast.marks) {
        S.guardianMarks.push({
          ...mark, owner: e, world: g.world,
          phase: g.phase, maxWarn: cast.windup,
          t: cast.windup, recovery: cast.recovery, fired: false,
        });
      }
      /* Start the next pattern only after a dodge and a short recovery.
         Even the final boss never fires hazards continuously. */
      g.cooldown = (g.boss ? 3.9 : 4.6) - (g.phase - 1) * .36;
      SFX.wind();
    }
  }

  function updateGuardianMarks(dt) {
    for (let i = S.guardianMarks.length - 1; i >= 0; i--) {
      const mark = S.guardianMarks[i];
      if (S.enemies.indexOf(mark.owner) === -1 || S.mode !== 'playing') {
        S.guardianMarks.splice(i, 1);
        continue;
      }
      mark.t -= dt;
      if (mark.t <= 0 && !mark.fired) {
        mark.fired = true;
        if (mark.kind === 'seal') {
          S.rings.push({
            x: mark.x, y: mark.y, max: mark.radius,
            life: .38, maxLife: .38, red: true,
          });
        } else {
          const cx = (mark.x1 + mark.x2) * .5;
          const cy = (mark.y1 + mark.y2) * .5;
          S.stainQueue.push({ x: cx, y: cy, r: 14, alpha: .24,
            red: mark.world === 2 });
        }
        SFX.glob();
      }
      /* The warning is harmless; only the brief solid impact can hurt.
         takeHit() provides regular integrity / Ward / invulnerability. */
      if (mark.fired && mark.t >= -mark.recovery && S.invulnT <= 0 &&
          GUARDIANS.hits(mark, S.player)) takeHit();
      if (mark.t < -mark.recovery) S.guardianMarks.splice(i, 1);
      if (S.mode !== 'playing') break;
    }
  }

  function updateSpawning(dt) {
    if (!S.waveActive || !S.queue.length) return;
    S.spawnTimer -= dt;
    const director = S.wavePlan;
    const cap = CFG.wave.concurrentCap(S.stats.wave, S.areaIdx);
    const alive = S.enemies.length + S.markers.length;
    if (S.spawnTimer <= 0 && S.markers.length < 6 && alive < cap) {
      const baseGroup = CFG.wave.groupSize(S.stats.wave, S.areaIdx);
      const pacedGroup = director ? Math.max(1, Math.round(baseGroup * director.size)) : baseGroup;
      const group = Math.min(pacedGroup, S.queue.length, cap - alive, 6 - S.markers.length);
      if (group <= 0) return;
      const sides = director ? null : shuffle([0, 1, 2, 3]);
      const arrival = director ? director.group++ : 0;
      for (let i = 0; i < group; i++) {
        const type = S.queue.pop();
        const side = director
          ? WAVE_DIRECTOR.side(director, arrival, i)
          : sides[i % 4];
        const pt = edgePoint(side);
        S.markers.push({
          type, x: pt.x, y: pt.y,
          t: director ? director.telegraph : 0.62,
        });
      }
      S.spawnTimer = director
        ? Math.max(0.42, CFG.wave.groupInterval(S.stats.wave) * director.rate)
        : CFG.wave.groupInterval(S.stats.wave);
    }
  }

  function updateFx(dt) {
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const p = S.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      const damp = Math.exp(-5 * dt);
      p.vx *= damp; p.vy *= damp;
      p.rot += p.vr * dt;
      p.life -= dt;
      if (p.life <= 0) {
        S.stainQueue.push({ x: p.x, y: p.y, r: p.size * 1.5, alpha: 0.28 });
        S.particles.splice(i, 1);
      }
    }
    for (let i = S.popups.length - 1; i >= 0; i--) {
      const p = S.popups[i];
      p.y -= 28 * dt; p.life -= dt;
      if (p.life <= 0) S.popups.splice(i, 1);
    }
    for (let i = S.rings.length - 1; i >= 0; i--) {
      const r = S.rings[i];
      r.life -= dt;
      if (r.life <= 0) S.rings.splice(i, 1);
    }
    if (S.shake > 0) S.shake *= Math.exp(-6.5 * dt);
  }

  /* Ink cores glide toward the brush, with a stronger recall at wave end.
     Level-up choices use the existing 3-card upgrade screen mid-combat. */
  function collectInk(value, x, y) {
    const st = S.stats;
    st.inkCollected += value;
    const ranks = INK_XP.grant(st, value);
    UI.setInkProgress(st.inkRank, st.inkXp, INK_XP.needed(st.inkRank), ranks > 0);
    if (ranks) {
      S.rings.push({ x:S.player.x, y:S.player.y,
        max:35 + st.inkRank * 2, life:.65, maxLife:.65, red:true });
      S.popups.push({ x:S.player.x, y:S.player.y - 23,
        txt:'BRUSH '+String(st.inkRank).padStart(2,'0'), red:true, life:1.5, max:1.5 });
      SFX.pick();
    } else if(value >= 15) {
      S.popups.push({ x, y:y-12, txt:'INK +'+value, red:true,life:.55,max:.55 });
    }
  }
  function updateInkDrops(dt) {
    if(!S.inkDrops.length)return;
    const st=S.stats,p=S.player;
    INK_XP.update(S.inkDrops,{x:p.x,y:p.y,inkRank:st.inkRank},
      dt,S.inkRecall,collectInk);
  }
  function flushInkDrops() {
    /* Never lose XP because the next wave starts before a far-away drop
       can finish flying back. Remaining cores are awarded only at wave end. */
    if(!S.inkDrops.length)return;
    for(const d of S.inkDrops)collectInk(d.value,d.x,d.y);
    S.inkDrops.length=0;
  }

  function update(dt) {
    const st = S.stats;
    if (!st) return;
    st.time += dt;
    clockT += dt;
    S.clockT = clockT;
    UI.setTime(st.time);

    updatePlayer(dt);
    updateBullets(dt);
    updateEbullets(dt);
    updateEnemies(dt);
    if (S.mode !== 'playing') return;
    updateGuardians(dt);
    updateGuardianMarks(dt);
    if (S.mode !== 'playing') return;
    updateKnots(dt);
    updatePuddles(dt);
    updateSpirits(dt);
    updateMarkers(dt);
    updateSpawning(dt);
    updateFx(dt);
    updateInkDrops(dt);
    if(S.mode !== 'playing')return;
    if(st.inkPending > 0){openUpgrade();return;}

    const remaining = S.queue.length + S.markers.length + S.enemies.length;
    UI.setProgress(S.waveInitial ? 1 - remaining / S.waveInitial : 1);

    if (S.waveActive && remaining === 0) {
      S.waveActive = false;
      S.inkRecall = true;
      S.clearedT = 1.1; /* a small cinematic suction before the next wave */
    }
    if (!S.waveActive && S.clearedT > 0) {
      S.clearedT -= dt;
      if (S.clearedT <= 0) {
        flushInkDrops();
        if(st.inkPending > 0) { openUpgrade(); return; }
        /* Exactly ten waves per Journey stage; XP, not automatic
           wave completion, now awards build choices. */
        if (S.runMode === 'journey' && st.wave >= CAMPAIGN.WAVES_PER_LEVEL) {
          showOver(true);
        } else {
          startWave(st.wave + 1);
        }
      }
    }
  }

  function updateDying(dt) {
    moveBullets(dt);
    for (let i = S.ebullets.length - 1; i >= 0; i--) {
      const b = S.ebullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt;
      if (b.age > b.life) S.ebullets.splice(i, 1);
    }
    updateFx(dt);
    S.dyingT -= dt;
    if (S.dyingT <= 0) showOver(false);
  }

  /* ---------------- attract mode (title backdrop) ----------------
     beasts drift across an open sheet; the camera rests at the seal */
  function initAttract() {
    S.idle = [];
    const types = ['pulse', 'dart', 'spit', 'split', 'slab', 'shade', 'wraith', 'moth', 'titan', 'kage', 'crane', 'oni'];
    for (let i = 0; i < 9; i++) {
      const type = types[Math.floor(rand(0, types.length))];
      const r = ENEMIES[type].r * (type === 'titan' ? 0.7 : 1);
      const ang = rand(0, 6.28);
      const sp = rand(16, 34);
      const d = rand(60, 330);
      S.idle.push({
        type, r,
        x: Math.cos(ang) * d, y: Math.sin(ang) * d,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        ang, t: rand(0, 10), hitFlash: 0, state: 'cruise', seed: rand(0, 6.28),
      });
    }
  }

  function updateIdle(dt) {
    for (const d of S.idle) {
      d.x += d.vx * dt; d.y += d.vy * dt; d.t += dt;
      d.ang += dt * 0.25;
      /* a soft pull keeps the wanderers near the seal */
      const dist = Math.hypot(d.x, d.y);
      if (dist > 350) {
        d.vx -= (d.x / dist) * 26 * dt;
        d.vy -= (d.y / dist) * 26 * dt;
      }
      const sp = Math.hypot(d.vx, d.vy);
      if (sp > 40) { d.vx *= 40 / sp; d.vy *= 40 / sp; }
    }
    updateFx(dt);
  }

  /* ---------------- api ---------------- */
  return {
    S,
    get mode() { return S.mode; },
    set mode(m) { S.mode = m; },
    startRun, startLevel, openCampaign, retryOrNext, continueEndless, abandon, deploy, pickAt,
    getCampaign: CAMPAIGN.read,
    update, updateDying, updateIdle, initAttract,
    getBest, getRuns,
  };
})();
