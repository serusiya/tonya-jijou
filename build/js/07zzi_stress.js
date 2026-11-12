'use strict';
/* =====================================================================
 * 07zzi_stress.js — 壓力值與外城出遊（DESIGN_NOTES 第二十九節「壓力值」、第二百一十七節）
 *  - G.stress 0～100：從容（<40）／疲憊（40～69，每旬行動 4；交涉的小中大按鈕每回合換位置；進出貨拉霸會手抖）／心力交瘁（70～89，行動 3、同上、
 *    45 歲後壽數判定略不利）／90 以上病倒（07zzd_sick.js 的 sickArm('stress')，病倒時壓力回到 60，臥病期間不變動）。
 *  - 增減一律走 addStress(key,v)，記在 G.stressCur；推進一旬結束時搬到 G.stressPrev（「上一旬的變化」）。
 *  - 掛點：行動點數（spendAP）、拜訪拒見（visitRoll）、交涉失利與不善言辭（battleEnd）、暗殺放火栽贓打壓、
 *    搜查罰銀遠島與打毀（loseFame 的鍵）、失火（G.life.fires）、供貨不穩（G.supplyQuarter.unstable）、現款為負；
 *    宴會、吉原夜宴、指名、節慶、忘年會、節慶闔家同遊；每旬自然恢復、沒用完的行動點數、夫人子女在家。
 *  - 外城出遊（主畫面河岸藏下方）：寺社參拜、溫泉、外城友人（外城友人系統尚未做，先顯示未開放）。
 *  數值 ODDS.stress、ODDS.trip；費用 COSTS.temple／onsen；文字 stress.*、trip.*（01e）、stress.*、trip.*（01f、01g）。
 * ===================================================================== */
const ST=()=>ODDS.stress;
const stressNow=()=>clamp(Math.round((G&&G.stress)||0),0,100);
/** 0 從容、1 疲憊、2 心力交瘁、3 病倒中。 */
function stressTier(){
  if(G&&(G.injured||0)>0&&G.injKind==='sick')return 3;
  const s=stressNow(),T=ST().tiers;return s>=T[1]?2:s>=T[0]?1:0;
}
/** 本旬行動點數上限。 */
const apMaxNow=()=>AP_MAX-([0,1,2,2][stressTier()]);
let STRESS_SKIP=false;
/** 增減壓力；病倒臥床期間不變動。到 90 記下病倒。 */
function addStress(key,v){
  if(!G||!v||G.ended)return 0;
  if((G.injured||0)>0&&G.injKind==='sick')return 0;
  const s0=G.stress||0,s1=clamp(s0+v,0,100),d=s1-s0;G.stress=s1;
  const L=G.stressCur||(G.stressCur=[]),o=L.find(x=>x.k===key);if(o)o.v+=v;else L.push({k:key,v});
  if(s1>=ST().tiers[1])G.stressExhYear=true;
  if(s1>=ST().sick)sickArm('stress');
  updateAP();
  return d;
}
/** 推進一旬開頭（行動點數重設之前）：沒用完的點數、自然恢復、家人、現款為負。 */
function stressTurnStart(){
  if(!G||(G.exile||0)>0)return;
  const O=ST(),left=Math.max(0,G.ap||0);
  addStress('rest',-O.natural);
  if(left)addStress('idle',-O.idle*left);
  if(G.family.spouse)addStress('wife',-O.family);
  if((G.family.kids||[]).length)addStress('kids',-O.family);
  if(G.silver<0)addStress('debt',O.debt);
}
/** 推進一旬結尾：節慶、供貨不穩、失火；整理紀錄；依狀態壓低本旬行動點數。 */
function stressTick(log){
  const O=ST(),S=G.stressSnap||{},fires=(G.life&&G.life.fires)||0,un=(G.supplyQuarter&&G.supplyQuarter.unstable)||0;
  if(typeof festActive==='function'&&festActive())addStress('fest',-O.fest);
  if(S.unstable!==undefined&&un>S.unstable)addStress('unstable',O.unstable);
  if(S.fires!==undefined&&fires>S.fires)addStress('fire',O.fire*(fires-S.fires));
  G.stressSnap={unstable:un,fires};
  G.stressPrev=(G.stressCur||[]).filter(x=>x.v);G.stressCur=[];
  const t=stressTier(),tp=G.stressTierShown||0;
  if(t!==tp&&t<3){if(t>tp)log.push(NEWS('stress.up.'+t));else if(t===0)log.push(NEWS('stress.ease'));}
  G.stressTierShown=t;
  if((G.exile||0)<=0&&G.ap>apMaxNow())G.ap=apMaxNow();
}
/* ---------- 掛點 ---------- */
{const _s=spendAP;spendAP=function(){const a=apLeft(),r=_s.apply(this,arguments);if(r&&!STRESS_SKIP&&apLeft()<a)addStress('ap',ST().ap*(a-apLeft()));return r}}
{const _v=visitRoll;visitRoll=function(cid){const r=_v.apply(this,arguments);if(r&&r.outcome==='refuse')addStress('refuse',ST().refuse);return r}}
{const _b=battleEnd;battleEnd=function(){
  const B=BT;if(B&&!B.done&&!B.mode){const win=B.dmg>=B.hp;if(!win&&B.round>=3&&B.hits===0)addStress('snub',ST().snub);else if(!win)addStress('lose',ST().lose)}
  return _b.apply(this,arguments)}}
