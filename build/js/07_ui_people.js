'use strict';
/* ★檔案總覽：人物介面、面板（Sheet）、筆記、私宅、開局
 * - SHEETS[type]()：回傳 {title,html} 的底部面板（奉行所、花街、公會、商邸、倉庫、聘人、說親…）。
 * - personBlock：人物卡（拜訪、送禮、請託的統一表單）。
 * - renderNotes/noteCard：筆記（只收已結識者與員工）。renderEstate：私宅（介紹人、員工、家族）。
 * - UI.showStart/ACT.begin：開局畫面。 */
/* ======================= 07 介面：人物卡、筆記、私宅、各處所面板、傳承、開局 ======================= */
/** 底部/置中面板的內容產生器表：SHEETS[type]() 回傳 {title,html}。新增面板＝在此加一個函式並用 UI.openSheet(type) 開啟。 */
const SHEETS={};
/** 介紹人下拉選單。 */
function introSel(){return ''}
function introSelOld(){
  const opts=G.intros.map(i=>'<option value="'+i.cid+'" '+(i.cid===G.introId?'selected':'')+'>'+UT('ppl.opts',{a:esc(nameOf(i.cid)),b:Math.round(R(i.cid).aff)})).join('');
  return '<div class="row small" style="margin-bottom:6px"><b>'+UT('opt.introLabel')+'</b><select data-chg="setIntro">'+(opts||'<option>'+UT('opt.noIntro')+'</option>')+'</select></div>';
}

/** 人物未兌現承諾的顯示與兌現按鈕。 */
function promiseLines(cid){
  const r=R(cid);
  return r.promises.map((p,i)=>p.done?'':'<div class="card warn tiny" style="margin:3px 0"><div class="row"><span>⏰ '+UT('ppl.promiseLines.3',{a:esc(p.text),b:p.due,c:G.turn>p.due?UT('ppl.promiseLines'):UT('ppl.promiseLines.2',{a:p.due-G.turn})})+'</span><button class="pixel-btn btn-sm btn-gold" data-act="pay" data-cid="'+cid+'" data-i="'+i+'">'+UT('btn.pay')+'</button></div></div>').join('');
}
/** 【人物卡】未結識→請引薦/毛遂自薦；已結識→備禮拜訪表單（禮物＋請託＋什麼都不說）、承諾、請當介紹人。ctx 表示出現的處所。 */
function personBlock(cid,ctx){
  if(npc(cid)&&npc(cid).role==='oiran')return oiranBlock(cid,ctx);
  const c=CH(cid),n=npc(cid),r=R(cid),isOff=n&&n.pos;autoIntro(cid);
  /* 知名度不足（含介紹人 +1 階）而見不到的人：半透明、不可點選 */
  const away=awayNow(n),lockNeed=meetTierNeed(cid),snub=snubbed(cid),locked=away||snub||!r.bond&&lockNeed>fameTier()+((G.introId&&introOf(G.introId))?1:0);
  let h='<div class="card'+(locked?' locked':'')+'" data-cid="'+cid+'">'+portraitBtn(cid,56)+(away?UT('ppl.h',{a:tourNext(n)}):snub?UT('ppl.h.2'):locked?'<div class="tiny" style="color:#b3261e">🔒 '+(isOff?UT('ppl.h.3'):UT('ppl.h.4'))+'</div>':'')+'<div class="row"><div><b>'+esc(c.name)+'</b>'+(c.gender==='f'?UT('ppl.h.5'):'')+' '+(isEnemy(c.id)?UT('ppl.h.6'):'')+'<span class="tag gray">'+(ROLE_LABEL[n?n.role:roleOf(c)]||'')+'</span>'+(empRole(cid)?'<span class="tag red">'+rankName(empRole(cid))+'</span>':'');
  if(isOff)h+='<span class="tag '+COURTS[n.pos.court].cls+'">'+COURTS[n.pos.court].name+'</span><span class="tag clk" data-act="posInfo" data-id="'+n.pos.posId+'">'+esc(posTitle(n))+' ⓘ</span><span class="tag gold">'+esc(rankLabel(n).split(/[\u30FB\u00B7]/)[0])+'</span>';
  h+='</div></div>';
  h+='<div class="text-brief muted" style="margin:2px 0">'+esc(c.family_summary.slice(0,46))+'……</div>';
  if(!r.bond){
    h+=UT('ppl.personBlock');
    const pv=G.introId?introPreview(G.introId,cid):null;
    const pt=!pv?UT('ppl.pt'):pv.known?UT('ppl.pt.4',{a:pv.cp.label,b:pv.cp.shared.map(statName).join(UT('ppl.pt.2'))||UT('ppl.pt.3')}):UT('ppl.pt.5');
    h+='<div class="notice tiny" style="margin:4px 0">'+pt+'</div>';
    const via=!!(G.introId&&introOf(G.introId));
    h+='<div class="row" style="justify-content:flex-start;gap:4px;flex-wrap:wrap"><button class="pixel-btn btn-sm btn-gold" data-act="meet" data-cid="'+cid+'">'+(via?UT('ppl.personBlock.2',{a:coinHtml('silver',introFee(cid))}):UT('ppl.personBlock.3',{a:costBtn('selfIntro')}))+'</button>'+(r.topKnown?'':'<button class="pixel-btn btn-sm" data-act="scout" data-cid="'+cid+'">'+UT('btn.scoutFull',{c:coinHtml('silver',scoutCost(cid))})+'</button>')+'</div>';
  }else if(isEnemy(cid)){
    h+=UT('ppl.personBlock.4');
  }else{
    h+=UT('ppl.personBlock.5',{a:affCls(r.aff)})+'">'+affWord(r.aff)+'</span> <span class="tag">'+esc(r.bond.label)+'</span></span><div style="width:90px">'+bar(r.aff,100,'gold')+'</div></div>';
    if(r.topKnown){const pv=G.introId?introPower(G.introId,cid):null;h+=UT('ppl.personBlock.7',{a:top3Txt(cid)})+'</b>'+(pv?UT('ppl.personBlock.6',{a:pv.cp.cls})+'">'+pv.cp.label+'</span>':'')+'</div>'}
    else h+=UT('ppl.personBlock.8',{a:cid})+'">'+UT('btn.scout',{c:coinHtml('silver',scoutCost(cid))})+'</button></div>';
    if(r.verified)h+=UT('ppl.personBlock.9',{a:esc(weakName(c.weakness))})+'</b></div>';
    else h+=UT('ppl.personBlock.10');
    h+=visitRowHtml(cid);
    h+=promiseLines(cid)+tributeStatus(cid);
    const ithr=G.intros.length?55:40,canIntro=canBeIntro(cid);if(ctx==='res'&&canIntro&&r.aff>=ithr&&!introOf(cid)&&G.intros.length<4)h+='<div style="margin-top:5px"><button class="pixel-btn btn-sm btn-green" data-act="makeIntro" data-cid="'+cid+'">'+UT('btn.makeIntro')+'</button></div>';else if(ctx==='res'&&canIntro&&!introOf(cid)&&G.intros.length<4)h+=UT('ppl.personBlock.11',{a:ithr});
  }
  return h+'</div>';
}
/** 統一顯示結果訊息、重繪。 */
function rr(r){toast(r.msg,Math.max(3200,r.msg.length*120));if(r.ok===false)sfx.bad();UI.render();refreshSheet()}
/** 請引薦/自薦登門：扣行動點數→擲 visitRoll→播拜訪動畫→結算。 */
ACT.meet=el=>{
  if(awayNow(npc(el.dataset.cid))){toast(MSG('visit.away',{m:tourNext(npc(el.dataset.cid))}));return}
  autoIntro(el.dataset.cid);
  if(isEnemy(el.dataset.cid)){toast(MSG('meet.1'));return}
  const cid=el.dataset.cid,via=!!(G.introId&&introOf(G.introId));
  const err=meetCheck(cid,via);if(err){toast(err);return}
  if(!spendVisitAP())return;
  const roll=visitRoll(cid);
  visitFx({cid,outcome:roll.outcome,kind:'meet',prop:'letter'},()=>{
    const a0=R(cid).aff;
    const r=via?meetVia(cid,G.introId,roll):meetCold(cid,roll);errandTrim(cid,a0,r);
    if(r.ok)say(r.cp&&r.cp.matches===3?TX('protag.meetGood'):r.backlash?TX('protag.meetBad'):TX('protag.meetOk'));
    rr(r);
  });
};
/** 拜訪：選禮物→扣行動點數（或派丁稚）→門口動畫（拒見／不在家）→見面進入對話框戰鬥（07u_battle.js）。 */
ACT.visit=el=>{
  if(awayNow(npc(el.dataset.cid))){toast(MSG('visit.away',{m:tourNext(npc(el.dataset.cid))}));return}
  autoIntro(el.dataset.cid);
  if(isEnemy(el.dataset.cid)){toast(MSG('visit.1'));return}
  if(snubbed(el.dataset.cid)){toast(MSG('visit.snub'));return}
  const cid=el.dataset.cid,card=el.closest('.card'),sel=card&&card.querySelector('.gift-sel');
  const gift=sel?sel.value:(R(cid).aff>=FRIEND_AFF?'friend':GIFTS[0].k),g=GIFT_MAP[gift];
  const err=el.dataset.err==='1';
  if(err&&R(cid).aff>=FRIEND_AFF){toast(MSG('errand.friend'));return}
  if(err&&G.silver<btTiers(cid)[1]){toast(MSG('buyGoods.5',{cost:fmt(btTiers(cid)[1])}));return}
  ERR_REQ=err;
  if(!spendVisitAP())return;
  const byErr=ERR_ACTIVE;ERR_ACTIVE=false;
  const roll=visitRoll(cid);
  visitFx({cid,outcome:roll.outcome,kind:'gift',prop:byErr?'gold':(g?g.prop:'letter'),propName:byErr?UT('ppl.visit'):(g?g.name:UT('ppl.visit.2')),actor:byErr?'apprentice':'player'},()=>{
    const r=R(cid);
    if(roll.outcome==='absent'){logRel(cid,UT('ppl.visit.3'));toast(MSG('resolveVisit.1',{cid:nameOf(cid)}));UI.render();refreshSheet();return}
    if(roll.outcome==='refuse'){const c=Math.min(G.silver,costOf('visitRefused'));spendAmt('visitRefused',c);r.lastOk=false;logRel(cid,UT('ppl.visit.4'));toast(MSG('resolveVisit.2',{c}));sfx.bad();UI.render();refreshSheet();return}
    if(byErr){errandVisit(cid);return}
    battleStart(cid,gift);
  });
};
/** 探聽性向。 */
ACT.scout=el=>rr(scout(el.dataset.cid));
/** 打聽軟肋。 */
ACT.weak=el=>rr(revealWeakness(el.dataset.cid));
/** 兌現承諾。 */
ACT.pay=el=>{const cid=el.dataset.cid,i=+el.dataset.i;autoIntro(cid);if(isEnemy(cid)){toast(MSG('meet.1'));return}if(!spendVisitAP())return;visitFx({cid,outcome:'ok',kind:'favor',prop:'gold'},()=>{const a0=R(cid).aff;const r=payPromise(cid,i);errandTrim(cid,a0,r);rr(r)})};
/** 請對方當介紹人（需好感門檻）。 */
ACT.makeIntro=el=>{
  const cid=el.dataset.cid;sanitizeIntros();
  if(!canBeIntro(cid)){toast(MSG('makeIntro.3'));return}
  if(introOf(cid)||G.intros.length>=4){toast(MSG('makeIntro.4'));return}
  if(fameTier()<introTier(cid)){toast(MSG('makeIntro.1',{cid:TIER_NAME[introTier(cid)]}));return}if(!spendAP())return;
  visitFx({cid,outcome:'ok',kind:'meet',prop:'letter'},()=>{G.intros.push({cid});G.introId=G.introId&&introOf(G.introId)?G.introId:cid;logRel(cid,UT('ppl.makeIntro'));say(TX('protag.newIntro'));rr({ok:true,msg:MSG('makeIntro.2',{cid:nameOf(cid)})})});
};

