'use strict';
/* ★檔案總覽：世界生成
 * - ROLE_MAP/roleOf：把名冊人物的「適任職務」對應成遊戲角色（官吏、同業、掮客…）。
 * - COURTS/OFF_POS/RANK_INFO：三系官署官制（行政/財務/司法）與官階索引，資料來自 OFFICIALS。
 * - genWorld：每局從千人名冊隨機抽樣 600～700 人（受開局在世名冊上限限制），分派到各城與官職。
 * - R(cid)：人物關係資料（好感、羈絆、性向是否已知、往來紀錄、承諾）。
 * - newGame：建立全新一局的 G 初始狀態（無員工、無介紹人）。 */
/* ======================= 02 世界：千人抽樣、官制、新局 ======================= */
/** 角色顯示名稱（代號→名稱，在 00_names.js）。 */
const ROLE_LABEL=NAMES.role;
/** 取人物的主要角色（名冊 roles 的第一項：rival／manager／official／smuggler／guard／broker／guest／oiran）。 */
const roleOf=c=>(c.roles&&c.roles[0])||'guest';
/** 人物是否『適任』某角色（roles 任一項符合即可）。 */
const hasRole=(c,key)=>(c.roles||[]).includes(key);

/* 官制索引 */
/** 三系官署定義（行政/財務/司法）與介面配色。 */
const COURTS={administration:{cls:'navy'},finance:{cls:'gold'},judiciary:{cls:'purple'},region:{cls:'red'}};
Object.keys(COURTS).forEach(k=>Object.assign(COURTS[k],{key:k,name:NM('court',k),short:NM('courtShort',k)}));
/** 城市層級的三系官署（地區官制另有人事，不在城市官署內）。 */
const CITY_COURTS=['administration','finance','judiciary'];
/** 職位 id→職位資料（含所屬 court），由 OFFICIALS 展開。 */
const OFF_POS={};
Object.entries(OFFICIALS.systems).forEach(([court,sys])=>sys.positions.forEach(p=>{OFF_POS[p.id]=Object.assign({court},p)}));
/** 官階 1～6 的待遇與權力說明。 */
const RANK_INFO={};OFFICIALS.ranks.forEach(r=>RANK_INFO[r.rank]=r);
/** 對該官階送賄賂金封的基準金額（已折半，最少 1 兩）。 */
const giftGoldCost=rank=>Math.max(1,Math.round(RANK_INFO[rank].bribe_base_gold*0.08));

/** 從某系統某官階隨機挑一個職位。 */
function posPick(court,rank){
  const list=OFFICIALS.systems[court].positions.filter(p=>p.rank===rank);
  return pick(list);
}
/** 本局所有登場人物（id→npc）。 */
function npcs(){return G.world.npcs}
/** 取本局登場人物（含所在城市、角色、官職）；未登場者回傳 undefined。 */
function npc(cid){return G.world.npcs[cid]}
/** 人物姓名。 */
const nameOf=cid=>{const c=CH(cid);return c?c.name:UT('misc.unknown')};
/** 某城在世的登場人物，可依角色過濾。 */
function cityNpcs(cityId,roleKey){
  return Object.values(G.world.npcs).filter(n=>n.cityId===cityId&&alive(n.cid)&&(!roleKey||n.role===roleKey));
}
/** 某城官員，依系統別、官階排序。 */
function officialsOf(cityId){
  return cityNpcs(cityId,'official').filter(n=>n.pos&&n.pos.court!=='region').sort((a,b)=>a.pos.court.localeCompare(b.pos.court)||a.pos.rank-b.pos.rank);
}
/** 官員職稱。 */
function posTitle(n){const p=OFF_POS[n.pos.posId];return p?p.title:roleName('official')}
/** 官員官階名稱。 */
function rankLabel(n){return RANK_INFO[n.pos.rank].title}

