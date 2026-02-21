defmodule ClippsterServer.Repo.Migrations.AddGuidedChatFields do
  use Ecto.Migration

  def change do
    alter table(:ai_chat_sessions) do
      add :scene_plan, :map
      add :conversation_step, :string, default: "welcome"
    end
  end
end
