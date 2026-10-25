'use strict';
/* ★檔案總覽：人物互動、員工、家族
 * - 引薦與拜訪：introPower（性向相容×信任）、visitRoll（拒見/不在家/成功）、meetVia/meetCold（初見）。之後的拜訪戰鬥在 07u_battle.js。
 * - 請託：FAVORS、doFavor（拜訪打勝、好感 ≥60 才出現；辦成扣好感）。
 * - 風評：rumorsOf。 員工：hireEmp/empTick（私吞、潛逃）、船長/飛腳專職。
 * - 家族與人生終章：marry、newKid、yearTick（年度結算）、endLife（壽終、破產、處刑、退隱；只有一代，不傳承）。 */
/* ======================= 04 人物：介紹人、性向、贈禮、風評、僱員、家族、傳承 ======================= */
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
function introCost(it){const d=2+Math.floor(rnd()*4);const r=R(it.cid);r.aff=Math.max(0,r.aff-d);logRel(it.cid,'請他出面辦事，交情 -'+d+'。');return d}
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
/** 結識前檢查（人情額度、現款、是否已結識…），回傳錯誤字串或 null。 */
function meetCheck(cid,viaIntro){
  const n=npc(cid),r=R(cid);
  if(!n)return '此人已不在此地';
  if(isEnemy(cid))return '視你為仇，拒不見面。';
  if(r.lastIntro!=null&&G.turn-r.lastIntro<3&&r.lastOk)return '才剛請託過，三旬內不宜再度叨擾';
  /* 知名度階級：有介紹人時視同 +1 階；私房錢滿 2000 兩加一階（只加一階）已含在 fameTier */
  const need=meetTierNeed(cid),have=fameTier()+(viaIntro?1:0);
  if(have<need)return n.role==='oiran'?'名氣不足，點不到她。':'名氣不足，對方不見。';
  if(viaIntro){
    const it=introOf(G.introId);if(!it)return '你還沒有介紹人';
    if(fameTier()<introTier(G.introId))return '名氣不足，介紹人不肯出面。';
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
  if(roll.outcome==='absent'){addKnown(targetCid);logRel(targetCid,'登門拜訪，主人恰好外出，吃了閉門羹。');return {ok:false,msg:MSG('meetVia.1',{targetCid:nameOf(targetCid)})}}
  if(roll.outcome==='refuse'){
    const cost=Math.round(fee/2);spendAmt('introFee',cost);const dd=introCost(it);r.lastIntro=G.turn;r.lastOk=false;addKnown(targetCid);
    logRel(targetCid,'經「'+nameOf(introCid)+'」引薦登門，對方藉故不見（'+p.cp.label+'）。');
    return {ok:false,msg:MSG('meetVia.2',{label:p.cp.label,cost,dd})};
  }
  spendAmt('introFee',fee);introCost(it);r.lastIntro=G.turn;r.lastOk=true;
  const base=n.pos?Math.round(16/(1+(n.pos.rank-2)*0.4)):12;
  let gain=Math.round(base*p.score);
  let backlash=false;
  if(p.cp.matches===0&&chance(ODDS.introBacklash.p)){gain=-3;backlash=true}
  r.aff=clamp(r.aff+gain,0,100);r.met=true;r.seen=true;addKnown(targetCid);if(!r.fameGot){r.fameGot=true;addFame(n&&n.pos?1.5*n.pos.rank:0.6)}
  if(!r.bond||p.cp.m>r.bond.mult)r.bond={mult:p.cp.m,label:p.cp.label,introId:introCid};
  logRel(targetCid,'經「'+nameOf(introCid)+'」引薦初見（'+p.cp.label+'）'+(backlash?'，對方嫌介紹人庸俗，反而不悅':'，好感 +'+gain)+'。');
  logRel(introCid,'為你引薦「'+nameOf(targetCid)+'」。');
  return {ok:true,gain,cp:p.cp,tf:p.tf,backlash,fee,msg:MSG('meetVia.3',{introCid:nameOf(introCid),label:p.cp.label,gain:(backlash?'，對方嫌棄介紹人，好感 -3':'，好感 +'+gain)})};
}
/* 無介紹人：毛遂自薦，登門投帖（效果打折） */
/** 無介紹人，毛遂自薦：好感增幅打折、被拒機率高。 */
function meetCold(targetCid,roll){
  const n=npc(targetCid),r=R(targetCid);
  const err=meetCheck(targetCid,false);if(err)return {ok:false,msg:err};
  roll=roll||{outcome:'ok'};
  if(roll.outcome==='absent'){addKnown(targetCid);logRel(targetCid,'貿然登門，主人恰好外出。');return {ok:false,msg:MSG('meetVia.1',{targetCid:nameOf(targetCid)})}}
  if(roll.outcome==='refuse'){spend('selfIntroRefused');r.lastIntro=G.turn;r.lastOk=false;addKnown(targetCid);logRel(targetCid,'貿然登門，被門房擋了回來。');return {ok:false,msg:MSG('meetCold.refuse',{gate:TX('visit.gateNoIntro'),c:costOf('selfIntroRefused')})}}
  spend('selfIntro');r.lastIntro=G.turn;r.lastOk=true;
  const gain=Math.round((n.pos?10/(1+(n.pos.rank-2)*0.4):8));
  r.aff=clamp(r.aff+gain,0,100);r.met=true;r.seen=true;addKnown(targetCid);if(!r.fameGot){r.fameGot=true;addFame(n&&n.pos?1.5*n.pos.rank:0.6)}
  r.bond={mult:0.6,label:'初識（無人引薦）',introId:null};
  logRel(targetCid,'貿然登門投帖，對方勉強見了一面，好感 +'+gain+'。');
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
  logRel(cid,'派人探聽，摸清了此人擅長與偏好的方面。');
  return {ok:true,msg:MSG('scout.2',{top3:top3(cid).join('、')})};
}
/** 向花街引手打聽軟肋的費用。 */
function weaknessRevealCost(cid){return costOf('weakness')+20*targetTier(cid)}
/** 揭露並證實某人的軟肋（送禮命中軟肋效果×3）。 */
function revealWeakness(cid){
  const r=R(cid),c=weaknessRevealCost(cid);
  if(r.verified)return {ok:false,msg:MSG('revealWeakness.1')};
  if(!affordAmt('weakness',c))return {ok:false,msg:MSG('revealWeakness.2',{c})};
  spendAmt('weakness',c);r.verified=true;addKnown(cid);
  logRel(cid,'經花街酒席上的閒談，得知其軟肋：'+CH(cid).weakness+'。');
  return {ok:true,msg:TX('flower.scoutTip',{n:nameOf(cid),w:CH(cid).weakness})};
}

/* ---------- 贈禮：六種禮物與拜訪戰鬥在 07u_battle.js ---------- */
/** 賄賂換算：舊制『1 兩金』＝ 15 兩現款（索賄進獻等仍沿用）。 */
const BRIBE_RATE=15;

/* ---------- 官員請託 ---------- */
/** 官員請託項目（依院別）：rank 所需官階、cost 成本、once 一次性、cd 冷卻。新增請託在此加一筆並在 doFavor 實作效果。 */
const FAVORS={
  administration:[
    {k:'licWh',apply:true,lic:'wh',name:'河岸倉地拜領',rank:1,desc:'核准增建倉庫的建地，官階越高給得越多。'},
    {k:'licShip',apply:true,lic:'ship',name:'船株鑑札',rank:2,desc:'核准多聘船長，一名船長帶一艘船。'},
    {k:'licStaff',apply:true,lic:'staff',name:'人別帳增補',rank:2,desc:'核准多雇手代與番頭。'}
  ],
  finance:[
    {k:'trade2',apply:true,trade:1,name:'交易許可',rank:3,desc:'核准買賣本業第二貴的貨。'},
    {k:'trade1',apply:true,trade:0,name:'交易許可',rank:4,desc:'核准買賣本業最貴的貨。'},
    {k:'licHorse',apply:true,lic:'horse',name:'馬幫株',rank:2,desc:'核准多聘飛腳，一名飛腳帶一支馬幫。'},
    {k:'smallLoan',name:'小額周轉',rank:1,cd:3,desc:'先借 750 兩應急，六旬後連本帶一成利息歸還。'},
    {k:'loan',name:'官倉平準貸款',rank:2,cd:12,desc:'官府低息借款，九旬後連本帶利歸還。'}
  ],
  judiciary:[
    {k:'licGuard',apply:true,lic:'guard',name:'帶刀護衛許可',rank:2,desc:'核准多聘保鏢。'},
    {k:'sellAid',name:'協助銷貨',rank:1,cd:3,desc:'官府沒收的一批貨交給你處理，賣得的錢歸你（需倉位，再請座客商人代售）。'},
    {k:'blind',name:'袖之下',rank:2,cd:12,desc:'十二旬內搜查時多半睜隻眼。'},
    {k:'lessen',name:'減罪狀',rank:3,cd:12,desc:'下一次被定罪時，刑罰減輕一等。最多持有一張。'}
  ]
};
/** 某官員可受理的請託清單（已取得的交易許可不再列出；交易許可帶上貨名）。 */
function favorList(cid){const n=npc(cid);return n&&n.pos?(FAVORS[n.pos.court]||[]).filter(f=>(!f.pos||f.pos.includes(n.pos.posId))&&!(f.trade!==undefined&&favorDone(f,n))).map(resolveFavor):[]}
/** 執行請託（只在拜訪打勝、好感 ≥60 時出現）：看官階、冷卻與是否已辦妥；不另收錢。辦成後好感：一般 −10、許可 −20（申請受理時扣）、減罪狀 −30。 */
function doFavor(cid,key){
  const n=npc(cid),r=R(cid),f=resolveFavor(FAVORS[n.pos.court].find(x=>x.k===key));
  if(!f)return {ok:false,msg:MSG('doFavor.1')};
  if(n.pos.rank<f.rank)return {ok:true,status:'refused',msg:TX('favor.outOfRank')};
  if(f.apply)return applyFavor(cid,n,r,f);                      // 許可、權利類：走申請審理流程（見 07k）
  r.cd=r.cd||{};if(r.cd[key]&&G.turn<r.cd[key])return {ok:true,status:'held',msg:MSG('doFavor.2',{key:(r.cd[key]-G.turn)})};
  if(f.once&&regionHeld(key,n))return {ok:true,status:'held',msg:MSG('doFavor.3')};
  if(key==='lessen'&&(G.lessen||0)>0)return {ok:true,status:'held',msg:MSG('doFavor.lessenHeld')};
  if(key==='sellAid'&&!xLot())return {ok:true,status:'held',msg:MSG('doFavor.sellAidFull')};
  const drop=key==='lessen'?REQ_AFF.lessen:REQ_AFF.normal;
  r.aff=Math.max(0,r.aff-drop);if(f.cd)r.cd[key]=G.turn+f.cd;
  let msg='';
  if(REG_FAVOR[key]){msg=REG_FAVOR[key](n)}
  else if(key==='smallLoan'){const amt=750,back=Math.round(amt*1.1);G.silver+=amt;G.debts=G.debts||[];G.debts.push({due:G.turn+6,amt:back});msg='借得 '+fmt(amt)+' 兩，六旬後須還 '+fmt(back)+' 兩。'}
  else if(key==='sellAid'){const L=xLot();G.xinv=G.xinv||{};G.xinv[L.c.name]=(G.xinv[L.c.name]||0)+L.q;G.heat=(G.heat||0)+0.5;msg='官府沒收的「'+L.c.short+'」'+L.q+' 單位交給你處理，已入倉；可請座客商人代售。'}
  else if(key==='loan'){const amt=3000*(n.pos.rank-1),back=Math.round(amt*1.15);G.silver+=amt;G.debts=G.debts||[];G.debts.push({due:G.turn+9,amt:back});msg='獲准官倉貸款 '+fmt(amt)+' 兩，九旬後須還 '+fmt(back)+' 兩。'}
  else if(key==='blind'){G.flags.blind=12;msg='十二旬內搜查時多半睜隻眼。'}
  else if(key==='lessen'){G.lessen=1;msg='取得減罪狀，下次被定罪時刑罰減輕一等。'}
  logRel(cid,'請託「'+f.name+'」：'+msg+'好感 -'+drop+'。');
  return {ok:true,status:'done',msg:TX('favor.accept')+' '+msg+'（好感 -'+drop+'）'};
}
/* ---------- 風評（真假參半）---------- */
/** 風評用語：性格→傳聞。 */
const TRAIT_G={忠誠:'為人一諾千金，從不食言',貪婪:'聽說錢到他手裡就沒有再吐出來的',狡黠:'心思深沉，千萬不可輕信',復仇:'有仇必報，得罪不起',嚴謹:'做事一板一眼，帳目分毫不差',豪爽:'出手闊綽，最愛結交朋友',狂妄:'目中無人，不把同行放在眼裡',嗜賭:'聽說是賭坊的常客',仁慈:'待人寬厚，時有善舉',固執:'認死理，九頭牛也拉不回',懦弱:'遇事優柔，容易被人左右',猜忌:'疑心極重，誰也不信',護短:'極護自家人，吃不得半點虧',寡言:'沉默寡言，心思難測',享樂:'講究吃穿，愛享受',好色:'風流成性，花街常客'};
/** 風評用語：軟肋→傳聞（真實的傳聞可被證實）。 */
const WEAK_G={'賭性深重難以自拔':'據說一見骰子就走不動路','篤信神佛與方術':'極信神佛方術，凡事要看卜','沉迷吉原風月名妓':'對吉原某位名妓念念不忘','溺愛幼子幼女':'一提到孩子，什麼都好說','天生畏懼水路遠航':'一聽到出海就臉色發白','憐憫落魄流民乞丐':'見不得人受苦，常出手周濟','懼內且聽信枕邊風':'在家裡說了不算，全聽夫人的','心胸狹隘睚眥必報':'睚眥必報，一句話記十年','喜好收受罕見字畫':'愛收字畫，見到名跡便挪不開眼','好美酒佳釀':'無酒不歡，尤愛灘之美酒','貪圖聲名愛好虛榮':'愛面子，最吃誇獎和名聲','癡迷古代珍奇異寶':'迷戀古物奇珍，一擲千金'};
/** 風評用語：數值→傳聞。 */
const STAT_G={commerce_skill:'生意手腕出眾，帳目精明',integrity_loyalty:'重義守信，口碑極佳',greed_index:'對錢財格外上心',audacity_courage:'膽大敢闖，敢冒風險',diplomacy_charm:'長袖善舞，人緣極好',betrayal_risk:'向來不甘人下，難以收服'};
/** 外人風評：真假參半，附可信度星數。 */
function rumorsOf(cid){
  const c=CH(cid),rd=seeded(cid+'rumor'),out=[];
  const traits=Object.keys(TRAIT_G),weaks=Object.keys(WEAK_G),stats=STATS.map(s=>s[0]);
  const mk=(real,fakePool,src,cred)=>{
    const truth=rd()<cred;
    const txt=truth?real:fakePool[Math.floor(rd()*fakePool.length)];
    out.push({txt,src,cred,truth});
  };
  mk(TRAIT_G[c.primary_trait],traits.filter(t=>t!==c.primary_trait).map(t=>TRAIT_G[t]),'同業議論',0.7);
  mk(WEAK_G[c.weakness],weaks.filter(w=>w!==c.weakness).map(w=>WEAK_G[w]),'茶屋閒話',0.5);
  const sorted=STATS.map(([k],i)=>({k,i,v:c.derived_stats[k]})).sort((a,b)=>b.v-a.v||a.i-b.i);
  mk(STAT_G[sorted[0].k],stats.filter(s=>s!==sorted[0].k).map(s=>STAT_G[s]),'市井傳聞',0.55);
  const n=npc(cid);
  if(n&&n.role==='official')mk('收禮最看重的是「心意」而不是數目',['清廉得很，從不收任何禮物','只認黃金，其他一概不理'],'官府風聞',0.6);
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
      logRel(out.cid,'奉官府調令離開本城，調往'+CITY(foreignId).name+'。');
      logRel(incoming.cid,'自'+CITY(foreignId).name+'調來本城，接掌'+posTitle(incoming)+'。');
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
      logRel(out.cid,'離開本城宅邸，遷往'+CITY(foreignId).name+'。');
      logRel(incoming.cid,'自'+CITY(foreignId).name+'遷入本城宅邸。');
      const t=NEWS('peopleMove.residence',{kind:ROLE_LABEL[out.role]||'名士',out:nameOf(out.cid),dest:CITY(foreignId).name,in:nameOf(incoming.cid),from:CITY(foreignId).name});
      pushNews(t);log.push(t);
    }
  }
}
/** 每旬人際結算：承諾逾期扣好感、逾期失信會扣好感。 */
function peopleTick(log){
  peopleMoveTick(log);
  Object.entries(G.rel).forEach(([cid,r])=>{
    r.promises.forEach(p=>{
      if(!p.done&&G.turn>p.due&&!p.late){p.late=true;r.aff=Math.max(0,r.aff-10);logRel(cid,'逾期未兌現：'+p.text+'，交情 -10。');const t=NEWS('peopleTick.1',{cid:nameOf(cid)});pushNews(t);log.push(t)}
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
    payPublic('進獻現款：'+nameOf(cid),amtS);G.life.gold+=p.amount;G.heat=(G.heat||0)+1;p.done=true;r.aff=clamp(r.aff+3,0,100);logRel(cid,'依約進獻現款 '+amtS+' 兩，官員稍感滿意。');
    return {ok:true,msg:MSG('payPromise.3',{amtS:fmt(amtS)})};
  }
  p.done=true;return {ok:true,msg:MSG('payPromise.4')};
}

/* ---------- 僱員 ---------- */
/** 丁稚→手代→番頭→大番頭的晉升階梯。 */
const RANKS=['丁稚','手代','番頭','大番頭'];
/** 各職位基準月例。 */
const RANK_WAGE={丁稚:2,手代:6,番頭:12,大番頭:24};
/** 各職位對出貨收益的加成權重。 */
const RANK_W={丁稚:0,手代:0,番頭:0,大番頭:0};   // 職位不再直接加成賣價：手代只靠 tellerBonus，番頭加大進貨上限
/** 各職位私吞傾向。 */
const RANK_SKIM={丁稚:0.2,手代:0.6,番頭:0.9,大番頭:1.2};
/** 各職位名額。 */
const RANK_SLOTS={丁稚:1,手代:1,番頭:1,大番頭:1};   // 基本名額；實際上限由許可決定（slotCap）
/* 專職：船長（海運）、飛腳（陸路）——不在晉升階梯內，由商路調度 */
/** 專職（船長、飛腳）：不在晉升階梯，供商路派用。 */
const SPECIAL=['船長','飛腳','保鏢'];
Object.assign(RANK_WAGE,{船長:10,飛腳:6,保鏢:8});Object.assign(RANK_W,{船長:0,飛腳:0,保鏢:0});Object.assign(RANK_SKIM,{船長:0.5,飛腳:0.4,保鏢:0.2});Object.assign(RANK_SLOTS,{船長:3,飛腳:3,保鏢:3});
/** 專職說明。 */
const SPECIAL_DESC={船長:'指揮菱垣廻船。海運每艘在途船都需一名船長；膽識越高，海難越少。',飛腳:'奔走陸路的腳夫頭。陸路每支在途馬幫都需一名飛腳；膽識越高，山賊越難得手。',保鏢:'平時巡守倉庫與商路（降低失火、盜賊、山賊風險，取代舊的用心棒）；你「出門前往」遇襲時：膽識高可無傷退敵，本事不足則替你擋下一刀（殉職），沒有保鏢你就會受傷臥床。'};
/** 人物若為員工，回傳其職位。 */
const empRole=cid=>{const e=G.emps.find(x=>x.cid===cid);return e?e.rank:null};
/** 船長/飛腳總人數。 */
const crewCount=mode=>G.emps.filter(e=>e.rank===(mode==='sea'?'船長':'飛腳')).length;
/** 目前在途貨運佔用的船長/飛腳數。 */
const crewBusy=mode=>G.ships.filter(s=>s.mode===mode).length;
/** 少年員工名字候選。 */
const KID_NAMES=['吉松','太吉','與助','小次郎','勘太','源吉','久藏','茂平','福助','千松'];
/** 為無名冊的少年員工生成隱藏數值。 */
function randStats(r){r=r||rnd;const g=()=>Math.round(25+r()*55);return {commerce_skill:g(),integrity_loyalty:g(),greed_index:g(),audacity_courage:g(),diplomacy_charm:g(),betrayal_risk:Math.round(10+r()*50)}}
/** 員工的隱藏數值（有名冊者取名冊）。 */
function statsOfEmp(e){return e.cid?CH(e.cid).derived_stats:e.stats}
/** 聘用員工（建立員工紀錄，名冊人物會被標記為已聘並結識）。 */
function hireEmp(cid,rank,free){
  const e={id:'e'+G.turn+'_'+Math.floor(rnd()*1e6),cid:cid||null,rank,since:G.turn,skim:0,audited:G.turn,wage:RANK_WAGE[rank],aff:40};
  if(cid){e.name=nameOf(cid);addKnown(cid);const n=npc(cid);if(n)n.hired=true;const r=R(cid);r.met=true;if(!r.bond)r.bond={mult:1,label:'雇傭',introId:null};r.aff=Math.max(r.aff,30)}
  else{const rd=seeded('ap'+G.turn+rnd());e.name=pick(KID_NAMES);e.stats=randStats(rd);e.age0=G.year-12}
  if(cid){const c=CH(cid).derived_stats.commerce_skill;e.wage=Math.round(RANK_WAGE[rank]*(0.8+c/150))}
  addFame(0.3);G.emps.push(e);return e;
}
/** 員工對出貨收益的總加成（0.9～1.3）。 */
function empMult(){return clamp(1+tellerBonus(),1,1.04)}
/** 每旬員工結算：私吞、番頭捲款潛逃判定。 */
function empTick(log){
  const rm=[];
  G.emps.forEach(e=>{
    const s=statsOfEmp(e);
    const K_=ODDS.skim,p=clamp((s.greed_index*K_.greed+s.betrayal_risk*K_.betray-s.integrity_loyalty*K_.loyal)/100,0,K_.cap)*RANK_SKIM[e.rank]*(G.turn-e.audited>K_.lateTurns?K_.lateMul:1)*guardF(e);
    if(chance(p)){
      const amt=Math.round(Math.max(0,G.lastRev)*(0.005+rnd()*0.015)+(({丁稚:1,手代:4,番頭:10,大番頭:25,船長:6,飛腳:3,保鏢:3})[e.rank]||3));
      e.skim+=amt;G.silver-=amt;
    }
    if((e.rank==='大番頭'||e.rank==='番頭')&&((e.fleeAt!==undefined&&G.turn>=e.fleeAt)||s.betrayal_risk>=75&&s.integrity_loyalty<=40&&chance(ODDS.flee.p*(G.turn-e.audited>ODDS.skim.lateTurns?ODDS.flee.lateMul:1)))){
      const take=Math.round(Math.max(0,G.silver)*0.3);G.silver-=take;rm.push(e);
      const t=NEWS('empTick.1',{rank:e.rank,name:e.name,take:fmt(take)});pushNews(t);log.push(t);sfx.bad();
    }
  });
  if(rm.length){G.emps=G.emps.filter(e=>!rm.includes(e));rm.forEach(e=>{if(e.cid&&npc(e.cid))npc(e.cid).hired=false;if(e.cid)R(e.cid).aff=0})}
}
/** 查帳：大番頭越精明越容易查出私吞。 */
function auditEmp(id){
  if(!afford('audit'))return {ok:false,msg:shortMsg('audit')};
  const e=G.emps.find(x=>x.id===id);if(!e)return {ok:false};
  spend('audit');
  const boss=G.emps.find(x=>x.rank==='大番頭'&&x.id!==id);
  const auditC=boss?statsOfEmp(boss).commerce_skill:45;
  const detect=clamp(ODDS.auditDetect.base+auditC/ODDS.auditDetect.commerceDiv,ODDS.auditDetect.base,ODDS.auditDetect.max);
  e.audited=G.turn;
  if(e.skim>0&&chance(detect)){e.flag=Math.max(5,Math.round(e.skim*(0.85+rnd()*0.3)));return {ok:true,found:true,amount:e.flag,msg:MSG('auditEmp.1',{e:fmt(e.flag)})}}
  if(e.skim>0){return {ok:true,found:false,msg:MSG('auditEmp.2')}}
  return {ok:true,found:false,msg:MSG('auditEmp.3')};
}
/** 追討：追回八成私吞款。 */
function punishEmp(id){const e=G.emps.find(x=>x.id===id);if(!e)return;const back=Math.round(e.skim*0.8);G.silver+=back;e.skim=0;e.flag=0;e.audited=G.turn;return '追回 '+fmt(back)+' 兩並嚴加警告。'}
/** 辭退員工。 */
function fireEmp(id){
  const e=G.emps.find(x=>x.id===id);if(!e)return '';
  G.emps=G.emps.filter(x=>x!==e);if(e.cid&&npc(e.cid))npc(e.cid).hired=false;
  if(!e.cid)return '';
  syncPeaks();const r=R(e.cid);r.aff=Math.max(0,r.aff-FIRE_AFF);logRel(e.cid,'被你辭退，好感 -'+FIRE_AFF+'。');
  return isEnemy(e.cid)?'「'+nameOf(e.cid)+'」記恨在心，成了你的仇人。':'「'+nameOf(e.cid)+'」好感 -'+FIRE_AFF+'。';
}
/** 某職位是否還有名額。 */
/** 某職位是否還有名額（名額由許可決定，見 07t_permits.js 的 slotCap）。 */
function slotFree(rank){return G.emps.filter(e=>e.rank===rank).length<slotCap(rank)}
/** 名冊的 suitable_roles → 可聘職位；丁稚只由 hireApprentice 另行招收。 */
const EMP_SUITABLE=[
  ['大番頭候選',['手代','番頭','大番頭']],
  ['商業競爭對手',['手代','番頭']],
  ['地方商號座客散戶',['手代']],
  ['情報販子與掮客',['手代','飛腳']],
  ['遠洋海運走私首領',['船長']],
  ['用心棒保鑣總頭目',['保鏢']]
];
const RECRUIT_RANKS=['手代','番頭','大番頭','船長','飛腳','保鏢'];
/** 人物依 suitable_roles 可擔任的所有職位（固定依介面順序回傳）。 */
function suitableEmpRanks(cid){
  const c=CH(cid);if(!c)return [];
  const out=new Set(),roles=c.suitable_roles||[];
  EMP_SUITABLE.forEach(([needle,ranks])=>{if(roles.some(r=>r.includes(needle)))ranks.forEach(r=>out.add(r))});
  return RECRUIT_RANKS.filter(r=>out.has(r));
}
/** 套用介紹人可引薦的店內最高職階；專職不受店內職階上下限影響。 */
function candidateHireRanks(cid,maxRank){
  const maxI=Math.max(1,RANKS.indexOf(maxRank));
  return suitableEmpRanks(cid).filter(r=>SPECIAL.includes(r)||(RANKS.indexOf(r)>=1&&RANKS.indexOf(r)<=maxI));
}
/** 依引薦分數決定可聘到的最高職階；具名成人最低從手代起聘。 */
function maxRankFor(score){return score>=2.5?'大番頭':score>=1.5?'番頭':'手代'}
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
  const why=tf<0.8?'與你交情尚淺':avg<0.9?'志趣又對不上':'';
  if(rank==='手代')return '「'+name+'」'+(why?why+'，':'')+'不算熱心，但還是替你打聽了一圈，找到可聘至「'+rank+'」以下的人才。';
  if(rank==='番頭')return '「'+name+'」頗為上心，四處替你走動，找到可聘至「'+rank+'」以下的人才。';
  return '「'+name+'」與你交情深厚、志趣相投，傾力替你引薦，找到可聘至「'+rank+'」以下的人才。';
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
  logRel(introCid,'為你物色了幾位人才。');
  return {ok:true,msg:MSG('recruitVia.found',{flavor:recruitFlavor(nameOf(introCid),rank,tf,avgScore),n:cands.length}),rank};
}
/** 聘用物色到的人選（含船長/飛腳專職；付 4 倍月例為聘金）。 */
function hireCandidate(cid,rank){
  if(rank==='丁稚')return {ok:false,msg:MSG('hireCandidate.5')};
  if(!G.recruit||!G.recruit.cands.includes(cid))return {ok:false,msg:MSG('hireCandidate.4')};
  if(!candidateHireRanks(cid,G.recruit.rank).includes(rank))return {ok:false,msg:MSG('hireCandidate.3',{rank})};
  if(!slotFree(rank))return {ok:false,msg:MSG('slotFull',{rank})};
  const ri=RANKS.indexOf(rank),max=RANKS.indexOf(G.recruit?G.recruit.rank:'丁稚');
  if(!SPECIAL.includes(rank)&&ri>max)return {ok:false,msg:MSG('hireCandidate.1',{rank:G.recruit.rank})};
  const wage=Math.round(RANK_WAGE[rank]*(0.8+CH(cid).derived_stats.commerce_skill/150)),fee=costOf('hireMonths',wage),ship=rank==='船長'?shipCost():0;
  if(G.silver<fee+ship)return {ok:false,msg:ship?MSG('hireCandidate.shipShort',{c:fmt(fee+ship),ship:fmt(ship)}):shortMsg('hireMonths',wage)};
  spendAmt('hireMonths',fee);if(ship)spendAmt('shipBuild',ship);hireEmp(cid,rank);
  if(G.recruit)G.recruit.cands=G.recruit.cands.filter(x=>x!==cid);
  return {ok:true,msg:MSG('hireCandidate.2',{cid:nameOf(cid),rank,wage})+(ship?MSG('hireCandidate.ship',{ship:fmt(ship)}):'')};
}
/** 聘船長時另付的造船費：600 × 聘後的船長數。 */
const shipCost=()=>costOf('shipBuild',G.emps.filter(e=>e.rank==='船長').length+1);
/** 招丁稚（需介紹人）。 */
function hireApprentice(){
  if(!G.introId||!introOf(G.introId))return {ok:false,msg:MSG('hireApprentice.1')};
  if(!slotFree('丁稚'))return {ok:false,msg:MSG('hireApprentice.2')};
  if(!afford('apprentice'))return {ok:false,msg:shortMsg('apprentice')};
  spend('apprentice');const e=hireEmp(null,'丁稚');return {ok:true,msg:MSG('hireApprentice.3',{name:e.name})};
}
/** 升遷（需任職滿 24 旬；專職不可升遷）。 */
function promoteEmp(id){
  const e=G.emps.find(x=>x.id===id);if(!e)return {ok:false};
  if(SPECIAL.includes(e.rank))return {ok:false,msg:MSG('promote.special',{rank:e.rank})};
  const i=RANKS.indexOf(e.rank);if(i>=3)return {ok:false,msg:MSG('promoteEmp.1')};
  const nr=RANKS[i+1];
  if(G.turn-e.since<24)return {ok:false,msg:MSG('promoteEmp.2')};
  if(!slotFree(nr))return {ok:false,msg:MSG('slotFull',{rank:nr})};
  e.rank=nr;e.wage=Math.round(RANK_WAGE[nr]*(e.cid?(0.8+CH(e.cid).derived_stats.commerce_skill/150):1));e.since=G.turn;
  return {ok:true,msg:MSG('promoteEmp.3',{name:e.name,nr})};
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
  if(!chance(p)){if(targetCid)R(targetCid).aff=Math.max(0,R(targetCid).aff-5);logRel(introCid,'為你說親未成。');return {ok:true,fail:true,msg:MSG('marry.4',{p:Math.round(p*100)})}}
  const fam={rival:'同行',official:'官家',commoner:'町人'}[kind];
  const fn=['阿梅','阿園','小百合','阿花','阿鶴','阿雪','千代','阿初'];
  const spouse={name:pick(fn)+'（'+fam+'之女）',kind,birthYear:G.year-rint(17,24)};
  addFame(3);G.family.spouse=spouse;G.family.married=true;G.life.spouseKind=kind;
  let extra='';
  if(kind==='rival'&&targetCid){R(targetCid).aff=clamp(R(targetCid).aff+25,0,100);G.cartel.comp=Math.min(90,G.cartel.comp+5);extra='同行聯姻化敵為友，株仲間信任上升。'}
  if(kind==='official'&&targetCid){R(targetCid).aff=clamp(R(targetCid).aff+20,0,100);extra='政商聯姻，對方視你為自家人。'}
  if(kind==='commoner'){extra='家庭和睦，雖無政治助力，倒也安穩。'}
  pushNews(NEWS('marry.1',{name:G.me.name,name2:spouse.name}));
  return {ok:true,msg:MSG('marry.5',{extra})};
}
/** 生成子女。 */
function newKid(){
  const g=chance(ODDS.birth.male)?'男':'女';
  const st=randStats();
  return {id:'k'+G.turn+'_'+Math.floor(rnd()*1e6),name:pick(g==='男'?CHILD_M:CHILD_F),gender:g,birthYear:G.year,stats:st,path:null,revealed:false,prodigal:false};
}
/** 子女年齡。 */
const kidAge=k=>G.year-k.birthYear;
/** 子女年齡層文字（畫面不顯示歲數）：未滿 8 年幼、8～15 少年（可安排歷練）、16 起成年（可繼承）。 */
const kidStage=a=>a<8?'年幼':a<16?'少年':'成年';
/** 子女歷練路線。 */
const PATHS={shop:{name:'跟老掌櫃學商',cost:costOf('pathShop'),stat:{commerce_skill:1.8,integrity_loyalty:0.6}},sea:{name:'上海運船歷練',cost:costOf('pathSea'),stat:{audacity_courage:1.8,commerce_skill:0.6}},court:{name:'入官邸當侍童',cost:costOf('pathCourt'),stat:{diplomacy_charm:1.8,greed_index:0.3}}};
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
  G.family.kids=G.family.kids.filter(x=>x!==k);const lf=loseFame('disown');return {ok:true,msg:MSG('kidFixProdigal.2',{name:k.name})+(lf?'家醜外揚，知名度 -'+lf+'。':'')};
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
    const e=G.emps.find(x=>x.cid===n.cid);if(e){G.emps=G.emps.filter(x=>x!==e);pushNews(NEWS('yearTick.3',{rank:e.rank,name:e.name}))}
    if(n.role==='official'&&n.pos){const rep=replaceOfficial(n);if(rep)addKnown(rep);n.pos=null}   // 病重離職：職位交給遞補者，避免同一職位一年內兩人並列
  });
  // 子女
  G.family.kids.forEach(k=>{
    const a=kidAge(k);
    if(k.path&&a>=8){const P=PATHS[k.path];G.silver-=P.cost;Object.entries(P.stat).forEach(([s,v])=>{k.stats[s]=Math.min(95,k.stats[s]+v)})}
    if(a===12&&!k.revealed){k.revealed=true;const tt=NEWS('yearTick.4',{name:k.name,top3Of:top3Of(k.stats)[0]});pushNews(tt);log.push(tt)}
    if(a>=16&&!k.prodigal&&k.stats.greed_index>65&&k.stats.integrity_loyalty<48&&roll('prodigal')){k.prodigal=true;const tt=NEWS('yearTick.5',{name:k.name});pushNews(tt);log.push(tt)}
  });
  if(G.family.spouse&&G.family.kids.length<4&&G.year-G.family.spouse.birthYear<=42&&roll('birth')){
    const k=newKid();G.family.kids.push(k);const tt=NEWS('yearTick.6',{gender:(k.gender==='男'?'男':'女'),name:k.name});pushNews(tt);log.push(tt);
  }
  // 壽數：四十五歲後逐年遞增，另有小機率橫禍
  const age=myAge();
  const p=Math.max(0,age-ODDS.death.startAge)*ODDS.death.perYear+ODDS.death.base;
  if(chance(p))endLife('death');
}

