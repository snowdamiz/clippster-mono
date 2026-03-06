defmodule ClippsterServer.Repo.Migrations.AddOrganizationIdToProcessingJobs do
  use Ecto.Migration

  def change do
    alter table(:processing_jobs) do
      # Add organization_id for tracking jobs that use org credits
      add :organization_id, references(:organizations, on_delete: :nilify_all)
    end

    create index(:processing_jobs, [:organization_id])
  end
end
