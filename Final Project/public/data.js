// Fictional fixtures. No real restaurant prices, nutrition, or walking routes are claimed.
export const demoMeals = [
  { id:'grain', restaurant:'The Grain Room', name:'Lemon chicken grain bowl', cuisine:'Mediterranean', price:14.5, kcal:650, protein:38, vegetables:2, walk:8, icon:'🥗', color:'#e5efcf', tags:['Balanced','High protein'], vegetarian:false },
  { id:'noodle', restaurant:'Little Noodle', name:'Ginger tofu noodle bowl', cuisine:'Asian', price:12.5, kcal:680, protein:24, vegetables:2, walk:6, icon:'🍜', color:'#f7e0bd', tags:['Vegetarian','Comfort food'], vegetarian:true },
  { id:'taco', restaurant:'Mesa Verde', name:'Black bean & avocado tacos', cuisine:'Mexican', price:11, kcal:590, protein:19, vegetables:2, walk:11, icon:'🌮', color:'#e1e9c9', tags:['Vegetarian','Budget pick'], vegetarian:true },
  { id:'salmon', restaurant:'Coast & Co.', name:'Roasted salmon rice bowl', cuisine:'Seafood', price:20, kcal:720, protein:42, vegetables:2, walk:14, icon:'🍱', color:'#f0d8cf', tags:['High protein','Treat yourself'], vegetarian:false },
  { id:'pizza', restaurant:'Sunday Slice', name:'Margherita pizza & side salad', cuisine:'Italian', price:15, kcal:890, protein:25, vegetables:1, walk:5, icon:'🍕', color:'#f5ddbd', tags:['Vegetarian','Comfort food'], vegetarian:true },
  { id:'burger', restaurant:'Corner Grill', name:'Double burger & fries', cuisine:'American', price:19, kcal:1150, protein:45, vegetables:0, walk:9, icon:'🍔', color:'#e7d4b6', tags:['Comfort food','Treat yourself'], vegetarian:false },
  { id:'soup', restaurant:'Daily Greens', name:'Lentil soup & wholegrain toast', cuisine:'Mediterranean', price:9.5, kcal:520, protein:23, vegetables:2, walk:7, icon:'🥣', color:'#e6e7c2', tags:['Vegetarian','Budget pick'], vegetarian:true },
  { id:'wrap', restaurant:'The Grain Room', name:'Chicken hummus wrap', cuisine:'Mediterranean', price:12, kcal:620, protein:35, vegetables:1, walk:8, icon:'🌯', color:'#e7dfc9', tags:['High protein','Budget pick'], vegetarian:false },
  { id:'curry', restaurant:'Little Noodle', name:'Chickpea & spinach curry', cuisine:'Asian', price:13, kcal:710, protein:22, vegetables:2, walk:6, icon:'🍛', color:'#f0dcb7', tags:['Vegetarian','Comfort food'], vegetarian:true },
  { id:'pasta', restaurant:'Sunday Slice', name:'Roasted vegetable pasta', cuisine:'Italian', price:14, kcal:760, protein:21, vegetables:2, walk:5, icon:'🍝', color:'#efd9cc', tags:['Vegetarian','Balanced'], vegetarian:true }
];
export let meals=demoMeals;
export function setMeals(catalogue){meals=catalogue;}
export const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
export const defaultPlan = ['grain','noodle','taco','salmon','soup'];
