import test from 'node:test';
import assert from 'node:assert/strict';

test('invitation checks a saved guest token instead of blindly opening removed access',async()=>{
 const original={location:globalThis.location,localStorage:globalThis.localStorage,document:globalThis.document,fetch:globalThis.fetch};
 const invite='a'.repeat(43),oldToken='b'.repeat(43),newToken='c'.repeat(43),eventId='event-1';
 const values=new Map([['holysplit-link-'+invite,JSON.stringify({eventId})],['holysplit-guest-'+eventId,oldToken]]);
 let requestBody,redirect;
 const moved=new Promise(resolve=>redirect=resolve);
 try{
  globalThis.location={origin:'https://holysplit.test',pathname:'/join',href:'https://holysplit.test/join#invite='+invite,hash:'#invite='+invite,replace:redirect};
  globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const elements={'#join-status':{textContent:''},'#invite-entry':{hidden:false},'#invite-input':{value:''}};
  globalThis.document={querySelector:selector=>elements[selector]};
  globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/group/guest-join');requestBody=JSON.parse(options.body);return {ok:true,json:async()=>({eventId,guestToken:newToken,alreadyJoined:false})};};
  await import('../public/join.js?removed-guest-test');
  assert.equal(requestBody,undefined,'opening a link must not create a guest');
  assert.equal(elements['#invite-input'].value,invite);
  elements['#invite-entry'].onsubmit({preventDefault(){}});
  assert.equal(await moved,'/organize?event='+eventId);
  assert.deepEqual(requestBody,{token:invite,intent:'join',guestToken:oldToken});
  assert.equal(values.get('holysplit-guest-'+eventId),newToken);
 }finally{
  for(const [key,value] of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;
 }
});
test('organizer opening their own invite clears a stale guest token and goes to management',async()=>{
 const original={location:globalThis.location,localStorage:globalThis.localStorage,document:globalThis.document,fetch:globalThis.fetch};
 const invite='d'.repeat(43),eventId='event-owner',values=new Map([['holysplit-guest-'+eventId,'e'.repeat(43)]]);
 let redirect;const moved=new Promise(resolve=>redirect=resolve);
 try{
  globalThis.location={origin:'https://holysplit.test',pathname:'/join',href:'https://holysplit.test/join#invite='+invite,hash:'#invite='+invite,replace:redirect};
  globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const elements={'#join-status':{textContent:''},'#invite-entry':{hidden:false},'#invite-input':{value:''}};
  globalThis.document={querySelector:selector=>elements[selector]};
  globalThis.fetch=async()=>({ok:true,json:async()=>({eventId,role:'organizer',alreadyJoined:true})});
  await import('../public/join.js?owner-invite-test');
  assert.equal(elements['#invite-input'].value,invite);
  elements['#invite-entry'].onsubmit({preventDefault(){}});
  assert.equal(await moved,'/organize?event='+eventId);
  assert.equal(values.has('holysplit-guest-'+eventId),false);
 }finally{for(const [key,value] of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
