/* =====================================================================
 * 01c_odds.js — 隨機事件機率總表
 *  所有「擲骰」的機率、權重、基準值與上下限都集中在 ODDS。
 *  程式只在擲骰處讀取 ODDS，不再寫死數字；要調整遊戲的運氣，改這裡即可。
 *  p：基本機率（0～1）。有修正公式者，列出各項係數：base 基準、per* 每單位增量、min/max 夾限。
 *  修正來源（風聲 heat、知名度 fame、保鏢、仇人…）仍由各系統代入。
 * ===================================================================== */
const ODDS={
  /* —— 每旬隨機事件（旬報）—— */
  eventRate:{name:'每旬隨機事件發生率',p:0.75},
  eventW:{name:'當季事件抽選權重（相對值）',fire:3,famine:2,harvest:2,typhoon:2,plague:2,military:2,sword:2,flower:2,dump:2,boom:2,inspect:2,fall:1.5,greed:1.5,thief:1.2,renqing:1.2},
  officialTransfer:{name:'本城官員與外地官員互調（每旬）',p:0.10},
  residenceTransfer:{name:'名門宅邸人物與外地同身分人物互換（每旬）',p:0.10},
  fallScapegoat:{name:'官員受你牽連（好感<10）把罪責推給你',p:0.6},
  thiefRepel:{name:'盜賊夜探，保鏢≥2 名當場擊退',p:0.7},
  /* —— 市場·治安 —— */
  fire:{name:'倉庫火災（易燃品）',base:0.012,flamDiv:200,winter:1.8,guardCut:0.1,heavy:0.6,light:0.35,heavyP:0.5},
  riotScapegoat:{name:'打毀後被當替罪羊',staple:0.8,other:0.2,affDiv:120,min:0.05,max:0.8},
  rivalShip:{name:'同業每旬實際出貨（隨機波動與超賣）／大盤進貨係數（參加協議者享聯合採購價；未參加者照市價）',base:0.58,otherShare:0.005,lo:0.7,hi:1.1,overP:0.1,overRival:0.05,mulMin:1.8,mulMax:2.6,news:0.4,buyMult:0.93,win:9},
  lux:{name:'奢侈品需求冷熱循環（久無買家、一賣吃數年）',warmMin:10,warmMax:30,dryMin:18,dryMax:100,dryMult:0.08,burstT:2,mulDiv:3,mulMin:9,mulMax:27,news:0.9},
  buyLimit:{name:'大盤進貨上限（需求×市佔率；參加協議者再加協議配額；番頭與大番頭每人加成；無條件捨去，至少 1）',mult:0.8,perBantou:0.3},
  chief:{name:'大番頭每旬自理事務（70%自動問候／10%意外之財／20%無事；大番頭累計賺得的意外之財超過當前現款，下一旬必捲款潛逃）',visitP:0.7,windfallP:0.1,visitMin:1,visitMax:3,gainMin:5,gainMax:10,newFriendP:0.25,windfallMin:0.01,windfallMax:0.10},
  hold:{name:'持有成本與風險（依貨值）',rate:0.003,riskDiv:400000,riskMax:0.12,lossMin:0.1,lossMax:0.35,guardCut:0.1},
  rivalEvent:{name:'同業突發事件',p:0.05,good:0.5,news:0.5},
  cartelPledged:{name:'誓言守配額卻超量被查獲',base:0.25,slope:0.35,max:0.9},
  cartelSecret:{name:'暗約偷跑被告發',base:0.12,slope:0.18,max:0.8},
  cartelRaise:{name:'公會提案提高配額成功率',base:0.30,perAff:0.5,max:0.8},
  guildPolicy:{name:'每九旬協議決議（以量制價／正常供應各半）',normal:0.5},
  guildBond:{name:'協議擔保金一期的旬數（自動續押，期滿分配違約金）',turns:9},
  cityPopulation:{name:'城市人口每九旬依穩定供貨調整（全穩定 ±2%；多數穩定或不穩定 ±0.6%）',turns:9,all:0.02,majority:0.006,min:1000},
  /* —— 人際·員工·家族 —— */
  introBacklash:{name:'引薦性向全不合時反遭嫌棄',p:0.35},
  skim:{name:'員工私吞（每旬）',greed:0.6,betray:0.5,loyal:0.7,cap:0.6,lateMul:1.5,lateTurns:18},
  flee:{name:'番頭／大番頭捲款潛逃',p:0.004,lateMul:2},
  auditDetect:{name:'查帳查出私吞',base:0.5,commerceDiv:200,max:0.95},
  marry:{name:'說親成功率',base:0.45,perScore:0.2,min:0.15,max:0.95},
  prodigal:{name:'子女淪為敗家子（每年）',p:0.3},
  birth:{name:'添丁（每年）',p:0.24,male:0.5},
  death:{name:'主角死亡（每年）',startAge:45,perYear:0.022,base:0.003},
  /* —— 出門·路遇·仇人 —— */
  ambushDefend:{name:'遇襲時保鏢戰力≥此值必定退敵，否則以 (戰力/此值)² 為退敵率',power:70},
  ambush:{name:'出門遇襲',base:0.005,perHeat:0.002,heatCap:8,perFame:0.0001,min:0.005,max:0.03,perEnemy:0.03},
  encounter:{name:'路遇求助的人',p:0.10,known:0.5},
  enemyFire:{name:'每位仇人增加的失火機率',p:0.02},
  enemyThief:{name:'每位仇人增加的盜賊機率',p:0.02},
  /* —— 官府 —— */
  inspect:{name:'町奉行查貨（每旬）',base:0.30,perFame:0.25,min:0.05,max:0.30},
  regionRevoke:{name:'風聲≥5 時，巡見使吊銷許可（每旬）',p:0.03,heat:5},
  /* —— 走私 —— */
  raid:{name:'奉行所搜查（每旬）',base:0.015,perHeat:0.01,heatCap:10,perContraValue:0.02,contraCap:0.1,perEnemy:0.02,blindMul:0.25,exemptMul:0.7,max:0.6,minHeat:6},
  raidBlind:{name:'同心收袖之下後睜一隻眼',p:0.6},
  smugSeize:{name:'走私船入港被扣',perDanger:0.06,perHeat:0.01,blind:0.05,min:0.02,max:0.6},
  confess:{name:'被捕者供出主使',base:0.75,loyalDiv:130,min:0.1,max:0.7},
  /* —— 海陸運（遇險率隨旬數累積，受船長膽識影響）—— */
  crewRisk:{name:'船長／飛腳能力換算遇險倍率',base:1.3,perCourage:0.006,commerceDiv:500,min:0.7,max:1.3},
  voyageRisk:{name:'委託採買每旬遇險率',sea:0.03,land:0.022,guardLand:0.004,min:0.03,max:0.35,escortMul:0.5},
  voyageKind:{name:'委託採買買什麼：跨行貨機率（其餘買本業貨）；唐物藥種夾帶違禁品的機率、數量、每危險度風聲',cross:0.2,carry:0.2,carryMin:3,carryMax:5,carryHeat:0.2},
  smugRisk:{name:'走私船每旬遇險率',p:0.04,min:0.03,max:0.45},
  /* —— 跨行貨物 —— */
  xLoan:{name:'商人拿貨抵押借錢上門（每旬）',p:0.05},
  xForce:{name:'官吏硬塞貨物（每旬）',p:0.04},
  smugglerArrest:{name:'私梟落網（每旬，近期替你脫手者）',from:3,perHeat:0.02,max:0.12,window:36,jail:36},
  /* —— 其他 —— */
  chatMix:{name:'點人聊天內容比例（其餘為閒聊）',outsider:0.2,staff:0.3},
  gossipMet:{name:'聊天：偏向說已認識者的流言',p:0.6},
  /* —— 醜聞扣知名度（直接扣，不打折）—— */
  fame:{name:'知名度：上限、階級門檻、加分遞減；私房錢滿 goldTier 兩再加一階（只加一階）',cap:200,tiers:[30,80,150],goldTier:2000,damp:130,floor:0.25},
  fameLoss:{name:'醜聞扣知名度',inspect:6,scapegoat:3,cartelPledged:4,cartelSecret:5,riot:8,raid1:2,raid2:6,raid3:12,region:3,arrest:6,flowerPer200:0.5,raidRival:2,disown:2,tributeFail:1},
  /* —— 暗殺 —— */
  assassin:{name:'暗殺成功率',base:0.45,courageDiv:250,commerceDiv:400,perRank:0.06,min:0.12,max:0.85},
  assInvestigate:{name:'命案後官府追查',base:0.12,perHeat:0.03,perRank:0.04,min:0.15,max:0.6},
  /* —— 放火（同暗殺機制；對象為隨機同業，視同官階 3）—— */
  arson:{name:'放火成功率',base:0.45,courageDiv:250,commerceDiv:400,rank:3,perRank:0.06,min:0.12,max:0.85,minCourage:70},
  /* —— 官員栽贓（司法）／打壓（行政）：機制同放火，成功率以官員自身膽識與商才計 —— */
  frame:{name:'栽贓成功率',base:0.45,courageDiv:250,commerceDiv:400,rank:3,perRank:0.06,min:0.12,max:0.85},
  suppress:{name:'打壓成功率',base:0.45,courageDiv:250,commerceDiv:400,rank:3,perRank:0.06,min:0.12,max:0.85,turns:6,evMul:0.6},
  schemeInvestigate:{name:'官員運作後被查辦',base:0.12,perHeat:0.03,rank:3,perRank:0.04,min:0.15,max:0.6},
  /* —— 上貢（財務官員好感 100）：限期內備妥本業貨，到期按市價倍數自動上貢 —— */
  tribute:{name:'上貢',quotaMult:3,min:5,turns:4,priceMul:3,fame:3,shareUp:0.05,failAff:30},
  arsonInvestigate:{name:'縱火後官府追查',base:0.12,perHeat:0.03,rank:3,perRank:0.04,min:0.15,max:0.6}
};
/** 擲骰：以 ODDS[k].p（或自訂 p）判定是否發生。 */
const roll=(k,p)=>chance(p===undefined?ODDS[k].p:p);
