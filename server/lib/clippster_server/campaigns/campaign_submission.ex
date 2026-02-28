defmodule ClippsterServer.Campaigns.CampaignSubmission do
  @moduledoc """
  Schema for clip submissions to campaigns.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias ClippsterServer.Accounts.User

  alias ClippsterServer.Campaigns.{
    Campaign,
    CampaignParticipant,
    CampaignPayment,
    ClipperSocialAccount
  }

  @statuses ~w(pending verified rejected paid)
  @platforms ~w(tiktok instagram x youtube)

  schema "campaign_submissions" do
    field :clip_url, :string
    field :platform, :string
    field :platform_post_id, :string
    field :view_count, :integer, default: 0
    field :views_last_updated_at, :utc_datetime
    field :status, :string, default: "pending"
    field :rejection_reason, :string
    field :verified_at, :utc_datetime

    # Analytics fields (to match external_post_submissions)
    field :like_count, :integer, default: 0
    field :comment_count, :integer, default: 0
    field :share_count, :integer, default: 0
    field :save_count, :integer, default: 0

    # Author metadata from platform API
    field :author_username, :string
    field :author_name, :string
    field :author_profile_image, :string

    # Additional metadata
    field :caption, :string
    field :media_type, :string

    belongs_to :campaign, Campaign
    belongs_to :participant, CampaignParticipant
    belongs_to :user, User
    belongs_to :social_account, ClipperSocialAccount
    belongs_to :verified_by_user, User, foreign_key: :verified_by_user_id
    has_many :payments, CampaignPayment, foreign_key: :submission_id

    timestamps(type: :utc_datetime)
  end

  @doc """
  Changeset for creating a new submission.
  """
  def create_changeset(submission, attrs) do
    submission
    |> cast(attrs, [
      :campaign_id,
      :participant_id,
      :user_id,
      :social_account_id,
      :clip_url,
      :platform,
      :platform_post_id
    ])
    |> validate_required([:campaign_id, :participant_id, :user_id, :clip_url, :platform])
    |> validate_inclusion(:platform, @platforms)
    |> validate_url(:clip_url)
    |> detect_platform_from_url()
    |> foreign_key_constraint(:campaign_id)
    |> foreign_key_constraint(:participant_id)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:social_account_id)
    |> unique_constraint(:clip_url, message: "has already been submitted")
  end

  @doc """
  Changeset for verifying a submission.
  """
  def verify_changeset(submission, attrs) do
    submission
    |> cast(attrs, [:verified_by_user_id])
    |> put_change(:status, "verified")
    |> put_change(:verified_at, DateTime.utc_now() |> DateTime.truncate(:second))
    |> foreign_key_constraint(:verified_by_user_id)
  end

  @doc """
  Changeset for rejecting a submission.
  """
  def reject_changeset(submission, attrs) do
    submission
    |> cast(attrs, [:rejection_reason, :verified_by_user_id])
    |> put_change(:status, "rejected")
    |> validate_required([:rejection_reason])
    |> validate_length(:rejection_reason, max: 1000)
    |> foreign_key_constraint(:verified_by_user_id)
  end

  @doc """
  Changeset for marking submission as paid.
  """
  def mark_paid_changeset(submission) do
    submission
    |> change(status: "paid")
  end

  @doc """
  Changeset for updating view count.
  """
  def update_views_changeset(submission, attrs) do
    submission
    |> cast(attrs, [:view_count, :platform_post_id])
    |> put_change(:views_last_updated_at, DateTime.utc_now() |> DateTime.truncate(:second))
    |> validate_number(:view_count, greater_than_or_equal_to: 0)
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

  defp detect_platform_from_url(changeset) do
    case get_change(changeset, :clip_url) do
      nil ->
        changeset

      url ->
        detected = detect_platform(url)
        current_platform = get_change(changeset, :platform)

        changeset =
          if is_nil(current_platform) and detected do
            put_change(changeset, :platform, detected)
          else
            changeset
          end

        # Extract post ID if we have a platform
        platform = get_field(changeset, :platform) || detected

        if platform && is_nil(get_change(changeset, :platform_post_id)) do
          case extract_post_id(url, platform) do
            {:ok, post_id} -> put_change(changeset, :platform_post_id, post_id)
            _ -> changeset
          end
        else
          changeset
        end
    end
  end

  @doc """
  Detects platform from URL.
  """
  def detect_platform(url) when is_binary(url) do
    url_lower = String.downcase(url)

    cond do
      String.contains?(url_lower, "tiktok.com") ->
        "tiktok"

      String.contains?(url_lower, "instagram.com") ->
        "instagram"

      String.contains?(url_lower, "x.com") or String.contains?(url_lower, "twitter.com") ->
        "x"

      String.contains?(url_lower, "youtube.com") or String.contains?(url_lower, "youtu.be") ->
        "youtube"

      true ->
        nil
    end
  end

  def detect_platform(_), do: nil

  @doc """
  Extracts post ID from URL based on platform.

  ## Examples

      iex> extract_post_id("https://www.instagram.com/reel/ABC123/", "instagram")
      {:ok, "ABC123"}

      iex> extract_post_id("https://www.tiktok.com/@user/video/7123456789/", "tiktok")
      {:ok, "7123456789"}

      iex> extract_post_id("https://youtube.com/shorts/XYZ789", "youtube")
      {:ok, "XYZ789"}
  """
  def extract_post_id(url, platform) when is_binary(url) and is_binary(platform) do
    case platform do
      "instagram" -> extract_instagram_post_id(url)
      "tiktok" -> extract_tiktok_post_id(url)
      "youtube" -> extract_youtube_post_id(url)
      "x" -> extract_x_post_id(url)
      _ -> {:error, :unsupported_platform}
    end
  end

  def extract_post_id(_, _), do: {:error, :invalid_input}

  # Instagram: https://www.instagram.com/reel/ABC123/ or /p/ABC123/
  defp extract_instagram_post_id(url) do
    cond do
      Regex.match?(~r/instagram\.com\/(reel|p)\/([A-Za-z0-9_-]+)/, url) ->
        case Regex.run(~r/instagram\.com\/(reel|p)\/([A-Za-z0-9_-]+)/, url) do
          [_, _, post_id] -> {:ok, post_id}
          _ -> {:error, :parse_failed}
        end

      true ->
        {:error, :invalid_url}
    end
  end

  # TikTok: https://www.tiktok.com/@user/video/7123456789/
  defp extract_tiktok_post_id(url) do
    case Regex.run(~r/tiktok\.com\/.*\/video\/(\d+)/, url) do
      [_, post_id] -> {:ok, post_id}
      _ -> {:error, :invalid_url}
    end
  end

  # YouTube: https://youtube.com/shorts/XYZ789 or youtu.be/XYZ789
  defp extract_youtube_post_id(url) do
    cond do
      Regex.match?(~r/youtube\.com\/shorts\/([A-Za-z0-9_-]+)/, url) ->
        case Regex.run(~r/youtube\.com\/shorts\/([A-Za-z0-9_-]+)/, url) do
          [_, post_id] -> {:ok, post_id}
          _ -> {:error, :parse_failed}
        end

      Regex.match?(~r/youtu\.be\/([A-Za-z0-9_-]+)/, url) ->
        case Regex.run(~r/youtu\.be\/([A-Za-z0-9_-]+)/, url) do
          [_, post_id] -> {:ok, post_id}
          _ -> {:error, :parse_failed}
        end

      true ->
        {:error, :invalid_url}
    end
  end

  # X/Twitter: https://x.com/user/status/1234567890 or twitter.com/user/status/1234567890
  defp extract_x_post_id(url) do
    case Regex.run(~r/(x\.com|twitter\.com)\/.*\/status\/(\d+)/, url) do
      [_, _, post_id] -> {:ok, post_id}
      _ -> {:error, :invalid_url}
    end
  end

  def statuses, do: @statuses
  def platforms, do: @platforms
end
