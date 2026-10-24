/* ======================= 雇員好感：零用錢、保鏢暗殺、手代番頭放火、船長走私 =======================
 *  - 雇員（含保鏢、船長）好感起始 40；給零用錢 5 兩，好感 +3～5，滿 100 後不能再給；每人每旬只能給一次。
 *  - 保鏢好感 100：出現「暗殺」指令，可對認識的人下手。
 *  - 船長好感 100：才肯出海走私（走私入口才會出現）。船長只列在河岸碼頭。
 *  - 大番頭好感 100：可替你做帳，公款 500 兩轉私房錢、或私房錢 1000 兩轉公款；每次好感 −20，他私吞 5～10%（記入私吞帳，查帳可追回）。不加風聲。 */
const empAff=e=>{if(e.aff===undefined)e.aff=40;return e.aff};
/** 好感列＋零用錢鈕；保鏢、船長滿格時另有專屬指令。 */
function empAffHtml(e,ctx){
  const a=empAff(e),full=a>=100,given=e.allowT===G.turn;
  let h='<div class="row small" style="margin-top:3px"><span>好感 <b>'+Math.round(a)+'</b>／100</span><div style="width:90px">'+bar(a,100,'gold')+'</div>'
    +'<button class="pixel-btn btn-sm" data-act="allow" data-id="'+e.id+'" '+(full||given?'disabled':'')+'>'+(full?UT('btn.allowFull'):given?UT('btn.allowDone'):UT('btn.allow',{c:costBtn('allowance')}))+'</button></div>';
  if(e.rank==='保鏢'&&full)h+=assassinHtml(e);
  if(arsonOK(e))h+=arsonHtml(e);
  if(e.rank==='大番頭'&&full)h+=chiefBookHtml(e);
  if(e.rank==='船長'&&full)h+='<div class="tiny" style="color:#5b4a70;margin-top:2px">🏴‍☠️ 他對你死心塌地，肯替你跑「走私」（走私）。</div>';
  return h;
}
/* ---------- 大番頭做帳：公款與私房錢互轉（好感 100） ---------- */
const CHIEF_BOOK={toGold:500,toSilver:1000,aff:20,cutMin:0.05,cutMax:0.10};
function chiefBookHtml(e){
  const B=CHIEF_BOOK;
  return '<div class="card" style="margin:4px 0"><b class="small">📒 做帳</b><div class="tiny muted">他願替你把帳做平，不留痕跡。每做一次，好感 -'+B.aff+'。</div>'
    +'<div class="grid2" style="margin-top:4px"><button class="pixel-btn btn-sm btn-gold" data-act="chiefBook" data-id="'+e.id+'" data-d="g" '+(G.silver<B.toGold?'disabled':'')+'>公款 '+fmt(B.toGold)+' 兩轉私房錢</button>'
    +'<button class="pixel-btn btn-sm btn-green" data-act="chiefBook" data-id="'+e.id+'" data-d="s" '+(G.gold<B.toSilver?'disabled':'')+'>私房錢 '+fmt(B.toSilver)+' 兩轉公款</button></div>'+purseTierNote()+'</div>';
}
ACT.chiefBook=el=>{
  const e=G.emps.find(x=>x.id===el.dataset.id),B=CHIEF_BOOK;if(!e||e.rank!=='大番頭'||empAff(e)<100)return;
  const toGold=el.dataset.d==='g',amt=toGold?B.toGold:B.toSilver;
  if(toGold?G.silver<amt:G.gold<amt){toast(toGold?'帳上現款不足。':'私房錢不足。');return}
  const cut=Math.round(amt*(B.cutMin+rnd()*(B.cutMax-B.cutMin))),net=amt-cut;
  if(toGold){G.silver-=amt;G.gold+=net}else{G.gold-=amt;G.silver+=net}
  e.skim=(e.skim||0)+cut;e.aff=Math.max(0,empAff(e)-B.aff);
  sfx.coin();toast('「'+e.name+'」把帳做平了，'+(toGold?'私房錢':'現款')+' +'+fmt(net)+' 兩。（好感 -'+B.aff+'）',3600);
  UI.render();refreshSheet();
};
ACT.allow=el=>{
  const e=G.emps.find(x=>x.id===el.dataset.id);if(!e)return;
  if(empAff(e)>=100){toast(MSG('allow.1'));return}
  if(e.allowT===G.turn){toast(MSG('allow.2'));return}
  if(!afford('allowance')){toast(shortMsg('allowance'));return}
  spend('allowance');const g=rint(3,5);e.aff=Math.min(100,empAff(e)+g);e.allowT=G.turn;
  sfx.coin();toast(MSG('allow.3',{name:e.name,g,aff:Math.round(e.aff)}));
  UI.render();refreshSheet();
};

