'use strict';
/* ======================= 忘年會：每年最後一旬結束時，在大廣間設宴 =======================
 *  - 年度大事簿 G.yearLog：pushNews 時依【標籤】自動分類記下（天災、行情、官場、商號、家族、風波），新年清空。
 *  - 年底（進入新年那一刻）建立 G.party：入席名單、對話、效果，並立刻結算效果；旬報關閉後開視窗演出，看完即刪。
 *  - 入席：主角（上座）＋夫人、側室、子女各 1 人＋各職位店員各 1 人＋本城交情 80 以上的友人（越多來越多，坐滿 30 席為止；
 *    不足時以交情最高的熟人補到 2～3 人）。坐不滿的坐墊留空。
 *  - 效果：宴席費每人 5 兩（現款）；出席友人好感 +2、出席店員好感 +3。主角遠島中則停辦。 */
const PARTY_SEATS=30,PARTY_FEE=5,PARTY_FRIEND_AFF=80,PARTY_GAIN={friend:2,staff:3};
/** pushNews 時呼叫：依新聞鍵的分類（01g_news.js 的 NEWS_CAT）記進今年的大事簿（最多 80 筆）；不在表內的不記。
 *  tag＝新聞鍵：同一種新聞盡量只談一次。 */
function yearLogAdd(t,key){
  if(!G||!t)return;const k=key||newsKey(t),cat=k&&NEWS_CAT_OF[k];if(!cat)return;
  const L=G.yearLog||(G.yearLog=[]);L.push({cat,tag:k,k,t:partyGist(t),m:G.month});if(L.length>80)L.shift();
}
/** 新聞去掉圖示與標籤，取一段可以說出口的話（最多約 44 字）。 */
function partyGist(t){let s=String(t).replace(NEWS_FMT.head,'').replace(NEWS_FMT.paren,'').trim();if(s.length>44)s=s.slice(0,43)+'……';return s}

