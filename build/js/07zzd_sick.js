/* =====================================================================
 * 07zzd_sick.js — 病倒（通用機制）
 *  - 條件成立時先記下「待發作」（sickArm），等玩家離開場景（關掉面板）或直接推進一旬時立刻發作（sickFire）。
 *  - 發作：接下來兩個完整的旬不能出門（沿用養傷 G.injured，另記 G.injKind='sick' 換文字）；
 *    離開場景時當旬剩下的時間也算倒下。病好時朋友照樣上門探望。
 *  - 目前的觸發：吉原同一旬指名到第三位花魁（07l_flower.js）。之後壓力過高病倒也走這裡，只換 kind 與台詞。
 *  數值 ODDS.sick；文字 sick.*（01e、01g）、*.sick（01f）。
 * ===================================================================== */
/** 推進一旬途中（doTurn 先關面板）不算「離開場景」，留給 advanceTurn 發作。 */
let SICK_ADV=false;
/** 記下待發作。kind：flower（之後加 stress 等）。 */
function sickArm(kind){if(G&&!G.sickPend&&!((G.injured||0)>0))G.sickPend={kind,t:G.turn}}
/** 發作：設定臥病旬數（含當旬：離開場景時當旬已倒下；推進時當旬結束就扣一旬），回傳台詞。 */
function sickFire(){
  const P=G&&G.sickPend;if(!P)return null;G.sickPend=null;
  const n=(ODDS.sick[P.kind]||ODDS.sick.flower).turns;
  G.injured=Math.max(G.injured||0,n+1);G.injKind='sick';
  return {kind:P.kind,n,text:UT('sick.text.'+P.kind)};
}
/** 推進一旬時發作：寫進本旬大事（advanceTurn 開頭呼叫）。 */
function sickTurnFire(log){const s=sickFire();if(s)log.push(NEWS('sick.fall',{t:s.text,n:s.n}))}
/** 離開場景時發作：跳出視窗。 */
function sickLeaveFire(){const s=sickFire();if(!s)return;sfx.tap();UI.showInfo(UT('sick.title'),'<div class="text-prose">'+esc(s.text)+'</div><div class="tiny muted" style="margin-top:6px">'+UT('sick.days',{n:s.n})+'</div>');UI.render()}
/** 臥病時改用病的提示文字。 */
const hurtKey=k=>G&&G.injKind==='sick'&&MSG_TXT[k+'.sick']!==undefined?k+'.sick':k;
/** 吉原：同一旬指名到第幾位花魁。 */
const nomCountTurn=()=>Object.keys(G.rel||{}).filter(cid=>G.rel[cid].nomT===G.turn&&(npc(cid)||{}).role==='oiran').length;
{const _c=UI.closeSheet;UI.closeSheet=function(){const was=UI.s.sheet;_c.apply(this,arguments);if(was&&!UI.s.sheet&&!SICK_ADV&&G&&G.sickPend)sickLeaveFire()}}
{const _d=doTurn;doTurn=function(){SICK_ADV=true;try{return _d.apply(this,arguments)}finally{SICK_ADV=false}}}
