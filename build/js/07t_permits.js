'use strict';
/* ======================= 許可（資格）：倉地、船株、人別帳、馬幫株、帶刀、交易許可、減罪狀 =======================
 *  - 三院官員的一般請託都是「資格」：拿到許可才能擴充倉庫、船長、飛腳、店員、保鏢，或買賣本業最貴的兩項貨。
 *  - 許可分等級：核發官員的官階越高，給的上限越高（一～四階，四階以上同四階）。取得後永久有效，只升不降。
 *  - 狀態：G.lic={wh,ship,horse,guard,staff}（已取得的等級 0～4）；G.trade＝已許可交易的貨名；G.lessen＝減罪狀張數（0／1）。 */
/** 各項許可：caps[等級]＝上限（等級 0＝未申請）。 */
const LIC={
  wh:{name:'河岸倉地拜領',caps:[1,2,3,5,8]},
  ship:{name:'船株鑑札',caps:[1,1,2,3,4]},
  horse:{name:'馬幫株',caps:[1,1,2,3,4]},
  guard:{name:'帶刀護衛許可',caps:[1,1,2,3,4]},
  staff:{name:'人別帳增補',caps:[{手代:1,番頭:1},{手代:1,番頭:1},{手代:3,番頭:1},{手代:4,番頭:2},{手代:6,番頭:2}]}
};
const licOf=()=>G.lic||(G.lic={wh:0,ship:0,horse:0,guard:0,staff:0});
/** 某項許可目前的等級（0～4）。 */
const licLv=k=>Math.min(4,licOf()[k]||0);
/** 倉庫最多可建幾棟。 */
const whMax=()=>LIC.wh.caps[licLv('wh')];
/** 某職位的名額上限（大番頭固定 1）。 */
/** 丁稚名額（固定）。 */
const APPRENTICE_CAP=2;
function slotCap(rank){
  if(rank==='大番頭')return 1;
  if(rank==='丁稚')return APPRENTICE_CAP;          // 丁稚固定 2 名，開局即可招，不隨許可增加
  if(rank==='船長')return LIC.ship.caps[licLv('ship')];
  if(rank==='飛腳')return LIC.horse.caps[licLv('horse')];
  if(rank==='保鏢')return LIC.guard.caps[licLv('guard')];
  return LIC.staff.caps[licLv('staff')][rank]||1;
}
/** 取得許可：等級取較高者，回傳敘事訊息。 */
function grantLic(k,rank){
  const L=licOf(),lv=Math.min(4,rank);L[k]=Math.max(L[k]||0,lv);
  if(k==='wh')return '倉庫最多可建 '+whMax()+' 棟。';
  if(k==='ship')return '船長名額增為 '+slotCap('船長')+' 名，一名船長帶一艘船。';
  if(k==='horse')return '飛腳名額增為 '+slotCap('飛腳')+' 名，一名飛腳帶一支馬幫。';
  if(k==='guard')return '保鏢名額增為 '+slotCap('保鏢')+' 名。';
  const s=LIC.staff.caps[licLv('staff')];return '手代可雇 '+s.手代+' 名，番頭 '+s.番頭+' 名。';
}

/* ---------- 交易許可：本業最貴的兩項貨 ---------- */
/** 本業需交易許可的貨：[最貴, 第二貴]。 */
function lockedTrade(sysKey){return commsOfSys(sysKey||G.sysKey).slice().sort((a,b)=>b.base-a.base).slice(0,2).map(c=>c.name)}
/** 這項貨能不能交易（非本業、或不在鎖定名單、或已取得許可）。 */
function tradeOK(name){
  const c=COMM_MAP[name];if(!G||!c||c.sys!==G.sysKey)return true;
  return !lockedTrade().includes(name)||(G.trade||[]).includes(name);
}
/** 本業中目前可交易的貨。 */
const tradeComms=()=>ownComms().filter(c=>tradeOK(c.name));
/** 開局交易許可：第六、七個流派（唐物藥種、陶磁雅玩）送第二貴貨物的許可。 */
function startTrade(sysKey){return SYS.findIndex(s=>s.key===sysKey)>=5?[lockedTrade(sysKey)[1]]:[]}
/** 交易許可的請託名稱（帶上貨名）。 */
const tradeFavorName=idx=>'交易許可：'+COMM_MAP[lockedTrade()[idx]].short;
/** 尚未許可時的提示（大盤用）。 */
function tradeLockMsg(name){const i=lockedTrade().indexOf(name);return '「'+COMM_MAP[name].short+'」要有交易許可才能買賣。請向'+(i===0?'四':'三')+'階以上的財務官員申請。'}

/* ---------- 請託共用：名稱、是否已辦妥 ---------- */
/** 把請託項目的名稱換成實際內容（交易許可帶貨名）。 */
const resolveFavor=f=>f&&f.trade!==undefined?Object.assign({},f,{name:tradeFavorName(f.trade)}):f;
/** 這位官員能辦的是否已經辦妥（許可等級已不低於他能核發的、交易許可已取得、一次性地區許可已持有）。 */
function favorDone(f,n){
  if(f.lic)return licLv(f.lic)>=Math.min(4,n.pos.rank);
  if(f.trade!==undefined)return (G.trade||[]).includes(lockedTrade()[f.trade]);
  if(f.once)return regionHeld(f.k,n);
  return false;
}
/** 申請獲准時的效果；不是許可類回傳 null。 */
function grantFavorApp(A){
  if(A.lic)return '取得「'+LIC[A.lic].name+'」：'+grantLic(A.lic,A.rank||2);
  if(A.trade!==undefined){const nm=lockedTrade()[A.trade];G.trade=G.trade||[];if(!G.trade.includes(nm))G.trade.push(nm);return '從此可以買賣「'+COMM_MAP[nm].short+'」。'}
  return null;
}

/* ---------- 許可一覽（奉行所面板頂端） ---------- */
function licCard(){
  const L=lockedTrade(),s=LIC.staff.caps[licLv('staff')];
  const row=(k,v)=>'<div class="row tiny" style="margin-top:2px"><span>'+k+'</span><b>'+v+'</b></div>';
  return '<div class="card"><b class="small">📜 手上的許可</b>'
    +row('倉庫',G.wh.n+'／'+whMax()+' 棟')
    +row('船長',G.emps.filter(e=>e.rank==='船長').length+'／'+slotCap('船長')+' 名')
    +row('飛腳',G.emps.filter(e=>e.rank==='飛腳').length+'／'+slotCap('飛腳')+' 名')
    +row('保鏢',guardCount()+'／'+slotCap('保鏢')+' 名')
    +row('丁稚',nEmp('丁稚')+'／'+APPRENTICE_CAP+' 名')
    +row('手代／番頭',s.手代+'／'+s.番頭+' 名')
    +row('交易許可',L.map(n=>COMM_MAP[n].short+(tradeOK(n)?' ✅':' 🔒')).join('、'))
    +row('減罪狀',(G.lessen||0)>0?'持有 1 張':'無')
    +'<div class="tiny muted" style="margin-top:3px">許可由三院官員核發，官階越高給得越多。</div></div>';
}
