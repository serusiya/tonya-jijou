/* =====================================================================
 * 01b_costs.js — 費用總表
 *  所有「貿易商品以外」的物品與任務花費，都集中在 COSTS：
 *    cur：'silver' 公款（商號帳上白銀）／'gold' 私款（主人私房黃金）
 *    amt：基本金額（兩）；有 per 者，實付 = amt × 倍數（官階、船隊數…），倍數由呼叫處給。
 *  用法：costOf(k,倍數)、costTxt(k,倍數)→「公款 20 兩」、afford(k,倍數)、spend(k,倍數)、shortMsg(k,倍數)。
 *  罰款、利息、薪資等「按比例或變動」的支出不在此表。貿易商品的進貨款、運費、關稅也不在此表。
 * ===================================================================== */
const CUR_NAME={silver:'公款',gold:'私款'};
const COSTS={
  /* —— 拜訪·結交 —— */
  selfIntro:{name:'毛遂自薦備禮',cur:'silver',amt:20},
  selfIntroRefused:{name:'登門被擋車馬費',cur:'silver',amt:8},
  visitRefused:{name:'拜訪被拒車馬費（上限）',cur:'silver',amt:5},
  introFee:{name:'請引薦禮金',cur:'silver',amt:20,per:'目標官階'},
  scout:{name:'探聽性向',cur:'silver',amt:25,per:'目標官階'},
  weakness:{name:'打聽軟肋（已停用）',cur:'gold',amt:60,per:'目標官階（另加每階 20）'},
  befriend:{name:'設宴款待',cur:'silver',amt:60},
  /* —— 贈禮（官員／人物） —— */
  gift_art:{name:'名家字畫',cur:'silver',amt:75},gift_antique:{name:'古董珍奇',cur:'silver',amt:90},
  gift_wine:{name:'灘之美酒',cur:'silver',amt:25},gift_geisha:{name:'花街設宴',cur:'silver',amt:45},
  gift_charm:{name:'祈福神符',cur:'silver',amt:20},gift_toy:{name:'童玩點心',cur:'silver',amt:15},
  gift_safe:{name:'陸路護送',cur:'silver',amt:30},gift_alms:{name:'以其名義義賑',cur:'silver',amt:35},
  gift_wife:{name:'禮敬夫人',cur:'silver',amt:40},gift_grudge:{name:'替其打壓宿敵',cur:'silver',amt:60},
  gift_fame:{name:'捐匾揚名',cur:'silver',amt:65},gift_gamble:{name:'設局賭宴',cur:'silver',amt:50},
  /* —— 官員請託·許可申請 —— */
  favorContract:{name:'請託：承攬官辦工程',cur:'silver',amt:100},
  favorWarn:{name:'請託：緝私通告',cur:'silver',amt:80},
  favorRank3:{name:'請託：直採特許（賄賂）',cur:'silver',amt:45,per:'依官階而定'},
  favorRank1:{name:'請託：免檢旗／睜眼（賄賂）',cur:'silver',amt:15,per:'官階−1'},
  favor_raid:{name:'請託：借官府查抄對手（賄賂）',cur:'silver',amt:90},
  favor_rpass:{name:'請託：關所通行手形（賄賂）',cur:'silver',amt:60},favor_rport:{name:'請託：進港泊位許可（賄賂）',cur:'silver',amt:60},
  favor_rhorse:{name:'請託：驛馬優先（賄賂）',cur:'silver',amt:45},favor_rcheap:{name:'請託：產地買付便宜（賄賂）',cur:'silver',amt:90},
  favor_rescort:{name:'請託：船手組護送（賄賂）',cur:'silver',amt:90},favor_rtax:{name:'請託：勘定所免稅狀（賄賂）',cur:'silver',amt:90},
  favor_rroad:{name:'請託：五街道通行狀（賄賂）',cur:'silver',amt:150},favor_rshuin:{name:'請託：朱印狀（賄賂）',cur:'silver',amt:150},
  favor_rcharter:{name:'請託：地區通商特許狀（賄賂）',cur:'silver',amt:225},favor_rvisit:{name:'請託：請巡見使美言（賄賂）',cur:'silver',amt:90},
  applyFeeRate:{name:'許可申請規費（佔基本賄賂比率）',cur:'silver',amt:0.5},
  inspectBribe:{name:'查貨賄賂',cur:'silver',amt:30,per:'官階'},
  /* —— 商號·人事 —— */
  audit:{name:'查帳',cur:'silver',amt:10},
  apprentice:{name:'招丁稚身價銀',cur:'silver',amt:20},
  recruitIntro:{name:'請介紹人物色人才禮金',cur:'silver',amt:40},
  hireMonths:{name:'聘金（月例的倍數）',cur:'silver',amt:4,per:'月例'},
  allowance:{name:'雇員零用錢',cur:'silver',amt:5},
  encounter:{name:'路遇應酬',cur:'silver',amt:10},
  /* —— 產業·設施 —— */
  fleetUp:{name:'擴編船隊',cur:'silver',amt:900,per:'現有船隊數'},
  whUp:{name:'增建倉庫',cur:'silver',amt:1500,per:'現有倉庫數'},
  charity:{name:'開倉施粥',cur:'silver',amt:120},
  guildSecret:{name:'簽暗約偷跑',cur:'gold',amt:30},
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
  nominate:{name:'指名名伶',cur:'gold',amt:20},
  oiranGiftMul:{name:'名伶禮物價格倍率（指名後）',cur:'silver',amt:2},
  ransom:{name:'名伶贖身（基本價，±100）',cur:'gold',amt:1000},
  /* —— 暗殺 —— */
  assassin:{name:'暗殺',cur:'gold',amt:500},
  /* —— 放火 —— */
  arson:{name:'放火（燒同業倉庫）',cur:'gold',amt:500},
  /* —— 官員運作（好感 100）—— */
  frame:{name:'栽贓同業（司法官員）',cur:'gold',amt:500},
  suppress:{name:'打壓同業（行政官員）',cur:'gold',amt:500}
};
/** 名伶專屬禮物（首飾與化妝品），價格也在總表。 */
[['o1','銀簪',100],['o2','京白粉',110],['o3','紅花口脂',120],['o4','鬢付髮油',130],['o5','眉黛',150],['o6','蒔繪梳',180],['o7','螺鈿手鏡',220],['o8','琥珀頸飾',250],['o9','翡翠玉鐲',280],['o10','珊瑚簪',300]]
  .forEach(([k,name,amt])=>{COSTS['oiranGift_'+k]={name:'名伶禮物：'+name,cur:'silver',amt}});

const costOf=(k,mul)=>Math.round(COSTS[k].amt*(mul===undefined?1:mul));
const costTxt=(k,mul)=>CUR_NAME[COSTS[k].cur]+' '+costOf(k,mul)+' 兩';
const walletOf=k=>COSTS[k].cur;
/** 錢夠不夠（amt 可自行指定，如依官階算出的金額）。 */
const afford=(k,mul)=>G[COSTS[k].cur]>=costOf(k,mul);
const affordAmt=(k,amt)=>G[COSTS[k].cur]>=amt;
/** 扣款，回傳實扣金額。 */
function spend(k,mul){const a=costOf(k,mul);G[COSTS[k].cur]-=a;return a}
function spendAmt(k,amt){G[COSTS[k].cur]-=amt;return amt}
/** 統一的不足訊息。 */
function shortMsg(k,mul){
  const c=COSTS[k],a=costOf(k,mul);
  return (c.cur==='silver'?'公款白銀不足':'私款（黃金點心）不足')+'，「'+c.name+'」需 '+fmt(a)+' 兩'+(c.cur==='gold'?'（可按上方「＋」補充）':'');
}
