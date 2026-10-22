'use strict';
/* ★檔案總覽：像素場景與動畫
 * - 家宅畫布（320×180）：drawScene 每幀繪製；SCENE.ents 為角色：每種職位、夫人、側室、子女各畫一人（不畫主角），點選時從同類隨機挑一名聊天。
 * - playFx：全螢幕轉場（走路/馬車/船/時節流轉）。coinFx：金幣飛舞。
 * - visitFx：置中小視窗的情境化拜訪動畫（投帖／交禮／締約／暗盤），所有「與人往來」都會呼叫。 */
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
  const lean=Math.round((o.bow||0)*3*(o.faceLeft?-1:1)),ux=x+lean;
  R_(c,x-W/2-1,y-1,W+2,2,'#0003');                              // 影
  const legY=y-Math.round(4*s);
  const l1=f%2?1:0;
  R_(c,x-2,legY-l1,2,Math.round(4*s)+l1,o.pants||'#2b2a3a');
  R_(c,x,legY-(1-l1),2,Math.round(4*s)+(1-l1),o.pants||'#2b2a3a');
  const bodyH=Math.round(6*s),bodyY=legY-bodyH;
  R_(c,ux-W/2,bodyY,W,bodyH,o.cloth);
  if(o.cloth2)R_(c,ux-W/2,bodyY+Math.round(bodyH/2),W,2,o.cloth2);
  if(o.woman)R_(c,ux-W/2,bodyY+2,W,1,o.cloth2||'#e0b030');
  const hy=bodyY-Math.round(5*s);
  R_(c,ux-2,hy,4,Math.round(5*s),'#f1c9a0');                     // 臉
  R_(c,ux-2,hy,4,2,o.hair||'#1a1612');                            // 髮
  if(o.woman){R_(c,ux-3,hy-1,6,2,'#1a1612');R_(c,ux+2,hy,1,3,'#e0b030')}
  else if(!o.small&&!o.noKnot)R_(c,ux-1,hy-1,2,1,o.hair||'#1a1612');
  if(o.hat)R_(c,ux-3,hy-1,6,2,o.hat);
  if(o.sword){R_(c,ux+W/2,bodyY+2,1,6,'#d8d8d8');R_(c,ux+W/2,bodyY+7,1,1,'#7a5a2a')}
  if(o.abacus)R_(c,ux+W/2,bodyY+3,3,2,'#6b4a2a');
  if(o.gold)R_(c,ux-1,hy-3,2,1,'#e5a93b');
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
  /* 每種職位、每類家人只畫一人（不畫主角）；點選時才從同類中隨機挑一名（見 sceneMember） */
  [...RANKS,...SPECIAL].forEach((rk,i)=>{if(!G.emps.some(e=>e.rank===rk))return;const x={rank:rk,label:'【'+rk+'】',patrol:i,group:'emp'};if(rk==='保鏢')x.spd=16;keep('emp','rank_'+rk,x)});
  if(G.family.spouse)keep('wife','wife',{label:'夫人：'+G.family.spouse.name,spd:6,group:'wife'});
  if((G.family.conc||[]).length)keep('wife','conc',{label:'側室',spd:6,group:'conc'});
  if(G.family.kids.length){const k=G.family.kids[0],a=kidAge(k);keep('kid','kids',{label:'子女：'+k.name+'（'+kidStage(a)+'）',spd:14,age:a,girl:k.gender==='女',group:'kid'})}
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
    case 'kid':return {cloth:e.girl?'#e07a9a':'#5a9bd0',cloth2:'#f4ece1',small:true,woman:false,noKnot:true};
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
    if(best){sfx.tap();const m=sceneMember(best);if(m)openChat(m)}
    else if(x>=8&&x<=118&&y>=26&&y<=100){sfx.tap();UI.go('estate')}
    else if(x>=126&&y>=40&&y<=116){sfx.tap();UI.openSheet('warehouse')}
  });
}
/** 點到場景中的代表人物：從同一類（同職位的員工、側室、子女）隨機挑一名，回傳聊天用的角色資料。 */
function sceneMember(ent){
  if(ent.group==='emp'){const L=G.emps.filter(e=>e.rank===ent.rank);if(!L.length)return null;const e=pick(L);return {kind:'emp',id:'emp_'+e.id,label:'【'+e.rank+'】'+e.name}}
  if(ent.group==='conc'){const L=G.family.conc||[];if(!L.length)return null;const x=pick(L);return {kind:'wife',id:'conc_'+x.cid,label:'側室：'+x.name}}
  if(ent.group==='kid'){const L=G.family.kids;if(!L.length)return null;const k=pick(L);return {kind:'kid',id:'kid_'+k.id,label:'子女：'+k.name+'（'+kidStage(kidAge(k))+'）'}}
  if(ent.group==='wife')return {kind:'wife',id:'wife',label:ent.label};
  return null;
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
/* 金幣飛向現款 */
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

/* ---------- 拜訪小視窗：依往來目的演出登門、商談或隱密交易 ---------- */
/** 拜訪動畫狀態。 */
const VIS={busy:false};
const VIS_TIME={approach:1050,bow:1450,knock:2050,response:2500,exchange:3250,end:3700,failEnd:3100};
const VIS_TITLE={meet:'📜 登門投帖',gift:'🎁 備禮拜訪',favor:'📜 登門請託',contract:'🖋️ 商談契約',marry:'💍 託媒說親',secret:'🏴‍☠️ 後門交易'};
const VIS_DEFAULT_PROP={meet:'letter',gift:'letter',favor:'petition',contract:'contract',marry:'marriage',secret:'crate'};
const GIFT_COL={gold:'#e5a93b',art:'#b04a3a',antique:'#6a4a8a',wine:'#d8d0b0',geisha:'#e07a9a',charm:'#c0392b',toy:'#4a9bd0',safe:'#6b4a2a',alms:'#e8dcc4',wife:'#d96a8a',grudge:'#444',fame:'#c9a35a',gamble:'#2f7d4f',none:'#c9b89a'};
const vis01=v=>clamp(v,0,1);
const visEase=v=>{v=vis01(v);return v*v*(3-2*v)};
const visBow=(t,a,b)=>t<a||t>b?0:Math.sin((t-a)/(b-a)*Math.PI);
/** 依用途決定標題、道具與字幕；舊呼叫只傳 gift 時仍可相容。 */
function visitSetup(o){
  o=Object.assign({outcome:'ok',kind:'gift',gift:'none',prop:null,actor:'player'},o);
  if(!VIS_TITLE[o.kind])o.kind='gift';
  if(!o.prop)o.prop=o.gift&&o.gift!=='none'?o.gift:VIS_DEFAULT_PROP[o.kind];
  return o;
}
function visitPropName(o){
  if(o.propName)return o.propName;
  const fixed={letter:'名帖',petition:'請託文書',contract:'契約',gold:'銀兩',marriage:'婚書與聘禮',crate:'貨箱'};
  return fixed[o.prop]||(typeof GIFT_MAP!=='undefined'&&GIFT_MAP[o.prop]?GIFT_MAP[o.prop].name:'禮物');
}
function visitCaptions(o){
  const nm=o.cid&&CH(o.cid)?CH(o.cid).name:'對方',prop=visitPropName(o);
  const intro=(o.actor==='apprentice'?'丁稚':'你')+'拿著'+prop+'前往拜訪'+nm+'……';
  let result;
  if(o.outcome==='absent')result='結果：'+nm+'不在。';
  else if(o.outcome==='refuse')result='結果：'+nm+'拒絕接見。';
  else result='結果：'+({meet:nm+'收下名帖。',gift:nm+'收下禮物。',favor:nm+'收下'+prop+'。',contract:nm+'接受商談。',marry:nm+'收下婚書與聘禮。',secret:'接頭人收下貨箱。'}[o.kind]);
  return [intro,intro,intro,result,result,result];
}
/** 畫名帖、金封、實體禮物、契約與密貨木箱。x/y 為道具左上角。 */
function drawVisitProp(c,x,y,k){
  x=Math.round(x);y=Math.round(y);if(!k||k==='none')return;
  if(k==='letter'||k==='petition'){R_(c,x,y,10,7,'#f7efd8');R_(c,x,y,10,1,'#6b4a2a');R_(c,x+7,y+4,2,2,'#9b2c3a');R_(c,x+2,y+2,5,1,'#756653');return}
  if(k==='contract'){R_(c,x+1,y,8,8,'#f5e8c9');R_(c,x,y,1,8,'#6b4a2a');R_(c,x+9,y,1,8,'#6b4a2a');R_(c,x+3,y+2,4,1,'#756653');R_(c,x+3,y+5,4,1,'#756653');return}
  if(k==='gold'){R_(c,x,y+1,10,6,'#a52f38');R_(c,x+1,y,8,1,'#f0d06b');R_(c,x+4,y+2,2,2,'#e5a93b');return}
  if(k==='art'){R_(c,x+2,y,6,9,'#e8dcc4');R_(c,x,y,10,1,'#6b4a2a');R_(c,x,y+9,10,1,'#6b4a2a');R_(c,x+4,y+2,2,5,'#436b50');return}
  if(k==='antique'){R_(c,x+3,y,4,2,'#6a4a8a');R_(c,x+1,y+2,8,5,'#8d67a8');R_(c,x+2,y+7,6,2,'#5a3a72');return}
  if(k==='wine'){R_(c,x+3,y,4,2,'#6b4a2a');R_(c,x+1,y+2,8,7,'#d8d0b0');R_(c,x+3,y+4,4,3,'#9b2c3a');return}
  if(k==='geisha'){R_(c,x+1,y+6,8,1,'#6b4a2a');for(let i=0;i<5;i++)R_(c,x+4+i,y+1+i,1,6-i,'#e07a9a');return}
  if(k==='charm'){R_(c,x+4,y,2,2,'#d6b24a');R_(c,x+2,y+2,6,7,'#c0392b');R_(c,x+4,y+4,2,3,'#f4ece1');return}
  if(k==='toy'){R_(c,x+2,y+1,6,7,'#4a9bd0');R_(c,x+3,y,4,2,'#f1c9a0');R_(c,x+1,y+8,8,1,'#b04a3a');return}
  if(k==='safe'){R_(c,x+1,y+1,8,7,'#d8c08a');R_(c,x+3,y+2,4,4,'#6b4a2a');R_(c,x,y+8,10,1,'#6b4a2a');return}
  if(k==='alms'){R_(c,x+1,y+2,8,7,'#e8dcc4');R_(c,x+3,y,4,3,'#bcae91');R_(c,x+3,y+4,4,2,'#9b2c3a');return}
  if(k==='wife'||k==='marriage'){R_(c,x,y+1,10,7,'#f4ece1');R_(c,x+4,y,2,9,'#c23b4a');R_(c,x,y+4,10,2,'#c23b4a');return}
  if(k==='grudge'){R_(c,x+1,y,8,8,'#3f3a42');R_(c,x,y,1,8,'#9b2c3a');R_(c,x+9,y,1,8,'#9b2c3a');return}
  if(k==='fame'){R_(c,x,y,10,8,'#c9a35a');R_(c,x+1,y+1,8,6,'#5a3a22');R_(c,x+4,y+2,2,4,'#e5d6a1');return}
  if(k==='gamble'){R_(c,x+1,y,7,7,'#f4ece1');R_(c,x+3,y+2,1,1,'#1a1612');R_(c,x+5,y+4,1,1,'#1a1612');R_(c,x+2,y+7,7,2,'#2f7d4f');return}
  if(k==='crate'){R_(c,x,y,15,10,'#79502c');R_(c,x+2,y+2,11,6,'#9b6c3b');R_(c,x+6,y,2,10,'#4b301b');R_(c,x,y+4,15,2,'#4b301b');return}
  const col=GIFT_COL[k]||GIFT_COL.none;R_(c,x,y+1,10,7,col);R_(c,x+4,y,2,8,'#9b2c3a');R_(c,x,y+4,10,1,'#9b2c3a');
}
/** 依對方身分（官員/商人/名伶）決定拜訪動畫中主人的外觀。 */
function hostLook(cid){
  const c=cid&&CH(cid),n=cid&&npc(cid);
  if(c&&c.gender==='女')return {cloth:'#c46a8a',cloth2:'#e0b030',woman:true};
  if(n&&n.pos)return {cloth:'#4a2f6a',cloth2:'#e5a93b',hat:'#1a1612'};
  if(n&&n.role==='smuggler')return {cloth:'#3a4a3a',cloth2:'#8a8a98'};
  return {cloth:'#7a5a3a',cloth2:'#e8dcc4',abacus:true};
}
/** 繪製拜訪動畫：整衣投帖、應門、道具移交；隱密交易改為夜間後門。 */
function drawVisitScene(c,t,o){
  const sea=season(),p=PAL[sea],secret=o.kind==='secret',official=o.cid&&npc(o.cid)&&npc(o.cid).pos;
  const g=c.createLinearGradient(0,0,0,80);g.addColorStop(0,secret?'#10172b':p.sky[0]);g.addColorStop(1,secret?'#35405b':p.sky[1]);c.fillStyle=g;c.fillRect(0,0,256,128);
  if(secret){for(let i=0;i<16;i++)R_(c,(i*47)%250,8+(i*23)%42,1,1,'#f7e8aa');R_(c,220,12,9,9,'#e8dc9a')}
  c.fillStyle=p.hill;c.beginPath();c.moveTo(0,70);c.lineTo(50,46);c.lineTo(100,68);c.lineTo(160,42);c.lineTo(256,66);c.lineTo(256,90);c.lineTo(0,90);c.fill();
  if(secret){c.fillStyle='#11182755';c.fillRect(0,38,256,54)}
  R_(c,0,88,256,40,sea==='冬'?'#cdbf9e':secret?'#6e6758':'#c2a572');R_(c,0,86,256,4,secret?'#334634':p.grass);
  // 背景町家
  [[6,50,52],[66,56,44]].forEach(([x,y,w])=>{R_(c,x,y,w,36,secret?'#4a443e':'#8a7a62');R_(c,x-3,y-6,w+6,8,'#2c3552');R_(c,x+6,y+14,w-12,18,secret?'#25221f':'#5a4a3a')});
  // 目標住宅
  const hx=148,hy=34,knocking=t>VIS_TIME.bow&&t<VIS_TIME.knock,shake=knocking?(Math.floor(t/60)%2?1:-1):0;
  R_(c,hx-6,hy,104,12,'#232a40');R_(c,hx,hy-6,92,6,'#2c3552');R_(c,hx+10,hy-11,72,5,'#232a40');
  R_(c,hx,hy+12,92,52,secret?'#857a68':'#d9c9a6');R_(c,hx,hy+60,92,4,'#2a2420');
  R_(c,hx+6,hy+18,24,16,'#4a3a2a');for(let k=0;k<5;k++)R_(c,hx+8+k*5,hy+18,1,16,'#d9c9a6');
  R_(c,hx+62,hy+18,24,16,'#4a3a2a');for(let k=0;k<5;k++)R_(c,hx+64+k*5,hy+18,1,16,'#d9c9a6');
  // 門
  const open=t>VIS_TIME.knock&&o.outcome==='ok',dx=hx+34+shake;
  R_(c,dx,hy+30,24,34,open?'#1a1208':'#5a3a22');
  if(!open){R_(c,dx+11,hy+30,2,34,'#2a1a10');R_(c,dx+8,hy+46,2,3,'#e5a93b');R_(c,dx+14,hy+46,2,3,'#e5a93b')}
  R_(c,dx-3,hy+27,30,4,secret?'#34213e':'#1e2d4a');
  if(official){R_(c,hx+40,hy+14,12,9,'#efe2bd');R_(c,hx+45,hy+16,2,5,'#5b2d39')}
  // 燈籠
  R_(c,hx-4,hy+34,5,8,secret?'#e08b32':'#b4442e');R_(c,hx+91,hy+34,5,8,secret?'#e08b32':'#b4442e');
  if(secret){c.fillStyle='#ffb03a22';c.beginPath();c.arc(hx-2,hy+38,14,0,6.3);c.fill()}
  if(o.outcome==='absent'&&t>VIS_TIME.knock){R_(c,dx+6,hy+36,12,8,'#f4ece1');R_(c,dx+8,hy+39,8,1,'#1a1612');R_(c,dx+8,hy+41,6,1,'#1a1612')}
  // 路面
  R_(c,0,104,256,3,'#b0a590');
  // 來客：丁稚代跑時換成店童；投帖前先停步整衣行禮
  const walk=visEase(t/VIS_TIME.approach),px=-8+walk*126,py=122+(t<VIS_TIME.approach?Math.sin(t/110):0),fr=Math.floor(t/150);
  const bow=visBow(t,VIS_TIME.approach,VIS_TIME.bow)+visBow(t,VIS_TIME.exchange,VIS_TIME.end);
  const actor=o.actor==='apprentice'?Object.assign({},RANK_LOOK['丁稚'],{noKnot:true}):{cloth:'#1e2d4a',cloth2:'#e8dcc4',gold:true,hair:myAge()>=55?'#c8c8c8':'#1a1612'};
  drawPerson(c,px,py,Object.assign({frame:t<VIS_TIME.approach?fr:0,bow},actor));
  // 應門者會從門內走到來客面前，拒見則只由門房回話
  let hostX=dx+12,hostY=hy+62;
  if(t>VIS_TIME.knock){
    if(o.outcome==='ok'){
      const ap=visEase((t-VIS_TIME.knock)/(VIS_TIME.response-VIS_TIME.knock));hostX=dx+12-ap*34;hostY=hy+62+ap*23;
      const hb=visBow(t,VIS_TIME.response-260,VIS_TIME.response+180)+visBow(t,VIS_TIME.exchange,VIS_TIME.end);
      drawPerson(c,hostX,hostY,Object.assign({frame:ap<1?Math.floor(t/150):0,bow:hb,faceLeft:true},hostLook(o.cid)));
    }
    else if(o.outcome==='refuse'){R_(c,dx+22,hy+44,0,0,'#000');drawPerson(c,dx+30,hy+66,{frame:0,cloth:'#7a8a9a',cloth2:'#e8dcc4',small:true,noKnot:true})}
  }
  // 道具始終由來客拿穩；成功時水平移到對方身前，失敗則原樣帶回
  let bx=px+5,by=py-13;
  if(o.outcome==='ok'&&t>VIS_TIME.response){
    const hand=visEase((t-VIS_TIME.response)/(VIS_TIME.exchange-VIS_TIME.response));
    let tx=hostX-10,ty=hostY-22;
    if(o.kind==='contract'||o.kind==='marry'){
      R_(c,133,110,24,3,'#6b4327');R_(c,136,113,3,5,'#49301e');R_(c,151,113,3,5,'#49301e');
      tx=140;ty=101;
    }else if(o.kind==='secret'){
      R_(c,134,116,27,2,'#2b241f');tx=140;ty=106;
    }else{tx=hostX-8;ty=hostY-12}
    bx=(px+5)+(tx-(px+5))*hand;by=(py-13)+(ty-(py-13))*hand;
  }
  drawVisitProp(c,bx,by,o.prop);
  if(knocking){R_(c,px+10,py-29,32,9,'#fffdf5');R_(c,px+10,py-29,32,1,'#1a1612');R_(c,px+10,py-21,32,1,'#1a1612');R_(c,px+10,py-29,1,9,'#1a1612');R_(c,px+41,py-29,1,9,'#1a1612');
    c.fillStyle='#1a1612';c.font='8px DotGothic16,monospace';c.textBaseline='top';c.fillText(secret?'叩、叩……':'咚咚咚',px+12,py-28)}
}
/** 【所有人際往來的動畫入口】kind 決定情境、prop 決定道具；點一下立即完成並結算。 */
function visitFx(o,done){
  if(VIS.busy){done&&done();return}
  VIS.busy=true;o=visitSetup(o);
  const box=$('#visit'),cv=$('#visit-cv'),c=cv.getContext('2d');c.imageSmoothingEnabled=false;
  const nm=o.cid&&CH(o.cid)?CH(o.cid).name:'對方';
  $('#visit-title').textContent=(VIS_TITLE[o.kind]||VIS_TITLE.gift)+'「'+nm+'」';
  box.classList.add('on');
  const T=performance.now();let raf,fin=false,lastPh=-1;
  const END=o.outcome==='ok'?VIS_TIME.end:VIS_TIME.failEnd,caps=visitCaptions(o);
  const finish=()=>{if(fin)return;fin=true;cancelAnimationFrame(raf);box.classList.remove('on');box.onclick=null;VIS.busy=false;done&&done()};
  const frame=now=>{
    const t=now-T;
    drawVisitScene(c,t,o);
    const ph=t<VIS_TIME.approach?0:t<VIS_TIME.bow?1:t<VIS_TIME.knock?2:t<VIS_TIME.response?3:t<VIS_TIME.exchange?4:5;
    if(ph!==lastPh){lastPh=ph;$('#visit-cap').textContent=caps[ph];if(ph===2)sfx.step();if(ph===3&&o.outcome!=='ok')sfx.bad();if(ph===4&&o.outcome==='ok')sfx.gift()}
    if(t>=END)return finish();
    raf=requestAnimationFrame(frame);
  };
  box.onclick=finish;
  raf=requestAnimationFrame(frame);
}
