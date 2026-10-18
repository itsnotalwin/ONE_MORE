# ONE MORE / PHASE 6
## Living Ink, Untouched Paper, Divine Brushstroke & Suiteki Leak

**Status:** Design locked for the next implementation pass; **NOT IMPLEMENTED**.  
**Working branch:** `development`. Do not merge to `main` without explicit instruction.  
**Version:** 1.0, 18 October 2026.  
**Purpose:** Replace the static-feeling hero motion, restore visual silence to Paper I, make its Guardian attack feel like a deliberate divine brushstroke instead of a road, and replace the existing Ink Trail/blotch weapon with a distinctive inkstone spill. Leave other combat systems and enemy silhouettes intact.

### Invariants that must not change

- ONE MORE remains a lightweight procedural Canvas2D PWA/GitHub Pages game, with handmade **sumi-e ink on washi**. No heavy downloaded characters, new textures, 3D assets or GPU-heavy simulations.
- Original 14 enemy families keep their bodies, eye language, line-boil animations, AI, damage patterns and five per-family blood variants. All enemy blood is black/pale current-scroll ink.
- Paper II retains its readable indigo-dark washi and pale enemy ink; Paper III remains the cinnabar sheet. Do not flatten or recolor either while simplifying Paper I.
- The hero's **physics** and hitbox stay unchanged (`player.r=10`), with progression-only visual scaling as before. No new player combat buff from animation.
- The base auto-fire weapon never makes lasting map marks.
- Specials leave **no lasting terrain marks until their ordinary skill reaches max rank**, when the lasting marks are black/pale world ink. A **separately chosen, once-per-skill Vermilion Seal** subsequently makes just that ability's marks lacquer-crimson `#ac1538`. Do not automatically grant red at mastery.
- Stage-long stains persist through all ten waves until the stage ends, except terrain explicitly removed by the Eraser. Temporary visual animation is not the same as lasting stamped terrain.
- Paper I's existing boss attack should become visually more meaningful; postpone boss HP/difficulty rebalancing and any broader phase escalation until its separately requested review.
- Ink Lantern remains the preferred **proposed** Paper II reveal power, but is **not part of this implementation**. Reconsider other Paper II weapon proposals separately.

## 1. Hero design: THE LITTLE LAST STROKE

**Identity.** A tiny, stubborn familiar made of spilled ink that refuses to be erased. It is **a creature, not a brush** and not an enemy-clone circle. One characterful curved paper eye, a slightly bent forehead, soft asymmetrical body, two connected tapering lower folds. A gesture in ink, not a costume. Personality: curious at rest, determined while moving, slightly startled on damage, briefly delighted by a level-up. The silhouette must be recognizable with the eye hidden and while scaled to a ~20-pixel diameter hitbox.

**Art contract.** Single connected black body in Paper I, world-themed ivory on Paper II. Animate the *contour* and center-of-mass, not decorative accessories. Never add feet, hovering props, a separate handle, red body highlights or a fake brush in the creature's hands. Use continuous Bézier contours with gently seeded ink-boil. Keep the eye cut from paper and anchored to the moving head; slight squash and eye orientation communicate direction.

**Animation state machine and target feel:**

| State | Trigger | Silhouette motion | Timing |
|---|---|---|---|
| IDLE | near-zero movement for >0.16 s | slow breathing (1–2%); lower folds alternate slightly; eye slowly attends to aim | 2.6–3.4 s breathing cycle |
| ANTICIPATE | motion starts from IDLE | brief counter-lean/compression; eye looks toward new travel vector | 65–95 ms |
| RUN / FLOW | sustained movement | two-beat traveling wave moving from shoulders through the two connected lower folds; stretch up to 7% along travel and squash perpendicular; eye/head remain stable | ~5.5–7.5 Hz, driven by normalized actual speed |
| TURN | change of direction >55° while moving | head/eye lead, body and folds follow smoothly, no full sprite spin | 100–160 ms overlap |
| BRAKE | moving to idle | a small forward overshoot, recovery compression, then settle into IDLE | 120–180 ms |
| HIT | real accepted damage | ink recoil/brief body ripple; use existing invulnerability timing, not new immunity | ~170 ms |
| ABSORB | meaningful cluster of XP reaches player | tiny forward nod/suction, then release | ~110 ms, throttle to avoid constant jiggle |
| RANK-UP | rank actually increases | body briefly gathers then swells ~5%; folds lift; settles without changing collision | ~400–500 ms |

