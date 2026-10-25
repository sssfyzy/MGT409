import {eligible,cost} from './planner.js';
import {rankedMeals} from './recommendations.js';
import {supportsPeriod} from './today.js';
import {photoFor} from './food-photos.js';
// Small, disclosed bilingual menu matcher. Not an LLM or allergy verifier.
const groups=[
 ['chicken',/chicken|鸡肉|鸡胸|鸡排|鸡/g,/chicken|鸡/i],
 ['beef',/beef|steak|牛肉|牛排/g,/beef|steak/i],
 ['pork',/pork|bacon|ham|salami|pepperoni|猪肉|培根|火腿/g,/pork|bacon|ham|salami|pepperoni/i],
 ['fish',/fish|salmon|三文鱼|鱼/g,/fish|salmon/i],
 ['cheese',/cheese|芝士|奶酪/g,/cheese|cheddar|mozzarella|provolone|feta|swiss/i],
 ['bowl',/bowl|饭碗|碗|饭/g,/bowl/i],
 ['salad',/salad|沙拉/g,/salad/i],
 ['wrap',/wrap|卷饼|卷/g,/wrap/i],
 ['sandwich',/sandwich|三明治/g,/sandwich|melt|blt|roll|grilled cheese/i],
 ['sushi',/sushi|寿司/g,/sushi/i],['pizza',/pizza|披萨|比萨/g,/pizza/i],
 ['burger',/burger|汉堡/g,/burger/i],['noodles',/noodles?|ramen|面条|拉面/g,/noodle|ramen/i],
 ['pasta',/pasta|意面/g,/pasta/i]
];
export function parseRequest(raw=''){
 const text=String(raw).trim().slice(0,300).toLowerCase(),zh=/[\u3400-\u9fff]/.test(text),excluded=[];
 let positive=text;
 for(const [name,pattern] of groups){const vocabulary=pattern.source;const negation=new RegExp(`(?:no\\s+|without\\s+|avoid\\s+|不要|不吃|不加|无)(?:${vocabulary})`,'g');if(negation.test(text)){excluded.push(name);positive=positive.replace(negation,' ');}}
 const wanted=groups.filter(([,re])=>{re.lastIndex=0;return re.test(positive);}).map(([key])=>key);
 const budgetMatch=text.match(/\$\s*(\d+(?:\.\d{1,2})?)/)||text.match(/(?:预算|不超过|低于)\s*(\d+(?:\.\d{1,2})?)/)||text.match(/(\d+(?:\.\d{1,2})?)\s*(?:dollars?|刀|美元|美金)/);
 const calorieMatch=text.match(/(?:under|below|less than|低于|不超过)\s*(\d{3,4})\s*(?:kcal|calories|卡|大卡)/);
 const light=/light|healthy|not too heavy|清淡|健康|低卡/.test(text);
 const vegetarian=/vegetarian|veggie|meatless|素食|吃素|纯素|不吃肉|不要肉/.test(text)&&!/(?:no\s+|不要)(?:veggie|vegetarian|素食)/.test(text);
 const unsupported=/allerg|gluten.free|celiac|过敏|无麸质|vegan|纯素/.test(text);
 const channel=/delivery|外卖|配送/.test(text)?'delivery':/pickup|take.?out|自取|打包/.test(text)?'pickup':/dine.?in|堂食/.test(text)?'dinein':null;
 const broad=/^(?:surprise me|anything|recommend(?: something)?|suggest(?: something)?|i.?m hungry|随便|推荐(?:一下|点吃的)?|都行|饿了?)(?: please)?[.!?。！？]*$/.test(text);
 return {text,zh,wanted,excluded,budget:budgetMatch?Number(budgetMatch[1]):null,maxKcal:calorieMatch?Number(calorieMatch[1]):null,light,vegetarian,unsupported,channel,broad};
}
export function curateFour(catalogue,settings,origin,raw,period='Lunch'){
 const parsed=parseRequest(raw),empty=message=>({items:[],total:0,message,parsed});
 if(raw===undefined)return empty(`Tell me what sounds good for ${period.toLowerCase()}. I’ll narrow the menu to four little picks.`);
 if(parsed.unsupported)return empty(parsed.zh?'过敏、无麸质或纯素需求，现有菜单无法保证。请先向餐厅核实，我不会把任何菜标为安全。':'I can’t verify allergy, gluten-free or vegan safety from this menu. Please confirm directly with the restaurant.');
 if(parsed.channel&&parsed.channel!==(settings.fulfillment||'pickup'))return empty(parsed.zh?'请在下方设置切换用餐方式；切换会重置草稿选餐。外卖还需要确认预估费用。':'Switch the eating mode in settings below first; that resets draft picks. Delivery also needs fee-estimate confirmation.');
 const cap=Math.min(settings.perMealBudget??settings.budget/5,parsed.budget??Infinity);
 const facts=m=>`${m.name} ${m.description} ${m.nutritionEstimate?.meat||''}`;
 let pool=eligible(settings,catalogue).filter(m=>supportsPeriod(m,period)&&cost(m,settings)<=cap+.001&&(!parsed.vegetarian||m.vegetarian)&&(!parsed.maxKcal||(Number.isFinite(m.kcal)&&m.kcal<=parsed.maxKcal)));
 for(const name of parsed.wanted){const re=groups.find(g=>g[0]===name)[2];pool=pool.filter(m=>re.test(facts(m)));}
 for(const name of parsed.excluded){const re=groups.find(g=>g[0]===name)[2];pool=pool.filter(m=>!re.test(facts(m)));}
 if(parsed.text&&!parsed.broad&&!parsed.light&&!parsed.vegetarian&&!parsed.wanted.length&&!parsed.excluded.length&&parsed.budget===null&&parsed.maxKcal===null&&!parsed.channel){const tokens=parsed.text.split(/\s+/).filter(t=>t.length>2&&!['want','would','like','please','some','something','today','lunch','dinner','have','what','food','with','for','the','and'].includes(t));pool=tokens.length?pool.filter(m=>tokens.some(t=>facts(m).toLowerCase().includes(t))):[];}
 const ranked=rankedMeals(pool,settings,origin).sort((a,b)=>{
  if(parsed.light){const gap=(a.meal.kcal??Infinity)-(b.meal.kcal??Infinity);if(gap)return gap;}
  return Number(!!photoFor(b.meal))-Number(!!photoFor(a.meal))||a.score-b.score;
 });
 const items=ranked.slice(0,4);
 if(!items.length)return empty(parsed.zh?'没有找到同时满足要求和含费预算的餐食。换个吃法或调整设置试试；我不会放宽预算来凑数。':'No menu matches fit that request and your all-in cap. Try another craving or adjust settings; I won’t pad the list or loosen your budget.');
 const message=parsed.zh?`便便帮你挑了 ${items.length} 个${period==='Dinner'?'晚餐':'午餐'}选项，都在每餐预估 $${cap.toFixed(2)} 内。${items.length<4?'符合条件的不足 4 个，不拿别的凑数。':''}热量为粗估，营业和最终价格需核实。`:`Little poop has ${items.length} ${period.toLowerCase()} picks for you, each within an estimated $${cap.toFixed(2)}.${items.length<4?' Fewer than four match; no filler.':''} Calories are rough estimates; check opening status and checkout price.`;
 return {items,total:ranked.length,message,parsed};
}
