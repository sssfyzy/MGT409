import {api} from './cloud-client.js';
import {parseInvite} from './join-link.js';
const $=s=>document.querySelector(s);
let busy=false;
async function join(value){
 if(busy)return;
 busy=true;
 try{
  const token=parseInvite(value,location.origin);
  const key='holysplit-link-'+token;
  const saved=localStorage.getItem(key);
  const old=saved?JSON.parse(saved):null;
  const guestToken=old?.eventId?localStorage.getItem('holysplit-guest-'+old.eventId):null;
  const probe='holysplit-storage-check';localStorage.setItem(probe,'1');localStorage.removeItem(probe);
  $('#join-status').textContent='Joining your friends…';
  const result=await api('/api/group/guest-join',{token,intent:'join',...(guestToken?{guestToken}:{})});
  if(result.role==='organizer')localStorage.removeItem('holysplit-guest-'+result.eventId);
  else localStorage.setItem('holysplit-guest-'+result.eventId,result.guestToken);
  localStorage.setItem(key,JSON.stringify({eventId:result.eventId}));
  location.replace('/organize?event='+encodeURIComponent(result.eventId));
 }catch(error){$('#join-status').textContent=error.name==='SecurityError'?'Browser storage is blocked. Enable it to keep your guest identity.':error.message;$('#invite-entry').hidden=false;busy=false;}
}
$('#invite-entry').onsubmit=event=>{event.preventDefault();join($('#invite-input').value);};
const token=new URLSearchParams(location.hash.slice(1)).get('invite');
if(token){$('#invite-input').value=token;$('#join-status').textContent='Invitation ready. Tap Join activity when you’re ready to enter.';}
