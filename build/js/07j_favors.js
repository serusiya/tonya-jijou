/* ═════ [07zza_chancemeet] ═════ */
'use strict';
/* =====================================================================
 * 07zza_chancemeet.js — 拜訪巧遇（設計筆記第二十九節「拜訪巧遇」、第一百九十一節）
 *  - 見到面、拜訪對話結束後判定（被嫌不善言辭那一場不算）；拒見、不在家、丁稚代送不會走到這裡。
 *  - 機率 ODDS.chanceMeet.p，每旬最多一次；有朋友同行引見的那一場不擲（07zzb_escort.js）。
 *  - 遇到誰：此刻在本城的官員（不含地區官員）與商人（同業、旅商人、仲買人、差配人；不含闇商人）；
 *    排除主人、仇人、自家店員、巡迴在外、被同業聘走、在牢裡、正在氣頭上的人。主人是官員時優先挑官員，商人時優先挑商人。
 *  - 素不相識的人要過名氣門檻（知名度視同多一階），經主人引見結識；舊識直接加好感。
 *  - 回傳結果視窗上方的小卡 HTML（沒遇到回傳空字串）。
 * ===================================================================== */
/** 巧遇的商人身分（闇商人只能碰上、不能求見，第一百五十六節，所以不列）。 */
const CM_MERCH=['rival','guest','broker','manager'];
/** 這次拜訪可能巧遇的人。 */
function chanceMeetPool(host){
  return cityNpcs(G.cityId).filter(n=>{
    if(n.cid===host||n.hired)return false;
    if(n.pos?n.pos.court==='region':!CM_MERCH.includes(n.role))return false;
    if(isEnemy(n.cid)||(G.emps||[]).some(e=>e.cid===n.cid)||awayNow(n)||jailed(n)||snubbed(n.cid))return false;
    if(G.escort&&G.escort.t===G.turn&&G.escort.f===n.cid)return false;
    const r=G.rel[n.cid];
    return !!(r&&r.bond)||meetTierNeed(n.cid)<=fameTier()+1;     // 素不相識：比照介紹人引見，名望視同多一階
  });
}
/** 擲巧遇；遇到時結算好感、記交情，回傳小卡 HTML。 */
function chanceMeetRoll(host){
  const C=ODDS.chanceMeet;
  if(G.chanceMeetT===G.turn||!chance(C.p))return '';
  const L=chanceMeetPool(host);if(!L.length)return '';
  const hn=npc(host),off=!!(hn&&hn.pos),same=L.filter(n=>!!n.pos===off);
  const n=pick(same.length&&chance(C.sameKind)?same:L),cid=n.cid,r=R(cid),old=!!r.bond;
  G.chanceMeetT=G.turn;
  const g=Math.max(0,Math.min(rint(C.gainMin,C.gainMax),100-r.aff));
  setAff(r,clamp(r.aff+g,0,100));
  if(!old){r.met=true;r.seen=true;addKnown(cid);r.bond={mult:0.6,label:UT('cm.bond',{a:nameOf(host)}),introId:null}}   // 比照大番頭代結識：不加初次結識的知名度
  logRel(cid,UT(old?'cm.log.old':'cm.log.new',{a:nameOf(host),g}));
  logRel(host,UT('cm.log.host',{a:nameOf(cid)}));
  const line=TX('chanceMeet.'+(old?'old':'new')+'.'+(off?'official':'merchant'),{n:nameOf(cid)});
  return sideCard(cid,line,UT('cm.gain',{n:nameOf(cid),g}));
}
/** 結果視窗上方的人物小卡（巧遇、陪同共用）。 */
function sideCard(cid,line,foot){
  return '<div class="card" style="display:flow-root;margin-bottom:6px">'+portraitHtml(cid,48)+'<div class="small">'+esc(line)+'</div><div class="tiny" style="margin-top:4px;color:#9b2c3a">'+esc(foot)+'</div></div>';
}

/* ═════ [07zzb_escort] ═════ */
'use strict';
/* =====================================================================
 * 07zzb_escort.js — 陪同（通用機制）與朋友請你引薦官員（設計筆記第一百七十一節、第一百九十二節）
 *  - 陪同：前往某處時，有人主動說要一起去；玩家只選「帶他去」或「婉拒」。
 *    各目的地登記在 ESCORT（目前只有町奉行所）；0.8 的出遊、花街等照這個方式加一筆。
 *  - 朋友請你引薦官員（ESCORT.yamen）：
 *    前往町奉行所時，有好感 80 以上的商人朋友，想見一位你熟（好感 ≥ 60）的本城三階以下官員，就有機會跳出來。
 *    帶他去：本旬拜訪那位官員、見到面且對話打完，就算引見；拜訪本身照常，不另扣行動點數。
 *    婉拒好感 −10；答應了卻整旬沒去拜訪那位官員，旬末好感 −5；拒見、不在家、被嫌不善言辭不算失約，也沒引見成。
 *  - 狀態：G.escort{f 朋友,o 官員,t 旬,st go／no／done／fail／skip}、G.escortCD（下次可判定的旬）、
 *    G.escortPairs（已引見過的朋友｜官員）、G.escortRisk（日後可能牽連的引見）。都是用到時才建立。
 * ===================================================================== */
