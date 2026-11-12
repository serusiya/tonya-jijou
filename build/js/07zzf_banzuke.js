'use strict';
/* =====================================================================
 * 07zzf_banzuke.js — 商人番付與花邊八卦（DESIGN_NOTES 第二百零九、二百十一節）
 *  - 每季最後一旬（2、5、8、11 月下旬）推進後發行一期，旬報之後跳出「瓦版號外」。不影響規則與知名度；
 *    你第一次進榜、第一次登上大關（兩欄各算）寫進城史。
 *  - 上榜的人：你、本城同業大手、本城旅商人。分「身代」「名望」兩欄，各取前十名（大關、關脇、小結、前頭）。
 *    畫面不寫數字，只寫名次升降，以及你和上一位（或榜尾）差多少（只差一步／還差一截／差得還遠）。
 *  - 身代：你＝現款＋本業庫存（按收市價）－借款（私房錢不算）。
 *          同業＝開局依知名度與存貨定出，每季依市佔漲跌，本季事件（失火、遭竊、船難、被查獲、株札暫扣…）直接增減。
 *          旅商＝開局隨機，每季抽一次行商結果（大賺～遇劫）；向你收購他行貨或換貨賺到的差額，下一季記入。
 *  - 名望：你＝知名度；同業＝市佔模擬裡的知名度；旅商＝同業公式打折，每季小幅漂移，和你做成生意略增。
 *  - 花邊八卦：每期三、四則，約七成是真的（取材自實際狀態），其餘是把事套到別人身上或私事傳聞；不標真假。
 *  - 話題：到下一期之前，同業、旅商拜訪開場（約三成）與例會問候會提到番付與八卦；同一人一期最多說一次。
 *  狀態：G.bzEv{鍵:{事件:次數}}（本季事件）、G.bz=[期]（最近四期）、G.bzShow（待顯示）、G.bzAch（已記入城史的成就）、
 *        G.bzBuy{cid:貨名}（本季向你收貨的旅商）；人物上 n.bzw（身代）、n.bzf（旅商名望）、n.bzPend（旅商待入帳）、n.bzTrip（旅商本季行商）。
 *  文字 bz.*（01e、01g）、LINES.bz（01d）。數值 ODDS.bz。
 * ===================================================================== */
const BZ=()=>ODDS.bz;
const bzList=()=>{if(!G.bz)G.bz=[];if(G.bz.length&&!G.bz[0].w)G.bz=[];return G.bz};   // 舊格式（單欄）的期數直接作廢
const bzLast=()=>bzList()[0]||null;
/** 記下本季發生在某家（'me' 或 cid）的事。 */
function bzNote(k,ev){if(!G||!k)return;const E=G.bzEv||(G.bzEv={});const o=E[k]||(E[k]={});o[ev]=(o[ev]||0)+1}

