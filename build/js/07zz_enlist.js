'use strict';
/* =====================================================================
 * 07zz_enlist.js — 延攬熟人、另謀高就
 *  一、延攬：私宅「延攬熟人」區塊依空缺職位開名冊；本城已結識、適任該職的人才，可請介紹人出面說合、當保人立請狀。
 *      職階看你與對方的好感（ODDS.enlist.aff），不看介紹人；說合禮金 20 兩、介紹人交情 −1～2、行動 1 點。
 *      好感不到門檻：對方婉拒、好感 −2，禮金照付。聘金與造船費與物色相同。
 *  二、物色：店裡各職位都滿員時關閉。
 *  三、另謀高就（每旬）：本城沒見過面的人才多於保留數時，有機會一人搬到別的城（不會被同業聘走，人才總數不減）；
 *      只有手帳裡有記名的人才寫進旬報。
 * ===================================================================== */
const ENLIST_ROLES=['manager','broker','guest'];
/** 延攬某職階所需好感。 */
const enlistNeed=rank=>ODDS.enlist.aff[rank]||ODDS.enlist.aff.clerk;
/** 店裡是否還有可物色的空缺。 */
const hasVacancy=()=>RECRUIT_RANKS.some(slotFree);
/** 聘金計算（物色與延攬共用）。 */
function hireFee(cid,rank){
  const wage=Math.round(RANK_WAGE[rank]*(0.8+CH(cid).derived_stats.commerce_skill/150));
  return {wage,fee:costOf('hireMonths',wage),ship:rank==='captain'?shipCost():0};
}
/** 此人目前可延攬的職階（已結識、在本城、適任且有空缺）。 */
function enlistRanks(cid){
  const n=npc(cid),r=G.rel[cid];
  if(!n||!r||!r.bond||n.cityId!==G.cityId||!alive(cid)||n.hired||n.raided||jailed(n)||n.pos||!ENLIST_ROLES.includes(n.role)||isEnemy(cid))return [];
  if(G.emps.some(e=>e.cid===cid)||G.intros.some(i=>i.cid===cid))return [];
  const a=ageOf(cid);if(a<18||a>62)return [];
  return enlistFitRanks(cid).filter(slotFree);
}
/** 延攬看能力本身（物色看出身標籤，等於商才 65～70、膽識 70 等門檻）；延攬放寬約 20（ODDS.enlist.stat）。 */
function enlistFitRanks(cid){
  const s=(CH(cid)||{}).derived_stats||{},T=ODDS.enlist.stat;
  return RECRUIT_RANKS.filter(rk=>T[rk]&&Object.entries(T[rk]).every(([k,v])=>(s[k]||0)>=v));
}
/** 私宅的延攬區塊：說明＋各有空缺職位的按鈕（大番頭、番頭、手代、船長、飛腳、保鏢）。 */
const ENLIST_ORDER=['chief','banto','clerk','captain','courier','guard'];
function enlistBlockHtml(){
  const ks=ENLIST_ORDER.filter(slotFree);
  const btn=ks.map(rk=>'<button class="pixel-btn btn-sm" data-act="enlistOpen" data-rk="'+rk+'">'+UT('btn.enlistOpen',{r:rankName(rk)})+'</button>').join(' ');
  return UT('enl.block',{a:costTxt('enlistTalk'),b:btn||UT('enl.noVacancy')});
}
/** 本城可延攬為某職的熟人，依好感高低排列。 */
const enlistList=rank=>cityNpcs(G.cityId).filter(n=>enlistRanks(n.cid).includes(rank)).sort((a,b)=>R(b.cid).aff-R(a.cid).aff);
ACT.enlistOpen=el=>{if(needIntro())return;UI.openSheet('enlist',el.dataset.rk)};
/** 延攬名冊：適任此職的熟人，多列好感。 */
SHEETS.enlist=rank=>{
  const need=enlistNeed(rank);
  let h='<div class="notice tiny">'+UT('enl.sheetLead',{r:rankName(rank),n:need})+'</div>';
  if(!slotFree(rank))return {title:UT('enl.sheetTitle',{r:rankName(rank)}),html:h+UT('enl.full')};
  h+=enlistList(rank).map(n=>{
    const cid=n.cid,c=CH(cid),a=R(cid).aff;
    return '<div class="card" style="display:flow-root">'+portraitHtml(cid,56)+'<div class="row"><div><b>'+esc(c.name)+'</b>'+(c.gender==='f'?UT('ppl.h.5'):'')+'<div class="text-brief muted">'+UT('ppl.recruit.4',{a:esc(c.family_summary.slice(0,36)),b:ratingStars(cid)})+'<br>'+UT('enl.aff',{c:a>=need?'green':'red',a:Math.round(a)})+'</div></div><div style="margin-top:4px"><button class="pixel-btn btn-sm" data-act="enlist" data-cid="'+cid+'" data-rk="'+rank+'">'+UT('btn.enlist',{r:rankName(rank)})+'</button></div></div>';
  }).join('')||UT('enl.empty');
  return {title:UT('enl.sheetTitle',{r:rankName(rank)}),html:h};
};
/** 延攬前檢查；回傳錯誤訊息或空字串。 */
function enlistCheck(cid,rank){
  if(!enlistRanks(cid).includes(rank))return MSG('enlist.notFit',{rank:rankName(rank)});
  const f=hireFee(cid,rank),need=costOf('enlistTalk')+f.fee+f.ship;
  if(G.silver<need)return MSG('enlist.short',{c:fmt(need)});
  return '';
}
/** 延攬：介紹人出面說合；好感夠就聘用，不夠就婉拒。 */
function enlistTalent(cid,rank){
  const it=introOf(G.introId);if(!it)return {ok:false,msg:MSG('needIntro.1')};
  const pre=enlistCheck(cid,rank);if(pre)return {ok:false,msg:pre};
  const E=ODDS.enlist;
  spendAmt('enlistTalk',costOf('enlistTalk'));
  const d=E.introMin+Math.floor(rnd()*(E.introMax-E.introMin+1)),ri=R(it.cid);
  setAff(ri,Math.max(0,ri.aff-d));logRel(it.cid,MSG('log.enlistIntro',{d}));
  const r=R(cid),v={i:nameOf(it.cid),n:nameOf(cid),r:rankName(rank)};
  if(r.aff<enlistNeed(rank)){
    setAff(r,Math.max(0,r.aff-E.refuse));logRel(cid,MSG('log.enlistRefuse',{d:E.refuse}));
    return {ok:false,msg:MSG('enlist.refuse',Object.assign(v,{d:E.refuse}))};
  }
  const f=hireFee(cid,rank);
  spendAmt('hireMonths',f.fee);if(f.ship)spendAmt('shipBuild',f.ship);hireEmp(cid,rank);
  return {ok:true,msg:MSG('enlist.ok',Object.assign(v,{w:f.wage}))+(f.ship?MSG('hireCandidate.ship',{ship:fmt(f.ship)}):'')};
}
/** 延攬按鈕。 */
ACT.enlist=el=>{
  const cid=el.dataset.cid,rk=el.dataset.rk;
  if(needIntro())return;
  const pre=enlistCheck(cid,rk);if(pre){toast(pre);return}
  if(!spendAP())return;
  const ok=R(cid).aff>=enlistNeed(rk);
  visitFx({cid,outcome:ok?'ok':'refuse',kind:'contract',prop:'contract'},()=>{const r=enlistTalent(cid,rk);toast(r.msg,Math.max(3200,r.msg.length*120));if(r.ok)sfx.coin();else sfx.bad();UI.render();refreshSheet()});
};
/** 本城沒見過面、可以異動的人才（另謀高就、職業調整共用）：不含員工、介紹人、物色名冊上的人。 */
const driftPool=()=>cityNpcs(G.cityId).filter(n=>ENLIST_ROLES.includes(n.role)&&alive(n.cid)&&!n.hired&&!n.pos&&!jailed(n)&&!(G.rel[n.cid]&&(G.rel[n.cid].met||G.rel[n.cid].bond))&&!G.emps.some(e=>e.cid===n.cid)&&!G.intros.some(i=>i.cid===n.cid)&&!(G.recruit&&G.recruit.cands.includes(n.cid)));
/** 職業調整：每季第一旬（例會旬）判一次。仲買人、旅商人、差配人有哪一種低於基本數，
 *  就從高於基本數（多出最多）的那一種，挑一位本城沒見過面、手帳裡也沒有的人轉過去；一次只轉一人，都達基本數就不發生。不寫旬報。 */
