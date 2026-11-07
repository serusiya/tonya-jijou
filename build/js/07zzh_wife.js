'use strict';
/* =====================================================================
 * 07zzh_wife.js — 夫人事件（DESIGN_NOTES 第二百一十六節）
 *  - 好事：每年一定一件，不分出身。街坊捧場（本業最便宜的貨兩旬好賣）、井邊風聲（免費買付風聲）、
 *    暗中追討（要回揩油最多那人的錢，不算查帳）、娘家遞消息（風聲 -1）。
 *  - 壞事：依出身各一種，成親滿兩季後才有，每年最多一件（ODDS.wife.badP），一位夫人一生最多三件。
 *    町人之女＝店員欺負夫人；商人之女＝夫人與大番頭爭執；官員之女＝一階官員來找夫人舊情復燃。
 *    只有「幫夫人」「視而不見」兩個選項。幫夫人：當年添丁機率提高（G.family.birthBonus，年底擲完歸零）。
 *    第一次視而不見只有一句警告；連續兩次，夫人離家出走：知名度 -5、瓦版與番付八卦。孩子留下，之後可以再娶。
 *  - 排程存在 G.wifeEv={key,y,good,bad,goodDone,badDone,cur}；回府時跳出（07zx_homeevt.js），沒輪到的下一旬再排。
 *    壞事見過卻沒選就關掉：下一旬推進時視為視而不見。
 *  數值 ODDS.wife；文字 01e（wife.*）、01f（wife.*）、01g（wife.*）。
 * ===================================================================== */
