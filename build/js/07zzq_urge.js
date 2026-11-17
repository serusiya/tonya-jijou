'use strict';
/* ★檔案總覽：官府督促、御救販售、闇商代出（DESIGN_NOTES 第二百五十、二百五十六節）
 * - 督促（第二百九十六節）：米問屋、魚屋只有打毀督促（36 旬內第二次打毀，普請方四階町年寄出面）；其他行業只有人口督促（季度人口連續三季減少，例會當月在城的吟味方六階出面，G.urge）。
 *   不看市佔、不看協議、不必出席例會。
 * - 傳喚（G.urgeCall）：督促那一旬，旬報一則，主畫面例會按鈕的位置（例會旬在其上）出現紅底金字按鈕；前往扣 1 行動，會場三步：
 *   訓話（交情好被點名說好話）→ 公會長入內細談（高官換一副嘴臉）→ 分配出貨額：你是公會長可全部接下（不加名聲）或分配下去（只拿市佔那一份）；不是公會長一定分到市佔那一份。
 * - 不理（這一旬沒去）：下一旬罰現款四分之一、最低兩千兩（可扣成負數），G.urgePend 九旬期滿時由其他商號解決。去了卻沒選完：照預設分配。
 * - c 御救販售（G.kyusai，kind：pop 人口、riot 平準出貨；pm 收購價倍率；all 公會長全數承接）：每項有缺口的本業貨，每旬數量＝缺口 × 你的市佔（全數承接＝整個缺口），
 *   九旬，立約時固定；照當旬牌價收購，好感 60 以上加兩成、30 以下打八折。交滿：人口小增（+0.6%）或打毀平息（冷卻 12 旬）；交不足：罰款同上，期滿由其他商號解決。
 * - b 闇商代出（G.yami）：人口督促期間拜訪好感 60 以上的闇商人請託（要參加協議）。每項有缺口的本業貨，每旬「穩定供貨線 − 協議配額」（至少 1），到督促結束（最長九旬）。
 *   照當旬牌價九折付私房錢；每旬交貨時擲一次被同業看穿（原暗約的一半），看穿＝違約。
 * - 兩種合約都用定約掛賣的合約格式（07zzm_kake.js 的 pactExtras），交貨順序：掛賣 → 上貢 → 本陣 → 御救販售 → 闇商代出 → 一般出貨。
 *   交出的貨都算進全城供應（加進本旬同業供給 m.so，壓行情、算滿足比例），不算你的出貨。
 * - 數值 ODDS.urge；文字 urge.*、pact.kyusai.*、pact.yami.*（01e）、urge.*（01f／01g）；台詞 LINES.urge。 */
