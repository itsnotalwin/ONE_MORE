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
    levelGrowth: .035,
    hpGrowth: .018,
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
    return clamp(1+Math.min(rank-1,20)*CFG_XP.levelGrowth+
      Math.min(bonus,10)*CFG_XP.hpGrowth,1,1.55);
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
  /* Same handmade shapes as paper stains, with a living cinnabar center.
     Night Scroll colors are passed in from the active renderer palette. */
  function draw(c,S,t,ink,paper,red){
    const p=S.player;
    const bounds={x0:S.cam.x-S.W*.6,x1:S.cam.x+S.W*.6,
      y0:S.cam.y-S.H*.6,y1:S.cam.y+S.H*.6};
    for(const d of S.inkDrops||[]){
      if(d.x<bounds.x0||d.x>bounds.x1||d.y<bounds.y0||d.y>bounds.y1)continue;
      const radius=clamp(CFG_XP.minRadius+Math.sqrt(d.value)*.65,
        CFG_XP.minRadius,CFG_XP.maxRadius);
      const beat=S.reduced?1:1+.10*Math.sin(t*4+d.pulse);
      c.save();c.translate(d.x,d.y);c.rotate(Math.sin(d.pulse)*.25);
      if(d.homing&&!S.reduced){
        const vx=p.x-d.x,vy=p.y-d.y;
        const dist=Math.hypot(vx,vy)||1;
        const trail=Math.min(35,dist*.24);
        c.globalAlpha=.30;c.strokeStyle=red;c.lineWidth=1.1;c.lineCap='round';
        c.beginPath();c.moveTo(0,0);
        c.quadraticCurveTo(-vx/dist*trail*.4+Math.sin(t*7+d.pulse)*3,
          -vy/dist*trail*.4,-vx/dist*trail,-vy/dist*trail);c.stroke();
      }
      c.globalAlpha=.85;c.scale(beat,beat);
      c.fillStyle=ink;c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.fill();
      c.globalAlpha=.80;c.strokeStyle=paper;c.lineWidth=.7;
      c.beginPath();c.arc(0,0,radius*.6,-.55,2.1);c.stroke();
      c.fillStyle=red;c.globalAlpha=.90;
      c.beginPath();c.arc(radius*.12,-radius*.15,Math.max(.75,radius*.24),0,Math.PI*2);c.fill();
      c.restore();
    }
  }
  return { needed,value,visualScale,drop,grant,update,draw,CFG_XP };
})();
