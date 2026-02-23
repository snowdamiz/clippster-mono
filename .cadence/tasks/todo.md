# Task Plan - AI Video Editor Black Preview (Unicode path encoding)

## Objective
Fix AI video preview rendering when generated media paths contain non-Latin1/Unicode characters, which currently causes Remotion preview to render black.

## Plan
- [x] Reproduce and confirm root cause from current failing path evidence.
- [x] Trace AI preview media/audio URL generation and backend decode path.
- [x] Implement UTF-8-safe and URL-safe path encoding in Remotion media URL helpers.
- [x] Update Rust `/video/:path` decoding to accept URL-safe and padded/unpadded base64 variants.
- [x] Verify no regressions in related path decoding code paths (waveform/local path extraction).
- [x] Run targeted formatting/type/build checks on changed files and report any blockers.
- [x] Update bug log with final fix details and verification evidence.

## Review
- Implemented `utf8ToBase64Url()` plus URL-safe tolerant `base64ToUtf8()` in `client/src/utils/encoding.ts`.
- Replaced Remotion preview `btoa(path)` usage with UTF-8 + URL-safe encoding in:
  - `client/src/remotion/components/MediaClip.tsx`
  - `client/src/remotion/components/AudioTrack.tsx`
- Updated Rust decode compatibility:
  - `client/src-tauri/src/video_server.rs` (`/video` HEAD + GET now decode URL-safe/standard, padded/unpadded variants)
  - `client/src-tauri/src/waveform.rs` (`extract_local_path_from_url` now decodes URL-safe/standard variants)
- Updated dependent frontend decode paths to avoid regressions when consuming URL-safe `/video` URLs:
  - `client/src/services/waveformService.ts`
  - `client/src/editor/core/managers/renderer-manager.ts`
  - `client/src/editor/storage/tauri-storage-adapter.ts`
  - `client/src/services/video-editor-project-creator.ts`
- Verification:
  - `yarn --cwd client prettier --check ...` (changed files) reports existing style drift in touched files; no bulk reformatting was applied to keep this bugfix diff minimal.
  - `cd client/src-tauri && cargo check` passed.
  - `yarn --cwd client vue-tsc --noEmit` fails for pre-existing missing `@tiptap/*` admin dependencies (not introduced by this change).
  - UTF-8 + URL-safe base64 roundtrip test with the failing `\u202F` filename passed.

---

# Task Plan - AI Video Generator UX + Conversation Improvements

## Objective
Address the AI video generator issues in UI layout/theme, timeline visibility, chat draft persistence, and conversation/generation behavior so generation is driven by the LLM readiness signal instead of hard-coded phrase matching.

## Plan
- [x] Audit current AI video creator frontend and backend chat flow against the 7 reported issues.
- [x] Update AI video creator layout: make chat panel wider and hide timeline until a composition exists.
- [x] Replace purple accents in AI video creator/chat surfaces with the existing app blue accent.
- [x] Fix uploaded media title truncation in cards to prevent overflow.
- [x] Preserve unsent AI chat input text when switching between sidebar tabs.
- [x] Remove manual/fallback generate buttons and hard-coded generate intent regex; use only LLM `ready_to_generate` signal to trigger generation confirmation flow.
- [x] Improve discovery conversation prompt to be more conversational/deeper and ensure aspect ratio is explicitly resolved before `ready_to_generate`.
- [x] Run targeted verification (type/build checks on changed files) and update this file with a review summary and any residual risks.

