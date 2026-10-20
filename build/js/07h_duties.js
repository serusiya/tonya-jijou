'use strict';
/* ★檔案總覽：店員職能與店內閒談
 * - 丁稚：代跑腿（拜訪/送禮/兌現承諾不扣行動點數，好感打折）。
 * - 手代：出貨價小幅加成（上限 +4%）、穩定供貨線略降。 番頭：只加大大盤進貨上限。
 * - 大番頭：自動補貨、代出席公會例會、每旬自動問候 1～3 人（好感 +），並壓低其他店員私吞；皆於旬報回報。 保鏢（合併用心棒）：平時巡守倉庫，出門時護身。
 * - 點畫面中的人：閒聊／店員流言／外人流言（免費探聽性向），同一人一旬最多兩種內容。 */
/* ======================= 04b 店員職能 ======================= */
/** 各職位的職能一句話。 */
const DUTY_DESC={
  丁稚:'跑腿：每名丁稚每旬可代你跑 1 趟拜訪／送禮，不扣行動點數，好感只得約六到八成。',
  手代:'店頭：出貨成交價略增（最多 4%，商才越高越多），穩定供貨線略降。',
  番頭:'採購：每旬大盤進貨上限加大（商才越高越多）。',
  大番頭:'總管：代你管進貨（可開「自動補貨」）、代出席公會例會、每旬七成機率自動登門問候一到三人（可能結識新朋友），也偶有意外之財；也壓低其他店員私吞，查帳更準。'
};
DUTY_DESC.保鏢=SPECIAL_DESC.保鏢;   // 保鏢說明沿用專職說明（否則私宅說明欄會顯示 undefined）
const nEmp=rk=>G.emps.filter(e=>e.rank===rk).length;
const empsOf=rk=>G.emps.filter(e=>e.rank===rk);
const avgSt=(rk,k)=>{const l=empsOf(rk);return l.length?l.reduce((a,e)=>a+statsOfEmp(e)[k],0)/l.length:50};
/** 手代：出貨加成（最多 +4%）。 */
function tellerBonus(){return Math.min(0.04,empsOf('手代').reduce((a,e)=>a+0.005+0.01*statsOfEmp(e).commerce_skill/100,0))}
/** 大盤進貨上限倍數（公會配額的幾倍）：基本 0.8，每名番頭依商才加成。 */
const buyLimitMult=()=>ODDS.buyLimit.mult+empsOf('番頭').reduce((a,e)=>a+ODDS.buyLimit.perBantou*(0.6+0.8*statsOfEmp(e).commerce_skill/100),0);
/** 手代：穩定供貨線折減。 */
const supplyCut=()=>1-Math.min(0.2,0.05*nEmp('手代'));
/** 大番頭：壓低其他店員私吞的係數。 */
function guardF(e){
  if(e.rank==='大番頭')return 1;
  const b=empsOf('大番頭')[0];if(!b)return 1;
  return 1-Math.min(0.5,0.2+0.3*statsOfEmp(b).commerce_skill/100);
}
/* ---------- 保鏢＝用心棒：平時巡守（降火災／盜賊／山賊風險），出門時護身 ---------- */
const guardCount=()=>nEmp('保鏢');
/** 舊存檔轉換：用心棒（G.guards）改成同數量的保鏢；移除已刪除的帳房。 */
function migrateSave(o){
  if(o&&!o._m4){o._m4=1;ensureOiran8(o)}
  if(!o||o._m3)return o;o._m3=1;
  o.emps=(o.emps||[]).filter(e=>e.rank!=='帳房');
  const n=Math.min(3,o.guards||0);
  for(let i=0;i<n;i++)o.emps.push({id:'mg'+i+'_'+Math.floor(Math.random()*1e6),cid:null,rank:'保鏢',since:o.turn||0,skim:0,audited:o.turn||0,wage:8,name:pick(KID_NAMES),stats:randStats(),age0:(o.year||0)-14});
  o.guards=0;
  // 地區官制：舊的泊位權／通行手形轉為本地區許可；補上地區官員
  o.permits=o.permits||{sea:{},land:{}};const hr=(CITIES.find(c=>c.id===o.cityId)||{}).region_id;
  if(o.flags&&o.flags.port&&hr)o.permits.sea[hr]=true;if(o.flags&&o.flags.pass&&hr)o.permits.land[hr]=true;
  if(o.world&&o.world.npcs&&!Object.values(o.world.npcs).some(n=>n.pos&&n.pos.court==='region')){
    const used=new Set(Object.keys(o.world.npcs)),pool=CHARS.filter(c=>!used.has(c.id)&&c.birth_year<=(o.year||0)-25&&c.death_year>(o.year||0)+2);
    const g0=G;G={year:o.year||0};try{addRegionOfficials(o.world,used,pool)}finally{G=g0}
  }
  return o;
}
/* ---------- 丁稚代跑 ---------- */
var ERR_ACTIVE=false;
const errandLeft=()=>Math.max(0,nEmp('丁稚')-(G.errandUsed||0));
function errandFactor(){return clamp(0.6+0.2*avgSt('丁稚','diplomacy_charm')/100,0.6,0.8)}
/** 拜訪類動作的行動消耗：開啟「丁稚代跑」且還有名額時，不扣行動點數。 */
function spendVisitAP(){
  if(G.errandOn&&errandLeft()>0){G.errandUsed=(G.errandUsed||0)+1;ERR_ACTIVE=true;return true}
  ERR_ACTIVE=false;return spendAP();
}
/** 代跑的結果：好感增量打折，並在訊息中註明。 */
function errandTrim(cid,a0,r){
  if(!ERR_ACTIVE)return;ERR_ACTIVE=false;
  const q=R(cid),d=q.aff-a0;
  if(d>1)q.aff=a0+Math.floor(d*errandFactor());
  if(r&&r.msg)r.msg+=MSG('errandTrim.1',{q:sgn(Math.round(q.aff-a0))});
}
function errandRow(){
  if(!nEmp('丁稚'))return '';
  return '<div class="row small" style="margin-bottom:6px"><label><input type="checkbox" data-chg="errandOn" '+(G.errandOn?'checked':'')+'> 👦 派丁稚代跑（本旬剩 '+errandLeft()+' 趟·不扣行動·好感約 '+Math.round(errandFactor()*100)+'%）</label></div>';
}
CHG.errandOn=el=>{G.errandOn=!!el.checked;save();refreshSheet()};
/* ---------- 大番頭自動補貨 ---------- */
ACT.toggleRestock=()=>{G.restock=!G.restock;toast(MSG(G.restock?'toggleRestock.on':'toggleRestock.off'));save();UI.render()};
function restockRow(){
  if(!nEmp('大番頭'))return '';
  return '<div style="margin:4px 0"><button class="pixel-btn btn-sm '+(G.restock?'btn-gold':'')+'" data-act="toggleRestock">'+UT(G.restock?'btn.restockOn':'btn.restockOff')+'</button><div class="tiny muted">未手動安排的品項，推進一旬時補到公會配額。</div></div>';
}
function autoRestock(log){
  if(!G.restock||!nEmp('大番頭'))return;
  const got=[];
  ownComms().forEach(c=>{
    if((G.buyPlan&&G.buyPlan[c.name])>0)return;
    const need=quotaOf(c.name)-(G.inv[c.name]||0)-itemOnOrder(c.name);
    const q=Math.min(need,maxBuy(c.name));
    if(q>0){const r=buyGoods(c.name,q);if(r.ok)got.push(c.short+'×'+q)}
  });
  if(got.length)log.push(NEWS('autoRestock.1',{got:got.join('、')}));
}
/* ---------- 大番頭：代出席公會例會、每旬自動問候（皆於旬報回報，不扣行動點數、不花錢） ---------- */
/** 每旬由大番頭處理的事務：照常代出席例會；其餘依機率——自動問候（可能結識新朋友）、意外之財、或無事。 */
function chiefTick(log){
  if(!nEmp('大番頭'))return;
  chiefGuild(log);chiefUneasy(log);
  const C=ODDS.chief,x=rnd();
  if(x<C.visitP)chiefVisit(log);
  else if(x<C.visitP+C.windfallP)chiefWindfall(log);
}
/** 人心不穩：大番頭累計賺得的意外之財超過當前白銀（現金吃緊），下一旬必定捲款潛逃。 */
function chiefUneasy(log){
  const b=empsOf('大番頭')[0];
  if(!b||b.fleeAt!==undefined||!((b.wind||0)>Math.max(0,G.silver)))return;
  b.fleeAt=G.turn+1;
  const t=NEWS('chief.uneasy',{name:b.name});pushNews(t);log.push(t);
}
/** 意外之財：當前白銀的 1～10%。 */
function chiefWindfall(log){
  const C=ODDS.chief,amt=Math.round(Math.max(0,G.silver)*(C.windfallMin+rnd()*(C.windfallMax-C.windfallMin)));
  if(amt<=0)return;
  G.silver+=amt;G.lastRev+=amt;sfx.coin();
  const b=empsOf('大番頭')[0];if(b)b.wind=(b.wind||0)+amt;
  const t=NEWS('chief.windfall',{amt:fmt(amt)});pushNews(t);log.push(t);
}
/** 代出席例會：到期的例會自動出席；尚未表態則表態守配額，並照常提案提高配額一次。 */
function chiefGuild(log){
  if(G.turn-(G.guildAt===undefined?-99:G.guildAt)<GUILD_GAP)return;
  const C=G.cartel,b=empsOf('大番頭')[0];
  G.guildAt=G.turn;C.tried=false;C.paid=true;
  let stance;
  if(C.state==='none'||!C.state){C.state='pledged';C.comp=Math.min(90,C.comp+3);G.rep=clamp(G.rep+1,0,100);stance='表態遵守配額'}
  else stance=C.state==='secret'?'維持暗約立場':'重申遵守配額';
  let t=NEWS('chief.guild',{stance});pushNews(t);log.push(t);
  C.tried=true;
  if(rnd()<quotaRaiseChance()){
    C.quotaPct=Math.min(0.5,Math.round(C.quotaPct*1.1*10000)/10000);G.rep=clamp(G.rep+1,0,100);
    t=NEWS('chief.raise.ok',{pct:(C.quotaPct*100).toFixed(1)});
  }else t=NEWS('chief.raise.fail');
  pushNews(t);log.push(t);
}
/** 自動問候：挑 1～3 位已結識、尚未滿格的人登門閒話，好感 +5～10（不送禮、不花錢，交情較淺者優先）；另有機率結識城中新朋友。 */
function chiefVisit(log){
  const C=ODDS.chief,pool=Object.entries(G.rel).filter(([cid,r])=>r.bond&&r.aff>=1&&r.aff<100&&npc(cid)&&!isEnemy(cid));
  const got=[];
  const n=pool.length?Math.min(pool.length,C.visitMin+Math.floor(rnd()*(C.visitMax-C.visitMin+1))):0;
  for(let i=0;i<n;i++){
    const w=pool.map(([cid,r])=>100-r.aff);let tot=w.reduce((a,b)=>a+b,0),x=rnd()*tot,k=0;
    for(;k<w.length-1;k++){x-=w[k];if(x<=0)break}
    const [cid,r]=pool.splice(k,1)[0];
    const gain=C.gainMin+Math.floor(rnd()*(C.gainMax-C.gainMin+1));
    r.aff=clamp(r.aff+gain,0,100);logRel(cid,'大番頭代為登門問候，好感 +'+gain+'。');
    got.push(nameOf(cid)+' +'+gain);
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
  const all=Object.values(G.world.npcs).filter(n=>alive(n.cid)&&!R(n.cid).topKnown&&!isEnemy(n.cid));
  if(!all.length)return null;
  const met=all.filter(n=>R(n.cid).met);
  const n=pick(met.length&&rnd()<ODDS.gossipMet.p?met:all),cid=n.cid,r=R(cid);
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
  if(!G.chat||G.chat.turn!==G.turn)G.chat={turn:G.turn,map:{},n:{}};
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
/** 流派順序 0～6：0 不變；1 介紹人＋兩名店員；2 再加妻小；3 再加海運；4 再加知名度三階；5 僅私款 1 萬；6 ＝ 4 加 5（資金為兩者相加）。 */
function applyStartBoost(sysKey){
  const idx=SYS.findIndex(s=>s.key===sysKey);if(idx<=0)return;
  const eff=idx===6?[4,5]:[idx],has=f=>eff.some(f);
  if(has(i=>i===5)){G.gold=10000+(idx===6?SYS[4].gold:0)}
  if(has(i=>i>=1&&i<=4)){
    // 介紹人：本城掮客（沒有就找任一非官員）
    const ns=Object.values(G.world.npcs),cand=ns.filter(n=>n.role==='broker')[0]||ns.find(n=>n.role!=='official');
    if(cand){
      const cid=cand.cid,r=R(cid);r.met=true;r.seen=true;r.aff=Math.max(r.aff,45);r.bond={mult:1,label:'介紹人',introId:null};
      addKnown(cid);G.intros.push({cid});G.introId=cid;logRel(cid,'開業之初，答應當你的介紹人。');
    }
    // 兩名店員
    hireEmp(null,'手代');hireEmp(null,'丁稚');
  }
  if(has(i=>i>=2&&i<=4)){
    const fn=['阿梅','阿園','小百合','阿花','阿鶴','阿雪','千代','阿初'];
    G.family.spouse={name:pick(fn)+'（町人之女）',kind:'commoner',birthYear:G.year-20};
    G.family.married=true;G.life.spouseKind='commoner';
    const k=newKid();k.birthYear=G.year-2;G.family.kids.push(k);
  }
  if(has(i=>i>=3&&i<=4)){
    grantSea(homeCity().region_id);
    const cap=hireEmp(null,'船長');cap.stats=Object.assign(cap.stats,{audacity_courage:Math.max(cap.stats.audacity_courage,60)});
    // 一趟已在途的海運（委託金由開局贈與）
    {const dl=destList('sea')[0];if(dl)sendVoyage(cap.id,800,dl.ct.id,'sea',true)}
  }
  if(has(i=>i===4))G.fame=Math.max(G.fame||0,40);
}
