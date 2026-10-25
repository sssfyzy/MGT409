import {readFile,writeFile} from 'node:fs/promises';
import {extractMenuRows} from './menu-parser.mjs';
const root=new URL('../',import.meta.url);const file=new URL('data/new-haven-restaurants.json',root);const data=JSON.parse(await readFile(file,'utf8'));const requests=[];
const sourceCache=new Map();
async function extract(url){if(sourceCache.has(url))return sourceCache.get(url);const task=(async()=>{try{const response=await fetch(url,{headers:{'User-Agent':'BellyBudgetCourseResearch/0.1'},signal:AbortSignal.timeout(12000)});if(!response.ok||!String(response.headers.get('content-type')).includes('html')){requests.push({url,status:response.status});return [];}
 const html=await response.text();if(/captcha|access denied|verify you are human/i.test(html.slice(0,5000))){requests.push({url,status:response.status,reason:'Access challenge; not bypassed'});return [];}
 const rows=extractMenuRows(html,response.url);requests.push({url,finalUrl:response.url,status:response.status,rows:rows.length});return rows;}catch(e){requests.push({url,status:null,reason:e.name});return [];}})();sourceCache.set(url,task);return task;}
for(let offset=0;offset<data.restaurants.length;offset+=3){await Promise.all(data.restaurants.slice(offset,offset+3).map(async r=>{
 const urls=[...new Set([r.officialWebsite,...r.menuSources.filter(s=>s.type!=='Community menu-photo listing').map(s=>s.url)].filter(u=>u&&!/\.pdf(?:\?|$)/i.test(u)))].slice(0,4);
 const additions=(await Promise.all(urls.map(extract))).flat();r.items=[...new Map([...r.items,...additions].map(m=>[m.name.toLowerCase().replace(/\s+/g,' ').trim()+'|'+m.price+'|'+(m.price===null?m.priceLabel||'':''),m])).values()];
 r.status=r.items.some(m=>m.price!==null)?'Published menu prices extracted (review status per row)':r.menuSources.some(s=>s.type!=='Community menu-photo listing')?'Restaurant menu/website sources located':r.menuSources.length?'Community menu evidence only':'Menu not yet verified';
 }));console.log(`Menu extraction ${Math.min(offset+3,data.restaurants.length)}/${data.restaurants.length}`);}
data.coverage.structuredItems=data.restaurants.reduce((n,r)=>n+r.items.length,0);data.coverage.restaurantsWithStructuredPrices=data.restaurants.filter(r=>r.items.some(m=>m.price!==null)).length;
data.coverage.pricedRows=data.restaurants.reduce((n,r)=>n+r.items.filter(m=>m.price!==null).length,0);
await writeFile(file,JSON.stringify(data,null,2)+'\n');await writeFile(new URL('output/menu-row-extraction-ledger.json',root),JSON.stringify({observedAt:new Date().toISOString(),requests},null,2)+'\n');console.log(JSON.stringify(data.coverage,null,2));
