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
  'buyGoods.2':'倉庫容量不足（庫存 {invUsed}＋在途 {transitQty} / {invCap}）',
  'buyGoods.3':'「{name}」庫存已達上限（本城需求的 {capMult} 倍＝{itemCap} 單位，含在途）。還能進 {itemRoom} 單位。',
  'buyGoods.4':'本旬向大盤進「{name}」最多 {buyLimit} 單位（公會配額的 {mult} 倍），還能進 {buyLeft} 單位。要大量進貨請走商路從產地運入。',
  'buyGoods.5':'白銀不足，需 {cost} 兩',
  'buyGoods.6':'下單 {qty} 單位「{name}」，付 {cost} 兩，下一旬到貨',
  /* —— sellGoods —— */
  'sellGoods.1':'出貨量為 0（惜售壓倉）',
  'sellGoods.2':'庫存不足',
  'sellGoods.3':'出貨 {qty} 單位，市價 {q} 兩，入帳 {q2} 兩',
  /* —— dispatchShip —— */
  'dispatchShip.1':'請選擇產地城市',
  'dispatchShip.2':'【{name}】並非「{name2}」的產地',
  'dispatchShip.3':'請輸入數量',
  'dispatchShip.4':'尚未取得「{mode}」。請向官員請託（行政院）。',
  'dispatchShip.5':'船隊已滿載出航（{smug} / {fleet}），請等船隊返航或擴編',
  'dispatchShip.6':'此航線不通海運（起訖需為港灣或水路要衝）',
  'dispatchShip.7':'陸路只通陸地相連的同一地區（行程 2 旬內）；跨地區或島嶼只能走海運',
  'dispatchShip.8':'倉庫容量不足（庫存＋在途訂單＋在途貨物須在容量內）',
  'dispatchShip.9':'「{name}」庫存已達上限（{itemCap} 單位，含在途）。還能運 {itemRoom} 單位。',
  'dispatchShip.10':'白銀不足，貨款＋運費＋關稅需 {q} 兩',
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
  'revealWeakness.2':'私款（黃金點心）不足，花街打聽需 {c} 兩',
  /* —— giveGift —— */
  'giveGift.1':'尚無往來，須先經介紹人引薦',
  'giveGift.2':'公款白銀不足，需 {cost} 兩',
  'giveGift.3':'對方眼睛一亮，愛不釋手——顯然正中其軟肋！',
  /* —— doFavor —— */
  'doFavor.1':'無此項目',
  'doFavor.2':'此事剛辦過，還需 {key} 旬。',
  'doFavor.3':'此事早已辦妥。',
  'doFavor.4':'對方願意幫忙，但公款白銀不足（需 {total} 兩）。',
  'doFavor.5':'本業行情走強，聲譽 -3。',
  'doFavor.6':'對方點頭應允！{msg}',
  /* —— resolveVisit —— */
  'resolveVisit.1':'「{cid}」恰巧不在家，禮物原樣帶回。（未花費）',
  'resolveVisit.2':'門房回說主人身體不適，不見客，白跑一趟。（車馬費 {c} 兩）',
  /* —— payPromise —— */
  'payPromise.1':'無此承諾',
  'payPromise.2':'公款白銀不足，需 {amtS} 兩',
  'payPromise.3':'已進獻 {amtS} 兩白銀，官員態度回暖。',
  'payPromise.4':'已兌現承諾',
  /* —— auditEmp —— */
  'auditEmp.1':'查出帳目有出入，疑似被私吞約 {e} 兩。',
  'auditEmp.2':'翻遍帳冊，似乎沒有問題……（但不見得就是真的乾淨）',
  'auditEmp.3':'帳目清清楚楚，並無異狀。',
  /* —— recruitVia —— */
  'recruitVia.1':'請選擇介紹人',
  'recruitVia.2':'城中一時覓不到合適人才',
  /* —— hireCandidate —— */
  'hireCandidate.1':'這位介紹人只能幫你聘到「{rank}」以下的職位',
  'hireCandidate.2':'已聘「{cid}」為{rank}，月例 {wage} 兩／旬。',
  /* —— hireApprentice —— */
  'hireApprentice.1':'找人要靠介紹人——先結識一位肯為你引薦的介紹人。',
  'hireApprentice.2':'丁稚名額已滿',
  'hireApprentice.3':'招得丁稚「{name}」，安排隨大番頭學珠算。',
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
  'setKidPath.1':'年紀尚幼，滿 8 歲才能安排歷練',
  'setKidPath.2':'安排「{name}」{path}（每年花費 {path2} 兩）。',
  /* —— kidFixProdigal —— */
  'kidFixProdigal.1':'替「{name}」還清賭債，他發誓痛改前非（但誰知道呢）。',
  'kidFixProdigal.2':'寫下義絕書，將「{name}」逐出家門。',
  /* —— ship —— */
  'ship.1':'出貨量為 0：惜售壓倉，本旬不出貨。',
  /* —— fleetUp —— */
  'fleetUp.1':'船隊已達上限',
  'fleetUp.2':'新造商船一支，船隊擴編為 {fleet} 支。',
  /* —— meet —— */
  'meet.1':'對方視你為仇人，拒不見面。',
  /* —— visit —— */
  'visit.1':'對方視你為仇人，拒不見面，也不收禮。',
  /* —— makeIntro —— */
  'makeIntro.1':'知名度不足：當他的介紹人對象需知名度 {cid}',
  'makeIntro.2':'「{cid}」答應當你的介紹人！往後僱人、拜官、說媒都能請他引薦。',
  /* —— go —— */
  'go.1':'株仲間每三個月才開一次例會，還要等 {guildAt} 旬。',
  'go.2':'本旬行動次數已用完，請「推進一旬」。',
  /* —— quotaUp —— */
  'quotaUp.1':'本次例會已提案過了。',
  'quotaUp.2':'提案通過！配額提高為每項需求的 {quotaPct}%。',
  /* —— cartel —— */
  'cartel.1':'你在會上誓言嚴守配額，同行信任上升。',
  'cartel.2':'已私下簽署暗約：配額照樣遵守的表象下，你準備偷跑。小心被查獲！',
  'cartel.3':'退出株仲間協議。',
  /* —— whUp —— */
  'whUp.1':'新建倉庫一棟！庫容增至 {invCap}。',
  /* —— charity —— */
  'charity.1':'施粥賑濟！聲譽 +{g}{famine}',
  /* —— setIntro —— */
  'setIntro.1':'已改請「{introId}」當介紹人。',
  /* —— befriend —— */
  'befriend.1':'宴請「{cid}」，好感 +6。',
  /* —— needIntro —— */
  'needIntro.1':'找人要靠介紹人——先到「名門商邸」結識一位肯為你引薦的人。',
  /* —— fire —— */
  'fire.1':'再按一次「辭退」確認。',
  'fire.2':'已辭退。',
  /* —— marryGo —— */
  'marryGo.1':'請先選擇結親對象',
  'marryGo.2':'說親需請介紹人當媒人。',
  /* —— succeedGo —— */
  'succeedGo.1':'第 {gen} 代「{name}」接掌家業（{myAge} 歲）',
  /* —— skim —— */
  'skim.1':'公款不足',
  'skim.2':'你從帳上抹去 {amt} 兩，悄悄收進私囊。',
  /* —— injuredBlock —— */
  'injuredBlock.1':'⛓️ 你正在遠島服刑，還需 {exile} 旬，無法出門。',
  'injuredBlock.2':'🤕 你身上有傷，還需靜養 {injured} 旬，無法出門。',
  /* —— encGive —— */
  'encGive.1':'「{cid}」感激涕零，從此記住你的恩情。（已結識，好感 30）',
  'encGive.2':'「{cid}」感激不盡，交情更深了。（好感 +30）',
  /* —— smugGo —— */
  'smugGo.1':'⛓️ 遠島中，無法出海。',
  'smugGo.2':'船隊都在外面，沒有空閒的船。',
  'smugGo.3':'沒有好感滿格的空閒船長。',
  'smugGo.4':'密庫放不下這麼多。',
  'smugGo.5':'私款不足，需 {cost} 兩（可按上方「＋」補充）。',
  'smugGo.6':'船長「{name}」趁夜出港，{d} 旬後回航。',
  /* —— smugSell —— */
  'smugSell.1':'⛓️ 遠島中，無法交易。',
  'smugSell.2':'賣禁品要靠介紹人牽線，請先選一位介紹人。',
  'smugSell.3':'「{introId}」出手賣掉「{name}」{q} 單位，入私款 {net} 兩（介紹費 {fee}，交情 −{d}）。',
  /* —— errandTrim —— */
  'errandTrim.1':'（丁稚代跑，好感實得 {q}）',
  /* —— sendVoyage —— */
  'sendVoyage.1':'船隊都在外面（{smug} / {fleet}），請等返航或擴編',
  'sendVoyage.2':'請選一位空閒的{mode}。',
  'sendVoyage.3':'請選擇目的地',
  'sendVoyage.4':'尚未取得【{REG_NAME}】的{sea}。請到「遠國奉行所」請託。',
  'sendVoyage.5':'委託金至少 100 兩',
  'sendVoyage.6':'白銀不足，委託金需 {budget} 兩',
  /* —— xsell —— */
  'xsell.1':'要請介紹人幫忙脫手——先結識一位介紹人。',
  'xsell.2':'這位介紹人視你為仇人，不肯出面。',
  /* —— xoAccept —— */
  'xoAccept.1':'公款白銀不足，需 {O} 兩',
  'xoAccept.2':'倉庫放不下抵押品，只好婉拒。',
  'xoAccept.3':'借出 {O} 兩，收下「{xName}」{q} 單位抵押（入倉）。',
  /* —— xoDecline —— */
  'xoDecline.1':'婉拒了借款。',
  /* —— applyFavor —— */
  'applyFavor.1':'這件申請還在審理或擱置中，請看上方「申請案件」。',
  'applyFavor.2':'公款白銀不足：規費 {fee} 兩{offer}。',
  'applyFavor.3':'已繳規費 {fee} 兩。{msg}{left}',
  /* —— appTop —— */
  'appTop.1':'公款白銀不足，需 {top} 兩',
  /* —— nomOiran —— */
  'nomOiran.1':'她視你為仇人，不肯見面。',
  'nomOiran.2':'這位名伶今旬不在席。',
  'nomOiran.3':'今旬已指名過了。',
  'nomOiran.4':'知名度不足，指名不到這位名伶。',
  'nomOiran.5':'「{cid}」含笑相迎。好感 +5（現 {aff}）{note}',
  /* —— oGift —— */
  'oGift.1':'須先指名，才能送禮。',
  'oGift.2':'她欣然收下「{name}」（好感 +{gain}）。{tip}{note}',
  /* —— ransom —— */
  'ransom.1':'好感未滿，她還不肯跟你走。',
  'ransom.2':'私款不足，贖身需 {price} 兩',
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
  'tribute.busy':'已有一筆上貢在辦，先完成它。',
  'tribute.noGoods':'本業沒有可上貢的貨品。',
  'tribute.start':'官員「{off}」開口：{turns} 旬內備妥「{item}」{qty} 單位，屆時按市價 {mul} 倍收購上貢。',
  /* —— 手動補充：含條件分支或組合敘述的訊息 —— */
  'arson.fx':'夜深人靜，{rank}提著火種悄然出門……',
  'arson.fxTitle':'放火',
  'dispatchShip.noCrew':'沒有空閒的「{crew}」——到私宅請介紹人物色，聘為{crew}。',
  'dispatchShip.capLimit':'{mode}運「{name}」單趟最多 {cp} 單位',
  'dispatchShip.depart':'{crew}「{who}」率隊啟程，自【{origin}】運入，預計 {d} 旬後到貨。付 {total} 兩（貨款 {cost}、運費 {freight}、關稅 {duty}）',
  'meetCold.refuse':'{gate}（車馬費 {c} 兩）',
  'giveGift.reactGreedy':'對方不動聲色地收下，嘴角卻微微上揚。',
  'giveGift.reactCold':'對方皺了皺眉，勉強收下，似乎不太看重金銀。',
  'giveGift.reactPlain':'對方客氣地收下了。',
  'giveGift.reactBlah':'對方禮貌道謝，卻興趣缺缺。',
  'giveGift.result':'{reaction}（好感 +{gain}，往來倍率 ×{mult}）',
  'doFavor.refuse':'{say}（好感 {aff}，不足 50，好感 -3）',
  'doFavor.hold':'{say}（好感 {aff}，需達 80 才會辦）',
  'recruitVia.found':'{flavor}（覓得 {n} 位人選）',
  'slotFull':'{rank}的名額已滿',
  'promote.special':'{rank}是專職，不在晉升階梯內。',
  'buyMax.ok':'已排入最大進貨量，共 {tot} 單位。',
  'buyMax.none':'目前無法再進貨（倉庫、額度或公款已到上限）。',
  'route.depart':'出發前往產地！',
  'sell.shipping':'出貨中……',
  'encGive.noMoney':'{short}，只能不理會。',
  'toggleRestock.on':'大番頭將在推進一旬時，把庫存補到公會配額。',
  'toggleRestock.off':'已關閉自動補貨。',
  'sendVoyage.ok':'{crew}「{name}」帶著 {budget} 兩委託金前往【{dest}】，約 {d} 旬後歸來。',
  'voyage.depart':'出發！',
  'feast.fx':'包場夜宴，絲竹聲聲……',
  'feast.fxTitle':'花金之夜',
  'assassinate.fx':'夜色深沉，保鏢悄然出門……',
  'assassinate.fxTitle':'暗殺',
  'turn.fx':'時節流轉……'
};
/** 取訊息並代入 {變數}。 */
function MSG(key,vars){
  const v=MSG_TXT[key];if(v===undefined)return key;
  return vars?v.replace(/\{(\w+)\}/g,(m,k)=>vars[k]===undefined?m:vars[k]):v;
}
