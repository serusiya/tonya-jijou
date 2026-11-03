'use strict';
/* ======================= 人情往來與朋友事件（第一百六十八、一百七十節） =======================
 *  一、人情往來（回府時事件，07zx_homeevt.js）：
 *     - 好感 80 以上的同業出事（失火、遭竊、船貨遇難）：可去慰問，扣 1 行動點數、付中檔禮金，好感 +4～8；不理沒有後果。
 *     - 好感 80 以上的同業新貨滿載入港：請你去慶功宴，扣 1 行動點數，好感 +4～8；不理沒有後果。
 *     - 你出事（倉庫失火、遭竊、遇襲傷癒）：好感 80 以上的人最多三位上門慰問，只寫敘事，好感小加。
 *  二、朋友來借東西（旬報後事件）：倉庫、船長、飛腳連續三旬閒置一半以上時，好感 80 以上的商人朋友上門借用；婉拒好感 −10；冷卻 12 旬。
 *     借倉庫：寄放一批貨幾旬（佔倉位），期滿付寄放費；夾了違禁品而沒出事的，另付一筆謝禮。
 *     借船長飛腳：跑一趟 2～4 旬，回來付酬勞；照擲遇險，可能受傷；對方拿去走私的，可能在港口被扣。
 *  二之二、向朋友借倉庫：推進時有貨因倉位放不下，五成機會有朋友願意先替你放（保管費一成、容量一棟、三旬內搬回，沒搬完照市價七成賣掉）。
 *  三、好感 100 的商人朋友：拜訪時兩成機會講出本城一位官員的軟肋（算證實）。
 *  四、旅商換貨：倉裡有他行貨時，每旬 3% 有旅商人上門想換；可能換到本業貨或別的他行貨，偶爾是次貨或夾帶違禁品。
 *  出事（寄放的違禁品碰上查貨或搜查、借出的船長被扣、換來的貨夾帶違禁品）：不供出＝當成你的違禁品受罰；供出朋友＝只罰他，他對你好感 −40。
 *  數值 ODDS.favor80、ODDS.lend、ODDS.stash、ODDS.friendTip、ODDS.swap；文字 fr.*（01e、01f、01g）。
 *  狀態：G.idle、G.lendOffer、G.lodge、G.lent、G.overflow、G.stashOffer、G.stash、G.swapOffer、G.taints、G.bust、G.consolePend。 */
const MERCHANT_ROLES=['rival','guest','broker','manager','smuggler'];
const isMerchantNpc=n=>!!n&&!n.pos&&MERCHANT_ROLES.includes(n.role);
/** 本城好感 80 以上的人；merchant＝只算商人。 */
function closeFriends(merchant){
  const A=ODDS.favor80.aff;
  return Object.values(G.world.npcs).filter(n=>n.cityId===G.cityId&&alive(n.cid)&&!isEnemy(n.cid)&&G.rel[n.cid]&&G.rel[n.cid].aff>=A&&!G.emps.some(e=>e.cid===n.cid)
    &&!['concubine','branch'].includes(n.role)&&(!merchant||isMerchantNpc(n))&&!(n.role==='official'&&awayNow(n)));
}
/** 借出或受傷養息中的船長飛腳（不能接委託、走私）。 */
const empLent=e=>!!e&&((e.lentUntil||0)>G.turn||(e.hurtUntil||0)>G.turn);
const addAffTo=(cid,d)=>{const r=R(cid);setAff(r,clamp(r.aff+d,0,100));return r};
/** 藏在別處的違禁品（寄放、換貨夾帶）：數量與價值，搜查機率也算進去。 */
const taintList=()=>G.taints||(G.taints=[]);
const hiddenContraQty=()=>taintList().reduce((a,t)=>a+t.q,0);
const hiddenContraValue=()=>taintList().reduce((a,t)=>a+t.q*(SMUG_BY[t.k]?SMUG_BY[t.k].sell:0),0);
const lodgeQty=()=>(G&&G.lodge&&G.lodge.q)||0;
const contraLot=()=>({k:pick(SMUG_ITEMS).k,q:rint(3,8)});
const lendContraP=cid=>{const n=npc(cid);return n&&n.role==='smuggler'?ODDS.lend.contraSmug:ODDS.lend.contra};

