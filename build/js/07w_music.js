'use strict';
/* ======================= 配樂：江戶風 WebAudio 音序器 =======================
 *  - 不用任何音檔：樂曲存成音符表 [MIDI 音高, 起始拍, 拍長, 樂器]（音高 0＝休止），即時合成。
 *  - 樂器：koto 箏、kotoLow 低音箏、shami 三味線、fue 笛、taiko 大太鼓、shime 締太鼓、ka 鼓邊、kane 鉦。
 *  - 曲目：market《市井囃子》（主畫面，陽音階）、visit《登門囃子》（拜訪戰鬥，都節音階）；皆依祭典囃子形式編排，非特定曲目。
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
  const out=AC.createGain();out.connect(MUS.out);
  const env=(g,a,peak,decay,sustain,rel)=>{g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(Math.max(0.0001,peak*sustain),t+a+decay);g.gain.exponentialRampToValueAtTime(0.0001,t+Math.max(dur,a+decay)+rel)};
  const osc=(type,f,det)=>{const o=AC.createOscillator();o.type=type;o.frequency.setValueAtTime(f,t);if(det)o.detune.value=det;return o};
  if(inst==='koto'||inst==='kotoLow'){
    const f=mtof(midi),lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(inst==='koto'?4200:1600,t);lp.frequency.exponentialRampToValueAtTime(inst==='koto'?900:400,t+0.6);lp.connect(out);
    const a=osc('triangle',f),b=osc('square',f,7),c=osc('sine',f*2),gb=AC.createGain(),gc=AC.createGain();gb.gain.value=0.18;gc.gain.value=0.25;
    a.connect(lp);b.connect(gb);gb.connect(lp);c.connect(gc);gc.connect(lp);
    env(out,0.004,inst==='koto'?0.42:0.3,inst==='koto'?0.9:1.2,0.05,0.4);[a,b,c].forEach(o=>{o.start(t);o.stop(t+dur+1.6)});
  }else if(inst==='shami'){
    const f=mtof(midi),bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=f*3;bp.Q.value=1.2;bp.connect(out);
    const a=osc('sawtooth',f),b=osc('square',f*2.01),gb=AC.createGain();gb.gain.value=0.3;a.connect(bp);b.connect(gb);gb.connect(bp);
    env(out,0.002,0.55,0.18,0.02,0.08);[a,b].forEach(o=>{o.start(t);o.stop(t+dur+0.5)});
  }else if(inst==='fue'){
    const f=mtof(midi),a=osc('sine',f),b=osc('triangle',f*2),gb=AC.createGain();gb.gain.value=0.12;
    const lfo=AC.createOscillator(),lg=AC.createGain();lfo.frequency.value=5.5;lg.gain.setValueAtTime(0,t);lg.gain.linearRampToValueAtTime(f*0.012,t+Math.min(0.35,dur*0.6));lfo.connect(lg);lg.connect(a.frequency);lg.connect(b.frequency);
    a.connect(out);b.connect(gb);gb.connect(out);
    const n=AC.createBufferSource();n.buffer=musNoise();const nf=AC.createBiquadFilter();nf.type='bandpass';nf.frequency.value=f*2;nf.Q.value=2;const ng=AC.createGain();ng.gain.value=0.025;n.connect(nf);nf.connect(ng);ng.connect(out);
    out.gain.setValueAtTime(0.0001,t);out.gain.linearRampToValueAtTime(0.26,t+0.05);out.gain.setValueAtTime(0.24,t+Math.max(0.06,dur-0.06));out.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.12);
    [a,b,lfo].forEach(o=>{o.start(t);o.stop(t+dur+0.2)});n.start(t);n.stop(t+dur+0.2);
  }else if(inst==='taiko'){
    const a=osc('sine',110);a.frequency.exponentialRampToValueAtTime(48,t+0.25);a.connect(out);
    const n=AC.createBufferSource();n.buffer=musNoise();const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=320;const ng=AC.createGain();ng.gain.setValueAtTime(0.5,t);ng.gain.exponentialRampToValueAtTime(0.001,t+0.12);n.connect(lp);lp.connect(ng);ng.connect(out);
    out.gain.setValueAtTime(0.9,t);out.gain.exponentialRampToValueAtTime(0.0001,t+0.5);a.start(t);a.stop(t+0.55);n.start(t);n.stop(t+0.2);
  }else if(inst==='shime'){
    const a=osc('triangle',330);a.frequency.exponentialRampToValueAtTime(220,t+0.06);a.connect(out);
    out.gain.setValueAtTime(0.35,t);out.gain.exponentialRampToValueAtTime(0.0001,t+0.12);a.start(t);a.stop(t+0.15);
  }else if(inst==='ka'){
    const n=AC.createBufferSource();n.buffer=musNoise();const hp=AC.createBiquadFilter();hp.type='highpass';hp.frequency.value=2500;n.connect(hp);hp.connect(out);
    out.gain.setValueAtTime(0.22,t);out.gain.exponentialRampToValueAtTime(0.0001,t+0.05);n.start(t);n.stop(t+0.06);
  }else if(inst==='kane'){
    const hp=AC.createBiquadFilter();hp.type='highpass';hp.frequency.value=1800;hp.connect(out);
    const a=osc('square',2240),b=osc('square',3170,9);a.connect(hp);b.connect(hp);
    out.gain.setValueAtTime(0.07,t);out.gain.exponentialRampToValueAtTime(0.0001,t+0.22);a.start(t);b.start(t);a.stop(t+0.25);b.stop(t+0.25);
  }
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
const SONGS={market:songMarket,visit:songVisit};

/* ======================= 播放 ======================= */
/** 想播的曲子（market／visit）；音樂關閉或還沒有使用者點擊時只記下，等可以時再播。 */
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
  const sw=(k,on,lb)=>'<button class="pixel-btn btn-sm '+(on?'btn-gold':'')+'" data-act="audioToggle" data-k="'+k+'" style="flex:1">'+lb+'：'+(on?'開':'關')+'</button>';
  return '<div class="card"><b class="small">🎵 聲音</b><div class="row" style="gap:6px;margin-top:5px">'+sw('music',AUDIO.music,'音樂')+sw('sfx',AUDIO.sfx,'音效')+'</div>'
    +'<div class="row small" style="gap:6px;margin-top:6px"><span>音量</span><input type="range" min="0" max="100" value="'+AUDIO.vol+'" data-audio="vol" style="flex:1"><b id="audio-vol">'+AUDIO.vol+'</b></div>'
    +'<div class="tiny muted" style="margin-top:3px">主畫面《市井囃子》、拜訪《登門囃子》。設定只存在這台裝置的瀏覽器。</div></div>';
}
ACT.audioToggle=el=>{const k=el.dataset.k;AUDIO[k]=!AUDIO[k];audioSave();audioApply();musicSync();if(AUDIO.sfx)sfx.tap();refreshSheet()};
document.addEventListener('input',e=>{if(e.target.dataset&&e.target.dataset.audio==='vol'){AUDIO.vol=+e.target.value;const v=$('#audio-vol');if(v)v.textContent=AUDIO.vol;audioApply();audioSave()}});
audioApply();
