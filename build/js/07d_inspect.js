/* =====================================================================
 * 07d_inspect.js — 官吏查貨事件
 *  - 推進一旬時有 5%～30% 機率（知名度越低越高）由本城一二階官員來查貨。
 *  - 旬報關閉後以來訪視窗（07s_face_events.js）讓玩家選：賄賂（增加好感並算「認識」）或公事公辦（小額罰銀）。
 *  - 這個選擇不扣行動點數；沒選就關掉旬報，下一旬自動按公事公辦處理。
 * ===================================================================== */

/** 查貨機率：知名度 0 → 30%，知名度 100 → 5%。 */
const inspectChance=()=>clamp(ODDS.inspect.base-ODDS.inspect.perFame*(G.fame||0)/ODDS.fame.cap,ODDS.inspect.min,ODDS.inspect.max);
/** 賄賂金額（現款）：官階 1 → 30、官階 2 → 60。 */
const inspectBribe=rk=>costOf('inspectBribe',rk);

/** 推進一旬時呼叫：先結算上一次沒處理的查貨，再擲新的查貨。 */
function inspectTick(log){
  if(G.inspect){inspectResolve(false,log)}
  if(!chance(inspectChance()))return;
  const offs=officialsOf(G.cityId).filter(n=>n.pos&&n.pos.rank<=2);
  if(!offs.length)return;
  const n=pick(offs);G.inspect={cid:n.cid,turn:G.turn};queueFaceEvent({type:'inspect',cid:n.cid,turn:G.turn});   // 旬報關閉後以來訪視窗處理
  log.push(NEWS('inspectTick.1',{n:(n.pos?posTitle(n):'官吏'),n2:nameOf(n.cid)}));
}
/** 結算查貨：bribe＝true 賄賂；false 公事公辦（罰銀、好感微降）。回傳訊息。 */
function inspectResolve(bribe,log){
  const I=G.inspect;if(!I)return '';G.inspect=null;
  const n=npc(I.cid),r=R(I.cid),rk=n&&n.pos?n.pos.rank:1;
  if(bribe){
    const cost=inspectBribe(rk);
    if(!affordAmt('inspectBribe',cost)){G.inspect=I;return shortMsg('inspectBribe',rk)}
    spendAmt('inspectBribe',cost);G.heat=(G.heat||0)+0.5;
    const gain=8+rk*2;r.aff=clamp(r.aff+gain,0,100);
    const first=!r.bond;
    if(first){r.bond={mult:0.6,label:'查貨結識',introId:null};r.met=true;r.seen=true;if(!r.fameGot){r.fameGot=true;addFame(0.8*rk)}}
    addKnown(I.cid);logRel(I.cid,'查貨時奉上現款 '+cost+' 兩，好感 +'+gain+'。');
    return '奉上 '+cost+' 兩，對方收下，態度和緩。好感 +'+gain+(first?'，已結識「'+nameOf(I.cid)+'」':'')+'。';   // 只有第一次結識才提
  }
  const fine=Math.round(10*rk*(1+rnd()));G.silver-=fine;
  r.aff=clamp(r.aff-2,0,100);logRel(I.cid,'查貨公事公辦，罰銀 '+fine+' 兩，好感 -2。');
  const t=NEWS('inspectResolve.1',{fine});if(log)log.push(NEWS('inspectResolve.2',{t}));return t;
}
/** 旬報下方的查貨選項卡。 */
ACT.inspBribe=()=>{const t=inspectResolve(true);toast(t);if(!G.inspect){UI.hideInfo();sfx.coin();UI.render()}};
ACT.inspPass=()=>{const t=inspectResolve(false);toast(t);UI.hideInfo();UI.render()};
