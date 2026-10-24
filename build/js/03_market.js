'use strict';
/* ★檔案總覽：市場與時間推進
 * - 價格：priceNow＝基準價×城市係數×季節×(近九旬需求/近九旬總出貨)^α×事件；總出貨＝同業實際出貨（含隨機超賣）＋我方出貨。
 * - 買賣：buyGoods（下單、隔旬到貨、每旬上限）、sellGoods（出貨）、autoShip 在 06_ui.js。
 * - 公會：evalCartel（配額與偷跑）；riotTick（主食鹽價過高→打毀）；EVENTS 隨機事件。
 * - 同業：marketShares/msTick（本城同業市佔率）。
 * - 商路：只有委託採買（07i_voyage.js）；這裡留距離 distTurns、陸海路判定 canSea/canLand、單趟運量 capOf 與歸來推進 shipsTick。
 * - advanceTurn：每旬推進的唯一入口（順序很重要，詳見該函式註解）。 */
/* ======================= 03 市場：以量控價、株仲間、打毀、損耗、商路、旬推進 ======================= */
/** 打毀指標：白米與粗鹽。 */
const STAPLE_KEYS=['白米（精製越光米）','赤穗天然曬制粗鹽'];
/** 節慶期間需求暴增的物品關鍵字。 */
const FEST_KW=['清酒','菜籽','麻油','鯨油','棉布','錦緞','醬油','味醂'];
/** （舊）地區相鄰表；目前距離改由 REGION_XY 座標計算。 */
const REGION_ADJ={reg_central:['reg_east','reg_west','reg_north'],reg_east:['reg_central','reg_north'],reg_west:['reg_central','reg_south'],reg_south:['reg_west'],reg_north:['reg_central','reg_east']};

/** 主角駐節城市。 */
const homeCity=()=>CITY(G.cityId);
/** 某城對某物品的每旬需求量（依人口，必需品權重高、奢侈品低）。 */
function cityD(city,c){
  const w=c.staple?0.5:c.luxury?0.06:0.25,mn=c.staple?30:c.luxury?6:20;
  return Math.max(mn,Math.round(city.population/1000*w));
}
/** 城市價格係數：固定雜訊、產地便宜（×0.8）、大城偏貴（×1.08）。 */
function cityMod(city,c){
  const noise=0.92+0.16*seeded(city.id+c.name)();
  let m=noise;
  if(city.connected_commodities.includes(c.name))m*=0.8;             // 產地便宜
  else if(city.location_type==='重要行政都市')m*=1.08;               // 消費大城偏貴
  return m;
}
/** 物品目前季節係數。 */
function seasonCoef(c){return (SEASON_COEF[c.sys]||SEASON_COEF.timber)[season()]}
/** 本城今天是否正逢節慶。 */
function festActive(){
  const city=homeCity();const f=parseFestival(city.special_festival&&city.special_festival.date);
  return !!(f&&f.month===G.month&&f.cycle===G.cycle);
}
/** 節慶需求倍率：本城節慶那一旬，所有貨物需求 ×3；酒、油、布料等節慶相關貨物 ×4。 */
const festMult=c=>festActive()?(FEST_KW.some(k=>c.name.includes(k))?4:3):1;
/** 公會配額（單位/旬）＝本城需求×配額比例（初始 6%，可在公會提案 +10%）。 */
const quotaOf=name=>Math.max(1,Math.round(G.mk[name].D*G.cartel.quotaPct));

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
/** 某物品在途量（向大盤下單、尚未到貨）。 */
const itemOnOrder=name=>(G.orders||[]).filter(o=>o.name===name).reduce((a,o)=>a+o.qty,0)+G.ships.filter(s=>s.name===name).reduce((a,s)=>a+s.qty,0);
/** 某物品還能再放多少（同時受單項上限與倉庫容量限制）。 */
const itemRoom=name=>Math.max(0,Math.min(itemCap(name)-(G.inv[name]||0)-itemOnOrder(name),invCap()-invUsed()-pendingQty()-transitQty()));