/* ---------- 抽樣：千人固定名冊，每局隨機抽 600~700 人 ---------- */
/** 【每局抽樣】從開局在世的名冊中抽 600～700 人（不足 700 時以合格名冊數為上限）：先排好駐節地三系官署（每一系統一～六階各一人，五、六階巡迴）、花街、經理、同行等，其餘依出身地區隨機散布到各城。 */
function genWorld(homeId){
  const home=CITY(homeId);
  const pool=CHARS.filter(c=>c.birth_year<=0&&c.death_year>=2);   // 開局當下在世
  const used=new Set();const W={npcs:{},sampleSize:0};
  const take=(roleKey,n,pred)=>{
    let c=shuffle(pool.filter(x=>!used.has(x.id)&&hasRole(x,roleKey)&&(!pred||pred(x))));
    c.sort((a,b)=>(b.native_region===home.region_id)-(a.native_region===home.region_id));
    const out=c.slice(0,n);out.forEach(x=>used.add(x.id));return out;
  };
  const add=(c,cityId,extra)=>{W.npcs[c.id]=Object.assign({cid:c.id,cityId,role:roleOf(c),pos:null},extra||{})};
  const age0=c=>-c.birth_year;
  // 駐節地：三系官署每一系統一～六階各一人；一～四階常駐，五、六階巡迴各城（見 touring）
  const homeSeats=[];CITY_COURTS.forEach(court=>[1,2,3,4,5,6].forEach(rank=>homeSeats.push([court,rank])));
  homeSeats.forEach(([court,rank])=>{
    let o=take('official',1,c=>age0(c)>=(rank>=3?30:22))[0]||take('official',1)[0];
    if(!o)return;
    const p=posPick(court,rank);
    add(o,homeId,{role:'official',pos:{court,rank,posId:p.id}});
  });
  addRegionOfficials(W,used,pool);                 // 五個地區各 10 位地區官員（遠國奉行所）
  take('oiran',8).forEach(c=>add(c,homeId,{role:'oiran'}));
  take('manager',4,c=>age0(c)>=22&&age0(c)<=62).forEach(c=>add(c,homeId,{role:'manager'}));
  take('rival',4,c=>age0(c)>=28).forEach(c=>add(c,homeId,{role:'rival'}));
  take('smuggler',2).forEach(c=>add(c,homeId,{role:'smuggler'}));
  take('broker',2,c=>age0(c)>=25).forEach(c=>add(c,homeId,{role:'broker'}));
  take('guest',3,c=>age0(c)>=28).forEach(c=>add(c,homeId,{role:'guest'}));
  take('guard',2).forEach(c=>add(c,homeId,{role:'guard'}));
  // 其餘：隨機抽樣至 600~700 人；若在世名冊不足 700 人，以上限人數為準
  const target=rint(Math.min(600,pool.length),Math.min(700,pool.length));W.sampleSize=target;
  const byRegion={};CITIES.forEach(ct=>{(byRegion[ct.region_id]=byRegion[ct.region_id]||[]).push(ct)});
  const rest=shuffle(pool.filter(c=>!used.has(c.id))).slice(0,Math.max(0,target-used.size));
  rest.forEach(c=>{
    const list=byRegion[c.native_region]||CITIES;
    const w=list.map(ct=>Math.sqrt(ct.population));let r=rnd()*w.reduce((a,b)=>a+b,0),ct=list[0];
    for(let i=0;i<list.length;i++){r-=w[i];if(r<=0){ct=list[i];break}}
    const role=roleOf(c);
    const extra={role};
    if(role==='official'&&ct.id===homeId){const alt=list.filter(x=>x.id!==homeId);ct=alt.length?pick(alt):pick(CITIES.filter(x=>x.id!==homeId))}   // 本城官署一階一人，抽樣到本城的官員改派他城
    if(role==='official'){const court=pick(CITY_COURTS);const rank=pick([1,1,2,2,2,3,3,4,5,6]);extra.pos={court,rank,posId:posPick(court,rank).id}}   // 其他城市的官員：一～六階都可能出現
    add(c,ct.id,extra);
  });
  return W;
}
/* ---------- 巡迴官員：本城三系官署的五、六階官員每三個月來本城一個月 ----------
 * 行政系統一、四、七、十月；財務系統二、五、八、十一月；司法系統三、六、九、十二月。 */
