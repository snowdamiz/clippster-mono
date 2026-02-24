defmodule ClippsterServer.Repo.Migrations.AddIntroOutroRatioSettingsToCreatorProfiles do
  use Ecto.Migration

  def change do
    alter table(:organization_creator_profiles) do
      add :intro_ratio_settings, :text
      add :outro_ratio_settings, :text
    end
  end
end
