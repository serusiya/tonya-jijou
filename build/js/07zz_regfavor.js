'use strict';
/* ======================= 遠國奉行所三階新請託：官船捎帶、官荷捎帶、本陣御用達（第一百六十二節） =======================
 *  - 都只能向本店所在地區的官員開口（外地官員寫信也求不到）；一般請託：好感 −10，同一位官員冷卻 12 旬。
 *  - 官船捎帶（湊番所役，本店是港口城）／官荷捎帶（關所番頭，本店不是港口城；水陸要衝兩位都有）：
 *     能買賣的本業貨裡，八成是最貴的那項、兩成是第二貴的；同一位官員同一旬開出的貨與數量固定。
 *     官船約值 3,000 兩付 2,000 兩；官荷減半。三旬後入倉，不會遇難；放不下的直接損失。風聲 +0.2。
 *  - 本陣御用達（宿場問屋場役）：隨機一項能買賣的本業貨，每旬約值 500 兩的數量；接下後連續三旬，
 *     推進時（自動出貨之前）從庫存送出，照當旬市價加兩成入帳；不算本城出貨。送不足＝失約：有多少送多少，好感 −30、知名度 −1，合約結束。
 *  數值 ODDS.regConsign、ODDS.honjin；文字 rfav.*（01e、01f、01g）。狀態 G.consign（在途）、G.honjin（合約）、G.regOffer（本旬開價）。 */
