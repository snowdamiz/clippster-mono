defmodule ClippsterServer.ClipperProfiles.ClipperChannelLink do
  @moduledoc """
  Schema for clipper channel links - links to clipper's clip channels.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.ClipperProfiles.ClipperProfile

  @platforms ~w(tiktok youtube instagram x kick twitch)

  schema "clipper_channel_links" do
    field :platform, :string
    field :url, :string
    field :username, :string
    field :display_order, :integer, default: 0

    belongs_to :clipper_profile, ClipperProfile

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a channel link.
  """
  def create_changeset(link, attrs) do
    link
    |> cast(attrs, [:clipper_profile_id, :platform, :url, :username, :display_order])
    |> validate_required([:clipper_profile_id, :platform, :url])
    |> validate_inclusion(:platform, @platforms)
    |> validate_url(:url)
    |> foreign_key_constraint(:clipper_profile_id)
    |> unique_constraint([:clipper_profile_id, :platform],
      message: "already have a link for this platform"
    )
  end

  @doc """
  Changeset for updating a channel link.
  """
  def update_changeset(link, attrs) do
    link
    |> cast(attrs, [:url, :username, :display_order])
    |> validate_url(:url)
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

  def platforms, do: @platforms
end
