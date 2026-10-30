'use strict';
/* ======================= 旬報後的人物事件 =======================
 * 具名人物親自帶來的事件不能只留在旬報文字裡：旬報關閉後依序顯示頭像與對話。
 * 佇列存進 G，避免事件結算後重新整理頁面便完全遺失。 */
function faceEventQueue(){return G.faceEvents||(G.faceEvents=[])}
function queueFaceEvent(e){if(G&&e)faceEventQueue().push(e)}

/** 人物事件卡；官吏查貨（賄賂／公事公辦）、商人借錢（接受／婉拒）附選項，其餘事件用「知道了」接續。查貨、借錢、硬塞都只在這裡呈現，旬報不另列卡片。 */
function faceEventCard(e){
  let pt='',name='',tag='',line='',effect='',buttons=UT('face.buttons');
  if(e.empId){
    const b=(G.emps||[]).find(x=>x.id===e.empId);if(!b)return null;
    pt=portraitEmp(b,56);name=b.name;tag=rankName(b.rank);
  }else{
    const n=npc(e.cid),c=CH(e.cid);if(!n||!c)return null;
    pt=portraitHtml(e.cid,56);name=c.name;tag=n.pos?posTitle(n):(ROLE_LABEL[n.role]||UT('face.faceEventCard'));
  }
  if(e.type==='windfall'){
    line=UT('face.faceEventCard.2',{a:fmt(e.amt)});effect=UT('face.faceEventCard.3',{a:fmt(e.amt)});
  }else if(e.type==='extort'){
    line=UT('face.faceEventCard.4',{a:fmt(e.amt)});effect=UT('face.faceEventCard.5');
  }else if(e.type==='inspect'){
    const I=G.inspect;if(!I||I.cid!==e.cid||I.turn!==e.turn)return null;
    const rk=npc(e.cid).pos?npc(e.cid).pos.rank:1;
    line=UT('face.faceEventCard.6');effect=UT('face.faceEventCard.7');
    buttons='<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="inspBribe">'+UT('btn.inspBribe',{c:coinHtml('silver',inspectBribe(rk))})+'</button><button class="pixel-btn btn-sm" data-act="inspPass">'+UT('btn.inspPass')+'</button></div>';
  }else if(e.type==='xforce'){
    line=UT('face.faceEventCard.8',{a:xName(e.name)});effect=UT('face.faceEventCard.9',{a:xName(e.name),b:e.qty});
  }else if(e.type==='xloan'){
    const O=G.xoffer;if(!O||O.cid!==e.cid||O.turn!==e.turn)return null;
    line=UT('face.faceEventCard.10',{a:fmt(O.loan),b:xName(O.name),c:O.qty});effect=UT('face.faceEventCard.11');
    buttons='<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="xoAccept">'+UT('btn.xoAccept')+'</button><button class="pixel-btn btn-sm" data-act="xoDecline">'+UT('btn.xoDecline')+'</button></div>';
  }else return null;
  return '<div class="card warn" style="display:flow-root">'+pt+'<div><b style="font-size:17px">'+esc(name)+'</b> <span class="tag gray">'+UT('face.faceEventCard.12',{a:esc(tag),b:esc(line),c:esc(effect)})+'</div>'+buttons+'</div>';
}

function showNextFaceEvent(){
  if(!G)return;
  const q=faceEventQueue();let e,h;
  while(q.length&&!h){e=q.shift();h=faceEventCard(e)}
  save();
  if(!h)return;
  INFO_AFTER=q.length?showNextFaceEvent:null;
  const title={windfall:UT('face.title'),extort:UT('face.title.2'),xforce:UT('face.title.3'),xloan:UT('face.title.4'),inspect:UT('face.title.5')}[e.type]||UT('face.faceEventCard');
  UI.showInfo(title,h);
}
/** 在旬報開啟後登記接續動作；玩家關閉旬報才開始逐件會面。 */
function armFaceEvents(){if(G&&faceEventQueue().length)INFO_AFTER=showNextFaceEvent}
ACT.faceNext=()=>UI.hideInfo();
