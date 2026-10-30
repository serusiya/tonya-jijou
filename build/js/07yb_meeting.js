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
  const M=meetNow();if(!M)return '本旬沒有例會。';
  if(!M.att)return '要親自出席例會才能出價。';
  if(!guildMember())return '沒有參加協議，不能出價。';
  if(!tradeOK(M.lot.name))return '這項貨沒有交易許可，不能出價。';
  if(G.silver<MEET.start)return '現款不到 '+fmt(MEET.start)+' 兩。';
  if(invCap()-invUsed()-pendingQty()<M.lot.qty)return '倉位放不下這批貨。';
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
    G.silver-=myBid;G.inv[lot.name]=(G.inv[lot.name]||0)+lot.qty;notePublicSpend('菓子折得標：'+COMM_MAP[lot.name].short,myBid);
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
  if(!M.voted){const T=meetVote(null);const t=NEWS('meet.autoVote',{p:policyName(T.policy),n:T.n,r:T.r,tie:T.tie?'，票數相同，維持上一期':''});pushNews(t);log.push(t)}
  if(!M.res){meetAuction(0);if(M.lotNews)log.push(M.lotNews)}
  M.done=true;
}
const policyName=p=>p==='normal'?'維持':'減供';
/** 例會上同業的發言：每一步隨機 1～3 人（仇人也會出場說冷話），存在本次例會裡，關掉視窗再回來不重抽；同一場不重複台詞。
 *  台詞只是氣氛（會上講話真真假假）：拉票的主張、對菓子折的意向都只用來挑台詞，和他實際怎麼投、怎麼出價無關；散會道別依已發生的結果挑。 */
function meetTalk(step){
  const M=meetNow();if(!M)return [];M.talk=M.talk||{};if(M.talk[step])return M.talk[step];
  const used=M.usedLines||(M.usedLines=[]);
  const say=(path,vars)=>{const L=Ls(path).filter(x=>!used.includes(x)),pool=L.length?L:Ls(path),t=pool[Math.floor(rnd()*pool.length)];used.push(t);
    return String(t).replace(/\{(\w+)\}/g,(m,k)=>vars&&vars[k]!==undefined?vars[k]:m)};
  const rv=shuffle(rivalsHere().slice()).slice(0,rint(1,3)),item=COMM_MAP[M.lot.name].short,me=G.me.family+'屋';
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
  return meetTalk(step).map(x=>'<div class="card" style="display:flow-root;margin:3px 0">'+portraitHtml(x.cid,40)+'<b>'+esc(nameOf(x.cid))+'</b> <span class="tag '+(x.foe?'red':'gray')+'">'+(x.foe?'仇人':'同業')+'</span><div class="small" style="margin-top:3px">'+esc(x.t)+'</div></div>').join('');
}

