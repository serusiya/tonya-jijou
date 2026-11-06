'use strict';
/* =====================================================================
 * 07zza_chancemeet.js — 拜訪巧遇（設計筆記第二十九節「拜訪巧遇」、第一百九十一節）
 *  - 見到面、拜訪對話結束後判定（被嫌不善言辭那一場不算）；拒見、不在家、丁稚代送不會走到這裡。
 *  - 機率 ODDS.chanceMeet.p，每旬最多一次；有朋友同行引見的那一場不擲（07zzb_escort.js）。
 *  - 遇到誰：此刻在本城的官員（不含地區官員）與商人（同業、旅商人、仲買人、差配人；不含闇商人）；
 *    排除主人、仇人、自家店員、巡迴在外、被同業聘走、在牢裡、正在氣頭上的人。主人是官員時優先挑官員，商人時優先挑商人。
 *  - 素不相識的人要過名氣門檻（知名度視同多一階），經主人引見結識；舊識直接加好感。
 *  - 回傳結果視窗上方的小卡 HTML（沒遇到回傳空字串）。
 * ===================================================================== */
/** 巧遇的商人身分（闇商人只能碰上、不能求見，第一百五十六節，所以不列）。 */
const CM_MERCH=['rival','guest','broker','manager'];
/** 這次拜訪可能巧遇的人。 */
function chanceMeetPool(host){
  return cityNpcs(G.cityId).filter(n=>{
    if(n.cid===host||n.hired)return false;
    if(n.pos?n.pos.court==='region':!CM_MERCH.includes(n.role))return false;
    if(isEnemy(n.cid)||(G.emps||[]).some(e=>e.cid===n.cid)||awayNow(n)||jailed(n)||snubbed(n.cid))return false;
    if(G.escort&&G.escort.t===G.turn&&G.escort.f===n.cid)return false;
    const r=G.rel[n.cid];
    return !!(r&&r.bond)||meetTierNeed(n.cid)<=fameTier()+1;     // 素不相識：比照介紹人引見，名望視同多一階
  });
}
/** 擲巧遇；遇到時結算好感、記交情，回傳小卡 HTML。 */
function chanceMeetRoll(host){
  const C=ODDS.chanceMeet;
  if(G.chanceMeetT===G.turn||!chance(C.p))return '';
  const L=chanceMeetPool(host);if(!L.length)return '';
  const hn=npc(host),off=!!(hn&&hn.pos),same=L.filter(n=>!!n.pos===off);
  const n=pick(same.length&&chance(C.sameKind)?same:L),cid=n.cid,r=R(cid),old=!!r.bond;
  G.chanceMeetT=G.turn;
  const g=Math.max(0,Math.min(rint(C.gainMin,C.gainMax),100-r.aff));
  setAff(r,clamp(r.aff+g,0,100));
  if(!old){r.met=true;r.seen=true;addKnown(cid);r.bond={mult:0.6,label:UT('cm.bond',{a:nameOf(host)}),introId:null}}   // 比照大番頭代結識：不加初次結識的知名度
  logRel(cid,UT(old?'cm.log.old':'cm.log.new',{a:nameOf(host),g}));
  logRel(host,UT('cm.log.host',{a:nameOf(cid)}));
  const line=TX('chanceMeet.'+(old?'old':'new')+'.'+(off?'official':'merchant'),{n:nameOf(cid)});
  return sideCard(cid,line,UT('cm.gain',{n:nameOf(cid),g}));
}
/** 結果視窗上方的人物小卡（巧遇、陪同共用）。 */
function sideCard(cid,line,foot){
  return '<div class="card" style="display:flow-root;margin-bottom:6px">'+portraitHtml(cid,48)+'<div class="small">'+esc(line)+'</div><div class="tiny" style="margin-top:4px;color:#9b2c3a">'+esc(foot)+'</div></div>';
}
