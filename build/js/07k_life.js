/* ═════ [07zzf_banzuke] ═════ */
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
  const me=Math.max(1,bzWorth('me')),C=BZ().chase;
  const chase=w=>me>w&&w>0?Math.min(C.cap,C.k*Math.log2(me/w)):0;   // 追趕：你比他有錢，他每季多長一些（第二百七十六節）
  keys.forEach(k=>{
    const n=bzInit(npc(k)),E=(G.bzEv||{})[k]||{};
    if(n.role==='rival'){
      const P=BZ().rv;let g=P.g0+P.share*(gmShare(k)-avg)+(rnd()*2-1)*P.noise+chase(n.bzw);
      Object.keys(E).forEach(ev=>{g+=(P.ev[ev]||0)*E[ev]});
      n.bzw=Math.round(clamp(n.bzw*(1+g),B*P.min,B*P.max));
    }else{
      const P=BZ().gs,T=P.trip,tot=T.reduce((s,t)=>s+t.w,0);let r=rnd()*tot,t=T[0];
      for(const x of T){r-=x.w;if(r<=0){t=x;break}}
      n.bzTrip=t.k;n.bzw=Math.round(clamp(n.bzw*(1+bzRand(t.r)+chase(n.bzw))+(n.bzPend||0),B*P.min,B*P.max));n.bzPend=0;
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

/* ═════ [07zzg_record] ═════ */
'use strict';
/* =====================================================================
 * 07zzg_record.js — 商號紀錄（筆記「📒 紀錄」分頁；DESIGN_NOTES 第二百十二節）
 *  全時期保存，存成精簡的數字陣列：
 *  - G.rec.r 旬報：[日期碼, 收支, 現款, 收入, 支出, (合計旬數)]；每次跳出一般旬報記一筆，重開同一旬不重記。
 *  - G.rec.b 番付：[日期碼, 身代前十, 名望前十, 本號身代名次, 本號名望名次]；人物存成數字（本號 0、旅商取負號）。
 *  - G.rec.t 走勢：[日期碼, 本號身代, 本號知名度]；每期番付記一點。
 *  日期碼＝年×1000＋月×10＋旬。沒有下一代，紀錄只跟著這一局。
 * ===================================================================== */
const recCode=()=>G.year*1000+G.month*10+G.cycle;
const recDec=c=>({y:Math.floor(c/1000),m:Math.floor(c%1000/10),c:c%10});
const recId=k=>{if(k==='me')return 0;const n=npc(k),v=parseInt(String(k).replace(/\D/g,''),10)||0;return n&&n.role==='guest'?-v:v};
const recCid=v=>v===0?'me':'npc_'+String(Math.abs(v)).padStart(4,'0');
function recOf(){
  if(!G.rec){
    G.rec={r:[],b:[],t:[]};
    if(G.bz&&G.bz.length&&G.bz[0].w)G.bz.slice().reverse().forEach(I=>recBzAdd(I));   // 舊存檔：從現存的番付補起
  }
  return G.rec;
}
/** 記一份旬報（07c_report.js 呼叫）。 */
function recRep(net,inc,out,n){
  const R=recOf(),c=recCode(),L=R.r[R.r.length-1];if(L&&L[0]===c)return;
  const row=[c,Math.round(net||0),Math.round(G.silver||0),Math.round(inc||0),Math.round(out||0)];if(n>1)row.push(n);
  R.r.push(row);
}
function recBzAdd(I){
  const R=recOf(),c=I.y*1000+I.m*10+3;if(R.b.some(x=>x[0]===c))return;
  R.b.push([c,I.w.map(r=>recId(r.k)),I.f.map(r=>recId(r.k)),I.meW.i,I.meF.i]);
}
{const _p=bzPublish;bzPublish=function(log){
  const out=_p.apply(this,arguments),I=bzLast();
  if(I){recBzAdd(I);const R=recOf(),c=recCode();if(!R.t.some(x=>x[0]===c))R.t.push([c,Math.round(bzWorth('me')),Math.round(G.fame||0)])}
  return out;
}}

/* ---------- 畫面 ---------- */
const REC_TABS=['rep','bz','trend'];
ACT.recTab=el=>{UI.s.recTab=el.dataset.k;UI.render()};
ACT.recYear=el=>{const y=+el.dataset.y;UI.s.recYear=UI.s.recYear===y?null:y;UI.render()};
ACT.recBz=el=>{const c=+el.dataset.c;UI.s.recBzOpen=UI.s.recBzOpen===c?null:c;UI.render()};
const recMd=d=>UT('rec.md',{m:d.m,c:CYCLE_NAMES[d.c-1]});
/** 依年份分組（新的在上）。 */
function recByYear(list){const Y={};list.forEach(x=>{const y=recDec(x[0]).y;(Y[y]=Y[y]||[]).push(x)});return Object.keys(Y).map(Number).sort((a,b)=>b-a).map(y=>({y,L:Y[y]}))}
function recYearHead(y,open,extra){
  return '<div class="irow" data-act="recYear" data-y="'+y+'" style="display:flex;justify-content:space-between;gap:6px"><b>'+(open?'▾ ':'▸ ')+esc(yearStr(y))+'</b><span class="small">'+(extra||'')+'</span></div>';
}
const recNet=v=>'<b class="'+(v>=0?'up':'down')+'" style="color:'+(v>=0?'#b3261e':'#1e7e34')+'">'+(v>=0?'+':'−')+fmt(Math.abs(v))+'</b>';
function recRepHtml(){
  const R=recOf();if(!R.r.length)return '<div class="small muted">'+UT('rec.none.rep')+'</div>';
  const G0=recByYear(R.r),open=UI.s.recYear===undefined?G0[0].y:UI.s.recYear;
  return G0.map(({y,L})=>{
    const tot=L.reduce((s,x)=>s+x[1],0);
    let h=recYearHead(y,open===y,UT('rec.yearNet',{a:recNet(tot)}));
    if(open===y)h+=L.slice().reverse().map(x=>{
      const d=recDec(x[0]),t=Math.max(1,x[3]+x[4]),pi=Math.round(x[3]/t*100);
      return '<div style="display:flex;align-items:center;gap:6px;white-space:nowrap;padding:3px 4px;border-bottom:1px dashed #d8ccb2;font-size:13px">'
        +'<span style="flex:none;width:5.6em">'+esc(recMd(d))+(x[5]?'<span class="tiny muted">'+UT('rec.multi',{n:x[5]})+'</span>':'')+'</span>'
        +'<span style="flex:none;width:5.2em;text-align:right">'+recNet(x[1])+'</span>'
        +'<span class="tiny muted" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+UT('rec.silver',{a:fmt(x[2])})+'</span>'
        +'<span class="rp-split" style="flex:none;width:56px;height:9px;border-width:1px"><i class="in" style="width:'+pi+'%"></i><i class="out" style="width:'+(100-pi)+'%"></i></span></div>';
    }).join('');
    return h;
  }).join('');
}
const recRank=i=>i===null||i===undefined||i>=BZ().top?UT('rec.out'):i<3?UT('bz.tier.'+i):UT('rec.rank',{t:UT('bz.tier.3'),n:i+1});
function recBzCol(ids,prevIds,c){
  let h='<div style="min-width:0"><div class="tiny bold" style="text-align:center;border-bottom:1px solid #2a2420">'+UT('bz.col.'+c)+'</div>';
  ids.forEach((v,i)=>{
    const k=recCid(v),me=v===0,p=prevIds?prevIds.indexOf(v):-2;
    const ar=p===-2?'':p<0?UT('bz.new'):p>i?UT('bz.up',{n:p-i}):p<i?UT('bz.down',{n:i-p}):UT('bz.same');
    h+='<div style="display:flex;gap:3px;white-space:nowrap;overflow:hidden;font-size:'+(['15px','14px','14px'][i]||'12px')+(me?';color:#c0281e':'')+(i<3?';font-weight:bold':'')+'">'
      +'<span class="tiny muted" style="flex:none;font-weight:normal">'+UT('bz.tier.'+bzTier(i))+'</span>'
      +'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+esc(bzWho(k))+(v<0?'<span class="tiny muted" style="font-weight:normal">'+UT('bz.guest')+'</span>':'')+'</span>'
      +'<span class="tiny muted" style="flex:none;font-weight:normal">'+ar+'</span></div>';
  });
  return h+'</div>';
}
function recBzHtml(){
  const R=recOf();if(!R.b.length)return '<div class="small muted">'+UT('rec.none.bz')+'</div>';
  const G0=recByYear(R.b),open=UI.s.recYear===undefined?G0[0].y:UI.s.recYear;
  return G0.map(({y,L})=>{
    let h=recYearHead(y,open===y,'');
    if(open===y)h+=L.slice().reverse().map(x=>{
      const d=recDec(x[0]),on=UI.s.recBzOpen===x[0],j=R.b.indexOf(x),P=j>0?R.b[j-1]:null;
      let s='<div data-act="recBz" data-c="'+x[0]+'" style="display:flex;gap:6px;white-space:nowrap;padding:4px;border-bottom:1px dashed #d8ccb2;cursor:pointer;font-size:13px">'
        +'<span style="flex:none;width:5.6em">'+(on?'▾ ':'▸ ')+esc(UT('rec.mon',{m:d.m}))+'</span>'
        +'<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+UT('rec.bzLine',{w:recRank(x[3]),f:recRank(x[4])})+'</span></div>';
      if(on)s+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:4px 2px 6px;background:#fffaf0">'+recBzCol(x[1],P&&P[1],'w')+recBzCol(x[2],P&&P[2],'f')+'</div>';
      return s;
    }).join('');
    return h;
  }).join('');
}
/** 走勢折線圖：每期番付一點；x 軸只標年份，圖上標起點、最高與現在。 */
function recChart(pts,title,fm,col){
  const W=340,H=150,L=8,Rr=8,T=24,B=22,n=pts.length,vs=pts.map(p=>p.v);
  let lo=Math.min(...vs),hi=Math.max(...vs);if(hi-lo<1){hi+=1;lo-=1}
  const pad=(hi-lo)*0.15;lo-=pad;hi+=pad;
  const X=i=>L+(n<2?0:(W-L-Rr)*i/(n-1)),Y=v=>T+(H-T-B)*(1-(v-lo)/(hi-lo));
  let s='<div class="small bold" style="margin-top:8px">'+title+'</div><svg viewBox="0 0 '+W+' '+H+'" style="width:100%;display:block;background:#fffaf0;border:2px solid #b5a98f" font-family="inherit">';
  let lastY=null;pts.forEach((p,i)=>{if(p.y!==lastY){lastY=p.y;const x=X(i);s+='<line x1="'+x.toFixed(1)+'" y1="'+T+'" x2="'+x.toFixed(1)+'" y2="'+(H-B)+'" stroke="#eee3c9"/><text x="'+(x+2).toFixed(1)+'" y="'+(H-7)+'" font-size="10" fill="#6b6256">'+esc(yearStr(p.y))+'</text>'}});
  s+='<path d="'+pts.map((p,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(p.v).toFixed(1)).join('')+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linejoin="round"/>';
  const im=vs.indexOf(Math.max(...vs)),mark=(i,lb)=>{const x=X(i),y=Y(pts[i].v),a=i===0?'start':i===n-1?'end':'middle';return '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="3" fill="'+col+'"/><text x="'+x.toFixed(1)+'" y="'+(y-6).toFixed(1)+'" text-anchor="'+a+'" font-size="10.5" fill="#3b2e1c">'+lb+fm(pts[i].v)+'</text>'};
  s+=mark(0,UT('rec.start'));if(X(im)-X(0)>60&&X(n-1)-X(im)>60)s+=mark(im,UT('rec.max'));   // 太靠近起點或現在就不另標
  if(n>1)s+=mark(n-1,UT('rec.now'));
  return s+'</svg>';
}
function recTrendHtml(){
  const R=recOf();if(R.t.length<2)return '<div class="small muted">'+UT('rec.none.trend')+'</div>';
  const P=k=>R.t.map(x=>({y:recDec(x[0]).y,v:x[k]}));
  const big=v=>Math.abs(v)>=10000?UT('silver.short',{a:(v/10000).toFixed(1)}):fmt(v);
  return recChart(P(1),UT('rec.tWorth'),big,'#b3261e')+recChart(P(2),UT('rec.tFame'),v=>fmt(v),'#27407a')+'<div class="tiny muted" style="margin-top:4px">'+UT('rec.tFoot')+'</div>';
}
function wikiRecord(){
  const t=UI.s.recTab||'rep';
  let h='<div style="margin:4px 0">'+REC_TABS.map(k=>'<span class="pill '+(t===k?'on':'')+'" data-act="recTab" data-k="'+k+'">'+UT('rec.tab.'+k)+'</span>').join('')+'</div>';
  return h+({rep:recRepHtml,bz:recBzHtml,trend:recTrendHtml}[t]||recRepHtml)();
}
/** 筆記頂端第三個分頁「紀錄」。 */
{const _n=renderNotes;renderNotes=function(){
  if(UI.s.notesTab!=='rec')return _n.apply(this,arguments);
  $('#view-notes').innerHTML='<div class="pixel-box" style="padding:8px">'+UT('rec.h',{a:notesTabsHtml()})+'<div style="margin-top:6px">'+wikiRecord()+'</div></div>';
}}

/* ═════ [07zzh_wife] ═════ */
'use strict';
/* =====================================================================
 * 07zzh_wife.js — 夫人事件（DESIGN_NOTES 第二百一十六節）
 *  - 好事：每年一定一件，不分出身。街坊捧場（本業最便宜的貨兩旬好賣）、井邊風聲（免費買付風聲）、
 *    暗中追討（要回揩油最多那人的錢，不算查帳）、娘家遞消息（風聲 -1）。
 *  - 壞事：依出身各一種，成親滿兩季後才有，每年最多一件（ODDS.wife.badP），一位夫人一生最多三件。
 *    町人之女＝店員欺負夫人；商人之女＝夫人與大番頭爭執；官員之女＝一階官員來找夫人舊情復燃。
 *    只有「幫夫人」「視而不見」兩個選項。幫夫人：當年添丁機率提高（G.family.birthBonus，年底擲完歸零）。
 *    第一次視而不見只有一句警告；連續兩次，夫人離家出走：知名度 -5、瓦版與番付八卦。孩子留下，之後可以再娶。
 *  - 排程存在 G.wifeEv={key,y,good,bad,goodDone,badDone,cur}；回府時跳出（07zx_homeevt.js），沒輪到的下一旬再排。
 *    壞事見過卻沒選就關掉：下一旬推進時視為視而不見。
 *  數值 ODDS.wife；文字 01e（wife.*）、01f（wife.*）、01g（wife.*）。
 * ===================================================================== */
const WIFE_BAD={commoner:'bully',rival:'quarrel',official:'flame'};
const wifeKey=sp=>sp?sp.name+'|'+(sp.since||0):'';
/** 夫人頭像（同一位夫人外貌固定）。 */
function portraitWife(sp,px){
  const key='edo3|wife|'+sp.name,o={seed:'wife'+sp.name,gender:'f',age:Math.max(16,G.year-sp.birthYear),role:'guest',cloth:'#c46a8a',st:{}};
  const size=px||48;
  return '<img class="pt" src="'+(PT_CACHE[key]||(PT_CACHE[key]=ptDraw(o)))+'" width="'+size+'" height="'+size+'" alt="" aria-hidden="true">';
}
/** 排定本年度（從本旬起到年底）的好事與壞事旬。成親、換年、舊存檔都會重排。 */
function wifePlan(){
  const sp=G.family.spouse;if(!sp){G.wifeEv=null;return}
  const O=ODDS.wife,left=(12-G.month)*3+(3-G.cycle),start=G.turn,since=sp.since||0;
  const good=start+rint(0,left);
  const L=[];for(let t=start;t<=start+left;t++)if(t-since>=O.badAfter)L.push(t);
  const bad=(sp.bad||0)<O.badMax&&L.length&&chance(O.badP)?pick(L):null;
  G.wifeEv={key:wifeKey(sp),y:G.year,good,bad,goodDone:false,badDone:bad===null,cur:null};
}
/** 推進一旬（日期前進後）：上旬見過沒選的壞事＝視而不見；到期的事排進回府時。 */
function wifeTick(log){
  const W=G.wifeEv;
  if(W&&W.cur&&W.cur.bad&&W.cur.shown&&!W.cur.done){const m=wifeResolve(false);if(m){const t=NEWS('wife.auto',{m});pushNews(t);log.push(t)}}
  if(W)W.cur=null;
  const sp=G.family.spouse;
  if(!sp||(G.exile||0)>0||G.ended)return;
  if(!G.wifeEv||G.wifeEv.y!==G.year||G.wifeEv.key!==wifeKey(sp))wifePlan();
  const V=G.wifeEv;if(!V)return;
  if(!V.badDone&&V.bad<=G.turn){const c=wifeBadPick(sp);if(c){V.cur=c;queueHomeEvent({type:'wifeBad'});return}V.badDone=true}
  if(!V.goodDone&&V.good<=G.turn){V.cur={good:true,kind:wifeGoodPick()};queueHomeEvent({type:'wifeGood'})}
}
/** 壞事的對象；找不到就這一年不發生。 */
function wifeBadPick(sp){
  const kind=WIFE_BAD[sp.kind]||'bully';
  if(kind==='bully'){
    const L=G.emps.filter(e=>['apprentice','clerk','banto'].includes(e.rank)&&!jailedEmp(e)&&!sevAway(e));if(!L.length)return null;
    const sc=e=>{const s=statsOfEmp(e);return s.greed_index-s.integrity_loyalty};
    return {bad:true,kind,empId:L.slice().sort((a,b)=>sc(b)-sc(a))[0].id};
  }
  if(kind==='quarrel'){const e=G.emps.find(x=>x.rank==='chief'&&!jailedEmp(x)&&!sevAway(x));return e?{bad:true,kind,empId:e.id}:null}
  const L=officialsOf(G.cityId).filter(n=>n.pos&&n.pos.rank===1&&!n.ronin&&alive(n.cid)&&!jailed(n)&&CH(n.cid).gender!=='f');
  return L.length?{bad:true,kind,cid:pick(L).cid}:null;
}
/** 好事：每年一定一件；條件不合的不抽。 */
function wifeGoodPick(){
  const L=['fans'];
  if(buyoutIntelNext())L.push('intel');
  if(G.emps.some(e=>(e.skim||0)>=1))L.push('recover');
  if((G.heat||0)>=1)L.push('heat');
  return pick(L);
}
/** 本業最便宜的貨（街坊捧場的那一樣）。 */
const wifeCheapest=()=>ownComms().slice().sort((a,b)=>a.base-b.base)[0];
/** 街坊捧場的需求倍率（03_market.js 的 demandEff）。 */
const wifeMult=c=>G&&G.wifeFans&&G.turn<=G.wifeFans.until&&c.name===G.wifeFans.name?ODDS.wife.fansMult:1;
/** 好事生效（回府時跳出那一刻）；回傳效果說明。 */
function wifeGoodApply(kind){
  const O=ODDS.wife;
  if(kind==='fans'){const c=wifeCheapest();if(!c)return '';G.wifeFans={name:c.name,until:G.turn+O.fansTurns-1};return UT('wife.good.fans.eff',{g:xName(c.name),t:O.fansTurns})}
  if(kind==='intel'){const I=buyoutIntelNext();if(!I)return UT('wife.good.intel.none');buyoutDiscover(I.y,I.rid,I.m);return UT('wife.good.intel.eff',{r:REG_NAME(I.rid),m:buyoutMonth(I.m,I.rid)})}
  if(kind==='recover'){
    const e=G.emps.filter(x=>(x.skim||0)>=1).sort((a,b)=>b.skim-a.skim)[0];if(!e)return UT('wife.good.recover.none');
    const amt=Math.round(e.skim);e.skim=0;G.silver+=amt;G.carryIn=G.carryIn||{};G.carryIn.windfall=(G.carryIn.windfall||0)+amt;sfx.coin();
    pushNews(NEWS('wife.recover',{a:fmt(amt)}));
    return UT('wife.good.recover.eff',{a:fmt(amt)});
  }
  if(kind==='heat'){G.heat=Math.max(0,(G.heat||0)-O.heatCut);return UT('wife.good.heat.eff',{a:O.heatCut})}
  return '';
}
/** 回府時事件卡。 */
function wifeCard(e){
  const sp=G.family.spouse,W=G.wifeEv,C=W&&W.cur;if(!sp||!C)return null;
  const head=(line,effect,buttons)=>'<div class="card warn" style="display:flow-root">'+portraitWife(sp,56)+'<div><b style="font-size:17px">'+esc(sp.name)+'</b> <span class="tag gray">'+UT('face.faceEventCard.12',{a:esc(UT('wife.tag')),b:esc(line),c:esc(effect)})+'</div>'+(buttons||UT('face.buttons'))+'</div>';
  if(e.type==='wifeGood'){
    if(!C.good)return null;
    if(C.eff===undefined){C.eff=wifeGoodApply(C.kind);W.goodDone=true}
    return head(UT('wife.good.'+C.kind,{g:G.wifeFans?xName(G.wifeFans.name):''}),C.eff);
  }
  if(!C.bad||C.done)return null;
  const v=wifeVars(C);if(!v)return null;
  C.shown=true;
  return head(UT('wife.bad.'+C.kind,v),UT('wife.bad.'+C.kind+'.ask',v),
    '<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="wifeHelp">'+UT('btn.wifeHelp.'+C.kind)+'</button><button class="pixel-btn btn-sm" data-act="wifeIgnore">'+UT('btn.wifeIgnore.'+C.kind)+'</button></div>');
}
/** 壞事文字用的變數（對象已不在就不發生）。 */
function wifeVars(C){
  if(C.empId){const e=G.emps.find(x=>x.id===C.empId);return e?{n:e.name,k:rankName(e.rank)}:null}
  if(C.cid){const n=npc(C.cid);return n&&alive(C.cid)?{n:nameOf(C.cid),k:posTitle(n)}:null}
  return null;
}
/** 結算壞事：help＝幫夫人。回傳給玩家看的一句話。 */
function wifeResolve(help){
  const W=G.wifeEv,C=W&&W.cur,sp=G.family.spouse;if(!C||!C.bad||C.done||!sp)return null;
  const O=ODDS.wife,v=wifeVars(C)||{n:'',k:''};
  C.done=true;W.badDone=true;sp.bad=(sp.bad||0)+1;
  const e=C.empId&&G.emps.find(x=>x.id===C.empId);
  if(help){
    sp.ign=0;
    if(C.kind==='bully'&&e){
      G.emps=G.emps.filter(x=>x!==e);if(e.cid&&npc(e.cid))npc(e.cid).hired=false;
      G.emps.forEach(x=>{x.aff=clamp(empAff(x)-O.bullyOthers,0,100)});
      pushNews(NEWS('wife.bullyOut',{n:v.n,k:v.k}));
    }else if(C.kind==='quarrel'&&e)e.aff=clamp(empAff(e)-O.quarrelAff,0,100);
    else if(C.kind==='flame'&&C.cid)setAff(R(C.cid),Math.max(0,R(C.cid).aff-O.flameAff));
    G.family.birthBonus=Math.min(O.birthCap,(G.family.birthBonus||0)+O.birthUp);
    return MSG('wife.help.'+C.kind,v)+MSG('wife.happy');
  }
  if(C.kind==='bully'&&e)e.boldUntil=Math.max(e.boldUntil||0,G.turn+O.boldTurns);
  else if(C.kind==='quarrel'&&e)e.aff=clamp(empAff(e)+O.chiefUp,0,100);
  sp.ign=(sp.ign||0)+1;
  if(sp.ign>=O.leaveAfter)return MSG('wife.ign.'+C.kind,v)+wifeLeave();
  return MSG('wife.ign.'+C.kind,v)+MSG('wife.warn');
}
/** 夫人離家出走：孩子留下；知名度下降；瓦版與下一期番付的八卦。 */
function wifeLeave(){
  const sp=G.family.spouse;if(!sp)return '';
  G.family.exWives=(G.family.exWives||[]).concat([{name:sp.name,kind:sp.kind,left:G.turn}]);
  G.family.spouse=null;G.wifeEv=null;G.wifeGone={t:G.turn,name:sp.name};
  setFame((G.fame||0)-ODDS.wife.leaveFame);
  pushNews(NEWS('wife.left',{name:G.me.name,w:sp.name}));
  return MSG('wife.left',{w:sp.name,f:ODDS.wife.leaveFame});
}
ACT.wifeHelp=()=>{const m=wifeResolve(true);UI.hideInfo();if(m){sfx.coin();toast(m,4600)}UI.render()};
ACT.wifeIgnore=()=>{const m=wifeResolve(false);UI.hideInfo();if(m)toast(m,4600);UI.render()};
FACE_TITLE.wifeGood='wife.title.good';FACE_TITLE.wifeBad='wife.title.bad';
{const _s=showHomeEvent;showHomeEvent=function(lead){const e=homeQ().find(x=>x.turn===G.turn);return _s(e&&(e.type==='wifeGood'||e.type==='wifeBad')?'wife.lead':lead)}}   // 夫人事件換一句開頭
{const _f=faceEventCard;faceEventCard=function(e){return e&&(e.type==='wifeGood'||e.type==='wifeBad')?wifeCard(e):_f(e)}}

/* ═════ [07zzi_stress] ═════ */
'use strict';
/* =====================================================================
 * 07zzi_stress.js — 壓力值與外城出遊（DESIGN_NOTES 第二十九節「壓力值」、第二百一十七節）
 *  - G.stress 0～100：從容（<40）／疲憊（40～69，每旬行動 4；交涉的小中大按鈕每回合換位置；進出貨拉霸會手抖）／心力交瘁（70～89，行動 3、同上、
 *    45 歲後壽數判定略不利）／90 以上病倒（07zzd_sick.js 的 sickArm('stress')，病倒時壓力回到 60，臥病期間不變動）。
 *  - 增減一律走 addStress(key,v)，記在 G.stressCur；推進一旬結束時搬到 G.stressPrev（「上一旬的變化」）。
 *  - 掛點：行動點數（spendAP）、拜訪拒見（visitRoll）、交涉失利與不善言辭（battleEnd）、暗殺放火栽贓打壓、
 *    搜查罰銀遠島與打毀（loseFame 的鍵）、失火（G.life.fires）、供貨不穩（G.supplyQuarter.unstable）、現款為負；
 *    宴會、吉原夜宴、指名、節慶、忘年會、節慶闔家同遊；每旬自然恢復、沒用完的行動點數、夫人子女在家。
 *  - 外城出遊（主畫面河岸藏下方）：寺社參拜、溫泉、外城友人（寄信、探聽買付、作客，07zzn_outfriend.js）。
 *  數值 ODDS.stress、ODDS.trip；費用 COSTS.temple／onsen；文字 stress.*、trip.*（01e）、stress.*、trip.*（01f、01g）。
 * ===================================================================== */
const ST=()=>ODDS.stress;
const stressNow=()=>clamp(Math.round((G&&G.stress)||0),0,100);
/** 0 從容、1 疲憊、2 心力交瘁、3 病倒中。 */
function stressTier(){
  if(G&&(G.injured||0)>0&&G.injKind==='sick')return 3;
  const s=stressNow(),T=ST().tiers;return s>=T[1]?2:s>=T[0]?1:0;
}
/** 本旬行動點數上限。 */
const apMaxNow=()=>AP_MAX-([0,1,2,2][stressTier()]);
let STRESS_SKIP=false;
/** 增減壓力；病倒臥床期間不變動。到 90 記下病倒。 */
function addStress(key,v){
  if(!G||!v||G.ended)return 0;
  if((G.injured||0)>0&&G.injKind==='sick')return 0;
  const s0=G.stress||0,s1=clamp(s0+v,0,100),d=s1-s0;G.stress=s1;
  const L=G.stressCur||(G.stressCur=[]),o=L.find(x=>x.k===key);if(o)o.v+=v;else L.push({k:key,v});
  if(s1>=ST().tiers[1])G.stressExhYear=true;
  if(s1>=ST().sick)sickArm('stress');
  updateAP();
  return d;
}
/** 推進一旬開頭（行動點數重設之前）：沒用完的點數、自然恢復、家人、現款為負。 */
function stressTurnStart(){
  if(!G||(G.exile||0)>0)return;
  const O=ST(),left=Math.max(0,G.ap||0);
  addStress('rest',-O.natural);
  if(left)addStress('idle',-O.idle*left);
  if(G.family.spouse)addStress('wife',-O.family);
  if((G.family.kids||[]).length)addStress('kids',-O.family);
  if(G.silver<0)addStress('debt',O.debt);
}
/** 推進一旬結尾：節慶、供貨不穩、失火；整理紀錄；依狀態壓低本旬行動點數。 */
function stressTick(log){
  const O=ST(),S=G.stressSnap||{},fires=(G.life&&G.life.fires)||0,un=(G.supplyQuarter&&G.supplyQuarter.unstable)||0;
  if(typeof festActive==='function'&&festActive())addStress('fest',-O.fest);
  if(S.unstable!==undefined&&un>S.unstable)addStress('unstable',O.unstable);
  if(S.fires!==undefined&&fires>S.fires)addStress('fire',O.fire*(fires-S.fires));
  G.stressSnap={unstable:un,fires};
  G.stressPrev=(G.stressCur||[]).filter(x=>x.v);G.stressCur=[];
  const t=stressTier(),tp=G.stressTierShown||0;
  if(t!==tp&&t<3){if(t>tp)log.push(NEWS('stress.up.'+t));else if(t===0)log.push(NEWS('stress.ease'));}
  G.stressTierShown=t;
  if((G.exile||0)<=0&&G.ap>apMaxNow())G.ap=apMaxNow();
}
/* ---------- 掛點 ---------- */
{const _s=spendAP;spendAP=function(){const a=apLeft(),r=_s.apply(this,arguments);if(r&&!STRESS_SKIP&&apLeft()<a)addStress('ap',ST().ap*(a-apLeft()));return r}}
{const _v=visitRoll;visitRoll=function(cid){const r=_v.apply(this,arguments);if(r&&r.outcome==='refuse')addStress('refuse',ST().refuse);return r}}
{const _b=battleEnd;battleEnd=function(){
  const B=BT;if(B&&!B.done&&!B.mode){const win=B.dmg>=B.hp;if(!win&&B.round>=3&&B.hits===0)addStress('snub',ST().snub);else if(!win)addStress('lose',ST().lose)}
  return _b.apply(this,arguments)}}
/** 栽贓、打壓：真的做了（風聲重罪加三）才算。暗殺、放火不加風聲，壓力直接寫在 07m_loyalty.js。 */
const stressDirty=f=>function(){const h=G.heat||0,r=f.apply(this,arguments);if((G.heat||0)>=h+3)addStress('dirty',ST().dirty);return r};
startScheme=stressDirty(startScheme);
/** 搜查、罰銀、遠島、查貨、打毀：沿用扣知名度的鍵。 */
{const _l=loseFame;loseFame=function(key){const v=ST().fameKeys[key];if(v)addStress('blow',v);return _l.apply(this,arguments)}}
{const _f=ACT.banquet;ACT.banquet=function(){const t=G.banquetT;const r=_f.apply(this,arguments);if(G.banquetT===G.turn&&t!==G.turn)addStress('banquet',-ST().banquet);return r}}
{const _f=ACT.feast;ACT.feast=function(){const t=FL().feast;const r=_f.apply(this,arguments);if(FL().feast===G.turn&&t!==G.turn)addStress('feast',-ST().feast);return r}}
{const _f=ACT.nomOiran;ACT.nomOiran=function(el){const r0=el&&el.dataset&&G.rel[el.dataset.cid],t=r0&&r0.nomT;const r=_f.apply(this,arguments);const r1=el&&el.dataset&&G.rel[el.dataset.cid];if(r1&&r1.nomT===G.turn&&t!==G.turn)addStress('nominate',-ST().nominate);return r}}
{const _y=yearEndParty;yearEndParty=function(log){
  const r=_y.apply(this,arguments);
  G.stressExhLast=!!G.stressExhYear;G.stressExhYear=stressTier()===2;
  if(G.stressExhLast)log.push(NEWS('stress.yearWorn'));
  addStress('party',-ST().party);return r}}
/** 上一年曾心力交瘁：45 歲起壽數判定略增（04_people.js 的 yearTick）。 */
const stressDeathAdd=age=>G&&G.stressExhLast&&age>=ST().oldAge?ST().oldDeath:0;
{const _f=sickFire;sickFire=function(){const P=G&&G.sickPend,r=_f.apply(this,arguments);if(r&&P&&P.kind==='stress'){G.stress=ST().after;G.stressTierShown=3}return r}}
{const _u=updateAP;updateAP=function(){_u.apply(this,arguments);const e=document.getElementById('d-ap');if(e&&G){const t=stressTier();e.classList.toggle('tired',t===1);e.classList.toggle('worn',t>=2)}}}
/* ---------- 身心狀況視窗 ---------- */
ACT.stressInfo=()=>{if(G)UI.openSheet('stress')};
const STRESS_WAYS=['banquet','feast','nominate','fest','party','idle','temple','onsen'];
SHEETS.stress=()=>{
  const t=stressTier(),s=stressNow(),O=ST(),cols=['#4f8a4f','#c9a23a','#c0603a','#8a2f2f'];
  let h='<div class="card"><div class="row"><b style="font-size:16px;color:'+cols[t]+'">'+UT('stress.tier.'+t)+'</b></div>';
  h+='<div style="position:relative;height:12px;margin:8px 0 4px;display:flex;border:1px solid #6b5d3a">'+[[0,O.tiers[0]],[O.tiers[0],O.tiers[1]],[O.tiers[1],O.sick],[O.sick,100]].map((x,i)=>'<div style="flex:'+(x[1]-x[0])+';background:'+cols[i]+';opacity:'+(i===t?1:.35)+'"></div>').join('')
    +'<div style="position:absolute;top:-3px;bottom:-3px;width:3px;background:#2a2430;left:calc('+s+'% - 1px)"></div></div>';
  h+='<div class="small" style="margin-top:6px">'+UT('stress.say.'+t)+'</div></div>';
  const row=x=>'<div class="row tiny"><span>'+UT('stress.k.'+x.k)+'</span><b style="color:'+(x.v>0?'#b3392b':'#2f7d4f')+'">'+(x.v>0?'+':'−')+Math.abs(Math.round(x.v*10)/10)+'</b></div>';
  const P=G.stressPrev||[],C=(G.stressCur||[]).filter(x=>x.v);
  h+='<div class="card"><b>'+UT('stress.prev')+'</b>'+(P.length?P.map(row).join(''):'<div class="tiny muted">'+UT('stress.none')+'</div>');
  if(C.length)h+='<div class="tiny bold" style="margin-top:6px">'+UT('stress.cur')+'</div>'+C.map(row).join('');
  h+='</div><div class="card"><b>'+UT('stress.ways')+'</b>'+STRESS_WAYS.map(k=>'<div class="tiny">• '+UT('stress.way.'+k,{a:{banquet:O.banquet,feast:O.feast,nominate:O.nominate,fest:O.fest,party:O.party,idle:O.idle,temple:ODDS.trip.temple.relief,onsen:ODDS.trip.onsen.relief}[k]})+'</div>').join('')+'</div>';
  h+='<div class="card tiny muted">'+UT('stress.rules')+'</div>';
  return {title:UT('stress.title'),html:h};
};
/* ---------- 外城出遊 ---------- */
ACT.tripOpen=()=>{if(!G)return;TRIP_GOING=false;musicWant('trip');UI.openSheet('trip')};   // 打開出遊頁就換《道中囃子》
/* 出遊配樂：出遊頁打開到最後的結果視窗關掉，都播《道中囃子》；沒出發就關掉出遊頁、或婉拒視窗直接關掉，換回《市井囃子》。 */
let TRIP_GOING=false,TRIP_RESULT=false;
const tripMusicEnd=()=>{TRIP_GOING=false;TRIP_RESULT=false;if(MUS.want==='trip')musicWant('market')};
{const _c=UI.closeSheet;UI.closeSheet=function(){const was=UI.s.sheet&&UI.s.sheet.type;const r=_c.apply(this,arguments);if(was==='trip'&&!TRIP_GOING)tripMusicEnd();return r}}
/** 不能去的原因（文字鍵）；可以去回傳 null。 */
function tripBlock(k){
  const T=ODDS.trip[k];
  if((G.exile||0)>0)return 'trip.no.exile';
  if((G.injured||0)>0)return 'trip.no.hurt';
  if(k==='temple'&&G.tripTemple===G.turn)return 'trip.no.turn.temple';   // 每旬各一次
  if(k==='onsen'&&G.tripOnsen===G.turn)return 'trip.no.turn.onsen';
  if(apLeft()<T.ap)return 'trip.no.ap';
  if(!afford(k))return 'trip.no.money';
  return null;
}
SHEETS.trip=()=>{
  let h='<div class="notice tiny">'+UT('trip.intro')+'</div>';
  ['temple','onsen'].forEach(k=>{
    const T=ODDS.trip[k],b=tripBlock(k);
    h+='<div class="card"><b>'+UT('trip.'+k)+'</b><div class="tiny muted" style="margin:3px 0">'+UT('trip.'+k+'.d')+'</div>'
      +(k==='temple'&&hatsuNow()?'<div class="tiny" style="color:#9b2c3a">'+UT('trip.hatsuTag')+'</div>':'')
      +'<div class="tiny">'+UT('trip.meta',{ap:T.ap,c:costOf(k)?coinHtml(COSTS[k].cur,costOf(k)):UT('trip.free'),r:T.relief})+'</div>'
      +(b?'<div class="tiny" style="color:#b3392b;margin-top:3px">'+UT(b)+'</div>':'')
      +'<div style="margin-top:5px"><button class="pixel-btn btn-sm btn-gold" data-act="tripGo" data-k="'+k+'" '+(b?'disabled':'')+'>'+UT('btn.tripGo.'+k)+'</button></div></div>';
  });
  h+=tripFriendCard();                              // 外城友人：出遊訪友（07zzn_outfriend.js）
  return {title:UT('trip.title'),html:h};
};
/** 香油錢拉霸（私房錢，每格 5 兩，最多 ODDS.trip.giftMax）。 */
function tripGiftRow(){
  const O=ODDS.trip,M=Math.min(O.giftMax,Math.floor((G.gold||0)/O.giftStep)*O.giftStep),v=Math.min(UI.s.tripGift||0,M);UI.s.tripGift=v;
  if(M<=0)return '<div class="tiny muted" style="margin-top:4px">'+UT('trip.gift.none')+'</div>';
  return '<div class="tiny" style="margin-top:5px">'+UT('trip.gift.h',{a:'<b id="trip-gift-v">'+v+'</b>'})+'</div>'
    +stepRow('<input id="trip-gift" type="range" min="0" max="'+M+'" value="'+v+'" step="'+O.giftStep+'" data-chg="tripGift" data-lbl="trip-gift-v">','trip-gift',v<=0,v>=M)
    +'<div class="tiny muted">'+UT('trip.gift.d',{r:O.giftReliefMax,f:O.giftFameAt})+'</div>';
}
CHG.tripGift=el=>{UI.s.tripGift=Math.max(0,+el.value||0)};
ACT.tripGo=el=>{
  const k=el.dataset.k,T=ODDS.trip[k];if(!T)return;
  const b=tripBlock(k);if(b){toast(UT(b));return}
  const f=tripCompRoll(k);
  TRIP_GOING=true;
  if(f){TRIP_OFFER={k,f};UI.closeSheet();UI.showInfo(UT('trip.comp.title'),tripCompAsk(k,f));return}
  tripStart(k,null);
};
/** 正月初詣：一月上旬。 */
const hatsuNow=()=>G&&G.month===1&&G.cycle===1;
/* ---------- 同行：本城好感 80 以上的商人或官員 ---------- */
var TRIP_OFFER=null;
const tripIsOff=cid=>(npc(cid)||{}).role==='official';
const tripWho=cid=>tripIsOff(cid)?'official':'merchant';
/** 這一趟有沒有人要同行（溫泉要付得起兩人份才問）。 */
function tripCompRoll(k){
  const T=ODDS.trip;if(!chance(T.compP))return null;
  if(k==='onsen'&&!afford(k,2))return null;
  const L=closeFriends(false).filter(n=>!['oiran','smuggler'].includes(n.role)&&!jailed(n)&&!hiddenSmuggler(n.cid));
  return L.length?pick(L).cid:null;
}
/** 名牌卡：頭像、稱呼、身份、一句話、效果。 */
function tripCard(img,name,tag,line,foot){
  return '<div class="card" style="display:flow-root;margin-bottom:6px">'+img+'<div><b>'+esc(name)+'</b> <span class="tag gray">'+esc(tag)+'</span></div><div class="small" style="margin:5px 0">「'+esc(line)+'」</div>'+(foot?'<div class="tiny" style="color:#9b2c3a">'+esc(foot)+'</div>':'')+'</div>';
}
const tripTag=cid=>{const n=npc(cid);return n&&n.pos?posTitle(n):(ROLE_LABEL[(n||{}).role]||'')};
function tripCompAsk(k,f){
  const T=ODDS.trip,x=k==='onsen'?UT('trip.comp.pay',{c:fmt(costOf(k))}):'';
  return tripCard(portraitHtml(f,56),nameOf(f),tripTag(f),TX('trip.comp.ask.'+k+'.'+tripWho(f),{n:G.me.given}),x)
    +'<div class="grid2"><button class="pixel-btn btn-gold btn-sm" data-act="tripCompYes">'+UT('btn.tripCompYes')+'</button><button class="pixel-btn btn-sm" data-act="tripCompNo">'+UT('btn.tripCompNo',{a:T.compNo})+'</button></div>';
}
ACT.tripCompYes=()=>{const o=TRIP_OFFER;TRIP_OFFER=null;UI.hideInfo();if(!o)return;const b=tripBlock(o.k);if(b){toast(UT(b));return}tripStart(o.k,afford(o.k,2)||o.k!=='onsen'?o.f:null)};
ACT.tripCompNo=()=>{const o=TRIP_OFFER;TRIP_OFFER=null;UI.hideInfo();if(!o)return;
  const g=ODDS.trip.compNo,r=R(o.f);setAff(r,clamp(r.aff-g,0,100));logRel(o.f,UT('trip.log.no.'+o.k,{g}));toast(MSG('trip.comp.no',{f:nameOf(o.f),g}));
  const b=tripBlock(o.k);if(b){toast(UT(b));return}tripStart(o.k,null)};
/** 溫泉碰到的本城男子：認識不認識、仇人都可能。 */
function tripBather(skip){
  const L=cityNpcs(G.cityId).filter(n=>n.cid!==skip&&alive(n.cid)&&!['oiran','concubine','branch'].includes(n.role)&&!n.hired&&!G.emps.some(e=>e.cid===n.cid)
    &&!awayNow(n)&&!jailed(n)&&(CH(n.cid)||{}).gender!=='f'&&!(n.pos&&n.pos.court==='region'));
  return L.length?pick(L).cid:null;
}
/** 出發：扣行動與花費、播過場，到了當地有人開口。 */
function tripStart(k,f){
  const T=ODDS.trip[k];
  STRESS_SKIP=true;try{for(let i=0;i<T.ap;i++)spendAP()}finally{STRESS_SKIP=false}
  spend(k,f&&k==='onsen'?2:1);if(k==='temple')G.tripTemple=G.turn;else G.tripOnsen=G.turn;
  UI.closeSheet();
  FX.bg=k==='temple'?IMG_TEMPLE:IMG_ONSEN;
  playFx('walk',MSG('trip.fx.'+k),MSG(f?'trip.fxSubWith.'+k:'trip.fxSub.'+k,{f:f?nameOf(f):''}),()=>{
    addStress(k,-T.relief);
    if(k==='temple'){TRIP_PEND={k,f};UI.s.tripGift=0;UI.showInfo(UT('trip.done.temple'),'<div class="text-prose" style="margin-bottom:6px">'+MSG(hatsuNow()?'trip.arrive.hatsu':'trip.arrive.temple')+'</div>'+tripGiftRow()
      +'<button class="pixel-btn btn-gold btn-sm" style="width:100%;margin-top:6px" data-act="tripGiftDo">'+UT('btn.tripPray')+'</button>');UI.render();return}
    tripArrive(k,f,0);
  },1500);
}
/** 寺社：到了才決定香油錢，一顆「參拜」照拉桿金額奉納，拉桿在 0 就是只參拜（關掉視窗＝不捐，同行好感照算）。 */
var TRIP_PEND=null;
ACT.tripGiftDo=()=>{const P=TRIP_PEND;TRIP_PEND=null;if(!P)return UI.hideInfo();tripArrive(P.k,P.f,UI.s.tripGift||0)};   // 直接換掉視窗內容，不先關（關掉會讓排隊的事件插進來）
{const _h=UI.hideInfo;UI.hideInfo=function(){const P=TRIP_PEND;TRIP_PEND=null;const O=TRIP_OFFER,done=TRIP_RESULT;const r=_h.apply(this,arguments);
  if(P){tripArrive(P.k,P.f,0,true);tripMusicEnd()}else if(done||(O&&TRIP_OFFER===O)){TRIP_OFFER=null;tripMusicEnd()}return r}}   // 同行詢問直接關掉＝不出發
/** 到了當地：香油錢、當地人物、湯客、同行的人、求籤，最後一張結果視窗。quiet＝不跳視窗（玩家直接關掉時）。 */
function tripArrive(k,f,gift,quiet){
  const T=ODDS.trip[k],O=ODDS.trip,worn=stressTier()>=2?'worn':'calm';
  const foots=[UT('trip.eff',{r:T.relief})];
  if(k==='temple'){const amt=Math.min(gift||0,Math.floor((G.gold||0)/O.giftStep)*O.giftStep);UI.s.tripGift=0;
    if(amt>0){G.gold-=amt;const r=Math.min(O.giftReliefMax,Math.floor(amt/O.giftPer));if(r)addStress('gift',-r);
      G.templeGift=G.templeGift||{};G.templeGift[G.cityId]=(G.templeGift[G.cityId]||0)+amt;   // 各城寺社累計香油錢（之後的修繕講等事件讀這個）
      const fm=amt>=O.giftFameAt?addFame(O.giftFame):0;
      foots.push(UT('trip.gift.eff',{a:amt})+(r?UT('trip.gift.relief',{r}):'')+(fm?UT('trip.gift.fame',{f:fm}):''))}}
  const TE=quiet?{}:tripEnc(k);                    // 出遊奇遇：一趟最多一件；三助換人（07zzk_tripev.js）
  let h='<div class="text-prose" style="margin-bottom:6px">'+MSG('trip.done.'+k)+'</div>';
  // 當地的人
  if(k==='temple'){const fig=chance(0.5)?'monk':'miko';h+=tripFigCard(fig,worn,TE);h+=tripEncCard(TE);
    if(hatsuNow()){                                // 正月初詣：一月上旬參拜，比照逛祭典抽一件臨時事件（07zf_festwalk.js 的 festWalkRoll）
      const fv=G.festival;G.festival=UT('trip.hatsu');let ev;try{ev=festWalkRoll('hatsu')}finally{G.festival=fv}
      h+='<div class="small" style="margin:6px 0 2px">'+esc(MSG('hatsu.open'))+'</div><div class="card" style="display:flow-root;margin-bottom:6px">'+(ev.cid?portraitHtml(ev.cid,48):'')+'<div class="small">'+esc(ev.txt)+'</div><div class="tiny" style="margin-top:4px;color:'+(ev.bad?'#1e7e34':'#9b2c3a')+'">'+esc(ev.eff)+'</div></div>'}}
  else{
    h+=tripSskCard(worn,TE);h+=tripEncCard(TE);
    const c=tripBather(f);
    if(c){const r=R(c),fresh=!r.met&&!G.known.includes(c),en=isEnemy(c),rel=en?'enemy':fresh?'new':'known';
      setAff(r,clamp(r.aff+O.batherAff,0,100));
      if(fresh){addKnown(c);r.met=true;if(!r.bond)r.bond={mult:1,label:UT('trip.bond'),introId:null}}
      logRel(c,UT('trip.log.bather',{g:O.batherAff}));
      h+=tripCard(portraitHtml(c,48),nameOf(c),tripTag(c),TX('trip.bather.'+tripWho(c)+'.'+rel,{n:G.me.given}),UT(fresh?'trip.bather.newEff':'trip.bather.eff',{f:nameOf(c),g:O.batherAff}));
    }
  }
  // 同行的人
  const SN=tripSeason(k,!!f,quiet);                 // 季節小景（07zzk_tripev.js）
  if(f){const g=O.compAff[k]+(SN.aff||0),r=R(f);setAff(r,clamp(r.aff+g,0,100));addStress('company',-O.compRelief);logRel(f,UT('trip.log.with.'+k,{g}));
    h+=tripCard(portraitHtml(f,48),nameOf(f),tripTag(f),TX('trip.comp.say.'+k+'.'+tripWho(f),{n:G.me.given}),UT('trip.comp.eff',{f:nameOf(f),g}));
    foots.push(UT('trip.comp.relief',{r:O.compRelief}));
  }
  if(SN.line){h+='<div class="small" style="margin:4px 0">'+esc(SN.line)+'</div>';if(SN.foot)foots.push(SN.foot)}
  if(k==='temple'&&chance(T.omen))h+='<div class="small" style="margin:4px 0">'+esc(TX('trip.omen'))+'</div>';   // 求籤只是氣氛，沒有作用
  UI.render();if(quiet)return;
  sfx.gift();TRIP_RESULT=false;UI.showInfo(UT('trip.done.'+k),h+'<div class="tiny muted" style="margin-top:4px">'+foots.join('；')+'</div>');
  TRIP_RESULT=true;                                 // 這張結果視窗關掉時換回主畫面配樂
}

/* ---------- 手抖：疲憊以上，用手拖動進出貨拉霸放開時，數字可能偏開一兩格（加減按鈕、鍵盤不會） ----------
 *  演出：整條拉霸左右晃 3～4 下，滑塊先往旁邊彈一兩次才停下；中間的彈動不寫進計畫，停下的數字才算。
 *  抖動中又去拖拉霸或按加減鈕：立刻停住、先落在最後的數字，再接玩家的新操作。 */
let SHAKE_ARM=null,SHAKE_ANIM=null;
function shakeFinish(){const A=SHAKE_ANIM;if(!A)return;SHAKE_ANIM=null;A.timers.forEach(clearTimeout);A.row&&A.row.classList.remove('shaking');
  const el=document.getElementById(A.id);if(el){el.value=A.nv;el.dispatchEvent(new Event('input',{bubbles:true}))}}
document.addEventListener('pointerdown',e=>{const t=e.target;if(SHAKE_ANIM&&t&&(t.id===SHAKE_ANIM.id||(t.closest&&t.closest('[data-step="'+SHAKE_ANIM.id+'"]'))))shakeFinish();
  SHAKE_ARM=t&&(t.id==='slider-ship'||t.id==='slider-buy')?t.id:null},true);
document.addEventListener('change',e=>{
  const el=e.target;if(!el||!SHAKE_ARM||el.id!==SHAKE_ARM)return;SHAKE_ARM=null;
  if(!G||el.disabled)return;const t=stressTier();if(t<1||t>2||!chance(ST().shakeP[t-1]))return;
  const lo=+el.min,hi=+el.max,v=+el.value,unit=Math.max(1,Math.round((hi-lo)*ST().shakeFrac)),d=rint(1,2)*unit*(chance(0.5)?1:-1);
  let nv=clamp(v+d,lo,hi);if(nv===v)nv=clamp(v-d,lo,hi);if(nv===v)return;
  const row=el.closest('.step-row');
  const old=row&&row.parentNode.querySelector('.shake-tip');if(old)old.remove();
  if(row){const tip=document.createElement('div');tip.className='shake-tip tiny';tip.textContent=MSG('stress.shake',{a:v,b:nv});row.insertAdjacentElement('afterend',tip);setTimeout(()=>tip.remove(),3000)}
  sfx.bad&&sfx.bad();
  // 滑塊彈動：反方向一下、再越過目標一下，最後停在 nv（只改畫面，不寫計畫）
  const dir=Math.sign(nv-v)||1,path=[clamp(v-dir*unit,lo,hi),clamp(nv+dir*unit,lo,hi),clamp(v+Math.round((nv-v)/2),lo,hi)],A={id:el.id,nv,row,timers:[]};
  if(row){row.classList.remove('shaking');void row.offsetWidth;row.classList.add('shaking')}
  path.forEach((x,k)=>A.timers.push(setTimeout(()=>{const e2=document.getElementById(A.id);if(e2){e2.value=x;rangeFill(e2)}},70+k*90)));
  A.timers.push(setTimeout(shakeFinish,70+path.length*90+40));
  SHAKE_ANIM=A;
},true);

/* ═════ [07zzj_komon] ═════ */
'use strict';
/* ★檔案總覽：木戶黃門（DESIGN_NOTES 第二百三十二、二百五十二節）
 * - 上半是年度傳聞（下半是每季判定、宣判與查抄）：每年一次，「傳聞木戶黃門大人在某城懲戒了惡德商人某某」。地點依你的惡德值（G.evil.v）靠近：
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
