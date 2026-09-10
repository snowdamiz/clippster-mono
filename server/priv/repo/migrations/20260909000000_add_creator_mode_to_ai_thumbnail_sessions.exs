defmodule ClippsterServer.Repo.Migrations.AddCreatorModeToAiThumbnailSessions do
  use Ecto.Migration

  def change do
    alter table(:ai_thumbnail_sessions) do
      add :creator_mode, :string, null: false, default: "thumbnail"
      add :transcript_backed, :boolean, null: false, default: false
    end

    execute(
      "UPDATE ai_thumbnail_sessions SET transcript_backed = TRUE WHERE transcript IS NOT NULL AND length(btrim(transcript)) >= 50",
      "UPDATE ai_thumbnail_sessions SET transcript_backed = FALSE"
    )

    create index(:ai_thumbnail_sessions, [:user_id, :creator_mode])
  end
end
