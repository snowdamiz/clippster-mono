defmodule ClippsterServer.Repo.Migrations.AddInstagramSchedulingFields do
  use Ecto.Migration

  def change do
    # ============================================================================
    # Add scheduling fields to post_submissions
    # ============================================================================
    alter table(:post_submissions) do
      # Scheduling fields
      add :scheduled_at, :utc_datetime
      add :started_at, :utc_datetime
      add :completed_at, :utc_datetime
      add :locked_at, :utc_datetime
      
      # Retry tracking
      add :attempts, :integer, default: 0, null: false
      add :max_attempts, :integer, default: 3, null: false
      
      # Link to source clip
      add :clip_id, :string
      
      # Campaign context
      add :campaign_id, references(:clipping_campaigns, on_delete: :nilify_all)
      
      # User social account for personal posts (nullable - org posts use organization_social_account_id)
      add :user_social_account_id, references(:clipper_social_accounts, on_delete: :nilify_all)
      
      # Owner type to distinguish org vs personal posts
      add :owner_type, :string, default: "org", null: false
    end

    # Make organization_id nullable for personal posts
    execute "ALTER TABLE post_submissions ALTER COLUMN organization_id DROP NOT NULL",
            "ALTER TABLE post_submissions ALTER COLUMN organization_id SET NOT NULL"

    create index(:post_submissions, [:scheduled_at])
    create index(:post_submissions, [:status, :scheduled_at])
    create index(:post_submissions, [:user_social_account_id])
    create index(:post_submissions, [:campaign_id])
    create index(:post_submissions, [:owner_type])
    create index(:post_submissions, [:clip_id])

    # ============================================================================
    # Add allow_personal_accounts setting to organizations
    # ============================================================================
    alter table(:organizations) do
      add :allow_personal_instagram, :boolean, default: true, null: false
      add :scheduling_enabled, :boolean, default: true, null: false
    end

    # ============================================================================
    # Create external_post_submissions for link submissions
    # ============================================================================
    create table(:external_post_submissions) do
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      add :campaign_id, references(:clipping_campaigns, on_delete: :nilify_all)
      add :organization_creator_profile_id, references(:organization_creator_profiles, on_delete: :nilify_all)
      add :submitted_by_user_id, references(:users, on_delete: :nilify_all), null: false
      add :clip_id, :string

      # Post details
      add :platform, :string, null: false
      add :post_url, :text, null: false
      add :post_id, :string
      add :caption, :text
      add :media_type, :string

      # Analytics (manually entered or fetched)
      add :view_count, :integer, default: 0
      add :like_count, :integer, default: 0
      add :comment_count, :integer, default: 0
      add :share_count, :integer, default: 0
      add :save_count, :integer, default: 0

      # Status
      add :status, :string, default: "pending", null: false
      add :reviewed_by_user_id, references(:users, on_delete: :nilify_all)
      add :reviewed_at, :utc_datetime
      add :notes, :text

      # Author metadata from platform API
      add :author_username, :string
      add :author_name, :string
      add :author_profile_image, :string

      timestamps()
    end

    create index(:external_post_submissions, [:organization_id])
    create index(:external_post_submissions, [:campaign_id])
    create index(:external_post_submissions, [:organization_creator_profile_id])
    create index(:external_post_submissions, [:submitted_by_user_id])
    create index(:external_post_submissions, [:status])
    create index(:external_post_submissions, [:platform])
    create unique_index(:external_post_submissions, [:platform, :post_url],
      name: :external_post_submissions_platform_url_unique)
  end
end
