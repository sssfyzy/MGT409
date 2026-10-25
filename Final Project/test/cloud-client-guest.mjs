import test from 'node:test';
import assert from 'node:assert/strict';

test('guest credential survives in-app browser storage changes between loading and saving a hero',async()=>{
 const original={location:globalThis.location,localStorage:globalThis.localStorage,fetch:globalThis.fetch};
 const eventId='mobile-guest-event',token='g'.repeat(43),values=new Map([['holysplit-guest-'+eventId,token]]),sent=[];
 try{
  globalThis.location={pathname:'/organize/',href:'https://holysplit.test/organize/?event='+eventId};
  globalThis.localStorage={getItem:key=>values.get(key)||null};
  globalThis.fetch=async(path,options)=>{sent.push({path,options});return {ok:true,json:async()=>({ok:true})};};
  const {api}=await import('../public/cloud-client.js?mobile-guest-test');
  await api('/api/group/status');
  values.clear();
  await api('/api/group/events/'+eventId+'/hero',{version:2,profile:{avatarId:'emoji-1'}});
  assert.equal(sent.length,2);
  assert.equal(sent[0].options.headers['X-HolySplit-Guest'],token);
  assert.equal(sent[1].options.headers['X-HolySplit-Guest'],token);
 }finally{
  for(const [key,value] of Object.entries(original))if(value===undefined)delete globalThis[key];else globalThis[key]=value;
 }
});
