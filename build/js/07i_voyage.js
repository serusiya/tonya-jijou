'use strict';
/* ★檔案總覽：委託採買（海運／陸運）
 * - 玩家指派：運輸方式（船長／飛腳）、目的地（產地城市）、委託金；船長不會跑錯地方。
 * - 到了目的地，買什麼由船長視本事決定（只能買該地出產的貨）：
 *   80% 買本業能賣的貨（入倉；當地產好幾樣本業貨時，委託金與運量平均分給每一樣）；20% 買便宜、但非本業的「跨行貨」（也入倉，須請座客商人代售）。
 *   目的地沒有本業貨時：80% 空手而回（只扣雜費），20% 改買跨行貨。
 *   唐物藥種另有「夾帶」：主要採買之外，每趟 20% 機率順帶一項違禁品 3～5 單位（從委託金扣、入密庫，風聲 +0.2 × 危險度）。
 * - 數量與價格視船長商才；海難／山賊會損失七成貨。詳情寫進歸航那一旬的旬報「船隻歸航」。 */
const MODE_ICON={sea:'⛵',land:'🐎'};
const MODE_CAPT={sea:'船長',land:'飛腳'};
/** 本旬出運清單（存檔）：[{capt,mode,dest,budget}]；推進一旬時清空。 */
const voyQ=()=>G.voyQueue||(G.voyQueue=[]);
/** 清單裡已排的委託金合計。 */
const voyQTotal=()=>voyQ().reduce((a,q)=>a+q.budget,0);
/** 空閒的船長／飛腳：不在採買、走私途中；inclQ＝連已排進出運清單的也算（出發時用）。 */
const idleCaptains=(mode,inclQ)=>{
  const used=new Set(G.ships.map(s=>s.capt));(G.smug||[]).forEach(v=>used.add(v.capt));
  if(!inclQ)voyQ().forEach(q=>used.add(q.capt));
  return G.emps.filter(e=>e.rank===MODE_CAPT[mode]&&!used.has(e.id));
};
/** 清掉已失效的清單項目（人已離職，或已被派去走私）。 */
function voyQPrune(){if(!G.voyQueue)return;G.voyQueue=G.voyQueue.filter(q=>idleCaptains(q.mode,true).some(e=>e.id===q.capt))}
const ownNameSet=()=>new Set(ownComms().map(c=>c.name));
/** 本業中已可交易的貨（委託採買時船長只買這些）。 */
const tradeNameSet=()=>new Set(tradeComms().map(c=>c.name));
/** 風險：每旬約 3%（海）／2.2%（陸），乘船長膽識與商才的倍數；陸路有保鏢可再降。 */
const voyRisk=(cap,d,mode)=>{const V_=ODDS.voyageRisk;return clamp((mode==='sea'?V_.sea:V_.land)*d*crewRiskMult(cap)-(mode==='land'?V_.guardLand*guardCount():0),V_.min,V_.max)};
const voyFee=d=>clamp(0.04+0.01*d,0.06,0.14);
/** 可前往的目的地：海運＝雙方皆為港灣；陸運＝同地區且 2 旬內。 */
function destList(mode){
  const a=homeCity(),own=tradeNameSet(),all=ownNameSet();
  const ok=mode==='sea'?(ct=>canSea(a)&&canSea(ct)):(ct=>canLand(a,ct));
  return CITIES.filter(ct=>ct.id!==a.id&&ok(ct)).map(ct=>({ct,d:distTurns(a,ct,mode),
    own:cityProds(ct).filter(n=>own.has(n)&&COMM_MAP[n]),oth:cityProds(ct).filter(n=>!all.has(n)&&COMM_MAP[n])}))
    .sort((x,y)=>(y.own.length>0)-(x.own.length>0)||x.d-y.d||y.own.length-x.own.length);
}
/** 出發：扣委託金與 1 行動點數；free＝開局贈送（兩者都不扣）；batch＝出運清單一起出發（行動點數由 vGoAll 統一扣一次）。 */
function sendVoyage(captId,budget,destId,mode,free,batch){
  mode=mode||'sea';
  const cap=idleCaptains(mode,true).find(e=>e.id===captId);if(!cap)return {ok:false,msg:MSG('sendVoyage.2',{mode:MODE_CAPT[mode]})};
  const dest=CITY(destId),dl=destList(mode).find(x=>x.ct.id===destId);if(!dest||!dl)return {ok:false,msg:MSG('sendVoyage.3')};
  if(!free&&!permitOf(mode,dest))return {ok:false,msg:MSG('sendVoyage.4',{REG_NAME:REG_NAME(dest.region_id),sea:(mode==='sea'?'進港泊位許可':'關所通行手形')})};
  budget=Math.floor(budget);if(!(budget>=100))return {ok:false,msg:MSG('sendVoyage.5')};
  if(!free&&G.silver<budget)return {ok:false,msg:MSG('sendVoyage.6',{budget:fmt(budget)})};
  if(!free&&(G.injured||0)>0)return {ok:false,msg:MSG('sendVoyage.hurt',{injured:G.injured})};
  if(!free&&!batch&&apLeft()<=0)return {ok:false,msg:MSG('sendVoyage.ap')};   // 委託採買要親自到碼頭交代：扣 1 行動點數（開局贈送的那趟不扣；出運清單一起出發只扣一次）
  if(!free&&!batch){G.ap--;updateAP()}
  const st=statsOfEmp(cap);let d=dl.d;
  if(mode==='land'){if(G.flags.horse>0)d--;if(G.flags.road)d--;d=Math.max(1,d)}
  if(!free)payPublic('委託採買：'+dest.name,budget);
  G.ships.push({id:G.turn+'_'+Math.floor(rnd()*1e5),entrust:true,origId:destId,mode,eta:d,eta0:d,risk:voyRisk(cap,d,mode)*(mode==='sea'&&G.flags.escort>0?ODDS.voyageRisk.escortMul:1),feeMul:(G.flags.taxfree>0?0.5:1)*(1-Math.min(0.3,0.1*(G.flags.charter||0))),cheap:G.flags.cheap>0,cost:budget,budget,start:G.turn,capt:cap.id,captName:cap.name,cs:st.commerce_skill,ca:st.audacity_courage});
  return {ok:true,msg:MSG('sendVoyage.ok',{crew:MODE_CAPT[mode],name:cap.name,budget:fmt(budget),dest:dest.name,d})};
}
/** 歸來結算。 */
function resolveVoyage(s,log){
  const mode=s.mode,cs=s.cs||50,budget=s.budget||0,wreck=chance(s.risk),keep=wreck?0.3:1;
  const dest=CITY(s.origId),own=tradeNameSet(),all=ownNameSet();
  const prod=(dest?cityProds(dest):[]).filter(n=>COMM_MAP[n]);
  const ownP=prod.filter(n=>own.has(n)),othP=prod.filter(n=>!all.has(n));
  const fee=Math.round(budget*voyFee(Math.max(1,s.eta0||4))*(s.feeMul||1));
  let spend=Math.floor((budget-fee)*clamp(0.78+0.18*cs/100+(rnd()-0.5)*0.06,0.7,0.98));
  let carry=null;                                       // 唐物藥種夾帶：先從委託金留出這筆錢，再做主要採買
  if(G.sysKey==='medicine'&&chance(ODDS.voyageKind.carry)){
    const K=ODDS.voyageKind,it=pick(SMUG_ITEMS),unit=it.cost*(1-0.2*cs/100);
    const q=Math.max(0,Math.min(rint(K.carryMin,K.carryMax),CONTRA_CAP-contraQty(),Math.floor(spend/unit)));
    if(q>0){carry={it,q,cost:Math.round(unit*q)};spend-=carry.cost}
  }
  let kind,note='';
  if(ownP.length){kind=rnd()<ODDS.voyageKind.cross?'cross':'own';if(kind==='cross'&&!othP.length)kind='own'}
  else{                                                 // 目的地沒有本業貨：八成空手而回，兩成改買他行貨（當地也沒有他行貨就空手）
    kind=othP.length&&rnd()<ODDS.voyageKind.noOwnCross?'cross':'empty';
    note='【'+(dest?dest.name:'此地')+'】沒有出產你本業的貨，'+MODE_CAPT[mode]+(kind==='cross'?'改買了別行的貨。':'只好空手而回。');
  }
  const E={turn:G.turn,date:dateStr(),capt:s.captName,budget,kind,wreck,dest:dest?dest.name:'',mode,lines:[]};
  let refund=budget-fee,income=0;
  const L=E.lines,pc=x=>Math.round(x*100)+'%',wn=wreck?(mode==='sea'?'遇上風暴':'遭山賊襲擊'):'';
  L.push(NEWS('kind.1',{dest:E.dest,note}));
  if(kind==='own'&&ownP.length){
    /* 同一地產好幾樣本業貨時平均分配：委託金與單趟運量平分給每一樣；某樣碰到庫存上限或倉位而買不滿，
       剩下的錢與運量再平分給其他還能買的貨（最多分幾輪，直到錢、運量或倉位用完）。
       單趟運量以「裝載比例」計：每樣貨用掉 數量÷該貨單趟上限 的船艙（或馬背）。 */
    const its=shuffle(ownP).map(n=>{const c=COMM_MAP[n],pf=clamp(0.80-0.30*cs/100+(rnd()-0.5)*0.12,0.5,0.95)*(s.cheap?0.9:1);
      return {n,c,pf,unit:c.base*pf,cp:capOf(n,mode),room:Math.max(0,itemCap(n)-(G.inv[n]||0)),q:0}});
    let money=spend,load=1,wh=Math.max(0,invCap()-invUsed()),act=its.filter(x=>x.room>0);
    for(let round=0;round<6&&act.length&&wh>0&&load>1e-6;round++){
      const k=act.length,m=money/k,l=load/k;let added=0;
      act.forEach(x=>{const q=Math.max(0,Math.min(Math.floor(m/x.unit),Math.floor(l*x.cp+1e-9),x.room-x.q,wh));if(q<=0)return;
        x.q+=q;money-=q*x.unit;load-=q/x.cp;wh-=q;added+=q});
      act=act.filter(x=>x.q<x.room);if(!added)break;
    }
    let bought=0,lost=0;const first=its[0].c;
    its.filter(x=>x.q>0).forEach(x=>{
      const q=x.q,got=Math.round(q*keep),cost=Math.round(x.unit*q);refund-=cost;bought+=got;lost+=q-got;
      if(got>0)addStock(x.n,got,cost/got);G.inv[x.n]=(G.inv[x.n]||0)+got;
      L.push(NEWS('kind.2',{short:x.c.short,q,unit:fmt1(x.unit),pf:pc(x.pf),cost:fmt(cost)}));
    });
    if(bought+lost>0)L.push(wreck?'🌊 歸途'+wn+'，損失 '+lost+' 單位，只有 '+bought+' 單位入倉。':'✅ '+bought+' 單位已入倉，可到大盤分旬出貨。');
    else L.push(NEWS('kind.3',{short:first.short}));
  }else if(kind==='cross'){
    const c=COMM_MAP[pick(othP)],pf=clamp(0.40-0.15*cs/100+(rnd()-0.5)*0.12,0.18,0.5)*(s.cheap?0.9:1),unit=c.base*pf;
    const room=Math.max(0,invCap()-invUsed());
    const q=Math.max(0,Math.min(Math.floor(spend/unit),capOf(c.name,mode),room)),got=Math.round(q*keep),cost=Math.round(unit*q);refund-=cost;
    if(q>0){G.xinv=G.xinv||{};G.xinv[c.name]=(G.xinv[c.name]||0)+got;
      L.push(NEWS('kind.4',{short:c.short,q,unit:fmt1(unit),pf:pc(pf),cost:fmt(cost)}));
      L.push((wreck?'🌊 歸途'+wn+'，損失 '+(q-got)+' 單位，':'')+got+' 單位已入倉。這不是你的本業，得請座客商人代售。')}
    else L.push(NEWS('kind.5',{short:c.short}));
  }
  if(carry){                                            // 唐物藥種：夾帶唐船私貨
    const {it,q,cost}=carry,got=Math.round(q*keep);refund-=cost;
    contra()[it.k]=(contra()[it.k]||0)+got;addHeat(ODDS.voyageKind.carryHeat*it.danger);
    L.push(NEWS('kind.6',{mode:MODE_CAPT[mode],name:it.name,q,cost:fmt(cost),got:(wreck?'，'+wn+'只剩 '+got+' 單位':'')}));
  }
  refund=Math.max(0,refund);G.silver+=refund+income;
  L.push(NEWS('kind.7',{fee:fmt(fee),refund:fmt(refund)}));
  E.back=refund+income;
  G.voyLog=G.voyLog||[];G.voyLog.unshift(E);if(G.voyLog.length>15)G.voyLog.pop();
  if(TURNRP){TURNRP.voy=TURNRP.voy||[];TURNRP.voy.push(E)}
  const t=NEWS('kind.8',{mode:MODE_CAPT[mode],captName:s.captName,dest:E.dest,cross:(kind==='own'?'帶回本業貨':kind==='cross'?'帶回跨行貨':'空手而回'),sea:(wreck&&kind!=='empty'?'（'+(mode==='sea'?'遇海難':'遇山賊')+'）':'')});
  pushNews(t);log.push(t);sfx.coin();addFame(0.3);
}
/* ---------- 商路畫面 ---------- */
function voyagePanel(){
  const R_=UI.s.route;if(R_.mode!=='sea'&&R_.mode!=='land')R_.mode='sea';
  const mode=R_.mode;
  if(mode==='land'&&!landPermit())return '<div class="notice">尚未取得【'+REG_NAME(homeCity().region_id)+'】的「關所通行手形」。請到「遠國奉行所」請託（關所番頭／道中奉行）。</div>';
  if(mode==='sea'&&!anySea())return '<div class="notice">尚未取得任何地區的「進港泊位許可」。請到「遠國奉行所」請託（津口番所役／船奉行）。</div>';
  voyQPrune();
  const caps=idleCaptains(mode);
  if(!caps.length)return '<div class="notice">'+(idleCaptains(mode,true).length?'空閒的'+MODE_CAPT[mode]+'都已排進出運清單。':'沒有空閒的'+MODE_CAPT[mode]+'。到私宅請介紹人物色，聘為「'+MODE_CAPT[mode]+'」。')+'</div>';
  const dl=destList(mode).slice(0,10);
  if(!dl.length)return '<div class="notice">'+(mode==='land'?'陸路只通同一地區、2 旬內的城市；跨地區或島嶼須走海運。':'本城或對方不是港灣，海運無路可走。')+'</div>';
  if(!caps.some(e=>e.id===R_.capt))R_.capt=caps[0].id;
  if(!dl.some(x=>x.ct.id===R_.dest))R_.dest=dl[0].ct.id;
  const cash=Math.floor(G.silver-voyQTotal());
  if(cash<100)return '<div class="notice">現款都已排進出運清單，沒有餘錢再委託。</div>';
  const maxB=Math.max(100,Math.min(5000,cash));
  R_.budget=clamp(Math.round((R_.budget||500)/50)*50,100,maxB);
  const cap=caps.find(e=>e.id===R_.capt);
  let h='<div class="small" style="margin:4px 0">選'+MODE_CAPT[mode]+'：'+caps.map(e=>'<span class="pill '+(e.id===R_.capt?'on':'')+'" data-act="vCapt" data-id="'+e.id+'">'+esc(e.name)+' '+ratingStars(e.cid||statsOfEmp(e))+'</span>').join('')+'</div>';
  h+='<div class="small bold" style="margin-top:4px">📍 目的地</div>'+dl.map(x=>'<div class="mkt-row '+(x.ct.id===R_.dest?'on':'')+'" data-act="vDest" data-id="'+x.ct.id+'"><div><b class="small">'+esc(x.ct.name)+'</b> <span class="tag green">'+esc(x.ct.region_name)+'</span>'+(permitOf(mode,x.ct)?'':' <span class="tag red">🔒 無許可</span>')+'<div class="tiny muted">'+x.d+' 旬·風險約 '+Math.round(voyRisk(cap,x.d,mode)*100)+'%</div></div><div style="text-align:right" class="tiny">'+(x.own.length?'<b style="color:#1e7e34">可買本業貨：'+esc(x.own.slice(0,2).map(n=>COMM_MAP[n].short.slice(0,5)).join('、'))+(x.own.length>2?'…':'')+'</b>':'<span class="muted">無本業貨</span>')+'<div class="muted">另有 '+x.oth.length+' 種他行貨</div></div></div>').join('');
  h+='<div class="card"><div class="row"><b class="small">💰 委託金</b><b id="v-b" style="color:#9b2c3a">'+fmt(R_.budget)+' 兩</b></div>';
  h+=stepRow('<input id="slider-voy" type="range" min="100" max="'+maxB+'" step="50" value="'+R_.budget+'">','slider-voy',R_.budget<=100,R_.budget>=maxB)+'<div class="row tiny muted"><span>100</span><span>雜費約 '+Math.round(voyFee((dl.find(x=>x.ct.id===R_.dest)||dl[0]).d)*100)+'%</span><span>'+fmt(maxB)+'</span></div></div>';
  h+='<div class="notice tiny">'+MODE_CAPT[mode]+'會到你指定的地方，但<b>買什麼由他決定</b>（只能買當地出產的貨）：多半是<b>你本業能賣的貨</b>，數量與價格看他的商才，當地產好幾樣時，委託金與運量平均分給每一樣；偶爾撿到<b>便宜卻非本業</b>的貨，同樣入倉，但得<b>找座客商人代售</b>；目的地<b>沒有本業貨</b>時，多半<b>空手而回</b>，只扣雜費'+(G.sysKey==='medicine'?'；唐物藥種的船隊常<b>夾帶唐船私貨</b>':'')+'。歸來那一旬的旬報會詳列帶回了什麼。先把要派的人排進出運清單，再一次全部出發：只要親自到碼頭交代一趟，扣 1 行動點數；分批出發，每批各扣 1 點。</div>';
  h+='<div class="row" style="margin-top:6px"><span class="tiny muted">商才越高，買得越便宜、越多。</span><button class="pixel-btn btn-gold" data-act="vAdd">'+UT('btn.vAdd')+'</button></div>';
  return h;
}
function voyLogCard(){
  const L=G.voyLog||[];if(!L.length)return '';
  return '<hr class="sep"><div class="small bold">📒 採買日誌</div>'+L.slice(0,5).map(v=>'<div class="card"><div class="tiny muted">'+esc(v.date)+'·'+MODE_CAPT[v.mode||'sea']+'「'+esc(v.capt)+'」·委託金 '+fmt(v.budget)+' 兩</div>'+v.lines.slice(0,3).map(l=>'<div class="tiny" style="margin-top:2px">'+esc(l)+'</div>').join('')+'</div>').join('');
}
ACT.vCapt=el=>{UI.s.route.capt=el.dataset.id;renderRoutes()};
ACT.vDest=el=>{UI.s.route.dest=el.dataset.id;renderRoutes()};
CHG.rModeDummy=()=>{};
/** 本旬出運清單：每列人名、目的地、旬數、委託金與取消鈕；底部合計與「全部出發」（只扣 1 行動點數）。 */
function voyQueueCard(){
  voyQPrune();const Q=voyQ();if(!Q.length)return '';
  const a=homeCity();
  let h='<div class="card" style="background:#fff8eb"><b class="small">📋 本旬出運清單</b>';
  h+=Q.map((q,i)=>{const e=G.emps.find(x=>x.id===q.capt),ct=CITY(q.dest),ok=ct&&permitOf(q.mode,ct);
    return '<div style="margin-top:4px;padding-top:4px'+(i?';border-top:1px dashed #b5a98f':'')+'"><div class="row small" style="gap:6px;align-items:flex-start"><span>'+MODE_ICON[q.mode]+' '+esc(e?e.name:'？')+' → '+esc(ct?ct.name:'？')+'（'+(ct?distTurns(a,ct,q.mode):'?')+' 旬）'+(ok?'':' <span class="tag red">🔒 無許可</span>')+'</span><button class="pixel-btn btn-sm" style="flex:none" data-act="vDel" data-i="'+i+'">'+UT('btn.vDel')+'</button></div><div class="small">'+fmt(q.budget)+' 兩</div></div>'}).join('');
  h+='<div class="row tiny muted" style="margin-top:6px;border-top:1px solid #b5a98f;padding-top:4px"><span>共 '+Q.length+' 人</span><span>委託金合計 '+fmt(voyQTotal())+' 兩</span></div>';
  const noAP=apLeft()<=0;
  h+='<button class="pixel-btn btn-gold" style="width:100%;margin-top:6px;padding:8px" data-act="vGoAll" '+(noAP?'disabled':'')+'>'+UT('btn.vGoAll')+'</button>';
  h+='<div class="tiny muted" style="margin-top:4px;text-align:center">'+(noAP?UT('txt.vGoAllNoAP'):UT('txt.vGoAll'))+'</div>';
  return h+'</div>';
}
/** 加入出運清單（不扣行動點數、不扣錢）：檢查人、目的地、許可、委託金與餘錢。 */
ACT.vAdd=()=>{
  const R_=UI.s.route,mode=R_.mode,cap=idleCaptains(mode).find(e=>e.id===R_.capt);
  if(!cap){toast(MSG('sendVoyage.2',{mode:MODE_CAPT[mode]}));return}
  const dest=CITY(R_.dest);if(!dest||!destList(mode).some(x=>x.ct.id===R_.dest)){toast(MSG('sendVoyage.3'));return}
  if(!permitOf(mode,dest)){toast(MSG('sendVoyage.4',{REG_NAME:REG_NAME(dest.region_id),sea:(mode==='sea'?'進港泊位許可':'關所通行手形')}),4200);return}
  const b=Math.floor(R_.budget||0);if(!(b>=100)){toast(MSG('sendVoyage.5'));return}
  if(b>G.silver-voyQTotal()){toast(MSG('voyQ.short',{c:fmt(b+voyQTotal())}),4200);return}
  voyQ().push({capt:cap.id,mode,dest:dest.id,budget:b});sfx.tap();
  toast(MSG('voyQ.add',{crew:MODE_CAPT[mode],name:cap.name,dest:dest.name,budget:fmt(b)}));UI.render();
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
  const names=[...new Set(ok.map(q=>CITY(q.dest).name))].join('、'),msg=MSG('voyQ.done',{n:ok.length,dest:names})+(fail.length?MSG('voyQ.fail',{n:fail.length}):'');
  playFx(ok.some(q=>q.mode==='sea')?'boat':'cart',MSG('voyage.depart'),names,()=>{toast(msg,5000);UI.render()},1000);
};
document.addEventListener('input',e=>{if(e.target.id==='slider-voy'){UI.s.route.budget=+e.target.value;const b=$('#v-b');if(b)b.textContent=fmt(UI.s.route.budget)+' 兩'}});
