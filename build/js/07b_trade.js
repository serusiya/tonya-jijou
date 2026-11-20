/* ═════ [07g_smuggle] ═════ */
/* =====================================================================
 * 07g_smuggle.js — 走私與搜查、刑罰
 *  走私：用私房錢向海外買違禁品，船隊＋船長出海，到貨進「密庫」，再請私梟脫手（07x_dealers.js），收入進私房錢。
 *  搜查：每旬有機率被奉行所搜查；打點同心（袖之下）、司法官員交情、風聲、持有違禁品價值都會影響結果。
 *  刑罰：由輕到重＝罰銀＋沒收 → 遠島（期間不能行動）→ 抄家 → 處刑（本代終結）。
 *  狀態：G.smug 在途航程、G.contra 密庫存量、G.smugP 今旬行情係數、G.exile 遠島旬數、G.raidNote 旬報用的搜查結果。
 * ===================================================================== */

/** 違禁品：cost 海外進貨單價、sell 江戶基準售價、danger 危險度（影響被查獲與刑責）。 */
/** 違禁品（內部代號沿用舊名：wine 珍陀酒、glass 珈琲豆、cloth 琉球黑糖、herb 火繩槍、opium 鴉片；第三百零七節）。 */
const SMUG_ITEMS=[
  {k:'wine', name:UT('smug.SMUG_ITEMS'), icon:'🍷',cost:40, sell:130,danger:1},
  {k:'glass',name:UT('smug.SMUG_ITEMS.2'),         icon:'☕',cost:55, sell:165,danger:1},
  {k:'cloth',name:UT('smug.SMUG_ITEMS.3'), icon:'🟫',cost:60, sell:180,danger:1},
  {k:'herb', name:UT('smug.SMUG_ITEMS.4'),   icon:'🎯',cost:75, sell:240,danger:2},
  {k:'opium',name:UT('smug.SMUG_ITEMS.5'),             icon:'🟤',cost:90, sell:340,danger:3}
];
const SMUG_BY={};SMUG_ITEMS.forEach(i=>SMUG_BY[i.k]=i);
/** 出海目的地：d 單程旬數（來回合計）、mult 進貨價倍率、items 可買品項。 */
const SMUG_DEST={
  nagasaki:{name:UT('smug.SMUG_DEST'),d:5, mult:1.0,items:['wine','glass','herb']},
  ryukyu:  {name:UT('smug.SMUG_DEST.2'),     d:7, mult:0.9,items:['cloth','herb','glass']},
  siam:    {name:UT('smug.SMUG_DEST.3'),d:12,mult:0.8,items:['opium','cloth','wine']}
};
/** 單趟載量、密庫容量。 */
const SMUG_CAP=60,CONTRA_CAP=300;
/* ---------- 闇商人：只能碰上，不能求見（第一百五十六節） ----------
 *  還沒結識的闇商人不列在大店屋敷、不能引薦或登門、大番頭也不會替你結識。
 *  結識途徑：第一次走私貨運回密庫（必定）、指名花魁 10%、包場花金夜宴 15%（ODDS.smugMeet）；唐物藥種開局認識一名。 */
const hiddenSmuggler=cid=>{const n=npc(cid),r=G.rel[cid];return !!(n&&n.role==='smuggler'&&!(r&&r.bond))};
/** 結識一位還不認識的本城闇商人；回傳 cid（沒有人可結識時回傳 null）。how：start、smug、nominate、feast。 */
function meetSmuggler(how){
  const L=cityNpcs(G.cityId,'smuggler').filter(n=>hiddenSmuggler(n.cid)&&!isEnemy(n.cid));if(!L.length)return null;
  const cid=pick(L).cid,r=R(cid);
  r.bond={mult:0.8,label:UT('smug.meet.label.'+how),introId:null};r.met=true;r.seen=true;addKnown(cid);
  setAff(r,clamp(r.aff+ODDS.smugMeet.aff,0,100));logRel(cid,UT('smug.meet.log.'+how));
  return cid;
}

const smugList=()=>G.smug||(G.smug=[]);
const contra=()=>G.contra||(G.contra={});
const contraQty=()=>Object.values(contra()).reduce((a,b)=>a+b,0);
/** 密庫現值（以基準價估算）。 */
const contraValue=()=>Object.keys(contra()).reduce((a,k)=>a+contra()[k]*SMUG_BY[k].sell,0);

/** 今旬某違禁品的售價：行情係數×基準價，一次賣越多壓價越多。 */
function smugPrice(k,qty){const f=(G.smugP&&G.smugP[k])||1;return SMUG_BY[k].sell*f*(1-Math.min(0.35,0.004*qty))}

/* ---------------- 每旬結算 ---------------- */
/** 航程推進：抵達時判定海難與被查獲，成功則入密庫；並更新行情。 */
function smugTick(log){
  G.smugP=G.smugP||{};SMUG_ITEMS.forEach(i=>{G.smugP[i.k]=clamp((G.smugP[i.k]||1)+(rnd()-0.5)*0.3,0.8,1.35)});
  const done=[];
  smugList().forEach(v=>{
    v.eta--;if(v.eta>0)return;done.push(v);
    const it=SMUG_BY[v.k],cap=G.emps.find(e=>e.id===v.capt);
    const robbed=banditRobs('sea');                  // 本地區海賊猖獗：回港一律被劫（07zv_bandit.js）
    if(robbed||chance(v.risk)){
      const lost=Math.round(v.qty*0.7);v.qty-=lost;
      const t=robbed?NEWS('bandit.smugRobbed',{name2:it.name,lost}):NEWS('smugTick.1',{name:SMUG_DEST[v.dest].name,name2:it.name,lost});pushNews(t);log.push(t);sfx.bad();
      if(!v.tally)seaFearStart(log);                 // 一般走私出事：船長三旬不敢出海（07zze_favor8.js）；唐船割符不算
    }
    if(v.tally){                                     // 唐船割符：只擲海難，不擲入港被扣（07zz_regfavor4.js）
      G.tally=null;
      const room=Math.max(0,CONTRA_CAP-contraQty()),q=Math.min(room,v.qty);
      if(q>0)contra()[v.k]=(contra()[v.k]||0)+q;
      const t=NEWS('r4.tally.back',{name:it.name,q,c:v.captName});pushNews(t);log.push(t);sfx.coin();
      return;
    }
    const SZ_=ODDS.smugSeize,pSeize=clamp(SZ_.perDanger*it.danger+SZ_.perHeat*(G.heat||0)-((G.flags.blind>0)?SZ_.blind:0),SZ_.min,SZ_.max);
    if(v.qty>0&&chance(pSeize)){
      const t=NEWS('smugTick.2',{name:it.name,qty:v.qty});pushNews(t);log.push(t);sfx.bad();seaFearStart(log);
      const loyal=cap?statsOfEmp(cap).integrity_loyalty:50;
      if(chance(confessP(loyal))){
        const t2=NEWS('smugTick.3',{captName:v.captName});pushNews(t2);log.push(t2);
        G.emps=G.emps.filter(e=>e.id!==v.capt);doRaid('testimony',log);
      }else{
        G.emps=G.emps.filter(e=>e.id!==v.capt);
        const t2=NEWS('smugTick.4',{captName:v.captName});pushNews(t2);log.push(t2);
      }
      return;
    }
    if(v.qty>0){
      const room=Math.max(0,CONTRA_CAP-contraQty()),q=Math.min(room,v.qty);
      contra()[v.k]=(contra()[v.k]||0)+q;
      const t=NEWS('smugTick.5',{name:it.name,q,q2:(q<v.qty?UT('smug.t',{a:v.qty-q}):'')});pushNews(t);log.push(t);sfx.coin();
      if(q>0&&!G.smugMet){const m=meetSmuggler('smug');if(m){G.smugMet=true;const t2=NEWS('smug.meet',{n:nameOf(m)});pushNews(t2);log.push(t2)}}   // 第一次走私運回：接貨的人留下暗號
    }
  });
  G.smug=smugList().filter(v=>!done.includes(v));
}

/** 本旬被搜查的機率：風聲、密庫現值、仇人舉報提高；打點同心、免檢旗降低。 */
function raidChance(){
  const held=contraQty()>0||hiddenContraQty()>0;            // 朋友寄放、換貨夾帶的違禁品也算（07zz_friends.js）
  if(!held&&(G.heat||0)<ODDS.raid.minHeat)return 0;
  const Q_=ODDS.raid;let p=Q_.base+Q_.perHeat*Math.min(G.heat||0,Q_.heatCap)+Math.min(Q_.contraCap,(contraValue()+hiddenContraValue())/3000*Q_.perContraValue)+Q_.perEnemy*enemyCount();
  if(G.flags.blind>0)p*=Q_.blindMul;
  if(G.flags.exempt>0)p*=Q_.exemptMul;
  return clamp(p,0,Q_.max);
}
/** 每旬擲搜查；事先得知通告可躲過一次。 */
function raidTick(log){
  if(G.flags.blind>0)G.flags.blind--;
  const p=raidChance();if(p<=0||!chance(p))return;
  doRaid('random',log);
}
/** 遠島中每旬結算：有大番頭代理則無事，否則商號亂成一團。 */
function exileTick(log){
  if((G.exile||0)<=0)return;
  const boss=G.emps.find(e=>e.rank==='chief');
  if(boss){log.push(NEWS('exileTick.1',{name:boss.name}))}
  else{const loss=Math.round(Math.max(0,G.silver)*0.02);G.silver-=loss;log.push(NEWS('exileTick.2',{loss:fmt(loss)}))}
  if(G.exile===1)log.push(NEWS('exileTick.3'));
}

/* ---------------- 搜查結算與刑罰 ---------------- */
/** 本城司法官員中，與你交情最高者的好感。 */
function bestJudiciaryAff(){return officialsOf(G.cityId).filter(n=>n.pos&&n.pos.court==='judiciary').reduce((a,n)=>Math.max(a,R(n.cid).aff),0)}
/**
 * 搜查：依違禁品價值、風聲、與司法官員交情決定刑罰輕重。
 * kind＝'random' 例行搜查 / 'testimony' 船長供出。結果寫進 G.raidNote（旬報最上方顯示）。
 */
function doRaid(kind,log){
  const V=contraValue(),held=contraQty()>0,jb=bestJudiciaryAff();
  const lines=[];let tier=0;
  // 同心（司法官員）收了袖之下：多半睜一隻眼
  if(G.flags.blind>0&&kind==='random'&&roll('raidBlind')){
    const t=NEWS('doRaid.1');pushNews(t);log.push(t);
    G.raidNote={tier:0,title:UT('smug.doRaid'),lines:[t]};return;
  }
  const S=V/1500+(G.heat||0)/6+(held?0.6:0)-jb/60+rnd()+(kind==='testimony'?0.8:0);
  const had=Object.keys(contra()).filter(k=>contra()[k]>0);
  const maxDanger=had.reduce((a,k)=>Math.max(a,SMUG_BY[k].danger),0);
  const seize=()=>{const n=contraQty();G.contra={};return n};
  let title,t0=S<0.9?1:S<1.9?2:(S<3.2||maxDanger<3)?3:4,lessened=false;
  if((G.lessen||0)>0){G.lessen=0;t0--;lessened=true;lines.push(NEWS('seize.lessen'))}   // 減罪狀：刑罰減輕一等
  if(t0<=0){
    tier=0;title=UT('smug.doRaid.2');
    const n=seize();
    lines.push(UT('smug.doRaid.4',{a:n?UT('smug.doRaid.3',{a:n}):''}));
  }else if(t0===1){
    tier=1;title=UT('smug.doRaid.5');
    const n=seize(),fine=Math.round(Math.max(0,G.silver)*0.05);G.silver-=fine;loseFame('raid1');
    lines.push(UT('smug.doRaid.7',{a:n?UT('smug.doRaid.3',{a:n}):'',b:fmt(fine),c:ODDS.fameLoss.raid1,d:jb>=60?UT('smug.doRaid.6'):''}));
  }else if(t0===2){
    tier=2;title=UT('smug.doRaid.8');
    const n=seize(),fine=Math.round(V*0.8+Math.max(0,G.silver)*0.08);G.silver-=fine;loseFame('raid2');
    lines.push(UT('smug.doRaid.10',{a:n?UT('smug.doRaid.9',{a:n}):'',b:fmt(fine),c:ODDS.fameLoss.raid2}));
  }else if(t0===3){
    tier=3;title=UT('smug.doRaid.11');
    const n=seize(),fine=Math.round(Math.max(0,G.silver)*0.15),yrs=3+Math.floor(rnd()*(S>2.8?10:6));
    G.silver-=fine;loseFame('raid3');G.exile=yrs;G.ap=0;G.life.scapegoat++;
    lines.push(UT('smug.doRaid.12',{a:n?UT('smug.doRaid.9',{a:n}):'',b:fmt(fine),c:ODDS.fameLoss.raid3,d:yrs}));
  }else{
    tier=4;title=UT('smug.doRaid.13');
    lines.push(UT('smug.doRaid.14'));
  }
  const t=NEWS('seize.1',{replace:title.replace(UT('seize.titleFrom'),UT('seize.titleTo')),g:lines.join('').replace(/<[^>]+>/g,'')});
  pushNews(t);log.push(t);sfx.bad();
  G.heat=Math.max(0,(G.heat||0)-4);
  G.raidNote={tier,title,lines};
  if(tier===4)endLife('executed');
}
/** 旬報最上方的搜查結果卡。 */
function raidCard(){
  const N=G.raidNote;if(!N)return '';
  const cls=N.tier>=3?'warn':'';
  return UT('smug.raidCard',{a:cls})+'"><b>'+esc(N.title)+'</b>'+N.lines.map(l=>'<div class="small" style="margin-top:4px">'+l+'</div>').join('')+'</div>';
}