**Principle:** Movement must be instantly readable, but the character must not vibrate or cartwheel. RUN is an organic stroke cycle, not a constant whole-body bob. Any reduction of contrast, flashing or line-boil under reduced-motion settings must keep the silhouette intelligible.

**Implementation boundary:** extend player *visual-only* state in `js/game.js` (normalized velocity, acceleration/start-stop triggers, facing, state timer, response impulses), then make `inkSoulPath` and `drawPlayer` in `js/render.js` consume it. Use delta-time and smoothed deterministic phases, never `Math.random()` in the active hero contour. Retain current `p.visualMoveX/Y`, `p.visualAim`, `p.visualTilt`, and `p.displayScale` so progression and controls remain compatible. Separate combat facing/aim from travel direction. Preserve keyboard and touch behaviors.

## 2. Paper I: THE UNTOUCHED SHEET

**Design statement:** the first wash is almost-empty, uninterrupted Japanese-inspired ivory paper. The drama is created by the character, its opponents, their black blood, mastered weapon signatures and later the divine brushstroke. The paper itself must not compete.

**Palette:** retain `THEMES.pale.paper = '#ede7d9'` (warm ivory) and `THEMES.pale.ink = '#1a1714'`. Do not introduce rule lines, beige striping, graph-paper patterns, visible repeated grids, dark aged edges, decorative kanji, prefabricated scenery or strong sweeping vignettes.

**Rendering contract:**

- `buildTile('pale')`: no horizontal **laid-line loop**. A near-flat ivory fill with exceptionally light, sparsely distributed fibers/speckles, visually undetectable as separate lines during gameplay. Target at most ~15–25 short fibers per 480×480 tile, alpha 0.012–0.028, length 1–3 px; at most ~10 tiny specks, alpha ≤0.025. Do not use large gray watercolor/radial blotches for this theme.
- `drawDecor`: skip ambient brush hairs, ghost droplets, ink pools, kanji and seals **on Paper I**. Combat-produced stains still render normally, stay until stage end, and may be erased by the Eraser.
- Avoid repeating tile boundaries at phone and desktop DPIs; noise deterministic and cached once. No per-frame random paper grain.
- The same palette must remain readable on phone OLED, desktop monitor and landscape. Preserve Night and Cinnabar theme-specific tiles/decor exactly.

**Acceptance:** at the start of Paper I level 1 with no enemies/stains, the background reads as one calm, almost-flat warm sheet. A screenshot at 393×852 and 1365×768 shows **no visible horizontal lines or tile seams**. Live black blood and black/red skill stamps become the primary environmental marks.

## 3. Paper I Guardian: THE HAND ABOVE / HEAVENLY BRUSHSTROKE

**Fantasy.** An immense unseen Painter reaches from beyond the paper. The warning is pressure and a faint gesture traced across the page; the impact is a single glorious asymmetric calligraphic stroke, pulled decisively across the page. **Not a rectangular road, lane or laser beam.** No literal oversized 3D brush asset. Never visually copy the attacks of other games.

**Three pattern motifs, sharing the actual hit geometry:**

1. **HEAVENLY DOWNSTROKE:** a tremendous tapered ink stroke cuts down a fixed, clearly announced path. Head heavy, thin dry-brush flick at its tail. Earliest Guardian pattern.
2. **THE CROSSING:** two separate strokes land one after another, with distinct warning progress and dodge directions, instead of two simultaneous wide roads. Phase 2 pattern.
3. **THE HOOK:** straight head and a graceful hooked terminus, telegraphing the curve in advance. World-I final level/third phase signature, to be introduced without increasing damage until balance review.