/* ---------- 記錄點 ---------- */
{const _h=rivalEventHook;rivalEventHook=function(n,good,bad,log){if(n)bzNote(n.cid,good?'haul':bad);return _h.apply(this,arguments)}}
{const _c=caughtAdd;caughtAdd=function(key){bzNote(key,'caught');return _c.apply(this,arguments)}}
{const _l=lossNote;lossNote=function(kind,value,item){if(value>0)bzNote('me',kind==='cargo'?'wreck':kind);return _l.apply(this,arguments)}}
{const _g=gmInstall;gmInstall=function(k,other,elect){if(elect)bzNote(k,'gm');return _g.apply(this,arguments)}}
{const _a=meetAuction;meetAuction=function(myBid){const M=meetNow(),had=M&&M.res;const r=_a.apply(this,arguments);if(!had&&r&&r.who)bzNote(r.who,'lot');return r}}
{const _s=REG_FAVOR.suspend;REG_FAVOR.suspend=function(n,arg){const r=_s.apply(this,arguments);if(arg&&suspended(npc(arg)))bzNote(arg,'susp');return r}}
/** 旅商向你收購他行貨：基準價減去他付的錢，就是他轉手的利潤。 */
{const _d=dealerDo;dealerDo=function(cid,k){
  const isX=typeof k==='string'&&k.startsWith('xs_'),name=isX?k.slice(3):null,q=isX?((G.xinv||{})[name]||0):0,s0=G.silver;
  const out=_d.apply(this,arguments);
  if(isX&&q>0&&!((G.xinv||{})[name]>0)&&COMM_MAP[name])bzDeal(cid,q*COMM_MAP[name].base-(G.silver-s0),name);
  return out;
}}
/** 旅商換貨：兩邊貨值的差額，記給他（他多拿就是賺）。 */
{const _y=ACT.swapYes;ACT.swapYes=function(){
  const o=G.swapOffer,ok=o&&(G.xinv||{})[o.give]>=o.gq;
  const out=_y.apply(this,arguments);
  if(ok&&!G.swapOffer&&COMM_MAP[o.give]&&COMM_MAP[o.get])bzDeal(o.cid,o.gq*COMM_MAP[o.give].base-o.getq*COMM_MAP[o.get].base,o.give);
  return out;
}}
function bzDeal(cid,gain,name){
  const n=npc(cid);if(!n||n.role!=='guest')return;
  bzInit(n);if(gain>0)n.bzPend=(n.bzPend||0)+Math.round(gain);
  n.bzf=clamp(n.bzf+rint(BZ().gs.dealFame[0],BZ().gs.dealFame[1]),0,ODDS.fame.cap*0.95);
  (G.bzBuy||(G.bzBuy={}))[cid]=name;bzNote(cid,'buy');
}
/** 同業過世，繼承人接下大部分身代。 */
{const _r=rivalHeirTick;rivalHeirTick=function(log){
  const out=_r.apply(this,arguments);
  Object.values(G.world.npcs).forEach(n=>{if(n.heir&&n.bzw&&!n.bzHeirDone){const h=npc(n.heir);n.bzHeirDone=true;if(h&&h.bzw===undefined)h.bzw=Math.round(n.bzw*BZ().rv.heir)}});
  return out;
}}

/* ---------- 身代與名望 ---------- */
/** 身代的基準：本行業開局現款。 */
const bzBase=()=>{const t=START_TIERS[G.startTier||0];return (t&&t.silver)||10000};   // 本局開局資源等級的開局現款
const bzRand=a=>a[0]+rnd()*(a[1]-a[0]);
function bzInit(n){
  if(n.bzw===undefined){
    if(n.role==='guest')n.bzw=Math.round(bzBase()*bzRand(BZ().gs.init));
    else{const m=msOf(n),f=clamp((m.fame/ODDS.fame.cap+m.stock/1.5)/2,0,1),R0=BZ().rv.init;n.bzw=Math.round(bzBase()*(R0[0]+(R0[1]-R0[0])*f)*(0.9+0.2*rnd()))}
  }
  if(n.role==='guest'&&n.bzf===undefined){const st=CH(n.cid).derived_stats;n.bzf=((0.4*(st.commerce_skill+st.integrity_loyalty)/2+0.15*st.diplomacy_charm*0.6)/0.55)*ODDS.fame.cap/100*BZ().gs.fame}
  return n;
}
function bzWorth(k){
  if(k==='me'){
    const inv=Object.keys(G.inv||{}).reduce((s,x)=>s+(G.inv[x]||0)*(((G.mk||{})[x]&&G.mk[x].lastClose)||(COMM_MAP[x]&&COMM_MAP[x].base)||0),0);
    return (G.silver||0)+inv-(G.debts||[]).reduce((s,d)=>s+(d.paid?0:d.amt||0),0);
  }
  const n=npc(k);return n?bzInit(n).bzw:0;
}
function bzFame(k){
  if(k==='me')return G.fame||0;
  const n=npc(k);if(!n)return 0;
  return n.role==='guest'?bzInit(n).bzf:msOf(n).fame;
}
/** 上榜候選：你、本城在世的同業與旅商（被雇用、下獄的不算）。 */
function bzPool(){
  return ['me'].concat(cityNpcs(G.cityId).filter(n=>(n.role==='rival'||n.role==='guest')&&!n.hired&&!jailed(n)).map(n=>n.cid));
}
/** 季末結算：同業依市佔與事件、旅商依行商結果與向你收貨的利潤，增減身代；旅商名望漂移。 */
function bzGrow(){
  const keys=bzPool().filter(k=>k!=='me'),rv=rivalsHere().filter(n=>alive(n.cid)),avg=1/Math.max(1,rv.length+1),B=bzBase();
  keys.forEach(k=>{
    const n=bzInit(npc(k)),E=(G.bzEv||{})[k]||{};
    if(n.role==='rival'){
      const P=BZ().rv;let g=P.g0+P.share*(gmShare(k)-avg)+(rnd()*2-1)*P.noise;
      Object.keys(E).forEach(ev=>{g+=(P.ev[ev]||0)*E[ev]});
      n.bzw=Math.round(clamp(n.bzw*(1+g),B*P.min,B*P.max));
    }else{
      const P=BZ().gs,T=P.trip,tot=T.reduce((s,t)=>s+t.w,0);let r=rnd()*tot,t=T[0];
      for(const x of T){r-=x.w;if(r<=0){t=x;break}}
      n.bzTrip=t.k;n.bzw=Math.round(clamp(n.bzw*(1+bzRand(t.r))+(n.bzPend||0),B*P.min,B*P.max));n.bzPend=0;
      n.bzf=clamp(n.bzf+(rnd()*2-1)*P.fameDrift,5,ODDS.fame.cap*0.95);
    }
  });
}

