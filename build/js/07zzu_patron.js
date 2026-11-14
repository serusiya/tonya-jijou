'use strict';
/* ★檔案總覽：貴人訂貨（奢侈品的訂單；DESIGN_NOTES 第二百六十九、二百七十五節）
 * - 奢侈品照舊在相場（冷熱循環、地板價不變），另外有大官貴人的訂單，是「一賣吃三年」的主要來源。
 * - 誰會訂：本城三系四階以上官員（巡迴的五、六階只在來城那個月），以及番付身代欄上榜的旅商（大關約當六階、關脇與小結五階、前頭四階）；
 *   好感 80 以上、不是仇人才找你；只訂你有交易許可的本業奢侈品。
 * - 什麼時候：本城節慶與歲末（12 月下旬）兩段；交貨在節慶當旬或 12 月下旬那一次推進，訂單在交貨前約兩個月到一個月之間上門（回府時事件）。
 * - 份量：四階 1～2 件、五階 2～3 件、六階 3～5 件；每三到五年挑一段「大年」，件數加倍。開價基準價 2.5～3.5 倍，接下時說定。
 * - 同時最多八張（含還沒回覆的上門），每位貴人一季一張。由本店負責交貨：列在相場「📦 合約」卡，可以提早填貨；不算本城出貨。
 * - 交齊：現款入帳、對方好感 +10、知名度 +2～3（中事件）；旅商的轉手利潤記進他的身代。交不齊：失約，好感 −30、知名度 −2。
 * - 狀態 G.patron={y,seasons:[{k,due,from,to,big,asked:{}}],bigY,bigK,orders:[{id,cid,name,qty,unit,due,filled,k}]}；數值 ODDS.patron；
 *   台詞 LINES.patron；文字 pt.*（01e）；新聞 pt.*（01g）。每旬 patronTick（advanceTurn，upkeep 之後）。 */
