/* ═════ [07zzp_works] ═════ */
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

/* ═════ [07zzq_urge] ═════ */
'use strict';
/* ★檔案總覽：官府督促、御救販售、闇商代出（DESIGN_NOTES 第二百五十、二百五十六節）
 * - 督促（第二百九十六節）：米問屋、魚屋只有打毀督促（36 旬內第二次打毀，普請方四階町年寄出面）；其他行業只有人口督促（季度人口連續三季減少，例會當月在城的吟味方六階出面，G.urge）。
 *   不看市佔、不看協議、不必出席例會。
 * - 傳喚（G.urgeCall）：督促那一旬，旬報一則，主畫面例會按鈕的位置（例會旬在其上）出現紅底金字按鈕；前往扣 1 行動，會場三步：
 *   訓話（交情好被點名說好話）→ 公會長入內細談（高官換一副嘴臉）→ 分配出貨額：你是公會長可全部接下（不加名聲）或分配下去（只拿市佔那一份）；不是公會長一定分到市佔那一份。
 * - 不理（這一旬沒去）：下一旬罰現款四分之一、最低兩千兩（可扣成負數），G.urgePend 九旬期滿時由其他商號解決。去了卻沒選完：照預設分配。
 * - c 御救販售（G.kyusai，kind：pop 人口、riot 平準出貨；pm 收購價倍率；all 公會長全數承接）：每項有缺口的本業貨，每旬數量＝缺口 × 你的市佔（全數承接＝整個缺口），
 *   九旬，立約時固定；照當旬牌價收購，好感 60 以上加兩成、30 以下打八折。交滿：人口小增（+0.6%）或打毀平息（冷卻 12 旬）；交不足：罰款同上，期滿由其他商號解決。
 * - b 闇商代出（G.yami）：人口督促期間拜訪好感 60 以上的闇商人請託（要參加協議）。每項有缺口的本業貨，每旬「穩定供貨線 − 協議配額」（至少 1），到督促結束（最長九旬）。
 *   照當旬牌價九折付私房錢；每旬交貨時擲一次被同業看穿（原暗約的一半），看穿＝違約。
 * - 兩種合約都用定約掛賣的合約格式（07zzm_kake.js 的 pactExtras），交貨順序：掛賣 → 上貢 → 本陣 → 御救販售 → 闇商代出 → 一般出貨。
 *   交出的貨都算進全城供應（加進本旬同業供給 m.so，壓行情、算滿足比例），不算你的出貨。
 * - 數值 ODDS.urge；文字 urge.*、pact.kyusai.*、pact.yami.*（01e）、urge.*（01f／01g）；台詞 LINES.urge。 */
