/* ═════ [07zzu_patron] ═════ */
'use strict';
/* ★檔案總覽：貴人訂貨（奢侈品的訂單；DESIGN_NOTES 第二百六十九、二百七十五節）
 * - 奢侈品照舊在相場（冷熱循環、地板價不變），另外有大官貴人的訂單，是「一賣吃三年」的主要來源。
 * - 誰會訂：本城三系四階以上官員（巡迴的五、六階只在來城那個月），以及番付身代欄上榜的旅商（大關約當六階、關脇與小結五階、前頭四階）；
 *   好感 80 以上、不是仇人才找你；只訂你有交易許可的本業奢侈品。
 * - 什麼時候：本城節慶與歲末（12 月下旬）兩段；交貨在節慶當旬或 12 月下旬那一次推進，訂單在交貨前約兩個月到一個月之間上門（回府時事件）。
 * - 份量：四階 1～2 件、五階 2～3 件、六階 3～5 件；每三到五年挑一段「大年」，件數加倍。開價基準價 2.5～3.5 倍，接下時說定。
 * - 同時最多八張（含還沒回覆的上門），每位貴人一季一張。由本店負責交貨：列在相場「📦 合約」卡，可以提早填貨；不算本城出貨。
 * - 交齊：現款入帳、對方好感 +10、知名度 +2～3（中事件）；旅商的轉手利潤記進他的身代。交不齊：失約，好感 −30、知名度 −2。
 * - 狀態 G.patron={y,seasons:[{k,due,from,to,big,asked:{}}],bigY,bigK,orders:[{id,cid,name,qty,unit,due,filled,k}]}；數值 ODDS.patron；
 *   台詞 LINES.patron；文字 pt.*（01e）；新聞 pt.*（01g）。每旬 patronTick（advanceTurn，upkeep 之後）。 */
