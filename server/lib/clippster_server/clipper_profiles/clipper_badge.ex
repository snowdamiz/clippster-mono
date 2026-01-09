defmodule ClippsterServer.ClipperProfiles.ClipperBadge do
  @moduledoc """
  Schema for clipper badges - earned achievements.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.ClipperProfiles.ClipperProfile

  @badge_types ~w(verified top_clipper rising_star)

  schema "clipper_badges" do
    field :badge_type, :string
    field :earned_at, :utc_datetime
    field :expires_at, :utc_datetime

    belongs_to :clipper_profile, ClipperProfile

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for awarding a badge.
  """
  def create_changeset(badge, attrs) do
    badge
    |> cast(attrs, [:clipper_profile_id, :badge_type, :earned_at, :expires_at])
    |> validate_required([:clipper_profile_id, :badge_type, :earned_at])
    |> validate_inclusion(:badge_type, @badge_types)
    |> foreign_key_constraint(:clipper_profile_id)
    |> unique_constraint([:clipper_profile_id, :badge_type],
      message: "clipper already has this badge"
    )
  end

  def badge_types, do: @badge_types
end
