defmodule ClippsterServer.Repo.Migrations.CreateUserBrandingTables do
  use Ecto.Migration

  def change do
    create table(:user_assets) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      # 'intro', 'outro', 'watermark', 'audio', 'image', 'overlay'
      add :asset_type, :string, null: false
      add :name, :string, null: false
      add :url, :text, null: false
      add :thumbnail_url, :text
      add :duration, :decimal
      add :width, :integer
      add :height, :integer
      add :file_size, :bigint
      add :mime_type, :string
      add :content_hash, :string

      timestamps(type: :utc_datetime)
    end

    create index(:user_assets, [:user_id])
    create index(:user_assets, [:user_id, :asset_type])
    create index(:user_assets, [:user_id, :asset_type, :content_hash])

    create table(:user_creator_profiles) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :name, :string, null: false
      add :description, :string
      add :profile_image_url, :string
      add :intro_id, references(:user_assets, on_delete: :nilify_all)
      add :outro_id, references(:user_assets, on_delete: :nilify_all)
      add :watermark_id, references(:user_assets, on_delete: :nilify_all)
      add :watermark_settings, :map
      add :intro_outro_settings, :map
      add :intro_ratio_settings, :text
      add :outro_ratio_settings, :text
      add :layout_overlays, {:array, :map}
      # streamer | global | personal_studio
      add :scope, :string, null: false, default: "personal_studio"
      add :disabled, :boolean, null: false, default: false
      add :clip_build_defaults, :map
      # Client-local UUID for idempotent sync from desktop/mobile SQLite
      add :client_id, :string

      timestamps(type: :utc_datetime)
    end

    create index(:user_creator_profiles, [:user_id])
    create unique_index(:user_creator_profiles, [:user_id, :client_id],
      name: :user_creator_profiles_user_id_client_id_index,
      where: "client_id IS NOT NULL"
    )
  end
end
