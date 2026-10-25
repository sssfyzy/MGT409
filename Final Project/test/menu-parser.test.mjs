import test from 'node:test';
import assert from 'node:assert/strict';
import {extractMenuRows} from '../scripts/menu-parser.mjs';
test('named menu price extraction preserves source',()=>{const result=extractMenuRows('<article class="menu-item"><h3>Bean bowl</h3><p class="menu-item__price">$12.50</p></article>','https://example.org/menu');assert.equal(result[0].name,'Bean bowl');assert.equal(result[0].price,12.5);assert.equal(result[0].source,'https://example.org/menu');});
test('review prices and ordinary paragraphs are not promoted into menu rows',()=>assert.deepEqual(extractMenuRows('<section><h2>Reviews</h2><p>I paid $14 for lunch</p></section>','https://example.org'),[]));
test('ambiguous size prices stay null with their original label',()=>{const row=extractMenuRows('<div class="menu-item"><h3>Pizza</h3><span class="price">Small $12 / Large $18</span></div>','https://example.org/menu')[0];assert.equal(row.price,null);assert.equal(row.priceLabel,'Small $12 / Large $18');});
