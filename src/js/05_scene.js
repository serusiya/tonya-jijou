'use strict';
/* ★檔案總覽：像素場景與動畫
 * - 家宅畫布（320×180）：drawScene 每幀繪製；SCENE.ents 為角色（主角、員工、護衛、家人）。
 * - playFx：全螢幕轉場（走路/馬車/船/時節流轉）。coinFx：金幣飛舞。
 * - visitFx：置中小視窗的拜訪動畫（走近→敲門→結果），所有「與人往來」都會呼叫。 */
/* ======================= 05 宅邸場景（像素 Canvas）與過場動畫 ======================= */
/** 場景全域狀態（畫布、角色、粒子、時間）。 */
const SCENE={w:320,h:180,ents:[],parts:[],sig:'',t:0,last:0,ctx:null,cv:null,timer:null,bubble:null};
/** 四季色盤。 */
const PAL={
  春:{sky:['#9fd0ee','#e9f2f4'],hill:'#7fa58a',grass:'#78b55a',canopy:'#f3a6c0',leaf:'#f7c6d8'},
  夏:{sky:['#5fb6e8','#cfeaf6'],hill:'#4f8a5f',grass:'#4d9e48',canopy:'#3f8f4a',leaf:'#79c26b'},
  秋:{sky:['#e6b57e','#f6e2c2'],hill:'#9c7a52',grass:'#a8a24e',canopy:'#d9782e',leaf:'#e8a04a'},
  冬:{sky:['#b9c6d6','#e9eef3'],hill:'#9aa7b5',grass:'#dfe7ee',canopy:'#6b5a4a',leaf:'#ffffff'}
};
/** 畫實心矩形（像素取整）。 */
function R_(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}

/* ---------- 小人繪製 ---------- */
/** 畫一個像素人物（衣色、髮色、帽、刀、算盤、女性、小孩等外觀選項）。 */
function drawPerson(c,x,y,o){
  const f=o.frame||0,s=o.small?0.72:1,H=Math.round(14*s),W=o.woman?8:6;
  x=Math.round(x);y=Math.round(y);
  R_(c,x-W/2-1,y-1,W+2,2,'#0003');                              // 影
  const legY=y-Math.round(4*s);
  const l1=f%2?1:0;
  R_(c,x-2,legY-l1,2,Math.round(4*s)+l1,o.pants||'#2b2a3a');
  R_(c,x,legY-(1-l1),2,Math.round(4*s)+(1-l1),o.pants||'#2b2a3a');
  const bodyH=Math.round(6*s),bodyY=legY-bodyH;
  R_(c,x-W/2,bodyY,W,bodyH,o.cloth);
  if(o.cloth2)R_(c,x-W/2,bodyY+Math.round(bodyH/2),W,2,o.cloth2);
  if(o.woman)R_(c,x-W/2,bodyY+2,W,1,o.cloth2||'#e0b030');
  const hy=bodyY-Math.round(5*s);
  R_(c,x-2,hy,4,Math.round(5*s),'#f1c9a0');                     // 臉
  R_(c,x-2,hy,4,2,o.hair||'#1a1612');                            // 髮
  if(o.woman){R_(c,x-3,hy-1,6,2,'#1a1612');R_(c,x+2,hy,1,3,'#e0b030')}
  else if(!o.small&&!o.noKnot)R_(c,x-1,hy-1,2,1,o.hair||'#1a1612');
  if(o.hat)R_(c,x-3,hy-1,6,2,o.hat);
  if(o.sword){R_(c,x+W/2,bodyY+2,1,6,'#d8d8d8');R_(c,x+W/2,bodyY+7,1,1,'#7a5a2a')}
  if(o.abacus)R_(c,x+W/2,bodyY+3,3,2,'#6b4a2a');
  if(o.gold)R_(c,x-1,hy-3,2,1,'#e5a93b');
}
/** 各職位外觀（含船長、飛腳）。新增職位時在此加外觀。 */
const RANK_LOOK={
  丁稚:{cloth:'#b9c7d6',cloth2:'#8aa0b5',small:true},
  手代:{cloth:'#7a5a3a',cloth2:'#e8dcc4'},
  番頭:{cloth:'#27407a',cloth2:'#e8dcc4'},
  大番頭:{cloth:'#4a2f6a',cloth2:'#e5a93b',abacus:true},
  船長:{cloth:'#1f5a6e',cloth2:'#e8dcc4',hat:'#1a1612'},
  飛腳:{cloth:'#4f7a3a',cloth2:'#e8dcc4',hat:'#8a6a3a'},
  保鏢:{cloth:'#2b2b33',cloth2:'#b3261e',hat:'#1a1612'}
};

