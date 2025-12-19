defmodule ClippsterServer.Repo.Migrations.CreatePostSubmissions do
  use Ecto.Migration

  def change do
    create table(:post_submissions) do
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      add :organization_social_account_id, references(:organization_social_accounts, on_delete: :nilify_all)
      add :organization_creator_profile_id, references(:organization_creator_profiles, on_delete: :nilify_all)
      add :submitted_by_user_id, references(:users, on_delete: :nilify_all), null: false

      # Platform and post identification
      add :platform, :string, null: false
      add :post_id, :string
      add :post_url, :string
      add :media_type, :string  # "image", "video", "carousel", "reel", "story"

      # Post content
      add :caption, :text
      add :media_url, :string  # Original media URL used for publishing
      add :thumbnail_url, :string

      # Analytics fields
      add :view_count, :integer, default: 0
      add :like_count, :integer, default: 0
      add :comment_count, :integer, default: 0
      add :share_count, :integer, default: 0
      add :save_count, :integer, default: 0
      add :reach_count, :integer, default: 0
      add :impressions_count, :integer, default: 0

      # Timestamps and sync
      add :posted_at, :utc_datetime
      add :last_synced_at, :utc_datetime
      add :manual_override, :boolean, default: false, null: false

      # Status tracking
      add :status, :string, default: "pending", null: false  # pending, publishing, published, failed

      # Error tracking
      add :error_message, :text

      timestamps()
    end

    create index(:post_submissions, [:organization_id])
    create index(:post_submissions, [:organization_social_account_id])
    create index(:post_submissions, [:organization_creator_profile_id])
    create index(:post_submissions, [:submitted_by_user_id])
    create index(:post_submissions, [:platform])
    create index(:post_submissions, [:status])
    create index(:post_submissions, [:posted_at])
    create unique_index(:post_submissions, [:platform, :post_id],
      name: :post_submissions_platform_post_unique,
      where: "post_id IS NOT NULL")
  end
end
