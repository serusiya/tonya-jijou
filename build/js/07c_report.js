/* =====================================================================
 * 07c_report.js — 推進一旬後的「旬報」彈窗（收支圖表化）
 *  - doTurn 把每旬的 TURNRP 收集成 G.report，這裡負責彙整並畫出來。
 * ===================================================================== */

/** 把一或多旬的報告彙整成 {rev, ship[], costs{}, skim, fame, net, other}。 */
function mergeReports(reps){
  const T={voy:[],rev:0,ship:{},cost:{wages:0,guards:0,wh:0,fam:0,levy:0,interest:0},skim:0,fame:0,net:0,short:[]};
  reps.forEach(r=>{
    if(!r)return;
    (r.voy||[]).forEach(v=>T.voy.push(v));
    T.rev+=r.rev||0;T.skim+=r.skim||0;T.fame+=r.fame||0;T.net+=r.net||0;
    (r.ship||[]).forEach(x=>{const o=T.ship[x.n]||(T.ship[x.n]={q:0,rev:0});o.q+=x.q;o.rev+=x.rev});
    Object.keys(T.cost).forEach(k=>T.cost[k]+=(r.cost&&r.cost[k])||0);
    (r.short||[]).forEach(s=>{if(!T.short.includes(s))T.short.push(s)});
  });
  return T;
}
/** 畫一列：圖示＋名稱＋比例條＋金額。 */
function repRow(icon,label,amt,max,cls){
  const w=max>0?Math.max(3,Math.round(amt/max*100)):0;
  return '<div class="rp-row"><span class="rp-ic">'+icon+'</span><span class="rp-lb">'+label+'</span><span class="rp-bar"><i class="'+cls+'" style="width:'+w+'%"></i></span><b class="rp-amt '+cls+'">'+(cls==='in'?'+':'−')+fmt(amt)+'</b></div>';
}
/** 彈出旬報。reps＝本次推進的各旬報告；logs＝事件文字。 */
var LASTREP=null;
function showTurnReport(reps,logs,n){
  LASTREP={reps,logs,n};
  const T=mergeReports(reps);
  const costs=[['👥','夥計月例',T.cost.wages],['🏚️','倉庫維護',T.cost.wh],['🏠','家計開銷',T.cost.fam],['🏮','冥加金',T.cost.levy],['💸','透支利息',T.cost.interest]].filter(x=>x[2]>0);
  const exp=costs.reduce((a,x)=>a+x[2],0);
  const other=T.net-(T.rev-exp-T.skim);                       // 其餘：貨款、運費、事件、請託…
  const inc=T.rev+Math.max(0,other),outl=exp+T.skim+Math.max(0,-other);
  const tot=Math.max(1,inc+outl),pi=Math.round(inc/tot*100);
  const max=Math.max(1,T.rev,...costs.map(x=>x[2]),T.skim,Math.abs(other));
  let h='<div class="rp">';
  h+='<div class="rp-hero '+(T.net>=0?'up':'down')+'"><div class="rp-date">'+(n>1?'連續 '+n+' 旬·':'')+dateStr()+'</div><div class="rp-net">'+(T.net>=0?'▲ ':'▼ ')+sgn(T.net)+' <small>兩</small></div><div class="rp-sub">公款餘額 '+fmt(G.silver)+' 兩</div></div>';
  h+=raidCard();
  h+=inspectCard();
  h+=xofferCard();
  h+='<div class="rp-split"><i class="in" style="width:'+pi+'%"></i><i class="out" style="width:'+(100-pi)+'%"></i></div><div class="rp-legend"><span class="in">收入 '+fmt(inc)+'</span><span class="out">支出 '+fmt(outl)+'</span></div>';
  if(T.rev>0||Object.keys(T.ship).length){
    h+='<div class="rp-sec">📤 出貨收入</div>'+Object.keys(T.ship).map(k=>repRow('📦',esc(k)+' ×'+T.ship[k].q,T.ship[k].rev,max,'in')).join('');
  }else h+='<div class="rp-sec">📤 出貨收入</div><div class="rp-empty">本旬沒有出貨</div>';
  if(other>0)h+=repRow('✨','其他進帳',other,max,'in');
  h+='<div class="rp-sec">🧾 固定支出</div>'+(costs.map(x=>repRow(x[0],x[1],x[2],max,'out')).join('')||'<div class="rp-empty">無</div>');
  if(other<0)h+=repRow('📦','進貨·運費·其他',-other,max,'out');
  if(T.skim>0)h+='<div class="rp-sec">🟨 私款</div>'+repRow('🟨','盈餘抽成入私款',T.skim,max,'out');
  if(T.fame!==0||T.short.length){
    const chips=T.short.slice(0,6).map(x=>'<span class="tag red">'+esc(x.slice(0,5))+'</span>').join('')+(T.short.length>6?'<span class="tag gray">…共 '+T.short.length+' 項</span>':'');
    h+='<div class="rp-fame '+(T.fame>=0?'up':'down')+'"><div class="rp-fame-n">'+(T.fame>0?'🌟 穩定供貨　知名度 +'+T.fame:T.fame<0?'📉 供貨不穩　知名度 '+T.fame:'知名度持平')+'</div>'+(T.short.length?'<div class="tiny" style="margin-top:4px">未達供貨線：'+chips+'</div>':'')+'</div>';
  }
  if(T.voy.length)h+='<div class="rp-sec">⛵ 船隻歸航</div>'+T.voy.map(v=>'<div class="card" style="margin:3px 0"><b class="small">船長「'+esc(v.capt)+'」·委託金 '+fmt(v.budget)+' 兩'+(v.wreck?' <span class="tag red">遇海難</span>':'')+'</b>'+v.lines.map(l=>'<div class="tiny" style="margin-top:3px">'+esc(l)+'</div>').join('')+'</div>').join('');
  const ev=(logs||[]).filter(t=>!/^📤|^🟨|^🚢/.test(t)).slice(0,10);
  if(ev.length)h+='<div class="rp-sec">📰 本旬大事</div>'+ev.map(t=>'<div class="rp-ev">'+esc(t)+'</div>').join('');
  h+='</div>';
  UI.showInfo('📅 旬報',h);
}
