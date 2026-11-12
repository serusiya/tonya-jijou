'use strict';
/* ======================= 商人請託：同業調貨、掮客銷貨、經營好手臨時打工、座客商人代售他行貨物、私梟脫手走私貨 =======================
 *  - 拜訪同業、掮客、經營好手、座客商人或私梟打勝、好感 ≥60 時出現請託（與官員請託同一個視窗）。開口好感 −10，同一人冷卻 3 旬。
 *  - 不在協議裡（沒參加或違約被查獲後）：同業不肯調貨；仲買人銷貨、旅商人代售壓價，開口時多一句被排擠的話（第二百四十七節）。
 *  - 同業巨賈「調貨」：本旬缺口金額最大的一項本業貨（都沒缺就隨機；同一人同一旬固定），數量 30～50、金額上限 3,000～4,000 兩（不超過倉位、庫存上限與現款；第二百四十六節），照大盤市價（未參加協議價）付現款，當場入倉。
 *  - 掮客「銷貨」：庫存單位數最多的本業貨（同量取基準價最高），以大盤市價七折賣出，最多 10 單位、金額最多約 400～500 兩（庫存不夠就全賣），收入進現款；不算出貨，不影響行情、配額與市佔率。
 *  - 經營好手「臨時打工」：開口那一旬的結算裡，以他的商才算兩名番頭、兩名手代的加成（不佔名額、不付月例）。
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
/** 不在協議裡（沒參加，或違約被查獲後還沒重新加入）：同業不肯調貨，仲買人、旅商人收貨壓價（第二百四十七節）。暗約仍算在協議裡。 */
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
 *  有缺口的貨裡挑缺口金額最大的一項；都沒缺就隨機。數量 30～50、金額上限 3,000～4,000 兩取較少者，再受倉位、單項上限與現款限制。
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
/** 掮客銷貨：庫存單位數最多的本業貨（同量取基準價最高），以大盤市價七折賣出；最多 10 單位、金額最多約 400～500 兩（同一人同一旬固定），庫存不夠就全賣。不算出貨。 */
const BROKER_MAXQ=10;
function brokerLot(cid){
  const L=tradeComms().filter(c=>(G.inv[c.name]||0)>0);if(!L.length)return null;
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
    logRel(cid,UT('deal.buyoutIntel.log',{region:REG_NAME(I.rid),month:buyoutMonth(I.m),aff:REQ_AFF.normal}));
    return UT('deal.buyoutIntel.ok',{name:nm,region:REG_NAME(I.rid),month:buyoutMonth(I.m),aff:REQ_AFF.normal});
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
