import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generate,summary} from '../public/planner.js';
import {localMeals} from '../public/catalogue.js';
// These legacy planner checks deliberately target the preserved meals entry.
const read=name=>readFile(new URL('../dist/'+(name==='index.html'?'meals/index.html':name),import.meta.url),'utf8');
test('hosted homepage restores wallet, body, calendar and secondary research link',async()=>{const html=await read('index.html');for(const marker of ['wallet-art','buddy-torso','id="week"','href="/menus/"','planner-runtime','poop-art'])assert.ok(html.includes(marker),marker);assert.ok(!html.includes('100</span>'));});
test('hosted planner bundles all modules and keeps AI explicitly disconnected',async()=>{for(const name of ['planner.js','data.js','catalogue.js','schedule.js','extension.css','print.css'])assert.ok((await read(name)).length);const app=await read('app.js');assert.match(app,/AI is not connected on this hosted preview/);assert.match(app,/computed in your browser/);assert.match(await read('menus/index.html'),/BACK TO PLANNER/);assert.equal(JSON.parse(await read('menus/restaurants.json')).restaurants.length,100);});
test('cute logo and simpler controls ship with the hosted build',async()=>{const html=await read('index.html');assert.match(html,/class="mascot-logo" src="\/mascot.svg"/);assert.match(html,/playful.css/);assert.match(await read('mascot.svg'),/<svg/);const app=await read('app.js');for(const marker of ['budget-presets','advanced-settings','One-lunch surprise','schedule-drawer','Say hello to your lunch mascot'])assert.ok(app.includes(marker));});
test('browser solver preserves kept meals and rejects infeasible budget',()=>{const s={budget:85,target:700,tax:6.35,tip:0,walk:15,vegetarian:false,allowUnknownWalk:true};const plan=generate(s,'balanced',{},localMeals);assert.equal(plan.length,5);assert.ok(summary(plan,s,localMeals).remaining>=0);assert.equal(generate(s,'save',{0:plan[0]},localMeals)[0],plan[0]);assert.equal(generate({...s,budget:1},'balanced',{},localMeals),null);});
