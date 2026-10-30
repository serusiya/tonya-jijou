'use strict';
/* =====================================================================
 * 00_names.js — 名稱表（第一個載入）
 *  程式內部一律用英文代號當鍵（存檔、表格、比對都用代號）；畫面上要顯示的名稱集中在 NAMES。
 *  用法：NM('rank','clerk')→「手代」；rankName(k)、seasonName(k) 等是常用的捷徑。
 *  資料檔（chars.json 等）裡的人物角色、性別、性格、軟肋、出身地區也都是代號，顯示名在這裡。
 * ===================================================================== */
const NAMES={
  /* 店員職位（晉升階梯＋專職） */
  rank:{apprentice:'丁稚',clerk:'手代',banto:'番頭',chief:'大番頭',captain:'船長',courier:'飛腳',guard:'保鏢'},
  /* 季節、旬 */
  season:{spring:'春',summer:'夏',autumn:'秋',winter:'冬'},
  cycle:['上旬','中旬','下旬'],
  month:['','一','二','三','四','五','六','七','八','九','十','十一','十二'],
  /* 性別 */
  gender:{m:'男',f:'女'},
  /* 六項隱藏數值：全名與短名 */
  stat:{commerce_skill:'商業才幹',integrity_loyalty:'忠誠信義',greed_index:'貪欲',audacity_courage:'膽識魄力',diplomacy_charm:'社交手腕',betrayal_risk:'反骨背叛'},
  statShort:{commerce_skill:'商才',integrity_loyalty:'忠誠',audacity_courage:'膽識',diplomacy_charm:'交際',greed_index:'貪欲',betrayal_risk:'反骨'},
  /* 人物性格（chars.json 的 primary_trait／secondary_trait） */
  trait:{loyal:'忠誠',greedy:'貪婪',cunning:'狡黠',vengeful:'復仇',strict:'嚴謹',generous:'豪爽',arrogant:'狂妄',gambler:'嗜賭',kind:'仁慈',stubborn:'固執',timid:'懦弱',suspicious:'猜忌',protective:'護短',taciturn:'寡言',hedonist:'享樂',lecher:'好色'},
  /* 人物軟肋（chars.json 的 weakness） */
  weak:{gambling:'賭性深重難以自拔',faith:'篤信神佛與方術',courtesan:'沉迷吉原風月名妓',children:'溺愛幼子幼女',seafear:'天生畏懼水路遠航',pity:'憐憫落魄流民乞丐',henpecked:'懼內且聽信枕邊風',grudge:'心胸狹隘睚眥必報',art:'喜好收受罕見字畫',wine:'好美酒佳釀',vanity:'貪圖聲名愛好虛榮',antique:'癡迷古代珍奇異寶'},
  /* 人物身分（chars.json 的 roles；本局角色 npc.role） */
  role:{rival:'同業巨賈',manager:'經營好手',official:'官吏',smuggler:'私梟',guard:'武侍頭目',broker:'掮客',guest:'座客商人',oiran:'花街名伶',concubine:'側室'},
  /* 三系官署與地區官府 */
  court:{administration:'行政',finance:'財務',judiciary:'司法',region:'地區'},
  courtShort:{administration:'政',finance:'財',judiciary:'法',region:'域'},
  /* 物品種類 */
  kind:{staple:'必需品',luxury:'奢侈品',normal:'一般品'},
  /* 性向相容四級 */
  compat:[
    {label:'格格不入',desc:'志趣相悖，需花三倍力氣才能破冰。'},
    {label:'相談甚歡',desc:'尚有共通話題，往來效果為基準。'},
    {label:'意氣相投',desc:'觀念多有契合，往來效果加倍。'},
    {label:'一見如故',desc:'志趣極度投合，所有往來效果三倍。'}
  ],
  /* 名望階級 */
  tier:['','一階','二階','三階','四階'],
  /* 官階簡稱（許可等級用） */
  licRank:['','一階','二階','三階','四階','五階','六階'],
  /* 七大問屋流派 */
  sys:{
    timber:{family:'三河',name:'材木問屋',firm:'三河屋',style:'豪賭型',tip:'賭火災與山洪，可翻十倍，也可能燒光。',perk:'白手起家',res:'沒有介紹人、沒有夥計，從零開始。'},
    grain:{family:'鴻池',name:'米問屋',firm:'鴻池屋',style:'政治壓力型',tip:'薄利多銷，主食漲價易生暴動。',perk:'有人引薦',res:'一位介紹人。'},
    marine:{family:'紀伊國',name:'魚鹽問屋',firm:'紀伊國屋',style:'高損耗快周轉',tip:'鮮魚損耗快，必須快進快出。',perk:'夥計初備',res:'介紹人；手代、丁稚各一名。'},
    mining:{family:'住友',name:'金物鐵石問屋',firm:'住友屋',style:'重貨高價型',tip:'金銀單價極高，礦錠沉重難運；逢軍需，銅鐵硫磺大漲。',perk:'成家立業',res:'介紹人；手代、丁稚；妻子與幼兒。'},
    textile:{family:'越後',name:'木棉生絲問屋',firm:'越後屋',style:'守成經營型',tip:'產地稀少，靠協議與大盤穩住生意。',perk:'船隊在手',res:'介紹人；手代、丁稚；妻小；船長一名、本地區海運許可、一趟在途的委託採買。'},
    medicine:{family:'大和',name:'唐物藥種問屋',firm:'大和屋',style:'走私型',tip:'香辛藥材暴利，船隊常夾帶唐船私貨。',perk:'名聲在外、手頭寬裕',res:'以上全部；名望三階、第二貴貨的交易許可；私房錢稍多。'},
    luxury:{family:'京',name:'陶磁雅玩問屋',firm:'京屋',style:'公關型',tip:'賣品味與人情，名士與花街是商路。',perk:'家大業大',res:'以上全部；大番頭一名；名望四階，私房錢充裕。'}
  },
  /* 主角、子女的名字候選 */
  given:['甚左衛門','藤兵衛','彌七郎','傳右衛門','平次郎','利兵衛','宗右衛門','嘉兵衛','太郎左衛門','宗兵衛','清十郎','與三郎'],
  childM:['甚太郎','藤吉','彌市','傳之助','平八','利助','宗吉','嘉七'],
  childF:['小梅','阿鶴','千鶴','阿菊','小雪','阿滿','美代','阿秋'],
  spouse:['阿梅','阿園','小百合','阿花','阿鶴','阿雪','千代','阿初'],
  kidEmp:['吉松','太吉','與助','小次郎','勘太','源吉','久藏','茂平','福助','千松'],
  /* 子女年齡層 */
  kidStage:{young:'年幼',teen:'少年',adult:'成年'},
  /* 列舉分隔號 */
  sep:'、',
  /* 好感文字 */
  aff:['冷淡','普通','友善','親近','莫逆'],
  /* 委託採買的人 */
  crew:{sea:'船長',land:'飛腳'},
  /* 協議立場 */
  cartel:{pledged:'遵守協議',secret:'暗約偷跑',none:'未參加協議'},
  policy:{normal:'維持',restrict:'減供'},
  /* 借款種類、承諾來源 */
  debtKind:{smallLoan:'小額周轉',loan:'官倉平準貸款'},
  promiseBy:{official:'官方'},
  /* 子女歷練 */
  path:{shop:'跟老掌櫃學商',sea:'上海運船歷練',court:'入官邸當侍童'},
  /* 結親對象 */
  marryFam:{rival:'同行',official:'官家',commoner:'町人'},
  marryKind:{rival:'同行聯姻',official:'政商聯姻',commoner:'町人家庭'}
};
/** 取名稱表裡的名稱：NM('rank','clerk')。找不到時回傳代號本身。 */
const NM=(g,k)=>{const t=NAMES[g];const v=t&&t[k];return v===undefined?k:v};
const rankName=k=>NM('rank',k);
const seasonName=k=>NM('season',k);
const statName=k=>NM('stat',k);
const weakName=k=>NM('weak',k);
const roleName=k=>NM('role',k);
