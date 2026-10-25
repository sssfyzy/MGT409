import {load} from 'cheerio';
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
export function extractMenuRows(html,source){
 const $=load(html);$('script,style,nav,footer').remove();const rows=[];
 // Conservative named menu blocks; no prices inferred from reviews or nearby unrelated text.
 const blocks=$('.menu-item, .menuItem, .menu-item-container, .menu-list__item, .menu-item-wrapper, .menu-section__item, [itemtype="https://schema.org/MenuItem"], [itemtype="http://schema.org/MenuItem"]');
 blocks.each((_,node)=>{const block=$(node);const headings=block.find('h2,h3,h4,h5,.menu-item__heading,.menu-item-name,.menu-item__title,[itemprop="name"]');
  let name=clean(headings.first().text());if(!name||name.length>120||headings.length>3)return;
  const priceNodes=block.find('.menu-item__price,.menu-item-price,.menu-item__prices,.price,.Price,[itemprop="price"],[class$="__price"]');
  let labels=[...new Set(priceNodes.toArray().map(x=>clean($(x).attr('content')||$(x).text())).filter(Boolean))];
  if(!labels.length){const line=clean(block.text());const match=line.match(/\$\s*\d+(?:\.\d{1,2})?\s*$/);if(match&&line.length<300)labels=[match[0]];}
  for(const label of labels){if(label.length>80)continue;const exact=label.match(/^\$?\s*(\d{1,3}(?:\.\d{1,2})?)\s*$/);const price=exact?Number(exact[1]):null;if(price!==null&&(price<1||price>500))continue;
   rows.push({name,price,priceLabel:label,currency:'USD',source,sourceType:'HTML menu-item block',verification:'Automatically extracted named menu row; not manually checked or a live quote',observedAt:new Date().toISOString()});
  }
 });
 // Semantic restaurant menu definition lists: a dt item paired with its own dd price.
 $('dl').each((_,node)=>{$(node).children('dt').each((_,dt)=>{const name=clean($(dt).text());const dd=$(dt).next('dd');const label=clean(dd.find('.price').text()||dd.text());const match=label.match(/^\$\s*(\d{1,3}(?:\.\d{1,2})?)$/);if(name&&name.length<100&&match)rows.push({name,price:Number(match[1]),priceLabel:label,currency:'USD',source,sourceType:'Semantic menu definition list',verification:'Automatically extracted; not manually checked or a live quote',observedAt:new Date().toISOString()});});});
 // Exact text rows on menu pages, with an explicit dollar sign and trailing price.
 // Preserve the literal short name instead of inventing a description or missing price.
 if(/menu/i.test(new URL(source).pathname))$('main p, main h3, main h4, main li, .sqs-block-content p').each((_,node)=>{const line=clean($(node).text());const match=line.match(/^([A-Za-zÀ-ÿ][^$]{2,95}?)\s+\$\s*(\d{1,3}(?:\.\d{1,2})?)\s*$/);if(!match||/tax|gratuity|minimum|fee|per person|happy hour|gift card/i.test(match[1]))return;rows.push({name:clean(match[1]),price:Number(match[2]),priceLabel:'$'+match[2],currency:'USD',source,sourceType:'Short menu text row with explicit dollar price',verification:'Automatically extracted literal row; not manually checked or a live quote',observedAt:new Date().toISOString()});});
 return [...new Map(rows.map(r=>[r.name+'|'+r.priceLabel,r])).values()];
}
