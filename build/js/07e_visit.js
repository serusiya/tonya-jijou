/* ═════ [07s_face_events] ═════ */
'use strict';
/* ======================= 旬報後的人物事件 =======================
 * 具名人物親自帶來的事件不能只留在旬報文字裡：旬報關閉後依序顯示頭像與對話。
 * 佇列存進 G，避免事件結算後重新整理頁面便完全遺失。 */
function faceEventQueue(){return G.faceEvents||(G.faceEvents=[])}
function queueFaceEvent(e){if(G&&e)faceEventQueue().push(e)}
/** 其他模組登記的人物事件（07zz_friends.js 等）：FACE_EXT[type](e,name)→{line,effect,buttons}；FACE_TITLE[type]＝標題文字鍵。 */
const FACE_EXT={},FACE_TITLE={};

/** 人物事件卡；官吏查貨（賄賂／公事公辦）、商人借錢（接受／婉拒）附選項，其餘事件用「知道了」接續。查貨、借錢、硬塞都只在這裡呈現，旬報不另列卡片。 */
function faceEventCard(e){
  let pt='',name='',tag='',line='',effect='',buttons=UT('face.buttons');
  if(/^branch/.test(e.type)){                     // 暖簾分（07zy_branch.js）
    const H=branchHead(e),C=H&&branchCard(e);if(!C)return null;if(e.type==='branch')BRANCH_EV=e;
    pt=H.pt;name=H.name;tag=H.tag;line=C.line;effect=C.effect;if(C.buttons)buttons=C.buttons;
  }else if(e.empId){
    const b=(G.emps||[]).find(x=>x.id===e.empId);if(!b)return null;
    pt=portraitEmp(b,56);name=b.name;tag=rankName(b.rank);
  }else{
    const n=npc(e.cid),c=CH(e.cid);if(!n||!c)return null;
    pt=portraitHtml(e.cid,56);name=c.name;tag=n.pos?posTitle(n):(ROLE_LABEL[n.role]||UT('face.faceEventCard'));
  }
  if(e.type==='windfall'){
    line=UT('face.faceEventCard.2',{a:fmt(e.amt)});effect=UT('face.faceEventCard.3',{a:fmt(e.amt)});
  }else if(e.type==='extort'){
    if(!(R(e.cid).promises||[]).some(p=>!p.done&&p.kind==='tribute'&&p.by==='official'))return null;   // 已經付了或告發了
    line=UT('face.faceEventCard.4',{a:fmt(e.amt)});effect=UT('face.faceEventCard.5');
    buttons='<div class="grid2"><button class="pixel-btn btn-sm btn-gold" data-act="faceNext">'+UT('btn.extortOk')+'</button><button class="pixel-btn btn-sm btn-red" data-act="reportExtort" data-cid="'+e.cid+'" data-face="1">'+UT('btn.reportExtort')+'</button></div>';
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
  }else if(/^branch/.test(e.type)){
  }else if(e.type==='ronin'){
    const C=roninCard(e);if(!C)return null;line=C.line;effect=C.effect;buttons=C.buttons;   // 浪人頭要錢（07zw_ronin.js）
  }else if(e.type==='staff'){
    const C=sevCard(e,name);if(!C)return null;line=C.line;effect=C.effect;buttons=C.buttons;   // 店員偶發事件（07zt_staffevents.js）
  }else if(FACE_EXT[e.type]){
    const C=FACE_EXT[e.type](e,name);if(!C)return null;line=C.line;effect=C.effect;if(C.buttons)buttons=C.buttons;
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
  UI.showInfo(faceTitle(e),h);
}
/** 在旬報開啟後登記接續動作；玩家關閉旬報才開始逐件會面。 */
function armFaceEvents(){if(G&&faceEventQueue().length)INFO_AFTER=showNextFaceEvent}
ACT.faceNext=()=>UI.hideInfo();

/* ═════ [07t_permits] ═════ */
'use strict';
/* ======================= 許可（資格）：倉地、船株、人別帳、馬幫株、帶刀、交易許可、減罪狀 =======================
 *  - 三系官署官員的一般請託都是「資格」：拿到許可才能擴充倉庫、船長、飛腳、店員、保鏢，或買賣本業最貴的兩項貨。
 *  - 許可分等級：核發官員的官階越高，給的上限越高（一～六級，核發等級＝官員官階）。取得後永久有效，只升不降。
 *  - 狀態：G.lic={wh,ship,horse,guard,staff}（已取得的等級 0～6）；G.trade＝已許可交易的貨名；G.lessen＝減罪狀張數（0／1）。 */
/** 各項許可：caps[等級]＝上限（等級 0＝未申請）。 */
const LIC={
  wh:{name:UT('lic.LIC'),caps:[1,2,3,5,8,10,12]},
  ship:{name:UT('lic.LIC.2'),caps:[1,1,2,3,4,5,6]},
  horse:{name:UT('lic.LIC.3'),caps:[1,1,2,3,4,5,6]},
  guard:{name:UT('lic.LIC.4'),caps:[1,1,2,3,4,5,6]},
  staff:{name:UT('lic.LIC.5'),caps:[{clerk:1,banto:1},{clerk:1,banto:1},{clerk:3,banto:1},{clerk:4,banto:2},{clerk:6,banto:2},{clerk:8,banto:3},{clerk:10,banto:3}]}
};
const LIC_MAX=6;
const LIC_RANK_NAME=NAMES.licRank;
/** 官員實際能核發的資格等級＝官階（最高六級）。 */
const licGrantLv=rank=>Math.min(LIC_MAX,rank);
/** 顯示含實際核發等級的資格名稱。 */
const licFavorName=(k,rank)=>UT('lic.licFavorName',{a:LIC[k].name,b:LIC_RANK_NAME[licGrantLv(rank)]});
const licOf=()=>G.lic||(G.lic={wh:0,ship:0,horse:0,guard:0,staff:0});
/** 某項許可目前的等級（0～6）。 */
const licLv=k=>Math.min(LIC_MAX,licOf()[k]||0);
/** 倉庫最多可建幾棟。 */
const whMax=()=>LIC.wh.caps[licLv('wh')];
/** 某職位的名額上限（大番頭固定 1）。 */
/** 丁稚名額（固定）。 */
const APPRENTICE_CAP=2;
function slotCap(rank){
  if(rank==='chief')return 1;
  if(rank==='apprentice')return APPRENTICE_CAP;          // 丁稚固定 2 名，開局即可招，不隨許可增加
  if(rank==='captain')return LIC.ship.caps[licLv('ship')];
  if(rank==='courier')return LIC.horse.caps[licLv('horse')];
  if(rank==='guard')return LIC.guard.caps[licLv('guard')];
  return LIC.staff.caps[licLv('staff')][rank]||1;
}
/** 取得許可：等級取較高者，回傳敘事訊息。 */
function grantLic(k,rank){
  const L=licOf(),lv=licGrantLv(rank);L[k]=Math.max(L[k]||0,lv);
  if(k==='wh')return UT('lic.grantLic',{a:whMax()});
  if(k==='ship')return UT('lic.grantLic.2',{a:slotCap('captain')});
  if(k==='horse')return UT('lic.grantLic.3',{a:slotCap('courier')});
  if(k==='guard')return UT('lic.grantLic.4',{a:slotCap('guard')});
  const s=LIC.staff.caps[licLv('staff')];return UT('lic.grantLic.5',{a:s.clerk,b:s.banto});
}

/* ---------- 交易許可：本業最貴的兩項貨 ---------- */
/** 本業需交易許可的貨：[最貴, 第二貴]。 */
function lockedTrade(sysKey){const L=commsOfSys(sysKey||G.sysKey);return L.slice().sort((a,b)=>b.base-a.base).slice(0,L.length<=3?1:2).map(c=>c.name)}   // 本業三項以下只鎖最貴的一項（酒問屋，第三百零一節）
/** 這項貨能不能交易（非本業、或不在鎖定名單、或已取得許可）。 */
function tradeOK(name){
  const c=COMM_MAP[name];if(!G||!c||c.sys!==G.sysKey)return true;
  return !lockedTrade().includes(name)||(G.trade||[]).includes(name);
}
/** 本業中目前可交易的貨。 */
const tradeComms=()=>ownComms().filter(c=>tradeOK(c.name));
/** 許可剛下來的緩衝：前幾旬不判這項貨的穩定供貨（G.tradeT[貨]＝核發的旬；第三百一十二節）。 */
const TRADE_GRACE=3;
const tradeGrace=name=>!!(G&&G.tradeT&&G.tradeT[name]!==undefined&&G.turn-G.tradeT[name]<TRADE_GRACE);
/** 開局交易許可：第六、七資源等級送所選行業第二貴貨物的許可。 */
function startTrade(sysKey,startTier){const L=lockedTrade(sysKey);return Number(startTier)>=5?[L[1]||L[0]]:[]}   // 只鎖一項的行業送那一項
/** 交易許可的請託名稱（帶上貨名）。 */
const tradeFavorName=idx=>{const n=lockedTrade()[idx];return n?UT('lic.tradeFavorName',{a:COMM_MAP[n].short}):UT('lic.posFavors.3',{a:idx?UT('lic.posFavors'):UT('lic.posFavors.2')})};
/** 尚未許可時的提示（大盤用）。 */
function tradeLockMsg(name){const i=lockedTrade().indexOf(name);return UT('lic.tradeLockMsg.3',{a:COMM_MAP[name].short,b:i===0?UT('lic.tradeLockMsg'):UT('lic.tradeLockMsg.2')})}

/* ---------- 請託共用：名稱、是否已辦妥 ---------- */
/** 把請託項目的名稱換成實際內容（交易許可帶貨名）。 */
function resolveFavor(f,n){
  if(!f)return f;
  {const x=regFavorResolve(f,n);if(x)return x}                  // 捎帶、本陣御用達：名稱帶貨名數量（07zz_regfavor.js）
  if(f.trade!==undefined)return Object.assign({},f,{name:tradeFavorName(f.trade)});
  if(f.lic&&n&&n.pos)return Object.assign({},f,{name:licFavorName(f.lic,n.pos.rank)});
  return f;
}
/** 這位官員能辦的是否已經辦妥（許可等級已不低於他能核發的、交易許可已取得、一次性地區許可已持有）。 */
function favorDone(f,n){
  if(f.lic)return licLv(f.lic)>=licGrantLv(n.pos.rank);
  if(f.trade!==undefined){const nm=lockedTrade()[f.trade];return !nm||(G.trade||[]).includes(nm)}   // 這一行沒有這一級的鎖：當作已辦妥，不列出
  if(f.once)return regionHeld(f.k,n);
  if(f.k==='firebreak')return !!G.flags.firebreak;
  return false;
}
/** 資格的下一級：比目前高、名額真的有變的第一級（船株、馬借株、帶刀、人別帳的一級與未申請相同，從二級起）；已到頂回 0（第三百二十二節）。 */
function licNextLv(k){const C=LIC[k].caps,cur=licLv(k),s=JSON.stringify(C[cur]);for(let L=cur+1;L<=LIC_MAX;L++)if(JSON.stringify(C[L])!==s)return L;return 0}
/** 不越級（第三百二十二節）：資格只能由官階剛好等於下一級的官員核發，高階官員回傳應先找的職稱；交易許可最貴那項要先有第二貴的。可辦時回 null。 */
function favorSkip(f,n){
  if(f.lic){const nx=licNextLv(f.lic);if(!nx||licGrantLv(n.pos.rank)<=nx)return null;const p=Object.values(OFF_POS).find(x=>x.court===n.pos.court&&x.rank===nx);return {need:p?p.title:''}}
  if(f.trade===0){const L=lockedTrade();if(L.length>1&&!(G.trade||[]).includes(L[1]))return {trade:L[1]}}
  return null;
}
/** 資格某一級的前一級（名額真的有變的那一級）；沒有前一級回 0。職位說明寫「不越級」用。 */
function licPrevLv(k,lv){const C=LIC[k].caps;for(let L=lv-1;L>=1;L--)if(JSON.stringify(C[L])!==JSON.stringify(C[L-1]))return L;return 0}
/** 職位說明的不越級註記：資格寫要先在哪個職位辦過上一級；最貴那項商株御免寫要先有第二貴的。沒有就回空字串。 */
function posSkipNote(f,p){
  if(f.lic){const pv=licPrevLv(f.lic,licGrantLv(p.rank));if(!pv)return '';const q=Object.values(OFF_POS).find(x=>x.court===p.court&&x.rank===pv);return q?UT('lic.posSkip',{a:q.title}):''}
  if(f.trade===0&&G&&G.sysKey&&lockedTrade().length>1)return UT('lic.posTrade');
  return '';
}
/** 同一項資格是否已有申請在審理；資格審理中時不再向其他官員重複顯示。 */
function favorPending(f){
  const L=G.apps||[];
  if(f.lic)return L.some(a=>a.state==='wait'&&a.lic===f.lic);
  if(f.trade!==undefined)return L.some(a=>a.state==='wait'&&a.trade===f.trade);
  if(f.apply)return L.some(a=>a.state==='wait'&&a.key===f.k);
  return false;
}
/** 申請獲准時的效果；不是許可類回傳 null。 */
function grantFavorApp(A){
  if(A.lic)return UT('lic.grantFavorApp',{a:licFavorName(A.lic,A.rank||2),b:grantLic(A.lic,A.rank||2)});
  if(A.key==='firebreak'){G.flags.firebreak=true;return UT('lic.grantFavorApp.2')}
  if(A.trade!==undefined){const nm=lockedTrade()[A.trade];G.trade=G.trade||[];if(!G.trade.includes(nm)){G.trade.push(nm);G.tradeT=G.tradeT||{};G.tradeT[nm]=G.turn}return UT('lic.grantFavorApp.3',{a:COMM_MAP[nm].short})}
  return null;
}

/* ---------- 已取得的資格（町奉行所面板頂端；遠國奉行所的資格另列在該面板） ---------- */
/** 資格一列：名稱靠左、名額或效果靠右。 */
const licRow=(k,v)=>'<div class="row tiny" style="margin-top:2px"><span>'+k+'</span><b>'+v+'</b></div>';
/** 町奉行所三系官署核發的資格：每項只列已取得的最高一級（名稱與請託選單一致），右邊寫這一級給的名額；交易許可各列一項；減罪狀另起一列。都沒有時寫一句提示。 */
function licCard(){
  const nm=k=>UT('lic.licFavorName',{a:LIC[k].name,b:LIC_RANK_NAME[licLv(k)]}),rows=[];
  if(licLv('wh')>0)rows.push([nm('wh'),UT('lic.licCard',{a:whMax()})]);
  if(licLv('ship')>0)rows.push([nm('ship'),UT('lic.licCard.2',{a:slotCap('captain')})]);
  if(licLv('horse')>0)rows.push([nm('horse'),UT('lic.licCard.3',{a:slotCap('courier')})]);
  if(licLv('guard')>0)rows.push([nm('guard'),UT('lic.licCard.4',{a:slotCap('guard')})]);
  if(licLv('staff')>0){const s=LIC.staff.caps[licLv('staff')];rows.push([nm('staff'),UT('lic.licCard.5',{a:s.clerk,b:s.banto})])}
  lockedTrade().slice().reverse().forEach(n=>{if((G.trade||[]).includes(n))rows.push([UT('lic.tradeFavorName',{a:COMM_MAP[n].short}),UT('lic.licCard.6')])});
  if((G.lessen||0)>0)rows.push([UT('lic.licCard.7'),UT('lic.licCard.8',{a:G.lessen})]);
  return UT('lic.licCard.10',{a:rows.length?rows.map(([k,v])=>licRow(esc(k),esc(v))).join(''):UT('lic.licCard.9')})+'</div>';
}
/** 遠國奉行所核發的資格：上級資格取代下級（朱印狀取代各地海運泊位許可、五街道通行狀取代陸運通行手形）；限期的方便另列剩餘旬數。 */
function regLicCard(){
  const P=permitsOf(),rows=[],ch=G.flags.charter||0;
  if(P.sea.all)rows.push([UT('lic.regLicCard'),UT('lic.regLicCard.2')]);
  else{const L=Object.keys(P.sea).filter(k=>k!=='all');if(L.length)rows.push([UT('lic.regLicCard.3'),L.map(REG_NAME).join(UT('lic.regLicCard.4'))])}
  if(G.flags.road||P.land.all)rows.push([UT('lic.regLicCard.5'),UT('lic.regLicCard.6')]);
  else{const L=Object.keys(P.land).filter(k=>k!=='all');if(L.length)rows.push([UT('lic.regLicCard.7'),L.map(REG_NAME).join(UT('lic.regLicCard.4'))])}
  if(ch>0)rows.push([UT('lic.regLicCard.8'),UT('lic.regLicCard.9',{a:ch})]);
  [['horse',UT('lic.regLicCard.10')],['cheap',UT('lic.regLicCard.11')],['escort',UT('lic.regLicCard.12')],['taxfree',UT('lic.regLicCard.13')],['calm',UT('lic.regLicCard.14')]].forEach(([f,n])=>{if(G.flags[f]>0)rows.push([n,UT('lic.regLicCard.15',{a:G.flags[f]})])});
  return UT('lic.licCard.10',{a:rows.length?rows.map(([k,v])=>licRow(esc(k),esc(v))).join(''):UT('lic.regLicCard.16')})+'</div>';
}

/* ---------- 職位能辦的請託（百科、職位說明用；直接取自請託表，改請託時說明自動跟著變；好感 100 的特殊請託不列） ---------- */
/** 某職位能辦的請託：三系官署看系統別與官階（限定官階的只在該階），遠國奉行所看職位。回傳 [{name,desc}]。 */
function posFavors(id){
  const p=OFF_POS[id];if(!p)return [];
  return (FAVORS[p.court]||[]).filter(f=>!(f.trade!==undefined&&G&&G.sysKey&&!lockedTrade()[f.trade])&&!f.bandit&&(!f.pos||f.pos.includes(id))&&p.rank>=f.rank&&(!f.exactRank||p.rank===f.rank)).map(f=>{
    let name=f.name;
    if(f.lic)name=licFavorName(f.lic,p.rank);
    else if(f.trade!==undefined)name=G&&G.sysKey?tradeFavorName(f.trade):UT('lic.posFavors.3',{a:f.trade?UT('lic.posFavors'):UT('lic.posFavors.2')});
    return {name,desc:f.desc||'',note:posSkipNote(f,p)};
  });
}
/** 職位說明裡的「能辦的請託」欄。 */
function posFavorsHtml(id){
  const L=posFavors(id);
  return UT('lic.posFavorsHtml.2',{a:L.length?L.map(f=>'<div style="margin-top:3px"><b>'+esc(f.name)+'</b><div class="tiny muted">'+esc(f.desc)+'</div>'+(f.note?'<div class="tiny muted">'+esc(f.note)+'</div>':'')+'</div>').join(''):UT('lic.posFavorsHtml')})+'</div>';
}

/* ═════ [07u_battle] ═════ */
'use strict';
/* ======================= 拜訪戰鬥：禮物破防、賄賂造成傷害、身份決定心防 =======================
 * 流程：1 選人物 → 2 選禮物（好感 60 以上免選）→ 3 門口動畫（只決定拒見、不在家）→ 4 對話框戰鬥 → 5 請託（官員，好感 ≥60 且打勝）。
 *  - 心防：依身份（官階一～六／非官員依角色），貪官加倍。玩家看不到數字，只看對方的台詞。
 *  - 傷害：賄賂 × 禮物倍率。好感 <60：送中軟肋 ×1、送錯 ×0.5；好感 ≥60：一律 ×1（好友不計較）。
 *  - 每回合三檔出價（心防的四分之一／一半／三倍），最多 3 回合；打穿即勝。錢一律不退。
 *  - 期待：每回合對方心裡預設一檔（依個性偏重），台詞約七成準地暗示；猜中那一回合傷害 ×1.5、好感另 +1。
 *    走完 3 回合仍未打穿、且一次都沒猜中：「什麼東西，真沒意思」，好感不加，本旬與下一旬不能拜訪（也不能派丁稚）。
 *  - 勝：好感 +10～20（基本 10＋交情 0～5＋最後一擊溢出 0～5）＋猜中次數；未打穿：依進度 +0～4＋猜中次數。
 *  - 對官員出過價：一場一次，與金額無關；一般官員與清官、貪官各加多少見 ODDS.heat（visit、visitGreedy，第二百四十三節）。
 *  - 丁稚代送禮金：只能派給好感未滿 60 的人；付中檔禮金，好感隨機 +4～8（最多補到 60），不扣行動點數、不能請託。
 *  - 狀態只在 BT（不存檔）。 */
/** 六種禮物（不花錢，只代表投其所好）：每種對應兩個軟肋；prop＝拜訪動畫用的道具樣式。 */
const GIFTS=[
  {k:'curio',name:UT('bt.GIFTS'),icon:'🖼️',prop:'antique',weak:['art','antique']},
  {k:'feast',name:UT('bt.GIFTS.2'),icon:'🍶',prop:'wine',weak:['wine','courtesan']},
  {k:'family',name:UT('bt.GIFTS.3'),icon:'🎀',prop:'wife',weak:['children','henpecked']},
  {k:'plaque',name:UT('bt.GIFTS.4'),icon:'🏷️',prop:'fame',weak:['vanity','pity']},
  {k:'amulet',name:UT('bt.GIFTS.5'),icon:'🧧',prop:'charm',weak:['faith','gambling']},
  {k:'horse',name:UT('bt.GIFTS.6'),icon:'🐎',prop:'safe',weak:['seafear','grudge']}
];
const GIFT_MAP={};GIFTS.forEach(g=>GIFT_MAP[g.k]=g);
/** 好友門檻：好感達此值，禮物倍率一律 1、官員出現請託。 */
const FRIEND_AFF=60;
/** 身份心防（兩）：官階一～六。 */
const BT_HP=[20,50,120,300,750,1800];
/** 非官員依角色對應的官階等級。 */
const BT_ROLE_TIER={guest:1,broker:1,manager:2,smuggler:2,rival:3};
/** 某人的心防。 */
function btHp(cid){
  const n=npc(cid);
  const t=n&&n.pos?n.pos.rank:(BT_ROLE_TIER[n&&n.role]||1);
  return BT_HP[clamp(t,1,6)-1]*(n&&n.pos&&officialKind(n)==='greedy'?2:1);
}
/** 三檔出價（心防的四分之一、一半、三倍，取整到 5 兩）。 */
const BT_TIER_X=[0.25,0.5,3];
function btTiers(cid){const h=btHp(cid),r=v=>Math.max(5,Math.round(v/5)*5);return BT_TIER_X.map(x=>r(h*x))}
/** 期待：各類人物心裡預設小／中／大的偏重；猜中傷害倍率；台詞暗示的準確度。 */
const BT_EXPECT_W={greedy:[20,30,50],clean:[50,35,15],plain:[30,40,30],merchant:[30,40,30]};
const BT_HIT_X=1.5,BT_HINT_ACC=0.7;
/** 人物類型（官員看貪清；非官員為 merchant）。 */
const btKind=cid=>{const n=npc(cid);return n&&n.pos?officialKind(n):'merchant'};
/** 依偏重抽這一回合的期待（0 小、1 中、2 大）。 */
function btRollExpect(cid){const w=BT_EXPECT_W[btKind(cid)];let x=rnd()*(w[0]+w[1]+w[2]);for(let i=0;i<3;i++){x-=w[i];if(x<0)return i}return 1}
/** 暗示期待的台詞：七成照實，三成指向別檔。 */
function btHint(cid,expect){const t=rnd()<BT_HINT_ACC?expect:pick([0,1,2].filter(i=>i!==expect));return btSay(cid,'hint.'+['small','mid','large'][t])}
/** 人物適用的增補句庫（身份：官階帶或商邸身分；系統別；年齡層；女性）。 */
function btGroups(cid){
  const n=npc(cid),c=CH(cid),L=LINES.battle,out=[];if(!c)return out;
  if(n&&n.pos){out.push(L.rank[n.pos.rank<=2?'low':n.pos.rank<=4?'mid':'high']);if(L.court[n.pos.court])out.push(L.court[n.pos.court])}
  else if(n&&L.role[n.role])out.push(L.role[n.role]);
  const a=ageOf(cid);out.push(L.age[a<35?'young':a<55?'prime':'old']);
  if(c.gender==='f')out.push(L.fem);
  return out;
}
/** 本場拜訪已說過的句子（每場開始時清空）與最近說過的 30 句（跨場，不存檔）。 */
const BT_USED=new Set(),BT_RECENT=[];
/** 拜訪戰鬥取句：原句與所有適用的增補句合成一池，平均抽一句。stage：openHit／openMiss／openFriend／low／mid／close／win／lose／snub／hint.small…。 */
function btSay(cid,stage,vars){
  const n=npc(cid),L=LINES.battle,at=(o,p)=>p.split('.').reduce((x,k)=>x&&x[k],o),kind=n&&n.pos?officialKind(n):'merchant';
  let pool=[].concat(['low','mid','close','win'].includes(stage)?L[stage][kind]:at(L,stage)||[]);
  btGroups(cid).forEach(g=>{const v=at(g,stage);if(Array.isArray(v))pool=pool.concat(v)});
  if(stage==='snub'){if(n&&n.pos)pool=pool.concat(L.snubX.official);else if(n&&n.role==='smuggler')pool=pool.concat(L.snubX.smuggler);if(CH(cid)&&CH(cid).gender==='f')pool=pool.concat(L.snubX.fem)}
  /* 避免重複：先排除本場已說過的句子與最近說過的 30 句；用完再放寬，至少不與上一句相同 */
  let cand=pool.filter(x=>!BT_USED.has(x)&&!BT_RECENT.includes(x));
  if(!cand.length)cand=pool.filter(x=>!BT_USED.has(x));
  if(!cand.length)cand=pool.filter(x=>x!==BT_RECENT[BT_RECENT.length-1]);
  if(!cand.length)cand=pool;
  const s=cand.length?cand[Math.floor(rnd()*cand.length)]:'';
  if(s){BT_USED.add(s);BT_RECENT.push(s);if(BT_RECENT.length>30)BT_RECENT.shift()}
  return vars?s.replace(/\{(\w+)\}/g,(m,k)=>vars[k]===undefined?m:vars[k]):s;
}
/** 是否正在氣頭上（被嫌不善言辭：本旬與下一旬不能拜訪）。 */
const snubbed=cid=>{const r=G.rel[cid];return !!(r&&r.snubUntil!==undefined&&G.turn<=r.snubUntil)};
/** 禮物倍率。 */
function btMult(cid,giftKey){
  const r=R(cid);if(r.aff>=FRIEND_AFF)return 1;
  const g=GIFT_MAP[giftKey];return g&&g.weak.includes(CH(cid).weakness)?1:0.5;
}
/** 交情（初見時的性向相容）帶來的額外好感 0～5。 */
const btBondBonus=r=>{const m=r.bond?r.bond.mult:1;return m>=3?5:m>=2?4:m>=1?2:0};
/** 禮物下拉選項（已證實的軟肋標 ⭐，並設為預設選項）。 */
function giftOptions(cid){
  const r=R(cid),w=CH(cid).weakness;
  return GIFTS.map(g=>{const hit=r.verified&&g.weak.includes(w);return '<option value="'+g.k+'"'+(hit?' selected':'')+'>'+g.icon+' '+g.name+(hit?' ⭐':'')+'</option>'}).join('');
}
/** 人物卡的拜訪區塊（已結識者）。 */
function visitRowHtml(cid){
  const r=R(cid),friend=r.aff>=FRIEND_AFF;
  let h=UT('bt.h');
  if(friend)h+=UT('bt.visitRowHtml');
  else h+=UT('bt.visitRowHtml.2',{a:giftOptions(cid)})+'</select></div>';
  const n=npc(cid);if(n&&n.pos)h+='<div class="tiny muted" style="margin-top:3px">'+(friend?UT('bt.visitRowHtml.3'):UT('bt.visitRowHtml.4'))+'</div>';
  h+='<div style="margin-top:4px;display:flex;gap:4px"><button class="pixel-btn btn-sm btn-gold" style="flex:2" data-act="visit" data-cid="'+cid+'">'+UT('btn.visit')+'</button>'+errandBtn(cid)+'</div>';
  return h;
}

/* ---------- 進度台詞 ---------- */
/** 依打掉的比例與官員類型，挑一句模糊的反應台詞。 */
function btLine(cid,ratio){
  const st=ratio>=1?'win':ratio>=0.7?'close':ratio>=0.3?'mid':'low';
  return btSay(cid,st);
}

/* ---------- 戰鬥狀態與流程 ---------- */
/** 目前進行中的拜訪戰鬥（不存檔）。 */
var BT=null;
/** 見到面後開始戰鬥。 */
function battleStart(cid,giftKey){
  BT_USED.clear();                                       // 新的一場：本場說過的句子清空
  const r=R(cid),friend=r.aff>=FRIEND_AFF,g=GIFT_MAP[giftKey];
  const mult=btMult(cid,giftKey),hit=!friend&&mult>=1;
  if(hit)r.verified=true;
  if(!friend&&g&&g.k==='plaque')G.life.charity++;
  BT={cid,gift:giftKey,mult,hp:btHp(cid),dmg:0,round:0,spent:0,heat:false,done:false,hits:0,
    open:btSay(cid,friend?'openFriend':hit?'openHit':'openMiss',{g:g?g.name:UT('bt.battleStart')}),line:''};
  BT.expect=btRollExpect(cid);BT.hint=btHint(cid,BT.expect);          // 開場就透露第一回合的期待
  musicWant('visit');                                   // 拜訪戰鬥換成《登門囃子》
  logRel(cid,friend?UT('bt.battleStart.2'):UT('bt.battleStart.5',{a:g?g.name:UT('bt.battleStart'),b:hit?UT('bt.battleStart.3'):UT('bt.battleStart.4')}));
  battleShow();
}
/** 對話框內容。 */
function battleHtml(){
  const B=BT,cid=B.cid,t=btTiers(cid),left=3-B.round;
  let h='<div style="display:flow-root">'+portraitHtml(cid,56,{blush:B.hits>=2?2:B.hits})+'<div class="small">'+esc(B.open)+'</div>'+(B.line?'<div class="small" style="margin-top:6px;color:#6b4327">'+esc(B.line)+'</div>':'')+(B.hint?'<div class="small" style="margin-top:4px;color:#5b4a70">'+esc(B.hint)+'</div>':'')+'</div>';
  h+='<div class="tiny muted" style="margin-top:6px">'+(left>=3?UT('bt.battleHtml'):left===2?UT('bt.battleHtml.2'):UT('bt.battleHtml.3'))+(B.spent?UT('bt.battleHtml.4',{a:fmt(B.spent)}):'')+'</div>';
  if(B.ordRound!==B.round){B.ordRound=B.round;B.order=stressTier()>=1?shuffle([0,1,2]):[0,1,2]}   // 疲憊以上：每回合小中大的位置打亂（07zzi_stress.js）
  const LB=[UT('bt.battleHtml.5'),UT('bt.battleHtml.6'),UT('bt.battleHtml.7')];
  h+='<div class="grid3" style="margin-top:6px;gap:4px">'+B.order.map(i=>[LB[i],i]).map(([lb,i])=>'<button class="pixel-btn btn-sm btn-gold" data-act="btOffer" data-i="'+i+'" '+(G.silver<t[i]?'disabled':'')+'>'+lb+'·'+coinHtml('silver',t[i])+'</button>').join('')+'</div>';
  h+=UT('bt.battleHtml.8');
  return h;
}
function battleShow(){UI.showInfo(UT('bt.battleShow',{a:nameOf(BT.cid)}),battleHtml())}
/** 出價一回合。 */
ACT.btOffer=el=>{
  const B=BT;if(!B||B.done)return;
  const amt=btTiers(B.cid)[+el.dataset.i];
  if(G.silver<amt){toast(MSG('buyGoods.5',{cost:fmt(amt)}));return}
  battleHit(amt,+el.dataset.i);
  if(B.dmg>=B.hp||B.round>=3)battleEnd();else{B.expect=btRollExpect(B.cid);B.hint=btHint(B.cid,B.expect);battleShow()}
};
/** 造成傷害（丁稚代送也走這裡）。 */
function battleHit(amt,tier){
  const B=BT,n=npc(B.cid),hit=tier!==undefined&&tier===B.expect;
  if(hit)B.hits++;
  payPublic('spend.bribe|'+B.cid,amt);B.spent+=amt;B.round++;B.dmg+=amt*B.mult*(hit?BT_HIT_X:1);sfx.coin();
  if(n&&n.pos&&!B.heat){B.heat=true;if(B.mode!=='report')addHeat(officialKind(n)==='greedy'?ODDS.heat.visitGreedy:ODDS.heat.visit);G.life.gold+=1}   // 風聲：拜訪官員出過價，一場一次；貪官較多；公會長報告是公務，不加
  B.line=btLine(B.cid,B.dmg/B.hp);
}
ACT.btEnd=()=>{if(BT&&!BT.done)battleEnd()};
/** 結算：好感增加；官員好感 ≥60 且打勝，進入請託。 */
function battleEnd(){
  const B=BT;if(!B||B.done)return;B.done=true;
  if(!B.errand)musicWant('market');                     // 戰鬥結束，回到主畫面配樂
  const cid=B.cid,r=R(cid),n=npc(cid),win=B.dmg>=B.hp;
  if(!win&&B.round>=3&&B.hits===0){                                 // 走完三回合、一次都沒猜中：不善言辭
    r.snubUntil=G.turn+1;r.lastOk=false;logRel(cid,UT('bt.battleEnd.2',{a:B.spent?UT('bt.battleEnd',{a:B.spent}):''}));sfx.bad();
    const ef=escortFail(cid,'snub');                                 // 同行朋友的引見落空（07zzb_escort.js）
    UI.render();refreshSheet();UI.showInfo(UT('bt.battleShow',{a:nameOf(cid)}),'<div style="display:flow-root">'+portraitHtml(cid,56,{gray:true})+'<div class="small">'+esc(btSay(cid,'snub')+ef)+'</div></div>');BT=null;return;   // 不善言辭：頭像變灰（第三百三十八節）
  }
  let gain=(win?10+btBondBonus(r)+Math.min(5,Math.floor((B.dmg-B.hp)/B.hp*10)):Math.floor(5*B.dmg/B.hp))+B.hits;
  gain=Math.max(0,Math.min(gain,100-r.aff));
  const hiOff=n&&n.pos&&n.pos.rank>=4;            // 四～六階官員：打勝知名度＝結識時的一半（0.75×官階，隨知名度遞減）
  setAff(r,clamp(r.aff+gain,0,100));r.lastOk=true;addFame(win?(hiOff?0.75*n.pos.rank:0.3):0.1,win&&hiOff?'mid':undefined);
  logRel(cid,UT('bt.battleEnd.6',{a:((win?UT('bt.battleEnd.3'):UT('bt.battleEnd.4'))+(B.spent?UT('bt.battleEnd.5',{a:B.spent}):'')),b:gain}));
  if(win)sfx.gift();
  const msg=UT('bt.msg',{a:win?btSay(cid,'win'):B.spent?btSay(cid,'lose'):TX('battle.chat'),b:gain})+friendTip(cid);   // 好感 100 的商人朋友講出官員軟肋（07zz_friends.js）
  const es=escortSettle(cid),side=es!==null?es:chanceMeetRoll(cid);   // 同行朋友引見（07zzb_escort.js）；沒有同行時擲拜訪巧遇（07zza_chancemeet.js）
  UI.render();refreshSheet();
  if(win&&n&&r.aff>=FRIEND_AFF&&reqList(cid).length){UI.showInfo(UT('bt.battleEnd.7',{a:nameOf(cid)}),side+requestHtml(cid,msg));return}
  if(side){UI.showInfo(UT('cm.title',{a:nameOf(cid)}),side+'<div style="display:flow-root">'+portraitHtml(cid,56)+'<div class="notice tiny">'+esc(msg)+'</div></div><button class="pixel-btn btn-sm" data-act="reqDone" style="margin-top:6px">'+UT('cm.ok')+'</button>');return}
  UI.hideInfo();toast(msg,4200);BT=null;
}
/* 對話框被直接關掉＝閒話告辭 */
(function(){const h=UI.hideInfo;UI.hideInfo=function(){h();if(BT&&!BT.done){battleEnd()}else if(BT&&BT.done)BT=null}})();

/* ---------- 丁稚代送禮金：手動版的大番頭問候 ---------- */
/** 丁稚代送：只能派給好感未滿 60 的人；付中檔禮金（送官員照樣加風聲），好感隨機 +4～8，最多補到 60；不扣行動點數、不能請託。 */
const ERRAND_GAIN=[4,8];
function errandVisit(cid){
  const r=R(cid),amt=btTiers(cid)[1];
  BT={cid,gift:null,mult:1,hp:btHp(cid),dmg:0,round:0,spent:0,heat:false,done:true,errand:true,open:'',line:''};
  battleHit(amt);BT=null;
  const gain=Math.max(0,Math.min(rint(ERRAND_GAIN[0],ERRAND_GAIN[1]),FRIEND_AFF-r.aff));
  setAff(r,clamp(r.aff+gain,0,100));r.lastOk=true;addFame(0.1);
  logRel(cid,UT('bt.errandVisit',{a:amt,b:gain}));
  toast(MSG('errand.done',{cid:nameOf(cid),amt:fmt(amt),gain}),4200);sfx.gift();
  UI.render();refreshSheet();
}

/* ---------- 請託（好感 ≥60 且打勝） ---------- */
/** 特殊請託只有四階以上的官員能辦。 */
const SPECIAL_RANK=4;
/** 好感 100 的特殊請託（四階以上官員，每位一次）。 */
function specialList(cid){
  const r=R(cid),n=npc(cid);if(!n||!n.pos||n.pos.rank<SPECIAL_RANK||r.aff<100||r.specialUsed)return [];
  const k=schemeKind(n),out=[];
  if(k)out.push({k:'sp_'+k,special:k,name:SCHEME[k].name,desc:NEWS('bt.specialList',{a:SCHEME[k].name,b:costTxt(k)})});
  if(n.pos.court==='finance'&&!G.tribute)out.push({k:'sp_tribute',special:'tribute',name:NEWS('bt.specialList.2'),desc:NEWS('bt.specialList.3',{a:ODDS.tribute.turns})});
  return out;
}
/** 這次可開口的請託：一般請託＋好感 100 的特殊請託。 */
function reqList(cid){
  const n=npc(cid);if(!n)return [];if(!n.pos)return dealerReqs(cid);   // 商人請託：調貨、銷貨、臨時打工、代售與脫手（07x_dealers.js）
  return favorList(cid).filter(f=>n.pos.rank>=f.rank&&!(f.apply&&(favorDone(f,n)||favorPending(f)))&&!(f.once&&regionHeld(f.k,n))&&!(f.k==='lessen'&&(G.lessen||0)>0)).filter(f=>!(f.apply&&favorSkip(f,n))).concat(foreignReg(n)?[]:specialList(cid));   // 外地官員沒有特殊請託
}
function requestHtml(cid,msg){
  const L=reqList(cid);
  return '<div style="display:flow-root">'+portraitHtml(cid,56)+'<div class="notice tiny">'+UT('bt.requestHtml.2',{a:esc(msg),b:L.map(f=>f.info?'<div class="irow" style="margin-top:4px"><b class="small">'+esc(f.name)+'</b><div class="tiny muted">'+esc(f.desc||'')+'</div></div>':'<div class="irow" style="margin-top:4px"><div class="row"><b class="small">'+esc(f.name)+'</b><button class="pixel-btn btn-sm btn-gold" data-act="reqAsk" data-cid="'+cid+'" data-k="'+UT('bt.requestHtml',{a:f.k,b:esc(f.desc||'')})+'</div></div>').join('')});
}
ACT.reqDone=()=>{BT=null;UI.hideInfo()};
/** 解仇：先挑一位仇人（在世的仇人都列出，不分城市）。 */
function reconcilePick(cid){
  const L=enemies();
  return portraitHtml(cid,56)+'<div class="notice tiny">'+esc(MSG('favor.reconcilePick'))+'</div>'+UT('bt.reconcilePick.2',{a:L.map(t=>'<div class="irow" style="margin-top:4px"><div class="row"><b class="small">'+esc(nameOf(t))+'</b><button class="pixel-btn btn-sm btn-gold" data-act="reqAsk" data-cid="'+cid+'" data-k="reconcile" data-t="'+UT('bt.reconcilePick',{a:t})).join('')});
}
/** 請託辦成後扣的好感：一般 −10、許可 −20、減罪狀 −30；特殊請託 −30。 */
const REQ_AFF={normal:10,apply:20,lessen:30,special:30};
ACT.reqAsk=el=>{
  const cid=el.dataset.cid,k=el.dataset.k,r=R(cid);BT=null;
  const sp=specialList(cid).find(x=>x.k===k);
  if(sp&&sp.special==='kessho'&&!el.dataset.t){if(G.gold<ODDS.f8.kesshoGold){toast(MSG('f8.shortGold',{a:fmt(ODDS.f8.kesshoGold)}));return}UI.showInfo(UT('f8.pickTitle',{a:nameOf(cid)}),kesshoPick(cid));return}   // 闕所：先挑對象（07zze_favor8.js）
  if(sp){
    r.specialUsed=true;setAff(r,Math.max(0,r.aff-REQ_AFF.special));logRel(cid,UT('bt.reqAsk',{a:sp.name,b:REQ_AFF.special}));
    UI.hideInfo();
    if(sp.special==='tribute')startTribute(cid);else if(sp.special==='kessho')kesshoDo(cid,el.dataset.t);else startScheme(cid);
    return;
  }
  const dm=dealerDo(cid,k);
  if(dm!==null){UI.showInfo(UT('bt.reqAsk.2',{a:nameOf(cid)}),portraitHtml(cid,56)+'<div class="notice" style="margin-top:6px">'+UT('bt.reqAsk.3',{a:esc(dm)}));sfx.coin();UI.render();refreshSheet();return}
  if(k==='reconcile'&&!el.dataset.t){UI.showInfo(UT('bt.reqAsk.4',{a:nameOf(cid)}),reconcilePick(cid));return}
  if(FAVOR_PICK[k]&&!el.dataset.t){UI.showInfo(UT('f8.pickTitle',{a:nameOf(cid)}),FAVOR_PICK[k](cid));return}   // 株札暫扣、專賣株：先挑對象（07zze_favor8.js）
  const res=doFavor(cid,k,el.dataset.t);
  UI.showInfo(UT('bt.reqAsk.2',{a:nameOf(cid)}),portraitHtml(cid,56)+'<div class="notice" style="margin-top:6px">'+UT('bt.reqAsk.3',{a:esc(res.msg)}));
  if(res.status==='done')sfx.coin();else sfx.bad();UI.render();refreshSheet();
};

/* ═════ [07v_party] ═════ */
'use strict';
/* ======================= 忘年會：每年最後一旬結束時，在大廣間設宴 =======================
 *  - 年度大事簿 G.yearLog：pushNews 時依【標籤】自動分類記下（天災、行情、官場、商號、家族、風波），新年清空。
 *  - 年底（進入新年那一刻）建立 G.party：入席名單、對話、效果，並立刻結算效果；旬報關閉後開視窗演出，看完即刪。
 *  - 入席：主角（上座）＋夫人、側室、子女各 1 人＋各職位店員各 1 人＋本城交情 80 以上的友人（越多來越多，坐滿 30 席為止；
 *    不足時以交情最高的熟人補到 2～3 人）。坐不滿的坐墊留空。
 *  - 效果：宴席費每人 5 兩（現款）；出席友人好感 +2、出席店員好感 +3。主角遠島中則停辦。 */
const PARTY_SEATS=30,PARTY_FEE=5,PARTY_FRIEND_AFF=80,PARTY_GAIN={friend:2,staff:3};
const PARTY_EMP_SEAT={chief:8800,banto:8400,captain:8000,courier:7900,guard:7800,clerk:7600,apprentice:7200};
/** 忘年會座次：家人居前，其次是高位官員與核心員工，其他熟人依好感排列。 */
function partySeatImportance(a){
  if(a.kind==='wife')return 10000;
  if(a.kind==='conc')return 9800;
  if(a.kind==='kid')return 9600;
  if(a.kind==='friend'){
    const n=npc(a.cid),r=G.rel[a.cid];
    return n&&n.pos?9000+n.pos.rank*100+(r?r.aff:0):6000+(r?r.aff:0);
  }
  if(a.kind==='emp')return PARTY_EMP_SEAT[a.rank]||7000;
  return 0;
}
/** pushNews 時呼叫：依新聞鍵的分類（01g_news.js 的 NEWS_CAT）記進今年的大事簿（最多 80 筆）；不在表內的不記。
 *  tag＝新聞鍵：同一種新聞盡量只談一次。 */
function yearLogAdd(t,key){
  if(!G||!t)return;const k=key||newsKey(t),cat=k&&NEWS_CAT_OF[k];if(!cat)return;
  const L=G.yearLog||(G.yearLog=[]);L.push({cat,tag:k,k,t:partyGist(t),m:G.month});if(L.length>80)L.shift();
}
/** 新聞去掉圖示與標籤，取一段可以說出口的話（最多約 44 字）。 */
function partyGist(t){let s=String(t).replace(NEWS_FMT.head,'').replace(NEWS_FMT.paren,'').trim();if(s.length>44)s=s.slice(0,43)+'……';return s}

/* ---------- 年底建立 ---------- */
/** 年底呼叫（advanceTurn 進入新年時，於 yearTick 之前）：建立忘年會並結算效果。 */
function yearEndParty(log){
  const year=G.year-1,L=G.yearLog||[],s0=G.yearSilver0===undefined?G.silver:G.yearSilver0;
  G.yearLog=[];G.yearSilver0=G.silver;
  if((G.exile||0)>0||G.ended){const t=NEWS('party.skip');pushNews(t);log.push(t);return}
  const att=[];                                                       // {kind,cid?,empId?,label,look}
  if(G.family.spouse)att.push({kind:'wife',label:UT('party.yearEndParty',{a:G.family.spouse.name}),look:{cloth:'#c46a8a',cloth2:'#e0b030',woman:true}});
  if((G.family.conc||[]).length){const x=pick(G.family.conc);att.push({kind:'conc',cid:x.cid,label:UT('party.yearEndParty.2',{a:x.name}),look:{cloth:'#d46a9a',cloth2:'#f0c040',woman:true}})}
  if(G.family.kids.length){const k=pick(G.family.kids);att.push({kind:'kid',label:UT('party.yearEndParty.3',{a:k.name}),look:{cloth:k.gender==='f'?'#e07a9a':'#5a9bd0',cloth2:'#f4ece1',small:true,noKnot:true}})}
  const staff=[];[...RANKS,...SPECIAL].forEach(rk=>{const l=G.emps.filter(e=>e.rank===rk);if(l.length){const e=pick(l);staff.push(e);att.push({kind:'emp',rank:rk,empId:e.id,cid:e.cid||null,label:UT('party.yearEndParty.4',{a:rankName(rk),b:e.name}),look:RANK_LOOK[rk]||RANK_LOOK['clerk']})}});
  const room=PARTY_SEATS-att.length;
  const ok=cid=>{const n=npc(cid),r=G.rel[cid];return n&&r&&r.bond&&alive(cid)&&n.cityId===G.cityId&&!(touring(n)&&!tourHere(n,12))&&!isEnemy(cid)&&!G.emps.some(e=>e.cid===cid)&&n.role!=='oiran'};
  let friends=shuffle(Object.keys(G.rel).filter(cid=>ok(cid)&&G.rel[cid].aff>=PARTY_FRIEND_AFF)).filter(()=>chance(0.85)).slice(0,room);
  const minF=Math.min(room,rint(2,3));
  if(friends.length<minF){const more=Object.keys(G.rel).filter(cid=>ok(cid)&&!friends.includes(cid)).sort((a,b)=>G.rel[b].aff-G.rel[a].aff).slice(0,minF-friends.length);friends=friends.concat(more)}
  friends.sort((a,b)=>((npc(b).pos?npc(b).pos.rank:0)-(npc(a).pos?npc(a).pos.rank:0))||G.rel[b].aff-G.rel[a].aff);
  friends.forEach(cid=>{const n=npc(cid);att.push({kind:'friend',cid,label:nameOf(cid)+(n.pos?UT('party.yearEndParty.5',{a:posTitle(n)}):''),look:hostLook(cid),off:!!n.pos})});
  att.sort((a,b)=>partySeatImportance(b)-partySeatImportance(a));
  /* 效果 */
  const cost=Math.min(Math.max(0,Math.round(G.silver)),att.length*PARTY_FEE);
  if(cost>0){G.silver-=cost;if(TURNRP){TURNRP.inTurn=TURNRP.inTurn||{};TURNRP.inTurn['spend.party']=(TURNRP.inTurn['spend.party']||0)+cost}}   // 推進途中付的錢記在本旬（不放進 G.publicSpend，以免下一旬重複計入）
  friends.forEach(cid=>{const r=R(cid);setAff(r,clamp(r.aff+PARTY_GAIN.friend,0,100));logRel(cid,UT('party.yearEndParty.6',{a:PARTY_GAIN.friend}))});
  staff.forEach(e=>{e.aff=Math.min(100,empAff(e)+PARTY_GAIN.staff)});
  const lines=partyLines(att,L,G.silver-s0);
  /* 巡迴在外的高官好友：不出席，託人送來賀禮（好感照加） */
  const gifts=Object.keys(G.rel).filter(cid=>{const n=npc(cid),r=G.rel[cid];return n&&r&&r.bond&&alive(cid)&&touring(n)&&!tourHere(n,12)&&!isEnemy(cid)&&r.aff>=PARTY_FRIEND_AFF});
  gifts.forEach(cid=>{const r=R(cid);setAff(r,clamp(r.aff+PARTY_GAIN.friend,0,100));logRel(cid,UT('party.yearEndParty.7',{a:PARTY_GAIN.friend}))});
  if(gifts.length)lines.splice(lines.length-1,0,{who:-1,t:TX('party.gift',{n:gifts.slice(0,2).map(nameOf).join(UT('party.yearEndParty.8'))+(gifts.length>2?UT('party.yearEndParty.9',{a:gifts.length}):'')})});
  G.party={year,att,lines,cost,nf:friends.length,ns:staff.length};
  const t=NEWS('party.held',{year:yearStr(year),n:att.length});pushNews(t);log.push(t);
}
/** 編排對話：主角開場（依年度盈虧與災禍）→ 6～8 則大事（由合適的人說）→ 主角收尾。 */
function partyLines(att,L,net){
  const out=[],host={host:true,label:G.me.name};
  const bad=L.filter(x=>x.cat==='disaster'||x.cat==='trouble').length;
  out.push({who:-1,t:TX(net>0&&bad<=2?'party.open.good':bad>=4||net<0?'party.open.hard':'party.open.plain')});
  /* 挑話題：每類先取一件，再隨機補足 */
  const byCat={};L.forEach(x=>(byCat[x.cat]=byCat[x.cat]||[]).push(x));
  let topics=[];Object.keys(byCat).forEach(k=>topics.push(pick(byCat[k])));
  const tags=new Set(topics.map(x=>x.tag));                              // 同一種標籤的大事盡量只談一次
  shuffle(L.filter(x=>!topics.includes(x))).forEach(x=>{if(!tags.has(x.tag)){tags.add(x.tag);topics.push(x)}});
  topics=shuffle(topics.slice(0,Object.keys(byCat).length)).concat(topics.slice(Object.keys(byCat).length)).slice(0,rint(6,8));
  const used={};                                                         // 同一人盡量只說一次
  const speakerFor=cat=>{
    const pref={disaster:['emp:guard','emp:banto','friend'],trouble:['emp:chief','friend','emp:banto'],official:['friend:off','emp:chief','friend'],market:['emp:banto','emp:clerk','friend'],family:['wife','conc','friend'],firm:['emp:chief','emp:clerk','emp:apprentice']}[cat]||['friend'];
    for(const p of pref){const [k,sub]=p.split(':');const c=att.map((a,i)=>({a,i})).filter(({a,i})=>!used[i]&&a.kind===k&&(!sub||(k==='emp'?a.rank===sub:a.off)));if(c.length)return pick(c).i}
    const free=att.map((a,i)=>i).filter(i=>!used[i]&&att[i].kind!=='kid');
    return free.length?pick(free):att.length?Math.floor(rnd()*att.length):-1;
  };
  topics.forEach(x=>{
    const ci=att.findIndex(a=>a.rank==='captain'),fi=att.findIndex(a=>a.rank==='courier');
    const i=NEWS_SEA_SET.has(x.k)&&ci>=0&&!used[ci]?ci:NEWS_LAND_SET.has(x.k)&&fi>=0&&!used[fi]?fi:speakerFor(x.cat);
    used[i]=1;
    out.push({who:i,t:TX('party.pre.'+x.cat)+x.t+TX('party.post.'+x.cat)});
  });
  if(topics.length<4)for(let k=topics.length;k<4;k++){const i=att.length?Math.floor(rnd()*att.length):-1;out.push({who:i,t:TX('party.idle')})}
  const kid=att.findIndex(a=>a.kind==='kid');if(kid>=0)out.splice(Math.min(out.length,2+Math.floor(rnd()*3)),0,{who:kid,t:TX('party.kid')});
  out.push({who:-1,t:TX('party.close')});
  return out;
}

/* ---------- 演出 ---------- */
var PARTY_VIEW=null;
/** 旬報關閉後呼叫：打開忘年會視窗（看完即刪除 G.party）。 */
function showParty(){
  const P=G&&G.party;if(!P)return;delete G.party;save();
  PARTY_VIEW={P,i:0};
  INFO_AFTER=faceEventQueue().length?showNextFaceEvent:null;          // 散會後接著顯示人物事件
  partyRender();
}
function partySeats(){
  const s=[];
  /* 主桌在前方中央；每排先放靠中央走道的左右席，再放外側席，逐排向後填滿。 */
  for(let row=0;row<8;row++){
    const y=66+row*14;
    [[122,y],[198,y],[72,y],[248,y]].forEach(p=>s.push(p));
  }
  return s.slice(0,PARTY_SEATS);
}
function partyRender(){
  const V=PARTY_VIEW;if(!V)return;const P=V.P,L=P.lines[V.i],att=P.att;
  const sp=L.who>=0?att[L.who]:null;
  const who=sp?sp.label:UT('party.who',{a:G.me.name});
  const pt=sp&&sp.cid?portraitHtml(sp.cid,48):sp&&sp.empId?portraitEmp(G.emps.find(e=>e.id===sp.empId)||{id:sp.empId,rank:sp.rank,stats:{}},48):'';
  const last=V.i>=P.lines.length-1;
  let h='<canvas id="party-cv" width="320" height="180" style="width:100%;image-rendering:pixelated;background:#3b2a1e;cursor:pointer" data-act="partyNext"></canvas>';
  h+='<div class="card" style="display:flow-root;margin-top:6px">'+pt+'<div class="tiny muted">'+esc(who)+'</div><div class="small" style="margin-top:3px">'+esc(L.t)+'</div></div>';
  if(last)h+='<div class="notice tiny" style="margin-top:4px">'+esc(MSG('party.effect',{cost:fmt(P.cost),f:P.nf,s:P.ns,fg:PARTY_GAIN.friend,sg:PARTY_GAIN.staff}))+'</div>';
  h+=UT('party.partyRender.2',{a:att.length,b:PARTY_SEATS})+'</span><span>'+UT('party.partyRender.3',{a:last?'':UT('party.partyRender')});
  UI.showInfo(UT('party.partyRender.4',{a:yearStr(P.year)}),h);
  partyDraw();
}
ACT.partyNext=()=>{const V=PARTY_VIEW;if(!V)return;if(V.i<V.P.lines.length-1){V.i++;sfx.tap();partyRender()}else ACT.partyEnd()};
ACT.partyEnd=()=>{PARTY_VIEW=null;UI.hideInfo()};
/** 畫大廣間：紙拉門、壁龕掛軸、榻榻米、ㄈ字形三十席；說話的人頭上有對話泡泡。 */
function partyDraw(){
  const cv=$('#party-cv'),V=PARTY_VIEW;if(!cv||!V)return;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
  const P=V.P,L=P.lines[V.i];
  R_(c,0,0,320,180,'#d8c79a');                                          // 榻榻米底
  for(let y=40;y<180;y+=20)for(let x=0;x<320;x+=40){R_(c,x,y,40,1,'#a8955f');R_(c,x+((y/20)%2?20:0),y,1,20,'#a8955f')}
  R_(c,0,0,320,38,'#efe6cf');for(let x=0;x<320;x+=16){R_(c,x,0,1,38,'#7a5a3a')}R_(c,0,12,320,1,'#7a5a3a');R_(c,0,25,320,1,'#7a5a3a');R_(c,0,36,320,3,'#5a3a22');
  R_(c,140,2,40,34,'#c9b48a');R_(c,152,5,16,26,'#f4ece1');R_(c,155,9,10,16,'#3b2a1e');R_(c,140,34,40,3,'#5a3a22');   // 壁龕與掛軸
  R_(c,184,24,8,10,'#2f5d3a');R_(c,186,20,4,6,'#e07a9a');                // 生花
  /* 和室上座：中央半幅容納床之間、掛軸、花入、障子窗與櫃體；左右保留素牆。 */
  R_(c,0,0,320,48,'#ddd6c5');
  R_(c,80,4,90,40,'#777b63');
  R_(c,80,3,160,5,'#855d36');R_(c,80,3,4,45,'#6e492b');R_(c,168,3,5,45,'#6e492b');R_(c,236,3,4,45,'#6e492b');
  R_(c,84,42,84,6,'#28231d');R_(c,86,42,80,2,'#b28a52');
  R_(c,96,7,24,32,'#b59a75');R_(c,99,5,18,31,'#eee8d8');R_(c,99,5,18,3,'#c9b48a');R_(c,97,35,22,3,'#b18b60');
  c.fillStyle='#30271f';c.font='7px DotGothic16,monospace';c.textBaseline='top';c.fillText('壽',104,10);c.fillText('福',104,18);c.fillText('招',104,26);
  R_(c,146,34,9,8,'#c6a36e');R_(c,148,31,5,4,'#e0c58f');R_(c,150,23,1,9,'#365b39');R_(c,146,27,1,6,'#365b39');R_(c,154,26,1,6,'#365b39');
  R_(c,144,24,5,3,'#e6d9a2');R_(c,152,22,5,3,'#d98282');R_(c,148,20,4,3,'#eee4b7');
  R_(c,178,12,54,25,'#f0eee2');R_(c,178,12,54,3,'#65462d');R_(c,178,34,54,3,'#65462d');R_(c,178,12,3,25,'#65462d');R_(c,229,12,3,25,'#65462d');
  for(let x=193;x<229;x+=13)R_(c,x,15,1,19,'#9b8569');for(let y=21;y<34;y+=7)R_(c,181,y,48,1,'#9b8569');
  R_(c,174,37,62,11,'#c8b895');R_(c,174,37,62,2,'#6e492b');R_(c,174,47,62,1,'#6e492b');R_(c,204,39,1,8,'#8c7658');R_(c,200,41,2,1,'#5a4632');R_(c,208,41,2,1,'#5a4632');
  R_(c,0,46,320,3,'#5a3a22');
  const seats=partySeats();
  const sitAt=(x,y,look,speak)=>{
    R_(c,x-7,y-3,14,6,'#8b2c3a');                                       // 坐墊
    if(look){drawPerson(c,x,y,Object.assign({frame:0},look));R_(c,x-7,y-4,14,5,'#8b2c3a')}
    R_(c,x-5,y+3,10,3,'#2a1a12');R_(c,x-3,y+2,2,1,'#e8dcc4');R_(c,x+1,y+2,2,1,'#c0392b');   // 膳台
    if(speak){R_(c,x-9,y-30,18,9,'#fffef8');R_(c,x-1,y-21,3,2,'#fffef8');c.fillStyle='#3b2a1e';c.font='8px DotGothic16,monospace';c.textBaseline='top';c.fillText('…',x-4,y-31)}
  };
  sitAt(160,50,{cloth:'#1e2d4a',cloth2:'#e8dcc4',gold:true,hair:(myAge()>=55)?'#c8c8c8':'#1a1612'},L.who===-1);   // 上座：主人
  R_(c,152,53,16,2,'#e5a93b');
  seats.forEach((p,i)=>{const a=P.att[i];sitAt(p[0],p[1],a?a.look:null,a&&L.who===i)});
}

/* ═════ [07w_music] ═════ */
'use strict';
/* ======================= 配樂：江戶風 WebAudio 音序器 =======================
 *  - 不用任何音檔：樂曲存成音符表 [MIDI 音高, 起始拍, 拍長, 樂器, 音量(可省略＝1)]（音高 0＝休止），即時合成。
 *  - 樂器：koto 箏、kotoLow 低音箏、shami 三味線、fue 笛、taiko 大太鼓、shime 締太鼓、ka 鼓邊、kane 鉦。
 *  - 曲目：market《市井囃子》（主畫面，陽音階）、visit《登門囃子》（拜訪戰鬥，都節音階）、title《暖簾囃子》（人生終章，箏引子＋兩首動機）、trip《道中囃子》（外城出遊，G 調陽音階、跳步節奏、伴奏減半）；皆依祭典囃子形式編排，非特定曲目。
 *  - 播放採預排：每 25 毫秒把接下來 0.25 秒內的音符排進時間軸，循環播放；換曲時淡出淡入。
 *  - 設定（音樂開關、音效開關、人聲開關〔07w2_voice〕、音量）存在本機瀏覽器（AUDIO_KEY），屬個人偏好，不寫進存檔。
 *  - 手機瀏覽器要在使用者點擊之後才能出聲：開局／繼續人生時開始播放，之後任何點擊都會喚醒。 */
const AUDIO_KEY='tonya_jijou_audio';
/** 音訊設定：music 音樂開關、sfx 音效開關、vol 音量 0～100。 */
const AUDIO={music:true,sfx:true,vol:60};
try{Object.assign(AUDIO,JSON.parse(localStorage.getItem(AUDIO_KEY)||'{}'))}catch(e){}
function audioSave(){try{localStorage.setItem(AUDIO_KEY,JSON.stringify(AUDIO))}catch(e){}}
/** 音量曲線（滑桿 0～100 → 增益）。 */
const audioGain=()=>Math.pow(AUDIO.vol/100,1.6);
/** 套用設定到音效（01_core 的 soundOn／SFX_VOL）。 */
function audioApply(){soundOn=AUDIO.sfx;SFX_VOL=audioGain()/Math.pow(0.6,1.6);if(MUS.out&&AC)MUS.out.gain.setTargetAtTime(AUDIO.music?audioGain()*0.55:0.0001,AC.currentTime,0.08)}

const MUS={out:null,play:null,key:null,want:null,noise:null};
const mtof=m=>440*Math.pow(2,(m-69)/12);
function musOut(){if(!AC)return null;if(!MUS.out){MUS.out=AC.createGain();MUS.out.gain.value=0.0001;MUS.out.connect(AC.destination)}return MUS.out}
function musNoise(){if(MUS.noise)return MUS.noise;const n=AC.sampleRate*0.5,b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return MUS.noise=b}
/** 一個音：依樂器組合振盪器與音量包絡。 */
function musVoice(inst,midi,t,dur,vol){
  const made=[],K=n=>{made.push(n);return n};       // 這個音用到的聲音元件；全部播完後一起斷開，讓瀏覽器回收（Safari 不斷開會越積越多）
  const out=K(AC.createGain());if(vol!==undefined&&vol!==1){const vg=K(AC.createGain());vg.gain.value=vol;out.connect(vg);vg.connect(MUS.out)}else out.connect(MUS.out);   // vol：音符表第五欄，伴奏減量用
  const env=(g,a,peak,decay,sustain,rel)=>{g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(Math.max(0.0001,peak*sustain),t+a+decay);g.gain.exponentialRampToValueAtTime(0.0001,t+Math.max(dur,a+decay)+rel)};
  const osc=(type,f,det)=>{const o=K(AC.createOscillator());o.type=type;o.frequency.setValueAtTime(f,t);if(det)o.detune.value=det;return o};
  if(inst==='koto'||inst==='kotoLow'){
    const f=mtof(midi),lp=K(AC.createBiquadFilter());lp.type='lowpass';lp.frequency.setValueAtTime(inst==='koto'?4200:1600,t);lp.frequency.exponentialRampToValueAtTime(inst==='koto'?900:400,t+0.6);lp.connect(out);
    const a=osc('triangle',f),b=osc('square',f,7),c=osc('sine',f*2),gb=K(AC.createGain()),gc=K(AC.createGain());gb.gain.value=0.18;gc.gain.value=0.25;
    a.connect(lp);b.connect(gb);gb.connect(lp);c.connect(gc);gc.connect(lp);
    env(out,0.004,inst==='koto'?0.42:0.3,inst==='koto'?0.9:1.2,0.05,0.4);[a,b,c].forEach(o=>{o.start(t);o.stop(t+dur+1.6)});
  }else if(inst==='shami'){
    const f=mtof(midi),bp=K(AC.createBiquadFilter());bp.type='bandpass';bp.frequency.value=f*3;bp.Q.value=1.2;bp.connect(out);
    const a=osc('sawtooth',f),b=osc('square',f*2.01),gb=K(AC.createGain());gb.gain.value=0.3;a.connect(bp);b.connect(gb);gb.connect(bp);
    env(out,0.002,0.55,0.18,0.02,0.08);[a,b].forEach(o=>{o.start(t);o.stop(t+dur+0.5)});
  }else if(inst==='fue'){
    const f=mtof(midi),a=osc('sine',f),b=osc('triangle',f*2),gb=K(AC.createGain());gb.gain.value=0.12;
    const lfo=K(AC.createOscillator()),lg=K(AC.createGain());lfo.frequency.value=5.5;lg.gain.setValueAtTime(0,t);lg.gain.linearRampToValueAtTime(f*0.012,t+Math.min(0.35,dur*0.6));lfo.connect(lg);lg.connect(a.frequency);lg.connect(b.frequency);
    a.connect(out);b.connect(gb);gb.connect(out);
    const n=K(AC.createBufferSource());n.buffer=musNoise();const nf=K(AC.createBiquadFilter());nf.type='bandpass';nf.frequency.value=f*2;nf.Q.value=2;const ng=K(AC.createGain());ng.gain.value=0.025;n.connect(nf);nf.connect(ng);ng.connect(out);
    out.gain.setValueAtTime(0.0001,t);out.gain.linearRampToValueAtTime(0.26,t+0.05);out.gain.setValueAtTime(0.24,t+Math.max(0.06,dur-0.06));out.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.12);
    [a,b,lfo].forEach(o=>{o.start(t);o.stop(t+dur+0.2)});n.start(t);n.stop(t+dur+0.2);
  }else if(inst==='taiko'){
    const a=osc('sine',110);a.frequency.exponentialRampToValueAtTime(48,t+0.25);a.connect(out);
    const n=K(AC.createBufferSource());n.buffer=musNoise();const lp=K(AC.createBiquadFilter());lp.type='lowpass';lp.frequency.value=320;const ng=K(AC.createGain());ng.gain.setValueAtTime(0.5,t);ng.gain.exponentialRampToValueAtTime(0.001,t+0.12);n.connect(lp);lp.connect(ng);ng.connect(out);
    out.gain.setValueAtTime(0.9,t);out.gain.exponentialRampToValueAtTime(0.0001,t+0.5);a.start(t);a.stop(t+0.55);n.start(t);n.stop(t+0.2);
  }else if(inst==='shime'){
    const a=osc('triangle',330);a.frequency.exponentialRampToValueAtTime(220,t+0.06);a.connect(out);
    out.gain.setValueAtTime(0.35,t);out.gain.exponentialRampToValueAtTime(0.0001,t+0.12);a.start(t);a.stop(t+0.15);
  }else if(inst==='ka'){
    const n=K(AC.createBufferSource());n.buffer=musNoise();const hp=K(AC.createBiquadFilter());hp.type='highpass';hp.frequency.value=2500;n.connect(hp);hp.connect(out);
    out.gain.setValueAtTime(0.22,t);out.gain.exponentialRampToValueAtTime(0.0001,t+0.05);n.start(t);n.stop(t+0.06);
  }else if(inst==='kane'){
    const hp=K(AC.createBiquadFilter());hp.type='highpass';hp.frequency.value=1800;hp.connect(out);
    const a=osc('square',2240),b=osc('square',3170,9);a.connect(hp);b.connect(hp);
    out.gain.setValueAtTime(0.07,t);out.gain.exponentialRampToValueAtTime(0.0001,t+0.22);a.start(t);b.start(t);a.stop(t+0.25);b.stop(t+0.25);
  }
  const src=made.filter(n=>typeof n.stop==='function');let left=src.length;
  src.forEach(n=>{n.onended=()=>{if(--left>0)return;made.forEach(x=>{try{x.disconnect()}catch(e){}})}});
}

