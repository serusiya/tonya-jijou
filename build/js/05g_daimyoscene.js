'use strict';
/* ======================= 大名行列過境當旬的宅邸場景 =======================
 *  - 只在大名行列過境那一旬畫（07zzc_daimyo.js 的 daimyoActive）；下一旬回到平日。
 *  - 行列從畫面一端走到另一端，走完隔幾秒再來一趟：先頭毛槍兩人、挾箱、徒士武士、大名的駕籠、殿後武士。
 *  - 路人跪在路邊，不走動。沿用場景每秒 30 格與看不見時暫停（05_scene.js）。
 *  - 由 drawScene 呼叫；行列與路人都不可點選。 */
const DMY={key:'',proc:null,next:0,kneel:[]};
/** 這一旬要不要畫行列。 */
const daimyoScene=()=>!!(G&&typeof daimyoActive==='function'&&daimyoActive());
/** 行列的組成（由前到後）：種類與佔的寬度。 */
const DMY_TRAIN=[['spear',12],['spear',12],['box',24],['foot',11],['foot',11],['foot',11],['kago',42],['foot',11],['foot',11]];
const DMY_FOOT={cloth:'#3a3a44',cloth2:'#8a8a96',sword:true};
const DMY_SPEAR={cloth:'#27324a',cloth2:'#e8dcc4',hat:'#1a1612'};
const DMY_BEARER={cloth:'#f4ece1',cloth2:'#27324a',hat:'#1a1612'};
/** 換旬時重建跪在路邊的人。 */
function dmySync(now){
  const key='d'+G.turn;if(DMY.key===key)return;
  DMY.key=key;DMY.proc=null;DMY.next=now+1500;DMY.kneel=[];
  const n=4+Math.floor(Math.random()*3);
  for(let i=0;i<n;i++)DMY.kneel.push({x:24+i*(272/n)+Math.random()*24,y:128+Math.random()*8,left:Math.random()<0.5,
    look:{cloth:FEST_CLOTH[i%FEST_CLOTH.length],woman:Math.random()<0.45}});
}
/** 跪在路邊、低頭的路人。 */
function drawKneel(c,p){
  const x=Math.round(p.x),y=Math.round(p.y),d=p.left?-1:1;
  R_(c,x-5,y-1,10,2,'#0003');
  R_(c,x-4,y-3,8,3,p.look.cloth);                       // 跪坐的腿
  R_(c,x-3+d,y-8,6,5,p.look.cloth);                     // 前傾的身子
  if(p.look.woman)R_(c,x-3+d,y-6,6,1,'#e0b030');
  const hx=x+(d>0?2:-6);
  R_(c,hx,y-9,4,4,'#f1c9a0');R_(c,hx,y-9,4,2,'#1a1612');  // 低下的頭
}
/** 行列本身與路人的繪製項目（與家中角色一起依 y 排序）。 */
function dmyPeople(now,dt){
  const out=DMY.kneel.map(p=>({y:p.y,draw:c=>drawKneel(c,p)}));
  const len=DMY_TRAIN.reduce((a,u)=>a+u[1],0);
  if(!DMY.proc&&now>=DMY.next){const dir=Math.random()<0.5?1:-1;DMY.proc={x:dir>0?-10:330,dir,frame:0,ft:0}}
  const P=DMY.proc;if(!P)return out;
  P.x+=P.dir*11*dt/1000;P.ft+=dt;if(P.ft>200){P.ft=0;P.frame++}
  if(P.dir>0?P.x-len>340:P.x+len<-20){DMY.proc=null;DMY.next=now+6000+Math.random()*6000;return out}
  const y=154;let off=0;
  DMY_TRAIN.forEach(([k,w],i)=>{
    const cx=P.x-P.dir*(off+w/2),fl=P.dir<0,fr=P.frame+i;off+=w;
    if(cx<-30||cx>350)return;
    out.push({y,draw:c=>dmyUnit(c,k,cx,y,fr,fl)});
  });
  return out;
}
/** 畫行列中的一個單位。 */
function dmyUnit(c,k,cx,y,f,fl){
  const x=Math.round(cx);
  if(k==='foot'){drawPerson(c,x,y,Object.assign({frame:f,faceLeft:fl},DMY_FOOT));return}
  if(k==='spear'){                                      // 毛槍：長槍頂端一團黑毛
    drawPerson(c,x,y,Object.assign({frame:f,faceLeft:fl},DMY_SPEAR));
    const px=x+(fl?-4:3);R_(c,px,y-30,1,22,'#6b4a2a');R_(c,px-2,y-35,5,6,'#141210');R_(c,px,y-37,1,2,'#d8d8d8');
    return;
  }
  const bob=f%2;
  if(k==='box'){                                        // 挾箱：兩人挑一只黑漆箱
    [-6,6].forEach((dx,i)=>drawPerson(c,x+dx,y,Object.assign({frame:f+i,faceLeft:fl},DMY_BEARER)));
    R_(c,x-10,y-17-bob,20,1,'#6b4a2a');
    R_(c,x-4,y-23-bob,8,6,'#1a1612');R_(c,x-4,y-23-bob,8,1,'#e5a93b');R_(c,x-1,y-21-bob,2,2,'#e5a93b');
    return;
  }
  /* 駕籠：四人扛著大名的轎子 */
  const ky=y-bob;
  R_(c,x-10,ky-18,20,16,'#17130f');
  R_(c,x-9,ky-17,18,14,'#8a633d');
  R_(c,x-7,ky-16,14,11,'#eadcb9');
  R_(c,x-7,ky-6,14,3,'#6b3f29');
  R_(c,x-5,ky-10,10,6,'#a43b32');
  R_(c,x-3,ky-15,6,5,'#edc69d');
  R_(c,x-3,ky-15,6,2,'#17130f');
  R_(c,x+(fl?-3:2),ky-12,1,1,'#5a2a22');
  R_(c,x-10,ky-21,20,3,'#17130f');
  R_(c,x-8,ky-22,16,1,'#d5b15b');
  R_(c,x-9,ky-18,2,15,'#2d241a');R_(c,x+7,ky-18,2,15,'#2d241a');
  [-17,17].forEach((dx,i)=>drawPerson(c,x+dx,y,Object.assign({frame:f+i,faceLeft:fl},DMY_BEARER)));
  R_(c,x-23,ky-19,46,2,'#3a2a1a');
  R_(c,x-23,ky-20,46,1,'#7b542c');
  return;
  R_(c,x-21,y-18-bob,42,2,'#3a2a1a');                    // 轎棒
  R_(c,x-8,y-30-bob,16,13,'#1a1612');R_(c,x-7,y-29-bob,14,11,'#5a2a2a');   // 轎身（黑漆、紅簾）
  R_(c,x-5,y-27-bob,10,5,'#e8dcc4');                    // 簾窗
  R_(c,x-10,y-33-bob,20,3,'#1a1612');R_(c,x-10,y-33-bob,20,1,'#e5a93b');   // 屋頂與金邊
}