const WIFE_BAD={commoner:'bully',rival:'quarrel',official:'flame'};
const wifeKey=sp=>sp?sp.name+'|'+(sp.since||0):'';
/** 夫人頭像（同一位夫人外貌固定）。 */
function portraitWife(sp,px){
  const key='edo3|wife|'+sp.name,o={seed:'wife'+sp.name,gender:'f',age:Math.max(16,G.year-sp.birthYear),role:'guest',cloth:'#c46a8a',st:{}};
  const size=px||48;
  return '<img class="pt" src="'+(PT_CACHE[key]||(PT_CACHE[key]=ptDraw(o)))+'" width="'+size+'" height="'+size+'" alt="" aria-hidden="true">';
}
/** 排定本年度（從本旬起到年底）的好事與壞事旬。成親、換年、舊存檔都會重排。 */
function wifePlan(){
  const sp=G.family.spouse;if(!sp){G.wifeEv=null;return}
  const O=ODDS.wife,left=(12-G.month)*3+(3-G.cycle),start=G.turn,since=sp.since||0;
  const good=start+rint(0,left);
  const L=[];for(let t=start;t<=start+left;t++)if(t-since>=O.badAfter)L.push(t);
  const bad=(sp.bad||0)<O.badMax&&L.length&&chance(O.badP)?pick(L):null;
  G.wifeEv={key:wifeKey(sp),y:G.year,good,bad,goodDone:false,badDone:bad===null,cur:null};
}
/** 推進一旬（日期前進後）：上旬見過沒選的壞事＝視而不見；到期的事排進回府時。 */
function wifeTick(log){
  const W=G.wifeEv;
  if(W&&W.cur&&W.cur.bad&&W.cur.shown&&!W.cur.done){const m=wifeResolve(false);if(m){const t=NEWS('wife.auto',{m});pushNews(t);log.push(t)}}
  if(W)W.cur=null;
  const sp=G.family.spouse;
  if(!sp||(G.exile||0)>0||G.ended)return;
  if(!G.wifeEv||G.wifeEv.y!==G.year||G.wifeEv.key!==wifeKey(sp))wifePlan();
  const V=G.wifeEv;if(!V)return;
  if(!V.badDone&&V.bad<=G.turn){const c=wifeBadPick(sp);if(c){V.cur=c;queueHomeEvent({type:'wifeBad'});return}V.badDone=true}
  if(!V.goodDone&&V.good<=G.turn){V.cur={good:true,kind:wifeGoodPick()};queueHomeEvent({type:'wifeGood'})}
}
/** 壞事的對象；找不到就這一年不發生。 */
function wifeBadPick(sp){
  const kind=WIFE_BAD[sp.kind]||'bully';
  if(kind==='bully'){
    const L=G.emps.filter(e=>['apprentice','clerk','banto'].includes(e.rank)&&!jailedEmp(e)&&!sevAway(e));if(!L.length)return null;
    const sc=e=>{const s=statsOfEmp(e);return s.greed_index-s.integrity_loyalty};
    return {bad:true,kind,empId:L.slice().sort((a,b)=>sc(b)-sc(a))[0].id};
  }
  if(kind==='quarrel'){const e=G.emps.find(x=>x.rank==='chief'&&!jailedEmp(x)&&!sevAway(x));return e?{bad:true,kind,empId:e.id}:null}
  const L=officialsOf(G.cityId).filter(n=>n.pos&&n.pos.rank===1&&!n.ronin&&alive(n.cid)&&!jailed(n)&&CH(n.cid).gender!=='f');
  return L.length?{bad:true,kind,cid:pick(L).cid}:null;
}
/** 好事：每年一定一件；條件不合的不抽。 */
function wifeGoodPick(){
  const L=['fans'];
  if(buyoutIntelNext())L.push('intel');
  if(G.emps.some(e=>(e.skim||0)>=1))L.push('recover');
  if((G.heat||0)>=1)L.push('heat');
  return pick(L);
}
/** 本業最便宜的貨（街坊捧場的那一樣）。 */
const wifeCheapest=()=>ownComms().slice().sort((a,b)=>a.base-b.base)[0];
/** 街坊捧場的需求倍率（03_market.js 的 demandEff）。 */
const wifeMult=c=>G&&G.wifeFans&&G.turn<=G.wifeFans.until&&c.name===G.wifeFans.name?ODDS.wife.fansMult:1;
/** 好事生效（回府時跳出那一刻）；回傳效果說明。 */
function wifeGoodApply(kind){
  const O=ODDS.wife;
  if(kind==='fans'){const c=wifeCheapest();if(!c)return '';G.wifeFans={name:c.name,until:G.turn+O.fansTurns-1};return UT('wife.good.fans.eff',{g:xName(c.name),t:O.fansTurns})}
  if(kind==='intel'){const I=buyoutIntelNext();if(!I)return UT('wife.good.intel.none');buyoutDiscover(I.y,I.rid,I.m);return UT('wife.good.intel.eff',{r:REG_NAME(I.rid),m:buyoutMonth(I.m)})}
  if(kind==='recover'){
    const e=G.emps.filter(x=>(x.skim||0)>=1).sort((a,b)=>b.skim-a.skim)[0];if(!e)return UT('wife.good.recover.none');
    const amt=Math.round(e.skim);e.skim=0;G.silver+=amt;G.carryIn=G.carryIn||{};G.carryIn.windfall=(G.carryIn.windfall||0)+amt;sfx.coin();
    pushNews(NEWS('wife.recover',{a:fmt(amt)}));
    return UT('wife.good.recover.eff',{a:fmt(amt)});
  }
  if(kind==='heat'){G.heat=Math.max(0,(G.heat||0)-O.heatCut);return UT('wife.good.heat.eff',{a:O.heatCut})}
  return '';
}
/** 回府時事件卡。 */
function wifeCard(e){
  const sp=G.family.spouse,W=G.wifeEv,C=W&&W.cur;if(!sp||!C)return null;
  const head=(line,effect,buttons)=>'<div class="card warn" style="display:flow-root">'+portraitWife(sp,56)+'<div><b style="font-size:17px">'+esc(sp.name)+'</b> <span class="tag gray">'+UT('face.faceEventCard.12',{a:esc(UT('wife.tag')),b:esc(line),c:esc(effect)})+'</div>'+(buttons||UT('face.buttons'))+'</div>';
  if(e.type==='wifeGood'){
    if(!C.good)return null;
    if(C.eff===undefined){C.eff=wifeGoodApply(C.kind);W.goodDone=true}
    return head(UT('wife.good.'+C.kind,{g:G.wifeFans?xName(G.wifeFans.name):''}),C.eff);
  }
  if(!C.bad||C.done)return null;
  const v=wifeVars(C);if(!v)return null;
  C.shown=true;
  return head(UT('wife.bad.'+C.kind,v),UT('wife.bad.'+C.kind+'.ask',v),
    '<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="wifeHelp">'+UT('btn.wifeHelp.'+C.kind)+'</button><button class="pixel-btn btn-sm" data-act="wifeIgnore">'+UT('btn.wifeIgnore.'+C.kind)+'</button></div>');
}
/** 壞事文字用的變數（對象已不在就不發生）。 */
function wifeVars(C){
  if(C.empId){const e=G.emps.find(x=>x.id===C.empId);return e?{n:e.name,k:rankName(e.rank)}:null}
  if(C.cid){const n=npc(C.cid);return n&&alive(C.cid)?{n:nameOf(C.cid),k:posTitle(n)}:null}
  return null;
}
/** 結算壞事：help＝幫夫人。回傳給玩家看的一句話。 */
function wifeResolve(help){
  const W=G.wifeEv,C=W&&W.cur,sp=G.family.spouse;if(!C||!C.bad||C.done||!sp)return null;
  const O=ODDS.wife,v=wifeVars(C)||{n:'',k:''};
  C.done=true;W.badDone=true;sp.bad=(sp.bad||0)+1;
  const e=C.empId&&G.emps.find(x=>x.id===C.empId);
  if(help){
    sp.ign=0;
    if(C.kind==='bully'&&e){
      G.emps=G.emps.filter(x=>x!==e);if(e.cid&&npc(e.cid))npc(e.cid).hired=false;
      G.emps.forEach(x=>{x.aff=clamp(empAff(x)-O.bullyOthers,0,100)});
      pushNews(NEWS('wife.bullyOut',{n:v.n,k:v.k}));
    }else if(C.kind==='quarrel'&&e)e.aff=clamp(empAff(e)-O.quarrelAff,0,100);
    else if(C.kind==='flame'&&C.cid)setAff(R(C.cid),Math.max(0,R(C.cid).aff-O.flameAff));
    G.family.birthBonus=Math.min(O.birthCap,(G.family.birthBonus||0)+O.birthUp);
    return MSG('wife.help.'+C.kind,v)+MSG('wife.happy');
  }
  if(C.kind==='bully'&&e)e.boldUntil=Math.max(e.boldUntil||0,G.turn+O.boldTurns);
  else if(C.kind==='quarrel'&&e)e.aff=clamp(empAff(e)+O.chiefUp,0,100);
  sp.ign=(sp.ign||0)+1;
  if(sp.ign>=O.leaveAfter)return MSG('wife.ign.'+C.kind,v)+wifeLeave();
  return MSG('wife.ign.'+C.kind,v)+MSG('wife.warn');
}
/** 夫人離家出走：孩子留下；知名度下降；瓦版與下一期番付的八卦。 */
function wifeLeave(){
  const sp=G.family.spouse;if(!sp)return '';
  G.family.exWives=(G.family.exWives||[]).concat([{name:sp.name,kind:sp.kind,left:G.turn}]);
  G.family.spouse=null;G.wifeEv=null;G.wifeGone={t:G.turn,name:sp.name};
  setFame((G.fame||0)-ODDS.wife.leaveFame);
  pushNews(NEWS('wife.left',{name:G.me.name,w:sp.name}));
  return MSG('wife.left',{w:sp.name,f:ODDS.wife.leaveFame});
}
ACT.wifeHelp=()=>{const m=wifeResolve(true);UI.hideInfo();if(m){sfx.coin();toast(m,4600)}UI.render()};
ACT.wifeIgnore=()=>{const m=wifeResolve(false);UI.hideInfo();if(m)toast(m,4600);UI.render()};
FACE_TITLE.wifeGood='wife.title.good';FACE_TITLE.wifeBad='wife.title.bad';
{const _s=showHomeEvent;showHomeEvent=function(lead){const e=homeQ().find(x=>x.turn===G.turn);return _s(e&&(e.type==='wifeGood'||e.type==='wifeBad')?'wife.lead':lead)}}   // 夫人事件換一句開頭
{const _f=faceEventCard;faceEventCard=function(e){return e&&(e.type==='wifeGood'||e.type==='wifeBad')?wifeCard(e):_f(e)}}
