# Research notes — film-like ink intro on a static browser game

**Question:** How do we make ONE MORE's story feel like a short cinematic without breaking the game's strong ink-and-washi visual identity or requiring a large video/engine on iPhone?

## Conclusion: a browser-native seven-shot short film

Use the existing zero-build HTML/CSS/Canvas architecture. Each shot must contain **actual animated subjects** and a story event: a falling drop that writes, a traveling bamboo brush drawing mountains, restless creatures emerging, a water-front wiping a scene, a spirit reforming from flecks, three unfurling scrolls, and a visible hand-brushed title reveal. Use a per-shot camera and short dissolves, with subtitles timed after the action begins. The viewer need not manually advance: the 61-second reel automatically plays on every visit, with immediate Skip and Replay.

**Why not an MP4 by default?** A rendered MP4 would require a separate video asset, compression/render pipeline, bandwidth and mobile codec testing. A canvas-native cinematic shares the visual language and deploys on the same static file server. An actual exported video trailer remains a separate *future feature*.

**Why not a 3D engine?** It would change the visual language, increase load, and fight the hand-drawn character of the existing renderer. This is primarily narrative graphic design, not new 3D content.

## Reference values and implementation

| Source | Useful conclusion | Implemented consequence |
|---|---|---|
| [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) | Pages publishes one selected branch/folder or a configured Actions source for a repository. | Keep production on main; do not repoint its publishing source for an experiment. |
| [GitHub deploy-pages action](https://github.com/actions/deploy-pages) | The \`preview\` parameter for true PR previews is documented as alpha/nonpublic. | No unsupported Pages preview promise. |
| [MDN: CSS performance optimization](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS) | Animations have a render cost, especially on low-power/mobile devices. | Keep scenes procedural, cap canvas DPR at 1.5, limit primitive counts, suspend hidden gameplay rendering, and cache only dissolve snapshots; test under desktop and phone viewports. |
| [MDN: reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion) | System reduced-motion settings should remove or reduce decorative animation. | Remove decorative camera movement/dissolves under reduced motion while retaining accessible subtitles, the progressing story timeline and Skip. |
| [MDN: Web Audio autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) | Browsers block audio initiated without user interaction. | Intro sounds are off by default; opt-in button creates/resumes AudioContext only on a click. |
| [raw.githack documentation](https://raw.githack.com/) | Development links can serve branch HTML/CSS/JS with correct MIME types, but may show a confirmation page and have no uptime guarantee. | Optional **third-party**, non-Pages branch preview; never use as production hosting. |

## Art direction research and constraints

Classic sumi-e hanging scrolls use empty space as part of the painting; mountain forms move through washes of gray rather than a literal photo-real landscape. The **visual approach** is deliberately derived from ONE MORE's existing code palette and drawing primitives, not photographs or copies of artwork. We did not import web-reference images into the game.

Each shot uses a near-unchanging paper substrate with a continuously moving calligraphic focal subject, plus one concise story caption that appears only after the action starts. The vermilion seal is the only strong chromatic exception, and the Night Scroll truly inverts ink contrast. **The revised result is a genuine procedural animated short, not a slideshow of separate paintings.** Real mobile browser acceptance remains necessary.

## Risk and evidence honesty

- **Source/logic checks** now confirm seven distinctly moving shots, 61-second running time, automatic playback, Skip and Replay, chapter dialogue, screenplay continuity, campaign independence and preservation of gameplay files.
- **Real browser QA** runs via GitHub Actions using Chromium to capture actual desktop and phone-sized film stills. This detects JavaScript exceptions and checks accessible film controls, but is not a substitute for physical iPhone Safari.
- **Only actual devices** can confirm viewport legibility, 60-second pacing, AudioContext behavior under iOS constraints and whether the cinematic feels emotionally effective.
- SVG files in the README are **original illustrations** and must never be presented as screenshots captured from the current game.
- No independent Pages branch URL has been configured, because doing so on the same project may displace the currently working \`main\` site.