/** 各目的地的陪同：roll() 回傳 {f,o} 或 null。 */
const ESCORT={
  yamen:{roll:escortYamenRoll}
};
/** 本旬的同行（狀態 st 可省略）。 */
const escortNow=st=>{const e=G&&G.escort;return e&&e.t===G.turn&&(!st||e.st===st)?e:null};
/** 有符號的好感變化文字。 */
const escSgn=v=>v>=0?'+'+v:'−'+Math.abs(v);
/** 朋友請你引薦官員：可配對的朋友與官員。 */
function escortYamenPairs(){
  const E=ODDS.escort,done=G.escortPairs||[];
  const offs=officialsOf(G.cityId).filter(n=>n.pos.rank<=E.maxRank&&!awayNow(n)&&!snubbed(n.cid)&&!isEnemy(n.cid)&&!roninOfficial(n.cid)
    &&G.rel[n.cid]&&G.rel[n.cid].bond&&G.rel[n.cid].aff>=E.offAff);
  const frs=closeFriends(true).filter(f=>!jailed(f)&&!hiddenSmuggler(f.cid));
  const out=[];
  frs.forEach(f=>offs.forEach(o=>{if(o.cid!==f.cid&&!done.includes(f.cid+'|'+o.cid))out.push({f:f.cid,o:o.cid})}));
  return out;
}
function escortYamenRoll(){
  if(escortNow()||G.turn<(G.escortCD||0))return null;
  const L=escortYamenPairs();if(!L.length||!chance(ODDS.escort.p))return null;
  return pick(L);
}
/** 等待回應的陪同：{f,o,k,cont}。 */
var ESC_OFFER=null;
/** 出門時判定陪同；有人要同行就跳出詢問並回傳 true（回應後再繼續出門）。 */
function escortOffer(k,cont){
  const D=ESCORT[k];if(!D)return false;
  const o=D.roll();if(!o)return false;
  G.escortCD=G.turn+ODDS.escort.cd;                       // 一跳出來就進入冷卻（關掉視窗也不再問）
  ESC_OFFER=Object.assign({k,cont},o);
  const f=o.f,n=npc(f),on=npc(o.o);
  const h='<div class="card" style="display:flow-root">'+portraitHtml(f,56)+'<div><b style="font-size:17px">'+esc(nameOf(f))+'</b> <span class="tag gray">'+esc(ROLE_LABEL[n.role]||'')+'</span></div>'
   +'<div class="small" style="margin:6px 0">'+esc(TX('escort.ask',{o:nameOf(o.o),t:posTitle(on)}))+'</div>'
   +'<div class="grid2"><button class="pixel-btn btn-gold btn-sm" data-act="escortYes">'+UT('btn.escortYes')+'</button><button class="pixel-btn btn-sm" data-act="escortNo">'+UT('btn.escortNo',{a:ODDS.escort.decline})+'</button></div></div>';
  UI.showInfo(UT('escort.title'),h);
  return true;
}
function escortGo(){const o=ESC_OFFER;ESC_OFFER=null;UI.hideInfo();if(o&&o.cont)o.cont()}
ACT.escortYes=()=>{
  const o=ESC_OFFER;if(!o)return;
  G.escort={f:o.f,o:o.o,t:G.turn,st:'go'};
  logRel(o.f,UT('escort.log.yes',{a:nameOf(o.o)}));
  escortGo();
};
ACT.escortNo=()=>{
  const o=ESC_OFFER;if(!o)return;
  const g=ODDS.escort.decline,r=R(o.f);setAff(r,clamp(r.aff-g,0,100));
  G.escort={f:o.f,o:o.o,t:G.turn,st:'no'};
  logRel(o.f,UT('escort.log.no',{a:nameOf(o.o),g}));toast(MSG('escort.no',{f:nameOf(o.f),g}));
  escortGo();
};
/** 奉行所人物卡：同行朋友等著被引見的那位官員，加一行提示。 */
function escortTag(cid){const e=escortNow('go');return e&&e.o===cid?UT('escort.tag',{f:nameOf(e.f)}):''}
/** 拜訪那位官員：門口被拒、不在家，或被嫌不善言辭——引見不成，不扣好感；回傳接在訊息後面的一句。 */
function escortFail(cid,kind){
  const e=escortNow('go');if(!e||e.o!==cid)return '';
  e.st='fail';logRel(e.f,UT('escort.log.fail',{a:nameOf(cid)}));
  return MSG(kind==='snub'?'escort.snub':'escort.door',{f:nameOf(e.f)});
}
/** 拜訪那位官員、對話打完：結算引見，回傳小卡 HTML；這一場不是同行引見時回傳 null。 */
function escortSettle(cid){
  const e=escortNow('go');if(!e||e.o!==cid)return null;
  const E=ODDS.escort,cp=compat(e.f,cid),rf=R(e.f),ro=R(cid);
  const lvl=cp.matches>=2?'good':cp.matches===1?'ok':'bad';
  const df=lvl==='good'?E.friendHi:E.friendLo;
  const dof=(lvl==='good'?rint(E.offHiMin,E.offHiMax):lvl==='bad'?-E.offBad:0)-E.offCost;   // 官員另扣一點：比照介紹人付出的人情
  setAff(rf,clamp(rf.aff+df,0,100));setAff(ro,clamp(ro.aff+dof,0,100));
  e.st='done';(G.escortPairs=G.escortPairs||[]).push(e.f+'|'+cid);
  logRel(e.f,UT('escort.log.done',{a:nameOf(cid),g:escSgn(df)}));
  logRel(cid,UT('escort.log.off',{a:nameOf(e.f),g:escSgn(dof)}));
  const ch=CH(e.f),greed=ch&&ch.derived_stats?ch.derived_stats.greed_index||0:0;
  if(npc(e.f).role==='smuggler'||greed>=E.greedy)(G.escortRisk=G.escortRisk||[]).push({f:e.f,o:cid,at:G.turn+rint(E.riskMin,E.riskMax)});
  return sideCard(e.f,TX('escort.done.'+lvl,{f:nameOf(e.f),o:nameOf(cid)}),UT('escort.gain',{f:nameOf(e.f),a:escSgn(df),o:nameOf(cid),b:escSgn(dof)}));
}
/** 每旬：上一旬答應同行卻沒去拜訪那位官員，好感 −5；引見過的貪心朋友日後可能牽連到你。 */
function escortTick(log){
  const E=ODDS.escort,e=G.escort;
  if(e&&e.st==='go'&&e.t<G.turn){
    e.st='skip';const r=R(e.f);setAff(r,clamp(r.aff-E.skip,0,100));
    logRel(e.f,UT('escort.log.skip',{a:nameOf(e.o),g:E.skip}));
    const t=NEWS('escort.skip',{f:nameOf(e.f),o:nameOf(e.o)});pushNews(t);log.push(t);
  }
  if(G.escortRisk&&G.escortRisk.length){
    const due=G.escortRisk.filter(x=>x.at<=G.turn);G.escortRisk=G.escortRisk.filter(x=>x.at>G.turn);
    due.forEach(x=>{
      if(!alive(x.f)||!alive(x.o)||!chance(E.riskP))return;
      addHeat(E.riskHeat);
      const t=NEWS('escort.risk',{f:nameOf(x.f),o:nameOf(x.o)});pushNews(t);log.push(t);
    });
  }
}

