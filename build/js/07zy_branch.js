'use strict';
/* ======================= 暖簾分：大番頭到隔壁城開分號（第一百六十節） =======================
 *  - 提議（旬報後）：大番頭任職滿一年（以升任大番頭起算）、累計意外之財超過 10,000 兩、店裡現款多過他的累計意外之財、目前沒有經營中的分號。
 *    答應付 2,000 兩；回絕後這位大番頭不再提（e.noBranch）。
 *  - 答應後他離開商號，到本地區最近的另一座城開分號。分號不是人物：不能拜訪；名冊人物出身者從本城名單中消失（身分改為「分號東家」、移到分號城）。
 *  - 第一階段（回府時）：每旬 10% 來調一批隨機本業貨（約一旬的協議配額或穩定供貨線）；倉庫不夠只能回絕。給滿 10 次送 8,000～12,000 兩、進入第二階段；累計回絕 3 次分號倒閉。
 *  - 第二階段（回府時）：每旬 5% 送 3,000～5,000 兩，永遠持續。
 *  - 一次只能一家；倒閉後下一位符合條件的大番頭才能再開。數值 ODDS.branch；狀態 G.branch。 */
const branchName=()=>G.branch?UT('branch.name',{f:(SYS_BY_KEY[G.sysKey]||{}).firm||'',c:CITY(G.branch.cityId)?CITY(G.branch.cityId).name:'',n:G.branch.name}):'';
const branchOpen=()=>!!(G.branch&&!G.branch.closed);
/** 大番頭升任起算的年資。 */
const chiefTenure=e=>G.turn-(e.promotedAt!==undefined?e.promotedAt:e.since);
/** 本地區最近的另一座城（沒有就全國最近）。 */
function branchCity(){
  const a=homeCity(),d=ct=>Math.min(distTurns(a,ct,'land')||99,distTurns(a,ct,'sea')||99);
  const L=CITIES.filter(c=>c.id!==a.id),same=L.filter(c=>c.region_id===a.region_id);
  return (same.length?same:L).slice().sort((x,y)=>d(x)-d(y))[0];
}
/** 每旬：提議（旬報後）、分號來訪（回府時）。 */
function branchTick(log){
  const O=ODDS.branch,B=G.branch;
  if(branchOpen()){
    if(B.phase===1&&chance(O.visitP)){
      const L=tradeComms();if(L.length){const c=pick(L),q=Math.max(1,Math.round(Math.max(quotaOf(c.name),supplyLine(c.name))));queueHomeEvent({type:'branch',name:c.name,qty:q})}
    }else if(B.phase===2&&chance(O.payP))queueHomeEvent({type:'branchPay',amt:rint(O.payMin,O.payMax)});
    return;
  }
  const b=empsOf('chief')[0];
  if(!b||b.noBranch||b.fleeAt!==undefined||chiefTenure(b)<O.tenure||!((b.wind||0)>O.wind)||!(G.silver>(b.wind||0)))return;
  if(faceEventQueue().some(e=>e.type==='branchAsk'))return;
  queueFaceEvent({type:'branchAsk',empId:b.id,turn:G.turn});
}
/** 人物事件卡（07s_face_events.js 呼叫）：提議、調貨、送錢。 */
function branchCard(e){
  if(e.type==='branchAsk'){
    const b=(G.emps||[]).find(x=>x.id===e.empId);if(!b||branchOpen()||b.noBranch)return null;const c=branchCity();
    return {line:TX('branch.ask',{c:c.name}),effect:UT('branch.ask.d',{a:fmt(costOf('branchOpen')),c:c.name}),
      buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="branchYes" data-id="'+b.id+'" '+(afford('branchOpen')?'':'disabled')+'>'+UT('btn.branchYes',{c:coinHtml('silver',costOf('branchOpen'))})+'</button><button class="pixel-btn btn-sm" data-act="branchNo" data-id="'+b.id+'">'+UT('btn.branchNo')+'</button></div>'};
  }
  if(!branchOpen())return null;
  if(e.type==='branch'){
    const c=COMM_MAP[e.name];if(!c||G.branch.phase!==1)return null;const have=G.inv[e.name]||0;
    return {line:TX('branch.visit',{g:c.short,q:e.qty}),effect:UT('branch.visit.d',{g:c.short,q:e.qty,h:have,n:G.branch.given,r:G.branch.refused}),
      buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="branchGive" '+(have<e.qty?'disabled':'')+'>'+UT('btn.branchGive')+'</button><button class="pixel-btn btn-sm" data-act="branchRefuse">'+UT('btn.branchRefuse')+'</button></div>'};
  }
  if(e.type==='branchPay'){if(G.branch.phase!==2)return null;return {line:TX('branch.pay'),effect:UT('branch.pay.d',{a:fmt(e.amt)})}}
  return null;
}
/** 卡片頭部：分號沒有頭像（名冊人物出身的才有）。 */
function branchHead(e){
  if(e.type==='branchAsk'){const b=(G.emps||[]).find(x=>x.id===e.empId);return b?{pt:portraitEmp(b,56),name:b.name,tag:rankName(b.rank)}:null}
  const B=G.branch;return {pt:B&&B.cid&&CH(B.cid)?portraitHtml(B.cid,56):'',name:B?B.name:'',tag:branchName()};
}
ACT.branchYes=el=>{
  const b=(G.emps||[]).find(x=>x.id===el.dataset.id);if(!b||branchOpen()){UI.hideInfo();return}
  if(!afford('branchOpen')){toast(shortMsg('branchOpen'));return}
  spend('branchOpen');const c=branchCity();
  G.branch={name:b.name,cid:b.cid||null,cityId:c.id,phase:1,given:0,refused:0,since:G.turn,closed:false};
  G.emps=G.emps.filter(x=>x!==b);
  if(b.cid&&npc(b.cid)){const n=npc(b.cid);n.hired=false;n.cityId=c.id;n.role='branch';n.pos=null}   // 從本城名單中消失
  const t=NEWS('branch.open',{n:b.name,b:branchName()});pushNews(t);
  sfx.gift();UI.hideInfo();toast(MSG('branch.open',{n:b.name,c:c.name}),5200);UI.render();
};
ACT.branchNo=el=>{const b=(G.emps||[]).find(x=>x.id===el.dataset.id);if(b)b.noBranch=true;UI.hideInfo();toast(MSG('branch.no',{n:b?b.name:''}),3600);UI.render()};
/** 目前顯示中的分號調貨事件（回府時）。 */
let BRANCH_EV=null;
ACT.branchGive=()=>{
  const e=BRANCH_EV,B=G.branch;if(!e||!branchOpen()||B.phase!==1){UI.hideInfo();return}
  if((G.inv[e.name]||0)<e.qty){toast(MSG('branch.short'));return}
  stockTake(e.name,e.qty,false);B.given++;BRANCH_EV=null;
  let msg=MSG('branch.given',{n:B.name});
  if(B.given>=ODDS.branch.times){
    const amt=rint(ODDS.branch.repayMin,ODDS.branch.repayMax);G.silver+=amt;G.carryIn=G.carryIn||{};G.carryIn.branch=(G.carryIn.branch||0)+amt;B.phase=2;
    pushNews(NEWS('branch.repay',{b:branchName(),a:fmt(amt)}));msg=MSG('branch.repay',{n:B.name,a:fmt(amt)});sfx.coin();
  }
  UI.hideInfo();toast(msg,4600);UI.render();
};
ACT.branchRefuse=()=>{
  const B=G.branch;BRANCH_EV=null;if(!branchOpen()){UI.hideInfo();return}
  B.refused++;let msg=MSG('branch.refused',{n:B.name});
  if(B.refused>=ODDS.branch.refuse){B.closed=true;pushNews(NEWS('branch.closed',{b:branchName()}));msg=MSG('branch.closed',{n:B.name})}
  UI.hideInfo();toast(msg,4600);UI.render();
};