## Review
- Frontend behavior changes:
  - `client/src/pages/AIVideoCreator.vue`
    - Wider AI chat panel via `aiv-sidebar--ai` layout class and updated panel widths.
    - Timeline now hidden until a composition exists (`v-if="composition"` on timeline container).
    - Uploaded media title now truncates reliably (`display: block`, `max-width: 100%`, and `title` tooltip).
    - Chat draft text now persists across tab toggles via parent-managed `chatDraftMessage`.
    - Removed regex-based generate trigger (`GENERATE_INTENT_PATTERNS`) and manual generate path.
    - Generation confirmation now appears when the latest assistant message has `ready_to_generate=true`.
  - `client/src/components/ai-video/AIChatPanel.vue`
    - Removed fallback/manual generate button UI.
    - Summary card no longer emits generate action.
    - Added `draftMessage` + `update:draft-message` contract for persisted input text.
    - Replaced purple accents with app blue tones.
  - `client/src/components/ai-video/ChatSummaryCard.vue`
    - Removed inline Generate button entirely.
    - Updated accent palette from purple to blue.
  - `client/src/components/ai-video/ChatMessage.vue`
    - Updated assistant/user accent palette from purple to blue.
- Backend conversation/gating changes:
  - `server/lib/clippster_server/ai/chat_composer.ex`
    - Discovery prompt now enforces one focused question per turn, deeper message discovery, and explicit aspect-ratio resolution prior to readiness.
    - Added readiness guard: if AI returns `ready_to_generate=true` without required summary fields (`description`, `style`, `duration`, `aspectRatio`, `scenes`), readiness is forced to `false`.
  - `server/lib/clippster_server_web/controllers/ai_chat_controller.ex`
    - Updated initial greeting to one concise question for a more conversational start.
- Verification:
  - `yarn --cwd client prettier --check src/pages/AIVideoCreator.vue src/components/ai-video/AIChatPanel.vue src/components/ai-video/ChatSummaryCard.vue src/components/ai-video/ChatMessage.vue` passed.
  - `cd server && mix format --check-formatted lib/clippster_server/ai/chat_composer.ex lib/clippster_server_web/controllers/ai_chat_controller.ex` passed.
  - `cd server && mix compile` passed.
  - `yarn --cwd client vue-tsc --noEmit` fails on pre-existing missing `@tiptap/*` admin dependencies (not introduced by this change).
  - `yarn --cwd client build:ci` fails for the same pre-existing unresolved `@tiptap/vue-3` imports in admin pages.

---

# Task Plan - AI Video Creator Media-in-Chat Refactor

## Objective
Refactor the AI Video Creator so media selection/upload lives inside the chat flow, including assistant-driven media requests and media-to-part tagging that the assistant can understand.

## Plan
- [x] Remove split media/chat tabs and keep a single AI chat panel with integrated media controls.
- [x] Add dedicated media upload controls inside chat (Upload, Clips, Assets) and keep existing picker/upload behavior.
- [x] Surface uploaded media inside chat with remove + part tagging controls.
- [x] Support assistant-requested media prompts in chat (message metadata-driven) and show inline media action buttons when requested.
- [x] Persist media-part tags in session media payload and include tagged context for assistant reasoning.
- [x] Update backend discovery prompt/metadata handling to emit and store structured media request metadata.
- [x] Auto-apply media tags from assistant scene plans (when media names are referenced) and sync them back to session.
- [x] Run targeted formatting/checks, then document results and residual risks in the Review section.

## Review
- Frontend UI refactor:
  - `client/src/pages/AIVideoCreator.vue`
    - Removed the separate Media/AI tab flow and converted the sidebar to a single unified chat workspace.
    - Integrated media management through chat via new `AIChatPanel` props/events.
    - Added media-part tagging support (`intendedParts`) and auto-tagging from assistant scene summaries.
    - Added responsive layout rules so chat/media flow remains usable on smaller widths.
  - `client/src/components/ai-video/AIChatPanel.vue`
    - Added a dedicated media toolbar in chat (`Upload Media`, `Clips`, `Assets`).
    - Added in-chat media list/cards with remove controls, transcript/transcribing indicators, suggested part tags, and custom part-tag input.
    - Added inline assistant media-request cards that render upload/select action buttons directly in the conversation when metadata includes `media_request`.
  - `client/src/types/ai-video.ts`
    - Added `intendedParts?: string[]` on `AIVideoMediaItem`.
    - Added `MediaRequest` type and optional `media_request` on `ChatResponse`.
