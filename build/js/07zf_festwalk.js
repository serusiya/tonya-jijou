'use strict';
/* ======================= 逛祭典（本城節慶那一旬） =======================
 *  - 入口：節慶那一旬，主畫面「出門前往」上方出現一整列按鈕「🏮 逛祭典：○○」。扣 1 行動；不擲出門遇襲（人潮擁擠）；
 *    每次節慶只能逛一次（G.festWalkT＝逛過的那一旬）；養傷、遠島期間不能逛。
 *  - 逛一次抽一件：① 撿到好東西 25%（非本業奢侈品 1 單位入他行貨）② 巧遇名伶 25%（好感 +5，只有對話）
 *    ③ 官員微服出遊 15%（一～四階本城官員好感 +5，看出他的性向）④ 扒手 15%（現款 1～3%、最多 300 兩；家中有保鏢則抓住扒手）
 *    ⑤ 闔家同遊 20%（有夫人、子女或側室才會抽到；側室好感 +5）。抽到的事件不成立時（倉位不足、沒有對象），改從成立的事件中重抽。 */
const FEST_WALK_W={item:25,oiran:25,official:15,thief:15,family:20};
/** 開頭的祭典氛圍句（{f}＝節慶名）。 */
const FEST_OPEN=[
  '「{f}」的燈籠一路掛到河岸，人潮擠得水洩不通。',
  '太鼓聲從街口傳來，「{f}」的攤販一家挨著一家。',
  '神轎剛過，「{f}」的人群跟著吆喝，街上熱鬧得像煮沸的鍋。',
  '入夜後「{f}」更熱鬧了，提燈映得滿街通紅。'
];
const festWalked=()=>!!G&&G.festWalkT===G.turn;
/** 主畫面的逛祭典按鈕列（不是節慶時不顯示）。 */
function festWalkHtml(){
  if(!G||!G.festival)return '';
  const done=festWalked();
  return '<button class="pixel-btn '+(done?'':'btn-gold')+'" style="width:100%;margin-top:6px" data-act="festWalk"'+(done?' disabled':'')+'>🏮 逛祭典：'+esc(G.festival)+(done?'<div class="tiny">今年的祭典已經逛過了</div>':'<div class="tiny">扣 1 行動，每次節慶只能逛一次</div>')+'</button>';
}
/** 各事件是否成立，回傳 {key:資料}。 */
function festCands(){
  const C={};
  const room=invCap()-invUsed()-pendingQty();
  const lux=COMM.filter(c=>c.luxury&&c.sys!==G.sysKey);
  if(room>=1&&lux.length)C.item={c:pick(lux)};
  const oi=oiranAll().filter(n=>alive(n.cid));if(oi.length)C.oiran={n:pick(oi)};
  const of=officialsOf(G.cityId).filter(n=>n.pos.rank<=4&&!awayNow(n)&&!isEnemy(n.cid));if(of.length)C.official={n:pick(of)};
  C.thief={};
  if(G.family.spouse||(G.family.kids||[]).length||(G.family.conc||[]).length)C.family={};
  return C;
}
/** 抽一件事件並套用效果，回傳 {cid,txt,eff}。 */
function festWalkRoll(){
  const C=festCands(),keys=Object.keys(FEST_WALK_W).filter(k=>C[k]);
  let r=rnd()*keys.reduce((a,k)=>a+FEST_WALK_W[k],0),k=keys[0];
  for(const x of keys){r-=FEST_WALK_W[x];if(r<=0){k=x;break}}
  const D=C[k];
  if(k==='item'){
    G.xinv=G.xinv||{};G.xinv[D.c.name]=(G.xinv[D.c.name]||0)+1;
    return {txt:MSG('fest.item',{n:D.c.short}),eff:'拾得「'+D.c.short+'」× 1（放進他行貨，可請座客商人代售）'};
  }
  if(k==='oiran'){
    const cid=D.n.cid,r0=R(cid);addKnown(cid);addAff(r0,5);logRel(cid,'在「'+G.festival+'」上巧遇，說了幾句話。好感 +5。');
    return {cid,txt:MSG('fest.oiran',{n:nameOf(cid)}),eff:'「'+nameOf(cid)+'」好感 +5'};
  }
  if(k==='official'){
    const cid=D.n.cid,r0=R(cid),known=r0.topKnown;addKnown(cid);addAff(r0,5);r0.topKnown=true;logRel(cid,'換上便服逛「'+G.festival+'」，與你寒暄幾句。好感 +5。');
    return {cid,txt:MSG('fest.official',{n:nameOf(cid),t:offTitle(D.n)}),eff:'「'+nameOf(cid)+'」好感 +5'+(known?'':'；看出了他的性向（人物卡可查看）')};
  }
  if(k==='thief'){
    if(guardCount()>0)return {txt:MSG('fest.thiefCaught'),eff:'保鏢抓住扒手，沒有損失'};
    if(G.silver<=0)return {txt:MSG('fest.thiefEmpty'),eff:'錢袋空空，沒有損失'};
    const loss=Math.min(300,Math.max(1,Math.round(G.silver*(0.01+rnd()*0.02))));G.silver-=loss;
    return {txt:MSG('fest.thief'),eff:'被扒走 '+fmt(loss)+' 兩'};
  }
  const conc=(G.family.conc||[]).map(x=>x.cid).filter(cid=>G.rel[cid]);
  conc.forEach(cid=>{addAff(R(cid),5);logRel(cid,'陪你逛「'+G.festival+'」。好感 +5。')});
  return {txt:MSG('fest.family',{who:famWho()}),eff:conc.length?'側室好感 +5':'一家人和樂融融'};
}
/** 同遊的家人稱呼。 */
function famWho(){const L=[];if(G.family.spouse)L.push('夫人');if((G.family.kids||[]).length)L.push('孩子們');if((G.family.conc||[]).length)L.push('側室');return L.join('、')||'家人'}
/** 官員職稱（找不到時用官階）。 */
function offTitle(n){try{return posTitle(n)}catch(e){return ''}}
ACT.festWalk=()=>{
  if(!G||!G.festival)return;
  if(festWalked()){toast(MSG('fest.done'));return}
  if(injuredBlock())return;
  if(!spendAP())return;
  G.festWalkT=G.turn;
  const fest=G.festival,open=FEST_OPEN[Math.floor(rnd()*FEST_OPEN.length)].replace('{f}',fest);
  const res=festWalkRoll();
  playFx('walk','逛「'+fest+'」……',homeCity().name,()=>{
    UI.showInfo('🏮 '+fest,(res.cid?'<div style="display:flow-root">'+portraitHtml(res.cid,56):'<div>')+'<div class="notice tiny">'+esc(open)+'</div><div class="small" style="margin-top:6px">'+esc(res.txt)+'</div></div>'
      +'<div class="tiny bold" style="margin-top:6px">'+esc(res.eff)+'</div>');
    if(/扒走/.test(res.eff))sfx.bad();else sfx.coin();
    UI.render();
  },900);
};
