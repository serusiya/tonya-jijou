'use strict';
/* ★檔案總覽：市場與時間推進
 * - 價格：priceNow＝基準價×城市係數×季節×(近九旬需求/近九旬總出貨)^α×事件；總出貨＝同業實際出貨（含隨機超賣）＋我方出貨。
 * - 買賣：buyGoods（下單、隔旬到貨、每旬上限）、sellGoods（出貨）、autoShip 在 06_ui.js。
 * - 公會：evalCartel（配額與偷跑）；riotTick（主食鹽價過高→打毀）；EVENTS 隨機事件。
 * - 同業：marketShares/msTick（本城同業市佔率）。
 * - 商路：只有委託採買（07i_voyage.js）；這裡留距離 distTurns、陸海路判定 canSea/canLand、單趟運量 capOf 與歸來推進 shipsTick。
 * - advanceTurn：每旬推進的唯一入口（順序很重要，詳見該函式註解）。 */
/* ======================= 03 市場：以量控價、株仲間、打毀、損耗、商路、旬推進 ======================= */
/** 打毀指標：白米與粗鹽（資料檔標籤 riot）。 */
const STAPLE_KEYS=COMM.filter(c=>commTag(c,'riot')).map(c=>c.name);
/** 節慶期間需求 ×4 的物品（資料檔標籤 fest：菜籽油、芝麻油、鯨油、棉布、錦緞）。 */
const festHot=c=>commTag(c,'fest');
/** （舊）地區相鄰表；目前距離改由 REGION_XY 座標計算。 */
const REGION_ADJ={reg_central:['reg_east','reg_west','reg_north'],reg_east:['reg_central','reg_north'],reg_west:['reg_central','reg_south'],reg_south:['reg_west'],reg_north:['reg_central','reg_east']};

/** 主角駐節城市。 */
const homeCity=()=>CITY(G.cityId);
/** 城市目前人口；本店駐節城採存檔中的動態人口，其他城市維持資料表人口。 */
const cityPop=city=>G&&city&&city.id===G.cityId&&Number.isFinite(G.cityPopulation)?G.cityPopulation:(parseInt(city&&city.population,10)||0);
/** 某城對某物品的每旬需求量（依人口，必需品權重高、奢侈品低）。 */
function cityD(city,c){
  const w=c.staple?0.5:c.luxury?0.06:0.25,mn=c.staple?30:c.luxury?6:20;
  return Math.max(mn,Math.round(cityPop(city)/1000*w));
}
/** 城市物產：資料表原有物產＋本局新增的產地（G.devProd，存檔）。城市資料表不可直接改，以免同頁新局被上一局污染。所有讀物產的地方都用它（開局選城除外）。 */
function cityProds(ct){const b=(ct&&ct.connected_commodities)||[];const d=(G&&G.devProd||[]).filter(x=>x.cityId===ct.id&&!b.includes(x.name)).map(x=>x.name);return d.length?b.concat(d):b}
/** 某城是否為某貨的新增產地。 */
const isDevProd=(ct,name)=>!!(G&&G.devProd||[]).some(x=>x.cityId===ct.id&&x.name===name);
/** 本局新增的城史（新產地等）。 */
const cityHistExtra=ct=>(G&&G.cityHist&&G.cityHist[ct.id])||[];
/** 每年一月上旬：一定機率在隨機城市新增一項本業貨的產地（產地越少的貨越容易抽中；不限到不到得了；排除本店所在城與已產者）。 */
function newProdTick(log){
  if(!roll('newProd'))return;
  const L=ownComms().map(c=>{const cs=CITIES.filter(ct=>ct.id!==G.cityId&&!cityProds(ct).includes(c.name));return {c,cs,w:1/(CITIES.filter(ct=>cityProds(ct).includes(c.name)).length+1)}}).filter(x=>x.cs.length);
  if(!L.length)return;
  let x=rnd()*L.reduce((a,o)=>a+o.w,0),o=L[0];for(const it of L){x-=it.w;if(x<=0){o=it;break}}
  const ct=pick(o.cs);G.devProd=G.devProd||[];G.devProd.push({cityId:ct.id,name:o.c.name,year:G.year});
  G.cityHist=G.cityHist||{};(G.cityHist[ct.id]=G.cityHist[ct.id]||[]).push({year:G.year,title:NEWS('cityHist.newProd',{n:o.c.short})});
  const t=NEWS('newProd',{city:ct.name,name:o.c.short});pushNews(t);log.push(t);
}
/** 城市價格係數：固定雜訊、產地便宜（×0.8）、大城偏貴（×1.08）。 */
function cityMod(city,c){
  const noise=0.92+0.16*seeded(city.id+c.id)();
  let m=noise;
  if(cityProds(city).includes(c.name))m*=0.8;                         // 產地便宜（含新增產地）
  else if(city.type==='admin')m*=1.08;               // 消費大城偏貴
  return m;
}
/** 物品目前季節係數。 */
function seasonCoef(c){return (SEASON_COEF[c.sys]||SEASON_COEF.timber)[season()]}
/** 本城今天是否正逢節慶。 */
function festActive(){
  const f=homeCity().special_festival;
  return !!(f&&f.month===G.month&&f.cycle===G.cycle);
}
/** 節慶需求倍率：本城節慶那一旬，所有貨物需求 ×3；酒、油、布料等節慶相關貨物 ×4。 */
const festMult=c=>festActive()?(festHot(c)?4:3):1;
/** 以量制價配額（單位/旬）＝本城需求×配額比例（初始 6%，可在公會提案 +10%）。 */
const restrictQuotaOf=name=>Math.max(1,Math.round(G.mk[name].D*G.cartel.quotaPct));
/** 本期有效配額：以量制價採固定比例；正常供應採玩家的穩定供貨線，兩者都是出貨上限。 */
const quotaOf=name=>cartelPolicy()==='normal'?supplyLine(name):restrictQuotaOf(name);

/** 建立各物品市場資料（需求、供給、事件倍率、進貨壓力）與開局庫存。 */
function initMarket(){
  const city=homeCity();
  const names=new Set(commsOfSys(G.sysKey).map(c=>c.name));STAPLE_KEYS.forEach(k=>names.add(k));
  names.forEach(n=>{G.mk[n]={D:cityD(city,COMM_MAP[n]),so:0,ev:1,shipped:0,hist:[],price:0,press:1}});
  refreshMarket(true);
  // 開局庫存
  commsOfSys(G.sysKey).filter(c=>tradeOK(c.name)).forEach(c=>{G.inv[c.name]=Math.max(2,Math.round(G.mk[c.name].D*0.18))});   // 未許可的貨沒有開局庫存
}
/** 本業物品清單。 */
const ownComms=()=>commsOfSys(G.sysKey);
/** 目前庫存總量。 */
const xinvQty=()=>Object.values(G.xinv||{}).reduce((a,b)=>a+b,0);
const invUsed=()=>Object.values(G.inv).reduce((a,b)=>a+b,0)+xinvQty();
/** 倉庫總容量。 */
const invCap=()=>G.wh.n*G.wh.cap;
/* 單項貨品庫存上限：約為本城需求的 5～10 倍（越耐放倍數越高，易腐品 5 倍） */
/** 單項庫存上限倍率（需求的 5～10 倍；易腐的更低）。 */
function capMult(name){return clamp(10-COMM_MAP[name].decay*200,5,10)}
/** 某物品庫存上限＝本城需求×倍率。 */
function itemCap(name){const m=G.mk[name];return Math.max(5,Math.round((m?m.D:cityD(homeCity(),COMM_MAP[name]))*capMult(name)))}
/** 某物品已向大盤下單、尚未到貨的數量。委任採買的品項與數量在歸來時才決定，不列入。 */
const itemOnOrder=name=>(G.orders||[]).filter(o=>o.name===name).reduce((a,o)=>a+o.qty,0);
/** 某物品還能再放多少（同時受單項上限與倉庫容量限制）。 */
const itemRoom=name=>Math.max(0,Math.min(itemCap(name)-(G.inv[name]||0)-itemOnOrder(name),invCap()-invUsed()-pendingQty()));