const PT=()=>ODDS.patron;
const ptState=()=>G.patron||(G.patron={y:null,seasons:[],bigY:G.year+rint(PT().bigEvery[0],PT().bigEvery[1]),bigK:null,orders:[]});
const ptOrders=()=>ptState().orders;
/** 某年月旬的旬數。 */
const ptTurnOf=(y,m,c)=>G.turn+(y-G.year)*36+(m-G.month)*3+(c-G.cycle);
/** 能接單的奢侈品（本業、有交易許可）。 */
const ptGoods=()=>tradeComms().filter(c=>c.luxury).concat(goyoComms());   // 帝都御用品也接（第三百三十四節）
/** 排今年與明年的兩段（節慶、歲末）：一月的節慶要在前一年就排，上門期才來得及。 */
function ptPlan(){
  const S=ptState(),P=PT();if(S.y===G.year)return;
  S.y=G.year;S.seasons=S.seasons.filter(x=>x.due>G.turn);
  const f=homeCity().special_festival;
  [G.year,G.year+1].forEach(y=>{
    const L=[];
    if(f&&f.month&&f.cycle)L.push({k:'fest',due:ptTurnOf(y,f.month,f.cycle)+1});
    L.push({k:'year',due:ptTurnOf(y,12,3)+1});
    if(S.bigY===y&&!S.bigK)S.bigK=pick(L).k;
    L.forEach(x=>{if(x.due-1<=G.turn||S.seasons.some(z=>z.due===x.due))return;S.seasons.push({k:x.k,y,due:x.due,from:x.due-1-P.lead[1],to:x.due-1-P.lead[0],big:S.bigY===y&&S.bigK===x.k,asked:{}})});
  });
}
/** 貴人的份量等級（4～6）；不是貴人回傳 0。 */
function ptTier(cid){
  const n=npc(cid);if(!n||!alive(cid)||n.cityId!==G.cityId||jailed(n))return 0;
  if(n.role==='official'&&n.pos&&CITY_COURTS.includes(n.pos.court)&&n.pos.rank>=4)return touring(n)&&!tourHere(n)?0:Math.min(6,n.pos.rank);
  if(n.role==='guest'&&!n.hired){const B=bzLast(),row=B&&B.w&&B.w.find(r=>r.k===cid);if(row)return row.i===0?6:row.i<=2?5:4}
  return 0;
}
/** 這一季會找你的貴人。 */
function ptBuyers(){
  const C=new Set();Object.values(G.world.npcs).forEach(n=>{if(n.cityId===G.cityId&&(n.role==='official'||n.role==='guest'))C.add(n.cid)});
  return [...C].filter(cid=>{const r=G.rel[cid];return r&&r.aff>=PT().aff&&!isEnemy(cid)&&ptTier(cid)>0});
}
/** 還沒交貨的單＋還沒回覆的上門。 */
const ptBusy=()=>ptOrders().length+homeQ().filter(e=>e.type==='patron'&&e.turn===G.turn).length;
/** 開一張單（份量、開價照當下）。 */
function ptOffer(cid,S){
  const P=PT(),cs=ptGoods();if(!cs.length)return null;
  const c=pick(cs),t=ptTier(cid),r=P.qty[t];if(!r)return null;
  let q=rint(r[0],r[1]);if(S.big)q*=P.bigMult;
  const unit=Math.round(c.base*(P.price[0]+rnd()*(P.price[1]-P.price[0]))*10)/10;
  return {cid,name:c.name,qty:q,unit,due:S.due,k:S.k,big:!!S.big};
}
/** 每旬：排程、上門、交貨。 */
function patronTick(log){
  if(!G||!G.world)return;
  ptPlan();const S0=ptState(),P=PT();
  // 交貨（到期那一次推進）
  S0.orders.filter(o=>o.due<=G.turn).forEach(o=>{
    S0.orders=S0.orders.filter(x=>x!==o);
    const have=Math.max(0,(G.inv[o.name]||0)-kakeHeld(o.name)),c=COMM_MAP[o.name],nm=nameOf(o.cid),r=R(o.cid);
    if(have>=o.qty){
      const rev=Math.round(o.qty*o.unit);stockTake(o.name,o.qty,false);G.silver+=rev;G.lastRev+=rev;G.life.peak=Math.max(G.life.peak,G.silver);
      setAff(r,r.aff+P.doneAff);const f0=G.fame||0;addFame(rint(P.fame[0],P.fame[1]),'mid');const gf=Math.round(((G.fame||0)-f0)*10)/10;
      bzDeal(o.cid,Math.round(o.qty*(c.base*P.resell)),c.name);   // 旅商轉手的利潤記進他的身代（官員不記）
      logRel(o.cid,UT('pt.log.done',{g:c.short,q:o.qty,a:fmt(rev)}));
      const t=NEWS('pt.done',{n:nm,g:c.short,q:o.qty,a:fmt(rev),f:gf});pushNews(t);log.push(t);sfx.coin();
    }else{
      setAff(r,Math.max(0,r.aff-P.failAff));loseFame('patronFail');
      logRel(o.cid,UT('pt.log.fail',{g:c.short,q:o.qty}));
      const t=NEWS('pt.fail',{n:nm,g:c.short,q:o.qty,h:have,a:P.failAff});pushNews(t);log.push(t);sfx.bad();
    }
    o.filled=0;
  });
  S0.seasons=S0.seasons.filter(x=>x.due>G.turn);
  if(S0.bigK&&S0.bigY<=G.year&&!S0.seasons.some(x=>x.big)){S0.bigY=G.year+rint(P.bigEvery[0],P.bigEvery[1]);S0.bigK=null;S0.y=null}   // 大年那一段過了：排下一次（下一旬重排季程）
  // 上門（回府時事件）
  if(moving()||!ptGoods().length)return;
  S0.seasons.filter(x=>G.turn>=x.from&&G.turn<=x.to).forEach(S=>{
    if(S.big&&!S.told){S.told=true;const t=NEWS('pt.bigRumor');pushNews(t);log.push(t)}
    shuffle(ptBuyers()).forEach(cid=>{
      if(S.asked[cid]||ptBusy()>=P.max||!chance(P.p))return;
      const o=ptOffer(cid,S);if(!o)return;S.asked[cid]=true;queueHomeEvent({type:'patron',cid,o});
    });
  });
}
/* ---------- 上門的視窗 ---------- */
FACE_TITLE.patron='pt.ask.t';
FACE_EXT.patron=(e,name)=>{
  const o=e.o;if(!o||ptOrders().length>=PT().max||!tradeOK(o.name))return null;
  UI.s.ptOffer=o;const c=COMM_MAP[o.name],n=npc(o.cid),off=n&&n.role==='official';
  const when=UT(o.k==='fest'?'pt.when.fest':o.k==='fast'?'pt.when.fast':'pt.when.year',{f:(homeCity().special_festival||{}).name||''});
  return {line:TX(off?'patron.official':'patron.guest',{g:c.short,w:when}),effect:UT('pt.ask.eff',{g:c.short,q:o.qty,u:fmt1(o.unit),a:fmt(Math.round(o.qty*o.unit)),w:when,t:Math.max(1,o.due-1-G.turn)})+(o.big?UT('pt.ask.big'):'')+stockRefTxt(o.name),   // 倉裡現有量（第三百四十七節）
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="ptTake">'+UT('btn.ptTake')+'</button><button class="pixel-btn btn-sm" data-act="faceNext">'+UT('btn.ptPass')+'</button></div>'};
};
ACT.ptTake=()=>{
  const o=UI.s.ptOffer;UI.s.ptOffer=null;if(!o)return UI.hideInfo();
  if(ptOrders().length>=PT().max){toast(UT('pt.full'));return UI.hideInfo()}
  if(moving()){toast(UT('mv.noNew'));return UI.hideInfo()}
  const c=COMM_MAP[o.name];
  ptOrders().push(Object.assign({id:G.turn+'_'+Math.floor(rnd()*1e5),filled:0},o));
  logRel(o.cid,UT('pt.log.take',{g:c.short,q:o.qty}));
  toast(UT('pt.taken',{n:nameOf(o.cid),g:c.short,q:o.qty,t:Math.max(1,o.due-1-G.turn)}),4600);sfx.tap();UI.hideInfo();UI.render();
};
/* ---------- 接進合約卡（照上貢的做法：本店負責、可以提早填貨） ---------- */
{const _x=pactExtras;pactExtras=function(){const L=_x.apply(this,arguments);if(G&&G.patron)ptOrders().forEach(o=>{if(COMM_MAP[o.name])L.push({kind:'patron',ref:o,cid:o.cid,name:o.name,qty:o.qty,due:G.turn+1>=o.due})});return L}}

/* ═════ [07zzv_govorder] ═════ */
'use strict';
/* ★檔案總覽：官府注文（只給礦產；DESIGN_NOTES 第二百七十八節）
 * - 平時小單：本城普請方、勘定方四階以上、好感 ≥60 的官員，每旬約一成二機會上門（回府時事件），同時最多一張。
 *   總值約 2,000～5,000 兩，三、四旬分批交（下一旬起每旬一批），價錢是接單當旬牌價加兩成。交完好感 +5。
 *   哪一旬交不齊就失約：該旬有多少交多少、照價入帳，好感 −30、知名度 −2，合約結束。
 * - 軍需大單（上貢類）：軍需事件那一次，約一半機會有一位普請方四階以上、好感 ≥60 的官員開口；一年最多兩張。
 *   每張總值依官階（四階約 8,000～15,000、五階 15,000～25,000、六階 25,000～40,000 兩），件數不超過本城需求的 12 倍（ODDS.gov.warCap，第三百五十二節）；
 *   開價依官階：四階基準價一倍六到兩倍（不低於平時牌價加兩成）、五階兩倍到兩倍四（不低於一倍半）、六階兩倍四到兩倍八（不低於一倍八）；四到六旬後一次交清。
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
  const c=pick(cs),cap=Math.max(1,Math.round((G.mk[c.name]?G.mk[c.name].D:cityD(homeCity(),c))*P.warCap)),m=G.mk[c.name]||{},V=P.warVal[Math.min(6,npc(cid).pos.rank)]||P.warVal[4];
  const calm=marketQuote(c.name)/Math.max(0.01,m.ev||1);   // 不含軍需漲幅的平時牌價
  const rk=Math.min(6,Math.max(4,npc(cid).pos.rank)),WP=P.warPrice[rk]||P.warPrice[4],WF=P.warFloor[rk]||P.warFloor[4];   // 開價依官階：五、六階不常在城，出價較好（第三百五十一節）
  const unit=Math.round(Math.max(c.base*(WP[0]+rnd()*(WP[1]-WP[0])),calm*WF)*10)/10;
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
/** 接單參考：倉裡現有多少這項貨（其他合約已留的另外註明；第三百四十六節）。 */
const govStockTxt=name=>stockRefTxt(name);   // 與掛賣、貴人訂貨共用（07l_trips.js）
FACE_TITLE.govS='gov.s.t';
FACE_TITLE.govW='gov.w.t';
FACE_EXT.govS=(e)=>{
  const o=e.o;if(!o||govOrders().some(x=>x.kind==='govS')||!tradeOK(o.name)||!govOfficialOK(o.cid,['administration','finance']))return null;
  UI.s.govOffer=o;const c=COMM_MAP[o.name],ct=npc(o.cid).pos.court;
  return {line:TX(ct==='finance'?'gov.finance':'gov.admin',{g:c.short}),effect:UT('gov.s.eff',{g:c.short,q:o.qty,l:o.left,u:fmt1(o.unit),a:fmt(Math.round(o.qty*o.left*o.unit))})+govStockTxt(o.name),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="govTake">'+UT('btn.govTake')+'</button><button class="pixel-btn btn-sm" data-act="faceNext">'+UT('btn.ptPass')+'</button></div>'};
};
FACE_EXT.govW=(e)=>{
  const o=e.o;if(!o||!tradeOK(o.name)||!govOfficialOK(o.cid,['administration']))return null;
  UI.s.govOffer=o;const c=COMM_MAP[o.name];
  return {line:TX('gov.war',{g:c.short}),effect:UT('gov.w.eff',{g:c.short,q:o.qty,u:fmt1(o.unit),a:fmt(Math.round(o.qty*o.unit)),t:o.turns})+govStockTxt(o.name),
    buttons:'<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="govTake">'+UT('btn.govTake')+'</button><button class="pixel-btn btn-sm" data-act="faceNext">'+UT('btn.ptPass')+'</button></div>'};
};
ACT.govTake=()=>{
  const o=UI.s.govOffer;UI.s.govOffer=null;if(!o)return UI.hideInfo();
  if(moving()){toast(UT('mv.noNew'));return UI.hideInfo()}
  if(o.kind==='govS'&&govOrders().some(x=>x.kind==='govS')){toast(UT('gov.full'));return UI.hideInfo()}
  const c=COMM_MAP[o.name],id=G.turn+'_'+Math.floor(rnd()*1e5);
  if(o.kind==='govS')govOrders().push({id,kind:'govS',cid:o.cid,name:o.name,qty:o.qty,unit:o.unit,left:o.left,start:G.turn+2,filled:0});   // 交貨在日期前進之後判定：+2 才是「下一旬推進時交第一批」，與定約掛賣一致（第三百四十六節）
  else govOrders().push({id,kind:'govW',cid:o.cid,name:o.name,qty:o.qty,unit:o.unit,due:G.turn+o.turns+1,filled:0});   // 同上：照畫面寫的旬數交清
  logRel(o.cid,UT('gov.log.take',{g:c.short,q:o.qty}));
  toast(UT(o.kind==='govS'?'gov.s.taken':'gov.w.taken',{n:nameOf(o.cid),g:c.short,q:o.qty,l:o.left,t:o.turns}),4600);sfx.tap();UI.hideInfo();UI.render();
};
/* ---------- 接進合約卡 ---------- */
{const _x=pactExtras;pactExtras=function(){const L=_x.apply(this,arguments);if(G&&G.gov)govOrders().forEach(o=>{if(!COMM_MAP[o.name])return;
  if(o.kind==='govS')L.push({kind:'govS',ref:o,cid:o.cid,name:o.name,qty:o.qty,due:G.turn+1>=o.start,left:o.left});
  else L.push({kind:'govW',ref:o,cid:o.cid,name:o.name,qty:o.qty,due:G.turn+1>=o.due})});return L}}

/* ═════ [07zzw_guide] ═════ */
'use strict';
/* ★檔案總覽：開業指引（DESIGN_NOTES 第二百八十三節）
 * - 每一世開局帶一次，只到第一次推進：① 出席例會 → ② 回相場 → ③ 按「照配額」或動進出貨拉霸 → ④ 按「推進一旬」。
 * - 狀態 G.guide={s:1～4}；結束（推進、按「不用帶了」）設為 null。舊存檔沒有就是 null，不帶。
 * - 玩家沒照順序走也行：在 ① 或 ② 進相場就跳到 ③；沒去例會就推進，例會照規則自動決議，指引照樣結束。
 * - 主畫面與相場頂端一張小卡；要按的東西加閃動金框（.guide-glow），② 時底部「相場」亮紅點。
 * - 文字 guide.*、btn.guideSkip（01e）；樣式 .guide-glow（style.css）。 */
const guideOn=()=>!!(G&&G.guide&&!G.ended);
/** 依目前狀態把步驟往前推（只進不退）。 */
function guideSync(){
  if(!guideOn())return;
  const g=G.guide;
  if(g.s===1){const M=meetNow();if(!M||M.done||(M.att&&!UI.s.sheet))g.s=2}
  if(g.s<=2&&UI.s.tab==='market')g.s=3;
}
/** 第 n 步的小卡。 */
function guideCard(){
  const s=G.guide.s;
  return '<div class="notice" id="guide-card" style="margin:6px 0;border-color:#e5a93b"><div class="row"><b class="small">'+UT('guide.title',{s,n:4})+'</b><span class="tiny" style="text-decoration:underline;cursor:pointer" data-act="guideSkip">'+UT('btn.guideSkip')+'</span></div><div class="small" style="margin-top:3px">'+UT('guide.'+s)+'</div></div>';
}
/** 重繪後套上指引：小卡、閃框、紅點。 */
function guideApply(){
  $$('.guide-glow').forEach(e=>e.classList.remove('guide-glow'));
  {const old=$('#guide-card');if(old)old.remove()}
  if(!guideOn())return;
  guideSync();
  const s=G.guide.s,tab=UI.s.tab;
  if(tab==='home'){const tip=$('#home-tip');if(tip){tip.classList.add('hidden');tip.insertAdjacentHTML('beforebegin',guideCard())}}
  else if(tab==='market'&&s>=3){const v=$('#view-market');if(v)v.insertAdjacentHTML('afterbegin',guideCard())}
  const glow=el=>{if(el)el.classList.add('guide-glow')};
  if(s===1)glow($('#guild-meet .loc')||$('#guild-meet button'));
  if(s===2){const b=$('#bottom button[data-tab="market"]');glow(b);if(b&&!b.querySelector('.nav-dot')){const d=document.createElement('i');d.className='nav-dot';b.appendChild(d)}}
  if(s===3)glow($('[data-act="planQuota"]'));
  if(s===4)$$('#b-next,.home-next').forEach(glow);
}
{const _r=UI.render;UI.render=function(){const r=_r.apply(this,arguments);try{guideApply()}catch(e){}return r}}
{const _c=UI.closeSheet;UI.closeSheet=function(){const r=_c.apply(this,arguments);if(guideOn())UI.render();return r}}
/** 按「照配額」或動過進出貨拉霸：到第 4 步。 */
const guideTouched=()=>{if(guideOn()&&G.guide.s<4){G.guide.s=4;guideApply()}};
{const _q=ACT.planQuota;ACT.planQuota=function(){if(guideOn()&&G.guide.s<4)G.guide.s=4;return _q.apply(this,arguments)}}
document.addEventListener('change',e=>{   // 拉霸放開、兩側加減鈕都會觸發 change
  if(e.target&&(e.target.id==='slider-ship'||e.target.id==='slider-buy'))guideTouched()});
ACT.guideSkip=()=>{if(G)G.guide=null;UI.render();sfx.tap()};
/** 第一次推進：指引結束。 */
{const _a=advanceTurn;advanceTurn=function(){if(G&&G.guide)G.guide=null;return _a.apply(this,arguments)}}

/* ═════ [07zzx_help] ═════ */
'use strict';
/* ★檔案總覽：去店裡幫忙（DESIGN_NOTES 第二百八十八節）
 * - 名門商邸裡同業與旅商人的人物卡多一顆「去店裡幫忙」：扣 1 點行動（照常加壓力），一旬只能幫一次（G.helpT＝幫過的那一旬）。
 * - 報酬：私房錢 20～40 兩（對方在本城同業與旅商裡身代越高給得越多）；好感（旅商 +3～5、同業 +2～4）；
 *   三成機會順便探聽到對方的性向。只有已經認識的人才會讓你去幫忙；仇人不讓你進門。
 * - 名望一到二階就永久停止（G.helpOff，之後掉回一階也不再開放）；按鈕不再出現，當旬旬報一則。
 * - 數值 ODDS.help；台詞 LINES.help；文字 btn.help*、help.*（01e）；新聞 help.off（01g）。 */
const HP=()=>ODDS.help;
/** 名望到了門檻就永久停止。 */
function helpCheck(log){
  if(!G||G.helpOff)return;
  if(fameTier()>=HP().stopTier){G.helpOff=true;if(log&&G.turn>0){const t=NEWS('help.off');pushNews(t);log.push(t)}}
}
const helpOK=cid=>{const n=npc(cid),r=G.rel[cid];return !!(r&&r.bond&&n&&(n.role==='rival'||n.role==='guest')&&n.cityId===G.cityId&&alive(cid)&&!n.hired&&!jailed(n)&&!isEnemy(cid))};
/** 人物卡上的幫忙列。 */
function helpRow(cid){
  helpCheck();
  if(G.helpOff||!helpOK(cid))return '';
  const used=G.helpT===G.turn;
  return '<div style="margin-top:5px"><button class="pixel-btn btn-sm" data-act="help" data-cid="'+cid+'" '+(used?'disabled':'')+'>'+UT(used?'btn.helpUsed':'btn.help')+'</button> <span class="tiny muted">'+UT('help.note')+'</span></div>';
}
{const _pb=personBlock;personBlock=function(cid,ctx){
  const h=_pb.apply(this,arguments);
  if(ctx!=='res'||h.indexOf('class="card locked"')>=0)return h;   // 知名度不夠見不到的人不能去幫忙
  const row=helpRow(cid);if(!row)return h;
  return h.slice(0,h.lastIndexOf('</div>'))+row+'</div>';
}}
/** 這位在本城同業與旅商裡的身代排位（0～1，越大生意越大）。 */
function helpRankOf(cid){
  const L=Object.values(G.world.npcs).filter(n=>n.cityId===G.cityId&&(n.role==='rival'||n.role==='guest')&&alive(n.cid)).map(n=>({cid:n.cid,w:bzInit(n).bzw||0})).sort((a,b)=>a.w-b.w);
  const i=L.findIndex(x=>x.cid===cid);return L.length>1&&i>=0?i/(L.length-1):0.5;
}
ACT.help=el=>{
  const cid=el.dataset.cid;helpCheck();
  if(G.helpOff){toast(UT('help.offNote'));UI.render();refreshSheet();return}
  if(!helpOK(cid))return;
  if(G.helpT===G.turn){toast(UT('help.used'));return}
  if(!spendAP())return;
  const P=HP(),n=npc(cid),r=R(cid),rival=n.role==='rival';
  G.helpT=G.turn;
  const pay=Math.round(P.pay[0]+(P.pay[1]-P.pay[0])*helpRankOf(cid)*(0.8+0.2*rnd()));
  G.gold=(G.gold||0)+pay;
  const g=rival?P.affRival:P.affGuest,gain=rint(g[0],g[1]),a0=r.aff;setAff(r,r.aff+gain);
  let tip='';if(!r.topKnown&&chance(P.scout)){r.topKnown=true;tip=UT('help.scout',{t:top3Txt(cid)})}
  logRel(cid,UT('help.log',{a:pay}));
  const line=TX(rival?'help.rival':'help.guest');
  UI.showInfo(UT('help.t',{n:nameOf(cid)}),portraitHtml(cid,56)+'<div class="small" style="margin:5px 0">「'+esc(line)+'」</div>'
    +'<div class="notice tiny">'+UT('help.eff',{a:pay,g:Math.round(r.aff-a0)})+tip+'</div>');
  sfx.coin();UI.render();refreshSheet();
};
/** 每旬：檢查名望（advanceTurn 結尾前）。 */
{const _a=advanceTurn;advanceTurn=function(){const log=_a.apply(this,arguments);try{helpCheck(log)}catch(e){}return log}}
