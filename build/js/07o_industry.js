/* ═════ [07zzy_sake] ═════ */
'use strict';
/* ★檔案總覽：酒問屋（DESIGN_NOTES 第三百零一節）
 * - 本業三樣：清酒（prod_0801，西道產）、燒酎（prod_0802，東海道產，易燃）、珍陀酒（prod_0803，奢侈品，全國沒有產地）。
 *   清酒、燒酎帶 normal 標籤：單價過百仍算一般品（01_core.js 的 COMM）。三項以下只鎖最貴的一項（07t_permits.js 的 lockedTrade）。
 * - 私運珍陀酒上架：有珍陀酒的交易許可後，走私平安入港的私運珍陀酒直接進本業庫存成為珍陀酒（入港被扣照舊）；密庫裡現有的私運珍陀酒每旬自動搬上架（放得下的部分）。
 *   沒有許可時照舊進密庫；酒問屋平常不能把酒賣給闇商人（含私運珍陀酒），只有禁酒令期間可以。
 * - 跟闇商人收私運珍陀酒：好感 60 以上、打勝後的請託，每次 1～2 箱，照牌價五成付現款，三旬一次（G.sake.buyT）。
 * - 禁酒令（G.sakeBan={from,until}）：秋天凶作事件後一定機率頒布，十八旬。期間本城清酒不准在市面賣（你和同業都不能出、相場不能進），
 *   行情凍結、不算穩定供貨、不算人口的滿足比例；掛賣、注文、貴人訂貨照常。好感 60 以上的闇商人收各種酒，付私房錢（牌價一倍半），加風聲，算違禁交易（私梟落網可能供出你）。
 * - 掛點：03_market.js（quotaOf、rivalSupply、snapMarket、refreshMarket、buyLimit、sellGoods、advanceTurn 的 sakeTick）、06_ui.js（supplyLine、planOf、停賣鈕位置的禁令說明）。
 * - 數值 ODDS.sake；文字 sake.*（01e、01f、01g）。 */
const SK=()=>ODDS.sake;
const SAKE_SEI='prod_0801',SAKE_WINE='prod_0803';
const SAKE_ALL=['prod_0801','prod_0802','prod_0803'];
/** 是不是酒問屋。 */
const sakeOn=()=>!!(G&&G.sysKey==='sake');
/** 禁酒令期間。 */
const sakeBanNow=()=>!!(G&&G.sakeBan&&G.sakeBan.until>=G.turn);
/** 這項貨正被禁酒令禁售（只有酒問屋的清酒）。 */
const sakeBanned=name=>name===SAKE_SEI&&sakeOn()&&sakeBanNow();
/** 禁酒令還剩幾旬。 */
const sakeBanLeft=()=>sakeBanNow()?G.sakeBan.until-G.turn+1:0;
/** 私運珍陀酒算不算正貨：酒問屋、已取得珍陀酒的交易許可。 */
const wineLegal=()=>(sakeOn()&&tradeOK(SAKE_WINE))||goyoHas(SAKE_WINE);   // 選上珍陀酒當御用品也算（第三百三十四節）
const sakeState=()=>G.sake||(G.sake={});

/** 密庫裡的私運珍陀酒搬上架（放得下的部分）；回傳搬了幾箱。 */
function wineShelve(log){
  if(!wineLegal())return 0;
  const C=contra(),have=C.wine||0;if(have<=0)return 0;
  const q=Math.min(have,itemRoom(SAKE_WINE));if(q<=0)return 0;
  C.wine=have-q;if(C.wine<=0)delete C.wine;
  addStock(SAKE_WINE,q,SMUG_BY.wine.cost);stockAdd(SAKE_WINE,q,false);
  const t=NEWS('sake.shelve',{q});pushNews(t);if(log)log.push(t);
  return q;
}
/** 每旬：禁酒令的頒布消息與解除、私運珍陀酒上架。 */
function sakeTick(log){
  if(!sakeOn())return;
  const S=sakeState();
  if(G.sakeBan&&G.sakeBan.news){delete G.sakeBan.news;const t=NEWS('sake.banStart',{c:homeCity().name,t:G.sakeBan.until-G.turn+1});pushNews(t);log.push(t)}
  if(G.sakeBan&&G.sakeBan.until<G.turn){G.sakeBan=null;const t=NEWS('sake.banEnd',{c:homeCity().name});pushNews(t);log.push(t)}
  wineShelve(log);
}
/* ---------- 凶作後頒布禁酒令 ---------- */
{const E=EVENTS.find(e=>e.k==='famine');if(E){const f0=E.f;E.f=function(){
  const t=f0.apply(this,arguments);
  if(sakeOn()&&!sakeBanNow()&&chance(SK().banP))G.sakeBan={from:G.turn,until:G.turn+SK().banTurns-1,news:true};   // 頒布消息在 sakeTick 出（同一旬）
  return t;
}}}
/* ---------- 走私私運珍陀酒入港後上架 ---------- */
{const _s=smugTick;smugTick=function(log){const r=_s.apply(this,arguments);wineShelve(log);return r}}

/* ---------- 闇商人：收私運珍陀酒、禁酒令期間的黑市 ---------- */
const sakeBuyReady=()=>{const S=sakeState();return S.buyT===undefined||G.turn-S.buyT>=SK().buyCd};
{const _r=dealerReqs;dealerReqs=function(cid){
  let L=_r.apply(this,arguments);const n=npc(cid);
  if(!sakeOn()||!n||n.role!=='smuggler'||!dealReady(cid))return L;
  const ban=sakeBanNow(),C=contra(),others=Object.keys(C).filter(k=>k!=='wine'&&C[k]>0);
  if(!ban){                                         // 平常：酒不賣給闇商人
    L=L.filter(x=>x.k!=='cs_wine');
    if(L.some(x=>x.k==='cs_wait')&&!others.length)L=L.filter(x=>x.k!=='cs_wait').concat([{k:'sk_no',info:true,name:UT('sake.noSell'),desc:UT('sake.noSell.d')}]);
  }else{                                            // 禁酒令：密庫的私運珍陀酒照收，不必等節慶災情
    if(!others.length)L=L.filter(x=>x.k!=='cs_wait');
    if((C.wine||0)>0&&!L.some(x=>x.k==='cs_wine'))L.push({k:'sk_cw',name:UT('deal.dealerReqs.9',{a:SMUG_BY.wine.name,b:C.wine}),desc:UT('deal.dealerReqs.10',{a:smugMood('wine'),b:fmt(Math.round(smugPrice('wine',C.wine)*C.wine)),c:fmt1(smugPrice('wine',C.wine))})});
  }
  const aff=R(cid).aff||0;if(aff<SK().buyAff)return L;
  if(wineLegal()&&sakeBuyReady())L.push({k:'sk_buy',name:UT('sake.buy'),desc:UT('sake.buy.d',{a:SK().buyQty[0],b:SK().buyQty[1],p:fmt1(marketQuote(SAKE_WINE,true)*SK().buyPrice)})});
  if(ban)SAKE_ALL.forEach(nm=>{const q=kakeFree(nm);if(q>0&&tradeOK(nm))L.push({k:'sk_bm_'+nm,name:UT('sake.bm',{g:COMM_MAP[nm].short}),desc:UT('sake.bm.d',{a:Math.min(q,SK().bmQty[0]),b:Math.min(q,SK().bmQty[1]),p:fmt1(marketQuote(nm)*SK().bmPrice)})})});
  return L;
}}
{const _d=dealerDo;dealerDo=function(cid,k){
  if(!k||!String(k).startsWith('sk_')||!sakeOn())return _d.apply(this,arguments);
  const r=R(cid),nm=nameOf(cid),P=SK();
  const done=log=>{setAff(r,Math.max(0,r.aff-REQ_AFF.normal));r.dealT=G.turn;logRel(cid,log)};
  if(k==='sk_no')return UT('sake.noSell.d');
  if(k==='sk_buy'){
    if(!wineLegal()||!sakeBuyReady())return UT('sake.buy.no');
    const room=itemRoom(SAKE_WINE),q=Math.min(room,rint(P.buyQty[0],P.buyQty[1]));if(q<=0)return UT('sake.buy.room');
    const unit=Math.round(marketQuote(SAKE_WINE,true)*P.buyPrice*10)/10,cost=Math.round(unit*q);
    if(G.silver<cost)return MSG('buyGoods.5',{cost:fmt(cost)});
    payPublic('spend.buy|'+SAKE_WINE,cost);addStock(SAKE_WINE,q,unit);stockAdd(SAKE_WINE,q,false);sakeState().buyT=G.turn;
    done(UT('sake.buy.log',{q,c:REQ_AFF.normal}));coinFx();
    return UT('sake.buy.ok',{n:nm,q,a:fmt(cost),c:REQ_AFF.normal});
  }
  if(k==='sk_cw'){
    if(!sakeBanNow())return UT('sake.noSell.d');
    const q=contra().wine||0;if(q<=0)return UT('deal.dealerDo.12');
    const net=Math.round(smugPrice('wine',q)*q);delete contra().wine;G.gold+=net;G.life.smuggled=(G.life.smuggled||0)+net;r.smugT=G.turn;
    done(UT('deal.dealerDo.13',{a:SMUG_BY.wine.name,b:q,c:REQ_AFF.normal}));coinFx();
    return UT('deal.dealerDo.14',{a:nm,b:SMUG_BY.wine.name,c:q,d:fmt(net),e:REQ_AFF.normal});
  }
  if(k.startsWith('sk_bm_')){
    const g=k.slice(6);if(!sakeBanNow()||!SAKE_ALL.includes(g))return UT('sake.noSell.d');
    const q=Math.min(kakeFree(g),rint(P.bmQty[0],P.bmQty[1]));if(q<=0)return UT('deal.dealerDo.12');
    const gold=Math.round(q*marketQuote(g)*P.bmPrice);stockTake(g,q,false);G.gold+=gold;G.life.smuggled=(G.life.smuggled||0)+gold;
    addHeat(P.bmHeat);r.smugT=G.turn;                // 算違禁交易：私梟落網時可能供出你（07x_dealers.js 的 dealerTick）
    done(UT('sake.bm.log',{g:COMM_MAP[g].short,q,c:REQ_AFF.normal}));coinFx();
    return UT('sake.bm.ok',{n:nm,g:COMM_MAP[g].short,q,a:fmt(gold),c:REQ_AFF.normal});
  }
  return _d.apply(this,arguments);
}}

/* ═════ [07zzz_pickle] ═════ */
'use strict';
/* ★檔案總覽：醬漬問屋與齋戒（DESIGN_NOTES 第三百零二節）
 * - 醬漬問屋（pickle，野田屋）與魚屋共用開局牌上的一個位子；選了醬漬問屋，這一局全國的魚貨產地一對一換成醬漬貨（G.prodSwap，02_world.js 的 cityRaw），沒有魚屋的貨；
 *   其餘行業的局照舊有魚貨、沒有醬漬貨。打毀指標：醬漬問屋的局是白米與味噌（03_market.js 的 riotKeys）。
 * - 齋戒（G.fast={y,start,told,on}）：只在醬漬問屋的局。每年三成機率，挑一個月（至少兩個月後）；開始前三旬旬報先有風聲；為期一個月（三旬）。
 *   期間味噌、醃菜、梅干需求兩倍，醬油、味醂一倍半（fastMult，接在 demandEff）；同業照平常出貨，所以市面缺貨。季度人口只看平常需求，不受影響。
 *   風聲傳出時，加開一段只訂八丁味噌的貴人訂貨（ptState().seasons 的 k:'fast'，交貨在齋戒第一旬）。
 * - 每旬 pickleTick（advanceTurn 的 kokushoTick 之後）。數值 ODDS.fast；文字 fast.*（01g）、mk.fast、pt.when.fast（01e）。 */
