/* =====================================================================
 * 01c_odds.js — 隨機事件機率總表
 *  所有「擲骰」的機率、權重、基準值與上下限都集中在 ODDS。
 *  程式只在擲骰處讀取 ODDS，不再寫死數字；要調整遊戲的運氣，改這裡即可。
 *  p：基本機率（0～1）。有修正公式者，列出各項係數：base 基準、per* 每單位增量、min/max 夾限。
 *  修正來源（風聲 heat、知名度 fame、保鏢、仇人…）仍由各系統代入。
 * ===================================================================== */
const ODDS={
  bz:{name:'商人番付與花邊八卦（07zzf_banzuke.js）',top:10,guests:[6,8],
    rv:{init:[1.5,4],g0:0.025,share:0.3,noise:0.03,min:0.4,max:15,heir:0.8,ev:{fire:-0.15,theft:-0.05,wreck:-0.08,caught:-0.1,susp:-0.06,haul:0.05,lot:-0.02,gm:0.02}},
    gs:{init:[0.5,3],min:0.2,max:10,fame:0.6,fameDrift:4,dealFame:[1,2],
      trip:[{k:'big',w:12,r:[0.2,0.4]},{k:'good',w:36,r:[0.05,0.15]},{k:'flat',w:26,r:[-0.03,0.03]},{k:'loss',w:19,r:[-0.15,-0.05]},{k:'rob',w:7,r:[-0.4,-0.2]}]},
    gap:[0.9,0.6],gossip:[3,4],falseP:0.3,keep:4,heatGossip:3,flowerGossip:600,topicTurns:9,sayP:0.3},   // 身代以玩家開局現款為基準的倍數；rv 同業、gs 旅商（每季行商結果）；gap：和上一位（或榜尾）相比，只差一步／還差一截的比例；falseP：八卦是假的比例
  f8:{name:'0.8 先行請託（07zze_favor8.js）',fearTurns:3,fraud:{sea:[3500,4500],land:[2500,3500]},fraudRest:3,fraudHeat:1.5,suspCost:3000,suspTurns:3,suspAff:30,suspHeat:1,mono:{mono5:{cost:5000,turns:3},mono6:{cost:10000,turns:9}},monoBuyX:2,kesshoGold:1000,kesshoMin:3,newTown:{cost:6000,p:[0.4,0.7,1],pop:0.05,cd:12},lossRate:0.5,lossCap:800,theftBack:[0.2,0.3]},
  gm:{name:'問屋公會長（07yc_gm.js）',fameWin:5,famePerTurn:0.1,rivalAff:3,voteAff:5,bribeVar:0.1,canvassX:3,canvassComp:[0.5,1,1.5,2],canvassShare:2,fineX:1.2,evP:0.5,arbFav:10,arbHurt:20,arbAff:5,arbCost:[500,1500],levy:[3000,8000],levyFame:5,levyAff:40},   // canvassComp：投票人與對手相容（格格不入、相談甚歡、意氣相投、一見如故）的心防係數；canvassShare：對手市佔每多一成，心防 +20%
  sick:{name:'病倒（07zzd_sick.js）',flower:{nom:3,turns:2},stress:{turns:3}},   // stress：壓力到 90 病倒，靜養三旬（07zzi_stress.js）   // 吉原同一旬指名第 nom 位花魁後病倒，之後 turns 個完整的旬不能出門
  marketFloor:{name:'大盤牌價地板（固定基準價倍數）；收市價低於地板時，下一旬牌價與收市價脫鉤',staple:1.50,normal:1.20,luxury:1.05},
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
  rivalShip:{name:'同業每旬實際出貨（隨機波動與超賣）／相場進貨係數（參加協議者享聯合採購價；未參加者照市價）',base:0.58,otherShare:0.005,lo:0.7,hi:1.1,normalPow:4,overP:0.1,overRival:0.05,mulMin:1.8,mulMax:2.6,news:0.4,buyMult:0.93},
  priceWin:{name:'收市價計算視窗（旬數）：必需品快漲快跌，奢侈品最慢',staple:3,normal:6,luxury:9},
  fest:{name:'節慶當旬需求倍率（一般貨／節慶搶手貨）',all:2,hot:2.5},
  enlist:{name:'延攬熟人：各職階所需好感、各職能力下限、介紹人交情扣減、婉拒扣好感（07zz_enlist.js）',aff:{clerk:50,captain:50,courier:50,guard:50,banto:65,chief:80},stat:{clerk:{commerce_skill:40},banto:{commerce_skill:50},chief:{commerce_skill:50,integrity_loyalty:40},courier:{diplomacy_charm:50},captain:{audacity_courage:50},guard:{audacity_courage:50,integrity_loyalty:45}},   // stat：延攬各職的能力下限（比物色寬）
  introMin:1,introMax:2,refuse:2},
  drift:{name:'另謀高就：本城沒見過面的人才多於保留數時，每旬一人搬到別的城的機率',p:0.35,keep:12},
  roleShift:{name:'職業調整：每季第一旬，本城低於基本數的身分從多出的身分轉入一人（只轉沒見過面、手帳沒有的人）',base:{broker:2,guest:6,manager:4}},
  shareShip:{name:'市佔修正：沒出貨不加市佔（出貨達配額幾成才算）；舊算法達幾成算有市場、掉到幾成回到新人；有市場後實際出貨占比的比重',shipMin:0.5,est:0.10,reset:0.05,w:0.6},
  riot:{name:'打毀：主食或鹽的收市價高於基準幾倍、連續幾旬',idx:2.5,streak:5},
  dapanDependency:{name:'大盤依賴度（實際出貨來源的固定基準價額加權）',win:9,knownMin:0.95},
  lux:{name:'奢侈品需求冷熱循環（久無買家、一賣吃數年）',warmMin:10,warmMax:30,dryMin:18,dryMax:100,dryMult:0.08,burstT:2,mulDiv:3,mulMin:9,mulMax:27,news:0.9},
  buyLimit:{name:'相場進貨上限（需求×市佔率；參加協議者再加協議配額；番頭與大番頭每人加成；無條件捨去，至少 1）',mult:0.8,perBantou:0.3},
  chief:{name:'大番頭每旬自理事務（70%自動問候／10%意外之財／20%無事；大番頭累計賺得的意外之財超過當前現款，下一旬必捲款潛逃）',visitP:0.7,windfallP:0.1,visitMin:1,visitMax:3,gainMin:5,gainMax:10,newFriendP:0.25,windfallMin:0.01,windfallMax:0.10},
  hold:{name:'持有成本與風險（依貨值）',rate:0.003,riskDiv:400000,riskMax:0.12,lossMin:0.1,lossMax:0.35,guardCut:0.1},
  rivalEvent:{name:'同業突發事件',p:0.05,good:0.5,news:0.5},
  cartelPledged:{name:'誓言守配額卻超量被查獲',base:0.25,slope:0.35,max:0.9},
  cartelSecret:{name:'暗約偷跑被告發',base:0.12,slope:0.18,max:0.8},
  guildPolicy:{name:'開局第一期的協議方針（維持／減供各半）；之後由例會投票決定。參加協議者的配額與同業目標供給，維持為各自穩定供應量九成、減供為七成',normal:0.5,normalRatio:0.9,restrictRatio:0.7},
  meeting:{name:'公會例會：菓子折份量（兩）、起標、出價級距；同業跟票上限、沒你投票時投減供機率、不出價機率',lotMin:8000,lotMax:12000,start:6000,step:500,followMax:0.8,restrictP:0.6,skipP:0.25},
  guildBond:{name:'協議訂約金一期的旬數（自動續押，期滿分配違約金）',turns:9},
  cityPopulation:{name:'城市人口每九旬依全城需求被滿足的比例調整（平常需求，不含節慶、大名行列、大相撲、夫人捧場與奢侈品冷熱；同業與你的出貨合計，每項以需求為上限、按基準價加權，九旬平均）：hi 以上 +all、mid 以上 +majority、lo 以上 −majority、lo 以下 −all',turns:9,all:0.02,majority:0.006,hi:0.80,mid:0.72,lo:0.62,min:1000},
  newProd:{name:'每年一月上旬，隨機城市新增一項本業貨產地',p:0.10},
  buyout:{name:'大口買付：五區各自每季隨機一個月；首年略過第一季',quarters:[[1,3],[4,6],[7,9],[10,12]],firstYearSkip:1},
  /* —— 人際·員工·家族 —— */
  introBacklash:{name:'引薦性向全不合時反遭嫌棄',p:0.35},
  skim:{name:'員工私吞（每旬；其餘倍率見 07zs_staffcare.js 的 STAFF）',greed:0.6,betray:0.5,loyal:0.7,cap:0.6},
  flee:{name:'番頭／大番頭捲款潛逃',p:0.004},
  auditDetect:{name:'查帳查出私吞',base:0.5,commerceDiv:200,max:0.95},
  marry:{name:'說親成功率',base:0.45,perScore:0.2,min:0.15,max:0.95},
  prodigal:{name:'子女淪為敗家子（每年）',p:0.3},
  birth:{name:'添丁（每年）',p:0.24,male:0.5},
  death:{name:'主角死亡（每年新年擲一次；rollAge 歲起才擲，startAge 歲起每年遞增）',rollAge:40,startAge:45,perYear:0.022,base:0.003},
  /* —— 出門·路遇·仇人 —— */
  ambushDefend:{name:'遇襲時保鏢戰力≥此值必定退敵，否則以 (戰力/此值)² 為退敵率',power:70},
  ambush:{name:'出門遇襲',base:0.005,perFame:0.0001,min:0.005,max:0.03,perEnemy:0.03},
  encounter:{name:'路遇求助的人',p:0.10,known:0.5},
  enemyFire:{name:'每位仇人增加的失火機率',p:0.02},
  enemyThief:{name:'每位仇人增加的盜賊機率',p:0.02},
  /* —— 官府 —— */
  imperial:{name:'欽差突查：風聲高於此值才會被罰款',heat:4},
  calm:{name:'巡見使口添：一般風聲不增加的旬數（重罪照加）',turns:9},
  out:{name:'外城友人（07zzn_outfriend.js）：牽線機率與起始好感、順道問候好感；寄信的送信費、好感增量、最多加到；作客與來訪的好感門檻；來訪機率、好感、減壓；作客的好感、減壓、經友人引見的機率、每旬路費（私房錢）、沒有大番頭時每旬短少的現款比例；注文的好感門檻、每旬出現機率、加價範圍（好感門檻～100）、幾旬內要出發、交齊加好感、失約扣好感；遠國奉行引薦的起始好感',meetP:0.25,meetAff:20,greetAff:5,letterFee:50,letterGain:[4,8],letterCap:60,visitAff:60,comeP:0.03,comeAff:3,comeRelief:5,tripAff:10,tripRelief:10,tripMeetP:0.3,tripGold:20,awayLoss:0.02,chumonAff:40,chumonP:0.10,chumonUp:[0.1,0.3],chumonTurns:6,chumonDone:5,chumonFail:20,introAff:40},
  kake:{name:'定約掛賣（07zzm_kake.js）：解鎖市佔、請託好感、主動上門的好感與機率、每旬標記人數、合約旬數、每張合約佔有效總資產、三個方案的數量與價格倍率、手付比例、不超過旅商身代的比例、每旬不超過單項庫存上限的比例、大單門檻（台詞用）；貸倒機率、番頭商才每幾點減多少、災情年倍數、旅商不在時的貸倒機率、貸倒扣好感；拖一季的機率（好感 60 時）與旬數；失約扣好感',unlock:0.10,aff:60,selfAff:100,selfP:0.03,marks:[3,5],turns:9,frac:1/9,plans:[{k:'lo',q:1.2,p:0.9},{k:'mid',q:1,p:0.95},{k:'hi',q:0.8,p:1}],dep:0.2,worthCap:0.3,capHalf:0.5,bigTotal:5000,bad:0.05,skillPer:20,skillCut:0.01,disasterX:2,goneBad:0.5,badAff:20,late:0.10,lateTurns:9,failAff:30},
  evil:{name:'惡德（07zzl_tripev2.js；目前只累計）：闕所、暗殺、放火、栽贓、打壓；失手或事敗的倍率',kessho:5,assassin:3,arson:3,frame:2,suppress:2,failMul:0.5},
  heat:{name:'風聲來源（只算與官員的往來與勾結）：拜訪官員出過價（visit 一般與清官、visitGreedy 貪官）、寄信給貪官、一般請託開口、賣捌口利、吉原夜宴有役人入席；own＝勾結類請託各有自己的風聲、不另加；none＝不加風聲的請託（壓風聲與正當申報）',visit:0.1,visitGreedy:0.15,favor:0.1,sellAid:0.5,feast:0.5,own:['sellAid','rconsignSea','rconsignLand','rkokusho','suspend','rwreck','rrobbed'],none:['hush','rvisit','fireAid','cargoAid','theftAid']},
  inspect:{name:'町奉行查貨（每旬）',base:0.30,perFame:0.25,min:0.05,max:0.30},
  regionRevoke:{name:'風聲≥5 時，巡見使吊銷許可（每旬）',p:0.03,heat:5},
  /* —— 走私 —— */
  raid:{name:'奉行所搜查（每旬）',base:0.015,perHeat:0.01,heatCap:10,perContraValue:0.02,contraCap:0.1,perEnemy:0.02,blindMul:0.25,exemptMul:0.7,max:0.6,minHeat:6},
  raidBlind:{name:'同心收袖之下後睜一隻眼',p:0.6},
  smugSeize:{name:'走私船入港被扣',perDanger:0.06,perHeat:0.01,blind:0.05,min:0.02,max:0.6},
  confess:{name:'被捕者供出主使',base:0.75,loyalDiv:130,min:0.1,max:0.7},
  /* —— 海陸運（遇險率隨旬數累積，受船長膽力影響）—— */
  crewRisk:{name:'船長／飛腳能力換算遇險倍率',base:1.3,perCourage:0.006,commerceDiv:500,min:0.7,max:1.3},
  voyageRisk:{name:'委託採買每旬遇險率',sea:0.03,land:0.022,guardLand:0.004,min:0.03,max:0.35,escortMul:0.5},
  voyageKind:{name:'委託採買買什麼：跨行貨機率（其餘買本業貨）；目的地沒有本業貨時改買他行貨的機率（其餘空手而回）；唐物藥種夾帶違禁品的機率、數量',cross:0.2,noOwnCross:0.2,carry:0.2,carryMin:3,carryMax:5},
  originSupply:{name:'每城、每項貨、每月固定的產地供貨指數；分類產量與同月同城後續商隊會折減可供量',min:0.60,max:1.40,priceSlope:0.30,priceMin:0.85,priceMax:1.15,priceJitter:0.06,production:{staple:1.15,normal:0.85,luxury:0.35},repeat:{staple:0.8,normal:0.6,luxury:0.4}},
  voyageMix:{name:'多項本業貨的委託採買分配：少數均衡，多數偏重或集中於一項',balanced:0.10,biased:0.60,biasedMin:0.60,biasedMax:0.75,focusMin:0.75,focusMax:0.90,supplyPow:1.5,pricePow:2},
  smugRisk:{name:'走私船每旬遇險率',p:0.04,min:0.03,max:0.45},
  /* —— 跨行貨物 —— */
  xLoan:{name:'商人拿貨抵押借錢上門（每旬）',p:0.05},
  xForce:{name:'役人硬塞貨物（每旬）',p:0.04},
  smugglerArrest:{name:'闇商人落網（每旬，近期替你脫手者）',from:3,perHeat:0.02,max:0.12,window:36,jail:36},
  /* —— 其他 —— */
  chatMix:{name:'點人聊天內容比例（其餘為閒聊）',outsider:0.2,staff:0.3},
  gossipMet:{name:'聊天：偏向說已認識者的流言',p:0.6},
  /* —— 醜聞扣知名度（直接扣，不打折）—— */
  fame:{name:'知名度：上限、階級門檻、加分遞減；私房錢滿 goldTier 兩再加一階（只加一階）；gate 以上小事件不加、中事件三分之一、大事件照原值',gate:125,midCut:1/3,cap:200,tiers:[30,80,150],goldTier:2000,damp:130,floor:0.25},
  fameLoss:{name:'醜聞扣知名度',kakeFail:1,staffEv:1,inspect:6,scapegoat:3,cartelPledged:4,cartelSecret:5,riot:8,raid1:2,raid2:6,raid3:12,region:3,arrest:6,flowerPer200:0.5,raidRival:2,disown:2,tributeFail:1,gmFall:10,gmLevy:5},
  /* —— 暗殺 —— */
  assassin:{name:'暗殺成功率',base:0.45,courageDiv:250,commerceDiv:400,perRank:0.06,min:0.12,max:0.85},
  assInvestigate:{name:'命案後官府追查',base:0.12,perHeat:0.03,perRank:0.04,min:0.15,max:0.6},
  /* —— 放火（同暗殺機制；對象為隨機同業，視同官階 3）—— */
  arson:{name:'放火成功率',base:0.45,courageDiv:250,commerceDiv:400,rank:3,perRank:0.06,min:0.12,max:0.85,minCourage:70},
  /* —— 官員栽贓（吟味方）／打壓（普請方）：機制同放火，成功率以官員自身膽力與商才計 —— */
  frame:{name:'栽贓成功率',base:0.45,courageDiv:250,commerceDiv:400,rank:3,perRank:0.06,min:0.12,max:0.85},
  suppress:{name:'打壓成功率',base:0.45,courageDiv:250,commerceDiv:400,rank:3,perRank:0.06,min:0.12,max:0.85,turns:6,evMul:0.6},
  schemeInvestigate:{name:'官員運作後被查辦',base:0.12,perHeat:0.03,rank:3,perRank:0.04,min:0.15,max:0.6},
  /* —— 上貢（勘定方官員好感 100）：限期內備妥本業貨，到期按市價倍數自動上貢 —— */
  tribute:{name:'上貢',quotaMult:3,min:5,turns:4,priceMul:3,fame:3,shareUp:0.05,failAff:30},
  arsonInvestigate:{name:'縱火後官府追查',base:0.12,perHeat:0.03,rank:3,perRank:0.04,min:0.15,max:0.6}
  /* 店員偶發事件（07zt_staffevents.js）：每旬每位店員約 0.9% 起事、全店每旬最多一件；權重 w*；金額 90～110 兩；
     payAff／ignAff 出錢／不管的好感增減，payLoyal 忠誠成長，jail 關押旬數，relapse 賭癮再犯機率，creditor 債主上門機率，quit 番頭以上請辭機率 */
  ,staffEvent:{name:'店員偶發事件',perEmp:0.009,cap:0.12,cooldown:36,wedTenure:36,costMin:90,costMax:110,
    wWeak:6,wStat:2,wIll:1.5,wIllWeak:4,wWed:1.5,wPoach:1.5,wFrame:0.5,
    gamble:{payAff:12,ignAff:-10,relapse:0.3,relapseMin:9,relapseMax:30,skimTurns:36,creditor:0.2},
    drunk:{payAff:8,ignAff:-8,jail:3},
    ill:{payAff:15,payLoyal:2,ignAff:-12,quit:0.1},
    wed:{payAff:10,payLoyal:1,ignAff:-3},
    poach:{payAff:5},
    frame:{payAff:10,ignAff:-15,jail:6}}
  /* 災情救濟請託（07zu_relief.js）：soup 施粥（知名度、風聲減量、主食行情倍率、官員好感），import 緊急御免（旬數、進貨上限倍數、知名度），build 普請御用（每項收購約幾旬配額、收購價倍率、知名度） */
  ,branch:{name:'暖簾分（07zy_branch.js）：大番頭年資、累計意外之財門檻、調貨機率、給滿次數、送回金額、回絕次數、送錢機率與金額',tenure:36,wind:10000,visitP:0.1,times:10,repayMin:8000,repayMax:12000,refuse:3,payP:0.05,payMin:3000,payMax:5000}
  ,ronin:{name:'浪人頭（07zw_ronin.js）：最多結識人數、結識機率（指名、夜宴、遇襲）、結識好感、要錢次數門檻、各階金額（浪人、一～三階）、每升一階機率倍率',maxKnown:3,nominate:0.1,feast:0.15,ambush:0.3,aff:10,times:10,amt:[50,100,200,400],decay:0.75}
  ,smugMeet:{name:'結識闇商人（07g_smuggle.js）：指名花魁偶遇、包場夜宴混入的機率，結識時的好感',nominate:0.1,feast:0.15,aff:10}
  ,bandit:{name:'海賊山賊猖獗（07zv_bandit.js）',turns:3,quellFame:3}
  ,shun:{name:'不在協議時（沒參加或違約被查獲後）：仲買人銷貨的牌價成數（平常 0.7）、旅商人代售價再打的折扣（07x_dealers.js）',broker:0.5,xsell:0.7}
  ,rivalLot:{name:'同業調貨（07x_dealers.js）：每次的數量範圍、金額上限範圍（取兩者較少的那個）',qty:[30,50],cap:[3000,4000]}
  ,regConsign:{name:'官船捎帶／官荷捎帶（07zz_regfavor.js）：第二貴貨的機率、到貨旬數、風聲；sea／land 約值與付款',second:0.2,turns:3,heat:0.2,sea:{value:3000,pay:2000},land:{value:1500,pay:1000}}
  ,honjin:{name:'本陣御用達（07zz_regfavor.js）：每旬約值、旬數、市價加成、失約扣好感',value:500,turns:3,markup:1.2,failAff:30}
  ,letter:{name:'外地遠國奉行所寄信（07zz_letters.js）：送信費、好感增量、最多加到、寄給貪官的風聲（其餘官員不加）',fee:100,gainMin:4,gainMax:8,cap:60,heat:0.1}
  ,favor80:{name:'人情往來與朋友事件（07zz_friends.js）：朋友門檻、慰問與慶功宴好感、朋友來慰問人數與好感',aff:80,gainMin:4,gainMax:8,visitMax:3,visitGainMin:1,visitGainMax:3}
  ,lend:{name:'朋友來借東西（07zz_friends.js）：閒置連續旬數、冷卻、婉拒扣好感、違禁品機率（一般／闇商人）、借倉旬數與佔倉比例、寄放費率、借人旬數與酬勞、答應加好感',idleTurns:3,cd:12,refuseAff:10,contra:0.05,contraSmug:0.3,lodgeMin:3,lodgeMax:5,lodgeShareMin:0.3,lodgeShareMax:0.5,lodgeFeeRate:0.08,lodgeFeeMin:50,crewMin:2,crewMax:4,feeSea:[150,300],feeLand:[100,200],okAff:5,crewAff:5,hurtMin:2,hurtMax:4,bustInspect:0.6,betrayAff:40}
  ,stash:{name:'向朋友借倉庫（07zz_friends.js）：放不下時發生的機率、冷卻、保管費率、寄放旬數、過期代賣價、朋友家出事的損失比例',p:0.5,cd:12,feeRate:0.1,turns:3,sellRate:0.7,fireLoss:0.5,theftLoss:0.3}
  ,friendTip:{name:'好感 100 的商人朋友在閒聊中講出官員軟肋',p:0.2}
  ,swap:{name:'旅商換貨（07zz_friends.js）：每旬機率、換來本業貨的機率、比價浮動、次貨機率與折損、夾帶違禁品機率、寄夾旬數',p:0.03,own:0.5,ratioMin:0.7,ratioMax:1.3,poor:0.15,poorMin:0.2,poorMax:0.4,contra:0.05,contraTurns:6}
  ,tally:{name:'唐船割符（07zz_regfavor4.js）'}
  ,unload:{name:'國中物卸留（07zz_regfavor4.js）：公款、審理旬數',pay:3000,review:3}
  ,unloadJob:{name:'卸留請負（07zz_regfavor4.js）：需求倍數（旬數）、期限、報酬倍率、遇險損失、失約扣好感',turns:9,limit:6,payRate:1.5,lossRate:0.7,failAff:30,minQty:5}
  ,kokusho:{name:'國商助成（07zz_regfavor4.js）：出資、旬數、每旬回扣、風聲',pay:5000,turns:10,min:430,max:470,heat:0.5}
  ,daimyo:{name:'大名行列過境（07zzc_daimyo.js）：當旬本業貨需求倍率',mult:2}
  ,stress:{name:'壓力（07zzi_stress.js）：疲憊／心力交瘁門檻、病倒門檻、病癒後壓力；每用一點行動、拒見、交涉失利、不善言辭、暗殺放火栽贓打壓、供貨不穩、失火、現款為負；自然恢復、每點沒用完的行動、夫人與子女在家、宴會、夜宴、指名、節慶、忘年會、闔家同遊；疲憊以上進出貨拉霸手抖的機率（疲憊、心力交瘁）與偏離幅度（拉霸全長的比例、最少一格）；心力交瘁後幾歲起、每年壽數判定加多少；扣知名度事件對應的壓力',tiers:[40,70],sick:90,after:60,ap:1,refuse:3,lose:2,snub:5,dirty:8,unstable:2,fire:6,debt:3,natural:2,idle:1,family:1,banquet:5,feast:5,nominate:2,fest:5,party:15,famwalk:10,oldAge:45,shakeP:[0.3,0.6],shakeFrac:0.02,oldDeath:0.02,fameKeys:{raid1:5,raid2:8,raid3:10,riot:8,inspect:5,arrest:8,tributeFail:3}}
  ,trip:{name:'外城出遊（07zzi_stress.js）：寺社（行動、減壓、求籤機率——籤只是氣氛）；香油錢上限、每格、每多少兩多減一點壓力、最多多減、捐到多少加知名度、加多少、溫泉（行動、減壓）；寺社、溫泉都是每旬一次；香油錢加知名度算小事，知名度到門檻後不再加',temple:{ap:1,relief:3,omen:0.5},giftMax:100,giftStep:5,giftPer:10,giftReliefMax:2,giftFameAt:100,giftFame:1,onsen:{ap:3,relief:8},compP:0.2,compNo:3,compAff:{temple:5,onsen:10},compRelief:1,batherAff:5,pill:{p:0.08,turns:3,lv:[{price:10,good:0.5},{price:50,good:0.75},{price:100,good:1}]},sansuke:{p:0.15,ask:[50,100,500],back:2},tea:{gift:1000,hi:[60,75],greed:[15,35],betray:[10,25],aff:60},bless:{p:0.05,heat:1},season:{onsenWinter:2,templeAutumn:1,templeSpringAff:2},sumo:{p:0.10,gold:500,after:3,mult:2,fame:2},artisan:{p:0.05,amt:[500,1000],step:50,turns:9,val:[150,250],failP:0.2},rush:{p:0.05,qty:[20,40],minQty:5,price:0.4,blackP:0.3,foundP:0.5,within:6,fine:0.5,bribeX:5,heat:0.5},komon:{p:0.03,clean:2,guiltyAt:20,guilty:[5,10]}}   // 第二批奇遇（07zzl_tripev2.js）：sumo 贊助大相撲（機率、私房錢、幾旬後開場、需求倍數、知名度）；artisan 落魄的手藝人（機率、借款範圍與級距、送貨旬數、每旬貨值、中途出事機率）；rush 急商（機率、數量、最少數量、牌價成數、贓貨機率、被找上門機率、幾旬內、罰銀佔貨值、打點是查貨賄賂的幾倍、打點的風聲）；komon 擦身而過（機率、清白減壓、心虛門檻、心虛加壓）   // pill 賣藥郎：出現機率、藥效旬數、三級價錢與真藥機率；sansuke 三助投資：開口機率、三次開口金額、還錢倍數；tea 三獻茶：本城寺社累計香油錢門檻、能力偏高區間、貪欲與背叛區間、起始好感；bless 祈福：機率、風聲減幾點；season 季節小景：冬溫泉多減壓、秋寺社多減壓、春寺社同行好感多加（07zzk_tripev.js）   // compP 有人要求同行的機率；compNo 婉拒扣好感；compAff 同行好感；compRelief 有人作伴多減的壓力；batherAff 溫泉碰到的人好感
  ,wife:{name:'夫人事件（07zzh_wife.js）：壞事每年發生率、成親後幾旬才開始、一生上限；幫夫人添丁加成與當年上限；連續幾次視而不見離家、離家扣知名度；欺負店員被逼退時其他店員好感、視而不見後揩油大膽旬數；爭執站夫人大番頭好感、站大番頭好感；擋下官員好感；捧場倍率與旬數；娘家消息降風聲',badP:0.6,badAfter:18,badMax:3,birthUp:0.12,birthCap:0.3,leaveAfter:2,leaveFame:5,bullyOthers:2,boldTurns:9,quarrelAff:15,chiefUp:5,flameAff:15,fansMult:1.5,fansTurns:2,heatCut:1}
  ,chanceMeet:{name:'拜訪巧遇（07zza_chancemeet.js）：機率、好感增幅、優先挑同類的機率',p:0.1,gainMin:5,gainMax:10,sameKind:0.7}
  ,escort:{name:'陪同·朋友請你引薦官員（07zzb_escort.js）：機率、冷卻、官員官階上限與好感門檻、朋友與官員好感增減、婉拒與失約扣好感、貪欲門檻、牽連機率與旬數、風聲',p:0.2,cd:12,maxRank:3,offAff:60,friendHi:10,friendLo:5,offHiMin:2,offHiMax:3,offBad:5,offCost:1,decline:10,skip:5,greedy:65,riskP:0.25,riskMin:6,riskMax:18,riskHeat:1}
  ,relief:{name:'災情救濟',soupFame:6,soupHeat:3,soupStaple:0.75,soupAff:10,importTurns:2,importMult:2,importFame:2,buildTurns:2,buildMul:1.4,buildFame:3}
};
/** 擲骰：以 ODDS[k].p（或自訂 p）判定是否發生。 */
const roll=(k,p)=>chance(p===undefined?ODDS[k].p:p);
