# Local verification — 2026-10-06

The browser workspace is implemented and locally verified, including regression checks in the native macOS app. Real browser Google sign-in and session persistence have also been verified against a local Phoenix API. Production deployment, live paid AI acceptance, and provider availability from Fly remain rollout steps in [DEPLOYMENT.md](DEPLOYMENT.md).

| Check | Result |
|---|---|
| Web frontend/server TypeScript | Passed locally and in the Linux Docker build |
| Production web/server build | Passed with standalone npm dependencies and monorepo Yarn dependencies |
| Web integration/export/playback tests | 30 passed; Google cookie/state binding, cancellation, expiry, replay prevention, session rotation, and real FFmpeg uploads, normalization, audio extraction, multi-segment and multi-region renders, subtitles, silent video, range requests, downloads, owner isolation, CSRF, token encryption, revision checks, restart recovery, and playback races |
| Chromium end-to-end workflows | 8 passed after the shared UI/OAuth refactor (the earlier three scenarios also passed five repetitions before this refactor). Google handoff and cancellation, web registration/OTP/unverified-login/password reset, shared authentication under desktop/web styles, and the full clipping workflow are covered. Full web workflow: sign in → upload → fixture AI → edit → portrait build/download → discard/revert → save-only landscape edit → rebuild/download → reload. Shared player scenarios run with both desktop and web styles and cover captions, explicit transcript gaps, play/pause, seeking, mute/volume, fullscreen event, image-media adapter/canvas, and close event. Desktop/mobile screenshots inspected; no browser page errors |
| Phoenix OAuth regressions | 18 passed against isolated PostgreSQL: exact origin/PKCE validation, code expiry and atomic consumption, signed callback state, cancellation, token exchange, and existing desktop/landing/account-switch behavior |
| Shared package suites | 34 passed: shared-types 2, cloud-sync-schema 2, api-client 8, clip-export 22; all four package typechecks passed. Real multi-segment/multi-region export regressions also passed against the desktop's bundled FFmpeg 6 |
| Desktop frontend suite | 198 passed across 46 test files, including the extracted subtitle layout helpers |
| Native macOS app | Fresh Rust/Tauri development build with static FFmpeg libraries compiled and launched. Real Google OAuth completed; local video import, workspace playback, manual clip creation, two-region portrait framing, and landscape/portrait exports verified. Built Clips showed both outputs. FFprobe and full decoding confirmed H.264/AAC, 1280×720 / 1080×1920, and approximately 2.98-second duration |
| External source download | A real YouTube source (`jNQXAC9IVRw`) downloaded through the public-network proxy and probed successfully: 19.014 seconds, 320×240, with audio |
| Linux container | Latest shared-UI/OAuth image built; health and JavaScript/CSS assets passed before/after restart; OAuth start returned a Secure, HttpOnly, SameSite=Lax __Host cookie; Node service runs as UID/GID 1000; FFmpeg subtitle filter and pinned yt-dlp available |
| Docker local development | Root `yarn web` built and launched Compose's development target; both ports healthy, Google start reached the local Phoenix API and returned the registered Google callback, shared desktop Vue edits hot-reloaded, and media server edits restarted automatically. All 30 web tests and TypeScript checks passed inside the container. Named-volume OAuth state survived restart. The refactored production image also built and served its compiled assets successfully |
| Root startup | `yarn dev` dispatch verified for server, Tauri, landing, mobile, and web using isolated subprocess fixtures; the actual web command was launched separately. Two setup regressions passed for an existing database with Docker initially stopped/running, including the alternate PostgreSQL port. Existing desktop/mobile/landing processes were not relaunched together during this check |
| Fly configuration | `flyctl config validate -c apps/web/fly.toml` passed |
| Deployment helper | Three isolated tests passed for web, server, and landing targets, including working directory, config paths, token precedence, and web single-machine flags. No deployment performed |
| Desktop frontend build | `yarn --cwd client vite build` passed |
| Desktop TypeScript regression comparison | 14 errors in both the untouched HEAD and modified tree; no new diagnostics |
| Repository hygiene | `git diff --check` passed; local credentials, media, caches, and test outputs ignored |

