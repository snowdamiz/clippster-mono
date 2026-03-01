defmodule ClippsterServer.Repo.Migrations.EnhanceClipperSocialAccounts do
  use Ecto.Migration

  def change do
    # Rename old token fields to new encrypted fields (must be outside alter block)
    rename table(:clipper_social_accounts), :access_token, to: :access_token_encrypted
    rename table(:clipper_social_accounts), :refresh_token, to: :refresh_token_encrypted

    # Enhance clipper_social_accounts table with new fields
    alter table(:clipper_social_accounts) do
      add :profile_image_url, :string
      add :connected_at, :utc_datetime
      add :is_active, :boolean, default: true, null: false
    end

    # Create user_posts table for tracking user's published posts
    create table(:user_posts) do
      add :user_id, references(:users, on_delete: :delete_all), null: false

      add :clipper_social_account_id,
          references(:clipper_social_accounts, on_delete: :delete_all), null: false

      add :platform, :string, null: false
      add :post_id, :string, null: false
      add :post_url, :text
      add :caption, :text
      add :media_url, :text, null: false
      add :thumbnail_url, :text
      add :media_type, :string, default: "reel"
      add :status, :string, default: "published", null: false

      # Analytics fields
      add :view_count, :integer, default: 0
      add :like_count, :integer, default: 0
      add :comment_count, :integer, default: 0
      add :save_count, :integer, default: 0
      add :reach_count, :integer, default: 0
      add :impressions_count, :integer, default: 0
      add :synced_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    # Indexes for user_posts
    create index(:user_posts, [:user_id])
    create index(:user_posts, [:clipper_social_account_id])
    create index(:user_posts, [:platform])
    create index(:user_posts, [:status])

    create unique_index(:user_posts, [:platform, :post_id],
             name: :user_posts_platform_post_unique
           )
  end
end
