const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const dollars=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((cents||0)/100);

export function collectionMarkup(event,split,avatar){
 const pending=(split.transfers||[]).map((transfer,index)=>({...transfer,index,done:false}));
 const done=(event.transfers||[]).map(transfer=>({...transfer,done:true}));
 const all=[...pending,...done];
 const name=id=>event.people.find(person=>person.id===id)?.name||'Friend';
 const face=id=>avatar(event._heroes?.[id]?.avatarId);
 const recipients=[...new Set(all.map(transfer=>transfer.toId))];
 if(!recipients.length)return '<section class="collection-board flow-card"><p class="eyebrow">THE MONEY HANDS</p><h3>All hands are resting 👐</h3><p>Record actual costs to see who needs reimbursement. A suggested transfer appears here when someone is owed money.</p></section>';
 return '<section class="collection-board flow-card"><p class="eyebrow">THE MONEY HANDS</p><h2>Who is collecting? 💸</h2><p>Each hand represents one suggested transfer. The payer can mark it sent after transferring outside HolySplit.</p>'+recipients.map(recipient=>{
  const arms=all.filter(transfer=>transfer.toId===recipient);
  return '<article class="collection-group"><div class="collection-host"><span class="collection-host-face">'+face(recipient)+'</span><span class="collection-host-name">'+escape(name(recipient))+'</span><small>Receiving from '+arms.length+' '+(arms.length===1?'hand':'hands')+'</small></div><div class="collection-arms">'+arms.map(transfer=>{
   const mine=event._personId===transfer.fromId;
   const status=transfer.done?'<span class="collection-cash" aria-label="Marked sent">💵 💵</span><small>Marked sent · self-reported</small>':mine?'<button type="button" class="button primary" data-confirm-transfer="'+transfer.index+'">I sent '+dollars(transfer.amountCents)+'</button>':'<small>Waiting for '+escape(name(transfer.fromId))+'</small>';
   return '<div class="collection-arm '+(transfer.done?'is-done':'')+'"><span class="collection-hand" aria-hidden="true">🫴</span><span class="collection-arm-line" aria-hidden="true"></span><div class="collection-payer"><span class="collection-payer-face">'+face(transfer.fromId)+'</span><strong>'+escape(name(transfer.fromId))+'</strong><b>'+dollars(transfer.amountCents)+'</b></div><div class="collection-status">'+status+'</div></div>';
  }).join('')+'</div></article>';
 }).join('')+'<p class="fine">A dollar stack means someone recorded that they sent money. HolySplit cannot verify Zelle or bank delivery. Confirm with the recipient directly.</p></section>';
}
