/* =====================================================================
 * 07b_purse.js — 公款／私款、保鏢遇襲
 *  - 公款 = G.silver（白銀）：貨款、賄賂、拜訪、薪資皆用公款。
 *  - 私款 = G.gold（黃金點心）：花街、走私（暗約偷跑）專用。
 *  - 私款來源：①偷公款（每次最多 50 兩，扣 1 行動點數）②每旬盈餘抽成（0～3%）。
 *  - 保鏢（SPECIAL 職位）：出門前往時 0.5～3% 遇襲，見 rollAmbush。
 * ===================================================================== */

/** 單次偷公款上限（兩）。 */
const SKIM_MAX=50,SKIM_MIN=30;
/** 每旬盈餘抽成上限（比例）。 */
const SKIM_PCT_MAX=0.03;

/** 私款面板（點最上方黃金點心旁的「＋」）：偷公款／設定每旬抽成。 */
SHEETS.purse=()=>{
  const pct=(G.skimPct||0)*100;
  let h='<div class="notice tiny"><b>公款</b>＝白銀（頂部中央），商號的帳：進貨、薪資、賄賂與拜訪都花它。<b>私款</b>＝黃金點心，你自己的口袋：只用在<b>花街</b>與<b>走私（暗約偷跑）</b>。兩邊要分清楚，被抓到動公款可是大罪。</div>';
  h+='<div class="card"><b>1. 從公款偷錢</b><div class="tiny muted">每次偷走 '+SKIM_MIN+'～'+SKIM_MAX+' 兩（隨機），扣 1 行動點數。</div>'
    +'<div class="row" style="margin-top:4px"><button class="pixel-btn btn-sm btn-gold" data-act="skim">'+UT('btn.skim')+'</button></div></div>';
  h+='<div class="card"><b>2. 每旬盈餘自動抽成</b><div class="tiny muted">每旬若有盈餘，按此比例撥入私款（0～3%），目前 <b id="skim-pct-v">'+pct.toFixed(1)+'%</b>。</div>'
    +'<input type="range" min="0" max="30" step="1" value="'+Math.round(pct*10)+'" data-chg="skimPct" style="width:100%"></div>';
  h+='<div class="tiny muted">私款現有 <b>'+Math.round(G.gold)+'</b> 兩；公款 '+fmt(G.silver)+' 兩。</div>';
  return {title:'🟨 私款·黃金點心',html:h};
};
/** 偷公款：隨機 30～50 兩，扣 1 行動點數。 */
ACT.skim=()=>{
  const amt=Math.min(Math.floor(G.silver),SKIM_MIN+Math.floor(rnd()*(SKIM_MAX-SKIM_MIN+1)));
  if(amt<1){toast(MSG('skim.1'));return}
  if(G.silver<amt){toast(MSG('skim.1'));return}
  if(!spendAP())return;
  G.silver-=amt;G.gold+=amt;G.heat=(G.heat||0)+0.2;G.life.skimmed=(G.life.skimmed||0)+amt;
  sfx.coin();toast(MSG('skim.2',{amt}));
  UI.render();refreshSheet();
};
/** 設定每旬抽成比例（滑桿 0～30 → 0～3.0%）。 */
CHG.skimPct=el=>{G.skimPct=Math.min(SKIM_PCT_MAX,Math.max(0,(+el.value||0)/1000));const v=$('#skim-pct-v');if(v)v.textContent=(G.skimPct*100).toFixed(1)+'%';save()};
/** 每旬結算：盈餘（公款較旬初的增加量）按比例撥入私款。s0＝旬初公款。 */
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
  const gs=G.emps.filter(e=>e.rank==='保鏢').sort((a,b)=>guardPower(b)-guardPower(a));
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
