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
  if(!(season()==='夏'||G.cycle===3))return;
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
