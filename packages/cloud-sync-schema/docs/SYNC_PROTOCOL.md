# Cloud Sync Protocol (v1)

Hybrid sync for Clippster projects: **edits always sync**; **raw VOD upload is opt-in per project**.

## Device identity

- Each client generates a stable `device_id` (UUID) stored in SecureStore (mobile) or localStorage (desktop).
- Register on launch: `POST /api/cloud/devices/register` with `{ device_id, platform, device_name }`.

## Snapshot format

See `@clippster/cloud-sync-schema` — `CloudProjectSnapshot` v1 JSON stored in PostgreSQL.

- `schema_version` must be `1`.
- Project `id` matches local SQLite `projects.id`.
- Transcripts larger than 500KB: `raw_json` is gzip+base64 with `compressed: true`.

## Push (last-write-wins)

`PUT /api/cloud/projects/:id`

```json
{
  "snapshot": { ... },
  "device_id": "uuid",
  "client_updated_at": 1719000000000
}
```

- Server stores `server_updated_at` and `last_writer_device_id`.
- If `client_updated_at < server_updated_at` → **409 Conflict** with server snapshot in body.
- Force overwrite: `X-Cloud-Sync-Force: true` header.

## Pull

- `GET /api/cloud/projects` — list summaries; `?since=<sync_token>` for delta.
- `GET /api/cloud/projects/:id` — full snapshot + media manifest.
- Tombstones: soft-deleted projects include `deleted_at`; clients remove locally on pull.

## Bulk delta sync

`POST /api/cloud/projects/sync`

```json
{
  "device_id": "uuid",
  "projects": [{ "id": "uuid", "client_updated_at": 1719000000000 }]
}
```

Returns `{ sync_token, pull_ids[], push_ids[], deleted_ids[] }`.

## Media (optional)

Large files use presigned R2 URLs — never through Phoenix body.

| Route | Purpose |
|-------|---------|
| `POST .../media/presigned-upload` | Reserve quota, get PUT URL |
| `POST .../media/:asset_id/complete` | Finalize checksum |
| `GET .../media/:asset_id/presigned-download` | GET URL |
| `DELETE .../media/:asset_id` | Remove asset, free quota |

R2 key: `users/{user_id}/projects/{project_id}/{asset_id}/{filename}`

## Quota

- Default tier `cloud_none`: 0 bytes (local-only).
- `GET /api/cloud/storage/quota` → `{ bytes_used, bytes_limit, tier }`.
- Presign blocked when `bytes_used + size_estimate > bytes_limit` → 402.

## Conflict resolution (client)

On 409, user chooses: **Keep mine** (force push), **Use cloud** (pull), **Save as copy** (new UUID).
