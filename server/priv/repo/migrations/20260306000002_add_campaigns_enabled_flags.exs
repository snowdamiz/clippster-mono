defmodule ClippsterServer.Repo.Migrations.AddCampaignsEnabledFlags do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :campaigns_enabled, :boolean, default: false, null: false
    end

    alter table(:organizations) do
      add :campaigns_enabled, :boolean, default: false, null: false
    end

    # Create indexes for faster queries
    create index(:users, [:campaigns_enabled])
    create index(:organizations, [:campaigns_enabled])
  end
end
