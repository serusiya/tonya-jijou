'use strict';
/* ★檔案總覽：主介面（首頁、大盤、商路）
 * - UI.s：介面暫存狀態（分頁、選取物品、面板…，不存檔）。ACT[name]：data-act 按鈕處理；CHG：data-chg 變更處理。
 * - renderHome/renderMarket/renderRoutes：三個主畫面；說明視窗 UI.showInfo。畫面文字在 01e_ui_text.js（home.*、mk.*、rt.*、pos.*、ci.*）。
 * - planOf/autoShip：出貨預設＝本期有效協議配額（以量制價採固定比例；正常供應採穩定供貨線），未按「出貨」則推進一旬時自動出貨。 */
/* ======================= 06 介面核心：頂欄、分頁、跑馬燈、大盤、商路 ======================= */
/** 介面暫存狀態（不存檔）：分頁、選取物品、面板、筆記篩選、商路設定… */
const UI={s:{tab:'home',focus:null,ship:0,buy:10,sheet:null,sheetLock:false,notesQ:'',notesF:'all',route:{mode:'sea',dest:null},intro:null,openNote:null}};
/** ACT：data-act 點擊處理表；CHG：data-chg 變更處理表。新增按鈕＝在 HTML 加 data-act 並在此註冊。 */
const ACT={},CHG={};
/** 四個主分頁。 */
const TAB_IDS=['market','routes','notes','estate'];
/** 好感數值→文字（冷淡…莫逆）。 */
const affWord=a=>NAMES.aff[a<15?0:a<35?1:a<55?2:a<75?3:4];
/** 好感數值→標籤色。 */
const affCls=a=>a<15?'red':a<35?'gray':a<55?'green':'gold';
/** 繪製進度條。 */
const bar=(v,max,cls)=>'<div class="bar '+(cls||'')+'"><i style="width:'+clamp(v/max*100,0,100)+'%"></i></div>';
/** 帶正負號的數字。 */
const sgn=n=>(n>=0?'+':'')+fmt(n);
/** 季節圖示。 */
const SEASON_ICON={spring:'🌸',summer:'☀️',autumn:'🍁',winter:'❄️'};

