/* =====================================================================
 * 05b_portrait.js — 江戶風模組化像素頭像
 *  - 48×48 原生像素畫；臉型、膚色、年齡、髮型、衣裝與神情分層組合。
 *  - 衣裝以江戶中後期為準：町人髷／月代、島田髷、小袖、羽織、裃、半纏、手拭。
 *  - 排除洋服、立領、西式軍裝、現代短髮與大正浪漫造型。
 *  - 隱藏數值只造成細微表情差異，不再以金眼、歪眉等誇張符號直接洩露。
 *  - 對外介面：portraitHtml(cid,px) 與 portraitEmp(e,px)。
 * ===================================================================== */

const PT_CACHE={};
function ptHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function ptRng(seed){let t=ptHash(seed);return()=>{t=(t+0x6D2B79F5)>>>0;let x=Math.imul(t^(t>>>15),t|1);x^=x+Math.imul(x^(x>>>7),x|61);return((x^(x>>>14))>>>0)/4294967296}}

const PT_COURT={administration:'#304f72',finance:'#8b6729',judiciary:'#5c496f'};
const PT_CLOTH={
  rival:'#70452f',manager:'#36576b',official:'#343f58',smuggler:'#405544',guard:'#34363b',
  broker:'#665c50',guest:'#78604a',oiran:'#9e3f43',captain:'#315b68',courier:'#4d683d',
  apprentice:'#566c45',clerk:'#3f6172',banto:'#674b38',chief:'#253f58'
};
const PT_BG=['#d9cfb9','#d2c7ae','#ddd3bf','#cfc5b1'];
const PT_SKIN=[
  {hi:'#f2d2ad',mid:'#dfb486',lo:'#bd8765'},
  {hi:'#efd8bd',mid:'#dab691',lo:'#ba8667'},
  {hi:'#e7c092',mid:'#cf9b70',lo:'#aa7458'},
  {hi:'#f3d9bd',mid:'#e2b995',lo:'#c28b69'}
];

/** 角色使用的江戶服飾類型。 */
function ptDress(o){
  if(o.oiran)return 'oiran';
  if(o.gender==='f')return 'kosode';
  if(o.rank>0||o.role==='official')return 'kamishimo';
  if(o.role==='captain'||o.role==='smuggler')return 'captain';
  if(o.role==='courier')return 'courier';
  if(o.role==='guard')return 'samurai';
  return 'haori';
}

/**
 * 固定人物表情。性格與身分只增加候選權重，仍保留個體差異；
 * 可傳入 o.expression 供預覽或特殊劇情指定。
 */
function ptExpression(o,rg,st){
  if(o.expression)return o.expression;
  const v=k=>st[k]===undefined?50:st[k];
  const pool=['calm','calm','gentle','stern','worried','tired','alert','shrewd'];
  if(v('diplomacy_charm')>=62)pool.push('gentle','cheerful');
  if(v('audacity_courage')>=65)pool.push('stern','alert');
  if(v('betrayal_risk')>=68)pool.push('shrewd');
  if((o.age||30)>=58)pool.push('calm','tired');
  if(o.oiran||o.gender==='f')pool.push('gentle','cheerful');
  if(o.rank>0||o.role==='official'||o.role==='guard')pool.push('stern','calm');
  if(o.role==='courier'||o.role==='captain')pool.push('alert','cheerful');
  return pool[Math.floor(rg()*pool.length)];
}