/* ---------------- 走私面板（從商路頁進入） ---------------- */
/** 商路頁上的入口按鈕。 */
function smuggleButton(){
  if(!smugCaptain()&&!smugList().length&&!contraQty()&&!G.tally)return '';        // 要有好感滿格的船長，走私入口才會出現
  const n=smugList().length,q=contraQty();
  return UT('smug.smuggleButton.2',{a:n,b:q,c:(G.exile||0)>0?UT('smug.smuggleButton'):''})+'</div></div><button class="pixel-btn btn-sm btn-gold" data-act="smugOpen">'+UT('btn.smugOpen')+'</button></div></div>';
}
ACT.smugOpen=()=>UI.openSheet('smuggle');
/** 面板狀態：目前選的品項、目的地、數量。 */
const smugSel=()=>{const s=UI.s.smug||(UI.s.smug={dest:'nagasaki',k:'wine',qty:20});const d=SMUG_DEST[s.dest];if(!d.items.includes(s.k))s.k=d.items[0];s.qty=clamp(Math.floor(s.qty)||1,1,SMUG_CAP);return s};

SHEETS.smuggle=()=>{
  const S=smugSel(),d=SMUG_DEST[S.dest],it=SMUG_BY[S.k];
  const p=raidChance(),lv=p<=0?UT('smug.lv'):p<0.05?UT('smug.lv.2'):p<0.12?UT('smug.lv.3'):UT('smug.lv.4');
  const free=idleCaptains('sea').length,cap=smugCaptain();
  let h=banditNotice('sea')+UT('smug.h',{a:Math.round(G.gold),b:Math.max(0,free),c:p>=0.12?'#b3261e':p>=0.05?'#c18a00':'#1e7e34'})+'">'+lv+'</b></div></div>';
  h+=UT('smug.smuggle');
  // 下單
  h+=UT('smug.smuggle.2');
  h+=UT('smug.smuggle.4',{a:Object.keys(SMUG_DEST).map(k=>'<option value="'+k+'" '+(k===S.dest?'selected':'')+'>'+UT('smug.smuggle.3',{a:SMUG_DEST[k].name,b:SMUG_DEST[k].d})).join('')})+'</select></div>';
  h+=UT('smug.smuggle.5',{a:d.items.map(k=>'<option value="'+k+'" '+(k===S.k?'selected':'')+'>'+SMUG_BY[k].icon+' '+SMUG_BY[k].name+'</option>').join('')})+'</select></div>';
  h+=UT('smug.smuggle.6',{a:SMUG_CAP,q:S.qty})+stepRow('<input id="smug-q" type="range" min="1" max="'+SMUG_CAP+'" value="'+S.qty+'" step="1" data-chg="smugQty" data-lbl="smug-q-v">','smug-q',S.qty<=1,S.qty>=SMUG_CAP);
  const cost=Math.round(it.cost*d.mult*S.qty);
  h+=UT('smug.smuggle.7',{a:cost,b:Math.round(smugPrice(S.k,S.qty)*S.qty),c:apLeft()<=0?'disabled':''})+'>'+UT('btn.smugGo')+'</button></div>';
  if(!cap)h+=UT('smug.smuggle.8');
  h+='</div>';
  h+=tallyCard();                                   // 唐船割符（07zz_regfavor4.js）
  // 在途
  if(smugList().length)h+=UT('smug.smuggle.10',{a:smugList().map(v=>'<div class="card"><div class="row"><b class="small">'+UT('smug.smuggle.9',{a:SMUG_BY[v.k].icon,b:SMUG_BY[v.k].name,c:v.qty,d:v.eta,e:SMUG_DEST[v.dest].name,f:esc(v.captName)})+'</div></div>').join('')});
  // 密庫
  const ks=Object.keys(contra()).filter(k=>contra()[k]>0);
  h+=UT('smug.smuggle.11',{a:contraQty(),b:CONTRA_CAP});
  if(!ks.length)h+=UT('smug.smuggle.12');
  else{
    h+=ks.map(k=>{const q=contra()[k],i=SMUG_BY[k];return '<div class="card"><div class="row"><b class="small">'+UT('smug.smuggle.13',{a:i.icon,b:i.name,c:q,d:smugMood(k),e:fmt1(smugPrice(k,1))})}).join('');
    h+=UT('smug.smuggle.14');
  }
  return {title:UT('smug.smuggle.15'),html:h};
};
CHG.smugDest=el=>{const s=smugSel();s.dest=el.value;refreshSheet()};
CHG.smugItem=el=>{smugSel().k=el.value;refreshSheet()};
CHG.smugQty=el=>{smugSel().qty=+el.value;refreshSheet()};

/** 出海：檢查船、船長、私房錢，扣款派船。 */
ACT.smugGo=()=>{
  if((G.exile||0)>0){toast(MSG('smugGo.1'));return}
  const S=smugSel(),d=SMUG_DEST[S.dest],it=SMUG_BY[S.k];
  if(banditBlocks('sea')){toast(UT('bandit.notice.sea',{n:banditLeft()}),4200);return}
  const cap=smugCaptain();if(!cap){toast(MSG('smugGo.3'));return}
  if(contraQty()+S.qty>CONTRA_CAP){toast(MSG('smugGo.4'));return}
  const cost=Math.round(it.cost*d.mult*S.qty);
  if(G.gold<cost){toast(MSG('smugGo.5',{cost}));return}
  if((G.injured||0)>0){toast(MSG(hurtKey('smugGo.hurt'),{injured:G.injured}));return}
  if(!spendAP()){toast(MSG('smugGo.ap'));return}     // 走私出海也要親自到碼頭交代：扣 1 行動點數
  G.gold-=cost;
  smugList().push({id:G.turn+'_'+Math.floor(rnd()*1e5),k:S.k,qty:S.qty,dest:S.dest,eta:d.d,capt:cap.id,captName:cap.name,risk:clamp(ODDS.smugRisk.p*d.d*crewRiskMult(cap),ODDS.smugRisk.min,ODDS.smugRisk.max)});
  sfx.step();toast(MSG('smugGo.6',{name:cap.name,d:d.d}));
  UI.render();refreshSheet();
};
/** 被捕者供出主使的機率（忠誠越高越不會招）。 */
const confessP=loyal=>clamp(ODDS.confess.base-loyal/ODDS.confess.loyalDiv,ODDS.confess.min,ODDS.confess.max);

/* ═════ [07h_duties] ═════ */
'use strict';
/* ★檔案總覽：店員職能與店內閒談
 * - 丁稚：代跑腿（拜訪/送禮/兌現承諾不扣行動點數，好感打折）。
 * - 手代：出貨價小幅加成（上限 +4%）、穩定供貨線略降。 番頭：只加大大盤進貨上限。
 * - 大番頭：每旬自動問候 1～3 人（好感 +），並壓低其他店員私吞；皆於旬報回報。 保鏢（合併用心棒）：平時巡守倉庫，出門時護身。
 * - 點畫面中的人：閒聊／店員流言／外人流言（免費探聽性向），同一人一旬最多兩種內容。 */
/* ======================= 04b 店員職能 ======================= */
/** 各職位的職能一句話。 */
const DUTY_DESC={};RANKS.concat(SPECIAL).forEach(k=>DUTY_DESC[k]=UT('duty.'+k));   // 說明文字在 01e_ui_text.js（duty.*）
const nEmp=rk=>G.emps.filter(e=>e.rank===rk&&!jailedEmp(e)).length;   // 關押中的店員不算（07zt_staffevents.js）
const empsOf=rk=>G.emps.filter(e=>e.rank===rk&&!jailedEmp(e));
const avgSt=(rk,k)=>{const l=empsOf(rk);return l.length?l.reduce((a,e)=>a+statsOfEmp(e)[k],0)/l.length:50};
/** 經營好手臨時打工（請託）：開口那一旬的結算裡，以他的商才算三名番頭的加成（進貨上限、進貨價；不算手代，第三百六十五節）；回傳商才，不在打工中回傳 null。 */
const tempHelp=()=>G.tempHelp&&G.tempHelp.turn===G.turn?G.tempHelp.cs:null;
/** 手代：出貨加成（最多 +4%）。 */
function tellerBonus(){return Math.min(0.04,empsOf('clerk').reduce((a,e)=>a+0.005+0.01*statsOfEmp(e).commerce_skill/100,0))}
/** 番頭（含大番頭）：大盤進貨價折扣（最多 4%，算法同手代的出貨加成）；臨時打工算三名番頭（第三百六十五節）。 */
function bantoBonus(noHelp){const t=noHelp?null:tempHelp();return Math.min(0.04,empsOf('banto').concat(empsOf('chief')).reduce((a,e)=>a+0.005+0.01*statsOfEmp(e).commerce_skill/100,0)+(t===null?0:3*(0.005+0.01*t/100)))}
/** 大盤進貨上限倍數（乘在「需求×市佔率＋參加協議者的協議配額」上）：基本 0.8，每名番頭依商才加成；大番頭也算一名番頭。 */
const buyLimitMult=()=>{const t=tempHelp();return ODDS.buyLimit.mult+empsOf('banto').concat(empsOf('chief')).reduce((a,e)=>a+ODDS.buyLimit.perBantou*(0.6+0.8*statsOfEmp(e).commerce_skill/100),0)+(t===null?0:3*ODDS.buyLimit.perBantou*(0.6+0.8*t/100))};   // 臨時打工算三名番頭
/** 手代：穩定供貨線折減。 */
const supplyCut=()=>1-Math.min(0.2,0.05*nEmp('clerk'));   // 臨時打工不算手代，不動穩定供貨線（第三百六十五節）
/** 手代第 5 名起照料庫存：每多一名，持有成本（損耗與倉儲保險）減 5%，最多減 30%。回傳乘數。
 *  （原本差配人臨時打工算店裡手代＋2，第二百十三節；第三百六十五節起打工只算番頭，不影響照料庫存。） */
