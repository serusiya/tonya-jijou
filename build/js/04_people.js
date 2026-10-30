'use strict';
/* ★檔案總覽：人物互動、員工、家族
 * - 引薦與拜訪：introPower（性向相容×信任）、visitRoll（拒見/不在家/成功）、meetVia/meetCold（初見）。之後的拜訪戰鬥在 07u_battle.js。
 * - 請託：FAVORS、doFavor（拜訪打勝、好感 ≥60 才出現；辦成扣好感）。名稱與說明在 01e_ui_text.js 的 fav.*。
 * - 風評：rumorsOf（傳聞文字在 01d_lines.js 的 LINES.rumor）。 員工：hireEmp/empTick（私吞、潛逃）、船長/飛腳專職。
 * - 職位代號：apprentice 丁稚、clerk 手代、banto 番頭、chief 大番頭、captain 船長、courier 飛腳、guard 保鏢（顯示名在 00_names.js）。
 * - 家族與人生終章：marry、newKid、yearTick（年度結算）、endLife（壽終、破產、處刑、退隱；只有一代，不傳承）。 */
/* ======================= 04 人物：介紹人、性向、贈禮、風評、僱員、家族 ======================= */
/** 取某人在介紹人名單中的資料。 */
const introOf=cid=>G.intros.find(i=>i.cid===cid);
/** 可擔任介紹人的 NPC 身分白名單；同行巨賈（rival）刻意排除。 */
const INTRO_ROLE_WHITELIST=new Set(['guest','broker','smuggler','manager']);
/** 人物目前是否具備介紹人身分資格。 */
function canBeIntro(cid){
  const n=npc(cid);
  return !!(n&&INTRO_ROLE_WHITELIST.has(n.role)&&alive(cid)&&!n.hired&&!(G.emps||[]).some(e=>e.cid===cid));
}
/** 清理舊存檔或失效的介紹人，並修正目前介紹人。 */
function sanitizeIntros(){
  G.intros=(G.intros||[]).filter(i=>CH(i.cid)&&canBeIntro(i.cid));
  if(!G.introId||!introOf(G.introId))G.introId=G.intros[0]?G.intros[0].cid:null;
}
/** 請介紹人辦事的代價：直接扣他對你的交情 2～5（隨機），回傳扣掉的點數。已取消舊的『人情額度』。 */
function introCost(it){const d=2+Math.floor(rnd()*4);const r=R(it.cid);setAff(r,Math.max(0,r.aff-d));logRel(it.cid,MSG('log.introCost',{d}));return d}
/** 介紹人對目標的『引薦力』＝性向相容倍率×信任係數；性向未知時依估計。 */
function introPower(introCid,targetCid){
  const cp=compat(introCid,targetCid);const aff=R(introCid).aff;const tf=trustFactor(aff);
  return {cp,tf,score:cp.m*tf,aff};
}
/** 系統自動挑介紹人：目標的性向已探聽過時，選性向最相近者（同分取交情高者），否則選交情最高者；仇人與知名度不夠的人排後面。結果寫入 G.introId。 */
function autoIntro(targetCid){
  sanitizeIntros();
  const L=(G.intros||[]).filter(i=>CH(i.cid));if(!L.length){G.introId=null;return null}
  const sc=i=>{const cid=i.cid;let s=R(cid).aff/1000;if(isEnemy(cid))s-=100;if(fameTier()<introTier(cid))s-=10;if(targetCid&&R(targetCid).topKnown)s+=compat(cid,targetCid).matches;return s};   // 只有探聽過性向的對象才比對性向
  let best=L[0];L.forEach(i=>{if(sc(i)>sc(best))best=i});G.introId=best.cid;return best.cid;
}
/** 目標的官階（非官員視為 1），決定禮金與探聽成本。 */
function targetTier(cid){const n=npc(cid);return n&&n.pos?n.pos.rank:1}
/** 請介紹人引薦的禮金（20×階級）。 */
function introFee(cid){return costOf('introFee',Math.max(1,targetTier(cid)))}   // 官階越高，斡旋禮金越重
/** 引薦前預覽：性向是否已知、相容等級、信任係數。 */
function introPreview(introCid,targetCid){
  const r=R(targetCid);
  if(!r.topKnown)return {known:false,tf:trustFactor(R(introCid).aff)};
  const p=introPower(introCid,targetCid);return Object.assign({known:true},p);
}
/* ---------- 拜訪判定：依性向相容決定對方肯不肯見 ----------
   格格不入 80% 拒見；意氣相投 6%；相談甚歡 15%；一見如故不會拒見，但有 5% 不在家。
   無介紹人貿然登門：拒見率 35%（官階越高越難見）。 */
