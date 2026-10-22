'use strict';
/* ======================= 旬報後的人物事件 =======================
 * 具名人物親自帶來的事件不能只留在旬報文字裡：旬報關閉後依序顯示頭像與對話。
 * 佇列存進 G，避免事件結算後重新整理頁面便完全遺失。 */
function faceEventQueue(){return G.faceEvents||(G.faceEvents=[])}
function queueFaceEvent(e){if(G&&e)faceEventQueue().push(e)}

/** 人物事件卡；商人借錢保留原本的接受／婉拒操作，其餘事件用「知道了」接續。 */
function faceEventCard(e){
  let pt='',name='',tag='',line='',effect='',buttons='<button class="pixel-btn btn-sm btn-gold" data-act="faceNext">知道了</button>';
  if(e.empId){
    const b=(G.emps||[]).find(x=>x.id===e.empId);if(!b)return null;
    pt=portraitEmp(b,56);name=b.name;tag=b.rank;
  }else{
    const n=npc(e.cid),c=CH(e.cid);if(!n||!c)return null;
    pt=portraitHtml(e.cid,56);name=c.name;tag=n.pos?posTitle(n):(ROLE_LABEL[n.role]||'來客');
  }
  if(e.type==='windfall'){
    line='東家，我談成一筆臨時買賣，替店裡添了 '+fmt(e.amt)+' 兩。';effect='現款增加 '+fmt(e.amt)+' 兩。';
  }else if(e.type==='extort'){
    line='近來替商家辦事不容易。三旬之內送來 '+fmt(e.amt)+' 兩，我自然記得你的心意。';effect='已記下承諾；到期前可在人物筆記中交付。';
  }else if(e.type==='xforce'){
    line='這批「'+xName(e.name)+'」是官府沒收來的。先放在你庫裡，替我處理乾淨。';effect='收到「'+xName(e.name)+'」'+e.qty+' 單位，列入跨行貨物。';
  }else if(e.type==='xloan'){
    const O=G.xoffer;if(!O||O.cid!==e.cid||O.turn!==e.turn)return null;
    line='掌櫃的，眼下周轉不靈。可否借我 '+fmt(O.loan)+' 兩？我拿「'+xName(O.name)+'」'+O.qty+' 單位作抵押。';effect='若他還不出錢，抵押的貨便歸你。';
    buttons='<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="xoAccept">'+UT('btn.xoAccept')+'</button><button class="pixel-btn btn-sm" data-act="xoDecline">'+UT('btn.xoDecline')+'</button></div>';
  }else return null;
  return '<div class="card warn" style="display:flow-root">'+pt+'<div><b style="font-size:15px">'+esc(name)+'</b> <span class="tag gray">'+esc(tag)+'</span></div><div class="small" style="margin:7px 0">「'+esc(line)+'」</div><div class="tiny muted" style="margin:4px 0 7px">'+esc(effect)+'</div>'+buttons+'</div>';
}

function showNextFaceEvent(){
  if(!G)return;
  const q=faceEventQueue();let e,h;
  while(q.length&&!h){e=q.shift();h=faceEventCard(e)}
  save();
  if(!h)return;
  INFO_AFTER=q.length?showNextFaceEvent:null;
  const title={windfall:'💰 大番頭回報',extort:'🤝 官員來訪',xforce:'🎁 官吏來訪',xloan:'🤝 商人來訪'}[e.type]||'來客';
  UI.showInfo(title,h);
}
/** 在旬報開啟後登記接續動作；玩家關閉旬報才開始逐件會面。 */
function armFaceEvents(){if(G&&faceEventQueue().length)INFO_AFTER=showNextFaceEvent}
ACT.faceNext=()=>UI.hideInfo();
