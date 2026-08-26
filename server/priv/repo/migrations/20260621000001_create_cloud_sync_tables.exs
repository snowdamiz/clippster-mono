defmodule ClippsterServer.Repo.Migrations.CreateCloudSyncTables do
  use Ecto.Migration

  def change do
    create table(:cloud_projects, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :name, :string, null: false
      add :schema_version, :integer, null: false, default: 1
      add :deleted_at, :utc_datetime
      add :last_writer_device_id, :uuid
      add :server_updated_at, :utc_datetime, null: false
      add :client_updated_at, :bigint

      timestamps(type: :utc_datetime)
    end

    create index(:cloud_projects, [:user_id])
    create index(:cloud_projects, [:user_id, :deleted_at])
    create index(:cloud_projects, [:server_updated_at])

    create table(:cloud_project_snapshots) do
      add :cloud_project_id, references(:cloud_projects, type: :uuid, on_delete: :delete_all),
        null: false

      add :snapshot_json, :map, null: false
      add :snapshot_version, :integer, null: false, default: 1

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create index(:cloud_project_snapshots, [:cloud_project_id])
    create index(:cloud_project_snapshots, [:cloud_project_id, :inserted_at])

    create table(:cloud_media_assets, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :cloud_project_id, references(:cloud_projects, type: :uuid, on_delete: :delete_all),
        null: false

      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :asset_type, :string, null: false
      add :r2_key, :string, null: false
      add :filename, :string, null: false
      add :size_bytes, :bigint, null: false, default: 0
      add :reserved_bytes, :bigint, null: false, default: 0
      add :checksum, :string
      add :upload_status, :string, null: false, default: "pending"
      add :optional, :boolean, null: false, default: true

      timestamps(type: :utc_datetime)
    end

    create index(:cloud_media_assets, [:cloud_project_id])
    create index(:cloud_media_assets, [:user_id])
    create unique_index(:cloud_media_assets, [:r2_key])

    create table(:user_storage_quotas) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :tier, :string, null: false, default: "cloud_none"
      add :bytes_used, :bigint, null: false, default: 0
      add :bytes_limit, :bigint, null: false, default: 0

      timestamps(type: :utc_datetime)
    end

    create unique_index(:user_storage_quotas, [:user_id])

    create table(:cloud_sync_devices, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :device_id, :uuid, null: false
      add :platform, :string, null: false
      add :device_name, :string
      add :last_seen_at, :utc_datetime, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:cloud_sync_devices, [:user_id, :device_id])
    create index(:cloud_sync_devices, [:user_id])
  end
end
