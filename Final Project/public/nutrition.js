// Rough planning assumptions, NOT restaurant nutrition facts or measured portions.
// Calories are rounded component averages; ranges allow for portion/oil/sauce variation.
export const nutritionReferences=[
 {title:'Chipotle US ingredient nutrition (comparison only, not Avocado Haven)',url:'https://www.chipotle.com/content/dam/chipotle/menu/nutrition/US-Nutrition-Facts-Paper-Menu-3-2025.pdf'},
 {title:'Subway US sandwich nutrition (comparison only, not Cafe George)',url:'https://www.subway.com/en-us/-/media/northamerica/usa/nutrition/nutritiondocuments/2025/us_nutrition_eng_3-28-25.pdf'}
];
// [component, assumed kcal]. Bread 2 slices; meat ~3–4 oz; sauce ~1 tbsp unless noted.
const rows={
 'ah-chicken':{meat:'Chicken, assumed grilled',parts:[['Rice, 1 cup',200],['Beans, 1/2 cup',130],['Chicken, 4 oz',180],['Vegetables + salsa',80],['Cheese + light dressing',130]],range:[550,950],balanced:true},
 'ah-veggie':{meat:'No meat',parts:[['Rice, 1 cup',200],['Beans, 1/2 cup',130],['Grilled vegetables + oil',120],['Salsa + standard toppings',150]],range:[450,850],balanced:true},
 'ah-steak':{meat:'Beef steak',parts:[['Rice, 1 cup',200],['Beans, 1/2 cup',130],['Steak, 4 oz',230],['Vegetables + salsa',80],['Cheese + light dressing',130]],range:[600,1050],balanced:false},
 'ah-salmon':{meat:'Salmon',parts:[['Rice, 1 cup',200],['Beans, 1/2 cup',130],['Salmon, 4 oz',230],['Vegetables + salsa',80],['Cheese + light dressing',130]],range:[600,1050],balanced:true},
 'cg-goddess-wrap':{meat:'No meat',parts:[['Large flour wrap',220],['Herb cream cheese',100],['Cheddar',110],['Vegetables',60]],range:[400,750],balanced:false},
 'cg-garden':{meat:'No meat',parts:[['Vegetables',70],['Chickpeas, 1/2 cup',130],['Croutons',100],['Dressing, assumed 2 tbsp',140]],range:[300,650],balanced:true},
 'cg-cheese':{meat:'No meat; three cheeses',parts:[['Whole-wheat bread, 2 slices',180],['Cheddar + American + Swiss, ~3 slices',240],['Butter/oil for grilling',100],['Tomatoes',20]],range:[430,800],balanced:false},
 'cg-hot-veggie':{meat:'No meat',parts:[['Hard roll',240],['Vegetables + cooking oil',100],['Provolone',100],['Mayonnaise, 1 tbsp',90]],range:[400,800],balanced:false},
 'cg-med-bowl':{meat:'Chicken, assumed grilled',parts:[['Quinoa, 1 cup',220],['Chicken, 4 oz',180],['Chickpeas',100],['Hummus',100],['Feta',80],['Vegetables + dressing',150]],range:[650,1100],balanced:true},
 'cg-goddess-bowl':{meat:'No meat; edamame',parts:[['Quinoa, 1 cup',220],['Edamame',100],['Greens + vegetables',60],['Dressing',100]],range:[350,700],balanced:true},
 'cg-tuscan':{meat:'Chicken, assumed grilled',parts:[['Quinoa, 1 cup',220],['Chicken, 4 oz',180],['Mozzarella',100],['Vegetables',60],['Dressing',90]],range:[500,900],balanced:true},
 'cg-newhaven':{meat:'Chicken cutlet + pork bacon',parts:[['Sandwich bread/roll',240],['Chicken cutlet, assumed breaded/fried',300],['Smoked mozzarella',100],['Bacon',130],['Chipotle mayonnaise',90]],range:[700,1200],balanced:false},
 'cg-ham':{meat:'Pork ham',parts:[['Whole-wheat bread, 2 slices',180],['Smoked ham, ~3 oz',100],['Cheddar',100],['Tomato + mustard',30],['Grilling butter/oil',50]],range:[350,700],balanced:false},
 'cg-blt':{meat:'Pork bacon',parts:[['Sourdough, 2 slices',200],['Bacon, ~3 strips',130],['Mayonnaise, 1 tbsp',90],['Lettuce + tomato',30]],range:[350,700],balanced:false},
 'cg-antipasto':{meat:'Pork ham, salami and pepperoni',parts:[['Hard roll',240],['Mixed deli meats, assumed 4 oz',300],['Provolone',100],['Vegetables',40],['Vinaigrette',100]],range:[600,1100],balanced:false},
 'cg-hummus':{meat:'No meat',parts:[['Large tomato wrap',220],['Hummus, assumed 1/4 cup',150],['Cheddar',110],['Vegetables',60]],range:[400,800],balanced:false},
 'cg-mozzarella':{meat:'No meat',parts:[['Hard roll',240],['Fresh mozzarella, assumed 3 oz',240],['Roasted peppers and tomato',50],['Basil pesto, assumed 1 tbsp',90]],range:[450,900],balanced:false}
};
export function estimateFor(id){const r=rows[id];if(!r)return null;return {kcal:Math.round(r.parts.reduce((sum,p)=>sum+p[1],0)/10)*10,low:r.range[0],high:r.range[1],meat:r.meat,components:r.parts.map(([name,kcal])=>({name,kcal})),balanced:r.balanced,status:'rough estimate',method:'Ingredient averages and assumed portions; no side dish or drink; not restaurant verified',assumptions:'Actual bread size, protein portion, butter, oil, cheese and sauces may materially change this estimate. Build-your-own bowls assume rice, beans and common included toppings; premium extras excluded.'};}
export function calorieText(meal){if(!Number.isFinite(meal.kcal))return 'Calories unknown';return meal.nutritionEstimate?`~${meal.kcal} kcal · rough (${meal.nutritionEstimate.low}–${meal.nutritionEstimate.high})`:`~${meal.kcal} kcal · demo`;}
// Playful avatar mapping, not a clinical health score or a prediction of body change.
export function bellyFeedback(meals,target=700){
 const known=meals.filter(m=>Number.isFinite(m?.kcal));
 if(!known.length||known.length!==meals.length)return {state:'neutral',average:null,width:75,label:'Pick a lunch',note:'The belly is a cartoon of meal choices, not your body.'};
 const average=Math.round(known.reduce((a,m)=>a+m.kcal,0)/known.length),ratio=average/target;
 const balancedShare=known.filter(m=>m.nutritionEstimate?.balanced===true||(!m.nutritionEstimate&&m.vegetables>=2)).length/known.length;
 const state=ratio>1.15?'round':ratio<.85?'slim':balancedShare>=.6?'abs':'regular';
 return {state,average,width:state==='round'?97:state==='slim'?55:state==='abs'?61:75,label:state==='round'?'Round-belly mode':state==='slim'?'Slim-belly mode':state==='abs'?'Balanced-mix abs':'Easygoing belly',note:`~${average} kcal / lunch, based on ${known.some(m=>m.nutritionEstimate)?'rough estimates':'demo values'}. Avatar only—not a body forecast.`};
}