const UG=()=>ODDS.urge;
/** 督促期間（人口督促還在）。 */
const urgeOn=()=>!!(G&&G.urge);
/** 例會當月在城的吟味方六階。 */
function urgeOfficial(){
  return Object.values(G.world.npcs).find(n=>n.pos&&n.pos.court==='judiciary'&&n.pos.rank===6&&n.cityId===G.cityId&&alive(n.cid)&&!jailed(n)&&tourHere(n))||null;
}
/** 舊制公會長推給同業的督促差事（第二百九十五節起不再產生；舊存檔可能還在期限內）。 */
const urgeForced=cid=>!!(G&&G.urge&&G.urge.forced&&G.urge.forced.cid===cid&&G.urge.forced.until>=G.turn);
/** 米問屋、魚屋只有打毀督促；其他行業只有人口督促。 */
const riotSys=()=>!!G&&UG().riotSys.includes(G.sysKey);
/** 手上已有分攤合約、傳喚還沒了結、或等著其他商號解決。 */
const urgeBusy=()=>!!(G.kyusai||G.urgeCall||G.urgePend);
/** 人口督促的缺口：上一期有缺口的本業貨（不含奢侈品、要有交易許可）。回傳 [{name,gap}] 或 null。 */
function urgeGapPop(){
  const gap=G.lastGap||{};
  const L=tradeComms().filter(c=>!c.luxury&&(gap[c.name]||0)>0).map(c=>({name:c.name,gap:Math.max(1,Math.round(gap[c.name]))}));
  return L.length?L:null;
}
/** 打毀督促的缺口：本業必需品（要有交易許可），收市價視窗內的平均缺口；都沒缺時取需求一成。 */
function urgeGapRiot(){
  const L=tradeComms().filter(c=>c.staple&&G.mk[c.name]).map(c=>{
    const m=G.mk[c.name],P=m.past||[];
    const g=P.length?P.reduce((a,x)=>a+Math.max(0,(x.dn!==undefined?x.dn:(x.d0!==undefined?x.d0:x.d))-(x.so||0)-(x.my||0)),0)/P.length:0;
    return {name:c.name,gap:Math.round(g)};
  });
  const pos=L.filter(x=>x.gap>0);
  if(pos.length)return pos;
  const R_=L.filter(x=>riotKeys().includes(x.name)).map(x=>({name:x.name,gap:Math.max(1,Math.round((G.mk[x.name].D||0)*0.1))}));
  return R_.length?R_:null;
}
/** 依缺口算出貨量：share＝分到的比例（全數承接＝1）。 */
const urgeItems=(gaps,share)=>gaps.map(x=>({name:x.name,qty:Math.max(1,Math.min(x.gap,Math.round(x.gap*share)))}));
const urgeShare=()=>(G.share&&G.share.me)||0;
/** 收購價：看你跟出面官員的交情（好感 60 以上加兩成、30 以下打八折）。 */
function urgeTier(cid){const a=(G.rel[cid]&&G.rel[cid].aff)||0,U=UG();return a>=U.affHi?'hi':a>=U.affMid?'mid':'lo'}
/** 每次推進、季度人口結算之後（只在例會旬）：開始、延續或撤回人口督促；有督促、沒有在辦的分攤時傳喚。 */
function urgeTick(log){
  if(!isMeetingTurn()||!TURNRP||!TURNRP.population)return;
  const P=TURNRP.population,put=t=>{pushNews(t);log.push(t)};
  if(G.urge){
    if(P.rate>=0){
      const Y=G.yami;G.urge=null;
      if(Y){G.yami=null;put(NEWS('urge.yamiStop',{n:nameOf(Y.cid)}))}
      put(NEWS('urge.end'));return;
    }
  }else{
    if(riotSys())return;                              // 米問屋、魚屋只有打毀督促
    const n=urgeOfficial();
    if(!((G.popDown||0)>=UG().streak&&n))return;
    G.urge={cid:n.cid,start:G.turn};
    put(NEWS('urge.start',{n:nameOf(n.cid)}));
  }
  {const n=npc(G.urge.cid);if(!n||!alive(n.cid)){const m=urgeOfficial();if(m)G.urge.cid=m.cid}}
  const M=meetNow();if(M)M.urge={cid:G.urge.cid,done:true};   // 例會上只有一句旁白
  if(riotSys()||urgeBusy())return;
  const gaps=urgeGapPop();if(gaps)urgeSummon('pop',G.urge.cid,gaps,log);
}
/** 傳喚：本旬到奉行所議事（主畫面紅底金字按鈕）。 */
function urgeSummon(kind,cid,gaps,log){
  G.urgeCall={kind,cid,turn:G.turn,gaps,att:false,step:0,done:false};
  const t=NEWS(kind==='riot'?'heika.call':'urge.call',{n:nameOf(cid)});pushNews(t);if(log)log.push(t);
}
/** 主畫面按鈕（排在例會按鈕之上；07yb_meeting.js 的 meetHomeHtml 外層）。 */
function urgeHomeHtml(){
  const C=G&&G.urgeCall;if(!C||C.turn!==G.turn)return '';
  if(C.done)return '<button class="pixel-btn" style="width:100%;margin-top:6px" disabled>'+UT('urge.home.done')+'</button>';
  return '<button class="pixel-btn" style="width:100%;margin-top:6px;background:var(--red);color:var(--gold2)" data-act="urgeGo">'+UT('urge.home')+'<div class="tiny">'+UT(C.att?'urge.home.att':'urge.home.'+C.kind)+'</div></button>';
}
{const _m=meetHomeHtml;meetHomeHtml=function(){return urgeHomeHtml()+_m.apply(this,arguments)}}
GO_INFO.urge=[UT('urge.go'),UT('urge.go.2')];
ACT.urgeGo=()=>{
  const C=G.urgeCall;if(!C||C.done||C.turn!==G.turn)return;
  if(C.att){UI.openSheet('urge');return}
  if(apLeft()<=0){toast(MSG('go.2'));return}
  if(injuredBlock())return;
  const amb=rollAmbush();if(amb&&amb.abort)return;
  const enc=amb?null:rollEncounter();
  const go=()=>{if(!spendAP())return;C.att=true;const r=R(C.cid);if(!r.bond){r.bond={mult:1,label:UT('urge.bond'),introId:null};r.met=true;addKnown(C.cid)}goTo('urge')};
  if(enc){showEncounter(enc,go);return}
  go();
};
/** 會場：訓話 → 細談 → 分配。 */
SHEETS.urge=()=>{
  const C=G.urgeCall;if(!C||!C.att)return {title:UT('urge.sheet.t'),html:'<div class="notice">'+UT('urge.sheet.none')+'</div>'};
  const steps=[UT('urge.step.0'),UT('urge.step.1'),UT('urge.step.2')],cur=C.step;
  let h='<div class="chevs">'+steps.map((s,i)=>'<span class="chev '+(cur===i?'on':cur>i?'done':'todo')+(i===0?' first':'')+'"><i>'+s+'</i></span>').join('')+'</div>';
  const card=(cid,line)=>'<div class="card warn" style="display:flow-root;margin-top:6px">'+portraitHtml(cid,48)+'<b>'+esc(nameOf(cid))+'</b> <span class="tag red">'+esc(npc(cid)&&npc(cid).pos?posTitle(npc(cid)):'')+'</span><div class="small" style="margin-top:3px">「'+esc(line)+'」</div></div>';
  C.lines=C.lines||{};
  const next='<button class="pixel-btn btn-sm btn-gold" style="width:100%;margin-top:6px" data-act="urgeStep">'+UT('btn.urgeNext')+'</button>';
  if(cur===0){
    const L=C.lines.s0||(C.lines.s0=TX('urge.scold.'+C.kind)+(urgeTier(C.cid)==='hi'?TX('urge.praise',{f:(G.firm||'').split('·')[0]}):''));
    h+='<div class="tiny muted" style="margin-top:6px">'+UT('urge.sheet.lead.'+C.kind)+'</div>'+card(C.cid,L)+next;
  }else if(cur===1){
    const L=C.lines.s1||(C.lines.s1=TX('urge.kind.'+C.kind));
    const gm=gmCid();
    h+='<div class="tiny muted" style="margin-top:6px">'+(gmIsMe()?UT('urge.inner.me'):gm?UT('urge.inner.other',{n:esc(gmName(gm))}):UT('urge.inner.none'))+'</div>'+card(C.cid,L)+next;
  }else{
    const sh=urgeShare(),all=C.choice==='all',txt=L=>kyusaiItemsTxt(L);
    h+='<div class="tiny muted" style="margin-top:6px">'+UT('urge.alloc.lead',{t:UG().turns})+'</div><div class="card" style="margin-top:4px">';
    rivalsHere().filter(n=>alive(n.cid)&&!suspended(n)).forEach(n=>{
      const r=(G.share&&G.share.rows||[]).find(x=>x.cid===n.cid),s2=r?r.share||0:0;
      h+='<div class="row tiny" style="margin-top:2px"><span>'+esc(nameOf(n.cid))+'</span><span>'+(all?UT('urge.alloc.all'):esc(txt(urgeItems(C.gaps,s2))))+'</span></div>';
    });
    h+='<div class="row tiny" style="margin-top:2px"><span>'+UT('urge.alloc.others')+'</span><span>'+(all?UT('urge.alloc.all'):UT('urge.alloc.othersQ'))+'</span></div>';
    const mine=C.done?C.items:urgeItems(C.gaps,all?1:sh);
    h+='<div class="row small" style="margin-top:4px;border-top:1px dashed #b5a98f;padding-top:3px"><b style="color:#9b2c3a">'+UT('urge.alloc.me')+'</b><b style="color:#9b2c3a">'+esc(txt(mine))+'</b></div>';
    h+='<div class="tiny" style="margin-top:3px">'+UT('urge.price.'+urgeTier(C.cid))+'</div></div>';
    if(C.done){h+='<div class="notice tiny" style="margin-top:4px">'+esc(C.res||'')+'</div><button class="pixel-btn btn-sm" style="width:100%;margin-top:6px" data-act="urgeEnd">'+UT('btn.urgeEnd')+'</button>'}
    else if(gmIsMe()){
      const mineAll=urgeItems(C.gaps,1),mineSh=urgeItems(C.gaps,sh);
      h+='<div class="tiny" style="margin-top:6px">'+UT('urge.gmChoose')+'</div><button class="pixel-btn btn-sm btn-gold" style="width:100%;margin-top:4px" data-act="urgeTake" data-v="all">'+UT('btn.urgeAll')+'</button><div class="tiny muted">'+esc(txt(mineAll))+'</div>';
      h+='<button class="pixel-btn btn-sm" style="width:100%;margin-top:4px" data-act="urgeTake" data-v="split">'+UT('btn.urgeSplit')+'</button><div class="tiny muted">'+esc(txt(mineSh))+'</div>';
    }else h+='<button class="pixel-btn btn-sm btn-gold" style="width:100%;margin-top:6px" data-act="urgeTake" data-v="split">'+UT('btn.urgeTake')+'</button>';
  }
  return {title:UT('urge.sheet.t'),html:h};
};
ACT.urgeStep=()=>{const C=G.urgeCall;if(!C||!C.att||C.step>=2)return;C.step++;refreshSheet()};
ACT.urgeEnd=()=>UI.closeSheet();
/** 認領：建立九旬合約。all＝公會長全數承接。回傳結果文字。 */
function urgeAssign(all,log){
  const C=G.urgeCall;if(!C||C.done)return '';
  const items=urgeItems(C.gaps,all?1:urgeShare()),tier=urgeTier(C.cid);
  kyusaiStart(C.cid,items,C.kind,UG().price[tier],all);
  C.done=true;C.choice=all?'all':'split';C.items=items;
  logRel(C.cid,UT(C.kind==='riot'?'urge.log.heikaTake':'urge.log.take'));
  C.res=UT('urge.res',{a:kyusaiItemsTxt(items),t:UG().turns,p:UT('urge.price.'+tier)});
  const t=NEWS(C.kind==='riot'?'heika.take':'urge.take',{a:kyusaiItemsTxt(items),t:UG().turns});pushNews(t);if(log)log.push(t);
  return C.res;
}
ACT.urgeTake=el=>{const C=G.urgeCall;if(!C||!C.att||C.done)return;urgeAssign(el.dataset.v==='all'&&gmIsMe());sfx.coin();refreshSheet();UI.render()};
/** 例會視窗裡的督促卡：只有一句旁白。 */
function urgeMeetCard(M){
  if(!M||!M.urge)return '';
  const cid=M.urge.cid;if(!npc(cid))return '';
  return '<div class="card warn" style="display:flow-root">'+portraitHtml(cid,48)+'<b>'+esc(nameOf(cid))+'</b> <span class="tag red">'+UT('urge.tag')+'</span><div class="small" style="margin-top:3px">「'+esc(TX('urge.say'))+'」</div><div class="tiny muted" style="margin-top:4px">'+UT('urge.meetNote')+'</div></div>';
}
/** 舊流程的接口（例會沒走完、遷居）：不再需要公會長處理，什麼都不做。 */
function urgeAuto(M,log){}
/** 罰款：現款四分之一，最低兩千兩；現款不足扣成負數。回傳罰款。 */
function urgeFine(){const U=UG(),amt=Math.max(U.fineMin,Math.round(Math.max(0,G.silver)*U.fineRate));G.silver-=amt;return amt}
/** 事情解決：人口小增（連續減少歸零、督促結束）或打毀平息（冷卻、主食漲勢回落）。 */
function urgeResolve(kind,log,others){
  const put=t=>{pushNews(t);if(log)log.push(t)};
  if(kind==='riot'){
    const S=G.staple;S.streak=0;S.cool=Math.max(S.cool||0,UG().riotCool);
    Object.keys(G.mk).forEach(k=>{if(COMM_MAP[k].staple)G.mk[k].ev=Math.min(1,G.mk[k].ev)});
    put(NEWS(others?'heika.others':'heika.calm'));return;
  }
  const O=ODDS.cityPopulation,before=Number.isFinite(G.cityPopulation)?G.cityPopulation:cityPop(homeCity());
  G.cityPopulation=Math.max(O.min,Math.round(before*(1+O.majority)));G.popDown=0;
  const Y=G.yami;if(G.urge){G.urge=null;if(Y){G.yami=null;put(NEWS('urge.yamiStop',{n:nameOf(Y.cid)}))}}
  put(NEWS(others?'urge.popOthers':'urge.popUp',{before:fmt(before),after:fmt(G.cityPopulation),rate:'+'+(O.majority*100).toFixed(1)+'%'}));
}