/* ---------- 年底建立 ---------- */
/** 年底呼叫（advanceTurn 進入新年時，於 yearTick 之前）：建立忘年會並結算效果。 */
function yearEndParty(log){
  const year=G.year-1,L=G.yearLog||[],s0=G.yearSilver0===undefined?G.silver:G.yearSilver0;
  G.yearLog=[];G.yearSilver0=G.silver;
  if((G.exile||0)>0||G.ended){const t=NEWS('party.skip');pushNews(t);log.push(t);return}
  const att=[];                                                       // {kind,cid?,empId?,label,look}
  if(G.family.spouse)att.push({kind:'wife',label:UT('party.yearEndParty',{a:G.family.spouse.name}),look:{cloth:'#c46a8a',cloth2:'#e0b030',woman:true}});
  if((G.family.conc||[]).length){const x=pick(G.family.conc);att.push({kind:'conc',cid:x.cid,label:UT('party.yearEndParty.2',{a:x.name}),look:{cloth:'#d46a9a',cloth2:'#f0c040',woman:true}})}
  if(G.family.kids.length){const k=pick(G.family.kids);att.push({kind:'kid',label:UT('party.yearEndParty.3',{a:k.name}),look:{cloth:k.gender==='f'?'#e07a9a':'#5a9bd0',cloth2:'#f4ece1',small:true,noKnot:true}})}
  const staff=[];[...RANKS,...SPECIAL].forEach(rk=>{const l=G.emps.filter(e=>e.rank===rk);if(l.length){const e=pick(l);staff.push(e);att.push({kind:'emp',rank:rk,empId:e.id,cid:e.cid||null,label:UT('party.yearEndParty.4',{a:rankName(rk),b:e.name}),look:RANK_LOOK[rk]||RANK_LOOK['clerk']})}});
  const room=PARTY_SEATS-att.length;
  const ok=cid=>{const n=npc(cid),r=G.rel[cid];return n&&r&&r.bond&&alive(cid)&&n.cityId===G.cityId&&!(touring(n)&&!tourHere(n,12))&&!isEnemy(cid)&&!G.emps.some(e=>e.cid===cid)&&n.role!=='oiran'};
  let friends=shuffle(Object.keys(G.rel).filter(cid=>ok(cid)&&G.rel[cid].aff>=PARTY_FRIEND_AFF)).filter(()=>chance(0.85)).slice(0,room);
  const minF=Math.min(room,rint(2,3));
  if(friends.length<minF){const more=Object.keys(G.rel).filter(cid=>ok(cid)&&!friends.includes(cid)).sort((a,b)=>G.rel[b].aff-G.rel[a].aff).slice(0,minF-friends.length);friends=friends.concat(more)}
  friends.sort((a,b)=>((npc(b).pos?npc(b).pos.rank:0)-(npc(a).pos?npc(a).pos.rank:0))||G.rel[b].aff-G.rel[a].aff);
  friends.forEach(cid=>{const n=npc(cid);att.push({kind:'friend',cid,label:nameOf(cid)+(n.pos?UT('party.yearEndParty.5',{a:posTitle(n)}):''),look:hostLook(cid),off:!!n.pos})});
  /* 效果 */
  const cost=Math.min(Math.max(0,Math.round(G.silver)),att.length*PARTY_FEE);
  if(cost>0){G.silver-=cost;if(TURNRP){TURNRP.inTurn=TURNRP.inTurn||{};TURNRP.inTurn['spend.party']=(TURNRP.inTurn['spend.party']||0)+cost}}   // 推進途中付的錢記在本旬（不放進 G.publicSpend，以免下一旬重複計入）
  friends.forEach(cid=>{const r=R(cid);setAff(r,clamp(r.aff+PARTY_GAIN.friend,0,100));logRel(cid,UT('party.yearEndParty.6',{a:PARTY_GAIN.friend}))});
  staff.forEach(e=>{e.aff=Math.min(100,empAff(e)+PARTY_GAIN.staff)});
  const lines=partyLines(att,L,G.silver-s0);
  /* 巡迴在外的高官好友：不出席，託人送來賀禮（好感照加） */
  const gifts=Object.keys(G.rel).filter(cid=>{const n=npc(cid),r=G.rel[cid];return n&&r&&r.bond&&alive(cid)&&touring(n)&&!tourHere(n,12)&&!isEnemy(cid)&&r.aff>=PARTY_FRIEND_AFF});
  gifts.forEach(cid=>{const r=R(cid);setAff(r,clamp(r.aff+PARTY_GAIN.friend,0,100));logRel(cid,UT('party.yearEndParty.7',{a:PARTY_GAIN.friend}))});
  if(gifts.length)lines.splice(lines.length-1,0,{who:-1,t:TX('party.gift',{n:gifts.slice(0,2).map(nameOf).join(UT('party.yearEndParty.8'))+(gifts.length>2?UT('party.yearEndParty.9',{a:gifts.length}):'')})});
  G.party={year,att,lines,cost,nf:friends.length,ns:staff.length};
  const t=NEWS('party.held',{year:yearStr(year),n:att.length});pushNews(t);log.push(t);
}
/** 編排對話：主角開場（依年度盈虧與災禍）→ 6～8 則大事（由合適的人說）→ 主角收尾。 */
function partyLines(att,L,net){
  const out=[],host={host:true,label:G.me.name};
  const bad=L.filter(x=>x.cat==='disaster'||x.cat==='trouble').length;
  out.push({who:-1,t:TX(net>0&&bad<=2?'party.open.good':bad>=4||net<0?'party.open.hard':'party.open.plain')});
  /* 挑話題：每類先取一件，再隨機補足 */
  const byCat={};L.forEach(x=>(byCat[x.cat]=byCat[x.cat]||[]).push(x));
  let topics=[];Object.keys(byCat).forEach(k=>topics.push(pick(byCat[k])));
  const tags=new Set(topics.map(x=>x.tag));                              // 同一種標籤的大事盡量只談一次
  shuffle(L.filter(x=>!topics.includes(x))).forEach(x=>{if(!tags.has(x.tag)){tags.add(x.tag);topics.push(x)}});
  topics=shuffle(topics.slice(0,Object.keys(byCat).length)).concat(topics.slice(Object.keys(byCat).length)).slice(0,rint(6,8));
  const used={};                                                         // 同一人盡量只說一次
  const speakerFor=cat=>{
    const pref={disaster:['emp:guard','emp:banto','friend'],trouble:['emp:chief','friend','emp:banto'],official:['friend:off','emp:chief','friend'],market:['emp:banto','emp:clerk','friend'],family:['wife','conc','friend'],firm:['emp:chief','emp:clerk','emp:apprentice']}[cat]||['friend'];
    for(const p of pref){const [k,sub]=p.split(':');const c=att.map((a,i)=>({a,i})).filter(({a,i})=>!used[i]&&a.kind===k&&(!sub||(k==='emp'?a.rank===sub:a.off)));if(c.length)return pick(c).i}
    const free=att.map((a,i)=>i).filter(i=>!used[i]&&att[i].kind!=='kid');
    return free.length?pick(free):att.length?Math.floor(rnd()*att.length):-1;
  };
  topics.forEach(x=>{
    const ci=att.findIndex(a=>a.rank==='captain'),fi=att.findIndex(a=>a.rank==='courier');
    const i=NEWS_SEA_SET.has(x.k)&&ci>=0&&!used[ci]?ci:NEWS_LAND_SET.has(x.k)&&fi>=0&&!used[fi]?fi:speakerFor(x.cat);
    used[i]=1;
    out.push({who:i,t:TX('party.pre.'+x.cat)+x.t+TX('party.post.'+x.cat)});
  });
  if(topics.length<4)for(let k=topics.length;k<4;k++){const i=att.length?Math.floor(rnd()*att.length):-1;out.push({who:i,t:TX('party.idle')})}
  const kid=att.findIndex(a=>a.kind==='kid');if(kid>=0)out.splice(Math.min(out.length,2+Math.floor(rnd()*3)),0,{who:kid,t:TX('party.kid')});
  out.push({who:-1,t:TX('party.close')});
  return out;
}

