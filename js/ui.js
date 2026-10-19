'use strict';
/* ============================================================
   ONE MORE — DOM / UI layer (ink scroll edition)
   ============================================================ */

const UI = (() => {
  const $ = id => document.getElementById(id);

  const el = {
    hud: $('hud'), hudWave: $('hudWave'), waveFill: $('waveFill'), hudHp: $('hudHp'),
    hudScore: $('hudScore'), hudTime: $('hudTime'), muteBtn: $('muteBtn'),
    inkMeter: $('inkMeter'), inkRank: $('inkRank'), inkFill: $('inkFill'),
    hudArea: $('hudArea'), hudAreaKanji: $('hudAreaKanji'), hudAreaName: $('hudAreaName'),
    hudWaveTotal: $('hudWaveTotal'), hudMode: $('hudMode'),
    banner: $('waveBanner'), bannerKicker: $('bannerKicker'), bannerTitle: $('bannerTitle'),
    screens: {
      intro: $('screenIntro'), chronicle: $('screenChronicle'),
      title: $('screenTitle'), select: $('screenSelect'), upgrade: $('screenUpgrade'),
      pause: $('screenPause'), over: $('screenOver'),
    },
    runNo: $('runNo'), bestLine: $('bestLine'), enemyLegend: $('enemyLegend'), tickerTrack: $('tickerTrack'),
    hudLoadout: $('hudLoadout'),
    upKicker: $('upKicker'), upNext: $('upNext'), upgradeGrid: $('upgradeGrid'), deployBtn: $('deployBtn'),
    overKicker: $('overKicker'), overRank: $('overRank'), overTitle: $('overTitle'), overSub: $('overSub'),
    continueBtn: $('continueBtn'), againBtn: $('againBtn'),
    campaignWorlds: $('campaignWorlds'), campaignLevels: $('campaignLevels'),
    campaignWorldName: $('campaignWorldName'), campaignMechanic: $('campaignMechanic'),
    campaignStatus: $('campaignStatus'),
    starterGrid: $('starterGrid'),starterCount: $('starterCount'),
    starterExplain: $('starterExplain'),
    statWaves: $('statWaves'), statKills: $('statKills'), statInkRank: $('statInkRank'), statTime: $('statTime'), statScore: $('statScore'),
    newBestBadge: $('newBestBadge'), flash: $('flash'),
  };

  let bannerTimer = null;
  let flashTimer = null;
  let lastTimeStr = '';

  const pad2 = n => String(n).padStart(2, '0');
  const pad3 = n => String(n).padStart(3, '0');
  const fmtScore = n => n.toLocaleString('en-US').padStart(7, '0');
  const fmtTime = s => pad2(Math.floor(s / 60)) + ':' + pad2(Math.floor(s % 60));

  /* kanji numerals — the calligraphic count of waves */
  function toKanji(n) {
    if (n <= 0) return '〇';
    if (n > 99) return String(n);
    const D = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    if (n < 10) return D[n];
    const t = Math.floor(n / 10), o = n % 10;
    return (t > 1 ? D[t] : '') + '十' + (o ? D[o] : '');
  }

  /* hand-brushed creature glyphs */
  const CREATURE_SVGS = {
    pulse: '<path d="M12 4.2c3.8-.5 7 2.6 6.8 6.4-.2 4.2-2.7 8-7 8.2-4 .2-6.6-3.4-6.6-7.2C5.2 7.6 8 4.7 12 4.2z" fill="currentColor"/><path d="M9.4 11.2l2.6 1M14.6 11l-2.2 1.4" stroke="#ede7d9" stroke-width="1.4" stroke-linecap="round"/>',
    dart: '<path d="M19.5 12c-2.2-3.4-6-5.8-9.6-5.2-2.8.5-5 2.4-5.4 5.2.4 2.8 2.6 4.7 5.4 5.2 3.6.6 7.4-1.8 9.6-5.2z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19.5 12l-4.2-1.6M19.5 12l-4.2 1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    split: '<path d="M12 3.6c1 2.8 1.4 4.2 1.4 6.2 0 1.4-.5 2.2-.5 3.4 0 2.2 1.6 2.6 1.6 4.4 0 1.7-1.2 3-2.5 3s-2.5-1.3-2.5-3c0-1.8 1.6-2.2 1.6-4.4 0-1.2-.5-2-.5-3.4 0-2 .4-3.4 1.4-6.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    slab: '<path d="M12 4c4.4-.6 7.6 2.8 7.4 7-.2 4.8-2.9 8.6-7.6 8.8-4.4.2-7.2-3.4-7.2-7.6C4.6 7.8 7.4 4.6 12 4z" fill="currentColor" opacity=".92"/><path d="M7 9l8-3M6.4 12.4l10-4M7 15.6l9.4-3.8M9 18.4l7.6-3" stroke="#ede7d9" stroke-width="1.1" opacity=".85"/>',
    wraith: '<path d="M5 14c2-6 5-8 7-6.4 2 1.6-1 4.4 1.4 6 2.4 1.6 5-1 5.6-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="17.4" cy="7.2" r="1.6" fill="currentColor"/>',
    pulseling: '<path d="M12 6.6c2.8-.4 4.9 1.9 4.8 4.5-.1 3-1.9 5.6-4.9 5.8-2.8.1-4.6-2.4-4.6-5 0-2.7 1.9-4.9 4.7-5.3z" fill="currentColor"/>',
    spit: '<path d="M12 4.4c3.6-.5 6.6 2.3 6.5 5.9-.1 3.9-2.4 7.4-6.5 7.6-3.7.2-6.1-3-6.1-6.6 0-3.2 2.6-6.5 6.1-6.9z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M17.8 12l3.4-1.7M17.8 12l3.4 1.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10.2" cy="11" r="1.5" fill="currentColor"/>',
    moth: '<path d="M16.8 12c-2.4 3-5.4 4.4-7.6 3.4-1.8-.8-2-3-.6-5 1.6-2.3 4.8-3.4 7-2.2 1.6.9 2 2.2 1.2 3.8z" fill="currentColor"/><path d="M6.2 8.6L3.6 6.4M6.4 15.4L3.8 17.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M2.6 12h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".45"/>',
    shade: '<path d="M12 4.8c3.4-.4 6 2.1 5.9 5.4-.1 3.6-2.3 6.8-6 7-3.4.2-5.7-2.6-5.7-5.8 0-3.1 2.5-6.2 5.8-6.6z" fill="currentColor" opacity=".55"/><path d="M9.3 10.6l2.4 1M14.6 10.4l-2.2 1.3" stroke="#ede7d9" stroke-width="1.4" stroke-linecap="round"/>',
    titan: '<path d="M12 3.8c4.9-.6 8.4 3 8.2 7.6-.2 5.2-3.2 9.3-8.3 9.6-4.7.2-7.9-3.6-7.9-8.1 0-4.3 3-8.6 8-9.1z" fill="currentColor"/><path d="M7.6 8.6l8.6-3.2M6.6 12.4l10.8-4M7.2 16l9.8-3.8M9 19l7.4-3" stroke="#ede7d9" stroke-width="1" opacity=".8"/><circle cx="20.6" cy="5.6" r="1.2" fill="currentColor"/><circle cx="3.4" cy="17.8" r="1.2" fill="currentColor"/>',
    kage: '<path d="M12 5.2c3.2-.4 5.8 2 5.7 5.1-.1 3.3-2.1 6.3-5.7 6.5-3.2.2-5.4-2.4-5.4-5.3 0-2.9 2.3-5.9 5.4-6.3z" fill="currentColor" opacity=".8"/><path d="M4.2 6.8c1.6-.8 3-.9 4-.4M4 17.4c1.4.9 2.8 1.1 3.8.7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".5"/><path d="M9.6 10.8l2.3 1M14.8 10.6l-2.1 1.3" stroke="#ede7d9" stroke-width="1.3" stroke-linecap="round"/>',
    stilt: '<path d="M12 8.4l2.6 1.7v3.8L12 15.6l-2.6-1.7v-3.8L12 8.4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.6 15.8L7 21.4M13.4 15.8L17 21.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M12 8.4V4.6M10.9 5.8L12 4.4l1.1 1.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    oni: '<path d="M12 6c3.9-.5 6.9 2.4 6.8 6-.1 3.9-2.6 7.3-6.9 7.5-3.9.2-6.4-2.9-6.4-6.3 0-3.3 2.7-6.8 6.5-7.2z" fill="currentColor"/><path d="M10 5.4L8.8 2.6M14 5.4l1.2-2.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.4 11.4l2.2 1M14.6 11.2l-2 1.3" stroke="#ede7d9" stroke-width="1.3" stroke-linecap="round"/>',
    crane: '<path d="M20 12l-6-1.6-2.6-4.6L9.6 9 4 10.6l4.4 1.8L6 17.6l5-2.4 5.4 1.4-3-3.4L20 12z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="17" cy="11.4" r="1.1" fill="#b23a2b"/>',
  };

  /* hand-brushed upgrade glyphs */
  const GLYPHS = {
    rapid: '<path d="M6 17L15 7M11 18.5L20 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    heavy: '<path d="M12 4.5c1.4 3.4 2.2 5.4 2.2 7.6 0 2.8-1 4.9-2.2 4.9s-2.2-2.1-2.2-4.9c0-2.2.8-4.2 2.2-7.6z" fill="currentColor"/><circle cx="18" cy="16.8" r="1.6" fill="currentColor"/>',
    split: '<path d="M12 19V9M12 9c-2.6-1.4-3.4-3.4-3-5.6M12 9c2.6-1.4 3.4-3.4 3-5.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
    pierce: '<circle cx="12" cy="12" r="5.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M17.5 9.5L21 12l-3.5 2.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    over: '<path d="M4 8.5h9M7 12h11M4 15.5h7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    plate: '<path d="M12 4.5c1.4 3.4 2.2 5.4 2.2 7.6 0 2.8-1 4.9-2.2 4.9s-2.2-2.1-2.2-4.9c0-2.2.8-4.2 2.2-7.6z" fill="currentColor" stroke="currentColor" stroke-width="1.6"/>',
    velo: '<path d="M5 16.5C9 15 13 12 18.5 5.5M18.5 5.5l-1 5M18.5 5.5l-4.6 1.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    adren: '<rect x="6.5" y="6.5" width="11" height="11" fill="currentColor" transform="rotate(-4 12 12)"/><path d="M9.6 12.6l1.8 1.8 3.4-3.8" stroke="#ede7d9" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    shock: '<path d="M12 5.2c3.6-.4 6.4 2.4 6.2 5.8-.2 3.9-2.4 7.4-6.4 7.6-3.7.2-6-2.9-6-6.3 0-3.4 2.6-6.7 6.2-7.1z" fill="currentColor"/><path d="M12 8.5v4.2m0 2.2v.4" stroke="#ede7d9" stroke-width="1.6" stroke-linecap="round"/>',
    patch: '<path d="M12 5c1.2 3 2 4.8 2 6.8a2 2 0 1 1-4 0c0-2 .8-3.8 2-6.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    echo: '<path d="M12 20V9M12 4.2v1.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M9 6.8L12 3.8l3 3" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M9.4 17.4L12 20l2.6-2.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".45"/>',
    orbit: '<circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><path d="M18.6 7.6c1.5.6 2.3 1.6 2.3 1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M19.2 12c2.8-.4 4.9 1.9 4.8 4.5" fill="none"/><circle cx="19.2" cy="6.8" r="2.3" fill="currentColor"/>',
    nova: '<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 4.4v2.8M12 16.8v2.8M4.4 12h2.8M16.8 12h2.8M6.6 6.6l2 2M15.4 15.4l2 2M17.4 6.6l-2 2M8.6 15.4l-2 2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    slow: '<path d="M12 4.6c1.3 3.2 2.1 5 2.1 7.1 0 2.6-.9 4.5-2.1 4.5s-2.1-1.9-2.1-4.5c0-2.1.8-3.9 2.1-7.1z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6.4 19c1.8 1 3.6 1.5 5.6 1.5s3.8-.5 5.6-1.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none" opacity=".6"/>',
    crit: '<path d="M12 4.2c1.5 3.6 2.3 5.7 2.3 8 0 3-1 5.2-2.3 5.2s-2.3-2.2-2.3-5.2c0-2.3.8-4.4 2.3-8z" fill="currentColor"/><circle cx="17.6" cy="6.4" r="2" fill="#b23a2b"/>',
    ward: '<rect x="8" y="4.6" width="8" height="14.8" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10.4" r="1.7" fill="#b23a2b"/><path d="M10 15.6h4M10.6 17.6h2.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".6"/>',
    fan: '<path d="M12 19.5L4.8 8.2c4.4-2.9 10-2.9 14.4 0L12 19.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 19.5L7.4 7.6M12 19.5l4.6-11.9M12 19.5V6.2" stroke="currentColor" stroke-width="1.2" opacity=".7"/>',
    trailW: '<path d="M5 14.5h13l-1.6 4.3H7.2L5 14.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 14.5V7.1c0-1.7 1.4-3 3.2-3h3.6c1.8 0 3.2 1.3 3.2 3v7.4M9 6.4h6M13.5 10.2l4.7-2.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M19 10.5c0 1.5-1.2 2.7-2.4 2.7-1.2 0-2.4-1.2-2.4-2.7 0-1.1 2.4-4 2.4-4s2.4 2.9 2.4 4z" fill="currentColor" opacity=".68"/>',
    spirit: '<path d="M15.5 6.5c2.6 1.2 4 3.6 3.6 6.4-.4 3-2.6 5.3-5.8 5.4-2.8.1-5-1.8-5.2-4.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.4 14.2c-.5-2.4.8-4.6 3-5.6 2.4-1 5-.2 6.3 1.8" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".55"/><circle cx="7" cy="17.4" r="2.2" fill="currentColor"/>',
    knot: '<path d="M4 7C7 3 13 4 14 8s-4 8-7 6 0-6 4-5 7 5 9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="7" cy="14" r="2" fill="#b23a2b"/><circle cx="19.6" cy="18" r="1.7" fill="#b23a2b"/>',

    lantern: '<path d="M8 7c2-2 6-2 8 0v9c-2 2-6 2-8 0V7zM12 3v3M9 19h6M12 16v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><circle cx="12" cy="11.5" r="1.7" fill="currentColor"/>',
    crescent: '<path d="M17 3.5a8.3 8.3 0 1 0 3 13.4A9.5 9.5 0 0 1 17 3.5z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M18 7l2-1M18.6 12h2.4" stroke="currentColor" stroke-width="1.2"/>',
    mirror: '<path d="M6 6l6 12 6-12M7.5 7.5l4.5 8 4.5-8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>',
    shroud: '<path d="M9 4.5c3-1.2 6 1.2 6 4v7l-3-1.7L9 16l-2.5-2V9c0-2 .8-3.8 2.5-4.5zM15.5 8.5l3.5-1.5M16 12l4-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };
  /* the upgrade is filed under 'trail'; the glyph under 'trailW' — same brush */
  GLYPHS.trail = GLYPHS.trailW;

  const HP_DROP = '<svg viewBox="0 0 20 26" aria-hidden="true"><path class="hp-shape" d="M10 2.2c2.6 6 4.6 9.6 4.6 13.2 0 4.6-2 7.8-4.6 7.8s-4.6-3.2-4.6-7.8C5.4 11.8 7.4 8.2 10 2.2z"/></svg>';

  /* every ink-born beast, in the order the scrolls teach them */
  const LEGEND_ORDER = ['pulse', 'dart', 'spit', 'moth', 'split', 'shade', 'slab', 'wraith', 'kage', 'stilt', 'titan', 'oni', 'crane', 'pulseling'];

  function buildLegend() {
    el.enemyLegend.innerHTML = LEGEND_ORDER.map(k => {
      const d = ENEMIES[k];
      return `<span class="legend-item"><svg viewBox="0 0 24 24" aria-hidden="true">${CREATURE_SVGS[k]}</svg><b>${d.name}</b><i>${d.trait}</i><span class="legend-wave">${toKanji(d.intro)}</span></span>`;
    }).join('');
  }

  function buildTicker() {
    const p = 'ONE MORE WAVE · ONE MORE STROKE · THE INK REMEMBERS · THREE SCROLLS, ONE BRUSH · THE SCROLL TURNS · EVERY STAIN A STORY · ONE MORE RUN · ';
    const half = `<span>${p.repeat(6)}</span>`;
    el.tickerTrack.innerHTML = half + half;
  }

  /* The armory is a paper catalogue, not another loot roll. Every
     unlocked instrument may be carried back to an older stage. */
  function renderStarters(progress,selected='gun'){
    if(!el.starterGrid)return;
    const unlocks=STARTERS.filter(w=>w.unlock[1]===0 ||
      (progress.completed[w.unlock[0]]||0)>=w.unlock[1]);
    el.starterCount.textContent=String(unlocks.length).padStart(2,'0')+
      ' / '+String(STARTERS.length).padStart(2,'0')+' UNSEALED';
    el.starterGrid.innerHTML=STARTERS.map(w=>{
      const allowed=unlocks.includes(w),chosen=allowed&&selected===w.id;
      const detail=w.unlock[1]===0?'STARTING INSTRUMENT':
        'COMPLETE '+AREAS[w.unlock[0]].name+' · '+String(w.unlock[1]).padStart(2,'0');
      return `<button type="button" data-starter="${w.id}" class="starter-card${chosen?' selected':''}"
        ${allowed?'':'disabled'} aria-pressed="${chosen}"
        aria-label="${w.name}, ${w.kind.toLowerCase()}, ${allowed?(chosen?'equipped':'unlocked'):'locked: '+detail}">
        <span class="starter-icon" aria-hidden="true">${w.kanji}</span>
        <span class="starter-copy">
          <span class="starter-topline">${w.kind} · ${chosen?'EQUIPPED':allowed?'UNSEALED':'SEALED'}</span>
          <strong>${w.name}</strong>
          <small>${allowed?w.special:detail}</small>
        </span>
        <span class="starter-mark" aria-hidden="true">${chosen?'✓':allowed?'↗':'鎖'}</span>
      </button>`;
    }).join('');
    const active=STARTERS.find(w=>w.id===selected)||STARTERS[0];
    el.starterExplain.textContent=active.name+' · '+active.detail+
      '  Unlocked forever. Choose it on any previously reached level.';
  }

  /* Campaign selection is a new screen, built using the existing paper/ink tokens. */
  function renderCampaign(progress, selectedWorld) {
    const worlds = AREAS;
    el.campaignWorlds.innerHTML = worlds.map((area, i) => {
      const locked = !CAMPAIGN.isWorldUnlocked(i, progress);
      const complete = progress.completed[i] === CAMPAIGN.LEVELS_PER_WORLD;
      return `<button type="button" class="campaign-world${i === selectedWorld ? ' selected' : ''}" data-world="${i}" ${locked ? 'disabled' : ''}
        aria-pressed="${i === selectedWorld}" aria-label="${area.name}, ${locked ? 'locked' : complete ? 'complete' : 'unlocked'}">
        <span class="campaign-world-kanji">${locked ? '鎖' : area.kanji}</span>
        <span class="campaign-world-copy"><strong>${area.name}</strong><small>${locked ? 'SEALED' : complete ? 'COMPLETE' : `${progress.completed[i]} / 10 SEALED`}</small></span>
      </button>`;
    }).join('');
    const area = worlds[selectedWorld];
    const completeCount = progress.completed[selectedWorld];
    el.campaignWorldName.textContent = area.name;
    el.campaignMechanic.textContent = `${area.desc}  ·  ${area.mechanic}`;
    const nextLevel = Math.min(CAMPAIGN.LEVELS_PER_WORLD, completeCount + 1);
    const nextChapter = WAVE_DIRECTOR.level(selectedWorld, nextLevel);
    el.campaignStatus.textContent = completeCount === CAMPAIGN.LEVELS_PER_WORLD
      ? '10 / 10 LEVELS SEALED · SCROLL COMPLETE'
      : `${completeCount} / 10 COMPLETE · NEXT: ${nextChapter.title}`;
    el.campaignLevels.innerHTML = Array.from({ length: CAMPAIGN.LEVELS_PER_WORLD }, (_, i) => {
      const level = i + 1;
      const cleared = level <= completeCount;
      const available = CAMPAIGN.canPlay(selectedWorld, level, progress);
      const state = cleared ? 'SEALED' : available ? 'PLAY' : 'LOCKED';
      const stage = WAVE_DIRECTOR.level(selectedWorld, level);
      return `<button type="button" class="campaign-level${cleared ? ' cleared' : ''}" data-level="${level}"
        ${available ? '' : 'disabled'} aria-label="Level ${level}, ${stage.title}, ${state.toLowerCase()}" title="${stage.title} — ${stage.signature.toUpperCase()}">
        <span class="campaign-level-no">${pad2(level)}</span><span class="campaign-level-state">${state}</span>
        ${level === CAMPAIGN.LEVELS_PER_WORLD ? '<span class="campaign-boss-label">守</span>' : ''}
      </button>`;
    }).join('');
  }

  function show(name) {
    for (const k in el.screens) el.screens[k].classList.toggle('hidden', k !== name);
  }

  function hud(v) { el.hud.classList.toggle('hidden', !v); }

  function setMode(m, level) {
    if (el.hudMode) {
      el.hudMode.textContent = m === 'endless' ? 'ENDLESS SCROLL' : `LEVEL ${pad2(level)} / 10`;
      el.hudMode.classList.toggle('endless', m === 'endless');
    }
  }

  function setArea(area, waveInArea, isElite) {
    if (!el.hudArea) return;
    el.hudAreaKanji.textContent = area.kanji;
    el.hudAreaName.textContent = area.name;
    el.inkMeter.classList.toggle('is-night',area.theme==='dark');
    /* Keep HUD and wave warnings legible on indigo paper too. */
    el.hud.classList.toggle('is-night',area.theme==='dark');
    el.banner.classList.toggle('is-night',area.theme==='dark');
    el.hudWaveTotal.textContent = `${toKanji(waveInArea)} / ${toKanji(CFG.wave.wavesPerArea)}${isElite ? ' · 守' : ''}`;
  }

  function setWave(n) { el.hudWave.textContent = toKanji(n); }

  function setProgress(f) {
    el.waveFill.style.width = (Math.max(0, Math.min(1, f)) * 100).toFixed(1) + '%';
  }

  function setHp(cur, max) {
    el.hudHp.innerHTML = Array.from({ length: max }, (_, i) =>
      `<span class="hp-cell${i < cur ? ' on' : ''}">${HP_DROP}</span>`).join('');
  }

  function setScore(n) { el.hudScore.textContent = fmtScore(n); }

  function setTime(s) {
    const t = fmtTime(s);
    if (t !== lastTimeStr) { lastTimeStr = t; el.hudTime.textContent = t; }
  }

  function banner(n, surge, isElite, worldBoss = false, cue = null) {
    el.bannerKicker.textContent = worldBoss && isElite ? 'THE WORLD GUARDIAN WAKES'
      : isElite ? 'THE GUARDIAN WAKES'
      : surge ? 'THE SURGE'
      : cue || 'INCOMING';
    el.bannerTitle.innerHTML =
      `<span class="ban-kanji">${toKanji(n)}</span><span class="ban-lat">WAVE ${pad2(n)}${isElite ? ' — GUARDIAN' : ''}</span>`;
    el.banner.classList.toggle('surge', !!surge || !!isElite);
    el.banner.classList.toggle('area', false);
    el.banner.classList.remove('show');
    void el.banner.offsetWidth; /* restart animation */
    el.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.banner.classList.remove('show'), 1500);
  }

  /* a new sheet unrolls: the scroll turns */
  function areaBanner(area, cycle, deepEndless, level = null) {
    el.bannerKicker.textContent = level != null
      ? `SCROLL ${toKanji(cycle + 1)} — LEVEL ${toKanji(level)} OF 十`
      : deepEndless
        ? `THE SCROLL TURNS FOREVER — SHEET ${toKanji(cycle + 1)}`
        : `THE SCROLL TURNS — SHEET ${toKanji(cycle + 1)} OF ${toKanji(AREAS.length)}`;
    el.bannerTitle.innerHTML =
      `<span class="ban-kanji">${area.kanji}</span><span class="ban-lat">${area.name}</span>`;
    el.banner.classList.toggle('area', true);
    el.banner.classList.toggle('surge', false);
    el.banner.classList.remove('show');
    void el.banner.offsetWidth;
    el.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.banner.classList.remove('show'), 2400);
  }

  function flash() {
    el.flash.classList.add('on');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => el.flash.classList.remove('on'), 130);
  }

  function setInkProgress(rank, current, needed, leveled=false) {
    const safeRank=Math.max(1,Math.floor(rank));
    const pct=Math.max(0,Math.min(100,100*current/Math.max(1,needed)));
    el.inkRank.textContent='BRUSH '+pad2(safeRank);
    el.inkFill.style.width=pct.toFixed(1)+'%';
    el.inkMeter.setAttribute('aria-valuemax',String(Math.max(1,needed)));
    el.inkMeter.setAttribute('aria-valuenow',String(Math.max(0,Math.floor(current))));
    el.inkMeter.setAttribute('aria-valuetext',
      'Brush rank '+safeRank+', '+Math.floor(current)+' of '+needed+' ink');
    if(leveled) {
      el.inkMeter.classList.remove('is-ranking');
      void el.inkMeter.offsetWidth;
      el.inkMeter.classList.add('is-ranking');
    }
  }

  function setRunNo(n) { el.runNo.textContent = 'RUN ' + pad3(n); }

  function setBest(b) {
    if (b && b.score > 0) {
      el.bestLine.classList.remove('hidden');
      el.bestLine.innerHTML = `BEST — WAVE <span class="kanji-inline">${toKanji(b.wave)}</span> · ${b.score.toLocaleString('en-US')} PTS`;
    } else {
      el.bestLine.classList.add('hidden');
    }
  }

  function fillUpgrades(choices, levels) {
    el.upgradeGrid.innerHTML = '';
    choices.forEach((u, i) => {
      const lv = levels[u.id] || 0;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'up-card' + (u.weapon ? ' is-weapon' : '') + (u.seal ? ' is-seal' : '');
      const pips = u.patch ? '' : Array.from({ length: u.max }, (_, k) =>
        `<i class="pip${k < lv ? ' on' : ''}"></i>`).join('');
      const isNew = u.seal ? '<span class="up-new">VERMILION</span>' : !u.patch && lv === 0 ? '<span class="up-new">NEW</span>' : '';
      const isWpn = u.seal ? '<span class="up-wpn">朱</span>' : u.weapon ? '<span class="up-wpn">武</span>' : '';
      card.innerHTML =
        `<div class="up-top"><span class="up-no">之${toKanji(i + 1)}</span><span class="up-top-right">${isWpn}${isNew}<span class="up-pips">${pips}</span></span></div>` +
        `<svg class="up-glyph" viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[u.redSealOf || u.id] || GLYPHS.patch}</svg>` +
        `<h3 class="up-name">${u.name}</h3>` +
        `<p class="up-desc">${u.desc}</p>` +
        `<span class="up-check" aria-hidden="true"></span>`;
      card.addEventListener('click', () => G.pickAt(i));
      el.upgradeGrid.appendChild(card);
    });
  }

  function markSelected(i) {
    [...el.upgradeGrid.children].forEach((c, idx) => {
      c.classList.toggle('selected', idx === i);
      c.classList.toggle('faded', i !== null && idx !== i);
    });
  }

  function setDeploy(on, nextArea, waveInArea, cycle, sameWave=false) {
    el.deployBtn.classList.toggle('is-disabled', !on);
    el.deployBtn.disabled = !on;
    el.deployBtn.innerHTML = sameWave
      ? (on ? 'RETURN TO THE INK ↗' : 'SELECT A NEW STROKE')
      : on
      ? (nextArea
        ? `UNROLL — <span class="kanji-inline">${nextArea.kanji}</span> ${nextArea.name}`
        : `DEPLOY — WAVE <span class="kanji-inline">${toKanji(waveInArea)}</span>`)
      : (nextArea
        ? `NEXT — SCROLL <span class="kanji-inline">${nextArea.kanji}</span> ${nextArea.name}`
        : `DEPLOY — WAVE <span class="kanji-inline">${toKanji(waveInArea)}</span>`);
  }

  function setUpgradeHeader(waveInArea, area, globalNext, source='wave', rank=1) {
    const lastWave = waveInArea >= CFG.wave.wavesPerArea;
    el.upKicker.innerHTML = source==='ink'
      ? `INK ABSORBED · BRUSH RANK <span class="kanji-inline">${toKanji(rank)}</span>`
      : `SHEET <span class="kanji-inline">${area.kanji}</span> ${area.name} — WAVE <span class="kanji-inline">${toKanji(waveInArea)}</span> CLEARED`;
    el.upNext.innerHTML = source==='ink'
      ? '<span class="kanji-inline">'+toKanji(rank)+'</span>'
      : lastWave
      ? '<span class="kanji-inline">?</span>'
      : '<span class="kanji-inline">' + toKanji(waveInArea + 1) + '</span>';
  }

  function showOver(d) {
    const vict = !!d.victory;
    const campaign = d.mode === 'journey';
    const area = AREAS[d.worldIndex] || AREAS[0];
    if (campaign) {
      el.overTitle.textContent = vict ? 'THE SEAL IS SET.' : 'THE INK DRIES.';
      el.overSub.textContent = vict
        ? (d.finalCampaign ? 'Thirty levels sealed. The brush may wander forever.'
          : d.level === 10 ? 'This scroll is complete. A new sheet awaits.'
          : `Level ${pad2(d.level)} sealed. The next page is yours.`)
        : `The brush fell on wave ${pad2(d.waves + 1)}. This level remains yours to retry.`;
      el.overKicker.textContent = `RUN ${pad3(d.run)} — ${area.name} · LEVEL ${pad2(d.level)}${vict ? ' COMPLETE' : ''}`;
      el.againBtn.textContent = vict
        ? (d.finalCampaign ? 'CHOOSE A SCROLL' : d.level === 10 ? 'ENTER NEXT SCROLL' : 'NEXT LEVEL')
        : 'RETRY LEVEL';
    } else {
      el.overTitle.textContent = vict ? 'THE SCROLL ENDS.' : 'THE INK DRIES.';
      el.overSub.textContent = vict
        ? 'Three sheets painted. The paper asks for more.'
        : 'The paper keeps every stroke. Even this one.';
      el.overKicker.textContent = `RUN ${pad3(d.run)} — THE ENDLESS SCROLL`;
      el.againBtn.textContent = 'ONE MORE';
    }
    el.overRank.textContent = d.rank;
    el.statWaves.innerHTML = `${d.waves} <span class="kanji-inline">${toKanji(d.waves)}</span>`;
    el.statKills.textContent = d.kills.toLocaleString('en-US');
    el.statInkRank.textContent = pad2(d.inkRank || 1);
    el.statTime.textContent = fmtTime(d.time);
    el.statScore.textContent = d.score.toLocaleString('en-US');
    el.newBestBadge.classList.toggle('hidden', !d.newBest);
    if (el.continueBtn) {
      el.continueBtn.classList.toggle('hidden', !(vict && campaign && d.finalCampaign));
      if (vict && campaign && d.finalCampaign) {
        el.continueBtn.innerHTML = 'START THE ENDLESS SCROLL — <span class="kanji-inline">無</span>';
      }
    }
  }

  function muteVisual(m) { el.muteBtn.classList.toggle('muted', m); }

  /* the brush's current loadout, worn on the wrist */
  function setLoadout(levels) {
    if (!el.hudLoadout) return;
    el.hudLoadout.innerHTML = [...UPGRADES, ...RED_SEALS]
      .filter(u => (levels[u.id] || 0) > 0)
      .map(u => `<span class="load-item${u.seal?' is-seal':''}" title="${u.name}"><svg viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[u.redSealOf || u.id] || GLYPHS.patch}</svg><b>${u.seal?'朱':levels[u.id]}</b></span>`)
      .join('');
  }

  return {
    show, renderCampaign, renderStarters, hud, setWave, setProgress, setHp, setScore, setTime, banner, areaBanner, flash,
    setRunNo, setBest, setInkProgress, buildLegend, buildTicker, fillUpgrades, markSelected,
    setDeploy, setUpgradeHeader, showOver, muteVisual, setLoadout, setArea, setMode, el, toKanji,
  };
})();
