'use strict';
/* ======================= 拜訪戰鬥：禮物破防、賄賂造成傷害、身份決定心防 =======================
 * 流程：1 選人物 → 2 選禮物（好感 60 以上免選）→ 3 門口動畫（只決定拒見、不在家）→ 4 對話框戰鬥 → 5 請託（官員，好感 ≥60 且打勝）。
 *  - 心防：依身份（官階一～六／非官員依角色），貪官加倍。玩家看不到數字，只看對方的台詞。
 *  - 傷害：賄賂 × 禮物倍率。好感 <60：送中軟肋 ×1、送錯 ×0.5；好感 ≥60：一律 ×1（好友不計較）。
 *  - 每回合三檔出價（心防的四分之一／一半／三倍），最多 3 回合；打穿即勝。錢一律不退。
 *  - 期待：每回合對方心裡預設一檔（依個性偏重），台詞約七成準地暗示；猜中那一回合傷害 ×1.5、好感另 +1。
 *    走完 3 回合仍未打穿、且一次都沒猜中：「什麼東西，真沒意思」，好感不加，本旬與下一旬不能拜訪（也不能派丁稚）。
 *  - 勝：好感 +10～20（基本 10＋交情 0～5＋最後一擊溢出 0～5）＋猜中次數；未打穿：依進度 +0～4＋猜中次數。
 *  - 對官員出過價：風聲 +0.2（貪官 +0.3），與金額無關。
 *  - 丁稚代送禮金：只能派給好感未滿 60 的人；付中檔禮金，好感隨機 +4～8（最多補到 60），不扣行動點數、不能請託。
 *  - 狀態只在 BT（不存檔）。 */
