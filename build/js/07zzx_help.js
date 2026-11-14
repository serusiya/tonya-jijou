'use strict';
/* ★檔案總覽：去店裡幫忙（DESIGN_NOTES 第二百八十八節）
 * - 名門商邸裡同業與旅商人的人物卡多一顆「去店裡幫忙」：扣 1 點行動（照常加壓力），一旬只能幫一次（G.helpT＝幫過的那一旬）。
 * - 報酬：私房錢 20～40 兩（對方在本城同業與旅商裡身代越高給得越多）；好感（旅商 +3～5、同業 +2～4）；
 *   三成機會順便探聽到對方的性向。只有已經認識的人才會讓你去幫忙；仇人不讓你進門。
 * - 名望一到二階就永久停止（G.helpOff，之後掉回一階也不再開放）；按鈕不再出現，當旬旬報一則。
 * - 數值 ODDS.help；台詞 LINES.help；文字 btn.help*、help.*（01e）；新聞 help.off（01g）。 */
const HP=()=>ODDS.help;
/** 名望到了門檻就永久停止。 */
function helpCheck(log){
  if(!G||G.helpOff)return;
  if(fameTier()>=HP().stopTier){G.helpOff=true;if(log&&G.turn>0){const t=NEWS('help.off');pushNews(t);log.push(t)}}
}
const helpOK=cid=>{const n=npc(cid),r=G.rel[cid];return !!(r&&r.bond&&n&&(n.role==='rival'||n.role==='guest')&&n.cityId===G.cityId&&alive(cid)&&!n.hired&&!jailed(n)&&!isEnemy(cid))};
/** 人物卡上的幫忙列。 */
function helpRow(cid){
  helpCheck();
  if(G.helpOff||!helpOK(cid))return '';
  const used=G.helpT===G.turn;
  return '<div style="margin-top:5px"><button class="pixel-btn btn-sm" data-act="help" data-cid="'+cid+'" '+(used?'disabled':'')+'>'+UT(used?'btn.helpUsed':'btn.help')+'</button> <span class="tiny muted">'+UT('help.note')+'</span></div>';
}
{const _pb=personBlock;personBlock=function(cid,ctx){
  const h=_pb.apply(this,arguments);
  if(ctx!=='res'||h.indexOf('class="card locked"')>=0)return h;   // 知名度不夠見不到的人不能去幫忙
  const row=helpRow(cid);if(!row)return h;
  return h.slice(0,h.lastIndexOf('</div>'))+row+'</div>';
}}
/** 這位在本城同業與旅商裡的身代排位（0～1，越大生意越大）。 */
function helpRankOf(cid){
  const L=Object.values(G.world.npcs).filter(n=>n.cityId===G.cityId&&(n.role==='rival'||n.role==='guest')&&alive(n.cid)).map(n=>({cid:n.cid,w:bzInit(n).bzw||0})).sort((a,b)=>a.w-b.w);
  const i=L.findIndex(x=>x.cid===cid);return L.length>1&&i>=0?i/(L.length-1):0.5;
}
ACT.help=el=>{
  const cid=el.dataset.cid;helpCheck();
  if(G.helpOff){toast(UT('help.offNote'));UI.render();refreshSheet();return}
  if(!helpOK(cid))return;
  if(G.helpT===G.turn){toast(UT('help.used'));return}
  if(!spendAP())return;
  const P=HP(),n=npc(cid),r=R(cid),rival=n.role==='rival';
  G.helpT=G.turn;
  const pay=Math.round(P.pay[0]+(P.pay[1]-P.pay[0])*helpRankOf(cid)*(0.8+0.2*rnd()));
  G.gold=(G.gold||0)+pay;
  const g=rival?P.affRival:P.affGuest,gain=rint(g[0],g[1]),a0=r.aff;setAff(r,r.aff+gain);
  let tip='';if(!r.topKnown&&chance(P.scout)){r.topKnown=true;tip=UT('help.scout',{t:top3Txt(cid)})}
  logRel(cid,UT('help.log',{a:pay}));
  const line=TX(rival?'help.rival':'help.guest');
  UI.showInfo(UT('help.t',{n:nameOf(cid)}),portraitHtml(cid,56)+'<div class="small" style="margin:5px 0">「'+esc(line)+'」</div>'
    +'<div class="notice tiny">'+UT('help.eff',{a:pay,g:Math.round(r.aff-a0)})+tip+'</div>');
  sfx.coin();UI.render();refreshSheet();
};
/** 每旬：檢查名望（advanceTurn 結尾前）。 */
{const _a=advanceTurn;advanceTurn=function(){const log=_a.apply(this,arguments);try{helpCheck(log)}catch(e){}return log}}