**Timing and fairness:** keep current harmless warning (1.15 s for ordinary Guardians; 1.25 s for the world boss), the existing 0.26/0.32 s impact-recovery windows and normal one-hit/invulnerability rules as the initial balance. Attacks lock target position at cast time; never secretly follow the player's new location. Stroke sweeps visually across the announced curve during a short ~180–240 ms reveal, but collision must occur only within its correctly scheduled impact interval, not throughout the anticipation. Maintain a reliably open perpendicular escape path, including at a 393px-wide viewport and when other enemies exist. Reduce or stagger simultaneous marks on the smallest screens if an authored pattern otherwise blocks every escape direction.

**Geometry contract:** replace `world === 0` Guardian `kind:'line'` with `kind:'heavenlyStroke'` and authored small arrays of cubic Bézier control points, per-stroke width taper and cast seed. Both warning, active ink rendering and collision checks sample the **same geometry** into short polyline segments; hit testing uses distance-to-segment with local tapered width plus the *existing* player collision radius, not a broad rectangular bounding box. Reuse pure pattern contracts in `js/guardians.js`, game scheduling in `js/game.js`, `drawGuardianHazard` in `js/render.js`. Other paper Guardian attack types (`line` in Paper II, `seal` in Paper III) remain unchanged.

**Look:** black ink on warm ivory, slightly dry edges, sharp tapered tail and a small cloud of droplets at the strike's end; the boss is not recolored. The completed impact is stamped into stage terrain as black blood-like brush pigment (never a lasting damage zone). Distinct from mastery-triggered player stamps, and erased by the Eraser if within range. No permanent visual overlay hiding future enemy telegraphs.

**Difficulty:** this is an art and attack-legibility overhaul, not a stealth buff. Keep the First Guardian's current HP and phase count; its separate difficulty increase will be designed and play-tested afterward.

## 4. Replace Ink Trail with SUITEKI LEAK (the inkstone spill)

**Identity and historical grounding.** A small **suiteki** (traditional calligraphy water-dropper) tips water into an overfilled `suzuri` inkstone; thick black ink escapes and crawls onto the page. It is not literally a historical ink pot carrying ink: the inkstone holds prepared ink, while the suiteki supplies water. Visually we can compress both into one elegant three-stroke icon and a spreading pool. References: Tokyo National Museum, *Suiteki (water dropper)*; Met, *Japanese Writing Boxes*.

**User-facing skill:** `Suiteki Leak`, replacing the current moving `Ink Trail` puddle power. Same **`trail` upgrade ID**, **`trailW` player stat**, 3-rank cap and `seal_trail` Vermilion progression for compatibility. Existing Ink Trail should not coexist as a duplicate choice.

**Gameplay identity:** intermittent **placed area denial**, not a continuous stream of puddles behind every footstep. The familiar's motion nudges/overturns a tiny ink vessel just behind its last travel direction, a little water touches ink, and one slow spill blossoms there. Enemies entering the **wet spill** are slowed slightly and take measured damage on a non-stacking cadence. A placed spill has an active lifespan; **the active spill does not remain damaging for the whole stage.** Only its residual stamped stain persists at mastery.

**Proposed tuning (subject to an instrumented playtest, not a hidden power boost):**

| Rank | Placement cooldown | Active spill max radius | Wet lifetime | Active simultaneous spills | Lasting terrain |
|---|---:|---:|---:|---:|---|
| 1 | 3.6 s | 30 px | 2.8 s | 1 | none |
| 2 | 3.1 s | 38 px | 3.0 s | 2 | none |
| 3 / MAX | 2.7 s | 46 px | 3.2 s | 2 | deep black, after wet pool expires |
| Optional `seal_trail` | no combat-value change | same | same | same | deep lacquer-crimson `#ac1538` |

