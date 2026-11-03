'use strict';
/* ======================= 存檔補欄位：讀檔與匯入的統一入口 =======================
 *  - 讀本機存檔（ACT.resume）與匯入 .sav（importSaveFile）都經過 enterSave → migrateSave。
 *  - 原則（第十五節、0.8 乙方案）：缺少的欄位一律視為「還沒發生過」，補上預設值後改標為目前版本。
 *  - 新增存檔欄位時，在這裡補一行預設值；接受的舊版本列在 SAVE_VERS（01_core.js）。
 *  - 0.7 以前的存檔用中文名稱當鍵：migrateKeys 把貨物全名（含改名前的舊名 old_names）換成貨物代號，
 *    店員職位、子女性別、借款種類、承諾來源換成代號（名稱表見 00_names.js）。 */
/** 舊存檔的中文鍵 → 代號。貨物名稱取自資料檔，其餘取自名稱表的反查。 */
function legacyKeyMaps(){
  const comm={};COMMS.forEach(c=>{comm[c.name]=c.id;(c.old_names||[]).forEach(o=>comm[o]=c.id)});
  const inv=t=>{const o={};Object.entries(t).forEach(([k,v])=>o[v]=k);return o};
  return {comm,rank:inv(NAMES.rank),gender:inv(NAMES.gender),debt:inv(NAMES.debtKind),by:inv(NAMES.promiseBy)};
}
/** 全面替換：任何物件鍵或字串值剛好是舊貨物全名者換成代號（貨物名稱不會與其他文字完全相同）。 */
function migrateCommNames(o,M){
  if(Array.isArray(o)){for(let i=0;i<o.length;i++){const v=o[i];if(typeof v==='string'){if(M[v])o[i]=M[v]}else if(v&&typeof v==='object')migrateCommNames(v,M)}return o}
  if(!o||typeof o!=='object')return o;
  for(const k of Object.keys(o)){
    let v=o[k];
    if(typeof v==='string'&&M[v])v=o[k]=M[v];else if(v&&typeof v==='object')migrateCommNames(v,M);
    if(M[k]){const nk=M[k];o[nk]=(typeof v==='number'&&typeof o[nk]==='number')?o[nk]+v:v;delete o[k]}
  }
  return o;
}
function migrateKeys(){
  const L=legacyKeyMaps(),fix=(o,k,T)=>{if(o&&typeof o[k]==='string'&&T[o[k]])o[k]=T[o[k]]};
  migrateCommNames(G,L.comm);
  (G.emps||[]).forEach(e=>fix(e,'rank',L.rank));
  if(G.recruit)fix(G.recruit,'rank',L.rank);
  if(G.party&&G.party.att)G.party.att.forEach(a=>fix(a,'rank',L.rank));
  ((G.family&&G.family.kids)||[]).forEach(k=>fix(k,'gender',L.gender));
  (G.debts||[]).forEach(d=>fix(d,'kind',L.debt));
  Object.values(G.rel||{}).forEach(r=>(r.promises||[]).forEach(p=>fix(p,'by',L.by)));
}
function migrateSave(){
  if(!G)return;
  migrateKeys();                                    // 0.7 以前：中文鍵換成代號
  G.flags=G.flags||{};
  sanitizeIntros();                                 // 介紹人名單：去掉已不能當介紹人的人
  officialMigrate();                                // 已刪除的官職換新；本城缺的官署席位由名冊補上
  if(G.fameFloor===undefined)G.fameFloor=0;          // 永久知名度下限（新町取立、國產取立）
  if(!G.caughtLog)G.caughtLog={};                    // 違約查獲的公開紀錄（公會長候選人用）
  if(!G.cityRoutes)G.cityRoutes={};                  // 後天開通的海運（外港開闢）
  if(!G.openedRoads)G.openedRoads=[];                // 開闢的道路（地區 id）
  if(!G.debts)G.debts=[];
  if(!G.guild)G.guild={};                            // 公會例會（07yb_meeting.js）；舊存檔的一期與季度人口在下一次例會時結算
  Object.entries(G.mk||{}).forEach(([name,m])=>{      // 舊存檔的即時市價轉成本旬固定牌價；既有曲線視為收市紀錄
    m.hist=Array.isArray(m.hist)?m.hist:[];
    m.depPast=Array.isArray(m.depPast)?m.depPast.slice(-ODDS.dapanDependency.win):[];m.depTotal=Number.isFinite(m.depTotal)?m.depTotal:0;m.depKnown=Number.isFinite(m.depKnown)?m.depKnown:0;m.depDapan=Number.isFinite(m.depDapan)?m.depDapan:0;
    const q=m.quote>0?m.quote:(m.price>0?m.price:(m.hist.length?m.hist[m.hist.length-1]:marketIndex(name)));
    m.quote=q;m.price=q;m.quoteBase=m.quoteBase>0?m.quoteBase:marketIndex(name,true);m.quoteRelief=m.quoteRelief>0?m.quoteRelief:reliefIndex(name,0);
    m.lastClose=m.lastClose>0?m.lastClose:q;m.prevQuote=m.prevQuote>0?m.prevQuote:(m.hist.length>1?m.hist[m.hist.length-2]:q);
    m.close=null;m.closeBase=null;m.closeRelief=null;
  });
  meetEnsure();
  buyoutEnsure();                                    // 舊存檔補上本年度五區大口買付排程
  originSupplyEnsure();                              // 舊存檔補上本局固定的產地供貨種子
  if(!G.originTrips||typeof G.originTrips!=='object')G.originTrips={y:G.year,m:G.month,byCity:{}};
  if(G.originTrips.y!==G.year||G.originTrips.m!==G.month||!G.originTrips.byCity)G.originTrips={y:G.year,m:G.month,byCity:{}};
  (G.ships||[]).filter(s=>s.entrust&&s.supplyY===G.year&&s.supplyM===G.month).sort((a,b)=>(a.start||0)-(b.start||0)).forEach(s=>{
    const k=s.origId;if(s.supplyRank>0)G.originTrips.byCity[k]=Math.max(G.originTrips.byCity[k]||0,s.supplyRank);
    else{s.supplyRank=(G.originTrips.byCity[k]||0)+1;G.originTrips.byCity[k]=s.supplyRank}
  });
  G.ver=GAME_VER;
}