/* ======================= 曲目 ======================= */
/** 《市井囃子》（主畫面）：陽音階，D 調，前後兩段十六小節。 */
function songMarket(){
  const D3=50,G3=55,D4=62,E4=64,G4=67,A4=69,B4=71,D5=74,E5=76,G5=79,A2=45;
  const notes=[],mel=[
    [[D5,.5],[E5,.5],[D5,1],[B4,1],[A4,1]],[[G4,1],[A4,.5],[B4,.5],[A4,2]],
    [[D5,.5],[E5,.5],[G5,1],[E5,1],[D5,1]],[[B4,1],[D5,1],[E5,2]],
    [[G5,1],[E5,.5],[D5,.5],[B4,1],[D5,1]],[[E5,1],[D5,.5],[B4,.5],[A4,2]],
    [[G4,.5],[A4,.5],[B4,1],[A4,.5],[G4,.5],[E4,1]],[[D4,2],[0,2]],
    [[A4,1],[B4,1],[D5,1],[B4,1]],[[A4,.5],[G4,.5],[E4,1],[G4,2]],
    [[A4,1],[B4,1],[D5,.5],[E5,.5],[D5,1]],[[B4,3],[0,1]],
    [[E5,.5],[G5,.5],[E5,.5],[D5,.5],[B4,1],[D5,1]],[[E5,1],[G5,1],[E5,2]],
    [[D5,.5],[B4,.5],[A4,1],[G4,.5],[A4,.5],[B4,1]],[[D5,2],[0,2]]
  ];
  const root=[D3,G3,D3,A2,D3,G3,D3,D3, A2,G3,A2,D3,G3,A2,G3,D3];
  mel.forEach((bar,i)=>{
    const b=i*4;let x=b;
    bar.forEach(([m,d])=>{if(m)notes.push([m,x,d,'fue']);x+=d});
    const r=root[i];[r,r+7,r+12,r+7,r,r+7,r+12,r+7].forEach((m,k)=>notes.push([m,b+k*0.5,0.5,'shami']));
    if(i%8===7){[0,0.5,1,1.5,2,2.5,2.75,3,3.25,3.5,3.75].forEach(o=>notes.push([0,b+o,1,o<2?'taiko':'shime']));notes.push([0,b,1,'kane'])}
    else{[0,2,2.5].forEach(o=>notes.push([0,b+o,1,'taiko']));[1,3,3.5].forEach(o=>notes.push([0,b+o,1,'ka']));[0,1,2,3].forEach(o=>notes.push([0,b+o,1,'kane']));[0.5,1.5,2.5,3.5].forEach(o=>notes.push([0,b+o,1,'shime']))}
  });
  return {bpm:132,len:64,notes};
}
/** 《登門囃子》（拜訪戰鬥）：都節音階，D 調，八小節，帶一點緊張感。 */
function songVisit(){
  const D3=50,A3=57,D4=62,Eb4=63,G4=67,A4=69,Bb4=70,D5=74,C5=72;
  const notes=[];
  for(let bar=0;bar<8;bar++){
    const b=bar*4;
    if(bar<7){notes.push([0,b,1,'taiko'],[0,b+0.5,1,'ka'],[0,b+2,1,'taiko'],[0,b+3,1,'ka'],[0,b+3.5,1,'ka']);[0.5,1.5,2.5,3.5].forEach(o=>notes.push([0,b+o,1,'shime']))}
    else [0,0.5,1,1.5,2,2.25,2.5,2.75,3,3.25,3.5,3.75].forEach(o=>notes.push([0,b+o,1,o<2?'taiko':'shime']));
    const ost=bar%4===3?[D3,A3,D4,A3,Eb4,D4,A3,D4]:[D3,A3,D4,A3,Eb4,A3,D4,A3];
    ost.forEach((m,k)=>notes.push([m,b+k*0.5,0.5,'shami']));
  }
  [[A4,0,1],[Bb4,1,.5],[A4,1.5,.5],[G4,2,1],[Eb4,3,1],[D4,4,3],[G4,8,1],[A4,9,1],[Bb4,10,1],[D5,11,1],[A4,12,3],
   [D5,16,1],[C5,17,.5],[Bb4,17.5,.5],[A4,18,1],[Bb4,19,1],[A4,20,1],[G4,21,1],[Eb4,22,1],[G4,23,1],[A4,24,1.5],[G4,25.5,.5],[Eb4,26,1],[D4,27,1],[D4,28,3.5]]
   .forEach(([m,s,d])=>notes.push([m,s,d,'fue']));
  return {bpm:112,len:32,notes};
}
/** 《暖簾囃子》（片頭，人生終章）：D 調，十六小節。
 *  1～4 小節：箏獨奏引子（陽音階）；5～8：笛入，放慢的《市井囃子》開頭動機；
 *  9～12：借《登門囃子》的都節色彩（降 E、降 B），三味線頑固低音，略帶緊張；
 *  13～16：回到陽音階，全員齊奏收束，末小節太鼓連打，接回開頭循環。 */
