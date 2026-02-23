# Task Plan - macOS Tauri resize/drag stability

## Objective
Fix macOS-specific window interaction instability in the Tauri app:
- freeze on resize release (initial issue, now mitigated),
- stutter/glitch while dragging after a resize (current issue).

## Plan
- [ ] Reproduce the issue and capture concrete trigger conditions and logs.
- [ ] Reproduce and characterize the new post-resize drag jitter (timing, frequency, event patterns).
- [x] Trace frontend resize handlers (`window`, `ResizeObserver`, layout/timeline/editor redraw paths) for blocking operations.
- [x] Trace Tauri/Rust/macOS window event handling for post-resize deadlock, sync IPC loops, or heavy callbacks.
- [x] Implement the minimal root-cause fix with macOS-safe behavior.
- [x] Implement fix for post-resize drag jitter with minimal side effects.
- [ ] Verify locally (typecheck/tests/build/run smoke) and confirm no regression in resize behavior.
- [ ] Verify manual macOS interaction chain: resize -> release -> drag -> repeat.
- [x] Update bug report with findings, failed hypotheses, final fix, and validation evidence.

## Review
- Root-cause candidate addressed: titlebar resize listener was issuing unbounded `isMaximized()` IPC calls on every resize event.
- Fix implemented in `client/src/components/TitleBar.vue`:
  - switched to `onResized`,
  - debounced state sync,
  - in-flight/queue guard,
  - unlisten + timeout cleanup on unmount.
- Validation:
  - `yarn --cwd client prettier --check src/components/TitleBar.vue` passed.
  - `yarn --cwd client vue-tsc --noEmit` failed due existing missing `@tiptap/*` modules in admin pages.
  - `yarn --cwd client build:ci` failed for the same existing dependency issue.
- Remaining verification gap:
  - manual macOS runtime resize test still needed to confirm freeze is resolved end-to-end.
- Second-pass jitter mitigation:
  - macOS now skips resize-driven maximize-state polling to avoid resize->drag contention.
- Additional deep-trace finding:
  - no main-window `setPosition` / `setSize` feedback loop found in frontend or Rust.
- Current remaining gap:
  - manual macOS runtime validation needed to confirm drag jitter is eliminated.
