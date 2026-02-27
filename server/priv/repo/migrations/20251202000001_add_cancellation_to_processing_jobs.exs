defmodule ClippsterServer.Repo.Migrations.AddCancellationToProcessingJobs do
  use Ecto.Migration

  def change do
    alter table(:processing_jobs) do
      # Add cancelled status support and refund tracking
      add :cancelled_at, :utc_datetime
      add :credits_refunded, :decimal, precision: 10, scale: 4, default: 0
      add :refund_reason, :string
      # Client-provided project identifier
      add :project_id, :string
      # Type of processing job
      add :job_type, :string, default: "clip_detection"
    end

    # Update status constraint to include 'cancelled'
    # Status can now be: 'processing', 'completed', 'failed', 'cancelled'
    create index(:processing_jobs, [:project_id])
    create index(:processing_jobs, [:cancelled_at])
  end
end
