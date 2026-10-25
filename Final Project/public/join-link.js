const TOKEN=/^[a-zA-Z0-9_-]{43}$/;

export function parseInvite(value,siteOrigin){
 const input=String(value||'').trim();
 if(TOKEN.test(input))return input;
 let url;
 try{url=new URL(input);}catch{throw Error('Paste the full HolySplit invitation link or its 43-character code.');}
 if(url.origin!==siteOrigin||url.pathname.replace(/\/$/,'')!=='/join')throw Error('This is not a HolySplit invitation for this website.');
 const token=new URLSearchParams(url.hash.slice(1)).get('invite');
 if(!token||!TOKEN.test(token))throw Error('This invitation link does not contain a valid code.');
 return token;
}