const KEEP_FROM=4,KEEP_PER=0.05,KEEP_MAX=0.3;
const keeperN=()=>nEmp('clerk');   // 臨時打工不算手代（第三百六十五節）
const keeperMul=()=>1-Math.min(KEEP_MAX,KEEP_PER*Math.max(0,keeperN()-KEEP_FROM));
/** 相場面板：本旬有人打工時的說明（收入加成已滿就不寫收入；照料人數不到第 5 名就不寫損耗）。 */
function tempHelpNote(){
  const t=tempHelp();if(t===null||!G.tempHelp)return '';
  const cheap=bantoBonus()-bantoBonus(true)>0.0001;
  return UT('mk.help',{n:esc(G.tempHelp.name||nameOf(G.tempHelp.cid)),a:UT(cheap?'mk.help.cheap':'mk.help.buy'),b:''});
}
/** 大番頭：壓低其他店員私吞的係數。 */
function guardF(e){
  if(e.rank==='chief')return 1;
  const b=empsOf('chief')[0];if(!b)return 1;
  return 1-Math.min(0.5,0.2+0.3*statsOfEmp(b).commerce_skill/100);
}
/* ---------- 保鏢＝用心棒：平時巡守（降火災／盜賊／山賊風險），出門時護身 ---------- */
const guardCount=()=>nEmp('guard');
/* ---------- 丁稚代跑 ---------- */
var ERR_ACTIVE=false,ERR_REQ=false;
const errandLeft=()=>Math.max(0,nEmp('apprentice')-(G.errandUsed||0));
function errandFactor(){return clamp(0.6+0.2*avgSt('apprentice','diplomacy_charm')/100,0.6,0.8)}
/** 拜訪類動作的行動消耗：開啟「丁稚代跑」且還有名額時，不扣行動點數。 */
function spendVisitAP(){
  const want=ERR_REQ;ERR_REQ=false;
  if(want&&errandLeft()>0){G.errandUsed=(G.errandUsed||0)+1;ERR_ACTIVE=true;return true}
  ERR_ACTIVE=false;return spendAP();
}
/** 代跑的結果：好感增量打折，並在訊息中註明。 */
function errandTrim(cid,a0,r){
  if(!ERR_ACTIVE)return;ERR_ACTIVE=false;
  const q=R(cid),d=q.aff-a0;
  if(d>1)setAff(q,a0+Math.floor(d*errandFactor()));
  if(r&&r.msg)r.msg+=MSG('errandTrim.1',{q:sgn(Math.round(q.aff-a0))});
}
/** 派丁稚按鈕「丁稚代送（禮金）」：不寫剩餘次數；無丁稚或本旬次數用完就半透明不可按。 */
function errandBtn(cid){
  if(R(cid).aff>=FRIEND_AFF)return UT('duty2.errandBtn');
  const left=errandLeft(),off=left<=0;
  return '<button class="pixel-btn btn-sm" style="flex:1" '+(off?'disabled ':'')+'data-act="visit" data-err="1" data-cid="'+UT('duty2.errandBtn.3',{a:cid,b:nEmp('apprentice')?UT('duty2.errandBtn.2',{a:coinHtml('silver',btTiers(cid)[1])}):''})+'</button>';
}
/* ---------- 大番頭：新旬處理自動問候等事務（代出席例會已取消，例會要親自去） ---------- */
/** 新旬由大番頭處理的其他事務：依機率自動問候（可能結識新朋友）、意外之財、或無事。 */
function chiefTick(log){
  if(!nEmp('chief'))return;
  chiefUneasy(log);
  const C=ODDS.chief,x=rnd();
  if(x<C.visitP)chiefVisit(log);
  else if(x<C.visitP+C.windfallP)chiefWindfall(log);
}
/** 人心不穩：大番頭累計賺得的意外之財超過當前現款（現金吃緊），下一旬必定捲款潛逃。 */
function chiefUneasy(log){
  const b=empsOf('chief')[0];
  if(!b||b.fleeAt!==undefined||!((b.wind||0)>Math.max(0,G.silver)))return;
  b.fleeAt=G.turn+1;
  const t=NEWS('chief.uneasy',{name:b.name});pushNews(t);log.push(t);
}
/** 意外之財：當前現款的 1～10%。 */
function chiefWindfall(log){
  const C=ODDS.chief,amt=Math.round(Math.max(0,G.silver)*(C.windfallMin+rnd()*(C.windfallMax-C.windfallMin)));
  if(amt<=0)return;
  const b=empsOf('chief')[0];if(!b)return;
  queueHomeEvent({type:'windfall',empId:b.id,amt});   // 回府時才回報、入帳（07zx_homeevt.js）；沒輪到就沒有這筆錢
}
/** 自動問候：挑 1～3 位已結識、好感未滿 60 的人登門閒話，好感 +5～10（不送禮、不花錢，交情較淺者優先）；另有機率結識城中新朋友。 */
function chiefVisit(log){
  const C=ODDS.chief,pool=Object.entries(G.rel).filter(([cid,r])=>r.bond&&r.aff>=1&&r.aff<FRIEND_AFF&&npc(cid)&&!isEnemy(cid)&&!foreignReg(npc(cid)));   // 外地遠國奉行所官員只能寄信   // 只補到 60
  const got=[];
  const n=pool.length?Math.min(pool.length,C.visitMin+Math.floor(rnd()*(C.visitMax-C.visitMin+1))):0;
  for(let i=0;i<n;i++){
    const w=pool.map(([cid,r])=>FRIEND_AFF-r.aff);let tot=w.reduce((a,b)=>a+b,0),x=rnd()*tot,k=0;
    for(;k<w.length-1;k++){x-=w[k];if(x<=0)break}
    const [cid,r]=pool.splice(k,1)[0];
    const gain=C.gainMin+Math.floor(rnd()*(C.gainMax-C.gainMin+1));
    const g0=Math.min(gain,FRIEND_AFF-r.aff);setAff(r,clamp(r.aff+g0,0,100));logRel(cid,UT('duty2.chiefVisit',{a:g0}));
    got.push(nameOf(cid)+' +'+g0);
  }
  if(got.length){const t=NEWS('chief.visit',{list:got.join(UT('duty2.t'))});pushNews(t);log.push(t)}
  if(chance(C.newFriendP)){
    const cand=cityNpcs(G.cityId).filter(m=>{const r=G.rel[m.cid];return !(r&&r.bond)&&!isEnemy(m.cid)&&m.role!=='smuggler'});   // 闇商人不會被大番頭結識
    if(cand.length){
      const m=pick(cand),cid=m.cid,r=R(cid),gain=C.gainMin+Math.floor(rnd()*(C.gainMax-C.gainMin+1));
      setAff(r,clamp(r.aff+gain,0,100));r.met=true;r.seen=true;addKnown(cid);
      r.bond={mult:0.6,label:UT('duty2.chiefVisit.2'),introId:null};
      logRel(cid,UT('duty2.chiefVisit.3',{a:gain}));
      const t=NEWS('chief.friend',{who:nameOf(cid),gain});pushNews(t);log.push(t);
    }
  }
}
/* ======================= 點人閒談 ======================= */
const CHAT_LINES=LINES.chat;                                   // 台詞在 01d_lines.js
const chatSeason=()=>season()||'spring';
function chatSelf(ent){return ent.kind==='emp'?G.emps.find(e=>'emp_'+e.id===ent.id):null}
function chitchat(ent){
  const e=chatSelf(ent),pool=[];
  if(ent.kind==='emp'){
    pool.push(...CHAT_LINES.emp);const s=statsOfEmp(e);
    if(s.integrity_loyalty>=65)pool.push(...CHAT_LINES.loyal);
    if(s.greed_index>=65)pool.push(...CHAT_LINES.greed);
    if(s.audacity_courage>=65)pool.push(...CHAT_LINES.brave);
    if(e.rank==='guard')pool.push(...CHAT_LINES.guard);
  }else pool.push(...(CHAT_LINES[ent.kind]||CHAT_LINES.emp));
  pool.push(...CHAT_LINES[chatSeason()]);
  return {kind:UT('duty2.chitchat'),text:pick(pool)};
}
function staffGossip(ent){
  const me=chatSelf(ent);const others=G.emps.filter(x=>x!==me);
  if(!others.length)return null;
  const x=pick(others),s=statsOfEmp(x),n=UT('duty2.n',{a:x.name,b:rankName(x.rank)});
  let t;
  let rumor=false;
  if(rumorOf(x)){t=TX('gossip.staff.skim',{n});x.rumorUntil=G.turn+STAFF.rumorTurns;rumor=true}   // 私吞流言（可能是冤枉）：標記風聲，才能查帳
  else if(s.betrayal_risk>=60&&s.integrity_loyalty<=45)t=TX('gossip.staff.betray',{n});
  else if(s.greed_index>=70)t=TX('gossip.staff.greedy',{n});
  else if(s.integrity_loyalty>=70)t=TX('gossip.staff.loyal',{n});
  else if(s.commerce_skill>=70)t=TX('gossip.staff.skill',{n});
  else t=TX('gossip.staff.plain',{n});
  return {kind:UT('duty2.staffGossip'),text:UT('duty2.staffGossip.2',{a:t}),rumorEmp:rumor?x.id:null};
}
function outsiderGossip(){
  const cached=G.chat&&G.chat.gossipCid;
  if(cached){
    const n=npc(cached);if(!n||!alive(cached)||isEnemy(cached))return null;
    return {kind:UT('duty2.outsiderGossip'),text:UT('duty2.staffGossip.2',{a:TX('gossip.outsider',{n:nameOf(cached),t:top3Txt(cached)})}),cid:cached};
  }
  const all=cityNpcs(G.cityId).filter(n=>!R(n.cid).topKnown&&!isEnemy(n.cid));   // 只講本城的人
  if(!all.length)return null;
  const met=all.filter(n=>R(n.cid).met);
  const n=pick(met.length&&rnd()<ODDS.gossipMet.p?met:all),cid=n.cid,r=R(cid);
  G.chat.gossipCid=cid;                                  // 全體店員與家人本旬共用同一位情報對象
  r.topKnown=true;r.seen=true;addKnown(cid);
  logRel(cid,UT('duty2.outsiderGossip.2'));
  return {kind:UT('duty2.outsiderGossip.3'),text:UT('duty2.staffGossip.2',{a:TX('gossip.outsider',{n:nameOf(cid),t:top3Txt(cid)})}),cid};
}
function genChat(ent){
  const r=rnd();
  let c=null;
  if(r>=1-ODDS.chatMix.outsider)c=outsiderGossip();
  else if(r>=1-ODDS.chatMix.outsider-ODDS.chatMix.staff)c=staffGossip(ent);
  return c||chitchat(ent);
}
/** 取得該人物本旬的對話內容：同一人一旬最多兩種，之後輪流重複。 */
function chatFor(ent){
  if(!G.chat||G.chat.turn!==G.turn)G.chat={turn:G.turn,map:{},n:{},gossipCid:null};
  const L=G.chat.map[ent.id]=G.chat.map[ent.id]||[];
  if(L.length<2){
    let c=genChat(ent),k=0;
    while(L.some(x=>x.text===c.text)&&k++<6)c=genChat(ent);
    L.push(c);G.chat.n[ent.id]=L.length;return c;
  }
  G.chat.n[ent.id]=(G.chat.n[ent.id]||0)+1;
  return L[G.chat.n[ent.id]%2];
}
function openChat(ent){
  const c=chatFor(ent),e=chatSelf(ent);
  const who=e?UT('duty2.who',{a:rankName(e.rank),b:e.name}):ent.label;
  let h='<div style="display:flow-root">'+(e?portraitEmp(e,56):'')+'<div class="tiny muted">'+esc(c.kind)+'</div><div style="margin-top:4px">'+esc(c.text)+'</div></div>';
  if(c.cid)h+=UT('duty2.openChat',{a:esc(nameOf(c.cid))});
  if(c.rumorEmp){const x=G.emps.find(y=>y.id===c.rumorEmp);if(x){if(G.chat.turn===G.turn&&!hasRumor(x))x.rumorUntil=G.turn+STAFF.rumorTurns;h+='<div class="notice tiny" style="margin-top:6px">'+esc(MSG('audit.heard',{name:x.name,rank:rankName(x.rank)}))+'</div>'}}
  UI.showInfo(who,h);
}

/* ======================= 開局加成（依七個固定資源等級） ======================= */
/** 資源等級 0～6，越往下越多（累加）：1 介紹人；2 手代、丁稚；3 妻小；4 船長、本地區海運許可、一趟在途採買；5 名望三階（另送交易許可）；6 大番頭、名望四階。 */
function applyStartBoost(idx,sysKey){
  idx=clamp(Math.floor(Number(idx)||0),0,START_TIERS.length-1);
  if(sysKey==='medicine')meetSmuggler('start');   // 唐物藥種固有特性，不隨隨機分配的資源等級移動
  if(idx<=0)return;
  if(idx>=1){                                      // 介紹人：優先找掮客，沒有就從介紹人身分白名單挑選
    const ns=cityNpcs(G.cityId),cand=ns.find(n=>n.role==='broker'&&canBeIntro(n.cid))||ns.find(n=>canBeIntro(n.cid));
    if(cand){
      const cid=cand.cid,r=R(cid);r.met=true;r.seen=true;setAff(r,Math.max(r.aff,45));r.bond={mult:1,label:UT('duty2.applyStartBoost'),introId:null};
      addKnown(cid);G.intros.push({cid});G.introId=cid;logRel(cid,UT('duty2.applyStartBoost.2'));
    }
  }
  if(idx>=2){hireEmp(null,'clerk');hireEmp(null,'apprentice')}
  if(idx>=3){
    const fn=NAMES.spouse;
    G.family.spouse={name:UT('duty2.applyStartBoost.3',{a:pick(fn)}),kind:'commoner',birthYear:G.year-20};
    G.family.married=true;G.life.spouseKind='commoner';
    const k=newKid();k.birthYear=G.year-2;G.family.kids.push(k);
  }
  if(idx>=4){
    grantSea(homeCity().region_id);
    const cap=hireEmp(null,'captain');cap.stats=Object.assign(cap.stats,{audacity_courage:Math.max(cap.stats.audacity_courage,60)});
    {const dl=destList('sea',true)[0];if(dl)sendVoyage(cap.id,800,dl.ct.id,'sea',true)}   // 一趟已在途的委託採買（委託金由開局贈與）
  }
  if(idx>=5)setFame(Math.max(G.fame||0,ODDS.fame.tiers[idx>=6?2:1]));   // 第六等級名望三階，第七等級四階（交易許可見 startTrade）
  if(idx>=6){                                      // 大番頭：從城中適任的經營好手裡聘一位
    const pool=talentPool().filter(n=>suitableEmpRanks(n.cid).includes('chief')&&!introOf(n.cid));
    const m=pool.sort((a,b)=>CH(b.cid).derived_stats.integrity_loyalty-CH(a.cid).derived_stats.integrity_loyalty)[0];
    hireEmp(m?m.cid:null,'chief');
  }
}

