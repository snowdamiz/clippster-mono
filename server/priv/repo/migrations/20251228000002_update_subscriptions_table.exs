defmodule ClippsterServer.Repo.Migrations.UpdateSubscriptionsTable do
  use Ecto.Migration

  def change do
    alter table(:subscriptions) do
      # Add subscription tier field
      add :subscription_tier, :string
      # Add credits_granted to track how many credits were given with this subscription period
      add :credits_granted, :decimal, precision: 10, scale: 2, default: 0
    end

    create index(:subscriptions, [:subscription_tier])
  end
end
