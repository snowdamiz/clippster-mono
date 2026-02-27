defmodule ClippsterServer.Repo.Migrations.FixAiUsageLogsUserConstraint do
  use Ecto.Migration

  def up do
    # Drop the existing foreign key constraint
    drop constraint(:ai_usage_logs, "ai_usage_logs_user_id_fkey")

    # Add new foreign key constraint with on_delete: :delete_all
    alter table(:ai_usage_logs) do
      modify :user_id, references(:users, on_delete: :delete_all), null: false
    end
  end

  def down do
    # Revert to original constraint
    drop constraint(:ai_usage_logs, "ai_usage_logs_user_id_fkey")

    alter table(:ai_usage_logs) do
      modify :user_id, references(:users, on_delete: :nothing), null: false
    end
  end
end
