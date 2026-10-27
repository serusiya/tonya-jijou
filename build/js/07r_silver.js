/* 現款走勢：記錄每旬開始時的現款，點頂部「現款」開啟近九旬折線圖。
 * - G.silverHist＝[{l:'3月上',v:現款}]，最多 9 筆；開局記一筆，之後每推進一旬記一筆（advanceTurn 結尾）。 */
const SILVER_WIN=9;
/** 記錄「此刻（新一旬開始）」的現款。 */
function recordSilver(){
  G.silverHist=G.silverHist||[];
  G.silverHist.push({l:G.month+'月'+CYCLE_NAMES[G.cycle-1].slice(0,1),v:Math.round(G.silver)});
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
  const short=v=>Math.abs(v)>=10000?(v/10000).toFixed(2)+'萬':fmt(v);
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
  let h='<div class="tiny muted" style="margin-bottom:5px">近九旬，每旬開始時的現款。</div>';
  if(pts.length<2)h+='<div class="notice tiny">紀錄還不夠，推進幾旬之後再來看。</div>';
  else{
    h+=silverChartSvg(pts);
    const a=pts[0].v,b=pts[pts.length-1].v,dd=b-a;
    h+='<div class="row small" style="margin-top:6px"><span>最高 <b>'+fmt(Math.max(...pts.map(p=>p.v)))+'</b> 兩</span><span>最低 <b>'+fmt(Math.min(...pts.map(p=>p.v)))+'</b> 兩</span></div>'
      +'<div class="small" style="margin-top:3px">這'+pts.length+'旬 '+(dd>0?'<b class="up">增加約 '+fmt(dd)+' 兩</b>':dd<0?'<b class="down">減少約 '+fmt(-dd)+' 兩</b>':'<b>持平</b>')+'</div>';
  }
  return {title:'📈 現款走勢',html:h};
};
