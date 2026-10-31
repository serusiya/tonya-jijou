'use strict';
/* ======================= 配樂：江戶風 WebAudio 音序器 =======================
 *  - 不用任何音檔：樂曲存成音符表 [MIDI 音高, 起始拍, 拍長, 樂器]（音高 0＝休止），即時合成。
 *  - 樂器：koto 箏、kotoLow 低音箏、shami 三味線、fue 笛、taiko 大太鼓、shime 締太鼓、ka 鼓邊、kane 鉦。
 *  - 曲目：market《市井囃子》（主畫面，陽音階）、visit《登門囃子》（拜訪戰鬥，都節音階）、title《暖簾囃子》（人生終章，箏引子＋兩首動機）；皆依祭典囃子形式編排，非特定曲目。
 *  - 播放採預排：每 25 毫秒把接下來 0.25 秒內的音符排進時間軸，循環播放；換曲時淡出淡入。
 *  - 設定（音樂開關、音效開關、音量）存在本機瀏覽器（AUDIO_KEY），屬個人偏好，不寫進存檔。
 *  - 手機瀏覽器要在使用者點擊之後才能出聲：開局／繼續人生時開始播放，之後任何點擊都會喚醒。 */
const AUDIO_KEY='tonya_jijou_audio';
/** 音訊設定：music 音樂開關、sfx 音效開關、vol 音量 0～100。 */
const AUDIO={music:true,sfx:true,vol:60};
try{Object.assign(AUDIO,JSON.parse(localStorage.getItem(AUDIO_KEY)||'{}'))}catch(e){}
function audioSave(){try{localStorage.setItem(AUDIO_KEY,JSON.stringify(AUDIO))}catch(e){}}
/** 音量曲線（滑桿 0～100 → 增益）。 */
const audioGain=()=>Math.pow(AUDIO.vol/100,1.6);
/** 套用設定到音效（01_core 的 soundOn／SFX_VOL）。 */
function audioApply(){soundOn=AUDIO.sfx;SFX_VOL=audioGain()/Math.pow(0.6,1.6);if(MUS.out&&AC)MUS.out.gain.setTargetAtTime(AUDIO.music?audioGain()*0.55:0.0001,AC.currentTime,0.08)}