function songTitle(){
  const A2=45,D3=50,E3=52,G3=55,A3=57,B3=59,D4=62,Eb4=63,E4=64,G4=67,A4=69,Bb4=70,B4=71,C5=72,D5=74,E5=76,G5=79,A5=81;
  const notes=[],N=(m,s,d,i)=>notes.push([m,s,d,i]);
  // 1～4：箏引子（分散和弦，低音箏打根音）
  const intro=[[D4,A4,D5,E5,D5,A4,G4,A4],[B3,G4,B4,D5,B4,A4,G4,E4],[A3,E4,A4,B4,A4,G4,E4,D4],[D4,A4,D5,G5,E5,D5,B4,A4]];
  intro.forEach((arp,bar)=>{const b=bar*4;arp.forEach((m,k)=>N(m,b+k*0.5,0.6,'koto'));N([D3,G3,A2,D3][bar],b,4,'kotoLow')});
  N(0,0,1,'kane');N(0,12,1,'taiko');N(0,14,1,'taiko');N(0,15,1,'taiko');N(0,15.5,1,'taiko');
  // 5～8：笛奏放慢的《市井囃子》動機，箏伴奏
  [[D5,16,.5],[E5,16.5,.5],[D5,17,1],[B4,18,1],[A4,19,1],[G4,20,1],[A4,21,.5],[B4,21.5,.5],[A4,22,2],
   [D5,24,.5],[E5,24.5,.5],[G5,25,1],[E5,26,1],[D5,27,1],[B4,28,1],[D5,29,1],[E5,30,2]].forEach(([m,s,d])=>N(m,s,d,'fue'));
  [[D3,A3,D4,A3],[G3,D4,G4,D4],[D3,A3,D4,A3],[A2,E3,A3,E3]].forEach((r,i)=>{const b=16+i*4;r.forEach((m,k)=>N(m,b+k,1,'kotoLow'))});
  for(let b=16;b<32;b+=4){N(0,b,1,'taiko');N(0,b+2,1,'ka');N(0,b,1,'kane');N(0,b+2,1,'kane')}
  // 9～12：都節色彩，三味線頑固低音
  for(let bar=8;bar<12;bar++){const b=bar*4;
    (bar===11?[D3,A3,D4,A3,Eb4,D4,A3,D4]:[D3,A3,D4,A3,Eb4,A3,D4,A3]).forEach((m,k)=>N(m,b+k*0.5,0.5,'shami'));
    N(0,b,1,'taiko');N(0,b+0.5,1,'ka');N(0,b+2,1,'taiko');N(0,b+3,1,'ka');[0.5,1.5,2.5,3.5].forEach(o=>N(0,b+o,1,'shime'))}
  [[A4,32,1],[Bb4,33,.5],[A4,33.5,.5],[G4,34,1],[Eb4,35,1],[D4,36,3],[G4,40,1],[A4,41,1],[Bb4,42,1],[D5,43,1],[C5,44,1],[Bb4,45,1],[A4,46,2]].forEach(([m,s,d])=>N(m,s,d,'fue'));
  // 13～16：回陽音階，全員收束
  [[G5,48,1],[E5,49,.5],[D5,49.5,.5],[B4,50,1],[D5,51,1],[E5,52,1],[D5,53,.5],[B4,53.5,.5],[A4,54,2],
   [G4,56,.5],[A4,56.5,.5],[B4,57,1],[A4,58,.5],[G4,58.5,.5],[E4,59,1],[D4,60,3]].forEach(([m,s,d])=>N(m,s,d,'fue'));
  [[G5,48],[E5,52],[B4,56],[D5,60]].forEach(([m,s])=>N(m,s,1.5,'koto'));
  [G3,A2,G3,D3].forEach((r,i)=>{const b=48+i*4;[r,r+7,r+12,r+7,r,r+7,r+12,r+7].forEach((m,k)=>N(m,b+k*0.5,0.5,'shami'))});
  for(let b=48;b<60;b+=4){[0,2,2.5].forEach(o=>N(0,b+o,1,'taiko'));[1,3,3.5].forEach(o=>N(0,b+o,1,'ka'));[0,1,2,3].forEach(o=>N(0,b+o,1,'kane'))}
  [0,0.5,1,1.5,2,2.25,2.5,2.75,3,3.25,3.5,3.75].forEach(o=>N(0,60+o,1,o<2?'taiko':'shime'));N(0,60,1,'kane');N(A5,63,1,'koto');
  return {bpm:96,len:64,notes};
}
/** 《道中囃子》（外城出遊）：G 調陽音階，每分鐘 104 拍，十六小節；跳步節奏（長短），箏分散和弦＋笛，締太鼓輕點當腳步。
 *  1～8 小節：輕鬆漫步；9～16：旋律往上走，末小節停在高音不收尾，帶著期待接回開頭。 */