/** 六種禮物（不花錢，只代表投其所好）：每種對應兩個軟肋；prop＝拜訪動畫用的道具樣式。 */
const GIFTS=[
  {k:'curio',name:'名家珍玩',icon:'🖼️',prop:'antique',weak:['喜好收受罕見字畫','癡迷古代珍奇異寶']},
  {k:'feast',name:'花街酒宴',icon:'🍶',prop:'wine',weak:['好美酒佳釀','沉迷吉原風月名妓']},
  {k:'family',name:'家眷厚禮',icon:'🎀',prop:'wife',weak:['溺愛幼子幼女','懼內且聽信枕邊風']},
  {k:'plaque',name:'捐匾施賑',icon:'🏷️',prop:'fame',weak:['貪圖聲名愛好虛榮','憐憫落魄流民乞丐']},
  {k:'amulet',name:'必勝御守',icon:'🧧',prop:'charm',weak:['篤信神佛與方術','賭性深重難以自拔']},
  {k:'horse',name:'名馬武具',icon:'🐎',prop:'safe',weak:['天生畏懼水路遠航','心胸狹隘睚眥必報']}
];
const GIFT_MAP={};GIFTS.forEach(g=>GIFT_MAP[g.k]=g);
/** 好友門檻：好感達此值，禮物倍率一律 1、官員出現請託。 */
const FRIEND_AFF=60;
/** 身份心防（兩）：官階一～六。 */
const BT_HP=[20,50,120,300,750,1800];
/** 非官員依角色對應的官階等級。 */
const BT_ROLE_TIER={guest:1,broker:1,manager:2,smuggler:2,rival:3};
/** 某人的心防。 */
function btHp(cid){
  const n=npc(cid);
  const t=n&&n.pos?n.pos.rank:(BT_ROLE_TIER[n&&n.role]||1);
  return BT_HP[clamp(t,1,6)-1]*(n&&n.pos&&officialKind(n)==='greedy'?2:1);
}
/** 三檔出價（心防的四分之一、一半、三倍，取整到 5 兩）。 */
const BT_TIER_X=[0.25,0.5,3];
function btTiers(cid){const h=btHp(cid),r=v=>Math.max(5,Math.round(v/5)*5);return BT_TIER_X.map(x=>r(h*x))}
/** 期待：各類人物心裡預設小／中／大的偏重；猜中傷害倍率；台詞暗示的準確度。 */
const BT_EXPECT_W={greedy:[20,30,50],clean:[50,35,15],plain:[30,40,30],merchant:[30,40,30]};
const BT_HIT_X=1.5,BT_HINT_ACC=0.7;
/** 人物類型（官員看貪清；非官員為 merchant）。 */
const btKind=cid=>{const n=npc(cid);return n&&n.pos?officialKind(n):'merchant'};
/** 依偏重抽這一回合的期待（0 小、1 中、2 大）。 */
function btRollExpect(cid){const w=BT_EXPECT_W[btKind(cid)];let x=rnd()*(w[0]+w[1]+w[2]);for(let i=0;i<3;i++){x-=w[i];if(x<0)return i}return 1}
/** 暗示期待的台詞：七成照實，三成指向別檔。 */
function btHint(cid,expect){const t=rnd()<BT_HINT_ACC?expect:pick([0,1,2].filter(i=>i!==expect));return btSay(cid,'hint.'+['small','mid','large'][t])}
/** 人物適用的增補句庫（身份：官階帶或商邸身分；系統別；年齡層；女性）。 */
function btGroups(cid){
  const n=npc(cid),c=CH(cid),L=LINES.battle,out=[];if(!c)return out;
  if(n&&n.pos){out.push(L.rank[n.pos.rank<=2?'low':n.pos.rank<=4?'mid':'high']);if(L.court[n.pos.court])out.push(L.court[n.pos.court])}
  else if(n&&L.role[n.role])out.push(L.role[n.role]);
  const a=ageOf(cid);out.push(L.age[a<35?'young':a<55?'prime':'old']);
  if(c.gender==='女')out.push(L.fem);
  return out;
}
/** 拜訪戰鬥取句：原句與所有適用的增補句合成一池，平均抽一句。stage：openHit／openMiss／openFriend／low／mid／close／win／lose／snub／hint.small…。 */
function btSay(cid,stage,vars){
  const n=npc(cid),L=LINES.battle,at=(o,p)=>p.split('.').reduce((x,k)=>x&&x[k],o),kind=n&&n.pos?officialKind(n):'merchant';
  let pool=[].concat(['low','mid','close','win'].includes(stage)?L[stage][kind]:at(L,stage)||[]);
  btGroups(cid).forEach(g=>{const v=at(g,stage);if(Array.isArray(v))pool=pool.concat(v)});
  if(stage==='snub'){if(n&&n.pos)pool=pool.concat(L.snubX.official);else if(n&&n.role==='smuggler')pool=pool.concat(L.snubX.smuggler);if(CH(cid)&&CH(cid).gender==='女')pool=pool.concat(L.snubX.fem)}
  const s=pool.length?pool[Math.floor(rnd()*pool.length)]:'';
  return vars?s.replace(/\{(\w+)\}/g,(m,k)=>vars[k]===undefined?m:vars[k]):s;
}
/** 是否正在氣頭上（被嫌不善言辭：本旬與下一旬不能拜訪）。 */
const snubbed=cid=>{const r=G.rel[cid];return !!(r&&r.snubUntil!==undefined&&G.turn<=r.snubUntil)};
/** 禮物倍率。 */
function btMult(cid,giftKey){
  const r=R(cid);if(r.aff>=FRIEND_AFF)return 1;
  const g=GIFT_MAP[giftKey];return g&&g.weak.includes(CH(cid).weakness)?1:0.5;
}
/** 交情（初見時的性向相容）帶來的額外好感 0～5。 */
const btBondBonus=r=>{const m=r.bond?r.bond.mult:1;return m>=3?5:m>=2?4:m>=1?2:0};
/** 禮物下拉選項（已證實的軟肋標 ⭐）。 */
function giftOptions(cid){
  const r=R(cid),w=CH(cid).weakness;
  return GIFTS.map(g=>'<option value="'+g.k+'">'+g.icon+' '+g.name+(r.verified&&g.weak.includes(w)?' ⭐':'')+'</option>').join('');
}
/** 人物卡的拜訪區塊（已結識者）。 */
function visitRowHtml(cid){
  const r=R(cid),friend=r.aff>=FRIEND_AFF;
  let h='<div class="small bold" style="margin-top:5px">🎁 登門拜訪</div>';
  if(friend)h+='<div class="tiny muted" style="margin-top:2px">交情已深，帶什麼禮都不計較。</div>';
  else h+='<div class="row" style="gap:4px;margin-top:2px"><span class="tiny">禮物</span><select class="gift-sel" style="flex:1">'+giftOptions(cid)+'</select></div>';
  const n=npc(cid);if(n&&n.pos)h+='<div class="tiny muted" style="margin-top:3px">'+(friend?'見面時表示心意，對方高興了，才好開口請託。':'交情到了，才好開口請託。')+'</div>';
  h+='<div style="margin-top:4px;display:flex;gap:4px"><button class="pixel-btn btn-sm btn-gold" style="flex:2" data-act="visit" data-cid="'+cid+'">'+UT('btn.visit')+'</button>'+errandBtn(cid)+'</div>';
  return h;
}

