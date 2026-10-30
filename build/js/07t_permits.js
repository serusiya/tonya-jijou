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
const tradeFavorName=idx=>UT('lic.tradeFavorName',{a:COMM_MAP[lockedTrade()[idx]].short});
/** 尚未許可時的提示（大盤用）。 */
function tradeLockMsg(name){const i=lockedTrade().indexOf(name);return UT('lic.tradeLockMsg.3',{a:COMM_MAP[name].short,b:i===0?UT('lic.tradeLockMsg'):UT('lic.tradeLockMsg.2')})}

/* ---------- 請託共用：名稱、是否已辦妥 ---------- */
/** 把請託項目的名稱換成實際內容（交易許可帶貨名）。 */
function resolveFavor(f,n){
  if(!f)return f;
  if(f.trade!==undefined)return Object.assign({},f,{name:tradeFavorName(f.trade)});
  if(f.lic&&n&&n.pos)return Object.assign({},f,{name:licFavorName(f.lic,n.pos.rank)});
  return f;
}
/** 這位官員能辦的是否已經辦妥（許可等級已不低於他能核發的、交易許可已取得、一次性地區許可已持有）。 */
function favorDone(f,n){
  if(f.lic)return licLv(f.lic)>=licGrantLv(n.pos.rank);
  if(f.trade!==undefined)return (G.trade||[]).includes(lockedTrade()[f.trade]);
  if(f.once)return regionHeld(f.k,n);
  if(f.k==='firebreak')return !!G.flags.firebreak;
  return false;
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
  if(A.trade!==undefined){const nm=lockedTrade()[A.trade];G.trade=G.trade||[];if(!G.trade.includes(nm))G.trade.push(nm);return UT('lic.grantFavorApp.3',{a:COMM_MAP[nm].short})}
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
  return (FAVORS[p.court]||[]).filter(f=>(!f.pos||f.pos.includes(id))&&p.rank>=f.rank&&(!f.exactRank||p.rank===f.rank)).map(f=>{
    let name=f.name;
    if(f.lic)name=licFavorName(f.lic,p.rank);
    else if(f.trade!==undefined)name=G&&G.sysKey?tradeFavorName(f.trade):UT('lic.posFavors.3',{a:f.trade?UT('lic.posFavors'):UT('lic.posFavors.2')});
    return {name,desc:f.desc||''};
  });
}
/** 職位說明裡的「能辦的請託」欄。 */
function posFavorsHtml(id){
  const L=posFavors(id);
  return UT('lic.posFavorsHtml.2',{a:L.length?L.map(f=>'<div style="margin-top:3px"><b>'+esc(f.name)+'</b><div class="tiny muted">'+esc(f.desc)+'</div></div>').join(''):UT('lic.posFavorsHtml')})+'</div>';
}
