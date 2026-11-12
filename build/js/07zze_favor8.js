'use strict';
/* =====================================================================
 * 07zze_favor8.js — 0.8 先行的一批請託與規則（DESIGN_NOTES 第 152、204～206 節、第二十九節五六階）
 *  - 走私失敗後船長三旬不敢出海（第 152 節第一項）：一般走私遇險或入港被扣，從當旬起三旬所有船長不肯出海
 *    （不能走私、不能派海運委託與卸留請負的海運外運）；唐船割符不觸發、也不受限。
 *  - 破船賑、盜難賑（遠國奉行所五階，本地；第 204 節）：叫一位閒著的船長／飛腳演戲，當場領撫恤銀；他三旬不能出門；
 *    好感 −15、風聲 +1.5；兩項各一年一次。
 *  - 株札暫扣（吟味方五階 町奉行；第 204 節）：公款 3,000 兩；挑一家同業停業三旬（不出貨、不超賣），他的份額轉給你
 *    （穩定供貨線、協議配額、相場進貨上限都加上他那一份）；他對你好感 −30；風聲 +1；冷卻 12 旬。
 *  - 專賣株（勘定方五階 勘定奉行三旬 5,000 兩／六階 御金奉行九旬 10,000 兩；第二十九節）：選一項有交易許可的本業貨，
 *    期間本城同業與零星商家都不能出這項貨，進貨上限加倍；穩定供貨線＝本城全部需求，協議配額不適用；同時一張，冷卻 3 旬。
 *  - 闕所（遠國奉行所六階 巡見使，好感 100 特殊請託，本地；第二十九節）：私房錢 1,000 兩，挑一家同業永久除名（不補人）；
 *    本城同業至少三家才出現；訂約金作廢併入本期違約金；他是公會長時由另一位候選人接任。
 *  - 新町取立（普請方五階 普請奉行；第二十九節、第 205 節）：公款 6,000 兩，走申請審理；成功率第一次 40%、第二次 70%、第三次一定成功；
 *    成功時本城人口 +5%、寫進城史；審理完成後冷卻 12 旬，冷卻期間季度人口因城裡缺貨而減少的幅度減半。
 *  - 三階的災損申請（第 206 節）：火難御救（普請方三階）、荷損御賑（勘定方三階）、盜難御賑（吟味方三階）；
 *    只能在事件發生的當旬申請；損失貨值的五成、最多 800 兩（盜難御賑改為追回贓貨，貨值最多 800 兩）。
 *  數值 ODDS.f8；文字 fav.*、f8.*（01e、01f、01g）。
 *  狀態：G.seaFear、G.fraudY{sea,land}、n.suspUntil、G.mono{name,until}、G.newTown{tries,cd}、G.loss{fire,theft,cargo}、n.kessho。
 * ===================================================================== */
const F8=()=>ODDS.f8;

/* ---------- 一、走私失敗後船長不敢出海 ---------- */
const seaFear=()=>!!G&&(G.seaFear||-1)>=G.turn;
const seaFearLeft=()=>seaFear()?G.seaFear-G.turn+1:0;
/** 一般走私出事：從這一旬起三旬（含當旬）。 */
function seaFearStart(log){G.seaFear=G.turn+F8().fearTurns-1;const t=NEWS('f8.fear',{n:F8().fearTurns});if(!log.includes(t))log.push(t)}
const seaFearNote=()=>'<div class="notice">'+UT('f8.fearNote',{n:seaFearLeft()})+'</div>';
{const _s=ACT.smugGo;ACT.smugGo=function(){if(seaFear()){toast(UT('f8.fearNote',{n:seaFearLeft()}),4200);return}return _s.apply(this,arguments)}}
{const _v=ACT.vAdd;ACT.vAdd=function(){if(UI.s.route&&UI.s.route.mode==='sea'&&seaFear()){toast(UT('f8.fearNote',{n:seaFearLeft()}),4200);return}return _v.apply(this,arguments)}}
{const _sv=sendVoyage;sendVoyage=function(captId,budget,destId,mode,free,batch){if((mode||'sea')==='sea'&&!free&&seaFear())return {ok:false,msg:UT('f8.fearNote',{n:seaFearLeft()})};return _sv.apply(this,arguments)}}
{const _u=ACT.ujGo;ACT.ujGo=function(){if(G.ujob&&G.ujob.mode==='sea'&&seaFear()){toast(UT('f8.fearNote',{n:seaFearLeft()}),4200);return}return _u.apply(this,arguments)}}
{const _vp=voyagePanel;voyagePanel=function(){const R_=UI.s.route;if(R_&&R_.mode!=='land'&&seaFear())return seaFearNote();return _vp.apply(this,arguments)}}
{const _sh=SHEETS.smuggle;SHEETS.smuggle=function(){const o=_sh.apply(this,arguments);if(seaFear())o.html=seaFearNote()+o.html;return o}}

