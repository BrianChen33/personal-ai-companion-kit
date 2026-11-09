#!/usr/bin/env bash
set -euo pipefail
source "$HATCH_HOOK_RUNTIME"
# Set these host-specific paths when installing. Credentials stay outside the brain.
BRAIN_ROOT="${COMPANION_BRAIN_ROOT:-$HOME/workspace/muse-brain}"
RELAY_CONFIG="${COMPANION_HOME_RELAY_CONFIG:-$HOME/.config/companion-home/relay.json}"
result="$(PYTHONPATH="$BRAIN_ROOT" python3 -m muse_ext.home_relay \
  --root "$BRAIN_ROOT" --config "$RELAY_CONFIG")"
# Program publication needs no agent wake or chat delivery, including on retry.
silent "home_state_relay" "$result"
