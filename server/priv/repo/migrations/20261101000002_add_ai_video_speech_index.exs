defmodule ClippsterServer.Repo.Migrations.AddAiVideoSpeechIndex do
  use Ecto.Migration

  def change do
    alter table(:ai_chat_sessions) do
      add :speech_index, :map, default: %{}
    end
  end
end
