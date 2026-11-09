# Interactive home space implementation plan

> **For agentic workers** Use superpowers:executing-plans to implement this approved plan inline. Track the checkboxes and run one assembled isolated acceptance phase.

**Goal** Deliver a private interactive 3D home driven by existing companion state, with an owner-reviewed reference-matched character.

**Architecture** The existing SQLite remains authoritative. A small read-only projection feeds a privately authenticated Space. The browser renders the room and animation locally. Existing successful state commits schedule asynchronous publication and the existing emotion heartbeat reconciles it.

**Tech stack** Three.js, GLB, a small Vite vanilla JavaScript application, existing Python runtime and verified native Space capabilities.

**Spec** The owner's approved plan in this conversation. Preserve the home, original sticker access, eight compact cards, phone layout, full details and the six-layer architecture. Character appearance is reviewed against the private three-view sheet before live migration.

## Global constraints

- Private character assets, reference art, native state, account bindings and credentials stay outside public source.
- Browser animation and status reads add no model calls to ordinary conversation.
- A visible page reads immediately and checks every 30 seconds. Hidden pages pause.
- Use short responses and a bounded state payload. Keep actual source and publication timestamps.
- Display only released activity stages. Missing and stale state stay explicit.
- The initial transferred asset budget targets 3 MB and phone animation targets 30 fps.
- Keep existing 15-minute feedback and 30-minute life task identities.
- One final isolated suite and desktop/375px interaction pass after assembly.
- Model approval precedes final asset deployment. Source and code locks are synchronized on deployment.

## Review focus

- Authenticated HTML with anonymously reachable private JSON or assets is insufficient.
- Out-of-order background publication must not replace a newer revision.
- End times alone cannot establish a completed activity or release sealed story content.
- Dragging the canvas must preserve mobile vertical scrolling and accessible detail controls.
- A broken model, lost WebGL context or stale connection must leave real status and details usable.

## Tasks

- [x] Verify documented native Space schema, private access and server-side state transport through the debug sidechat. Binary asset ingestion and actual WebGL execution remain host acceptance items.
- [ ] Create `web/companion-home` with `package.json`, `index.html`, `src/state.mjs`, `src/room.mjs`, `src/main.mjs` and `src/style.css`. `derivePresentation(snapshot, now)` maps existing data to browser animation. `createRoom(element, options)` exposes `setState`, `resetView` and `dispose`.
- [ ] Create the reference-matched character as a private GLB with named pose groups and reusable animation clips. Render front, side and back for the owner, alongside an interactive room preview. Record actual byte size and model limits.
- [ ] After reference approval, implement the verified Space adapter, bounded projection, revision-aware publication and existing post-commit/heartbeat wiring. Authenticated reads use the same source revision as details. Data publication is asynchronous and bounded.
- [ ] Integrate the eight cards, original sticker access, current timestamps, responsive detail dialogs and local static fallback. Migrate the regular entry to the Space after acceptance. Offline HTML becomes an explicit export.
- [ ] Run assembled isolated Python/Node/wheel verification once and focused desktop/mobile UI checks. Publish canonical code/docs/provenance, verify remote SHA, deploy and update the private vault architecture lock.

## Ledger

- Execution approved by the owner. Existing clean linked worktree reused on `feat/interactive-home-space`, base `08ac3f4` whose three CI jobs passed.
- The portable frontend and private character preview can proceed while Muse reads Space capabilities. The live publication adapter depends on that evidence.
- Public code contains a generic room and asset interface. The actual companion model and reference-derived generator are private deployment assets.
- Capability ruling after actual host schema readback. Muse has declared fullstack actions but no documented direct VM push, SDK or post-final hook. The existing 15-minute background turn can invoke an action. The owner explicitly chose faster synchronization and accepts additional development/runtime cost. A faster authenticated publication path remains to be verified.
- A private GLB draft is 658,636 bytes, 128 meshes and 50,108 triangles. Geometry buffers are shared. Offline preview is approximately 1.73 MB, including the engine, model and original reference.
- One narrow review found replacement-string interpolation in export, reduced-motion state updates and reference-camera controls. All three were fixed in one pass. The broken export was reproduced and the repaired inline module parses successfully.
- Chrome's viewport override did not change the reported innerWidth. Mobile layout is checked through a private same-origin 375px iframe viewport. Literal file-URL browser automation is blocked, so local HTTP UI and generated-file syntax are verified separately.
- The owner rejected the procedural character's likeness. It remains only a development placeholder. Prepared original front/side/back crops with explicit permission and kept them outside the public checkout. fal is connected, but its upload returned a non-retryable balance_exhausted billing block. No generation submitted. Resume billing checks only after top-up confirmation.
- Added an optional original-view comparison alongside front/side/back model views. This is review UI only. Production deployment and public source publication remain gated on appearance approval and assembled acceptance.
- The owner chose Tencent's official web generator as a free alternative and completed login/terms personally. Actual account quota is 5 daily generations. The first original-three-view draft had two tails. Ruling: use the original front and side views for a corrective generation, with the back drawing retained for inspection, because the sheet draws the tail on the same screen side in both front and rear views. The second free draft has one tail on rear inspection. Both attempts are recorded privately. Current draft is 48,912,376 bytes, 497,254 triangles, 333,554 vertices and no skeleton/animation. Owner appearance review, asset optimization and animation remain pending. No paid generation submitted.
- A textured GLB exposed the local preview CSP's missing `connect-src blob:` allowance. Embedded texture decoding works after adding only the local blob scheme. Offline export needs both `img-src blob:` and `connect-src blob:`. Side-reference images also exposed an intrinsic-height grid expansion, corrected with a bounded room-height row. Focused build and visual checks passed, assembled acceptance is still pending.
- Owner approved the second draft's appearance and requested compression, then identified an existing torso gap and requested spherical hands. Confirmed the gap exists in the uncompressed source. Added private closed fitted torso/neck volumes and two small round palm volumes at measured hand locations, preserving the original accepted source for authoring. New render asset uses 2048px WebP and Meshopt, approximately 2.17 MB versus 48.91 MB. Portable loader uses Three.js's bundled Meshopt decoder with the narrow WASM CSP allowance. Geometry repair checks and focused browser review accompany compression. Native rigging, Space transport, full detail parity and final architecture publication remain pending.

- Added a hammock at owner request. Phone and sleep use the same resting place, with a phone holder for unrigged models. Room details add curtains, entry/slippers, lamp, whale print and low-cost greenery. Current GLB supports whole-body placement only.
- Ruling: use a private Space file picker plus authenticated JSON chunk storage for GLB ingestion; validate once on the actual host rather than infer a missing upload parameter means no support. Native Space trial is underway.
- Added opt-in home_space marker/capture/probe/ack and a generic native hook script. Normal replies do only small file IO; the background worker builds one bounded canonical snapshot without static artwork. Snapshot uses an explicit SQLite read transaction. Unknown outdoor locations do not render the character indoors.
- Final source acceptance:315 repository cases (one platform skip), one stale vault version assertion fixed and13 targeted cases rerun;208 runtime cases (one platform skip),13 adapter cases,5 frontend cases and Vite build pass. Wheel installed outside checkout. One final reviewer findings corrected. Native deployment acceptance remains pending.

- Owner visual revision0.13.1 widens the room, isolates hammock and plant stations, adds a generated garden texture, embeds reference-derived expression atlas in the private GLB and adds measured hand/tail morphs. One narrow review fixed ImageBitmap Y convention and optional texture lifecycle.523 Python cases(2 platform skips),13 Node adapter cases,7 frontend cases, build and wheel passed. Native Space upload and migration acceptance still pending.
