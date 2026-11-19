/* ═════ [07z_saveio] ═════ */
'use strict';
/* ======================= 存檔匯出與匯入（.sav） =======================
 *  - 匯出：開局畫面（有存檔時）與設定面板。存檔文字一律壓縮（瀏覽器內建 CompressionStream），加上檢查碼並打亂內容後下載成 .sav。
 *  - 匯入：只在開局畫面，選擇檔案；成功後直接進入遊戲。這台裝置已有存檔時先確認是否取代。
 *  - 檔案格式：開頭標記「TNYJ」(4) ＋ 格式版本 (1) ＋ 遊戲版本字串長度 (1) ＋ 遊戲版本字串 ＋ 亂數 (8) ＋ 檢查碼 (8) ＋ 打亂後的壓縮內容。
 *    檢查碼＝暗碼＋亂數＋壓縮內容的兩組 32 位元雜湊；打亂＝以暗碼與亂數為種子的亂數流做 XOR。
 *  - 防竄改的限度：擋得住直接改檔案內容；原始碼公開，有心人讀過程式仍可自製檔案。
 *  - 匯入檢查：標記、檢查碼、版本相同、欄位完整、人生未落幕；解壓縮後的文字含「<」「>」一律拒絕（遊戲存檔不會用到這兩個字元）。 */
