# Instant Edit architecture

Instant Edit follows TikTok Studio AutoCut's documented choose-template workflow and BytePlus Magic Template's `CutSameSource` / mutable material model, but uses only Clippster-owned schemas, assets, heuristics, and renderers. It does not read proprietary CapCut/TikTok packages or claim ranking equivalence.

## Canonical graphs

- Desktop compiles a template into normal OpenCut `TProject` scenes, tracks, and timeline elements.
- Android compiles the supported subset into the existing `MobileEditProjectV3`.
- The portable `@clippster/template-schema` manifest is a contract, not a fourth timeline.
- iOS compatibility remains false until its render/export matrix is validated.

## Lifecycle

1. Load an immutable built-in or validated local definition.
2. Analyze template slots and source candidates once.
3. AutoFill returns deterministic bindings, alternatives, scores, and reason codes.
4. Preflight validates required slots, media types/ranges, aspect ratio, and platform capability.
5. Compile an isolated draft with remapped runtime IDs and stable `templateSlotId` provenance.
6. Commit the draft atomically as one undoable composition replacement.
7. Save, reopen, edit, replace media, and export through the normal platform graph.

This mirrors BytePlus's separation between `prepareSource`, `composeSource`, `preparePlay`, slot updates, and export while preserving Clippster's project model.

## Invariants

- Definitions are deep-frozen and versioned; instances record definition/compiler/analyzer versions.
- Bindings use stable logical slot IDs, never array indexes or runtime UUIDs.
- Project Workspace always creates a new project for Instant Edit.
- Applying inside an editor requires confirmation and is one undo step.
- Final exports use existing desktop or Android exporters and source media.
- Templates are declarative and cannot contain code, commands, FFmpeg arguments, or native plugins.
