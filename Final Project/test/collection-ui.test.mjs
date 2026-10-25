import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionMarkup} from '../public/collection-ui.js';

const base={people:[{id:'payer',name:'Alex'},{id:'payee',name:'Sam'}],_heroes:{},transfers:[],_personId:'payer'};
const transfer={fromId:'payer',toId:'payee',amountCents:1250};
const face=()=>'<span>🙂</span>';
test('only the payer gets a confirmation control; completed transfers keep a visible cash stack',()=>{
 const pending=collectionMarkup(base,{transfers:[transfer]},face);
 assert.match(pending,/data-confirm-transfer="0"/);assert.match(pending,/I sent \$12\.50/);
 const recipient=collectionMarkup({...base,_personId:'payee'},{transfers:[transfer]},face);
 assert.doesNotMatch(recipient,/data-confirm-transfer/);assert.match(recipient,/Waiting for Alex/);
 const done=collectionMarkup({...base,transfers:[transfer]},{transfers:[]},face);
 assert.match(done,/💵 💵/);assert.match(done,/self-reported/);
});