/** 本旬有效需求（含節慶與市佔率係數）。 */
/** 奢侈品需求冷熱倍率：久無買家時極低，大單湧入時暴增；非奢侈品或舊存檔為 1。 */
const luxMult=(c,m)=>{if(!c.luxury||!m.lux)return 1;const L=ODDS.lux;return m.lux.ph==='dry'?L.dryMult:m.lux.ph==='burst'?m.lux.mul:1};
const demandEff=(c,m,noLux)=>m.D*festMult(c)*(c.sys===G.sysKey?shareFactor():1)*(noLux?1:luxMult(c,m));
/** 本旬同業有效供給：只有「以量制價」決議會再依協議遵守率減供；正常供應直接採各家配額內的實際出貨。 */
const supplyEff=(c,m)=>m.so*(c.sys===G.sysKey&&cartelPolicy()==='restrict'?1-0.22*G.cartel.comp/100:1);
/** 前（視窗旬數−1）旬的需求/同業供給/我方出貨紀錄（舊存檔或開局缺資料時，以基準值補齊）。 */
function pastOf(m){
  if(m.past&&m.past.length)return m.past;
  return Array.from({length:ODDS.rivalShip.win-1},()=>({d:m.D,d0:m.D,so:m.D*ODDS.rivalShip.base,my:0}));
}
/** 【核心定價】市價＝基準×城市係數×季節×(近九旬需求÷近九旬總出貨)^α×事件倍率；總出貨＝同業實際出貨＋我方出貨（含 ship）；限制在基準價 0.25～5 倍。 */
function priceNow(name,ship,noLux){
  const c=COMM_MAP[name],m=G.mk[name],P=pastOf(m);
  const Dw=demandEff(c,m,noLux)+P.reduce((a,x)=>a+(noLux&&x.d0!==undefined?x.d0:x.d),0);
  const Sw=supplyEff(c,m)+P.reduce((a,x)=>a+x.so+x.my,0)+ship;
  const ratio=Dw/Math.max(1,Sw);
  const p=c.base*cityMod(homeCity(),c)*seasonCoef(c)*Math.pow(ratio,c.alpha)*m.ev;
  return clamp(p,c.base*0.25,c.base*5);
}
/** 參考出貨量（需求的 30%），用於打毀指數與行情指數。 */
const refShip=name=>G.mk[name].D*0.3;
/** 市價（現貨）：你此刻賣出第一單位能拿到的價（含近九旬真實的同業出貨與你的出貨）。noLux＝不計奢侈品冷熱（大盤牌價）。 */
function marketIndex(name,noLux){return priceNow(name,0,noLux)}
/** 參考行情（非本業主食用於打毀指標）：假設近九旬我方每旬至少出貨參考量（需求的 30%）。 */
function refIndex(name){
  const m=G.mk[name],ref=refShip(name);
  return priceNow(name,ref+pastOf(m).reduce((a,x)=>a+Math.max(0,ref-x.my),0));
}
/** 奢侈品冷熱循環：暖身期（行情正常）→久無買家（需求極低，可達數年）→大單湧入（約兩旬，倍數隨冷清長度而增）→再度冷清。 */
function luxTick(c,m,first){
  const L=ODDS.lux;
  if(!m.lux){m.lux={ph:'warm',t:L.warmMin+Math.floor(rnd()*(L.warmMax-L.warmMin+1)),L:0};return}
  if(first)return;
  const X=m.lux;X.t--;
  if(X.t>0)return;
  const own=c.sys===G.sysKey;
  if(X.ph==='burst'||X.ph==='warm'){
    X.ph='dry';X.L=L.dryMin+Math.floor(rnd()*(L.dryMax-L.dryMin+1));X.t=X.L;X.mul=1;
    if(own&&chance(L.news)){const t=NEWS('luxDry',{name:c.short});pushNews(t)}
  }else{
    X.ph='burst';X.t=L.burstT;X.mul=clamp(X.L/L.mulDiv,L.mulMin,L.mulMax);
    if(own&&chance(L.news)){const t=NEWS('luxBurst',{name:c.short});pushNews(t)}
  }
}
/** 本旬同業實際出貨量：
 *  - 以量制價：沿用需求×0.58 的基準供給，再依各家權重與隨機波動出貨。
 *  - 正常供應：總配額＝本城需求；先扣玩家配額，餘額依其他同業（含零星商家）的市占率分配。各家通常不超過配額，偶發超賣才越線。 */
function rivalSupply(c,m,first){
  const R=ODDS.rivalShip,normal=c.sys===G.sysKey&&cartelPolicy()==='normal',rv=rivalsHere();
  if(normal)shareFactor();
  const shares=normal?G.share:marketShares(),sc=shares.rows;
  const base=normal?Math.max(0,m.D-(guildMember()?quotaOf(c.name):0)):m.D*R.base;   // 未參加協議的玩家沒有保留配額，正常供應總量全數分給協議內同業
  if(!rv.length)return Math.round(base*(normal?1:R.lo+rnd()*(R.hi-R.lo)));
  const tot=sc.reduce((a,r)=>a+r.score,0),frac=1-R.otherShare;
  const rivalPool=normal?Math.max(0.000001,sc.reduce((a,r)=>a+(r.share||0),0)+(shares.others||0)):1;
  let sum=normal?base*(shares.others||0)/rivalPool*(0.95+rnd()*0.05):base*R.otherShare*(0.95+rnd()*0.1),big=null;
  sc.forEach(r=>{
    const w=normal?(r.share||0)/rivalPool:(tot>0?r.score/tot:0);let f=R.lo+rnd()*((normal?1:R.hi)-R.lo);
    f*=clamp(r.stock/0.9,0.5,normal?1:1.3);if(r.raided)f*=0.4;
    let mul=0;
    if(c.sys===G.sysKey)mul=rivalOverMul(r,c,first);                       // 本業：每家每旬 5% 挑一項超賣（違反協議配額，見 07y_guild.js）
    else if(!first&&!r.raided&&roll('rivalShip',R.overP))mul=R.mulMin+rnd()*(R.mulMax-R.mulMin);   // 非本業（打毀指標用的主食）：照舊逐項擲
    if(mul){f=normal?Math.max(1.01,f*mul):f*mul;if(!big||mul>big.mul)big={cid:r.cid,mul}}   // 正常供應的超賣事件必定越過該店配額
    sum+=base*(normal?1:frac)*w*f;
  });
  if(big&&!first&&c.sys===G.sysKey&&chance(R.news)){const t=NEWS('rivalDump',{who:nameOf(big.cid),name:c.short});pushNews(t)}
  return Math.round(sum);
}
/** 重算各物品市價（本旬事件、同業變動之後），並更新價格曲線的最新一點。 */
function syncPrices(){
  Object.entries(G.mk).forEach(([name,m])=>{m.price=marketIndex(name);if(m.hist.length)m.hist[m.hist.length-1]=Math.round(m.price*10)/10});
}
/** 推進一旬、日期前進之前：記下本旬的有效需求、同業供給與我方出貨，供 refreshMarket 寫入九旬紀錄。
 *  （若等日期前進後才算，節慶倍率會用到下一旬的日期：節慶前一旬被記成節慶、節慶當旬反而記成平常，節慶當旬的價格因此算了兩次。） */
