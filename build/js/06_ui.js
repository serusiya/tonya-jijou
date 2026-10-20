'use strict';
/* ★檔案總覽：主介面（首頁、大盤、商路）
 * - UI.s：介面暫存狀態（分頁、選取物品、面板…，不存檔）。ACT[name]：data-act 按鈕處理；CHG：data-chg 變更處理。
 * - renderHome/renderMarket/renderRoutes：三個主畫面；說明視窗 UI.showInfo。
 * - planOf/autoShip：出貨預設＝公會配額，未按「出貨」則推進一旬時自動出貨。 */
/* ======================= 06 介面核心：頂欄、分頁、跑馬燈、大盤、商路 ======================= */
/** 介面暫存狀態（不存檔）：分頁、選取物品、面板、筆記篩選、商路設定… */
const UI={s:{tab:'home',focus:null,ship:0,buy:10,sheet:null,sheetLock:false,notesQ:'',notesF:'all',route:{item:null,qty:20,mode:'sea',dest:null},intro:null,openNote:null}};
/** ACT：data-act 點擊處理表；CHG：data-chg 變更處理表。新增按鈕＝在 HTML 加 data-act 並在此註冊。 */
const ACT={},CHG={};
/** 四個主分頁。 */
const TAB_IDS=['market','routes','notes','estate'];
/** 好感數值→文字（冷淡…親密）。 */
const affWord=a=>a<15?'冷淡':a<35?'普通':a<55?'友善':a<75?'親近':'莫逆';
/** 好感數值→標籤色。 */
const affCls=a=>a<15?'red':a<35?'gray':a<55?'green':'gold';
/** 繪製進度條。 */
const bar=(v,max,cls)=>'<div class="bar '+(cls||'')+'"><i style="width:'+clamp(v/max*100,0,100)+'%"></i></div>';
/** 帶正負號的數字。 */
const sgn=n=>(n>=0?'+':'')+fmt(n);

