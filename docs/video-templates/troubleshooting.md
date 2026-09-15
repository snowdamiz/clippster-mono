# Instant Edit troubleshooting

## Template is incompatible

Check the manifest's platform, aspect ratio, minimum app version, and required capabilities. Android intentionally rejects unsupported definitions instead of flattening effects. iOS is currently unvalidated.

## Required slot is empty

Import a compatible video/image with enough source duration. The slot row reports type, duration, role, and assignment reason. Lock creator-selected shots before regenerating.

## Source media is missing

Reconnect or re-import the original file. Instances store source fingerprints and local project media IDs; distributable definitions never store absolute local paths.

## Preview differs from export

Confirm that export uses the same instance and original assets. Record input hash, renderer route, aspect, FPS, timestamp, and whether hardware fallback was used; then run the parity fixtures.

## Android export is unavailable

Rebuild the development app with `@clippster/editor-native`, confirm media permissions, and ensure native export capability is available. The editor rejects export in a generic Expo client.

## Import rejected

Treat path, hash, MIME, schema, capability, archive-limit, and rights failures as actionable security errors. Do not bypass validation; repair and repackage from trusted source files.

Cancellation should leave the prior project untouched. If partial files remain after a crash, remove only unpromoted staging data, never an existing instance.
