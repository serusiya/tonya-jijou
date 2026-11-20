/* ═════ [07p_wiki] ═════ */
'use strict';
/* ★檔案總覽：筆記內的「百科」分頁（線上遊戲百科全書）
 * - 玩法簡介、官吏架構、物產圖鑑；內容多半取自資料檔（OFFICIALS／COMM_INFO），玩法簡介文字在 WIKI_GUIDE。
 * - 地區城市與古地圖另成筆記的「地圖」頁（renderMap，與百科並列；第二百九十二節）。
 * - 筆記頁頂端有「名冊／百科／地圖／紀錄」切換；renderNotes（07_ui_people.js）在百科、地圖模式下改呼叫 renderWiki、renderMap。 */
/* ======================= 07p 百科 ======================= */
const WIKI_SECS=[['guide',UT('wiki.WIKI_SECS')],['office',UT('wiki.WIKI_SECS.2')],['goods',UT('wiki.WIKI_SECS.4')]];
/** 百科官吏頁的「請託規則」（敘事式，不列公式）。 */
const WIKI_REQ=UT('wiki.WIKI_REQ');
/** 玩法簡介：[標題, 內文 HTML]（敘事式說明，不列公式）。 */
const WIKI_GUIDE=[
  [UT('wiki.WIKI_GUIDE'),UT('wiki.WIKI_GUIDE.2')],
  null,                                                    // 這裡插入「各行業與玩法」（wikiGuide，第三百四十八節）
  [UT('wiki.WIKI_GUIDE.3'),UT('wiki.WIKI_GUIDE.4')],
  [UT('wiki.g.stress'),UT('wiki.g.stress.b')],
  [UT('wiki.WIKI_GUIDE.5'),UT('wiki.WIKI_GUIDE.6')],
  [UT('wiki.WIKI_GUIDE.7'),UT('wiki.WIKI_GUIDE.8')],
  [UT('wiki.WIKI_GUIDE.9'),UT('wiki.WIKI_GUIDE.10')],
  [UT('wiki.WIKI_GUIDE.11'),UT('wiki.WIKI_GUIDE.12')],
  [UT('wiki.WIKI_GUIDE.13'),UT('wiki.WIKI_GUIDE.14')],
  [UT('wiki.WIKI_GUIDE.15'),UT('wiki.WIKI_GUIDE.16')],
  [UT('wiki.WIKI_GUIDE.17'),UT('wiki.WIKI_GUIDE.18')],
  [UT('wiki.WIKI_GUIDE.19'),UT('wiki.WIKI_GUIDE.20')],
  [UT('wiki.WIKI_GUIDE.21'),UT('wiki.WIKI_GUIDE.22')],
  [UT('wiki.g.big'),UT('wiki.g.big.b')],
  [UT('wiki.g.move'),UT('wiki.g.move.b')],
  [UT('wiki.WIKI_GUIDE.23'),UT('wiki.WIKI_GUIDE.24')],
  [UT('wiki.WIKI_GUIDE.25'),UT('wiki.WIKI_GUIDE.26')]
];
/** 各行業與玩法：照玩法分組（第三百四十八節）；行業名稱取 NAMES.sys。 */
const WIKI_GROUPS=[['riot',['grain','marine','pickle']],['smug',['medicine','sake']],['patron',['luxury']],['gov',['mining']],['plain',['textile','timber']]];
/** 筆記頂端的「名冊／百科／地圖／紀錄」切換。 */
function notesTabsHtml(){
  const t=UI.s.notesTab||'book';
  return '<div style="margin-bottom:6px">'+[['book',UT('wiki.notesTabsHtml')],['wiki',UT('wiki.notesTabsHtml.2')],['map',UT('wiki.notesTabsHtml.4')],['rec',UT('wiki.notesTabsHtml.3')]].map(([k,n])=>'<span class="pill '+(t===k?'on':'')+'" data-act="nTab" data-k="'+k+'">'+n+'</span>').join('')+'</div>';
}
ACT.nTab=el=>{UI.s.notesTab=el.dataset.k;UI.render();$('#main').scrollTop=0};
ACT.wikiSec=el=>{UI.s.wikiSec=el.dataset.k;UI.render();$('#main').scrollTop=0};
ACT.wikiToggle=el=>{UI.s.wikiOpen=UI.s.wikiOpen||{};const k=el.dataset.k;UI.s.wikiOpen[k]=!UI.s.wikiOpen[k];UI.render()};
ACT.mapCity=el=>{UI.s.mapSel=el.dataset.cid;UI.s.wikiOpen=UI.s.wikiOpen||{};UI.s.wikiOpen['c'+el.dataset.cid]=true;UI.render()};
ACT.wikiRegion=el=>{UI.s.wikiRegion=el.dataset.id;UI.s.mapSel=null;UI.render();$('#main').scrollTop=0};
/** 可展開的區塊。 */
function wikiBox(k,title,body,tag){
  const o=UI.s.wikiOpen&&UI.s.wikiOpen[k];
  return '<div class="card" style="margin-top:5px"><div class="row" data-act="wikiToggle" data-k="'+esc(k)+'" style="cursor:pointer"><b class="text-brief">'+title+'</b><span class="text-meta muted">'+(tag?tag+' ':'')+(o?'▲':'▼')+'</span></div>'+(o?'<div class="text-prose" style="margin-top:4px" data-act="none">'+body+'</div>':'')+'</div>';
}
/** 各地區：id→{id,name,cities}。 */
function wikiRegions(){
  const m={},order=[];
  CITIES.forEach(c=>{if(!m[c.region_id]){m[c.region_id]={id:c.region_id,name:c.region_name,cities:[]};order.push(c.region_id)}m[c.region_id].cities.push(c)});
  return order.map(id=>m[id]);
}
function wikiGuide(){
  let h=UT('wiki.h');
  const grp=UT('wiki.wikiGuide.3',{a:WIKI_GROUPS.map(([k,L])=>UT('wiki.grp',{t:esc(SYS_BY_KEY[L[0]].style),n:esc(L.map(x=>SYS_BY_KEY[x].name).join(NAMES_SEP)),b:esc(UT('wiki.grp.'+k))})).join('')});
  h+=WIKI_GUIDE.map((g,i)=>g?wikiBox('g'+i,g[0],esc(g[1]).replace(/\n/g,'<br>')):wikiBox('gsys',UT('wiki.wikiGuide'),grp)).join('');
  return h;
}
function wikiOffice(){
  const O=OFFICIALS;
  let h='<div class="notice tiny">'+esc(O.description)+'</div>';
  h+=wikiBox('orank',UT('wiki.wikiOffice'),UT('wiki.wikiOffice.2',{a:O.ranks.map(r=>'<div style="margin-top:4px"><b>'+esc(r.title)+'</b><div class="text-brief">'+esc(r.influence)+'</div></div>').join('')}));
  h+=wikiBox('oreq',UT('wiki.wikiOffice.3'),'<div class="text-brief">'+esc(WIKI_REQ)+'</div>');
  Object.keys(O.systems).forEach(ct=>{
    const sys=O.systems[ct],rk={};sys.positions.forEach(p=>{(rk[p.rank]=rk[p.rank]||[]).push(p)});
    const body=UT('wiki.body.2',{a:esc(sys.department)})+'</div><div class="text-brief" style="margin-top:3px">'+UT('wiki.body.3',{a:esc(sys.core_function),b:esc(sys.merchant_interaction)})+'</div>'+Object.keys(rk).sort((a,b)=>a-b).map(r=>{const ri=RANK_INFO[r];return '<div class="text-meta muted" style="margin-top:5px">'+esc(ri?ri.title:UT('wiki.body',{a:r}))+'</div>'+rk[r].map(p=>'<span class="pill" data-act="posInfo" data-id="'+p.id+'">'+esc(p.title)+'</span>').join('')}).join('');
    h+=wikiBox('o'+ct,esc(sys.name),body,UT('wiki.wikiOffice.4',{a:sys.positions.length}));
  });
  h+=UT('wiki.wikiOffice.5');
  return h;
}
/** 城名旁的「海運」「陸運」標籤：港口城可走海運；南海群島以外的城有陸路。 */
const cityRouteTags=ct=>(canSea(ct)?' <span class="tag navy">'+UT('wiki.cityRoute.sea')+'</span>':'')+(ct.region_id!=='reg_south'?' <span class="tag green">'+UT('wiki.cityRoute.land')+'</span>':'');
function cityLine(ct){
  const home=ct.id===G.cityId;
  const open=UI.s.wikiOpen&&UI.s.wikiOpen['c'+ct.id];
  let h='<div class="card" style="margin-top:4px;'+(home?'border-color:#9b2c3a':'')+'"><div class="row" data-act="wikiToggle" data-k="c'+ct.id+'" style="cursor:pointer"><div><b>'+esc(ct.name)+'</b>'+(home?UT('wiki.h.2'):'')+cityRouteTags(ct)+' <span class="tag gray">'+UT('wiki.h.3',{a:esc(ct.location_type),b:fmt(cityPop(ct)),c:open?'▲':'▼'})+'</span></div>';
  h+=UT('wiki.cityLine.2',{a:cityProds(ct).length?cityProds(ct).map(n=>{const c=COMM_MAP[n];return c?'<span class="tag clk" data-act="commInfo" data-n="'+esc(n)+'">'+(isDevProd(ct,n)?'🌱':'')+esc(c.short.slice(0,6))+'</span>':''}).join(' '):UT('wiki.cityLine')})+'</div>';
  if(open){
    const f=ct.special_festival||{},sr=ct.seasonal_annual_rhythms||{},hist=(ct.history_100_years||[]).slice(0,3).map(x=>({year:yearStr(parseInt(x.year,10)),title:x.title})).concat(cityHistExtra(ct).map(x=>({year:yearStr(x.year),title:x.title})));   // 年份一律換成遊戲年（原本直接顯示「-39年」）
    h+='<div class="text-prose" style="margin-top:5px" data-act="none"><div>'+esc(ct.geography_description)+'</div>'+UT('wiki.cityLine.6',{a:f.name?UT('wiki.cityLine.3',{a:esc(f.name),b:esc(f.date),c:esc(f.cultural_lore)})+'</div><div class="text-brief">'+esc(f.economic_impact)+'</div></div>':'',b:['spring','summer','autumn','winter'].map(k=>sr[k]?'<div class="text-brief">'+UT('wiki.cityLine.4',{a:seasonName(k),b:esc(sr[k])})+'</div>':'').join('')})+'</div>'+(hist.length?UT('wiki.cityLine.5',{a:hist.map(x=>'<div class="text-meta">'+UT('wiki.cityLine.4',{a:esc(x.year),b:esc(x.title)})+'</div>').join('')})+'</div>':'')+'</div>';
  }
  return h+'</div>';
}
function wikiRegion(){
  const R_=wikiRegions();
  let id=UI.s.wikiRegion;if(!R_.some(r=>r.id===id))id=(CITY(G.cityId)||{}).region_id||R_[0].id;
  const r=R_.find(x=>x.id===id),types={},typeName={},goods={};
  r.cities.forEach(c=>{types[c.type]=(types[c.type]||0)+1;typeName[c.type]=c.location_type;cityProds(c).forEach(n=>goods[n]=(goods[n]||0)+1)});
  const own=n=>COMM_MAP[n]&&COMM_MAP[n].sys===G.sysKey?1:0;   // 本業貨排最前面，剩下的空位照產地城數補滿十項（第三百節）
  const top=Object.entries(goods).sort((a,b)=>own(b[0])-own(a[0])||b[1]-a[1]).slice(0,10);
  let h='<div>'+R_.map(x=>'<span class="pill '+(x.id===id?'on':'')+'" data-act="wikiRegion" data-id="'+x.id+'">'+esc(x.name)+'</span>').join('')+'</div>';
  h+='<div class="card" style="margin-top:5px"><b>'+esc(r.name)+'</b> <span class="tag gray">'+UT('wiki.wikiRegion.2',{a:r.cities.length,b:Object.entries(types).map(([k,v])=>esc(typeName[k])+' '+v).join(UT('wiki.wikiRegion'))})+'</div>'+UT('wiki.wikiRegion.3',{a:top.map(([n,v])=>{const c=COMM_MAP[n];return c?'<span class="tag clk" data-act="commInfo" data-n="'+esc(n)+'">'+esc(c.short.slice(0,6))+'</span>':''}).join(' ')})+'</div></div>';
  if(UI_TXT['wiki.trait.'+id]!==undefined)h+='<div class="tiny" style="margin-top:3px;color:#27407a">'+UT('wiki.trait.'+id)+'</div>';   // 地區特色（第三百一十四節）
  const sel=UI.s.mapSel&&r.cities.find(c=>c.id===UI.s.mapSel);
  h+='<div class="pixel-box" style="padding:4px;margin-top:5px;overflow:hidden">'+UT('wiki.wikiRegion.6',{a:regionMapSvg(id,{home:G.cityId,sel:sel&&sel.id}),b:id==='reg_south'?UT('wiki.wikiRegion.4'):UT('wiki.wikiRegion.5')});
  if(sel)h+=cityLine(sel);
  h+=r.cities.filter(c=>!sel||c.id!==sel.id).slice().sort((a,b)=>cityPop(b)-cityPop(a)).map(cityLine).join('');
  return h;
}
function wikiGoods(){
  const by={};COMM.forEach(c=>{(by[c.sys]=by[c.sys]||[]).push(c)});
  let h=UT('wiki.h.4');
  SYS.forEach(s=>{
    const list=by[s.key]||[];if(!list.length||(G&&s.key===absentSys()))return;   // 這一局沒有的行業（魚屋或醬漬問屋）不列
    const body=list.slice().sort((a,b)=>a.base-b.base).map(c=>{const n=(CITIES.filter(ct=>cityProds(ct).includes(c.name)).length);return '<div class="row tiny" style="margin-top:3px" data-act="commInfo" data-n="'+esc(c.name)+'"><span><span class="tag clk">'+esc(c.short.slice(0,8))+'</span> <span class="tag '+(c.luxury?'gold':c.staple?'green':'gray')+'">'+UT('wiki.body.4',{a:NM('kind',c.kind),w:NM('weight',weightClass(c.name)),b:fmt1(c.base),c:n})}).join('');
    h+=wikiBox('s'+s.key,UT('wiki.wikiGoods',{a:esc(s.name)}),body,UT('wiki.wikiGoods.2',{a:list.length}));
  });
  return h;
}
/** 百科主畫面。 */
function renderWiki(){
  let sec=UI.s.wikiSec||'guide';if(!WIKI_SECS.some(([k])=>k===sec))sec='guide';   // 原本的「城市」分頁已移到地圖頁
  let h='<div class="pixel-box" style="padding:8px">'+UT('wiki.h.5',{a:notesTabsHtml()});
  h+='<div style="margin-top:6px">'+WIKI_SECS.map(([k,n])=>'<span class="pill '+(sec===k?'on':'')+'" data-act="wikiSec" data-k="'+k+'">'+n+'</span>').join('')+'</div>';
  h+='<div style="margin-top:4px">'+({guide:wikiGuide,office:wikiOffice,goods:wikiGoods}[sec]||wikiGuide)()+'</div></div>';
  $('#view-notes').innerHTML=h;
}
/** 筆記的「地圖」頁：地區頁籤、地區概況、古地圖與各城說明（原本百科的城市分頁）。 */
function renderMap(){
  $('#view-notes').innerHTML='<div class="pixel-box" style="padding:8px">'+UT('wiki.h.6',{a:notesTabsHtml()})+'<div style="margin-top:6px">'+wikiRegion()+'</div></div>';
}
/** 從別處（遠國奉行所）跳到筆記的地圖頁，停在指定地區。 */
ACT.goMap=el=>{UI.s.notesTab='map';UI.s.wikiRegion=el.dataset.id;UI.s.mapSel=null;if(UI.s.sheet)UI.closeSheet();UI.go('notes')};

