defmodule ClippsterServer.Repo.Migrations.BackfillOrgAdminSubscriptionFields do
  use Ecto.Migration

  def up do
    execute(
      "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pending_subscription_tier varchar"
    )

    execute("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS admin_price_cents integer")
    execute("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS admin_billing_cycle_day integer")
    execute("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_by_admin_id bigint")

    execute(
      "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS setup_completed boolean NOT NULL DEFAULT true"
    )

    execute("UPDATE organizations SET setup_completed = true WHERE setup_completed IS NULL")

    execute("""
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'organizations_created_by_admin_id_fkey'
      ) THEN
        ALTER TABLE organizations
        ADD CONSTRAINT organizations_created_by_admin_id_fkey
        FOREIGN KEY (created_by_admin_id)
        REFERENCES users(id)
        ON DELETE SET NULL;
      END IF;
    END
    $$;
    """)

    execute("""
    CREATE INDEX IF NOT EXISTS organizations_created_by_admin_id_index
    ON organizations (created_by_admin_id)
    """)
  end

  def down do
    execute("DROP INDEX IF EXISTS organizations_created_by_admin_id_index")

    execute(
      "ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_created_by_admin_id_fkey"
    )

    execute("ALTER TABLE organizations DROP COLUMN IF EXISTS setup_completed")
    execute("ALTER TABLE organizations DROP COLUMN IF EXISTS created_by_admin_id")
    execute("ALTER TABLE organizations DROP COLUMN IF EXISTS admin_billing_cycle_day")
    execute("ALTER TABLE organizations DROP COLUMN IF EXISTS admin_price_cents")
    execute("ALTER TABLE organizations DROP COLUMN IF EXISTS pending_subscription_tier")
  end
end