- Backend assistant/context refactor:
  - `server/lib/clippster_server/ai/chat_composer.ex`
    - Extended discovery prompt contract so assistant can emit structured `media_request` metadata when additional media is needed.
    - Normalized `media_request` server-side and persisted it in assistant message metadata.
    - Prevented contradictory states (`ready_to_generate=true` now clears `media_request`).
    - Added media intended-part context to discovery and generation prompts.
  - `server/lib/clippster_server_web/controllers/ai_chat_controller.ex`
    - Updated initial greeting to include media onboarding context and seeded `media_request: nil` metadata.
- Verification:
  - `yarn --cwd client prettier --check src/pages/AIVideoCreator.vue src/components/ai-video/AIChatPanel.vue src/types/ai-video.ts` passed.
  - `yarn --cwd client vue-tsc --noEmit` failed only on pre-existing missing `@tiptap/*` admin dependencies and existing implicit `any` in those admin files; no new type errors remain in changed AI video files.
  - `cd server && mix format --check-formatted lib/clippster_server/ai/chat_composer.ex lib/clippster_server_web/controllers/ai_chat_controller.ex` passed.
  - `cd server && mix compile` passed.
- Residual risks:
  - Assistant media-request behavior depends on LLM adherence to the updated JSON contract (`media_request`), so quality can vary by prompt/model behavior.
  - Auto-tagging from summary scene `mediaNames` uses filename matching heuristics and may miss edge cases when names diverge significantly.

---

# Task Plan - AI Chat Media UX Simplification + Self-Tagging

## Objective
Simplify AI video chat media UX to a single icon button near the chat input and remove user-required manual media tagging by making AI/self-tag inference automatic.

## Plan
- [x] Remove the large project media action block from chat and replace it with one icon-based media entry button in the composer area.
- [x] Keep media source options (Upload/Clips/Assets) available behind the single icon button.
- [x] Remove manual media tag editing controls from chat UI.
- [x] Strengthen automatic media tag inference so media receives intended-part tags from assistant scene plans and media requests without user action.
- [x] Update backend discovery prompt guidance to explicitly avoid asking users to manually tag media and prefer automatic inference/mapping.
- [x] Run targeted formatting/type/compile checks and document review notes.

## Review
- Frontend simplification:
  - `client/src/components/ai-video/AIChatPanel.vue`
    - Removed the large “Project Media” control surface.
    - Added a single icon-based media entry button (`paperclip`) next to the chat textbox.
    - Added compact media source menu (Upload Files, Select Clips, Select Assets) behind that icon.
    - Removed manual media-tag editing UX (no user tag toggles/suggestion chips/custom tag input).
    - Kept assistant-driven in-chat media-request cards so upload/select actions still appear inline when AI asks for media.
    - Added compact read-only media pills that display inferred tag state (“AI will tag” until mapped).
  - `client/src/pages/AIVideoCreator.vue`
    - Removed now-unused manual tag wiring to chat panel.
    - Strengthened auto-tagging logic:
      - Explicit filename matching from assistant `summary.scenes[].mediaNames`.
      - Inference pass for untagged media using scene/media-request part pools + keyword heuristics + usage-balanced fallback assignment.
      - Auto-tagging now runs on relevant assistant-message and media-state changes without user action.
- Backend prompt guidance:
  - `server/lib/clippster_server/ai/chat_composer.ex`
    - Added discovery rule instructing the assistant not to ask users for manual media tagging, and to infer media-to-scene mapping directly.
- Verification:
  - `yarn --cwd client prettier --check src/components/ai-video/AIChatPanel.vue src/pages/AIVideoCreator.vue src/types/ai-video.ts` passed.
  - `cd server && mix format --check-formatted lib/clippster_server/ai/chat_composer.ex lib/clippster_server_web/controllers/ai_chat_controller.ex` passed.
  - `cd server && mix compile` passed.
  - `yarn --cwd client vue-tsc --noEmit` still fails only on pre-existing admin `@tiptap/*` missing modules and related implicit-any admin errors; no new AI-video typing regressions introduced by this update.