const TOUR_MONTH={administration:1,finance:2,judiciary:3};
/** 是否為本城的巡迴官員（三系官署五階以上）。 */
function touring(n){return !!(n&&n.pos&&TOUR_MONTH[n.pos.court]&&n.pos.rank>=5&&n.cityId===G.cityId)}
/** 巡迴官員在某月（預設本月）是否在本城。 */
function tourHere(n,m){return (((m||G.month)-TOUR_MONTH[n.pos.court])%3+3)%3===0}
/** 巡迴在外（不在本城、不能拜訪）。 */
function awayNow(n){return touring(n)&&!tourHere(n)}
/** 下次來本城的月份。 */
function tourNext(n){for(let k=1;k<=3;k++){const m=(G.month-1+k)%12+1;if(tourHere(n,m))return m}return G.month}
/** 每旬：補上本城官署空缺；每月上旬一則巡察消息（本月抵達的系統、上月在城而本月已離城的系統），不寫姓名。 */
function tourTick(log){
  officialMigrate();                              // 本城官署若有空缺（病故、遭害而無人遞補），由名冊補上
  if(G.cycle!==1)return;
  const prev=(G.month+10)%12+1,tour=Object.values(G.world.npcs).filter(n=>touring(n)&&alive(n.cid));
  const courts=f=>CITY_COURTS.filter(k=>tour.some(n=>n.pos.court===k&&f(n))).map(k=>COURTS[k].name).join(NAMES_SEP);
  const arr=courts(n=>tourHere(n)),gone=courts(n=>tourHere(n,prev)&&!tourHere(n));
  if(!arr&&!gone)return;
  const t=NEWS('tour.month',{part:(arr?NEWS('tour.arrive',{c:arr}):'')+(arr&&gone?NEWS('tour.sep'):'')+(gone?NEWS('tour.gone',{c:gone}):'')});pushNews(t);log.push(t);
}
/** 舊存檔整理：已刪除的官職換成同系統同階的官職；本城缺的三系官署席位（含五、六階）由名冊補上。 */
function officialMigrate(){
  Object.values(G.world.npcs).forEach(n=>{if(n.pos&&!OFF_POS[n.pos.posId]){const p=posPick(n.pos.court,n.pos.rank);if(p)n.pos.posId=p.id}});
  CITY_COURTS.forEach(court=>[1,2,3,4,5,6].forEach(rank=>{
    if(Object.values(G.world.npcs).some(n=>n.cityId===G.cityId&&n.pos&&n.pos.court===court&&n.pos.rank===rank&&alive(n.cid)))return;
    const p=posPick(court,rank),free=a=>CHARS.filter(c=>!G.world.npcs[c.id]&&c.birth_year<=G.year-a&&c.death_year>G.year+2&&hasRole(c,'official'));
    let pool=free(rank>=3?30:22);if(!pool.length)pool=free(18);              // 名冊裡年長的官員用完時，放寬年齡
    if(pool.length){const c=pick(pool);G.world.npcs[c.id]={cid:c.id,cityId:G.cityId,role:'official',pos:{court,rank,posId:p.id}};addKnown(c.id);return}
    const far=Object.values(G.world.npcs).filter(n=>n.role==='official'&&n.pos&&n.pos.court!=='region'&&n.cityId!==G.cityId&&alive(n.cid));   // 名冊也用完：從外地調一位官員來補
    if(far.length){const n=pick(far);n.cityId=G.cityId;n.pos={court,rank,posId:p.id};addKnown(n.cid)}
  }));
}
/* 官員病逝或離任後，由未入名冊的同名冊人物遞補 */
/** 官員病逝/離任後，由尚未登場的名冊官員遞補同一職位。 */
function replaceOfficial(old){
  const pool=CHARS.filter(c=>!G.world.npcs[c.id]&&c.birth_year<=G.year-25&&c.death_year>G.year+2&&hasRole(c,'official'));
  if(!pool.length)return null;
  const c=pick(pool);G.world.npcs[c.id]={cid:c.id,cityId:old.cityId,role:'official',pos:Object.assign({},old.pos)};
  return c.id;
}

