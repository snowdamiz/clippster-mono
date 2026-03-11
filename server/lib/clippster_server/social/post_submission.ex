defmodule ClippsterServer.Social.PostSubmission do
  @moduledoc """
  Schema for tracking posts published to social media platforms.
  Stores post metadata and analytics with support for manual override and scheduling.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Social.ProviderMode
  alias ClippsterServer.Organizations.{Organization, OrganizationCreatorProfile}
  alias ClippsterServer.Social.SocialAccount
  alias ClippsterServer.Campaigns.ClipperSocialAccount
  alias ClippsterServer.Accounts.User

  @known_platforms ~w(
    instagram facebook x twitter tiktok tiktok_business youtube linkedin threads pinterest bluesky
  )
  @media_types ~w(image video carousel reel story)
  @statuses ~w(pending scheduled publishing published failed canceled)
  @owner_types ~w(org user)

  schema "post_submissions" do
    field :platform, :string
    field :provider, :string
    field :provider_post_id, :string
    field :provider_payload, :map
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
    field :save_count, :integer, default: 0
    field :reach_count, :integer, default: 0
    field :impressions_count, :integer, default: 0

    # Timestamps and status
    field :posted_at, :utc_datetime
    field :last_synced_at, :utc_datetime
    field :manual_override, :boolean, default: false
    field :status, :string, default: "pending"
    field :error_message, :string
    field :content_hash, :string

    # Scheduling fields
    field :scheduled_at, :utc_datetime
    field :started_at, :utc_datetime
    field :completed_at, :utc_datetime
    field :locked_at, :utc_datetime
    field :attempts, :integer, default: 0
    field :max_attempts, :integer, default: 3

    # Owner type and source
    field :owner_type, :string, default: "org"
    field :clip_id, :string
    field :clip_build_id, :string
    field :aspect_ratio, :string
    field :build_type, :string

    belongs_to :organization, Organization
    belongs_to :organization_social_account, SocialAccount
    belongs_to :organization_creator_profile, OrganizationCreatorProfile
    belongs_to :submitted_by_user, User, foreign_key: :submitted_by_user_id
    belongs_to :user_social_account, ClipperSocialAccount
    belongs_to :campaign, ClippsterServer.Campaigns.Campaign

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new post submission (before publishing).
  Supports both org posts and user/personal posts.
  """
  def create_changeset(submission, attrs) do
    submission
    |> cast(attrs, [
      :organization_id,
      :organization_social_account_id,
      :organization_creator_profile_id,
      :user_social_account_id,
      :submitted_by_user_id,
      :campaign_id,
      :platform,
      :provider,
      :provider_post_id,
      :provider_payload,
      :media_type,
      :caption,
      :media_url,
      :thumbnail_url,
      :clip_id,
      :clip_build_id,
      :aspect_ratio,
      :build_type,
      :owner_type,
      :scheduled_at
    ])
    |> validate_required([:submitted_by_user_id, :platform, :media_url])
    |> normalize_platform()
    |> validate_inclusion(:media_type, @media_types ++ [nil])
    |> validate_inclusion(:owner_type, @owner_types)
    |> validate_caption()
    |> determine_initial_status()
    |> validate_account_presence()
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:organization_social_account_id)
    |> foreign_key_constraint(:organization_creator_profile_id)
    |> foreign_key_constraint(:user_social_account_id)
    |> foreign_key_constraint(:submitted_by_user_id)
    |> foreign_key_constraint(:campaign_id)
  end

  @doc """
  Changeset for scheduling a post for future publishing.
  """
  def schedule_changeset(submission, attrs) do
    submission
    |> cast(attrs, [
      :organization_id,
      :organization_social_account_id,
      :organization_creator_profile_id,
      :user_social_account_id,
      :submitted_by_user_id,
      :campaign_id,
      :platform,
      :provider,
      :provider_post_id,
      :provider_payload,
      :media_type,
      :caption,
      :media_url,
      :thumbnail_url,
      :clip_id,
      :owner_type,
      :scheduled_at
    ])
    |> validate_required([:submitted_by_user_id, :platform, :media_url, :scheduled_at])
    |> normalize_platform()
    |> validate_inclusion(:media_type, @media_types ++ [nil])
    |> validate_inclusion(:owner_type, @owner_types)
    |> validate_caption()
    |> validate_scheduled_at()
    |> validate_account_presence()
    |> put_change(:status, "pending")
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:organization_social_account_id)
    |> foreign_key_constraint(:organization_creator_profile_id)
    |> foreign_key_constraint(:user_social_account_id)
    |> foreign_key_constraint(:submitted_by_user_id)
    |> foreign_key_constraint(:campaign_id)
  end

  @doc """
  Changeset for updating a scheduled post (before it's locked for publishing).
  """
  def update_scheduled_changeset(submission, attrs) do
    if submission.status in ["scheduled", "pending"] and is_nil(submission.locked_at) do
      submission
      |> cast(attrs, [
        :organization_social_account_id,
        :user_social_account_id,
        :caption,
        :scheduled_at
      ])
      |> validate_caption()
      |> validate_scheduled_at()
      |> validate_account_presence()
    else
      submission
      |> change()
      |> add_error(:status, "cannot update a post that is locked or already processing")
    end
  end

  @doc """
  Changeset for updating media URLs after background upload completes.
  Allows updating media_url, thumbnail_url, and status for scheduled/pending posts.
  """
  def update_media_changeset(submission, attrs) do
    if submission.status in ["scheduled", "pending"] and is_nil(submission.locked_at) do
      submission
      |> cast(attrs, [:media_url, :thumbnail_url, :status])
      |> validate_required([:media_url])
      |> validate_inclusion(:status, ["scheduled", "pending"])
    else
      submission
      |> change()
      |> add_error(:status, "cannot update media for a post that is locked or already processing")
    end
  end

  @doc """
  Changeset for canceling a scheduled post.
  """
  def cancel_changeset(submission) do
    if submission.status in ["scheduled", "pending", "publishing", "failed"] do
      submission
      |> change(status: "canceled")
    else
      submission
      |> change()
      |> add_error(:status, "cannot cancel a post that is already published or canceled")
    end
  end

  @doc """
  Changeset for locking a post for publishing (prevents edits).
  """
  def lock_changeset(submission) do
    submission
    |> change(
      locked_at: DateTime.utc_now() |> DateTime.truncate(:second),
      status: "publishing",
      started_at: DateTime.utc_now() |> DateTime.truncate(:second)
    )
  end

  @doc """
  Changeset for incrementing attempt count after a failed publish attempt.
  """
  def increment_attempt_changeset(submission) do
    submission
    |> change(attempts: submission.attempts + 1)
  end

  @doc """
  Changeset for unlocking a post (for retry after transient failure).
  """
  def unlock_changeset(submission) do
    submission
    |> change(
      locked_at: nil,
      status: "scheduled"
    )
  end

  @doc """
  Changeset for marking a post as published.
  """
  def publish_changeset(submission, attrs) do
    attrs =
      attrs
      |> maybe_put_provider_post_id()
      |> maybe_put_provider()

    submission
    |> cast(attrs, [
      :post_id,
      :post_url,
      :posted_at,
      :content_hash,
      :provider,
      :provider_post_id,
      :provider_payload
    ])
    |> validate_required([:post_id])
    |> put_change(:status, "published")
    |> put_posted_at()
    |> unique_constraint([:platform, :post_id],
      name: :post_submissions_platform_post_unique,
      message: "this post has already been tracked"
    )
    |> unique_constraint([:provider, :provider_post_id],
      name: :post_submissions_provider_post_unique,
      message: "this provider post has already been tracked"
    )
  end

  @doc """
  Changeset for updating provider metadata without mutating publication status.
  """
  def provider_metadata_changeset(submission, attrs) do
    submission
    |> cast(attrs, [:provider, :provider_post_id, :provider_payload])
    |> unique_constraint([:provider, :provider_post_id],
      name: :post_submissions_provider_post_unique,
      message: "this provider post has already been tracked"
    )
  end

  @doc """
  Changeset for marking a post as failed.
  """
  def failed_changeset(submission, error_message) do
    submission
    |> change(
      status: "failed",
      error_message: error_message,
      completed_at: DateTime.utc_now() |> DateTime.truncate(:second)
    )
  end

  @doc """
  Changeset for retrying a failed post.
  Resets status to scheduled and clears the lock.
  """
  def retry_changeset(submission) do
    # Schedule for 1 minute from now to give time for any cleanup
    new_scheduled_at =
      DateTime.utc_now() |> DateTime.add(60, :second) |> DateTime.truncate(:second)

    submission
    |> change(
      status: "scheduled",
      locked_at: nil,
      started_at: nil,
      completed_at: nil,
      error_message: nil,
      scheduled_at: new_scheduled_at
    )
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
      :save_count,
      :reach_count,
      :impressions_count,
      :manual_override
    ])
    |> validate_number(:view_count, greater_than_or_equal_to: 0)
    |> validate_number(:like_count, greater_than_or_equal_to: 0)
    |> validate_number(:comment_count, greater_than_or_equal_to: 0)
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
  def platforms, do: @known_platforms

  @doc """
  Returns the list of valid media types.
  """
  def media_types, do: @media_types

  @doc """
  Returns the list of valid statuses.
  """
  def statuses, do: @statuses

  @doc """
  Returns the list of valid owner types.
  """
  def owner_types, do: @owner_types

  @doc """
  Checks if a post can be edited (not locked or published).
  """
  def can_edit?(%__MODULE__{status: status, locked_at: locked_at}) do
    status in ["pending", "scheduled"] and is_nil(locked_at)
  end

  @doc """
  Checks if a post can be canceled.
  """
  def can_cancel?(%__MODULE__{} = submission), do: can_edit?(submission)

  @doc """
  Checks if a post can be canceled or deleted.
  More permissive than can_cancel? - allows failed and publishing posts.
  """
  def can_cancel_or_delete?(%__MODULE__{status: status}) do
    status in ["pending", "scheduled", "publishing", "failed", "canceled"]
  end

  @doc """
  Checks if a post should be retried after failure.
  """
  def should_retry?(%__MODULE__{attempts: attempts, max_attempts: max_attempts}) do
    attempts < max_attempts
  end

  # Private functions

  defp put_posted_at(changeset) do
    case get_field(changeset, :posted_at) do
      nil -> put_change(changeset, :posted_at, DateTime.utc_now() |> DateTime.truncate(:second))
      _ -> changeset
    end
  end

  defp validate_caption(changeset) do
    platform = get_field(changeset, :platform)
    caption = get_field(changeset, :caption) || ""
    hashtag_count = Regex.scan(~r/#\w+/, caption) |> length()

    max_length =
      case platform do
        platform when platform in ["twitter", "x"] -> 280
        _ -> 2200
      end

    error_message =
      case platform do
        platform when platform in ["twitter", "x"] -> "X captions limited to 280 characters"
        _ -> "caption cannot exceed 2,200 characters"
      end

    changeset
    |> validate_length(:caption, max: max_length, message: error_message)
    |> then(fn cs ->
      if hashtag_count > 30 do
        add_error(cs, :caption, "cannot have more than 30 hashtags")
      else
        cs
      end
    end)
  end

  defp validate_scheduled_at(changeset) do
    case get_field(changeset, :scheduled_at) do
      nil ->
        changeset

      scheduled_at ->
        now = DateTime.utc_now()
        min_schedule_time = DateTime.add(now, 5, :minute)

        if DateTime.compare(scheduled_at, min_schedule_time) == :lt do
          add_error(changeset, :scheduled_at, "must be at least 5 minutes in the future")
        else
          changeset
        end
    end
  end

  defp validate_account_presence(changeset) do
    owner_type = get_field(changeset, :owner_type)
    org_account = get_field(changeset, :organization_social_account_id)
    user_account = get_field(changeset, :user_social_account_id)

    case owner_type do
      "org" ->
        if is_nil(org_account) do
          add_error(
            changeset,
            :organization_social_account_id,
            "is required for organization posts"
          )
        else
          changeset
        end

      "user" ->
        if is_nil(user_account) do
          add_error(changeset, :user_social_account_id, "is required for personal posts")
        else
          changeset
        end

      _ ->
        changeset
    end
  end

  defp determine_initial_status(changeset) do
    case get_field(changeset, :scheduled_at) do
      nil -> put_change(changeset, :status, "pending")
      _ -> put_change(changeset, :status, "scheduled")
    end
  end

  defp normalize_platform(changeset) do
    update_change(changeset, :platform, &ProviderMode.normalize_platform/1)
  end

  defp maybe_put_provider(attrs) when is_map(attrs) do
    if Map.has_key?(attrs, :provider) or Map.has_key?(attrs, "provider") do
      attrs
    else
      Map.put(attrs, :provider, "legacy")
    end
  end

  defp maybe_put_provider_post_id(attrs) when is_map(attrs) do
    if Map.has_key?(attrs, :provider_post_id) or Map.has_key?(attrs, "provider_post_id") do
      attrs
    else
      post_id = Map.get(attrs, :post_id) || Map.get(attrs, "post_id")
      Map.put(attrs, :provider_post_id, post_id)
    end
  end
end
