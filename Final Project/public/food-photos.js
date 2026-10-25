// Exact dish labels from Cafe George's official menu, checked Oct 17, 2026.
// Official publication does not verify photographer ownership or today's plating.
export const photos={
 'cg-antipasto':{url:'https://static.wixstatic.com/media/ebc1df_5bc5f1088012467d8d511c30553b641b~mv2.jpg',source:'https://www.cafegeorgebypaula.com/menus',author:'Cafe George by Paula official menu',alt:'Official menu image labeled The Antipasto',label:'Official menu photo'},
 'cg-hummus':{url:'https://static.wixstatic.com/media/aaeba528529f43b887b9856b7d41cd00.jpg',source:'https://www.cafegeorgebypaula.com/menus',author:'Cafe George by Paula official menu',alt:'Official menu image labeled House Lemon Basil Hummus',label:'Official menu photo'},
 'cg-mozzarella':{url:'https://static.wixstatic.com/media/5f61605c609ad178a06cf919e4f24764.jpg',source:'https://www.cafegeorgebypaula.com/menus',author:'Cafe George by Paula official menu',alt:'Official menu image labeled Fresh Mozzarella',label:'Official menu photo'},
 'cg-cheese':{url:'https://static.wixstatic.com/media/83345e2188d84ebd9fe8d128b1f12946.jpg',source:'https://www.cafegeorgebypaula.com/menus',author:'Cafe George by Paula official menu',alt:'Official menu image labeled 3 Cheese Grilled Cheese',label:'Official menu photo'},
 'cg-ham':{url:'https://static.wixstatic.com/media/11062b_2de0d7f914ae4beab843ea63099811d2~mv2.jpg',source:'https://www.cafegeorgebypaula.com/menus',author:'Cafe George by Paula official menu',alt:'Official menu image labeled Ham Melt',label:'Official menu photo'},
 'cg-blt':{url:'https://static.wixstatic.com/media/3e7b0c761bd247e9a84450934614f883.jpg',source:'https://www.cafegeorgebypaula.com/menus',author:'Cafe George by Paula official menu',alt:'Official menu image labeled BLT',label:'Official menu photo'}
};
export function photoFor(meal){return photos[meal.id]||null;}
export function photoElement(photo,{eager=false,onUnavailable}={}){const img=document.createElement('img');img.src=photo.url;img.alt=photo.alt;img.loading=eager?'eager':'lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.className='food-photo';img.addEventListener('error',()=>{img.remove();onUnavailable?.();},{once:true});return img;}
