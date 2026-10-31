'use strict';
/* ★檔案總覽：核心工具與全域狀態
 * - G：整局遊戲狀態（可 JSON 序列化存檔）；所有隨機一律走 rnd()（以 G.rs 為種子），確保存檔後可重現。
 * - 資料索引：CHARS（千人名冊）、CITIES（百城）、COMMS（43 項貿易物品）轉成 Map，並加工出 COMM（遊戲用物品）。
 * - 內部鍵一律用英文代號：物品代號（prod_0101…）、職位（apprentice…）、季節（spring…）、能力（commerce_skill…）。顯示名稱在 00_names.js。
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
/** 遊戲版本。存檔版本與此不同就不相容（0.7 起改為許可制，舊存檔不相容）。 */
const GAME_VER='0.7.1';
/** 讀檔與匯入時接受的存檔版本（讀進來後由 migrateSave 補欄位、改標為 GAME_VER）。'0.7'＝中文鍵的舊存檔，由 migrateKeys 轉成代號。 */
const SAVE_VERS=[GAME_VER,'0.7'];
const saveVerOK=v=>SAVE_VERS.includes(String(v));
const SAVE_KEY='tonya_jijou_save2';
/** 0.7 中文鍵存檔用的存檔鍵：0.7.1 起改存到 SAVE_KEY，舊版網頁（快取）就讀不到新格式，不會讀壞或清掉它；
 *  新版找不到 SAVE_KEY 時改讀這裡，轉換後寫進 SAVE_KEY，再刪掉這一份。 */
const LEGACY_SAVE_KEY='tonya_jijou_save';
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
/** 人物是否為女性（名冊 gender：m／f）。 */
const isFemale=c=>!!c&&c.gender==='f';

/* 六項隱藏數值（固定順序，同分時依此順序決定前三名） */
/** 六項隱藏數值的代號與顯示名（遊戲中不直接顯示數值，只顯示偏重與印象）。 */
const STATS=['commerce_skill','integrity_loyalty','greed_index','audacity_courage','diplomacy_charm','betrayal_risk'].map(k=>[k,statName(k)]);
/** 取一組數值中最高的三項（同分依 STATS 固定順序），回傳能力代號；用於性向相容比對。 */
function top3Of(stats){
  return STATS.map(([k],i)=>({k,i,v:stats[k]}))
    .sort((a,b)=>b.v-a.v||a.i-b.i).slice(0,3).map(x=>x.k);
}
/** 能力代號陣列轉成顯示名（以「、」連接）。 */
const statNames=L=>L.map(statName).join(NAMES_SEP);
const NAMES_SEP=NAMES.sep;
/** 取人物最高的三項能力（代號）。 */
function top3(cid){const c=CH(cid);return c?top3Of(c.derived_stats):[]}
/** 人物最高三項能力的顯示文字。 */
const top3Txt=cid=>statNames(top3(cid));
/** 性向相容表：三項同＝一見如故×3、二項＝意氣相投×2、一項＝相談甚歡×1、皆不同＝格格不入×⅓。名稱與說明在 NAMES.compat。 */
const COMPAT=[{m:0.333,cls:'red'},{m:1,cls:'gray'},{m:2,cls:'green'},{m:3,cls:'gold'}].map((x,i)=>Object.assign(x,NAMES.compat[i]));
/** 比較兩組最高三項，回傳 COMPAT 中對應的等級（含共通項目代號）。 */
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
/** 七大問屋流派：開局資金。越往下起手資源越多（applyStartBoost 依順序累加）。名稱、屋號、風格與說明在 NAMES.sys。新增流派在此加一筆。 */
const SYS=[
  {key:'timber',silver:8000,gold:8},
  {key:'grain',silver:8500,gold:10},
  {key:'marine',silver:9000,gold:12},
  {key:'mining',silver:10000,gold:15},
  {key:'textile',silver:11000,gold:20},
  {key:'medicine',silver:12500,gold:500},
  {key:'luxury',silver:15500,gold:1000}
].map(s=>Object.assign(s,NAMES.sys[s.key]));
const SYS_BY_KEY={};SYS.forEach(s=>SYS_BY_KEY[s.key]=s);

