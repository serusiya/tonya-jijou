/* ═════ [07_ui_people] ═════ */
'use strict';
/* ★檔案總覽：人物介面、面板（Sheet）、筆記、私宅、開局
 * - SHEETS[type]()：回傳 {title,html} 的底部面板（奉行所、花街、公會、商邸、倉庫、聘人、說親…）。
 * - personBlock：人物卡（拜訪、送禮、請託的統一表單）。
 * - renderNotes/noteCard：筆記（只收已結識者與員工）。renderEstate：私宅（介紹人、員工、家族）。
 * - UI.showStart/ACT.begin：開局畫面。 */
/* ======================= 07 介面：人物卡、筆記、私宅、各處所面板、傳承、開局 ======================= */
/** 底部/置中面板的內容產生器表：SHEETS[type]() 回傳 {title,html}。新增面板＝在此加一個函式並用 UI.openSheet(type) 開啟。 */
const SHEETS={};
/** 人物未兌現承諾的顯示與兌現按鈕。 */
function promiseLines(cid){
  const r=R(cid);
  return r.promises.map((p,i)=>p.done?'':'<div class="card warn tiny" style="margin:3px 0"><div class="row"><span>⏰ '+UT('ppl.promiseLines.3',{a:esc(p.text),b:p.due,c:G.turn>p.due?UT('ppl.promiseLines'):UT('ppl.promiseLines.2',{a:p.due-G.turn})})+'</span><span style="white-space:nowrap"><button class="pixel-btn btn-sm btn-gold" data-act="pay" data-cid="'+cid+'" data-i="'+i+'">'+UT('btn.pay')+'</button>'+(p.kind==='tribute'&&p.by==='official'?' <button class="pixel-btn btn-sm btn-red" data-act="reportExtort" data-cid="'+cid+'">'+UT('btn.reportExtort')+'</button>':'')+'</span></div></div>').join('');   // 官員索賄：可以告發（第二百五十三節）
}
/** 【人物卡】未結識→請引薦/毛遂自薦；已結識→備禮拜訪表單（禮物＋請託＋什麼都不說）、承諾、請當介紹人。ctx 表示出現的處所。 */
function personBlock(cid,ctx){
  if(npc(cid)&&npc(cid).role==='oiran')return oiranBlock(cid,ctx);
  const c=CH(cid),n=npc(cid),r=R(cid),isOff=n&&n.pos,out=ctx==='out';if(!out)autoIntro(cid);   // out：外城出遊面板的外城友人卡（07zzn_outfriend.js）
  /* 知名度不足（含介紹人 +1 階）而見不到的人：半透明、不可點選 */
  const gm=ctx==='gm',away=!gm&&awayNow(n),lockNeed=meetTierNeed(cid),snub=!gm&&snubbed(cid),locked=!gm&&(away||snub||!r.bond&&lockNeed>fameTier()+((G.introId&&introOf(G.introId))?1:0));   // gm：公會長選舉的拉票名單（例會上同業都在座，不看門檻）
  let h='<div class="card'+(locked?' locked':'')+'" data-cid="'+cid+'">'+portraitBtn(cid,56)+(away?UT('ppl.h',{a:tourNext(n)}):snub?UT('ppl.h.2'):locked?'<div class="tiny" style="color:#b3261e">🔒 '+(isOff?UT('ppl.h.3'):UT('ppl.h.4'))+'</div>':'')+'<div class="row"><div><b>'+esc(c.name)+'</b>'+(c.gender==='f'?UT('ppl.h.5'):'')+' '+(isEnemy(c.id)?UT('ppl.h.6'):'')+'<span class="tag gray">'+(ROLE_LABEL[n?n.role:roleOf(c)]||'')+'</span>'+kakeTag(cid)+(empRole(cid)?'<span class="tag red">'+rankName(empRole(cid))+'</span>':'');
  if(isOff)h+='<span class="tag '+COURTS[n.pos.court].cls+'">'+COURTS[n.pos.court].name+'</span><span class="tag clk" data-act="posInfo" data-id="'+n.pos.posId+'">'+esc(posTitle(n))+' ⓘ</span><span class="tag gold">'+esc(rankLabel(n).split(/[\u30FB\u00B7]/)[0])+'</span>';
  h+='</div></div>';
  if(out)h+=outWhereLine(cid);                       // 外城友人：住在哪個地區、哪座城
  h+='<div class="text-brief muted" style="margin:2px 0">'+esc(c.family_summary.slice(0,46))+'……</div>';
  if(isOff)h+=escortTag(cid);                        // 同行朋友等著被引見（07zzb_escort.js）
  if(!r.bond&&foreignReg(n)){
    h+=letterMeetHtml(cid);                          // 外地遠國奉行所官員：只能寄問候信（07zz_letters.js）
  }else if(!r.bond){
    h+=UT('ppl.personBlock');
    const pv=G.introId?introPreview(G.introId,cid):null;
    const pt=!pv?UT('ppl.pt'):pv.known?UT('ppl.pt.4',{a:pv.cp.label,b:pv.cp.shared.map(statName).join(UT('ppl.pt.2'))||UT('ppl.pt.3')}):UT('ppl.pt.5');
    h+='<div class="notice tiny" style="margin:4px 0">'+pt+'</div>';
    const via=!!(G.introId&&introOf(G.introId));
    h+='<div class="row" style="justify-content:flex-start;gap:4px;flex-wrap:wrap"><button class="pixel-btn btn-sm btn-gold" data-act="meet" data-cid="'+cid+'">'+(via?UT('ppl.personBlock.2',{a:coinHtml('silver',introFee(cid))}):UT('ppl.personBlock.3',{a:costBtn('selfIntro')}))+'</button>'+(r.topKnown?'':'<button class="pixel-btn btn-sm" data-act="scout" data-cid="'+cid+'">'+UT('btn.scoutFull',{c:coinHtml('silver',scoutCost(cid))})+'</button>')+'</div>';
  }else if(isEnemy(cid)){
    h+=out?UT('of.enemy'):UT('ppl.personBlock.4');   // 外城友人成仇：只寫已成仇，不給指令
  }else if(out){
    h+=UT('ppl.personBlock.5',{a:affCls(r.aff)})+'">'+affWord(r.aff)+'</span> <span class="tag">'+esc(r.bond.label)+'</span></span><div style="width:90px">'+bar(r.aff,100,'gold')+'</div></div>';
    h+=outRowHtml(cid);                              // 外城友人：寄信、作客（不列性向與軟肋）
  }else{
    h+=UT('ppl.personBlock.5',{a:affCls(r.aff)})+'">'+affWord(r.aff)+'</span> <span class="tag">'+esc(r.bond.label)+'</span></span><div style="width:90px">'+bar(r.aff,100,'gold')+'</div></div>';
    if(r.topKnown){const pv=G.introId?introPower(G.introId,cid):null;h+=UT('ppl.personBlock.7',{a:top3Txt(cid)})+'</b>'+(pv?UT('ppl.personBlock.6',{a:pv.cp.cls})+'">'+pv.cp.label+'</span>':'')+'</div>'}
    else h+=UT('ppl.personBlock.8',{a:cid})+'">'+UT('btn.scout',{c:coinHtml('silver',scoutCost(cid))})+'</button></div>';
    if(r.verified)h+=UT('ppl.personBlock.9',{a:esc(weakName(c.weakness))})+'</b></div>';
    else h+=UT('ppl.personBlock.10');
    if(gm){h+=gmCanvassRow(cid);return h+'</div>'}   // 拉票名單：只有拉票列（07yc_gm.js）
    h+=foreignReg(n)?letterRowHtml(cid):visitRowHtml(cid);   // 外地遠國奉行所官員：書信往來（07zz_letters.js）
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
  if(roninOfficial(el.dataset.cid)&&el.dataset.err!=='1'){roninVisit(el.dataset.cid);return}   // 自己扶持的官員：略過拜訪戰鬥（07zw_ronin.js）
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
    if(roll.outcome==='absent'){logRel(cid,UT('ppl.visit.3'));toast(MSG('resolveVisit.1',{cid:nameOf(cid)})+escortFail(cid,'door'));UI.render();refreshSheet();return}
    if(roll.outcome==='refuse'){const c=Math.min(G.silver,costOf('visitRefused'));spendAmt('visitRefused',c);r.lastOk=false;logRel(cid,UT('ppl.visit.4'));toast(MSG('resolveVisit.2',{c})+escortFail(cid,'door'));sfx.bad();UI.render();refreshSheet();return}
    if(byErr){errandVisit(cid);return}
    battleStart(cid,gift);
  });
};
/** 探聽性向。 */
ACT.scout=el=>rr(scout(el.dataset.cid));
/** 兌現承諾。 */
/** 告發索賄的官員（人物卡上的承諾、索賄的來訪卡）。不扣行動點數。 */
ACT.reportExtort=el=>{const msg=reportExtort(el.dataset.cid);toast(msg,5200);if(el.dataset.face)UI.hideInfo();UI.render();refreshSheet()};
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
UI.openSheet=function(type,arg){UI.s.sheet={type,arg};UI.s.quitArm=false;sfx.step();renderSheet(true)};
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
  if(escortOffer(k,()=>goWalk(k)))return;          // 出門時有人想同行（07zzb_escort.js）
  goWalk(k)}
