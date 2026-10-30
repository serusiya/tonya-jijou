'use strict';
/* ======================= 聯合採購與出貨協議的擔保金與違約金分配 =======================
 *  - 參加協議（表態遵守或簽暗約）要押擔保金 1,000 兩（COSTS.guildBond）；開局即以守約立場參加，擔保金由開局贈送。
 *  - 參加協議者向大盤進貨享聯合採購價（市價九三折）；未參加者照市價（03_market.js 的 unitBuyCost）。
 *  - 自動續押：擔保金一直押在公會；每 9 旬一期（ODDS.guildBond.turns），期滿把本期沒收的違約金平分給守約者（你＋本期沒被抓的同業）。
 *  - 你被查獲超量（evalCartel）或退出協議：擔保金沒收，立場回到未參加；要重新加入協議須在例會時再押一次。
 *  - 同業：每家每旬 5% 超賣一項本業貨（ODDS.rivalShip.overRival，rivalSupply 擲骰），查獲規則與你守約時相同；被抓者擔保金沒收、三旬內市佔下降。
 *  - 狀態：G.cartel.bond（押著的金額，0＝沒押）、pEnd（本期結束旬）、pot（本期沒收的違約金）；同業的違約紀錄在 msOf(n).ovDec/ovItem/ovMul/caught。 */