/* ---------- 一、人情往來 ---------- */
/** 同業突發事件（msTick 呼叫）：bad＝fire／theft／wreck；好感 80 以上的同業排進回府時事件；寄放在他家的貨一起受損。回傳是否一定要上旬報。 */
function rivalEventHook(n,good,bad,log){
  const r=G.rel[n.cid],fr=!!(r&&r.met&&r.aff>=ODDS.favor80.aff&&!isEnemy(n.cid));
  if(fr)queueHomeEvent({type:good?'feast':'condole',cid:n.cid,kind:bad||''});
  if(!good)stashHit(n.cid,bad,log);
  return fr;
}
FACE_TITLE.condole='fr.title.condole';FACE_TITLE.feast='fr.title.feast';
FACE_EXT.condole=(e,name)=>{
  if(!alive(e.cid))return null;
  const amt=btTiers(e.cid)[1],noAP=apLeft()<=0;
  return {line:UT('fr.condole.'+(e.kind||'fire'),{n:name}),effect:UT('fr.condole.ask'),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="frCondole" data-cid="'+e.cid+'" '+(G.silver<amt||noAP?'disabled':'')+'>'+UT('btn.frCondole',{c:coinHtml('silver',amt)})+'</button><button class="pixel-btn btn-sm" data-act="frSkip">'+UT('btn.frSkip')+'</button></div>'};
};
FACE_EXT.feast=(e,name)=>{
  if(!alive(e.cid))return null;
  return {line:UT('fr.feast',{n:name}),effect:UT('fr.feast.ask'),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="frFeast" data-cid="'+e.cid+'" '+(apLeft()<=0?'disabled':'')+'>'+UT('btn.frFeast')+'</button><button class="pixel-btn btn-sm" data-act="frSkip">'+UT('btn.frSkip')+'</button></div>'};
};
const frGain=()=>rint(ODDS.favor80.gainMin,ODDS.favor80.gainMax);
ACT.frCondole=el=>{
  const cid=el.dataset.cid,amt=btTiers(cid)[1];
  if(G.silver<amt){toast(MSG('buyGoods.5',{cost:fmt(amt)}));return}
  if(!spendAP()){toast(MSG('fr.noAP'));return}
  payPublic('spend.condole|'+cid,amt);const g=frGain();addAffTo(cid,g);
  logRel(cid,UT('fr.log.condole',{a:amt,g}));sfx.gift();UI.hideInfo();toast(MSG('fr.condole',{n:nameOf(cid),a:fmt(amt),g}),4200);UI.render();
};
ACT.frFeast=el=>{
  const cid=el.dataset.cid;if(!spendAP()){toast(MSG('fr.noAP'));return}
  const g=frGain();addAffTo(cid,g);logRel(cid,UT('fr.log.feast',{g}));sfx.gift();UI.hideInfo();toast(MSG('fr.feast',{n:nameOf(cid),g}),4200);UI.render();
};
ACT.frSkip=()=>UI.hideInfo();
SPEND_ARG['spend.condole']=a=>nameOf(a);
/** 你出事：記下來，旬末由朋友上門慰問。kind：fire／theft／heal。 */
function consoleNote(kind){if(G)G.consolePend=G.consolePend||kind}
function consoleTick(log){
  const k=G.consolePend;G.consolePend=null;if(!k)return;
  const L=shuffle(closeFriends(false)).slice(0,ODDS.favor80.visitMax);if(!L.length)return;
  L.forEach(n=>{addAffTo(n.cid,rint(ODDS.favor80.visitGainMin,ODDS.favor80.visitGainMax));logRel(n.cid,UT('fr.log.visit.'+k))});
  const t=NEWS('fr.visit.'+k,{n:L.map(n=>nameOf(n.cid)).join(UT('voy.voyagePanel.9'))});pushNews(t);log.push(t);
}

/* ---------- 二、朋友來借東西 ---------- */
const LEND_RANK={captain:'captain',courier:'courier'};
const lendMode=k=>k==='captain'?'sea':'land';
/** 每旬：記閒置的連續旬數；滿三旬就有朋友上門借。 */
function lendIdleTick(log){
  const I=G.idle||(G.idle={wh:0,captain:0,courier:0,cd:0}),O=ODDS.lend;
  const busy=new Set(G.ships.map(s=>s.capt).concat(smugList().map(v=>v.capt)));
  const crewIdle=rank=>{const L=G.emps.filter(e=>e.rank===rank);return L.length>1&&L.filter(e=>!busy.has(e.id)&&!empLent(e)&&!jailedEmp(e)).length>L.length/2};
  I.wh=G.wh.n>1&&invUsed()/Math.max(1,invCap())<0.5?I.wh+1:0;
  I.captain=crewIdle('captain')?I.captain+1:0;
  I.courier=crewIdle('courier')?I.courier+1:0;
  if(G.turn<I.cd||G.lendOffer||G.lodge||G.lent||(G.exile||0)>0)return;
  const ready=['wh','captain','courier'].filter(k=>I[k]>=O.idleTurns);if(!ready.length)return;
  const F=closeFriends(true);if(!F.length)return;          // 沒有朋友：計數不歸零，下一旬再看
  const n=pick(F),kind=pick(ready),contra=chance(lendContraP(n.cid));
  let o={cid:n.cid,kind,turn:G.turn,contra:contra?contraLot():null};
  if(kind==='wh'){
    const room=invCap()-invUsed()-pendingQty(),q=Math.floor(room*(O.lodgeShareMin+rnd()*(O.lodgeShareMax-O.lodgeShareMin)));
    const pool=otherComms().filter(c=>!c.luxury);if(q<5||!pool.length)return;
    const c=pick(pool),t=rint(O.lodgeMin,O.lodgeMax);
    Object.assign(o,{name:c.name,q,t,fee:Math.max(O.lodgeFeeMin,Math.round(q*c.base*O.lodgeFeeRate))});
  }else{
    const e=idleCaptains(lendMode(kind))[0];if(!e)return;
    const F2=kind==='captain'?O.feeSea:O.feeLand;
    Object.assign(o,{empId:e.id,t:rint(O.crewMin,O.crewMax),fee:rint(F2[0],F2[1])});
  }
  o.hint=o.contra?chance(0.7):chance(0.1);                  // 事前的暗示：多半是真的，偶爾是誤會
  G.lendOffer=o;I.wh=I.captain=I.courier=0;I.cd=G.turn+O.cd;
  queueFaceEvent({type:'lend',cid:n.cid,turn:G.turn});
  log.push(NEWS('fr.lend.news',{n:nameOf(n.cid)}));
}
FACE_TITLE.lend='fr.title.lend';
FACE_EXT.lend=(e,name)=>{
  const o=G.lendOffer;if(!o||o.turn!==e.turn||o.cid!==e.cid)return null;
  let line;
  if(o.kind==='wh')line=UT('fr.lend.wh',{n:name,g:xName(o.name),q:o.q,t:o.t,a:fmt(o.fee)});
  else{const em=G.emps.find(x=>x.id===o.empId);if(!em||empLent(em))return null;line=UT('fr.lend.crew',{n:name,m:NM('crew',lendMode(o.kind)),e:em.name,t:o.t,a:fmt(o.fee)})}
  return {line,effect:UT('fr.lend.ask',{d:ODDS.lend.refuseAff,h:o.hint?UT(o.kind==='wh'?'fr.hint.wh':'fr.hint.crew'):''}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="lendYes">'+UT('btn.lendYes')+'</button><button class="pixel-btn btn-sm" data-act="lendNo">'+UT('btn.lendNo')+'</button></div>'};
};
ACT.lendYes=()=>{
  const o=G.lendOffer;G.lendOffer=null;if(!o){UI.hideInfo();return}
  if(o.kind==='wh'){
    if(invCap()-invUsed()<o.q){toast(MSG('fr.lend.full'));UI.hideInfo();return}
    G.lodge={cid:o.cid,name:o.name,q:o.q,until:G.turn+o.t,fee:o.fee,contra:!!o.contra};
    if(o.contra)taintList().push({src:'lodge',cid:o.cid,k:o.contra.k,q:o.contra.q,until:G.turn+o.t});
    toast(MSG('fr.lend.whOk',{n:nameOf(o.cid),g:xName(o.name),q:o.q,t:o.t}),4200);
  }else{
    const em=G.emps.find(x=>x.id===o.empId);if(!em||empLent(em)){toast(MSG('fr.lend.gone'));UI.hideInfo();return}
    em.lentUntil=G.turn+o.t;voyQPrune();
    G.lent={cid:o.cid,empId:em.id,mode:lendMode(o.kind),until:G.turn+o.t,d:o.t,fee:o.fee,contra:o.contra};
    toast(MSG('fr.lend.crewOk',{n:nameOf(o.cid),e:em.name,t:o.t}),4200);
  }
  logRel(o.cid,UT('fr.log.lend'));sfx.tap();UI.hideInfo();UI.render();
};
ACT.lendNo=()=>{
  const o=G.lendOffer;G.lendOffer=null;
  if(o){const r=R(o.cid);setAff(r,Math.max(0,r.aff-ODDS.lend.refuseAff));logRel(o.cid,UT('fr.log.refuse',{d:ODDS.lend.refuseAff}));toast(MSG('fr.lend.no',{n:nameOf(o.cid),d:ODDS.lend.refuseAff}),4200)}
  UI.hideInfo();UI.render();
};
/** 每旬：寄放期滿、借出的人回來。 */
function lendReturnTick(log){
  const O=ODDS.lend,L=G.lodge;
  if(L&&G.turn>=L.until){
    const thanks=L.contra&&!L.busted?L.fee:0;G.silver+=L.fee+thanks;addAffTo(L.cid,O.okAff);logRel(L.cid,UT('fr.log.lodgeDone'));
    const t=NEWS(thanks?'fr.lodge.doneThanks':'fr.lodge.done',{n:nameOf(L.cid),g:xName(L.name),a:fmt(L.fee),b:fmt(thanks)});pushNews(t);log.push(t);
    G.lodge=null;G.taints=taintList().filter(x=>x.src!=='lodge');
  }
  const B=G.lent;
  if(B&&G.turn>=B.until){
    G.lent=null;const em=G.emps.find(x=>x.id===B.empId);
    if(!em){return}
    em.lentUntil=0;
    const hurt=chance(voyRisk(em,B.d,B.mode));
    if(hurt)em.hurtUntil=G.turn+rint(O.hurtMin,O.hurtMax);
    G.silver+=B.fee;addAffTo(B.cid,O.okAff);em.aff=clamp(empAff(em)+O.crewAff,0,100);logRel(B.cid,UT('fr.log.lentDone'));
    const t=NEWS(hurt?'fr.lent.hurt':'fr.lent.done',{n:nameOf(B.cid),e:em.name,a:fmt(B.fee),m:NM('crew',B.mode),t:hurt?em.hurtUntil-G.turn:0});pushNews(t);log.push(t);
    if(B.contra&&B.mode==='sea'){
      const SZ=ODDS.smugSeize,p=clamp(SZ.perDanger*(SMUG_BY[B.contra.k].danger)+SZ.perHeat*(G.heat||0),SZ.min,SZ.max);
      if(chance(p)){em.jailUntil=G.turn+3;bustStart({src:'lend',cid:B.cid,k:B.contra.k,q:B.contra.q,empId:em.id},log)}
    }
  }
}

/* ---------- 二之二、放不下的貨先寄放朋友家 ---------- */
/** 推進時放不下的貨（大盤到貨、官船官荷捎帶）記下來，旬末看有沒有朋友願意代放。 */
function overflowAdd(name,q,unit,dapan){if(!(q>0)||!G)return;(G.overflow=G.overflow||[]).push({name,q,unit:unit||0,dapan:!!dapan})}
const stashQty=()=>G.stash?G.stash.items.reduce((a,x)=>a+x.q,0):0;
FACE_TITLE.stash='fr.title.stash';
FACE_EXT.stash=(e,name)=>{
  const o=G.stashOffer;if(!o||o.turn!==e.turn||o.cid!==e.cid)return null;
  const q=o.items.reduce((a,x)=>a+x.q,0),fee=stashFee(o.items),cap=G.wh.cap;
  return {line:UT('fr.stash',{n:name,g:o.items.map(x=>COMM_MAP[x.name].short+' × '+x.q).join(NAMES_SEP),q,c:cap,t:ODDS.stash.turns}),effect:UT('fr.stash.ask',{a:fmt(fee)}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="stashYes" '+(G.silver<fee?'disabled':'')+'>'+UT('btn.stashYes',{c:coinHtml('silver',fee)})+'</button><button class="pixel-btn btn-sm" data-act="stashNo">'+UT('btn.stashNo')+'</button></div>'};
};
function stashFee(items){let left=G.wh.cap;return Math.round(items.reduce((a,x)=>{const q=Math.min(x.q,left);left-=q;return a+q*COMM_MAP[x.name].base*ODDS.stash.feeRate},0))}
ACT.stashYes=()=>{
  const o=G.stashOffer;G.stashOffer=null;if(!o){UI.hideInfo();return}
  const fee=stashFee(o.items);if(G.silver<fee){toast(MSG('buyGoods.5',{cost:fmt(fee)}));return}
  payPublic('spend.stash|'+o.cid,fee);
  let left=G.wh.cap,lost=0;const items=[];
  o.items.forEach(x=>{const q=Math.min(x.q,left);left-=q;lost+=x.q-q;if(q>0){const y=items.find(z=>z.name===x.name);if(y){y.unit=(y.unit*y.q+x.unit*q)/(y.q+q);y.q+=q}else items.push({name:x.name,q,unit:x.unit,dapan:x.dapan})}});
  G.stash={cid:o.cid,items,until:G.turn+ODDS.stash.turns};
  logRel(o.cid,UT('fr.log.stash'));sfx.coin();UI.hideInfo();
  toast(MSG('fr.stash.ok',{n:nameOf(o.cid),q:items.reduce((a,x)=>a+x.q,0),a:fmt(fee),l:lost?MSG('fr.stash.lost',{n:lost}):''}),4600);UI.render();
};
ACT.stashNo=()=>{G.stashOffer=null;UI.hideInfo();toast(MSG('fr.stash.no'))};
/** 每旬：寄放在朋友家的貨，倉庫一有空位就搬回；期滿沒搬完的，朋友照市價七成代賣。再看本旬有沒有新的放不下。 */
function stashTick(log){
  const S=G.stash;
  if(S){
    let moved=0;
    S.items.forEach(x=>{
      const room=Math.max(0,Math.min(invCap()-invUsed(),itemCap(x.name)-(G.inv[x.name]||0))),q=Math.min(x.q,room);
      if(q>0){if(x.unit>0)addStock(x.name,q,x.unit);stockAdd(x.name,q,x.dapan);x.q-=q;moved+=q}
    });
    S.items=S.items.filter(x=>x.q>0);
    if(moved>0){const t=NEWS('fr.stash.back',{n:nameOf(S.cid),q:moved});pushNews(t);log.push(t)}
    if(!S.items.length)G.stash=null;
    else if(G.turn>=S.until){
      let amt=0,q=0;S.items.forEach(x=>{amt+=x.q*marketQuote(x.name)*ODDS.stash.sellRate;q+=x.q});amt=Math.round(amt);G.silver+=amt;
      const t=NEWS('fr.stash.sold',{n:nameOf(S.cid),q,a:fmt(amt)});pushNews(t);log.push(t);G.stash=null;
    }
  }
  const O=G.overflow||[];G.overflow=[];
  if(!O.length||G.stash||G.turn<(G.stashCd||0)||!chance(ODDS.stash.p))return;
  const F=closeFriends(true);if(!F.length)return;
  const n=pick(F);G.stashOffer={cid:n.cid,items:O,turn:G.turn};G.stashCd=G.turn+ODDS.stash.cd;
  queueFaceEvent({type:'stash',cid:n.cid,turn:G.turn});
}
/** 寄放的朋友家失火或遭竊：你的貨按比例一起損失。 */
function stashHit(cid,bad,log){
  const S=G.stash;if(!S||S.cid!==cid||(bad!=='fire'&&bad!=='theft'))return;
  const f=bad==='fire'?ODDS.stash.fireLoss:ODDS.stash.theftLoss;let lost=0;
  S.items.forEach(x=>{const l=Math.round(x.q*f);x.q-=l;lost+=l});S.items=S.items.filter(x=>x.q>0);if(!S.items.length)G.stash=null;
  if(lost>0){const t=NEWS('fr.stash.hit.'+bad,{n:nameOf(cid),q:lost});pushNews(t);log.push(t)}
}

/* ---------- 三、好感 100 的商人朋友講出官員軟肋 ---------- */
/** 拜訪結束時（battleEnd 呼叫）：回傳要接在對話後面的一句（沒有就空字串）。 */
function friendTip(cid){
  const n=npc(cid),r=G.rel[cid];if(!isMerchantNpc(n)||!r||r.aff<100||!chance(ODDS.friendTip.p))return '';
  const L=officialsOf(G.cityId).filter(o=>alive(o.cid)&&!(G.rel[o.cid]&&G.rel[o.cid].verified)&&CH(o.cid).weakness&&NAMES.weak[CH(o.cid).weakness]);
  if(!L.length)return '';
  const o=pick(L),ro=R(o.cid);ro.verified=true;
  logRel(o.cid,UT('fr.tip.log',{n:nameOf(cid),w:weakName(CH(o.cid).weakness)}));
  return UT('fr.tip',{o:nameOf(o.cid),w:weakName(CH(o.cid).weakness)});
}

/* ---------- 四、旅商換貨 ---------- */
function swapTick(log){
  const xs=Object.keys(G.xinv||{}).filter(k=>G.xinv[k]>0&&COMM_MAP[k]);
  if(!xs.length||(G.exile||0)>0||!chance(ODDS.swap.p))return;
  const gs=cityNpcs(G.cityId,'guest').filter(n=>alive(n.cid)&&!isEnemy(n.cid));if(!gs.length)return;
  const W=ODDS.swap,n=pick(gs),give=pick(xs),gq=G.xinv[give],gv=gq*COMM_MAP[give].base;
  const own=tradeComms(),useOwn=own.length&&chance(W.own);
  const pool=useOwn?own:otherComms().filter(c=>!c.luxury&&c.name!==give);if(!pool.length)return;
  const c=pick(pool),getq=Math.max(1,Math.round(gv*(W.ratioMin+rnd()*(W.ratioMax-W.ratioMin))/c.base));
  G.swapOffer={cid:n.cid,give,gq,get:c.name,getq,own:!!useOwn,poor:chance(W.poor),contra:chance(W.contra)?contraLot():null,turn:G.turn};
  queueFaceEvent({type:'swap',cid:n.cid,turn:G.turn});
  log.push(NEWS('fr.swap.news',{n:nameOf(n.cid)}));
}
FACE_TITLE.swap='fr.title.swap';
FACE_EXT.swap=(e,name)=>{
  const o=G.swapOffer;if(!o||o.turn!==e.turn||o.cid!==e.cid||!((G.xinv||{})[o.give]>=o.gq))return null;
  const gc=COMM_MAP[o.give],c=COMM_MAP[o.get];
  return {line:UT('fr.swap',{n:name,g:c.short,q:o.getq,b:fmt(o.getq*c.base),x:gc.short,y:o.gq,a:fmt(o.gq*gc.base),k:o.own?UT('fr.swap.own'):UT('fr.swap.oth')}),effect:UT('fr.swap.ask'),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="swapYes">'+UT('btn.swapYes')+'</button><button class="pixel-btn btn-sm" data-act="swapNo">'+UT('btn.swapNo')+'</button></div>'};
};
ACT.swapYes=()=>{
  const o=G.swapOffer;G.swapOffer=null;if(!o||!((G.xinv||{})[o.give]>=o.gq)){UI.hideInfo();return}
  const c=COMM_MAP[o.get],W=ODDS.swap;
  G.xinv[o.give]-=o.gq;if(G.xinv[o.give]<=0)delete G.xinv[o.give];
  let room=Math.max(0,invCap()-invUsed());if(o.own)room=Math.min(room,Math.max(0,itemCap(o.get)-(G.inv[o.get]||0)));
  let q=Math.min(o.getq,room);const full=o.getq-q;
  let poor=0;if(o.poor&&q>0){poor=Math.round(q*(W.poorMin+rnd()*(W.poorMax-W.poorMin)));q-=poor}
  if(q>0){
    if(o.own){addStock(o.get,q,o.gq*COMM_MAP[o.give].base/Math.max(1,q));stockAdd(o.get,q,false)}
    else{G.xinv[o.get]=(G.xinv[o.get]||0)+q}
  }
  if(o.contra)taintList().push({src:'swap',cid:o.cid,k:o.contra.k,q:o.contra.q,until:G.turn+W.contraTurns});
  logRel(o.cid,UT('fr.log.swap'));sfx.coin();UI.hideInfo();
  toast(MSG('fr.swap.ok',{g:c.short,q})+(poor?MSG('fr.swap.poor',{n:poor}):'')+(full?MSG('fr.swap.full',{n:full}):''),4600);UI.render();
};
ACT.swapNo=()=>{G.swapOffer=null;UI.hideInfo()};

/* ---------- 出事：供不供出朋友 ---------- */
/** 寄放或換來的違禁品碰上搜查（必定）或查貨（六成）時被翻出來。 */
function taintTick(log){
  G.taints=taintList().filter(t=>t.until>=G.turn);
  if(G.bust||!G.taints.length)return;
  const raided=!!G.raidNote,insp=!!(G.inspect&&G.inspect.turn===G.turn)&&chance(ODDS.lend.bustInspect);
  if(!raided&&!insp)return;
  const t=G.taints.shift();if(t.src==='lodge'&&G.lodge)G.lodge.busted=true;
  bustStart(t,log);
}
function bustStart(t,log){
  G.bust={src:t.src,cid:t.cid,k:t.k,q:t.q,empId:t.empId||null,turn:G.turn};
  queueFaceEvent({type:'bust',cid:t.cid,turn:G.turn});
  const x=NEWS('fr.bust.'+t.src,{n:nameOf(t.cid),g:SMUG_BY[t.k].name,q:t.q});pushNews(x);log.push(x);sfx.bad();
}
FACE_TITLE.bust='fr.title.bust';
FACE_EXT.bust=(e,name)=>{
  const B=G.bust;if(!B||B.turn!==e.turn||B.cid!==e.cid)return null;
  return {line:UT('fr.bust.'+B.src,{n:name,g:SMUG_BY[B.k].name,q:B.q}),effect:UT('fr.bust.ask',{d:ODDS.lend.betrayAff}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="bustShield">'+UT('btn.bustShield')+'</button><button class="pixel-btn btn-sm" data-act="bustBetray">'+UT('btn.bustBetray')+'</button></div>'};
};
/** 結算：shield＝不供出（當成你的違禁品受罰）；否則供出朋友。回傳給玩家看的一句。 */
function bustResolve(shield,log){
  const B=G.bust;G.bust=null;if(!B)return '';
  if(shield){
    contra()[B.k]=(contra()[B.k]||0)+B.q;doRaid('random',log||[]);
    logRel(B.cid,UT('fr.log.shield'));
    const N=G.raidNote;return MSG('fr.bust.shield',{n:nameOf(B.cid),r:N?N.title:''});
  }
  const r=R(B.cid);setAff(r,Math.max(0,r.aff-ODDS.lend.betrayAff));logRel(B.cid,UT('fr.log.betray',{d:ODDS.lend.betrayAff}));
  const n=npc(B.cid);if(n&&n.role==='rival'){const m=msOf(n);m.ev=Math.min(m.ev||1,0.7);m.evT=Math.max(m.evT||0,3)}
  if(B.empId){const em=G.emps.find(x=>x.id===B.empId);if(em)em.jailUntil=G.turn}
  return MSG('fr.bust.betray',{n:nameOf(B.cid),d:ODDS.lend.betrayAff});
}
ACT.bustShield=()=>{const m=bustResolve(true);UI.hideInfo();if(m)toast(m,4600);UI.render()};
ACT.bustBetray=()=>{const m=bustResolve(false);UI.hideInfo();if(m)toast(m,4600);UI.render()};

/* ---------- 每旬總入口（advanceTurn 最後、傷勢之後） ---------- */
function friendsTick(log){
  if(G.bust&&G.bust.turn<G.turn){const m=bustResolve(true,log);if(m){const t=NEWS('fr.bust.auto',{m});pushNews(t);log.push(t)}}   // 上旬沒選：視為不供出
  ['lendOffer','stashOffer','swapOffer'].forEach(k=>{if(G[k]&&G[k].turn<G.turn)G[k]=null});   // 上旬沒選：作廢
  lendReturnTick(log);
  stashTick(log);
  taintTick(log);
  lendIdleTick(log);
  swapTick(log);
  consoleTick(log);
}