/* ---------- 進度台詞 ---------- */
/** 依打掉的比例與官員類型，挑一句模糊的反應台詞。 */
function btLine(cid,ratio){
  const st=ratio>=1?'win':ratio>=0.7?'close':ratio>=0.3?'mid':'low';
  return btSay(cid,st);
}

/* ---------- 戰鬥狀態與流程 ---------- */
/** 目前進行中的拜訪戰鬥（不存檔）。 */
var BT=null;
/** 見到面後開始戰鬥。 */
function battleStart(cid,giftKey){
  const r=R(cid),friend=r.aff>=FRIEND_AFF,g=GIFT_MAP[giftKey];
  const mult=btMult(cid,giftKey),hit=!friend&&mult>=1;
  if(hit)r.verified=true;
  if(!friend&&g&&g.k==='plaque')G.life.charity++;
  BT={cid,gift:giftKey,mult,hp:btHp(cid),dmg:0,round:0,spent:0,heat:false,done:false,hits:0,
    open:btSay(cid,friend?'openFriend':hit?'openHit':'openMiss',{g:g?g.name:'禮物'}),line:''};
  BT.expect=btRollExpect(cid);BT.hint=btHint(cid,BT.expect);          // 開場就透露第一回合的期待
  musicWant('visit');                                   // 拜訪戰鬥換成《登門囃子》
  logRel(cid,friend?'登門拜訪，老朋友相見。':'登門拜訪，帶去「'+(g?g.name:'禮物')+'」'+(hit?'，正中下懷。':'。'));
  battleShow();
}
/** 對話框內容。 */
function battleHtml(){
  const B=BT,cid=B.cid,t=btTiers(cid),left=3-B.round;
  let h='<div style="display:flow-root">'+portraitHtml(cid,56)+'<div class="small">'+esc(B.open)+'</div>'+(B.line?'<div class="small" style="margin-top:6px;color:#6b4327">'+esc(B.line)+'</div>':'')+(B.hint?'<div class="small" style="margin-top:4px;color:#5b4a70">'+esc(B.hint)+'</div>':'')+'</div>';
  h+='<div class="tiny muted" style="margin-top:6px">'+(left>=3?'該怎麼表示心意？':left===2?'對方還在聽。':'對方的耐性快到頭了。')+(B.spent?'　已奉上 '+fmt(B.spent)+' 兩。':'')+'</div>';
  h+='<div class="grid3" style="margin-top:6px;gap:4px">'+['小','中','大'].map((lb,i)=>'<button class="pixel-btn btn-sm btn-gold" data-act="btOffer" data-i="'+i+'" '+(G.silver<t[i]?'disabled':'')+'>'+lb+'·'+coinHtml('silver',t[i])+'</button>').join('')+'</div>';
  h+='<div style="margin-top:6px;text-align:right"><button class="pixel-btn btn-sm" data-act="btEnd">閒話家常，告辭</button></div>';
  return h;
}
function battleShow(){UI.showInfo('🍵 拜訪·'+nameOf(BT.cid),battleHtml())}
/** 出價一回合。 */
ACT.btOffer=el=>{
  const B=BT;if(!B||B.done)return;
  const amt=btTiers(B.cid)[+el.dataset.i];
  if(G.silver<amt){toast(MSG('buyGoods.5',{cost:fmt(amt)}));return}
  battleHit(amt,+el.dataset.i);
  if(B.dmg>=B.hp||B.round>=3)battleEnd();else{B.expect=btRollExpect(B.cid);B.hint=btHint(B.cid,B.expect);battleShow()}
};
/** 造成傷害（丁稚代送也走這裡）。 */
function battleHit(amt,tier){
  const B=BT,n=npc(B.cid),hit=tier!==undefined&&tier===B.expect;
  if(hit)B.hits++;
  payPublic('拜訪賄賂：'+nameOf(B.cid),amt);B.spent+=amt;B.round++;B.dmg+=amt*B.mult*(hit?BT_HIT_X:1);sfx.coin();
  if(n&&n.pos&&!B.heat){B.heat=true;addHeat(officialKind(n)==='greedy'?0.3:0.2);G.life.gold+=1}
  B.line=btLine(B.cid,B.dmg/B.hp);
}
ACT.btEnd=()=>{if(BT&&!BT.done)battleEnd()};
/** 結算：好感增加；官員好感 ≥60 且打勝，進入請託。 */
function battleEnd(){
  const B=BT;if(!B||B.done)return;B.done=true;
  if(!B.errand)musicWant('market');                     // 戰鬥結束，回到主畫面配樂
  const cid=B.cid,r=R(cid),n=npc(cid),win=B.dmg>=B.hp;
  if(!win&&B.round>=3&&B.hits===0){                                 // 走完三回合、一次都沒猜中：不善言辭
    r.snubUntil=G.turn+1;r.lastOk=false;logRel(cid,'話不投機，對方嫌你不善言辭'+(B.spent?'（奉上 '+B.spent+' 兩）':'')+'。');sfx.bad();
    UI.render();refreshSheet();UI.hideInfo();toast(btSay(cid,'snub'),4600);BT=null;return;
  }
  let gain=(win?10+btBondBonus(r)+Math.min(5,Math.floor((B.dmg-B.hp)/B.hp*10)):Math.floor(5*B.dmg/B.hp))+B.hits;
  gain=Math.max(0,Math.min(gain,100-r.aff));
  const hiOff=n&&n.pos&&n.pos.rank>=4;            // 四～六階官員：打勝知名度＝結識時的一半（0.75×官階，隨知名度遞減）
  r.aff=clamp(r.aff+gain,0,100);r.lastOk=true;addFame(win?(hiOff?0.75*n.pos.rank:0.3):0.1);
  logRel(cid,(win?'相談甚歡':'話不投機')+(B.spent?'，奉上 '+B.spent+' 兩':'')+'，好感 +'+gain+'。');
  if(win)sfx.gift();
  const msg=(win?btSay(cid,'win'):B.spent?btSay(cid,'lose'):TX('battle.chat'))+'（好感 +'+gain+'）';
  UI.render();refreshSheet();
  if(win&&n&&r.aff>=FRIEND_AFF&&reqList(cid).length){UI.showInfo('📜 請託·'+nameOf(cid),requestHtml(cid,msg));return}
  UI.hideInfo();toast(msg,4200);BT=null;
}
/* 對話框被直接關掉＝閒話告辭 */
(function(){const h=UI.hideInfo;UI.hideInfo=function(){h();if(BT&&!BT.done){battleEnd()}else if(BT&&BT.done)BT=null}})();

