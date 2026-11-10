// Trusted deployment paths only. No discovery, network, or account authorization.
import {existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=dirname(fileURLToPath(import.meta.url));
export function resolveHostRuntime(workspace,env=process.env){
  const brainRoot=resolve(env.COMPANION_BRAIN_ROOT||env.STICKER_BRAIN_ROOT||join(workspace,'muse-brain'));
  const localScript=join(brainRoot,'brain.py');
  const brainScript=resolve(env.COMPANION_BRAIN_SCRIPT||(existsSync(localScript)?localScript:join(HERE,'brain.py')));
  return {brainRoot,brainScript,python:env.COMPANION_PYTHON||env.STICKER_PYTHON||'python3'};
}
