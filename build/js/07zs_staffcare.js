'use strict';
/* ======================= 員工：久任成長、升遷恩情、風聲與查帳 =======================
 *  - 能力成長另存在員工紀錄 e.grow={能力:加值}，statsOfEmp 計算時疊加；不可改名冊資料（CHARS 全局共用）。上限 95。
 *  - 久任：每年新年，任職滿一年者從好的能力（商才、忠誠、膽識、社交）挑一項 +1～2，依職位偏重。
 *  - 升遷：好的能力各 +5%，忠誠另 +5；好感 +15；標記「自家栽培」（私吞、潛逃機率打七折）。
 *  - 風聲：宅邸閒聊聽到某員工的私吞流言，他標記「有風聲」（9 旬），才能查帳；清白者若貪欲 ≥70 或好感 <30，被講到時 30% 會被冤枉。
 *  - 查帳：不花錢、不扣行動；聽一次風聲只能查一次。查出→選追討／寬恕／辭退；查無實據→好感 −10、一年收斂；冤枉→好感 −20、他人 −3、反骨高者記恨。
 *  - 私吞與潛逃的倍率：好感 <30 ×1.3、≥80 ×0.7；自家栽培 ×0.7；收斂 ×0.5；記恨 ×1.5（番頭、大番頭潛逃 ×2）；食髓知味 ×1.5；殺雞儆猴（其他人九旬）×0.8。 */
const STAFF={good:['commerce_skill','integrity_loyalty','audacity_courage','diplomacy_charm'],cap:95,
  growMin:1,growMax:2,promotePct:0.05,promoteLoyal:5,promoteAff:15,homegrown:0.7,
  rumorTurns:9,falseP:0.3,falseGreed:70,falseAff:30,year:36,
  doubtAff:10,wrongAff:20,wrongOthers:3,punishAff:15,forgiveAff:10,othersAff:2,deterTurns:9,deter:0.8,
  lowAff:30,lowMul:1.3,highAff:80,highMul:0.7,calm:0.5,grudge:1.5,bold:1.5,grudgeFlee:2,trait:60};