/* ---------- 丁稚代送禮金：手動版的大番頭問候 ---------- */
/** 丁稚代送：只能派給好感未滿 60 的人；付中檔禮金（送官員照樣加風聲），好感隨機 +4～8，最多補到 60；不扣行動點數、不能請託。 */
const ERRAND_GAIN=[4,8];
function errandVisit(cid){
  const r=R(cid),amt=btTiers(cid)[1];
  BT={cid,gift:null,mult:1,hp:btHp(cid),dmg:0,round:0,spent:0,heat:false,done:true,errand:true,open:'',line:''};
  battleHit(amt);BT=null;
  const gain=Math.max(0,Math.min(rint(ERRAND_GAIN[0],ERRAND_GAIN[1]),FRIEND_AFF-r.aff));
  r.aff=clamp(r.aff+gain,0,100);r.lastOk=true;addFame(0.1);
  logRel(cid,'丁稚代為送上禮金 '+amt+' 兩，好感 +'+gain+'。');
  toast(MSG('errand.done',{cid:nameOf(cid),amt:fmt(amt),gain}),4200);sfx.gift();
  UI.render();refreshSheet();
}

/* ---------- 請託（好感 ≥60 且打勝） ---------- */
/** 特殊請託只有四階以上的官員能辦。 */
const SPECIAL_RANK=4;
/** 好感 100 的特殊請託（四階以上官員，每位一次）。 */
function specialList(cid){
  const r=R(cid),n=npc(cid);if(!n||!n.pos||n.pos.rank<SPECIAL_RANK||r.aff<100||r.specialUsed)return [];
  const k=schemeKind(n),out=[];
  if(k)out.push({k:'sp_'+k,special:k,name:SCHEME[k].name,desc:'他與你交情至深，願對隨機一家同業'+SCHEME[k].name+'。'+costTxt(k)+'；成敗看他的膽識與商才，事後可能被查辦。'});
  if(n.pos.court==='finance'&&!G.tribute)out.push({k:'sp_tribute',special:'tribute',name:'上貢',desc:'他想請你備一批本業貨，'+ODDS.tribute.turns+' 旬內備齊，他會用高價收下。'});
  return out;
}
/** 這次可開口的請託：一般請託＋好感 100 的特殊請託。 */
function reqList(cid){
  const n=npc(cid);if(!n)return [];if(!n.pos)return dealerReqs(cid);   // 商人請託：調貨、銷貨、臨時打工、代售與脫手（07x_dealers.js）
  return favorList(cid).filter(f=>n.pos.rank>=f.rank&&!(f.apply&&(favorDone(f,n)||favorPending(f)))&&!(f.once&&regionHeld(f.k,n))&&!(f.k==='lessen'&&(G.lessen||0)>0)).concat(specialList(cid));
}
function requestHtml(cid,msg){
  const L=reqList(cid);
  return '<div style="display:flow-root">'+portraitHtml(cid,56)+'<div class="notice tiny">'+esc(msg)+'</div></div><div class="small bold" style="margin-top:6px">趁著對方高興，要不要開口請託？</div>'
    +L.map(f=>'<div class="irow" style="margin-top:4px"><div class="row"><b class="small">'+esc(f.name)+'</b><button class="pixel-btn btn-sm btn-gold" data-act="reqAsk" data-cid="'+cid+'" data-k="'+f.k+'">開口</button></div><div class="tiny muted">'+esc(f.desc||'')+'</div></div>').join('')
    +'<div style="margin-top:7px;text-align:right"><button class="pixel-btn btn-sm" data-act="reqDone">今日只敘舊</button></div>';
}
ACT.reqDone=()=>{BT=null;UI.hideInfo()};
/** 請託辦成後扣的好感：一般 −10、許可 −20、減罪狀 −30；特殊請託 −30。 */
const REQ_AFF={normal:10,apply:20,lessen:30,special:30};
ACT.reqAsk=el=>{
  const cid=el.dataset.cid,k=el.dataset.k,r=R(cid);BT=null;
  const sp=specialList(cid).find(x=>x.k===k);
  if(sp){
    r.specialUsed=true;r.aff=Math.max(0,r.aff-REQ_AFF.special);logRel(cid,'開口請他「'+sp.name+'」，好感 -'+REQ_AFF.special+'。');
    UI.hideInfo();
    if(sp.special==='tribute')startTribute(cid);else startScheme(cid);
    return;
  }
  const dm=dealerDo(cid,k);
  if(dm!==null){UI.showInfo('📜 請託結果·'+nameOf(cid),portraitHtml(cid,56)+'<div class="notice" style="margin-top:6px">'+esc(dm)+'</div><div style="margin-top:7px;text-align:right"><button class="pixel-btn btn-sm" data-act="reqDone">告辭</button></div>');sfx.coin();UI.render();refreshSheet();return}
  const res=doFavor(cid,k);
  UI.showInfo('📜 請託結果·'+nameOf(cid),portraitHtml(cid,56)+'<div class="notice" style="margin-top:6px">'+esc(res.msg)+'</div><div style="margin-top:7px;text-align:right"><button class="pixel-btn btn-sm" data-act="reqDone">告辭</button></div>');
  if(res.status==='done')sfx.coin();else sfx.bad();UI.render();refreshSheet();
};
