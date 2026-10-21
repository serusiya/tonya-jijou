'use strict';
/* ★檔案總覽：核心工具與全域狀態
 * - G：整局遊戲狀態（可 JSON 序列化存檔）；所有隨機一律走 rnd()（以 G.rs 為種子），確保存檔後可重現。
 * - 資料索引：CHARS（千人名冊）、CITIES（百城）、COMMS（43 項貿易物品）轉成 Map，並加工出 COMM（遊戲用物品）。
 * - 規則常數：六項隱藏數值 STATS、性向相容 COMPAT、七大流派 SYS、季節係數 SEASON_COEF。
 * - 曆法：指數年（0 年＝遊戲開始，主角 20 歲）、月、旬（每月 3 旬）。
 * - 通用：存檔、音效、toast、行動點數 AP、知名度 fame。 */
/* ======================= 01 核心：工具、資料索引、曆法、存檔 ======================= */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
/** 數字加千分位（取整）。 */
const fmt=n=>Math.round(n).toLocaleString('en-US');
/** 數字加千分位並保留 1 位小數。 */
const fmt1=n=>(Math.round(n*10)/10).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:1});
/** 把 v 限制在 [a,b] 範圍內。 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/** HTML 跳脫，所有塞進 innerHTML 的外來文字都應經過它（防止破壞版面）。 */
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

let G=null;                       // 遊戲狀態（可序列化）
/** 遊戲版本。存檔版本與此不同就不相容（0.6 起不再讀舊存檔）。 */
const GAME_VER='0.6';
const SAVE_KEY='tonya_jijou_save';
const OLD_SAVE_KEYS=['tenka_gomen_v2_save','toiya_jijou_save'];   // 舊版存檔鍵（0.6 起不再讀取，只在啟動時清掉）

/* 可存檔的偽隨機：狀態 G.rs */
/** 遊戲唯一的亂數來源（mulberry32，種子存在 G.rs，隨存檔保存）。請勿直接用 Math.random 影響遊戲結果。 */
function rnd(){let t=(G.rs=(G.rs+0x6D2B79F5)>>>0);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}
/** 整數亂數，含頭含尾。 */
const rint=(a,b)=>a+Math.floor(rnd()*(b-a+1));
/** 從陣列隨機取一項。 */
const pick=a=>a[Math.floor(rnd()*a.length)];
/** 以機率 p（0～1）回傳 true。 */
const chance=p=>rnd()<p;
/** 洗牌（回傳新陣列）。 */
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
/** 字串雜湊，供 seeded() 產生固定亂數。 */
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
/** 以字串為種子的獨立亂數產生器：同一個字串永遠得到同一串數字（用於城市係數、印象雜訊等「固定但看似隨機」的值）。 */
function seeded(s){let t=hashStr(s);return()=>{t=(t+0x6D2B79F5)>>>0;let x=Math.imul(t^(t>>>15),t|1);x^=x+Math.imul(x^(x>>>7),x|61);return((x^(x>>>14))>>>0)/4294967296}}

/* ---------- 資料索引 ---------- */
const CHAR_MAP={};CHARS.forEach(c=>CHAR_MAP[c.id]=c);
const CITY_MAP={};CITIES.forEach(c=>CITY_MAP[c.id]=c);
/** 全部百城（CITIES 會在每局開始時縮成本局啟用的 30～40 城；CITY_MAP 與 ALL_CITIES 永遠保有全部）。 */
const ALL_CITIES=CITIES.slice();
/** 套用本局啟用城市（依 id 清單，原地改寫 CITIES）。清單為空則恢復全部。 */
function applyActiveCities(ids){const set=new Set(ids||[]);const l=set.size?ALL_CITIES.filter(c=>set.has(c.id)):ALL_CITIES;CITIES.length=0;l.forEach(c=>CITIES.push(c))}
/** 以人物 id 取名冊資料。 */
const CH=id=>CHAR_MAP[id];
/** 以城市 id 取城市資料。 */
const CITY=id=>CITY_MAP[id];