/* ---------- 河岸碼頭：船長名單 ---------- */
function dockCrewHtml(){
  const cs=G.emps.filter(e=>e.rank==='船長');
  let h='<div class="small bold" style="margin:8px 0 2px">⚓ 船長（'+cs.length+'／'+slotCap('船長')+'）</div>';
  if(!cs.length)return h+'<div class="notice tiny">還沒有船長。到「商號」頁請介紹人物色，聘為專職。</div>'+smuggleButton();
  return h+smuggleButton()+cs.map(e=>{
    const busy=G.ships.some(s=>s.capt===e.id)||(G.smug||[]).some(v=>v.capt===e.id);
    return '<div class="card" style="display:flow-root">'+portraitEmp(e,56)+'<div class="row"><div><b>【船長】'+esc(e.name)+'</b> '+(busy?'<span class="tag gray">出海中</span>':'<span class="tag green">在港</span>')+'<div class="tiny muted">月例 '+e.wage+' 兩／旬·任職 '+(G.turn-e.since)+' 旬</div></div><div class="tiny">評價 '+ratingStars(e.cid||statsOfEmp(e))+'</div></div>'
      +empAffHtml(e,'dock')+'<div style="margin-top:3px"><button class="pixel-btn btn-sm" data-act="fireDock" data-id="'+e.id+'">'+UT('btn.fireDock')+'</button></div></div>';
  }).join('');
}
{const _wh=SHEETS.warehouse;SHEETS.warehouse=()=>{const r=_wh();r.html+=dockCrewHtml();return r}}
ACT.fireDock=el=>{ACT.fire(el);if(!G.emps.some(x=>x.id===el.dataset.id))refreshSheet()};

/* ---------- 船長走私資格 ---------- */
/** 空閒且好感滿格的船長。 */
function smugCaptain(){
  const used=new Set(G.ships.filter(s=>s.mode==='sea').map(s=>s.capt));(G.smug||[]).forEach(v=>used.add(v.capt));
  return G.emps.find(e=>e.rank==='船長'&&empAff(e)>=100&&!used.has(e.id))||null;
}

/* ---------- 保鏢暗殺 ---------- */
function assTargets(){
  return Object.keys(G.rel).filter(cid=>{const r=G.rel[cid],n=npc(cid);return r&&r.bond&&n&&alive(cid)&&!G.emps.some(x=>x.cid===cid)})
    .map(cid=>npc(cid)).sort((a,b)=>(b.pos?b.pos.rank:0)-(a.pos?a.pos.rank:0));
}
const assRank=n=>n.pos?n.pos.rank:(['rival','smuggler'].includes(n.role)?3:2);
function assChance(e,n){const s=statsOfEmp(e),A_=ODDS.assassin;return clamp(A_.base+s.audacity_courage/A_.courageDiv+s.commerce_skill/A_.commerceDiv-assRank(n)*A_.perRank,A_.min,A_.max)}
function assassinHtml(e){
  const ts=assTargets();
  let h='<div class="card warn" style="margin:4px 0"><b class="small">🗡️ 暗殺</b><div class="tiny muted">他願為你除掉一個你認識的人。'+costTxt('assassin')+'、耗 1 行動；成敗看他的膽識與對方官階，事後可能被官府追查。失手則他一去不回，對方成為仇人。</div>';
  if(!ts.length)return h+'<div class="tiny muted">你還沒有認識的人可下手。</div></div>';
  h+='<div class="row" style="gap:4px;margin-top:3px"><select class="ass-sel" style="flex:1;font-size:11px">'+ts.map(n=>'<option value="'+n.cid+'">'+esc(nameOf(n.cid))+'（'+esc(n.pos?posTitle(n):(ROLE_LABEL[n.role]||''))+'·成功約 '+Math.round(assChance(e,n)*100)+'%）</option>').join('')+'</select>'
    +'<button class="pixel-btn btn-sm btn-red" data-act="assassinate" data-id="'+e.id+'">'+UT('btn.assassinate')+'</button></div></div>';
  return h;
}
ACT.assassinate=el=>{
  const e=G.emps.find(x=>x.id===el.dataset.id),card=el.closest('.card'),sel=card&&card.querySelector('.ass-sel');
  if(!e||e.rank!=='保鏢'||empAff(e)<100||!sel)return;
  const cid=sel.value,n=npc(cid);if(!n)return;
  if((G.exile||0)>0){toast(MSG('assassinate.1'));return}
  if(!afford('assassin')){toast(shortMsg('assassin'));return}
  if(!spendAP())return;
  spend('assassin');G.heat=(G.heat||0)+3;
  const p=assChance(e,n),name=nameOf(cid),rank=assRank(n),log=[];
  playFx('walk',MSG('assassinate.fx'),MSG('assassinate.fxTitle'),()=>{
    if(chance(p)){
      G.slain=G.slain||[];G.slain.push(cid);G.life.assassinated=(G.life.assassinated||0)+1;
      if(n.role==='official'&&n.pos){const rep=replaceOfficial(n);if(rep)addKnown(rep)}
      delete G.world.npcs[cid];
      G.intros=G.intros.filter(i=>i.cid!==cid);if(G.introId===cid)G.introId=G.intros[0]?G.intros[0].cid:null;
      R(cid).slain=true;logRel(cid,'死於非命。');
      pushNews(NEWS('assassinate.1',{cid:nameOf(cid)}));sfx.bad();
      let msg='「'+name+'」於夜間遇害。';
      if(chance(clamp(ODDS.assInvestigate.base+ODDS.assInvestigate.perHeat*(G.heat||0)+rank*ODDS.assInvestigate.perRank,ODDS.assInvestigate.min,ODDS.assInvestigate.max))){
        const loyal=statsOfEmp(e).integrity_loyalty;
        G.emps=G.emps.filter(x=>x!==e);loseFame('arrest');
        if(chance(confessP(loyal))){msg+=MSG('assassinate.2',{name:e.name});doRaid('testimony',log)}
        else msg+=MSG('assassinate.3',{name:e.name});
      }
      toast(msg,5200);
    }else{
      G.emps=G.emps.filter(x=>x!==e);G.heat=(G.heat||0)+2;
      const r=R(cid);r.aff=0;r.peak=Math.max(r.peak||0,40);logRel(cid,'遭人行刺未遂，視你為仇。');
      sfx.bad();toast(MSG('assassinate.4',{name:e.name,name2:name}),5200);
    }
    UI.render();refreshSheet();
  },1000);
};