const MUS={out:null,play:null,key:null,want:null,noise:null};
const mtof=m=>440*Math.pow(2,(m-69)/12);
function musOut(){if(!AC)return null;if(!MUS.out){MUS.out=AC.createGain();MUS.out.gain.value=0.0001;MUS.out.connect(AC.destination)}return MUS.out}
function musNoise(){if(MUS.noise)return MUS.noise;const n=AC.sampleRate*0.5,b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return MUS.noise=b}
/** 一個音：依樂器組合振盪器與音量包絡。 */
function musVoice(inst,midi,t,dur){
  const made=[],K=n=>{made.push(n);return n};       // 這個音用到的聲音元件；全部播完後一起斷開，讓瀏覽器回收（Safari 不斷開會越積越多）
  const out=K(AC.createGain());out.connect(MUS.out);
  const env=(g,a,peak,decay,sustain,rel)=>{g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(Math.max(0.0001,peak*sustain),t+a+decay);g.gain.exponentialRampToValueAtTime(0.0001,t+Math.max(dur,a+decay)+rel)};
  const osc=(type,f,det)=>{const o=K(AC.createOscillator());o.type=type;o.frequency.setValueAtTime(f,t);if(det)o.detune.value=det;return o};
  if(inst==='koto'||inst==='kotoLow'){
    const f=mtof(midi),lp=K(AC.createBiquadFilter());lp.type='lowpass';lp.frequency.setValueAtTime(inst==='koto'?4200:1600,t);lp.frequency.exponentialRampToValueAtTime(inst==='koto'?900:400,t+0.6);lp.connect(out);
    const a=osc('triangle',f),b=osc('square',f,7),c=osc('sine',f*2),gb=K(AC.createGain()),gc=K(AC.createGain());gb.gain.value=0.18;gc.gain.value=0.25;
    a.connect(lp);b.connect(gb);gb.connect(lp);c.connect(gc);gc.connect(lp);
    env(out,0.004,inst==='koto'?0.42:0.3,inst==='koto'?0.9:1.2,0.05,0.4);[a,b,c].forEach(o=>{o.start(t);o.stop(t+dur+1.6)});
  }else if(inst==='shami'){
    const f=mtof(midi),bp=K(AC.createBiquadFilter());bp.type='bandpass';bp.frequency.value=f*3;bp.Q.value=1.2;bp.connect(out);
    const a=osc('sawtooth',f),b=osc('square',f*2.01),gb=K(AC.createGain());gb.gain.value=0.3;a.connect(bp);b.connect(gb);gb.connect(bp);
    env(out,0.002,0.55,0.18,0.02,0.08);[a,b].forEach(o=>{o.start(t);o.stop(t+dur+0.5)});
  }else if(inst==='fue'){
    const f=mtof(midi),a=osc('sine',f),b=osc('triangle',f*2),gb=K(AC.createGain());gb.gain.value=0.12;
    const lfo=K(AC.createOscillator()),lg=K(AC.createGain());lfo.frequency.value=5.5;lg.gain.setValueAtTime(0,t);lg.gain.linearRampToValueAtTime(f*0.012,t+Math.min(0.35,dur*0.6));lfo.connect(lg);lg.connect(a.frequency);lg.connect(b.frequency);
    a.connect(out);b.connect(gb);gb.connect(out);
    const n=K(AC.createBufferSource());n.buffer=musNoise();const nf=K(AC.createBiquadFilter());nf.type='bandpass';nf.frequency.value=f*2;nf.Q.value=2;const ng=K(AC.createGain());ng.gain.value=0.025;n.connect(nf);nf.connect(ng);ng.connect(out);
    out.gain.setValueAtTime(0.0001,t);out.gain.linearRampToValueAtTime(0.26,t+0.05);out.gain.setValueAtTime(0.24,t+Math.max(0.06,dur-0.06));out.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.12);
    [a,b,lfo].forEach(o=>{o.start(t);o.stop(t+dur+0.2)});n.start(t);n.stop(t+dur+0.2);
  }else if(inst==='taiko'){
    const a=osc('sine',110);a.frequency.exponentialRampToValueAtTime(48,t+0.25);a.connect(out);
    const n=K(AC.createBufferSource());n.buffer=musNoise();const lp=K(AC.createBiquadFilter());lp.type='lowpass';lp.frequency.value=320;const ng=K(AC.createGain());ng.gain.setValueAtTime(0.5,t);ng.gain.exponentialRampToValueAtTime(0.001,t+0.12);n.connect(lp);lp.connect(ng);ng.connect(out);
    out.gain.setValueAtTime(0.9,t);out.gain.exponentialRampToValueAtTime(0.0001,t+0.5);a.start(t);a.stop(t+0.55);n.start(t);n.stop(t+0.2);
  }else if(inst==='shime'){
    const a=osc('triangle',330);a.frequency.exponentialRampToValueAtTime(220,t+0.06);a.connect(out);
    out.gain.setValueAtTime(0.35,t);out.gain.exponentialRampToValueAtTime(0.0001,t+0.12);a.start(t);a.stop(t+0.15);
  }else if(inst==='ka'){
    const n=K(AC.createBufferSource());n.buffer=musNoise();const hp=K(AC.createBiquadFilter());hp.type='highpass';hp.frequency.value=2500;n.connect(hp);hp.connect(out);
    out.gain.setValueAtTime(0.22,t);out.gain.exponentialRampToValueAtTime(0.0001,t+0.05);n.start(t);n.stop(t+0.06);
  }else if(inst==='kane'){
    const hp=K(AC.createBiquadFilter());hp.type='highpass';hp.frequency.value=1800;hp.connect(out);
    const a=osc('square',2240),b=osc('square',3170,9);a.connect(hp);b.connect(hp);
    out.gain.setValueAtTime(0.07,t);out.gain.exponentialRampToValueAtTime(0.0001,t+0.22);a.start(t);b.start(t);a.stop(t+0.25);b.stop(t+0.25);
  }
  const src=made.filter(n=>typeof n.stop==='function');let left=src.length;
  src.forEach(n=>{n.onended=()=>{if(--left>0)return;made.forEach(x=>{try{x.disconnect()}catch(e){}})}});
}