/* ---------- 畫面 ---------- */
/** 主畫面的例會按鈕列（不是例會旬時不顯示）。 */
function meetHomeHtml(){
  const M=meetNow();if(!M)return '';
  if(M.done)return '<button class="pixel-btn" style="width:100%;margin-top:6px" disabled>⚖️ 本旬例會已散會<div class="tiny">本期方針：'+policyName(cartelPolicy())+'</div></button>';
  return '<button class="pixel-btn btn-gold" style="width:100%;margin-top:6px" data-act="meetGo">⚖️ 問屋公會例會（本旬召開）<div class="tiny">'+(M.att?'例會進行中，點此回到會所':'決定本期供給方針、菓子折拍賣')+'</div></button>';
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
  const st=C.state==='pledged'?'遵守協議':C.state==='secret'?'暗約偷跑':'未參加協議';
  let next;if(M&&!M.done)next='本旬召開';else{const k=turnsToMeeting(1,false);next=dateLabel(dateAfter(k))+'（'+k+' 旬後）'}
  return '<div class="card"><b class="small">⚖️ 公會與協議</b>'
    +'<div class="row tiny" style="margin-top:2px"><span>本期方針</span><b>'+policyName(cartelPolicy())+'</b></div>'
    +'<div class="row tiny"><span>你的立場</span><b>'+st+'</b></div>'
    +'<div class="row tiny"><span>擔保金</span><b>'+(guildMember()&&C.bond>0?fmt(C.bond)+' 兩':'—')+'</b></div>'
    +'<div class="row tiny"><span>會中同業</span><b>'+rivalsHere().length+' 家</b></div>'
    +'<div class="row tiny"><span>下次例會</span><b>'+next+'</b></div>'
    +(C.sanction>0?'<div class="tiny" style="color:#b3261e;margin-top:3px">⚠️ 聯合斷貨中，剩 '+C.sanction+' 旬</div>':'')
    +'<div class="tiny muted" style="margin-top:3px">加入、退出協議與投票都在例會上辦。</div></div>';
}
/** 例會視窗：一步一步進行。 */
SHEETS.guild=()=>{
  guildEnsure();
  const M=meetNow(),C=G.cartel;
  if(!M||!M.att)return {title:'⚖️ 問屋公會',html:'<div class="notice">例會固定在三、六、九、十二月上旬召開。</div>'};
  const steps=['協議立場','供給投票','菓子折拍賣','本期總結'],cur=M.step;
  let h='<div class="chevs">'+steps.map((s,i)=>'<span class="chev '+(cur===i+1?'on':cur>i+1?'done':'todo')+(i===0?' first':'')+'"'+(s.length>4?' style="flex-grow:1.3"':'')+'><i>'+s+'</i></span>').join('')+'</div>';   // 箭頭串接的步驟列（style.css .chevs）
  let info='',act='';                              // 每一步三層：說明 → 同業發言 → 決策按鈕
  if(cur===1){
    const st=C.state==='pledged'?'<span class="tag green">遵守協議</span>':C.state==='secret'?'<span class="tag red">暗約偷跑</span>':'<span class="tag gray">未參加協議</span>';
    const mem=guildMember()&&C.bond>0,bc=costBtn('guildBond'),gc=costBtn('guildSecret');
    info='<div class="notice tiny">本城 '+(rivalsHere().length+1)+' 家問屋（含你）齊聚會所。參加協議要押擔保金；向大盤進貨享聯合採購價與配額加給，也才能投票、標菓子折。加入、退出或改簽暗約，只能在例會上辦。</div>'
      +'<div class="card"><div class="row"><b>目前立場</b>'+st+'</div>'+guildBondCard()+'</div>';
    act='<div class="grid2"><button class="pixel-btn btn-green" data-act="cartel" data-s="pledged" '+(C.state==='pledged'?'disabled':'')+'>'+(mem?UT('btn.cartel'):UT('btn.cartelJoin',{c:bc}))+'</button><button class="pixel-btn btn-red" data-act="cartel" data-s="secret" '+(C.state==='secret'?'disabled':'')+'>'+(mem?UT('btn.cartel2',{c:gc}):UT('btn.cartel2Join',{c:bc,g:gc}))+'</button></div>'
      +'<button class="pixel-btn" style="width:100%;margin-top:4px" data-act="cartel" data-s="none" '+(C.state==='none'?'disabled':'')+'>'+UT('btn.cartel3')+'</button>'
      +'<button class="pixel-btn btn-gold" style="width:100%;margin-top:8px" data-act="meetStep">立場已定，進行供給投票 ▶</button>';
  }else if(cur===2){
    info=guildMember()?'<div class="notice tiny">本期供給要「維持」還是「減供」？維持：全城照需求供貨，你的配額是穩定供貨線。減供：各家照需求的 '+Math.round(C.quotaPct*100)+'% 出貨，壓低供給撐住行情。交情越深的同業，越可能跟你投一樣的。票數相同時，維持上一期（'+policyName(M.prev)+'）。</div>'
      :'<div class="notice tiny">你沒有參加協議，這次沒有票。同業各自投票決定本期方針。</div>';
    if(!M.voted)act=guildMember()?'<div class="grid2"><button class="pixel-btn btn-green" data-act="meetVote" data-v="normal">投「維持」</button><button class="pixel-btn btn-gold" data-act="meetVote" data-v="restrict">投「減供」</button></div>'
      :'<button class="pixel-btn btn-gold" style="width:100%;margin-top:6px" data-act="meetVote" data-v="">看同業投票 ▶</button>';
    else{
      const T=M.tally;
      act='<div class="card"><b>開票結果</b><div class="row small" style="margin-top:4px"><span>維持</span><b>'+T.n+' 票</b></div><div class="row small"><span>減供</span><b>'+T.r+' 票</b></div>'
        +'<div class="small" style="margin-top:4px">本期方針：<b>'+policyName(T.policy)+'</b>'+(T.tie?'（票數相同，維持上一期）':'')+(T.me?'　你投了「'+policyName(T.me)+'」':'')+'</div></div>'
        +'<button class="pixel-btn btn-gold" style="width:100%;margin-top:6px" data-act="meetStep">進行菓子折拍賣 ▶</button>';
    }
  }else if(cur===3){
    const L=M.lot,c=COMM_MAP[L.name];
    info='<div class="notice tiny">大盤照例送來一盒「菓子折」——名義上是答謝公會的點心禮，人人都知道，盒底那層是給誰的。這批貨在會上封閉拍賣，價高者得，得標金由公會代為打點。</div>'
      +'<div class="card"><div class="row"><b>本期菓子折：'+esc(c.short)+' '+L.qty+' 單位</b></div><div class="tiny muted" style="margin-top:2px">'+fmt(MEET.start)+' 兩起標</div></div>';
    if(!M.res){
      const why=meetBidBlock();
      if(why)act='<div class="notice tiny">'+esc(why)+'</div><button class="pixel-btn btn-gold" style="width:100%;margin-top:6px" data-act="meetBid" data-b="0">看同業出價 ▶</button>';
      else{
        const mx=Math.max(MEET.start,Math.floor(G.silver/MEET.step)*MEET.step);M.bid=clamp(M.bid||MEET.start,MEET.start,mx);
        act='<div class="row small" style="margin-top:6px"><span>你的出價</span><b id="meet-b">'+fmt(M.bid)+' 兩</b></div>'
          +stepRow('<input type="range" id="slider-meet" min="'+MEET.start+'" max="'+mx+'" step="'+MEET.step+'" value="'+M.bid+'">','slider-meet',M.bid<=MEET.start,M.bid>=mx)   // 沿用出貨拉霸：左右加減鈕、每格 500 兩、按住連續加減
          +'<div class="grid2" style="margin-top:6px"><button class="pixel-btn btn-gold" data-act="meetBid" data-b="1">封好出價 ▶</button><button class="pixel-btn" data-act="meetBid" data-b="0">這次不出價</button></div>';
      }
    }else{
      const r=M.res;
      act='<div class="card"><b>開標</b><div class="small" style="margin-top:4px">'+(r.who==='me'?'由你以 <b>'+fmt(r.price)+'</b> 兩得標，貨已入倉。':r.who?'由「'+esc(nameOf(r.who))+'」以 <b>'+fmt(r.price)+'</b> 兩得標。':'沒有人出價，這批貨退回大盤。')+'</div>'
        +(M.myBid&&r.who!=='me'?'<div class="tiny muted" style="margin-top:2px">你出了 '+fmt(M.myBid)+' 兩，沒有得標。</div>':'')+'<div class="tiny muted" style="margin-top:2px">其他人的出價不公布。</div></div>'
        +'<button class="pixel-btn btn-gold" style="width:100%;margin-top:6px" data-act="meetStep">本期總結 ▶</button>';
    }
  }else{
    const T=M.tally,r=M.res,own=tradeComms();
    info='<div class="card"><div class="row small"><span>本期方針</span><b>'+policyName(T.policy)+'</b></div>'
      +'<div class="row small"><span>菓子折</span><b>'+(r.who==='me'?'你得標（'+fmt(r.price)+' 兩）':r.who?esc(nameOf(r.who))+' 得標':'流標')+'</b></div>'
      +'<div class="row small"><span>你的立場</span><b>'+(C.state==='pledged'?'遵守協議':C.state==='secret'?'暗約偷跑':'未參加協議')+'</b></div></div>';
    if(guildMember())info+='<div class="card"><b class="small">你的本期協議配額</b>'+own.map(c=>'<div class="row tiny" style="margin-top:2px"><span>'+esc(c.short)+'</span><b>'+quotaOf(c.name)+' 單位／旬</b></div>').join('')+'</div>';
    act='<button class="pixel-btn btn-gold" style="width:100%;margin-top:6px" data-act="meetEnd">散會</button>';
  }
  h+=info+meetTalkHtml(cur)+act;
  return {title:'⚖️ 問屋公會例會',html:h};
};
ACT.meetStep=()=>{const M=meetNow();if(!M)return;M.step=Math.min(4,M.step+1);refreshSheet();UI.render()};
ACT.meetVote=el=>{const M=meetNow();if(!M||M.voted)return;const v=el.dataset.v||null;meetVote(guildMember()?v:null);sfx.step();refreshSheet();UI.render()};
ACT.meetBid=el=>{const M=meetNow();if(!M||M.res)return;const b=el.dataset.b==='1'&&!meetBidBlock()?M.bid:0;meetAuction(b);refreshSheet();UI.render()};
ACT.meetEnd=()=>{const M=meetNow();if(!M)return;M.done=true;UI.closeSheet();UI.render()};
document.addEventListener('input',e=>{if(e.target&&e.target.id==='slider-meet'){const M=meetNow();if(!M)return;M.bid=+e.target.value;const b=document.getElementById('meet-b');if(b)b.textContent=fmt(M.bid)+' 兩'}});
