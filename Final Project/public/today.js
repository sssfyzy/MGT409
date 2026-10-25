import {eligible,validateSettings} from './planner.js';
export function localDay(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
export const TODAY_SLOTS=['Lunch','Dinner'];
// Cafe George publishes lunch service ending at 2pm; never propose it as dinner.
// Other venues still require live operating-status confirmation.
export const supportsPeriod=(meal,period)=>period!=='Dinner'||!meal.id.startsWith('cg-');
export function validToday(id,settings,catalogue,period='Lunch'){return validateSettings(settings)&&eligible(settings,catalogue).some(m=>m.id===id&&supportsPeriod(m,period));}
const settingKeys=['budget','perMealBudget','target','tax','tip','walk','vegetarian','allowUnknownWalk','fulfillment','deliveryFee','serviceFeePercent','extraReserve','deliveryEstimateAccepted'];
const safeSettings=s=>Object.fromEntries(settingKeys.filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));
export function todayRecord(ids,settings,catalogue,now=new Date()){
 if(!Array.isArray(ids)||ids.length!==2||!ids.every((id,i)=>validToday(id,settings,catalogue,TODAY_SLOTS[i])))return null;
 return {version:2,date:localDay(now),mealIds:[...ids],settings:safeSettings(settings)};
}
export function restoreToday(record,catalogue,now=new Date()){
 if(!record||record.date!==localDay(now))return null;
 if(record.version===2)return todayRecord(record.mealIds,record.settings,catalogue,now);
 // Keep an existing lunch as an unfinished draft; never fabricate a dinner.
 if(record.version===1&&validToday(record.mealId,record.settings,catalogue))return {version:2,date:record.date,mealIds:[record.mealId],settings:safeSettings(record.settings),partial:true};
 return null;
}
// Exaggerated remaining-budget avatar, not the user's bank balance.
export function walletPose(left,cap){const ratio=Math.max(0,Math.min(1,left/Math.max(1,cap)));return {ratio,scaleY:.12+1.48*ratio**1.15,scaleX:.82+.4*ratio,bills:Math.ceil(ratio*5),state:ratio<.2?'flat':ratio>.55?'plump':'okay'};}