/* ---------- 番付 ---------- */
/** 第 i 名的位階代號：0 大關、1 關脇、2 小結、3 以上前頭。 */
const bzTier=i=>Math.min(3,i);
/** 依數值排出整欄的順序（鍵的陣列）。 */
const bzOrder=(keys,f)=>keys.map(k=>({k,v:f(k)})).sort((a,b)=>b.v-a.v);
/** 你和上一位（在榜外則和榜尾）差多少：near 只差一步、mid 還差一截、far 差得還遠、top 居首。 */
function bzGap(ord){
  const i=ord.findIndex(x=>x.k==='me');if(i===0)return {i,g:'top'};
  const top=BZ().top,ref=i<top?ord[i-1]:ord[Math.min(top,ord.length)-1],me=ord[i];
  const r=ref&&ref.v>0?me.v/ref.v:1,G2=BZ().gap;
  return {i,g:r>=G2[0]?'near':r>=G2[1]?'mid':'far'};
}
/** 一列的評語代號（只給大關與有事的人）。 */
function bzComment(k,i,prev,first){
  const E=(G.bzEv||{})[k]||{},n=k==='me'?null:npc(k);
  if(E.gm)return 'gm';
  if(E.caught)return 'caught';
  if(E.susp)return 'susp';
  if((E.fire||0)+(E.theft||0)+(E.wreck||0)>=2)return 'unlucky';
  if(E.fire)return 'fire';
  if(n&&n.role==='guest'&&n.bzTrip==='big')return 'gBig';
  if(n&&n.role==='guest'&&n.bzTrip==='rob')return 'gRob';
  if(E.buy)return 'gBuy';
  if(E.lot)return 'lot';
  if(prev!==null&&prev-i>=3)return 'rise';
  if(prev!==null&&i-prev>=3)return 'fall';
  if(E.haul)return 'haul';
  if(i===0&&prev===0)return 'top';
  if(prev===null&&!first)return 'new';
  return i===0?pick(['plain','steady']):null;
}
/** 花邊八卦：先列出真的，再依比例換成假的。 */
function bzGossip(){
  const rv=rivalsHere().filter(n=>alive(n.cid)),gs=cityNpcs(G.cityId,'guest').filter(n=>!n.hired),L=bzLast(),out=[];
  const prevSh=k=>L&&L.sh&&L.sh[k]!==undefined?L.sh[k]:null;
  const T=[];                                                   // 真的：{key,about,c?}
  const dsh=rv.map(n=>({c:n.cid,d:gmShare(n.cid)-(prevSh(n.cid)??gmShare(n.cid))})).sort((a,b)=>b.d-a.d);
  if(dsh.length&&dsh[0].d>0.01)T.push({key:'boom',about:[dsh[0].c]});
  if(dsh.length&&dsh[dsh.length-1].d<-0.01)T.push({key:'slump',about:[dsh[dsh.length-1].c]});
  rv.forEach(n=>{if(n.ms&&n.ms.stock<0.75)T.push({key:'lowStock',about:[n.cid]})});
  for(let i=0;i<rv.length;i++)for(let j=i+1;j<rv.length;j++){const m=compat(rv[i].cid,rv[j].cid).matches;if(m===0)T.push({key:'feud',about:[rv[i].cid,rv[j].cid]});else if(m>=2)T.push({key:'close',about:[rv[i].cid,rv[j].cid]})}
  gs.forEach(n=>{if(n.bzTrip==='big')T.push({key:'gBig',about:[n.cid]});if(n.bzTrip==='rob')T.push({key:'gRob',about:[n.cid]})});
  Object.keys(G.bzBuy||{}).forEach(c=>{if(npc(c)&&COMM_MAP[G.bzBuy[c]])T.push({key:'gBuy',about:[c,'me'],c:xName(G.bzBuy[c])})});
  if(G.month===2){const p=gmPool(),sh=gmShare,c=p.slice().sort((a,b)=>gmScore(a)-gmScore(b)||sh(b)-sh(a)).slice(0,2);if(c.length===2)T.push({key:'cands',about:c})}
  if((G.heat||0)>=BZ().heatGossip)T.push({key:'meHeat',about:['me']});
  const fl=(G.flower&&G.flower.spent)||0,fl0=G.bzFlower||0;if(fl-fl0>=BZ().flowerGossip)T.push({key:'meFlower',about:['me']});G.bzFlower=fl;
  if(gmIsMe())T.push({key:'meGm',about:['me']});
  if(G.wifeGone&&G.wifeGone.t>(L?L.turn:-1))T.push({key:'meWife',about:['me']});   // 夫人離家出走（07zzh_wife.js）
  const n=Math.min(rint(BZ().gossip[0],BZ().gossip[1]),Math.max(1,new Set(T.map(g=>g.key)).size));
  const seen=new Set(),U=shuffle(T).filter(g=>!seen.has(g.key)&&seen.add(g.key));   // 同一種八卦一期只出一則
  const sameKind=c=>{const r=npc(c)&&npc(c).role;return (r==='guest'?gs:rv).map(x=>x.cid)};
  U.slice(0,n).forEach(g=>{
    if(chance(BZ().falseP)){                                     // 假的：套到同身分的別人身上，或同業私事傳聞
      const others=g.about.length===1&&g.about[0]!=='me'?sameKind(g.about[0]).filter(c=>!g.about.includes(c)):[];
      if(others.length&&chance(0.5)){out.push(Object.assign({},g,{about:[pick(others)],truth:false}));return}
      const c=rv.length?pick(rv).cid:null;if(c){out.push({key:'private',about:[c],truth:false,v:rint(0,LINES.bz.private.length-1)});return}
    }
    out.push(Object.assign({truth:true},g));
  });
  if(T.some(g=>g.key==='meWife')&&!out.some(g=>g.key==='meWife')){if(out.length>=BZ().gossip[0])out.pop();out.unshift({key:'meWife',about:['me'],truth:true})}   // 夫人離家一定上八卦
  while(out.length<BZ().gossip[0]&&rv.length){out.push({key:'private',about:[pick(rv).cid],truth:false,v:rint(0,LINES.bz.private.length-1)})}
  return out;
}
const bzDate=I=>UT('bz.date',{y:yearStr(I.y),d:dateLabel({year:I.y,month:I.m,cycle:3})});
const bzWho=k=>k==='me'?gmName('me'):nameOf(k);
function bzGossipText(g){
  const v={a:bzWho(g.about[0]),b:g.about[1]?bzWho(g.about[1]):'',c:g.c||''};
  if(g.key==='private')return String(LINES.bz.private[g.v||0]).replace(/\{(\w+)\}/g,(m,k)=>v[k]!==undefined?v[k]:m);
  return UT('bz.g.'+g.key,v);
}
/** 排一欄：回傳前十名的列與整欄順序。 */
function bzColumn(keys,f,prevAll,first){
  const ord=bzOrder(keys,f),all=ord.map(x=>x.k);
  const rows=ord.slice(0,BZ().top).map((x,i)=>{
    const p=prevAll?prevAll.indexOf(x.k):-1,prev=p>=0?p:null;
    return {k:x.k,i,prev,tier:bzTier(i),g:x.k!=='me'&&npc(x.k)&&npc(x.k).role==='guest'?1:0,c:bzComment(x.k,i,prev,first)};
  });
  return {rows,all,me:bzGap(ord)};
}
/** 發行一期。 */
function bzPublish(log){
  bzGrow();
  const L=bzLast(),first=!L,keys=bzPool();
  const W=bzColumn(keys,bzWorth,L&&L.wAll,first),F=bzColumn(keys,bzFame,L&&L.fAll,first);
  const sh={};rivalsHere().forEach(n=>{sh[n.cid]=gmShare(n.cid)});
  const issue={turn:G.turn,y:G.year,m:G.month,w:W.rows,f:F.rows,wAll:W.all,fAll:F.all,meW:W.me,meF:F.me,sh,gossip:bzGossip(),said:{},first};
  bzList().unshift(issue);if(bzList().length>BZ().keep)bzList().length=BZ().keep;
  G.bzEv={};G.bzBuy={};G.bzShow=true;
  const t=NEWS('bz.out');pushNews(t);log.push(t);
  // 成就：兩欄各記第一次進榜、第一次登上大關
  const A=G.bzAch||(G.bzAch={}),f=gmName('me'),ct=homeCity();
  [['w',W.me],['f',F.me]].forEach(([c,m])=>{
    const col=UT('bz.col.'+c);
    [['10',m.i<BZ().top,'bz.in'],['1',m.i===0,'bz.top']].forEach(([s,ok,key])=>{
      if(!ok||A[c+s])return;A[c+s]=true;
      G.cityHist=G.cityHist||{};(G.cityHist[ct.id]=G.cityHist[ct.id]||[]).push({year:G.year,title:NEWS(key+'Hist',{f,c:col})});
      const t2=NEWS(key+'News',{f,c:col});pushNews(t2);log.push(t2);
    });
  });
}
/** 每旬：季末最後一旬發行。 */
function bzTick(log){if(G.cycle===3&&G.month%3===2)bzPublish(log)}

