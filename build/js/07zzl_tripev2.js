'use strict';
/* ★檔案總覽：出遊奇遇第二批與惡德累計（DESIGN_NOTES 第二百三十四、二百三十七節）
 * - 判定接在 07zzk_tripev.js 的 tripEnc 裡（三助開口之後、賣藥郎之前），一趟仍最多一件：
 *   寺社：贊助大相撲 → 落魄的手藝人 → 擦身而過；溫泉：漏夜倒貨的急商 → 擦身而過。四件各自一年最多出現一次（G.tripY）。
 * - 贊助大相撲：私房錢贊助，三旬後開場，那一旬所有貨物需求兩倍（sumoMult，03_market.js 的 demandEff）；只有需求，沒有節慶的其他效果。
 * - 落魄的手藝人：借他現款，之後九旬每旬送一批本業一般品（tripEvTick）；約兩成中途出事，只送到一半。
 * - 漏夜倒貨的急商：牌價四成買一批本業貨；三成是贓貨，六旬內五成被官差找上門（來訪事件 rushBust：打點或認罰）。
 * - 擦身而過：老隱居依惡德值給三種反應。惡德（G.evil）這裡只累計；判定與懲罰在 07zzj_komon.js。
 * - 存檔：G.tripY、G.sumo{turn,rem}、G.artisan{name,left,sent,stop,unit}、G.rushLot、G.rushBust、G.evil{v,log,met}，用到時才建立。
 * - 數值 ODDS.trip.sumo／artisan／rush／komon、ODDS.evil；台詞 LINES.trip.sumo／artisan／rush／komon；文字 trip.*、rush.*（01e）、新聞 sumo.*、artisan.*、rush.*（01g）。 */