function roleShiftTick(){
  if(!isMeetingTurn())return;
  const B=ODDS.roleShift.base,cnt=k=>cityNpcs(G.cityId,k).filter(n=>alive(n.cid)&&!n.hired).length;
  const C={};ENLIST_ROLES.forEach(k=>C[k]=cnt(k));
  const need=ENLIST_ROLES.filter(k=>C[k]<B[k]).sort((a,b)=>(C[a]-B[a])-(C[b]-B[b]))[0];if(!need)return;   // 缺得多的先補
  const pool=driftPool().filter(n=>!G.known.includes(n.cid));
  const from=ENLIST_ROLES.filter(k=>k!==need&&C[k]>B[k]&&pool.some(n=>n.role===k)).sort((a,b)=>(C[b]-B[b])-(C[a]-B[a]))[0];if(!from)return;   // 多出最多的先轉出
  pick(pool.filter(n=>n.role===from)).role=need;
}
/** 另謀高就：本城沒見過面的人才偶爾搬到別的城（不搬會讓該身分低於基本數的人）。 */
function driftTick(log){
  const D=ODDS.drift,B=ODDS.roleShift.base,cnt=k=>cityNpcs(G.cityId,k).filter(n=>alive(n.cid)&&!n.hired).length;
  const L=driftPool().filter(n=>cnt(n.role)>(B[n.role]||0));   // 不搬會讓該身分低於基本數的人
  if(L.length<=D.keep||!chance(D.p))return;
  const cs=(G.activeIds||[]).filter(id=>id!==G.cityId&&CITY(id));if(!cs.length)return;
  const n=pick(L),to=pick(cs);n.cityId=to;
  if(G.known.includes(n.cid)){const t=NEWS('drift.leave',{n:nameOf(n.cid),c:CITY(to).name});pushNews(t);log.push(t)}
}
