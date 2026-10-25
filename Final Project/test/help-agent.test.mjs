import test from 'node:test';
import assert from 'node:assert/strict';
import {answerHelp} from '../backend/shared/help-agent.mjs';

const row={event:{people:[{id:'p1',name:'Owner'}],expenses:[],transfers:[]},rsvps:{p1:'accepted'},budgetItems:[]};
const environment={OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model'};
test('help agent calls read-only workflow tool and keeps personal data out of model input',async()=>{
 const sent=[];
 const transport=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);sent.push(body);return {ok:true,json:async()=>sent.length===1?{model:'test-model',usage:{input_tokens:100,output_tokens:20},output:[{type:'function_call',name:'get_workflow_guide',arguments:'{"topic":"actual"}',call_id:'call_1'}]}:{model:'test-model',usage:{input_tokens:80,input_tokens_details:{cached_tokens:25},output_tokens:40},output:[{content:[{type:'output_text',text:'Claim the item, then record what you actually paid.'}]}]}};};
 const result=await answerHelp({message:'How do I enter actual?',view:'prep',row,personId:'p1',environment,transport});
 assert.match(result.reply,/Claim the item/);assert.deepEqual(result.trace,[{tool:'get_workflow_guide',topic:'actual'}]);assert.deepEqual(result.usage,{inputTokens:180,cachedInputTokens:25,outputTokens:60});
 assert.equal(sent[0].store,false);assert.equal(sent[0].tool_choice,'required');assert.match(JSON.stringify(sent[1].input),/Only the person who claimed/);assert.doesNotMatch(JSON.stringify(sent),/Owner/);
});
test('help agent requires a real model configuration and rejects oversized questions',async()=>{
 await assert.rejects(answerHelp({message:'How?',row,personId:'p1',environment:{}}),/not connected/);
 await assert.rejects(answerHelp({message:'x'.repeat(501),row,personId:'p1',environment}),/500 characters/);
});
