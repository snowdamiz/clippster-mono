# Production Audit — Clippster Monorepo

Comprehensive audit of the entire Clippster stack (server, client, landing) identifying issues that could break, leak data, or cause unexpected behavior in production, with a prioritized fix plan.

---

## CRITICAL — Security Vulnerabilities

### 1. Admin Privilege Escalation via Stale JWT Claims
**Files:** `auth_plug.ex`, `admin_plug.ex`, `auth_controller.ex`, `email_auth_controller.ex`

The `is_admin` flag is baked into the JWT at login time and trusted for 7 days. `AdminPlug` checks `conn.assigns[:is_admin]` which comes from the JWT claim — **not** from the freshly-loaded user record that `AuthPlug` already fetches from the DB.

- If an admin is demoted, they retain admin access for up to 7 days.
- If a user is promoted, they don't get admin access until they re-login.

**Fix:** In `AuthPlug.verify_token/2`, after loading the user from DB (line 48-55), set `is_admin` from `user.is_admin` instead of `claims["is_admin"]`:
```elixir
|> assign(:is_admin, user.is_admin)  # Use DB truth, not JWT claim
```

### 2. Stripe Webhook Signature Bypass in Production
**File:** `stripe_controller.ex` lines 240-246

When `webhook_secret` is `nil` or empty, the controller falls through to a clause that **skips signature verification entirely** and just JSON-decodes the raw payload. If `STRIPE_WEBHOOK_SECRET` is not set in production secrets, anyone can forge webhook events (grant themselves subscriptions, credits, etc.).

**Fix:** Make the fallback clause return an error instead of accepting unsigned payloads:
```elixir
defp verify_and_construct_event(_payload, _signature, _webhook_secret) do
  {:error, :webhook_secret_not_configured}
end
```
Also add a startup check in `application.ex` that warns/raises if `STRIPE_WEBHOOK_SECRET` is nil in prod.

### 3. ProgressSocket Has No Authentication
**File:** `progress_socket.ex`

`ProgressSocket.connect/3` accepts **all** connections without any token verification. Any client can connect to `ws://server/socket` and join `progress:<any_project_id>` to receive real-time clip detection progress for any user's project.

**Fix:** Add token verification in `connect/3` (same pattern as `MessagingSocket`):
```elixir
def connect(%{"token" => token}, socket, _connect_info) do
  case Accounts.verify_token(token) do
    {:ok, user} -> {:ok, assign(socket, :user_id, user.id)}
    {:error, _} -> :error
  end
end
def connect(_params, _socket, _connect_info), do: :error
```
Also add user ownership verification in `ProgressChannel.join/3`.

### 4. No `force_ssl` in Production
**Files:** `prod.exs`, `runtime.exs`, `endpoint.ex`

The production endpoint does not set `force_ssl: [hsts: true]`. While Fly.io's load balancer enforces HTTPS at the edge, internal traffic between Fly proxy and the app container is unencrypted HTTP. The `force_ssl` plug also sets HSTS headers for the browser.

**Fix:** Add to `runtime.exs` in the prod block:
```elixir
config :clippster_server, ClippsterServerWeb.Endpoint,
  force_ssl: [hsts: true, rewrite_on: [:x_forwarded_proto]]
```

### 5. Social Token Encryption Key — No Graceful Failure
**File:** `social/token_encryption.ex`

If `SOCIAL_TOKEN_ENCRYPTION_KEY` is not set, the code `raise`s at runtime when any social account operation is attempted. This crashes the request process but doesn't prevent the server from starting, leading to 500 errors that are hard to diagnose.

**Fix:** Add a startup validation in `application.ex` that checks for required env vars in prod and logs clear warnings. Don't crash; instead, return `{:error, :encryption_not_configured}` from encrypt/decrypt and handle gracefully in controllers.

---

## HIGH — Functional Issues That Will Break in Production

### 6. 522 `IO.puts` Debug Statements in Production Code
**Files:** 21 server files (especially `clips_controller.ex` 182×, `stripe_controller.ex` 61×, `auth_controller.ex` 34×)

`IO.puts` bypasses the Logger system entirely — no log levels, no metadata, no structured logging, no way to filter. In production on Fly.io, these clog stdout with debug noise and make actual errors hard to find. Some leak sensitive data (e.g., token lengths, message content).