/** 播走路動畫後開啟面板。 */
function goWalk(k){const i=GO_INFO[k];
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
  let h=UT('ppl.h.10',{a:(appsCard()+licCard()),b:G.heat>6?UT('ppl.h.7'):G.heat>3?UT('ppl.h.8'):UT('ppl.h.9')})+'</div>';
  return {title:UT('ppl.yamen',{a:homeCity().name}),html:h+'<div style="margin:4px 0"><button class="pixel-btn btn-sm" data-act="posList">'+UT('btn.posList')+'</button></div>'
    +tabPills([['all',UT('ppl.yamen.2'),all.length]].concat(CITY_COURTS.map(k=>[k,COURTS[k].name,all.filter(n=>n.pos.court===k).length])),tab,'yamenTab')
    +(offs.map(n=>personBlock(n.cid,'yamen')).join('')||UT('ppl.yamen.3'))};
};
ACT.yamenTab=el=>{UI.s.yamenTab=el.dataset.k;refreshSheet()};
/** 聯合採購與出貨協議表態（參加/退出；暗約已取消）。 */
ACT.cartel=el=>{
  const s=el.dataset.s,C=G.cartel;guildEnsure();
  if(s===C.state){toast(MSG('cartel.same'));return}
  if(s==='none'&&!UI.s.quitArm){UI.s.quitArm=true;refreshSheet();return}   // 退出協議要按第二次確認
  UI.s.quitArm=false;
  const joining=s!=='none'&&!(guildMember()&&C.bond>0);
  if(joining&&!afford('guildBond')){toast(shortMsg('guildBond'));return}
  if(s==='secret')return;                          // 暗約已取消（第二百五十六節）
  if(!C.paid){if(!spendAP())return;C.paid=true}
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
  return {title:UT('ppl.residences'),html:UT('ppl.residences.3',{a:'',b:tabPills(tabs,tab,'resTab'),c:list.map(n=>personBlock(n.cid,'res')).join('')||UT('ppl.residences.2')})};
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
  h+=UT('ppl.warehouse.6',{a:G.wh.cap,b:whMax(),c:wm?UT('ppl.warehouse.5'):''})+'</div><div class="row" style="justify-content:flex-start;gap:4px;flex-wrap:wrap;margin-top:4px"><button class="pixel-btn btn-sm btn-gold" data-act="whUp" '+(wm?'disabled':'')+'>'+(wm?UT('btn.whMax'):UT('btn.whUp',{c:coinHtml('silver',wc)}))+'</button></div></div>';
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
  let calm='';{const S=G.staple,C=ODDS.charity;if(S&&S.streak>0&&!(G.charityRiotT>G.turn-C.cd)){S.streak=Math.max(0,S.streak-C.riotCut);G.charityRiotT=G.turn;calm=MSG('charity.calm')}}   // 米鹽價超過打毀門檻時：打毀的連續旬數減一，三旬一次（第三百一十六節）
  const t=NEWS('charity.1',{name:G.me.name,homeCity:homeCity().name});pushNews(t);
  sfx.fanfare();toast(MSG('charity.1',{famine:(famine?UT('ppl.charity.2'):'')})+calm);UI.render();refreshSheet();
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
ACT.newLife=()=>{if(UI.s.sheetLock||confirm(UT('ppl.newLife'))){UI.s.sheetLock=false;UI.s.sheet=null;UI.s.startDeck=null;UI.s.startTier=0;UI.s.startSys=null;$('#sheet-bd').classList.add('hidden');clearSave();G=null;musicWant(null);UI.showStart()}};

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
  if(UI.s.notesTab==='map'){renderMap();return}   // 地圖頁（07p_wiki.js）
  const q=UI.s.notesQ.trim(),f=UI.s.notesF;
  let list=G.known.filter(id=>CH(id)&&noteSeen(id)).map(id=>({id,c:CH(id),n:npc(id),r:R(id)}));
  if(f==='emp')list=G.emps.filter(e=>e.cid&&CH(e.cid)).map(e=>({id:e.cid,c:CH(e.cid),n:npc(e.cid),r:R(e.cid)}));
  list=list.filter(x=>{
    if(f==='emp')return !q||x.c.name.includes(q)||(empRole(x.id)?rankName(empRole(x.id)):'').includes(q);
    if(q&&!(x.c.name.includes(q)||(x.n&&(ROLE_LABEL[x.n.role]||'').includes(q))))return false;
    const role=x.n?x.n.role:roleOf(x.c);
    if(f==='out')return isOutFriend(x.id);            // 外城友人（07zzn_outfriend.js）
    if(f==='all')return true;if(f==='other')return !['official','rival','manager','guest','broker','smuggler','oiran'].includes(role);return role===f;
  }).sort((a,b)=>b.r.aff-a.r.aff);
  const overdue=G.known.filter(noteSeen).some(id=>R(id).promises.some(p=>!p.done&&G.turn>p.due));
  let h='<div class="pixel-box" style="padding:8px">'+UT('ppl.h.13',{a:notesTabsHtml(),b:G.known.filter(id=>CH(id)&&noteSeen(id)).length,c:G.world.sampleSize})+'</span></div>';
  h+=UT('ppl.renderNotes',{a:esc(UI.s.notesQ)})+'"></div>';
  h+='<div>'+NOTE_FILTERS.map(([k,n])=>'<span class="pill '+(f===k?'on':'')+'" data-act="nf" data-k="'+k+'">'+n+'</span>').join('')+'</div>';
  if(overdue)h+=UT('ppl.renderNotes.2');
  const apps=f==='emp'?G.emps.filter(e=>!e.cid&&(!q||e.name.includes(q)||rankName(e.rank).includes(q))):[];
  const appH=apps.map(e=>'<div class="card emp-card"><div class="row"><div><b>'+esc(e.name)+'</b> <span class="tag red">'+UT('ppl.appH',{a:rankName(e.rank),b:e.wage,c:G.turn-e.since,d:ratingStars(e.stats)})+'</div></div>').join('');
  h+='<div style="margin-top:4px">'+(noteListHtml(list,f)+appH||'<div class="notice">'+(f==='emp'?UT('ppl.renderNotes.3'):UT('ppl.renderNotes.4'))+'</div>')+'</div></div>';
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
  h+=dealCard();                                     // 商行往來：還沒了結的帳、約與差事（07zzo_dealings.js）
  // 宴會
  h+=banquetCard();
  // 介紹人
  h+=UT('ppl.renderEstate.5');
  h+=G.intros.map(i=>{const cid=i.cid,r=R(cid),sel=cid===G.introId;return '<div class="card '+(sel?'good':'')+'"><div class="row"><div><b>'+UT('ppl.renderEstate.10',{a:esc(nameOf(cid)),b:top3Txt(cid)})+'</b></div></div><div style="text-align:right" class="tiny">'+(r.aff>=75?UT('ppl.renderEstate.6'):r.aff>=55?UT('ppl.renderEstate.7'):r.aff>=35?UT('ppl.renderEstate.8'):UT('ppl.renderEstate.9'))+'</div></div><div style="margin:3px 0">'+UT('ppl.renderEstate.11',{a:bar(r.aff,100,'gold'),b:Math.round(r.aff),c:affWord(r.aff)})+'</span></div></div>'}).join('')||UT('ppl.renderEstate.12',{a:UT('btn.go')})+'</button></div>';
  h+=UT('ppl.renderEstate.13');
  // 夥計
  h+=UT('ppl.renderEstate.14');
  h+='<div class="notice tiny">'+RANKS.concat(['guard']).map(k=>'• <b>'+UT('ppl.renderEstate.15',{a:rankName(k),b:DUTY_DESC[k]})).join('<br>')+'</div>';
  h+=SPECIAL.filter(k=>k!=='captain'&&k!=='courier').concat(RANKS.slice().reverse()).map(rk=>{
    const ls=G.emps.filter(e=>e.rank===rk);
    return ls.map(e=>{
      if(e.flag&&!e.caught)e.caught=e.flag;                                  // 舊存檔：已查出的私吞改為待處置
      return '<div class="card '+(e.caught?'warn':'')+'" style="display:flow-root">'+UT('ppl.renderEstate.17',{a:portraitEmp(e,56),b:rankName(e.rank),c:esc(e.name)})+'</b> '+staffTags(e)+'<div class="tiny muted">'+UT('ppl.renderEstate.18',{a:e.cid?'':UT('ppl.renderEstate.16'),b:e.wage,c:staffTenure(e),d:ratingStars(e.cid||statsOfEmp(e))})+'</div></div>'+empAffHtml(e)+'<div class="row" style="margin-top:3px;justify-content:flex-start;gap:4px;flex-wrap:wrap">'+auditBtns(e)+(e.rank!=='chief'&&!SPECIAL.includes(e.rank)?'<button class="pixel-btn btn-sm btn-green" data-act="promote" data-id="'+e.id+'">'+UT('btn.promote')+'</button>':'')+reBtn(e)+staffChatBtn(e)+'<button class="pixel-btn btn-sm" data-act="fire" data-id="'+e.id+'">'+UT('btn.fire')+'</button></div></div>';
    }).join('');
  }).join('');
  const apBtn=' '+UT('ppl.apprenticeBtn',{a:UT('btn.apprentice',{c:costBtn('apprentice')})});   // 招丁稚放在物色右邊
  h+=hasVacancy()?UT('ppl.renderEstate.19',{a:costTxt('recruitIntro'),b:UT('btn.recruit')})+'</button>'+apBtn+'</div></div>':UT('ppl.renderEstate.19full',{a:costTxt('recruitIntro'),b:UT('btn.recruitFull')})+'</button>'+apBtn+'</div></div>';
  if(G.recruit&&G.recruit.cands.length)h+=UT('ppl.renderEstate.20',{a:G.recruit.cands.length,b:UT('btn.recruitView')})+'</button></div>';
  h+=enlistBlockHtml();                             // 延攬熟人（07zz_enlist.js）
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
  if(!hasVacancy()){toast(MSG('recruit.full'));return}
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
  let h=kinds.map(([k,n,d])=>'<div class="mkt-row '+(ms.kind===k?'on':'')+'" data-act="marryKind" data-k="'+k+'"><div><b>'+n+'</b><div class="tiny muted">'+d+'</div></div></div>').join('');
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
/** 每一世把八個行業洗牌，抽七個分到固定的七個資源等級；開局畫面重繪時沿用同一副牌。 */
function makeStartDeck(){
  const drop=Math.random()<0.5?'marine':'pickle';  // 魚屋與醬漬問屋共用一個位子（第三百零二節）
  const a=SYS.map(s=>s.key).filter(k=>k!==drop);
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a.slice(0,START_TIERS.length);            // 八個行業抽七個上牌（第三百零一節）
}
/** 顯示開局畫面（選流派、地區）。 */
UI.showStart=function(){
  if(!Array.isArray(UI.s.startDeck)||UI.s.startDeck.length!==START_TIERS.length)UI.s.startDeck=makeStartDeck();
  if(!Number.isInteger(UI.s.startTier)||UI.s.startTier<0||UI.s.startTier>=START_TIERS.length)UI.s.startTier=0;
  UI.s.startSys=UI.s.startDeck[UI.s.startTier];
  let sv=loadSave();if(sv&&sv.ended){clearSave();sv=null}   // 舊版留下的已落幕存檔：清除
  let h=UT('ppl.h.18',{a:GAME_VER})+'</span></div>';
  h+=UT('ppl.showStart');
  if(!sv&&OLD_SAVE_FOUND)h+=UT('ppl.showStart.2',{a:GAME_VER});
  if(sv)h+='<button class="pixel-btn btn-gold" style="width:100%;padding:8px;margin-bottom:10px" data-act="resume">'+UT('btn.resume',{n:esc(sv.me.name),y:yearStr(sv.year)})+'</button>';
  h+=UT('ppl.showStart.3');
  h+=UI.s.startDeck.map((key,i)=>{const s=SYS_BY_KEY[key],t=START_TIERS[i];return '<div class="sys-card '+(UI.s.startTier===i?'sel':'')+'" data-act="pickSys" data-k="'+s.key+'" data-t="'+i+'"><h3>'+s.firm+'·'+s.name+' <span class="tag gold">'+s.style+'</span></h3><div class="small">'+s.tip+'</div><div class="tiny muted" style="margin-top:2px">▸ '+UT('ppl.showStart.4',{a:t.perk,b:t.res})+'</div></div>'}).join('');
  if(!ODDS.guildPolicy.diffNormal[UI.s.startDiff])UI.s.startDiff=ODDS.guildPolicy.diffDefault;   // 難度（第二百八十二節）；預設簡易（第二百八十五節）
  h+=UT('start.diff.t')+'<div style="text-align:center">'+['easy','normal','hard'].map(k=>'<span class="pill '+(UI.s.startDiff===k?'on':'')+'" style="font-size:15px;padding:3px 14px" data-act="pickDiff" data-k="'+k+'">'+NM('diff',k)+'</span>').join('')+'</div><div class="tiny" style="color:#cfc6b6;text-align:center;margin-top:3px">'+UT('start.diff.'+UI.s.startDiff)+'</div>';
  h+='<button class="pixel-btn btn-red" style="width:100%;padding:10px;margin-top:14px;font-size:17px" data-act="begin">'+UT('btn.begin')+'</button>';
  h+=saveIoHtml(!!sv);                               // 匯出（有存檔時）與匯入存檔（07z_saveio.js）
  h+='<button class="pixel-btn" style="width:100%;padding:7px;margin-top:12px" data-act="changelog">'+UT('btn.changelog')+'</button>';   // 更新紀錄（01h_changelog.js）
  $('#start-inner').innerHTML=h;$('#start').classList.remove('hidden');
};
/** 更新紀錄視窗：新的在上，日期加條列說明。 */
ACT.changelog=()=>{$('#info-bd').classList.add('over-start');UI.showInfo(UT('ppl.changelog'),CHANGELOG.map(c=>'<div style="margin-bottom:8px"><b>'+esc(c.date)+'</b>'+c.items.map(t=>'<div class="small" style="margin-top:3px;padding-left:1em;text-indent:-1em">• '+esc(t)+'</div>').join('')+'</div>').join(''))};
/** 選擇流派。 */
/** 選擇難度。 */
ACT.pickDiff=el=>{UI.s.startDiff=el.dataset.k;UI.showStart();sfx.tap()};
ACT.pickSys=el=>{UI.s.startTier=Number(el.dataset.t)||0;UI.s.startSys=el.dataset.k;UI.showStart();sfx.tap()};
/** 開始新局。 */
ACT.begin=()=>{
  musicWant('market');                                // 點擊開局＝使用者手勢，可以開始播放音樂
  newGame(UI.s.startSys,'rand',UI.s.startTier,UI.s.startDiff);$('#start').classList.add('hidden');
  SCENE.sig='';sceneSync(true);_tk='';UI.go('home');say(TX('protag.open',{firm:G.firm}),4200);
  save();
  LASTREP=null;showTurnReport([{}],G.news.map(x=>x.t).reverse(),0,'open');   // 開業旬報：進出貨皆空，列開局消息
};
/** 繼續上次存檔。 */
ACT.resume=()=>enterSave(loadSave());
/** 以一份存檔進入遊戲（繼續人生、匯入存檔共用）。 */
function enterSave(o){if(!o)return;musicWant('market');G=o;LASTREP=G.lastRep||null;migrateSave();save();applyActiveCities(G.activeIds);$('#start').classList.add('hidden');SCENE.sig='';sceneSync(true);_tk='';UI.go('home');say(TX('protag.resume'))}

/* ═════ [07b_purse] ═════ */
/* =====================================================================
 * 07b_purse.js — 現款／私房錢、保鏢遇襲
 *  - 現款 = G.silver：貨款、賄賂、拜訪、薪資皆用現款。
 *  - 私房錢 = G.gold：花街、走私、出遊專用；督促期的闇商代出貨款也進這裡（07zzq_urge.js）。
 *  - 私房錢來源：①從商號帳上挪用（每次最多 50 兩，扣 1 行動點數）②每旬盈餘抽成（0～3%）。
 *  - 撥回現款：每旬一次、扣 1 行動點數、一次 100 兩（PURSE_BACK）。好感 100 的大番頭另可大筆轉帳（07m_loyalty.js）。
 *  - 私房錢滿 2000 兩，名望多一階（fameTier）。
 *  - 保鏢（SPECIAL 職位）：出門前往時 0.5～3% 遇襲，見 rollAmbush。
 * ===================================================================== */

/** 單次從現款挪用的上限（兩）。 */
const SKIM_MAX=50,SKIM_MIN=30;
/** 每旬盈餘抽成上限（比例）。 */
const SKIM_PCT_MAX=0.03;
/** 私房錢撥回現款：每次金額（每旬一次）。 */
const PURSE_BACK=100;
/** 轉出私房錢後若跌破名望門檻，提醒一句。 */
const purseTierNote=()=>UT('purse.purseTierNote',{a:fmt(ODDS.fame.goldTier)});

/** 私房錢面板（點最上方「私房錢」欄）：從現款挪用／設定每旬抽成。 */
SHEETS.purse=()=>{
  const pct=(G.skimPct||0)*100;
  let h=UT('purse.h');
  h+=UT('purse.purse',{a:SKIM_MIN,b:SKIM_MAX})+'<div class="row" style="margin-top:4px"><button class="pixel-btn btn-sm btn-gold" data-act="skim">'+UT('btn.skim')+'</button></div></div>';
  h+=UT('purse.purse.2',{a:pct.toFixed(1)})+'<input type="range" min="0" max="30" step="1" value="'+Math.round(pct*10)+'" data-chg="skimPct" style="width:100%"></div>';
  const back=G.purseBackT===G.turn;
  h+=UT('purse.purse.5',{a:PURSE_BACK})+'<div class="row" style="margin-top:4px"><button class="pixel-btn btn-sm btn-green" data-act="purseBack" '+(back||G.gold<PURSE_BACK?'disabled':'')+'>'+(back?UT('purse.purse.3'):UT('purse.purse.4',{a:PURSE_BACK}))+'</button></div>'+purseTierNote()+'</div>';
  h+=UT('purse.purse.6',{a:Math.round(G.gold),b:fmt(G.silver)});
  return {title:UT('purse.purse.7'),html:h};
};
ACT.purse=()=>UI.openSheet('purse');
/** 從現款挪用：隨機 30～50 兩，扣 1 行動點數。 */
ACT.skim=()=>{
  const amt=Math.min(Math.floor(G.silver),SKIM_MIN+Math.floor(rnd()*(SKIM_MAX-SKIM_MIN+1)));
  if(amt<1){toast(MSG('skim.1'));return}
  if(G.silver<amt){toast(MSG('skim.1'));return}
  if(!spendAP())return;
  G.silver-=amt;G.gold+=amt;G.life.skimmed=(G.life.skimmed||0)+amt;
  sfx.coin();toast(MSG('skim.2',{amt}));
  UI.render();refreshSheet();
};
/** 私房錢撥回現款：每旬一次、扣 1 行動點數、一次 100 兩。 */
ACT.purseBack=()=>{
  if(G.purseBackT===G.turn){toast(MSG('purse.purseBack'));return}
  if(G.gold<PURSE_BACK){toast(MSG('purse.purseBack.2',{a:PURSE_BACK}));return}
  if(!spendAP())return;
  G.gold-=PURSE_BACK;G.silver+=PURSE_BACK;G.purseBackT=G.turn;
  sfx.coin();toast(MSG('purse.purseBack.3',{a:PURSE_BACK}));
  UI.render();refreshSheet();
};
/** 設定每旬抽成比例（滑桿 0～30 → 0～3.0%）。 */
CHG.skimPct=el=>{G.skimPct=Math.min(SKIM_PCT_MAX,Math.max(0,(+el.value||0)/1000));const v=$('#skim-pct-v');if(v)v.textContent=(G.skimPct*100).toFixed(1)+'%';save()};
/** 每旬結算：盈餘（現款較旬初的增加量）按比例撥入私房錢。s0＝旬初現款。 */
function skimTick(log,s0){
  G.lastSkim=0;
  const p=G.skimPct||0;if(p<=0)return;
  const surplus=G.silver-s0;if(surplus<=0)return;
  const amt=Math.floor(surplus*p);if(amt<1)return;
  G.silver-=amt;G.gold+=amt;G.lastSkim=amt;
  log.push(NEWS('skimTick.1',{surplus:fmt(surplus),p:(p*100).toFixed(1),amt}));
}

/* ---------------- 保鏢與遇襲 ---------------- */
/** 養傷中則提示並回傳 true（所有「出門前往」都受限）。 */
function injuredBlock(){
  if((G.exile||0)>0){toast(MSG('injuredBlock.1',{exile:G.exile}));return true}
  if((G.injured||0)>0){toast(MSG(hurtKey('injuredBlock.2'),{injured:G.injured}));return true}
  return false;
}
/** 每旬遞減養傷期。 */
function injuryTick(log){
  if((G.injured||0)>0){G.injured--;if(G.injured===0){const sick=G.injKind==='sick';G.injKind=null;log.push(NEWS(sick?'injuryTick.sick':'injuryTick.1'));consoleNote(sick?'healSick':'heal')}}   // 傷癒後朋友上門慰問（下一旬，07zz_friends.js）
}
/** 遇襲機率：基本 0.5%～3%（知名度越高越危險），另加每位仇人 +3%。 */
function ambushChance(){const A_=ODDS.ambush;return clamp(A_.base+A_.perFame*(G.fame||0),A_.min,A_.max)+ENEMY_AMBUSH*enemyCount()}   // 每位仇人 +3%
/** 戰力＝保鏢的膽識（audacity_courage）。 */
const guardPower=e=>statsOfEmp(e).audacity_courage;
/**
 * 出門時擲遇襲。回傳 null＝平安；{abort:true}＝受傷中止行程；
 * 其他＝遇襲但化解（無傷退敵／保鏢替死），行程照常。
 */
function rollAmbush(){
  if(daimyoActive())return null;                    // 大名行列過境當旬沿路警備森嚴，不擲遇襲（07zzc_daimyo.js）
  if(!chance(ambushChance()))return null;
  {const rc=roninRescue();if(rc){const t=NEWS('ronin.rescue',{n:nameOf(rc)});pushNews(t);toast(t,5200);sfx.gift();UI.render();return {ok:true,repelled:true}}}   // 浪人頭拔刀相助（07zw_ronin.js）
  const gs=G.emps.filter(e=>e.rank==='guard'&&!jailedEmp(e)).sort((a,b)=>guardPower(b)-guardPower(a));
  if(gs.length){
    const g=gs[0],pw=guardPower(g);
    // 膽識 ≥70 必定無傷退敵；否則機率 (pw/70)^2，失敗則保鏢替你擋刀而亡
    if(pw>=ODDS.ambushDefend.power||chance(Math.pow(pw/ODDS.ambushDefend.power,2))){
      const t=NEWS('rollAmbush.1',{name:g.name});
      pushNews(t);toast(t,4200);addFame(0.3);return {ok:true,repelled:true};
    }
    G.emps=G.emps.filter(e=>e.id!==g.id);
    const t=NEWS('rollAmbush.2',{name:g.name});
    pushNews(t);toast(t,4800);sfx.bad();UI.render();return {ok:true,died:true};
  }
  G.injured=1+Math.floor(rnd()*6);G.injKind=null;
  const t=NEWS('rollAmbush.3',{injured:G.injured});
  pushNews(t);toast(t,5200);sfx.bad();UI.render();
  return {abort:true};
}

/* ═════ [07c_report] ═════ */
/* =====================================================================
 * 07c_report.js — 推進一旬後的「旬報」彈窗（收支圖表化）
 *  - doTurn 把每旬的 TURNRP 收集成 G.report，這裡負責彙整並畫出來。
 * ===================================================================== */

/** 把一或多旬的報告彙整成 {rev, ship[], costs{}, skim, fame, net, other}。 */
function mergeReports(reps){
  const T={guildDiv:0,windfall:0,branch:0,honjin:0,kakeDep:0,kakeFin:0,buy:{},voy:[],market:[],goods:[],rev:0,ship:{},cost:{wages:0,guards:0,wh:0,fam:0,interest:0,hold:0},publicSpend:{},skim:0,fame:0,net:0,short:[],squeeze:[]};
  reps.forEach(r=>{
    if(!r)return;
    (r.voy||[]).forEach(v=>T.voy.push(v));
    const date=r.marketDate||r.date||'',rs={};
    (r.ship||[]).forEach(x=>{const o=rs[x.n]||(rs[x.n]={q:0,rev:0});o.q+=x.q;o.rev+=x.rev});
    (r.market||[]).forEach(x=>{const m=Object.assign({date},x),s=rs[x.n]||{q:0,rev:0},b=(r.buy&&r.buy[x.n])||{q:0,cost:0};T.market.push(m);T.goods.push(Object.assign({sq:s.q,rev:s.rev,bq:b.q,cost:b.cost},m))});
    Object.keys(rs).concat(Object.keys(r.buy||{})).filter((n,i,a)=>a.indexOf(n)===i&&!(r.market||[]).some(x=>x.n===n)).forEach(n=>{const s=rs[n]||{q:0,rev:0},b=(r.buy&&r.buy[n])||{q:0,cost:0};T.goods.push({date,n,sq:s.q,rev:s.rev,bq:b.q,cost:b.cost})});
    T.rev+=r.rev||0;T.guildDiv+=r.guildDiv||0;T.windfall+=r.windfall||0;T.branch+=r.branch||0;T.honjin+=r.honjin||0;T.kakeDep+=r.kakeDep||0;T.kakeFin+=r.kakeFin||0;
    Object.entries(r.buy||{}).forEach(([k,x])=>{const o=T.buy[k]||(T.buy[k]={q:0,cost:0});o.q+=x.q;o.cost+=x.cost});T.skim+=r.skim||0;T.fame+=r.fame||0;if(r.fameGate)T.fameGate=true;T.net+=r.net||0;
    (r.ship||[]).forEach(x=>{const o=T.ship[x.n]||(T.ship[x.n]={q:0,rev:0});o.q+=x.q;o.rev+=x.rev});
    Object.keys(T.cost).forEach(k=>T.cost[k]+=(r.cost&&r.cost[k])||0);
    Object.entries(r.publicSpend||{}).forEach(([k,v])=>{T.publicSpend[k]=(T.publicSpend[k]||0)+v});
    Object.entries(r.inTurn||{}).forEach(([k,v])=>{T.publicSpend[k]=(T.publicSpend[k]||0)+v});   // 推進途中付的主動支出（如忘年會），已含在本旬淨額裡
    (r.short||[]).forEach(s=>{if(!T.short.includes(s))T.short.push(s)});
    (r.squeeze||[]).forEach(s=>{if(!T.squeeze.includes(s))T.squeeze.push(s)});
  });
  return T;
}
/** 畫一列：圖示＋名稱＋比例條＋金額。 */
function repRow(icon,label,amt,max,cls){
  const w=max>0?Math.max(3,Math.round(amt/max*100)):0;
  return '<div class="rp-row"><span class="rp-ic">'+icon+'</span><span class="rp-lb">'+label+'</span><span class="rp-bar"><i class="'+cls+'" style="width:'+w+'%"></i></span><b class="rp-amt '+cls+'">'+(cls==='in'?'+':'−')+fmt(amt)+'</b></div>';
}
/** 貨物收支：每項貨第一行列本旬淨收支；第二行靠右列「牌價 → 新牌價（漲跌）」，碰到底價時註明。盈利與零值紅色，虧損綠色。 */
function goodsRows(T){
  const tradable=mkComms(),allowed=new Set(tradable.map(c=>c.short)),order=new Map(tradable.map((c,i)=>[c.short,i]));
  const L=(T.goods||[]).filter(x=>allowed.has(x.n)).sort((a,b)=>{const d=(a.date||'').localeCompare(b.date||'');return d||((order.get(a.n)??999)-(order.get(b.n)??999))});
  if(!L.length)return UT('rep.goodsRows');
  const mx=Math.max(1,...L.map(x=>Math.max(x.rev||0,x.cost||0)));
  return UT('rep.goodsRows.2',{a:L.map(x=>{
    const rev=x.rev||0,cost=x.cost||0,net=rev-cost,big=Math.max(rev,cost),incomeBase=rev>=cost;
    const w=big>0?Math.max(3,Math.round(big/mx*100)):0,ws=big>0?Math.round(Math.min(rev,cost)/mx*100):0;
    const bar='<span class="rp-bar" style="position:relative"><i class="'+(incomeBase?'in':'out')+'" style="width:'+w+'%"></i>'+(ws>0?'<i class="'+(incomeBase?'out':'in')+'" style="position:absolute;left:0;top:0;width:'+ws+'%"></i>':'')+'</span>';
    const next=Number.isFinite(x.next)?x.next:x.close;
    const price=Number.isFinite(x.quote)&&Number.isFinite(next)?(x.floored?UT('rep.goodsPrice.floor',{q:fmt1(x.quote),n:fmt1(next)}):UT('rep.goodsPrice',{q:fmt1(x.quote),c:fmt1(next),v:'<span class="'+(next>=x.quote?'up':'down')+'">'+amtShort(Math.round(next-x.quote))+'</span>'})):'';
    return UT('rep.goodsLine',{n:esc(x.n),bar,cls:net>=0?'up':'down',net:(net>=0?'+':'−')+fmt(Math.abs(net)),p:price});
  }).join('')});
}
/** 彈出旬報。reps＝本次推進的各旬報告；logs＝事件文字。 */
var LASTREP=null;
/** 畫出旬報。kind：undefined＝一般旬報、'open'＝開業旬報、'recent'＝近況（舊存檔沒有上一份旬報時）。上一份旬報存進 G.lastRep，重新載入後按瓦版仍可重開。 */
function showTurnReport(reps,logs,n,kind){
  LASTREP={reps,logs,n,kind};if(G&&!G.ended){G.lastRep=LASTREP;save()}
  const T=mergeReports(reps);
  const costs=[['👥',UT('rep.costs'),T.cost.wages],['🏚️',UT('rep.costs.2'),T.cost.wh],['🛡️',UT('rep.costs.3'),T.cost.hold],['🏠',UT('rep.costs.4'),T.cost.fam],['💸',UT('rep.costs.5'),T.cost.interest]].filter(x=>x[2]>0);
  const publicSpend=Object.entries(T.publicSpend).filter(x=>x[1]>0),publicSpendTotal=publicSpend.reduce((a,x)=>a+x[1],0);
  const exp=costs.reduce((a,x)=>a+x[2],0);
  const voyBack=T.voy.reduce((a,v)=>a+(v.back||0),0);         // 委託採買歸來退回的委託金餘額
  const buyTotal=Object.values(T.buy).reduce((a,x)=>a+x.cost,0);                 // 大盤進貨（推進時下單）
  const other=T.net-(T.rev-exp-publicSpendTotal-T.skim-buyTotal)-voyBack-T.guildDiv-T.windfall-T.branch-T.honjin-T.kakeDep-T.kakeFin;      // 其餘雜項：員工私吞、罰款、事件等
  const inc=T.rev+voyBack+T.guildDiv+T.windfall+T.branch+T.honjin+T.kakeDep+T.kakeFin+Math.max(0,other),outl=exp+publicSpendTotal+buyTotal+T.skim+Math.max(0,-other);
  const tot=Math.max(1,inc+outl),pi=Math.round(inc/tot*100);
  if(!kind&&G&&!G.ended)recRep(T.net,inc,outl,n);       // 商號紀錄（07zzg_record.js）；重開舊旬報同一旬不重記
  const max=Math.max(1,voyBack,T.guildDiv,T.windfall,T.branch,T.honjin,T.kakeDep,T.kakeFin,...costs.map(x=>x[2]),...publicSpend.map(x=>x[1]),T.skim,Math.abs(other));
  let h='<div class="rp">';
  h+='<div class="rp-hero '+(T.net>=0?'up':'down')+'"><div class="rp-date">'+(n>1?UT('rep.showTurnReport',{a:n}):kind==='open'?UT('rep.showTurnReport.2'):kind==='recent'?UT('rep.showTurnReport.3'):'')+dateStr()+'</div><div class="rp-net">'+UT('rep.showTurnReport.4',{a:T.net>0?'▲ ':T.net<0?'▼ ':'',b:sgn(T.net),c:fmt(G.silver)});
  h+=raidCard();
  h+='<div class="rp-split"><i class="in" style="width:'+pi+'%"></i><i class="out" style="width:'+UT('rep.showTurnReport.5',{a:100-pi,b:fmt(inc),c:fmt(outl)})+'</span></div>';
  h+=UT('rep.showTurnReport.6',{a:goodsRows(T)});
  if(voyBack>0)h+=repRow('⛵',UT('rep.showTurnReport.7'),voyBack,max,'in');
  if(T.guildDiv>0)h+=repRow('⚖️',UT('rep.showTurnReport.8'),T.guildDiv,max,'in');
  if(T.windfall>0)h+=repRow('💰',UT('rep.showTurnReport.9'),T.windfall,max,'in');
  if(T.branch>0)h+=repRow('🏮',UT('rep.branch'),T.branch,max,'in');
  if(T.honjin>0)h+=repRow('🏯',UT('rep.honjin'),T.honjin,max,'in');
  if(T.kakeDep>0)h+=repRow('📦',UT('rep.kakeDep'),T.kakeDep,max,'in');
  if(T.kakeFin>0)h+=repRow('📦',UT('rep.kakeFin'),T.kakeFin,max,'in');
  if(other>0)h+=repRow('✨',UT('rep.showTurnReport.10'),other,max,'in');
  h+=UT('rep.showTurnReport.12',{a:costs.map(x=>repRow(x[0],x[1],x[2],max,'out')).join('')||UT('rep.showTurnReport.11')});
  if(publicSpend.length)h+=UT('rep.showTurnReport.13',{a:publicSpend.map(x=>repRow('💴',esc(spendLabel(x[0])),x[1],max,'out')).join('')});
  if(other<0)h+=repRow('📦',UT('rep.showTurnReport.14'),-other,max,'out');
  if(T.skim>0)h+=UT('rep.showTurnReport.16',{a:repRow('🟨',UT('rep.showTurnReport.15'),T.skim,max,'out')});
  if(T.fame!==0||T.fameGate||T.short.length||T.squeeze.length){
    const chipsOf=(L,cls)=>L.slice(0,6).map(x=>'<span class="tag '+cls+'">'+esc(x.slice(0,5))+'</span>').join('')+(L.length>6?UT('rep.chipsOf',{a:L.length}):'');
    h+='<div class="rp-fame '+(T.fame>=0?'up':'down')+'"><div class="rp-fame-n">'+(T.fame>0?UT('rep.showTurnReport.17',{a:T.fame}):T.fame<0?UT('rep.showTurnReport.18',{a:T.fame}):T.fameGate?UT('rep.showTurnReport.19'):UT('rep.showTurnReport.20'))+'</div>'+(T.short.length?UT('rep.showTurnReport.21',{a:chipsOf(T.short,'red')})+'</div>':'')+(T.squeeze.length?UT('rep.showTurnReport.22',{a:chipsOf(T.squeeze,'gold')}):'')+'</div>';
  }
  if(T.voy.length)h+=UT('rep.showTurnReport.25',{a:T.voy.map(v=>{const md=v.mode==='land'?'land':'sea';return UT('rep.showTurnReport.24',{k:NM('crew',md),a:esc(v.capt),b:fmt(v.budget),c:v.wreck?UT('rep.showTurnReport.23',{a:UT(voyMishap(md,v.robbed))}):''})+'</b>'+v.lines.map(l=>'<div class="tiny" style="margin-top:3px">'+esc(String(l).replace(/^🌊/,voyIcon(md,v.robbed)))+'</div>').join('')+'</div>'}).join('')});
  const allEv=(logs||[]).filter(t=>!/^📥|^📤|^🟨|^🚢|^🧾/.test(t)&&!NEWS_HIDE_SET.has(newsKey(t)));   // 查貨、借錢有旬報卡片，官吏硬塞有來訪視窗，不再重列
  const isMove=t=>NEWS_MOVE_SET.has(newsKey(t)),moveEv=allEv.filter(isMove);
  const ev=moveEv.concat(allEv.filter(t=>!isMove(t)).slice(0,Math.max(0,15-moveEv.length))).slice(0,15);
  if(ev.length)h+=UT('rep.showTurnReport.26',{a:ev.map(t=>'<div class="rp-ev">'+esc(t)+'</div>').join('')});
  h+='</div>';
  UI.showInfo(kind==='open'?UT('rep.showTurnReport.27'):kind==='recent'?UT('rep.showTurnReport.28'):UT('rep.showTurnReport.29'),h);
}

/* ═════ [07d_inspect] ═════ */
/* =====================================================================
 * 07d_inspect.js — 官吏查貨事件
 *  - 推進一旬時有 5%～30% 機率（知名度越低越高）由本城一二階官員來查貨。
 *  - 旬報關閉後以來訪視窗（07s_face_events.js）讓玩家選：賄賂（增加好感並算「認識」）或公事公辦（小額罰銀）。
 *  - 這個選擇不扣行動點數；沒選就關掉旬報，下一旬自動按公事公辦處理。
 * ===================================================================== */

/** 查貨機率：知名度 0 → 30%，知名度 100 → 5%。 */
const inspectChance=()=>clamp(ODDS.inspect.base-ODDS.inspect.perFame*(G.fame||0)/ODDS.fame.cap,ODDS.inspect.min,ODDS.inspect.max);
/** 賄賂金額（現款）：官階 1 → 30、官階 2 → 60。 */
const inspectBribe=rk=>costOf('inspectBribe',rk);

/** 推進一旬時呼叫：先結算上一次沒處理的查貨，再擲新的查貨。 */
function inspectTick(log){
  if(G.inspect){inspectResolve(false,log)}
  if(!chance(inspectChance()))return;
  const offs=officialsOf(G.cityId).filter(n=>n.pos&&n.pos.rank<=2&&!n.ronin);   // 自己扶持的浪人官員不來查貨
  if(!offs.length)return;
  const n=pick(offs);G.inspect={cid:n.cid,turn:G.turn};queueFaceEvent({type:'inspect',cid:n.cid,turn:G.turn});   // 旬報關閉後以來訪視窗處理
  log.push(NEWS('inspectTick.1',{n:(n.pos?posTitle(n):UT('insp.inspectTick')),n2:nameOf(n.cid)}));
}
/** 結算查貨：bribe＝true 賄賂；false 公事公辦（罰銀、好感微降）。回傳訊息。 */
function inspectResolve(bribe,log){
  const I=G.inspect;if(!I)return '';G.inspect=null;
  const n=npc(I.cid),r=R(I.cid),rk=n&&n.pos?n.pos.rank:1;
  if(bribe){
    const cost=inspectBribe(rk);
    if(!affordAmt('inspectBribe',cost)){G.inspect=I;return shortMsg('inspectBribe',rk)}
    spendAmt('inspectBribe',cost);addHeat(0.5);
    const gain=8+rk*2;setAff(r,clamp(r.aff+gain,0,100));
    const first=!r.bond;
    if(first){r.bond={mult:0.6,label:UT('insp.inspectResolve'),introId:null};r.met=true;r.seen=true;if(!r.fameGot){r.fameGot=true;addFame(0.8*rk,'mid')}}
    addKnown(I.cid);logRel(I.cid,UT('insp.inspectResolve.2',{a:cost,b:gain}));
    return UT('insp.inspectResolve.4',{a:cost,b:gain,c:first?UT('insp.inspectResolve.3',{a:nameOf(I.cid)}):''});   // 只有第一次結識才提
  }
  const fine=Math.round(10*rk*(1+rnd()));G.silver-=fine;
  setAff(r,clamp(r.aff-2,0,100));logRel(I.cid,UT('insp.inspectResolve.5',{a:fine}));
  const t=NEWS('inspectResolve.1',{fine});if(log)log.push(NEWS('inspectResolve.2',{t}));return t;
}
/** 旬報下方的查貨選項卡。 */
ACT.inspBribe=()=>{const t=inspectResolve(true);toast(t);if(!G.inspect){UI.hideInfo();sfx.coin();UI.render()}};
ACT.inspPass=()=>{const t=inspectResolve(false);toast(t);UI.hideInfo();UI.render()};

/* ═════ [07e_encounter] ═════ */
/* =====================================================================
 * 07e_encounter.js — 路遇急難
 *  - 「出門前往」沒遇襲時，有 10% 機率路上遇到一個人向你求助 50 兩救急。
 *  - 抽人：官階 1～2（含非官員）佔 50%，官階越高機率越低；認識／不認識各 50%。
 *  - 給錢：不認識者變成認識、好感 10；認識者好感 +10。不給：什麼都不發生。
 *  - 不扣行動點數；金額由現款支付。
 * ===================================================================== */

/** 路遇機率。 */
const ENC_CHANCE=ODDS.encounter.p;
/** 救急金額（現款）。 */
const ENC_COST=costOf('encounter');
/** 官階分組權重：官階 ≤2（含非官員）50%，3 階 22%，4 階 14%，5 階 9%，6 階 5%。 */
const ENC_TIER_W={1:50,3:22,4:14,5:9,6:5};
/** 目前等待玩家回應的路遇：{cid,cont}。 */
var ENC=null;

/** 人物的路遇官階分組（非官員、官階 1～2 皆為 1）。 */
function encTier(n){const rk=n.pos?n.pos.rank:1;return rk<=2?1:rk}
/** 擲路遇：只從此刻在本城的人裡抽，回傳 {cid} 或 null。 */
function rollEncounter(){
  if(G.encounterTurn===G.turn)return null;                 // 同一旬至多遇到一次急難救助
  if(!chance(ENC_CHANCE))return null;
  const all=cityNpcs(G.cityId).filter(n=>!n.hired&&!(G.emps||[]).some(e=>e.cid===n.cid)&&!awayNow(n)&&!jailed(n)&&!(n.pos&&n.pos.court==='region'));   // 只有此刻在本城的人（含名伶；不含巡迴在外的高官、在牢裡的私梟、地區官員）
  if(!all.length)return null;
  const wantKnown=chance(ODDS.encounter.known);
  let pool=all.filter(n=>!!R(n.cid).bond===wantKnown);
  if(!pool.length)pool=all;
  // 先依官階分組權重抽組，再於組內隨機
  const groups={};pool.forEach(n=>{(groups[encTier(n)]=groups[encTier(n)]||[]).push(n)});
  const ks=Object.keys(groups);let tot=ks.reduce((a,k)=>a+(ENC_TIER_W[k]||5),0),r=rnd()*tot,g=ks[0];
  for(const k of ks){r-=ENC_TIER_W[k]||5;if(r<=0){g=k;break}}
  G.encounterTurn=G.turn;
  return {cid:pick(groups[g]).cid};
}
/** 急難的原因（純氛圍）。 */
const ENC_WHY=Ls('enc.why');                                   // 台詞在 01d_lines.js
/** 顯示路遇彈窗；cont 為處理完後繼續出門的動作。 */
function showEncounter(enc,cont){
  ENC={cid:enc.cid,cont};
  const n=npc(enc.cid),c=CH(enc.cid),r=R(enc.cid),known=!!r.bond;
  const role=n.pos?posTitle(n):(ROLE_LABEL[n.role]||'');
  const h='<div class="card warn" style="display:flow-root">'+portraitHtml(enc.cid,56)+'<div><b style="font-size:17px">'+esc(c.name)+'</b> <span class="tag gray">'+esc(role)+'</span> '+(known?UT('enc.h'):UT('enc.h.2'))+'</div>'
   +'<div class="small" style="margin:6px 0">'+esc(TX('enc.ask',{why:ENC_WHY[Math.floor(rnd()*ENC_WHY.length)],cost:ENC_COST}))+'</div>'
   +'<div class="grid2"><button class="pixel-btn btn-gold btn-sm" data-act="encGive">'+UT('btn.encGive',{c:costBtn('encounter')})+'</button><button class="pixel-btn btn-sm" data-act="encNo">'+UT('btn.encNo')+'</button></div></div>';
  UI.showInfo(UT('enc.showEncounter'),h);
}
/** 結束路遇並繼續出門。 */
function encFinish(){const e=ENC;ENC=null;UI.hideInfo();if(e&&e.cont)e.cont()}
ACT.encGive=()=>{
  if(!ENC)return;
  if(!afford('encounter')){toast(MSG('encGive.noMoney',{short:shortMsg('encounter')}));return}
  const cid=ENC.cid,r=R(cid),n=npc(cid);
  spend('encounter');
  if(!r.bond){
    r.bond={mult:0.6,label:UT('enc.encGive'),introId:null};r.met=true;r.seen=true;addKnown(cid);
    setAff(r,Math.max(r.aff,10));
    if(!r.fameGot){r.fameGot=true;addFame(n&&n.pos?0.5*n.pos.rank:0.4)}
    toast(MSG('encGive.1',{cid:nameOf(cid)}));
  }else{
    setAff(r,clamp(r.aff+10,0,100));toast(MSG('encGive.2',{cid:nameOf(cid)}));
  }
  logRel(cid,UT('enc.encGive.2',{a:ENC_COST}));addFame(0.2);sfx.coin();
  UI.render();encFinish();
};
ACT.encNo=()=>{if(ENC)encFinish()};
/* 直接按「關閉」等同不理會，仍繼續出門 */
(function(){const h=UI.hideInfo;UI.hideInfo=function(){h();if(ENC){const e=ENC;ENC=null;if(e.cont)e.cont()}}})();

/* ═════ [07f_enemy] ═════ */
/* =====================================================================
 * 07f_enemy.js — 仇人
 *  - 每個人記錄「曾經最高好感度」r.peak。
 *  - 仇人 ＝ 曾經最高好感度 − 目前好感度 ≥ 40（例：曾經 40、現在 0）。
 *  - 每位在世的仇人：出門遇襲機率 +3%、倉庫失火機率 +2%、盜賊上門機率 +2%。
 *  - peak 只會升不會降；好感變動散在各處，所以在每次重繪與推進一旬時統一同步。
 *  - 淡忘：成仇滿 36 旬（期間好感一次再掉 5 以上就重新起算），peak 重設為目前好感，不再是仇人；好感本身不變。
 *    軟肋是 grudge（心胸狹隘睚眥必報）的人不會淡忘（畫面不提示，讓玩家自己發現）。
 * ===================================================================== */

/** 仇人門檻：最高好感與目前好感的落差達到此值（含）。 */
const ENEMY_GAP=40;
/** 仇人自然淡忘的旬數。 */
const ENEMY_FADE=36;
/** 辭退員工扣的好感。 */
const FIRE_AFF=40;
/** 每位仇人增加的機率：遇襲、失火、盜賊。 */
const ENEMY_AMBUSH=ODDS.ambush.perEnemy,ENEMY_FIRE=ODDS.enemyFire.p,ENEMY_THIEF=ODDS.enemyThief.p;

/** 同步所有人物的「曾經最高好感度」（舊存檔從目前好感起算）。 */
function syncPeaks(){
  if(!G||!G.rel)return;
  Object.values(G.rel).forEach(r=>{if(r.lockAff)r.aff=100;if(r.peak===undefined||r.aff>r.peak)r.peak=r.aff});   // 生死之交的好感鎖在 100（保險：萬一有漏網的改法）
  Object.keys(G.rel).forEach(cid=>{                // 記下成仇（或再被得罪）的那一旬，供淡忘計時
    const r=G.rel[cid];
    if(isEnemy(cid)){if(r.enemyT===undefined||r.aff<=r.enemyAff-5)r.enemyT=G.turn;r.enemyAff=r.aff}   // 一次掉 5 以上才算再被得罪（名伶久未點召的 −4 疏遠不算）
    else if(r.enemyT!==undefined){delete r.enemyT;delete r.enemyAff}
  });
  introResign();
}
/** 介紹人成了仇人：自動請辭，改由系統另選。 */
function introResign(){
  if(!G.intros||!G.intros.length)return;
  const gone=G.intros.filter(i=>isEnemy(i.cid));if(!gone.length)return;
  G.intros=G.intros.filter(i=>!gone.includes(i));
  gone.forEach(i=>{const t=NEWS('enemy.introQuit',{a:nameOf(i.cid)});pushNews(t);logRel(i.cid,UT('enemy.introResign'));try{toast(t,4200)}catch(e){}});
  autoIntro(null);
}
/** 某人是否為仇人（在世且已有往來）。 */
function isEnemy(cid){
  const r=G.rel[cid];if(!r||r.lockAff||!r.bond||!CH(cid)||!alive(cid))return false;
  return (r.peak!==undefined?r.peak:r.aff)-r.aff>=ENEMY_GAP;
}
/** 目前仇人名單。 */
function enemies(){syncPeaks();return Object.keys(G.rel).filter(isEnemy)}
/** 仇人數量。 */
const enemyCount=()=>enemies().length;
/** 每旬：仇人額外引來盜賊（每位 +2%）；失火與遇襲機率在各自函式中加成。 */
function enemyTick(log){
  syncPeaks();
  Object.keys(G.rel).forEach(cid=>{                // 成仇滿 36 旬：怨氣淡去（睚眥必報者除外）
    const r=G.rel[cid];if(r.enemyT===undefined||G.turn-r.enemyT<ENEMY_FADE||!isEnemy(cid))return;
    if(CH(cid).weakness==='grudge')return;
    r.peak=r.aff;delete r.enemyT;delete r.enemyAff;
    const m=NEWS('enemy.fade',{name:nameOf(cid)});pushNews(m);log.push(m);logRel(cid,UT('enemy.enemyTick'));
  });
  const n=enemyCount();if(!n||!chance(ENEMY_THIEF*n))return;
  const t=thieves();if(t){const m=NEWS('enemyTick.1',{replace:t.replace(NEWS_FMT.tagEnd,'')});pushNews(m);log.push(m)}
}
