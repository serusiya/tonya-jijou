'use strict';
/* ======================= 商人請託：同業調貨、掮客銷貨、經營好手臨時打工、座客商人代售他行貨物、私梟脫手走私貨 =======================
 *  - 拜訪同業、掮客、經營好手、座客商人或私梟打勝、好感 ≥60 時出現請託（與官員請託同一個視窗）。開口好感 −10，同一人冷卻 3 旬。
 *  - 同業巨賈「調貨」：本旬隨機一項已能交易的本業貨（同一人同一旬固定），數量＝大盤每旬進貨上限的兩倍（不超過倉位、庫存上限與現款），照大盤市價（未參加協議價）付現款，當場入倉。
 *  - 掮客「銷貨」：庫存單位數最多的本業貨（同量取基準價最高），以大盤市價七折賣出，最多 10 單位、金額最多約 400～500 兩（庫存不夠就全賣），收入進現款；不算出貨，不影響行情、配額與市佔率。
 *  - 經營好手「臨時打工」：開口那一旬的結算裡，以他的商才算兩名番頭、兩名手代的加成（不佔名額、不付月例）。
 *  - 座客商人「代售」：倉庫裡的他行貨物，一次一項、整批全收；價格約為基準價的 54%～87%（看這位商人的好感），量大再打折。收入進現款。
 *  - 私梟「脫手」：密庫裡的走私貨，一次一項、整批全收；照本旬黑市行情與數量折扣計價，收入進私房錢，風聲 + 0.2 × 危險度。
 *  - 私梟落網：風聲偏緊（> 3）時，近 36 旬替你脫過手的私梟每旬有機率落網（下獄 36 旬）；落網後依忠誠與交情決定會不會供出你。 */