/* ---------- 切換分頁 ---------- */
/** 切換主分頁並重繪。 */
UI.go=function(tab){
  UI.s.tab=tab;
  ['home',...TAB_IDS].forEach(t=>$('#view-'+t).classList.toggle('hidden',t!==tab));
  $$('#bottom button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
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
  const od=Object.values(G.rel).some(r=>r.promises.some(p=>!p.done&&G.turn>p.due-1));
  $$('#bottom button').forEach(b=>{const old=b.querySelector('.nav-dot');if(old)old.remove();if(b.dataset.tab==='notes'&&od){const d=document.createElement('i');d.className='nav-dot';b.appendChild(d)}});
};
/** 更新頂部資訊（日期、現款、私房錢、知名度、行動點數）。 */
function updateTop(){
  $('#d-date').textContent=dateStr();
  $('#d-age').textContent=UT('top.age',{n:G.me.given,a:myAge()});
  $('#d-silver').textContent=UT('top.amt',{a:fmt(G.silver)});
  $('#d-silver').style.color=G.silver<0?'#ff7a7a':'#fff';
  {const D=(G.debts||[]).filter(d=>!d.paid),e=$('#d-debt');if(e){if(D.length){const tot=D.reduce((a,d)=>a+d.amt,0),near=Math.max(0,Math.min(...D.map(d=>d.due-G.turn)));e.textContent=UT('top.debt',{a:fmt(tot),w:near?UT('top.debtIn',{n:near}):UT('top.debtNow')});e.title=UT('top.debtTip',{a:fmt(tot),w:near?UT('top.debtTipIn',{n:near}):UT('top.debtNow')});e.style.color=near<=2?'#ff9a7a':'';e.classList.remove('hidden')}else e.classList.add('hidden')}}
  $('#d-gold').textContent=UT('top.amt',{a:Math.round(G.gold)});
  updateAP();updateFame();
  { const a=$('#d-ap'); if(a&&(G.exile||0)>0) a.textContent=UT('top.exile',{n:G.exile}); else if(a&&(G.injured||0)>0) a.textContent=UT('top.injured',{n:G.injured}); }
  setTicker();
}
let _tk='';
/** 更新新聞跑馬燈。 */
function setTicker(){
  const t=G.ticker.slice(0,6).join(UT('top.tickerSep'))||'……';
  if(t===_tk)return;_tk=t;
  const old=$('#ticker-txt'),n=old.cloneNode();n.textContent=t;n.style.animationDuration=Math.max(26,t.length*0.42)+'s';old.parentNode.replaceChild(n,old);
}

/* ---------- 宅邸（首頁） ---------- */
/** 首頁：各處所卡片數字、倉庫狀態、新手提示（無介紹人/無員工），並同步場景。 */
function renderHome(){
  const city=homeCity();
  $('#badge-season').textContent=UT('home.season',{i:SEASON_ICON[season()],s:seasonName(season()),c:CYCLE_NAMES[G.cycle-1]});
  const al=$('#badge-alert');
  let a='';if(G.festival)a='🏮 '+G.festival;else if(G.cartel.sanction>0)a=UT('home.sanction',{n:G.cartel.sanction});else if((G.staple.idx||1)>2.2)a=UT('home.riot');else if(Object.values(G.mk).some(m=>m.ev>1.5))a=UT('home.market');
  al.textContent=a;al.classList.toggle('hidden',!a);
  $('#loc-city').textContent=UT('home.city',{c:city.name});
  {const fw=$('#fest-walk');if(fw)fw.innerHTML=festWalkHtml()}   // 節慶當旬：逛祭典（07zf_festwalk.js）
  {const gm=$('#guild-meet');if(gm)gm.innerHTML=meetHomeHtml()}   // 例會旬：問屋公會例會（07yb_meeting.js）
  $('#n-off').textContent=UT('home.nOff',{n:officialsOf(G.cityId).length});
  $('#n-flower').textContent=UT('home.nFlower',{a:oiranOnStage().length,b:oiranAll().length});
  $('#n-res').textContent=UT('home.nRes',{n:resident().length});
  const fl=Object.keys(G.inv).reduce((a,k)=>a+(COMM_MAP[k].flam?G.inv[k]:0),0);
  $('#wh-line').textContent=UT('home.wh',{n:G.wh.n,u:invUsed(),c:invCap(),f:fl,g:guardCount()});
  const st=fl>invUsed()*0.5&&fl>20?['alert','red']:fl>0?['watch','gold']:['safe','green'];
  const w=$('#wh-state');w.textContent=UT('home.wh.'+st[0]);w.className='tag '+st[1];
  $('#wh-guard').textContent=G.lastSpoil||'';
  const tip=$('#home-tip');
  if(!G.intros.length){tip.innerHTML=UT('home.tipNoIntro');tip.classList.remove('hidden')}
  else if(!G.emps.length){tip.innerHTML=UT('home.tipNoEmp');tip.classList.remove('hidden')}
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
/** 本旬價格比上旬高或低多少兩（約略整數）。 */
function chgAmt(name,cur){const h=G.mk[name].hist;if(h.length<2)return 0;return Math.round(cur-h[h.length-2])}
/** 價差文字：「約 +3 兩」「約 -2 兩」「持平」。 */
const amtTxt=d=>d===0?UT('mk.flat'):UT('mk.amt',{d:(d>0?'+':'-')+Math.abs(d)});
/** 價格欄（市價）下方的短版價差：「+3」「-2」「持平」。 */
const amtShort=d=>d===0?UT('mk.flat'):(d>0?'+':'-')+Math.abs(d);
function chg(name){const h=G.mk[name].hist;if(h.length<2)return 0;return (h[h.length-1]-h[h.length-2])/Math.max(0.01,h[h.length-2])*100}
/** 協議立場的短說明。 */
const cartelStanceTxt=()=>UT('mk.stance.'+G.cartel.state);
/** 大盤畫面：行情、本旬買賣（出貨與進貨合併）、本旬買賣總表、市佔率、行情表。 */
function renderMarket(){
  const own=ownComms();
  if(!UI.s.focus||!G.mk[UI.s.focus]||!own.some(c=>c.name===UI.s.focus))UI.s.focus=(own.find(c=>tradeOK(c.name))||own[0]).name;
  const name=UI.s.focus,c=COMM_MAP[name],m=G.mk[name],have=G.inv[name]||0;
  UI.s.ship=planOf(name);
  const buy=unitBuyCost(name),mkt=m.price;
  let h='<div class="pixel-box" style="padding:8px">';
  h+='<div class="row" style="border-bottom:1px solid #b5a98f;padding-bottom:5px"><div><b>'+UT('mk.title',{p:guildPolicyName()})+'</b><div class="tiny muted">'+UT('mk.lead')+(cartelPolicy()==='normal'?UT(guildMember()?'mk.leadNormal':'mk.leadNormalNone'):UT('mk.leadRestrict'))+UT('mk.leadTail')+'</div></div><span class="tag gold">'+UT('mk.seasonTag',{s:seasonName(season())})+'</span></div>';
  h+='<div style="margin-top:6px">'+own.map(x=>'<span class="pill '+(x.name===name?'on':'')+'" data-act="focus" data-n="'+esc(x.name)+'">'+(tradeOK(x.name)?'':'🔒')+esc(x.short.slice(0,7))+'</span>').join('')+'</div>';
  h+='<div class="card" style="background:#fff8eb;margin-top:4px"><div class="row"><div><b style="font-size:16px;color:#9b2c3a">'+esc(c.short)+'</b>'+infoBtn(name)+' <span class="tag">'+NM('kind',c.kind)+'</span>'+(c.flam?'<span class="tag red">'+UT('mk.flam')+'</span>':'')+'</div><div style="text-align:right" class="small">'+UT('mk.base',{p:fmt1(c.base)})+'</div></div>';
  h+='<div class="grid3 small" style="margin-top:5px;text-align:center"><div class="card" style="margin:0">'+UT('mk.price')+'<br><b class="'+(chg(name)>=0?'up':'down')+'" id="m-price">'+fmt1(mkt)+'</b><div class="tiny '+(chgAmt(name,mkt)>=0?'up':'down')+'">'+UT('mk.vsLast',{d:amtShort(chgAmt(name,mkt))})+'</div></div><div class="card" style="margin:0">'+UT('mk.buyPrice')+'<br><b>'+fmt1(buy)+'</b>'+'<div class="tiny muted">'+UT(guildMember()?'mk.jointPrice':'mk.price')+'</div>'+'</div><div class="card" style="margin:0">'+UT('mk.stock')+'<br><b>'+have+'</b>'+(have>0?'<div class="tiny muted">'+UT('mk.avg',{p:fmt1(avgCostOf(name))})+'</div>':'')+'</div></div>';
  h+='</div>';
  // 本旬買賣（未取得交易許可的貨，只顯示行情）
  if(!tradeOK(name))h+='<div class="notice">🔒 '+esc(tradeLockMsg(name))+'</div>';
  else h+=tradeCard(name);
  h+=G.lastSpoil?'<div class="notice" style="margin-top:6px">'+UT('mk.lastSpoil',{s:esc(G.lastSpoil)})+'</div>':'';
  h+=planCard()+shareCard()+guildInfoCard();
  // 行情表
  h+='<div class="small bold" style="margin:6px 0 3px">'+UT('mk.tableTitle')+'</div>';
  h+=own.map(x=>{const mm=G.mk[x.name],ch=chg(x.name);return '<div class="mkt-row '+(x.name===name?'on':'')+'" data-act="focus" data-n="'+esc(x.name)+'"><div><b class="small">'+(tradeOK(x.name)?'':'🔒')+esc(x.short)+'</b>'+infoBtn(x.name)+'<div class="tiny muted">'+UT('mk.rowSub',{q:G.inv[x.name]||0,d:(x.decay*100).toFixed(1)})+'</div></div><div class="row" style="gap:8px">'+spark(mm.hist,ch>=0)+'<div style="text-align:right;width:62px"><b>'+fmt1(mm.price)+'</b><div class="'+(chgAmt(x.name,mm.price)>=0?'up':'down')+' tiny">'+amtTxt(chgAmt(x.name,mm.price))+'</div></div></div></div>'}).join('');
  h+='<div class="small bold" style="margin:6px 0 3px">'+UT('mk.stapleTitle')+'</div>';
  h+=STAPLE_KEYS.filter(k=>G.mk[k]).map(k=>{const si=stapleIndex(k);return '<div class="mkt-row lock"><div><b class="small">'+esc(COMM_MAP[k].short)+'</b>'+infoBtn(k)+'<div class="tiny muted">'+UT('mk.stapleBase',{p:fmt1(COMM_MAP[k].base)})+'</div></div><div class="row" style="gap:8px">'+spark(G.mk[k].hist,chg(k)>=0)+'<div style="text-align:right;width:70px"><b class="'+(si>2?'up':'')+'">'+Math.round(si*100)+'%</b><div class="tiny muted">'+UT('mk.vsBase')+'</div></div></div></div>'}).join('');
  h+='</div>';
  $('#view-market').innerHTML=h;updateQuote();
}
/** 市佔率卡片：我與本城同行的佔比與趨勢。 */
function shareCard(){
  shareFactor();const sh=G.share;if(!sh)return '';
  const rows=sh.rows.map(r=>({n:r.name,v:r.share,pv:r.prev,tag:r.raided?UT('mk.share.raided'):r.ev>1.1?UT('mk.share.hot'):r.ev<0.9?UT('mk.share.hurt'):''})).concat([{n:UT('mk.share.me'),v:sh.me,pv:null,me:true,tag:''}]).sort((a,b)=>b.v-a.v);
  const line=r=>{const pct=(r.v*100).toFixed(1);const tr=r.pv!==null&&r.pv!==undefined?(r.v>r.pv+0.002?'<span class="up">▲</span>':r.v<r.pv-0.002?'<span class="down">▼</span>':''):'';return '<div style="margin-top:3px"><div class="row tiny"><span'+(r.me?' style="font-weight:bold;color:#9b2c3a"':'')+'>'+esc(r.n)+r.tag+' '+tr+'</span><b>'+pct+'%</b></div>'+bar(r.v,0.5,r.me?'gold':'gray')+'</div>'};
  return '<div class="card"><div class="row"><b class="small">'+UT('mk.share.title')+'</b><span class="tag '+(sh.factor>=1?'green':'red')+'">'+UT(sh.factor>=1.25?'mk.share.f1':sh.factor>=1.05?'mk.share.f2':sh.factor>=0.95?'mk.share.f3':'mk.share.f4')+'</span></div>'+rows.map(line).join('')
   +'<div class="tiny muted" style="margin-top:4px">'+UT('mk.share.others',{p:(sh.others*100).toFixed(1)})+'</div>'
   +'</div>';
}
/** 下旬開頭的預估庫存：賣出後加上本旬預定進貨，再扣預估損耗（夏季主食損耗較多）。 */
function nextStock(name,ship,buy){
  const c=COMM_MAP[name],n=Math.max(0,(G.inv[name]||0)-ship)+buy;
  return Math.max(0,n-Math.round(n*c.decay*(c.staple&&season()==='summer'?1.6:1)));
}
/** 本旬預定出貨的總量與預估入帳（推進一旬時先出貨、後進貨，所以進貨可以用到這些倉位與貨款）。 */
function shipPlanTotals(){let q=0,rev=0;tradeComms().forEach(c=>{const v=planOf(c.name);if(v>0){q+=v;rev+=quoteSale(c.name,v).revenue}});return {q,rev}}
/** 【本旬買賣】單項貨的出貨與進貨：頂端看「現有→賣出後→下旬開頭」，下面是兩個滑桿。 */
function tradeCard(name){
  const c=COMM_MAP[name],m=G.mk[name],have=G.inv[name]||0,ship=UI.s.ship,bq=buyPlanOf(name),bmax=maxBuy(name,true),quota=quotaOf(name),buy=unitBuyCost(name),q=quoteSale(name,ship),idx=G.staple.idx||1;
  let h='<div class="card" id="trade-card"><div class="row"><b class="small">'+UT('mk.trade.title',{n:esc(c.short)})+'</b><span class="tiny muted" style="text-align:right">'+UT('mk.trade.cap',{u:invUsed(),c:invCap()})+'</span></div>';
  h+='<div class="small" style="margin:4px 0;text-align:center">'+UT('mk.trade.flow',{a:have,b:'<b id="f-after">'+Math.max(0,have-ship)+'</b>',c:'<b id="f-next" style="color:#9b2c3a">'+nextStock(name,ship,bq)+'</b>'})+'</div>';
  h+='<div style="border-top:1px dashed #b5a98f;padding-top:4px"><div class="row"><b class="small">'+UT('mk.trade.ship')+'</b><b id="q-q" style="color:#9b2c3a">'+UT('mk.units',{n:ship})+'</b></div>';
  h+=stepRow('<input id="slider-ship" type="range" min="0" max="'+Math.max(1,have)+'" value="'+ship+'" step="1" '+(have<1?'disabled':'')+'>','slider-ship',have<1||ship<=0,have<1||ship>=have);
  h+='<div class="tiny muted">'+UT('mk.trade.quota',{q:quota,s:UT('mk.trade.stance.'+G.cartel.state),l:supplyLine(name)})+'</div><div class="tiny">'+UT('mk.trade.after',{p:'<b id="q-price">'+UT('mk.liang',{a:fmt1(q.price)})+'</b>',r:'<b id="q-rev" style="color:#1e7e34">'+UT('mk.liang',{a:fmt(q.revenue)})+'</b>'})+'</div></div>';
  h+='<div style="border-top:1px dashed #b5a98f;padding-top:4px;margin-top:4px"><div class="row"><b class="small">'+UT('mk.trade.buy')+'</b><b id="b-q" style="color:#9b2c3a">'+UT('mk.units',{n:bq})+'</b></div>';
  h+=stepRow('<input id="slider-buy" type="range" min="0" max="'+Math.max(1,bmax)+'" value="'+bq+'" step="1" '+(bmax<1?'disabled':'')+'>','slider-buy',bmax<1||bq<=0,bmax<1||bq>=bmax);
  h+='<div class="tiny">'+UT('mk.trade.unit',{p:fmt1(buy),c:'<b id="b-cost">'+UT('mk.liang',{a:fmt(Math.round(buy*bq))})+'</b>'})+'</div></div>';
  h+='<div class="tiny muted" style="margin-top:6px">'+UT('mk.trade.demand',{d:m.D,s:m.so,w:Math.round(m.so+pastOf(m).reduce((a,x)=>a+x.so,0))})+(m.ev>1.15?'<span class="up">'+UT('mk.trend.up')+'</span>':m.ev<0.9?'<span class="down">'+UT('mk.trend.down')+'</span>':UT('mk.trend.flat'))+(festActive()?' <span class="up">'+UT(festHot(c)?'mk.fest.hot':'mk.fest.all')+'</span>':'')+(c.luxury&&m.lux&&m.lux.ph==='dry'?' <span class="down">'+UT('mk.lux.dry')+'</span>':c.luxury&&m.lux&&m.lux.ph==='burst'?' <span class="up">'+UT('mk.lux.burst')+'</span>':'')+'</div>';
  h+='<div class="row" style="margin-top:6px"><div class="small"><b>'+UT('mk.riotBar')+'</b> <div style="width:130px;margin-top:2px">'+bar((idx-1),2.2,idx>2.3?'red':'gold')+'</div></div></div>';
  h+='</div>';
  return h;
}
/** 【本旬買賣總表】所有本業貨這一旬的出貨、進貨與下旬開頭；點一列切換到那項貨。 */
function planCard(){
  const L=tradeComms();let rev=0,cost=0;
  let h='<div class="card" id="order-card" style="background:#fff8eb"><b class="small">'+UT('mk.plan.title')+'</b><div class="row" style="margin:4px 0;gap:4px;justify-content:flex-start">'+['planMax','planQuota','planClear'].map(k=>'<button class="pixel-btn btn-sm" data-act="'+k+'">'+UT('btn.'+k)+'</button>').join('')+'</div>'+((G.exile||0)>0?'<div class="tiny muted">'+UT('mk.plan.away')+'</div>':'');
  h+=L.map(c=>{const n=c.name,s=planOf(n),b=buyPlanOf(n);rev+=s>0?quoteSale(n,s).revenue:0;cost+=Math.round(unitBuyCost(n)*b);
    return '<div class="row small" data-act="focus" data-n="'+esc(n)+'" style="margin-top:3px;cursor:pointer'+(n===UI.s.focus?';font-weight:bold;color:#9b2c3a':'')+'"><span>'+esc(c.short)+'</span><span>'+UT('mk.plan.row',{s,b,n:nextStock(n,s,b)})+'</span></div>'}).join('')||'<div class="tiny muted">'+UT('mk.plan.none')+'</div>';
  h+='<div class="row tiny muted" style="margin-top:3px;border-top:1px dashed #b5a98f;padding-top:3px"><span>'+UT('mk.plan.rev',{a:fmt(rev)})+'</span><span>'+UT('mk.plan.cost',{a:fmt(cost)})+'</span></div>';
  return h+'</div>';
}
/** 滑桿拖動或按快速鈕後，即時更新本旬買賣面板與總表。 */
function refreshTrade(){
  const name=UI.s.focus;if(!name||!$('#trade-card'))return;
  const have=G.inv[name]||0,ship=UI.s.ship,q=quoteSale(name,ship),bmax=maxBuy(name,true),sb=$('#slider-buy');
  if(sb){sb.max=Math.max(1,bmax);sb.disabled=bmax<1}
  const bq=buyPlanOf(name);if(sb)sb.value=bq;
  $('#q-q').textContent=UT('mk.units',{n:ship});$('#q-price').textContent=UT('mk.liang',{a:fmt1(q.price)});$('#q-rev').textContent=UT('mk.liang',{a:fmt(q.revenue)});
  $('#b-q').textContent=UT('mk.units',{n:bq});$('#b-cost').textContent=UT('mk.liang',{a:fmt(Math.round(unitBuyCost(name)*bq))});
  $('#f-after').textContent=Math.max(0,have-ship);$('#f-next').textContent=nextStock(name,ship,bq);
  const oc=$('#order-card');if(oc)oc.outerHTML=planCard();
}
const updateQuote=refreshTrade;
/** 單項出貨設定（滑桿用）。 */
function setShipPlan(v){const n=UI.s.focus;G.plan=G.plan||{};G.plan[n]=clamp(v,0,G.inv[n]||0);UI.s.ship=G.plan[n];if(G.sold)delete G.sold[n]}
/** 總表按鈕：最大（每項進貨排到上限，出貨不動）、照配額（每項進貨設為協議配額，出貨不動）、清除（只清進貨）。 */
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
  let room=itemRoom(name),wh=invCap()-invUsed()-pendingQty(),cash=G.silver;
  if(ui){                                           // 畫面試算：推進一旬時先出貨、後進貨，出貨空出的倉位與入帳都算進來
    const T=shipPlanTotals();wh+=T.q;cash+=T.rev;
    room=Math.max(0,Math.min(itemCap(name)-Math.max(0,(G.inv[name]||0)-planOf(name))-itemOnOrder(name),wh));
  }
  return Math.max(0,Math.min(buyLeft(name),room,wh-oq,Math.floor((cash-oc)/u)));
}
/** 這項貨本旬的進貨設定（未夾上限）：你動過就照你的；沒動過時預設 0，遠島期間（主人不在）照協議配額。 */
const awayMode=()=>(G.exile||0)>0;
function buyRaw(name){const v=(G.buyPlan||{})[name];if(v!==undefined)return Math.max(0,v||0);return awayMode()?quotaOf(name):0}
function buyPlanOf(name){G.buyPlan=G.buyPlan||{};return clamp(buyRaw(name),0,maxBuy(name,true))}
function autoBuy(log){
  const plan={},got=[],kept=[],touched=new Set(Object.keys(G.buyPlan||{}));
  tradeComms().forEach(c=>{const v=buyRaw(c.name);if(v>0)plan[c.name]=v});
  G.buyPlan=Object.assign({},plan);                     // 只留還沒下單的計畫：maxBuy 會替它們保留倉位與現款
  tradeComms().forEach(c=>{
    const want=plan[c.name]||0;if(want<=0)return;
    delete G.buyPlan[c.name];                           // 下單前先移出計畫：下了單的量已算進待到貨訂單量、也已扣現款，不能再保留一次
    const q=Math.min(want,maxBuy(c.name));if(q>0){const r=buyGoods(c.name,q);if(r.ok){(touched.has(c.name)?got:kept).push(c.short+'×'+q);if(TURNRP){TURNRP.buy=TURNRP.buy||{};const o=TURNRP.buy[c.short]||(TURNRP.buy[c.short]={q:0,cost:0});o.q+=q;o.cost+=r.cost}}}   // 旬報：大盤進貨逐項記錄
  });
  if(got.length)log.push(NEWS('autoBuy.1',{got:got.join(NAMES_SEP)}));
  if(kept.length)log.push(NEWS('away.buy',{got:kept.join(NAMES_SEP)}));   // 遠島期間照配額進貨
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
  const crew=m=>UT('rt.crewFree',{n:crewCount(m),f:Math.max(0,crewCount(m)-crewBusy(m))});
  let h='<div class="pixel-box" style="padding:8px"><div class="row" style="border-bottom:1px solid #b5a98f;padding-bottom:5px"><div><b>'+UT('rt.title')+'</b></div><span class="tag navy">'+UT('rt.slots',{c:crewCount('sea'),cc:slotCap('captain'),f:crewCount('land'),fc:slotCap('courier')})+'</span></div>';
  h+='<div class="grid2 small" style="margin:6px 0;text-align:center"><div class="card" style="margin:0">'+UT('rt.sea')+'<br><b>'+(permitsOf().sea.all?UT('rt.allRegions'):UT('rt.nRegions',{n:Object.keys(permitsOf().sea).length}))+'</b><div class="tiny muted">'+UT('rt.captains',{c:crew('sea')})+'</div></div><div class="card" style="margin:0">'+UT('rt.land')+'<br><b>'+UT(landPermit()?'rt.got':'rt.notGot')+'</b><div class="tiny muted">'+UT('rt.couriers',{c:crew('land')})+'</div></div></div>';
  if(!anySea()&&!landPermit())h+='<div class="notice tiny">'+UT('rt.needPermit')+'</div>';
  if(G.ships.length){h+='<div class="small bold">'+UT('rt.outTitle')+'</div>'+G.ships.map(s=>'<div class="card"><div class="row"><b class="small">'+UT(s.mode==='land'?'rt.outLand':'rt.outSea',{n:esc(s.captName)})+'</b><span class="tag '+(s.eta<=1?'green':'gray')+'">'+UT('rt.left',{n:s.eta})+'</span></div><div class="tiny muted">'+UT('rt.outSub',{c:esc(CITY(s.origId).name),b:fmt(s.budget),w:NM('crew',s.mode==='land'?'land':'sea')})+'</div></div>').join('')}
  else h+='<div class="notice">'+UT('rt.noneOut')+'</div>';
  h+='<hr class="sep"><div class="small bold">'+UT('rt.entrust')+'</div><div style="margin:4px 0">'+['sea','land'].map(m=>'<span class="pill '+(R_.mode===m?'on':'')+'" data-act="rMode" data-m="'+m+'">'+UT(m==='sea'?'opt.modeSea':'opt.modeLand')+'</span>').join('')+'</div>';
  h+=voyagePanel();
  h+=voyQueueCard();
  h+=voyLogCard();
  h+='<hr class="sep"><div class="tiny muted">'+UT('rt.foot')+'</div></div>';
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
UI.hideInfo=()=>{ $('#info-bd').classList.add('hidden');$('#info-bd').classList.remove('over-start');const f=INFO_AFTER;INFO_AFTER=null;if(f)setTimeout(f,0) };
/** 說明視窗的欄位格式。 */
const ik=(k,v)=>v?'<div class="ik">'+k+'</div><div class="iv">'+esc(v)+'</div>':'';
/** 官階名稱的簡稱（「一階·小吏」→「一階」）。 */
const rankShort=t=>t.split(/[\u30FB\u00B7]/)[0];
/** 官吏職位說明內容（職掌、能辦的請託、升遷等；請託由請託表產生，見 posFavors）。 */
function posInfoHtml(id){
  const p=OFF_POS[id];if(!p)return '<div class="notice">'+UT('pos.none')+'</div>';
  const sys=OFFICIALS.systems[p.court],rk=RANK_INFO[p.rank];
  const nm=x=>OFF_POS[x]?UT('pos.next',{t:OFF_POS[x].title,r:rankShort(RANK_INFO[OFF_POS[x].rank].title)}):x;
  const tm=TOUR_MONTH[p.court];
  return '<div class="small"><span class="tag '+COURTS[p.court].cls+'">'+COURTS[p.court].name+'</span> <span class="tag gold">'+esc(rk.title)+'</span></div>'
   +ik(UT('pos.dept'),UT('pos.deptVal',{a:sys.name,b:sys.department}))+ik(UT('pos.duty'),p.duties)+(p.court!=='region'?ik(UT('pos.seat'),p.rank>=5?UT('pos.touring',{m:[tm,tm+3,tm+6,tm+9].join(NAMES_SEP)}):UT('pos.resident')):'')+ik(UT('pos.power'),rk.influence)+ik(UT('pos.merchant'),sys.merchant_interaction)
   +posFavorsHtml(id)+ik(UT('pos.promote'),(p.promotes_to||[]).map(nm).join(NAMES_SEP)||UT('pos.top'))+ik(UT('pos.cond'),p.promotion_conditions)
   +'<div class="ik">'+UT('pos.pay')+'</div><div class="iv">'+UT('pos.salary',{n:rk.salary_koku})+'</div>';
}
/** 顯示單一官吏職位說明。 */
ACT.posInfo=el=>{const p=OFF_POS[el.dataset.id];UI.pushInfo(UT('pos.title',{t:p?p.title:''}),posInfoHtml(el.dataset.id))};
/** 顯示職位一覽。 */
ACT.posList=()=>{
  let h='<div class="tiny muted">'+UT('pos.listLead')+'</div>';
  Object.keys(COURTS).forEach(ct=>{const sys=OFFICIALS.systems[ct];h+='<div class="ik" style="font-size:15px">'+UT('pos.listSys',{c:COURTS[ct].name,d:esc(sys.department)})+'</div><div class="tiny muted">'+esc(sys.core_function)+'</div>'+sys.positions.map(p=>'<div class="irow" data-act="posInfo" data-id="'+p.id+'"><b>'+esc(p.title)+'</b> <span class="tag gold">'+rankShort(RANK_INFO[p.rank].title)+'</span></div>').join('')});
  UI.showInfo(UT('pos.listTitle'),h);
};
/** 顯示貿易物品說明（資料來自 COMM_INFO，以物品代號為鍵）。 */
ACT.commInfo=el=>{
  const n=el.dataset.n,c=COMM_MAP[n],i=COMM_INFO[n];if(!c||!i)return;
  UI.showInfo(UT('ci.title',{n:c.short}),'<div class="small"><span class="tag">'+NM('kind',c.kind)+'</span> <span class="tag gray">'+esc(i.origin_type)+'</span>'+(c.flam?' <span class="tag red">'+UT('mk.flam')+'</span>':'')+'</div>'
   +ik(UT('ci.sys'),i.system_name)+ik(UT('ci.sysDesc'),i.system_desc)+ik(UT('ci.full'),i.name)+ik(UT('ci.unit'),i.unit)+'<div class="ik">'+UT('ci.base')+'</div><div class="iv">'+UT('ci.baseVal',{p:fmt1(c.base),d:(c.decay*100).toFixed(1)})+'</div>'
   +ik(UT('ci.regions'),(i.primary_regions||[]).join(NAMES_SEP))+ik(UT('ci.season'),i.seasonal_traits)+ik(UT('ci.vol'),i.price_volatility)+ik(UT('ci.demand'),i.demand_strata)+ik(UT('ci.decay'),i.decay_rate)+ik(UT('ci.contra'),i.contraband_status)+ik(UT('ci.cartel'),i.cartel_potential));
};
/** 物品旁的『ⓘ說明』按鈕。 */
const infoBtn=n=>'<span class="ibtn" data-act="commInfo" data-n="'+esc(n)+'">'+UT('ci.btn')+'</span>';

/* ---------- 出貨預設＝本期有效協議配額；未按「出貨」，推進一旬時自動出貨 ---------- */
/** 某物品本旬的預定出貨量：預設＝本期有效協議配額（正常供應時即穩定供貨線），不超過庫存，可被滑桿覆蓋（存在 G.plan）。 */
function planOf(name){
  const have=G.inv[name]||0;G.plan=G.plan||{};
  if(G.plan[name]===undefined)G.plan[name]=Math.min(quotaOf(name),have);   // 預設照本旬配額
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
       已參加協議（守約或暗約）、配額低於供貨線、而你已出到配額（含超賣）＝同業壓貨波及（刻意保留的守約代價，旬報另列）；其餘（含未參加協議）＝出貨不足 */
    const line=supplyLine(c.name);if(line>0)judged++;
    if(line>0&&shipped<line){(guildMember()&&quota<line&&shipped>=quota?squeeze:short).push(c.short);allMet=false}   // 未參加協議沒有配額約束，一律算出貨不足
  });
  /* 穩定供貨：全部商品出貨量達穩定供貨線 → 知名度 +1～3；有商品未達 → -1～3 */
  if(short.length||squeeze.length){rep.fame=-(1+Math.floor(rnd()*3));rep.short=short;rep.squeeze=squeeze}   // 兩種扣分相同
  else if(allMet&&judged>0)rep.fame=1+Math.floor(rnd()*3);   // 沒有任何一項貨的供貨線 ≥1：這一旬不判定
  rep.supplyStable=judged>0&&allMet;               // 季度人口：全品項達線才記為穩定供貨旬
  const stableUp=rep.fame>0;
  if(rep.fame>0){const f0=G.fame||0;rep.fame=Math.round(Math.max(0,Math.min(rep.fame,ODDS.fame.gate-f0))*10)/10;if(!rep.fame)rep.fameGate=true}   // 穩定供貨是小事件：到門檻（125）就不再加
  if(rep.fame)setFame((G.fame||0)+rep.fame);
  if(stableUp){G.mybias=Math.min(4,(G.mybias||1)*(1+0.01*rep.fame));rep.shareUp=true}   // 穩定供貨：市佔率微幅增加
  if(rep.ship.length){const t=NEWS('autoShip.1',{rev:rep.ship.map(x=>x.n+'×'+x.q+UT('mk.revParen',{a:fmt(x.rev)})).join(NAMES_SEP)});log.push(t);pushNews(t)}
  TURNRP=rep;
  delete G.lastShip;delete G.lastBuy;              // 舊存檔：大番頭延續的數字不再使用
  G.plan={};G.sold={};
}

