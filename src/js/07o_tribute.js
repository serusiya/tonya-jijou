/* ======================= 上貢：財務官員（好感 100）=======================
 *  官員開口要一批本業貨：限期內自己備妥庫存，數量取公會配額的數倍（合理可達）。
 *  到期若庫存足夠，自動上貢＝賣出，作價市價 × 倍數，並增加知名度與市佔率；
 *  備不齊則失約：交情、商譽受損。同時只能有一筆上貢。 */
const tributeOK=cid=>{const n=npc(cid),r=G.rel[cid];return !!(n&&n.role==='official'&&n.pos&&n.pos.court==='finance'&&alive(cid)&&r&&r.bond&&r.aff>=100&&!isEnemy(cid))};
function tributeHtml(cid){
  if(!tributeOK(cid))return '';
  const T=G.tribute,A=ODDS.tribute;
  let h='<div class="card warn" style="margin:4px 0"><b class="small">🎁 上貢</b>';
  if(T&&T.cid===cid){
    const have=G.inv[T.name]||0,left=Math.max(0,T.due-G.turn);
    return h+'<div class="tiny">上貢進行中：「'+esc(COMM_MAP[T.name].short)+'」<b>'+T.qty+'</b> 單位，剩 <b>'+left+'</b> 旬到期（目前庫存 '+have+(have>=T.qty?' ✅':' ⚠️ 還差 '+(T.qty-have))+'）。</div></div>';
  }
  h+='<div class="tiny muted">他願收你一批本業貨：'+A.turns+' 旬內備妥，到期按<b>市價 '+A.priceMul+' 倍</b>自動上貢入帳，並增加知名度與市佔率。備不齊則失約，交情與商譽受損。耗 1 行動。</div>';
  h+='<div style="margin-top:3px"><button class="pixel-btn btn-sm btn-gold" data-act="tribute" data-cid="'+cid+'" '+(T?'disabled':'')+'>'+UT('btn.tribute')+'</button></div></div>';
  return h;
}
ACT.tribute=el=>{
  const cid=el.dataset.cid;if(!tributeOK(cid))return;
  if(G.tribute){toast(MSG('tribute.busy'));return}
  const cs=ownComms();if(!cs.length){toast(MSG('tribute.noGoods'));return}
  if(!spendAP())return;
  const A=ODDS.tribute,c=pick(cs),qty=Math.max(A.min,Math.min(Math.round(quotaOf(c.name)*A.quotaMult),itemCap(c.name)));
  G.tribute={cid,name:c.name,qty,due:G.turn+A.turns};
  toast(MSG('tribute.start',{off:nameOf(cid),turns:A.turns,item:c.short,qty,mul:A.priceMul}),5200);
  UI.render();refreshSheet();
};
/** 每旬結算：到期則自動上貢或失約。 */
function tributeTick(log){
  const T=G.tribute;if(!T||G.turn<T.due)return;
  const A=ODDS.tribute,have=G.inv[T.name]||0,off=nameOf(T.cid),short=COMM_MAP[T.name].short;
  G.tribute=null;
  if(have>=T.qty){
    const rev=Math.round(quoteSale(T.name,T.qty).perUnit*T.qty*A.priceMul);
    G.inv[T.name]-=T.qty;G.silver+=rev;G.lastRev+=rev;G.life.peak=Math.max(G.life.peak,G.silver);
    const f0=G.fame||0;addFame(A.fame);const gf=Math.round(((G.fame||0)-f0)*10)/10;G.mybias=Math.min(4,(G.mybias||1)*(1+A.shareUp));G.share=marketShares();
    G.life.tributes=(G.life.tributes||0)+1;logRel(T.cid,'依約上貢「'+short+'」'+T.qty+' 單位。');
    const t=NEWS('tribute.ok',{off,item:short,qty:T.qty,rev:fmt(rev),fame:gf});log.push(t);pushNews(t);sfx.coin();
  }else{
    const r=R(T.cid);r.aff=Math.max(0,r.aff-A.failAff);G.rep=clamp(G.rep-A.failRep,0,100);loseFame('tributeFail');
    logRel(T.cid,'上貢失約，對方不悅。');
    const t=NEWS('tribute.fail',{off,item:short,qty:T.qty,have,aff:A.failAff,rep:A.failRep});log.push(t);pushNews(t);sfx.bad();
  }
}
