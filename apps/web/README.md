# Clippster web workspace

A browser version of the desktop project workspace. It uses the existing Clippster account and AI API, the desktop Vue sign-in dialog, branding, navigation items, library cards, project dialog, player, controls, headers, and theme, and shared TypeScript export code. The desktop and landing page retain their own entry points.

## Local development

The default development path uses Docker Desktop (or Docker Engine) with Compose 2.24+. The web container includes Node 24, FFmpeg with captions support, Python, and yt-dlp; no host media tools are needed.

```sh
cp apps/web/.env.example apps/web/.env
# Generate SESSION_SECRET with: openssl rand -hex 32
# Start all services from the repository root, including Docker PostgreSQL and web:
yarn dev
# Or start only the web container (start Phoenix separately with yarn server):
yarn web
# Stop only the web container, preserving its projects and media:
yarn web:stop
```

Open http://localhost:5175. Vite proxies `/api` to the media service on port 8090. Both ports bind to host loopback. `yarn web` builds the development target from the same Dockerfile used for Fly, then attaches logs; Ctrl+C stops the web container. UI, server, shared Vue components, and shared packages are mounted for live reload. Run `yarn web` again after dependency or configuration changes to rebuild. Named volume `server_web_data` preserves browser projects and media across restarts (its prefix follows the Compose project name). Host-mode data under `apps/web/data` is separate.

The container reaches the host Phoenix API at `http://host.docker.internal:4000/api`. Docker-specific paths override host paths in `.env`. To use another API, set `WEB_DOCKER_API_URL` in the shell before `yarn dev`/`yarn web`. On native Linux Docker Engine, start Phoenix with `PHX_DEV_BIND_IP=0.0.0.0 yarn server` (or prefix `yarn dev`) so the container can reach it; use a trusted development network. Docker Desktop on macOS/Windows works with Phoenix's default loopback binding. `DATABASE_PORT` can select an alternate local PostgreSQL port for root setup and Phoenix.

The root `yarn dev` command starts Phoenix, Tauri, the landing page, mobile, and both web processes together. Sign in with a real account on that API. The web service does not contain a development authentication bypass. Google and email sign-in use the same existing Clippster accounts. Browser sessions use private HttpOnly cookies; API JWTs stay encrypted on the server. Google returns a two-minute, single-use code to the browser server, which exchanges it with a PKCE verifier after checking the initiating browser cookie and state.

### Optional host development

For running the media service without Docker, install Node 24+, Python 3.11+, FFmpeg with `libx264`, `libmp3lame`, and `libass`, and yt-dlp:

```sh
npm ci --prefix apps/web --workspaces=false
python3 -m venv apps/web/.venv
apps/web/.venv/bin/pip install 'yt-dlp[default]==2026.8.19'
# macOS: brew install ffmpeg-full
# Set FFMPEG_PATH, FFPROBE_PATH and YTDLP_PATH in apps/web/.env.
yarn web:host
```

Host mode reads `CLIPPSTER_API_URL` from `apps/web/.env`. For email/AI testing against the hosted API, set it to `https://api.clippster.app/api` (or use `WEB_DOCKER_API_URL` with Docker). The native desktop client uses a separate setting, `VITE_API_URL=https://api.clippster.app`, in ignored `client/.env.local`. Restart the affected development process after changing its environment. A connection refusal at `127.0.0.1:4000` means the configured local Phoenix API is not running. Hosted AI requests consume the signed-in account's real credits. Google sign-in requires the updated Phoenix API and the `workspace_oauth_codes` migration. For local Google testing, use a local Phoenix instance; production intentionally rejects localhost workspace callbacks. The Google provider callback remains `/api/auth/google/callback` on the API host, and must be registered in Google Cloud. See `docs/web/DEPLOYMENT.md` for rollout order.

`yarn web:build` produces `apps/web/dist/public` and a bundled Node server. Run it from `apps/web` using `npm start --workspaces=false`. `WEB_ORIGIN` must exactly match the browser origin, including the port; for a local production-bundle preview on port 8090, use `http://localhost:8090`.

## Supported workflow

1. Create a project and download a public, completed YouTube, Twitch, Kick, Vimeo, Rumble, or X video, or upload a video file.
2. Select **Find clips** to use the existing AI service and account credits. Existing manually edited clips are preserved when detecting again.
3. Select a clip, preview its segments, adjust times, choose vertical or landscape, and enable captions when transcription is available. Changes save explicitly; Revert restores the saved version.
4. Build the clip, then download its H.264/AAC MP4. Changing settings invalidates the download until rebuilt. A browser refresh preserves projects and finished media.
5. Delete a clip or project to free storage. Project deletion removes its source and built clips.

This intentionally excludes the full multitrack editor, live recording, social publishing, organization administration, and desktop-local project synchronization. Browser projects live on the web service. Native media paths and arbitrary commands are never exposed to the browser.

Limits: 20 projects/account; 2 GB and 2 hours/source; 100 clips/project; 20 non-overlapping segments and 10 minutes/clip; 10 GB/account. One media job executes at a time, with a bounded queue and two uploads globally. Audio is compressed to mono MP3 for the existing `/clips/detect` contract. Private, age-gated, DRM, live, deleted, and provider-blocked sources are not supported; upload is the fallback. External platform availability must be checked from the deployment region.

## Verification

```sh
npm run typecheck --prefix apps/web --workspaces=false
npm test --prefix apps/web --workspaces=false
npm run build --prefix apps/web --workspaces=false
npm exec --prefix apps/web --workspaces=false -- playwright install chromium
npm run test:e2e --prefix apps/web --workspaces=false
```

On macOS prefix the test commands with `FFMPEG_PATH=/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg FFPROBE_PATH=/opt/homebrew/opt/ffmpeg-full/bin/ffprobe`. A minimal FFmpeg build cannot burn subtitles.

Integration and browser tests run real uploads, FFmpeg audio extraction, normalization, caption rendering, HTTP range requests, MP4 downloads, account isolation, CSRF checks, and durable state recovery. Authentication and AI responses are supplied by an isolated HTTP fixture under `tests/`; these tests incur no AI charges and do not demonstrate live model quality or live-provider availability. The production entry point never imports fixtures.

The browser suite also verifies Google success/cancellation (provider consent is simulated), registration validation, OTP errors, password reset navigation, and mounts the shared sign-in dialog, player, controls, and workspace header under both desktop and web styles. It checks playback, captions with and without transcript segments, native-media URL adapter behavior, image framing, and control events. Shared export tests render multi-segment/multi-region videos and inspect their duration, audio, and pixel colors.

For an opt-in external source smoke test, from `apps/web`:

```sh
YTDLP_PATH=.venv/bin/yt-dlp npm exec --workspaces=false -- tsx --env-file-if-exists=.env scripts/source-smoke.ts 'https://www.youtube.com/watch?v=VIDEO_ID'
```

Deployment instructions: [Fly rollout](../../docs/web/DEPLOYMENT.md). Architecture and operational boundaries: [Architecture](../../docs/web/ARCHITECTURE.md).

Completed local checks and known limits: [Verification report](../../docs/web/VERIFICATION.md).