/** 栽贓、打壓：真的做了（風聲重罪加三）才算。暗殺、放火不加風聲，壓力直接寫在 07m_loyalty.js。 */
const stressDirty=f=>function(){const h=G.heat||0,r=f.apply(this,arguments);if((G.heat||0)>=h+3)addStress('dirty',ST().dirty);return r};
startScheme=stressDirty(startScheme);
/** 搜查、罰銀、遠島、查貨、打毀：沿用扣知名度的鍵。 */
{const _l=loseFame;loseFame=function(key){const v=ST().fameKeys[key];if(v)addStress('blow',v);return _l.apply(this,arguments)}}
{const _f=ACT.banquet;ACT.banquet=function(){const t=G.banquetT;const r=_f.apply(this,arguments);if(G.banquetT===G.turn&&t!==G.turn)addStress('banquet',-ST().banquet);return r}}
{const _f=ACT.feast;ACT.feast=function(){const t=FL().feast;const r=_f.apply(this,arguments);if(FL().feast===G.turn&&t!==G.turn)addStress('feast',-ST().feast);return r}}
{const _f=ACT.nomOiran;ACT.nomOiran=function(el){const r0=el&&el.dataset&&G.rel[el.dataset.cid],t=r0&&r0.nomT;const r=_f.apply(this,arguments);const r1=el&&el.dataset&&G.rel[el.dataset.cid];if(r1&&r1.nomT===G.turn&&t!==G.turn)addStress('nominate',-ST().nominate);return r}}
{const _y=yearEndParty;yearEndParty=function(log){
  const r=_y.apply(this,arguments);
  G.stressExhLast=!!G.stressExhYear;G.stressExhYear=stressTier()===2;
  if(G.stressExhLast)log.push(NEWS('stress.yearWorn'));
  addStress('party',-ST().party);return r}}
