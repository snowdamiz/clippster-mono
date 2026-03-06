defmodule ClippsterServer.Repo.Migrations.AddNotifyCampaignsPreference do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :notify_campaigns, :boolean, default: true
    end
  end
end
