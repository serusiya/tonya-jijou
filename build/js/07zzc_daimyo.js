'use strict';
/* =====================================================================
 * 07zzc_daimyo.js — 大名行列過境（設計筆記第二十九節「大名行列過境」、第一百九十三節）
 *  - 每年一次：新年（與開局）時從本年度剩下的旬裡挑一旬，排除本城節慶旬與例會旬，存在 G.daimyo{y,m,c}；年初不預告。
 *  - 過境那一旬一開始，旬報與主畫面就看得到行列；所有本業貨需求乘 ODDS.daimyo.mult（與節慶同一層，03_market.js 的 demandEff），
 *    只算那一旬的收市，之後隨收市價視窗慢慢淡去。非本業貨不受影響。
 *  - 行列當旬出門不擲遇襲（07b_purse.js 的 rollAmbush）；路遇急難照常。
 *  - 舊存檔沒有 G.daimyo：從下一個新年起才有。
 * ===================================================================== */
/** 本旬是否大名行列過境。 */
const daimyoActive=()=>!!(G&&G.daimyo&&G.daimyo.y===G.year&&G.daimyo.m===G.month&&G.daimyo.c===G.cycle);
/** 大名行列的需求倍率（只算本業貨）。 */
const daimyoMult=c=>daimyoActive()&&c.sys===G.sysKey?ODDS.daimyo.mult:1;
/** 排定本年度的過境旬：本旬起到年底（含本旬），排除本城節慶旬與例會旬。 */
function daimyoPlan(){
  const f=homeCity().special_festival,L=[];
  for(let m=G.month;m<=12;m++)for(let c=1;c<=3;c++){
    if(m===G.month&&c<G.cycle)continue;
    if(isMeetingDate(m,c)||(f&&f.month===m&&f.cycle===c))continue;
    L.push([m,c]);
  }
  const p=L.length?pick(L):null;
  G.daimyo=p?{y:G.year,m:p[0],c:p[1]}:null;
}
/** 每旬（日期前進之後）：過境旬一開始就上旬報。 */
function daimyoTick(log){
  if(!daimyoActive())return;
  const t=NEWS('daimyo.pass',{name:homeCity().name});pushNews(t);log.push(t);
}