/* ---------- 演出 ---------- */
var PARTY_VIEW=null;
/** 旬報關閉後呼叫：打開忘年會視窗（看完即刪除 G.party）。 */
function showParty(){
  const P=G&&G.party;if(!P)return;delete G.party;save();
  PARTY_VIEW={P,i:0};
  INFO_AFTER=faceEventQueue().length?showNextFaceEvent:null;          // 散會後接著顯示人物事件
  partyRender();
}
function partySeats(){
  const s=[],top=[[110,52],[210,52],[90,52],[230,52],[70,52],[250,52],[50,52],[270,52]];
  top.forEach(p=>s.push(p));
  for(let k=0;k<6;k++){s.push([30,76+k*16]);s.push([290,76+k*16])}
  [130,190,110,210,90,230,70,250,150,170].forEach(x=>s.push([x,170]));
  return s.slice(0,PARTY_SEATS);
}
function partyRender(){
  const V=PARTY_VIEW;if(!V)return;const P=V.P,L=P.lines[V.i],att=P.att;
  const sp=L.who>=0?att[L.who]:null;
  const who=sp?sp.label:UT('party.who',{a:G.me.name});
  const pt=sp&&sp.cid?portraitHtml(sp.cid,48):sp&&sp.empId?portraitEmp(G.emps.find(e=>e.id===sp.empId)||{id:sp.empId,rank:sp.rank,stats:{}},48):'';
  const last=V.i>=P.lines.length-1;
  let h='<canvas id="party-cv" width="320" height="180" style="width:100%;image-rendering:pixelated;background:#3b2a1e;cursor:pointer" data-act="partyNext"></canvas>';
  h+='<div class="card" style="display:flow-root;margin-top:6px">'+pt+'<div class="tiny muted">'+esc(who)+'</div><div class="small" style="margin-top:3px">'+esc(L.t)+'</div></div>';
  if(last)h+='<div class="notice tiny" style="margin-top:4px">'+esc(MSG('party.effect',{cost:fmt(P.cost),f:P.nf,s:P.ns,fg:PARTY_GAIN.friend,sg:PARTY_GAIN.staff}))+'</div>';
  h+=UT('party.partyRender.2',{a:att.length,b:PARTY_SEATS})+'</span><span>'+UT('party.partyRender.3',{a:last?'':UT('party.partyRender')});
  UI.showInfo(UT('party.partyRender.4',{a:yearStr(P.year)}),h);
  partyDraw();
}
ACT.partyNext=()=>{const V=PARTY_VIEW;if(!V)return;if(V.i<V.P.lines.length-1){V.i++;sfx.tap();partyRender()}else ACT.partyEnd()};
ACT.partyEnd=()=>{PARTY_VIEW=null;UI.hideInfo()};
/** 畫大廣間：紙拉門、壁龕掛軸、榻榻米、ㄈ字形三十席；說話的人頭上有對話泡泡。 */
function partyDraw(){
  const cv=$('#party-cv'),V=PARTY_VIEW;if(!cv||!V)return;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
  const P=V.P,L=P.lines[V.i];
  R_(c,0,0,320,180,'#d8c79a');                                          // 榻榻米底
  for(let y=40;y<180;y+=20)for(let x=0;x<320;x+=40){R_(c,x,y,40,1,'#a8955f');R_(c,x+((y/20)%2?20:0),y,1,20,'#a8955f')}
  R_(c,0,0,320,38,'#efe6cf');for(let x=0;x<320;x+=16){R_(c,x,0,1,38,'#7a5a3a')}R_(c,0,12,320,1,'#7a5a3a');R_(c,0,25,320,1,'#7a5a3a');R_(c,0,36,320,3,'#5a3a22');
  R_(c,140,2,40,34,'#c9b48a');R_(c,152,5,16,26,'#f4ece1');R_(c,155,9,10,16,'#3b2a1e');R_(c,140,34,40,3,'#5a3a22');   // 壁龕與掛軸
  R_(c,184,24,8,10,'#2f5d3a');R_(c,186,20,4,6,'#e07a9a');                // 生花
  const seats=partySeats();
  const sitAt=(x,y,look,speak)=>{
    R_(c,x-7,y-3,14,6,'#8b2c3a');                                       // 坐墊
    if(look){drawPerson(c,x,y,Object.assign({frame:0},look));R_(c,x-7,y-4,14,5,'#8b2c3a')}
    R_(c,x-5,y+3,10,3,'#2a1a12');R_(c,x-3,y+2,2,1,'#e8dcc4');R_(c,x+1,y+2,2,1,'#c0392b');   // 膳台
    if(speak){R_(c,x-9,y-30,18,9,'#fffef8');R_(c,x-1,y-21,3,2,'#fffef8');c.fillStyle='#3b2a1e';c.font='8px DotGothic16,monospace';c.textBaseline='top';c.fillText('…',x-4,y-31)}
  };
  sitAt(160,50,{cloth:'#1e2d4a',cloth2:'#e8dcc4',gold:true,hair:(myAge()>=55)?'#c8c8c8':'#1a1612'},L.who===-1);   // 上座：主人
  R_(c,152,53,16,2,'#e5a93b');
  seats.forEach((p,i)=>{const a=P.att[i];sitAt(p[0],p[1],a?a.look:null,a&&L.who===i)});
}