/** 這位遠國奉行所官員是不是外地的（不在本店所在地區）。 */
const foreignReg=n=>!!(n&&n.pos&&n.pos.court==='region'&&regOfNpc(n)!==homeRegion());
const localReg=n=>!!(n&&n.pos&&n.pos.court==='region'&&regOfNpc(n)===homeRegion());
/** 本店能辦哪一種捎帶：港口城→官船；非港口城或水陸要衝→官荷。 */
const consignSeaOk=()=>canSea(homeCity());
const consignLandOk=()=>!canSea(homeCity())||homeCity().type==='waterland';
/** 開價（同一位官員同一旬固定）。kind：sea／land／honjin。 */
function regOffer(n,kind){
  G.regOffer=G.regOffer||{};const key=n.cid+'|'+kind,o=G.regOffer[key];
  if(o&&o.turn===G.turn&&COMM_MAP[o.name])return o;
  const L=tradeComms();if(!L.length)return null;
  const rd=seeded(n.cid+'|'+kind+'|'+G.turn),price=c=>marketQuote(c.name,true);
  let c;
  if(kind==='honjin')c=L[Math.floor(rd()*L.length)];
  else{const S=L.slice().sort((a,b)=>price(b)-price(a));c=S.length>1&&rd()<ODDS.regConsign.second?S[1]:S[0]}
  const O=kind==='honjin'?ODDS.honjin:ODDS.regConsign[kind];
  const qty=Math.max(1,Math.round(O.value/Math.max(0.01,price(c))));
  const r={turn:G.turn,name:c.name,qty,pay:O.pay||0};
  G.regOffer[key]=r;
  Object.keys(G.regOffer).forEach(k=>{if(G.regOffer[k].turn!==G.turn)delete G.regOffer[k]});
  return r;
}
const consignKind=k=>k==='rconsignSea'?'sea':'land';
REG_FAVORS.push(
  {k:'rconsignSea',rank:3,cd:12,pos:['reg_02'],local:true,consign:'sea',avail:()=>consignSeaOk()},
  {k:'rconsignLand',rank:3,cd:12,pos:['reg_01'],local:true,consign:'land',avail:()=>consignLandOk()},
  {k:'rhonjin',rank:3,cd:12,pos:['reg_03'],local:true,honjin:true,avail:()=>!G.honjin}
);
REG_FAVORS.filter(f=>f.consign||f.honjin).forEach(f=>{f.name=UT('fav.'+f.k);f.desc=UT('fav.'+f.k+'.d')});
/** 請託選單：名稱帶貨名與數量（resolveFavor 呼叫）。 */
function regFavorResolve(f,n){
  if(!f.consign&&!f.honjin)return null;
  const o=regOffer(n,f.consign||'honjin');if(!o)return Object.assign({},f,{off:true});
  const v={g:COMM_MAP[o.name].short,q:o.qty,a:fmt(o.pay)};
  return Object.assign({},f,{name:UT('fav.'+f.k+'.n',v),desc:UT('fav.'+f.k+'.dd',v)});
}
/** 開口前的檢查（doFavor 呼叫）：回傳錯誤訊息或 null。 */
function regFavorCheck(f,n){
  if(f.local&&!localReg(n))return MSG('rfav.notLocal');
  if(f.consign){const o=regOffer(n,f.consign);if(!o)return MSG('rfav.noGoods');if(G.silver<o.pay)return MSG('rfav.short',{a:fmt(o.pay)})}
  if(f.honjin){if(G.honjin)return MSG('rfav.honjinBusy');if(!regOffer(n,'honjin'))return MSG('rfav.noGoods')}
  return null;
}
const consignFavor=kind=>n=>{
  const o=regOffer(n,kind),c=COMM_MAP[o.name];
  payPublic('spend.consign'+(kind==='sea'?'Sea':'Land')+'|'+o.name,o.pay);addHeat(ODDS.regConsign.heat);
  (G.consign=G.consign||[]).push({kind,name:o.name,qty:o.qty,cost:o.pay,due:G.turn+ODDS.regConsign.turns,cid:n.cid});
  delete G.regOffer[n.cid+'|'+kind];
  return MSG('rfav.consign.'+kind,{g:c.short,q:o.qty,a:fmt(o.pay),t:ODDS.regConsign.turns});
};
REG_FAVOR.rconsignSea=consignFavor('sea');
REG_FAVOR.rconsignLand=consignFavor('land');
REG_FAVOR.rhonjin=n=>{
  const o=regOffer(n,'honjin'),c=COMM_MAP[o.name];
  G.honjin={cid:n.cid,name:o.name,qty:o.qty,left:ODDS.honjin.turns,start:G.turn};
  delete G.regOffer[n.cid+'|honjin'];
  return MSG('rfav.honjin',{g:c.short,q:o.qty,t:ODDS.honjin.turns});
};
/** 每旬（訂單到貨之後）：捎帶的貨到了就入倉。 */
function consignTick(log){
  const L=G.consign||[];if(!L.length)return;
  G.consign=L.filter(x=>{
    if(G.turn<x.due)return true;
    const c=COMM_MAP[x.name];if(!c)return false;
    const room=Math.max(0,Math.min(invCap()-invUsed(),itemCap(x.name)-(G.inv[x.name]||0))),q=Math.min(x.qty,room);
    if(q>0){addStock(x.name,q,x.cost/x.qty);stockAdd(x.name,q,false)}
    const t=NEWS('rfav.arrive.'+x.kind,{g:c.short,q,l:x.qty-q>0?UT('rfav.lost',{n:x.qty-q}):''});pushNews(t);log.push(t);
    return false;
  });
}
/** 每旬推進一開始（自動出貨之前）：本陣御用達送貨。回傳入帳金額（記進旬報）。 */
function honjinTick(log){
  const H=G.honjin;if(!H||G.turn<H.start)return 0;
  const c=COMM_MAP[H.name];if(!c){G.honjin=null;return 0}
  const have=G.inv[H.name]||0,q=Math.min(have,H.qty),amt=Math.round(q*marketQuote(H.name)*ODDS.honjin.markup);
  stockTake(H.name,q,false);G.silver+=amt;
  let t;
  if(q<H.qty){
    const r=G.rel[H.cid];if(r&&alive(H.cid)){setAff(r,Math.max(0,r.aff-ODDS.honjin.failAff));logRel(H.cid,UT('rfav.log.fail',{d:ODDS.honjin.failAff}))}
    loseFame('tributeFail');G.honjin=null;sfx.bad();
    t=NEWS('rfav.honjin.fail',{g:c.short,q,a:fmt(amt)});
  }else{
    H.left--;
    t=NEWS(H.left>0?'rfav.honjin.give':'rfav.honjin.done',{g:c.short,q,a:fmt(amt),l:H.left});
    if(H.left<=0)G.honjin=null;
  }
  pushNews(t);log.push(t);
  return amt;
}
SPEND_ARG['spend.consignSea']=SPEND_ARG['spend.consignLand']=a=>COMM_MAP[a]?COMM_MAP[a].short:a;
