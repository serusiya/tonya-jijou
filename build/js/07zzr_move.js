'use strict';
/* ★檔案總覽：遷居與轉行（DESIGN_NOTES 第二十九、二百四十（第五段）、二百五十九～二百六十三節）
 * - 約定：好感 100 的外城友人人物卡「🏠 遷居」區塊 →「商量遷居」→ 約定（G.move={cid,city,start}）。京畿圈要先完成帝都獻上（尚未實作，一律不能約）。
 * - 籌備：最少九旬、最長十八旬；期間不能開新的長期關係（moveBlocks）；友人過世、下獄、成仇或不再是外城友人，約定作廢；逾期作罷。
 * - 私宅面板最下方：啟程事項清單（moveItems，取自商行往來 dealGroups 再加御救販售）＋獨佔一行的大按鈕「啟程遷居」。
 * - 啟程視窗：選行業（目的地不產該行業本業貨）→ 挑隨行員工（每種職位最多一人）→ 確認（搬家費 2,000 兩）。
 * - 啟程（moveDepart）：清掉舊城 → 跳過旅途（到第二個例會旬；跨年時抵達補做新年）→ 建立新城（補人到開局規模、重建本業市場與開業庫存、入會、例會）。
 * - 狀態：G.move、G.moveLast（上次抵達的旬，冷卻 180 旬）。數值 ODDS.move；文字 mv.*（01e）、新聞 mv.*（01g）。 */
