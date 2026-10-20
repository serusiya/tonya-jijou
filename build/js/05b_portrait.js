/* =====================================================================
 * 05b_portrait.js — 像素頭像（自動生成，無外部素材、無授權問題）
 *  - 24×24 像素，依人物的性別、年齡、身分、官階與「隱藏數值」生成，同一人（同年齡層）每次長相相同。
 *  - 隱藏數值只以表情暗示，不直接顯示：
 *      膽識 → 眉毛粗細與角度（高者眉粗上挑，低者眉細下垂）
 *      貪欲 → 眼睛瞇細並帶金色精光
 *      忠誠／反骨 → 眼神（直視／斜睨）、反骨高者眉毛一高一低並帶冷笑
 *      社交 → 嘴角（上揚／平／下垂）
 *      商才 → 衣領有無金邊
 *  - 對外介面：portraitHtml(cid,px) 與 portraitEmp(e,px)，回傳 <img> 字串（data URL，有快取）。
 * ===================================================================== */

/** 頭像快取：key → data URL。 */
const PT_CACHE={};
/** 簡易字串雜湊（頭像用的固定亂數種子）。 */
function ptHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
/** 以種子產生固定亂數函式。 */
function ptRng(seed){let t=ptHash(seed);return()=>{t=(t+0x6D2B79F5)>>>0;let x=Math.imul(t^(t>>>15),t|1);x^=x+Math.imul(x^(x>>>7),x|61);return((x^(x>>>14))>>>0)/4294967296}}

/** 官署所屬院別的代表色（衣領、帽帶）。 */
const PT_COURT={administration:'#2d4a8a',finance:'#c9962b',judiciary:'#6a3d8f'};
/** 各角色的衣色。 */
const PT_CLOTH={rival:'#7a5a2a',manager:'#3a5a7a',official:'#3a3f55',smuggler:'#3a4a3a',guard:'#2b2b33',broker:'#6a6a6a',guest:'#8a6a5a',oiran:'#c44a6a'};

/**
 * 畫一張頭像並回傳 data URL。
 * o：{seed,gender('男'|'女'),age,role,rank(官階 0=非官員),court,cloth(指定衣色),oiran,st(六項數值)}
 */
