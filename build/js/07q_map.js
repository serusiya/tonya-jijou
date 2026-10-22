/* 地區地圖（日式古地圖「繪圖」風格）：用遊戲內真實的城市座標（cityXY）畫 SVG，標示城市位置與連接道路。
 * - 陸地：以城市為中心的圓團疊成，再用濾鏡畫出手繪般的海岸線與水紋；南海群島每城各成一島，連線為海路（紅色虛線加帆船）。
 * - 道路：先連成最短樹，再補上相近城市之間的支線；陸地上為朱紅色街道，沿線有里程點。
 * - 圖示：行政都市＝天守閣、礦產＝礦山、水路／水陸要衝＝帆船、陸路要衝＝關門、農林＝茅屋田畦；城名為直書兩字名牌；本店駐節城以朱紅標出。
 */
/** 城市圖示類型：admin / mine / port / farm / land */
function mapKind(ct){const t=ct.location_type;if(t.includes('行政'))return 'admin';if(t.includes('礦'))return 'mine';if(t.includes('水'))return 'port';if(t.includes('陸路'))return 'land';return 'farm'}
/** 道路（或海路）端點對：最短樹＋近鄰支線。 */
function mapEdges(pts,islands){
  const n=pts.length,d=(a,b)=>Math.hypot(pts[a].x-pts[b].x,pts[a].y-pts[b].y),E=[],inT=new Set([0]),has=new Set();
  const add=(a,b)=>{const k=a<b?a+'-'+b:b+'-'+a;if(!has.has(k)){has.add(k);E.push([a,b])}};
  while(inT.size<n){let best=null;inT.forEach(a=>{for(let b=0;b<n;b++){if(inT.has(b))continue;const w=d(a,b);if(!best||w<best[0])best=[w,a,b]}});inT.add(best[2]);add(best[1],best[2])}
  const lim=islands?75:52;
  for(let a=0;a<n;a++){const o=[];for(let b=0;b<n;b++)if(b!==a)o.push([d(a,b),b]);o.sort((x,y)=>x[0]-y[0]);if(o[1]&&o[1][0]<lim)add(a,o[1][1])}
  return E;
}
/** 畫某地區地圖。opts.home＝本店所在城市 id，opts.sel＝選取中的城市 id。 */
function regionMapSvg(rid,opts){
  opts=opts||{};const list=CITIES.filter(c=>c.region_id===rid),islands=rid==='reg_south';
  const INK='#3b2e1c',RED='#b3392b',SEA='#d5dccf',LAND='#f0e2b6',WASH='#9fb3b1';
  const pts=list.map(c=>{const p=cityXY(c);return {c,x:p[0],y:p[1],k:mapKind(c)}});
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;pts.forEach(p=>{x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);y0=Math.min(y0,p.y);y1=Math.max(y1,p.y)});
  const pad=44;x0-=pad;y0-=pad+8;x1+=pad;y1+=pad;const W=Math.round(x1-x0),H=Math.round(y1-y0);
  const X=v=>+(v-x0).toFixed(1),Y=v=>+(v-y0).toFixed(1),rd=seeded('koezu'+rid),id=rid;
  const px=pts.map(p=>({...p,sx:X(p.x),sy:Y(p.y)}));
  const R=islands?15:42;
  let s='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block" font-family="\'Noto Serif TC\',\'Source Han Serif TC\',\'Songti TC\',\'PMingLiU\',serif">';
  s+='<defs>'
   +'<filter id="cst'+id+'" x="0" y="0" width="'+W+'" height="'+H+'" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">'
   +'<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="'+(3+Math.floor(rd()*40))+'" result="t"/>'
   +'<feDisplacementMap in="SourceGraphic" in2="t" scale="15" xChannelSelector="R" yChannelSelector="G" result="d"/>'
   +'<feMorphology in="d" operator="dilate" radius="1.2" result="d1"/><feMorphology in="d" operator="dilate" radius="4" result="d4"/><feMorphology in="d" operator="dilate" radius="5.4" result="d5"/><feMorphology in="d" operator="dilate" radius="9" result="d9"/><feMorphology in="d" operator="dilate" radius="10.4" result="d10"/>'
   +'<feComposite in="d1" in2="d" operator="out" result="ln"/><feFlood flood-color="'+INK+'"/><feComposite in2="ln" operator="in" result="line"/>'
   +'<feComposite in="d5" in2="d4" operator="out" result="r1a"/><feFlood flood-color="'+WASH+'" flood-opacity=".75"/><feComposite in2="r1a" operator="in" result="r1"/>'
   +'<feComposite in="d10" in2="d9" operator="out" result="r2a"/><feFlood flood-color="'+WASH+'" flood-opacity=".5"/><feComposite in2="r2a" operator="in" result="r2"/>'
   +'<feFlood flood-color="'+LAND+'"/><feComposite in2="d" operator="in" result="fill"/>'
   +'<feMerge><feMergeNode in="r2"/><feMergeNode in="r1"/><feMergeNode in="fill"/><feMergeNode in="line"/></feMerge></filter>'
   +'<filter id="pap'+id+'" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .33  0 0 0 0 .15  0 0 0 .22 0"/></filter>'
   +'<filter id="stn'+id+'" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="11"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .38  0 0 0 0 .18  0 0 0 1.1 -.42"/></filter>'
   +'<radialGradient id="vg'+id+'" cx="50%" cy="50%" r="75%"><stop offset="60%" stop-color="#6b4a1f" stop-opacity="0"/><stop offset="100%" stop-color="#6b4a1f" stop-opacity=".38"/></radialGradient>'
   +'</defs>';
  s+='<rect width="'+W+'" height="'+H+'" fill="'+SEA+'"/>';
  s+='<rect width="'+W+'" height="'+H+'" filter="url(#stn'+id+')" opacity=".5"/>';
  // 海浪紋
  for(let i=0;i<70;i++){const wx=rd()*W,wy=rd()*H;if(px.some(p=>Math.hypot(p.sx-wx,p.sy-wy)<R+16))continue;
    s+='<path d="M'+wx.toFixed(1)+' '+wy.toFixed(1)+'q2.5 -3 5 0q2.5 -3 5 0q2.5 -3 5 0" fill="none" stroke="'+WASH+'" stroke-width=".7" stroke-linecap="round"/>'}
  // 陸地
  s+='<g filter="url(#cst'+id+')">'+px.map(p=>'<circle cx="'+p.sx+'" cy="'+p.sy+'" r="'+R+'" fill="#000"/>').join('')+'</g>';
  // 山水
  const mtn=(mx,my,sc,dark)=>{let t='<g transform="translate('+mx.toFixed(1)+' '+my.toFixed(1)+') scale('+sc+')" stroke="'+INK+'" stroke-width=".7" stroke-linejoin="round">';
    t+='<path d="M-9 0L-4 -9L-1 -4L3 -12L9 0Z" fill="'+(dark?'#a69a78':'#cbbf98')+'"/><path d="M-4 -9L-3 -3M3 -12L2 -4M3 -12L6 -3M-1 -4L0 0" stroke-width=".5" fill="none"/>';return t+'</g>'};
  const tree=(tx,ty)=>'<g transform="translate('+tx.toFixed(1)+' '+ty.toFixed(1)+')" stroke="'+INK+'" stroke-width=".6" fill="none"><path d="M0 0V3"/><path d="M-2.4 0L0 -3L2.4 0M-2 -2L0 -5L2 -2" fill="#8d9a5c"/></g>';
  const onLand=(x,y)=>px.some(p=>Math.hypot(p.sx-x,p.sy-y)<R*0.8)&&!px.some(p=>Math.hypot(p.sx-x,p.sy-y)<16);
  const deco=[];let tries=0;
  px.filter(p=>p.k==='mine').forEach(p=>{const a=rd()*6.28;deco.push([p.sy+Math.sin(a)*13,mtn(p.sx+Math.cos(a)*14,p.sy+Math.sin(a)*13,1.1,true)])});
  while(deco.length<(islands?10:24)&&tries++<600){const x=rd()*W,y=rd()*H;if(onLand(x,y))deco.push([y,rd()<0.55?mtn(x,y,0.7+rd()*0.5,false):tree(x,y)])}
  deco.sort((a,b)=>a[0]-b[0]).forEach(d=>s+=d[1]);
  // 道路／海路
  const E=mapEdges(pts,islands);
  E.forEach(e=>{const a=px[e[0]],b=px[e[1]];const mx=(a.sx+b.sx)/2+(rd()-0.5)*8,my=(a.sy+b.sy)/2+(rd()-0.5)*8;
    const dpath='M'+a.sx+' '+a.sy+'Q'+mx.toFixed(1)+' '+my.toFixed(1)+' '+b.sx+' '+b.sy;
    if(islands)s+='<path d="'+dpath+'" fill="none" stroke="'+RED+'" stroke-width="1" stroke-dasharray="1.2 2.4" stroke-linecap="round"/>';
    else s+='<path d="'+dpath+'" fill="none" stroke="'+RED+'" stroke-width="1.7" stroke-linecap="round"/><path d="'+dpath+'" fill="none" stroke="'+LAND+'" stroke-width=".5" stroke-dasharray="1 5" stroke-linecap="round" opacity=".0"/>';
    if(!islands){const L=Math.hypot(b.sx-a.sx,b.sy-a.sy),n=Math.floor(L/22);for(let i=1;i<=n;i++){const t=i/(n+1),qx=(1-t)*(1-t)*a.sx+2*(1-t)*t*mx+t*t*b.sx,qy=(1-t)*(1-t)*a.sy+2*(1-t)*t*my+t*t*b.sy;s+='<circle cx="'+qx.toFixed(1)+'" cy="'+qy.toFixed(1)+'" r="1.1" fill="'+INK+'"/>'}}
    else{const t=.5,qx=(1-t)*(1-t)*a.sx+2*(1-t)*t*mx+t*t*b.sx,qy=(1-t)*(1-t)*a.sy+2*(1-t)*t*my+t*t*b.sy;s+='<path d="M'+(qx-3).toFixed(1)+' '+(qy+1).toFixed(1)+'l1 2h4l1 -2zM'+qx.toFixed(1)+' '+(qy+1).toFixed(1)+'V'+(qy-5).toFixed(1)+'l3 4z" fill="#fff" stroke="'+INK+'" stroke-width=".5"/>'}});
  // 城市
  const placed=px.map(p=>[p.sx-7,p.sy-7,p.sx+7,p.sy+7]);
  const hit=r=>placed.some(q=>r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1]);
  px.slice().sort((a,b)=>b.c.population-a.c.population).forEach(p=>{
    const cx=p.sx,cy=p.sy,home=opts.home===p.c.id,sel=opts.sel===p.c.id;
    let g='<g data-act="mapCity" data-cid="'+p.c.id+'" style="cursor:pointer">';
    g+='<circle cx="'+cx+'" cy="'+cy+'" r="11" fill="transparent"/>';
    if(home)g+='<circle cx="'+cx+'" cy="'+cy+'" r="8.5" fill="'+RED+'" opacity=".22"/><circle cx="'+cx+'" cy="'+cy+'" r="8.5" fill="none" stroke="'+RED+'" stroke-width="1"/>';
    if(sel)g+='<circle cx="'+cx+'" cy="'+cy+'" r="10.5" fill="none" stroke="'+INK+'" stroke-width=".8" stroke-dasharray="2 1.5"/>';
    const big=p.c.population>200000;
    if(p.k==='admin'){const k=big?1.25:1;g+='<g transform="translate('+cx+' '+cy+') scale('+k+')" stroke="'+INK+'" stroke-width=".7" stroke-linejoin="round"><path d="M-6 5H6L5 0H-5Z" fill="#6f6f6a"/><rect x="-4.2" y="-3" width="8.4" height="3.2" fill="#fbf6e4"/><path d="M-5.8 -3L0 -8L5.8 -3Z" fill="#37424a"/><rect x="-2.2" y="-6.2" width="4.4" height="3" fill="#fbf6e4"/><path d="M-3.4 -6L0 -10.5L3.4 -6Z" fill="#37424a"/></g>'}
    else if(p.k==='mine')g+='<g transform="translate('+cx+' '+cy+')" stroke="'+INK+'" stroke-width=".7" stroke-linejoin="round"><path d="M-7 4L-2 -5L1 -1L4 -7L8 4Z" fill="#8a7f6a"/><path d="M-3 4L-1 0M4 -7L3 -2L6 4M1 -1L2 4" fill="none" stroke-width=".5"/><circle cx="-5.5" cy="-2.5" r="1" fill="#e0b73c" stroke-width=".4"/></g>';
    else if(p.k==='port')g+='<g transform="translate('+cx+' '+cy+')" stroke="'+INK+'" stroke-width=".7" stroke-linejoin="round"><path d="M-6 1H6L4 5H-4Z" fill="#8a5a33"/><path d="M0 1V-8M0 -8L5 -1H0Z" fill="#fbf6e4"/><path d="M-1 -8L-1 -10" fill="none"/><path d="M-7 7q1.7 -1.6 3.5 0t3.5 0t3.5 0t3.5 0" fill="none" stroke="'+WASH+'" stroke-width=".8"/></g>';
    else if(p.k==='land')g+='<g transform="translate('+cx+' '+cy+')" stroke="'+INK+'" stroke-width=".8" stroke-linejoin="round"><path d="M-6 5V-3M6 5V-3" fill="none" stroke-width="1.4"/><path d="M-8 -3H8L7 -5.2H-7Z" fill="'+RED+'"/><path d="M-5.5 0H5.5" fill="none" stroke-width=".9"/></g>';
    else g+='<g transform="translate('+cx+' '+cy+')" stroke="'+INK+'" stroke-width=".7" stroke-linejoin="round"><path d="M-6 2L0 -5L6 2Z" fill="#c89e52"/><rect x="-4" y="2" width="8" height="3.6" fill="#fbf6e4"/><path d="M-8 7H8M-8 9.2H8" stroke="#7d8f4b" stroke-width=".8" fill="none"/></g>';
    // 直書名牌
    const lab=p.c.name.slice(0,2),fs=6.6,w=fs+4.6,h=fs*2+5.4;
    const cand=[[cx+10,cy-h/2],[cx-10-w,cy-h/2],[cx-w/2,cy-12-h+2],[cx-w/2,cy+9],[cx+10,cy-h-1],[cx+10,cy+1]];
    let pick=null;for(const c of cand){const r=[c[0]+x0,c[1]+y0,c[0]+w+x0,c[1]+h+y0];if(!hit(r)){pick=[c,r];break}}
    if(!pick){const c=cand[0];pick=[c,[c[0]+x0,c[1]+y0,c[0]+w+x0,c[1]+h+y0]]}
    placed.push(pick[1]);const [lx,ly]=pick[0];
    g+='<rect x="'+(lx+.7).toFixed(1)+'" y="'+(ly+.7).toFixed(1)+'" width="'+w+'" height="'+h+'" fill="#6b4a1f" opacity=".25"/>';
    g+='<rect x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'" width="'+w+'" height="'+h+'" fill="'+(home?'#fde3d6':'#fbf4dc')+'" stroke="'+(home?RED:INK)+'" stroke-width=".8"/>';
    g+=[...lab].map((ch,i)=>'<text x="'+(lx+w/2).toFixed(1)+'" y="'+(ly+3.4+fs*(i+0.82)+i*0.4).toFixed(1)+'" text-anchor="middle" font-size="'+fs+'" font-weight="bold" fill="'+(home?RED:INK)+'">'+esc(ch)+'</text>').join('');
    s+=g+'</g>'});
  // 紙質、暈邊
  s+='<rect width="'+W+'" height="'+H+'" filter="url(#pap'+id+')" style="pointer-events:none"/><rect width="'+W+'" height="'+H+'" fill="url(#vg'+id+')" style="pointer-events:none"/>';
  // 外框
  s+='<rect x="3" y="3" width="'+(W-6)+'" height="'+(H-6)+'" fill="none" stroke="'+INK+'" stroke-width="2.2"/><rect x="7" y="7" width="'+(W-14)+'" height="'+(H-14)+'" fill="none" stroke="'+INK+'" stroke-width=".6"/>';
  // 題簽（直書）
  const reg=(list[0]||{}).region_name||'',title=reg.replace(/圈$/,'').replace(/同盟|群島|水運港灣|商賈驛站/,m=>m)+'繪圖',tl=[...title];
  const tw=15,th=tl.length*11+8;
  s+='<g><rect x="13" y="13" width="'+tw+'" height="'+th+'" fill="#f7efd2" stroke="'+INK+'" stroke-width="1"/><rect x="15" y="15" width="'+(tw-4)+'" height="'+(th-4)+'" fill="none" stroke="'+RED+'" stroke-width=".6"/>'
   +tl.map((ch,i)=>'<text x="'+(13+tw/2)+'" y="'+(25+i*11)+'" text-anchor="middle" font-size="9.5" font-weight="bold" fill="'+INK+'">'+esc(ch)+'</text>').join('')+'</g>';
  // 方位（北）：在幾個候選位置中挑離城市與名牌最遠者
  const cc=[[W-26,34],[W-26,H-70],[W/2,24]].map(c=>[c,Math.min(...px.map(p=>Math.hypot(p.sx-c[0],p.sy-c[1])))]).sort((a,b)=>b[1]-a[1])[0][0],cx=cc[0],cy=cc[1];
  s+='<g stroke="'+INK+'" fill="none" stroke-width=".8"><circle cx="'+cx+'" cy="'+cy+'" r="12" fill="#f7efd2" fill-opacity=".8"/><path d="M'+cx+' '+(cy-10)+'L'+(cx+3.2)+' '+(cy+2)+'L'+cx+' '+(cy-1)+'L'+(cx-3.2)+' '+(cy+2)+'Z" fill="'+RED+'"/><path d="M'+(cx-9)+' '+cy+'H'+(cx+9)+'M'+cx+' '+(cy+1)+'V'+(cy+10)+'" stroke-width=".5"/></g><text x="'+cx+'" y="'+(cy-14.5)+'" text-anchor="middle" font-size="8" font-weight="bold" fill="'+INK+'">北</text>';
  // 比例尺（百里）與落款印
  s+='<g stroke="'+INK+'" stroke-width=".8"><path d="M14 '+(H-14)+'H'+(14+50)+'M14 '+(H-17)+'V'+(H-11)+'M'+(14+50)+' '+(H-17)+'V'+(H-11)+'"/></g><text x="39" y="'+(H-18.5)+'" text-anchor="middle" font-size="6.5" fill="'+INK+'">五十里</text>';
  s+='<g><rect x="'+(W-27)+'" y="'+(H-27)+'" width="15" height="15" fill="'+RED+'" opacity=".9"/><text x="'+(W-19.5)+'" y="'+(H-22)+'" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#fbf4dc">問</text><text x="'+(W-19.5)+'" y="'+(H-14.6)+'" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#fbf4dc">屋</text></g>';
  return s+'</svg>';
}
