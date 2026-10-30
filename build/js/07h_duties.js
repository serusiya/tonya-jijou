'use strict';
/* ★檔案總覽：店員職能與店內閒談
 * - 丁稚：代跑腿（拜訪/送禮/兌現承諾不扣行動點數，好感打折）。
 * - 手代：出貨價小幅加成（上限 +4%）、穩定供貨線略降。 番頭：只加大大盤進貨上限。
 * - 大番頭：每旬自動問候 1～3 人（好感 +），並壓低其他店員私吞；皆於旬報回報。 保鏢（合併用心棒）：平時巡守倉庫，出門時護身。
 * - 點畫面中的人：閒聊／店員流言／外人流言（免費探聽性向），同一人一旬最多兩種內容。 */
/* ======================= 04b 店員職能 ======================= */
/** 各職位的職能一句話。 */
const DUTY_DESC={};RANKS.concat(SPECIAL).forEach(k=>DUTY_DESC[k]=UT('duty.'+k));   // 說明文字在 01e_ui_text.js（duty.*）
const nEmp=rk=>G.emps.filter(e=>e.rank===rk).length;
const empsOf=rk=>G.emps.filter(e=>e.rank===rk);
const avgSt=(rk,k)=>{const l=empsOf(rk);return l.length?l.reduce((a,e)=>a+statsOfEmp(e)[k],0)/l.length:50};
/** 經營好手臨時打工（請託）：開口那一旬的結算裡，以他的商才算兩名番頭、兩名手代的加成；回傳商才，不在打工中回傳 null。 */
const tempHelp=()=>G.tempHelp&&G.tempHelp.turn===G.turn?G.tempHelp.cs:null;
/** 手代：出貨加成（最多 +4%）；臨時打工算兩名手代。 */
function tellerBonus(){const t=tempHelp();return Math.min(0.04,empsOf('clerk').reduce((a,e)=>a+0.005+0.01*statsOfEmp(e).commerce_skill/100,0)+(t===null?0:2*(0.005+0.01*t/100)))}
/** 大盤進貨上限倍數（乘在「需求×市佔率＋參加協議者的協議配額」上）：基本 0.8，每名番頭依商才加成；大番頭也算一名番頭。 */
const buyLimitMult=()=>{const t=tempHelp();return ODDS.buyLimit.mult+empsOf('banto').concat(empsOf('chief')).reduce((a,e)=>a+ODDS.buyLimit.perBantou*(0.6+0.8*statsOfEmp(e).commerce_skill/100),0)+(t===null?0:2*ODDS.buyLimit.perBantou*(0.6+0.8*t/100))};   // 臨時打工算兩名番頭
/** 手代：穩定供貨線折減。 */
const supplyCut=()=>1-Math.min(0.2,0.05*(nEmp('clerk')+(tempHelp()===null?0:2)));
/** 手代第 5 名起照料庫存：每多一名，持有成本（損耗與倉儲保險）減 5%，最多減 30%。只算本店手代（臨時打工不算）。回傳乘數。 */
const KEEP_FROM=4,KEEP_PER=0.05,KEEP_MAX=0.3;
const keeperMul=()=>1-Math.min(KEEP_MAX,KEEP_PER*Math.max(0,nEmp('clerk')-KEEP_FROM));
/** 大番頭：壓低其他店員私吞的係數。 */
function guardF(e){
  if(e.rank==='chief')return 1;
  const b=empsOf('chief')[0];if(!b)return 1;
  return 1-Math.min(0.5,0.2+0.3*statsOfEmp(b).commerce_skill/100);
}
/* ---------- 保鏢＝用心棒：平時巡守（降火災／盜賊／山賊風險），出門時護身 ---------- */
const guardCount=()=>nEmp('guard');
/* ---------- 丁稚代跑 ---------- */
var ERR_ACTIVE=false,ERR_REQ=false;
const errandLeft=()=>Math.max(0,nEmp('apprentice')-(G.errandUsed||0));
function errandFactor(){return clamp(0.6+0.2*avgSt('apprentice','diplomacy_charm')/100,0.6,0.8)}
/** 拜訪類動作的行動消耗：開啟「丁稚代跑」且還有名額時，不扣行動點數。 */
function spendVisitAP(){
  const want=ERR_REQ;ERR_REQ=false;
  if(want&&errandLeft()>0){G.errandUsed=(G.errandUsed||0)+1;ERR_ACTIVE=true;return true}
  ERR_ACTIVE=false;return spendAP();
}
/** 代跑的結果：好感增量打折，並在訊息中註明。 */
function errandTrim(cid,a0,r){
  if(!ERR_ACTIVE)return;ERR_ACTIVE=false;
  const q=R(cid),d=q.aff-a0;
  if(d>1)setAff(q,a0+Math.floor(d*errandFactor()));
  if(r&&r.msg)r.msg+=MSG('errandTrim.1',{q:sgn(Math.round(q.aff-a0))});
}
/** 派丁稚按鈕「丁稚代送（禮金）」：不寫剩餘次數；無丁稚或本旬次數用完就半透明不可按。 */
function errandBtn(cid){
  if(R(cid).aff>=FRIEND_AFF)return UT('duty2.errandBtn');
  const left=errandLeft(),off=left<=0;
  return '<button class="pixel-btn btn-sm" style="flex:1" '+(off?'disabled ':'')+'data-act="visit" data-err="1" data-cid="'+UT('duty2.errandBtn.3',{a:cid,b:nEmp('apprentice')?UT('duty2.errandBtn.2',{a:coinHtml('silver',btTiers(cid)[1])}):''})+'</button>';
}
/* ---------- 大番頭：新旬處理自動問候等事務（代出席例會已取消，例會要親自去） ---------- */
/** 新旬由大番頭處理的其他事務：依機率自動問候（可能結識新朋友）、意外之財、或無事。 */
function chiefTick(log){
  if(!nEmp('chief'))return;
  chiefUneasy(log);
  const C=ODDS.chief,x=rnd();
  if(x<C.visitP)chiefVisit(log);
  else if(x<C.visitP+C.windfallP)chiefWindfall(log);
}
/** 人心不穩：大番頭累計賺得的意外之財超過當前現款（現金吃緊），下一旬必定捲款潛逃。 */
function chiefUneasy(log){
  const b=empsOf('chief')[0];
  if(!b||b.fleeAt!==undefined||!((b.wind||0)>Math.max(0,G.silver)))return;
  b.fleeAt=G.turn+1;
  const t=NEWS('chief.uneasy',{name:b.name});pushNews(t);log.push(t);
}
/** 意外之財：當前現款的 1～10%。 */
function chiefWindfall(log){
  const C=ODDS.chief,amt=Math.round(Math.max(0,G.silver)*(C.windfallMin+rnd()*(C.windfallMax-C.windfallMin)));
  if(amt<=0)return;
  G.silver+=amt;G.lastRev+=amt;sfx.coin();if(TURNRP)TURNRP.windfall=(TURNRP.windfall||0)+amt;   // 旬報收入獨立一行
  const b=empsOf('chief')[0];if(b)b.wind=(b.wind||0)+amt;
  if(b)queueFaceEvent({type:'windfall',empId:b.id,amt});
  const t=NEWS('chief.windfall',{amt:fmt(amt)});pushNews(t);log.push(t);
}
/** 自動問候：挑 1～3 位已結識、好感未滿 60 的人登門閒話，好感 +5～10（不送禮、不花錢，交情較淺者優先）；另有機率結識城中新朋友。 */
function chiefVisit(log){
  const C=ODDS.chief,pool=Object.entries(G.rel).filter(([cid,r])=>r.bond&&r.aff>=1&&r.aff<FRIEND_AFF&&npc(cid)&&!isEnemy(cid));   // 只補到 60
  const got=[];
  const n=pool.length?Math.min(pool.length,C.visitMin+Math.floor(rnd()*(C.visitMax-C.visitMin+1))):0;
  for(let i=0;i<n;i++){
    const w=pool.map(([cid,r])=>FRIEND_AFF-r.aff);let tot=w.reduce((a,b)=>a+b,0),x=rnd()*tot,k=0;
    for(;k<w.length-1;k++){x-=w[k];if(x<=0)break}
    const [cid,r]=pool.splice(k,1)[0];
    const gain=C.gainMin+Math.floor(rnd()*(C.gainMax-C.gainMin+1));
    const g0=Math.min(gain,FRIEND_AFF-r.aff);setAff(r,clamp(r.aff+g0,0,100));logRel(cid,UT('duty2.chiefVisit',{a:g0}));
    got.push(nameOf(cid)+' +'+g0);
  }
  if(got.length){const t=NEWS('chief.visit',{list:got.join(UT('duty2.t'))});pushNews(t);log.push(t)}
  if(chance(C.newFriendP)){
    const cand=cityNpcs(G.cityId).filter(m=>{const r=G.rel[m.cid];return !(r&&r.bond)&&!isEnemy(m.cid)});
    if(cand.length){
      const m=pick(cand),cid=m.cid,r=R(cid),gain=C.gainMin+Math.floor(rnd()*(C.gainMax-C.gainMin+1));
      setAff(r,clamp(r.aff+gain,0,100));r.met=true;r.seen=true;addKnown(cid);
      r.bond={mult:0.6,label:UT('duty2.chiefVisit.2'),introId:null};
      logRel(cid,UT('duty2.chiefVisit.3',{a:gain}));
      const t=NEWS('chief.friend',{who:nameOf(cid),gain});pushNews(t);log.push(t);
    }
  }
}
/* ======================= 點人閒談 ======================= */
const CHAT_LINES=LINES.chat;                                   // 台詞在 01d_lines.js
const chatSeason=()=>season()||'spring';
function chatSelf(ent){return ent.kind==='emp'?G.emps.find(e=>'emp_'+e.id===ent.id):null}
function chitchat(ent){
  const e=chatSelf(ent),pool=[];
  if(ent.kind==='emp'){
    pool.push(...CHAT_LINES.emp);const s=statsOfEmp(e);
    if(s.integrity_loyalty>=65)pool.push(...CHAT_LINES.loyal);
    if(s.greed_index>=65)pool.push(...CHAT_LINES.greed);
    if(s.audacity_courage>=65)pool.push(...CHAT_LINES.brave);
    if(e.rank==='guard')pool.push(...CHAT_LINES.guard);
  }else pool.push(...(CHAT_LINES[ent.kind]||CHAT_LINES.emp));
  pool.push(...CHAT_LINES[chatSeason()]);
  return {kind:UT('duty2.chitchat'),text:pick(pool)};
}
function staffGossip(ent){
  const me=chatSelf(ent);const others=G.emps.filter(x=>x!==me);
  if(!others.length)return null;
  const x=pick(others),s=statsOfEmp(x),n=UT('duty2.n',{a:x.name,b:rankName(x.rank)});
  let t;
  let rumor=false;
  if(rumorOf(x)){t=TX('gossip.staff.skim',{n});x.rumorUntil=G.turn+STAFF.rumorTurns;rumor=true}   // 私吞流言（可能是冤枉）：標記風聲，才能查帳
  else if(s.betrayal_risk>=60&&s.integrity_loyalty<=45)t=TX('gossip.staff.betray',{n});
  else if(s.greed_index>=70)t=TX('gossip.staff.greedy',{n});
  else if(s.integrity_loyalty>=70)t=TX('gossip.staff.loyal',{n});
  else if(s.commerce_skill>=70)t=TX('gossip.staff.skill',{n});
  else t=TX('gossip.staff.plain',{n});
  return {kind:UT('duty2.staffGossip'),text:UT('duty2.staffGossip.2',{a:t}),rumorEmp:rumor?x.id:null};
}
function outsiderGossip(){
  const cached=G.chat&&G.chat.gossipCid;
  if(cached){
    const n=npc(cached);if(!n||!alive(cached)||isEnemy(cached))return null;
    return {kind:UT('duty2.outsiderGossip'),text:UT('duty2.staffGossip.2',{a:TX('gossip.outsider',{n:nameOf(cached),t:top3Txt(cached)})}),cid:cached};
  }
  const all=cityNpcs(G.cityId).filter(n=>!R(n.cid).topKnown&&!isEnemy(n.cid));   // 只講本城的人
  if(!all.length)return null;
  const met=all.filter(n=>R(n.cid).met);
  const n=pick(met.length&&rnd()<ODDS.gossipMet.p?met:all),cid=n.cid,r=R(cid);
  G.chat.gossipCid=cid;                                  // 全體店員與家人本旬共用同一位情報對象
  r.topKnown=true;r.seen=true;addKnown(cid);
  logRel(cid,UT('duty2.outsiderGossip.2'));
  return {kind:UT('duty2.outsiderGossip.3'),text:UT('duty2.staffGossip.2',{a:TX('gossip.outsider',{n:nameOf(cid),t:top3Txt(cid)})}),cid};
}
function genChat(ent){
  const r=rnd();
  let c=null;
  if(r>=1-ODDS.chatMix.outsider)c=outsiderGossip();
  else if(r>=1-ODDS.chatMix.outsider-ODDS.chatMix.staff)c=staffGossip(ent);
  return c||chitchat(ent);
}
/** 取得該人物本旬的對話內容：同一人一旬最多兩種，之後輪流重複。 */
function chatFor(ent){
  if(!G.chat||G.chat.turn!==G.turn)G.chat={turn:G.turn,map:{},n:{},gossipCid:null};
  const L=G.chat.map[ent.id]=G.chat.map[ent.id]||[];
  if(L.length<2){
    let c=genChat(ent),k=0;
    while(L.some(x=>x.text===c.text)&&k++<6)c=genChat(ent);
    L.push(c);G.chat.n[ent.id]=L.length;return c;
  }
  G.chat.n[ent.id]=(G.chat.n[ent.id]||0)+1;
  return L[G.chat.n[ent.id]%2];
}
function openChat(ent){
  const c=chatFor(ent),e=chatSelf(ent);
  const who=e?UT('duty2.who',{a:rankName(e.rank),b:e.name}):ent.label;
  let h='<div style="display:flow-root">'+(e?portraitEmp(e,56):'')+'<div class="tiny muted">'+esc(c.kind)+'</div><div style="margin-top:4px">'+esc(c.text)+'</div></div>';
  if(c.cid)h+=UT('duty2.openChat',{a:esc(nameOf(c.cid))});
  if(c.rumorEmp){const x=G.emps.find(y=>y.id===c.rumorEmp);if(x){if(G.chat.turn===G.turn&&!hasRumor(x))x.rumorUntil=G.turn+STAFF.rumorTurns;h+='<div class="notice tiny" style="margin-top:6px">'+esc(MSG('audit.heard',{name:x.name,rank:rankName(x.rank)}))+'</div>'}}
  UI.showInfo(who,h);
}

