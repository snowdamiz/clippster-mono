defmodule ClippsterServer.Repo.Migrations.CreateAiUsageLogs do
  use Ecto.Migration

  def change do
    create table(:ai_usage_logs) do
      add :user_id, references(:users, on_delete: :nothing), null: false
      add :project_id, :string
      # "openrouter", "whisper"
      add :provider, :string, null: false
      # "z-ai/glm-4.7, "whisper-1"
      add :model, :string
      add :input_tokens, :integer
      add :output_tokens, :integer
      add :total_tokens, :integer
      # For audio processing
      add :duration_seconds, :decimal
      # "transcription", "clip_generation"
      add :operation_type, :string, null: false
      # Estimated credit cost
      add :cost_credits, :decimal

      timestamps(type: :utc_datetime)
    end

    create index(:ai_usage_logs, [:user_id])
    create index(:ai_usage_logs, [:provider])
    create index(:ai_usage_logs, [:operation_type])
  end
end
