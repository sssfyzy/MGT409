import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetRows,readBudgetFile} from '../public/budget-import.js';

test('spreadsheet columns map to budget rows without trusting payer or actual amounts',()=>{
 const result=budgetRows([['分类','采购项目','数量','单位','采购使者','预算','实际金额','备注'],['场地','Kitchen rental','1','room','Alex','$150','$125','Reserve early']]);
 assert.deepEqual(result.items,[{category:'场地',name:'Kitchen rental',quantity:'1',unit:'room',budgetCents:15000,note:'Reserve early'}]);
 assert.equal(result.warnings.length,2);
});
test('local CSV handles quoted cells and never sends the file as an upload',async()=>{
 const file={name:'party.csv',size:80,text:async()=>`Category,Item,Qty,Unit,Budget,Note\nFood,"Ribs, pork",4,lb,$15,"Buy, then chill"`};
 const result=await readBudgetFile(file);
 assert.equal(result.items[0].name,'Ribs, pork');
 assert.equal(result.items[0].budgetCents,1500);
 assert.equal(result.items[0].note,'Buy, then chill');
});
