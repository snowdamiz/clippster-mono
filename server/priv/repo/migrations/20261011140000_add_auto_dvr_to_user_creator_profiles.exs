defmodule ClippsterServer.Repo.Migrations.AddAutoDvrToUserCreatorProfiles do
  use Ecto.Migration

  def change do
    alter table(:user_creator_profiles) do
      add :auto_dvr_enabled, :boolean, default: false, null: false
    end
  end
end
