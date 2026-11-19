/* ═════ [07zzk_tripev] ═════ */
'use strict';
/* ★檔案總覽：出遊奇遇與季節小景（DESIGN_NOTES 第二百二十六～二百三十一節）
 * - 一趟出遊最多碰到一件奇遇，依序判定，碰到一件就停（tripEnc）：
 *   1 三助還錢（溫泉，上一趟交了 50／100 兩必定）→ 2 三獻茶（寺社，本城寺社累計香油錢達門檻，一局一次）
 *   → 3 三助開口（溫泉）→ 第二批奇遇（07zzl_tripev2.js）→ 4 賣藥郎（寺社、溫泉）→ 5 祈福（寺社，風聲 −1）。
 * - 不算奇遇：三助換人時新某助的那句話、季節小景（tripSeason）。
 * - 有選項的奇遇是結果視窗裡的一張卡（#trip-enc），按鈕當場換成結果；直接關掉視窗＝保守選項（不買、婉拒、留在寺裡）。
 * - 賣藥郎的藥效掛在 addStress 的「增加」那一頭：真藥擋掉、假藥加倍；減少照常。
 * - 存檔：G.pill{until,good,lv}、G.sansuke{gen,step,owe,flee,quit}、G.sansukeGone{t}、G.teaBoy，用到時才建立。
 * - 數值 ODDS.trip.pill／sansuke／tea／bless／season；台詞 LINES.trip.peddler／ssk／bless；文字 trip.*（01e）。 */
const TO=()=>ODDS.trip;
/* ---------- 賣藥郎 ---------- */
const pillOn=()=>!!(G&&G.pill&&G.pill.until>=G.turn);
const pillLv=()=>(G&&G.pill&&G.pill.lv)||0;
const pillPrice=()=>TO().pill.lv[pillLv()].price;
/** 藥效：真藥擋掉所有增加；假藥把增加加倍。臥病期間照舊不變動。 */
{const _a=addStress;addStress=function(key,v){
  if(!G||!(v>0)||key==='pill'||!pillOn()||((G.injured||0)>0&&G.injKind==='sick'))return _a.apply(this,arguments);
  if(G.pill.good){const L=G.stressCur||(G.stressCur=[]);[[key,v],['pill',-v]].forEach(([k,x])=>{const o=L.find(y=>y.k===k);if(o)o.v+=x;else L.push({k,v:x})});return 0}
  return _a(key,v)+_a('pill',v);
}}
/** 身心狀況視窗：服藥期間多一行。 */
{const _s=SHEETS.stress;SHEETS.stress=function(){const r=_s.apply(this,arguments);
  if(pillOn())r.html='<div class="notice tiny">'+UT(G.pill.good?'stress.pill.good':'stress.pill.bad',{a:G.pill.until-G.turn+1})+'</div>'+r.html;return r}}
/* ---------- 三助 ---------- */
const SSK=()=>G.sansuke||(G.sansuke={gen:3,step:0,owe:0,flee:false,quit:false});
/** 中文數字（三、十一、二十三……）。 */
function cnNum(n){const d='〇一二三四五六七八九';if(n<10)return d[n];if(n<20)return '十'+(n%10?d[n%10]:'');if(n<100)return d[Math.floor(n/10)]+'十'+(n%10?d[n%10]:'');return String(n)}
const sskName=g=>UT('trip.ssk.name',{n:cnNum(g)});
const sskImg=g=>portraitFigure('sansuke',g===3?G.cityId:G.cityId+'|'+g,48);
/* ---------- 判定 ---------- */
/** 這一趟碰到哪一件奇遇；溫泉先處理三助換人（不算奇遇，換人那一趟不開口）。 */
function tripEnc(k){
  if(TRIP_ENC)tripEncResolve(false,true);          // 上一趟的互動卡沒選就被收掉（例如直接推進）：照保守選項
  const O=TO(),E={};
  if(k==='onsen'){const S=SSK();
    if(S.flee||S.quit){E.swap={p:sskName(S.gen),q:sskName(S.gen+1),kind:S.flee?'flee':'quit'};if(S.flee)G.sansukeGone={t:G.turn};S.gen++;S.step=0;S.owe=0;S.flee=false;S.quit=false}
    if(S.owe>0){E.kind='repay';return E}
  }
  if(k==='temple'&&!G.teaBoy&&((G.templeGift||{})[G.cityId]||0)>=O.tea.gift){E.kind='tea';G.teaBoy=true;return E}
  if(k==='onsen'&&!E.swap){const S=SSK(),a=O.sansuke.ask[S.step];if(chance(O.sansuke.p)&&(G.gold||0)>=a){E.kind='ask';E.amt=a;return E}}
  if(tripEnc2(k,E))return E;                         // 第二批奇遇：大相撲、手藝人、急商、擦身而過（07zzl_tripev2.js）
  if(!pillOn()&&chance(O.pill.p)&&(G.gold||0)>=pillPrice()){E.kind='pill';E.lv=pillLv();E.amt=pillPrice();return E}
  if(k==='temple'&&(G.heat||0)>0&&chance(O.bless.p)){E.kind='bless';return E}
  return E;
}
/* ---------- 卡片 ---------- */
var TRIP_ENC=null;
const encBtns=(a,b)=>'<div class="grid2" style="margin:6px 0 8px"><button class="pixel-btn btn-gold btn-sm" data-act="tripEncYes">'+a+'</button><button class="pixel-btn btn-sm" data-act="tripEncNo">'+b+'</button></div>';
/** 互動卡：外層 #trip-enc，按鈕後整張換成結果卡。 */
const encWrap=(inner)=>'<div id="trip-enc">'+inner+'</div>';
/** 寺社的住持或巫女；祈福時接一句祈福的話，風聲 −1。 */
function tripFigCard(fig,worn,E){
  let line=TX('trip.'+fig+'.'+worn),foot='';
  if(E.kind==='bless'){const d=Math.min(TO().bless.heat,G.heat||0);G.heat=Math.max(0,(G.heat||0)-d);line+=TX('trip.bless.'+fig);foot=UT('trip.bless.eff',{a:TO().bless.heat})}
  return tripCard(portraitFigure(fig,G.cityId,48),UT('trip.fig.'+fig),UT('trip.figTag.'+fig),line,foot);
}
/** 溫泉的三助：換人的那句話、還錢、開口。 */
function tripSskCard(worn,E){
  const S=SSK(),img=sskImg(S.gen),nm=sskName(S.gen),tag=UT('trip.figTag.sansuke');
  let line=E.swap?TX('trip.ssk.'+E.swap.kind,E.swap):TX('trip.sansuke.'+worn);
  if(E.kind==='repay'){const a=S.owe;G.gold=(G.gold||0)+a;S.owe=0;return tripCard(img,nm,tag,TX('trip.ssk.back'),UT('trip.ssk.backEff',{a}))}
  if(E.kind==='ask'){TRIP_ENC={kind:'ask',amt:E.amt,step:S.step,img,nm,tag};
    return encWrap(tripCard(img,nm,tag,TX('trip.ssk.ask.'+S.step),UT('trip.ssk.ask',{a:E.amt}))+encBtns(UT('btn.tripSskPay',{a:E.amt}),UT('btn.tripSskNo')))}
  return tripCard(img,nm,tag,line,'');
}
/** 三獻茶、賣藥郎的卡（其他奇遇在住持、三助的卡上）。 */
function tripEncCard(E){
  if(E.kind==='tea'){const img=portraitFigure('novice',G.cityId,48);TRIP_ENC={kind:'tea',img};
    return encWrap('<div class="card" style="display:flow-root;margin-bottom:6px">'+img+'<div><b>'+esc(UT('trip.fig.novice'))+'</b> <span class="tag gray">'+esc(UT('trip.figTag.monk'))+'</span></div><div class="small" style="margin:5px 0">'+esc(UT('trip.tea.story'))+'</div></div>'+encBtns(UT('btn.tripTeaYes'),UT('btn.tripTeaNo')))}
  if(E.kind==='pill'){const img=portraitFigure('peddler',G.cityId,48),nm=UT('trip.fig.peddler'),tag=UT('trip.figTag.peddler');TRIP_ENC={kind:'pill',lv:E.lv,amt:E.amt,img,nm,tag};
    return encWrap(tripCard(img,nm,tag,TX('trip.peddler.'+['pitch','excuse','excuse2'][E.lv]),UT('trip.pill.price',{a:E.amt}))+encBtns(UT('btn.tripPillBuy',{a:E.amt}),UT('btn.tripPillNo')))}
  return '';
}
/** 選了之後：結算並把互動卡換成結果。yes＝買、交錢、帶走；否則保守選項。quiet＝視窗被關掉，不重畫。 */
function tripEncResolve(yes,quiet){
  const P=TRIP_ENC;TRIP_ENC=null;if(!P||!G)return;const O=TO();let html='';
  if(P.kind==='pill'){
    if(yes&&(G.gold||0)>=P.amt){G.gold-=P.amt;const good=chance(O.pill.lv[P.lv].good);
      G.pill={until:G.turn+O.pill.turns-1,good,lv:good?0:Math.min(P.lv+1,O.pill.lv.length-1)};
      html=tripCard(P.img,P.nm,P.tag,UT(good?'trip.pill.good':'trip.pill.bad'),UT(good?'trip.pill.goodEff':'trip.pill.badEff',{a:P.amt}))}
    else{if(G.pill)G.pill.lv=0;html=tripCard(P.img,P.nm,P.tag,UT('trip.pill.no'),'')}
  }else if(P.kind==='ask'){const S=SSK();
    if(yes&&(G.gold||0)>=P.amt){G.gold-=P.amt;if(P.step<O.sansuke.ask.length-1){S.owe=P.amt*O.sansuke.back;S.step++}else S.flee=true;
      html=tripCard(P.img,P.nm,P.tag,TX('trip.ssk.paid'),UT('trip.ssk.paidEff',{a:P.amt}))}
    else{if(P.step===O.sansuke.ask.length-1)S.quit=true;html=tripCard(P.img,P.nm,P.tag,TX('trip.ssk.no.'+P.step),'')}
  }else if(P.kind==='tea'){
    if(yes){const e=hireEmp(null,'apprentice'),T=O.tea,st=e.stats;
      ['commerce_skill','diplomacy_charm','integrity_loyalty'].forEach(s=>{st[s]=rint(T.hi[0],T.hi[1])});st.greed_index=rint(T.greed[0],T.greed[1]);st.betrayal_risk=rint(T.betray[0],T.betray[1]);
      e.homegrown=true;e.origin='tea';e.aff=T.aff;e.age0=G.year-10;
      html='<div class="card" style="display:flow-root;margin-bottom:6px">'+P.img+'<div class="small" style="margin:5px 0">'+esc(UT('trip.tea.yes',{n:e.name}))+'</div><div class="tiny" style="color:#9b2c3a">'+esc(UT('trip.tea.yesEff',{n:e.name}))+'</div></div>'}
    else html='<div class="card" style="display:flow-root;margin-bottom:6px">'+P.img+'<div class="small" style="margin:5px 0">'+esc(UT('trip.tea.no'))+'</div></div>';
  }
  if(quiet){UI.render();return}
  const el=document.getElementById('trip-enc');if(el)el.outerHTML=html;
  sfx.tap();UI.render();
}
ACT.tripEncYes=()=>tripEncResolve(true);
ACT.tripEncNo=()=>tripEncResolve(false);
/** 結果視窗直接關掉：照保守選項結算。 */
{const _h=UI.hideInfo;UI.hideInfo=function(){if(TRIP_ENC)tripEncResolve(false,true);return _h.apply(this,arguments)}}
/** 三獻茶帶回來的丁稚：員工卡多一個標籤。 */
{const _t=staffTags;staffTags=function(e){return _t.apply(this,arguments)+(e&&e.origin==='tea'?UT('staff.tagTea'):'')}}
/* ---------- 季節小景（不算奇遇；每趟都有） ---------- */
function tripSeason(k,withF,quiet){
  const s=season(),O=TO().season,R_={};
  if(k==='onsen'&&s==='winter'){addStress('season',-O.onsenWinter);R_.line=UT('trip.season.onsenWinter');R_.foot=UT('trip.season.relief',{s:UT('trip.season.n.onsenWinter'),r:O.onsenWinter})}
  else if(k==='temple'&&s==='autumn'){addStress('season',-O.templeAutumn);R_.line=UT('trip.season.templeAutumn');R_.foot=UT('trip.season.relief',{s:UT('trip.season.n.templeAutumn'),r:O.templeAutumn})}
  else if(k==='temple'&&s==='spring'){R_.line=UT('trip.season.templeSpring');if(withF)R_.aff=O.templeSpringAff}
  return R_;
}
/* ---------- 番付八卦：被搓澡的騙走五百兩 ---------- */
{const _g=bzGossip;bzGossip=function(){const out=_g.apply(this,arguments),L=bzLast();
  if(G.sansukeGone&&G.sansukeGone.t>(L?L.turn:-1)&&!out.some(g=>g.key==='meScam')){if(out.length>=BZ().gossip[1])out.pop();out.push({key:'meScam',about:['me'],truth:true})}
  return out}}

