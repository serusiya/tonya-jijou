'use strict';
/* ======================= 問屋公會例會：供給投票、菓子折拍賣（0.7 先行；公會長尚未開放） =======================
 *  - 例會固定在 3、6、9、12 月上旬（每季第一旬；02b_calendar.js 的 isMeetingTurn）；一期＝九旬；開局那一旬（3 月上旬）就是第一次例會。主畫面在例會旬出現整列按鈕，
 *    扣 1 行動、照常擲遇襲與路遇；整場例會只扣進場那 1 點。關掉視窗後可再按按鈕繼續，不再扣行動。
 *  - 流程：① 協議立場（加入、暗約、退出只能在這裡辦）→ ③ 供給投票 → ④ 菓子折拍賣 → ⑤ 本期總結。② 公會長選舉尚未開放。
 *  - 決議當旬生效：投票後立即以新方針重算本旬同業供給。沒出席（或沒走完）時，推進那一旬、出貨之前自動決議：
 *    同業各自 60% 投減供；你沒有票、不能出價。
 *  - 投票：只有參加協議的會員；你一票；你出席時每位同業跟你投一樣的機率＝80%×好感÷100，否則投另一方。平手維持上一期方針（公會長開放後改由公會長裁決）。
 *  - 菓子折：名義上是大盤答謝公會的點心禮，盒底那層是給誰的人人都知道。每期一批：一項本業貨（越貴越容易被挑中），
 *    照當旬市價約值 8,000～12,000 兩，6,000 兩起標；封閉出價、價高者得、付自己出的價；得標金由公會代為打點（公會長開放後歸公會長、由他報告）。
 *  - 狀態：G.guild＝{mt 本期例會旬, att 已進場, step, voted, myVote, tally, lot:{name,qty,val}, bid, res:{who,price}, done}。 */
