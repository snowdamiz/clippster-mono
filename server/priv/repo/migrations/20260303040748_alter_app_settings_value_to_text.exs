defmodule ClippsterServer.Repo.Migrations.AlterAppSettingsValueToText do
  use Ecto.Migration

  def change do
    alter table(:app_settings) do
      modify :value, :text, null: false
    end
  end
end
