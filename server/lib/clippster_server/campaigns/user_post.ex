defmodule ClippsterServer.Campaigns.UserPost do
  @moduledoc """
  Schema for user-published posts to their connected social accounts.
  Tracks analytics and sync status.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User
  alias ClippsterServer.Campaigns.ClipperSocialAccount

  @platforms ~w(tiktok instagram x youtube)
  @statuses ~w(published failed)
  @media_types ~w(image video reel)

  schema "user_posts" do
    field :platform, :string
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
      :post_id,
      :post_url,
      :caption,
      :media_url,
      :thumbnail_url,
      :media_type,
      :status
    ])
    |> validate_required([:user_id, :clipper_social_account_id, :platform, :post_id, :media_url])
    |> validate_inclusion(:platform, @platforms)
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:media_type, @media_types)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:clipper_social_account_id)
    |> unique_constraint([:platform, :post_id], name: :user_posts_platform_post_unique)
  end

  @doc """
  Changeset for updating analytics data.
  """
  def analytics_changeset(post, attrs) do
    post
    |> cast(attrs, [
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

  # Private functions

  defp put_synced_at(changeset) do
    put_change(changeset, :synced_at, DateTime.utc_now() |> DateTime.truncate(:second))
  end
end
