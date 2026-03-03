defmodule ClippsterServer.ClipperProfiles.ClipperLeaderboardEntry do
  @moduledoc """
  Schema for clipper leaderboard entries - weekly/monthly snapshots.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.ClipperProfiles.ClipperProfile

  @period_types ~w(weekly monthly)
  @leaderboard_types ~w(campaigns posts)

  schema "clipper_leaderboard_entries" do
    field :leaderboard_type, :string, default: "campaigns"
    field :period_type, :string
    field :period_start, :date
    field :period_end, :date
    field :rank, :integer
    field :clips_delivered, :integer, default: 0
    field :campaigns_active, :integer, default: 0
    field :endorsements_received, :integer, default: 0
    field :total_views, :integer, default: 0
    field :posts_count, :integer, default: 0
    field :score, :integer, default: 0

    belongs_to :clipper_profile, ClipperProfile

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a leaderboard entry.
  """
  def create_changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :clipper_profile_id,
      :leaderboard_type,
      :period_type,
      :period_start,
      :period_end,
      :rank,
      :clips_delivered,
      :campaigns_active,
      :endorsements_received,
      :total_views,
      :posts_count,
      :score
    ])
    |> validate_required([:clipper_profile_id, :period_type, :period_start, :period_end])
    |> validate_inclusion(:period_type, @period_types)
    |> validate_inclusion(:leaderboard_type, @leaderboard_types)
    |> foreign_key_constraint(:clipper_profile_id)
    |> unique_constraint([:clipper_profile_id, :leaderboard_type, :period_type, :period_start])
  end

  @doc """
  Calculate score based on activity.
  Score = (clips_delivered * 10) + (endorsements_received * 50) + (campaigns_active * 25)
  """
  def calculate_score(clips_delivered, endorsements_received, campaigns_active) do
    clips_delivered * 10 + endorsements_received * 50 + campaigns_active * 25
  end

  def period_types, do: @period_types
end
