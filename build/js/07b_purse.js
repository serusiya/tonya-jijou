/* =====================================================================
 * 07b_purse.js — 現款／私房錢、保鏢遇襲
 *  - 現款 = G.silver：貨款、賄賂、拜訪、薪資皆用現款。
 *  - 私房錢 = G.gold：花街、走私（暗約偷跑）專用。
 *  - 私房錢來源：①從商號帳上挪用（每次最多 50 兩，扣 1 行動點數）②每旬盈餘抽成（0～3%）。
 *  - 撥回現款：每旬一次、扣 1 行動點數、一次 100 兩（PURSE_BACK）。好感 100 的大番頭另可大筆轉帳（07m_loyalty.js）。
 *  - 私房錢滿 2000 兩，名望多一階（fameTier）。
 *  - 保鏢（SPECIAL 職位）：出門前往時 0.5～3% 遇襲，見 rollAmbush。
 * ===================================================================== */

/** 單次從現款挪用的上限（兩）。 */
const SKIM_MAX=50,SKIM_MIN=30;
/** 每旬盈餘抽成上限（比例）。 */
const SKIM_PCT_MAX=0.03;
/** 私房錢撥回現款：每次金額（每旬一次）。 */
const PURSE_BACK=100;
/** 轉出私房錢後若跌破名望門檻，提醒一句。 */
const purseTierNote=()=>UT('purse.purseTierNote',{a:fmt(ODDS.fame.goldTier)});

/** 私房錢面板（點最上方「私房錢」欄）：從現款挪用／設定每旬抽成。 */
SHEETS.purse=()=>{
  const pct=(G.skimPct||0)*100;
  let h=UT('purse.h');
  h+=UT('purse.purse',{a:SKIM_MIN,b:SKIM_MAX})+'<div class="row" style="margin-top:4px"><button class="pixel-btn btn-sm btn-gold" data-act="skim">'+UT('btn.skim')+'</button></div></div>';
  h+=UT('purse.purse.2',{a:pct.toFixed(1)})+'<input type="range" min="0" max="30" step="1" value="'+Math.round(pct*10)+'" data-chg="skimPct" style="width:100%"></div>';
  const back=G.purseBackT===G.turn;
  h+=UT('purse.purse.5',{a:PURSE_BACK})+'<div class="row" style="margin-top:4px"><button class="pixel-btn btn-sm btn-green" data-act="purseBack" '+(back||G.gold<PURSE_BACK?'disabled':'')+'>'+(back?UT('purse.purse.3'):UT('purse.purse.4',{a:PURSE_BACK}))+'</button></div>'+purseTierNote()+'</div>';
  h+=UT('purse.purse.6',{a:Math.round(G.gold),b:fmt(G.silver)});
  return {title:UT('purse.purse.7'),html:h};
};
ACT.purse=()=>UI.openSheet('purse');
/** 從現款挪用：隨機 30～50 兩，扣 1 行動點數。 */
ACT.skim=()=>{
  const amt=Math.min(Math.floor(G.silver),SKIM_MIN+Math.floor(rnd()*(SKIM_MAX-SKIM_MIN+1)));
  if(amt<1){toast(MSG('skim.1'));return}
  if(G.silver<amt){toast(MSG('skim.1'));return}
  if(!spendAP())return;
  G.silver-=amt;G.gold+=amt;addHeat(0.2);G.life.skimmed=(G.life.skimmed||0)+amt;
  sfx.coin();toast(MSG('skim.2',{amt}));
  UI.render();refreshSheet();
};
/** 私房錢撥回現款：每旬一次、扣 1 行動點數、一次 100 兩。 */
ACT.purseBack=()=>{
  if(G.purseBackT===G.turn){toast(MSG('purse.purseBack'));return}
  if(G.gold<PURSE_BACK){toast(MSG('purse.purseBack.2',{a:PURSE_BACK}));return}
  if(!spendAP())return;
  G.gold-=PURSE_BACK;G.silver+=PURSE_BACK;G.purseBackT=G.turn;
  sfx.coin();toast(MSG('purse.purseBack.3',{a:PURSE_BACK}));
  UI.render();refreshSheet();
};
/** 設定每旬抽成比例（滑桿 0～30 → 0～3.0%）。 */
CHG.skimPct=el=>{G.skimPct=Math.min(SKIM_PCT_MAX,Math.max(0,(+el.value||0)/1000));const v=$('#skim-pct-v');if(v)v.textContent=(G.skimPct*100).toFixed(1)+'%';save()};
/** 每旬結算：盈餘（現款較旬初的增加量）按比例撥入私房錢。s0＝旬初現款。 */
function skimTick(log,s0){
  G.lastSkim=0;
  const p=G.skimPct||0;if(p<=0)return;
  const surplus=G.silver-s0;if(surplus<=0)return;
  const amt=Math.floor(surplus*p);if(amt<1)return;
  G.silver-=amt;G.gold+=amt;G.lastSkim=amt;
  log.push(NEWS('skimTick.1',{surplus:fmt(surplus),p:(p*100).toFixed(1),amt}));
}

/* ---------------- 保鏢與遇襲 ---------------- */
/** 養傷中則提示並回傳 true（所有「出門前往」都受限）。 */
function injuredBlock(){
  if((G.exile||0)>0){toast(MSG('injuredBlock.1',{exile:G.exile}));return true}
  if((G.injured||0)>0){toast(MSG('injuredBlock.2',{injured:G.injured}));return true}
  return false;
}
/** 每旬遞減養傷期。 */
function injuryTick(log){
  if((G.injured||0)>0){G.injured--;if(G.injured===0)log.push(NEWS('injuryTick.1'))}
}
/** 遇襲機率：基本 0.5%～3%（風聲、知名度越高越危險），另加每位仇人 +3%。 */
function ambushChance(){const A_=ODDS.ambush;return clamp(A_.base+A_.perHeat*Math.min(G.heat||0,A_.heatCap)+A_.perFame*(G.fame||0),A_.min,A_.max)+ENEMY_AMBUSH*enemyCount()}   // 每位仇人 +3%
/** 戰力＝保鏢的膽識（audacity_courage）。 */
const guardPower=e=>statsOfEmp(e).audacity_courage;
/**
 * 出門時擲遇襲。回傳 null＝平安；{abort:true}＝受傷中止行程；
 * 其他＝遇襲但化解（無傷退敵／保鏢替死），行程照常。
 */
function rollAmbush(){
  if(!chance(ambushChance()))return null;
  const gs=G.emps.filter(e=>e.rank==='guard'&&!jailedEmp(e)).sort((a,b)=>guardPower(b)-guardPower(a));
  if(gs.length){
    const g=gs[0],pw=guardPower(g);
    // 膽識 ≥70 必定無傷退敵；否則機率 (pw/70)^2，失敗則保鏢替你擋刀而亡
    if(pw>=ODDS.ambushDefend.power||chance(Math.pow(pw/ODDS.ambushDefend.power,2))){
      const t=NEWS('rollAmbush.1',{name:g.name});
      pushNews(t);toast(t,4200);addFame(0.3);return {ok:true,repelled:true};
    }
    G.emps=G.emps.filter(e=>e.id!==g.id);
    const t=NEWS('rollAmbush.2',{name:g.name});
    pushNews(t);toast(t,4800);sfx.bad();UI.render();return {ok:true,died:true};
  }
  G.injured=1+Math.floor(rnd()*6);
  const t=NEWS('rollAmbush.3',{injured:G.injured});
  pushNews(t);toast(t,5200);sfx.bad();UI.render();
  return {abort:true};
}