const UG=()=>ODDS.urge;
/** 督促期間（人口督促還在）。 */
const urgeOn=()=>!!(G&&G.urge);
/** 例會當月在城的吟味方六階。 */
function urgeOfficial(){
  return Object.values(G.world.npcs).find(n=>n.pos&&n.pos.court==='judiciary'&&n.pos.rank===6&&n.cityId===G.cityId&&alive(n.cid)&&!jailed(n)&&tourHere(n))||null;
}
/** 舊制公會長推給同業的督促差事（第二百九十五節起不再產生；舊存檔可能還在期限內）。 */
const urgeForced=cid=>!!(G&&G.urge&&G.urge.forced&&G.urge.forced.cid===cid&&G.urge.forced.until>=G.turn);
/** 米問屋、魚屋只有打毀督促；其他行業只有人口督促。 */
const riotSys=()=>!!G&&UG().riotSys.includes(G.sysKey);
/** 手上已有分攤合約、傳喚還沒了結、或等著其他商號解決。 */
const urgeBusy=()=>!!(G.kyusai||G.urgeCall||G.urgePend);
/** 人口督促的缺口：上一期有缺口的本業貨（不含奢侈品、要有交易許可）。回傳 [{name,gap}] 或 null。 */
function urgeGapPop(){
  const gap=G.lastGap||{};
  const L=tradeComms().filter(c=>!c.luxury&&(gap[c.name]||0)>0).map(c=>({name:c.name,gap:Math.max(1,Math.round(gap[c.name]))}));
  return L.length?L:null;
}
/** 打毀督促的缺口：本業必需品（要有交易許可），收市價視窗內的平均缺口；都沒缺時取需求一成。 */
function urgeGapRiot(){
  const L=tradeComms().filter(c=>c.staple&&G.mk[c.name]).map(c=>{
    const m=G.mk[c.name],P=m.past||[];
    const g=P.length?P.reduce((a,x)=>a+Math.max(0,(x.dn!==undefined?x.dn:(x.d0!==undefined?x.d0:x.d))-(x.so||0)-(x.my||0)),0)/P.length:0;
    return {name:c.name,gap:Math.round(g)};
  });
  const pos=L.filter(x=>x.gap>0);
  if(pos.length)return pos;
  const R_=L.filter(x=>riotKeys().includes(x.name)).map(x=>({name:x.name,gap:Math.max(1,Math.round((G.mk[x.name].D||0)*0.1))}));
  return R_.length?R_:null;
}
/** 依缺口算出貨量：share＝分到的比例（全數承接＝1）。 */
const urgeItems=(gaps,share)=>gaps.map(x=>({name:x.name,qty:Math.max(1,Math.min(x.gap,Math.round(x.gap*share)))}));
const urgeShare=()=>((G.share&&G.share.me)||0)+bekkeShare();   // 別家那一份算在你身上（07zzzzz_bekke）
/** 收購價：看你跟出面官員的交情（好感 60 以上加兩成、30 以下打八折）。 */
function urgeTier(cid){const a=(G.rel[cid]&&G.rel[cid].aff)||0,U=UG();return a>=U.affHi?'hi':a>=U.affMid?'mid':'lo'}
/** 每次推進、季度人口結算之後（只在例會旬）：開始、延續或撤回人口督促；有督促、沒有在辦的分攤時傳喚。 */
function urgeTick(log){
  if(!isMeetingTurn()||!TURNRP||!TURNRP.population)return;
  const P=TURNRP.population,put=t=>{pushNews(t);log.push(t)};
  if(G.urge){
    if(P.rate>=0){
      const Y=G.yami;G.urge=null;
      if(Y){G.yami=null;put(NEWS('urge.yamiStop',{n:nameOf(Y.cid)}))}
      put(NEWS('urge.end'));return;
    }
  }else{
    if(riotSys())return;                              // 米問屋、魚屋只有打毀督促
    const n=urgeOfficial();
    if(!((G.popDown||0)>=UG().streak&&n))return;
    G.urge={cid:n.cid,start:G.turn};
    put(NEWS('urge.start',{n:nameOf(n.cid)}));
  }
  {const n=npc(G.urge.cid);if(!n||!alive(n.cid)){const m=urgeOfficial();if(m)G.urge.cid=m.cid}}
  const M=meetNow();if(M)M.urge={cid:G.urge.cid,done:true};   // 例會上只有一句旁白
  if(riotSys()||urgeBusy())return;
  const gaps=urgeGapPop();if(gaps)urgeSummon('pop',G.urge.cid,gaps,log);
}
/** 傳喚：本旬到奉行所議事（主畫面紅底金字按鈕）。 */
function urgeSummon(kind,cid,gaps,log){
  G.urgeCall={kind,cid,turn:G.turn,gaps,att:false,step:0,done:false};
  const t=NEWS(kind==='riot'?'heika.call':'urge.call',{n:nameOf(cid)});pushNews(t);if(log)log.push(t);
}
/** 主畫面按鈕（排在例會按鈕之上；07yb_meeting.js 的 meetHomeHtml 外層）。 */
function urgeHomeHtml(){
  const C=G&&G.urgeCall;if(!C||C.turn!==G.turn)return '';
  if(C.done)return '<button class="pixel-btn" style="width:100%;margin-top:6px" disabled>'+UT('urge.home.done')+'</button>';
  return '<button class="pixel-btn" style="width:100%;margin-top:6px;background:var(--red);color:var(--gold2)" data-act="urgeGo">'+UT('urge.home')+'<div class="tiny">'+UT(C.att?'urge.home.att':'urge.home.'+C.kind)+'</div></button>';
}
{const _m=meetHomeHtml;meetHomeHtml=function(){return urgeHomeHtml()+_m.apply(this,arguments)}}
GO_INFO.urge=[UT('urge.go'),UT('urge.go.2')];
ACT.urgeGo=()=>{
  const C=G.urgeCall;if(!C||C.done||C.turn!==G.turn)return;
  if(C.att){UI.openSheet('urge');return}
  if(apLeft()<=0){toast(MSG('go.2'));return}
  if(injuredBlock())return;
  const amb=rollAmbush();if(amb&&amb.abort)return;
  const enc=amb?null:rollEncounter();
  const go=()=>{if(!spendAP())return;C.att=true;const r=R(C.cid);if(!r.bond){r.bond={mult:1,label:UT('urge.bond'),introId:null};r.met=true;addKnown(C.cid)}goTo('urge')};
  if(enc){showEncounter(enc,go);return}
  go();
};
/** 會場：訓話 → 細談 → 分配。 */
SHEETS.urge=()=>{
  const C=G.urgeCall;if(!C||!C.att)return {title:UT('urge.sheet.t'),html:'<div class="notice">'+UT('urge.sheet.none')+'</div>'};
  const steps=[UT('urge.step.0'),UT('urge.step.1'),UT('urge.step.2')],cur=C.step;
  let h='<div class="chevs">'+steps.map((s,i)=>'<span class="chev '+(cur===i?'on':cur>i?'done':'todo')+(i===0?' first':'')+'"><i>'+s+'</i></span>').join('')+'</div>';
  const card=(cid,line)=>'<div class="card warn" style="display:flow-root;margin-top:6px">'+portraitHtml(cid,48)+'<b>'+esc(nameOf(cid))+'</b> <span class="tag red">'+esc(npc(cid)&&npc(cid).pos?posTitle(npc(cid)):'')+'</span><div class="small" style="margin-top:3px">「'+esc(line)+'」</div></div>';
  C.lines=C.lines||{};
  const next='<button class="pixel-btn btn-sm btn-gold" style="width:100%;margin-top:6px" data-act="urgeStep">'+UT('btn.urgeNext')+'</button>';
  if(cur===0){
    const L=C.lines.s0||(C.lines.s0=TX('urge.scold.'+C.kind)+(urgeTier(C.cid)==='hi'?TX('urge.praise',{f:(G.firm||'').split('·')[0]}):''));
    h+='<div class="tiny muted" style="margin-top:6px">'+UT('urge.sheet.lead.'+C.kind)+'</div>'+card(C.cid,L)+next;
  }else if(cur===1){
    const L=C.lines.s1||(C.lines.s1=TX('urge.kind.'+C.kind));
    const gm=gmCid();
    h+='<div class="tiny muted" style="margin-top:6px">'+(gmIsMe()?UT('urge.inner.me'):gm?UT('urge.inner.other',{n:esc(gmName(gm))}):UT('urge.inner.none'))+'</div>'+card(C.cid,L)+next;
  }else{
    const sh=urgeShare(),all=C.choice==='all',txt=L=>kyusaiItemsTxt(L);
    h+='<div class="tiny muted" style="margin-top:6px">'+UT('urge.alloc.lead',{t:UG().turns})+'</div><div class="card" style="margin-top:4px">';
    rivalsHere().filter(n=>alive(n.cid)&&!suspended(n)&&!isBekke(n)).forEach(n=>{
      const r=(G.share&&G.share.rows||[]).find(x=>x.cid===n.cid),s2=r?r.share||0:0;
      h+='<div class="row tiny" style="margin-top:2px"><span>'+esc(nameOf(n.cid))+'</span><span>'+(all?UT('urge.alloc.all'):esc(txt(urgeItems(C.gaps,s2))))+'</span></div>';
    });
    h+='<div class="row tiny" style="margin-top:2px"><span>'+UT('urge.alloc.others')+'</span><span>'+(all?UT('urge.alloc.all'):UT('urge.alloc.othersQ'))+'</span></div>';
    const mine=C.done?C.items:urgeItems(C.gaps,all?1:sh);
    h+='<div class="row small" style="margin-top:4px;border-top:1px dashed #b5a98f;padding-top:3px"><b style="color:#9b2c3a">'+UT('urge.alloc.me')+'</b><b style="color:#9b2c3a">'+esc(txt(mine))+'</b></div>';
    h+='<div class="tiny" style="margin-top:3px">'+UT('urge.price.'+urgeTier(C.cid))+'</div></div>';
    if(C.done){h+='<div class="notice tiny" style="margin-top:4px">'+esc(C.res||'')+'</div><button class="pixel-btn btn-sm" style="width:100%;margin-top:6px" data-act="urgeEnd">'+UT('btn.urgeEnd')+'</button>'}
    else if(gmIsMe()){
      const mineAll=urgeItems(C.gaps,1),mineSh=urgeItems(C.gaps,sh);
      h+='<div class="tiny" style="margin-top:6px">'+UT('urge.gmChoose')+'</div><button class="pixel-btn btn-sm btn-gold" style="width:100%;margin-top:4px" data-act="urgeTake" data-v="all">'+UT('btn.urgeAll')+'</button><div class="tiny muted">'+esc(txt(mineAll))+'</div>';
      h+='<button class="pixel-btn btn-sm" style="width:100%;margin-top:4px" data-act="urgeTake" data-v="split">'+UT('btn.urgeSplit')+'</button><div class="tiny muted">'+esc(txt(mineSh))+'</div>';
    }else h+='<button class="pixel-btn btn-sm btn-gold" style="width:100%;margin-top:6px" data-act="urgeTake" data-v="split">'+UT('btn.urgeTake')+'</button>';
  }
  return {title:UT('urge.sheet.t'),html:h};
};
ACT.urgeStep=()=>{const C=G.urgeCall;if(!C||!C.att||C.step>=2)return;C.step++;refreshSheet()};
ACT.urgeEnd=()=>UI.closeSheet();
/** 認領：建立九旬合約。all＝公會長全數承接。回傳結果文字。 */
function urgeAssign(all,log){
  const C=G.urgeCall;if(!C||C.done)return '';
  const items=urgeItems(C.gaps,all?1:urgeShare()),tier=urgeTier(C.cid);
  kyusaiStart(C.cid,items,C.kind,UG().price[tier],all);
  C.done=true;C.choice=all?'all':'split';C.items=items;
  logRel(C.cid,UT(C.kind==='riot'?'urge.log.heikaTake':'urge.log.take'));
  C.res=UT('urge.res',{a:kyusaiItemsTxt(items),t:UG().turns,p:UT('urge.price.'+tier)});
  const t=NEWS(C.kind==='riot'?'heika.take':'urge.take',{a:kyusaiItemsTxt(items),t:UG().turns});pushNews(t);if(log)log.push(t);
  return C.res;
}
ACT.urgeTake=el=>{const C=G.urgeCall;if(!C||!C.att||C.done)return;urgeAssign(el.dataset.v==='all'&&gmIsMe());sfx.coin();refreshSheet();UI.render()};
/** 例會視窗裡的督促卡：只有一句旁白。 */
function urgeMeetCard(M){
  if(!M||!M.urge)return '';
  const cid=M.urge.cid;if(!npc(cid))return '';
  return '<div class="card warn" style="display:flow-root">'+portraitHtml(cid,48)+'<b>'+esc(nameOf(cid))+'</b> <span class="tag red">'+UT('urge.tag')+'</span><div class="small" style="margin-top:3px">「'+esc(TX('urge.say'))+'」</div><div class="tiny muted" style="margin-top:4px">'+UT('urge.meetNote')+'</div></div>';
}
/** 舊流程的接口（例會沒走完、遷居）：不再需要公會長處理，什麼都不做。 */
function urgeAuto(M,log){}
/** 罰款：現款四分之一，最低兩千兩；現款不足扣成負數。回傳罰款。 */
function urgeFine(){const U=UG(),amt=Math.max(U.fineMin,Math.round(Math.max(0,G.silver)*U.fineRate));G.silver-=amt;return amt}
/** 事情解決：人口小增（連續減少歸零、督促結束）或打毀平息（冷卻、主食漲勢回落）。 */
function urgeResolve(kind,log,others){
  const put=t=>{pushNews(t);if(log)log.push(t)};
  if(kind==='riot'){
    const S=G.staple;S.streak=0;S.cool=Math.max(S.cool||0,UG().riotCool);
    Object.keys(G.mk).forEach(k=>{if(COMM_MAP[k].staple)G.mk[k].ev=Math.min(1,G.mk[k].ev)});
    put(NEWS(others?'heika.others':'heika.calm'));return;
  }
  const O=ODDS.cityPopulation,before=Number.isFinite(G.cityPopulation)?G.cityPopulation:cityPop(homeCity());
  G.cityPopulation=Math.max(O.min,Math.round(before*(1+O.majority)));G.popDown=0;
  const Y=G.yami;if(G.urge){G.urge=null;if(Y){G.yami=null;put(NEWS('urge.yamiStop',{n:nameOf(Y.cid)}))}}
  put(NEWS(others?'urge.popOthers':'urge.popUp',{before:fmt(before),after:fmt(G.cityPopulation),rate:'+'+(O.majority*100).toFixed(1)+'%'}));
}

