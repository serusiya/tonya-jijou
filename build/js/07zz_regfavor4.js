'use strict';
/* ======================= 遠國奉行所四階新請託（第一百五十二、一百六十五節） =======================
 *  - 唐船割符（郡代，本地）：拿到一張割符，河岸藏走私面板多一個「借給官方出差」；任何空閒船長都能派，私房錢照付、扣 1 行動點數、
 *     風聲不增加；只擲海難、不擲入港被扣。割符船回來就用掉；同時只能持有一張。
 *  - 國中物卸留（船手頭，外地，只能寫信）：公款 3,000 兩；挑該地區有出產、而你的船長飛腳到不了的本業貨一樣，玩家選一座該地區港口；
 *     審理三旬後的下一個整月，那座港口臨時出產這樣貨（以委託採買的出發旬判定）。一個地區同時只能有一樣。
 *  - 卸留請負（船手頭，本地）：把一批本業貨運到本地區另一座城交差；數量＝本城需求 × 你的市佔 × 九旬。開口後六旬內出發的外運都算，
 *     照送到的數量領基準價一點五倍；去程、回程各擲一次遇險；交不齊比照本陣御用達失約。
 *  - 國商助成（勘定吟味役，本地）：出資現款 5,000 兩，之後十旬每旬私房錢約 450 兩；官員調走、過世或下獄就斷了。全國同時只能有一筆。
 *  都是一般請託：好感 −10，同一位官員冷卻 12 旬。數值 ODDS.unload、ODDS.unloadJob、ODDS.kokusho；文字 fav.r*、r4.*。
 *  狀態：G.tally、G.unloads、G.ujob、G.kokusho。 */
REG_FAVORS.push(
  {k:'rtally',rank:4,cd:12,pos:['reg_04'],local:true,tally:true,avail:()=>!G.tally&&canSea(homeCity())},
  {k:'runload',rank:4,cd:12,pos:['reg_05'],unload:true,avail:n=>foreignReg(n)&&!!unloadOffer(n)},
  {k:'rujob',rank:4,cd:12,pos:['reg_05'],local:true,ujob:true,avail:n=>!G.ujob&&!!ujobOffer(n)},
  {k:'rkokusho',rank:4,cd:12,pos:['reg_06'],local:true,kokusho:true,avail:()=>!G.kokusho}
);
REG_FAVORS.filter(f=>f.tally||f.unload||f.ujob||f.kokusho).forEach(f=>{f.name=UT('fav.'+f.k);f.desc=UT('fav.'+f.k+'.d')});

