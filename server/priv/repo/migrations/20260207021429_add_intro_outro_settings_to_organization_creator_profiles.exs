defmodule ClippsterServer.Repo.Migrations.AddIntroOutroSettingsToOrganizationCreatorProfiles do
  use Ecto.Migration

  def change do
    alter table(:organization_creator_profiles) do
      add :intro_outro_settings, :map, default: %{}, null: false
    end
  end
end
