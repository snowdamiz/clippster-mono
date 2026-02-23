# macOS Resize Freeze Bug Investigation

## Bug Summary

- Symptom: On macOS, the Tauri app freezes immediately after stopping window resize interaction (mouse release after resize).
- Scope: Reproduces in both development and production.
- Reported by: user
- Update (user retest): freeze is resolved, but window dragging becomes stuttery/glitchy after resizing.

## Investigation Log

### 2026-02-23 - Start

- Created debugging plan in `.cadence/tasks/todo.md`.
- Next: reproduce and inspect resize event flows in frontend + Tauri Rust layer.

### 2026-02-23 - Event Trace Findings

- Identified always-on listener in `client/src/components/TitleBar.vue`:
  - `appWindow.listen('tauri://resize', async () => { isMaximized.value = await appWindow.isMaximized(); })`
- This path issues an async Tauri IPC call (`isMaximized`) on every resize tick with no throttling and no unlisten cleanup.
- Risk profile:
  - During live resize on macOS, resize events are high-frequency.
  - Unbounded `isMaximized()` roundtrips can flood the event loop/IPC queue.
  - Freeze on resize release is consistent with backlog/deadlock behavior.

### 2026-02-23 - Patch 1

- Replaced legacy `tauri://resize` listener with `appWindow.onResized`.
- Added bounded sync logic:
  - debounced scheduling (`120ms`) during active resize,
  - in-flight guard + queued follow-up update (prevents concurrent `isMaximized` calls),
  - explicit `onUnmounted` cleanup for both timeout and unlisten function,
  - explicit `!== null` timeout-handle guards for deterministic timer cleanup.
- File changed: `client/src/components/TitleBar.vue`.

### 2026-02-23 - Verification

- Formatting check:
  - `yarn --cwd client prettier --check src/components/TitleBar.vue` -> pass.
- Project type/build checks currently fail due existing dependency issues unrelated to this fix:
  - missing `@tiptap/*` imports referenced by admin pages.
  - observed in:
    - `yarn --cwd client vue-tsc --noEmit`
    - `yarn --cwd client build:ci`
- Manual resize freeze verification on macOS GUI still required.

### 2026-02-23 - User Retest Feedback

- User confirmed freeze behavior is no longer present.
- Remaining issue: after resizing, dragging the window is jittery/fighty.
- Next focus: inspect resize/move/maximize event interplay and any post-resize asynchronous window polling that may interfere with drag smoothness.

### 2026-02-23 - Deep Dive (Drag Jitter)

- Checked for manual window position/size writes on main window path:
  - no frontend `setPosition()`/`onMoved()` usage for main window.
  - no Rust `set_position`/`set_size` loop for main window (only PIP window positioning path exists).
- Confirmed active titlebar behavior still performed maximize-state polling on resize events.
- Since symptom is macOS-specific and tied to resize->drag sequence, resize-driven polling remained highest-probability contributor.

### 2026-02-23 - Patch 2

- Added macOS-specific guard in `client/src/components/TitleBar.vue`:
  - skip `onResized` maximize-state polling on macOS,
  - keep resize-driven maximize sync only on non-macOS platforms.
- Rationale:
  - avoids any post-resize window IPC polling during drag flows on macOS,
  - preserves existing maximize-state sync behavior for Linux/Windows.
- Validation:
  - `yarn --cwd client prettier --check src/components/TitleBar.vue` -> pass.

## Hypotheses

- Primary root cause: unbounded maximize-state IPC calls triggered by resize events on macOS.
- Secondary contributing factor: missing listener cleanup could multiply callbacks if component lifecycle changes in future.
- New active hypothesis: post-resize maximize-state synchronization (or another move/size feedback loop) is still introducing enough work during drag to cause visible stutter.

## Solutions Tried

- Patch 1: Bound and cleaned up maximize-state sync in titlebar resize handling.
- Patch 2: Disabled resize-driven maximize-state polling on macOS to remove resize->drag interference.

## Current Status

- Freeze fixed; drag-jitter Patch 2 applied and awaiting macOS retest.
