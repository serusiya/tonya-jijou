/* ═════ [07l_flower] ═════ */
/* ======================= 吉原花街：夜宴、指名名伶、贖身成側室 =======================
 * 規則：
 *  - 城中名伶固定 8 人，每旬只有 4 人在席（以旬數雜湊決定，同一旬內固定）。
 *  - 包場花金夜宴：私房錢 80 兩，不扣行動點數，每旬一次；席間 1～3 名官吏／商人好感 +3～5，直接算結識，各講一句謝詞。
 *  - 指名：私房錢 20 兩，好感 +5；2 旬沒再指名，好感 -4（最低 1）。每次指名只能送一件禮物，花私房錢且價格加倍，好感 +5～10 並透露一人軟肋。
 *  - 好感滿（100）可贖身：約 1000 兩（±100）。贖後為側室，與家人無異，不能生育。
 *  - 吉原累計花費每滿 200 兩，知名度 -0.5。 */
const FL_STAGE=4,FL_TOTAL=8,FL_UNIT=200;
function FL(){return G.flower||(G.flower={feast:-99,spent:0})}
/** 記錄吉原花費；每滿 200 兩扣 0.5 知名度。回傳附加在訊息後的說明。 */
function flowerSpend(x){
  const F=FL();F.spent+=x;const k=Math.floor(F.spent/FL_UNIT);
  if(k<=0)return '';
  F.spent-=FL_UNIT*k;const fl=loseFame('flowerPer200',k);return UT('flower.flowerSpend.2',{a:fl?UT('flower.flowerSpend',{a:fl}):''});
}
const hshStr=s=>{let h=7;for(const ch of String(s))h=(h*131+ch.charCodeAt(0))>>>0;return h};
const oiranAll=cityId=>cityNpcs(cityId||G.cityId,'oiran');
/** 今旬在席的 4 位名伶（同一旬固定）。 */
function oiranOnStage(cityId){
  const id=cityId||G.cityId;
  return oiranAll(id).map(n=>[hshStr(n.cid+'@'+G.turn+'@'+id),n]).sort((a,b)=>a[0]-b[0]).slice(0,FL_STAGE).map(x=>x[1]);
}
/** 補足某城名伶至 8 人（開局、讀舊檔、名伶病逝／贖身後）。 */
function topUpOiran(W,cityId,year,excl){
  const ok=n=>{const c=CH(n.cid);return c&&c.birth_year<=year&&c.death_year>year};
  const cur=Object.values(W.npcs).filter(n=>n.cityId===cityId&&n.role==='oiran'&&ok(n)).length;
  if(cur>=FL_TOTAL)return;
  const ex=new Set(excl||[]);
  let pool=CHARS.filter(c=>!W.npcs[c.id]&&!ex.has(c.id)&&c.birth_year<=year-16&&c.death_year>year+2);
  const a=pool.filter(c=>hasRole(c,'oiran')),b=pool.filter(c=>c.gender==='f'&&c.birth_year>=year-40&&!hasRole(c,'oiran'));
  const sh=l=>l.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(x=>x[1]);
  sh(a).concat(sh(b)).slice(0,FL_TOTAL-cur).forEach(c=>{W.npcs[c.id]={cid:c.id,cityId,role:'oiran',pos:null}});
}
/** 每旬：名伶補額；久未指名的名伶好感下降。 */
function oiranTick(log){
  topUpOiran(G.world,G.cityId,G.year,(G.family.conc||[]).map(x=>x.cid));
  oiranAll().forEach(n=>{
    const r=R(n.cid);if(!r.bond||r.aff<=1)return;
    if(r.nomT===undefined)r.nomT=G.turn;
    const last=Math.max(r.nomT,r.decT===undefined?-99:r.decT);
    if(G.turn-last>=2){setAff(r,Math.max(1,r.aff-4));r.decT=G.turn}
  });
}