/* ======================= 面板（Bottom Sheet） ======================= */
/** 開啟面板。 */
UI.openSheet=function(type,arg){UI.s.sheet={type,arg};sfx.step();renderSheet(true)};
/** 繪製目前面板內容。 */
function renderSheet(first){
  const S=UI.s.sheet;if(!S)return;
  const def=SHEETS[S.type](S.arg);
  const sh=$('#sheet'),top=first?0:sh.scrollTop;
  $('#sh-title').textContent=def.title;$('#sh-body').innerHTML=def.html;
  $('#sh-close').classList.toggle('hidden',!!UI.s.sheetLock);
  $('#sheet-bd').classList.remove('hidden');sh.scrollTop=top;
}
/** 面板開著時重繪內容。 */
function refreshSheet(){if(UI.s.sheet&&!$('#sheet-bd').classList.contains('hidden'))renderSheet(false)}
/** 關閉面板。 */
UI.closeSheet=function(){if(UI.s.sheetLock)return;UI.s.sheet=null;$('#sheet-bd').classList.add('hidden')};
/* 出門過場 */
/** 前往各處所的轉場文字。 */
const GO_INFO={yamen:[UT('ppl.GO_INFO'),UT('ppl.GO_INFO.2')],flower:[UT('ppl.GO_INFO.3'),UT('ppl.GO_INFO.4')],guild:[UT('ppl.GO_INFO.5'),UT('ppl.GO_INFO.6')],residences:[UT('ppl.GO_INFO.7'),UT('ppl.GO_INFO.8')],warehouse:[UT('ppl.GO_INFO.9'),UT('ppl.GO_INFO.10')],regional:[UT('ppl.GO_INFO.11'),UT('ppl.GO_INFO.12')]};
/** 前往處所：公會有進場間隔限制；只要求還有行動點數，真正扣點在面板內的實際行動。 */
ACT.go=el=>{const k=el.dataset.go,i=GO_INFO[k];
  if(apLeft()<=0){toast(MSG('go.2'));return}
  if(injuredBlock())return;                     // 養傷中不能出門
  const amb=rollAmbush();                         // 出門遇襲判定（0.5～3%）
  if(amb&&amb.abort){return}
  const enc=amb?null:rollEncounter();             // 沒遇襲時，10% 路遇有人急難求助
  if(enc){showEncounter(enc,()=>goTo(k));return}
  goTo(k)};
/** 真正出門：公會登記開會時間，播走路動畫後開啟面板。 */
function goTo(k){const i=GO_INFO[k];
  playFx('walk',i[0],i[1],()=>UI.openSheet(k),900)}

