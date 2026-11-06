'use strict';
/* =====================================================================
 * 07zzg_record.js — 商號紀錄（筆記「📒 紀錄」分頁；DESIGN_NOTES 第二百十二節）
 *  全時期保存，存成精簡的數字陣列：
 *  - G.rec.r 旬報：[日期碼, 收支, 現款, 收入, 支出, (合計旬數)]；每次跳出一般旬報記一筆，重開同一旬不重記。
 *  - G.rec.b 番付：[日期碼, 身代前十, 名望前十, 本號身代名次, 本號名望名次]；人物存成數字（本號 0、旅商取負號）。
 *  - G.rec.t 走勢：[日期碼, 本號身代, 本號知名度]；每期番付記一點。
 *  日期碼＝年×1000＋月×10＋旬。沒有下一代，紀錄只跟著這一局。
 * ===================================================================== */
const recCode=()=>G.year*1000+G.month*10+G.cycle;
const recDec=c=>({y:Math.floor(c/1000),m:Math.floor(c%1000/10),c:c%10});
const recId=k=>{if(k==='me')return 0;const n=npc(k),v=parseInt(String(k).replace(/\D/g,''),10)||0;return n&&n.role==='guest'?-v:v};
const recCid=v=>v===0?'me':'npc_'+String(Math.abs(v)).padStart(4,'0');
function recOf(){
  if(!G.rec){
    G.rec={r:[],b:[],t:[]};
    if(G.bz&&G.bz.length&&G.bz[0].w)G.bz.slice().reverse().forEach(I=>recBzAdd(I));   // 舊存檔：從現存的番付補起
  }
  return G.rec;
}
/** 記一份旬報（07c_report.js 呼叫）。 */
function recRep(net,inc,out,n){
  const R=recOf(),c=recCode(),L=R.r[R.r.length-1];if(L&&L[0]===c)return;
  const row=[c,Math.round(net||0),Math.round(G.silver||0),Math.round(inc||0),Math.round(out||0)];if(n>1)row.push(n);
  R.r.push(row);
}
function recBzAdd(I){
  const R=recOf(),c=I.y*1000+I.m*10+3;if(R.b.some(x=>x[0]===c))return;
  R.b.push([c,I.w.map(r=>recId(r.k)),I.f.map(r=>recId(r.k)),I.meW.i,I.meF.i]);
}
{const _p=bzPublish;bzPublish=function(log){
  const out=_p.apply(this,arguments),I=bzLast();
  if(I){recBzAdd(I);const R=recOf(),c=recCode();if(!R.t.some(x=>x[0]===c))R.t.push([c,Math.round(bzWorth('me')),Math.round(G.fame||0)])}
  return out;
}}

