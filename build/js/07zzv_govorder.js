'use strict';
/* ★檔案總覽：官府注文（只給礦產；DESIGN_NOTES 第二百七十八節）
 * - 平時小單：本城普請方、勘定方四階以上、好感 ≥60 的官員，每旬約一成二機會上門（回府時事件），同時最多一張。
 *   總值約 2,000～5,000 兩，三、四旬分批交（下一旬起每旬一批），價錢是接單當旬牌價加兩成。交完好感 +5。
 *   哪一旬交不齊就失約：該旬有多少交多少、照價入帳，好感 −30、知名度 −2，合約結束。
 * - 軍需大單（上貢類）：軍需事件那一次，約一半機會有一位普請方四階以上、好感 ≥60 的官員開口；一年最多兩張。
 *   每張總值依官階（四階約 8,000～15,000、五階 15,000～25,000、六階 25,000～40,000 兩），件數不超過單項庫存上限；
 *   開價基準價一倍六到兩倍，但不低於不含軍需漲幅的平時牌價加兩成；四到六旬後一次交清。
 *   交齊：好感 +10、知名度 +2；交不齊：失約，好感 −30、知名度 −5。
 * - 兩種都由本店負責：不佔番頭、不受總資產限制、不算本城出貨、不加市佔；列在相場「📦 合約」卡（軍需單可以提早填貨）。
 * - 官員死去、關押或離城：他經手的單作廢，已交的照算。遷居籌備期間不上門。
 * - 狀態 G.gov={orders:[{id,kind:'govS'|'govW',cid,name,qty,unit,left?,start?,due?,filled}],war:{y,n},warT}；
 *   數值 ODDS.gov；台詞 LINES.gov；文字 gov.*（01e）；新聞 gov.*（01g）。每旬 govTick（advanceTurn，patronTick 之後）。 */
