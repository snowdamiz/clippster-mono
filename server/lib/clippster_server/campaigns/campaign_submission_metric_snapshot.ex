defmodule ClippsterServer.Campaigns.CampaignSubmissionMetricSnapshot do
  @moduledoc """
  Timestamped metric snapshot for a campaign submission, sourced from PostForMe feed data.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Campaigns.CampaignSubmission

  @sources ~w(postforme_feed manual_override)
  @feed_match_statuses ~w(matched not_found no_account no_provider_account invalid_url unsupported_platform)

  schema "campaign_submission_metric_snapshots" do
    field :source, :string, default: "postforme_feed"
    field :provider_account_id, :string
    field :feed_match_status, :string
    field :view_count, :integer
    field :like_count, :integer
    field :comment_count, :integer
    field :share_count, :integer
    field :save_count, :integer
    field :reach_count, :integer
    field :impressions_count, :integer
    field :raw_metrics, :map, default: %{}
    field :feed_item, :map, default: %{}
    field :warnings, {:array, :string}, default: []

    belongs_to :submission, CampaignSubmission

    timestamps(type: :utc_datetime)
  end

  def create_changeset(snapshot, attrs) do
    snapshot
    |> cast(attrs, [
      :submission_id,
      :source,
      :provider_account_id,
      :feed_match_status,
      :view_count,
      :like_count,
      :comment_count,
      :share_count,
      :save_count,
      :reach_count,
      :impressions_count,
      :raw_metrics,
      :feed_item,
      :warnings
    ])
    |> validate_required([:submission_id, :source])
    |> validate_inclusion(:source, @sources)
    |> validate_inclusion(:feed_match_status, @feed_match_statuses ++ [nil])
    |> foreign_key_constraint(:submission_id)
  end
end
