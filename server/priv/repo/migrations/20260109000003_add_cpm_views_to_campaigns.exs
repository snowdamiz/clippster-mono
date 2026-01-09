defmodule ClippsterServer.Repo.Migrations.AddCpmViewsToCampaigns do
  use Ecto.Migration

  def change do
    alter table(:clipping_campaigns) do
      # CPM views - the number of views the CPM price applies to
      # e.g., cpm=5.00 with cpm_views=1000 means $5 per 1000 views
      # cpm=2.50 with cpm_views=500 means $2.50 per 500 views
      add :cpm_views, :integer, default: 1000
    end
  end
end
