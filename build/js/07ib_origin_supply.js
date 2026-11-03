'use strict';
/* ======================= 產地供貨指數 =======================
 * 每局、每年、每月、每城、每項當地物產都有固定指數；同月重複前往不重抽。
 * 指數由本局專屬種子按需重算，不保存整張矩陣；委託採買以出發年月為準。 */
function originSupplyEnsure(){
  if(!G)return 0;
  if(G.supplySeed===undefined||G.supplySeed===null)G.supplySeed=hashStr('originSupply|'+G.rs+'|'+G.cityId+'|'+G.turn);
  return G.supplySeed;
}
/** 三角分布：兩個均勻亂數取平均，多數月份靠近 1，極端豐歉較少。 */
function originSupplyIndex(cityId,name,y,m){
  const O=ODDS.originSupply,rd=seeded('originSupply|'+originSupplyEnsure()+'|'+y+'|'+m+'|'+cityId+'|'+name);
  return O.min+(O.max-O.min)*(rd()+rd())/2;
}
/** 供貨豐歉只小幅改變產地成交價，避免蓋過商才與既有價格系統。 */
const originSupplyPrice=i=>clamp(1-ODDS.originSupply.priceSlope*(i-1),ODDS.originSupply.priceMin,ODDS.originSupply.priceMax);
/** 商品分類：沿用市場既有的必需品／一般品／奢侈品判定。 */
const originSupplyKind=name=>COMM_MAP[name].staple?'staple':COMM_MAP[name].luxury?'luxury':'normal';
/**
 * 一趟可買到的量：運量 × 分類平年產量 × 當月豐歉 × 同月同城商隊順位折減。
 * 第一趟仍不能突破運量；後續趟不保證至少一單位，貨源可被搜羅至零。
 */
function originSupplyCap(name,mode,i,rank){
  const O=ODDS.originSupply,k=originSupplyKind(name),cap=capOf(name,mode),n=Math.max(1,rank||1);
  return Math.max(0,Math.min(cap,Math.floor(cap*O.production[k]*i*Math.pow(O.repeat[k],n-1))));
}
function originSupplyBand(i){
  return UT(i<0.75?'voy.supply.famine':i<0.9?'voy.supply.low':i<=1.1?'voy.supply.normal':i<=1.25?'voy.supply.high':'voy.supply.bumper');
}
/** 舊船隊沒有出發月快照，維持舊版採買結果（指數 1）。 */
const originSupplyForShip=(s,dest,name)=>s.supplyY===undefined?1:originSupplyIndex(dest.id,name,s.supplyY,s.supplyM);
