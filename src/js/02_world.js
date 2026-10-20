'use strict';
/* ★檔案總覽：世界生成
 * - ROLE_MAP/roleOf：把名冊人物的「適任職務」對應成遊戲角色（官吏、同業、掮客…）。
 * - COURTS/OFF_POS/RANK_INFO：三院官制（行政/財務/司法）與官階索引，資料來自 OFFICIALS。
 * - genWorld：每局從千人名冊隨機抽樣 300～500 人，分派到各城與官職。
 * - R(cid)：人物關係資料（好感、羈絆、性向是否已知、往來紀錄、承諾）。
 * - newGame：建立全新一局的 G 初始狀態（無員工、無介紹人）。 */
/* ======================= 02 世界：千人抽樣、官制、新局 ======================= */
/** 名冊『適任職務』文字→遊戲角色的對照。 */
const ROLE_MAP=[['商業競爭對手','rival'],['大番頭候選','manager'],['港務與稅務奉行','official'],['遠洋海運走私首領','smuggler'],['用心棒保鑣總頭目','guard'],['情報販子與掮客','broker'],['地方商號座客散戶','guest'],['吉原花魁名伶','oiran']];
/** 角色顯示名稱。 */
const ROLE_LABEL={rival:'同業巨賈',manager:'經營好手',official:'官吏',smuggler:'私梟',guard:'武侍頭目',broker:'掮客',guest:'座客商人',oiran:'花街名伶',concubine:'側室'};
/** 取人物的主要角色（依第一個適任職務）。 */
const roleOf=c=>{const r=(c.suitable_roles&&c.suitable_roles[0])||'';for(const [k,v] of ROLE_MAP)if(r.includes(k))return v;return 'guest'};
/** 人物是否『適任』某角色（任一適任職務符合即可）。 */
const hasRole=(c,key)=>(c.suitable_roles||[]).some(r=>{const m=ROLE_MAP.find(x=>r.includes(x[0]));return m&&m[1]===key});

/* 官制索引 */
/** 三院定義（行政/財務/司法）與介面配色。 */
const COURTS={administration:{key:'administration',name:'行政',cls:'navy',short:'政'},finance:{key:'finance',name:'財務',cls:'gold',short:'財'},judiciary:{key:'judiciary',name:'司法',cls:'purple',short:'法'},region:{key:'region',name:'地區',cls:'red',short:'域'}};
/** 城市層級的三院（地區官制另有人事，不在城市官署內）。 */
const CITY_COURTS=['administration','finance','judiciary'];
/** 職位 id→職位資料（含所屬 court），由 OFFICIALS 展開。 */
const OFF_POS={};
Object.entries(OFFICIALS.systems).forEach(([court,sys])=>sys.positions.forEach(p=>{OFF_POS[p.id]=Object.assign({court},p)}));
/** 官階 1～6 的待遇與權力說明。 */
const RANK_INFO={};OFFICIALS.ranks.forEach(r=>RANK_INFO[r.rank]=r);
/** 對該官階送『黃金點心』的基準金額（已折半，最少 1 兩）。 */
const giftGoldCost=rank=>Math.max(1,Math.round(RANK_INFO[rank].bribe_base_gold*0.08));

/** 從某院某官階隨機挑一個職位。 */
function posPick(court,rank){
  const list=OFFICIALS.systems[court].positions.filter(p=>p.rank===rank);
  return pick(list);
}
/** 本局所有登場人物（id→npc）。 */
function npcs(){return G.world.npcs}
/** 取本局登場人物（含所在城市、角色、官職）；未登場者回傳 undefined。 */
function npc(cid){return G.world.npcs[cid]}
/** 人物姓名。 */
const nameOf=cid=>{const c=CH(cid);return c?c.name:'？'};
/** 某城在世的登場人物，可依角色過濾。 */
function cityNpcs(cityId,roleKey){
  return Object.values(G.world.npcs).filter(n=>n.cityId===cityId&&alive(n.cid)&&(!roleKey||n.role===roleKey));
}
/** 某城官員，依院別、官階排序。 */
function officialsOf(cityId){
  return cityNpcs(cityId,'official').filter(n=>n.pos&&n.pos.court!=='region').sort((a,b)=>a.pos.court.localeCompare(b.pos.court)||a.pos.rank-b.pos.rank);
}
/** 官員職稱。 */
function posTitle(n){const p=OFF_POS[n.pos.posId];return p?p.title:'官吏'}
/** 官員官階名稱。 */
function rankLabel(n){return RANK_INFO[n.pos.rank].title}

