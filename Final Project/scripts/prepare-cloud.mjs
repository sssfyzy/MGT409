import {readFile,writeFile,cp,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const atlas=spawnSync(process.execPath,['scripts/build-atlas.mjs'],{cwd:root,stdio:'inherit'});if(atlas.status)process.exit(atlas.status);
await mkdir(new URL('public/menus/',root),{recursive:true});await cp(new URL('dist/menus/',root),new URL('public/menus/',root),{recursive:true});
for(const [source,target] of [['index.html','guest-markup.ts'],['organize.html','organizer-markup.ts'],['join.html','join-markup.ts']]){
 const html=await readFile(new URL('public/'+source,root),'utf8'),body=html.match(/<body>([\s\S]*)<script type="module"[^>]*><\/script><\/body>/)?.[1];if(!body)throw Error('Application HTML shape changed: '+source);
 await writeFile(new URL('app/'+target,root),'// Generated application shell; no user data.\nexport default '+JSON.stringify(body)+';\n');
}
const offline=spawnSync(process.execPath,['scripts/build-offline.mjs'],{cwd:root,stdio:'inherit'});if(offline.status)process.exit(offline.status);
