'use strict';
/* =====================================================================
 * 07yc_gm.js — 問屋公會長（0.7.3；DESIGN_NOTES 第二十九節公會長段、第 188、197～202 節）
 *  - 選舉：每年 3 月例會的第一步（選完才進協議立場）。本城同業（含你）都能參選、投票，不看有沒有參加協議。
 *    候選人：去年被查獲違約次數最少的兩人（你去年任何一期不在協議內，視同多一次），同樣少看市佔；開局那一年直接看市佔。
 *    只剩一位直接當選，一位都沒有由現任續任。大盤依賴度制裁期間你不能參選（dapanSanctioned，尚未實作時一律為否）。
 *  - 你是候選人：其餘同業每人一場拉票的拜訪戰鬥（仇人不見你，直接投對方）；打穿投你，沒打穿投對方。沒出席時市佔較高者當選。
 *    你不是候選人：兩位候選人先後上門塞錢（私房錢，照名望階的中檔禮金上下一成，可推辭）；開會時投一位（好感 +5／−5）或棄權。
 *    同業投票人：比較與兩位候選人的性向相容，投較高者；相同投市佔較高者。開票平手：現任連任，否則市佔較高者。
 *  - 當選：一定在協議內（不在就自動加入、照付訂約金，現款可扣成負數）；你當選時知名度 +5、結識的同業好感 +3，任內每旬 +0.1，名望視同四階。
 *  - 任內：供給投票平手由公會長裁決（你在場自己選；你缺席維持上期；同業公會長一律減供）；公會長不能退出協議、不參加菓子折競標。
 *    你當公會長時，菓子折得標金進你的現款，本期內要趁御金奉行來城（2、5、8、11 月）向他報告（必須打穿，或打滿三回合且至少猜中一次）；
 *    沒報告、中途告辭或被嫌不善言辭：罰得標金 × 1.2。御金奉行空缺或在牢裡時免罰。散會時與報告月上旬各提醒一次。
 *  - 下台：你被查獲違約即下台（知名度另扣 10，沒報告的得標金當場罰）；同業公會長過世或離城；都由上次選舉的另一位候選人接任。
 *    同業公會長任內不超賣。
 *  - 任內事件（只在你當公會長時）：每期例會後第二個月上旬約五成，同業糾紛仲裁或御用金攤派擇一。
 *  狀態：G.gm={cid:'me'|cid,other,year}、G.gmDue={amt,mt,done,exempt,shown}、G.gmOut{年:true}、G.gmEvT、G.gmArb、G.gmLevy；
 *        本次選舉在例會資料 M.el。數值 ODDS.gm；文字 gm.*（01e、01f、01g）、LINES.gm（01d）。
 * ===================================================================== */