/* ---------- 打毀督促（米問屋、魚屋） ---------- */
/** 出面的官員：本城普請方四階（町年寄，常駐）；沒有時找在城的普請方最高階。 */
function heikaOfficial(){
  const L=Object.values(G.world.npcs).filter(n=>n.pos&&n.pos.court==='administration'&&n.cityId===G.cityId&&alive(n.cid)&&!jailed(n)&&!awayNow(n));
  return L.find(n=>n.pos.rank===4)||L.sort((a,b)=>b.pos.rank-a.pos.rank)[0]||null;
}
/** 打毀督促正在辦（傳喚、合約、或等其他商號解決）：這段期間不會打毀。 */
const heikaOn=()=>!!(G&&((G.kyusai&&G.kyusai.kind==='riot')||(G.urgeCall&&G.urgeCall.kind==='riot')||(G.urgePend&&G.urgePend.kind==='riot')));
{const _riot=riot;riot=function(log){
  if(heikaOn()){G.staple.streak=0;return}
  _riot.apply(this,arguments);
  const U=UG();G.riotLog=(G.riotLog||[]).filter(t=>t>G.turn-U.riotWin).concat([G.turn]);
  if(!riotSys()||G.riotLog.length<U.riotN||urgeBusy())return;
  const n=heikaOfficial(),gaps=(typeof moving==='function'&&moving())?null:urgeGapRiot();
  if(!n||!gaps){const t=NEWS('heika.public');pushNews(t);if(log)log.push(t);return}
  urgeSummon('riot',n.cid,gaps,log);
}}
/** 每次推進一開始：上一旬的傳喚了結（去了沒選完照預設分配；沒去就罰款，期滿由其他商號解決）；期滿的事情解決。 */
function urgeCallExpire(log){
  const C=G.urgeCall,put=t=>{pushNews(t);log.push(t)};
  if(C&&C.turn<=G.turn){
    if(!C.done){
      if(C.att){urgeAssign(false,log);put(NEWS('urge.auto'))}
      else{const f=urgeFine();G.urgePend={kind:C.kind,until:G.turn+UG().turns,cid:C.cid};sfx.bad();put(NEWS('urge.fine',{a:fmt(f)}))}
    }
    G.urgeCall=null;
  }
  const P=G.urgePend;if(P&&G.turn>=P.until){G.urgePend=null;urgeResolve(P.kind,log,true)}
}

/* ---------- c 御救販售 ---------- */
/** 開價：上一期有缺口的每項本業貨（不含奢侈品、要有交易許可）。回傳 [{name,qty}] 或 null。 */
function kyusaiOffer(){
  const gap=G.lastGap||{},sh=(G.share&&G.share.me)||0;
  const L=tradeComms().filter(c=>!c.luxury&&(gap[c.name]||0)>0).map(c=>{const g=gap[c.name];return {name:c.name,qty:Math.max(1,Math.min(Math.round(g),Math.round(g*sh*UG().mult)))}});   // 各商號照市佔分攤（第二百九十五節）
  return L.length?L:null;
}
const kyusaiItemsTxt=L=>L.map(x=>COMM_MAP[x.name].short+' × '+x.qty).join(UT('ppl.pt.2'));
function kyusaiStart(cid,O,kind,pm,all){G.kyusai={cid,kind:kind||'pop',pm:pm||1,all:!!all,items:O.map(x=>({name:x.name,qty:x.qty,filled:0})),left:UG().turns,start:G.turn+1,end:G.turn+UG().turns}}
/** 合約裡的貨，這一期大盤進貨上限加上每旬要交的量（03_market.js 的 buyLimit）。 */
function kyusaiBonus(name){const K=G&&G.kyusai;if(!K)return 0;const it=K.items.find(x=>x.name===name);return it?it.qty:0}
/** 從倉裡交貨：上貢保留的貨不動（上貢比較晚交、但比較優先）。回傳交出的數量。 */
function pactTake(name,qty){
  const T=G.tribute,held=T&&T.name===name?(T.filled||0):0;
  const q=Math.min(qty,Math.max(0,(G.inv[name]||0)-held));
  if(q>0)stockTake(name,q,false);
  const m=G.mk[name];if(m&&q>0)m.so=(m.so||0)+q;           // 貨流進城裡：算進本旬全城供給（壓行情、算滿足比例），不算你的出貨
  return q;
}
/** 拜訪請託：督促期間、那位六階官員、還沒有合約、上一期有缺口。 */
FAVORS.judiciary.push(favorText({k:'kyusai',rank:6,exactRank:true,avail:n=>urgeOn()&&!G.kyusai&&!G.urgeCall&&!G.urgePend&&G.urge.cid===n.cid&&!!kyusaiOffer()}));
REG_FAVOR.kyusai=n=>{const O=kyusaiOffer();if(!O||G.kyusai)return MSG('urge.kyusaiNone');kyusaiStart(n.cid,O,'pop',UG().price[urgeTier(n.cid)]);return MSG('urge.kyusaiOk',{a:kyusaiItemsTxt(O),t:UG().turns})};
/** 每次推進（自動出貨之前）：交出這一旬的御救販售。 */
function kyusaiDeliver(log){
  urgeCallExpire(log);                              // 上一旬的傳喚了結；期滿的事情解決
  const K=G.kyusai;if(!K||G.turn<K.start)return;
  const riot=K.kind==='riot',nk=k=>riot?k.replace('urge.kyusai','heika.'):k;
  let amt=0,short=false;const parts=[];
  K.items.forEach(it=>{const q=pactTake(it.name,it.qty);it.filled=0;amt+=Math.round(q*marketQuote(it.name)*(K.pm||1));parts.push(COMM_MAP[it.name].short+' × '+q);if(q<it.qty)short=true});
  G.silver+=amt;
  const put=t=>{pushNews(t);log.push(t)},who=nameOf(K.cid);
  if(short){                                        // 交不足：罰款（同不理傳喚），期滿由其他商號解決
    const f=urgeFine();G.kyusai=null;G.urgePend={kind:K.kind||'pop',until:Math.max(G.turn+1,K.end||G.turn+1),cid:K.cid};sfx.bad();
    put(NEWS(nk('urge.kyusaiFail'),{g:parts.join(UT('ppl.pt.2')),a:fmt(amt),f:fmt(f)}));return;
  }
  K.left--;
  if(K.left>0){put(NEWS(nk('urge.kyusaiGive'),{g:parts.join(UT('ppl.pt.2')),a:fmt(amt),l:K.left}));return}
  G.kyusai=null;
  const r=G.rel[K.cid];if(r&&alive(K.cid)){setAff(r,clamp(r.aff+UG().doneAff,0,100));logRel(K.cid,UT('urge.log.kyusaiDone'))}
  const f=K.all?0:addFame(rint(UG().fame[0],UG().fame[1]),'mid');sfx.fanfare();   // 公會長全數承接：錢自己賺，不另加名聲
  put(NEWS(nk(K.all?'urge.kyusaiDoneAll':'urge.kyusaiDone'),{g:parts.join(UT('ppl.pt.2')),a:fmt(amt),f:fmt1(f),n:who}));
  urgeResolve(K.kind||'pop',log);
}