Authentication and AI responses in the automated tests come from an isolated HTTP fixture. The application performs real media processing and HTTP requests against that fixture. These results do not establish live AI model quality, real-account billing correctness, or availability of every source provider. No test authentication is present in the production entry point.

Native Google sign-in used the production account API with the user completing authentication, and succeeded again after extracting the shared dialog. The reported `127.0.0.1:4000` connection refusal was a development configuration issue: no local Phoenix server was listening. The ignored `client/.env.local` now sets `VITE_API_URL=https://api.clippster.app` for this local verification session. Normal local-API development still requires starting Phoenix. The browser now uses the exact shared desktop sign-in dialog with Google and email/password. A real Google sign-in completed through `http://localhost:4000/api/auth/google/callback`, returned to `http://localhost:5175/`, survived reload, and created a local verification project. The production API has not been deployed; the local preview now uses an isolated local database for this verification.

The native smoke run uses a temporary local macOS wrapper around the freshly compiled debug executable and the repository's bundled FFmpeg/FFprobe executables. It verifies native commands and the current Vue source, not a signed installer or updater. The first render attempt failed because those sidecars were missing from that temporary wrapper; after adding them, both exports completed and decoded successfully. No Rust production source was changed. Windows/Linux desktop installers, live paid AI/billing, and every external source provider remain unverified.

Follow-up testing found and fixed four issues: word-only transcripts did not show captions in the shared player; a save response could leave the browser draft marked dirty; seeking backward could retain the wrong preview segment and pending playback could race with pause; and a shared multi-region FFmpeg graph could truncate/corrupt multi-segment output. Regression coverage now exercises these behaviors.

The extracted native library card opened its existing project; navigation, branding, the shared New Project dialog, and required-name validation were rechecked in the running macOS app. Web and desktop use `SharedAuthDialog`, `AppBrand`, `SidebarNavigationItem`, `LibraryProjectCard`, `PageLayout`, and `ProjectDialogFrame` directly. The duplicate web login and card implementations were removed.

The desktop's existing TypeScript failures were compared using a separate pristine checkout of HEAD. They remain outside this change. The web build reports a size warning for its separate HLS playback dependency; Node reports its SQLite experimental warning. Neither prevents the verified builds or tests.

## Reproduce

Follow [apps/web/README.md](../../apps/web/README.md) for dependencies and tool paths, then run:

```sh
npm run typecheck --prefix apps/web --workspaces=false
npm test --prefix apps/web --workspaces=false
npm run build --prefix apps/web --workspaces=false
npm run test:e2e --prefix apps/web --workspaces=false
node --test scripts/deploy-fly.test.mjs scripts/dev-setup.test.mjs
yarn --cwd client test
yarn --cwd client vite build
docker build -f apps/web/Dockerfile -t clippster-web:local .
flyctl config validate -c apps/web/fly.toml
docker compose -f server/docker-compose.yml up --build --wait web
docker compose -f server/docker-compose.yml exec -T web npm test --workspaces=false
cd server
MIX_ENV=test mix test test/clippster_server/auth/workspace_oauth_test.exs test/clippster_server_web/controllers/workspace_google_controller_test.exs test/clippster_server_web/oauth_callback_target_test.exs test/clippster_server_web/controllers/switch_google_account_controller_test.exs
```

On this Mac, host tests use `FFMPEG_PATH=/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg` and `FFPROBE_PATH=/opt/homebrew/opt/ffmpeg-full/bin/ffprobe` for subtitle support; Docker includes its own media tools. Browser artifacts are under `apps/web/test-results/` and are intentionally untracked. The current browser preview runs in Docker using the local Phoenix API, PostgreSQL on port 55479, and the `server_web_data` volume. The previous host preview's data remains in `apps/web/data/local-oauth`; both are isolated from production. The native app still uses the production account API. Tests use `TEST_DATABASE_PORT=55479`, while local API startup uses `DATABASE_PORT=55479 PORT=4000 mix phx.server`. Start the Docker preview with `yarn web`, or all services with `yarn dev`. Local configuration is ignored by Git. Selecting **Find clips** against a hosted API consumes that account's real credits.
