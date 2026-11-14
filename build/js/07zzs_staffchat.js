'use strict';
/* ★檔案總覽：店員閒聊、零用錢與心腹指令（DESIGN_NOTES 第二百六十八節）
 * - 人物卡（私宅、河岸碼頭）不再直接列出暗殺、放火、做帳；每位店員多一顆「閒聊」（樣式同辭退）。
 * - 零用錢：好感未滿 80 照舊 +3～5；80 以上一般人退回（不扣錢、不算給過），貪欲高的照收照加；好感 100 不再加。
 * - 閒聊：不扣行動，同一人一旬一次（e.chatT）；未滿 80 不加好感；80 以上一般人 +3～5，貪欲高的不加。
 *   內容：依好感的開場一句＋往事（e.mem，約一半機會）或點人閒聊的內容（07h_duties.js 的 chatFor）；心腹另說一句並列出指令。
 *   心腹聊過以後，按鈕改為「吩咐差事」，只開指令。
 * - 往事：店員偶發事件、升遷、查帳、年資成長、夫人事件、借出受傷、詐領演戲、採買遇險；最多記六件，同一件最多提兩次。
 * - 數值 ODDS.staffChat；台詞 LINES.staffChat；文字 sc.*（01e）。 */
const SC=()=>ODDS.staffChat;
const scGreedy=e=>(statsOfEmp(e).greed_index||0)>=SC().greed;
const scChatted=e=>e.chatT===G.turn;
/** 記一件往事（k＝種類鍵，對應 LINES.staffChat.mem）。 */
function scMem(e,k){
  if(!e||!k)return;e.mem=e.mem||[];if(k==='grow')e.mem=e.mem.filter(m=>m.k!=='grow');   // 年資成長只留最近一件
  e.mem.push({t:G.turn,k,u:0});
  if(e.mem.length>SC().memMax)e.mem.splice(0,e.mem.length-SC().memMax);
}
/** 心腹的指令（沒有就回傳空字串）。 */
function scOrders(e){
  const a=empAff(e);if(a<100)return '';
  if(e.rank==='guard')return assassinHtml(e);
  if(arsonOK(e))return arsonHtml(e);
  if(e.rank==='chief')return chiefBookHtml(e);
  if(e.rank==='captain')return UT('loyal.empAffHtml');
  return '';
}
const scSworn=e=>empAff(e)>=100&&(e.rank==='guard'||e.rank==='chief'||e.rank==='captain'||arsonOK(e));
/** 人物卡上的零用錢列（不再顯示「已滿」，也不列特殊指令）。 */
empAffHtml=function(e){
  const a=empAff(e),given=e.allowT===G.turn;
  return UT('loyal.h',{a:Math.round(a),b:bar(a,100,'gold')})+'</div>'+'<button class="pixel-btn btn-sm" data-act="allow" data-id="'+e.id+'" '+(given?'disabled':'')+'>'+(given?UT('btn.allowDone'):UT('btn.allow',{c:costBtn('allowance')}))+'</button></div>';
};
/** 「閒聊」按鈕（放在辭退旁邊，樣式相同）。 */
function staffChatBtn(e){
  if(scChatted(e))return scSworn(e)?'<button class="pixel-btn btn-sm" data-act="staffOrder" data-id="'+e.id+'">'+UT('btn.staffOrder')+'</button>':'<button class="pixel-btn btn-sm" disabled>'+UT('btn.staffChatDone')+'</button>';
  return '<button class="pixel-btn btn-sm" data-act="staffChat" data-id="'+e.id+'">'+UT('btn.staffChat')+'</button>';
}
ACT.allow=el=>{
  const e=G.emps.find(x=>x.id===el.dataset.id);if(!e)return;
  if(e.allowT===G.turn){toast(MSG('allow.2'));return}
  const a=empAff(e),O=SC(),greedy=scGreedy(e);
  if(a>=O.affAt&&!greedy){toast(UT('sc.allowRefuse',{n:e.name,l:TX('staffChat.allowRefuse')}),4200);sfx.tap();return}   // 退回：不扣錢、不算給過
  if(!afford('allowance')){toast(shortMsg('allowance'));return}
  spend('allowance');e.allowT=G.turn;
  const g=a>=100?0:Math.min(100-a,rint(O.gain[0],O.gain[1]));e.aff=Math.min(100,a+g);sfx.coin();
  if(a>=O.affAt)toast(UT('sc.allowGreedy',{n:e.name,l:TX('staffChat.allowGreedy'),g:g?UT('sc.affUp',{g}):''}),4200);
  else toast(MSG('allow.3',{name:e.name,g,aff:Math.round(e.aff)}));
  UI.render();refreshSheet();
};
/** 往事的台詞（鍵名含「.」，不能走 TX 的路徑查表）。 */
function scMemLine(k,e){const L=LINES.staffChat.mem[k];if(!L)return '';const v=Array.isArray(L)?pick(L):L;return String(v).replace(/\{n\}/g,e.name).replace(/\{k\}/g,rankName(e.rank))}
/** 挑一件可以講的往事（優先提得少的）；沒有回傳 null。 */
function scMemPick(e){
  const L=(e.mem||[]).filter(m=>(m.u||0)<SC().memUse&&LINES.staffChat.mem[m.k]);
  const extra=[];if(e.origin==='tea')extra.push({k:'tea',u:e.teaU||0,virt:'teaU'});else if(!e.cid&&e.homegrown)extra.push({k:'kid',u:e.kidU||0,virt:'kidU'});
  const all=L.concat(extra.filter(x=>x.u<SC().memUse));if(!all.length)return null;
  const lo=Math.min(...all.map(m=>m.u||0));return pick(all.filter(m=>(m.u||0)===lo));
}
/** 閒聊視窗的內容。 */
function scBody(e,eff,first){
  const a=empAff(e),tone=a>=80?'warm':a>=40?'mid':'cold';
  let h='<div style="display:flow-root">'+portraitEmp(e,56)+'<div style="margin-top:2px">'+esc(TX('staffChat.tone.'+tone,{n:e.name}))+'</div>';
  if(first){
    const m=chance(SC().memP)?scMemPick(e):null;
    if(m){if(m.virt)e[m.virt]=(e[m.virt]||0)+1;else m.u=(m.u||0)+1;h+='<div class="tiny muted" style="margin-top:4px">'+UT('sc.memKind')+'</div><div>'+esc(scMemLine(m.k,e))+'</div>'}
    else{const c=chatFor({kind:'emp',id:'emp_'+e.id,label:e.name});h+='<div class="tiny muted" style="margin-top:4px">'+esc(c.kind)+'</div><div>'+esc(c.text)+'</div>';if(c.cid)h+=UT('duty2.openChat',{a:esc(nameOf(c.cid))});
      if(c.rumorEmp){const x=G.emps.find(y=>y.id===c.rumorEmp);if(x)h+='<div class="notice tiny" style="margin-top:6px">'+esc(MSG('audit.heard',{name:x.name,rank:rankName(x.rank)}))+'</div>'}}
  }
  h+='</div>';
  if(eff)h+='<div class="tiny" style="margin-top:4px;color:#2f7d4f">'+eff+'</div>';
  if(a>=100){
    if(scSworn(e)){
      h+='<div class="notice" style="margin-top:6px">'+esc(TX(e.rank==='captain'?'staffChat.sea':'staffChat.sworn',{n:e.name}))+'</div>'+scOrders(e);
    }else if(e.rank==='clerk'||e.rank==='banto')h+='<div class="tiny muted" style="margin-top:6px">'+esc(TX('staffChat.notMaterial',{n:e.name}))+'</div>';
  }
  return h;
}
ACT.staffChat=el=>{
  const e=G.emps.find(x=>x.id===el.dataset.id);if(!e)return;
  if(scChatted(e)){toast(UT('sc.done'));return}
  const a=empAff(e),O=SC();e.chatT=G.turn;
  let eff=UT('sc.plain');
  if(a>=O.affAt&&a<100&&!scGreedy(e)){const g=Math.min(100-a,rint(O.gain[0],O.gain[1]));e.aff=a+g;eff=UT('sc.affUp',{g})}
  else if(a>=100)eff='';
  sfx.tap();UI.showInfo(UT('sc.title',{k:rankName(e.rank),n:e.name}),scBody(e,eff,true));UI.render();refreshSheet();
};
ACT.staffOrder=el=>{const e=G.emps.find(x=>x.id===el.dataset.id);if(!e||!scSworn(e))return;UI.showInfo(UT('sc.title',{k:rankName(e.rank),n:e.name}),scBody(e,'',false))};
/* 指令執行後關掉閒聊視窗 */
['assassinate','arson','chiefBook'].forEach(k=>{const f=ACT[k];ACT[k]=function(el){const inInfo=!!(el&&el.closest&&el.closest('#info-body'));f.apply(this,arguments);if(inInfo)UI.hideInfo()}});

