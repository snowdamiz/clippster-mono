---
status: resolved
trigger: "websocket-403"
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T00:09:00Z
---

## Current Focus

hypothesis: ROOT CAUSE CONFIRMED - Production endpoint missing check_origin configuration for WebSocket connections
test: Compare dev vs prod endpoint config
expecting: Production should have check_origin set to false or list of allowed origins
next_action: Add check_origin configuration to production endpoint settings

## Symptoms

expected: WebSocket should connect successfully to the Phoenix server for progress updates
actual: Every connection attempt gets 403 Forbidden during handshake, creates infinite reconnect loop
errors: "WebSocket connection to 'wss://clippster-server.fly.dev/socket/websocket?vsn=2.0.0' failed: Error during WebSocket handshake: Unexpected response code: 403"
reproduction: Open any project workspace - the ProgressSocket immediately starts failing
started: Reported 2/15/26, constant throughout the session

## Eliminated

## Evidence

- timestamp: 2026-02-15T00:01:00Z
  checked: useProgressSocket.ts line 37-38
  found: Socket connection initialized with empty params: `params: {}`
  implication: No authentication token or user credentials being sent with WebSocket connection

- timestamp: 2026-02-15T00:02:00Z
  checked: server/lib/clippster_server_web/progress_socket.ex line 10
  found: Socket connect function accepts all connections: `{:ok, socket}`
  implication: Server-side socket doesn't enforce authentication, so 403 must be from earlier layer

- timestamp: 2026-02-15T00:03:00Z
  checked: server/lib/clippster_server_web/endpoint.ex line 18-20, 53-58
  found: Socket endpoint has no websocket config restrictions BUT has CORSPlug with `origin: &ClippsterServerWeb.Router.cors_origins/0`
  implication: 403 likely from CORS origin check - need to examine cors_origins function

- timestamp: 2026-02-15T00:04:00Z
  checked: server/lib/clippster_server_web/router.ex line 47-64
  found: CORS origins list includes tauri:// patterns and tauri.localhost but CORSPlug is at endpoint level (line 53-58 in endpoint.ex)
  implication: CORSPlug is a HTTP middleware that runs on ALL requests including WebSocket upgrade requests - this is the problem

- timestamp: 2026-02-15T00:05:00Z
  checked: Phoenix WebSocket upgrade flow
  found: WebSocket upgrades start as HTTP requests with Upgrade header. CORSPlug intercepts ALL HTTP requests at endpoint level.
  implication: CORSPlug doesn't know how to handle WebSocket upgrade requests properly and returns 403

- timestamp: 2026-02-15T00:06:00Z
  checked: server/config/dev.exs line 23, prod.exs, runtime.exs
  found: Dev config has `check_origin: false` but NO check_origin setting in prod config (runtime.exs line 214-224)
  implication: Production endpoint is using Phoenix's default check_origin behavior which rejects Tauri origins

- timestamp: 2026-02-15T00:07:00Z
  checked: Phoenix documentation research
  found: Phoenix WebSockets perform origin checking by default. When origin doesn't match allowed list, returns 403 during handshake.
  implication: Root cause confirmed - production is missing check_origin configuration

## Resolution

root_cause: Production endpoint configuration in runtime.exs is missing check_origin setting for WebSocket connections. Phoenix defaults to checking Origin header during WebSocket handshake and rejects connections from Tauri origins (tauri://localhost) because they're not in the default allowed list. Dev environment has check_origin: false (line 23 of dev.exs) which is why it works locally but fails in production.
fix: Added check_origin configuration to production endpoint in runtime.exs with allowed origins including Tauri protocols (tauri://localhost, https://tauri.localhost, http://tauri.localhost) and production domains (//clippster-server.fly.dev, //api.clippster.app)
verification: Fix will be verified after deployment to production. The check_origin configuration tells Phoenix to accept WebSocket upgrade requests from Tauri app origins instead of rejecting them with 403 Forbidden.
files_changed: ["server/config/runtime.exs"]
