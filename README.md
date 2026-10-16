# ONE MORE

*An ink-born survival. No walls. No arena. One endless sheet of washi.*

**ONE MORE** is a zero-dependency, zero-build browser game written in vanilla
HTML/CSS/JS. You are a brush spirit walking an unbounded scroll of washi
paper — Vampire-Survivors style, the camera follows you and the paper never
ends. Your brush fires ink at the nearest threat on its own; your only job
is to *not be erased*.

The journey is **three scrolls of ten waves**, each sheet a different paper,
each ending in a Guardian. Clear the third sheet and the scroll offers
itself forever: **THE ENDLESS SCROLL**, where the paper cycles through its
three faces and the difficulty never stops compounding.

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

Each sheet runs ten waves; the tenth summons a **GUARDIAN** — an elite
beast bearing the red 危 seal, tracked by a vermillion arrow at the rim of
the screen. Wave 5 and 15 and 25 are **SURGES** — denser, louder, meaner.

## How to play

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
  **Crimson Hanko** — a great red seal that slams down on the nearest horde.

---

## Deploy to GitHub Pages

The repo ships with a ready-made workflow at
`.github/workflows/deploy.yml` that publishes the site on every push to
`main` using the official GitHub Pages Actions pipeline.

1. Create a new repository on GitHub (e.g. `one-more`).
2. Push this folder's contents to the `main` branch:

   ```bash
   git init
   git add -A
   git commit -m "ONE MORE — the scroll turns"
   git branch -M main
   git remote add origin https://github.com/<your-username>/one-more.git
   git push -u origin main
   ```

3. In the repository, go to **Settings → Pages** and set
   **Build and deployment → Source** to **GitHub Actions**.
4. That's it. The workflow runs on every push and publishes the game to:

   `https://<your-username>.github.io/one-more/`

You can also trigger a redeploy manually from the **Actions** tab via
**Run workflow** (the workflow has `workflow_dispatch` enabled).

> Note: the first deploy requires step 3. If the workflow fails with a
> "Pages not enabled" error, this is the setting you missed.

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
│   └── style.css               # the sumi-e design system
├── js/
│   ├── config.js               # tuning: areas, enemies, waves, upgrades, ranks
│   ├── audio.js                # synthesized ink sound kit (splats, taiko, gong)
│   ├── ui.js                   # DOM screens, HUD, kanji numerals, upgrade cards
│   ├── game.js                 # camera, areas, waves, entities, weapons, flow
│   ├── render.js               # sumi-e renderer: tiling paper themes, brush
│   │                           #   strokes, line boil, world-space stain layer
│   └── main.js                 # bootstrap, input, game loop, wiring
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages deployment
├── .nojekyll                   # serve files as-is, skip Jekyll
├── LICENSE
└── README.md
```

## Tuning the scrolls

All balance knobs live in `js/config.js`:

- `AREAS` — the three sheets: name, kanji, paper theme, difficulty multipliers,
  spawn roster and each sheet's Guardian
- `CFG.wave` — waves per sheet, spawn budgets, surge cadence, elite scaling
- `CFG.endless` — how fast the endless paper grows teeth after sheet three
- `ENEMIES` — hp, speed, size, score and the wave each type enters
- `UPGRADES` — the pool of strokes and weapons, and their level caps
- `CFG.world` — spawn padding, stain cap and fade, ambient mark density
- `CFG.ranks` — waves-cleared thresholds for the end-of-run seal

High score, run counter and mute preference persist in `localStorage` —
no backend, no accounts, no tracking. GitHub Pages serves static files
only, and the game is 100% client-side by design.

## Tech

- Vanilla JavaScript (ES6+), Canvas 2D, WebAudio API
- Procedural brush rendering: tapered strokes, wobbling blobs, splatter
  stamps, dry-brush streaks, line-boil animation — no image assets
- Unbounded world: camera-follow, rectangle-accurate off-screen spawning,
  sprite-cached world-space stains, hash-grid ambient paper marks
- Zero dependencies, zero build step, zero telemetry
- Fonts: Zen Antique, IBM Plex Mono (Google Fonts CDN, with system
  fallbacks if offline)

## License

MIT — see [LICENSE](./LICENSE).
