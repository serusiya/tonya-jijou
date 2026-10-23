'use strict';
/* ★檔案總覽：委託採買（海運／陸運）
 * - 玩家指派：運輸方式（船長／飛腳）、目的地（產地城市）、委託金；船長不會跑錯地方。
 * - 到了目的地，買什麼由船長視本事決定（只能買該地出產的貨）：
 *   70% 買本業能賣的貨（入倉）；25% 買便宜、但非本業的「跨行貨」（也入倉，須請座客商人代售）；5% 私買違禁品（入密庫）。
 * - 數量與價格視船長商才；海難／山賊會損失七成貨。詳情寫進歸航那一旬的旬報「船隻歸航」。 */
const MODE_ICON={sea:'⛵',land:'🐎'};
const MODE_CAPT={sea:'船長',land:'飛腳'};
const idleCaptains=mode=>{
  const used=new Set(G.ships.map(s=>s.capt));(G.smug||[]).forEach(v=>used.add(v.capt));
  return G.emps.filter(e=>e.rank===MODE_CAPT[mode]&&!used.has(e.id));
};
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
    own:ct.connected_commodities.filter(n=>own.has(n)&&COMM_MAP[n]),oth:ct.connected_commodities.filter(n=>!all.has(n)&&COMM_MAP[n])}))
    .sort((x,y)=>(y.own.length>0)-(x.own.length>0)||x.d-y.d||y.own.length-x.own.length);
}
/** 出發：free＝開局贈送（不扣委託金）。 */
function sendVoyage(captId,budget,destId,mode,free){
  mode=mode||'sea';
  const cap=idleCaptains(mode).find(e=>e.id===captId);if(!cap)return {ok:false,msg:MSG('sendVoyage.2',{mode:MODE_CAPT[mode]})};
  const dest=CITY(destId),dl=destList(mode).find(x=>x.ct.id===destId);if(!dest||!dl)return {ok:false,msg:MSG('sendVoyage.3')};
  if(!free&&!permitOf(mode,dest))return {ok:false,msg:MSG('sendVoyage.4',{REG_NAME:REG_NAME(dest.region_id),sea:(mode==='sea'?'進港泊位許可':'關所通行手形')})};
  budget=Math.floor(budget);if(!(budget>=100))return {ok:false,msg:MSG('sendVoyage.5')};
  if(!free&&G.silver<budget)return {ok:false,msg:MSG('sendVoyage.6',{budget:fmt(budget)})};
  const st=statsOfEmp(cap);let d=dl.d;
  if(mode==='land'){if(G.flags.horse>0)d--;if(G.flags.road)d--;d=Math.max(1,d)}
  if(!free)payPublic('委託採買：'+dest.name,budget);
  G.ships.push({id:G.turn+'_'+Math.floor(rnd()*1e5),entrust:true,name:'',qty:0,origId:destId,mode,eta:d,eta0:d,risk:voyRisk(cap,d,mode)*(mode==='sea'&&G.flags.escort>0?ODDS.voyageRisk.escortMul:1),feeMul:(G.flags.taxfree>0?0.5:1)*(1-Math.min(0.3,0.1*(G.flags.charter||0))),cheap:G.flags.cheap>0,cost:budget,budget,start:G.turn,capt:cap.id,captName:cap.name,cs:st.commerce_skill,ca:st.audacity_courage});
  return {ok:true,msg:MSG('sendVoyage.ok',{crew:MODE_CAPT[mode],name:cap.name,budget:fmt(budget),dest:dest.name,d})};
}
/** 歸來結算。 */
function resolveVoyage(s,log){
  const mode=s.mode,cs=s.cs||50,budget=s.budget||0,wreck=chance(s.risk),keep=wreck?0.3:1;
  const dest=CITY(s.origId),own=tradeNameSet(),all=ownNameSet();
  const prod=(dest?dest.connected_commodities:[]).filter(n=>COMM_MAP[n]);
  const ownP=prod.filter(n=>own.has(n)),othP=prod.filter(n=>!all.has(n));
  const fee=Math.round(budget*voyFee(Math.max(1,s.eta0||4))*(s.feeMul||1));
  const spend=Math.floor((budget-fee)*clamp(0.78+0.18*cs/100+(rnd()-0.5)*0.06,0.7,0.98));
  let kind=(()=>{const r=rnd();return r<0.05?'contra':r<0.30?'cross':'own'})(),note='';
  if(kind==='own'&&!ownP.length){if(othP.length){kind='cross';note='【'+(dest?dest.name:'此地')+'】沒有出產你本業的貨，'+MODE_CAPT[mode]+'改買了別行的貨。'}}
  if(kind==='cross'&&!othP.length)kind='own';
  const E={turn:G.turn,date:dateStr(),capt:s.captName,budget,kind,wreck,dest:dest?dest.name:'',mode,lines:[]};
  let refund=budget-fee,income=0;
  const L=E.lines,pc=x=>Math.round(x*100)+'%',wn=wreck?(mode==='sea'?'遇上風暴':'遭山賊襲擊'):'';
  L.push(NEWS('kind.1',{dest:E.dest,note}));
  if(kind==='own'&&ownP.length){
    const c=COMM_MAP[pick(ownP)],pf=clamp(0.80-0.30*cs/100+(rnd()-0.5)*0.12,0.5,0.95)*(s.cheap?0.9:1),unit=c.base*pf;
    const room=Math.max(0,Math.min(invCap()-invUsed(),itemCap(c.name)-(G.inv[c.name]||0)));
    const q=Math.max(0,Math.min(Math.floor(spend/unit),capOf(c.name,mode),room)),got=Math.round(q*keep),cost=Math.round(unit*q);refund-=cost;
    if(q>0){if(got>0)addStock(c.name,got,cost/got);G.inv[c.name]=(G.inv[c.name]||0)+got;
      L.push(NEWS('kind.2',{short:c.short,q,unit:fmt1(unit),pf:pc(pf),cost:fmt(cost)}));
      L.push(wreck?'🌊 歸途'+wn+'，損失 '+(q-got)+' 單位，只有 '+got+' 單位入倉。':'✅ '+got+' 單位已入倉，可到大盤分旬出貨。')}
    else L.push(NEWS('kind.3',{short:c.short}));
  }else if(kind==='cross'){
    const c=COMM_MAP[pick(othP)],pf=clamp(0.40-0.15*cs/100+(rnd()-0.5)*0.12,0.18,0.5)*(s.cheap?0.9:1),unit=c.base*pf;
    const room=Math.max(0,invCap()-invUsed());
    const q=Math.max(0,Math.min(Math.floor(spend/unit),capOf(c.name,mode),room)),got=Math.round(q*keep),cost=Math.round(unit*q);refund-=cost;
    if(q>0){G.xinv=G.xinv||{};G.xinv[c.name]=(G.xinv[c.name]||0)+got;
      L.push(NEWS('kind.4',{short:c.short,q,unit:fmt1(unit),pf:pc(pf),cost:fmt(cost)}));
      L.push((wreck?'🌊 歸途'+wn+'，損失 '+(q-got)+' 單位，':'')+got+' 單位已入倉。這不是你的本業，得請座客商人代售。')}
    else L.push(NEWS('kind.5',{short:c.short}));
  }else{
    const it=pick(SMUG_ITEMS),unit=it.cost*(1-0.2*cs/100);
    const q=Math.max(0,Math.min(Math.floor(spend/unit),SMUG_CAP,CONTRA_CAP-contraQty())),got=Math.round(q*keep),cost=Math.round(unit*q);refund-=cost;
    if(q>0){contra()[it.k]=(contra()[it.k]||0)+got;G.heat=(G.heat||0)+0.5+it.danger*0.3;
      L.push(NEWS('kind.6',{mode:MODE_CAPT[mode],name:it.name,q,cost:fmt(cost),got:(wreck?'，'+wn+'只剩 '+got+' 單位':'')}))}
    else L.push(MODE_CAPT[mode]+'想私買「'+it.name+'」，但密庫已滿，作罷。');
  }
  refund=Math.max(0,refund);G.silver+=refund+income;
  L.push(NEWS('kind.7',{fee:fmt(fee),refund:fmt(refund)}));
  E.back=refund+income;
  G.voyLog=G.voyLog||[];G.voyLog.unshift(E);if(G.voyLog.length>15)G.voyLog.pop();
  if(TURNRP){TURNRP.voy=TURNRP.voy||[];TURNRP.voy.push(E)}
  const t=NEWS('kind.8',{mode:MODE_CAPT[mode],captName:s.captName,dest:E.dest,cross:(kind==='own'?'帶回本業貨':kind==='cross'?'帶回跨行貨':'帶回違禁品'),sea:(wreck?'（'+(mode==='sea'?'遇海難':'遇山賊')+'）':'')});
  pushNews(t);log.push(t);sfx.coin();addFame(0.3);
}
/* ---------- 商路畫面 ---------- */
function voyagePanel(){
  const R_=UI.s.route;if(R_.mode!=='sea'&&R_.mode!=='land')R_.mode='sea';
  const mode=R_.mode;
  if(mode==='land'&&!landPermit())return '<div class="notice">尚未取得【'+REG_NAME(homeCity().region_id)+'】的「關所通行手形」。請到「遠國奉行所」請託（關所番頭／道中奉行）。</div>';
  if(mode==='sea'&&!anySea())return '<div class="notice">尚未取得任何地區的「進港泊位許可」。請到「遠國奉行所」請託（津口番所役／船奉行）。</div>';
  const caps=idleCaptains(mode);
  if(!caps.length)return '<div class="notice">沒有空閒的'+MODE_CAPT[mode]+'。到私宅請介紹人物色，聘為「'+MODE_CAPT[mode]+'」。</div>';
  const dl=destList(mode).slice(0,10);
  if(!dl.length)return '<div class="notice">'+(mode==='land'?'陸路只通同一地區、2 旬內的城市；跨地區或島嶼須走海運。':'本城或對方不是港灣，海運無路可走。')+'</div>';
  if(!caps.some(e=>e.id===R_.capt))R_.capt=caps[0].id;
  if(!dl.some(x=>x.ct.id===R_.dest))R_.dest=dl[0].ct.id;
  const maxB=Math.max(100,Math.min(5000,Math.floor(G.silver)));
  R_.budget=clamp(Math.round((R_.budget||500)/50)*50,100,maxB);
  const cap=caps.find(e=>e.id===R_.capt);
  let h='<div class="small" style="margin:4px 0">選'+MODE_CAPT[mode]+'：'+caps.map(e=>'<span class="pill '+(e.id===R_.capt?'on':'')+'" data-act="vCapt" data-id="'+e.id+'">'+esc(e.name)+' '+ratingStars(e.cid||statsOfEmp(e))+'</span>').join('')+'</div>';
  h+='<div class="small bold" style="margin-top:4px">📍 目的地</div>'+dl.map(x=>'<div class="mkt-row '+(x.ct.id===R_.dest?'on':'')+'" data-act="vDest" data-id="'+x.ct.id+'"><div><b class="small">'+esc(x.ct.name)+'</b> <span class="tag green">'+esc(x.ct.region_name)+'</span>'+(permitOf(mode,x.ct)?'':' <span class="tag red">🔒 無許可</span>')+'<div class="tiny muted">'+x.d+' 旬·風險約 '+Math.round(voyRisk(cap,x.d,mode)*100)+'%</div></div><div style="text-align:right" class="tiny">'+(x.own.length?'<b style="color:#1e7e34">可買本業貨：'+esc(x.own.slice(0,2).map(n=>COMM_MAP[n].short.slice(0,5)).join('、'))+(x.own.length>2?'…':'')+'</b>':'<span class="muted">無本業貨</span>')+'<div class="muted">另有 '+x.oth.length+' 種他行貨</div></div></div>').join('');
  h+='<div class="card"><div class="row"><b class="small">💰 委託金</b><b id="v-b" style="color:#9b2c3a">'+fmt(R_.budget)+' 兩</b></div>';
  h+='<input id="slider-voy" type="range" min="100" max="'+maxB+'" step="50" value="'+R_.budget+'"><div class="row tiny muted"><span>100</span><span>雜費約 '+Math.round(voyFee((dl.find(x=>x.ct.id===R_.dest)||dl[0]).d)*100)+'%</span><span>'+fmt(maxB)+'</span></div></div>';
  h+='<div class="notice tiny">'+MODE_CAPT[mode]+'會到你指定的地方，但<b>買什麼由他決定</b>（只能買當地出產的貨）：多半是<b>你本業能賣的貨</b>，數量與價格看他的商才；偶爾撿到<b>便宜卻非本業</b>的貨，同樣入倉，但得<b>請介紹人</b>幫忙賣；極少數情況會<b>私買違禁品</b>。歸來那一旬的旬報會詳列帶回了什麼。</div>';
  h+='<div class="row" style="margin-top:6px"><span class="tiny muted">商才越高，買得越便宜、越多。</span><button class="pixel-btn btn-gold" data-act="vGo">'+UT('btn.vGo')+'</button></div>';
  return h;
}
function voyLogCard(){
  const L=G.voyLog||[];if(!L.length)return '';
  return '<hr class="sep"><div class="small bold">📒 採買日誌</div>'+L.slice(0,5).map(v=>'<div class="card"><div class="tiny muted">'+esc(v.date)+'·'+MODE_CAPT[v.mode||'sea']+'「'+esc(v.capt)+'」·委託金 '+fmt(v.budget)+' 兩</div>'+v.lines.slice(0,3).map(l=>'<div class="tiny" style="margin-top:2px">'+esc(l)+'</div>').join('')+'</div>').join('');
}
ACT.vCapt=el=>{UI.s.route.capt=el.dataset.id;renderRoutes()};
ACT.vDest=el=>{UI.s.route.dest=el.dataset.id;renderRoutes()};
CHG.rModeDummy=()=>{};
ACT.vGo=()=>{
  const R_=UI.s.route,r0=sendVoyage(R_.capt,R_.budget,R_.dest,R_.mode);
  if(!r0.ok){toast(r0.msg,4200);return}
  playFx(R_.mode==='sea'?'boat':'cart',MSG('voyage.depart'),CITY(R_.dest).name,()=>{toast(r0.msg,5000);UI.render()},1000);
};
document.addEventListener('input',e=>{if(e.target.id==='slider-voy'){UI.s.route.budget=+e.target.value;const b=$('#v-b');if(b)b.textContent=fmt(UI.s.route.budget)+' 兩'}});
