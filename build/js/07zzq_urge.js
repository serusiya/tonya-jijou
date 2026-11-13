'use strict';
/* ★檔案總覽：官府督促、御救販售、闇商代出（DESIGN_NOTES 第二百五十、二百五十六節）
 * - 官府督促：季度人口連續三季減少（G.popDown），而且那場例會時你的市佔在一成五以上，例會當月在城的吟味方六階（欽按巡察使）到會督促，進入督促期（G.urge）。
 *   哪一季人口沒有減少，那場例會就撤回督促；闇商代出隨之停止，御救販售照常做完。
 * - 公會長特權：你是公會長時，例會視窗裡三選一——接下御救販售、推給一位同業（比照御用金：他好感 −40 成仇，這一期照穩定供貨線足量出貨）、推託（官員好感 −30、知名度 −3）。
 *   沒處理就推進＝推託。你不是公會長時，公會長自己處理（不模擬），不會派給你。
 * - c 御救販售（G.kyusai）：拜訪那位六階官員請託，或公會長在例會上接。上一期有缺口的每項本業貨（不含奢侈品、要有交易許可），
 *   每旬數量＝上一期每旬平均缺口 × 市佔 × 3（最多補滿缺口、至少 1），九旬，立約時固定。官府照當旬牌價付現款。合約裡的貨這一期大盤進貨上限加上每旬要交的量。
 * - b 闇商代出（G.yami）：督促期間拜訪好感 60 以上的闇商人請託（要參加協議）。每項有缺口的本業貨，每旬「穩定供貨線 − 協議配額」（至少 1），到督促結束（最長九旬）。
 *   照當旬牌價九折付私房錢；每旬交貨時擲一次被同業看穿（原暗約的一半），看穿＝違約。
 * - 兩種合約都用定約掛賣的合約格式（07zzm_kake.js 的 pactExtras），交貨順序：掛賣 → 上貢 → 本陣 → 御救販售 → 闇商代出 → 一般出貨。
 *   交出的貨都算進全城供應（加進本旬同業供給 m.so，壓行情、算滿足比例），不算你的出貨。
 * - 數值 ODDS.urge；文字 urge.*、pact.kyusai.*、pact.yami.*（01e）、urge.*（01f／01g）；台詞 LINES.urge。 */