/* ---------- 請託登記 ---------- */
const F8_ADM=[{k:'fireAid',rank:3,exactRank:true,cd:12,avail:()=>lossOpen('fire')},{k:'newTown',apply:true,rank:5,exactRank:true}];
const F8_FIN=[{k:'cargoAid',rank:3,exactRank:true,cd:12,avail:()=>lossOpen('cargo')},{k:'mono5',rank:5,exactRank:true,cd:3,avail:()=>!monoNow()&&tradeComms().length>0},{k:'mono6',rank:6,exactRank:true,cd:3,avail:()=>!monoNow()&&tradeComms().length>0}];
const F8_JUD=[{k:'theftAid',rank:3,exactRank:true,cd:12,avail:()=>lossOpen('theft')},{k:'suspend',rank:5,exactRank:true,cd:12,avail:()=>suspTargets().length>0}];
F8_ADM.forEach(f=>FAVORS.administration.push(favorText(f)));F8_FIN.forEach(f=>FAVORS.finance.push(favorText(f)));F8_JUD.forEach(f=>FAVORS.judiciary.push(favorText(f)));
REG_FAVORS.push(
  {k:'rwreck',rank:5,pos:['reg_08'],local:true,drop:15,avail:()=>fraudOpen('sea')},
  {k:'rrobbed',rank:5,pos:['reg_07'],local:true,drop:15,avail:()=>fraudOpen('land')}
);
REG_FAVORS.filter(f=>f.k==='rwreck'||f.k==='rrobbed').forEach(f=>{f.name=UT('fav.'+f.k);f.desc=UT('fav.'+f.k+'.d')});
/** 需要先挑對象的請託：回傳選單 HTML（07u_battle.js 的 ACT.reqAsk）。 */
const FAVOR_PICK={};
/** 開口前的檢查（錢不夠等）；回傳不能辦的原因。 */
{const _chk=regFavorCheck;regFavorCheck=function(f,n){
  const k=f&&f.k;
  if(k==='suspend'&&G.silver<F8().suspCost)return MSG('f8.short',{a:fmt(F8().suspCost)});
  if((k==='mono5'||k==='mono6')&&G.silver<F8().mono[k].cost)return MSG('f8.short',{a:fmt(F8().mono[k].cost)});
  return _chk.apply(this,arguments);
}}
const pickRow=(cid,k,t,label,note)=>'<div class="irow" style="margin-top:4px"><div class="row"><b class="small">'+label+'</b><button class="pixel-btn btn-sm btn-gold" data-act="reqAsk" data-cid="'+cid+'" data-k="'+k+'" data-t="'+t+'">'+UT('f8.pick')+'</button></div>'+(note?'<div class="tiny muted">'+note+'</div>':'')+'</div>';

/* ---------- 二、破船賑、盜難賑（詐領） ---------- */
const fraudMode=k=>k==='rwreck'?'sea':'land';
function fraudOpen(mode){return (G.fraudY||{})[mode]!==G.year&&idleCaptains(mode).length>0}
function fraudDo(mode){
  const e=idleCaptains(mode)[0];if(!e)return MSG('f8.noCrew',{m:NM('crew',mode)});
  (G.fraudY||(G.fraudY={}))[mode]=G.year;
  const R_=F8().fraud[mode],amt=rint(R_[0],R_[1]);
  e.hurtUntil=G.turn+F8().fraudRest;G.silver+=amt;addHeat(F8().fraudHeat,true);
  const t=NEWS('f8.fraud.'+mode,{e:e.name,a:fmt(amt)});pushNews(t);
  return MSG('f8.fraud.'+mode,{e:e.name,a:fmt(amt),t:F8().fraudRest});
}
REG_FAVOR.rwreck=()=>fraudDo('sea');
REG_FAVOR.rrobbed=()=>fraudDo('land');