const GM_LOG=[];                                   // 旬中發生、要寫進旬報的公會長消息（gmTick 時併入）
const gmCid=()=>G&&G.gm?G.gm.cid:null;
const gmIsMe=()=>gmCid()==='me';
const gmName=k=>k==='me'?UT('gmeet.me',{a:G.me.family}):nameOf(k);
/** 公會事務上見過面：還沒往來的就記上交情（label＝交情來歷文字鍵）。 */
function gmMeet(cid,label){const r=R(cid);if(!r.bond){r.bond={mult:1,label:UT(label),introId:null};r.met=true;r.seen=true;addKnown(cid)}return r}
/** 市佔率（'me' 或同業 cid）。 */
function gmShare(k){const S=G.share||(G.share=marketShares());return k==='me'?(S.me||0):(((S.rows||[]).find(r=>r.cid===k)||{}).share||0)}
/** 本城的御金奉行（財務六階；在世、不在牢裡）。 */
const gmOfficial=()=>Object.values(G.world.npcs).find(n=>n.pos&&n.pos.court==='finance'&&n.pos.rank===6&&n.cityId===G.cityId&&alive(n.cid)&&!jailed(n))||null;
/** 你在大盤依賴度制裁中（第一百八十六節，尚未實作時一律為否）。 */
const gmBarred=()=>typeof dapanSanctioned==='function'&&!!dapanSanctioned();
/** 候選資格的分數：去年被查獲次數；你去年任何一期不在協議內，多算一次。 */
const gmScore=k=>caughtCount(k)+(k==='me'&&(G.gmOut||{})[String(G.year-1)]?1:0);
/** 可參選的人。 */
function gmPool(){
  const L=rivalsHere().filter(n=>alive(n.cid)&&!jailed(n)).map(n=>n.cid);
  if(!gmBarred())L.push('me');
  return L;
}
/** 名望階換算的候選人禮金：同階清官的丁稚代送中檔禮金，上下一成。 */
const gmBribeAmt=()=>{const t=clamp(fameTier(),1,6),b=BT_HP[t-1]*0.5;return Math.max(1,Math.round(b*(1-ODDS.gm.bribeVar+rnd()*2*ODDS.gm.bribeVar)))};
/** 建立本次選舉（3 月例會 newMeeting 時呼叫）。回傳 null＝沒有人可選，現任續任。 */
function gmElectSetup(){
  const pool=gmPool();if(!pool.length)return null;
  const sh=gmShare,first=G.year===0;
  const c=pool.slice().sort(first?((a,b)=>sh(b)-sh(a)):((a,b)=>gmScore(a)-gmScore(b)||sh(b)-sh(a))).slice(0,2);
  const E={cands:c,votes:{},done:false,winner:null,idx:0,bribe:{},first,myVote:null};
  E.voters=rivalsHere().filter(n=>alive(n.cid)&&!c.includes(n.cid)).map(n=>n.cid);
  if(c.length===1){E.single=true;gmElectFinish(E,c[0]);return E}
  if(!c.includes('me'))c.forEach(k=>{if(isEnemy(k))return;E.bribe[k]={amt:gmBribeAmt(),st:null};queueFaceEvent({type:'gmBribe',cid:k,turn:G.turn})});   // 仇人不來
  return E;
}
/** 同業投票人投給誰：性向相容較高者；相同投市佔較高者。 */
function gmRivalPick(v,A,B){
  const ma=compat(v,A).matches,mb=compat(v,B).matches;
  return ma!==mb?(ma>mb?A:B):(gmShare(A)>=gmShare(B)?A:B);
}
/** 開票：平手時現任連任，現任不在兩人之中看市佔。 */
function gmTally(E){
  const [A,B]=E.cands,cnt={};cnt[A]=0;cnt[B]=0;
  Object.values(E.votes).forEach(k=>{if(cnt[k]!==undefined)cnt[k]++});
  E.count=cnt;E.tie=cnt[A]===cnt[B];
  const inc=gmCid(),w=!E.tie?(cnt[A]>cnt[B]?A:B):(E.cands.includes(inc)?inc:(gmShare(A)>=gmShare(B)?A:B));
  gmElectFinish(E,w);
}
/** 選舉結束：就任並寫消息。 */
function gmElectFinish(E,w){
  E.done=true;E.winner=w;
  const other=E.cands.find(k=>k!==w)||null;
  const t=gmInstall(w,other,true);pushNews(t);GM_LOG.push(t);
}
/** 就任（elect＝選上；false＝接任）。回傳消息。 */
function gmInstall(k,other,elect){
  G.gm={cid:k,other:other||null,year:G.year};
  let join='';
  if(k==='me'){
    if(elect){addFame(ODDS.gm.fameWin,'major');rivalsHere().forEach(n=>{const r=G.rel[n.cid];if(r&&r.bond)setAff(r,clamp(r.aff+ODDS.gm.rivalAff,0,100))})}
    if(!guildMember()){const C=G.cartel,amt=costOf('guildBond');payPublic('cost:guildBond',amt);C.state='pledged';C.bond=amt;C.pot=0;join=NEWS('gm.join',{a:fmt(amt)})}   // 當選者一定在協議內
    sfx.fanfare();
  }
  return NEWS(elect?'gm.elected':'gm.succeed',{n:gmName(k)})+join;
}
/** 接任：上次選舉的另一位候選人；不行時由市佔最高的同業（不含 excl）。 */
function gmSucceed(excl){
  const o=G.gm&&G.gm.other;let k=null;
  if(o==='me'&&excl!=='me'&&!G.ended)k='me';
  else if(o&&o!=='me'&&o!==excl){const n=npc(o);if(n&&alive(o)&&n.cityId===G.cityId&&n.role==='rival'&&!jailed(n))k=o}
  if(!k){const L=rivalsHere().filter(n=>alive(n.cid)&&n.cid!==excl&&!jailed(n)).sort((a,b)=>gmShare(b.cid)-gmShare(a.cid));k=L.length?L[0].cid:null}
  if(!k){G.gm=null;return ''}
  return gmInstall(k,null,false);
}
/** 你下台（被查獲違約）：知名度另扣，沒報告的得標金當場罰，由另一位候選人接任。 */
function gmFall(){
  if(!gmIsMe())return;
  loseFame('gmFall');
  let t=NEWS('gm.fall');
  const fine=gmFineNow();if(fine)t+=fine;
  t+=gmSucceed('me');
  pushNews(t);GM_LOG.push(t);sfx.bad();
}
/** 還沒報告的得標金：當場罰款（罰過或免罰回傳空字串）。 */
function gmFineNow(){
  const D=G.gmDue;if(!D||D.done)return '';D.done=true;
  if(D.exempt||!gmOfficial())return NEWS('gm.exempt');
  const f=Math.round(D.amt*ODDS.gm.fineX);payPublic('spend.gmFine',f);
  return NEWS('gm.fine',{a:fmt(f)});
}
/** 一期結束（例會旬開始、建立新例會之前）：本期沒報告就罰款。 */
function gmPeriodEnd(log){
  const D=G.gmDue;if(!D)return;
  if(!D.done){const t=gmFineNow();if(t){pushNews(t);log.push(t)}}
  G.gmDue=null;
}
/** 菓子折開標後：你是公會長時，得標金進你的現款，記下待報告。 */
function gmLotPaid(M,res){
  if(!gmIsMe()||!res||!res.who||res.who==='me'||!(res.price>0))return;
  G.silver+=res.price;G.gmDue={amt:res.price,mt:M.mt,done:false,exempt:false,shown:false};
  const t=NEWS('gm.lotIn',{a:fmt(res.price),m:gmReportMonth()});pushNews(t);GM_LOG.push(t);
}
/** 本期的報告月（例會月＋2：5、8、11、2 月）。 */
const gmReportMonth=()=>{const start=3+3*Math.floor(((G.month-3+12)%12)/3);return (start+2-1)%12+1};
/** 提醒視窗內容。 */
const gmRemindHtml=()=>UT('gm.remind.body',{a:fmt(G.gmDue.amt),m:gmReportMonth()});

