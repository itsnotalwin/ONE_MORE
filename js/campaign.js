'use strict';
/* ONE MORE — persistent ten-by-ten campaign progression.
   Independent of combat, rendering and the existing Endless Scroll. */
const CAMPAIGN = (() => {
  const KEY = 'om_campaign_v1';
  const LEVELS_PER_WORLD = 10;
  const WAVES_PER_LEVEL = 10;

  function read() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
    const completed = AREAS.map((_, i) => {
      const value = Number(raw && Array.isArray(raw.completed) && raw.completed[i]);
      return Number.isFinite(value) ? Math.max(0, Math.min(LEVELS_PER_WORLD, Math.floor(value))) : 0;
    });
    return { version: 1, completed };
  }

  function isWorldUnlocked(worldIndex, state = read()) {
    return Number.isInteger(worldIndex) && worldIndex >= 0 && worldIndex < AREAS.length &&
      (worldIndex === 0 || state.completed[worldIndex - 1] === LEVELS_PER_WORLD);
  }

  function canPlay(worldIndex, level, state = read()) {
    return isWorldUnlocked(worldIndex, state) &&
      Number.isInteger(level) && level >= 1 && level <= LEVELS_PER_WORLD &&
      level <= state.completed[worldIndex] + 1;
  }

  function complete(worldIndex, level) {
    const state = read();
    if (!canPlay(worldIndex, level, state)) return state;
    if (level === state.completed[worldIndex] + 1) {
      state.completed[worldIndex] = level;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* Private mode: session still playable */ }
    }
    return state;
  }

  function next(worldIndex, level) {
    if (level < LEVELS_PER_WORLD) return { worldIndex, level: level + 1 };
    if (worldIndex + 1 < AREAS.length) return { worldIndex: worldIndex + 1, level: 1 };
    return null;
  }

  function totalCompleted(state = read()) {
    return state.completed.reduce((sum, n) => sum + n, 0);
  }

  return { LEVELS_PER_WORLD, WAVES_PER_LEVEL, read, isWorldUnlocked, canPlay, complete, next, totalCompleted };
})();