/** 本期供給方針；舊存檔在補值前沿用原本的「以量制價」。 */
const cartelPolicy=()=>G.cartel&&G.cartel.policy==='normal'?'normal':'restrict';
const guildPolicyName=()=>cartelPolicy()==='normal'?'維持':'減供';
/** 是否已參加聯合採購與出貨協議（表態遵守或暗約）。 */
const guildMember=()=>G.cartel.state==='pledged'||G.cartel.state==='secret';
/** 舊存檔補欄位：已參加協議而沒有擔保金紀錄的，視為已押。 */
function guildEnsure(){
  const C=G.cartel;
  if(C.policy!=='normal'&&C.policy!=='restrict')C.policy='restrict';
  if(C.policyEnd===undefined)C.policyEnd=G.turn+ODDS.guildBond.turns;
  if(C.bond===undefined){C.bond=guildMember()?costOf('guildBond'):0;C.pot=0;if(C.bond)C.pEnd=G.turn+ODDS.guildBond.turns}
  if(guildMember()&&C.bond>0&&C.pEnd===undefined)C.pEnd=G.turn+ODDS.guildBond.turns;
}
/** 每九旬以各半機率決定下一期供給方針；改變方針時不沿用大番頭的舊出貨量。 */
function guildPolicyRoll(log){
  const C=G.cartel,prev=cartelPolicy();
  C.policy=chance(ODDS.guildPolicy.normal)?'normal':'restrict';
  if(C.policy!==prev)G.plan={}
  const key=C.policy==='normal'&&!guildMember()?'guild.policy.normalNone':'guild.policy.'+C.policy;
  const t=NEWS(key);pushNews(t);if(log)log.push(t);
}
/** 進入新旬後、刷新市場前決定新一期方針；上一旬玩家出貨已先按舊方針完成違約判定。 */
function guildPolicyTick(log){
  guildEnsure();const C=G.cartel;
  if(C.policyEnd!==undefined&&G.turn>=C.policyEnd){C.policyEnd+=ODDS.guildBond.turns;guildPolicyRoll(log)}
}
/** 押擔保金加入協議（新的一期從此刻算起）。inTurn＝推進一旬途中付（大番頭代席），記在本旬報告。 */
function guildJoin(inTurn){
  const C=G.cartel,amt=costOf('guildBond');
  if(inTurn){G.silver-=amt;if(TURNRP){TURNRP.inTurn=TURNRP.inTurn||{};TURNRP.inTurn['協議擔保金']=(TURNRP.inTurn['協議擔保金']||0)+amt}}
  else spend('guildBond');
  C.bond=amt;C.pEnd=G.turn+ODDS.guildBond.turns;C.pot=0;
  rivalsHere().forEach(n=>{msOf(n).caught=false});
}
/** 擔保金沒收（被查獲或退出協議）。 */
function guildForfeit(){const C=G.cartel,a=C.bond||0;C.bond=0;C.pot=0;C.pEnd=undefined;return a}
/** 同業每旬的超賣決定（rivalSupply 在本業第一項貨時呼叫）：5% 機率挑一項本業貨超賣。回傳該貨的超賣倍數（沒超賣回傳 0）。 */
function rivalOverMul(r,c,first){
  if(first||r.raided)return 0;
  const n=npc(r.cid);if(!n)return 0;const m=msOf(n),R=ODDS.rivalShip;
  if(m.ovDec!==G.turn){m.ovDec=G.turn;m.ovItem=null;if(roll('rivalShip',R.overRival)){m.ovItem=pick(ownComms()).name;m.ovMul=R.mulMin+rnd()*(R.mulMax-R.mulMin)}}
  return m.ovItem===c.name?m.ovMul:0;
}
/** 違約查獲的公開紀錄：G.caughtLog[年]={cid 或 'me': 次數}，只留最近三年。0.8 公會長候選人看「去年度被查獲次數」。 */
function caughtAdd(key){
  const L=G.caughtLog||(G.caughtLog={}),y=String(G.year);L[y]=L[y]||{};L[y][key]=(L[y][key]||0)+1;
  Object.keys(L).forEach(k=>{if(+k<G.year-2)delete L[k]});
}
/** 某人某年被查獲的次數（key＝人物 cid，玩家為 'me'；year 預設去年）。 */
const caughtCount=(key,year)=>((G.caughtLog||{})[String(year===undefined?G.year-1:year)]||{})[key]||0;
/** 每旬（市場刷新之後）：查同業超賣、期滿分配違約金。 */
function guildTick(log){
  guildEnsure();
  const C=G.cartel,P=ODDS.cartelPledged,amt=costOf('guildBond');
  rivalsHere().forEach(n=>{
    const m=msOf(n);if(m.ovDec!==G.turn||!m.ovItem||m.caught)return;
    if(!chance(Math.min(P.max,P.base+P.slope*(m.ovMul-1))))return;
    m.caught=true;caughtAdd(n.cid);m.ev=Math.min(m.ev||1,0.7);m.evT=Math.max(m.evT||0,3);
    if(C.bond>0)C.pot=(C.pot||0)+amt;
    const t=NEWS('guild.rivalCaught',{n:nameOf(n.cid),item:COMM_MAP[m.ovItem].short});pushNews(t);log.push(t);
  });
  // 期滿分配違約金改在例會旬開始時（meetingTick，07yb_meeting.js）
}
/** 公會面板上的擔保金卡。 */
function guildBondCard(){
  guildEnsure();const C=G.cartel;
  if(!guildMember()||!(C.bond>0))return '<div class="card"><b class="small">🔓 未參加協議</b><div class="tiny muted" style="margin-top:2px">你仍是問屋公會會員；向大盤照市價進貨，進貨上限只按市占率分配，出貨不受協議配額約束。參加協議要押擔保金 '+fmt(costOf('guildBond'))+' 兩。</div></div>';
  const left=turnsToMeeting(1,false)||0,k=Math.round((C.pot||0)/costOf('guildBond'));
  return '<div class="card"><b class="small">🔒 協議擔保金 '+fmt(C.bond)+' 兩押在公會</b><div class="tiny muted" style="margin-top:2px">向大盤進貨享聯合採購價，進貨上限另有協議配額加給。距下次例會還有 '+left+' 旬'+(k?'，已有 '+k+' 家同業偷跑被抓，下次例會時沒收的擔保金平分給守約的人。':'，至今無人違約。')+'被查獲超量或退出協議，擔保金沒收；公會會員身分不受影響。</div></div>';
}