const FS=()=>ODDS.fast;
const HATCHO='prod_0907';
/** 齋戒進行中。 */
const fastNow=()=>!!(G&&G.fast&&G.fast.start<=G.turn&&G.turn<G.fast.start+FS().turns);
/** 齋戒的需求倍數（只有醬漬貨）。 */
const fastMult=c=>c&&c.sys==='pickle'&&fastNow()?(FS().mult[c.name]||1):1;
/** 每旬：排今年的齋戒、放風聲、開始與結束。 */
function pickleTick(log){
  if(!G||G.sysKey!=='pickle')return;
  const P=FS(),put=k=>{const t=NEWS(k);pushNews(t);log.push(t)};
  if(G.fastY!==G.year){                            // 每年一次：今年要不要齋戒、哪個月（至少兩個月後，風聲才來得及）
    G.fastY=G.year;
    const from=G.month+2,months=[];for(let m=from;m<=12;m++)months.push(m);
    if(!(G.fast&&G.fast.start+P.turns>G.turn)&&months.length&&chance(P.p)){const m=pick(months);G.fast={y:G.year,start:ptTurnOf(G.year,m,1),told:false,on:false}}
  }
  const F=G.fast;if(!F)return;
  if(!F.told&&G.turn>=F.start-P.lead){
    F.told=true;put('fast.rumor');
    const S=ptState();if(!S.seasons.some(x=>x.k==='fast'&&x.due===F.start+1))S.seasons.push({k:'fast',y:G.year,due:F.start+1,from:G.turn,to:F.start-1,big:false,asked:{}});   // 齋戒前的八丁味噌訂單
  }
  if(!F.on&&fastNow()){F.on=true;put('fast.start')}
  if(G.turn>=F.start+P.turns){G.fast=null;put('fast.end')}
}
/* ---------- 齋戒前的貴人訂貨：只訂八丁味噌 ---------- */
{const _o=ptOffer;ptOffer=function(cid,S){
  if(!S||S.k!=='fast')return _o.apply(this,arguments);
  const P=PT();if(!ptGoods().some(c=>c.name===HATCHO))return null;
  const c=COMM_MAP[HATCHO],t=ptTier(cid),r=P.qty[t];if(!r)return null;
  const q=rint(r[0],r[1]),unit=Math.round(c.base*(P.price[0]+rnd()*(P.price[1]-P.price[0]))*10)/10;
  return {cid,name:c.name,qty:q,unit,due:S.due,k:'fast',big:false};
}}

/* ═════ [07zzzz_dapan] ═════ */
'use strict';
/* =====================================================================
 * 大盤制裁（DESIGN_NOTES 第三百二十八節；取代第一百八十六節）
 *  - 判定（開局滿兩年起，ODDS.dapan.after）：市佔 ≥ 25%、連續九旬穩定出貨（協議成員那一旬還要有貨超過配額）
 *    → 大盤問屋上門「敲打」（旬報後來訪，答應或婉拒）。奢侈品、許可緩衝、禁酒令的清酒不判；專賣株期間這一旬跳過。
 *  - 敲打一季：答應＝每旬出貨收在穩定供貨線八成以內（成員取配額與八成較低者），這一季不判供貨不穩，守住季末送謝禮、冷卻一年；
 *    婉拒或沒守住：季末條件仍成立（市佔 ≥ 25% 且各旬穩定）進入停貨一，否則冷卻一年。
 *  - 停貨一、停貨二各一季：大盤不賣你貨（相場進貨 0），同業調貨不開，菓子折不能出價，不接新合約；
 *    停貨二另封本地區委託採買一季、相鄰地區一個月。季末條件仍成立：停貨一→大商（名望至少三階）→停貨二→豪商（至少四階）→永久停貨。
 *    季末不成立：制裁結束、冷卻一年。收手（連續三旬出貨在八成以內）、例會加入協議付和解金、公儀調停都能解除（豪商之後不能）。
 *  - 永久停貨：每季例會旬旬報勸你搬走；遷居到新城一切重來。名號跟著人走，木戶黃門查抄時拿掉。
 *  狀態：G.dapan{st,n,acc,kept,gift,all,calm,streak,cool,blk}；名號 G.dpTitle（1 大商、2 豪商）。數值 ODDS.dapan、COSTS.dapan*；文字 dp.*。
 * ===================================================================== */
const DPO=()=>ODDS.dapan;
const dpS=()=>G.dapan||(G.dapan={st:null,n:0,streak:0,cool:0});
const dpSt=()=>(G&&G.dapan&&G.dapan.st)||null;
/** 大盤不賣你貨（停貨一、停貨二、永久停貨）。 */
const dpStop=()=>{const s=dpSt();return s==='stop1'||s==='stop2'||s==='perm'};
/** 能和解、能公儀調停的停貨（豪商之後不能）。 */
const dpSettleable=()=>{const s=dpSt();return s==='stop1'||s==='stop2'};
/** 大盤制裁期間（敲打起到永久停貨）：不能參選公會長（07yc_gm.js 的 gmBarred）。 */
function dapanSanctioned(){return !!dpSt()}
const dpLeft=()=>Math.max(0,DPO().turns-((G.dapan&&G.dapan.n)||0));
/** 停貨二的大口買付：這個地區此刻被封住。 */
function dpBlocked(rid){const B=G&&G.dapan&&G.dapan.blk;if(!B)return false;return (rid===B.home&&G.turn<=B.until)||(B.adj.includes(rid)&&G.turn<=B.adjUntil)}
const dpSettleKey=()=>dpSt()==='stop2'?'dapanSettle2':'dapanSettle1';
const dpKogiKey=()=>dpSt()==='stop2'?'dapanKogi2':'dapanKogi1';
/** 制裁結束：冷卻一年，之後從敲打重新判定。 */
function dpEnd(){const D=dpS();D.st=null;D.n=0;D.calm=0;D.streak=0;D.blk=null;D.cool=G.turn+DPO().cool}
function dpStart(st,log){
  const D=dpS(),P=DPO(),put=t=>{pushNews(t);log.push(t)};
  D.st=st;D.n=0;D.all=true;D.calm=0;
  if(st==='stop1')put(NEWS('dp.stop1',{a:fmt(costOf('dapanSettle1'))}));
  else{
    const home=homeCity().region_id,adj=(P.adj[home]||[]).filter(r=>REG_LIST.some(x=>x.id===r));
    const t1=G.turn+1,c1=G.cycle%3+1;                 // 停貨從下一旬開始；相鄰地區封到那一旬所在的月底
    D.blk={home,until:G.turn+P.turns,adj,adjUntil:t1+(3-c1)};
    put(NEWS('dp.stop2',{r:REG_NAME(home),adj:adj.map(r=>'【'+REG_NAME(r)+'】').join(''),a:fmt(costOf('dapanSettle2'))}));
  }
}
function dpHist(key){const ct=homeCity();G.cityHist=G.cityHist||{};(G.cityHist[ct.id]=G.cityHist[ct.id]||[]).push({year:G.year,title:NEWS(key,{f:G.firm})})}
/** 每次推進的出貨之後（autoShip 外層）：累計判定、各段計數與季末結算。 */
function dpEval(log){
  if(!G||G.ended)return;
  const D=dpS(),P=DPO(),put=t=>{pushNews(t);log.push(t)};
  if(D.st==='perm')return;
  const mem=guildMember(),sv=n=>(G.mk[n]&&G.mk[n].shipped)||0;
  const L=tradeComms().filter(c=>!c.luxury&&!tradeGrace(c.name)&&supplyLine(c.name)>0);
  const judged=L.length>0&&!monoNow();             // 專賣株期間這一旬不算（不累計也不歸零）
  const R_=TURNRP||{},stable=judged&&!(R_.short&&R_.short.length)&&!(R_.squeeze&&R_.squeeze.length);
  let lineV=0,shipV=0,capV=0;L.forEach(c=>{const l=supplyLine(c.name);lineV+=c.base*l;shipV+=c.base*sv(c.name);capV+=c.base*(mem?Math.min(quotaOf(c.name),P.cap*l):P.cap*l)});
  const sh=(G.share&&G.share.me)||0;
  if(!D.st){
    if(G.turn<P.after||G.turn<(D.cool||0)){D.streak=0;return}
    if(!judged)return;
    const over=!mem||L.some(c=>sv(c.name)>quotaOf(c.name));
    D.streak=sh>=P.share&&stable&&over?(D.streak||0)+1:0;
    if(D.streak>=P.streak){
      Object.assign(D,{st:'knock',n:0,acc:false,kept:true,gift:0,all:true,streak:0});
      queueFaceEvent({type:'dapanKnock',turn:G.turn});put(NEWS('dp.knock'));
    }
    return;
  }
  D.n++;
  if(judged&&!stable)D.all=false;
  if(D.st==='knock'){
    if(D.acc&&judged){
      if(shipV>capV+1e-6)D.kept=false;
      if(D.kept)D.gift+=P.gift*L.reduce((a,c)=>a+P.cut*supplyLine(c.name)*marketQuote(c.name),0);
      if(R_.fame<0){setFame((G.fame||0)-R_.fame);R_.fame=0}   // 答應了：這一季不算供貨不穩
      delete R_.short;delete R_.squeeze;R_.supplyStable=true;
    }
    if(D.n<P.turns)return;
    if(D.acc&&D.kept){const g=Math.round(D.gift);G.silver+=g;put(NEWS('dp.knockOk',{a:fmt(g)}));sfx.coin();dpEnd();return}
    if(sh>=P.share&&D.all){dpStart('stop1',log);return}
    put(NEWS('dp.knockEnd'));dpEnd();return;
  }
  // 停貨一、停貨二
  if(judged)D.calm=shipV<=P.cap*lineV+1e-6?(D.calm||0)+1:0;
  if(D.calm>=P.calm){put(NEWS('dp.calm'));dpEnd();return}
  if(D.n<P.turns)return;
  if(!(sh>=P.share&&D.all)){put(NEWS('dp.fail'));dpEnd();return}
  if(D.st==='stop1'){
    if((G.dpTitle||0)<1){G.dpTitle=1;dpHist('dp.bigHist');titleGain('big')}
    put(NEWS('dp.big',{f:G.firm}));dpStart('stop2',log);
  }else{
    if((G.dpTitle||0)<2){G.dpTitle=2;dpHist('dp.gouHist');titleGain('gou')}
    D.st='perm';D.n=0;put(NEWS('dp.gou',{f:G.firm}));
  }
}
{const _a=autoShip;autoShip=function(log){const r=_a.apply(this,arguments);dpEval(log);return r}}
/** 日期前進之後（advanceTurn）：永久停貨時，每季例會旬勸你搬走。 */
function dapanTick(log){if(dpSt()==='perm'&&isMeetingTurn()){const t=NEWS('dp.nudge');pushNews(t);log.push(t)}}

/* ---------- 停貨：相場進不了貨、同業不肯調貨、菓子折標不得、不接新合約 ---------- */
{const _m=maxBuy;maxBuy=function(){return dpStop()?0:_m.apply(this,arguments)}}
{const _b=buyGoods;buyGoods=function(){if(dpStop())return {ok:false,msg:MSG('dp.noBuy')};return _b.apply(this,arguments)}}
{const _d=dealerReqs;dealerReqs=function(cid){const n=npc(cid);if(n&&n.role==='rival'&&dpStop()&&dealReady(cid))return [{k:'rv_dapan',info:true,name:UT('dp.rvOff'),desc:UT('dp.rvOff.d')}];return _d.apply(this,arguments)}}
{const _d=dealerDo;dealerDo=function(cid,k){if(dpStop()&&typeof k==='string'&&k.startsWith('rv_'))return MSG('dp.noDeal');return _d.apply(this,arguments)}}
{const _b=meetBidBlock;meetBidBlock=function(){return dpStop()?UT('dp.noBid'):_b.apply(this,arguments)}}
{const _k=kakeOffer;kakeOffer=function(){return dpStop()?null:_k.apply(this,arguments)}}
{const _k=kakeTick;kakeTick=function(){const r=_k.apply(this,arguments);if(dpStop()&&G.kakeMarks)G.kakeMarks.ids=[];return r}}
{const _p=ptOffer;ptOffer=function(){return dpStop()?null:_p.apply(this,arguments)}}
{const _g=govSmallOffer;govSmallOffer=function(){return dpStop()?null:_g.apply(this,arguments)}}
{const _g=govWarOffer;govWarOffer=function(){return dpStop()?null:_g.apply(this,arguments)}}
{const f=REG_FAVORS.find(x=>x.k==='rhonjin');if(f){const _a=f.avail;f.avail=n=>!dpStop()&&(!_a||_a(n))}}
{const _s=specialList;specialList=function(){const L=_s.apply(this,arguments);return dpStop()?L.filter(x=>x.special!=='tribute'):L}}