/** 上一年曾心力交瘁：45 歲起壽數判定略增（04_people.js 的 yearTick）。 */
const stressDeathAdd=age=>G&&G.stressExhLast&&age>=ST().oldAge?ST().oldDeath:0;
{const _f=sickFire;sickFire=function(){const P=G&&G.sickPend,r=_f.apply(this,arguments);if(r&&P&&P.kind==='stress'){G.stress=ST().after;G.stressTierShown=3}return r}}
{const _u=updateAP;updateAP=function(){_u.apply(this,arguments);const e=document.getElementById('d-ap');if(e&&G){const t=stressTier();e.classList.toggle('tired',t===1);e.classList.toggle('worn',t>=2)}}}
/* ---------- 身心狀況視窗 ---------- */
ACT.stressInfo=()=>{if(G)UI.openSheet('stress')};
const STRESS_WAYS=['banquet','feast','nominate','fest','party','idle','temple','onsen'];
SHEETS.stress=()=>{
  const t=stressTier(),s=stressNow(),O=ST(),cols=['#4f8a4f','#c9a23a','#c0603a','#8a2f2f'];
  let h='<div class="card"><div class="row"><b style="font-size:16px;color:'+cols[t]+'">'+UT('stress.tier.'+t)+'</b></div>';
  h+='<div style="position:relative;height:12px;margin:8px 0 4px;display:flex;border:1px solid #6b5d3a">'+[[0,O.tiers[0]],[O.tiers[0],O.tiers[1]],[O.tiers[1],O.sick],[O.sick,100]].map((x,i)=>'<div style="flex:'+(x[1]-x[0])+';background:'+cols[i]+';opacity:'+(i===t?1:.35)+'"></div>').join('')
    +'<div style="position:absolute;top:-3px;bottom:-3px;width:3px;background:#2a2430;left:calc('+s+'% - 1px)"></div></div>';
  h+='<div class="small" style="margin-top:6px">'+UT('stress.say.'+t)+'</div></div>';
  const row=x=>'<div class="row tiny"><span>'+UT('stress.k.'+x.k)+'</span><b style="color:'+(x.v>0?'#b3392b':'#2f7d4f')+'">'+(x.v>0?'+':'−')+Math.abs(Math.round(x.v*10)/10)+'</b></div>';
  const P=G.stressPrev||[],C=(G.stressCur||[]).filter(x=>x.v);
  h+='<div class="card"><b>'+UT('stress.prev')+'</b>'+(P.length?P.map(row).join(''):'<div class="tiny muted">'+UT('stress.none')+'</div>');
  if(C.length)h+='<div class="tiny bold" style="margin-top:6px">'+UT('stress.cur')+'</div>'+C.map(row).join('');
  h+='</div><div class="card"><b>'+UT('stress.ways')+'</b>'+STRESS_WAYS.map(k=>'<div class="tiny">• '+UT('stress.way.'+k,{a:{banquet:O.banquet,feast:O.feast,nominate:O.nominate,fest:O.fest,party:O.party,idle:O.idle,temple:ODDS.trip.temple.relief,onsen:ODDS.trip.onsen.relief}[k]})+'</div>').join('')+'</div>';
  h+='<div class="card tiny muted">'+UT('stress.rules')+'</div>';
  return {title:UT('stress.title'),html:h};
};
/* ---------- 外城出遊 ---------- */
ACT.tripOpen=()=>{if(!G)return;TRIP_GOING=false;musicWant('trip');UI.openSheet('trip')};   // 打開出遊頁就換《道中囃子》
/* 出遊配樂：出遊頁打開到最後的結果視窗關掉，都播《道中囃子》；沒出發就關掉出遊頁、或婉拒視窗直接關掉，換回《市井囃子》。 */
let TRIP_GOING=false,TRIP_RESULT=false;
const tripMusicEnd=()=>{TRIP_GOING=false;TRIP_RESULT=false;if(MUS.want==='trip')musicWant('market')};
{const _c=UI.closeSheet;UI.closeSheet=function(){const was=UI.s.sheet&&UI.s.sheet.type;const r=_c.apply(this,arguments);if(was==='trip'&&!TRIP_GOING)tripMusicEnd();return r}}
/** 不能去的原因（文字鍵）；可以去回傳 null。 */
function tripBlock(k){
  const T=ODDS.trip[k];
  if((G.exile||0)>0)return 'trip.no.exile';
  if((G.injured||0)>0)return 'trip.no.hurt';
  if(k==='temple'&&G.tripTemple===G.turn)return 'trip.no.turn.temple';   // 每旬各一次
  if(k==='onsen'&&G.tripOnsen===G.turn)return 'trip.no.turn.onsen';
  if(apLeft()<T.ap)return 'trip.no.ap';
  if(!afford(k))return 'trip.no.money';
  return null;
}
SHEETS.trip=()=>{
  let h='<div class="notice tiny">'+UT('trip.intro')+'</div>';
  ['temple','onsen'].forEach(k=>{
    const T=ODDS.trip[k],b=tripBlock(k);
    h+='<div class="card"><b>'+UT('trip.'+k)+'</b><div class="tiny muted" style="margin:3px 0">'+UT('trip.'+k+'.d')+'</div>'
      +(k==='temple'&&hatsuNow()?'<div class="tiny" style="color:#9b2c3a">'+UT('trip.hatsuTag')+'</div>':'')
      +'<div class="tiny">'+UT('trip.meta',{ap:T.ap,c:costOf(k)?coinHtml(COSTS[k].cur,costOf(k)):UT('trip.free'),r:T.relief})+'</div>'
      +(b?'<div class="tiny" style="color:#b3392b;margin-top:3px">'+UT(b)+'</div>':'')
      +'<div style="margin-top:5px"><button class="pixel-btn btn-sm btn-gold" data-act="tripGo" data-k="'+k+'" '+(b?'disabled':'')+'>'+UT('btn.tripGo.'+k)+'</button></div></div>';
  });
  h+=tripFriendCard();                              // 外城友人：出遊訪友（07zzn_outfriend.js）
  return {title:UT('trip.title'),html:h};
};
/** 香油錢拉霸（私房錢，每格 5 兩，最多 ODDS.trip.giftMax）。 */
function tripGiftRow(){
  const O=ODDS.trip,M=Math.min(O.giftMax,Math.floor((G.gold||0)/O.giftStep)*O.giftStep),v=Math.min(UI.s.tripGift||0,M);UI.s.tripGift=v;
  if(M<=0)return '<div class="tiny muted" style="margin-top:4px">'+UT('trip.gift.none')+'</div>';
  return '<div class="tiny" style="margin-top:5px">'+UT('trip.gift.h',{a:'<b id="trip-gift-v">'+v+'</b>'})+'</div>'
    +stepRow('<input id="trip-gift" type="range" min="0" max="'+M+'" value="'+v+'" step="'+O.giftStep+'" data-chg="tripGift" data-lbl="trip-gift-v">','trip-gift',v<=0,v>=M)
    +'<div class="tiny muted">'+UT('trip.gift.d',{r:O.giftReliefMax,f:O.giftFameAt})+'</div>';
}
CHG.tripGift=el=>{UI.s.tripGift=Math.max(0,+el.value||0)};
ACT.tripGo=el=>{
  const k=el.dataset.k,T=ODDS.trip[k];if(!T)return;
  const b=tripBlock(k);if(b){toast(UT(b));return}
  const f=tripCompRoll(k);
  TRIP_GOING=true;
  if(f){TRIP_OFFER={k,f};UI.closeSheet();UI.showInfo(UT('trip.comp.title'),tripCompAsk(k,f));return}
  tripStart(k,null);
};
/** 正月初詣：一月上旬。 */
const hatsuNow=()=>G&&G.month===1&&G.cycle===1;
/* ---------- 同行：本城好感 80 以上的商人或官員 ---------- */
var TRIP_OFFER=null;
const tripIsOff=cid=>(npc(cid)||{}).role==='official';
const tripWho=cid=>tripIsOff(cid)?'official':'merchant';
/** 這一趟有沒有人要同行（溫泉要付得起兩人份才問）。 */
function tripCompRoll(k){
  const T=ODDS.trip;if(!chance(T.compP))return null;
  if(k==='onsen'&&!afford(k,2))return null;
  const L=closeFriends(false).filter(n=>!['oiran','smuggler'].includes(n.role)&&!jailed(n)&&!hiddenSmuggler(n.cid));
  return L.length?pick(L).cid:null;
}
/** 名牌卡：頭像、稱呼、身份、一句話、效果。 */
function tripCard(img,name,tag,line,foot){
  return '<div class="card" style="display:flow-root;margin-bottom:6px">'+img+'<div><b>'+esc(name)+'</b> <span class="tag gray">'+esc(tag)+'</span></div><div class="small" style="margin:5px 0">「'+esc(line)+'」</div>'+(foot?'<div class="tiny" style="color:#9b2c3a">'+esc(foot)+'</div>':'')+'</div>';
}
const tripTag=cid=>{const n=npc(cid);return n&&n.pos?posTitle(n):(ROLE_LABEL[(n||{}).role]||'')};
function tripCompAsk(k,f){
  const T=ODDS.trip,x=k==='onsen'?UT('trip.comp.pay',{c:fmt(costOf(k))}):'';
  return tripCard(portraitHtml(f,56),nameOf(f),tripTag(f),TX('trip.comp.ask.'+k+'.'+tripWho(f),{n:G.me.given}),x)
    +'<div class="grid2"><button class="pixel-btn btn-gold btn-sm" data-act="tripCompYes">'+UT('btn.tripCompYes')+'</button><button class="pixel-btn btn-sm" data-act="tripCompNo">'+UT('btn.tripCompNo',{a:T.compNo})+'</button></div>';
}
ACT.tripCompYes=()=>{const o=TRIP_OFFER;TRIP_OFFER=null;UI.hideInfo();if(!o)return;const b=tripBlock(o.k);if(b){toast(UT(b));return}tripStart(o.k,afford(o.k,2)||o.k!=='onsen'?o.f:null)};
ACT.tripCompNo=()=>{const o=TRIP_OFFER;TRIP_OFFER=null;UI.hideInfo();if(!o)return;
  const g=ODDS.trip.compNo,r=R(o.f);setAff(r,clamp(r.aff-g,0,100));logRel(o.f,UT('trip.log.no.'+o.k,{g}));toast(MSG('trip.comp.no',{f:nameOf(o.f),g}));
  const b=tripBlock(o.k);if(b){toast(UT(b));return}tripStart(o.k,null)};