/* ---------- 往事的記錄點 ---------- */
{const _f=sevResolve;sevResolve=function(pay){const S=G.staffEv,ok=S&&!S.done,id=S&&S.empId,ty=S&&S.type;const r=_f.apply(this,arguments);if(ok){const e=G.emps.find(x=>x.id===id);if(e)scMem(e,'sev.'+ty+'.'+(pay?'pay':'ign'))}return r}}
{const _f=promoteEmp;promoteEmp=function(id){const r=_f.apply(this,arguments);if(r&&r.ok)scMem(G.emps.find(x=>x.id===id),'promote');return r}}
{const _f=auditEmp;auditEmp=function(id){const r=_f.apply(this,arguments);if(r&&r.ok&&!r.found)scMem(G.emps.find(x=>x.id===id),'auditWrong');return r}}
{const _f=auditDecide;auditDecide=function(id,k){const r=_f.apply(this,arguments);if(r&&(k==='forgive'||k==='punish'))scMem(G.emps.find(x=>x.id===id),k);return r}}
{const _f=staffYearTick;staffYearTick=function(){const g0=new Map(G.emps.map(e=>[e,JSON.stringify(e.grow||e.stats||{})]));const r=_f.apply(this,arguments);G.emps.forEach(e=>{if(g0.has(e)&&g0.get(e)!==JSON.stringify(e.grow||e.stats||{}))scMem(e,'grow')});return r}}
{const _f=wifeResolve;wifeResolve=function(help){const C=G.wifeEv&&G.wifeEv.cur,id=C&&C.empId,kind=C&&C.kind,ok=C&&C.bad&&!C.done;const r=_f.apply(this,arguments);if(ok&&id){const e=G.emps.find(x=>x.id===id);if(e&&kind==='bully'&&!help)scMem(e,'wifeBully.ign');if(e&&kind==='quarrel')scMem(e,'wifeQuarrel.'+(help?'help':'ign'))}return r}}
{const _f=lendReturnTick;lendReturnTick=function(){const h0=new Map(G.emps.map(e=>[e,e.hurtUntil||0]));const r=_f.apply(this,arguments);G.emps.forEach(e=>{if(h0.has(e)&&(e.hurtUntil||0)>h0.get(e))scMem(e,'hurt')});return r}}
{const _f=fraudDo;fraudDo=function(){const h0=new Map(G.emps.map(e=>[e,e.hurtUntil||0]));const r=_f.apply(this,arguments);G.emps.forEach(e=>{if(h0.has(e)&&(e.hurtUntil||0)>h0.get(e))scMem(e,'fraud')});return r}}
{const _f=resolveVoyage;resolveVoyage=function(s){const top=G.voyLog&&G.voyLog[0];const r=_f.apply(this,arguments);const E=G.voyLog&&G.voyLog[0];if(E&&E!==top&&E.wreck){const e=G.emps.find(x=>x.id===s.capt);if(e)scMem(e,'wreck')}return r}}