/** 畫一張 48×48 原生像素頭像並回傳 data URL。 */
function ptDraw(o){
  const cv=document.createElement('canvas');cv.width=48;cv.height=48;
  const c=cv.getContext('2d',{alpha:false});c.imageSmoothingEnabled=false;
  const R=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h)};
  const H=(x1,x2,y,col,h=1)=>R(x1,y,x2-x1+1,h,col);
  const V=(x,y1,y2,col,w=1)=>R(x,y1,w,y2-y1+1,col);
  const rg=ptRng(String(o.seed)),woman=o.gender==='f',age=o.age||30,st=o.st||{},dress=ptDress(o);
  const stat=k=>st[k]===undefined?50:st[k];
  const courage=stat('audacity_courage'),loyal=stat('integrity_loyalty'),betray=stat('betrayal_risk'),charm=stat('diplomacy_charm'),comm=stat('commerce_skill');
  const expression=ptExpression(o,rg,st);
  const sk=PT_SKIN[o.oiran?3:Math.floor(rg()*PT_SKIN.length)];
  const outline='#241d19',ink='#30251f',hair=age>=67?'#b9b6ad':age>=52?'#615d58':'#211c1a';
  const hairHi=age>=67?'#d2cec4':age>=52?'#817c75':'#3b302b';
  const cloth=o.cloth||PT_CLOTH[o.role]||(woman?'#8c5657':'#68513e');
  const clothDark=ptShade(cloth,-34),clothHi=ptShade(cloth,20),court=PT_COURT[o.court]||'#785b2f';
  const bg=o.court?ptShade(court,125):PT_BG[Math.floor(rg()*PT_BG.length)];

  // 背景：低對比和紙色，保留人物輪廓。
  R(0,0,48,48,bg);R(0,0,48,2,ptShade(bg,-18));R(0,46,48,2,ptShade(bg,-22));
  R(2,2,2,2,ptShade(bg,12));R(44,42,2,2,ptShade(bg,-10));

  // 肩膀與衣裝底形。
  H(12,35,34,outline,2);H(8,39,36,outline,2);H(5,42,38,outline,3);H(3,44,41,outline,7);
  H(13,34,34,cloth);H(9,38,36,cloth,2);H(6,41,38,cloth,3);H(4,43,41,cloth,7);
  H(6,41,39,clothHi);H(5,42,40,cloth);
  R(20,30,9,8,outline);R(21,30,7,8,sk.lo);R(22,30,5,7,sk.mid);

  if(dress==='kamishimo'){
    // 裃：肩衣的硬挺三角肩與交疊小袖。
    H(3,15,35,outline,2);H(32,44,35,outline,2);H(5,16,34,cloth);H(31,42,34,cloth);
    H(3,16,37,cloth,5);H(31,44,37,cloth,5);V(15,36,46,clothDark,2);V(31,36,46,clothDark,2);
    R(8,39,4,4,court);R(36,39,4,4,court);R(9,40,2,2,ptShade(court,38));R(37,40,2,2,ptShade(court,38));
  }else if(dress==='captain'||dress==='courier'){
    // 半纏：活動方便的短外衣；船長以手拭、飛腳以鉢卷束髮。
    V(7,39,47,clothDark,2);V(39,39,47,clothDark,2);
    H(5,12,42,clothHi,2);H(35,42,42,clothHi,2);
    if(dress==='captain'){H(5,11,45,'#d9d0ba',2);H(36,42,45,'#d9d0ba',2)}
    else{R(7,43,4,3,'#d9d0ba');R(37,43,4,3,'#d9d0ba')}
  }else if(dress==='oiran'){
    // 打掛般的厚重衣領與江戶花紋。
    V(5,39,47,'#b98a32',2);V(41,39,47,'#b98a32',2);
    R(8,41,3,3,'#d7ac4a');R(37,42,3,3,'#d7ac4a');R(10,43,2,2,'#ead08a');R(35,39,2,2,'#ead08a');
  }else if(dress==='samurai'){
    H(6,13,42,clothDark,2);H(34,41,42,clothDark,2);R(39,33,3,8,'#6a4a2e');R(40,32,2,3,'#b39150');
  }

  // 小袖交領；羽織在外，白襟只露窄邊。
  const collar=woman||dress==='oiran'?'#eee5d2':'#e4dccb';
  H(18,21,35,collar);H(26,29,35,collar);
  H(17,22,36,collar);H(25,30,36,collar);H(18,23,37,collar);H(24,29,37,collar);
  H(19,24,38,clothDark);H(24,28,38,clothDark);V(23,38,47,clothDark,2);
  if(comm>=72&&!woman){R(17,36,1,8,'#a9863e');R(30,36,1,8,'#a9863e')}

  // 耳、臉部輪廓與下頷；每個人有少量寬窄變化。
  const broad=rg()>.55?1:0;
  R(11-broad,20,4,8,outline);R(34,20,4+broad,8,outline);R(12-broad,21,3,6,sk.mid);R(34,21,3+broad,6,sk.mid);
  H(16-broad,31+broad,9,outline,2);H(14-broad,33+broad,11,outline,3);H(13-broad,34+broad,14,outline,12);
  H(14-broad,33+broad,26,outline,3);H(16-broad,31+broad,29,outline,3);H(19,28,32,outline,2);
  H(16-broad,31+broad,11,sk.mid,3);H(15-broad,32+broad,14,sk.mid,12);H(16-broad,31+broad,26,sk.mid,3);
  H(18-broad,29+broad,29,sk.mid,3);H(20,27,32,sk.mid);
  V(15-broad,16,25,sk.hi);H(16-broad,19,14,sk.hi);V(32+broad,17,25,sk.lo);H(29,31+broad,27,sk.lo);

  // 髮型：男性是月代／町人髷；女性是島田髷。高官仍用裃，不戴近代官帽。
  if(woman){
    H(17,30,5,hair);H(14,33,7,hair,3);H(12,35,10,hair,4);V(11,13,24,hair,3);V(34,13,25,hair,3);
    H(19,28,3,hair,3);H(21,30,1,hair,2);R(13,10,4,5,hairHi);R(31,10,4,6,hairHi);
    V(13,19,27,hair);V(34,18,27,hair);
    const pin=['#a5453d','#b48a36','#315f70'][Math.floor(rg()*3)];
    if(age<58){H(29,37,6,pin,2);R(36,5,2,5,pin)}
    if(o.oiran){
      H(8,18,7,'#c49a3f',2);H(30,40,9,'#c49a3f',2);V(9,5,14,'#d7b85f',2);V(38,6,16,'#d7b85f',2);
      R(7,4,4,3,'#a63f38');R(38,7,4,3,'#a63f38');H(20,29,2,'#b99038');
    }
  }else{
    // 側髮與後髮保留，前額剃月代；頭頂髷向後收束。
    H(15-broad,32+broad,8,hair,3);R(13-broad,10,5,8,hair);R(30,10,5+broad,9,hair);
    V(12-broad,14,23,hair,3);V(34,14,24,hair,3);R(15,10,4,3,hairHi);R(31,11,3,5,hairHi);
    H(20,29,6,hair,2);H(23,33,4,hair,2);R(30,5,5,2,hair);R(21,8,7,2,sk.mid);
    if(dress==='captain'){
      H(10,37,10,'#ded5c0',3);R(34,12,6,3,'#ded5c0');R(38,15,4,4,'#ded5c0');R(40,18,2,3,'#bdb39e');
      R(13,10,7,2,'#405d75');R(26,10,7,2,'#405d75');
    }else if(dress==='courier'){
      H(11,36,11,'#e4dccb',3);R(34,14,6,2,'#e4dccb');R(38,16,3,3,'#e4dccb');
    }
  }

  // 眉眼：八種自然表情。能力只影響候選權重，不直接畫成誇張符號。
  const eyeY=21+(age>=62?1:0),glance=(expression==='shrewd'||loyal<24||betray>=82)?1:0;
  if(expression==='stern'||expression==='shrewd'){
    H(16,18,eyeY-4,ink);H(19,21,eyeY-3,ink);H(29,31,eyeY-4,ink);H(26,28,eyeY-3,ink);
  }else if(expression==='worried'){
    H(16,18,eyeY-3,ink);H(19,21,eyeY-4,ink);H(29,31,eyeY-3,ink);H(26,28,eyeY-4,ink);
  }else if(expression==='alert'){
    H(16,21,eyeY-5,ink);H(27,32,eyeY-5,ink);
  }else{
    H(16,20,eyeY-3,ink);H(27,31,eyeY-3+(expression==='shrewd'?-1:0),ink);
  }
  if(expression==='cheerful'){
    H(16,18,eyeY,outline);R(19,eyeY+1,2,1,outline);R(27,eyeY+1,2,1,outline);H(29,31,eyeY,outline);
  }else if(expression==='tired'||expression==='shrewd'){
    H(16,21,eyeY+1,outline);H(27,32,eyeY+1,outline);R(19+glance,eyeY,2,1,ink);R(29+glance,eyeY,2,1,ink);
  }else{
    const tall=expression==='alert';
    H(16,21,eyeY,outline);H(27,32,eyeY,outline);H(17,20,eyeY+1,'#f4ead8',tall?2:1);H(28,31,eyeY+1,'#f4ead8',tall?2:1);
    R(18+glance,eyeY,2,tall?3:2,ink);R(29+glance,eyeY,2,tall?3:2,ink);R(19+glance,eyeY,'#efe5cd');R(30+glance,eyeY,'#efe5cd');
  }
  if(woman&&expression!=='tired'){R(15,eyeY-1,2,1,ink);R(32,eyeY-1,2,1,ink)}

  // 鼻、嘴、皺紋與鬍鬚。
  V(24,22,26,sk.lo);H(23,26,27,sk.lo);R(22,26,2,1,sk.hi);
  const mouthY=30,lip=o.oiran?'#9d3c43':'#835447';
  if(expression==='gentle'){
    H(21,26,mouthY,lip);R(20,mouthY-1,1,1,lip);R(27,mouthY-1,1,1,lip);
  }else if(expression==='cheerful'){
    H(20,27,mouthY-1,lip);H(21,26,mouthY,outline);H(22,25,mouthY+1,'#e9d9c2');R(20,mouthY-2,1,1,lip);R(27,mouthY-2,1,1,lip);
  }else if(expression==='stern'){
    H(20,27,mouthY,outline);H(22,25,mouthY-1,lip);
  }else if(expression==='worried'){
    H(21,26,mouthY-1,lip);R(20,mouthY,1,1,lip);R(27,mouthY,1,1,lip);H(23,24,mouthY,outline);
  }else if(expression==='tired'){
    H(21,27,mouthY,lip);R(21,mouthY+1,2,1,sk.lo);
  }else if(expression==='alert'){
    H(22,25,mouthY-1,outline);H(22,25,mouthY,lip);H(23,24,mouthY+1,outline);
  }else if(expression==='shrewd'){
    H(21,26,mouthY,lip);R(20,mouthY,1,1,lip);R(27,mouthY-1,1,1,lip);
  }else H(21,27,mouthY,lip);
  if(age>=48){H(14,17,eyeY+3,sk.lo);H(31,34,eyeY+3,sk.lo);H(21,23,16,sk.lo);H(26,28,16,sk.lo)}
  if(age>=63){H(18,21,13,sk.lo);H(27,30,13,sk.lo);R(19,31,2,1,sk.lo);R(27,31,2,1,sk.lo)}
  const beard=!woman&&(dress==='captain'||dress==='samurai'||o.role==='smuggler')&&age>28&&rg()>.34;
  if(beard){H(20,27,32,hair);R(18,30,2,2,hair);R(28,30,2,2,hair);H(21,26,33,hairHi)}

  R(16,16,2,2,sk.hi);R(15,19,1,3,sk.hi);R(0,0,48,1,ptShade(bg,-42));R(0,47,48,1,ptShade(bg,-42));
  return cv.toDataURL('image/png');
}

