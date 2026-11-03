'use strict';
/** 遇難的圖示與標籤：海難／海賊／山賊。 */
const voyIcon=(mode,robbed)=>mode==='land'?'⛰️':robbed?'🏴‍☠️':'🌊';
const voyMishap=(mode,robbed)=>mode==='land'?'voy.log.wreckLand':robbed?'voy.log.pirate':'voy.log.wreckSea';
/* ★檔案總覽：委託採買（海運／陸運）
 * - 玩家指派：運輸方式（船長／飛腳）、目的地（產地城市）、委託金；船長不會跑錯地方。
 * - 到了目的地，買什麼由船長視本事決定（只能買該地出產的貨）：
 *   80% 買本業能賣的貨（入倉；當地產好幾樣本業貨時，多半偏重其中一兩樣）；20% 買便宜、但非本業的「跨行貨」（也入倉，須請座客商人代售）。
 *   目的地沒有本業貨時：80% 空手而回（只扣雜費），20% 改買跨行貨。
 *   唐物藥種另有「夾帶」：主要採買之外，每趟 20% 機率順帶一項違禁品 3～5 單位（從委託金扣、入密庫，風聲 +0.2 × 危險度）。
 * - 數量與價格視船長商才；海難／山賊會損失七成貨。詳情寫進歸航那一旬的旬報「船隻歸航」。 */
