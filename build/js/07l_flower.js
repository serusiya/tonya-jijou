/* ======================= 吉原花街：夜宴、指名名伶、贖身成側室 =======================
 * 規則：
 *  - 城中名伶固定 8 人，每旬只有 4 人在席（以旬數雜湊決定，同一旬內固定）。
 *  - 包場花金夜宴：私房錢 80 兩，不扣行動點數，每旬一次；席間 1～3 名官吏／商人好感 +3～5，直接算結識，各講一句謝詞。
 *  - 指名：私房錢 20 兩，好感 +5；2 旬沒再指名，好感 -4（最低 1）。每次指名只能送一件禮物，花私房錢且價格加倍，好感 +5～10 並透露一人軟肋。
 *  - 好感滿（100）可贖身：約 1000 兩（±100）。贖後為側室，與家人無異，不能生育。
 *  - 吉原累計花費每滿 200 兩，知名度 -0.5。 */
const FL_STAGE=4,FL_TOTAL=8,FL_UNIT=200;
function FL(){return G.flower||(G.flower={feast:-99,spent:0})}
/** 記錄吉原花費；每滿 200 兩扣 0.5 知名度。回傳附加在訊息後的說明。 */
function flowerSpend(x){
  const F=FL();F.spent+=x;const k=Math.floor(F.spent/FL_UNIT);
  if(k<=0)return '';
  F.spent-=FL_UNIT*k;const fl=loseFame('flowerPer200',k);return '（吉原揮霍，風評受損'+(fl?'，知名度 -'+fl:'')+'）';
}
const hshStr=s=>{let h=7;for(const ch of String(s))h=(h*131+ch.charCodeAt(0))>>>0;return h};
const oiranAll=cityId=>cityNpcs(cityId||G.cityId,'oiran');
/** 今旬在席的 4 位名伶（同一旬固定）。 */
function oiranOnStage(cityId){
  const id=cityId||G.cityId;
  return oiranAll(id).map(n=>[hshStr(n.cid+'@'+G.turn+'@'+id),n]).sort((a,b)=>a[0]-b[0]).slice(0,FL_STAGE).map(x=>x[1]);
}
/** 補足某城名伶至 8 人（開局、讀舊檔、名伶病逝／贖身後）。 */
function topUpOiran(W,cityId,year,excl){
  const ok=n=>{const c=CH(n.cid);return c&&c.birth_year<=year&&c.death_year>year};
  const cur=Object.values(W.npcs).filter(n=>n.cityId===cityId&&n.role==='oiran'&&ok(n)).length;
  if(cur>=FL_TOTAL)return;
  const ex=new Set(excl||[]);
  let pool=CHARS.filter(c=>!W.npcs[c.id]&&!ex.has(c.id)&&c.birth_year<=year-16&&c.death_year>year+2);
  const a=pool.filter(c=>hasRole(c,'oiran')),b=pool.filter(c=>c.gender==='女'&&c.birth_year>=year-40&&!hasRole(c,'oiran'));
  const sh=l=>l.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(x=>x[1]);
  sh(a).concat(sh(b)).slice(0,FL_TOTAL-cur).forEach(c=>{W.npcs[c.id]={cid:c.id,cityId,role:'oiran',pos:null}});
}
/** 每旬：名伶補額；久未指名的名伶好感下降。 */
function oiranTick(log){
  topUpOiran(G.world,G.cityId,G.year,(G.family.conc||[]).map(x=>x.cid));
  oiranAll().forEach(n=>{
    const r=R(n.cid);if(!r.bond||r.aff<=1)return;
    if(r.nomT===undefined)r.nomT=G.turn;
    const last=Math.max(r.nomT,r.decT===undefined?-99:r.decT);
    if(G.turn-last>=2){r.aff=Math.max(1,r.aff-4);r.decT=G.turn}
  });
}

