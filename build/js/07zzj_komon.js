'use strict';
/* ★檔案總覽：木戶黃門（DESIGN_NOTES 第二百三十二、二百五十二節）
 * - 目前只做年度傳聞：每年一次，「傳聞木戶黃門大人在某城懲戒了惡德商人某某」。地點依你的惡德值（G.evil.v）靠近：
 *   0～9 別的地區；10～19 本地區的另一座城；20 以上離本城最近的三座城之一（寫成本城附近的驛站）。
 * - 被懲戒的是那座城一位你不認識的同業，只是敘事、不改他的數值；他的外人風評多一句（rumorsOf），下一期番付八卦寫一則。
 * - 排程：新年結算時（或這一年還沒排、開局、舊存檔時）從今年剩下的旬裡隨機挑一旬，避開例會旬、本城節慶與大名行列（G.komonR{y,m,c,done}）。
 * - 每季判定、宣判演出與懲罰見本檔下半（第二百五十八節）。數值 ODDS.komonRumor；文字 komon.*（01g 新聞、01e 八卦）、台詞 LINES.rumor.komon。 */
/** 今年的傳聞旬（還沒排就排）。 */
function komonPlan(){
  if(G.komonR&&G.komonR.y===G.year)return;
  const f=homeCity().special_festival,D=G.daimyo&&G.daimyo.y===G.year?G.daimyo:null,L=[];
  for(let m=G.month;m<=12;m++)for(let c=1;c<=3;c++){
    if(m===G.month&&c<=G.cycle)continue;                        // 從下一旬起
    if(isMeetingDate(m,c)||(f&&f.month===m&&f.cycle===c)||(D&&D.m===m&&D.c===c))continue;
    L.push([m,c]);
  }
  const p=L.length?pick(L):null;
  G.komonR=p?{y:G.year,m:p[0],c:p[1],done:false}:{y:G.year,done:true};
}
/** 找一座城與一位被懲戒的同業。回傳 {ct,cid,near} 或 null。 */
function komonPick(){
  const O=ODDS.komonRumor,v=(G.evil&&G.evil.v)||0,home=homeCity();
  const ok=n=>alive(n.cid)&&!n.hired&&!G.known.includes(n.cid)&&!(G.rel[n.cid]&&(G.rel[n.cid].bond||G.rel[n.cid].met));
  const cands=ct=>cityNpcs(ct.id,'rival').filter(ok);
  let cities,near=false;
  const others=CITIES.filter(ct=>ct.id!==home.id);
  if(v>=O.near){const S=others.slice().sort((a,b)=>distKm(a,home)-distKm(b,home));cities=shuffle(S.slice(0,O.nearN)).concat(S.slice(O.nearN));near=true}   // 最近的幾座城輪流，不老是同一座
  else if(v>=O.region)cities=shuffle(others.filter(ct=>ct.region_id===home.region_id));
  else cities=shuffle(others.filter(ct=>ct.region_id!==home.region_id));
  for(const ct of cities){const L=cands(ct);if(L.length)return {ct,cid:pick(L).cid,near}}
  return null;
}
/** 每旬（日期前進之後）：到了傳聞旬就上旬報與瓦版。 */
function komonTick(log){
  komonPlan();
  const K=G.komonR;if(!K||K.done||K.m!==G.month||K.c!==G.cycle)return;
  K.done=true;
  const P=komonPick();if(!P)return;
  (G.komonHit=G.komonHit||[]).push(P.cid);if(G.komonHit.length>30)G.komonHit.shift();
  G.komonBz={cid:P.cid,city:P.ct.name,t:G.turn};
  const t=NEWS(P.near?'komon.rumor.near':'komon.rumor',{c:P.ct.name,m:nameOf(P.cid)});pushNews(t);log.push(t);
}
/** 外人風評：被傳聞點名過的同業多一句。 */
{const _r=rumorsOf;rumorsOf=function(cid){const out=_r.apply(this,arguments);
  if(G&&G.komonHit&&G.komonHit.includes(cid))out.push({txt:LINES.rumor.komon,src:LINES.rumor.src.komon,cred:1,truth:true});
  return out}}
/** 番付八卦：這一期有傳聞，就寫一則。 */
{const _g=bzGossip;bzGossip=function(){const out=_g.apply(this,arguments),L=bzLast(),B=G.komonBz;
  if(B&&B.t>(L?L.turn:-1)&&npc(B.cid)&&!out.some(g=>g.key==='komon')){if(out.length>=BZ().gossip[1])out.pop();out.push({key:'komon',about:[B.cid],truth:true,c:B.city})}
  return out}}