/* ---------- 三、株札暫扣 ---------- */
const suspended=n=>!!(n&&(n.suspUntil||-1)>=G.turn);
const suspTargets=()=>rivalsHere().filter(n=>alive(n.cid)&&!suspended(n)&&!jailed(n));
/** 你從暫扣中的同業接下的市佔份額。 */
function suspBonus(){
  const rows=(G.share&&G.share.rows)||[];let s=0;
  rivalsHere().forEach(n=>{if(suspended(n)){const r=rows.find(x=>x.cid===n.cid);if(r)s+=r.share||0}});
  return s;
}
FAVOR_PICK.suspend=cid=>{
  const L=suspTargets().slice().sort((a,b)=>isEnemy(b.cid)-isEnemy(a.cid));
  return portraitHtml(cid,56)+'<div class="notice tiny">'+UT('f8.suspPick',{a:fmt(F8().suspCost),d:F8().suspAff})+'</div>'+L.map(n=>pickRow(cid,'suspend',n.cid,esc(nameOf(n.cid))+(isEnemy(n.cid)?UT('f8.enemyTag'):'')+(G.gm&&G.gm.cid===n.cid?UT('f8.gmTag'):''))).join('');
};
REG_FAVOR.suspend=(n,arg)=>{
  const t=npc(arg);if(!t||!suspTargets().includes(t))return MSG('f8.suspNone');
  payPublic('spend.f8Susp',F8().suspCost);addHeat(F8().suspHeat);
  t.suspUntil=G.turn+F8().suspTurns-1;
  const r=R(t.cid);if(!r.bond){r.bond={mult:1,label:UT('f8.bondSusp'),introId:null};r.met=true;r.seen=true;addKnown(t.cid)}
  setAff(r,clamp(r.aff-F8().suspAff,0,100));logRel(t.cid,UT('f8.log.susp'));
  G.share=marketShares();ownComms().forEach(c=>{const m=G.mk[c.name];m.so=rivalSupply(c,m,false)});
  const nw=NEWS('f8.susp',{n:nameOf(t.cid)});pushNews(nw);
  return MSG('f8.suspDone',{n:nameOf(t.cid),t:F8().suspTurns,d:F8().suspAff});
};

/* ---------- 四、專賣株 ---------- */
const monoNow=()=>!!(G&&G.mono&&G.mono.until>=G.turn);
const monoItem=name=>monoNow()&&G.mono.name===name;
FAVOR_PICK.mono5=cid=>monoPick(cid,'mono5');FAVOR_PICK.mono6=cid=>monoPick(cid,'mono6');
function monoPick(cid,k){
  const M=F8().mono[k];
  return portraitHtml(cid,56)+'<div class="notice tiny">'+UT('f8.monoPick',{a:fmt(M.cost),t:M.turns})+'</div>'+tradeComms().map(c=>pickRow(cid,k,c.name,esc(c.short),UT('f8.monoNeed',{d:Math.round((G.mk[c.name].D||0)*M.turns)}))).join('');
}
function monoDo(k,arg){
  const M=F8().mono[k],c=COMM_MAP[arg];if(!c||!tradeOK(arg)||monoNow())return MSG('f8.monoNone');
  payPublic('spend.f8Mono',M.cost);
  G.mono={name:arg,until:G.turn+M.turns-1,from:G.turn};
  const m=G.mk[arg];m.so=rivalSupply(c,m,false);
  const t=NEWS('f8.mono',{n:c.short,t:M.turns});pushNews(t);
  return MSG('f8.monoDone',{n:c.short,t:M.turns});
}
REG_FAVOR.mono5=(n,arg)=>monoDo('mono5',arg);REG_FAVOR.mono6=(n,arg)=>monoDo('mono6',arg);

/* ---------- 同業出貨：暫扣的同業停業、專賣的貨同業與零星商家都不出（rivalSupply 內處理，03_market.js）；不會超賣 ---------- */
{const _o=rivalOverMul;rivalOverMul=function(r,c,first){
  const v=_o(r,c,first),n=npc(r.cid),m=n&&n.ms;
  if(m&&m.ovDec===G.turn&&m.ovItem&&(suspended(n)||monoItem(m.ovItem)))m.ovItem=null;   // 停業或專賣的貨不會超賣
  return m&&m.ovItem===c.name?v:0;
}}