/** 【登門結果判定】拒見機率依性向相容（格格不入 80%、相談甚歡 15%、意氣相投 6%、一見如故 0；無介紹人約 35%＋官階加成），再減知名度減免；其餘 5% 不在家。 */
function visitRoll(cid){
  const n=npc(cid);let m=null,pRef;
  if(G.introId&&introOf(G.introId))m=introPower(G.introId,cid).cp.matches;
  if(m===null)pRef=clamp(0.35+(n&&n.pos?0.08*(n.pos.rank-1):0),0,0.8);
  else pRef=[0.8,0.15,0.06,0][m];
  if(pRef>0)pRef=Math.max(0.02,pRef-fameCut());
  const x=rnd();
  const outcome=x<pRef?'refuse':x<pRef+0.05?'absent':'ok';
  return {outcome,m,pRef};
}
/** 結識前檢查（現款、是否已結識、知名度門檻…），回傳錯誤字串或 null。 */
function meetCheck(cid,viaIntro){
  const n=npc(cid),r=R(cid);
  if(!n)return MSG('meet.gone');
  if(hiddenSmuggler(cid))return MSG('meet.smuggler');                  // 闇商人不能投帖求見（07g_smuggle.js）
  if(isEnemy(cid))return MSG('meet.1');
  if(r.lastIntro!=null&&G.turn-r.lastIntro<3&&r.lastOk)return MSG('meet.recent');
  /* 知名度階級：有介紹人時視同 +1 階；私房錢滿 2000 兩加一階（只加一階）已含在 fameTier */
  const need=meetTierNeed(cid),have=fameTier()+(viaIntro?1:0);
  if(have<need)return n.role==='oiran'?MSG('nomOiran.4'):MSG('meet.fame');
  if(viaIntro){
    const it=introOf(G.introId);if(!it)return MSG('meet.noIntro');
    if(fameTier()<introTier(G.introId))return MSG('meet.introFame');
    if(!affordAmt('introFee',introFee(cid)))return shortMsg('introFee',Math.max(1,targetTier(cid)));
  }else if(!afford('selfIntro'))return shortMsg('selfIntro');
  return null;
}
/** 計算首次結識的好感增幅。 */
function meetGain(cid,score,coldMul){
  const n=npc(cid);const base=n.pos?Math.round(16/(1+(n.pos.rank-2)*0.4)):12;
  return Math.round(base*score*(coldMul||1));
}
/* 引薦／往來：好感增量 = 基礎值 × 性向倍率 × 信任係數。roll 為已決定的拜訪結果 */
/** 經介紹人引薦初見：扣禮金與人情、依結果拒見/不在家/成功，成功則建立羈絆並增加知名度（官階越高越多）。 */
function meetVia(targetCid,introCid,roll){
  const n=npc(targetCid);const r=R(targetCid);const it=introOf(introCid);
  const err=meetCheck(targetCid,true);if(err)return {ok:false,msg:err};
  const fee=introFee(targetCid);const p=introPower(introCid,targetCid);
  roll=roll||{outcome:'ok'};
  if(roll.outcome==='absent'){addKnown(targetCid);logRel(targetCid,MSG('log.absent'));return {ok:false,msg:MSG('meetVia.1',{targetCid:nameOf(targetCid)})}}
  if(roll.outcome==='refuse'){
    const cost=Math.round(fee/2);spendAmt('introFee',cost);const dd=introCost(it);r.lastIntro=G.turn;r.lastOk=false;addKnown(targetCid);
    logRel(targetCid,MSG('log.introRefused',{i:nameOf(introCid),l:p.cp.label}));
    return {ok:false,msg:MSG('meetVia.2',{label:p.cp.label,cost,dd})};
  }
  spendAmt('introFee',fee);introCost(it);r.lastIntro=G.turn;r.lastOk=true;
  const base=n.pos?Math.round(16/(1+(n.pos.rank-2)*0.4)):12;
  let gain=Math.round(base*p.score);
  let backlash=false;
  if(p.cp.matches===0&&chance(ODDS.introBacklash.p)){gain=-3;backlash=true}
  setAff(r,clamp(r.aff+gain,0,100));r.met=true;r.seen=true;addKnown(targetCid);if(!r.fameGot){r.fameGot=true;addFame(n&&n.pos?1.5*n.pos.rank:0.6,n&&n.pos?'mid':undefined)}
  if(!r.bond||p.cp.m>r.bond.mult)r.bond={mult:p.cp.m,label:p.cp.label,introId:introCid};
  logRel(targetCid,MSG('log.introMeet',{i:nameOf(introCid),l:p.cp.label,r:backlash?MSG('log.backlash'):MSG('log.gainPlus',{g:gain})}));
  logRel(introCid,MSG('log.introduced',{n:nameOf(targetCid)}));
  return {ok:true,gain,cp:p.cp,tf:p.tf,backlash,fee,msg:MSG('meetVia.3',{introCid:nameOf(introCid),label:p.cp.label,gain:(backlash?MSG('meetVia.backlash'):MSG('log.gainPlus',{g:gain}))})};
}
/* 無介紹人：毛遂自薦，登門投帖（效果打折） */
/** 無介紹人，毛遂自薦：好感增幅打折、被拒機率高。 */
function meetCold(targetCid,roll){
  const n=npc(targetCid),r=R(targetCid);
  const err=meetCheck(targetCid,false);if(err)return {ok:false,msg:err};
  roll=roll||{outcome:'ok'};
  if(roll.outcome==='absent'){addKnown(targetCid);logRel(targetCid,MSG('log.coldAbsent'));return {ok:false,msg:MSG('meetVia.1',{targetCid:nameOf(targetCid)})}}
  if(roll.outcome==='refuse'){spend('selfIntroRefused');r.lastIntro=G.turn;r.lastOk=false;addKnown(targetCid);logRel(targetCid,MSG('log.coldRefused'));return {ok:false,msg:MSG('meetCold.refuse',{gate:TX('visit.gateNoIntro'),c:costOf('selfIntroRefused')})}}
  spend('selfIntro');r.lastIntro=G.turn;r.lastOk=true;
  const gain=Math.round((n.pos?10/(1+(n.pos.rank-2)*0.4):8));
  setAff(r,clamp(r.aff+gain,0,100));r.met=true;r.seen=true;addKnown(targetCid);if(!r.fameGot){r.fameGot=true;addFame(n&&n.pos?1.5*n.pos.rank:0.6,n&&n.pos?'mid':undefined)}
  r.bond={mult:0.6,label:UT('bond.cold'),introId:null};
  logRel(targetCid,MSG('log.coldMet',{g:gain}));
  return {ok:true,gain,msg:MSG('meetCold.1',{gain})};
}
/** 探聽性向費用。 */
function scoutCost(cid){return costOf('scout',Math.max(1,targetTier(cid)))}
/** 探聽某人的性向（最高三項能力）。 */
function scout(cid){
  const r=R(cid),c=scoutCost(cid);
  if(r.topKnown)return {ok:false,msg:MSG('scout.1')};
  if(!affordAmt('scout',c))return {ok:false,msg:shortMsg('scout',Math.max(1,targetTier(cid)))};
  spendAmt('scout',c);r.topKnown=true;r.seen=true;addKnown(cid);
  logRel(cid,MSG('log.scout'));
  return {ok:true,msg:MSG('scout.2',{top3:top3Txt(cid)})};
}
/** 向花街引手打聽軟肋的費用。 */
function weaknessRevealCost(cid){return costOf('weakness')+20*targetTier(cid)}
/** 揭露並證實某人的軟肋（送禮命中軟肋效果×3）。 */
function revealWeakness(cid){
  const r=R(cid),c=weaknessRevealCost(cid);
  if(r.verified)return {ok:false,msg:MSG('revealWeakness.1')};
  if(!affordAmt('weakness',c))return {ok:false,msg:MSG('revealWeakness.2',{c})};
  spendAmt('weakness',c);r.verified=true;addKnown(cid);
  logRel(cid,MSG('log.weak',{w:weakName(CH(cid).weakness)}));
  return {ok:true,msg:TX('flower.scoutTip',{n:nameOf(cid),w:weakName(CH(cid).weakness)})};
}