/* ======================= 宣判與懲罰（第二百三十二、二百五十八節） =======================
 * - 判定：開局滿兩年後，每季第一旬（例會旬）推進時、例會自動決議之後判定（advanceTurn 在 meetingAuto 後呼叫 komonJudge）；
 *   機率（%）＝惡德值，沒有上限。遠島、臥病期間照樣判定。
 * - 懲罰當場生效（同一次推進裡其他系統照新的處境跑：合約交不出就照各自的規則失約）。
 * - 演出：推進的轉場之後、旬報之前，全畫面捲動漫畫（IMG_KOMON），三格三段說明，再一段查抄結果（G.komonShow，看完才清掉）。
 * - 清掉家業的部分寫成 houseStrip，日後遷居「清掉舊城」可沿用。
 * - 數值 ODDS.komon；台詞 LINES.komon；文字 km.*、komon.judge。 */
const KOMON_PANEL=[{top:0.032,cap:0.343},{top:0.345,cap:0.607},{top:0.576,cap:0.970},{top:0.576,cap:0.970}];   // 漫畫三格的位置（佔整張高度的比例）：top 捲到哪裡、cap 說明框從哪裡開始
/** 惡德紀錄的一句：「某年某月某旬，你……」 */
function evilLine(x){
  const y0=3*3-3+x.t,y=Math.floor(y0/36),m=Math.floor((y0%36)/3)+1,c=y0%3+1;   // 開局是 0 年 3 月上旬
  const L=LINES.komon.crime[x.k]||[];
  return UT('km.crime',{d:dateOf(y,m,c),x:String(L[x.h&&L[1]?1:0]||'').replace('{n}',x.c?nameOf(x.c):UT('km.someone'))});
}
/** 清掉家業：許可與資格、倉庫、員工、在途航程、違禁品與他行貨、本業貨只留少量。 */
function houseStrip(keepTurns,keepShare){
  G.lic={wh:0,ship:0,horse:0,guard:0,staff:0};G.trade=[];G.lessen=0;G.permits={sea:{},land:{}};
  Object.keys(G.flags||{}).forEach(k=>{if(k!=='info')G.flags[k]=typeof G.flags[k]==='boolean'?false:0});   // 減罪、火除地、限期請託、舊存檔的通行狀與通商特許
  G.mono=null;G.apps=[];
  G.wh.n=1;G.guards=0;
  G.emps=[];G.ships=[];G.smug=[];G.contra={};G.xinv={};G.orders=[];
  chumonList().forEach(o=>{if(o.sent){o.sent=false;o.until=G.turn-1}});   // 已送出的注文跟著航程沒了：這一旬照規則失約
  Object.keys(G.inv||{}).forEach(k=>{
    const c=COMM_MAP[k],m=G.mk[k];
    const keep=c&&c.sys===G.sysKey&&!lockedTrade().includes(k)&&m?Math.round((m.D||0)*keepShare*keepTurns):0;
    G.inv[k]=Math.min(G.inv[k]||0,keep);if(G.inv[k]<=0)delete G.inv[k];
  });
}
/** 例會旬推進時判定。 */
function komonJudge(log){
  if(!G||G.ended||!isMeetingDate(G.month,G.cycle)||G.turn<ODDS.komon.after)return;
  const v=(G.evil&&G.evil.v)||0;if(v<=0||!chance(v/100))return;
  komonPunish(log);
}
/** 宣判：記下演出要用的內容，然後查抄。 */
function komonPunish(log){
  const O=ODDS.komon,E=evilOf(),w=x=>(ODDS.evil[x.k]||0)*(x.h?ODDS.evil.failMul:1);
  const read=E.log.map((x,i)=>({x,i})).sort((a,b)=>w(b.x)-w(a.x)||b.i-a.i).slice(0,O.read).sort((a,b)=>a.i-b.i).map(o=>evilLine(o.x));
  const S={t:G.turn,read,more:Math.max(0,E.log.length-read.length),met:E.met||null,gm:gmIsMe(),member:guildMember(),gold:Math.max(0,G.gold||0)};
  if(S.gm){const f=gmFineNow(),t=NEWS('komon.gmOut')+(f||'')+gmSucceed('me');pushNews(t);log.push(t)}   // 公會長當場卸任，沒報告的得標金照罰（先罰，再查抄現款）
  if(G.silver>0)payPublic('spend.komon',G.silver-Math.floor(G.silver*O.cashKeep));   // 旬報列在「木戶黃門查抄」
  S.cash=G.silver;G.gold=0;
  G.fame=0;G.fameFloor=0;
  if(S.member)guildForfeit();G.cartel.state='none';
  houseStrip(O.keepTurns,O.keepShare);
  delete G.mybias;G.shareMem=null;G.shareEst=false;G.share=marketShares();   // 市佔回到新人的 5%
  G.heat=0;addStress('komonJudge',O.stress);
  G.evil={v:0,log:[]};
  G.komonShow=S;G.komonMe={t:G.turn};
  const t=NEWS('komon.judge',{f:G.firm});pushNews(t);log.push(t);
}
/* ---------- 演出：捲動漫畫 ---------- */
function komonStepText(S,i){
  const L=LINES.komon,p=s=>'<p>'+s+'</p>';
  if(i===0)return p(L.come)+p('<b>'+L.come2+'</b>');
  if(i===1)return p(L.inro)+p('<b>'+L.inro2+'</b>')+p(L.inro3);
  if(i===2)return p(L.read)+S.read.map(x=>p('<b>'+x+'</b>')).join('')+(S.more?p('<b>'+UT('km.more',{a:S.more})+'</b>'):'')+(S.met&&L.met[S.met]?p('<b>'+L.met[S.met]+'</b>'):'')+p('<b>'+L.verdict+'</b>');
  const B=[(S.cash<0?UT('km.r.cashNeg',{a:fmt(-S.cash)}):UT('km.r.cash',{a:fmt(S.cash)}))+(S.gold?UT('km.r.gold'):''),UT('km.r.lic'),UT('km.r.staff'),UT('km.r.goods')];
  if(S.gm)B.push(UT('km.r.gm'));
  if(S.member)B.push(UT('km.r.guild'));
  return p(L.after)+'<div class="km-list">'+B.map(x=>'<div>· '+x+'</div>').join('')+'</div>'+p(L.end);
}
/** 全畫面演出；看完呼叫 done。 */
function showKomon(done){
  const S=G.komonShow;if(!S){if(done)done();return}
  let el=$('#komon');if(el)el.remove();
  el=document.createElement('div');el.id='komon';
  el.innerHTML='<div class="km-stage"><img class="km-img" alt="" src="'+IMG_KOMON+'"><div class="km-cap"><div class="km-txt"></div><button class="pixel-btn km-btn" type="button"></button></div></div>';
  document.body.appendChild(el);
  const stage=el.querySelector('.km-stage'),img=el.querySelector('.km-img'),cap=el.querySelector('.km-cap'),txt=el.querySelector('.km-txt'),btn=el.querySelector('.km-btn');
  let i=0,busy=false;
  const layout=first=>{
    const w=stage.clientWidth,h=w*964/720,P=KOMON_PANEL[i],y=Math.max(0,P.top*h-8);
    img.style.transform='translateY('+(-y)+'px)';cap.style.top=Math.round(P.cap*h-y+4)+'px';
    if(first){img.style.transition='none';cap.style.transition='none';void img.offsetWidth;img.style.transition='';cap.style.transition=''}
  };
  const fill=()=>{txt.innerHTML=komonStepText(S,i);btn.textContent=UT(i<3?'km.next':'km.rise');cap.scrollTop=0};
  const go=()=>{
    if(busy)return;
    if(i>=3){el.remove();G.komonShow=null;save();window.removeEventListener('resize',rs);if(done)done();return}
    busy=true;txt.style.opacity=0;btn.style.opacity=0;
    setTimeout(()=>{i++;layout();if(i===1)sfx.fanfare();if(i===2)sfx.bad();
      setTimeout(()=>{fill();txt.style.opacity=1;btn.style.opacity=1;busy=false},i===3?250:900)},250);
  };
  const rs=()=>layout(true);window.addEventListener('resize',rs);
  btn.addEventListener('click',e=>{e.stopPropagation();go()});
  layout(true);fill();
}
/** 推進之後先看宣判，再看旬報（重開上一份旬報時不演）。 */
{const _tr=showTurnReport;showTurnReport=function(reps,logs,n,kind){
  if(G&&G.komonShow&&!kind){const a=arguments,self=this;showKomon(()=>_tr.apply(self,a));return}
  return _tr.apply(this,arguments);
}}
/** 番付八卦：被懲戒的那一期一定寫一則。 */
{const _g=bzGossip;bzGossip=function(){const out=_g.apply(this,arguments),L=bzLast(),K=G.komonMe;
  if(K&&K.t>(L?L.turn:-1)&&!out.some(g=>g.key==='komonMe')){if(out.length>=BZ().gossip[1])out.pop();out.unshift({key:'komonMe',about:['me'],truth:true})}
  return out}}