/* ---------- 國中物卸留 ---------- */
const unloadList=()=>G.unloads||(G.unloads=[]);
/** 某城本旬臨時出產的貨（國中物卸留期間）。 */
const unloadProds=(ctId,t)=>unloadList().filter(x=>x.city===ctId&&x.from<=(t===undefined?G.turn:t)&&(t===undefined?G.turn:t)<=x.to).map(x=>x.name);
/** 船長飛腳到得了的城市（不看許可）。 */
const reachIds=()=>new Set(destList('sea',true).concat(destList('land',true)).map(x=>x.ct.id).concat([homeCity().id]));
/** 開價：這個地區有出產、你到不了的本業貨（同一位官員同一旬固定），以及可選的港口。 */
function unloadOffer(n){
  const rid=regOfNpc(n);if(unloadList().some(x=>x.rid===rid&&G.turn<=x.to))return null;
  const reach=reachIds(),cs=CITIES.filter(c=>c.region_id===rid);
  const can=new Set();cs.forEach(c=>{if(!reach.has(c.id))cityProdsBase(c).forEach(x=>can.add(x))});
  CITIES.filter(c=>reach.has(c.id)).forEach(c=>cityProdsBase(c).forEach(x=>can.delete(x)));
  const L=tradeComms().filter(c=>can.has(c.name));
  const ports=cs.filter(c=>canSea(c)&&c.id!==homeCity().id);
  if(!L.length||!ports.length)return null;
  const rd=seeded(n.cid+'|unload|'+G.turn);
  return {rid,name:L[Math.floor(rd()*L.length)].name,ports:ports.map(c=>c.id)};
}
/** 審理完成後的下一個整月：回傳起訖旬數與月份。 */
function unloadWindow(){
  const R_=ODDS.unload.review,ready=G.turn+R_,cyc=((G.cycle-1+R_)%3)+1,from=ready+(cyc===1?0:4-cyc);
  const ahead=Math.floor((G.cycle-1+(from-G.turn))/3),month=((G.month-1+ahead)%12)+1;
  return {from,to:from+2,month};
}
/** 選港口（請託清單按下後）。 */
function unloadPick(cid){
  const o=unloadOffer(npc(cid));if(!o)return '<div class="notice tiny">'+esc(MSG('r4.unloadNone'))+'</div>';
  return portraitHtml(cid,56)+'<div class="notice tiny">'+esc(MSG('r4.unloadPick',{g:COMM_MAP[o.name].short}))+'</div>'
    +o.ports.map(id=>{const ct=CITY(id),ok=seaPermitFor(ct);return '<div class="irow" style="margin-top:4px"><div class="row"><b class="small">'+esc(ct.name)+(ok?'':UT('voy.voyagePanel.8'))+'</b><button class="pixel-btn btn-sm btn-gold" data-act="reqAsk" data-cid="'+cid+'" data-k="runload" data-t="'+id+'">'+UT('btn.r4pick')+'</button></div></div>'}).join('');
}
{const _ask=ACT.reqAsk;ACT.reqAsk=el=>{
  if(el.dataset.k==='runload'&&!el.dataset.t){BT=null;UI.showInfo(UT('bt.reqAsk.4',{a:nameOf(el.dataset.cid)}),unloadPick(el.dataset.cid));return}
  _ask(el);
}}
/** 每旬：卸留月開始與結束的旬報；過期的紀錄清掉。 */
function unloadTick(log){
  const L=unloadList();if(!L.length)return;
  L.forEach(x=>{
    const ct=CITY(x.city),g=COMM_MAP[x.name];if(!ct||!g)return;
    if(G.turn===x.from){const t=NEWS('r4.unload.open',{c:ct.name,g:g.short});pushNews(t);log.push(t)}
    if(G.turn===x.to+1){const t=NEWS('r4.unload.close',{c:ct.name,g:g.short});pushNews(t);log.push(t)}
  });
  G.unloads=L.filter(x=>G.turn<=x.to);
}

