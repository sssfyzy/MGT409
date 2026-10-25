import {mkdtemp,cp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';
const root=new URL('../',import.meta.url);const temp=await mkdtemp(join(tmpdir(),'belly-smoke-'));const destination=join(temp,'project');const started=performance.now();let child;
try{
 // Explicit allowlist: never copy real .env files, credential stores or user data.
 await cp(fileURLToPath(new URL('public',root)),join(destination,'public'),{recursive:true});
 await cp(fileURLToPath(new URL('backend',root)),join(destination,'backend'),{recursive:true,filter:source=>!source.endsWith('prompt.md')});
 for(const name of ['server.mjs','package.json'])await cp(fileURLToPath(new URL(name,root)),join(destination,name));
 await writeFile(join(temp,'.env'),'PORT=0\nOPENAI_API_KEY=\nOPENAI_MODEL=\n');
 child=spawn(process.execPath,['--input-type=module','-e',"import { createApp } from './server.mjs'; createApp().listen(0,'127.0.0.1',function(){console.log(this.address().port);});"],{cwd:destination,env:{...process.env,OPENAI_API_KEY:'',OPENAI_MODEL:''},stdio:['ignore','pipe','pipe']});
 const port=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Startup timeout')),10000);child.once('error',reject);child.stdout.once('data',chunk=>{clearTimeout(timeout);resolve(Number(chunk.toString().trim()));});child.once('exit',code=>{if(code)reject(new Error('Server did not start'));});});
 const base=`http://127.0.0.1:${port}`;
 for(const path of ['/','/app.js','/schedule.js','/print.css','/api/status']){const response=await fetch(base+path);if(response.status!==200)throw new Error(`Smoke check failed: ${path}`);}
 const result={checkedAt:new Date().toISOString(),node:process.version,seconds:+((performance.now()-started)/1000).toFixed(3),result:'passed',scope:'Fresh temporary-folder copy using Node only; no install, no secrets and no paid API calls. This is not yet a GitHub fresh-clone test.'};
 await writeFile(new URL('output/fresh-folder-check.json',root),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}finally{
 if(child&&child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
 // Exact mkdtemp-created test fixture, never a user directory.
 await rm(temp,{recursive:true,force:true});
}
