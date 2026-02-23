# Lessons Learned

## 2026-02-23 - Partial Fix Follow-Through
- Pattern observed: resolving the primary failure mode (freeze) did not guarantee smooth post-action behavior (resize then drag jitter on macOS).
- Preventive rule:
  - For window-management bugs, validate the full interaction chain, not only the initial failure point.
  - Specifically test: resize in/out, release, immediate drag, repeated drag cycles, and maximize/restore transitions.

## 2026-02-23 - AI Video Generator UX Gatekeeping
- Pattern observed: hard-coded UI heuristics (keyword-based "generate" triggers, fallback buttons, unscoped accent colors, and local-only draft state) drift from the intended LLM-led conversation flow and degrade UX.
- Preventive rule:
  - Do not hard-code intent parsing for generation when backend emits readiness metadata; consume the model's readiness signal as the source of truth.
  - Keep in-progress user input in parent/shared state when child panels can unmount/remount.
  - Audit feature-specific color tokens for consistency with the product accent before shipping UI updates.

## 2026-02-23 - AI Chat Media UX Overreach
- Pattern observed: consolidating media into chat succeeded functionally, but the first pass still over-exposed controls (large media control block + manual tagging interactions) instead of prioritizing a minimal composer workflow.
- Preventive rule:
  - For chat-first UX, default media intake to a single composer-adjacent icon action; avoid large persistent tool surfaces unless explicitly requested.
  - Prefer automatic AI mapping/tag inference from scene plans and media requests; do not require user tagging unless the user explicitly asks for manual control.

## 2026-02-23 - UX Flow Drift After Refactors
- Pattern observed: after rapid AI video UX refactors, stale shell UI elements and helper affordances (chat header count row, standalone Add Reference text row) no longer matched the intended composer-centric flow.
- Preventive rule:
  - After every flow refactor, run an explicit "stale UX sweep" for legacy labels, headers, and secondary controls that duplicate or contradict the new entry points.
  - Keep media/reference actions colocated in one composer control cluster and represent counters as compact badges rather than separate header chrome.

## 2026-02-23 - Nested Dialog Stacking in Full-Screen Overlays
- Pattern observed: dialogs opened from inside high z-index full-screen overlays can silently render behind the parent layer when relying on default dialog `z-50`.
- Preventive rule:
  - When launching shared/ported dialogs from overlay surfaces, explicitly validate and set dialog z-index above the parent overlay z-index.
  - Add a quick visual smoke check for all dialog entry points (open + close) after introducing new in-overlay modal triggers.

## 2026-02-23 - Manual Open vs DialogTrigger
- Pattern observed: manually flipping `v-model` open state from a plain button can produce unreliable modal behavior in Reka/Radix dialog flows inside complex overlays.
- Preventive rule:
  - Prefer `DialogTrigger as-child` for user-initiated opens instead of custom click/state toggles.
  - If custom control is required, verify no same-event open/close race by smoke-testing with repeated clicks.

## 2026-02-23 - Portal Modal Fallback in Overlay Stacks
- Pattern observed: even with trigger alignment and z-index tuning, some nested full-screen overlay paths can still fail to present shared-portal dialog content reliably.
- Preventive rule:
  - For critical in-flow actions inside custom full-screen overlays, keep a direct `Teleport` modal fallback pattern available.
  - If modal visibility remains flaky after one trigger + z-index pass, switch to local teleported modal implementation quickly instead of extending speculative portal tuning.

## 2026-02-23 - Match Existing Dialog Language
- Pattern observed: functional fixes can still miss product consistency if new modal styling deviates from established dialog patterns.
- Preventive rule:
  - Before finalizing a new modal, compare against at least one canonical in-app dialog and align container/header/input/footer token usage.
  - Prefer reusing the app’s established dialog visual primitives (surface, border, accent, button/input states) over inventing feature-specific styling.

## 2026-02-23 - Third-Party API Response Structure Changes
- Pattern observed: Kick changed their `api.kick.com/private/v1/channels/{slug}` response structure, moving `username` and `profile_picture` under `data.account.user` instead of `data` root. This silently broke avatar loading across Live page, VOD page, and Creator Profiles.
- Preventive rule:
  - When parsing third-party API responses, always log the raw response body (truncated) for debugging. The Rust code already did this, which made diagnosis fast.
  - Use defensive multi-path JSON parsing with fallback chains (try new path first, fall back to old paths).
  - For critical third-party integrations, consider adding a periodic health check that validates expected response fields are present.
