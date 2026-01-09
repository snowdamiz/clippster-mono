defmodule ClippsterServer.ClipperProfiles.ClipperPortfolioClip do
  @moduledoc """
  Schema for clipper portfolio clips - showcase clips (max 3 per profile).
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.ClipperProfiles.ClipperProfile

  schema "clipper_portfolio_clips" do
    field :title, :string
    field :video_url, :string
    field :thumbnail_url, :string
    field :duration, :decimal
    field :file_size, :integer
    field :display_order, :integer, default: 0

    belongs_to :clipper_profile, ClipperProfile

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a portfolio clip.
  """
  def create_changeset(clip, attrs) do
    clip
    |> cast(attrs, [:clipper_profile_id, :title, :video_url, :thumbnail_url, :duration, :file_size, :display_order])
    |> validate_required([:clipper_profile_id, :video_url])
    |> validate_length(:title, max: 200)
    |> validate_url(:video_url)
    |> foreign_key_constraint(:clipper_profile_id)
  end

  @doc """
  Changeset for updating a portfolio clip.
  """
  def update_changeset(clip, attrs) do
    clip
    |> cast(attrs, [:title, :video_url, :thumbnail_url, :duration, :file_size, :display_order])
    |> validate_length(:title, max: 200)
    |> validate_url(:video_url)
  end

  defp validate_url(changeset, field) do
    validate_change(changeset, field, fn _, value ->
      case URI.parse(value) do
        %URI{scheme: scheme, host: host} when scheme in ["http", "https"] and not is_nil(host) ->
          []
        _ ->
          [{field, "must be a valid URL"}]
      end
    end)
  end
end
