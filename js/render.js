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
  const AWAKEN_RED = '#ac1538'; /* deep vivid lacquer-crimson, mastered arts only */
  const TAU = Math.PI * 2;

  /* ---------------- paper themes ---------------- */
  const THEMES = {
    pale: { paper: '#ede7d9', ink: '#1a1714', vig: '58,52,40'  },
    dark: { paper: '#242b39', ink: '#fff1da', vig: '8,13,27'    },
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

  /* Stage-bound paper memory: compact cached stamps, indexed by
     world tile so even a very long wave stays cheap on mobile. */
  let stains = [];
  const stainCells = new Map();
  const stampCache = new Map();
  const STAIN_CELL = 240;
  const stainCellKey = (x, y) =>
    Math.floor(x / STAIN_CELL) + ',' + Math.floor(y / STAIN_CELL);

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

    /* THE UNTOUCHED SHEET. Paper I is one flat warm handmade surface:
       no repeated horizontal laid lines, fake aged washes or kanji.
       A few almost invisible kozo flecks give it just enough tooth. */
    if(key==='pale'){
      for(let i=0;i<20;i++){
        const x=rnd()*TILE,y=rnd()*TILE,angle=rnd()*TAU;
        const len=1+rnd()*2;
        p.strokeStyle='rgba(93,85,66,'+(.012+rnd()*.015)+')';
        p.lineWidth=.42;
        p.beginPath();p.moveTo(x,y);
        p.lineTo(x+Math.cos(angle)*len,y+Math.sin(angle)*len);p.stroke();
      }
      for(let i=0;i<9;i++){
        p.fillStyle='rgba(93,85,66,.02)';
        p.fillRect(rnd()*TILE,rnd()*TILE,.45+rnd()*.4,.45+rnd()*.4);
      }
      return c;
    }

    /* laid lines — grain that tiles cleanly (8 divides 480) */
    p.lineWidth = 1;
    p.strokeStyle = key === 'dark' ? 'rgba(247,231,207,0.065)' : 'rgba(96,88,70,0.03)';
    for (let y = 4; y < TILE; y += 8) {
      p.beginPath(); p.moveTo(0, y + (rnd() - 0.5)); p.lineTo(TILE, y + (rnd() - 0.5)); p.stroke();
    }
    /* fibers */
    const fibers = Math.round((TILE * TILE) / 850);
    for (let i = 0; i < fibers; i++) {
      const x = rnd() * TILE, y = rnd() * TILE;
      const a = (rnd() - 0.5) * 0.9 + (rnd() < 0.5 ? 0 : Math.PI / 2);
      const l = 1.5 + rnd() * 3.5;
      const base = key === 'dark' ? [222, 212, 193] : [70 + rnd() * 40 | 0, 62 + rnd() * 36 | 0, 48 + rnd() * 28 | 0];
      p.strokeStyle = `rgba(${base[0]},${base[1]},${base[2]},${key === 'dark' ? 0.075 + rnd() * 0.065 : 0.03 + rnd() * 0.045})`;
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
        ? `rgba(249,234,207,${0.035 + rnd() * 0.055})`
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
        g.addColorStop(0, `rgba(106,127,165,${0.085 + rnd() * 0.045})`);
        g.addColorStop(.55, 'rgba(67,84,118,0.035)');
        g.addColorStop(1, 'rgba(67,84,118,0)');
      } else {
        g.addColorStop(0, `rgba(112,102,80,${0.02 + rnd() * 0.022})`);
        g.addColorStop(1, 'rgba(112,102,80,0)');
      }
      p.fillStyle = g;
      p.fillRect(x - r, y - r, r * 2, r * 2);
    }
    /* Indigo-dyed paper leaves barely-visible dye tide lines and a
       few kozo fibers. All details are deterministic tile art, not
       glowing scenery, and remain quieter than the living ivory ink. */
    if(key==='dark'){
      for(let i=0;i<5;i++){
        const x=28+rnd()*(TILE-56),y=25+rnd()*(TILE-50);
        const length=38+rnd()*106;
        p.save();p.strokeStyle='rgba(172,192,218,.115)';
        p.lineWidth=.55+rnd()*.45;p.lineCap='round';
        p.beginPath();p.moveTo(x,y);
        p.bezierCurveTo(x+length*.19,y-4,x+length*.68,y+7,
          x+length,y+(rnd()-.5)*12);p.stroke();p.restore();
      }
      /* A tiny pale fiber fleck, seldom repeated across the sheet. */
      p.save();p.globalAlpha=.16;p.fillStyle='#ded7c6';
      for(let i=0;i<6;i++){
        const x=rnd()*TILE,y=rnd()*TILE;
        p.fillRect(x,y,1.2+rnd()*2,.5);
      }
      p.restore();
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

  /* Five seeded variants per existing enemy type. Each beast retains its
     original sprite/animation, but signs the paper in a different hand.
     Splatter references: traditional haboku ink breakup, directional
     dry-brush strokes, pooled pigment and expressive negative space. */
  const BLOOD_HANDS = {
    pulse:    {style:'pool',arms:3,scatter:.9,elong:1.0},
    pulseling:{style:'dots',arms:2,scatter:.65,elong:.68},
    dart:     {style:'speed',arms:3,scatter:1.6,elong:1.65},
    spit:     {style:'spray',arms:6,scatter:1.8,elong:.85},
    split:    {style:'fork',arms:5,scatter:1.35,elong:1.1},
    slab:     {style:'weight',arms:4,scatter:1.0,elong:1.85},
    shade:    {style:'ghost',arms:3,scatter:1.7,elong:1.45},
    wraith:   {style:'mist',arms:5,scatter:1.4,elong:1.3},
    moth:     {style:'wings',arms:4,scatter:1.3,elong:1.1},
    titan:    {style:'flood',arms:7,scatter:2.1,elong:1.9},
    kage:     {style:'slash',arms:4,scatter:1.9,elong:1.7},
    stilt:    {style:'needle',arms:5,scatter:2.2,elong:1.8},
    crane:    {style:'feather',arms:5,scatter:2.0,elong:1.5},
    oni:      {style:'crack',arms:6,scatter:1.45,elong:2.1},
  };
  function paintEnemyBlood(c,type,r,seed,variant,color){
    const hand=BLOOD_HANDS[type]||BLOOD_HANDS.pulse;
    const v=((variant%5)+5)%5,rnd=mulberry(seed+v*11497);
    c.save();c.fillStyle=color;c.strokeStyle=color;
    const ang=(v/5)*TAU; c.rotate(ang);
    c.scale(hand.elong,1/Math.sqrt(hand.elong));
    /* Five compositions, not five colorways. They alter the branching,
       core silhouette, distance and texture with a deterministic seed. */
    const center=r*(.43+(v%3)*.07);
    blobPath(c,0,0,center,seed+v*31,.30+v*.033,11);
    c.globalAlpha=.98;c.fill();
    const arms=hand.arms+(v%3);
    for(let i=0;i<arms;i++){
      let angle=TAU*(i+rnd()*.29)/arms;
      if(['speed','slash','feather','needle'].includes(hand.style))
        angle=(rnd()-.5)*1.5+Math.PI*(i%2);
      if(hand.style==='wings')angle=(i%2?1:-1)*(.35+rnd()*1.1);
      if(hand.style==='crack')angle+=Math.sin(i*2.3)*.38;
      const distance=r*hand.scatter*(.56+rnd()*.9);
      const tx=Math.cos(angle)*distance,ty=Math.sin(angle)*distance;
      const thick=Math.max(.8,r*(.1+.09*rnd())*(v===4?1.3:1));
      if(['weight','flood','crack','slash','speed','feather','fork'].includes(hand.style)){
        inkStroke(c,[{x:Math.cos(angle)*center*.5,y:Math.sin(angle)*center*.5},
          {x:tx*.62,y:ty*.62},{x:tx,y:ty}],thick,
          {color,alpha:.85,seed:seed+i+v*17,taper:.73,jit:.08});
      }
      c.save();c.translate(tx,ty);c.rotate(angle);
      c.globalAlpha=.78+rnd()*.21;
      if(hand.style==='spray'||hand.style==='dots'||hand.style==='mist'){
        blobPath(c,0,0,r*(.095+rnd()*.14),seed+i*19+v,.29,8);c.fill();
      }else if(hand.style==='ghost'){
        c.lineWidth=Math.max(.8,r*.09);c.beginPath();
        c.arc(0,0,r*(.2+rnd()*.1),.3,2.6);c.stroke();
      }else{
        teardrop(c,r*(.07+rnd()*.13));c.fill();
      }
      c.restore();
    }
    if(hand.style==='pool'||hand.style==='weight'||hand.style==='flood'){
      c.globalAlpha=.81;
      blobPath(c,-r*.22,r*.24,r*.4,seed+v*100,.29,9);c.fill();
    }
    if(hand.style==='split'||hand.style==='fork'){
      c.lineWidth=Math.max(.8,r*.12);c.globalAlpha=.8;
      c.beginPath();c.moveTo(-r*.3,0);c.lineTo(r*.4,r*.45);
      c.moveTo(-r*.1,-r*.2);c.lineTo(r*.5,-r*.42);c.stroke();
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

  /* ---------------- stage-long washi marks ----------------
     Both enemy blood and weapon imprints belong to the SAME ink sheet.
     Sprite shapes are reused by radius, kind and seed variant to avoid
     allocating thousands of canvases over ten consecutive waves. */
  function paintWeaponImprint(g, weapon, r, seed, color) {
    const rnd = mulberry(seed);
    g.save();
    g.strokeStyle = color;g.fillStyle=color;g.lineCap='round';
    switch (weapon) {
      case 'heaven': { /* the abandoned mark of the Painter's enormous hand */
        inkStroke(g,[{x:-r*1.8,y:r*.08},{x:-r*.25,y:-r*.12},
          {x:r*1.75,y:r*.14}],r*.76,
          {color,alpha:.93,seed,taper:.68,jit:.07});
        g.globalAlpha=.40;
        for(let i=0;i<3;i++){
          const x=r*(rnd()*2-1),y=r*(rnd()-.5);
          blobPath(g,x,y,r*(.08+rnd()*.09),seed+i,.22,8);g.fill();
        }
        break;
      }
      case 'shot': /* a pointed drop ends in a light calligraphic fleck */
        splatPaint(g,0,0,r*.72,seed,.8,color);
        inkStroke(g,[{x:-r*.5,y:r*.1},{x:r*.55,y:-r*.3},{x:r*1.7,y:-r*.5}],
          Math.max(1,r*.21),{alpha:.58,color,seed});
        break;
      case 'echo': /* mirrored answer of the opposite brush stroke */
        inkStroke(g,[{x:-r*1.8,y:r*.43},{x:0,y:0},{x:r*1.4,y:-r*.48}],
          Math.max(1.2,r*.33),{alpha:.83,color,seed});
        blobPath(g,0,0,r*.35,seed,.22,9);g.globalAlpha=.66;g.fill();break;
      case 'fan': /* a long folded slash left in the paper */
        inkStroke(g,[{x:-r*2.0,y:r*.45},{x:-r*.2,y:0},{x:r*2.2,y:-r*.58}],
          Math.max(1.5,r*.52),{alpha:.75,color,seed,dry:true,dryColor:PAPER});
        break;
      case 'orbit': /* compact crescent scuff of a grinding ink bead */
        g.globalAlpha=.59;g.lineWidth=Math.max(1.2,r*.31);
        g.beginPath();g.arc(0,0,r*.94,-2.3,1.2);g.stroke();
        blobPath(g,r*.65,r*.15,r*.32,seed,.24,8);g.fill();break;
      case 'nova': /* a broken shock ring, not a temporary magic aura */
      case 'shock':
        g.globalAlpha=.55;g.lineWidth=Math.max(1.2,r*.13);
        for(const off of [0,2.4,4.8]){
          g.beginPath();g.arc(0,0,r*(.7+rnd()*.24),off,off+1.2);g.stroke();
        }
        for(let i=0;i<4;i++){
          const ang=i*TAU/4+rnd()*.3;
          inkStroke(g,[{x:Math.cos(ang)*r*.65,y:Math.sin(ang)*r*.65},
            {x:Math.cos(ang)*r*1.35,y:Math.sin(ang)*r*1.35}],
            Math.max(1,r*.09),{alpha:.29,color,seed:seed+i});
        }
        break;
      case 'trail': /* pooled wet dragging along the sheet */
        inkStroke(g,[{x:-r*1.5,y:r*.3},{x:0,y:0},{x:r*1.6,y:-r*.22}],
          Math.max(2,r*.8),{alpha:.64,color,seed,dry:true,dryColor:PAPER});
        break;
      case 'spirit': /* little afterimage of a visiting lesser brush */
        inkStroke(g,[{x:-r*1.5,y:r*.5},{x:-r*.1,y:0},{x:r*1.65,y:-r*.6}],
          Math.max(1,r*.29),{alpha:.63,color,seed});
        blobPath(g,r*.55,-r*.26,r*.25,seed,.2,8);g.globalAlpha=.68;g.fill();
        break;
      case 'knot': /* three tied calligraphic fibres */
        for(let k=-1;k<=1;k++){
          inkStroke(g,[{x:-r*1.2,y:k*r*.45},{x:0,y:k*r*.13},
            {x:r*1.25,y:-k*r*.45}],Math.max(1,r*.18),
            {alpha:.52,color,seed:seed+k});
        }
        break;
      case 'ward': /* a stamp's imperfect paper border */
        g.globalAlpha=.61;g.lineWidth=Math.max(1.2,r*.11);
        g.strokeRect(-r*.66,-r*.9,r*1.35,r*1.75);
        inkStroke(g,[{x:-r*.18,y:-r*.6},{x:r*.12,y:r*.57}],
          Math.max(1.4,r*.18),{alpha:.48,color,seed});
        break;
      default:
        splatPaint(g,0,0,r,seed,.85,color);
    }
    g.restore();
  }

  function stampStains(S) {
    if (!S.stainQueue.length) return;
    for (const q of S.stainQueue) {
      const r = Math.max(2.4, Math.min(100, q.r));
      const weapon=q.kind==='weapon'?q.weapon:'';
      const bloodType=!weapon?(q.enemyType||'pulse'):'';
      const bloodVariant=((q.variant??0)%5+5)%5;
      const radius = Math.max(3,Math.round(r/2)*2);
      const variant = ((Math.floor(Math.abs(q.x*13+q.y*7))%4)+4)%4;
      const color=q.red?(weapon?AWAKEN_RED:RED):INK;
      const key=themeKey+':'+weapon+':'+bloodType+':'+bloodVariant+
        ':'+radius+':'+variant+':'+color;
      let sprite = stampCache.get(key);
      if(!sprite){
        const half = Math.ceil(radius*3.3+8), scale=2;
        const spr=document.createElement('canvas');
        spr.width=spr.height=half*2*scale;
        const g=spr.getContext('2d');
        g.setTransform(scale,0,0,scale,half*scale,half*scale);
        const seed=radius*181+variant*7919;
        if(weapon)paintWeaponImprint(g,weapon,radius,seed,color);
        else paintEnemyBlood(g,bloodType,radius,seed,bloodVariant,color);
        sprite={spr,half};
        stampCache.set(key,sprite);
        /* Eviction does not erase existing terrain: records keep the sprite. */
        if(stampCache.size>260)stampCache.delete(stampCache.keys().next().value);
      }
      const mark={
        x:q.x,y:q.y,spr:sprite.spr,half:sprite.half,
        angle:weapon?(q.angle||0):(q.angle||0)*.25,
        /* Dense sumi or vermilion lacquer, never the old gray wash. */
        a:weapon?Math.max(.92,q.alpha??.94):Math.max(.88,q.alpha??.9),
        kind:weapon||'blood',
        enemyType:bloodType,variant:bloodVariant,
        red:!!q.red,
      };
      stains.push(mark);
      const cell=stainCellKey(mark.x,mark.y);
      if(!stainCells.has(cell))stainCells.set(cell,[]);
      stainCells.get(cell).push(mark);
    }
    S.stainQueue.length=0;
    /* No fade and no oldest-first cap. Even the very first blood splatter
       still exists when the Guardian appears on wave ten. */
  }

  function updateStains(dt) {
    /* Stage memory is intentionally permanent. Never age away marks. */
  }

  /* Eraser deletes accumulated blood and weapon paint, not world decor,
     enemies or the underlying paper. Index updates are localized to the
     touched spatial cells and queued paint is screened in game.js. */
  function eraseTerrain(x,y,r){
    const r2=r*r,removed=new Set();
    const pad=25;
    for(let cy=Math.floor((y-r-pad)/STAIN_CELL);
      cy<=Math.floor((y+r+pad)/STAIN_CELL);cy++){
      for(let cx=Math.floor((x-r-pad)/STAIN_CELL);
        cx<=Math.floor((x+r+pad)/STAIN_CELL);cx++){
        const key=cx+','+cy,list=stainCells.get(key);
        if(!list)continue;
        const kept=[];
        for(const mark of list){
          if((mark.x-x)**2+(mark.y-y)**2<r2)removed.add(mark);
          else kept.push(mark);
        }
        if(kept.length)stainCells.set(key,kept);
        else stainCells.delete(key);
      }
    }
    if(removed.size)stains=stains.filter(mark=>!removed.has(mark));
    return removed.size;
  }

  function resetStains() {
    stains.length=0;
    stainCells.clear();
    stampCache.clear();
  }

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

  /* An additive registration mark behind Night Scroll's spectral
     monsters. The original fourteen enemy painters, their eye shapes
     and their dissolve animations stay byte-identical. The broken
     handmade outline makes even an almost-transparent Shade trackable. */
  function drawNightSighting(c,e){
    if(themeKey!=='dark')return;
    const r=e.r;
    const spectral=['shade','wraith','kage','stilt','moth'].includes(e.type);
    c.save();c.translate(e.x,e.y);
    c.strokeStyle='#ffefd1';c.lineCap='round';
    c.globalAlpha=spectral?.8:.33;c.lineWidth=spectral?1.5:1.05;
    const halo=r*(spectral?1.47:1.34);
    c.beginPath();c.arc(0,0,halo,-.95,.46);
    c.moveTo(Math.cos(2.2)*halo,Math.sin(2.2)*halo);
    c.arc(0,0,halo,2.2,3.43);c.stroke();
    if(spectral){
      c.fillStyle='#ffefd1';c.globalAlpha=.9;
      c.beginPath();c.arc(-halo*.92,-halo*.11,1.1,0,TAU);c.fill();
    }
    c.restore();
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
  /* Player and BLOT enemies share the same midpoint blob vocabulary and
     CFG.ink.boilRate. Two deterministic enemy-style contours are blended
     between ticks so the living body stays animated without the old jump. */
  function livingBlobPath(c, r, seed, t, reduced) {
    const n = 10;
    const phase = reduced ? 0 : t / CFG.ink.boilRate;
    const tick = Math.floor(phase), blend = reduced ? 0
      : (phase - tick) ** 2 * (3 - 2 * (phase - tick));
    const first = mulberry(seed ^ Math.imul(tick, 7919));
    const next = reduced ? null : mulberry(seed ^ Math.imul(tick + 1, 7919));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const ang = i * TAU / n;
      const r0 = 1 + (first() * 2 - 1) * .17;
      const r1 = reduced ? r0 : 1 + (next() * 2 - 1) * .17;
      const rr = r * (r0 + (r1 - r0) * blend);
      pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr]);
    }
    c.beginPath();
    const last = pts[n-1], initial = pts[0];
    c.moveTo((last[0]+initial[0])*.5,(last[1]+initial[1])*.5);
    for (let i = 0; i < n; i++) {
      const q = pts[(i+1)%n];
      c.quadraticCurveTo(pts[i][0],pts[i][1],
        (pts[i][0]+q[0])*.5,(pts[i][1]+q[1])*.5);
    }
    c.closePath();
  }

  /* Our protagonist is no longer the brush: a small sentient ink-soul
     with an asymmetrical floating cloak, a lifted forehead and two
     living folds instead of a tool handle or attached bristles.
     Its recognizable face and silhouette stay coherent as it moves. */
  function inkSoulPath(c,r,t,seed,reduced,motion){
    const p=G.S.player,mode=p.visualState||'idle';
    const run=mode==='run'||mode==='turn'||mode==='anticipate';
    const strength=reduced?0:Math.max(0,Math.min(1,p.visualSpeed||0));
    const phase=p.flowPhase||0;
    const left=run?Math.sin(phase):Math.sin(t*2.25+seed*.003)*.09;
    const right=run?Math.sin(phase+Math.PI):Math.sin(t*2.25+seed*.003+1.1)*.09;
    const step=strength*.17;
    const flutter=reduced?0:Math.sin(t*2.3+seed*.001)*.014;
    /* Smooth connected brush curves: the lower hem alternates in a
       visible two-beat RUN without detached legs or sprite-frame jumps. */
    c.beginPath();
    c.moveTo(-r*.34,-r*(1.10+flutter));
    c.bezierCurveTo(r*.04,-r*1.35,r*.83,-r*1.04,r*.97,-r*.44);
    c.bezierCurveTo(r*1.13,r*.08,r*.91,r*.62,r*.53,r*.75);
    c.quadraticCurveTo(r*(.76+right*step*.55),r*(1.12+right*step),
      r*(.20+right*.08),r*(1.03+right*step*.83));
    c.quadraticCurveTo(-r*.03,r*(.70+right*step*.13),
      -r*(.26+left*.035),r*(1.05-left*step*.9));
    c.quadraticCurveTo(-r*(.66+left*.04),r*(1.22-left*step),
      -r*(.71+left*.04),r*(.68+left*step*.3));
    c.bezierCurveTo(-r*(1.10+motion*.035),r*.42,
      -r*(1.11-motion*.035),-r*.42,-r*.34,-r*(1.10+flutter));
    c.closePath();
  }

  function drawEraserField(c,S,t){
    const level=S.stats?.orb||0;if(!level)return;
    const p=S.player,r=CFG.eraser.radius(level);
    const mastered=(S.stats?.levels?.seal_orbit||0)>0;
    c.save();c.translate(p.x,p.y);
    /* Wash the paper into a faint clearing without an opaque magic aura. */
    c.globalAlpha=mastered?.055:.034;c.fillStyle=PAPER;
    c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
    c.strokeStyle=mastered?AWAKEN_RED:INK;
    c.lineCap='round';c.lineWidth=mastered?2.1:1.65;
    c.globalAlpha=mastered?.72:.40;
    for(let k=0;k<3;k++){
      const turn=(S.reduced?0:Math.sin(t*.63+k)*.03);
      c.beginPath();c.arc(0,0,r+(k-1)*2.4,
        .18+k*2.14+turn,1.70+k*2.14+turn);c.stroke();
    }
    /* A feather-thin edge of absence; no rotating projectiles. */
    c.globalAlpha=mastered?.17:.12;
    c.lineWidth=.7;c.beginPath();
    c.arc(0,0,r-6,.25,TAU-.25);c.stroke();
    c.restore();
  }

  function drawPlayer(c,t){
    const S=G.S,p=S.player,st=S.stats;
    const seed=p.visualSeed||0x51a7;
    const aim=p.visualAim==null?p.aim:p.visualAim;
    const mvx=p.visualMoveX||0,mvy=p.visualMoveY||0;
    const motion=Math.min(1,Math.hypot(mvx,mvy));
    const size=p.displayScale||1;
    const reduced=!!S.reduced;
    c.save();c.translate(p.x,p.y);
    const recoil=Math.min(.55,Math.max(0,p.recoil)*.24);
    c.translate(-Math.cos(aim)*recoil,-Math.sin(aim)*recoil);
    const active=p.visualState==='run'||p.visualState==='turn';
    const speed=Math.max(0,Math.min(1,p.visualSpeed||0));
    const stride=reduced?0:Math.sin(p.flowPhase||0);
    const impulse=reduced?0:Math.min(1,(p.hitPulse||0)/.18);
    const delight=reduced?0:Math.sin(Math.PI*Math.min(1,(p.rankPulse||0)/.48));
    const absorb=reduced?0:Math.min(1,(p.absorbPulse||0)/.13);
    const anticipation=p.visualState==='anticipate'?.025:0;
    const braking=p.visualState==='brake'?.032:0;
    c.rotate((p.visualTilt||0)*.65+(p.visualState==='turn' ? .047*stride : 0));
    c.scale(size*(1+speed*.065-impulse*.075+delight*.05-braking),
      size*(1-speed*.055+impulse*.065+anticipation+absorb*.018));
    /* Torso stays poised while the two bottom folds visibly trade
       weight; the full spirit never hops wildly or shakes. */
    if(!reduced)c.translate(0,
      (active?Math.sin((p.flowPhase||0)*2)*.42*speed:
        Math.sin(t*2.3+seed*.001)*.23)-impulse*1.15);
    c.fillStyle=INK;c.globalAlpha=1;
    inkSoulPath(c,p.r,t,seed,reduced,motion);
    c.fill();
    /* Curved single paper-eye: watchful and curious, not an angry
       two-slit monster. Its gaze eases with the game's existing aim. */
    const eyeX=Math.cos(aim)*p.r*.28,eyeY=-p.r*.13+Math.sin(aim)*p.r*.12;
    c.strokeStyle=PAPER;c.lineWidth=1.9;c.lineCap='round';
    c.beginPath();c.moveTo(eyeX-2.1,eyeY-.8);
    c.quadraticCurveTo(eyeX,eyeY+1.1,eyeX+2.5,eyeY-.55);c.stroke();
    if(S.invulnT>0){
      c.save();c.globalAlpha=reduced?.35:.28+Math.sin(t*3)*.05;
      c.lineWidth=1;c.strokeStyle=INK;
      c.beginPath();c.arc(0,0,p.r*size+4,0,TAU);c.stroke();
      c.restore();
    }
    if(st&&st.ward){
      const ready=st.wardCd<=0,wa=aim+Math.PI;
      c.save();c.translate(Math.cos(wa)*(p.r+12),Math.sin(wa)*(p.r+12)-2);
      c.rotate((reduced?0:Math.sin(t*1.7)*.07)-.35);
      c.globalAlpha=ready?.9:.2;c.strokeStyle=INK;c.lineWidth=1.4;
      c.strokeRect(-4,-6.5,8,13);
      if(ready){c.fillStyle=INK;c.fillRect(-1.6,-1.6,3.2,3.2);}
      c.restore();
    }
    c.restore();
  }

  function drawSuiteki(c,pd,t){
    const age=pd.max-pd.life,spread=Math.min(1,age/.68);
    const fade=Math.min(1,pd.life/.38);
    const radius=pd.r*spread,variant=pd.variant||0;
    if(radius<.5)return;
    c.save();c.translate(pd.x,pd.y);
    c.rotate(variant*Math.PI/2);c.scale(1.12,.74);
    c.fillStyle=INK;c.globalAlpha=.72*fade;
    blobPath(c,0,0,radius,pd.seed,.26,12);c.fill();
    c.globalAlpha=.48*fade;
    blobPath(c,radius*.13,-radius*.07,radius*.72,pd.seed^1009,.23,11);c.fill();
    if(spread>.3){
      for(let j=0;j<3;j++){
        const angle=variant*1.2+j*2.09;
        inkStroke(c,[
          {x:Math.cos(angle)*radius*.64,y:Math.sin(angle)*radius*.64},
          {x:Math.cos(angle+.12)*radius*1.05,y:Math.sin(angle+.12)*radius*1.05},
          {x:Math.cos(angle-.11)*radius*1.45,y:Math.sin(angle-.11)*radius*1.45}
        ],1.7,{color:INK,alpha:.42*fade,seed:pd.seed+j,taper:.5,jit:.02});
      }
    }
    c.restore();
    if(pd.vesselT>0){
      c.save();c.translate(pd.x+9,pd.y-10);
      c.rotate(-.35+variant*.13);
      c.globalAlpha=Math.min(.8,pd.vesselT/.18);
      c.strokeStyle=INK;c.lineWidth=1.2;
      c.beginPath();c.moveTo(-6,-2);c.lineTo(5,-2);
      c.lineTo(4,3);c.quadraticCurveTo(0,6,-5,3);c.closePath();c.stroke();
      c.beginPath();c.arc(5,-4,2.2,0,TAU);c.stroke();
      c.fillStyle=INK;c.beginPath();c.arc(7,0,1.5,0,TAU);c.fill();
      c.restore();
    }
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
    if(mark.kind==='heavenlyStroke'){
      const pts=mark.points||[];
      /* A visible promise on the page, then a rapid brushstroke reveal.
         This very same sampled curve powers GUARDIANS.hits(). */
      const reveal=warning?Math.min(1,(1-remain)*1.8):
        Math.min(1,Math.max(0,(-mark.t)/.22));
      const limit=warning?pts.length:Math.max(2,Math.ceil(reveal*(pts.length-1)));
      const pigment=INK;
      for(let j=1;j<Math.min(pts.length,limit+1);j++){
        const a=pts[j-1],b=pts[j],frac=j/(pts.length-1);
        if(!warning&&frac>reveal)break;
        c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);
        const weight=mark.width*(a.width+b.width)*.5;
        if(warning){
          c.strokeStyle=pigment;
          c.lineWidth=1.2+weight*.07;
          c.globalAlpha=.22+.37*(1-remain);
        }else{
          c.strokeStyle=pigment;
          c.lineWidth=weight;
          c.globalAlpha=.93;
        }
        c.stroke();
      }
      if(!warning&&reveal>.12){
        /* Split wet/dry edge without making a rectangular highway. */
        c.globalAlpha=.24;c.strokeStyle=PAPER;c.lineWidth=1.1;
        c.beginPath();
        for(let j=1;j<Math.max(2,Math.floor(reveal*pts.length));j+=3){
          const p=pts[j];
          j===1?c.moveTo(p.x+1.7,p.y):c.lineTo(p.x+1.7,p.y);
        }
        c.stroke();
      }
      if(warning&&pts.length){
        const head=pts[Math.max(0,Math.min(pts.length-1,Math.floor(reveal*(pts.length-1))))];
        c.globalAlpha=.56;c.fillStyle=pigment;
        c.beginPath();c.arc(head.x,head.y,2.1+2*(1-remain),0,TAU);c.fill();
      }
      c.restore();return;
    }
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
    if(themeKey!=='pale')drawDecor(ctx, vx0, vy0, vx1, vy1);

    /* Stage-long paper history, spatially indexed by viewport cells.
       Old weapon strikes and enemy blood remain through every wave. */
    const cullM=105;
    for(let cy=Math.floor((vy0-cullM)/STAIN_CELL);
      cy<=Math.floor((vy1+cullM)/STAIN_CELL);cy++){
      for(let cx=Math.floor((vx0-cullM)/STAIN_CELL);
        cx<=Math.floor((vx1+cullM)/STAIN_CELL);cx++){
        const list=stainCells.get(cx+','+cy);
        if(!list)continue;
        for(const st of list){
          if(st.x<vx0-cullM||st.x>vx1+cullM||st.y<vy0-cullM||st.y>vy1+cullM)continue;
          ctx.globalAlpha=st.a;
          if(st.angle){
            ctx.save();ctx.translate(st.x,st.y);ctx.rotate(st.angle);
            ctx.drawImage(st.spr,-st.half,-st.half,st.half*2,st.half*2);
            ctx.restore();
          }else ctx.drawImage(st.spr,st.x-st.half,st.y-st.half,st.half*2,st.half*2);
        }
      }
    }
    ctx.globalAlpha=1;

    if (playing) drawEraserField(ctx,S,t);
    for (const pd of S.puddles) drawSuiteki(ctx,pd,t);
    if (!S.reduced) updateAmbient(dt, S);

    for (const mark of S.guardianMarks || []) drawGuardianHazard(ctx, mark, t);
    for (const m of S.markers) drawMarker(ctx, m);
    for (const r of S.rings) drawRing(ctx, r);
    for (const b of S.bullets) drawBullet(ctx, b);
    for (const b of S.ebullets) drawEBullet(ctx, b);
    for (const e of S.enemies) {
      if(themeKey==='dark')drawNightSighting(ctx,e);
      drawEnemy(ctx,e,t);
    }
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
    vg.addColorStop(1, `rgba(${th.vig},${lowHp ? 0.3 : themeKey==='pale' ? .025 : .17})`);
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

  /* A small read-only inspection surface for cross-wave visual QA.
     It is not part of gameplay or the per-frame paint path. */
  function terrainStats(){
    const weapons={};let blood=0;
    for(const mark of stains){
      if(mark.kind==='blood')blood++;
      else weapons[mark.kind]=(weapons[mark.kind]||0)+1;
    }
    return {total:stains.length,blood,weapons};
  }

  return { draw, resetStains, eraseTerrain, terrainStats };
})();
