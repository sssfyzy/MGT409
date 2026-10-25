import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {manualInvitation} from '../public/group-invites.js';

test('manual invitation includes real event details and does not claim delivery',()=>{
 const event={title:'Saturday barbecue',date:'2026-10-24',workflow:{startTime:'16:00',endTime:'20:00',timeZone:'America/New_York',location:'The park'},perPersonBudgetCents:3000};
 const invitation={url:'https://holysplit.test/join#invite='+'a'.repeat(43),expires:Date.UTC(2026,9,31)};
 const draft=manualInvitation(event,invitation);
 assert.match(draft,/Saturday barbecue/);
 assert.match(draft,/16:00–20:00/);
 assert.match(draft,/The park/);
 assert.match(draft,/\$30\.00/);
 assert.match(draft,/\/join#invite=/);
 assert.match(draft,/has not sent an email or calendar invitation/);
});

test('calendar page offers manual copy when Outlook setup is missing',async()=>{
 const js=await readFile(new URL('../public/events.js',import.meta.url),'utf8');
 assert.match(js,/outlook\.missing\?\.length/);
 assert.match(js,/Review & copy invitation/);
 assert.match(js,/sharedAction\(e,'share-invite'\)/);
 assert.match(js,/navigator\.clipboard\.writeText\(message\)/);
 assert.match(js,/Outlook sending is not set up/);
});
