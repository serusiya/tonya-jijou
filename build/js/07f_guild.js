/* ═════ [07x_dealers] ═════ */
'use strict';
/* ======================= 商人請託：同業調貨、掮客銷貨、經營好手臨時打工、座客商人代售他行貨物、私梟脫手走私貨 =======================
 *  - 拜訪同業、掮客、經營好手、座客商人或私梟打勝、好感 ≥60 時出現請託（與官員請託同一個視窗）。開口好感 −10，同一人冷卻 3 旬。
 *  - 不在協議裡（沒參加或違約被查獲後）：同業不肯調貨；仲買人銷貨、旅商人代售壓價，開口時多一句被排擠的話（第二百四十七節）。
 *  - 同業巨賈「調貨」：本旬缺口金額最大的一項本業貨（都沒缺就隨機；同一人同一旬固定），數量 30～50、金額上限 3,000～4,000 兩（不超過倉位、庫存上限與現款；第二百四十六節），照大盤市價（未參加協議價）付現款，當場入倉。
 *  - 掮客「銷貨」：庫存單位數最多的本業貨（同量取基準價最高），以大盤市價七折賣出，最多 10 單位、金額最多約 400～500 兩（庫存不夠就全賣），收入進現款；不算出貨，不影響行情、配額與市佔率。
 *  - 經營好手「臨時打工」：開口那一旬的結算裡，以他的商才算三名番頭的加成（進貨上限、進貨價；不算手代，第三百六十五節；不佔名額、不付月例）。
 *  - 座客商人「代售」：倉庫裡的他行貨物，一次一項、整批全收；價格約為基準價的 54%～87%（看這位商人的好感），量大再打折。收入進現款。
 *  - 私梟「脫手」：密庫裡的走私貨，一次一項、整批全收；照本旬黑市行情與數量折扣計價，收入進私房錢；不加風聲（第二百三十六節）。
 *  - 私梟落網：風聲偏緊（> 3）時，近 36 旬替你脫過手的私梟每旬有機率落網（下獄 36 旬）；落網後依忠誠與交情決定會不會供出你。 */
const DEAL_CD=3;
/** 這位商人能不能開口（冷卻中則否）。 */
const dealReady=cid=>G.turn-(R(cid).dealT===undefined?-99:R(cid).dealT)>=DEAL_CD;
/** 座客商人代售的成數：看這位商人的好感（另有 ±8% 浮動），量大再打折。 */
function xsellQuote(cid,name,q,noise){
  const c=COMM_MAP[name],tf=trustFactor(R(cid).aff);
  const m=clamp(0.42+0.30*tf+(noise===undefined?0:noise),0.35,0.9)*(guildShunned()?ODDS.shun.xsell:1),unit=c.base*m*(1-Math.min(0.25,0.002*q));   // 不在協議時再壓價
  return {m,rev:Math.round(unit*q)};
}
/** 本旬黑市行情的文字（相對基準）。 */
function smugMood(k){const f=(G.smugP&&G.smugP[k])||1;return f>=1.15?UT('deal.smugMood'):f<=0.92?UT('deal.smugMood.2'):UT('deal.smugMood.3')}
/** 不在協議裡（沒參加，或違約被查獲後還沒重新加入）：同業不肯調貨，仲買人、旅商人收貨壓價（第二百四十七節）。 */
const guildShunned=()=>!guildMember();
/** 被排擠時那句話：同一人同一旬固定一句（不耗遊戲亂數）。role：broker／guest。 */
function shunLine(cid,role){const L=Ls('shun.'+role);return L[Math.floor(seeded('shun'+cid+'_'+G.turn)()*L.length)]}
/** 同業調貨的單價：大盤市價（未參加協議價）。 */
const rivalUnit=n=>unitBuyCost(n)/(guildMember()?ODDS.rivalShip.buyMult:1);
/** 本旬某項本業貨的缺口（單位）：協議配額（未參加看穩定供貨線）＋這次推進要交的合約（掛賣、上貢、本陣御用達）＋還沒出發的注文，扣掉現有庫存。 */
function rivalGap(n){
  const kk=pactAll().filter(p=>p.name===n&&p.due).reduce((a,p)=>a+p.qty,0);   // 這次推進要交的合約：掛賣、上貢、本陣御用達
  const cm=(G.chumon||[]).filter(o=>o.name===n&&!o.sent).reduce((a,o)=>a+o.qty,0);
  return Math.max(0,quotaOf(n)+kk+cm-(G.inv[n]||0));
}
/** 同業調貨：本旬這位同業能調給你的貨，沒有就回傳 null（第二百四十六節）。
 *  有缺口的貨裡挑缺口金額最大的一項；都沒缺就隨機。數量 30～50、金額上限 3,000～4,000 兩取較少者，再受倉位與現款限制。
 *  同一人同一旬第一次開出的貨與份量記在 G.rvLot，重開視窗不換；之後拜訪別的同業時再依當下的缺口重新挑。 */
