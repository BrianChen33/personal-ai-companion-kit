// One small deployment registry read; no plugin imports or directory scans.
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
export function optionalEnabled(root,id){
  try {
    if(!existsSync(join(root,'config.json'))) return true; // legacy adapter root
    const cfg=JSON.parse(readFileSync(join(root,'config.json'),'utf8'));
    if(cfg.inheritance_pending) return false;
    if(cfg.plugin_profile!=='managed-core-v1') return true;
    const p=JSON.parse(readFileSync(join(root,'plugins.json'),'utf8'));
    return p.version===1 && p.plugins?.[id]?.enabled===true;
  } catch {return false;}
}