function songTrip(){
  const D3=50,E3=52,G3=55,A3=57,G4=67,A4=69,B4=71,D5=74,E5=76,G5=79,A5=81,B5=83,D6=86;
  const notes=[],N=(m,s,d,i)=>notes.push(i==='fue'?[m,s,d,i]:[m,s,d,i,0.5]);   // 伴奏（箏、低音箏、鼓、鉦）音量減半，笛照原音量
  const mel=[
    [[B4,.75],[D5,.25],[E5,1],[D5,1],[B4,1]],[[A4,.75],[B4,.25],[G4,2],[0,1]],
    [[B4,.75],[D5,.25],[E5,1],[G5,1],[E5,1]],[[D5,3],[0,1]],
    [[E5,.75],[D5,.25],[B4,1],[A4,1],[B4,1]],[[D5,.75],[B4,.25],[A4,1],[G4,2]],
    [[A4,.75],[B4,.25],[D5,1],[E5,.75],[D5,.25],[B4,1]],[[A4,3],[0,1]],
    [[D5,.75],[E5,.25],[G5,1],[A5,1],[G5,1]],[[E5,.75],[G5,.25],[A5,2],[0,1]],
    [[G5,.75],[A5,.25],[B5,1],[A5,1],[G5,1]],[[E5,.75],[D5,.25],[E5,1],[G5,2]],
    [[A5,.75],[G5,.25],[E5,1],[D5,1],[E5,1]],[[G5,.75],[A5,.25],[B5,2],[0,1]],
    [[A5,.75],[G5,.25],[E5,.75],[G5,.25],[A5,1],[B5,1]],[[D6,3],[0,1]]
  ];
  const root=[G3,G3,E3,D3, G3,E3,A3,D3, G3,E3,G3,E3, A3,E3,A3,D3];
  mel.forEach((bar,i)=>{
    const b=i*4;let x=b;
    bar.forEach(([m,d])=>{if(m)N(m,x,d,'fue');x+=d});
    const r=root[i],arp=[r,r+7,r+12,r+7,r+12,r+16>r+14?r+14:r+16,r+12,r+7];
    arp.forEach((m,k)=>N(m,b+Math.floor(k/2)+(k%2?0.67:0),0.5,'koto'));      // 跳步：每拍兩個音，第二個晚一點（長短）
    N(r-12,b,4,'kotoLow');
    [1,3].forEach(o=>N(0,b+o,1,'shime'));N(0,b+3.67,1,'ka');                // 腳步：二、四拍輕點，四拍尾帶一下鼓邊
    if(i%2===0)N(0,b,1,'kane');
    if(i===0||i===8)N(0,b,1,'taiko');
    if(i===15){[2,2.67,3,3.33,3.67].forEach(o=>N(0,b+o,1,'shime'))}
  });
  return {bpm:104,len:64,notes};
}
const SONGS={market:songMarket,visit:songVisit,title:songTitle,trip:songTrip};

