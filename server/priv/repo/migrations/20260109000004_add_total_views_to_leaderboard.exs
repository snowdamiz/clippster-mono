defmodule ClippsterServer.Repo.Migrations.AddTotalViewsToLeaderboard do
  use Ecto.Migration

  def change do
    alter table(:clipper_leaderboard_entries) do
      add :total_views, :integer, default: 0
    end
  end
end