/* ---------- 打毀督促（米問屋、魚屋） ---------- */
/** 出面的官員：本城普請方四階（町年寄，常駐）；沒有時找在城的普請方最高階。 */
function heikaOfficial(){
  const L=Object.values(G.world.npcs).filter(n=>n.pos&&n.pos.court==='administration'&&n.cityId===G.cityId&&alive(n.cid)&&!jailed(n)&&!awayNow(n));
  return L.find(n=>n.pos.rank===4)||L.sort((a,b)=>b.pos.rank-a.pos.rank)[0]||null;
}
/** 打毀督促正在辦（傳喚、合約、或等其他商號解決）：這段期間不會打毀。 */
const heikaOn=()=>!!(G&&((G.kyusai&&G.kyusai.kind==='riot')||(G.urgeCall&&G.urgeCall.kind==='riot')||(G.urgePend&&G.urgePend.kind==='riot')));
{const _riot=riot;riot=function(log){
  if(heikaOn()){G.staple.streak=0;return}
  _riot.apply(this,arguments);
  const U=UG();G.riotLog=(G.riotLog||[]).filter(t=>t>G.turn-U.riotWin).concat([G.turn]);
  if(!riotSys()||G.riotLog.length<U.riotN||urgeBusy())return;
  const n=heikaOfficial(),gaps=(typeof moving==='function'&&moving())?null:urgeGapRiot();
  if(!n||!gaps){const t=NEWS('heika.public');pushNews(t);if(log)log.push(t);return}
  urgeSummon('riot',n.cid,gaps,log);
}}
/** 每次推進一開始：上一旬的傳喚了結（去了沒選完照預設分配；沒去就罰款，期滿由其他商號解決）；期滿的事情解決。 */
function urgeCallExpire(log){
  const C=G.urgeCall,put=t=>{pushNews(t);log.push(t)};
  if(C&&C.turn<=G.turn){
    if(!C.done){
      if(C.att){urgeAssign(false,log);put(NEWS('urge.auto'))}
      else{const f=urgeFine();G.urgePend={kind:C.kind,until:G.turn+UG().turns,cid:C.cid};sfx.bad();put(NEWS('urge.fine',{a:fmt(f)}))}
    }
    G.urgeCall=null;
  }
  const P=G.urgePend;if(P&&G.turn>=P.until){G.urgePend=null;urgeResolve(P.kind,log,true)}
}

