#!/usr/bin/env node
// Backward-compatible Muse CLI; decoding and execution are shared with other hosts.
import {runEntryCli} from './host_entry.mjs';
runEntryCli('muse');
