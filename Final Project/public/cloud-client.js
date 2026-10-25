let visitGuestEventId=null;
let visitGuestToken=null;
function guestTokenForVisit(){
 const eventId=location.pathname.replace(/\/$/,'')==='/organize'?new URL(location.href).searchParams.get('event'):null;
 if(!eventId)return null;
 if(visitGuestEventId!==eventId){
  visitGuestEventId=eventId;
  try{visitGuestToken=localStorage.getItem('holysplit-guest-'+eventId);}catch{visitGuestToken=null;}
 }
 return visitGuestToken;
}
export async function api(path,body){const guestToken=guestTokenForVisit();const headers={Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'}),...(guestToken&&path.startsWith('/api/group/')?{'X-HolySplit-Guest':guestToken}:{})};const res=await fetch(path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin'});let data;try{data=await res.json();}catch{throw Error('The shared service is unavailable. Your local records were not overwritten.');}if(!res.ok)throw Object.assign(Error(data.error||'This action could not be completed.'),{status:res.status,signInPath:data.signInPath});return data;}