const DEAL_CD=3;
/** 這位商人能不能開口（冷卻中則否）。 */
const dealReady=cid=>G.turn-(R(cid).dealT===undefined?-99:R(cid).dealT)>=DEAL_CD;
/** 座客商人代售的成數：看這位商人的好感（另有 ±8% 浮動），量大再打折。 */
function xsellQuote(cid,name,q,noise){
  const c=COMM_MAP[name],tf=trustFactor(R(cid).aff);
  const m=clamp(0.42+0.30*tf+(noise===undefined?0:noise),0.35,0.9),unit=c.base*m*(1-Math.min(0.25,0.002*q));
  return {m,rev:Math.round(unit*q)};
}
/** 本旬黑市行情的文字（相對基準）。 */
function smugMood(k){const f=(G.smugP&&G.smugP[k])||1;return f>=1.15?'行情好':f<=0.92?'行情差':'行情平平'}
/** 同業調貨：本旬這位同業能調給你的貨（同一人同一旬固定一項），沒有就回傳 null。 */
function rivalLot(cid){
  const L=tradeComms();if(!L.length)return null;
  const c=L[Math.floor(seeded(cid+'_'+G.turn)()*L.length)],n=c.name;
  const unit=unitBuyCost(n)/(guildMember()?ODDS.rivalShip.buyMult:1);   // 未參加協議價＝大盤市價
  const q=Math.max(0,Math.min(buyLimit(n)*2,itemRoom(n),Math.floor(G.silver/unit)));
  return q>0?{c,n,q,unit,cost:Math.round(unit*q)}:null;
}
/** 掮客銷貨：庫存單位數最多的本業貨（同量取基準價最高），以大盤市價七折賣出；最多 10 單位、金額最多約 400～500 兩（同一人同一旬固定），庫存不夠就全賣。不算出貨。 */
const BROKER_MAXQ=10;
function brokerLot(cid){
  const L=tradeComms().filter(c=>(G.inv[c.name]||0)>0);if(!L.length)return null;
  const c=L.slice().sort((a,b)=>(G.inv[b.name]-G.inv[a.name])||(b.base-a.base))[0],n=c.name,target=400+100*seeded(cid+'_b'+G.turn)();
  const unit=priceNow(n,G.mk[n].shipped)*0.7,q=Math.max(1,Math.min(G.inv[n],BROKER_MAXQ,Math.floor(target/unit)));
  return {c,n,q,unit,rev:Math.round(unit*q)};
}
/** 座客商人／私梟／同業／掮客／經營好手的請託項目。 */
function dealerReqs(cid){
  const n=npc(cid);if(!n||!dealReady(cid))return [];
  if(n.role==='rival'){
    const L=rivalLot(cid);if(!L)return [];
    return [{k:'rv_'+L.n,name:'調貨：'+L.c.short+' × '+L.q,desc:'他從自家倉裡勻一批給你，照大盤市價約 '+fmt(L.cost)+' 兩，當場入倉。'}];
  }
  if(n.role==='broker'){
    const L=brokerLot(cid);if(!L)return [];
    return [{k:'bk_'+L.n,name:'銷貨：'+L.c.short+' × '+L.q,desc:'他把貨轉到外地脫手，約可得 '+fmt(L.rev)+' 兩（市價七折）；不算你在本城的出貨。'}];
  }
  if(n.role==='manager'){
    if(tempHelp()!==null)return [];
    return [{k:'tmp_help',name:'臨時打工一旬',desc:'他來店裡幫忙到這一旬結算：進貨上限變高、出貨價略增、穩定供貨線略降（算兩名番頭、兩名手代）。'}];
  }
  if(n.role==='guest'){
    return Object.keys(G.xinv||{}).filter(k=>G.xinv[k]>0).map(k=>{const q=G.xinv[k],Q=xsellQuote(cid,k,q);
      return {k:'xs_'+k,name:'代售：'+xName(k)+' × '+q,desc:'他找熟識的店家整批收下，約可得 '+fmt(Q.rev)+' 兩（基準價的 '+Math.round(Q.m*100)+'% 上下）。'}});
  }
  if(n.role==='smuggler'){
    return Object.keys(contra()).filter(k=>contra()[k]>0).map(k=>{const q=contra()[k],i=SMUG_BY[k];
      return {k:'cs_'+k,name:'脫手：'+i.name+' × '+q,desc:'本旬'+smugMood(k)+'。整批約可得 '+fmt(Math.round(smugPrice(k,q)*q))+' 兩（每單位約 '+fmt1(smugPrice(k,q))+' 兩，量大壓價），進私房錢；風聲 +'+fmt1(0.2*i.danger)+'。'}});
  }
  return [];
}
/** 辦理商人請託，回傳結果訊息；不是商人請託回傳 null。 */
function dealerDo(cid,k){
  const r=R(cid),nm=nameOf(cid);
  if(k.startsWith('rv_')){
    const L=rivalLot(cid);if(!L||L.n!==k.slice(3))return '他倉裡這批貨已經調不出來了。';
    G.silver-=L.cost;addStock(L.n,L.q,L.unit);G.inv[L.n]=(G.inv[L.n]||0)+L.q;
    r.aff=Math.max(0,r.aff-REQ_AFF.normal);r.dealT=G.turn;logRel(cid,'調給你「'+L.c.short+'」'+L.q+' 單位，好感 -'+REQ_AFF.normal+'。');
    coinFx();return '「'+nm+'」從自家倉裡勻出「'+L.c.short+'」'+L.q+' 單位，已入倉；現款 -'+fmt(L.cost)+' 兩（好感 -'+REQ_AFF.normal+'）。';
  }
  if(k.startsWith('bk_')){
    const L=brokerLot(cid);if(!L||L.n!==k.slice(3))return '倉裡這批貨已經不夠了。';
    G.inv[L.n]-=L.q;G.silver+=L.rev;
    r.aff=Math.max(0,r.aff-REQ_AFF.normal);r.dealT=G.turn;logRel(cid,'替你把「'+L.c.short+'」'+L.q+' 單位轉到外地脫手，好感 -'+REQ_AFF.normal+'。');
    coinFx();return '「'+nm+'」把「'+L.c.short+'」'+L.q+' 單位轉到外地脫手，現款 +'+fmt(L.rev)+' 兩（好感 -'+REQ_AFF.normal+'）。';
  }
  if(k==='tmp_help'){
    G.tempHelp={turn:G.turn,cs:CH(cid).derived_stats.commerce_skill,name:nm,cid};
    r.aff=Math.max(0,r.aff-REQ_AFF.normal);r.dealT=G.turn;logRel(cid,'到店裡臨時幫忙一旬，好感 -'+REQ_AFF.normal+'。');
    return '「'+nm+'」捲起袖子，這一旬就在店裡幫忙到結算（好感 -'+REQ_AFF.normal+'）。';
  }
  if(k.startsWith('xs_')){
    const name=k.slice(3),q=(G.xinv||{})[name]||0;if(q<=0)return '貨已經不在倉裡了。';
    const Q=xsellQuote(cid,name,q,(rnd()-0.5)*0.16);
    G.silver+=Q.rev;delete G.xinv[name];addFame(0.1);
    r.aff=Math.max(0,r.aff-REQ_AFF.normal);r.dealT=G.turn;logRel(cid,'替你代售「'+xName(name)+'」'+q+' 單位，好感 -'+REQ_AFF.normal+'。');
    pushNews(NEWS('xsell.1',{introId:nm,short:xName(name),q,rev:fmt(Q.rev),m:Math.round(Q.m*100),d:REQ_AFF.normal}));
    coinFx();return '「'+nm+'」找熟識的店家把「'+xName(name)+'」'+q+' 單位整批收下，現款 +'+fmt(Q.rev)+' 兩（好感 -'+REQ_AFF.normal+'）。';
  }
  if(k.startsWith('cs_')){
    const key=k.slice(3),q=contra()[key]||0,it=SMUG_BY[key];if(q<=0)return '密庫裡已經沒有這批貨了。';
    const net=Math.round(smugPrice(key,q)*q);
    contra()[key]-=q;G.gold+=net;addHeat(0.2*it.danger);G.life.smuggled=(G.life.smuggled||0)+net;
    r.aff=Math.max(0,r.aff-REQ_AFF.normal);r.dealT=G.turn;r.smugT=G.turn;logRel(cid,'替你在黑市脫手「'+it.name+'」'+q+' 單位，好感 -'+REQ_AFF.normal+'。');
    coinFx();return '「'+nm+'」連夜把「'+it.name+'」'+q+' 單位運走脫手，私房錢 +'+fmt(net)+' 兩（好感 -'+REQ_AFF.normal+'，風聲 +'+fmt1(0.2*it.danger)+'）。';
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
    logRel(cid,'在黑市交易時落網，下獄。');
    const loyal=CH(cid).derived_stats.integrity_loyalty,pc=clamp(confessP(loyal)*(1.2-r.aff/100),0,1);
    if(chance(pc)){const t=NEWS('smugglerArrest.talk',{n:nm});pushNews(t);log.push(t);doRaid('testimony',log)}
    else{const t=NEWS('smugglerArrest.silent',{n:nm});pushNews(t);log.push(t)}
  });
}
