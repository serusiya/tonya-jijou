'use strict';
/* ★檔案總覽：店員職能與店內閒談
 * - 丁稚：代跑腿（拜訪/送禮/兌現承諾不扣行動點數，好感打折）。
 * - 手代：出貨價小幅加成（上限 +4%）、穩定供貨線略降。 番頭：只加大大盤進貨上限。
 * - 大番頭：延續上旬的出貨與進貨數量、已參加協議時代出席公會例會、每旬自動問候 1～3 人（好感 +），並壓低其他店員私吞；皆於旬報回報。 保鏢（合併用心棒）：平時巡守倉庫，出門時護身。
 * - 點畫面中的人：閒聊／店員流言／外人流言（免費探聽性向），同一人一旬最多兩種內容。 */
/* ======================= 04b 店員職能 ======================= */
/** 各職位的職能一句話。 */
const DUTY_DESC={
  丁稚:'跑腿：每名丁稚每旬可代你送 1 趟禮金（中等的一份），不扣行動點數，好感 +4～8；只能派給交情未滿 60 的人，也不能代你請託。',
  手代:'店頭：出貨成交價略增（最多 4%，商才越高越多），穩定供貨線略降。',
  番頭:'採購：每旬大盤進貨上限加大（商才越高越多）。',
  大番頭:'總管：也算一名番頭，大盤進貨上限加大；替你延續上旬的出貨與進貨數量、已參加協議時代出席公會例會（退出協議後不代席，重新加入要你自己去）、每旬七成機率自動登門問候一到三位交情未滿 60 的人（可能結識新朋友），也偶有意外之財；也壓低其他店員私吞，查帳更準。'
};
DUTY_DESC.保鏢=SPECIAL_DESC.保鏢;   // 保鏢說明沿用專職說明（否則私宅說明欄會顯示 undefined）
const nEmp=rk=>G.emps.filter(e=>e.rank===rk).length;
const empsOf=rk=>G.emps.filter(e=>e.rank===rk);
const avgSt=(rk,k)=>{const l=empsOf(rk);return l.length?l.reduce((a,e)=>a+statsOfEmp(e)[k],0)/l.length:50};
/** 經營好手臨時打工（請託）：開口那一旬的結算裡，以他的商才算兩名番頭、兩名手代的加成；回傳商才，不在打工中回傳 null。 */
const tempHelp=()=>G.tempHelp&&G.tempHelp.turn===G.turn?G.tempHelp.cs:null;
/** 手代：出貨加成（最多 +4%）；臨時打工算兩名手代。 */
function tellerBonus(){const t=tempHelp();return Math.min(0.04,empsOf('手代').reduce((a,e)=>a+0.005+0.01*statsOfEmp(e).commerce_skill/100,0)+(t===null?0:2*(0.005+0.01*t/100)))}
/** 大盤進貨上限倍數（乘在「需求×市佔率＋參加協議者的協議配額」上）：基本 0.8，每名番頭依商才加成；大番頭也算一名番頭。 */
const buyLimitMult=()=>{const t=tempHelp();return ODDS.buyLimit.mult+empsOf('番頭').concat(empsOf('大番頭')).reduce((a,e)=>a+ODDS.buyLimit.perBantou*(0.6+0.8*statsOfEmp(e).commerce_skill/100),0)+(t===null?0:2*ODDS.buyLimit.perBantou*(0.6+0.8*t/100))};   // 臨時打工算兩名番頭
/** 手代：穩定供貨線折減。 */
const supplyCut=()=>1-Math.min(0.2,0.05*(nEmp('手代')+(tempHelp()===null?0:2)));
/** 大番頭：壓低其他店員私吞的係數。 */
function guardF(e){
  if(e.rank==='大番頭')return 1;
  const b=empsOf('大番頭')[0];if(!b)return 1;
  return 1-Math.min(0.5,0.2+0.3*statsOfEmp(b).commerce_skill/100);
}
/* ---------- 保鏢＝用心棒：平時巡守（降火災／盜賊／山賊風險），出門時護身 ---------- */
const guardCount=()=>nEmp('保鏢');
/* ---------- 丁稚代跑 ---------- */
var ERR_ACTIVE=false,ERR_REQ=false;
const errandLeft=()=>Math.max(0,nEmp('丁稚')-(G.errandUsed||0));
function errandFactor(){return clamp(0.6+0.2*avgSt('丁稚','diplomacy_charm')/100,0.6,0.8)}
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
  if(d>1)q.aff=a0+Math.floor(d*errandFactor());
  if(r&&r.msg)r.msg+=MSG('errandTrim.1',{q:sgn(Math.round(q.aff-a0))});
}
/** 派丁稚按鈕「丁稚代送（禮金）」：不寫剩餘次數；無丁稚或本旬次數用完就半透明不可按。 */
function errandBtn(cid){
  if(R(cid).aff>=FRIEND_AFF)return '<button class="pixel-btn btn-sm" style="flex:1" disabled title="交情已深，要你親自登門">須親自登門</button>';
  const left=errandLeft(),off=left<=0;
  return '<button class="pixel-btn btn-sm" style="flex:1" '+(off?'disabled ':'')+'data-act="visit" data-err="1" data-cid="'+cid+'">丁稚代送'+(nEmp('丁稚')?'（'+coinHtml('silver',btTiers(cid)[1])+'）':'')+'</button>';
}
/* ---------- 大番頭：旬末代出席公會例會；新旬處理自動問候等事務 ---------- */
/** 新旬由大番頭處理的其他事務：依機率自動問候（可能結識新朋友）、意外之財、或無事。 */
function chiefTick(log){
  if(!nEmp('大番頭'))return;
  chiefUneasy(log);
  const C=ODDS.chief,x=rnd();
  if(x<C.visitP)chiefVisit(log);
  else if(x<C.visitP+C.windfallP)chiefWindfall(log);
}
/** 人心不穩：大番頭累計賺得的意外之財超過當前現款（現金吃緊），下一旬必定捲款潛逃。 */
function chiefUneasy(log){
  const b=empsOf('大番頭')[0];
  if(!b||b.fleeAt!==undefined||!((b.wind||0)>Math.max(0,G.silver)))return;
  b.fleeAt=G.turn+1;
  const t=NEWS('chief.uneasy',{name:b.name});pushNews(t);log.push(t);
}
/** 意外之財：當前現款的 1～10%。 */
function chiefWindfall(log){
  const C=ODDS.chief,amt=Math.round(Math.max(0,G.silver)*(C.windfallMin+rnd()*(C.windfallMax-C.windfallMin)));
  if(amt<=0)return;
  G.silver+=amt;G.lastRev+=amt;sfx.coin();
  const b=empsOf('大番頭')[0];if(b)b.wind=(b.wind||0)+amt;
  if(b)queueFaceEvent({type:'windfall',empId:b.id,amt});
  const t=NEWS('chief.windfall',{amt:fmt(amt)});pushNews(t);log.push(t);
}
/** 旬末檢查代席：玩家已擁有整個可參加旬；推進下一旬時若仍未出席，才由大番頭代席。 */
function chiefGuildTick(log){
  if(!nEmp('大番頭'))return;
  chiefGuild(log);
}
/** 代出席例會：已參加協議（守約或暗約）時，到期的例會自動出席並提案提高配額一次；未參加協議（自己退出或被查獲）不代席，重新加入要東家自己去。 */
function chiefGuild(log){
  if(G.turn-(G.guildAt===undefined?-99:G.guildAt)<GUILD_GAP)return;
  const C=G.cartel,b=empsOf('大番頭')[0];
  if(!guildMember())return;                       // 未參加協議：不出席、不替你重新加入
  G.guildAt=G.turn;C.tried=false;C.paid=true;
  let stance;
  guildEnsure();
  stance=C.state==='secret'?'維持暗約立場':'重申遵守配額';
  let t=NEWS('chief.guild',{stance});pushNews(t);log.push(t);
  if(cartelPolicy()==='normal')return;             // 正常供應配額依穩定供貨線與市占率分配，沒有固定比例可提案
  C.tried=true;
  if(rnd()<quotaRaiseChance()){
    C.quotaPct=Math.min(0.5,Math.round(C.quotaPct*1.1*10000)/10000);
    t=NEWS('chief.raise.ok',{pct:(C.quotaPct*100).toFixed(1)});
  }else t=NEWS('chief.raise.fail');
  pushNews(t);log.push(t);
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
    const g0=Math.min(gain,FRIEND_AFF-r.aff);r.aff=clamp(r.aff+g0,0,100);logRel(cid,'大番頭代為登門問候，好感 +'+g0+'。');
    got.push(nameOf(cid)+' +'+g0);
  }
  if(got.length){const t=NEWS('chief.visit',{list:got.join('、')});pushNews(t);log.push(t)}
  if(chance(C.newFriendP)){
    const cand=cityNpcs(G.cityId).filter(m=>{const r=G.rel[m.cid];return !(r&&r.bond)&&!isEnemy(m.cid)});
    if(cand.length){
      const m=pick(cand),cid=m.cid,r=R(cid),gain=C.gainMin+Math.floor(rnd()*(C.gainMax-C.gainMin+1));
      r.aff=clamp(r.aff+gain,0,100);r.met=true;r.seen=true;addKnown(cid);
      r.bond={mult:0.6,label:'大番頭代為結識',introId:null};
      logRel(cid,'大番頭代為登門結識，好感 +'+gain+'。');
      const t=NEWS('chief.friend',{who:nameOf(cid),gain});pushNews(t);log.push(t);
    }
  }
}
/* ======================= 點人閒談 ======================= */
const CHAT_LINES=LINES.chat;                                   // 台詞在 01d_lines.js
function chatSeason(){const s=season();return ({春:'spring',夏:'summer',秋:'autumn',冬:'winter'})[s]||'spring'}
function chatSelf(ent){return ent.kind==='emp'?G.emps.find(e=>'emp_'+e.id===ent.id):null}
function chitchat(ent){
  const e=chatSelf(ent),pool=[];
  if(ent.kind==='emp'){
    pool.push(...CHAT_LINES.emp);const s=statsOfEmp(e);
    if(s.integrity_loyalty>=65)pool.push(...CHAT_LINES.loyal);
    if(s.greed_index>=65)pool.push(...CHAT_LINES.greed);
    if(s.audacity_courage>=65)pool.push(...CHAT_LINES.brave);
    if(e.rank==='保鏢')pool.push(...CHAT_LINES.guard);
  }else pool.push(...(CHAT_LINES[ent.kind]||CHAT_LINES.emp));
  pool.push(...CHAT_LINES[chatSeason()]);
  return {kind:'閒聊',text:pick(pool)};
}
function staffGossip(ent){
  const me=chatSelf(ent);const others=G.emps.filter(x=>x!==me);
  if(!others.length)return null;
  const x=pick(others),s=statsOfEmp(x),n='『'+x.name+'』（'+x.rank+'）';
  let t;
  if(x.skim>0||x.flag)t=TX('gossip.staff.skim',{n});
  else if(s.betrayal_risk>=60&&s.integrity_loyalty<=45)t=TX('gossip.staff.betray',{n});
  else if(s.greed_index>=70)t=TX('gossip.staff.greedy',{n});
  else if(s.integrity_loyalty>=70)t=TX('gossip.staff.loyal',{n});
  else if(s.commerce_skill>=70)t=TX('gossip.staff.skill',{n});
  else t=TX('gossip.staff.plain',{n});
  return {kind:'店員流言',text:'「'+t+'」'};
}
function outsiderGossip(){
  const cached=G.chat&&G.chat.gossipCid;
  if(cached){
    const n=npc(cached);if(!n||!alive(cached)||isEnemy(cached))return null;
    return {kind:'外人傳聞（免費探聽）',text:'「'+TX('gossip.outsider',{n:nameOf(cached),t:top3(cached).join('、')})+'」',cid:cached};
  }
  const all=Object.values(G.world.npcs).filter(n=>alive(n.cid)&&!R(n.cid).topKnown&&!isEnemy(n.cid));
  if(!all.length)return null;
  const met=all.filter(n=>R(n.cid).met);
  const n=pick(met.length&&rnd()<ODDS.gossipMet.p?met:all),cid=n.cid,r=R(cid);
  G.chat.gossipCid=cid;                                  // 全體店員與家人本旬共用同一位情報對象
  r.topKnown=true;r.seen=true;addKnown(cid);
  logRel(cid,'店裡人閒聊間，傳來關於此人喜好的消息。');
  return {kind:'外人流言（免費探聽）',text:'「'+TX('gossip.outsider',{n:nameOf(cid),t:top3(cid).join('、')})+'」',cid};
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
  const who=e?'【'+e.rank+'】'+e.name:ent.label;
  let h='<div style="display:flow-root">'+(e?portraitEmp(e,56):'')+'<div class="tiny muted">'+esc(c.kind)+'</div><div style="margin-top:4px">'+esc(c.text)+'</div></div>';
  if(c.cid)h+='<div class="notice tiny" style="margin-top:6px">已記入「'+esc(nameOf(c.cid))+'」的性向資料（免費）。</div>';
  UI.showInfo(who,h);
}

