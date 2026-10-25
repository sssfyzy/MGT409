import {normalizeEvent,validateExpense,balances,settlements,uid,dayString,MAX_CENTS} from './event-core.js';
export const GROUP_SPLIT_KEY='holysplit-group-input-v1';
export function freshGroup(){return {title:'Saturday barbecue',people:['Alex','Jamie'].map((name,i)=>({id:'p'+(i+1),name,amount:'',confirmed:false})),stage:'input'};}
export function validateGroup(value,{complete=false}={}){
 if(!value||typeof value.title!=='string'||!value.title.trim()||value.title.trim().length>100)throw Error('Give this activity a name.');
 if(!Array.isArray(value.people)||value.people.length<2||value.people.length>12)throw Error('Add 2–12 participants.');
 const seen=new Set(),names=new Set();
 const people=value.people.map(p=>{
 if(typeof p.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(p.id)||seen.has(p.id))throw Error('Participant IDs must be unique.');
 seen.add(p.id);const name=typeof p.name==='string'?p.name.trim():'';
 if(!name||name.length>40||names.has(name.toLowerCase()))throw Error('Give each person a different name, up to 40 characters.');
 names.add(name.toLowerCase());
 if(typeof p.amount!=='string'||p.amount.length>20)throw Error('Check each amount.');
 const confirmed=p.confirmed===true;
 if(complete||confirmed)paidCents(p.amount);
 return {id:p.id,name,amount:p.amount,confirmed};
 });
 return {title:value.title.trim(),people,stage:value.stage==='result'?'result':'input'};
}
export function paidCents(raw){const s=String(raw).trim();if(!s)return 0;if(!/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/.test(s))throw Error('Use a nonnegative amount with at most two decimals, or leave blank for $0.');const [whole,fraction='']=s.split('.');const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(cents>MAX_CENTS)throw Error('Maximum per person is $100,000.');return cents;}
export function calculateGroup(value){
 const g=validateGroup(value,{complete:true}),people=g.people.map(p=>({id:p.id,name:p.name})),total=g.people.reduce((n,p)=>n+paidCents(p.amount),0);
 const e=normalizeEvent({id:'group-split-test',title:g.title,date:dayString(),perPersonBudgetCents:1,people,activities:[{id:'group',name:g.title,estimateCents:0,attendees:people.map(p=>p.id)}],expenses:[],transfers:[],sample:true,audit:[]});
 const shares=total?equalSharesForTotal(total,people.map(p=>p.id)):people.map(p=>({personId:p.id,cents:0}));
 // Allocate each payer's receipt across the same equal group entitlement.
 // This keeps large aggregate totals valid without exceeding per-bill limits.
 const remaining=shares.map(s=>({...s}));
 for(const p of g.people){const amountCents=paidCents(p.amount);if(!amountCents)continue;let left=amountCents;const billShares=[];
 for(const s of remaining){const amount=Math.min(s.cents,left);if(amount){billShares.push({personId:s.personId,cents:amount});s.cents-=amount;left-=amount;}if(!left)break;}
 e.expenses.push(validateExpense({id:uid(),label:p.name+' paid upfront',amountCents,payerId:p.id,shares:billShares,activityId:'group'},e));}
 return {title:g.title,total,people:balances(e),transfers:settlements(e),minimumGuaranteed:true};
}
function equalSharesForTotal(total,ids){const base=Math.floor(total/ids.length),remainder=total%ids.length;return ids.map((personId,i)=>({personId,cents:base+(i<remainder?1:0)}));}