/* ---------- c 御救販售 ---------- */
/** 開價：上一期有缺口的每項本業貨（不含奢侈品、要有交易許可）。回傳 [{name,qty}] 或 null。 */
function kyusaiOffer(){
  const gap=G.lastGap||{},sh=(G.share&&G.share.me)||0;
  const L=tradeComms().filter(c=>!c.luxury&&(gap[c.name]||0)>0).map(c=>{const g=gap[c.name];return {name:c.name,qty:Math.max(1,Math.min(Math.round(g),Math.round(g*sh*UG().mult)))}});   // 各商號照市佔分攤（第二百九十五節）
  return L.length?L:null;
}
const kyusaiItemsTxt=L=>L.map(x=>COMM_MAP[x.name].short+' × '+x.qty).join(UT('ppl.pt.2'));
function kyusaiStart(cid,O,kind,pm,all){G.kyusai={cid,kind:kind||'pop',pm:pm||1,all:!!all,items:O.map(x=>({name:x.name,qty:x.qty,filled:0})),left:UG().turns,start:G.turn+1,end:G.turn+UG().turns}}
/** 合約裡的貨，這一期大盤進貨上限加上每旬要交的量（03_market.js 的 buyLimit）。 */
function kyusaiBonus(name){const K=G&&G.kyusai;if(!K)return 0;const it=K.items.find(x=>x.name===name);return it?it.qty:0}
/** 從倉裡交貨：上貢保留的貨不動（上貢比較晚交、但比較優先）。回傳交出的數量。 */
function pactTake(name,qty){
  const T=G.tribute,held=T&&T.name===name?(T.filled||0):0;
  const q=Math.min(qty,Math.max(0,(G.inv[name]||0)-held));
  if(q>0)stockTake(name,q,false);
  const m=G.mk[name];if(m&&q>0)m.so=(m.so||0)+q;           // 貨流進城裡：算進本旬全城供給（壓行情、算滿足比例），不算你的出貨
  return q;
}
/** 拜訪請託：督促期間、那位六階官員、還沒有合約、上一期有缺口。 */
FAVORS.judiciary.push(favorText({k:'kyusai',rank:6,exactRank:true,avail:n=>urgeOn()&&!G.kyusai&&!G.urgeCall&&!G.urgePend&&G.urge.cid===n.cid&&!!kyusaiOffer()}));
REG_FAVOR.kyusai=n=>{const O=kyusaiOffer();if(!O||G.kyusai)return MSG('urge.kyusaiNone');kyusaiStart(n.cid,O,'pop',UG().price[urgeTier(n.cid)]);return MSG('urge.kyusaiOk',{a:kyusaiItemsTxt(O),t:UG().turns})};
/** 每次推進（自動出貨之前）：交出這一旬的御救販售。 */
function kyusaiDeliver(log){
  urgeCallExpire(log);                              // 上一旬的傳喚了結；期滿的事情解決
  const K=G.kyusai;if(!K||G.turn<K.start)return;
  const riot=K.kind==='riot',nk=k=>riot?k.replace('urge.kyusai','heika.'):k;
  let amt=0,short=false;const parts=[];
  K.items.forEach(it=>{const q=pactTake(it.name,it.qty);it.filled=0;amt+=Math.round(q*marketQuote(it.name)*(K.pm||1));parts.push(COMM_MAP[it.name].short+' × '+q);if(q<it.qty)short=true});
  G.silver+=amt;
  const put=t=>{pushNews(t);log.push(t)},who=nameOf(K.cid);
  if(short){                                        // 交不足：罰款（同不理傳喚），期滿由其他商號解決
    const f=urgeFine();G.kyusai=null;G.urgePend={kind:K.kind||'pop',until:Math.max(G.turn+1,K.end||G.turn+1),cid:K.cid};sfx.bad();
    put(NEWS(nk('urge.kyusaiFail'),{g:parts.join(UT('ppl.pt.2')),a:fmt(amt),f:fmt(f)}));return;
  }
  K.left--;
  if(K.left>0){put(NEWS(nk('urge.kyusaiGive'),{g:parts.join(UT('ppl.pt.2')),a:fmt(amt),l:K.left}));return}
  G.kyusai=null;
  const r=G.rel[K.cid];if(r&&alive(K.cid)){setAff(r,clamp(r.aff+UG().doneAff,0,100));logRel(K.cid,UT('urge.log.kyusaiDone'))}
  const f=K.all?0:addFame(rint(UG().fame[0],UG().fame[1]),'mid');sfx.fanfare();   // 公會長全數承接：錢自己賺，不另加名聲
  put(NEWS(nk(K.all?'urge.kyusaiDoneAll':'urge.kyusaiDone'),{g:parts.join(UT('ppl.pt.2')),a:fmt(amt),f:fmt1(f),n:who}));
  urgeResolve(K.kind||'pop',log);
}