/* ═════ [07zzc_daimyo] ═════ */
'use strict';
/* =====================================================================
 * 07zzc_daimyo.js — 大名行列過境（設計筆記第二十九節「大名行列過境」、第一百九十三節）
 *  - 每年一次：新年（與開局）時從本年度剩下的旬裡挑一旬，排除本城節慶旬與例會旬，存在 G.daimyo{y,m,c}；年初不預告。
 *  - 過境那一旬一開始，旬報與主畫面就看得到行列；所有本業貨需求乘 ODDS.daimyo.mult（與節慶同一層，03_market.js 的 demandEff），
 *    只算那一旬的收市，之後隨收市價視窗慢慢淡去。非本業貨不受影響。
 *  - 行列當旬出門不擲遇襲（07b_purse.js 的 rollAmbush）；路遇急難照常。
 *  - 舊存檔沒有 G.daimyo：從下一個新年起才有。
 * ===================================================================== */
/** 本旬是否大名行列過境。 */
const daimyoActive=()=>!!(G&&G.daimyo&&G.daimyo.y===G.year&&G.daimyo.m===G.month&&G.daimyo.c===G.cycle);
/** 大名行列的需求倍率（只算本業貨）。 */
const daimyoMult=c=>daimyoActive()&&c.sys===G.sysKey?ODDS.daimyo.mult:1;
/** 排定本年度的過境旬：本旬起到年底（含本旬），排除本城節慶旬與例會旬。 */
function daimyoPlan(){
  const f=homeCity().special_festival,L=[];
  for(let m=G.month;m<=12;m++)for(let c=1;c<=3;c++){
    if(m===G.month&&c<G.cycle)continue;
    if(isMeetingDate(m,c)||(f&&f.month===m&&f.cycle===c))continue;
    L.push([m,c]);
  }
  const p=L.length?pick(L):null;
  G.daimyo=p?{y:G.year,m:p[0],c:p[1]}:null;
}
/** 每旬（日期前進之後）：過境旬一開始就上旬報。 */
function daimyoTick(log){
  if(!daimyoActive())return;
  const t=NEWS('daimyo.pass',{name:homeCity().name});pushNews(t);log.push(t);
}

