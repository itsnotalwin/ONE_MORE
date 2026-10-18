'use strict';
/* ONE MORE / THE LAST STROKE
   A tiny original animated film, performed live in Canvas2D.
   Independent from the game's renderer, without video downloads. */
const FILM = (() => {
  const PI=Math.PI, TAU=PI*2, P='#ede7d9', I='#1a1714', R='#b23a2b', D='#17130f', L='#e9e2d2';
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const ease=(a,b,t)=>{const p=clamp((t-a)/(b-a));return p*p*(3-2*p);};
  const lerp=(a,b,t)=>a+(b-a)*t;
  const seed=(n)=>()=>{n|=0;n=n+0x6d2b79f5|0;let x=Math.imul(n^n>>>15,1|n);x^=x+Math.imul(x^x>>>7,61|x);return((x^x>>>14)>>>0)/4294967296;};
  function line(c,p,width,color,alpha=1){
    c.save();c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();
    p.forEach((xy,i)=>i?c.lineTo(xy[0],xy[1]):c.moveTo(xy[0],xy[1]));c.stroke();c.restore();
  }
  function dot(c,x,y,r,color,alpha=1){
    c.save();c.globalAlpha=alpha;c.fillStyle=color;c.beginPath();c.arc(x,y,Math.max(.1,r),0,TAU);c.fill();c.restore();
  }
  function blot(c,x,y,r,id,color=I,alpha=1){
    let rand=seed(id);c.save();c.globalAlpha=alpha;c.fillStyle=color;c.beginPath();
    for(let i=0;i<13;i++){let a=i*TAU/13,v=r*(.77+.47*rand());i?c.lineTo(x+Math.cos(a)*v,y+Math.sin(a)*v):c.moveTo(x+Math.cos(a)*v,y+Math.sin(a)*v);}
    c.closePath();c.fill();c.restore();
  }
  function paper(c,w,h,night){
    c.fillStyle=night?D:P;c.fillRect(0,0,w,h);
    const rr=seed(18);
    for(let i=0;i<160;i++){const x=rr()*w,y=rr()*h;line(c,[[x,y],[x+rr()*18+3,y+rr()*2]],.43,night?L:I,.035);}
    const g=c.createRadialGradient(w*.5,h*.45,0,w*.5,h*.45,Math.max(w,h)*.74);
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,night?'rgba(0,0,0,.5)':'rgba(75,55,38,.14)');
    c.fillStyle=g;c.fillRect(0,0,w,h);
  }
  function mountain(c,w,h,t,reveal,night){
    c.save();c.beginPath();c.rect(0,0,w*clamp(reveal),h);c.clip();
    for(let layer=0;layer<4;layer++){
      const rand=seed(38+layer*73);
      c.beginPath();c.moveTo(-30,h+30);
      for(let j=0;j<=35;j++){
        const x=j/35*w,ph=j*.53+layer*1.8;
        const peak=Math.abs(.57*Math.sin(ph)+.3*Math.sin(ph*2.1)+.14*Math.sin(ph*4.5));
        c.lineTo(x,h*(.58+layer*.103)-peak*h*(.22-layer*.027)+Math.sin(t*.2+ph)*2+rand()*4);
      }
      c.lineTo(w+30,h+30);c.closePath();c.globalAlpha=.09+layer*.095;c.fillStyle=night?L:I;c.fill();
    }
    c.restore();
    /* Slowly slipping wash layers keep the landscape breathing. */
    for(let j=0;j<3;j++){
      const y=h*(.49+j*.115)+Math.sin(t*.27+j)*8;
      const g=c.createLinearGradient(0,y-h*.065,0,y+h*.065);
      const p=night?'23,19,15':'237,231,217';
      g.addColorStop(0,'rgba('+p+',0)');g.addColorStop(.5,'rgba('+p+',.53)');g.addColorStop(1,'rgba('+p+',0)');
      c.fillStyle=g;c.fillRect((t*(4+j*2))%(w*.45)-w*.3,y-h*.065,w*.92,h*.14);
    }
  }
  function hero(c,x,y,size,t,night=false,alpha=1){
    const ink=night?L:I;
    c.save();c.translate(x,y+Math.sin(t*2.6)*size*.06);c.rotate(Math.sin(t*2.1)*.075);c.globalAlpha=alpha;
    blot(c,0,0,size*.32,49,ink);
    line(c,[[-size*.17,size*.17],[-size*.25,size*.40],[-size*.4+Math.sin(t*3)*size*.07,size*.71]],size*.085,ink,.8);
    line(c,[[size*.15,size*.2],[size*.22,size*.41],[size*.16+Math.sin(t*3)*size*.06,size*.56]],size*.06,ink,.65);
    dot(c,size*.11,-size*.1,size*.055,R);
    c.restore();
  }
  function beast(c,x,y,r,t,id,night=false,alpha=1){
    const ink=night?L:I;
    c.save();c.translate(x,y);c.rotate(Math.sin(t*1.7+id)*.12);
    blot(c,0,0,r,id,ink,alpha);
    for(let j=0;j<4;j++){const a=j*TAU/4+t*.2;
      line(c,[[Math.cos(a)*r*.5,Math.sin(a)*r*.5],[Math.cos(a)*r*1.36,Math.sin(a)*r*1.36]],Math.max(1,r*.12),ink,alpha*.5);
    }
    dot(c,r*.26,-r*.16,Math.max(1,r*.09),R,alpha);
    c.restore();
  }
  function flecks(c,w,h,t,night=false,n=35){
    const rr=seed(988);
    for(let i=0;i<n;i++){
      let x=rr()*w,y=rr()*h,r=rr()*2.6+.3;
      dot(c,(x+Math.sin(t*.35+i)*14+w)%w,(y-t*(3+i%4)+h*12)%h,r,night?L:I,.07+(i%4)*.018);
    }
  }
  function drawStroke(c,coords,width,alpha,progress,color=I){
    if(progress<=0)return;
    const k=clamp(progress)*(coords.length-1),n=Math.floor(k),q=k-n;
    const pts=coords.slice(0,n+1);
    if(n<coords.length-1)pts.push([lerp(coords[n][0],coords[n+1][0],q),lerp(coords[n][1],coords[n+1][1],q)]);
    line(c,pts,width,color,alpha);
  }
  function creation(c,w,h,t){
    const reveal=ease(.3,6.2,t);
    mountain(c,w,h,t,reveal,false);
    if(t<6.7){
      const x=w*lerp(.02,1,reveal),y=h*(.38+.09*Math.sin(reveal*TAU));
      c.save();c.translate(x,y);c.rotate(.3);c.scale(Math.max(.45,Math.min(w,h)/570),Math.max(.45,Math.min(w,h)/570));
      c.fillStyle='#68543a';c.fillRect(-5,-135,10,140);
      c.fillStyle=I;c.beginPath();c.moveTo(-8,0);c.quadraticCurveTo(-11,20,0,55);c.quadraticCurveTo(11,22,8,0);c.fill();c.restore();
    }
    let river=[];for(let i=0;i<=30;i++)river.push([w*(.51+.1*Math.sin(i*.32)),h*lerp(.59,1.1,i/30)]);
    drawStroke(c,river,Math.max(3,w*.012),.55,ease(3,7.3,t));
  }
  function shadows(c,w,h,t){
    mountain(c,w,h,t,1,true);
    for(let i=0;i<12;i++){
      const born=ease(i*.26,i*.26+1.6,t),size=Math.min(w,h)*(.014+i%4*.007)*born;
      if(born>.01)beast(c,w*(.07+i*.078)+Math.sin(t*.57+i)*w*.035,
        h*(.45+.12*Math.sin(i*2.1))-Math.sin(t*1.17+i)*h*.04,
        Math.max(2,size),t,i*112,true,born*.94);
    }
    const seam=ease(4.2,7.8,t);
    drawStroke(c,[[w*.53,0],[w*.45,h*.27],[w*.59,h*.59],[w*.48,h]],Math.max(1,w*.005),.44,seam,L);
    flecks(c,w,h,t,true);
  }
  function erasure(c,w,h,t){
    mountain(c,w,h,t,1,false);
    const rr=seed(513);
    for(let i=0;i<25;i++) {
      const a=ease(1,5.8,t);
      blot(c,rr()*w,h*(.35+rr()*.5)-a*h*.2,Math.min(w,h)*(.008+rr()*.011),
        i*37,I,(1-a)*.27);
    }
    /* A living water-front actively erases what was painted. */
    const p=ease(.6,6,t),x=w*lerp(-.12,1.13,p);
    c.save();const g=c.createLinearGradient(x-w*.22,0,x+w*.09,0);
    g.addColorStop(0,'rgba(237,231,217,0)');
    g.addColorStop(.5,'rgba(237,231,217,.88)');
    g.addColorStop(1,'rgba(237,231,217,1)');
    c.fillStyle=g;c.beginPath();c.moveTo(x,-20);
    for(let j=0;j<=28;j++){const y=j/28*h;c.lineTo(x+Math.sin(y*.017+t*2)*w*.03,y);}
    c.lineTo(w+30,h+30);c.lineTo(w+30,-20);c.closePath();c.fill();c.restore();
    drawStroke(c,[[w*.42,0],[w*.46,h*.22],[w*.39,h*.45],[w*.52,h*.71],[w*.46,h]],
      Math.max(2,w*.008),.75,ease(4,6.8,t),R);
    if(t>4.6&&t<6.5){c.fillStyle='rgba(178,58,43,.055)';c.fillRect(0,0,w,h);}
  }
  function survivor(c,w,h,t){
    const gathering=ease(.3,4,t),rr=seed(601);
    for(let i=0;i<47;i++){
      const a=rr()*TAU,r=Math.min(w,h)*(.13+rr()*.34);
      let x=lerp(w*.5+Math.cos(a)*r,w*.5+Math.cos(a)*9,gathering);
      let y=lerp(h*.46+Math.sin(a)*r,h*.46+Math.sin(a)*9,gathering);
      dot(c,x,y,.7+rr()*2.5,I,.25+.5*(1-gathering));
    }
    if(gathering>.12){
      const travel=ease(4,8,t);
      hero(c,w*(.5+travel*.18),h*(.46-travel*.11),Math.max(31,Math.min(w,h)*.12)*gathering,t,false,gathering);
    }
    for(let i=0;i<3;i++) {
      const enter=ease(3+i*.46,5.8+i*.3,t);
      beast(c,w*(.11+i*.12+enter*.08),h*(.55+i*.07+Math.sin(t*2+i)*.025),
        Math.max(9,Math.min(w,h)*(.027+i*.003)),t,i*23,false,enter*.3);
    }
    flecks(c,w,h,t,false,27);
  }
  function scrolls(c,w,h,t){
    const narrow=w/h<.8;
    for(let i=0;i<3;i++){
      const p=ease(.7+i*1.5,3.1+i*1.5,t);
      if(p<=0)continue;
      const bw=w*(narrow?.275:.235),gap=w*(narrow?.036:.064);
      const x=(w-(bw*3+gap*2))/2+i*(bw+gap);
      const y=h*(narrow?.24:.17),bh=h*(narrow?.55:.65);
      c.save();c.beginPath();c.rect(x,y,bw*p,bh);c.clip();c.fillStyle=[P,D,'#eadbc4'][i];c.fillRect(x,y,bw,bh);
      c.translate(x,y);mountain(c,bw,bh,t,1,i===1);
      beast(c,bw*.6,bh*(.63+.02*Math.sin(t*1.8+i)),Math.max(5,bw*.076),t,144+i,i===1,.72);
      if(i===2)line(c,[[bw*.05,bh*.52],[bw*.44,bh*.42],[bw*.86,bh*.56]],Math.max(2,bw*.023),R,.65);
      c.restore();c.save();c.globalAlpha=p*.7;c.strokeStyle=i===1?L:I;c.lineWidth=1.6;c.strokeRect(x,y,bw*p,bh);c.restore();
      c.save();c.globalAlpha=p;c.fillStyle=i===1?L:R;c.textAlign='center';
      c.font='normal '+Math.max(17,Math.min(40,bw*.2))+'px "Zen Antique",Georgia,serif';
      c.fillText(['一','夜','紅'][i],x+bw*.5,y+bh*.86);c.restore();
    }
  }
  function finale(c,w,h,t,reduced){
    const reveal=ease(.3,3.9,t),size=Math.min(w*.15,h*.22,137);
    const text='ONE MORE.';
    c.save();c.font='normal '+size+'px "Zen Antique",Georgia,serif';c.textAlign='center';c.textBaseline='middle';
    const textWidth=c.measureText(text).width;
    c.beginPath();c.rect(w*.5-textWidth*.55,h*.35-size*.75,textWidth*1.12*reveal,size*1.6);c.clip();
    c.fillStyle=I;c.fillText(text,w*.5,h*.35);c.restore();
    hero(c,w*.24,h*.66,Math.max(31,Math.min(w,h)*.11),t);
    let trail=[];for(let i=0;i<23;i++)trail.push([w*(.19+i*.028),h*(.72+Math.sin(i*.3)*.009)]);
    drawStroke(c,trail,Math.max(2,w*.007),.25,ease(1,5.5,t));
    const stamp=ease(3.8,4.18,t),side=Math.min(70,w*.13,h*.14)*stamp;
    c.save();c.translate(w*.76,h*.47);c.rotate(-.08);c.globalAlpha=stamp;
    c.strokeStyle=R;c.lineWidth=3;c.strokeRect(-side/2,-side/2,side,side);
    c.fillStyle=R;c.textAlign='center';c.textBaseline='middle';
    c.font='normal '+(side*.78)+'px "Zen Antique",Georgia,serif';c.fillText('一',0,0);c.restore();
    if(!reduced&&t>4.15&&t<5.2)for(let i=0;i<20;i++){
      let a=i*TAU/20,p=ease(4.15,5.2,t);
      dot(c,w*.76+Math.cos(a)*p*(12+i%4*8),h*.47+Math.sin(a)*p*(12+i%4*8),1+i%3,R,(1-p)*.6);
    }
    if(t>5){
      c.save();c.globalAlpha=ease(5,6.1,t);c.fillStyle=I;
      c.textAlign='center';c.font=Math.max(11,Math.min(16,w*.025))+'px "IBM Plex Mono",monospace';
      c.fillText('THE LAST STROKE',w*.5,h*.51);c.restore();
    }
    flecks(c,w,h,t,false,35);
  }
  function scene(c,w,h,index,t,duration,reduced=false){
    c.save(); const night=index===2;paper(c,w,h,night);
    if(index===0){
      const fall=ease(.1,2.6,t),y=lerp(-h*.15,h*.49,fall*fall);
      if(t<3.7)dot(c,w*.5,y,Math.max(3,w*.009),I);
      const splash=ease(2.7,3.8,t);
      if(t>2.7){c.save();c.globalAlpha=(1-splash)*.6;c.strokeStyle=I;c.lineWidth=2;
        c.beginPath();c.ellipse(w*.5,h*.49,w*.16*splash,h*.09*splash,0,0,TAU);c.stroke();c.restore();}
      let pts=[];for(let i=0;i<=36;i++)pts.push([w*(.08+i/36*.84),h*(.54+Math.sin(i*.32)*.047)]);
      drawStroke(c,pts,Math.max(4,Math.min(w,h)*.026),.84,ease(3,7,t));
    }
    else if(index===1)creation(c,w,h,t);
    else if(index===2)shadows(c,w,h,t);
    else if(index===3)erasure(c,w,h,t);
    else if(index===4)survivor(c,w,h,t);
    else if(index===5)scrolls(c,w,h,t);
    else finale(c,w,h,t,reduced);
    if(index!==6){
      const g=c.createLinearGradient(0,h*.68,0,h);
      const col=night?'23,19,15':'237,231,217';
      g.addColorStop(0,'rgba('+col+',0)');g.addColorStop(1,'rgba('+col+',.94)');
      c.fillStyle=g;c.fillRect(0,h*.68,w,h*.32);
    }
    c.restore();
  }
  return {scene,ease};
})();
