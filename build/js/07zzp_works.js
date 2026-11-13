'use strict';
/* ★檔案總覽：遠國奉行所的大工程（DESIGN_NOTES 第二十九、二百零五、二百五十六節）
 * - 外港開闢（五階 船奉行，rport2）：公款 15,000 兩。從那位船奉行所屬地區裡，挑一座還沒有海運的城（西道、南海各城本來都算港口，不會出現），
 *   成功後那座城永久多了海運（G.cityRoutes[城].sea），陸路保留；地圖、商路、百科照 canSea 自動跟著變。知名度 +10（大事件）。每個地區一次。
 * - 開闢道路（五階 道中奉行，rroad2，只限本地區、南海沒有）：公款 15,000 兩。成功後本地區的陸運一趟運量加倍（capOf），產地可買量跟著加倍；
 *   委託採買、注文、卸留請負的陸運都適用。知名度 +10（大事件）。每個地區一次。原本「打通到其他地區」的設計取消（roadOpen、G.openedRoads 保留不用）。
 * - 國產取立（六階 遠國奉行，rkokusan）：公款 30,000 兩。先挑一樣有交易許可的本業貨；審理通過時，在那個地區隨機一座到得了的城（不含本城、已產這樣貨的城）
 *   新增這項物產（G.devProd，src:'kokusan'），委託採買去那裡能以產地價買到。知名度至少 165，並永久以 165 為最低值。每個地區一次。
 * - 共通：走申請審理（受理時付公款、好感 −20、風聲 +0.1；外地審理加倍）；審理完成時依同一地區同一項工程的次數判定：第一次 40%、第二次 70%、第三次一定成功。
 *   失敗款項不退、冷卻 12 旬；成功後寫進城史。狀態 G.works{port:{地區:城},kokusan:{地區:{city,name}},tries:{鍵:次數},cd:{鍵:旬}}。
 * - 數值 ODDS.works；文字 fav.rport2*、fav.rkokusan*、works.*（01e）；新聞 works.*（01g）。 */
