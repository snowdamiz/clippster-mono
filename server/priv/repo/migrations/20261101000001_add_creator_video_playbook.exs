defmodule ClippsterServer.Repo.Migrations.AddCreatorVideoPlaybook do
  use Ecto.Migration

  def change do
    alter table(:user_creator_profiles) do
      add :video_playbook, :map
    end
  end
end