/* ---------- 五、闕所 ---------- */
{const _sp=specialList;specialList=function(cid){
  const out=_sp.apply(this,arguments),n=npc(cid),r=R(cid);
  if(n&&n.pos&&n.pos.court==='region'&&n.pos.posId==='reg_10'&&!foreignReg(n)&&r.aff>=100&&!r.specialUsed&&kesshoTargets().length>=F8().kesshoMin)
    out.push({k:'sp_kessho',special:'kessho',name:UT('f8.kessho'),desc:UT('f8.kessho.d',{a:fmt(F8().kesshoGold)})});
  return out;
}}
const kesshoTargets=()=>rivalsHere().filter(n=>alive(n.cid));
function kesshoPick(cid){
  const L=kesshoTargets().slice().sort((a,b)=>isEnemy(b.cid)-isEnemy(a.cid));
  return portraitHtml(cid,56)+'<div class="notice tiny">'+UT('f8.kesshoPick',{a:fmt(F8().kesshoGold)})+'</div>'+L.map(n=>pickRow(cid,'sp_kessho',n.cid,esc(nameOf(n.cid))+(isEnemy(n.cid)?UT('f8.enemyTag'):'')+(G.gm&&G.gm.cid===n.cid?UT('f8.gmTag'):''))).join('');
}
/** 執行闕所（好感與一生一次已在 ACT.reqAsk 扣過）。 */
function kesshoDo(cid,tcid){
  const t=npc(tcid);if(!t||t.role!=='rival'||t.cityId!==G.cityId)return;
  G.gold-=F8().kesshoGold;
  const C=G.cartel;if(C&&C.bond>0)C.pot=(C.pot||0)+costOf('guildBond');      // 他的訂約金作廢，併入本期違約金
  t.cityId=null;t.kessho=true;evilAdd('kessho',tcid);   // 惡德（07zzl_tripev2.js）
  logRel(tcid,UT('f8.log.kessho'));
  let msg=NEWS('f8.kesshoNews',{n:nameOf(tcid)});
  if(G.gm&&G.gm.cid===tcid)msg+=gmSucceed(tcid);
  pushNews(msg);
  G.share=marketShares();ownComms().forEach(c=>{const m=G.mk[c.name];m.so=rivalSupply(c,m,false)});
  sfx.bad();UI.render();
  UI.showInfo(UT('bt.reqAsk.2',{a:nameOf(cid)}),portraitHtml(cid,56)+'<div class="notice" style="margin-top:6px">'+esc(msg)+'</div><button class="pixel-btn btn-sm" data-act="reqDone" style="margin-top:6px">'+UT('cm.ok')+'</button>');
}