const MVO=()=>ODDS.move;
const moving=()=>!!(G&&G.move);
const MV_RANKS=['chief','banto','clerk','apprentice','captain','courier','guard'];
/** 這座城可以開哪些行業（不產該行業的本業貨）。 */
const moveSysOK=(ct,k)=>!commsOfSys(k).some(c=>(ct.connected_commodities||[]).includes(c.name));
const moveSysList=ct=>SYS.filter(s=>moveSysOK(ct,s.key)).map(s=>s.key);
/** 約定遷居前的檢查：回傳不能約的原因（UT 鍵），可以約就回傳空字串。 */
function moveAskBlock(cid){
  const r=G.rel[cid],ct=outCity(cid);
  if(!r||r.aff<100)return 'mv.b.aff';
  if(G.move)return G.move.cid===cid?'mv.b.mine':'mv.b.other';
  if(ct.region_id==='reg_central')return 'mv.b.central';                 // 帝都獻上之前不能遷入京畿圈（第一百六十七節）
  if(G.moveLast!==undefined&&G.turn<G.moveLast+MVO().cool)return 'mv.b.cool';
  if(!moveSysList(ct).length)return 'mv.b.prod';
  return '';
}
/** 外城友人卡下方的遷居區塊（好感 100 才出現）。 */
function moveFriendBlock(cid){
  const r=G.rel[cid];if(!r||r.aff<100)return '';
  const ct=outCity(cid),b=moveAskBlock(cid);
  let h='<div class="mv-box"><b>'+UT('mv.box.t')+'</b><div class="tiny">'+UT('mv.box.d',{c:ct.name,a:fmt(MVO().fee)})+'</div>';
  if(b==='mv.b.mine')h+='<div class="tiny" style="color:#2f7d4f;margin-top:3px">'+UT('mv.box.mine')+'</div>';
  else h+='<button class="pixel-btn btn-sm btn-gold" style="width:100%;margin-top:4px" data-act="moveAsk" data-cid="'+cid+'" '+(b?'disabled':'')+'>'+UT('btn.moveAsk')+'</button>'+(b?'<div class="tiny muted" style="margin-top:2px">'+UT(b,{n:Math.max(0,(G.moveLast||0)+MVO().cool-G.turn)})+'</div>':'');
  return h+'</div>';
}
{const _o=outRowHtml;outRowHtml=function(cid){return _o.apply(this,arguments)+moveFriendBlock(cid)}}
/** 商量遷居：說明後約定。 */
ACT.moveAsk=el=>{
  const cid=el.dataset.cid,b=moveAskBlock(cid);if(b){toast(UT(b,{n:0}));return}
  const ct=outCity(cid),O=MVO();
  UI.showInfo(UT('mv.ask.t'),portraitHtml(cid,56)+'<div class="notice" style="margin-top:6px">'+esc(TX('mv.ask',{c:ct.name}))+'</div>'
    +'<div class="card tiny">'+UT('mv.ask.rule',{c:ct.name,a:O.prepMin,b:O.prepMax,f:fmt(O.fee)})+'</div>'
    +'<div class="grid2" style="margin-top:6px"><button class="pixel-btn btn-sm btn-gold" data-act="moveAgree" data-cid="'+cid+'">'+UT('btn.moveAgree')+'</button><button class="pixel-btn btn-sm" data-act="reqDone">'+UT('btn.moveLater')+'</button></div>');
};
ACT.moveAgree=el=>{
  const cid=el.dataset.cid;if(moveAskBlock(cid)){UI.hideInfo();return}
  const ct=outCity(cid);G.move={cid,city:ct.id,start:G.turn};
  logRel(cid,UT('mv.log.agree'));pushNews(NEWS('mv.agree',{n:nameOf(cid),c:ct.name}));
  sfx.fanfare();UI.hideInfo();toast(UT('mv.agree.toast',{c:ct.name,a:MVO().prepMin}),5200);UI.render();refreshSheet();
};
/* ---------- 籌備期 ---------- */
/** 籌備滿了幾旬（約定那一旬算第一旬）。 */
const movePrep=()=>G.move?G.turn-G.move.start+1:0;
/** 啟程事項清單：[{t,s,k?,i?}]；k＝可以就地放棄的項目（被寬限的賣掛）。 */
function moveItems(){
  const L=[];
  dealGroups().forEach(([g,list])=>list.forEach(x=>{if(x.k!=='promise'&&x.k!=='gmDue')L.push(x)}));   // 對官員的承諾、公會長的得標金不擋啟程
  if(G.kyusai)L.push({t:UT('mv.it.kyusai'),s:UT('deal2.left',{n:G.kyusai.left})});
  return L;
}
/** 現在能不能啟程：回傳 {ok,why:[]}。 */
function moveReady(){
  const why=[],n=moveItems().length,left=MVO().prepMin-movePrep();
  if(n)why.push(UT('mv.why.items',{n}));
  if(left>0)why.push(UT('mv.why.prep',{n:left}));
  if((G.injured||0)>0)why.push(UT('mv.why.injured'));
  if((G.exile||0)>0)why.push(UT('mv.why.exile'));
  if(G.silver<MVO().fee)why.push(UT('mv.why.fee',{a:fmt(MVO().fee)}));
  return {ok:!why.length,why};
}
/** 私宅面板最下方：啟程事項清單與遷居按鈕。 */
function moveEstateBlock(){
  const M=G.move;if(!M||!npc(M.cid))return '';
  const ct=CITY(M.city),L=moveItems(),R_=moveReady(),last=M.start+MVO().prepMax-1;
  let h='<div class="hr-title" style="color:#e5a93b">'+UT('mv.est.t')+'</div><div class="card mv-est">';
  h+='<div class="small">'+UT('mv.est.head',{n:esc(nameOf(M.cid)),c:ct.name})+'</div>';
  h+='<div class="tiny muted">'+UT('mv.est.time',{a:movePrep(),b:MVO().prepMin,d:dateLabel(dateAfter(last-G.turn))})+'</div>';
  h+='<div class="small bold" style="margin-top:6px">'+UT('mv.est.list')+'</div>';
  if(!L.length)h+='<div class="tiny" style="color:#2f7d4f">'+UT('mv.est.clear')+'</div>';
  else h+=L.map(x=>'<div class="row tiny" style="margin-top:3px;align-items:flex-start"><span>☐ '+esc(x.t)+'</span><span style="white-space:nowrap;margin-left:8px"><b>'+esc(x.s)+'</b>'+(x.k==='kakeGive'?' <button class="pixel-btn btn-sm" data-act="moveKakeGive" data-i="'+x.i+'">'+UT('btn.kakeGive')+'</button>':'')+'</span></div>').join('');
  h+='<div class="tiny muted" style="margin-top:4px">'+UT('mv.est.note')+'</div>';
  h+='<button class="pixel-btn btn-gold mv-go" data-act="moveGo" '+(R_.ok?'':'disabled')+'>'+UT('btn.moveGo',{c:ct.name})+'</button>';
  if(!R_.ok)h+='<div class="tiny" style="color:#b3392b;margin-top:3px">'+R_.why.join('；')+'</div>';
  h+='<div style="text-align:right;margin-top:4px"><button class="pixel-btn btn-sm" data-act="moveCancel">'+UT(UI.s.mvCancelArm?'btn.moveCancelOk':'btn.moveCancel')+'</button></div>';
  return h+'</div>';
}
{const _re=renderEstate;renderEstate=function(){_re.apply(this,arguments);const b=moving()?moveEstateBlock():'';if(b)$('#view-estate').insertAdjacentHTML('beforeend','<div class="mv-wrap">'+b+'</div>')}}
ACT.moveKakeGive=el=>{
  const L=G.kakeRecv||[],r=L[+el.dataset.i];if(!r||!r.late)return;
  L.splice(+el.dataset.i,1);logRel(r.cid,UT('mv.log.kakeGive',{a:fmt(Math.abs(r.amt))}));toast(UT('mv.kakeGive',{n:nameOf(r.cid),a:fmt(Math.abs(r.amt))}));UI.render();
};
ACT.moveCancel=()=>{
  if(!UI.s.mvCancelArm){UI.s.mvCancelArm=true;UI.render();return}
  UI.s.mvCancelArm=false;const M=G.move;if(!M)return;G.move=null;
  pushNews(NEWS('mv.cancel',{n:nameOf(M.cid),c:CITY(M.city).name}));toast(UT('mv.cancel.toast'));UI.render();
};
/** 每旬（outTick 之後）：友人出事或逾期，約定作廢。 */
function moveTick(log){
  const M=G.move;if(!M)return;
  const n=npc(M.cid),put=t=>{pushNews(t);log.push(t)};
  let why='';
  if(!n||!alive(M.cid))why='dead';else if(jailed(n))why='jail';else if(isEnemy(M.cid))why='enemy';else if(n.cityId!==M.city||!isOutFriend(M.cid))why='gone';
  if(why){G.move=null;put(NEWS('mv.void.'+why,{n:nameOf(M.cid),c:CITY(M.city).name}));return}
  if(movePrep()>MVO().prepMax){G.move=null;put(NEWS('mv.expire',{n:nameOf(M.cid),c:CITY(M.city).name}));return}
  if(movePrep()===MVO().prepMax)log.push(NEWS('mv.lastTurn',{c:CITY(M.city).name}));
}
/* ---------- 籌備期間不能開新的長期關係 ---------- */
const MV_BLOCK_FAVOR=['smallLoan','loan','mono5','mono6','rhonjin','rujob','rkokusho','kyusai'];
{const _df=doFavor;doFavor=function(cid,key){
  const n=npc(cid),f=n&&n.pos&&(FAVORS[n.pos.court]||[]).find(x=>x.k===key);
  if(moving()&&(MV_BLOCK_FAVOR.includes(key)||(f&&f.apply)))return {ok:true,status:'held',msg:UT('mv.noNew')};
  return _df.apply(this,arguments);
}}
{const _ks=kakeSign;kakeSign=function(){if(moving())return UT('mv.noNew');return _ks.apply(this,arguments)}}
{const _ts=startTribute;startTribute=function(){if(moving()){toast(UT('mv.noNew'));return}return _ts.apply(this,arguments)}}
{const _ko=kyusaiOffer;kyusaiOffer=function(){return moving()?null:_ko.apply(this,arguments)}}
{const _yo=yamiOffer;yamiOffer=function(){return moving()?null:_yo.apply(this,arguments)}}
{const _ct=ACT.cmTake;ACT.cmTake=function(){if(moving()){UI.s.chumonOffer=null;toast(UT('mv.noNew'));return UI.hideInfo()}return _ct.apply(this,arguments)}}
/* ---------- 啟程視窗 ---------- */
/** 抵達要幾旬：出發後的第二個例會旬（出發那一旬剛好是例會旬就算第一個）。 */
function moveTravelTurns(){
  let cnt=isMeetingDate(G.month,G.cycle)?1:0,k=0;
  while(cnt<2&&k<40){k++;const d=dateAfter(k);if(isMeetingDate(d.month,d.cycle))cnt++}
  return k;
}
function moveDialog(){
  const M=G.move,ct=CITY(M.city),S=UI.s.mv||(UI.s.mv={step:1,sys:null,take:{}});
  const sysL=moveSysList(ct);if(!S.sys||!sysL.includes(S.sys))S.sys=sysL.includes(G.sysKey)?G.sysKey:sysL[0];
  let h='<div class="tiny muted">'+UT('mv.dlg.steps',{s:S.step})+'</div>';
  if(S.step===1){
    h+='<div class="small" style="margin:4px 0">'+UT('mv.dlg.sys',{c:ct.name})+'</div>';
    h+=SYS.map(s=>{const ok=sysL.includes(s.key),me=s.key===G.sysKey;
      return '<button class="pixel-btn btn-sm '+(S.sys===s.key?'btn-gold':'')+'" style="width:100%;margin-top:3px;text-align:left" data-act="moveSys" data-k="'+s.key+'" '+(ok?'':'disabled')+'>'+(S.sys===s.key?'◉ ':'○ ')+esc(s.name)+(me?UT('mv.dlg.sysMe'):'')+(ok?'':UT('mv.dlg.sysNo'))+'</button>'}).join('');
    h+='<div class="tiny muted" style="margin-top:4px">'+UT('mv.dlg.sysNote')+'</div>';
  }else if(S.step===2){
    h+='<div class="small" style="margin:4px 0">'+UT('mv.dlg.staff')+'</div>';
    const rk=MV_RANKS.filter(k=>G.emps.some(e=>e.rank===k));
    if(!rk.length)h+='<div class="tiny muted">'+UT('mv.dlg.noStaff')+'</div>';
    h+=rk.map(k=>{const L=G.emps.filter(e=>e.rank===k);if(S.take[k]===undefined)S.take[k]=L.length===1?L[0].id:null;
      return '<div class="card tiny"><b>'+rankName(k)+'</b><div class="row" style="justify-content:flex-start;gap:4px;flex-wrap:wrap;margin-top:3px">'
        +L.map(e=>'<button class="pixel-btn btn-sm '+(S.take[k]===e.id?'btn-gold':'')+'" data-act="moveTake" data-k="'+k+'" data-id="'+e.id+'">'+esc(e.name)+'</button>').join('')
        +'<button class="pixel-btn btn-sm '+(S.take[k]===null?'btn-gold':'')+'" data-act="moveTake" data-k="'+k+'" data-id="">'+UT('mv.dlg.none')+'</button></div></div>'}).join('');
    h+='<div class="tiny muted">'+UT('mv.dlg.staffNote')+'</div>';
  }else{
    const k=moveTravelTurns(),d=dateAfter(k),S_=SYS_BY_KEY[S.sys],firm=UT('me.firm',{firm:moveYago(),sys:S_.name});
    const take=Object.values(S.take).filter(Boolean).map(id=>G.emps.find(e=>e.id===id)).filter(Boolean);
    const inv=Object.values(G.inv||{}).reduce((a,b)=>a+b,0)+xinvQty()+Object.values(G.contra||{}).reduce((a,b)=>a+b,0);
    const B=[UT('mv.cf.firm',{f:esc(firm),c:ct.name}),UT('mv.cf.road',{n:k,d:dateLabel(d),y:d.year!==G.year?UT('mv.cf.year'):''}),UT('mv.cf.fee',{a:fmt(MVO().fee)}),
      UT('mv.cf.take',{a:take.length?take.map(e=>rankName(e.rank)+' '+esc(e.name)).join('、'):UT('mv.dlg.none'),b:Math.max(0,G.emps.length-take.length)})];
    if(inv>0)B.push(UT('mv.cf.goods',{n:inv}));
    if(gmIsMe())B.push(UT('mv.cf.gm'));
    if(guildMember())B.push(UT('mv.cf.bond'));
    B.push(UT('mv.cf.reset'));
    h+='<div class="card tiny">'+B.map(x=>'<div>· '+x+'</div>').join('')+'</div>';
  }
  const back=S.step>1?'<button class="pixel-btn btn-sm" data-act="moveStep" data-d="-1">'+UT('btn.moveBack')+'</button>':'<button class="pixel-btn btn-sm" data-act="reqDone">'+UT('btn.moveLater')+'</button>';
  const fwd=S.step<3?'<button class="pixel-btn btn-sm btn-gold" data-act="moveStep" data-d="1">'+UT('btn.moveNext')+'</button>':'<button class="pixel-btn btn-sm btn-red" data-act="moveDepart">'+UT('btn.moveDepart')+'</button>';
  UI.showInfo(UT('mv.dlg.t',{c:ct.name}),h+'<div class="grid2" style="margin-top:6px">'+back+fwd+'</div>');
}
/** 屋號（「三河屋·材木問屋」的前半）。 */
const moveYago=()=>String(G.firm||'').split('·')[0]||SYS_BY_KEY[G.sysKey].firm;
ACT.moveGo=()=>{if(!moving()||!moveReady().ok)return;UI.s.mv={step:1,sys:null,take:{}};moveDialog()};
ACT.moveSys=el=>{UI.s.mv.sys=el.dataset.k;moveDialog()};
ACT.moveTake=el=>{UI.s.mv.take[el.dataset.k]=el.dataset.id?+el.dataset.id||el.dataset.id:null;moveDialog()};
ACT.moveStep=el=>{UI.s.mv.step=clamp(UI.s.mv.step+(+el.dataset.d),1,3);moveDialog()};
ACT.moveDepart=()=>{
  if(!moving()||!moveReady().ok){UI.hideInfo();return}
  const S=UI.s.mv,M=G.move,ct=CITY(M.city);UI.s.mv=null;INFO_AFTER=null;UI.hideInfo();
  const log=moveDepart(S.sys,Object.values(S.take).filter(Boolean));
  playFx(ct.region_id===homeCity().region_id||!canSea(ct)?'cart':'boat',UT('mv.fx'),ct.name,()=>{
    SCENE.sig='';sceneSync(true);UI.go('home');UI.render();
    UI.showInfo(UT('mv.arrive.t',{c:ct.name}),'<div class="notice">'+esc(TX('mv.arrive'))+'</div>'+log.map(t=>'<div class="tiny" style="margin-top:4px">'+esc(t)+'</div>').join(''));
    armFaceEvents();
  },1600);
};
/* ---------- 啟程：清掉舊城、跳過旅途、建立新城 ---------- */
function moveDepart(sysKey,takeIds){
  const log=[],put=t=>{pushNews(t);log.push(t)},M=G.move,old=homeCity(),dest=CITY(M.city),friend=M.cid,y0=G.year;
  // 一、舊城的事收尾
  if(G.guild&&G.guild.urge&&!G.guild.urge.done&&gmIsMe())urgeAuto(G.guild,log);       // 公會長沒處理的督促卡＝推託
  if(gmIsMe()){const f=gmFineNow();const t=NEWS('mv.gmOut')+(f||'')+gmSucceed('me');put(t)}   // 公會長卸任，沒報告的得標金照罰
  if(guildMember())guildForfeit();                                                     // 訂約金作廢
  payPublic('spend.move',MVO().fee);
  const keep=new Set(takeIds);
  G.emps.filter(e=>!keep.has(e.id)).forEach(e=>{if(e.cid&&npc(e.cid))npc(e.cid).hired=false});
  G.emps=G.emps.filter(e=>keep.has(e.id));
  G.emps.forEach(e=>{if(e.cid&&npc(e.cid))npc(e.cid).cityId=dest.id});
  Object.keys(G.rel).forEach(c=>{const n=npc(c),r=G.rel[c];if(n&&r&&r.bond&&r.aff>=100&&n.cityId===old.id&&!n.hired&&OF_ROLES.includes(n.role)){r.out=true;r.ofT=G.turn+moveTravelTurns()}});   // 只有好感 100 的舊城商人成為外城友人（從抵達那一旬起算往來）
  G.intros=[];G.introId=null;
  moveClearCity();
  // 二、跳過旅途
  const k=moveTravelTurns(),d=dateAfter(k);
  ['exempt','horse','cheap','escort','taxfree','blind','calm'].forEach(f=>{if(typeof G.flags[f]==='number')G.flags[f]=Math.max(0,G.flags[f]-k)});   // 限期效果照樣過了這些旬
  G.turn+=k;G.month=d.month;G.cycle=d.cycle;G.year=d.year;
  // 三、建立新城
  const fromSys=G.sysKey;G.sysKey=sysKey||G.sysKey;
  G.firm=UT('me.firm',{firm:moveYago(),sys:SYS_BY_KEY[G.sysKey].name});
  G.cityId=dest.id;
  G.supplySeed=hashStr('originSupply|'+G.rs+'|'+G.cityId+'|'+G.turn);
  G.cityPopulation=parseInt(dest.population,10)||0;
  moveTopUp(dest.id);
  officialMigrate();officialsOf(G.cityId).forEach(n=>addKnown(n.cid));
  {const r=R(friend);r.lockAff=true;setAff(r,100);r.out=false;r.met=true;r.seen=true;r.bond=Object.assign({},r.bond||{mult:1},{label:UT('mv.bond'),introId:null});addKnown(friend);G.intros=[{cid:friend}];G.introId=friend;logRel(friend,UT('mv.log.arrive'))}
  G.cartel={state:'pledged',comp:65,sanction:0,cheated:0,bond:costOf('guildBond'),pot:0,policy:chance(ODDS.guildPolicy.normal)?'normal':'restrict'};   // 友人代墊訂約金（同開局）
  G.mk={};initMarket();
  G.share=marketShares();
  G.gm=null;if(G.month!==3){const t=gmSucceed('me');if(t)log.push(t)}
  newMeeting();
  G.daimyo=null;daimyoPlan();
  G.ap=AP_MAX;G.move=null;G.moveLast=G.turn;
  G.cityHist=G.cityHist||{};(G.cityHist[dest.id]=G.cityHist[dest.id]||[]).push({year:G.year,title:NEWS('mv.hist',{f:G.firm,c:old.name})});
  put(NEWS(G.sysKey!==fromSys?'mv.arriveSys':'mv.arrive',{f:G.firm,c:dest.name,o:old.name,n:nameOf(friend),t:k}));
  // 四、路上跨了年：抵達這一旬補做新年
  if(G.year>y0){
    G.yearLog=[];G.yearSilver0=G.silver;
    buyoutEnsure();komonPlan();G.daimyo=null;daimyoPlan();
    put(NEWS('mv.yearRoad'));yearTick(log);
    moveTopUp(G.cityId);officialMigrate();                                            // 新年有人病逝：再補一次
  }
  put(NEWS('meet.today'));
  recordSilver();save();
  return log;
}
/** 清掉舊城的行情、資格與帳（新城比照新開局；遠國奉行所的地區許可保留）。 */
function moveClearCity(){
  G.inv={};G.stockSource={};G.xinv={};G.contra={};
  G.lic={wh:0,ship:0,horse:0,guard:0,staff:0};G.trade=[];G.wh.n=1;G.flags.firebreak=false;
  G.apps=[];G.heat=0;G.fame=Math.max(0,G.fameFloor||0);
  G.avgCost={};G.plan={};G.buyPlan={};G.sold={};G.bought={};G.rec={r:[],b:[],t:[]};G.orders=[];
  delete G.mybias;G.mytmp=1;G.share=null;G.shareMem=null;G.shareEst=false;G.shipOk=null;
  G.staple={streak:0,peak:1};G.supplyQuarter={stable:0,unstable:0,turns:0};G.festival=null;G.disaster=null;G.smugP={};
  G.bz=[];G.bzBuy={};G.bzShow=false;G.rvLot=null;G.rivalHeirs=[];
  G.gm=null;G.gmDue=null;G.gmLevy=null;G.gmArb=null;G.guild=null;
  G.urge=null;G.yami=null;G.popDown=0;G.lastGap=null;G.citySatLast=null;G.newTown=null;
  G.recruit=null;G.inspect=null;G.raidNote=null;G.tempHelp=null;G.swapOffer=null;G.lendOffer=null;G.stashOffer=null;G.xoffer=null;
  G.sumo=null;G.rushLot=null;G.rushBust=null;G.faceEvents=[];G.homeEvents=[];
}
/** 新城補人到開局本城規模（只補缺額；名冊尚未登場、在世的人；同地區出身優先）。 */
function moveTopUp(cityId){
  const ct=CITY(cityId),age=c=>G.year-c.birth_year,sameReg=n=>CITY(n.cityId)&&CITY(n.cityId).region_id===ct.region_id;
  const stranger=n=>!G.rel[n.cid]&&!G.known.includes(n.cid);
  HOME_ROLES.forEach(([role,n0,lo,hi])=>{
    const want=homeRoleN(role);let need=want-cityNpcs(cityId,role).filter(n=>!n.hired).length;
    if(need<=0)return;
    const fit=c=>c&&age(c)>=(lo||0)&&age(c)<=(hi||999)&&c.death_year>G.year+1;   // 調來的人也不能是一兩年內就過世的
    // 一、名冊裡還沒登場、年齡合適的人
    const pool=shuffle(CHARS.filter(c=>!G.world.npcs[c.id]&&hasRole(c,role)&&c.birth_year<=G.year&&c.death_year>G.year+1&&fit(c)));
    pool.sort((a,b)=>(b.native_region===ct.region_id)-(a.native_region===ct.region_id));
    pool.slice(0,need).forEach(c=>{G.world.npcs[c.id]={cid:c.id,cityId,role,pos:null};need--});
    if(need<=0)return;
    // 二、別城你不認識的人（同地區優先）；三、名伶還不夠，連你認識的名伶也調來
    const far=(ok,f)=>shuffle(Object.values(G.world.npcs).filter(n=>n.role===role&&n.cityId!==cityId&&alive(n.cid)&&!n.hired&&!jailed(n)&&(f||fit)(CH(n.cid))&&ok(n))).sort((a,b)=>sameReg(b)-sameReg(a));
    far(stranger).slice(0,need).forEach(n=>{n.cityId=cityId;need--});
    if(need>0&&role==='oiran')far(n=>!stranger(n)).slice(0,need).forEach(n=>{n.cityId=cityId;need--});
    if(need>0)far(stranger,c=>c&&age(c)>=18&&c.death_year>G.year+1).slice(0,need).forEach(n=>{n.cityId=cityId;need--});   // 四、還不夠：年紀輕一點的也調來
  });
}
