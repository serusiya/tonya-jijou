'use strict';
/* ======================= 大口買付 =======================
 * 五個地區各自於每季抽一個月；第一年從夏季起，只抽後三季。
 * 排程不主動公開。玩家可由仲買人探聽本地下一次買付風聲、寫信請好感 60 以上的外城友人探聽他那個地區的下一次（07zzn_outfriend.js），或在委託採買返航時得知。
 * 是否受影響以出發年月為準；只影響委託採買的本業貨。 */
const buyoutRegions=()=>[...new Set(ALL_CITIES.map(c=>c.region_id))];
/** 確保本年度排程存在；跨年時各區完全獨立重抽。 */
function buyoutEnsure(){
  if(!G)return null;
  if(G.buyout&&G.buyout.y===G.year&&G.buyout.months&&G.buyout.known){buyoutCycEnsure(G.buyout);return G.buyout}
  const B={y:G.year,months:{},known:{}},skip=G.year===0?ODDS.buyout.firstYearSkip:0;
  buyoutRegions().forEach(rid=>{
    B.months[rid]=ODDS.buyout.quarters.slice(skip).map(q=>rint(q[0],q[1]));
    B.known[rid]={};
  });
  G.buyout=B;buyoutCycEnsure(B);return B;
}
/** 只封一旬的地區（南海）：每個買付月再抽一旬（B.cyc[地區][月]＝1～3）；舊存檔讀檔時補抽。 */
const buyoutCycReg=rid=>ODDS.buyout.cycleRegions.includes(rid);
function buyoutCycEnsure(B){ODDS.buyout.cycleRegions.forEach(rid=>{B.cyc=B.cyc||{};const C=B.cyc[rid]||(B.cyc[rid]={});(B.months[rid]||[]).forEach(m=>{if(!C[m])C[m]=rint(1,3)})})}
/** 買付時間的文字：一般地區「六月」，南海「六月中旬」。 */
const buyoutMonth=(m,rid)=>NAMES.month[m]+'月'+(rid&&buyoutCycReg(rid)&&G.buyout&&G.buyout.cyc&&G.buyout.cyc[rid]&&G.buyout.cyc[rid][m]?NAMES.cycle[G.buyout.cyc[rid][m]-1]:'');
/** 某地區某月（南海再看旬 c；不給 c 時只看月）是否正逢大口買付。 */
function buyoutActive(rid,y,m,c){
  const B=buyoutEnsure();if(!(B&&B.y===y&&(B.months[rid]||[]).includes(m)))return false;
  if(c!==undefined&&buyoutCycReg(rid))return !!(B.cyc&&B.cyc[rid]&&B.cyc[rid][m]===c);
  return true;
}
function buyoutKnown(rid,y,m){
  const B=buyoutEnsure();return !!(B&&B.y===y&&B.known[rid]&&B.known[rid][m]);
}
const buyoutKnownNow=rid=>buyoutActive(rid,G.year,G.month,G.cycle)&&buyoutKnown(rid,G.year,G.month);
const buyoutDepartureBlocked=dest=>!!(dest&&buyoutKnownNow(dest.region_id));
/** 出發時把判定固著在船隊上，之後跨月也不改變結果。 */
function buyoutSnapshot(dest){
  const y=G.year,m=G.month,rid=dest.region_id;
  return {hit:buyoutActive(rid,y,m,G.cycle),y,m,rid};
}
/** 返航或探聽時揭露；返航若已跨年，只保留在日誌，不回寫新年度排程。 */
function buyoutDiscover(y,rid,m){
  const B=buyoutEnsure();if(!B||B.y!==y||!buyoutActive(rid,y,m))return false;
  B.known[rid]=B.known[rid]||{};const fresh=!B.known[rid][m];B.known[rid][m]=1;return fresh;
}
/** 某地區本年度「下一次」買付（含本月）：{rid,m,y,known}；今年已經沒有時回傳 null。 */
function buyoutNextOf(rid){
  const B=buyoutEnsure();if(!B||B.y!==G.year)return null;
  const m=(B.months[rid]||[]).find(x=>x>G.month||(x===G.month&&!(buyoutCycReg(rid)&&B.cyc&&B.cyc[rid]&&B.cyc[rid][x]<G.cycle)));if(!m)return null;   // 南海：這個月的那一旬已過就看下一次
  return {rid,m,y:G.year,known:buyoutKnown(rid,G.year,m)};
}
/** 某地區還能探聽的下一次買付；已知的下一次尚未過去時不能連問。 */
function buyoutIntelFor(rid){const I=buyoutNextOf(rid);return I&&!I.known?I:null}
/** 仲買人只說玩家所在地區、本年度「下一次」買付。 */
function buyoutIntelNext(){return buyoutIntelFor(homeCity().region_id)}