/* ======================= 開局加成（依七個流派的順序） ======================= */
/** 流派順序 0～6，越往下越多（累加）：1 介紹人；2 手代、丁稚；3 妻小；4 船長、本地區海運許可、一趟在途採買；5 名望三階（另送交易許可）；6 大番頭、名望四階。現款與私房錢見 SYS。 */
function applyStartBoost(sysKey){
  const idx=SYS.findIndex(s=>s.key===sysKey);if(idx<=0)return;
  if(idx>=1){                                      // 介紹人：優先找掮客，沒有就從介紹人身分白名單挑選
    const ns=cityNpcs(G.cityId),cand=ns.find(n=>n.role==='broker'&&canBeIntro(n.cid))||ns.find(n=>canBeIntro(n.cid));
    if(cand){
      const cid=cand.cid,r=R(cid);r.met=true;r.seen=true;setAff(r,Math.max(r.aff,45));r.bond={mult:1,label:UT('duty2.applyStartBoost'),introId:null};
      addKnown(cid);G.intros.push({cid});G.introId=cid;logRel(cid,UT('duty2.applyStartBoost.2'));
    }
  }
  if(idx>=2){hireEmp(null,'clerk');hireEmp(null,'apprentice')}
  if(idx>=3){
    const fn=NAMES.spouse;
    G.family.spouse={name:UT('duty2.applyStartBoost.3',{a:pick(fn)}),kind:'commoner',birthYear:G.year-20};
    G.family.married=true;G.life.spouseKind='commoner';
    const k=newKid();k.birthYear=G.year-2;G.family.kids.push(k);
  }
  if(idx>=4){
    grantSea(homeCity().region_id);
    const cap=hireEmp(null,'captain');cap.stats=Object.assign(cap.stats,{audacity_courage:Math.max(cap.stats.audacity_courage,60)});
    {const dl=destList('sea')[0];if(dl)sendVoyage(cap.id,800,dl.ct.id,'sea',true)}   // 一趟已在途的委託採買（委託金由開局贈與）
  }
  if(idx>=5)setFame(Math.max(G.fame||0,ODDS.fame.tiers[idx>=6?2:1]));   // 名望三階；陶磁雅玩四階（交易許可見 startTrade）
  if(idx>=6){                                      // 大番頭：從城中適任的經營好手裡聘一位
    const pool=talentPool().filter(n=>suitableEmpRanks(n.cid).includes('chief')&&!introOf(n.cid));
    const m=pool.sort((a,b)=>CH(b.cid).derived_stats.integrity_loyalty-CH(a.cid).derived_stats.integrity_loyalty)[0];
    hireEmp(m?m.cid:null,'chief');
  }
}
