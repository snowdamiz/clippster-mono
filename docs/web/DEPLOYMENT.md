# Deploy Clippster web to app.clippster.app

This rollout adds **clippster-web** and integrates its video workspace into the account dashboard on **clippster-landing** at **clippster.app**. The API stays at **api.clippster.app**. Deploy both the web service and updated landing site; no apex DNS change is required.

Production rollout completed October 9, 2026: API migrations for creator platform links and organization clip review applied; the API, workspace and account website deployed. Verified the public workspace health endpoint, HTML, JavaScript, CSS, font delivery and unauthenticated project rejection. Use **https://clippster.app** and its existing account login. The optional **app.clippster.app** DNS/certificate setup below has not been applied. Live Google consent, paid AI charges and real social provider delivery still require designated account acceptance tests; automated provider fixtures do not verify those external services.

Since October 2026 everything runs on Cloudflare (account `a1bd7481785784bf4a67d6fd5371397c`): the API, the workspace and the website are Workers, and the API and workspace run their Docker images as Cloudflare Containers behind them.

The landing Worker streams `/workspace/*` to the clippster-web Worker through a service binding (`landing/wrangler.jsonc`). The web service sets `ACCOUNT_ORIGIN=https://clippster.app`; cookie sessions, uploads, playback ranges, and downloads use the website's origin. Sign-in establishes a workspace session using the website's existing account token in an authenticated POST, never an iframe URL. The iframe supplies video tools while the account dashboard retains Home, Messages, Profile, Social, Posts, Settings, Billing and Organization navigation.

Deploy and verify the web service before deploying the updated landing site. `/workspace/api/health` on the website checks the integration. `/account/videos` and `/account/downloads` require website authentication and completed plan selection. Free accounts receive 2 VOD downloads and 5 clip builds daily, resetting at midnight Eastern Time. AI detection uses the existing account API and credits. Browser quotas are durable in the web service; desktop usage counters and desktop projects remain local and separate.

## Build and verify locally

Run the commands in `apps/web/README.md`, then build the Linux image from the repository root:

```sh
docker build -f apps/web/Dockerfile -t clippster-web:local .
docker run --rm -p 8090:8080 \
  -e NODE_ENV=development -e WEB_ORIGIN=http://localhost:8090 \
  -e CLIPPSTER_API_URL=http://host.docker.internal:4000/api \
  -e SESSION_SECRET=local-container-verification-secret-32-chars \
  -v clippster-web-local:/data clippster-web:local
```

Use a local Phoenix instance/account for manual verification. `/api/health` checks the service and SQLite. Startup verifies FFmpeg subtitle support, FFprobe, and yt-dlp before listening. The image runs as the unprivileged `node` user after preparing volume ownership, and includes pinned yt-dlp plus its bundled JavaScript challenge component. The image builds the web frontend and Node service from the shared source; it does not ship desktop executables or test authentication.

## Deploy the account API first

Deploy the updated Phoenix API and apply `20261007000000_create_workspace_oauth_codes.exs` before enabling the web app. The API container runs migrations before every start (`server/cloudflare/worker.mjs`); verify the migration completed and `/api/auth/google/start` and `/api/auth/google/exchange` are available. This is an additive migration; existing desktop/mobile/landing OAuth callbacks keep their existing behavior.

The new workspace flow uses the API's existing Google client ID/secret and registered `https://api.clippster.app/api/auth/google/callback` redirect URI. The workspace server initiates sign-in using its exact `WEB_ORIGIN`; production accepts `https://app.clippster.app` for this flow. Google returns to Phoenix, which redirects a two-minute, single-use code and browser state to `https://app.clippster.app/api/auth/google/callback`. The workspace server checks its HttpOnly attempt cookie, exchanges the code with its stored PKCE verifier, validates `/auth/me`, and issues its normal private session cookie. No JWT is returned to browser JavaScript or placed in the workspace callback URL. Codes are consumed atomically in PostgreSQL.

