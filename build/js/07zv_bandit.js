'use strict';
/* ======================= 海賊／山賊猖獗（第一百五十四節） =======================
 *  全國每年一次：隨機一旬、隨機一個地區，海賊或山賊二選一，持續三旬（含當旬）。G.bandit＝{type:'sea'|'land',region,start,until,cleared}。
 *  - 發生在外地：只有旬報一則新聞。
 *  - 發生在本地區：海賊＝船長不能出海（委託採買、走私），山賊＝飛腳不能出發；這三旬內回程的船（海賊）或馬幫（山賊）一律被劫，損失比照遇險（七成）。
 *  - 私梟「買通」（私房錢 300 兩、風聲 +0.5）：當旬出發與當旬推進時回程的隊伍都放行（G.banditPass＝買通那一旬）。
 *  - 船奉行（海賊）／道中奉行（山賊）「討伐」（現款 3000 兩、不扣好感、知名度 +3）：立刻解除。
 *  - 不算官吏混亂（第一節）。數值 ODDS.bandit；花費 COSTS.banditBribe、banditQuell。 */
const homeRegion=()=>homeCity().region_id;
/** 本地區某類賊亂是否正在進行（未討平）。 */
const banditHome=type=>{const B=G&&G.bandit;return !!(B&&!B.cleared&&B.region===homeRegion()&&(!type||B.type===type)&&G.turn>=B.start&&G.turn<B.until)};
const banditLeft=()=>G.bandit?G.bandit.until-G.turn:0;
/** 出發是否被擋（當旬買通則放行）。 */
const banditBlocks=mode=>banditHome(mode)&&G.banditPass!==G.turn;
/** 推進一旬時，回程的隊伍是否被劫（上一旬買通則放行）。 */
const banditRobs=mode=>banditHome(mode)&&G.banditPass!==G.turn-1;
/** 每旬：排定今年的賊亂、到期發生、本地區平息時寫旬報。 */
function banditTick(log){
  const idx=(G.month-1)*3+G.cycle-1;
  if(!G.banditPlan||G.banditPlan.y!==G.year)G.banditPlan={y:G.year,t:rint(idx,35)};
  const B=G.bandit;
  if(B&&!B.cleared&&B.region===homeRegion()&&G.turn===B.until){const t=NEWS('bandit.calm.'+B.type);pushNews(t);log.push(t)}
  if(G.banditPlan.t!==idx||G.banditPlan.done)return;
  G.banditPlan.done=true;
  const type=chance(0.5)?'sea':'land',region=pick(REG_LIST).id;
  G.bandit={type,region,start:G.turn,until:G.turn+ODDS.bandit.turns,cleared:false};
  const t=region===homeRegion()?NEWS('bandit.home.'+type):NEWS('bandit.far.'+type,{r:REG_NAME(region)});pushNews(t);log.push(t);
}
/** 商路、走私面板上的封鎖提示。 */
const banditNotice=mode=>banditBlocks(mode)?'<div class="notice" style="border-color:#b3261e">'+UT('bandit.notice.'+mode,{n:banditLeft()})+'</div>':'';
/* ---------- 私梟：買通 ---------- */
function banditBribeReq(){
  const B=G.bandit;if(!banditHome()||G.banditPass===G.turn)return null;
  return {k:'bribeBandit',name:UT('bandit.bribe.'+B.type),desc:UT('bandit.bribe.d',{a:fmt(costOf('banditBribe'))})};
}
function banditBribeDo(cid){
  const r=R(cid);if(!banditHome())return UT('bandit.bribe.none');
  if(!afford('banditBribe'))return shortMsg('banditBribe');
  spend('banditBribe');addHeat(ODDS.bandit.bribeHeat);G.banditPass=G.turn;
  setAff(r,Math.max(0,r.aff-REQ_AFF.normal));r.dealT=G.turn;logRel(cid,UT('bandit.bribe.log',{a:REQ_AFF.normal}));
  return UT('bandit.bribe.ok.'+G.bandit.type,{a:nameOf(cid),b:REQ_AFF.normal});
}
/* ---------- 船奉行／道中奉行：討伐 ---------- */
REG_FAVORS.push({k:'rquellSea',bandit:'sea',name:UT('fav.rquellSea'),rank:5,pos:['reg_08'],desc:UT('fav.rquellSea.d')});
REG_FAVORS.push({k:'rquellLand',bandit:'land',name:UT('fav.rquellLand'),rank:5,pos:['reg_07'],desc:UT('fav.rquellLand.d')});
/** 討伐請託只在本地區賊亂期間、向本地區的官員開口時出現。 */
const banditFavorOpen=(f,n)=>banditHome(f.bandit)&&CITY(n.cityId).region_id===homeRegion();
function doBanditFavor(cid,n,r,f){
  if(!banditFavorOpen(f,n))return {ok:true,status:'held',msg:MSG('bandit.quell.closed')};
  if(!afford('banditQuell'))return {ok:true,status:'held',msg:shortMsg('banditQuell')};
  spend('banditQuell');G.bandit.cleared=true;const fm=addFame(ODDS.bandit.quellFame,'major');
  const t=NEWS('bandit.quelled.'+f.bandit,{n:nameOf(cid)});pushNews(t);
  const msg=MSG('bandit.quell.ok.'+f.bandit,{f:fm});logRel(cid,MSG('log.relief',{f:f.name,m:msg}));
  return {ok:true,status:'done',msg};
}
