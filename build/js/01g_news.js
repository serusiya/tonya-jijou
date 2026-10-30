/* =====================================================================
 * 01g_news.js — 旬報／新聞事件文字總表
 *  所有出現在旬報、新聞欄、事件通知的文字集中在 NEWS_TXT。
 *  鍵名：<函式名>.<序號>，如 setEv（市場隨機事件）、inspection（欽差突查）、smugTick（走私結果）、yearTick（新年／訃報／添丁）。
 *  {名稱} 為佔位，由呼叫處 NEWS('key',{名稱:值}) 代入；數字、人名由程式算好傳入。
 *  條件判斷（機率、是否發生）仍在程式裡，這裡只放「發生後顯示的字」。
 *  機率在 01c_odds.js、費用在 01b_costs.js、人物台詞在 01d_lines.js、其他提示在 01f_messages.js。
 * ===================================================================== */
const NEWS_TXT={
  /* —— newGame —— */
  "newGame.1":"📜【開業】{name}接掌家業，於【{CITY}】懸掛「{firm}」暖簾。",
  "newGame.guild":"⚖️【公會】開業時已是株仲間會員，並參加聯合採購與出貨協議；擔保金 {c} 兩由家中長輩代墊。本期決議為「{policy}」，參加協議可享聯合採購價與進貨配額加給，記得守住協議配額。",
  "guild.rivalCaught":"⚖️【公會】同業「{n}」超量拋售「{item}」被查獲，擔保金沒收。",
  "guild.div":"⚖️【協議分紅】本期 {k} 家同業違約被沒收擔保金，由守約的 {n} 家平分，你分得 {sh} 兩。",
  "meet.soon":"⚖️【公會】下旬召開問屋公會例會：表態、投票決定本期供給，還有菓子折拍賣。",
  "meet.today":"⚖️【公會】本旬召開問屋公會例會，主畫面可前往出席。",
  "meet.autoVote":"⚖️【公會例會】你沒有出席。同業投票，維持 {n} 票、減供 {r} 票{tie}；本期方針為「{p}」。",
  "meet.lotMe":"🍡【菓子折】你以 {p} 兩標下「{n}」{q} 單位，貨已入倉。",
  "meet.lotRival":"🍡【菓子折】「{who}」以 {p} 兩標下「{n}」{q} 單位。",
  "meet.lotNone":"🍡【菓子折】本期的「{n}」沒有人出價，退回大盤。",
  "guild.policy.restrict":"⚖️【協議決議】本期「減供」：各家依減供配額出貨，壓低供給以維持行情。",
  "guild.policy.normal":"⚖️【協議決議】本期「維持」：全體總配額以本城需求為準，你的配額等於穩定供貨線，其餘由同行依市占率分配。",
  "guild.policy.normalNone":"⚖️【協議決議】本期「維持」：全體總配額以本城需求為準；你未參加協議、沒有保留配額，供應量全數由協議內同行依市占率分配。",
  /* —— receiveOrders —— */
  "rivalDump":"🏪【同業】「{who}」大舉拋售「{name}」，存貨傾巢而出，近日行情恐怕被壓低。",
  "luxDry":"🏮【行情】近來「{name}」門庭冷落，達官貴人不再問津，不知何時才有買家。",
  "luxBurst":"🎎【行情】大名與豪商競相採買「{name}」，買盤湧入，行情暴漲！",
  "holdTheft.1":"🥷【失竊】庫房中價值不菲的「{name}」遭人潛入盜走 {l} 單位！",
  "holdTheft.2":"🐀【損失】受潮與蟲鼠侵擾，高價的「{name}」報損 {l} 單位。",
  "holdTheft.3":"📜【查扣】官差以『來路不明』為由，扣押了庫中的「{name}」{l} 單位。",
  "holdFee":"本旬倉儲與保險費 {fee} 兩。",
  "chief.guild":"🏛️【大番頭】代你出席株仲間例會，{stance}。",
  "chief.raise.ok":"🏛️【大番頭】在例會上提案增加配額，獲同行首肯，配額提高為需求的 {pct}%。",
  "chief.raise.fail":"🏛️【大番頭】在例會上提案增加配額，被同行擱置。",
  "chief.uneasy":"😟【人心不穩】庫裡現銀見底，大番頭「{name}」數日來神色不安，頻頻望向門外。",
  "chief.friend":"🤝【大番頭】代你結識了新朋友：{who}，好感 +{gain}。",
  "chief.windfall":"💰【大番頭】替店裡談成一筆意外的買賣，進帳 {amt} 兩。",
  "chief.visit":"🚶【大番頭】代你登門問候：{list}。",
  "receiveOrders.1":"📦【到貨】{items} 已入倉。",
  /* —— setEv —— */
  "setEv.1":"🔥【火災急報】千代田町夜起狂風，大火焚毀民房數百戶，建材與薪炭行情狂飆！",
  "setEv.2":"🌾【凶作】旱象不退，米麥歉收，米價日日上漲，市井人心惶惶。",
  "setEv.3":"🌾【豐收】今秋風調雨順，新米大量入倉，米麥價格回落。",
  "setEv.4":"🌊【颱風】海面風浪滔天，鹽船與漁船暫緩出港，在途海運船隊延誤一旬。",
  "setEv.5":"🤒【疫病】市井傳出時疫，生藥與香辛身價暴漲。",
  "setEv.6":"⚔️【名匠】備前長船名匠開爐鑄造太刀，高官豪商出價千兩競逐，奢侈品行情看俏。",
  "setEv.7":"🏮【花街秘聞】吉原名伶道中獻藝，傳聞官員與私梟暗中接頭。",
  "setEv.8":"📉【同業傾銷】同行大舉拋貨，本業行情走軟。",
  "setEv.10":"⚒️【軍需】沿海諸藩整備海防，銅鐵與硫磺搶手，行情大漲。",
  "setEv.9":"📈【買氣回升】近日城中買氣旺盛，本業行情回暖。",
  /* —— inspection —— */
  "inspection.2":"🕵️【欽差突查】中央巡按徹查官商往來，查獲你的私房錢往來痕跡！罰銀 {fine} 兩，知名度 -6，靠山受牽連。",
  "inspection.3":"🕵️【欽差巡視】中央巡按入城巡視，所幸你向來謹慎，無事。",
  /* —— officialFall —— */
  "officialFall.1":"📜【官場】三系官署人事微調，一批吏員調任他處。",
  "officialFall.2":"⚡【政爭】「{nm}」受你牽連遭上司申斥，為求自保把罪責推到你頭上：罰銀 {fine} 兩，知名度 -3。",
  "officialFall.3":"⚡【政爭】政敵拿你與「{nm}」的往來大做文章，{nm}受你牽連遭上司申斥，對你頗有怨言。",
  "peopleMove.official":"📜【官員調任】「{out}」調往【{dest}】；「{in}」自【{from}】調來本城，接掌{post}。",
  "peopleMove.residence":"🏯【宅邸異動】{kind}「{out}」遷往【{dest}】；「{in}」自【{from}】遷入本城。",
  /* —— officialExtort —— */
  "officialExtort.1":"📜【官場】近日官員多有請託，皆言「些許心意即可」。",
  "officialExtort.2":"🤝【索賄】官員「{n}」暗示需再「表示心意」，不然恐生變數。（見筆記·往來實錄）",
  /* —— thieves —— */
  "thieves.1":"🛡️【治安】盜賊夜探倉庫，被保鏢當場擊退。",
  "thieves.2":"🥷【盜賊】夜間遭賊潛入倉庫，損失「{k}」{l} 單位。",
  /* —— evalCartel —— */
  "evalCartel.1":"⚖️【公會制裁】你誓言守配額卻超量出貨，被株仲間查獲！{bond}三旬內遭聯合斷貨，進貨價飆升，知名度 -4。",
  "evalCartel.2":"⚖️【暗約敗露】你私下偷跑被同業告發！{fine}並遭聯合斷貨三旬，知名度 -5。",
  /* —— invUpkeep —— */
  "invUpkeep.1":"🔥【倉庫失火】易燃貨物起火，連環波及，共燒毀 {tot} 單位貨物！（保鏢可降低機率）",
  /* —— riot —— */
  "riot.1":"🔥【打毀】主食與鹽價居高不下，市民憤而暴動搶倉，奉行所開倉平準。",
  "riot.loss":"商號倉庫被搶走 {tot} 單位貨物。",
  "riot.safe":"所幸商號倉庫沒有損失。",
  "riot.2":"官府拿囤積居奇的商號開刀，你被當成替罪羊，罰銀 {fine} 兩，知名度 -8！",
  "riot.3":"幸而官場靠山護住了你，替罪羊另有其人。",
  /* —— shipsTick —— */
  "shipsTick.1":"⛵【到貨】{name}「{short}」{q} 單位運抵入倉{q2}。",
  /* —— cityTick —— */
  "cityTick.1":"🏮【節慶】【{name}】「{festival}」開幕！宵禁解除，全城買氣大旺，酒、油、布料尤其搶手。",
  "cityTick.2":"📜【城史】【{name}】{title}。",
  "city.population":"🏯【城勢】近三個月穩定供貨 {stable} 旬、不穩定 {unstable} 旬；{result}。人口由約 {before} 人變為約 {after} 人（{rate}）。",
  /* —— peopleTick —— */
  "peopleTick.1":"⏰【失信】對「{cid}」的承諾已逾期，對方頗為不快。",
  "peopleTick.due":"🏦【還款】有一筆 {d} 兩的借款，兩旬後到期。",
  "peopleTick.2":"🏦【還款】官倉平準貸款到期，償還 {d} 兩。",
  /* —— empTick —— */
  "empTick.1":"💸【捲款潛逃】{rank}「{name}」捲走現款 {take} 兩，不告而別！",
  /* —— marry —— */
  "marry.1":"💍【喜事】{name}娶得{name2}，宅邸添了女主人。",
  /* —— yearTick —— */
  "yearTick.1":"🎍【新年】{year}到來，你今年 {myAge} 歲。",
  "yearTick.2":"🕯️【訃報】「{name}」於本年病逝。",
  "yearTick.3":"🕯️【訃報】{rank}「{name}」病逝，商號失一臂助。",
  "yearTick.4":"👶【天賦】「{name}」漸漸顯露天賦，似乎擅長「{top3Of}」。",
  "yearTick.5":"😞【敗家子】「{name}」沉迷賭坊，欠下鉅額賭債，債主上門索討！",
  "yearTick.6":"👶【添丁】家中添了{gender}孩「{name}」，宅邸裡多了孩子的笑聲。",
  /* —— 巡察、忘年會 —— */
  "tour.month":"🏯【巡察】{part}。",
  "party.held":"🏮【忘年會】{year}最後一夜，商號在大廣間設宴，{n} 人入席。",
  "party.skip":"🏮【忘年會】主人遠在島上，今年的忘年會停辦。",
  /* —— autoBuy —— */
  "autoBuy.1":"📥【自動進貨】{got} 已下單。",
  /* —— autoShip —— */
  "autoShip.1":"📤【自動出貨】{rev}。",
  /* —— charity —— */
  "charity.1":"🍚【義舉】{name}於{homeCity}開倉施粥，百姓感念。",
  /* —— skimTick —— */
  "skimTick.1":"🟨【私房錢】本旬盈餘 {surplus} 兩，按 {p}% 抽出 {amt} 兩存入私房錢。",
  /* —— injuryTick —— */
  "injuryTick.1":"💪【傷癒】傷勢痊癒，可以再度出門。",
  /* —— rollAmbush —— */
  "rollAmbush.1":"⚔️【遇襲】途中遭人埋伏，保鏢「{name}」拔刀退敵，毫髮無傷！",
  "rollAmbush.2":"🩸【遇襲】途中遭人埋伏，保鏢「{name}」替你擋下一刀，當場殉職……",
  "rollAmbush.3":"🤕【遇襲】途中遭人埋伏，身邊無保鏢，你負傷倒地。需靜養 {injured} 旬，期間無法出門。",
  /* —— inspectTick —— */
  "inspectTick.1":"🔎【查貨】{n}「{n2}」前來商號查貨。",
  /* —— inspectResolve —— */
  "inspectResolve.1":"公事公辦，被罰銀 {fine} 兩。",
  "inspectResolve.2":"🔎【查貨】{t}",
  /* —— enemyTick —— */
  "enemy.fade":"🍂【怨氣漸消】「{name}」對你的怨氣，隨著歲月漸漸淡了。",
  "enemyTick.1":"🗡️【仇家使壞】{replace}",
  /* —— smugTick —— */
  "smugTick.1":"🌊【走私船遇難】開往【{name}】的船遭遇風暴，「{name2}」損失 {lost} 單位。",
  "smugTick.2":"🚨【船貨被扣】走私船入港時遭奉行所水師攔檢，「{name}」{qty} 單位全數沒收！",
  "smugTick.3":"🗣️【船長供出主使】被捕的船長「{captName}」招出了你！",
  "smugTick.4":"⛓️【船長入獄】船長「{captName}」守口如瓶，獨自扛下了罪名。",
  "smugTick.5":"🏴‍☠️【走私到貨】「{name}」{q} 單位悄悄入了密庫{q2}。",
  /* —— raidTick —— */
  /* —— exileTick —— */
  "exileTick.1":"⛓️【遠島】主人在島上，由大番頭「{name}」代理一切商務。",
  "exileTick.2":"⛓️【遠島】主人不在、無人坐鎮，商號亂成一團，損失 {loss} 兩。",
  "exileTick.3":"🌅【赦免】遠島期滿，你回到了商號。",
  /* —— doRaid —— */
  "doRaid.1":"👀【睜一隻眼】同心前來搜查，卻對你的密庫視而不見——袖之下沒有白給。",
  /* —— seize —— */
  "seize.1":"🚨【{replace}】{g}",
  "seize.lessen":"減罪狀派上用場，刑罰減輕一等。",
  /* —— 遠島期間（主人不在）照配額進貨 —— */
  "away.buy":"🧾【主人不在】照協議配額進貨：{got} 已下單。",
  /* —— kind —— */
  "kind.1":"前往【{dest}】採買。{note}",
  "kind.2":"買入本業貨「{short}」{q} 單位，單價 {unit} 兩（約大盤基準價的 {pf}），共 {cost} 兩。",
  "kind.3":"看中「{short}」，但倉庫放不下，空手而回，委託金大多退還。",
  "kind.4":"撿到便宜貨：「{short}」{q} 單位，單價 {unit} 兩（約基準價的 {pf}），共 {cost} 兩。",
  "kind.5":"看中便宜的「{short}」，但倉庫放不下，空手而回。",
  "kind.6":"🏴‍☠️ {mode}順手夾帶唐船私貨「{name}」{q} 單位（共 {cost} 兩）{got}，已偷偷存入密庫。要脫手請找私梟，也要小心搜查。",
  "kind.7":"雜費與打點 {fee} 兩；委託金餘額退回 {refund} 兩。",
  "kind.8":"🚢【歸來】{mode}「{captName}」自【{dest}】{cross}{sea}。詳情見旬報。",
  /* —— xsell —— */
  "xsell.1":"💱【代售】座客商人「{introId}」把「{short}」{q} 單位整批收下，得 {rev} 兩（約基準價的 {m}%），好感 −{d}。",
  "smugglerArrest.talk":"⛓️【落網】私梟「{n}」在黑市交易時落網，熬不住拷問，把你供了出來。",
  "smugglerArrest.silent":"⛓️【落網】私梟「{n}」在黑市交易時落網，咬緊牙關，始終沒提你的名字。",
  /* —— xgoodsTick —— */
  "xgoodsTick.1":"🤝【借錢】商人「{n}」上門，想拿貨物抵押借錢。",
  "xgoodsTick.2":"🎁【官吏硬塞】「{n}」把一批沒收來的「{short}」{q} 單位塞進你的倉庫，要你「幫忙處理」。得自己找座客商人代售。",
  /* —— regionHeld —— */
  "regionHeld.1":"取得【{REG_NAME}】的關所通行手形，馬幫可在此地區通行。",
  "regionHeld.2":"取得【{REG_NAME}】的進港泊位許可，船隊可靠泊此地區各港。",
  "regionHeld.3":"遠國奉行簽發通商特許：【{REG_NAME}】海陸許可齊備，採買雜費永久再少一成。",
  /* —— regionTick —— */
  "regionTick.1":"🕵️【巡見使巡視】中央巡見使風聞你的帳目不清，吊銷了你的「{sea}許可（{k}）」，罰銀 {fine} 兩，知名度 −3。",
  /* —— appGrant —— */
  "appGrant.1":"📜【獲准】{name}：{msg}",
  /* —— appsTick —— */
  "appsTick.1":"📬【申請】先前擱置的「{name}」終於送入審理（約 {left} 旬）。",
  /* —— ransom —— */
  "ransom.1":"💍【贖身】{name}為吉原名伶「{name2}」贖身，納為側室，轟動全城，知名度 +{f}。",
  /* —— assassinate —— */
  "assassinate.1":"🗡️【命案】{cid}於夜間遇害，奉行所正在調查。",
  /* —— arson —— */
  "scheme.frame":"⚖️【查抄】同業「{name}」被官府查抄，傳聞涉及不法，商號元氣大傷。",
  "scheme.suppress":"📛【打壓】同業「{name}」遭官府刁難，批文遲遲不下，生意受阻。",
  "tribute.ok":"🎁【上貢】你把答應的「{item}」{qty} 單位送到「{off}」手上。對方爽快付了 {rev} 兩，知名度 +{fame}，商號的名聲也更響亮了。",
  "tribute.fail":"💢【上貢失約】約定的日子到了，「{item}」卻只備了 {have} 單位，離答應「{off}」的 {qty} 單位還差一截。對方臉色很難看，交情 -{aff}，知名度 -1。",
  "arson.1":"🔥【縱火】同業「{name}」的倉庫深夜失火，庫存付之一炬，市面風聲鶴唳。",
  "staff.grow":"🎓【店員】{list}",
  "newProd":"🌱【物產】{city}試種「{name}」有成，今後成為產地，委託採買可以去那裡買了。",
  /* —— 巡察、開局 —— */
  "tour.arrive":"{c}高官抵達本城，停留一月",
  "tour.sep":"；",
  "tour.gone":"{c}高官已離城",
  "newGame.crew":"🏮【人生】你今年 20 歲，帶著起家的班底，開始了這一生。",
  "newGame.alone":"🏮【人生】你今年 20 歲，身邊沒有半個夥計。第一步，先找一位肯為你引薦的介紹人。",
  /* —— 市場事件、協議、人口 —— */
  "cityHist.newProd":"試種「{n}」有成，成為產地",
  "ev.renqing":"📜【人情】你的名帖在城中已有人記得，往來之人對商號多有好評。",
  "ev.notice":"📜【公文】町奉行所發出告示，重申商人須守株牌專營之規。",
  "cartel.bondLost":"擔保金 {a} 兩沒收，",
  "cartel.fine":"官府查抄罰銀 {a} 兩，",
  "cartel.noFine":"靠司法人脈壓下了查抄，",
  "rival.good":"🏪【同業】「{n}」新貨滿載入港，聲勢大振，搶下不少客源。",
  "rival.bad":"🏪【同業】「{n}」商號遭遇糾紛（失火或延誤），客源流失。",
  "pop.allStable":"供貨始終安定，人口明顯增加",
  "pop.moreStable":"穩定供貨較多，人口小幅增加",
  "pop.allUnstable":"供貨持續不穩，人口明顯減少",
  "pop.moreUnstable":"供貨不穩較多，人口小幅減少",
  /* —— 07i_voyage.js —— */
  "voy.resolveVoyage.5":"🌊 歸途{a}，損失 {b} 單位，只有 {c} 單位入倉。",
  "voy.resolveVoyage.6":"✅ {a} 單位已入倉，可到大盤分旬出貨。",
  "voy.resolveVoyage.7":"🌊 歸途{a}，損失 {b} 單位，",
  "voy.resolveVoyage.8":"{a} 單位已入倉。這不是你的本業，得請座客商人代售。",
  /* —— 07u_battle.js —— */
  "bt.specialList":"他與你交情至深，願對隨機一家同業{a}。{b}；成敗看他的膽識與商才，事後可能被查辦。",
  "bt.specialList.2":"上貢",
  "bt.specialList.3":"他想請你備一批本業貨，{a} 旬內備齊，他會用高價收下。",
  /* —— 07zf_festwalk.js —— */
  "fwalk.famWho":"夫人",
  "fwalk.famWho.2":"孩子們",
  "fwalk.famWho.3":"側室",
  "enemy.introQuit":"🤝【請辭】「{a}」與你反目，辭去介紹人。",
  "rival.heir":"🏪【繼承】已故「{old}」的私生子「{name}」繼承家業，接掌商號。",
  "rival.heirF":"🏪【繼承】已故「{old}」的私生女「{name}」繼承家業，接掌商號。"
};
/** 取新聞文字並代入 {變數}；同時記下「文字→新聞鍵」，讓旬報、大事簿依鍵分類（newsKey）。 */
const NEWS_SEEN=new Map(),NEWS_RECENT=[];
function NEWS(key,vars){
  const v=NEWS_TXT[key];if(v===undefined)return key;
  const t=vars?v.replace(/\{(\w+)\}/g,(m,k)=>vars[k]===undefined?m:vars[k]):v;
  NEWS_SEEN.set(t,key);NEWS_RECENT.unshift(t);if(NEWS_RECENT.length>60)NEWS_RECENT.pop();if(NEWS_SEEN.size>3000)NEWS_SEEN.clear();
  return t;
}
/** 新聞文字→新聞鍵（找不到時看是否以某則新聞開頭，例如後面再接損失說明）；不是新聞則回傳 null。 */
function newsKey(t){
  if(t==null)return null;t=String(t);
  const k=NEWS_SEEN.get(t);if(k)return k;
  const p=NEWS_RECENT.find(x=>x&&t.startsWith(x));return p?NEWS_SEEN.get(p)||null:null;
}
/** 新聞的顯示格式：開頭圖示與【標籤】、括號註記（忘年會轉述時去掉）。 */
const NEWS_FMT={head:/^[^【]*【[^】]*】/,tagEnd:/^[^】]*】/,paren:/（[^）]*）/g};
/* —— 新聞分類（依新聞鍵；新增新聞時記得歸類） ——
 *  NEWS_CAT：年度大事簿（忘年會話題）分類；不在表內的不記。
 *  NEWS_HIDE：旬報「本旬大事」不重列（另有卡片或來訪視窗）。NEWS_MOVE：旬報優先列出的人事異動。
 *  NEWS_SEA／NEWS_LAND：忘年會上優先由船長／飛腳開口的話題。 */