For local verification, run Phoenix on `http://localhost:4000`, register that API callback URI in the existing Google OAuth client if it is not already present, and use `WEB_ORIGIN=http://localhost:5175` with `CLIPPSTER_API_URL=http://localhost:4000/api`. Development permits localhost callbacks; production does not. `DATABASE_PORT` can select a separate local PostgreSQL port. Keep the existing landing-page origin and callback unchanged.

## Deploy the workspace to Cloudflare

`apps/web/cloudflare` holds the Worker and its `wrangler.jsonc`. The release workflow deploys it on every release; by hand, with `CLOUDFLARE_API_TOKEN` set and Docker running:

```sh
yarn deploy:web   # cd apps/web/cloudflare && npm ci && npx wrangler deploy
curl --fail https://clippster-web.openworth.workers.dev/api/health
```

The Worker runs one `standard-3` container (2 vCPU, 8 GiB) through the shared Durable Object in `cloudflare/container.mjs`. It keeps the container awake with an alarm, and restarts it when a deploy changes its secrets or vars (Cloudflare can take a few minutes to swap in a new deploy). Never run more than one instance with this storage design.

Secrets: `SESSION_SECRET` (keep it stable and backed up) and `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, an R2 key for the `clippster` bucket. `CLIPPSTER_API_URL`, `WEB_ORIGIN`, `ACCOUNT_ORIGIN` and the storage settings are vars in `wrangler.jsonc`. Browser requests use same-origin `/api`, so no new Phoenix browser CORS permission is necessary.

## Production acceptance

1. Sign in with an existing account. Check registration/verification and password reset emails through the existing account service. Test **Google** with an existing Google account, cancel once, complete sign-in, reload, and sign out. Verify that no token appears in the URL or browser storage; confirm the desktop Google flow still returns to its local callback. Google consent must be tested against the deployed API, beyond the simulated-provider automated coverage.
2. Import one completed video from each source your launch promises. Test from Cloudflare's network: providers may block datacenter IPs, require cookies, or change extractors. The application reports failure and supports file upload; it does not bypass provider restrictions.
3. Run a short paid AI detection with a designated test account. Verify the returned clip timings and the credit change on the existing account. Local fixtures verify the contract and media flow, not live model quality or billing correctness.
4. Edit a clip, preview both segments, build portrait and landscape, and inspect the downloaded MP4 including captions/audio.
5. Reload, sign out/in, and confirm project persistence. Use a second account to confirm project/media isolation.
6. Cancel an import/build, retry a failed import, reject an oversized file, and restart the container while a job is running. Verify the interrupted job requires retry and completed projects survive.

## Storage, backup, and recovery

Container disks don't persist, so `scripts/container-entrypoint.sh` sets up storage when `WEB_R2_BUCKET` is set:

- Media and staged uploads (`WEB_DATA_DIR=/data`) live in R2 under `clippster/web/data`, mounted with tigrisfs (`--fsync-on-close`, so a closed file is in R2 before the write returns).
- The SQLite database (`WEB_DATABASE_DIR=/var/lib/clippster`, off the mount) is restored from R2 on start and replicated continuously by Litestream to `clippster/web/db` (`apps/web/litestream.yml`).

Account quotas and low-space admission checks still apply; users delete projects to free space, and completed media never expires automatically.

To recover the database, stop the container and run `litestream restore` against the same replica (or a point in time). To roll back a release, redeploy the previous commit with `yarn deploy:web`. Interrupted jobs are marked failed; never automatically retry AI jobs, because a lost response may already have used credits.

## Reference

- [Cloudflare Containers](https://developers.cloudflare.com/containers/)
- [Mounting R2 in a container (FUSE)](https://developers.cloudflare.com/containers/examples/r2-fuse-mount/)
- [Litestream configuration](https://litestream.io/reference/config/)
