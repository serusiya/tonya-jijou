'use strict';
/* ★檔案總覽：地區官制（遠國奉行所）與海運、陸運許可
 * - 在各城官署之上多一級「地區官府」（官制資料見 officials.json 的 region 系統，10 個江戶風職位）。
 * - 海路許可＝每個地區各自的「進港泊位許可」（津口番所役核發；船奉行的朱印狀＝全地區通用；遠國奉行的通商特許＝該地區海陸皆通）。
 * - 陸路許可＝本地區的「關所通行手形」（關所番頭核發；道中奉行的通行狀＝通用、航程 −1）。
 * - 其餘請託：驛馬優先、產地買付便宜、船手護送、雜費減免狀、請巡見使美言。中央巡見使巡視時，風聲太緊會吊銷許可。
 * - 狀態：G.permits={sea:{regId|all:true},land:{…}}；G.flags.horse/escort/taxfree/cheap（剩餘旬數）、road/charter。 */
/** 全部地區（id、名稱）。 */
const REG_LIST=[...new Map(CITIES.map(c=>[c.region_id,{id:c.region_id,name:c.region_name}])).values()];
const REG_NAME=id=>{const r=REG_LIST.find(x=>x.id===id);return r?r.name:id};
/** 地區首府＝該地區人口最多的城市。 */
function capitalOf(regId){return CITIES.filter(c=>c.region_id===regId).sort((a,b)=>cityPop(b)-cityPop(a))[0]}
/** 為每個地區排好 10 位地區官員（冊內官吏型人物優先同鄉）。W＝{npcs}，used＝已用 id 集合，pool＝候選人。 */
function addRegionOfficials(W,used,pool){
  const poss=OFFICIALS.systems.region.positions;
  REG_LIST.forEach(rg=>{
    const cap=capitalOf(rg.id);
    poss.forEach(p=>{
      let c=pool.filter(x=>!used.has(x.id)&&hasRole(x,'official'));
      const old=c.filter(x=>x.birth_year<=-30||x.birth_year<=(G&&G.year?G.year-30:-30));if(old.length)c=old;
      c=shuffle(c).sort((a,b)=>(b.native_region===rg.name)-(a.native_region===rg.name));
      const o=c[0];if(!o)return;used.add(o.id);
      W.npcs[o.id]={cid:o.id,cityId:cap.id,role:'official',pos:{court:'region',rank:p.rank,posId:p.id}};
    });
  });
}
/* ---------- 許可 ---------- */
function permitsOf(){return G.permits||(G.permits={sea:{},land:{}})}
function seaPermitFor(ct){const P=permitsOf().sea;return !!(P.all||P[ct.region_id])}
function anySea(){const P=permitsOf().sea;return !!(P.all||Object.keys(P).length)}
function landPermit(){const P=permitsOf().land;return !!(P.all||P[homeCity().region_id])}
function grantSea(regId){permitsOf().sea[regId]=true}
function grantLand(regId){permitsOf().land[regId]=true}
function permitSummary(){
  const P=permitsOf(),s=P.sea.all?'全地區':Object.keys(P.sea).map(REG_NAME).join('、')||'無';
  const l=P.land.all?'通用':Object.keys(P.land).map(REG_NAME).join('、')||'無';
  return {sea:s,land:l};
}
/* ---------- 請託項目 ---------- */
const REG_FAVORS=[
  {k:'rpass',apply:true,name:'陸運通行手形',rank:3,once:true,pos:['reg_01'],desc:'馬幫可通行本地區關所。'},
  {k:'rport',apply:true,name:'海運泊位許可',rank:3,once:true,pos:['reg_02'],desc:'船隊可進本地區各港。'},
  {k:'rhorse',name:'驛馬優先',rank:3,cd:12,pos:['reg_03'],desc:'十二旬內陸運航程少 1 旬。'},
  {k:'rcheap',name:'產地買付便宜',rank:4,cd:12,pos:['reg_04'],desc:'十二旬內出發的採買，買價再低一成。'},
  {k:'rescort',name:'船手組護送',rank:4,cd:12,pos:['reg_05'],desc:'十二旬內出發的海運，遇險率減半。'},
  {k:'rtax',name:'勘定所雜費減免狀',rank:4,cd:12,pos:['reg_06'],desc:'十二旬內出發的採買，雜費減半。'},
  {k:'rroad',apply:true,name:'五街道通行狀',rank:5,once:true,pos:['reg_07'],desc:'各地區陸路通用，陸運航程永久少 1 旬。'},
  {k:'rshuin',apply:true,name:'朱印狀',rank:5,once:true,pos:['reg_08'],desc:'船隊可前往任何地區。'},
  {k:'rcharter',apply:true,name:'地區通商特許狀',rank:6,once:true,pos:['reg_09'],desc:'本地區海陸許可一併發給，採買雜費永久再省一成。'},
  {k:'rvisit',name:'請巡見使美言',rank:6,cd:12,pos:['reg_10'],desc:'巡見使替你說好話，風聲大減。'}
];
FAVORS.region=REG_FAVORS;
const regOfNpc=n=>CITY(n.cityId).region_id;
/** 一次性許可是否已持有。 */
function regionHeld(key,n){
  const P=permitsOf(),rid=regOfNpc(n);
  if(key==='rport')return !!(P.sea.all||P.sea[rid]);
  if(key==='rpass')return !!(P.land.all||P.land[rid]);
  if(key==='rshuin')return !!P.sea.all;
  if(key==='rroad')return !!G.flags.road;
  if(key==='rcharter')return (G.flags.charter||0)>=3||(!!P.sea[rid]&&!!P.land[rid]&&(G.flags.charter||0)>=3);
  return false;
}
const REG_FAVOR={
  rpass:n=>{grantLand(regOfNpc(n));return NEWS('regionHeld.1',{REG_NAME:REG_NAME(regOfNpc(n))})},
  rport:n=>{grantSea(regOfNpc(n));return NEWS('regionHeld.2',{REG_NAME:REG_NAME(regOfNpc(n))})},
  rhorse:()=>{G.flags.horse=12;return '驛馬優先：十二旬內陸運航程少 1 旬。'},
  rcheap:()=>{G.flags.cheap=12;return '郡代點頭：十二旬內出發的採買，買價低一成。'},
  rescort:()=>{G.flags.escort=12;return '船手組答應護送：十二旬內出發的海運，遇險率減半。'},
  rtax:()=>{G.flags.taxfree=12;return '勘定所發下雜費減免狀：十二旬內出發的採買，雜費減半。'},
  rroad:()=>{G.flags.road=true;permitsOf().land.all=true;return '得到五街道通行狀：陸路通行無阻，陸運航程永久少 1 旬。'},
  rshuin:()=>{permitsOf().sea.all=true;return '船奉行發下朱印狀！你的船隊可前往任何地區的港口。'},
  rcharter:n=>{const rid=regOfNpc(n);grantSea(rid);grantLand(rid);G.flags.charter=Math.min(3,(G.flags.charter||0)+1);return NEWS('regionHeld.3',{REG_NAME:REG_NAME(rid)})},
  rvisit:()=>{G.heat=Math.max(0,(G.heat||0)-3);return '巡見使在報告裡替你美言幾句，風聲減輕。'}
};
/* ---------- 每旬：許可效果倒數、巡見使吊銷 ---------- */
function regionTick(log){
  ['horse','escort','taxfree','cheap'].forEach(k=>{if(G.flags[k]>0)G.flags[k]--});
  if((G.heat||0)>=ODDS.regionRevoke.heat&&roll('regionRevoke')){
    const P=permitsOf(),held=[];
    Object.keys(P.sea).forEach(k=>held.push(['sea',k]));Object.keys(P.land).forEach(k=>held.push(['land',k]));
    if(held.length){
      const [m,k]=pick(held);delete P[m][k];
      const fine=Math.round(Math.max(0,G.silver)*0.05);G.silver-=fine;G.heat=Math.max(0,G.heat-2);loseFame('region');
      const t=NEWS('regionTick.1',{sea:(m==='sea'?'海運':'陸運'),k:(k==='all'?'全地區':REG_NAME(k)),fine:fmt(fine)});
      pushNews(t);log.push(t);sfx.bad();
    }
  }
}
/* ---------- 遠國奉行所面板 ---------- */
SHEETS.regional=()=>{
  const home=homeCity(),rid=UI.s.regSel||home.region_id;
  let h=introSel()+appsCard()+'<div class="notice tiny">地區官府位階高於各城官署。<b>海路</b>要取得該地區的進港泊位許可（津口番所役），<b>陸路</b>要本地區的關所通行手形（關所番頭）；更高階的奉行能給你更大的方便（朱印狀、五街道通行狀、通商特許）。風聲太緊時，中央巡見使會吊銷許可。</div>';
  h+='<div style="margin:4px 0">'+REG_LIST.map(r=>'<span class="pill '+(r.id===rid?'on':'')+'" data-act="regSel" data-id="'+r.id+'">'+esc(r.name.slice(0,6))+(r.id===home.region_id?'（本地）':'')+'</span>').join('')+'</div>';
  h+=regLicCard();
  const offs=Object.values(G.world.npcs).filter(n=>n.pos&&n.pos.court==='region'&&regOfNpc(n)===rid&&alive(n.cid)).sort((a,b)=>a.pos.rank-b.pos.rank);
  h+='<div style="margin:4px 0"><button class="pixel-btn btn-sm" data-act="posList">'+UT('btn.posList2')+'</button></div>';
  h+=offs.map(n=>personBlock(n.cid,'yamen')).join('')||'<div class="notice">此地區官府暫無人在任。</div>';
  return {title:'🏯 遠國奉行所·'+REG_NAME(rid),html:h};
};
ACT.regSel=el=>{UI.s.regSel=el.dataset.id;refreshSheet()};

