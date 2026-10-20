'use strict';
/* ONE MORE — INK ABSORPTION
   The stain is permanent paper history; its living seed is recoverable XP.
   Geometry, rewards, magnet motion, and reward thresholds live apart from art.
   No new sprite assets or dependencies. */
const INK_XP = (() => {
  const CFG_XP = {
    maxDrops: 350,
    attract: 106,
    collect: 16,
    minRadius: 3.0,
    maxRadius: 6.7,
    worldBoost: 0.12,
    stageBoost: 0.022,
    /* Cosmetic silhouette growth only. HP adds pigment, not a larger hitbox. */
    levelGrowth: .012,
    hpGrowth: .006,
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  /* Early ranks arrive quickly. After Brush 09 the rising cost prevents
     late-world swarms turning every few kills into an interrupting menu. */
  const needed = rank => Math.round(14 + rank * 7 + Math.pow(rank,1.43)*2.1 +
    3 * Math.pow(Math.max(0,rank-9),2));
  function value(def, enemy, run) {
    const wave=Math.max(1,run.wave||1);
    const world=Math.max(0,run.worldIndex||0);
    const stage=Math.max(1,run.level||1);
    const base = 1.2 + (def.cost||1)*1.65 + Math.sqrt(Math.max(1,def.hp||1))*.55;
    const scale = (1 + world*CFG_XP.worldBoost + (stage-1)*CFG_XP.stageBoost) *
      (1 + Math.min(15,wave-1)*.035);
    return Math.max(1,Math.round(base*scale*(enemy.elite ? enemy.guardian?.boss ? 9 : 5 : 1)));
  }
  function visualScale(stats) {
    if(!stats)return 1;
    const rank=Math.max(1,stats.inkRank||1);
    const bonus=Math.max(0,(stats.maxHp||3)-3);
    /* First three ranks keep the silhouette's original size. By rank 15
       it grows only ~14%, with up to 4% more pigment for extra integrity. */
    return clamp(1+Math.min(Math.max(0,rank-3),12)*CFG_XP.levelGrowth+
      Math.min(bonus,6)*CFG_XP.hpGrowth,1,1.18);
  }
  function visualForm(stats) {
    const rank=Math.max(1,stats?.inkRank||1);
    const tier=rank>=15?3:rank>=9?2:rank>=4?1:0;
    return {
      tier,
      scale:visualScale(stats),
      bristles:tier>=2?3:tier>=1?2:1,
      pigment:clamp(.88+Math.max(0,(stats?.maxHp||3)-3)*.012,.88,.97),
    };
  }
  function seedDrop(x,y,value,i,n,seed){
    const a=Math.PI*2*(i/n)+(seed%11)*.12;
    const scatter=10+(i%3)*7;
    return {x:x+Math.cos(a)*scatter,y:y+Math.sin(a)*scatter,
      value, age:0, pulse:seed*.081+i*.94, homing:false,
      vx:Math.cos(a)*(26+i%4*9),vy:Math.sin(a)*(26+i%3*8)};
  }
  /* Bundle elite reward into a handful of beautiful large drops, not
     a particle storm. Reuse the oldest kernels if the budget is full. */
  function drop(list, x,y,total,elite=false,seed=0){
    const count=elite ? 5 : total>12 ? 2 : 1;
    const base=Math.floor(total/count),rem=total%count;
    for(let i=0;i<count;i++){
      const item=seedDrop(x,y,base+(i<rem?1:0),i,count,seed);
      if(list.length>=CFG_XP.maxDrops){
        const old=list.shift();
        item.value+=old.value; /* no ink lost during crowded fights */
      }
      list.push(item);
    }
  }
  /* XP rank is a run-local independent progression. Crossing multiple
     thresholds queues separate upgrade choices, never loses overflow XP. */
  function grant(stats, xp){
    let gained=0;
    stats.inkXp+=Math.max(0,xp);
    while(stats.inkXp>=needed(stats.inkRank)&&gained<200){
      stats.inkXp-=needed(stats.inkRank);
      stats.inkRank++;
      stats.inkPending++;
      gained++;
    }
    return gained;
  }
  function update(drops,player,dt,recall,onCollect){
    const attraction=CFG_XP.attract+Math.min(13,(player.inkRank||1)-1)*6;
    const captured=CFG_XP.collect;
    for(let i=drops.length-1;i>=0;i--){
      const d=drops[i];
      d.age+=dt;
      const dx=player.x-d.x,dy=player.y-d.y,dist=Math.hypot(dx,dy);
      if(dist<captured){
        onCollect(d.value,d.x,d.y);
        drops.splice(i,1);continue;
      }
      d.homing=recall || d.homing || dist<=attraction;
      if(d.homing){
        /* Soft pull near the brush, a fast cinematic ink-recall between waves.
           Exponential suction is framerate-independent. */
        const strength=recall ? 9.5 : 5.7+Math.min(1.5,dist/170);
        const amount=1-Math.exp(-strength*dt);
        const px=d.x,py=d.y;
        d.x+=(player.x-d.x)*amount;
        d.y+=(player.y-d.y)*amount;
        d.vx=(d.x-px)/Math.max(.001,dt);
        d.vy=(d.y-py)/Math.max(.001,dt);
      }else{
        const drift=1-Math.exp(-4*dt);
        d.x+=d.vx*dt;d.y+=d.vy*dt;
        d.vx*=1-drift;d.vy*=1-drift;
      }
    }
  }
  /* Small fragments of the same living black ink as the enemies.
     Rounded quadratic contours, never teardrop blades, gems or coins.
     The droplets gently breathe and remain recognizably blob-shaped. */
  function drawLivingDrop(c, radius, seed, t, reduced, detailed) {
    const n = detailed ? 9 : 6;
    const wobble = detailed && !reduced ? Math.sin(t * 2.5 + seed) * .035 : 0;
    const points = [];
    for (let i = 0; i < n; i++) {
      const angle = i * Math.PI * 2 / n;
      const irregular = Math.sin(seed * 1.7 + i * 2.31) * .095;
      const breathing = detailed && !reduced
        ? Math.sin(t * 3.2 + seed + i * .86) * .035 : 0;
      const r = radius * (1 + irregular + breathing + wobble);
      points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    }
    const last = points[n-1], first = points[0];
    c.beginPath();
    c.moveTo((last[0]+first[0])*.5,(last[1]+first[1])*.5);
    for (let i = 0; i < n; i++) {
      const next = points[(i+1)%n];
      c.quadraticCurveTo(points[i][0],points[i][1],
        (points[i][0]+next[0])*.5,(points[i][1]+next[1])*.5);
    }
    c.closePath();
  }

  /* The black ink heart separates from the dried black splat, drifts,
     then becomes a tiny round blob sliding back into the main brush.
     The mechanic and XP collection distance are completely unchanged. */
  function draw(c,S,t,ink,paper,red){
    const p=S.player;
    const bounds={x0:S.cam.x-S.W*.60,x1:S.cam.x+S.W*.60,
      y0:S.cam.y-S.H*.60,y1:S.cam.y+S.H*.60};
    let detailed=0;
    for(const d of S.inkDrops||[]){
      if(d.x<bounds.x0||d.x>bounds.x1||d.y<bounds.y0||d.y>bounds.y1)continue;
      const radius=clamp(2.4+Math.sqrt(Math.max(1,d.value))*.24,2.5,4.4);
      const seed=d.pulse||.23;
      const detail=detailed++<90;
      const bloom=clamp((d.age||0)/.18,0,1);
      const moving=d.homing && !S.reduced;
      c.save();
      c.translate(d.x,d.y);
      c.globalAlpha=.78+.2*bloom;
      c.fillStyle=ink; /* same palette as the enemy, including Night Scroll */
      /* A very short wet smear connects to the rounded body when moving.
         The ink blob is always the subject, not the trail. */
      if(moving&&detail){
        const dx=p.x-d.x,dy=p.y-d.y;
        const angle=Math.atan2(dy,dx);
        const tail=Math.min(6,Math.hypot(d.vx||0,d.vy||0)*.017);
        if(tail>1.4){
          c.save();c.rotate(angle);
          c.globalAlpha=.24;
          c.beginPath();
          c.moveTo(-radius*.42,-radius*.33);
          c.quadraticCurveTo(-radius-tail*.65,-radius*.34,-radius-tail,0);
          c.quadraticCurveTo(-radius-tail*.52,radius*.18,
            -radius*.42,radius*.29);
          c.closePath();c.fill();
          c.restore();
        }
      }
      drawLivingDrop(c,radius*(.9+.1*bloom),seed,t,S.reduced,detail);
      c.globalAlpha=.94;
      c.fill();
      c.restore();
    }
  }
  return { needed,value,visualScale,visualForm,drop,grant,update,draw,CFG_XP };
})();
