import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('homepage budget presets are 10,20,30 while other controls remain intact',async()=>{const js=await readFile(new URL('../public/journey.js',import.meta.url),'utf8');assert.match(js,/\[10,20,30\]\.map\(n=>/);assert.ok(!js.includes('[12,15,20].map'));for(const text of ['550,','700,','850,','id="setup-budget"','Let’s pick lunch'])assert.ok(js.includes(text));});
