# ONE MORE — visual contract and campaign rules

## Canonical style reference

**Frozen original:** [59cdfb35d13963c7009cc52356b335c52f32b3bb](https://github.com/itsnotalwin/ONE_MORE/tree/59cdfb35d13963c7009cc52356b335c52f32b3bb) (before campaign work).

The original game is a living sumi-e painting on endless washi paper. This is the definitive reference for all future work, not an invitation to redesign.

- **Do not replace the renderer, creatures, sprites, ink splatter, camera, brush motion, audio identity, or existing animations.** Only the removed Crimson Hanko's own paint/sound code was replaced with Ink Knots; all unrelated renderer and audio sections remain byte-identical to the original campaign baseline (checked by regression tests).
- **Palette:** washi `#ede7d9`, ink `#1a1714`, vermilion seal `#b23a2b`, night paper `#17130f`, night ink `#e9e2d2`, cinnabar paper `#eadbc4`.
- **Typography:** Zen Antique for large editorial/Japanese display, IBM Plex Mono for compact HUD and control labels.
- **Ink language:** procedural brush strokes, imperfect edges, paper fibers, line boil, stain persistence within a run, large kanji, restrained vermilion.
- **Animation:** preserve original enso drawing, seal pop, paper wobble, enemy telegraphs, damage flash, banners, canvas particles, and reduced-motion support.
- **Composition:** unbounded paper, camera following the brush. Never add an arena wall or substitute generic backgrounds.
- **New screens:** extend `css/style.css` using only existing color/type variables and locally scoped classes. Never restyle existing selectors as a side effect.
- **Accessibility:** retain keyboard/touch input, responsive layouts, pause-on-blur behavior, and reduced-motion preferences.
- **No scrolling within screens:** fit every menu, selection, help, results and story panel to the visible viewport; page long content with clearly labeled controls instead of hiding it behind inner scroll areas. Keep primary buttons on-screen in portrait and short landscape.

### Frozen source links

- [Original title/UI screens](https://github.com/itsnotalwin/ONE_MORE/blob/59cdfb35d13963c7009cc52356b335c52f32b3bb/index.html)
- [Original CSS and animations](https://github.com/itsnotalwin/ONE_MORE/blob/59cdfb35d13963c7009cc52356b335c52f32b3bb/css/style.css)
- [Original procedural renderer](https://github.com/itsnotalwin/ONE_MORE/blob/59cdfb35d13963c7009cc52356b335c52f32b3bb/js/render.js)
- [Original sound identity](https://github.com/itsnotalwin/ONE_MORE/blob/59cdfb35d13963c7009cc52356b335c52f32b3bb/js/audio.js)
- [Original UI layer](https://github.com/itsnotalwin/ONE_MORE/blob/59cdfb35d13963c7009cc52356b335c52f32b3bb/js/ui.js)

**Screenshot status:** no verified screenshot was captured from a live browser during the original source audit. The frozen commit is the reliable before-state; capture desktop and mobile reference screenshots against it when browser access is available. Never label generated mockups as actual gameplay captures.

## Progression contract

`World → 10 Levels → 10 Waves → Result → next unlocked Level`.

- One level is one independent run. Starting any level resets player health, temporary upgrades, kills, score, timers, existing world-space ink stains and the wave counter.
- Wave 10 features the existing Guardian enemy at elite size; at Level 10, the Guardian is the stronger world boss.
- Waves 1–9 retain the original between-wave upgrade-card decisions. Wave 10 ends the run, not a new upgrade screen.
- A clear persists the furthest level reached per world as `om_campaign_v1` in `localStorage`. Replay previously cleared levels; progression never moves backward. Keep legacy best-score/run-count storage untouched.
- Level 10 unlocks the next world. Failure retries the current stage without deleting unlocks.
- Level difficulty increases HP (+10%/stage), movement speed (+1.2%/stage), and enemy budget (+12%/stage), *in addition* to the original world multipliers. Enemies still unlock in the correct world via effective wave numbering.
- Existing world-specific encounters use existing enemies and renderer: FIRST WASH has SPLIT BLOOM on waves 6/9; NIGHT SCROLL has PHANTOM AMBUSH on waves 3/6/9; CINNABAR FIELD has CRIMSON RUSH on waves 5/9. Each world retains its original paper, roster and guardian.
- **Endless mode is separate**: it retains the old cycling sheets and compounding scaling, and starts with a fresh run.
- There is no permanent player stat shop added to this change.

## Ink Knots balance rule

Crimson Hanko was removed from the upgrade pool and is **not** a legacy selectable weapon. Its replacement **Ink Knots** uses the same sumi-e brush language, drawing procedural tapered threads rather than large screen-wiping seals. It binds **2 / 3 / 4 nearby enemies** at ranks 1 / 2 / 3, slows them for **1.8 / 2.0 / 2.2 seconds**, and delivers **one delayed damage point per target per cast** at about **0.72 seconds**, not instant damage. The cooldown is **7.2 / 6.85 / 6.5 seconds**. It is a tactical control/support weapon, not a horde eraser.

The enemy count, delayed damage and no-repeat-hit behavior are enforced in `tests/progression.test.cjs`. Avoid increasing both affected targets and damage without deliberate balance review. Existing renderer/audio segments outside the replaced Hanko methods and draw call are still protected by baseline hashes.

## Architecture and extension points

`js/campaign.js` owns unlock validation and persistence, `js/config.js` owns area/enemy tuning, `js/game.js` owns run selection and wave flow, `js/ui.js` owns stage labels/selection/results, `js/main.js` wires controls, and `css/style.css` adds only scoped selection-screen rules. Keep these responsibilities separate. Before adding another world, supply a unique paper environment and combat mechanic using the *existing* ink renderer.

## Validation

Run `node --test tests/progression.test.cjs` for headless campaign checks, then visually check on mobile and desktop: title, stage selection, 10-wave combat, stage victory, locked stages, world themes, Guardian, upgrade cards, joystick, pause, Endless, stains, and animated brush effects. Browser visual regression remains a manual check until actual screenshot fixtures exist.