/* 六項隱藏數值（固定順序，同分時依此順序決定前三名） */
/** 六項隱藏數值的名稱與簡稱（遊戲中不直接顯示數值，只顯示偏重與印象）。 */
const STATS=[
  ['commerce_skill','商業才幹'],['integrity_loyalty','忠誠信義'],['greed_index','貪欲'],
  ['audacity_courage','膽識魄力'],['diplomacy_charm','社交手腕'],['betrayal_risk','反骨背叛']
];
/** 取一組數值中最高的三項（同分依 STATS 固定順序），用於性向相容比對。 */
function top3Of(stats){
  return STATS.map(([k,n],i)=>({k,n,i,v:stats[k]}))
    .sort((a,b)=>b.v-a.v||a.i-b.i).slice(0,3).map(x=>x.n);
}
/** 取人物最高的三項能力。 */
function top3(cid){const c=CH(cid);return c?top3Of(c.derived_stats):[]}
/** 性向相容表：三項同＝一見如故×3、二項＝意氣相投×2、一項＝相談甚歡×1、皆不同＝格格不入×⅓。 */
const COMPAT=[
  {m:0.333,label:'格格不入',cls:'red',desc:'志趣相悖，需花三倍力氣才能破冰。'},
  {m:1,label:'相談甚歡',cls:'gray',desc:'尚有共通話題，往來效果為基準。'},
  {m:2,label:'意氣相投',cls:'green',desc:'觀念多有契合，往來效果加倍。'},
  {m:3,label:'一見如故',cls:'gold',desc:'志趣極度投合，所有往來效果三倍。'}
];
/** 比較兩組最高三項，回傳 COMPAT 中對應的等級（含共通項目）。 */
function compatOfTops(a,b){
  const n=a.filter(x=>b.includes(x)).length;
  return Object.assign({matches:n,shared:a.filter(x=>b.includes(x))},COMPAT[n]);
}
/** 兩位人物的性向相容結果。 */
function compat(cidA,cidB){return compatOfTops(top3(cidA),top3(cidB))}
/* 信任係數：好感 60 為 1.0，下限 0.4，上限 1.5 */
/** 信任係數：好感 aff 越高，介紹人替你說話越有力（0.4～1.5）。 */
const trustFactor=aff=>clamp(aff/60,0.4,1.5);

/* ---------- 七大問屋流派 ---------- */
/** 七大問屋流派：開局資金、特色與適用的物品系統。新增流派在此加一筆。 */
const SYS=[
  {key:'timber',match:'山林竹木',name:'材木問屋',style:'豪賭型',firm:'三河屋',silver:8000,gold:8,
    tip:'賭火災與山洪，可翻十倍，也可能燒光。',perk:'白手起家'},
  {key:'grain',match:'糧穀與油料',name:'米問屋',style:'政治壓力型',firm:'鴻池屋',silver:7000,gold:6,
    tip:'薄利多銷，主食漲價易生暴動。',perk:'員工初備'},
  {key:'marine',match:'水產與海鹽',name:'魚鹽問屋',style:'高損耗快周轉',firm:'紀伊國屋',silver:6500,gold:6,
    tip:'鮮魚損耗快，必須快進快出。',perk:'家庭圓滿、員工初備'},
  {key:'mining',match:'礦產金屬',name:'金物鐵石問屋',style:'金融軍工型',firm:'住友屋',silver:9000,gold:10,
    tip:'銅鐵銀金，成敗看官府人脈。',perk:'家庭圓滿、員工充足、航運在手'},
  {key:'textile',match:'紡織纖維',name:'木棉生絲問屋',style:'大宗調度型',firm:'越後屋',silver:8000,gold:8,
    tip:'量大跨城，船隊與商路為本。',perk:'家庭圓滿、員工充足、船隊在手、名望三階'},
  {key:'medicine',match:'釀造醫藥',name:'唐物藥種問屋',style:'走私型',firm:'大和屋',silver:7500,gold:20,
    tip:'香辛藥材暴利，靠免檢與緝私官員。',perk:'財力驚人、名望四階'},
  {key:'luxury',match:'城市精工',name:'陶磁雅玩問屋',style:'公關型',firm:'京屋',silver:15500,gold:28,
    tip:'賣品味與人情，名士與花街是商路。',perk:'財力驚人、家庭圓滿、員工充足、船隊在手、名望四階'}
];
const SYS_BY_KEY={};SYS.forEach(s=>SYS_BY_KEY[s.key]=s);
/** 依物品所屬系統名稱，找出對應的流派 key。 */
function sysKeyOfCommodity(sysStr){const s=SYS.find(x=>sysStr.includes(x.match));return s?s.key:'timber'}

