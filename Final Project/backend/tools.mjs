import {localMeals} from '../public/catalogue.js';
import {demoMeals} from '../public/data.js';
import {generate,summary,validateSettings,validatePlan} from '../public/planner.js';
export function catalogueFor(dataset){if(dataset==='local')return localMeals;if(dataset==='demo')return demoMeals;throw new Error('Unknown dataset');}
export function validateRequest(body){
 if(!body||!['local','demo'].includes(body.dataset)||!validateSettings(body.settings))throw new Error('Invalid dataset or planning settings');
 const locked=body.locked||{};
 if(typeof locked!=='object'||Array.isArray(locked)||Object.entries(locked).some(([slot,id])=>! /^[0-4]$/.test(slot)||typeof id!=='string'||!catalogueFor(body.dataset).some(m=>m.id===id)))throw new Error('Invalid kept meals');
 return {dataset:body.dataset,settings:body.settings,locked};
}
export function buildPlan(body){const context=validateRequest(body);const catalogue=catalogueFor(context.dataset);const plan=generate(context.settings,body.mode==='save'?'save':'balanced',context.locked,catalogue);return {dataset:context.dataset,plan,summary:plan?summary(plan,context.settings,catalogue):null,notice:plan?'Computed from catalogue prices and explicit assumptions. Calories are rough ingredient estimates, not restaurant verified; protein and walking times remain unknown.':'No plan satisfies these constraints. Previous plan and settings kept. No constraint was relaxed.'};}
export const toolDefinitions=[
 {type:'function',name:'search_menu',description:'Read curated menu items. Published prices are snapshots, not live quotes. Calories are labeled ingredient estimates, not restaurant verified; unknown protein and walking times are null.',strict:true,parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}},
 {type:'function',name:'get_meal',description:'Read one catalogue meal, including price source and missing data.',strict:true,parameters:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}},
 {type:'function',name:'build_week',description:'Calculate five lunches using the shopper-confirmed constraints and kept slots. Returns no plan when infeasible.',strict:true,parameters:{type:'object',properties:{mode:{type:'string',enum:['balanced','save']}},required:['mode'],additionalProperties:false}},
 {type:'function',name:'check_week',description:'Validate exactly five catalogue IDs against budget, walking and vegetarian constraints. Recomputes all figures.',strict:true,parameters:{type:'object',properties:{ids:{type:'array',items:{type:'string'}}},required:['ids'],additionalProperties:false}}
];
export function executeTool(name,args,context){
 const catalogue=catalogueFor(context.dataset);
 if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Invalid tool arguments');
 if(name==='search_menu'){if(typeof args.query!=='string'||args.query.length>200)throw new Error('Invalid query');const query=args.query.toLowerCase();return catalogue.filter(m=>[m.name,m.restaurant,m.cuisine,m.description].join(' ').toLowerCase().includes(query));}
 if(name==='get_meal'){if(typeof args.id!=='string')throw new Error('Invalid ID');return catalogue.find(m=>m.id===args.id)||{error:'Meal not found'};}
 if(name==='build_week'){if(!['balanced','save'].includes(args.mode))throw new Error('Invalid planning mode');return buildPlan({...context,mode:args.mode});}
 if(name==='check_week')return validatePlan(args.ids,context.settings,catalogue);
 throw new Error('Tool is not allowlisted');
}
