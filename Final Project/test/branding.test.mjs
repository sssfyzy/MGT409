import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {load} from 'cheerio';

test('HolySplit branding and course-ready paths are present in the current build',async()=>{
 const root=new URL('../dist/',import.meta.url);
 const $=load(await readFile(new URL('index.html',root),'utf8'));
 assert.match($('title').text(),/HolySplit/);
 assert.equal($('.brand').text().trim(),'HolySplit');
 assert.match($('.brand img').attr('src'),/mascot\.svg/);
 assert.doesNotMatch($('body').text(),/BellyBank|belly budget/i);
 assert.equal($('a[href="/join"]').length,1);
 assert.equal($('a[href="/split-demo.html"]').length,1);
 assert.ok((await readFile(new URL('../public/holysplit-offline.html',import.meta.url),'utf8')).includes('HolySplit'));
});