function ptDraw(o){
  const cv=document.createElement('canvas');cv.width=24;cv.height=24;const c=cv.getContext('2d');
  const P=(x,y,col)=>{c.fillStyle=col;c.fillRect(x,y,1,1)};
  const H=(x1,x2,y,col)=>{c.fillStyle=col;c.fillRect(x1,y,x2-x1+1,1)};
  const rg=ptRng(o.seed),woman=o.gender==='女',age=o.age,st=o.st||{};
  const g=k=>st[k]===undefined?50:st[k];
  const courage=g('audacity_courage'),greed=g('greed_index'),loyal=g('integrity_loyalty'),betray=g('betrayal_risk'),charm=g('diplomacy_charm'),comm=g('commerce_skill');
  // ---- 色彩 ----
  const skins=['#f1d3b3','#e8c29a','#f4ddc3','#dcb48a'];
  let skin=o.oiran?'#fbeee3':skins[Math.floor(rg()*skins.length)];
  const shade=o.oiran?'#e3cdbd':'#c99d78';
  const bg=o.court?{administration:'#cfd7ea',finance:'#efe2bf',judiciary:'#ddd0ea'}[o.court]:'#e3d9c2';
  const cloth=o.cloth||(woman&&!o.oiran?'#a85a6a':PT_CLOTH[o.role]||'#6a5a4a');
  const hairBase='#1b1713';
  const hairCol=()=>age>=62?'#dedbd5':(age>=45&&rg()<(age-45)/17*0.9)?'#8d8a86':hairBase;
  // ---- 背景、衣服、頸 ----
  c.fillStyle=bg;c.fillRect(0,0,24,24);
  H(4,19,18,cloth);for(let y=19;y<=23;y++)H(2,21,y,cloth);
  H(10,13,16,shade);H(10,13,17,shade);
  const trim=comm>=65?'#e5b93b':'#efe6d2';                         // 商才高→金邊衣領
  P(10,17,trim);P(11,18,trim);P(12,18,trim);P(13,17,trim);P(9,18,trim);P(14,18,trim);P(10,19,trim);P(13,19,trim);
  if(o.court){H(2,5,21,PT_COURT[o.court]);H(18,21,21,PT_COURT[o.court])}         // 官員肩部院別色
  if(o.oiran)H(2,21,22,'#e5b93b');                                  // 名伶華麗腰帶
  if(o.role==='guard'||o.role==='保鏢'){P(19,17,'#9a9aa3');P(20,16,'#9a9aa3');P(20,17,'#5a4a3a')}   // 刀柄
  // ---- 臉 ----
  H(8,15,5,skin);H(7,16,6,skin);for(let y=7;y<=13;y++)H(6,17,y,skin);H(7,16,14,skin);H(8,15,15,skin);H(9,14,16,skin);
  // 皺紋、腮紅
  if(age>=50){P(7,12,shade);P(16,12,shade);P(8,13,shade);P(15,13,shade)}
  if(age>=62)H(9,14,6,shade);
  if(woman&&age<42&&!o.oiran){P(7,12,'#f0a6a0');P(16,12,'#f0a6a0')}
  // ---- 頭髮／帽 ----
  const hp=(x,y)=>P(x,y,hairCol());
  const hr=(x1,x2,y)=>{for(let x=x1;x<=x2;x++)hp(x,y)};
  if(woman){                                                        // 島田髷
    hr(8,15,3);hr(6,17,4);hr(5,18,5);hr(7,16,6);
    for(let y=6;y<=9;y++){hp(5,y);hp(6,y);hp(17,y);hp(18,y)}
    for(let y=10;y<=12;y++){hp(5,y);hp(18,y)}
    hr(9,14,2);hr(10,13,1);
    const pin=['#d94a4a','#e5b93b','#4a8ad9','#e5e5e5'][Math.floor(rg()*4)];
    if(age<55){P(16,3,pin);P(17,3,pin)}
    if(o.oiran){P(5,3,'#e5b93b');P(18,3,'#e5b93b');P(7,1,'#e5b93b');P(16,1,'#e5b93b');P(8,0,'#d94a4a');P(15,0,'#d94a4a')}
  }else if(o.rank>=4){                                              // 高官：烏帽子
    const hat='#1d1a22';
    H(10,13,0,hat);H(9,14,1,hat);H(8,15,2,hat);H(7,16,3,hat);H(7,16,4,hat);
    H(7,16,3,PT_COURT[o.court]||'#c9962b');
    P(6,6,hairBase);P(17,6,hairBase);P(6,7,hairBase);P(17,7,hairBase);
  }else if(o.rank>=2){                                              // 中階官員：小頭巾
    const hat='#2a2630';
    H(8,15,3,hat);H(7,16,4,hat);H(7,16,5,hat);
    H(7,16,4,PT_COURT[o.court]||'#c9962b');
    P(6,6,hairBase);P(17,6,hairBase);P(6,7,hairBase);P(17,7,hairBase);
  }else if(o.role==='guard'||o.role==='保鏢'||o.role==='smuggler'||o.role==='飛腳'){   // 武人：束髮、頭巾
    hr(7,16,3);hr(6,17,4);hr(6,17,5);hr(6,7,6);hr(16,17,6);hp(6,7);hp(17,7);hp(6,8);hp(17,8);hr(10,13,2);
    H(6,17,6,o.role==='smuggler'?'#4a6a4a':'#efe6d2');P(18,7,'#efe6d2');P(18,8,'#efe6d2');
  }else{                                                            // 一般町人：丁髷
    hr(7,16,4);hp(7,5);hp(8,5);hp(15,5);hp(16,5);
    for(let y=6;y<=9;y++){hp(6,y);hp(17,y)}
    hr(10,12,3);hr(11,13,2);
  }
  // ---- 眉 ----
  const bro=(x1,x2,y,tilt,thick)=>{
    // tilt:-1 外高內低(兇)、0 平、+1 內高外低(怯)；左右眉對稱呼叫
    for(let i=0;i<3;i++){const xx=x1+i;let yy=y;if(tilt!==0){const inner=(x1<12)?2-i:i;if(tilt<0&&inner===0)yy=y-1;if(tilt>0&&inner===2)yy=y-1}P(xx,yy,'#2a211c');if(thick)P(xx,yy-1,'#2a211c')}
  };
  const tilt=courage>=70?-1:courage<=30?1:0,thick=courage>=60&&!woman||courage>=75;
  bro(7,9,8,tilt,thick);
  bro(14,16,betray>=65?7:8,tilt,thick);                              // 反骨：右眉高挑
  // ---- 眼 ----
  const narrow=greed>=70,wideEye=greed<=35;
  const sidelong=loyal<35||betray>=65,steady=loyal>=60&&betray<50;
  const eye=(x)=>{
    if(narrow){H(x,x+2,10,'#fff');P(sidelong?x+2:x+1,10,'#1a1a1a')}
    else{H(x,x+2,9,'#fff');H(x,x+2,10,'#fff');const px=sidelong?x+2:x+1;P(px,9,'#1a1a1a');P(px,10,'#1a1a1a');if(wideEye)P(px===x+1?x:x+1,9,'#fff')}
  };
  eye(7);eye(14);
  if(narrow){P(6,9,'#e5b93b');P(17,9,'#e5b93b')}                     // 貪：精光
  // ---- 鼻、口 ----
  P(12,11,shade);P(12,12,shade);
  const lip=o.oiran?'#c4284a':'#9a5a4a';
  if(charm>=60){P(10,13,lip);P(11,14,lip);P(12,14,lip);P(13,13,lip)}
  else if(charm<35){P(10,14,lip);P(11,13,lip);P(12,13,lip);P(13,14,lip)}
  else H(10,13,13,lip);
  if(betray>=65)P(14,12,lip);                                       // 冷笑
  return cv.toDataURL();
}

