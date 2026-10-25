import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const directory='https://www.restaurantji.com/ct/new-haven/';
const observedAt=new Date().toISOString();
const agent='BellyBudgetCourseResearch/0.1 (public factual restaurant metadata; no reviews or photos copied)';
const decode=s=>String(s).replace(/&amp;/g,'&').replace(/&#0?39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
const plain=s=>decode(s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
function jsonLd(html){const values=[];for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{const x=JSON.parse(m[1]);values.push(...(Array.isArray(x)?x:[x]));}catch{}}return values;}
function links(html,base){return [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap(m=>{try{const url=new URL(decode(m[1]),base);if(!['https:','http:'].includes(url.protocol))return [];return [{url:url.href,text:plain(m[2])}];}catch{return [];}});}
const ledger=[];
async function page(url){
 const start=Date.now();try{const response=await fetch(url,{headers:{'User-Agent':agent},signal:AbortSignal.timeout(12000)});const type=response.headers.get('content-type')||'';
  if(!response.ok){ledger.push({url,status:response.status,ms:Date.now()-start});return null;}
  if(!/html|text\/plain/.test(type)){ledger.push({url,status:response.status,type,ms:Date.now()-start,reason:'Non-HTML source; link retained, not downloaded'});return null;}
  const html=await response.text();if(/captcha|access denied|verify you are human/i.test(html.slice(0,5000))){ledger.push({url,status:response.status,reason:'Access challenge; not bypassed'});return null;}
  ledger.push({url,finalUrl:response.url,status:response.status,bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex'),ms:Date.now()-start});return {html,url:response.url};
 }catch(e){ledger.push({url,status:null,reason:e.name==='TimeoutError'?'Timeout':'Fetch failed',ms:Date.now()-start});return null;}
}
function flatten(value){if(!value||typeof value!=='object')return [];return [value,...Object.values(value).flatMap(v=>Array.isArray(v)?v.flatMap(flatten):flatten(v))];}
function structuredItems(html,source){
 const result=[];for(const item of jsonLd(html).flatMap(flatten)){
  const type=Array.isArray(item['@type'])?item['@type']:[item['@type']];if(!type.includes('MenuItem')||typeof item.name!=='string')continue;
  const offer=Array.isArray(item.offers)?item.offers[0]:item.offers;const price=Number(offer?.price);const currency=offer?.priceCurrency||'USD';
  result.push({name:plain(item.name),price:Number.isFinite(price)&&offer?.price!==undefined?price:null,currency,source,sourceType:'Website structured MenuItem',verification:'Machine-parsed published data; not a checkout quote',observedAt});
 }return result;
}
const first=await page(directory);if(!first)throw new Error('Could not retrieve discovery directory');
const candidates=new Map();
function addCandidates(html){for(const node of jsonLd(html))for(const row of node.itemListElement||[]){const m=row.item;if(!m||typeof m!=='object'||!m.url||!m.name)continue;if(!/^new haven$/i.test(m.address?.addressLocality||''))continue;if(!m.url.startsWith(directory))continue;candidates.set(m.url,{name:m.name,profile:m.url,address:[m.address.streetAddress,m.address.addressRegion,m.address.postalCode].filter(Boolean).join(', '),reviewCount:Number(m.aggregateRating?.reviewCount||0),directoryPosition:row.position,priceBand:m.priceRange||null});}}
addCandidates(first.html);
const categories=[...new Set(links(first.html,directory).filter(l=>/^https:\/\/www\.restaurantji\.com\/ct\/new-haven\/[^/]+\/$/.test(l.url)&&/Restaurants|Shops|Bars/i.test(l.text)).map(l=>l.url))].slice(0,12);
for(const url of categories){const data=await page(url);if(data)addCandidates(data.html);console.log(`Discovery: ${candidates.size} unique city candidates`);}
const selected=[...candidates.values()].sort((a,b)=>b.reviewCount-a.reviewCount||a.name.localeCompare(b.name)).slice(0,100);
const restaurants=[];
for(let offset=0;offset<selected.length;offset+=3){
 const batch=await Promise.all(selected.slice(offset,offset+3).map(async(candidate)=>{
  const data=await page(candidate.profile);const record={...candidate,id:candidate.profile.split('/').filter(Boolean).at(-1),discoverySource:directory,popularitySource:'Restaurantji public directory/profile review count',rating:null,officialWebsite:null,menuSources:[],items:[],observedAt,status:'Menu not yet verified'};
  if(!data){record.status='Profile fetch unavailable';return record;}
  const schemas=jsonLd(data.html);const schema=schemas.flatMap(flatten).find(x=>x['@type']==='Restaurant'&&x.name);
  if(schema){record.name=schema.name;record.address=[schema.address?.streetAddress,schema.address?.addressLocality,schema.address?.postalCode].filter(Boolean).join(', ');record.rating=Number(schema.aggregateRating?.ratingValue)||null;record.reviewCount=Number(schema.aggregateRating?.ratingCount||schema.aggregateRating?.reviewCount)||candidate.reviewCount;record.cuisines=schema.servesCuisine||[];record.hours=schema.openingHours||[];}
  // Retain menu-photo metadata as source links only. Do not copy third-party photos or reviews.
  const imageMenus=schemas.flatMap(flatten).filter(x=>x['@type']==='ImageObject'&&/menu/i.test(x.contentUrl||x.url||''));
  if(imageMenus.length)record.menuSources.push({type:'Community menu-photo listing',url:candidate.profile+'#menu',status:'Menu photographs exist; contents and prices not transcribed or verified',latestUpload:imageMenus.map(x=>x.uploadDate).filter(Boolean).sort().at(-1)||null});
  const outgoing=links(data.html,data.url);const website=outgoing.find(l=>/^website$/i.test(l.text)&&!new URL(l.url).hostname.endsWith('restaurantji.com'));
  if(website){record.officialWebsite=website.url;const official=await page(website.url);if(official){
   record.websiteTitle=plain(official.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
   const menuLinks=links(official.html,official.url).filter(l=>/menu/i.test(l.text+' '+l.url)&&!/(privacy|terms|facebook|instagram|#|javascript)/i.test(l.url));
   const unique=[...new Map(menuLinks.map(l=>[l.url,l])).values()].slice(0,4);
   record.items.push(...structuredItems(official.html,official.url));
   if(/menu/i.test(official.html))record.menuSources.push({type:'Restaurant website',url:official.url,status:'HTML retrieved; menu text not independently validated'});
   for(const link of unique)record.menuSources.push({type:/\.pdf(?:\?|$)/i.test(link.url)?'Restaurant-linked PDF menu':'Restaurant-linked menu',url:link.url,label:link.text.slice(0,100),status:'Link observed on restaurant website; contents not yet verified'});
   for(const link of unique.filter(l=>!/\.pdf(?:\?|$)/i.test(l.url)).slice(0,1)){if(link.url===official.url)continue;const menu=await page(link.url);if(menu){record.items.push(...structuredItems(menu.html,menu.url));const source=record.menuSources.find(s=>s.url===link.url);if(source)source.status='HTML menu source retrieved; structured fields only are parsed';}}
  }}
  record.items=[...new Map(record.items.map(m=>[m.name+'|'+m.price,m])).values()];
  record.status=record.items.some(m=>m.price!==null)?'Published structured price data found':record.menuSources.some(s=>s.type!=='Community menu-photo listing')?'Restaurant menu/website sources located':record.menuSources.length?'Community menu evidence only':'Menu not yet verified';
  return record;
 }));restaurants.push(...batch);console.log(`Profiles ${restaurants.length}/${selected.length}; restaurant-linked sources ${restaurants.filter(r=>r.officialWebsite).length}`);
 await mkdir(new URL('data/',root),{recursive:true});await writeFile(new URL('data/new-haven-restaurants.partial.json',root),JSON.stringify({observedAt,restaurants},null,2));
}
restaurants.sort((a,b)=>b.reviewCount-a.reviewCount||a.name.localeCompare(b.name));restaurants.forEach((r,i)=>r.sampleRank=i+1);
const result={title:'New Haven restaurant menu research',targetCount:100,observedAt,ranking:{label:'Most reviewed within the discovered Restaurantji sample',source:directory,candidatePool:candidates.size,selection:'Merged city/cuisine-directory candidates, filtered to addressLocality New Haven, then selected the 100 largest available directory review counts. Profile counts refreshed and selected sample re-sorted. This is not a verified Yelp/Google top 100 or an exhaustive city ranking.',yelpGoogleStatus:'Yelp search could not be retrieved. No Google Maps ranking collected.'},coverage:{restaurants:restaurants.length,officialWebsiteLinks:restaurants.filter(r=>r.officialWebsite).length,menuSourceLinks:restaurants.filter(r=>r.menuSources.length).length,structuredItems:restaurants.reduce((a,r)=>a+r.items.length,0),restaurantsWithStructuredPrices:restaurants.filter(r=>r.items.some(m=>m.price!==null)).length},restaurants};
await writeFile(new URL('data/new-haven-restaurants.json',root),JSON.stringify(result,null,2)+'\n');await writeFile(new URL('output/menu-collection-ledger.json',root),JSON.stringify({observedAt,requests:ledger},null,2)+'\n');console.log(JSON.stringify({coverage:result.coverage,ranking:result.ranking},null,2));
