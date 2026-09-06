defmodule ClippsterServer.Repo.Migrations.AddAiThumbnailVideoContext do
  use Ecto.Migration

  def change do
    alter table(:ai_thumbnail_sessions) do
      add :youtube_url, :text
      add :video_title, :text
      add :transcript, :text
      add :transcript_source, :string
      add :concepts, :jsonb, default: "[]"
      add :video_summary, :map
      add :selected_concept_id, :string
    end
  end
end