/** 本旬有效需求（含節慶與市佔率係數）。 */
/** 奢侈品需求冷熱倍率：久無買家時極低，大單湧入時暴增；非奢侈品或舊存檔為 1。 */
const luxMult=(c,m)=>{if(!c.luxury||!m.lux)return 1;const L=ODDS.lux;return m.lux.ph==='dry'?L.dryMult:m.lux.ph==='burst'?m.lux.mul:1};
const demandEff=(c,m,noLux)=>m.D*festMult(c)*(c.sys===G.sysKey?shareFactor():1)*(noLux?1:luxMult(c,m));
/** 本旬同業有效供給（本業受株仲間減供）。 */
const supplyEff=(c,m)=>m.so*(c.sys===G.sysKey?1-0.22*G.cartel.comp/100:1);
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
/** 本旬同業實際出貨量：基準供給（需求×0.58）依各家知名度/庫存/事件分配，各家再乘隨機係數；本業每家每旬 5% 挑一項超賣（倍數大增）壓低行情。 */
function rivalSupply(c,m,first){
  const R=ODDS.rivalShip,base=m.D*R.base,rv=rivalsHere();
  if(!rv.length)return Math.round(base*(R.lo+rnd()*(R.hi-R.lo)));
  const sc=marketShares().rows,tot=sc.reduce((a,r)=>a+r.score,0),frac=1-R.otherShare;
  let sum=base*R.otherShare*(0.95+rnd()*0.1),big=null;
  sc.forEach(r=>{
    const w=tot>0?r.score/tot:0;let f=R.lo+rnd()*(R.hi-R.lo);
    f*=clamp(r.stock/0.9,0.5,1.3);if(r.raided)f*=0.4;
    let mul=0;
    if(c.sys===G.sysKey)mul=rivalOverMul(r,c,first);                       // 本業：每家每旬 5% 挑一項超賣（違反公會配額，見 07y_guild.js）
    else if(!first&&!r.raided&&roll('rivalShip',R.overP))mul=R.mulMin+rnd()*(R.mulMax-R.mulMin);   // 非本業（打毀指標用的主食）：照舊逐項擲
    if(mul){f*=mul;if(!big||mul>big.mul)big={cid:r.cid,mul}}
    sum+=base*frac*w*f;
  });
  if(big&&!first&&c.sys===G.sysKey&&chance(R.news)){const t=NEWS('rivalDump',{who:nameOf(big.cid),name:c.short});pushNews(t)}
  return Math.round(sum);
}
/** 重算各物品市價（本旬事件、同業變動之後），並更新價格曲線的最新一點。 */
function syncPrices(){
  Object.entries(G.mk).forEach(([name,m])=>{m.price=marketIndex(name);if(m.hist.length)m.hist[m.hist.length-1]=Math.round(m.price*10)/10});
}
/** 每旬換季刷新：需求、事件倍率回歸、他家供給、進貨壓力回落、市價與歷史曲線。 */
function refreshMarket(first){
  Object.entries(G.mk).forEach(([name,m])=>{
    const c=COMM_MAP[name];
    if(!first){m.past=(m.past||pastOf(m)).concat([{d:demandEff(c,m),so:supplyEff(c,m),my:m.shipped}]).slice(-(ODDS.rivalShip.win-1))}
    else m.past=[];
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
/** 大盤進貨單價＝市價（現貨，不計奢侈品冷熱）×進貨係數（入會 0.93、未入會 1），遇公會斷貨×1.4，再乘進貨壓力。 */
function unitBuyCost(name){
  const m=G.mk[name];
  let p=marketIndex(name,true)*empBuyMult();
  if(G.cartel.sanction>0)p*=1.4;                                       // 聯合斷貨
  if(!guildMember())p/=ODDS.rivalShip.buyMult;                          // 未入會：照市價（入會者享公會價）
  p*=(m.press||1);                                                     // 進貨推高大盤價
  return p;
}
/** 試算出貨：總出貨量、市價、員工加成後的入帳。 */
function quoteSale(name,qty){
  const m=G.mk[name];const tot=m.shipped+qty;
  const p=priceNow(name,tot);const mult=empMult();
  return {price:p,tot,mult,revenue:Math.round(qty*p*mult),perUnit:p*mult};
}
/** 每旬向大盤進貨上限＝公會配額×倍數（基本 0.8，番頭加成；委託採買不受限）。 */
const buyLimit=name=>Math.max(1,Math.ceil(quotaOf(name)*buyLimitMult()));             // 每旬大盤進貨上限＝公會配額×(0.8＋番頭加成)，無條件進位（大番頭也算一名番頭）
/** 本旬還能向大盤進多少。 */
const buyLeft=name=>Math.max(0,buyLimit(name)-((G.bought&&G.bought[name])||0));
/** 已下單、下一旬才到貨的總量。 */
const pendingQty=()=>(G.orders||[]).reduce((a,o)=>a+o.qty,0);
/** 向大盤『下單』：檢查每旬上限/庫存上限/倉庫容量/現款；先付款、下一旬到貨；進貨量會推高進貨價（上限 1.3 倍）。 */
function buyGoods(name,qty,manual){
  qty=Math.floor(qty);if(qty<=0)return {ok:false,msg:MSG('buyGoods.1')};
  if(!tradeOK(name))return {ok:false,msg:tradeLockMsg(name)};
  if(!G.orders)G.orders=[];
  if(invUsed()+pendingQty()+transitQty()+qty>invCap())return {ok:false,msg:MSG('buyGoods.2',{invUsed:invUsed(),transitQty:(pendingQty()+transitQty()),invCap:invCap()})};
  if(qty>itemRoom(name))return {ok:false,msg:MSG('buyGoods.3',{name:COMM_MAP[name].short,capMult:fmt1(capMult(name)),itemCap:itemCap(name),itemRoom:itemRoom(name)})};
  const mk=G.mk[name];
  if(qty>buyLeft(name))return {ok:false,msg:MSG('buyGoods.4',{name:COMM_MAP[name].short,buyLimit:buyLimit(name),buyLeft:buyLeft(name),mult:fmt1(buyLimitMult())})};
  const cost=Math.round(unitBuyCost(name)*qty);
  if(G.silver<cost)return {ok:false,msg:MSG('buyGoods.5',{cost:fmt(cost)})};
  G.silver-=cost;if(manual)notePublicSpend('大盤進貨：'+COMM_MAP[name].short,cost);sfx.coin();addFame(0.05);
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
  if(G.orders&&G.orders.length){const t=NEWS('receiveOrders.1',{items:G.arrived.map(a=>COMM_MAP[a.name].short+' ×'+a.qty+(a.lost?'（倉滿退回 '+a.lost+'）':'')).join('、')});log.push(t);pushNews(t)}
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
function pushNews(t){if(typeof yearLogAdd==='function')yearLogAdd(t);G.news.unshift({y:G.year,m:G.month,c:G.cycle,t});if(G.news.length>60)G.news.pop();G.ticker.unshift(t);if(G.ticker.length>8)G.ticker.pop()}

/* ---------- 隨機事件 ---------- */
/** 對符合條件的物品事件倍率相乘（0.5～3.2）。 */
function setEv(test,mult){Object.keys(G.mk).forEach(n=>{if(test(COMM_MAP[n]))G.mk[n].ev=clamp(G.mk[n].ev*mult,0.5,3.2)})}
/** 隨機事件表：w 權重、seasons 適用季節、f() 執行並回傳新聞文字。新增事件在此加一筆。 */
const EVENTS=[
  {w:ODDS.eventW.fire,seasons:['冬','春'],f(){setEv(c=>c.name.includes('吉野')||c.name.includes('白炭'),1.8+rnd()*0.9);return NEWS('setEv.1')}},
  {w:ODDS.eventW.famine,seasons:['夏','秋'],f(){setEv(c=>c.name.includes('白米')||c.name.includes('大麥'),1.5+rnd()*0.7);return NEWS('setEv.2')}},
  {w:ODDS.eventW.harvest,seasons:['秋'],f(){setEv(c=>c.name.includes('白米')||c.name.includes('大麥'),0.72);return NEWS('setEv.3')}},
  {w:ODDS.eventW.typhoon,seasons:['夏','秋'],f(){setEv(c=>c.name.includes('鹽')||c.name.includes('鮮魚'),1.4+rnd()*0.4);G.ships.forEach(s=>{if(s.mode==='sea')s.eta++});return NEWS('setEv.4')}},
  {w:ODDS.eventW.plague,seasons:['春','夏','秋','冬'],f(){setEv(c=>c.sys==='medicine',1.5+rnd()*0.5);return NEWS('setEv.5')}},
  {w:ODDS.eventW.sword,seasons:['春','夏','秋','冬'],f(){setEv(c=>c.luxury,1.25);return NEWS('setEv.6')}},
  {w:ODDS.eventW.flower,seasons:['春','夏','秋','冬'],f(){return NEWS('setEv.7')}},
  {w:ODDS.eventW.dump,seasons:['春','夏','秋','冬'],f(){setEv(c=>c.sys===G.sysKey,0.82);return NEWS('setEv.8')}},
  {w:ODDS.eventW.boom,seasons:['春','夏','秋','冬'],f(){setEv(c=>c.sys===G.sysKey,1.22);return NEWS('setEv.9')}},
  {w:ODDS.eventW.inspect,seasons:['春','夏','秋','冬'],kind:'inspect',f(){return inspection()}},
  {w:ODDS.eventW.fall,seasons:['春','夏','秋','冬'],kind:'fall',f(){return officialFall()}},
  {w:ODDS.eventW.greed,seasons:['春','夏','秋','冬'],kind:'greed',f(){return officialExtort()}},
  {w:ODDS.eventW.thief,seasons:['春','夏','秋','冬'],kind:'thief',f(){return thieves()}},
  {w:ODDS.eventW.renqing,seasons:['春','夏','秋','冬'],f(){const w=Object.values(G.rel).filter(r=>r.aff>0).length;return w?'📜【人情】你的名帖在城中已有人記得，往來之人對商號多有好評。':'📜【公文】町奉行所發出告示，重申商人須守株牌專營之規。'}}
];
/** 每旬 75% 機率依權重抽一個當季事件。 */
function randomEvent(log){
  if(!roll('eventRate'))return;
  const pool=EVENTS.filter(e=>e.seasons.includes(season()));
  let r=rnd()*pool.reduce((a,e)=>a+e.w,0),ev=pool[0];
  for(const e of pool){r-=e.w;if(r<=0){ev=e;break}}
  const t=ev.f();if(t)pushNews(t),log.push(t);
}
/** 事件：中央欽差突查（黑帳 heat 高會被罰、靠山受牽連）。 */
function inspection(){
  if(G.heat>3){
    const fine=Math.round(Math.max(0,G.silver)*clamp(0.05+G.heat*0.012,0.06,0.2));
    G.silver-=fine;loseFame('inspect');sfx.bad();
    const top=Object.entries(G.rel).filter(([id,r])=>npc(id)&&npc(id).role==='official').sort((a,b)=>b[1].aff-a[1].aff)[0];
    if(top){top[1].aff=Math.max(0,top[1].aff-20);logRel(top[0],'中央巡按突查，因黑帳牽連，彼此交情受損。')}
    G.heat=Math.max(0,G.heat-3);
    return NEWS('inspection.2',{fine:fmt(fine)});
  }
  return NEWS('inspection.3');
}
/** 事件：官員失勢，由遞補者接任，原有交情歸零。 */
function officialFall(){
  const offs=officialsOf(G.cityId).filter(n=>R(n.cid).aff>=30);
  if(!offs.length)return NEWS('officialFall.1');
  const n=pick(offs);const r=R(n.cid);
  const loss=Math.round(r.aff*0.7);r.aff-=loss;r.bond&&(r.bond.label=r.bond.label);
  const nm=nameOf(n.cid);logRel(n.cid,'因政爭失勢遭免職，交情盡失。');
  if(r.aff<10&&roll('fallScapegoat')){
    const fine=Math.round(Math.max(0,G.silver)*0.04);G.silver-=fine;loseFame('scapegoat');
    G.life.scapegoat++;
    const rep=replaceOfficial(n);if(rep){addKnown(rep)}delete G.world.npcs[n.cid];
    return NEWS('officialFall.2',{nm,fine:fmt(fine),rep:(rep?'後任為「'+nameOf(rep)+'」。':'')});
  }
  const rep=replaceOfficial(n);if(rep){addKnown(rep)}delete G.world.npcs[n.cid];
  return NEWS('officialFall.3',{nm,rep:(rep?'後任為「'+nameOf(rep)+'」。':'')});
}
/** 事件：官員索賄，不理會會影響交情或衍生麻煩。 */
function officialExtort(){
  const offs=officialsOf(G.cityId).filter(n=>R(n.cid).aff>=40&&CH(n.cid).derived_stats.greed_index>=55);
  if(!offs.length)return NEWS('officialExtort.1');
  const n=pick(offs);const r=R(n.cid);
  const amt=giftGoldCost(n.pos.rank);
  if(r.promises.some(p=>p.kind==='tribute'&&!p.done))return null;
  r.promises.push({kind:'tribute',text:'「'+nameOf(n.cid)+'」胃口漸大，暗示三旬內需進獻現款 '+amt*BRIBE_RATE+' 兩',due:G.turn+3,amount:amt,done:false,by:'官方'});
  logRel(n.cid,'暗示需再進獻現款 '+amt*BRIBE_RATE+' 兩，限三旬內。');
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
  ownComms().forEach(c=>{const m=G.mk[c.name];if(m.shipped>0)shippedAny=true;const q=quotaOf(c.name);over=Math.max(over,Math.max(0,(m.shipped-q)/q))});
  if(C.state==='pledged'){
    if(over>0){
      C.cheated++;G.life.cheats++;
      if(chance(Math.min(ODDS.cartelPledged.max,ODDS.cartelPledged.base+ODDS.cartelPledged.slope*over))){
        C.sanction=3;C.state='none';C.comp=Math.max(30,C.comp-12);loseFame('cartelPledged');sfx.bad();const lost=guildForfeit();
        const t=NEWS('evalCartel.1',{bond:lost?'擔保金 '+fmt(lost)+' 兩沒收，':''});pushNews(t);log.push(t);
      }else C.comp=Math.max(30,C.comp-3);
    }else if(shippedAny){C.comp=Math.min(90,C.comp+2);G.life.pledges++;addFame(0.1)}
  }else if(C.state==='secret'){
    if(over>0){
      C.cheated++;G.life.cheats++;
      if(chance(Math.min(ODDS.cartelSecret.max,ODDS.cartelSecret.base+ODDS.cartelSecret.slope*over))){
        C.sanction=3;C.state='none';C.comp=Math.max(30,C.comp-10);loseFame('cartelSecret');const lost=guildForfeit();
        let fine=0;if(G.flags.exempt<=0){fine=Math.round(Math.max(0,G.silver)*0.06);G.silver-=fine}
        const t=NEWS('evalCartel.2',{fine:(lost?'擔保金 '+fmt(lost)+' 兩沒收，':'')+(fine?'官府查抄罰銀 '+fmt(fine)+' 兩，':'靠司法人脈壓下了查抄，')});pushNews(t);log.push(t);sfx.bad();
      }else C.comp=Math.max(30,C.comp-2);
    }
  }else{C.comp+= (60-C.comp)*0.1}
  C.comp=Math.round(C.comp*10)/10;
  if(C.sanction>0)C.sanction--;
}

/* ---------- 庫存損耗、火災 ---------- */
/** 每旬庫存損耗與火災判定（易燃品多、冬季、保鏢少→機率高）。 */
function invUpkeep(log){
  const sum=season()==='夏'?1.6:1;let lost=[];
  Object.keys(G.inv).forEach(n=>{
    const c=COMM_MAP[n],q=G.inv[n];if(!q)return;
    const l=Math.min(q,Math.floor(q*c.decay*(c.staple?sum:1)+rnd()));
    if(l>0){G.inv[n]-=l;lost.push(c.short+'×'+l)}
  });
  if(lost.length)G.lastSpoil='損耗：'+lost.slice(0,3).join('、');else G.lastSpoil='';
  // 火災：易燃品（油、硫磺、樟腦、木、炭）
  let flam=0;Object.keys(G.inv).forEach(n=>{if(COMM_MAP[n].flam)flam+=G.inv[n]});
  if(flam>0){
    const F_=ODDS.fire,p=F_.base*(1+flam/F_.flamDiv)*(season()==='冬'?F_.winter:1)*(1-Math.min(0.4,F_.guardCut*guardCount()))+ENEMY_FIRE*enemyCount();   // 每位仇人 +2% 縱火
    if(chance(p)){
      const f=chance(ODDS.fire.heavyP)?ODDS.fire.heavy:ODDS.fire.light;let tot=0;
      Object.keys(G.inv).forEach(n=>{const c=COMM_MAP[n];const l=Math.floor(G.inv[n]*(c.flam?f:f*0.4));G.inv[n]-=l;tot+=l});
      G.life.fires++;sfx.bad();
      const t=NEWS('invUpkeep.1',{tot});pushNews(t);log.push(t);
      setEv(c=>c.name.includes('吉野')||c.name.includes('白炭'),1.5);
    }
  }
}

/** 持有成本與風險（依貨值）：每旬按庫存貨值收倉儲保險費；貨值越高，被盜、受損或遭查扣的機率越大（保鏢可降低）。 */
function listValue(name){const c=COMM_MAP[name];return c.base*cityMod(homeCity(),c)}
function holdTick(log){
  const H=ODDS.hold;let value=0;G.holdFee=0;
  Object.keys(G.inv).forEach(n=>{if(G.inv[n]>0)value+=G.inv[n]*listValue(n)});
  const fee=Math.min(Math.max(0,G.silver),Math.round(value*H.rate));
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
  let t=NEWS('riot.1',{tot});
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
  const me={me:true,name:'你的商號',stock:st,fame:G.fame||0,ev,score:sc(st,G.fame||0,G.mytmp,ev)};
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
      if(chance(ODDS.rivalEvent.news)){const t=good?'🏪【同業】「'+nameOf(n.cid)+'」新貨滿載入港，聲勢大振，搶下不少客源。':'🏪【同業】「'+nameOf(n.cid)+'」商號遭遇糾紛（失火或延誤），客源流失。';pushNews(t);log.push(t)}
    }
  });
  G.mytmp=0.5*(G.mytmp||1)+0.5*(0.88+rnd()*0.24);
  G.share=marketShares();
}

/* ---------- 商路：距離、陸海路與運量（委託採買用） ---------- */
/** 城市是否有港口/水路可通海運。 */
const canSea=ct=>ct.region_id==='reg_west'||ct.region_id==='reg_south'||/水/.test(ct.location_type);
/* 陸路：只限陸地相連的同一地區（南海諸島是島嶼，無陸路），且行程須在 2 旬內 */
/** 陸路行程上限（旬）。 */
const LAND_MAX_TURNS=2;
/** 陸路條件：同一地區、非島嶼（南海）、行程 ≤2 旬。 */
const canLand=(a,b)=>a.region_id===b.region_id&&a.region_id!=='reg_south'&&distTurns(a,b,'land')<=LAND_MAX_TURNS;
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
    if(season()==='冬'&&(a.region_id==='reg_north'||b.region_id==='reg_north'||a.region_id==='reg_east'||b.region_id==='reg_east'))d+=1;
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
/** 商路在途貨物總量。 */
const transitQty=()=>G.ships.reduce((a,s)=>a+s.qty,0);
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
        if(/火/.test(h.title))setEv(c=>c.name.includes('吉野')||c.name.includes('白炭'),1.6);
        if(/疫|霍亂/.test(h.title))setEv(c=>c.sys==='medicine',1.6);
        if(/米|饑|荒/.test(h.title))setEv(c=>c.name.includes('白米'),1.4);
      }
    }
  });
}

