'use strict';
/* ======================= 公會擔保金與違約金分配 =======================
 *  - 入會（表態遵守或簽暗約）要押擔保金 1,000 兩（COSTS.guildBond）；開局即以守約成員身分入會，擔保金由開局贈送。
 *  - 入會者向大盤進貨享公會價（市價九三折）；未入會照市價（03_market.js 的 unitBuyCost）。
 *  - 自動續押：擔保金一直押在公會；每 9 旬一期（ODDS.guildBond.turns），期滿把本期沒收的違約金平分給守約者（你＋本期沒被抓的同業）。
 *  - 你被查獲超量（evalCartel）或退出協議：擔保金沒收，立場回到未表態；要重新入會須在例會時再押一次。
 *  - 同業：每家每旬 5% 超賣一項本業貨（ODDS.rivalShip.overRival，rivalSupply 擲骰），查獲規則與你守約時相同；被抓者擔保金沒收、三旬內市佔下降。
 *  - 狀態：G.cartel.bond（押著的金額，0＝沒押）、pEnd（本期結束旬）、pot（本期沒收的違約金）；同業的違約紀錄在 msOf(n).ovDec/ovItem/ovMul/caught。 */
/** 是否為公會成員（表態遵守或暗約）。 */
const guildMember=()=>G.cartel.state==='pledged'||G.cartel.state==='secret';
/** 舊存檔補欄位：已入會而沒有擔保金紀錄的，視為已押。 */
function guildEnsure(){
  const C=G.cartel;
  if(C.bond===undefined){C.bond=guildMember()?costOf('guildBond'):0;C.pot=0;if(C.bond)C.pEnd=G.turn+ODDS.guildBond.turns}
  if(guildMember()&&C.bond>0&&C.pEnd===undefined)C.pEnd=G.turn+ODDS.guildBond.turns;
}
/** 押擔保金入會（新的一期從此刻算起）。inTurn＝推進一旬途中付（大番頭代席），記在本旬報告。 */
function guildJoin(inTurn){
  const C=G.cartel,amt=costOf('guildBond');
  if(inTurn){G.silver-=amt;if(TURNRP){TURNRP.inTurn=TURNRP.inTurn||{};TURNRP.inTurn['公會擔保金']=(TURNRP.inTurn['公會擔保金']||0)+amt}}
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
/** 每旬（市場刷新之後）：查同業超賣、期滿分配違約金。 */
function guildTick(log){
  guildEnsure();
  const C=G.cartel,P=ODDS.cartelPledged,amt=costOf('guildBond');
  rivalsHere().forEach(n=>{
    const m=msOf(n);if(m.ovDec!==G.turn||!m.ovItem||m.caught)return;
    if(!chance(Math.min(P.max,P.base+P.slope*(m.ovMul-1))))return;
    m.caught=true;m.ev=Math.min(m.ev||1,0.7);m.evT=Math.max(m.evT||0,3);
    if(C.bond>0)C.pot=(C.pot||0)+amt;
    const t=NEWS('guild.rivalCaught',{n:nameOf(n.cid),item:COMM_MAP[m.ovItem].short});pushNews(t);log.push(t);
  });
  if(C.bond>0&&C.pEnd!==undefined&&G.turn>=C.pEnd){
    const rv=rivalsHere(),ok=rv.filter(n=>!msOf(n).caught).length+1,pot=C.pot||0;
    if(pot>0){
      const sh=Math.round(pot/ok);G.silver+=sh;if(TURNRP)TURNRP.guildDiv=(TURNRP.guildDiv||0)+sh;
      const t=NEWS('guild.div',{k:Math.round(pot/amt),n:ok,sh:fmt(sh)});pushNews(t);log.push(t);sfx.coin();
    }
    C.pot=0;rv.forEach(n=>{msOf(n).caught=false});C.pEnd+=ODDS.guildBond.turns;
  }
}
/** 公會面板上的擔保金卡。 */
function guildBondCard(){
  guildEnsure();const C=G.cartel;
  if(!guildMember()||!(C.bond>0))return '<div class="card"><b class="small">🔓 未入會</b><div class="tiny muted" style="margin-top:2px">向大盤照市價進貨，出貨不受配額約束。入會要押擔保金 '+fmt(costOf('guildBond'))+' 兩。</div></div>';
  const left=Math.max(0,(C.pEnd||G.turn)-G.turn),k=Math.round((C.pot||0)/costOf('guildBond'));
  return '<div class="card"><b class="small">🔒 擔保金 '+fmt(C.bond)+' 兩押在公會</b><div class="tiny muted" style="margin-top:2px">向大盤進貨享公會價。本期還有 '+left+' 旬'+(k?'，已有 '+k+' 家同業偷跑被抓，期滿時沒收的擔保金平分給守約的人。':'，至今無人違約。')+'被查獲超量或退出協議，擔保金沒收。</div></div>';
}
