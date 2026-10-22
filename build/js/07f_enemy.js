/* =====================================================================
 * 07f_enemy.js — 仇人
 *  - 每個人記錄「曾經最高好感度」r.peak。
 *  - 仇人 ＝ 曾經最高好感度 − 目前好感度 ≥ 40（例：曾經 40、現在 0）。
 *  - 每位在世的仇人：出門遇襲機率 +3%、倉庫失火機率 +2%、盜賊上門機率 +2%。
 *  - peak 只會升不會降；好感變動散在各處，所以在每次重繪與推進一旬時統一同步。
 * ===================================================================== */

/** 仇人門檻：最高好感與目前好感的落差達到此值（含）。 */
const ENEMY_GAP=40;
/** 辭退員工扣的好感。 */
const FIRE_AFF=40;
/** 每位仇人增加的機率：遇襲、失火、盜賊。 */
const ENEMY_AMBUSH=ODDS.ambush.perEnemy,ENEMY_FIRE=ODDS.enemyFire.p,ENEMY_THIEF=ODDS.enemyThief.p;

/** 同步所有人物的「曾經最高好感度」（舊存檔從目前好感起算）。 */
function syncPeaks(){
  if(!G||!G.rel)return;
  Object.values(G.rel).forEach(r=>{if(r.peak===undefined||r.aff>r.peak)r.peak=r.aff});
  introResign();
}
/** 介紹人成了仇人：自動請辭，改由系統另選。 */
function introResign(){
  if(!G.intros||!G.intros.length)return;
  const gone=G.intros.filter(i=>isEnemy(i.cid));if(!gone.length)return;
  G.intros=G.intros.filter(i=>!gone.includes(i));
  gone.forEach(i=>{const t='🤝【請辭】「'+nameOf(i.cid)+'」與你反目，辭去介紹人。';pushNews(t);logRel(i.cid,'與你反目，辭去介紹人。');try{toast(t,4200)}catch(e){}});
  autoIntro(null);
}
/** 某人是否為仇人（在世且已有往來）。 */
function isEnemy(cid){
  const r=G.rel[cid];if(!r||!r.bond||!CH(cid)||!alive(cid))return false;
  return (r.peak!==undefined?r.peak:r.aff)-r.aff>=ENEMY_GAP;
}
/** 目前仇人名單。 */
function enemies(){syncPeaks();return Object.keys(G.rel).filter(isEnemy)}
/** 仇人數量。 */
const enemyCount=()=>enemies().length;
/** 每旬：仇人額外引來盜賊（每位 +2%）；失火與遇襲機率在各自函式中加成。 */
function enemyTick(log){
  const n=enemyCount();if(!n||!chance(ENEMY_THIEF*n))return;
  const t=thieves();if(t){const m=NEWS('enemyTick.1',{replace:t.replace(/^[^】]*】/,'')});pushNews(m);log.push(m)}
}