/* ---------- 畫面 ---------- */
const BZ_FS=['18px','15px','15px'];
function bzColHtml(I,c){
  const rows=I[c],arrow=r=>I.first?'':r.prev===null||r.prev>=BZ().top?UT('bz.new'):r.prev>r.i?UT('bz.up',{n:r.prev-r.i}):r.prev<r.i?UT('bz.down',{n:r.i-r.prev}):UT('bz.same');
  let h='<div style="min-width:0"><div class="small bold" style="text-align:center;border-bottom:2px solid #2a2420;margin-bottom:3px">'+UT('bz.col.'+c)+'</div>';
  rows.forEach(r=>{
    const me=r.k==='me',fs=BZ_FS[r.i]||'13px';
    h+='<div style="display:flex;align-items:baseline;gap:4px;white-space:nowrap;overflow:hidden;line-height:1.5'+(r.i<3?';margin-bottom:2px':'')+'">'
      +'<span class="tiny muted" style="flex:none">'+UT('bz.tier.'+r.tier)+'</span>'
      +'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:'+fs+(r.i<3?';font-weight:bold':'')+(me?';color:#c0281e':'')+'">'+esc(bzWho(r.k))+(r.g?'<span class="tiny muted" style="font-weight:normal">'+UT('bz.guest')+'</span>':'')+'</span>'
      +'<span class="tiny muted" style="flex:none">'+arrow(r)+'</span></div>';
  });
  const m=I[c==='w'?'meW':'meF'];
  h+='<div class="tiny" style="margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#c0281e">'+UT(m.g==='top'?'bz.me.top':m.i<BZ().top?'bz.me.in':'bz.me.out',{g:UT('bz.gap.'+m.g)})+'</div>';
  return h+'</div>';
}
function bzHtml(I){
  let h='<div class="tiny muted" style="text-align:center">'+UT('bz.head',{d:bzDate(I)})+'</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">'+bzColHtml(I,'w')+bzColHtml(I,'f')+'</div>';
  const seen=new Set(),cm=[];
  ['w','f'].forEach(c=>I[c].forEach(r=>{if(r.c&&!seen.has(r.k)){seen.add(r.k);cm.push(r)}}));
  if(cm.length)h+='<div class="small bold" style="margin-top:8px">'+UT('bz.cHead')+'</div>'+cm.slice(0,5).map(r=>'<div class="small" style="margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">·'+UT('bz.cLine',{a:esc(bzWho(r.k)),b:UT('bz.c.'+r.c)})+'</div>').join('');
  h+='<div class="small bold" style="margin-top:8px">'+UT('bz.gossipHead')+'</div>'+I.gossip.map(g=>'<div class="small" style="margin-top:3px;padding-left:1em;text-indent:-1em">·'+esc(bzGossipText(g))+'</div>').join('');
  h+='<div class="tiny muted" style="margin-top:6px">'+UT('bz.foot')+'</div>';
  return h;
}
function bzShowIssue(i,after){
  const I=bzList()[i||0];if(!I)return;
  const pager=bzList().length>1?'<div style="margin-top:6px">'+bzList().map((x,j)=>'<span class="pill '+(j===(i||0)?'on':'')+'" data-act="bzView" data-i="'+j+'">'+esc(bzDate(x))+'</span>').join('')+'</div>':'';
  UI.showInfo(UT('bz.title'),bzHtml(I)+pager+UT('face.buttons'));
}
ACT.bzView=el=>{bzShowIssue(+(el&&el.dataset.i)||0)};
/** 旬報之後先看番付，再接人物事件。 */
{const _af=armFaceEvents;armFaceEvents=function(){
  if(G&&G.bzShow&&bzLast()){G.bzShow=false;INFO_AFTER=()=>{bzShowIssue(0);INFO_AFTER=faceEventQueue().length?showNextFaceEvent:null};return}
  return _af.apply(this,arguments);
}}
{const _g=guildInfoCard;guildInfoCard=function(){return _g.apply(this,arguments)+(bzLast()?'<button class="pixel-btn btn-sm" style="margin-top:4px" data-act="bzView" data-i="0">'+UT('bz.btn')+'</button>':'')}}

