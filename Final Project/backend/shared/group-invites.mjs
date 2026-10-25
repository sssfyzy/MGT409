import {hash,base64url,fail,random,jsonBody} from './security.mjs';
import {normalizeEvent} from '../../public/event-core.js';
const WEEK=7*24*60*60*1000;
export async function shareInvite(repo,row,expected,origin){
 if(row.closed||row.sending)fail(409,'Reopen this event before sharing a new invitation.');
 if(!row.groupInvite||row.groupInvite.expires<=Date.now()){
 const token=base64url(crypto.getRandomValues(new Uint8Array(32)));row.groupInvite={token,digest:await hash(token),expires:Date.now()+WEEK};
 if(!await repo.save(row,expected))fail(409,'This event changed. Refresh and try again.');
 }
 const invite=row.groupInvite;await repo.put('group-invite:'+invite.digest,{eventId:row.id},invite.expires);
 return {row:await repo.get(row.id),invitation:{url:origin+'/join#invite='+invite.token,expires:invite.expires}};
}
export async function joinViaLink(repo,request,user,emails){
 const body=await jsonBody(request);if(typeof body.token!=='string'||! /^[a-zA-Z0-9_-]{43}$/.test(body.token))fail(404,'This invitation is invalid or expired.');
 const digest=await hash(body.token),index=await repo.record('group-invite:'+digest),row=index?await repo.get(index.eventId):null;
 if(!row||row.groupInvite?.digest!==digest||row.groupInvite.expires<=Date.now())fail(404,'This invitation is invalid or expired.');
 const members=await repo.members(row.id),member=members.find(m=>m.user_id===user.id)||members.find(m=>!m.user_id&&emails.includes(m.email));
 const organizer=row.event.people.find(p=>p.id===members.find(m=>m.user_id===row.owner)?.person_id)?.name||'Organizer';
 const preview={title:row.event.title,date:row.event.date,organizer,closed:!!(row.closed||row.calendarId||row.sending),alreadyMember:!!member,eventUrl:member?'/organize?event='+row.id:null};
 const existing=(row.joinRequests||[]).find(r=>r.userId===user.id);
 if(body.action==='preview')return {preview,request:existing?{state:existing.state}:null};
 if(body.action!=='request')fail(400,'Choose a valid invitation action.');
 if(member)return {preview,request:{state:'approved'}};
 if(row.closed||row.calendarId||row.sending)fail(409,'This activity is not accepting join requests right now.');
 const name=String(body.name||'').trim();if(!name||name.length>40||/[\r\n]/.test(name))fail(400,'Use your name, up to 40 characters.');
 if(existing){if(existing.state==='pending'&&existing.name!==name){existing.name=name;if(!await repo.save(row,row.version))fail(409,'This request changed. Refresh and try again.');}return {preview,request:{state:existing.state}};}
 if((row.joinRequests||[]).length>=50)fail(409,'This invitation has reached its request limit. Contact the organizer.');
 const entry={id:random(),userId:user.id,email:user.email,name,state:'pending',created:Date.now()};
 row.joinRequests=[...(row.joinRequests||[]),entry];
 if(!await repo.save(row,row.version))fail(409,'Another request arrived. Please try again.');
 return {preview,request:{state:'pending'}};
}
export async function decideJoin(repo,row,body){
 if(row.closed||row.sending)fail(409,'Reopen this event before changing its membership.');
 const entry=(row.joinRequests||[]).find(r=>r.id===body.requestId);if(!entry||entry.state!=='pending')fail(409,'This join request is no longer pending.');
 if(!['approve','decline'].includes(body.decision))fail(400,'Choose approve or decline.');
 if(body.decision==='decline'){entry.state='declined';if(!await repo.save(row,body.version))fail(409,'This event changed. Refresh first.');return repo.get(row.id);}
 if(row.calendarId)fail(409,'The calendar invitation is already sent. Adding new calendar attendees is not supported yet; approve joins before sending it.');
 if(row.event.people.length>=20)fail(400,'This event already has 20 participants.');
 const members=await repo.members(row.id);if(members.some(m=>m.user_id===entry.userId||m.email===entry.email))fail(409,'This person is already an event member.');
 if(row.event.people.some(p=>p.name.toLowerCase()===entry.name.toLowerCase()))fail(400,'This name is already in use. Ask the friend to use a distinct name.');
 const personId=random();row.event.people.push({id:personId,name:entry.name});row.event.workflow.contacts.push({personId,email:entry.email});row.rsvps[personId]='pending';
 row.event=normalizeEvent(row.event);entry.state='approved';entry.personId=personId;
 row.event.audit.push({at:new Date().toISOString(),action:'Group invite approved',detail:entry.name+' joined after organizer approval. No email or invitation was sent automatically.'});
 if(!await repo.saveWithMember(row,body.version,{personId,email:entry.email,userId:entry.userId}))fail(409,'This event changed. Refresh first.');
 return repo.get(row.id);
}
export async function joinAsGuest(repo,request){
 const body=await jsonBody(request);
 if(typeof body.token!=='string'||!/^[a-zA-Z0-9_-]{43}$/.test(body.token))fail(404,'This invitation is invalid or expired.');
 const digest=await hash(body.token),index=await repo.record('group-invite:'+digest),row=index?await repo.get(index.eventId):null;
 if(!row||row.groupInvite?.digest!==digest||row.groupInvite.expires<=Date.now())fail(404,'This invitation is invalid or expired.');
 const signedInId=request.headers.get('oai-authenticated-user-id');
 if(signedInId&&request.headers.get('oai-authenticated-user-email')&&row.owner===signedInId)return {eventId:row.id,role:'organizer',alreadyJoined:true};
 if(typeof body.guestToken==='string'&&/^[a-zA-Z0-9_-]{43}$/.test(body.guestToken)){
  const existing=await repo.record('guest:'+await hash(body.guestToken));
  if(existing?.eventId===row.id&&row.groupGuests?.[existing.personId]?.removed!==true)return {eventId:row.id,guestToken:body.guestToken,alreadyJoined:true};
 }
 if(body.intent!=='join')fail(400,'Open the current invitation page and tap Join activity to enter.');
 if(row.closed||row.sending)fail(409,'This activity is not accepting new participants right now.');
 if(row.event.people.length>=20)fail(409,'This activity already has 20 participants.');
 const personId=random(),guestToken=base64url(crypto.getRandomValues(new Uint8Array(32))),guestDigest=await hash(guestToken),userId='guest:'+random();
 let number=1;while(row.event.people.some(p=>p.name.toLowerCase()==='guest '+number))number++;
 const name='Guest '+number;
 row.event.people.push({id:personId,name});row.rsvps[personId]='accepted';row.groupGuests={...(row.groupGuests||{}),[personId]:{digest:guestDigest,joined:Date.now(),removed:false}};
 row.event.audit.push({at:new Date().toISOString(),action:'Guest joined by link',detail:name+' joined without an account. Identity is held by this browser.'});
 if(!await repo.saveWithGuest(row,row.version,{personId,email:'guest-'+personId+'@guest.invalid',userId},guestDigest))fail(409,'Someone else joined at the same time. Please try again.');
 return {eventId:row.id,guestToken,alreadyJoined:false};
}
