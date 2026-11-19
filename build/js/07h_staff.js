/* ═════ [07zs_staffcare] ═════ */
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
const STAT_SHORT=NAMES.statShort;
/** 依職位偏重的成長權重。 */
const GROW_W={shop:{commerce_skill:3,integrity_loyalty:3,audacity_courage:1,diplomacy_charm:1},field:{commerce_skill:1,integrity_loyalty:1,audacity_courage:4,diplomacy_charm:1}};
const growW=e=>['captain','courier','guard'].includes(e.rank)?GROW_W.field:GROW_W.shop;
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
    if(growStat(e,k,rint(STAFF.growMin,STAFF.growMax))>0)got.push(MSG('staff.grow',{name:e.name,rank:rankName(e.rank),stat:STAT_SHORT[k]}));
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
  return (jailedEmp(e)?UT('staff.jailed',{a:e.jailUntil-G.turn}):'')+(e.homegrown?UT('staff.staffTags'):'')+(e.record?UT('staff.staffTags.2'):'')+(e.wronged?UT('staff.staffTags.3'):'')
    +(e.caught?UT('staff.staffTags.4',{a:fmt(e.caught)}):hasRumor(e)?UT('staff.staffTags.5'):'');
}
const staffTenure=e=>{const n=G.turn-e.since,y=Math.floor(n/STAFF.year);return y>=1?UT('staff.staffTenure',{a:y}):UT('staff.staffTenure.2',{a:n})};
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
  const boss=G.emps.find(x=>x.rank==='chief'&&x.id!==id);
  const auditC=boss?statsOfEmp(boss).commerce_skill:45,A=ODDS.auditDetect;
  const detect=clamp(A.base+auditC/A.commerceDiv,A.base,A.max),s=statsOfEmp(e);
  if(e.skim>0&&chance(detect)){e.caught=Math.max(5,Math.round(e.skim*(0.85+rnd()*0.3)));if(e.cid)logRel(e.cid,UT('staff.auditEmp'));return {ok:true,found:true,msg:MSG('audit.found',{name:e.name,amt:fmt(e.caught)})}}
  if(e.skim>0){e.aff=Math.max(0,empAff(e)-STAFF.doubtAff);e.calmUntil=G.turn+STAFF.year;if(e.cid)logRel(e.cid,UT('staff.auditEmp.2'));return {ok:true,msg:MSG('audit.noProof',{name:e.name,a:STAFF.doubtAff})}}
  e.aff=Math.max(0,empAff(e)-STAFF.wrongAff);e.wronged=true;
  G.emps.forEach(x=>{if(x!==e)x.aff=Math.max(0,empAff(x)-STAFF.wrongOthers)});
  let grudge='';if(s.betrayal_risk>=STAFF.trait){e.grudgeUntil=G.turn+STAFF.year;grudge=MSG('audit.grudge',{name:e.name})}
  if(e.cid)logRel(e.cid,UT('staff.auditEmp.3'));
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
    if(e.cid)logRel(e.cid,UT('staff.auditDecide'));
    return MSG('audit.forgive',{name,a:STAFF.forgiveAff})+note;
  }
  G.silver+=back;e.skim=0;e.aff=Math.max(0,empAff(e)-STAFF.punishAff);deter();
  let note='';if(s.betrayal_risk>=STAFF.trait){e.grudgeUntil=t+STAFF.year;note=MSG('audit.grudge',{name})}else if(s.integrity_loyalty>=STAFF.trait){e.calmUntil=t+STAFF.year;note=MSG('audit.reform',{name})}
  if(e.cid)logRel(e.cid,UT('staff.auditDecide.2',{a:back}));
  return MSG('audit.punish',{name,back:fmt(back),a:STAFF.punishAff,o:STAFF.othersAff})+note;
}
ACT.audit=el=>{const r=auditEmp(el.dataset.id);if(r.msg)UI.showInfo(UT('staff.audit'),(r.found?'<div class="notice">':'<div class="notice tiny">')+esc(r.msg)+'</div>');if(r.ok)sfx[r.found?'bad':'tap']();UI.render();refreshSheet()};
ACT.auditDo=el=>{const m=auditDecide(el.dataset.id,el.dataset.k);if(m){toast(m,5200);sfx.coin()}UI.hideInfo();UI.render();refreshSheet()};

/* ═════ [07zt_staffevents] ═════ */
'use strict';
/* ======================= 店員偶發事件（第一百四十八節） =======================
 *  賭債、酒後鬧事、家人急病、成親主婚、同行挖角、遭人誣陷：旬報後以人物事件視窗出現，只有「出錢」「不管」兩個選項，當下決定。
 *  - 每旬全店最多一件；同一位店員一年內不再遇到（賭債再犯除外）；遠島期間、出門在外的船長飛腳不觸發。
 *  - 出錢一律約 100 兩（90～110，現款）；畫面不顯示好感數字，只寫一句敘事。
 *  - 名冊人物的軟肋（嗜賭、好酒、溺愛子女、懼內）會提高對應事件的機會，事件後軟肋即被證實。
 *  - 沒選就關掉視窗：下一旬推進時視為「不管」，結果寫進旬報。
 *  數值在 01c_odds.js 的 ODDS.staffEvent；文字在 01e（sev.*）、01f（sev.*）、01g（sev.*）。 */