/* ======================= 曲目 ======================= */
/** 《市井囃子》（主畫面）：陽音階，D 調，前後兩段十六小節。 */
function songMarket(){
  const D3=50,G3=55,D4=62,E4=64,G4=67,A4=69,B4=71,D5=74,E5=76,G5=79,A2=45;
  const notes=[],mel=[
    [[D5,.5],[E5,.5],[D5,1],[B4,1],[A4,1]],[[G4,1],[A4,.5],[B4,.5],[A4,2]],
    [[D5,.5],[E5,.5],[G5,1],[E5,1],[D5,1]],[[B4,1],[D5,1],[E5,2]],
    [[G5,1],[E5,.5],[D5,.5],[B4,1],[D5,1]],[[E5,1],[D5,.5],[B4,.5],[A4,2]],
    [[G4,.5],[A4,.5],[B4,1],[A4,.5],[G4,.5],[E4,1]],[[D4,2],[0,2]],
    [[A4,1],[B4,1],[D5,1],[B4,1]],[[A4,.5],[G4,.5],[E4,1],[G4,2]],
    [[A4,1],[B4,1],[D5,.5],[E5,.5],[D5,1]],[[B4,3],[0,1]],
    [[E5,.5],[G5,.5],[E5,.5],[D5,.5],[B4,1],[D5,1]],[[E5,1],[G5,1],[E5,2]],
    [[D5,.5],[B4,.5],[A4,1],[G4,.5],[A4,.5],[B4,1]],[[D5,2],[0,2]]
  ];
  const root=[D3,G3,D3,A2,D3,G3,D3,D3, A2,G3,A2,D3,G3,A2,G3,D3];
  mel.forEach((bar,i)=>{
    const b=i*4;let x=b;
    bar.forEach(([m,d])=>{if(m)notes.push([m,x,d,'fue']);x+=d});
    const r=root[i];[r,r+7,r+12,r+7,r,r+7,r+12,r+7].forEach((m,k)=>notes.push([m,b+k*0.5,0.5,'shami']));
    if(i%8===7){[0,0.5,1,1.5,2,2.5,2.75,3,3.25,3.5,3.75].forEach(o=>notes.push([0,b+o,1,o<2?'taiko':'shime']));notes.push([0,b,1,'kane'])}
    else{[0,2,2.5].forEach(o=>notes.push([0,b+o,1,'taiko']));[1,3,3.5].forEach(o=>notes.push([0,b+o,1,'ka']));[0,1,2,3].forEach(o=>notes.push([0,b+o,1,'kane']));[0.5,1.5,2.5,3.5].forEach(o=>notes.push([0,b+o,1,'shime']))}
  });
  return {bpm:132,len:64,notes};
}
/** 《登門囃子》（拜訪戰鬥）：都節音階，D 調，八小節，帶一點緊張感。 */
function songVisit(){
  const D3=50,A3=57,D4=62,Eb4=63,G4=67,A4=69,Bb4=70,D5=74,C5=72;
  const notes=[];
  for(let bar=0;bar<8;bar++){
    const b=bar*4;
    if(bar<7){notes.push([0,b,1,'taiko'],[0,b+0.5,1,'ka'],[0,b+2,1,'taiko'],[0,b+3,1,'ka'],[0,b+3.5,1,'ka']);[0.5,1.5,2.5,3.5].forEach(o=>notes.push([0,b+o,1,'shime']))}
    else [0,0.5,1,1.5,2,2.25,2.5,2.75,3,3.25,3.5,3.75].forEach(o=>notes.push([0,b+o,1,o<2?'taiko':'shime']));
    const ost=bar%4===3?[D3,A3,D4,A3,Eb4,D4,A3,D4]:[D3,A3,D4,A3,Eb4,A3,D4,A3];
    ost.forEach((m,k)=>notes.push([m,b+k*0.5,0.5,'shami']));
  }
  [[A4,0,1],[Bb4,1,.5],[A4,1.5,.5],[G4,2,1],[Eb4,3,1],[D4,4,3],[G4,8,1],[A4,9,1],[Bb4,10,1],[D5,11,1],[A4,12,3],
   [D5,16,1],[C5,17,.5],[Bb4,17.5,.5],[A4,18,1],[Bb4,19,1],[A4,20,1],[G4,21,1],[Eb4,22,1],[G4,23,1],[A4,24,1.5],[G4,25.5,.5],[Eb4,26,1],[D4,27,1],[D4,28,3.5]]
   .forEach(([m,s,d])=>notes.push([m,s,d,'fue']));
  return {bpm:112,len:32,notes};
}
/** 《暖簾囃子》（片頭，人生終章）：D 調，十六小節。
 *  1～4 小節：箏獨奏引子（陽音階）；5～8：笛入，放慢的《市井囃子》開頭動機；
 *  9～12：借《登門囃子》的都節色彩（降 E、降 B），三味線頑固低音，略帶緊張；
 *  13～16：回到陽音階，全員齊奏收束，末小節太鼓連打，接回開頭循環。 */