const MEET=ODDS.meeting;
/** 本旬的例會資料（不是例會旬或還沒建立時回傳 null）。 */
const meetNow=()=>G&&G.guild&&G.guild.mt===G.turn?G.guild:null;
const meetPending=()=>{const M=meetNow();return !!(M&&!M.done)};
/** 菓子折的拍品：從本業較貴的一半貨品中，依基準價加權抽一項，份量照當旬市價約值 8,000～12,000 兩。 */
function meetLot(){
  const all=ownComms().slice().sort((a,b)=>b.base-a.base),L=all.slice(0,Math.ceil(all.length/2));const tot=L.reduce((a,c)=>a+c.base,0);let r=rnd()*tot,c=L[0];   // 只從本業較貴的一半貨品裡抽（數量多的便宜貨不入選）
  for(const x of L){r-=x.base;if(r<=0){c=x;break}}
  const p=Math.max(0.1,G.mk[c.name].price||c.base),val=rint(MEET.lotMin,MEET.lotMax),qty=Math.max(1,Math.round(val/p));
  return {name:c.name,qty,val:Math.round(qty*p)};
}
/** 建立本旬的例會。 */
function newMeeting(){G.guild={mt:G.turn,att:false,step:1,voted:false,myVote:null,tally:null,lot:meetLot(),bid:MEET.start,res:null,done:false,prev:cartelPolicy()}}
/** 舊存檔或讀檔時正好是例會旬而還沒有例會資料：補建（不分配違約金）。 */
function meetEnsure(){if(G&&isMeetingTurn()&&!(G.guild&&G.guild.mt===G.turn))newMeeting()}
/** 例會旬開始（日期前進後）：上一期的違約金分配、建立本期例會；例會前一旬提醒。 */
function meetingTick(log){
  const C=G.cartel;guildEnsure();
  if(isMeetingTurn()){
    if(C.bond>0){                                   // 上一期期滿：沒收的違約金平分給守約者（你＋本期沒被抓的同業）
      const rv=rivalsHere(),ok=rv.filter(n=>!msOf(n).caught).length+1,pot=C.pot||0,amt=costOf('guildBond');
      if(pot>0){const sh=Math.round(pot/ok);G.silver+=sh;if(TURNRP)TURNRP.guildDiv=(TURNRP.guildDiv||0)+sh;const t=NEWS('guild.div',{k:Math.round(pot/amt),n:ok,sh:fmt(sh)});pushNews(t);log.push(t);sfx.coin()}
    }
    C.pot=0;rivalsHere().forEach(n=>{msOf(n).caught=false});
    newMeeting();
    const t=NEWS('meet.today');pushNews(t);log.push(t);
  }else{const d=dateAfter(1);if(isMeetingDate(d.month,d.cycle)){const t=NEWS('meet.soon');pushNews(t);log.push(t)}}
}
/** 新方針立即生效：重算本旬本業貨的同業供給與市價。 */
function meetResupply(){ownComms().forEach(c=>{const m=G.mk[c.name];m.so=rivalSupply(c,m,false)});syncPrices()}
/** 供給投票。me＝你的票（'normal'／'restrict'；沒有票時 null）。回傳 {n,r,me,policy,tie}。 */
function meetVote(me){
  const M=meetNow();if(!M||M.voted)return M&&M.tally;
  let n=0,r=0;const cast=v=>{if(v==='normal')n++;else r++};
  if(me)cast(me);
  rivalsHere().forEach(x=>{
    if(me){const p=Math.min(MEET.followMax,MEET.followMax*R(x.cid).aff/100);cast(chance(p)?me:(me==='normal'?'restrict':'normal'))}
    else cast(chance(MEET.restrictP)?'restrict':'normal');
  });
  const tie=n===r,pol=tie?M.prev:(n>r?'normal':'restrict');
  const C=G.cartel,changed=pol!==cartelPolicy();C.policy=pol;if(changed)G.plan={};
  M.voted=true;M.myVote=me||null;M.tally={n,r,me:me||null,policy:pol,tie};
  meetResupply();
  return M.tally;
}
/** 你能不能標菓子折：回傳不能的原因（可以時回傳空字串）。 */
function meetBidBlock(){
  const M=meetNow();if(!M)return UT('gmeet.meetBidBlock');
  if(!M.att)return UT('gmeet.meetBidBlock.2');
  if(!guildMember())return UT('gmeet.meetBidBlock.3');
  if(!tradeOK(M.lot.name))return UT('gmeet.meetBidBlock.4');
  if(G.silver<MEET.start)return UT('gmeet.meetBidBlock.5',{a:fmt(MEET.start)});
  if(invCap()-invUsed()-pendingQty()<M.lot.qty)return UT('gmeet.meetBidBlock.6');
  return '';
}
/** 同業的封閉出價（不出價回傳 0）。 */
function rivalBid(n,lot){
  if(chance(MEET.skipP))return 0;
  const st=CH(n.cid).derived_stats,c=COMM_MAP[lot.name],u=rnd();
  let f=u<0.8?0.7+rnd()*0.2:u<0.9?0.6+rnd()*0.1:0.9+rnd()*0.1;
  f+=(st.audacity_courage-50)/1000-(st.greed_index-50)/1000;           // 膽識高往上、貪欲高往下（各約 ±5%）
  const sh=(G.share&&G.share.rows||[]).find(x=>x.cid===n.cid);if(sh)f+=(sh.share||0)*0.1;   // 大同業略提高
  if(c.decay>0.01)f-=0.05;                                              // 易腐貨略保守
  f+=(rnd()-0.5)*0.04;
  const b=Math.round(lot.val*clamp(f,0.5,1.05)/100)*100;
  return b>=MEET.start?b:0;
}
/** 開標。myBid＝你的出價（不出價 0）。得標金由公會代為打點（公會長尚未開放）。 */
function meetAuction(myBid){
  const M=meetNow();if(!M||M.res)return M&&M.res;
  const lot=M.lot,bids=rivalsHere().map(n=>({cid:n.cid,b:rivalBid(n,lot),sh:((G.share&&G.share.rows||[]).find(x=>x.cid===n.cid)||{}).share||0})).filter(x=>x.b>0);
  M.bids={};bids.forEach(x=>{M.bids[x.cid]=x.b});
  bids.sort((a,b)=>b.b-a.b||b.sh-a.sh);
  const top=bids[0];let res;
  if(myBid>0&&(!top||myBid>top.b)){
    G.silver-=myBid;G.inv[lot.name]=(G.inv[lot.name]||0)+lot.qty;notePublicSpend('spend.lot|'+lot.name,myBid);
    res={who:'me',price:myBid};sfx.fanfare();
  }else if(top)res={who:top.cid,price:top.b};
  else res={who:null,price:0};
  M.res=res;M.myBid=myBid||0;
  const t=res.who==='me'?NEWS('meet.lotMe',{n:COMM_MAP[lot.name].short,q:lot.qty,p:fmt(res.price)}):res.who?NEWS('meet.lotRival',{who:nameOf(res.who),n:COMM_MAP[lot.name].short,q:lot.qty,p:fmt(res.price)}):NEWS('meet.lotNone',{n:COMM_MAP[lot.name].short});
  pushNews(t);M.lotNews=t;
  return res;
}
/** 推進一旬、出貨之前：本旬例會若還沒走完，照規則自動決議（你沒有票、不能出價）。 */
function meetingAuto(log){
  const M=meetNow();if(!M||M.done)return;
  if(!M.voted){const T=meetVote(null);const t=NEWS('meet.autoVote',{p:policyName(T.policy),n:T.n,r:T.r,tie:T.tie?UT('gmeet.t'):''});pushNews(t);log.push(t)}
  if(!M.res){meetAuction(0);if(M.lotNews)log.push(M.lotNews)}
  M.done=true;
}
const policyName=p=>p==='normal'?UT('gmeet.policyName'):UT('gmeet.policyName.2');
/** 例會上同業的發言：每一步隨機 1～3 人（仇人也會出場說冷話），存在本次例會裡，關掉視窗再回來不重抽；同一場不重複台詞。
 *  台詞只是氣氛（會上講話真真假假）：拉票的主張、對菓子折的意向都只用來挑台詞，和他實際怎麼投、怎麼出價無關；散會道別依已發生的結果挑。 */