/* ═════ [07i_voyage] ═════ */
'use strict';
/** 遇難的圖示與標籤：海難／海賊／山賊。 */
const voyIcon=(mode,robbed)=>mode==='land'?'⛰️':robbed?'🏴‍☠️':'🌊';
const voyMishap=(mode,robbed)=>mode==='land'?'voy.log.wreckLand':robbed?'voy.log.pirate':'voy.log.wreckSea';
/* ★檔案總覽：委託採買（海運／陸運）
 * - 玩家指派：運輸方式（船長／飛腳）、目的地（產地城市）、委託金；船長不會跑錯地方。
 * - 到了目的地，買什麼由船長視本事決定（只能買該地出產的貨）：
 *   80% 買本業能賣的貨（入倉；當地產好幾樣本業貨時，多半偏重其中一兩樣）；20% 買便宜、但非本業的「跨行貨」（也入倉，須請座客商人代售）。
 *   目的地沒有本業貨時：80% 空手而回（只扣雜費），20% 改買跨行貨。
 *   唐物藥種另有「夾帶」：主要採買之外，每趟 20% 機率順帶一項違禁品 3～5 單位（從委託金扣、入密庫；不加風聲，第二百三十六節）。
 * - 數量與價格視船長商才；海難／山賊會損失七成貨。詳情寫進歸航那一旬的旬報「船隻歸航」。 */
