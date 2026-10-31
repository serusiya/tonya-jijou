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
  UT('fwalk.FEST_OPEN'),
  UT('fwalk.FEST_OPEN.2'),
  UT('fwalk.FEST_OPEN.3'),
  UT('fwalk.FEST_OPEN.4')
];
const festWalked=()=>!!G&&G.festWalkT===G.turn;
/** 主畫面的逛祭典按鈕列（不是節慶時不顯示）。 */
function festWalkHtml(){
  if(!G||!G.festival)return '';
  const done=festWalked();
  return '<button class="pixel-btn '+(done?'':'btn-gold')+'" style="width:100%;margin-top:6px" data-act="festWalk"'+UT('fwalk.festWalkHtml.3',{a:done?' disabled':'',b:esc(G.festival),c:done?UT('fwalk.festWalkHtml'):UT('fwalk.festWalkHtml.2')})+'</button>';
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
    return {txt:MSG('fest.item',{n:D.c.short}),eff:UT('fwalk.festWalkRoll',{a:D.c.short})};
  }
  if(k==='oiran'){
    const cid=D.n.cid,r0=R(cid);addKnown(cid);addAff(r0,5);logRel(cid,UT('fwalk.festWalkRoll.2',{a:G.festival}));
    return {cid,txt:MSG('fest.oiran',{n:nameOf(cid)}),eff:UT('fwalk.festWalkRoll.3',{a:nameOf(cid)})};
  }
  if(k==='official'){
    const cid=D.n.cid,r0=R(cid),known=r0.topKnown;addKnown(cid);addAff(r0,5);r0.topKnown=true;logRel(cid,UT('fwalk.festWalkRoll.4',{a:G.festival}));
    return {cid,txt:MSG('fest.official',{n:nameOf(cid),t:offTitle(D.n)}),eff:UT('fwalk.festWalkRoll.6',{a:nameOf(cid),b:known?'':UT('fwalk.festWalkRoll.5')})};
  }
  if(k==='thief'){
    if(guardCount()>0)return {txt:MSG('fest.thiefCaught'),eff:UT('fwalk.festWalkRoll.7')};
    if(G.silver<=0)return {txt:MSG('fest.thiefEmpty'),eff:UT('fwalk.festWalkRoll.8')};
    const loss=Math.min(300,Math.max(1,Math.round(G.silver*(0.01+rnd()*0.02))));G.silver-=loss;
    return {txt:MSG('fest.thief'),eff:UT('fwalk.festWalkRoll.9',{a:fmt(loss)}),bad:true};
  }
  const conc=(G.family.conc||[]).map(x=>x.cid).filter(cid=>G.rel[cid]);
  conc.forEach(cid=>{addAff(R(cid),5);logRel(cid,UT('fwalk.festWalkRoll.10',{a:G.festival}))});
  return {txt:MSG('fest.family',{who:famWho()}),eff:conc.length?UT('fwalk.festWalkRoll.11'):UT('fwalk.festWalkRoll.12')};
}
/** 同遊的家人稱呼。 */
function famWho(){const L=[];if(G.family.spouse)L.push(NEWS('fwalk.famWho'));if((G.family.kids||[]).length)L.push(NEWS('fwalk.famWho.2'));if((G.family.conc||[]).length)L.push(NEWS('fwalk.famWho.3'));return L.join(UT('fwalk.famWho.4'))||UT('fwalk.famWho.5')}
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
  playFx('walk',UT('fwalk.festWalk',{a:fest}),homeCity().name,()=>{
    UI.showInfo('🏮 '+fest,(res.cid?'<div style="display:flow-root">'+portraitHtml(res.cid,56):'<div>')+'<div class="notice tiny">'+esc(open)+'</div><div class="small" style="margin-top:6px">'+esc(res.txt)+'</div></div>'
      +'<div class="tiny bold" style="margin-top:6px">'+esc(res.eff)+'</div>');
    if(res.bad)sfx.bad();else sfx.coin();
    UI.render();
  },900);
};