const SAVE_MAGIC=[84,78,89,74],SAVE_FMT=1,SAVE_SECRET=UT('save.SAVE_SECRET');
const saveEnc=s=>new TextEncoder().encode(s);
/** 32 位元雜湊（FNV-1a 加上混合），seed 不同得到不同的一組。 */
function saveHash(parts,seed){
  let h=(2166136261^seed)>>>0;
  parts.forEach(b=>{for(let i=0;i<b.length;i++){h^=b[i];h=Math.imul(h,16777619)}});
  h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0;
}
/** 以暗碼與亂數為種子的亂數流，對內容做 XOR（打亂與還原是同一個動作）。 */
function saveXor(bytes,nonce){
  let t=saveHash([saveEnc(SAVE_SECRET),nonce],0x51ed270b);const out=new Uint8Array(bytes.length);
  for(let i=0;i<bytes.length;i++){if((i&3)===0){t=(t+0x6D2B79F5)>>>0;var x=Math.imul(t^(t>>>15),t|1);x^=x+Math.imul(x^(x>>>7),x|61);x=(x^(x>>>14))>>>0}out[i]=bytes[i]^((x>>>((i&3)*8))&255)}
  return out;
}
const saveCheck=(z,nonce)=>{const s=saveEnc(SAVE_SECRET),a=saveHash([s,nonce,z],0x9e3779b9),b=saveHash([z,nonce,s],0x7f4a7c15);return [a>>>24,a>>>16&255,a>>>8&255,a&255,b>>>24,b>>>16&255,b>>>8&255,b&255]};
async function saveStream(bytes,S){return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(S)).arrayBuffer())}
/** 檔名一律用英數字（部分瀏覽器與系統會把非英數字的檔名改成「download」而丟掉副檔名）：tonya_jijou_3y05m2.sav＝第 3 年 5 月中旬。 */
const saveFileName=o=>'tonya_jijou_'+((o.year||0)+1)+'y'+String(o.month||1).padStart(2,'0')+'m'+(o.cycle||1)+'.sav';
/** 匯出：遊戲中先存一次檔；開局畫面用瀏覽器裡的存檔。 */
async function exportSave(){
  let o=G;if(o&&!o.ended)save();else o=loadSave();
  if(!o||o.ended){toast(MSG('save.none'));return}
  if(typeof CompressionStream==='undefined'){toast(MSG('save.exportFail'));return}
  try{
    const z=await saveStream(saveEnc(JSON.stringify(o)),new CompressionStream('deflate-raw'));
    const nonce=new Uint8Array(8);crypto.getRandomValues(nonce);
    const ver=saveEnc(String(o.ver||GAME_VER)),chk=saveCheck(z,nonce),body=saveXor(z,nonce);
    const out=new Uint8Array(4+1+1+ver.length+8+8+body.length);let p=0;
    out.set(SAVE_MAGIC,p);p+=4;out[p++]=SAVE_FMT;out[p++]=ver.length;out.set(ver,p);p+=ver.length;out.set(nonce,p);p+=8;out.set(chk,p);p+=8;out.set(body,p);
    const f=saveFileName(o),url=URL.createObjectURL(new Blob([out],{type:'application/octet-stream'})),a=document.createElement('a');
    a.href=url;a.download=f;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
    sfx.coin();toast(MSG('save.exported',{f}),4200);
  }catch(e){toast(MSG('save.exportFail'))}
}
/** 讀檔案並還原成存檔物件；失敗時丟出要顯示的訊息。 */
async function decodeSaveFile(buf){
  const b=new Uint8Array(buf);
  if(b.length<30||SAVE_MAGIC.some((v,i)=>b[i]!==v)||b[4]!==SAVE_FMT)throw MSG('save.badFile');
  const vl=b[5],ver=new TextDecoder().decode(b.slice(6,6+vl));let p=6+vl;
  const nonce=b.slice(p,p+8);p+=8;const chk=b.slice(p,p+8);p+=8;
  const z=saveXor(b.slice(p),nonce),want=saveCheck(z,nonce);
  if(want.some((v,i)=>chk[i]!==v))throw MSG('save.tampered');
  if(!saveVerOK(ver))throw MSG('save.badVer',{v:ver,g:GAME_VER});
  let s;try{s=new TextDecoder().decode(await saveStream(z,new DecompressionStream('deflate-raw')))}catch(e){throw MSG('save.tampered')}
  if(/[<>]/.test(s))throw MSG('save.badContent');
  let o;try{o=JSON.parse(s,(k,v)=>(k==='__proto__'||k==='constructor'||k==='prototype')?undefined:v)}catch(e){throw MSG('save.badContent')}
  if(!o||typeof o!=='object'||!saveVerOK(o.ver))throw MSG('save.badVer',{v:o&&o.ver||ver,g:GAME_VER});
  if(!(o.me&&o.rel&&o.inv&&o.emps&&o.world&&o.world.npcs&&o.mk&&o.cityId&&CITY(o.cityId)&&SYS_BY_KEY[o.sysKey]))throw MSG('save.badContent');
  if(o.ended)throw MSG('save.ended');
  return {o,s};
}
/** 匯入：選好檔案後還原、確認取代、寫入瀏覽器存檔並直接進入遊戲。 */
async function importSaveFile(file){
  if(!file)return;
  let r;try{r=await decodeSaveFile(await file.arrayBuffer())}catch(e){sfx.bad();toast(typeof e==='string'?e:MSG('save.badFile'),4200);return}
  const cur=loadSave();
  if(cur&&!cur.ended&&!confirm(MSG('save.replace',{n:cur.me.name})))return;
  try{localStorage.setItem(SAVE_KEY,r.s)}catch(e){}
  enterSave(r.o);toast(MSG('save.imported',{n:r.o.me.name}),4200);
}
/** 開局畫面下方：匯出（有存檔時）與匯入。 */
function saveIoHtml(has){
  return UT('save.saveIoHtml',{a:has?'<button class="pixel-btn" style="flex:1;padding:7px" data-act="exportSave">'+UT('btn.exportSave')+'</button>':''})+'<button class="pixel-btn" style="flex:1;padding:7px" data-act="importSave">'+UT('btn.importSave')+'</button></div>'+'<input type="file" id="save-file" style="display:none">'+'<div class="tiny" style="text-align:center;color:#cfc6b6;margin-top:4px">'+esc(has?UT('txt.exportNote')+' '+UT('txt.importNote'):UT('txt.importNote'))+'</div>';
}
ACT.exportSave=()=>{exportSave()};
ACT.importSave=()=>{const f=$('#save-file');if(f){f.value='';f.click()}};
document.addEventListener('change',e=>{if(e.target&&e.target.id==='save-file'&&e.target.files&&e.target.files[0])importSaveFile(e.target.files[0])});

