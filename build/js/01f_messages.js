/* =====================================================================
 * 01f_messages.js — 訊息總表
 *  所有系統回饋文字（底部提示 toast、操作結果、錯誤與不足提示、彈窗訊息）都集中在 MSG_TXT。
 *  鍵名：<功能名>.<序號>，功能名即產生該訊息的函式（如 giveGift、ACT.feast 的 feast…）。
 *  值是字串；{名稱} 為佔位，由呼叫處 MSG('key',{名稱:值}) 代入（數字、人名等都由程式算好傳入）。
 *  人物開口說的話在 01d_lines.js；按鈕與選項在 01e_ui_text.js；費用在 01b_costs.js。
 * ===================================================================== */
const MSG_TXT={
  /* —— buyGoods —— */
  'buyGoods.1':'請輸入進貨數量',
  'buyGoods.2':'倉庫容量不足（已存 {invUsed}，已下單待到貨 {pendingQty}，倉庫共可放 {invCap}）',
  'buyGoods.3':'「{name}」庫存已達上限（單項最多 {itemCap} 單位，含已下單待到貨）。還能進 {itemRoom} 單位。',
  'buyGoods.4':'本旬向大盤進「{name}」最多 {buyLimit} 單位（依市占率、協議參加狀態與番頭、大番頭人手而定），還能進 {buyLeft} 單位。未參加協議沒有協議配額加給；要大量進貨請到商路委託船長或飛腳採買。',
  'buyGoods.5':'現款不足，需 {cost} 兩',
  'buyGoods.6':'下單 {qty} 單位「{name}」，付 {cost} 兩，下一旬到貨',
  /* —— sellGoods —— */
  'sellGoods.1':'出貨量為 0（惜售壓倉）',
  'sellGoods.2':'庫存不足',
  'sellGoods.3':'出貨 {qty} 單位，市價 {q} 兩，入帳 {q2} 兩',
  /* —— meetVia —— */
  'meetVia.1':'「{targetCid}」恰巧外出，改日再訪吧。（未花費）',
  'meetVia.2':'對方稱病不見客——與介紹人【{label}】，吃了閉門羹。（損失禮金 {cost} 兩、交情 -{dd}）',
  'meetVia.3':'經「{introCid}」引薦，雙方判定【{label}】{gain}',
  /* —— meetCold —— */
  'meetCold.1':'登門投帖，對方勉強見了面，好感 +{gain}。往後有了介紹人，才好辦事。',
  /* —— scout —— */
  'scout.1':'已經探知此人的性向',
  'scout.2':'探聽所得：性向偏重「{top3}」',
  /* —— revealWeakness —— */
  'revealWeakness.1':'此人的軟肋已經證實',
  'revealWeakness.2':'私房錢不足，花街打聽需 {c} 兩',
  /* —— giveGift —— */
  'giveGift.1':'尚無往來，須先經介紹人引薦',
  'giveGift.2':'現款不足，需 {cost} 兩',
  'giveGift.3':'對方眼睛一亮，愛不釋手——顯然正中其軟肋！',
  /* —— doFavor —— */
  'doFavor.1':'無此項目',
  'doFavor.2':'此事剛辦過，還需 {key} 旬。',
  'doFavor.3':'此事早已辦妥。',
  'doFavor.licHeld':'對方翻了翻你的文書：「你手上的許可，已不比我能給的少。」',
  'doFavor.sellAidFull':'倉庫放不下，這批貨沒法接手。',
  'doFavor.lessenHeld':'你手上已有一張減罪狀，用掉之前不必再求。',
  'favor.reconcile':'{n}那邊已經有人出面說和，從此不再記恨你。',
  'favor.reconcilePick':'「說吧，你想和誰化解恩怨？」',
  'doFavor.4':'現款不足（需 {total} 兩）。',
  'doFavor.5':'本業行情走強。',
  'doFavor.6':'應允！{msg}',
  /* —— resolveVisit —— */
  'resolveVisit.1':'「{cid}」恰巧不在家，改日再訪吧。（未花費）',
  'resolveVisit.2':'門房回說主人身體不適，不見客，白跑一趟。（車馬費 {c} 兩）',
  /* —— payPromise —— */
  'payPromise.1':'無此承諾',
  'payPromise.2':'現款不足，需 {amtS} 兩',
  'payPromise.3':'已拿出現款 {amtS} 兩進獻，官員態度回暖。',
  'payPromise.4':'已兌現承諾',
  /* —— auditEmp —— */
  'auditEmp.1':'查出帳目有出入，疑似被私吞約 {e} 兩。',
  'audit.noRumor':'沒聽到什麼風聲，平白查帳只會傷了人情。',
  'audit.heard':'記下了：「{name}」（{rank}）有風聲，可以到他的員工卡上查帳。風聲九旬後就淡了。',
  'audit.found':'查出「{name}」帳目有出入，私吞約 {amt} 兩。要怎麼處置？（追討、寬恕或辭退，按鈕也在他的員工卡上）',
  'audit.noProof':'翻遍「{name}」經手的帳冊，查無實據。他知道自己被盯上了，好感 -{a}。',
  'audit.wrong':'「{name}」的帳目清清楚楚，冤枉了好人：他好感 -{a}，店裡人心惶惶，其他人好感 -{o}。',
  'audit.grudge':'「{name}」記恨在心。',
  'audit.reform':'「{name}」知錯，往後會收斂些。',
  'audit.grateful':'「{name}」感念你的寬厚。',
  'audit.bold':'「{name}」嘴上稱謝，心裡卻覺得你好說話。',
  'audit.punish':'追回「{name}」私吞的 {back} 兩，嚴加訓斥：他好感 -{a}，其他人好感 -{o}，往後一陣子都不敢亂來。',
  'audit.forgive':'寬恕了「{name}」，私吞的錢不再追究：他好感 +{a}。',
  'audit.dismiss':'追回「{name}」私吞的 {back} 兩，把他辭退了；其他人看在眼裡，往後一陣子都不敢亂來。',
  'staff.grow':'「{name}」（{rank}）歷練一年，{stat}見長。',
  'promote.boon':'他感念提拔之恩，好感 +{a}；自家栽培的人，手腳也乾淨些。',
  'auditEmp.2':'翻遍帳冊，似乎沒有問題……（但不見得就是真的乾淨）',
  'auditEmp.3':'帳目清清楚楚，並無異狀。',
  /* —— recruitVia —— */
  'recruitVia.1':'請選擇介紹人',
  'recruitVia.2':'城中一時覓不到合適人才',
  /* —— hireCandidate —— */
  'hireCandidate.1':'這位介紹人只能幫你聘到「{rank}」以下的職位',
  'hireCandidate.2':'已聘「{cid}」為{rank}，月例 {wage} 兩／旬。',
  'hireCandidate.3':'此人的適任職務不包含「{rank}」。',
  'hireCandidate.4':'此人不在本次物色名冊中。',
  'hireCandidate.ship':'另付造船費 {ship} 兩，新船一艘下水。',
  'hireCandidate.shipShort':'現款不足：聘金加造船費共需 {c} 兩（造船費 {ship} 兩）。',
  'hireCandidate.5':'丁稚不從人物名冊聘用，請使用私宅的「招收丁稚」。',
  /* —— hireApprentice —— */
  'hireApprentice.1':'找人要靠介紹人——先結識一位肯為你引薦的介紹人。',
  'hireApprentice.2':'丁稚名額已滿',
  'hireApprentice.3':'招得丁稚「{name}」，安排在店裡學珠算。',
  /* —— promoteEmp —— */
  'promoteEmp.1':'已是最高職階',
  'promoteEmp.2':'任職未滿二十四旬，尚不宜升遷',
  'promoteEmp.3':'「{name}」升為{nr}。',
  /* —— marry —— */
  'marry.1':'已有正室',
  'marry.2':'請託一位介紹人當媒人',
  'marry.3':'與對方交情不足（需 {official}）',
  'marry.4':'說親未成，白費了聘禮。（成功率約 {p}%）',
  'marry.5':'禮成！{extra}',
  /* —— setKidPath —— */
  'setKidPath.1':'年紀尚幼，還不能安排歷練',
  'setKidPath.2':'安排「{name}」{path}（每年花費 {path2} 兩）。',
  /* —— kidFixProdigal —— */
  'kidFixProdigal.1':'替「{name}」還清賭債，他發誓痛改前非（但誰知道呢）。',
  'kidFixProdigal.2':'寫下義絕書，將「{name}」逐出家門。',
  /* —— ship —— */
  'ship.1':'出貨量為 0：惜售壓倉，本旬不出貨。',
  /* —— meet —— */
  'meet.1':'視你為仇，拒不見面。',
  /* —— visit —— */
  'visit.1':'視你為仇，拒不見面。',
  'visit.away':'這位大人巡迴在外，{m}月才會來本城。',
  'visit.snub':'嫌你不善言辭，暫不見客。',
  /* —— makeIntro —— */
  'makeIntro.1':'名氣不足，對方婉拒。',
  'makeIntro.2':'「{cid}」答應當你的介紹人！往後僱人、拜官、說媒都能請他引薦。',
  'makeIntro.3':'此人的身分不適合擔任介紹人。',
  'makeIntro.4':'此人已是介紹人，或介紹人名額已滿。',
  /* —— go —— */
  'go.1':'株仲間每三個月才開一次例會，還要等 {guildAt} 旬。',
  'go.2':'本旬行動次數已用完，請「推進一旬」。',
  /* —— quotaUp —— */
  'quotaUp.1':'本次例會已提案過了。',
  'quotaUp.2':'提案通過！配額提高為每項需求的 {quotaPct}%。',
  'quotaUp.normal':'本期決議為正常供應，配額依穩定供貨線與市占率分配，不能提案提高固定比例。',
  /* —— cartel —— */
  'cartel.1':'你在會上誓言嚴守協議配額，同行信任上升。',
  'cartel.2':'已私下簽署暗約：表面遵守協議配額，暗中準備偷跑。小心被查獲！',
  'cartel.3':'退出聯合採購與出貨協議。',
  'cartel.same':'你目前就是這個立場。',
  'cartel.join':'押上擔保金 {c} 兩，參加聯合採購與出貨協議！向大盤進貨改用聯合採購價。',
  'cartel.lose':'協議擔保金 {c} 兩沒收，退出協議後向大盤照市價進貨。',
  /* —— whUp —— */
  'whUp.1':'新建倉庫一棟！庫容增至 {invCap}。',
  'whUp.max':'倉庫已蓋到許可的上限。要再增建，先向行政官員申請「河岸倉地拜領」。',
  /* —— charity —— */
  'charity.1':'施粥賑濟！百姓感念，名聲遠播。{famine}',
  /* —— setIntro —— */
  'setIntro.1':'已改請「{introId}」當介紹人。',
  /* —— banquet（宴會）—— */
  'banquet.done':'本旬已經設過宴了，下旬再辦吧。',
  'banquet.none':'還沒有介紹人，也沒有員工，無人可請。',
  'banquet.fx':'私宅張燈設宴，杯盤交錯……',
  'banquet.fxTitle':'宴會',
  /* —— needIntro —— */
  'needIntro.1':'找人要靠介紹人——先到「名門商邸」結識一位肯為你引薦的人。',
  /* —— fire —— */
  'fire.1':'再按一次「辭退」確認。',
  'fire.2':'已辭退。',
  /* —— marryGo —— */
  'marryGo.1':'請先選擇結親對象',
  'marryGo.2':'說親需請介紹人當媒人。',
  /* —— skim —— */
  'skim.1':'現款不足',
  'skim.2':'你從帳上抹去 {amt} 兩，悄悄收進私囊。',
  /* —— injuredBlock —— */
  'injuredBlock.1':'⛓️ 你正在遠島服刑，還需 {exile} 旬，無法出門。',
  'injuredBlock.2':'🤕 你身上有傷，還需靜養 {injured} 旬，無法出門。',
  /* —— encGive —— */
  'encGive.1':'「{cid}」感激涕零，從此記住你的恩情。（已結識，好感 10）',
  'encGive.2':'「{cid}」感激不盡，交情更深了。（好感 +10）',
  /* —— smugGo —— */
  'smugGo.1':'⛓️ 遠島中，無法出海。',
  'smugGo.3':'沒有好感滿格的空閒船長。',
  'smugGo.4':'密庫放不下這麼多。',
  'smugGo.5':'私房錢不足，需 {cost} 兩（可按上方「＋」補充）。',
  'smugGo.ap':'本旬行動次數已用完，下旬再出海吧。',
  'smugGo.hurt':'🤕 你身上有傷，還需靜養 {injured} 旬，沒法到碼頭交代。',
  'smugGo.6':'船長「{name}」趁夜出港，{d} 旬後回航。',
  /* —— errandTrim —— */
  'errandTrim.1':'（丁稚代跑，好感實得 {q}）',
  'errand.done':'丁稚替你把 {amt} 兩禮金送到「{cid}」府上，對方收下了。（好感 +{gain}）',
  'errand.friend':'交情已深，這種事要你親自登門才算數。',
  /* —— sendVoyage —— */
  'sendVoyage.2':'請選一位空閒的{mode}。',
  'sendVoyage.3':'請選擇目的地',
  'sendVoyage.4':'尚未取得【{REG_NAME}】的{sea}。請到「遠國奉行所」請託。',
  'sendVoyage.5':'委託金至少 100 兩',
  'sendVoyage.6':'現款不足，委託金需 {budget} 兩',
  'sendVoyage.ap':'本旬行動次數已用完，下旬再委託吧。',
  'sendVoyage.hurt':'🤕 你身上有傷，還需靜養 {injured} 旬，沒法到碼頭交代。',
  /* —— xoAccept —— */
  'xoAccept.1':'現款不足，需 {O} 兩',
  'xoAccept.2':'倉庫放不下抵押品，只好婉拒。',
  'xoAccept.3':'借出 {O} 兩，收下「{xName}」{q} 單位抵押（入倉）。',
  /* —— xoDecline —— */
  'xoDecline.1':'婉拒了借款。',
  /* —— applyFavor —— */
  'applyFavor.1':'這件申請還在審理或擱置中，請看上方「申請案件」。',
  'applyFavor.2':'現款不足：賄賂需 {offer} 兩。',
  'applyFavor.3':'申請已遞交。{msg}',
  /* —— appTop —— */
  'appTop.1':'現款不足，需 {top} 兩',
  /* —— nomOiran —— */
  'nomOiran.1':'視你為仇，不肯見面。',
  'nomOiran.2':'今旬不在席。',
  'nomOiran.3':'今旬已指名過了。',
  'nomOiran.4':'名氣不足，點不到她。',
  'nomOiran.5':'「{cid}」含笑相迎。好感 +5（現 {aff}）{note}',
  /* —— oGift —— */
  'oGift.1':'須先指名，才能送禮。',
  'oGift.2':'她欣然收下「{name}」（好感 +{gain}）。{tip}{note}',
  'oGift.3':'這次指名已經送過禮了，下次再帶新的來吧。',
  /* —— ransom —— */
  'ransom.1':'好感未滿，她還不肯跟你走。',
  'ransom.2':'私房錢不足，贖身需 {price} 兩',
  'ransom.3':'「{name}」贖身入府，成了你的側室。轟動全城，知名度 +20。（不能生育，與家人無異）{note}',
  /* —— feast —— */
  'feast.1':'本旬已設過夜宴了，下旬再來。',
  'feast.2':'席間冷清，無人赴宴。{note}',
  /* —— allow —— */
  'allow.1':'好感已滿，不必再給了。',
  'allow.2':'本旬已給過他零用錢了。',
  'allow.3':'「{name}」雙手接過零用錢，好感 +{g}（現 {aff}）。',
  /* —— assassinate —— */
  'assassinate.1':'⛓️ 遠島中，無法行動。',
  'assassinate.2':'但保鏢「{name}」被捕，供出了你！案情傳開，知名度 −6。',
  'assassinate.3':'保鏢「{name}」被官府拿下，守口如瓶，獨自扛下了罪名，但案情傳開，知名度 −6。',
  'assassinate.4':'刺殺失手！保鏢「{name}」一去不回，「{name2}」對你恨之入骨。',
  /* —— arson —— */
  'arson.noRival':'本城已無同業可下手。',
  'arson.exile':'⛓️ 遠島中，無法行動。',
  'arson.ok':'「{name}」的倉庫起火，庫存燒掉大半！',
  'arson.caught':'但{rank}「{name}」被捕，供出了你！案情傳開，知名度 −6。',
  'arson.silent':'{rank}「{name}」被官府拿下，守口如瓶，獨自扛下了罪名，但案情傳開，知名度 −6。',
  'arson.fail':'放火失手！{rank}「{name}」一去不回，「{target}」對你恨之入骨。',
  /* —— scheme（官員栽贓／打壓）—— */
  'scheme.noRival':'本城已無可下手的同業。',
  'scheme.exile':'⛓️ 遠島中，無法行動。',
  'scheme.frameOk':'官員「{off}」安排了人證物證，同業「{target}」被查抄，生意一落千丈！',
  'scheme.suppressOk':'官員「{off}」藉故刁難，同業「{target}」的生意處處受阻。',
  'scheme.caught':'但事跡敗露，官員「{off}」被撤職查辦，供出了你！案情傳開，知名度 −6。',
  'scheme.silent':'但事跡敗露，官員「{off}」被撤職查辦，守口如瓶，獨自扛下了罪名。案情傳開，知名度 −6。',
  'scheme.fail':'事情辦砸了！官員「{off}」與你割席，同業「{target}」也對你恨之入骨。',
  'scheme.fxFrame':'官員「{off}」暗中布局……',
  'scheme.fxSuppress':'官員「{off}」發下文書……',
  'scheme.fxTitleFrame':'栽贓',
  'scheme.fxTitleSuppress':'打壓',
  /* —— tribute（上貢）—— */
  'tribute.busy':'手上已經答應一筆上貢了，先把那一筆辦完吧。',
  'tribute.noGoods':'目前沒有適合拿來辦這件事的本業貨品。',
  'tribute.start':'「{off}」低聲請你幫個忙：{turns} 旬內準備好「{item}」{qty} 單位。貨備齊後，他會照約定用高價收下。',
  /* —— 手動補充：含條件分支或組合敘述的訊息 —— */
  'arson.fx':'夜深人靜，{rank}提著火種悄然出門……',
  'arson.fxTitle':'放火',
  'meetCold.refuse':'{gate}（車馬費 {c} 兩）',
  'giveGift.reactGreedy':'對方不動聲色地收下，嘴角卻微微上揚。',
  'giveGift.reactCold':'對方皺了皺眉，勉強收下，似乎不太看重金銀。',
  'giveGift.reactPlain':'對方客氣地收下了。',
  'giveGift.reactBlah':'對方禮貌道謝，卻興趣缺缺。',
  'giveGift.result':'{reaction}（好感 +{gain}）',
  'doFavor.refuse':'{say}',
  'doFavor.hold':'{say}',
  'recruitVia.found':'{flavor}（覓得 {n} 位人選）',
  'slotFull':'{rank}的名額已滿',
  'promote.special':'{rank}是專職，不在晉升階梯內。',
  'buyMax.ok':'已排入最大進貨量，共 {tot} 單位。',
  'buyMax.none':'目前無法再進貨（倉庫、額度或現款已到上限）。',
  'sell.shipping':'出貨中……',
  'encGive.noMoney':'{short}，只能不理會。',
  'plan.quota':'每項進貨都照協議配額。',
  'plan.quotaShort':'每項進貨照協議配額；有幾項受進貨上限、倉位或現款所限，進不足。',
  'plan.clear':'已清除本旬的進貨安排。',
  'sendVoyage.ok':'{crew}「{name}」帶著 {budget} 兩委託金前往【{dest}】，約 {d} 旬後歸來。',
  'voyage.depart':'出發！',
  'save.exported':'存檔已匯出：{f}',
  'save.exportFail':'匯出失敗，這個瀏覽器無法壓縮存檔。',
  'save.none':'目前沒有可以匯出的存檔。',
  'save.badFile':'這不是《問屋事情》的存檔檔案。',
  'save.tampered':'存檔已損毀或遭修改，無法匯入。',
  'save.badVer':'存檔版本（v{v}）與遊戲版本（v{g}）不同，無法匯入。',
  'save.badContent':'存檔內容有誤，無法匯入。',
  'save.ended':'這份存檔的人生已經落幕，無法匯入。',
  'save.replace':'這台裝置上已有一段人生（{n}），匯入後會被取代。確定匯入？',
  'save.imported':'存檔已匯入，繼續{n}的人生。',
  'voyQ.add':'{crew}「{name}」排進出運清單：前往【{dest}】，委託金 {budget} 兩。',
  'voyQ.empty':'出運清單是空的。',
  'voyQ.short':'現款不足，清單裡的委託金合計需 {c} 兩。',
  'voyQ.done':'{n} 人一起出發，前往{dest}。',
  'voyQ.fail':'另有 {n} 人沒有許可，留在清單上。',
  'feast.fx':'包場夜宴，絲竹聲聲……',
  'feast.fxTitle':'花金之夜',
  'assassinate.fx':'夜色深沉，保鏢悄然出門……',
  'assassinate.fxTitle':'暗殺',
  'party.effect':'宴席費 {cost} 兩。出席的友人 {f} 位好感 +{fg}，店員 {s} 位好感 +{sg}。',
  'turn.fx':'時節流轉……'
};
/** 取訊息並代入 {變數}。 */
function MSG(key,vars){
  const v=MSG_TXT[key];if(v===undefined)return key;
  return vars?v.replace(/\{(\w+)\}/g,(m,k)=>vars[k]===undefined?m:vars[k]):v;
}