/* ======================= 許可·權利的申請審理 =======================
 * 申請只在拜訪打勝、好感 ≥60 時出現；賄賂已在拜訪戰鬥中付過，不另附。
 * 受理時好感 −20（REQ_AFF.apply），審理旬數：貪官 3 旬、一般與清官 6 旬。 */
/** 官員類型（在官員之間相對比較）：貪欲 ≥85 貪官；貪欲 ≤72 且忠誠 ≥50 清官；其餘一般。 */
function officialKind(n){
  const s=CH(n.cid).derived_stats;
  return s.greed_index>=85?'greedy':(s.greed_index<=72&&s.integrity_loyalty>=50)?'clean':'plain';
}
function appDuration(n){if(n.pos&&n.pos.rank===1)return 1;return officialKind(n)==='greedy'?3:6}   // 一階官員核發的申請一旬完成
function appsList(){return G.apps||(G.apps=[])}
function appName(f,n){return f.name+'（'+nameOf(n.cid)+'）'}
function applyFavor(cid,n,r,f){
  if(favorDone(f,n))return {ok:true,status:'held',msg:MSG(f.lic?'doFavor.licHeld':'doFavor.3')};
  if(favorPending(f))return {ok:true,status:'held',msg:MSG('applyFavor.1')};
  if(appsList().some(a=>a.key===f.k&&a.cid===cid))return {ok:true,status:'held',msg:MSG('applyFavor.1')};
  const A={id:G.turn+'_'+Math.floor(rnd()*1e5),key:f.k,cid,cityId:n.cityId,name:f.name,start:G.turn,rank:n.pos.rank,lic:f.lic,trade:f.trade,state:'wait',left:appDuration(n)};
  r.aff=Math.max(0,r.aff-REQ_AFF.apply);
  const k=officialKind(n),msg=TX(k==='greedy'?'apply.greedyEnough':'apply.plain');
  appsList().push(A);logRel(cid,'遞出申請「'+f.name+'」，好感 -'+REQ_AFF.apply+'。');
  return {ok:true,status:'done',msg:MSG('applyFavor.3',{msg})+'（好感 -'+REQ_AFF.apply+'）'};
}
function appGrant(A,log){
  const n=npc(A.cid)||{cid:A.cid,cityId:A.cityId};
  let msg;
  msg=grantFavorApp(A);
  if(msg===null)msg=REG_FAVOR[A.key](n);
  logRel(A.cid,'申請「'+A.name+'」獲准。');
  const t=NEWS('appGrant.1',{name:A.name,msg});pushNews(t);log.push(t);sfx.fanfare();
}
/** 每旬：審理倒數，到期獲准。 */
function appsTick(log){
  const L=appsList();
  L.forEach(A=>{
    if(A.state==='wait'){A.left--;if(A.left<=0){A.done=true;appGrant(A,log)}}
  });
  G.apps=L.filter(a=>!a.done);
}
function appsCard(){
  const L=appsList();if(!L.length)return '';
  return '<div class="card"><b class="small">📬 申請案件</b>'+L.map(A=>{
    return '<div class="row small" style="margin-top:4px"><span>'+esc(A.name)+'<div class="tiny muted">'+esc(nameOf(A.cid))+'·審理中，剩 <b>'+A.left+'</b> 旬</div></span></div>';
  }).join('')+'</div>';
}