**Fix:** Replace all `IO.puts` with `Logger.debug/info/warning/error` as appropriate. Particularly:
- Auth plug token logging → `Logger.debug`
- Stripe webhook processing → `Logger.info`
- Error cases → `Logger.error`
- Message validation debug output in `auth_controller.ex` → **remove entirely** (logs expected vs received message content)

### 7. No API Rate Limiting
**Files:** `router.ex`, `endpoint.ex`

There is zero rate limiting on any endpoint. Critical abuse vectors:
- **`/api/auth/email/register`** — unlimited registration attempts (spam)
- **`/api/auth/email/login`** — unlimited login attempts (brute force)
- **`/api/auth/email/forgot-password`** — unlimited password reset emails (email bomb)
- **`/api/auth/challenge`** — unlimited wallet challenges (resource exhaustion)
- **`/api/clips/detect-chunked`** — each request calls expensive AI APIs

**Fix:** Add `plug Hammer` or `PlugAttack` rate limiter. Minimum:
- Auth endpoints: 10 req/min per IP
- AI/clip detection: 5 req/min per user
- Registration: 3 req/min per IP
- Password reset: 3 req/hour per email

### 8. Stripe Checkout `success_url` / `cancel_url` Defaults to `localhost:48276`
**Files:** `stripe_controller.ex`, `subscription_controller.ex`, `runtime.exs`

Multiple controllers fall back to `http://localhost:48276/stripe-success` if `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` env vars are not set. In production, if these aren't configured, users completing Stripe checkout get redirected to a dead localhost URL.

**Fix:** 
- Make these required in prod (add validation in `runtime.exs`)
- Or use a sensible production default like `https://clippster.app/stripe-success`

### 9. Tauri Updater is Disabled
**File:** `tauri.conf.json` line 55

`"active": false` means the built-in auto-updater won't check for or install updates. The CI/CD pipeline generates `latest.json` and updater artifacts, but the client never checks them.

**Fix:** Set `"active": true` when ready for production distribution.

### 10. `OrganizationController` Has Double Auth Plug
**File:** `organization_controller.ex` line 9

The controller has `plug ClippsterServerWeb.AuthPlug` at the module level, but all its routes are already in the `api_auth` pipeline which runs `AuthPlug`. This means **AuthPlug runs twice** for every organization request — double DB lookup per request.

**Fix:** Remove `plug ClippsterServerWeb.AuthPlug` from the controller module since the pipeline already handles it.

### 11. Landing Page API URL is Hardcoded
**Files:** `landing/src/hooks/usePlatform.ts`, `landing/src/components/WaitlistModal.tsx`

The API URL `https://clippster-server.fly.dev` is hardcoded directly in source files, not using an environment variable. If the server URL changes, every reference must be manually updated.

**Fix:** Use `import.meta.env.VITE_API_URL` with a build-time env var, configured in the landing Dockerfile or Fly.io build args.

### 12. Landing Page `min_machines_running: 0`
**File:** `landing/fly.toml` line 16

The landing page can scale to zero machines. First visitor after idle period gets a cold-start delay (can be 5-10 seconds with Docker + nginx).

**Fix:** Set `min_machines_running = 1` for production (matches server config).

---

## MEDIUM — Data Integrity & Robustness

### 13. Subscription Checkout Flow — Promo Code Error Doesn't Halt Execution
**File:** `subscription_controller.ex` lines 153-185

When a promo code is invalid, the code sends a 400 response but **doesn't return or halt**. Execution continues to Stripe checkout session creation. The invalid promo error response is sent, then the function continues and may send a second response or crash.

**Fix:** Add `|> halt()` or restructure with proper `with` chain / early return pattern:
```elixir
case promo_code_info do
  {:error, reason} ->
    conn |> put_status(400) |> json(...) |> halt()
  _ -> :ok  # continue
end
```

### 14. JWT Token Contains No `jti` (Token ID) for Revocation
**Files:** `token_generator.ex`, `auth_controller.ex`

Joken's `default_claims` includes `jti` generation, but there's no token revocation/blacklist mechanism. If a user's account is compromised, there's no way to invalidate their token before the 7-day expiry.

**Fix (later):** Implement a token blacklist in Redis/ETS that `AuthPlug` checks, or reduce token TTL to 1 hour and implement refresh tokens.