/* ---------- 拉霸兩側的加減鈕：每按一下照拉霸的單位加減（進出貨 1 單位、委託金 50 兩）；按住約半秒後連續加減 ---------- */
/** 把拉霸包成「［－］拉霸［＋］」；decOff／incOff＝初始是否變灰。 */
function stepRow(input,id,decOff,incOff){
  const b=(d,off)=>'<button class="pixel-btn btn-sm step-btn" style="min-width:36px" data-step="'+id+'" data-d="'+d+'" '+(off?'disabled':'')+'>'+UT(d<0?'step.dec':'step.inc')+'</button>';
  return '<div class="row step-row" style="gap:6px;align-items:center">'+b(-1,decOff)+input.replace('type="range"','type="range" style="flex:1;min-width:0"')+b(1,incOff)+'</div>';
}
/** 依拉霸目前的值與上下限，更新兩側按鈕是否可按。 */
function stepSync(){
  document.querySelectorAll('.step-row').forEach(row=>{
    const inp=row.querySelector('input[type=range]');if(!inp)return;const v=+inp.value;
    row.querySelectorAll('[data-step]').forEach(bt=>{bt.disabled=inp.disabled||(+bt.dataset.d<0?v<=+inp.min:v>=+inp.max)});
  });
}
/** 加減一格：改拉霸的值並觸發原本的 input 處理。 */
function stepOnce(bt){
  const inp=document.getElementById(bt.dataset.step);if(!inp||inp.disabled)return false;
  const st=+inp.step||1,nv=Math.max(+inp.min,Math.min(+inp.max,+inp.value+st*(+bt.dataset.d)));
  if(nv===+inp.value)return false;
  inp.value=nv;inp.dispatchEvent(new Event('input',{bubbles:true}));return true;
}
let STEP_T=null;
const stepStop=()=>{if(STEP_T){clearTimeout(STEP_T);clearInterval(STEP_T);STEP_T=null}};
document.addEventListener('pointerdown',e=>{
  const bt=e.target.closest('[data-step]');if(!bt||bt.disabled)return;
  e.preventDefault();stepStop();if(!stepOnce(bt))return;sfx.tap&&sfx.tap();
  STEP_T=setTimeout(()=>{STEP_T=setInterval(()=>{const b2=document.querySelector('[data-step="'+bt.dataset.step+'"][data-d="'+bt.dataset.d+'"]');if(!b2||!stepOnce(b2))stepStop()},80)},450);
});
['pointerup','pointercancel','pointerleave','blur'].forEach(ev=>document.addEventListener(ev,stepStop,true));
document.addEventListener('input',e=>{if(e.target&&e.target.type==='range')stepSync()});
