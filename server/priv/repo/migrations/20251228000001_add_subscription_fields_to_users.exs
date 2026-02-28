defmodule ClippsterServer.Repo.Migrations.AddSubscriptionFieldsToUsers do
  use Ecto.Migration

  def up do
    # Add all subscription fields to the users table
    alter table(:users) do
      # Core subscription status fields
      add_if_not_exists :subscription_status, :string, default: "none"
      add_if_not_exists :subscription_tier, :string
      add_if_not_exists :subscription_start_date, :utc_datetime
      add_if_not_exists :subscription_end_date, :utc_datetime
      add_if_not_exists :subscription_renewal_method, :string
      # Stripe integration fields
      add_if_not_exists :stripe_subscription_id, :string
      add_if_not_exists :stripe_customer_id, :string
    end

    # Create indexes if they don't exist
    execute "CREATE INDEX IF NOT EXISTS users_subscription_status_index ON users (subscription_status)"

    execute "CREATE INDEX IF NOT EXISTS users_subscription_end_date_index ON users (subscription_end_date)"

    execute "CREATE INDEX IF NOT EXISTS users_stripe_subscription_id_index ON users (stripe_subscription_id)"

    execute "CREATE INDEX IF NOT EXISTS users_stripe_customer_id_index ON users (stripe_customer_id)"
  end

  def down do
    alter table(:users) do
      remove_if_exists :subscription_status, :string
      remove_if_exists :subscription_tier, :string
      remove_if_exists :subscription_start_date, :utc_datetime
      remove_if_exists :subscription_end_date, :utc_datetime
      remove_if_exists :subscription_renewal_method, :string
      remove_if_exists :stripe_subscription_id, :string
      remove_if_exists :stripe_customer_id, :string
    end

    execute "DROP INDEX IF EXISTS users_subscription_status_index"
    execute "DROP INDEX IF EXISTS users_subscription_end_date_index"
    execute "DROP INDEX IF EXISTS users_stripe_subscription_id_index"
    execute "DROP INDEX IF EXISTS users_stripe_customer_id_index"
  end
end