/* ---------- 背景元件 ---------- */
/** 畫倉（白壁黑瓦）。 */
function drawKura(c,x,y,flag){                                // 倉（白壁黑瓦）
  R_(c,x,y,40,26,'#eee7d8');R_(c,x,y+20,40,6,'#2a2420');
  R_(c,x+13,y+8,14,18,'#3a2f2a');R_(c,x+19,y+8,2,18,'#1a1612');R_(c,x+19,y+14,2,2,'#e5a93b');
  for(let i=0;i<4;i++)R_(c,x+3+i*9,y+2,1,3,'#cfc7b4');
  R_(c,x-4,y-4,48,4,'#262022');R_(c,x-2,y-8,44,4,'#322a2c');R_(c,x+2,y-11,36,3,'#262022');
  for(let i=0;i<8;i++)R_(c,x-3+i*6,y-4,1,4,'#4a4044');
  if(flag){R_(c,x+34,y-18,1,8,'#6b4a2a');R_(c,x+27,y-18,7,4,'#9b2c3a')}
}
/** 畫民宅。 */
function drawHouse(c,x,y,t,sea){
  // 屋瓦
  R_(c,x-4,y+4,118,6,'#232a40');R_(c,x,y-2,110,6,'#2c3552');R_(c,x+8,y-8,94,6,'#232a40');R_(c,x+20,y-13,70,5,'#2c3552');
  for(let i=0;i<19;i++){R_(c,x-2+i*6,y+4,1,6,'#3a4566');if(i<15)R_(c,x+9+i*6,y-8,1,6,'#3a4566')}
  R_(c,x+50,y-16,10,3,'#1a1612');                                // 鯱瓦
  // 二樓
  R_(c,x+4,y+10,102,18,'#e9dfc8');
  for(let i=0;i<6;i++){R_(c,x+9+i*16,y+13,11,11,'#4a3a2a');for(let k=0;k<3;k++){R_(c,x+11+i*16+k*3,y+13,1,11,'#e9dfc8')}}
  R_(c,x+4,y+28,102,3,'#3a2f27');
  // 一樓店面
  R_(c,x+4,y+31,102,28,'#d9c9a6');R_(c,x+4,y+57,102,3,'#2a2420');
  R_(c,x+10,y+34,26,24,'#3b2e24');                                // 帳場
  R_(c,x+12,y+36,22,10,'#c9a35a');R_(c,x+14,y+48,18,6,'#6b4a2a');
  R_(c,x+40,y+31,60,6,'#1e2d4a');                                 // 暖簾
  for(let i=0;i<5;i++){R_(c,x+40+i*12,y+37,10,20,'#1e2d4a');R_(c,x+44+i*12,y+43,3,6,'#f4ece1')}
  R_(c,x+40,y+57,60,1,'#10182a');
  // 看板
  R_(c,x+34,y+13,40,12,'#f4ece1');R_(c,x+34,y+13,40,1,'#1a1612');R_(c,x+34,y+24,40,1,'#1a1612');
  c.fillStyle='#1a1612';c.font='9px DotGothic16,monospace';c.textBaseline='top';
  const nm=(G&&G.me?G.me.family+'屋':'商店');c.fillText(nm,x+37+Math.max(0,(34-nm.length*9)/2),y+14);
  // 燈籠
  const glow=G&&G.cycle===3;
  [[x+2,y+36],[x+104,y+36]].forEach(([lx,ly])=>{R_(c,lx,ly,5,8,glow?'#ffb03a':'#b4442e');R_(c,lx+1,ly-2,3,2,'#1a1612');if(glow){c.fillStyle='#ffb03a33';c.beginPath();c.arc(lx+2.5,ly+4,11+Math.sin(t/300)*1,0,6.3);c.fill()}});
  if(sea==='冬'){R_(c,x-4,y+3,118,2,'#fff');R_(c,x,y-3,110,2,'#fff');R_(c,x+8,y-9,94,2,'#fff');R_(c,x+20,y-14,70,2,'#fff')}
}
/** 畫樹（隨季節變色）。 */
function drawTree(c,x,y,sea,t){
  const p=PAL[sea];R_(c,x-2,y-2,4,26,'#5a4030');
  if(sea==='冬'){R_(c,x-12,y-8,2,10,'#5a4030');R_(c,x+10,y-10,2,12,'#5a4030');R_(c,x-12,y-8,24,2,'#5a4030');R_(c,x-14,y-10,6,2,'#fff');R_(c,x+8,y-12,6,2,'#fff');return}
  const rows=[[ -9,-12,18],[-14,-8,28],[-16,-3,32],[-13,2,26],[-8,6,16]];
  rows.forEach(([dx,dy,w],i)=>R_(c,x+dx,y+dy,w,6,i%2?p.canopy:p.leaf));
}
/** 畫背景與遠景。 */
function drawBackdrop(c,t){
  const sea=season(),p=PAL[sea];
  const g=c.createLinearGradient(0,0,0,70);g.addColorStop(0,p.sky[0]);g.addColorStop(1,p.sky[1]);c.fillStyle=g;c.fillRect(0,0,320,100);
  // 雲
  const cx=(t/900)%380-30;R_(c,cx,12,26,5,'#ffffffcc');R_(c,cx+6,8,16,5,'#ffffffcc');
  const cx2=((t/1300)+160)%380-30;R_(c,cx2,26,22,4,'#ffffffaa');
  // 遠山
  c.fillStyle=p.hill;c.beginPath();c.moveTo(0,78);c.lineTo(40,52);c.lineTo(78,76);c.lineTo(120,48);c.lineTo(170,78);c.lineTo(220,54);c.lineTo(270,76);c.lineTo(320,50);c.lineTo(320,100);c.lineTo(0,100);c.fill();
  // 遠方城郭
  R_(c,226,58,26,18,'#e9e2d2');R_(c,222,54,34,4,'#2a2a3a');R_(c,230,46,18,8,'#e9e2d2');R_(c,226,42,26,4,'#2a2a3a');R_(c,234,34,10,8,'#e9e2d2');R_(c,231,31,16,3,'#2a2a3a');
  // 地面
  R_(c,0,100,320,12,p.grass);R_(c,0,112,320,68,sea==='冬'?'#cdbf9e':'#c2a572');
  for(let i=0;i<40;i++){const sx=(i*53)%320,sy=116+((i*37)%60);R_(c,sx,sy,2,1,sea==='冬'?'#b9aa86':'#b09560')}
  R_(c,0,110,320,2,'#0002');
  // 石板路
  R_(c,56,112,26,68,'#bcb4a2');for(let i=0;i<8;i++)R_(c,56,114+i*9,26,1,'#9a927f');
}
/** 畫圍籬。 */
function drawFence(c){
  for(let x=2;x<320;x+=8){R_(c,x,164,2,14,'#6b4a2a')}
  R_(c,0,168,320,2,'#8a5f34');R_(c,0,174,320,2,'#8a5f34');
}