function songTitle(){
  const A2=45,D3=50,E3=52,G3=55,A3=57,B3=59,D4=62,Eb4=63,E4=64,G4=67,A4=69,Bb4=70,B4=71,C5=72,D5=74,E5=76,G5=79,A5=81;
  const notes=[],N=(m,s,d,i)=>notes.push([m,s,d,i]);
  // 1～4：箏引子（分散和弦，低音箏打根音）
  const intro=[[D4,A4,D5,E5,D5,A4,G4,A4],[B3,G4,B4,D5,B4,A4,G4,E4],[A3,E4,A4,B4,A4,G4,E4,D4],[D4,A4,D5,G5,E5,D5,B4,A4]];
  intro.forEach((arp,bar)=>{const b=bar*4;arp.forEach((m,k)=>N(m,b+k*0.5,0.6,'koto'));N([D3,G3,A2,D3][bar],b,4,'kotoLow')});
  N(0,0,1,'kane');N(0,12,1,'taiko');N(0,14,1,'taiko');N(0,15,1,'taiko');N(0,15.5,1,'taiko');
  // 5～8：笛奏放慢的《市井囃子》動機，箏伴奏
  [[D5,16,.5],[E5,16.5,.5],[D5,17,1],[B4,18,1],[A4,19,1],[G4,20,1],[A4,21,.5],[B4,21.5,.5],[A4,22,2],
   [D5,24,.5],[E5,24.5,.5],[G5,25,1],[E5,26,1],[D5,27,1],[B4,28,1],[D5,29,1],[E5,30,2]].forEach(([m,s,d])=>N(m,s,d,'fue'));
  [[D3,A3,D4,A3],[G3,D4,G4,D4],[D3,A3,D4,A3],[A2,E3,A3,E3]].forEach((r,i)=>{const b=16+i*4;r.forEach((m,k)=>N(m,b+k,1,'kotoLow'))});
  for(let b=16;b<32;b+=4){N(0,b,1,'taiko');N(0,b+2,1,'ka');N(0,b,1,'kane');N(0,b+2,1,'kane')}
  // 9～12：都節色彩，三味線頑固低音
  for(let bar=8;bar<12;bar++){const b=bar*4;
    (bar===11?[D3,A3,D4,A3,Eb4,D4,A3,D4]:[D3,A3,D4,A3,Eb4,A3,D4,A3]).forEach((m,k)=>N(m,b+k*0.5,0.5,'shami'));
    N(0,b,1,'taiko');N(0,b+0.5,1,'ka');N(0,b+2,1,'taiko');N(0,b+3,1,'ka');[0.5,1.5,2.5,3.5].forEach(o=>N(0,b+o,1,'shime'))}
  [[A4,32,1],[Bb4,33,.5],[A4,33.5,.5],[G4,34,1],[Eb4,35,1],[D4,36,3],[G4,40,1],[A4,41,1],[Bb4,42,1],[D5,43,1],[C5,44,1],[Bb4,45,1],[A4,46,2]].forEach(([m,s,d])=>N(m,s,d,'fue'));
  // 13～16：回陽音階，全員收束
  [[G5,48,1],[E5,49,.5],[D5,49.5,.5],[B4,50,1],[D5,51,1],[E5,52,1],[D5,53,.5],[B4,53.5,.5],[A4,54,2],
   [G4,56,.5],[A4,56.5,.5],[B4,57,1],[A4,58,.5],[G4,58.5,.5],[E4,59,1],[D4,60,3]].forEach(([m,s,d])=>N(m,s,d,'fue'));
  [[G5,48],[E5,52],[B4,56],[D5,60]].forEach(([m,s])=>N(m,s,1.5,'koto'));
  [G3,A2,G3,D3].forEach((r,i)=>{const b=48+i*4;[r,r+7,r+12,r+7,r,r+7,r+12,r+7].forEach((m,k)=>N(m,b+k*0.5,0.5,'shami'))});
  for(let b=48;b<60;b+=4){[0,2,2.5].forEach(o=>N(0,b+o,1,'taiko'));[1,3,3.5].forEach(o=>N(0,b+o,1,'ka'));[0,1,2,3].forEach(o=>N(0,b+o,1,'kane'))}
  [0,0.5,1,1.5,2,2.25,2.5,2.75,3,3.25,3.5,3.75].forEach(o=>N(0,60+o,1,o<2?'taiko':'shime'));N(0,60,1,'kane');N(A5,63,1,'koto');
  return {bpm:96,len:64,notes};
}
const SONGS={market:songMarket,visit:songVisit,title:songTitle};