/* ---------- 六、新町取立 ---------- */
const NT=()=>G.newTown||(G.newTown={tries:0,cd:-1});
const newTownCool=()=>NT().cd>=G.turn;
{const _fd=favorDone;favorDone=function(f,n){if(f&&f.k==='newTown')return newTownCool();return _fd.apply(this,arguments)}}
{const _af=applyFavor;applyFavor=function(cid,n,r,f){
  if(f&&f.k==='newTown'){
    if(newTownCool())return {ok:true,status:'held',msg:MSG('f8.ntCool',{n:NT().cd-G.turn+1})};
    if(!favorPending(f)&&!(G.apps||[]).some(a=>a.key===f.k&&a.cid===cid)){
      if(G.silver<F8().newTown.cost)return {ok:true,status:'held',msg:MSG('f8.short',{a:fmt(F8().newTown.cost)})};
      payPublic('spend.f8NewTown',F8().newTown.cost);
    }
  }
  return _af.apply(this,arguments);
}}
{const _ag=appGrant;appGrant=function(A,log){
  if(A.key!=='newTown')return _ag.apply(this,arguments);
  const N=NT(),p=F8().newTown.p[Math.min(N.tries,F8().newTown.p.length-1)],ok=rnd()<p;
  N.cd=G.turn+F8().newTown.cd-1;
  let t;
  if(ok){
    const ct=homeCity(),before=Number.isFinite(G.cityPopulation)?G.cityPopulation:cityPop(ct),after=Math.round(before*(1+F8().newTown.pop));
    G.cityPopulation=after;N.tries=0;
    G.cityHist=G.cityHist||{};(G.cityHist[ct.id]=G.cityHist[ct.id]||[]).push({year:G.year,title:NEWS('f8.ntHist',{f:G.firm||gmName('me'),a:fmt(before),b:fmt(after)})});
    Object.entries(G.mk).forEach(([nm,m])=>{m.D=cityD(ct,COMM_MAP[nm])});   // 人口增加後立即重算需求（穩定供貨線、配額、進貨上限、庫存上限都跟著變）
    t=NEWS('f8.ntOk',{a:fmt(before),b:fmt(after)});sfx.fanfare();
  }else{N.tries++;t=NEWS('f8.ntFail');sfx.bad()}
  logRel(A.cid,UT('reg.appGrant',{a:A.name}));
  pushNews(t);log.push(t);
}}
/** 季度人口：新町取立冷卻期間，因城裡缺貨而減少的幅度減半。 */
{const _pt=populationTick;populationTick=function(log){
  const before=Number.isFinite(G.cityPopulation)?G.cityPopulation:null;
  _pt.apply(this,arguments);
  const P=TURNRP&&TURNRP.population;
  if(P&&newTownCool()&&P.rate<0&&before!==null&&P.before===before){
    const half=Math.max(ODDS.cityPopulation.min,Math.round(P.before*(1+P.rate/2)));
    G.cityPopulation=half;P.after=half;P.rate=P.rate/2;
    log.push(NEWS('f8.ntSoft',{a:fmt(P.before),b:fmt(half)}));
  }
}}

/* ---------- 七、三階的災損申請 ---------- */
const lossNow=k=>{const L=G.loss&&G.loss[k];return L&&L.turn===G.turn&&!L.claimed?L:null};
const lossOpen=k=>!!lossNow(k);
/** 記下這一旬的災損（同一旬取最大的一次）。kind：fire／theft／cargo。 */
function lossNote(kind,value,item){
  if(!(value>0))return;G.loss=G.loss||{};const L=G.loss[kind];
  if(L&&L.turn===G.turn&&L.value>=value)return;
  G.loss[kind]={turn:G.turn,value:Math.round(value),item:item||null,claimed:false};
}
const lossPay=L=>Math.min(F8().lossCap,Math.round(L.value*F8().lossRate));
function lossClaim(kind){
  const L=lossNow(kind);if(!L)return MSG('f8.lossNone');
  L.claimed=true;
  if(kind==='theft'){
    const it=L.item,c=it&&COMM_MAP[it.n];if(!c)return MSG('f8.lossNone');
    const unit=Math.max(0.1,marketQuote(it.n));
    let q=Math.max(1,Math.round(it.q*(F8().theftBack[0]+rnd()*(F8().theftBack[1]-F8().theftBack[0]))));
    q=Math.min(q,Math.floor(F8().lossCap/unit)||1,Math.max(0,invCap()-invUsed()));
    if(q<=0)return MSG('f8.theftFull');
    const avg=(G.avgCost&&G.avgCost[it.n])||c.base;addStock(it.n,q,avg);stockAdd(it.n,q,false);
    return MSG('f8.theftBack',{n:c.short,q});
  }
  const a=lossPay(L);G.silver+=a;
  return MSG(kind==='fire'?'f8.fireAid':'f8.cargoAid',{a:fmt(a)});
}
REG_FAVOR.fireAid=()=>lossClaim('fire');REG_FAVOR.cargoAid=()=>lossClaim('cargo');REG_FAVOR.theftAid=()=>lossClaim('theft');

/* ---------- 每旬 ---------- */
function f8Tick(log){
  rivalsHere().forEach(n=>{if(n.suspUntil!==undefined&&n.suspUntil<G.turn){delete n.suspUntil;const t=NEWS('f8.suspEnd',{n:nameOf(n.cid)});pushNews(t);log.push(t)}});
  if(G.mono&&G.mono.until<G.turn){const t=NEWS('f8.monoEnd',{n:COMM_MAP[G.mono.name].short});pushNews(t);log.push(t);G.mono=null}
}