/* ═════ [07zf_festwalk] ═════ */
'use strict';
/* ======================= 逛祭典（本城節慶那一旬） =======================
 *  - 入口：節慶那一旬，主畫面「出門前往」上方出現一整列按鈕「🏮 逛祭典：○○」。扣 1 行動；不擲出門遇襲（人潮擁擠）；
 *    每次節慶只能逛一次（G.festWalkT＝逛過的那一旬）；養傷、遠島期間不能逛。
 *  - 逛一次抽一件：① 撿到好東西 25%（非本業奢侈品 1 單位入他行貨）② 巧遇名伶 25%（好感 +5，只有對話）
 *    ③ 官員微服出遊 15%（一～四階本城官員好感 +5，看出他的性向）④ 扒手 15%（現款 1～3%、最多 300 兩；家中有保鏢則抓住扒手）
 *    ⑤ 闔家同遊 20%（有夫人、子女或側室才會抽到；側室好感 +5）。抽到的事件不成立時（倉位不足、沒有對象），改從成立的事件中重抽。 */
const FEST_WALK_W={item:25,oiran:25,official:15,thief:15,family:20};
/** 開頭的祭典氛圍句（{f}＝節慶名）。 */
const FEST_OPEN=[
  UT('fwalk.FEST_OPEN'),
  UT('fwalk.FEST_OPEN.2'),
  UT('fwalk.FEST_OPEN.3'),
  UT('fwalk.FEST_OPEN.4')
];
const festWalked=()=>!!G&&G.festWalkT===G.turn;
/** 主畫面的逛祭典按鈕列（不是節慶時不顯示）。 */
function festWalkHtml(){
  if(!G||!G.festival)return '';
  const done=festWalked();
  return '<button class="pixel-btn '+(done?'':'btn-gold')+'" style="width:100%;margin-top:6px" data-act="festWalk"'+UT('fwalk.festWalkHtml.3',{a:done?' disabled':'',b:esc(G.festival),c:done?UT('fwalk.festWalkHtml'):UT('fwalk.festWalkHtml.2')})+'</button>';
}
/** 各事件是否成立，回傳 {key:資料}。 */
function festCands(){
  const C={};
  const room=invCap()-invUsed()-pendingQty();
  const lux=COMM.filter(c=>c.luxury&&c.sys!==G.sysKey);
  if(room>=1&&lux.length)C.item={c:pick(lux)};
  const oi=oiranAll().filter(n=>alive(n.cid));if(oi.length)C.oiran={n:pick(oi)};
  const of=officialsOf(G.cityId).filter(n=>n.pos.rank<=4&&!awayNow(n)&&!isEnemy(n.cid));if(of.length)C.official={n:pick(of)};
  C.thief={};
  if(G.family.spouse||(G.family.kids||[]).length||(G.family.conc||[]).length)C.family={};
  return C;
}
/** 抽一件事件並套用效果，回傳 {cid,txt,eff}；pre 換一組敘事文字（初詣用 hatsu）。 */
function festWalkRoll(pre){
  const P=pre||'fest';                              // 文字前綴：fest＝逛祭典、hatsu＝正月初詣（07zzi_stress.js）
  const C=festCands(),keys=Object.keys(FEST_WALK_W).filter(k=>C[k]);
  let r=rnd()*keys.reduce((a,k)=>a+FEST_WALK_W[k],0),k=keys[0];
  for(const x of keys){r-=FEST_WALK_W[x];if(r<=0){k=x;break}}
  const D=C[k];
  if(k==='item'){
    G.xinv=G.xinv||{};G.xinv[D.c.name]=(G.xinv[D.c.name]||0)+1;
    return {txt:MSG(P+'.item',{n:D.c.short}),eff:UT('fwalk.festWalkRoll',{a:D.c.short})};
  }
  if(k==='oiran'){
    const cid=D.n.cid,r0=R(cid);addKnown(cid);addAff(r0,5);logRel(cid,UT('fwalk.festWalkRoll.2',{a:G.festival}));
    return {cid,txt:MSG(P+'.oiran',{n:nameOf(cid)}),eff:UT('fwalk.festWalkRoll.3',{a:nameOf(cid)})};
  }
  if(k==='official'){
    const cid=D.n.cid,r0=R(cid),known=r0.topKnown;addKnown(cid);addAff(r0,5);r0.topKnown=true;logRel(cid,UT('fwalk.festWalkRoll.4',{a:G.festival}));
    return {cid,txt:MSG(P+'.official',{n:nameOf(cid),t:offTitle(D.n)}),eff:UT('fwalk.festWalkRoll.6',{a:nameOf(cid),b:known?'':UT('fwalk.festWalkRoll.5')})};
  }
  if(k==='thief'){
    if(guardCount()>0)return {txt:MSG(P+'.thiefCaught'),eff:UT('fwalk.festWalkRoll.7')};
    if(G.silver<=0)return {txt:MSG(P+'.thiefEmpty'),eff:UT('fwalk.festWalkRoll.8')};
    const loss=Math.min(300,Math.max(1,Math.round(G.silver*(0.01+rnd()*0.02))));G.silver-=loss;
    return {txt:MSG(P+'.thief'),eff:UT('fwalk.festWalkRoll.9',{a:fmt(loss)}),bad:true};
  }
  const conc=(G.family.conc||[]).map(x=>x.cid).filter(cid=>G.rel[cid]);
  conc.forEach(cid=>{addAff(R(cid),5);logRel(cid,UT('fwalk.festWalkRoll.10',{a:G.festival}))});
  addStress('famwalk',-ODDS.stress.famwalk);                 // 闔家同遊（07zzi_stress.js）
  return {txt:MSG(P+'.family',{who:famWho()}),eff:conc.length?UT('fwalk.festWalkRoll.11'):UT('fwalk.festWalkRoll.12')};
}
/** 同遊的家人稱呼。 */
function famWho(){const L=[];if(G.family.spouse)L.push(NEWS('fwalk.famWho'));if((G.family.kids||[]).length)L.push(NEWS('fwalk.famWho.2'));if((G.family.conc||[]).length)L.push(NEWS('fwalk.famWho.3'));return L.join(UT('fwalk.famWho.4'))||UT('fwalk.famWho.5')}
/** 官員職稱（找不到時用官階）。 */
function offTitle(n){try{return posTitle(n)}catch(e){return ''}}
ACT.festWalk=()=>{
  if(!G||!G.festival)return;
  if(festWalked()){toast(MSG('fest.done'));return}
  if(injuredBlock())return;
  if(!spendAP())return;
  G.festWalkT=G.turn;
  const fest=G.festival,open=FEST_OPEN[Math.floor(rnd()*FEST_OPEN.length)].replace('{f}',fest);
  const res=festWalkRoll();
  playFx('walk',UT('fwalk.festWalk',{a:fest}),homeCity().name,()=>{
    UI.showInfo('🏮 '+fest,(res.cid?'<div style="display:flow-root">'+portraitHtml(res.cid,56):'<div>')+'<div class="notice tiny">'+esc(open)+'</div><div class="small" style="margin-top:6px">'+esc(res.txt)+'</div></div>'
      +'<div class="tiny bold" style="margin-top:6px">'+esc(res.eff)+'</div>');
    if(res.bad)sfx.bad();else sfx.coin();
    UI.render();
  },900);
};