/* ---------- 話題：拜訪開場與例會問候 ---------- */
/** 某人在兩欄中名次變化較大的那一欄：{i,prev}；兩欄都不在榜上回傳 null。 */
function bzMove(I,k){
  const a=I.w.find(x=>x.k===k),b=I.f.find(x=>x.k===k),d=r=>r&&r.prev!==null?Math.abs(r.prev-r.i):-1;
  return (d(a)>=d(b)?a:b)||a||b||null;
}
/** 這個人本期還沒說過的番付話題（回傳一句話，沒有則 null）。 */
function bzTopic(cid){
  const I=bzLast();if(!I||I.said[cid]||G.turn-I.turn>BZ().topicTurns)return null;
  const r=bzMove(I,cid),me=bzMove(I,'me'),g=I.gossip.find(x=>x.about.includes(cid)),gm=I.gossip.find(x=>x.about.includes('me'));
  const v={me:gmName('me'),n:r&&r.prev!==null?Math.abs(r.prev-r.i):0,o:g&&g.about.length>1?bzWho(g.about.find(x=>x!==cid)):''};
  const C=[];
  if(g)C.push(g.truth?'gTrue':'gFalse');
  if(r&&r.prev!==null&&r.prev>r.i)C.push('up');
  if(r&&r.prev!==null&&r.prev<r.i)C.push('down');
  if(I.meW.i===0||I.meF.i===0)C.push('meTop');else if(me&&me.prev!==null&&me.prev>me.i)C.push('meUp');
  if(gm)C.push('gMe');
  if(!C.length)return null;
  const k=C[0],line=TX('bz.say.'+k+(isEnemy(cid)&&['meTop','meUp','gMe'].includes(k)?'Foe':''),v);
  if(!line)return null;
  I.said[cid]=true;return UT('bz.quote',{t:line});
}
{const _bs=battleStart;battleStart=function(cid,giftKey){
  _bs.apply(this,arguments);
  const n=npc(cid);if(BT&&n&&!n.pos&&chance(BZ().sayP)){const t=bzTopic(cid);if(t){BT.open=t;battleShow()}}
}}
{const _mt=meetTalk;meetTalk=function(step){
  const M=meetNow(),fresh=M&&!(M.talk&&M.talk[step]);
  const out=_mt.apply(this,arguments);
  if(fresh&&step<=1&&out.length){const x=out.find(o=>!o.foe);if(x){const t=bzTopic(x.cid);if(t)x.t=t}}
  return out;
}}
