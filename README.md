# ONE MORE

*An ink-born survival game. One arena. Endless waves. Simple upgrades.*

**ONE MORE** is a zero-dependency, zero-build browser game written in vanilla
HTML/CSS/JS. You are a brush spirit alone on a sheet of washi paper. Your
brush fires ink at the nearest threat — your only job is to *not be erased*.
Every cleared wave lets you pick one of three upgrades. Every wave after
that hits harder. The waves never stop.

The whole game is painted like living sumi-e: every creature is a wobbling
blot of ink animated with hand-drawn line boil, every kill splatters real
ink that **permanently stains the paper** — the arena slowly becomes a
painting of your fight. Wave banners are stamped in kanji. The one drop of
color belongs to the vermillion seal.

---

## How to play

| Input | Action |
|---|---|
| `W A S D` / Arrow keys | Move |
| Auto-fire | Engaged — the brush always flicks at the nearest blot |
| `1` `2` `3` | Select an upgrade (press again, or `Enter`, to deploy) |
| `P` / `Esc` | Pause |
| `M` | Toggle sound |
| Touch | Drag anywhere for a virtual joystick |

**The ink-born**

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
| TITAN | The mother of blots — a massive mass that sheds its brood |

SPIT's globs are dodgable — watch for the hollow rings. SHADE leaves a
stain where it vanished and where it reappears; read the paper.

**The brush skills** — 15 upgrades across 9 strokes and 6 new arts:
Quick Hand, Bitter Ink, Twin Stroke, Through Mist, Flick, Fleeting Foot,
Thick Ink, Red Seal, Ink Burst, **Echo Stroke** (mirrored volley behind
you), **Ink Orbit** (droplets circle and grind), **Black Tide** (a
breathing nova that shoves the arena back), **Wet Paper** (struck beasts
wade slow), **Crimson Tip** (deep-strike crits), and **Paper Ward** (a
talisman that swallows one hit, then reforms).

Every 5th wave is a **SURGE** — a much denser wave. Survive it and the
arena respects you slightly more.

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
   git commit -m "ONE MORE — initial commit"
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
│   ├── config.js               # tuning: enemies, waves, upgrades, ranks, ink knobs
│   ├── audio.js                # synthesized ink sound kit (splats, taiko, no assets)
│   ├── ui.js                   # DOM screens, HUD, kanji numerals, upgrade cards
│   ├── game.js                 # state, waves, entities, collisions, flow, stains
│   ├── render.js               # sumi-e renderer: paper, brush strokes, line boil,
│   │                           #   splatter physics, persistent stain layer
│   └── main.js                 # bootstrap, input, game loop, wiring
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages deployment
├── .nojekyll                   # serve files as-is, skip Jekyll
├── LICENSE
└── README.md
```

## Tuning the arena

All balance knobs live in `js/config.js`:

- `CFG.wave.budget` — how many spawn points each wave gets
- `CFG.wave.surgeEvery` / `surgeMult` — how nasty SURGE waves are
- `ENEMIES` — hp, speed, size, score and the wave each type enters
- `UPGRADES` — the pool of simple upgrades and their level caps
- `CFG.ranks` — waves-cleared thresholds for the end-of-run seal
- `CFG.ink` — line boil rate, how fast dried stains fade, trail spacing

High score, run counter and mute preference persist in `localStorage` —
no backend, no accounts, no tracking. GitHub Pages serves static files
only, and the game is 100% client-side by design.

## Tech

- Vanilla JavaScript (ES6+), Canvas 2D, WebAudio API
- Procedural brush rendering: tapered strokes, wobbling blobs, splatter
  stamps, dry-brush streaks, line-boil animation — no image assets
- Zero dependencies, zero build step, zero telemetry
- Fonts: Zen Antique, IBM Plex Mono (Google Fonts CDN, with system
  fallbacks if offline)

## License

MIT — see [LICENSE](./LICENSE).
