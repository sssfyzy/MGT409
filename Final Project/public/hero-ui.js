import {HEROES,validateHero} from './party-heroes.js?v=avatars-250';
import {AVATARS,ALL_AVATARS,AVATAR_MOODS} from './hero-avatars.js?v=avatars-250';
import {AVATAR_IMAGES} from './avatar-images.js?v=avatars-250';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const portrait=a=>AVATAR_IMAGES[a.imageId||a.id]?'<img src="'+AVATAR_IMAGES[a.imageId||a.id]+'" alt="" width="160" height="160" decoding="async" draggable="false">':a.emoji;
export function renderPartyHeroes(event,{save,notice,guard,container=document.querySelector('#tab-content'),preview=false}){
 const content=container,$=s=>content.querySelector(s),mine=event._heroes?.[event._personId],myName=event.people.find(p=>p.id===event._personId)?.name||'You';
 const cards=event.people.map(p=>{
  const profile=event._heroes?.[p.id],avatar=profile&&ALL_AVATARS.find(a=>a.id===(profile.avatarId||profile.roleId));
  return avatar?'<article class="crew-hero" style="--hero-color:'+avatar.color+'"><span class="crew-emoji" aria-hidden="true">'+portrait(avatar)+'</span><small>'+esc(p.name)+' · PARTY HERO</small><strong>'+esc(profile.heroName||avatar.name)+'</strong><div class="hero-items">'+profile.bringing.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div><blockquote>“'+esc(profile.quote)+'”</blockquote></article>':'';
 }).join('');
 content.innerHTML='<section class="hero-scene"><p class="eyebrow">'+(preview?'PLAYGROUND · NO SIGN-UP NEEDED':'EVERY CREW NEEDS A LITTLE LEGEND.')+'</p><h2>Choose your hero.</h2><p class="hero-intro">'+AVATARS.length+' emoji avatars. Animals, meme faces, snack squad, party chaos, and sky &amp; weather. Pick your energy.</p><div class="avatar-moods" role="group" aria-label="Avatar category"><button type="button" data-mood="all" aria-pressed="true">All '+AVATARS.length+'</button>'+AVATAR_MOODS.map(m=>'<button type="button" data-mood="'+m.id+'" aria-pressed="false">'+m.label+' <small>'+m.count+'</small></button>').join('')+'</div><div class="hero-roster avatar-collection" aria-label="Choose an avatar">'+AVATARS.map(a=>'<button type="button" class="hero-choice" aria-label="'+esc(a.name)+'" data-hero="'+a.id+'" aria-pressed="'+((mine?.avatarId||mine?.roleId)===a.id)+'" style="--hero-color:'+a.color+'"><span aria-hidden="true">'+portrait(a)+'</span></button>').join('')+'</div><form id="hero-form" hidden><div class="my-hero-card"><div class="hero-card-heading"><span id="my-hero-emoji" aria-hidden="true"></span><div><small>'+esc(myName)+' · YOUR HERO</small><h3 id="my-hero-name"></h3></div></div><label>Name your hero<input id="hero-name" maxlength="64" placeholder="Your own legendary name" required autocomplete="off"><small>Up to 32 characters. A nickname, not your payment identity.</small></label><label>What can you bring?<input id="hero-bringing" maxlength="365" placeholder="Drinks, ice, cups…" required><small>Separate items with commas. Up to 6 items. Change these however you like.</small></label><label>Your legendary one-liner<input id="hero-quote" maxlength="140" required></label><div class="actions"><button class="button primary" id="save-hero">That’s my hero ✦</button><button class="text-button" id="cancel-hero" type="button">Change avatar ↑</button></div><p class="fine">'+(preview?'Local preview only · saved on this device, not to an online activity.':'Shared with this activity only. Only you can edit your card.')+' This is an offer to bring things, not an expense or payment.</p></div></form><section class="crew-section"><h3>'+(preview?'Your hero preview':'Your party lineup')+'</h3><div class="crew-grid">'+(cards||'<p class="fine">Your little legend will appear here.</p>')+'</div></section><p class="avatar-credit"><a href="https://github.com/microsoft/fluentui-emoji" target="_blank" rel="noopener noreferrer">Artwork: Microsoft Fluent Emoji · MIT license</a></p></section>';
 let selected=null;
 content.querySelectorAll('[data-mood]').forEach(button=>button.onclick=()=>{
  const mood=button.dataset.mood;
  content.querySelectorAll('[data-mood]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  content.querySelectorAll('[data-hero]').forEach(b=>{b.hidden=mood!=='all'&&AVATARS.find(a=>a.id===b.dataset.hero).category!==mood;});
  $('.hero-roster').scrollTop=0;
 });
 function choose(id,{scroll=true}={}){
  const avatar=AVATARS.find(a=>a.id===id),preset=HEROES.find(h=>h.id===avatar.roleId);
  const previous=selected,hadDraft=!!previous;
  const draftedName=hadDraft?$('#hero-name').value:null;
  selected=avatar;
  content.querySelectorAll('[data-hero]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.hero===id)));
  $('#hero-form').hidden=false;$('.my-hero-card').style.setProperty('--hero-color',avatar.color);
  $('#my-hero-emoji').innerHTML=portrait(avatar);
  $('#hero-name').value=hadDraft?(draftedName===previous.name?avatar.name:draftedName):(mine?.heroName||avatar.name);
  $('#my-hero-name').textContent=$('#hero-name').value||'Your little legend';
  if(!hadDraft){$('#hero-bringing').value=(mine?.bringing||preset.bring).join(', ');$('#hero-quote').value=mine?.quote||preset.line;}
  if(scroll)$('#hero-form').scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 content.querySelectorAll('[data-hero]').forEach(b=>b.onclick=()=>choose(b.dataset.hero));
 $('#hero-name').oninput=()=>{$('#my-hero-name').textContent=$('#hero-name').value||'Your little legend';};
 $('#cancel-hero').onclick=()=>{$('#hero-form').hidden=true;$('.hero-roster').scrollIntoView({behavior:'smooth',block:'nearest'});};
 if(!preview&&!mine){try{const entryAvatar=localStorage.getItem('holysplit-entry-avatar-v1');if(AVATARS.some(a=>a.id===entryAvatar))choose(entryAvatar,{scroll:false});}catch{}}
 $('#hero-form').onsubmit=guard(async e=>{
  e.preventDefault();
  const profile=validateHero({roleId:selected?.roleId,avatarId:selected?.id,heroName:$('#hero-name').value,bringing:$('#hero-bringing').value.split(',').map(x=>x.trim()).filter(Boolean),quote:$('#hero-quote').value});
  const button=$('#save-hero');button.disabled=true;
  try{await save(profile);notice(preview?'Hero saved on this device. No registration, invitations, or payments.':'Your hero joined the party lineup. No messages or payments were sent.');content.querySelector('.crew-section')?.scrollIntoView({behavior:'smooth',block:'nearest'});}
  finally{if(button.isConnected)button.disabled=false;}
 });
}
