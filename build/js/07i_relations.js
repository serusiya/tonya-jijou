/* ═════ [07zz_enlist] ═════ */
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

/* ═════ [07zz_friends] ═════ */
'use strict';
/* ======================= 人情往來與朋友事件（第一百六十八、一百七十節） =======================
 *  一、人情往來（回府時事件，07zx_homeevt.js）：
 *     - 好感 80 以上的同業出事（失火、遭竊、船貨遇難）：可去慰問，扣 1 行動點數、付中檔禮金，好感 +4～8；不理沒有後果。
 *     - 好感 80 以上的同業新貨滿載入港：請你去慶功宴，扣 1 行動點數，好感 +4～8；不理沒有後果。
 *     - 你出事（倉庫失火、遭竊、遇襲傷癒）：好感 80 以上的人最多三位上門慰問，只寫敘事，好感小加。
 *  二、朋友來借東西（旬報後事件）：倉庫、船長、飛腳連續三旬閒置一半以上時，好感 80 以上的商人朋友上門借用；婉拒好感 −10；冷卻 12 旬。
 *     借倉庫：寄放一批貨幾旬（佔倉位），期滿付寄放費；夾了違禁品而沒出事的，另付一筆謝禮。
 *     借船長飛腳：跑一趟 2～4 旬，回來付酬勞；照擲遇險，可能受傷；對方拿去走私的，可能在港口被扣。
 *  二之二、向朋友借倉庫：推進時有貨因倉位放不下，五成機會有朋友願意先替你放（保管費一成、容量一棟、三旬內搬回，沒搬完照市價七成賣掉）。
 *  三、好感 100 的商人朋友：拜訪時兩成機會講出本城一位官員的軟肋（算證實）。
 *  四、旅商換貨：倉裡有他行貨時，每旬 3% 有旅商人上門想換；可能換到本業貨或別的他行貨，偶爾是次貨或夾帶違禁品。
 *  出事（寄放的違禁品碰上查貨或搜查、借出的船長被扣、換來的貨夾帶違禁品）：不供出＝當成你的違禁品受罰；供出朋友＝只罰他，他對你好感 −40。
 *  數值 ODDS.favor80、ODDS.lend、ODDS.stash、ODDS.friendTip、ODDS.swap；文字 fr.*（01e、01f、01g）。
 *  狀態：G.idle、G.lendOffer、G.lodge、G.lent、G.overflow、G.stashOffer、G.stash、G.swapOffer、G.taints、G.bust、G.consolePend。 */
const MERCHANT_ROLES=['rival','guest','broker','manager','smuggler'];
const isMerchantNpc=n=>!!n&&!n.pos&&MERCHANT_ROLES.includes(n.role);
/** 本城好感 80 以上的人；merchant＝只算商人。 */
function closeFriends(merchant){
  const A=ODDS.favor80.aff;
  return Object.values(G.world.npcs).filter(n=>n.cityId===G.cityId&&alive(n.cid)&&!isEnemy(n.cid)&&G.rel[n.cid]&&G.rel[n.cid].aff>=A&&!G.emps.some(e=>e.cid===n.cid)
    &&!['concubine','branch'].includes(n.role)&&(!merchant||isMerchantNpc(n))&&!(n.role==='official'&&awayNow(n)));
}
/** 借出或受傷養息中的船長飛腳（不能接委託、走私）。 */
const empLent=e=>!!e&&((e.lentUntil||0)>G.turn||(e.hurtUntil||0)>G.turn);
const addAffTo=(cid,d)=>{const r=R(cid);setAff(r,clamp(r.aff+d,0,100));return r};
/** 藏在別處的違禁品（寄放、換貨夾帶）：數量與價值，搜查機率也算進去。 */
const taintList=()=>G.taints||(G.taints=[]);
const hiddenContraQty=()=>taintList().reduce((a,t)=>a+t.q,0);
const hiddenContraValue=()=>taintList().reduce((a,t)=>a+t.q*(SMUG_BY[t.k]?SMUG_BY[t.k].sell:0),0);
const lodgeQty=()=>(G&&G.lodge&&G.lodge.q)||0;
const contraLot=()=>({k:pick(SMUG_ITEMS).k,q:rint(3,8)});
const lendContraP=cid=>{const n=npc(cid);return n&&n.role==='smuggler'?ODDS.lend.contraSmug:ODDS.lend.contra};

