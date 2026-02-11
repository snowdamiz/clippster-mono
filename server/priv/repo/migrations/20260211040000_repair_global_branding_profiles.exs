defmodule ClippsterServer.Repo.Migrations.RepairGlobalBrandingProfiles do
  @moduledoc """
  Repair migration: adds columns that were supposed to be added by
  20260211000001_add_global_branding_profiles but were skipped due to
  a duplicate timestamp collision with create_affiliate_tables.

  Uses execute/1 with IF NOT EXISTS checks so this is safe to run
  even if the columns somehow already exist.
  """
  use Ecto.Migration

  def up do
    # organization_creator_profiles.scope
    execute """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organization_creator_profiles' AND column_name = 'scope'
      ) THEN
        ALTER TABLE organization_creator_profiles ADD COLUMN scope varchar(255) NOT NULL DEFAULT 'streamer';
      END IF;
    END $$;
    """

    # organization_members.branding_profile_id
    execute """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organization_members' AND column_name = 'branding_profile_id'
      ) THEN
        ALTER TABLE organization_members ADD COLUMN branding_profile_id bigint REFERENCES organization_creator_profiles(id) ON DELETE SET NULL;
      END IF;
    END $$;
    """

    # clipping_campaigns.branding_profile_id
    execute """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clipping_campaigns' AND column_name = 'branding_profile_id'
      ) THEN
        ALTER TABLE clipping_campaigns ADD COLUMN branding_profile_id bigint REFERENCES organization_creator_profiles(id) ON DELETE SET NULL;
      END IF;
    END $$;
    """

    # Index for scope lookup (safe with IF NOT EXISTS)
    execute """
    CREATE INDEX IF NOT EXISTS organization_creator_profiles_organization_id_scope_index
    ON organization_creator_profiles (organization_id, scope)
    """
  end

  def down do
    execute "DROP INDEX IF EXISTS organization_creator_profiles_organization_id_scope_index"

    alter table(:clipping_campaigns) do
      remove :branding_profile_id
    end

    alter table(:organization_members) do
      remove :branding_profile_id
    end

    alter table(:organization_creator_profiles) do
      remove :scope
    end
  end
end
