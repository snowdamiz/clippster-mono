defmodule ClippsterServer.Repo.Migrations.AddReliabilityFields do
  use Ecto.Migration

  def change do
    # Create rate_limit_states table for tracking API quota
    create table(:rate_limit_states) do
      add :endpoint, :string, null: false
      add :social_account_id, references(:organization_social_accounts, on_delete: :delete_all)
      add :limit_value, :integer
      add :remaining, :integer
      add :reset_at, :utc_datetime
      add :last_checked_at, :utc_datetime

      timestamps()
    end

    create unique_index(:rate_limit_states, [:endpoint, :social_account_id])

    # Add content_hash column to post_submissions for duplicate detection
    alter table(:post_submissions) do
      add :content_hash, :string
    end

    create index(:post_submissions, [:organization_social_account_id, :content_hash])
  end
end