/* ---------- 贈禮：六種禮物與拜訪戰鬥在 07u_battle.js ---------- */
/** 賄賂換算：舊制『1 兩金』＝ 15 兩現款（索賄進獻等仍沿用）。 */
const BRIBE_RATE=15;

/* ---------- 官員請託 ---------- */
/** 官員請託項目（依系統別）：rank 所需官階、exactRank 限定該官階、once 一次性、cd 冷卻。名稱與說明在 01e_ui_text.js 的 fav.<k>、fav.<k>.d。新增請託在此加一筆並在 doFavor 實作效果。 */
const FAVORS={
  administration:[
    {k:'licWh',apply:true,lic:'wh',rank:1},
    {k:'licShip',apply:true,lic:'ship',rank:2},
    {k:'licStaff',apply:true,lic:'staff',rank:2},
    {k:'firebreak',apply:true,rank:5,exactRank:true}
  ],
  finance:[
    {k:'trade2',apply:true,trade:1,rank:3},
    {k:'trade1',apply:true,trade:0,rank:4},
    {k:'licHorse',apply:true,lic:'horse',rank:2},
    {k:'smallLoan',rank:1,exactRank:true,cd:3},
    {k:'loan',rank:2,exactRank:true,cd:12}
  ],
  judiciary:[
    {k:'licGuard',apply:true,lic:'guard',rank:2},
    {k:'sellAid',rank:1,exactRank:true,cd:3},
    {k:'blind',rank:2,exactRank:true,cd:12},
    {k:'lessen',rank:3,cd:12},
    {k:'hush',rank:4,cd:12},
    {k:'reconcile',rank:4,exactRank:true,cd:3}
  ]
};
/** 請託項目補上名稱與說明（表格檔 fav.<k>）。 */
const favorText=f=>Object.assign(f,{name:UT('fav.'+f.k),desc:UT('fav.'+f.k+'.d')});
Object.values(FAVORS).forEach(L=>L.forEach(favorText));
/** 某官員可受理的請託清單（已取得、已跨級或正在審理的資格不再列出；交易許可帶上貨名）。 */
function favorList(cid){const n=npc(cid);return n&&n.pos?(FAVORS[n.pos.court]||[]).filter(f=>(!f.pos||f.pos.includes(n.pos.posId))&&(!f.exactRank||n.pos.rank===f.rank)&&!(f.apply&&(favorDone(f,n)||favorPending(f)))&&!(f.k==='reconcile'&&!enemies().length)&&!(f.relief&&!reliefOpen(n.pos.court))&&!(f.bandit&&!banditFavorOpen(f,n))).map(f=>resolveFavor(f,n)):[]}
/** 流言杜絕的風聲減量：四階 3、五階 4、六階 5。 */
const HUSH_CUT=rank=>Math.max(3,Math.min(5,rank-1));
/** 借款種類的顯示名（舊存檔直接存中文名稱，原樣顯示）。 */
const debtKindName=k=>UI_TXT['fav.'+k]!==undefined?UT('fav.'+k):k;
/** 執行請託（只在拜訪打勝、好感 ≥60 時出現）：看官階、冷卻與是否已辦妥；不另收錢。辦成後好感：一般 −10、許可 −20（申請受理時扣）、減罪狀 −30。 */
function doFavor(cid,key,arg){
  const n=npc(cid),r=R(cid),f=resolveFavor(FAVORS[n.pos.court].find(x=>x.k===key),n);
  if(!f)return {ok:false,msg:MSG('doFavor.1')};
  if(n.pos.rank<f.rank||(f.exactRank&&n.pos.rank!==f.rank))return {ok:true,status:'refused',msg:TX('favor.outOfRank')};
  if(f.relief)return doRelief(cid,n,r,f);
  if(f.bandit)return doBanditFavor(cid,n,r,f);                  // 討伐海賊／山賊（07zv_bandit.js）                      // 災情救濟（07zu_relief.js）
  if(f.apply)return applyFavor(cid,n,r,f);                      // 許可、權利類：走申請審理流程（見 07k）
  r.cd=r.cd||{};if(r.cd[key]&&G.turn<r.cd[key])return {ok:true,status:'held',msg:MSG('doFavor.2',{key:(r.cd[key]-G.turn)})};
  if(f.once&&regionHeld(key,n))return {ok:true,status:'held',msg:MSG('doFavor.3')};
  if(key==='lessen'&&(G.lessen||0)>0)return {ok:true,status:'held',msg:MSG('doFavor.lessenHeld')};
  if(key==='sellAid'&&!xLot())return {ok:true,status:'held',msg:MSG('doFavor.sellAidFull')};
  const drop=key==='lessen'?REQ_AFF.lessen:REQ_AFF.normal;
  setAff(r,Math.max(0,r.aff-drop));if(f.cd)r.cd[key]=G.turn+f.cd;
  let msg='';
  if(REG_FAVOR[key]){msg=REG_FAVOR[key](n)}
  else if(key==='smallLoan'){const amt=750,back=Math.round(amt*1.1);G.silver+=amt;G.debts=G.debts||[];G.debts.push({due:G.turn+6,amt:back,cid:n.cid,kind:'smallLoan'});msg=MSG('favor.smallLoan',{a:fmt(amt),b:fmt(back)})}
  else if(key==='sellAid'){const L=xLot();G.xinv=G.xinv||{};G.xinv[L.c.name]=(G.xinv[L.c.name]||0)+L.q;addHeat(0.5);msg=MSG('favor.sellAid',{n:L.c.short,q:L.q})}
  else if(key==='loan'){const amt=3000*(n.pos.rank-1),back=Math.round(amt*1.15);G.silver+=amt;G.debts=G.debts||[];G.debts.push({due:G.turn+9,amt:back,cid:n.cid,kind:'loan'});msg=MSG('favor.loan',{a:fmt(amt),b:fmt(back)})}
  else if(key==='blind'){G.flags.blind=12;msg=MSG('favor.blind')}
  else if(key==='lessen'){G.lessen=1;msg=MSG('favor.lessen')}
  else if(key==='reconcile'){const t=arg&&G.rel[arg];if(t){t.peak=t.aff;delete t.enemyT;delete t.enemyAff;logRel(arg,MSG('log.reconcile',{n:nameOf(cid)}))}msg=MSG('favor.reconcile',{n:arg?nameOf(arg):UT('misc.unknown')})}
  else if(key==='hush'){const cut=HUSH_CUT(n.pos.rank);G.heat=Math.max(0,(G.heat||0)-cut);msg=TX('favor.hush'+Math.min(6,Math.max(4,n.pos.rank)))}
  logRel(cid,MSG('log.favor',{f:f.name,m:msg,d:drop}));
  return {ok:true,status:'done',msg:TX('favor.accept')+' '+msg+MSG('favor.affTail',{d:drop})};
}
/* ---------- 風評（真假參半）---------- */
/** 外人風評：真假參半，附可信度星數。傳聞文字在 01d_lines.js 的 LINES.rumor（依性格、軟肋、能力代號）。 */
const TRAIT_G=LINES.rumor.trait,WEAK_G=LINES.rumor.weak,STAT_G=LINES.rumor.stat;
function rumorsOf(cid){
  const c=CH(cid),rd=seeded(cid+'rumor'),out=[];
  const traits=Object.keys(TRAIT_G),weaks=Object.keys(WEAK_G),stats=STATS.map(s=>s[0]);
  const mk=(real,fakePool,src,cred)=>{
    const truth=rd()<cred;
    const txt=truth?real:fakePool[Math.floor(rd()*fakePool.length)];
    out.push({txt,src,cred,truth});
  };
  const S=LINES.rumor.src;
  mk(TRAIT_G[c.primary_trait],traits.filter(t=>t!==c.primary_trait).map(t=>TRAIT_G[t]),S.trait,0.7);
  mk(WEAK_G[c.weakness],weaks.filter(w=>w!==c.weakness).map(w=>WEAK_G[w]),S.weak,0.5);
  const sorted=STATS.map(([k],i)=>({k,i,v:c.derived_stats[k]})).sort((a,b)=>b.v-a.v||a.i-b.i);
  mk(STAT_G[sorted[0].k],stats.filter(s=>s!==sorted[0].k).map(s=>STAT_G[s]),S.stat,0.55);
  const n=npc(cid);
  if(n&&n.role==='official')mk(LINES.rumor.official.real,LINES.rumor.official.fake,S.official,0.6);
  return out;
}

