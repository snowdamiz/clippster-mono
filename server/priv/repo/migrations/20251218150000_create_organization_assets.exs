defmodule ClippsterServer.Repo.Migrations.CreateOrganizationAssets do
  use Ecto.Migration

  def change do
    create table(:organization_assets) do
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      # 'intro', 'outro', 'watermark', 'audio', 'image'
      add :asset_type, :string, null: false
      add :name, :string, null: false
      add :url, :text, null: false
      add :thumbnail_url, :text
      add :duration, :decimal
      add :width, :integer
      add :height, :integer
      add :file_size, :bigint
      add :mime_type, :string
      add :uploaded_by_user_id, references(:users, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:organization_assets, [:organization_id])
    create index(:organization_assets, [:organization_id, :asset_type])
    create index(:organization_assets, [:uploaded_by_user_id])
  end
end
