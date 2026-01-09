defmodule ClippsterServer.Repo.Migrations.CreateClipperProfiles do
  use Ecto.Migration

  def change do
    # Main clipper profiles table
    create table(:clipper_profiles) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :display_name, :string
      add :bio, :text
      add :avatar_url, :string
      add :slug, :string
      add :is_public, :boolean, default: false
      add :looking_for_work, :boolean, default: false
      add :experience_level, :string  # beginner, intermediate, experienced, professional
      add :specialty_tags, {:array, :string}, default: []
      add :content_style_tags, {:array, :string}, default: []
      add :preferred_platforms, {:array, :string}, default: []
      add :languages, {:array, :string}, default: []
      add :timezone, :string
      add :response_time_hours, :integer
      add :is_verified, :boolean, default: false
      add :total_campaigns_completed, :integer, default: 0
      add :total_clips_delivered, :integer, default: 0
      add :total_endorsements, :integer, default: 0

      timestamps(type: :utc_datetime)
    end

    create unique_index(:clipper_profiles, [:user_id])
    create unique_index(:clipper_profiles, [:slug])
    create index(:clipper_profiles, [:is_public])
    create index(:clipper_profiles, [:looking_for_work])
    create index(:clipper_profiles, [:experience_level])
    create index(:clipper_profiles, [:is_verified])

    # Channel links - links to clipper's clip channels (TikTok, YouTube, etc.)
    create table(:clipper_channel_links) do
      add :clipper_profile_id, references(:clipper_profiles, on_delete: :delete_all), null: false
      add :platform, :string, null: false  # tiktok, youtube, instagram, x, kick, twitch
      add :url, :string, null: false
      add :username, :string
      add :display_order, :integer, default: 0

      timestamps(type: :utc_datetime)
    end

    create index(:clipper_channel_links, [:clipper_profile_id])
    create unique_index(:clipper_channel_links, [:clipper_profile_id, :platform])

    # Portfolio clips - showcase clips (max 3)
    create table(:clipper_portfolio_clips) do
      add :clipper_profile_id, references(:clipper_profiles, on_delete: :delete_all), null: false
      add :title, :string
      add :video_url, :string, null: false
      add :thumbnail_url, :string
      add :duration, :decimal  # seconds
      add :file_size, :bigint  # bytes
      add :display_order, :integer, default: 0

      timestamps(type: :utc_datetime)
    end

    create index(:clipper_portfolio_clips, [:clipper_profile_id])

    # Endorsements from organizations
    create table(:clipper_endorsements) do
      add :clipper_profile_id, references(:clipper_profiles, on_delete: :delete_all), null: false
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      add :endorsed_by_user_id, references(:users, on_delete: :nilify_all)
      add :campaign_id, references(:clipping_campaigns, on_delete: :nilify_all)
      add :content, :text
      add :rating, :integer  # 1-5 stars

      timestamps(type: :utc_datetime)
    end

    create index(:clipper_endorsements, [:clipper_profile_id])
    create index(:clipper_endorsements, [:organization_id])
    create unique_index(:clipper_endorsements, [:clipper_profile_id, :organization_id])

    # Badges earned by clippers
    create table(:clipper_badges) do
      add :clipper_profile_id, references(:clipper_profiles, on_delete: :delete_all), null: false
      add :badge_type, :string, null: false  # verified, top_clipper, rising_star
      add :earned_at, :utc_datetime, null: false
      add :expires_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:clipper_badges, [:clipper_profile_id])
    create unique_index(:clipper_badges, [:clipper_profile_id, :badge_type])

    # Leaderboard entries (weekly/monthly snapshots)
    create table(:clipper_leaderboard_entries) do
      add :clipper_profile_id, references(:clipper_profiles, on_delete: :delete_all), null: false
      add :period_type, :string, null: false  # weekly, monthly
      add :period_start, :date, null: false
      add :period_end, :date, null: false
      add :rank, :integer
      add :clips_delivered, :integer, default: 0
      add :campaigns_active, :integer, default: 0
      add :endorsements_received, :integer, default: 0
      add :score, :integer, default: 0

      timestamps(type: :utc_datetime)
    end

    create index(:clipper_leaderboard_entries, [:clipper_profile_id])
    create index(:clipper_leaderboard_entries, [:period_type, :period_start])
    create unique_index(:clipper_leaderboard_entries, [:clipper_profile_id, :period_type, :period_start])
  end
end
