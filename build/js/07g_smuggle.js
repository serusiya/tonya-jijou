/* =====================================================================
 * 07g_smuggle.js — 走私與搜查、刑罰
 *  走私：用私房錢向海外買違禁品，船隊＋船長出海，到貨進「密庫」，再請私梟脫手（07x_dealers.js），收入進私房錢。
 *  搜查：每旬有機率被奉行所搜查；打點同心（袖之下）、司法官員交情、風聲、持有違禁品價值都會影響結果。
 *  刑罰：由輕到重＝罰銀＋沒收 → 遠島（期間不能行動）→ 抄家 → 處刑（本代終結）。
 *  狀態：G.smug 在途航程、G.contra 密庫存量、G.smugP 今旬行情係數、G.exile 遠島旬數、G.raidNote 旬報用的搜查結果。
 * ===================================================================== */

/** 違禁品：cost 海外進貨單價、sell 江戶基準售價、danger 危險度（影響被查獲與刑責）。 */
const SMUG_ITEMS=[
  {k:'wine', name:'洋酒（葡萄牙酒）', icon:'🍷',cost:40, sell:130,danger:1},
  {k:'glass',name:'玻璃器皿',         icon:'🔮',cost:55, sell:165,danger:1},
  {k:'cloth',name:'西洋毛織·天鵝絨', icon:'🧣',cost:60, sell:180,danger:1},
  {k:'herb', name:'唐渡人參·麝香',   icon:'🌿',cost:75, sell:240,danger:2},
  {k:'opium',name:'鴉片',             icon:'🟤',cost:90, sell:340,danger:3}
];
const SMUG_BY={};SMUG_ITEMS.forEach(i=>SMUG_BY[i.k]=i);
/** 出海目的地：d 單程旬數（來回合計）、mult 進貨價倍率、items 可買品項。 */
const SMUG_DEST={
  nagasaki:{name:'長崎外海·唐船',d:5, mult:1.0,items:['wine','glass','herb']},
  ryukyu:  {name:'琉球·那霸',     d:7, mult:0.9,items:['cloth','herb','glass']},
  siam:    {name:'阿瑜陀耶（暹羅）',d:12,mult:0.8,items:['opium','cloth','wine']}
};
/** 單趟載量、密庫容量。 */
const SMUG_CAP=60,CONTRA_CAP=300;

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
    if(chance(v.risk)){
      const lost=Math.round(v.qty*0.7);v.qty-=lost;
      const t=NEWS('smugTick.1',{name:SMUG_DEST[v.dest].name,name2:it.name,lost});pushNews(t);log.push(t);sfx.bad();
    }
    const SZ_=ODDS.smugSeize,pSeize=clamp(SZ_.perDanger*it.danger+SZ_.perHeat*(G.heat||0)-((G.flags.blind>0)?SZ_.blind:0),SZ_.min,SZ_.max);
    if(v.qty>0&&chance(pSeize)){
      const t=NEWS('smugTick.2',{name:it.name,qty:v.qty});pushNews(t);log.push(t);sfx.bad();
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
      const t=NEWS('smugTick.5',{name:it.name,q,q2:(q<v.qty?'（密庫已滿，'+(v.qty-q)+' 單位被迫丟棄）':'')});pushNews(t);log.push(t);sfx.coin();
    }
  });
  G.smug=smugList().filter(v=>!done.includes(v));
}