/** 依人物 cid 取頭像 <img>（年齡每十歲換一次樣貌，高官、員工、名伶有對應裝束）。 */
function portraitHtml(cid,px){
  const c=CH(cid);if(!c)return '';
  const n=npc(cid),age=Math.max(10,ageOf(cid)),emp=G.emps.find(e=>e.cid===cid);
  const role=emp?emp.rank:(n?n.role:'guest');
  const o={seed:cid,gender:c.gender,age,role,rank:n&&n.pos?n.pos.rank:0,court:n&&n.pos?n.pos.court:null,oiran:role==='oiran',st:c.derived_stats};
  if(emp&&RANK_LOOK[emp.rank])o.cloth=RANK_LOOK[emp.rank].cloth;
  const key=[cid,Math.floor(age/8),role,o.rank].join('|');
  const url=PT_CACHE[key]||(PT_CACHE[key]=ptDraw(o));
  return '<img class="pt" src="'+url+'" width="'+(px||56)+'" height="'+(px||56)+'" alt="">';
}
/** 無名冊的少年員工頭像（依員工 id 固定）。 */
function portraitEmp(e,px){
  if(e.cid)return portraitHtml(e.cid,px);
  const key='emp|'+e.id+'|'+e.rank;
  const o={seed:e.id,gender:'男',age:14,role:e.rank,rank:0,st:e.stats,cloth:RANK_LOOK[e.rank]&&RANK_LOOK[e.rank].cloth};
  return '<img class="pt" src="'+(PT_CACHE[key]||(PT_CACHE[key]=ptDraw(o)))+'" width="'+(px||56)+'" height="'+(px||56)+'" alt="">';
}