# Task Plan - AI Chat Header Removal + Reference Dialog Icon

## Objective
Align AI Video Creator chat UX with the latest behavior by removing the outdated chat header row, moving media count to an icon badge, and converting Add Reference into a matching icon button that opens a themed dialog.

## Plan
- [x] Remove the `AI Chat / media` header row from the AI sidebar shell and adjust spacing/layout.
- [x] Add a compact circular media-count badge on the composer media-upload icon button.
- [x] Replace bottom text `Add Reference` with a matching composer icon button beside media upload.
- [x] Implement themed reference dialog (same app dialog components) for entering and submitting reference URLs.
- [x] Run targeted checks (format + typecheck scope) and record review notes.
- [x] Add a lessons entry for this user correction so outdated UX assumptions are less likely to recur.

## Review
- Frontend UI updates:
  - `client/src/pages/AIVideoCreator.vue`
    - Removed the outdated `AI Chat / media` panel header entirely.
    - Cleaned unused header/count style rules tied to that removed block.
  - `client/src/components/ai-video/AIChatPanel.vue`
    - Added media count badge on the composer media icon button (`paperclip`) so count now lives beside upload action.
    - Added a second icon button next to media for references with matching visual style.
    - Removed legacy inline `Add Reference` row beneath the composer.
    - Implemented themed `Dialog` flow for reference URL input + analyze action.
    - Added dialog focus/close handling for cleaner UX.
- Verification:
  - `yarn --cwd client prettier --check src/pages/AIVideoCreator.vue src/components/ai-video/AIChatPanel.vue` passed.
  - `yarn --cwd client vue-tsc --noEmit` still fails only on pre-existing admin `@tiptap/*` missing modules and related implicit-any admin errors; no new AI video type failures introduced by this change.

---

# Task Plan - Reference Dialog Visibility Hotfix

## Objective
Fix the new Add Reference dialog not appearing when launched from the AI Video Creator overlay.

## Plan
- [x] Confirm stacking mismatch between AI overlay and shared dialog defaults.
- [x] Apply targeted z-index elevation to the reference dialog content.
- [x] Re-run formatting check on touched component and document result.

## Review
- Root cause:
  - AI Video Creator uses a full-screen overlay at `z-index: 10000`, while shared dialog content defaults to `z-50`.
- Secondary issue:
  - Reference modal was opened via manual state toggling instead of `DialogTrigger`, which can close immediately in the same click interaction cycle.
- Final root cause context:
  - In this specific nested overlay stack, the shared dialog portal behavior remained unreliable for this trigger path.
- Fix:
  - Updated `.chat-ref-dialog` in `client/src/components/ai-video/AIChatPanel.vue` to render at `z-index: 10002`.
  - Switched reference button/modal wiring to native `DialogTrigger` + `v-model:open` pattern for reliable open behavior.
  - Added a global portal-targeted safeguard: `[data-reka-portal] .chat-ref-dialog { z-index: 10002 !important; }`.
- Final fix:
  - Replaced the reference modal with a direct `Teleport` + local themed modal implementation in `AIChatPanel.vue`, controlled by `showReferenceDialog`.
  - Kept the same visual theme and analysis flow while removing dependency on nested shared-dialog portal behavior.
- Visual alignment update:
  - Audited existing app dialog systems (notably `ProfileDialog.vue` and `payment-dialog` styles) and restyled the reference modal to match those canonical tokens/structure:
    - surface/border (`var(--sidebar-surface)`, `var(--sidebar-border)`)
    - accent bar gradient
    - centered icon + title/subtitle header
    - standard input and footer button variants matching org dialogs
- Verification:
  - `yarn --cwd client prettier --check src/components/ai-video/AIChatPanel.vue` passed.
