defmodule ClippsterServer.Repo.Migrations.AddPendingSubscriptionTierToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :pending_subscription_tier, :string
    end
  end
end