const UG=()=>ODDS.urge;
/** 督促期間（還在督促）。 */
const urgeOn=()=>!!(G&&G.urge);
/** 例會當月在城的吟味方六階。 */
function urgeOfficial(){
  return Object.values(G.world.npcs).find(n=>n.pos&&n.pos.court==='judiciary'&&n.pos.rank===6&&n.cityId===G.cityId&&alive(n.cid)&&!jailed(n)&&tourHere(n))||null;
}
/** 公會長推給同業的督促差事：這一期他照穩定供貨線足量出貨。 */
const urgeForced=cid=>!!(G&&G.urge&&G.urge.forced&&G.urge.forced.cid===cid&&G.urge.forced.until>=G.turn);
/** 每次推進、季度人口結算之後（只在例會旬）：開始或撤回督促。 */
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
    const n=urgeOfficial(),sh=(G.share&&G.share.me)||0;
    if(!((G.popDown||0)>=UG().streak&&sh>=UG().share&&n))return;
    G.urge={cid:n.cid,start:G.turn};
    put(NEWS('urge.start',{n:nameOf(n.cid)}));
  }
  const n=npc(G.urge.cid);if(!n||!alive(n.cid)){const m=urgeOfficial();if(m)G.urge.cid=m.cid}
  const M=meetNow();if(M&&!G.kyusai)M.urge={cid:G.urge.cid,done:false};   // 手上還有御救販售時，官員這次不再交代
}
/** 例會視窗裡的督促卡（例會旬有督促時才出現）。 */
function urgeMeetCard(M){
  if(!M||!M.urge)return '';
  const U=M.urge,cid=U.cid;if(!npc(cid))return '';
  let h='<div class="card warn" style="display:flow-root">'+portraitHtml(cid,48)+'<b>'+esc(nameOf(cid))+'</b> <span class="tag red">'+UT('urge.tag')+'</span><div class="small" style="margin-top:3px">「'+esc(TX('urge.say'))+'」</div>';
  if(!gmIsMe()){
    h+='<div class="tiny muted" style="margin-top:4px">'+UT(M.el&&!M.el.done?'urge.waitElect':'urge.notGm',{n:esc(gmName(gmCid()||''))})+'</div>';
    return h+'</div>';
  }
  if(M.el&&!M.el.done)return h+'<div class="tiny muted" style="margin-top:4px">'+UT('urge.waitElect')+'</div></div>';
  if(U.done)return h+'<div class="tiny" style="margin-top:4px">'+esc(U.res||'')+'</div></div>';
  const O=kyusaiOffer(),can=O&&!G.kyusai;
  h+='<div class="tiny" style="margin-top:4px">'+UT('urge.gmNote')+'</div>';
  h+='<button class="pixel-btn btn-sm btn-gold" style="width:100%;margin-top:4px" data-act="urgeTake" '+(can?'':'disabled')+'>'+UT(can?'urge.btn.take':G.kyusai?'urge.btn.busy':'urge.btn.none')+'</button>';
  if(can)h+='<div class="tiny muted" style="margin-top:2px">'+esc(kyusaiItemsTxt(O))+'</div>';
  const R_=rivalsHere().filter(n=>alive(n.cid)&&!isEnemy(n.cid));
  if(U.arm){
    const t=npc(U.arm);
    h+='<div class="notice tiny" style="margin-top:4px">'+UT('urge.pushConfirm',{n:esc(nameOf(U.arm)),d:UG().pushAff})+'</div><div class="grid2"><button class="pixel-btn btn-sm btn-red" data-act="urgePushOk">'+UT('urge.btn.pushOk')+'</button><button class="pixel-btn btn-sm" data-act="urgePushCancel">'+UT('urge.btn.cancel')+'</button></div>';
  }else if(R_.length){
    h+='<div class="tiny" style="margin-top:6px">'+UT('urge.pushHead',{d:UG().pushAff})+'</div>'+R_.map(n=>'<div class="row small" style="margin-top:3px"><span>'+esc(nameOf(n.cid))+' <span class="tag">'+affWord(R(n.cid).aff)+'</span></span><button class="pixel-btn btn-sm" data-act="urgePush" data-cid="'+n.cid+'">'+UT('urge.btn.push')+'</button></div>').join('');
  }
  h+='<button class="pixel-btn btn-sm" style="width:100%;margin-top:6px" data-act="urgeRefuse">'+UT('urge.btn.refuse',{d:UG().refuseAff,f:ODDS.fameLoss.urgeRefuse})+'</button>';
  return h+'</div>';
}
const urgeM=()=>{const M=meetNow();return M&&M.urge&&!M.urge.done&&gmIsMe()?M:null};
ACT.urgeTake=()=>{const M=urgeM();if(!M||G.kyusai)return;const O=kyusaiOffer();if(!O)return;kyusaiStart(M.urge.cid,O);M.urge.done=true;M.urge.res=UT('urge.res.take',{a:kyusaiItemsTxt(O)});sfx.coin();refreshSheet();UI.render()};
ACT.urgePush=el=>{const M=urgeM();if(!M)return;M.urge.arm=el.dataset.cid;refreshSheet()};
ACT.urgePushCancel=()=>{const M=urgeM();if(!M)return;M.urge.arm=null;refreshSheet()};
ACT.urgePushOk=()=>{
  const M=urgeM();if(!M||!M.urge.arm)return;const cid=M.urge.arm,r=R(cid);
  if(!r.bond){r.bond={mult:1,label:UT('urge.bond'),introId:null};r.met=true;r.seen=true;addKnown(cid)}
  r.peak=Math.max(r.peak||0,r.aff);setAff(r,Math.max(0,r.aff-UG().pushAff));r.peak=Math.max(r.peak,r.aff+ENEMY_GAP);logRel(cid,UT('urge.log.push'));   // 比照御用金攤派：一定成仇
  G.urge.forced={cid,until:G.turn+turnsToMeeting(1,false)-1};
  M.urge.done=true;M.urge.res=UT('urge.res.push',{n:nameOf(cid)});
  pushNews(NEWS('urge.push',{n:nameOf(cid)}));sfx.bad();refreshSheet();UI.render();
};
function urgeRefuseDo(){
  const M=meetNow();if(!M||!M.urge||M.urge.done)return;
  const r=G.rel[M.urge.cid];if(r){setAff(r,Math.max(0,r.aff-UG().refuseAff));logRel(M.urge.cid,UT('urge.log.refuse'))}
  loseFame('urgeRefuse');M.urge.done=true;M.urge.res=UT('urge.res.refuse');
  pushNews(NEWS('urge.refuse'));
}
ACT.urgeRefuse=()=>{if(!urgeM())return;urgeRefuseDo();sfx.bad();refreshSheet();UI.render()};
/** 例會沒走完就推進：你是公會長卻沒處理督促＝推託。 */
function urgeAuto(M,log){if(M&&M.urge&&!M.urge.done&&gmIsMe()){urgeRefuseDo();if(log)log.push(NEWS('urge.refuse'))}}