/* ---------- 實體管理 ---------- */
/** 固定站位。 */
const SPOTS={proto:{x:62,y:116}};
/** 場景角色簽章：員工/護衛/倉庫/家人改變時用來判斷是否要重建。 */
function entSig(){return [G.emps.map(e=>e.id+e.rank).join(','),G.wh.n,G.family.spouse?1:0,(G.family.conc||[]).map(x=>x.cid).join('+'),G.family.kids.map(k=>k.id).join(',')].join('|')}
/** 建立場景角色。 */
function newEnt(kind,id,extra){return Object.assign({kind,id,x:30+Math.random()*250,y:122+Math.random()*40,tx:0,ty:0,spd:8+Math.random()*6,frame:0,ft:0,wait:Math.random()*2000},extra)}
/** 依遊戲狀態同步場景角色（員工、保鏢、家人）。 */
function sceneSync(force){
  if(!G)return;
  const sig=entSig();if(!force&&sig===SCENE.sig)return;SCENE.sig=sig;
  const old={};SCENE.ents.forEach(e=>old[e.id]=e);
  const out=[];const keep=(kind,id,extra)=>{const e=old[id]||newEnt(kind,id,extra);Object.assign(e,extra||{});out.push(e);return e};
  keep('proto','proto',{x:old.proto?old.proto.x:SPOTS.proto.x,y:old.proto?old.proto.y:SPOTS.proto.y,label:'掌櫃本人：'+G.me.name,spd:10});
  G.emps.forEach((e,i)=>{const x={rank:e.rank,label:'【'+e.rank+'】'+e.name,patrol:i};if(e.rank==='保鏢')x.spd=16;keep('emp','emp_'+e.id,x)});
  if(G.family.spouse)keep('wife','wife',{label:'夫人：'+G.family.spouse.name,spd:6});
  (G.family.conc||[]).forEach(x=>keep('wife','conc_'+x.cid,{label:'側室：'+x.name,spd:6}));
  G.family.kids.forEach(k=>{const a=kidAge(k);keep('kid','kid_'+k.id,{label:(a>=8?'':'幼')+'子女：'+k.name+'（'+a+'歲）',spd:14,age:a})});
  SCENE.ents=out;
}
/** 為角色挑下一個漫步目標。 */
function pickTarget(e){
  if(e.kind==='guard'||e.rank==='保鏢'){e.tx=e.tx>160?24:296;e.ty=e.patrol%2?158:126;return}
  if(e.kind==='proto'){const r=Math.random();if(r<0.5){e.tx=SPOTS.proto.x;e.ty=SPOTS.proto.y}else{e.tx=140+Math.random()*130;e.ty=118+Math.random()*10}return}
  if(e.kind==='wife'||e.kind==='kid'){e.tx=14+Math.random()*130;e.ty=120+Math.random()*42;return}
  if(e.rank==='大番頭'){e.tx=40+Math.random()*60;e.ty=116+Math.random()*10;return}
  e.tx=14+Math.random()*290;e.ty=118+Math.random()*44;
}
/** 角色移動一步。 */
function stepEnts(dt){
  SCENE.ents.forEach(e=>{
    if(e.wait>0){e.wait-=dt;e.moving=false;return}
    if(e.tx===0&&e.ty===0)pickTarget(e);
    const dx=e.tx-e.x,dy=e.ty-e.y,d=Math.hypot(dx,dy);
    if(d<1.5){e.wait=600+Math.random()*2600;e.moving=false;pickTarget(e);if(e.kind==='guard')e.wait=150;return}
    const v=e.spd*dt/1000;e.x+=dx/d*v;e.y+=dy/d*v;e.moving=true;e.dir=dx>=0?1:-1;
    e.ft+=dt;if(e.ft>180){e.ft=0;e.frame++}
  });
}
/** 依角色種類取外觀。 */
function entLook(e){
  switch(e.kind){
    case 'proto':return {cloth:'#1e2d4a',cloth2:'#e8dcc4',gold:true,abacus:true,hair:(G&&myAge()>=55)?'#c8c8c8':'#1a1612'};
    case 'guard':return {cloth:'#3a3a44',cloth2:'#8a8a98',sword:true,hat:'#1a1612',pants:'#222'};
    case 'wife':return {cloth:'#c46a8a',cloth2:'#e0b030',woman:true};
    case 'kid':return {cloth:e.label.includes('女')||e.label.includes('阿')?'#e07a9a':'#5a9bd0',cloth2:'#f4ece1',small:true,woman:false,noKnot:true};
    default:return RANK_LOOK[e.rank]||RANK_LOOK['手代'];
  }
}
/** 畫季節粒子（櫻花、落葉、雪）。 */
function drawParts(c,t,dt){
  const sea=season();
  if(!SCENE.parts.length)for(let i=0;i<26;i++)SCENE.parts.push({x:Math.random()*320,y:Math.random()*180,v:6+Math.random()*10,s:Math.random()*6});
  if(sea==='夏')return;
  const col=sea==='春'?'#f9c6d6':sea==='秋'?'#d8752a':'#ffffff';
  SCENE.parts.forEach(p=>{
    p.y+=p.v*dt/1000;p.x+=Math.sin((t/600)+p.s)*0.25+(sea==='冬'?0:0.3);
    if(p.y>180){p.y=-4;p.x=Math.random()*320}
    R_(c,p.x,p.y,sea==='冬'?1.5:2,sea==='冬'?1.5:1,col);
  });
}
/** 畫時節色調。 */
function drawTint(c){
  if(G.cycle===1){c.fillStyle='#ffd9a01a';c.fillRect(0,0,320,180)}
  else if(G.cycle===3){c.fillStyle='#ff7a3a26';c.fillRect(0,0,320,180)}
}
/** 每幀繪製整個家宅場景。 */
function drawScene(now){
  if(!G||!SCENE.ctx||UI.s.tab!=='home')return;
  const c=SCENE.ctx,dt=Math.min(100,now-(SCENE.last||now));SCENE.last=now;SCENE.t=now;
  sceneSync();stepEnts(dt);
  drawBackdrop(c,now);
  drawTree(c,12,58,season(),now);drawTree(c,308,62,season(),now);
  drawHouse(c,8,40,now,season());
  const slots=[[132,56],[180,56],[228,56],[270,86],[150,92],[210,92]];
  for(let i=0;i<Math.min(G.wh.n,slots.length);i++){const [x,y]=slots[i];drawKura(c,x,y,i===0);}
  if(season()==='冬')R_(c,0,108,320,3,'#fff8');
  const list=SCENE.ents.slice().sort((a,b)=>a.y-b.y);
  list.forEach(e=>{const L=entLook(e);drawPerson(c,e.x,e.y,Object.assign({frame:e.moving?e.frame:0},L,{small:L.small||e.kind==='kid'&&e.age<12}))});
  drawFence(c);drawParts(c,now,dt);drawTint(c);
  // 庫存提示牌
  c.fillStyle='#1a1612cc';c.fillRect(2,166,96,12);c.fillStyle='#f4ece1';c.font='8px DotGothic16,monospace';c.textBaseline='top';
  c.fillText('倉 '+G.wh.n+' 棟｜庫 '+invUsed()+'/'+invCap(),5,168);
}
/** 啟動場景動畫迴圈。 */
function sceneStart(){
  const cv=$('#scene');if(!cv)return;SCENE.cv=cv;SCENE.ctx=cv.getContext('2d');SCENE.ctx.imageSmoothingEnabled=false;
  if(SCENE.timer)cancelAnimationFrame(SCENE.timer);
  const loop=t=>{drawScene(t);SCENE.timer=requestAnimationFrame(loop)};SCENE.timer=requestAnimationFrame(loop);
  cv.addEventListener('click',ev=>{
    const r=cv.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width*320,y=(ev.clientY-r.top)/r.height*180;
    let best=null,bd=14;SCENE.ents.forEach(e=>{const d=Math.hypot(e.x-x,(e.y-6)-y);if(d<bd){bd=d;best=e}});
    if(best){sfx.tap();if(['emp','guard','wife','kid'].includes(best.kind))openChat(best);else say(best.label)}
    else if(x>=8&&x<=118&&y>=26&&y<=100){sfx.tap();UI.go('estate')}
    else if(x>=126&&y>=40&&y<=116){sfx.tap();UI.openSheet('warehouse')}
  });
}
/* 主角心聲 */
/** 主角頭上的對話泡泡。 */
function say(t,ms=3200){const s=$('#speech');if(!s)return;s.textContent=t;s.style.opacity=1;clearTimeout(SCENE.bubble);SCENE.bubble=setTimeout(()=>{s.style.opacity=0},ms)}
/** 依狀況挑一句主角心聲。 */
function thought(){
  const L=ownComms()[0];const lines=[];
  const idx=G.staple.idx||1;
  if(idx>2)lines.push(TX('protag.staple'));
  if(G.festival)lines.push(TX('protag.festival',{f:G.festival}));
  if(G.cartel.sanction>0)lines.push(TX('protag.sanction'));
  if(G.silver<400)lines.push(TX('protag.poor'));
  if(G.family.spouse&&G.family.kids.length)lines.push(TX('protag.family'));
  const it=G.introId&&CH(G.introId);if(it)lines.push(TX('protag.intro',{n:it.name.split(' ')[0]}));
  lines.push(TX('protag.season',{s:season()}),TX('protag.life'));
  return pick(lines);
}

