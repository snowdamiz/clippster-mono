defmodule ClippsterServer.Repo.Migrations.AddMaxViewsToCampaigns do
  use Ecto.Migration

  def change do
    alter table(:clipping_campaigns) do
      add :max_views, :bigint
    end
  end
end
