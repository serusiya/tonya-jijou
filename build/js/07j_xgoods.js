'use strict';
/* ★檔案總覽：跨行貨物（趣味玩法，不是正式的賺錢途徑）
 * - 來源只有三種：①船長／飛腳在產地順手買回的便宜貨；②認識的商人拿貨物抵押向你借錢；③官吏硬塞給你的貨。
 *   不能主動買入。貨存在倉庫（G.xinv），佔用倉容，不影響大盤。
 * - 賣出只能拜訪座客商人請託代售（07x_dealers.js）：收入現款、該商人好感 −10；價格約為基準價的 54%～87%（交情越深越高）。
 * - 這不是後期才開放的跨行批發功能。 */
const xName=n=>COMM_MAP[n]?COMM_MAP[n].short:n;
function otherComms(){const own=ownNameSet();return COMM.filter(c=>!own.has(c.name))}
/** 一批沒收貨（協助銷貨與官吏硬塞共用）：非本業、非奢侈品，總值約 300～600 兩（以基準價計），5～50 單位，受倉位限制；放不下 5 單位回傳 null。 */
function xLot(){
  const room=Math.max(0,invCap()-invUsed()-pendingQty()-transitQty());if(room<5)return null;
  const pool=otherComms().filter(c=>!c.luxury);if(!pool.length)return null;
  const c=pick(pool),q=Math.min(room,clamp(Math.round(rint(300,600)/c.base),5,50));
  return {c,q};
}
function xgoodsCard(){
  const ks=Object.keys(G.xinv||{}).filter(k=>G.xinv[k]>0);
  if(!ks.length)return '';
  let h='<div class="card"><b class="small">📦 他行貨物（非本業）</b><div class="tiny muted">大盤不收。拜訪交情 60 以上的座客商人，打勝後可請他代售，一次一項、整批全收。</div>';
  h+=ks.map(k=>'<div class="row small" style="margin-top:3px"><span>'+esc(xName(k))+' × '+G.xinv[k]+'</span><span class="tiny muted">基準價 '+fmt1(COMM_MAP[k].base)+' 兩</span></div>').join('');
  return h+'</div>';
}
/* ---------- 來源②：商人拿貨抵押借錢（旬報選項卡） ---------- */
ACT.xoAccept=()=>{
  const O=G.xoffer;if(!O)return;
  if(G.silver<O.loan){toast(MSG('xoAccept.1',{O:fmt(O.loan)}));return}
  const room=Math.max(0,invCap()-invUsed()),q=Math.min(O.qty,room);
  if(q<=0){toast(MSG('xoAccept.2'));G.xoffer=null;UI.hideInfo();return}
  payPublic('商人週轉：'+xName(O.name),O.loan);G.xinv=G.xinv||{};G.xinv[O.name]=(G.xinv[O.name]||0)+q;
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
      queueFaceEvent({type:'xloan',cid:n.cid,turn:G.turn});
      log.push(NEWS('xgoodsTick.1',{n:nameOf(n.cid)}));
    }
  }
  // ③官吏硬塞
  if(roll('xForce')){
    const os=npcs.filter(n=>n.role==='official'&&alive(n.cid)&&R(n.cid).met&&!awayNow(n));
    if(os.length){
      const n=pick(os),L=xLot(),c=L&&L.c,q=L?L.q:0;
      if(q>0){G.xinv[c.name]=(G.xinv[c.name]||0)+q;logRel(n.cid,'把一批「'+c.short+'」硬塞給你處理。');
        queueFaceEvent({type:'xforce',cid:n.cid,name:c.name,qty:q});
        log.push(NEWS('xgoodsTick.2',{n:nameOf(n.cid),short:c.short,q}))}
    }
  }
}
