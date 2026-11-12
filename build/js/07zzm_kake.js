'use strict';
/* ★檔案總覽：定約掛賣（旅商的合約供貨；DESIGN_NOTES 第二百三十五、二百三十八、二百三十九節）
 * - 解鎖：畫面上的市佔第一次超過一成（G.kakeOn，永久）。之後每旬隨機 3～5 位本城旅商人帶「求掛賣」標記（G.kakeMarks）。
 * - 談掛賣：拜訪帶標記的旅商人打勝、好感 ≥60、有空閒番頭，請託多一項（dealerReqs）；好感 100 的旅商人偶爾自己上門（回府時事件 kakeAsk）。
 *   先開方案選單（kakePickHtml：低價數量多／中價中數量／高價數量少／放棄），選定才立約（kakeSign）。
 * - 合約 G.kake[]：{id,cid,name,unit,qty,total,dep,left,start,done,filled,banto,plan,gain}；一位番頭一張、一位旅商人一張。
 *   立約當旬收手付（兩成）；下一旬起連續九旬，每旬推進時在自動出貨之前由番頭交貨（kakeDeliver）。不算本城出貨。
 *   保留的貨仍在 G.inv 裡，以合約的 filled 記數（kakeHeld）；出貨拉霸與預設出貨都扣掉它。旬初自動填貨（kakeFill），可再按「填貨」。
 * - 交不齊＝失約（好感、知名度下降，已交的照算）；九旬交完，剩下八成掛金記成賣掛 G.kakeRecv[]，下一旬收帳：可能拖一季，也可能貸倒。
 * - 每旬 kakeTick（advanceTurn 的 f8Tick 之後）：解鎖、番頭異動、收帳、標記、主動上門、自動填貨。
 * - 數值 ODDS.kake；台詞 LINES.kake；文字 kake.*（01e）、新聞 kake.*（01g）。 */
const KK=()=>ODDS.kake;
const kakeList=()=>G.kake||(G.kake=[]);
const kakeRecvList=()=>G.kakeRecv||(G.kakeRecv=[]);
const kakeOn=()=>!!(G&&G.kakeOn);
const kakeMarked=cid=>!!(G.kakeMarks&&G.kakeMarks.t===G.turn&&G.kakeMarks.ids.includes(cid));
/** 這位旅商人手上有沒有合約。 */
const kakeWith=cid=>!!(G&&G.kake&&G.kake.some(c=>c.cid===cid));
/** 掛賣以外、共用合約格式的約定（第二百五十一節）：上貢、本陣御用達。依交貨先後排（掛賣最先，再上貢、本陣）。
 *  回傳 [{kind,ref,cid,name,qty,due}]：ref 是原本的存檔物件（保留量記在 ref.filled）；due＝這次推進就要交。
 *  上貢在推進後的年度結算前交（upkeep），所以到期前一旬就算「這次要交」；本陣御用達在自動出貨之前交。 */