const NEWS_CAT={
  firm:["newGame.1","chief.uneasy","empTick.1","charity.1","smugTick.5","enemy.introQuit"],
  market:["rival.heir","rival.heirF","rivalDump","luxDry","luxBurst","setEv.3","setEv.6","setEv.8","setEv.9","rival.good","rival.bad"],
  disaster:["holdTheft.1","holdTheft.2","holdTheft.3","setEv.1","setEv.2","setEv.4","setEv.5","thieves.2","invUpkeep.1","riot.1","arson.1"],
  official:["inspection.2","inspection.3","officialFall.1","officialFall.2","officialFall.3","peopleMove.official","officialExtort.1","regionTick.1","appGrant.1","tribute.ok","tribute.fail"],
  trouble:["officialExtort.2","evalCartel.1","evalCartel.2","smugTick.2","smugTick.3","smugTick.4","exileTick.1","exileTick.2","exileTick.3","assassinate.1","scheme.frame","scheme.suppress"],
  family:["marry.1","yearTick.2","yearTick.3","yearTick.4","yearTick.5","yearTick.6","ransom.1"]
};
const NEWS_HIDE=["inspectTick.1","inspectResolve.2","xgoodsTick.1","xgoodsTick.2"];
const NEWS_MOVE=["peopleMove.official","peopleMove.residence"];
const NEWS_SEA=["setEv.4","smugTick.2","regionHeld.2"];
const NEWS_LAND=["regionHeld.1"];
const NEWS_CAT_OF={};Object.entries(NEWS_CAT).forEach(([c,L])=>L.forEach(k=>NEWS_CAT_OF[k]=c));
const NEWS_HIDE_SET=new Set(NEWS_HIDE),NEWS_MOVE_SET=new Set(NEWS_MOVE),NEWS_SEA_SET=new Set(NEWS_SEA),NEWS_LAND_SET=new Set(NEWS_LAND);
