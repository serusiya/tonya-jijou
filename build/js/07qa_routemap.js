/* =====================================================================
 * 07qa_routemap.js — 商路頁的地圖
 *  - 五地區縮圖：手繪感的地區輪廓（照各城相對位置疊出），只畫海運航線：本店 → 其他地區的主城。
 *    有該地區泊位許可＝實線，沒有＝淡虛線。點地區展開該地區的城市圖（regionMapSvg）。
 *  - 城市圖：陸運沿既有道路走；本地區港口之間另畫海運航線（南海島間原本就有海路，不另畫）。
 *  - 在途的委託採買與卸留請負外運：一條路線只畫一艘示意船（或一匹馬），從本店慢慢走到目的地、轉頭回本店，一直來回。
 *    點船或馬，列出這條路線上的人與各剩幾旬。走私、唐船割符、借給朋友的人不畫。
 *  文字在 01e 的 rmap.*。
 * ===================================================================== */
/** 縮圖上各地區的大致位置（刻意不對齊，像手繪地圖）。 */
const RMAP_LAYOUT={reg_north:[214,52],reg_central:[168,138],reg_east:[283,156],reg_west:[72,108],reg_south:[74,224]};
const RMAP_K=0.27,RMAP_W=340,RMAP_H=274;
const RMAP_INK='#3b2e1c',RMAP_RED='#b3392b',RMAP_SEA='#2f5a7a';
/** 縮圖上某城的位置。 */
function rmapXY(ct){const c=REGION_XY[ct.region_id]||[0,0],p=cityXY(ct),L=RMAP_LAYOUT[ct.region_id]||[0,0];return [+(L[0]+(p[0]-c[0])*RMAP_K).toFixed(1),+(L[1]+(p[1]-c[1])*RMAP_K).toFixed(1)]}
/** 地區主城：本局啟用城市中人口最多者。 */
function rmapCapital(rid){return CITIES.filter(c=>c.region_id===rid).sort((a,b)=>(parseInt(b.population,10)||0)-(parseInt(a.population,10)||0))[0]}
/** 在途、要畫在地圖上的人（委託採買與卸留請負外運）。 */
function rmapTrips(){return (G.ships||[]).filter(s=>s.entrust&&CITY(s.origId))}
/** 路線上的人（依路線鍵分組）：縮圖用 'R地區'；城市圖用 'L城'（陸運）、'S城'（區內海運）。 */
function rmapGroups(){
  const home=homeCity(),g={};
  rmapTrips().forEach(s=>{const ct=CITY(s.origId);let k;
    if(s.mode==='sea'&&ct.region_id!==home.region_id)k='R'+ct.region_id;
    else k=(s.mode==='sea'?'S':'L')+ct.id;
    (g[k]=g[k]||[]).push(s)});
  return g;
}
/** 示意船（朝右）。 */
const RMAP_BOAT='<g stroke="'+RMAP_INK+'" stroke-width=".7" stroke-linejoin="round"><path d="M-7 1H7L4.5 5H-4.5Z" fill="#8a5a33"/><path d="M0 1V-9M0 -9L6 -1H0Z" fill="#fbf6e4"/><path d="M0 -9L-4.5 -1H0" fill="#efe4c4"/></g>';
/** 示意馬（朝右）。 */
const RMAP_HORSE='<g stroke="'+RMAP_INK+'" stroke-width=".7" stroke-linejoin="round" stroke-linecap="round"><path d="M-6 -1Q-6 -4 -2 -4H3L5 -7L7.5 -6L6.5 -3.5L5 -3V0Q5 1 3 1H-4Q-6 1 -6 -1Z" fill="#9c6b3c"/><path d="M-4.5 1V5M-2.5 1V5M2 1V5M4 1V5" fill="none" stroke-width="1"/><path d="M-6 -2.5Q-8.5 -1 -8 2" fill="none"/><rect x="-2.5" y="-6.5" width="4" height="2.6" fill="#fbf6e4" stroke-width=".5"/></g>';
/** 沿路線來回的示意圖示。pid＝路線 path 的 id；len＝路線長；dx＝目的地在右邊（>0）或左邊。 */
function rmapMover(pid,len,dx,icon,key){
  const dur=Math.max(12,len/7).toFixed(1),f=dx<0?-1:1;
  return '<g data-act="rmapShip" data-k="'+esc(key)+'" style="cursor:pointer">'
   +'<animateMotion dur="'+dur+'s" repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear"><mpath href="#'+pid+'"/></animateMotion>'
   +'<circle r="10" fill="transparent"/><g><animateTransform attributeName="transform" type="scale" values="'+f+' 1;'+(-f)+' 1" keyTimes="0;0.5" calcMode="discrete" dur="'+dur+'s" repeatCount="indefinite"/>'+icon+'</g></g>';
}
/** 兩點之間略彎的航線（彎的方向與幅度每條固定）。 */
function rmapCurve(a,b,seed){
  const r=seeded('rmap'+seed),mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,k=(r()-0.5)*0.36*L;
  const cx=mx-dy/L*k,cy=my+dx/L*k;
  return {d:'M'+a[0]+' '+a[1]+'Q'+cx.toFixed(1)+' '+cy.toFixed(1)+' '+b[0]+' '+b[1],len:L*1.05};
}
/** 五地區縮圖。 */
function rmapOverviewSvg(){
  const home=homeCity(),hr=home.region_id,W=RMAP_W,H=RMAP_H,LAND='#f0e2b6',WASH='#9fb3b1',groups=rmapGroups();
  const regs=Object.keys(RMAP_LAYOUT).filter(rid=>CITIES.some(c=>c.region_id===rid));
  let s='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block" font-family="\'Noto Serif TC\',\'Source Han Serif TC\',\'Songti TC\',\'PMingLiU\',serif">';
  s+='<defs><filter id="rmcst" x="0" y="0" width="'+W+'" height="'+H+'" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
   +'<feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="17" result="t"/>'
   +'<feDisplacementMap in="SourceGraphic" in2="t" scale="12" xChannelSelector="R" yChannelSelector="G" result="d"/>'
   +'<feMorphology in="d" operator="dilate" radius="1" result="d1"/><feMorphology in="d" operator="dilate" radius="3" result="d3"/><feMorphology in="d" operator="dilate" radius="4.2" result="d4"/>'
   +'<feComposite in="d1" in2="d" operator="out" result="ln"/><feFlood flood-color="'+RMAP_INK+'"/><feComposite in2="ln" operator="in" result="line"/>'
   +'<feComposite in="d4" in2="d3" operator="out" result="r1a"/><feFlood flood-color="'+WASH+'" flood-opacity=".75"/><feComposite in2="r1a" operator="in" result="r1"/>'
   +'<feFlood flood-color="'+LAND+'"/><feComposite in2="d" operator="in" result="fill"/>'
   +'<feMerge><feMergeNode in="r1"/><feMergeNode in="fill"/><feMergeNode in="line"/></feMerge></filter>'
   +'<filter id="rmpap" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .33  0 0 0 0 .15  0 0 0 .22 0"/></filter>'
   +'<radialGradient id="rmvg" cx="50%" cy="50%" r="75%"><stop offset="60%" stop-color="#6b4a1f" stop-opacity="0"/><stop offset="100%" stop-color="#6b4a1f" stop-opacity=".38"/></radialGradient></defs>';
  s+='<rect width="'+W+'" height="'+H+'" fill="#d5dccf"/>';
  const rd=seeded('rmapwave');
  for(let i=0;i<46;i++){const wx=rd()*W,wy=rd()*H;s+='<path d="M'+wx.toFixed(1)+' '+wy.toFixed(1)+'q2.5 -3 5 0q2.5 -3 5 0" fill="none" stroke="'+WASH+'" stroke-width=".7" stroke-linecap="round" opacity=".8"/>'}
  // 陸地：每城一團，同區連成一片；南海每城自成小島
  s+='<g filter="url(#rmcst)">'+CITIES.map(c=>{const p=rmapXY(c);return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+(c.region_id==='reg_south'?7:15)+'" fill="#000"/>'}).join('')+'</g>';
  // 海運航線：本店 → 其他地區主城
  const hp=rmapXY(home),seaOK=canSea(home),P=permitsOf().sea;
  let lanes='',movers='';
  if(seaOK)regs.filter(rid=>rid!==hr&&CITIES.some(c=>c.region_id===rid&&canSea(c))).forEach(rid=>{
    const cap=rmapCapital(rid),cv=rmapCurve(hp,rmapXY(cap),hr+rid),ok=!!(P.all||P[rid]),pid='rmlane_'+rid;
    lanes+='<path id="'+pid+'" d="'+cv.d+'" fill="none" stroke="'+(ok?RMAP_SEA:'#7d8b8a')+'" stroke-width="'+(ok?1.3:.8)+'" stroke-dasharray="'+(ok?'5 2.5':'1.5 3')+'" stroke-linecap="round" opacity="'+(ok?.9:.7)+'"/>';
    if(groups['R'+rid])movers+=rmapMover(pid,cv.len,rmapXY(cap)[0]-hp[0],RMAP_BOAT,'R'+rid);
  });
  s+=lanes+movers;                                  // 船畫在地區名牌底下，經過時不會蓋住名牌
  // 各地區：點擊範圍、主城、名牌
  regs.forEach(rid=>{
    const L=CITIES.filter(c=>c.region_id===rid),pts=L.map(rmapXY),cap=rmapCapital(rid),cp=rmapXY(cap),mine=rid===hr;
    const ys=pts.map(p=>p[1]),xs=pts.map(p=>p[0]),top=Math.min(...ys),bot=Math.max(...ys),mid=(Math.min(...xs)+Math.max(...xs))/2;
    let g='<g data-act="rmapReg" data-id="'+rid+'" style="cursor:pointer">'+pts.map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="22" fill="transparent"/>').join('');
    g+='<circle cx="'+cp[0]+'" cy="'+cp[1]+'" r="2.6" fill="'+RMAP_INK+'"/>';
    const nm=UT('rmap.reg.'+rid),w=[...nm].length*10+8,side=rid==='reg_north';
    const lx0=side?Math.min(...xs)-w/2-16:mid,ly=side?(top+bot)/2-7:Math.max(top-26,10);
    g+='<rect x="'+(lx0-w/2+.7).toFixed(1)+'" y="'+(ly+.7).toFixed(1)+'" width="'+w+'" height="15" fill="#6b4a1f" opacity=".25"/>';
    g+='<rect x="'+(lx0-w/2).toFixed(1)+'" y="'+ly.toFixed(1)+'" width="'+w+'" height="15" fill="'+(mine?'#fde3d6':'#fbf4dc')+'" stroke="'+(mine?RMAP_RED:RMAP_INK)+'" stroke-width=".8"/>';
    g+='<text x="'+lx0.toFixed(1)+'" y="'+(ly+11.3).toFixed(1)+'" text-anchor="middle" font-size="10" font-weight="bold" fill="'+(mine?RMAP_RED:RMAP_INK)+'">'+esc(nm)+'</text>';
    s+=g+'</g>';
  });
  // 本店
  s+='<circle cx="'+hp[0]+'" cy="'+hp[1]+'" r="5" fill="'+RMAP_RED+'" opacity=".25"/><circle cx="'+hp[0]+'" cy="'+hp[1]+'" r="5" fill="none" stroke="'+RMAP_RED+'" stroke-width="1.1"/><circle cx="'+hp[0]+'" cy="'+hp[1]+'" r="1.8" fill="'+RMAP_RED+'"/>';
  s+='<rect width="'+W+'" height="'+H+'" filter="url(#rmpap)" style="pointer-events:none"/><rect width="'+W+'" height="'+H+'" fill="url(#rmvg)" style="pointer-events:none"/>';
  s+='<rect x="3" y="3" width="'+(W-6)+'" height="'+(H-6)+'" fill="none" stroke="'+RMAP_INK+'" stroke-width="2.2" style="pointer-events:none"/><rect x="7" y="7" width="'+(W-14)+'" height="'+(H-14)+'" fill="none" stroke="'+RMAP_INK+'" stroke-width=".6" style="pointer-events:none"/>';
  return s+'</svg>';
}
/** 城市圖疊加層：區內海運航線（底層）。 */
function rmapUnder(ctx){
  const home=homeCity();if(ctx.rid!==home.region_id||!canSea(home)||ctx.rid==='reg_south')return '';   // 南海島間本來就畫了海路
  const hp=ctx.px.find(p=>p.c.id===home.id);if(!hp)return '';
  const ok=seaPermitFor(home);
  return ctx.px.filter(p=>p.c.id!==home.id&&canSea(p.c)).map(p=>{const cv=rmapCurve([hp.sx,hp.sy],[p.sx,p.sy],'in'+p.c.id);
    return '<path id="rmsea_'+p.c.id+'" d="'+cv.d+'" fill="none" stroke="'+(ok?RMAP_SEA:'#7d8b8a')+'" stroke-width="'+(ok?1.1:.7)+'" stroke-dasharray="'+(ok?'4 2.5':'1.5 3')+'" stroke-linecap="round" opacity="'+(ok?.8:.6)+'"/>'}).join('');
}
/** 城市圖疊加層：示意船與馬（畫在城市與名牌底下）。陸運沿道路走最短路線；南海的船沿島間海路走。 */
function rmapOver(ctx){
  const home=homeCity();if(ctx.rid!==home.region_id)return '';
  const px=ctx.px,hi=px.findIndex(p=>p.c.id===home.id);if(hi<0)return '';
  const groups=rmapGroups();let s='';
  Object.keys(groups).forEach(k=>{
    const mode=k[0],id=k.slice(1),di=px.findIndex(p=>p.c.id===id);if(di<0||mode==='R')return;
    if(mode==='S'&&ctx.rid!=='reg_south'){const cv=rmapCurve([px[hi].sx,px[hi].sy],[px[di].sx,px[di].sy],'in'+id);
      s+='<path id="rmsea2_'+id+'" d="'+cv.d+'" fill="none" stroke="none"/>'+rmapMover('rmsea2_'+id,cv.len,px[di].sx-px[hi].sx,RMAP_BOAT,k);return}
    const path=rmapRoadPath(px,ctx.E,hi,di);let d='',len=0;
    path.forEach((i,j)=>{d+=(j?'L':'M')+px[i].sx+' '+px[i].sy;if(j)len+=Math.hypot(px[i].sx-px[path[j-1]].sx,px[i].sy-px[path[j-1]].sy)});
    s+='<path id="rmland_'+id+'" d="'+d+'" fill="none" stroke="none"/>'+rmapMover('rmland_'+id,len,px[di].sx-px[hi].sx,mode==='S'?RMAP_BOAT:RMAP_HORSE,k);
  });
  return s;
}
/** 道路網上的最短路線（城市索引）；不通時直線。 */
function rmapRoadPath(px,E,a,b){
  const n=px.length,dist=Array(n).fill(1e9),prev=Array(n).fill(-1),done=Array(n).fill(false),adj=px.map(()=>[]);
  E.forEach(([i,j])=>{const w=Math.hypot(px[i].sx-px[j].sx,px[i].sy-px[j].sy);adj[i].push([j,w]);adj[j].push([i,w])});
  dist[a]=0;for(let t=0;t<n;t++){let u=-1;for(let i=0;i<n;i++)if(!done[i]&&(u<0||dist[i]<dist[u]))u=i;if(u<0||dist[u]>=1e9)break;done[u]=true;adj[u].forEach(([v,w])=>{if(dist[u]+w<dist[v]){dist[v]=dist[u]+w;prev[v]=u}})}
  if(dist[b]>=1e9)return [a,b];
  const out=[];for(let v=b;v>=0;v=prev[v])out.unshift(v);return out;
}
/** 商路頁頂端的地圖卡。 */
function routeMapCard(){
  const rid=UI.s.rmap;
  let h='<div class="pixel-box" style="padding:4px;margin:6px 0;overflow:hidden">';
  if(!rid||!CITIES.some(c=>c.region_id===rid)){
    h+=rmapOverviewSvg()+'<div class="tiny muted" style="text-align:center;margin-top:3px">'+UT('rmap.hint')+'</div></div>';
    return h;
  }
  h+='<div style="margin:2px 0 4px"><span class="pill" data-act="rmapBack">'+UT('rmap.back')+'</span> <b class="small">'+esc(REG_NAME(rid))+'</b></div>';
  const sel=UI.s.rmapSel&&CITY(UI.s.rmapSel)&&CITY(UI.s.rmapSel).region_id===rid?UI.s.rmapSel:null;
  h+=regionMapSvg(rid,{home:G.cityId,sel,act:'rmapCity',under:x=>rmapUnder(x)+rmapOver(x)});   // 船馬畫在城市與名牌底下，經過時不會蓋住城名
  h+='<div class="tiny muted" style="text-align:center;margin-top:3px">'+UT('rmap.hint2')+'</div></div>';
  if(sel)h+=cityLine(CITY(sel));
  return h;
}
ACT.rmapReg=el=>{UI.s.rmap=el.dataset.id;UI.s.rmapSel=null;renderRoutes();sfx.tap()};
ACT.rmapBack=()=>{UI.s.rmap=null;UI.s.rmapSel=null;renderRoutes();sfx.tap()};
ACT.rmapCity=el=>{const id=el.dataset.cid;UI.s.rmapSel=UI.s.rmapSel===id?null:id;UI.s.wikiOpen=UI.s.wikiOpen||{};UI.s.wikiOpen['c'+id]=true;renderRoutes();sfx.tap()};
ACT.rmapShip=el=>{
  const k=el.dataset.k,L=rmapGroups()[k]||[];if(!L.length)return;
  const place=k[0]==='R'?UT('rmap.reg.'+k.slice(1)):CITY(k.slice(1)).name;
  UI.showInfo(UT('rmap.shipTitle',{a:place}),L.map(s=>'<div class="card small">'+UT(s.out?'rmap.shipRowOut':'rmap.shipRow',{n:esc(s.captName||''),c:esc(CITY(s.origId).name),t:s.eta})+'</div>').join(''));
};