/** 人物卡是否為「見不到」（巡迴在外、嫌你不善言辭、名氣不足）——與 personBlock 的判斷相同。 */
function cardLocked(cid){const n=npc(cid),r=R(cid);return awayNow(n)||snubbed(cid)||(!r.bond&&meetTierNeed(cid)>fameTier()+((G.introId&&introOf(G.introId))?1:0))}
/** 索引標籤列：tabs＝[[key,名稱,人數]]，cur＝目前選中，act＝點選時的動作。 */
function tabPills(tabs,cur,act){return '<div class="tabrow">'+tabs.map(([k,nm,c])=>'<span class="pill '+(cur===k?'on':'')+'" data-act="'+act+'" data-k="'+k+'">'+nm+' '+c+'</span>').join('')+'</div>'}
/** 分類小標題（「全部」頁用）。 */
const groupHead=t=>'<div class="tiny muted bold" style="margin:8px 0 2px;text-align:center">── '+t+' ──</div>';
/** 町奉行所面板：三系官署官員（人物卡）。 */
SHEETS.yamen=()=>{
  const all=officialsOf(G.cityId),tab=UI.s.yamenTab||'all',offs=tab==='all'?all.slice().sort((a,b)=>R(b.cid).aff-R(a.cid).aff):all.filter(n=>n.pos.court===tab);
  let h=UT('ppl.h.10',{a:(introSel()+appsCard()+licCard()),b:G.heat>6?UT('ppl.h.7'):G.heat>3?UT('ppl.h.8'):UT('ppl.h.9')})+'</div>';
  return {title:UT('ppl.yamen',{a:homeCity().name}),html:h+'<div style="margin:4px 0"><button class="pixel-btn btn-sm" data-act="posList">'+UT('btn.posList')+'</button></div>'
    +tabPills([['all',UT('ppl.yamen.2'),all.length]].concat(CITY_COURTS.map(k=>[k,COURTS[k].name,all.filter(n=>n.pos.court===k).length])),tab,'yamenTab')
    +(offs.map(n=>personBlock(n.cid,'yamen')).join('')||UT('ppl.yamen.3'))};
};
ACT.yamenTab=el=>{UI.s.yamenTab=el.dataset.k;refreshSheet()};
/** 聯合採購與出貨協議表態（遵守/暗約/退出）。 */
ACT.cartel=el=>{
  const s=el.dataset.s,C=G.cartel;guildEnsure();
  if(s===C.state){toast(MSG('cartel.same'));return}
  const joining=s!=='none'&&!(guildMember()&&C.bond>0);
  if(joining&&!afford('guildBond')){toast(shortMsg('guildBond'));return}
  if(s==='secret'&&!afford('guildSecret')){toast(shortMsg('guildSecret'));return}
  if(!C.paid){if(!spendAP())return;C.paid=true}
  if(s==='secret')spend('guildSecret');
  let note='';
  if(joining){guildJoin();note=MSG('cartel.join',{c:fmt(costOf('guildBond'))})}
  if(s==='none'){const lost=guildForfeit();if(lost)note=MSG('cartel.lose',{c:fmt(lost)})}
  C.state=s;
  if(s==='pledged'){C.comp=Math.min(90,C.comp+3);toast((note?note+' ':'')+MSG('cartel.1'),4200)}
  else if(s==='secret')toast((note?note+' ':'')+MSG('cartel.2'),4200);
  else toast(MSG('cartel.3')+(note?' '+note:''),4200);
  UI.render();refreshSheet();
};
/** 名門商邸面板。 */
SHEETS.residences=()=>{
  /* 依類型排序（同業→座客→好手→掮客→私梟）；同類中能見的在前、見不到與仇人在後，再按好感高低 */
  const back=n=>isEnemy(n.cid)?2:cardLocked(n.cid)?1:0;
  const all=resident().sort((a,b)=>RES_ORDER.indexOf(a.role)-RES_ORDER.indexOf(b.role)||back(a)-back(b)||R(b.cid).aff-R(a.cid).aff);
  const tab=UI.s.resTab||'all',list=tab==='all'?all.slice().sort((a,b)=>R(b.cid).aff-R(a.cid).aff):all.filter(n=>n.role===tab);
  const tabs=[['all',UT('ppl.yamen.2'),all.length]].concat(RES_ORDER.map(k=>[k,RES_TAB[k],all.filter(n=>n.role===k).length]));
  return {title:UT('ppl.residences'),html:UT('ppl.residences.3',{a:introSel(),b:tabPills(tabs,tab,'resTab'),c:list.map(n=>personBlock(n.cid,'res')).join('')||UT('ppl.residences.2')})};
};
/** 名門商邸的類型順序與標籤名稱。 */
const RES_ORDER=['rival','guest','manager','broker','smuggler'],RES_TAB={rival:UT('ppl.RES_TAB'),guest:UT('ppl.RES_TAB.2'),manager:UT('ppl.RES_TAB.3'),broker:UT('ppl.RES_TAB.4'),smuggler:UT('ppl.RES_TAB.5')};
ACT.resTab=el=>{UI.s.resTab=el.dataset.k;refreshSheet()};
/** 碼頭倉庫面板。 */
SHEETS.warehouse=()=>{
  let h=UT('ppl.h.11',{a:G.wh.n,b:invUsed(),c:invCap(),d:guardCount()});
  h+=UT('ppl.warehouse.3',{a:Object.keys(G.inv).filter(k=>G.inv[k]>0).map(k=>'<div class="row tiny" style="margin-top:2px"><span>'+esc(COMM_MAP[k].short)+(COMM_MAP[k].flam?UT('ppl.warehouse'):'')+'</span><b>'+G.inv[k]+'</b></div>').join('')||UT('ppl.warehouse.2'),b:G.lastSpoil?'<div class="tiny muted" style="margin-top:3px">'+esc(G.lastSpoil)+'</div>':'',c:fmt(Math.round(Object.keys(G.inv).reduce((a,k)=>a+(G.inv[k]||0)*listValue(k),0))),d:fmt(G.holdFee||0)});
  h+=xgoodsCard();
  h+=UT('ppl.warehouse.4');
  const wc=costOf('whUp',G.wh.n),wm=G.wh.n>=whMax();
  h+=UT('ppl.warehouse.6',{a:G.wh.cap,b:whMax(),c:wm?UT('ppl.warehouse.5'):''})+'</div></div><button class="pixel-btn btn-sm btn-gold" data-act="whUp" '+(wm?'disabled':'')+'>'+(wm?UT('btn.whMax'):UT('btn.whUp',{c:coinHtml('silver',wc)}))+'</button></div></div>';
  h+=UT('ppl.warehouse.8',{a:costTxt('charity'),b:G.charityT===G.turn?'disabled':''})+'>'+(G.charityT===G.turn?UT('ppl.warehouse.7'):UT('btn.charity'))+'</button></div></div>';
  return {title:UT('ppl.warehouse.9'),html:h};
};
/** 增建倉庫。 */
ACT.whUp=()=>{if(G.wh.n>=whMax()){toast(MSG('whUp.max'));return}if(!afford('whUp',G.wh.n)){toast(shortMsg('whUp',G.wh.n));return}spend('whUp',G.wh.n);G.wh.n++;sfx.fanfare();toast(MSG('whUp.1',{invCap:invCap()}));UI.render();refreshSheet()};
/** 開倉施粥（知名度）。 */
ACT.charity=()=>{
  if(G.charityT===G.turn){toast(MSG('ppl.charity'));return}   // 每旬一次，不扣行動點數
  if(!afford('charity')){toast(shortMsg('charity'));return}
  const famine=Object.values(G.mk).some((m,i)=>m.ev>1.3&&commTag(COMM_MAP[Object.keys(G.mk)[i]],'grain'));
  spend('charity');G.charityT=G.turn;G.life.charity++;addFame(1.5,famine?'mid':undefined);   // 饑荒施粥是中事件，平常施粥是小事件
  const t=NEWS('charity.1',{name:G.me.name,homeCity:homeCity().name});pushNews(t);
  sfx.fanfare();toast(MSG('charity.1',{famine:(famine?UT('ppl.charity.2'):'')}));UI.render();refreshSheet();
};
/** 城市資料面板（人口、節慶、已發生的城史）。 */
SHEETS.city=()=>{
  const c=homeCity(),d=c.demographics;
  let h='<div class="card"><div class="row"><b style="font-size:16px">'+esc(c.name)+'</b><span class="tag navy">'+esc(c.region_name)+'</span></div><div class="text-meta muted">'+UT('ppl.h.12',{a:esc(c.location_type),b:fmt(cityPop(c))})+'</div><p class="text-prose" style="margin:4px 0">'+esc(c.geography_description)+'</p>';
  h+=UT('ppl.city',{a:d.gender_ratio.male_pct,b:d.gender_ratio.female_pct,c:d.class_ratio.wealthy_elite_pct,d:d.class_ratio.middle_class_pct,e:d.class_ratio.poor_labor_pct})+'%</div></div></div>';
  h+=UT('ppl.city.2',{a:cityProds(c).map(n=>(isDevProd(c,n)?'🌱':'')+esc(COMM_MAP[n]?COMM_MAP[n].full:n)).join(UT('ppl.pt.2'))})+'</div></div>';
  h+=UT('ppl.city.3',{a:c.history_100_years.filter(x=>parseInt(x.year,10)<=G.year).concat(cityHistExtra(c)).map(x=>'<div class="tiny" style="margin-top:3px"><b>'+yearStr(parseInt(x.year,10))+'</b>·'+esc(x.title)+'</div>').join('')||'<div class="tiny muted">——</div>'})+'</div>';
  const f=c.special_festival;
  h+='<div class="card"><b class="text-brief">🏮 '+esc(f.name)+'</b> <span class="tag gold">'+esc(f.date)+'</span><div class="text-brief">'+esc(f.cultural_lore)+'</div><div class="text-meta muted" style="margin-top:2px">'+esc(f.economic_impact)+'</div></div>';
  const s=c.seasonal_annual_rhythms;h+=UT('ppl.city.4',{a:esc(s.spring),b:esc(s.summer),c:esc(s.autumn),d:esc(s.winter)})+'</div>';
  return {title:UT('ppl.city.5',{a:c.name}),html:h};
};
/** 私宅的駐節城市欄：開啟城志。 */
ACT.cityInfo=()=>UI.openSheet('city');
/** 選單面板（說明、存檔、規則摘要）。 */
SHEETS.menu=()=>{
  let h=audioSettingsHtml()+'<button class="pixel-btn" style="width:100%;margin-bottom:6px" data-act="exportSave">'+UT('btn.exportSave')+'</button><div class="tiny muted" style="margin:-2px 0 8px">'+esc(UT('txt.exportNote'))+'</div><button class="pixel-btn btn-red" style="width:100%" data-act="newLife">'+UT('btn.newLife')+'</button>';
  h+=UT('ppl.menu');
  h+=UT('ppl.menu.2');
  return {title:UT('ppl.menu.3'),html:h};
};
/** 開關音效。 */
/** 放棄並重開。 */
ACT.newLife=()=>{if(UI.s.sheetLock||confirm(UT('ppl.newLife'))){UI.s.sheetLock=false;UI.s.sheet=null;$('#sheet-bd').classList.add('hidden');clearSave();G=null;musicWant(null);UI.showStart()}};

