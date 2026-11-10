# Bookkeeping plugin and portable data plan

**Status:** bookkeeping extraction and private plugin data support authorized; broad six-layer refactor is a proposal only.

**Goal:** Package the owner's accepted bookkeeping Space as an optional, reusable plugin without publishing personal financial data or creating another live ledger.

**Architecture:** The host Space database stays authoritative. The plugin binds its real operations; ordinary companion replies do not read the ledger. Explicit backup runs export a consistent, versioned native-data snapshot to the existing private vault. The public repository contains code, empty schema, synthetic fixtures and installation/inheritance instructions only.

**Tech stack:** Existing Python plugin API and vault exporter; the host Space schema/action blueprint. Full original frontend/backend source is unavailable through formal host tools.

## Scope and acceptance

- Preserve the final accepted UI: net assets above assets/liabilities, seven currencies, wallet/transaction editing, cached weekly/monthly details, subscription amortization, custom selectors, privacy display exceptions.
- Keep manual exchange-rate refresh. Do not revive cancelled recurring rate or external JSON-sync tasks.
- No production ledger writes, no second writable JSON database, no extra pre-reply model/network call.
- Free services only; no paid credentials, metered storage or automatic overage fallback.
- Public extraction must remove live records, identifiers, tokens and hardcoded user fixtures.
- One final isolated acceptance pass; no synthetic production financial entries or send-queue probes.

## Work

- [x] Read the full relevant conversation and inspect actual Space schema/actions; original full source export unavailable.
- [x] Extract sanitized structure blueprint; add optional plugin adapter, install prompt, schema and host contracts. Do not claim verbatim original app source.
- [x] Extend private snapshots with explicit, bounded plugin data declarations; include restore metadata without inheriting credentials or activating jobs.
- [x] Write the six-layer core / opt-in plugins proposal, clearly marked unimplemented.
- [x] Run final isolated checks and update release/provenance/docs. Windows test fixture handle corrected with focused rerun; remaining baseline/Node and wheel stages passed.
- [ ] Publish and verify the remote commit.
- [ ] Where host export capability is available, bind only the approved backup integration and verify a real private snapshot; otherwise report the precise missing host capability.

## Review focus

- Old UI stories must not overwrite later corrections.
- Financial source records must never enter the public source bundle or synthetic fixtures.
- Backup success must refer to current complete source data, not an old manually maintained copy.
- Restore must not rerun transactions or apply wallet balance deltas twice.
- Plugin installation must not add latency to unrelated conversation turns.