/* ---------- 卸留請負 ---------- */
/** 卸留處的走法：兩邊都是港口城走海運（要入津御免），否則走陸運（要關所通行手形、兩旬內）。 */
function ujobRoute(ct){
  const a=homeCity();
  if(canSea(a)&&canSea(ct))return seaPermitFor(ct)?'sea':null;
  return canLand(a,ct)&&landPermit()?'land':null;
}
/** 開價（同一位官員同一旬固定）：貨、數量、卸留處。 */
function ujobOffer(n){
  const a=homeCity(),own=new Set(cityProds(a));
  const L=tradeComms().filter(c=>!own.has(c.name));
  const ds=CITIES.filter(c=>c.region_id===a.region_id&&c.id!==a.id&&ujobRoute(c));
  if(!L.length||!ds.length)return null;
  const rd=seeded(n.cid+'|ujob|'+G.turn),c=L[Math.floor(rd()*L.length)],ct=ds[Math.floor(rd()*ds.length)];
  const sh=(G.share&&G.share.me)||0.05,D=(G.mk[c.name]&&G.mk[c.name].D)||cityD(a,c);
  return {name:c.name,qty:Math.max(ODDS.unloadJob.minQty,Math.round(D*sh*ODDS.unloadJob.turns)),city:ct.id,mode:ujobRoute(ct)};
}
/** 在途中的外運數量。 */
const ujobTransit=()=>G.ships.filter(s=>s.out).reduce((a,s)=>a+s.out.q,0);
/** 商路頁的卸留請負卡：選人、數量、回程委託金，按「外運出發」。 */
function ujobCard(){
  const J=G.ujob;if(!J)return '';
  const c=COMM_MAP[J.name],ct=CITY(J.city);if(!c||!ct)return '';
  const left=Math.max(0,J.qty-J.done-ujobTransit()),open=G.turn<=J.until;
  let h='<div class="card warn"><b class="small">'+UT('r4.card.title')+'</b><div class="tiny">'+UT('r4.card.sub',{g:c.short,q:J.qty,d:J.done,c:ct.name,m:NM('crew',J.mode),t:Math.max(0,J.until-G.turn+1),p:fmt1(c.base*ODDS.unloadJob.payRate)})+'</div>';
  if(!open){h+='<div class="tiny muted" style="margin-top:4px">'+UT('r4.card.closed')+'</div></div>';return h}
  if(left<=0){h+='<div class="tiny muted" style="margin-top:4px">'+UT('r4.card.allOut')+'</div></div>';return h}
  const caps=idleCaptains(J.mode),S=UI.s.uj||(UI.s.uj={});
  if(!caps.length){h+='<div class="tiny muted" style="margin-top:4px">'+UT('r4.card.noCrew',{m:NM('crew',J.mode)})+'</div></div>';return h}
  if(!caps.some(e=>e.id===S.capt))S.capt=caps[0].id;
  const maxQ=Math.max(0,Math.min(G.inv[J.name]||0,left,capOf(J.name,J.mode)));
  S.qty=clamp(Math.floor(S.qty||maxQ),0,maxQ);S.budget=clamp(Math.floor((S.budget||0)/50)*50,0,Math.max(0,Math.floor(G.silver-voyQTotal())));
  h+='<div style="margin-top:4px">'+caps.map(e=>'<span class="pill '+(e.id===S.capt?'on':'')+'" data-act="ujCapt" data-id="'+e.id+'">'+esc(e.name)+'</span>').join('')+'</div>';
  const maxB=Math.floor(Math.max(0,G.silver-voyQTotal())/50)*50,bMax=maxB>=100?maxB:0;if(S.budget>bMax)S.budget=bMax;if(S.budget>0&&S.budget<100)S.budget=100;
  h+='<div class="row small" style="margin-top:4px"><span>'+UT('r4.card.qty',{h:G.inv[J.name]||0,m:maxQ})+'</span><b id="uj-q-v">'+S.qty+'</b></div>';
  h+=stepRow('<input id="uj-q" type="range" min="0" max="'+Math.max(1,maxQ)+'" value="'+S.qty+'" step="1" data-chg="ujQty" data-lbl="uj-q-v"'+(maxQ<1?' disabled':'')+'>','uj-q',maxQ<1||S.qty<=0,maxQ<1||S.qty>=maxQ);
  h+='<div class="row small" style="margin-top:4px"><span>'+UT('r4.card.budget')+'</span><b id="uj-b-v">'+UT('r4.card.budgetVal',{a:fmt(S.budget)})+'</b></div>';
  h+=stepRow('<input id="uj-b" type="range" min="0" max="'+Math.max(50,bMax)+'" value="'+S.budget+'" step="50" data-chg="ujBudget" data-lbl="uj-b-v" data-snap="100" data-prev="'+S.budget+'" data-unit="'+esc(UT('r4.card.budgetVal',{a:'#'}))+'"'+(bMax<100?' disabled':'')+'>','uj-b',bMax<100||S.budget<=0,bMax<100||S.budget>=bMax);
  h+='<button class="pixel-btn btn-gold" style="width:100%;margin-top:6px" data-act="ujGo" '+(maxQ<=0||S.qty<=0||apLeft()<=0?'disabled':'')+'>'+UT('btn.ujGo')+'</button>';
  h+='<div class="tiny muted" style="margin-top:3px">'+UT('r4.card.foot')+'</div>';
  return h+'</div>';
}
ACT.ujCapt=el=>{(UI.s.uj=UI.s.uj||{}).capt=el.dataset.id;renderRoutes()};
CHG.ujQty=el=>{(UI.s.uj=UI.s.uj||{}).qty=+el.value;renderRoutes()};
CHG.ujBudget=el=>{const S=(UI.s.uj=UI.s.uj||{});S.budget=snapVal(el);renderRoutes()};
/** 外運出發：從倉庫裝貨，扣 1 行動點數；回程委託金可以是 0。 */
ACT.ujGo=()=>{
  const J=G.ujob,S=UI.s.uj||{};if(!J||G.turn>J.until){toast(MSG('r4.ujClosed'));return}
  if(banditBlocks(J.mode)){toast(UT('bandit.notice.'+J.mode,{n:banditLeft()}),4200);return}
  if((G.injured||0)>0){toast(MSG(hurtKey('sendVoyage.hurt'),{injured:G.injured}),4200);return}
  const cap=idleCaptains(J.mode).find(e=>e.id===S.capt);if(!cap){toast(MSG('sendVoyage.2',{mode:NM('crew',J.mode)}));return}
  const ct=CITY(J.city);if(!ujobRoute(ct)){toast(MSG('sendVoyage.4',{REG_NAME:REG_NAME(ct.region_id),sea:(J.mode==='sea'?UT('voy.sendVoyage'):UT('voy.sendVoyage.2'))}),4200);return}
  const left=J.qty-J.done-ujobTransit(),q=Math.floor(Math.min(S.qty||0,G.inv[J.name]||0,left,capOf(J.name,J.mode)));
  if(q<=0){toast(MSG('r4.ujNoGoods'));return}
  const b=Math.floor(S.budget||0);if(b>0&&b<100){toast(MSG('sendVoyage.5'));return}
  if(b>G.silver){toast(MSG('sendVoyage.6',{budget:fmt(b)}));return}
  if(!spendAP()){toast(MSG('sendVoyage.ap'));return}
  let d=distTurns(homeCity(),ct,J.mode);if(J.mode==='land'){if(G.flags.horse>0)d--;if(G.flags.road)d--;d=Math.max(1,d)}
  const unit=avgCostOf(J.name);stockTake(J.name,q,false);
  if(b>0)payPublic('spend.voyage|'+ct.id,b);
  const st=statsOfEmp(cap),risk=voyRisk(cap,d,J.mode)*(J.mode==='sea'&&G.flags.escort>0?ODDS.voyageRisk.escortMul:1);
  const bo=buyoutSnapshot(ct),rank=b>0?originTripTake(ct.id):0;
  G.ships.push({id:G.turn+'_'+Math.floor(rnd()*1e5),entrust:true,origId:ct.id,mode:J.mode,eta:d,eta0:d,risk,riskGo:risk,feeMul:(G.flags.taxfree>0?0.5:1)*(1-Math.min(0.3,0.1*(G.flags.charter||0))),cheap:G.flags.cheap>0,cost:b,budget:b,start:G.turn,capt:cap.id,captName:cap.name,cs:st.commerce_skill,ca:st.audacity_courage,
    buyout:bo.hit,buyoutY:bo.y,buyoutM:bo.m,buyoutRegion:bo.rid,supplyY:G.year,supplyM:G.month,supplyRank:rank,unl:unloadProds(ct.id),out:{name:J.name,q,unit,job:J.id}});
  UI.s.uj={};save();
  playFx(J.mode==='sea'?'boat':'cart',MSG('voyage.depart'),ct.name,()=>{toast(MSG('r4.ujGo',{n:cap.name,g:COMM_MAP[J.name].short,q,c:ct.name,d}),4200);UI.render()},1000);
};
/** 歸來時（resolveVoyage 呼叫）：去程遇險、交貨領錢。回傳入帳金額，說明寫進採買日誌。 */
function outboundSettle(s,E,log){
  const O=s.out,c=COMM_MAP[O.name],J=G.ujob&&G.ujob.id===O.job?G.ujob:null;
  const robbed=banditRobs(s.mode),go=robbed||chance(s.riskGo||s.risk||0);
  const lost=go?Math.round(O.q*ODDS.unloadJob.lossRate):0,got=O.q-lost,pay=Math.round(got*c.base*ODDS.unloadJob.payRate);
  if(J)J.done+=got;
  E.lines.push(NEWS('r4.out.line',{g:c.short,q:O.q,got,lost:lost?UT('r4.out.lost',{n:lost}):'',a:fmt(pay)}));
  E.items.push({n:UT('r4.out.item',{g:c.short}),q:O.q,unit:O.q?pay/O.q:0,cost:0,lost});
  E.outPay=pay;E.outGo=go;if(lost>0)E.lossVal=(E.lossVal||0)+lost*marketQuote(O.name);   // 去程遇險的貨損（荷損御賑）
  return pay;
}
/** 每旬（委託採買歸來之後）：交齊或期滿結算。 */
function ujobTick(log){
  const J=G.ujob;if(!J)return;
  const c=COMM_MAP[J.name],busy=G.ships.some(s=>s.out&&s.out.job===J.id);
  if(J.done>=J.qty){
    const t=NEWS('r4.ujob.done',{g:c.short,q:J.done});pushNews(t);log.push(t);addFame(0.5);G.ujob=null;return;
  }
  if(G.turn>J.until&&!busy){
    const r=G.rel[J.cid];if(r&&alive(J.cid)){setAff(r,Math.max(0,r.aff-ODDS.unloadJob.failAff));logRel(J.cid,UT('r4.log.fail',{d:ODDS.unloadJob.failAff}))}
    loseFame('tributeFail');sfx.bad();
    const t=NEWS('r4.ujob.fail',{g:c.short,q:J.done,n:J.qty});pushNews(t);log.push(t);G.ujob=null;
  }
}

