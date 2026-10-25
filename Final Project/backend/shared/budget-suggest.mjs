import {budgetItem} from './budget.mjs';

const item=(category,name,quantity,unit,budgetCents,note='')=>({category,name,quantity,unit,budgetCents,note});
export function starterBudget(event,headcount){
 const title=String(event.title||'').toLowerCase(),n=Math.max(1,Math.min(20,headcount||4));
 if(/barbecue|bbq|cookout|grill/.test(title))return [
  item('Venue','Reserve the space','1','booking',15000),item('Food','Main dishes',String(n),'people',n*1200),
  item('Food','Sides and vegetables',String(n),'people',n*450),item('Drinks','Water and drinks',String(n),'people',n*350),
  item('Supplies','Plates, napkins and cleanup','1','set',1800),item('Equipment','Grill fuel or rental','1','set',2500)];
 if(/birthday|celebration|party/.test(title))return [item('Venue','Space or reservation','1','booking',12000),item('Food','Food for guests',String(n),'people',n*1400),item('Dessert','Cake or treats','1','set',4500),item('Drinks','Drinks',String(n),'people',n*400),item('Decor','Decorations','1','set',3000),item('Supplies','Plates and cleanup','1','set',1800)];
 if(/trip|hike|picnic|outing/.test(title))return [item('Travel','Transport','1','trip',8000),item('Food','Food and snacks',String(n),'people',n*1000),item('Drinks','Water',String(n),'people',n*250),item('Tickets','Admission or permits',String(n),'people',n*1200),item('Supplies','Shared supplies','1','set',2000)];
 return [item('Venue','Space or reservation','1','booking',10000),item('Food','Food for the group',String(n),'people',n*1200),item('Drinks','Drinks',String(n),'people',n*350),item('Supplies','Shared supplies','1','set',2500),item('Other','Contingency','1','set',3000)];
}
const schema={type:'object',properties:{message:{type:'string'},items:{type:'array',items:{type:'object',properties:{category:{type:'string'},name:{type:'string'},quantity:{type:'string'},unit:{type:'string'},budgetCents:{type:'integer'},note:{type:'string'}},required:['category','name','quantity','unit','budgetCents','note'],additionalProperties:false}}},required:['message','items'],additionalProperties:false};
export async function suggestBudget(event,headcount,environment={},transport=fetch){
 const key=environment.OPENAI_API_KEY,model=environment.OPENAI_MODEL;
 if(!key||!model)return {source:'starter',message:'A party-aware starter list is ready. Review prices and quantities before adding anything; no AI model is connected yet.',items:starterBudget(event,headcount)};
 const input=`Activity: ${String(event.title).slice(0,100)}\nDate: ${event.date}\nLocation: ${String(event.workflow?.location||'').slice(0,150)}\nExpected guests: ${headcount}.`;
 const response=await transport('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),body:JSON.stringify({model,store:false,max_output_tokens:1800,instructions:'You are HolySplit’s cheerful party-planning helper. Suggest a practical preparation budget table for the described event in English. Return 4–10 concise rows. USD budgetCents are rough planning estimates, never verified local prices. Do not invent confirmed bookings, attendees or payments. Do not include personal data. Quantities and units should be short. Output only the schema.',input,text:{format:{type:'json_schema',name:'party_budget',strict:true,schema}}})});
 if(!response.ok)throw Error('The AI draft is unavailable right now. Try the starter list instead.');
 const result=await response.json(),output=result.output?.flatMap(part=>part.content||[]).find(part=>part.type==='output_text')?.text;
 if(!output)throw Error('The AI draft did not return a usable table.');
 const parsed=JSON.parse(output),items=parsed.items.map(budgetItem);
 if(!items.length||items.length>12)throw Error('The AI draft needs review before it can be used.');
 const tokenCount=value=>Number.isSafeInteger(value)&&value>=0?value:null;
 return {
  source:'ai',message:String(parsed.message||'Review every estimate before adding it.').slice(0,240),items,
  model:String(result.model||model),
  usage:{
   inputTokens:tokenCount(result.usage?.input_tokens),
   cachedInputTokens:tokenCount(result.usage?.input_tokens_details?.cached_tokens),
   outputTokens:tokenCount(result.usage?.output_tokens)
  }
 };
}
