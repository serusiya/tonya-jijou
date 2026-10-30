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
  {k:'curio',name:UT('bt.GIFTS'),icon:'🖼️',prop:'antique',weak:['art','antique']},
  {k:'feast',name:UT('bt.GIFTS.2'),icon:'🍶',prop:'wine',weak:['wine','courtesan']},
  {k:'family',name:UT('bt.GIFTS.3'),icon:'🎀',prop:'wife',weak:['children','henpecked']},
  {k:'plaque',name:UT('bt.GIFTS.4'),icon:'🏷️',prop:'fame',weak:['vanity','pity']},
  {k:'amulet',name:UT('bt.GIFTS.5'),icon:'🧧',prop:'charm',weak:['faith','gambling']},
  {k:'horse',name:UT('bt.GIFTS.6'),icon:'🐎',prop:'safe',weak:['seafear','grudge']}
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
  if(c.gender==='f')out.push(L.fem);
  return out;
}
/** 本場拜訪已說過的句子（每場開始時清空）與最近說過的 30 句（跨場，不存檔）。 */
const BT_USED=new Set(),BT_RECENT=[];
/** 拜訪戰鬥取句：原句與所有適用的增補句合成一池，平均抽一句。stage：openHit／openMiss／openFriend／low／mid／close／win／lose／snub／hint.small…。 */
function btSay(cid,stage,vars){
  const n=npc(cid),L=LINES.battle,at=(o,p)=>p.split('.').reduce((x,k)=>x&&x[k],o),kind=n&&n.pos?officialKind(n):'merchant';
  let pool=[].concat(['low','mid','close','win'].includes(stage)?L[stage][kind]:at(L,stage)||[]);
  btGroups(cid).forEach(g=>{const v=at(g,stage);if(Array.isArray(v))pool=pool.concat(v)});
  if(stage==='snub'){if(n&&n.pos)pool=pool.concat(L.snubX.official);else if(n&&n.role==='smuggler')pool=pool.concat(L.snubX.smuggler);if(CH(cid)&&CH(cid).gender==='f')pool=pool.concat(L.snubX.fem)}
  /* 避免重複：先排除本場已說過的句子與最近說過的 30 句；用完再放寬，至少不與上一句相同 */
  let cand=pool.filter(x=>!BT_USED.has(x)&&!BT_RECENT.includes(x));
  if(!cand.length)cand=pool.filter(x=>!BT_USED.has(x));
  if(!cand.length)cand=pool.filter(x=>x!==BT_RECENT[BT_RECENT.length-1]);
  if(!cand.length)cand=pool;
  const s=cand.length?cand[Math.floor(rnd()*cand.length)]:'';
  if(s){BT_USED.add(s);BT_RECENT.push(s);if(BT_RECENT.length>30)BT_RECENT.shift()}
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
  let h=UT('bt.h');
  if(friend)h+=UT('bt.visitRowHtml');
  else h+=UT('bt.visitRowHtml.2',{a:giftOptions(cid)})+'</select></div>';
  const n=npc(cid);if(n&&n.pos)h+='<div class="tiny muted" style="margin-top:3px">'+(friend?UT('bt.visitRowHtml.3'):UT('bt.visitRowHtml.4'))+'</div>';
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
  BT_USED.clear();                                       // 新的一場：本場說過的句子清空
  const r=R(cid),friend=r.aff>=FRIEND_AFF,g=GIFT_MAP[giftKey];
  const mult=btMult(cid,giftKey),hit=!friend&&mult>=1;
  if(hit)r.verified=true;
  if(!friend&&g&&g.k==='plaque')G.life.charity++;
  BT={cid,gift:giftKey,mult,hp:btHp(cid),dmg:0,round:0,spent:0,heat:false,done:false,hits:0,
    open:btSay(cid,friend?'openFriend':hit?'openHit':'openMiss',{g:g?g.name:UT('bt.battleStart')}),line:''};
  BT.expect=btRollExpect(cid);BT.hint=btHint(cid,BT.expect);          // 開場就透露第一回合的期待
  musicWant('visit');                                   // 拜訪戰鬥換成《登門囃子》
  logRel(cid,friend?UT('bt.battleStart.2'):UT('bt.battleStart.5',{a:g?g.name:UT('bt.battleStart'),b:hit?UT('bt.battleStart.3'):UT('bt.battleStart.4')}));
  battleShow();
}
/** 對話框內容。 */
function battleHtml(){
  const B=BT,cid=B.cid,t=btTiers(cid),left=3-B.round;
  let h='<div style="display:flow-root">'+portraitHtml(cid,56)+'<div class="small">'+esc(B.open)+'</div>'+(B.line?'<div class="small" style="margin-top:6px;color:#6b4327">'+esc(B.line)+'</div>':'')+(B.hint?'<div class="small" style="margin-top:4px;color:#5b4a70">'+esc(B.hint)+'</div>':'')+'</div>';
  h+='<div class="tiny muted" style="margin-top:6px">'+(left>=3?UT('bt.battleHtml'):left===2?UT('bt.battleHtml.2'):UT('bt.battleHtml.3'))+(B.spent?UT('bt.battleHtml.4',{a:fmt(B.spent)}):'')+'</div>';
  h+='<div class="grid3" style="margin-top:6px;gap:4px">'+[UT('bt.battleHtml.5'),UT('bt.battleHtml.6'),UT('bt.battleHtml.7')].map((lb,i)=>'<button class="pixel-btn btn-sm btn-gold" data-act="btOffer" data-i="'+i+'" '+(G.silver<t[i]?'disabled':'')+'>'+lb+'·'+coinHtml('silver',t[i])+'</button>').join('')+'</div>';
  h+=UT('bt.battleHtml.8');
  return h;
}
function battleShow(){UI.showInfo(UT('bt.battleShow',{a:nameOf(BT.cid)}),battleHtml())}
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
  payPublic('spend.bribe|'+B.cid,amt);B.spent+=amt;B.round++;B.dmg+=amt*B.mult*(hit?BT_HIT_X:1);sfx.coin();
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
    r.snubUntil=G.turn+1;r.lastOk=false;logRel(cid,UT('bt.battleEnd.2',{a:B.spent?UT('bt.battleEnd',{a:B.spent}):''}));sfx.bad();
    UI.render();refreshSheet();UI.hideInfo();toast(btSay(cid,'snub'),4600);BT=null;return;
  }
  let gain=(win?10+btBondBonus(r)+Math.min(5,Math.floor((B.dmg-B.hp)/B.hp*10)):Math.floor(5*B.dmg/B.hp))+B.hits;
  gain=Math.max(0,Math.min(gain,100-r.aff));
  const hiOff=n&&n.pos&&n.pos.rank>=4;            // 四～六階官員：打勝知名度＝結識時的一半（0.75×官階，隨知名度遞減）
  setAff(r,clamp(r.aff+gain,0,100));r.lastOk=true;addFame(win?(hiOff?0.75*n.pos.rank:0.3):0.1,win&&hiOff?'mid':undefined);
  logRel(cid,UT('bt.battleEnd.6',{a:((win?UT('bt.battleEnd.3'):UT('bt.battleEnd.4'))+(B.spent?UT('bt.battleEnd.5',{a:B.spent}):'')),b:gain}));
  if(win)sfx.gift();
  const msg=UT('bt.msg',{a:win?btSay(cid,'win'):B.spent?btSay(cid,'lose'):TX('battle.chat'),b:gain});
  UI.render();refreshSheet();
  if(win&&n&&r.aff>=FRIEND_AFF&&reqList(cid).length){UI.showInfo(UT('bt.battleEnd.7',{a:nameOf(cid)}),requestHtml(cid,msg));return}
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
  setAff(r,clamp(r.aff+gain,0,100));r.lastOk=true;addFame(0.1);
  logRel(cid,UT('bt.errandVisit',{a:amt,b:gain}));
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
  if(k)out.push({k:'sp_'+k,special:k,name:SCHEME[k].name,desc:NEWS('bt.specialList',{a:SCHEME[k].name,b:costTxt(k)})});
  if(n.pos.court==='finance'&&!G.tribute)out.push({k:'sp_tribute',special:'tribute',name:NEWS('bt.specialList.2'),desc:NEWS('bt.specialList.3',{a:ODDS.tribute.turns})});
  return out;
}
/** 這次可開口的請託：一般請託＋好感 100 的特殊請託。 */
function reqList(cid){
  const n=npc(cid);if(!n)return [];if(!n.pos)return dealerReqs(cid);   // 商人請託：調貨、銷貨、臨時打工、代售與脫手（07x_dealers.js）
  return favorList(cid).filter(f=>n.pos.rank>=f.rank&&!(f.apply&&(favorDone(f,n)||favorPending(f)))&&!(f.once&&regionHeld(f.k,n))&&!(f.k==='lessen'&&(G.lessen||0)>0)).concat(specialList(cid));
}
function requestHtml(cid,msg){
  const L=reqList(cid);
  return '<div style="display:flow-root">'+portraitHtml(cid,56)+'<div class="notice tiny">'+UT('bt.requestHtml.2',{a:esc(msg),b:L.map(f=>'<div class="irow" style="margin-top:4px"><div class="row"><b class="small">'+esc(f.name)+'</b><button class="pixel-btn btn-sm btn-gold" data-act="reqAsk" data-cid="'+cid+'" data-k="'+UT('bt.requestHtml',{a:f.k,b:esc(f.desc||'')})+'</div></div>').join('')});
}
ACT.reqDone=()=>{BT=null;UI.hideInfo()};
/** 解仇：先挑一位仇人（在世的仇人都列出，不分城市）。 */
function reconcilePick(cid){
  const L=enemies();
  return portraitHtml(cid,56)+'<div class="notice tiny">'+esc(MSG('favor.reconcilePick'))+'</div>'+UT('bt.reconcilePick.2',{a:L.map(t=>'<div class="irow" style="margin-top:4px"><div class="row"><b class="small">'+esc(nameOf(t))+'</b><button class="pixel-btn btn-sm btn-gold" data-act="reqAsk" data-cid="'+cid+'" data-k="reconcile" data-t="'+UT('bt.reconcilePick',{a:t})).join('')});
}
/** 請託辦成後扣的好感：一般 −10、許可 −20、減罪狀 −30；特殊請託 −30。 */
const REQ_AFF={normal:10,apply:20,lessen:30,special:30};
ACT.reqAsk=el=>{
  const cid=el.dataset.cid,k=el.dataset.k,r=R(cid);BT=null;
  const sp=specialList(cid).find(x=>x.k===k);
  if(sp){
    r.specialUsed=true;setAff(r,Math.max(0,r.aff-REQ_AFF.special));logRel(cid,UT('bt.reqAsk',{a:sp.name,b:REQ_AFF.special}));
    UI.hideInfo();
    if(sp.special==='tribute')startTribute(cid);else startScheme(cid);
    return;
  }
  const dm=dealerDo(cid,k);
  if(dm!==null){UI.showInfo(UT('bt.reqAsk.2',{a:nameOf(cid)}),portraitHtml(cid,56)+'<div class="notice" style="margin-top:6px">'+UT('bt.reqAsk.3',{a:esc(dm)}));sfx.coin();UI.render();refreshSheet();return}
  if(k==='reconcile'&&!el.dataset.t){UI.showInfo(UT('bt.reqAsk.4',{a:nameOf(cid)}),reconcilePick(cid));return}
  const res=doFavor(cid,k,el.dataset.t);
  UI.showInfo(UT('bt.reqAsk.2',{a:nameOf(cid)}),portraitHtml(cid,56)+'<div class="notice" style="margin-top:6px">'+UT('bt.reqAsk.3',{a:esc(res.msg)}));
  if(res.status==='done')sfx.coin();else sfx.bad();UI.render();refreshSheet();
};