function meetTalk(step){
  const M=meetNow();if(!M)return [];M.talk=M.talk||{};if(M.talk[step])return M.talk[step];
  const used=M.usedLines||(M.usedLines=[]);
  const say=(path,vars)=>{const L=Ls(path).filter(x=>!used.includes(x)),pool=L.length?L:Ls(path),t=pool[Math.floor(rnd()*pool.length)];used.push(t);
    return String(t).replace(/\{(\w+)\}/g,(m,k)=>vars&&vars[k]!==undefined?vars[k]:m)};
  const rv=shuffle(rivalsHere().slice()).slice(0,rint(1,3)),item=COMM_MAP[M.lot.name].short,me=UT('gmeet.me',{a:G.me.family});
  const out=rv.map(n=>{
    const cid=n.cid,foe=isEnemy(cid),r=R(cid),v={me,item};let t;
    if(step===1){t=foe?say('meet.greet.enemy',v):G.month===3&&chance(0.5)?say('meet.greet.spring',v):say('meet.greet.'+(r.bond&&r.aff>=60?'warm':r.bond&&r.aff<20?'cold':'plain'),v)}
    else if(step===2){const st=chance(MEET.restrictP)?'restrict':'normal';t=say('meet.stance.'+(foe?(st==='normal'?'enemyNormal':'enemyRestrict'):st),v)}
    else if(step===3){const u=rnd(),k=u<0.35?'high':u<0.65?'none':'chat';t=say('meet.lot.'+(foe?'enemy'+k[0].toUpperCase()+k.slice(1):k),v)}
    else{
      const res=M.res||{},T=M.tally||{},bid=(M.bids||{})[cid]||0;v.p=policyName(T.policy);
      t=res.who===cid?say('meet.bye.win',v):foe?say('meet.bye.enemy',v):bid>0?say('meet.bye.lose',v):res.who==='me'&&chance(0.6)?say('meet.bye.meWin',v):T.policy!==M.prev&&chance(0.5)?say('meet.bye.changed',v):say('meet.bye.plain',v);
    }
    return {cid,t,foe};
  });
  M.talk[step]=out;return out;
}
/** 發言小卡（照吉原設宴：頭像、姓名、一句話）。 */
function meetTalkHtml(step){
  return meetTalk(step).map(x=>'<div class="card" style="display:flow-root;margin:3px 0">'+portraitHtml(x.cid,40)+'<b>'+esc(nameOf(x.cid))+'</b> <span class="tag '+(x.foe?'red':'gray')+'">'+(x.foe?UT('gmeet.meetTalkHtml'):UT('gmeet.meetTalkHtml.2'))+'</span><div class="small" style="margin-top:3px">'+esc(x.t)+'</div></div>').join('');
}

