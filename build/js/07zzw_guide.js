'use strict';
/* ★檔案總覽：開業指引（DESIGN_NOTES 第二百八十三節）
 * - 每一世開局帶一次，只到第一次推進：① 出席例會 → ② 回相場 → ③ 按「照配額」或動進出貨拉霸 → ④ 按「推進一旬」。
 * - 狀態 G.guide={s:1～4}；結束（推進、按「不用帶了」）設為 null。舊存檔沒有就是 null，不帶。
 * - 玩家沒照順序走也行：在 ① 或 ② 進相場就跳到 ③；沒去例會就推進，例會照規則自動決議，指引照樣結束。
 * - 主畫面與相場頂端一張小卡；要按的東西加閃動金框（.guide-glow），② 時底部「相場」亮紅點。
 * - 文字 guide.*、btn.guideSkip（01e）；樣式 .guide-glow（style.css）。 */
const guideOn=()=>!!(G&&G.guide&&!G.ended);
/** 依目前狀態把步驟往前推（只進不退）。 */
function guideSync(){
  if(!guideOn())return;
  const g=G.guide;
  if(g.s===1){const M=meetNow();if(!M||M.done||(M.att&&!UI.s.sheet))g.s=2}
  if(g.s<=2&&UI.s.tab==='market')g.s=3;
}
/** 第 n 步的小卡。 */
function guideCard(){
  const s=G.guide.s;
  return '<div class="notice" id="guide-card" style="margin:6px 0;border-color:#e5a93b"><div class="row"><b class="small">'+UT('guide.title',{s,n:4})+'</b><span class="tiny" style="text-decoration:underline;cursor:pointer" data-act="guideSkip">'+UT('btn.guideSkip')+'</span></div><div class="small" style="margin-top:3px">'+UT('guide.'+s)+'</div></div>';
}
/** 重繪後套上指引：小卡、閃框、紅點。 */
function guideApply(){
  $$('.guide-glow').forEach(e=>e.classList.remove('guide-glow'));
  {const old=$('#guide-card');if(old)old.remove()}
  if(!guideOn())return;
  guideSync();
  const s=G.guide.s,tab=UI.s.tab;
  if(tab==='home'){const tip=$('#home-tip');if(tip){tip.classList.add('hidden');tip.insertAdjacentHTML('beforebegin',guideCard())}}
  else if(tab==='market'&&s>=3){const v=$('#view-market');if(v)v.insertAdjacentHTML('afterbegin',guideCard())}
  const glow=el=>{if(el)el.classList.add('guide-glow')};
  if(s===1)glow($('#guild-meet .loc')||$('#guild-meet button'));
  if(s===2){const b=$('#bottom button[data-tab="market"]');glow(b);if(b&&!b.querySelector('.nav-dot')){const d=document.createElement('i');d.className='nav-dot';b.appendChild(d)}}
  if(s===3)glow($('[data-act="planQuota"]'));
  if(s===4)$$('#b-next,.home-next').forEach(glow);
}
{const _r=UI.render;UI.render=function(){const r=_r.apply(this,arguments);try{guideApply()}catch(e){}return r}}
{const _c=UI.closeSheet;UI.closeSheet=function(){const r=_c.apply(this,arguments);if(guideOn())UI.render();return r}}
/** 按「照配額」或動過進出貨拉霸：到第 4 步。 */
const guideTouched=()=>{if(guideOn()&&G.guide.s<4){G.guide.s=4;guideApply()}};
{const _q=ACT.planQuota;ACT.planQuota=function(){if(guideOn()&&G.guide.s<4)G.guide.s=4;return _q.apply(this,arguments)}}
document.addEventListener('change',e=>{   // 拉霸放開、兩側加減鈕都會觸發 change
  if(e.target&&(e.target.id==='slider-ship'||e.target.id==='slider-buy'))guideTouched()});
ACT.guideSkip=()=>{if(G)G.guide=null;UI.render();sfx.tap()};
/** 第一次推進：指引結束。 */
{const _a=advanceTurn;advanceTurn=function(){if(G&&G.guide)G.guide=null;return _a.apply(this,arguments)}}
