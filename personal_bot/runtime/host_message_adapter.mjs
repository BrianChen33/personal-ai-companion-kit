// Pure host message normalization; no filesystem writes, sender, or model call.
import {createHash} from 'node:crypto';

const digest=value=>createHash('sha256').update(value).digest('hex');
const stringId=(value,limit)=>typeof value==='string'&&value.length>0&&value.length<=limit;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=code=>{throw Error(code);};
export function validateHostBinding(adapter,binding){
  if(!['muse','portable'].includes(adapter))fail('host_adapter_unsupported');
  if(!stringId(binding?.chat_id,512))fail('host_conversation_binding_required');
  if(adapter==='portable'&&(!stringId(binding.host_id,160)||!stringId(binding.owner_id,200)))
    fail('host_owner_and_provider_binding_required');
}
export const hostResponseKey=adapter=>adapter==='muse'?'native_response':'host_response';

function muse(response,binding){
  const chat=binding.chat_id;
  if(!response||response.chat_id!==chat||!Array.isArray(response.turns)||response.turns.length>100)
    fail('bound_native_chat_response_required');
  const rows=[],ignored=[],outputs=[];
  for(const turn of response.turns){
    if(!turn||!stringId(turn.id,200)||!Array.isArray(turn.items))fail('unsupported_native_turn_shape');
    for(const item of turn.items.filter(x=>x?.role==='assistant')){
      if(typeof item.content==='string'&&item.content.trim()&&item.content.length<=12000&&
         Number.isSafeInteger(item.seq)&&item.seq>=0&&Number.isFinite(item.occurred_at_ms)&&item.occurred_at_ms>0)
        outputs.push({chat_id:chat,turn_id:turn.id,seq:item.seq,occurred_at_ms:item.occurred_at_ms,text:item.content});
    }
    const meaningful=[];
    for(const item of turn.items.filter(x=>x?.role==='user')){
      if(typeof item.content!=='string'||item.content.length>12000||!Number.isSafeInteger(item.seq)||item.seq<0||
         !Number.isFinite(item.occurred_at_ms)||item.occurred_at_ms<=0)fail('native_user_text_seq_and_timestamp_required');
      if(!item.content.trim()){
        if(Object.keys(item).some(k=>!['role','content','seq','occurred_at_ms'].includes(k)))
          fail('native_empty_media_or_unknown_payload_requires_adapter');
        ignored.push({seq:item.seq,turn_id:turn.id});continue;
      }
      meaningful.push(item);
    }
    const first=meaningful.length?Math.min(...meaningful.map(item=>item.seq)):null;
    for(const item of meaningful)rows.push({turnId:item.seq===first?turn.id:turn.id+':user:'+item.seq,
      text:item.content,timestamp:item.occurred_at_ms/1000,occurred_at_ms:item.occurred_at_ms,actor:'user',
      native:{chat_id:chat,turn_id:turn.id,seq:item.seq,input_sha256:digest(item.content)}});
  }
  return {rows,ignored,outputs,page:response.page||null,source_chat_id:chat};
}

function portableIds(binding,messageId){
  const base=[binding.host_id,binding.chat_id,binding.owner_id];
  return {chat:'host:v1:'+digest(JSON.stringify(base)),turn:'host:v1:'+digest(JSON.stringify([...base,messageId]))};
}
function portable(response,binding){
  if(!plain(response)||response.schema!=='companion-host-messages-v1'||
     response.host_id!==binding.host_id||response.conversation_id!==binding.chat_id||
     response.conversation_type!=='direct'||!Array.isArray(response.messages)||response.messages.length>1000||
     Object.keys(response).some(k=>!['schema','host_id','conversation_id','conversation_type','messages','page'].includes(k)))
    fail('host_direct_conversation_response_required');
  if(response.page!==undefined&&(!plain(response.page)||
     Object.keys(response.page).some(k=>!['has_more','cursor'].includes(k))||
     (response.page.has_more!==undefined&&typeof response.page.has_more!=='boolean')||
     (response.page.cursor!==undefined&&response.page.cursor!==null&&
      (typeof response.page.cursor!=='string'||response.page.cursor.length>2048))))fail('host_page_metadata_invalid');
  const rows=[],ignored=[],outputs=[],ids=new Set(),sequences=new Set();
  for(const item of response.messages){
    if(!plain(item)||Object.keys(item).some(k=>!['id','sequence','role','sender_id','text','occurred_at_ms'].includes(k))||
       !stringId(item.id,512)||!['user','assistant'].includes(item.role)||!stringId(item.sender_id,200)||
       typeof item.text!=='string'||item.text.length>12000||!Number.isSafeInteger(item.sequence)||item.sequence<0||
       !Number.isSafeInteger(item.occurred_at_ms)||item.occurred_at_ms<=0)fail('host_text_message_shape_required');
    if(item.role==='user'&&item.sender_id!==binding.owner_id)fail('host_owner_sender_mismatch');
    if(ids.has(item.id)||sequences.has(item.sequence))fail('host_duplicate_message_identity');
    ids.add(item.id);sequences.add(item.sequence);
    const id=portableIds(binding,item.id);
    if(item.role==='assistant'){
      if(item.text.trim())outputs.push({chat_id:id.chat,turn_id:id.turn,seq:item.sequence,
        occurred_at_ms:item.occurred_at_ms,text:item.text});
      continue;
    }
    if(!item.text.trim()){ignored.push({seq:item.sequence,turn_id:id.turn});continue;}
    rows.push({turnId:id.turn,text:item.text,timestamp:item.occurred_at_ms/1000,occurred_at_ms:item.occurred_at_ms,actor:'user',
      native:{chat_id:id.chat,turn_id:id.turn,seq:item.sequence,input_sha256:digest(item.text)}});
  }
  return {rows,ignored,outputs,page:response.page||null,source_chat_id:portableIds(binding,'').chat};
}

export function decodeHostResponse(adapter,response,binding){
  validateHostBinding(adapter,binding);
  const decoded=adapter==='muse'?muse(response,binding):portable(response,binding);
  decoded.rows.sort((a,b)=>b.native.seq-a.native.seq);
  return decoded;
}

// Retain original source values, never manufacture a Muse-shaped conversation.
export function projectHostResponse(adapter,response,source,binding){
  if(adapter==='muse'){
    const turn=response.turns.find(turn=>turn.id===source.turn_id);
    if(!turn)fail('host_ticket_source_not_found');
    return {chat_id:binding.chat_id,page:response.page||null,
      turns:[{id:turn.id,items:turn.items.filter(item=>item.role==='user')}]};
  }
  const item=response.messages.find(item=>item.role==='user'&&item.sequence===source.seq&&
    portableIds(binding,item.id).turn===source.turn_id);
  if(!item)fail('host_ticket_source_not_found');
  return {...response,messages:[item]};
}