/* ═════ [07zzd_sick] ═════ */
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

/* ═════ [07zze_favor8] ═════ */
'use strict';
/* =====================================================================
 * 07zze_favor8.js — 0.8 先行的一批請託與規則（DESIGN_NOTES 第 152、204～206 節、第二十九節五六階）
 *  - 走私失敗後船長三旬不敢出海（第 152 節第一項）：一般走私遇險或入港被扣，從當旬起三旬所有船長不肯出海
 *    （不能走私、不能派海運委託與卸留請負的海運外運）；唐船割符不觸發、也不受限。
 *  - 破船賑、盜難賑（遠國奉行所五階，本地；第 204 節）：叫一位閒著的船長／飛腳演戲，當場領撫恤銀；他三旬不能出門；
 *    好感 −15、風聲 +1.5；兩項各一年一次。
 *  - 株札暫扣（吟味方五階 町奉行；第 204 節）：公款 3,000 兩；挑一家同業停業三旬（不出貨、不超賣），他的份額轉給你
 *    （穩定供貨線、協議配額、相場進貨上限都加上他那一份）；他對你好感 −30；風聲 +1；冷卻 12 旬。
 *  - 專賣株（勘定方五階 勘定奉行三旬 5,000 兩／六階 御金奉行九旬 10,000 兩；第二十九節）：選一項有交易許可的本業貨，
 *    期間本城同業與零星商家都不能出這項貨，進貨上限加倍；穩定供貨線＝本城全部需求，協議配額不適用；同時一張，冷卻 3 旬。
 *  - 闕所（遠國奉行所六階 巡見使，好感 100 特殊請託，本地；第二十九節）：私房錢 1,000 兩，挑一家同業永久除名（不補人）；
 *    本城同業至少三家才出現；訂約金作廢併入本期違約金；他是公會長時由另一位候選人接任。
 *  - 新町取立（普請方五階 普請奉行；第二十九節、第 205 節）：公款 6,000 兩，走申請審理；成功率第一次 40%、第二次 70%、第三次一定成功；
 *    成功時本城人口 +5%、寫進城史；審理完成後冷卻 12 旬，冷卻期間季度人口因城裡缺貨而減少的幅度減半。
 *  - 三階的災損申請（第 206 節）：火難御救（普請方三階）、荷損御賑（勘定方三階）、盜難御賑（吟味方三階）；
 *    只能在事件發生的當旬申請；損失貨值的五成、最多 800 兩（盜難御賑改為追回贓貨，貨值最多 800 兩）。
 *  數值 ODDS.f8；文字 fav.*、f8.*（01e、01f、01g）。
 *  狀態：G.seaFear、G.fraudY{sea,land}、n.suspUntil、G.mono{name,until}、G.newTown{tries,cd}、G.loss{fire,theft,cargo}、n.kessho。
 * ===================================================================== */
const F8=()=>ODDS.f8;

