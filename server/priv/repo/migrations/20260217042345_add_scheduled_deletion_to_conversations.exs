defmodule ClippsterServer.Repo.Migrations.AddScheduledDeletionToConversations do
  use Ecto.Migration

  def change do
    alter table(:conversations) do
      add :scheduled_deletion_at, :utc_datetime
    end
  end
end
