import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('../data/new-haven-restaurants.json',import.meta.url),'utf8'));
test('atlas contains 100 unique researched profiles, not a claimed Yelp ranking',()=>{assert.equal(data.restaurants.length,100);assert.equal(new Set(data.restaurants.map(r=>r.id)).size,100);assert.match(data.ranking.selection,/not a verified Yelp\/Google top 100/);assert.ok(data.ranking.candidatePool>=100);});
test('every published menu row carries a source and review status',()=>{for(const r of data.restaurants)for(const m of r.items){assert.match(m.source,/^https?:\/\//);assert.ok(m.verification);assert.ok(m.observedAt);assert.ok(m.price===null||Number.isFinite(m.price));}});
test('coverage metrics equal actual data rather than target count',()=>{assert.equal(data.coverage.restaurantsWithStructuredPrices,data.restaurants.filter(r=>r.items.some(m=>m.price!==null)).length);assert.equal(data.coverage.pricedRows,data.restaurants.reduce((n,r)=>n+r.items.filter(m=>m.price!==null).length,0));assert.equal(data.coverage.menuSourceLinks,data.restaurants.filter(r=>r.menuSources.length).length);});
test('atlas page discloses incompleteness and does not embed copied photos',async()=>{const html=await readFile(new URL('../online/index.html',import.meta.url),'utf8');assert.match(html,/not 100 verified complete menus/);assert.match(html,/not an official Top 100/);assert.equal(/<img\b/i.test(html),false);});
