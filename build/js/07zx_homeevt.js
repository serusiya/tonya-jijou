'use strict';
/* ======================= 回府時的事件（第一百六十一節） =======================
 *  第三個事件切入點：這一旬只要用掉行動點數（出門前往、商路出發、私房錢、宴客……），做完回到主畫面時，若有排隊的事件就跳出一件（每次最多一件）。
 *  開頭一句：出門回來＝「你回到店裡……」；在店裡做的事＝「正忙著，帳房進來說有人求見……」。
 *  - 排在這裡的：商人借錢、大番頭回報意外之財、浪人要錢、分號來訪、店員急事、夫人事件（07zzh_wife.js）。
 *  - 這一旬沒輪到的，推進一旬時全部作廢：借錢＝婉拒；意外之財與分號送錢＝沒有這筆錢；浪人、分號調貨＝不算回絕；店員急事＝不算「不管」。
 *  - 輪到時才入帳的錢（意外之財、分號送錢）記在 G.carryIn，算進下一期旬報。
 *  旬報後的事件（查貨、官員索賄、官吏硬塞貨、暖簾分提議）仍走 07s_face_events.js 的 queueFaceEvent。 */
const homeQ=()=>G.homeEvents||(G.homeEvents=[]);
/** 排進「回府時」。 */
function queueHomeEvent(e){if(G&&e){e.turn=G.turn;homeQ().push(e)}}
/** 推進一旬時：沒輪到的全部作廢。 */
function homeEventsVoid(){G.homeEvents=[]}
/** 事件視窗標題。 */
function faceTitle(e){
  return ({windfall:UT('face.title'),extort:UT('face.title.2'),xforce:UT('face.title.3'),xloan:UT('face.title.4'),inspect:UT('face.title.5'),staff:UT('face.title.staff'),ronin:UT('face.title.ronin'),
    branch:UT('face.title.branch'),branchPay:UT('face.title.branch'),branchAsk:UT('face.title.branchAsk')})[e.type]||(FACE_TITLE[e.type]&&UT(FACE_TITLE[e.type]))||UT('face.faceEventCard');
}
/** 輪到時才發生的效果（入帳）。 */
function homeEventApply(e){
  if(e.type==='windfall'){
    G.silver+=e.amt;G.carryIn=G.carryIn||{};G.carryIn.windfall=(G.carryIn.windfall||0)+e.amt;sfx.coin();
    const b=(G.emps||[]).find(x=>x.id===e.empId);if(b)b.wind=(b.wind||0)+e.amt;
    pushNews(NEWS('chief.windfall',{amt:fmt(e.amt)}));
  }else if(e.type==='branchPay'){
    G.silver+=e.amt;G.carryIn=G.carryIn||{};G.carryIn.branch=(G.carryIn.branch||0)+e.amt;sfx.coin();
    pushNews(NEWS('branch.pay',{b:branchName(),a:fmt(e.amt)}));
  }else if(e.type==='staff'&&G.staffEv)G.staffEv.shown=true;
}
/** 跳出一件（lead：開頭那句的文字鍵）。 */
function showHomeEvent(lead){
  if(!G||G.ended)return;
  const q=homeQ().filter(e=>e.turn===G.turn);G.homeEvents=q;
  let e,h;
  while(q.length&&!h){e=q.shift();h=faceEventCard(e)}
  if(!h){save();return}
  homeEventApply(e);save();
  INFO_AFTER=null;
  UI.showInfo(faceTitle(e),UT(lead||'home.evt.lead')+h);UI.render();
}
/* 觸發：這一旬用掉行動點數後，回到主畫面（主頁分頁、沒有面板／視窗／動畫）時跳一件。
 *  UI.s.apMark 記這一旬上次檢查時的行動點數；UI.s.outGo 記出門（goTo）時的點數，用來選開頭那句。 */
const homeIdle=()=>UI.s.tab==='home'&&!UI.s.sheet&&$('#info-bd').classList.contains('hidden')&&$('#start').classList.contains('hidden')
  &&!(typeof FX!=='undefined'&&FX.busy)&&!(typeof VIS!=='undefined'&&VIS.busy)&&!(typeof BT!=='undefined'&&BT)&&!(typeof ENC!=='undefined'&&ENC);
let HOME_T=null;
function homeCheck(){
  HOME_T=null;
  if(!G||G.ended)return;
  const m=UI.s.apMark;
  if(!m||m.turn!==G.turn){UI.s.apMark={turn:G.turn,ap:G.ap};return}
  if(G.ap>=m.ap){m.ap=G.ap;return}
  if(!homeIdle())return;
  m.ap=G.ap;
  const o=UI.s.outGo,out=!!(o&&o.turn===G.turn&&G.ap<o.ap);UI.s.outGo=null;
  if(homeQ().some(e=>e.turn===G.turn))showHomeEvent(out?'home.evt.lead':'home.evt.leadShop');
}
const homeSoon=()=>{if(!HOME_T)HOME_T=setTimeout(homeCheck,60)};
{const _go=goTo;goTo=function(k){UI.s.outGo={ap:G.ap,turn:G.turn};_go(k)}}
{const _r=UI.render;UI.render=function(){_r.apply(this,arguments);homeSoon()}}
{const _h=UI.hideInfo;UI.hideInfo=function(){_h.apply(this,arguments);homeSoon()}}
{const _c=UI.closeSheet;UI.closeSheet=function(){_c.apply(this,arguments);homeSoon()}}