/* ═════ [07zzl_tripev2] ═════ */
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

/* ═════ [07zzm_kake] ═════ */
'use strict';
/* ★檔案總覽：定約掛賣（旅商的合約供貨；DESIGN_NOTES 第二百三十五、二百三十八、二百三十九節）
 * - 解鎖：畫面上的市佔第一次超過一成（G.kakeOn，永久）。之後每旬隨機 3～5 位本城旅商人帶「求掛賣」標記（G.kakeMarks）。
 * - 談掛賣：拜訪帶標記的旅商人打勝、好感 ≥60、有空閒番頭，請託多一項（dealerReqs）；好感 100 的旅商人偶爾自己上門（回府時事件 kakeAsk）。
 *   先開方案選單（kakePickHtml：低價數量多／中價中數量／高價數量少／放棄），選定才立約（kakeSign）。
 * - 合約 G.kake[]：{id,cid,name,unit,qty,total,dep,left,start,done,filled,banto,plan,gain}；一位番頭一張、一位旅商人一張。
 *   立約當旬收手付（兩成）；下一旬起連續九旬，每旬推進時在自動出貨之前由番頭交貨（kakeDeliver）。不算本城出貨。
 *   保留的貨仍在 G.inv 裡，以合約的 filled 記數（kakeHeld）；出貨拉霸與預設出貨都扣掉它。旬初自動填貨（kakeFill），可再按「填貨」。
 * - 交不齊＝失約（好感、知名度下降，已交的照算）；九旬交完，剩下八成掛金記成賣掛 G.kakeRecv[]，下一旬收帳：可能拖一季，也可能貸倒。
 * - 每旬 kakeTick（advanceTurn 的 f8Tick 之後）：解鎖、番頭異動、收帳、標記、主動上門、自動填貨。
 * - 數值 ODDS.kake；台詞 LINES.kake；文字 kake.*（01e）、新聞 kake.*（01g）。 */
const KK=()=>ODDS.kake;
/** 礦產的掛賣比較大：每張約總資產五分之一、不超過旅商身代六成（第二百七十八節）。 */
const kakeK=k=>{const K=KK();return G&&G.sysKey==='mining'&&K.mining&&K.mining[k]!=null?K.mining[k]:K[k]};
const kakeList=()=>G.kake||(G.kake=[]);
const kakeRecvList=()=>G.kakeRecv||(G.kakeRecv=[]);
const kakeOn=()=>!!(G&&G.kakeOn);
const kakeMarked=cid=>!!(G.kakeMarks&&G.kakeMarks.t===G.turn&&G.kakeMarks.ids.includes(cid));
/** 這位旅商人手上有沒有合約。 */
const kakeWith=cid=>!!(G&&G.kake&&G.kake.some(c=>c.cid===cid));
/** 掛賣以外、共用合約格式的約定（第二百五十一節）：上貢、本陣御用達。依交貨先後排（掛賣最先，再上貢、本陣）。
 *  回傳 [{kind,ref,cid,name,qty,due,left}]：ref 是原本的存檔物件（保留量記在 ref.filled）；due＝這次推進就要交。
 *  第二百五十六節起再加御救販售、闇商代出（每項貨一列），排在本陣之後。
 *  上貢在推進後的年度結算前交（upkeep），所以到期前一旬就算「這次要交」；本陣御用達在自動出貨之前交。 */
function pactExtras(){
  const L=[];if(!G)return L;
  const T=G.tribute;if(T&&COMM_MAP[T.name])L.push({kind:'tribute',ref:T,cid:T.cid,name:T.name,qty:T.qty,due:G.turn+1>=T.due});
  const H=G.honjin;if(H&&COMM_MAP[H.name])L.push({kind:'honjin',ref:H,cid:H.cid,name:H.name,qty:H.qty,due:G.turn>=H.start,left:H.left});
  const K=G.kyusai;if(K&&K.items)K.items.forEach(it=>{if(COMM_MAP[it.name])L.push({kind:K.kind==='riot'?'heika':'kyusai',ref:it,cid:K.cid,name:it.name,qty:it.qty,due:G.turn>=K.start,left:K.left})});   // 御救販售（07zzq_urge.js）
  const Y=G.yami;if(Y&&Y.items)Y.items.forEach(it=>{if(COMM_MAP[it.name])L.push({kind:'yami',ref:it,cid:Y.cid,name:it.name,qty:it.qty,due:G.turn>=Y.start,left:Y.left})});   // 闇商代出
  return L;
}
/** 所有合約，依交貨先後：掛賣（早簽的在前）→ 上貢 → 本陣御用達。每筆 {kind,ref,cid,name,qty,due}，保留量在 ref.filled。 */
function pactAll(){return kakeList().map(c=>({kind:'kake',ref:c,cid:c.cid,name:c.name,qty:c.qty,due:kakeDue(c)})).concat(pactExtras())}
/** 某項貨被合約保留的數量（仍在倉裡，不能出貨）。 */
function kakeHeld(name){return G?pactAll().reduce((s,p)=>s+(p.name===name?(p.ref.filled||0):0),0):0}
/** 扣掉掛賣保留後，可以自由出貨的庫存。 */
const kakeFree=name=>Math.max(0,(G.inv[name]||0)-kakeHeld(name));
/** 能接掛賣的番頭（大番頭、臨時打工的差配人不算；關押中、借出去的不算）。 */
const kakeBantos=()=>(G.emps||[]).filter(e=>e.rank==='banto'&&!jailedEmp(e)&&!empLent(e));
const kakeFreeBanto=()=>kakeBantos().find(e=>!kakeList().some(c=>c.banto===e.id));
const kakeItems=()=>tradeComms().filter(c=>!c.luxury);
/** 有效總資產：現款＋庫存（按上一旬收市價）－借款－還沒履約完的手付。 */
function kakeAssets(){return Math.max(0,bzWorth('me')-kakeList().reduce((s,c)=>s+c.dep,0))}
/** 這位旅商人這一旬想訂的貨與方案（同一人同一旬固定貨物；數量照當下的資產）。 */
function kakeOffer(cid){
  const K=KK(),cs=kakeItems(),n=npc(cid);if(!cs.length||!n)return null;
  const c=cs[Math.floor(seeded('kake|'+cid+'|'+G.turn)()*cs.length)],quote=marketQuote(c.name);
  const cap=Math.max(1,Math.floor(itemCap(c.name)*K.capHalf)),worth=bzInit(n).bzw*kakeK('worthCap'),base=kakeAssets()*kakeK('frac');
  const plans=[];let prev=Infinity;
  for(const P of K.plans){
    const unit=Math.max(0.1,Math.round(quote*P.p*10)/10);
    let q=Math.round(Math.min(base*P.q,worth)/K.turns/unit);
    if(!plans.length)q=Math.max(1,q);
    q=Math.min(q,cap,prev-1);if(q<1)break;
    const total=Math.round(unit*q*K.turns);
    plans.push({k:P.k,unit,qty:q,total,dep:Math.round(total*K.dep)});prev=q;
  }
  return plans.length?{cid,name:c.name,plans}:null;
}
/* ---------- 請託與方案選單 ---------- */
const kakeShop=cid=>{const L=Ls('kake.shop.'+G.sysKey);return L[Math.floor(seeded('kakeShop|'+cid)()*L.length)]};
/** 拜訪請託：解鎖、帶標記、他手上沒有合約、有空閒番頭才出現。 */
function kakeReq(cid){
  if(!kakeOn()||!kakeMarked(cid)||kakeWith(cid)||!kakeFreeBanto())return null;
  const O=kakeOffer(cid);if(!O)return null;
  return {k:'kake',name:UT('kake.req'),desc:UT('kake.req.d',{g:COMM_MAP[O.name].short})};
}
{const _d=dealerReqs;dealerReqs=function(cid){const L=_d.apply(this,arguments),n=npc(cid);if(n&&n.role==='guest'&&dealReady(cid)){const r=kakeReq(cid);if(r)return [r].concat(L)}return L}}
/** 方案選單（src：req＝拜訪請託、home＝主動上門）。 */
function kakePickHtml(cid,src){
  const O=kakeOffer(cid);if(!O)return '<div class="notice">'+UT('kake.none')+'</div>';
  UI.s.kakeOffer=O;
  const c=COMM_MAP[O.name],K=KK(),big=O.plans[0].total>=K.bigTotal;
  let h='<div class="card" style="display:flow-root">'+portraitHtml(cid,56)+'<div><b>'+esc(nameOf(cid))+'</b> <span class="tag gray">'+esc(ROLE_LABEL.guest||'')+'</span></div><div class="small" style="margin:5px 0">「'+esc(TX('kake.pitch',{shop:kakeShop(cid),g:c.short}))+esc(TX(big?'kake.scale.big':'kake.scale.small'))+'」</div></div>';
  h+='<div class="tiny muted" style="margin:4px 0">'+UT('kake.pick.note',{g:esc(c.short),p:fmt1(marketQuote(O.name)),t:K.turns})+'</div>';
  O.plans.forEach(p=>{
    h+='<div class="card" style="margin-top:4px"><div class="row"><b class="small">'+UT('kake.plan.'+p.k)+'</b><b style="color:#9b2c3a">'+UT('kake.plan.per',{q:p.qty,u:fmt1(p.unit)})+'</b></div>'
      +'<div class="tiny muted" style="margin:3px 0">'+UT('kake.plan.sum',{q:p.qty*K.turns,a:fmt(p.total),d:fmt(p.dep),r:fmt(p.total-p.dep)})+'</div>'
      +'<button class="pixel-btn btn-sm btn-gold" data-act="kakeTake" data-cid="'+cid+'" data-k="'+p.k+'">'+UT('btn.kakeTake')+'</button></div>';
  });
  h+='<div style="margin-top:6px"><button class="pixel-btn btn-sm" data-act="kakePass" data-src="'+(src||'req')+'">'+UT('btn.kakePass')+'</button></div>';
  return h;
}
{const _r=ACT.reqAsk;ACT.reqAsk=function(el){
  if(el.dataset.k==='kake'){BT=null;UI.showInfo(UT('kake.pick.t',{a:nameOf(el.dataset.cid)}),kakePickHtml(el.dataset.cid,'req'));return}
  return _r.apply(this,arguments)}}