/* ======================= 開局加成（依七個流派的順序） ======================= */
/** 流派順序 0～6，越往下越多（累加）：1 介紹人；2 手代、丁稚；3 妻小；4 船長、本地區海運許可、一趟在途採買；5 名望三階（另送交易許可）；6 大番頭、名望四階。現款與私房錢見 SYS。 */
function applyStartBoost(sysKey){
  const idx=SYS.findIndex(s=>s.key===sysKey);if(idx<=0)return;
  if(idx>=1){                                      // 介紹人：優先找掮客，沒有就從介紹人身分白名單挑選
    const ns=Object.values(G.world.npcs),cand=ns.find(n=>n.role==='broker'&&canBeIntro(n.cid))||ns.find(n=>canBeIntro(n.cid));
    if(cand){
      const cid=cand.cid,r=R(cid);r.met=true;r.seen=true;r.aff=Math.max(r.aff,45);r.bond={mult:1,label:'介紹人',introId:null};
      addKnown(cid);G.intros.push({cid});G.introId=cid;logRel(cid,'開業之初，答應當你的介紹人。');
    }
  }
  if(idx>=2){hireEmp(null,'手代');hireEmp(null,'丁稚')}
  if(idx>=3){
    const fn=['阿梅','阿園','小百合','阿花','阿鶴','阿雪','千代','阿初'];
    G.family.spouse={name:pick(fn)+'（町人之女）',kind:'commoner',birthYear:G.year-20};
    G.family.married=true;G.life.spouseKind='commoner';
    const k=newKid();k.birthYear=G.year-2;G.family.kids.push(k);
  }
  if(idx>=4){
    grantSea(homeCity().region_id);
    const cap=hireEmp(null,'船長');cap.stats=Object.assign(cap.stats,{audacity_courage:Math.max(cap.stats.audacity_courage,60)});
    {const dl=destList('sea')[0];if(dl)sendVoyage(cap.id,800,dl.ct.id,'sea',true)}   // 一趟已在途的委託採買（委託金由開局贈與）
  }
  if(idx>=5)G.fame=Math.max(G.fame||0,ODDS.fame.tiers[idx>=6?2:1]);   // 名望三階；陶磁雅玩四階（交易許可見 startTrade）
  if(idx>=6){                                      // 大番頭：從城中適任的經營好手裡聘一位
    const pool=talentPool().filter(n=>suitableEmpRanks(n.cid).includes('大番頭')&&!introOf(n.cid));
    const m=pool.sort((a,b)=>CH(b.cid).derived_stats.integrity_loyalty-CH(a.cid).derived_stats.integrity_loyalty)[0];
    hireEmp(m?m.cid:null,'大番頭');
  }
}