/* ---------- 手代／番頭放火（膽識 ≥70、好感 100；機制同暗殺）---------- */
const arsonOK=e=>(e.rank==='手代'||e.rank==='番頭')&&empAff(e)>=100&&statsOfEmp(e).audacity_courage>=ODDS.arson.minCourage;
function arsonChance(e){const s=statsOfEmp(e),A_=ODDS.arson;return clamp(A_.base+s.audacity_courage/A_.courageDiv+s.commerce_skill/A_.commerceDiv-A_.rank*A_.perRank,A_.min,A_.max)}
function arsonHtml(e){
  return '<div class="card warn" style="margin:4px 0"><b class="small">🔥 放火</b><div class="tiny muted">他願潛入某家同業的倉庫放火（對象隨機）。'+costTxt('arson')+'、耗 1 行動；成功約 '+Math.round(arsonChance(e)*100)+'%，事後可能被官府追查。失手則他一去不回，對方成為仇人。</div>'
    +'<div style="margin-top:3px"><button class="pixel-btn btn-sm btn-red" data-act="arson" data-id="'+e.id+'">'+UT('btn.arson')+'</button></div></div>';
}
ACT.arson=el=>{
  const e=G.emps.find(x=>x.id===el.dataset.id);if(!e||!arsonOK(e))return;
  if((G.exile||0)>0){toast(MSG('arson.exile'));return}
  const rv=rivalsHere().filter(n=>alive(n.cid));if(!rv.length){toast(MSG('arson.noRival'));return}
  if(!afford('arson')){toast(shortMsg('arson'));return}
  if(!spendAP())return;
  spend('arson');G.heat=(G.heat||0)+3;
  const tg=pick(rv),p=arsonChance(e),name=nameOf(tg.cid),log=[];
  playFx('walk',MSG('arson.fx',{rank:e.rank}),MSG('arson.fxTitle'),()=>{
    if(chance(p)){
      const m=msOf(tg);m.stock=Math.min(m.stock,0.2);m.ev=0.6;m.evT=4;G.share=marketShares();
      G.life.arsons=(G.life.arsons||0)+1;logRel(tg.cid,'倉庫遭人縱火。');
      pushNews(NEWS('arson.1',{name}));sfx.bad();
      let msg=MSG('arson.ok',{name});
      const I=ODDS.arsonInvestigate;
      if(chance(clamp(I.base+I.perHeat*(G.heat||0)+I.rank*I.perRank,I.min,I.max))){
        const loyal=statsOfEmp(e).integrity_loyalty;
        G.emps=G.emps.filter(x=>x!==e);loseFame('arrest');
        if(chance(confessP(loyal))){msg+=MSG('arson.caught',{rank:e.rank,name:e.name});doRaid('testimony',log)}
        else msg+=MSG('arson.silent',{rank:e.rank,name:e.name});
      }
      toast(msg,5200);
    }else{
      G.emps=G.emps.filter(x=>x!==e);G.heat=(G.heat||0)+2;
      const r=R(tg.cid);r.aff=0;r.peak=Math.max(r.peak||0,40);logRel(tg.cid,'派人縱火未遂，視你為仇。');
      sfx.bad();toast(MSG('arson.fail',{rank:e.rank,name:e.name,target:name}),5200);
    }
    UI.render();refreshSheet();
  },1000);
};
