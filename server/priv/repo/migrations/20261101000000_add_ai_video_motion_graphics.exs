defmodule ClippsterServer.Repo.Migrations.AddAIVideoMotionGraphics do
  use Ecto.Migration

  def change do
    alter table(:ai_chat_sessions) do
      add :motion_graphics, :string, default: "light", null: false
      add :playbook_enabled, :boolean, default: false, null: false
      add :creator_profile_id, :bigint
    end
  end
end