const MODE_ICON={sea:'⛵',land:'🐎'};
const MODE_RANK={sea:'captain',land:'courier'};
/** 本旬出運清單（存檔）：[{capt,mode,dest,budget}]；推進一旬時清空。 */
const voyQ=()=>G.voyQueue||(G.voyQueue=[]);
/** 清單裡已排的委託金合計。 */
const voyQTotal=()=>voyQ().reduce((a,q)=>a+q.budget,0);
/** 空閒的船長／飛腳：不在採買、走私途中；inclQ＝連已排進出運清單的也算（出發時用）。 */
const idleCaptains=(mode,inclQ)=>{
  const used=new Set(G.ships.map(s=>s.capt));(G.smug||[]).forEach(v=>used.add(v.capt));
  if(!inclQ)voyQ().forEach(q=>used.add(q.capt));
  return G.emps.filter(e=>e.rank===MODE_RANK[mode]&&!used.has(e.id)&&!jailedEmp(e)&&!empLent(e));
};
/** 清掉已失效的清單項目（人已離職，或已被派去走私）。 */
function voyQPrune(){if(!G.voyQueue)return;G.voyQueue=G.voyQueue.filter(q=>idleCaptains(q.mode,true).some(e=>e.id===q.capt))}
const ownNameSet=()=>new Set(ownComms().map(c=>c.name));
/** 本業中已可交易的貨（委託採買時船長只買這些）。 */
const tradeNameSet=()=>new Set(tradeComms().map(c=>c.name));
/** 風險：每旬約 3%（海）／2.2%（陸），乘船長膽識與商才的倍數；陸路有保鏢可再降。 */
const voyRisk=(cap,d,mode)=>{const V_=ODDS.voyageRisk;return clamp((mode==='sea'?V_.sea:V_.land)*d*crewRiskMult(cap)-(mode==='land'?V_.guardLand*guardCount():0),V_.min,V_.max)};
const voyFee=d=>clamp(0.04+0.01*d,0.06,0.14);
/** 本月前往各產地的商隊順位；海陸合併，換月即重置。 */
function originTripState(){
  if(!G.originTrips||G.originTrips.y!==G.year||G.originTrips.m!==G.month)G.originTrips={y:G.year,m:G.month,byCity:{}};
  G.originTrips.byCity=G.originTrips.byCity||{};return G.originTrips;
}
const originTripUsed=cityId=>originTripState().byCity[cityId]||0;
function originTripTake(cityId){const S=originTripState(),n=(S.byCity[cityId]||0)+1;S.byCity[cityId]=n;return n}
/** 多項本業貨的採買權重：一成均衡，其他多半偏重或集中在當地較充足、相對較便宜的一項。 */
function makeVoyageMix(its){
  if(its.length<=1){if(its[0])its[0].w=1;return {kind:'single',main:its[0]||null}}
  const M=ODDS.voyageMix,r=rnd();
  if(r<M.balanced){its.forEach(x=>x.w=1/its.length);return {kind:'balanced',main:null}}
  its.forEach(x=>x.mixScore=Math.pow(x.si,M.supplyPow)*Math.pow(1/Math.max(0.01,x.pf),M.pricePow)*(0.7+0.6*rnd()));
  let z=rnd()*its.reduce((a,x)=>a+x.mixScore,0),main=its[its.length-1];
  for(const x of its){z-=x.mixScore;if(z<=0){main=x;break}}
  const biased=r<M.balanced+M.biased,lo=biased?M.biasedMin:M.focusMin,hi=biased?M.biasedMax:M.focusMax,p=lo+(hi-lo)*rnd();
  main.w=p;const rest=its.filter(x=>x!==main);rest.forEach(x=>x.restW=0.25+1.5*rnd());
  const sum=rest.reduce((a,x)=>a+x.restW,0);rest.forEach(x=>x.w=(1-p)*x.restW/sum);
  return {kind:biased?'biased':'focus',main};
}
/** 可前往的目的地：海運＝雙方皆為港灣；陸運＝同地區且 2 旬內。商路頁只列已有許可的城市；full＝連無許可的也列（開局贈送與出發檢查用）。 */
function destList(mode,full){
  const a=homeCity(),own=tradeNameSet(),all=ownNameSet();
  const ok0=mode==='sea'?(ct=>canSea(a)&&canSea(ct)):(ct=>canLand(a,ct)),ok=ct=>ok0(ct)&&(full||permitOf(mode,ct));
  return CITIES.filter(ct=>ct.id!==a.id&&ok(ct)).map(ct=>({ct,d:distTurns(a,ct,mode),
    own:cityProds(ct).filter(n=>own.has(n)&&COMM_MAP[n]),oth:cityProds(ct).filter(n=>!all.has(n)&&COMM_MAP[n]),blocked:buyoutDepartureBlocked(ct)}))
    .sort((x,y)=>x.blocked-y.blocked||(y.own.length>0)-(x.own.length>0)||x.d-y.d||y.own.length-x.own.length);
}
/** 出發：扣委託金與 1 行動點數；free＝開局贈送（兩者都不扣）；batch＝出運清單一起出發（行動點數由 vGoAll 統一扣一次）。 */
function sendVoyage(captId,budget,destId,mode,free,batch){
  mode=mode||'sea';
  if(!free&&banditBlocks(mode))return {ok:false,msg:UT('bandit.notice.'+mode,{n:banditLeft()})};   // 本地區賊亂（07zv_bandit.js）
  const cap=idleCaptains(mode,true).find(e=>e.id===captId);if(!cap)return {ok:false,msg:MSG('sendVoyage.2',{mode:NM('crew',mode)})};
  const dest=CITY(destId),dl=destList(mode,true).find(x=>x.ct.id===destId);if(!dest||!dl)return {ok:false,msg:MSG('sendVoyage.3')};
  if(!free&&!permitOf(mode,dest))return {ok:false,msg:MSG('sendVoyage.4',{REG_NAME:REG_NAME(dest.region_id),sea:(mode==='sea'?UT('voy.sendVoyage'):UT('voy.sendVoyage.2'))})};
  if(buyoutDepartureBlocked(dest))return {ok:false,msg:MSG('sendVoyage.buyout',{REG_NAME:REG_NAME(dest.region_id),month:buyoutMonth(G.month)})};
  budget=Math.floor(budget);if(!(budget>=100))return {ok:false,msg:MSG('sendVoyage.5')};
  if(!free&&G.silver<budget)return {ok:false,msg:MSG('sendVoyage.6',{budget:fmt(budget)})};
  if(!free&&(G.injured||0)>0)return {ok:false,msg:MSG('sendVoyage.hurt',{injured:G.injured})};
  if(!free&&!batch&&apLeft()<=0)return {ok:false,msg:MSG('sendVoyage.ap')};   // 委託採買要親自到碼頭交代：扣 1 行動點數（開局贈送的那趟不扣；出運清單一起出發只扣一次）
  if(!free&&!batch){G.ap--;updateAP()}
  const st=statsOfEmp(cap);let d=dl.d;
  if(mode==='land'){if(G.flags.horse>0)d--;if(G.flags.road)d--;d=Math.max(1,d)}
  if(!free)payPublic('spend.voyage|'+dest.id,budget);
  const bo=buyoutSnapshot(dest);
  const supplyRank=originTripTake(destId);
  G.ships.push({id:G.turn+'_'+Math.floor(rnd()*1e5),entrust:true,origId:destId,mode,eta:d,eta0:d,risk:voyRisk(cap,d,mode)*(mode==='sea'&&G.flags.escort>0?ODDS.voyageRisk.escortMul:1),feeMul:(G.flags.taxfree>0?0.5:1)*(1-Math.min(0.3,0.1*(G.flags.charter||0))),cheap:G.flags.cheap>0,cost:budget,budget,start:G.turn,capt:cap.id,captName:cap.name,cs:st.commerce_skill,ca:st.audacity_courage,buyout:bo.hit,buyoutY:bo.y,buyoutM:bo.m,buyoutRegion:bo.rid,supplyY:G.year,supplyM:G.month,supplyRank,unl:unloadProds(destId)});
  return {ok:true,msg:MSG('sendVoyage.ok',{crew:NM('crew',mode),name:cap.name,budget:fmt(budget),dest:dest.name,d})};
}
/** 歸來結算。 */
function resolveVoyage(s,log){
  const mode=s.mode,cs=s.cs||50,budget=s.budget||0,back=!(s.out&&!budget),robbed=back&&banditRobs(mode),wreck=back&&(robbed||chance(s.risk)),keep=wreck?0.3:1;   // 卸留請負空手回來（委託金 0）時回程不擲   // 本地區賊亂期間回程一律被劫（07zv_bandit.js）
  const dest=CITY(s.origId),own=tradeNameSet(),all=ownNameSet(),buyout=!!s.buyout;
  const prod=(dest?[...new Set(cityProdsBase(dest).concat(s.unl||[]))]:[]).filter(n=>COMM_MAP[n]);   // 國中物卸留以出發旬判定（s.unl）
  const ownP=buyout?[]:prod.filter(n=>own.has(n)),othP=prod.filter(n=>!all.has(n));
  const fee=Math.round(budget*voyFee(Math.max(1,s.eta0||4))*(s.feeMul||1));
  let spend=Math.floor((budget-fee)*clamp(0.78+0.18*cs/100+(rnd()-0.5)*0.06,0.7,0.98));
  let carry=null;                                       // 唐物藥種夾帶：先從委託金留出這筆錢，再做主要採買
  if(G.sysKey==='medicine'&&chance(ODDS.voyageKind.carry)){
    const K=ODDS.voyageKind,it=pick(SMUG_ITEMS),unit=it.cost*(1-0.2*cs/100);
    const q=Math.max(0,Math.min(rint(K.carryMin,K.carryMax),CONTRA_CAP-contraQty(),Math.floor(spend/unit)));
    if(q>0){carry={it,q,cost:Math.round(unit*q)};spend-=carry.cost}
  }
  let kind,note='';
  if(s.out&&!budget)kind='outOnly';                      // 卸留請負：只交貨、不採買
  else if(ownP.length){kind=rnd()<ODDS.voyageKind.cross?'cross':'own';if(kind==='cross'&&!othP.length)kind='own'}
  else{                                                 // 目的地沒有本業貨：八成空手而回，兩成改買他行貨（當地也沒有他行貨就空手）
    kind=othP.length&&rnd()<ODDS.voyageKind.noOwnCross?'cross':'empty';
    note=buyout?UT('voy.buyoutNote',{region:REG_NAME(s.buyoutRegion),month:buyoutMonth(s.buyoutM),crew:NM('crew',mode),result:kind==='cross'?UT('voy.resolveVoyage.2'):UT('voy.resolveVoyage.3')}):UT('voy.resolveVoyage.4',{a:dest?dest.name:UT('voy.resolveVoyage'),b:NM('crew',mode),c:kind==='cross'?UT('voy.resolveVoyage.2'):UT('voy.resolveVoyage.3')});
  }
  const E={turn:G.turn,date:dateStr(),capt:s.captName,budget,kind,wreck,robbed,buyout,dest:dest?dest.name:'',mode,lines:[],items:[],fee};   // items：採買日誌表格（貨名、數量、總價、損失）
  let refund=budget-fee,income=0;
  const L=E.lines,pc=x=>Math.round(x*100)+'%',wn=wreck?(robbed&&mode==='sea'?UT('voy.wnPirate'):mode==='sea'?UT('voy.wn'):UT('voy.wn.2')):'';
  L.push(s.out?NEWS('r4.out.head',{dest:E.dest,b:budget?UT('r4.out.headBuy'):''})+note:NEWS('kind.1',{dest:E.dest,note}));
  if(s.out)income+=outboundSettle(s,E,log);             // 卸留請負：去程遇險、交貨領錢（07zz_regfavor4.js）
  if(kind==='own'&&ownP.length){
    /* 同一地產好幾樣本業貨時多半偏重或集中採買，只有少數均衡；某樣碰到產地貨源、庫存上限或倉位而買不滿，
       剩下的錢與運量再依權重分給其他還能買的貨（直到錢、運量或倉位用完）。
       單趟運量以「裝載比例」計：每樣貨用掉 數量÷該貨單趟上限 的船艙（或馬背）。 */
    const its=shuffle(ownP).map(n=>{const c=COMM_MAP[n],si=originSupplyForShip(s,dest,n),pf=clamp(0.80-0.30*cs/100+(rnd()-0.5)*ODDS.originSupply.priceJitter,0.5,0.95)*(s.cheap?0.9:1)*originSupplyPrice(si);
      return {n,c,si,pf,unit:c.base*pf,cp:capOf(n,mode),src:originSupplyCap(n,mode,si,s.supplyRank||1),room:Math.max(0,itemCap(n)-(G.inv[n]||0)),q:0}});
    let money=spend,load=1,wh=Math.max(0,invCap()-invUsed()),act=its.filter(x=>x.room>0&&x.src>0);
    const mix=makeVoyageMix(act);
    if(mix.kind!=='single')L.push(UT('voy.mix.'+mix.kind,{name:mix.main?mix.main.c.short:''}));
    for(let round=0;round<12&&act.length&&wh>0&&load>1e-6;round++){
      const ws=act.reduce((a,x)=>a+x.w,0),money0=money,load0=load;let added=0;
      act.forEach(x=>{const m=money0*x.w/ws,l=load0*x.w/ws,q=Math.max(0,Math.min(Math.floor(m/x.unit),Math.floor(l*x.cp+1e-9),x.src-x.q,x.room-x.q,wh));if(q<=0)return;
        x.q+=q;money-=q*x.unit;load-=q/x.cp;wh-=q;added+=q});
      act=act.filter(x=>x.q<Math.min(x.room,x.src));
      if(!added){const can=act.filter(x=>money>=x.unit&&load+1e-9>=1/x.cp&&wh>0).sort((a,b)=>b.w-a.w)[0];if(!can)break;
        const q=Math.max(0,Math.min(Math.floor(money/can.unit),Math.floor(load*can.cp+1e-9),can.src-can.q,can.room-can.q,wh));if(!q)break;
        can.q+=q;money-=q*can.unit;load-=q/can.cp;wh-=q;act=act.filter(x=>x.q<Math.min(x.room,x.src));}
    }
    let bought=0,lost=0;const first=its[0].c;
    its.filter(x=>x.q>0).forEach(x=>{
      const q=x.q,got=Math.round(q*keep),cost=Math.round(x.unit*q);refund-=cost;bought+=got;lost+=q-got;
      if(got>0){addStock(x.n,got,cost/got);stockAdd(x.n,got,false)}
      const supply=originSupplyBand(x.si);L.push(NEWS('kind.2',{short:x.c.short,q,unit:fmt1(x.unit),pf:pc(x.pf),cost:fmt(cost),supply}));E.items.push({n:x.c.short,q,unit:x.unit,cost,lost:q-got,supply});
    });
    if(bought+lost>0)L.push(wreck?NEWS('voy.resolveVoyage.5',{i:voyIcon(mode,robbed),a:wn,b:lost,c:bought}):NEWS('voy.resolveVoyage.6',{a:bought}));
    else L.push(NEWS('kind.3',{short:first.short}));
  }else if(kind==='cross'){
    const c=COMM_MAP[pick(othP)],si=originSupplyForShip(s,dest,c.name),pf=clamp(0.40-0.15*cs/100+(rnd()-0.5)*ODDS.originSupply.priceJitter,0.18,0.5)*(s.cheap?0.9:1)*originSupplyPrice(si),unit=c.base*pf;
    const room=Math.max(0,invCap()-invUsed());
    const q=Math.max(0,Math.min(Math.floor(spend/unit),originSupplyCap(c.name,mode,si,s.supplyRank||1),room)),got=Math.round(q*keep),cost=Math.round(unit*q);refund-=cost;
    if(q>0){G.xinv=G.xinv||{};G.xinv[c.name]=(G.xinv[c.name]||0)+got;
      const supply=originSupplyBand(si);L.push(NEWS('kind.4',{short:c.short,q,unit:fmt1(unit),pf:pc(pf),cost:fmt(cost),supply}));E.items.push({n:c.short,q,unit,cost,lost:q-got,supply});
      L.push(NEWS('voy.resolveVoyage.8',{a:((wreck?NEWS('voy.resolveVoyage.7',{i:voyIcon(mode,robbed),a:wn,b:q-got}):'')+got)}))}
    else L.push(NEWS('kind.5',{short:c.short}));
  }
  if(carry){                                            // 唐物藥種：夾帶唐船私貨
    const {it,q,cost}=carry,got=Math.round(q*keep);refund-=cost;
    contra()[it.k]=(contra()[it.k]||0)+got;addHeat(ODDS.voyageKind.carryHeat*it.danger);E.items.push({n:it.name,q,unit:q?cost/q:0,cost,lost:q-got});
    L.push(NEWS('kind.6',{mode:NM('crew',mode),name:it.name,q,cost:fmt(cost),got:(wreck?UT('voy.resolveVoyage.9',{a:wn,b:got}):'')}));
  }
  refund=Math.max(0,refund);G.silver+=refund+income;
  if(kind!=='outOnly')L.push(NEWS('kind.7',{fee:fmt(fee),refund:fmt(refund)}));
  E.back=refund+income;
  G.voyLog=G.voyLog||[];G.voyLog.unshift(E);if(G.voyLog.length>15)G.voyLog.pop();
  if(TURNRP){TURNRP.voy=TURNRP.voy||[];TURNRP.voy.push(E)}
  if(buyout){buyoutDiscover(s.buyoutY,s.buyoutRegion,s.buyoutM);const b=NEWS('buyout.arrive',{region:REG_NAME(s.buyoutRegion),month:buyoutMonth(s.buyoutM),crew:NM('crew',mode),name:s.captName});pushNews(b);log.push(b)}
  const t=NEWS('kind.8',{mode:NM('crew',mode),captName:s.captName,dest:E.dest,cross:(kind==='outOnly'?UT('r4.out.back'):kind==='own'?UT('voy.t'):kind==='cross'?UT('voy.t.2'):UT('voy.t.3')),sea:(wreck&&kind!=='empty'?UT('voy.t.6',{a:robbed&&mode==='sea'?UT('voy.tPirate'):mode==='sea'?UT('voy.t.4'):UT('voy.t.5')}):'')});
  pushNews(t);log.push(t);sfx.coin();addFame(0.3);
}
/* ---------- 商路畫面 ---------- */
function voyagePanel(){
  const R_=UI.s.route;if(R_.mode!=='sea'&&R_.mode!=='land')R_.mode='sea';
  const mode=R_.mode;
  if(mode==='land'&&!landPermit())return UT('voy.voyagePanel',{a:REG_NAME(homeCity().region_id)});
  if(mode==='sea'&&!anySea())return UT('voy.voyagePanel.2');
  if(banditBlocks(mode))return banditNotice(mode);
  voyQPrune();
  const caps=idleCaptains(mode);
  if(!caps.length)return '<div class="notice">'+(idleCaptains(mode,true).length?UT('voy.voyagePanel.3',{a:NM('crew',mode)}):UT('voy.voyagePanel.4',{a:NM('crew',mode),b:NM('crew',mode)}))+'</div>';
  const dl=destList(mode).slice(0,10),open=dl.filter(x=>!x.blocked);
  if(!dl.length)return '<div class="notice">'+(destList(mode,true).length?UT('voy.noPermitAll'):mode==='land'?UT('voy.voyagePanel.5'):UT('voy.voyagePanel.6'))+'</div>';
  if(!open.length)return UT('voy.buyoutAllBlocked',{region:REG_NAME(dl[0].ct.region_id),month:buyoutMonth(G.month)});
  if(!caps.some(e=>e.id===R_.capt))R_.capt=caps[0].id;
  if(!open.some(x=>x.ct.id===R_.dest))R_.dest=open[0].ct.id;
  const cash=Math.floor(G.silver-voyQTotal());
  if(cash<100)return UT('voy.voyagePanel.7');
  const maxB=Math.max(100,Math.min(5000,cash));
  R_.budget=clamp(Math.round((R_.budget||500)/50)*50,100,maxB);
  const cap=caps.find(e=>e.id===R_.capt);
  let h=UT('voy.h',{a:NM('crew',mode),b:caps.map(e=>'<span class="pill '+(e.id===R_.capt?'on':'')+'" data-act="vCapt" data-id="'+e.id+'">'+esc(e.name)+' '+ratingStars(e.cid||statsOfEmp(e))+'</span>').join('')})+'</div>';
  h+=UT('voy.voyagePanel.14',{a:dl.map(x=>'<div class="mkt-row '+(x.ct.id===R_.dest?'on':'')+'" data-act="'+(x.blocked?'none':'vDest')+'" data-id="'+x.ct.id+'"'+(x.blocked?' style="opacity:.55"':'')+'><div><b class="small">'+esc(x.ct.name)+'</b> <span class="tag green">'+esc(x.ct.region_name)+'</span>'+(x.blocked?UT('voy.buyoutTag'):'')+'<div class="tiny muted">'+UT('voy.voyagePanel.12',{a:x.d,b:Math.round(voyRisk(cap,x.d,mode)*100)})+'%</div></div><div style="text-align:right" class="tiny">'+UT('voy.voyagePanel.13',{a:x.blocked?UT('voy.buyoutUnavailable'):x.own.length?UT('voy.voyagePanel.10',{a:esc(x.own.slice(0,2).map(n=>COMM_MAP[n].short.slice(0,5)).join(UT('voy.voyagePanel.9'))),b:x.own.length>2?'…':''})+'</b>':UT('voy.voyagePanel.11'),b:x.oth.length})).join('')});
  h+=UT('voy.voyagePanel.15',{a:fmt(R_.budget)});
  h+=UT('voy.voyagePanel.16',{a:stepRow('<input id="slider-voy" type="range" min="100" max="'+maxB+'" step="50" value="'+R_.budget+'">','slider-voy',R_.budget<=100,R_.budget>=maxB),b:Math.round(voyFee((dl.find(x=>x.ct.id===R_.dest)||dl[0]).d)*100)})+'%</span><span>'+fmt(maxB)+'</span></div></div>';
  {const n=originTripUsed(R_.dest)+voyQ().filter(q=>q.dest===R_.dest).length;if(n)h+='<div class="notice tiny">'+UT('voy.repeatWarn',{n})+'</div>'}
  h+='<div class="notice tiny">'+UT('voy.voyagePanel.18',{a:NM('crew',mode),b:G.sysKey==='medicine'?UT('voy.voyagePanel.17'):''});
  h+=UT('voy.voyagePanel.19',{a:UT('btn.vAdd')})+'</button></div>';
  return h;
}
/** 採買日誌：時間（遭難時紅字）、人名與去處、貨物表（貨名、數量、總價；遭難時數量下方紅字損失）、花費與退回。
 *  舊紀錄沒有分項資料，照原文完整列出。 */
