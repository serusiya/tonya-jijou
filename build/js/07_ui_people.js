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
  const opts=G.intros.map(i=>'<option value="'+i.cid+'" '+(i.cid===G.introId?'selected':'')+'>'+esc(nameOf(i.cid))+'（交情 '+Math.round(R(i.cid).aff)+'）</option>').join('');
  return '<div class="row small" style="margin-bottom:6px"><b>'+UT('opt.introLabel')+'</b><select data-chg="setIntro">'+(opts||'<option>'+UT('opt.noIntro')+'</option>')+'</select></div>';
}

/** 禮物下拉選項（含『不送禮』與命中軟肋的標記）。 */
function giftOptions(cid){
  const r=R(cid),c=CH(cid);
  return '<option value="none">'+UT('opt.noGift')+'</option>'+GIFTS.map(g=>{const cost=giftCost(g,cid);const ct=fmt(cost.silver)+' 兩銀';const star=(r.verified&&c.weakness===g.weak)?' ⭐':'';return '<option value="'+g.k+'">'+g.icon+' '+g.name+'（'+ct+'）'+star+'</option>'}).join('');
}
/** 人物未兌現承諾的顯示與兌現按鈕。 */
function promiseLines(cid){
  const r=R(cid);
  return r.promises.map((p,i)=>p.done?'':'<div class="card warn tiny" style="margin:3px 0"><div class="row"><span>⏰ '+esc(p.text)+'<br>期限：第 '+(p.due)+' 旬'+(G.turn>p.due?'（<b style="color:#b3261e">已逾期</b>）':'（剩 '+(p.due-G.turn)+' 旬）')+'</span><button class="pixel-btn btn-sm btn-gold" data-act="pay" data-cid="'+cid+'" data-i="'+i+'">'+UT('btn.pay')+'</button></div></div>').join('');
}
/** 【人物卡】未結識→請引薦/毛遂自薦；已結識→備禮拜訪表單（禮物＋請託＋什麼都不說）、承諾、請當介紹人。ctx 表示出現的處所。 */
function personBlock(cid,ctx){
  if(npc(cid)&&npc(cid).role==='oiran')return oiranBlock(cid,ctx);
  const c=CH(cid),n=npc(cid),r=R(cid),isOff=n&&n.pos;autoIntro(cid);
  /* 知名度不足（含介紹人 +1 階）而見不到的人：半透明、不可點選 */
  const lockNeed=meetTierNeed(cid),locked=!r.bond&&lockNeed>fameTier()+((G.introId&&introOf(G.introId))?1:0);
  let h='<div class="card'+(locked?' locked':'')+'" data-cid="'+cid+'">'+portraitHtml(cid,56)+(locked?'<div class="tiny" style="color:#b3261e">🔒 需知名度 '+TIER_NAME[lockNeed]+'（你 '+TIER_NAME[fameTier()]+'）</div>':'')+'<div class="row"><div><b>'+esc(c.name)+'</b>'+(c.gender==='女'?' <span class="tag" style="background:#f6d5e1;color:#a2315f">♀ 女</span>':'')+' '+(isEnemy(c.id)?'<span class="tag red">⚔️ 仇人</span>':'')+'<span class="tag gray">'+(ROLE_LABEL[n?n.role:roleOf(c)]||'')+'</span>'+(empRole(cid)?'<span class="tag red">'+empRole(cid)+'</span>':'');
  if(isOff)h+='<span class="tag '+COURTS[n.pos.court].cls+'">'+COURTS[n.pos.court].name+'</span><span class="tag clk" data-act="posInfo" data-id="'+n.pos.posId+'">'+esc(posTitle(n))+' ⓘ</span><span class="tag gold">'+esc(rankLabel(n).split(/[\u30FB\u00B7]/)[0])+'</span>';
  h+='</div><span class="tiny muted">'+ageOf(cid)+' 歲</span></div>';
  h+='<div class="tiny muted" style="margin:2px 0">'+esc(c.family_summary.slice(0,46))+'……</div>';
  if(!r.bond){
    h+='<div class="tiny muted">尚未結識。經介紹人引薦，才有良好的開端。</div>';
    const pv=G.introId?introPreview(G.introId,cid):null;
    const pt=!pv?'尚無介紹人：貿然登門，容易被擋在門外。':pv.known?'性向判定：<b>'+pv.cp.label+'</b>（共通：'+(pv.cp.shared.join('、')||'無')+'）':'性向未知，需先探聽。';
    h+='<div class="notice tiny" style="margin:4px 0">'+pt+'</div>';
    const via=!!(G.introId&&introOf(G.introId));
    h+='<div class="row" style="justify-content:flex-start;gap:4px;flex-wrap:wrap"><button class="pixel-btn btn-sm btn-gold" data-act="meet" data-cid="'+cid+'">'+(via?'請引薦·帶禮登門（禮金 '+introFee(cid)+' 兩·交情 -2～5）':'毛遂自薦·登門投帖（備禮 '+costTxt('selfIntro')+'）')+'</button>'+(r.topKnown?'':'<button class="pixel-btn btn-sm" data-act="scout" data-cid="'+cid+'">'+UT('btn.scoutFull',{c:scoutCost(cid)})+'</button>')+'</div>';
  }else if(isEnemy(cid)){
    h+='<div class="notice tiny" style="margin:4px 0;border-color:#c0584f;background:#fde8e4">⚔️ 這人視你為仇人，拒不見面，也不收你的禮。曾經交情最高到 '+Math.round(r.peak||0)+'，如今只剩 '+Math.round(r.aff)+'。</div>';
  }else{
    h+='<div class="row small"><span>態度：<span class="tag '+affCls(r.aff)+'">'+affWord(r.aff)+'</span> <span class="tag">'+esc(r.bond.label)+'</span></span><div style="width:90px">'+bar(r.aff,100,'gold')+'</div></div>';
    if(r.topKnown){const pv=G.introId?introPower(G.introId,cid):null;h+='<div class="tiny" style="margin:2px 0">性向偏重：<b>'+top3(cid).join('、')+'</b>'+(pv?'　與介紹人：<span class="tag '+pv.cp.cls+'">'+pv.cp.label+'</span>':'')+'</div>'}
    else h+='<div class="tiny muted" style="margin:2px 0">性向未明 <button class="pixel-btn btn-sm" data-act="scout" data-cid="'+cid+'">'+UT('btn.scout',{c:scoutCost(cid)})+'</button></div>';
    if(r.verified)h+='<div class="tiny" style="color:#9b2c3a;margin:2px 0">🤫 軟肋：<b>'+esc(c.weakness)+'</b></div>';
    else h+='<div class="tiny muted" style="margin:2px 0">🤫 軟肋未明</div>';
    h+='<div class="small bold" style="margin-top:5px">🎁 備禮拜訪</div>';
    h+='<div class="row" style="gap:4px;margin-top:2px"><span class="tiny">禮物</span><select class="gift-sel" style="flex:1;font-size:11px">'+giftOptions(cid)+'</select></div>';
    if(isOff){
      const fl=favorList(cid);
      h+='<div class="row" style="gap:4px;margin-top:3px"><span class="tiny">請託</span><select class="favor-sel" style="flex:1;font-size:11px"><option value="none">'+UT('opt.noFavor')+'</option>'+fl.map(f=>{
        const g=f.cost.gold?favorGoldCost(f,n):0,sv=f.cost.silver||0;
        const ct=f.apply?'規費 '+fmt(appFee(g))+' 兩':([g+sv?fmt(g+sv)+' 兩銀':''].filter(Boolean).join('＋')||'免費');
        return '<option value="'+f.k+'">'+f.name+'（'+ct+(n.pos.rank<f.rank?UT('opt.rankShort'):'')+'）</option>';
      }).join('')+'</select></div>';
      if(fl.some(f=>f.apply))h+='<div class="row" style="gap:4px;margin-top:3px"><span class="tiny">賄賂</span><select class="bribe-sel" style="flex:1;font-size:11px"><option value="0">'+UT('opt.bribe0')+'</option><option value="1">'+UT('opt.bribe1')+'</option><option value="1.5">'+UT('opt.bribe15')+'</option><option value="2">'+UT('opt.bribe2')+'</option></select></div><div class="tiny muted">申請要繳規費（不退），可另附賄賂。有人愛錢，有人最恨收賄。</div>';
      h+='<div class="tiny muted" style="margin-top:2px">好感夠高才肯辦，普通擱置，太低拒絕。先送禮，再開口。</div>';
    }
    h+='<div style="margin-top:4px;display:flex;gap:4px"><button class="pixel-btn btn-sm btn-gold" style="flex:2" data-act="visit" data-cid="'+cid+'">'+UT('btn.visit')+'</button>'+errandBtn(cid)+'</div>';
    h+=promiseLines(cid);if(typeof schemeHtml==='function')h+=schemeHtml(cid);if(typeof tributeHtml==='function')h+=tributeHtml(cid);
    const ithr=G.intros.length?55:40,canIntro=canBeIntro(cid);if(ctx==='res'&&canIntro&&r.aff>=ithr&&!introOf(cid)&&G.intros.length<4)h+='<div style="margin-top:5px"><button class="pixel-btn btn-sm btn-green" data-act="makeIntro" data-cid="'+cid+'">'+UT('btn.makeIntro')+'</button></div>';else if(ctx==='res'&&canIntro&&!introOf(cid)&&G.intros.length<4)h+='<div class="tiny muted" style="margin-top:4px">好感達 '+ithr+' 以上，才能請他當介紹人。</div>';
  }
  return h+'</div>';
}
/** 統一顯示結果訊息、重繪。 */
function rr(r){toast(r.msg,Math.max(3200,r.msg.length*120));if(r.ok===false)sfx.bad();UI.render();refreshSheet()}
/** 請引薦/自薦登門：扣行動點數→擲 visitRoll→播拜訪動畫→結算。 */
ACT.meet=el=>{
  autoIntro(el.dataset.cid);
  if(isEnemy(el.dataset.cid)){toast(MSG('meet.1'));return}
  const cid=el.dataset.cid,via=!!(G.introId&&introOf(G.introId));
  const err=meetCheck(cid,via);if(err){toast(err);return}
  if(!spendVisitAP())return;
  const roll=visitRoll(cid);
  visitFx({cid,outcome:roll.outcome,kind:'meet',prop:'letter'},()=>{
    const a0=R(cid).aff;
    const r=via?meetVia(cid,G.introId,roll):meetCold(cid,roll);errandTrim(cid,a0,r);
    if(r.ok)say(r.cp&&r.cp.label==='一見如故'?TX('protag.meetGood'):r.backlash?TX('protag.meetBad'):TX('protag.meetOk'));
    rr(r);
  });
};
/** 備禮拜訪：檢查資源→扣行動點數→擲結果→動畫→resolveVisit。 */
ACT.visit=el=>{
  autoIntro(el.dataset.cid);
  if(isEnemy(el.dataset.cid)){toast(MSG('visit.1'));return}
  const cid=el.dataset.cid,card=el.closest('.card');
  const gift=card.querySelector('.gift-sel').value,fv=card.querySelector('.favor-sel'),favor=fv?fv.value:'none';
  const bs=card.querySelector('.bribe-sel');BRIBE_X=bs?+bs.value:0;
  if(gift!=='none'){const g=GIFT_MAP[gift],cost=giftCost(g,cid);
        if(cost.silver&&G.silver<cost.silver){toast(MSG('buyGoods.5',{cost:fmt(cost.silver)}));return}}
  ERR_REQ=el.dataset.err==='1';
  if(!spendVisitAP())return;
  const roll=visitRoll(cid);
  const kind=favor!=='none'||BRIBE_X>0?'favor':gift!=='none'?'gift':'meet',prop=gift!=='none'?gift:(BRIBE_X>0?'gold':favor!=='none'?'petition':'letter');
  visitFx({cid,outcome:roll.outcome,kind,prop,actor:ERR_ACTIVE?'apprentice':'player'},()=>{
    const a0=R(cid).aff;
    const r=resolveVisit(cid,gift,favor,roll);errandTrim(cid,a0,r);
    if(r.ok&&gift!=='none')coinFx();
    rr(r);
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
  visitFx({cid,outcome:'ok',kind:'meet',prop:'letter'},()=>{G.intros.push({cid});G.introId=G.introId&&introOf(G.introId)?G.introId:cid;logRel(cid,'成為你的介紹人。');say(TX('protag.newIntro'));rr({ok:true,msg:MSG('makeIntro.2',{cid:nameOf(cid)})})});
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
const GO_INFO={yamen:['前往町奉行所……','三院府衙'],flower:['夜幕低垂，前往吉原花街……','名樓雅閣'],guild:['前往問屋公會會所……','株仲間'],residences:['投帖前往名門商邸……','豪族寓所'],warehouse:['前往河岸碼頭……','問屋大倉庫'],regional:['前往遠國奉行所……','地區官府']};
/** 公會例會間隔：三個月＝9 旬。 */
const GUILD_GAP=9;   // 三個月＝九旬
/** 前往處所：公會有進場間隔限制；只要求還有行動點數，真正扣點在面板內的實際行動。 */
ACT.go=el=>{const k=el.dataset.go,i=GO_INFO[k];
  if(k==='guild'&&G.turn-(G.guildAt===undefined?-99:G.guildAt)<GUILD_GAP){toast(MSG('go.1',{guildAt:(GUILD_GAP-(G.turn-G.guildAt))}));return}
  if(apLeft()<=0){toast(MSG('go.2'));return}
  if(injuredBlock())return;                     // 養傷中不能出門
  const amb=rollAmbush();                         // 出門遇襲判定（0.5～3%）
  if(amb&&amb.abort){return}
  const enc=amb?null:rollEncounter();             // 沒遇襲時，10% 路遇有人急難求助
  if(enc){showEncounter(enc,()=>goTo(k));return}
  goTo(k)};
/** 真正出門：公會登記開會時間，播走路動畫後開啟面板。 */
function goTo(k){const i=GO_INFO[k];
  if(k==='guild'){G.guildAt=G.turn;G.cartel.tried=false;G.cartel.paid=false}playFx('walk',i[0],i[1],()=>UI.openSheet(k),900)}

/** 町奉行所面板：三院官員（人物卡）。 */
SHEETS.yamen=()=>{
  const offs=officialsOf(G.cityId);
  let h=introSel()+appsCard()+'<div class="notice tiny">奉行所分行政、財務、司法三院。第一次拜謁官員要靠介紹人引薦；送禮要投其所好，請託要好感夠高。<br>查帳風聲：'+(G.heat>6?'<b style="color:#b3261e">很緊</b>':G.heat>3?'<b style="color:#c18a00">偏緊</b>':'平靜')+'</div>';
  return {title:'🏛️ 町奉行所·三院府衙（'+homeCity().name+'）',html:h+'<div style="margin:4px 0"><button class="pixel-btn btn-sm" data-act="posList">'+UT('btn.posList')+'</button></div>'+(offs.map(n=>personBlock(n.cid,'yamen')).join('')||'<div class="notice">此城官署暫無人在值。</div>')};
};
/** 公會面板：配額、提案、表態。 */
SHEETS.guild=()=>{
  const C=G.cartel,own=ownComms();
  const st=C.state==='pledged'?'<span class="tag green">已表態遵守配額</span>':C.state==='secret'?'<span class="tag red">已簽暗約偷跑</span>':'<span class="tag gray">未表態</span>';
  let h='<div class="notice tiny">全城取得「'+SYS_BY_KEY[G.sysKey].name+'」株牌的十四家問屋圍坐一堂。公會核心是<b>以量控價</b>：全體減供價才高；有人偷跑，價就崩（囚徒困境）。誓言守配額卻超量，會被聯合斷貨；暗約偷跑若敗露，則遭官府查抄。</div>';
  h+='<div class="card"><div class="row"><b>目前立場</b>'+st+'</div><div class="row small" style="margin-top:4px"><span>配額遵守率</span><b>'+Math.round(C.comp)+'%</b></div>'+bar(C.comp,100,C.comp<50?'red':'gold')+(C.sanction>0?'<div class="tiny" style="color:#b3261e;margin-top:3px">⚠️ 聯合斷貨中，剩 '+C.sanction+' 旬，進貨價大漲</div>':'')+'</div>';
  h+='<div class="card"><b class="small">本旬配額（每項本城需求的 '+Math.round(C.quotaPct*100)+'%）</b>'+own.map(c=>'<div class="row tiny" style="margin-top:2px"><span>'+esc(c.short)+'</span><b>'+quotaOf(c.name)+' 單位／旬</b></div>').join('')+'</div>';
  const qp=quotaRaiseChance();
  h+='<div class="card"><b class="small">📈 提案提高配額</b><div class="tiny muted" style="margin:2px 0">每次例會可提案一次，最多增加 10%。成敗看你與同行商人的交情。目前成功率 <b>'+Math.round(qp*100)+'%</b>。</div><button class="pixel-btn btn-sm btn-gold" data-act="quotaUp" '+(C.tried?'disabled':'')+'>'+UT(C.tried?'btn.quotaDone':'btn.quotaUp')+'</button></div>';
  h+='<div class="grid2"><button class="pixel-btn btn-green" data-act="cartel" data-s="pledged">'+UT('btn.cartel')+'</button><button class="pixel-btn btn-red" data-act="cartel" data-s="secret">'+UT('btn.cartel2')+'</button></div><div style="margin-top:6px"><button class="pixel-btn btn-sm" data-act="cartel" data-s="none" style="width:100%">'+UT('btn.cartel3')+'</button></div>';
  const rv=cityNpcs(G.cityId,'rival');
  h+='<div class="small bold" style="margin:8px 0 2px">會中同行</div>'+(rv.slice(0,6).map(n=>'<div class="tiny">• '+esc(nameOf(n.cid))+'（'+ageOf(n.cid)+'歲）'+(R(n.cid).bond?'　交情：'+affWord(R(n.cid).aff):'')+'</div>').join('')||'<div class="tiny muted">今日無人出席。</div>');
  return {title:'⚖️ 問屋公會·株仲間會所',html:h};
};
/** 配額提案成功率：30%＋前三名同行交情平均×0.5（最高 80%）。 */
function quotaRaiseChance(){
  const rv=cityNpcs(G.cityId,'rival').map(n=>R(n.cid)).filter(r=>r.bond).map(r=>r.aff).sort((a,b)=>b-a).slice(0,3);
  const avg=rv.length?rv.reduce((a,b)=>a+b,0)/rv.length:0;
  return clamp(ODDS.cartelRaise.base+ODDS.cartelRaise.perAff*avg/100,ODDS.cartelRaise.base,ODDS.cartelRaise.max);
}
/** 提案增加配額 10%（每次例會一次；第一次動作才扣行動點數）。 */
ACT.quotaUp=()=>{
  const C=G.cartel;if(C.tried){toast(MSG('quotaUp.1'));return}
  if(!C.paid){if(!spendAP())return;C.paid=true}
  C.tried=true;const p=quotaRaiseChance();
  if(rnd()<p){C.quotaPct=Math.min(0.5,Math.round(C.quotaPct*1.1*10000)/10000);sfx.fanfare();toast(MSG('quotaUp.2',{quotaPct:(C.quotaPct*100).toFixed(1)}))}
  else{sfx.bad();toast(TX('guild.rejected'))}
  UI.render();refreshSheet();
};
/** 公會表態（遵守/暗約/退出）。 */
ACT.cartel=el=>{
  const s=el.dataset.s,C=G.cartel;
  if(s==='secret'&&C.state!=='secret'){if(!afford('guildSecret')){toast(shortMsg('guildSecret'));return}}
  if(!C.paid){if(!spendAP())return;C.paid=true}
  if(s==='secret'&&C.state!=='secret')spend('guildSecret');
  C.state=s;
  if(s==='pledged'){C.comp=Math.min(90,C.comp+3);toast(MSG('cartel.1'))}
  else if(s==='secret')toast(MSG('cartel.2'));
  else toast(MSG('cartel.3'));
  UI.render();refreshSheet();
};
/** 名門商邸面板。 */
SHEETS.residences=()=>{
  const list=resident().sort((a,b)=>R(b.cid).aff-R(a.cid).aff);
  return {title:'🏯 名門商邸·拜會名士',html:introSel()+'<div class="notice tiny">前往同行巨賈與名士寓所投名帖。經介紹人引薦後可送禮、結交；交情夠深的人，可以請他當你的介紹人。</div>'+(list.map(n=>personBlock(n.cid,'res')).join('')||'<div class="notice">城中暫無可訪之人。</div>')};
};
/** 碼頭倉庫面板。 */
SHEETS.warehouse=()=>{
  let h='<div class="grid3 small" style="text-align:center"><div class="card" style="margin:0">倉庫<br><b>'+G.wh.n+' 棟</b></div><div class="card" style="margin:0">容量<br><b>'+invUsed()+' / '+invCap()+'</b></div><div class="card" style="margin:0">保鏢<br><b>'+guardCount()+' 名</b></div></div>';
  h+='<div class="card" style="margin-top:6px"><b class="small">庫存</b>'+(Object.keys(G.inv).filter(k=>G.inv[k]>0).map(k=>'<div class="row tiny" style="margin-top:2px"><span>'+esc(COMM_MAP[k].short)+(COMM_MAP[k].flam?' <span class="tag red">易燃</span>':'')+'</span><b>'+G.inv[k]+'</b></div>').join('')||'<div class="tiny muted">空空如也</div>')+(G.lastSpoil?'<div class="tiny muted" style="margin-top:3px">'+esc(G.lastSpoil)+'</div>':'')+'<div class="tiny muted" style="margin-top:3px">庫存貨值約 '+fmt(Math.round(Object.keys(G.inv).reduce((a,k)=>a+(G.inv[k]||0)*listValue(k),0)))+' 兩·上旬倉儲保險費 '+fmt(G.holdFee||0)+' 兩（貨值越高，費用與失竊風險越大）</div></div>';
  h+=xgoodsCard();
  h+='<div class="notice tiny">🛡️ 倉庫由<b>保鏢</b>平時巡守（降低失火與盜賊風險），你出門時他們隨行護身。到「商號」頁聘用保鏢。</div>';
  const wc=1500*G.wh.n;
  h+='<div class="card"><div class="row"><div><b class="small">🏚️ 增建倉庫</b><div class="tiny muted">每棟 +'+G.wh.cap+' 容量·每旬維持費 6 兩</div></div><button class="pixel-btn btn-sm btn-gold" data-act="whUp" '+(G.wh.n>=6?'disabled':'')+'>'+(G.wh.n>=6?UT('btn.whMax'):UT('btn.whUp',{c:fmt(wc)}))+'</button></div></div>';
  h+='<div class="card"><div class="row"><div><b class="small">🍚 開倉施粥賑濟</b><div class="tiny muted">花 '+costTxt('charity')+' 施粥；值凶年（米麥行情高漲）時，聲望收穫更大。</div></div><button class="pixel-btn btn-sm btn-green" data-act="charity">'+UT('btn.charity')+'</button></div></div>';
  return {title:'⛵ 河岸碼頭與問屋大倉庫',html:h};
};
/** 增建倉庫。 */
ACT.whUp=()=>{if(!afford('whUp',G.wh.n)){toast(shortMsg('whUp',G.wh.n));return}spend('whUp',G.wh.n);G.wh.n++;sfx.fanfare();toast(MSG('whUp.1',{invCap:invCap()}));UI.render();refreshSheet()};
/** 開倉施粥（知名度）。 */
ACT.charity=()=>{
  if(!afford('charity')){toast(shortMsg('charity'));return}
  const famine=Object.values(G.mk).some((m,i)=>m.ev>1.3&&Object.keys(G.mk)[i].match(/白米|大麥/));
  spend('charity');G.life.charity++;addFame(1.5);
  const t=NEWS('charity.1',{name:G.me.name,homeCity:homeCity().name});pushNews(t);
  sfx.fanfare();toast(MSG('charity.1',{famine:(famine?'（值凶年，萬民景仰）':'')}));UI.render();refreshSheet();
};
/** 城市資料面板（人口、節慶、已發生的城史）。 */
SHEETS.city=()=>{
  const c=homeCity(),d=c.demographics;
  let h='<div class="card"><div class="row"><b style="font-size:14px">'+esc(c.name)+'</b><span class="tag navy">'+esc(c.region_name)+'</span></div><div class="tiny muted">'+esc(c.location_type)+'·人口 '+fmt(c.population)+'</div><p class="small" style="margin:4px 0">'+esc(c.geography_description)+'</p>';
  h+='<div class="tiny">男 '+d.gender_ratio.male_pct+'％·女 '+d.gender_ratio.female_pct+'％</div><div class="grid3 tiny" style="margin-top:4px;text-align:center"><div class="card" style="margin:0">豪商 '+d.class_ratio.wealthy_elite_pct+'%</div><div class="card" style="margin:0">中產 '+d.class_ratio.middle_class_pct+'%</div><div class="card" style="margin:0">勞力 '+d.class_ratio.poor_labor_pct+'%</div></div></div>';
  h+='<div class="card"><b class="small">本地連結物產（產地價較便宜）</b><div class="small">'+c.connected_commodities.map(esc).join('、')+'</div></div>';
  h+='<div class="card"><b class="small">城史</b>'+(c.history_100_years.filter(x=>parseInt(x.year,10)<=G.year).map(x=>'<div class="tiny" style="margin-top:3px"><b>'+yearStr(parseInt(x.year,10))+'</b>·'+esc(x.title)+'</div>').join('')||'<div class="tiny muted">——</div>')+'</div>';
  const f=c.special_festival;
  h+='<div class="card"><b class="small">🏮 '+esc(f.name)+'</b> <span class="tag gold">'+esc(f.date)+'</span><div class="tiny">'+esc(f.cultural_lore)+'</div><div class="tiny muted" style="margin-top:2px">'+esc(f.economic_impact)+'</div></div>';
  const s=c.seasonal_annual_rhythms;h+='<div class="card tiny"><b>四季節律</b><br>春：'+esc(s.spring)+'<br>夏：'+esc(s.summer)+'<br>秋：'+esc(s.autumn)+'<br>冬：'+esc(s.winter)+'</div>';
  return {title:'🏙️ 城志·'+c.name,html:h};
};
/** 選單面板（說明、存檔、規則摘要）。 */
SHEETS.menu=()=>{
  let h='<button class="pixel-btn btn-red" style="width:100%" data-act="newLife">'+UT('btn.newLife')+'</button>';
  h+='<div class="notice tiny" style="margin-top:6px">每旬推進時自動存檔於此瀏覽器。</div>';
  h+='<div class="card tiny"><b>📖 遊戲規則摘要</b><br>• <b>公款／私款</b>：白銀是公款（進貨、薪資、賄賂、拜訪）；黃金點心是私款（花街、走私），點「＋」可補充。<br>• <b>知名度</b>：分一～四階，階級越高越能見到高階官員與名伶；有介紹人可再提高一階。<br>• <b>保鏢</b>：出門有機會遇襲；有保鏢能擋災，沒有保鏢會受傷靜養。<br>• <b>無固定目標</b>：沒有勝負，只有一生。<br>• <b>六項隱藏數值</b>：人物數值不顯示，要從言行、風評、帳目推敲。<br>• <b>介紹人</b>：僱人、拜官、說媒都靠介紹人的性向與信任。<br>• <b>行動次數</b>：每旬 5 次，登門辦事各扣 1 次，聘用員工不扣。';
  if(G.legacy.length)h+='<div class="card tiny"><b>🏯 家系</b>'+G.legacy.map(l=>'<div>第 '+l.gen+' 代·'+esc(l.name)+'·'+l.age+' 歲·'+({death:'壽終',bankrupt:'家業傾覆',executed:'伏法處刑'})[l.cause]+'（'+yearStr(l.year)+'）</div>').join('')+'</div>';
  return {title:'☰ 選單',html:h};
};
/** 開關音效。 */
/** 放棄並重開。 */
ACT.newLife=()=>{if(UI.s.sheetLock||confirm('確定放棄目前的人生，重新開局？（此舉不可復原）')){UI.s.sheetLock=false;UI.s.sheet=null;$('#sheet-bd').classList.add('hidden');clearSave();G=null;UI.showStart()}};

/* ======================= 筆記（千人手帳） ======================= */
/** 筆記分類標籤。 */
const NOTE_FILTERS=['all','emp','official','rival','manager','oiran','other'].map(k=>[k,UT('opt.nf_'+k)]);
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
    if(f==='emp')return !q||x.c.name.includes(q)||(empRole(x.id)||'').includes(q);
    if(q&&!(x.c.name.includes(q)||(x.n&&(ROLE_LABEL[x.n.role]||'').includes(q))))return false;
    const role=x.n?x.n.role:roleOf(x.c);
    if(f==='all')return true;if(f==='other')return !['official','rival','manager','oiran'].includes(role);return role===f;
  }).sort((a,b)=>b.r.aff-a.r.aff);
  const overdue=G.known.filter(noteSeen).some(id=>R(id).promises.some(p=>!p.done&&G.turn>p.due));
  let h='<div class="pixel-box" style="padding:8px">'+notesTabsHtml()+'<div class="row" style="border-bottom:1px solid #b5a98f;padding-bottom:5px"><div><b>📜 商人手帳·千人名冊</b><div class="tiny muted">只有親自拜訪、結識過的人才會記進來（員工除外）。人物的真實數值不會顯示，只能靠往來推敲。</div></div><span class="tag gold">已識 '+G.known.filter(id=>CH(id)&&noteSeen(id)).length+' / 本局 '+G.world.sampleSize+'</span></div>';
  h+='<div class="row" style="margin:6px 0;gap:4px"><input id="notes-q" class="note-in" style="margin:0" placeholder="輸入姓名／職務關鍵字……" value="'+esc(UI.s.notesQ)+'"></div>';
  h+='<div>'+NOTE_FILTERS.map(([k,n])=>'<span class="pill '+(f===k?'on':'')+'" data-act="nf" data-k="'+k+'">'+n+'</span>').join('')+'</div>';
  if(overdue)h+='<div class="notice" style="background:#fde8e4;border-color:#c0584f;margin-top:4px">⏰ 你有承諾逾期未兌現（紅字標示），交情正在下滑。</div>';
  const apps=f==='emp'?G.emps.filter(e=>!e.cid&&(!q||e.name.includes(q)||e.rank.includes(q))):[];
  const appH=apps.map(e=>'<div class="card emp-card"><div class="row"><div><b>'+esc(e.name)+'</b> <span class="tag red">'+e.rank+'</span></div><span class="tiny muted">約 '+(G.year-e.age0)+' 歲</span></div><div class="tiny muted" style="margin-top:2px">自幼收養的少年，無名冊記載。月例 '+e.wage+' 兩／旬·任職 '+(G.turn-e.since)+' 旬·評價 '+ratingStars(e.stats)+'</div></div>').join('');
  h+='<div style="margin-top:4px">'+(list.slice(0,40).map(x=>noteCard(x)).join('')+appH||'<div class="notice">'+(f==='emp'?'你還沒有任何員工。請先找介紹人，再到「私宅」請他物色人才。':'沒有符合的人物。親自登門拜訪、結識之後，才會記進手帳。')+'</div>')+'</div></div>';
  $('#view-notes').innerHTML=h;
}
/** 筆記人物卡：出身、往來實錄、外人風評、印象與備註。 */
function noteCard({id,c,n,r}){
  const open=UI.s.openNote===id,dead=c.death_year<G.year,role=n?n.role:roleOf(c);
  const od=r.promises.some(p=>!p.done&&G.turn>p.due);
  let h='<div class="card '+(od?'warn':'')+'" data-act="noteOpen" data-cid="'+id+'" style="cursor:pointer">'+portraitHtml(id,56)+'<div class="row"><div><b>'+esc(c.name)+'</b>'+(c.gender==='女'?' <span class="tag" style="background:#f6d5e1;color:#a2315f">♀ 女</span>':'')+' '+(isEnemy(c.id)?'<span class="tag red">⚔️ 仇人</span>':'')+'<span class="tag gray">'+(ROLE_LABEL[role]||'')+'</span>'+(empRole(id)?'<span class="tag red">'+empRole(id)+'</span>':'')+(n&&n.pos?'<span class="tag navy clk" data-act="posInfo" data-id="'+n.pos.posId+'">'+esc(posTitle(n))+' ⓘ</span>':'')+(dead?'<span class="tag red">已故</span>':'')+'</div><span class="tiny muted">'+(dead?'享年 '+(c.death_year-c.birth_year)+' 歲':ageOf(id)+' 歲')+'</span></div>';
  h+='<div class="row tiny" style="margin-top:2px"><span>'+(r.bond?'態度：<span class="tag '+affCls(r.aff)+'">'+affWord(r.aff)+'</span>':'<span class="muted">聽聞其人，尚未往來</span>')+'</span>'+(od?'<b style="color:#b3261e">⏰ 逾期</b>':'')+'</div>';
  if(!open)return h+'</div>';
  const lv=noteLevel(r);
  h+='<div data-act="none">';
  const em=G.emps.find(x=>x.cid===id);
  if(em)h+='<div class="notice" style="margin-top:5px"><b>任職：'+em.rank+'</b>　月例 '+em.wage+' 兩／旬·任職 '+(G.turn-em.since)+' 旬·評價 '+ratingStars(id)+(em.flag?'<br><b style="color:#b3261e">疑似私吞 '+fmt(em.flag)+' 兩</b>':'')+'<div class="tiny muted">'+(SPECIAL.includes(em.rank)?SPECIAL_DESC[em.rank]:'')+'</div></div>';
  h+='<details class="fold" open><summary>① 出身</summary><div>'+esc(c.family_summary)+'</div></details>';
  h+='<details class="fold"><summary>② 往來實錄（'+r.log.length+'）</summary><div>'+(r.log.slice().reverse().map(l=>'<div style="margin-top:2px">• '+yearStr(l.y)+' '+l.m+'月'+CYCLE_NAMES[l.c-1]+'：'+esc(l.t)+'</div>').join('')||'<span class="muted">尚無往來紀錄。</span>')+promiseLines(id)+'</div></details>';
  const rumors=rumorsOf(id);
  h+='<details class="fold"><summary>③ 外人風評（真假參半·'+rumors.length+'）</summary><div>'+rumors.map(x=>'<div style="margin-top:3px">「'+esc(x.txt)+'」<span class="tag gray">'+x.src+'</span><span class="stars">'+'★'.repeat(Math.round(x.cred*5))+'☆'.repeat(5-Math.round(x.cred*5))+'</span>'+(r.verified&&WEAK_G[c.weakness]===x.txt?' <span class="tag green">已證實</span>':'')+'</div>').join('')+'<div class="muted" style="margin-top:3px">▸ 不同來源說法相同時才較可信；可信度以星數表示。</div></div></details>';
  h+='<details class="fold"><summary>④ 我的印象與備註</summary><div>'+impressions(id,lv)+(r.topKnown?'<div style="margin-top:3px"><b>性向偏重：</b>'+top3(id).join('、')+'</div>':'')+(r.verified?'<div style="margin-top:3px;color:#9b2c3a"><b>軟肋：</b>'+esc(c.weakness)+'</div>':'')+'<textarea class="note-in" rows="2" data-chg="noteText" data-cid="'+id+'" placeholder="自訂備註（例如：答應過他的事、他的喜好）">'+esc(r.note||'')+'</textarea></div></details>';
  if(!dead&&r.bond&&n&&n.cityId===G.cityId)h+='<div style="margin-top:4px" class="tiny muted">可至對應處所（奉行所／商邸／花街）送禮與請託。</div>';
  return h+'</div></div>';
}
/* 主觀印象：由隱藏數值加上雜訊推得，交情越深越準 */
/** 主觀印象：由隱藏數值加雜訊推得，好感越高越準。 */
function impressions(cid,lv){
  const c=CH(cid),st=c.derived_stats,rd=seeded('imp'+cid+lv),out=[];
  if(lv<2)return '<span class="muted">交情尚淺，說不上有什麼印象。</span>';
  const noise=lv>=4?5:lv===3?10:16;
  const T={commerce_skill:['帳目精明，生意上是把好手','生意上似乎不甚精明'],integrity_loyalty:['看來是個守信重諾之人','言語閃爍，似乎靠不太住'],greed_index:['談到錢時眼睛特別亮','對錢財似乎看得很淡'],audacity_courage:['敢闖敢賭，不怕風險','遇事謹慎，常先縮手'],diplomacy_charm:['談吐圓融，場面上遊刃有餘','不善交際，場面常冷'],betrayal_risk:['隱約有不甘居人下的氣息','性情忠厚，不像會背後捅刀']};
  Object.entries(T).forEach(([k,[hi,lo]])=>{const v=st[k]+(rd()-0.5)*2*noise;if(v>=68)out.push(hi);else if(v<=32)out.push(lo)});
  return out.length?out.slice(0,lv>=4?5:2).map(x=>'<div>• '+x+'</div>').join('')+'<div class="muted">▸ 這只是你的主觀印象，不見得準確。</div>':'<span class="muted">此人看不出什麼特別之處。</span>';
}
/** 空操作：用於攔截點擊，避免觸發外層的展開動作。 */
ACT.none=()=>{};
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
  let h='<div class="pixel-box" style="padding:8px"><div class="row" style="border-bottom:1px solid #b5a98f;padding-bottom:5px"><div><b>🏯 私宅內苑·商號與家族</b><div class="tiny muted">介紹人、夥計、家族與傳承。</div></div><span class="tag red">'+esc(G.me.name)+'·第'+G.me.gen+'代</span></div>';
  h+='<div class="grid3 small" style="margin:6px 0;text-align:center"><div class="card" style="margin:0">淨資產<br><b>'+fmt(netWorth())+' 兩</b></div><div class="card" style="margin:0">每旬開銷<br><b>'+fmt(G.lastCost||0)+' 兩</b></div><div class="card" style="margin:0">黑帳風聲<br><b>'+(G.heat>6?'很緊':G.heat>3?'偏緊':'平靜')+'</b></div></div>';
  // 介紹人
  h+='<div class="small bold">🤝 介紹人（關係到僱人、拜官、說媒，所有跟人有關的事）</div>';
  h+=G.intros.map(i=>{const cid=i.cid,r=R(cid),sel=cid===G.introId;return '<div class="card '+(sel?'good':'')+'"><div class="row"><div><b>'+esc(nameOf(cid))+'</b> <div class="tiny muted">志趣：<b>'+top3(cid).join('、')+'</b>·'+ageOf(cid)+' 歲</div></div><div style="text-align:right" class="tiny">'+(r.aff>=75?'信任甚深':r.aff>=55?'信任可靠':r.aff>=35?'信任普通':'信任尚淺')+'</div></div><div style="margin:3px 0">'+bar(r.aff,100,'gold')+'</div><div class="row tiny"><span class="muted">交情 '+Math.round(r.aff)+'·'+affWord(r.aff)+'</span><span>'+'<button class="pixel-btn btn-sm btn-gold" data-act="befriend" data-cid="'+cid+'">'+UT('btn.befriend',{c:costTxt('befriend')})+'</button></span></div></div>'}).join('')||'<div class="card warn"><b>📌 你還沒有介紹人</b><div class="tiny" style="margin:3px 0">一切從這裡開始：到「名門商邸」登門投帖，與人往來、好感達 40 以上，就能請對方當介紹人。有了介紹人，才能物色人才、拜謁官員、說親。</div><button class="pixel-btn btn-sm btn-gold" data-act="go" data-go="residences">'+UT('btn.go')+'</button></div>';
  h+='<div class="notice tiny">💡 <b>找志趣相合的介紹人去引薦對應的人</b>，是這個遊戲最重要的社交套利。</div>';
  // 夥計
  h+='<hr class="sep"><div class="row"><b class="small">👥 商號夥計（丁稚 ➔ 手代 ➔ 番頭 ➔ 大番頭；另有船長、飛腳、保鏢）</b><button class="pixel-btn btn-sm" data-act="apprentice">'+UT('btn.apprentice',{c:costTxt('apprentice')})+'</button></div>';
  h+='<div class="notice tiny">'+RANKS.concat(['保鏢']).map(k=>'• <b>'+k+'</b>　'+DUTY_DESC[k]).join('<br>')+'</div>';
  h+=SPECIAL.filter(k=>k!=='船長').concat(RANKS.slice().reverse()).map(rk=>{
    const ls=G.emps.filter(e=>e.rank===rk);
    return ls.map(e=>{
      const s=statsOfEmp(e);const tag=e.flag?'<span class="tag red">疑似私吞 '+fmt(e.flag)+' 兩</span>':'';
      const idl=G.turn-e.audited>18;
      return '<div class="card '+(e.flag?'warn':'')+'" style="display:flow-root">'+portraitEmp(e,56)+'<div class="row"><div><b>【'+e.rank+'】'+esc(e.name)+'</b> '+tag+'<div class="tiny muted">'+(e.cid?ageOf(e.cid)+'歲·':'少年·')+'月例 '+e.wage+' 兩／旬·任職 '+(G.turn-e.since)+' 旬'+(idl?'·<b style="color:#c18a00">久未查帳</b>':'')+'</div></div><div style="text-align:right" class="tiny">評價 '+ratingStars(e.cid||statsOfEmp(e))+'</div></div>'+empAffHtml(e)+'<div class="row" style="margin-top:3px;justify-content:flex-start;gap:4px;flex-wrap:wrap"><button class="pixel-btn btn-sm" data-act="audit" data-id="'+e.id+'">'+UT('btn.audit',{c:costTxt('audit')})+'</button>'+(e.flag?'<button class="pixel-btn btn-sm btn-red" data-act="punish" data-id="'+e.id+'">'+UT('btn.punish')+'</button>':'')+(e.rank!=='大番頭'&&!SPECIAL.includes(e.rank)?'<button class="pixel-btn btn-sm btn-green" data-act="promote" data-id="'+e.id+'">'+UT('btn.promote')+'</button>':'')+'<button class="pixel-btn btn-sm" data-act="fire" data-id="'+e.id+'">'+UT('btn.fire')+'</button></div></div>';
    }).join('');
  }).join('');
  h+='<div class="card"><div class="row"><div><b class="small">🔎 請介紹人物色人才</b><div class="tiny muted">禮金 '+costTxt('recruitIntro')+'·交情 -2～5。介紹人愈信任你、與人才圈愈投契，聘得到的職階愈高、人選愈可靠。</div></div><button class="pixel-btn btn-sm btn-gold" data-act="recruit">'+UT('btn.recruit')+'</button></div></div>';
  if(G.recruit&&G.recruit.cands.length)h+='<div class="notice tiny">上次物色結果仍有 '+G.recruit.cands.length+' 位人選。<button class="pixel-btn btn-sm" data-act="recruitView">'+UT('btn.recruitView')+'</button></div>';
  // 家族
  h+='<hr class="sep"><b class="small">👪 家族</b>';
  if(!sp)h+='<div class="card"><div class="row"><div><b>尚未成家</b><div class="tiny muted">政商聯姻換身分，同行聯姻化敵為友，町人家庭安穩和睦。須請介紹人說媒。</div></div><button class="pixel-btn btn-sm btn-gold" data-act="marryOpen">'+UT('btn.marryOpen')+'</button></div></div>';
  else h+='<div class="card"><b>夫人：'+esc(sp.name)+'</b><div class="tiny muted">'+({rival:'同行聯姻',official:'政商聯姻',commoner:'町人家庭'})[sp.kind]+'·'+(G.year-sp.birthYear)+' 歲</div></div>';
  h+=(G.family.conc||[]).map(x=>'<div class="card" style="display:flow-root">'+portraitHtml(x.cid,48)+'<b>側室：'+esc(x.name)+'</b><div class="tiny muted">吉原贖身而來·'+ageOf(x.cid)+' 歲·與家人無異，不能生育。每旬家用 8 兩。</div></div>').join('');
  h+=kids.map(k=>{
    const a=kidAge(k);
    return '<div class="card '+(k.prodigal?'warn':'')+'"><div class="row"><div><b>'+(k.gender==='男'?'👦':'👧')+' '+esc(k.name)+'</b>（'+a+' 歲）'+(k.prodigal?'<span class="tag red">敗家子</span>':'')+'<div class="tiny muted">'+(k.revealed?'天賦偏重：<b>'+top3Of(k.stats)[0]+'</b>':'天賦尚未顯露（約 12 歲）')+(k.path?'·歷練：'+PATHS[k.path].name:'')+'</div></div></div>'+(a>=8&&!k.prodigal?'<div style="margin-top:3px">'+Object.entries(PATHS).map(([p,P])=>'<span class="pill '+(k.path===p?'on':'')+'" data-act="kidPath" data-id="'+k.id+'" data-p="'+p+'">'+P.name+'（'+P.cost+'/年）</span>').join('')+'</div>':'')+(k.prodigal?'<div style="margin-top:3px"><button class="pixel-btn btn-sm" data-act="kidPay" data-id="'+k.id+'" data-m="pay">'+UT('btn.kidDebt',{c:costTxt('kidDebt')})+'</button> <button class="pixel-btn btn-sm btn-red" data-act="kidPay" data-id="'+k.id+'" data-m="out">'+UT('btn.kidPay')+'</button></div>':'')+'</div>';
  }).join('');
  // 隱居
  h+='<div class="card" style="background:#fff8eb"><b class="small" style="color:#9b2c3a">👴 退隱交棒（二代視角）</b><p class="tiny" style="margin:3px 0">主角退隱後切換為繼承人，承襲財富、人脈、黑帳、舊怨與老僕。繼承人可為年滿 16 歲的子女，或招贅（收為義子）你的大番頭。</p><button class="pixel-btn btn-red btn-sm" data-act="retire">'+UT('btn.retire')+'</button></div>';
  h+='</div>';
  $('#view-estate').innerHTML=h;
}
/** 切換介紹人。 */