/* ---------- 關係資料 ---------- */
/** 取（必要時建立）與某人的關係資料：aff 好感、bond 羈絆、topKnown 性向已知、verified 軟肋已證實、log 往來、promises 承諾。 */
function R(cid){
  let r=G.rel[cid];
  if(!r){r=G.rel[cid]={aff:0,met:false,bond:null,topKnown:false,verified:false,note:'',log:[],promises:[],gifts:0,seen:false};}
  return r;
}
/** 設定對某人的好感（0～100）。所有改好感的地方都走這裡；r.lockAff（生死之交）時一律維持 100，任何原因都不下降。 */
function setAff(r,v){if(!r)return;r.aff=r.lockAff?100:clamp(Number(v)||0,0,100)}
/** 增減好感（走 setAff）。 */
const addAff=(r,d)=>setAff(r,(r&&r.aff||0)+d);
/** 把人物列入『已聽聞』名單（筆記只顯示已結識者，見 noteSeen）。 */
function addKnown(cid){if(!G.known.includes(cid)){G.known.push(cid);R(cid).seen=true}}
/** 在往來實錄追加一筆（最多保留 40 筆）。 */
function logRel(cid,text){const r=R(cid);r.log.push({y:G.year,m:G.month,c:G.cycle,t:text});if(r.log.length>40)r.log.shift()}

