import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
export async function loadEnvironment(root=new URL('../',import.meta.url),base=process.env){
 const env={...base};
 for(const location of [new URL('.env',root),new URL('../.env',root)]){
  try{const values=parseEnv(await readFile(location,'utf8'));for(const [key,value] of Object.entries(values))if(env[key]===undefined)env[key]=value;}catch(e){if(e.code!=='ENOENT')throw new Error('Unable to read local environment configuration');}
 }
 return env;
}
export const env=await loadEnvironment();
// Do not automatically select a paid provider/model or silently fall back to the course key.
export const config={key:env.OPENAI_API_KEY||'',model:env.OPENAI_MODEL||'',maxRuns:10,maxOutput:1600};