function snapMarket(){Object.entries(G.mk).forEach(([name,m])=>{const c=COMM_MAP[name];m.snap={d:demandEff(c,m),so:supplyEff(c,m),my:m.shipped}})}
/** 每旬換季刷新：需求、事件倍率回歸、他家供給、進貨壓力回落、市價與歷史曲線。 */
function refreshMarket(first){
  Object.entries(G.mk).forEach(([name,m])=>{
    const c=COMM_MAP[name];
    if(!first){const rec=m.snap||{d:demandEff(c,m),so:supplyEff(c,m),my:m.shipped};m.past=(m.past||pastOf(m)).concat([rec]).slice(-(ODDS.rivalShip.win-1))}   // 用日期前進前記下的本旬需求（snapMarket），節慶、買氣才不會錯記到前一旬
    else m.past=[];
    delete m.snap;
    m.D=cityD(homeCity(),c);
    if(c.luxury)luxTick(c,m,first);
    m.ev=1+(m.ev-1)*(first?0:0.75);if(Math.abs(m.ev-1)<0.03)m.ev=1;
    m.so=rivalSupply(c,m,first);
    m.shipped=0;
    m.press=1+((m.press||1)-1)*0.7;if(m.press<1.003)m.press=1;
    m.wcap=itemCap(name);                                         // 進貨壓力以庫存上限為基準
    m.price=marketIndex(name);
    m.hist.push(Math.round(m.price*10)/10);if(m.hist.length>12)m.hist.shift();
  });
}
/** 進貨價係數（相對市價）：ODDS.rivalShip.buyMult（產地直採已取消）。 */
const empBuyMult=()=>ODDS.rivalShip.buyMult;
/** 大盤進貨單價＝市價（現貨，不計奢侈品冷熱）×進貨係數（參加協議 0.93、未參加 1），遇公會斷貨×1.4，再乘進貨壓力。 */
function unitBuyCost(name){
  const m=G.mk[name];
  let p=marketIndex(name,true)*empBuyMult();
  if(G.cartel.sanction>0)p*=1.4;                                       // 聯合斷貨
  if(!guildMember())p/=ODDS.rivalShip.buyMult;                          // 未參加協議：照市價（參加者享聯合採購價）
  p*=(m.press||1);                                                     // 進貨推高大盤價
  return p;
}
/** 試算出貨：總出貨量、市價、員工加成後的入帳。 */
function quoteSale(name,qty){
  const m=G.mk[name];const tot=m.shipped+qty;
  const p=priceNow(name,tot);const mult=empMult();
  return {price:p,tot,mult,revenue:Math.round(qty*p*mult),perUnit:p*mult};
}
/** 每旬向大盤進貨上限：參加協議者＝（本城需求×你的市佔率＋協議配額）×人手倍數；未參加者只有（本城需求×你的市佔率）×人手倍數。無條件捨去，至少 1；委託採買不受限。 */
const buyLimit=name=>{const sh=(G.share&&G.share.me)||0.05,base=(G.mk[name].D||0)*sh+(guildMember()?quotaOf(name):0);return Math.max(1,Math.floor(base*buyLimitMult()))};
/** 本旬還能向大盤進多少。 */
const buyLeft=name=>Math.max(0,buyLimit(name)-((G.bought&&G.bought[name])||0));
/** 已下單、下一旬才到貨的總量。 */
const pendingQty=()=>(G.orders||[]).reduce((a,o)=>a+o.qty,0);
/** 向大盤『下單』：檢查每旬上限/庫存上限/倉庫容量/現款；先付款、下一旬到貨；進貨量會推高進貨價（上限 1.3 倍）。 */
function buyGoods(name,qty,manual){
  qty=Math.floor(qty);if(qty<=0)return {ok:false,msg:MSG('buyGoods.1')};
  if(!tradeOK(name))return {ok:false,msg:tradeLockMsg(name)};
  if(!G.orders)G.orders=[];
  if(invUsed()+pendingQty()+qty>invCap())return {ok:false,msg:MSG('buyGoods.2',{invUsed:invUsed(),pendingQty:pendingQty(),invCap:invCap()})};
  if(qty>itemRoom(name))return {ok:false,msg:MSG('buyGoods.3',{name:COMM_MAP[name].short,capMult:fmt1(capMult(name)),itemCap:itemCap(name),itemRoom:itemRoom(name)})};
  const mk=G.mk[name];
  if(qty>buyLeft(name))return {ok:false,msg:MSG('buyGoods.4',{name:COMM_MAP[name].short,buyLimit:buyLimit(name),buyLeft:buyLeft(name),mult:fmt1(buyLimitMult())})};
  const cost=Math.round(unitBuyCost(name)*qty);
  if(G.silver<cost)return {ok:false,msg:MSG('buyGoods.5',{cost:fmt(cost)})};
  G.silver-=cost;if(manual)notePublicSpend('spend.buy|'+name,cost);sfx.coin();addFame(0.05);
  G.bought=G.bought||{};G.bought[name]=(G.bought[name]||0)+qty;
  mk.press=Math.min(1.3,(mk.press||1)+0.15*qty/Math.max(1,itemCap(name)));   // 進貨量推高大盤價
  const o=G.orders.find(x=>x.name===name&&x.unit===+unitBuyCost(name).toFixed(2));
  if(o){o.qty+=qty;o.cost+=cost}else G.orders.push({name,qty,cost,unit:+unitBuyCost(name).toFixed(2)});
  return {ok:true,msg:MSG('buyGoods.6',{qty,name:COMM_MAP[name].short,cost:fmt(cost)}),cost};
}
/** 入倉前呼叫：把新進貨依數量加權，更新該貨的平均入庫價（G.avgCost）。 */
function addStock(name,q,unit){
  if(!(q>0)||!(unit>0))return;G.avgCost=G.avgCost||{};
  const have=G.inv[name]||0,prev=G.avgCost[name]>0?G.avgCost[name]:unit;
  G.avgCost[name]=+((have*prev+q*unit)/(have+q)).toFixed(2);
}
/** 某貨庫存的平均入庫價；沒有紀錄（開局庫存、舊存檔）就以目前進貨價代替。 */
const avgCostOf=name=>(G.avgCost&&G.avgCost[name]>0)?G.avgCost[name]:unitBuyCost(name);
/** 每旬開始時讓訂單到貨入倉，超出容量的退回。 */
function receiveOrders(log){
  G.arrived=[];
  (G.orders||[]).forEach(o=>{
    const room=Math.max(0,Math.min(invCap()-invUsed(),itemCap(o.name)-(G.inv[o.name]||0))),q=Math.min(o.qty,room);
    if(q>0)addStock(o.name,q,o.cost/Math.max(1,o.qty));
    G.inv[o.name]=(G.inv[o.name]||0)+q;G.arrived.push({name:o.name,qty:q,cost:o.cost,lost:o.qty-q});
  });
  if(G.orders&&G.orders.length){const t=NEWS('receiveOrders.1',{items:G.arrived.map(a=>COMM_MAP[a.name].short+' ×'+a.qty+(a.lost?UT('arrive.lost',{n:a.lost}):'')).join(NAMES_SEP)});log.push(t);pushNews(t)}
  G.orders=[];
}
/** 出貨：扣庫存、本旬總出貨量增加（壓低市價）、入帳、增加知名度。 */
function sellGoods(name,qty){
  qty=Math.floor(qty);const have=G.inv[name]||0;
  if(qty<=0)return {ok:false,msg:MSG('sellGoods.1')};
  if(!tradeOK(name))return {ok:false,msg:tradeLockMsg(name)};
  if(qty>have)return {ok:false,msg:MSG('sellGoods.2')};
  const q=quoteSale(name,qty);addFame(Math.min(0.4,q.revenue/5000));
  G.inv[name]-=qty;G.silver+=q.revenue;G.mk[name].shipped+=qty;G.lastRev+=q.revenue;
  G.life.peak=Math.max(G.life.peak,G.silver);sfx.coin();
  return {ok:true,msg:MSG('sellGoods.3',{qty,q:fmt1(q.price),q2:fmt(q.revenue)}),revenue:q.revenue};
}