/* ---------- 一、人情往來 ---------- */
/** 同業突發事件（msTick 呼叫）：bad＝fire／theft／wreck；好感 80 以上的同業排進回府時事件；寄放在他家的貨一起受損。回傳是否一定要上旬報。 */
function rivalEventHook(n,good,bad,log){
  const r=G.rel[n.cid],fr=!!(r&&r.met&&r.aff>=ODDS.favor80.aff&&!isEnemy(n.cid));
  if(fr)queueHomeEvent({type:good?'feast':'condole',cid:n.cid,kind:bad||''});
  if(!good)stashHit(n.cid,bad,log);
  return fr;
}
FACE_TITLE.condole='fr.title.condole';FACE_TITLE.feast='fr.title.feast';
FACE_EXT.condole=(e,name)=>{
  if(!alive(e.cid))return null;
  const amt=btTiers(e.cid)[1],noAP=apLeft()<=0;
  return {line:UT('fr.condole.'+(e.kind||'fire'),{n:name}),effect:UT('fr.condole.ask'),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="frCondole" data-cid="'+e.cid+'" '+(G.silver<amt||noAP?'disabled':'')+'>'+UT('btn.frCondole',{c:coinHtml('silver',amt)})+'</button><button class="pixel-btn btn-sm" data-act="frSkip">'+UT('btn.frSkip')+'</button></div>'};
};
FACE_EXT.feast=(e,name)=>{
  if(!alive(e.cid))return null;
  return {line:UT('fr.feast',{n:name}),effect:UT('fr.feast.ask'),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="frFeast" data-cid="'+e.cid+'" '+(apLeft()<=0?'disabled':'')+'>'+UT('btn.frFeast')+'</button><button class="pixel-btn btn-sm" data-act="frSkip">'+UT('btn.frSkip')+'</button></div>'};
};
const frGain=()=>rint(ODDS.favor80.gainMin,ODDS.favor80.gainMax);
ACT.frCondole=el=>{
  const cid=el.dataset.cid,amt=btTiers(cid)[1];
  if(G.silver<amt){toast(MSG('buyGoods.5',{cost:fmt(amt)}));return}
  if(!spendAP()){toast(MSG('fr.noAP'));return}
  payPublic('spend.condole|'+cid,amt);const g=frGain();addAffTo(cid,g);
  logRel(cid,UT('fr.log.condole',{a:amt,g}));sfx.gift();UI.hideInfo();toast(MSG('fr.condole',{n:nameOf(cid),a:fmt(amt),g}),4200);UI.render();
};
ACT.frFeast=el=>{
  const cid=el.dataset.cid;if(!spendAP()){toast(MSG('fr.noAP'));return}
  const g=frGain();addAffTo(cid,g);logRel(cid,UT('fr.log.feast',{g}));sfx.gift();UI.hideInfo();toast(MSG('fr.feast',{n:nameOf(cid),g}),4200);UI.render();
};
ACT.frSkip=()=>UI.hideInfo();
SPEND_ARG['spend.condole']=a=>nameOf(a);
/** 你出事：記下來，旬末由朋友上門慰問。kind：fire／theft／heal。 */
function consoleNote(kind){if(G)G.consolePend=G.consolePend||kind}
function consoleTick(log){
  const k=G.consolePend;G.consolePend=null;if(!k)return;
  const L=shuffle(closeFriends(false)).slice(0,ODDS.favor80.visitMax);if(!L.length)return;
  L.forEach(n=>{addAffTo(n.cid,rint(ODDS.favor80.visitGainMin,ODDS.favor80.visitGainMax));logRel(n.cid,UT('fr.log.visit.'+k))});
  const t=NEWS('fr.visit.'+k,{n:L.map(n=>nameOf(n.cid)).join(UT('voy.voyagePanel.9'))});pushNews(t);log.push(t);
}

/* ---------- 二、朋友來借東西 ---------- */
const LEND_RANK={captain:'captain',courier:'courier'};
const lendMode=k=>k==='captain'?'sea':'land';
/** 每旬：記閒置的連續旬數；滿三旬就有朋友上門借。 */
function lendIdleTick(log){
  const I=G.idle||(G.idle={wh:0,captain:0,courier:0,cd:0}),O=ODDS.lend;
  const busy=new Set(G.ships.map(s=>s.capt).concat(smugList().map(v=>v.capt)));
  const crewIdle=rank=>{const L=G.emps.filter(e=>e.rank===rank);return L.length>1&&L.filter(e=>!busy.has(e.id)&&!empLent(e)&&!jailedEmp(e)).length>L.length/2};
  I.wh=G.wh.n>1&&invUsed()/Math.max(1,invCap())<0.5?I.wh+1:0;
  I.captain=crewIdle('captain')?I.captain+1:0;
  I.courier=crewIdle('courier')?I.courier+1:0;
  if(G.turn<I.cd||G.lendOffer||G.lodge||G.lent||(G.exile||0)>0)return;
  const ready=['wh','captain','courier'].filter(k=>I[k]>=O.idleTurns);if(!ready.length)return;
  const F=closeFriends(true);if(!F.length)return;          // 沒有朋友：計數不歸零，下一旬再看
  const n=pick(F),kind=pick(ready),contra=chance(lendContraP(n.cid));
  let o={cid:n.cid,kind,turn:G.turn,contra:contra?contraLot():null};
  if(kind==='wh'){
    const room=invCap()-invUsed()-pendingQty(),q=Math.floor(room*(O.lodgeShareMin+rnd()*(O.lodgeShareMax-O.lodgeShareMin)));
    const pool=otherComms().filter(c=>!c.luxury);if(q<5||!pool.length)return;
    const c=pick(pool),t=rint(O.lodgeMin,O.lodgeMax);
    Object.assign(o,{name:c.name,q,t,fee:Math.max(O.lodgeFeeMin,Math.round(q*c.base*O.lodgeFeeRate))});
  }else{
    const e=idleCaptains(lendMode(kind))[0];if(!e)return;
    const F2=kind==='captain'?O.feeSea:O.feeLand;
    Object.assign(o,{empId:e.id,t:rint(O.crewMin,O.crewMax),fee:rint(F2[0],F2[1])});
  }
  o.hint=o.contra?chance(0.7):chance(0.1);                  // 事前的暗示：多半是真的，偶爾是誤會
  G.lendOffer=o;I.wh=I.captain=I.courier=0;I.cd=G.turn+O.cd;
  queueFaceEvent({type:'lend',cid:n.cid,turn:G.turn});
  log.push(NEWS('fr.lend.news',{n:nameOf(n.cid)}));
}
FACE_TITLE.lend='fr.title.lend';
FACE_EXT.lend=(e,name)=>{
  const o=G.lendOffer;if(!o||o.turn!==e.turn||o.cid!==e.cid)return null;
  let line;
  if(o.kind==='wh')line=UT('fr.lend.wh',{n:name,g:xName(o.name),q:o.q,t:o.t,a:fmt(o.fee)});
  else{const em=G.emps.find(x=>x.id===o.empId);if(!em||empLent(em))return null;line=UT('fr.lend.crew',{n:name,m:NM('crew',lendMode(o.kind)),e:em.name,t:o.t,a:fmt(o.fee)})}
  return {line,effect:UT('fr.lend.ask',{d:ODDS.lend.refuseAff,h:o.hint?UT(o.kind==='wh'?'fr.hint.wh':'fr.hint.crew'):''}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="lendYes">'+UT('btn.lendYes')+'</button><button class="pixel-btn btn-sm" data-act="lendNo">'+UT('btn.lendNo')+'</button></div>'};
};
ACT.lendYes=()=>{
  const o=G.lendOffer;G.lendOffer=null;if(!o){UI.hideInfo();return}
  if(o.kind==='wh'){
    if(invCap()-invUsed()<o.q){toast(MSG('fr.lend.full'));UI.hideInfo();return}
    G.lodge={cid:o.cid,name:o.name,q:o.q,until:G.turn+o.t,fee:o.fee,contra:!!o.contra};
    if(o.contra)taintList().push({src:'lodge',cid:o.cid,k:o.contra.k,q:o.contra.q,until:G.turn+o.t});
    toast(MSG('fr.lend.whOk',{n:nameOf(o.cid),g:xName(o.name),q:o.q,t:o.t}),4200);
  }else{
    const em=G.emps.find(x=>x.id===o.empId);if(!em||empLent(em)){toast(MSG('fr.lend.gone'));UI.hideInfo();return}
    em.lentUntil=G.turn+o.t;voyQPrune();
    G.lent={cid:o.cid,empId:em.id,mode:lendMode(o.kind),until:G.turn+o.t,d:o.t,fee:o.fee,contra:o.contra};
    toast(MSG('fr.lend.crewOk',{n:nameOf(o.cid),e:em.name,t:o.t}),4200);
  }
  logRel(o.cid,UT('fr.log.lend'));sfx.tap();UI.hideInfo();UI.render();
};
ACT.lendNo=()=>{
  const o=G.lendOffer;G.lendOffer=null;
  if(o){const r=R(o.cid);setAff(r,Math.max(0,r.aff-ODDS.lend.refuseAff));logRel(o.cid,UT('fr.log.refuse',{d:ODDS.lend.refuseAff}));toast(MSG('fr.lend.no',{n:nameOf(o.cid),d:ODDS.lend.refuseAff}),4200)}
  UI.hideInfo();UI.render();
};
/** 每旬：寄放期滿、借出的人回來。 */
function lendReturnTick(log){
  const O=ODDS.lend,L=G.lodge;
  if(L&&G.turn>=L.until){
    const thanks=L.contra&&!L.busted?L.fee:0;G.silver+=L.fee+thanks;addAffTo(L.cid,O.okAff);logRel(L.cid,UT('fr.log.lodgeDone'));
    const t=NEWS(thanks?'fr.lodge.doneThanks':'fr.lodge.done',{n:nameOf(L.cid),g:xName(L.name),a:fmt(L.fee),b:fmt(thanks)});pushNews(t);log.push(t);
    G.lodge=null;G.taints=taintList().filter(x=>x.src!=='lodge');
  }
  const B=G.lent;
  if(B&&G.turn>=B.until){
    G.lent=null;const em=G.emps.find(x=>x.id===B.empId);
    if(!em){return}
    em.lentUntil=0;
    const hurt=chance(voyRisk(em,B.d,B.mode));
    if(hurt)em.hurtUntil=G.turn+rint(O.hurtMin,O.hurtMax);
    G.silver+=B.fee;addAffTo(B.cid,O.okAff);em.aff=clamp(empAff(em)+O.crewAff,0,100);logRel(B.cid,UT('fr.log.lentDone'));
    const t=NEWS(hurt?'fr.lent.hurt':'fr.lent.done',{n:nameOf(B.cid),e:em.name,a:fmt(B.fee),m:NM('crew',B.mode),t:hurt?em.hurtUntil-G.turn:0});pushNews(t);log.push(t);
    if(B.contra&&B.mode==='sea'){
      const SZ=ODDS.smugSeize,p=clamp(SZ.perDanger*(SMUG_BY[B.contra.k].danger)+SZ.perHeat*(G.heat||0),SZ.min,SZ.max);
      if(chance(p)){em.jailUntil=G.turn+3;bustStart({src:'lend',cid:B.cid,k:B.contra.k,q:B.contra.q,empId:em.id},log)}
    }
  }
}

/* ---------- 二之二、放不下的貨先寄放朋友家 ---------- */
/** 推進時放不下的貨（大盤到貨、官船官荷捎帶）記下來，旬末看有沒有朋友願意代放。 */
function overflowAdd(name,q,unit,dapan){if(!(q>0)||!G)return;(G.overflow=G.overflow||[]).push({name,q,unit:unit||0,dapan:!!dapan})}
const stashQty=()=>G.stash?G.stash.items.reduce((a,x)=>a+x.q,0):0;
FACE_TITLE.stash='fr.title.stash';
FACE_EXT.stash=(e,name)=>{
  const o=G.stashOffer;if(!o||o.turn!==e.turn||o.cid!==e.cid)return null;
  const q=o.items.reduce((a,x)=>a+x.q,0),fee=stashFee(o.items),cap=G.wh.cap;
  return {line:UT('fr.stash',{n:name,g:o.items.map(x=>COMM_MAP[x.name].short+' × '+x.q).join(NAMES_SEP),q,c:cap,t:ODDS.stash.turns}),effect:UT('fr.stash.ask',{a:fmt(fee)}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="stashYes" '+(G.silver<fee?'disabled':'')+'>'+UT('btn.stashYes',{c:coinHtml('silver',fee)})+'</button><button class="pixel-btn btn-sm" data-act="stashNo">'+UT('btn.stashNo')+'</button></div>'};
};
function stashFee(items){let left=G.wh.cap;return Math.round(items.reduce((a,x)=>{const q=Math.min(x.q,left);left-=q;return a+q*COMM_MAP[x.name].base*ODDS.stash.feeRate},0))}
ACT.stashYes=()=>{
  const o=G.stashOffer;G.stashOffer=null;if(!o){UI.hideInfo();return}
  const fee=stashFee(o.items);if(G.silver<fee){toast(MSG('buyGoods.5',{cost:fmt(fee)}));return}
  payPublic('spend.stash|'+o.cid,fee);
  let left=G.wh.cap,lost=0;const items=[];
  o.items.forEach(x=>{const q=Math.min(x.q,left);left-=q;lost+=x.q-q;if(q>0){const y=items.find(z=>z.name===x.name);if(y){y.unit=(y.unit*y.q+x.unit*q)/(y.q+q);y.q+=q}else items.push({name:x.name,q,unit:x.unit,dapan:x.dapan})}});
  G.stash={cid:o.cid,items,until:G.turn+ODDS.stash.turns};
  logRel(o.cid,UT('fr.log.stash'));sfx.coin();UI.hideInfo();
  toast(MSG('fr.stash.ok',{n:nameOf(o.cid),q:items.reduce((a,x)=>a+x.q,0),a:fmt(fee),l:lost?MSG('fr.stash.lost',{n:lost}):''}),4600);UI.render();
};
ACT.stashNo=()=>{G.stashOffer=null;UI.hideInfo();toast(MSG('fr.stash.no'))};
/** 每旬：寄放在朋友家的貨，倉庫一有空位就搬回；期滿沒搬完的，朋友照市價七成代賣。再看本旬有沒有新的放不下。 */
function stashTick(log){
  const S=G.stash;
  if(S){
    let moved=0;
    S.items.forEach(x=>{
      const room=Math.max(0,invCap()-invUsed()),q=Math.min(x.q,room);
      if(q>0){if(x.unit>0)addStock(x.name,q,x.unit);stockAdd(x.name,q,x.dapan);x.q-=q;moved+=q}
    });
    S.items=S.items.filter(x=>x.q>0);
    if(moved>0){const t=NEWS('fr.stash.back',{n:nameOf(S.cid),q:moved});pushNews(t);log.push(t)}
    if(!S.items.length)G.stash=null;
    else if(G.turn>=S.until){
      let amt=0,q=0;S.items.forEach(x=>{amt+=x.q*marketQuote(x.name)*ODDS.stash.sellRate;q+=x.q});amt=Math.round(amt);G.silver+=amt;
      const t=NEWS('fr.stash.sold',{n:nameOf(S.cid),q,a:fmt(amt)});pushNews(t);log.push(t);G.stash=null;
    }
  }
  const O=G.overflow||[];G.overflow=[];
  if(!O.length||G.stash||G.turn<(G.stashCd||0)||!chance(ODDS.stash.p))return;
  const F=closeFriends(true);if(!F.length)return;
  const n=pick(F);G.stashOffer={cid:n.cid,items:O,turn:G.turn};G.stashCd=G.turn+ODDS.stash.cd;
  queueFaceEvent({type:'stash',cid:n.cid,turn:G.turn});
}
/** 寄放的朋友家失火或遭竊：你的貨按比例一起損失。 */
function stashHit(cid,bad,log){
  const S=G.stash;if(!S||S.cid!==cid||(bad!=='fire'&&bad!=='theft'))return;
  const f=bad==='fire'?ODDS.stash.fireLoss:ODDS.stash.theftLoss;let lost=0;
  S.items.forEach(x=>{const l=Math.round(x.q*f);x.q-=l;lost+=l});S.items=S.items.filter(x=>x.q>0);if(!S.items.length)G.stash=null;
  if(lost>0){const t=NEWS('fr.stash.hit.'+bad,{n:nameOf(cid),q:lost});pushNews(t);log.push(t)}
}

/* ---------- 三、好感 100 的商人朋友講出官員軟肋 ---------- */
/** 拜訪結束時（battleEnd 呼叫）：回傳要接在對話後面的一句（沒有就空字串）。 */
function friendTip(cid){
  const n=npc(cid),r=G.rel[cid];if(!isMerchantNpc(n)||!r||r.aff<100||!chance(ODDS.friendTip.p))return '';
  const L=officialsOf(G.cityId).filter(o=>alive(o.cid)&&!(G.rel[o.cid]&&G.rel[o.cid].verified)&&CH(o.cid).weakness&&NAMES.weak[CH(o.cid).weakness]);
  if(!L.length)return '';
  const o=pick(L),ro=R(o.cid);ro.verified=true;
  logRel(o.cid,UT('fr.tip.log',{n:nameOf(cid),w:weakName(CH(o.cid).weakness)}));
  return UT('fr.tip',{o:nameOf(o.cid),w:weakName(CH(o.cid).weakness)});
}

/* ---------- 四、旅商換貨 ---------- */
function swapTick(log){
  const xs=Object.keys(G.xinv||{}).filter(k=>G.xinv[k]>0&&COMM_MAP[k]);
  if(!xs.length||(G.exile||0)>0||!chance(ODDS.swap.p))return;
  const gs=cityNpcs(G.cityId,'guest').filter(n=>alive(n.cid)&&!isEnemy(n.cid));if(!gs.length)return;
  const W=ODDS.swap,n=pick(gs),give=pick(xs),gq=G.xinv[give],gv=gq*COMM_MAP[give].base;
  const own=tradeComms(),useOwn=own.length&&chance(W.own);
  const pool=useOwn?own:otherComms().filter(c=>!c.luxury&&c.name!==give);if(!pool.length)return;
  const c=pick(pool),getq=Math.max(1,Math.round(gv*(W.ratioMin+rnd()*(W.ratioMax-W.ratioMin))/c.base));
  G.swapOffer={cid:n.cid,give,gq,get:c.name,getq,own:!!useOwn,poor:chance(W.poor),contra:chance(W.contra)?contraLot():null,turn:G.turn};
  queueFaceEvent({type:'swap',cid:n.cid,turn:G.turn});
  log.push(NEWS('fr.swap.news',{n:nameOf(n.cid)}));
}
FACE_TITLE.swap='fr.title.swap';
FACE_EXT.swap=(e,name)=>{
  const o=G.swapOffer;if(!o||o.turn!==e.turn||o.cid!==e.cid||!((G.xinv||{})[o.give]>=o.gq))return null;
  const gc=COMM_MAP[o.give],c=COMM_MAP[o.get];
  return {line:UT('fr.swap',{n:name,g:c.short,q:o.getq,b:fmt(o.getq*c.base),x:gc.short,y:o.gq,a:fmt(o.gq*gc.base),k:o.own?UT('fr.swap.own'):UT('fr.swap.oth')}),effect:UT('fr.swap.ask'),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="swapYes">'+UT('btn.swapYes')+'</button><button class="pixel-btn btn-sm" data-act="swapNo">'+UT('btn.swapNo')+'</button></div>'};
};
ACT.swapYes=()=>{
  const o=G.swapOffer;G.swapOffer=null;if(!o||!((G.xinv||{})[o.give]>=o.gq)){UI.hideInfo();return}
  const c=COMM_MAP[o.get],W=ODDS.swap;
  G.xinv[o.give]-=o.gq;if(G.xinv[o.give]<=0)delete G.xinv[o.give];
  let room=Math.max(0,invCap()-invUsed());
  let q=Math.min(o.getq,room);const full=o.getq-q;
  let poor=0;if(o.poor&&q>0){poor=Math.round(q*(W.poorMin+rnd()*(W.poorMax-W.poorMin)));q-=poor}
  if(q>0){
    if(o.own){addStock(o.get,q,o.gq*COMM_MAP[o.give].base/Math.max(1,q));stockAdd(o.get,q,false)}
    else{G.xinv[o.get]=(G.xinv[o.get]||0)+q}
  }
  if(o.contra)taintList().push({src:'swap',cid:o.cid,k:o.contra.k,q:o.contra.q,until:G.turn+W.contraTurns});
  logRel(o.cid,UT('fr.log.swap'));sfx.coin();UI.hideInfo();
  toast(MSG('fr.swap.ok',{g:c.short,q})+(poor?MSG('fr.swap.poor',{n:poor}):'')+(full?MSG('fr.swap.full',{n:full}):''),4600);UI.render();
};
ACT.swapNo=()=>{G.swapOffer=null;UI.hideInfo()};

/* ---------- 出事：供不供出朋友 ---------- */
/** 寄放或換來的違禁品碰上搜查（必定）或查貨（六成）時被翻出來。 */
function taintTick(log){
  G.taints=taintList().filter(t=>t.until>=G.turn);
  if(G.bust||!G.taints.length)return;
  const raided=!!G.raidNote,insp=!!(G.inspect&&G.inspect.turn===G.turn)&&chance(ODDS.lend.bustInspect);
  if(!raided&&!insp)return;
  const t=G.taints.shift();if(t.src==='lodge'&&G.lodge)G.lodge.busted=true;
  bustStart(t,log);
}
function bustStart(t,log){
  G.bust={src:t.src,cid:t.cid,k:t.k,q:t.q,empId:t.empId||null,turn:G.turn};
  queueFaceEvent({type:'bust',cid:t.cid,turn:G.turn});
  const x=NEWS('fr.bust.'+t.src,{n:nameOf(t.cid),g:SMUG_BY[t.k].name,q:t.q});pushNews(x);log.push(x);sfx.bad();
}
FACE_TITLE.bust='fr.title.bust';
FACE_EXT.bust=(e,name)=>{
  const B=G.bust;if(!B||B.turn!==e.turn||B.cid!==e.cid)return null;
  return {line:UT('fr.bust.'+B.src,{n:name,g:SMUG_BY[B.k].name,q:B.q}),effect:UT('fr.bust.ask',{d:ODDS.lend.betrayAff}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="bustShield">'+UT('btn.bustShield')+'</button><button class="pixel-btn btn-sm" data-act="bustBetray">'+UT('btn.bustBetray')+'</button></div>'};
};
/** 結算：shield＝不供出（當成你的違禁品受罰）；否則供出朋友。回傳給玩家看的一句。 */
function bustResolve(shield,log){
  const B=G.bust;G.bust=null;if(!B)return '';
  if(shield){
    contra()[B.k]=(contra()[B.k]||0)+B.q;doRaid('random',log||[]);
    logRel(B.cid,UT('fr.log.shield'));
    const N=G.raidNote;return MSG('fr.bust.shield',{n:nameOf(B.cid),r:N?N.title:''});
  }
  const r=R(B.cid);setAff(r,Math.max(0,r.aff-ODDS.lend.betrayAff));logRel(B.cid,UT('fr.log.betray',{d:ODDS.lend.betrayAff}));
  const n=npc(B.cid);if(n&&n.role==='rival'){const m=msOf(n);m.ev=Math.min(m.ev||1,0.7);m.evT=Math.max(m.evT||0,3)}
  if(B.empId){const em=G.emps.find(x=>x.id===B.empId);if(em)em.jailUntil=G.turn}
  return MSG('fr.bust.betray',{n:nameOf(B.cid),d:ODDS.lend.betrayAff});
}
ACT.bustShield=()=>{const m=bustResolve(true);UI.hideInfo();if(m)toast(m,4600);UI.render()};
ACT.bustBetray=()=>{const m=bustResolve(false);UI.hideInfo();if(m)toast(m,4600);UI.render()};

/* ---------- 每旬總入口（advanceTurn 最後、傷勢之後） ---------- */
function friendsTick(log){
  if(G.bust&&G.bust.turn<G.turn){const m=bustResolve(true,log);if(m){const t=NEWS('fr.bust.auto',{m});pushNews(t);log.push(t)}}   // 上旬沒選：視為不供出
  ['lendOffer','stashOffer','swapOffer'].forEach(k=>{if(G[k]&&G[k].turn<G.turn)G[k]=null});   // 上旬沒選：作廢
  lendReturnTick(log);
  stashTick(log);
  taintTick(log);
  lendIdleTick(log);
  swapTick(log);
  consoleTick(log);
}

/* ═════ [07zz_letters] ═════ */
'use strict';
/* ======================= 外地遠國奉行所官員：只能書信往來（第一百四十四節） =======================
 *  - 本店所在地區的遠國奉行所官員照舊親自拜訪；外地的不能見面、不能派丁稚，只能託人寄信。
 *  - 每寄一封扣 1 點行動；同一位官員一旬只收一封（r.ltrT＝寄給他的那一旬），寄給不同的人不限（第二百六十七節）；送信費 100 兩加中檔禮金；寫給貪官風聲 +0.1；寄出當下就知道結果。
 *     初次問候信：比照毛遂自薦，可能被退信（只收送信費）；知名度門檻照舊（有介紹人視同多一階）。
 *     一般書信：好感 +4～8，最多加到 60。
 *     書狀請託：交情 ≥60 時改寄請託信，信裡直接開口，不打拜訪戰鬥；照常扣好感、照常審理（外地審理旬數加倍，見 07k appDuration）。
 *  - 外地官員沒有好感 100 的特殊請託；只限本地區官員的請託（捎帶、本陣御用達、討伐賊亂）也求不到。
 *  - 大番頭的自動問候不會找外地官員。
 *  數值 ODDS.letter；文字 letter.*（01e、01f）。 */
/** 本旬已寄過信給這個人（外地官員、外城友人共用 r.ltrT）。 */
const letterUsed=cid=>!!(G.rel[cid]&&G.rel[cid].ltrT===G.turn);
/** 寄出一封信：扣 1 點行動、記下寄給他的那一旬。行動不足時提示並回傳 false。 */
const letterSpend=cid=>{if(!spendAP())return false;R(cid).ltrT=G.turn;return true};
const letterCost=cid=>ODDS.letter.fee+btTiers(cid)[1];
SPEND_ARG['spend.letter']=a=>nameOf(a);
/** 寄信前檢查；回傳錯誤訊息或 null。 */
function letterCheck(cid,amt){
  const n=npc(cid);if(!foreignReg(n))return MSG('letter.notForeign');
  if(letterUsed(cid))return MSG('letter.used');
  if(G.silver<amt)return MSG('letter.short',{a:fmt(amt)});
  if(apLeft()<=0)return MSG('ap.out',{m:apCapNow()});
  return null;
}
/** 尚未結識：問候信按鈕。 */
function letterMeetHtml(cid){
  const amt=letterCost(cid),used=letterUsed(cid);
  return UT('letter.meetNote')+'<div style="margin-top:4px"><button class="pixel-btn btn-sm btn-gold" data-act="letterMeet" data-cid="'+cid+'" '+(used?'disabled':'')+'>'+(used?UT('btn.letterUsed'):UT('btn.letterMeet',{c:coinHtml('silver',amt)}))+'</button></div>';
}
/** 已結識：寄信或書狀請託。 */
function letterRowHtml(cid){
  const r=R(cid),amt=letterCost(cid),used=letterUsed(cid),friend=r.aff>=FRIEND_AFF;
  let h=UT('letter.row');
  if(used)return h+'<div style="margin-top:4px"><button class="pixel-btn btn-sm" disabled>'+UT('btn.letterUsed')+'</button></div>';
  if(!friend)return h+'<div style="margin-top:4px"><button class="pixel-btn btn-sm btn-gold" data-act="letterSend" data-cid="'+cid+'">'+UT('btn.letter',{c:coinHtml('silver',amt)})+'</button></div>';
  const can=reqList(cid).length>0;
  return h+'<div style="margin-top:4px"><button class="pixel-btn btn-sm btn-gold" data-act="letterReq" data-cid="'+cid+'" '+(can?'':'disabled')+'>'+UT('btn.letterReq',{c:coinHtml('silver',amt)})+'</button></div>'+(can?'':UT('letter.noReq'));
}
const letterPay=(cid,amt)=>{payPublic('spend.letter|'+cid,amt);if(officialKind(npc(cid))==='greedy')addHeat(ODDS.letter.heat)};
const letterDone=(m,ok)=>{toast(m,Math.max(3200,m.length*120));if(ok)sfx.gift();else sfx.bad();UI.render();refreshSheet()};
/** 初次問候信：比照毛遂自薦，可能被退信。 */
ACT.letterMeet=el=>{
  const cid=el.dataset.cid,n=npc(cid),r=R(cid),amt=letterCost(cid);
  const via=!!(G.introId&&introOf(G.introId));
  if(meetTierNeed(cid)>fameTier()+(via?1:0)){toast(MSG('meet.fame'));return}
  const err=letterCheck(cid,amt);if(err){toast(err);return}
  let pRef=clamp(0.35+0.08*(n.pos.rank-1),0,0.8);pRef=Math.max(0.02,pRef-fameCut());
  if(!letterSpend(cid))return;
  if(chance(pRef)){
    payPublic('spend.letter|'+cid,ODDS.letter.fee);r.lastIntro=G.turn;r.lastOk=false;addKnown(cid);
    logRel(cid,UT('letter.log.returned'));return letterDone(MSG('letter.returned',{a:fmt(ODDS.letter.fee)}),false);
  }
  letterPay(cid,amt);r.lastIntro=G.turn;r.lastOk=true;
  const gain=Math.round(10/(1+(n.pos.rank-2)*0.4));
  setAff(r,clamp(r.aff+gain,0,100));r.met=true;r.seen=true;addKnown(cid);if(!r.fameGot){r.fameGot=true;addFame(1.5*n.pos.rank,'mid')}
  r.bond={mult:0.6,label:UT('bond.letter'),introId:null};
  logRel(cid,UT('letter.log.met',{g:gain}));
  letterDone(MSG('letter.met',{n:nameOf(cid),g:gain}),true);
};
/** 一般書信：好感 +4～8，最多到 60。 */
ACT.letterSend=el=>{
  const cid=el.dataset.cid,r=R(cid),amt=letterCost(cid),O=ODDS.letter;
  if(r.aff>=O.cap){toast(MSG('letter.friend'));return}
  const err=letterCheck(cid,amt);if(err){toast(err);return}
  if(!letterSpend(cid))return;letterPay(cid,amt);
  const gain=Math.max(0,Math.min(rint(O.gainMin,O.gainMax),O.cap-r.aff));
  setAff(r,clamp(r.aff+gain,0,100));r.lastOk=true;addFame(0.1);
  logRel(cid,UT('letter.log.sent',{a:fmt(amt),g:gain}));
  letterDone(MSG('letter.sent',{n:nameOf(cid),a:fmt(amt),g:gain}),true);
};
/** 書狀請託：交情 ≥60，信裡直接開口（不打拜訪戰鬥）。 */
ACT.letterReq=el=>{
  const cid=el.dataset.cid,r=R(cid),amt=letterCost(cid);
  if(r.aff<FRIEND_AFF){toast(MSG('letter.notFriend'));return}
  if(!reqList(cid).length){toast(MSG('letter.noReq'));return}
  const err=letterCheck(cid,amt);if(err){toast(err);return}
  if(!letterSpend(cid))return;letterPay(cid,amt);logRel(cid,UT('letter.log.req',{a:fmt(amt)}));
  UI.render();refreshSheet();
  INFO_AFTER=null;UI.showInfo(UT('letter.reqTitle',{a:nameOf(cid)}),requestHtml(cid,TX('letter.reqLine')));
};
/* 外地官員不能登門：拜訪、投帖都擋下（筆記頁等其他入口也一樣） */
{const v=ACT.visit;ACT.visit=el=>{if(foreignReg(npc(el.dataset.cid))){toast(MSG('letter.only'));return}v(el)}}
{const m=ACT.meet;ACT.meet=el=>{if(foreignReg(npc(el.dataset.cid))){toast(MSG('letter.only'));return}m(el)}}

/* ═════ [07zz_regfavor] ═════ */
'use strict';
/* ======================= 遠國奉行所三階新請託：官船捎帶、官荷捎帶、本陣御用達（第一百六十二節） =======================
 *  - 都只能向本店所在地區的官員開口（外地官員寫信也求不到）；一般請託：好感 −10，同一位官員冷卻 12 旬。
 *  - 官船捎帶（湊番所役，本店是港口城）／官荷捎帶（關所番頭，本店不是港口城；水陸要衝兩位都有）：
 *     能買賣的本業貨裡，八成是最貴的那項、兩成是第二貴的；同一位官員同一旬開出的貨與數量固定。
 *     官船約值 3,000 兩付 2,000 兩；官荷減半。三旬後入倉，不會遇難；放不下的直接損失。風聲 +0.2。
 *  - 本陣御用達與上貢共用定約掛賣的合約格式：相場「📦 合約」卡、保留與填貨、推進前缺貨提醒（07zzm_kake.js 的 pactExtras，第二百五十一節）。
 *  - 本陣御用達（宿場問屋場役）：隨機一項能買賣的本業貨，每旬約值 500 兩的數量；接下後連續三旬，
 *     推進時（自動出貨之前）從庫存送出，照當旬市價加兩成入帳；不算本城出貨。送不足＝失約：有多少送多少，好感 −30、知名度 −1，合約結束。
 *  數值 ODDS.regConsign、ODDS.honjin；文字 rfav.*（01e、01f、01g）。狀態 G.consign（在途）、G.honjin（合約）、G.regOffer（本旬開價）。 */
/** 這位遠國奉行所官員是不是外地的（不在本店所在地區）。 */
const foreignReg=n=>!!(n&&n.pos&&n.pos.court==='region'&&regOfNpc(n)!==homeRegion());
const localReg=n=>!!(n&&n.pos&&n.pos.court==='region'&&regOfNpc(n)===homeRegion());
/** 本店能辦哪一種捎帶：港口城→官船；非港口城或水陸要衝→官荷。 */
const consignSeaOk=()=>canSea(homeCity());
const consignLandOk=()=>!canSea(homeCity())||homeCity().type==='waterland';
/** 開價（同一位官員同一旬固定）。kind：sea／land／honjin。 */
function regOffer(n,kind){
  G.regOffer=G.regOffer||{};const key=n.cid+'|'+kind,o=G.regOffer[key];
  if(o&&o.turn===G.turn&&COMM_MAP[o.name])return o;
  const L=tradeComms().filter(c=>!c.luxury);if(!L.length)return null;   // 捎帶、本陣御用達都不收奢侈品（第三百五十四節）
  const rd=seeded(n.cid+'|'+kind+'|'+G.turn),price=c=>marketQuote(c.name,true);
  let c;
  if(kind==='honjin')c=L[Math.floor(rd()*L.length)];
  else{const S=L.slice().sort((a,b)=>price(b)-price(a));c=S.length>1&&rd()<ODDS.regConsign.second?S[1]:S[0]}
  const O=kind==='honjin'?ODDS.honjin:ODDS.regConsign[kind];
  const qty=Math.max(1,Math.round(O.value/Math.max(0.01,price(c))));
  const r={turn:G.turn,name:c.name,qty,pay:O.pay||0};
  G.regOffer[key]=r;
  Object.keys(G.regOffer).forEach(k=>{if(G.regOffer[k].turn!==G.turn)delete G.regOffer[k]});
  return r;
}
const consignKind=k=>k==='rconsignSea'?'sea':'land';
REG_FAVORS.push(
  {k:'rconsignSea',rank:3,cd:12,pos:['reg_02'],local:true,consign:'sea',avail:()=>consignSeaOk()},
  {k:'rconsignLand',rank:3,cd:12,pos:['reg_01'],local:true,consign:'land',avail:()=>consignLandOk()},
  {k:'rhonjin',rank:3,cd:12,pos:['reg_03'],local:true,honjin:true,avail:()=>!G.honjin}
);
REG_FAVORS.filter(f=>f.consign||f.honjin).forEach(f=>{f.name=UT('fav.'+f.k);f.desc=UT('fav.'+f.k+'.d')});
/** 請託選單：名稱帶貨名與數量（resolveFavor 呼叫）。 */
function regFavorResolve(f,n){
  if(!f.consign&&!f.honjin)return null;
  const o=regOffer(n,f.consign||'honjin');if(!o)return Object.assign({},f,{off:true});
  const v={g:COMM_MAP[o.name].short,q:o.qty,a:fmt(o.pay)};
  return Object.assign({},f,{name:UT('fav.'+f.k+'.n',v),desc:UT('fav.'+f.k+'.dd',v)});
}
/** 開口前的檢查（doFavor 呼叫）：回傳錯誤訊息或 null。 */
function regFavorCheck(f,n){
  if(f.local&&!localReg(n))return MSG('rfav.notLocal');
  if(f.consign){const o=regOffer(n,f.consign);if(!o)return MSG('rfav.noGoods');if(G.silver<o.pay)return MSG('rfav.short',{a:fmt(o.pay)})}
  if(f.honjin){if(G.honjin)return MSG('rfav.honjinBusy');if(!regOffer(n,'honjin'))return MSG('rfav.noGoods')}
  return null;
}
const consignFavor=kind=>n=>{
  const o=regOffer(n,kind),c=COMM_MAP[o.name];
  payPublic('spend.consign'+(kind==='sea'?'Sea':'Land')+'|'+o.name,o.pay);addHeat(ODDS.regConsign.heat);
  (G.consign=G.consign||[]).push({kind,name:o.name,qty:o.qty,cost:o.pay,due:G.turn+ODDS.regConsign.turns,cid:n.cid});
  delete G.regOffer[n.cid+'|'+kind];
  return MSG('rfav.consign.'+kind,{g:c.short,q:o.qty,a:fmt(o.pay),t:ODDS.regConsign.turns});
};
REG_FAVOR.rconsignSea=consignFavor('sea');
REG_FAVOR.rconsignLand=consignFavor('land');
REG_FAVOR.rhonjin=n=>{
  const o=regOffer(n,'honjin'),c=COMM_MAP[o.name];
  G.honjin={cid:n.cid,name:o.name,qty:o.qty,left:ODDS.honjin.turns,start:G.turn,filled:0};
  delete G.regOffer[n.cid+'|honjin'];kakeFill();   // 立約當旬就要交：先從倉裡備貨（合約卡可再按填貨）
  return MSG('rfav.honjin',{g:c.short,q:o.qty,t:ODDS.honjin.turns});
};
/** 每旬（訂單到貨之後）：捎帶的貨到了就入倉。 */
function consignTick(log){
  const L=G.consign||[];if(!L.length)return;
  G.consign=L.filter(x=>{
    if(G.turn<x.due)return true;
    const c=COMM_MAP[x.name];if(!c)return false;
    const room=Math.max(0,invCap()-invUsed()),q=Math.min(x.qty,room);
    if(q>0){addStock(x.name,q,x.cost/x.qty);stockAdd(x.name,q,false)}
    overflowAdd(x.name,x.qty-q,x.cost/x.qty,false);   // 放不下的：旬末看有沒有朋友代放（07zz_friends.js）
    const t=NEWS('rfav.arrive.'+x.kind,{g:c.short,q,l:x.qty-q>0?UT('rfav.lost',{n:x.qty-q}):''});pushNews(t);log.push(t);
    return false;
  });
}
/** 每旬推進一開始（自動出貨之前）：本陣御用達送貨。回傳入帳金額（記進旬報）。 */
function honjinTick(log){
  const H=G.honjin;if(!H||G.turn<H.start)return 0;
  const c=COMM_MAP[H.name];if(!c){G.honjin=null;return 0}
  const T=G.tribute,tribHeld=T&&T.name===H.name?(T.filled||0):0;   // 上貢先交（合約共用格式，第二百五十一節）：它保留的貨本陣不能動
  const have=Math.max(0,(G.inv[H.name]||0)-tribHeld),q=Math.min(have,H.qty),amt=Math.round(q*marketQuote(H.name)*ODDS.honjin.markup);
  stockTake(H.name,q,false);G.silver+=amt;H.filled=0;
  let t;
  if(q<H.qty){
    const r=G.rel[H.cid];if(r&&alive(H.cid)){setAff(r,Math.max(0,r.aff-ODDS.honjin.failAff));logRel(H.cid,UT('rfav.log.fail',{d:ODDS.honjin.failAff}))}
    loseFame('tributeFail');G.honjin=null;sfx.bad();
    t=NEWS('rfav.honjin.fail',{g:c.short,q,a:fmt(amt)});
  }else{
    H.left--;
    t=NEWS(H.left>0?'rfav.honjin.give':'rfav.honjin.done',{g:c.short,q,a:fmt(amt),l:H.left});
    if(H.left<=0)G.honjin=null;
  }
  pushNews(t);log.push(t);
  return amt;
}
SPEND_ARG['spend.consignSea']=SPEND_ARG['spend.consignLand']=a=>COMM_MAP[a]?COMM_MAP[a].short:a;

/* ═════ [07zz_regfavor4] ═════ */
'use strict';
/* ======================= 遠國奉行所四階新請託（第一百五十二、一百六十五節） =======================
 *  - 唐船割符（郡代，本地）：拿到一張割符，河岸藏走私面板多一個「借給官方出差」；任何空閒船長都能派，私房錢照付、扣 1 行動點數、
 *     風聲不增加；只擲海難、不擲入港被扣。割符船回來就用掉；同時只能持有一張。
 *  - 國中物卸留（船手頭，外地，只能寫信）：公款 3,000 兩；挑該地區有出產、而你的船長飛腳到不了的本業貨一樣，玩家選一座該地區港口；
 *     審理三旬後的下一個整月，那座港口臨時出產這樣貨（以委託採買的出發旬判定）。一個地區同時只能有一樣。
 *  - 卸留請負（船手頭，本地）：把一批本業貨運到本地區另一座城交差；數量＝本城需求 × 你的市佔 × 九旬。開口後六旬內出發的外運都算，
 *     照送到的數量領基準價一點五倍；去程、回程各擲一次遇險；交不齊比照本陣御用達失約。
 *  - 國商助成（勘定吟味役，本地）：出資現款 5,000 兩，之後十旬每旬私房錢約 450 兩；官員調走、過世或下獄就斷了。全國同時只能有一筆。
 *  都是一般請託：好感 −10，同一位官員冷卻 12 旬。數值 ODDS.unload、ODDS.unloadJob、ODDS.kokusho；文字 fav.r*、r4.*。
 *  狀態：G.tally、G.unloads、G.ujob、G.kokusho。 */
REG_FAVORS.push(
  {k:'rtally',rank:4,cd:12,pos:['reg_04'],local:true,tally:true,avail:()=>!G.tally&&canSea(homeCity())},
  {k:'runload',rank:4,cd:12,pos:['reg_05'],unload:true,avail:n=>foreignReg(n)&&!!unloadOffer(n)},
  {k:'rujob',rank:4,cd:12,pos:['reg_05'],local:true,ujob:true,avail:n=>!G.ujob&&!!ujobOffer(n)},
  {k:'rkokusho',rank:4,cd:12,pos:['reg_06'],local:true,kokusho:true,avail:()=>!G.kokusho}
);
REG_FAVORS.filter(f=>f.tally||f.unload||f.ujob||f.kokusho).forEach(f=>{f.name=UT('fav.'+f.k);f.desc=UT('fav.'+f.k+'.d')});

/* ---------- 國中物卸留 ---------- */
const unloadList=()=>G.unloads||(G.unloads=[]);
/** 某城本旬臨時出產的貨（國中物卸留期間）。 */
const unloadProds=(ctId,t)=>unloadList().filter(x=>x.city===ctId&&x.from<=(t===undefined?G.turn:t)&&(t===undefined?G.turn:t)<=x.to).map(x=>x.name);
/** 船長飛腳到得了的城市（不看許可）。 */
const reachIds=()=>new Set(destList('sea',true).concat(destList('land',true)).map(x=>x.ct.id).concat([homeCity().id]));
/** 開價：這個地區有出產、你到不了的本業貨（同一位官員同一旬固定），以及可選的港口。 */
function unloadOffer(n){
  const rid=regOfNpc(n);if(unloadList().some(x=>x.rid===rid&&G.turn<=x.to))return null;
  const reach=reachIds(),cs=CITIES.filter(c=>c.region_id===rid);
  const can=new Set();cs.forEach(c=>{if(!reach.has(c.id))cityProdsBase(c).forEach(x=>can.add(x))});
  CITIES.filter(c=>reach.has(c.id)).forEach(c=>cityProdsBase(c).forEach(x=>can.delete(x)));
  const L=tradeComms().filter(c=>can.has(c.name));
  const ports=cs.filter(c=>canSea(c)&&c.id!==homeCity().id);
  if(!L.length||!ports.length)return null;
  const rd=seeded(n.cid+'|unload|'+G.turn);
  return {rid,name:L[Math.floor(rd()*L.length)].name,ports:ports.map(c=>c.id)};
}
/** 審理完成後的下一個整月：回傳起訖旬數與月份。 */
function unloadWindow(){
  const R_=ODDS.unload.review,ready=G.turn+R_,cyc=((G.cycle-1+R_)%3)+1,from=ready+(cyc===1?0:4-cyc);
  const ahead=Math.floor((G.cycle-1+(from-G.turn))/3),month=((G.month-1+ahead)%12)+1;
  return {from,to:from+2,month};
}
/** 選港口（請託清單按下後）。 */
function unloadPick(cid){
  const o=unloadOffer(npc(cid));if(!o)return '<div class="notice tiny">'+esc(MSG('r4.unloadNone'))+'</div>';
  return portraitHtml(cid,56)+'<div class="notice tiny">'+esc(MSG('r4.unloadPick',{g:COMM_MAP[o.name].short}))+'</div>'
    +o.ports.map(id=>{const ct=CITY(id),ok=seaPermitFor(ct);return '<div class="irow" style="margin-top:4px"><div class="row"><b class="small">'+esc(ct.name)+(ok?'':UT('voy.voyagePanel.8'))+'</b><button class="pixel-btn btn-sm btn-gold" data-act="reqAsk" data-cid="'+cid+'" data-k="runload" data-t="'+id+'">'+UT('btn.r4pick')+'</button></div></div>'}).join('');
}
{const _ask=ACT.reqAsk;ACT.reqAsk=el=>{
  if(el.dataset.k==='runload'&&!el.dataset.t){BT=null;UI.showInfo(UT('bt.reqAsk.4',{a:nameOf(el.dataset.cid)}),unloadPick(el.dataset.cid));return}
  _ask(el);
}}
/** 每旬：卸留月開始與結束的旬報；過期的紀錄清掉。 */
function unloadTick(log){
  const L=unloadList();if(!L.length)return;
  L.forEach(x=>{
    const ct=CITY(x.city),g=COMM_MAP[x.name];if(!ct||!g)return;
    if(G.turn===x.from){const t=NEWS('r4.unload.open',{c:ct.name,g:g.short});pushNews(t);log.push(t)}
    if(G.turn===x.to+1){const t=NEWS('r4.unload.close',{c:ct.name,g:g.short});pushNews(t);log.push(t)}
  });
  G.unloads=L.filter(x=>G.turn<=x.to);
}

/* ---------- 卸留請負 ---------- */
/** 卸留處的走法：兩邊都是港口城走海運（要入津御免），否則走陸運（要關所通行手形、兩旬內）。 */
function ujobRoute(ct){
  const a=homeCity();
  if(canSea(a)&&canSea(ct))return seaPermitFor(ct)?'sea':null;
  return canLand(a,ct)&&landPermit()?'land':null;
}
/** 開價（同一位官員同一旬固定）：貨、數量、卸留處。 */
function ujobOffer(n){
  const a=homeCity(),own=new Set(cityProds(a));
  const L=tradeComms().filter(c=>!own.has(c.name));
  const ds=CITIES.filter(c=>c.region_id===a.region_id&&c.id!==a.id&&ujobRoute(c));
  if(!L.length||!ds.length)return null;
  const rd=seeded(n.cid+'|ujob|'+G.turn),c=L[Math.floor(rd()*L.length)],ct=ds[Math.floor(rd()*ds.length)];
  const sh=(G.share&&G.share.me)||0.05,D=(G.mk[c.name]&&G.mk[c.name].D)||cityD(a,c);
  return {name:c.name,qty:Math.max(ODDS.unloadJob.minQty,Math.round(D*sh*ODDS.unloadJob.turns)),city:ct.id,mode:ujobRoute(ct)};
}
/** 在途中的外運數量。 */
const ujobTransit=()=>G.ships.filter(s=>s.out).reduce((a,s)=>a+s.out.q,0);
/** 商路頁的卸留請負卡：選人、數量、回程委託金，按「外運出發」。 */
function ujobCard(){
  const J=G.ujob;if(!J)return '';
  const c=COMM_MAP[J.name],ct=CITY(J.city);if(!c||!ct)return '';
  const left=Math.max(0,J.qty-J.done-ujobTransit()),open=G.turn<=J.until;
  let h='<div class="card warn"><b class="small">'+UT('r4.card.title')+'</b><div class="tiny">'+UT('r4.card.sub',{g:c.short,q:J.qty,d:J.done,c:ct.name,m:NM('crew',J.mode),t:Math.max(0,J.until-G.turn+1),p:fmt1(c.base*ODDS.unloadJob.payRate)})+'</div>';
  if(!open){h+='<div class="tiny muted" style="margin-top:4px">'+UT('r4.card.closed')+'</div></div>';return h}
  if(left<=0){h+='<div class="tiny muted" style="margin-top:4px">'+UT('r4.card.allOut')+'</div></div>';return h}
  const caps=idleCaptains(J.mode),S=UI.s.uj||(UI.s.uj={});
  if(!caps.length){h+='<div class="tiny muted" style="margin-top:4px">'+UT('r4.card.noCrew',{m:NM('crew',J.mode)})+'</div></div>';return h}
  if(!caps.some(e=>e.id===S.capt))S.capt=caps[0].id;
  const maxQ=Math.max(0,Math.min(G.inv[J.name]||0,left,capOf(J.name,J.mode)));
  S.qty=clamp(Math.floor(S.qty||maxQ),0,maxQ);S.budget=clamp(Math.floor((S.budget||0)/50)*50,0,Math.max(0,Math.floor(G.silver-voyQTotal())));
  h+='<div style="margin-top:4px">'+caps.map(e=>'<span class="pill '+(e.id===S.capt?'on':'')+'" data-act="ujCapt" data-id="'+e.id+'">'+esc(e.name)+'</span>').join('')+'</div>';
  const maxB=Math.floor(Math.min(5000,Math.max(0,G.silver-voyQTotal()))/50)*50,bMax=maxB>=100?maxB:0;   // 回程委託金上限同委託採買 5,000 兩（第三百五十七節）if(S.budget>bMax)S.budget=bMax;if(S.budget>0&&S.budget<100)S.budget=100;
  h+='<div class="row small" style="margin-top:4px"><span>'+UT('r4.card.qty',{h:G.inv[J.name]||0,m:maxQ})+'</span><b id="uj-q-v">'+S.qty+'</b></div>';
  h+=stepRow('<input id="uj-q" type="range" min="0" max="'+Math.max(1,maxQ)+'" value="'+S.qty+'" step="1" data-chg="ujQty" data-lbl="uj-q-v"'+(maxQ<1?' disabled':'')+'>','uj-q',maxQ<1||S.qty<=0,maxQ<1||S.qty>=maxQ);
  h+='<div class="row small" style="margin-top:4px"><span>'+UT('r4.card.budget')+'</span><b id="uj-b-v">'+UT('r4.card.budgetVal',{a:fmt(S.budget)})+'</b></div>';
  h+=stepRow('<input id="uj-b" type="range" min="0" max="'+Math.max(50,bMax)+'" value="'+S.budget+'" step="50" data-chg="ujBudget" data-lbl="uj-b-v" data-snap="100" data-prev="'+S.budget+'" data-unit="'+esc(UT('r4.card.budgetVal',{a:'#'}))+'"'+(bMax<100?' disabled':'')+'>','uj-b',bMax<100||S.budget<=0,bMax<100||S.budget>=bMax);
  h+='<button class="pixel-btn btn-gold" style="width:100%;margin-top:6px" data-act="ujGo" '+(maxQ<=0||S.qty<=0||apLeft()<=0?'disabled':'')+'>'+UT('btn.ujGo')+'</button>';
  h+='<div class="tiny muted" style="margin-top:3px">'+UT('r4.card.foot')+'</div>';
  return h+'</div>';
}
ACT.ujCapt=el=>{(UI.s.uj=UI.s.uj||{}).capt=el.dataset.id;renderRoutes()};
CHG.ujQty=el=>{(UI.s.uj=UI.s.uj||{}).qty=+el.value;renderRoutes()};
CHG.ujBudget=el=>{const S=(UI.s.uj=UI.s.uj||{});S.budget=snapVal(el);renderRoutes()};
/** 外運出發：從倉庫裝貨，扣 1 行動點數；回程委託金可以是 0。 */
ACT.ujGo=()=>{
  const J=G.ujob,S=UI.s.uj||{};if(!J||G.turn>J.until){toast(MSG('r4.ujClosed'));return}
  if(banditBlocks(J.mode)){toast(UT('bandit.notice.'+J.mode,{n:banditLeft()}),4200);return}
  if((G.injured||0)>0){toast(MSG(hurtKey('sendVoyage.hurt'),{injured:G.injured}),4200);return}
  const cap=idleCaptains(J.mode).find(e=>e.id===S.capt);if(!cap){toast(MSG('sendVoyage.2',{mode:NM('crew',J.mode)}));return}
  const ct=CITY(J.city);if(!ujobRoute(ct)){toast(MSG('sendVoyage.4',{REG_NAME:REG_NAME(ct.region_id),sea:(J.mode==='sea'?UT('voy.sendVoyage'):UT('voy.sendVoyage.2'))}),4200);return}
  const left=J.qty-J.done-ujobTransit(),q=Math.floor(Math.min(S.qty||0,G.inv[J.name]||0,left,capOf(J.name,J.mode)));
  if(q<=0){toast(MSG('r4.ujNoGoods'));return}
  const b=Math.floor(S.budget||0);if(b>0&&b<100){toast(MSG('sendVoyage.5'));return}
  if(b>G.silver){toast(MSG('sendVoyage.6',{budget:fmt(b)}));return}
  if(!spendAP()){toast(MSG('sendVoyage.ap'));return}
  let d=distTurns(homeCity(),ct,J.mode);if(J.mode==='land'){if(G.flags.horse>0)d--;if(G.flags.road)d--;d=Math.max(1,d)}
  const unit=avgCostOf(J.name);stockTake(J.name,q,false);
  if(b>0)payPublic('spend.voyage|'+ct.id,b);
  const st=statsOfEmp(cap),risk=voyRisk(cap,d,J.mode)*(J.mode==='sea'&&G.flags.escort>0?ODDS.voyageRisk.escortMul:1);
  const bo=buyoutSnapshot(ct),rank=b>0?originTripTake(ct.id):0;
  G.ships.push({id:G.turn+'_'+Math.floor(rnd()*1e5),entrust:true,origId:ct.id,mode:J.mode,eta:d,eta0:d,risk,riskGo:risk,feeMul:(G.flags.taxfree>0?0.5:1)*(1-Math.min(0.3,0.1*(G.flags.charter||0))),cheap:G.flags.cheap>0,cost:b,budget:b,start:G.turn,capt:cap.id,captName:cap.name,cs:st.commerce_skill,ca:st.audacity_courage,
    buyout:bo.hit,buyoutY:bo.y,buyoutM:bo.m,buyoutRegion:bo.rid,supplyY:G.year,supplyM:G.month,supplyRank:rank,unl:unloadProds(ct.id),out:{name:J.name,q,unit,job:J.id}});
  UI.s.uj={};save();
  playFx(J.mode==='sea'?'boat':'cart',MSG('voyage.depart'),ct.name,()=>{toast(MSG('r4.ujGo',{n:cap.name,g:COMM_MAP[J.name].short,q,c:ct.name,d}),4200);UI.render()},1000);
};
/** 歸來時（resolveVoyage 呼叫）：去程遇險、交貨領錢。回傳入帳金額，說明寫進採買日誌。 */
function outboundSettle(s,E,log){
  const O=s.out,c=COMM_MAP[O.name],J=G.ujob&&G.ujob.id===O.job?G.ujob:null;
  const robbed=banditRobs(s.mode),go=robbed||chance(s.riskGo||s.risk||0);
  const lost=go?Math.round(O.q*ODDS.unloadJob.lossRate):0,got=O.q-lost,pay=Math.round(got*c.base*ODDS.unloadJob.payRate);
  if(J)J.done+=got;
  E.lines.push(NEWS('r4.out.line',{g:c.short,q:O.q,got,lost:lost?UT('r4.out.lost',{n:lost}):'',a:fmt(pay)}));
  E.items.push({n:UT('r4.out.item',{g:c.short}),q:O.q,unit:O.q?pay/O.q:0,cost:0,lost});
  E.outPay=pay;E.outGo=go;if(lost>0)E.lossVal=(E.lossVal||0)+lost*marketQuote(O.name);   // 去程遇險的貨損（荷損御賑）
  return pay;
}
/** 每旬（委託採買歸來之後）：交齊或期滿結算。 */
function ujobTick(log){
  const J=G.ujob;if(!J)return;
  const c=COMM_MAP[J.name],busy=G.ships.some(s=>s.out&&s.out.job===J.id);
  if(J.done>=J.qty){
    const t=NEWS('r4.ujob.done',{g:c.short,q:J.done});pushNews(t);log.push(t);addFame(0.5);G.ujob=null;return;
  }
  if(G.turn>J.until&&!busy){
    const r=G.rel[J.cid];if(r&&alive(J.cid)){setAff(r,Math.max(0,r.aff-ODDS.unloadJob.failAff));logRel(J.cid,UT('r4.log.fail',{d:ODDS.unloadJob.failAff}))}
    loseFame('tributeFail');sfx.bad();
    const t=NEWS('r4.ujob.fail',{g:c.short,q:J.done,n:J.qty});pushNews(t);log.push(t);G.ujob=null;
  }
}

/* ---------- 國商助成 ---------- */
/** 每旬：回扣進私房錢（不經現款、旬報只寫模糊的一句）。官員去職或過世就斷了。 */
function kokushoTick(log){
  const K=G.kokusho;if(!K)return;
  const n=npc(K.cid),ok=n&&alive(K.cid)&&n.pos&&n.pos.court==='region'&&n.pos.posId==='reg_06'&&regOfNpc(n)===homeRegion()&&!n.jailed;
  if(!ok){const t=NEWS('r4.kokusho.cut',{n:nameOf(K.cid)});pushNews(t);log.push(t);G.kokusho=null;return}
  G.gold=(G.gold||0)+rint(ODDS.kokusho.min,ODDS.kokusho.max);K.left--;
  const t=NEWS('r4.kokusho.gift'+(rnd()<0.5?'':'2'),{n:nameOf(K.cid)});pushNews(t);log.push(t);
  if(K.left<=0)G.kokusho=null;
}

/* ---------- 唐船割符：河岸藏走私面板 ---------- */
/** 割符可派的船長：任何空閒的船長。 */
const tallyCaptain=()=>idleCaptains('sea')[0]||null;
function tallyCard(){
  const T=G.tally;if(!T)return '';
  if(T.out)return '<div class="card"><div class="tiny">'+UT('r4.tally.out')+'</div></div>';
  const S=smugSel(),d=SMUG_DEST[S.dest],it=SMUG_BY[S.k],cost=Math.round(it.cost*d.mult*S.qty),cap=tallyCaptain();
  return '<div class="card"><b class="small">'+UT('r4.tally.title')+'</b><div class="tiny muted">'+UT('r4.tally.note')+'</div><div class="row small" style="margin-top:4px"><span>'+UT('r4.tally.cost',{a:cost,n:cap?esc(cap.name):UT('r4.tally.nobody')})+'</span><button class="pixel-btn btn-sm btn-gold" data-act="tallyGo" '+(!cap||apLeft()<=0?'disabled':'')+'>'+UT('btn.tallyGo')+'</button></div></div>';
}
ACT.tallyGo=()=>{
  const T=G.tally;if(!T||T.out)return;
  if((G.exile||0)>0){toast(MSG('smugGo.1'));return}
  const S=smugSel(),d=SMUG_DEST[S.dest],it=SMUG_BY[S.k];
  if(banditBlocks('sea')){toast(UT('bandit.notice.sea',{n:banditLeft()}),4200);return}
  const cap=tallyCaptain();if(!cap){toast(MSG('sendVoyage.2',{mode:NM('crew','sea')}));return}
  if(contraQty()+S.qty>CONTRA_CAP){toast(MSG('smugGo.4'));return}
  const cost=Math.round(it.cost*d.mult*S.qty);
  if(G.gold<cost){toast(MSG('smugGo.5',{cost}));return}
  if((G.injured||0)>0){toast(MSG(hurtKey('smugGo.hurt'),{injured:G.injured}));return}
  if(!spendAP()){toast(MSG('smugGo.ap'));return}
  G.gold-=cost;T.out=true;
  smugList().push({id:G.turn+'_'+Math.floor(rnd()*1e5),k:S.k,qty:S.qty,dest:S.dest,eta:d.d,capt:cap.id,captName:cap.name,tally:true,risk:clamp(ODDS.smugRisk.p*d.d*crewRiskMult(cap),ODDS.smugRisk.min,ODDS.smugRisk.max)});
  sfx.step();toast(MSG('r4.tallyGo',{name:cap.name,d:d.d}));
  UI.render();refreshSheet();
};

/* ---------- 請託的檢查、名稱與效果 ---------- */
{const _res=regFavorResolve;regFavorResolve=function(f,n){
  if(f.unload){const o=unloadOffer(n);if(!o)return Object.assign({},f,{off:true});return Object.assign({},f,{name:UT('fav.runload.n',{g:COMM_MAP[o.name].short}),desc:UT('fav.runload.dd',{g:COMM_MAP[o.name].short,a:fmt(ODDS.unload.pay)})})}
  if(f.ujob){const o=ujobOffer(n);if(!o)return Object.assign({},f,{off:true});return Object.assign({},f,{name:UT('fav.rujob.n',{g:COMM_MAP[o.name].short,q:o.qty}),desc:UT('fav.rujob.dd',{c:CITY(o.city).name,m:NM('crew',o.mode),p:fmt1(COMM_MAP[o.name].base*ODDS.unloadJob.payRate),t:ODDS.unloadJob.limit})})}
  return _res(f,n);
}}
{const _chk=regFavorCheck;regFavorCheck=function(f,n){
  if(f.tally&&G.tally)return MSG('r4.tallyHeld');
  if(f.unload){if(!foreignReg(n))return MSG('r4.unloadForeign');if(!unloadOffer(n))return MSG('r4.unloadNone');if(G.silver<ODDS.unload.pay)return MSG('rfav.short',{a:fmt(ODDS.unload.pay)})}
  if(f.ujob){if(G.ujob)return MSG('r4.ujobBusy');if(!ujobOffer(n))return MSG('r4.ujobNone')}
  if(f.kokusho){if(G.kokusho)return MSG('r4.kokushoBusy');if(G.silver<ODDS.kokusho.pay)return MSG('rfav.short',{a:fmt(ODDS.kokusho.pay)})}
  return _chk(f,n);
}}
REG_FAVOR.rtally=n=>{G.tally={cid:n.cid,turn:G.turn,out:false};return MSG('r4.tally')};
REG_FAVOR.runload=(n,arg)=>{
  const o=unloadOffer(n),port=o&&o.ports.includes(arg)?arg:o&&o.ports[0];
  const W=unloadWindow();
  payPublic('spend.unload|'+o.name,ODDS.unload.pay);
  unloadList().push({rid:o.rid,city:port,name:o.name,cid:n.cid,ask:G.turn,from:W.from,to:W.to});
  return MSG('r4.unload',{a:fmt(ODDS.unload.pay),c:CITY(port).name,g:COMM_MAP[o.name].short,m:W.month});
};
REG_FAVOR.rujob=n=>{
  const o=ujobOffer(n);
  G.ujob={id:G.turn+'_'+Math.floor(rnd()*1e5),cid:n.cid,name:o.name,qty:o.qty,done:0,city:o.city,mode:o.mode,start:G.turn,until:G.turn+ODDS.unloadJob.limit-1};
  return MSG('r4.ujob',{g:COMM_MAP[o.name].short,q:o.qty,c:CITY(o.city).name,t:ODDS.unloadJob.limit});
};
REG_FAVOR.rkokusho=n=>{
  payPublic('spend.kokusho',ODDS.kokusho.pay);addHeat(ODDS.kokusho.heat);
  G.kokusho={cid:n.cid,left:ODDS.kokusho.turns,start:G.turn};
  return MSG('r4.kokusho',{a:fmt(ODDS.kokusho.pay)});
};
SPEND_ARG['spend.unload']=a=>COMM_MAP[a]?COMM_MAP[a].short:a;