/* ======================= 筆記（千人手帳） ======================= */
/** 筆記分類標籤。 */
const NOTE_FILTERS=['all','emp','official','rival','manager','guest','broker','smuggler','oiran','other'].map(k=>[k,UT('opt.nf_'+k)]);
/** 筆記是否收錄：已結識（met/bond）或員工。 */
const noteSeen=id=>{const r=R(id);return !!(r.met||r.bond||G.emps.some(e=>e.cid===id))};
/** 依好感決定對此人的了解層級 1～4。 */
function noteLevel(r){return r.aff<12?1:r.aff<32?2:r.aff<56?3:4}
/** 筆記畫面（員工分頁含無名冊的少年）。 */
function renderNotes(){
  if((UI.s.notesTab||'book')==='wiki'){renderWiki();return}
  const q=UI.s.notesQ.trim(),f=UI.s.notesF;
  let list=G.known.filter(id=>CH(id)&&noteSeen(id)).map(id=>({id,c:CH(id),n:npc(id),r:R(id)}));
  if(f==='emp')list=G.emps.filter(e=>e.cid&&CH(e.cid)).map(e=>({id:e.cid,c:CH(e.cid),n:npc(e.cid),r:R(e.cid)}));
  list=list.filter(x=>{
    if(f==='emp')return !q||x.c.name.includes(q)||(empRole(x.id)?rankName(empRole(x.id)):'').includes(q);
    if(q&&!(x.c.name.includes(q)||(x.n&&(ROLE_LABEL[x.n.role]||'').includes(q))))return false;
    const role=x.n?x.n.role:roleOf(x.c);
    if(f==='all')return true;if(f==='other')return !['official','rival','manager','guest','broker','smuggler','oiran'].includes(role);return role===f;
  }).sort((a,b)=>b.r.aff-a.r.aff);
  const overdue=G.known.filter(noteSeen).some(id=>R(id).promises.some(p=>!p.done&&G.turn>p.due));
  let h='<div class="pixel-box" style="padding:8px">'+UT('ppl.h.13',{a:notesTabsHtml(),b:G.known.filter(id=>CH(id)&&noteSeen(id)).length,c:G.world.sampleSize})+'</span></div>';
  h+=UT('ppl.renderNotes',{a:esc(UI.s.notesQ)})+'"></div>';
  h+='<div>'+NOTE_FILTERS.map(([k,n])=>'<span class="pill '+(f===k?'on':'')+'" data-act="nf" data-k="'+k+'">'+n+'</span>').join('')+'</div>';
  if(overdue)h+=UT('ppl.renderNotes.2');
  const apps=f==='emp'?G.emps.filter(e=>!e.cid&&(!q||e.name.includes(q)||rankName(e.rank).includes(q))):[];
  const appH=apps.map(e=>'<div class="card emp-card"><div class="row"><div><b>'+esc(e.name)+'</b> <span class="tag red">'+UT('ppl.appH',{a:rankName(e.rank),b:e.wage,c:G.turn-e.since,d:ratingStars(e.stats)})+'</div></div>').join('');
  h+='<div style="margin-top:4px">'+(list.slice(0,40).map(x=>noteCard(x)).join('')+appH||'<div class="notice">'+(f==='emp'?UT('ppl.renderNotes.3'):UT('ppl.renderNotes.4'))+'</div>')+'</div></div>';
  $('#view-notes').innerHTML=h;
}
/** 筆記人物卡：出身、往來實錄、外人風評、印象與備註。 */
function noteCard({id,c,n,r},pop){
  const open=pop||UI.s.openNote===id,dead=c.death_year<G.year,role=n?n.role:roleOf(c);
  const od=r.promises.some(p=>!p.done&&G.turn>p.due);
  let h='<div class="card '+(od?'warn':'')+'"'+(pop?'':' data-act="noteOpen" style="cursor:pointer"')+' data-cid="'+id+'">'+portraitHtml(id,56)+'<div class="row"><div><b>'+esc(c.name)+'</b>'+(c.gender==='f'?UT('ppl.h.5'):'')+' '+(isEnemy(c.id)?UT('ppl.h.6'):'')+'<span class="tag gray">'+(ROLE_LABEL[role]||'')+'</span>'+(empRole(id)?'<span class="tag red">'+rankName(empRole(id))+'</span>':'')+(n&&n.pos?'<span class="tag navy clk" data-act="posInfo" data-id="'+n.pos.posId+'">'+esc(posTitle(n))+' ⓘ</span>':'')+(dead?UT('ppl.h.14'):'')+'</div></div>';
  h+='<div class="row tiny" style="margin-top:2px"><span>'+(r.bond?UT('ppl.noteCard',{a:affCls(r.aff)})+'">'+affWord(r.aff)+'</span>':UT('ppl.noteCard.2'))+'</span>'+(od?UT('ppl.noteCard.3'):'')+'</div>';
  if(!open)return h+'</div>';
  const lv=noteLevel(r);
  h+='<div data-act="none">';
  const em=G.emps.find(x=>x.cid===id);
  if(em)h+=UT('ppl.noteCard.5',{a:rankName(em.rank),b:em.wage,c:G.turn-em.since,d:ratingStars(id),e:em.flag?UT('ppl.noteCard.4',{a:fmt(em.flag)}):''})+'<div class="tiny muted">'+(SPECIAL.includes(em.rank)?SPECIAL_DESC[em.rank]:'')+'</div></div>';
  h+=UT('ppl.noteCard.6',{a:esc(c.family_summary)})+'</div></details>';
  h+=UT('ppl.noteCard.9',{a:r.log.length,b:r.log.slice().reverse().map(l=>'<div style="margin-top:2px">• '+UT('ppl.noteCard.7',{a:yearStr(l.y),b:l.m,c:CYCLE_NAMES[l.c-1],d:esc(l.t)})+'</div>').join('')||UT('ppl.noteCard.8'),c:promiseLines(id)})+'</div></details>';
  const rumors=rumorsOf(id);
  h+=UT('ppl.noteCard.12',{a:rumors.length,b:rumors.map(x=>UT('ppl.noteCard.11',{a:esc(x.txt),b:x.src})+'</span><span class="stars">'+'★'.repeat(Math.round(x.cred*5))+'☆'.repeat(5-Math.round(x.cred*5))+'</span>'+(r.verified&&WEAK_G[c.weakness]===x.txt?UT('ppl.noteCard.10'):'')+'</div>').join('')});
  h+=UT('ppl.noteCard.15',{a:impressions(id,lv),b:r.topKnown?UT('ppl.noteCard.13',{a:top3Txt(id)})+'</div>':'',c:r.verified?UT('ppl.noteCard.14',{a:esc(weakName(c.weakness))})+'</div>':''})+'<textarea class="note-in" rows="2" data-chg="noteText" data-cid="'+UT('ppl.noteCard.16',{a:id,b:esc(r.note||'')})+'</textarea></div></details>';
  if(!pop&&!dead&&r.bond&&n&&n.cityId===G.cityId)h+=UT('ppl.noteCard.17');
  return h+'</div></div>';
}
/* 主觀印象：由隱藏數值加上雜訊推得，交情越深越準 */
/** 主觀印象：由隱藏數值加雜訊推得，好感越高越準。 */
function impressions(cid,lv){
  const c=CH(cid),st=c.derived_stats,rd=seeded('imp'+cid+lv),out=[];
  if(lv<2)return UT('ppl.impressions');
  const noise=lv>=4?5:lv===3?10:16;
  const T={commerce_skill:[UT('ppl.T'),UT('ppl.T.2')],integrity_loyalty:[UT('ppl.T.3'),UT('ppl.T.4')],greed_index:[UT('ppl.T.5'),UT('ppl.T.6')],audacity_courage:[UT('ppl.T.7'),UT('ppl.T.8')],diplomacy_charm:[UT('ppl.T.9'),UT('ppl.T.10')],betrayal_risk:[UT('ppl.T.11'),UT('ppl.T.12')]};
  Object.entries(T).forEach(([k,[hi,lo]])=>{const v=st[k]+(rd()-0.5)*2*noise;if(v>=68)out.push(hi);else if(v<=32)out.push(lo)});
  return out.length?UT('ppl.impressions.2',{a:out.slice(0,lv>=4?5:2).map(x=>'<div>• '+x+'</div>').join('')}):UT('ppl.impressions.3');
}
/** 空操作：用於攔截點擊，避免觸發外層的展開動作。 */
ACT.none=()=>{};
/** 疊在目前說明視窗上開新內容；關閉後回到原本的視窗（原本若沒開就單純開啟）。 */
UI.pushInfo=function(title,html){
  const bd=$('#info-bd');
  if(!bd.classList.contains('hidden')){
    const pt=$('#info-title').textContent,ph=$('#info-body').innerHTML,pa=INFO_AFTER;
    INFO_AFTER=()=>{INFO_AFTER=pa;UI.showInfo(pt,ph)};
  }
  UI.showInfo(title,html);
};
/** 可點的頭像：點了開啟完整人物資訊（與筆記的人物介紹相同）。 */
const portraitBtn=(cid,px)=>'<span class="pt-btn" data-act="personInfo" data-cid="'+UT('ppl.portraitBtn',{a:cid,b:portraitHtml(cid,px)})+'</span>';
/** 完整人物資訊視窗：沿用筆記人物卡（展開狀態）。 */
ACT.personInfo=el=>{
  const id=el.dataset.cid,c=CH(id);if(!c)return;
  UI.pushInfo('👤 '+c.name,noteCard({id,c,n:npc(id),r:R(id)},true));sfx.tap();
};
/** 展開/收合筆記卡。 */
ACT.noteOpen=el=>{UI.s.openNote=UI.s.openNote===el.dataset.cid?null:el.dataset.cid;renderNotes();sfx.tap()};
/** 切換筆記分類。 */
ACT.nf=el=>{UI.s.notesF=el.dataset.k;renderNotes()};
/** 儲存自訂備註。 */
CHG.noteText=el=>{R(el.dataset.cid).note=el.value.slice(0,200);save()};
document.addEventListener('input',e=>{if(e.target.id==='notes-q'){UI.s.notesQ=e.target.value;const p=e.target.selectionStart;renderNotes();const n=$('#notes-q');n.focus();n.setSelectionRange(p,p)}});

