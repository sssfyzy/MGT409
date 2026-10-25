import {performance} from 'node:perf_hooks';
import {writeFile,mkdir} from 'node:fs/promises';
import {buildPlan} from '../backend/tools.mjs';
const settings={budget:85,target:700,tax:6.35,tip:0,walk:15,vegetarian:false,allowUnknownWalk:true};
const cases=[
 {name:'local-balanced',dataset:'local',mode:'balanced',settings},
 {name:'local-save',dataset:'local',mode:'save',settings},
 {name:'local-vegetarian',dataset:'local',mode:'balanced',settings:{...settings,vegetarian:true}},
 {name:'local-infeasible',dataset:'local',mode:'balanced',settings:{...settings,budget:1}},
 {name:'demo-balanced',dataset:'demo',mode:'balanced',settings}
];
const results=cases.map(c=>{const samples=[];let result;for(let i=0;i<6;i++){const start=performance.now();result=buildPlan({...c,locked:{}});samples.push(performance.now()-start);}const sorted=[...samples].sort((a,b)=>a-b);return {case:c.name,runs:samples.length,minMs:+sorted[0].toFixed(2),medianMs:+((sorted[2]+sorted[3])/2).toFixed(2),maxMs:+sorted.at(-1).toFixed(2),feasible:result.plan!==null,totalUSD:result.summary?.total??null,plan:result.plan};});
const evidence={measuredAt:new Date().toISOString(),node:process.version,type:'Deterministic planner microbenchmark only. Not model latency, user time saved, nutrition quality or AI tokenomics.',warmup:'No discarded warmup; all six calls included.',results};
await mkdir(new URL('../output/',import.meta.url),{recursive:true});
await writeFile(new URL('../output/planner-benchmark.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
