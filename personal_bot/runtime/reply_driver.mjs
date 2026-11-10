#!/usr/bin/env node
// Fixed host driver. It cannot read native chat tools or intercept native final.
import {readFileSync,writeFileSync,mkdirSync,renameSync,lstatSync,existsSync,readdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {prepareMedia,finishMedia} from './reply_media.mjs';
import {decodeHostResponse,projectHostResponse,hostResponseKey,validateHostBinding} from './host_message_adapter.mjs';
import {resolveHostRuntime} from './host_runtime.mjs';

const HERE=dirname(fileURLToPath(import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const root=arg('--root'),chat=arg('--chat-id');
const adapter=arg('--adapter')||'muse';
const binding={chat_id:chat,host_id:arg('--host-id'),owner_id:arg('--owner-id')};
const {brainRoot,brainScript}=resolveHostRuntime(root||'.');
const responseKey=hostResponseKey(adapter);
const folder=root&&join(root,'stickers','reply-rounds');
const schema='host-reply-ticket-v1';

function safe(path){
  if(existsSync(path)&&lstatSync(path).isSymbolicLink())throw Error('reply_state_symlink_refused');
  return path;
}
function atomic(path,value){
  safe(dirname(path));safe(path);
  mkdirSync(dirname(path),{recursive:true,mode:0o700});
  const temporary=path+'.'+randomUUID()+'.tmp';
  writeFileSync(temporary,JSON.stringify(value),{mode:0o600,flag:'wx'});
  renameSync(temporary,path);
}
function fingerprint(){
  const js=['main_native_entry.mjs','sticker_main.mjs','reply_driver.mjs','reply_media.mjs','main_entry_guard.mjs','sticker_decision.mjs','host_entry.mjs','host_message_adapter.mjs','host_runtime.mjs'].map(name=>join(HERE,name));
  const adjacent=join(dirname(brainScript),'muse_ext');
  const modules=existsSync(adjacent)?adjacent:join(HERE,'muse_ext');
  const py=[brainScript,...readdirSync(modules).filter(name=>name.endsWith('.py')).sort().map(name=>join(modules,name))];
  return hash([...js,...py].map(path=>hash(readFileSync(path))).join(':'));
}
function boundTicket(record){
  return hash(JSON.stringify([record.schema,record.adapter,record.host_id,record.owner_id,record.chat_id,record.source,record.reply_turn_id,
    record.native_sha256,record.core_fingerprint,record.created_at_ms]));
}
function run(request){
  const started=performance.now();
  const entry=adapter==='muse'?'main_native_entry.mjs':'host_entry.mjs';
  const args=[join(HERE,entry),'--root',root,'--chat-id',chat];
  if(adapter==='portable')args.push('--adapter',adapter,'--host-id',binding.host_id,'--owner-id',binding.owner_id);
  const child=spawnSync(process.execPath,args,
    {input:JSON.stringify(request),encoding:'utf8',timeout:65000,maxBuffer:524288});
  let result;
  try{result=JSON.parse(child.stdout);}catch{result={ok:false,error:'native_driver_response_unavailable'};}
  if(child.error)result={ok:false,error:'native_driver_process_failed'};
  return {result,core_ms:Math.round((performance.now()-started)*100)/100};
}
function ticketPath(ticket){
  if(typeof ticket!=='string'||!/^[a-f0-9]{64}$/.test(ticket))throw Error('source_ticket_required');
  return safe(join(folder,ticket+'.json'));
}
function load(ticket){
  safe(folder);
  const bytes=readFileSync(ticketPath(ticket));
  if(bytes.length>2097152)throw Error('source_ticket_too_large');
  const record=JSON.parse(bytes);
  if(record.schema!==schema||record.adapter!==adapter||record.host_id!==binding.host_id||record.owner_id!==binding.owner_id||
     record.chat_id!==chat||record.ticket!==ticket||
     boundTicket(record)!==ticket||
     record.core_fingerprint!==fingerprint()||record.native_sha256!==hash(JSON.stringify(record.native))||
     Date.now()-record.created_at_ms>86400000)throw Error('source_ticket_stale_or_changed');
  const decoded=decodeHostResponse(adapter,record.native,binding);
  const selected=decoded.rows.find(row=>row.native.seq===record.source?.seq&&row.native.turn_id===record.source?.turn_id);
  if(!selected||selected.turnId!==record.reply_turn_id||selected.native.chat_id!==record.source.chat_id||
     selected.native.input_sha256!==record.source.input_sha256||
     selected.occurred_at_ms!==record.source.occurred_at_ms)throw Error('source_ticket_binding_invalid');
  return record;
}
function remember(response,source,replyTurn){
  const decoded=decodeHostResponse(adapter,response,binding);
  const selected=decoded.rows.find(row=>row.native.seq===source.seq&&row.native.turn_id===source.turn_id);
  if(!selected||selected.native.input_sha256!==source.input_sha256||selected.turnId!==replyTurn)
    throw Error('actual_native_ticket_source_required');
  const core_fingerprint=fingerprint();
  const projected=projectHostResponse(adapter,response,source,binding);
  const boundSource={...source,occurred_at_ms:selected.occurred_at_ms};
  const record={schema,adapter,host_id:binding.host_id,owner_id:binding.owner_id,chat_id:chat,
    source:boundSource,reply_turn_id:replyTurn,native:projected,
    native_sha256:hash(JSON.stringify(projected)),core_fingerprint,created_at_ms:Date.now()};
  record.ticket=boundTicket(record);
  atomic(ticketPath(record.ticket),record);
  return record;
}
function metric(phase,result,record,core_ms,started){
  const now=Date.now();
  const row={at_ms:now,phase,ticket:record?.ticket||null,seq:record?.source?.seq??null,
    ok:result.ok===true,ready_to_send:result.ready_to_send===true,
    core_ms,local_ms:Math.round((performance.now()-started)*100)/100,
    source_elapsed_ms:record?now-record.source.occurred_at_ms:null};
  const path=safe(join(folder,'timings.json'));
  let rows=[];try{rows=JSON.parse(readFileSync(path,'utf8'));}catch{}
  if(!Array.isArray(rows))rows=[];
  rows=[...rows.slice(-199),row];atomic(path,rows);
  atomic(join(brainRoot,'state','reply-driver-health.json'),{
    schema:'reply-driver-health-v1',observed_at:now/1000,last:row,samples:rows.length,
    boundary:'local subprocess timing; source elapsed includes host/model/tools/queue and is not model-only time'});
  return row;
}
function stats(){
  safe(folder);let rows=[];
  try{rows=JSON.parse(readFileSync(safe(join(folder,'timings.json')),'utf8'));}catch{}
  const phases={};
  for(const phase of ['context','commit','gate']){
    const values=rows.filter(row=>row.phase===phase&&row.ok).map(row=>row.local_ms).sort((a,b)=>a-b);
    if(values.length)phases[phase]={count:values.length,
      median_local_ms:values[Math.floor((values.length-1)/2)],
      p95_local_ms:values[Math.ceil(values.length*.95)-1]};
  }
  return {ok:true,samples:rows.length,phases,last:rows.at(-1)||null,
    boundary:'No platform model/queue telemetry is available here. Timings contain no chat text.'};
}
function main(){
  if(process.argv.includes('--help'))return {ok:true,
    usage:'reply_driver.mjs --root WORKSPACE --chat-id TRUSTED_CHAT [--adapter portable --host-id PROVIDER --owner-id OWNER] < JSON',
    context:'Muse: {phase:context,native_response:ACTUAL_TOOL_RESULT}; portable: {phase:context,host_response:companion-host-messages-v1}',
    commit:'{phase:commit,ticket:RETURNED_TICKET,emotion_assessment:FILLED_CONTEXT_TEMPLATE}',
    optional:'commit may include fresh native_response (Muse) or host_response (portable) after long tools; gate/stats are read-only checks',
    boundary:'same host model appraises48 before text; no native-final interception or sender'};
  if(!root||!chat)return {ok:false,error:'trusted_workspace_and_chat_required'};
  validateHostBinding(adapter,binding);
  const bytes=readFileSync(0);
  if(bytes.length>2097152)return {ok:false,error:'bounded_native_request_required'};
  let request;try{request=JSON.parse(bytes.toString('utf8'));}catch{return {ok:false,error:'JSON_stdin_required'};}
  if(!request||typeof request!=='object'||Array.isArray(request))return {ok:false,error:'host_request_object_required'};
  if(request[adapter==='muse'?'host_response':'native_response']!==undefined)return {ok:false,error:'host_wrong_response_field'};
  const phase=request.phase||'context';
  if(phase==='stats')return stats();
  if(!['context','commit','gate','media','finish'].includes(phase))return {ok:false,error:'invalid_reply_driver_phase'};
  if(phase==='finish'){const saved=load(request.ticket);return finishMedia(root,saved.reply_turn_id,request);}
  const started=performance.now();let record,executed;
  if(phase==='context'){
    executed=run({phase,[responseKey]:request[responseKey],
      ...(request.target_seq===undefined?{}:{target_seq:request.target_seq}),
      ...(request.target_turn_id===undefined?{}:{target_turn_id:request.target_turn_id})});
    if(executed.result.ok&&executed.result.context?.emotion_template?.format==='full48-v1'){
      executed.result.context.emotion_template={...executed.result.context.emotion_template,
        format:'compact48-v1',emotion_deltas:{}};
      executed.result.context.emotion_protocol={...executed.result.context.emotion_protocol,
        preferred_format:'compact48-v1'};
    }
    const source=executed.result.host_source||executed.result.native_source;
    if(executed.result.ok&&source&&executed.result.formal_entry?.context_recorded)
      record=remember(request[responseKey],source,executed.result.turnId);
  }else{
    record=load(request.ticket);
    const forwarded={phase:phase==='media'?'gate':phase,[responseKey]:request[responseKey]??record.native,
      target_seq:record.source.seq,target_turn_id:record.source.turn_id};
    for(const field of ['emotion_assessment','humor_assessment','meme_updates','reading_documents'])
      if(request[field]!==undefined)forwarded[field]=request[field];
    executed=run(forwarded);
  }
  if(['commit','media'].includes(phase)&&executed.result.ready_to_send&&request.media!==false){
    try{executed.result.media=prepareMedia(root,record.reply_turn_id,
      {query:request.media_query||'',emotion:request.media_emotion||executed.result.mood?.label||''});}
    catch{executed.result.media={ok:false,status:'media_unavailable',sampled:executed.result.decision?.sampled===true};}
  }
  const timing=metric(phase,executed.result,record,executed.core_ms,started);
  return {...executed.result,...(record?{ticket:record.ticket}:{}),timing,
    driver:'fixed-source-ticket-v1',host_adapter:adapter,next:executed.result.ready_to_send?
      'Reply now from the retained context and updates. Optional maintenance must not delay text.':
      phase==='context'&&record?'The SAME host model fills the template with affected labels only (omitted=0); commit this ticket. No extra reflection or second prepare.':
      'Use the specific validation error; no reroll, invented input or repeated repair loop.'};
}
try{const result=main();process.stdout.write(JSON.stringify(result)+'\n');if(!result.ok)process.exitCode=1;}
catch(error){process.stdout.write(JSON.stringify({ok:false,error:/^(source_ticket_|reply_state_|actual_native_|host_)/.test(error.message)?
  error.message:'reply_driver_failed'})+'\n');process.exitCode=1;}
