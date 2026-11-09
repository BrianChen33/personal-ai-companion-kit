# Companion home preview

A small Three.js cutaway room that presents existing companion state. The
character is an explicitly configured private GLB. Core Python installations
continue using the existing offline panel until a host adapter is deployed.

See [the protocol and actual delivery stage](../../docs/HOME_SPACE.md).

```sh
npm ci
npm test
npm run build
```

Serve `dist` through an authenticated host with same-origin `home-config.json`
and `state.json`. Keep private assets and state outside the public checkout.
The host is responsible for access control, ordering and publication.
Optional `referenceViews.front`, `.side` and `.back` URLs show the corresponding
original drawing beside the model when a review angle is selected. These assets
must use the same private access controls as the model.

The current source is the reference-review phase. The eight card destinations
provide bounded previews. Full existing detail parity, original stickers,
mixed-expression blending and native Space state transport are deployment work.

The initial transfer target is 3 MB. Active animation is capped at 30 fps and
hidden tabs pause GPU work. Reduced-motion mode still displays current state.
Synthetic controls appear only with `preview=true` and remain in browser memory.


Frontend0.2.8 adds a three-tab reading detail and a deeper open-ended sofa.
Lower seat tops and contact morphs support loose clothing and hair above the
seat, retaining torso/head proportions and hanging feet. The old knee morph is removed. Keep the existing binary loader, private model and state bindings.
The host ports reading.mjs into its real UI and installs social-reading0.4.1 for
actual-time continuation expiry. Read HOME_SPACE and READING_QUEUE for deployment.
