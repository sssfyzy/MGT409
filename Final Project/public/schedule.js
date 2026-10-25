import {cost,summary,validateSettings,validatePlan,byId} from './planner.js';
import {priceBreakdown,restaurantFor} from './recommendations.js';
const iso=date=>date.toISOString().slice(0,10);
export function parseDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Choose a valid calendar date.');
 const date=new Date(value+'T12:00:00Z');
 if(!Number.isFinite(date.getTime())||iso(date)!==value)throw new Error('Choose a valid calendar date.');
 return date;
}
export function isMonday(value){try{return parseDate(value).getUTCDay()===1;}catch{return false;}}
export function nextMonday(now=new Date()){
 const date=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate(),12));
 const offset=(8-date.getUTCDay())%7;date.setUTCDate(date.getUTCDate()+offset);return iso(date);
}
export function weekDates(monday){if(!isMonday(monday))throw new Error('The lunch week must start on a Monday.');const start=parseDate(monday);return Array.from({length:5},(_,i)=>{const day=new Date(start);day.setUTCDate(day.getUTCDate()+i);return iso(day);});}
export function moveMeal(plan,from,to,locked={}){
 if(!Array.isArray(plan)||plan.length!==5||![from,to].every(i=>Number.isInteger(i)&&i>=0&&i<5))throw new Error('Invalid meal move.');
 if(locked[from]||locked[to])throw new Error('Unkeep those meals before changing their days.');
 const result=[...plan];[result[from],result[to]]=[result[to],result[from]];return result;
}
function escapeText(value){return String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
// RFC 5545 physical lines: fold by UTF-8 octet count, never inside a code point.
export function foldLine(line){let current='',size=0;const result=[];for(const c of line){const bytes=new TextEncoder().encode(c).length;if(size+bytes>75){result.push(current);current=' ';size=1;}current+=c;size+=bytes;}result.push(current);return result.join('\r\n');}
export function calendar(plan,settings,monday,catalogue,dataset='local',now=new Date()){
 const dates=weekDates(monday);
 if(!validateSettings(settings)||!Array.isArray(plan)||plan.length!==5||!plan.every(id=>byId(id,catalogue)))throw new Error('Cannot export an invalid plan.');
 const stamp=now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//BellyBank//Lunch Planner//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 plan.forEach((id,i)=>{const m=byId(id,catalogue);const next=parseDate(dates[i]);next.setUTCDate(next.getUTCDate()+1);
  const p=priceBreakdown(m,settings),venue=restaurantFor(m);
  const description=[dataset==='demo'?'FICTIONAL DEMO — not a real restaurant.':'Planned lunch — not a booking or live quote.',`Food starting price: USD ${p.base.toFixed(2)}; estimated all-in USD ${cost(m,settings).toFixed(2)}.`,`Mode: ${settings.fulfillment||'pickup'}; tax assumption ${settings.tax}%; tip assumption ${settings.tip}%.`,p.delivery?`Delivery USD ${p.deliveryFee}; service USD ${p.service}; extras reserve USD ${p.reserve}. Fees are assumptions, not a checkout quote. One meal per order. Confirm final price and address coverage: ${venue?.delivery||'No verified channel'}`:'Premium additions and drinks excluded. Confirm seating and opening status.',m.source?`Source: ${m.source}; observed ${m.observed}.`:'Illustrative demo data.',Number.isFinite(m.kcal)?`${m.nutritionEstimate?"Rough calorie estimate (not restaurant verified)":"Demo energy"}: ${m.kcal} kcal.`:'Nutrition unknown.',m.note||''].filter(Boolean).join('\n');
  lines.push('BEGIN:VEVENT',`UID:${dates[i]}-${id}@belly-budget.local`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${dates[i].replaceAll('-','')}`,`DTEND;VALUE=DATE:${iso(next).replaceAll('-','')}`,`SUMMARY:${escapeText(`${dataset==='demo'?'[DEMO] ':''}Lunch: ${m.name}`)}`,`LOCATION:${escapeText(m.address||m.restaurant)}`,`DESCRIPTION:${escapeText(description)}`,'TRANSP:TRANSPARENT','END:VEVENT');
 });
 lines.push('END:VCALENDAR');return lines.map(foldLine).join('\r\n')+'\r\n';
}
export function exportPlan(state,monday,catalogue){
 weekDates(monday);
 return {format:'belly-budget-plan',version:1,monday,dataset:state.dataset,plan:[...state.plan],settings:{...state.settings},locked:{...state.locked},summary:summary(state.plan,state.settings,catalogue),dataNotice:state.dataset==='demo'?'Fictional demo data':'Published price snapshots; calories are rough estimates, not restaurant verified. Protein and walking times unknown.'};
}
export function importPlan(value,catalogues){
 if(!value||value.format!=='belly-budget-plan'||value.version!==1||!Object.hasOwn(catalogues,value.dataset)||!isMonday(value.monday))throw new Error('This is not a supported lunch-plan backup.');
 const catalogue=catalogues[value.dataset];const checked=validatePlan(value.plan,value.settings,catalogue);
 if(!checked.valid)throw new Error('Backup fails current menu, budget or diet checks. Your current plan is unchanged.');
 const locked=value.locked||{};
 if(typeof locked!=='object'||Array.isArray(locked)||Object.entries(locked).some(([i,id])=>! /^[0-4]$/.test(i)||value.plan[Number(i)]!==id))throw new Error('Backup contains invalid kept meals.');
 // Pick known fields; do not preserve attacker-provided totals, HTML, URLs or extra settings.
 const s=value.settings;
 const channel=Object.fromEntries(['fulfillment','deliveryFee','serviceFeePercent','extraReserve','deliveryEstimateAccepted'].filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));
 return {monday:value.monday,state:{dataset:value.dataset,plan:[...value.plan],locked:{...locked},settings:{budget:s.budget,...(s.perMealBudget===undefined?{}:{perMealBudget:s.perMealBudget}),...channel,target:s.target,tax:s.tax,tip:s.tip,walk:s.walk,vegetarian:s.vegetarian,allowUnknownWalk:s.allowUnknownWalk===true}}};
}
