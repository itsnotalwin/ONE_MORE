# ONE MORE

![ONE MORE: The Last Stroke, original illustrated story title card (not a screenshot)](docs/images/last-stroke-hero.svg)

<p align="center"><strong>THE LAST STROKE</strong> · AN ORIGINAL FULL-MOTION INK SHORT FILM<br/>
The ink remembers every stroke.</p>

> **Released cinematic:** [PR #7](https://github.com/itsnotalwin/ONE_MORE/pull/7) merged the complete seven-shot animated film and Chronicle into `main`. It plays automatically and remains skippable. The previous combined draft PR #5 has been closed.

**Play ONE MORE:** [itsnotalwin.github.io/ONE_MORE](https://itsnotalwin.github.io/ONE_MORE/). The Pages test site currently deploys `development`, which includes the same cinematic plus in-progress combat improvements. `main` is the preserved cinematic release baseline; `development` is for all new gameplay work. [Browse the development branch](https://github.com/itsnotalwin/ONE_MORE/tree/development).



**Development milestone 01 / Combat Foundations:** Swept bullet/needle/Spirit Scribe collision eliminates frame-skipping hits; piercing shots hit each enemy once; joystick and keyboard state resets when changing screens. These fixes are on **development only**, not merged into the cinematic release in `main`. Automated coverage: [`tests/combat.test.cjs`](tests/combat.test.cjs).

**Development milestone 02 / Wave Director 2.0:** Every Journey level now has an authored stage identity, featured enemy pairing and choreographed spawn formation. Across the 30 levels and 300 waves, encounters vary in group spacing, flanking direction, momentum and roster emphasis instead of simply adding health. Existing Guardian and world-special waves remain, and Endless retains its original random generation. This is **on `development` only**. See [`js/wave-director.js`](js/wave-director.js), [all 30 stages in the Game Bible](docs/GAME_BIBLE.md#wave-director-20--authored-encounter-design-phase-2), and [`tests/wave-director.test.cjs`](tests/wave-director.test.cjs).

**Development milestone 03 / Multi-phase Guardians:** First Wash cracks the paper with ink seams, Night Scroll lashes out with targeted shadow rays, and Cinnabar Field brands the ground with delayed red seals. All three encounters have dodgeable warnings, distinct HP-based phase changes, short impact windows and a restrained, in-world Guardian HP bar. Final Level 10 world bosses have three phases; regular wave-10 Guardians have two. The original enemy art and movement remain intact. Implemented directly in `development`, still under evaluation. See [Guardian architecture and roadmap](docs/GAME_BIBLE.md#guardian-encounters--phase-3-development) and [automated Guardian tests](tests/guardians.test.cjs).

## Ink Absorption: growth from the paper (development)

The old wave-only upgrade reward has been replaced by **recoverable ink XP**. Each defeated enemy leaves its ordinary sumi-e stain behind, plus a small living ink kernel. Wander near the kernel and it spirals into the brush, with hand-drawn lines and a cinnabar center. At the end of each wave, the remaining living ink streams across the sheet to the player rather than being lost off-screen.

Your **BRUSH rank** is displayed in a slim XP meter on the **left side**, filling upward with the same deep cinnabar-red ink that enemies spill when defeated. Enemy death stains, splashes, reclaimed ink seeds and the wet-topped XP channel now share the game's original vermilion pigment. When it fills, pick one of the existing three-card upgrades and jump back into the *same* fight. Several rank-ups can queue independently. Later worlds and levels yield stronger ink so your development doesn't stall as enemies toughen. Higher brush rank and maximum health subtly refine the brush nib and its ink richness, capped at **1.18× apparent size**, while **the collision hitbox remains unchanged**. New runs start fresh, respecting the ten-wave independent level progression.

Source: [`js/ink-xp.js`](js/ink-xp.js), [`css/ink-xp.css`](css/ink-xp.css), and [XP regression tests](tests/ink-xp.test.cjs). Everything is implemented on `development` only, with desktop/phone-sized automated browser QA. Physical iPhone Safari playtesting and balance tuning remain necessary.

## Phase 4A: the awakened brush and living ink seeds (development)

The original **rounded, living ink blob has been restored**, now with gently morphing brush-painted edges instead of the flattened nib silhouette. Its outline is seeded once per run, so moving doesn't randomly redraw it. Aim and tail movement remain smoothly eased, and rank growth is capped at **1.18× apparent scale**. **Combat speed, collision radius, weapon orbits and the original enemy artwork remain unchanged.**

XP pickups are now **five variations of living ink seeds**, not regular circular orbs. They emerge from the original enemy splats and stretch into tapered ink ribbons when being recalled. No change was made to the XP reward values, level curve, acquisition magnet physics, or automatic wave-end banking.

See the complete [Phase 4A visual specification and acceptance checklist](docs/PHASE-4A-PROGRESSION-VISUAL-POLISH.md). Node gameplay regression tests pass; dedicated desktop and phone Chromium QA produces screenshots for ink seeds, moving brush, awakened rank and Night Scroll, with physical iPhone testing still pending. All source code for this phase is on `development` only.

## Home screen and first-stroke onboarding (development)

The starting experience is mobile-first without replacing the original sumi-e/washi art. The title now has one obvious **BEGIN JOURNEY** action, a quieter **ENDLESS MODE** choice and compact links to **HOW TO PLAY**, the animated film and the Chronicle. A short, optional instruction sheet explains drag/WASD movement, automatic combat, upgrades and ten-wave runs. A small non-blocking hint appears only on the first real gameplay run. Returning players can jump straight into the scroll selection.

The film still autoplays on every page load, as requested. Frame transitions now capture the exact outgoing film image, dissolve using eased interpolation and crossfade the final scene into the home screen instead of cutting hard. Reduced-motion users get a direct transition without unnecessary effects.

Implementation: `css/home.css` (isolated additive title styling), `index.html` (title hierarchy and help sheet), `js/intro.js` (film transition), and `js/main.js` (onboarding controls). The original combat silhouettes, enemy patterns, and campaign unlocks remain unchanged; the new ink pickups and player growth are additive to the renderer. The `main` branch is untouched. These refinements are being tested on **`development` only**.

## A story hidden beneath the paper

Before the world had a name, there was paper. The Painter imagined mountains, rivers, and living things in a single breath. But ink seeped through the other side, and abandoned marks learned to move. Afraid of these mistakes, the Painter tried to wash everything away. One unfinished brushstroke survived.

**You are that stroke.**

The prologue **automatically starts on every page load, without requiring a tap**. It is a **61-second, seven-shot animated short film** rendered by the browser: a droplet falling into blank paper, a moving painter drawing mountains, animated ink creatures rising from the reverse side, a water-front wiping the landscape away, a surviving brush-spirit reforming and moving, three scrolls opening, and a dramatic ONE MORE seal reveal. It uses no stock video, no remote animation model, and no MP4 download. The movie plays on its own, with seven timed shots and captions appearing only after the action begins. You can skip it immediately or replay it from the title. Optional synthesized ambient music is activated by tap, because Safari restricts sound autoplay. Slow camera moves, actual animated actors, wash effects and shot dissolves are all rendered live. Audio remains off until explicitly enabled, as required by mobile autoplay restrictions. A **Chronicle** unlocks the complete fiction as your campaign progresses.

![Seven-frame prologue storyboard, authored SVG illustration, not live gameplay captures](docs/images/seven-frames.svg)

## Three scrolls, one unfinished fate

![The three existing environments in an original editorial SVG triptych, not screenshots](docs/images/three-scrolls.svg)

The story works with the existing campaign, not in place of it. The game already has **3 worlds × 10 independent levels × 10 waves**. Every level begins a fresh build, ink XP earns upgrade choices while fighting, and permanent campaign unlocks survive failed runs. The short film is entirely separate from gameplay; it does not alter game physics, enemy balance, upgrades, or the protected combat renderer.

**Living project documents:** [Full GAME BIBLE, story, art/sprite/animation atlas and Kanban roadmap](docs/GAME_BIBLE.md) · [Original style protection contract](DESIGN.md) · [Research notes](docs/RESEARCH.md).

*All images in this README are **authored SVG illustrations** made for documentation and direction, not fabricated gameplay screenshots. Real screenshots are explicitly on the QA checklist.*

---


*An ink-born survival. No walls. No arena. One endless sheet of washi.*

**ONE MORE** is a zero-dependency, zero-build browser game written in vanilla
HTML/CSS/JS. You are a brush spirit walking an unbounded scroll of washi
paper — Vampire-Survivors style, the camera follows you and the paper never
ends. Your brush fires ink at the nearest threat on its own; your only job
is to *not be erased*.

The journey is **three scrolls (worlds), ten separate levels per scroll, ten
waves per level**. Each level is a fresh run and a harder challenge. Clear ten
waves to seal a level and unlock the next; clear Level 10 to unroll the next
world. Complete all three scrolls to seal the campaign. **THE ENDLESS SCROLL**
remains a separate replayable mode, cycling through the original three papers
as difficulty compounds.

The whole game is painted like living sumi-e: every creature is a wobbling
blot of ink animated with hand-drawn line boil, every kill splatters real
ink that **permanently stains the paper** — the world slowly becomes a
painting of your fight. Wave banners are stamped in kanji. The one drop of
color belongs to the vermillion seal.

---

## The three scrolls

| Sheet | Paper | The beasts that live there |
|---|---|---|
| 一 FIRST WASH | Pale washi, soft fibers | BLOT, SPEAR, SPIT, MOTH, DRIP, WISP, BRUTE |
| 二 NIGHT SCROLL | Near-black paper, the ink turns white | WISP, SHADE, MOTH, KAGE, STILT, SPEAR, BLIP |
| 三 CINNABAR FIELD | Vermillion-washed paper, red drips dry underfoot | BRUTE, SPIT, ONI, CRANE, DRIP, TITAN, KAGE |

**Each level is an independent ten-wave run.** Wave 10 summons a
**GUARDIAN**, with a stronger world boss on Level 10, Wave 10. Wave 5 is a
**SURGE**. New worlds unlock only after all ten levels of the preceding world
are cleared. The player can replay completed levels, and losing never removes
permanent unlocks.

Each scroll also now features a distinct encounter pattern, using the original
creatures and brush rendering: **SPLIT BLOOM** (FIRST WASH, waves 6/9),
**PHANTOM AMBUSH** (NIGHT SCROLL, waves 3/6/9) and **CRIMSON RUSH**
(CINNABAR FIELD, waves 5/9).

## How to play

Choose **THE JOURNEY**, select an unlocked scroll, then choose the next
unlocked level. Survive ten waves to seal it; between waves choose one of three
brush upgrades. These upgrades reset on every new level, while completed
levels stay saved in your browser.

| Input | Action |
|---|---|
| `W A S D` / Arrow keys | Move — the sheet is endless, walk anywhere |
| Auto-fire | Engaged — the brush always flicks at the nearest blot |
| `1` `2` `3` | Select an upgrade (press again, or `Enter`, to deploy) |
| `P` / `Esc` | Pause |
| `M` | Toggle sound |
| Touch | Drag anywhere for a virtual joystick |

**The fourteen ink-born**

| Name | Behavior |
|---|---|
| BLOT | Slow, relentless drifter |
| SPEAR | Telegraphs, then lunges in a straight line |
| SPIT | Keeps its distance, inflates, and lobs ink globs back at you |
| MOTH | Erratic flicker — never holds a course, bursts in jolts |
| DRIP | Dies into two fast blips |
| SHADE | Dissolves into flecks, blinks at your back, pounces |
| BRUTE | Hatched, dripping bruiser. Slow. Very hard to kill |
| WISP | Weaves sideways as it closes in |
| KAGE | Circles you like a stain, then cuts straight through in a dash |
| STILT | A tall sniper — draws a hair-thin line at you, then fires a needle |
| TITAN | The mother of blots — sheds her brood as she bears down |
| ONI | Horned bruiser — winds up, then bulldozes straight ahead |
| CRANE | Folded paper that swoops past in long, fast arcs |
| BLIP | A fast shard, born from deaths and titans |

SPIT's globs and STILT's needles are dodgable — watch for hollow rings and
the drawn line. SHADE leaves a stain where it vanished and where it
reappears; read the paper.

**The brush arts — 19 upgrades**, including four weapons:

- *Strokes*: Quick Hand, Bitter Ink, Twin Stroke, Through Mist, Flick,
  Fleeting Foot, Thick Ink, Red Seal, Ink Burst, Echo Stroke, Ink Orbit,
  Black Tide, Wet Paper, Crimson Tip, Paper Ward
- *Weapons* (marked 武 in vermilion on their cards):
  **Folded Fan** — a snapping spray of paper blades;
  **Ink Trail** — the smears you leave behind keep biting;
  **Spirit Scribes** — lesser brushes that wake and hunt on their own;
  **Ink Knots** — living brush threads bind a small cluster, slow them, and deal one delayed point of damage per target.

---

## Deploy to GitHub Pages

ONE MORE is a static website with no build step. To publish it directly,
open **Settings → Pages** and choose **Deploy from a branch**, with
branch `main` and folder `/ (root)`. GitHub Pages then serves `index.html`.
If you already use a separate Pages deployment setup, keep that existing
configuration. This repository does not require a server or secrets.

On a feature branch, use the branch's code for local previews; nothing is
published from a feature branch until the relevant changes land in your
configured deployment branch.

## Run locally

No build step. Any static server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly from disk also works.)

## Project structure

```
one-more/
├── index.html                  # shell: canvas + all screens + ink wobble filters
├── css/
│   ├── style.css               # the original sumi-e design system
│   └── intro.css               # cinematic + Chronicle only
├── js/
│   ├── config.js               # tuning: areas, enemies, waves, upgrades, ranks
│   ├── campaign.js             # persistent world/level unlocks
│   ├── audio.js                # synthesized ink sound kit (splats, taiko, gong)
│   ├── ui.js                   # DOM screens, HUD, kanji numerals, upgrade cards
│   ├── game.js                 # camera, combat, encounters, weapons, flow
│   ├── wave-director.js        # authored campaign encounters and spawn formations
│   ├── guardians.js            # multi-phase boss patterns and safe collision geometry
│   ├── render.js               # original gameplay renderer
│   ├── film.js                 # procedural actors, ink animations and live-drawn short film
│   ├── intro.js                # film timeline, captions, sound + Chronicle
│   └── main.js                 # bootstrap, input, game loop, wiring
├── .github/
│   └── workflows/
│       ├── test.yml            # progression + style-source checks on PRs
│       ├── story-preview.yml   # experimental tests + downloadable preview bundle
│       └── film-visual-qa.yml  # browser smoke test and real cinematic stills
├── tests/
│   ├── progression.test.cjs    # existing campaign regression tests
│   ├── story.test.cjs          # seven-shot film and archive regression tests
│   ├── film-browser.cjs        # CI-only real Chromium animation QA
│   ├── wave-director.test.cjs  # 300 encounter legality and pacing checks
│   └── guardians.test.cjs      # Guardian phases, telegraphs, damage, cleanup
├── docs/
│   ├── GAME_BIBLE.md           # canon lore, technical atlas, roadmap checklist
│   ├── RESEARCH.md             # art, accessibility, hosting choices
│   └── images/                 # original SVG illustrations (not screenshots)
├── DESIGN.md                   # frozen visual style references and rules
├── LICENSE
└── README.md
```

## Tuning the scrolls

All balance knobs live in `js/config.js`:

- `AREAS` — the three sheets: name, kanji, paper theme, difficulty multipliers,
  spawn roster and each sheet's Guardian
- `CFG.wave` — waves per level, spawn budgets, surge cadence, elite scaling
- `CFG.endless` — how fast the endless paper grows teeth after sheet three
- `ENEMIES` — hp, speed, size, score and the wave each type enters
- `UPGRADES` — the pool of strokes and weapons, and their level caps
- `CFG.world` — spawn padding, stain cap and fade, ambient mark density
- `CFG.ranks` — waves-cleared thresholds for the end-of-run seal

Campaign unlocks (`om_campaign_v1`), high score, run counter and mute preference
persist in `localStorage` —
no backend, no accounts, no tracking. GitHub Pages serves static files
only, and the game is 100% client-side by design.

## Test

Run `node --test tests/*.test.cjs` (Node.js 18+). **Combat Foundations / Phase 1** includes continuous swept projectile hits, pierce-once-per-target rules, hostile-needle and Spirit Scribe collision reliability, and clean keyboard/joystick state on restart, pause and focus loss. See [`tests/combat.test.cjs`](tests/combat.test.cjs); the visuals and weapon damage values remain unchanged. The [Film visual QA workflow](https://github.com/itsnotalwin/ONE_MORE/actions/workflows/film-visual-qa.yml) additionally uses real desktop/phone-sized Chromium to render the short film and produces **10 real browser screenshots** as a downloadable artifact. Playwright is CI-only; the playable game still has zero third-party runtime dependencies. The suite checks
all 30 stage clears, 300 wave transitions, sequential unlocks, world-specific
enemy patterns, final bosses, storage fallback, Endless, and frozen original
renderer/audio/CSS contents. It is a headless logic test; actual browser visual
checks on mobile and desktop are still required before deploying.

For exact original appearance, consult [DESIGN.md](DESIGN.md) and its
commit-pinned references. Existing enemy illustrations, combat ink effects and
animations are preserved. The short film uses its own Canvas2D engine to animate painting, characters, water, camera moves and title reveals. Only dissolve snapshots are cached; the scenes are not static slide backgrounds.

**Live test site:** this repository's GitHub Pages workflow now builds on `development`. The owner explicitly approved using the live URL for previews. The separate third-party raw.githack branch preview remains an alternative. The `main` branch is not merged or modified.

## Tech

- Vanilla JavaScript (ES6+), Canvas 2D, WebAudio API
- Procedural brush rendering: tapered strokes, wobbling blobs, splatter
  stamps, dry-brush streaks, line-boil animation — no imported combat image assets
- Unbounded world: camera-follow, rectangle-accurate off-screen spawning,
  sprite-cached world-space stains, hash-grid ambient paper marks
- Zero dependencies, zero build step, zero telemetry
- Fonts: Zen Antique, IBM Plex Mono (Google Fonts CDN, with system
  fallbacks if offline)

## License

MIT — see [LICENSE](./LICENSE).