/** 本旬被搜查的機率：風聲、密庫現值、仇人舉報提高；打點同心、免檢旗降低。 */
function raidChance(){
  const held=contraQty()>0;
  if(!held&&(G.heat||0)<ODDS.raid.minHeat)return 0;
  const Q_=ODDS.raid;let p=Q_.base+Q_.perHeat*Math.min(G.heat||0,Q_.heatCap)+Math.min(Q_.contraCap,contraValue()/3000*Q_.perContraValue)+Q_.perEnemy*enemyCount();
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
  const boss=G.emps.find(e=>e.rank==='大番頭');
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
    G.raidNote={tier:0,title:'同心睜一隻眼',lines:[t]};return;
  }
  const S=V/1500+(G.heat||0)/6+(held?0.6:0)-jb/60+rnd()+(kind==='testimony'?0.8:0);
  const had=Object.keys(contra()).filter(k=>contra()[k]>0);
  const maxDanger=had.reduce((a,k)=>Math.max(a,SMUG_BY[k].danger),0);
  const seize=()=>{const n=contraQty();G.contra={};return n};
  let title,t0=S<0.9?1:S<1.9?2:(S<3.2||maxDanger<3)?3:4,lessened=false;
  if((G.lessen||0)>0){G.lessen=0;t0--;lessened=true;lines.push(NEWS('seize.lessen'))}   // 減罪狀：刑罰減輕一等
  if(t0<=0){
    tier=0;title='搜查：沒收了事';
    const n=seize();
    lines.push((n?'密庫貨物 '+n+' 單位全數沒收，':'')+'免於罰銀。');
  }else if(t0===1){
    tier=1;title='搜查：從輕發落';
    const n=seize(),fine=Math.round(Math.max(0,G.silver)*0.05);G.silver-=fine;loseFame('raid1');
    lines.push((n?'密庫貨物 '+n+' 單位全數沒收，':'')+'罰銀 '+fmt(fine)+' 兩，知名度 −'+ODDS.fameLoss.raid1+'。'+(jb>=60?'（與司法官員交情不錯，從輕發落）':''));
  }else if(t0===2){
    tier=2;title='搜查：查封罰款';
    const n=seize(),fine=Math.round(V*0.8+Math.max(0,G.silver)*0.08);G.silver-=fine;loseFame('raid2');
    lines.push((n?'沒收違禁品 '+n+' 單位，':'')+'罰銀 '+fmt(fine)+' 兩，知名度 −'+ODDS.fameLoss.raid2+'。');
  }else if(t0===3){
    tier=3;title='搜查：遠島';
    const n=seize(),fine=Math.round(Math.max(0,G.silver)*0.15),yrs=3+Math.floor(rnd()*(S>2.8?10:6));
    G.silver-=fine;loseFame('raid3');G.exile=yrs;G.ap=0;G.life.scapegoat++;
    lines.push((n?'沒收違禁品 '+n+' 單位，':'')+'罰銀 '+fmt(fine)+' 兩，知名度 −'+ODDS.fameLoss.raid3+'。判處<b>遠島 '+yrs+' 旬</b>：期間無法行動，商號交給大番頭代理（沒有大番頭則每旬虧損）。');
  }else{
    tier=4;title='搜查：處刑';
    lines.push('搜出大宗禁物，罪證確鑿，奉行所判你<b>處刑</b>。');
  }
  const t=NEWS('seize.1',{replace:title.replace('搜查：','搜查·'),g:lines.join('').replace(/<[^>]+>/g,'')});
  pushNews(t);log.push(t);sfx.bad();
  G.heat=Math.max(0,(G.heat||0)-4);
  G.raidNote={tier,title,lines};
  if(tier===4)endLife('executed');
}
/** 旬報最上方的搜查結果卡。 */
function raidCard(){
  const N=G.raidNote;if(!N)return '';
  const cls=N.tier>=3?'warn':'';
  return '<div class="rp-sec">🚨 奉行所搜查</div><div class="card '+cls+'"><b>'+esc(N.title)+'</b>'+N.lines.map(l=>'<div class="small" style="margin-top:4px">'+l+'</div>').join('')+'</div>';
}

/* ---------------- 走私面板（從商路頁進入） ---------------- */
/** 商路頁上的入口按鈕。 */
function smuggleButton(){
  if(!smugCaptain()&&!smugList().length&&!contraQty())return '';        // 要有好感滿格的船長，走私入口才會出現
  const n=smugList().length,q=contraQty();
  return '<div class="card" style="background:#1f1a24;color:#e8dcc4;border-color:#5b4a70"><div class="row"><div><b>🏴‍☠️ 走私</b><div class="tiny" style="color:#b9a8d0">在途 '+n+' 艘·密庫 '+q+' 單位'+((G.exile||0)>0?'·⛓️遠島中':'')+'</div></div><button class="pixel-btn btn-sm btn-gold" data-act="smugOpen">'+UT('btn.smugOpen')+'</button></div></div>';
}
ACT.smugOpen=()=>UI.openSheet('smuggle');
/** 面板狀態：目前選的品項、目的地、數量。 */
const smugSel=()=>{const s=UI.s.smug||(UI.s.smug={dest:'nagasaki',k:'wine',qty:20});const d=SMUG_DEST[s.dest];if(!d.items.includes(s.k))s.k=d.items[0];s.qty=clamp(Math.floor(s.qty)||1,1,SMUG_CAP);return s};