/* ---------- 旬推進 ---------- */
/** 【每旬推進的唯一入口】順序：自動出貨→自動進貨→大番頭旬末代席→日期前進→訂單到貨→公會結算→同業市佔率→市場刷新→公會查同業與分紅→庫存損耗→商路→員工→大番頭其他事務→開銷→隨機事件→城市→打毀→人際→年度結算→破產判定→存檔。調整順序前請確認相依關係。 */
function advanceTurn(){
  syncPeaks();
  const log=[],s0=G.silver;                       // 旬初現款                       // s0：本旬開頭的現款，供『每旬盈餘』計算
  autoShip(log);
  autoBuy(log);
  chiefGuildTick(log);                            // 玩家整旬未出席例會，才由大番頭於旬末代席
  G.turn++;G.cycle++;let newYear=false;
  if(G.cycle>3){G.cycle=1;G.month++;if(G.month>12){G.month=1;G.year++;newYear=true}}
  G.lastRev=0;G.ap=AP_MAX;G.errandUsed=0;G.bought={};
  if((G.exile||0)>0)G.exile--;if((G.exile||0)>0)G.ap=0;        // 遠島：這旬起算剩餘旬數，期間沒有行動點數
  G.raidNote=null;
  tourTick(log);
  receiveOrders(log);
  evalCartel(log);
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
  officialMigrate();                              // 本旬若有官員病故、失勢、遭害或調走，旬末補上空缺
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
