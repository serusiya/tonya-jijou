'use strict';
/* ★檔案總覽：醬漬問屋與齋戒（DESIGN_NOTES 第三百零二節）
 * - 醬漬問屋（pickle，野田屋）與魚屋共用開局牌上的一個位子；選了醬漬問屋，這一局全國的魚貨產地一對一換成醬漬貨（G.prodSwap，02_world.js 的 cityRaw），沒有魚屋的貨；
 *   其餘行業的局照舊有魚貨、沒有醬漬貨。打毀指標：醬漬問屋的局是白米與味噌（03_market.js 的 riotKeys）。
 * - 齋戒（G.fast={y,start,told,on}）：只在醬漬問屋的局。每年三成機率，挑一個月（至少兩個月後）；開始前三旬旬報先有風聲；為期一個月（三旬）。
 *   期間味噌、醃菜、梅干需求兩倍，醬油、味醂一倍半（fastMult，接在 demandEff）；同業照平常出貨，所以市面缺貨。季度人口只看平常需求，不受影響。
 *   風聲傳出時，加開一段只訂八丁味噌的貴人訂貨（ptState().seasons 的 k:'fast'，交貨在齋戒第一旬）。
 * - 每旬 pickleTick（advanceTurn 的 kokushoTick 之後）。數值 ODDS.fast；文字 fast.*（01g）、mk.fast、pt.when.fast（01e）。 */
const FS=()=>ODDS.fast;
const HATCHO='prod_0907';
/** 齋戒進行中。 */
const fastNow=()=>!!(G&&G.fast&&G.fast.start<=G.turn&&G.turn<G.fast.start+FS().turns);
/** 齋戒的需求倍數（只有醬漬貨）。 */
const fastMult=c=>c&&c.sys==='pickle'&&fastNow()?(FS().mult[c.name]||1):1;
/** 每旬：排今年的齋戒、放風聲、開始與結束。 */
function pickleTick(log){
  if(!G||G.sysKey!=='pickle')return;
  const P=FS(),put=k=>{const t=NEWS(k);pushNews(t);log.push(t)};
  if(G.fastY!==G.year){                            // 每年一次：今年要不要齋戒、哪個月（至少兩個月後，風聲才來得及）
    G.fastY=G.year;
    const from=G.month+2,months=[];for(let m=from;m<=12;m++)months.push(m);
    if(!(G.fast&&G.fast.start+P.turns>G.turn)&&months.length&&chance(P.p)){const m=pick(months);G.fast={y:G.year,start:ptTurnOf(G.year,m,1),told:false,on:false}}
  }
  const F=G.fast;if(!F)return;
  if(!F.told&&G.turn>=F.start-P.lead){
    F.told=true;put('fast.rumor');
    const S=ptState();if(!S.seasons.some(x=>x.k==='fast'&&x.due===F.start+1))S.seasons.push({k:'fast',y:G.year,due:F.start+1,from:G.turn,to:F.start-1,big:false,asked:{}});   // 齋戒前的八丁味噌訂單
  }
  if(!F.on&&fastNow()){F.on=true;put('fast.start')}
  if(G.turn>=F.start+P.turns){G.fast=null;put('fast.end')}
}
/* ---------- 齋戒前的貴人訂貨：只訂八丁味噌 ---------- */
{const _o=ptOffer;ptOffer=function(cid,S){
  if(!S||S.k!=='fast')return _o.apply(this,arguments);
  const P=PT();if(!ptGoods().some(c=>c.name===HATCHO))return null;
  const c=COMM_MAP[HATCHO],t=ptTier(cid),r=P.qty[t];if(!r)return null;
  const q=rint(r[0],r[1]),unit=Math.round(c.base*(P.price[0]+rnd()*(P.price[1]-P.price[0]))*10)/10;
  return {cid,name:c.name,qty:q,unit,due:S.due,k:'fast',big:false};
}}
