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
  if(season()==='winter')R_(c,0,108,320,3,'#fff8');
  if(fest){drawNobori(c,now);drawLanterns(c,now)}
  const list=SCENE.ents.map(e=>({y:e.y,draw:c=>{
    const L=entLook(e),nod=e.bowT>0?Math.sin(e.bowT/380*Math.PI)*0.45:0;
    drawPerson(c,e.x,e.y,Object.assign({frame:e.moving?e.frame:0,moving:e.moving,faceLeft:e.dir<0,pose:e.pose,pt:e.pt,bow:nod},L,{small:L.small||e.kind==='kid'&&e.age<12}));
  }}));
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
    if(best){sfx.tap();const m=sceneMember(best);if(m)openChat(m)}
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