/* ---------- 蓋棺評語與傳承 ---------- */
/** 淨資產估算（現款＋庫存市值等）。 */
function netWorth(){let v=G.silver;Object.entries(G.inv).forEach(([n,q])=>v+=q*COMM_MAP[n].base);return Math.round(v)}
/** 生平總結評語（高/中/低好感）。 */
const QUOTE_HI=Ls('eulogy.hi'),QUOTE_MID=Ls('eulogy.mid'),QUOTE_LO=Ls('eulogy.lo');          // 台詞在 01d_lines.js
/** 產生主角一生的總結。 */
function obituary(ageAt){
  const L=G.life,nw=netWorth();
  const wealth=nw>=60000?'富甲一方':nw>=25000?'殷實富商':nw>=8000?'小有家業':nw>=0?'勉強糊口':'負債累累';
  const good=L.charity*2+L.pledges*0.3,bad=L.cheats*2+L.scapegoat*0.5;
  const moral=good>bad+3?'義商':bad>good+3?'奸商':'亦正亦邪';
  const pol=L.gold>=60?'官商勾結':L.gold<=8?'清流商人':'八面玲瓏';
  const age=ageAt||myAge();
  const sum='「'+wealth+'，'+moral+'，世人謂其'+pol+'。享壽 '+age+' 歲。」';
  const people=Object.entries(G.rel).filter(([id,r])=>r.aff>=25&&CH(id)&&(alive(id)||CH(id).death_year>=G.year-1)).sort((a,b)=>b[1].aff-a[1].aff).slice(0,5);
  const rd=seeded('ob'+G.turn+G.me.given);
  const quotes=people.map(([id,r])=>{
    const pool=r.aff>=70?QUOTE_HI:r.aff>=45?QUOTE_MID:QUOTE_LO;
    return {name:nameOf(id),aff:r.aff,txt:pool[Math.floor(rd()*pool.length)].replace('{n}',G.me.given)};
  });
  const facts=['在世 '+age+' 載，歷經 '+(G.year-0)+' 個寒暑','經手貨殖，淨資產約 '+fmt(nw)+' 兩','打點官場，動用私房錢 '+L.gold+' 兩','施粥賑濟 '+L.charity+' 次，違約偷跑 '+L.cheats+' 次','經歷火災 '+L.fires+' 次、打毀 '+L.riots+' 次','膝下 '+G.family.kids.length+' 名子女'];
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
