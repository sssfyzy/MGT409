import {normalizeEvent,validateExpense,validateTransfer,balances,settlements} from '../../public/event-core.js';
import {calendarSignature,calendarRequest,personalSettlementMessage} from '../../public/event-workflow.js';
import {fail,identity,sameOrigin,jsonBody,hash,random,publicError} from './security.mjs';
import {shareInvite,joinViaLink,decideJoin,joinAsGuest} from './group-invites.mjs';
import {validateHero} from '../../public/party-heroes.js';
import {budgetItem,budgetLedger,budgetSplit,budgetCents} from './budget.mjs';
import {suggestBudget,starterBudget} from './budget-suggest.mjs';
import {answerHelp} from './help-agent.mjs';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
function stamp(row,action,detail){row.event.audit.push({at:new Date().toISOString(),action,detail});row.event.audit=row.event.audit.slice(-200);}
export function participant(row,members,user,emails){if(row.owner===user.id)return {role:'organizer',personId:members.find(m=>m.user_id===user.id)?.person_id};const member=members.find(m=>m.user_id===user.id)||members.find(m=>!m.user_id&&emails.includes(m.email));if(!member)fail(403,'This event is only available to its invited members.');return {role:'participant',personId:member.person_id};}
function dto(row,actor){const e=structuredClone(row.event);if(actor.role!=='organizer'&&e.workflow){e.workflow.contacts=e.workflow.contacts.filter(c=>c.personId===actor.personId);e.workflow.organizerEmail='';}return {...e,_cloud:true,_role:actor.role,_personId:actor.personId,_version:row.version,_rsvps:row.rsvps,_calendarId:row.calendarId,_calendarCurrent:row.calendarSnapshot===calendarSignature(row.event),_closed:row.closed,_sending:row.sending||null,_plannedHeadcount:row.plannedHeadcount||row.event.people.length,_budgetItems:row.budgetItems||[],_split:budgetSplit(row),_guests:actor.role==='organizer'?Object.entries(row.groupGuests||{}).filter(([,v])=>!v.removed).map(([personId,v])=>({personId,joined:v.joined})):undefined,_removedGuests:actor.role==='organizer'?Object.entries(row.groupGuests||{}).filter(([,v])=>v.removed).map(([personId])=>personId):undefined,_heroes:Object.fromEntries(Object.entries(row.heroes||{}).filter(([id])=>e.people.some(p=>p.id===id)))};}
function requireOwner(actor){if(actor.role!=='organizer')fail(403,'Only the organizer can do this.');}
async function save(repo,row,expected){if(!await repo.save(row,expected))fail(409,'Someone updated this event. Refresh before trying again.');return repo.get(row.id);}
function version(body,row){if(body.version!==row.version)fail(409,'This event changed. Refresh before applying this action.');}
function graphCalendar(e,transactionId){const p=calendarRequest(e),map={'America/New_York':'Eastern Standard Time','America/Chicago':'Central Standard Time','America/Denver':'Mountain Standard Time','America/Los_Angeles':'Pacific Standard Time','UTC':'UTC'};if(!map[p.start.timeZone])fail(400,'Choose a supported Outlook time zone.');p.start.timeZone=map[p.start.timeZone];p.end.timeZone=map[p.end.timeZone];p.transactionId=transactionId;return p;}
export function createService({repo,outlook,environment={}}){return async function handle(request){try{
 const url=new URL(request.url),path=url.pathname;
 if(request.method==='POST')sameOrigin(request);
 if(path==='/api/group/guest-join'&&request.method==='POST')return json(await joinAsGuest(repo,request),201);
 const guestToken=request.headers.get('x-holysplit-guest');
 const signedIn=request.headers.get('oai-authenticated-user-id')&&request.headers.get('oai-authenticated-user-email')?identity(request):null;
 let user=signedIn;
 if(guestToken){
  const guest=/^[a-zA-Z0-9_-]{43}$/.test(guestToken)?await repo.record('guest:'+await hash(guestToken)):null;
  const guestEvent=guest?.eventId&&signedIn?await repo.get(guest.eventId):null;
  if(signedIn&&guestEvent?.owner===signedIn.id)user=signedIn;
  else if(guest?.userId?.startsWith('guest:'))user={id:guest.userId,email:'',guest:true,eventId:guest.eventId};
  else if(!signedIn)fail(401,'This browser’s guest access has ended. Ask the organizer for a new invitation.');
 }
 if(!user)user=identity(request);
 if(user.guest&&(!path.startsWith('/api/group/')||path==='/api/group/join'))fail(403,'Guest access is for this activity only.');
 const status=user.guest?{connected:false,email:null,missing:[]}:await outlook.status(user.id),emails=user.guest?[]:[user.email,...(status.email?[status.email]:[])];
 if(path==='/api/group/status'&&request.method==='GET')return json({user:{email:user.email,guest:!!user.guest},outlook:status,storage:'shared',signOutPath:user.guest?null:'/signout-with-chatgpt?return_to=%2F'});
 if(path==='/api/outlook/callback'&&request.method==='GET'){const target=await outlook.callback(user,url,request.headers.get('cookie')||'');return new Response(null,{status:303,headers:{Location:target,'Cache-Control':'no-store','Set-Cookie':'hs_outlook_state=; Path=/api/outlook; HttpOnly; SameSite=Lax; Max-Age=0'}});}
 if(path==='/api/outlook/connect'&&request.method==='POST'){const result=await outlook.begin(user);return new Response(JSON.stringify({authorizationUrl:result.url}),{status:200,headers:{...headers,'Set-Cookie':result.cookie}});}
 if(path==='/api/group/join'&&request.method==='POST')return json(await joinViaLink(repo,request,user,emails));
 if(path==='/api/outlook/disconnect'&&request.method==='POST'){await repo.remove('outlook:'+user.id);return json({disconnected:true});}
 if(path==='/api/group/events'&&request.method==='GET'){const rows=await repo.list(user,emails),events=[];for(const row of rows){const actor=participant(row,await repo.members(row.id),user,emails);events.push(dto(row,actor));}return json({events});}
 if(path==='/api/group/events'&&request.method==='POST'){
  if(user.guest)fail(403,'Only a signed-in organizer can create an activity.');
  const body=await jsonBody(request),e=normalizeEvent(body.event);if(!e.workflow)fail(400,'Shared events need an organizer and event details.');if(e.expenses.length||e.transfers.length)fail(400,'Create an empty shared event before submitting expenses.');if(!emails.includes(e.workflow.organizerEmail))fail(403,'Use your verified sign-in email as organizer, or connect that Outlook address first.');const mine=e.workflow.contacts.find(c=>c.email===e.workflow.organizerEmail);if(!mine)fail(400,'Include the organizer in the invitee list.');const headcount=body.plannedHeadcount??e.people.length;if(!Number.isInteger(headcount)||headcount<1||headcount>20)fail(400,'Expected attendance must be 1–20.');e.id=random();e.sample=false;e.workflow.reviewedSignature=calendarSignature(e);e.activities.forEach(a=>a.attendees=[mine.personId]);const row=await repo.create(e,user,mine.personId,headcount);return json({event:dto(row,{role:'organizer',personId:mine.personId})},201);
 }
 const match=path.match(/^\/api\/group\/events\/([a-zA-Z0-9_-]{1,80})(?:\/([a-z-]+))?$/);if(!match)fail(404,'Unknown HolySplit endpoint.');const row=await repo.get(match[1]);if(!row)fail(404,'Event not found.');if(user.guest&&user.eventId!==row.id)fail(403,'This browser can only access its invited activity.');const actor=participant(row,await repo.members(row.id),user,emails),action=match[2]||'';
 if(request.method==='GET'&&!action)return json({event:dto(row,actor)});
  if(request.method==='POST'&&action==='help'){
   const body=await jsonBody(request);
   const day=new Date().toISOString().slice(0,10),quotaKey='help:'+row.id+':'+user.id+':'+day;
   const used=(await repo.record(quotaKey))?.count||0;
   if(used>=20)fail(429,'This activity has reached today’s 20 help questions for this browser. Please try again tomorrow.');
   await repo.put(quotaKey,{count:used+1},Date.now()+86400000);
   return json(await answerHelp({message:body.message,view:body.view,row,personId:actor.personId,environment}));
  }
 if(request.method==='GET'&&action==='join-requests'){requireOwner(actor);return json({requests:(row.joinRequests||[]).filter(r=>r.state==='pending').map(({id,name,email,created})=>({id,name,email,created}))});}
 if(request.method==='GET'&&action==='operations'){requireOwner(actor);return json({operations:await repo.operations(row.id)});}
 if(request.method!=='POST')fail(405,'Method not allowed.');if(['share-invite','join-decision','revoke-invite','remove-guest','delete-guest','event-info','settings','close','reopen','invitations','calendar-sync','notification-preview','notifications','recover-send'].includes(action))requireOwner(actor);const body=await jsonBody(request);version(body,row);
 if(row.sending&&action!=='recover-send')fail(409,'Settlement email requests are in progress. Refresh before changing this event.');
 if(actor.role==='participant'&&!await repo.claim(row.id,actor.personId,user.id))fail(403,'This invitation is already bound to another account.');
 if(action==='share-invite'){requireOwner(actor);const result=await shareInvite(repo,row,body.version,url.origin);return json({event:dto(result.row,actor),invitation:result.invitation});}
 if(action==='revoke-invite'){if(!row.groupInvite)fail(409,'There is no active link to revoke.');const digest=row.groupInvite.digest;row.groupInvite=null;stamp(row,'Invitation link revoked','Existing guests keep access; the old link can no longer admit anyone.');const updated=await save(repo,row,body.version);await repo.remove('group-invite:'+digest);return json({event:dto(updated,actor)});}
 if(action==='remove-guest'){const personId=String(body.personId||''),guest=row.groupGuests?.[personId];if(!guest||guest.removed)fail(404,'Guest not found.');guest.removed=true;row.rsvps[personId]='declined';for(const activity of row.event.activities)activity.attendees=activity.attendees.filter(id=>id!==personId);stamp(row,'Guest access removed',row.event.people.find(p=>p.id===personId)?.name+' can no longer access this event. Existing bills remain.');if(!await repo.removeGuest(row,body.version,personId,guest.digest))fail(409,'This event changed. Refresh first.');return json({event:dto(await repo.get(row.id),actor)});}
 if(action==='delete-guest'){
  const personId=String(body.personId||''),guest=row.groupGuests?.[personId];
  if(!guest||!guest.removed)fail(409,'Remove this guest’s access before deleting them from the crew.');
  if(row.event.expenses.some(e=>e.payerId===personId||e.shares.some(s=>s.personId===personId))||row.event.transfers.some(t=>t.fromId===personId||t.toId===personId)||(row.budgetItems||[]).some(i=>i.claimantId===personId&&i.actualCents>0))fail(409,'This guest has recorded financial activity. Keep their history, or clear those amounts before deleting them.');
  if((await repo.members(row.id)).some(m=>m.person_id===personId))fail(409,'This guest still has active access. Remove access first.');
  row.event.people=row.event.people.filter(p=>p.id!==personId);
  row.event.workflow.contacts=row.event.workflow.contacts.filter(c=>c.personId!==personId);
  for(const activity of row.event.activities)activity.attendees=activity.attendees.filter(id=>id!==personId);
  for(const item of row.budgetItems||[])if(item.claimantId===personId){item.claimantId=null;item.actualNote='';}
  delete row.rsvps[personId];delete row.heroes?.[personId];delete row.groupGuests[personId];
  stamp(row,'Removed guest deleted','A removed guest profile was deleted from the crew. No financial records were changed.');
  try{row.event=normalizeEvent(row.event);}catch(error){fail(409,'This guest cannot be deleted until the event data is reconciled.');}
  return json({event:dto(await save(repo,row,body.version),actor)});
 }
 if(action==='join-decision'){requireOwner(actor);const updated=await decideJoin(repo,row,body);return json({event:dto(updated,actor)});}
 if(action==='guest-name'){const name=String(body.name||'').trim();if(!name||name.length>40||/[\r\n]/.test(name)||row.event.people.some(p=>p.id!==actor.personId&&p.name.toLowerCase()===name.toLowerCase()))fail(400,'Choose a unique name up to 40 characters.');row.event.people.find(p=>p.id===actor.personId).name=name;stamp(row,'Hero name updated','A participant updated their own display name.');return json({event:dto(await save(repo,row,body.version),actor)});}
 if(action==='hero'){if(body.personId&&body.personId!==actor.personId)fail(403,'Choose only your own hero.');let profile;try{profile=validateHero(body.profile);}catch(error){fail(400,error.message);}row.heroes={...(row.heroes||{}),[actor.personId]:profile};stamp(row,'Hero card updated',row.event.people.find(p=>p.id===actor.personId).name+' updated their own party role.');return json({event:dto(await save(repo,row,body.version),actor)});}
 if(action==='event-info'){
  const next=structuredClone(row.event);next.title=body.title;next.date=body.date;next.workflow.startTime=body.startTime;next.workflow.endTime=body.endTime;next.workflow.location=body.location;
  try{row.event=normalizeEvent(next);}catch(error){fail(400,error.message);}
  if(!Number.isInteger(body.plannedHeadcount)||body.plannedHeadcount<1||body.plannedHeadcount>20)fail(400,'Expected attendance must be 1–20.');
  if(row.calendarId&&calendarSignature(row.event)!==row.calendarSnapshot)fail(409,'The Outlook event has already been sent; rescheduling is not supported.');
  row.plannedHeadcount=body.plannedHeadcount;stamp(row,'Event details updated','Organizer updated schedule, place or expected attendance.');return json({event:dto(await save(repo,row,body.version),actor)});
 }
 if(action==='budget-suggest'){
  if(actor.role==='organizer'&&environment.OPENAI_API_KEY&&environment.OPENAI_MODEL){if((row.aiDraftsUsed||0)>=5)fail(429,'This activity has used its five AI drafts. Edit the table or upload a spreadsheet instead.');row.aiDraftsUsed=(row.aiDraftsUsed||0)+1;const updated=await save(repo,row,body.version);return json({event:dto(updated,actor),suggestion:await suggestBudget(updated.event,updated.plannedHeadcount,environment)});}
  const suggestion=actor.role==='organizer'?await suggestBudget(row.event,row.plannedHeadcount,environment):{source:'starter',message:'Here is a starter list. The organizer can use the AI draft; everyone can edit the shared table.',items:starterBudget(row.event,row.plannedHeadcount)};
  return json({suggestion});
 }
 if(action==='budget-import'){
  if(row.closed)fail(409,'Expense collection is closed.');
  if(!Array.isArray(body.items)||!body.items.length||body.items.length>50)fail(400,'Import 1–50 budget rows at a time.');
  row.budgetItems=[...(row.budgetItems||[])];let imported=0,skipped=0;
  for(const raw of body.items){const input=budgetItem(raw),key=(input.category+'|'+input.name).toLowerCase();if(row.budgetItems.some(i=>(i.category+'|'+i.name).toLowerCase()===key)){skipped++;continue;}if(row.budgetItems.length>=100)fail(409,'This activity already has 100 budget rows.');row.budgetItems.push({id:random(),...input,claimantId:null,actualCents:0,actualNote:''});imported++;}
  if(!imported)return json({event:dto(row,actor),imported,skipped});
  stamp(row,'Budget rows imported',`${row.event.people.find(p=>p.id===actor.personId).name} added ${imported} preparation rows.`);
  return json({event:dto(await save(repo,row,body.version),actor),imported,skipped});
 }
 if(action==='budget-item'){
  if(row.closed)fail(409,'Expense collection is closed.');
  row.budgetItems=[...(row.budgetItems||[])];const item=row.budgetItems.find(i=>i.id===body.id);
  if(body.operation==='delete'){requireOwner(actor);if(!item)fail(404,'Budget item not found.');if(item.claimantId||item.actualCents)fail(409,'Release the claim and clear the actual amount before deleting this item.');row.budgetItems=row.budgetItems.filter(i=>i.id!==item.id);}
  else if(body.operation==='save'){const input=budgetItem(body);if(item)Object.assign(item,input);else{if(row.budgetItems.length>=100)fail(409,'This activity already has 100 budget rows.');row.budgetItems.push({id:random(),...input,claimantId:null,actualCents:0,actualNote:''});}}
  else fail(400,'Choose save or delete.');
  stamp(row,'Budget updated',row.event.people.find(p=>p.id===actor.personId).name+' changed the preparation list.');return json({event:dto(await save(repo,row,body.version),actor)});
 }
 if(action==='budget-claim'){
  const item=(row.budgetItems||[]).find(i=>i.id===body.id);if(!item)fail(404,'Budget item not found.');if(body.claim===true){if(item.claimantId&&item.claimantId!==actor.personId)fail(409,'Someone else already claimed this item.');item.claimantId=actor.personId;}
  else if(body.claim===false){if(item.claimantId!==actor.personId)fail(403,'Only the person who claimed this item can release it.');if(item.actualCents)fail(409,'Clear your actual amount before releasing this item.');item.claimantId=null;}
  else fail(400,'Choose claim or release.');stamp(row,'Contribution updated',row.event.people.find(p=>p.id===actor.personId).name+' changed a preparation claim.');return json({event:dto(await save(repo,row,body.version),actor)});
 }
 if(action==='budget-actual'){
  if(row.closed)fail(409,'The organizer has closed expense collection.');const item=(row.budgetItems||[]).find(i=>i.id===body.id);if(!item)fail(404,'Budget item not found.');if(item.claimantId!==actor.personId)fail(403,'Only the person who claimed this item can record its actual cost.');item.actualCents=budgetCents(body.actualCents,'actual amount');item.actualNote=String(body.actualNote??'').trim().slice(0,200);stamp(row,'Actual cost updated',row.event.people.find(p=>p.id===actor.personId).name+' recorded an actual cost.');return json({event:dto(await save(repo,row,body.version),actor)});
 }
 if(action==='settings'){
  requireOwner(actor);const next=normalizeEvent(body.event);if(JSON.stringify(next.people)!==JSON.stringify(row.event.people)||JSON.stringify(next.workflow.contacts)!==JSON.stringify(row.event.workflow.contacts)||next.workflow.organizerEmail!==row.event.workflow.organizerEmail)fail(400,'Invitee membership cannot be replaced through event settings.');if(row.calendarId&&calendarSignature(next)!==calendarSignature(row.event))fail(409,'Calendar rescheduling is not supported in this first version. Create a new event rather than changing a sent invitation.');row.event={...next,id:row.id,expenses:row.event.expenses,transfers:row.event.transfers,audit:row.event.audit};stamp(row,'Settings updated','Organizer updated the event.');const updated=await save(repo,row,body.version);return json({event:dto(updated,actor)});
 }
 if(action==='rsvp'){
  if(!['accepted','declined','tentative'].includes(body.response))fail(400,'Choose yes, no or maybe.');row.rsvps[actor.personId]=body.response;for(const a of row.event.activities){a.attendees=a.attendees.filter(id=>id!==actor.personId);if(body.response==='accepted')a.attendees.push(actor.personId);}stamp(row,'Attendance response',row.event.people.find(p=>p.id===actor.personId).name+': '+body.response+' (HolySplit response)');return json({event:dto(await save(repo,row,body.version),actor)});
 }
 if(action==='expenses'){
  if(row.closed)fail(409,'The organizer has closed expense collection. Ask them to reopen it.');if(row.event.expenses.length>=200)fail(400,'This event has reached its bill limit.');if(typeof body.expense?.id!=='string'||body.expense.id.length>80)fail(400,'Missing bill submission ID.');const expense=validateExpense({...body.expense,id:await hash(user.id+':expense:'+body.expense.id)},row.event);if(expense.payerId!==actor.personId)fail(403,'Submit only bills you personally paid.');const previous=row.event.expenses.find(e=>e.id===expense.id);if(previous){if(JSON.stringify({...previous,createdAt:''})!==JSON.stringify({...expense,createdAt:''}))fail(409,'This bill submission ID was already used for different details.');return json({event:dto(row,actor),alreadyRecorded:true});}row.event.expenses.push(expense);stamp(row,'Expense submitted',row.event.people.find(p=>p.id===actor.personId).name+': '+expense.label);return json({event:dto(await save(repo,row,body.version),actor)},201);
 }
 if(action==='reimbursements'){
  let t;try{t=validateTransfer({...body.transfer,id:random()},budgetLedger(row)||row.event);}catch(error){fail(409,error.message||'The suggested split changed. Refresh before marking a transfer sent.');}if(![t.fromId,t.toId].includes(actor.personId))fail(403,'Only the payer or recipient can record this external reimbursement.');row.event.transfers.push(t);stamp(row,'External reimbursement recorded','Self-reported by '+row.event.people.find(p=>p.id===actor.personId).name+'; not bank-verified.');return json({event:dto(await save(repo,row,body.version),actor)});
 }
 if(action==='close'||action==='reopen'){requireOwner(actor);row.closed=action==='close';stamp(row,row.closed?'Expenses closed':'Expenses reopened','Organizer action.');return json({event:dto(await save(repo,row,body.version),actor)});}
 if(action==='invitations'){
  requireOwner(actor);if(body.confirmed!==true)fail(400,'Review and confirm the invitation first.');if(body.signature!==calendarSignature(row.event))fail(409,'Calendar details changed. Review again.');if(!status.connected)fail(409,'Connect your Outlook account first.');if(status.email!==row.event.workflow.organizerEmail)fail(403,'The connected Outlook mailbox must match this event’s organizer email.');if(row.calendarId)return json({event:dto(row,actor),invitation:'already-created'});
  const key=row.id+':invite',previous=await repo.operation(key);if(previous)fail(409,'An invitation send was already attempted. Refresh its status; do not resend blindly.');const transactionId=random();if(!await repo.lock(key,row.id,'invitation',{transactionId,signature:body.signature}))fail(409,'Invitation request is already being processed.');
  try{const result=await outlook.sendCalendar(user.id,graphCalendar(row.event,transactionId));if(!result?.id)throw Object.assign(Error('Outlook did not return a calendar event ID.'),{uncertain:true,status:502});row.calendarId=result.id;row.calendarSnapshot=body.signature;stamp(row,'Outlook invitation created','Outlook returned a calendar event ID. Delivery/acceptance is not assumed.');await repo.finish(key,'accepted',{calendarId:result.id,transactionId,signature:body.signature});const updated=await save(repo,row,body.version);return json({event:dto(updated,actor),invitation:'created',webLink:result.webLink||null});}catch(error){if((await repo.operation(key))?.state!=='accepted')await repo.finish(key,error.uncertain?'uncertain':'failed',{message:error.status?error.message:'Calendar request failed.',transactionId});throw error;}
 }
 if(action==='calendar-sync'){
  requireOwner(actor);let eventId=row.calendarId;if(!eventId){const op=await repo.operation(row.id+':invite');eventId=op?.detail?.calendarId;if(op?.detail?.signature)row.calendarSnapshot=op.detail.signature;}if(!eventId)fail(409,'No confirmed Outlook event ID. Check Outlook before retrying an uncertain send.');const result=await outlook.calendar(user.id,eventId);row.calendarId=eventId;const mapping={accepted:'accepted',declined:'declined',tentativelyAccepted:'tentative',none:'pending',notResponded:'pending'};for(const attendee of result.attendees||[]){const c=row.event.workflow.contacts.find(c=>c.email===attendee.emailAddress?.address?.toLowerCase());if(c&&mapping[attendee.status?.response]&&mapping[attendee.status.response]!=='pending')row.rsvps[c.personId]=mapping[attendee.status.response];}for(const a of row.event.activities)a.attendees=row.event.people.filter(p=>row.rsvps[p.id]==='accepted').map(p=>p.id);stamp(row,'Outlook responses refreshed','Actual calendar responses read from the organizer’s mailbox.');return json({event:dto(await save(repo,row,body.version),actor)});
 }
 if(action==='recover-send'){requireOwner(actor);if(!row.sending||Date.now()-row.sending.startedAt<600000)fail(409,'Wait ten minutes before acknowledging an interrupted send. Check Outlook Sent Items first.');for(const op of await repo.operations(row.id)){if(op.kind==='settlement-email'&&op.state==='pending')await repo.finish(op.id,'uncertain',{message:'Interrupted send; check Outlook Sent Items. No automatic retry.'});}row.sending=null;stamp(row,'Interrupted send acknowledged','Unconfirmed messages stay uncertain; no resend.');return json({event:dto(await save(repo,row,body.version),actor)});}
 if(action==='notification-preview'){
  requireOwner(actor);return json({messages:row.event.people.filter(p=>row.event.workflow.contacts.some(c=>c.personId===p.id)&&(row.rsvps[p.id]==='accepted'||balances(row.event).find(r=>r.id===p.id).share>0)).map(p=>personalSettlementMessage(row.event,p.id)),fingerprint:await hash(JSON.stringify([row.event.title,row.event.date,row.event.perPersonBudgetCents,row.event.workflow.contacts,row.event.expenses,row.event.transfers,row.rsvps]))});
 }
 if(action==='notifications'){
  requireOwner(actor);if(!row.closed)fail(409,'Close expense collection before sending final summaries.');if(body.confirmed!==true)fail(400,'Review and confirm the recipients and amounts first.');if(!status.connected||status.email!==row.event.workflow.organizerEmail)fail(409,'Connect the event organizer’s Outlook mailbox first.');const fingerprint=await hash(JSON.stringify([row.event.title,row.event.date,row.event.perPersonBudgetCents,row.event.workflow.contacts,row.event.expenses,row.event.transfers,row.rsvps]));if(body.fingerprint!==fingerprint)fail(409,'The settlement changed. Preview the emails again.');const people=row.event.people.filter(p=>row.event.workflow.contacts.some(c=>c.personId===p.id)&&(row.rsvps[p.id]==='accepted'||balances(row.event).find(r=>r.id===p.id).share>0)),results=[];row.sending={startedAt:Date.now(),fingerprint};await save(repo,row,body.version);row.version=body.version+1;
  for(const p of people){const key=row.id+':mail:'+fingerprint+':'+p.id,prior=await repo.operation(key);if(prior){results.push({personId:p.id,state:prior.state});continue;}const message=personalSettlementMessage(row.event,p.id);if(!await repo.lock(key,row.id,'settlement-email',{personId:p.id,fingerprint})){results.push({personId:p.id,state:'pending'});continue;}try{await outlook.sendMail(user.id,message);await repo.finish(key,'accepted',{personId:p.id,fingerprint});results.push({personId:p.id,state:'accepted'});}catch(error){const state=error.uncertain?'uncertain':'failed';await repo.finish(key,state,{personId:p.id,fingerprint,message:error.status?error.message:'Email request failed.'});results.push({personId:p.id,state});}}
  row.sending=null;stamp(row,'Summary send requests finished','Per-recipient results recorded; delivery not assumed.');const completed=await save(repo,row,row.version);return json({event:dto(completed,actor),results,notice:'Accepted means Outlook accepted the send request, not confirmed delivery. Pending/uncertain messages are not automatically retried.'});
 }
 fail(404,'Unknown event action.');
 }catch(error){return json(publicError(error),error.status||500);}};}