/* ---------- 新聞 ---------- */
/** 寫入新聞與跑馬燈。 */
function pushNews(t){const k=newsKey(t);if(typeof yearLogAdd==='function')yearLogAdd(t,k);G.news.unshift(k?{y:G.year,m:G.month,c:G.cycle,t,k}:{y:G.year,m:G.month,c:G.cycle,t});if(G.news.length>60)G.news.pop();G.ticker.unshift(t);if(G.ticker.length>8)G.ticker.pop()}

/* ---------- 隨機事件 ---------- */
/** 對符合條件的物品事件倍率相乘（0.5～3.2）。 */
function setEv(test,mult){Object.keys(G.mk).forEach(n=>{if(test(COMM_MAP[n]))G.mk[n].ev=clamp(G.mk[n].ev*mult,0.5,3.2)})}
/** 隨機事件表：w 權重、seasons 適用季節、f() 執行並回傳新聞文字。新增事件在此加一筆。 */
const ALL_SEASONS=['spring','summer','autumn','winter'];
const EVENTS=[
  {w:ODDS.eventW.fire,seasons:['winter','spring'],f(){setEv(c=>commTag(c,'fire'),1.8+rnd()*0.9);return NEWS('setEv.1')}},
  {w:ODDS.eventW.famine,seasons:['summer','autumn'],f(){setEv(c=>commTag(c,'grain'),1.5+rnd()*0.7);return NEWS('setEv.2')}},
  {w:ODDS.eventW.harvest,seasons:['autumn'],f(){setEv(c=>commTag(c,'grain'),0.72);return NEWS('setEv.3')}},
  {w:ODDS.eventW.typhoon,seasons:['summer','autumn'],f(){setEv(c=>commTag(c,'typhoon'),1.4+rnd()*0.4);G.ships.forEach(s=>{if(s.mode==='sea')s.eta++});return NEWS('setEv.4')}},
  {w:ODDS.eventW.plague,seasons:ALL_SEASONS,f(){setEv(c=>c.sys==='medicine',1.5+rnd()*0.5);return NEWS('setEv.5')}},
  {w:ODDS.eventW.military,seasons:ALL_SEASONS,f(){setEv(c=>commTag(c,'military'),1.4+rnd()*0.4);return NEWS('setEv.10')}},   // 軍需：銅、鐵、硫磺
  {w:ODDS.eventW.sword,seasons:ALL_SEASONS,f(){setEv(c=>c.luxury,1.25);return NEWS('setEv.6')}},
  {w:ODDS.eventW.flower,seasons:ALL_SEASONS,f(){return NEWS('setEv.7')}},
  {w:ODDS.eventW.dump,seasons:ALL_SEASONS,f(){setEv(c=>c.sys===G.sysKey,0.82);return NEWS('setEv.8')}},
  {w:ODDS.eventW.boom,seasons:ALL_SEASONS,f(){setEv(c=>c.sys===G.sysKey,1.22);return NEWS('setEv.9')}},
  {w:ODDS.eventW.inspect,seasons:ALL_SEASONS,kind:'inspect',f(){return inspection()}},
  {w:ODDS.eventW.fall,seasons:ALL_SEASONS,kind:'fall',f(){return officialFall()}},
  {w:ODDS.eventW.greed,seasons:ALL_SEASONS,kind:'greed',f(){return officialExtort()}},
  {w:ODDS.eventW.thief,seasons:ALL_SEASONS,kind:'thief',f(){return thieves()}},
  {w:ODDS.eventW.renqing,seasons:ALL_SEASONS,f(){const w=Object.values(G.rel).filter(r=>r.aff>0).length;return NEWS(w?'ev.renqing':'ev.notice')}}
];
/** 每旬 75% 機率依權重抽一個當季事件。 */
function randomEvent(log){
  if(!roll('eventRate'))return;
  const pool=EVENTS.filter(e=>e.seasons.includes(season()));
  let r=rnd()*pool.reduce((a,e)=>a+e.w,0),ev=pool[0];
  for(const e of pool){r-=e.w;if(r<=0){ev=e;break}}
  const t=ev.f();if(t)pushNews(t),log.push(t);
}
/** 事件：中央欽差突查（風聲高於 ODDS.imperial.heat 才會被罰、靠山受牽連）。 */
function inspection(){
  if(G.heat>ODDS.imperial.heat){
    const fine=Math.round(Math.max(0,G.silver)*clamp(0.05+G.heat*0.012,0.06,0.2));
    G.silver-=fine;loseFame('inspect');sfx.bad();
    const top=Object.entries(G.rel).filter(([id,r])=>npc(id)&&npc(id).role==='official').sort((a,b)=>b[1].aff-a[1].aff)[0];
    if(top){setAff(top[1],Math.max(0,top[1].aff-20));logRel(top[0],MSG('log.inspection'))}
    G.heat=Math.max(0,G.heat-3);
    return NEWS('inspection.2',{fine:fmt(fine)});
  }
  return NEWS('inspection.3');
}
/** 事件：政敵拿你和交好官員（好感 ≥30）的往來做文章，他受你牽連遭申斥：好感扣七成（可能成仇），官職不變；好感見底時可能把罪責推給你。 */
function officialFall(){
  const offs=officialsOf(G.cityId).filter(n=>R(n.cid).aff>=30);
  if(!offs.length)return NEWS('officialFall.1');
  const n=pick(offs);const r=R(n.cid);
  const loss=Math.round(r.aff*0.7);setAff(r,r.aff-(loss));                    // 受你牽連遭申斥：好感扣七成（可能因此成仇）；官職不變
  const nm=nameOf(n.cid);logRel(n.cid,MSG('log.fall',{d:loss}));
  if(r.aff<10&&roll('fallScapegoat')){                             // 好感見底：為求自保，把罪責推到你頭上
    const fine=Math.round(Math.max(0,G.silver)*0.04);G.silver-=fine;loseFame('scapegoat');
    G.life.scapegoat++;logRel(n.cid,MSG('log.scapegoat'));
    return NEWS('officialFall.2',{nm,fine:fmt(fine)});
  }
  return NEWS('officialFall.3',{nm});
}
/** 事件：官員索賄，不理會會影響交情或衍生麻煩。 */
function officialExtort(){
  const offs=officialsOf(G.cityId).filter(n=>R(n.cid).aff>=40&&CH(n.cid).derived_stats.greed_index>=55);
  if(!offs.length)return NEWS('officialExtort.1');
  const n=pick(offs);const r=R(n.cid);
  const amt=giftGoldCost(n.pos.rank);
  if(r.promises.some(p=>p.kind==='tribute'&&!p.done))return null;
  r.promises.push({kind:'tribute',text:MSG('promise.extort',{n:nameOf(n.cid),a:amt*BRIBE_RATE}),due:G.turn+3,amount:amt,done:false,by:'official'});
  logRel(n.cid,MSG('log.extort',{a:amt*BRIBE_RATE}));
  queueFaceEvent({type:'extort',cid:n.cid,amt:amt*BRIBE_RATE,due:G.turn+3});
  return NEWS('officialExtort.2',{n:nameOf(n.cid)});
}
/** 事件：盜賊潛入倉庫（保鏢可降低損失）。 */
function thieves(){
  if(guardCount()>=2&&roll('thiefRepel'))return NEWS('thieves.1');
  const loss=Math.min(invUsed(),Math.max(1,Math.round(invUsed()*0.05)));
  const keys=Object.keys(G.inv).filter(k=>G.inv[k]>0);if(!keys.length)return null;
  const k=pick(keys);const l=Math.min(G.inv[k],loss);G.inv[k]-=l;
  return NEWS('thieves.2',{k:COMM_MAP[k].short,l});
}

