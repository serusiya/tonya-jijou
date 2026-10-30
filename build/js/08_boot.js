'use strict';
/* ★檔案總覽：啟動與全域事件
 * - doTurn：「推進一旬」按鈕的入口（播放轉場→呼叫 advanceTurn→重繪）。
 * - 以事件委派處理所有 data-act / data-chg；DOMContentLoaded 綁定頂部按鈕與開局。 */
/* ======================= 08 啟動、事件委派、推進時間 ======================= */
/** 推進 n 旬：播放轉場→連續呼叫 advanceTurn→重繪並提示本次現款變化。 */
function doTurn(n){
  if(!G||G.ended||FX.busy)return;
  /* 推進前先回到主畫面：關掉開著的面板與說明視窗，旬報才不會被擋住 */
  try{if(UI.s.sheet)UI.closeSheet();if(typeof ENC==='undefined'||!ENC)$('#info-bd').classList.add('hidden');if(UI.s.tab!=='home')UI.go('home')}catch(e){}
  const before=G.silver,head=G.news[0];          // head：推進前最新的一則瓦版，用來找出這段期間新出的消息
  playFx('time',MSG('turn.fx'),dateStr(),()=>{
    let logs=[];const reps=[];
    for(let i=0;i<n&&!G.ended;i++){logs=logs.concat(advanceTurn());reps.push(G.report)}
    {const fresh=[];for(const x of G.news){if(x===head)break;fresh.push(x.t)}   // 只上瓦版的消息（行情、同業、節慶）也併入本旬大事
     fresh.reverse().forEach(t=>{if(!logs.includes(t))logs.push(t)})}
    SCENE.sig='';sceneSync(true);
    UI.render();
    if(!G.ended){
      const d=G.silver-before;
      showTurnReport(reps,logs,n);
      if(G.party)INFO_AFTER=showParty;else armFaceEvents();   // 年底：旬報後先開忘年會，散會後再接人物事件
      say(thought());
      if(d>0)coinFx();
    }
  },n===1?1000:1400);
}
document.addEventListener('click',e=>{
  if(e.target.closest('.ticker')&&G&&!G.ended){const L=LASTREP||G.lastRep||{reps:[{}],logs:G.ticker.slice(0,8),n:0,kind:'recent'};showTurnReport(L.reps,L.logs,L.n,L.kind);return}   // 瓦版：重開上一份旬報
  const el=e.target.closest('[data-act]');if(!el||el.dataset.act==='none')return;
  const f=ACT[el.dataset.act];if(f){e.preventDefault();f(el)}
});
document.addEventListener('change',e=>{
  const el=e.target.closest('[data-chg]');if(el&&CHG[el.dataset.chg])CHG[el.dataset.chg](el);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#info-bd').classList.contains('hidden'))UI.hideInfo();else UI.closeSheet()}});
window.addEventListener('DOMContentLoaded',()=>{
  $$('.loc').forEach(el=>el.dataset.act='go');
  $$('#bottom button').forEach(b=>b.addEventListener('click',()=>{UI.go(UI.s.tab===b.dataset.tab?'home':b.dataset.tab)}));
  $('#b-next').addEventListener('click',()=>doTurn(1));
  $('#b-menu').addEventListener('click',()=>UI.openSheet('menu'));
  $('#sh-close').addEventListener('click',()=>UI.closeSheet());
  $('#info-close').addEventListener('click',()=>UI.hideInfo());
  $('#info-bd').addEventListener('click',e=>{if(e.target.id==='info-bd')UI.hideInfo()});
  $('#sheet-bd').addEventListener('click',e=>{if(e.target.id==='sheet-bd')UI.closeSheet()});
  document.querySelectorAll('[data-t]').forEach(e=>{e.textContent=UT(e.dataset.t)});document.querySelectorAll('[data-tt]').forEach(e=>{e.title=UT(e.dataset.tt)});     // 固定按鈕文字（01e_ui_text.js）
  sceneStart();
  UI.showStart();
});