/* ======================= 私宅 ======================= */
/** 員工評價星數（受介紹人信任影響，不見得準確）。 */
function ratingStars(src){
  const st=typeof src==='string'?(CH(src)?CH(src).derived_stats:null):src;
  if(!st)return '<span class="stars">☆☆☆☆☆</span>';
  const tf=trustFactor(G.introId?R(G.introId).aff:0);const rd=seeded('rate'+JSON.stringify(st)+G.turn);
  const v=st.commerce_skill+(rd()-0.5)*2*(40*(1.6-tf));
  const n=clamp(Math.round(v/20),1,5);return '<span class="stars">'+'★'.repeat(n)+'☆'.repeat(5-n)+'</span>';
}
/** 私宅畫面：介紹人、員工、物色人才、家族、退隱。 */
function renderEstate(){
  const sp=G.family.spouse,kids=G.family.kids;
  let h=UT('ppl.h.15',{a:esc(G.me.name)})+'</span></div>';
  h+=UT('ppl.renderEstate',{a:esc(G.firm),b:esc(homeCity().name)});
  h+=UT('ppl.renderEstate.4',{a:fmt(netWorth()),b:fmt(G.lastCost||0),c:G.heat>6?UT('ppl.renderEstate.2'):G.heat>3?UT('ppl.renderEstate.3'):UT('ppl.h.9')})+'</b></div></div>';
  // 宴會
  h+=banquetCard();
  // 介紹人
  h+=UT('ppl.renderEstate.5');
  h+=G.intros.map(i=>{const cid=i.cid,r=R(cid),sel=cid===G.introId;return '<div class="card '+(sel?'good':'')+'"><div class="row"><div><b>'+UT('ppl.renderEstate.10',{a:esc(nameOf(cid)),b:top3Txt(cid)})+'</b></div></div><div style="text-align:right" class="tiny">'+(r.aff>=75?UT('ppl.renderEstate.6'):r.aff>=55?UT('ppl.renderEstate.7'):r.aff>=35?UT('ppl.renderEstate.8'):UT('ppl.renderEstate.9'))+'</div></div><div style="margin:3px 0">'+UT('ppl.renderEstate.11',{a:bar(r.aff,100,'gold'),b:Math.round(r.aff),c:affWord(r.aff)})+'</span></div></div>'}).join('')||UT('ppl.renderEstate.12',{a:UT('btn.go')})+'</button></div>';
  h+=UT('ppl.renderEstate.13');
  // 夥計
  h+=UT('ppl.renderEstate.14',{a:UT('btn.apprentice',{c:costBtn('apprentice')})})+'</button></div>';
  h+='<div class="notice tiny">'+RANKS.concat(['guard']).map(k=>'• <b>'+UT('ppl.renderEstate.15',{a:rankName(k),b:DUTY_DESC[k]})).join('<br>')+'</div>';
  h+=SPECIAL.filter(k=>k!=='captain'&&k!=='courier').concat(RANKS.slice().reverse()).map(rk=>{
    const ls=G.emps.filter(e=>e.rank===rk);
    return ls.map(e=>{
      if(e.flag&&!e.caught)e.caught=e.flag;                                  // 舊存檔：已查出的私吞改為待處置
      return '<div class="card '+(e.caught?'warn':'')+'" style="display:flow-root">'+UT('ppl.renderEstate.17',{a:portraitEmp(e,56),b:rankName(e.rank),c:esc(e.name)})+'</b> '+staffTags(e)+'<div class="tiny muted">'+UT('ppl.renderEstate.18',{a:e.cid?'':UT('ppl.renderEstate.16'),b:e.wage,c:staffTenure(e),d:ratingStars(e.cid||statsOfEmp(e))})+'</div></div>'+empAffHtml(e)+'<div class="row" style="margin-top:3px;justify-content:flex-start;gap:4px;flex-wrap:wrap">'+auditBtns(e)+(e.rank!=='chief'&&!SPECIAL.includes(e.rank)?'<button class="pixel-btn btn-sm btn-green" data-act="promote" data-id="'+e.id+'">'+UT('btn.promote')+'</button>':'')+'<button class="pixel-btn btn-sm" data-act="fire" data-id="'+e.id+'">'+UT('btn.fire')+'</button></div></div>';
    }).join('');
  }).join('');
  h+=UT('ppl.renderEstate.19',{a:costTxt('recruitIntro'),b:UT('btn.recruit')})+'</button></div></div>';
  if(G.recruit&&G.recruit.cands.length)h+=UT('ppl.renderEstate.20',{a:G.recruit.cands.length,b:UT('btn.recruitView')})+'</button></div>';
  // 家族
  h+=UT('ppl.renderEstate.21');
  if(!sp)h+=UT('ppl.renderEstate.22',{a:UT('btn.marryOpen')})+'</button></div></div>';
  else h+=UT('ppl.renderEstate.23',{a:esc(sp.name)})+'</b><div class="tiny muted">'+NM('marryKind',sp.kind)+'</div></div>';
  h+=(G.family.conc||[]).map(x=>'<div class="card" style="display:flow-root">'+UT('ppl.renderEstate.24',{a:portraitHtml(x.cid,48),b:esc(x.name)})).join('');
  h+=kids.map(k=>{
    const a=kidAge(k);
    return '<div class="card '+(k.prodigal?'warn':'')+'"><div class="row"><div><b>'+UT('ppl.renderEstate.30',{a:k.gender==='m'?'👦':'👧',b:esc(k.name),c:kidStage(a),d:k.prodigal?UT('ppl.renderEstate.25'):''})+'<div class="tiny muted">'+(k.revealed?UT('ppl.renderEstate.26',{a:statName(top3Of(k.stats)[0])})+'</b>':UT('ppl.renderEstate.27'))+(k.path?UT('ppl.renderEstate.28',{a:PATHS[k.path].name}):'')+'</div></div></div>'+(a>=8&&!k.prodigal?'<div style="margin-top:3px">'+Object.entries(PATHS).map(([p,P])=>'<span class="pill '+(k.path===p?'on':'')+'" data-act="kidPath" data-id="'+k.id+'" data-p="'+p+'">'+UT('ppl.renderEstate.29',{a:P.name,b:P.cost})).join('')+'</div>':'')+(k.prodigal?'<div style="margin-top:3px"><button class="pixel-btn btn-sm" data-act="kidPay" data-id="'+k.id+'" data-m="pay">'+UT('btn.kidDebt',{c:costBtn('kidDebt')})+'</button> <button class="pixel-btn btn-sm btn-red" data-act="kidPay" data-id="'+k.id+'" data-m="out">'+UT('btn.kidPay')+'</button></div>':'')+'</div>';
  }).join('');
  // 隱居
  h+=UT('ppl.renderEstate.31',{a:UT('btn.retire')})+'</button></div>';
  h+='</div>';
  $('#view-estate').innerHTML=h;
}

