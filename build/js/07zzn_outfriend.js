'use strict';
/* ★檔案總覽：外城友人（DESIGN_NOTES 第二百四十、二百四十一節；遷居尚未實作）
 * - 外城友人＝住在別座城、由船長或飛腳牽線（或遠國奉行引薦、作客時經友人引見）結識的商人（旅商人、仲買人、差配人、同業）。
 *   記在交情紀錄 r.out；人數不限。每位船長、飛腳在一座城只認識一位（e.ofCity[城]＝人物代號），再去改為順道問候。
 * - 結識與問候：包在 resolveVoyage 外層——那一趟有買到貨（本業貨或他行貨）才有機會牽線；已有相熟的人就順道問候，那趟買價便宜一成。
 * - 寄信（ACT.ofLetter）：每旬一封（G.ofLetterT），和外地官員的信分開算；好感最多加到 60。
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
const ofLetterUsed=()=>G.ofLetterT===G.turn;
/** 寄信不能寄的原因（空字串＝可以寄）：作客期間（約好到回來）、本旬已寄、交情已到書信的上限、成仇。 */
function ofLetterBlock(cid){
  if(isEnemy(cid))return 'of.letter.enemy';
  if(G.away)return 'of.letter.away';
  if(ofLetterUsed())return 'of.letter.used';
  if(R(cid).aff>=OF().letterCap)return 'of.letter.full';
  return '';
}
ACT.ofLetter=el=>{
  const cid=el.dataset.cid,O=OF(),r=R(cid);if(!isOutFriend(cid))return;
  {const b=ofLetterBlock(cid);if(b){toast(UT(b));return}}
  if(r.aff>=O.letterCap){toast(UT('of.letter.full'));return}
  const amt=ofLetterCost(cid);if(G.silver<amt){toast(UT('of.letter.short',{a:fmt(amt)}));return}
  payPublic('spend.ofLetter|'+cid,amt);G.ofLetterT=G.turn;
  const gain=Math.max(0,Math.min(rint(O.letterGain[0],O.letterGain[1]),O.letterCap-r.aff));
  setAff(r,clamp(r.aff+gain,0,100));logRel(cid,UT('of.log.letter',{a:fmt(amt),g:gain}));
  toast(UT('of.letter.sent',{n:nameOf(cid),a:fmt(amt),g:gain}),4200);sfx.gift();UI.render();refreshSheet();
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
  else if(ofLetterUsed())h+='<div class="tiny muted" style="margin-bottom:4px">'+UT('trip.friend.sent')+'</div>';
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
/** 外城友人卡的指令列：寄信、作客；下面一行說明為什麼按不了。 */
function outRowHtml(cid){
  const O=OF(),r=R(cid),lb=ofLetterBlock(cid),tb=ofTripBlock(cid);
  const lt=lb==='of.letter.used'?UT('btn.ofLetterUsed'):lb==='of.letter.full'?UT('btn.ofLetterFull'):lb==='of.letter.away'?UT('btn.ofLetterAway'):UT('btn.ofLetter',{c:coinHtml('silver',ofLetterCost(cid))});
  let h='<div class="row" style="justify-content:flex-start;gap:4px;flex-wrap:wrap;margin-top:5px"><button class="pixel-btn btn-sm" data-act="ofLetter" data-cid="'+cid+'" '+(lb?'disabled':'')+'>'+lt+'</button>'
    +'<button class="pixel-btn btn-sm btn-gold" data-act="ofTrip" data-cid="'+cid+'" '+(tb?'disabled':'')+'>'+UT('btn.ofTrip',{n:ofTripLen(cid),c:coinHtml('gold',ofTripCost(cid))})+'</button></div>';
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