/** 溫泉碰到的本城男子：認識不認識、仇人都可能。 */
function tripBather(skip){
  const L=cityNpcs(G.cityId).filter(n=>n.cid!==skip&&alive(n.cid)&&!['oiran','concubine','branch'].includes(n.role)&&!n.hired&&!G.emps.some(e=>e.cid===n.cid)
    &&!awayNow(n)&&!jailed(n)&&(CH(n.cid)||{}).gender!=='f'&&!(n.pos&&n.pos.court==='region'));
  return L.length?pick(L).cid:null;
}
/** 出發：扣行動與花費、播過場，到了當地有人開口。 */
function tripStart(k,f){
  const T=ODDS.trip[k];
  STRESS_SKIP=true;try{for(let i=0;i<T.ap;i++)spendAP()}finally{STRESS_SKIP=false}
  spend(k,f&&k==='onsen'?2:1);if(k==='temple')G.tripTemple=G.turn;else G.tripOnsen=G.turn;
  UI.closeSheet();
  FX.bg=k==='temple'?IMG_TEMPLE:IMG_ONSEN;
  playFx('walk',MSG('trip.fx.'+k),MSG(f?'trip.fxSubWith.'+k:'trip.fxSub.'+k,{f:f?nameOf(f):''}),()=>{
    addStress(k,-T.relief);
    if(k==='temple'){TRIP_PEND={k,f};UI.s.tripGift=0;UI.showInfo(UT('trip.done.temple'),'<div class="text-prose" style="margin-bottom:6px">'+MSG(hatsuNow()?'trip.arrive.hatsu':'trip.arrive.temple')+'</div>'+tripGiftRow()
      +'<div class="grid2" style="margin-top:6px"><button class="pixel-btn btn-gold btn-sm" data-act="tripGiftDo">'+UT('btn.tripGiftDo')+'</button><button class="pixel-btn btn-sm" data-act="tripGiftSkip">'+UT('btn.tripGiftSkip')+'</button></div>');UI.render();return}
    tripArrive(k,f,0);
  },1500);
}
/** 寺社：到了才決定香油錢（關掉視窗＝不捐，同行好感照算）。 */
var TRIP_PEND=null;
ACT.tripGiftDo=()=>{const P=TRIP_PEND;TRIP_PEND=null;if(!P)return UI.hideInfo();tripArrive(P.k,P.f,UI.s.tripGift||0)};   // 直接換掉視窗內容，不先關（關掉會讓排隊的事件插進來）
ACT.tripGiftSkip=()=>{const P=TRIP_PEND;TRIP_PEND=null;if(!P)return UI.hideInfo();tripArrive(P.k,P.f,0)};
{const _h=UI.hideInfo;UI.hideInfo=function(){const P=TRIP_PEND;TRIP_PEND=null;const O=TRIP_OFFER,done=TRIP_RESULT;const r=_h.apply(this,arguments);
  if(P){tripArrive(P.k,P.f,0,true);tripMusicEnd()}else if(done||(O&&TRIP_OFFER===O)){TRIP_OFFER=null;tripMusicEnd()}return r}}   // 同行詢問直接關掉＝不出發