/* ---------- 國商助成 ---------- */
/** 每旬：回扣進私房錢（不經現款、旬報只寫模糊的一句）。官員去職或過世就斷了。 */
function kokushoTick(log){
  const K=G.kokusho;if(!K)return;
  const n=npc(K.cid),ok=n&&alive(K.cid)&&n.pos&&n.pos.court==='region'&&n.pos.posId==='reg_06'&&regOfNpc(n)===homeRegion()&&!n.jailed;
  if(!ok){const t=NEWS('r4.kokusho.cut',{n:nameOf(K.cid)});pushNews(t);log.push(t);G.kokusho=null;return}
  G.gold=(G.gold||0)+rint(ODDS.kokusho.min,ODDS.kokusho.max);K.left--;
  const t=NEWS('r4.kokusho.gift'+(rnd()<0.5?'':'2'),{n:nameOf(K.cid)});pushNews(t);log.push(t);
  if(K.left<=0)G.kokusho=null;
}

/* ---------- 唐船割符：河岸藏走私面板 ---------- */
/** 割符可派的船長：任何空閒的船長。 */
const tallyCaptain=()=>idleCaptains('sea')[0]||null;
function tallyCard(){
  const T=G.tally;if(!T)return '';
  if(T.out)return '<div class="card"><div class="tiny">'+UT('r4.tally.out')+'</div></div>';
  const S=smugSel(),d=SMUG_DEST[S.dest],it=SMUG_BY[S.k],cost=Math.round(it.cost*d.mult*S.qty),cap=tallyCaptain();
  return '<div class="card"><b class="small">'+UT('r4.tally.title')+'</b><div class="tiny muted">'+UT('r4.tally.note')+'</div><div class="row small" style="margin-top:4px"><span>'+UT('r4.tally.cost',{a:cost,n:cap?esc(cap.name):UT('r4.tally.nobody')})+'</span><button class="pixel-btn btn-sm btn-gold" data-act="tallyGo" '+(!cap||apLeft()<=0?'disabled':'')+'>'+UT('btn.tallyGo')+'</button></div></div>';
}
ACT.tallyGo=()=>{
  const T=G.tally;if(!T||T.out)return;
  if((G.exile||0)>0){toast(MSG('smugGo.1'));return}
  const S=smugSel(),d=SMUG_DEST[S.dest],it=SMUG_BY[S.k];
  if(banditBlocks('sea')){toast(UT('bandit.notice.sea',{n:banditLeft()}),4200);return}
  const cap=tallyCaptain();if(!cap){toast(MSG('sendVoyage.2',{mode:NM('crew','sea')}));return}
  if(contraQty()+S.qty>CONTRA_CAP){toast(MSG('smugGo.4'));return}
  const cost=Math.round(it.cost*d.mult*S.qty);
  if(G.gold<cost){toast(MSG('smugGo.5',{cost}));return}
  if((G.injured||0)>0){toast(MSG(hurtKey('smugGo.hurt'),{injured:G.injured}));return}
  if(!spendAP()){toast(MSG('smugGo.ap'));return}
  G.gold-=cost;T.out=true;
  smugList().push({id:G.turn+'_'+Math.floor(rnd()*1e5),k:S.k,qty:S.qty,dest:S.dest,eta:d.d,capt:cap.id,captName:cap.name,tally:true,risk:clamp(ODDS.smugRisk.p*d.d*crewRiskMult(cap),ODDS.smugRisk.min,ODDS.smugRisk.max)});
  sfx.step();toast(MSG('r4.tallyGo',{name:cap.name,d:d.d}));
  UI.render();refreshSheet();
};

