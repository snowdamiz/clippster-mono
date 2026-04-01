defmodule ClippsterServer.Repo.Migrations.FixZeroPriceOrgSetup do
  use Ecto.Migration

  def up do
    # For any organization created by an admin with $0 monthly price,
    # automatically mark setup_completed as true so they don't get stuck
    # at a payment gate for a free org.
    execute("""
    UPDATE organizations
    SET setup_completed = true
    WHERE created_by_admin_id IS NOT NULL
      AND setup_completed = false
      AND (admin_price_cents = 0 OR admin_price_cents IS NULL)
    """)
  end

  def down do
    # No-op: we don't want to revert free orgs back to incomplete setup
    :ok
  end
end
