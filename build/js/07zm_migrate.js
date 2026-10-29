'use strict';
/* ======================= 存檔補欄位：讀檔與匯入的統一入口 =======================
 *  - 讀本機存檔（ACT.resume）與匯入 .sav（importSaveFile）都經過 enterSave → migrateSave。
 *  - 原則（第十五節、0.8 乙方案）：缺少的欄位一律視為「還沒發生過」，補上預設值後改標為目前版本。
 *  - 新增存檔欄位時，在這裡補一行預設值；接受的舊版本列在 SAVE_VERS（01_core.js）。 */
function migrateSave(){
  if(!G)return;
  G.flags=G.flags||{};
  sanitizeIntros();                                 // 介紹人名單：去掉已不能當介紹人的人
  officialMigrate();                                // 已刪除的官職換新；本城缺的官署席位由名冊補上
  if(G.fameFloor===undefined)G.fameFloor=0;          // 永久知名度下限（新町取立、國產取立）
  if(!G.caughtLog)G.caughtLog={};                    // 違約查獲的公開紀錄（公會長候選人用）
  if(!G.cityRoutes)G.cityRoutes={};                  // 後天開通的海運（外港開闢）
  if(!G.openedRoads)G.openedRoads=[];                // 開闢的道路（地區 id）
  if(!G.debts)G.debts=[];
  G.ver=GAME_VER;
}