/* ---------- 請託的檢查、名稱與效果 ---------- */
{const _res=regFavorResolve;regFavorResolve=function(f,n){
  if(f.unload){const o=unloadOffer(n);if(!o)return Object.assign({},f,{off:true});return Object.assign({},f,{name:UT('fav.runload.n',{g:COMM_MAP[o.name].short}),desc:UT('fav.runload.dd',{g:COMM_MAP[o.name].short,a:fmt(ODDS.unload.pay)})})}
  if(f.ujob){const o=ujobOffer(n);if(!o)return Object.assign({},f,{off:true});return Object.assign({},f,{name:UT('fav.rujob.n',{g:COMM_MAP[o.name].short,q:o.qty}),desc:UT('fav.rujob.dd',{c:CITY(o.city).name,m:NM('crew',o.mode),p:fmt1(COMM_MAP[o.name].base*ODDS.unloadJob.payRate),t:ODDS.unloadJob.limit})})}
  return _res(f,n);
}}
{const _chk=regFavorCheck;regFavorCheck=function(f,n){
  if(f.tally&&G.tally)return MSG('r4.tallyHeld');
  if(f.unload){if(!foreignReg(n))return MSG('r4.unloadForeign');if(!unloadOffer(n))return MSG('r4.unloadNone');if(G.silver<ODDS.unload.pay)return MSG('rfav.short',{a:fmt(ODDS.unload.pay)})}
  if(f.ujob){if(G.ujob)return MSG('r4.ujobBusy');if(!ujobOffer(n))return MSG('r4.ujobNone')}
  if(f.kokusho){if(G.kokusho)return MSG('r4.kokushoBusy');if(G.silver<ODDS.kokusho.pay)return MSG('rfav.short',{a:fmt(ODDS.kokusho.pay)})}
  return _chk(f,n);
}}
REG_FAVOR.rtally=n=>{G.tally={cid:n.cid,turn:G.turn,out:false};return MSG('r4.tally')};
REG_FAVOR.runload=(n,arg)=>{
  const o=unloadOffer(n),port=o&&o.ports.includes(arg)?arg:o&&o.ports[0];
  const W=unloadWindow();
  payPublic('spend.unload|'+o.name,ODDS.unload.pay);
  unloadList().push({rid:o.rid,city:port,name:o.name,cid:n.cid,ask:G.turn,from:W.from,to:W.to});
  return MSG('r4.unload',{a:fmt(ODDS.unload.pay),c:CITY(port).name,g:COMM_MAP[o.name].short,m:W.month});
};
REG_FAVOR.rujob=n=>{
  const o=ujobOffer(n);
  G.ujob={id:G.turn+'_'+Math.floor(rnd()*1e5),cid:n.cid,name:o.name,qty:o.qty,done:0,city:o.city,mode:o.mode,start:G.turn,until:G.turn+ODDS.unloadJob.limit-1};
  return MSG('r4.ujob',{g:COMM_MAP[o.name].short,q:o.qty,c:CITY(o.city).name,t:ODDS.unloadJob.limit});
};
REG_FAVOR.rkokusho=n=>{
  payPublic('spend.kokusho',ODDS.kokusho.pay);addHeat(ODDS.kokusho.heat);
  G.kokusho={cid:n.cid,left:ODDS.kokusho.turns,start:G.turn};
  return MSG('r4.kokusho',{a:fmt(ODDS.kokusho.pay)});
};
SPEND_ARG['spend.unload']=a=>COMM_MAP[a]?COMM_MAP[a].short:a;