/* ---------- 停貨二：委託採買封住本地區與相鄰地區 ---------- */
{const _d=destList;destList=function(){const L=_d.apply(this,arguments);return Array.isArray(L)?L.map(x=>x&&x.ct&&dpBlocked(x.ct.region_id)?Object.assign({},x,{blocked:true}):x):L}}
{const _s=sendVoyage;sendVoyage=function(captId,budget,destId){const ct=CITY(destId);if(ct&&dpBlocked(ct.region_id))return {ok:false,msg:MSG('dp.voyBlock',{r:REG_NAME(ct.region_id)})};return _s.apply(this,arguments)}}
{const _v=ACT.vAdd;ACT.vAdd=function(){const R_=UI.s.route,ct=R_&&CITY(R_.dest);if(ct&&dpBlocked(ct.region_id)){toast(MSG('dp.voyBlock',{r:REG_NAME(ct.region_id)}),4200);return}return _v.apply(this,arguments)}}
{const _v=ACT.vDest;ACT.vDest=function(el){const ct=CITY(el.dataset.id);if(ct&&dpBlocked(ct.region_id))return;return _v.apply(this,arguments)}}

/* ---------- 名號：大商至少三階、豪商至少四階 ---------- */
{const _f=fameTier;fameTier=function(){const t=_f();const T=G?G.dpTitle||0:0;return T>=2?Math.max(t,4):T>=1?Math.max(t,3):t}}
{const _k=komonPunish;komonPunish=function(){const r=_k.apply(this,arguments);G.dpTitle=0;return r}}   // 木戶黃門拿掉名號（永久停貨照舊）
{const _m=moveDepart;moveDepart=function(){const r=_m.apply(this,arguments);G.dapan=null;return r}}   // 遷居：新城的大盤從頭判定

/* ---------- 敲打：大盤問屋來訪（旬報後） ---------- */
FACE_TITLE.dapanKnock='dp.knock.t';
{const _f=faceEventCard;faceEventCard=function(e){
  if(!e||e.type!=='dapanKnock')return _f.apply(this,arguments);
  const D=G.dapan;if(!D||D.st!=='knock'||D.n>0||D.acc)return null;
  const pt='<div style="float:left;width:56px;height:56px;font-size:40px;line-height:56px;text-align:center;margin-right:6px">🏯</div>';
  const buttons='<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="dpAccept">'+UT('btn.dpAccept')+'</button><button class="pixel-btn btn-sm" data-act="faceNext">'+UT('btn.dpRefuse')+'</button></div>';
  return '<div class="card warn" style="display:flow-root">'+pt+'<div><b style="font-size:17px">'+esc(UT('dp.who'))+'</b> <span class="tag gray">'+UT('face.faceEventCard.12',{a:esc(UT('dp.tag')),b:esc(UT('dp.knock.line')),c:esc(UT('dp.knock.eff'))})+'</div>'+buttons+'</div>';
}}
ACT.dpAccept=()=>{const D=G.dapan;if(D&&D.st==='knock'&&D.n===0){D.acc=true;toast(MSG('dp.accept'),4200);save()}UI.hideInfo()};

/* ---------- 和解：例會加入協議（或重申守約）付和解金 ---------- */
function dpSettle(join){
  const C=G.cartel,k=dpSettleKey(),a=costOf(k);
  if(!afford(k)){toast(MSG('dp.short',{a:fmt(a)}));return false}
  if(!C.paid){if(!spendAP())return false;C.paid=true}
  spend(k);
  if(join){C.state='pledged';C.bond=a;C.comp=Math.min(90,(C.comp||0)+3)}else C.bond=(C.bond||0)+a;   // 和解金全額記為訂約金：之後違約被查獲整筆沒收
  dpEnd();const t=NEWS('dp.settleN');pushNews(t);
  toast(MSG('dp.settle',{a:fmt(a)}),4200);sfx.coin();UI.render();refreshSheet();return true;
}
{const _c=ACT.cartel;ACT.cartel=function(el){
  if(el&&el.dataset.s==='pledged'&&dpSettleable()&&!guildMember()){UI.s.quitArm=false;dpSettle(true);return}
  return _c.apply(this,arguments);
}}
ACT.dpSettle=()=>{const M=meetNow();if(!M||!M.att||!dpSettleable()||!guildMember())return;dpSettle(false)};
{const _g=SHEETS.guild;SHEETS.guild=function(){
  const o=_g.apply(this,arguments),M=meetNow();
  if(o&&M&&M.att&&M.step===1&&dpSettleable()){
    const c=costTxt(dpSettleKey());
    const add=guildMember()?'<div class="notice tiny">'+UT('dp.settleNoteMem',{c})+'</div><button class="pixel-btn btn-gold" style="width:100%;margin-bottom:4px" data-act="dpSettle">'+UT('btn.dpSettle')+'</button>'
      :'<div class="notice tiny">'+UT('dp.settleNote',{c})+'</div>';
    o.html=o.html.replace('</div>',"</div>"+add);   // 放在步驟列之後
  }
  return o;
}}

/* ---------- 公儀調停：吟味方六階 御目付（第二百零四節），停貨一、二期間 ---------- */
FAVORS.judiciary.push(favorText({k:'kogi',rank:6,exactRank:true,cd:12,drop:20,avail:()=>dpSettleable()}));
{const _chk=regFavorCheck;regFavorCheck=function(f,n){if(f&&f.k==='kogi'){if(!dpSettleable())return MSG('dp.noDeal');if(!afford(dpKogiKey()))return MSG('dp.short',{a:fmt(costOf(dpKogiKey()))})}return _chk.apply(this,arguments)}}
REG_FAVOR.kogi=()=>{const k=dpKogiKey(),a=costOf(k);spend(k);dpEnd();pushNews(NEWS('dp.kogiN'));return MSG('dp.kogi',{a:fmt(a)})};

/* ---------- 相場頂端的提示 ---------- */
{const _r=renderMarket;renderMarket=function(){
  _r.apply(this,arguments);
  const s=dpSt();if(!s)return;const D=G.dapan;
  const t=s==='perm'?UT('dp.mk.perm'):s==='knock'?UT(D.acc?'dp.mk.knockAcc':'dp.mk.knock',{n:dpLeft()}):UT('dp.mk.stop',{n:dpLeft()});
  const v=$('#view-market');if(v)v.insertAdjacentHTML('afterbegin','<div class="notice" style="margin-bottom:6px">'+esc(t)+'</div>');
}}

/* ═════ [07zzzzz_bekke] ═════ */
'use strict';
/* =====================================================================
 * 別家（DESIGN_NOTES 第三百二十節、第三百二十八節第十段、第三百三十一節）
 *  - 開店：好感 100 的大番頭「吩咐差事」裡的「出去開別家」。要先有大商名號（沒有就不出現）；市佔 30%、大番頭任職滿一年、現款三萬兩，
 *    名冊出身的大番頭才行；開店資金一萬兩。大番頭離開，成為本城同業「本家屋號·別家」，好感鎖 100（繼承人也是）。
 *  - 市佔：你和別家合起來照原本的算法算（別家不算一般同業），再分成你三分之二、別家三分之一；穩定供貨線與相場進貨上限照合起來的算。
 *    別家是空殼：不進貨、不出貨（rivalSupply 跳過），你出不夠全城就缺。
 *  - 協議身份永遠跟你相反（G.bekke.inG）：你在協議內，超過配額算別家的、不判違約；你在協議外，別家在協議裡，你向大盤進貨九六折（聯合斷貨時沒有），
 *    例會旬別家來問這期怎麼投。換邊：開張時、你在例會上加入或退出時立刻換；被查獲違約後要等下一次例會。
 *  - 公會長改選：別家是投票人時來問要投給誰（你是候選人就預設投你）。菓子折別家不出價。
 *  - 往來：拜訪跳過交涉直接開請託；調貨（不看協議，加一成）、收他行貨（照最好的成數抽一成）；不扣好感，冷卻照一般三旬。
 *  - 名單排除：闕所、暗殺、放火、栽贓打壓、株札暫扣、同業事件、挖角、御用金攤派、督促分攤（他那一份算你）。
 *  - 開了別家，大盤停止一切制裁、不再判定。遷居後一切重來（舊別家留在舊城）。
 *  狀態 G.bekke{cid,city,inG,t,vote,elect}。數值 ODDS.bekke、COSTS.bekkeOpen；文字 bk.*。
 * ===================================================================== */
const BKO=()=>ODDS.bekke;
function isBekke(x){const B=G&&G.bekke;if(!B||B.city!==G.cityId)return false;const c=typeof x==='string'?x:x&&x.cid;return !!c&&c===B.cid}
const bekkeOn=()=>!!(G&&G.bekke&&G.bekke.city===G.cityId&&npc(G.bekke.cid)&&alive(G.bekke.cid));
/** 別家的市佔＝你的一半（你與別家合起來的三分之一）。 */
const bekkeShare=()=>bekkeOn()?((G.share&&G.share.me)||0)/2:0;
const bekkeFirm=()=>UT('bk.firm',{f:(SYS_BY_KEY[G.sysKey]||{}).firm||G.firm});

/* ---------- 市佔：別家不當一般同業算，合起來再分 ---------- */
let BK_HIDE=false;
{const _r=rivalsHere;rivalsHere=function(){const L=_r.apply(this,arguments);return BK_HIDE?L.filter(n=>!isBekke(n)):L}}
{const _m=marketShares;marketShares=function(){
  if(!bekkeOn())return _m.apply(this,arguments);
  BK_HIDE=true;let S;try{S=_m.apply(this,arguments)}finally{BK_HIDE=false}
  const tot=S.me||0,me=tot*2/3;
  S.me=me;if(S.mine)S.mine.share=me;
  S.rows.push({cid:G.bekke.cid,name:bekkeFirm(),stock:1,fame:0,ev:1,raided:false,score:0,share:tot/3,prev:null,bekke:true});
  S.factor=clamp(1+3*(me-0.05),0.85,1.5);
  return S;
}}
{const _s=suspBonus;suspBonus=function(){return _s.apply(this,arguments)+bekkeShare()}}   // 穩定供貨線、相場進貨上限都加上別家那一份