/* ======================= 播放 ======================= */
/** 想播的曲子（market／visit／title；null＝停止）；音樂關閉或還沒有使用者點擊時只記下，等可以時再播。 */
function musicWant(key){MUS.want=key;musicSync()}
/** 依設定與想播的曲子，開始、換曲或停止。 */
function musicSync(){
  if(!AC)return;
  const key=AUDIO.music?MUS.want:null;
  if(key===MUS.key)return;
  musicStop();if(!key)return;
  if(AC.state==='suspended')AC.resume();
  const out=musOut(),S=SONGS[key](),spb=60/S.bpm,list=S.notes.slice().sort((a,b)=>a[1]-b[1]);
  const P={S,spb,list,i:0,t0:AC.currentTime+0.1,timer:null};MUS.play=P;MUS.key=key;
  out.gain.cancelScheduledValues(AC.currentTime);out.gain.setValueAtTime(0.0001,AC.currentTime);out.gain.linearRampToValueAtTime(audioGain()*0.55,AC.currentTime+0.6);
  const tick=()=>{
    if(MUS.play!==P)return;const ahead=AC.currentTime+0.25;
    while(true){
      if(P.i>=P.list.length){P.i=0;P.t0+=P.S.len*P.spb}
      const n=P.list[P.i],t=P.t0+n[1]*P.spb;if(t>ahead)break;
      if(t>=AC.currentTime-0.02)try{musVoice(n[3],n[0],t,n[2]*P.spb)}catch(e){}
      P.i++;
    }
  };
  P.timer=setInterval(tick,25);tick();
}
function musicStop(){if(MUS.play){clearInterval(MUS.play.timer);MUS.play=null}MUS.key=null}
/* 切到背景時暫停，回來再繼續 */
document.addEventListener('visibilitychange',()=>{if(!AC)return;if(document.hidden)AC.suspend();else AC.resume()});
/* 手機：第一次點擊時喚醒音訊 */
document.addEventListener('pointerdown',()=>{if(AC&&AC.state==='suspended'&&!document.hidden)AC.resume();if(MUS.want&&!MUS.key)musicSync()},{passive:true});

/* ======================= 設定面板（選單最上方） ======================= */
function audioSettingsHtml(){
  const sw=(k,on,lb)=>'<button class="pixel-btn btn-sm '+(on?'btn-gold':'')+'" data-act="audioToggle" data-k="'+k+'" style="flex:1">'+UT('music.sw.3',{a:lb,b:on?UT('music.sw'):UT('music.sw.2')})+'</button>';
  return UT('music.audioSettingsHtml.3',{a:sw('music',AUDIO.music,UT('music.audioSettingsHtml')),b:sw('sfx',AUDIO.sfx,UT('music.audioSettingsHtml.2'))})+'</div>'+UT('music.audioSettingsHtml.4',{a:AUDIO.vol})+'" data-audio="vol" style="flex:1"><b id="audio-vol">'+AUDIO.vol+'</b></div>'+UT('music.audioSettingsHtml.5');
}
ACT.audioToggle=el=>{const k=el.dataset.k;AUDIO[k]=!AUDIO[k];audioSave();audioApply();musicSync();if(AUDIO.sfx)sfx.tap();refreshSheet()};
document.addEventListener('input',e=>{if(e.target.dataset&&e.target.dataset.audio==='vol'){AUDIO.vol=+e.target.value;const v=$('#audio-vol');if(v)v.textContent=AUDIO.vol;audioApply();audioSave()}});
audioApply();
