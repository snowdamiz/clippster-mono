defmodule ClippsterServer.Repo.Migrations.AddCampaignResourcesAndAnalytics do
  use Ecto.Migration

  def change do
    alter table(:clipping_campaigns) do
      add :content_vertical, :string
      add :campaign_goal, :string
      add :content_style_tags, {:array, :string}, default: []
    end

    create table(:campaign_resources) do
      add :campaign_id, references(:clipping_campaigns, on_delete: :delete_all), null: false
      add :resource_type, :string, null: false
      add :source_platform, :string
      add :url, :text
      add :title, :string
      add :description, :text
      add :sort_order, :integer, default: 0
      add :metadata, :map, default: %{}

      timestamps(type: :utc_datetime)
    end

    create index(:campaign_resources, [:campaign_id])

    alter table(:campaign_submissions) do
      add :reach_count, :integer, default: 0
      add :impressions_count, :integer, default: 0
      add :feed_match_status, :string
      add :verification_warnings, {:array, :string}, default: []
      add :metrics_last_synced_at, :utc_datetime
    end

    create table(:campaign_submission_metric_snapshots) do
      add :submission_id, references(:campaign_submissions, on_delete: :delete_all), null: false
      add :source, :string, null: false, default: "postforme_feed"
      add :provider_account_id, :string
      add :feed_match_status, :string
      add :view_count, :integer
      add :like_count, :integer
      add :comment_count, :integer
      add :share_count, :integer
      add :save_count, :integer
      add :reach_count, :integer
      add :impressions_count, :integer
      add :raw_metrics, :map, default: %{}
      add :feed_item, :map, default: %{}
      add :warnings, {:array, :string}, default: []

      timestamps(type: :utc_datetime)
    end

    create index(:campaign_submission_metric_snapshots, [:submission_id])
    create index(:campaign_submission_metric_snapshots, [:inserted_at])
  end
end
