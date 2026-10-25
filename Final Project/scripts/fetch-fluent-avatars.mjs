import {mkdir,readFile,writeFile,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Handpicked existing artwork from Microsoft's Fluent Emoji collection. No avatars are drawn here.
const animalNames=`Cat face|Dog face|Fox|Panda|Penguin|Otter|Koala|Bear|Rabbit face|Hamster|Tiger face|Lion|Unicorn|Dragon face|Frog|Duck|Owl|Parrot|Peacock|Flamingo|Swan|Dove|Eagle|Chicken|Rooster|Turkey|Blackbird|Bird|Polar bear|Raccoon|Skunk|Sloth|Hedgehog|Kangaroo|Giraffe|Zebra|Elephant|Hippopotamus|Rhinoceros|Deer|Goat|Llama|Camel|Horse face|Cow face|Pig face|Monkey face|Gorilla|Orangutan|Wolf|Bat|Seal|Shark|Spouting whale|Tropical fish|Blowfish|Octopus|Squid|Jellyfish|Crab|Lobster|Turtle|Crocodile|Snake|Butterfly|Honeybee|Lady beetle|Ant|Spider|Phoenix bird|Black cat|Grinning cat with smiling eyes|Kissing cat|Pouting cat|Smiling cat with heart-eyes|Cat with tears of joy|Cat with wry smile|Crying cat|Weary cat|Poodle`.split('|');
const faceNames=`Zany face|Partying face|Smiling face with sunglasses|Face with tears of joy|Rolling on the floor laughing|Face with peeking eye|Melting face|Face in clouds|Face exhaling|Face with hand over mouth|Face with open eyes and hand over mouth|Thinking face|Face with raised eyebrow|Smirking face|Winking face|Winking face with tongue|Squinting face with tongue|Face with tongue|Drooling face|Money-mouth face|Nerd face|Disguised face|Cowboy hat face|Clown face|Pleading face|Hugging face|Smiling face with heart-eyes|Smiling face with hearts|Face blowing a kiss|Smiling face with halo|Saluting face|Grinning squinting face|Grinning face with sweat|Beaming face with smiling eyes|Grinning face with big eyes|Grinning face with smiling eyes|Grinning face|Smiling face with smiling eyes|Slightly smiling face|Upside-down face|Shushing face|Face with rolling eyes|Unamused face|Expressionless face|Confused face|Face with diagonal mouth|Hushed face|Astonished face|Flushed face|Hot face|Cold face|Face screaming in fear|Face with steam from nose|Angry face with horns|Smiling face with horns|Face with symbols on mouth|Crying face|Loudly crying face|Face holding back tears|Sleepy face`.split('|');
const foodNames=`Strawberry|Cherries|Watermelon|Pineapple|Avocado|Lemon|Banana|Peach|Green apple|Grapes|Mushroom|Croissant|Bagel|Pretzel|Pancakes|Waffle|Cupcake|Doughnut|Cookie|Birthday cake|Shortcake|Pizza|Taco|Hamburger|French fries|Hot dog|Sushi|Dumpling|Popcorn|Ice cream`.split('|');
const funNames=`Pile of poo|Alien|Alien monster|Ghost|Robot|Skull|Jack-o-lantern|Crown|Gem stone|Magic wand|Crystal ball|Rocket|Flying saucer|Balloon|Party popper|Fireworks|Sparkles|Fire|Rainbow|Glowing star|Sun with face|Full moon|Teddy bear|Video game|Game die|Guitar|Musical notes|Soccer ball|Basketball|Four leaf clover`.split('|');
const weatherNames=`Sun|Star|Shooting star|Comet|Ringed planet|Cloud|Cloud with rain|Cloud with snow|Cloud with lightning|Cloud with lightning and rain|Sun behind cloud|Sun behind large cloud|Sun behind small cloud|Sun behind rain cloud|Snowflake|Snowman|Snowman without snow|Tornado|Cyclone|Fog|Foggy|Wind face|Droplet|Water wave|Umbrella|Umbrella with rain drops|Umbrella on ground|Beach with umbrella|Sunrise|Sunrise over mountains|Sunset|Night with stars|Crescent moon|New moon|New moon face|Waxing crescent moon|First quarter moon|First quarter moon face|Waxing gibbous moon|Full moon face|Waning gibbous moon|Last quarter moon|Last quarter moon face|Waning crescent moon|Mountain|Snow-capped mountain|Volcano|Desert island|Dotted six-pointed star|Eight-pointed star`.split('|');
if([animalNames,faceNames,foodNames,funNames,weatherNames].map(group=>group.length).join(',')!=='80,60,30,30,50')throw Error('Curated list counts changed');

const treeResponse=await fetch('https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/main?recursive=1',{headers:{'User-Agent':'HolySplit-asset-curator'}});
if(!treeResponse.ok)throw Error(`Cannot inspect asset catalog: HTTP ${treeResponse.status}`);
const tree=await treeResponse.json();
if(tree.truncated)throw Error('Asset tree is incomplete');
const base='https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/';
const directPath=name=>{
 const hit=tree.tree.find(item=>item.type==='blob'&&item.path.startsWith(`assets/${name}/3D/`)&&item.path.endsWith('.png'));
 if(!hit)throw Error(`Missing 3D illustration: ${name}`);
 return hit.path;
};
const groups=[
 {id:'animal',label:'Animals',roleId:'snacks',color:'#f4ddbf',items:animalNames.map(name=>({name,path:directPath(name)}))},
 {id:'meme',label:'Meme faces',roleId:'games',color:'#f3dfab',items:faceNames.map(name=>({name,path:directPath(name)}))},
 {id:'food',label:'Snack squad',roleId:'sweet',color:'#f8dec9',items:foodNames.map(name=>({name,path:directPath(name)}))},
 {id:'fun',label:'Party chaos',roleId:'music',color:'#e6d8ed',items:funNames.map(name=>({name,path:directPath(name)}))},
 {id:'weather',label:'Sky & weather',roleId:'fairy',color:'#dce9f5',items:weatherNames.map(name=>({name,path:directPath(name)}))}
];
const dir=new URL('../public/avatars/',import.meta.url);await mkdir(dir,{recursive:true});
const all=groups.flatMap(group=>group.items.map((item,index)=>({
 id:`${group.id}-${String(index+1).padStart(2,'0')}`,category:group.id,name:item.name,roleId:group.roleId,color:group.color,path:item.path
})));
if(all.length!==250||new Set(all.map(a=>a.path)).size!==250)throw Error('Expected 250 distinct source images');
const images={},manifest=[];let cursor=0;
async function worker(){
 while(cursor<all.length){
  const a=all[cursor++],file=new URL(`${a.id}.png`,dir),source=base+a.path.split('/').map(encodeURIComponent).join('/');
  let bytes;try{bytes=await readFile(file);}catch{}
  if(!bytes){
   for(let attempt=0;attempt<4;attempt++){
    try{const response=await fetch(source,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`${a.id}: HTTP ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());break;}
    catch(error){if(attempt===3)throw error;await new Promise(resolve=>setTimeout(resolve,750*(attempt+1)));}
   }
   await writeFile(file,bytes);
  }
  if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error(`Not PNG: ${a.id}`);
  images[a.id]='data:image/png;base64,'+bytes.toString('base64');
  manifest.push({id:a.id,category:a.category,source,sha256:createHash('sha256').update(bytes).digest('hex')});
  if(manifest.length%25===0)console.log(`Curated images ready: ${manifest.length}/250`);
 }
}
await Promise.all(Array.from({length:8},worker));
if(new Set(manifest.map(item=>item.sha256)).size!==250)throw Error('Duplicate image bytes detected');
const moodMeta=groups.map(({id,label,roleId,color,items})=>({id,label,roleId,color,count:items.length}));
await writeFile(new URL('../public/personality-avatars.js',import.meta.url),`// Existing Microsoft Fluent Emoji art, catalogued by HolySplit.\nexport const AVATAR_MOODS=${JSON.stringify(moodMeta)};\nexport const PERSONALITY_AVATARS=${JSON.stringify(all.map(({path,...publicData})=>publicData))};\n`);
await writeFile(new URL('../public/avatar-images.js',import.meta.url),`// Cached PNG images keep the standalone demo usable without a network connection.\nexport const AVATAR_IMAGES=${JSON.stringify(images)};\n`);
const licenseResponse=await fetch(base+'LICENSE');if(!licenseResponse.ok)throw Error('Could not download image license');
await writeFile(new URL('LICENSE',dir),await licenseResponse.text());
await writeFile(new URL('sources.json',dir),JSON.stringify({source:'Microsoft Fluent Emoji',repository:'https://github.com/microsoft/fluentui-emoji',license:'MIT',licenseURL:'https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE',items:manifest.sort((a,b)=>a.id.localeCompare(b.id))},null,2));
// Remove only the superseded hero/villain art and obsolete generated SVGs.
for(const name of await readdir(dir))if(/^(hero|villain)-\d{2}\.png$|^(goofy|cool|glam|chaos|chill)-\d{2}\.svg$/.test(name))await unlink(new URL(name,dir));
console.log('250 distinct existing emoji illustrations cached with provenance and MIT license.');