const MODE_ICON={sea:'⛵',land:'🐎'};
const MODE_RANK={sea:'captain',land:'courier'};
/** 本旬出運清單（存檔）：[{capt,mode,dest,budget}]；推進一旬時清空。 */
const voyQ=()=>G.voyQueue||(G.voyQueue=[]);
/** 清單裡已排的委託金合計。 */
const voyQTotal=()=>voyQ().reduce((a,q)=>a+q.budget,0);
/** 空閒的船長／飛腳：不在採買、走私途中；inclQ＝連已排進出運清單的也算（出發時用）。 */
const idleCaptains=(mode,inclQ)=>{
  const used=new Set(G.ships.map(s=>s.capt));(G.smug||[]).forEach(v=>used.add(v.capt));
  if(!inclQ)voyQ().forEach(q=>used.add(q.capt));
  return G.emps.filter(e=>e.rank===MODE_RANK[mode]&&!used.has(e.id)&&!jailedEmp(e)&&!empLent(e));
};
/** 清掉已失效的清單項目（人已離職，或已被派去走私）。 */
function voyQPrune(){if(!G.voyQueue)return;G.voyQueue=G.voyQueue.filter(q=>idleCaptains(q.mode,true).some(e=>e.id===q.capt))}
/** 出運清單裡還等著出發的人數（推進前提醒、商路按鈕紅點用）。 */
function voyQPending(){if(!G||!G.voyQueue||!G.voyQueue.length)return 0;voyQPrune();return G.voyQueue.length}
/** 推進一旬時已確認「照樣推進」：這一次不再攔。 */
let VOYQ_SKIP=false;
/** 推進一旬前：出運清單還有人沒出發就先跳提醒，回傳 true 表示已攔下（08_boot.js 的 doTurn）。 */
function voyQGuard(n){
  if(VOYQ_SKIP){VOYQ_SKIP=false;return false}
  const k=voyQPending();if(!k)return false;
  const stuck=(G.injured||0)>0?'hurt':apLeft()<=0?'noAP':'';
  const btn=(act,key,cls,extra)=>'<button class="pixel-btn '+cls+'" style="flex:1 1 '+(act==='vQGo'?'100%':'0')+';padding:8px" data-act="'+act+'"'+(extra||'')+'>'+UT(key)+'</button>';
  let h='<p class="small">'+UT(stuck?'voyQ.warn.'+stuck:'voyQ.warn',{n:k})+'</p><div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap">';
  if(!stuck)h+=btn('vQGo','btn.vQGo','btn-gold');
  h+=btn('vQSkip',stuck?'btn.vQSkip.2':'btn.vQSkip','',' data-n="'+(n||1)+'"')+btn('vQBack','btn.vQBack','')+'</div>';
  UI.showInfo(UT('voyQ.warn.t'),h);sfx.tap();
  return true;
}
const voyQClose=()=>{INFO_AFTER=null;UI.hideInfo()};
ACT.vQGo=()=>{voyQClose();ACT.vGoAll()};
ACT.vQSkip=el=>{voyQClose();VOYQ_SKIP=true;doTurn(+el.dataset.n||1)};
ACT.vQBack=()=>voyQClose();
const ownNameSet=()=>new Set(ownComms().map(c=>c.name));
/** 本業中已可交易的貨（委託採買時船長只買這些）。 */
const tradeNameSet=()=>new Set(tradeComms().map(c=>c.name));
/** 風險：每旬約 3%（海）／2.2%（陸），乘船長膽識與商才的倍數；陸路有保鏢可再降。 */
const voyRisk=(cap,d,mode)=>{const V_=ODDS.voyageRisk;return clamp((mode==='sea'?V_.sea:V_.land)*d*crewRiskMult(cap)-(mode==='land'?V_.guardLand*guardCount():0),V_.min,V_.max)};
const voyFee=d=>clamp(0.04+0.01*d,0.06,0.14);
/** 本月前往各產地的商隊順位；海陸合併，換月即重置。 */
function originTripState(){
  if(!G.originTrips||G.originTrips.y!==G.year||G.originTrips.m!==G.month)G.originTrips={y:G.year,m:G.month,byCity:{}};
  G.originTrips.byCity=G.originTrips.byCity||{};return G.originTrips;
}
const originTripUsed=cityId=>originTripState().byCity[cityId]||0;
function originTripTake(cityId){const S=originTripState(),n=(S.byCity[cityId]||0)+1;S.byCity[cityId]=n;return n}
/** 多項本業貨的採買權重：一成均衡，其他多半偏重或集中在當地較充足、相對較便宜的一項。 */
function makeVoyageMix(its){
  if(its.length<=1){if(its[0])its[0].w=1;return {kind:'single',main:its[0]||null}}
  const M=ODDS.voyageMix,r=rnd();
  if(r<M.balanced){its.forEach(x=>x.w=1/its.length);return {kind:'balanced',main:null}}
  its.forEach(x=>x.mixScore=Math.pow(x.si,M.supplyPow)*Math.pow(1/Math.max(0.01,x.pf),M.pricePow)*(0.7+0.6*rnd()));
  let z=rnd()*its.reduce((a,x)=>a+x.mixScore,0),main=its[its.length-1];
  for(const x of its){z-=x.mixScore;if(z<=0){main=x;break}}
  const biased=r<M.balanced+M.biased,lo=biased?M.biasedMin:M.focusMin,hi=biased?M.biasedMax:M.focusMax,p=lo+(hi-lo)*rnd();
  main.w=p;const rest=its.filter(x=>x!==main);rest.forEach(x=>x.restW=0.25+1.5*rnd());
  const sum=rest.reduce((a,x)=>a+x.restW,0);rest.forEach(x=>x.w=(1-p)*x.restW/sum);
  return {kind:biased?'biased':'focus',main};
}
/** 可前往的目的地：海運＝雙方皆為港灣；陸運＝同地區且 2 旬內。商路頁只列已有許可的城市；full＝連無許可的也列（開局贈送與出發檢查用）。 */
function destList(mode,full){
  const a=homeCity(),own=ownNameSet(),all=ownNameSet();   // 沒有交易許可的本業貨也會買回來囤著（第三百一十二節）
  const ok0=mode==='sea'?(ct=>canSea(a)&&canSea(ct)):(ct=>canLand(a,ct)),ok=ct=>ok0(ct)&&(full||permitOf(mode,ct));
  return CITIES.filter(ct=>ct.id!==a.id&&ok(ct)).map(ct=>({ct,d:distTurns(a,ct,mode),
    own:cityProds(ct).filter(n=>own.has(n)&&COMM_MAP[n]),oth:cityProds(ct).filter(n=>!all.has(n)&&COMM_MAP[n]),blocked:buyoutDepartureBlocked(ct)}))
    .sort((x,y)=>x.blocked-y.blocked||(y.own.length>0)-(x.own.length>0)||x.d-y.d||y.own.length-x.own.length);
}
/** 出發：扣委託金與 1 行動點數；free＝開局贈送（兩者都不扣）；batch＝出運清單一起出發（行動點數由 vGoAll 統一扣一次）。 */
function sendVoyage(captId,budget,destId,mode,free,batch){
  mode=mode||'sea';
  if(!free&&banditBlocks(mode))return {ok:false,msg:UT('bandit.notice.'+mode,{n:banditLeft()})};   // 本地區賊亂（07zv_bandit.js）
  const cap=idleCaptains(mode,true).find(e=>e.id===captId);if(!cap)return {ok:false,msg:MSG('sendVoyage.2',{mode:NM('crew',mode)})};
  const dest=CITY(destId),dl=destList(mode,true).find(x=>x.ct.id===destId);if(!dest||!dl)return {ok:false,msg:MSG('sendVoyage.3')};
  if(!free&&!permitOf(mode,dest))return {ok:false,msg:MSG('sendVoyage.4',{REG_NAME:REG_NAME(dest.region_id),sea:(mode==='sea'?UT('voy.sendVoyage'):UT('voy.sendVoyage.2'))})};
  if(buyoutDepartureBlocked(dest))return {ok:false,msg:MSG('sendVoyage.buyout',{REG_NAME:REG_NAME(dest.region_id),month:buyoutMonth(G.month,dest.region_id)})};
  budget=Math.floor(budget);if(!(budget>=100))return {ok:false,msg:MSG('sendVoyage.5')};
  if(!free&&G.silver<budget)return {ok:false,msg:MSG('sendVoyage.6',{budget:fmt(budget)})};
  if(!free&&(G.injured||0)>0)return {ok:false,msg:MSG(hurtKey('sendVoyage.hurt'),{injured:G.injured})};
  if(!free&&!batch&&apLeft()<=0)return {ok:false,msg:MSG('sendVoyage.ap')};   // 委託採買要親自到碼頭交代：扣 1 行動點數（開局贈送的那趟不扣；出運清單一起出發只扣一次）
  if(!free&&!batch){G.ap--;updateAP()}
  const st=statsOfEmp(cap);let d=dl.d;
  if(mode==='land'){if(G.flags.horse>0)d--;if(G.flags.road)d--;d=Math.max(1,d)}
  if(!free)payPublic('spend.voyage|'+dest.id,budget);
  const bo=buyoutSnapshot(dest);
  const supplyRank=originTripTake(destId);
  G.ships.push({id:G.turn+'_'+Math.floor(rnd()*1e5),entrust:true,origId:destId,mode,eta:d,eta0:d,risk:voyRisk(cap,d,mode)*(mode==='sea'&&G.flags.escort>0?ODDS.voyageRisk.escortMul:1),feeMul:(G.flags.taxfree>0?0.5:1)*(1-Math.min(0.3,0.1*(G.flags.charter||0))),cheap:G.flags.cheap>0,cost:budget,budget,start:G.turn,capt:cap.id,captName:cap.name,cs:st.commerce_skill,ca:st.audacity_courage,buyout:bo.hit,buyoutY:bo.y,buyoutM:bo.m,buyoutRegion:bo.rid,supplyY:G.year,supplyM:G.month,supplyRank,unl:unloadProds(destId)});
  return {ok:true,msg:MSG('sendVoyage.ok',{crew:NM('crew',mode),name:cap.name,budget:fmt(budget),dest:dest.name,d})};
}
/** 歸來結算。 */
function resolveVoyage(s,log){
  const mode=s.mode,cs=s.cs||50,budget=s.budget||0,back=!(s.out&&!budget),robbed=back&&banditRobs(mode),wreck=back&&(robbed||chance(s.risk)),keep=wreck?0.3:1;   // 卸留請負空手回來（委託金 0）時回程不擲   // 本地區賊亂期間回程一律被劫（07zv_bandit.js）
  const dest=CITY(s.origId),own=ownNameSet(),all=ownNameSet(),buyout=!!s.buyout;
  const prod=(dest?[...new Set(cityProdsBase(dest).concat(s.unl||[]))]:[]).filter(n=>COMM_MAP[n]);   // 國中物卸留以出發旬判定（s.unl）
  const ownP=buyout?[]:prod.filter(n=>own.has(n)),othP=prod.filter(n=>!all.has(n));
  const fee=Math.round(budget*voyFee(Math.max(1,s.eta0||4))*(s.feeMul||1));
  let spend=Math.floor((budget-fee)*clamp(0.78+0.18*cs/100+(rnd()-0.5)*0.06,0.7,0.98));
  let carry=null;                                       // 唐物藥種夾帶：先從委託金留出這筆錢，再做主要採買
  if(G.sysKey==='medicine'&&chance(ODDS.voyageKind.carry)){
    const K=ODDS.voyageKind,it=pick(SMUG_ITEMS.filter(i=>K.carryItems.includes(i.k))),unit=it.cost*(1-0.2*cs/100);
    const q=Math.max(0,Math.min(rint(K.carryMin,K.carryMax),CONTRA_CAP-contraQty(),Math.floor(spend/unit)));
    if(q>0){carry={it,q,cost:Math.round(unit*q)};spend-=carry.cost}
  }
  let kind,note='';const VK=ODDS.voyageKind;let xc=false,xMoney=0;
  if(s.out&&!budget)kind='outOnly';                      // 卸留請負：只交貨、不採買
  else{
    xc=othP.length>0&&rnd()<VK.cross;                   // 夾帶他行貨（第三百五十三節）：兩成機率，最多用委託金與運量各兩成；不再整船改買他行貨
    if(xc)xMoney=Math.floor(spend*VK.xShare);
    if(ownP.length)kind='own';
  }
  if(!kind){                                            // 目的地沒有本業貨：夾帶到他行貨就帶回那一點（kind 記 cross），否則空手而回
    kind=xc?'cross':'empty';
    note=buyout?UT('voy.buyoutNote',{region:REG_NAME(s.buyoutRegion),month:buyoutMonth(s.buyoutM,s.buyoutRegion),crew:NM('crew',mode),result:kind==='cross'?UT('voy.resolveVoyage.2'):UT('voy.resolveVoyage.3')}):UT('voy.resolveVoyage.4',{a:dest?dest.name:UT('voy.resolveVoyage'),b:NM('crew',mode),c:kind==='cross'?UT('voy.resolveVoyage.2'):UT('voy.resolveVoyage.3')});
  }
  const E={turn:G.turn,date:dateStr(),capt:s.captName,budget,kind,wreck,robbed,buyout,dest:dest?dest.name:'',mode,lines:[],items:[],fee};   // items：採買日誌表格（貨名、數量、總價、損失）
  let refund=budget-fee,income=0;
  const L=E.lines,pc=x=>Math.round(x*100)+'%',wn=wreck?(robbed&&mode==='sea'?UT('voy.wnPirate'):mode==='sea'?UT('voy.wn'):UT('voy.wn.2')):'';
  L.push(s.out?NEWS('r4.out.head',{dest:E.dest,b:budget?UT('r4.out.headBuy'):''})+note:NEWS('kind.1',{dest:E.dest,note}));
  if(s.out)income+=outboundSettle(s,E,log);             // 卸留請負：去程遇險、交貨領錢（07zz_regfavor4.js）
  if(kind==='own'&&ownP.length){
    /* 同一地產好幾樣本業貨時多半偏重或集中採買，只有少數均衡；某樣碰到產地貨源、庫存上限或倉位而買不滿，
       剩下的錢與運量再依權重分給其他還能買的貨（直到錢、運量或倉位用完）。
       單趟運量以「裝載比例」計：每樣貨用掉 數量÷該貨單趟上限 的船艙（或馬背）。 */
    const its=shuffle(ownP).map(n=>{const c=COMM_MAP[n],si=originSupplyForShip(s,dest,n),pf=clamp(0.80-0.30*cs/100+(rnd()-0.5)*ODDS.originSupply.priceJitter,0.5,0.95)*(s.cheap?0.9:1)*originSupplyPrice(si);
      return {n,c,si,pf,unit:c.base*pf,cp:capOf(n,mode),src:originSupplyCap(n,mode,si,s.supplyRank||1),room:Infinity,q:0}});   // 不設單項上限，只受倉位 wh 限制（第三百五十一節）
    let money=spend-xMoney,load=xc?1-VK.xLoad:1,wh=Math.max(0,invCap()-invUsed()),act=its.filter(x=>x.room>0&&x.src>0);   // 夾帶他行貨時，先留出那份委託金與艙位
    const mix=makeVoyageMix(act);
    if(mix.kind!=='single')L.push(UT('voy.mix.'+mix.kind,{name:mix.main?mix.main.c.short:''}));
    for(let round=0;round<12&&act.length&&wh>0&&load>1e-6;round++){
      const ws=act.reduce((a,x)=>a+x.w,0),money0=money,load0=load;let added=0;
      act.forEach(x=>{const m=money0*x.w/ws,l=load0*x.w/ws,q=Math.max(0,Math.min(Math.floor(m/x.unit),Math.floor(l*x.cp+1e-9),x.src-x.q,x.room-x.q,wh));if(q<=0)return;
        x.q+=q;money-=q*x.unit;load-=q/x.cp;wh-=q;added+=q});
      act=act.filter(x=>x.q<Math.min(x.room,x.src));
      if(!added){const can=act.filter(x=>money>=x.unit&&load+1e-9>=1/x.cp&&wh>0).sort((a,b)=>b.w-a.w)[0];if(!can)break;
        const q=Math.max(0,Math.min(Math.floor(money/can.unit),Math.floor(load*can.cp+1e-9),can.src-can.q,can.room-can.q,wh));if(!q)break;
        can.q+=q;money-=q*can.unit;load-=q/can.cp;wh-=q;act=act.filter(x=>x.q<Math.min(x.room,x.src));}
    }
    let bought=0,lost=0;const first=its[0].c;
    its.filter(x=>x.q>0).forEach(x=>{
      const q=x.q,got=Math.round(q*keep),cost=Math.round(x.unit*q);refund-=cost;bought+=got;lost+=q-got;E.lossVal=(E.lossVal||0)+(q-got)*marketQuote(x.n);
      if(got>0){addStock(x.n,got,cost/got);stockAdd(x.n,got,false)}
      const supply=originSupplyBand(x.si);L.push(NEWS('kind.2',{short:x.c.short,q,unit:fmt1(x.unit),pf:pc(x.pf),cost:fmt(cost),supply}));E.items.push({n:x.c.short,q,unit:x.unit,cost,lost:q-got,supply});
    });
    if(bought+lost>0)L.push(wreck?NEWS('voy.resolveVoyage.5',{i:voyIcon(mode,robbed),a:wn,b:lost,c:bought}):NEWS('voy.resolveVoyage.6',{a:bought}));
    else L.push(NEWS('kind.3',{short:first.short}));
  }
  if(xc&&(kind==='own'||kind==='cross')){              // 夾帶他行貨：委託金與運量各最多兩成
    const c=COMM_MAP[pick(othP)],si=originSupplyForShip(s,dest,c.name),pf=clamp(0.40-0.15*cs/100+(rnd()-0.5)*ODDS.originSupply.priceJitter,0.18,0.5)*(s.cheap?0.9:1)*originSupplyPrice(si),unit=c.base*pf;
    const room=Math.max(0,invCap()-invUsed());
    const q=Math.max(0,Math.min(Math.floor(xMoney/unit),Math.floor(capOf(c.name,mode)*VK.xLoad),originSupplyCap(c.name,mode,si,s.supplyRank||1),room)),got=Math.round(q*keep),cost=Math.round(unit*q);refund-=cost;E.lossVal=(E.lossVal||0)+(q-got)*c.base;
    if(q>0){G.xinv=G.xinv||{};G.xinv[c.name]=(G.xinv[c.name]||0)+got;
      const supply=originSupplyBand(si);L.push(NEWS('kind.4',{short:c.short,q,unit:fmt1(unit),pf:pc(pf),cost:fmt(cost),supply}));E.items.push({n:c.short,q,unit,cost,lost:q-got,supply});
      L.push(NEWS('voy.resolveVoyage.8',{a:((wreck?NEWS('voy.resolveVoyage.7',{i:voyIcon(mode,robbed),a:wn,b:q-got}):'')+got)}))}
    else L.push(NEWS('kind.5',{short:c.short}));
  }
  if(carry){                                            // 唐物藥種：夾帶唐船私貨
    const {it,q,cost}=carry,got=Math.round(q*keep);refund-=cost;
    contra()[it.k]=(contra()[it.k]||0)+got;E.items.push({n:it.name,q,unit:q?cost/q:0,cost,lost:q-got});
    L.push(NEWS('kind.6',{mode:NM('crew',mode),name:it.name,q,cost:fmt(cost),got:(wreck?UT('voy.resolveVoyage.9',{a:wn,b:got}):'')}));
  }
  refund=Math.max(0,refund);G.silver+=refund+income;
  if(kind!=='outOnly')L.push(NEWS('kind.7',{fee:fmt(fee),refund:fmt(refund)}));
  E.back=refund+income;
  G.voyLog=G.voyLog||[];G.voyLog.unshift(E);if(G.voyLog.length>15)G.voyLog.pop();
  if(E.lossVal>0)lossNote('cargo',E.lossVal);        // 荷損御賑：一旬取損失最大的那隊（07zze_favor8.js）
  if(TURNRP){TURNRP.voy=TURNRP.voy||[];TURNRP.voy.push(E)}
  if(buyout){buyoutDiscover(s.buyoutY,s.buyoutRegion,s.buyoutM);const b=NEWS('buyout.arrive',{region:REG_NAME(s.buyoutRegion),month:buyoutMonth(s.buyoutM,s.buyoutRegion),crew:NM('crew',mode),name:s.captName});pushNews(b);log.push(b)}
  const t=NEWS('kind.8',{mode:NM('crew',mode),captName:s.captName,dest:E.dest,cross:(kind==='outOnly'?UT('r4.out.back'):kind==='own'?UT('voy.t'):kind==='cross'?UT('voy.t.2'):UT('voy.t.3')),sea:(wreck&&kind!=='empty'?UT('voy.t.6',{a:robbed&&mode==='sea'?UT('voy.tPirate'):mode==='sea'?UT('voy.t.4'):UT('voy.t.5')}):'')});
  pushNews(t);log.push(t);sfx.coin();addFame(0.3);
}
/* ---------- 商路畫面 ---------- */
/** 委託採買的長說明：由 voyagePanel 填入，renderRoutes 排在出運清單之後。 */
let VOY_NOTE='';
function voyagePanel(){
  VOY_NOTE='';
  const R_=UI.s.route;if(R_.mode!=='sea'&&R_.mode!=='land')R_.mode='sea';
  const mode=R_.mode;
  if(mode==='land'&&!landPermit())return UT('voy.voyagePanel',{a:REG_NAME(homeCity().region_id)});
  if(mode==='sea'&&!anySea())return UT('voy.voyagePanel.2');
  if(banditBlocks(mode))return banditNotice(mode);
  voyQPrune();
  const caps=idleCaptains(mode);
  if(!caps.length)return '<div class="notice">'+(idleCaptains(mode,true).length?UT('voy.voyagePanel.3',{a:NM('crew',mode)}):UT('voy.voyagePanel.4',{a:NM('crew',mode),b:NM('crew',mode)}))+'</div>';
  const dl=destList(mode).slice(0,10),open=dl.filter(x=>!x.blocked);
  if(!dl.length)return '<div class="notice">'+(destList(mode,true).length?UT('voy.noPermitAll'):mode==='land'?UT('voy.voyagePanel.5'):UT('voy.voyagePanel.6'))+'</div>';
  if(!open.length)return UT('voy.buyoutAllBlocked',{region:REG_NAME(dl[0].ct.region_id),month:buyoutMonth(G.month,dl[0].ct.region_id)});
  if(!caps.some(e=>e.id===R_.capt))R_.capt=caps[0].id;
  if(!open.some(x=>x.ct.id===R_.dest))R_.dest=open[0].ct.id;
  const cash=Math.floor(G.silver-voyQTotal());
  if(cash<100)return UT('voy.voyagePanel.7');
  const maxB=Math.max(100,Math.min(5000,cash));
  R_.budget=clamp(Math.round((R_.budget||500)/50)*50,100,maxB);
  const cap=caps.find(e=>e.id===R_.capt);
  let h=UT('voy.h',{a:NM('crew',mode),b:caps.map(e=>'<span class="pill '+(e.id===R_.capt?'on':'')+'" data-act="vCapt" data-id="'+e.id+'">'+esc(e.name)+' '+ratingStars(e.cid||statsOfEmp(e))+'</span>').join('')})+'</div>';
  h+=UT('voy.voyagePanel.14',{a:dl.map(x=>'<div class="mkt-row '+(x.ct.id===R_.dest?'on':'')+'" data-act="'+(x.blocked?'none':'vDest')+'" data-id="'+x.ct.id+'"'+(x.blocked?' style="opacity:.55"':'')+'><div><b class="small">'+esc(x.ct.name)+'</b> <span class="tag green">'+esc(x.ct.region_name)+'</span>'+(x.blocked?UT('voy.buyoutTag'):'')+'<div class="tiny muted">'+UT('voy.voyagePanel.12',{a:x.d,b:Math.round(voyRisk(cap,x.d,mode)*100)})+'%</div></div><div style="text-align:right" class="tiny">'+UT('voy.voyagePanel.13',{a:x.blocked?UT('voy.buyoutUnavailable'):x.own.length?UT('voy.voyagePanel.10',{a:esc(x.own.slice(0,2).map(n=>COMM_MAP[n].short.slice(0,5)).join(UT('voy.voyagePanel.9'))),b:x.own.length>2?'…':''})+'</b>':UT('voy.voyagePanel.11'),b:x.oth.length})).join('')});
  h+=UT('voy.voyagePanel.15',{a:fmt(R_.budget)});
  h+=UT('voy.voyagePanel.16',{a:stepRow('<input id="slider-voy" type="range" min="100" max="'+maxB+'" step="50" value="'+R_.budget+'">','slider-voy',R_.budget<=100,R_.budget>=maxB),b:Math.round(voyFee((dl.find(x=>x.ct.id===R_.dest)||dl[0]).d)*100)})+'%</span><span>'+fmt(maxB)+'</span></div></div>';
  {const n=originTripUsed(R_.dest)+voyQ().filter(q=>q.dest===R_.dest).length;if(n)h+='<div class="notice tiny">'+UT('voy.repeatWarn',{n})+'</div>'}
  VOY_NOTE='<div class="notice tiny">'+UT('voy.voyagePanel.18',{a:NM('crew',mode),b:G.sysKey==='medicine'?UT('voy.voyagePanel.17'):''});   // 長說明放到出運清單之後（renderRoutes）
  h+=UT('voy.voyagePanel.19',{a:UT('btn.vAdd')})+'</button></div>';
  return h;
}
/** 本業貨一趟能運多少（運量說明，第二百七十一節）：依海運或陸運列出每項本業貨的輕重與件數。 */
function voyCapCard(mode){
  return '<div class="card tiny" style="margin:4px 0"><b class="small">'+UT('rt.capT.'+mode)+'</b><div class="row" style="flex-wrap:wrap;gap:4px 10px;justify-content:flex-start;margin-top:2px">'+ownComms().map(c=>'<span>'+UT('rt.capRow',{n:esc(c.short),w:NM('weight',weightClass(c.name)),q:capOf(c.name,mode)})+'</span>').join('')+'</div></div>';
}
/** 採買日誌：時間（遭難時紅字）、人名與去處、貨物表（貨名、數量、總價；遭難時數量下方紅字損失）、花費與退回。
 *  舊紀錄沒有分項資料，照原文完整列出。 */