/* ---------- 株仲間卡特爾 ---------- */
/** 每旬結算公會：誓言守配額卻超量→斷貨；暗約偷跑→可能被查抄；遵守率隨行為變動。 */
function evalCartel(log){
  const C=G.cartel;let over=0,shippedAny=false;
  ownComms().forEach(c=>{const m=G.mk[c.name];if(m.shipped>0)shippedAny=true;const q=quotaOf(c.name),x=q>0?Math.max(0,(m.shipped-q)/q):(m.shipped>0?1:0);over=Math.max(over,x)});
  if(C.state==='pledged'){
    if(over>0){
      C.cheated++;G.life.cheats++;
      if(chance(Math.min(ODDS.cartelPledged.max,ODDS.cartelPledged.base+ODDS.cartelPledged.slope*over))){
        C.sanction=3;C.state='none';C.comp=Math.max(30,C.comp-12);loseFame('cartelPledged');sfx.bad();caughtAdd('me');const lost=guildForfeit();
        const t=NEWS('evalCartel.1',{bond:lost?NEWS('cartel.bondLost',{a:fmt(lost)}):''});pushNews(t);log.push(t);
      }else C.comp=Math.max(30,C.comp-3);
    }else if(shippedAny){C.comp=Math.min(90,C.comp+2);G.life.pledges++;addFame(0.1)}
  }else if(C.state==='secret'){
    if(over>0){
      C.cheated++;G.life.cheats++;
      if(chance(Math.min(ODDS.cartelSecret.max,ODDS.cartelSecret.base+ODDS.cartelSecret.slope*over))){
        C.sanction=3;C.state='none';C.comp=Math.max(30,C.comp-10);loseFame('cartelSecret');caughtAdd('me');const lost=guildForfeit();
        let fine=0;if(G.flags.exempt<=0){fine=Math.round(Math.max(0,G.silver)*0.06);G.silver-=fine}
        const t=NEWS('evalCartel.2',{fine:(lost?NEWS('cartel.bondLost',{a:fmt(lost)}):'')+(fine?NEWS('cartel.fine',{a:fmt(fine)}):NEWS('cartel.noFine'))});pushNews(t);log.push(t);sfx.bad();
      }else C.comp=Math.max(30,C.comp-2);
    }
  }else{C.comp+= (60-C.comp)*0.1}
  C.comp=Math.round(C.comp*10)/10;
  if(C.sanction>0)C.sanction--;
}

/* ---------- 庫存損耗、火災 ---------- */
/** 每旬庫存損耗與火災判定（易燃品多、冬季、保鏢少→機率高）。 */
function invUpkeep(log){
  const sum=season()==='summer'?1.6:1;let lost=[];
  Object.keys(G.inv).forEach(n=>{
    const c=COMM_MAP[n],q=G.inv[n];if(!q)return;
    const l=Math.min(q,Math.floor(q*c.decay*(c.staple?sum:1)*keeperMul()+rnd()));   // 手代第 5 名起減損耗
    if(l>0){G.inv[n]-=l;lost.push(c.short+'×'+l)}
  });
  if(lost.length)G.lastSpoil=UT('spoil',{l:lost.slice(0,3).join(NAMES_SEP)});else G.lastSpoil='';
  // 火災：易燃品（油、硫磺、樟腦、木、炭）
  let flam=0;Object.keys(G.inv).forEach(n=>{if(COMM_MAP[n].flam)flam+=G.inv[n]});
  if(flam>0){
    const F_=ODDS.fire,p0=F_.base*(1+flam/F_.flamDiv)*(season()==='winter'?F_.winter:1)*(1-Math.min(0.4,F_.guardCut*guardCount()))+ENEMY_FIRE*enemyCount(),p=p0*(G.flags.firebreak?0.5:1);   // 每位仇人 +2% 縱火；火除地拜領後減半
    if(chance(p)){
      const f=chance(ODDS.fire.heavyP)?ODDS.fire.heavy:ODDS.fire.light;let tot=0;
      Object.keys(G.inv).forEach(n=>{const c=COMM_MAP[n];const l=Math.floor(G.inv[n]*(c.flam?f:f*0.4));G.inv[n]-=l;tot+=l});
      G.life.fires++;sfx.bad();
      const t=NEWS('invUpkeep.1',{tot});pushNews(t);log.push(t);
      setEv(c=>commTag(c,'fire'),1.5);
    }
  }
}