Damage baseline: at most **1 HP per affected enemy every 0.55 s**, shared across overlapping spill areas, with ~20% movement slow for a short refresh interval. Avoid multiplying damage by pool count. The skill should feel helpful for route control but clearly weaker at single-target bursting than Fan or basic volley. Placement requires the player to have moved recently and at least one meaningful nearby threat (prevents unused spills cluttering empty areas). If stopped, the latest spill finishes normally without auto-placing new ones.

**Visual life cycle:** tiny outlined vessel tipped for ~0.18 s -> first dark bead (~0.12 s) -> asymmetrical thick pool spreads over ~0.55–0.7 s -> ink creeps along two to three short fiber-like tendrils -> wet surface quiets and fades when combat effect expires -> at max rank only, a single dense permanent stain is placed on existing stage terrain. Individual spills should vary by 4 deterministic shapes, not 4 random angles per frame. No 3D object, physically simulated liquid, particles-on-every-frame or neon glow.

**Implementation boundary:** replace existing `dropTrail`, `updatePuddles`, `drawPuddle` and `CFG.trail` tuning, retaining existing `S.puddles`, `trailW`, `trail`, `seal_trail`, level-up card and world/XP state. Update skill name/description, icon glyph, combat descriptions, tests and Game Bible together. Weapon remains usable before mastery; only permanent map imprint waits until max rank. At max + selected red seal, the permanent imprint changes color, **not** pool damage or duration.

## 5. Paper II weapons: defer implementation

Keep **Ink Lantern** as the strongest prospective Paper II power: a warm white floating light that reveals phantoms and interrupts one incoming ambush on a readable cooldown. It belongs to Night Scroll, not Paper I, and it should not add permanent marks until maximum ordinary rank. At mastery it can paint black concentric seals; a separate red choice recolors only those seals. Do not implement until the user approves its exact combat tuning and the rest of the Paper II unlock roster. Revisit Crescent Return, Mirror Fold and Shroud Step instead of committing them now.

## 6. Delivery plan and pass/fail acceptance

**Milestone A / living hero:** visual-only animation controller, deterministic contour interpolation, real RUN cycle and start/stop/turn/hit/XP/rank-up reactions. Check 393px phone touch movement and desktop keyboard, 30/60 fps playback, reduced motion, hitbox invariance and 20–30 second continuous travel. No rapid full-body wobble and no visual lag behind controls.

**Milestone B / Paper I:** theme-scoped flat warm sheet and no automatic Paper-I background decor. Preserve Paper II and III bytes/visuals and all stage blood/weapon stamp logic. Compare clean starting screenshot and fully painted wave 10 screenshot at mobile and desktop sizes.

**Milestone C / heavenly Guardian:** pure cubic hit shape tested for inside/outside/edge/taper; matching warning/render/collision; 1.15/1.25 second readable telegraph; normal versus final Guardian phase count protected; safe lanes on narrow screens; never use ordinary dark-paper attacks for Paper I.

**Milestone D / Suiteki Leak:** 3 upgrade ranks, preserved save IDs, timed wet area and non-stacking 0.55 s damage; placement cap; no permanent terrain before rank 3; black permanent stain at rank 3; only selected `seal_trail` makes permanent stain crimson; Eraser clears dried stain without retroactively cancelling a living spill; wave-to-wave stamp persistence.

**Required final QA:** all unit and regression suites, Playwright desktop + phone visual smoke screenshots and real user review on iPhone Safari for long stages. Do not claim manual phone testing unless performed. Keep `main` untouched.

**Out of scope:** Paper II Ink Lantern implementation, other Paper II unlocks, new enemies, First Guardian HP/damage rebalance, cosmetic redesign of remaining enemies, unrelated HUD/XP changes, and feature branches created without instruction.

**Source references (background only):**  
- The Metropolitan Museum of Art: https://www.metmuseum.org/ja/essays/japanese-writing-boxes  
- Tokyo National Museum: https://www.tnm.jp/modules/r_free_page/index.php?id=224&lang=en  
- The Metropolitan Museum of Art, suzuribako waterfall: https://www.metmuseum.org/art/collection/search/57603