/* ---------- 一、走私失敗後船長不敢出海 ---------- */
const seaFear=()=>!!G&&(G.seaFear||-1)>=G.turn;
const seaFearLeft=()=>seaFear()?G.seaFear-G.turn+1:0;
/** 一般走私出事：從這一旬起三旬（含當旬）。 */
function seaFearStart(log){G.seaFear=G.turn+F8().fearTurns-1;const t=NEWS('f8.fear',{n:F8().fearTurns});if(!log.includes(t))log.push(t)}
const seaFearNote=()=>'<div class="notice">'+UT('f8.fearNote',{n:seaFearLeft()})+'</div>';
{const _s=ACT.smugGo;ACT.smugGo=function(){if(seaFear()){toast(UT('f8.fearNote',{n:seaFearLeft()}),4200);return}return _s.apply(this,arguments)}}
{const _v=ACT.vAdd;ACT.vAdd=function(){if(UI.s.route&&UI.s.route.mode==='sea'&&seaFear()){toast(UT('f8.fearNote',{n:seaFearLeft()}),4200);return}return _v.apply(this,arguments)}}
{const _sv=sendVoyage;sendVoyage=function(captId,budget,destId,mode,free,batch){if((mode||'sea')==='sea'&&!free&&seaFear())return {ok:false,msg:UT('f8.fearNote',{n:seaFearLeft()})};return _sv.apply(this,arguments)}}
{const _u=ACT.ujGo;ACT.ujGo=function(){if(G.ujob&&G.ujob.mode==='sea'&&seaFear()){toast(UT('f8.fearNote',{n:seaFearLeft()}),4200);return}return _u.apply(this,arguments)}}
{const _vp=voyagePanel;voyagePanel=function(){const R_=UI.s.route;if(R_&&R_.mode!=='land'&&seaFear())return seaFearNote();return _vp.apply(this,arguments)}}
{const _sh=SHEETS.smuggle;SHEETS.smuggle=function(){const o=_sh.apply(this,arguments);if(seaFear())o.html=seaFearNote()+o.html;return o}}

/* ---------- 請託登記 ---------- */
const F8_ADM=[{k:'fireAid',rank:3,exactRank:true,cd:12,avail:()=>lossOpen('fire')},{k:'newTown',apply:true,rank:5,exactRank:true},{k:'newTown6',apply:true,rank:6,exactRank:true}];   // 新町取立：五階（小）與六階（城代家老）算同一件，共用次數與冷卻
const F8_FIN=[{k:'cargoAid',rank:3,exactRank:true,cd:12,avail:()=>lossOpen('cargo')},{k:'mono5',rank:5,exactRank:true,cd:3,avail:()=>!monoNow()&&tradeComms().length>0},{k:'mono6',rank:6,exactRank:true,cd:3,avail:()=>!monoNow()&&tradeComms().length>0}];
const F8_JUD=[{k:'theftAid',rank:3,exactRank:true,cd:12,avail:()=>lossOpen('theft')},{k:'suspend',rank:5,exactRank:true,cd:12,avail:()=>suspTargets().length>0}];
F8_ADM.forEach(f=>FAVORS.administration.push(favorText(f)));F8_FIN.forEach(f=>FAVORS.finance.push(favorText(f)));F8_JUD.forEach(f=>FAVORS.judiciary.push(favorText(f)));
REG_FAVORS.push(
  {k:'rwreck',rank:5,pos:['reg_08'],local:true,drop:15,avail:()=>fraudOpen('sea')},
  {k:'rrobbed',rank:5,pos:['reg_07'],local:true,drop:15,avail:()=>fraudOpen('land')}
);
REG_FAVORS.filter(f=>f.k==='rwreck'||f.k==='rrobbed').forEach(f=>{f.name=UT('fav.'+f.k);f.desc=UT('fav.'+f.k+'.d')});
/** 需要先挑對象的請託：回傳選單 HTML（07u_battle.js 的 ACT.reqAsk）。 */
const FAVOR_PICK={};
/** 開口前的檢查（錢不夠等）；回傳不能辦的原因。 */
{const _chk=regFavorCheck;regFavorCheck=function(f,n){
  const k=f&&f.k;
  if(k==='suspend'&&G.silver<F8().suspCost)return MSG('f8.short',{a:fmt(F8().suspCost)});
  if((k==='mono5'||k==='mono6')&&G.silver<F8().mono[k].cost)return MSG('f8.short',{a:fmt(F8().mono[k].cost)});
  return _chk.apply(this,arguments);
}}
const pickRow=(cid,k,t,label,note)=>'<div class="irow" style="margin-top:4px"><div class="row"><b class="small">'+label+'</b><button class="pixel-btn btn-sm btn-gold" data-act="reqAsk" data-cid="'+cid+'" data-k="'+k+'" data-t="'+t+'">'+UT('f8.pick')+'</button></div>'+(note?'<div class="tiny muted">'+note+'</div>':'')+'</div>';