/** 持有成本與風險（依貨值）：每旬按庫存貨值收倉儲保險費；貨值越高，被盜、受損或遭查扣的機率越大（保鏢可降低）。 */
function listValue(name){const c=COMM_MAP[name];return c.base*cityMod(homeCity(),c)}
function holdTick(log){
  const H=ODDS.hold;let value=0;G.holdFee=0;
  Object.keys(G.inv).forEach(n=>{if(G.inv[n]>0)value+=G.inv[n]*listValue(n)});
  const fee=Math.min(Math.max(0,G.silver),Math.round(value*H.rate*keeperMul()));   // 手代第 5 名起減倉儲保險
  if(fee>0){G.silver-=fee;G.holdFee=fee}
  Object.keys(G.inv).forEach(n=>{
    const q=G.inv[n];if(!(q>0))return;
    const p=clamp(q*listValue(n)/H.riskDiv,0,H.riskMax)*(1-Math.min(0.4,H.guardCut*guardCount()));
    if(p>0&&chance(p)){
      const l=Math.max(1,Math.floor(q*(H.lossMin+rnd()*(H.lossMax-H.lossMin))));
      G.inv[n]-=l;sfx.bad();
      const t=NEWS('holdTheft.'+(1+Math.floor(rnd()*3)),{name:COMM_MAP[n].short,l});pushNews(t);log.push(t);
    }
  });
}

/* ---------- 打毀（暴動）：主食或鹽價持續高於基準 250% 超過三旬 ---------- */
/** 主食/鹽相對基準價的倍數（打毀指標）。 */
function stapleIndex(name){
  const c=COMM_MAP[name],m=G.mk[name];
  return (c.sys===G.sysKey?priceNow(name,m.shipped):refIndex(name))/c.base;
}
/** 每旬判定：主食或鹽價 >250% 連續超過三旬→打毀。 */
function riotTick(log){
  const S=G.staple;if(S.cool>0)S.cool--;
  const idx=Math.max(...STAPLE_KEYS.map(stapleIndex));S.idx=idx;
  if(idx>2.5)S.streak++;else S.streak=0;
  if(S.streak>3&&!(S.cool>0))riot(log);
}
/** 打毀：倉庫被搶、行情回落，可能拿你當替罪羊（靠山強則逃過）。 */
function riot(log){
  const S=G.staple;S.streak=0;S.cool=6;G.life.riots++;sfx.bad();
  const gf=1-Math.min(0.4,0.12*guardCount());let tot=0;
  Object.keys(G.inv).forEach(n=>{const c=COMM_MAP[n];const l=Math.floor(G.inv[n]*(c.staple?0.5:0.25)*gf);G.inv[n]-=l;tot+=l});
  Object.keys(G.mk).forEach(n=>{if(COMM_MAP[n].staple)G.mk[n].ev=Math.max(1,G.mk[n].ev*0.7)});
  let t=NEWS('riot.1')+(tot>0?NEWS('riot.loss',{tot}):NEWS('riot.safe'));   // 搶走 0 單位時不寫損失
  const staple=G.sysKey==='grain'||G.sysKey==='marine';
  const best=Object.entries(G.rel).filter(([id])=>npc(id)&&npc(id).role==='official').reduce((a,[,r])=>Math.max(a,r.aff),0);
  const RS_=ODDS.riotScapegoat,p=clamp((staple?RS_.staple:RS_.other)-best/RS_.affDiv,RS_.min,RS_.max);
  if(chance(p)){
    const fine=Math.round(Math.max(0,G.silver)*0.25);G.silver-=fine;loseFame('riot');G.life.scapegoat++;
    t+=NEWS('riot.2',{fine:fmt(fine)});
  }else if(staple)t+=NEWS('riot.3');
  pushNews(t);log.push(t);
}

/* ---------- 同業市佔率：知名度、庫存、事件、臨時隨機波動 ---------- */
/** 本城的同行商人（市佔率計算對象）。 */
function rivalsHere(){return cityNpcs(G.cityId,'rival')}
/** 同行的市佔率內部狀態（知名度、庫存水位、臨時波動、事件），首次使用時由其能力值生成。 */
function msOf(n){
  if(!n.ms){const st=CH(n.cid).derived_stats;n.ms={fame:((0.4*(st.commerce_skill+st.integrity_loyalty)/2+0.15*st.diplomacy_charm*0.6)/0.55)*ODDS.fame.cap/100,stock:0.6+rnd()*0.7,tmp:1,ev:1,evT:0,prev:null}}
  return n.ms;
}
/** 我方庫存水位（庫存/需求×0.6，上限 1.5）。 */
function ownStockLevel(){
  const own=tradeComms();let inv=0,d=0;own.forEach(c=>{inv+=G.inv[c.name]||0;d+=(G.mk[c.name]?G.mk[c.name].D:cityD(homeCity(),c))*0.6});
  return d>0?clamp(inv/d,0,1.5):0;
}
/** 我方市佔率的事件係數：節慶↑、被斷貨↓、剛打毀↓、免檢旗微↑。 */
function myEventFactor(){
  let f=1;if(festActive())f*=1.15;if(G.cartel.sanction>0)f*=0.7;if(G.staple&&G.staple.cool>0)f*=0.85;if(G.flags&&G.flags.exempt>0)f*=1.03;
  return f;
}
/** 【市佔率】具名中盤商依知名度、庫存、臨時波動與事件分配 99.5%；未列名的零星供貨固定為 0.5% 誤差。 */
function marketShares(){
  const sc=(stock,fame,tmp,ev)=>(0.2+0.25*clamp(fame/ODDS.fame.cap,0,1)+0.25*clamp(stock/1.5,0,1))*tmp*ev;
  const rows=rivalsHere().map(n=>{const m=msOf(n);return {cid:n.cid,name:nameOf(n.cid),stock:m.stock,fame:m.fame,ev:m.ev,raided:!!n.raided,score:sc(m.stock,m.fame,m.tmp,m.ev)*(n.raided?0.4:1),prev:m.prev}});
  G.mytmp=G.mytmp||1;
  const st=ownStockLevel(),ev=myEventFactor();
  const me={me:true,name:UT('share.me'),stock:st,fame:G.fame||0,ev,score:sc(st,G.fame||0,G.mytmp,ev)};
  const otherShare=ODDS.rivalShip.otherShare,named=rows.reduce((a,r)=>a+r.score,0);
  /* 初始市佔率校準為 5%：先扣除固定的零星誤差，再求出倍率 G.mybias；之後穩定供貨會微幅調高它 */
  if(G.mybias===undefined){const target=0.05;G.mybias=me.score>0&&named>0?target*named/(1-otherShare-target)/me.score:1}
  me.score*=G.mybias;
  const known=named+me.score,scale=known>0?(1-otherShare)/known:0;
  rows.forEach(r=>r.share=r.score*scale);me.share=me.score*scale;
  return {me:me.share,rows,mine:me,others:otherShare,factor:clamp(1+3*(me.share-0.05),0.85,1.5),turn:G.turn};
}
/** 取本旬市佔率倍率；舊存檔若仍帶著舊制零星供貨比例，也立即重算。 */
function shareFactor(){if(!G.share||G.share.turn!==G.turn||G.share.others!==ODDS.rivalShip.otherShare)G.share=marketShares();return G.share.factor}
/** 每旬更新同行狀態（庫存隨機漫步、臨時波動、偶發事件與新聞）後重算市佔率。 */
function msTick(log){
  const prevRows={};if(G.share)G.share.rows.forEach(r=>prevRows[r.cid]=r.share);
  rivalsHere().forEach(n=>{
    const m=msOf(n);m.prev=prevRows[n.cid]===undefined?null:prevRows[n.cid];
    m.stock=clamp(m.stock+(0.9-m.stock)*0.15+(rnd()-0.5)*0.35,0.2,1.6);
    m.tmp=0.5*m.tmp+0.5*(0.88+rnd()*0.24);
    m.fame=clamp(m.fame+(rnd()-0.48)*2.4,10,ODDS.fame.cap*0.95);
    if(m.evT>0){m.evT--;if(m.evT<=0)m.ev=1}
    else if(!n.raided&&roll('rivalEvent')){
      const good=chance(ODDS.rivalEvent.good);m.ev=good?1.25:0.7;m.evT=3;
      if(chance(ODDS.rivalEvent.news)){const t=NEWS(good?'rival.good':'rival.bad',{n:nameOf(n.cid)});pushNews(t);log.push(t)}
    }
  });
  G.mytmp=0.5*(G.mytmp||1)+0.5*(0.88+rnd()*0.24);
  G.share=marketShares();
}

