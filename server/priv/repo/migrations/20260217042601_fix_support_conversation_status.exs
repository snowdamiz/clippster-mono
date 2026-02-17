defmodule ClippsterServer.Repo.Migrations.FixSupportConversationStatus do
  use Ecto.Migration

  def up do
    execute """
    UPDATE conversations 
    SET 
      status = 'open',
      archived_at = NULL,
      archived_by_user_id = NULL,
      scheduled_deletion_at = NULL
    WHERE type = 'support' AND status = 'archived'
    """
  end

  def down do
    # No rollback needed
  end
end