/* ---------- 名望視同四階、頂欄 ---------- */
{const _f=fameTier;fameTier=function(){return gmIsMe()?4:_f()}}
{const _u=updateFame;updateFame=function(){_u();const e=document.getElementById('d-rep');if(e&&G&&gmIsMe())e.textContent+=UT('gm.topTag')}}
{const _fi=ACT.fameInfo;ACT.fameInfo=function(){_fi.apply(this,arguments);if(G&&gmIsMe()){const b=$('#info-body');if(b)b.insertAdjacentHTML('beforeend',UT('gm.fameNote'))}}}

/* ---------- 同業公會長不超賣；你被查獲違約就下台 ---------- */
{const _o=rivalOverMul;rivalOverMul=function(r,c,first){if(G&&G.gm&&r&&r.cid===G.gm.cid)return 0;return _o(r,c,first)}}
{const _c=caughtAdd;caughtAdd=function(key){_c(key);if(key==='me')gmFall()}}

/* ---------- 每旬 ---------- */
function gmTick(log){
  if(!guildMember())(G.gmOut||(G.gmOut={}))[String(G.year)]=true;          // 你今年有一段時間不在協議內
  Object.keys(G.gmOut||{}).forEach(y=>{if(+y<G.year-2)delete G.gmOut[y]});
  const g=gmCid();
  if(g&&g!=='me'){const n=npc(g);if(!n||!alive(g)||n.cityId!==G.cityId){const t=NEWS('gm.vacant',{n:nameOf(g)})+gmSucceed(g);pushNews(t);log.push(t)}}   // 同業公會長過世或離城
  if(gmIsMe())addFame(ODDS.gm.famePerTurn);
  const D=G.gmDue;
  if(gmIsMe()&&D&&!D.done&&G.cycle===1&&G.month===gmReportMonth()){         // 報告月上旬
    const off=gmOfficial();
    if(!off){D.exempt=true;const t=NEWS('gm.noOfficial');pushNews(t);log.push(t)}
    else queueFaceEvent({type:'gmRemind',cid:off.cid,turn:G.turn});
  }
  if(G.gmArb&&G.gmArb.turn<G.turn)G.gmArb=null;                              // 糾紛沒處理：作罷
  if(G.gmLevy&&G.gmLevy.turn<G.turn){const L=G.gmLevy;G.gmLevy=null;payPublic('spend.gmLevy',L.amt);const t=NEWS('gm.levy.auto',{a:fmt(L.amt)});pushNews(t);log.push(t)}   // 攤派沒決定：幕府催繳，自己出
  if(gmIsMe()&&G.cycle===1&&G.month%3===1&&G.guild&&G.gmEvT!==G.guild.mt){   // 例會後第二個月上旬
    G.gmEvT=G.guild.mt;
    if(chance(ODDS.gm.evP))gmEvent(log);
  }
  while(GM_LOG.length){const t=GM_LOG.shift();if(!log.includes(t))log.push(t)}
}

