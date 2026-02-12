defmodule ClippsterServer.Social.TwitterDuplicateDetector do
  @moduledoc """
  Duplicate content detection for X (Twitter) posts.

  X returns 403 "Status is a duplicate" when posting identical content.
  This module pre-checks for duplicates using SHA-256 content hashing
  with a configurable lookback window.

  Duplicate detection considers:
  - Text content (caption)
  - Media IDs (sorted for consistent hashing)
  - Account ID (same content on different accounts is allowed)
  - Time window (default 24 hours)
  """

  require Logger
  import Ecto.Query

  alias ClippsterServer.Repo
  alias ClippsterServer.Social.PostSubmission

  @lookback_hours 24

  @doc """
  Checks if content would be a duplicate post.

  Generates a content hash from text and media IDs, then queries for
  recent posts with the same hash on the same account.

  ## Parameters
    - account_id: Organization or user social account ID
    - text: Tweet text content
    - media_ids: List of media IDs (optional, default [])

  ## Returns
    - {:ok, content_hash} if no duplicate found
    - {:error, :duplicate_content, existing_post} if duplicate detected
  """
  def check_duplicate(account_id, text, media_ids \\ []) do
    content_hash = generate_hash(text, media_ids)
    cutoff_time = DateTime.utc_now() |> DateTime.add(-@lookback_hours, :hour)

    # Query for duplicate posts in the lookback window
    query =
      from p in PostSubmission,
        where: p.content_hash == ^content_hash,
        where: p.inserted_at >= ^cutoff_time,
        where: p.status in ["published", "publishing"],
        where:
          p.organization_social_account_id == ^account_id or
            p.user_social_account_id == ^account_id,
        order_by: [desc: p.inserted_at],
        limit: 1

    case Repo.one(query) do
      nil ->
        {:ok, content_hash}

      existing_post ->
        Logger.warning(
          "[TwitterDuplicateDetector] Duplicate content detected for account #{account_id}: " <>
            "matches post #{existing_post.id} from #{existing_post.inserted_at}"
        )

        {:error, :duplicate_content, existing_post}
    end
  end

  @doc """
  Generates a SHA-256 content hash from text and media IDs.

  ## Parameters
    - text: Tweet text content
    - media_ids: List of media IDs (optional, default [])

  ## Returns
    - String (hex-encoded SHA-256 hash)

  ## Examples
      iex> generate_hash("Hello world", [])
      "64ec88ca00b268e5ba1a35678a1b5316d212f4f366b2477232534a8aeca37f3c"

      iex> generate_hash("Hello world", ["123", "456"])
      "8c7dd922ad47494fc02c388e12c00eac278d4ae30f5e53c3d8b36c3e6c8e3c8b"
  """
  def generate_hash(text, media_ids \\ []) do
    # Sort media IDs for consistent hashing regardless of order
    sorted_media = Enum.sort(media_ids)

    # Combine text and media IDs with delimiter
    content = text <> Enum.join(sorted_media, ",")

    # Generate SHA-256 hash
    :crypto.hash(:sha256, content)
    |> Base.encode16(case: :lower)
  end
end
