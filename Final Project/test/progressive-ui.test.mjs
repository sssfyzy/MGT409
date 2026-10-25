import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {load} from 'cheerio';
const root=new URL('../dist/',import.meta.url);

test('event page starts with a focused, dynamic activity flow',async()=>{
 const $=load(await readFile(new URL('organize.html',root),'utf8'));
 assert.equal($('#flow-root').length,1);
 assert.equal($('table,fieldset,textarea').length,0);
 assert.match($('script[type=module]').attr('src'),/flow\.js/);
 assert.match($('footer').text(),/Zelle happens outside HolySplit/);
});

test('current flow offers hero, event setup, preparation, import preview and settlement',async()=>{
 const js=await readFile(new URL('../public/flow.js',import.meta.url),'utf8');
 for(const marker of ['CHOOSE YOUR HERO','create-event','go-prep','budget-suggest','budget-file','importPreview','go-split','renderEvent()'])assert.ok(js.includes(marker),marker);
 assert.match(js,/Prices are estimates/);
 assert.match(js,/Review each estimate before adding it/);
 assert.match(js,/No AI model is connected yet/);
});

