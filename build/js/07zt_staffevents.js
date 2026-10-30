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
const sevAway=e=>G.ships.some(s=>s.capt===e.id)||(G.smug||[]).some(v=>v.capt===e.id);
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
  if(G.staffEv&&!G.staffEv.done){const m=sevResolve(false);if(m){const t=NEWS('sev.auto',{m});pushNews(t);log.push(t)}}
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
  if(type==='poach'){const r=pick(rivalsHere());S.rival=r?r.cid:null}
  G.staffEv=S;queueFaceEvent({type:'staff',empId:e.id,turn:t});
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
