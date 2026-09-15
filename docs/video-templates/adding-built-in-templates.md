# Adding a built-in video template

1. Add a typed spec to `packages/template-schema/src/catalog.ts`.
2. Use an original name and visual treatment; do not imitate a creator, TikTok/CapCut trade dress, or proprietary package.
3. Include 9:16, plus every genuinely supported desktop/Android aspect.
4. Define slot roles/count, duration, reuse, fallback, audio policy, anchors, accessibility, and rights.
5. Keep platform compatibility explicit. Do not mark iOS until its renderer/export fixtures pass.
6. Run:
   - `yarn workspace @clippster/template-schema test`
   - `yarn workspace @clippster/template-schema typecheck`
   - `cd client && yarn test src/editor/templates`
   - `yarn workspace mobile test`
   - desktop and Android typechecks/builds
7. Test with one long source and a mixed multi-asset set.
8. Export on Tauri and Android; check duration, resolution, playable audio/video, source bounds, and representative transition/caption frames.
9. Add or update rights proof before review.

Catalog definitions are immutable. Editing an existing template requires a new `versionId` and semantic version.
