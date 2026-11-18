defmodule ClippsterServer.Repo.Migrations.AddCreatorSkillPreferences do
  use Ecto.Migration

  def change do
    alter table(:user_creator_profiles) do
      add :creator_skill_preferences, :map
    end
  end
end
