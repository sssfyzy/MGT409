import {readFile} from 'node:fs/promises';
import {config} from './config.mjs';
import {toolDefinitions,executeTool,validateRequest,catalogueFor} from './tools.mjs';
import {validatePlan} from '../public/planner.js';
const promptPath=new URL('./prompts/prompt.md',import.meta.url);
let attempts=0;let active=0;
export async function agentStatus(){
 let promptReady=false;try{promptReady=Boolean((await readFile(promptPath,'utf8')).trim());}catch{}
 return {keyConfigured:Boolean(config.key),model:config.model||null,promptApproved:promptReady,ready:Boolean(config.key&&config.model&&promptReady),runsRemaining:Math.max(0,config.maxRuns-attempts),scope:'Ten attempts per server process, maximum three model requests per attempt. Restart resets this safeguard; it is not an account-level spending cap.'};
}
export async function runAgent(body,transport=fetch){
 const context=validateRequest(body);
 if(typeof body.message!=='string'||!body.message.trim()||body.message.length>1500)throw new Error('Message must contain 1–1500 characters');
 if(!(await agentStatus()).ready){const e=new Error('AI awaits a personal API key, model ID and student-approved system prompt. Deterministic planning is available without AI.');e.status=503;throw e;}
 if(active||attempts>=config.maxRuns){const e=new Error('AI request limit reached or another request is running.');e.status=429;throw e;}
 attempts++;active++;const trace=[];let usage={input_tokens:0,cached_input_tokens:0,output_tokens:0};
 try{
  const instructions=await readFile(promptPath,'utf8');
  const input=[{role:'user',content:JSON.stringify({message:body.message,context})}];
  for(let step=0;step<3;step++){
   const res=await transport('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),body:JSON.stringify({model:config.model,instructions,input,tools:toolDefinitions,tool_choice:step===0?'required':'auto',parallel_tool_calls:false,max_output_tokens:config.maxOutput,store:false,text:{format:{type:'json_schema',name:'lunch_reply',strict:true,schema:{type:'object',properties:{reply:{type:'string'},meal_ids:{type:'array',items:{type:'string'}},plan_ids:{anyOf:[{type:'array',items:{type:'string'}},{type:'null'}]}},required:['reply','meal_ids','plan_ids'],additionalProperties:false}}}})});
   if(!res.ok)throw new Error(`Model provider returned HTTP ${res.status}. Check your local key/model configuration.`);
   const data=await res.json();const u=data.usage||{};usage.input_tokens+=u.input_tokens||0;usage.cached_input_tokens+=u.input_tokens_details?.cached_tokens||0;usage.output_tokens+=u.output_tokens||0;
   if(data.status!=='completed')throw new Error('Model response was incomplete. No plan was applied.');
   const output=data.output||[];input.push(...output);const calls=output.filter(o=>o.type==='function_call');
   if(calls.length){if(trace.length+calls.length>4)throw new Error('Tool-call limit reached. No plan was applied.');for(const call of calls){let result;try{result=executeTool(call.name,JSON.parse(call.arguments),context);}catch{result={error:'Invalid or disallowed tool request'};}trace.push({tool:call.name,arguments:call.arguments,result});input.push({type:'function_call_output',call_id:call.call_id,output:JSON.stringify(result)});}continue;}
   const text=output.filter(o=>o.type==='message').flatMap(o=>o.content||[]).filter(o=>o.type==='output_text').map(o=>o.text).join('');
   const answer=JSON.parse(text);const catalogue=catalogueFor(context.dataset);const known=new Set(catalogue.map(m=>m.id));
   if(typeof answer.reply!=='string'||!Array.isArray(answer.meal_ids)||answer.meal_ids.some(id=>!known.has(id)))throw new Error('Model returned invalid meal references.');
   let checked=null;if(answer.plan_ids!==null){checked=validatePlan(answer.plan_ids,context.settings,catalogue);if(!checked.valid||Object.entries(context.locked).some(([i,id])=>answer.plan_ids[Number(i)]!==id))throw new Error('Proposed plan failed server budget, diet or kept-meal validation.');}
   return {...answer,summary:checked?.summary||null,trace,usage,model:config.model,notice:'AI text may contain errors. Only server-validated catalogue IDs and computed totals may be applied. No plan is applied automatically.'};
  }
  throw new Error('Agent step limit reached. No plan was applied.');
 }finally{active--;}
}