/* ---------- 物產資料加工 ---------- */
/** 把原始 COMMS 資料加工成遊戲用的物品。
 *  name＝物品代號（prod_0101…，存檔、市場、庫存的鍵）；full＝全名、short＝短名（顯示用）；sys＝所屬流派；
 *  tags（資料檔）：staple 必需品、flam 易燃、fest 節慶搶手、riot 打毀指標、fire 火災漲價、grain 米麥、rice 米、typhoon 颱風、military 軍需。 */
const COMM=COMMS.map((c,i)=>{
  const tags=c.tags||[],staple=tags.includes('staple'),luxury=c.base_price>=1000;
  return {i,name:c.id,id:c.id,full:c.name,short:c.short_name||c.name,sys:c.sys,origin:c.origin_type,base:c.base_price/10,unit:c.unit,tags,
    staple,luxury,alpha:staple?1.8:(luxury?0.7:1.1),decay:c.decay,flam:tags.includes('flam'),
    kind:staple?'staple':(luxury?'luxury':'normal')};
});
const COMM_MAP={};COMM.forEach(c=>COMM_MAP[c.name]=c);
/** 物品是否帶某個標籤。 */
const commTag=(c,t)=>!!c&&c.tags.includes(t);
/** 某流派的本業物品清單。 */
const commsOfSys=k=>COMM.filter(c=>c.sys===k);
/** 各流派四季價格係數（>1 表示該季偏貴）。 */
const SEASON_COEF={
  grain:{spring:1.05,summer:1.08,autumn:0.85,winter:1.0},marine:{spring:1,summer:1.05,autumn:1.0,winter:1.1},
  timber:{spring:1.0,summer:0.95,autumn:1.0,winter:1.12},mining:{spring:1,summer:0.98,autumn:1.0,winter:1.06},
  textile:{spring:1.05,summer:1.02,autumn:1.0,winter:1.0},medicine:{spring:1.0,summer:1.1,autumn:1.0,winter:1.0},
  luxury:{spring:1.0,summer:0.98,autumn:1.02,winter:1.05}
};

/* ---------- 曆法（指數年：遊戲開始年 = 0 年，主角當時 20 歲） ---------- */
const CYCLE_NAMES=NAMES.cycle;
/** 月份轉季節代號（3～5 spring、6～8 summer、9～11 autumn，其餘 winter）。 */
function seasonOf(m){return m>=3&&m<=5?'spring':m>=6&&m<=8?'summer':m>=9&&m<=11?'autumn':'winter'}
/** 目前季節代號。 */
const season=()=>seasonOf(G.month);
/** 年份顯示字串（內部仍以指數年數字運算，畫面不出現『指數年』）。 */
const yearStr=y=>y>=0?UT('date.year',{y:y+1}):UT('date.yearAgo',{y:-y});   // 開局年 0→「1年」，負數→「N年前」
/** 某年月旬的日期字串。 */
const dateOf=(y,m,c)=>UT('date.full',{y:yearStr(y),m,c:CYCLE_NAMES[c-1]});
/** 目前日期字串（年月旬）。 */
const dateStr=()=>dateOf(G.year,G.month,G.cycle);
/** 主角年齡（指數年 0＝20 歲）。 */
const myAge=()=>G.year-G.me.birthYear;
/** 名冊人物目前年齡（以 birth_year 計）。 */
const ageOf=cid=>G.year-CH(cid).birth_year;
/** 人物目前是否在世（death_year 不早於今年）。 */
const alive=cid=>{const c=CH(cid);return c&&c.death_year>=G.year&&!(G.slain&&G.slain.indexOf(cid)>=0)};

