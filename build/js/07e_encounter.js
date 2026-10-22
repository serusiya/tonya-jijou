/* =====================================================================
 * 07e_encounter.js — 路遇急難
 *  - 「出門前往」沒遇襲時，有 10% 機率路上遇到一個人向你求助 10 兩救急。
 *  - 抽人：官階 1～2（含非官員）佔 50%，官階越高機率越低；認識／不認識各 50%。
 *  - 給錢：不認識者變成認識、好感直接 30（不論性向）；認識者好感 +30。不給：什麼都不發生。
 *  - 不扣行動點數；金額由現款支付。
 * ===================================================================== */

/** 路遇機率。 */
const ENC_CHANCE=ODDS.encounter.p;
/** 救急金額（現款）。 */
const ENC_COST=costOf('encounter');
/** 官階分組權重：官階 ≤2（含非官員）50%，3 階 22%，4 階 14%，5 階 9%，6 階 5%。 */
const ENC_TIER_W={1:50,3:22,4:14,5:9,6:5};
/** 目前等待玩家回應的路遇：{cid,cont}。 */
var ENC=null;

/** 人物的路遇官階分組（非官員、官階 1～2 皆為 1）。 */
function encTier(n){const rk=n.pos?n.pos.rank:1;return rk<=2?1:rk}
/** 擲路遇：回傳 {cid} 或 null。 */
function rollEncounter(){
  if(G.encounterTurn===G.turn)return null;                 // 同一旬至多遇到一次急難救助
  if(!chance(ENC_CHANCE))return null;
  const all=Object.values(G.world.npcs).filter(n=>alive(n.cid)&&!(G.emps||[]).some(e=>e.cid===n.cid));
  if(!all.length)return null;
  const wantKnown=chance(ODDS.encounter.known);
  let pool=all.filter(n=>!!R(n.cid).bond===wantKnown);
  if(!pool.length)pool=all;
  // 先依官階分組權重抽組，再於組內隨機
  const groups={};pool.forEach(n=>{(groups[encTier(n)]=groups[encTier(n)]||[]).push(n)});
  const ks=Object.keys(groups);let tot=ks.reduce((a,k)=>a+(ENC_TIER_W[k]||5),0),r=rnd()*tot,g=ks[0];
  for(const k of ks){r-=ENC_TIER_W[k]||5;if(r<=0){g=k;break}}
  G.encounterTurn=G.turn;
  return {cid:pick(groups[g]).cid};
}
/** 急難的原因（純氛圍）。 */
const ENC_WHY=Ls('enc.why');                                   // 台詞在 01d_lines.js
/** 顯示路遇彈窗；cont 為處理完後繼續出門的動作。 */
function showEncounter(enc,cont){
  ENC={cid:enc.cid,cont};
  const n=npc(enc.cid),c=CH(enc.cid),r=R(enc.cid),known=!!r.bond;
  const role=n.pos?posTitle(n):(ROLE_LABEL[n.role]||'');
  const h='<div class="card warn" style="display:flow-root">'+portraitHtml(enc.cid,56)+'<div><b style="font-size:15px">'+esc(c.name)+'</b> <span class="tag gray">'+esc(role)+'</span> '+(known?'<span class="tag green">舊識</span>':'<span class="tag">素不相識</span>')+'</div>'
   +'<div class="small" style="margin:6px 0">'+esc(TX('enc.ask',{why:ENC_WHY[Math.floor(rnd()*ENC_WHY.length)],cost:ENC_COST}))+'</div>'
   +'<div class="grid2"><button class="pixel-btn btn-gold btn-sm" data-act="encGive">'+UT('btn.encGive',{c:ENC_COST})+'</button><button class="pixel-btn btn-sm" data-act="encNo">'+UT('btn.encNo')+'</button></div></div>';
  UI.showInfo('🚶 路遇急難',h);
}
/** 結束路遇並繼續出門。 */
function encFinish(){const e=ENC;ENC=null;UI.hideInfo();if(e&&e.cont)e.cont()}
ACT.encGive=()=>{
  if(!ENC)return;
  if(!afford('encounter')){toast(MSG('encGive.noMoney',{short:shortMsg('encounter')}));return}
  const cid=ENC.cid,r=R(cid),n=npc(cid);
  spend('encounter');
  if(!r.bond){
    r.bond={mult:0.6,label:'雪中送炭',introId:null};r.met=true;r.seen=true;addKnown(cid);
    r.aff=Math.max(r.aff,30);
    if(!r.fameGot){r.fameGot=true;addFame(n&&n.pos?0.5*n.pos.rank:0.4)}
    toast(MSG('encGive.1',{cid:nameOf(cid)}));
  }else{
    r.aff=clamp(r.aff+30,0,100);toast(MSG('encGive.2',{cid:nameOf(cid)}));
  }
  logRel(cid,'路遇急難，贈銀 '+ENC_COST+' 兩救急，好感提升。');addFame(0.2);sfx.coin();
  UI.render();encFinish();
};
ACT.encNo=()=>{if(ENC)encFinish()};
/* 直接按「關閉」等同不理會，仍繼續出門 */
(function(){const h=UI.hideInfo;UI.hideInfo=function(){h();if(ENC){const e=ENC;ENC=null;if(e.cont)e.cont()}}})();
