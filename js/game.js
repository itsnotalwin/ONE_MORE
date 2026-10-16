'use strict';
/* ============================================================
   ONE MORE — game core: state, waves, entities, collisions
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
    arena: { x: 0, y: 0, w: 0, h: 0 },
    reduced: false,

    player: { x: 0, y: 0, r: CFG.player.r, aim: 0, fireT: 0, recoil: 0 },
    stats: null,

    bullets: [], ebullets: [], enemies: [], markers: [], particles: [], popups: [], rings: [], idle: [],
    stainQueue: [],
    queue: [], waveInitial: 0, waveActive: false, spawnTimer: 0, clearedT: 0,

    invulnT: 0, adrenT: 0, shake: 0, dyingT: 0, novaT: 0, clockT: 0,
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
      score: 0, kills: 0, time: 0, wave: 0,
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

  function clampToArena(o, pad = 2) {
    o.x = clamp(o.x, S.arena.x + o.r + pad, S.arena.x + S.arena.w - o.r - pad);
    o.y = clamp(o.y, S.arena.y + o.r + pad, S.arena.y + S.arena.h - o.r - pad);
  }

  function clampAll() {
    if (S.player) clampToArena(S.player);
    for (const e of S.enemies) clampToArena(e);
    for (const d of S.idle) { d.x = clamp(d.x, S.arena.x + d.r, S.arena.x + S.arena.w - d.r); d.y = clamp(d.y, S.arena.y + d.r, S.arena.y + S.arena.h - d.r); }
  }

  function edgePoint(sideHint) {
    const a = S.arena, m = 26;
    for (let tries = 0; tries < 12; tries++) {
      const side = (sideHint != null && tries < 2) ? sideHint : Math.floor(Math.random() * 4);
      let x, y;
      if (side === 0) { x = rand(a.x + m, a.x + a.w - m); y = a.y + m; }
      else if (side === 1) { x = a.x + a.w - m; y = rand(a.y + m, a.y + a.h - m); }
      else if (side === 2) { x = rand(a.x + m, a.x + a.w - m); y = a.y + a.h - m; }
      else { x = a.x + m; y = rand(a.y + m, a.y + a.h - m); }
      const dx = x - S.player.x, dy = y - S.player.y;
      if (dx * dx + dy * dy > 150 * 150) return { x, y };
    }
    return { x: S.arena.x + m, y: S.arena.y + m };
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
  function spawnEnemy(type, x, y) {
    const def = ENEMIES[type];
    const w = S.stats.wave;
    const hp = CFG.wave.hpScale(def.hp, w, def.intro);
    const e = {
      type, x, y, r: def.r, hp, maxHp: hp,
      speed: def.speed * CFG.wave.spScale(w, def.intro),
      ang: Math.atan2(S.player.y - y, S.player.x - x),
      t: rand(0, 10), hitFlash: 0, kbx: 0, kby: 0,
      state: 'cruise', stateT: rand(0.3, 1.5), seed: rand(0, 6.28), stun: 0,
      slowT: 0, orbCd: 0, dirT: 0, spawnT: type === 'titan' ? 2.5 : 0,
    };
    S.enemies.push(e);
    S.rings.push({ x, y, max: def.r * 2.4, life: 0.3, maxLife: 0.3 });
    return e;
  }

  function killEnemy(e) {
    const def = ENEMIES[e.type];
    const mult = 1 + 0.15 * Math.max(0, S.stats.wave - 1);
    const pts = Math.round((def.score * mult) / 5) * 5;
    S.stats.score += pts;
    S.stats.kills++;
    UI.setScore(S.stats.score);
    S.popups.push({ x: e.x, y: e.y - e.r - 4, txt: '+' + pts, life: 0.7, max: 0.7, red: false });
    burst(e.x, e.y, e.r, e.type === 'titan');
    S.stainQueue.push({ x: e.x, y: e.y, r: e.r * 1.45, alpha: e.type === 'titan' ? 0.62 : 0.5 });
    if (e.type === 'slab' || e.type === 'titan') SFX.bigKill(); else SFX.kill();
    if (e.type === 'split') {
      for (const s of [-1, 1]) {
        const c = spawnEnemy('pulseling', clamp(e.x + s * 10, S.arena.x + 10, S.arena.x + S.arena.w - 10), e.y + rand(-6, 6));
        c.kbx = s * 190; c.kby = rand(-70, 70);
      }
    }
    if (e.type === 'titan') {
      /* the mother bursts — her brood scatters */
      for (let i = 0; i < 3; i++) {
        const a = rand(0, 6.28);
        const c = spawnEnemy('pulseling', clamp(e.x + Math.cos(a) * 20, S.arena.x + 10, S.arena.x + S.arena.w - 10), clamp(e.y + Math.sin(a) * 20, S.arena.y + 10, S.arena.y + S.arena.h - 10));
        c.kbx = Math.cos(a) * 230; c.kby = Math.sin(a) * 230;
      }
    }
    if (S.stats.adren > 0) S.adrenT = CFG.adrenaline.dur(S.stats.adren);
  }

  function nearestEnemy() {
    const p = S.player;
    let best = null, bd = Infinity;
    for (const e of S.enemies) {
      const dx = e.x - p.x, dy = e.y - p.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /* ---------------- waves ---------------- */
  function buildQueue(budget, wave) {
    const pool = Object.keys(ENEMIES).filter(k => ENEMIES[k].cost > 0 && ENEMIES[k].intro <= wave);
    const weights = { pulse: 5, dart: 3, spit: 2.2, moth: 2.5, split: 2.2, slab: 1.5, shade: 1.7, wraith: 1.9, titan: 0.85 };
    const q = [];
    let guard = 0;
    while (budget > 0 && guard++ < 600) {
      const avail = pool.filter(k => ENEMIES[k].cost <= budget);
      if (!avail.length) break;
      let total = 0;
      for (const k of avail) total += weights[k] || 1;
      let r = Math.random() * total, pick = avail[0];
      for (const k of avail) { r -= weights[k] || 1; if (r <= 0) { pick = k; break; } }
      q.push(pick);
      budget -= ENEMIES[pick].cost;
    }
    return shuffle(q);
  }

  function startWave(n) {
    const st = S.stats;
    st.wave = n;
    const surge = n > 1 && n % CFG.wave.surgeEvery === 0;
    const budget = Math.round(CFG.wave.budget(n) * (surge ? CFG.wave.surgeMult : 1));
    S.queue = buildQueue(budget, n);
    S.waveInitial = S.queue.length;
    S.waveActive = true;
    S.spawnTimer = 1.0;
    S.clearedT = 0;
    UI.setWave(n);
    UI.setProgress(0);
    UI.banner(n, surge);
    SFX.wave();
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
    if (S.mode !== 'playing') return;
    S.mode = 'upgrade';
    /* globs still aloft settle into the paper */
    for (const b of S.ebullets) S.stainQueue.push({ x: b.x, y: b.y, r: 2.4, alpha: 0.22 });
    S.ebullets.length = 0;
    S.choices = pickUpgrades(3);
    S.selected = null;
    UI.setUpgradeHeader(S.stats.wave, S.stats.wave + 1);
    UI.fillUpgrades(S.choices, S.stats.levels);
    UI.markSelected(null);
    UI.setDeploy(false, S.stats.wave + 1);
    UI.show('upgrade');
    SFX.wave();
  }

  /* ---------------- flow ---------------- */
  function startRun() {
    S.stats = freshStats();
    S.bullets = []; S.ebullets = []; S.enemies = []; S.markers = [];
    S.particles = []; S.popups = []; S.rings = []; S.stainQueue = [];
    S.queue = []; S.waveInitial = 0; S.waveActive = false;
    S.invulnT = 0; S.adrenT = 0; S.shake = 0; S.dyingT = 0; S.novaT = 0;
    S.choices = []; S.selected = null; S.idle = [];

    const runs = getRuns() + 1;
    store.set('om_runs_v1', runs);

    const p = S.player;
    p.x = S.arena.x + S.arena.w / 2;
    p.y = S.arena.y + S.arena.h / 2;
    p.fireT = 0.3; p.recoil = 0;

    UI.show(null);
    UI.hud(true);
    UI.setScore(0);
    UI.setHp(S.stats.hp, S.stats.maxHp);
    UI.setLoadout({});
    S.mode = 'playing';
    startWave(1);
  }

  function abandon() {
    S.mode = 'title';
    S.bullets = []; S.ebullets = []; S.enemies = []; S.markers = [];
    S.particles = []; S.popups = []; S.rings = []; S.stainQueue = []; S.queue = [];
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
    SFX.deploy();
    UI.show(null);
    S.mode = 'playing';
    startWave(S.stats.wave + 1);
  }

  function pickAt(i) {
    if (S.mode !== 'upgrade') return;
    const u = S.choices[i];
    if (!u) return;
    if (S.selected === i) { deploy(); return; }
    S.selected = i;
    UI.markSelected(i);
    UI.setDeploy(true, S.stats.wave + 1);
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

  function showOver() {
    const st = S.stats;
    const cleared = Math.max(0, st.wave - 1);
    let rank = 'D';
    for (const [min, r] of CFG.ranks) { if (cleared >= min) { rank = r; break; } }
    const best = getBest();
    const nb = st.score > (best ? best.score : 0);
    if (nb) store.set('om_best_v1', { score: st.score, wave: cleared });
    UI.showOver({
      run: getRuns(), waves: cleared, kills: st.kills,
      time: st.time, score: st.score, rank, newBest: nb,
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

  /* ---------------- updates ---------------- */
  function updatePlayer(dt) {
    const p = S.player, st = S.stats;
    let vx = S.inputVec.x, vy = S.inputVec.y;
    const m = Math.hypot(vx, vy);
    if (m > 1) { vx /= m; vy /= m; }
    const sp = CFG.player.speed * st.moveMult * (S.adrenT > 0 ? CFG.adrenaline.mult : 1);
    p.x += vx * sp * dt;
    p.y += vy * sp * dt;
    clampToArena(p);

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

    /* ink orbit: droplets grind what they graze */
    if (st.orb > 0) {
      const orbR = CFG.orbit.radius(st.orb);
      const base = G_time();
      for (let i = 0; i < st.orb; i++) {
        const a = base * CFG.orbit.speed + (i / st.orb) * TAU;
        const ox = p.x + Math.cos(a) * orbR, oy = p.y + Math.sin(a) * orbR;
        for (let k = S.enemies.length - 1; k >= 0; k--) {
          const e = S.enemies[k];
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
            if (e.hp <= 0) { S.enemies.splice(k, 1); killEnemy(e); }
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
        });
      }
    }
    p.recoil = 1;
    SFX.shoot();
  }

  function moveBullets(dt) {
    const a = S.arena;
    for (let i = S.bullets.length - 1; i >= 0; i--) {
      const b = S.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt;
      if (b.age > b.life || b.x < a.x - 6 || b.x > a.x + a.w + 6 || b.y < a.y - 6 || b.y > a.y + a.h + 6) {
        S.stainQueue.push({ x: b.x, y: b.y, r: 2.6, alpha: 0.3 });
        S.bullets.splice(i, 1);
      }
    }
  }

  function updateBullets(dt) {
    moveBullets(dt);
    const st = S.stats;
    const critCh = CFG.crit.chance(st.crit);
    for (let i = S.bullets.length - 1; i >= 0; i--) {
      const b = S.bullets[i];
      for (let j = S.enemies.length - 1; j >= 0; j--) {
        const e = S.enemies[j];
        const dx = e.x - b.x, dy = e.y - b.y;
        const rr = e.r + 3;
        if (dx * dx + dy * dy <= rr * rr) {
          let dmg = b.dmg;
          if (critCh > 0 && Math.random() < critCh) {
            dmg *= 2;
            S.popups.push({ x: e.x, y: e.y - e.r - 6, txt: '×2', life: 0.55, max: 0.55, red: true });
          }
          if (st.slow > 0) e.slowT = CFG.slow.dur;
          e.hp -= dmg;
          e.hitFlash = 0.08;
          const bl = Math.hypot(b.vx, b.vy) || 1;
          const kx = b.vx / bl, ky = b.vy / bl;
          const kf = e.type === 'slab' ? 0.12 : 0.55;
          e.kbx += kx * 240 * kf;
          e.kby += ky * 240 * kf;
          SFX.hit();
          b.hits--;
          if (e.hp <= 0) {
            S.enemies.splice(j, 1);
            killEnemy(e);
          }
          if (b.hits <= 0) S.bullets.splice(i, 1);
          break;
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
              if (e.spawnT <= 0 && S.enemies.length < CFG.wave.concurrentCap(S.stats.wave)) {
                e.spawnT = 4.2;
                for (let i = 0; i < 2; i++) {
                  const a = rand(0, 6.28);
                  const c = spawnEnemy('pulseling', clamp(e.x + Math.cos(a) * (e.r + 8), S.arena.x + 10, S.arena.x + S.arena.w - 10), clamp(e.y + Math.sin(a) * (e.r + 8), S.arena.y + 10, S.arena.y + S.arena.h - 10));
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
                e.x = clamp(p.x + Math.cos(ba) * bd, S.arena.x + e.r + 2, S.arena.x + S.arena.w - e.r - 2);
                e.y = clamp(p.y + Math.sin(ba) * bd, S.arena.y + e.r + 2, S.arena.y + S.arena.h - e.r - 2);
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
        }
        e.x += vx * dt; e.y += vy * dt;
      }
      e.x += e.kbx * dt; e.y += e.kby * dt;
      const decay = Math.exp(-8 * dt);
      e.kbx *= decay; e.kby *= decay;
      clampToArena(e);
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

  /* the spitter's ink, flying back at you */
  function updateEbullets(dt) {
    const a = S.arena, p = S.player;
    for (let i = S.ebullets.length - 1; i >= 0; i--) {
      const b = S.ebullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.age += dt;
      if (b.age > b.life || b.x < a.x - 6 || b.x > a.x + a.w + 6 || b.y < a.y - 6 || b.y > a.y + a.h + 6) {
        S.stainQueue.push({ x: b.x, y: b.y, r: 2.4, alpha: 0.22 });
        S.ebullets.splice(i, 1);
        continue;
      }
      if (S.invulnT <= 0) {
        const dx = b.x - p.x, dy = b.y - p.y;
        const rr = p.r - 1 + CFG.glob.r;
        if (dx * dx + dy * dy <= rr * rr) {
          S.ebullets.splice(i, 1);
          S.stainQueue.push({ x: b.x, y: b.y, r: 3.4, alpha: 0.4 });
          takeHit();
        }
      }
    }
  }

  function updateMarkers(dt) {
    for (let i = S.markers.length - 1; i >= 0; i--) {
      const mk = S.markers[i];
      mk.t -= dt;
      if (mk.t <= 0) {
        S.markers.splice(i, 1);
        S.stainQueue.push({ x: mk.x, y: mk.y, r: ENEMIES[mk.type].r * 1.1, alpha: 0.42 });
        spawnEnemy(mk.type, mk.x, mk.y);
      }
    }
  }

  function updateSpawning(dt) {
    if (!S.waveActive || !S.queue.length) return;
    S.spawnTimer -= dt;
    const cap = CFG.wave.concurrentCap(S.stats.wave);
    const alive = S.enemies.length + S.markers.length;
    if (S.spawnTimer <= 0 && S.markers.length < 6 && alive < cap) {
      const group = Math.min(CFG.wave.groupSize(S.stats.wave), S.queue.length, cap - alive);
      const sides = shuffle([0, 1, 2, 3]); /* flank: spread each group around the arena */
      for (let i = 0; i < group; i++) {
        const type = S.queue.pop();
        const pt = edgePoint(sides[i % 4]);
        S.markers.push({ type, x: pt.x, y: pt.y, t: 0.62 });
      }
      S.spawnTimer = CFG.wave.groupInterval(S.stats.wave);
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
    updateMarkers(dt);
    updateSpawning(dt);
    updateFx(dt);

    const remaining = S.queue.length + S.markers.length + S.enemies.length;
    UI.setProgress(S.waveInitial ? 1 - remaining / S.waveInitial : 1);

    if (S.waveActive && remaining === 0) {
      S.waveActive = false;
      S.clearedT = 0.55;
    }
    if (!S.waveActive && S.clearedT > 0) {
      S.clearedT -= dt;
      if (S.clearedT <= 0) openUpgrade();
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
    if (S.dyingT <= 0) showOver();
  }

  /* ---------------- attract mode (title backdrop) ---------------- */
  function initAttract() {
    S.idle = [];
    const types = ['pulse', 'dart', 'spit', 'split', 'slab', 'shade', 'wraith', 'moth', 'titan'];
    const a = S.arena;
    for (let i = 0; i < 7; i++) {
      const type = types[Math.floor(rand(0, types.length))];
      const r = ENEMIES[type].r * (type === 'titan' ? 0.7 : 1);
      const ang = rand(0, 6.28);
      const sp = rand(16, 34);
      S.idle.push({
        type, r,
        x: rand(a.x + r + 4, a.x + a.w - r - 4),
        y: rand(a.y + r + 4, a.y + a.h - r - 4),
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        ang, t: rand(0, 10), hitFlash: 0, state: 'cruise', seed: rand(0, 6.28),
      });
    }
  }

  function updateIdle(dt) {
    const a = S.arena;
    for (const d of S.idle) {
      d.x += d.vx * dt; d.y += d.vy * dt; d.t += dt;
      d.ang += dt * 0.25;
      if (d.x < a.x + d.r || d.x > a.x + a.w - d.r) { d.vx *= -1; d.x = clamp(d.x, a.x + d.r, a.x + a.w - d.r); }
      if (d.y < a.y + d.r || d.y > a.y + a.h - d.r) { d.vy *= -1; d.y = clamp(d.y, a.y + d.r, a.y + a.h - d.r); }
    }
    updateFx(dt);
  }

  /* ---------------- api ---------------- */
  return {
    S,
    get mode() { return S.mode; },
    set mode(m) { S.mode = m; },
    startRun, abandon, deploy, pickAt,
    update, updateDying, updateIdle, initAttract, clampAll,
    getBest, getRuns,
  };
})();
