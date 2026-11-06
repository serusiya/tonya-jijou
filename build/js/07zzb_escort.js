'use strict';
/* =====================================================================
 * 07zzb_escort.js — 陪同（通用機制）與朋友請你引薦官員（設計筆記第一百七十一節、第一百九十二節）
 *  - 陪同：前往某處時，有人主動說要一起去；玩家只選「帶他去」或「婉拒」。
 *    各目的地登記在 ESCORT（目前只有町奉行所）；0.8 的出遊、花街等照這個方式加一筆。
 *  - 朋友請你引薦官員（ESCORT.yamen）：
 *    前往町奉行所時，有好感 80 以上的商人朋友，想見一位你熟（好感 ≥ 60）的本城三階以下官員，就有機會跳出來。
 *    帶他去：本旬拜訪那位官員、見到面且對話打完，就算引見；拜訪本身照常，不另扣行動點數。
 *    婉拒好感 −10；答應了卻整旬沒去拜訪那位官員，旬末好感 −5；拒見、不在家、被嫌不善言辭不算失約，也沒引見成。
 *  - 狀態：G.escort{f 朋友,o 官員,t 旬,st go／no／done／fail／skip}、G.escortCD（下次可判定的旬）、
 *    G.escortPairs（已引見過的朋友｜官員）、G.escortRisk（日後可能牽連的引見）。都是用到時才建立。
 * ===================================================================== */
