defmodule ClippsterServer.Campaigns.CampaignResource do
  @moduledoc """
  Source/reference materials attached to a campaign (video links, audio links, briefs, etc.).
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Campaigns.Campaign

  @resource_types ~w(video audio reference_link brief file)
  @source_platforms ~w(x youtube rumble kick twitch other)

  schema "campaign_resources" do
    field :resource_type, :string
    field :source_platform, :string
    field :url, :string
    field :title, :string
    field :description, :string
    field :sort_order, :integer, default: 0
    field :metadata, :map, default: %{}

    belongs_to :campaign, Campaign

    timestamps(type: :utc_datetime)
  end

  def create_changeset(resource, attrs) do
    resource
    |> cast(attrs, [
      :campaign_id,
      :resource_type,
      :source_platform,
      :url,
      :title,
      :description,
      :sort_order,
      :metadata
    ])
    |> validate_required([:campaign_id, :resource_type])
    |> validate_inclusion(:resource_type, @resource_types)
    |> validate_inclusion(:source_platform, @source_platforms ++ [nil])
    |> validate_url_when_required()
    |> put_detected_platform()
    |> foreign_key_constraint(:campaign_id)
  end

  def update_changeset(resource, attrs) do
    resource
    |> cast(attrs, [
      :resource_type,
      :source_platform,
      :url,
      :title,
      :description,
      :sort_order,
      :metadata
    ])
    |> validate_inclusion(:resource_type, @resource_types)
    |> validate_inclusion(:source_platform, @source_platforms ++ [nil])
    |> validate_url_when_required()
    |> put_detected_platform()
  end

  defp validate_url_when_required(changeset) do
    resource_type = get_field(changeset, :resource_type) || get_change(changeset, :resource_type)

    if resource_type in ["video", "audio", "reference_link"] do
      validate_required(changeset, [:url])
      |> validate_url(:url)
    else
      changeset
    end
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

  defp put_detected_platform(changeset) do
    url = get_change(changeset, :url) || get_field(changeset, :url)
    current = get_change(changeset, :source_platform) || get_field(changeset, :source_platform)

    if is_nil(current) and is_binary(url) do
      put_change(changeset, :source_platform, detect_source_platform(url))
    else
      changeset
    end
  end

  @doc """
  Detects source platform from a URL.
  """
  def detect_source_platform(url) when is_binary(url) do
    url_lower = String.downcase(url)

    cond do
      String.contains?(url_lower, "x.com") or String.contains?(url_lower, "twitter.com") ->
        "x"

      String.contains?(url_lower, "youtube.com") or String.contains?(url_lower, "youtu.be") ->
        "youtube"

      String.contains?(url_lower, "rumble.com") ->
        "rumble"

      String.contains?(url_lower, "kick.com") ->
        "kick"

      String.contains?(url_lower, "twitch.tv") ->
        "twitch"

      true ->
        "other"
    end
  end

  def detect_source_platform(_), do: "other"

  @doc """
  Builds an in-app download target route for a resource.
  """
  def build_download_target(%__MODULE__{resource_type: "audio", url: url}) when is_binary(url) do
    "/download-audio?url=#{URI.encode_www_form(url)}"
  end

  def build_download_target(%__MODULE__{
        resource_type: type,
        url: url,
        source_platform: platform
      })
      when type in ["video", "reference_link"] and is_binary(url) and is_binary(platform) do
    vod_platform = normalize_vod_platform(platform)
    "/vods?platform=#{vod_platform}&search=#{URI.encode_www_form(url)}"
  end

  def build_download_target(%__MODULE__{resource_type: "brief"}), do: nil
  def build_download_target(%__MODULE__{resource_type: "file"}), do: nil
  def build_download_target(_), do: nil

  defp normalize_vod_platform("x"), do: "twitter"
  defp normalize_vod_platform("youtube"), do: "YouTube"
  defp normalize_vod_platform(platform) when platform in @source_platforms, do: platform
  defp normalize_vod_platform(_), do: "other"
end
