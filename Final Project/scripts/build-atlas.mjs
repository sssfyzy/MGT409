import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);const data=JSON.parse(await readFile(new URL('data/new-haven-restaurants.json',root),'utf8'));
if(data.restaurants.length!==100||new Set(data.restaurants.map(r=>r.id)).size!==100)throw new Error('Expected 100 distinct researched profiles');
for(const r of data.restaurants){if(!r.profile||!r.observedAt)throw new Error('Missing provenance');for(const m of r.items){if(!m.source||!m.verification||!m.name)throw new Error('Unattributed menu row');if(m.price!==null&&(!Number.isFinite(m.price)||m.price<0))throw new Error('Invalid price');}}
await mkdir(new URL('dist/menus/',root),{recursive:true});for(const name of ['index.html','style.css','atlas.js'])await copyFile(new URL('online/'+name,root),new URL('dist/menus/'+name,root));
await writeFile(new URL('dist/menus/restaurants.json',root),JSON.stringify(data));
for(const name of ['app.js','planner.js','schedule.js','styles.css','extension.css','print.css','playful.css','mascot.svg','data.js','catalogue.js','journey.js','journey.css','food-photos.js','nutrition.js','recommendations.js','today.js','concierge.js'])await copyFile(new URL('public/'+name,root),new URL('dist/'+name,root));
await copyFile(new URL('public/mascot.svg',root),new URL('dist/menus/mascot.svg',root));
let home=await readFile(new URL('public/meal-planner.html',root),'utf8');
home=home.replace('<title>','<meta name="planner-runtime" content="browser"><title>')
 .replace('<span class="location">↗ New Haven · demo neighborhood</span>','<a class="quiet" href="/menus/">Restaurant sources ↗</a>')
 .replace('Reset demo','Reset plan').replace('src="/app.js"','src="/app.js?v=four-picks-1"')
 .replace('Planning buttons work without AI. AI uses your personal API configuration only after setup and prompt approval.','Planning works in your browser. AI is not connected on this hosted preview; no messages are sent to a model.')
 .replace('Plan computed by the server','Plan computed in your browser');
await mkdir(new URL('dist/meals/',root),{recursive:true});
await writeFile(new URL('dist/meals/index.html',root),home);
await writeFile(new URL('dist/meal-planner.html',root),home);
for(const name of ['index.html','organize.html','events.js','event-core.js','event-workflow.js','cloud-client.js','events.css'])await copyFile(new URL('public/'+name,root),new URL('dist/'+name,root));
// Make the execution location honest without changing local API-backed behavior.
const app=await readFile(new URL('dist/app.js',root),'utf8');
await writeFile(new URL('dist/app.js',root),app.replace('computed by the server','computed in your browser'));
// Version all browser imports together so cached data/planner modules cannot diverge.
for(const name of ['app.js','planner.js','schedule.js','journey.js','food-photos.js','nutrition.js','catalogue.js','recommendations.js','today.js','concierge.js']){const path=new URL('dist/'+name,root);const js=await readFile(path,'utf8');await writeFile(path,js.replace(/from (['"])(\.\/[^'"]+?\.js)(?:\?[^'"]*)?\1/g,(_,q,p)=>`from ${q}${p}?v=four-picks-1${q}`));}
console.log(JSON.stringify({ready:true,coverage:data.coverage,staticDirectory:'dist',access:'Owner-private Site; no secrets, reviews or photos included'},null,2));
