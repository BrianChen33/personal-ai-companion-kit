#!/usr/bin/env bash
set -euo pipefail
source "$HATCH_HOOK_RUNTIME"
# Host installer sets this to the actual existing brain root. No credentials here.
: "${COMPANION_BRAIN_ROOT:?actual brain root required}"
cd "$COMPANION_BRAIN_ROOT"
if ! output=$(python3 -m muse_ext.home_space --root "$COMPANION_BRAIN_ROOT" probe); then
  silent "local projection busy or unavailable" '{}'
  exit 0
fi
decision=${output%%$'\t'*}
payload=${output#*$'\t'}
if [[ "$decision" == wake ]]; then
  wake "private home state changed" "$payload"
else
  silent "private home unchanged or publishing" "$payload"
fi