/** 各目的地的陪同：roll() 回傳 {f,o} 或 null。 */
const ESCORT={
  yamen:{roll:escortYamenRoll}
};
/** 本旬的同行（狀態 st 可省略）。 */
const escortNow=st=>{const e=G&&G.escort;return e&&e.t===G.turn&&(!st||e.st===st)?e:null};
/** 有符號的好感變化文字。 */
const escSgn=v=>v>=0?'+'+v:'−'+Math.abs(v);
/** 朋友請你引薦官員：可配對的朋友與官員。 */
function escortYamenPairs(){
  const E=ODDS.escort,done=G.escortPairs||[];
  const offs=officialsOf(G.cityId).filter(n=>n.pos.rank<=E.maxRank&&!awayNow(n)&&!snubbed(n.cid)&&!isEnemy(n.cid)&&!roninOfficial(n.cid)
    &&G.rel[n.cid]&&G.rel[n.cid].bond&&G.rel[n.cid].aff>=E.offAff);
  const frs=closeFriends(true).filter(f=>!jailed(f)&&!hiddenSmuggler(f.cid));
  const out=[];
  frs.forEach(f=>offs.forEach(o=>{if(o.cid!==f.cid&&!done.includes(f.cid+'|'+o.cid))out.push({f:f.cid,o:o.cid})}));
  return out;
}
function escortYamenRoll(){
  if(escortNow()||G.turn<(G.escortCD||0))return null;
  const L=escortYamenPairs();if(!L.length||!chance(ODDS.escort.p))return null;
  return pick(L);
}
/** 等待回應的陪同：{f,o,k,cont}。 */
var ESC_OFFER=null;
/** 出門時判定陪同；有人要同行就跳出詢問並回傳 true（回應後再繼續出門）。 */
function escortOffer(k,cont){
  const D=ESCORT[k];if(!D)return false;
  const o=D.roll();if(!o)return false;
  G.escortCD=G.turn+ODDS.escort.cd;                       // 一跳出來就進入冷卻（關掉視窗也不再問）
  ESC_OFFER=Object.assign({k,cont},o);
  const f=o.f,n=npc(f),on=npc(o.o);
  const h='<div class="card" style="display:flow-root">'+portraitHtml(f,56)+'<div><b style="font-size:17px">'+esc(nameOf(f))+'</b> <span class="tag gray">'+esc(ROLE_LABEL[n.role]||'')+'</span></div>'
   +'<div class="small" style="margin:6px 0">'+esc(TX('escort.ask',{o:nameOf(o.o),t:posTitle(on)}))+'</div>'
   +'<div class="grid2"><button class="pixel-btn btn-gold btn-sm" data-act="escortYes">'+UT('btn.escortYes')+'</button><button class="pixel-btn btn-sm" data-act="escortNo">'+UT('btn.escortNo',{a:ODDS.escort.decline})+'</button></div></div>';
  UI.showInfo(UT('escort.title'),h);
  return true;
}
function escortGo(){const o=ESC_OFFER;ESC_OFFER=null;UI.hideInfo();if(o&&o.cont)o.cont()}
ACT.escortYes=()=>{
  const o=ESC_OFFER;if(!o)return;
  G.escort={f:o.f,o:o.o,t:G.turn,st:'go'};
  logRel(o.f,UT('escort.log.yes',{a:nameOf(o.o)}));
  escortGo();
};
ACT.escortNo=()=>{
  const o=ESC_OFFER;if(!o)return;
  const g=ODDS.escort.decline,r=R(o.f);setAff(r,clamp(r.aff-g,0,100));
  G.escort={f:o.f,o:o.o,t:G.turn,st:'no'};
  logRel(o.f,UT('escort.log.no',{a:nameOf(o.o),g}));toast(MSG('escort.no',{f:nameOf(o.f),g}));
  escortGo();
};
/** 奉行所人物卡：同行朋友等著被引見的那位官員，加一行提示。 */
function escortTag(cid){const e=escortNow('go');return e&&e.o===cid?UT('escort.tag',{f:nameOf(e.f)}):''}
/** 拜訪那位官員：門口被拒、不在家，或被嫌不善言辭——引見不成，不扣好感；回傳接在訊息後面的一句。 */
function escortFail(cid,kind){
  const e=escortNow('go');if(!e||e.o!==cid)return '';
  e.st='fail';logRel(e.f,UT('escort.log.fail',{a:nameOf(cid)}));
  return MSG(kind==='snub'?'escort.snub':'escort.door',{f:nameOf(e.f)});
}
/** 拜訪那位官員、對話打完：結算引見，回傳小卡 HTML；這一場不是同行引見時回傳 null。 */
function escortSettle(cid){
  const e=escortNow('go');if(!e||e.o!==cid)return null;
  const E=ODDS.escort,cp=compat(e.f,cid),rf=R(e.f),ro=R(cid);
  const lvl=cp.matches>=2?'good':cp.matches===1?'ok':'bad';
  const df=lvl==='good'?E.friendHi:E.friendLo;
  const dof=(lvl==='good'?rint(E.offHiMin,E.offHiMax):lvl==='bad'?-E.offBad:0)-E.offCost;   // 官員另扣一點：比照介紹人付出的人情
  setAff(rf,clamp(rf.aff+df,0,100));setAff(ro,clamp(ro.aff+dof,0,100));
  e.st='done';(G.escortPairs=G.escortPairs||[]).push(e.f+'|'+cid);
  logRel(e.f,UT('escort.log.done',{a:nameOf(cid),g:escSgn(df)}));
  logRel(cid,UT('escort.log.off',{a:nameOf(e.f),g:escSgn(dof)}));
  const ch=CH(e.f),greed=ch&&ch.derived_stats?ch.derived_stats.greed_index||0:0;
  if(npc(e.f).role==='smuggler'||greed>=E.greedy)(G.escortRisk=G.escortRisk||[]).push({f:e.f,o:cid,at:G.turn+rint(E.riskMin,E.riskMax)});
  return sideCard(e.f,TX('escort.done.'+lvl,{f:nameOf(e.f),o:nameOf(cid)}),UT('escort.gain',{f:nameOf(e.f),a:escSgn(df),o:nameOf(cid),b:escSgn(dof)}));
}
/** 每旬：上一旬答應同行卻沒去拜訪那位官員，好感 −5；引見過的貪心朋友日後可能牽連到你。 */
function escortTick(log){
  const E=ODDS.escort,e=G.escort;
  if(e&&e.st==='go'&&e.t<G.turn){
    e.st='skip';const r=R(e.f);setAff(r,clamp(r.aff-E.skip,0,100));
    logRel(e.f,UT('escort.log.skip',{a:nameOf(e.o),g:E.skip}));
    const t=NEWS('escort.skip',{f:nameOf(e.f),o:nameOf(e.o)});pushNews(t);log.push(t);
  }
  if(G.escortRisk&&G.escortRisk.length){
    const due=G.escortRisk.filter(x=>x.at<=G.turn);G.escortRisk=G.escortRisk.filter(x=>x.at>G.turn);
    due.forEach(x=>{
      if(!alive(x.f)||!alive(x.o)||!chance(E.riskP))return;
      addHeat(E.riskHeat);
      const t=NEWS('escort.risk',{f:nameOf(x.f),o:nameOf(x.o)});pushNews(t);log.push(t);
    });
  }
}
