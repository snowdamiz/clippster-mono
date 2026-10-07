# Deploy Clippster web to app.clippster.app

This rollout adds **clippster-web**. The landing page stays on **clippster-landing** at **clippster.app**, and the API stays at **api.clippster.app**. No landing-page deployment or apex DNS change is required. These are deployment instructions, not a record of a production deployment.

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

Deploy the updated Phoenix API and apply `20261007000000_create_workspace_oauth_codes.exs` before enabling the web app. The existing API Fly configuration runs migrations as its release command; verify the migration completed and `/api/auth/google/start` and `/api/auth/google/exchange` are available. This is an additive migration; existing desktop/mobile/landing OAuth callbacks keep their existing behavior.

The new workspace flow uses the API's existing Google client ID/secret and registered `https://api.clippster.app/api/auth/google/callback` redirect URI. The workspace server initiates sign-in using its exact `WEB_ORIGIN`; production accepts `https://app.clippster.app` for this flow. Google returns to Phoenix, which redirects a two-minute, single-use code and browser state to `https://app.clippster.app/api/auth/google/callback`. The workspace server checks its HttpOnly attempt cookie, exchanges the code with its stored PKCE verifier, validates `/auth/me`, and issues its normal private session cookie. No JWT is returned to browser JavaScript or placed in the workspace callback URL. Codes are consumed atomically in PostgreSQL, so the API can run multiple Machines.

For local verification, run Phoenix on `http://localhost:4000`, register that API callback URI in the existing Google OAuth client if it is not already present, and use `WEB_ORIGIN=http://localhost:5175` with `CLIPPSTER_API_URL=http://localhost:4000/api`. Development permits localhost callbacks; production does not. `DATABASE_PORT` can select a separate local PostgreSQL port. Keep the existing landing-page origin and callback unchanged.

## Provision the separate Fly app

Run from the repository root. Confirm the Fly organization/account before creating resources. App names are globally unique; if `clippster-web` is unavailable, choose an available name and update `apps/web/fly.toml` and `scripts/deploy-fly.mjs` consistently.

```sh
fly auth whoami
fly apps create clippster-web --org YOUR_ORG
fly ips allocate-v6 --app clippster-web
fly ips allocate-v4 --shared --app clippster-web
fly volumes create web_data --app clippster-web --region iad --size 50
fly secrets set --app clippster-web SESSION_SECRET="$(openssl rand -hex 32)"
fly config validate --config apps/web/fly.toml
fly deploy . --config apps/web/fly.toml --dockerfile apps/web/Dockerfile --remote-only --ha=false
fly scale count 1 --app clippster-web
fly status --app clippster-web
fly checks list --app clippster-web
```

The first release uses one 2-vCPU / 4-GB Machine, one 50-GB volume, and one worker. This is a capacity starting point, not a performance guarantee. Measure render time, queue depth, disk utilization, memory, and source-provider failures under the expected workloads. Raise CPU/memory before raising worker concurrency. The deployment strategy replaces the single instance; schedule deploys after active jobs finish. Never increase machine count with this storage architecture.

`SESSION_SECRET` is the only new required secret. Keep it stable across deployments and back it up securely. Existing AI, mail, billing, and account secrets stay in Phoenix. `CLIPPSTER_API_URL` and `WEB_ORIGIN` are non-secret runtime settings in the Fly config. Browser requests use same-origin `/api`, so no new Phoenix browser CORS permission is necessary.

The repository helper supports `yarn deploy:web` with a scoped `FLY_WEB_TOKEN` in the process environment or `server/.env`. Generic `FLY_API_TOKEN` is also accepted. It supplies `--ha=false`. Do not reuse the landing app's deploy token for the new app.

## Attach only the app subdomain

```sh
fly certs add app.clippster.app --app clippster-web
fly certs setup app.clippster.app --app clippster-web
```

Apply the exact DNS records returned by Fly for **app.clippster.app**. For a subdomain, Fly supports a CNAME pointing to the app's Fly hostname; follow the returned ownership/ACME records as needed. Preserve `clippster.app`, `www`, and `api` records. If Cloudflare manages DNS, start DNS-only for this subdomain while certificate issuance is verified.

```sh
fly certs check app.clippster.app --app clippster-web
curl --fail https://app.clippster.app/api/health
```

The configured browser origin is the custom domain; mutating requests from `clippster-web.fly.dev` intentionally fail the Origin check. For pre-DNS staging, deploy a separate staging app/volume and set its exact HTTPS hostname as `WEB_ORIGIN`, or verify the production host after DNS is attached. Never relax the Origin check to a wildcard.

## Production acceptance

1. Sign in with an existing account. Check registration/verification and password reset emails through the existing account service. Test **Google** with an existing Google account, cancel once, complete sign-in, reload, and sign out. Verify that no token appears in the URL or browser storage; confirm the desktop Google flow still returns to its local callback. Google consent must be tested against the deployed API, beyond the simulated-provider automated coverage.
2. Import one completed video from each source your launch promises. Test from Fly's region: providers may block datacenter IPs, require cookies, or change extractors. The application reports failure and supports file upload; it does not bypass provider restrictions.
3. Run a short paid AI detection with a designated test account. Verify the returned clip timings and the credit change on the existing account. Local fixtures verify the contract and media flow, not live model quality or billing correctness.
4. Edit a clip, preview both segments, build portrait and landscape, and inspect the downloaded MP4 including captions/audio.
5. Reload, sign out/in, and confirm project persistence. Use a second account to confirm project/media isolation.
6. Cancel an import/build, retry a failed import, reject an oversized file, and restart the Machine while a job is running. Verify the interrupted job requires retry and completed projects survive.

## Storage, backup, and recovery

Media remains private on `/data`. Account quotas and low-space admission checks prevent unbounded writes; users delete projects to free space. There is no automatic expiry of completed media. Start with enough free space for incoming files plus normalization and exports; alert before 70% volume use.

Fly Volumes are tied to one Machine/host and are not automatically replicated. Keep volume snapshots enabled, select an appropriate retention, and take an on-demand snapshot before deployments:

```sh
fly volumes list --app clippster-web
fly volumes snapshots create VOLUME_ID --app clippster-web
fly volumes snapshots list VOLUME_ID --app clippster-web
```

Before a broad public launch, configure an independent encrypted off-platform backup of `/data` (SQLite, its WAL/SHM files when present, and media) and perform a restore drill. A consistent backup requires quiescing writes or using a filesystem snapshot; copying live database/media files independently can produce mismatched revisions. Preserve the matching `SESSION_SECRET` separately, or intentionally invalidate sessions on restore. Fly daily snapshots alone are not a complete backup policy.

To recover from a failed release, redeploy the previous known-good image to the same app and volume (`fly releases --app clippster-web`, then `fly deploy --image IMAGE_REF ...`). To recover a volume failure, create a new volume from a verified snapshot/backup in `iad`, attach it to the replacement Machine, and keep exactly one active instance. Expect interrupted jobs to be marked failed. Never automatically retry AI jobs: a lost response may have incurred credits.

For high availability, implement Postgres-backed job leases and R2-backed media before adding Machines. The launch configuration deliberately makes the single-instance limitation explicit.

## Reference

- [Fly Volumes: persistence, replication, and backups](https://fly.io/docs/volumes/overview/)
- [Fly custom domain setup](https://fly.io/docs/networking/custom-domain/)
- [Fly configuration reference](https://fly.io/docs/reference/configuration/)