/* ---------- 存檔 ---------- */
/** 存檔到 localStorage（key＝SAVE_KEY，G.ver＝GAME_VER）。失敗（私密模式等）時靜默略過。 */
function save(){if(G&&G.ended)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(G));localStorage.removeItem(LEGACY_SAVE_KEY)}catch(e){}}   // 人生落幕後不再存檔
/** 啟動時是否發現並清掉了舊版（不相容）存檔，供開始畫面提示。 */
let OLD_SAVE_FOUND=false;
/** 解析存檔文字（擋掉 __proto__ 等鍵）。 */
const parseSave=s=>JSON.parse(s,(k,v)=>(k==='__proto__'||k==='constructor'||k==='prototype')?undefined:v);
/** 讀檔；版本不符或損毀回傳 null，並清掉不相容的舊存檔。中文鍵的舊存檔由 migrateSave（07zm_migrate.js）轉成代號。 */
function loadSave(){
  try{
    OLD_SAVE_KEYS.forEach(k=>{if(localStorage.getItem(k)!==null){localStorage.removeItem(k);OLD_SAVE_FOUND=true}});
    const key=localStorage.getItem(SAVE_KEY)!==null?SAVE_KEY:LEGACY_SAVE_KEY;
    const s=localStorage.getItem(key);if(!s)return null;
    const o=parseSave(s);
    if(o&&typeof o==='object'&&saveVerOK(o.ver)&&o.me&&o.rel&&o.inv&&o.emps)return o;
    localStorage.removeItem(key);OLD_SAVE_FOUND=true;return null;
  }catch(e){return null}
}
/** 清除存檔。 */
function clearSave(){try{localStorage.removeItem(SAVE_KEY);localStorage.removeItem(LEGACY_SAVE_KEY);OLD_SAVE_KEYS.forEach(k=>localStorage.removeItem(k))}catch(e){}}

/* ---------- 音效 ---------- */
/** WebAudio 內容（音效用，無法使用時為 null）。 */
const AC=(window.AudioContext||window.webkitAudioContext)?new(window.AudioContext||window.webkitAudioContext)():null;
let soundOn=true;
/** 音效音量倍率（由 07w_music.js 依設定調整）。 */
let SFX_VOL=1;
/** 播放一個短音（方波/三角波）。 */
function tone(f,type='square',d=0.08,v=0.08){
  if(!soundOn||!AC)return;
  try{if(AC.state==='suspended')AC.resume();const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,AC.currentTime);g.gain.setValueAtTime(Math.max(0.0001,v*SFX_VOL),AC.currentTime);g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+d);o.connect(g);g.connect(AC.destination);o.onended=()=>{try{o.disconnect();g.disconnect()}catch(e){}};o.start();o.stop(AC.currentTime+d)}catch(e){}
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
  if(apLeft()<=0){toast(MSG('ap.out',{m:AP_MAX}));return false}
  G.ap--;updateAP();return true;
}
/** 更新頂部『行動 x/5』顯示。 */
function updateAP(){const e=document.getElementById('d-ap');if(e){const a=G?apLeft():AP_MAX;e.textContent=UT('top.ap',{a,m:AP_MAX});e.className='ap'+(a<=1?' low':'')}}

/* ---------- 知名度：做任何事都有一點，結識高階官吏更多；降低拜訪被拒的機率，也影響市佔率 ---------- */
/** 永久知名度下限（新町取立、國產取立等；尚無時為 0）。 */
const fameFloor=()=>Math.max(0,(G&&G.fameFloor)||0);
/** 設定知名度：介於永久下限與上限之間。所有改知名度的地方都走這裡。 */
function setFame(v){if(!G)return;G.fame=clamp(Math.max(Number(v)||0,fameFloor()),0,ODDS.fame.cap)}
/** 提高永久知名度下限（只升不降），並把知名度拉到下限以上。 */
function raiseFameFloor(v){if(!G)return;G.fameFloor=Math.max(fameFloor(),v);setFame(G.fame||0)}
/** 醜聞：直接扣知名度（key 見 ODDS.fameLoss），回傳實際扣除量。 */
function loseFame(key,mult){if(!G)return 0;const x=ODDS.fameLoss[key]*(mult||1),f=G.fame||0;setFame(f-x);return Math.round((f-G.fame)*10)/10}
/** 知名度門檻（ODDS.fame.gate＝125）：門檻以下照遞減規則加；門檻以上小事件不加、中事件（tier='mid'）加原值的三分之一、大事件（tier='major'）照原值加。
 *  一次加分跨過門檻時：小事件只加到門檻，中事件跨過的部分改按三分之一。扣分不受影響。 */
