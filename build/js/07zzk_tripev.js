'use strict';
/* ★檔案總覽：出遊奇遇與季節小景（DESIGN_NOTES 第二百二十六～二百三十一節）
 * - 一趟出遊最多碰到一件奇遇，依序判定，碰到一件就停（tripEnc）：
 *   1 三助還錢（溫泉，上一趟交了 50／100 兩必定）→ 2 三獻茶（寺社，本城寺社累計香油錢達門檻，一局一次）
 *   → 3 三助開口（溫泉）→ 4 賣藥郎（寺社、溫泉）→ 5 祈福（寺社，風聲 −1）。
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
