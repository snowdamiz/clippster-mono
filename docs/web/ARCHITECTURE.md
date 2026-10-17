# Browser workspace architecture

## Shared implementation

| Layer | Location | Consumers |
|---|---|---|
| Project workspace header | `client/src/components/ProjectWorkspaceHeader.vue` | Desktop dialog and web dialog |
| Player and controls | `client/src/components/VideoPlayer.vue`, `VideoControls.vue` | Desktop and web |
| Subtitle layout math | `client/src/utils/subtitleLayout.ts` | Shared preview and desktop PNG rendering |
| Design tokens | `client/src/styles/theme.css` | Desktop and web |
| API transport and account contract | `packages/api-client` | Mobile and web service/client; same Phoenix API as desktop |
| Browser workspace API | `packages/api-client/src/webProjectsApi.ts` | Browser frontend; available to future clients |
| Clip types, framing, subtitle defaults | `packages/shared-types` | Shared across platforms |
| FFmpeg clip plan | `packages/clip-export` | Mobile and web rendering |

The existing desktop dialog delegates its header to the shared component. Its player receives Tauri's `convertFileSrc` as an explicit adapter. The player no longer imports Tauri or a renderer that imports Tauri. Browser entry points never bootstrap desktop database, updater, shortcuts, or window-management services. Type-only imports use platform-neutral types where possible. Shared TypeScript packages explicitly declare ESM so the Node media service and existing bundlers agree on module semantics.

Desktop window rules remain in `client/src/style.css`; the theme tokens were extracted once, not duplicated. The browser keeps its own responsive shell and a smaller editor, while the actual video preview and playback controls remain shared.

## Request flow

```text
Browser (app.clippster.app)
  ├─ static Vue app, shared workspace components
  ├─ same-origin /api/auth → existing Phoenix account API
  └─ same-origin /api/web → Node media service
       ├─ encrypted account tokens + HttpOnly sessions
       ├─ SQLite project/job metadata on persistent /data
       ├─ private source and export media on /data/media/<opaque-id>
       └─ bounded worker
            ├─ yt-dlp through DNS-pinned public-network proxy
            ├─ local FFmpeg normalize/extract/render
            └─ existing Phoenix /clips/detect (account JWT + real duration)
```

Every project, source, clip, and job operation resolves an authenticated owner. Authentication is revalidated with Phoenix on requests. No JWT is returned to the browser. Session IDs are random, stored as hashes, and have an absolute seven-day lifetime; upstream expiration/account deletion is also enforced. Cookie authentication requires matching Origin on all mutations. Tokens at rest use AES-256-GCM and `SESSION_SECRET`; rotation invalidates existing sessions.

Jobs have persisted states and one active operation per project. Concurrent edits use revisions. Completed files are atomically moved into place. Uploads are streamed with byte limits; subprocess arguments are arrays, never shell interpolation. User data cannot choose file paths or FFmpeg filters. Source URL allowlists are supplemented by a local downloader proxy that rejects private/link-local/reserved addresses on every connection and pins the resolved public IP, including HTTPS tunnels. FFmpeg is allowed only local media formats/protocols. Signed media links are unnecessary: native video and download requests use the same session cookie and enforce ownership, including byte-range requests.

The shared export plan now concatenates all segments before applying crop and captions, supports silent sources, and bounds render duration. Captions are re-timed from source timestamps into the concatenated clip timeline.

## Restarts and cancellation

Source imports and builds can be cancelled. A running AI request cannot be cancelled from the UI because the existing upstream API may continue billing after a client disconnect. Queued requests can be cancelled.

An interrupted job becomes failed on restart; it is never silently replayed. In particular, AI jobs require explicit retry because completion or billing may be ambiguous after a lost response. Incomplete uploads and worker scratch files are removed during startup. Completed project records and built media survive restarts.

## Initial operating model

The initial deployment is one Fly Machine with one persistent volume and a serial CPU media worker. It accepts downtime during deployment and a single-host failure domain. It must not be horizontally scaled with independent volumes: metadata and media would diverge. The Fly config disables automatic stopping so background jobs continue when no browser is connected.

For multiple workers/regions, move metadata and durable job leases to the existing Postgres service, move original/built media to private R2 objects, and run isolated worker Machines against the queue. Keep the browser workspace contract and shared UI/export package unchanged. Desktop-to-web project sync would be a separate integration with the existing cloud snapshot protocol; this implementation does not claim that imported browser projects appear on desktop.
