'use strict';
/* ============================================================
   ONE MORE — bootstrap: canvas, input, loop, wiring
   ============================================================ */

(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');

  /* ---------------- sizing ---------------- */
  let drawnW=0,drawnH=0,drawnDpr=0;
  function resize() {
    const standalone=window.navigator.standalone===true||
      window.matchMedia('(display-mode: standalone)').matches;
    document.documentElement.classList.toggle('om-pwa-standalone',standalone);
    /* Stage size comes from CSS + the REAL home-indicator inset. */
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if(w===drawnW&&h===drawnH&&dpr===drawnDpr)return;
    drawnW=w;drawnH=h;drawnDpr=dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    G.S.W = w; G.S.H = h; G.S.dpr = dpr;
  }
  window.addEventListener('resize', resize);
  /* iOS can settle its env() insets after first load. Follow actual CSS
     size changes without redrawing/backbuffer allocation every frame. */
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(stage);
  resize();
  G.S.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- opt-in first-stroke guidance ---------------- */
  const helpDialog=document.getElementById('howToPlayDialog');
  const firstHint=document.getElementById('firstRunHint');
  let hintTimer=0, hintFadeTimer=0, hintedInSession=false;
  function dismissHint(){
    clearTimeout(hintTimer);clearTimeout(hintFadeTimer);
    firstHint.classList.add('hidden');
    firstHint.classList.remove('is-leaving');
  }
  function welcomeFirstRun(){
    if(hintedInSession)return;
    try { if(localStorage.getItem('om_first_brush_hint_v1')==='1')return; } catch(_){}
    hintedInSession=true;
    try { localStorage.setItem('om_first_brush_hint_v1','1'); } catch(_){}
    dismissHint();
    firstHint.classList.remove('hidden');
    hintTimer=setTimeout(()=>{
      firstHint.classList.add('is-leaving');
      hintFadeTimer=setTimeout(dismissHint,420);
    },4600);
  }

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

  function clearInput() {
    for (const key of Object.keys(keys)) delete keys[key];
    const pointer = G.S.joy;
    G.S.joy = null;
    G.S.inputVec.x = 0;
    G.S.inputVec.y = 0;
    if (pointer && canvas.hasPointerCapture?.(pointer.id)) {
      try { canvas.releasePointerCapture(pointer.id); } catch (_) {}
    }
  }

  function pause() {
    if (G.mode !== 'playing') return;
    clearInput();
    G.mode = 'paused';
    UI.show('pause');
  }

  function resume() {
    if (G.mode !== 'paused') return;
    clearInput();
    G.mode = 'playing';
    UI.show(null);
  }

  function start(mode = 'journey', worldIndex, level) {
    clearInput();
    SFX.ensure();
    if (mode === 'journey' && worldIndex == null) {
      G.openCampaign();
      return;
    }
    R.resetStains(); /* a fresh sheet, never the previous level's stains */
    if (mode === 'journey') G.startLevel(worldIndex, level);
    else G.startRun('endless');
    if(G.mode==='playing')welcomeFirstRun();
  }

  function goMenu() {
    dismissHint();
    if(helpDialog.open)helpDialog.close();
    clearInput();
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
    if(helpDialog.open)return; /* keep modal button/keyboard behavior native */
    if (G.mode==='opening') { e.preventDefault(); OPENING.skip(); return; }
    if (INTRO.handleKey(k)) { e.preventDefault(); return; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
    SFX.ensure();
    if (e.repeat) {
      if (G.mode === 'playing' && /^(?:Key[WASD]|Arrow(?:Up|Down|Left|Right))$/.test(k)) {
        keys[k] = true; vec();
      }
      return;
    }
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
    if (m === 'playing' && /^(?:Key[WASD]|Arrow(?:Up|Down|Left|Right))$/.test(k)) {
      keys[k] = true;
      vec();
    }
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
      vec(); /* Preserve keyboard movement if both inputs were in use. */
    }
  };
  canvas.addEventListener('pointerup', endJoy);
  canvas.addEventListener('pointercancel', endJoy);
  canvas.addEventListener('lostpointercapture', endJoy);

  /* ---------------- buttons ---------------- */
  document.getElementById('playBtn').addEventListener('click', () => start('journey'));
  document.getElementById('endlessBtn').addEventListener('click', () => start('endless'));
  const helpSteps = [...helpDialog.querySelectorAll('.home-help-steps > div')];
  let helpStep = 0;
  function showHelpStep(index) {
    helpStep = Math.max(0, Math.min(helpSteps.length - 1, index));
    helpSteps.forEach((step, i) => { step.hidden = i !== helpStep; });
    document.getElementById('helpPrev').disabled = helpStep === 0;
    document.getElementById('helpNext').disabled = helpStep === helpSteps.length - 1;
    document.getElementById('helpPage').textContent =
      String(helpStep + 1).padStart(2, '0') + ' / ' + String(helpSteps.length).padStart(2, '0');
  }
  document.getElementById('howToPlayBtn').addEventListener('click', () => {
    if(G.mode==='title'&&!helpDialog.open) {
      showHelpStep(0);
      helpDialog.showModal();
    }
  });
  document.getElementById('helpPrev').addEventListener('click', () => showHelpStep(helpStep - 1));
  document.getElementById('helpNext').addEventListener('click', () => showHelpStep(helpStep + 1));
  helpDialog.addEventListener('keydown', e => {
    if(e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      showHelpStep(helpStep + (e.key === 'ArrowRight' ? 1 : -1));
    }
  });
  document.getElementById('helpClose').addEventListener('click', () => helpDialog.close());
  document.getElementById('helpDone').addEventListener('click', () => {
    helpDialog.close();
    start('journey');
  });
  helpDialog.addEventListener('click', e => {
    if(e.target===helpDialog)helpDialog.close();
  });
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
  const campaignTabs = document.querySelector('.campaign-tabs');
  const campaignViews = ['scrolls', 'weapons', 'levels'];
  campaignTabs.addEventListener('click', e => {
    const tab = e.target.closest('[data-campaign-view]');
    if(tab) UI.selectCampaignView(tab.dataset.campaignView);
  });
  campaignTabs.addEventListener('keydown', e => {
    if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
    const current = campaignViews.indexOf(document.querySelector('.campaign-panel').dataset.view);
    const i = e.key === 'Home' ? 0 : e.key === 'End' ? campaignViews.length - 1 :
      (current + (e.key === 'ArrowRight' ? 1 : -1) + campaignViews.length) % campaignViews.length;
    e.preventDefault();
    UI.selectCampaignView(campaignViews[i]);
    campaignTabs.querySelector('[data-campaign-view="' + campaignViews[i] + '"]').focus();
  });
  document.getElementById('campaignNextBtn').addEventListener('click', () => {
    const view = document.querySelector('.campaign-panel').dataset.view;
    UI.selectCampaignView(view === 'scrolls' ? 'weapons' : view === 'weapons' ? 'levels' : 'scrolls');
  });
  document.getElementById('campaignWorlds').addEventListener('click', e => {
    const button = e.target.closest('button[data-world]');
    if (!button || button.disabled) return;
    G.openCampaign(Number(button.dataset.world));
  });
  document.getElementById('starterGrid').addEventListener('click',e=>{
    const b=e.target.closest('button[data-starter]');
    if(!b||b.disabled||G.mode!=='select')return;
    G.setStarter(b.dataset.starter);
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
  const openingSkip=document.getElementById('openingSkip');
  const themeColor=document.querySelector('meta[name="theme-color"]');
  const paperTint={pale:'#ede7d9',dark:'#242b39',red:'#eadbc4'};
  let statusTint=null,openingBackdrop=null;
  function tintSystemBar(color){
    if(statusTint===color)return; /* never churn styles on every animation frame */
    statusTint=color;
    document.body.style.backgroundColor=color;
    document.documentElement.style.backgroundColor=color;
    if(themeColor)themeColor.setAttribute('content',color);
  }
  function setOpeningBackdrop(dark){
    if(openingBackdrop===dark)return;
    openingBackdrop=dark;
    document.body.classList.toggle('ink-opening',dark);
    tintSystemBar(dark?'#131009':paperTint.pale);
  }
  function syncSystemBar(mode){
    if(mode==='opening')return; /* opening has its own black-to-paper transition */
    const gameplay=['playing','paused','upgrade','dying'].includes(mode);
    const area=gameplay?AREAS[G.S.areaIdx%AREAS.length]:null;
    tintSystemBar(paperTint[area?.theme]||paperTint.pale);
  }
  openingSkip.addEventListener('click',()=>OPENING.skip());
  window.addEventListener('pointerdown',()=>{
    if(G.mode==='opening')OPENING.skip(); /* tap anywhere: original GLM behavior */
  });

  window.addEventListener('blur', () => { clearInput(); pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  /* ---------------- init ---------------- */
  UI.buildLegend();
  UI.buildTicker();
  UI.selectCampaignView('scrolls');
  UI.muteVisual(SFX.muted);
  UI.setRunNo(G.getRuns() + 1);
  UI.setBest(G.getBest());
  G.initAttract();
  UI.show('title');
  G.mode = 'title';
  /* The compact GLM prologue opens the game. The separate seven-shot
     original film still plays from the existing WATCH FILM button. */
  OPENING.onEnd=()=>{
    setOpeningBackdrop(false);
    openingSkip.classList.add('hidden');
    G.mode='title';
    UI.show('title');
  };
  if(G.S.reduced){
    OPENING.onEnd(); /* honor the user's reduced-motion preference */
  }else{
    UI.show(null);
    UI.hud(false);
    G.mode='opening';
    openingSkip.classList.remove('hidden');
    setOpeningBackdrop(true);
    OPENING.start();
  }

  /* ---------------- main loop ---------------- */
  let last = performance.now();
  let lastMode = G.mode;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;

    const m = G.mode;
    syncSystemBar(m);
    if (lastMode === 'playing' && m !== 'playing') clearInput();
    lastMode = m;
    vec();
    /* The seven-shot story film keeps its own canvas. The compact
       opening is drawn on the ordinary game canvas without gameplay. */
    if (m === 'intro' || m === 'chronicle') return;
    if (m === 'opening'){
      OPENING.update(dt);
      ctx.setTransform(G.S.dpr,0,0,G.S.dpr,0,0);
      if(G.mode==='opening'){
        OPENING.draw(ctx,now/1000);
        if(OPENING.isRimPaper())setOpeningBackdrop(false);
      }else R.draw(ctx,now/1000);
      return;
    }
    if (m === 'playing') G.update(dt);
    else if (m === 'dying') G.updateDying(dt);
    else if (m === 'title' || m === 'select' || m === 'over') G.updateIdle(dt);

    ctx.setTransform(G.S.dpr, 0, 0, G.S.dpr, 0, 0);
    R.draw(ctx, now / 1000);
  }
  requestAnimationFrame(frame);
})();