/* ---------- 惡德：只累計 ---------- */
const evilOf=()=>G.evil||(G.evil={v:0,log:[]});
/** 記一筆惡德：kind＝kessho／assassin／arson／frame／suppress；half＝失手或事敗（減半）。 */
function evilAdd(kind,cid,half){
  if(!G||!ODDS.evil[kind])return;
  const E=evilOf(),x=ODDS.evil[kind]*(half?ODDS.evil.failMul:1);
  E.v=+(E.v+x).toFixed(2);E.log.push({t:G.turn,k:kind,c:cid||null,h:half?1:0});
}
/* ---------- 一年最多一次 ---------- */
const tripYearOK=k=>!(G.tripY&&G.tripY[k]===G.year);
const tripYearMark=k=>{(G.tripY=G.tripY||{})[k]=G.year};
const quoteNow=name=>{const m=G.mk[name];return (m&&m.quote>0)?m.quote:marketIndex(name)};
const plainComms=()=>tradeComms().filter(c=>!c.luxury);
/* ---------- 大相撲 ---------- */
function sumoActive(){return !!(G&&G.sumo&&G.sumo.turn===G.turn)}
/** 大相撲開場那一旬：所有貨物需求加倍。 */
function sumoMult(c){return sumoActive()?ODDS.trip.sumo.mult:1}
/** 幾旬後開場：撞到例會旬、本城節慶、大名行列就往後延。 */
function sumoAfter(){
  let n=ODDS.trip.sumo.after;const f=homeCity().special_festival,D=G.daimyo;
  for(let i=0;i<9;i++){const d=dateAfter(n);
    if(isMeetingDate(d.month,d.cycle)||(f&&f.month===d.month&&f.cycle===d.cycle)||(D&&D.y===d.year&&D.m===d.month&&D.c===d.cycle))n++;else break}
  return n;
}
/* ---------- 急商的貨 ---------- */
function rushOffer(){
  const O=ODDS.trip.rush,cs=plainComms();if(!cs.length)return null;
  const c=pick(cs),p=quoteNow(c.name)*O.price;
  const room=Math.max(0,Math.min(invCap()-invUsed(),itemCap(c.name)-(G.inv[c.name]||0)));
  const q=Math.floor(Math.min(rint(O.qty[0],O.qty[1]),room,Math.max(0,G.silver)/p));
  if(q<O.minQty)return null;
  return {name:c.name,q,amt:Math.max(1,Math.round(p*q)),val:Math.round(quoteNow(c.name)*q)};
}
/* ---------- 判定（由 tripEnc 呼叫）：有碰到就把 E.kind 填上並回傳 E ---------- */
function tripEnc2(k,E){
  const O=ODDS.trip;
  if(k==='temple'){
    if(!G.sumo&&tripYearOK('sumo')&&(G.gold||0)>=O.sumo.gold&&chance(O.sumo.p)){tripYearMark('sumo');E.kind='sumo';E.amt=O.sumo.gold;return E}
    if(!G.artisan&&tripYearOK('artisan')&&chance(O.artisan.p)){
      const cs=plainComms(),A=O.artisan,amt=Math.round(rint(A.amt[0],A.amt[1])/A.step)*A.step;
      if(cs.length&&G.silver>=amt){tripYearMark('artisan');E.kind='artisan';E.amt=amt;E.name=pick(cs).name;return E}
    }
  }
  if(k==='onsen'&&!G.rushLot&&!G.rushBust&&tripYearOK('rush')&&chance(O.rush.p)){
    const L=rushOffer();if(L){tripYearMark('rush');E.kind='rush';E.lot=L;return E}
  }
  if(tripYearOK('komon')&&chance(O.komon.p)){tripYearMark('komon');E.kind='komon';E.place=k;return E}
  return null;
}
/* ---------- 卡片 ---------- */
{const _c=tripEncCard;tripEncCard=function(E){
  const O=ODDS.trip;
  if(E.kind==='sumo'){const img=portraitFigure('monk',G.cityId,48),nm=UT('trip.fig.monk'),tag=UT('trip.figTag.monk');TRIP_ENC={kind:'sumo',amt:E.amt,img,nm,tag};
    return encWrap(tripCard(img,nm,tag,TX('trip.sumo.ask',{a:E.amt}),UT('trip.sumo.price',{a:E.amt}))+encBtns(UT('btn.tripSumoYes',{a:E.amt}),UT('btn.tripSumoNo')))}
  if(E.kind==='artisan'){const img=portraitFigure('artisan',G.cityId+'|'+G.year,48),nm=UT('trip.fig.artisan'),tag=UT('trip.figTag.artisan'),g=COMM_MAP[E.name].short;TRIP_ENC={kind:'artisan',amt:E.amt,name:E.name,img,nm,tag};
    return encWrap(tripCard(img,nm,tag,TX('trip.artisan.'+G.sysKey,{a:E.amt,g}),UT('trip.artisan.price',{a:E.amt,g}))+encBtns(UT('btn.tripArtYes',{a:E.amt}),UT('btn.tripArtNo')))}
  if(E.kind==='rush'){const img=portraitFigure('hawker',G.cityId+'|'+G.turn,48),nm=UT('trip.fig.rush'),tag=UT('trip.figTag.rush'),L=E.lot,g=COMM_MAP[L.name].short;TRIP_ENC={kind:'rush',lot:L,img,nm,tag};
    return encWrap(tripCard(img,nm,tag,TX('trip.rush.pitch',{g,q:L.q,a:L.amt}),UT('trip.rush.price',{g,q:L.q,a:L.amt}))+encBtns(UT('btn.tripRushYes',{a:L.amt}),UT('btn.tripRushNo')))}
  if(E.kind==='komon'){const K=O.komon,E_=evilOf(),v=E_.v,img=portraitFigure('elder','komon',48);E_.met=E.place;
    let mood='wary',foot='';
    if(!(v>0)){mood='clean';addStress('komon',-K.clean);foot=UT('trip.komon.eff.clean',{a:K.clean})}
    else if(v>=K.guiltyAt){mood='guilty';const s=rint(K.guilty[0],K.guilty[1]);addStress('komon',s);foot=UT('trip.komon.eff.guilty',{a:s})}
    return '<div class="small" style="margin:4px 0">'+esc(UT('trip.komon.lead.'+E.place))+'</div>'+tripCard(img,UT('trip.fig.elder'),UT('trip.figTag.elder'),TX('trip.komon.'+mood),foot)}
  return _c.apply(this,arguments);
}}
/* ---------- 選了之後 ---------- */
{const _r=tripEncResolve;tripEncResolve=function(yes,quiet){
  const P=TRIP_ENC;if(!P||!G||!['sumo','artisan','rush'].includes(P.kind))return _r.apply(this,arguments);
  TRIP_ENC=null;const O=ODDS.trip;let html='';
  if(P.kind==='sumo'){
    if(yes&&(G.gold||0)>=P.amt){G.gold-=P.amt;const n=sumoAfter(),d=dateLabel(dateAfter(n));G.sumo={turn:G.turn+n};
      html=tripCard(P.img,P.nm,P.tag,TX('trip.sumo.yes',{d}),UT('trip.sumo.yesEff',{a:P.amt,d}))}
    else html=tripCard(P.img,P.nm,P.tag,TX('trip.sumo.no'),'');
  }else if(P.kind==='artisan'){
    if(yes&&G.silver>=P.amt){const A=O.artisan,c=COMM_MAP[P.name],per=Math.max(1,Math.round((A.val[0]+A.val[1])/2/quoteNow(P.name)));
      payPublic('spend.artisan',P.amt);
      G.artisan={name:P.name,left:A.turns,sent:0,stop:chance(A.failP)?Math.floor(A.turns/2):0,unit:+(P.amt/(per*A.turns)).toFixed(2)};
      html=tripCard(P.img,P.nm,P.tag,TX('trip.artisan.paid'),UT('trip.artisan.yesEff',{a:P.amt,g:c.short}))}
    else html=tripCard(P.img,P.nm,P.tag,TX('trip.artisan.no'),'');
  }else if(P.kind==='rush'){const L=P.lot,c=COMM_MAP[L.name],R_=O.rush;
    const room=Math.max(0,Math.min(invCap()-invUsed(),itemCap(L.name)-(G.inv[L.name]||0)));
    if(yes&&G.silver>=L.amt&&room>=L.q){
      payPublic('spend.rush',L.amt);addStock(L.name,L.q,L.amt/L.q);stockAdd(L.name,L.q,false);
      if(chance(R_.blackP))G.rushLot={name:L.name,q:L.q,val:L.val,due:chance(R_.foundP)?G.turn+rint(1,R_.within):0,end:G.turn+R_.within};   // 贓貨：買下當下不知道
      html=tripCard(P.img,P.nm,P.tag,TX('trip.rush.paid'),UT('trip.rush.yesEff',{a:L.amt,g:c.short,q:L.q}))}
    else html=tripCard(P.img,P.nm,P.tag,TX('trip.rush.no'),'');
  }
  if(quiet){UI.render();return}
  const el=document.getElementById('trip-enc');if(el)el.outerHTML=html;
  sfx.tap();UI.render();
}}
/* ---------- 贓貨被找上門 ---------- */
const rushBribeCost=cid=>{const n=npc(cid);return inspectBribe(n&&n.pos?n.pos.rank:1)*ODDS.trip.rush.bribeX};
/** 結算：bribe＝打點壓下；否則沒收倉裡這批貨並罰銀。回傳訊息。 */
function rushResolve(bribe,log){
  const B=G.rushBust;if(!B)return '';const c=COMM_MAP[B.name],R_=ODDS.trip.rush;
  if(bribe){const cost=rushBribeCost(B.cid);if(G.silver<cost)return UT('rush.short');
    G.rushBust=null;payPublic('spend.rushBribe',cost);const h=addHeat(R_.heat);logRel(B.cid,UT('rush.log.bribe',{a:cost}));
    return UT('rush.bribed',{n:nameOf(B.cid)})+heatTail(h)}
  G.rushBust=null;
  const q=stockTake(B.name,Math.min(B.q,G.inv[B.name]||0)).qty,fine=Math.round(B.val*R_.fine);G.silver-=fine;
  const t=NEWS('rush.fineNews',{g:c?c.short:B.name,q:Math.round(q),f:fmt(fine)});pushNews(t);if(log)log.push(t);
  return t;
}
FACE_TITLE.rushBust='rush.title';
FACE_EXT.rushBust=(e,name)=>{
  const B=G.rushBust;if(!B||B.cid!==e.cid||B.turn!==e.turn)return null;const c=COMM_MAP[B.name];
  return {line:UT('rush.line',{g:c?c.short:B.name}),effect:UT('rush.eff',{f:fmt(Math.round(B.val*ODDS.trip.rush.fine))}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="rushBust" data-v="1">'+UT('btn.rushBribe',{c:coinHtml('silver',rushBribeCost(B.cid))})+'</button><button class="pixel-btn btn-sm" data-act="rushBust" data-v="0">'+UT('btn.rushPass')+'</button></div>'};
};
ACT.rushBust=el=>{
  const bribe=el.dataset.v==='1',m=rushResolve(bribe);
  if(G.rushBust){toast(m);return}                    // 現款不足：視窗留著
  toast(m,4200);if(bribe)sfx.coin();else sfx.bad();UI.hideInfo();UI.render();
};
/* ---------- 每旬（advanceTurn 的 daimyoTick 之後） ---------- */
function tripEvTick(log){
  const O=ODDS.trip,put=t=>{pushNews(t);log.push(t)};
  // 大相撲：前一旬提醒、當旬開場；撞期順延
  const S=G.sumo;
  if(S){
    if(S.turn===G.turn){
      if(festActive()||daimyoActive()||isMeetingTurn()){S.turn++;S.rem=true;put(NEWS('sumo.delay'))}
      else{const f=addFame(O.sumo.fame,'mid');put(NEWS(f>0?'sumo.open':'sumo.open0',{firm:G.firm,f}))}
    }else if(S.turn===G.turn+1&&!S.rem){S.rem=true;put(NEWS('sumo.remind'))}
    else if(S.turn<G.turn)G.sumo=null;
  }
  // 手藝人送貨
  const A=G.artisan;
  if(A){const c=COMM_MAP[A.name];
    if(!c||(A.stop&&A.sent>=A.stop)){G.artisan=null;put(NEWS('artisan.fail'))}
    else{
      const want=Math.max(1,Math.round(rint(O.artisan.val[0],O.artisan.val[1])/quoteNow(A.name)));
      const room=Math.max(0,Math.min(invCap()-invUsed(),itemCap(A.name)-(G.inv[A.name]||0))),q=Math.min(want,room);
      if(q>0){addStock(A.name,q,A.unit);stockAdd(A.name,q,false)}
      put(NEWS('artisan.send',{g:c.short,q,l:want-q>0?UT('rfav.lost',{n:want-q}):''}));
      A.sent++;A.left--;if(A.left<=0){G.artisan=null;put(NEWS('artisan.done'))}
    }
  }
  // 贓貨：上一旬沒處理的照認罰；到了被找上門的那一旬，官差來訪
  if(G.rushBust)rushResolve(false,log);
  const L=G.rushLot;
  if(L){
    if(L.due&&L.due<=G.turn){G.rushLot=null;
      const offs=officialsOf(G.cityId).filter(n=>n.pos&&n.pos.rank<=2&&!n.ronin);
      if(offs.length){const n=pick(offs);G.rushBust={cid:n.cid,turn:G.turn,name:L.name,q:L.q,val:L.val};queueFaceEvent({type:'rushBust',cid:n.cid,turn:G.turn});
        log.push(NEWS('rush.bust',{g:COMM_MAP[L.name]?COMM_MAP[L.name].short:L.name}))}
    }else if(!L.due&&L.end<G.turn)G.rushLot=null;
  }
}
