'use strict';
/* ★檔案總覽：主介面（首頁、大盤、商路）
 * - UI.s：介面暫存狀態（分頁、選取物品、面板…，不存檔）。ACT[name]：data-act 按鈕處理；CHG：data-chg 變更處理。
 * - renderHome/renderMarket/renderRoutes：三個主畫面；說明視窗 UI.showInfo。
 * - planOf/autoShip：出貨預設＝公會配額，未按「出貨」則推進一旬時自動出貨。 */
/* ======================= 06 介面核心：頂欄、分頁、跑馬燈、大盤、商路 ======================= */
/** 介面暫存狀態（不存檔）：分頁、選取物品、面板、筆記篩選、商路設定… */
const UI={s:{tab:'home',focus:null,ship:0,buy:10,sheet:null,sheetLock:false,notesQ:'',notesF:'all',route:{mode:'sea',dest:null},intro:null,openNote:null}};
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
/** 更新頂部資訊（日期、現款、私房錢、知名度、行動點數）。 */
function updateTop(){
  $('#d-date').textContent=yearStr(G.year)+' '+G.month+'月'+CYCLE_NAMES[G.cycle-1];
  $('#k-date').textContent='曆法·'+season()+'季';
  $('#d-age').textContent=G.me.given+' '+myAge()+' 歲';
  $('#d-silver').textContent=fmt(G.silver)+' 兩';
  $('#d-silver').style.color=G.silver<0?'#ff7a7a':'#fff';
  {const D=(G.debts||[]).filter(d=>!d.paid),e=$('#d-debt');if(e){if(D.length){const tot=D.reduce((a,d)=>a+d.amt,0),near=Math.max(0,Math.min(...D.map(d=>d.due-G.turn)));e.textContent='欠'+fmt(tot)+'·'+(near?near+'旬':'本旬');e.title='欠款 '+fmt(tot)+' 兩，最近一筆'+(near?near+' 旬後':'本旬')+'到期';e.style.color=near<=2?'#ff9a7a':'';e.classList.remove('hidden')}else e.classList.add('hidden')}}
  $('#d-gold').textContent=Math.round(G.gold)+' 兩';
  $('#d-rep').textContent=Math.round(G.fame||0)+' / '+ODDS.fame.cap;
  $('#d-firm').textContent=G.firm;
  updateAP();updateFame();
  { const a=$('#d-ap'); if(a&&(G.exile||0)>0) a.textContent='⛓️ 遠島 '+G.exile+' 旬'; else if(a&&(G.injured||0)>0) a.textContent='🤕 養傷 '+G.injured+' 旬'; }
  $('#d-city').textContent='【'+homeCity().name+'】';
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
const resident=()=>cityNpcs(G.cityId).filter(n=>['rival','guest','broker','smuggler','manager'].includes(n.role)&&!jailed(n)&&!n.hired&&!G.emps.some(e=>e.cid===n.cid));

/* ---------- 大盤 ---------- */
/** 迷你折線圖（行情走勢）。 */
function spark(h,up){
  if(!h||h.length<2)return '';
  const mn=Math.min(...h),mx=Math.max(...h),rg=Math.max(0.0001,mx-mn);
  const pts=h.map((v,i)=>(i*(66/(h.length-1)))+','+(18-((v-mn)/rg)*16)).join(' ');
  return '<svg class="sparkline" viewBox="0 0 66 20"><polyline fill="none" stroke="'+(up?'#b3261e':'#1e7e34')+'" stroke-width="2" points="'+pts+'"/></svg>';
}
/** 物品相對上旬漲跌 %。 */
/** 本旬價格比上旬高或低多少兩（約略整數）。 */
function chgAmt(name,cur){const h=G.mk[name].hist;if(h.length<2)return 0;return Math.round(cur-h[h.length-2])}
/** 價差文字：「約 +3 兩」「約 -2 兩」「持平」。 */
const amtTxt=d=>d===0?'持平':'約 '+(d>0?'+':'-')+Math.abs(d)+' 兩';
function chg(name){const h=G.mk[name].hist;if(h.length<2)return 0;return (h[h.length-1]-h[h.length-2])/Math.max(0.01,h[h.length-2])*100}
/** 大盤畫面：行情、本旬買賣（出貨與進貨合併）、本旬買賣總表、市佔率、行情表。 */
function renderMarket(){
  const own=ownComms();
  if(!UI.s.focus||!G.mk[UI.s.focus]||!own.some(c=>c.name===UI.s.focus))UI.s.focus=(own.find(c=>tradeOK(c.name))||own[0]).name;
  const name=UI.s.focus,c=COMM_MAP[name],m=G.mk[name],have=G.inv[name]||0;
  UI.s.ship=planOf(name);
  const buy=unitBuyCost(name),mkt=m.price,q=quoteSale(name,UI.s.ship),quota=quotaOf(name);
  const idx=G.staple.idx||1;
  const bmax=maxBuy(name),bq=buyPlanOf(name);
  const ex=(G.cartel.state==='pledged'?'已表態守配額':G.cartel.state==='secret'?'已簽暗約偷跑':'未表態');
  let h='<div class="pixel-box" style="padding:8px">';
  h+='<div class="row" style="border-bottom:1px solid #b5a98f;padding-bottom:5px"><div><b>📊 本旬大盤（以量控價）</b><div class="tiny muted">價格不能自訂，只能決定出貨量。近九旬裡，本城買的人多、同業與你賣得少，市價就高；賣得多就低。同業也會出貨，偶爾超賣</div></div><span class="tag gold">'+season()+'季</span></div>';
  h+='<div style="margin-top:6px">'+own.map(x=>'<span class="pill '+(x.name===name?'on':'')+'" data-act="focus" data-n="'+esc(x.name)+'">'+(tradeOK(x.name)?'':'🔒')+esc(x.short.slice(0,7))+'</span>').join('')+'</div>';
  h+='<div class="card" style="background:#fff8eb;margin-top:4px"><div class="row"><div><b style="font-size:14px;color:#9b2c3a">'+esc(c.short)+'</b>'+infoBtn(name)+' <span class="tag">'+c.kind+'</span>'+(c.flam?'<span class="tag red">易燃</span>':'')+'</div><div style="text-align:right" class="small">基準價 '+fmt1(c.base)+' 兩／'+esc(c.unit.split(' ')[0])+'</div></div>';
  h+='<div class="grid3 small" style="margin-top:5px;text-align:center"><div class="card" style="margin:0">市價<br><b class="'+(chg(name)>=0?'up':'down')+'" id="m-price">'+fmt1(mkt)+'</b><div class="tiny '+(chgAmt(name,mkt)>=0?'up':'down')+'">較上旬 '+amtTxt(chgAmt(name,mkt))+'</div></div><div class="card" style="margin:0">進貨價<br><b>'+fmt1(buy)+'</b>'+'<div class="tiny muted">'+(guildMember()?'公會價':'未入會·市價')+'</div>'+'</div><div class="card" style="margin:0">庫存<br><b>'+have+'</b>'+(have>0?'<div class="tiny muted">平均入庫價 '+fmt1(avgCostOf(name))+'</div>':'')+'<div class="tiny muted">容量 '+invUsed()+'/'+invCap()+'</div></div></div>';
  h+='<div class="tiny muted" style="margin-top:4px">本城需求 '+m.D+'／旬·同業本旬出貨 '+m.so+'（近九旬合計 '+Math.round(m.so+pastOf(m).reduce((a,x)=>a+x.so,0))+'）　'+(m.ev>1.15?'<span class="up">行情看漲</span>':m.ev<0.9?'<span class="down">行情走軟</span>':'行情持平')+(festActive()?' <span class="up">'+(FEST_KW.some(k=>c.name.includes(k))?'節慶搶手':'節慶需求大增')+'</span>':'')+(c.luxury&&m.lux&&m.lux.ph==='dry'?' <span class="down">買家久無音訊，行情冷清</span>':c.luxury&&m.lux&&m.lux.ph==='burst'?' <span class="up">大單湧入！</span>':'')+'</div></div>';
  // 本旬買賣（未取得交易許可的貨，只顯示行情）
  if(!tradeOK(name))h+='<div class="notice">🔒 '+esc(tradeLockMsg(name))+'</div>';
  else h+=tradeCard(name);
  h+=planCard()+shareCard();
  // 行情表
  h+='<div class="small bold" style="margin:6px 0 3px">🏛️ 本業物資行情（近 12 旬）</div>';
  h+=own.map(x=>{const mm=G.mk[x.name],ch=chg(x.name);return '<div class="mkt-row '+(x.name===name?'on':'')+'" data-act="focus" data-n="'+esc(x.name)+'"><div><b class="small">'+(tradeOK(x.name)?'':'🔒')+esc(x.short)+'</b>'+infoBtn(x.name)+'<div class="tiny muted">庫存 '+(G.inv[x.name]||0)+'·損耗 '+(x.decay*100).toFixed(1)+'%/旬</div></div><div class="row" style="gap:8px">'+spark(mm.hist,ch>=0)+'<div style="text-align:right;width:62px"><b>'+fmt1(mm.price)+'</b><div class="'+(chgAmt(x.name,mm.price)>=0?'up':'down')+' tiny">'+amtTxt(chgAmt(x.name,mm.price))+'</div></div></div></div>'}).join('');
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
  return '<div class="card"><div class="row"><b class="small">🏪 本城同業市佔率（本業）</b><span class="tag '+(sh.factor>=1?'green':'red')+'">'+(sh.factor>=1.25?'本業買氣旺':sh.factor>=1.05?'本業買氣不錯':sh.factor>=0.95?'本業買氣持平':'本業買氣偏弱')+'</span></div>'+rows.map(line).join('')
   +'<div class="tiny muted" style="margin-top:4px">未列名的零星供貨約 '+(sh.others*100).toFixed(1)+'%（市占估計誤差）。</div>'
   +'</div>';
}
/** 下旬開頭的預估庫存：賣出後加上進貨（含已下單在途），再扣預估損耗（夏季主食損耗較多）。 */
function nextStock(name,ship,buy){
  const c=COMM_MAP[name],n=Math.max(0,(G.inv[name]||0)-ship)+buy+itemOnOrder(name);
  return Math.max(0,n-Math.round(n*c.decay*(c.staple&&season()==='夏'?1.6:1)));
}
/** 本旬預定出貨的總量與預估入帳（推進一旬時先出貨、後進貨，所以進貨可以用到這些倉位與貨款）。 */
function shipPlanTotals(){let q=0,rev=0;tradeComms().forEach(c=>{const v=planOf(c.name);if(v>0){q+=v;rev+=quoteSale(c.name,v).revenue}});return {q,rev}}
/** 【本旬買賣】單項貨的出貨與進貨：頂端看「現有→賣出後→下旬開頭」，下面是兩個滑桿與快速按鈕。 */
function tradeCard(name){
  const c=COMM_MAP[name],have=G.inv[name]||0,ship=UI.s.ship,bq=buyPlanOf(name),bmax=maxBuy(name,true),quota=quotaOf(name),buy=unitBuyCost(name),q=quoteSale(name,ship),idx=G.staple.idx||1;
  const ex=(G.cartel.state==='pledged'?'已表態守配額':G.cartel.state==='secret'?'已簽暗約偷跑':'未入會');
  let h='<div class="card" id="trade-card"><b class="small">📦 本旬買賣·'+esc(c.short)+'</b>';
  h+='<div class="small" style="margin:4px 0;text-align:center">現有 <b>'+have+'</b> → 賣出後 <b id="f-after">'+Math.max(0,have-ship)+'</b> → 下旬開頭約 <b id="f-next" style="color:#9b2c3a">'+nextStock(name,ship,bq)+'</b></div>';
  h+='<div style="border-top:1px dashed #b5a98f;padding-top:4px"><div class="row"><b class="small">📤 出貨</b><b id="q-q" style="color:#9b2c3a">'+ship+' 單位</b></div>';
  h+='<input id="slider-ship" type="range" min="0" max="'+Math.max(1,have)+'" value="'+ship+'" step="1" '+(have<1?'disabled':'')+'>';
  h+='<div class="tiny muted">公會配額 '+quota+'（'+ex+'）·穩定供貨線 '+supplyLine(name)+'</div><div class="tiny">出貨後市價 <b id="q-price">'+fmt1(q.price)+' 兩</b>·約入帳 <b id="q-rev" style="color:#1e7e34">'+fmt(q.revenue)+' 兩</b></div></div>';
  h+='<div style="border-top:1px dashed #b5a98f;padding-top:4px;margin-top:4px"><div class="row"><b class="small">📥 進貨</b><b id="b-q" style="color:#9b2c3a">'+bq+' 單位</b></div>';
  h+='<input id="slider-buy" type="range" min="0" max="'+Math.max(1,bmax)+'" value="'+bq+'" step="1" '+(bmax<1?'disabled':'')+'>';
  h+='<div class="tiny muted">本旬還能進 '+buyLeft(name)+'·在途 '+itemOnOrder(name)+(tempHelp()!==null?'　<span style="color:#1e7e34">'+esc(G.tempHelp.name)+'臨時幫忙，進貨上限變高</span>':nEmp('番頭')||nEmp('大番頭')?'　<span style="color:#1e7e34">'+(nEmp('番頭')?'番頭':'大番頭')+'幫忙，進貨上限變高</span>':'')+'</div><div class="tiny">單價 '+fmt1(buy)+' 兩·約花 <b id="b-cost">'+fmt(Math.round(buy*bq))+' 兩</b></div></div>';
  h+='<div class="row" style="margin-top:6px"><div class="small"><b>⚠️ 打毀警戒</b> <div style="width:130px;margin-top:2px">'+bar((idx-1),2.2,idx>2.3?'red':'gold')+'</div></div></div>';
  h+='<div class="tiny muted" style="margin-top:4px">推進一旬時照這裡辦理；進的貨在新的一旬開頭到倉。</div></div>';
  return h;
}
/** 【本旬買賣總表】所有本業貨這一旬的出貨、進貨與下旬開頭；點一列切換到那項貨。 */
function planCard(){
  const L=tradeComms();let rev=0,cost=0;
  let h='<div class="card" id="order-card" style="background:#fff8eb"><b class="small">📋 本旬買賣總表</b><div class="row" style="margin:4px 0;gap:4px;justify-content:flex-start">'+['planMax','planQuota','planClear'].map(k=>'<button class="pixel-btn btn-sm" data-act="'+k+'">'+UT('btn.'+k)+'</button>').join('')+'</div>'+(nEmp('大番頭')?'<div class="tiny muted">有大番頭：沒動過的品項，照上旬的數量帶入。</div>':'');
  h+=L.map(c=>{const n=c.name,s=planOf(n),b=buyPlanOf(n);rev+=s>0?quoteSale(n,s).revenue:0;cost+=Math.round(unitBuyCost(n)*b);
    return '<div class="row small" data-act="focus" data-n="'+esc(n)+'" style="margin-top:3px;cursor:pointer'+(n===UI.s.focus?';font-weight:bold;color:#9b2c3a':'')+'"><span>'+esc(c.short)+'</span><span>出 '+s+'·進 '+b+'·下旬約 '+nextStock(n,s,b)+'</span></div>'}).join('')||'<div class="tiny muted">目前沒有能買賣的本業貨。</div>';
  h+='<div class="row tiny muted" style="margin-top:3px;border-top:1px dashed #b5a98f;padding-top:3px"><span>約進帳 '+fmt(rev)+' 兩</span><span>進貨花 '+fmt(cost)+' 兩</span></div>';
  return h+'</div>';
}
/** 滑桿拖動或按快速鈕後，即時更新本旬買賣面板與總表。 */
function refreshTrade(){
  const name=UI.s.focus;if(!name||!$('#trade-card'))return;
  const have=G.inv[name]||0,ship=UI.s.ship,q=quoteSale(name,ship),bmax=maxBuy(name,true),sb=$('#slider-buy');
  if(sb){sb.max=Math.max(1,bmax);sb.disabled=bmax<1}
  const bq=buyPlanOf(name);if(sb)sb.value=bq;
  $('#q-q').textContent=ship+' 單位';$('#q-price').textContent=fmt1(q.price)+' 兩';$('#q-rev').textContent=fmt(q.revenue)+' 兩';
  $('#b-q').textContent=bq+' 單位';$('#b-cost').textContent=fmt(Math.round(unitBuyCost(name)*bq))+' 兩';
  $('#f-after').textContent=Math.max(0,have-ship);$('#f-next').textContent=nextStock(name,ship,bq);
  const oc=$('#order-card');if(oc)oc.outerHTML=planCard();
}
const updateQuote=refreshTrade;
/** 單項出貨設定（滑桿用）。 */
function setShipPlan(v){const n=UI.s.focus;G.plan=G.plan||{};G.plan[n]=clamp(v,0,G.inv[n]||0);UI.s.ship=G.plan[n];if(G.sold)delete G.sold[n]}
/** 總表按鈕：最大（每項進貨排到上限，出貨不動）、照配額（每項進貨設為公會配額，出貨不動）、清除（只清進貨）。 */
function planAllBuy(f){const L=tradeComms();G.buyPlan={};L.forEach(c=>{G.buyPlan[c.name]=0});let tot=0;L.forEach(c=>{const q=Math.max(0,Math.min(f(c.name),maxBuy(c.name,true)));G.buyPlan[c.name]=q;tot+=q});return tot}
ACT.planMax=()=>{const t=planAllBuy(n=>Infinity);toast(t?MSG('buyMax.ok',{tot:t}):MSG('buyMax.none'));UI.render()};
ACT.planQuota=()=>{let short=0;planAllBuy(n=>quotaOf(n));tradeComms().forEach(c=>{if((G.buyPlan[c.name]||0)<quotaOf(c.name))short++});
  toast(MSG(short?'plan.quotaShort':'plan.quota'));UI.render()};
ACT.planClear=()=>{G.buyPlan={};tradeComms().forEach(c=>{G.buyPlan[c.name]=0});toast(MSG('plan.clear'));UI.render()};
/** 選取大盤物品。 */
ACT.focus=el=>{UI.s.focus=el.dataset.n;renderMarket();sfx.tap()};
/** 進貨計畫：滑桿設定的本旬進貨量，推進一旬時自動下單。 */
function maxBuy(name,ui){
  const u=unitBuyCost(name)||1;let oq=0,oc=0;
  tradeComms().forEach(c=>{const k=c.name;if(k===name)return;const q=buyRaw(k);oq+=q;oc+=Math.round(unitBuyCost(k)*q)});
  let room=itemRoom(name),wh=invCap()-invUsed()-pendingQty()-transitQty(),cash=G.silver;
  if(ui){                                           // 畫面試算：推進一旬時先出貨、後進貨，出貨空出的倉位與入帳都算進來
    const T=shipPlanTotals();wh+=T.q;cash+=T.rev;
    room=Math.max(0,Math.min(itemCap(name)-Math.max(0,(G.inv[name]||0)-planOf(name))-itemOnOrder(name),wh));
  }
  return Math.max(0,Math.min(buyLeft(name),room,wh-oq,Math.floor((cash-oc)/u)));
}
/** 這項貨本旬的進貨設定（未夾上限）：你動過就照你的；沒動過時，有大番頭延續上旬的數量，否則 0。 */
function buyRaw(name){const v=(G.buyPlan||{})[name];if(v!==undefined)return Math.max(0,v||0);return nEmp('大番頭')&&G.lastBuy&&G.lastBuy[name]>0?G.lastBuy[name]:0}
function buyPlanOf(name){G.buyPlan=G.buyPlan||{};return clamp(buyRaw(name),0,maxBuy(name,true))}
function autoBuy(log){
  const plan={},got=[],kept=[],chief=nEmp('大番頭'),touched=new Set(Object.keys(G.buyPlan||{}));
  tradeComms().forEach(c=>{const v=buyRaw(c.name);if(v>0)plan[c.name]=v});
  if(chief){const nb={};tradeComms().forEach(c=>{nb[c.name]=buyRaw(c.name)});G.lastBuy=nb}else delete G.lastBuy;   // 大番頭延續的數字（記設定值，不是實際買到的量）
  G.buyPlan=Object.assign({},plan);                     // 只留還沒下單的計畫：maxBuy 會替它們保留倉位與現款
  tradeComms().forEach(c=>{
    const want=plan[c.name]||0;if(want<=0)return;
    delete G.buyPlan[c.name];                           // 下單前先移出計畫：下了單的量已算進在途量、也已扣現款，不能再保留一次
    const q=Math.min(want,maxBuy(c.name));if(q>0){const r=buyGoods(c.name,q);if(r.ok)(touched.has(c.name)?got:kept).push(c.short+'×'+q)}
  });
  if(got.length)log.push(NEWS('autoBuy.1',{got:got.join('、')}));
  if(kept.length)log.push(NEWS('chief.keepBuy',{got:kept.join('、')}));
  G.buyPlan={};
}
/** 按下『出貨』：以目前預設/滑桿量出貨並標記本旬已出貨。 */
ACT.ship=el=>{
  const name=UI.s.focus,qty=UI.s.ship;
  if(qty<=0){G.sold=G.sold||{};G.sold[name]=true;toast(MSG('ship.1'));renderMarket();return}
  playFx('cart',MSG('sell.shipping'),COMM_MAP[name].short+' × '+qty,()=>{
    const r=sellGoods(name,qty);toast(r.msg);if(r.ok){coinFx();G.sold=G.sold||{};G.sold[name]=true;G.plan[name]=0}UI.render();say(thought());
  },950);
};
document.addEventListener('input',e=>{if(e.target.id==='slider-buy'){G.buyPlan=G.buyPlan||{};G.buyPlan[UI.s.focus]=+e.target.value;refreshTrade();return}if(e.target.id==='slider-ship'){setShipPlan(+e.target.value);refreshTrade()}});

/* ---------- 商路 ---------- */
/** 商路畫面：許可與船長/飛腳狀態、出門採買中的人、委託採買面板與採買日誌。 */
function renderRoutes(){
  const R_=UI.s.route;
  const crew=m=>crewCount(m)+'（空閒 '+Math.max(0,crewCount(m)-crewBusy(m))+'）';
  let h='<div class="pixel-box" style="padding:8px"><div class="row" style="border-bottom:1px solid #b5a98f;padding-bottom:5px"><div><b>🗺️ 委託採買·船長與飛腳</b></div><span class="tag navy">船長 '+crewCount('sea')+'／'+slotCap('船長')+'·飛腳 '+crewCount('land')+'／'+slotCap('飛腳')+'</span></div>';
  h+='<div class="grid2 small" style="margin:6px 0;text-align:center"><div class="card" style="margin:0">海運許可<br><b>'+(permitsOf().sea.all?'全地區':Object.keys(permitsOf().sea).length+' 地區')+'</b><div class="tiny muted">船長 '+crew('sea')+'</div></div><div class="card" style="margin:0">陸運許可<br><b>'+(landPermit()?'已取得':'未取得')+'</b><div class="tiny muted">飛腳 '+crew('land')+'</div></div></div>';
  if(!anySea()&&!landPermit())h+='<div class="notice tiny">📌 海運、陸運許可由地區官員核發：請到「遠國奉行所」請託。</div>';
  if(G.ships.length){h+='<div class="small bold">⛵ 出門採買中</div>'+G.ships.map(s=>'<div class="card"><div class="row"><b class="small">'+(s.mode==='land'?'🐎 陸運·飛腳':'⛵ 海運·船長')+'「'+esc(s.captName)+'」</b><span class="tag '+(s.eta<=1?'green':'gray')+'">剩 '+s.eta+' 旬</span></div><div class="tiny muted">前往【'+esc(CITY(s.origId).name)+'】·委託金 '+fmt(s.budget)+' 兩·買什麼由'+(s.mode==='land'?'飛腳':'船長')+'決定，歸來才知道</div></div>').join('')}
  else h+='<div class="notice">目前沒有出門採買的船長或飛腳。</div>';
  h+='<hr class="sep"><div class="small bold">📦 委託採買</div><div style="margin:4px 0">'+['sea','land'].map(m=>'<span class="pill '+(R_.mode===m?'on':'')+'" data-act="rMode" data-m="'+m+'">'+UT(m==='sea'?'opt.modeSea':'opt.modeLand')+'</span>').join('')+'</div>';
  h+=voyagePanel();
  h+=voyLogCard();
  h+='<hr class="sep"><div class="tiny muted">一名船長帶一艘船、一名飛腳帶一支馬幫。聘船長時另付造船費。名額由奉行所核發：船長看「船株鑑札」（行政），飛腳看「馬幫株」（財務）。</div></div>';
  $('#view-routes').innerHTML=h;
}
/** 商路：選海運/陸路。 */
ACT.rMode=el=>{UI.s.route.mode=el.dataset.m;UI.s.route.dest=null;renderRoutes()};
/* ---------- 說明視窗：官吏職位、貿易物品 ---------- */
/** 關閉目前視窗後要接續執行的動作（例如旬報後依序顯示人物事件）。 */
var INFO_AFTER=null;
/** 顯示置中的說明視窗（官吏職位、貿易物品）。 */
UI.showInfo=(title,html)=>{$('#info-title').textContent=title;$('#info-body').innerHTML=html;$('#info-bd').classList.remove('hidden');$('#info-body').scrollTop=0};
/** 關閉說明視窗。 */
UI.hideInfo=()=>{ $('#info-bd').classList.add('hidden');const f=INFO_AFTER;INFO_AFTER=null;if(f)setTimeout(f,0) };
/** 說明視窗的欄位格式。 */
const ik=(k,v)=>v?'<div class="ik">'+k+'</div><div class="iv">'+esc(v)+'</div>':'';
/** 官吏職位說明內容（職掌、貪腐破口、升遷等，資料來自 OFFICIALS）。 */
function posInfoHtml(id){
  const p=OFF_POS[id];if(!p)return '<div class="notice">查無此職位。</div>';
  const sys=OFFICIALS.systems[p.court],rk=RANK_INFO[p.rank];
  const nm=x=>OFF_POS[x]?OFF_POS[x].title+'（'+RANK_INFO[OFF_POS[x].rank].title.split(/[\u30FB\u00B7]/)[0]+'）':x;
  return '<div class="small"><span class="tag '+COURTS[p.court].cls+'">'+COURTS[p.court].name+'</span> <span class="tag gold">'+esc(rk.title)+'</span></div>'
   +ik('所屬',sys.name+'·'+sys.department)+ik('職掌',p.duties)+(p.court!=='region'?ik('駐地',p.rank>=5?'巡迴各城，每三個月來本城一個月（'+[TOUR_MONTH[p.court],TOUR_MONTH[p.court]+3,TOUR_MONTH[p.court]+6,TOUR_MONTH[p.court]+9].join('、')+'月）':'常駐城中'):'')+ik('官階權力',rk.influence)+ik('與商人的關係',sys.merchant_interaction)
   +ik('貪腐破口',p.corruption_hooks)+ik('可升遷至',(p.promotes_to||[]).map(nm).join('、')||'（已達頂點）')+ik('升遷條件',p.promotion_conditions)
   +'<div class="ik">官階待遇</div><div class="iv">年俸 '+rk.salary_koku+' 石·賄賂基準 '+rk.bribe_base_gold+' 兩金</div>';
}
/** 顯示單一官吏職位說明。 */
ACT.posInfo=el=>{const p=OFF_POS[el.dataset.id];UI.pushInfo('官吏職位：'+(p?p.title:''),posInfoHtml(el.dataset.id))};
/** 顯示 30 個職位一覽。 */
ACT.posList=()=>{
  let h='<div class="tiny muted">三院每院一階一職，一～四階常駐城中，五階以上巡迴各城、每三個月來訪一個月。點選查看說明。</div>';
  Object.keys(COURTS).forEach(ct=>{const sys=OFFICIALS.systems[ct];h+='<div class="ik" style="font-size:13px">'+COURTS[ct].name+'系統·'+esc(sys.department)+'</div><div class="tiny muted">'+esc(sys.core_function)+'</div>'+sys.positions.map(p=>'<div class="irow" data-act="posInfo" data-id="'+p.id+'"><b>'+esc(p.title)+'</b> <span class="tag gold">'+RANK_INFO[p.rank].title.split(/[\u30FB\u00B7]/)[0]+'</span></div>').join('')});
  UI.showInfo('官吏職位一覽',h);
};
/** 顯示貿易物品說明（資料來自 COMM_INFO）。 */
ACT.commInfo=el=>{
  const n=el.dataset.n,c=COMM_MAP[n],i=COMM_INFO[n];if(!c||!i)return;
  UI.showInfo('貿易物品：'+c.short,'<div class="small"><span class="tag">'+c.kind+'</span> <span class="tag gray">'+esc(i.origin_type)+'</span>'+(c.flam?' <span class="tag red">易燃</span>':'')+'</div>'
   +ik('所屬系統',i.system_name)+ik('系統簡介',i.system_desc)+ik('全名',i.name)+ik('單位',i.unit)+'<div class="ik">遊戲基準價</div><div class="iv">'+fmt1(c.base)+' 兩／單位（每旬損耗約 '+(c.decay*100).toFixed(1)+'%）</div>'
   +ik('主要產區',(i.primary_regions||[]).join('、'))+ik('季節特性',i.seasonal_traits)+ik('價格波動',i.price_volatility)+ik('需求階層',i.demand_strata)+ik('保存與損耗',i.decay_rate)+ik('管制狀態',i.contraband_status)+ik('卡特爾潛力',i.cartel_potential));
};
/** 物品旁的『ⓘ說明』按鈕。 */
const infoBtn=n=>'<span class="ibtn" data-act="commInfo" data-n="'+esc(n)+'">ⓘ說明</span>';

/* ---------- 出貨預設＝公會配額；未按「出貨」，推進一旬時自動出貨 ---------- */
/** 某物品本旬的預定出貨量：預設＝公會配額（有大番頭時延續上旬的出貨量），不超過庫存，可被滑桿覆蓋（存在 G.plan）。 */
function planOf(name){
  const have=G.inv[name]||0;G.plan=G.plan||{};
  if(G.plan[name]===undefined)G.plan[name]=Math.min(nEmp('大番頭')&&G.lastShip&&G.lastShip[name]!==undefined?G.lastShip[name]:quotaOf(name),have);   // 有大番頭：延續上旬的出貨量
  return clamp(G.plan[name],0,have);
}
/** 【穩定供貨線】本城該物品需求 × 你的市佔率，四捨五入（可以是 0：冷門奢侈品在小城常如此）。出貨量達此線才算穩定供貨；0 的貨不列入判定。 */
function supplyLine(name){const sh=(G.share&&G.share.me)||0.05;return Math.max(0,Math.round((G.mk[name].D||0)*sh*supplyCut()))}
/** 推進一旬前，對本旬沒按『出貨』的物品自動按預定量出貨，並清空本旬計畫。 */
function autoShip(log){
  G.sold=G.sold||{};G.plan=G.plan||{};
  const rep={rev:0,ship:[],fame:0,publicSpend:Object.assign({},G.publicSpend||{})};
  G.publicSpend={};
  const own=tradeComms();let short=[],squeeze=[],judged=0,allMet=true;          // 未取得交易許可的貨不算進穩定供貨線
  own.forEach(c=>{
    const quota=quotaOf(c.name),have=G.inv[c.name]||0;
    const q=planOf(c.name);let shipped=0;
    if(q>0){const r=sellGoods(c.name,q);if(r.ok){shipped=q;rep.rev+=r.revenue;rep.ship.push({n:c.short,q,rev:r.revenue})}}
    /* 穩定供貨線＝本城需求 × 你的市佔率；出貨量沒達到就算未能穩定供貨。
       已入會（守約或暗約）、配額低於供貨線、而你已出到配額（含超賣）＝同業壓貨波及（刻意保留的守約代價，旬報另列）；其餘（含未入會）＝出貨不足 */
    const line=supplyLine(c.name);if(line>0)judged++;
    if(line>0&&shipped<line){(guildMember()&&quota<line&&shipped>=quota?squeeze:short).push(c.short);allMet=false}   // 未入會沒有配額約束，一律算出貨不足
  });
  /* 穩定供貨：全部商品出貨量達穩定供貨線 → 知名度 +1～3；有商品未達 → -1～3 */
  if(short.length||squeeze.length){rep.fame=-(1+Math.floor(rnd()*3));rep.short=short;rep.squeeze=squeeze}   // 兩種扣分相同
  else if(allMet&&judged>0)rep.fame=1+Math.floor(rnd()*3);   // 沒有任何一項貨的供貨線 ≥1：這一旬不判定
  if(rep.fame)G.fame=clamp((G.fame||0)+rep.fame,0,ODDS.fame.cap);
  if(rep.fame>0){G.mybias=Math.min(4,(G.mybias||1)*(1+0.01*rep.fame));rep.shareUp=true}   // 穩定供貨：市佔率微幅增加
  if(rep.ship.length){const t=NEWS('autoShip.1',{rev:rep.ship.map(x=>x.n+'×'+x.q+'（'+fmt(x.rev)+'）').join('、')});log.push(t);pushNews(t)}
  TURNRP=rep;
  if(nEmp('大番頭')){G.lastShip={};own.forEach(c=>{G.lastShip[c.name]=G.plan[c.name]!==undefined?G.plan[c.name]:quotaOf(c.name)})}else delete G.lastShip;   // 大番頭延續的數字
  G.plan={};G.sold={};
}
