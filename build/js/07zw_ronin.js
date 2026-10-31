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