/** 送名伶的禮：10 種首飾與化妝品，基本價 100～300 兩（指名後再 ×2）。 */
const OIRAN_GIFTS=[['o1','📿'],['o2','🎨'],['o3','💄'],['o4','🧴'],['o5','🖌️'],['o6','🪮'],['o7','🪞'],['o8','🟠'],['o9','💍'],['o10','🌺']].map(([k,icon])=>({k,icon,name:COSTS['oiranGift_'+k].name.replace(UT('oiran.giftPrefix'),''),base:COSTS['oiranGift_'+k].amt}));
const OG_MAP={};OIRAN_GIFTS.forEach(g=>OG_MAP[g.k]=g);
/* ---------- 名伶卡片 ---------- */
function oiranBlock(cid){
  const c=CH(cid),r=R(cid);
  autoIntro(cid);const via=(G.introId&&introOf(G.introId))?1:0;
  const locked=!r.bond&&meetTierNeed(cid)>fameTier()+via;
  const nom=r.nomT===G.turn;
  let h='<div class="card'+(locked?' locked':'')+'" data-cid="'+cid+'">'+portraitBtn(cid,56);
  h+='<div class="row"><div><b>'+UT('flower.oiranBlock',{a:esc(c.name)});
  h+='<div class="tiny muted" style="margin:2px 0">'+esc(c.family_summary.slice(0,46))+'……</div>';
  if(locked)return UT('flower.oiranBlock.2',{a:h});
  if(r.bond){
    h+=UT('flower.oiranBlock.3',{a:affCls(r.aff)})+'">'+affWord(r.aff)+'</span> '+UT('flower.oiranBlock.4',{a:Math.round(r.aff),b:bar(r.aff,100,'gold')})+'</div></div>';
    h+='<div class="tiny muted">'+UT('flower.oiranBlock.6',{a:r.nomT!==undefined?UT('flower.oiranBlock.5',{a:G.turn-r.nomT}):''});
  }else h+=UT('flower.oiranBlock.7');
  h+='<div style="margin-top:4px"><button class="pixel-btn btn-sm btn-gold" style="width:100%" data-act="nomOiran" data-cid="'+cid+'" '+(nom?'disabled':'')+'>'+(nom?UT('btn.nomDone'):UT('btn.nom',{c:costBtn('nominate')}))+'</button></div>';
  if(nom){
    if(r.oGiftT===r.nomT)h+=UT('flower.oiranBlock.8');
    else{
      h+=UT('flower.oiranBlock.10',{a:OIRAN_GIFTS.map(g=>'<option value="'+g.k+'">'+UT('flower.oiranBlock.9',{a:g.icon,b:g.name,c:costTxt('oiranGift_'+g.k,COSTS.oiranGiftMul.amt)})).join('')})+'</select></div>';
      h+='<div style="margin-top:3px"><button class="pixel-btn btn-sm" style="width:100%" data-act="oGift" data-cid="'+cid+'">'+UT('btn.oGift')+'</button></div>';
    }
  }
  if(r.bond&&r.aff>=100){
    const price=r.ransom||(r.ransom=costOf('ransom')+rint(-100,100));
    h+='<div style="margin-top:4px"><button class="pixel-btn btn-sm btn-green" style="width:100%" data-act="ransom" data-cid="'+cid+'">'+UT('btn.ransom',{c:coinHtml('gold',price)})+'</button></div>';
  }
  return h+'</div>';
}
ACT.nomOiran=el=>{
  const cid=el.dataset.cid,n=npc(cid),r=R(cid);
  if(!n||n.role!=='oiran')return;
  if(isEnemy(cid)){toast(MSG('nomOiran.1'));return}
  if(!oiranOnStage().some(x=>x.cid===cid)){toast(MSG('nomOiran.2'));return}
  if(r.nomT===G.turn){toast(MSG('nomOiran.3'));return}
  autoIntro(cid);if(!r.bond&&meetTierNeed(cid)>fameTier()+((G.introId&&introOf(G.introId))?1:0)){toast(MSG('nomOiran.4'));return}
  if(!afford('nominate')){toast(shortMsg('nominate'));return}
  const note=flowerSpend(spend('nominate'));
  if(!r.bond){r.bond={mult:1,label:UT('flower.nomOiran'),introId:null};r.met=true;r.seen=true;addKnown(cid);if(!r.fameGot){r.fameGot=true;addFame(0.6)}}
  setAff(r,clamp(r.aff+5,0,100));r.nomT=G.turn;r.decT=G.turn;
  if(nomCountTurn()>=ODDS.sick.flower.nom)sickArm('flower');   // 一旬指名到第三位：離開吉原或推進時病倒（07zzd_sick.js）
  logRel(cid,UT('flower.nomOiran.2'));sfx.gift();
  const sm=chance(ODDS.smugMeet.nominate)?meetSmuggler('nominate'):null;   // 隔壁座敷偶遇闇商人
  const rn=chance(ODDS.ronin.nominate)?meetRonin('nominate'):null;          // 隔壁座敷偶遇浪人頭
  toast(MSG('nomOiran.5',{cid:nameOf(cid),aff:Math.round(r.aff),note})+(sm?MSG('smug.meet.nominate',{n:nameOf(sm)}):'')+(rn?MSG('ronin.meet.nominate',{n:nameOf(rn)}):''),sm||rn?5200:3600);
  UI.render();refreshSheet();
};
ACT.oGift=el=>{
  const cid=el.dataset.cid,r=R(cid),card=el.closest('.card'),g=OG_MAP[card.querySelector('.og-sel').value];
  if(!g||r.nomT!==G.turn){toast(MSG('oGift.1'));return}
  if(r.oGiftT===r.nomT){toast(MSG('oGift.3'));return}
  const gk='oiranGift_'+g.k,cost=costOf(gk,COSTS.oiranGiftMul.amt);
  if(!affordAmt(gk,cost)){toast(shortMsg(gk,COSTS.oiranGiftMul.amt));return}
  spendAmt(gk,cost);r.oGiftT=r.nomT;const note=flowerSpend(cost);
  const gain=rint(5,10);setAff(r,clamp(r.aff+gain,0,100));r.gifts++;G.life.gifts++;addFame(0.15);
  const cand=cityNpcs(G.cityId).filter(m=>m.cid!==cid&&!['guard','oiran'].includes(m.role)&&!R(m.cid).verified);
  let tip=TX('flower.tipNone');
  if(cand.length){const m=pick(cand);R(m.cid).verified=true;addKnown(m.cid);tip=TX('flower.tip',{n:nameOf(m.cid),w:weakName(CH(m.cid).weakness)});logRel(m.cid,UT('flower.oGift',{a:nameOf(cid),b:weakName(CH(m.cid).weakness)}))}
  logRel(cid,UT('flower.oGift.2',{a:g.name,b:gain}));sfx.gift();
  toast(MSG('oGift.2',{name:g.name,gain,tip,note}),5200);
  UI.render();refreshSheet();
};
ACT.ransom=el=>{
  const cid=el.dataset.cid,r=R(cid),n=npc(cid);
  if(!n||n.role!=='oiran')return;
  if(r.aff<100){toast(MSG('ransom.1'));return}
  const price=r.ransom||(r.ransom=costOf('ransom')+rint(-100,100));
  if(!affordAmt('ransom',price)){toast(MSG('ransom.2',{price:fmt(price)}));return}
  spendAmt('ransom',price);const note=flowerSpend(price);
  const name=nameOf(cid);
  (G.family.conc=G.family.conc||[]).push({cid,name,since:G.turn});
  delete G.world.npcs[cid];r.ransomed=true;const fg=addFame(20,'midRaw');   // 贖身轟動全城：中事件（門檻以下照原值 +20，以上三分之一）
  pushNews(NEWS('ransom.1',{name:G.me.name,name2:name,f:fg}));
  logRel(cid,UT('flower.ransom'));sfx.fanfare();
  toast(MSG('ransom.3',{name,note,f:fg}),5200);
  UI.render();refreshSheet();sceneSync&&sceneSync(true);
};

