'use strict';
/* ============================================================
   ONE MORE — sumi-e ink renderer
   Everything is brushwork: washi paper, living ink blots with
   line boil, flicked droplets, and a persistent stain layer
   that turns the arena into a painting of the fight.
   ============================================================ */

const R = (() => {
  const INK = '#1a1714';
  const PAPER = '#ede7d9';
  const RED = '#b23a2b';
  const TAU = Math.PI * 2;

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

  /* ---------------- layers ---------------- */
  let paperC = null, stainC = null, stainCtx = null;
  let lw = 0, lh = 0, ldpr = 1;
  let patHatch = null;
  let lastT = 0, fadeAcc = 0, lastTrailT = -1;

  function ensureLayers(ctx, W, H, dpr) {
    if (paperC && W === lw && H === lh && dpr === ldpr) return;
    lw = W; lh = H; ldpr = dpr;

    /* --- washi paper --- */
    paperC = document.createElement('canvas');
    paperC.width = Math.round(W * dpr); paperC.height = Math.round(H * dpr);
    const p = paperC.getContext('2d');
    p.setTransform(dpr, 0, 0, dpr, 0, 0);
    makePaper(p, W, H);

    /* --- stain layer --- */
    stainC = document.createElement('canvas');
    stainC.width = paperC.width; stainC.height = paperC.height;
    stainCtx = stainC.getContext('2d');
    stainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* --- brushed hatch pattern --- */
    const hc = document.createElement('canvas');
    hc.width = hc.height = 10;
    const h = hc.getContext('2d');
    h.strokeStyle = 'rgba(26,23,20,0.6)';
    h.lineWidth = 1.4; h.lineCap = 'round';
    h.beginPath();
    h.moveTo(-2, 9.5); h.lineTo(9.5, -2);
    h.moveTo(3, 13); h.lineTo(13, 3);
    h.stroke();
    patHatch = ctx.createPattern(hc, 'repeat');
  }

  function makePaper(p, W, H) {
    const rnd = mulberry(20260101);
    p.fillStyle = PAPER;
    p.fillRect(0, 0, W, H);

    /* laid lines — faint horizontal grain */
    p.strokeStyle = 'rgba(96,88,70,0.028)';
    p.lineWidth = 1;
    for (let y = 3; y < H; y += 7) {
      p.beginPath(); p.moveTo(0, y + (rnd() - 0.5)); p.lineTo(W, y + (rnd() - 0.5)); p.stroke();
    }
    /* fibers */
    const fibers = Math.round((W * H) / 850);
    for (let i = 0; i < fibers; i++) {
      const x = rnd() * W, y = rnd() * H;
      const a = (rnd() - 0.5) * 0.9 + (rnd() < 0.5 ? 0 : Math.PI / 2);
      const l = 1.5 + rnd() * 3.5;
      p.strokeStyle = `rgba(${70 + rnd() * 40 | 0},${62 + rnd() * 36 | 0},${48 + rnd() * 28 | 0},${0.03 + rnd() * 0.045})`;
      p.lineWidth = 0.7;
      p.beginPath();
      p.moveTo(x, y);
      p.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      p.stroke();
    }
    /* speckles */
    const dots = Math.round((W * H) / 2400);
    for (let i = 0; i < dots; i++) {
      p.fillStyle = `rgba(50,45,36,${0.02 + rnd() * 0.05})`;
      p.beginPath();
      p.arc(rnd() * W, rnd() * H, 0.3 + rnd() * 0.8, 0, TAU);
      p.fill();
    }
    /* broad faint washes */
    const washes = 7;
    for (let i = 0; i < washes; i++) {
      const x = rnd() * W, y = rnd() * H;
      const r = Math.min(W, H) * (0.12 + rnd() * 0.26);
      const g = p.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(112,102,80,${0.02 + rnd() * 0.022})`);
      g.addColorStop(1, 'rgba(112,102,80,0)');
      p.fillStyle = g;
      p.fillRect(x - r, y - r, r * 2, r * 2);
    }
    /* edge burn */
    const v = p.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    v.addColorStop(0, 'rgba(58,52,40,0)');
    v.addColorStop(1, 'rgba(58,52,40,0.14)');
    p.fillStyle = v;
    p.fillRect(0, 0, W, H);
  }

  function resetStains() {
    if (stainCtx) stainCtx.clearRect(0, 0, lw, lh);
  }

  function stampStains(S) {
    if (!stainCtx || !S.stainQueue.length) return;
    for (const q of S.stainQueue) {
      splatStamp(stainCtx, q.x, q.y, q.r, (Math.random() * 1e9) | 0, q.alpha ?? 0.5);
    }
    S.stainQueue.length = 0;
  }

  function fadeStains(dt) {
    fadeAcc += dt;
    const step = 0.05;
    while (fadeAcc > step) {
      fadeAcc -= step;
      stainCtx.globalCompositeOperation = 'destination-out';
      stainCtx.fillStyle = `rgba(0,0,0,${CFG.ink.stainFadePerSec * step})`;
      stainCtx.fillRect(0, 0, lw, lh);
      stainCtx.globalCompositeOperation = 'source-over';
    }
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

  function splatStamp(c, x, y, r, seed, alpha = 0.5) {
    const rnd = mulberry(seed);
    c.save();
    c.fillStyle = INK;
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
      ], Math.max(1.2, r * 0.14), { alpha: alpha * 0.55 });
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

  /* ---------------- arena frame: a hand-brushed border ---------------- */
  function brushFrame(c, a, t, lowHp) {
    const red = lowHp ? 1 : 0;
    const pulse = lowHp ? 0.55 + 0.4 * Math.abs(Math.sin(t * 5)) : 1;
    const col = red
      ? `rgba(${26 + 152 * red | 0},${23 + 35 * red | 0},${20 + 23 * red | 0},${0.9 * pulse})`
      : 'rgba(26,23,20,0.9)';
    const j = 1.3;
    const seg = 26;

    function edge(x0, y0, x1, y1, seed) {
      const rnd = mulberry(seed ^ (Math.floor(t / (CFG.ink.boilRate * 3)) * 131));
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len, ny = dx / len;
      const n = Math.max(2, Math.round(len / seg));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const wob = (i === 0 || i === n) ? 0 : (rnd() * 2 - 1) * j;
        pts.push({ x: x0 + dx * k + nx * wob, y: y0 + dy * k + ny * wob });
      }
      inkStroke(c, pts, 2.6, { color: col, alpha: 0.95, jit: 0.3, dry: true, seed });
    }
    const o = 9; // corner overshoot — a stroke that keeps going
    edge(a.x - o, a.y, a.x + a.w + o, a.y, 11);
    edge(a.x + a.w, a.y - o, a.x + a.w, a.y + a.h + o, 22);
    edge(a.x + a.w + o, a.y + a.h, a.x - o, a.y + a.h, 33);
    edge(a.x, a.y + a.h + o, a.x, a.y - o, 44);

    /* corner ticks, like a seal's frame */
    c.strokeStyle = col;
    c.lineCap = 'round';
    c.lineWidth = 2;
    const cs = [[a.x, a.y, -1, -1], [a.x + a.w, a.y, 1, -1], [a.x, a.y + a.h, -1, 1], [a.x + a.w, a.y + a.h, 1, 1]];
    for (const [cx, cy, sx, sy] of cs) {
      c.beginPath();
      c.moveTo(cx + sx * 5, cy + sy * 12);
      c.lineTo(cx + sx * 5, cy + sy * 5);
      c.lineTo(cx + sx * 12, cy + sy * 5);
      c.stroke();
    }
  }

  /* ---------------- creatures ---------------- */
  function seedFor(e, tick) { return ((e.seed * 8191) | 0) ^ (tick * 7919); }

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
      default: { /* BLIP — a shard of the drip */
        blobPath(c, 0, 0, r, sd, 0.24, 9);
        c.fill();
        silhouette = () => blobPath(c, 0, 0, r * 1.1, sd, 0.24, 9);
        const ang = Math.atan2(S.player.y - e.y, S.player.x - e.x);
        eyeSlits(c, ang, r, 0.7);
      }
    }

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
    c.restore();
  }

  /* ---------------- player: the brush spirit ---------------- */
  function drawPlayer(c, t) {
    const S = G.S;
    const p = S.player;
    const blink = S.invulnT > 0 && Math.floor(t * 18) % 2 === 0;
    const tick = Math.floor(t / CFG.ink.boilRate);
    const sd = ((p.x * 31 + p.y * 17) | 0) ^ (tick * 7919);
    const iv = S.inputVec;
    const mv = Math.min(1, Math.hypot(iv.x, iv.y));

    /* ink trail: the brush never leaves the paper clean */
    if (S.mode === 'playing' && mv > 0.15 && t - lastTrailT > CFG.ink.trailGap && !S.reduced) {
      lastTrailT = t;
      S.stainQueue.push({ x: p.x + (Math.random() - 0.5) * 6, y: p.y + (Math.random() - 0.5) * 6, r: 2.2, alpha: 0.15 });
    }

    /* comet tail, streaming behind the motion */
    if (mv > 0.12) {
      const a = Math.atan2(-iv.y, -iv.x);
      const len = 9 + 10 * mv;
      const sway = Math.sin(t * 9) * 2.2;
      const x0 = p.x + Math.cos(a) * p.r * 0.5, y0 = p.y + Math.sin(a) * p.r * 0.5;
      inkStroke(c, [
        { x: x0, y: y0 },
        { x: x0 + Math.cos(a) * len * 0.55 - Math.sin(a) * sway, y: y0 + Math.sin(a) * len * 0.55 + Math.cos(a) * sway },
        { x: x0 + Math.cos(a) * len, y: y0 + Math.sin(a) * len },
      ], 7, { alpha: blink ? 0.2 : 0.85, taper: 1.1, seed: sd });
    }

    c.save();
    c.globalAlpha = blink ? 0.25 : 1;
    const back = p.recoil > 0 ? p.recoil * 2.4 : 0;
    c.translate(p.x - Math.cos(p.aim) * back, p.y - Math.sin(p.aim) * back);

    /* adrenaline speed ticks */
    if (S.adrenT > 0 && !blink) {
      const ma = Math.atan2(-iv.y || p.aim, -iv.x || p.aim);
      c.save();
      c.globalAlpha = 0.4;
      for (const off of [-0.5, 0.5]) {
        const a = ma + off;
        inkStroke(c, [
          { x: Math.cos(a) * 13, y: Math.sin(a) * 13 },
          { x: Math.cos(a) * 21, y: Math.sin(a) * 21 },
        ], 2.2, { alpha: 0.5 });
      }
      c.restore();
    }

    c.fillStyle = INK;
    blobPath(c, 0, 0, p.r, sd, 0.14, 10);
    c.fill();
    if (S.invulnT > 0) {
      c.globalAlpha = (blink ? 0.25 : 1) * 0.5;
      c.strokeStyle = INK;
      c.lineWidth = 1.2;
      c.beginPath(); c.arc(0, 0, p.r + 4.5, 0, TAU); c.stroke();
      c.globalAlpha = blink ? 0.25 : 1;
    }

    const st = S.stats;

    /* ink orbit: droplets circling the brush */
    if (st && st.orb > 0) {
      const orbR = CFG.orbit.radius(st.orb);
      const base = S.clockT || t;
      c.save();
      c.globalAlpha = (blink ? 0.2 : 1) * 0.1;
      c.strokeStyle = INK;
      c.lineWidth = 1;
      c.beginPath(); c.arc(0, 0, orbR, 0, TAU); c.stroke();
      c.restore();
      for (let i = 0; i < st.orb; i++) {
        const a = base * CFG.orbit.speed + (i / st.orb) * TAU;
        const ox = Math.cos(a) * orbR, oy = Math.sin(a) * orbR;
        c.save();
        c.translate(ox, oy);
        c.rotate(a + Math.PI / 2);
        c.globalAlpha = (blink ? 0.3 : 1) * 0.95;
        c.fillStyle = INK;
        teardrop(c, 3.6);
        c.fill();
        c.globalAlpha = (blink ? 0.15 : 1) * 0.3;
        inkStroke(c, [{ x: -6, y: 0 }, { x: -13, y: 0.4 }], 1.8, { alpha: 1 });
        c.restore();
      }
    }

    /* paper ward: a talisman that hangs at the brush's back */
    if (st && st.ward) {
      const ready = st.wardCd <= 0;
      const wa = p.aim + Math.PI;
      c.save();
      c.translate(Math.cos(wa) * (p.r + 12), Math.sin(wa) * (p.r + 12) - 2);
      c.rotate(Math.sin(t * 1.7) * 0.14 - 0.35);
      c.globalAlpha = (blink ? 0.3 : 1) * (ready ? 0.9 : 0.2);
      c.strokeStyle = INK;
      c.lineWidth = 1.4;
      c.strokeRect(-4, -6.5, 8, 13);
      if (ready) { c.fillStyle = RED; c.fillRect(-1.6, -1.6, 3.2, 3.2); }
      c.restore();
    }

    /* the eye — a single paper slit toward the aim */
    const ex = Math.cos(p.aim) * p.r * 0.45, ey = Math.sin(p.aim) * p.r * 0.45;
    const el = (p.recoil > 0.4 ? 2.6 : 4.4);
    c.strokeStyle = PAPER;
    c.lineWidth = 1.9;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(ex - Math.cos(p.aim) * el / 2, ey - Math.sin(p.aim) * el / 2);
    c.lineTo(ex + Math.cos(p.aim) * el / 2, ey + Math.sin(p.aim) * el / 2);
    c.stroke();
    c.restore();
  }

  /* ---------------- projectiles, markers, fx ---------------- */
  function drawBullet(c, b) {
    c.save();
    c.translate(b.x, b.y);
    c.rotate(b.ang);
    c.fillStyle = INK;
    teardrop(c, 4.2);
    c.fill();
    inkStroke(c, [{ x: -5, y: 0 }, { x: -14 - b.age * 8, y: 0.6 }], 2.6, { alpha: 0.4 });
    c.restore();
  }

  /* the spitter's lobbed glob — a hollow ring of ink */
  function drawEBullet(c, b) {
    c.save();
    c.translate(b.x, b.y);
    c.rotate(b.ang);
    c.strokeStyle = INK;
    c.fillStyle = INK;
    c.lineWidth = 1.8;
    c.beginPath(); c.arc(0, 0, 4.6, 0, TAU); c.stroke();
    c.beginPath(); c.arc(0, 0, 1.7, 0, TAU); c.fill();
    inkStroke(c, [{ x: -6, y: 0 }, { x: -15 - b.age * 6, y: 0.5 }], 2.2, { alpha: 0.32 });
    c.restore();
  }

  function drawMarker(c, m) {
    const def = ENEMIES[m.type];
    const pr = 1 - m.t / 0.62;
    const tick = Math.floor(G.S.timeNow * 10);
    c.save();
    c.translate(m.x, m.y);
    c.fillStyle = INK;
    /* puddle spreading */
    c.save();
    c.scale(1, 0.42);
    c.globalAlpha = 0.3 + 0.5 * pr;
    blobPath(c, 0, 0, def.r * (0.55 + 0.95 * pr), (m.x * 7 + m.y * 13) | 0, 0.35, 10);
    c.fill();
    c.restore();
    /* droplets falling in */
    for (let k = 0; k < 3; k++) {
      const dx = (k - 1) * def.r * 0.7;
      const dy = -(1 - pr) * 74 - 8 - k * 5;
      c.save();
      c.translate(dx, dy);
      c.rotate(Math.PI / 2);
      c.globalAlpha = 0.85;
      teardrop(c, 2.4 + pr * 2.2);
      c.fill();
      c.restore();
    }
    c.restore();
  }

  function drawRing(c, r) {
    const prog = 1 - r.life / r.maxLife;
    const ease = 1 - Math.pow(1 - prog, 2.2);
    const rad = Math.max(2, r.max * ease);
    const al = (r.life / r.maxLife);
    c.save();
    c.strokeStyle = INK;
    c.globalAlpha = al * 0.75;
    c.lineWidth = 2;
    blobPath(c, r.x, r.y, rad, (r.x * 13 + r.y * 7) | 0, 0.1, 14);
    c.stroke();
    if (r.max > 150) { /* ink burst: double ring + stray droplets */
      c.globalAlpha = al * 0.4;
      blobPath(c, r.x, r.y, rad * 0.72, ((r.x + r.y) * 3) | 0, 0.14, 12);
      c.stroke();
      c.fillStyle = INK;
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

  /* ---------------- ambient ink rain (title & over screens) ----------------
     drops fall from the top of the scroll and stain the paper —
     the title screen is itself a slow painting. */
  let drops = [], dropT = 1.2;
  function updateAmbient(dt, S) {
    if (S.mode !== 'title' && S.mode !== 'over') { drops.length = 0; return; }
    const a = S.arena;
    dropT -= dt;
    if (dropT <= 0 && drops.length < 7) {
      drops.push({
        x: a.x + 26 + Math.random() * (a.w - 52),
        y: a.y - 8,
        v: 46 + Math.random() * 60,
        ty: a.y + 26 + Math.random() * (a.h - 52),
      });
      dropT = 0.4 + Math.random() * 1.3;
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.v += 620 * dt;
      d.y += d.v * dt;
      if (d.y >= d.ty) {
        S.stainQueue.push({ x: d.x, y: d.ty, r: 2.6 + Math.random() * 4.6, alpha: 0.24 + Math.random() * 0.2 });
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

  /* ---------------- master draw ---------------- */
  function draw(ctx, t) {
    const S = G.S;
    const dt = Math.min(0.05, Math.max(0, t - lastT));
    lastT = t;
    if (!S.W || !S.H) return;
    ensureLayers(ctx, S.W, S.H, S.dpr);
    stampStains(S);
    fadeStains(dt);

    /* paper */
    ctx.drawImage(paperC, 0, 0, lw, lh);

    const a = S.arena;
    const lowHp = S.stats && S.stats.hp === 1 && (S.mode === 'playing' || S.mode === 'paused');

    /* world, clipped to the scroll */
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x - 1, a.y - 1, a.w + 2, a.h + 2);
    ctx.clip();
    if (S.shake > 0.2 && !S.reduced) {
      ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
    }

    /* dried ink from every fight before this moment */
    ctx.drawImage(stainC, 0, 0, lw, lh);

    /* ambient rain of ink on the quiet screens */
    if (!S.reduced) { updateAmbient(dt, S); drawAmbient(ctx); }

    for (const m of S.markers) drawMarker(ctx, m);
    for (const r of S.rings) drawRing(ctx, r);
    for (const b of S.bullets) drawBullet(ctx, b);
    for (const b of S.ebullets) drawEBullet(ctx, b);
    for (const e of S.enemies) drawEnemy(ctx, e, t);
    for (const d of S.idle) drawEnemy(ctx, d, t);
    if (S.mode === 'playing' || S.mode === 'paused' || S.mode === 'upgrade') drawPlayer(ctx, t);
    for (const p of S.particles) drawParticle(ctx, p);
    for (const p of S.popups) drawPopup(ctx, p);
    drawJoy(ctx);

    ctx.restore();

    /* the brushed frame — steady while the world shakes */
    brushFrame(ctx, a, t, lowHp);

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
