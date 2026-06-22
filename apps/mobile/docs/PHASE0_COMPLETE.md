# Phase 0 completion checklist

Use this gate before starting Phase 1 (downloads, AI, workspace playback).

## Dev client & tooling

- [ ] `yarn install` at repo root installs `apps/mobile` and `packages/*`
- [ ] `yarn mobile` starts Metro
- [ ] `yarn mobile:typecheck` passes
- [ ] EAS `development` profile builds iOS + Android dev clients
- [ ] Deep link `clippster://` opens the app

## Shared packages

- [ ] `@clippster/shared-types` — types import in mobile without Vue
- [ ] `@clippster/api-client` — JWT + `X-Client-Platform: mobile`
- [ ] `@clippster/sqlite-schema` — migrations v1–v6

## Auth

- [ ] Email login against local/staging/production API
- [ ] Google login on dev build (see `docs/AUTH.md`)
- [ ] Token survives app restart (SecureStore)
- [ ] Logout + 401 clears session

## App shell

- [ ] Unauthenticated users cannot reach `(tabs)`
- [ ] Projects tab lists SQLite projects; FAB creates project
- [ ] Project detail placeholder screen
- [ ] Settings shows email, version, FFmpeg version

## Native

- [ ] `getFfmpegVersion()` non-empty on dev build (iOS + Android)
- [ ] Expo Go documented as unsupported for FFmpeg/OAuth

## Backend

- [ ] Mobile Google redirect (`mobile=true`) deployed or available locally
- [ ] Local API reachable from simulator/emulator (see `docs/NETWORKING.md`)

## Phase 1 handoff

When all items above are checked, Phase 1 can begin: server yt-dlp resolver, download queue, AI transcribe/detect, workspace playback.
