defmodule ClippsterServer.Repo.Migrations.AddNameToAiChatSessions do
  use Ecto.Migration

  def change do
    alter table(:ai_chat_sessions) do
      add :name, :string
    end
  end
end
