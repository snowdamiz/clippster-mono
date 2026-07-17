defmodule ClippsterServer.Campaigns.UserPost do
  @moduledoc """
  Schema for user-published posts to their connected social accounts.
  Tracks analytics and sync status.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Campaigns.ClipperSocialAccount
  alias ClippsterServer.Social.AnalyticsMerge
  alias ClippsterServer.Social.ProviderMode

  @known_platforms ~w(
    instagram facebook x twitter tiktok tiktok_business youtube linkedin threads pinterest bluesky
  )
  @statuses ~w(published failed)
  @media_types ~w(image video reel)

  schema "user_posts" do
    field :platform, :string
    field :provider, :string
    field :provider_post_id, :string
    field :provider_payload, :map
    field :post_id, :string
    field :post_url, :string
    field :caption, :string
    field :media_url, :string
    field :thumbnail_url, :string
    field :media_type, :string
    field :status, :string

    # Analytics fields
    field :view_count, :integer, default: 0
    field :like_count, :integer, default: 0
    field :comment_count, :integer, default: 0
    field :save_count, :integer, default: 0
    field :reach_count, :integer, default: 0
    field :impressions_count, :integer, default: 0
    field :synced_at, :utc_datetime
    field :posted_at, :utc_datetime

    belongs_to :user, User
    belongs_to :clipper_social_account, ClipperSocialAccount

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new user post.
  """
  def create_changeset(post, attrs) do
    post
    |> cast(attrs, [
      :user_id,
      :clipper_social_account_id,
      :platform,
      :provider,
      :provider_post_id,
      :provider_payload,
      :post_id,
      :post_url,
      :caption,
      :media_url,
      :thumbnail_url,
      :media_type,
      :status,
      :posted_at
    ])
    |> validate_required([:user_id, :clipper_social_account_id, :platform, :post_id, :media_url])
    |> normalize_platform()
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:media_type, @media_types)
    |> put_posted_at_default()
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:clipper_social_account_id)
    |> unique_constraint([:platform, :post_id], name: :user_posts_platform_post_unique)
    |> unique_constraint([:provider, :provider_post_id], name: :user_posts_provider_post_unique)
  end

  @doc """
  Changeset for updating analytics data.
  """
  def analytics_changeset(post, attrs) do
    merged_attrs = AnalyticsMerge.merge_metrics(post, attrs)

    post
    |> cast(merged_attrs, [
      :view_count,
      :like_count,
      :comment_count,
      :save_count,
      :reach_count,
      :impressions_count,
      :synced_at
    ])
    |> put_synced_at()
  end

  @doc """
  Changeset for updating post status.
  """
  def status_changeset(post, attrs) do
    post
    |> cast(attrs, [:status])
    |> validate_inclusion(:status, @statuses)
  end

  @doc """
  Changeset for updating post fields like post_url.
  """
  def update_changeset(post, attrs) do
    post
    |> cast(attrs, [
      :post_url,
      :provider_post_id,
      :caption,
      :media_url,
      :thumbnail_url,
      :provider_payload
    ])
  end

  def platforms, do: @known_platforms

  # Private functions

  defp normalize_platform(changeset) do
    update_change(changeset, :platform, &ProviderMode.normalize_platform/1)
  end

  defp put_synced_at(changeset) do
    put_change(changeset, :synced_at, DateTime.utc_now() |> DateTime.truncate(:second))
  end

  defp put_posted_at_default(changeset) do
    case get_field(changeset, :posted_at) do
      nil -> put_change(changeset, :posted_at, DateTime.utc_now() |> DateTime.truncate(:second))
      _ -> changeset
    end
  end
end
