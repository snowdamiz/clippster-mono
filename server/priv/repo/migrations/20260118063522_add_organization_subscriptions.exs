defmodule ClippsterServer.Repo.Migrations.AddOrganizationSubscriptions do
  use Ecto.Migration

  def change do
    # Add subscription fields to organizations table
    alter table(:organizations) do
      add_if_not_exists :subscription_status, :string, default: "none"
      add_if_not_exists :subscription_tier, :string
      add_if_not_exists :subscription_start_date, :utc_datetime
      add_if_not_exists :subscription_end_date, :utc_datetime
      add_if_not_exists :subscription_renewal_method, :string
      add_if_not_exists :stripe_subscription_id, :string
      add_if_not_exists :stripe_customer_id, :string
      add_if_not_exists :max_seats, :integer
      add_if_not_exists :monthly_credits, :integer, default: 0
    end

    create_if_not_exists index(:organizations, [:stripe_subscription_id])
    create_if_not_exists index(:organizations, [:stripe_customer_id])
    create_if_not_exists index(:organizations, [:subscription_status])

    # Drop and recreate organization_subscription_addons table to ensure clean state
    execute "DROP TABLE IF EXISTS organization_subscription_addons CASCADE"

    # Create organization_subscription_addons table
    create table(:organization_subscription_addons) do
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      add :addon_tier, :string, null: false
      add :status, :string, default: "active", null: false
      add :stripe_subscription_id, :string
      add :start_date, :utc_datetime, null: false
      add :end_date, :utc_datetime, null: false
      add :seats, :integer, default: 0
      add :monthly_credits, :integer, default: 0

      timestamps(type: :utc_datetime)
    end

    create index(:organization_subscription_addons, [:organization_id])
    create index(:organization_subscription_addons, [:stripe_subscription_id])
    create index(:organization_subscription_addons, [:status])

    # Drop and recreate organization_subscriptions table to ensure clean state
    execute "DROP TABLE IF EXISTS organization_subscriptions CASCADE"

    # Create organization_subscriptions table (history)
    create table(:organization_subscriptions) do
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      # "base" or "addon"
      add :subscription_type, :string, null: false
      add :tier, :string, null: false
      add :status, :string, null: false
      add :start_date, :utc_datetime, null: false
      add :end_date, :utc_datetime, null: false
      add :seats, :integer, default: 0
      add :credits_granted, :decimal, precision: 20, scale: 2, default: 0
      add :payment_method, :string, null: false
      add :stripe_subscription_id, :string
      add :stripe_session_id, :string
      add :amount_usd, :decimal, precision: 10, scale: 2

      timestamps(type: :utc_datetime)
    end

    create index(:organization_subscriptions, [:organization_id])
    create index(:organization_subscriptions, [:stripe_subscription_id])
    create index(:organization_subscriptions, [:stripe_session_id])
    create index(:organization_subscriptions, [:status])
  end
end