/* ======================= 播放 ======================= */
/** 想播的曲子（market／visit／title／trip；null＝停止）；音樂關閉或還沒有使用者點擊時只記下，等可以時再播。 */
function musicWant(key){MUS.want=key;musicSync()}
/** 依設定與想播的曲子，開始、換曲或停止。 */
function musicSync(){
  if(!AC)return;
  const key=AUDIO.music?MUS.want:null;
  if(key===MUS.key)return;
  musicStop();if(!key)return;
  if(AC.state==='suspended')AC.resume();
  const out=musOut(),S=SONGS[key](),spb=60/S.bpm,list=S.notes.slice().sort((a,b)=>a[1]-b[1]);
  const P={S,spb,list,i:0,t0:AC.currentTime+0.1,timer:null};MUS.play=P;MUS.key=key;
  out.gain.cancelScheduledValues(AC.currentTime);out.gain.setValueAtTime(0.0001,AC.currentTime);out.gain.linearRampToValueAtTime(audioGain()*0.55,AC.currentTime+0.6);
  const tick=()=>{
    if(MUS.play!==P)return;const ahead=AC.currentTime+0.25;
    while(true){
      if(P.i>=P.list.length){P.i=0;P.t0+=P.S.len*P.spb}
      const n=P.list[P.i],t=P.t0+n[1]*P.spb;if(t>ahead)break;
      if(t>=AC.currentTime-0.02)try{musVoice(n[3],n[0],t,n[2]*P.spb,n[4])}catch(e){}
      P.i++;
    }
  };
  P.timer=setInterval(tick,25);tick();
}
function musicStop(){if(MUS.play){clearInterval(MUS.play.timer);MUS.play=null}MUS.key=null}
/* 切到背景時暫停，回來再繼續 */
document.addEventListener('visibilitychange',()=>{if(!AC)return;if(document.hidden)AC.suspend();else AC.resume()});
/* 手機：第一次點擊時喚醒音訊 */
document.addEventListener('pointerdown',()=>{if(AC&&AC.state==='suspended'&&!document.hidden)AC.resume();if(MUS.want&&!MUS.key)musicSync()},{passive:true});