/* ---------- 宴會：一旬一次，介紹人全員出席（好感 +10），隨機 3～4 名員工作陪（好感 +3～5） ---------- */
const BANQUET_INTRO=10,BANQUET_EMP=[3,5],BANQUET_EMPN=[3,4];
/** 私宅頂端的宴會卡。 */
function banquetCard(){
  const done=G.banquetT===G.turn,none=!G.intros.length&&!G.emps.length;
  return UT('ppl.banquetCard.2',{a:BANQUET_INTRO,b:BANQUET_EMPN.join(UT('ppl.banquetCard')),c:BANQUET_EMP.join(UT('ppl.banquetCard')),d:costTxt('befriend'),e:done||none?'disabled':''})+'>'+(done?UT('btn.feastDone'):none?UT('btn.banquetNone'):UT('btn.banquet'))+'</button></div></div>';
}
ACT.banquet=()=>{
  if(G.banquetT===G.turn){toast(MSG('banquet.done'));return}
  if(!G.intros.length&&!G.emps.length){toast(MSG('banquet.none'));return}
  if(!afford('befriend')){toast(shortMsg('befriend'));return}
  if(!spendAP())return;
  spend('befriend');G.banquetT=G.turn;
  const intros=G.intros.map(i=>i.cid).filter(cid=>CH(cid)&&alive(cid)&&!isEnemy(cid));
  const emps=shuffle(G.emps.filter(e=>!intros.includes(e.cid))).slice(0,rint(BANQUET_EMPN[0],BANQUET_EMPN[1]));
  playFx('walk',MSG('banquet.fx'),MSG('banquet.fxTitle'),()=>{
    let h='<div class="notice tiny">'+esc(TX('banquet.open'))+'</div>';
    const lines=shuffle(Ls('banquet.intro').slice());   // 介紹人台詞不重複（人多時才循環）
    intros.forEach((cid,k)=>{
      const r=R(cid);setAff(r,clamp(r.aff+BANQUET_INTRO,0,100));logRel(cid,UT('ppl.banquet',{a:BANQUET_INTRO}));
      h+='<div class="card" style="display:flow-root">'+portraitHtml(cid,40)+'<b>'+UT('ppl.banquet.2',{a:esc(nameOf(cid)),b:BANQUET_INTRO})+'</span><div class="small" style="margin-top:3px">'+esc(lines[k%lines.length])+'</div></div>';
    });
    emps.forEach(e=>{
      const g=rint(BANQUET_EMP[0],BANQUET_EMP[1]);e.aff=Math.min(100,empAff(e)+g);
      h+='<div class="card" style="display:flow-root">'+portraitEmp(e,40)+'<b>'+esc(e.name)+'</b> <span class="tag red">'+UT('ppl.banquet.3',{a:esc(rankName(e.rank)),b:g})+'</span><div class="small" style="margin-top:3px">'+esc(TX('banquet.emp.'+e.rank)||TX('banquet.emp.clerk'))+'</div></div>';
    });
    sfx.gift();UI.showInfo(UT('ppl.banquet.4',{a:intros.length+emps.length}),h);UI.render();
  },1000);
};
/** 找人需要介紹人且有人情額度。 */
function needIntro(){
  autoIntro(null);
  if(!G.introId||!introOf(G.introId)){toast(MSG('needIntro.1'));return true}
  return false;
}
/** 招丁稚。 */
ACT.apprentice=()=>{
  if(needIntro())return;if(!afford('apprentice')){toast(shortMsg('apprentice'));return}
  visitFx({cid:G.introId,outcome:'ok',kind:'contract',prop:'contract'},()=>{const it=introOf(G.introId);introCost(it);const r=hireApprentice();toast(r.msg);UI.render()});
};
/** 查帳。 */
/** 追討。 */
/** 升遷。 */
ACT.promote=el=>{const r=promoteEmp(el.dataset.id);toast(r.msg);UI.render()};
/** 辭退。 */
ACT.fire=el=>{
  const id=el.dataset.id;
  if(UI.s.fireArm!==id){UI.s.fireArm=id;toast(MSG('fire.1'));el.textContent=UT('btn.fireConfirm');clearTimeout(UI.s.fireT);UI.s.fireT=setTimeout(()=>{UI.s.fireArm=null;if(el.isConnected)el.textContent=UT('btn.fire')},4000);return}
  UI.s.fireArm=null;const fx=fireEmp(id);toast(MSG('fire.2')+fx);UI.render();
};
/** 請介紹人物色人才。 */
ACT.recruit=()=>{
  if(needIntro())return;if(!afford('recruitIntro')){toast(shortMsg('recruitIntro'));return}
  visitFx({cid:G.introId,outcome:'ok',kind:'contract',prop:'contract'},()=>{const r=recruitVia(G.introId);toast(r.msg);if(r.ok)UI.openSheet('recruit');UI.render()});
};
/** 查看上次物色結果。 */
ACT.recruitView=()=>UI.openSheet('recruit');
/** 人才名冊面板：只顯示人物 suitable_roles 所允許的非丁稚職位。 */
SHEETS.recruit=()=>{
  const rc=G.recruit;if(!rc)return {title:UT('ppl.recruit'),html:UT('ppl.recruit.2')};
  let h='<div class="notice tiny">'+UT('ppl.h.16',{a:esc(recruitFlavor(nameOf(rc.introId),rc.rank,rc.tf,rc.avg===undefined?1:rc.avg))});
  h+=rc.cands.map(cid=>{
    const c=CH(cid);
    const ranks=candidateHireRanks(cid,rc.rank).filter(slotFree);
    const opts=ranks.map(rk=>'<button class="pixel-btn btn-sm" data-act="hire" data-cid="'+cid+'" data-rk="'+rk+'">'+UT('btn.hire',{r:rankName(rk)+(rk==='captain'?UT('ppl.opts.2',{a:coinHtml('silver',shipCost())}):'')})+'</button>').join(' ');
    return '<div class="card" style="display:flow-root">'+portraitHtml(cid,56)+'<div class="row"><div><b>'+esc(c.name)+'</b>'+(c.gender==='f'?UT('ppl.h.5'):'')+'<div class="text-brief muted">'+UT('ppl.recruit.4',{a:esc(c.family_summary.slice(0,36)),b:ratingStars(cid)})+'</div></div><div style="margin-top:4px">'+(opts||UT('ppl.recruit.3'))+'</div></div>';
  }).join('')||UT('ppl.recruit.5');
  return {title:UT('ppl.recruit.6'),html:h};
};
/** 聘用人選。 */
ACT.hire=el=>{
  const cid=el.dataset.cid,rk=el.dataset.rk;
  visitFx({cid,outcome:'ok',kind:'contract',prop:'contract'},()=>{const r=hireCandidate(cid,rk);toast(r.msg);if(r.ok)sfx.coin();UI.render();refreshSheet()});
};
/** 子女歷練。 */
ACT.kidPath=el=>{const r=setKidPath(el.dataset.id,el.dataset.p);toast(r.msg);UI.render()};
/** 處理敗家子。 */
ACT.kidPay=el=>{const r=kidFixProdigal(el.dataset.id,el.dataset.m);toast(r.msg);UI.render()};
/** 開啟說親面板。 */
ACT.marryOpen=()=>UI.openSheet('marry');
/** 說親面板。 */
SHEETS.marry=()=>{
  const ms=UI.s.marry||(UI.s.marry={kind:'commoner',target:null});
  const kinds=['commoner','rival','official'].map(k=>[k,NM('marryKind',k),UT('marry.kindDesc.'+k)]);
  let h=introSel()+kinds.map(([k,n,d])=>'<div class="mkt-row '+(ms.kind===k?'on':'')+'" data-act="marryKind" data-k="'+k+'"><div><b>'+n+'</b><div class="tiny muted">'+d+'</div></div></div>').join('');
  let cand=[];
  if(ms.kind==='rival')cand=cityNpcs(G.cityId,'rival').filter(n=>R(n.cid).bond);
  if(ms.kind==='official')cand=officialsOf(G.cityId).filter(n=>R(n.cid).bond);
  if(ms.kind!=='commoner'){
    h+=UT('ppl.marry.4',{a:cand.map(n=>{const ok=R(n.cid).aff>=(ms.kind==='official'?50:45);return '<div class="mkt-row '+(ms.target===n.cid?'on':'')+' '+(ok?'':'lock')+'" data-act="marryTarget" data-cid="'+n.cid+'"><div><b>'+UT('ppl.marry.2',{a:esc(nameOf(n.cid)),b:Math.round(R(n.cid).aff),c:ok?'':UT('ppl.marry')})+'</div></div></div>'}).join('')||UT('ppl.marry.3')});
  }
  h+='<div style="margin-top:8px"><button class="pixel-btn btn-gold" style="width:100%" data-act="marryGo">'+UT('btn.marryGo')+'</button></div>';
  return {title:UT('ppl.marry.5'),html:h};
};
/** 選擇聯姻類型。 */
ACT.marryKind=el=>{UI.s.marry.kind=el.dataset.k;UI.s.marry.target=null;refreshSheet()};
/** 選擇結親對象。 */
ACT.marryTarget=el=>{UI.s.marry.target=el.dataset.cid;refreshSheet()};
/** 託媒人說親。 */
ACT.marryGo=()=>{
  const ms=UI.s.marry;
  if(ms.kind!=='commoner'&&!ms.target){toast(MSG('marryGo.1'));return}
  autoIntro(ms.kind!=='commoner'?ms.target:null);
  if(!G.introId||!introOf(G.introId)){toast(MSG('marryGo.2'));return}
  const host=ms.kind==='commoner'?G.introId:ms.target;
  if(!spendAP())return;
  visitFx({cid:host,outcome:'ok',kind:'marry',prop:'marriage'},()=>{
    const r=marry(ms.kind,ms.kind==='commoner'?null:ms.target,G.introId);
    toast(r.msg,5000);if(r.ok&&!r.fail){sfx.fanfare();UI.s.sheet=null;$('#sheet-bd').classList.add('hidden');sceneSync(true)}UI.render();refreshSheet();
  });
};
/** 開啟退隱面板。 */
ACT.retire=()=>UI.openSheet('retire');
/** 退隱面板：確認後快轉到人生結束。 */
SHEETS.retire=()=>{
  let h=UT('ppl.h.17');
  h+='<button class="pixel-btn btn-red" style="width:100%;margin-top:6px" data-act="retireGo">'+UT('btn.retireGo')+'</button>';
  return {title:UT('ppl.retire'),html:h};
};
/** 確認退隱。 */
ACT.retireGo=()=>{UI.s.sheet=null;endLife('retire')};

