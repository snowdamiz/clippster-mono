defmodule ClippsterServer.Repo.Migrations.AddLeaderboardTypeToEntries do
  use Ecto.Migration

  def change do
    alter table(:clipper_leaderboard_entries) do
      add :leaderboard_type, :string, default: "campaigns"
    end

    create index(:clipper_leaderboard_entries, [:leaderboard_type])
    create index(:clipper_leaderboard_entries, [:period_type, :leaderboard_type, :period_start])

    # Update the unique constraint to include leaderboard_type
    drop_if_exists unique_index(:clipper_leaderboard_entries, [
                     :clipper_profile_id,
                     :period_type,
                     :period_start
                   ])

    create unique_index(:clipper_leaderboard_entries, [
             :clipper_profile_id,
             :leaderboard_type,
             :period_type,
             :period_start
           ])
  end
end
