defmodule ClippsterServer.Repo.Migrations.BackfillOrgOwnerAccountType do
  use Ecto.Migration

  def up do
    execute """
    UPDATE users
    SET account_type = 'organization', updated_at = NOW()
    WHERE owned_organization_id IS NOT NULL
      AND (account_type IS NULL OR account_type != 'organization')
    """
  end

  def down do
    # No-op: cannot safely revert — would break correctly typed org owners
    :ok
  end
end
