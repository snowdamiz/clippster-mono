defmodule ClippsterServer.Repo.Migrations.AddPendingSubscriptionTierToOrganizations do
  use Ecto.Migration

  def change do
    alter table(:organizations) do
      add :pending_subscription_tier, :string
      add :admin_price_cents, :integer
      add :admin_billing_cycle_day, :integer
      add :created_by_admin_id, :integer
      add :setup_completed, :boolean, default: true
    end
  end
end