const fameGated=()=>!!G&&(G.fame||0)>=ODDS.fame.gate;
function fameGain(f,x,tier){
  const F=ODDS.fame,T=F.gate;if(!(x>0))return x;
  const mid=tier==='mid'||tier==='midRaw';               // midRaw：門檻以下不遞減（贖身 +20 沿用舊規則）
  if(f>=T)return tier==='major'?x:mid?x*F.midCut:0;
  const g=tier==='midRaw'?x:x*Math.max(F.floor,1-f/F.damp);if(f+g<=T||tier==='major')return g;
  return mid?(T-f)+(f+g-T)*F.midCut:T-f;
}
/** 【知名度】增加 x 點（越高越難漲）。回傳實際增量。 */
function addFame(x,tier){if(!G)return 0;const f=G.fame||0;setFame(f+fameGain(f,x,tier));return Math.round((G.fame-f)*10)/10}
/** 【風聲】增加 x；巡見使美言期間（G.flags.calm）一般的風聲不增加，severe＝重罪（暗殺、放火、栽贓、打壓及事敗被查）照樣增加。回傳實際增量。 */
function addHeat(x,severe){if(!G||!(x>0))return 0;if(!severe&&(G.flags&&G.flags.calm>0))return 0;G.heat=(G.heat||0)+x;return x}
/** 知名度換算成『登門被拒機率』的減免（最多 30 個百分點）。 */
const fameCut=()=>clamp((G.fame||0)/ODDS.fame.cap*0.30,0,0.30);
/** 【知名度階級】1～4：知名度 0／30／80／150 分界（ODDS.fame.tiers）；私房錢滿 2000 兩（ODDS.fame.goldTier）再加一階，只加這一階（上限 4）。 */
function fameTier(){const f=G.fame||0,T=ODDS.fame.tiers;return Math.min(4,1+(f>=T[0])+(f>=T[1])+(f>=T[2])+((G.gold||0)>=ODDS.fame.goldTier?1:0))}
/** 見官員所需知名度階：官階 1～2 免限制(1)，3→2，4→3，5 以上→4。 */
const needTierOfRank=rk=>rk<=2?1:Math.min(4,rk-1);
/** 介紹人階級 1～4（官階 1～2→1，3→2，4→3，5+→4；非官員為 1）。 */
function introTier(cid){return needTierOfRank(targetTier(cid))}
/** 名伶的知名度門檻：依人物 id 固定，約半數 2 階、四分之一 3 階。 */
function oiranTier(cid){let h=0;String(cid).split('').forEach(ch=>h=(h*31+ch.charCodeAt(0))%97);return h%4===0?1:h%4===3?3:2}
/** 名門商邸人物的知名度門檻分布（知名度一～四階的機率 %）：依身分，每人以人物編號固定。 */
const RES_TIER_W={guest:[70,30,0,0],broker:[60,40,0,0],manager:[40,40,20,0],smuggler:[0,70,30,0],rival:[0,40,40,20]};
/** 名門商邸人物的知名度門檻（同一人每局都一樣）。 */
function resTier(cid,role){const w=RES_TIER_W[role];if(!w)return 1;const x=seeded('res'+cid)()*100;let a=0;for(let i=0;i<4;i++){a+=w[i];if(x<a)return i+1}return 1}
/** 見某人所需知名度階（官員看官階；名伶看固定門檻；名門商邸人物依身分與人物編號固定；其餘 1）。 */
function meetTierNeed(cid){const n=npc(cid);if(!n)return 1;return n.role==='oiran'?oiranTier(cid):n.pos?needTierOfRank(n.pos.rank):resTier(cid,n.role)}
const TIER_NAME=NAMES.tier;
/** 更新頂部知名度顯示。 */
function updateFame(){const e=document.getElementById('d-rep');if(e&&G)e.textContent=Math.round(G.fame||0)+'/'+TIER_NAME[fameTier()]}
