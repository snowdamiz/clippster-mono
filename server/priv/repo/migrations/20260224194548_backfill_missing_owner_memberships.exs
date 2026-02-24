defmodule ClippsterServer.Repo.Migrations.BackfillMissingOwnerMemberships do
  use Ecto.Migration

  def up do
    # Find all organizations where the owner is not in organization_members
    # and add them with "owner" role
    execute """
    INSERT INTO organization_members (organization_id, user_id, role, joined_at, inserted_at, updated_at)
    SELECT 
      o.id as organization_id,
      o.owner_id as user_id,
      'owner' as role,
      o.inserted_at as joined_at,
      NOW() as inserted_at,
      NOW() as updated_at
    FROM organizations o
    WHERE NOT EXISTS (
      SELECT 1 
      FROM organization_members om 
      WHERE om.organization_id = o.id 
      AND om.user_id = o.owner_id
    )
    AND o.owner_id IS NOT NULL
    ON CONFLICT (organization_id, user_id) DO NOTHING
    """
  end

  def down do
    # No-op - we don't want to remove owner memberships on rollback
    :ok
  end
end
