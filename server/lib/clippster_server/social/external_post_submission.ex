defmodule ClippsterServer.Social.ExternalPostSubmission do
  @moduledoc """
  Schema for tracking external post submissions.
  
  When clippers post to their personal Instagram accounts, they can submit 
  the post link to an organization/campaign for visibility and tracking.
  This allows orgs to see posts made via personal IG accounts.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Organizations.{Organization, OrganizationCreatorProfile}
  alias ClippsterServer.Campaigns.Campaign
  alias ClippsterServer.Accounts.User

  @platforms ~w(instagram tiktok twitter youtube)
  @media_types ~w(image video carousel reel story)
  @statuses ~w(pending approved rejected)

  schema "external_post_submissions" do
    field :platform, :string
    field :post_url, :string
    field :post_id, :string
    field :caption, :string
    field :media_type, :string
    field :clip_id, :string

    # Analytics (manually entered or auto-fetched)
    field :view_count, :integer, default: 0
    field :like_count, :integer, default: 0
    field :comment_count, :integer, default: 0
    field :share_count, :integer, default: 0
    field :save_count, :integer, default: 0

    # Author metadata from platform API
    field :author_username, :string
    field :author_name, :string
    field :author_profile_image, :string

    # Status and review
    field :status, :string, default: "pending"
    field :notes, :string
    field :reviewed_at, :utc_datetime

    belongs_to :organization, Organization
    belongs_to :campaign, Campaign
    belongs_to :organization_creator_profile, OrganizationCreatorProfile
    belongs_to :submitted_by_user, User, foreign_key: :submitted_by_user_id
    belongs_to :reviewed_by_user, User, foreign_key: :reviewed_by_user_id

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new external post submission.
  """
  def create_changeset(submission, attrs) do
    submission
    |> cast(attrs, [
      :organization_id,
      :campaign_id,
      :organization_creator_profile_id,
      :submitted_by_user_id,
      :platform,
      :post_url,
      :post_id,
      :caption,
      :media_type,
      :clip_id,
      :view_count,
      :like_count,
      :comment_count,
      :share_count,
      :save_count,
      :notes,
      :author_username,
      :author_name,
      :author_profile_image
    ])
    |> validate_required([:organization_id, :submitted_by_user_id, :platform, :post_url])
    |> validate_inclusion(:platform, @platforms)
    |> validate_inclusion(:media_type, @media_types ++ [nil])
    |> validate_post_url()
    |> extract_post_id()
    |> put_change(:status, "pending")
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:campaign_id)
    |> foreign_key_constraint(:organization_creator_profile_id)
    |> foreign_key_constraint(:submitted_by_user_id)
    |> unique_constraint([:platform, :post_url],
      name: :external_post_submissions_platform_url_unique,
      message: "this post has already been submitted"
    )
  end

  @doc """
  Changeset for updating analytics.
  """
  def update_analytics_changeset(submission, attrs) do
    submission
    |> cast(attrs, [
      :view_count,
      :like_count,
      :comment_count,
      :share_count,
      :save_count,
      :author_username,
      :author_name,
      :author_profile_image
    ])
    |> validate_number(:view_count, greater_than_or_equal_to: 0)
    |> validate_number(:like_count, greater_than_or_equal_to: 0)
    |> validate_number(:comment_count, greater_than_or_equal_to: 0)
    |> validate_number(:share_count, greater_than_or_equal_to: 0)
    |> validate_number(:save_count, greater_than_or_equal_to: 0)
  end

  @doc """
  Changeset for approving a submission.
  """
  def approve_changeset(submission, reviewer_id) do
    submission
    |> change(
      status: "approved",
      reviewed_by_user_id: reviewer_id,
      reviewed_at: DateTime.utc_now() |> DateTime.truncate(:second)
    )
  end

  @doc """
  Changeset for rejecting a submission.
  """
  def reject_changeset(submission, reviewer_id, notes \\ nil) do
    changes = %{
      status: "rejected",
      reviewed_by_user_id: reviewer_id,
      reviewed_at: DateTime.utc_now() |> DateTime.truncate(:second)
    }

    changes = if notes, do: Map.put(changes, :notes, notes), else: changes

    submission
    |> change(changes)
  end

  @doc """
  Returns the list of valid platforms.
  """
  def platforms, do: @platforms

  @doc """
  Returns the list of valid statuses.
  """
  def statuses, do: @statuses

  # Private functions

  defp validate_post_url(changeset) do
    case get_field(changeset, :post_url) do
      nil ->
        changeset

      url ->
        platform = get_field(changeset, :platform)

        valid? =
          case platform do
            "instagram" ->
              String.contains?(url, "instagram.com") or String.contains?(url, "instagr.am")

            "tiktok" ->
              String.contains?(url, "tiktok.com") or String.contains?(url, "vm.tiktok.com")

            "twitter" ->
              String.contains?(url, "twitter.com") or String.contains?(url, "x.com")

            "youtube" ->
              String.contains?(url, "youtube.com") or String.contains?(url, "youtu.be")

            _ ->
              true
          end

        if valid? do
          changeset
        else
          add_error(changeset, :post_url, "URL does not match the selected platform")
        end
    end
  end

  defp extract_post_id(changeset) do
    case get_field(changeset, :post_url) do
      nil ->
        changeset

      url ->
        post_id = extract_id_from_url(url, get_field(changeset, :platform))

        if post_id do
          put_change(changeset, :post_id, post_id)
        else
          changeset
        end
    end
  end

  defp extract_id_from_url(url, "instagram") do
    # Instagram URLs: /p/POST_ID/ or /reel/POST_ID/
    case Regex.run(~r{/(p|reel)/([A-Za-z0-9_-]+)}, url) do
      [_, _, post_id] -> post_id
      _ -> nil
    end
  end

  defp extract_id_from_url(url, "tiktok") do
    # TikTok URLs: /video/VIDEO_ID or @user/video/VIDEO_ID
    case Regex.run(~r{/video/(\d+)}, url) do
      [_, video_id] -> video_id
      _ -> nil
    end
  end

  defp extract_id_from_url(url, "youtube") do
    # YouTube URLs: v=VIDEO_ID or youtu.be/VIDEO_ID
    cond do
      String.contains?(url, "v=") ->
        case Regex.run(~r{v=([A-Za-z0-9_-]+)}, url) do
          [_, video_id] -> video_id
          _ -> nil
        end

      String.contains?(url, "youtu.be/") ->
        case Regex.run(~r{youtu\.be/([A-Za-z0-9_-]+)}, url) do
          [_, video_id] -> video_id
          _ -> nil
        end

      true ->
        nil
    end
  end

  defp extract_id_from_url(url, "twitter") do
    # Twitter URLs: /status/STATUS_ID
    case Regex.run(~r{/status/(\d+)}, url) do
      [_, status_id] -> status_id
      _ -> nil
    end
  end

  defp extract_id_from_url(_, _), do: nil
end