/* ---------- 抽樣：千人固定名冊，每局隨機抽 300~500 人 ---------- */
/** 【每局抽樣】從開局在世的名冊中抽 300～500 人：先排好駐節地三院官署（每院 2～4 階各一人）、花街、經理、同行等，其餘依出身地區隨機散布到各城。 */
function genWorld(homeId){
  const home=CITY(homeId);
  const pool=CHARS.filter(c=>c.birth_year<=0&&c.death_year>=2);   // 開局當下在世
  const used=new Set();const W={npcs:{},sampleSize:0};
  const take=(roleKey,n,pred)=>{
    let c=shuffle(pool.filter(x=>!used.has(x.id)&&hasRole(x,roleKey)&&(!pred||pred(x))));
    c.sort((a,b)=>(b.native_region===home.region_name)-(a.native_region===home.region_name));
    const out=c.slice(0,n);out.forEach(x=>used.add(x.id));return out;
  };
  const add=(c,cityId,extra)=>{W.npcs[c.id]=Object.assign({cid:c.id,cityId,role:roleOf(c),pos:null},extra||{})};
  const age0=c=>-c.birth_year;
  // 駐節地：三院官署（每院 2、3、4 階各一人）
  CITY_COURTS.forEach(court=>[2,3,4].forEach(rank=>{
    let o=take('official',1,c=>age0(c)>=30)[0]||take('official',1)[0];
    if(!o)return;
    const p=posPick(court,rank);
    add(o,homeId,{role:'official',pos:{court,rank,posId:p.id}});
  }));
  addRegionOfficials(W,used,pool);                 // 五個地區各 10 位地區官員（遠國奉行所）
  take('oiran',8).forEach(c=>add(c,homeId,{role:'oiran'}));
  take('manager',4,c=>age0(c)>=22&&age0(c)<=62).forEach(c=>add(c,homeId,{role:'manager'}));
  take('rival',4,c=>age0(c)>=28).forEach(c=>add(c,homeId,{role:'rival'}));
  take('smuggler',2).forEach(c=>add(c,homeId,{role:'smuggler'}));
  take('broker',2,c=>age0(c)>=25).forEach(c=>add(c,homeId,{role:'broker'}));
  take('guest',3,c=>age0(c)>=28).forEach(c=>add(c,homeId,{role:'guest'}));
  take('guard',2).forEach(c=>add(c,homeId,{role:'guard'}));
  // 其餘：隨機抽樣至 300~500 人，依出身地區分派到各城
  const target=rint(300,500);W.sampleSize=target;
  const byRegion={};CITIES.forEach(ct=>{(byRegion[ct.region_name]=byRegion[ct.region_name]||[]).push(ct)});
  const rest=shuffle(pool.filter(c=>!used.has(c.id))).slice(0,Math.max(0,target-used.size));
  rest.forEach(c=>{
    const list=byRegion[c.native_region]||CITIES;
    const w=list.map(ct=>Math.sqrt(ct.population));let r=rnd()*w.reduce((a,b)=>a+b,0),ct=list[0];
    for(let i=0;i<list.length;i++){r-=w[i];if(r<=0){ct=list[i];break}}
    const role=roleOf(c);
    const extra={role};
    if(role==='official'){const court=pick(CITY_COURTS);const rank=pick([1,1,2,2,2,3,3,4,5]);extra.pos={court,rank,posId:posPick(court,rank).id}}
    add(c,ct.id,extra);
  });
  return W;
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
/** 把人物列入『已聽聞』名單（筆記只顯示已結識者，見 noteSeen）。 */
function addKnown(cid){if(!G.known.includes(cid)){G.known.push(cid);R(cid).seen=true}}
/** 在往來實錄追加一筆（最多保留 40 筆）。 */
function logRel(cid,text){const r=R(cid);r.log.push({y:G.year,m:G.month,c:G.cycle,t:text});if(r.log.length>40)r.log.shift()}

/* ---------- 新局 ---------- */
/** 主角名字候選。 */
const GIVEN=['甚左衛門','藤兵衛','彌七郎','傳右衛門','平次郎','利兵衛','宗右衛門','嘉兵衛','太郎左衛門','宗兵衛','清十郎','與三郎'];
/** 男孩名字候選。 */
const CHILD_M=['甚太郎','藤吉','彌市','傳之助','平八','利助','宗吉','嘉七'];
/** 女孩名字候選。 */
const CHILD_F=['小梅','阿鶴','千鶴','阿菊','小雪','阿滿','美代','阿秋'];
/** 建立新局：初始化 G（資金、倉庫、公會、關係…）、抽樣世界、初始化市場。開局沒有員工與介紹人，需先找介紹人。 */
function newGame(sysKey,regionPref){
  const S=SYS_BY_KEY[sysKey];
  G={v:2,rs:(Math.random()*4294967296)>>>0,year:0,month:3,cycle:1,turn:0,
    sysKey,firm:S.firm+'·'+S.name,
    me:{family:S.firm.replace('屋',''),given:'',name:'',birthYear:-20,gen:1},
    silver:S.silver,gold:S.gold,rep:S.rep,
    wh:{n:2,cap:200},guards:0,fleet:S.key==='textile'?3:2,
    inv:{},mk:{},flags:{direct:false,port:false,pass:false,exempt:0,warned:0,info:null},
    cartel:{state:'none',comp:65,sanction:0,quotaPct:0.06,cheated:0},
    staple:{streak:0,peak:1},ships:[],
    rel:{},known:[],intros:[],introId:null,emps:[],permits:{sea:{},land:{}},
    family:{spouse:null,kids:[],married:false},
    news:[],ticker:[],life:{gifts:0,gold:0,cheats:0,charity:0,fires:0,riots:0,peak:0,contracts:0,pledges:0,scapegoat:0,spouseKind:''},
    mood:'',festival:null,sales:[],lastRev:0,ended:null,legacy:[],
    fame:0,share:null,plan:{},sold:{},guildAt:-99,ap:5,orders:[],arrived:[],heat:0,debts:[],recruit:null,lastSpoil:'',lastCost:0,histDone:{}};
  G.me.given=pick(GIVEN);G.me.name=G.me.family+'屋 '+G.me.given;
  // 駐節城市：人口 6 萬以上較有規模，可指定地區
  let cs=CITIES.filter(c=>c.population>=60000&&(!regionPref||regionPref==='rand'||c.region_id===regionPref));
  if(!cs.length)cs=CITIES;
  {const si=SYS.findIndex(x=>x.key===sysKey);if(si===3||si===4||si===6){const sc=cs.filter(canSea);if(sc.length)cs=sc}}   // 有海運開局的流派，起家地需是港灣
  G.cityId=pick(cs).id;
  G.world=genWorld(G.cityId);
  initMarket();
  // 開局沒有任何員工，也沒有介紹人：要先找介紹人，再一個一個找員工
  // 官署人物皆為公開身分，列入手帳
  officialsOf(G.cityId).forEach(n=>addKnown(n.cid));
  applyStartBoost(sysKey);
  pushNews(NEWS('newGame.1',{name:G.me.name,CITY:CITY(G.cityId).name,firm:G.firm}));
  pushNews(G.emps.length?'🏮【人生】你今年 20 歲，帶著起家的班底，開始了這一生。':'🏮【人生】你今年 20 歲，身邊沒有半個夥計。第一步，先找一位肯為你引薦的介紹人。');
  return G;
}