/* ======================= 設定面板（選單最上方） ======================= */
function audioSettingsHtml(){
  const sw=(k,on,lb)=>'<button class="pixel-btn btn-sm '+(on?'btn-gold':'')+'" data-act="audioToggle" data-k="'+k+'" style="flex:1">'+UT('music.sw.3',{a:lb,b:on?UT('music.sw'):UT('music.sw.2')})+'</button>';
  return UT('music.audioSettingsHtml.3',{a:sw('music',AUDIO.music,UT('music.audioSettingsHtml')),b:sw('sfx',AUDIO.sfx,UT('music.audioSettingsHtml.2')),c:sw('voice',AUDIO.voice!==false,UT('music.audioSettingsHtml.6'))})+'</div>'+UT('music.audioSettingsHtml.4',{a:AUDIO.vol})+'" data-audio="vol" style="flex:1"><b id="audio-vol">'+AUDIO.vol+'</b></div>'+UT('music.audioSettingsHtml.5');
}
ACT.audioToggle=el=>{const k=el.dataset.k;AUDIO[k]=!AUDIO[k];audioSave();audioApply();musicSync();if(AUDIO.sfx)sfx.tap();refreshSheet()};
document.addEventListener('input',e=>{if(e.target.dataset&&e.target.dataset.audio==='vol'){AUDIO.vol=+e.target.value;const v=$('#audio-vol');if(v)v.textContent=AUDIO.vol;audioApply();audioSave()}});
audioApply();