/* ---------- 商路：距離、陸海路與運量（委託採買用） ---------- */
/** 城市是否有港口/水路可通海運。 */
const canSea=ct=>ct.region_id==='reg_west'||ct.region_id==='reg_south'||ct.type==='water'||ct.type==='waterland'||cityRouteSea(ct);
/** 後天開通的海運（0.8 外港開闢寫入 G.cityRoutes[城市id].sea；目前一律沒有）。 */
const cityRouteSea=ct=>!!(G&&ct&&G.cityRoutes&&G.cityRoutes[ct.id]&&G.cityRoutes[ct.id].sea);
/** 開闢的道路（0.8 開闢道路寫入 G.openedRoads＝[地區id]；本店所在地區與這些地區陸路相通。目前一律沒有）。 */
const roadOpen=(a,b)=>!!(G&&a&&b&&a.region_id!==b.region_id&&(G.openedRoads||[]).length&&[a,b].some(x=>x.region_id===(CITY(G.cityId)||{}).region_id)&&[a,b].some(x=>(G.openedRoads||[]).includes(x.region_id)));
/* 陸路：只限陸地相連的同一地區（南海諸島是島嶼，無陸路），且行程須在 2 旬內 */
/** 陸路行程上限（旬）。 */
const LAND_MAX_TURNS=2;
/** 陸路條件：同一地區、非島嶼（南海）、行程 ≤2 旬。 */
const canLand=(a,b)=>(a.region_id===b.region_id&&a.region_id!=='reg_south'&&distTurns(a,b,'land')<=LAND_MAX_TURNS)||roadOpen(a,b);   // 開闢道路的旬數算法 0.8 再接上 distTurns
/* 地理：各地區中心座標（公里，虛構地圖）＋城市在地區內的固定偏移 */
/** 各地區中心座標（公里，虛構地圖），用來估距離。 */
const REGION_XY={reg_central:[0,0],reg_east:[330,-40],reg_west:[-320,-60],reg_south:[-520,-300],reg_north:[60,330]};
/** 城市座標＝地區中心＋固定偏移。 */
function cityXY(ct){
  const c=REGION_XY[ct.region_id]||[0,0],r=seeded('xy'+ct.id);
  return [c[0]+(r()-0.5)*220,c[1]+(r()-0.5)*220];
}
/** 兩城直線距離（公里）。 */
function distKm(a,b){const p=cityXY(a),q=cityXY(b);return Math.hypot(p[0]-q[0],p[1]-q[1])}
/* 海運：沿海岸繞行（×1.3）、每旬約 250 公里，另加一旬裝卸候風；冬季東、北方海面再慢一旬。陸路：每旬約 200 公里（×1.2 山路） */
/** 運輸旬數：海運＝ceil(距離×1.3/250)+1（冬季東北再+1，至少 2）；陸路＝ceil(距離×1.2/200)（至少 1）。 */
function distTurns(a,b,mode){
  const km=distKm(a,b);
  if(mode==='sea'){
    let d=Math.ceil(km*1.3/250)+1;
    if(season()==='winter'&&(a.region_id==='reg_north'||b.region_id==='reg_north'||a.region_id==='reg_east'||b.region_id==='reg_east'))d+=1;
    return Math.max(2,d);
  }
  return Math.max(1,Math.ceil(km*1.2/200));
}
/* 單趟運量上限：笨重的民生必需品與礦木較少，輕巧高價的奢侈品較多 */
/** 單趟運量上限（依貨物笨重/一般/輕巧）。 */
const CAP_LAND={heavy:30,normal:50,light:80},CAP_SEA={heavy:120,normal:150,light:200};
/** 貨物重量等級：奢侈品輕巧、必需品與礦木笨重、其餘一般。 */
function weightClass(name){const c=COMM_MAP[name];if(c.luxury)return 'light';if(c.staple||c.sys==='mining'||c.sys==='timber')return 'heavy';return 'normal'}
/** 某物品某運輸方式的單趟運量上限。 */
function capOf(name,mode){const w=weightClass(name);return (mode==='sea'?CAP_SEA:CAP_LAND)[w]}
/** 運輸許可：海運需該地區的進港泊位許可、陸路需本地區的關所通行手形（遠國奉行所核發）。 */
const permitOf=(mode,ct)=>mode==='sea'?(ct?seaPermitFor(ct):anySea()):landPermit();
/** 船長/飛腳的膽識與商才換算成遇險率倍數（0.7～1.3）。 */
function crewRiskMult(e){const C_=ODDS.crewRisk,s=e?statsOfEmp(e):null;return s?clamp(C_.base-s.audacity_courage*C_.perCourage-(s.commerce_skill-50)/C_.commerceDiv,C_.min,C_.max):C_.max}
/** 每旬推進委託採買：歸來時結算（07i_voyage.js 的 resolveVoyage）。 */
function shipsTick(log){
  const done=[];
  G.ships.forEach(s=>{s.eta--;if(s.eta<=0){resolveVoyage(s,log);done.push(s)}});
  G.ships=G.ships.filter(s=>!done.includes(s));
}

