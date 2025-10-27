defmodule ClippsterServer.Repo.Migrations.CreateProcessingJobs do
  use Ecto.Migration

  def change do
    create table(:processing_jobs) do
      add :user_id, references(:users, on_delete: :restrict), null: false
      add :video_duration_hours, :decimal, precision: 10, scale: 2, null: false
      add :credits_deducted, :decimal, precision: 10, scale: 2, null: false
      add :status, :string, null: false # 'processing', 'completed', 'failed'
      add :video_url, :text
      add :result_data, :map # JSONB for clip results

      timestamps(type: :utc_datetime)
    end

    create index(:processing_jobs, [:user_id])
    create index(:processing_jobs, [:status])
  end
end
