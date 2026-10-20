'use strict';
/* ★檔案總覽：人物互動、員工、家族
 * - 引薦與拜訪：introPower（性向相容×信任）、visitRoll（拒見/不在家/成功）、meetVia/meetCold、resolveVisit。
 * - 送禮與請託：GIFTS、FAVORS、doFavor（好感≥80辦理、50～79擱置、<50拒絕）。
 * - 風評：rumorsOf。 員工：hireEmp/empTick（私吞、潛逃）、船長/飛腳專職。
 * - 家族與傳承：marry、newKid、yearTick（年度結算）、endLife/succeed（二代）。 */
/* ======================= 04 人物：介紹人、性向、贈禮、風評、僱員、家族、傳承 ======================= */
/** 取某人在介紹人名單中的資料。 */
const introOf=cid=>G.intros.find(i=>i.cid===cid);
/** 請介紹人辦事的代價：直接扣他對你的交情 2～5（隨機），回傳扣掉的點數。已取消舊的『人情額度』。 */
function introCost(it){const d=2+Math.floor(rnd()*4);const r=R(it.cid);r.aff=Math.max(0,r.aff-d);logRel(it.cid,'請他出面辦事，交情 -'+d+'。');return d}
/** 介紹人對目標的『引薦力』＝性向相容倍率×信任係數；性向未知時依估計。 */
function introPower(introCid,targetCid){
  const cp=compat(introCid,targetCid);const aff=R(introCid).aff;const tf=trustFactor(aff);
  return {cp,tf,score:cp.m*tf,aff};
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
/** 結識前檢查（人情額度、白銀、是否已結識…），回傳錯誤字串或 null。 */
function meetCheck(cid,viaIntro){
  const n=npc(cid),r=R(cid);
  if(!n)return '此人已不在此地';
  if(isEnemy(cid))return '對方視你為仇人，拒不見面。';
  if(r.lastIntro!=null&&G.turn-r.lastIntro<3&&r.lastOk)return '才剛請託過，三旬內不宜再度叨擾';
  if(n.pos&&n.pos.rank>=4&&G.rep<60)return '高階官員不見聲譽不足之商人（需聲譽 60 以上）';
  /* 知名度階級：有介紹人時視同 +1 階；私款每千兩 +1 階已含在 fameTier */
  const need=meetTierNeed(cid),have=fameTier()+(viaIntro?1:0);
  if(have<need)return '知名度不足：要見'+(n.role==='oiran'?'這位名伶':'這位官員')+'需知名度 '+TIER_NAME[need]+'（你目前 '+TIER_NAME[fameTier()]+(viaIntro?'，有介紹人 +1':'，請介紹人引薦可 +1')+'）';
  if(viaIntro){
    const it=introOf(G.introId);if(!it)return '請先選擇一位介紹人';
    if(fameTier()<introTier(G.introId))return '知名度不足以委託這位介紹人（他是'+TIER_NAME[introTier(G.introId)]+'介紹人，你目前 '+TIER_NAME[fameTier()]+'）';
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

/* ---------- 贈禮：投其所好（軟肋）才有三倍效果 ---------- */
/** 禮物表：weak 對應名冊『軟肋』文字，命中×3；silver/gold 為價格（已折半）。新增禮物在此加一筆。 */
const GIFTS=[
  {k:'gold',name:'賄賂金封',icon:'🟨',weak:null,gold:true,desc:'以公款（白銀）包的紅包，通用，但貪欲高者才吃這一套；留下黑帳痕跡。'},
  {k:'art',name:'名家字畫',icon:'🖼️',weak:'喜好收受罕見字畫',silver:costOf('gift_art')},
  {k:'antique',name:'古董珍奇',icon:'🏺',weak:'癡迷古代珍奇異寶',silver:costOf('gift_antique')},
  {k:'wine',name:'灘之美酒',icon:'🍶',weak:'好美酒佳釀',silver:costOf('gift_wine')},
  {k:'geisha',name:'花街設宴',icon:'🌸',weak:'沉迷吉原風月名妓',silver:costOf('gift_geisha')},
  {k:'charm',name:'祈福神符',icon:'⛩️',weak:'篤信神佛與方術',silver:costOf('gift_charm')},
  {k:'toy',name:'童玩點心',icon:'🎎',weak:'溺愛幼子幼女',silver:costOf('gift_toy')},
  {k:'safe',name:'陸路護送',icon:'🐎',weak:'天生畏懼水路遠航',silver:costOf('gift_safe')},
  {k:'alms',name:'以其名義義賑',icon:'🍚',weak:'憐憫落魄流民乞丐',silver:costOf('gift_alms')},
  {k:'wife',name:'禮敬夫人',icon:'🎀',weak:'懼內且聽信枕邊風',silver:costOf('gift_wife')},
  {k:'grudge',name:'替其打壓宿敵',icon:'🗡️',weak:'心胸狹隘睚眥必報',silver:costOf('gift_grudge')},
  {k:'fame',name:'捐匾揚名',icon:'🏷️',weak:'貪圖聲名愛好虛榮',silver:costOf('gift_fame')},
  {k:'gamble',name:'設局賭宴',icon:'🎲',weak:'賭性深重難以自拔',silver:costOf('gift_gamble')}
];
const GIFT_MAP={};GIFTS.forEach(g=>GIFT_MAP[g.k]=g);
/** 官階越高禮物越貴的倍率。 */
const RANK_COST_MULT=[0,1,1,1.3,2,3,5];
/** 某禮物對某人的實際價格。 */
function giftCost(g,cid){
  const t=targetTier(cid),mult=RANK_COST_MULT[t]||1;
  /* 賄賂一律用公款白銀：原『金』單位 × BRIBE_RATE 換算 */
  if(g.gold){const gc=npc(cid)&&npc(cid).pos?giftGoldCost(t):1;return {silver:(gc>1?Math.max(1,Math.round(gc/2)):gc)*BRIBE_RATE}}
  return {silver:Math.round(g.silver*mult)};
}
/** 賄賂換算：舊制『1 兩金』＝ 15 兩白銀（賄賂、拜訪都花公款白銀）。 */
const BRIBE_RATE=15;
/** 送禮：扣費、依是否命中軟肋與羈絆倍率計算好感，黃金點心會累積黑帳 heat。 */
function giveGift(cid,key){
  const r=R(cid),c=CH(cid),g=GIFT_MAP[key],n=npc(cid);
  if(!r.bond)return {ok:false,msg:MSG('giveGift.1')};
  const cost=giftCost(g,cid);
  if(cost.silver&&G.silver<cost.silver)return {ok:false,msg:MSG('giveGift.2',{cost:fmt(cost.silver)})};
  if(cost.silver)G.silver-=cost.silver;
  let mult,reaction;
  const matched=g.weak&&c.weakness===g.weak;
  if(g.gold){
    mult=clamp(0.5+c.derived_stats.greed_index/70,0.5,2);
    reaction=MSG(mult>=1.4?'giveGift.reactGreedy':mult<0.8?'giveGift.reactCold':'giveGift.reactPlain');
    G.life.gold+=Math.round(cost.silver/BRIBE_RATE);if(n&&n.role==='official')G.heat=(G.heat||0)+1;
  }else if(matched){mult=3;reaction=MSG('giveGift.3');r.verified=true}
  else{mult=0.5;reaction=MSG('giveGift.reactBlah')}
  if(g.k==='alms'){G.rep=clamp(G.rep+1,0,100);G.life.charity++}
  const gain=Math.max(1,Math.round(8*mult*Math.max(0.5,r.bond.mult)));
  r.aff=clamp(r.aff+gain,0,100);r.gifts++;G.life.gifts++;
  logRel(cid,'贈「'+g.name+'」，'+reaction.replace(/！|。/g,'')+'，好感 +'+gain+'。');
  sfx.gift();addFame(0.15);
  return {ok:true,gain,matched,mult,msg:MSG('giveGift.result',{reaction,gain,mult:fmt1(r.bond.mult)}),cost};
}

/* ---------- 官員請託 ---------- */
/** 官員請託項目（依院別）：rank 所需官階、cost 成本、once 一次性、cd 冷卻。含運入許可 port/pass。新增請託在此加一筆並在 doFavor 實作效果。 */
const FAVORS={
  administration:[
    {k:'contract',name:'承攬官辦工程',thr:40,rank:2,cost:{silver:costOf('favorContract')},cd:6,desc:'投標承攬城郭修繕與橋樑疏浚，賺取工程利潤。'}
  ],
  finance:[
    {k:'direct',apply:true,name:'產地直採特許',thr:60,rank:3,cost:{gold:'r3'},once:true,desc:'繞過大盤商，進貨價由 110% 降為 85%。'},
    {k:'loan',name:'官倉平準貸款',thr:35,rank:2,cost:{},cd:12,desc:'官府低息借款，十二旬後須連本帶利歸還 130%。'}
  ],
  judiciary:[
    {k:'exempt',name:'買通免檢旗',thr:45,rank:2,cost:{gold:'r1'},cd:12,desc:'十二旬內關稅全免，黑市偷跑被查抄時也能壓下。'},
    {k:'blind',name:'袖之下：搜查時睜一隻眼',thr:50,rank:2,cost:{gold:'r1'},cd:12,desc:'十二旬內，同心搜查時多半睜一隻眼，搜查風聲大減。'},
    {k:'warn',name:'緝私通告',thr:30,rank:2,cost:{silver:costOf('favorWarn')},cd:6,desc:'事先得知下次中央突查，免受處罰。'},
    {k:'raid',name:'借官府查抄對手',thr:65,rank:4,cost:{gold:6},cd:12,desc:'同業遭查抄，本業行情短期走強。'}
  ]
};
/** 請託的黃金成本（r3/r1 依官階計算）。 */
function favorGoldCost(f,n){const g=f.cost.gold;return g==='r3'?costOf('favorRank3',n.pos.rank-1):g==='r1'?costOf('favorRank1',n.pos.rank-1):costOf('favor_'+f.k)}
/** 某官員可受理的請託清單。 */
function favorList(cid){const n=npc(cid);return n&&n.pos?(FAVORS[n.pos.court]||[]).filter(f=>!f.pos||f.pos.includes(n.pos.posId)):[]}
/* 請託：好感 ≥80 才會辦理；50～79 擱置；<50 直接拒絕 */
/** 請託門檻：好感 ≥80 才辦理，50～79 擱置，<50 拒絕。 */
const FAVOR_OK=80,FAVOR_HOLD=50;
/** 執行請託：先看官階、好感門檻、冷卻、成本，再套用各項效果（工程、許可、直採、貸款、免檢旗…）。 */
function doFavor(cid,key){
  const n=npc(cid),r=R(cid),f=FAVORS[n.pos.court].find(x=>x.k===key);
  if(!f)return {ok:false,msg:MSG('doFavor.1')};
  if(n.pos.rank<f.rank)return {ok:true,status:'refused',msg:TX('favor.outOfRank')};
  if(f.apply)return applyFavor(cid,n,r,f);                      // 許可、權利類：走申請審理流程（見 07k）
  if(r.aff<FAVOR_HOLD){r.aff=Math.max(0,r.aff-3);logRel(cid,'請託「'+f.name+'」被一口回絕（好感不足），好感 -3。');return {ok:true,status:'refused',msg:MSG('doFavor.refuse',{say:TX('favor.refuse'),aff:Math.round(r.aff)})}}
  if(r.aff<FAVOR_OK){logRel(cid,'請託「'+f.name+'」被擱置：'+TX('favor.holdLog'));return {ok:true,status:'held',msg:MSG('doFavor.hold',{say:TX('favor.hold'),aff:Math.round(r.aff)})}}
  r.cd=r.cd||{};if(r.cd[key]&&G.turn<r.cd[key])return {ok:true,status:'held',msg:MSG('doFavor.2',{key:(r.cd[key]-G.turn)})};
  if(f.once&&(key==='direct'?G.flags.direct:regionHeld(key,n)))return {ok:true,status:'held',msg:MSG('doFavor.3')};
  const gold=f.cost.gold?favorGoldCost(f,n):0,silver=f.cost.silver||0;
  /* favorGoldCost 現在回傳『白銀』金額（賄賂走公款） */
  const bribe=gold,total=gold+silver;
  if(G.silver<total)return {ok:true,status:'held',msg:MSG('doFavor.4',{total:fmt(total)})};
  G.silver-=total;if(bribe){G.life.gold+=Math.round(bribe/BRIBE_RATE);G.heat=(G.heat||0)+1}
  r.aff=Math.max(0,r.aff-4);if(f.cd)r.cd[key]=G.turn+f.cd;
  let msg='';
  if(key==='contract'){const inc=Math.round(n.pos.rank*220*(0.8+rnd()*0.6));G.silver+=inc;G.rep=clamp(G.rep+2,0,100);G.life.contracts++;msg='標得官辦工程，入帳 '+fmt(inc)+' 兩（扣除投標費淨賺 '+fmt(inc-silver)+'），聲譽 +2。'}
  else if(REG_FAVOR[key]){msg=REG_FAVOR[key](n)}
  else if(key==='direct'){G.flags.direct=true;msg='取得產地直採特許！進貨價降為 85%，大盤商對你恨得牙癢癢。'}
  else if(key==='loan'){const amt=1200*(n.pos.rank-1);G.silver+=amt;G.debts=G.debts||[];G.debts.push({due:G.turn+12,amt:Math.round(amt*1.3)});msg='獲准官倉平準貸款 '+fmt(amt)+' 兩，十二旬後須還 '+fmt(amt*1.3)+' 兩。'}
  else if(key==='exempt'){G.flags.exempt=12;msg='買通免檢旗，十二旬內關稅全免。'}
  else if(key==='blind'){G.flags.blind=12;msg='袖之下遞過去，同心心領神會：十二旬內搜查時會睜一隻眼。'}
  else if(key==='warn'){G.flags.warned=1;msg='獲得緝私內線通告，下次中央突查可安然躲過。'}
  else if(key==='raid'){
    const rivals=cityNpcs(G.cityId,'rival').filter(x=>!x.raided);
    if(rivals.length){const v=pick(rivals);v.raided=true;msg='官府查抄了同行「'+nameOf(v.cid)+'」的商號！';}else msg='官府借故查抄了一家同行。';
    setEv(c=>c.sys===G.sysKey,1.2);G.rep=clamp(G.rep-3,0,100);msg+=MSG('doFavor.5');
  }
  logRel(cid,'請託「'+f.name+'」：'+msg);
  return {ok:true,status:'done',msg:MSG('doFavor.6',{msg})};
}
/* 一次登門：備禮、請託（可以什麼都不說）。roll 為先前決定的拜訪結果 */
/** 【一次登門的完整結算】不在家/拒見/成功；成功則先送禮，再請託（或什麼都不說）。回傳要顯示的訊息。 */
function resolveVisit(cid,giftKey,favorKey,roll){
  const r=R(cid);
  if(roll.outcome==='absent'){logRel(cid,'備禮登門，主人恰好外出。');return {ok:false,msg:MSG('resolveVisit.1',{cid:nameOf(cid)})}}
  if(roll.outcome==='refuse'){const c=Math.min(G.silver,costOf('visitRefused'));spendAmt('visitRefused',c);r.lastOk=false;logRel(cid,'備禮登門，對方稱病不見。');return {ok:false,msg:MSG('resolveVisit.2',{c})}}
  const parts=[];r.lastOk=true;addFame(0.2);
  if(giftKey!=='none'){const g=giveGift(cid,giftKey);if(!g.ok)return g;parts.push(g.msg)}
  const n=npc(cid);
  if(favorKey!=='none'&&n&&n.pos){const f=doFavor(cid,favorKey);parts.push(f.msg)}
  else{
    if(giftKey==='none'){const gain=Math.max(1,Math.round(2*Math.max(0.5,r.bond?r.bond.mult:1)));r.aff=clamp(r.aff+gain,0,100);logRel(cid,'空手登門閒話家常，好感 +'+gain+'。');parts.push('什麼都沒說，只是閒話家常，喝了杯茶。（好感 +'+gain+'）')}
    else parts.push('臨走時什麼也沒提，主人反倒對你多了幾分好感。')
  }
  return {ok:true,msg:parts.join(' ')};
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
/** 每旬人際結算：承諾逾期扣好感、逾期失信會扣好感。 */
function peopleTick(log){
  Object.entries(G.rel).forEach(([cid,r])=>{
    r.promises.forEach(p=>{
      if(!p.done&&G.turn>p.due&&!p.late){p.late=true;r.aff=Math.max(0,r.aff-10);logRel(cid,'逾期未兌現：'+p.text+'，交情 -10。');const t=NEWS('peopleTick.1',{cid:nameOf(cid)});pushNews(t);log.push(t)}
    });
  });
  (G.debts||[]).forEach(d=>{if(!d.paid&&G.turn>=d.due){d.paid=true;G.silver-=d.amt;const t=NEWS('peopleTick.2',{d:fmt(d.amt)});pushNews(t);log.push(t)}});
  if(G.debts)G.debts=G.debts.filter(d=>!d.paid);
}
/** 兌現承諾。 */
function payPromise(cid,idx){
  const r=R(cid),p=r.promises[idx];if(!p||p.done)return {ok:false,msg:MSG('payPromise.1')};
  if(p.kind==='tribute'){
    const amtS=p.amount*BRIBE_RATE;
    if(G.silver<amtS)return {ok:false,msg:MSG('payPromise.2',{amtS:fmt(amtS)})};
    G.silver-=amtS;G.life.gold+=p.amount;G.heat=(G.heat||0)+1;p.done=true;r.aff=clamp(r.aff+3,0,100);logRel(cid,'依約進獻黃金 '+p.amount+' 兩，官員稍感滿意。');
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
const RANK_W={丁稚:0.01,手代:0.03,番頭:0.05,大番頭:0.08};
/** 各職位私吞傾向。 */
const RANK_SKIM={丁稚:0.2,手代:0.6,番頭:0.9,大番頭:1.2};
/** 各職位名額。 */
const RANK_SLOTS={丁稚:6,手代:6,番頭:2,大番頭:1};
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
function empMult(){
  let m=1;G.emps.forEach(e=>{m+=RANK_W[e.rank]*(statsOfEmp(e).commerce_skill-50)/100});
  m+=tellerBonus();
  return clamp(m,0.9,1.36);
}
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
    if((e.rank==='大番頭'||e.rank==='番頭')&&s.betrayal_risk>=75&&s.integrity_loyalty<=40&&chance(ODDS.flee.p*(G.turn-e.audited>ODDS.skim.lateTurns?ODDS.flee.lateMul:1))){
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
function fireEmp(id){const e=G.emps.find(x=>x.id===id);if(!e)return;G.emps=G.emps.filter(x=>x!==e);if(e.cid&&npc(e.cid))npc(e.cid).hired=false}
/** 某職位是否還有名額。 */
function slotFree(rank){return G.emps.filter(e=>e.rank===rank).length<RANK_SLOTS[rank]}
/** 依引薦分數決定可聘到的最高職階。 */
function maxRankFor(score){return score>=2.5?'大番頭':score>=1.5?'番頭':score>=0.8?'手代':'丁稚'}
/** 可招聘人才池（本城在世、未被聘、18～62 歲的經理/掮客/座客）。 */
function talentPool(){
  return Object.values(G.world.npcs).filter(n=>alive(n.cid)&&!n.hired&&!n.raided&&['manager','broker','guest'].includes(n.role)&&ageOf(n.cid)>=18&&ageOf(n.cid)<=62&&!G.intros.some(i=>i.cid===n.cid));
}
/** 物色結果的口語說明（不列公式）：依可聘職階與交情/志趣給一句描述。 */
function recruitFlavor(name,rank,tf,avg){
  const why=tf<0.8?'與你交情尚淺':avg<0.9?'志趣又對不上':'';
  if(rank==='丁稚')return '「'+name+'」'+(why?why+'，':'')+'對這件事沒什麼興趣，在你懇求之下勉強找到可聘至「'+rank+'」以下的人才。';
  if(rank==='手代')return '「'+name+'」'+(why?why+'，':'')+'不算熱心，但還是替你打聽了一圈，找到可聘至「'+rank+'」以下的人才。';
  if(rank==='番頭')return '「'+name+'」頗為上心，四處替你走動，找到可聘至「'+rank+'」以下的人才。';
  return '「'+name+'」與你交情深厚、志趣相投，傾力替你引薦，找到可聘至「'+rank+'」以下的人才。';
}
/** 請介紹人物色人才：付禮金、扣人情，依信任係數決定人選品質與可聘職階。 */
function recruitVia(introCid){
  const it=introOf(introCid);if(!it)return {ok:false,msg:MSG('recruitVia.1')};
  const fee=costOf('recruitIntro');if(!afford('recruitIntro'))return {ok:false,msg:shortMsg('recruitIntro')};
  const mgrs=Object.values(G.world.npcs).filter(n=>n.role==='manager'&&alive(n.cid)&&!n.hired);
  const pool=talentPool();if(!pool.length)return {ok:false,msg:MSG('recruitVia.2')};
  spendAmt('recruitIntro',fee);introCost(it);
  // 介紹人與主角的信任，加上自己與人才圈的投契，決定能請到什麼等級的人
  const avgScore=(()=>{const s=pool.slice(0,8).map(n=>introPower(introCid,n.cid).score);return s.reduce((a,b)=>a+b,0)/s.length})();
  const tf=trustFactor(R(introCid).aff);
  const score=avgScore*tf/Math.max(0.4,tf)*Math.max(tf,0.6);
  const rank=maxRankFor(Math.max(avgScore*tf*1.1,tf*0.9));
  const sample=shuffle(pool).slice(0,Math.min(pool.length,6));
  const q=cid=>CH(cid).derived_stats.integrity_loyalty-CH(cid).derived_stats.betrayal_risk;
  let cands;
  sample.sort((a,b)=>q(b.cid)-q(a.cid));
  if(tf>=1.25)cands=sample.slice(0,3);
  else if(tf>=0.8)cands=shuffle(sample).slice(0,3);
  else cands=sample.slice(-3);
  cands.forEach(n=>{addKnown(n.cid);if(n.cityId!==G.cityId)n.cityId=G.cityId});
  G.recruit={introId:introCid,rank,cands:cands.map(n=>n.cid),turn:G.turn,tf,avg:avgScore};
  logRel(introCid,'為你物色了幾位人才。');
  return {ok:true,msg:MSG('recruitVia.found',{flavor:recruitFlavor(nameOf(introCid),rank,tf,avgScore),n:cands.length}),rank};
}
/** 聘用物色到的人選（含船長/飛腳專職；付 4 倍月例為聘金）。 */
function hireCandidate(cid,rank){
  if(!slotFree(rank))return {ok:false,msg:MSG('slotFull',{rank})};
  const ri=RANKS.indexOf(rank),max=RANKS.indexOf(G.recruit?G.recruit.rank:'丁稚');
  if(!SPECIAL.includes(rank)&&ri>max)return {ok:false,msg:MSG('hireCandidate.1',{rank:G.recruit.rank})};
  const wage=Math.round(RANK_WAGE[rank]*(0.8+CH(cid).derived_stats.commerce_skill/150)),fee=costOf('hireMonths',wage);
  if(!affordAmt('hireMonths',fee))return {ok:false,msg:shortMsg('hireMonths',wage)};
  spendAmt('hireMonths',fee);hireEmp(cid,rank);
  if(G.recruit)G.recruit.cands=G.recruit.cands.filter(x=>x!==cid);
  return {ok:true,msg:MSG('hireCandidate.2',{cid:nameOf(cid),rank,wage})};
}
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
  if(kind==='official'&&targetCid){R(targetCid).aff=clamp(R(targetCid).aff+20,0,100);G.rep=clamp(G.rep+5,0,100);extra='政商聯姻，對方視你為自家人，聲譽 +5。'}
  if(kind==='commoner'){G.rep=clamp(G.rep+1,0,100);extra='家庭和睦，雖無政治助力，倒也安穩。'}
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
  G.family.kids=G.family.kids.filter(x=>x!==k);G.rep=clamp(G.rep-2,0,100);return {ok:true,msg:MSG('kidFixProdigal.2',{name:k.name})};
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
    if(n.role==='official'&&n.pos){const rep=replaceOfficial(n);if(rep)addKnown(rep)}
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
/** 淨資產估算（白銀＋庫存市值等）。 */
function netWorth(){let v=G.silver;Object.entries(G.inv).forEach(([n,q])=>v+=q*COMM_MAP[n].base);return Math.round(v)}
/** 生平總結評語（高/中/低好感）。 */
const QUOTE_HI=Ls('eulogy.hi'),QUOTE_MID=Ls('eulogy.mid'),QUOTE_LO=Ls('eulogy.lo');          // 台詞在 01d_lines.js
/** 產生主角一生的總結。 */
function obituary(){
  const L=G.life,nw=netWorth();
  const wealth=nw>=60000?'富甲一方':nw>=25000?'殷實富商':nw>=8000?'小有家業':nw>=0?'勉強糊口':'負債累累';
  const good=L.charity*2+L.pledges*0.3,bad=L.cheats*2+L.scapegoat*0.5;
  const moral=good>bad+3?'義商':bad>good+3?'奸商':'亦正亦邪';
  const pol=L.gold>=60?'官商勾結':L.gold<=8?'清流商人':'八面玲瓏';
  const age=myAge();
  const sum='「'+wealth+'，'+moral+'，世人謂其'+pol+'。享壽 '+age+' 歲。」';
  const people=Object.entries(G.rel).filter(([id,r])=>r.aff>=25&&CH(id)&&(alive(id)||CH(id).death_year>=G.year-1)).sort((a,b)=>b[1].aff-a[1].aff).slice(0,5);
  const rd=seeded('ob'+G.turn+G.me.given);
  const quotes=people.map(([id,r])=>{
    const pool=r.aff>=70?QUOTE_HI:r.aff>=45?QUOTE_MID:QUOTE_LO;
    return {name:nameOf(id),aff:r.aff,txt:pool[Math.floor(rd()*pool.length)].replace('{n}',G.me.given)};
  });
  const facts=['在世 '+age+' 載，歷經 '+(G.year-0)+' 個寒暑','經手貨殖，淨資產約 '+fmt(nw)+' 兩','打點官場，進獻黃金點心 '+L.gold+' 兩','施粥賑濟 '+L.charity+' 次，違約偷跑 '+L.cheats+' 次','經歷火災 '+L.fires+' 次、打毀 '+L.riots+' 次','膝下 '+G.family.kids.length+' 名子女'];
  return {wealth,moral,pol,sum,quotes,facts,nw,age};
}
/** 結束這一世（破產/病逝/退隱）。 */
function endLife(cause){
  if(G.ended)return;
  G.ended={cause,year:G.year,ob:obituary()};
  G.legacy.push({gen:G.me.gen,name:G.me.name,age:myAge(),cause,sum:G.ended.ob.sum,year:G.year});
  save();
  if(typeof UI!=='undefined'&&UI.showLegacy)UI.showLegacy();
}
/** 可繼承人選。 */
function heirCandidates(){
  const kids=G.family.kids.filter(k=>kidAge(k)>=16&&!k.prodigal).map(k=>({type:'kid',id:k.id,name:k.name,age:kidAge(k)}));
  const boss=G.emps.find(e=>e.rank==='大番頭'&&e.cid);
  if(boss)kids.push({type:'adopt',id:boss.id,name:boss.name,age:ageOf(boss.cid),cid:boss.cid});
  return kids;
}
/** 傳承給繼承人，進入二代視角。 */
function succeed(h,mode){            // mode: 'retire' | 'death' | 'bankrupt'（處刑視同家產抄沒）
  if(mode==='executed')mode='bankrupt';
  const f=mode==='retire'?0.8:0.6;
  const oldName=G.me.name;
  if(mode==='death')G.silver=Math.round(G.silver*0.9);
  if(mode==='bankrupt'){G.silver=2500;Object.keys(G.inv).forEach(k=>G.inv[k]=Math.round(G.inv[k]*0.3));G.emps=G.emps.filter((e,i,a)=>e.rank!=='保鏢'||a.findIndex(x=>x.rank==='保鏢')===i)}
  let given,birth;
  if(h.type==='kid'){const k=G.family.kids.find(x=>x.id===h.id);given=k.name;birth=k.birthYear;G.me.family=G.me.family}
  else{const e=G.emps.find(x=>x.id===h.id);given=e.name.split(' ').pop();birth=CH(e.cid).birth_year;G.emps=G.emps.filter(x=>x!==e);if(npc(e.cid))npc(e.cid).hired=false}
  G.me={family:G.me.family,given,name:G.me.family+'屋 '+given,birthYear:birth,gen:G.me.gen+1};
  G.family={spouse:null,kids:[],married:false,conc:[]};
  Object.values(G.rel).forEach(r=>{r.aff=Math.round(r.aff*f)});
  G.intros=G.intros.filter(i=>R(i.cid).aff>=15&&alive(i.cid));
  G.introId=G.intros[0]?G.intros[0].cid:null;
  G.life={gifts:0,gold:Math.round(G.life.gold*0.3),cheats:0,charity:0,fires:0,riots:0,peak:G.silver,contracts:0,pledges:0,scapegoat:0,spouseKind:''};
  G.cartel.state='none';G.cartel.sanction=0;G.staple.streak=0;G.recruit=null;G.ended=null;
  pushNews(NEWS('succeed.1',{oldName:(mode==='retire'?oldName+'退隱':oldName+'離世'),gen:G.me.gen,name:G.me.name,myAge:myAge()}));
  save();
}
