import {ALL_AVATARS} from './hero-avatars.js?v=avatars-250';
const AVATAR_IDS=ALL_AVATARS.map(a=>a.id);
export const HEROES=[
 {
  "id": "grill",
  "emoji": "🐻",
  "name": "BBQ Bear",
  "role": "Grill Captain",
  "color": "#f4d6ba",
  "line": "I came. I grilled. I conquered.",
  "bring": [
   "Grill",
   "Burgers",
   "Skewers"
  ]
 },
 {
  "id": "snacks",
  "emoji": "🐰",
  "name": "Snack Bunny",
  "role": "Snack Wizard",
  "color": "#e8def5",
  "line": "Tiny paws. Legendary snacks.",
  "bring": [
   "Chips",
   "Popcorn",
   "Cookies"
  ]
 },
 {
  "id": "drinks",
  "emoji": "🐧",
  "name": "Chill Penguin",
  "role": "Hydration Hero",
  "color": "#d4e9f0",
  "line": "Stay cool. I brought the good stuff.",
  "bring": [
   "Drinks",
   "Ice",
   "Cups"
  ]
 },
 {
  "id": "music",
  "emoji": "🐱",
  "name": "DJ Meow",
  "role": "Vibe Commander",
  "color": "#f2dbe5",
  "line": "You bring the people. I bring the vibe.",
  "bring": [
   "Speaker",
   "Playlist"
  ]
 },
 {
  "id": "games",
  "emoji": "🦊",
  "name": "Lucky Fox",
  "role": "Game Master",
  "color": "#f5e4b9",
  "line": "Cute face. Competitive spirit.",
  "bring": [
   "Board games",
   "Cards"
  ]
 },
 {
  "id": "sweet",
  "emoji": "🐼",
  "name": "Sugar Panda",
  "role": "Dessert Legend",
  "color": "#dce8c9",
  "line": "Every great night deserves a sweet ending.",
  "bring": [
   "Cake",
   "Fruit",
   "Dessert"
  ]
 },
 {
  "id": "frog",
  "emoji": "🐸",
  "name": "Disco Froggy",
  "role": "Dance Captain",
  "color": "#dcebbd",
  "line": "One small hop. One giant party.",
  "bring": [
   "Party lights",
   "Playlist"
  ]
 },
 {
  "id": "otter",
  "emoji": "🦦",
  "name": "Helpful Otter",
  "role": "Setup Sidekick",
  "color": "#e9ddcd",
  "line": "I otter make this party easier.",
  "bring": [
   "Folding chairs",
   "Tablecloth"
  ]
 },
 {
  "id": "unicorn",
  "emoji": "🦄",
  "name": "Glitter Bean",
  "role": "Magic Maker",
  "color": "#eadcf4",
  "line": "A little sparkle. A lot of main-character energy.",
  "bring": [
   "Decorations",
   "Balloons"
  ]
 },
 {
  "id": "dragon",
  "emoji": "🐲",
  "name": "Dumpling Dragon",
  "role": "Feast Guardian",
  "color": "#d4e8d4",
  "line": "Small dragon. Big appetite.",
  "bring": [
   "Dumplings",
   "Sauce"
  ]
 },
 {
  "id": "ghost",
  "emoji": "👻",
  "name": "Mochi Ghost",
  "role": "Cozy Companion",
  "color": "#e2e5f4",
  "line": "Boo. I brought comfort food.",
  "bring": [
   "Warm soup",
   "Bread"
  ]
 },
 {
  "id": "duck",
  "emoji": "🐥",
  "name": "Captain Peep",
  "role": "Breakfast Buddy",
  "color": "#f5e7b5",
  "line": "Small peep. Big brunch energy.",
  "bring": [
   "Eggs",
   "Pancakes"
  ]
 },
 {
  "id": "koala",
  "emoji": "🐨",
  "name": "Cozy Koala",
  "role": "Chill Specialist",
  "color": "#d9e5e5",
  "line": "Maximum cozy. Minimum chaos.",
  "bring": [
   "Blankets",
   "Cushions"
  ]
 },
 {
  "id": "shiba",
  "emoji": "🐶",
  "name": "Party Pup",
  "role": "Welcome Committee",
  "color": "#f1d6ba",
  "line": "Good friends. Good snacks. Great zoomies.",
  "bring": [
   "Name tags",
   "Party hats"
  ]
 },
 {
  "id": "octopus",
  "emoji": "🐙",
  "name": "Lil Octo",
  "role": "Many-Handed Helper",
  "color": "#f2d4e0",
  "line": "Eight arms. Zero excuses.",
  "bring": [
   "Plates",
   "Napkins",
   "Cutlery"
  ]
 },
 {
  "id": "hedgehog",
  "emoji": "🦔",
  "name": "Pocket Hedgehog",
  "role": "Picnic Pal",
  "color": "#e7ddc7",
  "line": "A little prickly. Extremely prepared.",
  "bring": [
   "Picnic blanket",
   "Wet wipes"
  ]
 },
 {
  "id": "fairy",
  "emoji": "🧚",
  "name": "Petal Pixie",
  "role": "Garden Guardian",
  "color": "#e4eacb",
  "line": "I make ordinary tables bloom.",
  "bring": [
   "Flowers",
   "Table decorations"
  ]
 },
 {
  "id": "poop",
  "emoji": "💩",
  "name": "Holy Little Shit",
  "role": "Chaos Coordinator",
  "color": "#ead6bd",
  "line": "Cute little mess. Legendary good time.",
  "bring": [
   "Trash bags",
   "Cleanup supplies"
  ]
 }
];
export function validateHero(value){
 if(!value||!HEROES.some(h=>h.id===value.roleId))throw Error('Choose one of the party heroes.');
 if(!Array.isArray(value.bringing)||value.bringing.length<1||value.bringing.length>6)throw Error('Add 1–6 things you can bring.');
 const bringing=value.bringing.map(x=>{if(typeof x!=='string'||!x.trim()||x.trim().length>60||/[\r\n]/.test(x))throw Error('Keep each item to 1–60 characters.');return x.trim();});
 if(new Set(bringing.map(x=>x.toLowerCase())).size!==bringing.length)throw Error('List each item only once.');
 if(typeof value.quote!=='string'||!value.quote.trim()||value.quote.trim().length>140||/[\r\n]/.test(value.quote))throw Error('Add one great line, up to 140 characters.');
 const profile={roleId:value.roleId,bringing,quote:value.quote.trim()};
 if(value.avatarId!==undefined||value.heroName!==undefined){
  if(typeof value.avatarId!=='string'||!AVATAR_IDS.includes(value.avatarId))throw Error('Choose an avatar from the collection.');
  if(typeof value.heroName!=='string'||!value.heroName.trim()||[...value.heroName.trim()].length>32||/[\r\n\x00-\x1f\x7f]/.test(value.heroName))throw Error('Give your hero a name, up to 32 characters.');
  profile.avatarId=value.avatarId;profile.heroName=value.heroName.trim();
 }
 return profile;
}