const GV=()=>ODDS.gov;
const govOn=()=>!!(G&&G.sysKey==='mining');
const govState=()=>G.gov||(G.gov={orders:[],war:{y:G.year,n:0},warT:null});
const govOrders=()=>govState().orders;
/** 這位官員能不能下單：本城、在城（巡迴的只在來城時）、四階以上、好感夠、不是仇人；courts 指定官署。 */
function govOfficialOK(cid,courts){
  const n=npc(cid),r=G.rel[cid];
  if(!n||n.role!=='official'||!n.pos||!alive(cid)||jailed(n)||n.cityId!==G.cityId)return false;
  if(!courts.includes(n.pos.court)||n.pos.rank<GV().rank)return false;
  if(touring(n)&&!tourHere(n))return false;
  return !!(r&&r.aff>=GV().aff&&!isEnemy(cid));
}
const govOfficials=courts=>Object.values(G.world.npcs).filter(n=>govOfficialOK(n.cid,courts)).map(n=>n.cid);
/** 還在進行的單與還沒回覆的上門。 */
const govPending=k=>homeQ().filter(e=>e.type===k&&e.turn===G.turn).length;
const govHas=k=>govOrders().some(o=>o.kind===k)||govPending(k)>0;
/** 平時小單的開價。 */
function govSmallOffer(cid){
  const P=GV(),n=npc(cid),L=(P.smallGoods[n.pos.court]||[]).filter(k=>COMM_MAP[k]&&tradeOK(k));
  const turns=rint(P.smallTurns[0],P.smallTurns[1]),val=rint(P.smallVal[0],P.smallVal[1]);
  const cs=L.map(k=>{const unit=Math.round(marketQuote(k)*P.smallMarkup*10)/10,q=Math.min(Math.floor(val/turns/unit),Math.floor(itemCap(k)*0.5));return {name:k,unit,qty:q}}).filter(x=>x.qty>=1);
  if(!cs.length)return null;
  const c=pick(cs);return {kind:'govS',cid,name:c.name,qty:c.qty,unit:c.unit,left:turns};
}
/** 軍需大單的開價。 */
function govWarOffer(cid){
  const P=GV(),cs=tradeComms().filter(c=>commTag(c,'military'));if(!cs.length)return null;
  const c=pick(cs),cap=itemCap(c.name),m=G.mk[c.name]||{},V=P.warVal[Math.min(6,npc(cid).pos.rank)]||P.warVal[4];
  const calm=marketQuote(c.name)/Math.max(0.01,m.ev||1);   // 不含軍需漲幅的平時牌價
  const unit=Math.round(Math.max(c.base*(P.warPrice[0]+rnd()*(P.warPrice[1]-P.warPrice[0])),calm*P.warFloor)*10)/10;
  const qty=Math.min(cap,Math.max(P.warMin,Math.round(rint(V[0],V[1])/unit)));
  if(qty<1)return null;
  return {kind:'govW',cid,name:c.name,qty,unit,turns:rint(P.warTurns[0],P.warTurns[1])};
}
/** 扣掉其他合約保留的貨，這張單能動用的庫存。 */
const govAvail=o=>Math.max(0,(G.inv[o.name]||0)-(kakeHeld(o.name)-(o.filled||0)));
/** 每旬：作廢、交貨、上門。 */
function govTick(log){
  if(!G||!G.world||!G.gov&&!govOn())return;
  const S=govState(),P=GV(),put=t=>{pushNews(t);log.push(t)};
  if(S.war.y!==G.year)S.war={y:G.year,n:0};
  // 作廢：官員不在了
  S.orders.slice().forEach(o=>{
    const n=npc(o.cid);
    if(n&&alive(o.cid)&&!jailed(n)&&n.cityId===G.cityId)return;
    S.orders=S.orders.filter(x=>x!==o);o.filled=0;
    put(NEWS('gov.void',{n:nameOf(o.cid),g:COMM_MAP[o.name]?COMM_MAP[o.name].short:''}));
  });
  // 交貨
  S.orders.slice().forEach(o=>{
    const c=COMM_MAP[o.name];if(!c){S.orders=S.orders.filter(x=>x!==o);return}
    const r=R(o.cid),nm=nameOf(o.cid);
    if(o.kind==='govS'){
      if(G.turn<o.start)return;
      const q=Math.min(o.qty,govAvail(o)),amt=Math.round(q*o.unit);
      stockTake(o.name,q,false);G.silver+=amt;G.lastRev+=amt;o.filled=0;
      if(q<o.qty){
        S.orders=S.orders.filter(x=>x!==o);setAff(r,Math.max(0,r.aff-P.failAff));loseFame('govFail');
        logRel(o.cid,UT('gov.log.fail',{g:c.short,q:o.qty}));put(NEWS('gov.s.fail',{n:nm,g:c.short,q:o.qty,h:q,b:fmt(amt),a:P.failAff}));sfx.bad();return;
      }
      o.left--;
      if(o.left>0){put(NEWS('gov.s.give',{n:nm,g:c.short,q,a:fmt(amt),l:o.left}));return}
      S.orders=S.orders.filter(x=>x!==o);setAff(r,r.aff+P.smallAff);
      logRel(o.cid,UT('gov.log.done',{g:c.short}));put(NEWS('gov.s.done',{n:nm,g:c.short,q,a:fmt(amt),f:P.smallAff}));sfx.coin();
      return;
    }
    if(G.turn<o.due)return;
    S.orders=S.orders.filter(x=>x!==o);
    if(govAvail(o)>=o.qty){
      const rev=Math.round(o.qty*o.unit);stockTake(o.name,o.qty,false);G.silver+=rev;G.lastRev+=rev;G.life.peak=Math.max(G.life.peak,G.silver);
      setAff(r,r.aff+P.warAff);const f0=G.fame||0;addFame(P.warFame,'mid');const gf=Math.round(((G.fame||0)-f0)*10)/10;
      logRel(o.cid,UT('gov.log.done',{g:c.short}));put(NEWS('gov.w.done',{n:nm,g:c.short,q:o.qty,a:fmt(rev),f:gf}));sfx.coin();
    }else{
      setAff(r,Math.max(0,r.aff-P.failAff));loseFame('govWarFail');
      logRel(o.cid,UT('gov.log.fail',{g:c.short,q:o.qty}));put(NEWS('gov.w.fail',{n:nm,g:c.short,q:o.qty,h:govAvail(o),a:P.failAff}));sfx.bad();
    }
    o.filled=0;
  });
  if(!govOn()||moving()){S.warT=null;return}
  // 軍需大單：這次推進碰上軍需
  if(S.warT!=null){
    S.warT=null;
    if(S.war.n<P.warPerYear&&chance(P.warP)){
      const L=shuffle(govOfficials(['administration']).filter(cid=>!S.orders.some(o=>o.cid===cid&&o.kind==='govW')));
      const o=L.length?govWarOffer(L[0]):null;
      if(o){S.war.n++;queueHomeEvent({type:'govW',cid:o.cid,o})}
    }
  }
  // 平時小單
  if(!govHas('govS')&&chance(P.smallP)){
    const L=shuffle(govOfficials(['administration','finance']));
    for(const cid of L){const o=govSmallOffer(cid);if(o){queueHomeEvent({type:'govS',cid,o});break}}
  }
}
/* 軍需事件：記下這一旬（govTick 再決定有沒有人開口） */
{const E=EVENTS.find(e=>e.k==='military');if(E){const _f=E.f;E.f=function(){const t=_f.apply(this,arguments);if(govOn())govState().warT=G.turn;return t}}}
/* ---------- 上門的視窗 ---------- */
FACE_TITLE.govS='gov.s.t';
FACE_TITLE.govW='gov.w.t';
FACE_EXT.govS=(e)=>{
  const o=e.o;if(!o||govOrders().some(x=>x.kind==='govS')||!tradeOK(o.name)||!govOfficialOK(o.cid,['administration','finance']))return null;
  UI.s.govOffer=o;const c=COMM_MAP[o.name],ct=npc(o.cid).pos.court;
  return {line:TX(ct==='finance'?'gov.finance':'gov.admin',{g:c.short}),effect:UT('gov.s.eff',{g:c.short,q:o.qty,l:o.left,u:fmt1(o.unit),a:fmt(Math.round(o.qty*o.left*o.unit))}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="govTake">'+UT('btn.govTake')+'</button><button class="pixel-btn btn-sm" data-act="faceNext">'+UT('btn.ptPass')+'</button></div>'};
};
FACE_EXT.govW=(e)=>{
  const o=e.o;if(!o||!tradeOK(o.name)||!govOfficialOK(o.cid,['administration']))return null;
  UI.s.govOffer=o;const c=COMM_MAP[o.name];
  return {line:TX('gov.war',{g:c.short}),effect:UT('gov.w.eff',{g:c.short,q:o.qty,u:fmt1(o.unit),a:fmt(Math.round(o.qty*o.unit)),t:o.turns}),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="govTake">'+UT('btn.govTake')+'</button><button class="pixel-btn btn-sm" data-act="faceNext">'+UT('btn.ptPass')+'</button></div>'};
};
ACT.govTake=()=>{
  const o=UI.s.govOffer;UI.s.govOffer=null;if(!o)return UI.hideInfo();
  if(moving()){toast(UT('mv.noNew'));return UI.hideInfo()}
  if(o.kind==='govS'&&govOrders().some(x=>x.kind==='govS')){toast(UT('gov.full'));return UI.hideInfo()}
  const c=COMM_MAP[o.name],id=G.turn+'_'+Math.floor(rnd()*1e5);
  if(o.kind==='govS')govOrders().push({id,kind:'govS',cid:o.cid,name:o.name,qty:o.qty,unit:o.unit,left:o.left,start:G.turn+1,filled:0});
  else govOrders().push({id,kind:'govW',cid:o.cid,name:o.name,qty:o.qty,unit:o.unit,due:G.turn+o.turns,filled:0});
  logRel(o.cid,UT('gov.log.take',{g:c.short,q:o.qty}));
  toast(UT(o.kind==='govS'?'gov.s.taken':'gov.w.taken',{n:nameOf(o.cid),g:c.short,q:o.qty,l:o.left,t:o.turns}),4600);sfx.tap();UI.hideInfo();UI.render();
};
/* ---------- 接進合約卡 ---------- */
{const _x=pactExtras;pactExtras=function(){const L=_x.apply(this,arguments);if(G&&G.gov)govOrders().forEach(o=>{if(!COMM_MAP[o.name])return;
  if(o.kind==='govS')L.push({kind:'govS',ref:o,cid:o.cid,name:o.name,qty:o.qty,due:G.turn+1>=o.start,left:o.left});
  else L.push({kind:'govW',ref:o,cid:o.cid,name:o.name,qty:o.qty,due:G.turn+1>=o.due})});return L}}
