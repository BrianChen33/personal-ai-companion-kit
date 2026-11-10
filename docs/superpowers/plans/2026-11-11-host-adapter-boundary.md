# Host adapter boundary Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for this block. Publish and report block 2, then stop before plugin extraction.

**Goal:** Extract Muse message decoding and provide a real platform-neutral owner-private message entry without changing the six-layer state algorithms or adding model calls.

**Architecture:** One pure message adapter module accepts either existing Muse read_messages results or a documented portable envelope. Both feed the same entry/driver, context ticket, commit, sticker decision and receipt paths. Runtime path resolution gains generic names and a packaged-script fallback; existing Muse commands and STICKER_* settings remain compatible. Native sending/scheduling/browser/image/storage remain host-owned, with explicit integration contracts and existing plugin bindings.

**Tech Stack:** Existing Node.js ESM driver and Python runtime; no new dependency or service.

**Spec:** Approved staged roadmap in [CORE_PLUGINS_PROPOSAL](../../CORE_PLUGINS_PROPOSAL.md); owner requested block 2 after reviewing the published block 1. This block does not deploy Muse or claim a second real platform has been installed.

## Constraints

- Preserve Muse source/turn IDs, multi-user-item projection, blank handling, feedback semantics and old CLI defaults.
- Portable entry is bound explicitly to one authenticated owner's direct conversation. Do not generalize existing owner-private calls to groups or guess identities.
- Portable IDs are namespaced by host/conversation/message; sequence must be stable and monotonic, original text/time preserved, ambiguous or unsupported payloads rejected before capture.
- Bind tickets to adapter/host/owner as well as source and code. A fresh newer message invalidates the older target; cross-binding ticket use fails.
- One context and one commit, same reply model, no extra subprocess stage or provider scan per reply; heavy work remains in existing background mechanisms.
- Same native database and receipt logic; no second live ledger or duplicate plugin registry. Rebinding never replays historical messages or sends.
- Publish Kit 0.16.0; six-layer Python runtime remains 2.11.1, plugin/frontend versions unchanged. Record host protocol as v1.

## Task 1: Behavioral contract

- [x] Add focused isolated tests for portable owner roundtrip/replay, foreign identity and conversation rejection, blank/unsupported/duplicate messages, freshness, cross-host tickets, feedback provenance and packaged runtime paths.
- [x] Run a new representative case to observe the missing interface before implementing; existing Muse cases remain regression coverage.

## Task 2: Shared entry and real adapters

- [x] Add `host_message_adapter.mjs` for Muse/portable decoding and lossless source projections.
- [x] Add `host_entry.mjs` for shared execution; reduce `main_native_entry.mjs` to a Muse-compatible CLI wrapper.
- [x] Add `host_runtime.mjs` for generic runtime paths with backward-compatible aliases and installed-package fallback.
- [x] Update reply_driver ticket binding/dispatch and sticker_main runtime resolution; preserve media and core behavior.

## Task 3: Portable installation contract and release

- [x] Add HOST_ADAPTERS and synthetic portable envelope/host-bridge example. Document tool ownership and the owner-private/text-only boundary; no fake platform APIs.
- [x] Update current deployment/catalogue/navigation/inheritance/version/provenance/release metadata; extend installed-wheel acceptance to include the real portable path.
- [x] One final isolated full acceptance and wheel check; only focused repair checks after failures. One independent final review; no production probes.
- [ ] Publish the verified tree, independently read remote commit, report actual scope and stop. Live Muse/private lock remain on actually installed code. (Final publication action; recorded by the resulting commit and delivery report.)

## Review focus

- Foreign sender/group input must never enter owner-private state through the new path.
- Host/conversation/message namespacing and ticket binding must prevent collisions/rebinding while preserving legacy Muse IDs.
- Blank messages, ambiguous sequence/ID and unsupported attachments must not fabricate human text or poison valid message processing.
- Standalone installed wheel must run the entry without copying a fake brain.py or requiring Muse directory names.
- Documentation and code must not confuse host-reported capability/receipt with actual platform authority, delivery or a completed cross-platform deployment.

## Acceptance and final review record

- Initial new protocol cases failed before implementation, then 7/7 passed.
- Final broad Python pass: 338 cases, one existing skip; runtime baseline passed.
- Independent review confirmed two important gaps: fresh-snapshot rejection forgot its head, and explicit runtime dependencies were not fingerprinted. Both were reproduced by failing tests and fixed; final host suite 9/9, Muse regression 12/12 passed.
- Muse Node fixture updated to retain its blank-input test before observing a genuinely newer message; after observation an old gate is now correctly rejected. Final Node suite 13/13 passed.
- Initial wheel check exposed omitted core-only sticker configuration; document and test the existing STICKERS_ENABLED=0 option. Rebuilt installed wheel passed context/commit outside checkout and all remaining checks.
- One initial QQ adapter assertion hit the existing 450 ms subprocess budget under concurrent load; unchanged adapter passed with the final configured Node run. No QQ production code or timeout changed.
- Ruling: user-requested single broad pass takes precedence over repeated full-suite reruns; after review fixes rerun only the host/Muse and Node paths plus installed wheel.
- Ruling: host authentication, real sending, account permissions and second-platform deployment remain explicitly outside this block; a portable envelope is not a network authentication service or a real deployment certificate.
- No deferred review minors. No live Muse calls, private memory changes, new service or extra model calls.
