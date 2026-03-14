defmodule ClippsterServer.Repo.Migrations.AddThumbnailUrlToAiChatSessions do
  use Ecto.Migration

  def change do
    alter table(:ai_chat_sessions) do
      add :thumbnail_url, :text
    end
  end
end
