'use strict';
/* ★檔案總覽：啟動與全域事件
 * - doTurn：「推進一旬/一月」按鈕的入口（播放轉場→呼叫 advanceTurn→重繪）。
 * - 以事件委派處理所有 data-act / data-chg；DOMContentLoaded 綁定頂部按鈕與開局。 */
/* ======================= 08 啟動、事件委派、推進時間 ======================= */
/** 推進 n 旬：播放轉場→連續呼叫 advanceTurn→重繪並提示本次白銀變化。 */
function doTurn(n){
  if(!G||G.ended||FX.busy)return;
  /* 推進前先回到主畫面：關掉開著的面板與說明視窗，旬報才不會被擋住 */
  try{if(UI.s.sheet)UI.closeSheet();if(typeof ENC==='undefined'||!ENC)$('#info-bd').classList.add('hidden');if(UI.s.tab!=='home')UI.go('home')}catch(e){}
  const before=G.silver;
  playFx('time',MSG('turn.fx'),dateStr(),()=>{
    let logs=[];const reps=[];
    for(let i=0;i<n&&!G.ended;i++){logs=logs.concat(advanceTurn());reps.push(G.report)}
    SCENE.sig='';sceneSync(true);
    UI.render();
    if(!G.ended){
      const d=G.silver-before;
      showTurnReport(reps,logs.map(t=>t.replace(/^[^【]*/,'')?t:t),n);
      say(thought());
      if(d>0)coinFx();
    }
  },n===1?1000:1400);
}
document.addEventListener('click',e=>{
  if(e.target.closest('.ticker')&&LASTREP&&G&&!G.ended){showTurnReport(LASTREP.reps,LASTREP.logs,LASTREP.n);return}
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
  $('#b-home').addEventListener('click',()=>UI.go('home'));
  $('#b-next').addEventListener('click',()=>doTurn(1));
  $('#b-next3').addEventListener('click',()=>doTurn(3));
  $('#b-purse').addEventListener('click',()=>UI.openSheet('purse'));
  $('#b-menu').addEventListener('click',()=>UI.openSheet('menu'));
  $('#d-city').parentNode.style.cursor='pointer';
  $('#d-city').parentNode.addEventListener('click',()=>{if(G)UI.openSheet('city')});
  $('#sh-close').addEventListener('click',()=>UI.closeSheet());
  $('#info-close').addEventListener('click',()=>UI.hideInfo());
  $('#info-bd').addEventListener('click',e=>{if(e.target.id==='info-bd')UI.hideInfo()});
  $('#sheet-bd').addEventListener('click',e=>{if(e.target.id==='sheet-bd')UI.closeSheet()});
  document.querySelectorAll('[data-t]').forEach(e=>{e.textContent=UT(e.dataset.t)});     // 固定按鈕文字（01e_ui_text.js）
  sceneStart();
  UI.showStart();
});
