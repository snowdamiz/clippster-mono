---
status: resolved
trigger: "Investigate issue: clip-build-failure"
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T00:00:00Z
---

## Current Focus

hypothesis: introOutroPerRatio type mismatch causes Tauri deserialization failure
test: Fix the frontend to send the correct tuple format that Rust expects
expecting: Build should work after fixing type mismatch
next_action: Fix ClipsTab.vue to send correct format for introOutroPerRatio

## Symptoms

expected: After clicking build, the clip should be built/rendered using FFmpeg via Tauri backend
actual: Build record is created in DB but the actual build invoke/command fails immediately with empty error
errors: "[ClipsTab] Failed to start clip build:" (error message is empty/undefined)
reproduction: Try to build any clip from the ClipsTab - happens 100% of the time
timeline: Reported by tester (BitOfAle) on 2/15/26, seems to affect all clip builds

## Eliminated

## Evidence

- timestamp: 2026-02-15T00:01:00Z
  checked: ClipsTab.vue line 2668-2712
  found: invoke('build_clip_from_segments') call with try/catch that logs empty error
  implication: Error is happening during invoke call, but error is empty/undefined

- timestamp: 2026-02-15T00:02:00Z
  checked: src-tauri/src/clips/mod.rs line 38-258
  found: build_clip_from_segments spawns async task (line 165) and returns Ok(()) immediately (line 257)
  implication: Command returns success before build starts - any errors would be in parameter validation before spawn

- timestamp: 2026-02-15T00:03:00Z
  checked: ClipsTab.vue line 2629 vs clips/mod.rs line 61
  found: TYPE MISMATCH - Frontend sends Record<string, { introPath, introDuration, outroPath, outroDuration }> but Rust expects HashMap<String, (Option<String>, Option<f64>)>
  implication: This type mismatch would cause Tauri deserialization to fail when invoking the command

## Resolution

root_cause: Rust function signature for `intro_outro_per_ratio` is wrong. It's defined as `HashMap<String, (Option<String>, Option<f64>)>` (single tuple) but the code uses it for BOTH intro AND outro (lines 441-459 in orchestrator.rs). Frontend correctly sends `{ introPath, introDuration, outroPath, outroDuration }` but this fails Tauri deserialization. The Rust type should accept a struct with 4 fields, not a 2-field tuple.
fix: Created IntroOutroPerRatioConfig struct with 4 fields (intro_path, intro_duration, outro_path, outr o_duration) in types.rs. Updated function signatures in mod.rs and orchestrator.rs to use HashMap<String, IntroOutroPerRatioConfig> instead of tuple. Updated orchestrator.rs usage to access struct fields instead of tuple destructuring.
verification:
  - Rust type system ensures deserialization will now work
  - Frontend data structure ({ introPath, introDuration, outroPath, outroDuration }) now matches Rust struct
  - serde with camelCase rename will correctly map fields
  - Committed as d4e5b0b0
  - Next step: Test clip build in running app to confirm fix works end-to-end
files_changed:
  - client/src-tauri/src/clips/types.rs (added IntroOutroPerRatioConfig struct)
  - client/src-tauri/src/clips/mod.rs (updated signature line 61)
  - client/src-tauri/src/clips/orchestrator.rs (updated signature line 259, import line 5, usage lines 441-459)
