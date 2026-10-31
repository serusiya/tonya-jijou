'use strict';
/* ======================= 外地遠國奉行所官員：只能書信往來（第一百四十四節） =======================
 *  - 本店所在地區的遠國奉行所官員照舊親自拜訪；外地的不能見面、不能派丁稚，只能託人寄信。
 *  - 所有外地官員合計一旬一封（G.letterT＝寄出的那一旬）；送信費 100 兩加中檔禮金；不扣行動點數；風聲 +0.2；寄出當下就知道結果。
 *     初次問候信：比照毛遂自薦，可能被退信（只收送信費）；知名度門檻照舊（有介紹人視同多一階）。
 *     一般書信：好感 +4～8，最多加到 60。
 *     書狀請託：交情 ≥60 時改寄請託信，信裡直接開口，不打拜訪戰鬥；照常扣好感、照常審理（外地審理旬數加倍，見 07k appDuration）。
 *  - 外地官員沒有好感 100 的特殊請託；只限本地區官員的請託（捎帶、本陣御用達、討伐賊亂）也求不到。
 *  - 大番頭的自動問候不會找外地官員。
 *  數值 ODDS.letter；文字 letter.*（01e、01f）。 */
const letterUsed=()=>G.letterT===G.turn;
const letterCost=cid=>ODDS.letter.fee+btTiers(cid)[1];
SPEND_ARG['spend.letter']=a=>nameOf(a);
/** 寄信前檢查；回傳錯誤訊息或 null。 */
function letterCheck(cid,amt){
  const n=npc(cid);if(!foreignReg(n))return MSG('letter.notForeign');
  if(letterUsed())return MSG('letter.used');
  if(G.silver<amt)return MSG('letter.short',{a:fmt(amt)});
  return null;
}
/** 尚未結識：問候信按鈕。 */
function letterMeetHtml(cid){
  const amt=letterCost(cid),used=letterUsed();
  return UT('letter.meetNote')+'<div style="margin-top:4px"><button class="pixel-btn btn-sm btn-gold" data-act="letterMeet" data-cid="'+cid+'" '+(used?'disabled':'')+'>'+(used?UT('btn.letterUsed'):UT('btn.letterMeet',{c:coinHtml('silver',amt)}))+'</button></div>';
}
/** 已結識：寄信或書狀請託。 */
function letterRowHtml(cid){
  const r=R(cid),amt=letterCost(cid),used=letterUsed(),friend=r.aff>=FRIEND_AFF;
  let h=UT('letter.row');
  if(used)return h+'<div style="margin-top:4px"><button class="pixel-btn btn-sm" disabled>'+UT('btn.letterUsed')+'</button></div>';
  if(!friend)return h+'<div style="margin-top:4px"><button class="pixel-btn btn-sm btn-gold" data-act="letterSend" data-cid="'+cid+'">'+UT('btn.letter',{c:coinHtml('silver',amt)})+'</button></div>';
  const can=reqList(cid).length>0;
  return h+'<div style="margin-top:4px"><button class="pixel-btn btn-sm btn-gold" data-act="letterReq" data-cid="'+cid+'" '+(can?'':'disabled')+'>'+UT('btn.letterReq',{c:coinHtml('silver',amt)})+'</button></div>'+(can?'':UT('letter.noReq'));
}
const letterPay=(cid,amt)=>{payPublic('spend.letter|'+cid,amt);addHeat(ODDS.letter.heat);G.letterT=G.turn};
const letterDone=(m,ok)=>{toast(m,Math.max(3200,m.length*120));if(ok)sfx.gift();else sfx.bad();UI.render();refreshSheet()};
/** 初次問候信：比照毛遂自薦，可能被退信。 */
ACT.letterMeet=el=>{
  const cid=el.dataset.cid,n=npc(cid),r=R(cid),amt=letterCost(cid);
  const via=!!(G.introId&&introOf(G.introId));
  if(meetTierNeed(cid)>fameTier()+(via?1:0)){toast(MSG('meet.fame'));return}
  const err=letterCheck(cid,amt);if(err){toast(err);return}
  let pRef=clamp(0.35+0.08*(n.pos.rank-1),0,0.8);pRef=Math.max(0.02,pRef-fameCut());
  if(chance(pRef)){
    payPublic('spend.letter|'+cid,ODDS.letter.fee);G.letterT=G.turn;r.lastIntro=G.turn;r.lastOk=false;addKnown(cid);
    logRel(cid,UT('letter.log.returned'));return letterDone(MSG('letter.returned',{a:fmt(ODDS.letter.fee)}),false);
  }
  letterPay(cid,amt);r.lastIntro=G.turn;r.lastOk=true;
  const gain=Math.round(10/(1+(n.pos.rank-2)*0.4));
  setAff(r,clamp(r.aff+gain,0,100));r.met=true;r.seen=true;addKnown(cid);if(!r.fameGot){r.fameGot=true;addFame(1.5*n.pos.rank,'mid')}
  r.bond={mult:0.6,label:UT('bond.letter'),introId:null};
  logRel(cid,UT('letter.log.met',{g:gain}));
  letterDone(MSG('letter.met',{n:nameOf(cid),g:gain}),true);
};
/** 一般書信：好感 +4～8，最多到 60。 */
ACT.letterSend=el=>{
  const cid=el.dataset.cid,r=R(cid),amt=letterCost(cid),O=ODDS.letter;
  if(r.aff>=O.cap){toast(MSG('letter.friend'));return}
  const err=letterCheck(cid,amt);if(err){toast(err);return}
  letterPay(cid,amt);
  const gain=Math.max(0,Math.min(rint(O.gainMin,O.gainMax),O.cap-r.aff));
  setAff(r,clamp(r.aff+gain,0,100));r.lastOk=true;addFame(0.1);
  logRel(cid,UT('letter.log.sent',{a:fmt(amt),g:gain}));
  letterDone(MSG('letter.sent',{n:nameOf(cid),a:fmt(amt),g:gain}),true);
};
/** 書狀請託：交情 ≥60，信裡直接開口（不打拜訪戰鬥）。 */
ACT.letterReq=el=>{
  const cid=el.dataset.cid,r=R(cid),amt=letterCost(cid);
  if(r.aff<FRIEND_AFF){toast(MSG('letter.notFriend'));return}
  if(!reqList(cid).length){toast(MSG('letter.noReq'));return}
  const err=letterCheck(cid,amt);if(err){toast(err);return}
  letterPay(cid,amt);logRel(cid,UT('letter.log.req',{a:fmt(amt)}));
  UI.render();refreshSheet();
  INFO_AFTER=null;UI.showInfo(UT('letter.reqTitle',{a:nameOf(cid)}),requestHtml(cid,TX('letter.reqLine')));
};
/* 外地官員不能登門：拜訪、投帖都擋下（筆記頁等其他入口也一樣） */
{const v=ACT.visit;ACT.visit=el=>{if(foreignReg(npc(el.dataset.cid))){toast(MSG('letter.only'));return}v(el)}}
{const m=ACT.meet;ACT.meet=el=>{if(foreignReg(npc(el.dataset.cid))){toast(MSG('letter.only'));return}m(el)}}
