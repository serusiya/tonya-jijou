/* =====================================================================
 * 07c_report.js — 推進一旬後的「旬報」彈窗（收支圖表化）
 *  - doTurn 把每旬的 TURNRP 收集成 G.report，這裡負責彙整並畫出來。
 * ===================================================================== */

/** 把一或多旬的報告彙整成 {rev, ship[], costs{}, skim, fame, net, other}。 */
function mergeReports(reps){
  const T={guildDiv:0,windfall:0,buy:{},voy:[],rev:0,ship:{},cost:{wages:0,guards:0,wh:0,fam:0,interest:0,hold:0},publicSpend:{},skim:0,fame:0,net:0,short:[],squeeze:[]};
  reps.forEach(r=>{
    if(!r)return;
    (r.voy||[]).forEach(v=>T.voy.push(v));
    T.rev+=r.rev||0;T.guildDiv+=r.guildDiv||0;T.windfall+=r.windfall||0;
    Object.entries(r.buy||{}).forEach(([k,x])=>{const o=T.buy[k]||(T.buy[k]={q:0,cost:0});o.q+=x.q;o.cost+=x.cost});T.skim+=r.skim||0;T.fame+=r.fame||0;if(r.fameGate)T.fameGate=true;T.net+=r.net||0;
    (r.ship||[]).forEach(x=>{const o=T.ship[x.n]||(T.ship[x.n]={q:0,rev:0});o.q+=x.q;o.rev+=x.rev});
    Object.keys(T.cost).forEach(k=>T.cost[k]+=(r.cost&&r.cost[k])||0);
    Object.entries(r.publicSpend||{}).forEach(([k,v])=>{T.publicSpend[k]=(T.publicSpend[k]||0)+v});
    Object.entries(r.inTurn||{}).forEach(([k,v])=>{T.publicSpend[k]=(T.publicSpend[k]||0)+v});   // 推進途中付的主動支出（如忘年會），已含在本旬淨額裡
    (r.short||[]).forEach(s=>{if(!T.short.includes(s))T.short.push(s)});
    (r.squeeze||[]).forEach(s=>{if(!T.squeeze.includes(s))T.squeeze.push(s)});
  });
  return T;
}
/** 畫一列：圖示＋名稱＋比例條＋金額。 */
function repRow(icon,label,amt,max,cls){
  const w=max>0?Math.max(3,Math.round(amt/max*100)):0;
  return '<div class="rp-row"><span class="rp-ic">'+icon+'</span><span class="rp-lb">'+label+'</span><span class="rp-bar"><i class="'+cls+'" style="width:'+w+'%"></i></span><b class="rp-amt '+cls+'">'+(cls==='in'?'+':'−')+fmt(amt)+'</b></div>';
}
/** 貨物收支：一種貨一條（照大盤的本業貨順序，沒買賣的不列）。長條長度看收入與支出較大者（各貨同一比例尺）；較大者為底色（綠＝出貨收入、紅＝大盤進貨），較小者按比例疊在上面；右邊淨額，賺綠賠紅。 */
function goodsRows(T){
  const L=ownComms().map(c=>{const s=T.ship[c.short]||{q:0,rev:0},b=T.buy[c.short]||{q:0,cost:0};return {n:c.short,sq:s.q,rev:s.rev,bq:b.q,cost:b.cost}}).filter(x=>x.sq||x.bq);
  if(!L.length)return UT('rep.goodsRows');
  const mx=Math.max(1,...L.map(x=>Math.max(x.rev,x.cost)));
  return UT('rep.goodsRows.2',{a:L.map(x=>{
    const big=Math.max(x.rev,x.cost),inBase=x.rev>=x.cost,w=Math.max(3,Math.round(big/mx*100)),ws=big>0?Math.round(Math.min(x.rev,x.cost)/mx*100):0,net=x.rev-x.cost;
    const qty=(x.sq?UT('rep.qty',{a:x.sq}):'')+(x.sq&&x.bq?'·':'')+(x.bq?UT('rep.qty.2',{a:x.bq}):'');
    return '<div class="rp-row"><span class="rp-ic">📦</span><span class="rp-lb" style="white-space:normal;line-height:1.15">'+esc(x.n)+'<div class="tiny muted">'+qty+'</div></span><span class="rp-bar" style="position:relative"><i class="'+(inBase?'in':'out')+'" style="width:'+w+'%"></i>'+(ws>0?'<i class="'+(inBase?'out':'in')+'" style="position:absolute;left:0;top:0;width:'+ws+'%"></i>':'')+'</span><b class="rp-amt '+(net>=0?'in':'out')+'">'+(net>=0?'+':'−')+fmt(Math.abs(net))+'</b></div>';
  }).join('')});
}
/** 彈出旬報。reps＝本次推進的各旬報告；logs＝事件文字。 */
var LASTREP=null;
/** 畫出旬報。kind：undefined＝一般旬報、'open'＝開業旬報、'recent'＝近況（舊存檔沒有上一份旬報時）。上一份旬報存進 G.lastRep，重新載入後按瓦版仍可重開。 */
function showTurnReport(reps,logs,n,kind){
  LASTREP={reps,logs,n,kind};if(G&&!G.ended){G.lastRep=LASTREP;save()}
  const T=mergeReports(reps);
  const costs=[['👥',UT('rep.costs'),T.cost.wages],['🏚️',UT('rep.costs.2'),T.cost.wh],['🛡️',UT('rep.costs.3'),T.cost.hold],['🏠',UT('rep.costs.4'),T.cost.fam],['💸',UT('rep.costs.5'),T.cost.interest]].filter(x=>x[2]>0);
  const publicSpend=Object.entries(T.publicSpend).filter(x=>x[1]>0),publicSpendTotal=publicSpend.reduce((a,x)=>a+x[1],0);
  const exp=costs.reduce((a,x)=>a+x[2],0);
  const voyBack=T.voy.reduce((a,v)=>a+(v.back||0),0);         // 委託採買歸來退回的委託金餘額
  const buyTotal=Object.values(T.buy).reduce((a,x)=>a+x.cost,0);                 // 大盤進貨（推進時下單）
  const other=T.net-(T.rev-exp-publicSpendTotal-T.skim-buyTotal)-voyBack-T.guildDiv-T.windfall;      // 其餘雜項：員工私吞、罰款、事件等
  const inc=T.rev+voyBack+T.guildDiv+T.windfall+Math.max(0,other),outl=exp+publicSpendTotal+buyTotal+T.skim+Math.max(0,-other);
  const tot=Math.max(1,inc+outl),pi=Math.round(inc/tot*100);
  const max=Math.max(1,voyBack,T.guildDiv,T.windfall,...costs.map(x=>x[2]),...publicSpend.map(x=>x[1]),T.skim,Math.abs(other));
  let h='<div class="rp">';
  h+='<div class="rp-hero '+(T.net>=0?'up':'down')+'"><div class="rp-date">'+(n>1?UT('rep.showTurnReport',{a:n}):kind==='open'?UT('rep.showTurnReport.2'):kind==='recent'?UT('rep.showTurnReport.3'):'')+dateStr()+'</div><div class="rp-net">'+UT('rep.showTurnReport.4',{a:T.net>=0?'▲ ':'▼ ',b:sgn(T.net),c:fmt(G.silver)});
  h+=raidCard();
  h+='<div class="rp-split"><i class="in" style="width:'+pi+'%"></i><i class="out" style="width:'+UT('rep.showTurnReport.5',{a:100-pi,b:fmt(inc),c:fmt(outl)})+'</span></div>';
  h+=UT('rep.showTurnReport.6',{a:goodsRows(T)});
  if(voyBack>0)h+=repRow('⛵',UT('rep.showTurnReport.7'),voyBack,max,'in');
  if(T.guildDiv>0)h+=repRow('⚖️',UT('rep.showTurnReport.8'),T.guildDiv,max,'in');
  if(T.windfall>0)h+=repRow('💰',UT('rep.showTurnReport.9'),T.windfall,max,'in');
  if(other>0)h+=repRow('✨',UT('rep.showTurnReport.10'),other,max,'in');
  h+=UT('rep.showTurnReport.12',{a:costs.map(x=>repRow(x[0],x[1],x[2],max,'out')).join('')||UT('rep.showTurnReport.11')});
  if(publicSpend.length)h+=UT('rep.showTurnReport.13',{a:publicSpend.map(x=>repRow('💴',esc(spendLabel(x[0])),x[1],max,'out')).join('')});
  if(other<0)h+=repRow('📦',UT('rep.showTurnReport.14'),-other,max,'out');
  if(T.skim>0)h+=UT('rep.showTurnReport.16',{a:repRow('🟨',UT('rep.showTurnReport.15'),T.skim,max,'out')});
  if(T.fame!==0||T.fameGate||T.short.length||T.squeeze.length){
    const chipsOf=(L,cls)=>L.slice(0,6).map(x=>'<span class="tag '+cls+'">'+esc(x.slice(0,5))+'</span>').join('')+(L.length>6?UT('rep.chipsOf',{a:L.length}):'');
    h+='<div class="rp-fame '+(T.fame>=0?'up':'down')+'"><div class="rp-fame-n">'+(T.fame>0?UT('rep.showTurnReport.17',{a:T.fame}):T.fame<0?UT('rep.showTurnReport.18',{a:T.fame}):T.fameGate?UT('rep.showTurnReport.19'):UT('rep.showTurnReport.20'))+'</div>'+(T.short.length?UT('rep.showTurnReport.21',{a:chipsOf(T.short,'red')})+'</div>':'')+(T.squeeze.length?UT('rep.showTurnReport.22',{a:chipsOf(T.squeeze,'gold')}):'')+'</div>';
  }
  if(T.voy.length)h+=UT('rep.showTurnReport.25',{a:T.voy.map(v=>UT('rep.showTurnReport.24',{a:esc(v.capt),b:fmt(v.budget),c:v.wreck?UT('rep.showTurnReport.23'):''})+'</b>'+v.lines.map(l=>'<div class="tiny" style="margin-top:3px">'+esc(l)+'</div>').join('')+'</div>').join('')});
  const allEv=(logs||[]).filter(t=>!/^📥|^📤|^🟨|^🚢|^🧾/.test(t)&&!NEWS_HIDE_SET.has(newsKey(t)));   // 查貨、借錢有旬報卡片，官吏硬塞有來訪視窗，不再重列
  const isMove=t=>NEWS_MOVE_SET.has(newsKey(t)),moveEv=allEv.filter(isMove);
  const ev=moveEv.concat(allEv.filter(t=>!isMove(t)).slice(0,Math.max(0,15-moveEv.length))).slice(0,15);
  if(ev.length)h+=UT('rep.showTurnReport.26',{a:ev.map(t=>'<div class="rp-ev">'+esc(t)+'</div>').join('')});
  h+='</div>';
  UI.showInfo(kind==='open'?UT('rep.showTurnReport.27'):kind==='recent'?UT('rep.showTurnReport.28'):UT('rep.showTurnReport.29'),h);
}