/* ---------- 承諾 ---------- */
/** 每旬人物流動：本城與同一座外地城市各交換一人，不增減各城職缺與宅邸人數。 */
function peopleMoveTick(log){
  if(roll('officialTransfer')){
    const local=officialsOf(G.cityId);
    const foreign=Object.values(G.world.npcs).filter(n=>n.role==='official'&&n.cityId!==G.cityId&&n.pos&&n.pos.court!=='region'&&alive(n.cid));
    if(local.length&&foreign.length){
      const out=pick(local),incoming=pick(foreign),foreignId=incoming.cityId;
      const homePos=out.pos,foreignPos=incoming.pos;
      out.cityId=foreignId;out.pos=foreignPos;
      incoming.cityId=G.cityId;incoming.pos=homePos;
      addKnown(incoming.cid);
      logRel(out.cid,MSG('log.transferOut',{c:CITY(foreignId).name}));
      logRel(incoming.cid,MSG('log.transferIn',{c:CITY(foreignId).name,p:posTitle(incoming)}));
      const t=NEWS('peopleMove.official',{out:nameOf(out.cid),dest:CITY(foreignId).name,in:nameOf(incoming.cid),from:CITY(foreignId).name,post:posTitle(incoming)});
      pushNews(t);log.push(t);
    }
  }
  if(roll('residenceTransfer')){
    const employed=n=>n.hired||(G.emps||[]).some(e=>e.cid===n.cid);
    const movable=n=>n.role!=='official'&&n.role!=='oiran'&&n.role!=='guard'&&n.role!=='rival'&&!introOf(n.cid)&&!employed(n)&&alive(n.cid);
    const foreign=Object.values(G.world.npcs).filter(n=>n.cityId!==G.cityId&&movable(n));
    const local=resident().filter(movable).filter(n=>foreign.some(x=>x.role===n.role));
    if(local.length){
      const out=pick(local),incoming=pick(foreign.filter(n=>n.role===out.role)),foreignId=incoming.cityId;
      out.cityId=foreignId;incoming.cityId=G.cityId;
      addKnown(incoming.cid);
      logRel(out.cid,MSG('log.moveOut',{c:CITY(foreignId).name}));
      logRel(incoming.cid,MSG('log.moveIn',{c:CITY(foreignId).name}));
      const t=NEWS('peopleMove.residence',{kind:ROLE_LABEL[out.role]||UT('role.notable'),out:nameOf(out.cid),dest:CITY(foreignId).name,in:nameOf(incoming.cid),from:CITY(foreignId).name});
      pushNews(t);log.push(t);
    }
  }
}
/** 每旬人際結算：承諾逾期扣好感、逾期失信會扣好感。 */
function peopleTick(log){
  peopleMoveTick(log);
  Object.entries(G.rel).forEach(([cid,r])=>{
    r.promises.forEach(p=>{
      if(!p.done&&G.turn>p.due&&!p.late){p.late=true;setAff(r,Math.max(0,r.aff-10));logRel(cid,MSG('log.late',{t:p.text}));const t=NEWS('peopleTick.1',{cid:nameOf(cid)});pushNews(t);log.push(t)}
    });
  });
  (G.debts||[]).forEach(d=>{if(!d.paid&&!d.warned&&d.due-G.turn===2){d.warned=true;const t=NEWS('peopleTick.due',{d:fmt(d.amt)});pushNews(t);log.push(t)}});
  (G.debts||[]).forEach(d=>{if(!d.paid&&G.turn>=d.due){d.paid=true;G.silver-=d.amt;const t=NEWS('peopleTick.2',{d:fmt(d.amt)});pushNews(t);log.push(t)}});
  if(G.debts)G.debts=G.debts.filter(d=>!d.paid);
}
/** 兌現承諾。 */
function payPromise(cid,idx){
  const r=R(cid),p=r.promises[idx];if(!p||p.done)return {ok:false,msg:MSG('payPromise.1')};
  if(p.kind==='tribute'){
    const amtS=p.amount*BRIBE_RATE;
    if(G.silver<amtS)return {ok:false,msg:MSG('payPromise.2',{amtS:fmt(amtS)})};
    payPublic('spend.tribute|'+cid,amtS);G.life.gold+=p.amount;addHeat(1);p.done=true;setAff(r,clamp(r.aff+3,0,100));logRel(cid,MSG('log.paid',{a:amtS}));
    return {ok:true,msg:MSG('payPromise.3',{amtS:fmt(amtS)})};
  }
  p.done=true;return {ok:true,msg:MSG('payPromise.4')};
}