function voyLogEntry(v){
  const mode=v.mode||'sea';
  if(!v.items)return '<div class="card"><div class="tiny muted">'+UT('voy.voyLogCard',{a:esc(v.date),b:NM('crew',mode),c:esc(v.capt),d:fmt(v.budget),e:v.lines.map(l=>'<div class="tiny" style="margin-top:2px">'+esc(l)+'</div>').join('')})+'</div>';
  const spent=v.items.reduce((a,x)=>a+x.cost,0);
  let h='<div class="card"><div class="small"><b>'+esc(v.date)+'</b>'+(v.wreck&&v.items.length?' <b style="color:#b3261e">'+UT(v.robbed&&mode==='sea'?'voy.log.pirate':mode==='sea'?'voy.log.wreckSea':'voy.log.wreckLand')+'</b>':'')+'</div>'
    +'<div class="tiny muted">'+UT('voy.log.who',{c:NM('crew',mode),n:esc(v.capt),p:esc(v.dest)})+'</div>';
  if(v.items.length){
    const td='padding:2px 6px;border-bottom:1px dashed #d8ccb0';
    h+='<table class="tiny" style="width:100%;border-collapse:collapse;margin:4px 0"><tr style="text-align:left"><th style="'+td+'">'+UT('voy.log.thName')+'</th><th style="'+td+';text-align:right">'+UT('voy.log.thQty')+'</th><th style="'+td+';text-align:right">'+UT('voy.log.thUnit')+'</th><th style="'+td+';text-align:right">'+UT('voy.log.thCost')+'</th></tr>'
      +v.items.map(x=>'<tr><td style="'+td+'">'+esc(x.n)+(x.supply?'<br><span class="muted">'+esc(UT('voy.supplyLog',{s:x.supply}))+'</span>':'')+'</td><td style="'+td+';text-align:right">'+x.q+(x.lost>0?'<br><span style="color:#b3261e">'+UT('voy.log.lost',{n:x.lost})+'</span>':'')+'</td><td style="'+td+';text-align:right">'+fmt1(x.unit!==undefined?x.unit:(x.q?x.cost/x.q:0))+'</td><td style="'+td+';text-align:right">'+fmt(x.cost)+'</td></tr>').join('')+'</table>'
      +'<div class="tiny">'+UT('voy.log.sum',{a:fmt(spent),b:fmt(v.fee||0),c:fmt(v.back||0)})+'</div>';
  }else h+='<div class="tiny" style="margin-top:3px">'+UT('voy.log.empty',{b:fmt(v.fee||0),c:fmt(v.back||0)})+'</div>';
  return h+'</div>';
}
function voyLogCard(){
  const L=G.voyLog||[];if(!L.length)return '';
  return UT('voy.voyLogCard.2',{a:L.slice(0,5).map(voyLogEntry).join('')});
}
ACT.vCapt=el=>{UI.s.route.capt=el.dataset.id;renderRoutes()};
ACT.vDest=el=>{const ct=CITY(el.dataset.id);if(!ct||buyoutDepartureBlocked(ct))return;UI.s.route.dest=el.dataset.id;renderRoutes()};
CHG.rModeDummy=()=>{};
/** 本旬出運清單：每列人名、目的地、旬數、委託金與取消鈕；底部合計與「全部出發」（只扣 1 行動點數）。 */
function voyQueueCard(){
  voyQPrune();const Q=voyQ();if(!Q.length)return '';
  const a=homeCity();
  let h=UT('voy.h.2');
  h+=Q.map((q,i)=>{const e=G.emps.find(x=>x.id===q.capt),ct=CITY(q.dest),ok=ct&&permitOf(q.mode,ct);
    return '<div style="margin-top:4px;padding-top:4px'+(i?';border-top:1px dashed #b5a98f':'')+'"><div class="row small" style="gap:6px;align-items:flex-start"><span>'+UT('voy.voyQueueCard.2',{a:MODE_ICON[q.mode],b:esc(e?e.name:UT('voy.voyQueueCard')),c:esc(ct?ct.name:UT('voy.voyQueueCard')),d:ct?distTurns(a,ct,q.mode):'?',e:ok?'':UT('voy.voyagePanel.8')})+'</span><button class="pixel-btn btn-sm" style="flex:none" data-act="vDel" data-i="'+i+'">'+UT('btn.vDel')+'</button></div><div class="small">'+UT('voy.voyQueueCard.3',{a:fmt(q.budget)})}).join('');
  h+=UT('voy.voyQueueCard.4',{a:Q.length,b:fmt(voyQTotal())});
  const noAP=apLeft()<=0;
  h+='<button class="pixel-btn btn-gold" style="width:100%;margin-top:6px;padding:8px" data-act="vGoAll" '+(noAP?'disabled':'')+'>'+UT('btn.vGoAll')+'</button>';
  h+='<div class="tiny muted" style="margin-top:4px;text-align:center">'+(noAP?UT('txt.vGoAllNoAP'):UT('txt.vGoAll'))+'</div>';
  return h+'</div>';
}
/** 加入出運清單（不扣行動點數、不扣錢）：檢查人、目的地、許可、委託金與餘錢。 */
ACT.vAdd=()=>{
  const R_=UI.s.route,mode=R_.mode,cap=idleCaptains(mode).find(e=>e.id===R_.capt);
  if(!cap){toast(MSG('sendVoyage.2',{mode:NM('crew',mode)}));return}
  const dest=CITY(R_.dest);if(!dest||!destList(mode,true).some(x=>x.ct.id===R_.dest)){toast(MSG('sendVoyage.3'));return}
  if(!permitOf(mode,dest)){toast(MSG('sendVoyage.4',{REG_NAME:REG_NAME(dest.region_id),sea:(mode==='sea'?UT('voy.sendVoyage'):UT('voy.sendVoyage.2'))}),4200);return}
  if(buyoutDepartureBlocked(dest)){toast(MSG('sendVoyage.buyout',{REG_NAME:REG_NAME(dest.region_id),month:buyoutMonth(G.month)}),4200);return}
  const b=Math.floor(R_.budget||0);if(!(b>=100)){toast(MSG('sendVoyage.5'));return}
  if(b>G.silver-voyQTotal()){toast(MSG('voyQ.short',{c:fmt(b+voyQTotal())}),4200);return}
  voyQ().push({capt:cap.id,mode,dest:dest.id,budget:b});sfx.tap();
  toast(MSG('voyQ.add',{crew:NM('crew',mode),name:cap.name,dest:dest.name,budget:fmt(b)}));UI.render();
};
ACT.vDel=el=>{voyQ().splice(+el.dataset.i,1);sfx.tap();UI.render()};
/** 全部出發：一次檢查現款、傷勢與行動點數；逐一出發，失去許可的留在清單；有人出發就扣 1 行動點數。 */
ACT.vGoAll=()=>{
  voyQPrune();const Q=voyQ();if(!Q.length){toast(MSG('voyQ.empty'));return}
  if((G.injured||0)>0){toast(MSG('sendVoyage.hurt',{injured:G.injured}),4200);return}
  if(apLeft()<=0){toast(MSG('sendVoyage.ap'));return}
  if(voyQTotal()>G.silver){toast(MSG('voyQ.short',{c:fmt(voyQTotal())}),4200);return}
  const ok=[],fail=[];
  Q.slice().forEach(q=>{const r=sendVoyage(q.capt,q.budget,q.dest,q.mode,false,true);if(r.ok)ok.push(q);else fail.push(r.msg)});
  G.voyQueue=Q.filter(q=>!ok.includes(q));
  if(!ok.length){toast(fail[0]||MSG('voyQ.empty'),4200);UI.render();return}
  G.ap--;updateAP();save();
  const names=[...new Set(ok.map(q=>CITY(q.dest).name))].join(UT('voy.voyagePanel.9')),msg=MSG('voyQ.done',{n:ok.length,dest:names})+(fail.length?MSG('voyQ.fail',{n:fail.length}):'');
  playFx(ok.some(q=>q.mode==='sea')?'boat':'cart',MSG('voyage.depart'),names,()=>{toast(msg,5000);UI.render()},1000);
};
document.addEventListener('input',e=>{if(e.target.id==='slider-voy'){UI.s.route.budget=+e.target.value;const b=$('#v-b');if(b)b.textContent=UT('voy.top',{a:fmt(UI.s.route.budget)})}});
