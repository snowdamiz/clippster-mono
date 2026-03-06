defmodule ClippsterServer.Repo.Migrations.AddClipsPerProfileToCampaigns do
  use Ecto.Migration

  def change do
    alter table(:clipping_campaigns) do
      add :clips_per_profile, :integer, default: 5
    end
  end
end