/* ═════ [07zm_migrate] ═════ */
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
/** 舊存檔的必需品件數與單價換成新單位（一件是原本的 ODDS.staple.unit 倍）：件數 ÷ f、單價 × f；只換一次（G.stapleUnit）。 */
function migrateStapleUnit(){
  const to=ODDS.staple.unit,from=G.stapleUnit||1;if(from===to)return;
  const f=to/from,S=new Set(COMM.filter(c=>c.staple).map(c=>c.name)),isS=n=>S.has(n);
  const q=v=>Number.isFinite(v)?Math.round(v/f):v,qc=v=>Number.isFinite(v)?(v>0?Math.max(1,Math.round(v/f)):0):v,qf=v=>Number.isFinite(v)?v/f:v,p=v=>Number.isFinite(v)?+(v*f).toFixed(2):v;
  const each=(o,fn)=>{if(o)Object.keys(o).forEach(n=>{if(isS(n))fn(n)})};
  each(G.inv,n=>G.inv[n]=q(G.inv[n]));each(G.xinv,n=>G.xinv[n]=q(G.xinv[n]));
  each(G.stockSource,n=>{const s=G.stockSource[n];s.known=qf(s.known);s.dapan=qf(s.dapan)});
  each(G.avgCost,n=>G.avgCost[n]=p(G.avgCost[n]));
  each(G.lastGap,n=>G.lastGap[n]=qf(G.lastGap[n]));
  if(G.supplyQuarter&&G.supplyQuarter.gap)each(G.supplyQuarter.gap,n=>G.supplyQuarter.gap[n]=qf(G.supplyQuarter.gap[n]));
  if(G.staple&&G.staple.h)each(G.staple.h,n=>G.staple.h[n]=G.staple.h[n].map(p));
  each(G.mk,n=>{const m=G.mk[n];
    ['quote','quoteBase','quoteRelief','price','lastClose','prevQuote','close','closeBase','closeRelief'].forEach(k=>{if(m[k]!=null)m[k]=p(m[k])});
    m.hist=(m.hist||[]).map(p);['D','so','shipped','depTotal','depKnown','depDapan'].forEach(k=>m[k]=qf(m[k]));
    (m.past||[]).forEach(x=>['d','d0','so','my'].forEach(k=>x[k]=qf(x[k])));
    if(m.snap)['d','d0','dn','so','my'].forEach(k=>m.snap[k]=qf(m.snap[k]));
    (m.depPast||[]).forEach(x=>['total','known','dapan'].forEach(k=>x[k]=qf(x[k])));
  });
  (G.orders||[]).forEach(o=>{if(isS(o.name)){o.qty=qc(o.qty);o.unit=p(o.unit)}});
  (G.kake||[]).forEach(k=>{if(isS(k.name)){k.qty=qc(k.qty);k.filled=q(k.filled);k.unit=p(k.unit)}});
  [G.honjin,G.tribute,G.consign&&null].forEach(x=>{if(x&&isS(x.name)){x.qty=qc(x.qty);if(x.filled!=null)x.filled=q(x.filled)}});
  (G.consign||[]).forEach(x=>{if(isS(x.name))x.qty=qc(x.qty)});
  [G.kyusai,G.yami].forEach(x=>{if(x&&x.items)x.items.forEach(i=>{if(isS(i.name)){i.qty=qc(i.qty);i.filled=q(i.filled)}})});
  (G.chumon||[]).forEach(o=>{if(isS(o.name)){o.qty=qc(o.qty);o.unit=p(o.unit)}});
  (G.ships||[]).forEach(s=>{if(s.out&&isS(s.out.name)){s.out.q=qc(s.out.q);if(s.out.unit)s.out.unit=p(s.out.unit)}});
  if(G.lodge&&isS(G.lodge.name))G.lodge.q=qc(G.lodge.q);
  if(G.stash&&G.stash.items)G.stash.items.forEach(x=>{if(isS(x.name)){x.q=qc(x.q);if(x.unit)x.unit=p(x.unit)}});
  if(G.ujob&&isS(G.ujob.name)){G.ujob.qty=qc(G.ujob.qty);G.ujob.done=q(G.ujob.done)}
  if(G.rushLot&&isS(G.rushLot.name))G.rushLot.q=qc(G.rushLot.q);
  if(G.artisan&&isS(G.artisan.name)&&G.artisan.unit)G.artisan.unit=p(G.artisan.unit);
  G.plan={};G.buyPlan={};G.sold={};G.rvLot=null;
  G.stapleUnit=to;
}
function migrateSave(){
  if(!G)return;
  migrateKeys();                                    // 0.7 以前：中文鍵換成代號
  migrateStapleUnit();                              // 必需品換成新的遊戲單位（第二百七十四節）
  G.flags=G.flags||{};
  Object.values((G.world&&G.world.npcs)||{}).forEach(n=>{if(n.hiredBy){n.hired=false;delete n.hiredBy}});   // 舊版「另謀高就被同業聘走」的人放回人才池
  sanitizeIntros();                                 // 介紹人名單：去掉已不能當介紹人的人
  officialMigrate();                                // 已刪除的官職換新；本城缺的官署席位由名冊補上
  if(!G.shipLock)G.shipLock={};                     // 停賣鎖（第二百九十九節）：舊存檔不預設鎖
  if(G.guide===undefined)G.guide=null;              // 開業指引：舊存檔不帶（第二百八十三節）
  if(!G.diff)G.diff='hard';                          // 難度（第二百八十二節）：舊存檔照原本的九成，算困難
  if(G.fameFloor===undefined)G.fameFloor=0;          // 永久知名度下限（新町取立、國產取立）
  if(!G.caughtLog)G.caughtLog={};
  if(!G.rec)recOf();                                 // 商號紀錄（旬報、番付、走勢）；舊存檔從現存的番付補起                    // 違約查獲的公開紀錄（公會長候選人用）
  if(G.gm===undefined){                              // 0.7.3 公會長：舊存檔由市佔率最高的同業擔任，到下一個 3 月例會改選
    const rows=(G.share&&G.share.rows)||[],L=cityNpcs(G.cityId,'rival').filter(n=>alive(n.cid));
    const sh=c=>((rows.find(r=>r.cid===c)||{}).share||0),top=L.slice().sort((a,b)=>sh(b.cid)-sh(a.cid))[0];
    G.gm=top?{cid:top.cid,other:null,year:G.year}:null;
  }
  if(G.gmDue===undefined)G.gmDue=null;
  if(!G.gmOut)G.gmOut={};
  if(!G.cityRoutes)G.cityRoutes={};
  if(G.cartel&&G.cartel.state==='secret')G.cartel.state='pledged';   // 暗約已取消（第二百五十六節）：改為參加，訂約金保留                  // 後天開通的海運（外港開闢）
  if(!G.openedRoads)G.openedRoads=[];                // 開闢的道路（地區 id）
  if(!G.debts)G.debts=[];
  if(!G.guild)G.guild={};                            // 公會例會（07yb_meeting.js）；舊存檔的一期與季度人口在下一次例會時結算
  Object.entries(G.mk||{}).forEach(([name,m])=>{      // 舊存檔的即時市價轉成本旬固定牌價；既有曲線視為收市紀錄
    m.hist=Array.isArray(m.hist)?m.hist:[];
    m.depPast=Array.isArray(m.depPast)?m.depPast.slice(-ODDS.dapanDependency.win):[];m.depTotal=Number.isFinite(m.depTotal)?m.depTotal:0;m.depKnown=Number.isFinite(m.depKnown)?m.depKnown:0;m.depDapan=Number.isFinite(m.depDapan)?m.depDapan:0;
    const q=m.quote>0?m.quote:(m.price>0?m.price:(m.hist.length?m.hist[m.hist.length-1]:marketIndex(name))),f=marketFloor(name);
    m.quoteFloor=q<=f;m.quote=Math.max(q,f);m.price=m.quote;m.quoteBase=Math.max(m.quoteBase>0?m.quoteBase:marketIndex(name,true),f);m.quoteRelief=Math.max(m.quoteRelief>0?m.quoteRelief:reliefIndex(name,0),f);
    m.lastClose=m.lastClose>0?m.lastClose:q;m.prevQuote=m.prevQuote>0?m.prevQuote:(m.hist.length>1?m.hist[m.hist.length-2]:m.quote);
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