/** 到了當地：香油錢、當地人物、湯客、同行的人、求籤，最後一張結果視窗。quiet＝不跳視窗（玩家直接關掉時）。 */
function tripArrive(k,f,gift,quiet){
  const T=ODDS.trip[k],O=ODDS.trip,worn=stressTier()>=2?'worn':'calm';
  const foots=[UT('trip.eff',{r:T.relief})];
  if(k==='temple'){const amt=Math.min(gift||0,Math.floor((G.gold||0)/O.giftStep)*O.giftStep);UI.s.tripGift=0;
    if(amt>0){G.gold-=amt;const r=Math.min(O.giftReliefMax,Math.floor(amt/O.giftPer));if(r)addStress('gift',-r);
      G.templeGift=G.templeGift||{};G.templeGift[G.cityId]=(G.templeGift[G.cityId]||0)+amt;   // 各城寺社累計香油錢（之後的修繕講等事件讀這個）
      const fm=amt>=O.giftFameAt?addFame(O.giftFame):0;
      foots.push(UT('trip.gift.eff',{a:amt})+(r?UT('trip.gift.relief',{r}):'')+(fm?UT('trip.gift.fame',{f:fm}):''))}}
  const TE=quiet?{}:tripEnc(k);                    // 出遊奇遇：一趟最多一件；三助換人（07zzk_tripev.js）
  let h='<div class="text-prose" style="margin-bottom:6px">'+MSG('trip.done.'+k)+'</div>';
  // 當地的人
  if(k==='temple'){const fig=chance(0.5)?'monk':'miko';h+=tripFigCard(fig,worn,TE);h+=tripEncCard(TE);
    if(hatsuNow()){                                // 正月初詣：一月上旬參拜，比照逛祭典抽一件臨時事件（07zf_festwalk.js 的 festWalkRoll）
      const fv=G.festival;G.festival=UT('trip.hatsu');let ev;try{ev=festWalkRoll('hatsu')}finally{G.festival=fv}
      h+='<div class="small" style="margin:6px 0 2px">'+esc(MSG('hatsu.open'))+'</div><div class="card" style="display:flow-root;margin-bottom:6px">'+(ev.cid?portraitHtml(ev.cid,48):'')+'<div class="small">'+esc(ev.txt)+'</div><div class="tiny" style="margin-top:4px;color:'+(ev.bad?'#1e7e34':'#9b2c3a')+'">'+esc(ev.eff)+'</div></div>'}}
  else{
    h+=tripSskCard(worn,TE);h+=tripEncCard(TE);
    const c=tripBather(f);
    if(c){const r=R(c),fresh=!r.met&&!G.known.includes(c),en=isEnemy(c),rel=en?'enemy':fresh?'new':'known';
      setAff(r,clamp(r.aff+O.batherAff,0,100));
      if(fresh){addKnown(c);r.met=true;if(!r.bond)r.bond={mult:1,label:UT('trip.bond'),introId:null}}
      logRel(c,UT('trip.log.bather',{g:O.batherAff}));
      h+=tripCard(portraitHtml(c,48),nameOf(c),tripTag(c),TX('trip.bather.'+tripWho(c)+'.'+rel,{n:G.me.given}),UT(fresh?'trip.bather.newEff':'trip.bather.eff',{f:nameOf(c),g:O.batherAff}));
    }
  }
  // 同行的人
  const SN=tripSeason(k,!!f,quiet);                 // 季節小景（07zzk_tripev.js）
  if(f){const g=O.compAff[k]+(SN.aff||0),r=R(f);setAff(r,clamp(r.aff+g,0,100));addStress('company',-O.compRelief);logRel(f,UT('trip.log.with.'+k,{g}));
    h+=tripCard(portraitHtml(f,48),nameOf(f),tripTag(f),TX('trip.comp.say.'+k+'.'+tripWho(f),{n:G.me.given}),UT('trip.comp.eff',{f:nameOf(f),g}));
    foots.push(UT('trip.comp.relief',{r:O.compRelief}));
  }
  if(SN.line){h+='<div class="small" style="margin:4px 0">'+esc(SN.line)+'</div>';if(SN.foot)foots.push(SN.foot)}
  if(k==='temple'&&chance(T.omen))h+='<div class="small" style="margin:4px 0">'+esc(TX('trip.omen'))+'</div>';   // 求籤只是氣氛，沒有作用
  UI.render();if(quiet)return;
  sfx.gift();TRIP_RESULT=false;UI.showInfo(UT('trip.done.'+k),h+'<div class="tiny muted" style="margin-top:4px">'+foots.join('；')+'</div>');
  TRIP_RESULT=true;                                 // 這張結果視窗關掉時換回主畫面配樂
}

