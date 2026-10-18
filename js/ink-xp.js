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
  /* Each living seed is a recognizable calligraphic nib, never a circle.
     Geometry depends only on its drop seed and its current homeward direction.
     The dried splat remains permanently painted underneath it. */
  function draw(c,S,t,ink,paper,red){
    const p=S.player;
    const bounds={x0:S.cam.x-S.W*.60,x1:S.cam.x+S.W*.60,
      y0:S.cam.y-S.H*.60,y1:S.cam.y+S.H*.60};
    let detailed=0;
    for(const d of S.inkDrops||[]){
      if(d.x<bounds.x0||d.x>bounds.x1||d.y<bounds.y0||d.y>bounds.y1)continue;
      const r=clamp(2.7+Math.sqrt(Math.max(1,d.value))*.33,2.7,5.4);
      const seed=d.pulse||0, variant=(Math.floor(Math.abs(seed)*19)%5);
      const bloom=clamp((d.age||.19)/.19,0,1);
      const homing=!!d.homing;
      const dir=homing?Math.atan2(p.y-d.y,p.x-d.x)
        :Math.atan2(d.vy||0,d.vx||1);
      const sway=S.reduced?0:Math.sin(t*1.9+seed)*.035;
      const trailLen=homing&&!S.reduced?Math.min(21,8+Math.hypot(p.x-d.x,p.y-d.y)*.085):0;
      const body=r*(.94+.06*bloom);
      c.save();
      c.translate(d.x,d.y);
      c.rotate(dir+sway);
      c.globalAlpha=.68+.16*bloom;
      c.fillStyle=ink;
      /* A five-variant silhouette family, stable for the entire lifetime
         of each kernel; only the ink's direction and length are animated. */
      c.beginPath();
      c.moveTo(body*1.35,0);
      c.bezierCurveTo(body*.3,-body*(.6+variant*.055),
        -body*.64,-body*.78,-body*.9,-body*.14);
      c.lineTo(-body*(1.14+variant*.045),-body*.31);
      c.lineTo(-body*.79,body*.05);
      c.lineTo(-body*(1.08+(4-variant)*.03),body*.32);
      c.bezierCurveTo(-body*.48,body*(.62+variant*.03),
        body*.32,body*.56,body*1.35,0);
      c.fill();
      if(detailed++<80){
        /* The old trail behind a marble becomes a tapered ink ribbon
           physically connected to the nib while it returns home. */
        if(trailLen>0){
          c.globalAlpha=.38;
          c.beginPath();
          c.moveTo(-body*.54,-body*.28);
          c.quadraticCurveTo(-body-trailLen*.44,-body*(.15+variant*.06),
            -body-trailLen,-body*.06);
          c.quadraticCurveTo(-body-trailLen*.62,body*.10,
            -body*.78,body*.19);
          c.closePath();
          c.fill();
          if(trailLen>13){
            c.globalAlpha=.22;c.lineWidth=.55;c.strokeStyle=ink;
            c.beginPath();c.moveTo(-body*.85,body*.2);
            c.quadraticCurveTo(-body-trailLen*.55,body*.62,
              -body-trailLen*.88,body*.42);c.stroke();
          }
        }else if(!S.reduced&&bloom>.4){
          c.globalAlpha=.30;c.lineWidth=.65;c.strokeStyle=ink;
          c.beginPath();c.moveTo(-body*.64,-body*.12);
          c.lineTo(-body*(1.48+variant*.065),-body*.37);c.stroke();
        }
        /* Cinnabar is a rare registration fleck, not an orb's red center. */
        if(variant===0 && d.value>=6){
          c.fillStyle=red;c.globalAlpha=.65;
          c.fillRect(body*.15,-body*.12,.8,.8);
        }
      }
      c.restore();
    }
  }
  return { needed,value,visualScale,visualForm,drop,grant,update,draw,CFG_XP };
})();
