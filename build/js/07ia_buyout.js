'use strict';
/* ======================= 大口買付 =======================
 * 五個地區各自於每季抽一個月；第一年從夏季起，只抽後三季。
 * 排程不主動公開。玩家可由仲買人探聽本地下一次買付風聲，或在委託採買返航時得知。
 * 是否受影響以出發年月為準；只影響委託採買的本業貨。 */
const buyoutRegions=()=>[...new Set(ALL_CITIES.map(c=>c.region_id))];
/** 確保本年度排程存在；跨年時各區完全獨立重抽。 */
function buyoutEnsure(){
  if(!G)return null;
  if(G.buyout&&G.buyout.y===G.year&&G.buyout.months&&G.buyout.known)return G.buyout;
  const B={y:G.year,months:{},known:{}},skip=G.year===0?ODDS.buyout.firstYearSkip:0;
  buyoutRegions().forEach(rid=>{
    B.months[rid]=ODDS.buyout.quarters.slice(skip).map(q=>rint(q[0],q[1]));
    B.known[rid]={};
  });
  G.buyout=B;return B;
}
const buyoutMonth=m=>NAMES.month[m]+'月';
function buyoutActive(rid,y,m){
  const B=buyoutEnsure();return !!(B&&B.y===y&&(B.months[rid]||[]).includes(m));
}
function buyoutKnown(rid,y,m){
  const B=buyoutEnsure();return !!(B&&B.y===y&&B.known[rid]&&B.known[rid][m]);
}
const buyoutKnownNow=rid=>buyoutActive(rid,G.year,G.month)&&buyoutKnown(rid,G.year,G.month);
const buyoutDepartureBlocked=dest=>!!(dest&&buyoutKnownNow(dest.region_id));
/** 出發時把判定固著在船隊上，之後跨月也不改變結果。 */
function buyoutSnapshot(dest){
  const y=G.year,m=G.month,rid=dest.region_id;
  return {hit:buyoutActive(rid,y,m),y,m,rid};
}
/** 返航或探聽時揭露；返航若已跨年，只保留在日誌，不回寫新年度排程。 */
function buyoutDiscover(y,rid,m){
  const B=buyoutEnsure();if(!B||B.y!==y||!buyoutActive(rid,y,m))return false;
  B.known[rid]=B.known[rid]||{};const fresh=!B.known[rid][m];B.known[rid][m]=1;return fresh;
}
/** 仲買人只說玩家所在地區、本年度「下一次」買付；已知的下一次尚未過去時不能連問。 */
function buyoutIntelNext(){
  const B=buyoutEnsure(),rid=homeCity().region_id;
  if(!B||B.y!==G.year)return null;
  const m=(B.months[rid]||[]).find(x=>x>=G.month);if(!m||buyoutKnown(rid,G.year,m))return null;
  return {rid,m,y:G.year};
}