function rivalLot(cid){
  const L=tradeComms();if(!L.length)return null;
  const S=(G.rvLot&&G.rvLot.t===G.turn)?G.rvLot:(G.rvLot={t:G.turn,m:{}});
  let o=S.m[cid];
  if(!o||!COMM_MAP[o.n]||!L.some(c=>c.name===o.n)){
    const O=ODDS.rivalLot,rd=seeded(cid+'_'+G.turn);
    const gaps=L.map(c=>({c,v:rivalGap(c.name)*rivalUnit(c.name)})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
    const c=gaps.length?gaps[0].c:L[Math.floor(rd()*L.length)];
    o=S.m[cid]={n:c.name,q0:O.qty[0]+Math.floor(rd()*(O.qty[1]-O.qty[0]+1)),cap:Math.round(O.cap[0]+rd()*(O.cap[1]-O.cap[0])),short:gaps.length>0};
  }
  const n=o.n,c=COMM_MAP[n],unit=rivalUnit(n);
  const q=Math.max(0,Math.min(o.q0,Math.floor(o.cap/unit),itemRoom(n),Math.floor(G.silver/unit)));
  return q>0?{c,n,q,unit,cost:Math.round(unit*q),short:o.short}:null;
}
/** 掮客銷貨：庫存單位數最多的本業貨（同量取基準價最高；只收有交易許可的必需品與一般品，奢侈品不收，第三百二十四節），以大盤市價七折賣出；最多 10 單位、金額最多約 400～500 兩（同一人同一旬固定），庫存不夠就全賣。不算出貨。 */
const BROKER_MAXQ=10;
function brokerLot(cid){
  const L=tradeComms().filter(c=>!c.luxury&&(G.inv[c.name]||0)>0);if(!L.length)return null;
  const c=L.slice().sort((a,b)=>(G.inv[b.name]-G.inv[a.name])||(b.base-a.base))[0],n=c.name,target=400+100*seeded(cid+'_b'+G.turn)();
  const unit=marketQuote(n)*(guildShunned()?ODDS.shun.broker:0.7),q=Math.max(1,Math.min(G.inv[n],BROKER_MAXQ,Math.floor(target/unit)));
  return {c,n,q,unit,rev:Math.round(unit*q)};
}
/** 座客商人／私梟／同業／掮客／經營好手的請託項目。 */
function dealerReqs(cid){
  const n=npc(cid);if(!n||!dealReady(cid))return [];
  if(n.role==='rival'){
    if(guildShunned())return [{k:'rv_off',info:true,name:UT('deal.rvOff'),desc:UT('deal.rvOff.d')}];   // 不在協議裡：同業不肯勻貨
    const L=rivalLot(cid);if(!L)return [];
    return [{k:'rv_'+L.n,name:UT('deal.dealerReqs',{a:L.c.short,b:L.q}),desc:(L.short?UT('deal.rvShort',{a:L.c.short}):'')+UT('deal.dealerReqs.2',{a:fmt(L.cost)})}];
  }
  if(n.role==='broker'){
    const out=[],L=brokerLot(cid),I=buyoutIntelNext();
    if(L)out.push({k:'bk_'+L.n,name:UT('deal.dealerReqs.3',{a:L.c.short,b:L.q}),desc:guildShunned()?shunLine(cid,'broker')+UT('deal.dealerReqs.4s',{a:fmt(L.rev)}):UT('deal.dealerReqs.4',{a:fmt(L.rev)})});
    if(I)out.push({k:'buyoutIntel',name:UT('deal.buyoutIntel'),desc:UT('deal.buyoutIntel.d',{region:REG_NAME(I.rid)})});
    return out;
  }
  if(n.role==='manager'){
    if(tempHelp()!==null)return [];
    return [{k:'tmp_help',name:UT('deal.dealerReqs.5'),desc:UT('deal.dealerReqs.6')}];
  }
  if(n.role==='guest'){
    return Object.keys(G.xinv||{}).filter(k=>G.xinv[k]>0).map(k=>{const q=G.xinv[k],Q=xsellQuote(cid,k,q);
      return {k:'xs_'+k,name:UT('deal.dealerReqs.7',{a:xName(k),b:q}),desc:(guildShunned()?shunLine(cid,'guest'):'')+UT('deal.dealerReqs.8',{a:fmt(Q.rev),b:Math.round(Q.m*100)})}});
  }
  if(n.role==='smuggler'){
    const out=[],bb=banditBribeReq();if(bb)out.push(bb);   // 賊亂期間：買通海賊／山賊（07zv_bandit.js）
    const ks=Object.keys(contra()).filter(k=>contra()[k]>0);
    if(ks.length&&!blackMarketOpen())return out.concat([{k:'cs_wait',info:true,name:UT('deal.csWait'),desc:UT('deal.csWait.d')}]);   // 黑貨只在節慶或災情當旬收
    return out.concat(ks.map(k=>{const q=contra()[k],i=SMUG_BY[k];
      return {k:'cs_'+k,name:UT('deal.dealerReqs.9',{a:i.name,b:q}),desc:UT('deal.dealerReqs.10',{a:smugMood(k),b:fmt(Math.round(smugPrice(k,q)*q)),c:fmt1(smugPrice(k,q))})}}));
  }
  return [];
}
/** 辦理商人請託，回傳結果訊息；不是商人請託回傳 null。 */
function dealerDo(cid,k){
  const r=R(cid),nm=nameOf(cid);
  if(k==='bribeBandit')return banditBribeDo(cid);
  if(k==='buyoutIntel'){
    const I=buyoutIntelNext();if(!I)return UT('deal.buyoutIntel.none');
    buyoutDiscover(I.y,I.rid,I.m);setAff(r,Math.max(0,r.aff-REQ_AFF.normal));r.dealT=G.turn;
    logRel(cid,UT('deal.buyoutIntel.log',{region:REG_NAME(I.rid),month:buyoutMonth(I.m,I.rid),aff:REQ_AFF.normal}));
    return UT('deal.buyoutIntel.ok',{name:nm,region:REG_NAME(I.rid),month:buyoutMonth(I.m,I.rid),aff:REQ_AFF.normal});
  }
  if(k==='cs_wait')return UT('deal.csWait.d');
  if(k.startsWith('cs_')&&!blackMarketOpen())return UT('deal.csWait.d');
  if(k.startsWith('rv_')){
    const L=rivalLot(cid);if(!L||L.n!==k.slice(3))return UT('deal.dealerDo');
    G.silver-=L.cost;addStock(L.n,L.q,L.unit);stockAdd(L.n,L.q,false);
    setAff(r,Math.max(0,r.aff-REQ_AFF.normal));r.dealT=G.turn;logRel(cid,UT('deal.dealerDo.2',{a:L.c.short,b:L.q,c:REQ_AFF.normal}));
    coinFx();return UT('deal.dealerDo.3',{a:nm,b:L.c.short,c:L.q,d:fmt(L.cost),e:REQ_AFF.normal});
  }
  if(k.startsWith('bk_')){
    const L=brokerLot(cid);if(!L||L.n!==k.slice(3))return UT('deal.dealerDo.4');
    stockTake(L.n,L.q,false);G.silver+=L.rev;
    setAff(r,Math.max(0,r.aff-REQ_AFF.normal));r.dealT=G.turn;logRel(cid,UT('deal.dealerDo.5',{a:L.c.short,b:L.q,c:REQ_AFF.normal}));
    coinFx();return (guildShunned()?shunLine(cid,'broker'):'')+UT('deal.dealerDo.6',{a:nm,b:L.c.short,c:L.q,d:fmt(L.rev),e:REQ_AFF.normal});
  }
  if(k==='tmp_help'){
    G.tempHelp={turn:G.turn,cs:CH(cid).derived_stats.commerce_skill,name:nm,cid};
    setAff(r,Math.max(0,r.aff-REQ_AFF.normal));r.dealT=G.turn;logRel(cid,UT('deal.dealerDo.7',{a:REQ_AFF.normal}));
    return UT('deal.dealerDo.8',{a:nm,b:REQ_AFF.normal});
  }
  if(k.startsWith('xs_')){
    const name=k.slice(3),q=(G.xinv||{})[name]||0;if(q<=0)return UT('deal.dealerDo.9');
    const Q=xsellQuote(cid,name,q,(rnd()-0.5)*0.16);
    G.silver+=Q.rev;delete G.xinv[name];addFame(0.1);
    setAff(r,Math.max(0,r.aff-REQ_AFF.normal));r.dealT=G.turn;logRel(cid,UT('deal.dealerDo.10',{a:xName(name),b:q,c:REQ_AFF.normal}));
    pushNews(NEWS('xsell.1',{introId:nm,short:xName(name),q,rev:fmt(Q.rev),m:Math.round(Q.m*100),d:REQ_AFF.normal}));
    coinFx();return (guildShunned()?shunLine(cid,'guest'):'')+UT('deal.dealerDo.11',{a:nm,b:xName(name),c:q,d:fmt(Q.rev),e:REQ_AFF.normal});
  }
  if(k.startsWith('cs_')){
    const key=k.slice(3),q=contra()[key]||0,it=SMUG_BY[key];if(q<=0)return UT('deal.dealerDo.12');
    const net=Math.round(smugPrice(key,q)*q);
    contra()[key]-=q;G.gold+=net;G.life.smuggled=(G.life.smuggled||0)+net;
    setAff(r,Math.max(0,r.aff-REQ_AFF.normal));r.dealT=G.turn;r.smugT=G.turn;logRel(cid,UT('deal.dealerDo.13',{a:it.name,b:q,c:REQ_AFF.normal}));
    coinFx();return UT('deal.dealerDo.14',{a:nm,b:it.name,c:q,d:fmt(net),e:REQ_AFF.normal});
  }
  return null;
}
/** 私梟是否在牢裡。 */
const jailed=n=>!!(n&&n.jailUntil&&n.jailUntil>G.turn);
/** 每旬：風聲偏緊時，近期替你脫手的私梟可能落網，並可能供出你。 */
function dealerTick(log){
  const A=ODDS.smugglerArrest,heat=G.heat||0;if(heat<=A.from)return;
  const p=Math.min(A.max,A.perHeat*(heat-A.from));
  Object.values(G.world.npcs).filter(n=>n.role==='smuggler'&&alive(n.cid)&&!jailed(n)&&G.rel[n.cid]&&G.rel[n.cid].smugT!==undefined&&G.turn-G.rel[n.cid].smugT<=A.window).forEach(n=>{
    if(!chance(p))return;
    const cid=n.cid,r=R(cid),nm=nameOf(cid);
    n.jailUntil=G.turn+A.jail;G.intros=G.intros.filter(i=>i.cid!==cid);if(G.introId===cid)G.introId=G.intros[0]?G.intros[0].cid:null;
    logRel(cid,UT('deal.dealerTick'));
    const loyal=CH(cid).derived_stats.integrity_loyalty,pc=clamp(confessP(loyal)*(1.2-r.aff/100),0,1);
    if(chance(pc)){const t=NEWS('smugglerArrest.talk',{n:nm});pushNews(t);log.push(t);doRaid('testimony',log)}
    else{const t=NEWS('smugglerArrest.silent',{n:nm});pushNews(t);log.push(t)}
  });
}

/* ═════ [07y_guild] ═════ */
'use strict';
/* ======================= 聯合採購與出貨協議的訂約金與違約金分配 =======================
 *  - 參加協議要付訂約金 1,000 兩（COSTS.guildBond）；開局即以守約立場參加，訂約金由開局贈送。
 *  - 參加協議者向大盤進貨享聯合採購價（市價九三折）；未參加者照市價（03_market.js 的 unitBuyCost）。
 *  - 自動續押：訂約金一直押在公會；一期＝兩次例會之間（3、6、9、12 月上旬），例會旬查完同業超賣之後，把上一期沒收的違約金平分給守約者（你＋上一期沒被抓的同業；meetingPayout，07yb_meeting.js）。例會旬旬報裡的查獲算上一期。
 *  - 你被查獲超量（evalCartel）或退出協議：訂約金作廢，立場回到未參加；要重新加入協議須在例會時再押一次。
 *  - 同業：每家每旬 5% 超賣一項本業貨（ODDS.rivalShip.overRival，rivalSupply 擲骰），查獲規則與你守約時相同；被抓者訂約金作廢、三旬內市佔下降。
 *  - 狀態：G.cartel.bond（押著的金額，0＝沒押）、pot（本期沒收的違約金）；同業的違約紀錄在 msOf(n).ovDec/ovItem/ovMul/caught。
 *  - 供給方針（維持／減供）由例會投票決定（07yb_meeting.js）；只有開局第一期各半抽選（newGame）。 */
/** 本期供給方針；缺值時視為「減供」。 */
const cartelPolicy=()=>G.cartel&&G.cartel.policy==='normal'?'normal':'restrict';
const guildPolicyName=()=>cartelPolicy()==='normal'?UT('guild.guildPolicyName'):UT('guild.guildPolicyName.2');
/** 是否已參加聯合採購與出貨協議（暗約已取消，第二百五十六節）。 */
const guildMember=()=>G.cartel.state==='pledged'||G.cartel.state==='secret';
/** 舊存檔補欄位：已參加協議而沒有訂約金紀錄的，視為已押。 */
function guildEnsure(){
  const C=G.cartel;
  if(C.policy!=='normal'&&C.policy!=='restrict')C.policy='restrict';
  if(C.bond===undefined){C.bond=guildMember()?costOf('guildBond'):0;C.pot=0}
}
/** 付訂約金加入協議（只在例會上辦）。 */
function guildJoin(){
  const C=G.cartel,amt=costOf('guildBond');
  spend('guildBond');
  C.bond=amt;                                       // 違約金與同業的被抓記號只在例會旬分配時清（meetingPayout），入會不清
}
/** 訂約金作廢（被查獲或退出協議）。 */
function guildForfeit(){const C=G.cartel,a=C.bond||0;C.bond=0;C.pot=0;return a}
/** 同業每旬的超賣決定（rivalSupply 在本業第一項貨時呼叫）：5% 機率挑一項本業貨超賣。回傳該貨的超賣倍數（沒超賣回傳 0）。 */
function rivalOverMul(r,c,first){
  if(first||r.raided)return 0;
  const n=npc(r.cid);if(!n)return 0;const m=msOf(n),R=ODDS.rivalShip;
  if(m.ovDec!==G.turn){m.ovDec=G.turn;m.ovItem=null;if(roll('rivalShip',R.overRival)){m.ovItem=pick(ownComms()).name;m.ovMul=R.mulMin+rnd()*(R.mulMax-R.mulMin)}}
  return m.ovItem===c.name?m.ovMul:0;
}
/** 違約查獲的公開紀錄：G.caughtLog[年]={cid 或 'me': 次數}，只留最近三年。0.8 公會長候選人看「去年度被查獲次數」。 */
function caughtAdd(key){
  const L=G.caughtLog||(G.caughtLog={}),y=String(G.year);L[y]=L[y]||{};L[y][key]=(L[y][key]||0)+1;
  Object.keys(L).forEach(k=>{if(+k<G.year-2)delete L[k]});
}
/** 某人某年被查獲的次數（key＝人物 cid，玩家為 'me'；year 預設去年）。 */
const caughtCount=(key,year)=>((G.caughtLog||{})[String(year===undefined?G.year-1:year)]||{})[key]||0;
/** 每旬（市場刷新之後）：查同業超賣、期滿分配違約金。 */
function guildTick(log){
  guildEnsure();
  const C=G.cartel,P=ODDS.cartelPledged,amt=costOf('guildBond');
  rivalsHere().forEach(n=>{
    const m=msOf(n);if(m.ovDec!==G.turn||!m.ovItem||m.caught)return;
    if(!chance(Math.min(P.max,P.base+P.slope*(m.ovMul-1))))return;
    m.caught=true;caughtAdd(n.cid);m.ev=Math.min(m.ev||1,0.7);m.evT=Math.max(m.evT||0,3);
    if(C.bond>0)C.pot=(C.pot||0)+amt;
    const t=NEWS('guild.rivalCaught',{n:nameOf(n.cid),item:COMM_MAP[m.ovItem].short});pushNews(t);log.push(t);
  });
  // 期滿分配違約金在 meetingPayout（07yb_meeting.js），advanceTurn 排在這之後
}
/** 公會面板上的訂約金卡。 */
function guildBondCard(){
  guildEnsure();const C=G.cartel;
  if(!guildMember()||!(C.bond>0))return UT('guild.guildBondCard',{a:fmt(costOf('guildBond'))});
  const left=turnsToMeeting(1,false)||0,k=Math.round((C.pot||0)/costOf('guildBond'));
  return UT('guild.guildBondCard.4',{a:fmt(C.bond),b:left,c:k?UT('guild.guildBondCard.2',{a:k}):UT('guild.guildBondCard.3')});
}

/* ---------- 同業死亡後補人（第一百四十六節） ----------
 *  本城同業病逝或遭暗殺而少一家時，旬末從外地挑一位你不認識的同業搬來，
 *  說法是「已故某某的私生子繼承家業」，姓名不改。市佔狀態（知名度、庫存水位、違約紀錄）與遭查抄狀態照原店，交情從零開始。
 *  外地找不到人時，從名冊裡尚未登場的同業抽。闕所除名的不補（闕所尚未實作）。 */
/** 遭暗殺的同業：刪除名冊前先記下原店的市佔狀態，旬末補人。 */
function noteRivalSlain(n){
  if(!n||n.role!=='rival'||n.cityId!==G.cityId)return;
  G.rivalHeirs=G.rivalHeirs||[];G.rivalHeirs.push({cid:n.cid,ms:n.ms?Object.assign({},n.ms):null,raided:!!n.raided});
}
/** 這個人你是否完全不認識（沒有交情、沒結識、不在筆記名冊、不是介紹人或店員、不是仇人）。 */
function strangerTo(cid){
  const r=G.rel[cid];
  return !G.known.includes(cid)&&!(r&&(r.met||r.bond||r.aff>0||r.seen))&&!introOf(cid)&&!G.emps.some(e=>e.cid===cid)&&!isEnemy(cid);
}
/** 旬末：本城過世的同業由外地陌生同業（或名冊新人）以私生子名義繼承。 */
function rivalHeirTick(log){
  const W=G.world.npcs,lost=(G.rivalHeirs||[]).slice();G.rivalHeirs=[];
  Object.values(W).forEach(n=>{if(n.role==='rival'&&n.cityId===G.cityId&&!n.heir&&!alive(n.cid))lost.push({cid:n.cid,ms:n.ms?Object.assign({},n.ms):null,raided:!!n.raided,npc:n})});
  lost.forEach(L=>{
    const far=Object.values(W).filter(m=>m.role==='rival'&&m.cityId!==G.cityId&&m.cityId&&!m.kessho&&alive(m.cid)&&strangerTo(m.cid));   // 闕所除名的人不會回來
    let h=far.length?pick(far):null;
    if(!h){
      const pool=CHARS.filter(c=>!W[c.id]&&hasRole(c,'rival')&&c.birth_year<=G.year-20&&c.death_year>G.year+2&&strangerTo(c.id));
      if(!pool.length){G.rivalHeirs.push(L);return}            // 一時找不到人：下一旬再補
      const c=pick(pool);h=W[c.id]={cid:c.id,cityId:G.cityId,role:'rival',pos:null};
    }
    h.cityId=G.cityId;h.raided=L.raided;
    if(L.ms)h.ms=Object.assign({},L.ms);else delete h.ms;
    if(L.npc)L.npc.heir=h.cid;
    const t=NEWS(isFemale(CH(h.cid))?'rival.heirF':'rival.heir',{old:nameOf(L.cid),name:nameOf(h.cid)});pushNews(t);log.push(t);
  });
}

/* ═════ [07yb_meeting] ═════ */
'use strict';
/* ======================= 問屋公會例會：公會長選舉、供給投票、菓子折拍賣 =======================
 *  - 例會固定在 3、6、9、12 月上旬（每季第一旬；02b_calendar.js 的 isMeetingTurn）；一期＝九旬；開局那一旬（3 月上旬）就是第一次例會。主畫面在例會旬出現整列按鈕，
 *    扣 1 行動、照常擲遇襲與路遇；整場例會只扣進場那 1 點。關掉視窗後可再按按鈕繼續，不再扣行動。
 *  - 流程：（3 月）公會長選舉 step 0（07yc_gm.js）→ ① 協議立場（加入、退出只能在這裡辦；公會長不能退出）→ ② 供給投票 → ③ 菓子折拍賣 → ④ 本期總結。
 *  - 決議當旬生效：投票後立即以新方針重算本旬同業供給。沒出席（或沒走完）時，推進那一旬、出貨之前自動決議：
 *    同業各自 60% 投減供；你沒有票、不能出價。
 *  - 投票：只有參加協議的會員；你一票；你出席時每位同業跟你投一樣的機率＝80%×好感÷100，否則投另一方。平手由公會長裁決（你在場自己選、你缺席維持上期、同業公會長一律減供；沒有公會長維持上期）。
 *  - 菓子折：名義上是大盤答謝公會的點心禮，盒底那層是給誰的人人都知道。每期一批：一項本業貨（越貴越容易被挑中），
 *    照當旬市價約值 8,000～12,000 兩，6,000 兩起標；封閉出價、價高者得、付自己出的價；得標金歸公會長（公會長不出價；你當公會長時要向御金奉行報告）。
 *  - 狀態：G.guild＝{mt 本期例會旬, att 已進場, step, voted, myVote, tally, lot:{name,qty,val}, bid, res:{who,price}, done}。 */
const MEET=ODDS.meeting;
/** 本旬的例會資料（不是例會旬或還沒建立時回傳 null）。 */
const meetNow=()=>G&&G.guild&&G.guild.mt===G.turn?G.guild:null;
const meetPending=()=>{const M=meetNow();return !!(M&&!M.done)};
/** 菓子折的拍品：從本業較貴的一半貨品中，依基準價加權抽一項，份量照當旬市價約值 8,000～12,000 兩。 */
function meetLot(){
  const all=ownComms().slice().sort((a,b)=>b.base-a.base),L=all.slice(0,Math.ceil(all.length/2));const tot=L.reduce((a,c)=>a+c.base,0);let r=rnd()*tot,c=L[0];   // 只從本業較貴的一半貨品裡抽（數量多的便宜貨不入選）
  for(const x of L){r-=x.base;if(r<=0){c=x;break}}
  const p=Math.max(0.1,marketQuote(c.name)||c.base),val=rint(MEET.lotMin,MEET.lotMax),qty=Math.max(1,Math.round(val/p));
  return {name:c.name,qty,val:Math.round(qty*p)};
}
/** 建立本旬的例會。 */
function newMeeting(){
  G.guild={mt:G.turn,att:false,step:1,voted:false,myVote:null,tally:null,lot:meetLot(),bid:MEET.start,res:null,done:false,prev:cartelPolicy()};
  if(G.month===3){const E=gmElectSetup();if(E){G.guild.el=E;G.guild.step=0}}   // 3 月例會先選公會長（07yc_gm.js）
}
/** 舊存檔或讀檔時正好是例會旬而還沒有例會資料：補建（不分配違約金）。 */
function meetEnsure(){if(G&&isMeetingTurn()&&!(G.guild&&G.guild.mt===G.turn))newMeeting()}
/** 例會旬開始（日期前進後）：建立本期例會；例會前一旬提醒。上一期違約金的分配改在 meetingPayout（guildTick 之後）。 */
function meetingTick(log){
  const C=G.cartel;guildEnsure();
  if(isMeetingTurn()){
    gmPeriodEnd(log);                              // 公會長：本期沒向御金奉行報告就罰款（07yc_gm.js）
    newMeeting();
    const t=NEWS('meet.today');pushNews(t);log.push(t);
  }else{const d=dateAfter(1);if(isMeetingDate(d.month,d.cycle)){const t=NEWS('meet.soon');pushNews(t);log.push(t)}}
}
/** 例會旬：上一期期滿，大盤把作廢的訂約金交給公會，平分給守約者（你＋上一期沒被抓的同業）。
 *  排在 guildTick 之後：例會旬旬報裡查獲的超賣是上一旬的事，算上一期，當旬一起分（DESIGN_NOTES 第二百四十五節）。分完才清空，新的一期從 0 起算。 */
function meetingPayout(log){
  if(!isMeetingTurn())return;
  const C=G.cartel;guildEnsure();
  if(C.bond>0){
    const rv=rivalsHere(),ok=rv.filter(n=>!msOf(n).caught).length+1,pot=C.pot||0,amt=costOf('guildBond');
    if(pot>0){const sh=Math.round(pot/ok);G.silver+=sh;if(TURNRP)TURNRP.guildDiv=(TURNRP.guildDiv||0)+sh;const t=NEWS('guild.div',{k:Math.round(pot/amt),n:ok,sh:fmt(sh)});pushNews(t);log.push(t);sfx.coin()}
  }
  C.pot=0;rivalsHere().forEach(n=>{msOf(n).caught=false});
}
/** 新方針立即生效：重算本旬本業貨的同業供給與市價。 */
function meetResupply(){ownComms().forEach(c=>{const m=G.mk[c.name];m.so=rivalSupply(c,m,false)});syncPrices()}
/** 簡易模式開局第一年的例會：同業一律投維持（第二百八十四節；ODDS.guildPolicy.easyYear1）。 */
const meetEasyYear=()=>diffNow()==='easy'&&G.year===0&&!!ODDS.guildPolicy.easyYear1;
/** 供給投票。me＝你的票（'normal'／'restrict'；沒有票時 null）。回傳 {n,r,me,policy,tie}。 */
function meetVote(me){
  const M=meetNow();if(!M||M.voted)return M&&M.tally;
  let n=0,r=0;const cast=v=>{if(v==='normal')n++;else r++};
  if(me)cast(me);
  rivalsHere().forEach(x=>{
    if(isBekke(x)){if(G.bekke.inG)cast(meetEasyYear()?'normal':G.bekke.vote||(chance(MEET.restrictP)?'restrict':'normal'));return}   // 別家：在協議裡才有票，照你的意思投（07zzzzz_bekke）
    if(meetEasyYear()){cast('normal');return}
    if(me){const p=Math.min(MEET.followMax,MEET.followMax*R(x.cid).aff/100);cast(chance(p)?me:(me==='normal'?'restrict':'normal'))}
    else cast(chance(MEET.restrictP)?'restrict':'normal');
  });
  const tie=n===r,g=gmCid();
  if(tie&&g==='me'&&me){M.tieAsk={n,r,me};return null}   // 平手：你是公會長又在場，由你裁決（ACT.gmTie）
  const pol=!tie?(n>r?'normal':'restrict'):g&&g!=='me'?'restrict':M.prev;   // 同業公會長一律減供；你缺席或沒有公會長時維持上期
  return meetVoteFinal(n,r,me,pol,tie);
}
/** 投票定案。 */
function meetVoteFinal(n,r,me,pol,tie){
  const M=meetNow();M.tieAsk=null;
  const C=G.cartel,changed=pol!==cartelPolicy();C.policy=pol;if(changed){const S=G.sold||{},P={};Object.keys(S).forEach(k=>{if(S[k])P[k]=0});G.plan=P}   // 方針改了，出貨預設改照新配額；本旬已按過「出貨」的貨維持 0，推進時不再自動出一次
  M.voted=true;M.myVote=me||null;M.tally={n,r,me:me||null,policy:pol,tie,gm:tie?gmCid():null};
  meetResupply();
  return M.tally;
}
ACT.gmTie=el=>{const M=meetNow();if(!M||M.voted||!M.tieAsk)return;const T=M.tieAsk;meetVoteFinal(T.n,T.r,T.me,el.dataset.v==='normal'?'normal':'restrict',true);sfx.step();refreshSheet();UI.render()};
/** 你能不能標菓子折：回傳不能的原因（可以時回傳空字串）。 */
function meetBidBlock(){
  const M=meetNow();if(!M)return UT('gmeet.meetBidBlock');
  if(!M.att)return UT('gmeet.meetBidBlock.2');
  if(gmIsMe())return UT('gm.noBid');
  if(!guildMember())return UT('gmeet.meetBidBlock.3');
  if(!tradeOK(M.lot.name))return UT('gmeet.meetBidBlock.4');
  if(G.silver<MEET.start)return UT('gmeet.meetBidBlock.5',{a:fmt(MEET.start)});
  if(invCap()-invUsed()-pendingQty()<M.lot.qty)return UT('gmeet.meetBidBlock.6');
  return '';
}
/** 同業的封閉出價（不出價回傳 0）。 */
function rivalBid(n,lot){
  if(chance(MEET.skipP))return 0;
  const st=CH(n.cid).derived_stats,c=COMM_MAP[lot.name],u=rnd();
  let f=u<0.8?0.7+rnd()*0.2:u<0.9?0.6+rnd()*0.1:0.9+rnd()*0.1;
  f+=(st.audacity_courage-50)/1000-(st.greed_index-50)/1000;           // 膽識高往上、貪欲高往下（各約 ±5%）
  const sh=(G.share&&G.share.rows||[]).find(x=>x.cid===n.cid);if(sh)f+=(sh.share||0)*0.1;   // 大同業略提高
  if(c.decay>0.01)f-=0.05;                                              // 易腐貨略保守
  f+=(rnd()-0.5)*0.04;
  const b=Math.round(lot.val*clamp(f,0.5,1.05)/100)*100;
  return b>=MEET.start?b:0;
}
/** 開標。myBid＝你的出價（不出價 0）。得標金歸公會長（gmLotPaid）。 */
function meetAuction(myBid){
  const M=meetNow();if(!M||M.res)return M&&M.res;
  const lot=M.lot,bids=rivalsHere().filter(n=>n.cid!==gmCid()&&!isBekke(n)).map(n=>({cid:n.cid,b:rivalBid(n,lot),sh:((G.share&&G.share.rows||[]).find(x=>x.cid===n.cid)||{}).share||0})).filter(x=>x.b>0);
  M.bids={};bids.forEach(x=>{M.bids[x.cid]=x.b});
  bids.sort((a,b)=>b.b-a.b||b.sh-a.sh);
  const top=bids[0];let res;
  if(myBid>0&&(!top||myBid>top.b)){
    G.silver-=myBid;addStock(lot.name,lot.qty,myBid/lot.qty);stockAdd(lot.name,lot.qty,false);notePublicSpend('spend.lot|'+lot.name,myBid);   // 得標價計入均價；記入主動支出（原本誤併進註解）
    res={who:'me',price:myBid};sfx.fanfare();
  }else if(top)res={who:top.cid,price:top.b};
  else res={who:null,price:0};
  M.res=res;M.myBid=myBid||0;
  gmLotPaid(M,res);                                // 你是公會長：得標金進你的現款，待向御金奉行報告（07yc_gm.js）
  const t=res.who==='me'?NEWS('meet.lotMe',{n:COMM_MAP[lot.name].short,q:lot.qty,p:fmt(res.price)}):res.who?NEWS('meet.lotRival',{who:nameOf(res.who),n:COMM_MAP[lot.name].short,q:lot.qty,p:fmt(res.price)}):NEWS('meet.lotNone',{n:COMM_MAP[lot.name].short});
  pushNews(t);M.lotNews=t;
  return res;
}
/** 推進一旬、出貨之前：本旬例會若還沒走完，照規則自動決議（你沒有票、不能出價）。 */
function meetingAuto(log){
  const M=meetNow();if(!M||M.done)return;
  urgeAuto(M,log);                                 // 官府督促：你是公會長卻沒處理＝推託（07zzq_urge.js）
  if(M.el&&!M.el.done)gmElectAuto(M);              // 公會長選舉（07yc_gm.js）
  if(!M.voted){const T=meetVote(null);const t=NEWS('meet.autoVote',{p:policyName(T.policy),n:T.n,r:T.r,tie:T.tie?UT('gmeet.t'):''});pushNews(t);log.push(t)}
  if(!M.res){meetAuction(0);if(M.lotNews)log.push(M.lotNews)}
  gmAutoRemind(M);
  M.done=true;
}
const policyName=p=>p==='normal'?UT('gmeet.policyName'):UT('gmeet.policyName.2');
/** 例會上同業的發言：每一步隨機 1～3 人（仇人也會出場說冷話），存在本次例會裡，關掉視窗再回來不重抽；同一場不重複台詞。
 *  台詞只是氣氛（會上講話真真假假）：拉票的主張、對菓子折的意向都只用來挑台詞，和他實際怎麼投、怎麼出價無關；散會道別依已發生的結果挑。 */
function meetTalk(step){
  const M=meetNow();if(!M)return [];M.talk=M.talk||{};if(M.talk[step])return M.talk[step];
  const used=M.usedLines||(M.usedLines=[]);
  const say=(path,vars)=>{const L=Ls(path).filter(x=>!used.includes(x)),pool=L.length?L:Ls(path),t=pool[Math.floor(rnd()*pool.length)];used.push(t);
    return String(t).replace(/\{(\w+)\}/g,(m,k)=>vars&&vars[k]!==undefined?vars[k]:m)};
  const rv=shuffle(rivalsHere().slice()).slice(0,rint(1,3)),item=COMM_MAP[M.lot.name].short,me=UT('gmeet.me',{a:G.me.family});
  const out=rv.map(n=>{
    const cid=n.cid,foe=isEnemy(cid),r=R(cid),v={me,item};let t;
    if(step<=1){t=foe?say('meet.greet.enemy',v):G.month===3&&chance(0.5)?say('meet.greet.spring',v):say('meet.greet.'+(r.bond&&r.aff>=60?'warm':r.bond&&r.aff<20?'cold':'plain'),v)}
    else if(step===2){const st=!meetEasyYear()&&chance(MEET.restrictP)?'restrict':'normal';t=say('meet.stance.'+(foe?(st==='normal'?'enemyNormal':'enemyRestrict'):st),v)}
    else if(step===3){const u=rnd(),k=u<0.35?'high':u<0.65?'none':'chat';t=say('meet.lot.'+(foe?'enemy'+k[0].toUpperCase()+k.slice(1):k),v)}
    else{
      const res=M.res||{},T=M.tally||{},bid=(M.bids||{})[cid]||0;v.p=policyName(T.policy);
      t=res.who===cid?say('meet.bye.win',v):foe?say('meet.bye.enemy',v):bid>0?say('meet.bye.lose',v):res.who==='me'&&chance(0.6)?say('meet.bye.meWin',v):T.policy!==M.prev&&chance(0.5)?say('meet.bye.changed',v):say('meet.bye.plain',v);
    }
    return {cid,t,foe};
  });
  M.talk[step]=out;return out;
}
/** 發言小卡（照吉原設宴：頭像、姓名、一句話）。 */
function meetTalkHtml(step){
  return meetTalk(step).map(x=>'<div class="card" style="display:flow-root;margin:3px 0">'+portraitHtml(x.cid,40)+'<b>'+esc(nameOf(x.cid))+'</b> <span class="tag '+(x.foe?'red':'gray')+'">'+(x.foe?UT('gmeet.meetTalkHtml'):UT('gmeet.meetTalkHtml.2'))+'</span><div class="small" style="margin-top:3px">'+esc(x.t)+'</div></div>').join('');
}

/* ---------- 畫面 ---------- */
/** 主畫面的例會按鈕列（不是例會旬時不顯示）。 */
function meetHomeHtml(){
  const M=meetNow();if(!M)return '';
  if(M.done)return UT('gmeet.meetHomeHtml',{a:policyName(cartelPolicy())})+'</div></button>';
  return UT('gmeet.meetHomeHtml.4',{a:M.att?UT('gmeet.meetHomeHtml.2'):UT('gmeet.meetHomeHtml.3')})+'</div></button>';
}
ACT.meetGo=()=>{
  const M=meetNow();if(!M||M.done)return;
  if(M.att){UI.openSheet('guild');return}
  if(apLeft()<=0){toast(MSG('go.2'));return}
  if(injuredBlock())return;
  const amb=rollAmbush();if(amb&&amb.abort)return;
  const enc=amb?null:rollEncounter();
  const go=()=>{if(!spendAP())return;M.att=true;G.cartel.paid=true;goTo('guild')};
  if(enc){showEncounter(enc,go);return}
  go();
};
/** 大盤頁的「公會與協議」卡片（只能查看，不扣行動）。 */
function guildInfoCard(){
  const C=G.cartel,M=meetNow();
  const st=C.state==='pledged'?UT('gmeet.st'):C.state==='secret'?UT('gmeet.st.2'):UT('gmeet.st.3');
  let next;if(M&&!M.done)next=UT('gmeet.guildInfoCard');else{const k=turnsToMeeting(1,false);next=UT('gmeet.guildInfoCard.2',{a:dateLabel(dateAfter(k)),b:k})}
  return UT('gmeet.guildInfoCard.5',{a:policyName(cartelPolicy())})+'</b></div>'+UT('gmeet.guildInfoCard.6',{a:st})+'</b></div>'+UT('gmeet.guildInfoCard.7',{a:guildMember()&&C.bond>0?UT('gmeet.guildInfoCard.3',{a:fmt(C.bond)}):'—'})+'</b></div>'+UT('gmeet.guildInfoCard.8',{a:rivalsHere().length,b:next})+'</b></div>'+UT('gmeet.guildInfoCard.9',{a:C.sanction>0?UT('gmeet.guildInfoCard.4',{a:C.sanction}):''});
}
/** 例會視窗：一步一步進行。 */
SHEETS.guild=()=>{
  guildEnsure();
  const M=meetNow(),C=G.cartel;
  if(!M||!M.att)return {title:UT('gmeet.guild'),html:UT('gmeet.guild.2')};
  const steps=(M.el?[UT('gm.step')]:[]).concat([UT('gmeet.steps'),UT('gmeet.steps.2'),UT('gmeet.steps.3'),UT('gmeet.steps.4')]),cur=M.step,o=M.el?0:1;   // 3 月多一步「改選」
  let h='<div class="chevs">'+steps.map((s,i)=>'<span class="chev '+(cur===i+o?'on':cur>i+o?'done':'todo')+(i===0?' first':'')+'"'+(s.length>4?' style="flex-grow:1.3"':'')+'><i>'+s+'</i></span>').join('')+'</div>';   // 箭頭串接的步驟列（style.css .chevs）
  let info='',act='';                              // 每一步三層：說明 → 同業發言 → 決策按鈕
  if(cur===0&&M.el){const X=gmElectHtml(M);info=X.info;act=X.act}
  else if(cur===1){
    const st=C.state==='pledged'?UT('gmeet.st.4'):C.state==='secret'?UT('gmeet.st.5'):UT('gmeet.st.6');
    const mem=guildMember()&&C.bond>0,bc=costBtn('guildBond');   // 暗約已取消（第二百五十六節）
    info=UT('gmeet.guild.3',{a:rivalsHere().length+1,b:st})+'</div>'+guildBondCard()+'</div>';
    act='<button class="pixel-btn btn-green" style="width:100%" data-act="cartel" data-s="pledged" '+(C.state==='pledged'?'disabled':'')+'>'+(mem?UT('btn.cartel'):UT('btn.cartelJoin',{c:bc}))+'</button>'+(gmIsMe()?UT('gm.noQuitNote'):UI.s.quitArm&&C.state!=='none'?'<div class="grid2" style="margin-top:4px"><button class="pixel-btn btn-red" data-act="cartel" data-s="none">'+UT('btn.cartel3Confirm',{c:fmt(C.bond||0)})+'</button><button class="pixel-btn" data-act="cartelQuitCancel">'+UT('btn.cartel3Cancel')+'</button></div>':'<button class="pixel-btn" style="width:100%;margin-top:4px" data-act="cartel" data-s="none" '+(C.state==='none'?'disabled':'')+'>'+(mem?UT('btn.cartel3Lose'):UT('btn.cartel3'))+'</button>')+UT('gmeet.guild.4');
  }else if(cur===2){
    info=guildMember()?UT('gmeet.guild.5',{b:policyName(M.prev),r:UT('diff.ratio.'+diffNow())})
      :UT('gmeet.guild.6');
    if(!M.voted&&M.tieAsk)act=UT('gm.tieAsk',{n:M.tieAsk.n,r:M.tieAsk.r});
    else if(!M.voted)act=guildMember()?UT('gmeet.guild.7')
      :UT('gmeet.guild.8');
    else{
      const T=M.tally;
      act=UT('gmeet.guild.11',{a:T.n,b:T.r,c:policyName(T.policy)})+'</b>'+(T.tie?(T.gm==='me'?UT('gm.tieMe'):T.gm?UT('gm.tieRival',{n:esc(gmName(T.gm))}):UT('gmeet.guild.9')):'')+(T.me?UT('gmeet.guild.10',{a:policyName(T.me)}):'')+'</div></div>'+UT('gmeet.guild.12');
    }
  }else if(cur===3){
    const L=M.lot,c=COMM_MAP[L.name];
    info=UT('gmeet.guild.13',{a:esc(c.short),b:L.qty,c:fmt(MEET.start)});
    if(!M.res){
      const why=meetBidBlock();
      if(why)act='<div class="notice tiny">'+UT('gmeet.guild.14',{a:esc(why)});
      else{
        const mx=Math.max(MEET.start,Math.floor(G.silver/MEET.step)*MEET.step);M.bid=clamp(M.bid||MEET.start,MEET.start,mx);
        act=UT('gmeet.guild.15',{a:fmt(M.bid),u:meetUnitTxt(M),b:stepRow('<input type="range" id="slider-meet" min="'+MEET.start+'" max="'+mx+'" step="'+MEET.step+'" value="'+M.bid+'">','slider-meet',M.bid<=MEET.start,M.bid>=mx)});
      }
    }else{
      const r=M.res;
      act=UT('gmeet.guild.20',{a:r.who==='me'?UT('gmeet.guild.16',{a:fmt(r.price)}):r.who?UT('gmeet.guild.17',{a:esc(nameOf(r.who)),b:fmt(r.price)}):UT('gmeet.guild.18')})+'</div>'+UT('gmeet.guild.21',{a:M.myBid&&r.who!=='me'?UT('gmeet.guild.19',{a:fmt(M.myBid)}):''});
    }
  }else{
    const T=M.tally,r=M.res,own=tradeComms();
    info=UT('gmeet.guild.25',{a:policyName(T.policy)})+'</b></div>'+UT('gmeet.guild.26',{a:r.who==='me'?UT('gmeet.guild.22',{a:fmt(r.price)}):r.who?UT('gmeet.guild.23',{a:esc(nameOf(r.who))}):UT('gmeet.guild.24')})+'</b></div>'+UT('gmeet.guild.27',{a:C.state==='pledged'?UT('gmeet.st'):C.state==='secret'?UT('gmeet.st.2'):UT('gmeet.st.3')})+'</b></div></div>';
    if(guildMember())info+=UT('gmeet.guild.29',{a:own.map(c=>'<div class="row tiny" style="margin-top:2px"><span>'+esc(c.short)+'</span><b>'+UT('gmeet.guild.28',{a:quotaOf(c.name)})).join('')})+'</div>';
    act=UT('gmeet.guild.30');
  }
  h+=urgeMeetCard(M)+info+meetTalkHtml(cur)+act;   // 官府督促（07zzq_urge.js，第二百五十六節）
  return {title:UT('gmeet.guild.31'),html:h};
};
ACT.meetStep=()=>{const M=meetNow();if(!M)return;UI.s.quitArm=false;M.step=Math.min(4,M.step+1);refreshSheet();UI.render()};
ACT.meetVote=el=>{const M=meetNow();if(!M||M.voted)return;const v=el.dataset.v||null;meetVote(guildMember()?v:null);sfx.step();refreshSheet();UI.render()};
ACT.meetBid=el=>{const M=meetNow();if(!M||M.res)return;const b=el.dataset.b==='1'&&!meetBidBlock()?M.bid:0;meetAuction(b);refreshSheet();UI.render()};
ACT.meetEnd=()=>{const M=meetNow();if(!M)return;M.done=true;UI.closeSheet();UI.render()};
document.addEventListener('input',e=>{if(e.target&&e.target.id==='slider-meet'){const M=meetNow();if(!M)return;M.bid=+e.target.value;const b=document.getElementById('meet-b');if(b)b.textContent=UT('gmeet.guildInfoCard.3',{a:fmt(M.bid)});const u=document.getElementById('meet-u');if(u)u.textContent=meetUnitTxt(M)}});
/** 菓子折：本旬牌價與出價換算的每單位價格（約牌價幾成）。 */
function meetUnitTxt(M){
  const L=M.lot,q=marketQuote(L.name),per=(M.bid||0)/Math.max(1,L.qty);
  return UT('gmeet.unit',{q:fmt1(q),b:fmt1(per),r:q>0?(Math.round(per/q*100)/10):0});
}
/** 退出協議的二次確認：取消。 */
ACT.cartelQuitCancel=()=>{UI.s.quitArm=false;refreshSheet()};

/* ═════ [07yc_gm] ═════ */
'use strict';
/* =====================================================================
 * 07yc_gm.js — 問屋公會長（0.7.3；DESIGN_NOTES 第二十九節公會長段、第 188、197～202 節）
 *  - 選舉：每年 3 月例會的第一步（選完才進協議立場）。本城同業（含你）都能參選、投票，不看有沒有參加協議。
 *    候選人：去年被查獲違約次數最少的兩人（你去年任何一期不在協議內，視同多一次），同樣少看市佔；開局那一年直接看市佔。
 *    只剩一位直接當選，一位都沒有由現任續任。大盤依賴度制裁期間你不能參選（dapanSanctioned，尚未實作時一律為否）。
 *  - 你是候選人：其餘同業每人一場拉票的拜訪戰鬥（仇人不見你，直接投對方）；打穿投你，沒打穿投對方。沒出席時市佔較高者當選。
 *    你不是候選人：兩位候選人先後上門塞錢（私房錢，照名望階的中檔禮金上下一成，可推辭）；開會時投一位（好感 +5／−5）或棄權。
 *    同業投票人：比較與兩位候選人的性向相容，投較高者；相同投市佔較高者。開票平手：現任連任，否則市佔較高者。
 *  - 當選：一定在協議內（不在就自動加入、照付訂約金，現款可扣成負數）；你當選時知名度 +5、結識的同業好感 +3，任內每旬 +0.1，名望視同四階。
 *  - 任內：供給投票平手由公會長裁決（你在場自己選；你缺席維持上期；同業公會長一律減供）；公會長不能退出協議、不參加菓子折競標。
 *    你當公會長時，菓子折得標金進你的現款，要分三份送進去：本期內趁三系六階（城代家老、御金奉行、御目付）各自來城的那個月，
 *    一一前去報告（必須打穿，或打滿三回合且至少猜中一次；第二百七十節）。每少報告一位（含中途告辭、被嫌不善言辭）罰得標金四成，
 *    那位官員空缺或在牢裡時那一份免罰。散會時提醒一次，每位來城那個月上旬還沒報告再各提醒一次。
 *  - 下台：你被查獲違約即下台（知名度另扣 10，沒報告的得標金當場罰）；同業公會長過世或離城；都由上次選舉的另一位候選人接任。
 *    同業公會長任內不超賣。
 *  - 任內事件（只在你當公會長時）：每期例會後第二個月上旬約五成，同業糾紛仲裁或御用金攤派擇一。
 *  狀態：G.gm={cid:'me'|cid,other,year}、G.gmDue={amt,mt,done,shown,parts:{三系:{done,ok,exempt}}}（done＝三份都了結）、G.gmOut{年:true}、G.gmEvT、G.gmArb、G.gmLevy；
 *        本次選舉在例會資料 M.el。數值 ODDS.gm；文字 gm.*（01e、01f、01g）、LINES.gm（01d）。
 * ===================================================================== */
const GM_LOG=[];                                   // 旬中發生、要寫進旬報的公會長消息（gmTick 時併入）
const gmCid=()=>G&&G.gm?G.gm.cid:null;
const gmIsMe=()=>gmCid()==='me';
const gmName=k=>k==='me'?UT('gmeet.me',{a:G.me.family}):nameOf(k);
/** 公會事務上見過面：還沒往來的就記上交情（label＝交情來歷文字鍵）。 */
function gmMeet(cid,label){const r=R(cid);if(!r.bond){r.bond={mult:1,label:UT(label),introId:null};r.met=true;r.seen=true;addKnown(cid)}return r}
/** 市佔率（'me' 或同業 cid）。 */
function gmShare(k){const S=G.share||(G.share=marketShares());return k==='me'?(S.me||0):(((S.rows||[]).find(r=>r.cid===k)||{}).share||0)}
/** 本城某系的六階官員（在世、不在牢裡）；預設財務（御金奉行）。 */
const gmOfficial=(court)=>Object.values(G.world.npcs).find(n=>n.pos&&n.pos.court===(court||'finance')&&n.pos.rank===6&&n.cityId===G.cityId&&alive(n.cid)&&!jailed(n))||null;
/** 菓子折要報告的三系（報告順序照本期來城的先後排）。 */
const GM_COURTS=['administration','finance','judiciary'];
/** 待報告得標金的三份；舊存檔（只有御金奉行一份）補成只剩財務一份。 */
function gmParts(D){
  if(!D)return null;
  if(!D.parts){D.parts={};GM_COURTS.forEach(k=>D.parts[k]={done:k!=='finance'||!!D.done,ok:k!=='finance',exempt:k==='finance'?!!D.exempt:false,old:true})}
  return D.parts;
}
const gmPartsLeft=D=>{const P=gmParts(D);return P?GM_COURTS.filter(k=>!P[k].done):[]};
/** 某系六階在本期的哪個月來城（例會月起算三個月內）。 */
function gmCourtMonth(court,mt){const ms=3+3*Math.floor(((G.month-3+12)%12)/3);/* 本期的例會月 */for(let i=0;i<3;i++){const m=(ms-1+i)%12+1;if(((m-TOUR_MONTH[court])%3+3)%3===0)return m}return ms}
/** 三份都了結時標記整筆完成。 */
function gmDueSync(D){if(D&&!gmPartsLeft(D).length)D.done=true}
/** 你在大盤依賴度制裁中（第一百八十六節，尚未實作時一律為否）。 */
const gmBarred=()=>typeof dapanSanctioned==='function'&&!!dapanSanctioned();
/** 候選資格的分數：去年被查獲次數；你去年任何一期不在協議內，多算一次。 */
const gmScore=k=>caughtCount(k)+(k==='me'&&(G.gmOut||{})[String(G.year-1)]?1:0);
/** 可參選的人。 */
function gmPool(){
  const L=rivalsHere().filter(n=>alive(n.cid)&&!jailed(n)).map(n=>n.cid);
  if(!gmBarred())L.push('me');
  return L;
}
/** 名望階換算的候選人禮金：同階清官的丁稚代送中檔禮金，上下一成。 */
const gmBribeAmt=()=>{const t=clamp(fameTier(),1,6),b=BT_HP[t-1]*0.5;return Math.max(1,Math.round(b*(1-ODDS.gm.bribeVar+rnd()*2*ODDS.gm.bribeVar)))};
/** 建立本次選舉（3 月例會 newMeeting 時呼叫）。回傳 null＝沒有人可選，現任續任。 */
function gmElectSetup(){
  const pool=gmPool();if(!pool.length)return null;
  const sh=gmShare,first=G.year===0;
  const c=pool.slice().sort(first?((a,b)=>sh(b)-sh(a)):((a,b)=>gmScore(a)-gmScore(b)||sh(b)-sh(a))).slice(0,2);
  const E={cands:c,votes:{},done:false,winner:null,idx:0,bribe:{},first,myVote:null};
  E.voters=rivalsHere().filter(n=>alive(n.cid)&&!c.includes(n.cid)).map(n=>n.cid);
  if(c.length===1){E.single=true;if(c[0]!=='me')gmElectFinish(E,c[0]);return E}   // 只剩你一位：要到會才當選（第二百七十七節）
  if(!c.includes('me'))c.forEach(k=>{if(isEnemy(k))return;E.bribe[k]={amt:gmBribeAmt(),st:null};queueFaceEvent({type:'gmBribe',cid:k,turn:G.turn})});   // 仇人不來
  return E;
}
/** 同業投票人投給誰：性向相容較高者；相同投市佔較高者。 */
function gmRivalPick(v,A,B){
  const ma=compat(v,A).matches,mb=compat(v,B).matches;
  return ma!==mb?(ma>mb?A:B):(gmShare(A)>=gmShare(B)?A:B);
}
/** 開票：平手時現任連任，現任不在兩人之中看市佔。 */
function gmTally(E){
  const [A,B]=E.cands,cnt={};cnt[A]=0;cnt[B]=0;
  Object.values(E.votes).forEach(k=>{if(cnt[k]!==undefined)cnt[k]++});
  E.count=cnt;E.tie=cnt[A]===cnt[B];
  const inc=gmCid(),w=!E.tie?(cnt[A]>cnt[B]?A:B):(E.cands.includes(inc)?inc:(gmShare(A)>=gmShare(B)?A:B));
  gmElectFinish(E,w);
}
/** 選舉結束：就任並寫消息。 */
function gmElectFinish(E,w){
  E.done=true;E.winner=w;
  const other=E.cands.find(k=>k!==w)||null;
  const t=gmInstall(w,other,true);pushNews(t);GM_LOG.push(t);
}
/** 就任（elect＝選上；false＝接任）。回傳消息。 */
function gmInstall(k,other,elect){
  G.gm={cid:k,other:other||null,year:G.year};
  let join='';
  if(k==='me'){
    if(elect){addFame(ODDS.gm.fameWin,'major');rivalsHere().forEach(n=>{const r=G.rel[n.cid];if(r&&r.bond)setAff(r,clamp(r.aff+ODDS.gm.rivalAff,0,100))})}
    if(!guildMember()){const C=G.cartel,amt=costOf('guildBond');payPublic('cost:guildBond',amt);C.state='pledged';C.bond=amt;join=NEWS('gm.join',{a:fmt(amt)})}   // 當選者一定在協議內
    sfx.fanfare();
  }
  return NEWS(elect?'gm.elected':'gm.succeed',{n:gmName(k)})+join;
}
/** 接任：上次選舉的另一位候選人；不行時由市佔最高的同業（不含 excl）。 */
function gmSucceed(excl){
  const o=G.gm&&G.gm.other;let k=null;
  if(o==='me'&&excl!=='me'&&!G.ended)k='me';
  else if(o&&o!=='me'&&o!==excl){const n=npc(o);if(n&&alive(o)&&n.cityId===G.cityId&&n.role==='rival'&&!jailed(n))k=o}
  if(!k){const L=rivalsHere().filter(n=>alive(n.cid)&&n.cid!==excl&&!jailed(n)).sort((a,b)=>gmShare(b.cid)-gmShare(a.cid));k=L.length?L[0].cid:null}
  if(!k){G.gm=null;return ''}
  return gmInstall(k,null,false);
}
/** 你下台（被查獲違約）：知名度另扣，沒報告的得標金當場罰，由另一位候選人接任。 */
function gmFall(){
  if(!gmIsMe())return;
  loseFame('gmFall');
  let t=NEWS('gm.fall');
  const fine=gmFineNow();if(fine)t+=fine;
  t+=gmSucceed('me');
  pushNews(t);GM_LOG.push(t);sfx.bad();
}
/** 還沒報告的得標金：當場罰款（罰過或免罰回傳空字串）。 */
function gmFineNow(){
  const D=G.gmDue;if(!D||D.done)return '';
  const P=gmParts(D),left=gmPartsLeft(D);let f=0,ex=0;
  left.forEach(k=>{P[k].done=true;if(P[k].exempt||!gmOfficial(k)){P[k].exempt=true;ex++}else f+=gmPartFine(D,k)});
  D.done=true;
  if(!f)return ex?NEWS('gm.exempt'):'';
  payPublic('spend.gmFine',f);
  return NEWS('gm.fine',{a:fmt(f),n:left.length-ex});
}
/** 一份沒報告的罰款：得標金 × 1.2 ÷ 3（舊存檔只有一份時照整筆 1.2 倍）。 */
const gmPartFine=(D,k)=>Math.round(D.amt*ODDS.gm.fineX*(gmParts(D)[k].old?1:1/GM_COURTS.length))
/** 一期結束（例會旬開始、建立新例會之前）：本期沒報告就罰款。 */
function gmPeriodEnd(log){
  const D=G.gmDue;if(!D)return;
  if(!D.done){const t=gmFineNow();if(t){pushNews(t);log.push(t)}}
  G.gmDue=null;
}
/** 菓子折開標後：你是公會長時，得標金進你的現款，記下待報告。 */
function gmLotPaid(M,res){
  if(!gmIsMe()||!res||!res.who||res.who==='me'||!(res.price>0))return;
  G.silver+=res.price;G.gmDue={amt:res.price,mt:M.mt,done:false,shown:false,parts:{}};
  GM_COURTS.forEach(k=>G.gmDue.parts[k]={done:false,ok:false,exempt:false});
  const t=NEWS('gm.lotIn',{a:fmt(res.price),list:gmPlanTxt(G.gmDue)});pushNews(t);GM_LOG.push(t);
}
/** 本期的報告月（例會月＋2：5、8、11、2 月；舊說法，只剩御金奉行那一份用）。 */
const gmReportMonth=()=>{const start=3+3*Math.floor(((G.month-3+12)%12)/3);return (start+2-1)%12+1};
/** 三份的時程文字：「3 月御目付、4 月城代家老、5 月御金奉行」，已報告的標出。 */
function gmPlanTxt(D){
  const P=gmParts(D);
  return GM_COURTS.filter(k=>!P[k].old||k==='finance').map(k=>({k,m:gmCourtMonth(k,D.mt)})).sort((a,b)=>((a.m-3+12)%12)-((b.m-3+12)%12))
    .map(x=>UT(P[x.k].done?(P[x.k].ok?'gm.plan.ok':'gm.plan.miss'):'gm.plan.todo',{m:x.m,t:UT('gm.title.'+x.k)})).join(NAMES_SEP);
}
/** 提醒視窗內容。 */
const gmRemindHtml=()=>UT('gm.remind.body',{a:fmt(G.gmDue.amt),list:gmPlanTxt(G.gmDue)});

/* ---------- 名望視同四階、頂欄 ---------- */
{const _f=fameTier;fameTier=function(){return gmIsMe()?4:_f()}}
// 公會長的頂部標示改在左欄（06_ui.js 的 topTagsHtml，第三百四十節）
{const _fi=ACT.fameInfo;ACT.fameInfo=function(){_fi.apply(this,arguments);if(G&&gmIsMe()){const b=$('#info-body');if(b)b.insertAdjacentHTML('beforeend',UT('gm.fameNote'))}}}

/* ---------- 同業公會長不超賣；你被查獲違約就下台 ---------- */
{const _o=rivalOverMul;rivalOverMul=function(r,c,first){if(G&&G.gm&&r&&r.cid===G.gm.cid)return 0;return _o(r,c,first)}}
{const _c=caughtAdd;caughtAdd=function(key){_c(key);if(key==='me')gmFall()}}

/* ---------- 每旬 ---------- */
function gmTick(log){
  if(!guildMember())(G.gmOut||(G.gmOut={}))[String(G.year)]=true;          // 你今年有一段時間不在協議內
  Object.keys(G.gmOut||{}).forEach(y=>{if(+y<G.year-2)delete G.gmOut[y]});
  const g=gmCid();
  if(g&&g!=='me'){const n=npc(g);if(!n||!alive(g)||n.cityId!==G.cityId){const t=NEWS('gm.vacant',{n:nameOf(g)})+gmSucceed(g);pushNews(t);log.push(t)}}   // 同業公會長過世或離城
  if(gmIsMe())addFame(ODDS.gm.famePerTurn);
  const D=G.gmDue;
  if(gmIsMe()&&D&&!D.done&&G.cycle===1){         // 三系六階各自來城那個月的上旬：還沒報告就提醒
    const P=gmParts(D);
    gmPartsLeft(D).forEach(k=>{
      if(gmCourtMonth(k,D.mt)!==G.month||P[k].exempt)return;
      const off=gmOfficial(k);
      if(!off){P[k].exempt=true;P[k].done=true;const t=NEWS('gm.noOfficial',{t:UT('gm.title.'+k)});pushNews(t);log.push(t)}
      else queueFaceEvent({type:'gmRemind',cid:off.cid,turn:G.turn});
    });
    gmDueSync(D);
  }
  if(G.gmArb&&G.gmArb.turn<G.turn)G.gmArb=null;                              // 糾紛沒處理：作罷
  if(G.gmLevy&&G.gmLevy.turn<G.turn){const L=G.gmLevy;G.gmLevy=null;payPublic('spend.gmLevy',L.amt);const t=NEWS('gm.levy.auto',{a:fmt(L.amt)});pushNews(t);log.push(t)}   // 攤派沒決定：幕府催繳，自己出
  if(gmIsMe()&&G.cycle===1&&G.month%3===1&&G.guild&&G.gmEvT!==G.guild.mt){   // 例會後第二個月上旬
    G.gmEvT=G.guild.mt;
    if(chance(ODDS.gm.evP))gmEvent(log);
  }
  while(GM_LOG.length){const t=GM_LOG.shift();if(!log.includes(t))log.push(t)}
}

/* ---------- 任內事件 ---------- */
function gmEvent(log){
  const rv=rivalsHere().filter(n=>alive(n.cid)&&!jailed(n));
  const fin=gmOfficial()||Object.values(G.world.npcs).find(n=>n.pos&&n.pos.court==='finance'&&n.cityId===G.cityId&&alive(n.cid));
  const canArb=rv.length>=2,canLevy=!!fin;if(!canArb&&!canLevy)return;
  if(canArb&&(!canLevy||chance(0.5))){
    const [a,b]=shuffle(rv.slice()).slice(0,2).map(n=>n.cid),A=ODDS.gm;
    G.gmArb={a,b,cost:Math.round(rint(A.arbCost[0],A.arbCost[1])/50)*50,turn:G.turn};
    queueFaceEvent({type:'gmArb',cid:a,turn:G.turn});
    log.push(NEWS('gm.arb.news',{a:nameOf(a),b:nameOf(b)}));
  }else{
    const A=ODDS.gm;G.gmLevy={amt:Math.round(rint(A.levy[0],A.levy[1])/100)*100,turn:G.turn,cid:fin.cid,arm:null};
    queueFaceEvent({type:'gmLevy',cid:fin.cid,turn:G.turn});
    log.push(NEWS('gm.levy.news',{a:fmt(G.gmLevy.amt)}));
  }
}
FACE_TITLE.gmArb='gm.arb.title';
FACE_EXT.gmArb=(e,name)=>{
  const o=G.gmArb;if(!o||o.turn!==e.turn)return null;
  const na=nameOf(o.a),nb=nameOf(o.b),A=ODDS.gm;
  return {line:UT('gm.arb.line',{a:na,b:nb}),effect:UT('gm.arb.eff',{f:A.arbFav,h:A.arbHurt,c:fmt(o.cost),m:A.arbAff}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm" data-act="gmArb" data-k="a">'+UT('gm.arb.pick',{n:esc(na)})+'</button><button class="pixel-btn btn-sm" data-act="gmArb" data-k="b">'+UT('gm.arb.pick',{n:esc(nb)})+'</button></div><button class="pixel-btn btn-sm btn-gold" style="width:100%;margin-top:4px" data-act="gmArb" data-k="m" '+(G.silver<o.cost?'disabled':'')+'>'+UT('gm.arb.mediate',{c:coinHtml('silver',o.cost)})+'</button>'};
};
ACT.gmArb=el=>{
  const o=G.gmArb;G.gmArb=null;if(!o){UI.hideInfo();return}
  const k=el.dataset.k,A=ODDS.gm,ra=gmMeet(o.a,'gm.bondArb'),rb=gmMeet(o.b,'gm.bondArb');let msg;
  if(k==='m'){if(G.silver<o.cost){G.gmArb=o;toast(MSG('buyGoods.5',{cost:fmt(o.cost)}));return}
    payPublic('spend.gmMediate',o.cost);setAff(ra,clamp(ra.aff+A.arbAff,0,100));setAff(rb,clamp(rb.aff+A.arbAff,0,100));
    logRel(o.a,UT('gm.log.mediate'));logRel(o.b,UT('gm.log.mediate'));msg=MSG('gm.arb.mediated',{a:nameOf(o.a),b:nameOf(o.b),c:fmt(o.cost)});
  }else{
    const w=k==='a'?o.a:o.b,l=k==='a'?o.b:o.a,rw=R(w),rl=R(l);
    setAff(rw,clamp(rw.aff+A.arbFav,0,100));setAff(rl,clamp(rl.aff-A.arbHurt,0,100));
    logRel(w,UT('gm.log.arbWin'));logRel(l,UT('gm.log.arbLose'));msg=MSG('gm.arb.picked',{w:nameOf(w),l:nameOf(l),f:A.arbFav,h:A.arbHurt});
  }
  toast(msg,4600);sfx.tap();UI.hideInfo();UI.render();
};
FACE_TITLE.gmLevy='gm.levy.title';
FACE_EXT.gmLevy=(e,name)=>{
  const L=G.gmLevy;if(!L||L.turn!==e.turn)return null;
  const A=ODDS.gm,cand=rivalsHere().filter(n=>alive(n.cid)&&!isEnemy(n.cid)&&!isBekke(n));
  let b='<button class="pixel-btn btn-sm btn-gold" style="width:100%" data-act="gmLevySelf" '+(G.silver<L.amt&&cand.length?'disabled':'')+'>'+UT('gm.levy.self',{a:fmt(L.amt)})+'</button><div class="tiny muted" style="margin:2px 0 6px">'+(G.silver<L.amt&&cand.length?UT('gm.levy.short'):UT('gm.levy.selfEff',{f:A.levyFame}))+'</div>';
  cand.forEach(n=>{const r=R(n.cid),full=r.aff>=100,half=Math.round(L.amt/2);
    b+='<div class="card" style="margin:3px 0"><div class="row"><span class="small"><b>'+esc(nameOf(n.cid))+'</b> <span class="tag '+affCls(r.aff)+'">'+affWord(r.aff)+'</span></span>'
      +(L.arm===n.cid?'':'<button class="pixel-btn btn-sm" data-act="gmLevyPick" data-cid="'+n.cid+'">'+UT('gm.levy.pick')+'</button>')+'</div>'
      +'<div class="tiny muted">'+(full?UT('gm.levy.full',{d:A.levyAff}):UT('gm.levy.half',{a:fmt(half),f:A.levyFame,d:A.levyAff}))+'</div>'
      +(L.arm===n.cid?'<div class="notice tiny" style="margin-top:3px">'+UT('gm.levy.confirm',{n:esc(nameOf(n.cid))})+'</div><div class="grid2"><button class="pixel-btn btn-sm btn-red" data-act="gmLevyOk">'+UT('gm.levy.ok')+'</button><button class="pixel-btn btn-sm" data-act="gmLevyCancel">'+UT('btn.cartel3Cancel')+'</button></div>':'')+'</div>'});
  b+='<div class="tiny muted" style="margin-top:4px">'+UT('gm.levy.noEnemy')+'</div>';
  return {line:UT('gm.levy.line',{a:fmt(L.amt)}),effect:'',buttons:b};
};
const gmLevyShow=()=>{const L=G.gmLevy;if(!L)return;const e={type:'gmLevy',cid:L.cid,turn:L.turn};UI.showInfo(faceTitle(e),faceEventCard(e))};
ACT.gmLevySelf=()=>{
  const L=G.gmLevy;if(!L){UI.hideInfo();return}
  const cand=rivalsHere().filter(n=>alive(n.cid)&&!isEnemy(n.cid)&&!isBekke(n));
  if(G.silver<L.amt&&cand.length){toast(MSG('buyGoods.5',{cost:fmt(L.amt)}));return}
  G.gmLevy=null;payPublic('spend.gmLevy',L.amt);const f=addFame(ODDS.gm.levyFame,'major');
  toast(MSG('gm.levy.paid',{a:fmt(L.amt),f}),4200);sfx.coin();UI.hideInfo();UI.render();
};
ACT.gmLevyPick=el=>{const L=G.gmLevy;if(!L)return;L.arm=el.dataset.cid;gmLevyShow()};
ACT.gmLevyCancel=()=>{const L=G.gmLevy;if(!L)return;L.arm=null;gmLevyShow()};
ACT.gmLevyOk=()=>{
  const L=G.gmLevy;if(!L||!L.arm)return;G.gmLevy=null;
  const cid=L.arm,r=gmMeet(cid,'gm.bondLevy'),full=r.aff>=100,A=ODDS.gm;
  setAff(r,clamp(r.aff-A.levyAff,0,100));r.peak=Math.max(r.peak||0,r.aff+ENEMY_GAP);logRel(cid,UT('gm.log.levy'));   // 一定成仇（曾經最高好感補到成仇的差距）
  let msg;
  if(full)msg=MSG('gm.levy.assignFull',{n:nameOf(cid),d:A.levyAff});
  else{const half=Math.round(L.amt/2);payPublic('spend.gmLevy',half);loseFame('gmLevy');msg=MSG('gm.levy.assignHalf',{n:nameOf(cid),a:fmt(half),f:A.levyFame,d:A.levyAff})}
  toast(msg,5200);sfx.bad();UI.hideInfo();UI.render();
};

/* ---------- 候選人上門塞錢、報告提醒 ---------- */
FACE_TITLE.gmBribe='gm.bribe.title';
FACE_EXT.gmBribe=(e,name)=>{
  const M=G.guild,E=M&&M.mt===e.turn&&M.el,o=E&&E.bribe[e.cid];if(!o||o.st!==null)return null;
  return {line:TX('gm.bribe',{n:name}),effect:UT('gm.bribe.eff',{a:fmt(o.amt)}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="gmBribe" data-cid="'+e.cid+'" data-v="1">'+UT('gm.bribe.yes')+'</button><button class="pixel-btn btn-sm" data-act="gmBribe" data-cid="'+e.cid+'" data-v="0">'+UT('gm.bribe.no')+'</button></div>'};
};
ACT.gmBribe=el=>{
  const M=G.guild,E=M&&M.el,o=E&&E.bribe[el.dataset.cid];
  if(o&&o.st===null){
    gmMeet(el.dataset.cid,'gm.bondBribe');
    if(el.dataset.v==='1'){o.st='yes';G.gold+=o.amt;logRel(el.dataset.cid,UT('gm.log.bribe',{a:o.amt}));toast(MSG('gm.bribe.took',{n:nameOf(el.dataset.cid),a:fmt(o.amt)}));sfx.coin()}
    else{o.st='no';toast(MSG('gm.bribe.refused',{n:nameOf(el.dataset.cid)}))}
  }
  UI.hideInfo();UI.render();
};
FACE_TITLE.gmRemind='gm.remind.title';
FACE_EXT.gmRemind=(e,name)=>{const D=G.gmDue;if(!gmIsMe()||!D||D.done)return null;return {line:gmRemindHtml(),effect:''}};

/* ---------- 選舉畫面（例會第一步） ---------- */
/** 拉票的心防：同業心防 × 3 × 對手係數（投票人與對手的性向相容），對手市佔比你高時再加。 */
function gmCanvassHp(v,opp){
  const A=ODDS.gm,coef=A.canvassComp[compat(v,opp).matches],d=Math.max(0,gmShare(opp)-gmShare('me'));
  return {hp:Math.round(btHp(v)*A.canvassX*coef*(1+A.canvassShare*d)),coef};
}
/** 你是候選人：開票。沒拉票、拉票失敗、仇人都投對方（第二百五十四節）。 */
function gmCanvassClose(E){
  const opp=E.cands.find(k=>k!=='me');
  E.voters.forEach(v=>{if(!E.votes[v])E.votes[v]=opp});
  if(!E.done)gmTally(E);
}
/** 拉票列表上方的戰況：你幾票、對方幾票、還有幾人沒拉、過半要幾票。 */
function gmCanvassTally(E){
  const n=E.voters.length,me=E.voters.filter(v=>E.votes[v]==='me').length,left=E.voters.filter(v=>!E.votes[v]&&!isEnemy(v)).length;
  return UT('gm.el.tally',{a:me,b:n-me-left,c:left,d:Math.floor(n/2)+1});
}
/** 人物卡上的拉票列（personBlock 的 gm 模式呼叫）。 */
function gmCanvassRow(cid){
  const M=meetNow(),E=M&&M.el;if(!E)return '';
  const v=E.votes[cid];
  if(v)return '<div class="tiny" style="margin-top:4px;color:'+(v==='me'?'#2f6b3a':'#b3261e')+'">'+UT(v==='me'?'gm.el.stYes':'gm.el.stNo')+'</div>';
  const friend=R(cid).aff>=FRIEND_AFF;
  return '<div class="tiny muted" style="margin-top:4px">'+UT('gm.el.stNone')+'</div>'
    +(friend?'<div class="tiny muted" style="margin-top:2px">'+UT('gm.el.noGift')+'</div>':'<div class="row" style="gap:4px;margin-top:2px"><span class="tiny">'+UT('gm.el.gift')+'</span><select class="gift-sel" style="flex:1">'+giftOptions(cid)+'</select></div>')
    +'<button class="pixel-btn btn-sm btn-gold" style="width:100%;margin-top:4px" data-act="gmCanvass" data-cid="'+cid+'">'+UT('gm.el.canvassBtn')+'</button>';
}
function gmElectHtml(M){
  const E=M.el,[A,B]=E.cands;let info='',act='';
  const rowsAll=['me'].concat(rivalsHere().filter(n=>alive(n.cid)).map(n=>n.cid));
  info='<div class="notice tiny">'+(E.first?UT('gm.el.first'):UT('gm.el.rule'))+'</div>';
  if(!E.first)info+='<div class="card tiny">'+UT('gm.el.caughtHead')+rowsAll.map(k=>'<div class="row"><span>'+esc(gmName(k))+'</span><span>'+UT('gm.el.caught',{n:gmScore(k)})+'</span></div>').join('')+'</div>';
  info+='<div class="card"><b class="small">'+UT('gm.el.cands')+'</b>'+E.cands.map(k=>'<div class="row small" style="margin-top:3px"><span>'+(k==='me'?'':portraitHtml(k,32))+esc(gmName(k))+'</span><span class="tiny muted">'+UT('gm.el.share',{p:(gmShare(k)*100).toFixed(1)})+'</span></div>').join('')+'</div>';
  if(E.single&&!E.done&&M.att)gmElectFinish(E,E.cands[0]);
  if(E.single){act='<div class="notice">'+UT('gm.el.single',{n:esc(gmName(E.winner))})+'</div>'+UT('gm.next');return {info,act}}
  if(E.done){
    const L=Object.keys(E.votes).map(v=>'<div class="row tiny"><span>'+esc(gmName(v))+'</span><span>'+UT('gm.el.voteFor',{n:esc(gmName(E.votes[v]))})+'</span></div>').join('');
    act='<div class="card">'+L+'<div class="row small" style="border-top:1px solid #d8ccb3;margin-top:4px;padding-top:4px"><span>'+UT('gm.el.count',{a:esc(gmName(A)),x:E.count[A],b:esc(gmName(B)),y:E.count[B]})+'</span></div>'+(E.tie?'<div class="tiny muted">'+UT('gm.el.tie')+'</div>':'')+'<div class="notice" style="margin-top:4px">'+UT('gm.el.win',{n:esc(gmName(E.winner))})+'</div></div>'+UT('gm.next');
    return {info,act};
  }
  if(!E.cands.includes('me')){
    act='<div class="tiny muted">'+UT('gm.el.voteNote',{d:ODDS.gm.voteAff})+'</div><div class="grid2">'+E.cands.map(k=>'<button class="pixel-btn btn-gold" data-act="gmVote" data-k="'+k+'">'+UT('gm.el.voteBtn',{n:esc(gmName(k))})+'</button>').join('')+'</div><button class="pixel-btn" style="width:100%;margin-top:4px" data-act="gmVote" data-k="none">'+UT('gm.el.abstain')+'</button>';
    return {info,act};
  }
  E.voters.forEach(v=>{if(!isEnemy(v))gmMeet(v,'gm.bondLabel')});   // 例會上同業都在座：拉票名單上的人都算見過面
  act='<div class="notice tiny">'+UT('gm.el.canvassNote')+'</div><div class="card small" style="text-align:center"><b>'+gmCanvassTally(E)+'</b></div>'
    +E.voters.map(v=>personBlock(v,'gm')).join('')
    +'<button class="pixel-btn btn-red" style="width:100%;margin-top:6px" data-act="gmTallyNow">'+UT('gm.el.tallyBtn')+'</button>';
  return {info,act};
}
/** 例會沒出席或沒走完：你是候選人而沒出席＝市佔較高者當選；拉票到一半，剩下的人投對方；你不是候選人＝同業照相容投、你沒有票。 */
function gmElectAuto(M){
  const E=M.el;if(!E||E.done)return;
  if(E.cands.includes('me')){
    const opp=E.cands.find(k=>k!=='me');
    if(!M.att&&!opp){E.absent=true;E.done=true;const inc=gmCid();if(inc){const t=NEWS('gm.stay',{n:gmName(inc)});pushNews(t);GM_LOG.push(t)}return}   // 沒到會不能當選；只剩你一位時現任續任（第二百七十七節）
    if(!M.att){E.absent=true;gmElectFinish(E,opp);return}   // 沒到會不能當選，由另一位當選
    gmCanvassClose(E);return;                       // 出席了但沒按開票：沒拉到的人投對方
  }
  const [A,B]=E.cands;E.voters.forEach(v=>{E.votes[v]=gmRivalPick(v,A,B)});gmTally(E);
}
ACT.gmVote=el=>{
  const M=meetNow(),E=M&&M.el;if(!E||E.done||E.cands.includes('me'))return;
  const k=el.dataset.k,[A,B]=E.cands;
  E.voters.forEach(v=>{E.votes[v]=gmRivalPick(v,A,B)});
  if(k&&k!=='none'){E.votes.me=k;E.myVote=k;const o=k===A?B:A,d=ODDS.gm.voteAff;
    [[k,d],[o,-d]].forEach(([c,x])=>{const r=R(c);setAff(r,clamp(r.aff+x,0,100));logRel(c,UT(x>0?'gm.log.voteFor':'gm.log.voteAgainst'))})}
  gmTally(E);sfx.step();refreshSheet();UI.render();
};
/** 開票（你是候選人時，拉夠了就按）。 */
ACT.gmTallyNow=()=>{const M=meetNow(),E=M&&M.el;if(!E||E.done||!E.cands.includes('me'))return;gmCanvassClose(E);sfx.step();refreshSheet();UI.render()};
ACT.gmCanvass=el=>{
  const M=meetNow(),E=M&&M.el;if(!E||E.done)return;
  const v=el.dataset.cid;if(!v||!E.voters.includes(v)||E.votes[v]||isEnemy(v))return;
  const card=el.closest('.card'),sel=card&&card.querySelector('.gift-sel');
  const opp=E.cands.find(k=>k!=='me'),gift=sel?sel.value:null,c=gmCanvassHp(v,opp);
  gmMeet(v,'gm.bondLabel');
  battleStart(v,gift);
  BT.mode='canvass';BT.opp=opp;BT.hp=c.hp;
  BT.open=TX(c.coef>=1.5?'gm.canvass.hard':c.coef<=0.5?'gm.canvass.easy':'gm.canvass.mid',{o:gmName(opp)});
  battleShow();
};
/** 拉票與報告的戰鬥結算（取代一般拜訪的結算）。 */
function gmBattleEnd(){
  const B=BT;B.done=true;musicWant('market');
  const cid=B.cid,r=R(cid),win=B.dmg>=B.hp;
  const rep=B.mode==='report',snub=rep&&!win&&B.round>=3&&B.hits===0;   // 報告等同一次拜訪（第三百三十九節）：溢出加成、不善言辭
  let gain=snub?0:(win?10+btBondBonus(r)+(rep?Math.min(5,Math.floor((B.dmg-B.hp)/B.hp*10)):0):Math.floor(5*B.dmg/B.hp))+B.hits;gain=Math.max(0,Math.min(gain,100-r.aff));
  setAff(r,clamp(r.aff+gain,0,100));r.lastOk=!snub;if(snub)r.snubUntil=G.turn+1;
  let msg;
  if(B.mode==='canvass'){
    const M=meetNow(),E=M&&M.el;
    if(E&&!E.done)E.votes[cid]=win?'me':B.opp;     // 打完回到列表；開票由玩家按
    logRel(cid,UT(win?'gm.log.canvassWin':'gm.log.canvassLose',{a:B.spent}));
    msg=(win?TX('gm.canvassWin'):TX('gm.canvassLose',{o:gmName(B.opp)}))+UT('gm.gain',{g:gain});
  }else{
    const D=G.gmDue,pass=win||(B.round>=3&&B.hits>0),k=B.court||'finance',P=gmParts(D);
    if(D&&!D.done&&P&&P[k]&&!P[k].done){P[k].done=true;P[k].ok=pass;
      const t0=UT('gm.title.'+k),left=gmPartsLeft(D).length;gmDueSync(D);
      if(pass){msg=TX('gm.reportOk');const t=NEWS(left?'gm.reportedPart':'gm.reported',{a:fmt(D.amt),t:t0,n:left});pushNews(t);GM_LOG.push(t)}
      else{const f=gmPartFine(D,k);payPublic('spend.gmFine',f);msg=TX('gm.reportFail')+MSG('gm.fined',{a:fmt(f)});const t=NEWS('gm.finePart',{a:fmt(f),t:t0});pushNews(t);GM_LOG.push(t)}
    }
    logRel(cid,UT(pass?'gm.log.reportOk':'gm.log.reportFail',{a:B.spent}));
    msg+=UT('gm.gain',{g:gain});
    BT=null;if(win)sfx.gift();else if(snub)sfx.bad();
    refreshSheet();UI.render();
    if(snub){UI.showInfo(UT('bt.battleShow',{a:nameOf(cid)}),'<div style="display:flow-root">'+portraitHtml(cid,56,{gray:true})+'<div class="small">'+esc(btSay(cid,'snub'))+'</div><div class="notice tiny" style="margin-top:6px">'+esc(msg)+'</div></div>');return}
    if(win&&r.aff>=FRIEND_AFF&&reqList(cid).length){UI.showInfo(UT('bt.battleEnd.7',{a:nameOf(cid)}),requestHtml(cid,msg,btBlush(B)));return}
    UI.hideInfo();toast(msg,4600);return;
  }
  BT=null;UI.hideInfo();toast(msg,4600);if(win)sfx.gift();
  refreshSheet();UI.render();
}
{const _be=battleEnd;battleEnd=function(){if(BT&&!BT.done&&BT.mode){gmBattleEnd();return}return _be.apply(this,arguments)}}

/* ---------- 向三系六階報告 ---------- */
/** 這位官員是哪一系還沒報告的六階（不是就回傳 null）。 */
const gmReportCourt=cid=>{const D=G.gmDue;if(!gmIsMe()||!D||D.done)return null;const P=gmParts(D),n=npc(cid);if(!n||!n.pos||n.pos.rank!==6)return null;const k=n.pos.court;if(!P[k]||P[k].done||P[k].exempt)return null;const off=gmOfficial(k);return off&&off.cid===cid?k:null};
/** 這位官員是不是本期要報告的對象，而且這個月在城裡。 */
const gmReportTarget=cid=>{const k=gmReportCourt(cid);return !!(k&&tourHere(npc(cid)))};
{const _pb=personBlock;personBlock=function(cid,ctx){
  const h=_pb.apply(this,arguments);
  if(!gmReportTarget(cid))return h;
  return h+'<div class="card warn tiny" style="margin:3px 0"><div class="row"><span>'+UT('gm.report.tag')+UT('gm.report.note',{a:fmt(G.gmDue.amt),n:gmPartsLeft(G.gmDue).length})+'</span><span style="white-space:nowrap"><button class="pixel-btn btn-sm btn-gold" data-act="gmReport" data-cid="'+cid+'">'+UT('gm.report.btn')+'</button></span></div></div>';   // 放在人物卡下方，與索賄承諾同一處（第三百三十九節）
}}
ACT.gmReport=el=>{
  const cid=el.dataset.cid;if(!gmReportTarget(cid))return;
  if(apLeft()<=0){toast(MSG('go.2'));return}
  if(!spendAP())return;
  gmMeet(cid,'gm.bondLabelReport');                 // 報告等同一次拜訪：不認識的也就此結識
  battleStart(cid,null);
  BT.mode='report';BT.court=gmReportCourt(cid);BT.mult=1;BT.giftOk=false;BT.open=TX('gm.reportOpen');
  battleShow();
};

/* ---------- 例會：公會長不能退出協議；散會提醒；大盤頁顯示現任 ---------- */
{const _c=ACT.cartel;ACT.cartel=function(el){if(gmIsMe()&&el&&el.dataset.s==='none'){toast(MSG('gm.noQuit'));return}return _c.apply(this,arguments)}}
{const _e=ACT.meetEnd;ACT.meetEnd=function(){
  const M=meetNow();_e.apply(this,arguments);
  const D=G.gmDue;
  if(M&&gmIsMe()&&D&&D.mt===M.mt&&!D.shown){D.shown=true;UI.showInfo(UT('gm.remind.title'),'<div class="small">'+gmRemindHtml()+'</div>'+UT('face.buttons'))}
}}
/** 沒出席的例會：得標金的提醒改在旬報後出現。 */
function gmAutoRemind(M){const D=G.gmDue,off=gmOfficial();if(M&&gmIsMe()&&D&&D.mt===M.mt&&!D.shown&&off){D.shown=true;queueFaceEvent({type:'gmRemind',cid:off.cid,turn:G.turn})}}
{const _g=guildInfoCard;guildInfoCard=function(){const g=gmCid();return _g.apply(this,arguments)+'<div class="row tiny" style="margin-top:3px"><span>'+UT('gm.info')+'</span><b>'+(g?esc(gmName(g)):UT('gm.info.none'))+'</b></div>'}}
/** 開局：開業旬報之後接著候選人上門。 */
{const _b=ACT.begin;ACT.begin=function(){_b.apply(this,arguments);armFaceEvents()}}