const SEV_TYPES=['gamble','drunk','ill','wed','poach','frame'];
/** 事件與軟肋的對應：發生後證實軟肋。 */
const SEV_WEAK={gamble:['gambling'],drunk:['wine'],ill:['children','henpecked']};
/** 關押中的店員不做事（職能、出門、護衛都不算他）。 */
const jailedEmp=e=>!!e&&e.jailUntil>G.turn;
const sevAway=e=>G.ships.some(s=>s.capt===e.id)||(G.smug||[]).some(v=>v.capt===e.id)||(e.lentUntil||0)>G.turn;
/** 加權抽選。 */
function sevPick(L,w){const tot=L.reduce((a,x)=>a+w(x),0);if(tot<=0)return null;let r=rnd()*tot;for(const x of L){r-=w(x);if(r<0)return x}return L[L.length-1]}
/** 某店員各事件的權重（看軟肋與能力）。 */
function sevWeights(e){
  const O=ODDS.staffEvent,s=statsOfEmp(e),w=e.cid&&CH(e.cid)?CH(e.cid).weakness:null;
  return {
    gamble:w==='gambling'?O.wWeak:(s.greed_index>=60&&s.audacity_courage>=55?O.wStat:0),
    drunk:w==='wine'?O.wWeak:(s.audacity_courage>=60&&s.integrity_loyalty<50?O.wStat:0),
    ill:(w==='children'||w==='henpecked')?O.wIllWeak:O.wIll,
    wed:G.turn-e.since>=O.wedTenure&&!e.wed?O.wWed:0,
    poach:['banto','chief','captain'].includes(e.rank)&&s.commerce_skill>=60&&rivalsHere().length?O.wPoach:0,
    frame:O.wFrame
  };
}
/** 推進一旬時：先把上旬沒選的事件當作不管，再擲本旬的事件。 */
function staffEventTick(log){
  if(G.staffEv&&!G.staffEv.done&&G.staffEv.shown){const m=sevResolve(false);if(m){const t=NEWS('sev.auto',{m});pushNews(t);log.push(t)}}   // 見過卻沒選：視為不管；沒輪到：作廢
  G.staffEv=null;
  if((G.exile||0)>0||G.ended)return;
  const O=ODDS.staffEvent,t=G.turn;
  let e=G.emps.find(x=>x.relapseAt===t&&!jailedEmp(x)&&!sevAway(x)),type='gamble';   // 賭癮再犯
  if(e)delete e.relapseAt;
  else{
    const L=G.emps.filter(x=>!(x.sevT>t-O.cooldown)&&!jailedEmp(x)&&!sevAway(x));
    if(!L.length||!chance(Math.min(O.cap,O.perEmp*L.length)))return;
    const C=L.map(x=>{const W=sevWeights(x);return {x,W,s:SEV_TYPES.reduce((a,k)=>a+W[k],0)}});
    const c=sevPick(C,c=>c.s);if(!c)return;
    e=c.x;type=sevPick(SEV_TYPES,k=>c.W[k]);
  }
  e.sevT=t;
  const S={empId:e.id,type,cost:rint(O.costMin,O.costMax),turn:t,done:false};
  if(type==='poach'){const L=rivalsHere().filter(n=>!isBekke(n)),r=L.length?pick(L):null;S.rival=r?r.cid:null}
  G.staffEv=S;queueHomeEvent({type:'staff',empId:e.id});   // 回府時（07zx_homeevt.js）
}
/** 人物事件卡的內容（07s_face_events.js 呼叫）。 */
function sevCard(e,name){
  const S=G.staffEv;if(!S||S.done||S.turn!==e.turn||S.empId!==e.empId)return null;
  const v={n:name,a:fmt(S.cost),r:S.rival?nameOf(S.rival):''};
  return {line:UT('sev.'+S.type,v),effect:UT('sev.'+S.type+'.ask',v),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="sevPay" '+(G.silver<S.cost?'disabled':'')+'>'+UT('btn.sevPay.'+S.type,{c:coinHtml('silver',S.cost)})+'</button><button class="pixel-btn btn-sm" data-act="sevIgnore">'+UT('btn.sevIgnore.'+S.type)+'</button></div>'};
}
/** 結算：pay＝出錢；回傳要給玩家看的一句話（後果另寫旬報新聞）。 */
function sevResolve(pay){
  const S=G.staffEv;if(!S||S.done)return null;
  const e=G.emps.find(x=>x.id===S.empId);S.done=true;if(!e)return null;
  const X=ODDS.staffEvent[S.type],t=G.turn,nm=e.name,v={n:nm,r:S.rival?nameOf(S.rival):'',k:rankName(e.rank)};
  const aff=d=>{e.aff=clamp(empAff(e)+d,0,100)},leave=()=>{G.emps=G.emps.filter(x=>x!==e);if(e.cid&&npc(e.cid))npc(e.cid).hired=false},news=k=>pushNews(NEWS(k,v));
  let msg;
  if(pay){
    payPublic('spend.staffEv|'+S.type,S.cost);aff(X.payAff);if(X.payLoyal)growStat(e,'integrity_loyalty',X.payLoyal);
    if(S.type==='gamble'&&chance(X.relapse))e.relapseAt=t+rint(X.relapseMin,X.relapseMax);
    if(S.type==='wed')e.wed=true;
    msg=MSG('sev.'+S.type+'.pay',v);
  }else{
    aff(X.ignAff||0);msg=MSG('sev.'+S.type+'.ign',v);
    if(S.type==='gamble'){e.boldUntil=Math.max(e.boldUntil||0,t+X.skimTurns);if(chance(X.creditor)){loseFame('staffEv');news('sev.creditor')}}
    else if(S.type==='drunk'){e.jailUntil=t+X.jail;loseFame('staffEv')}
    else if(S.type==='ill'){if(['banto','chief'].includes(e.rank)&&chance(X.quit)){leave();news('sev.quit')}}
    else if(S.type==='wed')e.wed=true;
    else if(S.type==='poach'){leave();news('sev.poached')}
    else if(S.type==='frame'){e.jailUntil=t+X.jail;e.record=true}
  }
  if(e.cid&&(SEV_WEAK[S.type]||[]).includes(CH(e.cid).weakness)){const r=R(e.cid);if(!r.verified){r.verified=true;logRel(e.cid,UT('sev.verified',{w:weakName(CH(e.cid).weakness)}))}}
  return msg;
}
ACT.sevPay=()=>{const S=G.staffEv;if(!S||S.done)return UI.hideInfo();if(G.silver<S.cost){toast(MSG('sev.short'));return}
  const m=sevResolve(true);sfx.coin();UI.hideInfo();if(m)toast(m,4200);UI.render()};
ACT.sevIgnore=()=>{const m=sevResolve(false);UI.hideInfo();if(m)toast(m,4200);UI.render()};

/* ═════ [07zu_relief] ═════ */
'use strict';
/* ======================= 災情救濟請託（第一百四十九節） =======================
 *  大火（冬）、凶作（秋）、颱風（夏）、疫病（春）發生的那一旬，記為「本城災情」（G.disaster），主畫面右上角提醒（城史不算，第二百五十二節）。
 *  只有事件當旬，三系三階以上、交情 60 以上的官員，請託清單會各多一項救濟；同一場災情每系只能辦一次。期間外請託清單不出現，但職位說明會列出（說明開頭寫「災情當旬」）。
 *   行政：御救小屋合辦（現款 800 兩，大型施粥）／財務：緊急御免（兩旬內大盤進貨上限加倍、漲價的貨照災前價格進）／司法：普請御用（官府高價收購本業貨）。
 *  數值在 01c_odds.js 的 ODDS.relief；花費 COSTS.reliefSoup。 */
const RELIEF_KEY={administration:'reliefSoup',finance:'reliefImport',judiciary:'reliefBuild'};
FAVORS.administration.push(favorText({k:'reliefSoup',rank:3,relief:true}));
FAVORS.finance.push(favorText({k:'reliefImport',rank:3,relief:true}));
FAVORS.judiciary.push(favorText({k:'reliefBuild',rank:3,relief:true}));
/** 記下本城災情（事件當旬）。type：fire、famine、typhoon、plague。 */
function markDisaster(type){if(!G)return;if(G.disaster&&G.disaster.turn===G.turn)return;G.disaster={type,turn:G.turn,done:{}}}
/** 本旬是否正逢災情。 */
const disasterNow=()=>!!(G&&G.disaster&&G.disaster.turn===G.turn);
/** 這一系的救濟本旬還能不能辦。 */
const reliefOpen=court=>disasterNow()&&!G.disaster.done[court];
/** 私梟收黑貨的時機：本城節慶當旬或災情當旬（第一百五十二節）。 */
const blackMarketOpen=()=>!!(G&&(festActive()||disasterNow()));
/** 緊急御免期間（本旬與下一旬）。 */
const reliefImportOn=()=>!!(G&&G.reliefBuy>G.turn);
/** 緊急御免：漲價的貨照災前價格（不計事件倍率）。 */
function reliefPrice(name){const m=G.mk[name];return m.ev>1?reliefQuote(name):null}
/** 普請御用：官府收購的貨（每項本業貨最多約兩旬配額）。 */
function reliefBuildLots(){
  return tradeComms().map(c=>{const n=c.name,have=G.inv[n]||0,want=Math.max(1,Math.round(ODDS.relief.buildTurns*Math.max(quotaOf(n),supplyLine(n))));return {c,q:Math.min(have,want)}}).filter(x=>x.q>0);
}
/** 執行救濟請託（doFavor 呼叫）；不扣好感。 */
function doRelief(cid,n,r,f){
  const court=n.pos.court,R_=ODDS.relief;
  if(!reliefOpen(court))return {ok:true,status:'held',msg:MSG('relief.closed')};
  let msg;
  if(f.k==='reliefSoup'){
    if(!afford('reliefSoup'))return {ok:true,status:'held',msg:shortMsg('reliefSoup')};
    spend('reliefSoup');
    const fm=addFame(R_.soupFame,'major');G.heat=Math.max(0,(G.heat||0)-R_.soupHeat);
    Object.keys(G.mk).forEach(k=>{if(COMM_MAP[k].staple)G.mk[k].ev=Math.max(1,G.mk[k].ev*R_.soupStaple)});
    syncPrices();G.staple.streak=0;G.staple.idx=Math.max(...riotKeys().map(riotLevel));
    setAff(r,clamp(r.aff+R_.soupAff,0,100));
    msg=MSG('relief.soup',{f:fm});pushNews(NEWS('relief.soup',{n:nameOf(cid)}));
  }else if(f.k==='reliefImport'){
    G.reliefBuy=G.turn+R_.importTurns;const fm=addFame(R_.importFame,'major');
    msg=MSG('relief.import',{f:fm});pushNews(NEWS('relief.import'));
  }else{
    const L=reliefBuildLots();if(!L.length)return {ok:true,status:'held',msg:MSG('relief.buildNone')};
    let rev=0;L.forEach(({c,q})=>{const p=Math.round(marketQuote(c.name)*R_.buildMul*q);stockTake(c.name,q,false);rev+=p});
    G.silver+=rev;const fm=addFame(R_.buildFame,'major');
    msg=MSG('relief.build',{g:L.map(x=>x.c.short+' × '+x.q).join(NAMES_SEP),a:fmt(rev),f:fm});pushNews(NEWS('relief.build',{a:fmt(rev)}));
  }
  G.disaster.done[court]=true;
  logRel(cid,MSG('log.relief',{f:f.name,m:msg}));
  return {ok:true,status:'done',msg};
}

/* ═════ [07zv_bandit] ═════ */
'use strict';
/* ======================= 海賊／山賊猖獗（第一百五十四節） =======================
 *  全國每年一次：隨機一旬、隨機一個地區，海賊或山賊二選一，持續三旬（含當旬）。G.bandit＝{type:'sea'|'land',region,start,until,cleared}。
 *  - 發生在外地：只有旬報一則新聞。
 *  - 發生在本地區：海賊＝船長不能出海（委託採買、走私），山賊＝飛腳不能出發；這三旬內回程的船（海賊）或馬幫（山賊）一律被劫，損失比照遇險（七成）。
 *  - 私梟「買通」（私房錢 300 兩、風聲 +0.5）：當旬出發與當旬推進時回程的隊伍都放行（G.banditPass＝買通那一旬）。
 *  - 船奉行（海賊）／道中奉行（山賊）「討伐」（現款 3000 兩、不扣好感、知名度 +3）：立刻解除。
 *  - 不算官吏混亂（第一節）。數值 ODDS.bandit；花費 COSTS.banditBribe、banditQuell。 */
const homeRegion=()=>homeCity().region_id;
/** 本地區某類賊亂是否正在進行（未討平）。 */
const banditHome=type=>{const B=G&&G.bandit;return !!(B&&!B.cleared&&B.region===homeRegion()&&(!type||B.type===type)&&G.turn>=B.start&&G.turn<B.until)};
const banditLeft=()=>G.bandit?G.bandit.until-G.turn:0;
/** 出發是否被擋（當旬買通則放行）。 */
const banditBlocks=mode=>banditHome(mode)&&G.banditPass!==G.turn;
/** 推進一旬時，回程的隊伍是否被劫（上一旬買通則放行）。 */
const banditRobs=mode=>banditHome(mode)&&G.banditPass!==G.turn-1;
/** 每旬：排定今年的賊亂、到期發生、本地區平息時寫旬報。 */
function banditTick(log){
  const idx=(G.month-1)*3+G.cycle-1;
  if(!G.banditPlan||G.banditPlan.y!==G.year)G.banditPlan={y:G.year,t:rint(idx,35)};
  const B=G.bandit;
  if(B&&!B.cleared&&B.region===homeRegion()&&G.turn===B.until){const t=NEWS('bandit.calm.'+B.type);pushNews(t);log.push(t)}
  if(G.banditPlan.t!==idx||G.banditPlan.done)return;
  G.banditPlan.done=true;
  const type=chance(0.5)?'sea':'land',region=pick(REG_LIST).id;
  G.bandit={type,region,start:G.turn,until:G.turn+ODDS.bandit.turns,cleared:false};
  const t=region===homeRegion()?NEWS('bandit.home.'+type):NEWS('bandit.far.'+type,{r:REG_NAME(region)});pushNews(t);log.push(t);
}
/** 商路、走私面板上的封鎖提示。 */
const banditNotice=mode=>banditBlocks(mode)?'<div class="notice" style="border-color:#b3261e">'+UT('bandit.notice.'+mode,{n:banditLeft()})+'</div>':'';
/* ---------- 私梟：買通 ---------- */
function banditBribeReq(){
  const B=G.bandit;if(!banditHome()||G.banditPass===G.turn)return null;
  return {k:'bribeBandit',name:UT('bandit.bribe.'+B.type),desc:UT('bandit.bribe.d',{a:fmt(costOf('banditBribe'))})};
}
function banditBribeDo(cid){
  const r=R(cid);if(!banditHome())return UT('bandit.bribe.none');
  if(!afford('banditBribe'))return shortMsg('banditBribe');
  spend('banditBribe');G.banditPass=G.turn;
  setAff(r,Math.max(0,r.aff-REQ_AFF.normal));r.dealT=G.turn;logRel(cid,UT('bandit.bribe.log',{a:REQ_AFF.normal}));
  return UT('bandit.bribe.ok.'+G.bandit.type,{a:nameOf(cid),b:REQ_AFF.normal});
}
/* ---------- 船奉行／道中奉行：討伐 ---------- */
REG_FAVORS.push({k:'rquellSea',bandit:'sea',name:UT('fav.rquellSea'),rank:5,pos:['reg_08'],desc:UT('fav.rquellSea.d')});
REG_FAVORS.push({k:'rquellLand',bandit:'land',name:UT('fav.rquellLand'),rank:5,pos:['reg_07'],desc:UT('fav.rquellLand.d')});
/** 討伐請託只在本地區賊亂期間、向本地區的官員開口時出現。 */
const banditFavorOpen=(f,n)=>banditHome(f.bandit)&&CITY(n.cityId).region_id===homeRegion();
function doBanditFavor(cid,n,r,f){
  if(!banditFavorOpen(f,n))return {ok:true,status:'held',msg:MSG('bandit.quell.closed')};
  if(!afford('banditQuell'))return {ok:true,status:'held',msg:shortMsg('banditQuell')};
  spend('banditQuell');G.bandit.cleared=true;const fm=addFame(ODDS.bandit.quellFame,'major');
  const t=NEWS('bandit.quelled.'+f.bandit,{n:nameOf(cid)});pushNews(t);
  const msg=MSG('bandit.quell.ok.'+f.bandit,{f:fm});logRel(cid,MSG('log.relief',{f:f.name,m:msg}));
  return {ok:true,status:'done',msg};
}

/* ═════ [07zw_ronin] ═════ */
'use strict';
/* ======================= 浪人頭：投資他當官（第一百五十七節） =======================
 *  - 結識：不能求見（不分男女；本城沒有就從外地調一位，再沒有才從名冊補）。指名花魁 10%、包場夜宴 15%、出門遇襲時 30%（拔刀相助，這次遇襲直接化解）；最多結識三位（G.ronin.ids）。
 *  - 要錢：旬報後的人物事件視窗，「給他」或「回絕」（回絕沒有後果）。每旬最多一件。
 *     還沒有人當官時：三位輪流，每旬機率同查貨（inspectChance），每次 50 兩；最先給滿 10 次的人安插為町奉行所隨機一系的一階官員。
 *     當官的那一位：一階 100、二階 200、三階 400 兩；每給滿 10 次升一階，到四階不再來。其他浪人照樣來要 50 兩，但不會再有人當官。
 *     機率：全部浪人共用一個機率＝查貨機率 ×（3/4 的當官者官階次方），擲中時輪流上門。
 *  - 安插、升官時，原本坐那一階的人調往外地；他留下的舊位子由名冊照常遞補。
 *  - 當官後：好感固定 100（lockAff），拜訪時略過拜訪戰鬥、直接請託；不參與人物調動。
 *  數值 ODDS.ronin；文字 ronin.*（01e、01f、01g）。 */
const RONIN=()=>G.ronin||(G.ronin={ids:[],paid:{},official:null,next:0});
const roninOfficial=cid=>!!(G&&G.ronin&&G.ronin.official===cid&&npc(cid)&&npc(cid).pos);
/** 結識一位浪人頭（本城未結識的浪人頭；不夠時從名冊補一位到本城）。回傳 cid 或 null。how：nominate、feast、ambush。 */
function meetRonin(how){
  const R_=RONIN();if(R_.ids.length>=ODDS.ronin.maxKnown)return null;
  let L=cityNpcs(G.cityId,'guard').filter(n=>!R_.ids.includes(n.cid)&&!(G.rel[n.cid]&&G.rel[n.cid].bond)&&!n.hired&&!G.emps.some(e=>e.cid===n.cid)).map(n=>n.cid);
  if(!L.length){                                      // 本城沒有：從外地調一位浪人頭過來
    const far=Object.values(G.world.npcs).filter(n=>n.role==='guard'&&n.cityId!==G.cityId&&alive(n.cid)&&!(G.rel[n.cid]&&G.rel[n.cid].bond)&&!n.hired&&!G.emps.some(e=>e.cid===n.cid));
    if(far.length){const n=pick(far);n.cityId=G.cityId;L=[n.cid]}
  }
  if(!L.length){
    const W=G.world.npcs,pool=CHARS.filter(c=>!W[c.id]&&(c.roles||[]).includes('guard')&&c.birth_year<=G.year-20&&c.birth_year>=G.year-55&&c.death_year>G.year+5);   // 名冊裡帶浪人頭身分的人
    if(!pool.length)return null;
    const c=pick(pool);W[c.id]={cid:c.id,cityId:G.cityId,role:'guard',pos:null};L=[c.id];
  }
  const cid=pick(L),r=R(cid);R_.ids.push(cid);R_.paid[cid]=0;
  r.bond={mult:0.8,label:UT('ronin.label.'+how),introId:null};r.met=true;r.seen=true;addKnown(cid);
  setAff(r,clamp(r.aff+ODDS.ronin.aff,0,100));logRel(cid,UT('ronin.log.'+how));
  return cid;
}
/** 每旬：決定這一旬有沒有浪人上門要錢（上一旬沒處理的視為回絕）。 */
function roninTick(log){
  const R_=RONIN(),O=ODDS.ronin;R_.ask=null;
  R_.ids=R_.ids.filter(c=>npc(c)&&alive(c));if(!R_.ids.length)return;
  let cid=null,amt=0;
  const off=R_.official&&roninOfficial(R_.official)?R_.official:null,rk=off?npc(off).pos.rank:0;
  /* 全部浪人共用一個機率：查貨機率乘 3/4 的（當官者官階）次方；擲中時輪流上門，當官者到四階退出名單 */
  const L=R_.ids.filter(c=>!(c===off&&rk>=4));
  if(L.length&&chance(inspectChance()*Math.pow(O.decay,rk))){cid=L[R_.next%L.length];R_.next=(R_.next+1)%L.length;amt=cid===off?O.amt[rk]:O.amt[0]}
  if(!cid)return;
  R_.ask={cid,amt,turn:G.turn};queueHomeEvent({type:'ronin',cid});   // 回府時（07zx_homeevt.js）
}
/** 人物事件卡內容（07s_face_events.js 呼叫）。 */
function roninCard(e){
  const A=RONIN().ask;if(!A||A.cid!==e.cid||A.turn!==e.turn)return null;
  const off=roninOfficial(A.cid),k=off?'ronin.askOfficial':'ronin.ask';
  return {line:TX(off?'ronin.lineOfficial':'ronin.line'),effect:UT(k,{a:fmt(A.amt)}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="roninGive" '+(G.silver<A.amt?'disabled':'')+'>'+UT('btn.roninGive',{c:coinHtml('silver',A.amt)})+'</button><button class="pixel-btn btn-sm" data-act="roninNo">'+UT('btn.roninNo')+'</button></div>'};
}
/** 把浪人安插到某一階（原本坐那一階的人調往外地）。 */
function roninSeat(cid,court,rank){
  const n=npc(cid),p=posPick(court,rank);
  const old=Object.values(G.world.npcs).find(x=>x.cid!==cid&&x.cityId===G.cityId&&x.pos&&x.pos.court===court&&x.pos.rank===rank&&alive(x.cid));
  let far='';
  if(old){const others=CITIES.filter(c=>c.id!==G.cityId);const to=pick(others);old.cityId=to.id;far=to.name;logRel(old.cid,MSG('log.transferOut',{c:to.name}))}
  n.role='official';n.pos={court,rank,posId:p.id};n.ronin=true;
  const r=R(cid);r.lockAff=true;setAff(r,100);
  return {old:old?old.cid:null,far,title:p.title};
}
ACT.roninGive=()=>{
  const R_=RONIN(),A=R_.ask;if(!A){UI.hideInfo();return}
  if(G.silver<A.amt){toast(MSG('ronin.short'));return}
  payPublic('spend.ronin|'+A.cid,A.amt);R_.ask=null;
  const cid=A.cid,O=ODDS.ronin;R_.paid[cid]=(R_.paid[cid]||0)+1;
  let msg=MSG('ronin.thanks',{n:nameOf(cid)}),news=null;
  if(R_.paid[cid]>=O.times){
    if(!R_.official){                                   // 第一位給滿 10 次：安插一階
      const court=pick(CITY_COURTS),s=roninSeat(cid,court,1);R_.official=cid;R_.paid[cid]=0;
      news=NEWS('ronin.appoint',{n:nameOf(cid),p:s.title,o:s.old?nameOf(s.old):'',c:s.far});msg=MSG('ronin.appoint',{n:nameOf(cid),p:s.title});
    }else if(roninOfficial(cid)&&npc(cid).pos.rank<4){  // 當官的那位：升一階
      const n=npc(cid),s=roninSeat(cid,n.pos.court,n.pos.rank+1);R_.paid[cid]=0;
      news=NEWS('ronin.promote',{n:nameOf(cid),p:s.title,o:s.old?nameOf(s.old):'',c:s.far});msg=MSG('ronin.promote',{n:nameOf(cid),p:s.title});
    }
  }
  logRel(cid,UT('ronin.log.paid',{a:fmt(A.amt)}));
  if(news){pushNews(news);addKnown(cid)}
  sfx.coin();UI.hideInfo();toast(msg,4600);UI.render();
};
ACT.roninNo=()=>{const R_=RONIN();R_.ask=null;UI.hideInfo();toast(MSG('ronin.no'),3200)};
/** 遇襲時：30% 有浪人頭拔刀相助（rollAmbush 呼叫）；回傳 cid 或 null。 */
function roninRescue(){
  if(RONIN().ids.length>=ODDS.ronin.maxKnown||!chance(ODDS.ronin.ambush))return null;
  return meetRonin('ambush');
}
/** 拜訪當官的浪人：略過拜訪戰鬥，直接請託（ACT.visit 呼叫）。 */
function roninVisit(cid){
  if(!spendVisitAP())return;
  UI.showInfo(UT('bt.battleEnd.7',{a:nameOf(cid)}),requestHtml(cid,TX('ronin.visit')));
}

/* ═════ [07zx_homeevt] ═════ */
'use strict';
/* ======================= 回府時的事件（第一百六十一節） =======================
 *  第三個事件切入點：這一旬只要用掉行動點數（出門前往、商路出發、私房錢、宴客……），做完回到主畫面時，若有排隊的事件就跳出一件（每次最多一件）。
 *  開頭一句：出門回來＝「你回到店裡……」；在店裡做的事＝「正忙著，帳房進來說有人求見……」。
 *  - 排在這裡的：商人借錢、大番頭回報意外之財、浪人要錢、分號來訪、店員急事、夫人事件（07zzh_wife.js）。
 *  - 這一旬沒輪到的，推進一旬時全部作廢：借錢＝婉拒；意外之財與分號送錢＝沒有這筆錢；浪人、分號調貨＝不算回絕；店員急事＝不算「不管」。
 *  - 輪到時才入帳的錢（意外之財、分號送錢）記在 G.carryIn，算進下一期旬報。
 *  旬報後的事件（查貨、官員索賄、官吏硬塞貨、暖簾分提議）仍走 07s_face_events.js 的 queueFaceEvent。 */
const homeQ=()=>G.homeEvents||(G.homeEvents=[]);
/** 排進「回府時」。 */
function queueHomeEvent(e){if(G&&e){e.turn=G.turn;homeQ().push(e)}}
/** 推進一旬時：沒輪到的全部作廢。 */
function homeEventsVoid(){G.homeEvents=[]}
/** 事件視窗標題。 */
function faceTitle(e){
  return ({windfall:UT('face.title'),extort:UT('face.title.2'),xforce:UT('face.title.3'),xloan:UT('face.title.4'),inspect:UT('face.title.5'),staff:UT('face.title.staff'),ronin:UT('face.title.ronin'),
    branch:UT('face.title.branch'),branchPay:UT('face.title.branch'),branchAsk:UT('face.title.branchAsk')})[e.type]||(FACE_TITLE[e.type]&&UT(FACE_TITLE[e.type]))||UT('face.faceEventCard');
}
/** 輪到時才發生的效果（入帳）。 */
function homeEventApply(e){
  if(e.type==='windfall'){
    G.silver+=e.amt;G.carryIn=G.carryIn||{};G.carryIn.windfall=(G.carryIn.windfall||0)+e.amt;sfx.coin();
    const b=(G.emps||[]).find(x=>x.id===e.empId);if(b)b.wind=(b.wind||0)+e.amt;
    pushNews(NEWS('chief.windfall',{amt:fmt(e.amt)}));
  }else if(e.type==='branchPay'){
    G.silver+=e.amt;G.carryIn=G.carryIn||{};G.carryIn.branch=(G.carryIn.branch||0)+e.amt;sfx.coin();
    pushNews(NEWS('branch.pay',{b:branchName(),a:fmt(e.amt)}));
  }else if(e.type==='staff'&&G.staffEv)G.staffEv.shown=true;
}
/** 跳出一件（lead：開頭那句的文字鍵）。 */
function showHomeEvent(lead){
  if(!G||G.ended)return;
  const q=homeQ().filter(e=>e.turn===G.turn);G.homeEvents=q;
  let e,h;
  while(q.length&&!h){e=q.shift();h=faceEventCard(e)}
  if(!h){save();return}
  homeEventApply(e);save();
  INFO_AFTER=null;
  UI.showInfo(faceTitle(e),UT(lead||'home.evt.lead')+h);UI.render();
}
/* 觸發：這一旬用掉行動點數後，回到主畫面（主頁分頁、沒有面板／視窗／動畫）時跳一件。
 *  UI.s.apMark 記這一旬上次檢查時的行動點數；UI.s.outGo 記出門（goTo）時的點數，用來選開頭那句。 */
const homeIdle=()=>UI.s.tab==='home'&&!UI.s.sheet&&$('#info-bd').classList.contains('hidden')&&$('#start').classList.contains('hidden')
  &&!(typeof FX!=='undefined'&&FX.busy)&&!(typeof VIS!=='undefined'&&VIS.busy)&&!(typeof BT!=='undefined'&&BT)&&!(typeof ENC!=='undefined'&&ENC);
let HOME_T=null;
function homeCheck(){
  HOME_T=null;
  if(!G||G.ended)return;
  const m=UI.s.apMark;
  if(!m||m.turn!==G.turn){UI.s.apMark={turn:G.turn,ap:G.ap};return}
  if(G.ap>=m.ap){m.ap=G.ap;return}
  if(!homeIdle())return;
  m.ap=G.ap;
  const o=UI.s.outGo,out=!!(o&&o.turn===G.turn&&G.ap<o.ap);UI.s.outGo=null;
  if(homeQ().some(e=>e.turn===G.turn))showHomeEvent(out?'home.evt.lead':'home.evt.leadShop');
}
const homeSoon=()=>{if(!HOME_T)HOME_T=setTimeout(homeCheck,60)};
{const _go=goTo;goTo=function(k){UI.s.outGo={ap:G.ap,turn:G.turn};_go(k)}}
{const _r=UI.render;UI.render=function(){_r.apply(this,arguments);homeSoon()}}
{const _h=UI.hideInfo;UI.hideInfo=function(){_h.apply(this,arguments);homeSoon()}}
{const _c=UI.closeSheet;UI.closeSheet=function(){_c.apply(this,arguments);homeSoon()}}

/* ═════ [07zy_branch] ═════ */
'use strict';
/* ======================= 暖簾分：大番頭到隔壁城開分號（第一百六十節） =======================
 *  - 提議（旬報後）：大番頭任職滿一年（以升任大番頭起算）、累計意外之財超過 10,000 兩、店裡現款多過他的累計意外之財、目前沒有經營中的分號。
 *    答應付 2,000 兩；回絕後這位大番頭不再提（e.noBranch）。
 *  - 答應後他離開商號，到本地區最近的另一座城開分號。分號不是人物：不能拜訪；名冊人物出身者從本城名單中消失（身分改為「分號東家」、移到分號城）。
 *  - 第一階段（回府時）：每旬 10% 來調一批隨機本業貨（約一旬的協議配額或穩定供貨線）；倉庫不夠只能回絕。給滿 10 次送 8,000～12,000 兩、進入第二階段；累計回絕 3 次分號倒閉。
 *  - 第二階段（回府時）：每旬 5% 送 3,000～5,000 兩，永遠持續。
 *  - 一次只能一家；倒閉後下一位符合條件的大番頭才能再開。數值 ODDS.branch；狀態 G.branch。 */
const branchName=()=>G.branch?UT('branch.name',{f:(SYS_BY_KEY[G.sysKey]||{}).firm||'',c:CITY(G.branch.cityId)?CITY(G.branch.cityId).name:'',n:G.branch.name}):'';
const branchOpen=()=>!!(G.branch&&!G.branch.closed);
/** 大番頭升任起算的年資。 */
const chiefTenure=e=>G.turn-(e.promotedAt!==undefined?e.promotedAt:e.since);
/** 本地區最近的另一座城（沒有就全國最近）。 */
function branchCity(){
  const a=homeCity(),d=ct=>Math.min(distTurns(a,ct,'land')||99,distTurns(a,ct,'sea')||99);
  const L=CITIES.filter(c=>c.id!==a.id),same=L.filter(c=>c.region_id===a.region_id);
  return (same.length?same:L).slice().sort((x,y)=>d(x)-d(y))[0];
}
/** 每旬：提議（旬報後）、分號來訪（回府時）。 */
function branchTick(log){
  const O=ODDS.branch,B=G.branch;
  if(branchOpen()){
    if(B.phase===1&&chance(O.visitP)){
      const L=tradeComms();if(L.length){const c=pick(L),q=Math.max(1,Math.round(Math.max(quotaOf(c.name),supplyLine(c.name))));queueHomeEvent({type:'branch',name:c.name,qty:q})}
    }else if(B.phase===2&&chance(O.payP))queueHomeEvent({type:'branchPay',amt:rint(O.payMin,O.payMax)});
    return;
  }
  const b=empsOf('chief')[0];
  if(!b||b.noBranch||b.fleeAt!==undefined||chiefTenure(b)<O.tenure||!((b.wind||0)>O.wind)||!(G.silver>(b.wind||0)))return;
  if(faceEventQueue().some(e=>e.type==='branchAsk'))return;
  queueFaceEvent({type:'branchAsk',empId:b.id,turn:G.turn});
}
/** 人物事件卡（07s_face_events.js 呼叫）：提議、調貨、送錢。 */
function branchCard(e){
  if(e.type==='branchAsk'){
    const b=(G.emps||[]).find(x=>x.id===e.empId);if(!b||branchOpen()||b.noBranch)return null;const c=branchCity();
    return {line:TX('branch.ask',{c:c.name}),effect:UT('branch.ask.d',{a:fmt(costOf('branchOpen')),c:c.name}),
      buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="branchYes" data-id="'+b.id+'" '+(afford('branchOpen')?'':'disabled')+'>'+UT('btn.branchYes',{c:coinHtml('silver',costOf('branchOpen'))})+'</button><button class="pixel-btn btn-sm" data-act="branchNo" data-id="'+b.id+'">'+UT('btn.branchNo')+'</button></div>'};
  }
  if(!branchOpen())return null;
  if(e.type==='branch'){
    const c=COMM_MAP[e.name];if(!c||G.branch.phase!==1)return null;const have=G.inv[e.name]||0;
    return {line:TX('branch.visit',{g:c.short,q:e.qty}),effect:UT('branch.visit.d',{g:c.short,q:e.qty,h:have,n:G.branch.given,r:G.branch.refused}),
      buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="branchGive" '+(have<e.qty?'disabled':'')+'>'+UT('btn.branchGive')+'</button><button class="pixel-btn btn-sm" data-act="branchRefuse">'+UT('btn.branchRefuse')+'</button></div>'};
  }
  if(e.type==='branchPay'){if(G.branch.phase!==2)return null;return {line:TX('branch.pay'),effect:UT('branch.pay.d',{a:fmt(e.amt)})}}
  return null;
}
/** 卡片頭部：分號沒有頭像（名冊人物出身的才有）。 */
function branchHead(e){
  if(e.type==='branchAsk'){const b=(G.emps||[]).find(x=>x.id===e.empId);return b?{pt:portraitEmp(b,56),name:b.name,tag:rankName(b.rank)}:null}
  const B=G.branch;return {pt:B&&B.cid&&CH(B.cid)?portraitHtml(B.cid,56):'',name:B?B.name:'',tag:branchName()};
}
ACT.branchYes=el=>{
  const b=(G.emps||[]).find(x=>x.id===el.dataset.id);if(!b||branchOpen()){UI.hideInfo();return}
  if(!afford('branchOpen')){toast(shortMsg('branchOpen'));return}
  spend('branchOpen');const c=branchCity();
  G.branch={name:b.name,cid:b.cid||null,cityId:c.id,phase:1,given:0,refused:0,since:G.turn,closed:false};
  G.emps=G.emps.filter(x=>x!==b);
  if(b.cid&&npc(b.cid)){const n=npc(b.cid);n.hired=false;n.cityId=c.id;n.role='branch';n.pos=null}   // 從本城名單中消失
  const t=NEWS('branch.open',{n:b.name,b:branchName()});pushNews(t);
  sfx.gift();UI.hideInfo();toast(MSG('branch.open',{n:b.name,c:c.name}),5200);UI.render();
};
ACT.branchNo=el=>{const b=(G.emps||[]).find(x=>x.id===el.dataset.id);if(b)b.noBranch=true;UI.hideInfo();toast(MSG('branch.no',{n:b?b.name:''}),3600);UI.render()};
/** 目前顯示中的分號調貨事件（回府時）。 */
let BRANCH_EV=null;
ACT.branchGive=()=>{
  const e=BRANCH_EV,B=G.branch;if(!e||!branchOpen()||B.phase!==1){UI.hideInfo();return}
  if((G.inv[e.name]||0)<e.qty){toast(MSG('branch.short'));return}
  stockTake(e.name,e.qty,false);B.given++;BRANCH_EV=null;
  let msg=MSG('branch.given',{n:B.name});
  if(B.given>=ODDS.branch.times){
    const amt=rint(ODDS.branch.repayMin,ODDS.branch.repayMax);G.silver+=amt;G.carryIn=G.carryIn||{};G.carryIn.branch=(G.carryIn.branch||0)+amt;B.phase=2;
    pushNews(NEWS('branch.repay',{b:branchName(),a:fmt(amt)}));msg=MSG('branch.repay',{n:B.name,a:fmt(amt)});sfx.coin();
  }
  UI.hideInfo();toast(msg,4600);UI.render();
};
ACT.branchRefuse=()=>{
  const B=G.branch;BRANCH_EV=null;if(!branchOpen()){UI.hideInfo();return}
  B.refused++;let msg=MSG('branch.refused',{n:B.name});
  if(B.refused>=ODDS.branch.refuse){B.closed=true;pushNews(NEWS('branch.closed',{b:branchName()}));msg=MSG('branch.closed',{n:B.name})}
  UI.hideInfo();toast(msg,4600);UI.render();
};

/* ═════ [07zz_reassign] ═════ */
/* 改派（第三百三十六節）：手代、番頭改當船長或飛腳；船長、飛腳上岸當手代或番頭。
 * 能力門檻沿用延攬（ODDS.enlist.stat）；好感 ≥ ODDS.reassign.aff；改派後 cool 旬內不能再調。
 * 船跟著人：第一次當船長付造船費，之後 e.ship=true，上岸再調回不用再付。年資（since）照算，改派不算升遷。 */
const RE_FROM_IN=['clerk','banto'],RE_FROM_DOCK=['captain','courier'];
/** 這個人能改派到哪些職位（不論條件是否滿足）。 */
const reTargets=e=>RE_FROM_IN.includes(e.rank)?RE_FROM_DOCK:RE_FROM_DOCK.includes(e.rank)?RE_FROM_IN:[];
/** 有沒有自己的船。 */
const reHasShip=e=>!!e.ship||e.rank==='captain';
/** 人在外頭：在途採買、走私、出運清單、借出、受傷、入獄。 */
function reBusy(e){
  return G.ships.some(s=>s.capt===e.id)||(G.smug||[]).some(v=>v.capt===e.id)||(G.voyQueue||[]).some(q=>q.capt===e.id)
    ||(G.lent&&G.lent.empId===e.id)||empLent(e)||jailedEmp(e);
}
/** 新職位的工錢（照聘用公式）。 */
const reWage=(e,rk)=>Math.round(RANK_WAGE[rk]*(e.cid?(0.8+CH(e.cid).derived_stats.commerce_skill/150):1));
/** 改派到 rk 的阻擋理由；可以改派回傳 ''。 */
function reBlock(e,rk){
  const O=ODDS.reassign,s=statsOfEmp(e),need=(ODDS.enlist.stat||{})[rk]||{};
  if(e.reT!==undefined&&G.turn-e.reT<O.cool)return UT('re.no.cool',{n:O.cool-(G.turn-e.reT)});
  if(reBusy(e))return UT('re.no.busy');
  if(empAff(e)<O.aff)return UT('re.no.aff',{v:O.aff});
  if(!slotFree(rk))return UT('re.no.slot',{r:rankName(rk)});
  for(const [k,v] of Object.entries(need))if((s[k]||0)<v)return UT('re.no.stat',{s:statName(k),v});
  if(rk==='banto'&&RE_FROM_DOCK.includes(e.rank)&&G.turn-e.since<O.bantoTenure)return UT('re.no.tenure',{n:O.bantoTenure});
  if(rk==='captain'&&!reHasShip(e)&&G.silver<shipCost())return UT('re.no.silver');
  return '';
}
/** 店員卡、碼頭卡上的「改派」按鈕。 */
function reBtn(e){
  if(!reTargets(e).length)return '';
  return '<button class="pixel-btn btn-sm" data-act="reOpen" data-id="'+e.id+'">'+UT('btn.reassign')+'</button>';
}
/** 改派視窗。 */
function reHtml(e){
  let h='<p class="small">'+UT('re.lead',{n:ODDS.reassign.cool})+'</p><div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">';
  reTargets(e).forEach(rk=>{
    const why=reBlock(e,rk);
    let sub=UT('re.wage',{a:reWage(e,rk)});
    if(rk==='captain')sub+='；'+(reHasShip(e)?UT('re.ship.own'):UT('re.ship.pay',{a:fmt(shipCost())}));
    if(e.rank==='captain')sub+='；'+UT('re.ship.keep');
    h+='<button class="pixel-btn'+(why?'':' btn-gold')+'" style="padding:8px;text-align:left"'+(why?' disabled':'')+' data-act="reGo" data-id="'+e.id+'" data-rk="'+rk+'"><b>'+UT('re.opt',{r:rankName(rk)})+'</b><div class="tiny">'+(why?esc(why):sub)+'</div></button>';
  });
  return h+'</div>';
}
ACT.reOpen=el=>{const e=G.emps.find(x=>x.id===el.dataset.id);if(!e)return;UI.showInfo(UT('re.title',{n:esc(e.name)}),reHtml(e));sfx.tap()};
ACT.reGo=el=>{
  const e=G.emps.find(x=>x.id===el.dataset.id),rk=el.dataset.rk;if(!e||!reTargets(e).includes(rk))return;
  const why=reBlock(e,rk);if(why){toast(why);return}
  const from=e.rank;let msg;
  if(rk==='captain'&&!reHasShip(e)){const a=spendAmt('shipBuild',shipCost());msg=MSG('re.doneShip',{n:e.name,r:rankName(rk),a:fmt(a)})}
  if(from==='captain')e.ship=true;
  if(rk==='captain')e.ship=true;
  e.rank=rk;e.wage=reWage(e,rk);e.reT=G.turn;
  if(RE_FROM_IN.includes(rk))e.promotedAt=G.turn;                 // 上岸後下一次升遷從改派起算
  if(!msg)msg=from==='captain'?MSG('re.doneDock',{n:e.name,r:rankName(rk)}):MSG('re.done',{n:e.name,r:rankName(rk)});
  if(G.voyQueue)voyQPrune();
  UI.hideInfo();toast(msg,3600);sfx.coin();UI.render();refreshSheet();
};
