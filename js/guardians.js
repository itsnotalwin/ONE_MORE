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
  /* The unseen Painter's calligraphy is sampled ONCE and reused for
     warning, impact ink and hit testing. It is never a wide road AABB. */
  function heavenlyPoints(a,b,c,d,steps=34){
    const points=[];
    for(let i=0;i<=steps;i++){
      const u=i/steps,v=1-u;
      points.push({
        x:v*v*v*a.x+3*v*v*u*b.x+3*v*u*u*c.x+u*u*u*d.x,
        y:v*v*v*a.y+3*v*v*u*b.y+3*v*u*u*c.y+u*u*u*d.y,
        width:.38+.62*Math.pow(Math.sin(Math.PI*(.09+u*.85)),.7),
      });
    }
    return points;
  }
  function divineMark(target,viewport,cast,offset,kind,boss,delay=0){
    const tall=cast%2===0;
    const extent=Math.max(470,(tall?viewport.height:viewport.width)*.8);
    const cx=target.x+(tall?offset:0),cy=target.y+(tall?0:offset);
    const a=tall?{x:cx-19,y:cy-extent}:{x:cx-extent,y:cy-19};
    const d=tall?{x:cx+22,y:cy+extent}:{x:cx+extent,y:cy+22};
    const hook=kind==='hook';
    const b=tall?{x:cx-28,y:cy-extent*.28}:{x:cx-extent*.28,y:cy-28};
    const c=tall?{x:cx+(hook?115:28),y:cy+extent*.56}:
      {x:cx+extent*.56,y:cy+(hook?115:28)};
    if(hook){
      d.x+=tall?100:-30;
      d.y+=tall?-35:100;
    }
    return {kind:'heavenlyStroke',style:kind,
      points:heavenlyPoints(a,b,c,d),width:boss?30:26,
      delay,seed:cast*31+offset};
  }

  function attack(world, phase, worldBoss, origin, target, viewport, cast = 0) {
    const windup = worldBoss ? 1.25 : 1.15;
    const marks = [];
    if (world === 0) {
      /* The Hand Above: a tapered downstroke, a staggered crossing,
         then the hooked judgment of the world Guardian. The curves
         lock onto the target on cast and never follow it. */
      const offset=phase===1?[0]:phase===2?[0,cast%2?113:-113]
        :[0,-136,136];
      for(let i=0;i<offset.length;i++){
        const style=phase===3&&i===2?'hook':phase===2&&i===1?'cross':'down';
        const mark=divineMark(target,viewport,cast+(phase===2&&i===1?1:0),
          offset[i],style,worldBoss,i*.34);
        marks.push(mark);
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
  function strokeHits(mark,player){
    const points=mark.points||[];
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
      const len=dx*dx+dy*dy;
      const t=len?Math.max(0,Math.min(1,
        ((player.x-a.x)*dx+(player.y-a.y)*dy)/len)):0;
      const nearX=a.x+dx*t,nearY=a.y+dy*t;
      const localW=mark.width*(a.width+(b.width-a.width)*t);
      const rr=localW*.5+player.r-2;
      if((player.x-nearX)**2+(player.y-nearY)**2<rr*rr)return true;
    }
    return false;
  }
  function hits(mark, player) {
    if(mark.kind==='heavenlyStroke')return strokeHits(mark,player);
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
  return { phases, attack, hits, titles, heavenlyPoints };
})();