/* ---------- 花金夜宴 ---------- */
ACT.feast=()=>{
  const F=FL();
  if(F.feast===G.turn){toast(MSG('feast.1'));return}
  if(!afford('feast')){toast(shortMsg('feast'));return}
  const pool=cityNpcs(G.cityId).filter(n=>!isEnemy(n.cid)&&((n.role==='official'&&n.pos&&n.pos.court!=='region'&&!awayNow(n))||['rival','guest','broker'].includes(n.role)));
  F.feast=G.turn;addFame(0.3);const note=flowerSpend(spend('feast'));
  playFx('walk',MSG('feast.fx'),MSG('feast.fxTitle'),()=>{
    if(!pool.length){toast(MSG('feast.2',{note}));UI.render();refreshSheet();return}
    const guests=shuffle(pool.slice()).slice(0,rint(1,3));
    if(guests.some(n=>n.role==='official'))addHeat(ODDS.heat.feast);   // 席間有役人才算官商往來
    if(chance(ODDS.smugMeet.feast)){const sm=meetSmuggler('feast');if(sm)guests.push(npc(sm))}   // 席間混進一位闇商人
    if(chance(ODDS.ronin.feast)){const rn=meetRonin('feast');if(rn)guests.push(npc(rn))}         // 席間混進一位浪人頭
    let h=UT('flower.h');
    guests.forEach(n=>{
      const r=R(n.cid),gain=rint(3,5);
      if(!r.bond){r.bond={mult:0.8,label:UT('flower.feast'),introId:null};r.met=true;r.seen=true;if(!r.fameGot){r.fameGot=true;addFame(n.pos?0.8:0.4)}}
      addKnown(n.cid);setAff(r,clamp(r.aff+gain,0,100));logRel(n.cid,UT('flower.feast.2',{a:gain}));
      const lk=n.role==='official'?'flower.thanksOfficial':'flower.thanksMerchant';
      h+='<div class="card" style="display:flow-root">'+portraitHtml(n.cid,40)+'<b>'+esc(nameOf(n.cid))+'</b> <span class="tag gray">'+UT('flower.feast.3',{a:esc(ROLE_LABEL[n.role]||''),b:gain,c:esc(TX(lk))});
    });
    if(note)h+='<div class="tiny" style="color:#b3261e">'+esc(note)+'</div>';
    sfx.gift();UI.showInfo(UT('flower.feast.4',{a:guests.length}),h);UI.render();refreshSheet();
  },1000);
};

