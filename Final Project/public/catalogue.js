// Published-menu prices plus explicitly labeled, unverified ingredient calorie estimates.
import {estimateFor,nutritionReferences} from './nutrition.js';
const observed='2026-10-17';
const sources={
 avocado:{restaurant:'Avocado Haven',address:'9 Whitney Ave, New Haven, CT 06510',source:'https://www.avocadohaven.com/menu/',hours:'Mon–Sun 11am–9pm (published)',note:'Header lists 9 Whitney Ave; About text also mentions 39 Elm St. Confirm location before travelling.',cuisine:'Mexican',color:'#e4ebcc',icon:'🍱'},
 george:{restaurant:'Café George by Paula',address:'300 George St #101, New Haven, CT 06511',source:'https://www.cafegeorgebypaula.com/menus',hours:'Mon–Fri 7:30am–2pm; lunch 11am–2pm (published)',note:'Published prices may change. Call to order; not affiliated with outside ordering or delivery services. Confirm availability and seating.',cuisine:'Café',color:'#ecdfcb',icon:'🥪'}
};
function item(id,key,name,price,vegetarian,description,icon){const estimate=estimateFor(id);return {id,...sources[key],name,price,vegetarian,description,icon:icon||sources[key].icon,kcal:estimate?.kcal??null,protein:null,vegetables:null,walk:null,observed,nutritionEstimate:estimate,nutritionStatus:'Estimated, not restaurant verified',nutritionSource:'BellyBank ingredient-and-portion assumptions',nutritionReferences,priceStatus:'Published menu snapshot',tags:[vegetarian?'Menu vegetarian option':'Menu item','Rough calorie estimate']};}
export const localMeals=[
 item('ah-chicken','avocado','Chicken bowl',9.88,false,'Build-your-own bowl; standard rice, beans and included toppings. Premium additions excluded.'),
 item('ah-veggie','avocado','Grilled veggie bowl',8.88,true,'Build-your-own veggie bowl; premium additions excluded.','🥗'),
 item('ah-steak','avocado','Steak bowl',11.88,false,'Build-your-own steak bowl; premium additions excluded.'),
 item('ah-salmon','avocado','Salmon bowl',12.88,false,'Build-your-own salmon bowl; premium additions excluded.'),
 item('cg-goddess-wrap','george','Green Goddess Wrap',9.95,true,'Vegetable wrap with herb cream cheese and cheddar.','🌯'),
 item('cg-garden','george','Garden Salad',9.25,true,'Vegetables, chickpeas and croutons.','🥗'),
 item('cg-cheese','george','3 Cheese Grilled Cheese',9.25,true,'Cheddar, American and Swiss with tomatoes on whole wheat.'),
 item('cg-hot-veggie','george','Hot Veggie',9.95,true,'Vegetables, provolone and mayonnaise on a hard roll.'),
 item('cg-med-bowl','george','Mediterranean Bowl',15.25,false,'Chicken, quinoa, chickpeas, hummus, feta and vegetables.','🍱'),
 item('cg-goddess-bowl','george','Green Goddess Bowl',13.95,true,'Quinoa, edamame, greens and vegetables.','🥗'),
 item('cg-tuscan','george','Tuscan Bowl',15.25,false,'Chicken, quinoa, mozzarella and vegetables.','🍱'),
 item('cg-newhaven','george','The New Haven Original',11.50,false,'Chicken cutlet, smoked mozzarella, bacon and chipotle mayonnaise.'),
 item('cg-ham','george','Ham Melt',9.95,false,'Grilled smoked ham, cheddar cheese, tomatoes and mustard on whole wheat.'),
 item('cg-blt','george','BLT',9.95,false,'Applewood smoked bacon, lettuce, tomato and mayonnaise on toasted sourdough.'),
 {...item('cg-antipasto','george','The Antipasto',10.95,false,'Ham, salami, pepperoni and provolone with vegetables and vinaigrette on a hard roll.'),observed:'2026-10-18'},
 {...item('cg-hummus','george','House Lemon Basil Hummus',9.95,true,'Lemon-basil hummus, cheddar and assorted vegetables in a tomato wrap.','🌯'),observed:'2026-10-18'},
 {...item('cg-mozzarella','george','Fresh Mozzarella',10.95,true,'Fresh mozzarella, roasted peppers, tomato and basil pesto on a hard roll.') ,observed:'2026-10-18'}
];
