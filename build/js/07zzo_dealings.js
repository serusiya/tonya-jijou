'use strict';
/* ★檔案總覽：商行往來（私宅頁的資訊清單；DESIGN_NOTES 第二百四十二節）
 * - 把眼下還沒了結的帳、約與差事列在一處：錢銀往來、合約與訂貨、在途的人與貨、官府的事、人情往來。
 * - 只是資訊，沒有操作；要處理仍到原本的地方（相場、商路、現款走勢、奉行所）。
 * - dealGroups()：回傳 [[組名鍵,[{t,s}]]]（t＝內容、s＝還剩多久）；dealCard()：私宅頁的摘要卡；ACT.dealings：點開完整清單。
 * - 日後做遷居時，啟程前要了結的項目從這裡挑（第二百四十節第五段）。文字 deal2.*（01e）。 */
function dealGroups(){
  const D=(k,v)=>UT('deal2.'+k,v),left=n=>D(n>0?'left':'now',{n}),g=n=>COMM_MAP[n]?COMM_MAP[n].short:n,who=c=>c&&CH(c)?nameOf(c):D('someone');
  const money=[],pact=[],road=[],gov=[],folk=[];
  // 錢銀往來
  (G.debts||[]).filter(d=>!d.paid).forEach(d=>money.push({t:d.cid&&CH(d.cid)?D('debt',{n:nameOf(d.cid),k:d.kind?debtKindName(d.kind):D('loan'),a:fmt(d.amt)}):D('debtOld',{a:fmt(d.amt)}),s:left(d.due-G.turn)}));
  (G.kakeRecv||[]).forEach(r=>money.push({t:D(r.sure?'recvSure':r.late?'recvLate':'recv',{n:who(r.cid),a:fmt(Math.abs(r.amt))}),s:left(r.due-G.turn)}));
  if(G.kokusho)money.push({t:D('kokusho',{n:who(G.kokusho.cid)}),s:left(G.kokusho.left)});
  if(G.gmDue&&!G.gmDue.done&&!G.gmDue.exempt&&gmIsMe())money.push({t:D('gmDue',{a:fmt(G.gmDue.amt)}),s:D('gmDueS')});
  // 合約與訂貨
  (G.kake||[]).forEach(c=>pact.push({t:D('kake',{n:who(c.cid),g:g(c.name),q:c.qty}),s:left(c.left)}));
  (G.chumon||[]).forEach(o=>pact.push({t:D('chumon',{n:who(o.cid),c:CITY(o.city)?CITY(o.city).name:'',g:g(o.name),q:o.qty}),s:o.sent?D('onRoad'):D('goBy',{n:Math.max(0,o.until-G.turn+1)})}));
  if(G.honjin)pact.push({t:D('honjin',{g:g(G.honjin.name),q:G.honjin.qty}),s:left(G.honjin.left)});
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
  Object.keys(G.rel||{}).forEach(c=>(G.rel[c].promises||[]).filter(p=>!p.done).forEach(p=>gov.push({t:D('promise',{n:who(c)}),s:p.due>=G.turn?left(p.due-G.turn):D('overdue')})));
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
