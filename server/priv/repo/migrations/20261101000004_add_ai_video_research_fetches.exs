defmodule ClippsterServer.Repo.Migrations.AddAiVideoResearchFetches do
  use Ecto.Migration

  def change do
    alter table(:ai_video_runs) do
      add :research_fetches, :integer, null: false, default: 0
    end
  end
end
