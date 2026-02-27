defmodule ClippsterServer.Repo.Migrations.CreateAppSettings do
  use Ecto.Migration

  def change do
    create table(:app_settings, primary_key: false) do
      add :key, :string, primary_key: true
      add :value, :string, null: false

      timestamps()
    end

    # Seed the default feature flag
    execute(
      """
      INSERT INTO app_settings (key, value, inserted_at, updated_at)
      VALUES ('live_clip_enabled', 'true', NOW(), NOW())
      """,
      """
      DELETE FROM app_settings WHERE key = 'live_clip_enabled'
      """
    )
  end
end