/* ======================= 人生終章（蓋棺評語，無分數） ======================= */
/** 顯示一生總結。 */
UI.showLegacy=function(){UI.s.sheetLock=true;musicWant('title');UI.openSheet('legacy')};   // 人生終章播片頭《暖簾囃子》
/** 一生總結面板。 */
SHEETS.legacy=()=>{
  const E=G.ended,ob=E.ob;
  const cause=E.cause==='retire'?UT('ppl.cause',{a:yearStr(E.year),b:yearStr(E.deathYear),c:ob.age}):E.cause==='death'?UT('ppl.cause.2',{a:yearStr(E.year),b:ob.age}):E.cause==='executed'?UT('ppl.cause.3',{a:yearStr(E.year)}):UT('ppl.cause.4');
  let h='<div class="card" style="background:#fffaf0;text-align:center"><div style="font-size:22px">🕯️</div><b style="font-size:17px">'+esc(G.me.name)+'</b><div class="text-brief muted">'+cause+'</div><hr class="sep"><div class="text-emphasis" style="color:#3a2f27">'+esc(ob.sum)+'</div></div>';
  h+=UT('ppl.legacy',{a:ob.facts.map(f=>'<div class="tiny" style="margin-top:2px">• '+esc(f)+'</div>').join('')})+'</div>';
  if(ob.quotes.length)h+=UT('ppl.legacy.3',{a:ob.quotes.map(q=>'<div class="small" style="margin-top:5px"><b>'+UT('ppl.legacy.2',{a:esc(q.name),b:affCls(q.aff)})+'">'+affWord(q.aff)+'</span><br>'+esc(q.txt)+'</div>').join('')})+'</div>';
  else h+=UT('ppl.legacy.4');
  h+=UT('ppl.legacy.5');
  h+='<div style="margin-top:8px"><button class="pixel-btn btn-red" style="width:100%" data-act="newLife">'+UT('btn.newLife2')+'</button></div>';
  return {title:UT('ppl.legacy.6'),html:h};
};