/* ---------- 僱員 ---------- */
/** 丁稚→手代→番頭→大番頭的晉升階梯（職位代號）。 */
const RANKS=['apprentice','clerk','banto','chief'];
/** 各職位基準月例。 */
const RANK_WAGE={apprentice:2,clerk:6,banto:12,chief:24};
/** 各職位私吞傾向。 */
const RANK_SKIM={apprentice:0.2,clerk:0.6,banto:0.9,chief:1.2};
/** 各職位私吞的基本額（兩）。 */
const RANK_SKIM_BASE={apprentice:1,clerk:4,banto:10,chief:25,captain:6,courier:3,guard:3};
/* 專職：船長（海運）、飛腳（陸路）、保鏢——不在晉升階梯內 */
/** 專職（船長、飛腳、保鏢）：不在晉升階梯，供商路派用與護衛。 */
const SPECIAL=['captain','courier','guard'];
Object.assign(RANK_WAGE,{captain:10,courier:6,guard:8});Object.assign(RANK_SKIM,{captain:0.5,courier:0.4,guard:0.2});
/** 專職說明（表格檔 duty.<職位>）。 */
const SPECIAL_DESC={};SPECIAL.forEach(k=>SPECIAL_DESC[k]=UT('duty.'+k));
/** 運輸方式對應的專職：sea→captain、land→courier。 */
const CREW_RANK={sea:'captain',land:'courier'};
/** 人物若為員工，回傳其職位代號。 */
const empRole=cid=>{const e=G.emps.find(x=>x.cid===cid);return e?e.rank:null};
/** 船長/飛腳總人數。 */
const crewCount=mode=>G.emps.filter(e=>e.rank===CREW_RANK[mode]).length;
/** 目前在途貨運佔用的船長/飛腳數。 */
const crewBusy=mode=>G.ships.filter(s=>s.mode===mode).length;
/** 少年員工名字候選（00_names.js）。 */
const KID_NAMES=NAMES.kidEmp;
/** 為無名冊的少年員工生成隱藏數值。 */
function randStats(r){r=r||rnd;const g=()=>Math.round(25+r()*55);return {commerce_skill:g(),integrity_loyalty:g(),greed_index:g(),audacity_courage:g(),diplomacy_charm:g(),betrayal_risk:Math.round(10+r()*50)}}
/** 員工的隱藏數值：原始能力（有名冊者取名冊）＋久任與升遷的成長（e.grow，見 07zs_staffcare.js）。名冊資料不可直接改。 */
function statsOfEmp(e){const b=e.cid?CH(e.cid).derived_stats:e.stats;if(!e.grow)return b;const o=Object.assign({},b);Object.entries(e.grow).forEach(([k,v])=>{o[k]=(o[k]||0)+v});return o}
/** 聘用員工（建立員工紀錄，名冊人物會被標記為已聘並結識）。 */
function hireEmp(cid,rank,free){
  const e={id:'e'+G.turn+'_'+Math.floor(rnd()*1e6),cid:cid||null,rank,since:G.turn,skim:0,audited:G.turn,wage:RANK_WAGE[rank],aff:40};
  if(cid){e.name=nameOf(cid);addKnown(cid);const n=npc(cid);if(n)n.hired=true;const r=R(cid);r.met=true;if(!r.bond)r.bond={mult:1,label:UT('bond.hired'),introId:null};setAff(r,Math.max(r.aff,30))}
  else{const rd=seeded('ap'+G.turn+rnd());e.name=pick(KID_NAMES);e.stats=randStats(rd);e.age0=G.year-12}
  if(cid){const c=CH(cid).derived_stats.commerce_skill;e.wage=Math.round(RANK_WAGE[rank]*(0.8+c/150))}
  addFame(0.3);G.emps.push(e);return e;
}
/** 員工對出貨收益的總加成（最多 +4%）。 */
function empMult(){return clamp(1+tellerBonus(),1,1.04)}
/** 每旬員工結算：私吞、番頭捲款潛逃判定。 */
function empTick(log){
  const rm=[];
  G.emps.forEach(e=>{
    const s=statsOfEmp(e);
    const K_=ODDS.skim,p=clamp((s.greed_index*K_.greed+s.betrayal_risk*K_.betray-s.integrity_loyalty*K_.loyal)/100,0,K_.cap)*RANK_SKIM[e.rank]*skimMul(e)*guardF(e);   // 好感、自家栽培、收斂、記恨等倍率見 07zs_staffcare.js
    if(chance(p)){
      const amt=Math.round(Math.max(0,(TURNRP&&TURNRP.rev)||0)*(0.005+rnd()*0.015)+(RANK_SKIM_BASE[e.rank]||3));
      e.skim+=amt;G.silver-=amt;
    }
    if((e.rank==='chief'||e.rank==='banto')&&((e.fleeAt!==undefined&&G.turn>=e.fleeAt)||s.betrayal_risk>=75&&s.integrity_loyalty<=40&&chance(ODDS.flee.p*fleeMul(e)))){
      const take=Math.round(Math.max(0,G.silver)*0.3);G.silver-=take;rm.push(e);
      const t=NEWS('empTick.1',{rank:rankName(e.rank),name:e.name,take:fmt(take)});pushNews(t);log.push(t);sfx.bad();
    }
  });
  if(rm.length){G.emps=G.emps.filter(e=>!rm.includes(e));rm.forEach(e=>{if(e.cid&&npc(e.cid))npc(e.cid).hired=false;if(e.cid)setAff(R(e.cid),0)})}
}
/** 辭退員工。 */
function fireEmp(id){
  const e=G.emps.find(x=>x.id===id);if(!e)return '';
  G.emps=G.emps.filter(x=>x!==e);if(e.cid&&npc(e.cid))npc(e.cid).hired=false;
  if(!e.cid)return '';
  syncPeaks();const r=R(e.cid);setAff(r,Math.max(0,r.aff-FIRE_AFF));logRel(e.cid,MSG('log.fired',{d:FIRE_AFF}));
  return isEnemy(e.cid)?MSG('fire.enemy',{n:nameOf(e.cid)}):MSG('fire.aff',{n:nameOf(e.cid),d:FIRE_AFF});
}
/** 某職位是否還有名額（名額由許可決定，見 07t_permits.js 的 slotCap）。 */
function slotFree(rank){return G.emps.filter(e=>e.rank===rank).length<slotCap(rank)}
/** 名冊的角色代號 → 可聘職位；丁稚只由 hireApprentice 另行招收。 */
const EMP_SUITABLE=[
  ['manager',['clerk','banto','chief']],
  ['rival',['clerk','banto']],
  ['guest',['clerk']],
  ['broker',['clerk','courier']],
  ['smuggler',['captain']],
  ['guard',['guard']]
];
const RECRUIT_RANKS=['clerk','banto','chief','captain','courier','guard'];
/** 人物依名冊角色可擔任的所有職位（固定依介面順序回傳）。 */
function suitableEmpRanks(cid){
  const c=CH(cid);if(!c)return [];
  const out=new Set(),roles=c.roles||[];
  EMP_SUITABLE.forEach(([role,ranks])=>{if(roles.includes(role))ranks.forEach(r=>out.add(r))});
  return RECRUIT_RANKS.filter(r=>out.has(r));
}
/** 套用介紹人可引薦的店內最高職階；專職不受店內職階上下限影響。 */
function candidateHireRanks(cid,maxRank){
  const maxI=Math.max(1,RANKS.indexOf(maxRank));
  return suitableEmpRanks(cid).filter(r=>SPECIAL.includes(r)||(RANKS.indexOf(r)>=1&&RANKS.indexOf(r)<=maxI));
}
/** 依引薦分數決定可聘到的最高職階；具名成人最低從手代起聘。 */
function maxRankFor(score){return score>=2.5?'chief':score>=1.5?'banto':'clerk'}
/** 若該職階無適任人選，逐級降至確實有人可任的職階。 */
function availableRecruitRank(wanted,pool){
  for(let i=RANKS.indexOf(wanted);i>=1;i--){const rank=RANKS[i];if(pool.some(n=>suitableEmpRanks(n.cid).includes(rank)))return rank}
  return null;
}
/** 可招聘人才池（本城在世、未被聘、18～62 歲，且至少適任一個非丁稚職位）。 */
function talentPool(){
  return Object.values(G.world.npcs).filter(n=>alive(n.cid)&&!n.hired&&!n.raided&&['manager','broker','guest'].includes(n.role)&&ageOf(n.cid)>=18&&ageOf(n.cid)<=62&&!G.intros.some(i=>i.cid===n.cid)&&suitableEmpRanks(n.cid).length);
}
/** 物色結果的口語說明（不列公式）：依可聘職階與交情/志趣給一句描述。 */
function recruitFlavor(name,rank,tf,avg){
  const why=tf<0.8?MSG('recruit.whyAff'):avg<0.9?MSG('recruit.whyTaste'):'';
  const v={n:name,r:rankName(rank),w:why?MSG('recruit.why',{w:why}):''};
  if(rank==='clerk')return MSG('recruit.clerk',v);
  if(rank==='banto')return MSG('recruit.banto',v);
  return MSG('recruit.chief',v);
}
/** 請介紹人物色人才：付禮金、扣人情，依信任係數決定人選品質與可聘職階。 */
function recruitVia(introCid){
  const it=introOf(introCid);if(!it)return {ok:false,msg:MSG('recruitVia.1')};
  const fee=costOf('recruitIntro');if(!afford('recruitIntro'))return {ok:false,msg:shortMsg('recruitIntro')};
  const pool=talentPool();if(!pool.length)return {ok:false,msg:MSG('recruitVia.2')};
  spendAmt('recruitIntro',fee);introCost(it);
  // 介紹人與主角的信任，加上自己與人才圈的投契，決定能請到什麼等級的人
  const avgScore=(()=>{const s=pool.slice(0,8).map(n=>introPower(introCid,n.cid).score);return s.reduce((a,b)=>a+b,0)/s.length})();
  const tf=trustFactor(R(introCid).aff);
  const wanted=maxRankFor(Math.max(avgScore*tf*1.1,tf*0.9));
  const rank=availableRecruitRank(wanted,pool);if(!rank)return {ok:false,msg:MSG('recruitVia.2')};
  const q=cid=>CH(cid).derived_stats.integrity_loyalty-CH(cid).derived_stats.betrayal_risk;
  // 至少一人確實適任介紹人宣稱能提供的最高職階，再以其他適任人才補足名冊。
  const targetSample=shuffle(pool.filter(n=>suitableEmpRanks(n.cid).includes(rank))).slice(0,6).sort((a,b)=>q(b.cid)-q(a.cid));
  const anchor=tf>=1.25?targetSample[0]:tf>=0.8?pick(targetSample):targetSample[targetSample.length-1];
  const rest=shuffle(pool.filter(n=>n!==anchor)).slice(0,2);
  const cands=[anchor].concat(rest);
  cands.forEach(n=>{addKnown(n.cid);if(n.cityId!==G.cityId)n.cityId=G.cityId});
  G.recruit={introId:introCid,rank,cands:cands.map(n=>n.cid),turn:G.turn,tf,avg:avgScore};
  logRel(introCid,MSG('log.recruit'));
  return {ok:true,msg:MSG('recruitVia.found',{flavor:recruitFlavor(nameOf(introCid),rank,tf,avgScore),n:cands.length}),rank};
}
/** 聘用物色到的人選（含船長/飛腳專職；付 4 倍月例為聘金）。 */
function hireCandidate(cid,rank){
  if(rank==='apprentice')return {ok:false,msg:MSG('hireCandidate.5')};
  if(!G.recruit||!G.recruit.cands.includes(cid))return {ok:false,msg:MSG('hireCandidate.4')};
  if(!candidateHireRanks(cid,G.recruit.rank).includes(rank))return {ok:false,msg:MSG('hireCandidate.3',{rank:rankName(rank)})};
  if(!slotFree(rank))return {ok:false,msg:MSG('slotFull',{rank:rankName(rank)})};
  const ri=RANKS.indexOf(rank),max=RANKS.indexOf(G.recruit?G.recruit.rank:'apprentice');
  if(!SPECIAL.includes(rank)&&ri>max)return {ok:false,msg:MSG('hireCandidate.1',{rank:rankName(G.recruit.rank)})};
  const wage=Math.round(RANK_WAGE[rank]*(0.8+CH(cid).derived_stats.commerce_skill/150)),fee=costOf('hireMonths',wage),ship=rank==='captain'?shipCost():0;
  if(G.silver<fee+ship)return {ok:false,msg:ship?MSG('hireCandidate.shipShort',{c:fmt(fee+ship),ship:fmt(ship)}):shortMsg('hireMonths',wage)};
  spendAmt('hireMonths',fee);if(ship)spendAmt('shipBuild',ship);hireEmp(cid,rank);
  if(G.recruit)G.recruit.cands=G.recruit.cands.filter(x=>x!==cid);
  return {ok:true,msg:MSG('hireCandidate.2',{cid:nameOf(cid),rank:rankName(rank),wage})+(ship?MSG('hireCandidate.ship',{ship:fmt(ship)}):'')};
}
/** 聘船長時另付的造船費：600 × 聘後的船長數。 */
const shipCost=()=>costOf('shipBuild',G.emps.filter(e=>e.rank==='captain').length+1);
/** 招丁稚（需介紹人）。 */
function hireApprentice(){
  if(!G.introId||!introOf(G.introId))return {ok:false,msg:MSG('hireApprentice.1')};
  if(!slotFree('apprentice'))return {ok:false,msg:MSG('hireApprentice.2')};
  if(!afford('apprentice'))return {ok:false,msg:shortMsg('apprentice')};
  spend('apprentice');const e=hireEmp(null,'apprentice');return {ok:true,msg:MSG('hireApprentice.3',{name:e.name})};
}
/** 升遷（需任職滿 24 旬；專職不可升遷）。 */
function promoteEmp(id){
  const e=G.emps.find(x=>x.id===id);if(!e)return {ok:false};
  if(SPECIAL.includes(e.rank))return {ok:false,msg:MSG('promote.special',{rank:rankName(e.rank)})};
  const i=RANKS.indexOf(e.rank);if(i>=3)return {ok:false,msg:MSG('promoteEmp.1')};
  const nr=RANKS[i+1];
  if(G.turn-(e.promotedAt!==undefined?e.promotedAt:e.since)<24)return {ok:false,msg:MSG('promoteEmp.2')};   // 年資（e.since）不因升遷重算，升遷間隔看上次升遷
  if(!slotFree(nr))return {ok:false,msg:MSG('slotFull',{rank:rankName(nr)})};
  e.rank=nr;e.wage=Math.round(RANK_WAGE[nr]*(e.cid?(0.8+CH(e.cid).derived_stats.commerce_skill/150):1));e.promotedAt=G.turn;
  promoteBoon(e);                                  // 升遷：好的能力各 +5%、忠誠 +5、好感 +15、自家栽培
  return {ok:true,msg:MSG('promoteEmp.3',{name:e.name,nr:rankName(nr)})+MSG('promote.boon',{a:STAFF.promoteAff})};
}