/* ---------- 二、破船賑、盜難賑（詐領） ---------- */
const fraudMode=k=>k==='rwreck'?'sea':'land';
function fraudOpen(mode){return (G.fraudY||{})[mode]!==G.year&&idleCaptains(mode).length>0}
function fraudDo(mode){
  const e=idleCaptains(mode)[0];if(!e)return MSG('f8.noCrew',{m:NM('crew',mode)});
  (G.fraudY||(G.fraudY={}))[mode]=G.year;
  const R_=F8().fraud[mode],amt=rint(R_[0],R_[1]);
  e.hurtUntil=G.turn+F8().fraudRest;G.silver+=amt;addHeat(F8().fraudHeat,true);
  const t=NEWS('f8.fraud.'+mode,{e:e.name,a:fmt(amt)});pushNews(t);
  return MSG('f8.fraud.'+mode,{e:e.name,a:fmt(amt),t:F8().fraudRest});
}
REG_FAVOR.rwreck=()=>fraudDo('sea');
REG_FAVOR.rrobbed=()=>fraudDo('land');

/* ---------- 三、株札暫扣 ---------- */
const suspended=n=>!!(n&&(n.suspUntil||-1)>=G.turn);
const suspTargets=()=>rivalsHere().filter(n=>alive(n.cid)&&!suspended(n)&&!jailed(n)&&!isBekke(n));
/** 你從暫扣中的同業接下的市佔份額。 */
function suspBonus(){
  const rows=(G.share&&G.share.rows)||[];let s=0;
  rivalsHere().forEach(n=>{if(suspended(n)){const r=rows.find(x=>x.cid===n.cid);if(r)s+=r.share||0}});
  return s;
}
FAVOR_PICK.suspend=cid=>{
  const L=suspTargets().slice().sort((a,b)=>isEnemy(b.cid)-isEnemy(a.cid));
  return portraitHtml(cid,56)+'<div class="notice tiny">'+UT('f8.suspPick',{a:fmt(F8().suspCost),d:F8().suspAff})+'</div>'+L.map(n=>pickRow(cid,'suspend',n.cid,esc(nameOf(n.cid))+(isEnemy(n.cid)?UT('f8.enemyTag'):'')+(G.gm&&G.gm.cid===n.cid?UT('f8.gmTag'):''))).join('');
};
REG_FAVOR.suspend=(n,arg)=>{
  const t=npc(arg);if(!t||!suspTargets().includes(t))return MSG('f8.suspNone');
  payPublic('spend.f8Susp',F8().suspCost);addHeat(F8().suspHeat);
  t.suspUntil=G.turn+F8().suspTurns-1;
  const r=R(t.cid);if(!r.bond){r.bond={mult:1,label:UT('f8.bondSusp'),introId:null};r.met=true;r.seen=true;addKnown(t.cid)}
  setAff(r,clamp(r.aff-F8().suspAff,0,100));logRel(t.cid,UT('f8.log.susp'));
  G.share=marketShares();ownComms().forEach(c=>{const m=G.mk[c.name];m.so=rivalSupply(c,m,false)});
  const nw=NEWS('f8.susp',{n:nameOf(t.cid)});pushNews(nw);
  return MSG('f8.suspDone',{n:nameOf(t.cid),t:F8().suspTurns,d:F8().suspAff});
};

/* ---------- 四、專賣株 ---------- */
const monoNow=()=>!!(G&&G.mono&&G.mono.until>=G.turn);
const monoItem=name=>monoNow()&&G.mono.name===name;
FAVOR_PICK.mono5=cid=>monoPick(cid,'mono5');FAVOR_PICK.mono6=cid=>monoPick(cid,'mono6');
function monoPick(cid,k){
  const M=F8().mono[k];
  return portraitHtml(cid,56)+'<div class="notice tiny">'+UT('f8.monoPick',{a:fmt(M.cost),t:M.turns})+'</div>'+tradeComms().map(c=>pickRow(cid,k,c.name,esc(c.short),UT('f8.monoNeed',{d:Math.round((G.mk[c.name].D||0)*M.turns)}))).join('');
}
function monoDo(k,arg){
  const M=F8().mono[k],c=COMM_MAP[arg];if(!c||!tradeOK(arg)||monoNow())return MSG('f8.monoNone');
  payPublic('spend.f8Mono',M.cost);
  G.mono={name:arg,until:G.turn+M.turns-1,from:G.turn};
  const m=G.mk[arg];m.so=rivalSupply(c,m,false);
  const t=NEWS('f8.mono',{n:c.short,t:M.turns});pushNews(t);
  return MSG('f8.monoDone',{n:c.short,t:M.turns});
}
REG_FAVOR.mono5=(n,arg)=>monoDo('mono5',arg);REG_FAVOR.mono6=(n,arg)=>monoDo('mono6',arg);

