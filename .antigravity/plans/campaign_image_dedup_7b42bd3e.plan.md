---
name: Campaign Image Dedup
overview: Implement content-based deduplication for organization asset uploads to prevent duplicate images when the same file is uploaded multiple times.
todos:
  - id: migration
    content: Create database migration to add content_hash column to organization_assets table with index
    status: completed
  - id: schema
    content: Update OrganizationAsset schema to include content_hash field in schema and changeset
    status: completed
  - id: dedup-logic
    content: "Implement deduplication in create_organization_asset: compute hash, check for existing, return existing or create new"
    status: completed
  - id: backfill
    content: "Optional: Add migration to backfill content_hash for existing assets (can be done separately)"
    status: cancelled
---

# Prevent Duplicate Campaign Image Uploads

## Problem

When editing a campaign and selecting the same cover image, the system creates duplicate files in R2 storage and duplicate records in the database, causing multiple identical images to appear in the Assets page.

## Solution: Content-Hash Deduplication

Add a content hash (SHA-256) to organization assets and check for existing assets with matching hashes before uploading.

---

## Changes Required

### 1. Database Migration - Add content_hash column

Create migration to add `content_hash` field to `organization_assets` table:

```elixir
# priv/repo/migrations/YYYYMMDDHHMMSS_add_content_hash_to_organization_assets.exs
defmodule ClippsterServer.Repo.Migrations.AddContentHashToOrganizationAssets do
  use Ecto.Migration

  def change do
    alter table(:organization_assets) do
      add :content_hash, :string, size: 64  # SHA-256 hex string
    end

    # Index for fast lookup by org + hash
    create index(:organization_assets, [:organization_id, :content_hash])
  end
end
```

### 2. Update OrganizationAsset Schema

Add `content_hash` field to [`server/lib/clippster_server/organizations/organization_asset.ex`](server/lib/clippster_server/organizations/organization_asset.ex):

```elixir
field :content_hash, :string  # SHA-256 hash of file content
```

Update `create_changeset/2` to accept and validate `content_hash`.

### 3. Update Organizations Context

Modify `create_organization_asset/6` in [`server/lib/clippster_server/organizations.ex`](server/lib/clippster_server/organizations.ex):

1. Compute SHA-256 hash of file binary
2. Query for existing asset with same `organization_id` + `content_hash` + `asset_type`
3. If found, return existing asset instead of uploading
4. If not found, upload and create new record with hash
```elixir
def create_organization_asset(organization_id, user_id, asset_type, file_binary, filename, opts \\ []) do
  content_hash = :crypto.hash(:sha256, file_binary) |> Base.encode16(case: :lower)
  
  # Check for existing asset with same content
  case get_asset_by_hash(organization_id, asset_type, content_hash) do
    %OrganizationAsset{} = existing ->
      {:ok, existing}  # Return existing, skip upload
    
    nil ->
      # Proceed with upload as before, but include content_hash
      # ...existing upload logic...
  end
end

defp get_asset_by_hash(organization_id, asset_type, content_hash) do
  OrganizationAsset
  |> where([a], a.organization_id == ^organization_id)
  |> where([a], a.asset_type == ^asset_type)
  |> where([a], a.content_hash == ^content_hash)
  |> preload(:uploaded_by)
  |> Repo.one()
end
```


### 4. Frontend Response Handling (No Changes Needed)

The existing frontend code in [`client/src/components/organization/OrganizationCampaigns.vue`](client/src/components/organization/OrganizationCampaigns.vue) handles the response correctly - it just needs a URL back. Whether it's a new upload or an existing asset, the same response format works.

---

## Files to Modify

- `server/lib/clippster_server/organizations/organization_asset.ex` - Add content_hash field
- `server/lib/clippster_server/organizations.ex` - Add dedup logic in create_organization_asset
- New migration file in `server/priv/repo/migrations/`

## Behavior After Fix

1. User uploads image -> Hash computed -> Check DB for existing
2. If hash exists for this org+type -> Return existing asset URL (no upload)
3. If hash doesn't exist -> Upload to R2 -> Save with hash -> Return new URL
4. Assets page shows only unique images