/* ---------- b 闇商代出 ---------- */
/** 開價：每項有缺口的本業貨，每旬「穩定供貨線 − 協議配額」（至少 1）。 */
function yamiOffer(){
  const gap=G.lastGap||{};
  const L=tradeComms().filter(c=>!c.luxury&&(gap[c.name]||0)>0).map(c=>({name:c.name,qty:Math.max(1,supplyLine(c.name)-quotaOf(c.name))}));
  return L.length?L:null;
}
const yamiBanned=cid=>!!(G.yamiBan&&G.yamiBan[cid]>G.turn);
{const _d=dealerReqs;dealerReqs=function(cid){
  const L=_d.apply(this,arguments),n=npc(cid);
  if(n&&n.role==='smuggler'&&dealReady(cid)&&urgeOn()&&guildMember()&&!G.yami&&!yamiBanned(cid)){const O=yamiOffer();if(O)L.unshift({k:'yami',name:UT('urge.yamiReq'),desc:TX('urge.yamiPitch')+UT('urge.yamiReq.d',{a:kyusaiItemsTxt(O)})})}
  return L;
}}
{const _do=dealerDo;dealerDo=function(cid,k){
  if(k!=='yami')return _do.apply(this,arguments);
  const r=R(cid),O=yamiOffer();if(!O||G.yami||!urgeOn()||!guildMember())return UT('urge.yamiNone');
  G.yami={cid,items:O.map(x=>({name:x.name,qty:x.qty,filled:0})),left:UG().turns,start:G.turn+1};
  setAff(r,Math.max(0,r.aff-REQ_AFF.normal));r.dealT=G.turn;logRel(cid,UT('urge.log.yami',{a:REQ_AFF.normal}));
  return UT('urge.yamiOk',{n:nameOf(cid),a:kyusaiItemsTxt(O),d:REQ_AFF.normal});
}}
/** 每次推進（御救販售之後、自動出貨之前）：交出這一旬的闇商代出，貨款進私房錢；擲一次被看穿。 */
function yamiDeliver(log){
  const Y=G.yami;if(!Y||G.turn<Y.start)return;
  const put=t=>{pushNews(t);log.push(t)},who=nameOf(Y.cid);
  if(!urgeOn()||!guildMember()){G.yami=null;put(NEWS('urge.yamiStop',{n:who}));return}
  let gold=0,short=false,q0=0,qq=0;const parts=[];
  Y.items.forEach(it=>{const q=pactTake(it.name,it.qty);it.filled=0;gold+=Math.round(q*marketQuote(it.name)*UG().yamiCut);q0+=q;qq+=Math.max(1,quotaOf(it.name));parts.push(COMM_MAP[it.name].short+' × '+q);if(q<it.qty)short=true});
  G.gold=(G.gold||0)+gold;
  const D=UG().detect,over=q0/qq,caught=q0>0&&chance(Math.min(D.max,D.base+D.slope*over));
  if(caught){
    const C=G.cartel;C.sanction=3;C.state='none';loseFame('yamiCaught');caughtAdd('me');const lost=guildForfeit();
    const fine=Math.round(Math.max(0,G.silver)*UG().fine);G.silver-=fine;
    const r=G.rel[Y.cid];if(r){setAff(r,Math.max(0,r.aff-UG().yamiAff));logRel(Y.cid,UT('urge.log.yamiCaught'))}
    (G.yamiBan=G.yamiBan||{})[Y.cid]=G.turn+UG().ban;G.yami=null;sfx.bad();
    put(NEWS('urge.yamiCaught',{n:who,g:fmt(gold),b:lost?fmt(lost):'0',f:fmt(fine)}));return;
  }
  if(short){
    const r=G.rel[Y.cid];if(r){setAff(r,Math.max(0,r.aff-UG().yamiShortAff));logRel(Y.cid,UT('urge.log.yamiShort'))}
    G.yami=null;put(NEWS('urge.yamiShort',{n:who,g:parts.join(UT('ppl.pt.2')),a:fmt(gold)}));return;
  }
  Y.left--;
  put(NEWS(Y.left>0?'urge.yamiGive':'urge.yamiDone',{n:who,g:parts.join(UT('ppl.pt.2')),a:fmt(gold),l:Y.left}));
  if(Y.left<=0)G.yami=null;
}

/* ═════ [07zzr_move] ═════ */
'use strict';
/* ★檔案總覽：遷居與轉行（DESIGN_NOTES 第二十九、二百四十（第五段）、二百五十九～二百六十三節）
 * - 約定：好感 100 的外城友人人物卡「🏠 遷居」區塊 →「商量遷居」→ 約定（G.move={cid,city,start}）。京畿圈要先完成帝都獻上（尚未實作，一律不能約）。
 * - 籌備：最少九旬、最長十八旬；期間不能開新的長期關係（moveBlocks）；友人過世、下獄、成仇或不再是外城友人，約定作廢；逾期作罷。
 * - 私宅面板最下方：啟程事項清單（moveItems，取自商行往來 dealGroups 再加御救販售）＋獨佔一行的大按鈕「啟程遷居」。
 * - 啟程視窗：選行業（目的地不產該行業本業貨）→ 挑隨行員工（每種職位最多一人）→ 確認（搬家費 2,000 兩）。
 * - 啟程（moveDepart）：清掉舊城 → 跳過旅途（到第二個例會旬；跨年時抵達補做新年）→ 建立新城（補人到開局規模、重建本業市場與開業庫存、入會、例會）。
 * - 狀態：G.move、G.moveLast（上次抵達的旬，冷卻 108 旬＝三年，第三百二十五節）。數值 ODDS.move；文字 mv.*（01e）、新聞 mv.*（01g）。 */