/* ---------- 物產資料加工 ---------- */
/** 【物品加工】民生必需品關鍵字（價高易引發打毀、需求彈性大）。 */
const STAPLE_KW=['白米','大麥','黃大豆','粗鹽','鮮魚','白炭','棉布','菜籽'];
/** 【物品加工】易燃品關鍵字（倉庫失火時損失較大）。 */
const FLAM_KW=['菜籽','麻油','鯨油','硫磺','樟','白炭','吉野','漆'];
/** 【物品加工】每旬損耗率表（關鍵字→比例）。 */
const DECAY_TABLE=[['鮮魚',0.20],['白米',0.02],['大麥',0.025],['黃大豆',0.02],['菜籽',0.015],['新茶',0.012],['粗鹽',0.004],['精鹽',0.003],['昆布',0.01],['乾鮑',0.008],['蜂蜜',0.005],['清酒',0.015],['醬油',0.01],['味醂',0.008],['生絲',0.015],['棉',0.02],['藍染',0.01],['鹽',0.004]];
/** 把原始 COMMS 資料加工成遊戲用的物品：短名、流派、基準價（原價/10）、必需品/奢侈品、需求彈性 α、損耗、易燃。 */
const COMM=COMMS.map((c,i)=>{
  const short=c.short_name||c.name.replace(/（.*?）/g,'');
  const staple=STAPLE_KW.some(k=>c.name.includes(k));
  const luxury=c.base_price>=1000;
  let decay=0.01;for(const [k,v] of DECAY_TABLE){if(c.name.includes(k)){decay=v;break}}
  return {i,name:c.name,short,sys:sysKeyOfCommodity(c.system),origin:c.origin_type,base:c.base_price/10,unit:c.unit,
    staple,luxury,alpha:staple?1.8:(luxury?0.7:1.1),decay,flam:FLAM_KW.some(k=>c.name.includes(k)),
    kind:staple?'必需品':(luxury?'奢侈品':'一般品')};
});
const COMM_MAP={};COMM.forEach(c=>COMM_MAP[c.name]=c);
/** 某流派的本業物品清單。 */
const commsOfSys=k=>COMM.filter(c=>c.sys===k);
/** 各流派四季價格係數（>1 表示該季偏貴）。 */
const SEASON_COEF={
  grain:{春:1.05,夏:1.08,秋:0.85,冬:1.0},marine:{春:1,夏:1.05,秋:1.0,冬:1.1},
  timber:{春:1.0,夏:0.95,秋:1.0,冬:1.12},mining:{春:1,夏:0.98,秋:1.0,冬:1.06},
  textile:{春:1.05,夏:1.02,秋:1.0,冬:1.0},medicine:{春:1.0,夏:1.1,秋:1.0,冬:1.0},
  luxury:{春:1.0,夏:0.98,秋:1.02,冬:1.05}
};

