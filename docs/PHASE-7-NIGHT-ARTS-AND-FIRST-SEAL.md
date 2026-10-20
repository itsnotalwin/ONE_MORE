# ONE MORE / PHASE 7
## Quiet Ink Motion, Suiteki Trail, Night Arts & The First Seal

**Status:** Implemented on `development`. Do not merge into `main` without explicit instruction.
**Design intention:** Restore the art's dignity: handmade ink on empty washi, readable creature silhouettes, motion with weight rather than frantic foot-cycling, and world-specific powers grounded in traditional paper-and-brush language. This revision supersedes the Phase 6 motion and pool implementation, while preserving its blank Paper I, Heavenly Brushstroke collision geometry and other visual contracts.

### 1. The ink-soul: restrained life, not a cartoon run cycle

- Keep a single connected asymmetrical silhouette and one pale curved eye. It is an ink-born familiar, never a brush with a handle.
- Remove strong left-right lower-fold kicking, whole-body bob and aggressive squash/stretch. New run phase is ~1.85–2.05 Hz, used only for extremely subtle hem drift. Body lean follows smoothed movement. Head and face stay readable.
- Preserve visual states `idle`, `anticipate`, `run`, `turn`, `brake`, and existing `hitPulse`, `absorbPulse`, `rankPulse`. No additional effects on gameplay physics, targeting, stamina or the exact 10px hit radius.
- Respect reduced-motion preferences. Mobile touch and desktop keyboard use the same physics and animation paths.

### 2. Suiteki Leak: snail-like continuous wet ink, not separate blotches

- Same `trail`, `trailW`, `seal_trail` rank and save identifiers.
- While moving, a tiny ink vessel leaks a joined, world-space wet ribbon along the path. Its line is composed of short round-capped, adjacent ink segments spaced **12 / 10 / 8 px** at ranks 1/2/3.
- Live width radius **5.5 / 7 / 8.5 px**, segment lifetime **2.6 / 3 / 3.4 seconds**, bounded at **72 / 90 / 112 segments**. The most recent section forms continuously; no separate pool spawns or permanent terrain marks at lower ranks.
- Touching wet ink causes modest drag and at most **1 HP every 0.55 seconds** per enemy, across all overlapping segments combined. World-space segment-to-circle hit geometry, not lots of circular AoE blobs.
- At rank 3, every other expired segment may dry into a thin black permanent stroke. Only the separately chosen Vermilion Seal turns the dried marks deep lacquer-crimson, without combat stat modifications. The Eraser may still clean dried marks. Active segments evaporate normally.
- Deterministic per-segment line construction and bounded cap protect iPhone frame pacing.

### 3. Paper II: unlock four handcrafted powers, not imported sprites

Only become eligible in normal XP **three-card** upgrade choices once the active world is **Night Scroll or later**; they are not available in First Wash. Endless gains access on the relevant sheet. Before max rank, no special lasting terrain. At ordinary max rank, that power begins stamping the current ink color; only the separately selectable one-time `seal_<id>` card turns that technique's imprints lacquer-crimson `#ac1538`.

| Power | Ranks | Combat behavior | Art signature |
|---|---:|---|---|
| **Ink Lantern** | 2 | A small drifting paper lantern pulses every **9 → 7 s**, revealing shade/wraith/kage/moth/stilt near the player for 2.5 s. Can interrupt one imminent phantom windup per pulse for 0.38 s. No generic AoE damage. | Off-white hand-drawn lantern and gentle broken concentric ink seals only at rank 2 |
| **Crescent Return** | 3 | One curved blade launches at a nearby target at 390 px/s, reaches **170 → 220 px**, then homes back at 1.14× speed. May hit one enemy once on each outward/return journey. Damage 1/1/2 and period **4.7 → 3.5 s**. | Paper-cut crescent with delicate calligraphic slash imprints only at rank 3 |
| **Mirror Fold** | 3 | An ordinary SPIT glob or STILT needle within **110 → 146 px** may be caught every **8 → 5 s**, generating one friendly angular slash. **Cannot reflect any Guardian mark**. Damage 1/1/2, no free shield against melee. | Angular folded-paper wedge; three-corner crease stamped only at rank 3 |
| **Shroud Step** | 2 | After >1.1 s of sustained movement near danger, slip forward by **34 → 48 px** once every **12 → 9.5 s**; leave a half-second to 0.82 s ink-soul decoy that nearby ordinary creatures briefly follow. No invulnerability grant, no free attack. | One fading black ink-familiar echo and understated paired brush flecks at rank 2 |

Use `CFG` for timings, `UPGRADES` for selection, `RED_SEALS` for after-max pigment, `G` for gameplay state, and `R` for Canvas2D. Status of other worlds, enemy silhouettes, blood colors, and global UI remains preserved.

### 4. First Wash Level 10: make the divine brush a real climax

- **Only the Paper I world finale** (`worldIndex=0`, Journey level 10) gains additional health: boss HP scalar **2.75** in place of **1.8**. Normal wave-10 Guardians throughout levels 1–9 and both other worlds retain existing scaling.
- Three distinct ink calligraphy phases now begin at remaining HP **100–74%**, **74–40%**, **40–0%**, so the fight actually displays its Crossing and Hook arts before dying. The sampled Bézier path is shared by warning, rendering and collision.
- Final boss's first attack occurs after **1.9 s** rather than 2.6, subsequent casts around **2.9/2.44/1.98 s** according to phase. Existing **1.25 s harmless warning**, staggered crossings, one-hit/invulnerability rules and impact recovery remain unchanged.
- As each phase changes, two existing small BLIP monsters may spawn by the boss if the normal enemy cap allows it, **never directly under the player**. No new enemy sprites, unexplained attacks, third-party assets, or unfair room-wide unavoidable damage.
- Any boss/ordinary guardian defeated or abandoned cancels pending damage patterns; no delayed invisible hazards survive.

### 5. QA and preservation

- `tests/phase6.test.cjs`: real connected segment behavior, expiry and mastery ink, nonstacking damage, ink-soul animation and original Paper I art.
- `tests/night-arsenal.test.cjs`: Paper I lock/Paper II unlock, pick/deploy, each new ability, black/red mastery, mirror projectile safety, Shroud displacement, boss HP/phase/cast and original procedural art.
- `tests/guardians.test.cjs`, `tests/terrain-stages.test.cjs`, `tests/progression.test.cjs`: baseline campaign, wet/dry terrain, projectiles and enemy art checks.
- `tests/film-browser.cjs`: both desktop 1440×900 and phone 393×852 Canvas/browser smoke and visual screenshots. Headless phone viewport does not substitute for a physical iPhone Safari feel test.

**Out of scope:** new Paper III abilities, new enemy designs, recalibrating the original 10×10 wave campaign, unrelated XP redesign, changing the starting weapon, merging `main` or replacing procedural art with downloaded assets.