/* ---------- 畫面 ---------- */
const REC_TABS=['rep','bz','trend'];
ACT.recTab=el=>{UI.s.recTab=el.dataset.k;UI.render()};
ACT.recYear=el=>{const y=+el.dataset.y;UI.s.recYear=UI.s.recYear===y?null:y;UI.render()};
ACT.recBz=el=>{const c=+el.dataset.c;UI.s.recBzOpen=UI.s.recBzOpen===c?null:c;UI.render()};
const recMd=d=>UT('rec.md',{m:d.m,c:CYCLE_NAMES[d.c-1]});
/** 依年份分組（新的在上）。 */
function recByYear(list){const Y={};list.forEach(x=>{const y=recDec(x[0]).y;(Y[y]=Y[y]||[]).push(x)});return Object.keys(Y).map(Number).sort((a,b)=>b-a).map(y=>({y,L:Y[y]}))}
function recYearHead(y,open,extra){
  return '<div class="irow" data-act="recYear" data-y="'+y+'" style="display:flex;justify-content:space-between;gap:6px"><b>'+(open?'▾ ':'▸ ')+esc(yearStr(y))+'</b><span class="small">'+(extra||'')+'</span></div>';
}
const recNet=v=>'<b class="'+(v>=0?'up':'down')+'" style="color:'+(v>=0?'#b3261e':'#1e7e34')+'">'+(v>=0?'+':'−')+fmt(Math.abs(v))+'</b>';
function recRepHtml(){
  const R=recOf();if(!R.r.length)return '<div class="small muted">'+UT('rec.none.rep')+'</div>';
  const G0=recByYear(R.r),open=UI.s.recYear===undefined?G0[0].y:UI.s.recYear;
  return G0.map(({y,L})=>{
    const tot=L.reduce((s,x)=>s+x[1],0);
    let h=recYearHead(y,open===y,UT('rec.yearNet',{a:recNet(tot)}));
    if(open===y)h+=L.slice().reverse().map(x=>{
      const d=recDec(x[0]),t=Math.max(1,x[3]+x[4]),pi=Math.round(x[3]/t*100);
      return '<div style="display:flex;align-items:center;gap:6px;white-space:nowrap;padding:3px 4px;border-bottom:1px dashed #d8ccb2;font-size:13px">'
        +'<span style="flex:none;width:5.6em">'+esc(recMd(d))+(x[5]?'<span class="tiny muted">'+UT('rec.multi',{n:x[5]})+'</span>':'')+'</span>'
        +'<span style="flex:none;width:5.2em;text-align:right">'+recNet(x[1])+'</span>'
        +'<span class="tiny muted" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+UT('rec.silver',{a:fmt(x[2])})+'</span>'
        +'<span class="rp-split" style="flex:none;width:56px;height:9px;border-width:1px"><i class="in" style="width:'+pi+'%"></i><i class="out" style="width:'+(100-pi)+'%"></i></span></div>';
    }).join('');
    return h;
  }).join('');
}
const recRank=i=>i===null||i===undefined||i>=BZ().top?UT('rec.out'):i<3?UT('bz.tier.'+i):UT('rec.rank',{t:UT('bz.tier.3'),n:i+1});
function recBzCol(ids,prevIds,c){
  let h='<div style="min-width:0"><div class="tiny bold" style="text-align:center;border-bottom:1px solid #2a2420">'+UT('bz.col.'+c)+'</div>';
  ids.forEach((v,i)=>{
    const k=recCid(v),me=v===0,p=prevIds?prevIds.indexOf(v):-2;
    const ar=p===-2?'':p<0?UT('bz.new'):p>i?UT('bz.up',{n:p-i}):p<i?UT('bz.down',{n:i-p}):UT('bz.same');
    h+='<div style="display:flex;gap:3px;white-space:nowrap;overflow:hidden;font-size:'+(['15px','14px','14px'][i]||'12px')+(me?';color:#c0281e':'')+(i<3?';font-weight:bold':'')+'">'
      +'<span class="tiny muted" style="flex:none;font-weight:normal">'+UT('bz.tier.'+bzTier(i))+'</span>'
      +'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+esc(bzWho(k))+(v<0?'<span class="tiny muted" style="font-weight:normal">'+UT('bz.guest')+'</span>':'')+'</span>'
      +'<span class="tiny muted" style="flex:none;font-weight:normal">'+ar+'</span></div>';
  });
  return h+'</div>';
}
function recBzHtml(){
  const R=recOf();if(!R.b.length)return '<div class="small muted">'+UT('rec.none.bz')+'</div>';
  const G0=recByYear(R.b),open=UI.s.recYear===undefined?G0[0].y:UI.s.recYear;
  return G0.map(({y,L})=>{
    let h=recYearHead(y,open===y,'');
    if(open===y)h+=L.slice().reverse().map(x=>{
      const d=recDec(x[0]),on=UI.s.recBzOpen===x[0],j=R.b.indexOf(x),P=j>0?R.b[j-1]:null;
      let s='<div data-act="recBz" data-c="'+x[0]+'" style="display:flex;gap:6px;white-space:nowrap;padding:4px;border-bottom:1px dashed #d8ccb2;cursor:pointer;font-size:13px">'
        +'<span style="flex:none;width:5.6em">'+(on?'▾ ':'▸ ')+esc(UT('rec.mon',{m:d.m}))+'</span>'
        +'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+UT('rec.bzLine',{w:recRank(x[3]),f:recRank(x[4])})+'</span></div>';
      if(on)s+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:4px 2px 6px;background:#fffaf0">'+recBzCol(x[1],P&&P[1],'w')+recBzCol(x[2],P&&P[2],'f')+'</div>';
      return s;
    }).join('');
    return h;
  }).join('');
}
/** 走勢折線圖：每期番付一點；x 軸只標年份，圖上標起點、最高與現在。 */
function recChart(pts,title,fm,col){
  const W=340,H=150,L=8,Rr=8,T=24,B=22,n=pts.length,vs=pts.map(p=>p.v);
  let lo=Math.min(...vs),hi=Math.max(...vs);if(hi-lo<1){hi+=1;lo-=1}
  const pad=(hi-lo)*0.15;lo-=pad;hi+=pad;
  const X=i=>L+(n<2?0:(W-L-Rr)*i/(n-1)),Y=v=>T+(H-T-B)*(1-(v-lo)/(hi-lo));
  let s='<div class="small bold" style="margin-top:8px">'+title+'</div><svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block;background:#fffaf0;border:2px solid #b5a98f" font-family="inherit">';
  let lastY=null;pts.forEach((p,i)=>{if(p.y!==lastY){lastY=p.y;const x=X(i);s+='<line x1="'+x.toFixed(1)+'" y1="'+T+'" x2="'+x.toFixed(1)+'" y2="'+(H-B)+'" stroke="#eee3c9"/><text x="'+(x+2).toFixed(1)+'" y="'+(H-7)+'" font-size="10" fill="#6b6256">'+esc(yearStr(p.y))+'</text>'}});
  s+='<path d="'+pts.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(p.v).toFixed(1)).join('')+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linejoin="round"/>';
  const im=vs.indexOf(Math.max(...vs)),mark=(i,lb)=>{const x=X(i),y=Y(pts[i].v),a=i===0?'start':i===n-1?'end':'middle';return '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="3" fill="'+col+'"/><text x="'+x.toFixed(1)+'" y="'+(y-6).toFixed(1)+'" text-anchor="'+a+'" font-size="10.5" fill="#3b2e1c">'+lb+fm(pts[i].v)+'</text>'};
  s+=mark(0,UT('rec.start'));if(X(im)-X(0)>60&&X(n-1)-X(im)>60)s+=mark(im,UT('rec.max'));   // 太靠近起點或現在就不另標
  if(n>1)s+=mark(n-1,UT('rec.now'));
  return s+'</svg>';
}
function recTrendHtml(){
  const R=recOf();if(R.t.length<2)return '<div class="small muted">'+UT('rec.none.trend')+'</div>';
  const P=k=>R.t.map(x=>({y:recDec(x[0]).y,v:x[k]}));
  const big=v=>Math.abs(v)>=10000?UT('silver.short',{a:(v/10000).toFixed(1)}):fmt(v);
  return recChart(P(1),UT('rec.tWorth'),big,'#b3261e')+recChart(P(2),UT('rec.tFame'),v=>fmt(v),'#27407a')+'<div class="tiny muted" style="margin-top:4px">'+UT('rec.tFoot')+'</div>';
}
function wikiRecord(){
  const t=UI.s.recTab||'rep';
  let h='<div style="margin:4px 0">'+REC_TABS.map(k=>'<span class="pill '+(t===k?'on':'')+'" data-act="recTab" data-k="'+k+'">'+UT('rec.tab.'+k)+'</span>').join('')+'</div>';
  return h+({rep:recRepHtml,bz:recBzHtml,trend:recTrendHtml}[t]||recRepHtml)();
}
/** 筆記頂端第三個分頁「紀錄」。 */
{const _n=renderNotes;renderNotes=function(){
  if(UI.s.notesTab!=='rec')return _n.apply(this,arguments);
  $('#view-notes').innerHTML='<div class="pixel-box" style="padding:8px">'+UT('rec.h',{a:notesTabsHtml()})+'<div style="margin-top:6px">'+wikiRecord()+'</div></div>';
}}
