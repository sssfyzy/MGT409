import {money} from './event-core.js';
import {renderPartyHeroes} from './hero-ui.js?v=entry-flow-1';
import {validateHero} from './party-heroes.js?v=avatars-250';
import {GROUP_SPLIT_KEY,freshGroup,validateGroup,paidCents,calculateGroup} from './group-split.js?v=two-people-1';
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors=['#e3edbe','#f4dcbd','#d5e8ef','#eadcf1','#f4d5d0','#d5e8d6'];
let group=freshGroup(),result=null,storageWarning='';
function notice(text){$('#status').textContent=text;$('#status').className=text?'notice':'';}
try{const saved=localStorage.getItem(GROUP_SPLIT_KEY);if(saved)group=validateGroup(JSON.parse(saved));if(group.stage==='result')result=calculateGroup(group);}catch{group=freshGroup();notice('Saved test input could not be read. A fresh input form is shown.');}
function persist(){try{localStorage.setItem(GROUP_SPLIT_KEY,JSON.stringify(group));}catch{storageWarning='Browser storage is unavailable; this test lasts only while the page is open.';notice(storageWarning);}}
function avatar(p){const i=group.people.findIndex(x=>x.id===p.id);return '<span class="person-avatar" aria-hidden="true" style="--person-bg:'+colors[i%colors.length]+'">'+esc((p.name.trim()[0]||'?').toUpperCase())+'</span>';}
function updateProgress(){
 group.people.forEach(p=>{try{paidCents(p.amount);p.confirmed=true;}catch{p.confirmed=false;}});
 let problem='';try{validateGroup(group,{complete:true});}catch(error){problem=error.message;}const ready=!problem;
 $('#confirmation-count').textContent=group.people.length+' people · blank = $0';
 $('#confirmation-hint').textContent=ready?'Only enter what someone paid. Everyone else can stay blank ($0).':problem;
 $('#calculate').disabled=!ready;$('#add-person').disabled=group.people.length>=12;
}
function renderInputs(){
 updateProgress();
 $('#activity-title').value=group.title;
 $('#participant-inputs').innerHTML=group.people.map((p,i)=>'<article class="person-input '+(p.confirmed&&p.amount.trim()?'confirmed':'')+'" data-person="'+p.id+'">'+
 '<div class="person-header">'+avatar(p)+'<div class="person-name"><label for="name-'+p.id+'">PARTICIPANT '+(i+1)+'</label><input id="name-'+p.id+'" data-name="'+p.id+'" aria-label="Participant '+(i+1)+' name" maxlength="40" value="'+esc(p.name)+'"></div>'+(group.people.length>2?'<button class="remove-person" type="button" data-remove="'+p.id+'" aria-label="Remove '+esc(p.name)+'">Remove</button>':'')+'</div>'+
 '<label class="paid-label" for="paid-'+p.id+'">Paid upfront for this activity</label><div class="paid-input"><span aria-hidden="true">$</span><input id="paid-'+p.id+'" data-amount="'+p.id+'" aria-label="'+esc(p.name)+' paid upfront in USD" inputmode="decimal" autocomplete="off" maxlength="12" placeholder="0.00" value="'+esc(p.amount)+'"></div><div class="person-bottom"><span id="state-'+p.id+'">'+(p.amount.trim()?(p.confirmed?'Amount entered ✓':'Check this amount'):'Nothing entered · counts as $0')+'</span></div><p class="person-error" id="error-'+p.id+'" role="alert"></p></article>').join('');
 document.querySelectorAll('[data-name]').forEach(input=>input.oninput=()=>{const p=group.people.find(p=>p.id===input.dataset.name);p.name=input.value;invalidate(p);$('#paid-'+p.id).setAttribute('aria-label',(p.name.trim()||'Participant')+' paid upfront in USD');});
 document.querySelectorAll('[data-amount]').forEach(input=>input.oninput=()=>{const p=group.people.find(p=>p.id===input.dataset.amount);p.amount=input.value;invalidate(p);});
 document.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{group.people=group.people.filter(p=>p.id!==button.dataset.remove);group.people.forEach(p=>p.confirmed=false);persist();renderInputs();});
 updateProgress();
}
function invalidate(p){p.confirmed=false;group.stage='input';result=null;const card=document.querySelector('[data-person="'+p.id+'"]');$('#error-'+p.id).textContent='';try{paidCents(p.amount);p.confirmed=true;}catch(error){if(p.amount.trim())$('#error-'+p.id).textContent=error.message;}card.classList.toggle('confirmed',p.confirmed&&!!p.amount.trim());card.querySelector('.person-avatar').textContent=(p.name.trim()[0]||'?').toUpperCase();$('#state-'+p.id).textContent=p.amount.trim()?(p.confirmed?'Amount entered ✓':'Check this amount'):'Nothing entered · counts as $0';persist();updateProgress();}
function instruction(t){const from=result.people.find(p=>p.id===t.fromId),to=result.people.find(p=>p.id===t.toId);return from.name+' → '+to.name+': '+money(t.amountCents)+' USD via Zelle. Memo: '+result.title+'. Confirm '+to.name+'’s registered Zelle email/phone directly before sending.';}
async function copy(text){try{await navigator.clipboard.writeText(text);notice('Instructions copied. No money or message was sent.');}catch{notice('Clipboard is unavailable. Select and copy the visible instructions instead.');}}
function renderResults(){
 $('#result-event').textContent=result.title+' · '+result.people.length+' participants · equal split';
 const min=Math.min(...result.people.map(p=>p.share)),max=Math.max(...result.people.map(p=>p.share));
 $('#result-summary').innerHTML='<div><span>ACTUAL GROUP COST</span><strong>'+money(result.total)+'</strong></div><div><span>EACH PERSON’S SHARE</span><strong>'+money(min)+'</strong>'+(min!==max?'<small>Some pay '+money(max)+' · rounding only</small>':'')+'</div><div><span>TRANSFERS TO FINISH</span><strong>'+result.transfers.length+'</strong><small>Minimum possible</small></div>';
 $('#transfer-plan').innerHTML=result.transfers.length?result.transfers.map((t,i)=>{const from=result.people.find(p=>p.id===t.fromId),to=result.people.find(p=>p.id===t.toId);return '<article class="transfer-card"><div class="transfer-top"><p>TRANSFER '+(i+1)+' OF '+result.transfers.length+'</p><span class="transfer-method">Zelle · outside HolySplit</span></div><div class="transfer-route"><div class="transfer-person">'+avatar(from)+'<div><small>WHO PAYS</small><strong>'+esc(from.name)+'</strong></div></div><div class="transfer-money"><strong>'+money(t.amountCents)+'</strong><span aria-hidden="true">⟶</span></div><div class="transfer-person">'+avatar(to)+'<div><small>WHO RECEIVES</small><strong>'+esc(to.name)+'</strong></div></div></div><div class="transfer-instruction"><p>'+esc(from.name)+' sends '+money(t.amountCents)+' directly to '+esc(to.name)+'.<br>No middleman. No forwarding money.</p><button class="button quiet" data-copy="'+i+'">Copy this instruction</button></div></article>';}).join(''):'<div class="all-even"><h2>Already even. No transfers.</h2><p>'+(result.total?'Everyone has already paid their fair share.':'No spending was entered, so there is nothing to repay.')+'</p></div>';
 $('#method-note').innerHTML='<strong>'+(result.transfers.length?'Fewest transfers. No round trips.':'No extra steps needed.')+'</strong><p>We offset what everyone paid against their equal share, then find a plan with the minimum number of transfers. All transfers go directly from someone who owes to someone who is owed. They can happen in parallel.</p><p>“Most efficient” here means fewest transfers, not a guarantee about bank fees or settlement speed. Exact calculation supports 2–12 people. Any leftover pennies follow the participant order.</p>';
 $('#person-breakdown').innerHTML=result.people.map(p=>'<article class="balance-person"><strong>'+esc(p.name)+'</strong><p>Paid upfront '+money(p.paid)+'</p><p>Fair share '+money(p.share)+'</p><strong>'+(p.net>0?'Receives '+money(p.net):p.net<0?'Sends '+money(-p.net):'Already even')+'</strong></article>').join('');
 document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copy(instruction(result.transfers[Number(b.dataset.copy)])));
}
function showStage(){
 const showing=group.stage==='result'&&result;
 $('#input-scene').hidden=!!showing;$('#result-scene').hidden=!showing;
 $('#input-step').removeAttribute('aria-current');$('#result-step').removeAttribute('aria-current');$(showing?'#result-step':'#input-step').setAttribute('aria-current','step');
 if(showing)renderResults();else renderInputs();
}
$('#activity-title').oninput=e=>{group.title=e.target.value;persist();updateProgress();};
$('#add-person').onclick=()=>{if(group.people.length>=12)return;let n=group.people.length+1;while(group.people.some(p=>p.name.toLowerCase()==='friend '+n))n++;group.people.push({id:crypto.randomUUID(),name:'Friend '+n,amount:'',confirmed:false});persist();renderInputs();};
$('#example').onclick=()=>{group=freshGroup();group.people.forEach((p,i)=>{p.amount=['60',''][i];p.confirmed=true;});result=null;persist();renderInputs();notice('Example filled: Alex paid $60; Jamie is blank ($0). One click to calculate.');};
$('#group-form').onsubmit=e=>{e.preventDefault();try{result=calculateGroup(group);group=validateGroup({...group,stage:'result'},{complete:true});persist();showStage();$('#result-title').focus();notice(storageWarning);}catch(error){notice(error.message);}};
$('#back-input').onclick=()=>{group.stage='input';result=null;persist();showStage();$('#activity-title').focus();notice('Edit anyone’s spending, then calculate again. Your numbers stay on this device.');};
$('#copy-plan').onclick=()=>copy([result.title+' · USD', 'Group cost '+money(result.total)+'; split equally among '+result.people.length+' people.',...result.transfers.map(instruction),result.transfers.length?'Minimum transfers: '+result.transfers.length+'.':'No transfers needed.','HolySplit calculates only. Verify recipients and complete transfers outside HolySplit.'].join('\n'));
renderInputs();
let previousSplit=null;try{const raw=localStorage.getItem(GROUP_SPLIT_KEY+'-previous');if(raw)previousSplit=validateGroup(JSON.parse(raw));}catch{}
$('#restore-split').hidden=!previousSplit;
$('#new-split').onclick=()=>{previousSplit=structuredClone(group);try{localStorage.setItem(GROUP_SPLIT_KEY+'-previous',JSON.stringify(previousSplit));}catch{}group=freshGroup();result=null;persist();showStage();$('#restore-split').hidden=false;notice('New two-person split. Your previous split is kept; use Restore previous split to go back.'+(storageWarning?' '+storageWarning:''));};
$('#restore-split').onclick=()=>{if(!previousSplit)return;group=structuredClone(previousSplit);result=null;if(group.stage==='result'){try{result=calculateGroup(group);}catch{group.stage='input';}}persist();showStage();notice('Previous split restored.'+(storageWarning?' '+storageWarning:''));};
const HERO_PREVIEW_KEY='holysplit-hero-preview-v1';
let localHero=null;try{const raw=localStorage.getItem(HERO_PREVIEW_KEY);if(raw)localHero=validateHero(JSON.parse(raw));}catch{}
function showOffline(){
 $('#hero-preview-scene').hidden=true;
 $('.split-tools').hidden=false;$('.demo-disclaimer').hidden=false;$('footer').hidden=false;$('#invite-friends').hidden=false;
 showStage();
}
function openHeroPreview(){
 $('#input-scene').hidden=true;$('#result-scene').hidden=true;$('#hero-preview-scene').hidden=false;$('.split-tools').hidden=true;
 renderPartyHeroes({title:'your party',people:[{id:'local-you',name:'You'}],_personId:'local-you',_heroes:localHero?{'local-you':localHero}:{}},{container:$('#hero-preview-content'),preview:true,notice,guard:fn=>async e=>{try{await fn(e);}catch(error){notice(error.message);}},save:async profile=>{try{localStorage.setItem(HERO_PREVIEW_KEY,JSON.stringify(profile));}catch{throw Error('Storage is unavailable. Your hero could not be saved on this device.');}localHero=profile;openHeroPreview();}});
 notice('Just a playground — no account or shared activity needed.');
}
$('#invite-friends').onclick=openHeroPreview;
$('#back-to-split').onclick=()=>{showOffline();notice('Back to Split Plan. Your amounts are unchanged.');};
if(location.protocol==='file:'){$('#download-offline').hidden=true;$('#offline-state').textContent='Standalone offline app · no network needed';$('#continue-invite').href='https://holysplit.yvetteh9b.chatgpt.site/signin-with-chatgpt?return_to=%2Forganize';}
showOffline();