const MVO=()=>ODDS.move;
const moving=()=>!!(G&&G.move);
const MV_RANKS=['chief','banto','clerk','apprentice','captain','courier','guard'];
/** 這座城可以開哪些行業（不產該行業的本業貨）。 */
const moveSysOK=(ct,k)=>!commsOfSys(k).some(c=>cityRaw(ct).includes(c.name));
const moveSysList=ct=>SYS.filter(s=>s.key!==absentSys()&&moveSysOK(ct,s.key)).map(s=>s.key);   // 魚屋與醬漬問屋不能互轉（第三百零二節）
/** 約定遷居前的檢查：回傳不能約的原因（UT 鍵），可以約就回傳空字串。 */
function moveAskBlock(cid){
  const r=G.rel[cid],ct=outCity(cid);
  if(!r||r.aff<100)return 'mv.b.aff';
  if(G.move)return G.move.cid===cid?'mv.b.mine':'mv.b.other';
  if(ct.region_id==='reg_central')return 'mv.b.central';                 // 帝都獻上之前不能遷入京畿圈（第一百六十七節）
  if(G.moveLast!==undefined&&G.turn<G.moveLast+MVO().cool)return 'mv.b.cool';
  if(!moveSysList(ct).length)return 'mv.b.prod';
  return '';
}
/** 外城友人卡下方的遷居區塊（好感 100 才出現）。 */
function moveFriendBlock(cid){
  const r=G.rel[cid];if(!r||r.aff<100)return '';
  const ct=outCity(cid),b=moveAskBlock(cid);
  let h='<div class="mv-box"><b>'+UT('mv.box.t')+'</b><div class="tiny">'+UT('mv.box.d',{c:ct.name,a:fmt(MVO().fee)})+'</div>';
  if(b==='mv.b.mine')h+='<div class="tiny" style="color:#2f7d4f;margin-top:3px">'+UT('mv.box.mine')+'</div>';
  else h+='<button class="pixel-btn btn-sm btn-gold" style="width:100%;margin-top:4px" data-act="moveAsk" data-cid="'+cid+'" '+(b?'disabled':'')+'>'+UT('btn.moveAsk')+'</button>'+(b?'<div class="tiny muted" style="margin-top:2px">'+UT(b,{n:Math.max(0,(G.moveLast||0)+MVO().cool-G.turn)})+'</div>':'');
  return h+'</div>';
}
{const _o=outRowHtml;outRowHtml=function(cid){return _o.apply(this,arguments)+moveFriendBlock(cid)}}
/** 商量遷居：說明後約定。 */
ACT.moveAsk=el=>{
  const cid=el.dataset.cid,b=moveAskBlock(cid);if(b){toast(UT(b,{n:0}));return}
  const ct=outCity(cid),O=MVO();
  UI.showInfo(UT('mv.ask.t'),portraitHtml(cid,56)+'<div class="notice" style="margin-top:6px">'+esc(TX('mv.ask',{c:ct.name}))+'</div>'
    +'<div class="card tiny">'+UT('mv.ask.rule',{c:ct.name,a:O.prepMin,b:O.prepMax,f:fmt(O.fee)})+'</div>'
    +'<div class="grid2" style="margin-top:6px"><button class="pixel-btn btn-sm btn-gold" data-act="moveAgree" data-cid="'+cid+'">'+UT('btn.moveAgree')+'</button><button class="pixel-btn btn-sm" data-act="reqDone">'+UT('btn.moveLater')+'</button></div>');
};
ACT.moveAgree=el=>{
  const cid=el.dataset.cid;if(moveAskBlock(cid)){UI.hideInfo();return}
  const ct=outCity(cid);G.move={cid,city:ct.id,start:G.turn};
  logRel(cid,UT('mv.log.agree'));pushNews(NEWS('mv.agree',{n:nameOf(cid),c:ct.name}));
  sfx.fanfare();UI.hideInfo();toast(UT('mv.agree.toast',{c:ct.name,a:MVO().prepMin}),5200);UI.render();refreshSheet();
};
/* ---------- 籌備期 ---------- */
/** 籌備滿了幾旬（約定那一旬算第一旬）。 */
const movePrep=()=>G.move?G.turn-G.move.start+1:0;
/** 啟程事項清單：[{t,s,k?,i?}]；k＝可以就地放棄的項目（被寬限的賣掛）。 */
function moveItems(){
  const L=[];
  dealGroups().forEach(([g,list])=>list.forEach(x=>{if(x.k!=='promise'&&x.k!=='gmDue')L.push(x)}));   // 對官員的承諾、公會長的得標金不擋啟程
  if(G.kyusai)L.push({t:UT(G.kyusai.kind==='riot'?'mv.it.heika':'mv.it.kyusai'),s:UT('deal2.left',{n:G.kyusai.left})});
  return L;
}
/** 現在能不能啟程：回傳 {ok,why:[]}。 */
function moveReady(){
  const why=[],n=moveItems().length,left=MVO().prepMin-movePrep();
  if(n)why.push(UT('mv.why.items',{n}));
  if(left>0)why.push(UT('mv.why.prep',{n:left}));
  if((G.injured||0)>0)why.push(UT('mv.why.injured'));
  if((G.exile||0)>0)why.push(UT('mv.why.exile'));
  if(G.silver<MVO().fee)why.push(UT('mv.why.fee',{a:fmt(MVO().fee)}));
  return {ok:!why.length,why};
}
/** 私宅面板最下方：啟程事項清單與遷居按鈕。 */
function moveEstateBlock(){
  const M=G.move;if(!M||!npc(M.cid))return '';
  const ct=CITY(M.city),L=moveItems(),R_=moveReady(),last=M.start+MVO().prepMax-1;
  let h='<div class="hr-title" style="color:#e5a93b">'+UT('mv.est.t')+'</div><div class="card mv-est">';
  h+='<div class="small">'+UT('mv.est.head',{n:esc(nameOf(M.cid)),c:ct.name})+'</div>';
  h+='<div class="tiny muted">'+UT('mv.est.time',{a:movePrep(),b:MVO().prepMin,d:dateLabel(dateAfter(last-G.turn))})+'</div>';
  h+='<div class="small bold" style="margin-top:6px">'+UT('mv.est.list')+'</div>';
  if(!L.length)h+='<div class="tiny" style="color:#2f7d4f">'+UT('mv.est.clear')+'</div>';
  else h+=L.map(x=>'<div class="row tiny" style="margin-top:3px;align-items:flex-start"><span>☐ '+esc(x.t)+'</span><span style="white-space:nowrap;margin-left:8px"><b>'+esc(x.s)+'</b>'+(x.k==='kakeGive'?' <button class="pixel-btn btn-sm" data-act="moveKakeGive" data-i="'+x.i+'">'+UT('btn.kakeGive')+'</button>':'')+'</span></div>').join('');
  h+='<div class="tiny muted" style="margin-top:4px">'+UT('mv.est.note')+'</div>';
  h+='<button class="pixel-btn btn-gold mv-go" data-act="moveGo" '+(R_.ok?'':'disabled')+'>'+UT('btn.moveGo',{c:ct.name})+'</button>';
  if(!R_.ok)h+='<div class="tiny" style="color:#b3392b;margin-top:3px">'+R_.why.join('；')+'</div>';
  h+='<div style="text-align:right;margin-top:4px"><button class="pixel-btn btn-sm" data-act="moveCancel">'+UT(UI.s.mvCancelArm?'btn.moveCancelOk':'btn.moveCancel')+'</button></div>';
  return h+'</div>';
}
{const _re=renderEstate;renderEstate=function(){_re.apply(this,arguments);const b=moving()?moveEstateBlock():'';if(b)$('#view-estate').insertAdjacentHTML('beforeend','<div class="mv-wrap">'+b+'</div>')}}
ACT.moveKakeGive=el=>{
  const L=G.kakeRecv||[],r=L[+el.dataset.i];if(!r||!r.late)return;
  L.splice(+el.dataset.i,1);logRel(r.cid,UT('mv.log.kakeGive',{a:fmt(Math.abs(r.amt))}));toast(UT('mv.kakeGive',{n:nameOf(r.cid),a:fmt(Math.abs(r.amt))}));UI.render();
};
ACT.moveCancel=()=>{
  if(!UI.s.mvCancelArm){UI.s.mvCancelArm=true;UI.render();return}
  UI.s.mvCancelArm=false;const M=G.move;if(!M)return;G.move=null;
  pushNews(NEWS('mv.cancel',{n:nameOf(M.cid),c:CITY(M.city).name}));toast(UT('mv.cancel.toast'));UI.render();
};
/** 每旬（outTick 之後）：友人出事或逾期，約定作廢。 */
function moveTick(log){
  const M=G.move;if(!M)return;
  const n=npc(M.cid),put=t=>{pushNews(t);log.push(t)};
  let why='';
  if(!n||!alive(M.cid))why='dead';else if(jailed(n))why='jail';else if(isEnemy(M.cid))why='enemy';else if(n.cityId!==M.city||!isOutFriend(M.cid))why='gone';
  if(why){G.move=null;put(NEWS('mv.void.'+why,{n:nameOf(M.cid),c:CITY(M.city).name}));return}
  if(movePrep()>MVO().prepMax){G.move=null;put(NEWS('mv.expire',{n:nameOf(M.cid),c:CITY(M.city).name}));return}
  if(movePrep()===MVO().prepMax)log.push(NEWS('mv.lastTurn',{c:CITY(M.city).name}));
}
/* ---------- 籌備期間不能開新的長期關係 ---------- */
const MV_BLOCK_FAVOR=['smallLoan','loan','mono5','mono6','rhonjin','rujob','rkokusho','kyusai'];
{const _df=doFavor;doFavor=function(cid,key){
  const n=npc(cid),f=n&&n.pos&&(FAVORS[n.pos.court]||[]).find(x=>x.k===key);
  if(moving()&&(MV_BLOCK_FAVOR.includes(key)||(f&&f.apply)))return {ok:true,status:'held',msg:UT('mv.noNew')};
  return _df.apply(this,arguments);
}}
{const _ks=kakeSign;kakeSign=function(){if(moving())return UT('mv.noNew');return _ks.apply(this,arguments)}}
{const _ts=startTribute;startTribute=function(){if(moving()){toast(UT('mv.noNew'));return}return _ts.apply(this,arguments)}}
{const _ko=kyusaiOffer;kyusaiOffer=function(){return moving()?null:_ko.apply(this,arguments)}}
{const _yo=yamiOffer;yamiOffer=function(){return moving()?null:_yo.apply(this,arguments)}}
{const _ct=ACT.cmTake;ACT.cmTake=function(){if(moving()){UI.s.chumonOffer=null;toast(UT('mv.noNew'));return UI.hideInfo()}return _ct.apply(this,arguments)}}
/* ---------- 啟程視窗 ---------- */
/** 抵達要幾旬：出發後的第二個例會旬（出發那一旬剛好是例會旬就算第一個）。 */
function moveTravelTurns(){
  let cnt=isMeetingDate(G.month,G.cycle)?1:0,k=0;
  while(cnt<2&&k<40){k++;const d=dateAfter(k);if(isMeetingDate(d.month,d.cycle))cnt++}
  return k;
}
function moveDialog(){
  const M=G.move,ct=CITY(M.city),S=UI.s.mv||(UI.s.mv={step:1,sys:null,take:{}});
  const sysL=moveSysList(ct);if(!S.sys||!sysL.includes(S.sys))S.sys=sysL.includes(G.sysKey)?G.sysKey:sysL[0];
  let h='<div class="tiny muted">'+UT('mv.dlg.steps',{s:S.step})+'</div>';
  if(S.step===1){
    h+='<div class="small" style="margin:4px 0">'+UT('mv.dlg.sys',{c:ct.name})+'</div>';
    h+=SYS.map(s=>{const ok=sysL.includes(s.key),me=s.key===G.sysKey;
      return '<button class="pixel-btn btn-sm '+(S.sys===s.key?'btn-gold':'')+'" style="width:100%;margin-top:3px;text-align:left" data-act="moveSys" data-k="'+s.key+'" '+(ok?'':'disabled')+'>'+(S.sys===s.key?'◉ ':'○ ')+esc(s.name)+(me?UT('mv.dlg.sysMe'):'')+(ok?'':UT('mv.dlg.sysNo'))+'</button>'}).join('');
    h+='<div class="tiny muted" style="margin-top:4px">'+UT('mv.dlg.sysNote')+'</div>';
  }else if(S.step===2){
    h+='<div class="small" style="margin:4px 0">'+UT('mv.dlg.staff')+'</div>';
    const rk=MV_RANKS.filter(k=>G.emps.some(e=>e.rank===k));
    if(!rk.length)h+='<div class="tiny muted">'+UT('mv.dlg.noStaff')+'</div>';
    h+=rk.map(k=>{const L=G.emps.filter(e=>e.rank===k);if(S.take[k]===undefined)S.take[k]=L.length===1?L[0].id:null;
      return '<div class="card tiny"><b>'+rankName(k)+'</b><div class="row" style="justify-content:flex-start;gap:4px;flex-wrap:wrap;margin-top:3px">'
        +L.map(e=>'<button class="pixel-btn btn-sm '+(S.take[k]===e.id?'btn-gold':'')+'" data-act="moveTake" data-k="'+k+'" data-id="'+e.id+'">'+esc(e.name)+'</button>').join('')
        +'<button class="pixel-btn btn-sm '+(S.take[k]===null?'btn-gold':'')+'" data-act="moveTake" data-k="'+k+'" data-id="">'+UT('mv.dlg.none')+'</button></div></div>'}).join('');
    h+='<div class="tiny muted">'+UT('mv.dlg.staffNote')+'</div>';
  }else{
    const k=moveTravelTurns(),d=dateAfter(k),S_=SYS_BY_KEY[S.sys],firm=UT('me.firm',{firm:moveYago(),sys:S_.name});
    const take=Object.values(S.take).filter(Boolean).map(id=>G.emps.find(e=>e.id===id)).filter(Boolean);
    const inv=Object.values(G.inv||{}).reduce((a,b)=>a+b,0)+xinvQty()+Object.values(G.contra||{}).reduce((a,b)=>a+b,0);
    const B=[UT('mv.cf.firm',{f:esc(firm),c:ct.name}),UT('mv.cf.road',{n:k,d:dateLabel(d),y:d.year!==G.year?UT('mv.cf.year'):''}),UT('mv.cf.fee',{a:fmt(MVO().fee)}),
      UT('mv.cf.take',{a:take.length?take.map(e=>rankName(e.rank)+' '+esc(e.name)).join('、'):UT('mv.dlg.none'),b:Math.max(0,G.emps.length-take.length)})];
    if(inv>0)B.push(UT('mv.cf.goods',{n:inv}));
    if(gmIsMe())B.push(UT('mv.cf.gm'));
    if(guildMember())B.push(UT('mv.cf.bond'));
    B.push(UT('mv.cf.reset'));
    h+='<div class="card tiny">'+B.map(x=>'<div>· '+x+'</div>').join('')+'</div>';
  }
  const back=S.step>1?'<button class="pixel-btn btn-sm" data-act="moveStep" data-d="-1">'+UT('btn.moveBack')+'</button>':'<button class="pixel-btn btn-sm" data-act="reqDone">'+UT('btn.moveLater')+'</button>';
  const fwd=S.step<3?'<button class="pixel-btn btn-sm btn-gold" data-act="moveStep" data-d="1">'+UT('btn.moveNext')+'</button>':'<button class="pixel-btn btn-sm btn-red" data-act="moveDepart">'+UT('btn.moveDepart')+'</button>';
  UI.showInfo(UT('mv.dlg.t',{c:ct.name}),h+'<div class="grid2" style="margin-top:6px">'+back+fwd+'</div>');
}
/** 屋號（「三河屋·材木問屋」的前半）。 */
const moveYago=()=>String(G.firm||'').split('·')[0]||SYS_BY_KEY[G.sysKey].firm;
ACT.moveGo=()=>{if(!moving()||!moveReady().ok)return;UI.s.mv={step:1,sys:null,take:{}};moveDialog()};
ACT.moveSys=el=>{UI.s.mv.sys=el.dataset.k;moveDialog()};
ACT.moveTake=el=>{UI.s.mv.take[el.dataset.k]=el.dataset.id?+el.dataset.id||el.dataset.id:null;moveDialog()};
ACT.moveStep=el=>{UI.s.mv.step=clamp(UI.s.mv.step+(+el.dataset.d),1,3);moveDialog()};
ACT.moveDepart=()=>{
  if(!moving()||!moveReady().ok){UI.hideInfo();return}
  const S=UI.s.mv,M=G.move,ct=CITY(M.city);UI.s.mv=null;INFO_AFTER=null;UI.hideInfo();
  const log=moveDepart(S.sys,Object.values(S.take).filter(Boolean));
  playFx(ct.region_id===homeCity().region_id||!canSea(ct)?'cart':'boat',UT('mv.fx'),ct.name,()=>{
    SCENE.sig='';sceneSync(true);UI.go('home');UI.render();
    UI.showInfo(UT('mv.arrive.t',{c:ct.name}),'<div class="notice">'+esc(TX('mv.arrive'))+'</div>'+log.map(t=>'<div class="tiny" style="margin-top:4px">'+esc(t)+'</div>').join(''));
    armFaceEvents();
  },1600);
};
/* ---------- 啟程：清掉舊城、跳過旅途、建立新城 ---------- */
function moveDepart(sysKey,takeIds){
  const log=[],put=t=>{pushNews(t);log.push(t)},M=G.move,old=homeCity(),dest=CITY(M.city),friend=M.cid,y0=G.year;
  // 一、舊城的事收尾
  if(G.guild&&G.guild.urge&&!G.guild.urge.done&&gmIsMe())urgeAuto(G.guild,log);       // 公會長沒處理的督促卡＝推託
  if(gmIsMe()){const f=gmFineNow();const t=NEWS('mv.gmOut')+(f||'')+gmSucceed('me');put(t)}   // 公會長卸任，沒報告的得標金照罰
  if(guildMember())guildForfeit();                                                     // 訂約金作廢
  payPublic('spend.move',MVO().fee);
  const keep=new Set(takeIds);
  G.emps.filter(e=>!keep.has(e.id)).forEach(e=>{if(e.cid&&npc(e.cid))npc(e.cid).hired=false});
  G.emps=G.emps.filter(e=>keep.has(e.id));
  G.emps.forEach(e=>{if(e.cid&&npc(e.cid))npc(e.cid).cityId=dest.id});
  Object.keys(G.rel).forEach(c=>{const n=npc(c),r=G.rel[c];if(n&&r&&r.bond&&r.aff>=100&&n.cityId===old.id&&!n.hired&&OF_ROLES.includes(n.role)){r.out=true;r.ofT=G.turn+moveTravelTurns()}});   // 只有好感 100 的舊城商人成為外城友人（從抵達那一旬起算往來）
  G.intros=[];G.introId=null;
  moveClearCity();
  // 二、跳過旅途
  const k=moveTravelTurns(),d=dateAfter(k);
  ['exempt','horse','cheap','escort','taxfree','blind','calm'].forEach(f=>{if(typeof G.flags[f]==='number')G.flags[f]=Math.max(0,G.flags[f]-k)});   // 限期效果照樣過了這些旬
  G.turn+=k;G.month=d.month;G.cycle=d.cycle;G.year=d.year;
  // 三、建立新城
  const fromSys=G.sysKey;G.sysKey=sysKey||G.sysKey;
  G.firm=UT('me.firm',{firm:moveYago(),sys:SYS_BY_KEY[G.sysKey].name});
  G.cityId=dest.id;
  G.supplySeed=hashStr('originSupply|'+G.rs+'|'+G.cityId+'|'+G.turn);
  G.cityPopulation=parseInt(dest.population,10)||0;
  moveTopUp(dest.id);
  officialMigrate();officialsOf(G.cityId).forEach(n=>addKnown(n.cid));
  {const r=R(friend);r.lockAff=true;setAff(r,100);r.out=false;r.met=true;r.seen=true;r.bond=Object.assign({},r.bond||{mult:1},{label:UT('mv.bond'),introId:null});addKnown(friend);G.intros=[{cid:friend}];G.introId=friend;logRel(friend,UT('mv.log.arrive'))}
  G.cartel={state:'pledged',comp:65,sanction:0,cheated:0,bond:costOf('guildBond'),pot:0,policy:chance(ODDS.guildPolicy.normal)?'normal':'restrict'};   // 友人代墊訂約金（同開局）
  G.mk={};initMarket();shipLockInit();             // 新城：停賣鎖重來，本業奢侈品預設停賣（第二百九十九節）
  G.share=marketShares();
  G.gm=null;if(G.month!==3){const t=gmSucceed('me');if(t)log.push(t)}
  newMeeting();
  G.daimyo=null;daimyoPlan();
  G.ap=AP_MAX;G.move=null;G.moveLast=G.turn;
  G.cityHist=G.cityHist||{};(G.cityHist[dest.id]=G.cityHist[dest.id]||[]).push({year:G.year,title:NEWS('mv.hist',{f:G.firm,c:old.name})});
  put(NEWS(G.sysKey!==fromSys?'mv.arriveSys':'mv.arrive',{f:G.firm,c:dest.name,o:old.name,n:nameOf(friend),t:k}));
  // 四、路上跨了年：抵達這一旬補做新年
  if(G.year>y0){
    G.yearLog=[];G.yearSilver0=G.silver;
    buyoutEnsure();komonPlan();G.daimyo=null;daimyoPlan();
    put(NEWS('mv.yearRoad'));yearTick(log);
    moveTopUp(G.cityId);officialMigrate();                                            // 新年有人病逝：再補一次
  }
  put(NEWS('meet.today'));
  recordSilver();save();
  return log;
}
/** 清掉舊城的行情、資格與帳（新城比照新開局；遠國奉行所的地區許可保留）。 */
function moveClearCity(){
  G.inv={};G.stockSource={};G.xinv={};G.contra={};
  G.lic={wh:0,ship:0,horse:0,guard:0,staff:0};G.trade=[];G.wh.n=1;G.flags.firebreak=false;
  G.apps=[];G.heat=0;G.fame=Math.max(0,G.fameFloor||0);
  G.avgCost={};G.plan={};G.buyPlan={};G.sold={};G.bought={};G.rec={r:[],b:[],t:[]};G.orders=[];
  delete G.mybias;G.mytmp=1;G.share=null;G.shareMem=null;G.shareEst=false;G.shipOk=null;
  G.staple={streak:0,peak:1};G.supplyQuarter={stable:0,unstable:0,turns:0};G.festival=null;G.disaster=null;G.smugP={};
  G.bz=[];G.bzBuy={};G.bzShow=false;G.rvLot=null;G.rivalHeirs=[];
  G.gm=null;G.gmDue=null;G.gmLevy=null;G.gmArb=null;G.guild=null;
  G.urge=null;G.yami=null;G.urgeCall=null;G.riotLog=null;G.urgePend=null;G.popDown=0;G.lastGap=null;G.citySatLast=null;G.newTown=null;
  G.recruit=null;G.inspect=null;G.raidNote=null;G.tempHelp=null;G.swapOffer=null;G.lendOffer=null;G.stashOffer=null;G.xoffer=null;
  G.sumo=null;G.rushLot=null;G.rushBust=null;G.faceEvents=[];G.homeEvents=[];
}
/** 新城補人到開局本城規模（只補缺額；名冊尚未登場、在世的人；同地區出身優先）。 */
function moveTopUp(cityId){
  const ct=CITY(cityId),age=c=>G.year-c.birth_year,sameReg=n=>CITY(n.cityId)&&CITY(n.cityId).region_id===ct.region_id;
  const stranger=n=>!G.rel[n.cid]&&!G.known.includes(n.cid);
  HOME_ROLES.forEach(([role,n0,lo,hi])=>{
    const want=homeRoleN(role);let need=want-cityNpcs(cityId,role).filter(n=>!n.hired).length;
    if(need<=0)return;
    const fit=c=>c&&age(c)>=(lo||0)&&age(c)<=(hi||999)&&c.death_year>G.year+1;   // 調來的人也不能是一兩年內就過世的
    // 一、名冊裡還沒登場、年齡合適的人
    const pool=shuffle(CHARS.filter(c=>!G.world.npcs[c.id]&&hasRole(c,role)&&c.birth_year<=G.year&&c.death_year>G.year+1&&fit(c)));
    pool.sort((a,b)=>(b.native_region===ct.region_id)-(a.native_region===ct.region_id));
    pool.slice(0,need).forEach(c=>{G.world.npcs[c.id]={cid:c.id,cityId,role,pos:null};need--});
    if(need<=0)return;
    // 二、別城你不認識的人（同地區優先）；三、名伶還不夠，連你認識的名伶也調來
    const far=(ok,f)=>shuffle(Object.values(G.world.npcs).filter(n=>n.role===role&&n.cityId!==cityId&&alive(n.cid)&&!n.hired&&!jailed(n)&&(f||fit)(CH(n.cid))&&ok(n))).sort((a,b)=>sameReg(b)-sameReg(a));
    far(stranger).slice(0,need).forEach(n=>{n.cityId=cityId;need--});
    if(need>0&&role==='oiran')far(n=>!stranger(n)).slice(0,need).forEach(n=>{n.cityId=cityId;need--});
    if(need>0)far(stranger,c=>c&&age(c)>=18&&c.death_year>G.year+1).slice(0,need).forEach(n=>{n.cityId=cityId;need--});   // 四、還不夠：年紀輕一點的也調來
  });
}

