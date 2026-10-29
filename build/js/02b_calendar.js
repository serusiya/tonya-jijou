'use strict';
/* ======================= 例會曆法（0.8 公會例會、遷居共用） =======================
 *  - 一年 12 月、每月三旬（上、中、下）；新年在一月上旬。
 *  - 問屋公會例會固定在 1、4、7、10 月的上旬（一年四次，每期九旬）。
 *  - 這裡只提供日期換算與查詢，目前的公會規則尚未改用（0.8 才接上）。 */
/** 例會的月份。 */
const MEET_MONTHS=[1,4,7,10];
/** 某個月、旬是否為例會旬（month 1～12，cycle 1～3）。 */
const isMeetingDate=(month,cycle)=>cycle===1&&MEET_MONTHS.includes(month);
/** 本旬是否為例會旬。 */
const isMeetingTurn=()=>!!G&&isMeetingDate(G.month,G.cycle);
/** 從本旬起算 n 旬後的日期：{month,cycle,year}。 */
function dateAfter(n){
  let m=G.month,c=G.cycle,y=G.year;
  for(let i=0;i<n;i++){c++;if(c>3){c=1;m++;if(m>12){m=1;y++}}}
  return {month:m,cycle:c,year:y};
}
/** 到第 k 個例會旬還有幾旬（k 從 1 起算）；inclNow＝本旬若是例會旬就算第一個。 */
function turnsToMeeting(k,inclNow){
  let left=k||1;
  for(let n=inclNow?0:1;n<=12*3*2;n++){
    const d=dateAfter(n);if(!isMeetingDate(d.month,d.cycle))continue;
    if(--left===0)return n;
  }
  return null;
}
/** 日期文字：「七月上旬」。 */
const dateLabel=d=>['','一','二','三','四','五','六','七','八','九','十','十一','十二'][d.month]+'月'+CYCLE_NAMES[d.cycle-1];