/* ---------- 開銷 ---------- */
/** 每旬開銷：夥計薪水、倉庫與家用；負債另計利息。 */
/** 本旬收支報告暫存（autoShip 開頭建立，upkeep/skimTick 補充，doTurn 讀取）。 */
var TURNRP=null;
function upkeep(log){
  let wages=0;G.emps.forEach(e=>wages+=e.wage);
  const fam=12+(G.family.spouse?8:0)+(G.family.conc||[]).length*8+G.family.kids.length*4;
  const cost=wages+G.wh.n*6+fam;
  G.silver-=cost;G.lastCost=cost;
  let interest=0;
  if(G.silver<0){interest=Math.round(-G.silver*0.02);G.silver-=interest}
  if(TURNRP)TURNRP.cost={wages,guards:0,wh:G.wh.n*6,fam,interest,hold:G.holdFee||0};
  if(G.flags.exempt>0)G.flags.exempt--;regionTick(log);appsTick(log);tributeTick(log);oiranTick(log);
  G.heat=Math.max(0,(G.heat||0)-0.15);
}

/* ---------- 城市節慶與百年大事 ---------- */
/** 每旬城市層級事件：節慶開幕、百年大事（城史）到期觸發。 */
function cityTick(){
  const city=homeCity();
  const was=G.festival;G.festival=festActive()?city.special_festival.name:null;
  if(G.festival&&G.festival!==was){
    const t=NEWS('cityTick.1',{name:city.name,festival:G.festival});pushNews(t);G.heat=Math.max(0,G.heat-0.5);
  }
  G.histDone=G.histDone||{};
  (city.history_100_years||[]).forEach((h,i)=>{
    const y=parseInt(h.year,10);const key=city.id+'_'+i;
    if(y===G.year&&!G.histDone[key]){
      const mon=1+Math.floor(seeded(key)()*12);
      if(mon===G.month&&G.cycle===1){
        G.histDone[key]=1;pushNews(NEWS('cityTick.2',{name:city.name,title:h.title}));
        const fx=h.fx||[];                           // 城史事件的類型（資料檔 fx：fire 火災、plague 疫病、famine 饑荒）
        if(fx.includes('fire'))setEv(c=>commTag(c,'fire'),1.6);
        if(fx.includes('plague'))setEv(c=>c.sys==='medicine',1.6);
        if(fx.includes('famine'))setEv(c=>commTag(c,'rice'),1.4);
      }
    }
  });
}

/** 每期（例會旬開始時結算上一期）依穩定供貨旬數調整本城人口：全穩定 ±2%，其餘依多數 ±0.6%。 */
function populationTick(log){
  if(!TURNRP)return;
  const O=ODDS.cityPopulation,Q=G.supplyQuarter||(G.supplyQuarter={stable:0,unstable:0,turns:0});
  if(TURNRP.supplyStable)Q.stable++;else Q.unstable++;
  Q.turns++;
  if(!isMeetingTurn())return;                     // 與例會同一期：例會旬開始時結算上一期
  const stable=Q.stable,unstable=Q.unstable;
  let rate,result;
  if(stable===Q.turns){rate=O.all;result=NEWS('pop.allStable')}
  else if(stable>unstable){rate=O.majority;result=NEWS('pop.moreStable')}
  else if(stable===0){rate=-O.all;result=NEWS('pop.allUnstable')}
  else{rate=-O.majority;result=NEWS('pop.moreUnstable')}
  const before=Number.isFinite(G.cityPopulation)?G.cityPopulation:cityPop(homeCity());
  G.cityPopulation=Math.max(O.min,Math.round(before*(1+rate)));
  G.supplyQuarter={stable:0,unstable:0,turns:0};
  TURNRP.population={before,after:G.cityPopulation,stable,unstable,rate};
  const t=NEWS('city.population',{stable,unstable,result,before:fmt(before),after:fmt(G.cityPopulation),rate:(rate>0?'+':'')+(rate*100).toFixed(1)+'%'});
  pushNews(t);log.push(t);
}

/* ---------- 旬推進 ---------- */
/** 【每旬推進的唯一入口】順序：自動出貨→自動進貨→大番頭旬末代席→記下本旬需求與出貨→日期前進→訂單到貨→公會結算→季度人口→同業市佔率→市場刷新→公會查同業與分紅→庫存損耗→商路→員工→大番頭其他事務→開銷→隨機事件→城市→打毀→人際→年度結算→破產判定→存檔。調整順序前請確認相依關係。 */
function advanceTurn(){
  syncPeaks();
  const log=[],s0=G.silver;                       // 旬初現款                       // s0：本旬開頭的現款，供『每旬盈餘』計算
  meetingAuto(log);                               // 本旬例會沒出席或沒走完：出貨之前照規則自動決議（07yb_meeting.js）
  autoShip(log);
  autoBuy(log);
  snapMarket();                                   // 日期前進前，記下本旬的需求與出貨（節慶看本旬日期）
  G.turn++;G.cycle++;let newYear=false;
  if(G.cycle>3){G.cycle=1;G.month++;if(G.month>12){G.month=1;G.year++;newYear=true}}
  G.lastRev=0;G.ap=AP_MAX;G.errandUsed=0;G.bought={};G.voyQueue=[];   // 出運清單只在本旬有效
  if((G.exile||0)>0)G.exile--;if((G.exile||0)>0)G.ap=0;        // 遠島：這旬起算剩餘旬數，期間沒有行動點數
  G.raidNote=null;
  tourTick(log);
  receiveOrders(log);
  evalCartel(log);
  meetingTick(log);                               // 例會旬：上一期違約金分配、建立本期例會（方針由投票決定）；例會前一旬提醒
  populationTick(log);                            // 九旬供貨表現改變人口；後續市場刷新立即依新人口重算需求
  msTick(log);
  refreshMarket();
  guildTick(log);                                 // 公會：查同業超賣、期滿分配違約金
  invUpkeep(log);
  holdTick(log);
  shipsTick(log);
  smugTick(log);
  dealerTick(log);
  empTick(log);
  chiefTick(log);
  upkeep(log);
  randomEvent(log);
  cityTick(log);
  syncPrices();                                   // 事件改了行情倍率之後，重算市價（與進貨價同步）
  riotTick(log);
  peopleTick(log);
  if(newYear){yearEndParty(log);yearTick(log)}                // 年底先辦忘年會（記錄上一年），再做新年結算
  if(G.silver<-3000&&!G.ended)endLife('bankrupt');
  enemyTick(log);
  officialMigrate();                              // 本旬若有官員病故、遭害或調走，旬末補上空缺
  rivalHeirTick(log);                             // 本城同業病故或遭害：旬末由私生子繼承（07y_guild.js）
  exileTick(log);
  raidTick(log);
  inspectTick(log);
  xgoodsTick(log);
  skimTick(log,s0);
  if(TURNRP){const ps=Object.values(TURNRP.publicSpend||{}).reduce((a,v)=>a+v,0);TURNRP.net=G.silver-s0-ps;TURNRP.skim=G.lastSkim||0;TURNRP.date=dateStr()}
  G.report=TURNRP;
  injuryTick(log);
  G.life.peak=Math.max(G.life.peak,G.silver);
  recordSilver();
  save();
  return log;
}
