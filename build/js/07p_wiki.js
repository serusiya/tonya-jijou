'use strict';
/* ★檔案總覽：筆記內的「百科」分頁（線上遊戲百科全書）
 * - 玩法簡介、官吏架構、地區城市與物產、物產圖鑑；內容多半取自資料檔（OFFICIALS／CITIES／COMM_INFO），玩法簡介文字在 WIKI_GUIDE。
 * - 筆記頁頂端有「名冊／百科」切換；renderNotes（07_ui_people.js）在百科模式下改呼叫 renderWiki。 */
/* ======================= 07p 百科 ======================= */
const WIKI_SECS=[['guide','📖 玩法'],['office','🏛️ 官吏'],['region','🗺️ 城市'],['goods','📦 物產']];
/** 百科官吏頁的「請託規則」（敘事式，不列公式）。 */
const WIKI_REQ='拜訪官員打勝、交情又到了 60，才好趁對方高興開口請託，一次拜訪只能開口一件。三系官署能辦什麼，看系統與官階；遠國奉行所則是每個職位各管一件事。點職位名稱可以查看。開口之後交情會變淡。倉地、船株這類許可要等官府審理：一階小吏一旬就辦好，貪官手腳快，一般與清廉的官員要等久一點。許可取得後永久有效、只升不降，官階越高的官員給得越多，目前最高到四階。借錢、袖之下這類請託，辦過要隔一段時間才能再找同一位官員開口。';
/** 玩法簡介：[標題, 內文 HTML]（敘事式說明，不列公式）。 */
const WIKI_GUIDE=[
  ['🏮 你是誰、要做什麼','你是江戶中盤的一名「問屋」（批發商）。從一間小商號起家，向產地與同行進貨、賣給城裡的零售與工坊，累積現款、聲望與人脈。年歲漸長，家業要傳給後人——每一代都有一生的故事，最後留下什麼，由你決定。'],
  ['📅 時間與行動','一個月分三旬，一年十二個月。每旬你有固定的行動點數，用來拜訪、請託、辦事；用完也可以直接「推進一旬」。推進時，預定的出貨與進貨會自動辦理，接著日期前進，旬報會告訴你這一旬的收支與大事。每旬推進時自動存檔在這個瀏覽器；要換裝置，可以在「設定」匯出存檔，到新裝置的開局畫面匯入。'],
  ['📊 大盤買賣','大盤的價格不能自訂，你只能決定出貨多少。總出貨越多，價格越低；而「總出貨」包含全城同業的出貨，同業偶爾還會大舉超賣。這些影響不會一旬就消失，約要三個月（九旬）才完全淡去，所以分批出貨比一次倒完划算。向大盤進貨的價格略低於市價，但每旬能進的量很有限——光靠大盤進出，大致只是打平；真正的利潤來自商路的委託採買。本業最貴的兩項貨，要先向財務官員取得「交易許可」才能買賣。城市每三個月檢視供貨：九旬全都穩定，人口增加 2%；穩定旬多於不穩定旬，增加 0.6%；反之減少 0.6%，九旬全不穩定則減少 2%。人口改變後，商品需求也會跟著調整。'],
  ['⚖️ 問屋公會（株仲間）','開業時你已是問屋公會成員；公會會員身分不會因你的選擇而消失。會員可以參加「聯合採購與出貨協議」，擔保金由家中長輩代墊。參加協議者向大盤進貨享聯合採購價，進貨上限也有協議配額加給；未參加者照市價，進貨上限只按市占率分配。協議每九旬以各半機率決議「以量制價」或「正常供應」：以量制價依固定比例減供；正常供應則以本城需求為全體總配額，先扣除你等於穩定供貨線的配額，剩餘數量由其他同業依市占率分配。兩種方針都有出貨上限。你可以表態遵守、私下簽暗約偷跑，或退出協議；只有以量制價期間能提案提高減供配額。守約卻超量出貨，或偷跑被告發，都會被聯合斷貨，協議擔保金也會被沒收；同業偷跑被抓也一樣。沒收的擔保金每九旬平分給守約的人。退出或被抓之後，仍是公會會員，但要到下一次例會親自重新押擔保金才能加入協議。大番頭只在你已參加協議時代你出席例會，不會替你重新加入協議。'],
  ['🚢 商路與委託採買','船長或飛腳可以帶著委託金到外地採買：走海路需要該地區的進港泊位許可與一名船長（一名船長帶一艘船，聘船長時另付造船費），走陸路需要本地區的關所通行手形與一名飛腳（一名飛腳帶一支馬幫）。你指定去哪裡、帶多少錢，買什麼由他決定：多半是本業的貨，價錢比大盤便宜，商才越高買得越多越省，當地產好幾樣本業貨時，委託金與運量平均分給每一樣；偶爾帶回別行的便宜貨，要請座客商人代售；派去沒有本業貨的地方，多半空手而回，只花掉雜費；唐物藥種的船隊還常夾帶唐船私貨。可以先把要派的人排進出運清單，再一次全部出發，只要到碼頭交代一趟、扣一次行動；分批出發就每批各扣一次。清單只在本旬有效。路上有海難與山賊，往返要等上幾旬。'],
  ['🤝 人脈','官吏、同業、名士、花街名伶，都靠一次次拜訪結識。沒有介紹人就貿然登門，常吃閉門羹。每次拜訪都是一場攻心之戰：先挑一份投其所好的禮物（猜中對方的軟肋，心意才算數），見了面再表示心意，身份越高，要花的錢越多。對方高興了，交情就深一層；交情到了 60，就是自己人，禮物不再計較，官吏也才肯聽你開口請託。請託要花人情，辦成後交情會淡一些。承諾過的事一定要兌現，逾期會傷交情。'],
  ['👥 店員','丁稚替你跑腿拜訪；手代在店頭，讓出貨價略好一點；番頭管採購，可向大盤進更多貨；大番頭是總管，也和番頭一樣能多進貨，能替你延續上旬的買賣安排、在已參加聯合採購與出貨協議時代你出席公會例會、每旬自動問候人脈，也能壓住其他店員的歪念。店員也會動手腳，要記得查帳。保鏢平時守倉庫，出門時護著你。每種店員一開始都只能雇一名，要多雇得先向官府申請許可。'],
  ['🏛️ 官府','城裡的官員分屬行政、財務、司法三系官署，上面還有管整個地區的遠國奉行所。他們掌管許可、稅賦、查緝與審判：行政系統核發倉地、船株與人別帳，財務系統核發交易許可、馬幫株並放貸，司法系統核發帶刀許可、袖之下與減罪狀。許可分等級，官階越高的官員給得越多。官吏有各自的性格與弱點，打通關節能少很多麻煩，但也有人會反過來勒索。詳見「官吏」分頁。'],
  ['⚠️ 風險與事件','倉庫會失火、遭竊、受潮；主食價格漲得太高會引發「打毀」（市民暴動）；走私被查獲會罰銀、遠島，甚至處刑（減罪狀能讓刑罰輕一等）；醜聞會損傷知名度。同行也會鬥——有人造謠、栽贓、縱火，你也可以反擊。貨越值錢，持有的成本與風險越高。'],
  ['💎 奢侈品','每個行業最多只有一兩種奢侈品。它們的買家來去無常：可能整整幾年沒有人問津，然後某一天大名與豪商一擁而上，一次買光。囤貨要付保管費與冒失竊的風險，賭的就是那一天的到來。'],
  ['🌸 花街與名流','吉原花街是人脈的重地：名伶是紅顏知己，也是消息來源。這裡的往來要小心分寸，否則風評與家庭都會受影響。'],
  ['🏯 人生終章','你只有這一生，家業不傳給下一代。壽終、破產、走私重罪被處刑，或是主動退隱，這一生便落幕；終章會依你的家產、人脈與生平寫下蓋棺評語，還有眾人對你的評價。之後可以重新開始新的人生。']
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
  return '<div class="card" style="margin-top:5px"><div class="row" data-act="wikiToggle" data-k="'+esc(k)+'" style="cursor:pointer"><b class="text-brief">'+title+'</b><span class="text-meta muted">'+(tag?tag+' ':'')+(o?'▲':'▼')+'</span></div>'+(o?'<div class="text-prose" style="margin-top:4px" data-act="none">'+body+'</div>':'')+'</div>';
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
  h+=wikiBox('gsys','🏪 七種問屋流派','<div class="text-meta muted">開局時選擇的流派決定本業貨品、起手資源與玩法側重。越往下，起手資源越多。</div>'+SYS.map(s=>'<div style="margin-top:5px"><b>'+esc(s.name)+'</b> <span class="tag gray">'+esc(s.style)+'</span><div class="text-brief">'+esc(s.tip)+'</div><div class="text-meta muted">起手：'+esc(s.res||s.perk)+'</div></div>').join(''));
  return h;
}
function wikiOffice(){
  const O=OFFICIALS;
  let h='<div class="notice tiny">'+esc(O.description)+'</div>';
  h+=wikiBox('orank','🎖️ 六階官階','<div class="text-meta muted">官階越高，權力越大，也越難結交。</div>'+O.ranks.map(r=>'<div style="margin-top:4px"><b>'+esc(r.title)+'</b><div class="text-brief">'+esc(r.influence)+'</div></div>').join(''));
  h+=wikiBox('oreq','📜 請託規則','<div class="text-brief">'+esc(WIKI_REQ)+'</div>');
  Object.keys(O.systems).forEach(ct=>{
    const sys=O.systems[ct],rk={};sys.positions.forEach(p=>{(rk[p.rank]=rk[p.rank]||[]).push(p)});
    const body='<div class="text-brief"><b>官署</b>　'+esc(sys.department)+'</div><div class="text-brief" style="margin-top:3px">'+esc(sys.core_function)+'</div><div class="text-brief" style="margin-top:3px"><b>與商人的關係</b>　'+esc(sys.merchant_interaction)+'</div>'
      +Object.keys(rk).sort((a,b)=>a-b).map(r=>{const ri=RANK_INFO[r];return '<div class="text-meta muted" style="margin-top:5px">'+esc(ri?ri.title:'官階'+r)+'</div>'+rk[r].map(p=>'<span class="pill" data-act="posInfo" data-id="'+p.id+'">'+esc(p.title)+'</span>').join('')}).join('');
    h+=wikiBox('o'+ct,esc(sys.name),body,sys.positions.length+' 職');
  });
  h+='<div class="tiny muted" style="margin-top:6px">點職位名稱可查看職掌、能辦的請託與升遷路線。</div>';
  return h;
}
function cityLine(ct){
  const home=ct.id===G.cityId;
  const open=UI.s.wikiOpen&&UI.s.wikiOpen['c'+ct.id];
  let h='<div class="card" style="margin-top:4px;'+(home?'border-color:#9b2c3a':'')+'"><div class="row" data-act="wikiToggle" data-k="c'+ct.id+'" style="cursor:pointer"><div><b>'+esc(ct.name)+'</b>'+(home?' <span class="tag red">駐節</span>':'')+' <span class="tag gray">'+esc(ct.location_type)+'</span></div><span class="tiny muted">約 '+fmt(cityPop(ct))+' 人 '+(open?'▲':'▼')+'</span></div>';
  h+='<div class="tiny" style="margin-top:2px">物產：'+(ct.connected_commodities.length?ct.connected_commodities.map(n=>{const c=COMM_MAP[n];return c?'<span class="tag clk" data-act="commInfo" data-n="'+esc(n)+'">'+esc(c.short.slice(0,6))+'</span>':''}).join(' '):'無特別物產')+'</div>';
  if(open){
    const f=ct.special_festival||{},sr=ct.seasonal_annual_rhythms||{},hist=(ct.history_100_years||[]).slice(0,3);
    h+='<div class="text-prose" style="margin-top:5px" data-act="none"><div>'+esc(ct.geography_description)+'</div>'
      +(f.name?'<div style="margin-top:4px"><b>節慶：'+esc(f.name)+'</b>（'+esc(f.date)+'）<div class="text-brief">'+esc(f.cultural_lore)+'</div><div class="text-brief">'+esc(f.economic_impact)+'</div></div>':'')
      +'<div style="margin-top:4px"><b>四季</b>'+[['spring','春'],['summer','夏'],['autumn','秋'],['winter','冬']].map(([k,n])=>sr[k]?'<div class="text-brief">'+n+'：'+esc(sr[k])+'</div>':'').join('')+'</div>'
      +(hist.length?'<div style="margin-top:4px"><b>城史</b>'+hist.map(x=>'<div class="text-meta">'+esc(x.year)+'：'+esc(x.title)+'</div>').join('')+'</div>':'')+'</div>';
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
  h+=r.cities.filter(c=>!sel||c.id!==sel.id).slice().sort((a,b)=>cityPop(b)-cityPop(a)).map(cityLine).join('');
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
