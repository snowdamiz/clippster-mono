# Performance Audit Plan

**Date:** 2026-02-23
**Issue:** App freezes and timeouts on cold start with no user interaction. More prevalent on macOS.

---

## What Actually Runs on Startup

Traced the exact boot sequence. Everything below fires before the user touches anything.

### Rust / Tauri Side (`lib.rs:715-801`)

1. **83 SQLite migrations** run synchronously via `tauri-plugin-sql` (lines 199-705)
2. **Video streaming server** spawned as a Tokio task on port 48276 (`video_server::start_video_server_impl()`, line 722) - a warp HTTP server that stays running
3. **Main window creation** - in production, picks a random port and starts `tauri-plugin-localhost` to serve the frontend (lines 731-741)
4. **Window close handler** registered - acquires `ACTIVE_DOWNLOADS` mutex and `CLIP_GENERATION_IN_PROGRESS` mutex on every close attempt (lines 762-798)

### Vue / WebView Side (`App.vue:145-295`)

All of this runs in `onMounted`, sequentially with `await`:

| Step | What | Network call? | Blocking? |
|------|------|--------------|-----------|
| 1 | `invoke('get_platform')` | No (IPC) | Yes |
| 2 | `invoke('show_main_window')` | No (IPC) | Yes |
| 3 | `checkForUpdates()` via `@tauri-apps/plugin-updater` | **Yes** - hits update server | **Yes** - entire init waits |
| 4 | `authStore.checkAuth()` - calls `GET /api/auth/me` | **Yes** | **Yes** |
| 5 | `startTracking()` - registers mousemove/keydown/click/scroll listeners + starts 2-min `setInterval` ping | No | No |
| 6 | `fetchAndEnqueue()` - calls `GET /api/announcements/active` | **Yes** | **Yes** |
| 7 | `subscribeToChannel()` - tries to join Phoenix announcements channel (silently fails if socket not connected yet) | No | No |
| 8 | `fetchFeatureFlags()` - calls feature flags API | **Yes** | **Yes** |
| 9 | `initDatabase()` - opens SQLite connection from JS side | No (IPC) | Yes |
| 10 | `healSchema()` - runs ~15 `PRAGMA table_info` + conditional `ALTER TABLE` statements | No (IPC) | Yes |
| 11 | `seedDefaultPrompt()` + 3 more seed functions | No (IPC) | Yes |
| 12 | `ensureOrganizationAssetColumns()` | No (IPC) | Yes |
| 13 | `initializeWindowCloseHandler()` | No | No |
| 14 | `initClipBuildEventHandler()` - registers Tauri `listen('clip-build-complete')` | No | No |
| 15 | `initGlobalLiveStatusPolling()` - **immediately checks ALL monitored streamers** then starts 60s `setInterval` | **Yes** - N API calls | **Yes** |

Only after step 15 completes does `isLoading = false` and the app becomes visible.

### Background Tasks Running After Boot

| Task | Interval | Source |
|------|----------|--------|
| Live status polling | 60s | `useLivestreamMonitoring.ts:1803` |
| Activity ping | 2 min | `useActivityTracker.ts:63` |
| Video streaming server | Continuous (warp) | `video_server.rs:43` |

---

## Root Causes (Startup-Specific)

### 1. Sequential Waterfall of Network Requests (HIGH)

`App.vue:initializeApp()` awaits 4-5 network calls **in series**:

```
checkForUpdates() → checkAuth() → fetchAndEnqueue() → fetchFeatureFlags() → initGlobalLiveStatusPolling()
```

Each one blocks the next. If any server is slow (update server, API backend, Kick/Twitch/PumpFun APIs), the entire startup stalls. There are no timeouts on most of these except the updater (which catches errors but has no explicit timeout on the `check()` call itself).

**`initGlobalLiveStatusPolling` is the worst offender** - it iterates over every monitored streamer and calls `fetchLiveStatus()` **sequentially** in a `for...of` loop (`useLivestreamMonitoring.ts:1754-1787`). If a user monitors 10 streamers across 3 platforms, that's 10 sequential API calls before the app finishes loading.

### 2. 83 SQL Migrations on Every Launch (MEDIUM)

`tauri-plugin-sql` runs all 83 migrations in `lib.rs:199-705` on every app start. The plugin checks which have already run, but the sheer number of migration objects being registered and checked adds overhead. After that, `healSchema()` runs ~15 more SQL statements.

This is CPU-bound work on the main thread that delays WebView readiness.

### 3. Video Server Binds Port on Startup (LOW-MEDIUM)

