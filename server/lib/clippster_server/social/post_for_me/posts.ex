defmodule ClippsterServer.Social.PostForMe.Posts do
  @moduledoc """
  Post for Me social post management.

  Handles creating, listing, updating, and deleting social media posts
  across Instagram, TikTok, and YouTube.
  """

  require Logger

  alias ClippsterServer.Social.PostForMe.Client

  @doc """
  Creates a social post to be published to one or more accounts.

  ## Parameters
    - attrs: Map with:
      - "social_account_ids" (required): List of PFM social account IDs
      - "media_url" (required): Media URL from PFM media upload
      - "text": Caption/description text
      - "scheduled_at": ISO 8601 datetime for scheduled posting
      - "social_account_configs": Per-account overrides
      - Platform-specific configs:
        - "instagram_config": %{"placement" => "reels"/"story"/"timeline"}
        - "tiktok_config": %{"privacy_level" => "public"/"friends"/"self", ...}
        - "youtube_config": %{"title" => ..., "privacy_status" => "public"/"private"/"unlisted", ...}

  ## Returns
    - {:ok, post_data}
    - {:error, reason}
  """
  def create_post(attrs) do
    Client.post("/v1/social-posts", attrs)
  end

  @doc """
  Lists social posts with optional filtering.

  ## Options
    - :social_account_id - Filter by account
    - :status - Filter by status
    - :cursor - Pagination cursor
  """
  def list_posts(opts \\ []) do
    params = opts
    |> Enum.filter(fn {_k, v} -> not is_nil(v) end)
    |> URI.encode_query()

    path = if params == "", do: "/v1/social-posts", else: "/v1/social-posts?#{params}"
    Client.get(path)
  end

  @doc """
  Gets a single social post by its Post for Me ID.
  """
  def get_post(pfm_post_id) do
    Client.get("/v1/social-posts/#{pfm_post_id}")
  end

  @doc """
  Updates a social post (e.g., change caption before publishing).
  """
  def update_post(pfm_post_id, attrs) do
    Client.put("/v1/social-posts/#{pfm_post_id}", attrs)
  end

  @doc """
  Deletes a social post.
  """
  def delete_post(pfm_post_id) do
    Client.delete("/v1/social-posts/#{pfm_post_id}")
  end

  @doc """
  Gets post results (publish outcomes per account).

  ## Options
    - :social_post_id - Filter by post
    - :cursor - Pagination cursor
  """
  def list_post_results(opts \\ []) do
    params = opts
    |> Enum.filter(fn {_k, v} -> not is_nil(v) end)
    |> URI.encode_query()

    path = if params == "", do: "/v1/social-post-results", else: "/v1/social-post-results?#{params}"
    Client.get(path)
  end

  @doc """
  Gets a single post result by its ID.
  """
  def get_post_result(result_id) do
    Client.get("/v1/social-post-results/#{result_id}")
  end

  @doc """
  Generates a preview of how a post will look on a platform.
  """
  def preview_post(attrs) do
    Client.post("/v1/social-post-previews", attrs)
  end

  # ============================================================================
  # Helper: Build platform-specific configs
  # ============================================================================

  @doc """
  Builds an Instagram config map for the post creation payload.
  """
  def instagram_config(opts \\ %{}) do
    %{
      "placement" => Map.get(opts, :placement, "reels")
    }
    |> maybe_put("collaborators", Map.get(opts, :collaborators))
    |> maybe_put("share_to_feed", Map.get(opts, :share_to_feed))
    |> maybe_put("location", Map.get(opts, :location))
  end

  @doc """
  Builds a TikTok config map for the post creation payload.
  """
  def tiktok_config(opts \\ %{}) do
    %{
      "privacy_level" => Map.get(opts, :privacy_level, "public")
    }
    |> maybe_put("allow_comment", Map.get(opts, :allow_comment))
    |> maybe_put("allow_duet", Map.get(opts, :allow_duet))
    |> maybe_put("allow_stitch", Map.get(opts, :allow_stitch))
    |> maybe_put("is_draft", Map.get(opts, :is_draft))
    |> maybe_put("is_ai_generated", Map.get(opts, :is_ai_generated))
    |> maybe_put("auto_add_music", Map.get(opts, :auto_add_music))
  end

  @doc """
  Builds a YouTube config map for the post creation payload.
  """
  def youtube_config(opts \\ %{}) do
    %{
      "privacy_status" => Map.get(opts, :privacy_status, "public")
    }
    |> maybe_put("title", Map.get(opts, :title))
    |> maybe_put("made_for_kids", Map.get(opts, :made_for_kids))
    |> maybe_put("tags", Map.get(opts, :tags))
    |> maybe_put("category_id", Map.get(opts, :category_id))
    |> maybe_put("playlist_id", Map.get(opts, :playlist_id))
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