/** 送名伶的禮：10 種首飾與化妝品，基本價 100～300 兩（指名後再 ×2）。 */
const OIRAN_GIFTS=[['o1','📿'],['o2','🎨'],['o3','💄'],['o4','🧴'],['o5','🖌️'],['o6','🪮'],['o7','🪞'],['o8','🟠'],['o9','💍'],['o10','🌺']].map(([k,icon])=>({k,icon,name:COSTS['oiranGift_'+k].name.replace('名伶禮物：',''),base:COSTS['oiranGift_'+k].amt}));
const OG_MAP={};OIRAN_GIFTS.forEach(g=>OG_MAP[g.k]=g);
/* ---------- 名伶卡片 ---------- */
function oiranBlock(cid){
  const c=CH(cid),r=R(cid);
  autoIntro(cid);const via=(G.introId&&introOf(G.introId))?1:0;
  const locked=!r.bond&&meetTierNeed(cid)>fameTier()+via;
  const nom=r.nomT===G.turn;
  let h='<div class="card'+(locked?' locked':'')+'" data-cid="'+cid+'">'+portraitBtn(cid,56);
  h+='<div class="row"><div><b>'+esc(c.name)+'</b> <span class="tag" style="background:#f6d5e1;color:#a2315f">🌸 名伶</span></div></div>';
  h+='<div class="tiny muted" style="margin:2px 0">'+esc(c.family_summary.slice(0,46))+'……</div>';
  if(locked)return h+'<div class="tiny" style="color:#b3261e">🔒 她身價甚高，以你眼下的名氣還指名不到。</div></div>';
  if(r.bond){
    h+='<div class="row small"><span>好感：<span class="tag '+affCls(r.aff)+'">'+affWord(r.aff)+'</span> '+Math.round(r.aff)+'／100</span><div style="width:90px">'+bar(r.aff,100,'gold')+'</div></div>';
    h+='<div class="tiny muted">'+(r.nomT!==undefined?'上回指名在 '+(G.turn-r.nomT)+' 旬前。':'')+'每 2 旬沒再指名，好感 -4（最低 1）。</div>';
  }else h+='<div class="tiny muted">素昧平生。第一次指名，即算相識。</div>';
  h+='<div style="margin-top:4px"><button class="pixel-btn btn-sm btn-gold" style="width:100%" data-act="nomOiran" data-cid="'+cid+'" '+(nom?'disabled':'')+'>'+(nom?UT('btn.nomDone'):UT('btn.nom',{c:costTxt('nominate')}))+'</button></div>';
  if(nom){
    if(r.oGiftT===r.nomT)h+='<div class="tiny muted" style="margin-top:4px">這次指名已經送過禮了，下次指名才能再送。</div>';
    else{
      h+='<div class="row" style="gap:4px;margin-top:4px"><span class="tiny">送禮（私房錢，花費加倍）</span><select class="og-sel" style="flex:1;font-size:11px">'+OIRAN_GIFTS.map(g=>'<option value="'+g.k+'">'+g.icon+' '+g.name+'（'+costTxt('oiranGift_'+g.k,COSTS.oiranGiftMul.amt)+'）</option>').join('')+'</select></div>';
      h+='<div style="margin-top:3px"><button class="pixel-btn btn-sm" style="width:100%" data-act="oGift" data-cid="'+cid+'">'+UT('btn.oGift')+'</button></div>';
    }
  }
  if(r.bond&&r.aff>=100){
    const price=r.ransom||(r.ransom=costOf('ransom')+rint(-100,100));
    h+='<div style="margin-top:4px"><button class="pixel-btn btn-sm btn-green" style="width:100%" data-act="ransom" data-cid="'+cid+'">'+UT('btn.ransom',{c:fmt(price)})+'</button></div>';
  }
  return h+'</div>';
}
ACT.nomOiran=el=>{
  const cid=el.dataset.cid,n=npc(cid),r=R(cid);
  if(!n||n.role!=='oiran')return;
  if(isEnemy(cid)){toast(MSG('nomOiran.1'));return}
  if(!oiranOnStage().some(x=>x.cid===cid)){toast(MSG('nomOiran.2'));return}
  if(r.nomT===G.turn){toast(MSG('nomOiran.3'));return}
  autoIntro(cid);if(!r.bond&&meetTierNeed(cid)>fameTier()+((G.introId&&introOf(G.introId))?1:0)){toast(MSG('nomOiran.4'));return}
  if(!afford('nominate')){toast(shortMsg('nominate'));return}
  const note=flowerSpend(spend('nominate'));
  if(!r.bond){r.bond={mult:1,label:'花街指名',introId:null};r.met=true;r.seen=true;addKnown(cid);if(!r.fameGot){r.fameGot=true;addFame(0.6)}}
  r.aff=clamp(r.aff+5,0,100);r.nomT=G.turn;r.decT=G.turn;
  logRel(cid,'於吉原指名，好感 +5。');sfx.gift();
  toast(MSG('nomOiran.5',{cid:nameOf(cid),aff:Math.round(r.aff),note}),3600);
  UI.render();refreshSheet();
};
ACT.oGift=el=>{
  const cid=el.dataset.cid,r=R(cid),card=el.closest('.card'),g=OG_MAP[card.querySelector('.og-sel').value];
  if(!g||r.nomT!==G.turn){toast(MSG('oGift.1'));return}
  if(r.oGiftT===r.nomT){toast(MSG('oGift.3'));return}
  const gk='oiranGift_'+g.k,cost=costOf(gk,COSTS.oiranGiftMul.amt);
  if(!affordAmt(gk,cost)){toast(shortMsg(gk,COSTS.oiranGiftMul.amt));return}
  spendAmt(gk,cost);r.oGiftT=r.nomT;const note=flowerSpend(cost);
  const gain=rint(5,10);r.aff=clamp(r.aff+gain,0,100);r.gifts++;G.life.gifts++;addFame(0.15);
  const cand=cityNpcs(G.cityId).filter(m=>m.cid!==cid&&!['guard','oiran'].includes(m.role)&&!R(m.cid).verified);
  let tip=TX('flower.tipNone');
  if(cand.length){const m=pick(cand);R(m.cid).verified=true;addKnown(m.cid);tip=TX('flower.tip',{n:nameOf(m.cid),w:CH(m.cid).weakness});logRel(m.cid,'經吉原名伶「'+nameOf(cid)+'」透露，得知其軟肋：'+CH(m.cid).weakness+'。')}
  logRel(cid,'贈「'+g.name+'」，好感 +'+gain+'。');sfx.gift();
  toast(MSG('oGift.2',{name:g.name,gain,tip,note}),5200);
  UI.render();refreshSheet();
};
ACT.ransom=el=>{
  const cid=el.dataset.cid,r=R(cid),n=npc(cid);
  if(!n||n.role!=='oiran')return;
  if(r.aff<100){toast(MSG('ransom.1'));return}
  const price=r.ransom||(r.ransom=costOf('ransom')+rint(-100,100));
  if(!affordAmt('ransom',price)){toast(MSG('ransom.2',{price:fmt(price)}));return}
  spendAmt('ransom',price);const note=flowerSpend(price);
  const name=nameOf(cid);
  (G.family.conc=G.family.conc||[]).push({cid,name,since:G.turn});
  delete G.world.npcs[cid];r.ransomed=true;G.fame=clamp((G.fame||0)+20,0,ODDS.fame.cap);
  pushNews(NEWS('ransom.1',{name:G.me.name,name2:name}));
  logRel(cid,'由你贖身，成為側室。');sfx.fanfare();
  toast(MSG('ransom.3',{name,note}),5200);
  UI.render();refreshSheet();sceneSync&&sceneSync(true);
};