/* ---------- c 御救販售 ---------- */
/** 開價：上一期有缺口的每項本業貨（不含奢侈品、要有交易許可）。回傳 [{name,qty}] 或 null。 */
function kyusaiOffer(){
  const gap=G.lastGap||{},sh=(G.share&&G.share.me)||0;
  const L=tradeComms().filter(c=>!c.luxury&&(gap[c.name]||0)>0).map(c=>{const g=gap[c.name];return {name:c.name,qty:Math.max(1,Math.min(Math.round(g),Math.round(g*sh*UG().mult)))}});
  return L.length?L:null;
}
const kyusaiItemsTxt=L=>L.map(x=>COMM_MAP[x.name].short+' × '+x.qty).join(UT('ppl.pt.2'));
function kyusaiStart(cid,O){G.kyusai={cid,items:O.map(x=>({name:x.name,qty:x.qty,filled:0})),left:UG().turns,start:G.turn+1}}
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
FAVORS.judiciary.push(favorText({k:'kyusai',rank:6,exactRank:true,avail:n=>urgeOn()&&!G.kyusai&&G.urge.cid===n.cid&&!!kyusaiOffer()}));
REG_FAVOR.kyusai=n=>{const O=kyusaiOffer();if(!O||G.kyusai)return MSG('urge.kyusaiNone');kyusaiStart(n.cid,O);return MSG('urge.kyusaiOk',{a:kyusaiItemsTxt(O),t:UG().turns})};
/** 每次推進（自動出貨之前）：交出這一旬的御救販售。 */
function kyusaiDeliver(log){
  const K=G.kyusai;if(!K||G.turn<K.start)return;
  let amt=0,short=false;const parts=[];
  K.items.forEach(it=>{const q=pactTake(it.name,it.qty);it.filled=0;amt+=Math.round(q*marketQuote(it.name));parts.push(COMM_MAP[it.name].short+' × '+q);if(q<it.qty)short=true});
  G.silver+=amt;
  const put=t=>{pushNews(t);log.push(t)},who=nameOf(K.cid);
  if(short){
    const r=G.rel[K.cid];if(r&&alive(K.cid)){setAff(r,Math.max(0,r.aff-UG().failAff));logRel(K.cid,UT('urge.log.kyusaiFail'))}
    loseFame('kyusaiFail');G.kyusai=null;sfx.bad();put(NEWS('urge.kyusaiFail',{g:parts.join(UT('ppl.pt.2')),a:fmt(amt)}));return;
  }
  K.left--;
  if(K.left>0){put(NEWS('urge.kyusaiGive',{g:parts.join(UT('ppl.pt.2')),a:fmt(amt),l:K.left}));return}
  G.kyusai=null;
  const r=G.rel[K.cid];if(r&&alive(K.cid)){setAff(r,clamp(r.aff+UG().doneAff,0,100));logRel(K.cid,UT('urge.log.kyusaiDone'))}
  const f=addFame(rint(UG().fame[0],UG().fame[1]),'mid');sfx.fanfare();
  put(NEWS('urge.kyusaiDone',{g:parts.join(UT('ppl.pt.2')),a:fmt(amt),f:fmt1(f),n:who}));
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