const WK=()=>ODDS.works;
const works=()=>{const W=G.works||(G.works={port:{},kokusan:{},tries:{},cd:{}});W.road=W.road||{};return W};
/** 本地區修好道路：陸運運量倍數（03_market.js 的 capOf）。 */
const roadMult=()=>G&&G.works&&G.works.road&&G.works.road[homeRegion()]?WK().road.mult:1;
const wkKey=(k,rid)=>k+':'+rid;
const wkCool=(k,rid)=>(works().cd[wkKey(k,rid)]||-1)>=G.turn;
/** 外港開闢的候選城：那個地區、本局啟用、還沒有海運的城。 */
const portCands=rid=>CITIES.filter(ct=>ct.region_id===rid&&!canSea(ct));
/** 國產取立：那個地區裡到得了的城（不含本城；港口對港口走海運，或同地區陸路兩旬內）。 */
function kokuCities(rid){const home=homeCity();return CITIES.filter(ct=>ct.region_id===rid&&ct.id!==home.id&&((canSea(home)&&canSea(ct))||canLand(home,ct)))}
/** 國產取立能選的貨：有交易許可的本業貨，而且地區裡還有到得了、還不產它的城。 */
const kokuGoods=rid=>tradeComms().filter(c=>kokuCities(rid).some(ct=>!cityProds(ct).includes(c.name)));
REG_FAVORS.push(
  {k:'rport2',apply:true,rank:5,pos:['reg_08'],avail:n=>{const rid=regOfNpc(n);return !works().port[rid]&&!wkCool('port',rid)&&portCands(rid).length>0}},
  {k:'rroad2',apply:true,rank:5,pos:['reg_07'],local:true,avail:n=>{const rid=regOfNpc(n);return rid!=='reg_south'&&!works().road[rid]&&!wkCool('road',rid)}},
  {k:'rkokusan',apply:true,rank:6,pos:['reg_09'],avail:n=>{const rid=regOfNpc(n);return !works().kokusan[rid]&&!wkCool('kokusan',rid)&&kokuGoods(rid).length>0}}
);
REG_FAVORS.filter(f=>f.k==='rport2'||f.k==='rroad2'||f.k==='rkokusan').forEach(f=>{f.name=UT('fav.'+f.k);f.desc=UT('fav.'+f.k+'.d')});
/* ---------- 先挑對象 ---------- */
FAVOR_PICK.rport2=cid=>{
  const rid=regOfNpc(npc(cid));
  return portraitHtml(cid,56)+'<div class="notice tiny">'+UT('works.portPick',{a:fmt(WK().port.cost)})+'</div>'+portCands(rid).map(ct=>pickRow(cid,'rport2',ct.id,esc(ct.name)+' <span class="tiny muted">'+esc(ct.location_type||'')+'</span>')).join('');
};
FAVOR_PICK.rkokusan=cid=>{
  const rid=regOfNpc(npc(cid));
  return portraitHtml(cid,56)+'<div class="notice tiny">'+UT('works.kokuPick',{a:fmt(WK().kokusan.cost),r:REG_NAME(rid)})+'</div>'+kokuGoods(rid).map(c=>pickRow(cid,'rkokusan',c.name,esc(c.short))).join('');
};
/* ---------- 受理：付公款 ---------- */
{const _af=applyFavor;applyFavor=function(cid,n,r,f,arg){
  if(f&&f.k==='rroad2'){
    if(favorPending(f))return {ok:true,status:'held',msg:MSG('applyFavor.1')};
    if(G.silver<WK().road.cost)return {ok:true,status:'held',msg:MSG('f8.short',{a:fmt(WK().road.cost)})};
    payPublic('spend.works',WK().road.cost);
  }
  if(f&&(f.k==='rport2'||f.k==='rkokusan')){
    const cost=f.k==='rport2'?WK().port.cost:WK().kokusan.cost,rid=regOfNpc(n);
    if(!arg)return {ok:true,status:'held',msg:MSG('works.noPick')};
    if(f.k==='rport2'&&!portCands(rid).some(ct=>ct.id===arg))return {ok:true,status:'held',msg:MSG('works.noPick')};
    if(f.k==='rkokusan'&&!kokuGoods(rid).some(c=>c.name===arg))return {ok:true,status:'held',msg:MSG('works.noPick')};
    if(favorPending(f))return {ok:true,status:'held',msg:MSG('applyFavor.1')};
    if(G.silver<cost)return {ok:true,status:'held',msg:MSG('f8.short',{a:fmt(cost)})};
    payPublic('spend.works',cost);
  }
  return _af.apply(this,arguments);
}}
/* ---------- 審理完成：依次數判定 ---------- */
{const _ag=appGrant;appGrant=function(A,log){
  if(A.key!=='rport2'&&A.key!=='rkokusan'&&A.key!=='rroad2')return _ag.apply(this,arguments);
  const W=works(),port=A.key==='rport2',road=A.key==='rroad2',n=npc(A.cid),rid=n?regOfNpc(n):(CITY(A.cityId)||{}).region_id,k=wkKey(port?'port':road?'road':'kokusan',rid);
  const tries=W.tries[k]||0,ok=rnd()<WK().p[Math.min(tries,WK().p.length-1)];
  let t;
  if(!ok){W.tries[k]=tries+1;W.cd[k]=G.turn+WK().cd-1;t=NEWS(port?'works.portFail':road?'works.roadFail':'works.kokuFail',{r:REG_NAME(rid)});sfx.bad()}
  else if(road){
    W.road[rid]=true;delete W.tries[k];
    const f=addFame(WK().road.fame,'major'),ct=homeCity();
    G.cityHist=G.cityHist||{};(G.cityHist[ct.id]=G.cityHist[ct.id]||[]).push({year:G.year,title:NEWS('works.roadHist',{f:G.firm,r:REG_NAME(rid)})});
    t=NEWS('works.roadOk',{r:REG_NAME(rid),g:fmt1(f)});sfx.fanfare();
  }
  else if(port){
    const ct=CITY(A.arg);
    if(!ct||canSea(ct)){t=NEWS('works.portVoid',{r:REG_NAME(rid)})}
    else{
      G.cityRoutes=G.cityRoutes||{};G.cityRoutes[ct.id]=Object.assign(G.cityRoutes[ct.id]||{},{sea:true});W.port[rid]=ct.id;delete W.tries[k];
      const f=addFame(WK().port.fame,'major');
      G.cityHist=G.cityHist||{};(G.cityHist[ct.id]=G.cityHist[ct.id]||[]).push({year:G.year,title:NEWS('works.portHist',{f:G.firm})});
      t=NEWS('works.portOk',{c:ct.name,r:REG_NAME(rid),g:fmt1(f)});sfx.fanfare();
    }
  }else{
    const c=COMM_MAP[A.arg],L=kokuCities(rid).filter(ct=>!cityProds(ct).includes(A.arg));
    if(!c||!L.length){t=NEWS('works.kokuVoid',{r:REG_NAME(rid)})}
    else{
      const ct=pick(L);G.devProd=G.devProd||[];G.devProd.push({cityId:ct.id,name:c.name,year:G.year,src:'kokusan'});W.kokusan[rid]={city:ct.id,name:c.name};delete W.tries[k];
      raiseFameFloor(WK().kokusan.floor);
      G.cityHist=G.cityHist||{};(G.cityHist[ct.id]=G.cityHist[ct.id]||[]).push({year:G.year,title:NEWS('works.kokuHist',{f:G.firm,g:c.short})});
      t=NEWS('works.kokuOk',{c:ct.name,r:REG_NAME(rid),g:c.short});sfx.fanfare();
    }
  }
  logRel(A.cid,UT('reg.appGrant',{a:A.name}));
  pushNews(t);log.push(t);
}}
