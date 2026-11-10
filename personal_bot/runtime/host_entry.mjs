#!/usr/bin/env node
// Shared owner-private execution. Hosts supply authenticated observations and do real I/O.
import {readFileSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {decodeHostResponse,hostResponseKey} from './host_message_adapter.mjs';
import {resolveHostRuntime} from './host_runtime.mjs';

export function runHostEntry(adapter,q,binding){
 const {root}=binding;
 if(!root||!binding.chat_id)return {ok:false,error:'trusted_workspace_and_owner_chat_binding_required'};
 const key=hostResponseKey(adapter),other=adapter==='muse'?'host_response':'native_response';
 if(q[other]!==undefined)return {ok:false,error:'host_wrong_response_field'};
 const decoded=decodeHostResponse(adapter,q[key],binding);
 const {rows,ignored,outputs}=decoded,chat=decoded.source_chat_id;
 const phase=q.phase||'context';
 if(!['context','commit','gate','audit','feedback'].includes(phase))return {ok:false,error:'invalid_native_entry_phase'};
 if(phase==='feedback'){
  // This is the existing scheduled model's bounded historical scan. It never
  // goes through sticker decisions or changes the current native-source head.
  const {brainRoot,brainScript,python}=resolveHostRuntime(root);
  const users=rows.slice(0,20).map(r=>({source:'main:sticker',event_id:r.turnId,actor:'user',text:r.text,occurred_at:r.timestamp}));
  const delivered=outputs.sort((a,b)=>b.seq-a.seq).slice(0,20);
  const request={op:'companion_feedback',action:'scan',scope:'owner-private',native_events:[],native_outputs:[],
    coverage:{chat_id:chat,page:decoded.page,sample_size:rows.length,partial:rows.length>20||outputs.length>20}};
  // The real brain stdin limit is64KiB. Select complete records, never truncate
  // originals, and give both user and assistant evidence room in this batch.
  for(let i=0;i<Math.max(users.length,delivered.length);i++)for(const [field,item] of
    [['native_events',users[i]],['native_outputs',delivered[i]]]){
    if(!item)continue;request[field].push(item);
    if(Buffer.byteLength(JSON.stringify(request),'utf8')>60000){request[field].pop();request.coverage.partial=true;}
  }
  const result=spawnSync(python,[brainScript,'--root',brainRoot],
    {input:JSON.stringify(request),encoding:'utf8',timeout:8000,maxBuffer:262144});
  if(result.error||!result.stdout)return {ok:false,error:'feedback_scan_process_failed'};
  let output;try{output=JSON.parse(result.stdout);}catch{return {ok:false,error:'feedback_scan_output_invalid'};}
  if(result.status!==0&&output.ok!==false)return {ok:false,error:'feedback_scan_process_failed'};
  return {...output,[adapter==='muse'?'native_sample':'host_sample']:{chat_id:chat,page:decoded.page,coverage:'recent verified sample; assistant output for usage evidence only'}};
 }
 let selected;
 if(phase!=='audit'){
  const blank=ignored.find(r=>(q.target_seq!==undefined?r.seq===q.target_seq:
    phase==='context'&&r.seq>Math.max(-1,...rows.map(x=>x.native.seq)))&&
    (q.target_turn_id===undefined||r.turn_id===q.target_turn_id));
  if(blank||(!rows.length&&ignored.length))return {ok:true,event:'empty_user_input_ignored',response_required:false,ready_to_send:false};
  selected=rows.find(r=>(q.target_seq===undefined||r.native.seq===q.target_seq)&&
    (q.target_turn_id===undefined||r.native.turn_id===q.target_turn_id));
  if(!selected)return {ok:false,error:'actual_owner_user_item_not_found'};
  // Forward the verified head even for a stale target. The existing guard
  // persists it before rejecting, so a later bare-ticket retry stays stale.
 }
 const input=phase==='audit'?{phase:'audit',turns:rows.slice(0,20)}:{...selected,phase,
  native_head:{...rows[0].native,source_timestamp:rows[0].timestamp},
  ...(q.emotion_assessment===undefined?{}:{emotion_assessment:q.emotion_assessment}),
  ...(q.humor_assessment===undefined?{}:{humor_assessment:q.humor_assessment}),
  ...(q.meme_updates===undefined?{}:{meme_updates:q.meme_updates}),
  ...(q.reading_documents===undefined?{}:{reading_documents:q.reading_documents})};
 const result=spawnSync(process.execPath,[join(dirname(fileURLToPath(import.meta.url)),'sticker_main.mjs'),'--root',root],
  {input:JSON.stringify(input),encoding:'utf8',timeout:60000,maxBuffer:262144});
 if(result.error||!result.stdout)return {ok:false,error:'main_entry_process_failed'};
 let output;try{output=JSON.parse(result.stdout);}catch{return {ok:false,error:'main_entry_output_invalid'};}
 if(selected)output[adapter==='muse'?'native_source':'host_source']=selected.native;
 if(phase==='audit')output[adapter==='muse'?'native_sample':'host_sample']={chat_id:chat,page:decoded.page,coverage:'recent sample only'};
 return output;
}
export function runEntryCli(fixedAdapter=null){
 const argument=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
 try{
  if(process.argv.includes('--help')){
   process.stdout.write(JSON.stringify({ok:true,
    usage:fixedAdapter==='muse'?'main_native_entry.mjs --root WORKSPACE --chat-id TRUSTED_OWNER_CHAT < JSON':
     'host_entry.mjs --adapter portable --host-id PROVIDER --owner-id OWNER --chat-id CHAT --root WORKSPACE < JSON',
    phases:'context|commit|gate|audit|feedback',
    input:fixedAdapter==='muse'?'native_response: actual Muse read_messages result':'host_response: companion-host-messages-v1',
    boundary:'owner-private direct text only; host authenticates sources and performs real tools; no sender or native-final interception'})+'\n');
   return;
  }
  const adapter=fixedAdapter||argument('--adapter')||'muse';
  const binding={root:argument('--root'),chat_id:argument('--chat-id'),host_id:argument('--host-id'),owner_id:argument('--owner-id')};
  if(!binding.root||!binding.chat_id)throw Error('trusted_workspace_and_owner_chat_binding_required');
  const bytes=readFileSync(0);
  if(bytes.length>2097152)throw Error('host_request_too_large');
  let q;try{q=JSON.parse(bytes.toString('utf8'));}catch{throw Error('native_JSON_stdin_required');}
  if(!q||typeof q!=='object'||Array.isArray(q))throw Error('host_request_object_required');
  const result=runHostEntry(adapter,q,binding);
  process.stdout.write(JSON.stringify(result)+'\n');if(!result.ok)process.exitCode=1;
 }catch(error){
  const detail=/^(host_|native_|bound_|unsupported_native_|trusted_)/.test(error.message)?error.message:'native_entry_failed';
  process.stdout.write(JSON.stringify({ok:false,error:detail})+'\n');process.exitCode=1;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))runEntryCli();