/** 將十六進位色調亮／調暗。 */
function ptShade(hex,amt){
  const n=parseInt(hex.slice(1),16),r=Math.max(0,Math.min(255,(n>>16)+amt)),g=Math.max(0,Math.min(255,((n>>8)&255)+amt)),b=Math.max(0,Math.min(255,(n&255)+amt));
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

/** 依人物 cid 取頭像；每八歲更新年齡層，換裝與職位同步更新。 */
function portraitHtml(cid,px){
  const ch=CH(cid);if(!ch)return '';
  const n=npc(cid),age=Math.max(10,ageOf(cid)),emp=G.emps.find(e=>e.cid===cid);
  const role=emp?emp.rank:(n?n.role:'guest');
  const o={seed:cid,gender:ch.gender,age,role,rank:n&&n.pos?n.pos.rank:0,court:n&&n.pos?n.pos.court:null,oiran:role==='oiran',st:ch.derived_stats};
  if(emp&&RANK_LOOK[emp.rank])o.cloth=RANK_LOOK[emp.rank].cloth;
  const key=['edo3',cid,Math.floor(age/8),role,o.rank,o.court||'',o.cloth||''].join('|');
  const url=PT_CACHE[key]||(PT_CACHE[key]=ptDraw(o));
  const size=px||48;
  return '<img class="pt" src="'+url+'" width="'+size+'" height="'+size+'" alt="" aria-hidden="true">';
}

/** 無名冊少年員工：同一員工外貌固定，升職時換上對應衣裝。 */
function portraitEmp(e,px){
  if(e.cid)return portraitHtml(e.cid,px);
  const key='edo3|emp|'+e.id+'|'+e.rank;
  const o={seed:e.id,gender:'m',age:14,role:e.rank,rank:0,st:e.stats,cloth:RANK_LOOK[e.rank]&&RANK_LOOK[e.rank].cloth};
  const size=px||48;
  return '<img class="pt" src="'+(PT_CACHE[key]||(PT_CACHE[key]=ptDraw(o)))+'" width="'+size+'" height="'+size+'" alt="" aria-hidden="true">';
}
