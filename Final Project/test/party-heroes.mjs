import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AVATARS,ALL_AVATARS,AVATAR_MOODS} from '../public/hero-avatars.js';
import {AVATAR_IMAGES} from '../public/avatar-images.js';
import {HEROES,validateHero} from '../public/party-heroes.js';
test('eighteen diverse cute party heroes offer bringable items and bounded one-liners',()=>{assert.equal(HEROES.length,18);assert.equal(new Set(HEROES.map(h=>h.id)).size,18);for(const h of HEROES)assert.deepEqual(validateHero({roleId:h.id,bringing:h.bring,quote:h.line}),{roleId:h.id,bringing:h.bring,quote:h.line});});
test('invalid or excessive hero content is rejected without accepting identity fields',()=>{const good={roleId:'grill',bringing:['Burgers'],quote:'I came. I grilled. I conquered.'};assert.deepEqual(validateHero({...good,personId:'someone-else'}),good);for(const bad of [{...good,roleId:'invented'},{...good,bringing:[]},{...good,bringing:['Ice',' ice ']},{...good,bringing:['x'.repeat(61)]},{...good,quote:'x'.repeat(141)},{...good,quote:'first\nsecond'}])assert.throws(()=>validateHero(bad));});
test('primary buttons use dark ink; guest tools are behind one disclosure',async()=>{const css=await readFile(new URL('../public/events.css',import.meta.url),'utf8'),html=await readFile(new URL('../public/split-demo.html',import.meta.url),'utf8');assert.doesNotMatch(css,/color:\s*(?:white|#fff(?:fff)?)\s*[;}]/i);assert.match(css,/\.primary\{background:#dce9b6;color:#304b3d/);assert.match(html,/class="split-tools"/);assert.match(html,/>Split plan →/);assert.match(html,/Choose your hero/);assert.doesNotMatch(html,/Calculate the smartest split/);});
test('250 illustrated avatars allow custom names independently of the old role',()=>{
 assert.equal(AVATARS.length,250);assert.equal(new Set(AVATARS.map(a=>a.id)).size,250);assert.equal(new Set(AVATARS.map(a=>AVATAR_IMAGES[a.id])).size,250);
 assert.deepEqual(AVATAR_MOODS.map(m=>m.count),[80,60,30,30,50]);
 assert.deepEqual(AVATAR_MOODS.map(m=>m.id),['animal','meme','food','fun','weather']);
 assert.equal(AVATARS.find(a=>a.id==='weather-01')?.name,'Sun');
 assert.equal(AVATARS.find(a=>a.id==='weather-02')?.name,'Star');
 assert.equal(AVATARS.some(a=>/^(hero|villain)-/.test(a.id)),false);
 for(const oldId of ['hero-01','villain-30']){const alias=ALL_AVATARS.find(a=>a.id===oldId);assert.ok(alias);assert.ok(AVATAR_IMAGES[alias.imageId]);}
 for(const mood of AVATAR_MOODS)assert.equal(AVATARS.filter(a=>a.category===mood.id).length,mood.count);
 for(const a of AVATARS){assert.match(AVATAR_IMAGES[a.id],/^data:image\/png;base64,/);const profile={roleId:'grill',avatarId:a.id,heroName:'  Captain Fluff  ',bringing:['Tea'],quote:'Tiny paws. Big plans.'};assert.deepEqual(validateHero(profile),{...profile,heroName:'Captain Fluff'});}
 const good={roleId:'grill',avatarId:'seal',heroName:'Captain Fluff',bringing:['Tea'],quote:'Tiny paws. Big plans.'};
 for(const bad of [{...good,avatarId:'unknown'},{...good,heroName:''},{...good,heroName:'x'.repeat(33)},{...good,heroName:'first\nsecond'},{...good,heroName:null},{...good,heroName:'\u0000'}])assert.throws(()=>validateHero(bad));
 assert.equal(validateHero({...good,heroName:'小可爱'}).heroName,'小可爱');assert.equal(validateHero({...good,personId:'not-me'}).personId,undefined);
});