/* ---------- 過場動畫 ---------- */
/** 全螢幕轉場狀態。 */
const FX={busy:false,timer:null};
/** 轉場中的小角色（走路/馬車/船）。 */
function fxSprite(kind){
  const cv=$('#fx-walker'),c=cv.getContext('2d');
  const W=kind==='walk'?14:kind==='cart'?30:30;cv.width=W;cv.height=21;cv.style.width=(W*4)+'px';cv.style.height='84px';
  c.clearRect(0,0,W,21);c.imageSmoothingEnabled=false;
  if(kind==='walk'||kind==='time'||kind==='house'){drawPerson(c,7,20,{frame:0,cloth:'#1e2d4a',cloth2:'#e8dcc4',gold:true,abacus:true,hair:myAge()>=55?'#c8c8c8':'#1a1612'});
    cv.dataset.bob='1';}
  else if(kind==='cart'){
    R_(c,8,10,18,6,'#8a5f34');R_(c,8,8,18,2,'#a97a48');R_(c,10,6,14,2,'#d7b36a');R_(c,9,16,5,5,'#3a2a1a');R_(c,20,16,5,5,'#3a2a1a');R_(c,11,18,1,1,'#d8c8a0');R_(c,22,18,1,1,'#d8c8a0');
    drawPerson(c,4,20,{frame:0,cloth:'#7a5a3a',cloth2:'#e8dcc4',hat:'#c9a35a'});
  }else if(kind==='boat'){
    R_(c,3,14,24,4,'#6b4a2a');R_(c,5,18,20,2,'#4a3320');R_(c,14,2,1,12,'#3a2a1a');R_(c,15,3,9,9,'#f4ece1');R_(c,15,3,9,1,'#d0c8b4');R_(c,2,20,26,1,'#4aa0d8');
  }
}
/* kind: walk 前往處所｜cart 出貨｜boat 船隊｜time 時節流轉 */
/** 播放全螢幕轉場動畫，結束後呼叫 done。kind：walk/cart/boat/time。 */
function playFx(kind,cap,sub,done,ms){
  if(FX.busy){done&&done();return}
  FX.busy=true;ms=ms||1150;
  const fx=$('#fx');fx.classList.add('on');fx.style.setProperty('--dur',(ms/1000)+'s');
  const town=$('#fx-town');town.style.backgroundImage='url('+IMG_STREET+')';
  town.style.animation='none';void town.offsetWidth;town.style.animation='';
  const cv=$('#fx-walker');cv.style.animation='none';void cv.offsetWidth;cv.style.animation='';
  fxSprite(kind);
  $('#fx-cap').innerHTML=esc(cap)+(sub?'<small>'+esc(sub)+'</small>':'');
  let t=0;const iv=setInterval(()=>{t++;sfx.step()},190);
  const fin=()=>{clearInterval(iv);clearTimeout(FX.timer);fx.classList.remove('on');FX.busy=false;fx.onclick=null;done&&done()};
  fx.onclick=fin;FX.timer=setTimeout(fin,ms);
}
/* 金幣飛向白銀 */
/** 金幣飛舞效果。 */
function coinFx(from){
  try{
    const dst=$('#d-silver').getBoundingClientRect();
    for(let i=0;i<5;i++){
      const el=document.createElement('div');el.className='coin';el.textContent='🪙';
      const sx=from?from.left+from.width/2:innerWidth/2,sy=from?from.top:innerHeight/2;
      el.style.left=sx+'px';el.style.top=sy+'px';
      el.style.setProperty('--dx',(dst.left+dst.width/2-sx+(i-2)*6)+'px');el.style.setProperty('--dy',(dst.top-sy)+'px');
      el.style.animationDelay=(i*70)+'ms';document.body.appendChild(el);setTimeout(()=>el.remove(),1300);
    }
  }catch(e){}
}