`video_server.rs` starts a warp HTTP server on port 48276 unconditionally at startup. If this port is already in use (previous instance didn't clean up, another app), the server silently fails or retries, potentially consuming Tokio runtime resources.

### 4. macOS App Nap Interaction (MEDIUM)

macOS throttles background apps via App Nap. The 60s live-status polling and 2-min activity ping use `setInterval`. When the app is backgrounded:

- Timers get coalesced/delayed
- When the app comes back to foreground, multiple queued callbacks fire simultaneously
- If `fetchLiveStatus` calls pile up, they all fire at once, potentially overwhelming the JS thread

### 5. No Request Timeouts (HIGH)

None of the startup network calls have explicit timeouts:

- `check()` from `@tauri-apps/plugin-updater` - no timeout visible in `useAppUpdater.ts`
- `fetch('/api/auth/me')` in `auth.js:776` - uses raw `fetch()` with no `AbortController`
- `api.get('/announcements/active')` - axios defaults (likely no timeout configured)
- `fetchLiveStatus()` calls to Kick/Twitch/PumpFun - no timeout

If any of these endpoints hang (DNS resolution, TLS handshake, slow response), the app freezes indefinitely at that step.

---

## Profiling Plan

### Step 1: Add Startup Timing

Add timing instrumentation to `App.vue` to identify which step is actually slow. No external tools needed.

```typescript
// In App.vue onMounted, wrap each step:
const t = (label: string) => {
  const start = performance.now();
  return () => console.log(`[PERF] ${label}: ${(performance.now() - start).toFixed(0)}ms`);
};

let done = t('checkForUpdates');
const hasUpdate = await checkForUpdates();
done();

done = t('checkAuth');
await authStore.checkAuth();
done();

done = t('fetchAndEnqueue');
await fetchAndEnqueue();
done();

done = t('fetchFeatureFlags');
await fetchFeatureFlags();
done();

done = t('initDatabase + heal + seed');
await initDatabase();
await healSchema();
await seedDefaultPrompt();
// ...
done();

done = t('initGlobalLiveStatusPolling');
await initGlobalLiveStatusPolling();
done();
```

This immediately tells you which step is freezing.

### Step 2: Add Request Timeouts

Add `AbortController` timeouts to every startup network call:

```typescript
// Utility
function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id));
}
```

Apply to:
- `auth.js:776` - `checkAuth` fetch call
- `useAppUpdater.ts:58` - updater check
- All `fetchLiveStatus` calls in `useLivestreamMonitoring.ts`

### Step 3: Parallelize Startup

Several startup steps don't depend on each other:

```typescript
// These can run in parallel:
const [_auth, _flags] = await Promise.allSettled([
  authStore.checkAuth(),
  fetchFeatureFlags(),
]);

// DB init doesn't depend on network:
// Can run in parallel with network calls above

// Live status polling doesn't need to block app load at all:
// Move after isLoading = false, or don't await it
```

Specifically, `initGlobalLiveStatusPolling()` should **not** block the loading screen. The user doesn't need to know streamer live status before they can use the app.

### Step 4: macOS Process Monitoring

Run this while the app is open and idle to catch any leaked processes or runaway resource usage:

```bash
# Snapshot every 10s for 5 minutes
while true; do
  echo "=== $(date) ==="
  ps aux | grep -E '(clippster|Clippster|ffmpeg|node|yt-dlp)' | grep -v grep
  sleep 10
done | tee ~/clippster-idle-log.txt
```

```bash
# Track thread count over time
while true; do
  PID=$(pgrep -f Clippster | head -1)
  [ -z "$PID" ] && break
  echo "$(date): threads=$(ps -M -p $PID | wc -l), mem=$(ps -o rss= -p $PID)KB"
  sleep 10
done | tee ~/clippster-threads-log.txt
```

### Step 5: Check App Nap

```bash
# See if macOS is throttling the app
log show --predicate 'process == "Clippster"' --last 5m | grep -i 'nap\|throttl'
```

---

## Fixes (Ordered by Impact)

### Fix 1: Don't Block App Load on Live Status Polling

`initGlobalLiveStatusPolling()` is the last thing that runs before `isLoading = false`. It makes N sequential API calls. Move it to fire-and-forget:

```typescript
// Before (blocks load):
await initGlobalLiveStatusPolling();
isLoading.value = false;

// After (non-blocking):
isLoading.value = false;
initGlobalLiveStatusPolling(); // no await
```

Also change the internal loop from sequential to parallel:

```typescript
// Before (useLivestreamMonitoring.ts:1754):
for (const record of streamers) {
  const status = await fetchLiveStatus(record.mint_id, record.platform);
  // ...
}

// After:
await Promise.allSettled(
  streamers.map(async (record) => {
    const status = await fetchLiveStatus(record.mint_id, record.platform);
    // ...
  })
);
```

### Fix 2: Add Timeouts to All Startup Network Calls

Every `fetch` and `api.get` during startup should have a 5-second timeout. Currently none of them do. A hung DNS lookup or unresponsive server = frozen app.

Key locations:
- `auth.js:776` - `fetch('/api/auth/me')` - no timeout
- `useAppUpdater.ts:58` - `check()` - no timeout
- `useAnnouncements.ts:71` - `api.get('/announcements/active')` - no timeout
- `useLivestreamMonitoring.ts:1758` - `fetchLiveStatus()` - no timeout

### Fix 3: Parallelize Independent Startup Steps

```typescript
// auth check and feature flags don't depend on each other
await Promise.allSettled([
  authStore.checkAuth(),
  fetchFeatureFlags(),
]);

// DB init doesn't depend on network calls
// Can overlap with the above
```

### Fix 4: Reduce Migration Overhead

83 migrations are registered as individual Rust structs in `lib.rs`. Consider:
- Squashing old migrations into a single baseline migration
- Only running `healSchema()` on first launch or after updates (check a version flag in SQLite)

### Fix 5: Guard Video Server Port

`video_server.rs:5` hardcodes port 48276. Add a check for port availability or use a random port like the frontend localhost server does.

---

## Diagnostic Checklist

Quick manual test to isolate the problem:

- [ ] Add `console.time`/`console.timeEnd` around each `await` in `App.vue:initializeApp()`
- [ ] Check if freeze happens with no internet (isolates network timeout issue)
- [ ] Check if freeze happens with 0 monitored streamers (isolates live status polling)
- [ ] Check if freeze correlates with update server availability
- [ ] Run Activity Monitor on macOS during freeze - is CPU spiking or is it just waiting?
- [ ] Check console for `[GlobalLiveStatus]` logs - does the initial poll ever complete?