/* ---------- 新局 ---------- */
/** 主角、子女的名字候選（00_names.js 的 NAMES.given／childM／childF）。 */
const GIVEN=NAMES.given,CHILD_M=NAMES.childM,CHILD_F=NAMES.childF;
/** 每局抽 30～40 座城市：五大地區各取約六到八城，必含本店所在城市與各地區人口最多的主城；本業每項貨品至少要有 2 處產地（該貨全國不足 2 處則全收）。 */
function pickActiveCities(homeId,own){
  const N=rint(30,40),regs=[...new Set(ALL_CITIES.map(c=>c.region_id))],base=Math.floor(N/regs.length);
  const quota={};regs.forEach(r=>quota[r]=base);shuffle(regs.slice()).slice(0,N-base*regs.length).forEach(r=>quota[r]++);
  const capOf=r=>ALL_CITIES.filter(c=>c.region_id===r).sort((x,y)=>y.population-x.population)[0].id,caps=regs.map(capOf);   // 各地區人口最多者為主城，一定入選
  const chosen=new Set([homeId,...caps]);
  regs.forEach(r=>{const pool=shuffle(ALL_CITIES.filter(c=>c.region_id===r&&!chosen.has(c.id)));const k=quota[r]-ALL_CITIES.filter(c=>c.region_id===r&&chosen.has(c.id)).length;pool.slice(0,Math.max(0,k)).forEach(c=>chosen.add(c.id))});
  const prod=n=>ALL_CITIES.filter(c=>c.connected_commodities.includes(n));
  const need=n=>Math.min(2,prod(n).length),have=n=>prod(n).filter(c=>chosen.has(c.id)).length;
  for(let guard=0;guard<80;guard++){
    const lack=own.find(n=>have(n)<need(n));if(!lack)break;
    const add=pick(prod(lack).filter(c=>!chosen.has(c.id)));if(!add)break;
    const keep=new Set([homeId,...caps]);own.forEach(n=>{const ps=prod(n).filter(c=>chosen.has(c.id));if(ps.length<=need(n))ps.forEach(c=>keep.add(c.id))});
    const out=ALL_CITIES.filter(c=>chosen.has(c.id)&&!keep.has(c.id)&&c.region_id===add.region_id);
    const victim=out.length?pick(out):pick(ALL_CITIES.filter(c=>chosen.has(c.id)&&!keep.has(c.id)));
    if(!victim)break;chosen.delete(victim.id);chosen.add(add.id);
  }
  return [...chosen];
}
/** 建立新局：初始化 G（資金、倉庫、公會、關係…）、抽樣世界、初始化市場。開局沒有員工與介紹人，需先找介紹人。 */
function newGame(sysKey,regionPref){
  const S=SYS_BY_KEY[sysKey];
  G={ver:GAME_VER,rs:(Math.random()*4294967296)>>>0,year:0,month:3,cycle:1,turn:0,
    sysKey,firm:UT('me.firm',{firm:S.firm,sys:S.name}),
    me:{family:S.family,given:'',name:'',birthYear:-20,gen:1},
    silver:S.silver,gold:S.gold,
    wh:{n:1,cap:200},guards:0,lic:{wh:0,ship:0,horse:0,guard:0,staff:0},trade:[],lessen:0,
    inv:{},mk:{},flags:{port:false,pass:false,exempt:0,info:null},
    cartel:{state:'pledged',comp:65,sanction:0,quotaPct:0.06,cheated:0,bond:costOf('guildBond'),pEnd:ODDS.guildBond.turns,pot:0,policy:null,policyEnd:ODDS.guildBond.turns},   // 開局即參加協議，擔保金由開局贈送；供給方針在下方各半抽選
    staple:{streak:0,peak:1},ships:[],
    rel:{},known:[],intros:[],introId:null,emps:[],permits:{sea:{},land:{}},
    family:{spouse:null,kids:[],married:false},
    news:[],ticker:[],life:{gifts:0,gold:0,cheats:0,charity:0,fires:0,riots:0,peak:0,contracts:0,pledges:0,scapegoat:0,spouseKind:''},
    mood:'',festival:null,sales:[],lastRev:0,ended:null,legacy:[],
    fame:0,share:null,plan:{},sold:{},guildAt:-99,ap:5,orders:[],arrived:[],heat:0,debts:[],recruit:null,lastSpoil:'',lastCost:0,publicSpend:{},histDone:{},encounterTurn:-1,fameFloor:0,caughtLog:{},cityRoutes:{},openedRoads:[]};
  G.cartel.policy=chance(ODDS.guildPolicy.normal)?'normal':'restrict';
  G.me.given=pick(GIVEN);G.me.name=UT('me.name',{f:G.me.family,g:G.me.given});
  // 駐節城市：人口 6 萬以上較有規模，可指定地區；一律是港口；本店所在城市不能是本業貨品的產地
  const own=commsOfSys(sysKey).map(c=>c.name),producesOwn=ct=>own.some(n=>ct.connected_commodities.includes(n));
  let cs=ALL_CITIES.filter(c=>c.population>=60000&&!producesOwn(c)&&(!regionPref||regionPref==='rand'||c.region_id===regionPref));
  if(!cs.length)cs=ALL_CITIES.filter(c=>!producesOwn(c));
  {const sc=cs.filter(canSea);if(sc.length)cs=sc}   // 所有流派都在港口開局（委託採買的海運要港口）
  G.cityId=pick(cs).id;
  G.cityPopulation=parseInt(CITY(G.cityId).population,10)||0;
  G.supplyQuarter={stable:0,unstable:0,turns:0};
  G.activeIds=pickActiveCities(G.cityId,own);applyActiveCities(G.activeIds);
  G.world=genWorld(G.cityId);
  G.trade=startTrade(sysKey);                     // 第六、七個流派開局送第二貴貨物的交易許可
  initMarket();
  // 開局沒有任何員工，也沒有介紹人：要先找介紹人，再一個一個找員工
  // 官署人物皆為公開身分，列入手帳
  officialsOf(G.cityId).forEach(n=>addKnown(n.cid));
  applyStartBoost(sysKey);
  recordSilver();
  G.yearLog=[];G.yearSilver0=G.silver;
  pushNews(NEWS('newGame.1',{name:G.me.name,CITY:CITY(G.cityId).name,firm:G.firm}));
  pushNews(NEWS('newGame.guild',{c:fmt(costOf('guildBond')),policy:guildPolicyName()}));
  newMeeting();pushNews(NEWS('meet.today'));     // 開局那一旬（3 月上旬）就是第一次例會；平手時沿用開局隨機決定的方針
  pushNews(NEWS(G.emps.length?'newGame.crew':'newGame.alone'));
  return G;
}