/* ---------- 拜訪小視窗：主角帶著禮物走到對方家門前 ---------- */
/** 拜訪動畫狀態。 */
const VIS={busy:false};
/** 各禮物的包裝顏色。 */
const GIFT_COL={gold:'#e5a93b',art:'#b04a3a',antique:'#6a4a8a',wine:'#d8d0b0',geisha:'#e07a9a',charm:'#c0392b',toy:'#4a9bd0',safe:'#6b4a2a',alms:'#e8dcc4',wife:'#d96a8a',grudge:'#444',fame:'#c9a35a',gamble:'#2f7d4f',none:'#c9b89a'};
/** 依對方身分（官員/商人/名伶）決定拜訪動畫中主人的外觀。 */
function hostLook(cid){
  const c=cid&&CH(cid),n=cid&&npc(cid);
  if(c&&c.gender==='女')return {cloth:'#c46a8a',cloth2:'#e0b030',woman:true};
  if(n&&n.pos)return {cloth:'#4a2f6a',cloth2:'#e5a93b',hat:'#1a1612'};
  if(n&&n.role==='smuggler')return {cloth:'#3a4a3a',cloth2:'#8a8a98'};
  return {cloth:'#7a5a3a',cloth2:'#e8dcc4',abacus:true};
}
/** 繪製拜訪動畫的某一幀（走近、敲門、開門/拒見/不在家）。 */
function drawVisitScene(c,t,o){
  const sea=season(),p=PAL[sea];
  const g=c.createLinearGradient(0,0,0,80);g.addColorStop(0,p.sky[0]);g.addColorStop(1,p.sky[1]);c.fillStyle=g;c.fillRect(0,0,256,128);
  c.fillStyle=p.hill;c.beginPath();c.moveTo(0,70);c.lineTo(50,46);c.lineTo(100,68);c.lineTo(160,42);c.lineTo(256,66);c.lineTo(256,90);c.lineTo(0,90);c.fill();
  R_(c,0,88,256,40,sea==='冬'?'#cdbf9e':'#c2a572');R_(c,0,86,256,4,p.grass);
  // 背景町家
  [[6,50,52],[66,56,44]].forEach(([x,y,w])=>{R_(c,x,y,w,36,'#8a7a62');R_(c,x-3,y-6,w+6,8,'#2c3552');R_(c,x+6,y+14,w-12,18,'#5a4a3a')});
  // 目標住宅
  const hx=148,hy=34,shake=(t>1700&&t<2300)?(Math.floor(t/60)%2?1:-1):0;
  R_(c,hx-6,hy,104,12,'#232a40');R_(c,hx,hy-6,92,6,'#2c3552');R_(c,hx+10,hy-11,72,5,'#232a40');
  R_(c,hx,hy+12,92,52,'#d9c9a6');R_(c,hx,hy+60,92,4,'#2a2420');
  R_(c,hx+6,hy+18,24,16,'#4a3a2a');for(let k=0;k<5;k++)R_(c,hx+8+k*5,hy+18,1,16,'#d9c9a6');
  R_(c,hx+62,hy+18,24,16,'#4a3a2a');for(let k=0;k<5;k++)R_(c,hx+64+k*5,hy+18,1,16,'#d9c9a6');
  // 門
  const open=t>2300&&o.outcome==='ok',dx=hx+34+shake;
  R_(c,dx,hy+30,24,34,open?'#1a1208':'#5a3a22');
  if(!open){R_(c,dx+11,hy+30,2,34,'#2a1a10');R_(c,dx+8,hy+46,2,3,'#e5a93b');R_(c,dx+14,hy+46,2,3,'#e5a93b')}
  R_(c,dx-3,hy+27,30,4,'#1e2d4a');
  // 燈籠
  R_(c,hx-4,hy+34,5,8,'#b4442e');R_(c,hx+91,hy+34,5,8,'#b4442e');
  if(o.outcome==='absent'&&t>2300){R_(c,dx+6,hy+36,12,8,'#f4ece1');R_(c,dx+8,hy+39,8,1,'#1a1612');R_(c,dx+8,hy+41,6,1,'#1a1612')}
  // 路面
  R_(c,0,104,256,3,'#b0a590');
  // 主角
  const walkEnd=1700,px=t<walkEnd?-8+(t/walkEnd)*132:124,fr=Math.floor(t/150);
  const py=108+(t<walkEnd?Math.sin(t/110):0);
  drawPerson(c,px,py+14,{frame:t<walkEnd?fr:0,cloth:'#1e2d4a',cloth2:'#e8dcc4',gold:true,hair:myAge()>=55?'#c8c8c8':'#1a1612'});
  // 禮盒
  let bx=px+5,by=py+2;
  if(t>2300&&o.outcome==='ok'&&o.gift!=='none'){const k=Math.min(1,(t-2700)/500);bx=px+5+k*(dx+10-px-5);by=py+2-Math.sin(k*3.14)*4}
  if(!(t>2300&&o.outcome!=='ok')||true){const gc=GIFT_COL[o.gift]||GIFT_COL.none;R_(c,bx,by,8,6,gc);R_(c,bx+3,by,2,6,'#9b2c3a');R_(c,bx,by+2,8,1,'#9b2c3a')}
  // 應門者
  if(t>2300){
    if(o.outcome==='ok'){const k=Math.min(1,(t-2300)/400);drawPerson(c,dx+12,hy+62,Object.assign({frame:0},hostLook(o.cid)))}
    else if(o.outcome==='refuse'){R_(c,dx+22,hy+44,0,0,'#000');drawPerson(c,dx+30,hy+66,{frame:0,cloth:'#7a8a9a',cloth2:'#e8dcc4',small:true,noKnot:true})}
  }
  if(t>1700&&t<2300){c.fillStyle='#fff';R_(c,px+10,py-14,28,9,'#fffdf5');R_(c,px+10,py-14,28,1,'#1a1612');R_(c,px+10,py-6,28,1,'#1a1612');R_(c,px+10,py-14,1,9,'#1a1612');R_(c,px+37,py-14,1,9,'#1a1612');
    c.fillStyle='#1a1612';c.font='8px DotGothic16,monospace';c.textBaseline='top';c.fillText('咚咚咚',px+12,py-13)}
}
/** 【所有人際往來的動畫入口】在畫面中央開小視窗，依 o.outcome（ok/refuse/absent）演出；演完呼叫 done 執行實際結算。點一下可跳過。 */
function visitFx(o,done){
  if(VIS.busy){done&&done();return}
  VIS.busy=true;o=Object.assign({outcome:'ok',gift:'none'},o);
  const box=$('#visit'),cv=$('#visit-cv'),c=cv.getContext('2d');c.imageSmoothingEnabled=false;
  const nm=o.cid&&CH(o.cid)?CH(o.cid).name:'對方';
  $('#visit-title').textContent='🎁 前往拜訪「'+nm+'」';
  box.classList.add('on');
  const T0=performance.now();let T=T0,raf,fin=false,lastPh=-1;
  const END=o.outcome==='ok'?3700:3300;
  const caps=[`${G.me.given}帶著${o.gift==='none'?'一點心意':'禮物'}，登門拜訪……`,'咚咚咚……敲門。',
    o.outcome==='ok'?TX('visit.ok'):o.outcome==='refuse'?TX('visit.refuse'):TX('visit.absent')];
  const finish=()=>{if(fin)return;fin=true;cancelAnimationFrame(raf);box.classList.remove('on');box.onclick=null;VIS.busy=false;done&&done()};
  const frame=now=>{
    const t=now-T;
    drawVisitScene(c,t,o);
    const ph=t<1700?0:t<2300?1:2;
    if(ph!==lastPh){lastPh=ph;$('#visit-cap').textContent=caps[ph];if(ph===1)sfx.step();if(ph===2){o.outcome==='ok'?sfx.fanfare():sfx.bad()}}
    if(t>=END)return finish();
    raf=requestAnimationFrame(frame);
  };
  box.onclick=()=>{const t=performance.now()-T;if(t<2300)T=performance.now()-2300;else finish()};
  raf=requestAnimationFrame(frame);
}