/* ---------- 同業出貨：暫扣的同業停業、專賣的貨同業與零星商家都不出（rivalSupply 內處理，03_market.js）；不會超賣 ---------- */
{const _o=rivalOverMul;rivalOverMul=function(r,c,first){
  const v=_o(r,c,first),n=npc(r.cid),m=n&&n.ms;
  if(m&&m.ovDec===G.turn&&m.ovItem&&(suspended(n)||monoItem(m.ovItem)))m.ovItem=null;   // 停業或專賣的貨不會超賣
  return m&&m.ovItem===c.name?v:0;
}}

/* ---------- 五、闕所 ---------- */
{const _sp=specialList;specialList=function(cid){
  const out=_sp.apply(this,arguments),n=npc(cid),r=R(cid);
  if(n&&n.pos&&n.pos.court==='region'&&n.pos.posId==='reg_10'&&!foreignReg(n)&&r.aff>=100&&!r.specialUsed&&kesshoTargets().length>=F8().kesshoMin)
    out.push({k:'sp_kessho',special:'kessho',name:UT('f8.kessho'),desc:UT('f8.kessho.d',{a:fmt(F8().kesshoGold)})});
  return out;
}}
const kesshoTargets=()=>rivalsHere().filter(n=>alive(n.cid)&&!isBekke(n));
function kesshoPick(cid){
  const L=kesshoTargets().slice().sort((a,b)=>isEnemy(b.cid)-isEnemy(a.cid));
  return portraitHtml(cid,56)+'<div class="notice tiny">'+UT('f8.kesshoPick',{a:fmt(F8().kesshoGold)})+'</div>'+L.map(n=>pickRow(cid,'sp_kessho',n.cid,esc(nameOf(n.cid))+(isEnemy(n.cid)?UT('f8.enemyTag'):'')+(G.gm&&G.gm.cid===n.cid?UT('f8.gmTag'):''))).join('');
}
/** 執行闕所（好感與一生一次已在 ACT.reqAsk 扣過）。 */
function kesshoDo(cid,tcid){
  const t=npc(tcid);if(!t||t.role!=='rival'||t.cityId!==G.cityId)return;
  G.gold-=F8().kesshoGold;
  const C=G.cartel;if(C&&C.bond>0)C.pot=(C.pot||0)+costOf('guildBond');      // 他的訂約金作廢，併入本期違約金
  t.cityId=null;t.kessho=true;evilAdd('kessho',tcid);   // 惡德（07zzl_tripev2.js）
  logRel(tcid,UT('f8.log.kessho'));
  let msg=NEWS('f8.kesshoNews',{n:nameOf(tcid)});
  if(G.gm&&G.gm.cid===tcid)msg+=gmSucceed(tcid);
  pushNews(msg);
  G.share=marketShares();ownComms().forEach(c=>{const m=G.mk[c.name];m.so=rivalSupply(c,m,false)});
  sfx.bad();UI.render();
  UI.showInfo(UT('bt.reqAsk.2',{a:nameOf(cid)}),portraitHtml(cid,56)+'<div class="notice" style="margin-top:6px">'+esc(msg)+'</div><button class="pixel-btn btn-sm" data-act="reqDone" style="margin-top:6px">'+UT('cm.ok')+'</button>');
}

