'use strict';
/* ======================= 災情救濟請託（第一百四十九節） =======================
 *  大火、凶作、颱風、疫病（含城史記載的大火、大疫、饑荒）發生的那一旬，記為「本城災情」（G.disaster），主畫面右上角提醒。
 *  只有事件當旬，三系三階以上、交情 60 以上的官員，請託清單會各多一項救濟；同一場災情每系只能辦一次。期間外完全不出現，職位說明也不列。
 *   行政：御救小屋合辦（現款 800 兩，大型施粥）／財務：緊急御免（兩旬內大盤進貨上限加倍、漲價的貨照災前價格進）／司法：普請御用（官府高價收購本業貨）。
 *  數值在 01c_odds.js 的 ODDS.relief；花費 COSTS.reliefSoup。 */
const RELIEF_KEY={administration:'reliefSoup',finance:'reliefImport',judiciary:'reliefBuild'};
FAVORS.administration.push(favorText({k:'reliefSoup',rank:3,relief:true}));
FAVORS.finance.push(favorText({k:'reliefImport',rank:3,relief:true}));
FAVORS.judiciary.push(favorText({k:'reliefBuild',rank:3,relief:true}));
/** 記下本城災情（事件當旬）。type：fire、famine、typhoon、plague。 */
function markDisaster(type){if(!G)return;if(G.disaster&&G.disaster.turn===G.turn)return;G.disaster={type,turn:G.turn,done:{}}}
/** 本旬是否正逢災情。 */
const disasterNow=()=>!!(G&&G.disaster&&G.disaster.turn===G.turn);
/** 這一系的救濟本旬還能不能辦。 */
const reliefOpen=court=>disasterNow()&&!G.disaster.done[court];
/** 私梟收黑貨的時機：本城節慶當旬或災情當旬（第一百五十二節）。 */
const blackMarketOpen=()=>!!(G&&(festActive()||disasterNow()));
/** 緊急御免期間（本旬與下一旬）。 */
const reliefImportOn=()=>!!(G&&G.reliefBuy>G.turn);
/** 緊急御免：漲價的貨照災前價格（不計事件倍率）。 */
function reliefPrice(name){const m=G.mk[name],ev=m.ev;if(!(ev>1))return null;m.ev=1;const p=marketIndex(name,true);m.ev=ev;return p}
/** 普請御用：官府收購的貨（每項本業貨最多約兩旬配額）。 */
function reliefBuildLots(){
  return tradeComms().map(c=>{const n=c.name,have=G.inv[n]||0,want=Math.max(1,Math.round(ODDS.relief.buildTurns*Math.max(quotaOf(n),supplyLine(n))));return {c,q:Math.min(have,want)}}).filter(x=>x.q>0);
}
/** 執行救濟請託（doFavor 呼叫）；不扣好感。 */
function doRelief(cid,n,r,f){
  const court=n.pos.court,R_=ODDS.relief;
  if(!reliefOpen(court))return {ok:true,status:'held',msg:MSG('relief.closed')};
  let msg;
  if(f.k==='reliefSoup'){
    if(!afford('reliefSoup'))return {ok:true,status:'held',msg:shortMsg('reliefSoup')};
    spend('reliefSoup');
    const fm=addFame(R_.soupFame,'major');G.heat=Math.max(0,(G.heat||0)-R_.soupHeat);
    Object.keys(G.mk).forEach(k=>{if(COMM_MAP[k].staple)G.mk[k].ev=Math.max(1,G.mk[k].ev*R_.soupStaple)});
    syncPrices();G.staple.streak=0;G.staple.idx=Math.max(...STAPLE_KEYS.map(stapleIndex));
    setAff(r,clamp(r.aff+R_.soupAff,0,100));
    msg=MSG('relief.soup',{f:fm});pushNews(NEWS('relief.soup',{n:nameOf(cid)}));
  }else if(f.k==='reliefImport'){
    G.reliefBuy=G.turn+R_.importTurns;const fm=addFame(R_.importFame,'major');
    msg=MSG('relief.import',{f:fm});pushNews(NEWS('relief.import'));
  }else{
    const L=reliefBuildLots();if(!L.length)return {ok:true,status:'held',msg:MSG('relief.buildNone')};
    let rev=0;L.forEach(({c,q})=>{const p=Math.round(G.mk[c.name].price*R_.buildMul*q);G.inv[c.name]-=q;rev+=p});
    G.silver+=rev;const fm=addFame(R_.buildFame,'major');
    msg=MSG('relief.build',{g:L.map(x=>x.c.short+' × '+x.q).join(NAMES_SEP),a:fmt(rev),f:fm});pushNews(NEWS('relief.build',{a:fmt(rev)}));
  }
  G.disaster.done[court]=true;
  logRel(cid,MSG('log.relief',{f:f.name,m:msg}));
  return {ok:true,status:'done',msg};
}