/* ---------- 花金夜宴 ---------- */
ACT.feast=()=>{
  const F=FL();
  if(F.feast===G.turn){toast(MSG('feast.1'));return}
  if(!afford('feast')){toast(shortMsg('feast'));return}
  const pool=cityNpcs(G.cityId).filter(n=>!isEnemy(n.cid)&&((n.role==='official'&&n.pos&&n.pos.court!=='region')||['rival','guest','broker'].includes(n.role)));
  F.feast=G.turn;G.heat+=0.5;addFame(0.3);const note=flowerSpend(spend('feast'));
  playFx('walk',MSG('feast.fx'),MSG('feast.fxTitle'),()=>{
    if(!pool.length){toast(MSG('feast.2',{note}));UI.render();refreshSheet();return}
    const guests=shuffle(pool.slice()).slice(0,rint(1,3));
    let h='<div class="notice tiny">席間賓客盡歡，彼此都記住了你的款待。</div>';
    guests.forEach(n=>{
      const r=R(n.cid),gain=rint(3,5);
      if(!r.bond){r.bond={mult:0.8,label:'花街結識',introId:null};r.met=true;r.seen=true;if(!r.fameGot){r.fameGot=true;addFame(n.pos?0.8:0.4)}}
      addKnown(n.cid);r.aff=clamp(r.aff+gain,0,100);logRel(n.cid,'吉原夜宴上結識，好感 +'+gain+'。');
      const lk=n.role==='official'?'flower.thanksOfficial':'flower.thanksMerchant';
      h+='<div class="card" style="display:flow-root">'+portraitHtml(n.cid,40)+'<b>'+esc(nameOf(n.cid))+'</b> <span class="tag gray">'+esc(ROLE_LABEL[n.role]||'')+'</span> <span class="tag green">好感 +'+gain+'</span><div class="small" style="margin-top:3px">「'+esc(TX(lk))+'」</div></div>';
    });
    if(note)h+='<div class="tiny" style="color:#b3261e">'+esc(note)+'</div>';
    sfx.gift();UI.showInfo('🏮 花金夜宴·'+guests.length+' 位賓客',h);UI.render();refreshSheet();
  },1000);
};

/* ---------- 吉原面板 ---------- */
SHEETS.flower=()=>{
  const F=FL(),stage=oiranOnStage(),total=oiranAll().length,done=F.feast===G.turn;
  let h='<div class="notice tiny">吉原花街是官商私相授受的隱秘之地。夜宴可廣結官商，指名名伶則是長線投資——好感滿了還能贖身。<b>在吉原花的錢每累計 200 兩，知名度 -0.5</b>（目前累計 '+Math.round(F.spent)+'／'+FL_UNIT+'）。</div>';
  h+='<div class="card"><div class="row"><div><b>🏮 包場花金夜宴</b><div class="tiny muted">'+costTxt('feast')+'，不耗行動點數，每旬一次。席間 1～3 位官吏或商人與你結識，好感 +3～5，並使風聲稍緊。</div></div><button class="pixel-btn btn-gold btn-sm" data-act="feast" '+(done?'disabled':'')+'>'+UT(done?'btn.feastDone':'btn.feast')+'</button></div></div>';
  h+=introSel();
  h+='<div class="small bold" style="margin:4px 0">🌸 今旬在席名伶（'+stage.length+'／本城 '+total+' 位）</div>'+(stage.map(n=>oiranBlock(n.cid)).join('')||'<div class="tiny muted">今夜無名伶出席。</div>');
  return {title:'🌸 吉原花街·名樓雅閣',html:h};
};