/* ---------- 家族 ---------- */
/** 說親：町人/同行/政商三種，需介紹人當媒人；成功增加知名度。 */
function marry(kind,targetCid,introCid){
  if(G.family.spouse)return {ok:false,msg:MSG('marry.1')};
  const it=introOf(introCid);if(!it)return {ok:false,msg:MSG('marry.2')};
  const mk={rival:'marryRival',official:'marryOfficial',commoner:'marryCommoner'}[kind],cost=costOf(mk);
  if(!afford(mk))return {ok:false,msg:shortMsg(mk)};
  let sc=1;
  if(targetCid){const r=R(targetCid);if(!r.bond||r.aff<(kind==='official'?50:45))return {ok:false,msg:MSG('marry.3',{official:(kind==='official'?50:45)})};sc=introPower(introCid,targetCid).score}
  else sc=trustFactor(R(introCid).aff);
  spend(mk);introCost(it);
  const p=clamp(ODDS.marry.base+ODDS.marry.perScore*sc,ODDS.marry.min,ODDS.marry.max);
  if(!chance(p)){if(targetCid)setAff(R(targetCid),Math.max(0,R(targetCid).aff-5));logRel(introCid,MSG('log.marryFail'));return {ok:true,fail:true,msg:MSG('marry.4',{p:Math.round(p*100)})}}
  const spouse={name:pick(NAMES.spouse)+UT('spouse.of',{f:NM('marryFam',kind)}),kind,birthYear:G.year-rint(17,24)};
  addFame(3,'mid');G.family.spouse=spouse;G.family.married=true;G.life.spouseKind=kind;
  let extra='';
  if(kind==='rival'&&targetCid){setAff(R(targetCid),clamp(R(targetCid).aff+25,0,100));G.cartel.comp=Math.min(90,G.cartel.comp+5);extra=MSG('marry.rival')}
  if(kind==='official'&&targetCid){setAff(R(targetCid),clamp(R(targetCid).aff+20,0,100));extra=MSG('marry.official')}
  if(kind==='commoner'){extra=MSG('marry.commoner')}
  pushNews(NEWS('marry.1',{name:G.me.name,name2:spouse.name}));
  return {ok:true,msg:MSG('marry.5',{extra})};
}
/** 生成子女（gender：m／f）。 */
function newKid(){
  const g=chance(ODDS.birth.male)?'m':'f';
  const st=randStats();
  return {id:'k'+G.turn+'_'+Math.floor(rnd()*1e6),name:pick(g==='m'?CHILD_M:CHILD_F),gender:g,birthYear:G.year,stats:st,path:null,revealed:false,prodigal:false};
}
/** 子女年齡。 */
const kidAge=k=>G.year-k.birthYear;
/** 子女年齡層文字（畫面不顯示歲數）：未滿 8 年幼、8～15 少年（可安排歷練）、16 起成年。 */
const kidStage=a=>NM('kidStage',a<8?'young':a<16?'teen':'adult');
/** 子女歷練路線（名稱在 00_names.js 的 NAMES.path）。 */
const PATHS={shop:{cost:costOf('pathShop'),stat:{commerce_skill:1.8,integrity_loyalty:0.6}},sea:{cost:costOf('pathSea'),stat:{audacity_courage:1.8,commerce_skill:0.6}},court:{cost:costOf('pathCourt'),stat:{diplomacy_charm:1.8,greed_index:0.3}}};
Object.keys(PATHS).forEach(k=>PATHS[k].name=NM('path',k));
/** 設定子女歷練。 */
function setKidPath(id,path){
  const k=G.family.kids.find(x=>x.id===id);if(!k)return {ok:false};
  if(kidAge(k)<8)return {ok:false,msg:MSG('setKidPath.1')};
  k.path=path;return {ok:true,msg:MSG('setKidPath.2',{name:k.name,path:PATHS[path].name,path2:PATHS[path].cost})};
}
/** 處理敗家子。 */
function kidFixProdigal(id,mode){
  const k=G.family.kids.find(x=>x.id===id);if(!k)return {ok:false};
  if(mode==='pay'){if(!afford('kidDebt'))return {ok:false,msg:shortMsg('kidDebt')};spend('kidDebt');k.prodigal=false;k.stats.greed_index=Math.max(20,k.stats.greed_index-10);return {ok:true,msg:MSG('kidFixProdigal.1',{name:k.name})}}
  G.family.kids=G.family.kids.filter(x=>x!==k);const lf=loseFame('disown');return {ok:true,msg:MSG('kidFixProdigal.2',{name:k.name})+(lf?MSG('kid.disownFame',{f:lf}):'')};
}
/** 年度結算：老化、死亡、官員任期、子女成長、百年大事等。 */
function yearTick(log){
  const t=NEWS('yearTick.1',{year:yearStr(G.year),myAge:myAge()});pushNews(t);log.push(t);
  // 人物病逝
  Object.values(G.world.npcs).forEach(n=>{
    const c=CH(n.cid);if(!c||c.death_year!==G.year)return;
    const r=G.rel[n.cid];
    if(r&&r.aff>=20&&r.seen){const tt=NEWS('yearTick.2',{name:c.name,birth_year:(c.death_year-c.birth_year)});pushNews(tt);log.push(tt)}
    if(introOf(n.cid)){G.intros=G.intros.filter(i=>i.cid!==n.cid);if(G.introId===n.cid)G.introId=G.intros[0]?G.intros[0].cid:null}
    const e=G.emps.find(x=>x.cid===n.cid);if(e){G.emps=G.emps.filter(x=>x!==e);pushNews(NEWS('yearTick.3',{rank:rankName(e.rank),name:e.name}))}
    if(n.role==='official'&&n.pos){const rep=replaceOfficial(n);if(rep)addKnown(rep);n.pos=null}   // 病重離職：職位交給遞補者，避免同一職位一年內兩人並列
  });
  // 子女
  G.family.kids.forEach(k=>{
    const a=kidAge(k);
    if(k.path&&a>=8){const P=PATHS[k.path];G.silver-=P.cost;Object.entries(P.stat).forEach(([s,v])=>{k.stats[s]=Math.min(95,k.stats[s]+v)})}
    if(a===12&&!k.revealed){k.revealed=true;const tt=NEWS('yearTick.4',{name:k.name,top3Of:statName(top3Of(k.stats)[0])});pushNews(tt);log.push(tt)}
    if(a>=16&&!k.prodigal&&k.stats.greed_index>65&&k.stats.integrity_loyalty<48&&roll('prodigal')){k.prodigal=true;const tt=NEWS('yearTick.5',{name:k.name});pushNews(tt);log.push(tt)}
  });
  if(G.family.spouse&&G.family.kids.length<4&&G.year-G.family.spouse.birthYear<=42&&roll('birth')){
    const k=newKid();G.family.kids.push(k);const tt=NEWS('yearTick.6',{gender:NM('gender',k.gender),name:k.name});pushNews(tt);log.push(tt);
  }
  staffYearTick(log);                              // 員工久任成長
  newProdTick(log);                                // 一月上旬：一定機率新增本業貨產地
  // 壽數：四十五歲後逐年遞增，另有小機率橫禍
  const age=myAge();
  const p=Math.max(0,age-ODDS.death.startAge)*ODDS.death.perYear+ODDS.death.base;
  if(chance(p))endLife('death');
}

