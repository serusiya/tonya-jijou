/* ═════ [05_scene] ═════ */
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
  spring:{sky:['#9fd0ee','#e9f2f4'],hill:'#7fa58a',grass:'#78b55a',canopy:'#f3a6c0',leaf:'#f7c6d8'},
  summer:{sky:['#5fb6e8','#cfeaf6'],hill:'#4f8a5f',grass:'#4d9e48',canopy:'#3f8f4a',leaf:'#79c26b'},
  autumn:{sky:['#e6b57e','#f6e2c2'],hill:'#9c7a52',grass:'#a8a24e',canopy:'#d9782e',leaf:'#e8a04a'},
  winter:{sky:['#b9c6d6','#e9eef3'],hill:'#9aa7b5',grass:'#dfe7ee',canopy:'#6b5a4a',leaf:'#ffffff'}
};
/** 畫實心矩形（像素取整）。 */
function R_(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}

/* ---------- 小人繪製（自然剪影與豐富動作） ---------- */
/** 調整十六進位色碼明暗。 */
function personShade(col,amt){
  if(!/^#[0-9a-f]{6}$/i.test(col||''))return col;
  const n=parseInt(col.slice(1),16),v=s=>Math.max(0,Math.min(255,s+amt));
  return '#'+[v(n>>16),v((n>>8)&255),v(n&255)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
/** 畫一個像素人物（圓弧剪影、寬袖擺手、彎腰弧線與多種日常/情境動作）。 */
function drawPerson(c,x,y,o){
  o=o||{};
  const f=(o.frame||0)%4,s=o.small?0.78:1,dir=o.faceLeft?-1:1,v=o.variant||0;
  const S=n=>Math.max(1,Math.round(n*s)),skin=o.skin||['#f1c9a0','#e8bb91','#dca980'][v%3];
  const ink='#201b1a',cloth=o.cloth||'#6d5744',clothD=personShade(cloth,-32),cloth2=o.cloth2||'#e8dcc4';
  const hair=o.hair||['#1a1612','#30231d','#40342e'][v%3],pants=o.pants||clothD;
  const obi=o.obi||['#b76545','#c39a3d','#4f7c72','#765c91','#9a5365','#6b7394'][v%6];
  const pose=o.pose||'',pt=o.pt||0,sit=!!o.sit;
  const pTick=Math.floor(pt/220)%2,breathe=(!o.moving&&!o.bow&&!sit&&Math.floor(pt/700)%2)?1:0;
  const jump=(pose==='hop'&&Math.floor(pt/160)%2)?S(2):0;
  x=Math.round(x);y=Math.round(y)-jump;

  // 行禮分段偏移：腰微動、胸前傾、頭前伸並下壓，形成自然彎腰弧線而非平移方塊
  const bowAmt=o.bow||0;
  const bob=(bowAmt||sit)?0:(o.moving&&(f===1||f===3)?-1:0);
  const waistX=x+Math.round(bowAmt*S(1)*dir);
  const chestX=x+Math.round(bowAmt*S(2.5)*dir);
  const headLean=Math.round(bowAmt*S(4)*dir),headDrop=Math.round(bowAmt*S(2))+(pose==='sigh'?S(1):0);
  const stride=o.moving?[-1,0,1,0][f]:0;

  // 1. 腳底陰影與雙腿（跪坐時收起小腿）
  R_(c,x-S(5),y-1+jump,S(10),2,'#0004');
  const footY=y-S(2),legTop=sit?(y-S(4)):(y-S(6)+bob);
  if(sit){
    // 正坐（跪坐）下擺與足袋
    R_(c,waistX-S(4),y-S(4),S(8),S(3),ink);
    R_(c,waistX-S(3),y-S(4),S(6),S(3),clothD);
    R_(c,waistX-dir*S(3),y-S(2),S(2),S(1),'#f4ece1');
  }else{
    [-1,1].forEach((side,i)=>{
      const step=(i===0?stride:-stride),lift=step>0?S(1):0;
      const spread=(pose==='guard')?side*S(2.5):side*S(1.8);
      const fx=Math.round(x+spread+step*dir);
      R_(c,fx-S(1),legTop-lift,S(2),S(4)+lift,ink);
      R_(c,fx-S(1),legTop-lift,S(2),S(3)+lift,pants);
      R_(c,fx-S(1),footY-lift,S(3),S(1),'#4a3525');
    });
  }

  // 2. 軀幹：打破單一矩形，分為溜肩(窄)、中段含袖(寬)、下擺(收)的自然輪廓
  const bh=sit?S(7):S(8),bodyY=legTop-bh+breathe+(pose==='guard'?1:0);
  // 描邊底層（倒角剪影，肩膀不畫死直角）
  R_(c,chestX-S(2)-1,bodyY,S(4)+2,S(2),ink);
  R_(c,chestX-S(3)-1,bodyY+S(1),S(6)+2,bh-S(2),ink);
  R_(c,waistX-S(3),bodyY+bh-S(1),S(6),S(2),ink);
  // 衣服本體與交領(cloth2)
  R_(c,chestX-S(2),bodyY,S(4),S(2),cloth);
  R_(c,chestX-S(3),bodyY+S(1),S(6),bh-S(2),cloth);
  R_(c,waistX-S(2),bodyY+bh-S(2),S(4),S(2),clothD);
  // 頸部縮口與V字衣領
  R_(c,chestX-S(1),bodyY-1,S(2),S(2),skin);
  R_(c,chestX+dir*S(1)-1,bodyY,S(2),S(2),cloth2);
  // 腰帶（Obi）
  const obiY=bodyY+bh-S(3);
  R_(c,waistX-S(3),obiY,S(6),S(2),obi);
  if(o.woman)R_(c,waistX-dir*S(4),obiY-S(1),S(2),S(3),obi); // 女性背後文庫結

  // 3. 江戶寬袖（袂）與手部擺動／情境姿勢
  const armSw=stride*dir;
  // 後手與袖
  const bx=chestX-dir*S(2)-armSw,by=bodyY+S(2);
  R_(c,bx-S(1),by,S(2),S(4),clothD);
  // 前手與袖（依動作變化位置）
  let fx=chestX+dir*S(1)+armSw,fy=bodyY+S(2),hx=fx+dir*S(1),hy=fy+S(3);
  if(bowAmt>0.2){
    fx=chestX+dir*S(1);fy=bodyY+S(3);hx=fx+dir*S(1);hy=fy+S(2);
  }else if(pose==='wipe'){
    fx=chestX+dir*S(2);fy=bodyY+S(1)-pTick;hx=chestX+dir*S(3);hy=bodyY-S(2)-pTick;
  }else if(pose==='knock'||pose==='wave'){
    fx=chestX+dir*S(2);fy=bodyY+S(1);hx=chestX+dir*S(4);hy=bodyY-pTick*S(2);
  }else if(pose==='hold'||pose==='abacus'){
    fx=chestX+dir*S(2);fy=bodyY+S(2);hx=chestX+dir*S(3);hy=bodyY+S(2)-(pose==='abacus'?pTick:0);
  }else if(pose==='hop'){
    fx=chestX+dir*S(2);fy=bodyY;hx=chestX+dir*S(3);hy=bodyY-S(2);
  }else if(pose==='guard'){
    fx=chestX+dir*S(1);fy=bodyY+S(2);hx=waistX+dir*S(2);hy=obiY;
  }
  R_(c,fx-S(1),fy,S(3),S(4),ink);
  R_(c,fx-S(1),fy,S(2),S(3),cloth);
  R_(c,hx,hy,S(2),S(2),skin);

  // 4. 頭部（削去四角呈現圓潤頭型）
  const headY=bodyY-S(6)+headDrop,headX=chestX+headLean;
  // 圓角頭描邊（中間寬、上下窄）
  R_(c,headX-S(3),headY-S(1),S(6),S(7),ink);
  R_(c,headX-S(4),headY,S(8),S(5),ink);
  // 臉部膚色與髮型
  R_(c,headX-S(3),headY,S(6),S(5),skin);
  R_(c,headX-S(3),headY-S(1),S(6),S(2),hair);
  R_(c,headX-dir*S(3),headY,S(2),S(4),hair); // 後腦勺髮際
  // 眼睛（嘆氣或深鞠躬時閉眼/低眉）
  const eyeY=headY+S(2)+(bowAmt>0.5||pose==='sigh'?1:0);
  R_(c,headX+dir*S(2),eyeY,S(1),S(1),'#2b211d');

  // 江戶髮髻細節
  if(o.woman){
    // 女性蓬鬢與髮髻、花簪
    R_(c,headX-S(4),headY,S(8),S(2),hair);
    R_(c,headX-dir*S(5),headY,S(2),S(3),hair);
    R_(c,headX-S(2),headY-S(3),S(4),S(2),hair);
    R_(c,headX-dir*S(4),headY-S(1),S(1),S(2),obi);
  }else if(!o.small&&!o.noKnot){
    // 男性月代頭與往前折的丁髷
    R_(c,headX+dir*S(1),headY-S(1),S(2),S(1),skin);
    R_(c,headX-dir*S(2),headY-S(3),S(3),S(2),hair);
    R_(c,headX-dir*S(1),headY-S(3),S(3),S(1),hair);
  }
  // 笠帽（金字塔階梯狀斗笠，取代原本平直方塊）
  if(o.hat){
    R_(c,headX-S(6),headY-S(1),S(12),S(1),ink);
    R_(c,headX-S(5),headY-S(2),S(10),S(2),o.hat);
    R_(c,headX-S(3),headY-S(3),S(6),S(1),o.hat);
  }

  // 5. 隨身配件（隨姿勢自然連動）
  if(o.sword){
    // 腰間斜插佩刀（從腰帶斜向身後）
    R_(c,waistX+dir*S(1),obiY,S(3),S(1),'#8a5a2a');
    R_(c,waistX-dir*S(2),obiY+S(1),S(4),S(1),'#c8c4bb');
    R_(c,waistX-dir*S(4),obiY+S(2),S(3),S(1),'#6b4426');
  }
  if(o.abacus){
    const ay=bodyY+S(3)-(pose==='abacus'?pTick:0);
    R_(c,chestX+dir*S(1),ay,S(4),S(3),ink);
    R_(c,chestX+dir*S(1)+1,ay+1,S(2),S(1),'#d8a448');
  }
  if(o.bundle){
    // 斜背風呂敷包袱
    R_(c,chestX-dir*S(4),bodyY+S(1),S(3),S(5),ink);
    R_(c,chestX-dir*S(4)+1,bodyY+S(2),S(2),S(3),o.bundle);
    R_(c,chestX-dir*S(1),bodyY+S(1),S(3),S(1),o.bundle);
  }
  if(o.gold)R_(c,headX-dir*S(1),headY-S(4),S(3),S(1),'#e5a93b');
}
/** 各職位外觀（含船長、飛腳）。新增職位時在此加外觀。 */
const RANK_LOOK={
  apprentice:{cloth:'#7087a0',cloth2:'#c8d4df',small:true},
  clerk:{cloth:'#755235',cloth2:'#e8dcc4',bundle:'#9a754a'},
  banto:{cloth:'#274b7a',cloth2:'#e8dcc4'},
  chief:{cloth:'#53306f',cloth2:'#e5a93b',abacus:true},
  captain:{cloth:'#1f6070',cloth2:'#e8dcc4',hat:'#20232a',sword:true},
  courier:{cloth:'#4f7a3a',cloth2:'#e8dcc4',hat:'#8a6a3a',bundle:'#9b6b3f'},
  guard:{cloth:'#30323a',cloth2:'#b3261e',hat:'#17191d',sword:true,pants:'#22242a'}
};

/* ---------- 背景元件 ---------- */
/** 畫倉（白壁黑瓦）。 */
function drawKuraLegacy(c,x,y,flag){                                // 倉（白壁黑瓦）
  R_(c,x,y,40,26,'#eee7d8');R_(c,x,y+20,40,6,'#2a2420');
  R_(c,x+13,y+8,14,18,'#3a2f2a');R_(c,x+19,y+8,2,18,'#1a1612');R_(c,x+19,y+14,2,2,'#e5a93b');
  for(let i=0;i<4;i++)R_(c,x+3+i*9,y+2,1,3,'#cfc7b4');
  R_(c,x-4,y-4,48,4,'#262022');R_(c,x-2,y-8,44,4,'#322a2c');R_(c,x+2,y-11,36,3,'#262022');
  for(let i=0;i<8;i++)R_(c,x-3+i*6,y-4,1,4,'#4a4044');
  if(flag){R_(c,x+34,y-18,1,8,'#6b4a2a');R_(c,x+27,y-18,7,4,'#9b2c3a')}
}
/** 畫民宅。 */
function drawKura(c,x,y,flag){
  const ink='#25211f',tile='#29323a',tileHi='#414d56',wall='#eee8d9',shade='#d1c8b5',stone='#716c65';
  // Stone footing and thick earthen walls.
  R_(c,x,y+23,40,4,stone);R_(c,x+3,y+27,34,2,'#514d49');
  for(let i=0;i<5;i++)R_(c,x+2+i*8,y+24+(i%2),6,1,'#969087');
  R_(c,x+1,y,38,23,ink);R_(c,x+3,y+1,34,21,wall);
  R_(c,x+3,y+15,34,7,shade);
  // Namako wall diamonds along the lower storey.
  for(let i=0;i<5;i++){
    const nx=x+4+i*7;R_(c,nx,y+16,1,6,'#f8f4e9');R_(c,nx+4,y+16,1,6,'#b7ae9d');
    R_(c,nx+1,y+18,3,1,'#f8f4e9');
  }
  // Heavy fireproof door and small barred window.
  R_(c,x+13,y+7,15,16,ink);R_(c,x+15,y+9,11,14,'#49372d');
  R_(c,x+20,y+9,2,14,'#211b18');R_(c,x+21,y+15,2,2,'#c89b43');
  R_(c,x+5,y+5,7,6,ink);R_(c,x+6,y+6,5,4,'#938c7f');
  R_(c,x+7,y+5,1,6,ink);R_(c,x+10,y+5,1,6,ink);
  // Deep double kawara roof, ridge tiles and curved end caps.
  R_(c,x-5,y-3,50,4,ink);R_(c,x-3,y-7,46,5,tile);R_(c,x+3,y-11,34,4,tile);
  R_(c,x-6,y-4,6,3,tile);R_(c,x+40,y-4,6,3,tile);
  for(let i=0;i<8;i++)R_(c,x-1+i*6,y-6,1,4,tileHi);
  R_(c,x+8,y-14,24,4,ink);R_(c,x+11,y-16,18,3,tile);
  R_(c,x+7,y-16,5,4,tile);R_(c,x+28,y-16,5,4,tile);
  if(season()==='winter'){
    R_(c,x-5,y-4,50,2,'#fff');R_(c,x-3,y-8,46,2,'#f7fbff');R_(c,x+11,y-17,18,2,'#fff');
  }
}
function drawHouseLegacy(c,x,y,t,sea){
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
  const nm=(G&&G.me?UT('scene.sign',{f:G.me.family}):UT('scene.shop'));c.fillText(nm,x+37+Math.max(0,(34-nm.length*9)/2),y+14);
  // 燈籠
  const glow=G&&G.cycle===3;
  [[x+2,y+36],[x+104,y+36]].forEach(([lx,ly])=>{R_(c,lx,ly,5,8,glow?'#ffb03a':'#b4442e');R_(c,lx+1,ly-2,3,2,'#1a1612');if(glow){c.fillStyle='#ffb03a33';c.beginPath();c.arc(lx+2.5,ly+4,11+Math.sin(t/300)*1,0,6.3);c.fill()}});
  if(sea==='winter'){R_(c,x-4,y+3,118,2,'#fff');R_(c,x,y-3,110,2,'#fff');R_(c,x+8,y-9,94,2,'#fff');R_(c,x+20,y-14,70,2,'#fff')}
}
/** 畫樹（隨季節變色）。 */
function drawHouse(c,x,y,t,sea){
  const wood='#4b3428',woodD='#2b211d',woodL='#72513a',plaster='#e7dfcd',tile='#26303a',tileHi='#3b4854';

  // Stone foundation and raised engawa.
  R_(c,x+3,y+58,104,4,'#746f68');R_(c,x+6,y+62,98,2,'#56524e');
  for(let i=0;i<9;i++)R_(c,x+7+i*12,y+59+(i%2),8,1,'#999289');
  R_(c,x+5,y+55,100,3,woodD);R_(c,x+8,y+54,94,2,woodL);

  // Ground-floor machiya frontage: heavy posts, noren entrance and koshi lattice.
  R_(c,x+4,y+31,102,24,wood);R_(c,x+7,y+34,29,21,woodD);
  R_(c,x+10,y+43,23,12,'#34271f');R_(c,x+9,y+34,25,9,'#263b50');
  for(let i=1;i<4;i++)R_(c,x+9+i*6,y+34,1,9,'#d4c8ae');
  R_(c,x+9,y+42,25,2,woodD);
  R_(c,x+40,y+34,61,20,'#171b1d');R_(c,x+42,y+36,57,16,'#b9aa8b');
  for(let i=0;i<11;i++)R_(c,x+42+i*6,y+35,2,19,wood);
  for(let i=0;i<4;i++)R_(c,x+41,y+37+i*5,59,1,woodD);
  R_(c,x+37,y+31,3,24,woodD);R_(c,x+101,y+31,4,24,woodD);

  // White-plaster upper storey with dark beams and mushiko-mado windows.
  R_(c,x+5,y+8,100,23,plaster);R_(c,x+5,y+8,100,3,woodD);R_(c,x+5,y+28,100,3,woodD);
  R_(c,x+8,y+11,3,17,wood);R_(c,x+99,y+11,3,17,wood);
  [[15,18],[39,18],[63,18],[87,10]].forEach(([dx,w])=>{
    R_(c,x+dx,y+14,w,10,woodD);R_(c,x+dx+2,y+16,w-4,6,'#b9b09d');
    for(let k=0;k<w-4;k+=4)R_(c,x+dx+2+k,y+15,1,8,wood);
  });

  // Deep kawara roof with upturned eaves, tile courses, ridge and onigawara caps.
  R_(c,x-7,y+2,120,4,woodD);R_(c,x-5,y-2,116,5,tile);
  R_(c,x+2,y-7,102,5,tile);R_(c,x+13,y-11,80,4,tile);
  R_(c,x-9,y,7,3,tile);R_(c,x+110,y,7,3,tile);
  for(let i=0;i<18;i++)R_(c,x-2+i*6,y-1,1,5,tileHi);
  for(let i=0;i<15;i++)R_(c,x+7+i*6,y-6,1,4,tileHi);
  R_(c,x+22,y-15,62,4,woodD);R_(c,x+26,y-17,54,3,tile);
  R_(c,x+20,y-17,6,5,tile);R_(c,x+80,y-17,6,5,tile);
  R_(c,x+22,y-18,2,2,'#171b1d');R_(c,x+82,y-18,2,2,'#171b1d');

  // Hanging shop plaque under the eaves.
  R_(c,x+36,y+11,38,14,woodD);R_(c,x+38,y+13,34,10,'#d9c69b');
  c.fillStyle='#211a16';c.font='9px DotGothic16,monospace';c.textBaseline='top';
  const nm=(G&&G.me?UT('scene.sign',{f:G.me.family}):UT('scene.shop'));c.fillText(nm,x+39+Math.max(0,(32-nm.length*9)/2),y+14);

  // Paired chochin lanterns, warm at night.
  const glow=G&&G.cycle===3;
  [[x+1,y+36],[x+105,y+36]].forEach(([lx,ly])=>{
    R_(c,lx+1,ly-3,3,3,woodD);R_(c,lx,ly,5,8,glow?'#ffb03a':'#bd5a3f');
    R_(c,lx,ly+3,5,1,'#7a2922');R_(c,lx+1,ly+8,3,2,woodD);
    if(glow){c.fillStyle='#ffb03a33';c.beginPath();c.arc(lx+2.5,ly+4,11+Math.sin(t/300),0,6.3);c.fill()}
  });
  if(sea==='winter'){
    R_(c,x-7,y+1,120,2,'#fff');R_(c,x-5,y-3,116,2,'#f7fbff');
    R_(c,x+2,y-8,102,2,'#fff');R_(c,x+13,y-12,80,2,'#fff');R_(c,x+26,y-18,54,2,'#fff');
  }
}
function drawTree(c,x,y,sea,t){
  const p=PAL[sea];R_(c,x-2,y-2,4,26,'#5a4030');
  if(sea==='winter'){R_(c,x-12,y-8,2,10,'#5a4030');R_(c,x+10,y-10,2,12,'#5a4030');R_(c,x-12,y-8,24,2,'#5a4030');R_(c,x-14,y-10,6,2,'#fff');R_(c,x+8,y-12,6,2,'#fff');return}
  const rows=[[ -9,-12,18],[-14,-8,28],[-16,-3,32],[-13,2,26],[-8,6,16]];
  rows.forEach(([dx,dy,w],i)=>R_(c,x+dx,y+dy,w,6,i%2?p.canopy:p.leaf));
}
/** 畫背景與遠景。 */
function drawFarCastle(c,sea){
  const wall='#dedbd0',shade='#beb9ac',roof='#303842',beam='#594a40';
  // Small distant keep in the right-hand valley; the hills are painted over its base.
  R_(c,263,72,28,8,'#85827b');R_(c,265,68,24,5,'#9c978d');
  R_(c,265,60,24,10,wall);R_(c,267,63,20,7,shade);R_(c,262,57,30,4,roof);
  R_(c,268,50,18,8,wall);R_(c,270,53,14,5,shade);R_(c,265,47,24,4,roof);
  R_(c,272,41,10,7,wall);R_(c,269,38,16,4,roof);
  R_(c,274,34,6,5,wall);R_(c,271,32,12,3,roof);
  R_(c,270,30,2,3,'#a9853d');R_(c,282,30,2,3,'#a9853d');
  R_(c,265,66,24,1,beam);R_(c,268,55,18,1,beam);R_(c,272,45,10,1,beam);
  [[269,63],[276,63],[283,63],[272,52],[279,52],[275,42]].forEach(([wx,wy])=>R_(c,wx,wy,2,1,'#41454a'));
  if(sea==='winter'){
    R_(c,262,56,30,1,'#fff');R_(c,265,46,24,1,'#fff');R_(c,269,37,16,1,'#fff');R_(c,271,31,12,1,'#fff');
  }
}
function drawBackdrop(c,t){
  const sea=season(),p=PAL[sea];
  const g=c.createLinearGradient(0,0,0,70);g.addColorStop(0,p.sky[0]);g.addColorStop(1,p.sky[1]);c.fillStyle=g;c.fillRect(0,0,320,100);
  // 雲
  const cx=(t/900)%380-30;R_(c,cx,12,26,5,'#ffffffcc');R_(c,cx+6,8,16,5,'#ffffffcc');
  const cx2=((t/1300)+160)%380-30;R_(c,cx2,26,22,4,'#ffffffaa');
  drawFarCastle(c,sea);
  // 遠山
  c.fillStyle=p.hill;c.beginPath();c.moveTo(0,78);c.lineTo(40,52);c.lineTo(78,76);c.lineTo(120,48);c.lineTo(170,78);c.lineTo(220,54);c.lineTo(270,76);c.lineTo(320,50);c.lineTo(320,100);c.lineTo(0,100);c.fill();
  // 遠方城郭
  // 地面
  R_(c,0,100,320,12,p.grass);R_(c,0,112,320,68,sea==='winter'?'#cdbf9e':'#c2a572');
  for(let i=0;i<40;i++){const sx=(i*53)%320,sy=116+((i*37)%60);R_(c,sx,sy,2,1,sea==='winter'?'#b9aa86':'#b09560')}
  R_(c,0,110,320,2,'#0002');
  // 石板路
  R_(c,116,108,18,72,'#bcb4a2');for(let i=0;i<9;i++)R_(c,116,110+i*8,18,1,'#9a927f');
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
function newEnt(kind,id,extra){return Object.assign({kind,id,x:30+Math.random()*250,y:122+Math.random()*40,tx:0,ty:0,spd:8+Math.random()*6,frame:0,ft:0,wait:Math.random()*2000,pose:'',pt:0,bowT:0,nodCd:0},extra)}
/** 依遊戲狀態同步場景角色（員工、保鏢、家人）。 */
function sceneSync(force){
  if(!G)return;
  const sig=entSig();if(!force&&sig===SCENE.sig)return;SCENE.sig=sig;
  const old={};SCENE.ents.forEach(e=>old[e.id]=e);
  const out=[];const keep=(kind,id,extra)=>{const e=old[id]||newEnt(kind,id,extra);Object.assign(e,extra||{});out.push(e);return e};
  /* 每種職位、每類家人只畫一人（不畫主角）；點選時才從同類中隨機挑一名（見 sceneMember） */
  [...RANKS,...SPECIAL].forEach((rk,i)=>{if(!G.emps.some(e=>e.rank===rk))return;const x={rank:rk,label:UT('scene.rankTag',{r:rankName(rk)}),patrol:i,group:'emp'};if(rk==='guard')x.spd=16;keep('emp','rank_'+rk,x)});
  if(G.family.spouse)keep('wife','wife',{label:UT('scene.wife',{n:G.family.spouse.name}),spd:6,group:'wife'});
  if((G.family.conc||[]).length)keep('wife','conc',{label:roleName('concubine'),spd:6,group:'conc'});
  if(G.family.kids.length){const k=G.family.kids[0],a=kidAge(k);keep('kid','kids',{label:UT('scene.kid',{n:k.name,s:kidStage(a)}),spd:14,age:a,girl:k.gender==='f',group:'kid'})}
  SCENE.ents=out;
}
/** 依角色身分決定駐足時的日常動作。 */
function pickIdlePose(e){
  if(e.kind==='kid')return Math.random()<0.65?'hop':'look';
  if(e.kind==='guard'||e.rank==='guard'||e.rank==='captain')return 'guard';
  if(e.rank==='chief'||e.rank==='banto')return Math.random()<0.7?'abacus':'look';
  if(e.rank==='apprentice'&&season()==='winter'&&Math.random()<0.6)return 'sweep';   // 冬天掃雪（05h_yard）
  if(e.rank==='courier'||e.rank==='apprentice')return Math.random()<0.6?'wipe':'look';
  if(e.rank==='clerk')return Math.random()<0.5?'hold':'look';
  return Math.random()<0.5?'look':'';
}
/** 為角色挑下一個漫步目標。 */
function pickTarget(e){
  if(e.kind==='guard'||e.rank==='guard'){e.tx=e.tx>160?24:296;e.ty=e.patrol%2?158:126;return}
  if(e.kind==='proto'){const r=Math.random();if(r<0.5){e.tx=SPOTS.proto.x;e.ty=SPOTS.proto.y}else{e.tx=140+Math.random()*130;e.ty=118+Math.random()*10}return}
  if(e.kind==='wife'||e.kind==='kid'){e.tx=14+Math.random()*130;e.ty=120+Math.random()*42;return}
  if(e.rank==='chief'){e.tx=40+Math.random()*60;e.ty=116+Math.random()*10;return}
  e.tx=14+Math.random()*290;e.ty=118+Math.random()*44;
}
/** 角色移動與日常互動（含駐足小動作與擦身點頭致意）。 */
function stepEnts(dt){
  SCENE.ents.forEach(e=>{
    e.pt=(e.pt||0)+dt;
    if(e.bowT>0)e.bowT=Math.max(0,e.bowT-dt);
    if(e.nodCd>0)e.nodCd=Math.max(0,e.nodCd-dt);
    if(e.wait>0){
      e.wait-=dt;e.moving=false;
      if(e.pose==='look'&&Math.floor((e.pt-dt)/650)!==Math.floor(e.pt/650)&&Math.random()<0.45)e.dir=-e.dir;
      return;
    }
    e.pose='';
    if(e.tx===0&&e.ty===0)pickTarget(e);
    const dx=e.tx-e.x,dy=e.ty-e.y,d=Math.hypot(dx,dy);
    if(d<1.5){
      e.wait=800+Math.random()*2400;e.moving=false;e.pose=pickIdlePose(e);e.pt=0;
      pickTarget(e);if(e.kind==='guard'||e.rank==='guard')e.wait=350;return;
    }
    const v=e.spd*dt/1000;e.x+=dx/d*v;e.y+=dy/d*v;e.moving=true;e.dir=dx>=0?1:-1;
    e.ft+=dt;if(e.ft>165){e.ft=0;e.frame++}
  });
  // 兩名角色走近時互相點頭致意（會釋）
  for(let i=0;i<SCENE.ents.length;i++){
    for(let j=i+1;j<SCENE.ents.length;j++){
      const a=SCENE.ents[i],b=SCENE.ents[j];
      if(a.nodCd>0||b.nodCd>0)continue;
      if(Math.abs(a.x-b.x)<16&&Math.abs(a.y-b.y)<6){
        a.bowT=380;b.bowT=380;a.nodCd=4500;b.nodCd=4500;
      }
    }
  }
}
/** 依角色種類取外觀。 */
function entLook(e){
  let h=2166136261;for(let i=0;i<e.id.length;i++){h^=e.id.charCodeAt(i);h=Math.imul(h,16777619)}
  const v=h>>>0,base={variant:v,skin:['#f1c9a0','#e8bb91','#dca980'][v%3]};
  switch(e.kind){
    case 'proto':return Object.assign(base,{cloth:'#1e2d4a',cloth2:'#e8dcc4',gold:true,abacus:true,hair:(G&&myAge()>=55)?'#c8c8c8':'#1a1612'});
    case 'guard':return Object.assign(base,{cloth:'#3a3a44',cloth2:'#8a8a98',sword:true,hat:'#1a1612',pants:'#222'});
    case 'wife':return Object.assign(base,{cloth:'#c46a8a',cloth2:'#e0b030',woman:true});
    case 'kid':return Object.assign(base,{cloth:e.girl?'#d9678c':'#4f8fc2',cloth2:'#f4ece1',small:true,woman:false,noKnot:true});
    default:return Object.assign({},RANK_LOOK[e.rank]||RANK_LOOK.clerk,base);
  }
}
/** 畫季節粒子（櫻花、落葉、雪）。 */
function drawParts(c,t,dt){
  const sea=season();
  if(!SCENE.parts.length)for(let i=0;i<26;i++)SCENE.parts.push({x:Math.random()*320,y:Math.random()*180,v:6+Math.random()*10,s:Math.random()*6});
  if(sea==='summer')return;
  const col=sea==='spring'?'#f9c6d6':sea==='autumn'?'#d8752a':'#ffffff';
  SCENE.parts.forEach(p=>{
    p.y+=p.v*dt/1000;p.x+=Math.sin((t/600)+p.s)*0.25+(sea==='winter'?0:0.3);
    if(p.y>180){p.y=-4;p.x=Math.random()*320}
    R_(c,p.x,p.y,sea==='winter'?1.5:2,sea==='winter'?1.5:1,col);
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
  const fest=festScene();if(fest){festSync(now);festStep(dt);festFireworks(c,now)}   // 節慶當旬（05f_festscene.js）
  const dmy=daimyoScene();if(dmy)dmySync(now);                                        // 大名行列過境當旬（05g_daimyoscene.js）
  drawTree(c,12,58,season(),now);drawTree(c,308,62,season(),now);
  drawHouse(c,102,40,now,season());
  const slots=[[34,75],[226,75],[274,75]];
  for(let i=0;i<Math.min(G.wh.n,slots.length);i++){const [x,y]=slots[i];drawKura(c,x,y,i===0);}
  yardBack(c,now,dt);                                                                  // 焦痕與煙、烏鴉、貓（05h_yard）
  if(season()==='winter')R_(c,0,108,320,3,'#fff8');
  if(fest){drawNobori(c,now);drawLanterns(c,now)}
  const list=SCENE.ents.map(e=>({y:e.y,draw:c=>{
    const L=entLook(e),nod=e.bowT>0?Math.sin(e.bowT/380*Math.PI)*0.45:0;
    drawPerson(c,e.x,e.y,Object.assign({frame:e.moving?e.frame:0,moving:e.moving,faceLeft:e.dir<0,pose:e.pose,pt:e.pt,bow:nod},L,{small:L.small||e.kind==='kid'&&e.age<12}));
    if(e.pose==='sweep')yardBroom(c,e);                                               // 冬天掃雪（05h_yard）
  }}));
  yardPeople(now,dt).forEach(x=>list.push(x));                                        // 荷車、馬隊、飛腳（05h_yard）
  if(fest){festPeople().forEach(x=>list.push(x));const m=festMikoshi(now,dt);if(m)list.push(m)}
  if(dmy)dmyPeople(now,dt).forEach(x=>list.push(x));
  list.sort((a,b)=>a.y-b.y).forEach(x=>x.draw(c));
  drawFence(c);drawParts(c,now,dt);drawTint(c);if(fest)festTint(c);
  // 庫存提示牌
  c.fillStyle='#1a1612cc';c.fillRect(2,166,96,12);c.fillStyle='#f4ece1';c.font='8px DotGothic16,monospace';c.textBaseline='top';
  c.fillText(UT('scene.store',{n:G.wh.n,u:invUsed(),c:invCap()}),5,168);
}
/** 場景每秒 30 格（像素畫看不出差別，運算量減半）。 */
const SCENE_FRAME=1000/30;
/** 場景看不見時暫停重畫：切到背景、不在主畫面、被面板或說明視窗蓋住。畫面停在最後一格，回來後接著動（drawScene 的時間差最多算 0.1 秒）。 */
function sceneIdle(){if(document.hidden||!G||UI.s.tab!=='home')return true;const sb=document.getElementById('sheet-bd'),ib=document.getElementById('info-bd');return !!((sb&&!sb.classList.contains('hidden'))||(ib&&!ib.classList.contains('hidden')))}
/** 啟動場景動畫迴圈。 */
function sceneStart(){
  const cv=$('#scene');if(!cv)return;SCENE.cv=cv;SCENE.ctx=cv.getContext('2d');SCENE.ctx.imageSmoothingEnabled=false;
  if(SCENE.timer)cancelAnimationFrame(SCENE.timer);
  const loop=t=>{SCENE.timer=requestAnimationFrame(loop);if(sceneIdle()||t-(SCENE.lastDraw||0)<SCENE_FRAME-2)return;SCENE.lastDraw=t;drawScene(t)};SCENE.timer=requestAnimationFrame(loop);
  cv.addEventListener('click',ev=>{
    const r=cv.getBoundingClientRect(),x=(ev.clientX-r.left)/r.width*320,y=(ev.clientY-r.top)/r.height*180;
    let best=null,bd=18;SCENE.ents.forEach(e=>{const d=Math.hypot(e.x-x,(e.y-11)-y);if(d<bd){bd=d;best=e}});
    if(best){const m=sceneMember(best);if(!(m&&typeof voScene==='function'&&voScene(m)))sfx.tap();if(m)openChat(m)}
    else if(x>=93&&x<=219&&y>=20&&y<=106){sfx.tap();UI.go('estate')}
    else if(y>=54&&y<=106&&((x>=28&&x<=80)||(G.wh.n>=2&&x>=220&&x<=272)||(G.wh.n>=3&&x>=268&&x<=320))){sfx.tap();UI.openSheet('warehouse')}
  });
}
/** 點到場景中的代表人物：從同一類（同職位的員工、側室、子女）隨機挑一名，回傳聊天用的角色資料。 */
function sceneMember(ent){
  if(ent.group==='emp'){const L=G.emps.filter(e=>e.rank===ent.rank);if(!L.length)return null;const e=pick(L);return {kind:'emp',id:'emp_'+e.id,label:UT('scene.rankTag',{r:rankName(e.rank)})+e.name}}
  if(ent.group==='conc'){const L=G.family.conc||[];if(!L.length)return null;const x=pick(L);return {kind:'wife',id:'conc_'+x.cid,label:UT('scene.conc',{n:x.name})}}
  if(ent.group==='kid'){const L=G.family.kids;if(!L.length)return null;const k=pick(L);return {kind:'kid',id:'kid_'+k.id,label:UT('scene.kid',{n:k.name,s:kidStage(kidAge(k))})}}
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
  if(daimyoActive())lines.push(TX('protag.daimyo'));
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
function fxSprite(kind,frame){
  const cv=$('#fx-walker'),c=cv.getContext('2d');
  const W=kind==='walk'||kind==='time'||kind==='house'?16:30,H=26;
  if(cv.width!==W)cv.width=W;if(cv.height!==H)cv.height=H;
  cv.style.width=(W*4)+'px';cv.style.height=(H*4)+'px';
  c.clearRect(0,0,W,H);c.imageSmoothingEnabled=false;
  c.save();c.translate(0,5);
  const f=frame||0;
  if(kind==='walk'||kind==='time'||kind==='house'){
    drawPerson(c,8,20,{frame:f,moving:true,cloth:'#1e2d4a',cloth2:'#e8dcc4',gold:true,abacus:true,hair:myAge()>=55?'#c8c8c8':'#1a1612'});
    cv.dataset.bob='1';
  }else if(kind==='cart'){
    const wy=f%2?1:0;
    R_(c,8,10+wy,18,6,'#8a5f34');R_(c,8,8+wy,18,2,'#a97a48');R_(c,10,6+wy,14,2,'#d7b36a');
    R_(c,9,16,5,5,'#3a2a1a');R_(c,20,16,5,5,'#3a2a1a');R_(c,11+(f%2),18,1,1,'#d8c8a0');R_(c,22+(f%2),18,1,1,'#d8c8a0');
    drawPerson(c,6,20,{frame:f,moving:true,cloth:'#7a5a3a',cloth2:'#e8dcc4',hat:'#c9a35a'});
  }else if(kind==='boat'){
    const by=f%2?1:0;
    R_(c,3,14+by,24,4,'#6b4a2a');R_(c,5,18+by,20,2,'#4a3320');R_(c,14,2+by,1,12,'#3a2a1a');
    R_(c,15,3+by,9,9,'#f4ece1');R_(c,15,3+by,9,1,'#d0c8b4');R_(c,2,20,26,1,'#4aa0d8');
  }
  c.restore();
}
/* kind: walk 前往處所｜cart 出貨｜boat 船隊｜time 時節流轉 */
/** 播放全螢幕轉場動畫，結束後呼叫 done。kind：walk/cart/boat/time。 */
function playFx(kind,cap,sub,done,ms){
  if(FX.busy){done&&done();return}
  FX.busy=true;ms=ms||1150;
  const fx=$('#fx');fx.classList.add('on');fx.style.setProperty('--dur',(ms/1000)+'s');
  const town=$('#fx-town');town.style.backgroundImage='url('+(FX.bg||IMG_STREET)+')';FX.bg=null;   // FX.bg：這一次換背景（寺社、溫泉）
  town.style.animation='none';void town.offsetWidth;town.style.animation='';
  const cv=$('#fx-walker');cv.style.animation='none';void cv.offsetWidth;cv.style.animation='';
  fxSprite(kind,0);
  $('#fx-cap').innerHTML=esc(cap)+(sub?'<small>'+esc(sub)+'</small>':'');
  let t=0;const iv=setInterval(()=>{t++;fxSprite(kind,t);sfx.step()},160);
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
const VIS_TITLE={};['meet','gift','favor','contract','marry','secret'].forEach(k=>VIS_TITLE[k]=UT('visit.title.'+k));
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
  const fixed=UI_TXT['visit.prop.'+o.prop]!==undefined?UT('visit.prop.'+o.prop):null;
  return fixed||(typeof GIFT_MAP!=='undefined'&&GIFT_MAP[o.prop]?GIFT_MAP[o.prop].name:UT('visit.prop.gift'));
}
function visitCaptions(o){
  const nm=o.cid&&CH(o.cid)?CH(o.cid).name:UT('visit.other'),prop=visitPropName(o);
  const intro=UT('visit.cap.go',{who:UT(o.actor==='apprentice'?'visit.who.apprentice':'visit.who.me'),p:prop,n:nm});
  let result;
  if(o.outcome==='absent')result=UT('visit.cap.absent',{n:nm});
  else if(o.outcome==='refuse')result=UT('visit.cap.refuse',{n:nm});
  else result=UT('visit.cap.ok.'+o.kind,{n:nm,p:prop});
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
  if(isFemale(c))return {cloth:'#c46a8a',cloth2:'#e0b030',woman:true};
  if(n&&n.pos)return {cloth:'#4a2f6a',cloth2:'#e5a93b',hat:'#1a1612'};
  if(n&&n.role==='smuggler')return {cloth:'#3a4a3a',cloth2:'#8a8a98'};
  return {cloth:'#7a5a3a',cloth2:'#e8dcc4',abacus:true};
}
/** 繪製拜訪動畫：整衣投帖、敲門喚人、正坐締約、密談張望或拒見垂頭。 */
function drawVisitScene(c,t,o){
  const sea=season(),p=PAL[sea],secret=o.kind==='secret',official=o.cid&&npc(o.cid)&&npc(o.cid).pos;
  const g=c.createLinearGradient(0,0,0,80);g.addColorStop(0,secret?'#10172b':p.sky[0]);g.addColorStop(1,secret?'#35405b':p.sky[1]);c.fillStyle=g;c.fillRect(0,0,256,128);
  if(secret){for(let i=0;i<16;i++)R_(c,(i*47)%250,8+(i*23)%42,1,1,'#f7e8aa');R_(c,220,12,9,9,'#e8dc9a')}
  c.fillStyle=p.hill;c.beginPath();c.moveTo(0,70);c.lineTo(50,46);c.lineTo(100,68);c.lineTo(160,42);c.lineTo(256,66);c.lineTo(256,90);c.lineTo(0,90);c.fill();
  if(secret){c.fillStyle='#11182755';c.fillRect(0,38,256,54)}
  R_(c,0,88,256,40,sea==='winter'?'#cdbf9e':secret?'#6e6758':'#c2a572');R_(c,0,86,256,4,secret?'#334634':p.grass);
  // 背景町家
  [[6,50,52],[66,56,44]].forEach(([x,y,w])=>{R_(c,x,y,w,36,secret?'#4a443e':'#8a7a62');R_(c,x-3,y-6,w+6,8,'#2c3552');R_(c,x+6,y+14,w-12,18,secret?'#25221f':'#5a4a3a')});
  // 目標住宅
  const hx=148,hy=34,knocking=t>VIS_TIME.bow&&t<VIS_TIME.knock,shake=knocking?(Math.floor(t/60)%2?1:-1):0;
  R_(c,hx-6,hy,104,12,'#232a40');R_(c,hx,hy-6,92,6,'#2c3552');R_(c,hx+10,hy-11,72,5,'#232a40');
  R_(c,hx,hy+12,92,52,secret?'#857a68':'#d9c9a6');R_(c,hx,hy+60,92,4,'#2a2420');
  R_(c,hx+6,hy+18,24,16,'#4a3a2a');for(let k=0;k<5;k++)R_(c,hx+8+k*5,hy+18,1,16,'#d9c9a6');
  R_(c,hx+62,hy+18,24,16,'#4a3a2a');for(let k=0;k<5;k++)R_(c,hx+64+k*5,hy+18,1,16,'#d9c9a6');
  // 門（拒見時開半縫）
  const open=t>VIS_TIME.knock&&o.outcome==='ok',halfOpen=t>VIS_TIME.knock&&o.outcome==='refuse',dx=hx+34+shake;
  R_(c,dx,hy+30,24,34,open?'#1a1208':'#5a3a22');
  if(halfOpen)R_(c,dx+12,hy+30,10,34,'#1a1208');
  if(!open&&!halfOpen){R_(c,dx+11,hy+30,2,34,'#2a1a10');R_(c,dx+8,hy+46,2,3,'#e5a93b');R_(c,dx+14,hy+46,2,3,'#e5a93b')}
  R_(c,dx-3,hy+27,30,4,secret?'#34213e':'#1e2d4a');
  if(official){R_(c,hx+40,hy+14,12,9,'#efe2bd');R_(c,hx+45,hy+16,2,5,'#5b2d39')}
  // 燈籠
  R_(c,hx-4,hy+34,5,8,secret?'#e08b32':'#b4442e');R_(c,hx+91,hy+34,5,8,secret?'#e08b32':'#b4442e');
  if(secret){c.fillStyle='#ffb03a22';c.beginPath();c.arc(hx-2,hy+38,14,0,6.3);c.fill()}
  if(o.outcome==='absent'&&t>VIS_TIME.knock){R_(c,dx+6,hy+36,12,8,'#f4ece1');R_(c,dx+8,hy+39,8,1,'#1a1612');R_(c,dx+8,hy+41,6,1,'#1a1612')}
  // 路面
  R_(c,0,104,256,3,'#b0a590');

  // 來客動態：走近 → 行禮 → 上前敲門/張望 → 遞交/正坐商談（或吃閉門羹垂頭嘆氣）
  const walking=t<VIS_TIME.approach,walk=visEase(t/VIS_TIME.approach);
  const knockStep=knocking?2:0,failStep=(t>VIS_TIME.response&&o.outcome!=='ok')?-3:0;
  const px=-8+walk*126+knockStep+failStep,py=122,fr=Math.floor(t/140);
  const isSit=o.outcome==='ok'&&t>VIS_TIME.response&&(o.kind==='contract'||o.kind==='marry');
  const bow=visBow(t,VIS_TIME.approach,VIS_TIME.bow)+visBow(t,VIS_TIME.exchange,VIS_TIME.end)+(secret&&t>VIS_TIME.response?0.25:0);
  let pPose=walking?'':knocking?'knock':(t>VIS_TIME.response&&o.outcome!=='ok')?'sigh':'hold';
  const secretLook=secret&&knocking&&(Math.floor(t/240)%2===1);
  const actor=o.actor==='apprentice'?Object.assign({},RANK_LOOK.apprentice,{noKnot:true}):{cloth:'#1e2d4a',cloth2:'#e8dcc4',gold:true,hair:myAge()>=55?'#c8c8c8':'#1a1612'};
  drawPerson(c,px,py,Object.assign({frame:walking?fr:0,moving:walking,bow,pose:pPose,pt:t,sit:isSit,faceLeft:secretLook},actor));

  // 應門者：成功時走出迎接（締約時一同正坐），拒見則由門房探頭揮手送客
  let hostX=dx+12,hostY=hy+62;
  if(t>VIS_TIME.knock){
    if(o.outcome==='ok'){
      const ap=visEase((t-VIS_TIME.knock)/(VIS_TIME.response-VIS_TIME.knock));hostX=dx+12-ap*34;hostY=hy+62+ap*23;
      const hb=visBow(t,VIS_TIME.response-260,VIS_TIME.response+180)+visBow(t,VIS_TIME.exchange,VIS_TIME.end)+(secret&&t>VIS_TIME.response?0.25:0);
      const hPose=t>VIS_TIME.response?'hold':'';
      drawPerson(c,hostX,hostY,Object.assign({frame:ap<1?fr:0,moving:ap<1,bow:hb,pose:hPose,pt:t,sit:isSit,faceLeft:true},hostLook(o.cid)));
    }else if(o.outcome==='refuse'){
      drawPerson(c,dx+20,hy+66,{frame:0,cloth:'#7a8a9a',cloth2:'#e8dcc4',small:true,noKnot:true,faceLeft:true,pose:'wave',pt:t});
    }
  }
  // 道具始終由來客雙手捧穩；成功時水平移到對方身前（或矮桌上），失敗則隨垂頭微降
  let bx=px+5,by=py-(isSit?10:13)+(pPose==='sigh'?2:0);
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
    c.fillStyle='#1a1612';c.font='8px DotGothic16,monospace';c.textBaseline='top';c.fillText(UT(secret?'visit.knockSecret':'visit.knock'),px+12,py-28)}
}
/** 【所有人際往來的動畫入口】kind 決定情境、prop 決定道具；點一下立即完成並結算。 */
function visitFx(o,done){
  if(VIS.busy){done&&done();return}
  VIS.busy=true;o=visitSetup(o);
  const box=$('#visit'),cv=$('#visit-cv'),c=cv.getContext('2d');c.imageSmoothingEnabled=false;
  const nm=o.cid&&CH(o.cid)?CH(o.cid).name:UT('visit.other');
  $('#visit-title').textContent=UT('visit.titleOf',{t:VIS_TITLE[o.kind]||VIS_TITLE.gift,n:nm});
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

/* ═════ [05b_portrait] ═════ */
/* =====================================================================
 * 05b_portrait.js — 江戶風模組化像素頭像
 *  - 48×48 原生像素畫；臉型、膚色、年齡、髮型、衣裝與神情分層組合。
 *  - 衣裝以江戶中後期為準：町人髷／月代、島田髷、小袖、羽織、裃、半纏、手拭。
 *  - 排除洋服、立領、西式軍裝、現代短髮與大正浪漫造型。
 *  - 隱藏數值只造成細微表情差異，不再以金眼、歪眉等誇張符號直接洩露。
 *  - 對外介面：portraitHtml(cid,px) 與 portraitEmp(e,px)。
 * ===================================================================== */

const PT_CACHE={};
function ptHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function ptRng(seed){let t=ptHash(seed);return()=>{t=(t+0x6D2B79F5)>>>0;let x=Math.imul(t^(t>>>15),t|1);x^=x+Math.imul(x^(x>>>7),x|61);return((x^(x>>>14))>>>0)/4294967296}}

const PT_COURT={administration:'#304f72',finance:'#8b6729',judiciary:'#5c496f'};
const PT_CLOTH={
  rival:'#70452f',manager:'#36576b',official:'#343f58',smuggler:'#405544',guard:'#34363b',
  broker:'#665c50',guest:'#78604a',oiran:'#9e3f43',captain:'#315b68',courier:'#4d683d',
  apprentice:'#566c45',clerk:'#3f6172',banto:'#674b38',chief:'#253f58'
};
const PT_BG=['#d9cfb9','#d2c7ae','#ddd3bf','#cfc5b1'];
const PT_SKIN=[
  {hi:'#f2d2ad',mid:'#dfb486',lo:'#bd8765'},
  {hi:'#efd8bd',mid:'#dab691',lo:'#ba8667'},
  {hi:'#e7c092',mid:'#cf9b70',lo:'#aa7458'},
  {hi:'#f3d9bd',mid:'#e2b995',lo:'#c28b69'}
];

/** 角色使用的江戶服飾類型。 */
function ptDress(o){
  if(o.dress)return o.dress;                       // 指定衣著：monk 和尚、miko 巫女、sansuke 三助（07zzi_stress.js 的出遊）
  if(o.oiran)return 'oiran';
  if(o.gender==='f')return 'kosode';
  if(o.rank>0||o.role==='official')return 'kamishimo';
  if(o.role==='captain'||o.role==='smuggler')return 'captain';
  if(o.role==='courier')return 'courier';
  if(o.role==='guard')return 'samurai';
  return 'haori';
}

/**
 * 固定人物表情。性格與身分只增加候選權重，仍保留個體差異；
 * 可傳入 o.expression 供預覽或特殊劇情指定。
 */
function ptExpression(o,rg,st){
  if(o.expression)return o.expression;
  const v=k=>st[k]===undefined?50:st[k];
  const pool=['calm','calm','gentle','stern','worried','tired','alert','shrewd'];
  if(v('diplomacy_charm')>=62)pool.push('gentle','cheerful');
  if(v('audacity_courage')>=65)pool.push('stern','alert');
  if(v('betrayal_risk')>=68)pool.push('shrewd');
  if((o.age||30)>=58)pool.push('calm','tired');
  if(o.oiran||o.gender==='f')pool.push('gentle','cheerful');
  if(o.rank>0||o.role==='official'||o.role==='guard')pool.push('stern','calm');
  if(o.role==='courier'||o.role==='captain')pool.push('alert','cheerful');
  return pool[Math.floor(rg()*pool.length)];
}

/** 畫一張 48×48 原生像素頭像並回傳 data URL。 */
function ptDraw(o){
  const cv=document.createElement('canvas');cv.width=48;cv.height=48;
  const c=cv.getContext('2d',{alpha:false});c.imageSmoothingEnabled=false;
  const R=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};
  const H=(x1,x2,y,col,h=1)=>R(x1,y,x2-x1+1,h,col);
  const V=(x,y1,y2,col,w=1)=>R(x,y1,w,y2-y1+1,col);
  const rg=ptRng(String(o.seed)),woman=o.gender==='f',age=o.age||30,st=o.st||{},dress=ptDress(o);
  const stat=k=>st[k]===undefined?50:st[k];
  const courage=stat('audacity_courage'),loyal=stat('integrity_loyalty'),betray=stat('betrayal_risk'),charm=stat('diplomacy_charm'),comm=stat('commerce_skill');
  const expression=ptExpression(o,rg,st);
  const sk=PT_SKIN[o.oiran?3:Math.floor(rg()*PT_SKIN.length)];
  const outline='#241d19',ink='#30251f',hair=age>=67?'#b9b6ad':age>=52?'#615d58':'#211c1a';
  const hairHi=age>=67?'#d2cec4':age>=52?'#817c75':'#3b302b';
  const cloth=o.cloth||PT_CLOTH[o.role]||(woman?'#8c5657':'#68513e');
  const clothDark=ptShade(cloth,-34),clothHi=ptShade(cloth,20),court=PT_COURT[o.court]||'#785b2f';
  const bg=o.court?ptShade(court,125):PT_BG[Math.floor(rg()*PT_BG.length)];

  // 背景：低對比和紙色，保留人物輪廓。
  R(0,0,48,48,bg);R(0,0,48,2,ptShade(bg,-18));R(0,46,48,2,ptShade(bg,-22));
  R(2,2,2,2,ptShade(bg,12));R(44,42,2,2,ptShade(bg,-10));

  // 肩膀與衣裝底形。
  H(12,35,34,outline,2);H(8,39,36,outline,2);H(5,42,38,outline,3);H(3,44,41,outline,7);
  H(13,34,34,cloth);H(9,38,36,cloth,2);H(6,41,38,cloth,3);H(4,43,41,cloth,7);
  H(6,41,39,clothHi);H(5,42,40,cloth);
  R(20,30,9,8,outline);R(21,30,7,8,sk.lo);R(22,30,5,7,sk.mid);

  if(dress==='kamishimo'){
    // 裃：肩衣的硬挺三角肩與交疊小袖。
    H(3,15,35,outline,2);H(32,44,35,outline,2);H(5,16,34,cloth);H(31,42,34,cloth);
    H(3,16,37,cloth,5);H(31,44,37,cloth,5);V(15,36,46,clothDark,2);V(31,36,46,clothDark,2);
    R(8,39,4,4,court);R(36,39,4,4,court);R(9,40,2,2,ptShade(court,38));R(37,40,2,2,ptShade(court,38));
  }else if(dress==='captain'||dress==='courier'){
    // 半纏：活動方便的短外衣；船長以手拭、飛腳以鉢卷束髮。
    V(7,39,47,clothDark,2);V(39,39,47,clothDark,2);
    H(5,12,42,clothHi,2);H(35,42,42,clothHi,2);
    if(dress==='captain'){H(5,11,45,'#d9d0ba',2);H(36,42,45,'#d9d0ba',2)}
    else{R(7,43,4,3,'#d9d0ba');R(37,43,4,3,'#d9d0ba')}
  }else if(dress==='oiran'){
    // 打掛般的厚重衣領與江戶花紋。
    V(5,39,47,'#b98a32',2);V(41,39,47,'#b98a32',2);
    R(8,41,3,3,'#d7ac4a');R(37,42,3,3,'#d7ac4a');R(10,43,2,2,'#ead08a');R(35,39,2,2,'#ead08a');
  }else if(dress==='samurai'){
    H(6,13,42,clothDark,2);H(34,41,42,clothDark,2);R(39,33,3,8,'#6a4a2e');R(40,32,2,3,'#b39150');
  }else if(dress==='monk'){
    // 墨染衣上斜披袈裟：左肩往右下，加一條肩帶與金色環扣。
    const kesa=o.kesa||'#8a5a2c',kd=ptShade(kesa,-30);
    for(let y=36;y<=47;y++){R(7+Math.round((y-36)*1.6),y,6,1,kesa);R(7+Math.round((y-36)*1.6),y,1,1,kd)}
    V(33,35,47,kesa,3);R(32,41,5,3,'#c9a64a');R(33,42,3,1,'#e3c873');
  }else if(dress==='miko'){
    // 巫女：白衣，下緣露出緋袴。
    H(4,43,45,'#b3322b',3);H(4,43,45,'#8f2420');V(23,44,47,'#8f2420');
  }else if(dress==='peddler'){
    // 賣藥郎：背上的木藥箱從右肩後露出，一條揹帶斜過胸前。
    R(33,22,12,17,outline);R(34,23,10,15,'#7a5530');H(34,43,27,'#5c3e22');H(34,43,32,'#5c3e22');R(37,24,4,2,'#c9a64a');
    for(let i=0;i<9;i++)R(12+i*2,46-i,3,1,'#d9d0ba');
  }else if(dress==='elder'){
    // 老隱居：外罩袖無羽織，胸前垂著繫繩。
    V(8,37,47,'#3b3547',3);V(37,37,47,'#3b3547',3);R(22,41,4,2,'#c9a64a');V(23,43,46,'#c9a64a');V(24,43,46,'#a8873a');
  }else if(dress==='sansuke'){
    // 三助：藍半纏捲袖，襷掛交叉，手拭搭在肩上。
    for(let i=0;i<10;i++){R(10+i*2,37+i,3,1,'#c9b37a');R(36-i*2,37+i,3,1,'#c9b37a')}
    R(5,37,7,3,'#ece6d6');R(6,40,3,4,'#ece6d6');R(5,37,7,1,'#cfc7b4');
  }

  // 小袖交領；羽織在外，白襟只露窄邊。
  const collar=woman||dress==='oiran'||dress==='miko'?'#eee5d2':'#e4dccb';
  H(18,21,35,collar);H(26,29,35,collar);
  H(17,22,36,collar);H(25,30,36,collar);H(18,23,37,collar);H(24,29,37,collar);
  H(19,24,38,clothDark);H(24,28,38,clothDark);V(23,38,47,clothDark,2);
  if(comm>=72&&!woman){R(17,36,1,8,'#a9863e');R(30,36,1,8,'#a9863e')}

  // 耳、臉部輪廓與下頷；每個人有少量寬窄變化。
  const broad=rg()>.55?1:0;
  R(11-broad,20,4,8,outline);R(34,20,4+broad,8,outline);R(12-broad,21,3,6,sk.mid);R(34,21,3+broad,6,sk.mid);
  H(16-broad,31+broad,9,outline,2);H(14-broad,33+broad,11,outline,3);H(13-broad,34+broad,14,outline,12);
  H(14-broad,33+broad,26,outline,3);H(16-broad,31+broad,29,outline,3);H(19,28,32,outline,2);
  H(16-broad,31+broad,11,sk.mid,3);H(15-broad,32+broad,14,sk.mid,12);H(16-broad,31+broad,26,sk.mid,3);
  H(18-broad,29+broad,29,sk.mid,3);H(20,27,32,sk.mid);
  V(15-broad,16,25,sk.hi);H(16-broad,19,14,sk.hi);V(32+broad,17,25,sk.lo);H(29,31+broad,27,sk.lo);

  // 髮型：男性是月代／町人髷；女性是島田髷。高官仍用裃，不戴近代官帽。
  if(woman){
    H(17,30,5,hair);H(14,33,7,hair,3);H(12,35,10,hair,4);V(11,13,24,hair,3);V(34,13,25,hair,3);
    H(19,28,3,hair,3);H(21,30,1,hair,2);R(13,10,4,5,hairHi);R(31,10,4,6,hairHi);
    V(13,19,27,hair);V(34,18,27,hair);
    const pin=['#a5453d','#b48a36','#315f70'][Math.floor(rg()*3)];
    if(dress==='miko'){
      // 垂髮在背後以檀紙束起，額前平分；不插簪。
      V(10,22,40,hair,3);V(35,22,40,hair,3);R(9,30,5,3,'#f1ede2');R(34,30,5,3,'#f1ede2');R(20,2,8,3,'#f1ede2');R(22,1,4,1,'#b3322b');
    }else if(age<58){H(29,37,6,pin,2);R(36,5,2,5,pin)}
    if(o.oiran){
      H(8,18,7,'#c49a3f',2);H(30,40,9,'#c49a3f',2);V(9,5,14,'#d7b85f',2);V(38,6,16,'#d7b85f',2);
      R(7,4,4,3,'#a63f38');R(38,7,4,3,'#a63f38');H(20,29,2,'#b99038');
    }
  }else{
    if(dress==='monk'){
      // 剃髮：整顆頭是皮膚色的圓頂，留一點青色髮根。
      H(18,29,5,outline);H(16,31,6,outline);H(15-broad,32+broad,7,outline,2);
      H(18,29,6,sk.mid);H(16,31,7,sk.mid,2);H(15-broad,32+broad,9,sk.mid,3);H(17,30,7,'#9a9488');H(19,28,6,'#aaa498');
      R(18,8,4,2,sk.hi);V(14-broad,12,22,sk.lo);V(33+broad,12,22,sk.lo);
    }else{
    // 側髮與後髮保留，前額剃月代；頭頂髷向後收束。
    H(15-broad,32+broad,8,hair,3);R(13-broad,10,5,8,hair);R(30,10,5+broad,9,hair);
    V(12-broad,14,23,hair,3);V(34,14,24,hair,3);R(15,10,4,3,hairHi);R(31,11,3,5,hairHi);
    H(20,29,6,hair,2);H(23,33,4,hair,2);R(30,5,5,2,hair);R(21,8,7,2,sk.mid);
    if(dress==='captain'){
      H(10,37,10,'#ded5c0',3);R(34,12,6,3,'#ded5c0');R(38,15,4,4,'#ded5c0');R(40,18,2,3,'#bdb39e');
      R(13,10,7,2,'#405d75');R(26,10,7,2,'#405d75');
    }else if(dress==='courier'||dress==='sansuke'){
      H(11,36,11,'#e4dccb',3);R(34,14,6,2,'#e4dccb');R(38,16,3,3,'#e4dccb');
      if(dress==='sansuke'){H(11,36,12,'#3f5f7a');R(39,15,2,4,'#e4dccb')}
    }
    }
  }

  // 眉眼：八種自然表情。能力只影響候選權重，不直接畫成誇張符號。
  const eyeY=21+(age>=62?1:0),glance=(expression==='shrewd'||loyal<24||betray>=82)?1:0;
  if(expression==='stern'||expression==='shrewd'){
    H(16,18,eyeY-4,ink);H(19,21,eyeY-3,ink);H(29,31,eyeY-4,ink);H(26,28,eyeY-3,ink);
  }else if(expression==='worried'){
    H(16,18,eyeY-3,ink);H(19,21,eyeY-4,ink);H(29,31,eyeY-3,ink);H(26,28,eyeY-4,ink);
  }else if(expression==='alert'){
    H(16,21,eyeY-5,ink);H(27,32,eyeY-5,ink);
  }else{
    H(16,20,eyeY-3,ink);H(27,31,eyeY-3+(expression==='shrewd'?-1:0),ink);
  }
  if(expression==='cheerful'){
    H(16,18,eyeY,outline);R(19,eyeY+1,2,1,outline);R(27,eyeY+1,2,1,outline);H(29,31,eyeY,outline);
  }else if(expression==='tired'||expression==='shrewd'){
    H(16,21,eyeY+1,outline);H(27,32,eyeY+1,outline);R(19+glance,eyeY,2,1,ink);R(29+glance,eyeY,2,1,ink);
  }else{
    const tall=expression==='alert';
    H(16,21,eyeY,outline);H(27,32,eyeY,outline);H(17,20,eyeY+1,'#f4ead8',tall?2:1);H(28,31,eyeY+1,'#f4ead8',tall?2:1);
    R(18+glance,eyeY,2,tall?3:2,ink);R(29+glance,eyeY,2,tall?3:2,ink);R(19+glance,eyeY,'#efe5cd');R(30+glance,eyeY,'#efe5cd');
  }
  if(woman&&expression!=='tired'){R(15,eyeY-1,2,1,ink);R(32,eyeY-1,2,1,ink)}

  // 鼻、嘴、皺紋與鬍鬚。
  V(24,22,26,sk.lo);H(23,26,27,sk.lo);R(22,26,2,1,sk.hi);
  const mouthY=30,lip=o.oiran?'#9d3c43':'#835447';
  if(expression==='gentle'){
    H(21,26,mouthY,lip);R(20,mouthY-1,1,1,lip);R(27,mouthY-1,1,1,lip);
  }else if(expression==='cheerful'){
    H(20,27,mouthY-1,lip);H(21,26,mouthY,outline);H(22,25,mouthY+1,'#e9d9c2');R(20,mouthY-2,1,1,lip);R(27,mouthY-2,1,1,lip);
  }else if(expression==='stern'){
    H(20,27,mouthY,outline);H(22,25,mouthY-1,lip);
  }else if(expression==='worried'){
    H(21,26,mouthY-1,lip);R(20,mouthY,1,1,lip);R(27,mouthY,1,1,lip);H(23,24,mouthY,outline);
  }else if(expression==='tired'){
    H(21,27,mouthY,lip);R(21,mouthY+1,2,1,sk.lo);
  }else if(expression==='alert'){
    H(22,25,mouthY-1,outline);H(22,25,mouthY,lip);H(23,24,mouthY+1,outline);
  }else if(expression==='shrewd'){
    H(21,26,mouthY,lip);R(20,mouthY,1,1,lip);R(27,mouthY-1,1,1,lip);
  }else H(21,27,mouthY,lip);
  if(age>=48){H(14,17,eyeY+3,sk.lo);H(31,34,eyeY+3,sk.lo);H(21,23,16,sk.lo);H(26,28,16,sk.lo)}
  if(age>=63){H(18,21,13,sk.lo);H(27,30,13,sk.lo);R(19,31,2,1,sk.lo);R(27,31,2,1,sk.lo)}
  const beard=!woman&&(dress==='captain'||dress==='samurai'||o.role==='smuggler')&&age>28&&rg()>.34;
  if(beard){H(20,27,32,hair);R(18,30,2,2,hair);R(28,30,2,2,hair);H(21,26,33,hairHi)}
  if(dress==='elder'){   // 老隱居：頭戴宗匠頭巾，白鬚垂到胸前
    H(15,32,4,'#3b3547');H(13,34,5,'#4a4358',5);H(14,33,6,'#5b5368',2);R(13,9,22,1,'#3b3547');
    R(17,30,2,3,'#ebe7dd');R(29,30,2,3,'#ebe7dd');H(19,28,32,'#ebe7dd');H(20,27,33,'#ebe7dd');H(21,26,34,'#dcd7ca');H(22,25,35,'#dcd7ca');H(23,24,36,'#cbc5b6')}

  R(16,16,2,2,sk.hi);R(15,19,1,3,sk.hi);R(0,0,48,1,ptShade(bg,-42));R(0,47,48,1,ptShade(bg,-42));
  if(o.blush)ptBlush(c,eyeY,o.blush);
  return cv.toDataURL('image/png');
}

/** 臉紅（拜訪猜中，第三百三十八節）：lv 1 兩頰淡紅；lv 2 更紅，加三道斜線。照原本的膚色混色，五官不動。 */
function ptBlush(c,eyeY,lv){
  const pink=[232,96,96],deep=[200,70,72];
  const paint=(x,y,t,col)=>{const d=c.getImageData(x,y,1,1).data,m=[0,1,2].map(i=>Math.round(d[i]+((col||pink)[i]-d[i])*t));c.fillStyle='rgb('+m.join(',')+')';c.fillRect(x,y,1,1)};
  const cheeks=[[14,19],[28,33]];
  cheeks.forEach(([a,b])=>{for(let x=a;x<=b;x++)for(let y=eyeY+3;y<=eyeY+4;y++)paint(x,y,(lv>=2?0.52:0.4)*((x===a||x===b)?0.55:1))});
  if(lv>=2)cheeks.forEach(([a])=>[a+1,a+3].forEach(x=>{paint(x,eyeY+4,0.75,deep);paint(x+1,eyeY+3,0.75,deep)}));
}
/** 將十六進位色調亮／調暗。 */
function ptShade(hex,amt){
  const n=parseInt(hex.slice(1),16),r=Math.max(0,Math.min(255,(n>>16)+amt)),g=Math.max(0,Math.min(255,((n>>8)&255)+amt)),b=Math.max(0,Math.min(255,(n&255)+amt));
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

/** 名冊以外的人物（寺社的和尚、巫女、小沙彌，溫泉的三助，行商的賣藥郎）：kind＝monk／miko／sansuke／peddler／novice（小沙彌沿用和尚衣著）／artisan 手藝人／hawker 趕路的商人／elder 老隱居，seed 固定外貌。 */
function portraitFigure(kind,seed,px){
  const F={monk:{gender:'m',age:58,cloth:'#2f2c2c'},miko:{gender:'f',age:19,cloth:'#f2efe6'},sansuke:{gender:'m',age:36,cloth:'#3f5f7a'},peddler:{gender:'m',age:44,cloth:'#4b5563'},novice:{gender:'m',age:12,cloth:'#2f2c2c',dress:'monk',kesa:'#6f6a5a'},artisan:{gender:'m',age:41,cloth:'#6b5a45',dress:'courier'},hawker:{gender:'m',age:37,cloth:'#5d4a3a',dress:'plain'},elder:{gender:'m',age:70,cloth:'#5b5368'}}[kind];
  const key='edo3|fig|'+kind+'|'+seed;
  const o=Object.assign({seed:kind+seed,role:'guest',dress:kind,st:{diplomacy_charm:70}},F);
  return '<img class="pt" src="'+(PT_CACHE[key]||(PT_CACHE[key]=ptDraw(o)))+'" width="'+(px||48)+'" height="'+(px||48)+'" alt="" aria-hidden="true">';
}

/** 依人物 cid 取頭像；每八歲更新年齡層，換裝與職位同步更新。 */
function portraitHtml(cid,px,opt){
  const ch=CH(cid);if(!ch)return '';const blush=opt&&opt.blush||0,gray=opt&&opt.gray;
  const n=npc(cid),age=Math.max(10,ageOf(cid)),emp=G.emps.find(e=>e.cid===cid);
  const role=emp?emp.rank:(n?n.role:'guest');
  const o={seed:cid,gender:ch.gender,age,role,rank:n&&n.pos?n.pos.rank:0,court:n&&n.pos?n.pos.court:null,oiran:role==='oiran',st:ch.derived_stats};
  if(emp&&RANK_LOOK[emp.rank])o.cloth=RANK_LOOK[emp.rank].cloth;
  if(blush)o.blush=blush;
  const key=['edo3',cid,Math.floor(age/8),role,o.rank,o.court||'',o.cloth||''].join('|')+(blush?'|b'+blush:'');
  const url=PT_CACHE[key]||(PT_CACHE[key]=ptDraw(o));
  const size=px||48;
  return '<img class="pt" src="'+url+'" width="'+size+'" height="'+size+'" alt="" aria-hidden="true"'+(gray?' style="filter:grayscale(1);opacity:.7"':'')+'>';
}

/** 無名冊少年員工：同一員工外貌固定，升職時換上對應衣裝。 */
function portraitEmp(e,px){
  if(e.cid)return portraitHtml(e.cid,px);
  const key='edo3|emp|'+e.id+'|'+e.rank;
  const o={seed:e.id,gender:'m',age:14,role:e.rank,rank:0,st:e.stats,cloth:RANK_LOOK[e.rank]&&RANK_LOOK[e.rank].cloth};
  const size=px||48;
  return '<img class="pt" src="'+(PT_CACHE[key]||(PT_CACHE[key]=ptDraw(o)))+'" width="'+size+'" height="'+size+'" alt="" aria-hidden="true">';
}

/* ═════ [05f_festscene] ═════ */
'use strict';
/* ======================= 節慶當旬的宅邸場景 =======================
 *  - 只在 G.festival（本城節慶那一旬）時畫；下一旬自動回到平日。季節粒子（花瓣、雪、楓葉）照舊。
 *  - 常駐：燈籠串（左右兩棵樹之間，隨風輕晃、燭光閃爍）、店門前兩面幟旗、路人人潮（4～6 人左右來回）、淡淡的燈籠暖光。
 *  - 偶爾：神轎遊行（約 20～30 秒一次，四人扛轎走過）、煙火（只在夏天或下旬）。
 *  - 由 drawScene（05_scene.js）在各層之間呼叫；人潮不可點選。 */
const FEST={crowd:[],key:'',mikoshi:null,nextMikoshi:0,fw:[],nextFw:0};
const FEST_CLOTH=['#c0392b','#2e5e8c','#d98e2b','#5a7d3a','#8a4a8a','#3a3a44','#b55a7a','#6b4a2a'];
/** 節慶是否正在進行（本城節慶那一旬）。 */
const festScene=()=>!!(G&&G.festival);
/** 換節慶時重建人潮。 */
function festSync(now){
  const key=G.festival+'_'+G.turn;if(FEST.key===key)return;
  FEST.key=key;FEST.crowd=[];FEST.fw=[];FEST.mikoshi=null;FEST.nextMikoshi=now+6000;FEST.nextFw=now+2000;
  const n=4+Math.floor(Math.random()*3);
  for(let i=0;i<n;i++){
    const dir=Math.random()<0.5?1:-1;
    FEST.crowd.push({x:Math.random()*320,y:128+Math.random()*30,dir,spd:9+Math.random()*9,frame:0,ft:0,
      look:{cloth:FEST_CLOTH[i%FEST_CLOTH.length],cloth2:'#f4ece1',woman:Math.random()<0.45,small:Math.random()<0.25,noKnot:false},fan:Math.random()<0.4});
  }
}
/** 移動人潮（走出畫面就從另一邊進來）。 */
function festStep(dt){
  FEST.crowd.forEach(p=>{
    p.x+=p.dir*p.spd*dt/1000;p.ft+=dt;if(p.ft>200){p.ft=0;p.frame++}
    if(p.x>334)p.x=-14;else if(p.x<-14)p.x=334;
  });
}
/** 人潮的繪製項目（與家中角色一起依 y 排序）。 */
function festPeople(){
  return FEST.crowd.map(p=>({y:p.y,draw:c=>{
    drawPerson(c,p.x,p.y,Object.assign({frame:p.frame,faceLeft:p.dir<0},p.look));
    if(p.fan){const s=p.look.small?0.72:1,hx=Math.round(p.x)+(p.dir>0?4:-6),hy=Math.round(p.y-11*s);R_(c,hx,hy,3,3,'#f3d36b');R_(c,hx+1,hy+3,1,2,'#6b4a2a')}
  }}));
}
/** 燈籠串：左樹到右樹之間的弧線，每隔一段掛一盞紅白提燈。 */
function drawLanterns(c,t){
  const x0=16,y0=40,x1=304,y1=44,sag=16,N=16;
  const at=u=>[x0+(x1-x0)*u,y0+(y1-y0)*u+sag*4*u*(1-u)];
  for(let i=0;i<=60;i++){const [x,y]=at(i/60);R_(c,x,y,1,1,'#3a2a1a')}
  for(let i=1;i<N;i++){
    const u=i/N,[x,y]=at(u),sw=Math.round(Math.sin(t/700+i*0.9)*1.2),lx=x+sw,ly=y+3;
    const flick=0.75+0.25*Math.sin(t/90+i*2.3),red=i%2===0;
    R_(c,lx,y,1,3,'#3a2a1a');
    R_(c,lx-3,ly,7,1,'#2a2420');R_(c,lx-3,ly+8,7,1,'#2a2420');
    R_(c,lx-3,ly+1,7,7,red?'#c0392b':'#f1e6cf');
    c.globalAlpha=flick*0.55;R_(c,lx-2,ly+2,5,5,red?'#ff8a5a':'#fff3c4');c.globalAlpha=1;
    R_(c,lx-3,ly+4,7,1,red?'#8e2a20':'#cbbf9e');
  }
}
/** 幟旗：店門兩側各一面直立長旗，隨風飄。 */
function drawNobori(c,t){
  [[50,'#c0392b','#f4ece1'],[88,'#27407a','#f4ece1']].forEach(([x,col,col2],k)=>{
    R_(c,x,66,2,52,'#5a4030');R_(c,x-1,64,4,2,'#5a4030');R_(c,x+2,67,8,1,'#5a4030');
    for(let r=0;r<40;r+=2){const w=Math.round(Math.sin(t/260+r/6+k)*1.5);R_(c,x+2+w,68+r,8,2,r%10<6?col:col2)}
  });
}
/** 神轎遊行：約 20～30 秒一次，四人扛轎從畫面一端走到另一端。 */
function festMikoshi(now,dt){
  if(!FEST.mikoshi&&now>=FEST.nextMikoshi){const dir=Math.random()<0.5?1:-1;FEST.mikoshi={x:dir>0?-40:360,dir,frame:0,ft:0}}
  const m=FEST.mikoshi;if(!m)return null;
  m.x+=m.dir*14*dt/1000;m.ft+=dt;if(m.ft>170){m.ft=0;m.frame++}
  if(m.x>370||m.x<-50){FEST.mikoshi=null;FEST.nextMikoshi=now+20000+Math.random()*10000;return null}
  const y=158;
  return {y,draw:c=>{
    const x=Math.round(m.x),bob=m.frame%2;
    [-14,-5,5,14].forEach((dx,i)=>drawPerson(c,x+dx,y+(i%2?1:0),{frame:m.frame+i,cloth:'#f4ece1',cloth2:'#c0392b',hat:'#c0392b',faceLeft:m.dir<0}));
    R_(c,x-20,y-17-bob,40,2,'#6b4a2a');                                     // 轎棒
    R_(c,x-7,y-27-bob,14,10,'#1a1612');R_(c,x-6,y-26-bob,12,8,'#9b2c3a');    // 轎身
    R_(c,x-9,y-30-bob,18,3,'#e5a93b');R_(c,x-4,y-33-bob,8,3,'#e5a93b');R_(c,x-1,y-36-bob,2,3,'#f7d774');  // 屋頂與寶珠
    R_(c,x-6,y-22-bob,12,1,'#e5a93b');
  }};
}
/** 煙火：只在夏天的節慶或下旬（傍晚）時，天空偶爾綻開一朵。 */
function festFireworks(c,now){
  if(!(season()==='summer'||G.cycle===3))return;
  if(now>=FEST.nextFw){
    const cols=['#ff6b6b','#ffd166','#6bd3ff','#c77dff','#9cff6b'];
    FEST.fw.push({x:150+Math.random()*150,y:10+Math.random()*28,t0:now,col:cols[Math.floor(Math.random()*cols.length)],n:10+Math.floor(Math.random()*5)});
    FEST.nextFw=now+1800+Math.random()*2600;
  }
  FEST.fw=FEST.fw.filter(f=>now-f.t0<1400);
  FEST.fw.forEach(f=>{
    const a=(now-f.t0)/1400,r=3+a*16;c.globalAlpha=Math.max(0,1-a);
    for(let i=0;i<f.n;i++){const th=i/f.n*Math.PI*2;R_(c,f.x+Math.cos(th)*r,f.y+Math.sin(th)*r+a*4,1.5,1.5,f.col)}
    if(a<0.15)R_(c,f.x-1,f.y-1,2,2,'#fff');
    c.globalAlpha=1;
  });
}
/** 燈籠暖光（疊在原本的早晚色調上）。 */
function festTint(c){c.fillStyle='#ffb04018';c.fillRect(0,0,320,180)}

/* ═════ [05g_daimyoscene] ═════ */
'use strict';
/* ======================= 大名行列過境當旬的宅邸場景 =======================
 *  - 只在大名行列過境那一旬畫（07zzc_daimyo.js 的 daimyoActive）；下一旬回到平日。
 *  - 行列從畫面一端走到另一端，走完隔幾秒再來一趟：先頭毛槍兩人、挾箱、徒士武士、大名的駕籠、殿後武士。
 *  - 路人跪在路邊，不走動。沿用場景每秒 30 格與看不見時暫停（05_scene.js）。
 *  - 由 drawScene 呼叫；行列與路人都不可點選。 */
const DMY={key:'',proc:null,next:0,kneel:[]};
/** 這一旬要不要畫行列。 */
const daimyoScene=()=>!!(G&&typeof daimyoActive==='function'&&daimyoActive());
/** 行列的組成（由前到後）：種類與佔的寬度。 */
const DMY_TRAIN=[['spear',12],['spear',12],['box',24],['foot',11],['foot',11],['foot',11],['kago',42],['foot',11],['foot',11]];
const DMY_FOOT={cloth:'#3a3a44',cloth2:'#8a8a96',sword:true};
const DMY_SPEAR={cloth:'#27324a',cloth2:'#e8dcc4',hat:'#1a1612'};
const DMY_BEARER={cloth:'#f4ece1',cloth2:'#27324a',hat:'#1a1612'};
/** 換旬時重建跪在路邊的人。 */
function dmySync(now){
  const key='d'+G.turn;if(DMY.key===key)return;
  DMY.key=key;DMY.proc=null;DMY.next=now+1500;DMY.kneel=[];
  const n=4+Math.floor(Math.random()*3);
  for(let i=0;i<n;i++)DMY.kneel.push({x:24+i*(272/n)+Math.random()*24,y:128+Math.random()*8,left:Math.random()<0.5,
    look:{cloth:FEST_CLOTH[i%FEST_CLOTH.length],woman:Math.random()<0.45}});
}
/** 跪在路邊、低頭的路人。 */
function drawKneel(c,p){
  const x=Math.round(p.x),y=Math.round(p.y),d=p.left?-1:1;
  R_(c,x-5,y-1,10,2,'#0003');
  R_(c,x-4,y-3,8,3,p.look.cloth);                       // 跪坐的腿
  R_(c,x-3+d,y-8,6,5,p.look.cloth);                     // 前傾的身子
  if(p.look.woman)R_(c,x-3+d,y-6,6,1,'#e0b030');
  const hx=x+(d>0?2:-6);
  R_(c,hx,y-9,4,4,'#f1c9a0');R_(c,hx,y-9,4,2,'#1a1612');  // 低下的頭
}
/** 行列本身與路人的繪製項目（與家中角色一起依 y 排序）。 */
function dmyPeople(now,dt){
  const out=DMY.kneel.map(p=>({y:p.y,draw:c=>drawKneel(c,p)}));
  const len=DMY_TRAIN.reduce((a,u)=>a+u[1],0);
  if(!DMY.proc&&now>=DMY.next){const dir=Math.random()<0.5?1:-1;DMY.proc={x:dir>0?-10:330,dir,frame:0,ft:0}}
  const P=DMY.proc;if(!P)return out;
  P.x+=P.dir*11*dt/1000;P.ft+=dt;if(P.ft>200){P.ft=0;P.frame++}
  if(P.dir>0?P.x-len>340:P.x+len<-20){DMY.proc=null;DMY.next=now+6000+Math.random()*6000;return out}
  const y=154;let off=0;
  DMY_TRAIN.forEach(([k,w],i)=>{
    const cx=P.x-P.dir*(off+w/2),fl=P.dir<0,fr=P.frame+i;off+=w;
    if(cx<-30||cx>350)return;
    out.push({y,draw:c=>dmyUnit(c,k,cx,y,fr,fl)});
  });
  return out;
}
/** 畫行列中的一個單位。 */
function dmyUnit(c,k,cx,y,f,fl){
  const x=Math.round(cx);
  if(k==='foot'){drawPerson(c,x,y,Object.assign({frame:f,faceLeft:fl},DMY_FOOT));return}
  if(k==='spear'){                                      // 毛槍：長槍頂端一團黑毛
    drawPerson(c,x,y,Object.assign({frame:f,faceLeft:fl},DMY_SPEAR));
    const px=x+(fl?-4:3);R_(c,px,y-30,1,22,'#6b4a2a');R_(c,px-2,y-35,5,6,'#141210');R_(c,px,y-37,1,2,'#d8d8d8');
    return;
  }
  const bob=f%2;
  if(k==='box'){                                        // 挾箱：兩人挑一只黑漆箱
    [-6,6].forEach((dx,i)=>drawPerson(c,x+dx,y,Object.assign({frame:f+i,faceLeft:fl},DMY_BEARER)));
    R_(c,x-10,y-17-bob,20,1,'#6b4a2a');
    R_(c,x-4,y-23-bob,8,6,'#1a1612');R_(c,x-4,y-23-bob,8,1,'#e5a93b');R_(c,x-1,y-21-bob,2,2,'#e5a93b');
    return;
  }
  /* 駕籠：四人扛著大名的轎子 */
  const ky=y-bob;
  R_(c,x-10,ky-18,20,16,'#17130f');
  R_(c,x-9,ky-17,18,14,'#8a633d');
  R_(c,x-7,ky-16,14,11,'#eadcb9');
  R_(c,x-7,ky-6,14,3,'#6b3f29');
  R_(c,x-5,ky-10,10,6,'#a43b32');
  R_(c,x-3,ky-15,6,5,'#edc69d');
  R_(c,x-3,ky-15,6,2,'#17130f');
  R_(c,x+(fl?-3:2),ky-12,1,1,'#5a2a22');
  R_(c,x-10,ky-21,20,3,'#17130f');
  R_(c,x-8,ky-22,16,1,'#d5b15b');
  R_(c,x-9,ky-18,2,15,'#2d241a');R_(c,x+7,ky-18,2,15,'#2d241a');
  [-17,17].forEach((dx,i)=>drawPerson(c,x+dx,y,Object.assign({frame:f+i,faceLeft:fl},DMY_BEARER)));
  R_(c,x-23,ky-19,46,2,'#3a2a1a');
  R_(c,x-23,ky-20,46,1,'#7b542c');
  return;
  R_(c,x-21,y-18-bob,42,2,'#3a2a1a');                    // 轎棒
  R_(c,x-8,y-30-bob,16,13,'#1a1612');R_(c,x-7,y-29-bob,14,11,'#5a2a2a');   // 轎身（黑漆、紅簾）
  R_(c,x-5,y-27-bob,10,5,'#e8dcc4');                    // 簾窗
  R_(c,x-10,y-33-bob,20,3,'#1a1612');R_(c,x-10,y-33-bob,20,1,'#e5a93b');   // 屋頂與金邊
}
/* ═════ [05h_yard] ═════ */
/* ★主畫面院子小景（第三百二十一節）：
 *  - 荷車：讀上一份旬報，有進貨（大盤到貨、委託採買歸來）就有人足推車進倉，有出貨（相場出貨）就推車從倉裡出來；車上的貨依行業畫。
 *  - 陸運馬隊（本旬出發的陸路委託採買）、飛腳（本旬寄出的信）、失火後兩旬內倉庫的焦痕與煙、屋頂的烏鴉、打盹的貓、冬天掃雪的丁稚。
 *  - 大名行列當旬不推車、不出馬隊與飛腳；節慶當旬推車的間隔加倍。都不能點，沒有畫面文字。 */
const YARD={planT:-1e9,plan:null,carts:[],horses:[],runner:null,nextCart:0,nextHorse:0,nextRunner:0,turn:-1,flow:0,crows:null,smoke:[],catT:0};
const YARD_KURA=[[34,75],[226,75],[274,75]];
const YARD_LANE=150,YARD_DOOR=112;
/** 價值分三級：決定一趟幾台車。 */
const yardTier=v=>v<=0?0:v<1500?1:v<6000?2:3;
/** 依目前狀態整理要演的東西（每秒重算一次，很便宜）。 */
function yardPlan(){
  const R=G.report||{};let inV=0,outV=0;
  (G.arrived||[]).forEach(a=>{const c=COMM_MAP[a.name];if(a.qty>0&&c)inV+=a.qty*c.base});
  (R.voy||[]).forEach(E=>(E.items||[]).forEach(it=>{const got=(it.q||0)-(it.lost||0);if(got>0)inV+=got*(it.unit||1)}));
  (R.ship||[]).forEach(s=>{outV+=s.rev||0});
  const land=(G.ships||[]).some(s=>s.mode==='land'&&s.eta===s.eta0);
  const letter=Object.values(G.rel||{}).some(r=>r&&r.ltrT===G.turn);
  const fire=G.fireT!=null&&G.turn-G.fireT<=1;
  return {inN:yardTier(inV),outN:yardTier(outV),land,letter,fire};
}
/** 人足的外觀（藍半纏、頭巾）。 */
const YARD_LOOK={cloth:'#3e5f7c',cloth2:'#e8dcc4',pants:'#2b2a2a',obi:'#c8b48a',variant:3};
/** 一趟荷車：從邊上沿走道到倉門前，停一下裝卸，再原路回去。 */
function yardCart(flow,idx,delay){
  const n=Math.max(1,Math.min(G.wh.n,YARD_KURA.length)),ki=idx%n,[kx]=YARD_KURA[ki],door=kx+20,left=ki===0,edge=left?-34:354;
  const pts=[[edge,YARD_LANE],[door,YARD_LANE],[door,YARD_DOOR],[door,YARD_LANE],[edge,YARD_LANE]];
  return {flow,pts,seg:0,x:edge,y:YARD_LANE,dir:left?1:-1,wait:delay,stop:0,load:flow==='in',frame:0,ft:0,dist:0};
}
/** 推進荷車、馬隊、飛腳。 */
function yardStep(now,dt){
  const P=YARD.plan,calm=!(typeof daimyoScene==='function'&&daimyoScene()),fest=typeof festScene==='function'&&festScene();
  if(G.turn!==YARD.turn){YARD.turn=G.turn;YARD.nextCart=now+1500;YARD.nextHorse=now+3000;YARD.nextRunner=now+2500}
  if(!calm){YARD.carts=[];YARD.horses=[];YARD.runner=null}
  if(calm&&P&&!YARD.carts.length&&now>=YARD.nextCart){
    const flows=[];if(P.inN)flows.push('in');if(P.outN)flows.push('out');
    if(flows.length){const f=flows[YARD.flow++%flows.length],k=f==='in'?P.inN:P.outN;for(let i=0;i<k;i++)YARD.carts.push(yardCart(f,i,i*5200))}
    YARD.nextCart=now+(16000+Math.random()*8000)*(fest?2:1);
  }
  YARD.carts.forEach(c=>{
    if(c.wait>0){c.wait-=dt;return}
    if(c.stop>0){c.stop-=dt;if(c.stop<=0)c.load=c.flow==='out';return}
    const [tx,ty]=c.pts[c.seg+1]||c.pts[c.seg],dx=tx-c.x,dy=ty-c.y,d=Math.hypot(dx,dy),v=22*dt/1000;
    if(d<=v){c.x=tx;c.y=ty;c.seg++;if(c.seg===2)c.stop=1700;if(c.seg>=c.pts.length-1)c.done=true;return}
    c.x+=dx/d*v;c.y+=dy/d*v;c.dist+=v;if(Math.abs(dx)>0.5)c.dir=dx>0?1:-1;
    c.ft+=dt;if(c.ft>165){c.ft=0;c.frame++}
  });
  YARD.carts=YARD.carts.filter(c=>!c.done);
  if(calm&&P&&P.land&&!YARD.horses.length&&now>=YARD.nextHorse){
    YARD.horses=[{x:150,y:146,k:0},{x:128,y:147,k:1}];YARD.nextHorse=now+40000+Math.random()*15000;
  }
  YARD.horses.forEach(h=>{h.x+=14*dt/1000;h.ft=(h.ft||0)+dt;if(h.ft>200){h.ft=0;h.frame=(h.frame||0)+1}});
  YARD.horses=YARD.horses.filter(h=>h.x<380);
  if(calm&&P&&P.letter&&!YARD.runner&&now>=YARD.nextRunner){YARD.runner={x:126,y:114,seg:0,frame:0,ft:0};YARD.nextRunner=now+30000+Math.random()*10000}
  const r=YARD.runner;
  if(r){const v=55*dt/1000;if(r.seg===0){r.y+=v;if(r.y>=156){r.y=156;r.seg=1}}else r.x-=v;r.ft+=dt;if(r.ft>90){r.ft=0;r.frame++}if(r.x<-20)YARD.runner=null}
}
/** 車上的貨，依行業畫。 */
function yardLoad(c,x,y,k){
  const B=(dx,dy,w,h,col)=>R_(c,x+dx,y+dy,w,h,col);
  if(k==='grain'||k==='marine'){const s=k==='grain'?['#d8c27a','#9c8443']:['#ebe6d8','#a59f8e'];[[-9,-4],[-3,-4],[3,-4],[-6,-8],[0,-8]].forEach(([dx,dy])=>{B(dx,dy,6,4,s[0]);B(dx+1,dy,1,4,s[1]);B(dx+4,dy,1,4,s[1])});return}
  if(k==='pickle'){[-9,-3,3].forEach(dx=>{B(dx,-6,6,6,'#8a5a2e');B(dx,-5,6,1,'#3b2a1c');B(dx,-2,6,1,'#3b2a1c');B(dx+1,-7,4,1,'#c9a46a')});return}
  if(k==='sake'){[-9,1].forEach(dx=>{B(dx,-8,8,8,'#e9dcb4');B(dx,-6,8,1,'#8a6a3a');B(dx,-2,8,1,'#8a6a3a');B(dx+3,-5,2,2,'#b3261e')});return}
  if(k==='timber'){[-4,-6,-8].forEach((dy,i)=>{B(-11+i,dy,24-i,2,'#9a6a3a');B(-11+i,dy,2,2,'#d9b07a')});return}
  if(k==='mining'){[[-9,-4],[-2,-4],[5,-4],[-5,-7]].forEach(([dx,dy])=>{B(dx,dy,6,4,'#55585e');B(dx,dy,6,1,'#8a8f96')});return}
  if(k==='textile'){[['#2f4f7f',-9,-3],['#a83a3a',-2,-3],['#e8e2d2',5,-3],['#6b7a3a',-5,-6],['#2f4f7f',2,-6]].forEach(([col,dx,dy])=>{B(dx,dy,6,3,col);B(dx,dy,1,3,'#0003')});return}
  if(k==='medicine'){[[-9,-5],[-1,-5],[-5,-9]].forEach(([dx,dy])=>{B(dx,dy,7,5,'#2a2622');B(dx+3,dy,1,5,'#a8323a');B(dx,dy+2,7,1,'#a8323a')});return}
  [[-9,-5],[-1,-5],[-5,-9]].forEach(([dx,dy])=>{B(dx,dy,7,5,'#c9a46a');B(dx,dy+2,7,1,'#7a5a32');B(dx+3,dy,1,5,'#7a5a32')});   // 陶磁雅玩等：稻草包的木箱
}
/** 大八車（側面）：車台、大輪、拉桿。 */
function yardCartDraw(c,x,y,dir,dist,load){
  x=Math.round(x);y=Math.round(y);
  R_(c,x-11,y-1,22,2,'#0003');
  if(load)yardLoad(c,x,y-10,G.sysKey);
  R_(c,x-12,y-10,24,2,'#7a4e2a');R_(c,x-12,y-8,24,1,'#4a2f1c');
  R_(c,x+dir*12,y-10,dir>0?8:-8,1,'#5a3a22');R_(c,x+dir*19-1,y-11,2,2,'#5a3a22');   // 拉桿
  const wx=x-dir*2,wy=y-5,sp=Math.floor(dist/3)%2;
  R_(c,wx-4,wy-4,8,8,'#3b2a1c');R_(c,wx-3,wy-3,6,6,'#8a6a44');R_(c,wx-1,wy-1,2,2,'#3b2a1c');
  if(sp){R_(c,wx-3,wy,6,1,'#3b2a1c');R_(c,wx,wy-3,1,6,'#3b2a1c')}else{R_(c,wx-2,wy-2,1,1,'#3b2a1c');R_(c,wx+1,wy+1,1,1,'#3b2a1c');R_(c,wx+1,wy-2,1,1,'#3b2a1c');R_(c,wx-2,wy+1,1,1,'#3b2a1c')}
}
/** 馱馬（側面）與牽馬人。 */
function yardHorseDraw(c,h){
  const x=Math.round(h.x),y=Math.round(h.y),f=(h.frame||0)%2;
  R_(c,x-8,y-1,18,2,'#0003');
  [-6,-3,4,7].forEach((dx,i)=>R_(c,x+dx,y-5+((i+f)%2),2,5-((i+f)%2),'#4a2c18'));
  R_(c,x-8,y-11,17,6,'#7a4a2a');R_(c,x+8,y-14,3,6,'#7a4a2a');R_(c,x+10,y-15,4,3,'#7a4a2a');R_(c,x+12,y-14,1,1,'#1a1612');
  R_(c,x-9,y-11,2,4,'#3b2a1c');R_(c,x+7,y-15,2,4,'#3b2a1c');                   // 尾、鬃
  R_(c,x-6,y-15,12,4,'#c9a46a');R_(c,x-6,y-13,12,1,'#7a5a32');R_(c,x-7,y-11,3,4,'#b08a52');R_(c,x+5,y-11,3,4,'#b08a52');   // 貨包
}
/** 冬天掃雪的掃帚與雪花（畫在丁稚身上）。 */
function yardBroom(c,e){
  const x=Math.round(e.x),y=Math.round(e.y),d=e.dir<0?-1:1,sw=Math.floor((e.pt||0)/260)%2;
  for(let i=0;i<6;i++)R_(c,x+d*(2+i)+(sw?d:0),y-9+i,1,1,'#8a6a3a');
  R_(c,x+d*7+(sw?d:0)-1,y-3,4,3,'#c9a85a');
  if(sw)R_(c,x+d*11,y-4,2,1,'#ffffff');else R_(c,x+d*12,y-6,1,1,'#ffffff');
}
/** 背景層：失火的焦痕與煙、屋頂的烏鴉、打盹的貓（畫在倉與主屋之後、人物之前）。 */
function yardBack(c,now,dt){
  if(now-YARD.planT>1000){YARD.plan=yardPlan();YARD.planT=now}
  const P=YARD.plan||{},n=Math.min(G.wh.n,YARD_KURA.length);
  if(P.fire){
    for(let i=0;i<n;i++){const [x,y]=YARD_KURA[i];c.fillStyle='#2a201899';c.fillRect(x+4,y+11,9,7);c.fillRect(x+27,y+4,8,10);c.fillRect(x+16,y-6,10,3);c.fillStyle='#1a141066';c.fillRect(x+3,y+18,14,4)}
    if(Math.random()<dt/260){const [x,y]=YARD_KURA[0];YARD.smoke.push({x:x+16+Math.random()*10,y:y-14,r:2,a:0.55})}
  }
  YARD.smoke.forEach(s=>{s.y-=7*dt/1000;s.x+=Math.sin((now/700)+s.r)*0.15+0.05;s.r+=1.6*dt/1000;s.a-=0.12*dt/1000;c.fillStyle='rgba(90,86,82,'+Math.max(0,s.a).toFixed(2)+')';c.fillRect(Math.round(s.x-s.r),Math.round(s.y-s.r),Math.round(s.r*2),Math.round(s.r*2))});
  YARD.smoke=YARD.smoke.filter(s=>s.a>0&&s.y>-10);
  // 屋頂的烏鴉：偶爾飛走一圈再回來
  if(!YARD.crows)YARD.crows=[{hx:142,x:142,y:22,st:'sit',t:3000+Math.random()*9000},{hx:166,x:166,y:22,st:'sit',t:6000+Math.random()*12000}];
  YARD.crows.forEach(w=>{
    w.t-=dt;
    if(w.st==='sit'){if(w.t<=0){w.st=Math.random()<0.35?'fly':'hop';w.t=w.st==='fly'?0:300}}
    else if(w.st==='hop'){if(w.t<=0){w.st='sit';w.t=4000+Math.random()*9000}}
    else if(w.st==='fly'){w.x+=34*dt/1000;w.y=22-Math.min(18,(w.x-w.hx)*0.4);if(w.x>340){w.st='away';w.t=8000+Math.random()*8000}}
    else if(w.st==='away'){if(w.t<=0){w.st='back';w.x=-10;w.y=6}}
    else if(w.st==='back'){w.x+=34*dt/1000;w.y=Math.min(22,6+(w.x/w.hx)*16);if(w.x>=w.hx){w.x=w.hx;w.y=22;w.st='sit';w.t=6000+Math.random()*10000}}
    if(w.st==='away')return;
    const x=Math.round(w.x),y=Math.round(w.y)-(w.st==='hop'?1:0);
    if(w.st==='fly'||w.st==='back'){const up=Math.floor(now/120)%2;R_(c,x-1,y-1,3,2,'#141414');R_(c,x-4,y-1-(up?2:0),3,1,'#141414');R_(c,x+2,y-1-(up?2:0),3,1,'#141414')}
    else{R_(c,x-2,y-3,4,3,'#141414');R_(c,x+1,y-4,2,2,'#141414');R_(c,x+3,y-4,1,1,'#5a5a5a');R_(c,x-3,y-2,1,2,'#141414');R_(c,x-1,y,1,1,'#3a3a3a');R_(c,x+1,y,1,1,'#3a3a3a')}
  });
  // 打盹的貓（主屋右側牆角），尾巴偶爾甩一下
  YARD.catT+=dt;const cx=212,cy=110,fl=(YARD.catT%5200)<500?(Math.floor(YARD.catT/120)%2):0;
  R_(c,cx-4,cy-1,9,2,'#0002');R_(c,cx-4,cy-4,8,4,'#ece6d8');R_(c,cx-2,cy-4,3,2,'#c07a3a');R_(c,cx+2,cy-3,2,2,'#2a2622');
  R_(c,cx+3,cy-6,3,3,'#ece6d8');R_(c,cx+3,cy-7,1,1,'#c07a3a');R_(c,cx+5,cy-7,1,1,'#ece6d8');R_(c,cx+4,cy-5,1,1,'#3a3230');
  R_(c,cx-6,cy-2-fl,3,1,'#c07a3a');
}
/** 人物層：荷車與人足、馬隊、飛腳（跟其他人物一起依前後排序）。 */
function yardPeople(now,dt){
  yardStep(now,dt);const out=[];
  YARD.carts.forEach(k=>{if(k.wait>0)return;out.push({y:k.y,draw:c=>{
    const mv=!(k.stop>0),o=Object.assign({frame:mv?k.frame:0,moving:mv,faceLeft:k.dir<0,pose:mv?'':'hold',pt:now},YARD_LOOK);
    drawPerson(c,k.x+k.dir*19,k.y,o);
    yardCartDraw(c,k.x,k.y,k.dir,k.dist,k.load);
    drawPerson(c,k.x-k.dir*15,k.y,Object.assign({},o,{variant:5}));
  }})});
  YARD.horses.forEach(h=>out.push({y:h.y,draw:c=>{yardHorseDraw(c,h);if(h.k===0)drawPerson(c,h.x+18,h.y,Object.assign({frame:h.frame||0,moving:true},YARD_LOOK,{hat:'#8a6a3a'}))}}));
  const r=YARD.runner;if(r)out.push({y:r.y,draw:c=>drawPerson(c,r.x,r.y,Object.assign({frame:r.frame,moving:true,faceLeft:r.seg===1},RANK_LOOK.courier,{variant:7}))});
  return out;
}