/* ---------- 畫面 ---------- */
/** 主畫面的例會按鈕列（不是例會旬時不顯示）。 */
function meetHomeHtml(){
  const M=meetNow();if(!M)return '';
  if(M.done)return UT('gmeet.meetHomeHtml',{a:policyName(cartelPolicy())})+'</div></button>';
  return UT('gmeet.meetHomeHtml.4',{a:M.att?UT('gmeet.meetHomeHtml.2'):UT('gmeet.meetHomeHtml.3')})+'</div></button>';
}
ACT.meetGo=()=>{
  const M=meetNow();if(!M||M.done)return;
  if(M.att){UI.openSheet('guild');return}
  if(apLeft()<=0){toast(MSG('go.2'));return}
  if(injuredBlock())return;
  const amb=rollAmbush();if(amb&&amb.abort)return;
  const enc=amb?null:rollEncounter();
  const go=()=>{if(!spendAP())return;M.att=true;G.cartel.paid=true;goTo('guild')};
  if(enc){showEncounter(enc,go);return}
  go();
};
/** 大盤頁的「公會與協議」卡片（只能查看，不扣行動）。 */
function guildInfoCard(){
  const C=G.cartel,M=meetNow();
  const st=C.state==='pledged'?UT('gmeet.st'):C.state==='secret'?UT('gmeet.st.2'):UT('gmeet.st.3');
  let next;if(M&&!M.done)next=UT('gmeet.guildInfoCard');else{const k=turnsToMeeting(1,false);next=UT('gmeet.guildInfoCard.2',{a:dateLabel(dateAfter(k)),b:k})}
  return UT('gmeet.guildInfoCard.5',{a:policyName(cartelPolicy())})+'</b></div>'+UT('gmeet.guildInfoCard.6',{a:st})+'</b></div>'+UT('gmeet.guildInfoCard.7',{a:guildMember()&&C.bond>0?UT('gmeet.guildInfoCard.3',{a:fmt(C.bond)}):'—'})+'</b></div>'+UT('gmeet.guildInfoCard.8',{a:rivalsHere().length,b:next})+'</b></div>'+UT('gmeet.guildInfoCard.9',{a:C.sanction>0?UT('gmeet.guildInfoCard.4',{a:C.sanction}):''});
}
/** 例會視窗：一步一步進行。 */
SHEETS.guild=()=>{
  guildEnsure();
  const M=meetNow(),C=G.cartel;
  if(!M||!M.att)return {title:UT('gmeet.guild'),html:UT('gmeet.guild.2')};
  const steps=[UT('gmeet.steps'),UT('gmeet.steps.2'),UT('gmeet.steps.3'),UT('gmeet.steps.4')],cur=M.step;
  let h='<div class="chevs">'+steps.map((s,i)=>'<span class="chev '+(cur===i+1?'on':cur>i+1?'done':'todo')+(i===0?' first':'')+'"'+(s.length>4?' style="flex-grow:1.3"':'')+'><i>'+s+'</i></span>').join('')+'</div>';   // 箭頭串接的步驟列（style.css .chevs）
  let info='',act='';                              // 每一步三層：說明 → 同業發言 → 決策按鈕
  if(cur===1){
    const st=C.state==='pledged'?UT('gmeet.st.4'):C.state==='secret'?UT('gmeet.st.5'):UT('gmeet.st.6');
    const mem=guildMember()&&C.bond>0,bc=costBtn('guildBond'),gc=costBtn('guildSecret');
    info=UT('gmeet.guild.3',{a:rivalsHere().length+1,b:st})+'</div>'+guildBondCard()+'</div>';
    act='<div class="grid2"><button class="pixel-btn btn-green" data-act="cartel" data-s="pledged" '+(C.state==='pledged'?'disabled':'')+'>'+(mem?UT('btn.cartel'):UT('btn.cartelJoin',{c:bc}))+'</button><button class="pixel-btn btn-red" data-act="cartel" data-s="secret" '+(C.state==='secret'?'disabled':'')+'>'+(mem?UT('btn.cartel2',{c:gc}):UT('btn.cartel2Join',{c:bc,g:gc}))+'</button></div>'+'<button class="pixel-btn" style="width:100%;margin-top:4px" data-act="cartel" data-s="none" '+(C.state==='none'?'disabled':'')+'>'+UT('btn.cartel3')+'</button>'+UT('gmeet.guild.4');
  }else if(cur===2){
    info=guildMember()?UT('gmeet.guild.5',{a:Math.round(C.quotaPct*100),b:policyName(M.prev)})
      :UT('gmeet.guild.6');
    if(!M.voted)act=guildMember()?UT('gmeet.guild.7')
      :UT('gmeet.guild.8');
    else{
      const T=M.tally;
      act=UT('gmeet.guild.11',{a:T.n,b:T.r,c:policyName(T.policy)})+'</b>'+(T.tie?UT('gmeet.guild.9'):'')+(T.me?UT('gmeet.guild.10',{a:policyName(T.me)}):'')+'</div></div>'+UT('gmeet.guild.12');
    }
  }else if(cur===3){
    const L=M.lot,c=COMM_MAP[L.name];
    info=UT('gmeet.guild.13',{a:esc(c.short),b:L.qty,c:fmt(MEET.start)});
    if(!M.res){
      const why=meetBidBlock();
      if(why)act='<div class="notice tiny">'+UT('gmeet.guild.14',{a:esc(why)});
      else{
        const mx=Math.max(MEET.start,Math.floor(G.silver/MEET.step)*MEET.step);M.bid=clamp(M.bid||MEET.start,MEET.start,mx);
        act=UT('gmeet.guild.15',{a:fmt(M.bid),b:stepRow('<input type="range" id="slider-meet" min="'+MEET.start+'" max="'+mx+'" step="'+MEET.step+'" value="'+M.bid+'">','slider-meet',M.bid<=MEET.start,M.bid>=mx)});
      }
    }else{
      const r=M.res;
      act=UT('gmeet.guild.20',{a:r.who==='me'?UT('gmeet.guild.16',{a:fmt(r.price)}):r.who?UT('gmeet.guild.17',{a:esc(nameOf(r.who)),b:fmt(r.price)}):UT('gmeet.guild.18')})+'</div>'+UT('gmeet.guild.21',{a:M.myBid&&r.who!=='me'?UT('gmeet.guild.19',{a:fmt(M.myBid)}):''});
    }
  }else{
    const T=M.tally,r=M.res,own=tradeComms();
    info=UT('gmeet.guild.25',{a:policyName(T.policy)})+'</b></div>'+UT('gmeet.guild.26',{a:r.who==='me'?UT('gmeet.guild.22',{a:fmt(r.price)}):r.who?UT('gmeet.guild.23',{a:esc(nameOf(r.who))}):UT('gmeet.guild.24')})+'</b></div>'+UT('gmeet.guild.27',{a:C.state==='pledged'?UT('gmeet.st'):C.state==='secret'?UT('gmeet.st.2'):UT('gmeet.st.3')})+'</b></div></div>';
    if(guildMember())info+=UT('gmeet.guild.29',{a:own.map(c=>'<div class="row tiny" style="margin-top:2px"><span>'+esc(c.short)+'</span><b>'+UT('gmeet.guild.28',{a:quotaOf(c.name)})).join('')})+'</div>';
    act=UT('gmeet.guild.30');
  }
  h+=info+meetTalkHtml(cur)+act;
  return {title:UT('gmeet.guild.31'),html:h};
};
ACT.meetStep=()=>{const M=meetNow();if(!M)return;M.step=Math.min(4,M.step+1);refreshSheet();UI.render()};
ACT.meetVote=el=>{const M=meetNow();if(!M||M.voted)return;const v=el.dataset.v||null;meetVote(guildMember()?v:null);sfx.step();refreshSheet();UI.render()};
ACT.meetBid=el=>{const M=meetNow();if(!M||M.res)return;const b=el.dataset.b==='1'&&!meetBidBlock()?M.bid:0;meetAuction(b);refreshSheet();UI.render()};
ACT.meetEnd=()=>{const M=meetNow();if(!M)return;M.done=true;UI.closeSheet();UI.render()};
document.addEventListener('input',e=>{if(e.target&&e.target.id==='slider-meet'){const M=meetNow();if(!M)return;M.bid=+e.target.value;const b=document.getElementById('meet-b');if(b)b.textContent=UT('gmeet.guildInfoCard.3',{a:fmt(M.bid)})}});