/* ---------- 六、新町取立 ---------- */
const NT=()=>G.newTown||(G.newTown={tries:0,cd:-1});
const newTownCool=()=>NT().cd>=G.turn;
const NT_KEYS=['newTown','newTown6'];
const ntCost=k=>k==='newTown6'?F8().newTown.cost6:F8().newTown.cost;
/** 五、六階的新町取立算同一件：任一件在審理中，另一件也不出現。 */
const ntPending=()=>(G.apps||[]).some(a=>a.state==='wait'&&NT_KEYS.includes(a.key));
{const _fd=favorDone;favorDone=function(f,n){if(f&&NT_KEYS.includes(f.k))return newTownCool()||ntPending();return _fd.apply(this,arguments)}}
{const _af=applyFavor;applyFavor=function(cid,n,r,f){
  if(f&&NT_KEYS.includes(f.k)){
    if(newTownCool())return {ok:true,status:'held',msg:MSG('f8.ntCool',{n:NT().cd-G.turn+1})};
    if(ntPending())return {ok:true,status:'held',msg:MSG('applyFavor.1')};
    if(G.silver<ntCost(f.k))return {ok:true,status:'held',msg:MSG('f8.short',{a:fmt(ntCost(f.k))})};
    payPublic('spend.f8NewTown',ntCost(f.k));
  }
  return _af.apply(this,arguments);
}}
{const _ag=appGrant;appGrant=function(A,log){
  if(!NT_KEYS.includes(A.key))return _ag.apply(this,arguments);
  const six=A.key==='newTown6',N=NT(),p=F8().newTown.p[Math.min(N.tries,F8().newTown.p.length-1)],ok=rnd()<p;
  N.cd=G.turn+F8().newTown.cd-1;
  let t;
  if(ok){
    const ct=homeCity(),before=Number.isFinite(G.cityPopulation)?G.cityPopulation:cityPop(ct),after=Math.round(before*(1+(six?F8().newTown.pop6:F8().newTown.pop)));
    G.cityPopulation=after;N.tries=0;
    if(six)raiseFameFloor(F8().newTown.floor6);   // 城代家老的新町：知名度至少到 80，從此不低於 80
    G.cityHist=G.cityHist||{};(G.cityHist[ct.id]=G.cityHist[ct.id]||[]).push({year:G.year,title:NEWS('f8.ntHist',{f:G.firm||gmName('me'),a:fmt(before),b:fmt(after)})});
    Object.entries(G.mk).forEach(([nm,m])=>{m.D=cityD(ct,COMM_MAP[nm])});   // 人口增加後立即重算需求（穩定供貨線、配額、進貨上限、庫存上限都跟著變）
    t=NEWS('f8.ntOk',{a:fmt(before),b:fmt(after)});sfx.fanfare();
  }else{N.tries++;t=NEWS('f8.ntFail');sfx.bad()}
  logRel(A.cid,UT('reg.appGrant',{a:A.name}));
  pushNews(t);log.push(t);
}}
/** 季度人口：新町取立冷卻期間，因城裡缺貨而減少的幅度減半。 */
{const _pt=populationTick;populationTick=function(log){
  const before=Number.isFinite(G.cityPopulation)?G.cityPopulation:null;
  _pt.apply(this,arguments);
  const P=TURNRP&&TURNRP.population;
  if(P&&newTownCool()&&P.rate<0&&before!==null&&P.before===before){
    const half=Math.max(ODDS.cityPopulation.min,Math.round(P.before*(1+P.rate/2)));
    G.cityPopulation=half;P.after=half;P.rate=P.rate/2;
    log.push(NEWS('f8.ntSoft',{a:fmt(P.before),b:fmt(half)}));
  }
}}

/* ---------- 七、三階的災損申請 ---------- */
const lossNow=k=>{const L=G.loss&&G.loss[k];return L&&L.turn===G.turn&&!L.claimed?L:null};
const lossOpen=k=>!!lossNow(k);
/** 記下這一旬的災損（同一旬取最大的一次）。kind：fire／theft／cargo。 */
function lossNote(kind,value,item){
  if(!(value>0))return;G.loss=G.loss||{};const L=G.loss[kind];
  if(L&&L.turn===G.turn&&L.value>=value)return;
  G.loss[kind]={turn:G.turn,value:Math.round(value),item:item||null,claimed:false};
}
const lossPay=L=>Math.min(F8().lossCap,Math.round(L.value*F8().lossRate));
function lossClaim(kind){
  const L=lossNow(kind);if(!L)return MSG('f8.lossNone');
  L.claimed=true;
  if(kind==='theft'){
    const it=L.item,c=it&&COMM_MAP[it.n];if(!c)return MSG('f8.lossNone');
    const unit=Math.max(0.1,marketQuote(it.n));
    let q=Math.max(1,Math.round(it.q*(F8().theftBack[0]+rnd()*(F8().theftBack[1]-F8().theftBack[0]))));
    q=Math.min(q,Math.floor(F8().lossCap/unit)||1,Math.max(0,invCap()-invUsed()));
    if(q<=0)return MSG('f8.theftFull');
    const avg=(G.avgCost&&G.avgCost[it.n])||c.base;addStock(it.n,q,avg);stockAdd(it.n,q,false);
    return MSG('f8.theftBack',{n:c.short,q});
  }
  const a=lossPay(L);G.silver+=a;
  return MSG(kind==='fire'?'f8.fireAid':'f8.cargoAid',{a:fmt(a)});
}
REG_FAVOR.fireAid=()=>lossClaim('fire');REG_FAVOR.cargoAid=()=>lossClaim('cargo');REG_FAVOR.theftAid=()=>lossClaim('theft');

/* ---------- 每旬 ---------- */
function f8Tick(log){
  rivalsHere().forEach(n=>{if(n.suspUntil!==undefined&&n.suspUntil<G.turn){delete n.suspUntil;const t=NEWS('f8.suspEnd',{n:nameOf(n.cid)});pushNews(t);log.push(t)}});
  if(G.mono&&G.mono.until<G.turn){const t=NEWS('f8.monoEnd',{n:COMM_MAP[G.mono.name].short});pushNews(t);log.push(t);G.mono=null}
}