/* ═════ [07zzs_staffchat] ═════ */
'use strict';
/* ★檔案總覽：店員閒聊、零用錢與心腹指令（DESIGN_NOTES 第二百六十八節）
 * - 人物卡（私宅、河岸碼頭）不再直接列出暗殺、放火、做帳；每位店員多一顆「閒聊」（樣式同辭退）。
 * - 零用錢：好感未滿 80 照舊 +3～5；80 以上一般人退回（不扣錢、不算給過），貪欲高的照收照加；好感 100 不再加。
 * - 閒聊：不扣行動，同一人一旬一次（e.chatT）；未滿 80 不加好感；80 以上一般人 +3～5，貪欲高的不加。
 *   內容：依好感的開場一句＋往事（e.mem，約一半機會）或點人閒聊的內容（07h_duties.js 的 chatFor）；心腹另說一句並列出指令。
 *   心腹聊過以後，按鈕改為「吩咐差事」，只開指令。
 * - 往事：店員偶發事件、升遷、查帳、年資成長、夫人事件、借出受傷、詐領演戲、採買遇險；最多記六件，同一件最多提兩次。
 * - 數值 ODDS.staffChat；台詞 LINES.staffChat；文字 sc.*（01e）。 */
const SC=()=>ODDS.staffChat;
const scGreedy=e=>(statsOfEmp(e).greed_index||0)>=SC().greed;
const scChatted=e=>e.chatT===G.turn;
/** 記一件往事（k＝種類鍵，對應 LINES.staffChat.mem）。 */
function scMem(e,k){
  if(!e||!k)return;e.mem=e.mem||[];if(k==='grow')e.mem=e.mem.filter(m=>m.k!=='grow');   // 年資成長只留最近一件
  e.mem.push({t:G.turn,k,u:0});
  if(e.mem.length>SC().memMax)e.mem.splice(0,e.mem.length-SC().memMax);
}
/** 心腹的指令（沒有就回傳空字串）。 */
function scOrders(e){
  const a=empAff(e);if(a<100)return '';
  if(e.rank==='guard')return assassinHtml(e);
  if(arsonOK(e))return arsonHtml(e);
  if(e.rank==='chief')return chiefBookHtml(e);
  if(e.rank==='captain')return UT('loyal.empAffHtml');
  return '';
}
const scSworn=e=>empAff(e)>=100&&(e.rank==='guard'||e.rank==='chief'||e.rank==='captain'||arsonOK(e));
/** 人物卡上的零用錢列（不再顯示「已滿」，也不列特殊指令）。 */
empAffHtml=function(e){
  const a=empAff(e),given=e.allowT===G.turn;
  return UT('loyal.h',{a:Math.round(a),b:bar(a,100,'gold')})+'</div>'+'<button class="pixel-btn btn-sm" data-act="allow" data-id="'+e.id+'" '+(given?'disabled':'')+'>'+(given?UT('btn.allowDone'):UT('btn.allow',{c:costBtn('allowance')}))+'</button></div>';
};
/** 「閒聊」按鈕（放在辭退旁邊，樣式相同）。 */
function staffChatBtn(e){
  if(scChatted(e))return scSworn(e)?'<button class="pixel-btn btn-sm" data-act="staffOrder" data-id="'+e.id+'">'+UT('btn.staffOrder')+'</button>':'<button class="pixel-btn btn-sm" disabled>'+UT('btn.staffChatDone')+'</button>';
  return '<button class="pixel-btn btn-sm" data-act="staffChat" data-id="'+e.id+'">'+UT('btn.staffChat')+'</button>';
}
ACT.allow=el=>{
  const e=G.emps.find(x=>x.id===el.dataset.id);if(!e)return;
  if(e.allowT===G.turn){toast(MSG('allow.2'));return}
  const a=empAff(e),O=SC(),greedy=scGreedy(e);
  if(a>=O.affAt&&!greedy){toast(UT('sc.allowRefuse',{n:e.name,l:TX('staffChat.allowRefuse')}),4200);sfx.tap();return}   // 退回：不扣錢、不算給過
  if(!afford('allowance')){toast(shortMsg('allowance'));return}
  spend('allowance');e.allowT=G.turn;
  const g=a>=100?0:Math.min(100-a,rint(O.gain[0],O.gain[1]));e.aff=Math.min(100,a+g);sfx.coin();
  if(a>=O.affAt)toast(UT('sc.allowGreedy',{n:e.name,l:TX('staffChat.allowGreedy'),g:g?UT('sc.affUp',{g}):''}),4200);
  else toast(MSG('allow.3',{name:e.name,g,aff:Math.round(e.aff)}));
  UI.render();refreshSheet();
};
/** 往事的台詞（鍵名含「.」，不能走 TX 的路徑查表）。 */
function scMemLine(k,e){const L=LINES.staffChat.mem[k];if(!L)return '';const v=Array.isArray(L)?pick(L):L;return String(v).replace(/\{n\}/g,e.name).replace(/\{k\}/g,rankName(e.rank))}
/** 挑一件可以講的往事（優先提得少的）；沒有回傳 null。 */
function scMemPick(e){
  const L=(e.mem||[]).filter(m=>(m.u||0)<SC().memUse&&LINES.staffChat.mem[m.k]);
  const extra=[];if(e.origin==='tea')extra.push({k:'tea',u:e.teaU||0,virt:'teaU'});else if(!e.cid&&e.homegrown)extra.push({k:'kid',u:e.kidU||0,virt:'kidU'});
  const all=L.concat(extra.filter(x=>x.u<SC().memUse));if(!all.length)return null;
  const lo=Math.min(...all.map(m=>m.u||0));return pick(all.filter(m=>(m.u||0)===lo));
}
/** 閒聊視窗的內容。 */
function scBody(e,eff,first){
  const a=empAff(e),tone=a>=80?'warm':a>=40?'mid':'cold';
  let h='<div style="display:flow-root">'+portraitEmp(e,56)+'<div style="margin-top:2px">'+esc(TX('staffChat.tone.'+tone,{n:e.name}))+'</div>';
  if(first){
    const m=chance(SC().memP)?scMemPick(e):null;
    if(m){if(m.virt)e[m.virt]=(e[m.virt]||0)+1;else m.u=(m.u||0)+1;h+='<div class="tiny muted" style="margin-top:4px">'+UT('sc.memKind')+'</div><div>'+esc(scMemLine(m.k,e))+'</div>'}
    else{const c=chatFor({kind:'emp',id:'emp_'+e.id,label:e.name});h+='<div class="tiny muted" style="margin-top:4px">'+esc(c.kind)+'</div><div>'+esc(c.text)+'</div>';if(c.cid)h+=UT('duty2.openChat',{a:esc(nameOf(c.cid))});
      if(c.rumorEmp){const x=G.emps.find(y=>y.id===c.rumorEmp);if(x)h+='<div class="notice tiny" style="margin-top:6px">'+esc(MSG('audit.heard',{name:x.name,rank:rankName(x.rank)}))+'</div>'}}
  }
  h+='</div>';
  if(eff)h+='<div class="tiny" style="margin-top:4px;color:#2f7d4f">'+eff+'</div>';
  if(a>=100){
    if(scSworn(e)){
      h+='<div class="notice" style="margin-top:6px">'+esc(TX(e.rank==='captain'?'staffChat.sea':'staffChat.sworn',{n:e.name}))+'</div>'+scOrders(e);
    }else if(e.rank==='clerk'||e.rank==='banto')h+='<div class="tiny muted" style="margin-top:6px">'+esc(TX('staffChat.notMaterial',{n:e.name}))+'</div>';
  }
  return h;
}
ACT.staffChat=el=>{
  const e=G.emps.find(x=>x.id===el.dataset.id);if(!e)return;
  if(scChatted(e)){toast(UT('sc.done'));return}
  const a=empAff(e),O=SC();e.chatT=G.turn;
  let eff=UT('sc.plain');
  if(a>=O.affAt&&a<100&&!scGreedy(e)){const g=Math.min(100-a,rint(O.gain[0],O.gain[1]));e.aff=a+g;eff=UT('sc.affUp',{g})}
  else if(a>=100)eff='';
  sfx.tap();UI.showInfo(UT('sc.title',{k:rankName(e.rank),n:e.name}),scBody(e,eff,true));UI.render();refreshSheet();
};
ACT.staffOrder=el=>{const e=G.emps.find(x=>x.id===el.dataset.id);if(!e||!scSworn(e))return;UI.showInfo(UT('sc.title',{k:rankName(e.rank),n:e.name}),scBody(e,'',false))};
/* 指令執行後關掉閒聊視窗 */
['assassinate','arson','chiefBook'].forEach(k=>{const f=ACT[k];ACT[k]=function(el){const inInfo=!!(el&&el.closest&&el.closest('#info-body'));f.apply(this,arguments);if(inInfo)UI.hideInfo()}});