const STAT_SHORT={commerce_skill:'商才',integrity_loyalty:'忠誠',audacity_courage:'膽識',diplomacy_charm:'交際'};
/** 依職位偏重的成長權重。 */
const GROW_W={shop:{commerce_skill:3,integrity_loyalty:3,audacity_courage:1,diplomacy_charm:1},field:{commerce_skill:1,integrity_loyalty:1,audacity_courage:4,diplomacy_charm:1}};
const growW=e=>['船長','飛腳','保鏢'].includes(e.rank)?GROW_W.field:GROW_W.shop;
/** 原始能力（名冊人物讀名冊、無名冊者讀存檔）。 */
const baseStatsOfEmp=e=>e.cid?CH(e.cid).derived_stats:e.stats;
/** 能力加值（只加不減，上限 95；原本就超過 95 的不動）。 */
function growStat(e,k,v){
  const b=baseStatsOfEmp(e)[k]||0,g=(e.grow&&e.grow[k])||0,now=b+g,nv=Math.max(now,Math.min(STAFF.cap,now+v));
  if(nv>now){e.grow=e.grow||{};e.grow[k]=g+(nv-now)}return nv-now;
}
/** 每年新年：任職滿一年者各成長一次。 */
function staffYearTick(log){
  const got=[];
  G.emps.forEach(e=>{
    if(G.turn-e.since<STAFF.year)return;
    const W=growW(e),ks=Object.keys(W);let x=rnd()*ks.reduce((a,k)=>a+W[k],0),k=ks[0];
    for(const kk of ks){x-=W[kk];if(x<=0){k=kk;break}}
    if(growStat(e,k,rint(STAFF.growMin,STAFF.growMax))>0)got.push(MSG('staff.grow',{name:e.name,rank:e.rank,stat:STAT_SHORT[k]}));
  });
  if(got.length){const t=NEWS('staff.grow',{list:got.join('')});pushNews(t);log.push(t)}
}
/** 升遷時的成長與恩情。 */
function promoteBoon(e){
  STAFF.good.forEach(k=>growStat(e,k,Math.max(1,Math.round((statsOfEmp(e)[k]||0)*STAFF.promotePct))));
  growStat(e,'integrity_loyalty',STAFF.promoteLoyal);
  e.aff=Math.min(100,empAff(e)+STAFF.promoteAff);e.homegrown=true;
}
/** 私吞機率倍率（好感、自家栽培、收斂、記恨、食髓知味、殺雞儆猴）。 */
function skimMul(e){
  const a=empAff(e),t=G.turn;let m=1;
  if(a<STAFF.lowAff)m*=STAFF.lowMul;else if(a>=STAFF.highAff)m*=STAFF.highMul;
  if(e.homegrown)m*=STAFF.homegrown;
  if(e.calmUntil>t)m*=STAFF.calm;
  if(e.grudgeUntil>t)m*=STAFF.grudge;
  if(e.boldUntil>t)m*=STAFF.bold;
  if(G.deterUntil>t&&G.deterBy!==e.id)m*=STAFF.deter;
  return m;
}
/** 捲款潛逃機率倍率。 */
const fleeMul=e=>(e.homegrown?STAFF.homegrown:1)*(e.grudgeUntil>G.turn?STAFF.grudgeFlee:1);
/** 閒聊聽到私吞流言：標記風聲。回傳流言是否成立（真或被冤枉）。 */
function rumorOf(x){
  if(x.skim>0||x.caught)return true;
  const s=statsOfEmp(x);
  return (s.greed_index>=STAFF.falseGreed||empAff(x)<STAFF.falseAff)&&chance(STAFF.falseP);
}
const hasRumor=e=>e.rumorUntil>G.turn;
/** 員工卡上的標籤（任職年資、自家栽培、前科、被冤枉、有風聲、待處置）。 */
function staffTags(e){
  const y=Math.floor((G.turn-e.since)/STAFF.year);
  return (e.homegrown?'<span class="tag green">自家栽培</span>':'')+(e.record?'<span class="tag red">有前科</span>':'')+(e.wronged?'<span class="tag gray">被冤枉過</span>':'')
    +(e.caught?'<span class="tag red">查出私吞 約 '+fmt(e.caught)+' 兩</span>':hasRumor(e)?'<span class="tag gold">🗣 有風聲</span>':'');
}
const staffTenure=e=>{const n=G.turn-e.since,y=Math.floor(n/STAFF.year);return y>=1?'任職 '+y+' 年':'任職 '+n+' 旬'};
/** 員工卡上的查帳與處置按鈕。 */
function auditBtns(e){
  if(e.caught)return ['punish','forgive','dismiss'].map(k=>'<button class="pixel-btn btn-sm '+(k==='forgive'?'btn-green':'btn-red')+'" data-act="auditDo" data-id="'+e.id+'" data-k="'+k+'">'+UT('btn.audit_'+k)+'</button>').join('');
  return hasRumor(e)?'<button class="pixel-btn btn-sm btn-gold" data-act="audit" data-id="'+e.id+'">'+UT('btn.audit')+'</button>':'';
}
/** 查帳（需有風聲；一次風聲只能查一次）。 */
function auditEmp(id){
  const e=G.emps.find(x=>x.id===id);if(!e)return {ok:false,msg:''};
  if(!hasRumor(e))return {ok:false,msg:MSG('audit.noRumor')};
  e.rumorUntil=0;e.audited=G.turn;
  const boss=G.emps.find(x=>x.rank==='大番頭'&&x.id!==id);
  const auditC=boss?statsOfEmp(boss).commerce_skill:45,A=ODDS.auditDetect;
  const detect=clamp(A.base+auditC/A.commerceDiv,A.base,A.max),s=statsOfEmp(e);
  if(e.skim>0&&chance(detect)){e.caught=Math.max(5,Math.round(e.skim*(0.85+rnd()*0.3)));if(e.cid)logRel(e.cid,'被你查帳，查出帳目有出入。');return {ok:true,found:true,msg:MSG('audit.found',{name:e.name,amt:fmt(e.caught)})}}
  if(e.skim>0){e.aff=Math.max(0,empAff(e)-STAFF.doubtAff);e.calmUntil=G.turn+STAFF.year;if(e.cid)logRel(e.cid,'被你查帳，查無實據。');return {ok:true,msg:MSG('audit.noProof',{name:e.name,a:STAFF.doubtAff})}}
  e.aff=Math.max(0,empAff(e)-STAFF.wrongAff);e.wronged=true;
  G.emps.forEach(x=>{if(x!==e)x.aff=Math.max(0,empAff(x)-STAFF.wrongOthers)});
  let grudge='';if(s.betrayal_risk>=STAFF.trait){e.grudgeUntil=G.turn+STAFF.year;grudge=MSG('audit.grudge',{name:e.name})}
  if(e.cid)logRel(e.cid,'被你查帳，冤枉了他。');
  return {ok:true,msg:MSG('audit.wrong',{name:e.name,a:STAFF.wrongAff,o:STAFF.wrongOthers})+grudge};
}
/** 查出後的處置：追討／寬恕／辭退。 */
function auditDecide(id,k){
  const e=G.emps.find(x=>x.id===id);if(!e||!e.caught)return '';
  const s=statsOfEmp(e),back=Math.round((e.skim||0)*0.8),name=e.name,t=G.turn;
  const deter=()=>{G.emps.forEach(x=>{if(x!==e)x.aff=Math.max(0,empAff(x)-STAFF.othersAff)});G.deterUntil=t+STAFF.deterTurns;G.deterBy=e.id};
  e.caught=0;e.flag=0;e.record=true;
  if(k==='dismiss'){G.silver+=back;e.skim=0;deter();const fx=fireEmp(id);return MSG('audit.dismiss',{name,back:fmt(back)})+(fx?' '+fx:'')}
  if(k==='forgive'){
    e.skim=0;e.aff=Math.min(100,empAff(e)+STAFF.forgiveAff);
    let note='';if(s.betrayal_risk>=STAFF.trait){e.boldUntil=t+STAFF.year;note=MSG('audit.bold',{name})}else if(s.integrity_loyalty>=STAFF.trait){e.calmUntil=t+STAFF.year;note=MSG('audit.grateful',{name})}
    if(e.cid)logRel(e.cid,'私吞被查出，你寬恕了他。');
    return MSG('audit.forgive',{name,a:STAFF.forgiveAff})+note;
  }
  G.silver+=back;e.skim=0;e.aff=Math.max(0,empAff(e)-STAFF.punishAff);deter();
  let note='';if(s.betrayal_risk>=STAFF.trait){e.grudgeUntil=t+STAFF.year;note=MSG('audit.grudge',{name})}else if(s.integrity_loyalty>=STAFF.trait){e.calmUntil=t+STAFF.year;note=MSG('audit.reform',{name})}
  if(e.cid)logRel(e.cid,'私吞被查出，追回 '+back+' 兩。');
  return MSG('audit.punish',{name,back:fmt(back),a:STAFF.punishAff,o:STAFF.othersAff})+note;
}
ACT.audit=el=>{const r=auditEmp(el.dataset.id);if(r.msg)UI.showInfo('🧾 查帳',(r.found?'<div class="notice">':'<div class="notice tiny">')+esc(r.msg)+'</div>');if(r.ok)sfx[r.found?'bad':'tap']();UI.render();refreshSheet()};
ACT.auditDo=el=>{const m=auditDecide(el.dataset.id,el.dataset.k);if(m){toast(m,5200);sfx.coin()}UI.hideInfo();UI.render();refreshSheet()};
