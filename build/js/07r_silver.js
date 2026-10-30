/* 現款走勢：記錄每旬開始時的現款，點頂部「現款」開啟近九旬折線圖。
 * - G.silverHist＝[{l:'3月上',v:現款}]，最多 9 筆；開局記一筆，之後每推進一旬記一筆（advanceTurn 結尾）。 */
const SILVER_WIN=9;
/** 記錄「此刻（新一旬開始）」的現款。 */
function recordSilver(){
  G.silverHist=G.silverHist||[];
  G.silverHist.push({l:UT('silver.recordSilver',{a:G.month,b:CYCLE_NAMES[G.cycle-1].slice(0,1)}),v:Math.round(G.silver)});
  while(G.silverHist.length>SILVER_WIN)G.silverHist.shift();
}
ACT.silverChart=()=>UI.openSheet('silver');
/** 折線圖（SVG）：近九旬每旬開始時的現款。 */
function silverChartSvg(pts){
  const W=340,H=190,L=46,R=14,T=22,B=34,n=pts.length;
  const vs=pts.map(p=>p.v);let lo=Math.min(...vs),hi=Math.max(...vs);
  if(hi-lo<1){hi+=1;lo-=1}
  const pad=(hi-lo)*0.12;lo-=pad;hi+=pad;
  const X=i=>L+(n<2?0:(W-L-R)*i/(n-1)),Y=v=>T+(H-T-B)*(1-(v-lo)/(hi-lo));
  const short=v=>Math.abs(v)>=10000?UT('silver.short',{a:(v/10000).toFixed(2)}):fmt(v);
  let s='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block;background:#fffaf0;border:2px solid #b5a98f" font-family="inherit">';
  for(let k=0;k<=3;k++){const v=lo+(hi-lo)*k/3,y=Y(v);s+='<line x1="'+L+'" y1="'+y.toFixed(1)+'" x2="'+(W-R)+'" y2="'+y.toFixed(1)+'" stroke="#e2d7bd" stroke-width="1"/><text x="'+(L-5)+'" y="'+(y+3).toFixed(1)+'" text-anchor="end" font-size="11" fill="#6b6256">'+short(Math.round(v))+'</text>'}
  const d=pts.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(p.v).toFixed(1)).join('');
  const up=pts[n-1].v>=pts[0].v,col=up?'#1e7e34':'#b3392b';
  s+='<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linejoin="round"/>';
  pts.forEach((p,i)=>{
    const x=X(i),y=Y(p.v);
    s+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="3" fill="'+col+'" stroke="#fffaf0" stroke-width="1"/>';
    if(n<=9)s+='<text x="'+x.toFixed(1)+'" y="'+(y-7).toFixed(1)+'" text-anchor="middle" font-size="10.5" fill="#3b2e1c">'+short(p.v)+'</text>';
    s+='<text x="'+x.toFixed(1)+'" y="'+(H-14)+'" text-anchor="middle" font-size="11" fill="#6b6256">'+esc(p.l)+'</text>';
  });
  return s+'</svg>';
}
SHEETS.silver=()=>{
  const pts=(G.silverHist||[]).slice(-SILVER_WIN);
  let h=UT('silver.h');
  if(pts.length<2)h+=UT('silver.silver');
  else{
    h+=silverChartSvg(pts);
    const a=pts[0].v,b=pts[pts.length-1].v,dd=b-a;
    h+=UT('silver.silver.5',{a:fmt(Math.max(...pts.map(p=>p.v))),b:fmt(Math.min(...pts.map(p=>p.v))),c:pts.length,d:dd>0?UT('silver.silver.2',{a:fmt(dd)}):dd<0?UT('silver.silver.3',{a:fmt(-dd)}):UT('silver.silver.4')})+'</div>';
  }
  h+=debtCard();
  return {title:UT('silver.silver.6'),html:h};
};
/** 借款一覽（現款走勢下方）：每筆列債主、種類、應還金額與剩餘旬數，最快到期的在前；兩旬內到期標紅。舊存檔沒有債主的寫「舊帳」。 */
function debtCard(){
  const D=(G.debts||[]).filter(d=>!d.paid).slice().sort((a,b)=>a.due-b.due);
  let h=UT('silver.h.2');
  if(!D.length)return UT('silver.debtCard',{a:h});
  D.forEach(d=>{
    const left=Math.max(0,d.due-G.turn),who=d.cid&&CH(d.cid)?nameOf(d.cid)+(alive(d.cid)?'':UT('silver.who')):UT('silver.who.2');
    h+='<div class="row tiny" style="margin-top:2px'+(left<=2?';color:#b3392b':'')+'"><span>'+esc(who)+(d.kind?UT('silver.debtCard.2',{a:esc(d.kind)}):'')+'</span><b style="white-space:nowrap;margin-left:6px">'+UT('silver.debtCard.5',{a:fmt(d.amt),b:left?UT('silver.debtCard.3',{a:left}):UT('silver.debtCard.4')})+'</b></div>';
  });
  if(D.length>1)h+=UT('silver.debtCard.6',{a:fmt(D.reduce((a,d)=>a+d.amt,0))});
  return h+'</div>';
}
/** 點頂部「商號知名度」：目前名望與一句說明；到了門檻（ODDS.fame.gate）加一句「尋常小事不再為人稱道」。 */
ACT.fameInfo=()=>{
  if(!G)return;
  const f=Math.round(G.fame||0),gated=fameGated();
  UI.showInfo(UT('silver.fameInfo'),UT('silver.fameInfo.3',{a:f,b:TIER_NAME[fameTier()]})+'</b></div>'+UT('silver.fameInfo.4',{a:gated?UT('silver.fameInfo.2'):''}));
};
