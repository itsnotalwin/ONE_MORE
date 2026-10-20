# ONE MORE / Six Beginning Instruments

**Status:** Implemented on `development`. Do not merge to `main` without explicit instruction.
**Design premise:** The small living ink-soul is a character, not a weapon. Each campaign run begins with an instrument selected from an **earned permanent collection**. Skills earned from ink XP remain temporary and synergize with the instrument.

## Campaign unlock map

| Starter | Category | Unlocked after | Normal attack | Distinct automatic signature |
|---|---|---|---|---|
| Ink Gun | Ranged | Available immediately | Fast muzzle-aligned droplets | Every fourth volley adds a second quick, slightly offset droplet |
| Great Brush | Melee | First Wash level 02 | Wide directional sweeping arc, knockback | Every third strike paints a wider **temporary** brush arc and reaches farther |
| Needle Quill | Ranged | First Wash level 04 | Slower precision projectile penetrating two enemies | Every fourth shot penetrates up to four before any earned piercing upgrades |
| Inkstone Mallet | Melee | First Wash level 07 | Heavy close-range blunt area impact | Every third hit emits a wider defensive knockback shock |
| Silk Spool | Ranged | Night Scroll level 02 | A short-range homing ink tether damages and slows two clustered targets | Every third cast threads a third nearby target |
| Paper Cutter | Melee | Night Scroll level 05 | Fast narrow cutting arc | Every fourth slice launches a folded paper edge that turns back toward the wielder |

Unlocks are **account-device local** through the existing campaign completion save `om_campaign_v1`. The completed-level record is the single source of truth, not a second economy. Equipped choice persists in `om_starter_v1` and is validated against milestones. There are no premium locks, random drops, duplicate unlocks or level restrictions on *use*. After unlocking an instrument, the player may equip it and replay any stage already available in the campaign, even First Wash 01. Endless Scroll uses the currently selected unlocked weapon too.

## Combat design and interaction

- All six auto-target the nearest eligible threat, maintaining the game's original touch-only / keyboard movement-first controls. Different ranges, delays, damage geometry and special rhythms create play styles without adding mandatory on-screen buttons.
- All earned XP upgrades still apply: Quick Hand scales attack cadence, Bitter Ink increases hit damage, Twin Stroke still benefits Ink Gun directly, Through Mist still adds projectile penetration, movement/defense buffs still apply. **Echo Stroke now follows any selected starter** by issuing its earned counter-volley from the rear.
- Starter attacks and attack flourishes **never stamp lasting paper terrain**, including when their fourth/third cadence special activates. Existing learned skills still follow the max-rank black imprint and optional separately selected red Vermilion Seal progression.
- Swings, shock rings, chain threads and muzzle flares are stored in short-lived `S.primaryFx` animations and expire rapidly. They are not stainQueue entries. Damage takes place in the game model, not the renderer.
- Gun remains the default for all older saves; the original base projectile spawn/velocity/XP contract is preserved and the original hand-drawn gun still appears.
- Weapon choice takes effect only when starting a fresh run. Switching a selection during a fight never silently changes the active instrument. No changes to the original physics circle (10px).
- Mallet's area blow has a stronger single-hit profile, the Brush controls nearby crowds, Needle specializes in lines and piercing, Spool controls compact groups, and Cutter is speedy with an intermittent extended range edge. Special cadence is readable through larger temporary strokes, not extra colorful halos.

## Character redesign

The Last Stroke keeps its small two-fold fluid body but now has a **distinct folded-paper hood tip**, expressive paper-cut eye, tiny mask cuts, and an actual weapon carried alongside the body. Instead of six recolored guns, each selected instrument is drawn from Canvas2D primitives and uses its own recoil/swing/sway: a large bristled calligraphy brush, a slender leaf-like quill, a carved stone mallet, a wound spool, and a folded blade. Ranged ink shots show different visible projectile shapes; melee arcs are animated, tapered hand-drawn gestures.

Weapons do not create extra permanent terrain. The paper gains ink through combat blood and earned mastered skills only. Original Night Scroll ivory inversion, the plain First Wash, the Eraser, all enemy animation families, guardian hitboxes and ten-by-ten progression are untouched.

## Source map

- `js/config.js`: immutable `STARTERS` roster and unlock requirements.
- `js/game.js`: validated persistent selection, per-run starter, auto-attack dispatch, ranged projectiles, melee arc/area hits, thread chaining and rhythm specials, short-lived attack effects.
- `js/ui.js`, `index.html`, `css/style.css`: accessible six-weapon paper card armory on level selection; HUD equipped seal.
- `js/main.js`: delegated selection behavior.
- `js/render.js`: folded-hood hero face, hand-drawn tools, temporary attacks and distinct projectile renders.
- `tests/starter-weapons.test.cjs`: permanent campaign unlocks, earlier-level replay, six combat signatures, specials, synergy and map-mark invariants.
- `tests/film-browser.cjs`: real phone and desktop browser armory screenshots, selection, melee combat and piercing ranged combat.

## Quality bar

A brand-new player sees exactly one unlocked starter and no campaign level unlock skip. Every other weapon displays the precise stage requirement. Each unlocked one remains available on previous stages and future stages after a death or replay. All weapons have distinct carried silhouettes and visible battle effects. No excessive character jitter, new physics input, extra full-screen backgrounds, lost XP, enemy blood recoloring, or changes to `main`.

**Further art review:** physical iPhone Safari touch-testing for selecting a weapon while the six-card armory scrolls, melee readability when enemies surround the player and projectile contrast on indigo. Browser QA can establish functionality; it does not replace a device playtest.
