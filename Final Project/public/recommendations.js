// Public business data only. A shopper's coordinates stay in journey memory.
export const areas={green:{label:'Downtown · New Haven Green',lat:41.3082,lon:-72.9279},medical:{label:'Medical district',lat:41.302,lon:-72.933},eastrock:{label:'East Rock · neighborhood center',lat:41.325,lon:-72.917}};
export const restaurants={
 george:{name:'Café George by Paula',lat:41.305012043913,lon:-72.93044018428,address:'300 George St #101, New Haven',locationStatus:'Approximate street-address geocode; not a walking route.',geoSource:'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=300%20George%20St%20New%20Haven%20CT&benchmark=Public_AR_Current&format=json',menu:'https://www.cafegeorgebypaula.com/menus',phone:'tel:+12037771414',delivery:null,note:'Call to order. Lunch Mon–Fri 11am–2pm. The restaurant disclaims all outside ordering/delivery services. Confirm seating before dining in.'},
 avocado:{name:'Avocado Haven',lat:null,lon:null,address:'9 Whitney Ave listed; confirm location by phone',locationStatus:'Official header says 9 Whitney Ave, About says 39 Elm St, map target says 1054 Chapel St. Distance withheld.',menu:'https://www.avocadohaven.com/menu/',phone:'tel:+12034959004',delivery:'https://www.ubereats.com/store/avocado-haven/wy8kejjJRGORQTYulkWCag',note:'Uber Eats lists this restaurant and a $13.95 starting-price bowl. Delivery to your address, opening status and ingredient surcharges must be checked there. Official online-order page is not currently usable.'}
};
export const restaurantFor=m=>restaurants[m.id.startsWith('cg-')?'george':m.id.startsWith('ah-')?'avocado':''];
export const inCoverage=p=>!!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=41.25&&p.lat<=41.36&&p.lon>=-72.99&&p.lon<=-72.85;
export function distanceKm(a,b){if(!a||!b||![a.lat,a.lon,b.lat,b.lon].every(Number.isFinite))return null;const r=x=>x*Math.PI/180;const dlat=r(b.lat-a.lat),dlon=r(b.lon-a.lon);return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dlon/2)**2)));}
export function channelAllowed(meal,s){return s.fulfillment!=='delivery'||!!restaurantFor(meal)?.delivery;}
const round=n=>Math.round(n*100)/100;
export function priceBreakdown(meal,s){
 const delivery=s.fulfillment==='delivery';
 // Delivery platform prices differ from the official in-store menu. This is a
 // starting-price bowl, not a protein-specific or checkout quote.
 const base=delivery&&meal.id.startsWith('ah-')?13.95:meal.price;
 const service=delivery?round(base*(s.serviceFeePercent??15)/100):0;
 const deliveryFee=delivery?(s.deliveryFee??3.99):0;
 const reserve=delivery?(s.extraReserve??2):0;
 const tax=round((base+service+deliveryFee+reserve)*s.tax/100);
 const tip=round(base*s.tip/100);
 return {base,service,deliveryFee,reserve,tax,tip,total:round(base+service+deliveryFee+reserve+tax+tip),delivery,estimated:true};
}
export function rankedMeals(pool,s,origin){
 if(origin&&!inCoverage(origin))return [];
 return pool.filter(m=>channelAllowed(m,s)).map(meal=>{const venue=restaurantFor(meal),distance=distanceKm(origin,venue);const kcalGap=Math.abs((meal.kcal??s.target)-s.target);const total=priceBreakdown(meal,s).total;return {meal,venue,distance,kcalGap,total,score:kcalGap/s.target*2+total/s.perMealBudget*.35+(origin?(distance??2)*.15:0)};}).sort((a,b)=>a.score-b.score||a.meal.id.localeCompare(b.meal.id));
}