/* ═════ [07q_map] ═════ */
/* 地區地圖（日式古地圖風格）：用遊戲內真實的城市座標（cityXY）畫 SVG，標示城市位置與連接道路。
 * - 陸地：以城市為中心的圓團疊成，再用濾鏡畫出手繪般的海岸線與水紋；南海群島每城各成一島，連線為海路（紅色虛線加帆船）。
 * - 道路：先連成最短樹，再補上相近城市之間的支線；陸地上為朱紅色街道，沿線有里程點。
 * - 圖示：行政都市＝天守閣、礦產＝礦山、水路／水陸要衝＝帆船、陸路要衝＝關門、農林＝茅屋田畦；城名為直書兩字名牌；本店駐節城以朱紅標出。
 */
/** 城市圖示類型：admin / mine / port / farm / land */
const MAP_KIND={admin:'admin',mine:'mine',water:'port',waterland:'port',land:'land',farm:'farm',forest:'farm'};
const mapKind=ct=>MAP_KIND[ct.type]||'farm';
/** 道路（或海路）端點對：最短樹＋近鄰支線。 */
function mapEdges(pts,islands){
  const n=pts.length,d=(a,b)=>Math.hypot(pts[a].x-pts[b].x,pts[a].y-pts[b].y),E=[],inT=new Set([0]),has=new Set();
  const add=(a,b)=>{const k=a<b?a+'-'+b:b+'-'+a;if(!has.has(k)){has.add(k);E.push([a,b])}};
  while(inT.size<n){let best=null;inT.forEach(a=>{for(let b=0;b<n;b++){if(inT.has(b))continue;const w=d(a,b);if(!best||w<best[0])best=[w,a,b]}});inT.add(best[2]);add(best[1],best[2])}
  const lim=islands?75:52;
  for(let a=0;a<n;a++){const o=[];for(let b=0;b<n;b++)if(b!==a)o.push([d(a,b),b]);o.sort((x,y)=>x[0]-y[0]);if(o[1]&&o[1][0]<lim)add(a,o[1][1])}
  return E;
}
/** 畫某地區地圖。opts.home＝本店所在城市 id，opts.sel＝選取中的城市 id。 */
function regionMapSvg(rid,opts){
  opts=opts||{};const list=CITIES.filter(c=>c.region_id===rid),islands=rid==='reg_south';
  const INK='#3b2e1c',RED='#b3392b',SEA='#d5dccf',LAND='#f0e2b6',WASH='#9fb3b1';
  const pts=list.map(c=>{const p=cityXY(c);return {c,x:p[0],y:p[1],k:mapKind(c)}});
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;pts.forEach(p=>{x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y)});
  const pad=44;x0-=pad;y0-=pad+8;x1+=pad;y1+=pad;const W=Math.round(x1-x0),H=Math.round(y1-y0);
  const X=v=>+(v-x0).toFixed(1),Y=v=>+(v-y0).toFixed(1),rd=seeded('koezu'+rid),id=rid;
  const px=pts.map(p=>({...p,sx:X(p.x),sy:Y(p.y)}));
  const R=islands?15:42,hc=opts.home&&CITY(opts.home),homeReg=!!hc&&hc.region_id===rid;
  let s='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block" font-family="\'Noto Serif TC\',\'Source Han Serif TC\',\'Songti TC\',\'PMingLiU\',serif">';
  s+='<defs>'
   +'<filter id="cst'+id+'" x="0" y="0" width="'+W+'" height="'+H+'" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
   +'<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="'+(3+Math.floor(rd()*40))+'" result="t"/>'
   +'<feDisplacementMap in="SourceGraphic" in2="t" scale="15" xChannelSelector="R" yChannelSelector="G" result="d"/>'
   +'<feMorphology in="d" operator="dilate" radius="1.2" result="d1"/><feMorphology in="d" operator="dilate" radius="4" result="d4"/><feMorphology in="d" operator="dilate" radius="5.4" result="d5"/><feMorphology in="d" operator="dilate" radius="9" result="d9"/><feMorphology in="d" operator="dilate" radius="10.4" result="d10"/>'
   +'<feComposite in="d1" in2="d" operator="out" result="ln"/><feFlood flood-color="'+INK+'"/><feComposite in2="ln" operator="in" result="line"/>'
   +'<feComposite in="d5" in2="d4" operator="out" result="r1a"/><feFlood flood-color="'+WASH+'" flood-opacity=".75"/><feComposite in2="r1a" operator="in" result="r1"/>'
   +'<feComposite in="d10" in2="d9" operator="out" result="r2a"/><feFlood flood-color="'+WASH+'" flood-opacity=".5"/><feComposite in2="r2a" operator="in" result="r2"/>'
   +'<feFlood flood-color="'+LAND+'"/><feComposite in2="d" operator="in" result="fill"/>'
   +'<feMerge><feMergeNode in="r2"/><feMergeNode in="r1"/><feMergeNode in="fill"/><feMergeNode in="line"/></feMerge></filter>'
   +'<filter id="pap'+id+'" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .33  0 0 0 0 .15  0 0 0 .22 0"/></filter>'
   +'<filter id="stn'+id+'" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="11"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .38  0 0 0 0 .18  0 0 0 1.1 -.42"/></filter>'
   +'<radialGradient id="vg'+id+'" cx="50%" cy="50%" r="75%"><stop offset="60%" stop-color="#6b4a1f" stop-opacity="0"/><stop offset="100%" stop-color="#6b4a1f" stop-opacity=".38"/></radialGradient>'
   +'</defs>';
  s+='<rect width="'+W+'" height="'+H+'" fill="'+SEA+'"/>';
  s+='<rect width="'+W+'" height="'+H+'" filter="url(#stn'+id+')" opacity=".5"/>';
  // 海浪紋
  for(let i=0;i<70;i++){const wx=rd()*W,wy=rd()*H;if(px.some(p=>Math.hypot(p.sx-wx,p.sy-wy)<R+16))continue;
    s+='<path d="M'+wx.toFixed(1)+' '+wy.toFixed(1)+'q2.5 -3 5 0q2.5 -3 5 0q2.5 -3 5 0" fill="none" stroke="'+WASH+'" stroke-width=".7" stroke-linecap="round"/>'}
  // 陸地
  s+='<g filter="url(#cst'+id+')">'+px.map(p=>'<circle cx="'+p.sx+'" cy="'+p.sy+'" r="'+R+'" fill="#000"/>').join('')+'</g>';
  // 山水
  const mtn=(mx,my,sc,dark)=>{let t='<g transform="translate('+mx.toFixed(1)+' '+my.toFixed(1)+') scale('+sc+')" stroke="'+INK+'" stroke-width=".7" stroke-linejoin="round">';
    t+='<path d="M-9 0L-4 -9L-1 -4L3 -12L9 0Z" fill="'+(dark?'#a69a78':'#cbbf98')+'"/><path d="M-4 -9L-3 -3M3 -12L2 -4M3 -12L6 -3M-1 -4L0 0" stroke-width=".5" fill="none"/>';return t+'</g>'};
  const tree=(tx,ty)=>'<g transform="translate('+tx.toFixed(1)+' '+ty.toFixed(1)+')" stroke="'+INK+'" stroke-width=".6" fill="none"><path d="M0 0V3"/><path d="M-2.4 0L0 -3L2.4 0M-2 -2L0 -5L2 -2" fill="#8d9a5c"/></g>';
  const onLand=(x,y)=>px.some(p=>Math.hypot(p.sx-x,p.sy-y)<R*0.8)&&!px.some(p=>Math.hypot(p.sx-x,p.sy-y)<16);
  const deco=[];let tries=0;
  px.filter(p=>p.k==='mine').forEach(p=>{const a=rd()*6.28;deco.push([p.sy+Math.sin(a)*13,mtn(p.sx+Math.cos(a)*14,p.sy+Math.sin(a)*13,1.1,true)])});
  while(deco.length<(islands?10:24)&&tries++<600){const x=rd()*W,y=rd()*H;if(onLand(x,y))deco.push([y,rd()<0.55?mtn(x,y,0.7+rd()*0.5,false):tree(x,y)])}
  deco.sort((a,b)=>a[0]-b[0]).forEach(d=>s+=d[1]);
  // 航路：靠海的港口直接出海；內陸的河港沿河流到海口（過了海岸改細虛線），再由海口出海；海上航線匯成一條，從圖框往帝都方向出去（京畿從離帝都最近的圖框邊出海），出口不標字
  let net=null;   // 河流＋航路的路網（商路地圖的船沿著走）
  if(!islands){
    let dx=0,dy=1;
    const isPort=c=>canSea(c);   // 西道每座城都算港口
    const ports=px.filter(p=>isPort(p.c));
    if(ports.length){
      const C=5,GW=Math.ceil(W/C),GH=Math.ceil(H/C),idx=(i,j)=>j*GW+i,M=3,pt=v=>[(v%GW)*C+C/2,Math.floor(v/GW)*C+C/2];
      const land=new Uint8Array(GW*GH);for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const x=i*C+C/2,y=j*C+C/2;if(px.some(q=>Math.hypot(q.sx-x,q.sy-y)<R+11))land[idx(i,j)]=1}
      const ocean=new Uint8Array(GW*GH);{const Q=[];for(let i=0;i<GW;i++)for(const j of [0,GH-1])Q.push(idx(i,j));for(let j=0;j<GH;j++)for(const i of [0,GW-1])Q.push(idx(i,j));
        while(Q.length){const v=Q.pop();if(ocean[v]||land[v])continue;ocean[v]=1;const vi=v%GW,vj=(v-vi)/GW;[[1,0],[-1,0],[0,1],[0,-1]].forEach(([a,b])=>{const ni=vi+a,nj=vj+b;if(ni>=0&&nj>=0&&ni<GW&&nj<GH)Q.push(idx(ni,nj))})}}
      for(let v=0;v<GW*GH;v++)if(!land[v]&&!ocean[v])land[v]=2;   // 內湖：當陸地，河流可以穿過
      const rn_=(list[0]||{}).region_name||'',sf_=UT('map.regionSuffix'),tH=([...UT('map.title',{r:rn_.endsWith(sf_)?rn_.slice(0,-sf_.length):rn_})].length+2)*11+8;
      const busy=(x,y)=>(x<40&&y<tH+30)||(homeReg&&x>W-45&&y>H-45);   // 題簽、落款印附近不放出口
      const cellOf=p=>idx(clamp(Math.floor(p.sx/C),M,GW-M-1),clamp(Math.floor(p.sy/C),M,GH-M-1));
      const heap=()=>{const H_=[];return {n:()=>H_.length,push(d,v){H_.push([d,v]);let k=H_.length-1;while(k>0){const q=(k-1)>>1;if(H_[q][0]<=H_[k][0])break;[H_[q],H_[k]]=[H_[k],H_[q]];k=q}},pop(){const t=H_[0],l=H_.pop();if(H_.length){H_[0]=l;let k=0;for(;;){let a=2*k+1,b=a+1,mn=k;if(a<H_.length&&H_[a][0]<H_[mn][0])mn=a;if(b<H_.length&&H_[b][0]<H_[mn][0])mn=b;if(mn===k)break;[H_[mn],H_[k]]=[H_[k],H_[mn]];k=mn}}return t}}};
      /** 從 s0 找到第一個符合 goal 的格子；cost(u)＝走進 u 的代價。回傳由起點到終點的格子序列。 */
      const route=(s0,goal,cost)=>{const dist=new Float64Array(GW*GH).fill(1e18),prev=new Int32Array(GW*GH).fill(-1),Hh=heap();dist[s0]=0;Hh.push(0,s0);let hit=-1;
        while(Hh.n()){const [d,v]=Hh.pop();if(d>dist[v])continue;if(v!==s0&&goal(v)){hit=v;break}const vi=v%GW,vj=(v-vi)/GW;
          for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){if(!a&&!b)continue;const ni=vi+a,nj=vj+b;if(ni<M||nj<M||ni>=GW-M||nj>=GH-M)continue;const u=idx(ni,nj),w=((a&&b)?1.414:1)*cost(u);if(d+w<dist[u]){dist[u]=d+w;prev[u]=v;Hh.push(d+w,u)}}}
        if(hit<0)return null;const P=[];for(let v=hit;v!==-1;v=prev[v])P.push(v);return P.reverse()};
      const nearSea=v=>{const vi=v%GW,vj=(v-vi)/GW;for(let a=-3;a<=3;a++)for(let b=-3;b<=3;b++){const ni=vi+a,nj=vj+b;if(ni>=0&&nj>=0&&ni<GW&&nj<GH&&!land[idx(ni,nj)])return true}return false};
      // 河流：內陸河港往最近的海走（陸上走、已有河道更便宜，支流自然匯入主流）
      const rNext=new Int32Array(GW*GH).fill(-1),rUsed=new Uint8Array(GW*GH),rStarts=[],mouths=new Set();
      ports.filter(p=>!nearSea(cellOf(p))).sort((a,b)=>a.sx-b.sx).forEach(p=>{
        const s0=cellOf(p),P=route(s0,v=>!land[v]||rUsed[v],u=>land[u]?(rUsed[u]?.5:land[u]===2?.6:1+(px.some(q=>q!==p&&Math.hypot(q.sx-pt(u)[0],q.sy-pt(u)[1])<9)?6:0)):1);
        if(!P)return;for(let k=0;k<P.length-1;k++){rNext[P[k]]=P[k+1];rUsed[P[k]]=1}
        const end=P[P.length-1];if(!land[end])mouths.add(end);rStarts.push({p,s:s0});
      });
      // 海上航線：起點＝靠海的港口與河口
      // 每格海面離陸地幾格（海面寬窄）
      const dLand=new Float32Array(GW*GH).fill(1e9);{const Q=[];for(let v=0;v<GW*GH;v++)if(land[v]){dLand[v]=0;Q.push(v)}
        for(let h=0;h<Q.length;h++){const v=Q[h],vi=v%GW,vj=(v-vi)/GW;for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const ni=vi+a,nj=vj+b;if(ni<0||nj<0||ni>=GW||nj>=GH)continue;const u=idx(ni,nj);if(dLand[u]>dLand[v]+1){dLand[u]=dLand[v]+1;Q.push(u)}}}}
      const coast=new Uint8Array(GW*GH);for(let v=0;v<GW*GH;v++){const [x,y]=pt(v);if(!land[v]&&px.some(q=>Math.hypot(q.sx-x,q.sy-y)<R+18))coast[v]=1}
      const seaStarts=ports.filter(p=>nearSea(cellOf(p))).map(p=>({s:cellOf(p),p})).concat([...mouths].map(v=>({s:v,p:null})));
      // 出口：從各港口、河口一起往外走（同航路的代價），挑「走得近」又「海面寬」的圖框邊；離陸地每多一格（最多十格）抵六格航程
      const seaCost=u=>land[u]?14:coast[u]?4:1;
      const dSea=new Float64Array(GW*GH).fill(1e18);{const Hh=heap();seaStarts.forEach(o=>{dSea[o.s]=0;Hh.push(0,o.s)});
        while(Hh.n()){const [d,v]=Hh.pop();if(d>dSea[v])continue;const vi=v%GW,vj=(v-vi)/GW;
          for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){if(!a&&!b)continue;const ni=vi+a,nj=vj+b;if(ni<M||nj<M||ni>=GW-M||nj>=GH-M)continue;const u=idx(ni,nj),w=((a&&b)?1.414:1)*seaCost(u);if(d+w<dSea[u]){dSea[u]=d+w;Hh.push(d+w,u)}}}}
      const E0=(()=>{let best=null;for(let j=M;j<GH-M;j++)for(let i=M;i<GW-M;i++){if(!(i===M||j===M||i===GW-M-1||j===GH-M-1))continue;const v=idx(i,j);if(land[v]||dSea[v]>=1e17)continue;if(busy(i*C+C/2,j*C+C/2))continue;
        const sc=dSea[v]-6*Math.min(dLand[v],10);if(!best||sc<best[0])best=[sc,v]}return best?best[1]:idx(M,M)})();
      const sNext=new Int32Array(GW*GH).fill(-1),sUsed=new Uint8Array(GW*GH),cnt=new Uint16Array(GW*GH);sUsed[E0]=1;
      const [exi,exj]=[E0%GW,Math.floor(E0/GW)];
      seaStarts.sort((a,b)=>Math.hypot(a.s%GW-exi,Math.floor(a.s/GW)-exj)-Math.hypot(b.s%GW-exi,Math.floor(b.s/GW)-exj));
      {const i=E0%GW,j=Math.floor(E0/GW);dx=i===M?-1:i===GW-M-1?1:0;dy=dx?0:(j===M?-1:1)}   // 出口外推方向＝所在圖框邊的外側
      const lanes=[];
      seaStarts.forEach(o=>{const P=route(o.s,v=>!!sUsed[v],u=>(land[u]?14:coast[u]?4:1)*(sUsed[u]?.35:1));if(!P)return;for(let k=0;k<P.length-1;k++){sNext[P[k]]=P[k+1];sUsed[P[k]]=1}lanes.push(o)});
      lanes.forEach(o=>{for(let v=o.s;v!==-1;v=sNext[v]){cnt[v]++;if(v===E0)break}});
      const rc=new Uint16Array(GW*GH);rStarts.forEach(o=>{for(let v=o.s;v!==-1;v=rNext[v]){rc[v]++;if(!land[v])break}});
      const chainsOf=(starts,next,count,stop,tail)=>{const seen=new Set(),out=[];
        starts.forEach(o=>{let v=o.s,cur=[o.p?[o.p.sx,o.p.sy]:pt(v)],c=count[v];
          while(v!==-1){const c2=count[v];if(c2!==c){cur.push(pt(v));out.push({pts:cur,c});if(seen.has(v)){cur=null;break}cur=[pt(v)];c=c2}seen.add(v);cur.push(pt(v));if(stop(v))break;v=next[v]}
          if(cur&&cur.length>1){if(tail)tail(v,cur);out.push({pts:cur,c})}});return out};
      const smooth=(P,wig)=>{const Q=P.filter((q,k)=>k===0||k===P.length-1||k%3===0).map((q,k,A)=>{if(!wig||k===0||k===A.length-1)return q;const a=A[k-1],b=A[k+1],ux=b[0]-a[0],uy=b[1]-a[1],L=Math.hypot(ux,uy)||1,o=(k%2?1:-1)*wig;return [q[0]-uy/L*o,q[1]+ux/L*o]});
        let d='M'+Q[0][0].toFixed(1)+' '+Q[0][1].toFixed(1);for(let k=1;k<Q.length-1;k++){const mx=(Q[k][0]+Q[k+1][0])/2,my=(Q[k][1]+Q[k+1][1])/2;d+='Q'+Q[k][0].toFixed(1)+' '+Q[k][1].toFixed(1)+' '+mx.toFixed(1)+' '+my.toFixed(1)}const z=Q[Q.length-1];return d+'L'+z[0].toFixed(1)+' '+z[1].toFixed(1)};
      const SEA2='#2f5a7a',RIV='#7fa3b4',RIVE='#4d6f80';
      // 路網：每格往下游（河）或往出口（航路）的下一格；兩城之間＝各自往下游走到第一個交會點
      {const par=v=>sNext[v]>=0?sNext[v]:rNext[v],up=v=>{const L=[],seen=new Set();while(v>=0&&!seen.has(v)){L.push(v);seen.add(v);if(v===E0)break;v=par(v)}return L};
        const out=[pt(E0)[0]+dx*24,pt(E0)[1]+dy*24];
        const mk=P=>{const Q=P.filter((q,k)=>k===0||k===P.length-1||k%2===0);let len=0;for(let k=1;k<Q.length;k++)len+=Math.hypot(Q[k][0]-Q[k-1][0],Q[k][1]-Q[k-1][1]);return {d:'M'+Q.map(q=>q[0].toFixed(1)+' '+q[1].toFixed(1)).join('L'),len}};
        net={path(a,b){const A=up(cellOf(a));if(!A.length)return null;
          if(!b){if(A[A.length-1]!==E0)return null;return mk([[a.sx,a.sy],...A.map(pt),out])}
          const ia=new Map(A.map((v,k)=>[v,k])),B=up(cellOf(b));let k=0;while(k<B.length&&!ia.has(B[k]))k++;if(k>=B.length)return null;
          return mk([[a.sx,a.sy],...A.slice(0,ia.get(B[k])+1).map(pt),...B.slice(0,k).reverse().map(pt),[b.sx,b.sy]])}};}
      // 河流（先畫，在道路與城市底下）
      const onL=q=>px.some(c=>Math.hypot(c.sx-q[0],c.sy-q[1])<R+7);   // 畫面上的陸地範圍（含海岸線抖動）
      chainsOf(rStarts,rNext,rc,v=>!land[v]).forEach(ch=>{const w=1.6+.5*Math.min(4,ch.c-1);
        const runs=[];ch.pts.forEach((q,k)=>{const l=onL(q),r=runs[runs.length-1];if(!r||r.l!==l){const nr={l,pts:r?[r.pts[r.pts.length-1]]:[]};runs.push(nr)}runs[runs.length-1].pts.push(q)});
        runs.forEach(r=>{if(r.pts.length<2)return;
          if(r.l){const d=smooth(r.pts,2.2);s+='<path d="'+d+'" fill="none" stroke="'+RIVE+'" stroke-width="'+(w+1.1).toFixed(1)+'" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/><path d="'+d+'" fill="none" stroke="'+RIV+'" stroke-width="'+w.toFixed(1)+'" stroke-linecap="round" stroke-linejoin="round"/>'}
          else s+='<path d="'+smooth(r.pts,0)+'" fill="none" stroke="'+SEA2+'" stroke-width=".8" stroke-dasharray="3 2.2" stroke-linecap="round" opacity=".9"/>'})});
      // 海上航線
      chainsOf(lanes,sNext,cnt,v=>v===E0,(v,cur)=>{if(v===E0){const [x,y]=pt(E0);cur.push([x+dx*20,y+dy*20])}}).forEach(ch=>{const w=Math.min(2,.8+.3*(ch.c-1));
        s+='<path d="'+smooth(ch.pts,0)+'" fill="none" stroke="'+SEA2+'" stroke-width="'+w.toFixed(2)+'" stroke-dasharray="'+(ch.c>1?'5 2.5':'3 2.2')+'" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>'});
      
    }
  }
  // 道路／海路
  const E=mapEdges(pts,islands);
  E.forEach(e=>{const a=px[e[0]],b=px[e[1]];const mx=(a.sx+b.sx)/2+(rd()-0.5)*8,my=(a.sy+b.sy)/2+(rd()-0.5)*8;
    const dpath='M'+a.sx+' '+a.sy+'Q'+mx.toFixed(1)+' '+my.toFixed(1)+' '+b.sx+' '+b.sy;
    if(islands)s+='<path d="'+dpath+'" fill="none" stroke="#2f5a7a" stroke-width=".9" stroke-dasharray="3 2.2" stroke-linecap="round" opacity=".9"/>';
    else s+='<path d="'+dpath+'" fill="none" stroke="'+RED+'" stroke-width="'+1+'" stroke-linecap="round"/><path d="'+dpath+'" fill="none" stroke="'+LAND+'" stroke-width=".5" stroke-dasharray="1 5" stroke-linecap="round" opacity=".0"/>';
    if(!islands){const L=Math.hypot(b.sx-a.sx,b.sy-a.sy),n=Math.floor(L/22);for(let i=1;i<=n;i++){const t=i/(n+1),qx=(1-t)*(1-t)*a.sx+2*(1-t)*t*mx+t*t*b.sx,qy=(1-t)*(1-t)*a.sy+2*(1-t)*t*my+t*t*b.sy;s+='<circle cx="'+qx.toFixed(1)+'" cy="'+qy.toFixed(1)+'" r=".8" fill="'+INK+'"/>'}}
  });
  // 南海的出海航路：挑一座島，從它拉一條虛線到圖框邊；挑法同其他地區（航程近、海面寬），出口附近不能是題簽或落款印
  if(islands&&px.length){
    const rn_=(list[0]||{}).region_name||'',sf_=UT('map.regionSuffix'),tH=([...UT('map.title',{r:rn_.endsWith(sf_)?rn_.slice(0,-sf_.length):rn_})].length+2)*11+8,m=15;
    const busy=(x,y)=>(x<40&&y<tH+30)||(homeReg&&x>W-45&&y>H-45);
    let best=null;
    for(let t=m;t<=W-m;t+=5)for(const y of [m,H-m])cand(t,y);
    for(let t=m;t<=H-m;t+=5)for(const x of [m,W-m])cand(x,t);
    function cand(x,y){if(busy(x,y))return;const open=Math.min(...px.map(q=>Math.hypot(q.sx-x,q.sy-y)));
      px.forEach((q,i)=>{const sc=Math.hypot(q.sx-x,q.sy-y)/5-6*Math.min((open-R)/5,10);if(!best||sc<best[0])best=[sc,i,x,y]})}
    if(best){const [,ei,ex,ey]=best,q=px[ei],ul=Math.hypot(ex-q.sx,ey-q.sy)||1,out=[ex+(ex-q.sx)/ul*24,ey+(ey-q.sy)/ul*24];   // 沿同一方向直直出框
      s+='<path d="M'+q.sx+' '+q.sy+'L'+out[0].toFixed(1)+' '+out[1].toFixed(1)+'" fill="none" stroke="#2f5a7a" stroke-width=".9" stroke-dasharray="3 2.2" stroke-linecap="round" opacity=".9"/>';
      // 往外地的船：沿島間海路走到出海的那座島，再出海
      net={path(a,b){if(b)return null;const ai=px.indexOf(a);if(ai<0)return null;
        const n=px.length,dist=Array(n).fill(1e9),prev=Array(n).fill(-1),done=Array(n).fill(false),adj=px.map(()=>[]);
        E.forEach(([i,j])=>{const w=Math.hypot(px[i].sx-px[j].sx,px[i].sy-px[j].sy);adj[i].push([j,w]);adj[j].push([i,w])});
        dist[ai]=0;for(let t=0;t<n;t++){let u=-1;for(let i=0;i<n;i++)if(!done[i]&&(u<0||dist[i]<dist[u]))u=i;if(u<0||dist[u]>=1e9)break;done[u]=true;adj[u].forEach(([v,w])=>{if(dist[u]+w<dist[v]){dist[v]=dist[u]+w;prev[v]=u}})}
        const P=[];if(dist[ei]<1e9)for(let v=ei;v>=0;v=prev[v])P.unshift([px[v].sx,px[v].sy]);else P.push([a.sx,a.sy],[q.sx,q.sy]);
        P.push([ex,ey],out);let len=0;for(let k=1;k<P.length;k++)len+=Math.hypot(P[k][0]-P[k-1][0],P[k][1]-P[k-1][1]);
        return {d:'M'+P.map(z=>(+z[0]).toFixed(1)+' '+(+z[1]).toFixed(1)).join('L'),len}}};
    }
  }
  // 城市
  if(opts.under)s+=opts.under({px,E,W,H,rid,net});       // 商路地圖：航線（07qa_routemap.js）
  // 名牌位置：圖示與已放的名牌都不能疊到（座標一律用圖面座標）；題簽也要避開
  const rn0=(list[0]||{}).region_name||'',sf0=UT('map.regionSuffix'),titleH=([...UT('map.title',{r:rn0.endsWith(sf0)?rn0.slice(0,-sf0.length):rn0})].length+2)*11+8;
  const placed=px.map(p=>[p.sx-8,p.sy-11,p.sx+8,p.sy+8]).concat([[11,11,30,15+titleH]]);
  const hit=r=>placed.some(q=>r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1]);
  const inside=r=>r[0]>=9&&r[1]>=9&&r[2]<=W-9&&r[3]<=H-9;
  px.slice().sort((a,b)=>cityPop(b.c)-cityPop(a.c)).forEach(p=>{
    const cx=p.sx,cy=p.sy,home=opts.home===p.c.id,sel=opts.sel===p.c.id;
    let g='<g data-act="'+(opts.act||'mapCity')+'" data-cid="'+p.c.id+'" style="cursor:pointer">';
    g+='<circle cx="'+cx+'" cy="'+cy+'" r="11" fill="transparent"/>';
    if(home)g+='<circle cx="'+cx+'" cy="'+cy+'" r="8.5" fill="'+RED+'" opacity=".22"/><circle cx="'+cx+'" cy="'+cy+'" r="8.5" fill="none" stroke="'+RED+'" stroke-width="1"/>';
    if(sel)g+='<circle cx="'+cx+'" cy="'+cy+'" r="10.5" fill="none" stroke="'+INK+'" stroke-width=".8" stroke-dasharray="2 1.5"/>';
    const big=cityPop(p.c)>200000;
    if(p.k==='admin'){const k=big?1.25:1;g+='<g transform="translate('+cx+' '+cy+') scale('+k+')" stroke="'+INK+'" stroke-width=".7" stroke-linejoin="round"><path d="M-6 5H6L5 0H-5Z" fill="#6f6f6a"/><rect x="-4.2" y="-3" width="8.4" height="3.2" fill="#fbf6e4"/><path d="M-5.8 -3L0 -8L5.8 -3Z" fill="#37424a"/><rect x="-2.2" y="-6.2" width="4.4" height="3" fill="#fbf6e4"/><path d="M-3.4 -6L0 -10.5L3.4 -6Z" fill="#37424a"/></g>'}
    else if(p.k==='mine')g+='<g transform="translate('+cx+' '+cy+')" stroke="'+INK+'" stroke-width=".7" stroke-linejoin="round"><path d="M-7 4L-2 -5L1 -1L4 -7L8 4Z" fill="#8a7f6a"/><path d="M-3 4L-1 0M4 -7L3 -2L6 4M1 -1L2 4" fill="none" stroke-width=".5"/><circle cx="-5.5" cy="-2.5" r="1" fill="#e0b73c" stroke-width=".4"/></g>';
    else if(p.k==='port')g+='<g transform="translate('+cx+' '+cy+')" stroke="'+INK+'" stroke-width=".7" stroke-linejoin="round"><path d="M-6 1H6L4 5H-4Z" fill="#8a5a33"/><path d="M0 1V-8M0 -8L5 -1H0Z" fill="#fbf6e4"/><path d="M-1 -8L-1 -10" fill="none"/><path d="M-7 7q1.7 -1.6 3.5 0t3.5 0t3.5 0t3.5 0" fill="none" stroke="'+WASH+'" stroke-width=".8"/></g>';
    else if(p.k==='land')g+='<g transform="translate('+cx+' '+cy+')" stroke="'+INK+'" stroke-width=".8" stroke-linejoin="round"><path d="M-6 5V-3M6 5V-3" fill="none" stroke-width="1.4"/><path d="M-8 -3H8L7 -5.2H-7Z" fill="'+RED+'"/><path d="M-5.5 0H5.5" fill="none" stroke-width=".9"/></g>';
    else g+='<g transform="translate('+cx+' '+cy+')" stroke="'+INK+'" stroke-width=".7" stroke-linejoin="round"><path d="M-6 2L0 -5L6 2Z" fill="#c89e52"/><rect x="-4" y="2" width="8" height="3.6" fill="#fbf6e4"/><path d="M-8 7H8M-8 9.2H8" stroke="#7d8f4b" stroke-width=".8" fill="none"/></g>';
    // 直書名牌
    const lab=p.c.name.slice(0,2),fs=8.6,w=fs+4.6,h=fs*2+5.4;
    const cand=[[cx+10,cy-h/2],[cx-10-w,cy-h/2],[cx-w/2,cy-12-h+2],[cx-w/2,cy+9],[cx+10,cy-h-1],[cx+10,cy+1],[cx-10-w,cy-h-1],[cx-10-w,cy+1]];
    [6,12,18,26].forEach(d=>cand.push([cx+10+d,cy-h/2],[cx-10-w-d,cy-h/2],[cx-w/2,cy-10-h-d],[cx-w/2,cy+9+d],[cx+10+d,cy-h-1-d/2],[cx-10-w-d,cy-h-1-d/2],[cx+10+d,cy+1+d/2],[cx-10-w-d,cy+1+d/2]));
    const rr=c=>[c[0],c[1],c[0]+w,c[1]+h];
    let pick=cand.find(c=>inside(rr(c))&&!hit(rr(c)))||cand.find(c=>!hit(rr(c)))||cand[0];
    placed.push(rr(pick));const [lx,ly]=pick;
    g+='<rect x="'+(lx+.7).toFixed(1)+'" y="'+(ly+.7).toFixed(1)+'" width="'+w+'" height="'+h+'" fill="#6b4a1f" opacity=".25"/>';
    g+='<rect x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'" width="'+w+'" height="'+h+'" fill="'+(home?'#fde3d6':'#fbf4dc')+'" stroke="'+(home?RED:INK)+'" stroke-width=".8"/>';
    g+=[...lab].map((ch,i)=>'<text x="'+(lx+w/2).toFixed(1)+'" y="'+(ly+3.4+fs*(i+0.82)+i*0.4).toFixed(1)+'" text-anchor="middle" font-size="'+fs+'" font-weight="bold" fill="'+(home?RED:INK)+'">'+esc(ch)+'</text>').join('');
    s+=g+'</g>'});
  if(opts.over)s+=opts.over({px,E,W,H,rid,net});         // 商路地圖：示意船、馬（07qa_routemap.js）
  // 紙質、暈邊
  s+='<rect width="'+W+'" height="'+H+'" filter="url(#pap'+id+')" style="pointer-events:none"/><rect width="'+W+'" height="'+H+'" fill="url(#vg'+id+')" style="pointer-events:none"/>';
  // 外框
  s+='<rect x="3" y="3" width="'+(W-6)+'" height="'+(H-6)+'" fill="none" stroke="'+INK+'" stroke-width="2.2"/><rect x="7" y="7" width="'+(W-14)+'" height="'+(H-14)+'" fill="none" stroke="'+INK+'" stroke-width=".6"/>';
  // 題簽（直書）
  const reg=(list[0]||{}).region_name||'',sfx_=UT('map.regionSuffix'),title=UT('map.title',{r:reg.endsWith(sfx_)?reg.slice(0,-sfx_.length):reg}),tl=[...title];
  const tw=15,th=(tl.length+2)*11+8,pitch=(th-8)/tl.length;   // 框高照舊（原題名多「繪圖」兩字），字距加大、平均填滿框
  s+='<g><rect x="13" y="13" width="'+tw+'" height="'+th+'" fill="#f7efd2" stroke="'+INK+'" stroke-width="1"/><rect x="15" y="15" width="'+(tw-4)+'" height="'+(th-4)+'" fill="none" stroke="'+RED+'" stroke-width=".6"/>'
   +tl.map((ch,i)=>'<text x="'+(13+tw/2)+'" y="'+(17+pitch*(i+0.5)).toFixed(1)+'" dominant-baseline="central" text-anchor="middle" font-size="11.5" font-weight="bold" fill="'+INK+'">'+esc(ch)+'</text>').join('')+'</g>';
  // 落款印：只畫在本店所在地區
  if(homeReg)s+='<g><rect x="'+(W-27)+'" y="'+(H-27)+'" width="15" height="15" fill="'+RED+'" opacity=".9"/><text x="'+(W-19.5)+'" y="'+UT('map2.regionMapSvg.3',{a:H-22,b:W-19.5})+'" y="'+UT('map2.regionMapSvg.4',{a:H-14.6});
  return s+'</svg>';
}

