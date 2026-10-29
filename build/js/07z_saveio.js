'use strict';
/* ======================= 存檔匯出與匯入（.sav） =======================
 *  - 匯出：開局畫面（有存檔時）與設定面板。存檔文字一律壓縮（瀏覽器內建 CompressionStream），加上檢查碼並打亂內容後下載成 .sav。
 *  - 匯入：只在開局畫面，選擇檔案；成功後直接進入遊戲。這台裝置已有存檔時先確認是否取代。
 *  - 檔案格式：開頭標記「TNYJ」(4) ＋ 格式版本 (1) ＋ 遊戲版本字串長度 (1) ＋ 遊戲版本字串 ＋ 亂數 (8) ＋ 檢查碼 (8) ＋ 打亂後的壓縮內容。
 *    檢查碼＝暗碼＋亂數＋壓縮內容的兩組 32 位元雜湊；打亂＝以暗碼與亂數為種子的亂數流做 XOR。
 *  - 防竄改的限度：擋得住直接改檔案內容；原始碼公開，有心人讀過程式仍可自製檔案。
 *  - 匯入檢查：標記、檢查碼、版本相同、欄位完整、人生未落幕；解壓縮後的文字含「<」「>」一律拒絕（遊戲存檔不會用到這兩個字元）。 */
const SAVE_MAGIC=[84,78,89,74],SAVE_FMT=1,SAVE_SECRET='問屋事情·暖簾·serusiya·tonya-jijou·0.7';
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
  COMM_RENAME.forEach(([a,c])=>{s=s.split(a).join(c)});
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
  return '<div class="hr-title" style="color:#e5a93b;margin-top:14px">存檔轉移</div><div style="display:flex;gap:6px">'
    +(has?'<button class="pixel-btn" style="flex:1;padding:7px" data-act="exportSave">'+UT('btn.exportSave')+'</button>':'')
    +'<button class="pixel-btn" style="flex:1;padding:7px" data-act="importSave">'+UT('btn.importSave')+'</button></div>'
    +'<input type="file" id="save-file" style="display:none">'
    +'<div class="tiny" style="text-align:center;color:#cfc6b6;margin-top:4px">'+esc(has?UT('txt.exportNote')+' '+UT('txt.importNote'):UT('txt.importNote'))+'</div>';
}
ACT.exportSave=()=>{exportSave()};
ACT.importSave=()=>{const f=$('#save-file');if(f){f.value='';f.click()}};
document.addEventListener('change',e=>{if(e.target&&e.target.id==='save-file'&&e.target.files&&e.target.files[0])importSaveFile(e.target.files[0])});
