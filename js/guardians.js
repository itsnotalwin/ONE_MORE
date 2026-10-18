'use strict';
/* ONE MORE — GUARDIAN DIRECTOR
   Distinct authored, telegraphed attacks using the original ink palettes.
   Pure attack geometry; no art assets, DOM, timers or rendering dependencies.
   Normal tenth-wave Guardians have two HP phases; the World 10/10 bosses
   have three phases. Every attack has a visible >1s windup and escape room.
*/
const GUARDIANS = (() => {
  const phases = (hp, maxHp, worldBoss) => {
    const ratio = Math.max(0, hp) / Math.max(1, maxHp);
    return worldBoss
      ? (ratio <= .34 ? 3 : ratio <= .68 ? 2 : 1)
      : (ratio <= .52 ? 2 : 1);
  };
  const titles = [
    ['THE BROKEN LINE', 'THE PAGE SPLITS', 'THE FIRST SEAL'],
    ['THE FALSE REFLECTION', 'THE DOUBLE SHADOW', 'THE NIGHT SEAL'],
    ['THE RED IMPRINT', 'THE SECOND SEAL', 'THE CINNABAR CROWN'],
  ];
  function attack(world, phase, worldBoss, origin, target, viewport, cast = 0) {
    const windup = worldBoss ? 1.25 : 1.15;
    const marks = [];
    if (world === 0) {
      /* First Wash: ink seams cross the sheet. A perpendicular sidestep
         reaches the clear corridor before the seam turns solid. */
      const offset = phase === 1 ? [0]
        : phase === 2 ? [0, cast % 2 ? 113 : -113]
        : [0, -136, 136];
      const vertical = cast % 2 === 0;
      for (const d of offset) {
        const x1 = vertical ? target.x + d : target.x - Math.max(420, viewport.width * .7);
        const y1 = vertical ? target.y - Math.max(420, viewport.height * .7) : target.y + d;
        const x2 = vertical ? x1 : target.x + Math.max(420, viewport.width * .7);
        const y2 = vertical ? target.y + Math.max(420, viewport.height * .7) : y1;
        marks.push({ kind: 'line', x1, y1, x2, y2, width: worldBoss ? 31 : 27 });
      }
    } else if (world === 1) {
      /* Night Scroll: rays commit to the player's position at cast time.
         Attacks are narrow and cannot track during the warning. */
      const dx = target.x - origin.x, dy = target.y - origin.y;
      const base = Math.atan2(dy, dx);
      const spread = phase === 1 ? [0]
        : phase === 2 ? [-.20, .20] : [-.29, 0, .29];
      for (const delta of spread) {
        const angle = base + delta;
        const range = Math.max(680, Math.hypot(dx, dy) + 280);
        marks.push({
          kind: 'line', x1: origin.x, y1: origin.y,
          x2: origin.x + Math.cos(angle) * range,
          y2: origin.y + Math.sin(angle) * range, width: worldBoss ? 28 : 24,
        });
      }
    } else {
      /* Cinnabar Field: red seals fall where the brush stood when warned.
         The spread stays small, with large open escape directions. */
      const offset = phase === 1 ? [[0, 0]]
        : phase === 2 ? [[0, 0], [cast % 2 ? -108 : 108, 0]]
        : [[0, 0], [109, 0], [-109, 0]];
      for (const [dx, dy] of offset) marks.push({
        kind: 'seal', x: target.x + dx, y: target.y + dy,
        radius: worldBoss ? 45 : 39,
      });
    }
    return {
      world, phase, title: titles[world][Math.min(2, phase - 1)],
      windup, recovery: worldBoss ? .32 : .26, marks,
    };
  }
  function hits(mark, player) {
    if (mark.kind === 'seal') {
      const dx = player.x - mark.x, dy = player.y - mark.y;
      return dx * dx + dy * dy < (mark.radius + player.r - 2) ** 2;
    }
    const dx = mark.x2 - mark.x1, dy = mark.y2 - mark.y1;
    const len2 = dx * dx + dy * dy;
    const u = len2 ? Math.max(0, Math.min(1,
      ((player.x - mark.x1) * dx + (player.y - mark.y1) * dy) / len2)) : 0;
    const px = mark.x1 + u * dx, py = mark.y1 + u * dy;
    const ax = player.x - px, ay = player.y - py;
    return ax * ax + ay * ay < (mark.width * .5 + player.r - 2) ** 2;
  }
  return { phases, attack, hits, titles };
})();
