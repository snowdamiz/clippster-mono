defmodule ClippsterServer.ClipperProfiles.ClipperProfile do
  @moduledoc """
  Schema for clipper profiles - public portfolios for clippers.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User
  alias ClippsterServer.ClipperProfiles.{ClipperChannelLink, ClipperPortfolioClip, ClipperEndorsement, ClipperBadge}

  @experience_levels ~w(beginner intermediate experienced professional)
  @specialty_tags ~w(gaming irl just-chatting esports music sports news crypto comedy educational asmr creative podcasts)
  @content_style_tags ~w(meme clean effects subtitles storytelling highlights reactions compilations dramatic)
  @platforms ~w(tiktok instagram youtube x facebook snapchat)

  schema "clipper_profiles" do
    field :display_name, :string
    field :bio, :string
    field :avatar_url, :string
    field :slug, :string
    field :is_public, :boolean, default: true
    field :looking_for_work, :boolean, default: false
    field :experience_level, :string
    field :specialty_tags, {:array, :string}, default: []
    field :content_style_tags, {:array, :string}, default: []
    field :preferred_platforms, {:array, :string}, default: []
    field :languages, {:array, :string}, default: []
    field :timezone, :string
    field :response_time_hours, :integer
    field :is_verified, :boolean, default: false
    field :total_campaigns_completed, :integer, default: 0
    field :total_clips_delivered, :integer, default: 0
    field :total_endorsements, :integer, default: 0

    belongs_to :user, User
    has_many :channel_links, ClipperChannelLink
    has_many :portfolio_clips, ClipperPortfolioClip
    has_many :endorsements, ClipperEndorsement
    has_many :badges, ClipperBadge

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new clipper profile.
  """
  def create_changeset(profile, attrs) do
    profile
    |> cast(attrs, [
      :user_id, :display_name, :bio, :avatar_url, :slug, :is_public,
      :looking_for_work, :experience_level, :specialty_tags, :content_style_tags,
      :preferred_platforms, :languages, :timezone
    ])
    |> strip_avatar_url_query_params()
    |> validate_required([:user_id])
    |> validate_length(:display_name, max: 100)
    |> validate_length(:bio, max: 500)
    |> validate_inclusion(:experience_level, @experience_levels)
    |> validate_subset(:specialty_tags, @specialty_tags)
    |> validate_subset(:content_style_tags, @content_style_tags)
    |> validate_subset(:preferred_platforms, @platforms)
    |> generate_slug()
    |> unique_constraint(:user_id)
    |> unique_constraint(:slug)
    |> foreign_key_constraint(:user_id)
  end

  @doc """
  Changeset for updating a clipper profile.
  """
  def update_changeset(profile, attrs) do
    profile
    |> cast(attrs, [
      :display_name, :bio, :avatar_url, :slug, :is_public,
      :looking_for_work, :experience_level, :specialty_tags, :content_style_tags,
      :preferred_platforms, :languages, :timezone
    ])
    |> strip_avatar_url_query_params()
    |> validate_length(:display_name, max: 100)
    |> validate_length(:bio, max: 500)
    |> validate_inclusion(:experience_level, @experience_levels)
    |> validate_subset(:specialty_tags, @specialty_tags)
    |> validate_subset(:content_style_tags, @content_style_tags)
    |> validate_subset(:preferred_platforms, @platforms)
    |> unique_constraint(:slug)
  end

  @doc """
  Changeset for updating stats.
  """
  def stats_changeset(profile, attrs) do
    profile
    |> cast(attrs, [:total_campaigns_completed, :total_clips_delivered, :total_endorsements, :response_time_hours])
  end

  @doc """
  Changeset for verification status.
  """
  def verification_changeset(profile, attrs) do
    profile
    |> cast(attrs, [:is_verified])
  end

  defp generate_slug(changeset) do
    case get_change(changeset, :slug) do
      nil ->
        case get_change(changeset, :display_name) do
          nil -> changeset
          name -> put_change(changeset, :slug, slugify(name))
        end
      _ -> changeset
    end
  end

  # Strip query parameters from avatar_url to avoid storing presigned URL params
  # which can make the URL exceed the 255 character limit
  defp strip_avatar_url_query_params(changeset) do
    case get_change(changeset, :avatar_url) do
      nil -> changeset
      url when is_binary(url) ->
        # Parse the URL and strip query parameters
        stripped_url = url |> URI.parse() |> Map.put(:query, nil) |> URI.to_string()
        put_change(changeset, :avatar_url, stripped_url)
      _ -> changeset
    end
  end

  defp slugify(name) when is_binary(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s-]/, "")
    |> String.replace(~r/[\s-]+/, "-")
    |> String.trim("-")
    |> then(fn slug ->
      if String.length(slug) < 3 do
        slug <> "-" <> random_suffix()
      else
        slug
      end
    end)
  end

  defp random_suffix do
    :crypto.strong_rand_bytes(4) |> Base.encode16(case: :lower)
  end

  def experience_levels, do: @experience_levels
  def specialty_tags, do: @specialty_tags
  def content_style_tags, do: @content_style_tags
  def platforms, do: @platforms
end
