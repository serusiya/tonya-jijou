/* =====================================================================
 * 07f_enemy.js — 仇人
 *  - 每個人記錄「曾經最高好感度」r.peak。
 *  - 仇人 ＝ 曾經最高好感度 − 目前好感度 ≥ 40（例：曾經 40、現在 0）。
 *  - 每位在世的仇人：出門遇襲機率 +3%、倉庫失火機率 +2%、盜賊上門機率 +2%。
 *  - peak 只會升不會降；好感變動散在各處，所以在每次重繪與推進一旬時統一同步。
 *  - 淡忘：成仇滿 36 旬（期間好感一次再掉 5 以上就重新起算），peak 重設為目前好感，不再是仇人；好感本身不變。
 *    軟肋是 grudge（心胸狹隘睚眥必報）的人不會淡忘（畫面不提示，讓玩家自己發現）。
 * ===================================================================== */

/** 仇人門檻：最高好感與目前好感的落差達到此值（含）。 */
const ENEMY_GAP=40;
/** 仇人自然淡忘的旬數。 */
const ENEMY_FADE=36;
/** 辭退員工扣的好感。 */
const FIRE_AFF=40;
/** 每位仇人增加的機率：遇襲、失火、盜賊。 */
const ENEMY_AMBUSH=ODDS.ambush.perEnemy,ENEMY_FIRE=ODDS.enemyFire.p,ENEMY_THIEF=ODDS.enemyThief.p;

/** 同步所有人物的「曾經最高好感度」（舊存檔從目前好感起算）。 */
function syncPeaks(){
  if(!G||!G.rel)return;
  Object.values(G.rel).forEach(r=>{if(r.lockAff)r.aff=100;if(r.peak===undefined||r.aff>r.peak)r.peak=r.aff});   // 生死之交的好感鎖在 100（保險：萬一有漏網的改法）
  Object.keys(G.rel).forEach(cid=>{                // 記下成仇（或再被得罪）的那一旬，供淡忘計時
    const r=G.rel[cid];
    if(isEnemy(cid)){if(r.enemyT===undefined||r.aff<=r.enemyAff-5)r.enemyT=G.turn;r.enemyAff=r.aff}   // 一次掉 5 以上才算再被得罪（名伶久未點召的 −4 疏遠不算）
    else if(r.enemyT!==undefined){delete r.enemyT;delete r.enemyAff}
  });
  introResign();
}
/** 介紹人成了仇人：自動請辭，改由系統另選。 */
function introResign(){
  if(!G.intros||!G.intros.length)return;
  const gone=G.intros.filter(i=>isEnemy(i.cid));if(!gone.length)return;
  G.intros=G.intros.filter(i=>!gone.includes(i));
  gone.forEach(i=>{const t=NEWS('enemy.introQuit',{a:nameOf(i.cid)});pushNews(t);logRel(i.cid,UT('enemy.introResign'));try{toast(t,4200)}catch(e){}});
  autoIntro(null);
}
/** 某人是否為仇人（在世且已有往來）。 */
function isEnemy(cid){
  const r=G.rel[cid];if(!r||r.lockAff||!r.bond||!CH(cid)||!alive(cid))return false;
  return (r.peak!==undefined?r.peak:r.aff)-r.aff>=ENEMY_GAP;
}
/** 目前仇人名單。 */
function enemies(){syncPeaks();return Object.keys(G.rel).filter(isEnemy)}
/** 仇人數量。 */
const enemyCount=()=>enemies().length;
/** 每旬：仇人額外引來盜賊（每位 +2%）；失火與遇襲機率在各自函式中加成。 */
function enemyTick(log){
  syncPeaks();
  Object.keys(G.rel).forEach(cid=>{                // 成仇滿 36 旬：怨氣淡去（睚眥必報者除外）
    const r=G.rel[cid];if(r.enemyT===undefined||G.turn-r.enemyT<ENEMY_FADE||!isEnemy(cid))return;
    if(CH(cid).weakness==='grudge')return;
    r.peak=r.aff;delete r.enemyT;delete r.enemyAff;
    const m=NEWS('enemy.fade',{name:nameOf(cid)});pushNews(m);log.push(m);logRel(cid,UT('enemy.enemyTick'));
  });
  const n=enemyCount();if(!n||!chance(ENEMY_THIEF*n))return;
  const t=thieves();if(t){const m=NEWS('enemyTick.1',{replace:t.replace(NEWS_FMT.tagEnd,'')});pushNews(m);log.push(m)}
}