/* ======================= 開局畫面 ======================= */
/** 顯示開局畫面（選流派、地區）。 */
UI.showStart=function(){
  if(!UI.s.startSys)UI.s.startSys='timber';
  let sv=loadSave();if(sv&&sv.ended){clearSave();sv=null}   // 舊版留下的已落幕存檔：清除
  let h=UT('ppl.h.18',{a:GAME_VER})+'</span></div>';
  h+=UT('ppl.showStart');
  if(!sv&&OLD_SAVE_FOUND)h+=UT('ppl.showStart.2',{a:GAME_VER});
  if(sv)h+='<button class="pixel-btn btn-gold" style="width:100%;padding:8px;margin-bottom:10px" data-act="resume">'+UT('btn.resume',{n:esc(sv.me.name),y:yearStr(sv.year)})+'</button>';
  h+=UT('ppl.showStart.3');
  h+=SYS.map(s=>'<div class="sys-card '+(UI.s.startSys===s.key?'sel':'')+'" data-act="pickSys" data-k="'+s.key+'"><h3>'+s.firm+'·'+s.name+' <span class="tag gold">'+s.style+'</span></h3><div class="small">'+s.tip+'</div><div class="tiny muted" style="margin-top:2px">▸ '+UT('ppl.showStart.4',{a:s.perk,b:s.res})+'</div></div>').join('');
  h+='<button class="pixel-btn btn-red" style="width:100%;padding:10px;margin-top:14px;font-size:17px" data-act="begin">'+UT('btn.begin')+'</button>';
  h+=saveIoHtml(!!sv);                               // 匯出（有存檔時）與匯入存檔（07z_saveio.js）
  h+='<button class="pixel-btn" style="width:100%;padding:7px;margin-top:12px" data-act="changelog">'+UT('btn.changelog')+'</button>';   // 更新紀錄（01h_changelog.js）
  $('#start-inner').innerHTML=h;$('#start').classList.remove('hidden');
};
/** 更新紀錄視窗：新的在上，日期加條列說明。 */
ACT.changelog=()=>{$('#info-bd').classList.add('over-start');UI.showInfo(UT('ppl.changelog'),CHANGELOG.map(c=>'<div style="margin-bottom:8px"><b>'+esc(c.date)+'</b>'+c.items.map(t=>'<div class="small" style="margin-top:3px;padding-left:1em;text-indent:-1em">• '+esc(t)+'</div>').join('')+'</div>').join(''))};
/** 選擇流派。 */
ACT.pickSys=el=>{UI.s.startSys=el.dataset.k;UI.showStart();sfx.tap()};
/** 開始新局。 */
ACT.begin=()=>{
  musicWant('market');                                // 點擊開局＝使用者手勢，可以開始播放音樂
  newGame(UI.s.startSys,'rand');$('#start').classList.add('hidden');
  SCENE.sig='';sceneSync(true);_tk='';UI.go('home');say(TX('protag.open',{firm:G.firm}),4200);
  save();
  LASTREP=null;showTurnReport([{}],G.news.map(x=>x.t).reverse(),0,'open');   // 開業旬報：進出貨皆空，列開局消息
};
/** 繼續上次存檔。 */
ACT.resume=()=>enterSave(loadSave());
/** 以一份存檔進入遊戲（繼續人生、匯入存檔共用）。 */
function enterSave(o){if(!o)return;musicWant('market');G=o;LASTREP=G.lastRep||null;migrateSave();save();applyActiveCities(G.activeIds);$('#start').classList.add('hidden');SCENE.sig='';sceneSync(true);_tk='';UI.go('home');say(TX('protag.resume'))}
