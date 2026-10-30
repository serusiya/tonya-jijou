'use strict';
/* ★檔案總覽：筆記內的「百科」分頁（線上遊戲百科全書）
 * - 玩法簡介、官吏架構、地區城市與物產、物產圖鑑；內容多半取自資料檔（OFFICIALS／CITIES／COMM_INFO），玩法簡介文字在 WIKI_GUIDE。
 * - 筆記頁頂端有「名冊／百科」切換；renderNotes（07_ui_people.js）在百科模式下改呼叫 renderWiki。 */
/* ======================= 07p 百科 ======================= */
const WIKI_SECS=[['guide',UT('wiki.WIKI_SECS')],['office',UT('wiki.WIKI_SECS.2')],['region',UT('wiki.WIKI_SECS.3')],['goods',UT('wiki.WIKI_SECS.4')]];
/** 百科官吏頁的「請託規則」（敘事式，不列公式）。 */
const WIKI_REQ=UT('wiki.WIKI_REQ');
/** 玩法簡介：[標題, 內文 HTML]（敘事式說明，不列公式）。 */
const WIKI_GUIDE=[
  [UT('wiki.WIKI_GUIDE'),UT('wiki.WIKI_GUIDE.2')],
  [UT('wiki.WIKI_GUIDE.3'),UT('wiki.WIKI_GUIDE.4')],
  [UT('wiki.WIKI_GUIDE.5'),UT('wiki.WIKI_GUIDE.6')],
  [UT('wiki.WIKI_GUIDE.7'),UT('wiki.WIKI_GUIDE.8')],
  [UT('wiki.WIKI_GUIDE.9'),UT('wiki.WIKI_GUIDE.10')],
  [UT('wiki.WIKI_GUIDE.11'),UT('wiki.WIKI_GUIDE.12')],
  [UT('wiki.WIKI_GUIDE.13'),UT('wiki.WIKI_GUIDE.14')],
  [UT('wiki.WIKI_GUIDE.15'),UT('wiki.WIKI_GUIDE.16')],
  [UT('wiki.WIKI_GUIDE.17'),UT('wiki.WIKI_GUIDE.18')],
  [UT('wiki.WIKI_GUIDE.19'),UT('wiki.WIKI_GUIDE.20')],
  [UT('wiki.WIKI_GUIDE.21'),UT('wiki.WIKI_GUIDE.22')],
  [UT('wiki.WIKI_GUIDE.23'),UT('wiki.WIKI_GUIDE.24')],
  [UT('wiki.WIKI_GUIDE.25'),UT('wiki.WIKI_GUIDE.26')]
];
/** 筆記頂端的「名冊／百科」切換。 */
function notesTabsHtml(){
  const t=UI.s.notesTab||'book';
  return '<div style="margin-bottom:6px">'+[['book',UT('wiki.notesTabsHtml')],['wiki',UT('wiki.notesTabsHtml.2')]].map(([k,n])=>'<span class="pill '+(t===k?'on':'')+'" data-act="nTab" data-k="'+k+'">'+n+'</span>').join('')+'</div>';
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
  h+=WIKI_GUIDE.map((g,i)=>wikiBox('g'+i,g[0],esc(g[1]))).join('');
  h+=wikiBox('gsys',UT('wiki.wikiGuide'),UT('wiki.wikiGuide.3',{a:SYS.map(s=>'<div style="margin-top:5px"><b>'+esc(s.name)+'</b> <span class="tag gray">'+esc(s.style)+'</span><div class="text-brief">'+UT('wiki.wikiGuide.2',{a:esc(s.tip),b:esc(s.res||s.perk)})+'</div></div>').join('')}));
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
function cityLine(ct){
  const home=ct.id===G.cityId;
  const open=UI.s.wikiOpen&&UI.s.wikiOpen['c'+ct.id];
  let h='<div class="card" style="margin-top:4px;'+(home?'border-color:#9b2c3a':'')+'"><div class="row" data-act="wikiToggle" data-k="c'+ct.id+'" style="cursor:pointer"><div><b>'+esc(ct.name)+'</b>'+(home?UT('wiki.h.2'):'')+' <span class="tag gray">'+UT('wiki.h.3',{a:esc(ct.location_type),b:fmt(cityPop(ct)),c:open?'▲':'▼'})+'</span></div>';
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
  const top=Object.entries(goods).sort((a,b)=>b[1]-a[1]).slice(0,10);
  let h='<div>'+R_.map(x=>'<span class="pill '+(x.id===id?'on':'')+'" data-act="wikiRegion" data-id="'+x.id+'">'+esc(x.name)+'</span>').join('')+'</div>';
  h+='<div class="card" style="margin-top:5px"><b>'+esc(r.name)+'</b> <span class="tag gray">'+UT('wiki.wikiRegion.2',{a:r.cities.length,b:Object.entries(types).map(([k,v])=>esc(typeName[k])+' '+v).join(UT('wiki.wikiRegion'))})+'</div>'+UT('wiki.wikiRegion.3',{a:top.map(([n,v])=>{const c=COMM_MAP[n];return c?'<span class="tag clk" data-act="commInfo" data-n="'+esc(n)+'">'+esc(c.short.slice(0,6))+'</span>':''}).join(' ')})+'</div></div>';
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
    const list=by[s.key]||[];if(!list.length)return;
    const body=list.slice().sort((a,b)=>a.base-b.base).map(c=>{const n=(CITIES.filter(ct=>cityProds(ct).includes(c.name)).length);return '<div class="row tiny" style="margin-top:3px" data-act="commInfo" data-n="'+esc(c.name)+'"><span><span class="tag clk">'+esc(c.short.slice(0,8))+'</span> <span class="tag '+(c.luxury?'gold':c.staple?'green':'gray')+'">'+UT('wiki.body.4',{a:c.kind,b:fmt1(c.base),c:n})}).join('');
    h+=wikiBox('s'+s.key,UT('wiki.wikiGoods',{a:esc(s.name)}),body,UT('wiki.wikiGoods.2',{a:list.length}));
  });
  return h;
}
/** 百科主畫面。 */
function renderWiki(){
  const sec=UI.s.wikiSec||'guide';
  let h='<div class="pixel-box" style="padding:8px">'+UT('wiki.h.5',{a:notesTabsHtml()});
  h+='<div style="margin-top:6px">'+WIKI_SECS.map(([k,n])=>'<span class="pill '+(sec===k?'on':'')+'" data-act="wikiSec" data-k="'+k+'">'+n+'</span>').join('')+'</div>';
  h+='<div style="margin-top:4px">'+({guide:wikiGuide,office:wikiOffice,region:wikiRegion,goods:wikiGoods}[sec]||wikiGuide)()+'</div></div>';
  $('#view-notes').innerHTML=h;
}