SHEETS.smuggle=()=>{
  const S=smugSel(),d=SMUG_DEST[S.dest],it=SMUG_BY[S.k];
  const p=raidChance(),lv=p<=0?'無':p<0.05?'低':p<0.12?'中':'高';
  const free=idleCaptains('sea').length,cap=smugCaptain();
  let h='<div class="grid3 small" style="text-align:center;margin-bottom:6px"><div class="card" style="margin:0">私房錢<br><b style="color:#b8860b">'+Math.round(G.gold)+' 兩</b></div><div class="card" style="margin:0">空閒船長<br><b>'+Math.max(0,free)+'</b></div><div class="card" style="margin:0">搜查風聲<br><b style="color:'+(p>=0.12?'#b3261e':p>=0.05?'#c18a00':'#1e7e34')+'">'+lv+'</b></div></div>';
  h+='<div class="tiny muted" style="margin-bottom:6px">用私房錢向海外買禁品，船長出海（行動 -1），回來進密庫，再請私梟脫手，收入歸私房錢。被搜到會沒收、罰款，嚴重者遠島、處刑。</div>';
  // 下單
  h+='<div class="card"><b class="small">⛵ 出海採買</b>';
  h+='<div class="row small" style="margin-top:4px"><span>目的地</span><select data-chg="smugDest">'+Object.keys(SMUG_DEST).map(k=>'<option value="'+k+'" '+(k===S.dest?'selected':'')+'>'+SMUG_DEST[k].name+'（'+SMUG_DEST[k].d+' 旬）</option>').join('')+'</select></div>';
  h+='<div class="row small" style="margin-top:4px"><span>品項</span><select data-chg="smugItem">'+d.items.map(k=>'<option value="'+k+'" '+(k===S.k?'selected':'')+'>'+SMUG_BY[k].icon+' '+SMUG_BY[k].name+'</option>').join('')+'</select></div>';
  h+='<div class="row small" style="margin-top:4px"><span>數量（最多 '+SMUG_CAP+'）</span><input type="number" class="inline-input" min="1" max="'+SMUG_CAP+'" value="'+S.qty+'" data-chg="smugQty"></div>';
  const cost=Math.round(it.cost*d.mult*S.qty);
  h+='<div class="row small" style="margin-top:6px"><span>需私房錢 <b>'+cost+'</b> 兩·預計 '+Math.round(smugPrice(S.k,S.qty)*S.qty)+' 兩可賣</span><button class="pixel-btn btn-sm btn-gold" data-act="smugGo" '+(apLeft()<=0?'disabled':'')+'>'+UT('btn.smugGo')+'</button></div>';
  if(!cap)h+='<div class="tiny" style="color:#b3261e;margin-top:3px">沒有好感滿格的空閒船長。到河岸碼頭給船長零用錢，好感滿了才肯走私。</div>';
  h+='</div>';
  // 在途
  if(smugList().length)h+='<div class="small bold">🚢 在途</div>'+smugList().map(v=>'<div class="card"><div class="row"><b class="small">'+SMUG_BY[v.k].icon+' '+SMUG_BY[v.k].name+' × '+v.qty+'</b><span class="tag gray">剩 '+v.eta+' 旬</span></div><div class="tiny muted">往【'+SMUG_DEST[v.dest].name+'】·船長 '+esc(v.captName)+'</div></div>').join('');
  // 密庫
  const ks=Object.keys(contra()).filter(k=>contra()[k]>0);
  h+='<div class="small bold" style="margin-top:6px">🔒 密庫（'+contraQty()+' / '+CONTRA_CAP+'）</div>';
  if(!ks.length)h+='<div class="notice tiny">密庫是空的。</div>';
  else{
    h+=ks.map(k=>{const q=contra()[k],i=SMUG_BY[k];return '<div class="card"><div class="row"><b class="small">'+i.icon+' '+i.name+' × '+q+'</b><span class="tiny muted">本旬'+smugMood(k)+'·'+fmt1(smugPrice(k,1))+' 兩／單位</span></div></div>'}).join('');
    h+='<div class="tiny muted">拜訪交情 60 以上的私梟，打勝後可請他脫手，一次一項、整批全收，收入進私房錢。風聲偏緊時，替你脫過手的私梟可能落網供出你。</div>';
  }
  return {title:'🏴‍☠️ 走私',html:h};
};
CHG.smugDest=el=>{const s=smugSel();s.dest=el.value;refreshSheet()};
CHG.smugItem=el=>{smugSel().k=el.value;refreshSheet()};
CHG.smugQty=el=>{smugSel().qty=+el.value;refreshSheet()};

/** 出海：檢查船、船長、私房錢，扣款派船。 */
ACT.smugGo=()=>{
  if((G.exile||0)>0){toast(MSG('smugGo.1'));return}
  const S=smugSel(),d=SMUG_DEST[S.dest],it=SMUG_BY[S.k];
  const cap=smugCaptain();if(!cap){toast(MSG('smugGo.3'));return}
  if(contraQty()+S.qty>CONTRA_CAP){toast(MSG('smugGo.4'));return}
  const cost=Math.round(it.cost*d.mult*S.qty);
  if(G.gold<cost){toast(MSG('smugGo.5',{cost}));return}
  if((G.injured||0)>0){toast(MSG('smugGo.hurt',{injured:G.injured}));return}
  if(!spendAP()){toast(MSG('smugGo.ap'));return}     // 走私出海也要親自到碼頭交代：扣 1 行動點數
  G.gold-=cost;G.heat=(G.heat||0)+0.3;
  smugList().push({id:G.turn+'_'+Math.floor(rnd()*1e5),k:S.k,qty:S.qty,dest:S.dest,eta:d.d,capt:cap.id,captName:cap.name,risk:clamp(ODDS.smugRisk.p*d.d*crewRiskMult(cap),ODDS.smugRisk.min,ODDS.smugRisk.max)});
  sfx.step();toast(MSG('smugGo.6',{name:cap.name,d:d.d}));
  UI.render();refreshSheet();
};
/** 被捕者供出主使的機率（忠誠越高越不會招）。 */
const confessP=loyal=>clamp(ODDS.confess.base-loyal/ODDS.confess.loyalDiv,ODDS.confess.min,ODDS.confess.max);