const PT=()=>ODDS.patron;
const ptState=()=>G.patron||(G.patron={y:null,seasons:[],bigY:G.year+rint(PT().bigEvery[0],PT().bigEvery[1]),bigK:null,orders:[]});
const ptOrders=()=>ptState().orders;
/** 某年月旬的旬數。 */
const ptTurnOf=(y,m,c)=>G.turn+(y-G.year)*36+(m-G.month)*3+(c-G.cycle);
/** 能接單的奢侈品（本業、有交易許可）。 */
const ptGoods=()=>tradeComms().filter(c=>c.luxury);
/** 排今年與明年的兩段（節慶、歲末）：一月的節慶要在前一年就排，上門期才來得及。 */
function ptPlan(){
  const S=ptState(),P=PT();if(S.y===G.year)return;
  S.y=G.year;S.seasons=S.seasons.filter(x=>x.due>G.turn);
  const f=homeCity().special_festival;
  [G.year,G.year+1].forEach(y=>{
    const L=[];
    if(f&&f.month&&f.cycle)L.push({k:'fest',due:ptTurnOf(y,f.month,f.cycle)+1});
    L.push({k:'year',due:ptTurnOf(y,12,3)+1});
    if(S.bigY===y&&!S.bigK)S.bigK=pick(L).k;
    L.forEach(x=>{if(x.due-1<=G.turn||S.seasons.some(z=>z.due===x.due))return;S.seasons.push({k:x.k,y,due:x.due,from:x.due-1-P.lead[1],to:x.due-1-P.lead[0],big:S.bigY===y&&S.bigK===x.k,asked:{}})});
  });
}
/** 貴人的份量等級（4～6）；不是貴人回傳 0。 */
function ptTier(cid){
  const n=npc(cid);if(!n||!alive(cid)||n.cityId!==G.cityId||jailed(n))return 0;
  if(n.role==='official'&&n.pos&&CITY_COURTS.includes(n.pos.court)&&n.pos.rank>=4)return touring(n)&&!tourHere(n)?0:Math.min(6,n.pos.rank);
  if(n.role==='guest'&&!n.hired){const B=bzLast(),row=B&&B.w&&B.w.find(r=>r.k===cid);if(row)return row.i===0?6:row.i<=2?5:4}
  return 0;
}
/** 這一季會找你的貴人。 */
function ptBuyers(){
  const C=new Set();Object.values(G.world.npcs).forEach(n=>{if(n.cityId===G.cityId&&(n.role==='official'||n.role==='guest'))C.add(n.cid)});
  return [...C].filter(cid=>{const r=G.rel[cid];return r&&r.aff>=PT().aff&&!isEnemy(cid)&&ptTier(cid)>0});
}
/** 還沒交貨的單＋還沒回覆的上門。 */
const ptBusy=()=>ptOrders().length+homeQ().filter(e=>e.type==='patron'&&e.turn===G.turn).length;
/** 開一張單（份量、開價照當下）。 */
function ptOffer(cid,S){
  const P=PT(),cs=ptGoods();if(!cs.length)return null;
  const c=pick(cs),t=ptTier(cid),r=P.qty[t];if(!r)return null;
  let q=rint(r[0],r[1]);if(S.big)q*=P.bigMult;
  const unit=Math.round(c.base*(P.price[0]+rnd()*(P.price[1]-P.price[0]))*10)/10;
  return {cid,name:c.name,qty:q,unit,due:S.due,k:S.k,big:!!S.big};
}
/** 每旬：排程、上門、交貨。 */
function patronTick(log){
  if(!G||!G.world)return;
  ptPlan();const S0=ptState(),P=PT();
  // 交貨（到期那一次推進）
  S0.orders.filter(o=>o.due<=G.turn).forEach(o=>{
    S0.orders=S0.orders.filter(x=>x!==o);
    const have=G.inv[o.name]||0,c=COMM_MAP[o.name],nm=nameOf(o.cid),r=R(o.cid);
    if(have>=o.qty){
      const rev=Math.round(o.qty*o.unit);stockTake(o.name,o.qty,false);G.silver+=rev;G.lastRev+=rev;G.life.peak=Math.max(G.life.peak,G.silver);
      setAff(r,r.aff+P.doneAff);const f0=G.fame||0;addFame(rint(P.fame[0],P.fame[1]),'mid');const gf=Math.round(((G.fame||0)-f0)*10)/10;
      bzDeal(o.cid,Math.round(o.qty*(c.base*P.resell)),c.name);   // 旅商轉手的利潤記進他的身代（官員不記）
      logRel(o.cid,UT('pt.log.done',{g:c.short,q:o.qty,a:fmt(rev)}));
      const t=NEWS('pt.done',{n:nm,g:c.short,q:o.qty,a:fmt(rev),f:gf});pushNews(t);log.push(t);sfx.coin();
    }else{
      setAff(r,Math.max(0,r.aff-P.failAff));loseFame('patronFail');
      logRel(o.cid,UT('pt.log.fail',{g:c.short,q:o.qty}));
      const t=NEWS('pt.fail',{n:nm,g:c.short,q:o.qty,h:have,a:P.failAff});pushNews(t);log.push(t);sfx.bad();
    }
    o.filled=0;
  });
  S0.seasons=S0.seasons.filter(x=>x.due>G.turn);
  if(S0.bigK&&S0.bigY<=G.year&&!S0.seasons.some(x=>x.big)){S0.bigY=G.year+rint(P.bigEvery[0],P.bigEvery[1]);S0.bigK=null;S0.y=null}   // 大年那一段過了：排下一次（下一旬重排季程）
  // 上門（回府時事件）
  if(moving()||!ptGoods().length)return;
  S0.seasons.filter(x=>G.turn>=x.from&&G.turn<=x.to).forEach(S=>{
    if(S.big&&!S.told){S.told=true;const t=NEWS('pt.bigRumor');pushNews(t);log.push(t)}
    shuffle(ptBuyers()).forEach(cid=>{
      if(S.asked[cid]||ptBusy()>=P.max||!chance(P.p))return;
      const o=ptOffer(cid,S);if(!o)return;S.asked[cid]=true;queueHomeEvent({type:'patron',cid,o});
    });
  });
}
/* ---------- 上門的視窗 ---------- */
FACE_TITLE.patron='pt.ask.t';
FACE_EXT.patron=(e,name)=>{
  const o=e.o;if(!o||ptOrders().length>=PT().max||!tradeOK(o.name))return null;
  UI.s.ptOffer=o;const c=COMM_MAP[o.name],n=npc(o.cid),off=n&&n.role==='official';
  const when=UT(o.k==='fest'?'pt.when.fest':'pt.when.year',{f:(homeCity().special_festival||{}).name||''});
  return {line:TX(off?'patron.official':'patron.guest',{g:c.short,w:when}),effect:UT('pt.ask.eff',{g:c.short,q:o.qty,u:fmt1(o.unit),a:fmt(Math.round(o.qty*o.unit)),w:when,t:Math.max(1,o.due-1-G.turn)})+(o.big?UT('pt.ask.big'):''),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="ptTake">'+UT('btn.ptTake')+'</button><button class="pixel-btn btn-sm" data-act="faceNext">'+UT('btn.ptPass')+'</button></div>'};
};
ACT.ptTake=()=>{
  const o=UI.s.ptOffer;UI.s.ptOffer=null;if(!o)return UI.hideInfo();
  if(ptOrders().length>=PT().max){toast(UT('pt.full'));return UI.hideInfo()}
  if(moving()){toast(UT('mv.noNew'));return UI.hideInfo()}
  const c=COMM_MAP[o.name];
  ptOrders().push(Object.assign({id:G.turn+'_'+Math.floor(rnd()*1e5),filled:0},o));
  logRel(o.cid,UT('pt.log.take',{g:c.short,q:o.qty}));
  toast(UT('pt.taken',{n:nameOf(o.cid),g:c.short,q:o.qty,t:Math.max(1,o.due-1-G.turn)}),4600);sfx.tap();UI.hideInfo();UI.render();
};
/* ---------- 接進合約卡（照上貢的做法：本店負責、可以提早填貨） ---------- */
{const _x=pactExtras;pactExtras=function(){const L=_x.apply(this,arguments);if(G&&G.patron)ptOrders().forEach(o=>{if(COMM_MAP[o.name])L.push({kind:'patron',ref:o,cid:o.cid,name:o.name,qty:o.qty,due:G.turn+1>=o.due})});return L}}
