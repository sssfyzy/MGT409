import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {load} from 'cheerio';
import {parseInvite} from '../public/join-link.js';

const origin='https://holysplit.yvetteh9b.chatgpt.site';
const token='a'.repeat(43);

test('hero path offers a visible join entry',async()=>{
 const $=load(await readFile(new URL('../public/index.html',import.meta.url),'utf8'));
 assert.equal($('a[href="/join"]').length,1);
 assert.match($('a[href="/join"]').text(),/Join a friend’s event/);
});

test('join page accepts a link or code without sign-in',async()=>{
 const $=load(await readFile(new URL('../public/join.html',import.meta.url),'utf8'));
 assert.equal($('#invite-input').length,1);
 assert.equal($('#invite-entry').length,1);
 assert.match($('.scene-subtitle').text(),/no account/i);
 assert.match($('script[type=module]').attr('src'),/join\.js/);
 const js=await readFile(new URL('../public/join.js',import.meta.url),'utf8');
 assert.match(js,/guest-join/);
 assert.match(js,/location\.replace\('\/organize\?event='/);
});

test('invitation parser accepts only matching Site links and 43-character tokens',()=>{
 assert.equal(parseInvite(token,origin),token);
 assert.equal(parseInvite(origin+'/join#invite='+token,origin),token);
 assert.throws(()=>parseInvite('https://other.example/join#invite='+token,origin));
 assert.throws(()=>parseInvite(origin+'/organize#invite='+token,origin));
 assert.throws(()=>parseInvite('Saturday barbecue',origin));
 assert.throws(()=>parseInvite(origin+'/join#invite=short',origin));
});