function pactExtras(){
  const L=[];if(!G)return L;
  const T=G.tribute;if(T&&COMM_MAP[T.name])L.push({kind:'tribute',ref:T,cid:T.cid,name:T.name,qty:T.qty,due:G.turn+1>=T.due});
  const H=G.honjin;if(H&&COMM_MAP[H.name])L.push({kind:'honjin',ref:H,cid:H.cid,name:H.name,qty:H.qty,due:G.turn>=H.start});
  return L;
}
/** 所有合約，依交貨先後：掛賣（早簽的在前）→ 上貢 → 本陣御用達。每筆 {kind,ref,cid,name,qty,due}，保留量在 ref.filled。 */
function pactAll(){return kakeList().map(c=>({kind:'kake',ref:c,cid:c.cid,name:c.name,qty:c.qty,due:kakeDue(c)})).concat(pactExtras())}
/** 某項貨被合約保留的數量（仍在倉裡，不能出貨）。 */
function kakeHeld(name){return G?pactAll().reduce((s,p)=>s+(p.name===name?(p.ref.filled||0):0),0):0}
/** 扣掉掛賣保留後，可以自由出貨的庫存。 */
const kakeFree=name=>Math.max(0,(G.inv[name]||0)-kakeHeld(name));
/** 能接掛賣的番頭（大番頭、臨時打工的差配人不算；關押中、借出去的不算）。 */
const kakeBantos=()=>(G.emps||[]).filter(e=>e.rank==='banto'&&!jailedEmp(e)&&!empLent(e));
const kakeFreeBanto=()=>kakeBantos().find(e=>!kakeList().some(c=>c.banto===e.id));
const kakeItems=()=>tradeComms().filter(c=>!c.luxury);
/** 有效總資產：現款＋庫存（按上一旬收市價）－借款－還沒履約完的手付。 */
function kakeAssets(){return Math.max(0,bzWorth('me')-kakeList().reduce((s,c)=>s+c.dep,0))}
/** 這位旅商人這一旬想訂的貨與方案（同一人同一旬固定貨物；數量照當下的資產）。 */
function kakeOffer(cid){
  const K=KK(),cs=kakeItems(),n=npc(cid);if(!cs.length||!n)return null;
  const c=cs[Math.floor(seeded('kake|'+cid+'|'+G.turn)()*cs.length)],quote=marketQuote(c.name);
  const cap=Math.max(1,Math.floor(itemCap(c.name)*K.capHalf)),worth=bzInit(n).bzw*K.worthCap,base=kakeAssets()*K.frac;
  const plans=[];let prev=Infinity;
  for(const P of K.plans){
    const unit=Math.max(0.1,Math.round(quote*P.p*10)/10);
    let q=Math.round(Math.min(base*P.q,worth)/K.turns/unit);
    if(!plans.length)q=Math.max(1,q);
    q=Math.min(q,cap,prev-1);if(q<1)break;
    const total=Math.round(unit*q*K.turns);
    plans.push({k:P.k,unit,qty:q,total,dep:Math.round(total*K.dep)});prev=q;
  }
  return plans.length?{cid,name:c.name,plans}:null;
}
/* ---------- 請託與方案選單 ---------- */
const kakeShop=cid=>{const L=Ls('kake.shop.'+G.sysKey);return L[Math.floor(seeded('kakeShop|'+cid)()*L.length)]};
/** 拜訪請託：解鎖、帶標記、他手上沒有合約、有空閒番頭才出現。 */
function kakeReq(cid){
  if(!kakeOn()||!kakeMarked(cid)||kakeWith(cid)||!kakeFreeBanto())return null;
  const O=kakeOffer(cid);if(!O)return null;
  return {k:'kake',name:UT('kake.req'),desc:UT('kake.req.d',{g:COMM_MAP[O.name].short})};
}
{const _d=dealerReqs;dealerReqs=function(cid){const L=_d.apply(this,arguments),n=npc(cid);if(n&&n.role==='guest'&&dealReady(cid)){const r=kakeReq(cid);if(r)return [r].concat(L)}return L}}
/** 方案選單（src：req＝拜訪請託、home＝主動上門）。 */
function kakePickHtml(cid,src){
  const O=kakeOffer(cid);if(!O)return '<div class="notice">'+UT('kake.none')+'</div>';
  UI.s.kakeOffer=O;
  const c=COMM_MAP[O.name],K=KK(),big=O.plans[0].total>=K.bigTotal;
  let h='<div class="card" style="display:flow-root">'+portraitHtml(cid,56)+'<div><b>'+esc(nameOf(cid))+'</b> <span class="tag gray">'+esc(ROLE_LABEL.guest||'')+'</span></div><div class="small" style="margin:5px 0">「'+esc(TX('kake.pitch',{shop:kakeShop(cid),g:c.short}))+esc(TX(big?'kake.scale.big':'kake.scale.small'))+'」</div></div>';
  h+='<div class="tiny muted" style="margin:4px 0">'+UT('kake.pick.note',{g:esc(c.short),p:fmt1(marketQuote(O.name)),t:K.turns})+'</div>';
  O.plans.forEach(p=>{
    h+='<div class="card" style="margin-top:4px"><div class="row"><b class="small">'+UT('kake.plan.'+p.k)+'</b><b style="color:#9b2c3a">'+UT('kake.plan.per',{q:p.qty,u:fmt1(p.unit)})+'</b></div>'
      +'<div class="tiny muted" style="margin:3px 0">'+UT('kake.plan.sum',{q:p.qty*K.turns,a:fmt(p.total),d:fmt(p.dep),r:fmt(p.total-p.dep)})+'</div>'
      +'<button class="pixel-btn btn-sm btn-gold" data-act="kakeTake" data-cid="'+cid+'" data-k="'+p.k+'">'+UT('btn.kakeTake')+'</button></div>';
  });
  h+='<div style="margin-top:6px"><button class="pixel-btn btn-sm" data-act="kakePass" data-src="'+(src||'req')+'">'+UT('btn.kakePass')+'</button></div>';
  return h;
}
{const _r=ACT.reqAsk;ACT.reqAsk=function(el){
  if(el.dataset.k==='kake'){BT=null;UI.showInfo(UT('kake.pick.t',{a:nameOf(el.dataset.cid)}),kakePickHtml(el.dataset.cid,'req'));return}
  return _r.apply(this,arguments)}}
