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
const wineLegal=()=>sakeOn()&&tradeOK(SAKE_WINE);
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
