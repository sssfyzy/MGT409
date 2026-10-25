import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {config,env} from './backend/config.mjs';
import {catalogueFor,buildPlan,validateRequest} from './backend/tools.mjs';
import {runAgent,agentStatus} from './backend/agent.mjs';
import {validatePlan} from './public/planner.js';
const root=new URL('./public/',import.meta.url);
const allowed=new Set(['index.html','app.js','planner.js','schedule.js','styles.css','extension.css','print.css','playful.css','mascot.svg','data.js','catalogue.js','journey.js','journey.css','food-photos.js','nutrition.js','recommendations.js','today.js','concierge.js']);
for(const name of ['meal-planner.html','events.js','event-core.js','event-workflow.js','cloud-client.js','events.css'])allowed.add(name);
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml'};
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
async function readJson(req){
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Object.assign(new Error('JSON content type required'),{status:415});
 let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>12000)throw Object.assign(new Error('Request too large'),{status:413});}
 try{return JSON.parse(body);}catch{throw new Error('Invalid JSON body');}
}
export function createApp(){return http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''))return json(res,403,{error:'Only loopback hosts are allowed'});
  // Local development server only. Prevent cross-origin browser requests to paid endpoints.
  const origin=req.headers.origin;if(origin&&origin!==`http://${req.headers.host}`)return json(res,403,{error:'Cross-origin requests are not allowed'});
  if(url.pathname==='/api/status'&&req.method==='GET')return json(res,200,{ai:await agentStatus(),datasets:['local','demo'],catalogueObserved:'2026-10-17'});
  if(url.pathname==='/api/catalogue'&&req.method==='GET')return json(res,200,{dataset:url.searchParams.get('dataset')||'local',meals:catalogueFor(url.searchParams.get('dataset')||'local')});
  if(url.pathname.startsWith('/api/')&&req.method==='POST'){
   const body=await readJson(req);
   if(url.pathname==='/api/plan')return json(res,200,buildPlan(body));
   if(url.pathname==='/api/validate'){const context=validateRequest(body);return json(res,200,validatePlan(body.plan,context.settings,catalogueFor(context.dataset)));}
   if(url.pathname==='/api/chat')return json(res,200,await runAgent(body));
  }
  if(url.pathname.startsWith('/api/'))return json(res,404,{error:'Unknown API route'});
  if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed'});
  const name=url.pathname.slice(1)||'index.html';if(!allowed.has(name)){res.writeHead(404);res.end('Not found');return;}
  const body=await readFile(fileURLToPath(new URL(name,root)));res.writeHead(200,{'Content-Type':types[name.split('.').pop()],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
 }catch(e){json(res,e.status||400,{error:e.message.startsWith('Model')||e.message.startsWith('AI ')||e.status?e.message:'Invalid request or unavailable result. No changes applied.'});}
});}
if(process.argv[1]===fileURLToPath(import.meta.url)){const port=Number(env.PORT||4317);createApp().listen(port,'127.0.0.1',()=>console.log(`BellyBank: http://127.0.0.1:${port} · AI ${config.key?'key configured':'not configured'}`));}
