'use strict';
/* ============================================================
   ONE MORE — sumi-e ink renderer
   The world is an endless sheet of washi that scrolls beneath
   the brush: tiling paper, ambient brush marks, a persistent
   layer of dried ink stains (sprite-cached), and three paper
   themes — pale washi, the night scroll, the cinnabar field.
   ============================================================ */

const R = (() => {
  const RED = '#b23a2b';
  const TAU = Math.PI * 2;

  /* ---------------- paper themes ---------------- */
  const THEMES = {
    pale: { paper: '#ede7d9', ink: '#1a1714', vig: '58,52,40'  },
    dark: { paper: '#17130f', ink: '#e9e2d2', vig: '0,0,0'     },
    red:  { paper: '#eadbc4', ink: '#1a1714', vig: '122,42,26' },
  };
  let INK = THEMES.pale.ink;
  let PAPER = THEMES.pale.paper;
  let themeKey = 'pale';

  /* ---------------- tiny deterministic rng ---------------- */
  function mulberry(s) {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /* ---------------- layers ---------------- */
  const TILE = 480;
  let tiles = {};            // theme -> canvas (built lazily)
  let tileDpr = 0;
  let patHatchDark = null;   // dark-ink hatch (pale & red sheets)
  let patHatchPale = null;   // pale-ink hatch (night sheet)
  let patHatch = null;       // active hatch, follows theme
  let lw = 0, lh = 0, ldpr = 1;
  let lastT = 0, lastTrailT = -1;

  /* dried ink lives in world space, each stain its own sprite */
  let stains = [];

  function ensurePatterns(ctx) {
    if (patHatchDark) return;
    const mk = rgba => {
      const hc = document.createElement('canvas');
      hc.width = hc.height = 10;
      const h = hc.getContext('2d');
      h.strokeStyle = rgba;
      h.lineWidth = 1.4; h.lineCap = 'round';
      h.beginPath();
      h.moveTo(-2, 9.5); h.lineTo(9.5, -2);
      h.moveTo(3, 13); h.lineTo(13, 3);
      h.stroke();
      return ctx.createPattern(hc, 'repeat');
    };
    patHatchDark = mk('rgba(26,23,20,0.6)');
    patHatchPale = mk('rgba(233,226,210,0.5)');
    patHatch = patHatchDark;
  }

  function setTheme(key) {
    if (key === themeKey) return;
    themeKey = key;
    const th = THEMES[key];
    INK = th.ink;
    PAPER = th.paper;
    patHatch = key === 'dark' ? patHatchPale : patHatchDark;
  }

  function activeThemeKey() {
    const S = G.S;
    if (S.mode === 'playing' || S.mode === 'paused' || S.mode === 'upgrade' || S.mode === 'dying') {
      const area = AREAS[S.areaIdx % AREAS.length];
      return area.theme;
    }
    return themeKey; /* title & over keep whatever sheet they lie on */
  }

  /* ---------------- tiled washi paper ---------------- */
  function buildTile(key, dpr) {
    const th = THEMES[key];
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(TILE * dpr);
    const p = c.getContext('2d');
    p.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rnd = mulberry(20260101 + key.charCodeAt(0) * 77);

    p.fillStyle = th.paper;
    p.fillRect(0, 0, TILE, TILE);

    /* laid lines — grain that tiles cleanly (8 divides 480) */
    p.lineWidth = 1;
    p.strokeStyle = key === 'dark' ? 'rgba(237,231,217,0.03)' : 'rgba(96,88,70,0.03)';
    for (let y = 4; y < TILE; y += 8) {
      p.beginPath(); p.moveTo(0, y + (rnd() - 0.5)); p.lineTo(TILE, y + (rnd() - 0.5)); p.stroke();
    }
    /* fibers */
    const fibers = Math.round((TILE * TILE) / 850);
    for (let i = 0; i < fibers; i++) {
      const x = rnd() * TILE, y = rnd() * TILE;
      const a = (rnd() - 0.5) * 0.9 + (rnd() < 0.5 ? 0 : Math.PI / 2);
      const l = 1.5 + rnd() * 3.5;
      const base = key === 'dark' ? [200, 194, 178] : [70 + rnd() * 40 | 0, 62 + rnd() * 36 | 0, 48 + rnd() * 28 | 0];
      p.strokeStyle = `rgba(${base[0]},${base[1]},${base[2]},${0.03 + rnd() * 0.045})`;
      p.lineWidth = 0.7;
      p.beginPath();
      p.moveTo(x, y);
      p.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      p.stroke();
    }
    /* speckles */
    const dots = Math.round((TILE * TILE) / 2400);
    for (let i = 0; i < dots; i++) {
      p.fillStyle = key === 'dark'
        ? `rgba(220,214,198,${0.02 + rnd() * 0.05})`
        : `rgba(50,45,36,${0.02 + rnd() * 0.05})`;
      p.beginPath();
      p.arc(rnd() * TILE, rnd() * TILE, 0.3 + rnd() * 0.8, 0, TAU);
      p.fill();
    }
    /* broad faint washes, kept off the tile rim so seams stay invisible */
    for (let i = 0; i < 5; i++) {
      const r = TILE * (0.1 + rnd() * 0.2);
      const x = r + rnd() * (TILE - r * 2), y = r + rnd() * (TILE - r * 2);
      const g = p.createRadialGradient(x, y, 0, x, y, r);
      if (key === 'red') {
        g.addColorStop(0, `rgba(178,58,43,${0.028 + rnd() * 0.035})`);
        g.addColorStop(1, 'rgba(178,58,43,0)');
      } else if (key === 'dark') {
        g.addColorStop(0, `rgba(237,231,217,${0.016 + rnd() * 0.02})`);
        g.addColorStop(1, 'rgba(237,231,217,0)');
      } else {
        g.addColorStop(0, `rgba(112,102,80,${0.02 + rnd() * 0.022})`);
        g.addColorStop(1, 'rgba(112,102,80,0)');
      }
      p.fillStyle = g;
      p.fillRect(x - r, y - r, r * 2, r * 2);
    }
    /* a couple of dried drips for the red field */
    if (key === 'red') {
      for (let i = 0; i < 2; i++) {
        const x = 40 + rnd() * (TILE - 80), y = 40 + rnd() * (TILE - 80);
        const len = 26 + rnd() * 60;
        inkStroke(p, [
          { x, y },
          { x: x + (rnd() - 0.5) * 6, y: y + len * 0.6 },
          { x: x + (rnd() - 0.5) * 4, y: y + len },
        ], 2.6, { alpha: 0.1, color: RED });
        blobPath(p, x + (rnd() - 0.5) * 4, y + len, 3.4, (rnd() * 1e9) | 0, 0.3, 8);
        p.fillStyle = RED; p.globalAlpha = 0.14; p.fill(); p.globalAlpha = 1;
      }
    }
    return c;
  }

  function ensureTiles(ctx, dpr) {
    ensurePatterns(ctx);
    if (tileDpr === dpr && tiles.pale) return;
    tileDpr = dpr;
    tiles = {
      pale: buildTile('pale', dpr),
      dark: buildTile('dark', dpr),
      red: buildTile('red', dpr),
    };
  }

  /* ---------------- brush primitives ---------------- */
  function blobPath(c, x, y, r, seed, wob = 0.16, n = 11) {
    const rnd = mulberry(seed);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const rr = r * (1 + (rnd() * 2 - 1) * wob);
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    c.beginPath();
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let m = mid(pts[n - 1], pts[0]);
    c.moveTo(m[0], m[1]);
    for (let i = 0; i < n; i++) {
      const q = pts[(i + 1) % n];
      m = mid(pts[i], q);
      c.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    c.closePath();
  }

  /* tapered calligraphic stroke through pts (max width at belly) */
  function inkStroke(c, pts, maxW, o = {}) {
    if (pts.length < 2) return;
    const n = pts.length;
    const rnd = mulberry(o.seed ?? 7);
    const taper = o.taper ?? 0.75;
    const jit = o.jit ?? 0.18;
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const q = pts[Math.min(n - 1, i + 1)], r0 = pts[Math.max(0, i - 1)];
      let dx = q.x - r0.x, dy = q.y - r0.y;
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const t = i / (n - 1);
      const prof = Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, t))), taper);
      const w = Math.max(0.35, maxW * prof * (1 - jit + rnd() * jit * 2));
      left.push({ x: pts[i].x - dy * w / 2, y: pts[i].y + dx * w / 2 });
      right.push({ x: pts[i].x + dy * w / 2, y: pts[i].y - dx * w / 2 });
    }
    c.save();
    c.beginPath();
    c.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < n; i++) c.lineTo(left[i].x, left[i].y);
    for (let i = n - 1; i >= 0; i--) c.lineTo(right[i].x, right[i].y);
    c.closePath();
    c.globalAlpha = o.alpha ?? 1;
    c.fillStyle = o.color ?? INK;
    c.fill();
    if (o.dry && maxW > 5) {
      c.clip();
      c.strokeStyle = o.dryColor ?? PAPER;
      c.globalAlpha = (o.alpha ?? 1) * 0.4;
      c.lineWidth = 1.1; c.lineCap = 'round';
      for (let k = 0; k < 2; k++) {
        const off = (rnd() - 0.5) * maxW * 0.7;
        c.beginPath();
        for (let i = 0; i < n; i++) {
          const q = pts[Math.min(n - 1, i + 1)], r0 = pts[Math.max(0, i - 1)];
          let dx = q.x - r0.x, dy = q.y - r0.y;
          const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
          const x = pts[i].x - dy * off, y = pts[i].y + dx * off;
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.stroke();
      }
    }
    c.restore();
  }

  /* teardrop pointing +x, path only (r = body radius) */
  function teardrop(c, r) {
    c.beginPath();
    c.moveTo(r * 1.75, 0);
    c.quadraticCurveTo(r * 0.35, r * 0.95, -r * 0.15, r * 0.62);
    c.arc(-r * 0.15, 0, r * 0.62, Math.PI * 0.5, Math.PI * 1.5);
    c.quadraticCurveTo(r * 0.35, -r * 0.95, r * 1.75, 0);
    c.closePath();
  }

  function splatPaint(c, x, y, r, seed, alpha = 0.5, color = INK) {
    const rnd = mulberry(seed);
    c.save();
    c.fillStyle = color;
    c.globalAlpha = alpha;
    blobPath(c, x, y, r * 0.6, seed, 0.42, 10);
    c.fill();
    const k = 4 + Math.floor(rnd() * 5);
    for (let i = 0; i < k; i++) {
      const a = rnd() * TAU;
      const d = r * (0.85 + rnd() * 1.5);
      c.save();
      c.translate(x + Math.cos(a) * d, y + Math.sin(a) * d);
      c.rotate(a);
      teardrop(c, r * (0.1 + rnd() * 0.2));
      c.fill();
      c.restore();
    }
    const sk = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < sk; i++) {
      const a = rnd() * TAU;
      const len = r * (0.8 + rnd() * 1.2);
      inkStroke(c, [
        { x: x + Math.cos(a) * r * 0.35, y: y + Math.sin(a) * r * 0.35 },
        { x: x + Math.cos(a) * (r * 0.35 + len), y: y + Math.sin(a) * (r * 0.35 + len) },
      ], Math.max(1.2, r * 0.14), { alpha: alpha * 0.55, color });
    }
    c.restore();
  }

  /* angry paper eyes on an ink body */
  function eyeSlits(c, ang, r, len = 1) {
    c.save();
    c.strokeStyle = PAPER;
    c.lineCap = 'round';
    c.lineWidth = Math.max(1.7, r * 0.14);
    for (const s of [-1, 1]) {
      const a = ang + s * 0.55;
      const ex = Math.cos(a) * r * 0.42, ey = Math.sin(a) * r * 0.42;
      const tilt = a + s * 0.4;
      const l = r * 0.5 * len;
      c.beginPath();
      c.moveTo(ex - Math.cos(tilt) * l / 2, ey - Math.sin(tilt) * l / 2);
      c.lineTo(ex + Math.cos(tilt) * l / 2, ey + Math.sin(tilt) * l / 2);
      c.stroke();
    }
    c.restore();
  }

  /* ---------------- stains: dried ink, cached as sprites ---------------- */
  function stampStains(S) {
    if (!S.stainQueue.length) return;
    for (const q of S.stainQueue) {
      const r = Math.max(2.4, q.r);
      const scale = 2; /* render sprites at 2x for crisp hidpi */
      const half = Math.ceil(r * 2.9);
      const spr = document.createElement('canvas');
      spr.width = spr.height = half * 2 * scale;
      const g = spr.getContext('2d');
      g.setTransform(scale, 0, 0, scale, half * scale, half * scale);
      splatPaint(g, 0, 0, r, (Math.random() * 1e9) | 0, q.alpha ?? 0.5, q.red ? RED : INK);
      stains.push({ x: q.x, y: q.y, a: q.alpha ?? 0.5, age: 0, spr, half });
    }
    S.stainQueue.length = 0;
    while (stains.length > CFG.world.stainCap) stains.shift();
  }

  function updateStains(dt) {
    const fade = CFG.world.stainFade;
    for (let i = stains.length - 1; i >= 0; i--) {
      const st = stains[i];
      st.age += dt;
      if (st.a * (1 - st.age * fade) <= 0.02) {
        stains[i] = stains[stains.length - 1];
        stains.pop();
      }
    }
  }

  function resetStains() { stains.length = 0; }

  /* ---------------- ambient paper marks (world decor) ----------------
     faint hairs, flecks and ghost seals scattered across the sheet,
     so the endless paper still feels like a hand-made object */
  const KANJI_DECO = ['風', '月', '花', '山', '川', '紙', '雲'];
  function drawDecor(c, x0, y0, x1, y1) {
    const cell = CFG.world.decoCell;
    const cx0 = Math.floor(x0 / cell), cx1 = Math.floor(x1 / cell);
    const cy0 = Math.floor(y0 / cell), cy1 = Math.floor(y1 / cell);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const r0 = hash2(cx, cy);
        if (r0 < 0.42) continue;
        const rx = hash2(cx * 3 + 1, cy * 7 + 2);
        const ry = hash2(cx * 5 + 9, cy * 11 + 4);
        const x = cx * cell + rx * cell;
        const y = cy * cell + ry * cell;
        const v = Math.floor(r0 * 997) % 6;
        if (v === 0) { /* a stray hair from the brush */
          const a = hash2(cx + 13, cy + 17) * TAU;
          const l = 14 + rx * 22;
          inkStroke(c, [
            { x, y },
            { x: x + Math.cos(a) * l * 0.6, y: y + Math.sin(a) * l * 0.4 + 3 },
            { x: x + Math.cos(a) * l, y: y + Math.sin(a) * l },
          ], 1.5, { alpha: 0.09, jit: 0.3, seed: (cx * 31 + cy) | 0 });
        } else if (v === 1) { /* flecks */
          c.fillStyle = INK;
          c.globalAlpha = 0.1;
          for (let k = 0; k < 3; k++) {
            c.beginPath();
            c.arc(x + (hash2(cx + k, cy) - 0.5) * 26, y + (hash2(cx, cy + k) - 0.5) * 26, 0.7 + hash2(cx + k * 3, cy + k) * 1.4, 0, TAU);
            c.fill();
          }
          c.globalAlpha = 1;
        } else if (v === 2) { /* a faint pool of old ink */
          c.globalAlpha = 0.045;
          c.fillStyle = INK;
          blobPath(c, x, y, 12 + rx * 16, (cx * 97 + cy * 31) | 0, 0.4, 9);
          c.fill();
          c.globalAlpha = 1;
        } else if (v === 3) { /* a ghost droplet */
          c.save();
          c.translate(x, y);
          c.rotate(hash2(cx * 7, cy * 3) * TAU);
          c.globalAlpha = 0.07;
          c.fillStyle = INK;
          teardrop(c, 4 + rx * 5);
          c.fill();
          c.restore();
          c.globalAlpha = 1;
        } else if (v === 4 && r0 > 0.93) { /* a vermillion ghost seal */
          c.save();
          c.translate(x, y);
          c.rotate(-0.1 + rx * 0.2);
          c.globalAlpha = 0.06;
          c.fillStyle = RED;
          c.fillRect(-7, -7, 14, 14);
          c.restore();
          c.globalAlpha = 1;
        } else if (v === 5 && r0 > 0.9) { /* a huge, faint character */
          const ch = KANJI_DECO[Math.floor(r0 * 1000) % KANJI_DECO.length];
          c.save();
          c.translate(x, y);
          c.rotate((rx - 0.5) * 0.2);
          c.globalAlpha = 0.045;
          c.fillStyle = INK;
          c.font = `${64 + Math.floor(ry * 56)}px "Zen Antique", serif`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(ch, 0, 0);
          c.restore();
          c.globalAlpha = 1;
        }
      }
    }
  }

  /* ---------------- creatures ---------------- */
  function seedFor(e, tick) { return ((e.seed * 8191) | 0) ^ (tick * 7919); }

  /* the guardian's red seal, worn above the beast */
  function eliteMark(c, r) {
    c.save();
    c.translate(0, -r - 15);
    c.rotate(-0.12 + Math.sin(G.S.clockT * 2.2) * 0.04);
    c.fillStyle = RED;
    c.fillRect(-7, -7, 14, 14);
    c.fillStyle = PAPER;
    c.font = '10px "Zen Antique", serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('危', 0, 0.5);
    c.restore();
  }

  function drawEnemy(c, e, t) {
    const S = G.S;
    const tick = Math.floor(t / CFG.ink.boilRate);
    const sd = seedFor(e, tick);
    const r = e.r;
    c.save();
    c.translate(e.x, e.y);
    c.fillStyle = INK;
    c.strokeStyle = INK;
    c.lineJoin = 'round';
    c.lineCap = 'round';

    let silhouette = null; /* path fn for hit-flash overlay */

    switch (e.type) {
      case 'pulse': { /* BLOT — a living drop of ink */
        const ang = Math.atan2(S.player.y - e.y, S.player.x - e.x);
        const sq = 1 + Math.sin(e.t * 6 + e.seed) * 0.035;
        c.save();
        c.rotate(ang); c.scale(sq, 2 - sq); c.rotate(-ang);
        blobPath(c, 0, 0, r, sd, 0.17, 10);
        c.fill();
        c.restore();
        silhouette = () => blobPath(c, 0, 0, r * 1.05, sd, 0.17, 10);
        eyeSlits(c, ang, r);
        break;
      }
      case 'dart': { /* SPEAR — a brush tip that lunges */
        const st = e.state;
        c.rotate(e.ang);
        if (st === 'dash') {
          c.scale(1.55, 0.72);
          teardrop(c, r);
          c.fill();
        } else if (st === 'tele') {
          const jit = (Math.random() - 0.5) * 1.6;
          c.translate(jit, jit);
          c.scale(1.14, 1.14);
          teardrop(c, r);
          c.save(); c.fillStyle = patHatch; c.fill(); c.restore();
          c.lineWidth = 1.8; c.stroke();
        } else if (st === 'rest') {
          c.scale(0.85, 0.85);
          blobPath(c, 0, 0, r * 0.8, sd, 0.25, 9);
          c.lineWidth = 1.8; c.stroke();
        } else { /* cruise */
          teardrop(c, r);
          c.lineWidth = 2;
          c.stroke();
          c.translate(0.8, 0.6);
          c.globalAlpha = 0.3;
          c.stroke();
        }
        silhouette = () => { c.save(); c.rotate(e.ang); teardrop(c, r * 1.1); c.restore(); };
        break;
      }
      case 'split': { /* DRIP — a hanging drop of ink */
        c.rotate(-Math.PI / 2 + Math.sin(e.t * 2.2 + e.seed) * 0.35);
        teardrop(c, r);
        c.lineWidth = 2;
        c.stroke();
        c.save(); c.globalAlpha = 0.25; c.fill(); c.restore();
        c.beginPath(); c.arc(r * 0.15, 0, r * 0.2, 0, TAU); c.fill();
        silhouette = () => { c.save(); c.rotate(-Math.PI / 2); teardrop(c, r * 1.08); c.restore(); };
        break;
      }
      case 'slab': { /* BRUTE — a heavy, dripping mass */
        const breathe = 1 + Math.sin(e.t * 2 + e.seed) * 0.03;
        c.save();
        c.rotate(Math.sin(e.t * 1.4 + e.seed) * 0.06);
        c.scale(breathe, breathe);
        blobPath(c, 0, 0, r, sd, 0.12, 14);
        c.fill();
        c.save(); c.globalAlpha = 0.5; c.fillStyle = patHatch; c.fill(); c.restore();
        c.lineWidth = 2.4;
        blobPath(c, 0, 0, r, sd, 0.12, 14);
        c.stroke();
        /* drips hanging off the bottom */
        const drips = mulberry(sd >> 3);
        for (let i = 0; i < 3; i++) {
          const dx = (drips() - 0.5) * r * 1.4;
          const len = r * (0.4 + drips() * 0.5) * (1 + Math.sin(t * 3 + i * 2 + e.seed) * 0.25);
          inkStroke(c, [
            { x: dx, y: r * 0.7 },
            { x: dx + (drips() - 0.5) * 3, y: r * 0.7 + len * 0.6 },
            { x: dx + (drips() - 0.5) * 2, y: r * 0.7 + len },
          ], 2.4, { alpha: 0.85 });
        }
        c.restore();
        const ang = Math.atan2(S.player.y - e.y, S.player.x - e.x);
        eyeSlits(c, ang, r, 0.8);
        silhouette = () => blobPath(c, 0, 0, r * 1.06, sd, 0.12, 14);
        break;
      }
      case 'spit': { /* SPIT — a puffed bladder with an open maw */
        const st = e.state;
        const ang = Math.atan2(S.player.y - e.y, S.player.x - e.x);
        if (st === 'tele') {
          const pr = Math.min(1, e.stateT / 0.5);
          const jit = (Math.random() - 0.5) * 1.4;
          c.translate(jit, jit);
          c.scale(1 + pr * 0.3, 1 + pr * 0.3);
          blobPath(c, 0, 0, r, sd, 0.18, 10);
          c.save(); c.fillStyle = patHatch; c.fill(); c.restore();
          c.lineWidth = 2.2; c.stroke();
        } else if (st === 'spit') {
          c.scale(1.22, 0.82);
          blobPath(c, 0, 0, r, sd, 0.16, 10);
          c.fill();
        } else {
          const breathe = 1 + Math.sin(e.t * 4 + e.seed) * 0.04;
          c.scale(breathe, 2 - breathe);
          blobPath(c, 0, 0, r, sd, 0.18, 10);
          c.lineWidth = 2;
          c.stroke();
          c.save(); c.globalAlpha = 0.14; c.fill(); c.restore();
        }
        /* the maw — a paper wedge aimed at you */
        const open = st === 'tele' ? 1 : 0.5;
        c.save();
        c.rotate(ang);
        c.fillStyle = PAPER;
        c.beginPath();
        c.moveTo(r * 0.35, 0);
        c.lineTo(r * (1.02 + 0.16 * open), -r * 0.34 * open);
        c.lineTo(r * (1.02 + 0.16 * open), r * 0.34 * open);
        c.closePath();
        c.fill();
        c.restore();
        eyeSlits(c, ang, r, 0.6);
        silhouette = () => blobPath(c, 0, 0, r * 1.08, sd, 0.18, 10);
        break;
      }
      case 'moth': { /* MOTH — a flicker of ink that never holds course */
        c.rotate(e.ang);
        const flap = Math.sin(e.t * 13 + e.seed);
        c.scale(1 + flap * 0.08, 1 - flap * 0.14);
        /* ghost echoes of the last flick */
        for (let g = 1; g <= 2; g++) {
          c.save();
          c.globalAlpha = 0.16 / g;
          c.translate(-g * 9, Math.sin(e.t * 13 + e.seed + g) * 3);
          teardrop(c, r * 0.85);
          c.fill();
          c.restore();
        }
        teardrop(c, r);
        c.fill();
        /* whisker antennae */
        c.strokeStyle = INK; c.lineWidth = 1.3;
        c.beginPath(); c.moveTo(r * 1.1, -r * 0.2); c.lineTo(r * 1.7, -r * 0.6); c.stroke();
        c.beginPath(); c.moveTo(r * 1.1, r * 0.2); c.lineTo(r * 1.7, r * 0.6); c.stroke();
        silhouette = () => { c.save(); c.rotate(e.ang); teardrop(c, r * 1.1); c.restore(); };
        break;
      }
      case 'shade': { /* SHADE — dissolving into nothing, then behind you */
        const st = e.state;
        let alpha = 0.72;
        let stretch = 1;
        if (st === 'dissolve') {
          const pr = Math.min(1, e.stateT / 0.55);
          alpha = 0.72 * (1 - pr * 0.92);
          stretch = 1 + pr * 0.3;
        } else if (st === 'pounce') {
          alpha = 1; stretch = 1.35;
        } else if (st === 'rest') {
          alpha = 0.9;
        }
        c.globalAlpha = alpha;
        if (st === 'dissolve') {
          /* the body frays into drifting flecks */
          const pr = Math.min(1, e.stateT / 0.55);
          const rnd = mulberry(sd >> 2);
          for (let i = 0; i < 5; i++) {
            const fa = rnd() * TAU, fd = r * (0.3 + rnd() * 1.2) * (0.4 + pr);
            c.save();
            c.translate(Math.cos(fa) * fd, Math.sin(fa) * fd);
            c.rotate(fa);
            teardrop(c, r * 0.3 * (1 - pr * 0.5));
            c.fill();
            c.restore();
          }
        }
        c.rotate(e.ang);
        c.scale(stretch, 2 - stretch);
        blobPath(c, 0, 0, r, sd, 0.3, 9);
        c.fill();
        c.globalAlpha = alpha;
        c.lineWidth = 1.6;
        blobPath(c, 0, 0, r * 0.95, sd ^ 31, 0.32, 9);
        c.stroke();
        /* hollow eyes — two paper slits, always */
        eyeSlits(c, 0, r, 0.9);
        silhouette = () => blobPath(c, 0, 0, r * 1.1, sd, 0.3, 9);
        break;
      }
      case 'titan': { /* TITAN — the mother of blots */
        const breathe = 1 + Math.sin(e.t * 1.6 + e.seed) * 0.035;
        c.save();
        c.rotate(Math.sin(e.t * 0.9 + e.seed) * 0.05);
        c.scale(breathe, breathe);
        blobPath(c, 0, 0, r, sd, 0.11, 16);
        c.fill();
        c.save(); c.globalAlpha = 0.42; c.fillStyle = patHatch; c.fill(); c.restore();
        c.lineWidth = 2.6;
        blobPath(c, 0, 0, r, sd, 0.11, 16);
        c.stroke();
        /* heavy hanging drips */
        const drips = mulberry(sd >> 4);
        for (let i = 0; i < 5; i++) {
          const dx = (drips() - 0.5) * r * 1.5;
          const len = r * (0.25 + drips() * 0.45) * (1 + Math.sin(t * 2.4 + i * 1.7 + e.seed) * 0.3);
          inkStroke(c, [
            { x: dx, y: r * 0.72 },
            { x: dx + (drips() - 0.5) * 4, y: r * 0.72 + len * 0.6 },
            { x: dx + (drips() - 0.5) * 3, y: r * 0.72 + len },
          ], 3.2, { alpha: 0.85 });
        }
        /* brood dots circling the mass */
        for (let i = 0; i < 3; i++) {
          const oa = e.t * 1.4 + (i / 3) * TAU + e.seed;
          c.beginPath();
          c.arc(Math.cos(oa) * (r + 9), Math.sin(oa) * (r + 9), 2.6, 0, TAU);
          c.fill();
        }
        c.restore();
        const ang = Math.atan2(S.player.y - e.y, S.player.x - e.x);
        eyeSlits(c, ang, r, 0.85);
        silhouette = () => blobPath(c, 0, 0, r * 1.05, sd, 0.11, 16);
        break;
      }
      case 'wraith': { /* WISP — smoke given intent */
        c.save();
        c.globalAlpha = 0.22;
        c.translate(-Math.cos(e.ang) * 10, -Math.sin(e.ang) * 10);
        blobPath(c, 0, 0, r * 0.9, sd - 7, 0.4, 9);
        c.fill();
        c.restore();
        c.save();
        c.globalAlpha = 0.3;
        blobPath(c, 0, 0, r, sd ^ 99, 0.34, 9);
        c.fill();
        c.restore();
        c.globalAlpha = 0.9;
        c.lineWidth = 2.2;
        blobPath(c, 0, 0, r * 0.92, sd, 0.3, 9);
        c.stroke();
        const oa = e.t * 4 + e.seed;
        c.globalAlpha = 1;
        c.beginPath();
        c.arc(Math.cos(oa) * (r + 5), Math.sin(oa) * (r + 5), 2.6, 0, TAU);
        c.fill();
        silhouette = () => blobPath(c, 0, 0, r, sd, 0.34, 9);
        break;
      }
      case 'kage': { /* KAGE — a stain that circles, then cuts through you */
        const st = e.state;
        const ang = Math.atan2(G.S.player.y - e.y, G.S.player.x - e.x);
        if (st === 'tele') {
          const jit = (Math.random() - 0.5) * 2;
          c.translate(jit, jit);
          c.save();
          c.rotate(ang); c.scale(1.25, 0.8); c.rotate(-ang);
          blobPath(c, 0, 0, r, sd, 0.3, 9);
          c.save(); c.fillStyle = patHatch; c.fill(); c.restore();
          c.lineWidth = 2; c.stroke();
          c.restore();
        } else if (st === 'dash') {
          const da = Math.atan2(e.py, e.px);
          /* afterimages behind the cut */
          for (let g = 2; g >= 1; g--) {
            c.save();
            c.globalAlpha = 0.16 / g;
            c.translate(-Math.cos(da) * g * 15, -Math.sin(da) * g * 15);
            c.rotate(da); c.scale(1.6, 0.55);
            blobPath(c, 0, 0, r * 0.9, sd ^ g, 0.3, 9);
            c.fill();
            c.restore();
          }
          c.rotate(da); c.scale(1.75, 0.55);
          blobPath(c, 0, 0, r, sd, 0.22, 9);
          c.fill();
        } else if (st === 'rest') {
          c.globalAlpha = 0.55;
          blobPath(c, 0, 0, r * 0.85, sd, 0.3, 9);
          c.fill();
        } else { /* cruise — a low smear with a trailing wisp */
          c.save();
          c.globalAlpha = 0.18;
          c.translate(-Math.cos(e.ang) * 13, -Math.sin(e.ang) * 13);
          blobPath(c, 0, 0, r * 0.8, sd ^ 41, 0.4, 9);
          c.fill();
          c.restore();
          c.save();
          c.rotate(ang); c.scale(1.06, 0.92); c.rotate(-ang);
          blobPath(c, 0, 0, r, sd, 0.26, 10);
          c.fill();
          c.restore();
        }
        eyeSlits(c, st === 'dash' ? Math.atan2(e.py, e.px) : ang, r, 0.75);
        silhouette = () => blobPath(c, 0, 0, r * 1.1, sd, 0.28, 9);
        break;
      }
      case 'stilt': { /* STILT — a tall, patient line that draws its own */
        const st = e.state;
        const ang = e.state === 'aim' || e.state === 'fire' ? e.ang : Math.atan2(G.S.player.y - e.y, G.S.player.x - e.x);
        /* the aim line: a hair drawn toward you, pulled taut */
        if (st === 'aim') {
          const pr = Math.min(1, e.stateT / 0.66);
          c.save();
          c.globalAlpha = 0.1 + 0.42 * pr;
          c.lineWidth = 0.7 + pr * 1.2;
          c.strokeStyle = INK;
          c.beginPath();
          c.moveTo(Math.cos(ang) * (r + 2), Math.sin(ang) * (r + 2));
          c.lineTo(Math.cos(ang) * 640, Math.sin(ang) * 640);
          c.stroke();
          c.restore();
        }
        c.rotate(ang);
        if (st === 'fire') c.scale(1.28, 0.78); /* the recoil */
        /* stilts — two long, thin legs trailing behind */
        const sway = Math.sin(e.t * 2.4 + e.seed) * 2.4;
        inkStroke(c, [
          { x: -r * 0.3, y: -r * 0.45 },
          { x: -r * 1.5, y: -r * 1.05 + sway },
          { x: -r * 2.4, y: -r * 1.5 + sway },
        ], 1.7, { alpha: 0.9 });
        inkStroke(c, [
          { x: -r * 0.3, y: r * 0.45 },
          { x: -r * 1.5, y: r * 1.05 - sway },
          { x: -r * 2.4, y: r * 1.5 - sway },
        ], 1.7, { alpha: 0.9 });
        /* body — a small folded diamond, held high */
        c.beginPath();
        c.moveTo(r * 1.05, 0);
        c.lineTo(r * 0.1, -r * 0.62);
        c.lineTo(-r * 0.75, 0);
        c.lineTo(r * 0.1, r * 0.62);
        c.closePath();
        c.globalAlpha = st === 'aim' ? 0.85 : 0.28;
        c.fill();
        c.globalAlpha = 1;
        c.lineWidth = 1.9;
        c.stroke();
        /* a single paper eye */
        c.strokeStyle = PAPER;
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(r * 0.34, -r * 0.06);
        c.lineTo(r * 0.62, -r * 0.06);
        c.stroke();
        silhouette = () => {
          c.beginPath();
          c.moveTo(r * 1.1, 0);
          c.lineTo(r * 0.1, -r * 0.7);
          c.lineTo(-r * 0.8, 0);
          c.lineTo(r * 0.1, r * 0.7);
          c.closePath();
        };
        break;
      }
      case 'oni': { /* ONI — a horned mass that bulldozes straight ahead */
        const st = e.state;
        const ang = Math.atan2(G.S.player.y - e.y, G.S.player.x - e.x);
        if (st === 'windup') {
          const jit = (Math.random() - 0.5) * 2.4;
          c.translate(jit, jit);
        }
        if (st === 'charge') {
          c.rotate(e.ang);
          c.scale(1.5, 0.78);
          blobPath(c, 0, 0, r, sd, 0.13, 13);
          c.fill();
          /* speed lines peeling off the shoulders */
          c.globalAlpha = 0.35;
          c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(-r * 1.1, -r * 0.5); c.lineTo(-r * 2.3, -r * 0.7); c.stroke();
          c.beginPath(); c.moveTo(-r * 1.1, r * 0.5); c.lineTo(-r * 2.3, r * 0.7); c.stroke();
        } else {
          c.save();
          c.rotate(ang);
          const breathe = 1 + Math.sin(e.t * 2.2 + e.seed) * 0.028;
          c.scale(breathe, breathe);
          blobPath(c, 0, 0, r, sd, 0.12, 13);
          c.fill();
          if (st === 'windup') {
            c.save(); c.globalAlpha = 0.5; c.fillStyle = patHatch; c.fill(); c.restore();
            c.save(); c.globalAlpha = 0.2; c.fillStyle = RED; blobPath(c, 0, 0, r, sd, 0.12, 13); c.fill(); c.restore();
          }
          c.lineWidth = 2.4;
          blobPath(c, 0, 0, r, sd, 0.12, 13);
          c.stroke();
          /* the horns */
          inkStroke(c, [
            { x: -r * 0.15, y: -r * 0.8 },
            { x: -r * 0.05, y: -r * 1.25 },
            { x: r * 0.28, y: -r * 1.45 },
          ], 2.6, { alpha: 0.95 });
          inkStroke(c, [
            { x: -r * 0.15, y: r * 0.8 },
            { x: -r * 0.05, y: r * 1.25 },
            { x: r * 0.28, y: r * 1.45 },
          ], 2.6, { alpha: 0.95 });
          eyeSlits(c, 0, r, 0.7);
          c.restore();
        }
        silhouette = () => blobPath(c, 0, 0, r * 1.06, sd, 0.13, 13);
        break;
      }
      case 'crane': { /* CRANE — folded paper that swoops past in arcs */
        const st = e.state;
        c.rotate(e.ang);
        const flap = Math.sin(e.t * 10 + e.seed);
        if (st === 'pass') {
          /* a ghost of the arc it just cut */
          c.save();
          c.globalAlpha = 0.14;
          c.translate(-14, flap * 3);
          cranePath(c, r * 0.92, -flap * 0.5);
          c.stroke();
          c.restore();
        }
        cranePath(c, r, flap);
        c.globalAlpha = st === 'pass' ? 0.95 : 0.16;
        c.fill();
        c.globalAlpha = 1;
        c.lineWidth = 1.9;
        cranePath(c, r, flap);
        c.stroke();
        /* a red eye-dot, the one fleck of color */
        c.fillStyle = RED;
        c.beginPath();
        c.arc(r * 0.82, -r * 0.1, 1.6, 0, TAU);
        c.fill();
        silhouette = () => cranePath(c, r * 1.08, flap);
        break;
      }
      default: { /* BLIP — a shard of the drip */
        blobPath(c, 0, 0, r, sd, 0.24, 9);
        c.fill();
        silhouette = () => blobPath(c, 0, 0, r * 1.1, sd, 0.24, 9);
        const ang = Math.atan2(S.player.y - e.y, S.player.x - e.x);
        eyeSlits(c, ang, r, 0.7);
      }
    }

    /* the guardian's mark */
    if (e.elite) eliteMark(c, r);

    /* wet paper: slowed creatures wear a drooping halo */
    if (e.slowT > 0 && e.type !== 'shade') {
      c.save();
      c.globalAlpha = Math.min(0.5, e.slowT) * 0.6;
      c.strokeStyle = INK;
      c.lineWidth = 1.3;
      blobPath(c, 0, 0, r * 1.32, sd ^ 77, 0.2, 9);
      c.stroke();
      c.restore();
    }

    /* hit flash: the ink recoils to paper */
    if (e.hitFlash > 0 && silhouette) {
      c.save();
      c.globalAlpha = Math.min(1, e.hitFlash / 0.08) * 0.92;
      c.fillStyle = PAPER;
      const sc = 1 + e.hitFlash * 1.6;
      c.scale(sc, sc);
      silhouette();
      c.fill();
      c.restore();
    }
    /* Minimal ink-seal integrity line: phase changes stay legible even
       with dense enemy crowds. It belongs to the existing enemy drawing. */
    if (e.guardian) {
      const width = e.guardian.boss ? 86 : 64;
      const top = -r - 33;
      const frac = Math.max(0, Math.min(1, e.hp / e.maxHp));
      c.save();
      c.fillStyle = INK;c.globalAlpha = .25;
      c.fillRect(-width / 2, top, width, 3);
      c.fillStyle = RED;c.globalAlpha = .95;
      c.fillRect(-width / 2, top, width * frac, 3);
      for (let k = 1; k < (e.guardian.boss ? 3 : 2); k++) {
        c.fillStyle = PAPER;c.globalAlpha = .9;
        c.fillRect(-width / 2 + width * k / (e.guardian.boss ? 3 : 2) - .6, top, 1.2, 3);
      }
      c.restore();
    }
    c.restore();
  }

  /* folded-paper crane silhouette (body + raised wing), flap ∈ [-1,1] */
  function cranePath(c, r, flap) {
    const w = r * (0.95 + flap * 0.4);
    c.beginPath();
    c.moveTo(r * 1.55, 0);            /* beak */
    c.lineTo(-r * 0.05, -r * 0.3);    /* neck ridge */
    c.lineTo(-r * 0.45, -w);          /* wing tip */
    c.lineTo(-r * 0.95, -r * 0.22);   /* wing root */
    c.lineTo(-r * 1.5, -r * 0.05);    /* tail point */
    c.lineTo(-r * 0.6, r * 0.3);      /* under-tail */
    c.lineTo(r * 0.25, r * 0.4);      /* belly */
    c.closePath();
  }

  /* ---------------- player: the awakened brush spirit ---------------- */
  /* A living version of the original blobPath's midpoint brush contour.
     Fixed seeded lobes give the character an identity, while continuous
     small deformations give it that breathing hand-drawn ink personality.
     Neither world coordinates nor random frame seeds affect the outline. */
  function livingBlobPath(c, r, seed, t, reduced) {
    const n = 13, rnd = mulberry(seed), pts = [];
    const breath = reduced ? 1 : 1 + Math.sin(t * 3.1 + seed * .001) * .028;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n;
      const stable = (rnd() * 2 - 1) * .125;
      const flow = reduced ? 0
        : .045 * Math.sin(t * 4.6 + a * 2 + i * .41 + seed * .004)
        + .018 * Math.sin(t * 2.3 - a * 3 + i * .73);
      const rr = r * breath * (1 + stable + flow);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    c.beginPath();
    const first = pts[n-1], firstNext = pts[0];
    c.moveTo((first[0]+firstNext[0])*.5,(first[1]+firstNext[1])*.5);
    for(let i=0;i<n;i++){
      const q=pts[(i+1)%n];
      c.quadraticCurveTo(pts[i][0],pts[i][1],
        (pts[i][0]+q[0])*.5,(pts[i][1]+q[1])*.5);
    }
    c.closePath();
  }


  function drawPlayer(c, t) {
    const S = G.S, p = S.player, st = S.stats;
    const guarded = S.invulnT > 0;
    /* The nib identity is fixed at the beginning of the run. World motion
       NEVER re-seeds the outline: movement only translates this drawing. */
    const sd = p.visualSeed || 0x51a7;
    const form = INK_XP.visualForm(st);
    const scale = p.displayScale || 1;
    const vx = p.visualMoveX || 0, vy = p.visualMoveY || 0;
    const motion = Math.min(1, Math.hypot(vx, vy));
    const aim = p.visualAim == null ? p.aim : p.visualAim;

    /* Original wisps of paper history remain, but the player does not
       drag an oversized oscillating comet across the whole sheet. */
    if (S.mode === 'playing' && motion > 0.15 &&
        t - lastTrailT > CFG.ink.trailGap && !S.reduced) {
      lastTrailT = t;
      S.stainQueue.push({
        x: p.x + (Math.random() - 0.5) * 4,
        y: p.y + (Math.random() - 0.5) * 4,
        r: 2.2, alpha: 0.12,
      });
    }

    /* An anchored dry-brush tail. Direction changes are damped by the
       visual velocity so rapid thumb movement never snaps the ink shape. */
    if (motion > 0.08) {
      const a = Math.atan2(-vy, -vx);
      const len = 9 + 7 * motion + form.tier * 1.8;
      const sway = S.reduced ? 0 : Math.sin(t * 1.9 + sd * .001) * .65;
      const root = p.r * .55;
      const x0 = p.x + Math.cos(a) * root;
      const y0 = p.y + Math.sin(a) * root;
      inkStroke(c, [
        { x: x0, y: y0 },
        { x: x0 + Math.cos(a) * len * .53 - Math.sin(a) * sway,
          y: y0 + Math.sin(a) * len * .53 + Math.cos(a) * sway },
        { x: x0 + Math.cos(a) * len, y: y0 + Math.sin(a) * len },
      ], 5.5 + form.tier * .7, {
        alpha: .75, taper: 1.22, seed: sd, jit: .08,
        dry: form.tier > 0, dryColor: PAPER,
      });
    }

    c.save();
    /* Recoil is a small nib response; shots, collision and camera remain
       at their unmodified positions. No scaling is applied to orbit/ward. */
    const recoil = Math.min(.9, Math.max(0, p.recoil) * .55);
    c.translate(p.x - Math.cos(aim) * recoil,
      p.y - Math.sin(aim) * recoil);

    if (S.adrenT > 0) {
      const ma = Math.atan2(-vy || Math.sin(aim), -vx || Math.cos(aim));
      c.save(); c.globalAlpha = .26;
      for (const off of [-.5, .5]) {
        const a = ma + off;
        inkStroke(c, [
          { x: Math.cos(a) * 13, y: Math.sin(a) * 13 },
          { x: Math.cos(a) * 18, y: Math.sin(a) * 18 },
        ], 1.4, { alpha: .42, seed: sd });
      }
      c.restore();
    }

    /* Bring back the original ROUND, organic blob and its living contour.
       The last nib-only outline flattened the character's personality.
       Growth is still gently eased and the collision radius never changes. */
    c.save();
    c.scale(scale, scale);
    c.rotate(p.visualTilt || 0);
    const r = p.r, tier = form.tier;
    c.globalAlpha = .99;
    c.fillStyle = INK;
    livingBlobPath(c, r, sd, t, S.reduced);
    c.fill();

    /* Rank adds workmanship rather than simple inflation: a dry edge,
       extra restrained bristles and eventually one cinnabar seal fleck. */
    if (tier > 0) {
      c.strokeStyle = PAPER; c.lineWidth = .65;
      c.globalAlpha = tier >= 2 ? .17 : .11;
      c.beginPath(); c.moveTo(-r * .65, -r * .62);
      c.quadraticCurveTo(-r * .83, -.5, -r * .62, r * .52); c.stroke();
      c.globalAlpha = .50; c.strokeStyle = INK;
      c.lineCap = 'round';
      for (let i = 0; i < form.bristles; i++) {
        const y = (i - (form.bristles - 1) * .5) * 2.1;
        c.lineWidth = .95 - i * .08;
        c.beginPath(); c.moveTo(-r * .75, y);
        c.quadraticCurveTo(-r * 1.10, y + .45, -r * (1.26 + tier * .085), y + .30);
        c.stroke();
      }
    }
    if (tier === 3) {
      c.globalAlpha = .52; c.fillStyle = RED;
      c.fillRect(-r * .45, r * .42, 1.15, 1.15);
    }

    /* One quiet paper eye faces the smoothed target aim. */
    c.globalAlpha = 1;
    const ex = Math.cos(aim) * r * .42, ey = Math.sin(aim) * r * .42;
    const el = 4.35;
    c.strokeStyle = PAPER; c.lineWidth = 1.8; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(ex - Math.cos(aim) * el / 2, ey - Math.sin(aim) * el / 2);
    c.lineTo(ex + Math.cos(aim) * el / 2, ey + Math.sin(aim) * el / 2);
    c.stroke();
    c.restore();

    /* Invulnerability glows through a restrained ink-outline breath instead
       of strobing the entire character at 18 Hz. Immunity is unchanged. */
    if (guarded) {
      c.save();
      c.globalAlpha = S.reduced ? .42 : .38 + Math.sin(t * 3.1) * .08;
      c.strokeStyle = INK; c.lineWidth = 1.2;
      c.beginPath(); c.arc(0, 0, p.r * scale + 4.5, 0, TAU); c.stroke();
      c.restore();
    }

    /* Existing defensive orbit stays in actual world units. */
    if (st && st.orb > 0) {
      const orbR = CFG.orbit.radius(st.orb);
      const base = S.clockT || t;
      c.save(); c.globalAlpha = .10;
      c.strokeStyle = INK; c.lineWidth = 1;
      c.beginPath(); c.arc(0, 0, orbR, 0, TAU); c.stroke();
      c.restore();
      for (let i = 0; i < st.orb; i++) {
        const a = base * CFG.orbit.speed + (i / st.orb) * TAU;
        const ox = Math.cos(a) * orbR, oy = Math.sin(a) * orbR;
        c.save(); c.translate(ox, oy); c.rotate(a + Math.PI / 2);
        c.globalAlpha = .93; c.fillStyle = INK;
        teardrop(c, 3.6); c.fill();
        c.globalAlpha = .28;
        inkStroke(c, [{ x: -6, y: 0 }, { x: -13, y: .4 }],
          1.8, { alpha: 1, seed: sd });
        c.restore();
      }
    }

    /* Paper Ward stays the same size regardless of brush rank. */
    if (st && st.ward) {
      const ready = st.wardCd <= 0;
      const wa = aim + Math.PI;
      c.save();
      c.translate(Math.cos(wa) * (p.r + 12), Math.sin(wa) * (p.r + 12) - 2);
      c.rotate((S.reduced ? 0 : Math.sin(t * 1.7) * .07) - .35);
      c.globalAlpha = ready ? .9 : .2;
      c.strokeStyle = INK; c.lineWidth = 1.4;
      c.strokeRect(-4, -6.5, 8, 13);
      if (ready) { c.fillStyle = RED; c.fillRect(-1.6, -1.6, 3.2, 3.2); }
      c.restore();
    }
    c.restore();
  }

  /* ---------------- projectiles, zones, fx ---------------- */
  function drawBullet(c, b) {
    c.save();
    c.translate(b.x, b.y);
    if (b.kind === 'blade') { /* a folded paper blade, spinning */
      c.rotate(b.ang + b.age * b.spin);
      c.fillStyle = INK;
      c.beginPath();
      c.moveTo(9, 0);
      c.lineTo(-5, 4.6);
      c.lineTo(-2.2, 0);
      c.lineTo(-5, -4.6);
      c.closePath();
      c.fill();
      c.strokeStyle = PAPER;
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(6.5, 0); c.lineTo(-3, 0);
      c.stroke();
    } else { /* a flicked droplet */
      c.rotate(b.ang);
      c.fillStyle = INK;
      teardrop(c, 4.2);
      c.fill();
      inkStroke(c, [{ x: -5, y: 0 }, { x: -14 - b.age * 8, y: 0.6 }], 2.6, { alpha: 0.4 });
    }
    c.restore();
  }

  /* the spitter's lobbed glob / the sniper's needle */
  function drawEBullet(c, b) {
    c.save();
    c.translate(b.x, b.y);
    c.rotate(b.ang);
    if (b.kind === 'needle') {
      c.strokeStyle = INK;
      c.lineWidth = 1.7;
      c.beginPath();
      c.moveTo(7, 0);
      c.lineTo(-11, 0);
      c.stroke();
      c.fillStyle = INK;
      c.beginPath();
      c.arc(6.4, 0, 2.1, 0, TAU);
      c.fill();
      inkStroke(c, [{ x: -10, y: 0 }, { x: -20 - b.age * 10, y: 0.4 }], 1.5, { alpha: 0.3 });
    } else {
      c.strokeStyle = INK;
      c.fillStyle = INK;
      c.lineWidth = 1.8;
      c.beginPath(); c.arc(0, 0, 4.6, 0, TAU); c.stroke();
      c.beginPath(); c.arc(0, 0, 1.7, 0, TAU); c.fill();
      inkStroke(c, [{ x: -6, y: 0 }, { x: -15 - b.age * 6, y: 0.5 }], 2.2, { alpha: 0.32 });
    }
    c.restore();
  }

  /* ink trail puddles — smears that bite */
  function drawPuddle(c, pd) {
    const age = pd.max - pd.life;
    const grow = Math.min(1, age / 0.22);
    const fade = pd.life < 0.45 ? pd.life / 0.45 : 1;
    c.save();
    c.translate(pd.x, pd.y);
    c.scale(1, 0.62);
    c.globalAlpha = 0.34 * fade;
    c.fillStyle = INK;
    blobPath(c, 0, 0, pd.r * grow, pd.seed, 0.34, 12);
    c.fill();
    c.globalAlpha = 0.3 * fade;
    blobPath(c, 0, 0, pd.r * 0.55 * grow, pd.seed ^ 9, 0.4, 10);
    c.fill();
    c.restore();
  }

  /* Ink Knots — thin, breathing brush threads between bound beasts.
     Uses existing inkStroke primitive; no new sprites or visual system. */
  function drawKnot(c, knot, t) {
    const members = knot.members.filter(e => G.S.enemies.includes(e));
    if (!members.length) return;
    const fade = Math.min(1, knot.life / 0.32, (knot.max - knot.life) / 0.16);
    const root = members[0];
    c.save();
    c.globalAlpha = fade;
    if (members.length === 1) {
      /* A loop of ink catches a lone beast. */
      c.strokeStyle = INK;
      c.lineWidth = 1.3;
      c.globalAlpha = 0.5 * fade;
      c.beginPath();
      c.ellipse(root.x, root.y, root.r + 8, root.r + 6, t * 0.15, 0.1, TAU * 0.93);
      c.stroke();
    } else {
      for (let i = 1; i < members.length; i++) {
        const other = members[i];
        const dx = other.x - root.x, dy = other.y - root.y;
        const dist = Math.hypot(dx, dy) || 1;
        const wobble = Math.sin(t * 8 + knot.seed + i) * 5;
        inkStroke(c, [
          { x: root.x, y: root.y },
          { x: (root.x + other.x) / 2 - dy / dist * wobble,
            y: (root.y + other.y) / 2 + dx / dist * wobble },
          { x: other.x, y: other.y },
        ], 2, { color: INK, alpha: fade * 0.72, seed: knot.seed + i, jit: 0.1 });
      }
    }
    /* A restrained vermilion tie seals each knot, not a giant stamp. */
    c.strokeStyle = RED;
    c.lineWidth = 1.7;
    for (const e of members) {
      c.globalAlpha = fade * 0.65;
      c.beginPath();
      c.arc(e.x, e.y, e.r + 3.5, -0.2, Math.PI * 1.45);
      c.stroke();
      c.beginPath();
      c.moveTo(e.x - 4, e.y - e.r - 5);
      c.lineTo(e.x + 2, e.y - e.r - 8);
      c.stroke();
    }
    c.restore();
  }

  /* spirit scribes — lesser brushes hunting alone */
  function drawSpirit(c, sp) {
    c.save();
    c.translate(sp.x, sp.y);
    c.rotate(sp.ang);
    c.fillStyle = INK;
    c.globalAlpha = 0.35;
    inkStroke(c, [{ x: -5, y: 0 }, { x: -15, y: Math.sin(sp.age * 12 + sp.seed) * 2.5 }], 1.8, { alpha: 1 });
    c.globalAlpha = 0.9;
    teardrop(c, 3.4);
    c.fill();
    c.restore();
  }

  function drawMarker(c, m) {
    const def = ENEMIES[m.type];
    const big = m.elite ? CFG.wave.eliteR : 1;
    const pr = 1 - m.t / (m.elite ? 1.7 : 0.62);
    c.save();
    c.translate(m.x, m.y);
    /* puddle spreading */
    c.save();
    c.scale(1, 0.42);
    c.globalAlpha = 0.3 + 0.5 * pr;
    c.fillStyle = m.elite ? RED : INK;
    blobPath(c, 0, 0, def.r * big * (0.55 + 0.95 * pr), (m.x * 7 + m.y * 13) | 0, 0.35, 10);
    c.fill();
    c.restore();
    /* droplets falling in */
    for (let k = 0; k < 3; k++) {
      const dx = (k - 1) * def.r * big * 0.7;
      const dy = -(1 - pr) * 74 - 8 - k * 5;
      c.save();
      c.translate(dx, dy);
      c.rotate(Math.PI / 2);
      c.globalAlpha = 0.85;
      c.fillStyle = m.elite ? RED : INK;
      teardrop(c, (2.4 + pr * 2.2) * big);
      c.fill();
      c.restore();
    }
    c.restore();
  }

  /* Phase 3 additions reuse the existing paper/ink brush palette.
     The original 14 enemy silhouettes and boil animation are unchanged. */
  function drawGuardianHazard(c, mark, t) {
    const warning = mark.t > 0;
    const remain = warning ? Math.max(0, mark.t / mark.maxWarn) : 0;
    const ink = mark.world === 1 ? INK : INK;
    const color = mark.world === 2 ? RED : ink;
    c.save();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (mark.kind === 'seal') {
      const r = mark.radius;
      const pulse = 1 + Math.sin(t * 6.5) * .023;
      c.translate(mark.x, mark.y);
      c.scale(pulse, pulse);
      c.beginPath();
      c.arc(0, 0, r, 0, TAU);
      c.fillStyle = warning ? color : RED;
      c.globalAlpha = warning ? .09 + (1 - remain) * .14 : .38;
      c.fill();
      c.globalAlpha = warning ? .64 + .20 * (1 - remain) : .88;
      c.lineWidth = warning ? 2 : 3;
      c.strokeStyle = warning ? color : RED;
      c.stroke();
      c.beginPath();
      c.arc(0, 0, r * (warning ? 1 - (1 - remain) * .22 : .65), 0, TAU);
      c.lineWidth = 1.2;
      c.globalAlpha = warning ? .44 : .65;
      c.stroke();
      c.beginPath();c.moveTo(-r * .15, 0);c.lineTo(r * .15, 0);
      c.moveTo(0, -r * .15);c.lineTo(0, r * .15);c.stroke();
    } else {
      const dx = mark.x2 - mark.x1, dy = mark.y2 - mark.y1;
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d, ny = dx / d, h = mark.width * .5;
      c.beginPath();c.moveTo(mark.x1, mark.y1);c.lineTo(mark.x2, mark.y2);
      c.lineWidth = mark.width;
      c.strokeStyle = warning ? color : RED;
      c.globalAlpha = warning ? .075 + (1 - remain) * .11 : .35;
      c.stroke();
      c.globalAlpha = warning ? .58 + (1 - remain) * .16 : .92;
      c.lineWidth = warning ? 1.6 : 2.4;
      for (const sign of [-1, 1]) {
        c.beginPath();
        c.moveTo(mark.x1 + nx * h * sign, mark.y1 + ny * h * sign);
        c.lineTo(mark.x2 + nx * h * sign, mark.y2 + ny * h * sign);
        c.stroke();
      }
      c.beginPath();c.moveTo(mark.x1, mark.y1);c.lineTo(mark.x2, mark.y2);
      c.globalAlpha = warning ? .18 + (1 - remain) * .4 : .8;
      c.setLineDash([7, 12]);c.stroke();c.setLineDash([]);
    }
    c.restore();
  }

  function drawRing(c, r) {
    const prog = 1 - r.life / r.maxLife;
    const ease = 1 - Math.pow(1 - prog, 2.2);
    const rad = Math.max(2, r.max * ease);
    const al = (r.life / r.maxLife);
    c.save();
    c.strokeStyle = r.red ? RED : INK;
    c.globalAlpha = al * 0.75;
    c.lineWidth = 2;
    blobPath(c, r.x, r.y, rad, (r.x * 13 + r.y * 7) | 0, 0.1, 14);
    c.stroke();
    if (r.max > 150) { /* ink burst: double ring + stray droplets */
      c.globalAlpha = al * 0.4;
      blobPath(c, r.x, r.y, rad * 0.72, ((r.x + r.y) * 3) | 0, 0.14, 12);
      c.stroke();
      c.fillStyle = r.red ? RED : INK;
      c.globalAlpha = al * 0.6;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + r.x * 0.01;
        c.save();
        c.translate(r.x + Math.cos(a) * rad * 0.92, r.y + Math.sin(a) * rad * 0.92);
        c.rotate(a);
        teardrop(c, 3.2);
        c.fill();
        c.restore();
      }
    }
    c.restore();
  }

  function drawParticle(c, p) {
    c.save();
    c.globalAlpha = Math.max(0, p.life / p.max);
    c.translate(p.x, p.y);
    c.fillStyle = INK;
    const vang = Math.atan2(p.vy, p.vx);
    if (p.shape === 'line') {
      c.rotate(vang);
      inkStroke(c, [{ x: -p.size * 1.4, y: 0 }, { x: p.size * 1.2, y: 0 }], 1.8, { alpha: 1 });
    } else if (p.shape === 'dot') {
      c.rotate(vang);
      teardrop(c, p.size * 0.75);
      c.fill();
    } else {
      c.rotate(p.rot);
      teardrop(c, p.size * 0.8);
      c.fill();
    }
    c.restore();
  }

  function drawPopup(c, p) {
    c.save();
    c.globalAlpha = Math.max(0, p.life / p.max);
    c.fillStyle = p.red ? RED : INK;
    c.font = p.red ? '700 13px "IBM Plex Mono", monospace' : '600 11px "IBM Plex Mono", monospace';
    c.textAlign = 'center';
    c.fillText(p.txt, p.x, p.y);
    c.restore();
  }

  /* ---------------- ambient ink rain (title & over screens) ----------------
     drops fall from the top of the scroll and stain the paper —
     the quiet screens are themselves slow paintings */
  let drops = [], dropT = 1.2;
  function updateAmbient(dt, S) {
    if (S.mode !== 'title' && S.mode !== 'over') { drops.length = 0; return; }
    dropT -= dt;
    if (dropT <= 0 && drops.length < 7) {
      drops.push({
        x: 26 + Math.random() * (S.W - 52),
        y: -8,
        v: 46 + Math.random() * 60,
        ty: 26 + Math.random() * (S.H - 52),
      });
      dropT = 0.4 + Math.random() * 1.3;
    }
    const cx = S.mode === 'title' ? 0 : S.cam.x;
    const cy = S.mode === 'title' ? 0 : S.cam.y;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.v += 620 * dt;
      d.y += d.v * dt;
      if (d.y >= d.ty) {
        S.stainQueue.push({ x: d.x - S.W / 2 + cx, y: d.ty - S.H / 2 + cy, r: 2.6 + Math.random() * 4.6, alpha: 0.24 + Math.random() * 0.2 });
        drops.splice(i, 1);
      }
    }
  }
  function drawAmbient(c) {
    for (const d of drops) {
      c.save();
      c.translate(d.x, d.y);
      c.rotate(Math.PI / 2);
      c.fillStyle = INK;
      c.globalAlpha = 0.72;
      const stretch = Math.min(2.1, 0.9 + d.v / 220);
      c.scale(1, stretch);
      teardrop(c, 2.6);
      c.fill();
      c.restore();
    }
  }

  /* the guardian waits beyond the eye — a red arrow at the rim */
  function drawEliteArrow(c) {
    const S = G.S;
    if (S.mode !== 'playing' || !S.stats) return;
    let elite = null;
    for (const e of S.enemies) if (e.elite) { elite = e; break; }
    if (!elite) for (const m of S.markers) if (m.elite) { elite = m; break; }
    if (!elite) return;
    const sx = S.W / 2 + (elite.x - S.cam.x);
    const sy = S.H / 2 + (elite.y - S.cam.y);
    const m = 40;
    if (sx > m && sx < S.W - m && sy > m && sy < S.H - m) return; /* on screen */
    const a = Math.atan2(sy - S.H / 2, sx - S.W / 2);
    /* clamp the arrow to the screen rim */
    const tx = Math.cos(a), ty = Math.sin(a);
    let t = Infinity;
    if (tx > 0.001) t = Math.min(t, (S.W / 2 - m) / tx);
    if (tx < -0.001) t = Math.min(t, (S.W / 2 - m) / -tx);
    if (ty > 0.001) t = Math.min(t, (S.H / 2 - m) / ty);
    if (ty < -0.001) t = Math.min(t, (S.H / 2 - m) / -ty);
    const px = S.W / 2 + tx * t, py = S.H / 2 + ty * t;
    c.save();
    c.translate(px, py);
    c.rotate(a);
    c.globalAlpha = 0.55 + 0.4 * Math.abs(Math.sin(S.clockT * 4));
    c.fillStyle = RED;
    c.beginPath();
    c.moveTo(12, 0);
    c.lineTo(-6, -7.5);
    c.lineTo(-2, 0);
    c.lineTo(-6, 7.5);
    c.closePath();
    c.fill();
    c.restore();
  }

  function drawJoy(c) {
    const S = G.S;
    if (!S.joy || S.mode !== 'playing') return;
    const j = S.joy;
    c.save();
    c.strokeStyle = INK;
    c.globalAlpha = 0.3;
    c.lineWidth = 1.6;
    blobPath(c, j.ax, j.ay, 30, 1234, 0.08, 14);
    c.stroke();
    c.globalAlpha = 0.75;
    c.fillStyle = INK;
    blobPath(c, j.ax + j.dx, j.ay + j.dy, 12, 4321, 0.2, 9);
    c.fill();
    c.restore();
  }

  /* ---------------- master draw ---------------- */
  function draw(ctx, t) {
    const S = G.S;
    const dt = Math.min(0.05, Math.max(0, t - lastT));
    lastT = t;
    if (!S.W || !S.H) return;
    ensureTiles(ctx, S.dpr);
    setTheme(activeThemeKey());
    stampStains(S);
    updateStains(dt);

    const playing = S.mode === 'playing' || S.mode === 'paused' || S.mode === 'upgrade' || S.mode === 'dying';
    /* the camera rests wherever the sheet was last stood upon */
    const useCam = S.mode !== 'title';
    const camX = useCam ? S.cam.x : 0;
    const camY = useCam ? S.cam.y : 0;

    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);

    /* ===== the world ===== */
    ctx.save();
    let shx = 0, shy = 0;
    if (S.shake > 0.2 && !S.reduced) {
      shx = (Math.random() - 0.5) * S.shake;
      shy = (Math.random() - 0.5) * S.shake;
    }
    ctx.translate(S.W / 2 + shx - camX, S.H / 2 + shy - camY);

    /* the endless paper, tiled beneath everything */
    const vx0 = camX - S.W / 2 - 8, vx1 = camX + S.W / 2 + 8;
    const vy0 = camY - S.H / 2 - 8, vy1 = camY + S.H / 2 + 8;
    const tile = tiles[themeKey] || tiles.pale;
    for (let ty = Math.floor(vy0 / TILE); ty <= Math.floor(vy1 / TILE); ty++) {
      for (let tx = Math.floor(vx0 / TILE); tx <= Math.floor(vx1 / TILE); tx++) {
        ctx.drawImage(tile, tx * TILE, ty * TILE, TILE, TILE);
      }
    }

    /* faint marks so the sheet feels hand-made and the motion reads */
    drawDecor(ctx, vx0, vy0, vx1, vy1);

    /* dried ink from every fight before this moment */
    const cullM = 80;
    for (const st of stains) {
      if (st.x < vx0 - cullM || st.x > vx1 + cullM || st.y < vy0 - cullM || st.y > vy1 + cullM) continue;
      ctx.globalAlpha = Math.max(0, st.a * (1 - st.age * CFG.world.stainFade));
      ctx.drawImage(st.spr, st.x - st.half, st.y - st.half, st.half * 2, st.half * 2);
    }
    ctx.globalAlpha = 1;

    for (const pd of S.puddles) drawPuddle(ctx, pd);
    if (!S.reduced) updateAmbient(dt, S);

    for (const mark of S.guardianMarks || []) drawGuardianHazard(ctx, mark, t);
    for (const m of S.markers) drawMarker(ctx, m);
    for (const r of S.rings) drawRing(ctx, r);
    for (const b of S.bullets) drawBullet(ctx, b);
    for (const b of S.ebullets) drawEBullet(ctx, b);
    for (const e of S.enemies) drawEnemy(ctx, e, t);
    for (const d of S.idle) drawEnemy(ctx, d, t);
    /* Living splat cores are drawn above dried ink, below the brush.
       No original creature or player sprite functions are modified. */
    if (playing) INK_XP.draw(ctx, S, t, INK, PAPER, RED);
    for (const sp of S.spirits) drawSpirit(ctx, sp);
    if (playing) drawPlayer(ctx, t);
    for (const knot of S.knots) drawKnot(ctx, knot, t);
    for (const p of S.particles) drawParticle(ctx, p);
    for (const p of S.popups) drawPopup(ctx, p);

    /* the ambient rain lives in screen space */
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    drawAmbient(ctx);

    ctx.restore();

    /* ===== screen space ===== */
    drawJoy(ctx);
    drawEliteArrow(ctx);

    /* the rim of the eye: a quiet vignette, deeper when the ink is low */
    const th = THEMES[themeKey];
    const lowHp = S.stats && S.stats.hp === 1 && (S.mode === 'playing' || S.mode === 'paused');
    const vg = ctx.createRadialGradient(S.W / 2, S.H / 2, Math.min(S.W, S.H) * 0.42, S.W / 2, S.H / 2, Math.max(S.W, S.H) * 0.74);
    vg.addColorStop(0, `rgba(${th.vig},0)`);
    vg.addColorStop(1, `rgba(${th.vig},${lowHp ? 0.3 : 0.17})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, S.W, S.H);

    /* bleeding seal: low integrity stains the edges red */
    if (lowHp) {
      const g = ctx.createRadialGradient(S.W / 2, S.H / 2, Math.min(S.W, S.H) * 0.36, S.W / 2, S.H / 2, Math.max(S.W, S.H) * 0.66);
      g.addColorStop(0, 'rgba(178,58,43,0)');
      g.addColorStop(1, `rgba(178,58,43,${0.14 + 0.09 * Math.abs(Math.sin(t * 5))})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S.W, S.H);
    }
  }

  return { draw, resetStains };
})();