function voyLogEntry(v){
  const mode=v.mode||'sea';
  if(!v.items)return '<div class="card"><div class="tiny muted">'+UT('voy.voyLogCard',{a:esc(v.date),b:NM('crew',mode),c:esc(v.capt),d:fmt(v.budget),e:v.lines.map(l=>'<div class="tiny" style="margin-top:2px">'+esc(l)+'</div>').join('')})+'</div>';
  const spent=v.items.reduce((a,x)=>a+x.cost,0);
  let h='<div class="card"><div class="small"><b>'+esc(v.date)+'</b>'+(v.wreck&&v.items.length?' <b style="color:#b3261e">'+UT(v.robbed&&mode==='sea'?'voy.log.pirate':mode==='sea'?'voy.log.wreckSea':'voy.log.wreckLand')+'</b>':'')+'</div>'
    +'<div class="tiny muted">'+UT('voy.log.who',{c:NM('crew',mode),n:esc(v.capt),p:esc(v.dest)})+'</div>';
  if(v.items.length){
    const td='padding:2px 6px;border-bottom:1px dashed #d8ccb0';
    h+='<table class="tiny" style="width:100%;border-collapse:collapse;margin:4px 0"><tr style="text-align:left"><th style="'+td+'">'+UT('voy.log.thName')+'</th><th style="'+td+';text-align:right">'+UT('voy.log.thQty')+'</th><th style="'+td+';text-align:right">'+UT('voy.log.thUnit')+'</th><th style="'+td+';text-align:right">'+UT('voy.log.thCost')+'</th></tr>'
      +v.items.map(x=>'<tr><td style="'+td+'">'+esc(x.n)+(x.supply?'<br><span class="muted">'+esc(UT('voy.supplyLog',{s:x.supply}))+'</span>':'')+'</td><td style="'+td+';text-align:right">'+x.q+(x.lost>0?'<br><span style="color:#b3261e">'+UT('voy.log.lost',{n:x.lost})+'</span>':'')+'</td><td style="'+td+';text-align:right">'+fmt1(x.unit!==undefined?x.unit:(x.q?x.cost/x.q:0))+'</td><td style="'+td+';text-align:right">'+fmt(x.cost)+'</td></tr>').join('')+'</table>'
      +'<div class="tiny">'+UT('voy.log.sum',{a:fmt(spent),b:fmt(v.fee||0),c:fmt(v.back||0)})+'</div>';
  }else h+='<div class="tiny" style="margin-top:3px">'+UT('voy.log.empty',{b:fmt(v.fee||0),c:fmt(v.back||0)})+'</div>';
  return h+'</div>';
}
function voyLogCard(){
  const L=G.voyLog||[];if(!L.length)return '';
  const open=!!UI.s.route.logOpen;
  return UT('voy.voyLogCard.2',{a:open?L.slice(0,5).map(voyLogEntry).join(''):'',b:UT(open?'voy.log.hide':'voy.log.show')});
}
ACT.vLogToggle=()=>{UI.s.route.logOpen=!UI.s.route.logOpen;renderRoutes()};
ACT.vCapt=el=>{UI.s.route.capt=el.dataset.id;renderRoutes()};
ACT.vDest=el=>{const ct=CITY(el.dataset.id);if(!ct||buyoutDepartureBlocked(ct))return;UI.s.route.dest=el.dataset.id;renderRoutes()};
CHG.rModeDummy=()=>{};
/** 本旬出運清單：每列人名、目的地、旬數、委託金與取消鈕；底部合計與「全部出發」（只扣 1 行動點數）。 */
function voyQueueCard(){
  voyQPrune();const Q=voyQ();if(!Q.length)return '';
  const a=homeCity();
  let h=UT('voy.h.2');
  h+=Q.map((q,i)=>{const e=G.emps.find(x=>x.id===q.capt),ct=CITY(q.dest),ok=ct&&permitOf(q.mode,ct);
    return '<div style="margin-top:4px;padding-top:4px'+(i?';border-top:1px dashed #b5a98f':'')+'"><div class="row small" style="gap:6px;align-items:flex-start"><span>'+UT('voy.voyQueueCard.2',{a:MODE_ICON[q.mode],b:esc(e?e.name:UT('voy.voyQueueCard')),c:esc(ct?ct.name:UT('voy.voyQueueCard')),d:ct?distTurns(a,ct,q.mode):'?',e:ok?'':UT('voy.voyagePanel.8')})+'</span><button class="pixel-btn btn-sm" style="flex:none" data-act="vDel" data-i="'+i+'">'+UT('btn.vDel')+'</button></div><div class="small">'+UT('voy.voyQueueCard.3',{a:fmt(q.budget)})}).join('');
  h+=UT('voy.voyQueueCard.4',{a:Q.length,b:fmt(voyQTotal())});
  const noAP=apLeft()<=0;
  h+='<button class="pixel-btn btn-gold" style="width:100%;margin-top:6px;padding:8px" data-act="vGoAll" '+(noAP?'disabled':'')+'>'+UT('btn.vGoAll')+'</button>';
  h+='<div class="tiny muted" style="margin-top:4px;text-align:center">'+(noAP?UT('txt.vGoAllNoAP'):UT('txt.vGoAll'))+'</div>';
  return h+'</div>';
}
/** 加入出運清單（不扣行動點數、不扣錢）：檢查人、目的地、許可、委託金與餘錢。 */
ACT.vAdd=()=>{
  const R_=UI.s.route,mode=R_.mode,cap=idleCaptains(mode).find(e=>e.id===R_.capt);
  if(!cap){toast(MSG('sendVoyage.2',{mode:NM('crew',mode)}));return}
  const dest=CITY(R_.dest);if(!dest||!destList(mode,true).some(x=>x.ct.id===R_.dest)){toast(MSG('sendVoyage.3'));return}
  if(!permitOf(mode,dest)){toast(MSG('sendVoyage.4',{REG_NAME:REG_NAME(dest.region_id),sea:(mode==='sea'?UT('voy.sendVoyage'):UT('voy.sendVoyage.2'))}),4200);return}
  if(buyoutDepartureBlocked(dest)){toast(MSG('sendVoyage.buyout',{REG_NAME:REG_NAME(dest.region_id),month:buyoutMonth(G.month,dest.region_id)}),4200);return}
  const b=Math.floor(R_.budget||0);if(!(b>=100)){toast(MSG('sendVoyage.5'));return}
  if(b>G.silver-voyQTotal()){toast(MSG('voyQ.short',{c:fmt(b+voyQTotal())}),4200);return}
  voyQ().push({capt:cap.id,mode,dest:dest.id,budget:b});sfx.tap();
  toast(MSG('voyQ.add',{crew:NM('crew',mode),name:cap.name,dest:dest.name,budget:fmt(b)}));UI.render();
};
ACT.vDel=el=>{voyQ().splice(+el.dataset.i,1);sfx.tap();UI.render()};
/** 全部出發：一次檢查現款、傷勢與行動點數；逐一出發，失去許可的留在清單；有人出發就扣 1 行動點數。 */
ACT.vGoAll=()=>{
  voyQPrune();const Q=voyQ();if(!Q.length){toast(MSG('voyQ.empty'));return}
  if((G.injured||0)>0){toast(MSG(hurtKey('sendVoyage.hurt'),{injured:G.injured}),4200);return}
  if(apLeft()<=0){toast(MSG('sendVoyage.ap'));return}
  if(voyQTotal()>G.silver){toast(MSG('voyQ.short',{c:fmt(voyQTotal())}),4200);return}
  const ok=[],fail=[];
  Q.slice().forEach(q=>{const r=sendVoyage(q.capt,q.budget,q.dest,q.mode,false,true);if(r.ok)ok.push(q);else fail.push(r.msg)});
  G.voyQueue=Q.filter(q=>!ok.includes(q));
  if(!ok.length){toast(fail[0]||MSG('voyQ.empty'),4200);UI.render();return}
  G.ap--;updateAP();save();
  const names=[...new Set(ok.map(q=>CITY(q.dest).name))].join(UT('voy.voyagePanel.9')),msg=MSG('voyQ.done',{n:ok.length,dest:names})+(fail.length?MSG('voyQ.fail',{n:fail.length}):'');
  playFx(ok.some(q=>q.mode==='sea')?'boat':'cart',MSG('voyage.depart'),names,()=>{toast(msg,5000);UI.render()},1000);
};
document.addEventListener('input',e=>{if(e.target.id==='slider-voy'){UI.s.route.budget=+e.target.value;const b=$('#v-b');if(b)b.textContent=UT('voy.top',{a:fmt(UI.s.route.budget)})}});

/* ═════ [07ia_buyout] ═════ */
'use strict';
/* ======================= 大口買付 =======================
 * 五個地區各自於每季抽一個月；第一年從夏季起，只抽後三季。
 * 排程不主動公開。玩家可由仲買人探聽本地下一次買付風聲、寫信請好感 60 以上的外城友人探聽他那個地區的下一次（07zzn_outfriend.js），或在委託採買返航時得知。
 * 是否受影響以出發年月為準；只影響委託採買的本業貨。 */
