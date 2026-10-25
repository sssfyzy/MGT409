import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {load} from 'cheerio';

test('homepage offers hosting, joining, and an account-free split tool',async()=>{
 const $=load(await readFile(new URL('../public/index.html',import.meta.url),'utf8'));
 assert.match($('title').text(),/HolySplit/);
 assert.match($('a[href^="/signin-with-chatgpt"]').text(),/Host an event/);
 assert.match($('a[href="/join"]').text(),/Join a friend/);
 assert.match($('a[href="/split-demo.html"]').text(),/offline split tool/);
 assert.equal($('input[type=email]').length,0);
});

test('downloaded split tool is self-contained and computes without networking',async()=>{
 const $=load(await readFile(new URL('../public/holysplit-offline.html',import.meta.url),'utf8'));
 assert.equal($('script[src],link[rel=stylesheet]').length,0);
 assert.ok($('img[src]').toArray().every(el=>$(el).attr('src').startsWith('data:image/')));
 assert.equal($('#input-scene').length,1);
 assert.equal($('#result-scene[hidden]').length,1);
 const script=$('script').text();assert.ok(script.length>10000);
 const nodes=new Map();
 function node(key){if(!nodes.has(key))nodes.set(key,{textContent:'',innerHTML:'',hidden:false,disabled:false,value:'',href:'',className:'',dataset:{},style:{setProperty(){}},scrollIntoView(){},querySelector:node,querySelectorAll(){return [];},setAttribute(name,value){this[name]=value;},removeAttribute(){},focus(){}});return nodes.get(key);}
 const stored=new Map();let requests=0;
 const sandbox={console,structuredClone,crypto:globalThis.crypto,URL,location:new URL('file:///HolySplit-offline.html'),document:{querySelector:node,querySelectorAll:()=>[]},navigator:{clipboard:{async writeText(){}}},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},fetch(){requests++;throw Error('Offline: no network');}};
 vm.runInNewContext(script,sandbox);
 assert.equal(node('#input-scene').hidden,false);
 assert.equal(node('#result-scene').hidden,true);
 assert.equal(node('#download-offline').hidden,true);
 assert.match(node('#offline-state').textContent,/Standalone offline/);
 node('#example').onclick();node('#group-form').onsubmit({preventDefault(){}});
 assert.match(node('#result-summary').innerHTML,/\$60\.00/);
 assert.match(node('#result-summary').innerHTML,/\$30\.00/);
 assert.match(node('#transfer-plan').innerHTML,/Jamie/);
 assert.match(node('#transfer-plan').innerHTML,/Alex/);
 assert.equal(node('#result-scene').hidden,false);
 assert.equal(requests,0);
 assert.ok(stored.size>0);
});

