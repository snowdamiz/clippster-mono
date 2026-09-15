# Video template schema reference

The runtime source of truth is `packages/template-schema/src/types.ts`; validation is in `validation.ts`.

## Manifest

`schemaVersion`, `id`, `versionId`, and semantic `version` identify an immutable definition. `kind` is `style`, `montage`, or `hybrid`. Duration, rational FPS, aspect ratios, minimum app version, required capabilities, visibility, author, rights, accessibility, and per-platform compatibility are mandatory.

Unknown future major schema versions are rejected. Supported inputs are cloned before deterministic migration so imported source data is never changed.

## Presentation blueprint

`presentation` defines the editable first-party treatment shared by desktop and Android: transition and rational duration, color treatment, bounded renderer-safe effect/intensity, motion policy, accent color, and title text/style/position/duration. Compilers translate this declarative subset into ordinary platform timeline transitions, effect stacks, transforms, and text tracks; packages cannot supply executable effects or FFmpeg arguments.

## Slots

Slots declare stable IDs, media/text/audio type, semantic role, required state, MIME/orientation and duration constraints, rational target start/duration, reuse/group rules, crop/focal and source-audio policy, trim/speed/reverse/loop behavior, mutable and locked property lists, fallback behavior, and logical blueprint bindings.

Runtime elements retain `templateSlotId` plus template/version/logical-element provenance after UUID remapping.

## Anchors

Anchors use integer rational time (`value / timescale`) and identify beats, downbeats, cuts, lyrics, effects, or custom events. Confidence, analyzer version, manual correction, timing policy, and target elements are preserved.

## Assets and rights

Assets use logical IDs, SHA-256, byte size, byte-detected MIME, safe relative content-addressed paths, fallback policy, and rights evidence. Rights include holder, license expression, proof, attribution, commercial/redistribution permission, restrictions, expiry, and AI disclosure.

## Instances and analysis

Instance provenance stores template/version, compiler/analyzer version, deterministic seed, source hashes, exact source ranges, assignment scores/reasons, locks, and creation time. Beat maps are keyed by source fingerprint and analyzer version.