/* ═════ [07w2_voice] ═════ */
/* 人聲與兩項器物聲（第三百三十七節）：全部 WebAudio 即時合成，不用音檔。
 *  - 人聲：共振峰合成的擬聲（聽語氣、不聽字）。點主畫面人物、給零用錢、閒聊時出聲。
 *    每個人一副固定的嗓子（由店員 id、家人編號當種子決定音高、口腔大小、粗細、語速）；每職位三、四種應聲隨機挑。
 *    受設定「人聲」開關（AUDIO.voice）控制，與音效開關分開；音量照共用音量。
 *  - 器物聲：推進一旬的打更梆子、委託採買出發的海螺（海路）與馬蹄加鈴（陸路）；受音效開關控制。 */
if(AUDIO.voice===undefined)AUDIO.voice=true;
const VO={out:null,rev:null,nb:null,gw:null};
/** 輸出鏈：音量 → 壓縮 → 喇叭，另接一個合成殘響。 */
function voReady(){
  if(!AC)return false;if(AC.state==='suspended')AC.resume();
  if(!VO.out){
    const comp=AC.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;comp.connect(AC.destination);
    VO.out=AC.createGain();VO.out.connect(comp);
    const len=Math.floor(AC.sampleRate*2),ir=AC.createBuffer(2,len,AC.sampleRate);
    for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2)}
    VO.rev=AC.createConvolver();VO.rev.buffer=ir;const rg=AC.createGain();rg.gain.value=0.35;VO.rev.connect(rg);rg.connect(VO.out);
    VO.nb=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate);const d=VO.nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const n=40,re=new Float32Array(n),im=new Float32Array(n);for(let k=1;k<n;k++)im[k]=1/Math.pow(k,1.35);VO.gw=AC.createPeriodicWave(re,im);
  }
  VO.out.gain.value=0.75*Math.min(1.6,SFX_VOL);
  return true;
}
const voR=(a,b)=>a+Math.random()*(b-a);
function voOut(node,rev){node.connect(VO.out);if(rev){const g=AC.createGain();g.gain.value=rev;node.connect(g);g.connect(VO.rev)}}
function voEnv(t,a,d,v,hold){const g=AC.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(v,t+a);if(hold)g.gain.setValueAtTime(v,t+a+hold);g.gain.exponentialRampToValueAtTime(0.0001,t+a+(hold||0)+d);return g}
function voOsc(type,f,t,dur){const o=AC.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);o.start(t);o.stop(t+dur+0.05);return o}
function voNoise(t,dur){const s=AC.createBufferSource();s.buffer=VO.nb;s.loop=true;s.start(t,Math.random()*1.5);s.stop(t+dur+0.05);return s}
function voFilt(type,f,q){const b=AC.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q||1;return b}
function voPing(t,f,dec,v,type,rev){const o=voOsc(type||'sine',f,t,dec),g=voEnv(t,0.002,dec,v);o.connect(g);voOut(g,rev)}
function voNhit(t,ft,f,q,dec,v,rev){const n=voNoise(t,dec),b=voFilt(ft,f,q),g=voEnv(t,0.001,dec,v);n.connect(b);b.connect(g);voOut(g,rev)}