ACT.kakePass=()=>{UI.s.kakeOffer=null;UI.hideInfo();UI.render()};
ACT.kakeTake=el=>{
  const O=UI.s.kakeOffer,cid=el.dataset.cid;if(!O||O.cid!==cid)return;
  const p=O.plans.find(x=>x.k===el.dataset.k);if(!p)return;
  const m=kakeSign(cid,O.name,p);UI.s.kakeOffer=null;
  UI.showInfo(UT('kake.pick.t',{a:nameOf(cid)}),portraitHtml(cid,56)+'<div class="notice" style="margin-top:6px">'+esc(m)+'</div><button class="pixel-btn btn-sm" data-act="reqDone" style="margin-top:6px">'+UT('cm.ok')+'</button>');
  sfx.coin();UI.render();refreshSheet();
};
/** 立約：收手付、指派番頭；下一旬起交貨。 */
function kakeSign(cid,name,p){
  const e=kakeFreeBanto();if(!e||kakeWith(cid))return UT('kake.none');
  const K=KK(),c=COMM_MAP[name];
  kakeList().push({id:G.turn+'_'+Math.floor(rnd()*1e5),cid,name,unit:p.unit,qty:p.qty,total:p.total,dep:p.dep,left:K.turns,start:G.turn+1,done:0,filled:0,banto:e.id,plan:p.k,gain:0});
  G.silver+=p.dep;G.carryIn=G.carryIn||{};G.carryIn.kake=(G.carryIn.kake||0)+p.dep;e.kakeIn=(e.kakeIn||0)+p.dep;
  const r=R(cid);if(!r.bond)r.bond={mult:1,label:UT('kake.bond'),introId:null};r.met=true;addKnown(cid);
  logRel(cid,UT('kake.log.sign',{g:c.short,q:p.qty,t:K.turns}));
  const t=NEWS('kake.sign',{n:nameOf(cid),g:c.short,q:p.qty,d:fmt(p.dep)});pushNews(t);
  return UT('kake.signed',{n:nameOf(cid),g:c.short,q:p.qty,u:fmt1(p.unit),d:fmt(p.dep),b:e.name});
}
/* ---------- 主動上門（回府時事件） ---------- */
FACE_TITLE.kakeAsk='kake.ask.t';
FACE_EXT.kakeAsk=(e,name)=>{
  if(kakeWith(e.cid)||!kakeFreeBanto()||!kakeOffer(e.cid))return null;
  return {line:TX('kake.ask',{shop:kakeShop(e.cid)}),effect:UT('kake.ask.eff'),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="kakeAskYes" data-cid="'+e.cid+'">'+UT('btn.kakeAskYes')+'</button><button class="pixel-btn btn-sm" data-act="faceNext">'+UT('btn.kakeAskNo')+'</button></div>'};
};
ACT.kakeAskYes=el=>{UI.showInfo(UT('kake.pick.t',{a:nameOf(el.dataset.cid)}),kakePickHtml(el.dataset.cid,'home'))};
/* ---------- 填貨 ---------- */
/** 保留量不能超過倉裡實際有的（被別的用途拿走、損耗、失火時，從晚簽的合約扣起）。 */
function kakeSync(){
  const L=pactAll(),names=[...new Set(L.map(p=>p.name))];
  names.forEach(n=>{let over=kakeHeld(n)-(G.inv[n]||0);
    for(let i=L.length-1;i>=0&&over>0;i--){const p=L[i];if(p.name!==n)continue;const d=Math.min(p.ref.filled||0,over);p.ref.filled=(p.ref.filled||0)-d;over-=d}});   // 從交貨順序最後的扣起
}
function kakeDue(c){return c.start<=G.turn}
/** 一次交清、可以提早填貨的合約：上貢、貴人訂貨、軍需注文。 */
const pactOnce=p=>p.kind==='tribute'||p.kind==='patron'||p.kind==='govW';
/** 把倉裡的貨填進要交的合約（照交貨先後）；回傳填了幾單位。
 *  自動（旬初）只填這次推進就要交的；手動按「填貨」時，上貢不到期也先填（一次交清，可以提早備）。 */
function kakeFill(manual){
  kakeSync();let n=0;
  pactAll().filter(p=>p.due||(manual&&pactOnce(p))).forEach(p=>{const d=Math.min(p.qty-(p.ref.filled||0),Math.floor(kakeFree(p.name)));if(d>0){p.ref.filled=(p.ref.filled||0)+d;n+=d}});
  return n;
}
/** 這次推進就要交、還沒備齊的合約（推進前提醒、紅點用）：回傳 [{kind,cid,name,qty,filled}]。 */
const kakeGaps=()=>{kakeSync();return pactAll().filter(p=>p.due&&(p.ref.filled||0)<p.qty).map(p=>({kind:p.kind,cid:p.cid,name:p.name,qty:p.qty,filled:p.ref.filled||0}))};
ACT.kakeFill=()=>{const n=kakeFill(true),g=kakeGaps().length;toast(UT(n?(g?'kake.fill.part':'kake.fill.ok'):'kake.fill.none',{n}));if(n)sfx.tap();UI.render();
  if(!$('#info-bd').classList.contains('hidden')&&KAKE_WARN){UI.hideInfo()}};
/* ---------- 交貨（每旬推進一開始，自動出貨之前；此時日期還沒前進，due＝G.turn+2 才是「下一旬的旬報收帳」） ---------- */
function kakeEnd(c){G.kake=kakeList().filter(x=>x!==c)}
/** 失約：有多少交多少，合約結束；下一旬照已交的貨值結算，扣掉手付（多收的退還）。 */
function kakeFail(c,log,why){
  const K=KK(),g=COMM_MAP[c.name],r=R(c.cid),net=Math.round(c.done*c.unit)-c.dep;
  setAff(r,Math.max(0,r.aff-K.failAff));loseFame('kakeFail');logRel(c.cid,UT('kake.log.fail',{a:K.failAff}));
  kakeRecvList().push({cid:c.cid,name:c.name,amt:net,due:G.turn+2,sure:true,banto:c.banto,gain:c.gain||0});
  kakeEnd(c);
  const t=NEWS(why==='banto'?'kake.fail.banto':'kake.fail',{n:nameOf(c.cid),g:g?g.short:c.name,a:K.failAff});pushNews(t);if(log)log.push(t);
}
function kakeDeliver(log){
  if(!G.kake||!G.kake.length)return;
  kakeSync();
  kakeList().filter(kakeDue).forEach(c=>{
    const q=stockTake(c.name,Math.min(c.filled||0,G.inv[c.name]||0)).qty;
    c.done+=q;c.filled=0;c.gain=(c.gain||0)+Math.max(0,(marketQuote(c.name)-c.unit)*q);
    if(q<c.qty){kakeFail(c,log);return}
    c.left--;
    if(c.left<=0){
      kakeRecvList().push({cid:c.cid,name:c.name,amt:c.total-c.dep,due:G.turn+2,banto:c.banto,gain:c.gain||0});kakeEnd(c);
      logRel(c.cid,UT('kake.log.done'));
      const t=NEWS('kake.done',{n:nameOf(c.cid),g:COMM_MAP[c.name].short,a:fmt(c.total-c.dep)});pushNews(t);log.push(t);
    }
  });
}
/* ---------- 每旬 ---------- */
const kakeInc=(k,v)=>{if(TURNRP)TURNRP[k]=(TURNRP[k]||0)+v};
function kakeTick(log){
  const K=KK(),put=t=>{pushNews(t);log.push(t)};
  if(disasterNow())G.kakeDisY=G.year;
  // 解鎖：市佔第一次超過一成
  if(!G.kakeOn&&G.sysKey==='mining'){G.kakeOn=true;put(NEWS('kake.unlockMine'))}   // 礦產開局就解鎖（舊存檔在這裡補）
  if(!G.kakeOn&&G.share&&G.share.me>K.unlock){G.kakeOn=true;put(NEWS('kake.unlock'))}
  // 番頭異動：轉給空閒的番頭，沒人可接就失約
  kakeList().slice().forEach(c=>{
    const e=(G.emps||[]).find(x=>x.id===c.banto);
    if(e&&e.rank==='banto'&&!jailedEmp(e))return;
    const f=kakeFreeBanto();if(f)c.banto=f.id;else kakeFail(c,log,'banto');
  });
  // 收帳
  G.kakeRecv=kakeRecvList().filter(r=>{
    if(r.due>G.turn)return true;
    const n=npc(r.cid),rel=R(r.cid),g=COMM_MAP[r.name]?COMM_MAP[r.name].short:r.name,who=nameOf(r.cid);
    const e=(G.emps||[]).find(x=>x.id===r.banto),pay=v=>{G.silver+=v;if(v>0){kakeInc('kakeFin',v);if(e)e.kakeIn=(e.kakeIn||0)+v}};
    if(n&&n.role==='guest'&&r.gain>0){bzInit(n);n.bzPend=(n.bzPend||0)+Math.round(r.gain);r.gain=0}   // 轉手利潤記進他的身代
    if(r.sure){pay(r.amt);put(NEWS(r.amt>=0?'kake.settle':'kake.refund',{n:who,a:fmt(Math.abs(r.amt))}));return false}
    const gone=!n||!alive(r.cid)||n.cityId!==G.cityId||n.hired;
    const skill=e?statsOfEmp(e).commerce_skill:0;
    const pBad=gone?K.goneBad:Math.max(0,K.bad-Math.floor(skill/K.skillPer)*K.skillCut)*(G.kakeDisY===G.year?K.disasterX:1);
    if(chance(pBad)){
      const got=(gone||chance(0.5))?Math.round(r.amt/2):0,loss=r.amt-got;pay(got);
      setAff(rel,Math.max(0,rel.aff-K.badAff));logRel(r.cid,UT('kake.log.bad',{a:fmt(loss)}));
      if(n&&n.role==='guest'){bzInit(n);n.bzPend=(n.bzPend||0)+loss}
      put(NEWS(got?'kake.bad.half':'kake.bad.all',{n:who,g,a:fmt(got),l:fmt(loss)}));return false;
    }
    if(!r.late&&!gone&&chance(K.late*clamp((100-rel.aff)/(100-K.aff),0,1))){r.late=true;r.due=G.turn+K.lateTurns;put(NEWS('kake.late',{n:who,a:fmt(r.amt)}));return true}
    pay(r.amt);put(NEWS('kake.paid',{n:who,g,a:fmt(r.amt)}));return false;
  });
  if(G.kakeOn){
    // 本旬帶「求掛賣」標記的旅商人
    const L=cityNpcs(G.cityId,'guest').filter(n=>alive(n.cid)&&!n.hired&&!jailed(n)&&!isEnemy(n.cid));
    G.kakeMarks={t:G.turn,ids:shuffle(L).slice(0,rint(K.marks[0],K.marks[1])).map(n=>n.cid)};
    // 好感滿的旅商人自己上門（一旬最多一位）
    if(kakeFreeBanto()){const c=L.filter(n=>G.rel[n.cid]&&G.rel[n.cid].bond&&G.rel[n.cid].aff>=K.selfAff&&!kakeWith(n.cid)).find(()=>chance(K.selfP));
      if(c&&kakeOffer(c.cid))queueHomeEvent({type:'kakeAsk',cid:c.cid})}
  }
  kakeFill();                                       // 旬初自動填貨
}
/* ---------- 推進前的缺貨確認 ---------- */
let KAKE_SKIP=false,KAKE_WARN=false;
function kakeGuard(n){
  if(KAKE_SKIP){KAKE_SKIP=false;return false}
  const L=kakeGaps();if(!L.length)return false;
  let h='<p class="small">'+UT('kake.warn')+'</p>'+L.map(c=>'<div class="row small" style="margin-top:3px;color:#b3261e"><span>'+esc(nameOf(c.cid))+'·'+esc(COMM_MAP[c.name].short)+'</span><b>'+UT('kake.warn.row',{n:c.qty-(c.filled||0)})+'</b></div>').join('');
  h+='<div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button class="pixel-btn btn-gold" style="flex:1 1 100%;padding:8px" data-act="kakeFill">'+UT('btn.kakeFill')+'</button><button class="pixel-btn" style="flex:1 1 0;padding:8px" data-act="kakeSkip" data-n="'+(n||1)+'">'+UT('btn.kakeSkip')+'</button><button class="pixel-btn" style="flex:1 1 0;padding:8px" data-act="kakeBack">'+UT('btn.vQBack')+'</button></div>';
  KAKE_WARN=true;UI.showInfo(UT('kake.warn.t'),h);sfx.tap();
  return true;
}
ACT.kakeSkip=el=>{KAKE_SKIP=true;KAKE_WARN=false;if(voyQPending())VOYQ_SKIP=true;UI.hideInfo();doTurn(Number(el.dataset.n)||1)};
ACT.kakeBack=()=>{KAKE_WARN=false;UI.hideInfo();UI.go('market')};
{const _h=UI.hideInfo;UI.hideInfo=function(){KAKE_WARN=false;return _h.apply(this,arguments)}}
/* ---------- 畫面 ---------- */
/** 相場頁的「📦 合約」卡（原行情表的位置）：定約掛賣、上貢、本陣御用達每張一列，一個「填貨」按鈕（第二百五十一節）。都沒有、掛賣也沒解鎖時不出現。 */
function kakeCard(){
  const X=pactExtras();if(!kakeOn()&&!X.length)return '';
  const L=kakeList();kakeSync();
  let h='<div class="card" id="kake-card" style="background:#fff8eb"><div class="row"><b class="small">'+UT('kake.card.t')+'</b>'+(kakeOn()?'<span class="tiny muted">'+UT('kake.card.cap',{n:L.length,m:kakeBantos().length})+'</span>':'')+'</div>';
  if(!L.length&&!X.length)return h+'<div class="tiny muted" style="margin-top:4px">'+UT(kakeBantos().length?'kake.card.none':'kake.card.noBanto')+'</div></div>';
  let gap=0,early=0;
  const row=(cid,name,right,lack,sub,who)=>'<div style="margin-top:5px;padding-top:4px;border-top:1px dashed #b5a98f"><div class="row small" data-act="focus" data-n="'+esc(name)+'" style="cursor:pointer"><span><b>'+esc(nameOf(cid))+'</b>·'+esc(COMM_MAP[name].short)+'</span><b'+(lack>0?' style="color:#b3261e"':'')+'>'+right+'</b></div><div class="row tiny muted"><span>'+sub+'</span><span>'+who+'</span></div></div>';
  h+=L.map(c=>{const e=(G.emps||[]).find(x=>x.id===c.banto),due=kakeDue(c),lack=due?c.qty-(c.filled||0):0;if(lack>0)gap++;
    return row(c.cid,c.name,due?(lack>0?UT('kake.row.lack',{f:c.filled||0,q:c.qty,n:lack}):UT('kake.row.full',{q:c.qty})):UT('kake.row.next',{q:c.qty}),lack,UT('kake.row.sub',{u:fmt1(c.unit),l:c.left}),UT('kake.row.banto',{b:esc(e?e.name:'')}))}).join('');
  h+=X.map(p=>{const f=p.ref.filled||0,lack=p.due?p.qty-f:0;if(lack>0)gap++;if(!p.due&&pactOnce(p)&&f<p.qty)early++;
    let right,sub;
    if(pactOnce(p)){const t=Math.max(0,p.ref.due-G.turn);right=f>=p.qty?UT('pact.trib.full',{q:p.qty}):lack>0?UT('kake.row.lack',{f,q:p.qty,n:lack}):UT('pact.trib.prep',{f,q:p.qty});sub=p.kind==='tribute'?UT(t<=1?'pact.trib.subNow':'pact.trib.sub',{t}):UT(t<=1?'pact.'+p.kind+'.subNow':'pact.'+p.kind+'.sub',{t,u:fmt1(p.ref.unit)})}
    else{right=p.due?(lack>0?UT('kake.row.lack',{f,q:p.qty,n:lack}):UT('kake.row.full',{q:p.qty})):UT('kake.row.next',{q:p.qty});sub=UT('pact.'+p.kind+'.sub',{l:p.left})}
    return row(p.cid,p.name,right,lack,sub,UT('pact.self'))}).join('');
  const can=gap||early;
  h+='<div style="margin-top:6px"><button class="pixel-btn btn-sm btn-gold" data-act="kakeFill" '+(can?'':'disabled')+'>'+UT(can?'btn.kakeFill':'btn.kakeFilled')+'</button></div>';
  return h+'<div class="tiny muted" style="margin-top:4px">'+UT('kake.card.note')+'</div></div>';
}
/** 進出貨拉霸下方的折線圖（這項貨近期的收市價）。 */
function priceChart(name){
  const h=(G.mk[name]&&G.mk[name].hist)||[];if(h.length<2)return '';
  const W=300,H=54,mn=Math.min(...h),mx=Math.max(...h),rg=Math.max(0.0001,mx-mn),up=h[h.length-1]>=h[h.length-2];
  const pts=h.map((v,i)=>(4+i*((W-8)/(h.length-1))).toFixed(1)+','+(H-6-((v-mn)/rg)*(H-14)).toFixed(1)).join(' ');
  return '<div style="border-top:1px dashed #b5a98f;padding-top:4px;margin-top:4px"><div class="row tiny muted"><span>'+UT('mk.chart.t')+'</span><span>'+UT('mk.chart.range',{a:fmt1(mn),b:fmt1(mx)})+'</span></div><svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:54px;display:block"><polyline fill="none" stroke="'+(up?'#b3261e':'#1e7e34')+'" stroke-width="2" points="'+pts+'"/></svg></div>';
}
/** 本旬買賣面板上的保留提示。 */
const kakeHeldNote=name=>{const n=kakeHeld(name);return n>0?'<div class="tiny" style="margin:2px 0;color:#27407a">'+UT('kake.held',{n})+'</div>':''};
/** 人物卡上的標記。 */
function kakeTag(cid){
  if(!kakeOn())return '';
  return kakeWith(cid)?'<span class="tag green">'+UT('kake.tag.on')+'</span>':kakeMarked(cid)?'<span class="tag gold">'+UT('kake.tag')+'</span>':'';
}
/** 現款走勢：借款卡下方的「賣掛」。 */
function kakeRecvCard(){
  const L=kakeRecvList().filter(r=>!r.sure).slice().sort((a,b)=>a.due-b.due);
  if(!kakeOn()&&!L.length)return '';
  let h='<div class="card" style="margin-top:8px"><b class="small">'+UT('kake.recv.t')+'</b>';
  if(!L.length)return h+'<div class="tiny muted" style="margin-top:2px">'+UT('kake.recv.none')+'</div></div>';
  L.forEach(r=>{const left=Math.max(0,r.due-G.turn);h+='<div class="row tiny" style="margin-top:2px"><span>'+esc(nameOf(r.cid))+(r.late?UT('kake.recv.late'):'')+'</span><b style="white-space:nowrap;margin-left:6px">'+UT('silver.debtCard.5',{a:fmt(r.amt),b:left?UT('kake.recv.due',{a:left}):UT('kake.recv.now')})+'</b></div>'});
  return h+'</div>';
}
{const _d=debtCard;debtCard=function(){return _d.apply(this,arguments)+kakeRecvCard()}}
/* ---------- 其他系統的銜接 ---------- */
/** 有合約在身的旅商人不能延攬進店。 */
{const _e=enlistRanks;enlistRanks=function(cid){return kakeWith(cid)?[]:_e.apply(this,arguments)}}

/* ═════ [07zzn_outfriend] ═════ */
'use strict';
/* ★檔案總覽：外城友人（DESIGN_NOTES 第二百四十、二百四十一節；遷居在 07zzr_move.js）
 * - 外城友人＝住在別座城、由船長或飛腳牽線（或遠國奉行引薦、作客時經友人引見）結識的商人（旅商人、仲買人、差配人、同業）。
 *   記在交情紀錄 r.out；人數不限。每位船長、飛腳在一座城只認識一位（e.ofCity[城]＝人物代號），再去改為順道問候。
 * - 結識與問候：包在 resolveVoyage 外層——那一趟有買到貨（本業貨或他行貨）才有機會牽線；已有相熟的人就順道問候，那趟買價便宜一成。
 * - 寄信（ACT.ofLetter）：每封扣 1 點行動，同一人一旬一封（r.ltrT，與外地官員共用 07zz_letters.js 的 letterUsed／letterSpend）；好感最多加到 60。
 * - 探聽買付（ACT.ofIntel）：好感 60 以上的友人，寄信改為寫信探聽他那個地區本年度下一次的大口買付；照寄信扣行動、付送信費與禮金，不扣好感（第二百六十七節）。
 * - 來訪：好感 60 以上的友人偶爾來訪（旬報後的來訪事件 ofCome），一旬最多一位。
 * - 出遊訪友（ACT.ofTrip）：本旬約定、下一旬動身，離家 1～4 旬（G.away{cid,start,len,until}）；離家期間沒有行動點數，店務照遠島的做法（06_ui.js 的 awayMode）。
 * - 注文：好感 40 以上的友人來信訂貨（回府時事件 chumon），接下後六旬內由船長或飛腳整批送去（商路頁 chumonCard、ACT.cmGo），貨款現銀帶回；
 *   送貨沿用卸留請負的外運航程（s.out，outboundSettle 外層接手 s.out.chumon）。同時能接的筆數＝船長（海路）或飛腳（陸路）的人數。
 * - 遠國奉行「引薦外城商人」（rintro）。筆記名冊多一個「外城」分類。每旬 outTick（advanceTurn 的 kakeTick 之後）。
 * - 數值 ODDS.out；台詞 LINES.of；文字 of.*、cm.*（01e）；新聞 of.*、cm.*（01g）。 */
const OF=()=>ODDS.out;
const OF_ROLES=['guest','broker','manager','rival'];
/** 是不是外城友人：有交情、標記為外城往來、人還在世、住在別座城。 */
function isOutFriend(cid){const n=npc(cid),r=G.rel[cid];return !!(n&&r&&r.out&&r.bond&&alive(cid)&&n.cityId&&n.cityId!==G.cityId&&!n.hired&&OF_ROLES.includes(n.role))}
const outFriends=()=>Object.keys(G.rel||{}).filter(isOutFriend);
const outCity=cid=>CITY(npc(cid).cityId);
/** 某座城裡還不認識、可以結識的商人。 */
const outCands=cityId=>cityNpcs(cityId).filter(n=>OF_ROLES.includes(n.role)&&alive(n.cid)&&!n.hired&&!jailed(n)&&!(G.rel[n.cid]&&(G.rel[n.cid].bond||G.rel[n.cid].met))&&!G.known.includes(n.cid));
/** 結為外城友人。 */
function outMake(cid,label,aff,via){
  const r=R(cid);r.out=true;r.met=true;r.seen=true;r.bond={mult:1,label,introId:null};setAff(r,Math.max(r.aff||0,aff));if(via)r.outVia=via;addKnown(cid);
}
/* ---------- 船長、飛腳牽線與順道問候 ---------- */
{const _rv=resolveVoyage;resolveVoyage=function(s,log){
  const O=OF(),e=(G.emps||[]).find(x=>x.id===s.capt),ct=CITY(s.origId),old=e&&e.ofCity&&e.ofCity[s.origId],greet=!!(old&&isOutFriend(old)&&npc(old).cityId===s.origId);
  if(greet&&!s.out)s.cheap=true;                          // 相熟的人幫忙張羅：這趟買價便宜一成
  const top=G.voyLog&&G.voyLog[0],r=_rv.apply(this,arguments),E=G.voyLog&&G.voyLog[0];
  if(!e||!ct||!E||E===top)return r;
  const crew=NM('crew',s.mode);
  if(greet){if(s.out&&s.out.chumon)return r;            // 替他送注文那一趟不另算順道問候
    const rel=R(old),bought=!s.out&&E.items.some(x=>x.cost>0);setAff(rel,clamp(rel.aff+O.greetAff,0,100));logRel(old,UT('of.log.greet',{k:crew,e:e.name,g:O.greetAff}));
    E.lines.push(NEWS(bought?'of.greet':'of.greet.out',{c:ct.name,m:nameOf(old),g:O.greetAff}))}
  else if(!s.out&&(E.kind==='own'||E.kind==='cross')&&E.items.some(x=>x.cost>0)&&chance(O.meetP)){   // 有買到貨才有機會牽線
    const L=outCands(s.origId);
    if(L.length){const n=pick(L);outMake(n.cid,UT('of.bond.'+s.mode),O.meetAff,e.id);(e.ofCity=e.ofCity||{})[s.origId]=n.cid;
      logRel(n.cid,UT('of.log.meet',{k:crew,e:e.name}));
      const t=NEWS('of.meet',{k:crew,e:e.name,c:ct.name,role:ROLE_LABEL[n.role]||'',m:nameOf(n.cid)});E.lines.push(t);pushNews(t)}
  }
  return r;
}}
/* ---------- 寄信 ---------- */
SPEND_ARG['spend.ofLetter']=a=>nameOf(a);
const ofLetterCost=cid=>OF().letterFee+btTiers(cid)[1];
/** 寄信不能寄的原因（空字串＝可以寄）：作客期間（約好到回來）、本旬已寄給他、交情已到書信的上限、成仇。 */
function ofLetterBlock(cid){
  if(isEnemy(cid))return 'of.letter.enemy';
  if(G.away)return 'of.letter.away';
  if(letterUsed(cid))return 'of.letter.used';
  if(R(cid).aff>=OF().letterCap)return 'of.letter.full';
  return '';
}
ACT.ofLetter=el=>{
  const cid=el.dataset.cid,O=OF(),r=R(cid);if(!isOutFriend(cid))return;
  {const b=ofLetterBlock(cid);if(b){toast(UT(b));return}}
  if(r.aff>=O.letterCap){toast(UT('of.letter.full'));return}
  const amt=ofLetterCost(cid);if(G.silver<amt){toast(UT('of.letter.short',{a:fmt(amt)}));return}
  if(!letterSpend(cid))return;
  payPublic('spend.ofLetter|'+cid,amt);
  const gain=Math.max(0,Math.min(rint(O.letterGain[0],O.letterGain[1]),O.letterCap-r.aff));
  setAff(r,clamp(r.aff+gain,0,100));logRel(cid,UT('of.log.letter',{a:fmt(amt),g:gain}));
  toast(UT('of.letter.sent',{n:nameOf(cid),a:fmt(amt),g:gain}),4200);sfx.gift();UI.render();refreshSheet();
};
/* ---------- 探聽買付（好感 60 以上，取代寄信；第二百六十七節） ---------- */
/** 探聽不了的原因（空字串＝可以探聽）。 */
function ofIntelBlock(cid){
  if(isEnemy(cid))return 'of.letter.enemy';
  if(G.away)return 'of.letter.away';
  if(letterUsed(cid))return 'of.letter.used';
  const I=buyoutNextOf(outCity(cid).region_id);
  if(!I)return 'of.intel.none';
  if(I.known)return 'of.intel.known';
  return '';
}
ACT.ofIntel=el=>{
  const cid=el.dataset.cid;if(!isOutFriend(cid)||R(cid).aff<OF().letterCap)return;
  const rid=outCity(cid).region_id,b=ofIntelBlock(cid);
  if(b){const I=buyoutNextOf(rid);toast(UT(b,{r:REG_NAME(rid),m:I?buyoutMonth(I.m,I.rid):''}));return}
  const amt=ofLetterCost(cid);if(G.silver<amt){toast(UT('of.letter.short',{a:fmt(amt)}));return}
  const I=buyoutIntelFor(rid);if(!I)return;
  if(!letterSpend(cid))return;
  payPublic('spend.ofLetter|'+cid,amt);buyoutDiscover(I.y,I.rid,I.m);
  logRel(cid,UT('of.log.intel',{a:fmt(amt),r:REG_NAME(rid),m:buyoutMonth(I.m,I.rid)}));
  toast(UT('of.intel.ok',{n:nameOf(cid),a:fmt(amt),r:REG_NAME(rid),m:buyoutMonth(I.m,I.rid)}),6000);sfx.gift();UI.render();refreshSheet();
};
/* ---------- 出遊訪友 ---------- */
/** 離家作客中（這一旬人不在店裡）。 */
function visitAway(){const A=G&&G.away;return !!(A&&G.turn>=A.start&&G.turn<=A.until)}
/** 作客要離家幾旬：同地區 1～2 旬、外地 3～4 旬（搭客船、乘轎，比貨船快）。 */
function ofTripLen(cid){
  const a=homeCity(),b=outCity(cid);
  if(a.region_id===b.region_id)return distTurns(a,b,'land')<=1?1:2;
  return distTurns(a,b,'sea')<=3?3:4;
}
const ofTripCost=cid=>OF().tripGold*ofTripLen(cid);
function ofTripBlock(cid){
  const O=OF();
  if(isEnemy(cid))return 'of.letter.enemy';
  if(G.away)return 'of.trip.busy';
  if((G.exile||0)>0||(G.injured||0)>0)return 'of.trip.hurt';
  if(R(cid).aff<O.visitAff)return 'of.trip.need';
  if((G.gold||0)<ofTripCost(cid))return 'of.trip.gold';
  return '';
}
ACT.ofTrip=el=>{
  const cid=el.dataset.cid;if(!isOutFriend(cid))return;
  const b=ofTripBlock(cid);if(b){toast(UT(b,{a:fmt(ofTripCost(cid))}));return}
  const len=ofTripLen(cid),cost=ofTripCost(cid);
  G.gold-=cost;G.away={cid,start:G.turn+1,len,until:G.turn+len,cost};
  toast(UT('of.trip.booked',{n:nameOf(cid),c:outCity(cid).name,t:len,a:fmt(cost)}),5200);sfx.step();UI.render();refreshSheet();
};
/** 出遊面板下半部：外城友人（分隔線、狀態列、地區頁籤、人物卡；DESIGN_NOTES 第二百四十四節）。 */
function tripFriendCard(){
  const A=G.away,all=outFriends();
  let h='<div class="trip-sep"><span>'+UT('trip.friend')+'</span></div><div class="tiny muted" style="margin:0 0 4px">'+UT('trip.friend.d')+'</div>';
  if(A&&npc(A.cid))h+='<div class="notice tiny" style="color:#27407a">'+UT(visitAway()?'trip.friend.gone':'trip.friend.away',{n:esc(nameOf(A.cid)),c:outCity(A.cid).name,t:visitAway()?A.until-G.turn+1:A.len})+UT('trip.friend.stop')+'</div>';
  if(!all.length)return h+'<div class="tiny" style="color:#b3392b">'+UT('trip.friend.none')+'</div>';
  const regs=REG_LIST.filter(rg=>all.some(c=>outCity(c).region_id===rg.id));
  let tab=UI.s.ofTab||'all';if(tab!=='all'&&!regs.some(rg=>rg.id===tab))tab=UI.s.ofTab='all';
  const tabs=[['all',UT('ppl.yamen.2'),all.length]].concat(regs.map(rg=>[rg.id,UT('rmap.reg.'+rg.id),all.filter(c=>outCity(c).region_id===rg.id).length]));
  const L=(tab==='all'?all:all.filter(c=>outCity(c).region_id===tab)).sort((a,b)=>isEnemy(a)-isEnemy(b)||R(b).aff-R(a).aff);
  return h+tabPills(tabs,tab,'ofTab')+L.map(cid=>personBlock(cid,'out')).join('')+'<div class="tiny muted" style="margin-top:4px">'+UT('trip.friend.foot')+'</div>';
}
ACT.ofTab=el=>{UI.s.ofTab=el.dataset.k;refreshSheet()};
/** 人物卡上的住處一行。 */
const outWhereLine=cid=>'<div class="tiny" style="color:#27407a;margin-top:2px">'+UT('of.card.where',{r:REG_NAME(outCity(cid).region_id),c:outCity(cid).name})+'</div>';
/** 外城友人卡的指令列：寄信（好感 60 以上改為探聽買付）、作客；下面一行說明為什麼按不了。 */
function outRowHtml(cid){
  const O=OF(),r=R(cid),tb=ofTripBlock(cid),intel=r.aff>=O.letterCap;
  const lb=intel?ofIntelBlock(cid):ofLetterBlock(cid),coin=coinHtml('silver',ofLetterCost(cid));
  const lt=lb==='of.letter.used'?UT('btn.ofLetterUsed'):lb==='of.letter.away'?UT('btn.ofLetterAway'):lb==='of.letter.enemy'?UT('btn.ofLetterEnemy'):intel?(lb?UT('btn.ofIntelOff'):UT('btn.ofIntel',{c:coin})):UT('btn.ofLetter',{c:coin});
  let h='<div class="row" style="justify-content:flex-start;gap:4px;flex-wrap:wrap;margin-top:5px"><button class="pixel-btn btn-sm" data-act="'+(intel?'ofIntel':'ofLetter')+'" data-cid="'+cid+'" '+(lb?'disabled':'')+'>'+lt+'</button>'
    +'<button class="pixel-btn btn-sm btn-gold" data-act="ofTrip" data-cid="'+cid+'" '+(tb?'disabled':'')+'>'+UT('btn.ofTrip',{n:ofTripLen(cid),c:coinHtml('gold',ofTripCost(cid))})+'</button></div>';
  if(intel&&(lb==='of.intel.none'||lb==='of.intel.known')){const I=buyoutNextOf(outCity(cid).region_id);h+='<div class="tiny muted" style="margin-top:2px">'+UT(lb,{r:REG_NAME(outCity(cid).region_id),m:I?buyoutMonth(I.m,I.rid):''})+'</div>'}
  else if(intel&&!lb)h+='<div class="tiny muted" style="margin-top:2px">'+UT('of.intel.hint',{r:REG_NAME(outCity(cid).region_id)})+'</div>';
  if(tb&&tb!=='of.trip.busy')h+='<div class="tiny muted" style="margin-top:2px">'+UT(tb==='of.trip.need'?'of.card.low':tb,{a:fmt(ofTripCost(cid))})+'</div>';
  return h;
}
/* ---------- 來訪、作客歸來的來訪視窗 ---------- */
FACE_TITLE.ofCome='of.come.t';FACE_TITLE.ofBack='of.back.t';
FACE_EXT.ofCome=(e,name)=>({line:TX('of.come'),effect:UT('of.come.eff',{n:name,g:e.g,r:OF().comeRelief})});
FACE_EXT.ofBack=(e,name)=>({line:TX('of.back'),effect:UT('of.back.eff',{n:name,g:e.g,r:OF().tripRelief})+(e.meet&&CH(e.meet)?UT('of.back.meet',{c:e.city,m:nameOf(e.meet)}):'')});
/* ---------- 注文 ---------- */
const chumonList=()=>G.chumon||(G.chumon=[]);
/** 還能接幾筆：海路看船長人數、陸路看飛腳人數，一人一筆。 */
const chumonRoom=mode=>(G.emps||[]).filter(e=>e.rank===MODE_RANK[mode]&&!jailedEmp(e)&&!empLent(e)).length-chumonList().filter(o=>o.mode===mode).length;
/** 送得到那座城的方式（要有當地許可、也要還有人手）。 */
function chumonMode(ct){for(const m of ['sea','land']){if(chumonRoom(m)>0&&destList(m).some(x=>x.ct.id===ct.id))return m}return null}
/** 擲一筆注文（沒有合適的人或貨就回傳 null）。 */
function chumonRoll(){
  const O=OF(),L=shuffle(outFriends().filter(c=>R(c).aff>=O.chumonAff&&!chumonList().some(o=>o.cid===c)));
  for(const cid of L){
    const ct=outCity(cid),mode=chumonMode(ct);if(!mode)continue;
    const prod=cityProds(ct),cs=tradeComms().filter(c=>!c.luxury&&!prod.includes(c.name));if(!cs.length)continue;
    const c=pick(cs),qty=Math.max(1,Math.min(Math.round(capOf(c.name,mode)*(0.4+0.6*rnd())),itemCap(c.name)));
    const up=O.chumonUp[0]+(O.chumonUp[1]-O.chumonUp[0])*clamp((R(cid).aff-O.chumonAff)/(100-O.chumonAff),0,1);
    return {cid,city:ct.id,name:c.name,qty,unit:Math.round(marketQuote(c.name)*(1+up)*10)/10,mode};
  }
  return null;
}
FACE_TITLE.chumon='cm.t';
FACE_EXT.chumon=(e,name)=>{
  const o=e.o;if(!o||!isOutFriend(o.cid)||chumonRoom(o.mode)<=0||chumonList().some(x=>x.cid===o.cid))return null;
  UI.s.chumonOffer=o;const c=COMM_MAP[o.name];
  return {line:TX('of.cm',{g:c.short}),effect:UT('cm.eff',{c:CITY(o.city).name,g:c.short,q:o.qty,u:fmt1(o.unit),a:fmt(Math.round(o.unit*o.qty)),t:OF().chumonTurns,m:NM('crew',o.mode)}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="cmTake">'+UT('btn.cmTake')+'</button><button class="pixel-btn btn-sm" data-act="faceNext">'+UT('btn.cmPass')+'</button></div>'};
};
ACT.cmTake=()=>{
  const o=UI.s.chumonOffer;UI.s.chumonOffer=null;if(!o||!isOutFriend(o.cid))return UI.hideInfo();
  if(chumonRoom(o.mode)<=0){toast(UT('cm.full'));return UI.hideInfo()}
  const O=OF(),c=COMM_MAP[o.name];
  chumonList().push(Object.assign({id:G.turn+'_'+Math.floor(rnd()*1e5),until:G.turn+O.chumonTurns-1,sent:false},o));
  logRel(o.cid,UT('of.log.cmTake',{g:c.short,q:o.qty}));
  toast(UT('cm.taken',{n:nameOf(o.cid),g:c.short,q:o.qty,t:O.chumonTurns,c:CITY(o.city).name}),4600);sfx.tap();UI.hideInfo();UI.render();
};
/** 商路頁的「📜 注文」卡：每筆一張，選人、回程委託金、裝貨出發。 */
function chumonCard(){
  const L=chumonList();if(!L.length)return '';
  const ST=UI.s.cm||(UI.s.cm={});
  return L.map((o,i)=>{
    const c=COMM_MAP[o.name],ct=CITY(o.city),nm=esc(nameOf(o.cid));
    let h='<div class="card warn"><b class="small">'+UT('cm.card.t')+'</b>';
    if(o.sent)return h+'<div class="tiny">'+UT('cm.card.sent',{n:nm,c:ct.name,g:c.short,q:o.qty})+'</div></div>';
    h+='<div class="tiny">'+UT('cm.card.sub',{n:nm,c:ct.name,g:c.short,q:o.qty,u:fmt1(o.unit),t:Math.max(0,o.until-G.turn+1),m:NM('crew',o.mode)})+'</div>';
    const caps=idleCaptains(o.mode),S=ST[o.id]||(ST[o.id]={});
    if(!caps.length)return h+'<div class="tiny muted" style="margin-top:4px">'+UT('r4.card.noCrew',{m:NM('crew',o.mode)})+'</div></div>';
    if(!caps.some(e=>e.id===S.capt))S.capt=caps[0].id;
    const have=kakeFree(o.name),ok=have>=o.qty;
    h+='<div style="margin-top:4px">'+caps.map(e=>'<span class="pill '+(e.id===S.capt?'on':'')+'" data-act="cmCapt" data-o="'+o.id+'" data-id="'+e.id+'">'+esc(e.name)+'</span>').join('')+'</div>';
    if(!ok)h+='<div class="tiny" style="color:#b3392b;margin-top:4px">'+UT('cm.card.noStock',{g:c.short,q:o.qty,h:have})+'</div>';
    const maxB=Math.floor(Math.max(0,G.silver-voyQTotal())/50)*50,bMax=maxB>=100?maxB:0;
    S.budget=clamp(Math.floor((S.budget||0)/50)*50,0,bMax);if(S.budget>0&&S.budget<100)S.budget=100;
    h+='<div class="row small" style="margin-top:4px"><span>'+UT('r4.card.budget')+'</span><b id="cm-b-v'+i+'">'+UT('r4.card.budgetVal',{a:fmt(S.budget)})+'</b></div>';
    h+=stepRow('<input id="cm-b'+i+'" type="range" min="0" max="'+Math.max(50,bMax)+'" value="'+S.budget+'" step="50" data-chg="cmBudget" data-o="'+o.id+'" data-lbl="cm-b-v'+i+'" data-snap="100" data-prev="'+S.budget+'" data-unit="'+esc(UT('r4.card.budgetVal',{a:'#'}))+'"'+(bMax<100?' disabled':'')+'>','cm-b'+i,bMax<100||S.budget<=0,bMax<100||S.budget>=bMax);
    h+='<button class="pixel-btn btn-gold" style="width:100%;margin-top:6px" data-act="cmGo" data-o="'+o.id+'" '+(!ok||apLeft()<=0?'disabled':'')+'>'+UT('btn.cmGo')+'</button>';
    return h+'<div class="tiny muted" style="margin-top:3px">'+UT('cm.card.foot')+'</div></div>';
  }).join('');
}
ACT.cmCapt=el=>{const S=UI.s.cm||(UI.s.cm={});(S[el.dataset.o]=S[el.dataset.o]||{}).capt=el.dataset.id;renderRoutes()};
CHG.cmBudget=el=>{const S=UI.s.cm||(UI.s.cm={});(S[el.dataset.o]=S[el.dataset.o]||{}).budget=snapVal(el);renderRoutes()};
/** 裝貨出發：整批一趟送去，扣 1 行動點數。 */
ACT.cmGo=el=>{
  const o=chumonList().find(x=>x.id===el.dataset.o),S=(UI.s.cm||{})[el.dataset.o]||{};if(!o||o.sent)return;
  if(banditBlocks(o.mode)){toast(UT('bandit.notice.'+o.mode,{n:banditLeft()}),4200);return}
  if(o.mode==='sea'&&seaFear()){toast(UT('f8.fearNote',{n:seaFearLeft()}),4200);return}
  if((G.injured||0)>0){toast(MSG(hurtKey('sendVoyage.hurt'),{injured:G.injured}),4200);return}
  const cap=idleCaptains(o.mode).find(e=>e.id===S.capt);if(!cap){toast(MSG('sendVoyage.2',{mode:NM('crew',o.mode)}));return}
  const ct=CITY(o.city),dl=destList(o.mode).find(x=>x.ct.id===ct.id);
  if(!dl){toast(MSG('sendVoyage.4',{REG_NAME:REG_NAME(ct.region_id),sea:(o.mode==='sea'?UT('voy.sendVoyage'):UT('voy.sendVoyage.2'))}),4200);return}
  if(kakeFree(o.name)<o.qty){toast(UT('cm.card.noStock',{g:COMM_MAP[o.name].short,q:o.qty,h:kakeFree(o.name)}));return}
  const b=Math.floor(S.budget||0);if(b>0&&b<100){toast(MSG('sendVoyage.5'));return}
  if(b>G.silver){toast(MSG('sendVoyage.6',{budget:fmt(b)}));return}
  if(!spendAP()){toast(MSG('sendVoyage.ap'));return}
  let d=dl.d;if(o.mode==='land'){if(G.flags.horse>0)d--;if(G.flags.road)d--;d=Math.max(1,d)}
  const unit=avgCostOf(o.name);stockTake(o.name,o.qty,false);
  if(b>0)payPublic('spend.voyage|'+ct.id,b);
  const st=statsOfEmp(cap),risk=voyRisk(cap,d,o.mode)*(o.mode==='sea'&&G.flags.escort>0?ODDS.voyageRisk.escortMul:1);
  const bo=buyoutSnapshot(ct),rank=b>0?originTripTake(ct.id):0;
  G.ships.push({id:G.turn+'_'+Math.floor(rnd()*1e5),entrust:true,origId:ct.id,mode:o.mode,eta:d,eta0:d,risk,riskGo:risk,feeMul:(G.flags.taxfree>0?0.5:1)*(1-Math.min(0.3,0.1*(G.flags.charter||0))),cheap:G.flags.cheap>0,cost:b,budget:b,start:G.turn,capt:cap.id,captName:cap.name,cs:st.commerce_skill,ca:st.audacity_courage,
    buyout:bo.hit,buyoutY:bo.y,buyoutM:bo.m,buyoutRegion:bo.rid,supplyY:G.year,supplyM:G.month,supplyRank:rank,unl:unloadProds(ct.id),out:{name:o.name,q:o.qty,unit,chumon:o.id}});
  o.sent=true;delete (UI.s.cm||{})[o.id];save();
  playFx(o.mode==='sea'?'boat':'cart',MSG('voyage.depart'),ct.name,()=>{toast(UT('cm.go',{n:cap.name,g:COMM_MAP[o.name].short,q:o.qty,c:ct.name,d}),4200);UI.render()},1000);
};
/** 歸來時：去程遇險、交貨、把貨款帶回（接手 s.out.chumon；其餘照卸留請負）。 */
{const _os=outboundSettle;outboundSettle=function(s,E,log){
  const O=s.out;if(!O||!O.chumon)return _os.apply(this,arguments);
  const K=OF(),c=COMM_MAP[O.name],o=chumonList().find(x=>x.id===O.chumon);
  const robbed=banditRobs(s.mode),go=robbed||chance(s.riskGo||s.risk||0);
  const lost=go?Math.round(O.q*ODDS.unloadJob.lossRate):0,got=O.q-lost,pay=Math.round(got*(o?o.unit:marketQuote(O.name)));
  if(o){G.chumon=chumonList().filter(x=>x!==o);
    if(got>0&&G.rel[o.cid]){const r=R(o.cid);setAff(r,clamp(r.aff+K.chumonDone,0,100));logRel(o.cid,UT('of.log.cm',{q:got,g:K.chumonDone}))}}
  E.lines.push(NEWS('cm.line',{g:c.short,q:O.q,got,lost:lost?UT('r4.out.lost',{n:lost}):'',m:o?nameOf(o.cid):'',a:fmt(pay)}));
  E.items.push({n:UT('r4.out.item',{g:c.short}),q:O.q,unit:O.q?pay/O.q:0,cost:0,lost});
  E.outPay=pay;E.outGo=go;if(lost>0)E.lossVal=(E.lossVal||0)+lost*marketQuote(O.name);
  return pay;
}}
/* ---------- 遠國奉行：引薦外城商人 ---------- */
function outIntroCands(n){
  const rid=regOfNpc(n),have=new Set(outFriends().map(c=>npc(c).cityId));
  return CITIES.filter(c=>c.region_id===rid&&c.id!==G.cityId&&!have.has(c.id)).reduce((a,c)=>a.concat(outCands(c.id)),[]);
}
REG_FAVORS.push({k:'rintro',name:UT('fav.rintro'),rank:6,cd:12,pos:['reg_09'],desc:UT('fav.rintro.d'),avail:n=>outIntroCands(n).length>0});
REG_FAVOR.rintro=n=>{
  const L=outIntroCands(n);if(!L.length)return UT('of.intro.none');
  const m=pick(L);outMake(m.cid,UT('of.bond.intro'),OF().introAff);logRel(m.cid,UT('of.log.intro',{n:nameOf(n.cid)}));
  return UT('of.intro.ok',{c:CITY(m.cityId).name,m:nameOf(m.cid)});
};
/* ---------- 每旬 ---------- */
function outTick(log){
  const O=OF(),put=t=>{pushNews(t);log.push(t)};
  // 出遊訪友：動身、離家、歸來
  const A=G.away;
  if(A){
    if(!npc(A.cid)||!alive(A.cid)){G.gold=(G.gold||0)+(A.cost||0);G.away=null;put(NEWS('of.trip.cancel',{m:nameOf(A.cid)}))}
    else if(G.turn===A.start&&((G.exile||0)>0||(G.injured||0)>0)){G.gold=(G.gold||0)+(A.cost||0);G.away=null;put(NEWS('of.trip.cancel',{m:nameOf(A.cid)}))}
    else if(G.turn>A.until){
      const r=R(A.cid),ct=outCity(A.cid);setAff(r,clamp(r.aff+O.tripAff,0,100));addStress('ofTrip',-O.tripRelief);logRel(A.cid,UT('of.log.trip',{t:A.len,g:O.tripAff}));
      let meet=null;if(chance(O.tripMeetP)){const L=outCands(ct.id);if(L.length){meet=pick(L).cid;outMake(meet,UT('of.bond.friend'),O.meetAff);logRel(meet,UT('of.log.viaFriend',{n:nameOf(A.cid)}))}}
      G.away=null;put(NEWS('of.trip.back',{c:ct.name}));queueFaceEvent({type:'ofBack',cid:A.cid,g:O.tripAff,meet,city:ct.name});
    }else{
      if(G.turn===A.start)put(NEWS('of.trip.go',{c:outCity(A.cid).name,m:nameOf(A.cid),t:A.len}));
      G.ap=0;
      const boss=G.emps.find(e=>e.rank==='chief');
      if(boss)log.push(NEWS('of.trip.chief',{n:boss.name}));
      else{const loss=Math.round(Math.max(0,G.silver)*O.awayLoss);G.silver-=loss;log.push(NEWS('of.trip.loss',{a:fmt(loss)}))}
    }
  }
  // 注文：逾期沒送出去就失約
  chumonList().slice().forEach(o=>{
    if(o.sent||o.until>=G.turn)return;
    G.chumon=chumonList().filter(x=>x!==o);
    if(G.rel[o.cid]){const r=R(o.cid);setAff(r,Math.max(0,r.aff-O.chumonFail));logRel(o.cid,UT('of.log.cmFail',{g:O.chumonFail}))}
    put(NEWS('cm.fail',{m:nameOf(o.cid),g:COMM_MAP[o.name]?COMM_MAP[o.name].short:o.name,a:O.chumonFail}));
  });
  if(visitAway())return;
  const F=outFriends();if(!F.length)return;
  // 來訪：好感夠深的友人，一旬最多一位
  const c=shuffle(F.filter(x=>R(x).aff>=O.visitAff)).find(()=>chance(O.comeP));
  if(c&&(G.exile||0)<=0){const r=R(c);setAff(r,clamp(r.aff+O.comeAff,0,100));addStress('ofCome',-O.comeRelief);logRel(c,UT('of.log.come',{g:O.comeAff}));
    put(NEWS('of.come',{c:outCity(c).name,m:nameOf(c)}));queueFaceEvent({type:'ofCome',cid:c,g:O.comeAff})}
  // 注文狀：排進回府時事件
  if(chance(O.chumonP)){const o=chumonRoll();if(o)queueHomeEvent({type:'chumon',cid:o.cid,o})}
}
/* ---------- 筆記名冊：外城分類與人物卡 ---------- */
NOTE_FILTERS.splice(NOTE_FILTERS.length-1,0,['out',UT('opt.nf_out')]);
/** 名冊清單；「外城」分類照地區、城市分組。 */
function noteListHtml(list,f){
  if(f!=='out')return list.slice(0,40).map(x=>noteCard(x)).join('');
  const key=x=>{const ct=outCity(x.id);return ct.region_id+'|'+ct.id};
  const L=list.slice().sort((a,b)=>key(a).localeCompare(key(b))||b.r.aff-a.r.aff).slice(0,60);let last='';
  return L.map(x=>{const ct=outCity(x.id),k=key(x),hd=k!==last?'<div class="small bold" style="margin:6px 0 2px">'+UT('of.group',{r:REG_NAME(ct.region_id),c:ct.name})+'</div>':'';last=k;return hd+noteCard(x)}).join('');
}
/** 外城友人的名冊卡：住處與來歷；展開時提示寄信、作客要到「外城出遊」（第二百四十四節）。 */
{const _n=noteCard;noteCard=function(x,pop){
  let h=_n.apply(this,arguments);if(!G||!isOutFriend(x.id))return h;
  const cid=x.id,open=pop||UI.s.openNote===cid;
  let add=outWhereLine(cid);
  if(open&&!pop){
    add+='<div class="tiny muted" style="margin-top:2px">'+UT('of.card.hint')+'</div>';
    return h.replace(/<\/div><\/div>$/,add+'</div></div>');
  }
  return h.replace(/<\/div>$/,add+'</div>');
}}
/* ---------- 淡忘：兩年沒往來，從外城友人名單刪除，變回完全的陌生人（DESIGN_NOTES 第二百六十四節） ----------
 * - r.ofT＝最後一次往來的旬：結識（outMake）與任何記進往來紀錄的事（寄信、作客、來訪、注文、順道問候……）都會更新。
 * - 滿一年半人物卡標「久未聯絡」；滿兩年刪除交情資料（好感 0、往來紀錄、交情來歷），仇人也一樣；船長、飛腳在那座城牽過線的紀錄一併清掉。
 * - 不淡忘：約定遷居的友人、注文還沒送完、正在他家作客。舊存檔沒有 r.ofT：第一次檢查時從那一旬起算。數值 ODDS.outFriend.forget／forgetWarn。 */
{const _om=outMake;outMake=function(cid){const r=_om.apply(this,arguments);R(cid).ofT=G.turn;return r}}
{const _lr=logRel;logRel=function(cid){const r=_lr.apply(this,arguments);if(G&&G.rel[cid]&&isOutFriend(cid))G.rel[cid].ofT=G.turn;return r}}
const ofIdle=cid=>{const r=G.rel[cid];if(r.ofT===undefined)r.ofT=G.turn;return G.turn-r.ofT};
const ofKeep=cid=>(G.move&&G.move.cid===cid)||chumonList().some(o=>o.cid===cid)||(G.away&&G.away.cid===cid);
function ofForgetTick(log){
  const O=OF();let n=0;
  outFriends().forEach(cid=>{
    if(ofKeep(cid)){G.rel[cid].ofT=G.turn;return}
    if(ofIdle(cid)<O.forget)return;
    delete G.rel[cid];G.known=G.known.filter(c=>c!==cid);
    (G.emps||[]).forEach(e=>{if(e.ofCity)Object.keys(e.ofCity).forEach(k=>{if(e.ofCity[k]===cid)delete e.ofCity[k]})});
    n++;
  });
  if(n){const t=NEWS('of.forget');pushNews(t);log.push(t)}
}
{const _ot=outTick;outTick=function(log){const r=_ot.apply(this,arguments);ofForgetTick(log);return r}}
/** 人物卡：久未聯絡的提醒。 */
{const _o=outRowHtml;outRowHtml=function(cid){const h=_o.apply(this,arguments),d=G.rel[cid]?ofIdle(cid):0,O=OF();
  return (d>=O.forgetWarn&&!ofKeep(cid)?'<div class="tiny" style="color:#b3392b;margin-top:3px">'+UT('of.card.idle',{n:Math.max(1,O.forget-d)})+'</div>':'')+h}}

/* ═════ [07zzo_dealings] ═════ */
'use strict';
/* ★檔案總覽：商行往來（私宅頁的資訊清單；DESIGN_NOTES 第二百四十二節）
 * - 把眼下還沒了結的帳、約與差事列在一處：錢銀往來、合約與訂貨、在途的人與貨、官府的事、人情往來。
 * - 只是資訊，沒有操作；要處理仍到原本的地方（相場、商路、現款走勢、奉行所）。
 * - dealGroups()：回傳 [[組名鍵,[{t,s}]]]（t＝內容、s＝還剩多久）；dealCard()：私宅頁的摘要卡；ACT.dealings：點開完整清單。
 * - 遷居的啟程事項清單從這裡挑（07zzr_move.js 的 moveItems；對官員的承諾、公會長的得標金不擋啟程）。文字 deal2.*（01e）。 */
function dealGroups(){
  const D=(k,v)=>UT('deal2.'+k,v),left=n=>D(n>0?'left':'now',{n}),g=n=>COMM_MAP[n]?COMM_MAP[n].short:n,who=c=>c&&CH(c)?nameOf(c):D('someone');
  const money=[],pact=[],road=[],gov=[],folk=[];
  // 錢銀往來
  (G.debts||[]).filter(d=>!d.paid).forEach(d=>money.push({t:d.cid&&CH(d.cid)?D('debt',{n:nameOf(d.cid),k:d.kind?debtKindName(d.kind):D('loan'),a:fmt(d.amt)}):D('debtOld',{a:fmt(d.amt)}),s:left(d.due-G.turn)}));
  (G.kakeRecv||[]).forEach((r,i)=>money.push({t:D(r.sure?'recvSure':r.late?'recvLate':'recv',{n:who(r.cid),a:fmt(Math.abs(r.amt))}),s:left(r.due-G.turn),k:r.late?'kakeGive':'',i}));   // k、i：遷居清單裡可以就地放棄（07zzr_move.js）
  if(G.kokusho)money.push({t:D('kokusho',{n:who(G.kokusho.cid)}),s:left(G.kokusho.left)});
  if(G.gmDue&&!G.gmDue.done&&!G.gmDue.exempt&&gmIsMe())money.push({t:D('gmDue',{a:fmt(G.gmDue.amt)}),s:D('gmDueS'),k:'gmDue'});
  // 合約與訂貨
  (G.kake||[]).forEach(c=>pact.push({t:D('kake',{n:who(c.cid),g:g(c.name),q:c.qty}),s:left(c.left)}));
  (G.chumon||[]).forEach(o=>pact.push({t:D('chumon',{n:who(o.cid),c:CITY(o.city)?CITY(o.city).name:'',g:g(o.name),q:o.qty}),s:o.sent?D('onRoad'):D('goBy',{n:Math.max(0,o.until-G.turn+1)})}));
  if(G.honjin)pact.push({t:D('honjin',{g:g(G.honjin.name),q:G.honjin.qty}),s:left(G.honjin.left)});
  ((G.patron&&G.patron.orders)||[]).forEach(o=>pact.push({t:D('patron',{n:who(o.cid),g:g(o.name),q:o.qty}),s:left(o.due-G.turn)}));   // 貴人訂貨（07zzu_patron.js）
  ((G.gov&&G.gov.orders)||[]).forEach(o=>pact.push(o.kind==='govW'?{t:D('govW',{n:who(o.cid),g:g(o.name),q:o.qty}),s:left(o.due-G.turn)}:{t:D('govS',{n:who(o.cid),g:g(o.name),q:o.qty}),s:left(o.left)}));   // 官府注文（07zzv_govorder.js）
  if(G.tribute)pact.push({t:D('tribute',{n:who(G.tribute.cid),g:g(G.tribute.name),q:G.tribute.qty}),s:left(G.tribute.due-G.turn)});
  if(G.ujob)pact.push({t:D('ujob',{c:CITY(G.ujob.city)?CITY(G.ujob.city).name:'',g:g(G.ujob.name),d:G.ujob.done,q:G.ujob.qty}),s:D('goBy',{n:Math.max(0,G.ujob.until-G.turn+1)})});
  if(G.mono&&G.mono.until>=G.turn)pact.push({t:D('mono',{g:g(G.mono.name)}),s:left(G.mono.until-G.turn+1)});
  // 在途的人與貨
  (G.ships||[]).forEach(s=>road.push({t:D(s.out?'shipOut':'ship',{k:NM('crew',s.mode),n:s.captName,c:CITY(s.origId)?CITY(s.origId).name:''}),s:D('back',{n:Math.max(1,s.eta)})}));
  (G.smug||[]).forEach(v=>road.push({t:D(v.tally?'tally':'smug',{n:v.captName}),s:D('back',{n:Math.max(1,v.eta)})}));
  (G.consign||[]).forEach(x=>road.push({t:D('consign.'+x.kind,{g:g(x.name),q:x.qty}),s:D('arrive',{n:Math.max(1,x.due-G.turn)})}));
  if(G.artisan)road.push({t:D('artisan',{g:g(G.artisan.name)}),s:left(G.artisan.left)});
  // 官府的事
  (G.apps||[]).forEach(a=>gov.push({t:D('app',{f:a.name}),s:left(a.left)}));
  Object.keys(G.rel||{}).forEach(c=>(G.rel[c].promises||[]).filter(p=>!p.done).forEach(p=>gov.push({t:D('promise',{n:who(c)}),s:p.due>=G.turn?left(p.due-G.turn):D('overdue'),k:'promise'})));
  // 人情往來
  if(G.lodge)folk.push({t:D('lodge',{n:who(G.lodge.cid),q:G.lodge.q}),s:left(G.lodge.until-G.turn)});
  if(G.stash)folk.push({t:D('stash',{n:who(G.stash.cid),q:(G.stash.items||[]).reduce((a,x)=>a+(x.q||0),0)}),s:left(G.stash.until-G.turn)});
  (G.emps||[]).filter(e=>(e.lentUntil||0)>G.turn).forEach(e=>folk.push({t:D('lent',{k:rankName(e.rank),n:e.name}),s:D('back',{n:e.lentUntil-G.turn})}));
  if(G.away&&npc(G.away.cid))folk.push({t:D('away',{n:who(G.away.cid),c:outCity(G.away.cid).name}),s:visitAway()?D('back',{n:G.away.until-G.turn+1}):D('depart')});
  return [['money',money],['pact',pact],['road',road],['gov',gov],['folk',folk]];
}
const dealCount=()=>dealGroups().reduce((a,x)=>a+x[1].length,0);
/** 私宅頁的摘要卡。 */
function dealCard(){
  const n=dealCount();
  return '<div class="card" data-act="dealings" style="cursor:pointer"><div class="row"><div><b>'+UT('deal2.title')+'</b><div class="tiny muted">'+UT('deal2.sub')+'</div></div><span class="tag '+(n?'gold':'gray')+'">'+UT(n?'deal2.count':'deal2.none',{n})+'</span></div></div>';
}
/** 完整清單。 */
function dealHtml(){
  const G_=dealGroups().filter(x=>x[1].length);
  if(!G_.length)return '<div class="notice">'+UT('deal2.empty')+'</div>';
  return G_.map(([k,L])=>'<div class="card"><b class="small">'+UT('deal2.g.'+k)+'</b>'+L.map(x=>'<div class="row tiny" style="margin-top:3px;align-items:flex-start"><span>'+esc(x.t)+'</span><b style="white-space:nowrap;margin-left:8px">'+esc(x.s)+'</b></div>').join('')+'</div>').join('')+'<div class="tiny muted" style="margin-top:4px">'+UT('deal2.foot')+'</div>';
}
ACT.dealings=()=>{UI.showInfo(UT('deal2.title'),dealHtml());sfx.tap()};
