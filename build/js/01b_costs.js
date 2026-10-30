/* =====================================================================
 * 01b_costs.js — 費用總表
 *  所有「貿易商品以外」的物品與任務花費，都集中在 COSTS：
 *    cur：'silver' 現款（商號帳上資金）／'gold' 私房錢（主人自己的錢）
 *    amt：基本金額（兩）；有 per 者，實付 = amt × 倍數（官階、船隊數…），倍數由呼叫處給。
 *  用法：costOf(k,倍數)、costTxt(k,倍數)→「現款 20 兩」、afford(k,倍數)、spend(k,倍數)、shortMsg(k,倍數)。
 *  罰款、利息、薪資等「按比例或變動」的支出不在此表。貿易商品的進貨款、委託採買的雜費也不在此表。
 * ===================================================================== */
const CUR_NAME={silver:'現款',gold:'私房錢'};
const COSTS={
  /* —— 拜訪·結交 —— */
  selfIntro:{name:'毛遂自薦備禮',cur:'silver',amt:20},
  selfIntroRefused:{name:'登門被擋車馬費',cur:'silver',amt:8},
  visitRefused:{name:'拜訪被拒車馬費（上限）',cur:'silver',amt:5},
  introFee:{name:'請引薦禮金',cur:'silver',amt:20,per:'目標官階'},
  scout:{name:'探聽性向',cur:'silver',amt:25,per:'目標官階'},
  weakness:{name:'打聽軟肋（已停用）',cur:'gold',amt:60,per:'目標官階（另加每階 20）'},
  befriend:{name:'宴會',cur:'silver',amt:60},
  /* —— 贈禮：六種禮物不花錢，拜訪時的賄賂由三檔出價決定（07u_battle.js） —— */
  /* —— 官員請託不另收錢（賄賂已在拜訪戰鬥中付過，見 04_people.js 的 doFavor） —— */
  inspectBribe:{name:'查貨賄賂',cur:'silver',amt:30,per:'官階'},
  /* —— 商號·人事 —— */
  audit:{name:'查帳',cur:'silver',amt:10},
  apprentice:{name:'招丁稚身價銀',cur:'silver',amt:20},
  recruitIntro:{name:'請介紹人物色人才禮金',cur:'silver',amt:40},
  hireMonths:{name:'聘金（月例的倍數）',cur:'silver',amt:4,per:'月例'},
  allowance:{name:'雇員零用錢',cur:'silver',amt:5},
  reliefSoup:{name:'御救小屋合辦',cur:'silver',amt:800},
  banditBribe:{name:'買通賊黨',cur:'gold',amt:300},
  banditQuell:{name:'討賊軍費',cur:'silver',amt:3000},
  encounter:{name:'路遇應酬',cur:'silver',amt:50},
  /* —— 產業·設施 —— */
  shipBuild:{name:'造船費（聘船長時）',cur:'silver',amt:600,per:'聘後的船長數'},
  whUp:{name:'增建倉庫',cur:'silver',amt:1500,per:'現有倉庫數'},
  charity:{name:'開倉施粥',cur:'silver',amt:120},
  guildSecret:{name:'簽暗約偷跑',cur:'gold',amt:30},
  guildBond:{name:'協議擔保金',cur:'silver',amt:1000},
  /* —— 家族 —— */
  marryRival:{name:'聘禮：同行之女',cur:'silver',amt:400},
  marryOfficial:{name:'聘禮：官家之女',cur:'silver',amt:800},
  marryCommoner:{name:'聘禮：町人之女',cur:'silver',amt:200},
  kidDebt:{name:'替敗家子還債',cur:'silver',amt:500},
  pathShop:{name:'子女歷練：學商（每旬）',cur:'silver',amt:30},
  pathSea:{name:'子女歷練：海運（每旬）',cur:'silver',amt:50},
  pathCourt:{name:'子女歷練：侍童（每旬）',cur:'silver',amt:40},
  /* —— 吉原 —— */
  feast:{name:'包場花金夜宴',cur:'gold',amt:80},
  nominate:{name:'指名花魁',cur:'gold',amt:20},
  oiranGiftMul:{name:'花魁禮物價格倍率（指名後）',cur:'gold',amt:2},
  ransom:{name:'花魁贖身（基本價，±100）',cur:'gold',amt:1000},
  /* —— 暗殺 —— */
  assassin:{name:'暗殺',cur:'gold',amt:500},
  /* —— 放火 —— */
  arson:{name:'放火（燒同業倉庫）',cur:'gold',amt:500},
  /* —— 官員運作（好感 100）—— */
  frame:{name:'栽贓同業（吟味方官員）',cur:'gold',amt:500},
  suppress:{name:'打壓同業（普請方官員）',cur:'gold',amt:500}
};
/** 花魁專屬禮物（首飾與化妝品），價格也在總表。 */
[['o1','銀簪',100],['o2','京白粉',110],['o3','紅花口脂',120],['o4','鬢付髮油',130],['o5','眉黛',150],['o6','蒔繪梳',180],['o7','螺鈿手鏡',220],['o8','琥珀頸飾',250],['o9','翡翠玉鐲',280],['o10','珊瑚簪',300]]
  .forEach(([k,name,amt])=>{COSTS['oiranGift_'+k]={name:'花魁禮物：'+name,cur:'gold',amt}});