/* ═════ [07qa_routemap] ═════ */
/* =====================================================================
 * 07qa_routemap.js — 商路頁的地圖
 *  - 五地區縮圖：手繪感的地區輪廓（照各城相對位置疊出），只畫海運航線：本店 → 其他地區的主城。
 *    有該地區泊位許可＝實線，沒有＝淡虛線。點地區展開該地區的城市圖（regionMapSvg）。
 *  - 城市圖：馬沿街道走；船沿地圖上的河流與航路走（南海沿島間海路）；往外地的船併成一艘，沿航路往出口來回。不另畫航線。
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
/** 城市圖疊加層：示意船與馬（畫在城市與名牌底下）。馬沿街道走；船沿河流與航路走（南海沿島間海路）；往外地的船沿航路往出口來回。 */
let rmapSeq=0;   // 路線 path 的 id 流水號（同一頁不重複）
function rmapOver(ctx){
  const home=homeCity();if(ctx.rid!==home.region_id)return '';
  const px=ctx.px,hi=px.findIndex(p=>p.c.id===home.id);if(hi<0)return '';
  const groups=rmapGroups(),hp=px[hi];let s='';
  const mover=(key,cv,dx,icon)=>{const id='rm'+(++rmapSeq)+'_'+key.replace(/[^\w]/g,'_');s+='<path id="'+id+'" d="'+cv.d+'" fill="none" stroke="none"/>'+rmapMover(id,cv.len,dx,icon,key)};
  // 往外地的船：全部併成一艘，沿航路駛向出口、出了圖框再回來（南海先沿島間海路到出海的那座島）
  if(Object.keys(groups).some(k=>k[0]==='R')){
    let cv=ctx.net&&ctx.net.path(hp,null);
    if(!cv){const W=ctx.W,H=ctx.H,c=[[-20,hp.sy,hp.sx],[W+20,hp.sy,W-hp.sx],[hp.sx,-20,hp.sy],[hp.sx,H+20,H-hp.sy]].sort((a,b)=>a[2]-b[2])[0];cv=rmapCurve([hp.sx,hp.sy],[c[0],c[1]],'out'+home.id)}
    mover('X',cv,1,RMAP_BOAT);
  }
  Object.keys(groups).forEach(k=>{
    const mode=k[0],id=k.slice(1),di=px.findIndex(p=>p.c.id===id);if(di<0||mode==='R')return;
    const dx=px[di].sx-hp.sx;
    if(mode==='S'&&ctx.rid!=='reg_south'){mover(k,(ctx.net&&ctx.net.path(hp,px[di]))||rmapCurve([hp.sx,hp.sy],[px[di].sx,px[di].sy],'in'+id),dx,RMAP_BOAT);return}
    const path=rmapRoadPath(px,ctx.E,hi,di);let d='',len=0;
    path.forEach((i,j)=>{d+=(j?'L':'M')+px[i].sx+' '+px[i].sy;if(j)len+=Math.hypot(px[i].sx-px[path[j-1]].sx,px[i].sy-px[path[j-1]].sy)});
    mover(k,{d,len},dx,mode==='S'?RMAP_BOAT:RMAP_HORSE);
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
  h+=regionMapSvg(rid,{home:G.cityId,sel,act:'rmapCity',under:x=>rmapOver(x)});   // 船馬畫在城市與名牌底下，經過時不會蓋住城名
  h+='<div class="tiny muted" style="text-align:center;margin-top:3px">'+UT('rmap.hint2')+'</div></div>';
  if(sel)h+=cityLine(CITY(sel));
  return h;
}
ACT.rmapReg=el=>{UI.s.rmap=el.dataset.id;UI.s.rmapSel=null;renderRoutes();sfx.tap()};
ACT.rmapBack=()=>{UI.s.rmap=null;UI.s.rmapSel=null;renderRoutes();sfx.tap()};
ACT.rmapCity=el=>{const id=el.dataset.cid;UI.s.rmapSel=UI.s.rmapSel===id?null:id;UI.s.wikiOpen=UI.s.wikiOpen||{};UI.s.wikiOpen['c'+id]=true;renderRoutes();sfx.tap()};
ACT.rmapShip=el=>{
  const k=el.dataset.k,G_=rmapGroups(),L=k==='X'?Object.keys(G_).filter(q=>q[0]==='R').flatMap(q=>G_[q]):(G_[k]||[]);if(!L.length)return;
  const place=k==='X'?UT('rmap.abroad'):k[0]==='R'?UT('rmap.reg.'+k.slice(1)):CITY(k.slice(1)).name;
  UI.showInfo(UT('rmap.shipTitle',{a:place}),L.map(s=>'<div class="card small">'+UT(s.out?'rmap.shipRowOut':'rmap.shipRow',{n:esc(s.captName||''),c:esc(CITY(s.origId).name),t:s.eta})+'</div>').join(''));
};

/* ═════ [07r_silver] ═════ */
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
  const up=pts[n-1].v>=pts[0].v,col=up?'#b3261e':'#1e7e34';
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
    h+='<div class="row tiny" style="margin-top:2px'+(left<=2?';color:#b3392b':'')+'"><span>'+esc(who)+(d.kind?UT('silver.debtCard.2',{a:esc(debtKindName(d.kind))}):'')+'</span><b style="white-space:nowrap;margin-left:6px">'+UT('silver.debtCard.5',{a:fmt(d.amt),b:left?UT('silver.debtCard.3',{a:left}):UT('silver.debtCard.4')})+'</b></div>';
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