/* ---------- 往事的記錄點 ---------- */
{const _f=sevResolve;sevResolve=function(pay){const S=G.staffEv,ok=S&&!S.done,id=S&&S.empId,ty=S&&S.type;const r=_f.apply(this,arguments);if(ok){const e=G.emps.find(x=>x.id===id);if(e)scMem(e,'sev.'+ty+'.'+(pay?'pay':'ign'))}return r}}
{const _f=promoteEmp;promoteEmp=function(id){const r=_f.apply(this,arguments);if(r&&r.ok)scMem(G.emps.find(x=>x.id===id),'promote');return r}}
{const _f=auditEmp;auditEmp=function(id){const r=_f.apply(this,arguments);if(r&&r.ok&&!r.found)scMem(G.emps.find(x=>x.id===id),'auditWrong');return r}}
{const _f=auditDecide;auditDecide=function(id,k){const r=_f.apply(this,arguments);if(r&&(k==='forgive'||k==='punish'))scMem(G.emps.find(x=>x.id===id),k);return r}}
{const _f=staffYearTick;staffYearTick=function(){const g0=new Map(G.emps.map(e=>[e,JSON.stringify(e.grow||e.stats||{})]));const r=_f.apply(this,arguments);G.emps.forEach(e=>{if(g0.has(e)&&g0.get(e)!==JSON.stringify(e.grow||e.stats||{}))scMem(e,'grow')});return r}}
{const _f=wifeResolve;wifeResolve=function(help){const C=G.wifeEv&&G.wifeEv.cur,id=C&&C.empId,kind=C&&C.kind,ok=C&&C.bad&&!C.done;const r=_f.apply(this,arguments);if(ok&&id){const e=G.emps.find(x=>x.id===id);if(e&&kind==='bully'&&!help)scMem(e,'wifeBully.ign');if(e&&kind==='quarrel')scMem(e,'wifeQuarrel.'+(help?'help':'ign'))}return r}}
{const _f=lendReturnTick;lendReturnTick=function(){const h0=new Map(G.emps.map(e=>[e,e.hurtUntil||0]));const r=_f.apply(this,arguments);G.emps.forEach(e=>{if(h0.has(e)&&(e.hurtUntil||0)>h0.get(e))scMem(e,'hurt')});return r}}
{const _f=fraudDo;fraudDo=function(){const h0=new Map(G.emps.map(e=>[e,e.hurtUntil||0]));const r=_f.apply(this,arguments);G.emps.forEach(e=>{if(h0.has(e)&&(e.hurtUntil||0)>h0.get(e))scMem(e,'fraud')});return r}}
{const _f=resolveVoyage;resolveVoyage=function(s){const top=G.voyLog&&G.voyLog[0];const r=_f.apply(this,arguments);const E=G.voyLog&&G.voyLog[0];if(E&&E!==top&&E.wreck){const e=G.emps.find(x=>x.id===s.capt);if(e)scMem(e,'wreck')}return r}}

/* ═════ [07w3_voicehook] ═════ */
/* 給零用錢、閒聊時的人聲（07e_visit.js〔07w2_voice〕）；ACT.allow、ACT.staffChat 在本檔才定義完，接點放這裡。 */
{const _f=ACT.allow;ACT.allow=function(el){const e=G.emps.find(x=>x.id===el.dataset.id),b=e&&e.allowT;const r=_f.apply(this,arguments);if(e&&e.allowT===G.turn&&b!==G.turn)setTimeout(()=>voThanks(e),120);return r}}
{const _f=ACT.staffChat;ACT.staffChat=function(el){const e=G.emps.find(x=>x.id===el.dataset.id),b=e&&e.chatT;const r=_f.apply(this,arguments);if(e&&e.chatT===G.turn&&b!==G.turn)voChat(e);return r}}
