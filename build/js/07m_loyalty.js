/* ======================= 雇員好感：零用錢、保鏢暗殺、手代番頭放火、船長走私 =======================
 *  - 雇員（含保鏢、船長）好感起始 40；給零用錢 5 兩，好感 +3～5，滿 100 後不能再給；每人每旬只能給一次。
 *  - 保鏢好感 100：出現「暗殺」指令，只能對仇人或本城同業下手；名單不列成功率與職位。
 *  - 船長好感 100：才肯出海走私（走私入口才會出現）。船長、飛腳只列在河岸碼頭。
 *  - 大番頭好感 100：可替你做帳，公款 500 兩轉私房錢、或私房錢 1000 兩轉公款；每次好感 −20，他私吞 5～10%（記入私吞帳，查帳可追回）。不加風聲。 */
const empAff=e=>{if(e.aff===undefined)e.aff=40;return e.aff};
/** 好感列＋零用錢鈕；保鏢、船長滿格時另有專屬指令。 */
function empAffHtml(e,ctx){
  const a=empAff(e),full=a>=100,given=e.allowT===G.turn;
  let h=UT('loyal.h',{a:Math.round(a),b:bar(a,100,'gold')})+'</div>'+'<button class="pixel-btn btn-sm" data-act="allow" data-id="'+e.id+'" '+(full||given?'disabled':'')+'>'+(full?UT('btn.allowFull'):given?UT('btn.allowDone'):UT('btn.allow',{c:costBtn('allowance')}))+'</button></div>';
  if(e.rank==='guard'&&full)h+=assassinHtml(e);
  if(arsonOK(e))h+=arsonHtml(e);
  if(e.rank==='chief'&&full)h+=chiefBookHtml(e);
  if(e.rank==='captain'&&full)h+=UT('loyal.empAffHtml');
  return h;
}
/* ---------- 大番頭做帳：公款與私房錢互轉（好感 100） ---------- */
const CHIEF_BOOK={toGold:500,toSilver:1000,aff:20,cutMin:0.05,cutMax:0.10};
function chiefBookHtml(e){
  const B=CHIEF_BOOK;
  return UT('loyal.chiefBookHtml',{a:B.aff})+'<div class="grid2" style="margin-top:4px"><button class="pixel-btn btn-sm btn-gold" data-act="chiefBook" data-id="'+e.id+'" data-d="g" '+UT('loyal.chiefBookHtml.2',{a:G.silver<B.toGold?'disabled':'',b:fmt(B.toGold)})+'<button class="pixel-btn btn-sm btn-green" data-act="chiefBook" data-id="'+e.id+'" data-d="s" '+UT('loyal.chiefBookHtml.3',{a:G.gold<B.toSilver?'disabled':'',b:fmt(B.toSilver),c:purseTierNote()})+'</div>';
}
ACT.chiefBook=el=>{
  const e=G.emps.find(x=>x.id===el.dataset.id),B=CHIEF_BOOK;if(!e||e.rank!=='chief'||empAff(e)<100)return;
  const toGold=el.dataset.d==='g',amt=toGold?B.toGold:B.toSilver;
  if(toGold?G.silver<amt:G.gold<amt){toast(toGold?MSG('loyal.chiefBook'):MSG('loyal.chiefBook.2'));return}
  const cut=Math.round(amt*(B.cutMin+rnd()*(B.cutMax-B.cutMin))),net=amt-cut;
  if(toGold){G.silver-=amt;G.gold+=net}else{G.gold-=amt;G.silver+=net}
  e.skim=(e.skim||0)+cut;e.aff=Math.max(0,empAff(e)-B.aff);
  sfx.coin();toast(MSG('loyal.chiefBook.5',{a:e.name,b:toGold?MSG('loyal.chiefBook.3'):MSG('loyal.chiefBook.4'),c:fmt(net),d:B.aff}),3600);
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

/* ---------- 河岸碼頭：船長、飛腳名單 ---------- */
function dockCrewHtml(){
  const block=(rk,icon,away,home,none)=>{
    const cs=G.emps.filter(e=>e.rank===rk);
    let h='<div class="small bold" style="margin:8px 0 2px">'+UT('loyal.h.2',{a:icon,b:rankName(rk),c:cs.length,d:slotCap(rk)});
    if(!cs.length)return h+'<div class="notice tiny">'+none+'</div>'+(rk==='captain'?smuggleButton():'');
    return h+(rk==='captain'?smuggleButton():'')+cs.map(e=>{
      const busy=G.ships.some(s=>s.capt===e.id)||(G.smug||[]).some(v=>v.capt===e.id);
      return '<div class="card'+(busy?' locked':'')+'" style="display:flow-root">'+UT('loyal.block',{a:portraitEmp(e,56),b:rankName(rk),c:esc(e.name)})+'</b> '+UT('loyal.block.2',{a:busy?'<span class="tag gray">'+away+'</span>':'<span class="tag green">'+home+'</span>',b:e.wage,c:staffTenure(e)})+'</div>'+UT('loyal.block.3',{a:staffTags(e),b:ratingStars(e.cid||statsOfEmp(e))})+'</div></div>'+empAffHtml(e,'dock')+'<div style="margin-top:3px;display:flex;gap:4px;flex-wrap:wrap">'+auditBtns(e)+'<button class="pixel-btn btn-sm" data-act="fireDock" data-id="'+e.id+'">'+UT('btn.fireDock')+'</button></div></div>';
    }).join('');
  };
  return block('captain','⚓',UT('loyal.dockCrewHtml'),UT('loyal.dockCrewHtml.2'),UT('loyal.dockCrewHtml.3'))+block('courier','🐎',UT('loyal.dockCrewHtml.4'),UT('loyal.dockCrewHtml.5'),UT('loyal.dockCrewHtml.6'));
}
{const _wh=SHEETS.warehouse;SHEETS.warehouse=()=>{const r=_wh();r.html+=dockCrewHtml();return r}}
ACT.fireDock=el=>{ACT.fire(el);if(!G.emps.some(x=>x.id===el.dataset.id))refreshSheet()};

/* ---------- 船長走私資格 ---------- */
/** 空閒且好感滿格的船長。 */
function smugCaptain(){
  const used=new Set(G.ships.filter(s=>s.mode==='sea').map(s=>s.capt));(G.smug||[]).forEach(v=>used.add(v.capt));(G.voyQueue||[]).forEach(q=>used.add(q.capt));   // 已排進出運清單的船長不派去走私
  return G.emps.find(e=>e.rank==='captain'&&empAff(e)>=100&&!used.has(e.id))||null;
}

/* ---------- 保鏢暗殺 ---------- */
/** 暗殺對象：只限仇人與本城同業（仇人在前）。 */
function assTargets(){
  const ok=n=>n&&alive(n.cid)&&!G.emps.some(x=>x.cid===n.cid);
  const foes=enemies().map(cid=>npc(cid)).filter(ok);
  return foes.concat(rivalsHere().filter(n=>ok(n)&&!foes.includes(n)));
}
const assRank=n=>n.pos?n.pos.rank:(['rival','smuggler'].includes(n.role)?3:2);
function assChance(e,n){const s=statsOfEmp(e),A_=ODDS.assassin;return clamp(A_.base+s.audacity_courage/A_.courageDiv+s.commerce_skill/A_.commerceDiv-assRank(n)*A_.perRank,A_.min,A_.max)}
function assassinHtml(e){
  const ts=assTargets();
  let h=UT('loyal.h.3',{a:costTxt('assassin')});
  if(!ts.length)return UT('loyal.assassinHtml',{a:h});
  h+='<div class="row" style="gap:4px;margin-top:3px"><select class="ass-sel" style="flex:1">'+ts.map(n=>'<option value="'+n.cid+'">'+UT('loyal.assassinHtml.4',{a:esc(nameOf(n.cid)),b:isEnemy(n.cid)?UT('loyal.assassinHtml.2'):UT('loyal.assassinHtml.3')})).join('')+'</select>'
    +'<button class="pixel-btn btn-sm btn-red" data-act="assassinate" data-id="'+e.id+'">'+UT('btn.assassinate')+'</button></div></div>';
  return h;
}
ACT.assassinate=el=>{
  const e=G.emps.find(x=>x.id===el.dataset.id),card=el.closest('.card'),sel=card&&card.querySelector('.ass-sel');
  if(!e||e.rank!=='guard'||empAff(e)<100||!sel)return;
  const cid=sel.value,n=npc(cid);if(!n||!assTargets().includes(n))return;
  if((G.exile||0)>0){toast(MSG('assassinate.1'));return}
  if(!afford('assassin')){toast(shortMsg('assassin'));return}
  if(!spendAP())return;
  spend('assassin');addHeat(3,true);
  const p=assChance(e,n),name=nameOf(cid),rank=assRank(n),log=[];
  playFx('walk',MSG('assassinate.fx'),MSG('assassinate.fxTitle'),()=>{
    if(chance(p)){
      G.slain=G.slain||[];G.slain.push(cid);G.life.assassinated=(G.life.assassinated||0)+1;
      if(n.role==='official'&&n.pos){const rep=replaceOfficial(n);if(rep)addKnown(rep)}
      noteRivalSlain(n);                          // 同業遭害：旬末由私生子繼承（07y_guild.js）
      delete G.world.npcs[cid];
      G.intros=G.intros.filter(i=>i.cid!==cid);if(G.introId===cid)G.introId=G.intros[0]?G.intros[0].cid:null;
      R(cid).slain=true;logRel(cid,UT('loyal.assassinate'));
      pushNews(NEWS('assassinate.1',{cid:nameOf(cid)}));sfx.bad();
      let msg=UT('loyal.msg',{a:name});
      if(chance(clamp(ODDS.assInvestigate.base+ODDS.assInvestigate.perHeat*(G.heat||0)+rank*ODDS.assInvestigate.perRank,ODDS.assInvestigate.min,ODDS.assInvestigate.max))){
        const loyal=statsOfEmp(e).integrity_loyalty;
        G.emps=G.emps.filter(x=>x!==e);loseFame('arrest');
        if(chance(confessP(loyal))){msg+=MSG('assassinate.2',{name:e.name});doRaid('testimony',log)}
        else msg+=MSG('assassinate.3',{name:e.name});
      }
      toast(msg,5200);
    }else{
      G.emps=G.emps.filter(x=>x!==e);addHeat(2,true);
      const r=R(cid);setAff(r,0);r.peak=Math.max(r.peak||0,40);logRel(cid,UT('loyal.assassinate.2'));
      sfx.bad();toast(MSG('assassinate.4',{name:e.name,name2:name}),5200);
    }
    UI.render();refreshSheet();
  },1000);
};

/* ---------- 手代／番頭放火（膽識 ≥70、好感 100；機制同暗殺）---------- */
const arsonOK=e=>(e.rank==='clerk'||e.rank==='banto')&&empAff(e)>=100&&statsOfEmp(e).audacity_courage>=ODDS.arson.minCourage;
function arsonChance(e){const s=statsOfEmp(e),A_=ODDS.arson;return clamp(A_.base+s.audacity_courage/A_.courageDiv+s.commerce_skill/A_.commerceDiv-A_.rank*A_.perRank,A_.min,A_.max)}
function arsonHtml(e){
  return UT('loyal.arsonHtml',{a:costTxt('arson'),b:Math.round(arsonChance(e)*100)})+'<div style="margin-top:3px"><button class="pixel-btn btn-sm btn-red" data-act="arson" data-id="'+e.id+'">'+UT('btn.arson')+'</button></div></div>';
}
ACT.arson=el=>{
  const e=G.emps.find(x=>x.id===el.dataset.id);if(!e||!arsonOK(e))return;
  if((G.exile||0)>0){toast(MSG('arson.exile'));return}
  const rv=rivalsHere().filter(n=>alive(n.cid));if(!rv.length){toast(MSG('arson.noRival'));return}
  if(!afford('arson')){toast(shortMsg('arson'));return}
  if(!spendAP())return;
  spend('arson');addHeat(3,true);
  const tg=pick(rv),p=arsonChance(e),name=nameOf(tg.cid),log=[];
  playFx('walk',MSG('arson.fx',{rank:rankName(e.rank)}),MSG('arson.fxTitle'),()=>{
    if(chance(p)){
      const m=msOf(tg);m.stock=Math.min(m.stock,0.2);m.ev=0.6;m.evT=4;G.share=marketShares();
      G.life.arsons=(G.life.arsons||0)+1;logRel(tg.cid,UT('loyal.arson'));
      pushNews(NEWS('arson.1',{name}));sfx.bad();
      let msg=MSG('arson.ok',{name});
      const I=ODDS.arsonInvestigate;
      if(chance(clamp(I.base+I.perHeat*(G.heat||0)+I.rank*I.perRank,I.min,I.max))){
        const loyal=statsOfEmp(e).integrity_loyalty;
        G.emps=G.emps.filter(x=>x!==e);loseFame('arrest');
        if(chance(confessP(loyal))){msg+=MSG('arson.caught',{rank:rankName(e.rank),name:e.name});doRaid('testimony',log)}
        else msg+=MSG('arson.silent',{rank:rankName(e.rank),name:e.name});
      }
      toast(msg,5200);
    }else{
      G.emps=G.emps.filter(x=>x!==e);addHeat(2,true);
      const r=R(tg.cid);setAff(r,0);r.peak=Math.max(r.peak||0,40);logRel(tg.cid,UT('loyal.arson.2'));
      sfx.bad();toast(MSG('arson.fail',{rank:rankName(e.rank),name:e.name,target:name}),5200);
    }
    UI.render();refreshSheet();
  },1000);
};