/* ---------- 協議：一進一出 ---------- */
{const _u=unitBuyCost;unitBuyCost=function(name){const p=_u.apply(this,arguments);return bekkeOn()&&G.bekke.inG&&!guildMember()&&!(G.cartel.sanction>0)?Math.max(p*BKO().disc,marketFloor(name)):p}}
{const _e=evalCartel;evalCartel=function(log){
  if(bekkeOn()&&!G.bekke.inG&&guildMember()){const Q=G.shipQuota||(G.shipQuota={});ownComms().forEach(c=>{Q[c.name]=1e9})}   // 超過配額的算別家名下出的
  return _e.apply(this,arguments);
}}
{const _c=ACT.cartel;ACT.cartel=function(el){const r=_c.apply(this,arguments);if(bekkeOn())G.bekke.inG=!guildMember();return r}}
{const _t=meetingTick;meetingTick=function(log){
  const r=_t.apply(this,arguments);
  const M=meetNow(),B=G.bekke;
  if(bekkeOn()&&M&&M.mt===G.turn&&!M.bkAsked){
    M.bkAsked=true;B.inG=!guildMember();B.vote=null;B.elect=null;
    if(B.inG&&!meetEasyYear())queueFaceEvent({type:'bekkeVote',cid:B.cid,turn:G.turn});
    const E=M.el;
    if(E&&!E.done&&(E.voters||[]).includes(B.cid)){if(E.cands.includes('me'))E.votes[B.cid]='me';queueFaceEvent({type:'bekkeElect',cid:B.cid,turn:G.turn})}
  }
  return r;
}}
FACE_TITLE.bekkeVote='bk.vote.t';FACE_TITLE.bekkeElect='bk.vote.t';
FACE_EXT.bekkeVote=e=>{
  if(!bekkeOn()||!G.bekke.inG||e.cid!==G.bekke.cid)return null;const M=meetNow();if(!M||M.voted)return null;
  return {line:UT('bk.vote.line'),effect:UT('bk.vote.eff'),buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-green" data-act="bkVote" data-v="normal">'+UT('btn.bkVoteN')+'</button><button class="pixel-btn btn-sm btn-red" data-act="bkVote" data-v="restrict">'+UT('btn.bkVoteR')+'</button></div>'};
};
ACT.bkVote=el=>{if(bekkeOn()){G.bekke.vote=el.dataset.v==='restrict'?'restrict':'normal';toast(MSG('bk.voteOk',{v:policyName(G.bekke.vote)}))}UI.hideInfo()};
FACE_EXT.bekkeElect=e=>{
  const M=meetNow(),E=M&&M.el;if(!bekkeOn()||!E||E.done||e.cid!==G.bekke.cid)return null;
  return {line:UT('bk.elect.line'),effect:UT('bk.elect.eff'),buttons:'<div class="grid2">'+E.cands.map(k=>'<button class="pixel-btn btn-sm btn-gold" data-act="bkElect" data-k="'+esc(k)+'">'+esc(UT('btn.bkElect',{n:gmName(k)}))+'</button>').join('')+'</div>'};
};
ACT.bkElect=el=>{
  const M=meetNow(),E=M&&M.el,k=el.dataset.k;
  if(bekkeOn()&&E&&!E.done&&E.cands.includes(k)){G.bekke.elect=k;E.votes[G.bekke.cid]=k;toast(MSG('bk.electOk',{n:gmName(k)}))}
  UI.hideInfo();
};
{const _p=gmRivalPick;gmRivalPick=function(v,A,B){
  if(isBekke(v)){const k=G.bekke.elect;if(k&&(k===A||k===B))return k;if(A==='me'||B==='me')return 'me'}
  return _p.apply(this,arguments);
}}

/* ---------- 往來：拜訪跳過交涉、調貨、收他行貨 ---------- */
let BK_VISIT=false;
{const _v=ACT.visit;ACT.visit=function(el){BK_VISIT=!!(el&&isBekke(el.dataset.cid)&&el.dataset.err!=='1');return _v.apply(this,arguments)}}
{const _b=battleStart;battleStart=function(cid){
  if(BK_VISIT&&isBekke(cid)){
    BK_VISIT=false;BT=null;musicWant('market');logRel(cid,UT('bk.greet'));
    if(reqList(cid).length)UI.showInfo(UT('bt.battleEnd.7',{a:nameOf(cid)}),requestHtml(cid,UT('bk.greet')));
    else toast(UT('bk.greet')+UT('bk.none'),3600);
    UI.render();refreshSheet();return;
  }
  BK_VISIT=false;return _b.apply(this,arguments);
}}
/** 別家收他行貨：照好感最高時的成數，量大照常打折，別家抽一成。 */
function bekkeXQuote(name,q){const c=COMM_MAP[name];if(!c)return 0;const m=clamp(0.42+0.30*trustFactor(100),0.35,0.9);return Math.round(c.base*m*(1-Math.min(0.25,0.002*q))*q*BKO().xCut)}
{const _d=dealerReqs;dealerReqs=function(cid){
  if(!isBekke(cid))return _d.apply(this,arguments);
  if(!dealReady(cid))return [];
  const out=[],L=rivalLot(cid);
  if(L)out.push({k:'bkv_'+L.n,name:UT('bk.rv',{a:L.c.short,b:L.q}),desc:UT('bk.rv.d',{c:fmt(Math.round(L.cost*BKO().rvMark))})});
  Object.keys(G.xinv||{}).filter(k=>G.xinv[k]>0&&COMM_MAP[k]).forEach(k=>{const q=G.xinv[k];out.push({k:'bkx_'+k,name:UT('bk.x',{a:xName(k),b:q}),desc:UT('bk.x.d',{c:fmt(bekkeXQuote(k,q))})})});
  return out;
}}
{const _d=dealerDo;dealerDo=function(cid,k){
  if(!isBekke(cid)||typeof k!=='string')return _d.apply(this,arguments);
  const r=R(cid);
  if(k.startsWith('bkv_')){
    const L=rivalLot(cid);if(!L||L.n!==k.slice(4))return UT('deal.dealerDo');
    const cost=Math.round(L.cost*BKO().rvMark);if(G.silver<cost)return MSG('dp.short',{a:fmt(cost)});
    G.silver-=cost;addStock(L.n,L.q,cost/L.q);stockAdd(L.n,L.q,false);r.dealT=G.turn;
    const m=MSG('bk.rvOk',{a:L.c.short,b:L.q,c:fmt(cost)});logRel(cid,m);coinFx();return m;
  }
  if(k.startsWith('bkx_')){
    const name=k.slice(4),q=(G.xinv||{})[name]||0;if(q<=0)return MSG('bk.gone');
    const v=bekkeXQuote(name,q);G.silver+=v;delete G.xinv[name];r.dealT=G.turn;
    const m=MSG('bk.xOk',{a:xName(name),b:q,c:fmt(v)});logRel(cid,m);coinFx();return m;
  }
  return _d.apply(this,arguments);
}}
{const _h=rivalEventHook;rivalEventHook=function(n){return isBekke(n)?null:_h.apply(this,arguments)}}
/** 別家過世：繼承人接手，好感照樣鎖 100。 */
{const _h=rivalHeirTick;rivalHeirTick=function(log){
  const B=G.bekke,old=B&&B.city===G.cityId?npc(B.cid):null;
  const r=_h.apply(this,arguments);
  if(old&&old.heir&&B.cid===old.cid&&npc(old.heir)){
    B.cid=old.heir;const rr=R(old.heir);rr.met=true;rr.seen=true;rr.bond=Object.assign({},rr.bond||{mult:1},{label:bekkeFirm(),introId:null});rr.lockAff=true;setAff(rr,100);addKnown(old.heir);
    const t=NEWS('bk.heir',{b:bekkeFirm(),n:nameOf(old.heir)});pushNews(t);log.push(t);
  }
  return r;
}}

/* ---------- 大盤：有了別家就不再過問 ---------- */
{const _e=dpEval;dpEval=function(){if(bekkeOn())return;return _e.apply(this,arguments)}}
{const _t=dapanTick;dapanTick=function(){if(bekkeOn())return;return _t.apply(this,arguments)}}
{const _m=moveDepart;moveDepart=function(){const r=_m.apply(this,arguments);G.bekke=null;return r}}   // 遷居：舊別家留在舊城（好感 100 照舊，照第二百六十四節成為外城友人），新城可以再開

/* ---------- 開店：大番頭的心腹指令 ---------- */
function bekkeLack(e){
  const O=BKO(),L=[];
  if(((G.share&&G.share.me)||0)<O.share)L.push(UT('bk.need.share'));
  if(chiefTenure(e)<O.tenure)L.push(UT('bk.need.tenure'));
  if(G.silver<O.cash)L.push(UT('bk.need.cash',{a:fmt(O.cash)}));
  return L;
}
function bekkeHtml(e){
  if(!e||e.rank!=='chief'||!(G.dpTitle>=1)||bekkeOn())return '';   // 沒有大商名號：還沒想到這一招
  const L=bekkeLack(e);
  return UT('bk.cmd',{f:esc(bekkeFirm()),c:costTxt('bekkeOpen')})+(L.length?'<div class="tiny" style="color:#b3261e;margin-top:2px">'+esc(UT('bk.lack',{a:L.join(NAMES_SEP)}))+'</div>':'')
    +'<button class="pixel-btn btn-sm btn-gold" style="width:100%;margin-top:4px" data-act="bekkeOpen" data-id="'+e.id+'" '+(L.length?'disabled':'')+'>'+UT('btn.bekkeOpen')+'</button></div>';
}
{const _o=scOrders;scOrders=function(e){const h=_o.apply(this,arguments);return e&&e.rank==='chief'&&empAff(e)>=100?h+bekkeHtml(e):h}}
ACT.bekkeOpen=el=>{
  const e=G.emps.find(x=>x.id===el.dataset.id);if(!e||e.rank!=='chief'||empAff(e)<100||!(G.dpTitle>=1)||bekkeOn())return;
  if(bekkeLack(e).length){toast(MSG('bk.cant'));return}
  spend('bekkeOpen');
  if(!e.cid)kidLeave(e);                            // 自家栽培的大番頭：用他的人物紀錄（07zzzzzz_kidrec）
  const cid=e.cid||e.pid,n=npc(cid)||(G.world.npcs[cid]={cid,cityId:G.cityId,role:'rival',pos:null});
  G.emps=G.emps.filter(x=>x!==e);
  n.role='rival';n.cityId=G.cityId;n.hired=false;n.pos=null;delete n.raided;delete n.suspUntil;delete n.ms;delete n.heir;
  const r=R(cid);r.met=true;r.seen=true;r.bond=Object.assign({},r.bond||{mult:1},{label:bekkeFirm(),introId:null});r.lockAff=true;setAff(r,100);addKnown(cid);
  if(G.introId===cid)G.introId=null;
  G.bekke={cid,city:G.cityId,inG:!guildMember(),t:G.turn,vote:null,elect:null};
  if(G.dapan&&G.dapan.st){G.dapan.st=null;G.dapan.blk=null;pushNews(NEWS('bk.dapan'))}   // 大盤停止一切（第三百二十八節第十段）
  G.share=marketShares();
  const ct=homeCity();G.cityHist=G.cityHist||{};(G.cityHist[ct.id]=G.cityHist[ct.id]||[]).push({year:G.year,title:NEWS('bk.hist',{f:G.firm,b:bekkeFirm()})});
  pushNews(NEWS('bk.open',{n:e.name,f:bekkeFirm()}));
  toast(MSG('bk.open',{n:e.name,f:bekkeFirm()}),4200);sfx.coin();UI.hideInfo();UI.render();refreshSheet();
};


/* ═════ [07zzzzzz_kidrec] ═════ */
'use strict';
/* =====================================================================
 * 自家栽培店員的人物紀錄（DESIGN_NOTES 第三百三十二節）
 *  - 無名冊的店員（丁稚、三獻茶帶回的孩子）一進店就補一份人物紀錄 G.kidChars[pid]（pid＝'kid_'＋員工代號），員工記 e.pid。
 *    讀檔與開局後放進人物表 CHAR_MAP（名冊 CHARS 本身不動，不會被挑去補人；新開一局清掉上一局的）。
 *  - 只在開別家時用到：大番頭出去開別家，就用這份紀錄當他的人物身分（能力照他當下的數值寫進去）。
 *    其他規則不變：能力照舊讀員工紀錄、照舊成長；辭退、潛逃照舊消失。
 *  - 升遷時記一筆大事記；頭像沿用員工的外貌種子。
 * ===================================================================== */
const kidRecs=()=>G.kidChars||(G.kidChars={});
function kidMs(c,title,ev){c.milestones=c.milestones||[];c.milestones.push({year:yearStr(G.year),age:UT('kid.age',{a:Math.max(0,G.year-c.birth_year)}),title,event:ev})}
/** 取得（沒有就建立）某位無名冊店員的人物紀錄。 */
function kidRec(e){
  if(!G||!e||e.cid)return null;
  const R_=kidRecs();if(e.pid&&R_[e.pid])return R_[e.pid];
  const id='kid_'+e.id,rd=seeded(id),src=CHARS[Math.floor(rd()*CHARS.length)],b=e.age0!==undefined?e.age0:G.year-12,firm=(SYS_BY_KEY[G.sysKey]||{}).firm||G.firm;
  const c={id,kid:true,seed:e.id,name:e.name,gender:'m',primary_trait:src.primary_trait,secondary_trait:src.secondary_trait,weakness:src.weakness,native_region:homeCity().region_id,
    family_summary:UT('kid.summary',{a:Math.max(8,G.year-b),f:firm}),milestones:[],birth_year:b,death_year:b+55+Math.floor(rd()*25),derived_stats:Object.assign({},e.stats||{}),roles:[]};
  kidMs(c,UT('kid.ms.in'),UT('kid.ms.inEv',{f:firm}));
  R_[id]=c;CHAR_MAP[id]=c;e.pid=id;return c;
}
/** 人物表與存檔同步：清掉上一局留下的，補上這一局的；沒有紀錄的無名冊店員補上；已不在店也不在名冊上的刪掉。 */
function kidSync(){
  Object.keys(CHAR_MAP).forEach(k=>{if(k.startsWith('kid_'))delete CHAR_MAP[k]});
  if(!G)return;
  const R_=kidRecs(),keep=new Set();
  (G.emps||[]).forEach(e=>{if(!e.cid){const c=kidRec(e);if(c)keep.add(c.id)}});
  Object.keys(R_).forEach(k=>{if(G.world&&G.world.npcs&&G.world.npcs[k])keep.add(k)});
  Object.keys(R_).forEach(k=>{if(keep.has(k))CHAR_MAP[k]=R_[k];else delete R_[k]});
}
{const _h=hireEmp;hireEmp=function(cid){const e=_h.apply(this,arguments);if(e&&!e.cid)kidRec(e);return e}}
{const _n=newGame;newGame=function(){const r=_n.apply(this,arguments);kidSync();return r}}
{const _m=migrateSave;migrateSave=function(){const r=_m.apply(this,arguments);kidSync();return r}}
{const _p=promoteEmp;promoteEmp=function(id){const r=_p.apply(this,arguments);const e=r&&r.ok&&G.emps.find(x=>x.id===id);if(e&&!e.cid){const c=kidRec(e);if(c)kidMs(c,UT('kid.ms.up',{k:rankName(e.rank)}),UT('kid.ms.upEv',{f:(SYS_BY_KEY[G.sysKey]||{}).firm||G.firm,k:rankName(e.rank)}))}return r}}
/** 出去開別家：把當下的能力與年紀寫進紀錄，之後照名冊人物的規則走。 */
function kidLeave(e){
  const c=kidRec(e);if(!c)return null;
  c.derived_stats=Object.assign({},statsOfEmp(e));if(e.age0!==undefined)c.birth_year=e.age0;c.roles=['rival'];
  kidMs(c,UT('kid.ms.bk'),UT('kid.ms.bkEv',{b:bekkeFirm()}));CHAR_MAP[c.id]=c;return c;
}
/** 頭像：沿用店員時的外貌種子。 */
{const _p=portraitHtml;portraitHtml=function(cid,px,opt){
  const c=CH(cid);if(!c||!c.kid)return _p.apply(this,arguments);
  const blush=opt&&opt.blush||0,gray=opt&&opt.gray;
  const n=npc(cid),age=Math.max(14,ageOf(cid)),role=n?n.role:'guest',key=['edo3kid',cid,Math.floor(age/8),role].join('|')+(blush?'|b'+blush:'');
  const url=PT_CACHE[key]||(PT_CACHE[key]=ptDraw({seed:c.seed,gender:'m',age,role,rank:0,st:c.derived_stats,blush}));
  const size=px||48;return '<img class="pt" src="'+url+'" width="'+size+'" height="'+size+'" alt="" aria-hidden="true"'+(gray?' style="filter:grayscale(1);opacity:.7"':'')+'>';
}}


/* ═════ [07zzzzzzz_kenjo] ═════ */
'use strict';
/* =====================================================================
 * 帝都獻上（DESIGN_NOTES 第三百一十九節、第三百三十三節；第一期，御用品另做）
 *  - 知名度第一次到 150（ODDS.kenjo.fame）記下；之後本城普請方六階官員來城時上門發佈（旬報後來訪）。永久有效、不限時、不會失敗。
 *  - 清單：這一局存在的每個行業一組（互斥的只算本局有的那一行），每組＝那一行的全部奢侈品，每項 1 件。
 *    算數的貨：本業庫存（扣掉合約保留）、他行貨、密庫裡的珍陀酒。
 *  - 交付：普請方六階官員在城的月份，有湊齊的組就上門收貨（一個月一次），按「獻上」交出全部湊齊的組，每組一段帝都回信、旬報、城史。
 *  - 交滿四組：每年正月，在一座港口城（不含本城）新增一項「本局沒有產地、還沒獻上的組」的奢侈品產地（G.devProd）。
 *  - 交滿五組：可以遷居京畿；已有京畿外城友人的，好感拉到 100，沒有就送一位京畿商人當外城友人（好感 100）。
 *  - 進度頁：筆記「紀錄」多一個分頁「帝都獻上」。遷居後進度照舊（跟著人走），交付對象換成新城的普請方六階。
 *  狀態 G.kenjo{reach,on,done{行業:{y,t}},vm,newY}。數值 ODDS.kenjo；文字 kj.*、rec.tab.kenjo。
 * ===================================================================== */
const KJO=()=>ODDS.kenjo;
const kjS=()=>G.kenjo||(G.kenjo={reach:false,on:null,done:{},vm:null,newY:null});
const KJ_WINE='prod_0803';                         // 珍陀酒：密庫的走私貨（wine）也算
/** 這一局的各組：[{k 行業, items 奢侈品}]。 */
function kjGroups(){const ab=absentSys();return SYS.filter(s=>s.key!==ab).map(s=>({k:s.key,items:commsOfSys(s.key).filter(c=>c.luxury)})).filter(g=>g.items.length)}
const kjCount=()=>Object.keys((G.kenjo&&G.kenjo.done)||{}).length;
/** 某項貨手上有幾件（本業扣合約保留、他行貨、密庫的珍陀酒）。 */
function kjHave(name){const c=COMM_MAP[name];let n=(G.xinv&&G.xinv[name])||0;if(c&&c.sys===G.sysKey)n+=kakeFree(name);if(name===KJ_WINE)n+=(G.contra&&G.contra.wine)||0;return n}
function kjTake(name){
  if(G.xinv&&G.xinv[name]>0){G.xinv[name]--;if(!G.xinv[name])delete G.xinv[name];return}
  if(name===KJ_WINE&&G.contra&&G.contra.wine>0){G.contra.wine--;return}
  stockTake(name,1,false);
}
const kjReady=()=>kjGroups().filter(g=>!kjS().done[g.k]&&g.items.every(c=>kjHave(c.name)>=1));
const kjSysName=k=>(NAMES.sys[k]||{}).name||k;
const kjItems=g=>g.items.map(c=>c.short).join(NAMES_SEP);
/** 本城在城的普請方六階官員。 */
function kjOfficial(){return officialsOf(G.cityId).find(n=>n.pos&&n.pos.court==='administration'&&n.pos.rank===6&&alive(n.cid)&&!jailed(n)&&!awayNow(n))||null}
/** 每旬（日期前進之後）。 */
function kenjoTick(log){
  if(!G||G.ended)return;
  const K=kjS(),O=KJO(),put=t=>{pushNews(t);log.push(t)};
  if(!K.reach&&(G.fame||0)>=O.fame)K.reach=true;
  if(!K.reach)return;
  // 交滿四組：每年正月新增一處珍品產地
  if(kjCount()>=O.newOrigin&&G.month===1&&G.cycle===1&&K.newY!==G.year){
    K.newY=G.year;
    const done=K.done,cands=[];
    kjGroups().filter(g=>!done[g.k]).forEach(g=>g.items.forEach(c=>{if(!CITIES.some(ct=>cityProds(ct).includes(c.name)))cands.push(c)}));
    const ports=CITIES.filter(ct=>ct.id!==G.cityId&&canSea(ct));
    if(cands.length&&ports.length){
      const c=pick(cands),ct=pick(ports);G.devProd=G.devProd||[];G.devProd.push({cityId:ct.id,name:c.name,year:G.year,kenjo:true});
      G.cityHist=G.cityHist||{};(G.cityHist[ct.id]=G.cityHist[ct.id]||[]).push({year:G.year,title:NEWS('cityHist.newProd',{n:c.short})});
      put(NEWS('kj.newProd',{c:ct.name,a:c.short}));
    }
  }
  const off=kjOfficial();if(!off)return;
  if(!K.on){K.on=G.turn;K.vm=G.year*100+G.month;queueFaceEvent({type:'kenjoOpen',cid:off.cid,turn:G.turn});put(NEWS('kj.openN',{n:nameOf(off.cid)}));return}
  const vm=G.year*100+G.month;
  if(K.vm!==vm&&kjReady().length){K.vm=vm;queueFaceEvent({type:'kenjoGet',cid:off.cid,turn:G.turn})}
}
FACE_TITLE.kenjoOpen='kj.title';FACE_TITLE.kenjoGet='kj.title';
FACE_EXT.kenjoOpen=()=>({line:UT('kj.open.line'),effect:UT('kj.open.eff')});
FACE_EXT.kenjoGet=e=>{
  const L=kjReady();if(!L.length||!G.kenjo||!G.kenjo.on)return null;
  return {line:UT('kj.get.line'),effect:UT('kj.get.eff',{a:L.map(g=>kjSysName(g.k)+'（'+kjItems(g)+'）').join(NAMES_SEP)}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="kjGive" data-cid="'+e.cid+'">'+UT('btn.kjGive')+'</button><button class="pixel-btn btn-sm" data-act="faceNext">'+UT('btn.kjWait')+'</button></div>'};
};
/** 獻上：交出全部湊齊的組，每組一段帝都回信。 */
ACT.kjGive=el=>{
  const K=kjS(),O=KJO(),L=kjReady();if(!L.length){UI.hideInfo();return}
  const c0=kjCount(),parts=[],ct=homeCity();
  L.forEach(g=>{
    g.items.forEach(c=>kjTake(c.name));K.done[g.k]={y:G.year,t:G.turn};
    const a=kjItems(g),s=kjSysName(g.k),key=UI_TXT['kj.story.'+g.k]!==undefined?'kj.story.'+g.k:'kj.story.any';
    parts.push('<div class="card" style="margin:4px 0"><b class="small">'+esc(s)+'</b><div class="small" style="margin-top:2px">'+esc(UT(key,{a}))+'</div></div>');
    pushNews(NEWS('kj.giveN',{s,a}));
    G.cityHist=G.cityHist||{};(G.cityHist[ct.id]=G.cityHist[ct.id]||[]).push({year:G.year,title:NEWS('kj.hist',{f:G.firm,s})});
  });
  const c1=kjCount(),tot=kjGroups().length;
  if(c0<O.newOrigin&&c1>=O.newOrigin)parts.push('<div class="notice tiny">'+esc(UT('kj.m4'))+'</div>');
  if(c0<O.kinki&&c1>=O.kinki){
    parts.push('<div class="notice tiny">'+esc(UT('kj.m5'))+'</div>');pushNews(NEWS('kj.m5N'));
    if(!G.kyoTitle){G.kyoTitle=true;titleGain('kyo')}   // 京商名號（第三百五十六節）
    const own=outFriends().filter(cid=>{const n=npc(cid);return n&&CITY(n.cityId)&&CITY(n.cityId).region_id==='reg_central'});
    if(own.length)own.forEach(cid=>setAff(R(cid),100));
    else{
      const L2=CITIES.filter(c=>c.region_id==='reg_central').flatMap(c=>outCands(c.id));
      if(L2.length){const n=pick(L2);outMake(n.cid,UT('kj.bond'),100);logRel(n.cid,UT('kj.bond'));parts.push('<div class="notice tiny">'+esc(UT('kj.m5friend',{n:nameOf(n.cid)}))+'</div>')}
    }
  }
  if(c1>=tot&&c0<tot){parts.push('<div class="notice tiny">'+esc(UT('kj.m8'))+'</div>');pushNews(NEWS('kj.m8N'))}
  sfx.coin();save();UI.render();
  UI.showInfo(UT('kj.letter'),parts.join(''));
};
/* 交滿五組取得京商名號：京畿可以遷入。舊存檔已交滿五組的視同有名號。 */
const kyoOn=()=>!!G&&(!!G.kyoTitle||kjCount()>=KJO().kinki);
{const _m=moveAskBlock;moveAskBlock=function(cid){
  const r=_m.apply(this,arguments);if(r!=='mv.b.central'||!kyoOn())return r;
  const ct=outCity(cid);
  if(G.moveLast!==undefined&&G.turn<G.moveLast+MVO().cool)return 'mv.b.cool';
  if(!moveSysList(ct).length)return 'mv.b.prod';
  return '';
}}
/* ---------- 筆記「紀錄」頁的「帝都獻上」分頁 ---------- */
REC_TABS.push('kenjo');
function kenjoHtml(){
  const K=G.kenjo;
  if(!K||!K.reach)return '<div class="notice tiny">'+UT('kj.page.none')+'</div>';
  if(!K.on)return '<div class="notice tiny">'+UT('kj.page.wait')+'</div>';
  const Gs=kjGroups(),n=kjCount();
  let h='<div class="card"><b>'+UT('kj.page.head',{a:n,b:Gs.length})+'</b><div class="tiny muted" style="margin-top:2px">'+UT('kj.page.note')+'</div>'
    +(n<KJO().newOrigin?'<div class="tiny" style="margin-top:2px">'+UT('kj.page.next4')+'</div>':'')+(n<KJO().kinki?'<div class="tiny">'+UT('kj.page.next5')+'</div>':'')+'</div>';
  Gs.forEach(g=>{
    const d=K.done[g.k],ready=!d&&g.items.every(c=>kjHave(c.name)>=1);
    h+='<div class="card" style="margin-top:4px"><div class="row"><b class="small">'+esc(kjSysName(g.k))+'</b><span class="tag '+(d?'gold':ready?'green':'gray')+'">'+(d?UT('kj.page.done',{y:yearStr(d.y)}):ready?UT('kj.page.ready'):UT('kj.page.lack',{a:g.items.filter(c=>kjHave(c.name)<1).map(c=>c.short).join(NAMES_SEP)}))+'</span></div>';
    if(!d)g.items.forEach(c=>{
      const og=CITIES.filter(ct=>cityProds(ct).includes(c.name)).map(ct=>ct.name);
      h+='<div class="row tiny" style="margin-top:2px"><span>'+esc(c.short)+' <span class="'+(kjHave(c.name)>=1?'up':'muted')+'">'+(kjHave(c.name)>=1?UT('kj.page.have'):UT('kj.page.miss'))+'</span></span><span class="muted">'+(og.length?esc(UT('kj.page.orig',{a:og.join(NAMES_SEP)})):UT('kj.page.noOrig'))+'</span></div>';
    });
    h+='</div>';
  });
  return h;
}
{const _w=wikiRecord;wikiRecord=function(){
  if(UI.s.recTab!=='kenjo')return _w.apply(this,arguments);
  return '<div style="margin:4px 0">'+REC_TABS.map(k=>'<span class="pill '+(k==='kenjo'?'on':'')+'" data-act="recTab" data-k="'+k+'">'+UT('rec.tab.'+k)+'</span>').join('')+'</div>'+kenjoHtml();
}}
{const _f=setFame;setFame=function(){const r=_f.apply(this,arguments);if(G&&(G.fame||0)>=KJO().fame)kjS().reach=true;return r}}   // 知名度一碰到 150 就記下（之後掉下來也不收回）


/* ═════ [07zzzzzzzz_goyo] ═════ */
'use strict';
/* =====================================================================
 * 帝都御用品（DESIGN_NOTES 第三百一十九節第六段、第三百三十四節；帝都獻上第二期）
 *  - 從已獻上的各組奢侈品裡最多選 2 項（ODDS.goyo.max，本業的不能選）：上交當下（帝都回信下方）與遷居抵達時（旬報後）選或換。
 *  - 選上的貨進相場（mkComms／mkTrade）：向大盤照牌價進貨（上限＝本城需求一成乘番頭加成）、在相場出貨；冷熱、大單、地板照奢侈品；
 *    預設停賣；不算穩定供貨、市佔、協議配額（配額 0、evalCartel 只看本業）；同業出貨照需求的五成八基準、不超賣；開放貴人訂貨。
 *  - 他行貨裡的選上的貨每旬搬進相場庫存；換掉的貨，庫存變回他行貨、行情清掉。還有貴人訂單沒交的不能換掉。
 *  - 選上珍陀酒：比照酒問屋的洋酒上架，密庫的私運珍陀酒搬上架成正貨（07zzy_sake 的 wineLegal）。
 *  - 轉行後重疊：選上的貨成了新本業，自動退出御用名額；新本業那一組交過的話，開業就給那一組全部奢侈品的交易許可。
 *  狀態 G.goyo{sel[]}。數值 ODDS.goyo；文字 gy.*。
 * ===================================================================== */
const goyoSel=()=>(G&&G.goyo&&G.goyo.sel)||[];
function goyoComms(){if(!G)return [];return goyoSel().map(n=>COMM_MAP[n]).filter(c=>c&&c.sys!==G.sysKey)}
const isGoyo=name=>!!G&&goyoSel().includes(name)&&!!COMM_MAP[name]&&COMM_MAP[name].sys!==G.sysKey;
const goyoHas=isGoyo;
/** 可以選的貨：已獻上各組的奢侈品（本業的除外）。 */
function goyoCands(){const D=(G.kenjo&&G.kenjo.done)||{};return kjGroups().filter(g=>D[g.k]).flatMap(g=>g.items)}
/** 替一項御用品建立相場行情（照開局的方式：上旬收市＝目前行情）。 */
function goyoMkInit(n){
  const c=COMM_MAP[n],city=homeCity();
  const m=G.mk[n]={D:cityD(city,c),so:0,ev:1,shipped:0,hist:[],price:0,quote:0,quoteBase:0,quoteRelief:0,lastClose:0,close:null,closeBase:null,closeRelief:null,press:1,depPast:[],depTotal:0,depKnown:0,depDapan:0,past:[]};
  luxTick(c,m,true);m.so=rivalSupply(c,m,true);m.wcap=itemCap(n);
  const floor=marketFloor(n),q=marketIndex(n),qb=marketIndex(n,true),qr=reliefIndex(n,0);
  m.quoteFloor=q<=floor;m.quote=Math.max(q,floor);m.quoteBase=Math.max(qb,floor);m.quoteRelief=Math.max(qr,floor);m.price=m.quote;m.lastClose=q;m.prevQuote=m.quote;m.hist.push(Math.round(m.quote*10)/10);
}
/** 他行貨裡的御用品搬進相場庫存。 */
function goyoSweep(){goyoComms().forEach(c=>{const n=c.name,q=(G.xinv&&G.xinv[n])||0;if(q>0){delete G.xinv[n];stockAdd(n,q,false)}if(!G.mk[n])goyoMkInit(n)})}
const goyoPtBusy=n=>(G.patron&&ptOrders().some(o=>o.name===n));
/** 改選：換掉的變回他行貨、行情清掉；新選的建行情、預設停賣、他行貨搬上來。 */
function goyoSet(list){
  const old=goyoSel().slice(),nw=list.filter(n=>COMM_MAP[n]&&COMM_MAP[n].sys!==G.sysKey).slice(0,ODDS.goyo.max);
  old.filter(n=>!nw.includes(n)).forEach(n=>{
    const c=COMM_MAP[n];if(!c||c.sys===G.sysKey)return;
    const q=G.inv[n]||0;if(q>0){stockTake(n,q,false);G.xinv=G.xinv||{};G.xinv[n]=(G.xinv[n]||0)+q}
    delete G.mk[n];if(G.avgCost)delete G.avgCost[n];if(G.plan)delete G.plan[n];if(G.buyPlan)delete G.buyPlan[n];if(G.shipLock)delete G.shipLock[n];
  });
  G.goyo={sel:nw};
  nw.filter(n=>!old.includes(n)).forEach(n=>{G.shipLock=G.shipLock||{};G.shipLock[n]=true});
  goyoSweep();
}
/** 選貨畫面（上交時接在帝都回信下方、遷居抵達時單獨跳出）。 */
function goyoPickHtml(lead){
  const L=goyoCands(),T=UI.s.gyTmp||(UI.s.gyTmp=goyoSel().filter(n=>COMM_MAP[n]&&COMM_MAP[n].sys!==G.sysKey));
  if(!L.length)return '<div class="notice tiny">'+UT('gy.none')+'</div>';
  let h='<div class="card" style="margin-top:6px;background:#fff8eb"><b class="small">👑 '+UT('gy.title')+'</b><div class="tiny muted" style="margin-top:2px">'+UT(lead||'gy.lead',{n:ODDS.goyo.max})+'</div>';
  h+='<div style="margin-top:4px">'+L.map(c=>{const own=c.sys===G.sysKey,on=T.includes(c.name),lock=on&&goyoPtBusy(c.name)&&goyoSel().includes(c.name);
    return '<span class="pill '+(on?'on':'')+'" '+(own?'style="opacity:.45"':'data-act="goyoTog" data-n="'+esc(c.name)+'"')+'>'+esc(c.short)+(own?'·'+UT('gy.own'):lock?'·'+UT('gy.pt'):'')+'</span>'}).join(' ')+'</div>';
  h+='<div class="tiny muted" style="margin-top:4px">'+UT('gy.note')+'</div><button class="pixel-btn btn-sm btn-gold" style="width:100%;margin-top:4px" data-act="goyoOk">'+UT('btn.gyOk')+'</button></div>';
  return h;
}
let GY_VIEW=null;                                   // 目前的選貨視窗：{t 標題, pre 前面的內容, lead}
function goyoShow(){if(GY_VIEW)UI.showInfo(GY_VIEW.t,GY_VIEW.pre+goyoPickHtml(GY_VIEW.lead))}
ACT.goyoTog=el=>{
  const n=el.dataset.n,T=UI.s.gyTmp||(UI.s.gyTmp=goyoSel().slice());
  if(T.includes(n)){if(goyoSel().includes(n)&&goyoPtBusy(n)){toast(MSG('gy.ptLock'));return}T.splice(T.indexOf(n),1)}
  else{if(T.length>=ODDS.goyo.max){toast(MSG('gy.full',{n:ODDS.goyo.max}));return}T.push(n)}
  sfx.tap();goyoShow();
};
ACT.goyoOk=()=>{
  const T=(UI.s.gyTmp||goyoSel()).slice();UI.s.gyTmp=null;GY_VIEW=null;
  goyoSet(T);toast(MSG('gy.ok',{a:goyoComms().map(c=>c.short).join(NAMES_SEP)||'—'}),3600);save();UI.hideInfo();UI.render();
};
/* 上交時：帝都回信下方接選貨 */
{const _g=ACT.kjGive;ACT.kjGive=function(el){
  const n0=kjCount();_g.apply(this,arguments);
  if(kjCount()>n0&&goyoCands().length){const body=$('#info-body');UI.s.gyTmp=null;GY_VIEW={t:UT('kj.letter'),pre:body?body.innerHTML:'',lead:'gy.lead'};goyoShow()}
}}
/* 遷居：轉行重疊退出名額、新本業那一組交過就給許可、新城重建行情，抵達後旬報後選貨 */
{const _m=moveDepart;moveDepart=function(){
  const r=_m.apply(this,arguments);
  if(G.goyo)G.goyo.sel=goyoSel().filter(n=>COMM_MAP[n]&&COMM_MAP[n].sys!==G.sysKey);
  if(G.kenjo&&G.kenjo.done&&G.kenjo.done[G.sysKey]){G.trade=G.trade||[];commsOfSys(G.sysKey).filter(c=>c.luxury).forEach(c=>{if(!G.trade.includes(c.name))G.trade.push(c.name)})}
  goyoComms().forEach(c=>{goyoMkInit(c.name);G.shipLock=G.shipLock||{};G.shipLock[c.name]=true});
  if(goyoCands().length)queueFaceEvent({type:'goyoPick',turn:G.turn});
  return r;
}}
FACE_TITLE.goyoPick='gy.title';
{const _f=faceEventCard;faceEventCard=function(e){
  if(!e||e.type!=='goyoPick')return _f.apply(this,arguments);
  if(!goyoCands().length)return null;UI.s.gyTmp=null;GY_VIEW={t:UT('gy.title'),pre:'',lead:'gy.leadMove'};
  return goyoPickHtml('gy.leadMove');
}}
/* 每旬：他行貨裡的御用品搬上來 */
{const _k=kenjoTick;kenjoTick=function(){goyoSweep();return _k.apply(this,arguments)}}
/* 進度頁多一行：目前的御用品 */
{const _h=kenjoHtml;kenjoHtml=function(){
  const h=_h.apply(this,arguments);if(!G.kenjo||!G.kenjo.on||!kjCount())return h;
  const L=goyoComms().map(c=>c.short);
  return h.replace('</div>','</div><div class="tiny" style="margin-top:3px">👑 '+esc(L.length?UT('gy.page',{a:L.join(NAMES_SEP)}):UT('gy.pageNone'))+'</div>');
}}

/* ═════ [07zzzzzzzzz_retail] ═════ */
'use strict';
/* ★零售商上門抱怨貨色（DESIGN_NOTES 第三百四十九節）
 * - 每旬推進時，上一旬（這次推進）有出日常貨（必需品、一般品）才擲，機率 ODDS.retail.p，各行業一樣。
 * - 零售商不是名冊人物：屋號（LINES.retail.shop）與人名（LINES.retail.given）隨機，頭像照商人外貌隨機生成，只出現這一次。
 * - 來訪視窗（旬報後）：賠他＝付現款 50～200 兩，市佔成長倍率加 1～3 個百分點（同一次穩定供貨）；
 *   不理（或直接關掉）＝市佔成長倍率減 1～3 個百分點，知名度 −1～3（同一次供貨不足）。
 * - 事件資料只在 G.faceEvents 裡，處理完就消失；不另存欄位。 */
const RTO=()=>ODDS.retail;
/** 貨的毛病：易壞的發臭、陶磁雅玩破損、礦產生鏽，其餘受潮。 */
const rtKind=c=>c.sys==='luxury'?'brk':c.sys==='mining'?'rust':c.decay>=0.015?'rot':'damp';
function retailTick(){
  const rep=TURNRP;if(!rep||!rep.ship||!rep.ship.length||G.ended)return;
  const shipped=new Set(rep.ship.filter(x=>x.q>0).map(x=>x.n));
  const L=mkTrade().filter(c=>!c.luxury&&shipped.has(c.short));if(!L.length)return;
  if(!chance(RTO().p))return;
  const c=pick(L),A=RTO().amt,amt=Math.round(rint(A[0],A[1])/10)*10;
  const shop=pick(Ls('retail.shop.'+G.sysKey)||Ls('retail.shop.grain')),gv=Ls('retail.given'),gi=Math.floor(rnd()*gv.length);
  queueFaceEvent({type:'retail',name:c.name,amt,shop,given:gv[gi],f:gi>=gv.length-2,seed:rint(1,1e9),line:pick(Ls('retail.line.'+rtKind(c))),turn:G.turn});
}
{const _k=kenjoTick;kenjoTick=function(log){const r=_k.apply(this,arguments);retailTick();return r}}   // 排在每旬推進的後段（出貨已結算）
let RT_CUR=null;
const rtWho=e=>UT('rt.who',{s:e.shop,n:e.given});
/** 零售商頭像：商人外貌，依事件種子固定。 */
function rtPortrait(e,px){
  const st={commerce_skill:40+e.seed%40,integrity_loyalty:30+(e.seed>>3)%50,greed_index:30+(e.seed>>5)%50,audacity_courage:30+(e.seed>>7)%50,diplomacy_charm:30+(e.seed>>9)%50,betrayal_risk:20+(e.seed>>11)%40};
  const age=25+(e.seed>>13)%35,key='edo3rt|'+e.seed;
  const url=PT_CACHE[key]||(PT_CACHE[key]=ptDraw({seed:'rt'+e.seed,gender:e.f?'f':'m',age,role:'guest',rank:0,st}));
  return '<img class="pt" src="'+url+'" width="'+(px||56)+'" height="'+(px||56)+'" alt="" aria-hidden="true" style="float:left;margin-right:6px">';
}
FACE_TITLE.retail='rt.t';
{const _f=faceEventCard;faceEventCard=function(e){
  if(!e||e.type!=='retail')return _f.apply(this,arguments);
  const c=COMM_MAP[e.name];if(!c)return null;
  RT_CUR=e;e.done=false;
  const poor=G.silver<e.amt;
  const buttons='<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="rtPay" '+(poor?'disabled':'')+'>'+UT('btn.rtPay',{a:fmt(e.amt)})+'</button><button class="pixel-btn btn-sm" data-act="rtRefuse">'+UT('btn.rtRefuse')+'</button></div>';
  return '<div class="card warn" id="rt-card" style="display:flow-root">'+rtPortrait(e,56)+'<div><b style="font-size:17px">'+esc(rtWho(e))+'</b> <span class="tag gray">'+UT('face.faceEventCard.12',{a:esc(UT('rt.tag')),b:esc(e.line.replace(/\{g\}/g,c.short)),c:esc(UT('rt.eff',{a:fmt(e.amt)}))})+'</div>'+buttons+'</div>';
}}
/** 市佔成長倍率增減（百分點，1～3）。 */
function rtShare(sign){const S=RTO().share,x=rint(S[0],S[1]);if(G.mybias===undefined)G.share=marketShares();G.mybias=clamp((G.mybias||1)*(1+sign*0.01*x),0.2,4);G.share=null}
function rtResolve(pay){
  const e=RT_CUR;if(!e||e.done)return;
  const c=COMM_MAP[e.name],w=rtWho(e);
  if(pay){
    if(G.silver<e.amt){toast(MSG('rt.short'));return false}
    e.done=true;payPublic('spend.retail',e.amt);rtShare(1);
    pushNews(NEWS('rt.paidN',{w,g:c.short,a:fmt(e.amt)}));toast(MSG('rt.paid',{a:fmt(e.amt),w}),3600);sfx.coin();
  }else{
    e.done=true;rtShare(-1);const F=RTO().fame;setFame((G.fame||0)-rint(F[0],F[1]));
    pushNews(NEWS('rt.refusedN',{w,g:c.short}));toast(MSG('rt.refused',{w}),3600);sfx.bad();
  }
  RT_CUR=null;save();UI.render();return true;
}
ACT.rtPay=()=>{if(rtResolve(true)!==false)UI.hideInfo()};
ACT.rtRefuse=()=>{rtResolve(false);UI.hideInfo()};
/* 直接關掉視窗＝不理 */
{const _h=UI.hideInfo;UI.hideInfo=function(){if(RT_CUR&&!RT_CUR.done&&document.getElementById('rt-card'))rtResolve(false);return _h.apply(this,arguments)}}

/* ═════ [07zzzzzzzzzz_title] ═════ */
/* ======================= 取得名號的演出（第三百五十六節） =======================
 *  - 名號：大商、豪商（大盤，07zzzz_dapan）、京商（帝都獻上交滿五組，07zzzzzzz_kenjo）；職務：公會長（07yc_gm，新就任才演，連任不演）。
 *  - titleGain(k) 記進 G.titleQ；下一次關閉說明視窗（旬報、獻上回信、拉票戰鬥）時先演名號，演完再接原本的後續（人物事件等）。
 *  - 演出：畫面轉黑 → 中央浮出大字名號（京商金、大商豪商紅、公會長綠）→ 取得原因 → 效果說明 → 關閉按鈕。不能略過，沒有音效。
 *  狀態 G.titleQ=[k,…]。文字 tt.*。 */
function titleGain(k){if(!G)return;(G.titleQ=G.titleQ||[]).push(k)}
{const _g=gmInstall;gmInstall=function(k){const was=typeof gmIsMe==='function'&&gmIsMe();const r=_g.apply(this,arguments);if(k==='me'&&!was)titleGain('gm');return r}}
const TITLE_KIND={kyo:'kyo',big:'red',gou:'red',gm:'green'};
var TITLE_ON=false;
/** 演一個名號；done＝關閉後接著做的事。 */
function titlePlay(k,done){
  TITLE_ON=true;
  const col=TITLE_COL[TITLE_KIND[k]]||TITLE_COL.red,yago=typeof moveYago==='function'?moveYago():'';
  let el=$('#title-fx');if(!el){el=document.createElement('div');el.id='title-fx';document.body.appendChild(el)}
  el.innerHTML='<div class="tf-name" style="color:'+col+';text-shadow:0 0 14px '+col+'99,0 0 2px #000">'+esc(UT('tt.'+k))+'</div>'
    +'<div class="tf-why">'+esc(UT('tt.'+k+'.why',{f:yago}))+'</div>'
    +'<div class="tf-eff">'+esc(UT('tt.'+k+'.eff'))+'</div>'
    +'<button class="pixel-btn btn-sm tf-btn" data-act="titleClose">'+UT('btn.titleClose')+'</button>';
  el.classList.remove('on','ready');el.style.display='flex';void el.offsetWidth;el.classList.add('on');
  clearTimeout(TITLE_T);TITLE_T=setTimeout(()=>el.classList.add('ready'),4600);   // 按鈕淡入後才能按
  TITLE_DONE=done||null;
}
var TITLE_DONE=null,TITLE_T=0;
ACT.titleClose=()=>{
  const el=$('#title-fx');if(el&&!el.classList.contains('ready'))return;   // 不能略過
  if(el){el.classList.remove('on','ready');el.style.display='none';el.innerHTML=''}
  TITLE_ON=false;const f=TITLE_DONE;TITLE_DONE=null;
  if(!titleNext(f)&&f)setTimeout(f,0);
};
/** 有待演的名號就演一個（演完再看下一個），回傳是否有演。 */
function titleNext(after){
  const Q=G&&G.titleQ;if(!Q||!Q.length||TITLE_ON)return false;
  const k=Q.shift();save();titlePlay(k,after);return true;
}
{const _h=UI.hideInfo;UI.hideInfo=function(){
  if(!G||!G.titleQ||!G.titleQ.length||TITLE_ON)return _h.apply(this,arguments);
  const f=INFO_AFTER;INFO_AFTER=null;_h.apply(this,arguments);   // 先關視窗，名號演完再接原本的後續
  titleNext(f);
}}

/* ═════ [07zzzzzzzzzzz_villa] ═════ */
/* ======================= 別邸（店頂庭園）與店舖改建（第三百六十節） =======================
 *  - 現款第一次達到 10 萬兩：大番頭上門建議興建（旬報後來訪）；不答應時私宅頁「設宴」上方常駐別邸卡。沒有大番頭也照樣出現卡。
 *  - 興建與三次改建各 8,000 兩（現款）；門檻看按下時的現款：10 萬、15 萬、20 萬、25 萬。施工一旬，下一次推進落成，落成那一旬屋頂撒年糕。
 *  - 別邸設宴：一旬一次、扣 1 行動；費用 500／750／1,000／1,250；本城四階以上官員隨機 1～4 位（不認識的當場結識），
 *    約一成多來一位外地遠國奉行所官員（不佔名額）。好感每位 +4～8 乘倍數 1／1.3／1.6／1.9；整場風聲 +0.1。
 *  - 遷居：別邸不能帶走，新城從頭來（大番頭會再建議）。
 *  狀態 G.villa{lv,asked,seen,work:{lv,t},joto,feastT}；數值 ODDS.villa；文字 villa.*。畫面在 05_scene.js〔05i_villa〕。 */
const VLO=()=>ODDS.villa;
const villaS=()=>G.villa||(G.villa={lv:0,asked:false,seen:false,work:null,joto:-1,feastT:-1});
const villaLv=()=>(G&&G.villa&&G.villa.lv)||0;
const villaChief=()=>(G.emps||[]).find(e=>e.rank==='chief'&&!jailedEmp(e)&&!empLent(e));
/** 下一階的門檻與費用；已到頂回傳 null。 */
function villaNext(){const V=villaS(),O=VLO(),k=V.lv;if(k>=O.need.length)return null;return {lv:k+1,need:O.need[k],cost:O.cost}}
const villaFeastCost=()=>VLO().feast[Math.max(0,villaLv()-1)];
function villaTick(log){
  if(!G||G.ended)return;
  const V=villaS();
  if(V.work&&G.turn>V.work.t){                     // 施工一旬後落成
    V.lv=V.work.lv;V.work=null;V.joto=G.turn;
    const t=NEWS(V.lv===1?'villa.doneN':'villa.reN',{f:moveYago(),a:UT('villa.lv.'+V.lv)});pushNews(t);log.push(t);
    const ct=homeCity();G.cityHist=G.cityHist||{};(G.cityHist[ct.id]=G.cityHist[ct.id]||[]).push({year:G.year,title:NEWS(V.lv===1?'villa.histN':'villa.reHistN',{f:moveYago()})});
  }
  if(G.silver>=VLO().need[0])V.seen=true;
  if(!V.asked&&V.lv===0&&!V.work&&G.silver>=VLO().need[0]){const b=villaChief();if(b){V.asked=true;queueFaceEvent({type:'villaAsk',empId:b.id,turn:G.turn})}}
}
{const _k=kenjoTick;kenjoTick=function(log){const r=_k.apply(this,arguments);villaTick(log);return r}}
FACE_TITLE.villaAsk='villa.ask.t';
FACE_EXT.villaAsk=()=>{
  const V=villaS();if(V.lv>0||V.work)return null;
  return {line:TX('villa.ask'),effect:UT('villa.ask.eff',{c:fmt(VLO().cost)}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="villaBuild" data-face="1">'+UT('btn.villaBuild',{c:fmt(VLO().cost)})+'</button><button class="pixel-btn btn-sm" data-act="faceNext">'+UT('btn.villaLater')+'</button></div>'};
};
ACT.villaBuild=el=>{
  const V=villaS(),N=villaNext();if(!N||V.work)return;
  if(G.silver<N.need){toast(MSG('villa.need',{a:fmt(N.need)}));return}
  payPublic('spend.villa',N.cost);V.work={lv:N.lv,t:G.turn};V.seen=true;
  pushNews(NEWS(N.lv===1?'villa.startN':'villa.reStartN',{f:moveYago()}));
  sfx.coin();toast(MSG(N.lv===1?'villa.start':'villa.reStart'),4200);save();
  if(el&&el.dataset.face)UI.hideInfo();
  UI.render();sceneSync&&sceneSync(true);
};
/** 私宅頁「設宴」上方的別邸卡。 */
function villaCard(){
  const V=G&&G.villa;if(!V||(!V.seen&&!V.lv&&!V.work))return '';
  const N=villaNext(),lv=V.lv;
  let h='<div class="card"><b>'+UT('villa.card.t')+'</b>';
  if(V.work)h+='<div class="tiny muted" style="margin-top:2px">'+UT(V.work.lv===1?'villa.card.work':'villa.card.reWork')+'</div>';
  else if(!lv)h+='<div class="tiny muted" style="margin-top:2px">'+UT('villa.card.none')+'</div>';
  else h+='<div class="tiny muted" style="margin-top:2px">'+UT('villa.card.lv',{a:UT('villa.lv.'+lv),n:lv,c:fmt(villaFeastCost())})+'</div>';
  if(lv&&!V.work){
    const done=V.feastT===G.turn;
    h+='<button class="pixel-btn btn-sm btn-gold" style="margin-top:4px;width:100%" data-act="villaFeast"'+(done?' disabled':'')+'>'+(done?UT('btn.feastDone'):UT('btn.villaFeast',{c:fmt(villaFeastCost())}))+'</button>';
  }
  if(N&&!V.work){
    const ok=G.silver>=N.need;
    h+='<div class="tiny" style="margin-top:6px">'+UT(N.lv===1?'villa.card.build':'villa.card.re',{a:UT('villa.lv.'+N.lv),need:fmt(N.need),c:fmt(N.cost)})+'</div>'
      +'<button class="pixel-btn btn-sm" style="margin-top:3px;width:100%" data-act="villaBuild"'+(ok?'':' disabled')+'>'+(ok?UT(N.lv===1?'btn.villaBuild':'btn.villaRe',{c:fmt(N.cost)}):UT('btn.villaNeed',{a:fmt(N.need)}))+'</button>';
  }
  return h+'</div>';
}
{const _b=banquetCard;banquetCard=function(){return villaCard()+_b.apply(this,arguments)}}
/** 別邸設宴。 */
ACT.villaFeast=()=>{
  const V=villaS(),lv=V.lv;if(!lv||V.work)return;
  if(V.feastT===G.turn){toast(MSG('villa.feastDone'));return}
  const cost=villaFeastCost();if(G.silver<cost){toast(MSG('villa.short',{a:fmt(cost)}));return}
  const pool=cityNpcs(G.cityId).filter(n=>n.role==='official'&&n.pos&&n.pos.court!=='region'&&n.pos.rank>=VLO().rank&&alive(n.cid)&&!jailed(n)&&!awayNow(n)&&!isEnemy(n.cid));
  if(!pool.length){toast(MSG('villa.none'));return}
  if(!spendAP())return;
  V.feastT=G.turn;payPublic('spend.villaFeast',cost);addHeat(VLO().heat);
  const guests=shuffle(pool.slice()).slice(0,lv);
  if(chance(VLO().far)){const F=Object.values(G.world.npcs).filter(n=>foreignReg(n)&&n.pos.rank>=VLO().rank&&alive(n.cid)&&!jailed(n)&&!isEnemy(n.cid));if(F.length)guests.push(pick(F))}
  const mult=VLO().mult[lv-1];
  playFx('walk',MSG('villa.fx'),MSG('villa.fxTitle'),()=>{
    let h='<div class="notice tiny">'+esc(TX('villa.open'))+'</div>';
    const lines=shuffle(Ls('villa.thank').slice());
    guests.forEach((n,k)=>{
      const r=R(n.cid),far=foreignReg(n),gain=Math.max(1,Math.round(rint(ERRAND_GAIN[0],ERRAND_GAIN[1])*mult)),fresh=!r.bond;
      if(fresh){r.bond={mult:0.8,label:UT('villa.bond'),introId:null};r.met=true;r.seen=true;if(!r.fameGot){r.fameGot=true;addFame(0.8)}}
      addKnown(n.cid);setAff(r,clamp(r.aff+gain,0,100));logRel(n.cid,UT('villa.log',{a:gain}));
      h+='<div class="card" style="display:flow-root">'+portraitHtml(n.cid,40)+'<b>'+esc(nameOf(n.cid))+'</b> <span class="tag gray">'+esc(posTitle(n))+'</span> <span class="tag red">'+UT('villa.gain',{a:gain})+'</span>'
        +(fresh?' <span class="tag gold">'+UT('villa.fresh')+'</span>':'')+(far?' <span class="tag navy">'+UT('villa.far')+'</span>':'')
        +'<div class="small" style="margin-top:3px">'+esc(lines[k%lines.length])+'</div></div>';
    });
    sfx.gift();save();UI.showInfo(UT('villa.result',{a:guests.length}),h);UI.render();sceneSync&&sceneSync(true);
  },1000);
};
/* 遷居：別邸不能帶走，新城從頭來 */
{const _m=moveClearCity;moveClearCity=function(){const r=_m.apply(this,arguments);G.villa=null;return r}}

/* ═════ [07zzzzzzzzzzzz_hanabi] ═════ */
/* ======================= 川開大花火（第三百五十九節第三段、第三百六十四節） =======================
 *  - 每年七月上旬，現款 ≥ 5 萬兩、有大番頭時，大番頭在旬報後上門提議出資：小 1,000／中 3,000／大 5,000 兩，或不辦。沒有大番頭那一年不辦。
 *  - 七月中旬放花火：知名度 +1／+2／+3（大事件），全城買氣 +10%／+20%／+30%（只那一旬，`sumoMult` 外層），瓦版、城史各一則。
 *  - 畫面在 05_scene.js〔05j_hanabi〕：那一旬轉成夜晚；小＝主屋右側小花火，中＝兩側，大＝兩側加從左邊發射、拋物線到右邊炸開的大玉。
 *  狀態 G.hanabi{y,lv,done}；數值 ODDS.hanabi；文字 hb.*。 */
const HBO=()=>ODDS.hanabi;
/** 本旬是放花火的那一旬：回傳檔次 1～3，沒有就 0。 */
const hanabiLv=()=>{const H=G&&G.hanabi;return H&&H.y===G.year&&H.lv>0&&G.month===7&&G.cycle===2?H.lv:0};
function hanabiTick(log){
  if(!G||G.ended)return;
  const H=G.hanabi;
  if(G.month===7&&G.cycle===1&&G.silver>=HBO().need&&(!H||H.y!==G.year)){
    const b=villaChief();G.hanabi={y:G.year,lv:0,done:false};
    if(b)queueFaceEvent({type:'hanabiAsk',empId:b.id,turn:G.turn});
  }
  const lv=hanabiLv();
  if(lv&&!G.hanabi.done){
    G.hanabi.done=true;const ct=homeCity(),f=addFame(HBO().fame[lv-1],'major');
    const t=NEWS('hb.showN',{f:moveYago(),c:ct.name,a:fmt(HBO().cost[lv-1]),b:f});pushNews(t);log.push(t);
    G.cityHist=G.cityHist||{};(G.cityHist[ct.id]=G.cityHist[ct.id]||[]).push({year:G.year,title:NEWS('hb.histN',{f:moveYago(),a:fmt(HBO().cost[lv-1])})});
  }
}
{const _k=kenjoTick;kenjoTick=function(log){const r=_k.apply(this,arguments);hanabiTick(log);return r}}
{const _s=sumoMult;sumoMult=function(c){const lv=hanabiLv();return _s.apply(this,arguments)*(lv?1+HBO().demand[lv-1]:1)}}   // 放花火那一旬全城買氣
FACE_TITLE.hanabiAsk='hb.ask.t';
FACE_EXT.hanabiAsk=()=>{
  const H=G.hanabi;if(!H||H.y!==G.year||H.lv>0)return null;
  const O=HBO(),btn=i=>{const ok=G.silver>=O.cost[i];return '<button class="pixel-btn btn-sm'+(i===2?' btn-gold':'')+'" data-act="hanabiPick" data-lv="'+(i+1)+'"'+(ok?'':' disabled')+'>'+UT('btn.hanabi.'+(i+1),{a:fmt(O.cost[i])})+'</button>'};
  return {line:TX('hanabi.ask'),effect:UT('hb.ask.eff'),
    buttons:'<div class="grid2">'+btn(0)+btn(1)+'</div><div class="grid2" style="margin-top:4px">'+btn(2)+'<button class="pixel-btn btn-sm" data-act="faceNext">'+UT('btn.hanabiNo')+'</button></div>'};
};
ACT.hanabiPick=el=>{
  const H=G.hanabi,lv=+el.dataset.lv,O=HBO();if(!H||H.y!==G.year||H.lv>0||!(lv>=1&&lv<=3))return;
  const amt=O.cost[lv-1];if(G.silver<amt){toast(MSG('hb.short',{a:fmt(amt)}));return}
  payPublic('spend.hanabi',amt);H.lv=lv;
  pushNews(NEWS('hb.payN',{f:moveYago(),a:fmt(amt)}));
  sfx.coin();toast(MSG('hb.paid',{a:fmt(amt)}),4200);save();UI.hideInfo();UI.render();
};