const costOf=(k,mul)=>Math.round(COSTS[k].amt*(mul===undefined?1:mul));
const costTxt=(k,mul)=>UT('cost.txt',{cur:CUR_NAME[COSTS[k].cur],a:costOf(k,mul)});
/** 按鈕用金額：記號＋數字，不寫「兩」。現款＝方孔銀幣（深藍灰數字），私房錢＝小判金幣（深琥珀數字）。訊息與說明文字仍用 costTxt。 */
const coinHtml=(cur,amt)=>'<span class="money '+(cur==='gold'?'mg':'ms')+'"><i class="cmark '+(cur==='gold'?'koban':'zeni')+'" aria-label="'+CUR_NAME[cur]+'"></i>'+fmt(amt)+'</span>';
const costBtn=(k,mul)=>coinHtml(COSTS[k].cur,costOf(k,mul));
const walletOf=k=>COSTS[k].cur;
/** 錢夠不夠（amt 可自行指定，如依官階算出的金額）。 */
const afford=(k,mul)=>G[COSTS[k].cur]>=costOf(k,mul);
const affordAmt=(k,amt)=>G[COSTS[k].cur]>=amt;
/** 主動支出帳：鍵＝「文字鍵|對象代號」（如 spend.buy|prod_0101、cost:visit），畫面以 spendLabel 轉成文字。 */
const SPEND_ARG={'spend.buy':a=>COMM_MAP[a]?COMM_MAP[a].short:a,'spend.lot':a=>COMM_MAP[a]?COMM_MAP[a].short:a,'spend.xloan':a=>COMM_MAP[a]?COMM_MAP[a].short:a,'spend.tribute':a=>nameOf(a),'spend.bribe':a=>nameOf(a),'spend.voyage':a=>CITY(a)?CITY(a).name:a,'spend.staffEv':a=>UT('sev.label.'+a)};
function spendLabel(k){
  if(k.startsWith('cost:')){const c=COSTS[k.slice(5)];return c?c.name:k}
  const i=k.indexOf('|'),t=i<0?k:k.slice(0,i),a=i<0?'':k.slice(i+1);
  if(UI_TXT[t]===undefined)return k;                 // 舊存檔留下的中文帳目，照原樣顯示
  return UT(t,{n:SPEND_ARG[t]?SPEND_ARG[t](a):a});
}
/** 扣款，回傳實扣金額。 */
function notePublicSpend(label,amt){
  if(!(amt>0))return amt;
  G.publicSpend=G.publicSpend||{};
  G.publicSpend[label]=(G.publicSpend[label]||0)+amt;
  return amt;
}
function payPublic(label,amt){G.silver-=amt;notePublicSpend(label,amt);return amt}
function spend(k,mul){const c=COSTS[k],a=costOf(k,mul);if(c.cur==='silver')payPublic('cost:'+k,a);else G[c.cur]-=a;return a}
function spendAmt(k,amt){const c=COSTS[k];if(c.cur==='silver')payPublic('cost:'+k,amt);else G[c.cur]-=amt;return amt}
/** 統一的不足訊息。 */
function shortMsg(k,mul){
  const c=COSTS[k],a=costOf(k,mul);
  return MSG(c.cur==='silver'?'cost.shortSilver':'cost.shortGold',{n:c.name,a:fmt(a)});
}