/* ---------- 蓋棺評語 ---------- */
/** 淨資產估算（現款＋庫存市值等）。 */
function netWorth(){let v=G.silver;Object.entries(G.inv).forEach(([n,q])=>v+=q*COMM_MAP[n].base);return Math.round(v)}
/** 生平總結評語（高/中/低好感）。 */
const QUOTE_HI=Ls('eulogy.hi'),QUOTE_MID=Ls('eulogy.mid'),QUOTE_LO=Ls('eulogy.lo');          // 台詞在 01d_lines.js
/** 產生主角一生的總結（評語文字在 01e_ui_text.js 的 ob.*）。 */
function obituary(ageAt){
  const L=G.life,nw=netWorth();
  const wealth=UT(nw>=60000?'ob.w1':nw>=25000?'ob.w2':nw>=8000?'ob.w3':nw>=0?'ob.w4':'ob.w5');
  const good=L.charity*2+L.pledges*0.3,bad=L.cheats*2+L.scapegoat*0.5;
  const moral=UT(good>bad+3?'ob.good':bad>good+3?'ob.bad':'ob.mixed');
  const pol=UT(L.gold>=60?'ob.pol1':L.gold<=8?'ob.pol2':'ob.pol3');
  const age=ageAt||myAge();
  const sum=UT('ob.sum',{w:wealth,m:moral,p:pol,a:age});
  const people=Object.entries(G.rel).filter(([id,r])=>r.aff>=25&&CH(id)&&(alive(id)||CH(id).death_year>=G.year-1)).sort((a,b)=>b[1].aff-a[1].aff).slice(0,5);
  const rd=seeded('ob'+G.turn+G.me.given);
  const quotes=people.map(([id,r])=>{
    const pool=r.aff>=70?QUOTE_HI:r.aff>=45?QUOTE_MID:QUOTE_LO;
    return {name:nameOf(id),aff:r.aff,txt:pool[Math.floor(rd()*pool.length)].replace('{n}',G.me.given)};
  });
  const facts=[UT('ob.f1',{a:age,y:G.year-0}),UT('ob.f2',{n:fmt(nw)}),UT('ob.f3',{g:L.gold}),UT('ob.f4',{c:L.charity,x:L.cheats}),UT('ob.f5',{f:L.fires,r:L.riots}),UT('ob.f6',{k:G.family.kids.length})];
  return {wealth,moral,pol,sum,quotes,facts,nw,age};
}
/** 退隱：從現在的年齡起逐年擲死亡機率（同 yearTick），算出享壽。 */
function retireDeathAge(){
  let a=myAge();
  while(a<100){a++;if(chance(Math.max(0,a-ODDS.death.startAge)*ODDS.death.perYear+ODDS.death.base))break}
  return a;
}
/** 結束這一世（壽終、破產、處刑、退隱）。只有一代：結束即清除存檔，人生終章後重新開局。 */
function endLife(cause){
  if(G.ended)return;
  delete G.party;
  const age=cause==='retire'?retireDeathAge():myAge();
  G.ended={cause,year:G.year,age,deathYear:G.year+(age-myAge()),ob:obituary(age)};
  clearSave();                                       // 人生落幕：不留存檔（save() 遇到 G.ended 也不再寫入）
  if(typeof UI!=='undefined'&&UI.showLegacy)UI.showLegacy();
}