/* ---------- 曆法（指數年：遊戲開始年 = 0 年，主角當時 20 歲） ---------- */
const CYCLE_NAMES=['上旬','中旬','下旬'];
/** 月份轉季節（3～5 春、6～8 夏、9～11 秋，其餘冬）。 */
function seasonOf(m){return m>=3&&m<=5?'春':m>=6&&m<=8?'夏':m>=9&&m<=11?'秋':'冬'}
/** 目前季節。 */
const season=()=>seasonOf(G.month);
/** 年份顯示字串（內部仍以指數年數字運算，畫面不出現『指數年』）。 */
const yearStr=y=>y>=0?(y+1)+'年':(-y)+'年前';   // 開局年 0→「1年」，負數→「N年前」
/** 目前日期字串（年月旬）。 */
const dateStr=()=>`${yearStr(G.year)} ${G.month}月${CYCLE_NAMES[G.cycle-1]}`;
/** 主角年齡（指數年 0＝20 歲）。 */
const myAge=()=>G.year-G.me.birthYear;
/** 名冊人物目前年齡（以 birth_year 計）。 */
const ageOf=cid=>G.year-CH(cid).birth_year;
/** 人物目前是否在世（death_year 不早於今年）。 */
const alive=cid=>{const c=CH(cid);return c&&c.death_year>=G.year&&!(G.slain&&G.slain.indexOf(cid)>=0)};
/** 中文數字對照（解析節慶日期用）。 */
const CN={一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,廿:20,卅:30,正:1};
/** 中文數字轉阿拉伯數字。 */
function cnNum(s){let n=0,cur=0;for(const ch of s){const v=CN[ch];if(v==null)continue;if(ch==='十'){cur=(cur||1)*10;n+=cur;cur=0}else if(ch==='廿'||ch==='卅'){n+=v}else{cur+=v}}return n+cur}
/** 解析城市節慶日期字串（如『十一月十五日』）為 {month,cycle}，供節慶判定。 */
function parseFestival(str){
  const m=/^(正月|臘月|[一二三四五六七八九十]{1,3}月)([一二三四五六七八九十廿卅]+)日/.exec(str||'');
  if(!m)return null;
  const mon=m[1]==='臘月'?12:m[1]==='正月'?1:cnNum(m[1].replace('月',''));
  const day=cnNum(m[2]);
  return {month:mon,cycle:day<=10?1:day<=20?2:3,day};
}

/* ---------- 存檔 ---------- */
/** 存檔到 localStorage（key＝SAVE_KEY，G.ver＝GAME_VER）。失敗（私密模式等）時靜默略過。 */
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(G))}catch(e){}}
/** 啟動時是否發現並清掉了舊版（不相容）存檔，供開始畫面提示。 */
let OLD_SAVE_FOUND=false;
/** 讀檔；版本不符（0.6 之前的存檔一律不相容）或損毀回傳 null，並清掉不相容的舊存檔。 */
function loadSave(){
  try{
    OLD_SAVE_KEYS.forEach(k=>{if(localStorage.getItem(k)!==null){localStorage.removeItem(k);OLD_SAVE_FOUND=true}});
    const s=localStorage.getItem(SAVE_KEY);if(!s)return null;
    const o=JSON.parse(s,(k,v)=>(k==='__proto__'||k==='constructor'||k==='prototype')?undefined:v);
    if(o&&typeof o==='object'&&o.ver===GAME_VER&&o.me&&o.rel&&o.inv&&o.emps)return o;
    localStorage.removeItem(SAVE_KEY);OLD_SAVE_FOUND=true;return null;
  }catch(e){return null}
}
/** 清除存檔。 */
function clearSave(){try{localStorage.removeItem(SAVE_KEY);OLD_SAVE_KEYS.forEach(k=>localStorage.removeItem(k))}catch(e){}}

/* ---------- 音效 ---------- */
/** WebAudio 內容（音效用，無法使用時為 null）。 */
const AC=(window.AudioContext||window.webkitAudioContext)?new(window.AudioContext||window.webkitAudioContext)():null;
let soundOn=true;
/** 播放一個短音（方波/三角波）。 */
function tone(f,type='square',d=0.08,v=0.08){
  if(!soundOn||!AC)return;
  try{if(AC.state==='suspended')AC.resume();const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,AC.currentTime);g.gain.setValueAtTime(v,AC.currentTime);g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+d);o.connect(g);g.connect(AC.destination);o.start();o.stop(AC.currentTime+d)}catch(e){}
}
/** 音效集合：coin 金幣、step 腳步、gift 送禮、bad 壞事、fanfare 喜事…（受 soundOn 控制）。 */
const sfx={
  coin(){tone(880,'square',.06,.12);setTimeout(()=>tone(1320,'square',.1,.12),60)},
  step(){tone(150,'triangle',.04,.07)},
  tap(){tone(420,'sine',.04,.08)},
  fanfare(){tone(523,'triangle',.08,.12);setTimeout(()=>tone(659,'triangle',.08,.12),80);setTimeout(()=>tone(784,'triangle',.15,.16),160)},
  bad(){tone(180,'sawtooth',.18,.1);setTimeout(()=>tone(120,'sawtooth',.25,.1),120)},
  gift(){tone(660,'triangle',.07,.1);setTimeout(()=>tone(990,'triangle',.12,.1),70)}
};