/* ---------- b 闇商代出 ---------- */
/** 開價：每項有缺口的本業貨，每旬「穩定供貨線 − 協議配額」（至少 1）。 */
function yamiOffer(){
  const gap=G.lastGap||{};
  const L=tradeComms().filter(c=>!c.luxury&&(gap[c.name]||0)>0).map(c=>({name:c.name,qty:Math.max(1,supplyLine(c.name)-quotaOf(c.name))}));
  return L.length?L:null;
}
const yamiBanned=cid=>!!(G.yamiBan&&G.yamiBan[cid]>G.turn);
{const _d=dealerReqs;dealerReqs=function(cid){
  const L=_d.apply(this,arguments),n=npc(cid);
  if(n&&n.role==='smuggler'&&dealReady(cid)&&urgeOn()&&guildMember()&&!G.yami&&!yamiBanned(cid)){const O=yamiOffer();if(O)L.unshift({k:'yami',name:UT('urge.yamiReq'),desc:TX('urge.yamiPitch')+UT('urge.yamiReq.d',{a:kyusaiItemsTxt(O)})})}
  return L;
}}
{const _do=dealerDo;dealerDo=function(cid,k){
  if(k!=='yami')return _do.apply(this,arguments);
  const r=R(cid),O=yamiOffer();if(!O||G.yami||!urgeOn()||!guildMember())return UT('urge.yamiNone');
  G.yami={cid,items:O.map(x=>({name:x.name,qty:x.qty,filled:0})),left:UG().turns,start:G.turn+1};
  setAff(r,Math.max(0,r.aff-REQ_AFF.normal));r.dealT=G.turn;logRel(cid,UT('urge.log.yami',{a:REQ_AFF.normal}));
  return UT('urge.yamiOk',{n:nameOf(cid),a:kyusaiItemsTxt(O),d:REQ_AFF.normal});
}}
/** 每次推進（御救販售之後、自動出貨之前）：交出這一旬的闇商代出，貨款進私房錢；擲一次被看穿。 */
function yamiDeliver(log){
  const Y=G.yami;if(!Y||G.turn<Y.start)return;
  const put=t=>{pushNews(t);log.push(t)},who=nameOf(Y.cid);
  if(!urgeOn()||!guildMember()){G.yami=null;put(NEWS('urge.yamiStop',{n:who}));return}
  let gold=0,short=false,q0=0,qq=0;const parts=[];
  Y.items.forEach(it=>{const q=pactTake(it.name,it.qty);it.filled=0;gold+=Math.round(q*marketQuote(it.name)*UG().yamiCut);q0+=q;qq+=Math.max(1,quotaOf(it.name));parts.push(COMM_MAP[it.name].short+' × '+q);if(q<it.qty)short=true});
  G.gold=(G.gold||0)+gold;
  const D=UG().detect,over=q0/qq,caught=q0>0&&chance(Math.min(D.max,D.base+D.slope*over));
  if(caught){
    const C=G.cartel;C.sanction=3;C.state='none';loseFame('yamiCaught');caughtAdd('me');const lost=guildForfeit();
    const fine=Math.round(Math.max(0,G.silver)*UG().fine);G.silver-=fine;
    const r=G.rel[Y.cid];if(r){setAff(r,Math.max(0,r.aff-UG().yamiAff));logRel(Y.cid,UT('urge.log.yamiCaught'))}
    (G.yamiBan=G.yamiBan||{})[Y.cid]=G.turn+UG().ban;G.yami=null;sfx.bad();
    put(NEWS('urge.yamiCaught',{n:who,g:fmt(gold),b:lost?fmt(lost):'0',f:fmt(fine)}));return;
  }
  if(short){
    const r=G.rel[Y.cid];if(r){setAff(r,Math.max(0,r.aff-UG().yamiShortAff));logRel(Y.cid,UT('urge.log.yamiShort'))}
    G.yami=null;put(NEWS('urge.yamiShort',{n:who,g:parts.join(UT('ppl.pt.2')),a:fmt(gold)}));return;
  }
  Y.left--;
  put(NEWS(Y.left>0?'urge.yamiGive':'urge.yamiDone',{n:who,g:parts.join(UT('ppl.pt.2')),a:fmt(gold),l:Y.left}));
  if(Y.left<=0)G.yami=null;
}