/* ---------- 切換分頁 ---------- */
/** 切換主分頁並重繪。 */
UI.go=function(tab){
  UI.s.tab=tab;
  ['home',...TAB_IDS].forEach(t=>$('#view-'+t).classList.toggle('hidden',t!==tab));
  $$('#bottom button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  $('#b-home').classList.toggle('hidden',tab==='home');
  UI.render();
  $('#main').scrollTop=0;sfx.step();
};
/** 重繪目前分頁與頂部資訊。 */
UI.render=function(){
  if(!G)return;
  syncPeaks();
  updateTop();
  const t=UI.s.tab;
  if(t==='home')renderHome();
  else if(t==='market')renderMarket();
  else if(t==='routes')renderRoutes();
  else if(t==='notes')renderNotes();
  else if(t==='estate')renderEstate();
  const dot=G.family&&G.recruit?0:0;void dot;
  const od=Object.values(G.rel).some(r=>r.promises.some(p=>!p.done&&G.turn>p.due-1));
  $$('#bottom button').forEach(b=>{const old=b.querySelector('.nav-dot');if(old)old.remove();if(b.dataset.tab==='notes'&&od){const d=document.createElement('i');d.className='nav-dot';b.appendChild(d)}});
};
/** 更新頂部資訊（日期、白銀、黃金、聲譽、知名度、行動點數）。 */
function updateTop(){
  $('#d-date').textContent=yearStr(G.year)+' '+G.month+'月'+CYCLE_NAMES[G.cycle-1];
  $('#k-date').textContent='曆法·'+season()+'季';
  $('#d-age').textContent=G.me.given+' '+myAge()+' 歲';
  $('#d-silver').textContent=fmt(G.silver)+' 兩';
  $('#d-silver').style.color=G.silver<0?'#ff7a7a':'#fff';
  $('#d-gold').textContent=Math.round(G.gold)+' 兩';
  $('#d-rep').textContent=Math.round(G.rep)+' / 100';
  $('#d-firm').textContent=G.firm;
  updateAP();updateFame();
  { const a=$('#d-ap'); if(a&&(G.exile||0)>0) a.textContent='⛓️ 遠島 '+G.exile+' 旬'; else if(a&&(G.injured||0)>0) a.textContent='🤕 養傷 '+G.injured+' 旬'; }
  $('#d-city').textContent='【'+homeCity().name+'】';
  $('#h-gen').textContent='第'+G.me.gen+'代';
  setTicker();
}
let _tk='';
/** 更新新聞跑馬燈。 */
function setTicker(){
  const t=G.ticker.slice(0,6).join('　｜　')||'……';
  if(t===_tk)return;_tk=t;
  const old=$('#ticker-txt'),n=old.cloneNode();n.textContent=t;n.style.animationDuration=Math.max(26,t.length*0.42)+'s';old.parentNode.replaceChild(n,old);
}

/* ---------- 宅邸（首頁） ---------- */
/** 首頁：各處所卡片數字、倉庫狀態、新手提示（無介紹人/無員工），並同步場景。 */
function renderHome(){
  const city=homeCity();
  $('#badge-season').textContent=({春:'🌸',夏:'☀️',秋:'🍁',冬:'❄️'})[season()]+' '+season()+'季·'+CYCLE_NAMES[G.cycle-1];
  const al=$('#badge-alert');
  let a='';if(G.festival)a='🏮 '+G.festival;else if(G.cartel.sanction>0)a='⚠️ 遭公會斷貨 '+G.cartel.sanction+' 旬';else if((G.staple.idx||1)>2.2)a='⚠️ 主食高漲·打毀風險';else if(Object.values(G.mk).some(m=>m.ev>1.5))a='📈 行情異動';
  al.textContent=a;al.classList.toggle('hidden',!a);
  $('#loc-city').textContent='所在：'+city.name;
  $('#n-off').textContent='官吏 '+officialsOf(G.cityId).length+' 名';
  $('#n-flower').textContent='名伶 今旬 '+oiranOnStage().length+'／'+oiranAll().length+' 位在席';
  {const w=GUILD_GAP-(G.turn-(G.guildAt===undefined?-99:G.guildAt));$('#n-guild').textContent='配額遵守率 '+Math.round(G.cartel.comp)+'%·'+(w>0?'下次例會 '+w+' 旬後':'可入會')}
  $('#n-res').textContent='可造訪 '+resident().length+' 家';
  const fl=Object.keys(G.inv).reduce((a,k)=>a+(COMM_MAP[k].flam?G.inv[k]:0),0);
  $('#wh-line').textContent='倉庫 '+G.wh.n+' 棟，庫存 '+invUsed()+' / '+invCap()+' 單位。易燃品 '+fl+' 單位；保鏢 '+guardCount()+' 名巡守。';
  const st=fl>invUsed()*0.5&&fl>20?['警戒','red']:fl>0?['留意','gold']:['安全','green'];
  const w=$('#wh-state');w.textContent=st[0];w.className='tag '+st[1];
  $('#wh-guard').textContent=G.lastSpoil||'';
  const tip=$('#home-tip');
  if(!G.intros.length){tip.innerHTML='📌 <b>你還沒有介紹人。</b>先到「名門商邸」登門投帖，與人往來、好感達 40 後，請對方當你的介紹人；有了介紹人，才能僱用夥計、拜謁官員。';tip.classList.remove('hidden')}
  else if(!G.emps.length){tip.innerHTML='📌 有了介紹人。下一步到「私宅」，請介紹人物色人才，<b>一個一個</b>聘用夥計。';tip.classList.remove('hidden')}
  else tip.classList.add('hidden');
  sceneSync();
}
/** 商邸可拜訪的人（同行、座客、掮客…，不含已聘者）。 */
const resident=()=>cityNpcs(G.cityId).filter(n=>['rival','guest','broker','smuggler','manager'].includes(n.role)&&!n.hired&&!G.emps.some(e=>e.cid===n.cid));

/* ---------- 大盤 ---------- */
/** 迷你折線圖（行情走勢）。 */
function spark(h,up){
  if(!h||h.length<2)return '';
  const mn=Math.min(...h),mx=Math.max(...h),rg=Math.max(0.0001,mx-mn);
  const pts=h.map((v,i)=>(i*(66/(h.length-1)))+','+(18-((v-mn)/rg)*16)).join(' ');
  return '<svg class="sparkline" viewBox="0 0 66 20"><polyline fill="none" stroke="'+(up?'#b3261e':'#1e7e34')+'" stroke-width="2" points="'+pts+'"/></svg>';
}
/** 物品相對上旬漲跌 %。 */
function chg(name){const h=G.mk[name].hist;if(h.length<2)return 0;return (h[h.length-1]-h[h.length-2])/Math.max(0.01,h[h.length-2])*100}
/** 大盤畫面：行情、進貨區（含每旬上限）、進貨列表、出貨區（預設＝公會配額）、市佔率、行情表。 */
function renderMarket(){
  const own=ownComms();
  if(!UI.s.focus||!G.mk[UI.s.focus]||!own.some(c=>c.name===UI.s.focus))UI.s.focus=own[0].name;
  const name=UI.s.focus,c=COMM_MAP[name],m=G.mk[name],have=G.inv[name]||0;
  UI.s.ship=planOf(name);
  const buy=unitBuyCost(name),mkt=m.price,q=quoteSale(name,UI.s.ship),quota=quotaOf(name);
  const idx=G.staple.idx||1;
  const bmax=maxBuy(name),bq=buyPlanOf(name);
  const ex=(G.cartel.state==='pledged'?'已表態守配額':G.cartel.state==='secret'?'已簽暗約偷跑':'未表態');
  let h='<div class="pixel-box" style="padding:8px">';
  h+='<div class="row" style="border-bottom:1px solid #b5a98f;padding-bottom:5px"><div><b>📊 本旬大盤（以量控價）</b><div class="tiny muted">價格不能自訂，只能決定出貨量；總出貨越多，市價越低。價 = 基準 × 季節 × (近三旬需求/近三旬總出貨)^α × 事件；同業也會出貨，偶爾超賣</div></div><span class="tag gold">'+season()+'季</span></div>';
  h+='<div style="margin-top:6px">'+own.map(x=>'<span class="pill '+(x.name===name?'on':'')+'" data-act="focus" data-n="'+esc(x.name)+'">'+esc(x.short.slice(0,7))+'</span>').join('')+'</div>';
  h+='<div class="card" style="background:#fff8eb;margin-top:4px"><div class="row"><div><b style="font-size:14px;color:#9b2c3a">'+esc(c.short)+'</b>'+infoBtn(name)+' <span class="tag">'+c.kind+'</span><span class="tag gray">α '+c.alpha+'</span>'+(c.flam?'<span class="tag red">易燃</span>':'')+'</div><div style="text-align:right" class="small">基準價 '+fmt1(c.base)+' 兩／'+esc(c.unit.split(' ')[0])+'</div></div>';
  h+='<div class="grid3 small" style="margin-top:5px;text-align:center"><div class="card" style="margin:0">市價<br><b class="'+(chg(name)>=0?'up':'down')+'" id="m-price">'+fmt1(mkt)+'</b></div><div class="card" style="margin:0">進貨價<br><b>'+fmt1(buy)+'</b>'+(G.flags.direct?'<div class="tiny" style="color:#1e7e34">直採</div>':'<div class="tiny muted">大盤商</div>')+'</div><div class="card" style="margin:0">庫存<br><b>'+have+'</b><div class="tiny muted">容量 '+invUsed()+'/'+invCap()+'</div></div></div>';
  h+='<div class="tiny muted" style="margin-top:4px">本城需求 '+m.D+'／旬·同業本旬出貨 '+m.so+'（近三旬合計 '+Math.round(m.so+pastOf(m).reduce((a,x)=>a+x.so,0))+'）　'+(m.ev>1.15?'<span class="up">行情看漲 ×'+fmt1(m.ev)+'</span>':m.ev<0.9?'<span class="down">行情走軟 ×'+fmt1(m.ev)+'</span>':'行情持平')+(festActive()&&FEST_KW.some(k=>c.name.includes(k))?' <span class="up">節慶需求×4</span>':'')+(c.luxury&&m.lux&&m.lux.ph==='dry'?' <span class="down">買家久無音訊，行情冷清</span>':c.luxury&&m.lux&&m.lux.ph==='burst'?' <span class="up">大單湧入！</span>':'')+'</div></div>';
  // 進貨
  h+='<div class="card"><div class="row"><b class="small">📥 向'+(G.flags.direct?'產地直採':'大盤商')+'進貨</b><span class="tiny muted">單價 '+fmt1(buy)+' 兩</span></div><div class="tiny" style="color:#9b2c3a">本旬向大盤還能進 <b>'+buyLeft(name)+'</b> 單位'+(nEmp('番頭')?'　<span style="color:#1e7e34">番頭折扣 −'+Math.round((1-buyDiscount())*100)+'%</span>':'')+'</div><div class="tiny muted">庫存 '+have+'＋在途 '+itemOnOrder(name)+' ／ 上限 '+itemCap(name)+'</div><div class="row" style="margin-top:4px"><b id="b-q" style="color:#9b2c3a">'+bq+' 單位</b><span id="b-cost" class="tiny muted">約 '+fmt(Math.round(buy*bq))+' 兩</span></div><input id="slider-buy" type="range" min="0" max="'+Math.max(1,bmax)+'" value="'+bq+'" step="1" '+(bmax<1?'disabled':'')+'><div class="row tiny muted"><span>0 不進貨</span><span>推進一旬時自動下單，次旬到貨</span><span>'+bmax+' 上限</span></div></div>';
  h+=orderCard();
  // 出貨
  h+='<div class="card"><div class="row"><b class="small">📤 本旬出貨量</b><b id="q-q" style="color:#9b2c3a">'+UI.s.ship+' 單位</b></div><div class="tiny muted">預設為公會配額（'+quota+'）。推進一旬時自動出貨。出貨量達 <b>'+supplyLine(name)+'</b> 單位（穩定供貨線）知名度才會上升，達不到則下降。</div>';
  h+='<input id="slider-ship" type="range" min="0" max="'+Math.max(1,have)+'" value="'+UI.s.ship+'" step="1" '+(have<1?'disabled':'')+'>';
  h+='<div class="row tiny muted"><span>0 惜售壓倉</span><span>公會配額 '+quota+'（'+ex+'）</span><span>'+have+' 全拋</span></div>';
  h+='<div class="grid2 small" style="margin-top:4px"><div class="card" style="margin:0"><div class="tiny muted">出貨後市價</div><b id="q-price">'+fmt1(q.price)+' 兩</b></div><div class="card" style="margin:0"><div class="tiny muted">預估入帳 ／ 毛利</div><b id="q-rev" style="color:#1e7e34">'+fmt(q.revenue)+' 兩</b> <span id="q-gain" class="tiny"></span></div></div>';
  h+='<div class="row" style="margin-top:6px"><div class="small"><b>⚠️ 打毀警戒</b> <div style="width:130px;margin-top:2px">'+bar((idx-1),2.2,idx>2.3?'red':'gold')+'</div></div></div></div>';
  h+=shareCard();
  // 行情表
  h+='<div class="small bold" style="margin:6px 0 3px">🏛️ 本業物資行情（近 12 旬）</div>';
  h+=own.map(x=>{const mm=G.mk[x.name],ch=chg(x.name);return '<div class="mkt-row '+(x.name===name?'on':'')+'" data-act="focus" data-n="'+esc(x.name)+'"><div><b class="small">'+esc(x.short)+'</b>'+infoBtn(x.name)+'<div class="tiny muted">庫存 '+(G.inv[x.name]||0)+'·損耗 '+(x.decay*100).toFixed(1)+'%/旬</div></div><div class="row" style="gap:8px">'+spark(mm.hist,ch>=0)+'<div style="text-align:right;width:62px"><b>'+fmt1(mm.price)+'</b><div class="'+(ch>=0?'up':'down')+' tiny">'+(ch>=0?'+':'')+ch.toFixed(1)+'%</div></div></div></div>'}).join('');
  h+='<div class="small bold" style="margin:6px 0 3px">🍚 民生必需品（打毀指標）</div>';
  h+=STAPLE_KEYS.filter(k=>G.mk[k]).map(k=>{const si=stapleIndex(k);return '<div class="mkt-row lock"><div><b class="small">'+esc(COMM_MAP[k].short)+'</b>'+infoBtn(k)+'<div class="tiny muted">基準 '+fmt1(COMM_MAP[k].base)+'</div></div><div class="row" style="gap:8px">'+spark(G.mk[k].hist,chg(k)>=0)+'<div style="text-align:right;width:70px"><b class="'+(si>2?'up':'')+'">'+Math.round(si*100)+'%</b><div class="tiny muted">對基準</div></div></div></div>'}).join('');
  h+=G.lastSpoil?'<div class="notice" style="margin-top:6px">🧺 上旬'+esc(G.lastSpoil)+'</div>':'';
  h+='</div>';
  $('#view-market').innerHTML=h;updateQuote();
}
/** 市佔率卡片：我與本城同行的佔比與趨勢。 */
function shareCard(){
  shareFactor();const sh=G.share;if(!sh)return '';
  const rows=sh.rows.map(r=>({n:r.name,v:r.share,pv:r.prev,tag:r.raided?'（遭查抄）':r.ev>1.1?'（走俏）':r.ev<0.9?'（受挫）':''})).concat([{n:'🏮 你的商號',v:sh.me,pv:null,me:true,tag:''}]).sort((a,b)=>b.v-a.v);
  const line=r=>{const pct=(r.v*100).toFixed(1);const tr=r.pv!==null&&r.pv!==undefined?(r.v>r.pv+0.002?'<span class="up">▲</span>':r.v<r.pv-0.002?'<span class="down">▼</span>':''):'';return '<div style="margin-top:3px"><div class="row tiny"><span'+(r.me?' style="font-weight:bold;color:#9b2c3a"':'')+'>'+esc(r.n)+r.tag+' '+tr+'</span><b>'+pct+'%</b></div>'+bar(r.v,0.5,r.me?'gold':'gray')+'</div>'};
  const m=sh.mine;
  return '<div class="card"><div class="row"><b class="small">🏪 本城同業市佔率（本業）</b><span class="tag '+(sh.factor>=1?'green':'red')+'">本業需求 ×'+fmt1(sh.factor)+'</span></div>'+rows.map(line).join('')
   +'<div class="tiny muted" style="margin-top:4px">另有零星散商約 '+(sh.others*100).toFixed(0)+'%。</div>'
   +'</div>';
}
/** 本旬進貨列表（下旬到貨）。 */
function orderCard(){
  const od=G.orders||[],ar=G.arrived||[];
  const plan=ownComms().map(c=>({n:c.name,q:buyPlanOf(c.name)})).filter(x=>x.q>0);
  let h='<div class="card" id="order-card" style="background:#fff8eb"><div class="row"><b class="small">📋 本旬進貨列表</b><span class="tiny muted">推進一旬時下單，隨即到貨入倉</span></div><div style="margin:4px 0"><button class="pixel-btn btn-sm" data-act="buyMax">'+UT('btn.buyMax')+'</button> <button class="pixel-btn btn-sm" data-act="buyClear">'+UT('btn.buyClear')+'</button></div>'+restockRow();
  if(plan.length){h+=plan.map(x=>{const u=unitBuyCost(x.n);return '<div class="row small" style="margin-top:3px"><span>📝 '+esc(COMM_MAP[x.n].short)+' × '+x.q+'</span><span class="muted">預計 '+fmt(Math.round(u*x.q))+' 兩·單價 '+fmt1(u)+'</span></div>'}).join('');
    h+='<div class="row tiny muted" style="margin-top:3px;border-top:1px dashed #b5a98f;padding-top:3px"><span>預定合計 '+plan.reduce((a,x)=>a+x.q,0)+' 單位</span><span>預計支出 '+fmt(plan.reduce((a,x)=>a+Math.round(unitBuyCost(x.n)*x.q),0))+' 兩</span></div>'}
  else h+='<div class="tiny muted" style="margin-top:3px">本旬尚未安排進貨。</div>';
  if(od.length)h+=od.map(o=>'<div class="row tiny muted" style="margin-top:3px"><span>⏳ 在途 '+esc(COMM_MAP[o.name].short)+' × '+o.qty+'</span><span>'+fmt(o.cost)+' 兩</span></div>').join('');
  if(ar.length)h+='<div class="tiny" style="margin-top:4px;color:#1e7e34">✅ 本旬已到貨：'+ar.map(a=>esc(COMM_MAP[a.name].short)+' ×'+a.qty).join('、')+'</div>';
  return h+'</div>';
}
/** 滑桿拖動時即時更新出貨試算。 */
function updateQuote(){
  const name=UI.s.focus;if(!name||!$('#q-q'))return;
  const q=quoteSale(name,UI.s.ship),buy=unitBuyCost(name);
  $('#q-q').textContent=UI.s.ship+' 單位';$('#q-price').textContent=fmt1(q.price)+' 兩';$('#q-rev').textContent=fmt(q.revenue)+' 兩';
  const gain=Math.round(q.revenue-buy*UI.s.ship);const g=$('#q-gain');g.textContent='（對進貨價 '+sgn(gain)+'）';g.style.color=gain>=0?'#1e7e34':'#b3261e';
}
/** 選取大盤物品。 */
ACT.focus=el=>{UI.s.focus=el.dataset.n;renderMarket();sfx.tap()};
/** 進貨計畫：滑桿設定的本旬進貨量，推進一旬時自動下單。 */
function maxBuy(name){
  const u=unitBuyCost(name)||1;
  return Math.max(0,Math.min(buyLeft(name),itemRoom(name),invCap()-invUsed()-pendingQty()-transitQty(),Math.floor(G.silver/u)));
}
function buyPlanOf(name){G.buyPlan=G.buyPlan||{};return clamp(G.buyPlan[name]||0,0,maxBuy(name))}
/** 一次把所有本業貨品排到進貨上限（依序分配，受倉容、品項上限、本旬額度與公款限制）。 */
ACT.buyMax=()=>{
  G.buyPlan={};let room=invCap()-invUsed()-pendingQty()-transitQty(),cash=G.silver,tot=0;
  ownComms().forEach(c=>{
    const u=unitBuyCost(c.name)||1;
    const q=Math.max(0,Math.min(buyLeft(c.name),itemRoom(c.name),room,Math.floor(cash/u)));
    if(q>0){G.buyPlan[c.name]=q;room-=q;cash-=Math.round(u*q);tot+=q}
  });
  toast(tot?MSG('buyMax.ok',{tot}):MSG('buyMax.none'));UI.render();
};
ACT.buyClear=()=>{G.buyPlan={};UI.render()};
function autoBuy(log){
  G.buyPlan=G.buyPlan||{};const got=[];
  ownComms().forEach(c=>{const q=Math.min(G.buyPlan[c.name]||0,maxBuy(c.name));if(q>0){const r=buyGoods(c.name,q);if(r.ok)got.push(c.short+'×'+q)}});
  if(got.length)log.push(NEWS('autoBuy.1',{got:got.join('、')}));
  autoRestock(log);
  G.buyPlan={};
}
ACT.buy=el=>{
  const name=UI.s.focus;let q=el.dataset.q;
  q=+q;
  const r=buyGoods(name,q);toast(r.msg);if(r.ok)coinFx(el.getBoundingClientRect());UI.render();
};
/** 按下『出貨』：以目前預設/滑桿量出貨並標記本旬已出貨。 */
ACT.ship=el=>{
  const name=UI.s.focus,qty=UI.s.ship;
  if(qty<=0){G.sold=G.sold||{};G.sold[name]=true;toast(MSG('ship.1'));renderMarket();return}
  playFx('cart',MSG('sell.shipping'),COMM_MAP[name].short+' × '+qty,()=>{
    const r=sellGoods(name,qty);toast(r.msg);if(r.ok){coinFx();G.sold=G.sold||{};G.sold[name]=true;G.plan[name]=0}UI.render();say(thought());
  },950);
};
document.addEventListener('input',e=>{if(e.target.id==='slider-buy'){const n=UI.s.focus,v=+e.target.value;G.buyPlan=G.buyPlan||{};G.buyPlan[n]=v;$('#b-q').textContent=v+' 單位';$('#b-cost').textContent='約 '+fmt(Math.round(unitBuyCost(n)*v))+' 兩';const oc=$('#order-card');if(oc)oc.outerHTML=orderCard();return}if(e.target.id==='slider-ship'){UI.s.ship=+e.target.value;G.plan=G.plan||{};G.plan[UI.s.focus]=UI.s.ship;if(G.sold)delete G.sold[UI.s.focus];updateQuote()}});

/* ---------- 商路 ---------- */
/** 商路畫面：許可與船長/飛腳狀態、在途貨運、產地候選與預估毛利。 */
function renderRoutes(){
  const R_=UI.s.route,items=ownComms().map(c=>c.name).filter(n=>originsOf(n).length);
  if(!R_.item||!items.includes(R_.item))R_.item=items[0]||null;
  const crew=m=>crewCount(m)+'（空閒 '+Math.max(0,crewCount(m)-crewBusy(m))+'）';
  let h='<div class="pixel-box" style="padding:8px"><div class="row" style="border-bottom:1px solid #b5a98f;padding-bottom:5px"><div><b>🗺️ 產地運入·船隊與馬幫</b></div><span class="tag navy">船隊 '+G.ships.length+' / '+G.fleet+'</span></div>';
  h+='<div class="grid3 small" style="margin:6px 0;text-align:center"><div class="card" style="margin:0">海運許可<br><b>'+(permitsOf().sea.all?'全地區':Object.keys(permitsOf().sea).length+' 地區')+'</b><div class="tiny muted">船長 '+crew('sea')+'</div></div><div class="card" style="margin:0">陸運許可<br><b>'+(landPermit()?'已取得':'未取得')+'</b><div class="tiny muted">飛腳 '+crew('land')+'</div></div><div class="card" style="margin:0">免檢旗<br><b>'+(G.flags.exempt>0?G.flags.exempt+' 旬':'無')+'</b></div></div>';
  if(!anySea()&&!landPermit())h+='<div class="notice tiny">📌 運入許可由地區官員核發：請到「遠國奉行所」請託。</div>';
  if(G.ships.length){h+='<div class="small bold">⛵ 在途貨運</div>'+G.ships.map(s=>{if(s.entrust)return '<div class="card"><div class="row"><b class="small">'+(s.mode==='land'?'🐎 陸運·飛腳':'⛵ 海運·船長')+'「'+esc(s.captName)+'」</b><span class="tag '+(s.eta<=1?'green':'gray')+'">剩 '+s.eta+' 旬</span></div><div class="tiny muted">前往【'+esc(CITY(s.origId).name)+'】·委託金 '+fmt(s.budget)+' 兩·買什麼由'+(s.mode==='land'?'飛腳':'船長')+'決定，歸來才知道</div></div>';const b=s.origId?CITY(s.origId):null;return '<div class="card"><div class="row"><b class="small">'+(s.mode==='sea'?'⛵':'🐎')+' '+esc(COMM_MAP[s.name].short)+' × '+s.qty+'</b><span class="tag '+(s.eta<=1?'green':'gray')+'">剩 '+s.eta+' 旬</span></div><div class="tiny muted">'+(b?'自 '+esc(b.name)+'·'+esc(b.region_name)+' 運入本城':'返航中')+'·'+(s.captName?(s.mode==='sea'?'船長 ':'飛腳 ')+esc(s.captName)+'·':'')+'遇險率 '+Math.round(s.risk*100)+'%</div></div>'}).join('')}
  else h+='<div class="notice">目前沒有在途的貨運。</div>';
  h+='<hr class="sep"><div class="small bold">📦 運入貨物</div><div style="margin:4px 0">'+['sea','land'].map(m=>'<span class="pill '+(R_.mode===m?'on':'')+'" data-act="rMode" data-m="'+m+'">'+UT(m==='sea'?'opt.modeSea':'opt.modeLand')+'</span>').join('')+'</div>';
  h+=voyagePanel();
  h+=voyLogCard();
  h+='<hr class="sep"><div class="row"><span class="small">🚢 擴編船隊（'+G.fleet+' → '+(G.fleet+1)+' 支）</span><button class="pixel-btn btn-sm" data-act="fleetUp">'+UT('btn.fleetUp',{c:fmt(costOf('fleetUp',G.fleet))})+'</button></div></div>';
  $('#view-routes').innerHTML=h;
}
/** 商路：選貨物。 */
ACT.rItem=el=>{UI.s.route.item=el.dataset.n;UI.s.route.dest=null;renderRoutes()};
/** 商路：選海運/陸路。 */
ACT.rMode=el=>{UI.s.route.mode=el.dataset.m;UI.s.route.dest=null;renderRoutes()};
/** 商路：選產地。 */
ACT.rDest=el=>{UI.s.route.dest=el.dataset.id;renderRoutes()};
/** 商路：下單運入。 */
ACT.rGo=()=>{
  const R_=UI.s.route;const r0=dispatchShip(R_.item,R_.qty,R_.dest,R_.mode);
  if(!r0.ok){toast(r0.msg,4200);return}
  playFx(R_.mode==='sea'?'boat':'cart',MSG('route.depart'),CITY(R_.dest).name,()=>{toast(r0.msg,5000);UI.render()},1000);
};
/** 擴編船隊。 */
ACT.fleetUp=()=>{
  if(G.fleet>=8){toast(MSG('fleetUp.1'));return}
  if(!afford('fleetUp',G.fleet)){toast(shortMsg('fleetUp',G.fleet));return}
  spend('fleetUp',G.fleet);G.fleet++;sfx.coin();toast(MSG('fleetUp.2',{fleet:G.fleet}));UI.render();
};
document.addEventListener('change',e=>{if(e.target.id==='r-qty'){UI.s.route.qty=Math.max(1,Math.floor(+e.target.value||1));renderRoutes()}});

/* ---------- 說明視窗：官吏職位、貿易物品 ---------- */
/** 顯示置中的說明視窗（官吏職位、貿易物品）。 */
UI.showInfo=(title,html)=>{$('#info-title').textContent=title;$('#info-body').innerHTML=html;$('#info-bd').classList.remove('hidden');$('#info-body').scrollTop=0};
/** 關閉說明視窗。 */
UI.hideInfo=()=>$('#info-bd').classList.add('hidden');
/** 說明視窗的欄位格式。 */
const ik=(k,v)=>v?'<div class="ik">'+k+'</div><div class="iv">'+esc(v)+'</div>':'';
/** 官吏職位說明內容（職掌、貪腐破口、升遷等，資料來自 OFFICIALS）。 */
function posInfoHtml(id){
  const p=OFF_POS[id];if(!p)return '<div class="notice">查無此職位。</div>';
  const sys=OFFICIALS.systems[p.court],rk=RANK_INFO[p.rank];
  const nm=x=>OFF_POS[x]?OFF_POS[x].title+'（'+RANK_INFO[OFF_POS[x].rank].title.split(/[\u30FB\u00B7]/)[0]+'）':x;
  return '<div class="small"><span class="tag '+COURTS[p.court].cls+'">'+COURTS[p.court].name+'</span> <span class="tag gold">'+esc(rk.title)+'</span></div>'
   +ik('所屬',sys.name+'·'+sys.department)+ik('職掌',p.duties)+ik('官階權力',rk.influence)+ik('與商人的關係',sys.merchant_interaction)
   +ik('貪腐破口',p.corruption_hooks)+ik('可升遷至',(p.promotes_to||[]).map(nm).join('、')||'（已達頂點）')+ik('升遷條件',p.promotion_conditions)
   +'<div class="ik">官階待遇</div><div class="iv">年俸 '+rk.salary_koku+' 石·黃金點心基準 '+rk.bribe_base_gold+' 兩金</div>';
}
/** 顯示單一官吏職位說明。 */
ACT.posInfo=el=>{const p=OFF_POS[el.dataset.id];UI.showInfo('官吏職位：'+(p?p.title:''),posInfoHtml(el.dataset.id))};
/** 顯示 30 個職位一覽。 */
ACT.posList=()=>{
  let h='<div class="tiny muted">三院共 30 個職位，點選查看說明。</div>';
  Object.keys(COURTS).forEach(ct=>{const sys=OFFICIALS.systems[ct];h+='<div class="ik" style="font-size:13px">'+COURTS[ct].name+'系統·'+esc(sys.department)+'</div><div class="tiny muted">'+esc(sys.core_function)+'</div>'+sys.positions.map(p=>'<div class="irow" data-act="posInfo" data-id="'+p.id+'"><b>'+esc(p.title)+'</b> <span class="tag gold">'+RANK_INFO[p.rank].title.split(/[\u30FB\u00B7]/)[0]+'</span></div>').join('')});
  UI.showInfo('官吏職位一覽',h);
};
/** 顯示貿易物品說明（資料來自 COMM_INFO）。 */
ACT.commInfo=el=>{
  const n=el.dataset.n,c=COMM_MAP[n],i=COMM_INFO[n];if(!c||!i)return;
  UI.showInfo('貿易物品：'+c.short,'<div class="small"><span class="tag">'+c.kind+'</span> <span class="tag gray">'+esc(i.origin_type)+'</span>'+(c.flam?' <span class="tag red">易燃</span>':'')+'</div>'
   +ik('所屬系統',i.system_name)+ik('系統簡介',i.system_desc)+ik('全名',i.name)+ik('單位',i.unit)+'<div class="ik">遊戲基準價</div><div class="iv">'+fmt1(c.base)+' 兩／單位（需求彈性 α '+c.alpha+'·每旬損耗約 '+(c.decay*100).toFixed(1)+'%）</div>'
   +ik('主要產區',(i.primary_regions||[]).join('、'))+ik('季節特性',i.seasonal_traits)+ik('價格波動',i.price_volatility)+ik('需求階層',i.demand_strata)+ik('保存與損耗',i.decay_rate)+ik('管制狀態',i.contraband_status)+ik('卡特爾潛力',i.cartel_potential));
};
/** 物品旁的『ⓘ說明』按鈕。 */
const infoBtn=n=>'<span class="ibtn" data-act="commInfo" data-n="'+esc(n)+'">ⓘ說明</span>';

/* ---------- 出貨預設＝公會配額；未按「出貨」，推進一旬時自動出貨 ---------- */
/** 某物品本旬的預定出貨量：預設＝公會配額（不超過庫存），可被滑桿覆蓋（存在 G.plan）。 */
function planOf(name){
  const have=G.inv[name]||0;G.plan=G.plan||{};
  if(G.plan[name]===undefined)G.plan[name]=Math.min(quotaOf(name),have);
  return clamp(G.plan[name],0,have);
}
/** 【穩定供貨線】本城該物品需求 × 你的市佔率（至少 1）。出貨量達此線才算穩定供貨。 */
function supplyLine(name){const sh=(G.share&&G.share.me)||0.05;return Math.max(1,Math.round((G.mk[name].D||0)*sh*supplyCut()))}
/** 推進一旬前，對本旬沒按『出貨』的物品自動按預定量出貨，並清空本旬計畫。 */
function autoShip(log){
  G.sold=G.sold||{};G.plan=G.plan||{};
  const rep={rev:0,ship:[],fame:0};
  const own=ownComms();let short=[],allMet=own.length>0;
  own.forEach(c=>{
    const quota=quotaOf(c.name),have=G.inv[c.name]||0;
    const q=planOf(c.name);let shipped=0;
    if(q>0){const r=sellGoods(c.name,q);if(r.ok){shipped=q;rep.rev+=r.revenue;rep.ship.push({n:c.short,q,rev:r.revenue})}}
    /* 穩定供貨線＝本城需求 × 你的市佔率；出貨量沒達到就算未能穩定供貨 */
    if(shipped<supplyLine(c.name)){short.push(c.short);allMet=false}
  });
  /* 穩定供貨：全部商品出貨量達穩定供貨線 → 知名度 +1～3；有商品未達 → -1～3 */
  if(short.length){rep.fame=-(1+Math.floor(rnd()*3));rep.short=short}
  else if(allMet)rep.fame=1+Math.floor(rnd()*3);
  if(rep.fame)G.fame=clamp((G.fame||0)+rep.fame,0,100);
  if(rep.fame>0){G.mybias=Math.min(4,(G.mybias||1)*(1+0.01*rep.fame));rep.shareUp=true}   // 穩定供貨：市佔率微幅增加
  if(rep.ship.length){const t=NEWS('autoShip.1',{rev:rep.ship.map(x=>x.n+'×'+x.q+'（'+fmt(x.rev)+'）').join('、')});log.push(t);pushNews(t)}
  TURNRP=rep;
  G.plan={};G.sold={};
}
