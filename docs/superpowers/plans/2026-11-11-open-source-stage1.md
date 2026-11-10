# Open-source stage 1 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for this bounded documentation checkpoint. Stop after publishing and reporting stage 1; do not begin platform extraction.

**Goal:** Give a new Agent one current installation route, an honest capability catalogue and a clear separation between operating rules and historical notes.

**Architecture:** Keep the six-layer runtime and existing plugin implementations unchanged. README is the user-facing overview and copyable entry prompt; DEPLOY_FOR_BOT is the single staged installation guide; CURRENT_RULES defines shared invariants and routes to module contracts. Historical changes belong in CHANGELOG, not appended operating instructions.

**Tech Stack:** Markdown, existing Python package metadata and release manifests.

**Spec:** [Approved direction](../../CORE_PLUGINS_PROPOSAL.md). User approved the proposed sequence on 2026-11-11 and requested a stop/report after each block. This plan covers block 1 only.

## Constraints and decisions

- Preserve README's two requested main parts and detailed instructions in the linked deployment guide.
- Preserve six layers, existing plugin opt-ins, native data formats and private/public separation.
- No adapter implementation, database migration, production Muse edits or task changes.
- Publish Kit 0.15.1 as documentation/package metadata only; runtime stays 2.11.1 and all plugin/frontend versions stay unchanged.
- A public documentation release does not claim a live deployment. Private architecture locks continue to identify the actually installed code.
- No new tests that mirror prose. Use one final link/metadata audit plus the existing isolated acceptance and wheel checks; fix only specific failures.

## Task 1: Current entrypoints and catalogue

- [x] Replace accumulated AGENTS and DEPLOY_FOR_BOT release prefixes with current instructions.
- [x] Preserve the complete 25-step deployment detail in DEPLOY_FOR_BOT, reduce README to a useful copyable navigator, and add docs/README and CURRENT_RULES.
- [x] Update CAPABILITIES with actual delivery type, host prerequisites, limitations and source links; distinguish code availability from binding/delivery evidence.

## Task 2: Retire conflicting general instructions

- [x] Refresh SYSTEM_REPLICATION, ARCHITECTURE, DEPLOY_MUSE_DOT and INHERITANCE to route to current module contracts, removing obsolete double-prepare and hardcoded older plugin instructions.
- [x] Add CHANGELOG containing historical outcomes rather than old executable recipes; classify legacy/release/plan documents as reference only.
- [x] Mark the pluginization roadmap approved in stages, not already implemented; clarify release-versus-deployment reporting in MAINTENANCE.

## Task 3: Publish and stop

- [x] Update package version, provenance and release manifest without changing runtime/plugin code.
- [x] Check local Markdown targets, version/manifest metadata, scope of the diff, current protocol wording and sensitive-data boundaries.
- [x] Run one isolated acceptance pass and wheel check; use one final independent review of this documentation change.
Publication transaction: publish through the authorized GitHub connection and independently verify the remote commit; that commit is the publication receipt.
Post-publication report: state the completed block and live-version boundary, then stop before block 2.

## Review focus

- A fresh Agent must reach current detailed instructions without reading historical plans.
- An upgrading/inheriting Agent must not blindly reinstall an old plugin, reinitialize live data or replay sends.
- Catalogue delivery labels must not promise complete bookkeeping source, universal host hooks or implemented video providers.
- Format, identity, health and financial-data constraints must survive the shortening.
- Package release and actual Muse/private-vault deployment must remain distinguishable.

## Execution notes

- First audit: 143 local Markdown links and 23 manifest entries passed; README retains two main parts and the detailed guide retains six phases / 25 steps.
- Independent read-only review found no blocking issue; runtime, plugins and frontend unchanged.
- First 331-case acceptance pass exposed one release-metadata mismatch: vault export still labelled architecture 0.15.0 after package bump. Update only that literal to 0.15.1, then rerun the affected case and finish the not-yet-run baseline/Node suites. One unrelated test was skipped by its existing condition.
- Ruling: no additional behavioral refactor or new tests; the existing snapshot-version assertion covers this omission. Recheck the installed wheel after the metadata fix.
- Final result: focused snapshot-version case passed, remaining baseline and 13 Node tests passed, rebuilt wheel accepted outside the checkout. No runtime/plugin/frontend behavior change. Public commit verification follows publication.