/* ---------- 人聲 ---------- */
const VO_VOW={a:[800,1200,2600],i:[300,2250,3000],e:[480,1900,2550],o:[500,850,2600],u:[350,750,2400],n:[260,1500,2600]};
/** 各類人的基本嗓子：f0 音高、fs 口腔倍率、rough 粗、breath 氣音、v 音量。 */
const VO_SPK={
  apprentice:{f0:270,fs:1.22,v:0.5,breath:0.02},clerk:{f0:165,fs:1.0,v:0.5,breath:0.02},banto:{f0:135,fs:0.97,v:0.5,breath:0.02},
  chief:{f0:100,fs:0.93,v:0.55,breath:0.03},captain:{f0:118,fs:0.95,v:0.6,rough:0.6,breath:0.04},courier:{f0:185,fs:1.03,v:0.55,breath:0.03},
  guard:{f0:95,fs:0.92,v:0.55,rough:0.3,breath:0.05},wife:{f0:235,fs:1.17,v:0.42,breath:0.06},conc:{f0:265,fs:1.2,v:0.4,breath:0.07},
  kidS:{f0:360,fs:1.35,v:0.45,breath:0.03},kidL:{f0:290,fs:1.25,v:0.45,breath:0.03}
};
/** 各類人的應聲（[母音, 長度, 音高倍率, 子音]），隨機挑一種。 */
const VO_WORDS={
  apprentice:[[['a',.07,1.12,'h'],['i',.09,.95]],[['a',.05,1.1,'h'],['i',.05,1.0],['a',.05,1.12,'h'],['i',.08,.95]],[['e',.12,1.3]],[['n',.08,1.0],['n',.12,1.25]]],
  clerk:[[['o',.11,1.05,'h'],['e',.09,.92,'d']],[['a',.08,1.0,'h'],['i',.1,.92]],[['o',.07,1.0],['a',.07,1.05,'d'],['i',.07,1.0],['a',.12,.9,'d']]],
  banto:[[['a',.09,1.0,'h'],['i',.1,.9]],[['n',.08,1.0],['a',.08,1.0,'h'],['i',.1,.88]],[['o',.1,1.0],['u',.14,.9]]],
  chief:[[['n',.12,1.0],['n',.12,1.08],['n',.14,.88]],[['u',.1,1.0,'h'],['n',.18,.9]],[['o',.1,1.0],['i',.16,.86]]],
  captain:[[['o',.08,1.25],['o',.16,.95]],[['o',.08,1.1],['a',.14,1.2]],[['a',.1,1.15,'h'],['a',.08,.9]]],
  courier:[[['e',.07,1.1,'d'],['i',.13,.95,'d']],[['a',.05,1.15,'h'],['i',.07,1.0]],[['i',.06,1.0],['e',.1,1.1,'d']]],
  guard:[[['n',.06,1.05,'h'],['n',.12,.85]],[['n',.14,.9]],[['o',.12,.9]]],
  wife:[[['a',.1,1.05,'h'],['i',.14,.97]],[['a',.08,1.0],['a',.12,1.1,'d']],[['n',.1,1.0],['n',.14,1.1]]],
  conc:[[['n',.1,.95],['n',.12,1.05],['a',.16,1.15]],[['a',.08,1.1],['a',.16,1.25,'d']],[['o',.12,1.0],['o',.16,1.15]]],
  kidS:[[['a',.09,1.0,'d'],['a',.14,1.18]],[['a',.1,1.2],['a',.1,1.0,'d'],['a',.1,1.2,'d']],[['e',.12,1.3,'h']]],
  kidL:[[['e',.08,1.0,'d'],['e',.12,1.12]],[['a',.08,1.0,'h'],['i',.12,.95]],[['n',.12,1.05]]]
};
/** 道謝的母音序列（收到零用錢），尾音上揚。 */
const VO_THX={apprentice:'aiao',clerk:'ooie',banto:'aiao',chief:'uo',captain:'oaa',courier:'aiai',guard:'uo',wife:'aiao',conc:'ooie',kidS:'aaa',kidL:'aiao'};
const VO_STERN=['chief','guard'];
function voSeedR(seed){let x=0;for(const c of String(seed))x=(x*31+c.charCodeAt(0))>>>0;return()=>{x=(x+0x6D2B79F5)>>>0;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
/** 某人的嗓子：role 決定類別，seed 決定個人差異；female 時音高與口腔改用女聲。 */
function voVoice(role,seed,female){
  const b=VO_SPK[role]||VO_SPK.clerk,r=voSeedR(role+'|'+seed);
  const base=female&&!['wife','conc','kidS','kidL'].includes(role)?Object.assign({},b,{f0:VO_SPK.wife.f0*(b.f0/165)**0.3,fs:VO_SPK.wife.fs,rough:0,breath:0.06}):b;
  return Object.assign({},base,{f0:base.f0*(0.86+r()*0.28),fs:base.fs*(0.94+r()*0.12),rough:(base.rough||0)+(r()<0.3?r()*0.4:0),breath:(base.breath||0.02)*(0.6+r()*1.2),vib:(base.vib||0.012)*(0.7+r()*0.9),tempo:0.85+r()*0.35});
}
/** 共振峰合成一段聲音；segs:[{v,d,p,c,g}]，回傳結束時間。 */
function voSpeak(sp,segs,t0){
  const t=t0===undefined?AC.currentTime+0.01:t0;
  const total=segs.reduce((a,s)=>a+s.d,0)+0.05;
  const src=AC.createOscillator();src.setPeriodicWave(VO.gw);
  const pre=AC.createGain();
  if(sp.rough){const sh=AC.createWaveShaper(),c=new Float32Array(256);for(let i=0;i<256;i++){const x=i/128-1;c[i]=Math.tanh(x*(1+sp.rough*4))}sh.curve=c;src.connect(sh);sh.connect(pre)}else src.connect(pre);
  const lfo=AC.createOscillator(),lg=AC.createGain();lfo.frequency.value=voR(5,6.5);lg.gain.value=sp.f0*(sp.vib||0.012);lfo.connect(lg);lg.connect(src.frequency);lfo.start(t);lfo.stop(t+total+0.1);
  const fb=[0,1,2].map(i=>voFilt('bandpass',VO_VOW[segs[0].v][i]*sp.fs,[6,9,12][i]));
  const fg=[1,0.45,0.18].map(v=>{const g=AC.createGain();g.gain.value=v;return g});
  const mix=AC.createGain();fb.forEach((b,i)=>{pre.connect(b);b.connect(fg[i]);fg[i].connect(mix)});
  if(sp.breath){const n=voNoise(t,total),bg=AC.createGain();bg.gain.value=sp.breath;n.connect(bg);fb.forEach(b=>bg.connect(b))}
  const amp=AC.createGain();amp.gain.setValueAtTime(0.0001,t);mix.connect(amp);voOut(amp,0.12);
  const V=sp.v||0.5;let tt=t;
  src.frequency.setValueAtTime(sp.f0*(segs[0].p||1),t);
  segs.forEach((s,k)=>{
    const f=VO_VOW[s.v];
    fb.forEach((b,i)=>b.frequency.linearRampToValueAtTime(f[i]*sp.fs,tt+Math.min(0.04,s.d*0.5)));
    if(s.c==='h'){const n=voNoise(tt,0.06),hb=voFilt('bandpass',1800*sp.fs,1),hg=voEnv(tt,0.005,0.05,0.18*V);n.connect(hb);hb.connect(hg);voOut(hg)}
    if(k===0)amp.gain.exponentialRampToValueAtTime(V,tt+(s.c==='h'?0.05:0.02));
    else if(s.c==='d'){amp.gain.linearRampToValueAtTime(V*0.15,tt+0.012);amp.gain.linearRampToValueAtTime(V,tt+0.035)}
    else amp.gain.linearRampToValueAtTime(V*(s.g||1),tt+0.03);
    src.frequency.linearRampToValueAtTime(sp.f0*(s.p||1),tt+s.d);
    const nas=s.v==='n';fg[1].gain.linearRampToValueAtTime(nas?0.08:0.45,tt+0.03);fg[2].gain.linearRampToValueAtTime(nas?0.03:0.18,tt+0.03);
    tt+=s.d;
  });
  amp.gain.exponentialRampToValueAtTime(0.0001,tt+0.06);
  src.start(t);src.stop(tt+0.12);
  return tt;
}
const voSegs=(L,sp)=>L.map(([v,d,p,c])=>({v,d:d*(sp.tempo||1),p,c}));
/** 應聲。 */
function voWord(role,sp){const L=pick(VO_WORDS[role]||VO_WORDS.clerk);sp=Object.assign({},sp,{f0:sp.f0*voR(0.96,1.04)});return voSpeak(sp,voSegs(L,sp))}
/** 笑兩三聲。 */
function voLaugh(sp,t){const n=Math.floor(voR(2,4)),L=[];for(let i=0;i<n;i++)L.push({v:Math.random()<.7?'a':'e',d:voR(.06,.08)*(sp.tempo||1),p:1.25-i*0.08,c:'h',g:0.8});return voSpeak(Object.assign({},sp,{breath:(sp.breath||0.02)+0.05}),L,t)}
/** 道謝，有時帶笑（大番頭、保鏢不笑）。 */
function voThanksSay(role,sp){
  const vs=VO_THX[role]||VO_THX.clerk,L=[];
  for(let i=0;i<vs.length;i++){const last=i===vs.length-1;L.push({v:vs[i],d:(last?voR(.12,.16):voR(.06,.08))*(sp.tempo||1),p:last?voR(1.12,1.25):voR(.98,1.08),c:i?'d':'h'})}
  const t=voSpeak(sp,L);if(Math.random()<0.55&&!VO_STERN.includes(role))voLaugh(sp,t+0.08);
}
/** 店員的類別與嗓子。 */
function voEmp(e){
  if(!e)return null;const role=VO_SPK[e.rank]?e.rank:'clerk',c=e.cid?CH(e.cid):(e.pid?CH(e.pid):null);
  return {role,sp:voVoice(role,e.id,!!(c&&c.gender==='f'))};
}
/** 主畫面點到的人（sceneMember 的回傳）。 */
function voMember(m){
  if(!m)return null;
  if(m.kind==='emp')return voEmp(chatSelf(m));
  if(m.id==='wife'){const sp=G.family.spouse;return {role:'wife',sp:voVoice('wife',sp?sp.name:'wife')}}
  if(m.id.startsWith('conc_'))return {role:'conc',sp:voVoice('conc',m.id)};
  if(m.id.startsWith('kid_')){const k=G.family.kids.find(x=>'kid_'+x.id===m.id);const role=k&&kidAge(k)>=12?'kidL':'kidS';const sp=voVoice(role,m.id);if(k&&k.gender==='f')sp.f0*=1.12;return {role,sp}}
  return null;
}
/** 人聲出得了聲嗎（開關與音訊環境）。 */
const voOn=()=>AUDIO.voice&&AUDIO.vol>0&&voReady();
/** 點主畫面人物：出聲成功回傳 true（呼叫端就不再播點擊聲）。 */
function voScene(m){if(!voOn())return false;const x=voMember(m);if(!x)return false;try{voWord(x.role,x.sp)}catch(err){return false}return true}
/** 給零用錢：道謝。 */
function voThanks(e){if(!voOn())return;const x=voEmp(e);if(x)try{voThanksSay(x.role,x.sp)}catch(err){}}
/** 閒聊：應聲或道謝隨機一種。 */
function voChat(e){if(!voOn())return;const x=voEmp(e);if(!x)return;try{Math.random()<0.6?voWord(x.role,x.sp):voThanksSay(x.role,x.sp)}catch(err){}}

/* ---------- 器物聲（受音效開關控制） ---------- */
const sfxOk=()=>soundOn&&AUDIO.vol>0&&voReady();
/** 推進一旬：打更梆子兩下。 */
function sfxTurn(){if(!sfxOk())return;const t=AC.currentTime+0.02;[0,0.35].forEach(d=>{voPing(t+d,760,0.16,0.45,'sine',0.2);voPing(t+d,1900,0.05,0.12);voNhit(t+d,'bandpass',1200,3,0.03,0.25)})}
/** 海路出發：海螺。 */
function sfxHorn(){
  if(!sfxOk())return;const t=AC.currentTime+0.02;
  const o=voOsc('sawtooth',180,t,1.4),l=AC.createOscillator(),lg=AC.createGain();l.frequency.value=4.5;lg.gain.value=3;l.connect(lg);lg.connect(o.frequency);l.start(t);l.stop(t+1.5);
  o.frequency.linearRampToValueAtTime(205,t+0.3);o.frequency.linearRampToValueAtTime(196,t+1.3);
  const b=voFilt('lowpass',900,3),g=voEnv(t,0.3,0.35,0.3,0.7);o.connect(b);b.connect(g);voOut(g,0.4);
}
/** 陸路出發：馬蹄加鈴。 */
function sfxHoof(delay){
  if(!sfxOk())return;const t=AC.currentTime+0.02+(delay||0);
  for(let i=0;i<8;i++){const tt=t+i*0.19+(i%2)*0.06;voNhit(tt,'bandpass',650,4,0.05,0.5,0.05);voPing(tt,330,0.05,0.2);if(i%3===0)[2600,3900].forEach(f=>voPing(t+i*0.19,f,0.3,0.06,'sine',0.2))}
}
{const _f=playFx;playFx=function(kind,cap,sub,done,ms){if(kind==='time'&&!FX.busy)try{sfxTurn()}catch(e){}return _f.apply(this,arguments)}}
{const _f=ACT.vGoAll;ACT.vGoAll=function(){
  const before=new Set(G.ships.map(s=>s.id));const r=_f.apply(this,arguments);
  const nw=G.ships.filter(s=>!before.has(s.id));
  try{const sea=nw.some(s=>s.mode==='sea'),land=nw.some(s=>s.mode==='land');if(sea)sfxHorn();if(land)sfxHoof(sea?1.2:0)}catch(e){}
  return r}}