const buyoutRegions=()=>[...new Set(ALL_CITIES.map(c=>c.region_id))];
/** 確保本年度排程存在；跨年時各區完全獨立重抽。 */
function buyoutEnsure(){
  if(!G)return null;
  if(G.buyout&&G.buyout.y===G.year&&G.buyout.months&&G.buyout.known){buyoutCycEnsure(G.buyout);return G.buyout}
  const B={y:G.year,months:{},known:{}},skip=G.year===0?ODDS.buyout.firstYearSkip:0;
  buyoutRegions().forEach(rid=>{
    B.months[rid]=ODDS.buyout.quarters.slice(skip).map(q=>rint(q[0],q[1]));
    B.known[rid]={};
  });
  G.buyout=B;buyoutCycEnsure(B);return B;
}
/** 只封一旬的地區（南海）：每個買付月再抽一旬（B.cyc[地區][月]＝1～3）；舊存檔讀檔時補抽。 */
const buyoutCycReg=rid=>ODDS.buyout.cycleRegions.includes(rid);
function buyoutCycEnsure(B){ODDS.buyout.cycleRegions.forEach(rid=>{B.cyc=B.cyc||{};const C=B.cyc[rid]||(B.cyc[rid]={});(B.months[rid]||[]).forEach(m=>{if(!C[m])C[m]=rint(1,3)})})}
/** 買付時間的文字：一般地區「六月」，南海「六月中旬」。 */
const buyoutMonth=(m,rid)=>NAMES.month[m]+'月'+(rid&&buyoutCycReg(rid)&&G.buyout&&G.buyout.cyc&&G.buyout.cyc[rid]&&G.buyout.cyc[rid][m]?NAMES.cycle[G.buyout.cyc[rid][m]-1]:'');
/** 某地區某月（南海再看旬 c；不給 c 時只看月）是否正逢大口買付。 */
function buyoutActive(rid,y,m,c){
  const B=buyoutEnsure();if(!(B&&B.y===y&&(B.months[rid]||[]).includes(m)))return false;
  if(c!==undefined&&buyoutCycReg(rid))return !!(B.cyc&&B.cyc[rid]&&B.cyc[rid][m]===c);
  return true;
}
function buyoutKnown(rid,y,m){
  const B=buyoutEnsure();return !!(B&&B.y===y&&B.known[rid]&&B.known[rid][m]);
}
const buyoutKnownNow=rid=>buyoutActive(rid,G.year,G.month,G.cycle)&&buyoutKnown(rid,G.year,G.month);
const buyoutDepartureBlocked=dest=>!!(dest&&buyoutKnownNow(dest.region_id));
/** 出發時把判定固著在船隊上，之後跨月也不改變結果。 */
function buyoutSnapshot(dest){
  const y=G.year,m=G.month,rid=dest.region_id;
  return {hit:buyoutActive(rid,y,m,G.cycle),y,m,rid};
}
/** 返航或探聽時揭露；返航若已跨年，只保留在日誌，不回寫新年度排程。 */
function buyoutDiscover(y,rid,m){
  const B=buyoutEnsure();if(!B||B.y!==y||!buyoutActive(rid,y,m))return false;
  B.known[rid]=B.known[rid]||{};const fresh=!B.known[rid][m];B.known[rid][m]=1;return fresh;
}
/** 某地區本年度「下一次」買付（含本月）：{rid,m,y,known}；今年已經沒有時回傳 null。 */
function buyoutNextOf(rid){
  const B=buyoutEnsure();if(!B||B.y!==G.year)return null;
  const m=(B.months[rid]||[]).find(x=>x>G.month||(x===G.month&&!(buyoutCycReg(rid)&&B.cyc&&B.cyc[rid]&&B.cyc[rid][x]<G.cycle)));if(!m)return null;   // 南海：這個月的那一旬已過就看下一次
  return {rid,m,y:G.year,known:buyoutKnown(rid,G.year,m)};
}
/** 某地區還能探聽的下一次買付；已知的下一次尚未過去時不能連問。 */
function buyoutIntelFor(rid){const I=buyoutNextOf(rid);return I&&!I.known?I:null}
/** 仲買人只說玩家所在地區、本年度「下一次」買付。 */
function buyoutIntelNext(){return buyoutIntelFor(homeCity().region_id)}

/* ═════ [07ib_origin_supply] ═════ */
'use strict';
/* ======================= 產地供貨指數 =======================
 * 每局、每年、每月、每城、每項當地物產都有固定指數；同月重複前往不重抽。
 * 指數由本局專屬種子按需重算，不保存整張矩陣；委託採買以出發年月為準。 */
function originSupplyEnsure(){
  if(!G)return 0;
  if(G.supplySeed===undefined||G.supplySeed===null)G.supplySeed=hashStr('originSupply|'+G.rs+'|'+G.cityId+'|'+G.turn);
  return G.supplySeed;
}
/** 三角分布：兩個均勻亂數取平均，多數月份靠近 1，極端豐歉較少。 */
function originSupplyIndex(cityId,name,y,m){
  const O=ODDS.originSupply,rd=seeded('originSupply|'+originSupplyEnsure()+'|'+y+'|'+m+'|'+cityId+'|'+name);
  return O.min+(O.max-O.min)*(rd()+rd())/2;
}
/** 供貨豐歉只小幅改變產地成交價，避免蓋過商才與既有價格系統。 */
const originSupplyPrice=i=>clamp(1-ODDS.originSupply.priceSlope*(i-1),ODDS.originSupply.priceMin,ODDS.originSupply.priceMax);
/** 商品分類：沿用市場既有的必需品／一般品／奢侈品判定。 */
const originSupplyKind=name=>COMM_MAP[name].staple?'staple':COMM_MAP[name].luxury?'luxury':'normal';
/**
 * 一趟可買到的量：運量 × 分類平年產量 × 當月豐歉 × 同月同城商隊順位折減。
 * 第一趟仍不能突破運量；後續趟不保證至少一單位，貨源可被搜羅至零。
 */
function originSupplyCap(name,mode,i,rank){
  const O=ODDS.originSupply,k=originSupplyKind(name),cap=capOf(name,mode),n=Math.max(1,rank||1);
  return Math.max(0,Math.min(cap,Math.floor(cap*O.production[k]*i*Math.pow(O.repeat[k],n-1))));
}
function originSupplyBand(i){
  return UT(i<0.75?'voy.supply.famine':i<0.9?'voy.supply.low':i<=1.1?'voy.supply.normal':i<=1.25?'voy.supply.high':'voy.supply.bumper');
}
/** 舊船隊沒有出發月快照，維持舊版採買結果（指數 1）。 */
const originSupplyForShip=(s,dest,name)=>s.supplyY===undefined?1:originSupplyIndex(dest.id,name,s.supplyY,s.supplyM);

/* ═════ [07j_xgoods] ═════ */
'use strict';
/* ★檔案總覽：跨行貨物（趣味玩法，不是正式的賺錢途徑）
 * - 來源只有三種：①船長／飛腳在產地順手買回的便宜貨；②認識的商人拿貨物抵押向你借錢；③官吏硬塞給你的貨。
 *   不能主動買入。貨存在倉庫（G.xinv），佔用倉容，不影響大盤。
 * - 賣出只能拜訪座客商人請託代售（07x_dealers.js）：收入現款、該商人好感 −10；價格約為基準價的 54%～87%（交情越深越高）。
 * - 這不是後期才開放的跨行批發功能。 */
const xName=n=>COMM_MAP[n]?COMM_MAP[n].short:n;
function otherComms(){const own=ownNameSet();return COMM.filter(c=>!own.has(c.name))}
/** 一批沒收貨（協助銷貨與官吏硬塞共用）：非本業、非奢侈品，總值約 300～600 兩（以基準價計），5～50 單位，受倉位限制；放不下 5 單位回傳 null。 */
function xLot(){
  const room=Math.max(0,invCap()-invUsed()-pendingQty());if(room<5)return null;
  const pool=otherComms().filter(c=>!c.luxury);if(!pool.length)return null;
  const c=pick(pool),q=Math.min(room,clamp(Math.round(rint(300,600)/c.base),5,50));
  return {c,q};
}
function xgoodsCard(){
  const ks=Object.keys(G.xinv||{}).filter(k=>G.xinv[k]>0);
  if(!ks.length)return '';
  let h=UT('xg.h');
  h+=ks.map(k=>'<div class="row small" style="margin-top:3px"><span>'+UT('xg.xgoodsCard',{a:esc(xName(k)),b:G.xinv[k],c:fmt1(COMM_MAP[k].base)})).join('');
  return h+'</div>';
}
/* ---------- 來源②：商人拿貨抵押借錢（旬報選項卡） ---------- */
ACT.xoAccept=()=>{
  const O=G.xoffer;if(!O)return;
  if(G.silver<O.loan){toast(MSG('xoAccept.1',{O:fmt(O.loan)}));return}
  const room=Math.max(0,invCap()-invUsed()),q=Math.min(O.qty,room);
  if(q<=0){toast(MSG('xoAccept.2'));G.xoffer=null;UI.hideInfo();return}
  payPublic('spend.xloan|'+O.name,O.loan);G.xinv=G.xinv||{};G.xinv[O.name]=(G.xinv[O.name]||0)+q;
  const r=R(O.cid);setAff(r,clamp(r.aff+6,0,100));logRel(O.cid,UT('xg.xoAccept',{a:O.loan,b:xName(O.name)}));
  toast(MSG('xoAccept.3',{O:fmt(O.loan),xName:xName(O.name),q}));G.xoffer=null;sfx.coin();UI.hideInfo();UI.render();
};
ACT.xoDecline=()=>{G.xoffer=null;UI.hideInfo();toast(MSG('xoDecline.1'))};
/* ---------- 每旬：商人借錢、官吏硬塞 ---------- */
function xgoodsTick(log){
  G.xoffer=null;                         // 上一旬沒處理＝婉拒
  G.xinv=G.xinv||{};
  const oth=otherComms();if(!oth.length||!G.world)return;
  const npcs=Object.values(G.world.npcs);
  // ②商人拿貨抵押借錢
  if(roll('xLoan')){
    const ms=npcs.filter(n=>n.cityId===G.cityId&&['rival','broker'].includes(n.role)&&alive(n.cid)&&R(n.cid).met&&!isEnemy(n.cid));
    if(ms.length){
      const n=pick(ms),c=pick(oth),loan=rint(150,500),qty=Math.max(1,Math.round(1.25*loan/(c.base*0.6)));
      G.xoffer={cid:n.cid,name:c.name,qty,loan,turn:G.turn};
      queueHomeEvent({type:'xloan',cid:n.cid});   // 回府時（07zx_homeevt.js）
      log.push(NEWS('xgoodsTick.1',{n:nameOf(n.cid)}));
    }
  }
  // ③官吏硬塞
  if(roll('xForce')){
    const os=npcs.filter(n=>n.role==='official'&&alive(n.cid)&&R(n.cid).met&&!awayNow(n));
    if(os.length){
      const n=pick(os),L=xLot(),c=L&&L.c,q=L?L.q:0;
      if(q>0){G.xinv[c.name]=(G.xinv[c.name]||0)+q;logRel(n.cid,UT('xg.xgoodsTick',{a:c.short}));
        queueFaceEvent({type:'xforce',cid:n.cid,name:c.name,qty:q});
        log.push(NEWS('xgoodsTick.2',{n:nameOf(n.cid),short:c.short,q}))}
    }
  }
}

/* ═════ [07k_region] ═════ */
'use strict';
/* ★檔案總覽：地區官制（遠國奉行所）與海運、陸運許可
 * - 在各城官署之上多一級「地區官府」（官制資料見 officials.json 的 region 系統，10 個江戶風職位）。
 * - 海路許可＝每個地區各自的「進港泊位許可」（津口番所役核發）。
 * - 陸路許可＝本地區的「關所通行手形」（關所番頭核發）。
 * - 朱印狀、五街道通行狀、地區通商特許狀已刪除（第一百四十二、二百五十六節）；舊存檔已取得的照舊有效（G.flags.road、charter）。
 * - 其餘請託：驛馬優先、產地買付便宜、船手護送、雜費減免狀、請巡見使美言。中央巡見使巡視時，風聲太緊會吊銷許可。
 * - 狀態：G.permits={sea:{regId|all:true},land:{…}}；G.flags.horse/escort/taxfree/cheap（剩餘旬數）；road/charter 只剩舊存檔會有。 */
/** 全部地區（id、名稱）。 */
const REG_LIST=[...new Map(CITIES.map(c=>[c.region_id,{id:c.region_id,name:c.region_name}])).values()];
const REG_NAME=id=>{const r=REG_LIST.find(x=>x.id===id);return r?r.name:id};
/** 地區首府＝該地區人口最多的城市。 */
function capitalOf(regId){return CITIES.filter(c=>c.region_id===regId).sort((a,b)=>cityPop(b)-cityPop(a))[0]}
/** 為每個地區排好 10 位地區官員（冊內官吏型人物優先同鄉）。W＝{npcs}，used＝已用 id 集合，pool＝候選人。 */
function addRegionOfficials(W,used,pool){
  const poss=OFFICIALS.systems.region.positions;
  REG_LIST.forEach(rg=>{
    const cap=capitalOf(rg.id);
    poss.forEach(p=>{
      let c=pool.filter(x=>!used.has(x.id)&&hasRole(x,'official'));
      const old=c.filter(x=>x.birth_year<=-30||x.birth_year<=(G&&G.year?G.year-30:-30));if(old.length)c=old;
      c=shuffle(c).sort((a,b)=>(b.native_region===rg.id)-(a.native_region===rg.id));
      const o=c[0];if(!o)return;used.add(o.id);
      W.npcs[o.id]={cid:o.id,cityId:cap.id,role:'official',pos:{court:'region',rank:p.rank,posId:p.id}};
    });
  });
}
/** 每旬：遠國奉行所缺人就補（第三百四十一節）。五個地區各十個官職，缺幾位補幾位；人選照開局的規則：名冊裡年長的官員、同地區出身優先，用完放寬年齡。 */
function regionRefill(){
  if(!G||!G.world)return;
  const poss=OFFICIALS.systems.region.positions,all=Object.values(G.world.npcs);
  REG_LIST.forEach(rg=>{
    const cap=capitalOf(rg.id);if(!cap)return;
    poss.forEach(p=>{
      if(all.some(n=>n.pos&&n.pos.court==='region'&&n.pos.posId===p.id&&regOfNpc(n)===rg.id&&alive(n.cid)))return;
      const free=a=>CHARS.filter(c=>!G.world.npcs[c.id]&&c.birth_year<=G.year-a&&c.death_year>G.year+2&&hasRole(c,'official'));
      let pool=free(30);if(!pool.length)pool=free(18);
      if(!pool.length){const far=all.filter(n=>n.role==='official'&&n.pos&&n.pos.court!=='region'&&n.cityId!==G.cityId&&alive(n.cid));if(far.length){const n=pick(far);n.cityId=cap.id;n.pos={court:'region',rank:p.rank,posId:p.id}}return}   // 名冊也用完：從外地調一位官員來補
      const home=pool.filter(c=>c.native_region===rg.id),c=pick(home.length?home:pool);
      const n=G.world.npcs[c.id]={cid:c.id,cityId:cap.id,role:'official',pos:{court:'region',rank:p.rank,posId:p.id}};all.push(n);
    });
  });
}
/* ---------- 許可 ---------- */
function permitsOf(){return G.permits||(G.permits={sea:{},land:{}})}
function seaPermitFor(ct){const P=permitsOf().sea;return !!(P.all||P[ct.region_id])}
function anySea(){const P=permitsOf().sea;return !!(P.all||Object.keys(P).length)}
function landPermit(){const P=permitsOf().land;return !!(P.all||P[homeCity().region_id])}
function grantSea(regId){permitsOf().sea[regId]=true}
function grantLand(regId){permitsOf().land[regId]=true}
function permitSummary(){
  const P=permitsOf(),s=P.sea.all?UT('reg.s'):Object.keys(P.sea).map(REG_NAME).join(UT('reg.s.2'))||UT('reg.s.3');
  const l=P.land.all?UT('reg.l'):Object.keys(P.land).map(REG_NAME).join(UT('reg.s.2'))||UT('reg.s.3');
  return {sea:s,land:l};
}
/* ---------- 請託項目 ---------- */
/* 五街道通行狀（rroad）、朱印狀（rshuin）、地區通商特許狀（rcharter）已刪除（第一百四十二、二百五十六節）：不能再請託；
 * 舊存檔已取得的效果照樣保留（regionHeld、permitsOf 照讀），審理中的照樣發給（REG_FAVOR 保留處理函式）。 */
