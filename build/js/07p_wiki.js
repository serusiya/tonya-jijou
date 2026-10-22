'use strict';
/* ★檔案總覽：筆記內的「百科」分頁（線上遊戲百科全書）
 * - 玩法簡介、官吏架構、地區城市與物產、物產圖鑑；內容多半取自資料檔（OFFICIALS／CITIES／COMM_INFO），玩法簡介文字在 WIKI_GUIDE。
 * - 筆記頁頂端有「名冊／百科」切換；renderNotes（07_ui_people.js）在百科模式下改呼叫 renderWiki。 */
/* ======================= 07p 百科 ======================= */
const WIKI_SECS=[['guide','📖 玩法'],['office','🏛️ 官吏'],['region','🗺️ 城市'],['goods','📦 物產']];
/** 玩法簡介：[標題, 內文 HTML]（敘事式說明，不列公式）。 */
const WIKI_GUIDE=[
  ['🏮 你是誰、要做什麼','你是江戶中盤的一名「問屋」（批發商）。從一間小商號起家，向產地與同行進貨、賣給城裡的零售與工坊，累積現款、聲望與人脈。年歲漸長，家業要傳給後人——每一代都有一生的故事，最後留下什麼，由你決定。'],
  ['📅 時間與行動','一個月分三旬，一年十二個月。每旬你有固定的行動點數，用來拜訪、請託、辦事；用完也可以直接「推進一旬」。推進時，預定的出貨與進貨會自動辦理，接著日期前進，旬報會告訴你這一旬的收支與大事。'],
  ['📊 大盤買賣','大盤的價格不能自訂，你只能決定出貨多少。總出貨越多，價格越低；而「總出貨」包含全城同業的出貨，同業偶爾還會大舉超賣。這些影響不會一旬就消失，約要三個月（九旬）才完全淡去，所以分批出貨比一次倒完划算。向大盤進貨的價格略低於市價，但每旬能進的量很有限——光靠大盤進出，大致只是打平；真正的利潤來自商路從產地運入。本業最貴的兩項貨，要先向財務官員取得「交易許可」才能買賣。'],
  ['⚖️ 問屋公會（株仲間）','每三個月開一次例會。你可以表態遵守配額（公會會幫你穩住行情），或簽暗約偷跑（賺得快，但被發現後果嚴重），也可以提案提高配額。誓言守配額卻超量出貨，會被聯合斷貨。大番頭可以代你出席例會。'],
  ['🚢 商路與產地','貨物可以從產地運入本城：走海路需要進港泊位許可與一名船長（一名船長帶一艘船，聘船長時另付造船費），走陸路需要關所通行手形與一名飛腳（一名飛腳帶一支馬幫）。運費、關稅、天候與盜賊都是風險。產地的貨便宜很多，但運量有限、要等上幾旬。'],
  ['🤝 人脈','官吏、同業、名士、花街名伶，都靠一次次拜訪結識。沒有介紹人就貿然登門，常吃閉門羹。每次拜訪都是一場攻心之戰：先挑一份投其所好的禮物（猜中對方的軟肋，心意才算數），見了面再表示心意，身份越高，要花的錢越多。對方高興了，交情就深一層；交情到了 60，就是自己人，禮物不再計較，官吏也才肯聽你開口請託。請託要花人情，辦成後交情會淡一些。承諾過的事一定要兌現，逾期會傷交情。'],
  ['👥 店員','丁稚替你跑腿拜訪；手代在店頭，讓出貨價略好一點；番頭管採購，可向大盤進更多貨；大番頭是總管，能代你管進貨、出席例會、每旬自動問候人脈，也能壓住其他店員的歪念。店員也會動手腳，要記得查帳。保鏢平時守倉庫，出門時護著你。每種店員一開始都只能雇一名，要多雇得先向官府申請許可。'],
  ['🏛️ 官府','城裡有行政、財務、司法三院，上面還有管整個地區的遠國奉行所。他們掌管許可、稅賦、查緝與審判：行政院核發倉地、船株與人別帳，財務院核發交易許可、馬幫株並放貸，司法院核發帶刀許可、袖之下與減罪狀。許可分等級，官階越高的官員給得越多。官吏有各自的性格與弱點，打通關節能少很多麻煩，但也有人會反過來勒索。詳見「官吏」分頁。'],
  ['⚠️ 風險與事件','倉庫會失火、遭竊、受潮；主食價格漲得太高會引發「打毀」（市民暴動）；走私被查獲會罰銀、遠島，甚至處刑（減罪狀能讓刑罰輕一等）；醜聞會損傷知名度。同行也會鬥——有人造謠、栽贓、縱火，你也可以反擊。貨越值錢，持有的成本與風險越高。'],
  ['💎 奢侈品','每個行業最多只有一兩種奢侈品。它們的買家來去無常：可能整整幾年沒有人問津，然後某一天大名與豪商一擁而上，一次買光。囤貨要付保管費與冒失竊的風險，賭的就是那一天的到來。'],
  ['🌸 花街與名流','吉原花街是人脈的重地：名伶是紅顏知己，也是消息來源。這裡的往來要小心分寸，否則風評與家庭都會受影響。'],
  ['🏯 家業傳承','你的一生有盡頭。後繼者的資質、你累積的人脈與家業，決定下一代的起點。沒有後繼，家業便就此終結。']
];
/** 筆記頂端的「名冊／百科」切換。 */
function notesTabsHtml(){
  const t=UI.s.notesTab||'book';
  return '<div style="margin-bottom:6px">'+[['book','📜 名冊'],['wiki','📖 百科']].map(([k,n])=>'<span class="pill '+(t===k?'on':'')+'" data-act="nTab" data-k="'+k+'">'+n+'</span>').join('')+'</div>';
}
ACT.nTab=el=>{UI.s.notesTab=el.dataset.k;UI.render();$('#main').scrollTop=0};
ACT.wikiSec=el=>{UI.s.wikiSec=el.dataset.k;UI.render();$('#main').scrollTop=0};
ACT.wikiToggle=el=>{UI.s.wikiOpen=UI.s.wikiOpen||{};const k=el.dataset.k;UI.s.wikiOpen[k]=!UI.s.wikiOpen[k];UI.render()};
ACT.mapCity=el=>{UI.s.mapSel=el.dataset.cid;UI.s.wikiOpen=UI.s.wikiOpen||{};UI.s.wikiOpen['c'+el.dataset.cid]=true;UI.render()};
ACT.wikiRegion=el=>{UI.s.wikiRegion=el.dataset.id;UI.s.mapSel=null;UI.render();$('#main').scrollTop=0};
/** 可展開的區塊。 */
function wikiBox(k,title,body,tag){
  const o=UI.s.wikiOpen&&UI.s.wikiOpen[k];
  return '<div class="card" style="margin-top:5px"><div class="row" data-act="wikiToggle" data-k="'+esc(k)+'" style="cursor:pointer"><b class="small">'+title+'</b><span class="tiny muted">'+(tag?tag+' ':'')+(o?'▲':'▼')+'</span></div>'+(o?'<div class="small" style="margin-top:4px;line-height:1.6" data-act="none">'+body+'</div>':'')+'</div>';
}
/** 各地區：id→{id,name,cities}。 */
function wikiRegions(){
  const m={},order=[];
  CITIES.forEach(c=>{if(!m[c.region_id]){m[c.region_id]={id:c.region_id,name:c.region_name,cities:[]};order.push(c.region_id)}m[c.region_id].cities.push(c)});
  return order.map(id=>m[id]);
}
function wikiGuide(){
  let h='<div class="notice tiny">這裡是遊戲的百科。點標題展開說明。</div>';
  h+=WIKI_GUIDE.map((g,i)=>wikiBox('g'+i,g[0],esc(g[1]))).join('');
  h+=wikiBox('gsys','🏪 七種問屋流派','<div class="tiny muted">開局時選擇的流派決定本業貨品、起手資源與玩法側重。</div>'+SYS.map(s=>'<div style="margin-top:5px"><b>'+esc(s.name)+'</b> <span class="tag gray">'+esc(s.style)+'</span><div class="tiny">'+esc(s.tip)+'</div></div>').join(''));
  return h;
}
function wikiOffice(){
  const O=OFFICIALS;
  let h='<div class="notice tiny">'+esc(O.description)+'</div>';
  h+=wikiBox('orank','🎖️ 六階官階','<div class="tiny muted">官階越高，權力越大，也越難結交。</div>'+O.ranks.map(r=>'<div style="margin-top:4px"><b>'+esc(r.title)+'</b><div class="tiny">'+esc(r.influence)+'</div></div>').join(''));
  Object.keys(O.systems).forEach(ct=>{
    const sys=O.systems[ct],rk={};sys.positions.forEach(p=>{(rk[p.rank]=rk[p.rank]||[]).push(p)});
    const body='<div class="tiny"><b>官署</b>　'+esc(sys.department)+'</div><div class="tiny" style="margin-top:3px">'+esc(sys.core_function)+'</div><div class="tiny" style="margin-top:3px"><b>與商人的關係</b>　'+esc(sys.merchant_interaction)+'</div>'
      +Object.keys(rk).sort((a,b)=>a-b).map(r=>{const ri=RANK_INFO[r];return '<div class="tiny muted" style="margin-top:5px">'+esc(ri?ri.title:'官階'+r)+'</div>'+rk[r].map(p=>'<span class="pill" data-act="posInfo" data-id="'+p.id+'">'+esc(p.title)+'</span>').join('')}).join('');
    h+=wikiBox('o'+ct,esc(sys.name),body,sys.positions.length+' 職');
  });
  h+='<div class="tiny muted" style="margin-top:6px">點職位名稱可查看職掌、可能的貪腐破口與升遷路線。</div>';
  return h;
}
function cityLine(ct){
  const home=ct.id===G.cityId;
  const open=UI.s.wikiOpen&&UI.s.wikiOpen['c'+ct.id];
  let h='<div class="card" style="margin-top:4px;'+(home?'border-color:#9b2c3a':'')+'"><div class="row" data-act="wikiToggle" data-k="c'+ct.id+'" style="cursor:pointer"><div><b>'+esc(ct.name)+'</b>'+(home?' <span class="tag red">駐節</span>':'')+' <span class="tag gray">'+esc(ct.location_type)+'</span></div><span class="tiny muted">約 '+fmt(parseInt(ct.population,10)||0)+' 人 '+(open?'▲':'▼')+'</span></div>';
  h+='<div class="tiny" style="margin-top:2px">物產：'+(ct.connected_commodities.length?ct.connected_commodities.map(n=>{const c=COMM_MAP[n];return c?'<span class="tag clk" data-act="commInfo" data-n="'+esc(n)+'">'+esc(c.short.slice(0,6))+'</span>':''}).join(' '):'無特別物產')+'</div>';
  if(open){
    const f=ct.special_festival||{},sr=ct.seasonal_annual_rhythms||{},hist=(ct.history_100_years||[]).slice(0,3);
    h+='<div class="small" style="margin-top:5px;line-height:1.6" data-act="none"><div>'+esc(ct.geography_description)+'</div>'
      +(f.name?'<div style="margin-top:4px"><b>節慶：'+esc(f.name)+'</b>（'+esc(f.date)+'）<div class="tiny">'+esc(f.cultural_lore)+'</div><div class="tiny">'+esc(f.economic_impact)+'</div></div>':'')
      +'<div style="margin-top:4px"><b>四季</b>'+[['spring','春'],['summer','夏'],['autumn','秋'],['winter','冬']].map(([k,n])=>sr[k]?'<div class="tiny">'+n+'：'+esc(sr[k])+'</div>':'').join('')+'</div>'
      +(hist.length?'<div style="margin-top:4px"><b>城史</b>'+hist.map(x=>'<div class="tiny">'+esc(x.year)+'：'+esc(x.title)+'</div>').join('')+'</div>':'')+'</div>';
  }
  return h+'</div>';
}
function wikiRegion(){
  const R_=wikiRegions();
  let id=UI.s.wikiRegion;if(!R_.some(r=>r.id===id))id=(CITY(G.cityId)||{}).region_id||R_[0].id;
  const r=R_.find(x=>x.id===id),types={},goods={};
  r.cities.forEach(c=>{types[c.location_type]=(types[c.location_type]||0)+1;c.connected_commodities.forEach(n=>goods[n]=(goods[n]||0)+1)});
  const top=Object.entries(goods).sort((a,b)=>b[1]-a[1]).slice(0,10);
  let h='<div>'+R_.map(x=>'<span class="pill '+(x.id===id?'on':'')+'" data-act="wikiRegion" data-id="'+x.id+'">'+esc(x.name)+'</span>').join('')+'</div>';
  h+='<div class="card" style="margin-top:5px"><b>'+esc(r.name)+'</b> <span class="tag gray">'+r.cities.length+' 城</span><div class="tiny" style="margin-top:3px">地形：'+Object.entries(types).map(([k,v])=>esc(k)+' '+v).join('、')+'</div>'
    +'<div class="tiny" style="margin-top:3px">主要物產：'+top.map(([n,v])=>{const c=COMM_MAP[n];return c?'<span class="tag clk" data-act="commInfo" data-n="'+esc(n)+'">'+esc(c.short.slice(0,6))+'</span>':''}).join(' ')+'</div></div>';
  const sel=UI.s.mapSel&&r.cities.find(c=>c.id===UI.s.mapSel);
  h+='<div class="pixel-box" style="padding:4px;margin-top:5px;overflow:hidden">'+regionMapSvg(id,{home:G.cityId,sel:sel&&sel.id})+'<div class="tiny muted" style="margin-top:3px">紅色名牌＝本店駐節城。天守閣＝行政都市，礦山＝礦產，帆船＝港口要衝，關門＝陸路要衝，茅屋＝農林。'+(id==='reg_south'?'紅色虛線為海路。':'朱紅線為街道，黑點為里程。')+'點城市可看詳情。</div></div>';
  if(sel)h+=cityLine(sel);
  h+=r.cities.filter(c=>!sel||c.id!==sel.id).slice().sort((a,b)=>(parseInt(b.population,10)||0)-(parseInt(a.population,10)||0)).map(cityLine).join('');
  return h;
}
function wikiGoods(){
  const by={};COMM.forEach(c=>{(by[c.sys]=by[c.sys]||[]).push(c)});
  let h='<div class="notice tiny">點物品查看說明（產地、季節、損耗、管制與公會）。</div>';
  SYS.forEach(s=>{
    const list=by[s.key]||[];if(!list.length)return;
    const body=list.slice().sort((a,b)=>a.base-b.base).map(c=>{const n=(CITIES.filter(ct=>ct.connected_commodities.includes(c.name)).length);return '<div class="row tiny" style="margin-top:3px" data-act="commInfo" data-n="'+esc(c.name)+'"><span><span class="tag clk">'+esc(c.short.slice(0,8))+'</span> <span class="tag '+(c.luxury?'gold':c.staple?'green':'gray')+'">'+c.kind+'</span></span><span class="muted">基準 '+fmt1(c.base)+' 兩·產地 '+n+' 城</span></div>'}).join('');
    h+=wikiBox('s'+s.key,esc(s.name)+' 的貨品',body,list.length+' 種');
  });
  return h;
}
/** 百科主畫面。 */
function renderWiki(){
  const sec=UI.s.wikiSec||'guide';
  let h='<div class="pixel-box" style="padding:8px">'+notesTabsHtml()+'<div class="row" style="border-bottom:1px solid #b5a98f;padding-bottom:5px"><div><b>📖 遊戲百科</b><div class="tiny muted">玩法、官府、各地城市與物產的總覽。</div></div></div>';
  h+='<div style="margin-top:6px">'+WIKI_SECS.map(([k,n])=>'<span class="pill '+(sec===k?'on':'')+'" data-act="wikiSec" data-k="'+k+'">'+n+'</span>').join('')+'</div>';
  h+='<div style="margin-top:4px">'+({guide:wikiGuide,office:wikiOffice,region:wikiRegion,goods:wikiGoods}[sec]||wikiGuide)()+'</div></div>';
  $('#view-notes').innerHTML=h;
}
