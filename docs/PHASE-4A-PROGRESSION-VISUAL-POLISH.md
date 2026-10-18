# ONE MORE — Phase 4A / Living Ink Visual Refinement

**Status:** implementation specification, ready for a focused code pass. **Not implemented yet.**
**Working branch:** \`development\` only. Never create another branch or merge into \`main\` as part of this pass.
**Art direction:** the existing original sumi-e ink on washi with restrained cinnabar accent. Preserve existing procedural enemies, painterly paper, combat mechanics, and cinematic.

## Objective and visual principle

Make the character feel **anchored, deliberate and alive**, and the collected ink feel like part of the painted world, not imported RPG currency. Progression should change the character's *calligraphic quality* more than its physical dimensions. A moving character must not flicker or randomly redraw with each pixel of travel.

The core XP system, its later-level reward progression, 10-wave runs, full enemy catalogue and Guardian encounters stay intact. Phase 4A corrects presentation and render motion. Do **not** simultaneously redesign the title screen, new-player tutorial, combat balance, upgrade frequencies or XP economy.

## 1. Verified current-state diagnosis

Source inspected directly on \`development\`:

- \`js/render.js / drawPlayer()\`: \`sd = ((p.x * 31 + p.y * 17) | 0) ^ (tick * 7919)\`. **The current procedural player outline depends on its live world position** as well as the line-boil tick. Moving the character changes its drawing seed, often on consecutive rendered frames. This is the first thing to fix.
- \`js/render.js / drawPlayer()\`: the trailing ink stroke adds \`Math.sin(t * 9) * 2.2\` sway; damage invulnerability deliberately blinks via \`Math.floor(t * 18)\`; recoil translates the drawing by \`p.recoil * 2.4\`. These are independent sources of high-frequency visual movement. Retain combat feedback but separate it from the silhouette's identity.
- \`js/render.js / draw()\`: the entire existing player (body, eye, defensive orbit, trail, recoil and ward) is enclosed in an immediate \`ctx.scale(INK_XP.visualScale(S.stats))\` transform. That instantly changes size when a rank rises and amplifies existing motion.
- \`js/ink-xp.js / visualScale()\`: growth is driven by \`0.035\` per rank and \`0.018\` per bonus max HP, capped at **1.55×**. Too dramatic for this brush and potentially visually noisy with recoil and attached weapon effects.
- \`js/ink-xp.js / draw()\`: loot cores use regular \`c.arc()\` circles, concentric rings and a little red dot, with \`Math.sin(t * 4 + d.pulse)\` pulsing. This is why they look like generic pickup orbs rather than living ink.
- \`js/ink-xp.js / update()\`: homing uses exponential attraction and \`d.homing\` latches permanently, which is good for gameplay and can largely stay. The visual is currently a short line behind the orb; the redesign should instead feel like a tapered reabsorbed brushstroke.

These are code-level findings. The precise subjective contribution of each to *juggling* needs visual review on the user's iPhone after implementation. Do not claim device verification merely from unit tests.

## 2. Brush motion stability (priority zero)

**Required behaviors:**

1. Give the player a **stable visual seed** independent of \`p.x\` and \`p.y\`; initialize it once per run. Use that seed to produce a consistent base silhouette.
2. Preserve the project's line-boil tradition, but use low-amplitude, deliberate fluctuations around that base at **3–5 distinct hand-drawn states per second**, not entirely unrelated geometry every 0.115 seconds. Implement interpolated silhouette/noise or a deterministic blended jitter field if feasible with Canvas2D and no heavy per-frame allocations. Boil amplitude target: **2–4% of the brush radius** rather than a full contour redraw.
3. Keep the **world-space anchor stable**. The center of the character must stay at \`S.player.x/y\`; movement uses existing actual physics unchanged. Camera follow remains unchanged unless clear camera instability is independently reproduced.
4. Replace moving-tail \`9 rad/s\` oscillation with low-amplitude brush drag: **~1–1.6 px** drift, **~1–2.5 Hz** movement-driven damping. Inactive/idle tail should settle, not dance.
5. Decouple appearance from weapon firing: use an optional **0–1.5 px** recoil in rendering, smoothly damping within ~100–180 ms; leave firing cadence, projectile spawn and hitboxes alone.
6. Damage protection must remain readable, but consider swapping full-body 18 Hz blink for a calmer ink-outline/low-contrast ring or a slow opacity breath while keeping the invulnerability duration **exactly** as before.
7. Set an explicit motion-cap on attached decoration. Wards/orbits must not inherit a sudden global progression-scale snap or become visually giant.

**Acceptance:** Move continuously for 30 seconds at different speeds. The player outline remains recognizable without random topology changes, unnecessary lateral hops, jittering tail or scale pops, even during high-rank fire. No changes to velocity, hit radius, enemy interaction or weapon intervals.

## 3. Brush redesign: an awakened calligraphic stroke

**Shape direction:** keep the iconic tiny living brush-spirit, but give it a recognizable, sculpted form instead of a changing noisy blob. A tear-shaped wet ink **nib/head**, a gently tapered **dry-brush tail** that follows motion, and the existing **single light-paper eye slit**. A subtle cinnabar fleck is permitted at later ranks only. It must still read as ONE MORE from a mobile screen.

**Tier vocabulary** (cosmetic visual states, not power mechanics):

| Brush rank | Visual language | Target apparent size |
|---|---|---|
| 1–3 | Thin solitary ink stroke, slim pointed tail, one eye | 1.00× |
| 4–8 | Slightly denser brush nib, delicate dry-brush fibers | 1.03–1.06× |
| 9–14 | Longer, controlled tail; ink edge develops an elegant taper | 1.08–1.12× |
| 15+ | The awakened stroke: ink-rich silhouette, restrained cinnabar detail | 1.13–1.18× maximum |

Treat extra **maximum HP** as nib fullness/pigment density (slightly darker, thicker stroke or more bristle definition), not an independent unbounded scale multiplier. The character should never cover nearby enemies or pickups, and should not look like a balloon at late levels.

**Animation rules:** keep idle movement nearly imperceptible (0.5–1.2 px), eye/head aim smooth (no instantly flipping visual direction across the screen), lean at most 2–3° into sustained direction changes, and avoid flashy idle glow or radial fantasy auras. On rank-up, display an authored ~0.4–0.7 s ink-settling flourish, then return to stillness. If rank changes in a menu, keep the animation consistent when returning to gameplay.

**Implementation:** remove the immediate uniform \`ctx.scale(INk_XP.visualScale(...))\` pattern from \`draw()\` (actual symbol casing to use is \`INK_XP\`). Keep a **separate** \`displayScale\` easing toward a cosmetic \`targetScale\`, or preferably adjust only the brush body/tail geometry. Use frame-time-independent exponential damping:
\`display += (target - display) * (1 - exp(-dt / tau))\` with \`tau\` around **0.25–0.40 s**, and no overshoot. Do **not** scale the defensive orbit radius, collision markers or pickups when changing only the brush's apparent size.

## 4. Replace XP orbs with living ink seeds

**Name in code and UX:** \`inkSeed\` / \`livingInk\`. Keep the existing \`inkDrops\` data array or migrate safely without changing serialized campaign state. These are **ink hearts escaping a dried stain**, not coins, bubbles or gems.

**Visual shape:**

- Each kernel is a tiny, asymmetrical tear of ink (3–6 px), with 1–3 expressive bristle tips or a pointed nib edge, chosen from **3–5 seeded procedural silhouettes**.
- Silhouette stays coherent over time, with only ~0.5–1 px of drift, NOT a new noisy blob every frame.
- Ink color adapts to each scroll: very dark on pale washi, light on Night Scroll, and dark/ink-red accents on Cinnabar. Cinnabar should remain a **rare accent**, not a red glowy dot at the center of every pickup.
- XP value changes density/length/pigment richness subtly; a higher-value drop is not simply a much larger orb.
- Spawn from the enemy's **original permanent splat** so the relationship is legible. The ordinary stain must remain after pickup.
- Avoid rings, perfect circles, starbursts, rainbow glows, shiny outlines, excessive opacity strobe, or external image packs.

**Collection choreography (three beats):**

1. **Bloom** (~0.12–0.22 s): a tiny ink heart separates from the new stain and gently settles. It may move a few pixels away, never explode like loot confetti.
2. **Wake** (within existing attraction radius): the seed leans toward the player, straightens into a tapered, wet-calligraphy dash and begins its established smooth homing path. Slight staggering between seeds is fine, but not enough to delay rewards.
3. **Absorb** (~0.15–0.30 s visible movement): rather than rendering a marble plus a line behind it, stretch the seed into a short tapering ink strand. Contract that strand into the brush at capture and show one small paper-fiber/ink fleck response. XP is awarded **exactly once**, on the existing collision/capture rule.

**Wave-end ink recall:** keep the existing no-loss banking guarantee. Animate visible seeds streaming inward with light staggering/curved paths and finish within the existing ~1.1 s wave clear beat. If a distant seed cannot reach the brush in time, award its value silently without forcing an extra pause. NO sweeping screen-wide beams.

**Performance:** preserve the 350-drop logical cap and merged-value guarantee. Target **at most ~80 detailed visible animated seeds** at once; farther/denser seeds may use simplified strokes, batched groups or cached paint variants. Avoid \`Math.random()\`, large canvas allocations, or heavy gradients for each seed every frame.

## 5. UX, balance and hitbox preservation

- **Do not change XP rewards or the tuned rank threshold curve** in this visual pass.
- **Do not change player movement speed, collision radius (\`CFG.player.r = 10\`), HP, existing fire rate, contact damage, invulnerability duration, boss telegraphs, pickup attraction logic or campaign completion.**
- Retain XP overflow and the rule that pending choices resume the **same wave**.
- Preserve usable XP meter readability. Its vermilion progress bar stays on-screen; reserve more elaborate motion for the collected ink itself. Do not crowd the top UI or obscure 3-card upgrades.
- Do not repeatedly add effects when a large pack dies. Prefer a few legible seeds and automatic visual-value aggregation.
- Reduced-motion mode should use stable silhouettes, no boil blending/sway, no visual wobble, and simplified direct ink movement while preserving pickup behavior.

## 6. Exact engineering map and work order

**Commit 1: isolate and eliminate player jitter**
- \`js/render.js\`: eliminate position-dependent \`sd\`; separate stable silhouette from time-varying micro-boil; damp tail/recoil; keep player anchoring and aim readable.
- \`js/game.js\`: if state is needed, initialize stable \`player.visualSeed\` and \`player.displayScale\` on new run and update cosmetic state with simulation dt.
- \`tests/player-visual.test.cjs\`: test deterministic/stable seeds, bounded growth, and unaltered hitbox. Ensure no switch to generic sprites.

**Commit 2: evolve the brush**
- \`js/render.js\`: define the procedural tapered-head / dry-brush-tail silhouette and rank tiers. Adjust only player geometry, not orbit or other weapon radius. Optional micro-ink settling upon level up.
- \`js/ink-xp.js\`: reduce \`visualScale()\` to the subtle cosmetic ceiling (~1.18) or introduce a tier-based \`visualForm()\`; \`js/game.js\` supplies cosmetic state.
- Use the current washi textures, drawing helpers and single paper-eye slit; **do not rewrite the rest of the procedural art renderer**.

**Commit 3: living ink seed pickups**
- \`js/ink-xp.js\`: retain correct \`drop()\`, \`grant()\` and homing math. Replace only the appearance code / optionally tiny \`seedShape\` data and curve-drawing logic.
- \`tests/ink-xp.test.cjs\`: preserve cumulative XP, attraction, wave-end recall, multi-level rewards and no-loss drop pooling. Add tests for new visual state and tier styles.

**Commit 4: real screenshot review and refinement**
- \`tests/film-browser.cjs\` and \`.github/workflows/film-visual-qa.yml\`: capture early brush idle, sustained movement, rank 10+, clusters of loot, XP suction, Night Scroll and Cinnabar. Verify browser console stays clean and links/screens still work.
- **Do not mark iPhone physical-device acceptance as complete** from headless Chromium. Confirm the 393×852 portrait and compact landscape layout; then play-test actual iPhone Safari.
- Tune the size and motion numbers before adding extra visual details. Confirm first that it looks still, intentional and elegant.

**Commit 5: documentation and release gate**
- Update \`README.md\` and \`docs/GAME_BIBLE.md\` with the final shipped appearance and browser QA artifacts, distinguishing completed tests from pending physical-device checks.
- Commit directly to \`development\`; do not merge \`main\` without explicit request.

## 7. Acceptance checklist (Definition of Done)

- [ ] The brush remains a coherent, legible silhouette while moving continuously; **no outline noise driven by world position**.
- [ ] Distinct player visual states look intentional across early, middle and high rank; never exceed ~1.18× apparent size.
- [ ] Rank-up appearance transitions are eased, with no jumps; weapon orbits remain independent of growth.
- [ ] Recoil, trail and invulnerability effects are calm and readable, not a rapid shake.
- [ ] XP hearts look like irregular brush/ink seeds. No circular glossy orbs remain.
- [ ] Collection visibly becomes a tapered stream of ink returning to the brush.
- [ ] Original dried stains persist, XP cannot be lost, and a single seed cannot award XP twice.
- [ ] No changes to hit radius, physics, damage, Guardian telegraphs, level unlocks or XP curves.
- [ ] Automated combat, progression, Guardian, XP and cinematic tests pass.
- [ ] Desktop and phone-sized real Chromium captures reviewed, especially Night Scroll contrast.
- [ ] Physical iPhone Safari test performed or explicitly recorded as pending.
- [ ] Only \`development\` changed; \`main\` untouched.

### Taste checkpoint

The desired result is **“the ink remembers its shape”**, not a dramatic size-transformation montage. During normal combat a player should barely notice the animation machinery; during a pickup they should see pigment reclaimed from the paper. The game must remain quiet enough that special attacks and combat warnings are still the loudest motion on screen.
