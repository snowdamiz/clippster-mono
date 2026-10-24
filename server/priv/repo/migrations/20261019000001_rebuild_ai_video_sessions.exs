defmodule ClippsterServer.Repo.Migrations.RebuildAiVideoSessions do
  use Ecto.Migration

  @old_editor_notice "This project was made with the previous AI editor, which has been replaced. Its old edit can't be opened anymore. Press Go to rebuild it with the new editor."

  def up do
    execute("DELETE FROM ai_chat_messages WHERE role = 'system'")

    execute("""
    INSERT INTO ai_chat_messages (role, content, metadata, session_id, inserted_at, updated_at)
    SELECT 'assistant', '#{String.replace(@old_editor_notice, "'", "''")}', '{"type":"notice"}'::jsonb, id, NOW(), NOW()
    FROM ai_chat_sessions
    WHERE composition IS NOT NULL
    """)

    alter table(:ai_chat_sessions) do
      remove :composition
      remove :refinement_round
      remove :refinement_messages_used
      remove :max_refinement_rounds
      remove :max_messages_per_round
      remove :style_context
      remove :reference_analysis
      remove :media_analysis
      remove :reference_url

      add :request, :text
      add :reference, :jsonb
      add :reference_blueprint, :jsonb
      add :reference_labels, :jsonb
      add :source_index, :jsonb, default: "{}"
      add :document, :jsonb
      add :composition_files, :jsonb, default: "{}"
    end

    execute("ALTER TABLE ai_chat_sessions ALTER COLUMN status SET DEFAULT 'draft'")
    execute("UPDATE ai_chat_sessions SET status = 'draft'")

    create table(:ai_video_runs) do
      add :kind, :string, null: false
      add :status, :string, null: false, default: "running"
      add :request, :text
      add :credits_charged, :integer, null: false, default: 0
      add :refunded, :boolean, null: false, default: false
      add :turns, :integer, null: false, default: 0
      add :label_calls, :integer, null: false, default: 0
      add :messages, :jsonb, null: false, default: "[]"
      add :finish, :jsonb
      add :cost_usd, :decimal, null: false, default: 0
      add :error, :text

      add :session_id, references(:ai_chat_sessions, on_delete: :nilify_all)
      add :user_id, references(:users, on_delete: :delete_all), null: false

      timestamps(type: :utc_datetime)
    end

    create index(:ai_video_runs, [:session_id])
    create index(:ai_video_runs, [:user_id])
    create index(:ai_video_runs, [:kind, :inserted_at])

    create unique_index(:ai_video_runs, [:session_id],
             name: :ai_video_runs_one_running_agent_run,
             where: "status = 'running' AND kind IN ('generate', 'revise')"
           )

    alter table(:ai_usage_logs) do
      add :cached_tokens, :integer
      add :cache_write_tokens, :integer
      add :cost_usd, :decimal
      add :ai_video_run_id, references(:ai_video_runs, on_delete: :nilify_all)
    end

    create index(:ai_usage_logs, [:ai_video_run_id])
  end

  def down do
    alter table(:ai_usage_logs) do
      remove :ai_video_run_id
      remove :cost_usd
      remove :cache_write_tokens
      remove :cached_tokens
    end

    drop table(:ai_video_runs)

    execute("UPDATE ai_chat_sessions SET status = 'discovery'")
    execute("ALTER TABLE ai_chat_sessions ALTER COLUMN status SET DEFAULT 'discovery'")

    alter table(:ai_chat_sessions) do
      remove :composition_files
      remove :document
      remove :source_index
      remove :reference_labels
      remove :reference_blueprint
      remove :reference
      remove :request

      add :composition, :jsonb
      add :refinement_round, :integer, default: 0, null: false
      add :refinement_messages_used, :integer, default: 0, null: false
      add :max_refinement_rounds, :integer, default: 3, null: false
      add :max_messages_per_round, :integer, default: 6, null: false
      add :style_context, :jsonb, default: "{}"
      add :reference_analysis, :jsonb
      add :media_analysis, :jsonb
      add :reference_url, :text
    end
  end
end
