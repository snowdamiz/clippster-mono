defmodule ClippsterServer.Repo.Migrations.AddContentHashToOrganizationAssets do
  use Ecto.Migration

  def change do
    alter table(:organization_assets) do
      # SHA-256 hex string
      add :content_hash, :string, size: 64
    end

    # Index for fast lookup by org + hash + asset_type
    create index(:organization_assets, [:organization_id, :asset_type, :content_hash])
  end
end
