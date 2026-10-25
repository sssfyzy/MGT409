import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestBudget} from '../backend/shared/budget-suggest.mjs';

const event={title:'Saturday barbecue',date:'2026-10-24',workflow:{location:'A park'}};
test('assistant uses a clearly labeled starter list without a configured model',async()=>{
 const result=await suggestBudget(event,4,{},()=>{throw Error('A model should not be called.');});
 assert.equal(result.source,'starter');assert.match(result.message,/no AI model/i);assert.ok(result.items.length>=4);
});
test('configured model draft is validated and preserves real token usage',async()=>{
 let called=false;const response=await suggestBudget(event,4,{OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model'},async(url,options)=>{called=true;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.model,'test-model');return {ok:true,json:async()=>({model:'test-model',usage:{input_tokens:120,input_tokens_details:{cached_tokens:20},output_tokens:40},output:[{content:[{type:'output_text',text:JSON.stringify({message:'Check the estimates.',items:[{category:'Food',name:'Corn',quantity:'4',unit:'ears',budgetCents:500,note:''}]})}]}]})};});
 assert.equal(called,true);assert.equal(response.source,'ai');assert.equal(response.items[0].budgetCents,500);
 assert.equal(response.model,'test-model');assert.deepEqual(response.usage,{inputTokens:120,cachedInputTokens:20,outputTokens:40});
});
test('missing provider usage is marked unknown rather than invented',async()=>{
 const response=await suggestBudget(event,4,{OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model'},async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({message:'Review.',items:[{category:'Food',name:'Corn',quantity:'4',unit:'ears',budgetCents:500,note:''}]})}]}]})}));
 assert.deepEqual(response.usage,{inputTokens:null,cachedInputTokens:null,outputTokens:null});
});
test('server rejects an implausible AI budget before showing a draft',async()=>{
 await assert.rejects(
  suggestBudget(event,4,{OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model'},async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({message:'Approved.',items:[{category:'Venue',name:'Private island',quantity:'1',unit:'booking',budgetCents:999999999,note:''}]})}]}]})})),
  /valid budget between \$0 and \$100,000/
 );
});
