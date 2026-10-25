import test from 'node:test';
import assert from 'node:assert/strict';
import {surprise,generate,validatePlan} from '../public/planner.js';
import {localMeals} from '../public/catalogue.js';
const s={budget:75,target:700,tax:6.35,tip:0,walk:15,vegetarian:false,allowUnknownWalk:true};
test('surprise changes exactly one unlocked lunch within all constraints',()=>{const plan=generate(s,'balanced',{},localMeals);for(const random of [()=>0,()=>.45,()=>.999]){const result=surprise(plan,s,{0:plan[0]},localMeals,random);assert.ok(result);assert.equal(result.plan[0],plan[0]);assert.equal(result.plan.filter((id,i)=>id!==plan[i]).length,1);assert.ok(validatePlan(result.plan,s,localMeals).valid);}});
test('all locked or overbudget plans do not silently relax constraints',()=>{const plan=generate(s,'balanced',{},localMeals);assert.equal(surprise(plan,s,Object.fromEntries(plan.map((id,i)=>[i,id])),localMeals),null);assert.equal(surprise(plan,{...s,budget:1},{},localMeals),null);});
test('vegetarian surprises remain vegetarian',()=>{const settings={...s,vegetarian:true};const plan=generate(settings,'balanced',{},localMeals);assert.ok(validatePlan(surprise(plan,settings,{},localMeals).plan,settings,localMeals).valid);});
