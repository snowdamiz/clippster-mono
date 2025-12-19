defmodule ClippsterServer.Social.PostSubmission do
  @moduledoc """
  Schema for tracking posts published to social media platforms.
  Stores post metadata and analytics with support for manual override.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Organizations.{Organization, OrganizationCreatorProfile}
  alias ClippsterServer.Social.SocialAccount
  alias ClippsterServer.Accounts.User

  @platforms ~w(instagram tiktok twitter youtube)
  @media_types ~w(image video carousel reel story)
  @statuses ~w(pending publishing published failed)

  schema "post_submissions" do
    field :platform, :string
    field :post_id, :string
    field :post_url, :string
    field :media_type, :string
    field :caption, :string
    field :media_url, :string
    field :thumbnail_url, :string

    # Analytics fields
    field :view_count, :integer, default: 0
    field :like_count, :integer, default: 0
    field :comment_count, :integer, default: 0
    field :share_count, :integer, default: 0
    field :save_count, :integer, default: 0
    field :reach_count, :integer, default: 0
    field :impressions_count, :integer, default: 0

    # Timestamps and status
    field :posted_at, :utc_datetime
    field :last_synced_at, :utc_datetime
    field :manual_override, :boolean, default: false
    field :status, :string, default: "pending"
    field :error_message, :string

    belongs_to :organization, Organization
    belongs_to :organization_social_account, SocialAccount
    belongs_to :organization_creator_profile, OrganizationCreatorProfile
    belongs_to :submitted_by_user, User, foreign_key: :submitted_by_user_id

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new post submission (before publishing).
  """
  def create_changeset(submission, attrs) do
    submission
    |> cast(attrs, [
      :organization_id,
      :organization_social_account_id,
      :organization_creator_profile_id,
      :submitted_by_user_id,
      :platform,
      :media_type,
      :caption,
      :media_url,
      :thumbnail_url
    ])
    |> validate_required([:organization_id, :submitted_by_user_id, :platform])
    |> validate_inclusion(:platform, @platforms)
    |> validate_inclusion(:media_type, @media_types ++ [nil])
    |> put_change(:status, "pending")
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:organization_social_account_id)
    |> foreign_key_constraint(:organization_creator_profile_id)
    |> foreign_key_constraint(:submitted_by_user_id)
  end

  @doc """
  Changeset for marking a post as published.
  """
  def publish_changeset(submission, attrs) do
    submission
    |> cast(attrs, [:post_id, :post_url, :posted_at])
    |> validate_required([:post_id])
    |> put_change(:status, "published")
    |> put_posted_at()
    |> unique_constraint([:platform, :post_id],
      name: :post_submissions_platform_post_unique,
      message: "this post has already been tracked"
    )
  end

  @doc """
  Changeset for marking a post as failed.
  """
  def failed_changeset(submission, error_message) do
    submission
    |> change(status: "failed", error_message: error_message)
  end

  @doc """
  Changeset for updating analytics from API sync.
  Will not update if manual_override is true.
  """
  def sync_analytics_changeset(submission, attrs) do
    if submission.manual_override do
      # Don't update if manual override is set
      submission |> change()
    else
      submission
      |> cast(attrs, [
        :view_count,
        :like_count,
        :comment_count,
        :share_count,
        :save_count,
        :reach_count,
        :impressions_count
      ])
      |> put_change(:last_synced_at, DateTime.utc_now() |> DateTime.truncate(:second))
    end
  end

  @doc """
  Changeset for manually updating analytics (sets manual_override flag).
  """
  def manual_analytics_changeset(submission, attrs) do
    submission
    |> cast(attrs, [
      :view_count,
      :like_count,
      :comment_count,
      :share_count,
      :save_count,
      :reach_count,
      :impressions_count,
      :manual_override
    ])
    |> validate_number(:view_count, greater_than_or_equal_to: 0)
    |> validate_number(:like_count, greater_than_or_equal_to: 0)
    |> validate_number(:comment_count, greater_than_or_equal_to: 0)
    |> validate_number(:share_count, greater_than_or_equal_to: 0)
    |> validate_number(:save_count, greater_than_or_equal_to: 0)
    |> validate_number(:reach_count, greater_than_or_equal_to: 0)
    |> validate_number(:impressions_count, greater_than_or_equal_to: 0)
  end

  @doc """
  Changeset for resetting manual override (allows sync to update again).
  """
  def reset_override_changeset(submission) do
    submission
    |> change(manual_override: false)
  end

  @doc """
  Returns the list of valid platforms.
  """
  def platforms, do: @platforms

  @doc """
  Returns the list of valid media types.
  """
  def media_types, do: @media_types

  @doc """
  Returns the list of valid statuses.
  """
  def statuses, do: @statuses

  # Private functions

  defp put_posted_at(changeset) do
    case get_field(changeset, :posted_at) do
      nil -> put_change(changeset, :posted_at, DateTime.utc_now() |> DateTime.truncate(:second))
      _ -> changeset
    end
  end
end
