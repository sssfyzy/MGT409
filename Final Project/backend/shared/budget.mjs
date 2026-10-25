import {equalShares,balances,settlements} from '../../public/event-core.js';
import {fail} from './security.mjs';

const clean=(value,max,label)=>{const text=String(value??'').trim();if(!text||text.length>max||/[\r\n]/.test(text))fail(400,`Enter ${label} (up to ${max} characters).`);return text;};
const cents=(value,label)=>{if(!Number.isSafeInteger(value)||value<0||value>10000000)fail(400,`Enter a valid ${label} between $0 and $100,000.`);return value;};
export function budgetItem(body){return {category:clean(body.category,40,'a category'),name:clean(body.name,100,'an item'),quantity:clean(body.quantity,20,'a quantity'),unit:clean(body.unit,20,'a unit'),budgetCents:cents(body.budgetCents,'budget'),note:String(body.note??'').trim().slice(0,200)};}
export function budgetLedger(row){
 const items=row.budgetItems||[],paidItems=items.filter(item=>item.actualCents>0&&item.claimantId);
 const active=row.event.people.filter(p=>row.rsvps[p.id]==='accepted'&&!row.groupGuests?.[p.id]?.removed).map(p=>p.id);
 const payerIds=paidItems.map(item=>item.claimantId);
 const ids=[...new Set([...active,...payerIds,...row.event.expenses.map(e=>e.payerId),...row.event.expenses.flatMap(e=>e.shares.map(s=>s.personId))])];
 if(!active.length)return null;
 return {...row.event,people:row.event.people.filter(p=>ids.includes(p.id)),expenses:[...row.event.expenses,...paidItems.map(item=>({id:'budget-'+item.id,label:item.name,amountCents:item.actualCents,payerId:item.claimantId,activityId:'',shares:equalShares(item.actualCents,active)}))],transfers:row.event.transfers.filter(t=>ids.includes(t.fromId)&&ids.includes(t.toId))};
}
export function budgetSplit(row){
 const items=row.budgetItems||[],event=budgetLedger(row);
 if(!event)return {budgetCents:items.reduce((n,item)=>n+item.budgetCents,0),actualCents:0,people:[],transfers:[]};
 return {budgetCents:items.reduce((n,item)=>n+item.budgetCents,0),actualCents:items.reduce((n,item)=>n+item.actualCents,0)+row.event.expenses.reduce((n,e)=>n+e.amountCents,0),people:balances(event).map(({id,name,paid,share,net})=>({id,name,paid,share,net})),transfers:settlements(event)};
}
export {cents as budgetCents};
