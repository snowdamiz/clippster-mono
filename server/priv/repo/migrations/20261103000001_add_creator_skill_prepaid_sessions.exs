defmodule ClippsterServer.Repo.Migrations.AddCreatorSkillPrepaidSessions do
  use Ecto.Migration

  def up do
    alter table(:ai_chat_sessions) do
      add :creator_skill_job_id, references(:processing_jobs, on_delete: :nilify_all)
      add :creator_skill_prepaid, :boolean, null: false, default: false
    end

    create index(:ai_chat_sessions, [:creator_skill_job_id])

    execute """
    UPDATE ai_chat_sessions
    SET creator_skill_prepaid = true
    WHERE playbook_enabled = true AND name LIKE 'Clippster Skill %'
    """
  end

  def down do
    drop index(:ai_chat_sessions, [:creator_skill_job_id])

    alter table(:ai_chat_sessions) do
      remove :creator_skill_job_id
      remove :creator_skill_prepaid
    end
  end
end
