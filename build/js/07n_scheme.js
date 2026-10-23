/* ======================= 官員運作：司法官員栽贓、行政官員打壓 =======================
 *  - 四階以上官員好感 100：司法官員可「栽贓」隨機一家同業（成功＝該同業被查抄，市佔分數剩 40%）；
 *    行政官員可「打壓」隨機一家同業（成功＝該同業行情 ×0.6，持續數旬）。
 *  - 好感 100 時出現在拜訪後的請託選單，每位官員只能請託一次（請託即好感 −30）。機制同放火：500 兩私房錢、熱度 +3；成功後可能被查辦（官員撤職，可能供出你）；
 *    失手則官員與你決裂、該同業成為仇人。 */
const SCHEME={frame:{court:'judiciary',icon:'⚖️',name:'栽贓'},suppress:{court:'administration',icon:'📛',name:'打壓'}};
function schemeKind(n){const c=n&&n.pos&&n.pos.court;return c==='judiciary'?'frame':c==='administration'?'suppress':null}
function schemeOK(cid){const n=npc(cid),k=schemeKind(n);return !!(k&&n.role==='official'&&n.pos.rank>=SPECIAL_RANK&&alive(cid)&&R(cid).bond&&R(cid).aff>=100&&!isEnemy(cid))}
function schemeChance(n,k){const s=CH(n.cid).derived_stats,A_=ODDS[k];return clamp(A_.base+s.audacity_courage/A_.courageDiv+s.commerce_skill/A_.commerceDiv-A_.rank*A_.perRank,A_.min,A_.max)}
const schemeTargets=()=>rivalsHere().filter(n=>alive(n.cid)&&!n.raided);
/** 拜訪請託中選了「栽贓／打壓」（好感 100、每位官員一次；行動點數已在拜訪時扣過）。 */
function startScheme(cid){
  const n=npc(cid),k=schemeKind(n),S=SCHEME[k],off=nameOf(cid);
  if(!n||!k)return;
  if((G.exile||0)>0){toast(MSG('scheme.exile'));return}
  const ts=schemeTargets();if(!ts.length){toast(MSG('scheme.noRival'));return}
  if(!afford(k)){toast(shortMsg(k));return}
  spend(k);G.heat=(G.heat||0)+3;
  const tg=pick(ts),p=schemeChance(n,k),name=nameOf(tg.cid),log=[];
  playFx('walk',MSG(k==='frame'?'scheme.fxFrame':'scheme.fxSuppress',{off}),MSG(k==='frame'?'scheme.fxTitleFrame':'scheme.fxTitleSuppress'),()=>{
    if(chance(p)){
      if(k==='frame')tg.raided=true;
      else{const m=msOf(tg);m.ev=ODDS.suppress.evMul;m.evT=ODDS.suppress.turns}
      G.share=marketShares();G.life.schemes=(G.life.schemes||0)+1;logRel(tg.cid,k==='frame'?'遭人栽贓查抄。':'遭官府打壓。');
      pushNews(NEWS('scheme.'+k,{name}));sfx.bad();
      let msg=MSG(k==='frame'?'scheme.frameOk':'scheme.suppressOk',{off,target:name});
      const I=ODDS.schemeInvestigate;
      if(chance(clamp(I.base+I.perHeat*(G.heat||0)+I.rank*I.perRank,I.min,I.max))){
        const loyal=CH(cid).derived_stats.integrity_loyalty;
        const rep=replaceOfficial(n);if(rep)addKnown(rep);delete G.world.npcs[cid];
        G.intros=G.intros.filter(i=>i.cid!==cid);if(G.introId===cid)G.introId=G.intros[0]?G.intros[0].cid:null;
        loseFame('arrest');logRel(cid,'因運作同業事敗，遭撤職查辦。');
        if(chance(confessP(loyal))){msg+=MSG('scheme.caught',{off});doRaid('testimony',log)}
        else msg+=MSG('scheme.silent',{off});
      }
      toast(msg,5200);
    }else{
      G.heat=(G.heat||0)+2;
      const r=R(cid);r.aff=0;r.peak=Math.max(r.peak||0,40);logRel(cid,'運作同業失手，與你決裂。');
      const r2=R(tg.cid);r2.aff=0;r2.peak=Math.max(r2.peak||0,40);logRel(tg.cid,'察覺有人暗中對付自己，視你為仇。');
      sfx.bad();toast(MSG('scheme.fail',{off,target:name}),5200);
    }
    UI.render();refreshSheet();
  },1000);
}