const REG_FAVORS=[
  {k:'rpass',apply:true,name:UT('reg.REG_FAVORS'),rank:3,once:true,pos:['reg_01'],desc:UT('reg.REG_FAVORS.2')},
  {k:'rport',apply:true,name:UT('reg.REG_FAVORS.3'),rank:3,once:true,pos:['reg_02'],desc:UT('reg.REG_FAVORS.4')},
  {k:'rhorse',name:UT('reg.REG_FAVORS.5'),rank:3,cd:12,pos:['reg_03'],desc:UT('reg.REG_FAVORS.6')},
  {k:'rcheap',name:UT('reg.REG_FAVORS.7'),rank:4,cd:12,pos:['reg_04'],desc:UT('reg.REG_FAVORS.8')},
  {k:'rescort',name:UT('reg.REG_FAVORS.9'),rank:4,cd:12,pos:['reg_05'],desc:UT('reg.REG_FAVORS.10')},
  {k:'rtax',name:UT('reg.REG_FAVORS.11'),rank:4,cd:12,pos:['reg_06'],desc:UT('reg.REG_FAVORS.12')},
  {k:'rvisit',name:UT('reg.REG_FAVORS.19'),rank:6,cd:12,pos:['reg_10'],desc:UT('reg.REG_FAVORS.20')}
];
FAVORS.region=REG_FAVORS;
const regOfNpc=n=>CITY(n.cityId).region_id;
/** 一次性許可是否已持有。 */
function regionHeld(key,n){
  const P=permitsOf(),rid=regOfNpc(n);
  if(key==='rport')return !!(P.sea.all||P.sea[rid]);
  if(key==='rpass')return !!(P.land.all||P.land[rid]);
  if(key==='rshuin')return !!P.sea.all;
  if(key==='rroad')return !!G.flags.road;
  if(key==='rcharter')return (G.flags.charter||0)>=3||(!!P.sea[rid]&&!!P.land[rid]&&(G.flags.charter||0)>=3);
  return false;
}
const REG_FAVOR={
  rpass:n=>{grantLand(regOfNpc(n));return NEWS('regionHeld.1',{REG_NAME:REG_NAME(regOfNpc(n))})},
  rport:n=>{grantSea(regOfNpc(n));return NEWS('regionHeld.2',{REG_NAME:REG_NAME(regOfNpc(n))})},
  rhorse:()=>{G.flags.horse=12;return UT('reg.REG_FAVOR.rhorse')},
  rcheap:()=>{G.flags.cheap=12;return UT('reg.REG_FAVOR.rcheap')},
  rescort:()=>{G.flags.escort=12;return UT('reg.REG_FAVOR.rescort')},
  rtax:()=>{G.flags.taxfree=12;return UT('reg.REG_FAVOR.rtax')},
  rroad:()=>{G.flags.road=true;permitsOf().land.all=true;return UT('reg.REG_FAVOR.rroad')},
  rshuin:()=>{permitsOf().sea.all=true;return UT('reg.REG_FAVOR.rshuin')},
  rcharter:n=>{const rid=regOfNpc(n);grantSea(rid);grantLand(rid);G.flags.charter=Math.min(3,(G.flags.charter||0)+1);return NEWS('regionHeld.3',{REG_NAME:REG_NAME(rid)})},
  rvisit:()=>{G.flags.calm=ODDS.calm.turns;return TX('favor.calm')}
};
/* ---------- 每旬：許可效果倒數、巡見使吊銷 ---------- */
function regionTick(log){
  ['horse','escort','taxfree','cheap','calm'].forEach(k=>{if(G.flags[k]>0)G.flags[k]--});
  if((G.heat||0)>=ODDS.regionRevoke.heat&&roll('regionRevoke')){
    const P=permitsOf(),held=[];
    Object.keys(P.sea).forEach(k=>held.push(['sea',k]));Object.keys(P.land).forEach(k=>held.push(['land',k]));
    if(held.length){
      const [m,k]=pick(held);delete P[m][k];
      const fine=Math.round(Math.max(0,G.silver)*0.05);G.silver-=fine;G.heat=Math.max(0,G.heat-2);loseFame('region');
      const t=NEWS('regionTick.1',{sea:(m==='sea'?UT('reg.t'):UT('reg.t.2')),k:(k==='all'?UT('reg.s'):REG_NAME(k)),fine:fmt(fine)});
      pushNews(t);log.push(t);sfx.bad();
    }
  }
}
/* ---------- 遠國奉行所面板 ---------- */
SHEETS.regional=()=>{
  const home=homeCity(),rid=UI.s.regSel||home.region_id;
  let h=UT('reg.h',{a:appsCard()});
  h+='<div style="margin:4px 0">'+REG_LIST.map(r=>'<span class="pill '+(r.id===rid?'on':'')+'" data-act="regSel" data-id="'+r.id+'">'+esc(r.name.slice(0,6))+(r.id===home.region_id?UT('reg.regional'):'')+'</span>').join('')+'</div>';
  h+=UT('reg.mapLink',{id:esc(rid),a:esc(REG_NAME(rid))});   // 前往筆記的地圖頁（07p_wiki.js 的 ACT.goMap）
  if(rid!==home.region_id)h+=UT('letter.note');   // 外地只能寄信（07zz_letters.js）
  h+=regLicCard();
  const offs=Object.values(G.world.npcs).filter(n=>n.pos&&n.pos.court==='region'&&regOfNpc(n)===rid&&alive(n.cid)).sort((a,b)=>a.pos.rank-b.pos.rank);
  h+='<div style="margin:4px 0"><button class="pixel-btn btn-sm" data-act="posList">'+UT('btn.posList2')+'</button></div>';
  h+=offs.map(n=>personBlock(n.cid,'yamen')).join('')||UT('reg.regional.2');
  return {title:UT('reg.regional.3',{a:REG_NAME(rid)}),html:h};
};
ACT.regSel=el=>{UI.s.regSel=el.dataset.id;refreshSheet()};

/* ======================= 許可·權利的申請審理 =======================
 * 申請只在拜訪打勝、好感 ≥60 時出現；賄賂已在拜訪戰鬥中付過，不另附。
 * 受理時好感 −20（REQ_AFF.apply），審理旬數：貪官 3 旬、一般與清官 6 旬。 */
/** 官員類型（在官員之間相對比較）：貪欲 ≥85 貪官；貪欲 ≤72 且忠誠 ≥50 清官；其餘一般。 */
function officialKind(n){
  const s=CH(n.cid).derived_stats;
  return s.greed_index>=85?'greedy':(s.greed_index<=72&&s.integrity_loyalty>=50)?'clean':'plain';
}
function appDuration(n){if(n.pos&&n.pos.rank===1)return 1;const d=officialKind(n)==='greedy'?3:6;return foreignReg(n)?d*2:d}   // 外地遠國奉行所：審理旬數加倍   // 一階官員核發的申請一旬完成
function appsList(){return G.apps||(G.apps=[])}
function appName(f,n){return UT('reg.appName',{a:f.name,b:nameOf(n.cid)})}
function applyFavor(cid,n,r,f,arg){
  if(favorDone(f,n))return {ok:true,status:'held',msg:MSG(f.lic?'doFavor.licHeld':'doFavor.3')};
  if(favorPending(f))return {ok:true,status:'held',msg:MSG('applyFavor.1')};
  {const s=favorSkip(f,n);if(s)return {ok:true,status:'held',msg:s.trade?MSG('applyFavor.trade',{a:COMM_MAP[s.trade].short}):MSG('applyFavor.skip',{a:s.need})}}   // 不越級（第三百二十二節）
  if(appsList().some(a=>a.key===f.k&&a.cid===cid))return {ok:true,status:'held',msg:MSG('applyFavor.1')};
  const A={id:G.turn+'_'+Math.floor(rnd()*1e5),key:f.k,cid,cityId:n.cityId,name:f.name,start:G.turn,rank:n.pos.rank,lic:f.lic,trade:f.trade,state:'wait',left:appDuration(n),arg:arg===undefined?null:arg};
  setAff(r,Math.max(0,r.aff-REQ_AFF.apply));
  const k=officialKind(n),msg=TX(k==='greedy'?'apply.greedyEnough':'apply.plain');
  appsList().push(A);logRel(cid,UT('reg.applyFavor',{a:f.name,b:REQ_AFF.apply}));
  const fh=favorHeat(f.k);                                       // 受理時就加風聲，不等審理結果
  return {ok:true,status:'done',msg:UT('reg.applyFavor.2',{a:MSG('applyFavor.3',{msg}),b:REQ_AFF.apply})+heatTail(fh)};
}
function appGrant(A,log){
  const n=npc(A.cid)||{cid:A.cid,cityId:A.cityId};
  let msg;
  msg=grantFavorApp(A);
  if(msg===null)msg=REG_FAVOR[A.key](n,A.arg);
  logRel(A.cid,UT('reg.appGrant',{a:A.name}));
  const t=NEWS('appGrant.1',{name:A.name,msg});pushNews(t);log.push(t);sfx.fanfare();
}
/** 每旬：審理倒數，到期獲准。 */
function appsTick(log){
  const L=appsList();
  L.forEach(A=>{
    if(A.state==='wait'){A.left--;if(A.left<=0){A.done=true;appGrant(A,log)}}
  });
  G.apps=L.filter(a=>!a.done);
}
/** 冷卻中的請託（第三百零九節）：官員身上的冷卻（r.cd）、新町取立、大工程失敗後的冷卻。回傳 [{name,who,left}]，剩餘旬數少的在前。 */
function cdList(){
  const out=[],favName=k=>{for(const L of Object.values(FAVORS)){const f=(L||[]).find(x=>x.k===k);if(f)return f.name||UT('fav.'+k)}return UT('fav.'+k)};
  Object.entries(G.rel||{}).forEach(([cid,r])=>{if(!r||!r.cd||!alive(cid))return;Object.entries(r.cd).forEach(([k,t])=>{if(t>G.turn)out.push({name:favName(k),who:nameOf(cid),left:t-G.turn})})});
  if(typeof newTownCool==='function'&&newTownCool())out.push({name:favName('newTown'),who:homeCity().name,left:NT().cd-G.turn+1});
  const WN={port:'rport2',road:'rroad2',kokusan:'rkokusan'};
  if(G.works&&G.works.cd)Object.entries(G.works.cd).forEach(([key,t])=>{if(!(t>=G.turn))return;const [k,rid]=key.split(':');if(WN[k])out.push({name:favName(WN[k]),who:REG_NAME(rid),left:t-G.turn+1})});
  return out.sort((a,b)=>a.left-b.left);
}
function appsCard(){
  const L=appsList(),C=cdList();if(!L.length&&!C.length)return '';
  return UT('reg.appsCard.2',{a:L.map(A=>{
    return '<div class="row small" style="margin-top:4px"><span>'+esc(A.name)+'<div class="tiny muted">'+UT('reg.appsCard',{a:esc(nameOf(A.cid)),b:A.left});
  }).join('')+(C.length?UT('reg.cdHead')+C.map(x=>UT('reg.cdRow',{a:esc(x.name),b:esc(x.who),c:x.left})).join(''):'')})+'</div>';
}
