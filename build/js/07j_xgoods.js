'use strict';
/* ★檔案總覽：跨行貨物（趣味玩法，不是正式的賺錢途徑）
 * - 來源只有三種：①船長／飛腳在產地順手買回的便宜貨；②認識的商人拿貨物抵押向你借錢；③官吏硬塞給你的貨。
 *   不能主動買入。貨存在倉庫（G.xinv），佔用倉容，不影響大盤。
 * - 賣出只能請介紹人代為脫手：收白銀（公款）、扣介紹人交情 2～5；價格約為基準價的 45%～87%（交情越深越高）。
 * - 這不是後期才開放的跨行批發功能。 */
const xName=n=>COMM_MAP[n]?COMM_MAP[n].short:n;
function otherComms(){const own=ownNameSet();return COMM.filter(c=>!own.has(c.name))}
function xgoodsCard(){
  const ks=Object.keys(G.xinv||{}).filter(k=>G.xinv[k]>0);
  if(!ks.length)return '';
  const it=G.introId&&introOf(G.introId);
  let h='<div class="card"><b class="small">📦 他行貨物（非本業，須請介紹人賣掉）</b><div class="tiny muted">'+(it?'介紹人：'+esc(nameOf(G.introId))+'（交情 '+Math.round(R(G.introId).aff)+'）。每次請他出面，交情 −2～5。':'目前沒有介紹人，賣不掉。')+'</div>';
  h+=ks.map(k=>'<div class="row small" style="margin-top:3px"><span>'+esc(xName(k))+' × '+G.xinv[k]+'</span><button class="pixel-btn btn-sm" data-act="xsell" data-n="'+esc(k)+'">'+UT('btn.xsell')+'</button></div>').join('');
  return h+'</div>';
}
ACT.xsell=el=>{
  const name=el.dataset.n,q=(G.xinv||{})[name]||0;if(q<=0)return;
  const it=G.introId&&introOf(G.introId);
  if(!it){toast(MSG('xsell.1'));return}
  if(isEnemy(G.introId)){toast(MSG('xsell.2'));return}
  const c=COMM_MAP[name],tf=trustFactor(R(G.introId).aff);
  const m=clamp(0.42+0.30*tf+(rnd()-0.5)*0.16,0.35,0.9),unit=c.base*m*(1-Math.min(0.25,0.002*q)),rev=Math.round(unit*q);
  G.silver+=rev;delete G.xinv[name];
  const d=introCost(it);addFame(0.1);sfx.coin();
  const t=NEWS('xsell.1',{introId:nameOf(G.introId),short:c.short,q,rev:fmt(rev),m:Math.round(m*100),d});
  pushNews(t);toast(t,4800);UI.render();refreshSheet();
};
/* ---------- 來源②：商人拿貨抵押借錢（旬報選項卡） ---------- */
function xofferCard(){
  const O=G.xoffer;if(!O)return '';
  return '<div class="rp-sec">🤝 商人借錢</div><div class="card warn"><div><b>'+esc(nameOf(O.cid))+'</b> <span class="tag gold">商人</span></div><div class="tiny muted" style="margin:3px 0">對方周轉不靈，想向你借 <b>'+fmt(O.loan)+' 兩</b>，押上「'+esc(xName(O.name))+'」'+O.qty+' 單位。他說還不出錢的話，貨就歸你。</div><div style="display:flex;gap:6px"><button class="pixel-btn btn-sm btn-gold" data-act="xoAccept">'+UT('btn.xoAccept')+'</button><button class="pixel-btn btn-sm" data-act="xoDecline">'+UT('btn.xoDecline')+'</button></div></div>';
}
ACT.xoAccept=()=>{
  const O=G.xoffer;if(!O)return;
  if(G.silver<O.loan){toast(MSG('xoAccept.1',{O:fmt(O.loan)}));return}
  const room=Math.max(0,invCap()-invUsed()),q=Math.min(O.qty,room);
  if(q<=0){toast(MSG('xoAccept.2'));G.xoffer=null;UI.hideInfo();return}
  G.silver-=O.loan;G.xinv=G.xinv||{};G.xinv[O.name]=(G.xinv[O.name]||0)+q;
  const r=R(O.cid);r.aff=clamp(r.aff+6,0,100);logRel(O.cid,'借他 '+O.loan+' 兩，收下「'+xName(O.name)+'」作抵押。好感 +6。');
  toast(MSG('xoAccept.3',{O:fmt(O.loan),xName:xName(O.name),q}));G.xoffer=null;sfx.coin();UI.hideInfo();UI.render();
};
ACT.xoDecline=()=>{G.xoffer=null;UI.hideInfo();toast(MSG('xoDecline.1'))};
/* ---------- 每旬：商人借錢、官吏硬塞 ---------- */
function xgoodsTick(log){
  G.xoffer=null;                         // 上一旬沒處理＝婉拒
  G.xinv=G.xinv||{};
  const oth=otherComms();if(!oth.length||!G.world)return;
  const npcs=Object.values(G.world.npcs);
  // ②商人拿貨抵押借錢
  if(roll('xLoan')){
    const ms=npcs.filter(n=>['rival','broker'].includes(n.role)&&alive(n.cid)&&R(n.cid).met&&!isEnemy(n.cid));
    if(ms.length){
      const n=pick(ms),c=pick(oth),loan=rint(150,500),qty=Math.max(1,Math.round(1.25*loan/(c.base*0.6)));
      G.xoffer={cid:n.cid,name:c.name,qty,loan,turn:G.turn};
      log.push(NEWS('xgoodsTick.1',{n:nameOf(n.cid)}));
    }
  }
  // ③官吏硬塞
  if(roll('xForce')){
    const os=npcs.filter(n=>n.role==='official'&&alive(n.cid)&&R(n.cid).met);
    if(os.length){
      const n=pick(os),c=pick(oth),room=Math.max(0,invCap()-invUsed()),q=Math.min(rint(15,50),room);
      if(q>0){G.xinv[c.name]=(G.xinv[c.name]||0)+q;logRel(n.cid,'把一批「'+c.short+'」硬塞給你處理。');
        log.push(NEWS('xgoodsTick.2',{n:nameOf(n.cid),short:c.short,q}))}
    }
  }
}