/* ---------- Toast ---------- */
let toastTimer=null;
/** 畫面下方的提示訊息；ms 為顯示時間，長訊息可拉長。 */
function toast(msg,ms=2600){
  const t=$('#toast');t.textContent=msg;t.classList.add('on');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('on'),ms);
}

/* ---------- 行動次數：每旬 5 次，出門前往的動作各扣 1 次 ---------- */
/** 【行動點數】每旬 5 次，advanceTurn 時恢復。 */
const AP_MAX=5;
/** 本旬剩餘行動點數（舊存檔無此欄位時補滿）。 */
function apLeft(){if(G.ap===undefined)G.ap=AP_MAX;return G.ap}
/** 消耗 1 點行動點數；不足時提示並回傳 false。所有「實際外出辦事」的動作應先呼叫它。 */
function spendAP(){
  if(apLeft()<=0){toast('本旬行動次數已用完（5/5），請「推進一旬」。');return false}
  G.ap--;updateAP();return true;
}
/** 更新頂部『行動 x/5』顯示。 */
function updateAP(){const e=document.getElementById('d-ap');if(e){const a=G?apLeft():AP_MAX;e.textContent='行動 '+a+'/'+AP_MAX;e.className='ap'+(a<=1?' low':'')}}

/* ---------- 知名度：做任何事都有一點，結識高階官吏更多；降低拜訪被拒的機率，也影響市佔率 ---------- */
/** 【知名度】增加 x 點（越高越難漲，上限 100）。做事、結識高官、賣貨、施粥等都會呼叫。 */
/** 醜聞：直接扣知名度（key 見 ODDS.fameLoss），回傳實際扣除量。 */
function loseFame(key,mult){if(!G)return 0;const x=ODDS.fameLoss[key]*(mult||1),f=G.fame||0;G.fame=clamp(f-x,0,ODDS.fame.cap);return Math.round((f-G.fame)*10)/10}
function addFame(x){if(!G)return 0;const f=G.fame||0;G.fame=clamp(f+x*Math.max(ODDS.fame.floor,1-f/ODDS.fame.damp),0,ODDS.fame.cap);return Math.round((G.fame-f)*10)/10}
/** 知名度換算成『登門被拒機率』的減免（最多 30 個百分點）。 */
const fameCut=()=>clamp((G.fame||0)/ODDS.fame.cap*0.30,0,0.30);
/** 更新頂部知名度顯示。 */
/** 【知名度階級】1～4：知名度 0／30／80／150 分界（ODDS.fame.tiers），再加私款每滿 1000 兩 +1 階（上限 4）。 */
function fameTier(){const f=G.fame||0,T=ODDS.fame.tiers;return Math.min(4,1+(f>=T[0])+(f>=T[1])+(f>=T[2])+Math.floor((G.gold||0)/1000))}
/** 見官員所需知名度階：官階 1～2 免限制(1)，3→2，4→3，5 以上→4。 */
const needTierOfRank=rk=>rk<=2?1:Math.min(4,rk-1);
/** 介紹人階級 1～4（官階 1～2→1，3→2，4→3，5+→4；非官員為 1）。 */
function introTier(cid){return needTierOfRank(targetTier(cid))}
/** 名伶的知名度門檻：依人物 id 固定，約半數 2 階、四分之一 3 階。 */
function oiranTier(cid){let h=0;String(cid).split('').forEach(ch=>h=(h*31+ch.charCodeAt(0))%97);return h%4===0?1:h%4===3?3:2}
/** 見某人所需知名度階（官員看官階；名伶看固定門檻；其餘 1）。 */
function meetTierNeed(cid){const n=npc(cid);if(!n)return 1;return n.role==='oiran'?oiranTier(cid):n.pos?needTierOfRank(n.pos.rank):1}
const TIER_NAME=['','一階','二階','三階','四階'];
function updateFame(){const e=document.getElementById('d-fame');if(e&&G)e.textContent='名望 '+TIER_NAME[fameTier()]}