/* ---------- 任內事件 ---------- */
function gmEvent(log){
  const rv=rivalsHere().filter(n=>alive(n.cid)&&!jailed(n));
  const fin=gmOfficial()||Object.values(G.world.npcs).find(n=>n.pos&&n.pos.court==='finance'&&n.cityId===G.cityId&&alive(n.cid));
  const canArb=rv.length>=2,canLevy=!!fin;if(!canArb&&!canLevy)return;
  if(canArb&&(!canLevy||chance(0.5))){
    const [a,b]=shuffle(rv.slice()).slice(0,2).map(n=>n.cid),A=ODDS.gm;
    G.gmArb={a,b,cost:Math.round(rint(A.arbCost[0],A.arbCost[1])/50)*50,turn:G.turn};
    queueFaceEvent({type:'gmArb',cid:a,turn:G.turn});
    log.push(NEWS('gm.arb.news',{a:nameOf(a),b:nameOf(b)}));
  }else{
    const A=ODDS.gm;G.gmLevy={amt:Math.round(rint(A.levy[0],A.levy[1])/100)*100,turn:G.turn,cid:fin.cid,arm:null};
    queueFaceEvent({type:'gmLevy',cid:fin.cid,turn:G.turn});
    log.push(NEWS('gm.levy.news',{a:fmt(G.gmLevy.amt)}));
  }
}
FACE_TITLE.gmArb='gm.arb.title';
FACE_EXT.gmArb=(e,name)=>{
  const o=G.gmArb;if(!o||o.turn!==e.turn)return null;
  const na=nameOf(o.a),nb=nameOf(o.b),A=ODDS.gm;
  return {line:UT('gm.arb.line',{a:na,b:nb}),effect:UT('gm.arb.eff',{f:A.arbFav,h:A.arbHurt,c:fmt(o.cost),m:A.arbAff}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm" data-act="gmArb" data-k="a">'+UT('gm.arb.pick',{n:esc(na)})+'</button><button class="pixel-btn btn-sm" data-act="gmArb" data-k="b">'+UT('gm.arb.pick',{n:esc(nb)})+'</button></div><button class="pixel-btn btn-sm btn-gold" style="width:100%;margin-top:4px" data-act="gmArb" data-k="m" '+(G.silver<o.cost?'disabled':'')+'>'+UT('gm.arb.mediate',{c:coinHtml('silver',o.cost)})+'</button>'};
};
ACT.gmArb=el=>{
  const o=G.gmArb;G.gmArb=null;if(!o){UI.hideInfo();return}
  const k=el.dataset.k,A=ODDS.gm,ra=gmMeet(o.a,'gm.bondArb'),rb=gmMeet(o.b,'gm.bondArb');let msg;
  if(k==='m'){if(G.silver<o.cost){G.gmArb=o;toast(MSG('buyGoods.5',{cost:fmt(o.cost)}));return}
    payPublic('spend.gmMediate',o.cost);setAff(ra,clamp(ra.aff+A.arbAff,0,100));setAff(rb,clamp(rb.aff+A.arbAff,0,100));
    logRel(o.a,UT('gm.log.mediate'));logRel(o.b,UT('gm.log.mediate'));msg=MSG('gm.arb.mediated',{a:nameOf(o.a),b:nameOf(o.b),c:fmt(o.cost)});
  }else{
    const w=k==='a'?o.a:o.b,l=k==='a'?o.b:o.a,rw=R(w),rl=R(l);
    setAff(rw,clamp(rw.aff+A.arbFav,0,100));setAff(rl,clamp(rl.aff-A.arbHurt,0,100));
    logRel(w,UT('gm.log.arbWin'));logRel(l,UT('gm.log.arbLose'));msg=MSG('gm.arb.picked',{w:nameOf(w),l:nameOf(l),f:A.arbFav,h:A.arbHurt});
  }
  toast(msg,4600);sfx.tap();UI.hideInfo();UI.render();
};
FACE_TITLE.gmLevy='gm.levy.title';
FACE_EXT.gmLevy=(e,name)=>{
  const L=G.gmLevy;if(!L||L.turn!==e.turn)return null;
  const A=ODDS.gm,cand=rivalsHere().filter(n=>alive(n.cid)&&!isEnemy(n.cid));
  let b='<button class="pixel-btn btn-sm btn-gold" style="width:100%" data-act="gmLevySelf" '+(G.silver<L.amt&&cand.length?'disabled':'')+'>'+UT('gm.levy.self',{a:fmt(L.amt)})+'</button><div class="tiny muted" style="margin:2px 0 6px">'+(G.silver<L.amt&&cand.length?UT('gm.levy.short'):UT('gm.levy.selfEff',{f:A.levyFame}))+'</div>';
  cand.forEach(n=>{const r=R(n.cid),full=r.aff>=100,half=Math.round(L.amt/2);
    b+='<div class="card" style="margin:3px 0"><div class="row"><span class="small"><b>'+esc(nameOf(n.cid))+'</b> <span class="tag '+affCls(r.aff)+'">'+affWord(r.aff)+'</span></span>'
      +(L.arm===n.cid?'':'<button class="pixel-btn btn-sm" data-act="gmLevyPick" data-cid="'+n.cid+'">'+UT('gm.levy.pick')+'</button>')+'</div>'
      +'<div class="tiny muted">'+(full?UT('gm.levy.full',{d:A.levyAff}):UT('gm.levy.half',{a:fmt(half),f:A.levyFame,d:A.levyAff}))+'</div>'
      +(L.arm===n.cid?'<div class="notice tiny" style="margin-top:3px">'+UT('gm.levy.confirm',{n:esc(nameOf(n.cid))})+'</div><div class="grid2"><button class="pixel-btn btn-sm btn-red" data-act="gmLevyOk">'+UT('gm.levy.ok')+'</button><button class="pixel-btn btn-sm" data-act="gmLevyCancel">'+UT('btn.cartel3Cancel')+'</button></div>':'')+'</div>'});
  b+='<div class="tiny muted" style="margin-top:4px">'+UT('gm.levy.noEnemy')+'</div>';
  return {line:UT('gm.levy.line',{a:fmt(L.amt)}),effect:'',buttons:b};
};
const gmLevyShow=()=>{const L=G.gmLevy;if(!L)return;const e={type:'gmLevy',cid:L.cid,turn:L.turn};UI.showInfo(faceTitle(e),faceEventCard(e))};
ACT.gmLevySelf=()=>{
  const L=G.gmLevy;if(!L){UI.hideInfo();return}
  const cand=rivalsHere().filter(n=>alive(n.cid)&&!isEnemy(n.cid));
  if(G.silver<L.amt&&cand.length){toast(MSG('buyGoods.5',{cost:fmt(L.amt)}));return}
  G.gmLevy=null;payPublic('spend.gmLevy',L.amt);const f=addFame(ODDS.gm.levyFame,'major');
  toast(MSG('gm.levy.paid',{a:fmt(L.amt),f}),4200);sfx.coin();UI.hideInfo();UI.render();
};
ACT.gmLevyPick=el=>{const L=G.gmLevy;if(!L)return;L.arm=el.dataset.cid;gmLevyShow()};
ACT.gmLevyCancel=()=>{const L=G.gmLevy;if(!L)return;L.arm=null;gmLevyShow()};
ACT.gmLevyOk=()=>{
  const L=G.gmLevy;if(!L||!L.arm)return;G.gmLevy=null;
  const cid=L.arm,r=gmMeet(cid,'gm.bondLevy'),full=r.aff>=100,A=ODDS.gm;
  setAff(r,clamp(r.aff-A.levyAff,0,100));r.peak=Math.max(r.peak||0,r.aff+ENEMY_GAP);logRel(cid,UT('gm.log.levy'));   // 一定成仇（曾經最高好感補到成仇的差距）
  let msg;
  if(full)msg=MSG('gm.levy.assignFull',{n:nameOf(cid),d:A.levyAff});
  else{const half=Math.round(L.amt/2);payPublic('spend.gmLevy',half);loseFame('gmLevy');msg=MSG('gm.levy.assignHalf',{n:nameOf(cid),a:fmt(half),f:A.levyFame,d:A.levyAff})}
  toast(msg,5200);sfx.bad();UI.hideInfo();UI.render();
};

/* ---------- 候選人上門塞錢、報告提醒 ---------- */
FACE_TITLE.gmBribe='gm.bribe.title';
FACE_EXT.gmBribe=(e,name)=>{
  const M=G.guild,E=M&&M.mt===e.turn&&M.el,o=E&&E.bribe[e.cid];if(!o||o.st!==null)return null;
  return {line:TX('gm.bribe',{n:name}),effect:UT('gm.bribe.eff',{a:fmt(o.amt)}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="gmBribe" data-cid="'+e.cid+'" data-v="1">'+UT('gm.bribe.yes')+'</button><button class="pixel-btn btn-sm" data-act="gmBribe" data-cid="'+e.cid+'" data-v="0">'+UT('gm.bribe.no')+'</button></div>'};
};
ACT.gmBribe=el=>{
  const M=G.guild,E=M&&M.el,o=E&&E.bribe[el.dataset.cid];
  if(o&&o.st===null){
    gmMeet(el.dataset.cid,'gm.bondBribe');
    if(el.dataset.v==='1'){o.st='yes';G.gold+=o.amt;logRel(el.dataset.cid,UT('gm.log.bribe',{a:o.amt}));toast(MSG('gm.bribe.took',{n:nameOf(el.dataset.cid),a:fmt(o.amt)}));sfx.coin()}
    else{o.st='no';toast(MSG('gm.bribe.refused',{n:nameOf(el.dataset.cid)}))}
  }
  UI.hideInfo();UI.render();
};
FACE_TITLE.gmRemind='gm.remind.title';
FACE_EXT.gmRemind=(e,name)=>{const D=G.gmDue;if(!gmIsMe()||!D||D.done)return null;return {line:gmRemindHtml(),effect:''}};

/* ---------- 選舉畫面（例會第一步） ---------- */
/** 拉票的心防：同業心防 × 3 × 對手係數（投票人與對手的性向相容），對手市佔比你高時再加。 */
function gmCanvassHp(v,opp){
  const A=ODDS.gm,coef=A.canvassComp[compat(v,opp).matches],d=Math.max(0,gmShare(opp)-gmShare('me'));
  return {hp:Math.round(btHp(v)*A.canvassX*coef*(1+A.canvassShare*d)),coef};
}
/** 你是候選人：跳過仇人（直接投對方），全部問完就開票。 */
function gmCanvassNext(E){
  const opp=E.cands.find(k=>k!=='me');
  while(E.idx<E.voters.length&&isEnemy(E.voters[E.idx])){E.votes[E.voters[E.idx]]=opp;E.idx++}
  if(E.idx>=E.voters.length&&!E.done)gmTally(E);
}
function gmElectHtml(M){
  const E=M.el,[A,B]=E.cands;let info='',act='';
  const rowsAll=['me'].concat(rivalsHere().filter(n=>alive(n.cid)).map(n=>n.cid));
  info='<div class="notice tiny">'+(E.first?UT('gm.el.first'):UT('gm.el.rule'))+'</div>';
  if(!E.first)info+='<div class="card tiny">'+UT('gm.el.caughtHead')+rowsAll.map(k=>'<div class="row"><span>'+esc(gmName(k))+'</span><span>'+UT('gm.el.caught',{n:gmScore(k)})+'</span></div>').join('')+'</div>';
  info+='<div class="card"><b class="small">'+UT('gm.el.cands')+'</b>'+E.cands.map(k=>'<div class="row small" style="margin-top:3px"><span>'+(k==='me'?'':portraitHtml(k,32))+esc(gmName(k))+'</span><span class="tiny muted">'+UT('gm.el.share',{p:(gmShare(k)*100).toFixed(1)})+'</span></div>').join('')+'</div>';
  if(E.single){act='<div class="notice">'+UT('gm.el.single',{n:esc(gmName(E.winner))})+'</div>'+UT('gm.next');return {info,act}}
  if(E.done){
    const L=Object.keys(E.votes).map(v=>'<div class="row tiny"><span>'+esc(gmName(v))+'</span><span>'+UT('gm.el.voteFor',{n:esc(gmName(E.votes[v]))})+'</span></div>').join('');
    act='<div class="card">'+L+'<div class="row small" style="border-top:1px solid #d8ccb3;margin-top:4px;padding-top:4px"><span>'+UT('gm.el.count',{a:esc(gmName(A)),x:E.count[A],b:esc(gmName(B)),y:E.count[B]})+'</span></div>'+(E.tie?'<div class="tiny muted">'+UT('gm.el.tie')+'</div>':'')+'<div class="notice" style="margin-top:4px">'+UT('gm.el.win',{n:esc(gmName(E.winner))})+'</div></div>'+UT('gm.next');
    return {info,act};
  }
  if(!E.cands.includes('me')){
    act='<div class="tiny muted">'+UT('gm.el.voteNote',{d:ODDS.gm.voteAff})+'</div><div class="grid2">'+E.cands.map(k=>'<button class="pixel-btn btn-gold" data-act="gmVote" data-k="'+k+'">'+UT('gm.el.voteBtn',{n:esc(gmName(k))})+'</button>').join('')+'</div><button class="pixel-btn" style="width:100%;margin-top:4px" data-act="gmVote" data-k="none">'+UT('gm.el.abstain')+'</button>';
    return {info,act};
  }
  gmCanvassNext(E);if(E.done)return gmElectHtml(M);
  const v=E.voters[E.idx],r=R(v),friend=r.aff>=FRIEND_AFF;
  act='<div class="notice tiny">'+UT('gm.el.canvassNote',{i:E.idx+1,n:E.voters.length})+'</div><div class="card" style="display:flow-root">'+portraitHtml(v,48)+'<b>'+esc(nameOf(v))+'</b> <span class="tag gray">'+UT('gmeet.meetTalkHtml.2')+'</span>'
    +(friend?'<div class="tiny muted" style="margin-top:3px">'+UT('gm.el.noGift')+'</div>':'<div class="small" style="margin-top:3px">'+UT('gm.el.gift')+' <select id="gm-gift">'+giftOptions(v)+'</select></div>')
    +'<button class="pixel-btn btn-gold" style="width:100%;margin-top:6px" data-act="gmCanvass">'+UT('gm.el.canvassBtn')+'</button></div>';
  return {info,act};
}
/** 例會沒出席或沒走完：你是候選人而沒出席＝市佔較高者當選；拉票到一半，剩下的人投對方；你不是候選人＝同業照相容投、你沒有票。 */
function gmElectAuto(M){
  const E=M.el;if(!E||E.done)return;
  if(E.cands.includes('me')){
    const opp=E.cands.find(k=>k!=='me');
    if(!M.att||!Object.keys(E.votes).length){E.absent=true;gmElectFinish(E,gmShare('me')>gmShare(opp)?'me':opp);return}
    E.voters.forEach(v=>{if(!E.votes[v])E.votes[v]=opp});gmTally(E);return;
  }
  const [A,B]=E.cands;E.voters.forEach(v=>{E.votes[v]=gmRivalPick(v,A,B)});gmTally(E);
}
ACT.gmVote=el=>{
  const M=meetNow(),E=M&&M.el;if(!E||E.done||E.cands.includes('me'))return;
  const k=el.dataset.k,[A,B]=E.cands;
  E.voters.forEach(v=>{E.votes[v]=gmRivalPick(v,A,B)});
  if(k&&k!=='none'){E.votes.me=k;E.myVote=k;const o=k===A?B:A,d=ODDS.gm.voteAff;
    [[k,d],[o,-d]].forEach(([c,x])=>{const r=R(c);setAff(r,clamp(r.aff+x,0,100));logRel(c,UT(x>0?'gm.log.voteFor':'gm.log.voteAgainst'))})}
  gmTally(E);sfx.step();refreshSheet();UI.render();
};
ACT.gmCanvass=()=>{
  const M=meetNow(),E=M&&M.el;if(!E||E.done)return;
  const v=E.voters[E.idx];if(!v)return;
  const opp=E.cands.find(k=>k!=='me'),sel=document.getElementById('gm-gift'),gift=sel?sel.value:null,c=gmCanvassHp(v,opp);
  gmMeet(v,'gm.bondLabel');
  battleStart(v,gift);
  BT.mode='canvass';BT.opp=opp;BT.hp=c.hp;
  BT.open=TX(c.coef>=1.5?'gm.canvass.hard':c.coef<=0.5?'gm.canvass.easy':'gm.canvass.mid',{o:gmName(opp)});
  battleShow();
};
/** 拉票與報告的戰鬥結算（取代一般拜訪的結算）。 */
function gmBattleEnd(){
  const B=BT;B.done=true;musicWant('market');
  const cid=B.cid,r=R(cid),win=B.dmg>=B.hp;
  let gain=(win?10+btBondBonus(r):Math.floor(5*B.dmg/B.hp))+B.hits;gain=Math.max(0,Math.min(gain,100-r.aff));
  setAff(r,clamp(r.aff+gain,0,100));r.lastOk=true;
  let msg;
  if(B.mode==='canvass'){
    const M=meetNow(),E=M&&M.el;
    if(E&&!E.done){E.votes[cid]=win?'me':B.opp;E.idx++;gmCanvassNext(E)}
    logRel(cid,UT(win?'gm.log.canvassWin':'gm.log.canvassLose',{a:B.spent}));
    msg=(win?TX('gm.canvassWin'):TX('gm.canvassLose',{o:gmName(B.opp)}))+UT('gm.gain',{g:gain});
  }else{
    const D=G.gmDue,pass=win||(B.round>=3&&B.hits>0);
    if(D&&!D.done){D.done=true;
      if(pass){msg=TX('gm.reportOk');const t=NEWS('gm.reported',{a:fmt(D.amt)});pushNews(t);GM_LOG.push(t)}
      else{const f=Math.round(D.amt*ODDS.gm.fineX);payPublic('spend.gmFine',f);msg=TX('gm.reportFail')+MSG('gm.fined',{a:fmt(f)});const t=NEWS('gm.fine',{a:fmt(f)});pushNews(t);GM_LOG.push(t)}
    }
    logRel(cid,UT(pass?'gm.log.reportOk':'gm.log.reportFail',{a:B.spent}));
  }
  BT=null;UI.hideInfo();toast(msg,4600);if(win)sfx.gift();
  refreshSheet();UI.render();
}
{const _be=battleEnd;battleEnd=function(){if(BT&&!BT.done&&BT.mode){gmBattleEnd();return}return _be.apply(this,arguments)}}

/* ---------- 向御金奉行報告 ---------- */
/** 這位官員是不是本期要報告的對象，而且這個月在城裡。 */
const gmReportTarget=cid=>{const D=G.gmDue,off=gmOfficial();return !!(gmIsMe()&&D&&!D.done&&!D.exempt&&off&&off.cid===cid&&tourHere(off))};
{const _pb=personBlock;personBlock=function(cid,ctx){
  const h=_pb.apply(this,arguments);
  if(!gmReportTarget(cid))return h;
  return '<div class="card warn"><b class="small">'+UT('gm.report.tag')+'</b><div class="tiny" style="margin:3px 0">'+UT('gm.report.note',{a:fmt(G.gmDue.amt)})+'</div><button class="pixel-btn btn-sm btn-gold" data-act="gmReport" data-cid="'+cid+'">'+UT('gm.report.btn')+'</button></div>'+h;
}}
ACT.gmReport=el=>{
  const cid=el.dataset.cid;if(!gmReportTarget(cid))return;
  if(apLeft()<=0){toast(MSG('go.2'));return}
  if(!spendAP())return;
  battleStart(cid,null);
  BT.mode='report';BT.mult=1;BT.open=TX('gm.reportOpen');
  battleShow();
};

/* ---------- 例會：公會長不能退出協議；散會提醒；大盤頁顯示現任 ---------- */
{const _c=ACT.cartel;ACT.cartel=function(el){if(gmIsMe()&&el&&el.dataset.s==='none'){toast(MSG('gm.noQuit'));return}return _c.apply(this,arguments)}}
{const _e=ACT.meetEnd;ACT.meetEnd=function(){
  const M=meetNow();_e.apply(this,arguments);
  const D=G.gmDue;
  if(M&&gmIsMe()&&D&&D.mt===M.mt&&!D.shown){D.shown=true;UI.showInfo(UT('gm.remind.title'),'<div class="small">'+gmRemindHtml()+'</div>'+UT('face.buttons'))}
}}
/** 沒出席的例會：得標金的提醒改在旬報後出現。 */
function gmAutoRemind(M){const D=G.gmDue,off=gmOfficial();if(M&&gmIsMe()&&D&&D.mt===M.mt&&!D.shown&&off){D.shown=true;queueFaceEvent({type:'gmRemind',cid:off.cid,turn:G.turn})}}
{const _g=guildInfoCard;guildInfoCard=function(){const g=gmCid();return _g.apply(this,arguments)+'<div class="row tiny" style="margin-top:3px"><span>'+UT('gm.info')+'</span><b>'+(g?esc(gmName(g)):UT('gm.info.none'))+'</b></div>'}}
/** 開局：開業旬報之後接著候選人上門。 */
{const _b=ACT.begin;ACT.begin=function(){_b.apply(this,arguments);armFaceEvents()}}