/* ---------- 吉原面板 ---------- */
SHEETS.flower=()=>{
  const F=FL(),stage=oiranOnStage(),total=oiranAll().length,done=F.feast===G.turn;
  let h=UT('flower.h.2',{a:Math.round(F.spent),b:FL_UNIT});
  h+=UT('flower.flower',{a:costTxt('feast'),b:done?'disabled':''})+'>'+UT(done?'btn.feastDone':'btn.feast')+'</button></div></div>';
  h+=UT('flower.flower.3',{a:stage.length,b:total,c:stage.map(n=>oiranBlock(n.cid)).join('')||UT('flower.flower.2')});
  return {title:UT('flower.flower.4'),html:h};
};

/* ═════ [07m_loyalty] ═════ */
/* ======================= 雇員好感：零用錢、保鏢暗殺、手代番頭放火、船長走私 =======================
 *  - 雇員（含保鏢、船長）好感起始 40；給零用錢 5 兩，好感 +3～5；每人每旬只能給一次。好感 80 以上改靠閒聊，特殊指令要閒聊後才出現（07zzs_staffchat.js 覆寫 empAffHtml、ACT.allow）。
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
      return '<div class="card'+(busy?' locked':'')+'" style="display:flow-root">'+UT('loyal.block',{a:portraitEmp(e,56),b:rankName(rk),c:esc(e.name)})+'</b> '+UT('loyal.block.2',{a:busy?'<span class="tag gray">'+away+'</span>':'<span class="tag green">'+home+'</span>',b:e.wage,c:staffTenure(e)})+'</div>'+UT('loyal.block.3',{a:staffTags(e),b:ratingStars(e.cid||statsOfEmp(e))})+'</div></div>'+empAffHtml(e,'dock')+'<div style="margin-top:3px;display:flex;gap:4px;flex-wrap:wrap">'+auditBtns(e)+reBtn(e)+staffChatBtn(e)+'<button class="pixel-btn btn-sm" data-act="fireDock" data-id="'+e.id+'">'+UT('btn.fireDock')+'</button></div></div>';
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
  return G.emps.find(e=>e.rank==='captain'&&empAff(e)>=100&&!used.has(e.id)&&!empLent(e)&&!jailedEmp(e))||null;
}

/* ---------- 保鏢暗殺 ---------- */
/** 暗殺對象：只限仇人與本城同業（仇人在前）。 */
function assTargets(){
  const ok=n=>n&&alive(n.cid)&&!G.emps.some(x=>x.cid===n.cid);
  const foes=enemies().map(cid=>npc(cid)).filter(ok);
  return foes.concat(rivalsHere().filter(n=>ok(n)&&!foes.includes(n)&&!isBekke(n)));
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
  spend('assassin');addStress('dirty',ODDS.stress.dirty);   // 不加風聲（日後由惡德值處理）；虧心事的壓力直接掛在這裡
  const p=assChance(e,n),name=nameOf(cid),rank=assRank(n),log=[];
  playFx('walk',MSG('assassinate.fx'),MSG('assassinate.fxTitle'),()=>{
    if(chance(p)){
      evilAdd('assassin',cid);                    // 惡德（07zzl_tripev2.js）
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
      G.emps=G.emps.filter(x=>x!==e);evilAdd('assassin',cid,true);
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
  const rv=rivalsHere().filter(n=>alive(n.cid)&&!isBekke(n));if(!rv.length){toast(MSG('arson.noRival'));return}
  if(!afford('arson')){toast(shortMsg('arson'));return}
  if(!spendAP())return;
  spend('arson');addStress('dirty',ODDS.stress.dirty);
  const tg=pick(rv),p=arsonChance(e),name=nameOf(tg.cid),log=[];
  playFx('walk',MSG('arson.fx',{rank:rankName(e.rank)}),MSG('arson.fxTitle'),()=>{
    if(chance(p)){
      evilAdd('arson',tg.cid);
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
      G.emps=G.emps.filter(x=>x!==e);evilAdd('arson',tg.cid,true);
      const r=R(tg.cid);setAff(r,0);r.peak=Math.max(r.peak||0,40);logRel(tg.cid,UT('loyal.arson.2'));
      sfx.bad();toast(MSG('arson.fail',{rank:rankName(e.rank),name:e.name,target:name}),5200);
    }
    UI.render();refreshSheet();
  },1000);
};

/* ═════ [07n_scheme] ═════ */
/* ======================= 官員運作：司法官員栽贓、行政官員打壓 =======================
 *  - 四階以上官員好感 100：司法官員可「栽贓」隨機一家同業（成功＝該同業被查抄，市佔分數剩 40%）；
 *    行政官員可「打壓」隨機一家同業（成功＝該同業行情 ×0.6，持續數旬）。
 *  - 好感 100 時出現在拜訪後的請託選單，每位官員只能請託一次（請託即好感 −30）。機制同放火：500 兩私房錢、熱度 +3；成功後可能被查辦（官員撤職，可能供出你）；
 *    失手則官員與你決裂、該同業成為仇人。 */
const SCHEME={frame:{court:'judiciary',icon:'⚖️',name:UT('scheme.SCHEME')},suppress:{court:'administration',icon:'📛',name:UT('scheme.SCHEME.2')}};
function schemeKind(n){const c=n&&n.pos&&n.pos.court;return c==='judiciary'?'frame':c==='administration'?'suppress':null}
function schemeOK(cid){const n=npc(cid),k=schemeKind(n);return !!(k&&n.role==='official'&&n.pos.rank>=SPECIAL_RANK&&alive(cid)&&R(cid).bond&&R(cid).aff>=100&&!isEnemy(cid))}
function schemeChance(n,k){const s=CH(n.cid).derived_stats,A_=ODDS[k];return clamp(A_.base+s.audacity_courage/A_.courageDiv+s.commerce_skill/A_.commerceDiv-A_.rank*A_.perRank,A_.min,A_.max)}
const schemeTargets=()=>rivalsHere().filter(n=>alive(n.cid)&&!n.raided&&!isBekke(n));
/** 拜訪請託中選了「栽贓／打壓」（好感 100、每位官員一次；行動點數已在拜訪時扣過）。 */
function startScheme(cid){
  const n=npc(cid),k=schemeKind(n),S=SCHEME[k],off=nameOf(cid);
  if(!n||!k)return;
  if((G.exile||0)>0){toast(MSG('scheme.exile'));return}
  const ts=schemeTargets();if(!ts.length){toast(MSG('scheme.noRival'));return}
  if(!afford(k)){toast(shortMsg(k));return}
  spend(k);addHeat(3,true);
  const tg=pick(ts),p=schemeChance(n,k),name=nameOf(tg.cid),log=[];
  playFx('walk',MSG(k==='frame'?'scheme.fxFrame':'scheme.fxSuppress',{off}),MSG(k==='frame'?'scheme.fxTitleFrame':'scheme.fxTitleSuppress'),()=>{
    if(chance(p)){
      evilAdd(k,tg.cid);                          // 惡德（07zzl_tripev2.js）
      if(k==='frame')tg.raided=true;
      else{const m=msOf(tg);m.ev=ODDS.suppress.evMul;m.evT=ODDS.suppress.turns}
      G.share=marketShares();G.life.schemes=(G.life.schemes||0)+1;logRel(tg.cid,k==='frame'?UT('scheme.startScheme'):UT('scheme.startScheme.2'));
      pushNews(NEWS('scheme.'+k,{name}));sfx.bad();
      let msg=MSG(k==='frame'?'scheme.frameOk':'scheme.suppressOk',{off,target:name});
      const I=ODDS.schemeInvestigate;
      if(chance(clamp(I.base+I.perHeat*(G.heat||0)+I.rank*I.perRank,I.min,I.max))){
        const loyal=CH(cid).derived_stats.integrity_loyalty;
        const rep=replaceOfficial(n);if(rep)addKnown(rep);delete G.world.npcs[cid];
        G.intros=G.intros.filter(i=>i.cid!==cid);if(G.introId===cid)G.introId=G.intros[0]?G.intros[0].cid:null;
        loseFame('arrest');logRel(cid,UT('scheme.startScheme.3'));
        if(chance(confessP(loyal))){msg+=MSG('scheme.caught',{off});doRaid('testimony',log)}
        else msg+=MSG('scheme.silent',{off});
      }
      toast(msg,5200);
    }else{
      addHeat(2,true);evilAdd(k,tg.cid,true);
      const r=R(cid);setAff(r,0);r.peak=Math.max(r.peak||0,40);logRel(cid,UT('scheme.startScheme.4'));
      const r2=R(tg.cid);setAff(r2,0);r2.peak=Math.max(r2.peak||0,40);logRel(tg.cid,UT('scheme.startScheme.5'));
      sfx.bad();toast(MSG('scheme.fail',{off,target:name}),5200);
    }
    UI.render();refreshSheet();
  },1000);
}

/* ═════ [07o_tribute] ═════ */
/* ======================= 上貢：四階以上財務官員（好感 100）=======================
 *  好感 100 時出現在拜訪後的請託選單，每位官員只能請託一次（請託即好感 −30）。官員開口要一批本業貨：限期內自己備妥庫存，數量取協議配額的數倍（合理可達）。
 *  到期若庫存足夠，自動上貢＝賣出，作價市價 × 倍數，並增加知名度與市佔率；
 *  備不齊則失約：交情、知名度受損。同時只能有一筆上貢。
 *  共用定約掛賣的合約格式：相場「📦 合約」卡上一列，可以先填貨保留（G.tribute.filled），到期前一旬推進前缺貨會提醒（07zzm_kake.js 的 pactExtras，第二百五十一節）。 */
const tributeOK=cid=>{const n=npc(cid),r=G.rel[cid];return !!(n&&n.role==='official'&&n.pos&&n.pos.court==='finance'&&n.pos.rank>=SPECIAL_RANK&&alive(cid)&&r&&r.bond&&r.aff>=100&&!isEnemy(cid))};
/** 人物卡上的上貢進度（答應過這位官員時才顯示）。 */
function tributeStatus(cid){
  const T=G.tribute;if(!T||T.cid!==cid)return '';
  const have=G.inv[T.name]||0,left=Math.max(0,T.due-G.turn);
  return UT('trib.tributeStatus.3',{a:esc(COMM_MAP[T.name].short),b:T.qty,c:left,d:have,e:have>=T.qty?UT('trib.tributeStatus'):UT('trib.tributeStatus.2',{a:T.qty-have})});
}
/** 拜訪請託中選了「上貢」（好感 100、每位官員一次；行動點數已在拜訪時扣過）。 */
function startTribute(cid){
  if(G.tribute){toast(MSG('tribute.busy'));return}
  const cs=tradeComms();if(!cs.length){toast(MSG('tribute.noGoods'));return}
  const A=ODDS.tribute,c=pick(cs),qty=Math.max(A.min,Math.min(Math.round(quotaOf(c.name)*A.quotaMult),itemCap(c.name)));
  G.tribute={cid,name:c.name,qty,due:G.turn+A.turns};
  const fh=addHeat(ODDS.heat.favor);                             // 上貢：官員高價收你的貨，算一般請託的風聲
  toast(MSG('tribute.start',{off:nameOf(cid),turns:A.turns,item:c.short,qty,mul:A.priceMul})+heatTail(fh),5200);
  UI.render();refreshSheet();
}
/** 每旬結算：到期則自動上貢或失約。 */
function tributeTick(log){
  const T=G.tribute;if(!T||G.turn<T.due)return;
  const A=ODDS.tribute,have=G.inv[T.name]||0,off=nameOf(T.cid),short=COMM_MAP[T.name].short;
  G.tribute=null;
  if(have>=T.qty){
    const rev=Math.round(quoteSale(T.name,T.qty).perUnit*T.qty*A.priceMul);
    stockTake(T.name,T.qty,false);G.silver+=rev;G.lastRev+=rev;G.life.peak=Math.max(G.life.peak,G.silver);
    const f0=G.fame||0;addFame(A.fame,'mid');const gf=Math.round(((G.fame||0)-f0)*10)/10;G.mybias=Math.min(4,(G.mybias||1)*(1+A.shareUp));if(G.shareMem&&G.shareMem.prev!==null)G.shareMem.prev*=1+A.shareUp;G.share=marketShares();   // 上貢加的市佔不受「沒出貨不加」限制
    G.life.tributes=(G.life.tributes||0)+1;logRel(T.cid,UT('trib.tributeTick',{a:short,b:T.qty}));
    const t=NEWS('tribute.ok',{off,item:short,qty:T.qty,rev:fmt(rev),fame:gf});log.push(t);pushNews(t);sfx.coin();
  }else{
    const r=R(T.cid);setAff(r,Math.max(0,r.aff-A.failAff));loseFame('tributeFail');
    logRel(T.cid,UT('trib.tributeTick.2'));
    const t=NEWS('tribute.fail',{off,item:short,qty:T.qty,have,aff:A.failAff});log.push(t);pushNews(t);sfx.bad();
  }
}
