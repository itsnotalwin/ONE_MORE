'use strict';
/* ============================================================
   ONE MORE — bootstrap: canvas, input, loop, wiring
   ============================================================ */

(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');

  /* ---------------- sizing ---------------- */
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    G.S.W = w; G.S.H = h; G.S.dpr = dpr;
  }
  window.addEventListener('resize', resize);
  resize();
  G.S.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- input ---------------- */
  const keys = Object.create(null);

  function vec() {
    let x = 0, y = 0;
    if (keys.KeyW || keys.ArrowUp) y -= 1;
    if (keys.KeyS || keys.ArrowDown) y += 1;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    const j = G.S.joy;
    if (j) {
      const l = Math.hypot(j.dx, j.dy);
      if (l > 6) { x = j.dx / 52; y = j.dy / 52; }
    }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    G.S.inputVec.x = x; G.S.inputVec.y = y;
  }

  function pause() {
    if (G.mode !== 'playing') return;
    G.mode = 'paused';
    UI.show('pause');
  }

  function resume() {
    if (G.mode !== 'paused') return;
    G.mode = 'playing';
    UI.show(null);
  }

  function start(mode = 'journey', worldIndex, level) {
    SFX.ensure();
    if (mode === 'journey' && worldIndex == null) {
      G.openCampaign();
      return;
    }
    R.resetStains(); /* a fresh sheet, never the previous level's stains */
    if (mode === 'journey') G.startLevel(worldIndex, level);
    else G.startRun('endless');
  }

  function goMenu() {
    SFX.ensure();
    R.resetStains();
    G.abandon();
  }

  function toggleMute() {
    SFX.ensure();
    UI.muteVisual(SFX.toggle());
  }

  window.addEventListener('keydown', e => {
    const k = e.code;
    if (INTRO.handleKey(k)) { e.preventDefault(); return; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
    SFX.ensure();
    if (e.repeat) { keys[k] = true; return; }
    if (k === 'KeyM') { toggleMute(); return; }
    const m = G.mode;
    if (k === 'KeyP' || k === 'Escape') {
      if (m === 'playing') pause();
      else if (m === 'paused') resume();
      return;
    }
    if (k === 'Enter') {
      if (m === 'title') start('journey');
      else if (m === 'over') {
        SFX.ensure();
        R.resetStains();
        G.retryOrNext();
      }
      else if (m === 'upgrade') G.deploy();
      else if (m === 'paused') resume();
      return;
    }
    if (m === 'upgrade' && /^Digit[123]$/.test(k)) {
      G.pickAt(Number(k.slice(5)) - 1);
      return;
    }
    keys[k] = true;
    vec();
  });

  window.addEventListener('keyup', e => {
    keys[e.code] = false;
    vec();
  });

  /* touch joystick */
  canvas.addEventListener('pointerdown', e => {
    SFX.ensure();
    if (e.pointerType === 'mouse') return;
    if (G.mode !== 'playing') return;
    G.S.joy = { id: e.pointerId, ax: e.clientX, ay: e.clientY, dx: 0, dy: 0 };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    const j = G.S.joy;
    if (!j || e.pointerId !== j.id) return;
    let dx = e.clientX - j.ax, dy = e.clientY - j.ay;
    const l = Math.hypot(dx, dy);
    if (l > 52) { dx = (dx / l) * 52; dy = (dy / l) * 52; }
    j.dx = dx; j.dy = dy;
    vec();
  });
  const endJoy = e => {
    if (G.S.joy && e.pointerId === G.S.joy.id) {
      G.S.joy = null;
      G.S.inputVec.x = 0; G.S.inputVec.y = 0;
    }
  };
  canvas.addEventListener('pointerup', endJoy);
  canvas.addEventListener('pointercancel', endJoy);

  /* ---------------- buttons ---------------- */
  document.getElementById('playBtn').addEventListener('click', () => start('journey'));
  document.getElementById('endlessBtn').addEventListener('click', () => start('endless'));
  document.getElementById('continueBtn').addEventListener('click', () => {
    SFX.ensure();
    /* A new Endless run begins on a new sheet. */
    R.resetStains();
    G.continueEndless();
  });
  document.getElementById('againBtn').addEventListener('click', () => {
    SFX.ensure();
    R.resetStains();
    G.retryOrNext();
  });
  document.getElementById('selectBackBtn').addEventListener('click', goMenu);
  document.getElementById('campaignWorlds').addEventListener('click', e => {
    const button = e.target.closest('button[data-world]');
    if (!button || button.disabled) return;
    G.openCampaign(Number(button.dataset.world));
  });
  document.getElementById('campaignLevels').addEventListener('click', e => {
    const button = e.target.closest('button[data-level]');
    if (!button || button.disabled) return;
    start('journey', G.S.worldIndex, Number(button.dataset.level));
  });
  document.getElementById('menuBtn').addEventListener('click', goMenu);
  document.getElementById('resumeBtn').addEventListener('click', resume);
  document.getElementById('pauseMenuBtn').addEventListener('click', goMenu);
  document.getElementById('deployBtn').addEventListener('click', () => G.deploy());
  document.getElementById('muteBtn').addEventListener('click', toggleMute);

  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  /* ---------------- init ---------------- */
  UI.buildLegend();
  UI.buildTicker();
  UI.muteVisual(SFX.muted);
  UI.setRunNo(G.getRuns() + 1);
  UI.setBest(G.getBest());
  G.initAttract();
  UI.show('title');
  G.mode = 'title';
  INTRO.play(); /* one cinematic viewing per session; replay on title */

  /* ---------------- main loop ---------------- */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;

    vec();
    const m = G.mode;
    if (m === 'playing') G.update(dt);
    else if (m === 'dying') G.updateDying(dt);
    else if (m === 'title' || m === 'select' || m === 'over') G.updateIdle(dt);

    ctx.setTransform(G.S.dpr, 0, 0, G.S.dpr, 0, 0);
    R.draw(ctx, now / 1000);
  }
  requestAnimationFrame(frame);
})();
