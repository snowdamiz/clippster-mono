defmodule ClippsterServer.Social.Platforms.PostForMe do
  @moduledoc """
  Post for Me platform integration for Instagram, TikTok, and YouTube.

  Unlike Twitter which uses direct API calls, these platforms are handled
  through the Post for Me unified API. This module implements the Platform
  behaviour by delegating to the PFM API client.

  OAuth is handled by PFM - we don't store platform tokens, only the PFM account ID.
  Publishing is done by creating a PFM social post which PFM then publishes to the platform.
  Analytics are retrieved via PFM's feed/metrics endpoints.
  """

  require Logger

  @behaviour ClippsterServer.Social.Platform

  alias ClippsterServer.Social.PostForMe.{Media, Posts, Analytics}

  # ============================================================================
  # Platform Callbacks
  # ============================================================================

  @impl true
  def platform_id, do: "post_for_me"

  @impl true
  def platform_name, do: "Post for Me"

  @impl true
  def authorize_url(_opts) do
    # OAuth is handled by PostForMeAuthController, not through the Platform behaviour
    raise "Use PostForMeAuthController for OAuth flows"
  end

  @impl true
  def exchange_code(_code, _opts) do
    # PFM handles token exchange internally
    {:error, :not_applicable}
  end

  @impl true
  def refresh_tokens(_refresh_token) do
    # PFM manages token refresh internally - our tokens never expire
    {:ok, %{access_token: "pfm_managed", expires_in: 365 * 24 * 3600}}
  end

  @impl true
  def get_user_profile(_access_token) do
    # Profile info is fetched during OAuth callback from PFM
    {:error, :use_pfm_api}
  end

  @impl true
  def publish_media(_access_token, media_url, opts) do
    pfm_account_id = opts[:pfm_account_id] || opts["pfm_account_id"]
    caption = opts[:caption] || opts["caption"] || ""
    platform = opts[:platform] || opts["platform"] || "instagram"

    unless pfm_account_id do
      Logger.error("[PostForMe] publish_media called without pfm_account_id")
      {:error, :missing_pfm_account_id}
    else
      do_publish(pfm_account_id, media_url, caption, platform, opts)
    end
  end

  @impl true
  def get_insights(_access_token, _post_id) do
    # Use get_analytics/2 instead for PFM platforms
    {:error, :use_pfm_analytics}
  end

  # ============================================================================
  # PFM-Specific Publishing
  # ============================================================================

  @doc """
  Publishes media through Post for Me.

  Steps:
  1. Upload media to PFM (if not already a PFM media URL)
  2. Create a social post targeting the PFM account
  3. Return the PFM post ID for tracking

  ## Options
    - :pfm_account_id - Required: The PFM social account ID
    - :caption - Post caption/description
    - :platform - "instagram", "tiktok", or "youtube"
    - :media_type - "video", "image", "reel"
    - :instagram_config - Platform-specific config
    - :tiktok_config - Platform-specific config
    - :youtube_config - Platform-specific config
    - :scheduled_at - ISO 8601 datetime for scheduling
  """
  def do_publish(pfm_account_id, media_url, caption, platform, opts) do
    Logger.info("[PostForMe] Publishing to #{platform} via PFM account #{pfm_account_id}")

    # Step 1: Upload media to PFM if it's not already a PFM URL
    case ensure_pfm_media(media_url) do
      {:ok, pfm_media_url} ->
        # Step 2: Build post payload with platform-specific config
        post_payload = build_publish_payload(pfm_account_id, pfm_media_url, caption, platform, opts)

        # Step 3: Create the social post
        case Posts.create_post(post_payload) do
          {:ok, pfm_post} ->
            pfm_post_id = pfm_post["id"]
            status = pfm_post["status"]

            Logger.info("[PostForMe] Post created: #{pfm_post_id}, status: #{status}")

            {:ok, %{
              post_id: pfm_post_id,
              post_url: pfm_post["url"] || "",
              media_type: opts[:media_type] || "video",
              pfm_post_id: pfm_post_id,
              pfm_status: status
            }}

          {:error, reason} ->
            Logger.error("[PostForMe] Failed to create post: #{inspect(reason)}")
            {:error, reason}
        end

      {:error, reason} ->
        Logger.error("[PostForMe] Failed to upload media: #{inspect(reason)}")
        {:error, reason}
    end
  end

  # ============================================================================
  # Analytics
  # ============================================================================

  @doc """
  Gets analytics for a PFM social account's feed.
  """
  def get_analytics(pfm_account_id, opts \\ []) do
    Analytics.get_account_feed_with_metrics(pfm_account_id, opts)
  end

  # ============================================================================
  # Private
  # ============================================================================

  defp ensure_pfm_media(media_url) do
    # If the URL is already from PFM storage, use it directly
    if String.contains?(media_url, "postforme") do
      {:ok, media_url}
    else
      # Download and re-upload to PFM
      Logger.info("[PostForMe] Uploading media from #{String.slice(media_url, 0, 80)}...")
      Media.upload_from_url(media_url)
    end
  end

  defp build_publish_payload(pfm_account_id, media_url, caption, platform, opts) do
    payload = %{
      "social_account_ids" => [pfm_account_id],
      "media_url" => media_url,
      "text" => caption
    }

    # Add scheduled_at if present
    payload = case opts[:scheduled_at] do
      nil -> payload
      dt -> Map.put(payload, "scheduled_at", dt)
    end

    # Add platform-specific configs
    payload = case platform do
      "instagram" ->
        config = opts[:instagram_config] || Posts.instagram_config(%{
          placement: opts[:media_type] || "reels"
        })
        Map.put(payload, "instagram_config", config)

      "tiktok" ->
        config = opts[:tiktok_config] || Posts.tiktok_config(%{
          privacy_level: opts[:privacy_level] || "public",
          allow_comment: opts[:allow_comment],
          allow_duet: opts[:allow_duet],
          allow_stitch: opts[:allow_stitch],
          is_ai_generated: opts[:is_ai_generated]
        })
        Map.put(payload, "tiktok_config", config)

      "youtube" ->
        config = opts[:youtube_config] || Posts.youtube_config(%{
          title: opts[:title] || caption |> String.slice(0, 100),
          privacy_status: opts[:privacy_status] || "public",
          made_for_kids: opts[:made_for_kids] || false,
          tags: opts[:tags],
          category_id: opts[:category_id],
          playlist_id: opts[:playlist_id]
        })
        Map.put(payload, "youtube_config", config)

      _ ->
        payload
    end

    payload
  end
end