/* ---------- 手抖：疲憊以上，用手拖動進出貨拉霸放開時，數字可能偏開一兩格（加減按鈕、鍵盤不會） ----------
 *  演出：整條拉霸左右晃 3～4 下，滑塊先往旁邊彈一兩次才停下；中間的彈動不寫進計畫，停下的數字才算。
 *  抖動中又去拖拉霸或按加減鈕：立刻停住、先落在最後的數字，再接玩家的新操作。 */
let SHAKE_ARM=null,SHAKE_ANIM=null;
function shakeFinish(){const A=SHAKE_ANIM;if(!A)return;SHAKE_ANIM=null;A.timers.forEach(clearTimeout);A.row&&A.row.classList.remove('shaking');
  const el=document.getElementById(A.id);if(el){el.value=A.nv;el.dispatchEvent(new Event('input',{bubbles:true}))}}
document.addEventListener('pointerdown',e=>{const t=e.target;if(SHAKE_ANIM&&t&&(t.id===SHAKE_ANIM.id||(t.closest&&t.closest('[data-step="'+SHAKE_ANIM.id+'"]'))))shakeFinish();
  SHAKE_ARM=t&&(t.id==='slider-ship'||t.id==='slider-buy')?t.id:null},true);
document.addEventListener('change',e=>{
  const el=e.target;if(!el||!SHAKE_ARM||el.id!==SHAKE_ARM)return;SHAKE_ARM=null;
  if(!G||el.disabled)return;const t=stressTier();if(t<1||t>2||!chance(ST().shakeP[t-1]))return;
  const lo=+el.min,hi=+el.max,v=+el.value,unit=Math.max(1,Math.round((hi-lo)*ST().shakeFrac)),d=rint(1,2)*unit*(chance(0.5)?1:-1);
  let nv=clamp(v+d,lo,hi);if(nv===v)nv=clamp(v-d,lo,hi);if(nv===v)return;
  const row=el.closest('.step-row');
  const old=row&&row.parentNode.querySelector('.shake-tip');if(old)old.remove();
  if(row){const tip=document.createElement('div');tip.className='shake-tip tiny';tip.textContent=MSG('stress.shake',{a:v,b:nv});row.insertAdjacentElement('afterend',tip);setTimeout(()=>tip.remove(),3000)}
  sfx.bad&&sfx.bad();
  // 滑塊彈動：反方向一下、再越過目標一下，最後停在 nv（只改畫面，不寫計畫）
  const dir=Math.sign(nv-v)||1,path=[clamp(v-dir*unit,lo,hi),clamp(nv+dir*unit,lo,hi),clamp(v+Math.round((nv-v)/2),lo,hi)],A={id:el.id,nv,row,timers:[]};
  if(row){row.classList.remove('shaking');void row.offsetWidth;row.classList.add('shaking')}
  path.forEach((x,k)=>A.timers.push(setTimeout(()=>{const e2=document.getElementById(A.id);if(e2)e2.value=x},70+k*90)));
  A.timers.push(setTimeout(shakeFinish,70+path.length*90+40));
  SHAKE_ANIM=A;
},true);