/** 設宴款待，好感 +6。 */
ACT.befriend=el=>{
  const cid=el.dataset.cid;if(isEnemy(cid)){toast(MSG('meet.1'));return}if(!afford('befriend')){toast(shortMsg('befriend'));return}
  if(!spendAP())return;
  visitFx({cid,outcome:'ok',kind:'gift',prop:'wine'},()=>{spend('befriend');const r=R(cid);r.aff=clamp(r.aff+6,0,100);logRel(cid,'設宴款待，好感 +6。');sfx.gift();toast(MSG('befriend.1',{cid:nameOf(cid)}));UI.render()});
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
ACT.audit=el=>{const r=auditEmp(el.dataset.id);toast(r.msg);UI.render()};
/** 追討。 */
ACT.punish=el=>{toast(punishEmp(el.dataset.id));UI.render()};
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
  const rc=G.recruit;if(!rc)return {title:'人才',html:'<div class="notice">尚無人選。</div>'};
  let h='<div class="notice tiny">'+esc(recruitFlavor(nameOf(rc.introId),rc.rank,rc.tf,rc.avg===undefined?1:rc.avg))+'<br>只顯示人物適任且尚有名額的聘用職位；丁稚請使用私宅的「招收丁稚」。評價以星數表示，未必準確。</div>';
  h+=rc.cands.map(cid=>{
    const c=CH(cid);
    const ranks=candidateHireRanks(cid,rc.rank).filter(slotFree);
    const opts=ranks.map(rk=>'<button class="pixel-btn btn-sm" data-act="hire" data-cid="'+cid+'" data-rk="'+rk+'">'+UT('btn.hire',{r:rk})+'</button>').join(' ');
    return '<div class="card" style="display:flow-root">'+portraitHtml(cid,56)+'<div class="row"><div><b>'+esc(c.name)+'</b>'+(c.gender==='女'?' <span class="tag" style="background:#f6d5e1;color:#a2315f">♀ 女</span>':'')+' <span class="tag gray">'+ageOf(cid)+' 歲</span><div class="tiny muted">'+esc(c.family_summary.slice(0,36))+'……</div></div><div class="tiny">評價 '+ratingStars(cid)+'</div></div><div style="margin-top:4px">'+(opts||'<span class="tiny muted">適任職位的名額已滿</span>')+'</div></div>';
  }).join('')||'<div class="notice">人選已聘完。</div>';
  return {title:'🔎 人才名冊',html:h};
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
  const kinds=[['commoner','町人家庭','聘禮 200 兩·安穩，無政治助力'],['rival','同行聯姻','聘禮 400 兩·需與一位同行交情 ≥45：化敵為友，株仲間信任上升'],['official','政商聯姻','聘禮 800 兩·需與一位官員交情 ≥50：官場多一位自己人']];
  let h=introSel().replace('介紹人','媒人（介紹人）')+kinds.map(([k,n,d])=>'<div class="mkt-row '+(ms.kind===k?'on':'')+'" data-act="marryKind" data-k="'+k+'"><div><b>'+n+'</b><div class="tiny muted">'+d+'</div></div></div>').join('');
  let cand=[];
  if(ms.kind==='rival')cand=cityNpcs(G.cityId,'rival').filter(n=>R(n.cid).bond);
  if(ms.kind==='official')cand=officialsOf(G.cityId).filter(n=>R(n.cid).bond);
  if(ms.kind!=='commoner'){
    h+='<div class="small bold" style="margin:6px 0 2px">結親對象（交情夠才可）</div>'+(cand.map(n=>{const ok=R(n.cid).aff>=(ms.kind==='official'?50:45);return '<div class="mkt-row '+(ms.target===n.cid?'on':'')+' '+(ok?'':'lock')+'" data-act="marryTarget" data-cid="'+n.cid+'"><div><b>'+esc(nameOf(n.cid))+'</b><div class="tiny muted">交情 '+Math.round(R(n.cid).aff)+(ok?'':'（不足）')+'</div></div></div>'}).join('')||'<div class="notice tiny">尚無交情夠深的對象，先去結交吧。</div>');
  }
  h+='<div style="margin-top:8px"><button class="pixel-btn btn-gold" style="width:100%" data-act="marryGo">'+UT('btn.marryGo')+'</button></div>';
  return {title:'💍 說親',html:h};
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
/** 退隱面板。 */
SHEETS.retire=()=>{
  const hs=heirCandidates();
  let h='<div class="notice tiny">退隱後，主角成為老人隱居茶室；你將以繼承人的身分繼續這個家。人脈交情打八折（舊怨一併承襲），僱員與倉庫保留，家族重新開始。</div>';
  h+=hs.map((x,i)=>'<div class="card"><div class="row"><div><b>'+esc(x.name)+'</b> <span class="tag '+(x.type==='kid'?'green':'navy')+'">'+(x.type==='kid'?'親生':'贅婿·義子')+'</span><div class="tiny muted">'+x.age+' 歲</div></div><button class="pixel-btn btn-sm btn-red" data-act="succeedGo" data-i="'+i+'" data-m="retire">'+UT('btn.succeedGo')+'</button></div></div>').join('')||'<div class="notice">目前沒有合適的繼承人（子女需滿 16 歲，或有大番頭可招贅）。</div>';
  return {title:'👴 宣佈隱居交棒',html:h};
};
/** 確認繼承人。 */
ACT.succeedGo=el=>{
  const mode=el.dataset.m,list=(mode==='retire'?heirCandidates():heirAll());const x=list[+el.dataset.i];if(!x)return;
  UI.s.sheetLock=false;
  succeed(x,mode);if(x.minor){G.silver=Math.round(G.silver*0.75)}
  UI.s.sheet=null;$('#sheet-bd').classList.add('hidden');sceneSync(true);UI.go('home');say(TX('protag.takeover'),4200);UI.render();
  setTimeout(()=>toast(MSG('succeedGo.1',{gen:G.me.gen,name:G.me.name,myAge:myAge()})),300);
};
/** 所有可繼承人選。 */
function heirAll(){
  const hs=heirCandidates();
  G.family.kids.filter(k=>kidAge(k)<16&&!k.prodigal).forEach(k=>hs.push({type:'kid',id:k.id,name:k.name,age:kidAge(k),minor:true}));
  return hs;
}

/* ======================= 人生終章（蓋棺評語，無分數） ======================= */
/** 顯示一生總結。 */
UI.showLegacy=function(){UI.s.sheetLock=true;UI.openSheet('legacy')};
/** 一生總結面板。 */
SHEETS.legacy=()=>{
  const E=G.ended,ob=E.ob;
  const cause=E.cause==='death'?'壽終，於'+yearStr(E.year)+'辭世，享年 '+ob.age+' 歲。':E.cause==='executed'?'因走私重罪伏法，於'+yearStr(E.year)+'處刑，家產盡數抄沒。':'家業傾覆，債主臨門，一生的經營化為烏有。';
  let h='<div class="card" style="background:#fffaf0;text-align:center"><div style="font-size:20px">🕯️</div><b style="font-size:15px">'+esc(G.me.name)+'</b><div class="small muted">第 '+G.me.gen+' 代·'+cause+'</div><hr class="sep"><div style="font-size:14px;line-height:1.8;color:#3a2f27">'+esc(ob.sum)+'</div></div>';
  h+='<div class="card"><b class="small">這一生</b>'+ob.facts.map(f=>'<div class="tiny" style="margin-top:2px">• '+esc(f)+'</div>').join('')+'</div>';
  if(ob.quotes.length)h+='<div class="card"><b class="small">眾人的話</b>'+ob.quotes.map(q=>'<div class="small" style="margin-top:5px"><b>'+esc(q.name)+'</b>　<span class="tag '+affCls(q.aff)+'">'+affWord(q.aff)+'</span><br>'+esc(q.txt)+'</div>').join('')+'</div>';
  else h+='<div class="notice">一生碌碌，竟沒有幾個人記得。</div>';
  h+='<div class="notice tiny">這個遊戲沒有勝負，也沒有分數。人生只是這樣走過一遭。</div>';
  const hs=heirAll();
  if(hs.length)h+='<div class="small bold">🏯 由誰接掌家業？</div>'+hs.map((x,i)=>'<div class="card"><div class="row"><div><b>'+esc(x.name)+'</b> <span class="tag '+(x.type==='kid'?'green':'navy')+'">'+(x.type==='kid'?'親生':'贅婿·義子')+'</span><div class="tiny muted">'+x.age+' 歲'+(x.minor?'（年幼，家業由族老代管，資產折損 25%）':'')+'</div></div><button class="pixel-btn btn-sm btn-gold" data-act="succeedGo" data-i="'+i+'" data-m="'+E.cause+'">'+UT('btn.succeedGo2')+'</button></div></div>').join('');
  h+='<div style="margin-top:8px"><button class="pixel-btn btn-red" style="width:100%" data-act="newLife">'+UT(hs.length?'btn.newLifeNo':'btn.newLife2')+'</button></div>';
  return {title:'🕯️ 人生終章',html:h};
};

/* ======================= 開局畫面 ======================= */
/** 顯示開局畫面（選流派、地區）。 */
UI.showStart=function(){
  if(!UI.s.startSys)UI.s.startSys='timber';
  const sv=loadSave();
  let h='<h1>🏮 問屋事情</h1><div class="sub">關於我成了江戶中盤商這件事<br><span style="font-size:11px">像素風商人人生模擬 · v'+GAME_VER+'</span></div>';
  h+='<div style="text-align:center;font-size:12px;color:#cfc6b6;margin-bottom:10px">20 歲開局。沒有固定的目標，只有一生。</div>';
  if(!sv&&OLD_SAVE_FOUND)h+='<div class="notice tiny" style="margin-bottom:8px">偵測到舊版存檔，v'+GAME_VER+' 起已不相容，已清除。請重新開局。</div>';
  if(sv)h+='<button class="pixel-btn btn-gold" style="width:100%;padding:8px;margin-bottom:10px" data-act="resume">'+UT('btn.resume',{n:esc(sv.me.name),y:yearStr(sv.year)})+'</button>';
  h+='<div class="hr-title" style="color:#e5a93b">① 選擇問屋流派（決定這一生的生存策略）</div>';
  h+=SYS.map(s=>'<div class="sys-card '+(UI.s.startSys===s.key?'sel':'')+'" data-act="pickSys" data-k="'+s.key+'"><h3>'+s.firm+'·'+s.name+' <span class="tag gold">'+s.style+'</span></h3><div class="small">'+s.tip+'</div><div class="tiny muted" style="margin-top:2px">▸ '+s.perk+'</div></div>').join('');
  h+='<button class="pixel-btn btn-red" style="width:100%;padding:10px;margin-top:14px;font-size:15px" data-act="begin">'+UT('btn.begin')+'</button>';
  $('#start-inner').innerHTML=h;$('#start').classList.remove('hidden');
};
/** 選擇流派。 */
ACT.pickSys=el=>{UI.s.startSys=el.dataset.k;UI.showStart();sfx.tap()};
/** 開始新局。 */
ACT.begin=()=>{
  newGame(UI.s.startSys,'rand');$('#start').classList.add('hidden');
  SCENE.sig='';sceneSync(true);_tk='';UI.go('home');say(TX('protag.open',{firm:G.firm}),4200);
  save();
};
/** 繼續上次存檔。 */
ACT.resume=()=>{G=loadSave();sanitizeIntros();save();applyActiveCities(G.activeIds);$('#start').classList.add('hidden');SCENE.sig='';sceneSync(true);_tk='';UI.go('home');say(TX('protag.resume'))};
