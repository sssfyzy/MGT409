import { meals } from './data.js';
import {priceBreakdown,channelAllowed} from './recommendations.js';
export const byId=(id,catalogue=meals)=>catalogue.find(m=>m.id===id);
export function validateSettings(s){
 if(s?.fulfillment!==undefined&&!['pickup','dinein','delivery'].includes(s.fulfillment))return false;
 for(const [key,max] of [['deliveryFee',50],['serviceFeePercent',50],['extraReserve',50]])if(s?.[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<0||s[key]>max))return false;
 if(s?.fulfillment==='delivery'&&s.deliveryEstimateAccepted!==true)return false;
 if(s?.perMealBudget!==undefined&&(!Number.isFinite(s.perMealBudget)||s.perMealBudget<1||s.perMealBudget>200||Math.abs(s.budget-s.perMealBudget*5)>.011))return false;
 return !!s && typeof s==='object' && typeof s.vegetarian==='boolean' && (s.allowUnknownWalk===undefined || typeof s.allowUnknownWalk==='boolean') && Number.isFinite(s.budget) && s.budget>=1 && s.budget<=1000 && Number.isFinite(s.target) && s.target>=300 && s.target<=1500 && Number.isFinite(s.tax) && s.tax>=0 && s.tax<=25 && Number.isFinite(s.tip) && s.tip>=0 && s.tip<=40 && Number.isFinite(s.walk) && s.walk>=1 && s.walk<=60;
}
export const cost=(meal,s)=>priceBreakdown(meal,s).total;
export function summary(plan,s,catalogue=meals){
 const selected=plan.map(id=>byId(id,catalogue)).filter(Boolean);
 const total=Math.round(selected.reduce((a,m)=>a+cost(m,s),0)*100)/100;
 const energy=selected.filter(m=>Number.isFinite(m.kcal));const protein=selected.filter(m=>Number.isFinite(m.protein));
 return {total,remaining:Math.round((s.budget-total)*100)/100,average:energy.length===selected.length && energy.length?Math.round(energy.reduce((a,m)=>a+m.kcal,0)/energy.length):null,protein:protein.length===selected.length && protein.length?Math.round(protein.reduce((a,m)=>a+m.protein,0)/protein.length):null,vegetableMeals:selected.filter(m=>Number.isFinite(m.vegetables) && m.vegetables>=2).length,count:selected.length,nutritionKnown:energy.length,nutritionEstimated:energy.filter(m=>m.nutritionEstimate).length,unknownWalks:selected.filter(m=>!Number.isFinite(m.walk)).length};
}
export function eligible(s,catalogue=meals){return catalogue.filter(m=>channelAllowed(m,s)&&(s.perMealBudget===undefined||cost(m,s)<=s.perMealBudget+.001)&&(Number.isFinite(m.walk)?m.walk<=s.walk:s.allowUnknownWalk===true) && (!s.vegetarian || m.vegetarian));}
// Randomness only picks among checked swaps; never relax the cap, diet, walk or locks.
export function surprise(plan,s,locked={},catalogue=meals,random=Math.random){
 if(!validatePlan(plan,s,catalogue).valid)return null;
 const options=[];
 for(let i=0;i<5;i++){if(locked[i])continue;for(const meal of eligible(s,catalogue)){if(meal.id===plan[i])continue;const candidate=[...plan];candidate[i]=meal.id;if(validatePlan(candidate,s,catalogue).valid)options.push({plan:candidate,day:i});}}
 if(!options.length)return null;
 return options[Math.min(options.length-1,Math.max(0,Math.floor(random()*options.length)))];
}
// Bounded five-meal search. Hard constraints: budget, diet, walking rule, kept slots.
export function generate(s,mode='balanced',locked={},catalogue=meals){
 if(!validateSettings(s))return null;
 const pool=eligible(s,catalogue);let best=null;let score=Infinity;
 function visit(plan,spent){
  if(spent>s.budget+.001)return;
  if(plan.length===5){
   const chosen=plan.map(id=>byId(id,catalogue));const variety=new Set(plan).size;
   const energy=chosen.reduce((a,m)=>a+(Number.isFinite(m.kcal)?Math.abs(m.kcal-s.target)/s.target:0),0);
   const veg=chosen.filter(m=>Number.isFinite(m.vegetables)&&m.vegetables>=2).length;
   const restaurantVariety=new Set(chosen.map(m=>m.restaurant)).size;
   const value=(mode==='save'?spent/s.budget*8:energy*2+spent/s.budget*.3)+(5-variety)*3+(5-veg)*.25+(5-restaurantVariety)*.1;
   if(value<score){best=[...plan];score=value;}return;
  }
  const choices=locked[plan.length]?pool.filter(m=>m.id===locked[plan.length]):pool;
  for(const m of choices)visit([...plan,m.id],spent+cost(m,s));
 }
 visit([],0);return best;
}
export function validatePlan(plan,s,catalogue=meals){
 if(!validateSettings(s))return {valid:false,errors:['Invalid settings']};
 if(!Array.isArray(plan)||plan.length!==5||!plan.every(id=>typeof id==='string'&&byId(id,catalogue)))return {valid:false,errors:['Expected five known meal IDs']};
 const allowed=new Set(eligible(s,catalogue).map(m=>m.id));const errors=[];
 if(plan.some(id=>!allowed.has(id)))errors.push('A meal violates the per-meal cap, diet or walking rule');
 const totals=summary(plan,s,catalogue);if(totals.remaining<0)errors.push('Plan exceeds the weekly budget');
 return {valid:errors.length===0,errors,summary:totals};
}