ACT.kakePass=()=>{UI.s.kakeOffer=null;UI.hideInfo();UI.render()};
ACT.kakeTake=el=>{
  const O=UI.s.kakeOffer,cid=el.dataset.cid;if(!O||O.cid!==cid)return;
  const p=O.plans.find(x=>x.k===el.dataset.k);if(!p)return;
  const m=kakeSign(cid,O.name,p);UI.s.kakeOffer=null;
  UI.showInfo(UT('kake.pick.t',{a:nameOf(cid)}),portraitHtml(cid,56)+'<div class="notice" style="margin-top:6px">'+esc(m)+'</div><button class="pixel-btn btn-sm" data-act="reqDone" style="margin-top:6px">'+UT('cm.ok')+'</button>');
  sfx.coin();UI.render();refreshSheet();
};
/** 立約：收手付、指派番頭；下一旬起交貨。 */
function kakeSign(cid,name,p){
  const e=kakeFreeBanto();if(!e||kakeWith(cid))return UT('kake.none');
  const K=KK(),c=COMM_MAP[name];
  kakeList().push({id:G.turn+'_'+Math.floor(rnd()*1e5),cid,name,unit:p.unit,qty:p.qty,total:p.total,dep:p.dep,left:K.turns,start:G.turn+1,done:0,filled:0,banto:e.id,plan:p.k,gain:0});
  G.silver+=p.dep;G.carryIn=G.carryIn||{};G.carryIn.kake=(G.carryIn.kake||0)+p.dep;e.kakeIn=(e.kakeIn||0)+p.dep;
  const r=R(cid);if(!r.bond)r.bond={mult:1,label:UT('kake.bond'),introId:null};r.met=true;addKnown(cid);
  logRel(cid,UT('kake.log.sign',{g:c.short,q:p.qty,t:K.turns}));
  const t=NEWS('kake.sign',{n:nameOf(cid),g:c.short,q:p.qty,d:fmt(p.dep)});pushNews(t);
  return UT('kake.signed',{n:nameOf(cid),g:c.short,q:p.qty,u:fmt1(p.unit),d:fmt(p.dep),b:e.name});
}
/* ---------- 主動上門（回府時事件） ---------- */
FACE_TITLE.kakeAsk='kake.ask.t';
FACE_EXT.kakeAsk=(e,name)=>{
  if(kakeWith(e.cid)||!kakeFreeBanto()||!kakeOffer(e.cid))return null;
  return {line:TX('kake.ask',{shop:kakeShop(e.cid)}),effect:UT('kake.ask.eff'),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="kakeAskYes" data-cid="'+e.cid+'">'+UT('btn.kakeAskYes')+'</button><button class="pixel-btn btn-sm" data-act="faceNext">'+UT('btn.kakeAskNo')+'</button></div>'};
};
ACT.kakeAskYes=el=>{UI.showInfo(UT('kake.pick.t',{a:nameOf(el.dataset.cid)}),kakePickHtml(el.dataset.cid,'home'))};
/* ---------- 填貨 ---------- */
/** 保留量不能超過倉裡實際有的（被別的用途拿走、損耗、失火時，從晚簽的合約扣起）。 */
function kakeSync(){
  const L=pactAll(),names=[...new Set(L.map(p=>p.name))];
  names.forEach(n=>{let over=kakeHeld(n)-(G.inv[n]||0);
    for(let i=L.length-1;i>=0&&over>0;i--){const p=L[i];if(p.name!==n)continue;const d=Math.min(p.ref.filled||0,over);p.ref.filled=(p.ref.filled||0)-d;over-=d}});   // 從交貨順序最後的扣起
}
function kakeDue(c){return c.start<=G.turn}
/** 把倉裡的貨填進要交的合約（照交貨先後）；回傳填了幾單位。
 *  自動（旬初）只填這次推進就要交的；手動按「填貨」時，上貢不到期也先填（一次交清，可以提早備）。 */
function kakeFill(manual){
  kakeSync();let n=0;
  pactAll().filter(p=>p.due||(manual&&p.kind==='tribute')).forEach(p=>{const d=Math.min(p.qty-(p.ref.filled||0),Math.floor(kakeFree(p.name)));if(d>0){p.ref.filled=(p.ref.filled||0)+d;n+=d}});
  return n;
}
/** 這次推進就要交、還沒備齊的合約（推進前提醒、紅點用）：回傳 [{kind,cid,name,qty,filled}]。 */
const kakeGaps=()=>{kakeSync();return pactAll().filter(p=>p.due&&(p.ref.filled||0)<p.qty).map(p=>({kind:p.kind,cid:p.cid,name:p.name,qty:p.qty,filled:p.ref.filled||0}))};
ACT.kakeFill=()=>{const n=kakeFill(true),g=kakeGaps().length;toast(UT(n?(g?'kake.fill.part':'kake.fill.ok'):'kake.fill.none',{n}));if(n)sfx.tap();UI.render();
  if(!$('#info-bd').classList.contains('hidden')&&KAKE_WARN){UI.hideInfo()}};
/* ---------- 交貨（每旬推進一開始，自動出貨之前；此時日期還沒前進，due＝G.turn+2 才是「下一旬的旬報收帳」） ---------- */
function kakeEnd(c){G.kake=kakeList().filter(x=>x!==c)}
/** 失約：有多少交多少，合約結束；下一旬照已交的貨值結算，扣掉手付（多收的退還）。 */
function kakeFail(c,log,why){
  const K=KK(),g=COMM_MAP[c.name],r=R(c.cid),net=Math.round(c.done*c.unit)-c.dep;
  setAff(r,Math.max(0,r.aff-K.failAff));loseFame('kakeFail');logRel(c.cid,UT('kake.log.fail',{a:K.failAff}));
  kakeRecvList().push({cid:c.cid,name:c.name,amt:net,due:G.turn+2,sure:true,banto:c.banto,gain:c.gain||0});
  kakeEnd(c);
  const t=NEWS(why==='banto'?'kake.fail.banto':'kake.fail',{n:nameOf(c.cid),g:g?g.short:c.name,a:K.failAff});pushNews(t);if(log)log.push(t);
}
function kakeDeliver(log){
  if(!G.kake||!G.kake.length)return;
  kakeSync();
  kakeList().filter(kakeDue).forEach(c=>{
    const q=stockTake(c.name,Math.min(c.filled||0,G.inv[c.name]||0)).qty;
    c.done+=q;c.filled=0;c.gain=(c.gain||0)+Math.max(0,(marketQuote(c.name)-c.unit)*q);
    if(q<c.qty){kakeFail(c,log);return}
    c.left--;
    if(c.left<=0){
      kakeRecvList().push({cid:c.cid,name:c.name,amt:c.total-c.dep,due:G.turn+2,banto:c.banto,gain:c.gain||0});kakeEnd(c);
      logRel(c.cid,UT('kake.log.done'));
      const t=NEWS('kake.done',{n:nameOf(c.cid),g:COMM_MAP[c.name].short,a:fmt(c.total-c.dep)});pushNews(t);log.push(t);
    }
  });
}
/* ---------- 每旬 ---------- */
const kakeInc=(k,v)=>{if(TURNRP)TURNRP[k]=(TURNRP[k]||0)+v};
function kakeTick(log){
  const K=KK(),put=t=>{pushNews(t);log.push(t)};
  if(disasterNow())G.kakeDisY=G.year;
  // 解鎖：市佔第一次超過一成
  if(!G.kakeOn&&G.share&&G.share.me>K.unlock){G.kakeOn=true;put(NEWS('kake.unlock'))}
  // 番頭異動：轉給空閒的番頭，沒人可接就失約
  kakeList().slice().forEach(c=>{
    const e=(G.emps||[]).find(x=>x.id===c.banto);
    if(e&&e.rank==='banto'&&!jailedEmp(e))return;
    const f=kakeFreeBanto();if(f)c.banto=f.id;else kakeFail(c,log,'banto');
  });
  // 收帳
  G.kakeRecv=kakeRecvList().filter(r=>{
    if(r.due>G.turn)return true;
    const n=npc(r.cid),rel=R(r.cid),g=COMM_MAP[r.name]?COMM_MAP[r.name].short:r.name,who=nameOf(r.cid);
    const e=(G.emps||[]).find(x=>x.id===r.banto),pay=v=>{G.silver+=v;if(v>0){kakeInc('kakeFin',v);if(e)e.kakeIn=(e.kakeIn||0)+v}};
    if(n&&n.role==='guest'&&r.gain>0){bzInit(n);n.bzPend=(n.bzPend||0)+Math.round(r.gain);r.gain=0}   // 轉手利潤記進他的身代
    if(r.sure){pay(r.amt);put(NEWS(r.amt>=0?'kake.settle':'kake.refund',{n:who,a:fmt(Math.abs(r.amt))}));return false}
    const gone=!n||!alive(r.cid)||n.cityId!==G.cityId||n.hired;
    const skill=e?statsOfEmp(e).commerce_skill:0;
    const pBad=gone?K.goneBad:Math.max(0,K.bad-Math.floor(skill/K.skillPer)*K.skillCut)*(G.kakeDisY===G.year?K.disasterX:1);
    if(chance(pBad)){
      const got=(gone||chance(0.5))?Math.round(r.amt/2):0,loss=r.amt-got;pay(got);
      setAff(rel,Math.max(0,rel.aff-K.badAff));logRel(r.cid,UT('kake.log.bad',{a:fmt(loss)}));
      if(n&&n.role==='guest'){bzInit(n);n.bzPend=(n.bzPend||0)+loss}
      put(NEWS(got?'kake.bad.half':'kake.bad.all',{n:who,g,a:fmt(got),l:fmt(loss)}));return false;
    }
    if(!r.late&&!gone&&chance(K.late*clamp((100-rel.aff)/(100-K.aff),0,1))){r.late=true;r.due=G.turn+K.lateTurns;put(NEWS('kake.late',{n:who,a:fmt(r.amt)}));return true}
    pay(r.amt);put(NEWS('kake.paid',{n:who,g,a:fmt(r.amt)}));return false;
  });
  if(G.kakeOn){
    // 本旬帶「求掛賣」標記的旅商人
    const L=cityNpcs(G.cityId,'guest').filter(n=>alive(n.cid)&&!n.hired&&!jailed(n)&&!isEnemy(n.cid));
    G.kakeMarks={t:G.turn,ids:shuffle(L).slice(0,rint(K.marks[0],K.marks[1])).map(n=>n.cid)};
    // 好感滿的旅商人自己上門（一旬最多一位）
    if(kakeFreeBanto()){const c=L.filter(n=>G.rel[n.cid]&&G.rel[n.cid].bond&&G.rel[n.cid].aff>=K.selfAff&&!kakeWith(n.cid)).find(()=>chance(K.selfP));
      if(c&&kakeOffer(c.cid))queueHomeEvent({type:'kakeAsk',cid:c.cid})}
  }
  kakeFill();                                       // 旬初自動填貨
}
/* ---------- 推進前的缺貨確認 ---------- */
let KAKE_SKIP=false,KAKE_WARN=false;
function kakeGuard(n){
  if(KAKE_SKIP){KAKE_SKIP=false;return false}
  const L=kakeGaps();if(!L.length)return false;
  let h='<p class="small">'+UT('kake.warn')+'</p>'+L.map(c=>'<div class="row small" style="margin-top:3px;color:#b3261e"><span>'+esc(nameOf(c.cid))+'·'+esc(COMM_MAP[c.name].short)+'</span><b>'+UT('kake.warn.row',{n:c.qty-(c.filled||0)})+'</b></div>').join('');
  h+='<div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap"><button class="pixel-btn btn-gold" style="flex:1 1 100%;padding:8px" data-act="kakeFill">'+UT('btn.kakeFill')+'</button><button class="pixel-btn" style="flex:1 1 0;padding:8px" data-act="kakeSkip" data-n="'+(n||1)+'">'+UT('btn.kakeSkip')+'</button><button class="pixel-btn" style="flex:1 1 0;padding:8px" data-act="kakeBack">'+UT('btn.vQBack')+'</button></div>';
  KAKE_WARN=true;UI.showInfo(UT('kake.warn.t'),h);sfx.tap();
  return true;
}
ACT.kakeSkip=el=>{KAKE_SKIP=true;KAKE_WARN=false;if(voyQPending())VOYQ_SKIP=true;UI.hideInfo();doTurn(Number(el.dataset.n)||1)};
ACT.kakeBack=()=>{KAKE_WARN=false;UI.hideInfo();UI.go('market')};
{const _h=UI.hideInfo;UI.hideInfo=function(){KAKE_WARN=false;return _h.apply(this,arguments)}}
/* ---------- 畫面 ---------- */
/** 相場頁的「📦 合約」卡（原行情表的位置）：定約掛賣、上貢、本陣御用達每張一列，一個「填貨」按鈕（第二百五十一節）。都沒有、掛賣也沒解鎖時不出現。 */
function kakeCard(){
  const X=pactExtras();if(!kakeOn()&&!X.length)return '';
  const L=kakeList();kakeSync();
  let h='<div class="card" id="kake-card" style="background:#fff8eb"><div class="row"><b class="small">'+UT('kake.card.t')+'</b>'+(kakeOn()?'<span class="tiny muted">'+UT('kake.card.cap',{n:L.length,m:kakeBantos().length})+'</span>':'')+'</div>';
  if(!L.length&&!X.length)return h+'<div class="tiny muted" style="margin-top:4px">'+UT(kakeBantos().length?'kake.card.none':'kake.card.noBanto')+'</div></div>';
  let gap=0,early=0;
  const row=(cid,name,right,lack,sub,who)=>'<div style="margin-top:5px;padding-top:4px;border-top:1px dashed #b5a98f"><div class="row small" data-act="focus" data-n="'+esc(name)+'" style="cursor:pointer"><span><b>'+esc(nameOf(cid))+'</b>·'+esc(COMM_MAP[name].short)+'</span><b'+(lack>0?' style="color:#b3261e"':'')+'>'+right+'</b></div><div class="row tiny muted"><span>'+sub+'</span><span>'+who+'</span></div></div>';
  h+=L.map(c=>{const e=(G.emps||[]).find(x=>x.id===c.banto),due=kakeDue(c),lack=due?c.qty-(c.filled||0):0;if(lack>0)gap++;
    return row(c.cid,c.name,due?(lack>0?UT('kake.row.lack',{f:c.filled||0,q:c.qty,n:lack}):UT('kake.row.full',{q:c.qty})):UT('kake.row.next',{q:c.qty}),lack,UT('kake.row.sub',{u:fmt1(c.unit),l:c.left}),UT('kake.row.banto',{b:esc(e?e.name:'')}))}).join('');
  h+=X.map(p=>{const f=p.ref.filled||0,lack=p.due?p.qty-f:0;if(lack>0)gap++;if(!p.due&&p.kind==='tribute'&&f<p.qty)early++;
    let right,sub;
    if(p.kind==='tribute'){const t=Math.max(0,p.ref.due-G.turn);right=f>=p.qty?UT('pact.trib.full',{q:p.qty}):lack>0?UT('kake.row.lack',{f,q:p.qty,n:lack}):UT('pact.trib.prep',{f,q:p.qty});sub=UT(t<=1?'pact.trib.subNow':'pact.trib.sub',{t})}
    else{right=p.due?(lack>0?UT('kake.row.lack',{f,q:p.qty,n:lack}):UT('kake.row.full',{q:p.qty})):UT('kake.row.next',{q:p.qty});sub=UT('pact.honjin.sub',{l:p.ref.left})}
    return row(p.cid,p.name,right,lack,sub,UT('pact.self'))}).join('');
  const can=gap||early;
  h+='<div style="margin-top:6px"><button class="pixel-btn btn-sm btn-gold" data-act="kakeFill" '+(can?'':'disabled')+'>'+UT(can?'btn.kakeFill':'btn.kakeFilled')+'</button></div>';
  return h+'<div class="tiny muted" style="margin-top:4px">'+UT('kake.card.note')+'</div></div>';
}
/** 進出貨拉霸下方的折線圖（這項貨近期的收市價）。 */
function priceChart(name){
  const h=(G.mk[name]&&G.mk[name].hist)||[];if(h.length<2)return '';
  const W=300,H=54,mn=Math.min(...h),mx=Math.max(...h),rg=Math.max(0.0001,mx-mn),up=h[h.length-1]>=h[h.length-2];
  const pts=h.map((v,i)=>(4+i*((W-8)/(h.length-1))).toFixed(1)+','+(H-6-((v-mn)/rg)*(H-14)).toFixed(1)).join(' ');
  return '<div style="border-top:1px dashed #b5a98f;padding-top:4px;margin-top:4px"><div class="row tiny muted"><span>'+UT('mk.chart.t')+'</span><span>'+UT('mk.chart.range',{a:fmt1(mn),b:fmt1(mx)})+'</span></div><svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:54px;display:block"><polyline fill="none" stroke="'+(up?'#b3261e':'#1e7e34')+'" stroke-width="2" points="'+pts+'"/></svg></div>';
}
/** 本旬買賣面板上的保留提示。 */
const kakeHeldNote=name=>{const n=kakeHeld(name);return n>0?'<div class="tiny" style="margin:2px 0;color:#27407a">'+UT('kake.held',{n})+'</div>':''};
/** 人物卡上的標記。 */
function kakeTag(cid){
  if(!kakeOn())return '';
  return kakeWith(cid)?'<span class="tag green">'+UT('kake.tag.on')+'</span>':kakeMarked(cid)?'<span class="tag gold">'+UT('kake.tag')+'</span>':'';
}
/** 現款走勢：借款卡下方的「賣掛」。 */
function kakeRecvCard(){
  const L=kakeRecvList().filter(r=>!r.sure).slice().sort((a,b)=>a.due-b.due);
  if(!kakeOn()&&!L.length)return '';
  let h='<div class="card" style="margin-top:8px"><b class="small">'+UT('kake.recv.t')+'</b>';
  if(!L.length)return h+'<div class="tiny muted" style="margin-top:2px">'+UT('kake.recv.none')+'</div></div>';
  L.forEach(r=>{const left=Math.max(0,r.due-G.turn);h+='<div class="row tiny" style="margin-top:2px"><span>'+esc(nameOf(r.cid))+(r.late?UT('kake.recv.late'):'')+'</span><b style="white-space:nowrap;margin-left:6px">'+UT('silver.debtCard.5',{a:fmt(r.amt),b:left?UT('kake.recv.due',{a:left}):UT('kake.recv.now')})+'</b></div>'});
  return h+'</div>';
}
{const _d=debtCard;debtCard=function(){return _d.apply(this,arguments)+kakeRecvCard()}}
/* ---------- 其他系統的銜接 ---------- */
/** 有合約在身的旅商人不能延攬進店。 */
{const _e=enlistRanks;enlistRanks=function(cid){return kakeWith(cid)?[]:_e.apply(this,arguments)}}