### 15. Database Connection Pool May Be Too Small
**File:** `runtime.exs` line 186

Pool size defaults to 10 in production. With multiple background workers (analytics sync, token refresh, scheduled posts, badge worker, leaderboard worker, response time worker, submission sync, shared clip cleanup, release service, price service) plus web requests, the pool may become a bottleneck.

**Fix:** Increase to `pool_size: 20` or monitor with telemetry and adjust.

### 16. `ProgressChannel` Allows Joining Any Project
**File:** `progress_channel.ex` lines 5-8

Even if socket auth is added (fix #3), the channel `join` accepts any `project_id` without verifying the user owns that project. A user could subscribe to another user's clip detection progress.

**Fix:** After adding socket auth, verify project ownership in the `join` callback.

### 17. R2 Storage `acl: :public_read` on All Uploads
**File:** `storage.ex` line 48

All uploaded files (org assets, logos, portfolio clips) are set to public read. This means anyone with the URL can access them without auth. For private organization assets, this may not be desired.

**Fix:** Remove `acl: :public_read` and use presigned URLs (already implemented in `presigned_url/2`) for serving assets. The presigned URL system is already built — just needs to be the default.

### 18. Dockerfile Copies JS Scripts That May Not Exist
**File:** `server/Dockerfile` line 54

`COPY sig_verify.js payment_verify.js fetch_metadata.js priv/js/` — if any of these files don't exist or are renamed, the Docker build fails. These should be verified or use a glob pattern.

**Fix:** Verify these files exist in `server/`. If they're legacy, remove the COPY line. If needed, use `COPY *.js priv/js/` or make the copy conditional.

---

## LOW — Quality & Maintenance

### 19. CSP `unsafe-eval` and `unsafe-inline` in Tauri
**File:** `tauri.conf.json` line 28

The CSP includes `'unsafe-eval'` and `'unsafe-inline'` for scripts and styles. While common in Tauri dev, these weaken security in production.

**Fix:** Remove `'unsafe-eval'` if not needed (check if any deps require it). Keep `'unsafe-inline'` for styles only if Tailwind requires it.

### 20. `connect-src https:` Allows Any HTTPS Endpoint
**File:** `tauri.conf.json` line 28

The CSP `connect-src` allows `https:` which means the app can make requests to any HTTPS endpoint. This is overly permissive.

**Fix:** Restrict to specific domains: `https://clippster-server.fly.dev https://api.lemonfox.ai https://openrouter.ai https://api.freesound.org` etc.

### 21. Asset Protocol Scope is Very Broad
**File:** `tauri.conf.json` lines 33-39

`$HOME/**/*` gives the Tauri asset protocol access to the user's entire home directory. This is a significant attack surface.

**Fix:** Narrow to only required paths: `$VIDEO/**/*`, `$DOWNLOAD/**/*`, `$APPLOCALDATA/Clippster/**/*`.

### 22. No Database SSL in Production
**File:** `runtime.exs` line 184

`ssl: true` is commented out for the database connection. On Fly.io with Fly Postgres, connections within the private network are encrypted by default, but explicit SSL ensures security if the database is ever exposed or migrated.

**Fix:** Uncomment `ssl: true` or verify Fly.io's internal encryption guarantees are sufficient.

### 23. `dev_routes` Enabled Only at Compile Time
**File:** `config.exs` / `prod.exs`

Dev routes (LiveDashboard, mailbox preview) are correctly disabled in prod via compile-time config. This is fine — no action needed, just noting it's been verified.

---

## Fix Priority Order

| Priority | Issues | Effort |
|----------|--------|--------|
| **Do First** | #1 Admin JWT, #2 Stripe webhook bypass, #3 ProgressSocket auth | Small (1-2 hours) |
| **Do Second** | #4 force_ssl, #6 IO.puts→Logger, #7 Rate limiting, #8 Stripe URLs | Medium (3-4 hours) |
| **Do Third** | #10 Double auth plug, #13 Promo code halt, #16 Channel ownership | Small (1 hour) |
| **Do Fourth** | #5 Encryption key graceful fail, #11 Landing hardcoded URL, #12 Min machines | Small (1 hour) |
| **Later** | #9 Updater, #14 Token revocation, #15 Pool size, #17 R2 ACL, #18 Dockerfile, #19-22 Hardening | Varies |
