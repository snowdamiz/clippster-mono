# Creating a video template

Template authoring uses the normal editor graph; never hand-edit a production manifest.

1. Build and test a normal OpenCut composition.
2. Mark replaceable elements and give each a stable semantic slot ID.
3. Define accepted media, target/source duration, reuse, crop/focal, source-audio, mutable-property, and fallback policies.
4. Add aspect variants, safe zones, reduced-motion behavior, and no-flash limits.
5. Classify every remaining asset as redistributable, built-in reference, preview-only, or omitted.
6. Record rights holder, license, proof, attribution, commercial/platform/territory scope, and expiry.
7. Test the extracted definition with at least two materially different media sets.
8. Validate preview/export frame and audio alignment on desktop and Android.
9. Save as a new immutable version. Never overwrite a published or built-in version.

The current first-party definitions are created through the typed catalog factory in `packages/template-schema/src/catalog.ts`. A visual “Save as Template” wizard remains the preferred extension point: it should call the same validator/compiler and must not mutate the source project.
