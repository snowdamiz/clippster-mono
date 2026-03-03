defmodule ClippsterServerWeb.UserPostsController do
  @moduledoc """
  Controller for managing user Instagram posts and analytics.
  """

  use ClippsterServerWeb, :controller

  require Logger

  alias ClippsterServer.Campaigns
  alias ClippsterServer.Campaigns.UserPost
  alias ClippsterServer.Organizations
  alias ClippsterServer.Social
  alias ClippsterServer.Social.Providers.PostForMe

  @doc """
  Publish a post to user's Instagram account.

  POST /api/user/instagram/publish
  """
  def publish(conn, params) do
    publish_to_platform(conn, params, "instagram", "Instagram")
  end

  @doc """
  Publish a post to user's X (Twitter) account.

  POST /api/user/twitter/publish
  """
  def publish_twitter(conn, params) do
    publish_to_platform(conn, params, "x", "X")
  end

  @doc """
  Publish a post to user's TikTok account.

  POST /api/user/tiktok/publish
  """
  def publish_tiktok(conn, params) do
    publish_to_platform(conn, params, "tiktok", "TikTok")
  end

  @doc """
  Publish a post to user's YouTube account.

  POST /api/user/youtube/publish
  """
  def publish_youtube(conn, params) do
    publish_to_platform(conn, params, "youtube", "YouTube")
  end

  defp publish_to_platform(conn, params, platform, platform_label) do
    user = conn.assigns.current_user

    with {:ok, account_id} <- get_required_param(params, "account_id"),
         {:ok, media_url} <- get_required_param(params, "media_url"),
         {:ok, account} <- get_user_account(user.id, account_id),
         :ok <- validate_platform(account, platform),
         {:ok, post_data} <- publish_via_post_for_me(account, media_url, params) do
      post_attrs = %{
        user_id: user.id,
        clipper_social_account_id: account.id,
        platform: platform,
        post_id: post_data.post_id,
        post_url: post_data.post_url,
        caption: params["caption"],
        media_url: media_url,
        thumbnail_url: params["thumbnail_url"],
        media_type: params["media_type"] || "video",
        status: "published"
      }

      case Campaigns.create_user_post(user, post_attrs) do
        {:ok, post} ->
          # Dual-track: if creator_profile_id or campaign_id is provided,
          # also create a PostSubmission so the org sees this in analytics.
          maybe_create_org_post_submission(user, account, post_data, params, platform)

          conn
          |> put_status(201)
          |> json(%{
            success: true,
            post: serialize_post(post),
            message: "Published to #{platform_label} successfully"
          })

        {:error, changeset} ->
          conn
          |> put_status(422)
          |> json(%{
            success: false,
            error: extract_changeset_error(changeset)
          })
      end
    else
      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Account not found"})

      {:error, :wrong_platform} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Account is not a #{platform_label} account"})

      {:error, :missing_param, param} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Missing required parameter: #{param}"})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: inspect(reason)})
    end
  rescue
    e ->
      Logger.error(
        "[UserPosts] publish_to_platform(#{platform}) crashed: #{Exception.message(e)}\n#{Exception.format_stacktrace(__STACKTRACE__)}"
      )

      conn
      |> put_status(500)
      |> json(%{success: false, error: "Internal error: #{Exception.message(e)}"})
  end

  @doc """
  List user's posts with analytics.

  GET /api/user/posts
  """
  def index(conn, params) do
    user = conn.assigns.current_user

    posts =
      case params["account_id"] do
        nil -> Campaigns.list_user_posts(user.id)
        account_id -> Campaigns.list_user_posts_by_account(user.id, account_id)
      end

    conn
    |> json(%{
      success: true,
      posts: Enum.map(posts, &serialize_post/1)
    })
  end

  @doc """
  Get analytics summary for user's posts.

  GET /api/user/posts/analytics
  """
  def analytics_summary(conn, params) do
    user = conn.assigns.current_user

    opts = []

    opts =
      if params["days"],
        do: Keyword.put(opts, :days, String.to_integer(params["days"])),
        else: opts

    opts =
      if params["account_id"],
        do: Keyword.put(opts, :account_id, String.to_integer(params["account_id"])),
        else: opts

    summary = Campaigns.get_user_analytics_summary(user.id, opts)

    conn
    |> json(%{
      success: true,
      summary: %{
        total_posts: summary.total_posts || 0,
        total_views: summary.total_views || 0,
        total_likes: summary.total_likes || 0,
        total_comments: summary.total_comments || 0,
        total_saves: summary.total_saves || 0,
        total_reach: summary.total_reach || 0,
        total_impressions: summary.total_impressions || 0
      }
    })
  end

  @doc """
  Sync analytics for all user posts using PostForMe feed API.
  POST /api/user/posts/sync-analytics
  """
  def sync_user_analytics(conn, _params) do
    user = conn.assigns.current_user
    Logger.info("[sync_user_analytics] Starting sync for user #{user.id}")

    try do
      sync_user_posts_analytics(user.id)
      Logger.info("[sync_user_analytics] Sync completed successfully")
      json(conn, %{success: true, message: "Analytics sync started"})
    rescue
      e ->
        Logger.error("[sync_user_analytics] Sync failed: #{inspect(e)}")
        Logger.error("[sync_user_analytics] Stacktrace: #{inspect(__STACKTRACE__)}")
        json(conn, %{success: true, message: "Analytics sync started"})
    end
  end

  @doc """
  Get a single post with details.

  GET /api/user/posts/:id
  """
  def show(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case Campaigns.get_user_post(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Post not found"})

      post ->
        if post.user_id == user.id do
          conn
          |> json(%{
            success: true,
            post: serialize_post(post)
          })
        else
          conn
          |> put_status(403)
          |> json(%{success: false, error: "Unauthorized"})
        end
    end
  end

  @doc """
  Manually sync analytics for a post.

  POST /api/user/posts/:id/sync
  """
  def sync_analytics(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    with {:ok, post} <- get_user_post(user.id, id),
         {:ok, account} <- get_user_account(user.id, post.clipper_social_account_id),
         {:ok, insights} <- fetch_insights(account, post) do
      case Campaigns.update_user_post_analytics(post, insights) do
        {:ok, updated_post} ->
          conn
          |> json(%{
            success: true,
            post: serialize_post(updated_post),
            message: "Analytics synced successfully"
          })

        {:error, changeset} ->
          conn
          |> put_status(422)
          |> json(%{
            success: false,
            error: extract_changeset_error(changeset)
          })
      end
    else
      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Post or account not found"})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: inspect(reason)})
    end
  end

  @doc """
  Upload media for user post publishing.
  Uploads the video/image to R2 storage and returns the public URL.

  POST /api/user/posts/upload-media
  """
  def upload_media(conn, params) do
    user = conn.assigns.current_user

    case params do
      %{"file" => %Plug.Upload{} = upload} ->
        # Generate unique key for the file
        ext = Path.extname(upload.filename) |> String.downcase()
        timestamp = DateTime.utc_now() |> DateTime.to_unix()
        unique_id = :crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)
        key = "social-media/users/#{user.id}/#{timestamp}_#{unique_id}#{ext}"

        # Determine content type
        content_type =
          case ext do
            ".mp4" -> "video/mp4"
            ".mov" -> "video/quicktime"
            ".webm" -> "video/webm"
            ".jpg" -> "image/jpeg"
            ".jpeg" -> "image/jpeg"
            ".png" -> "image/png"
            ".gif" -> "image/gif"
            _ -> "application/octet-stream"
          end

        case ClippsterServer.Storage.upload_file_from_path(upload.path, key,
               content_type: content_type
             ) do
          {:ok, url} ->
            # Handle optional thumbnail upload
            thumbnail_url =
              case params["thumbnail"] do
                %Plug.Upload{} = thumb ->
                  thumb_ext = Path.extname(thumb.filename) |> String.downcase()

                  thumb_key =
                    "social-media/users/#{user.id}/#{timestamp}_#{unique_id}_thumb#{thumb_ext}"

                  thumb_content_type =
                    case thumb_ext do
                      ".jpg" -> "image/jpeg"
                      ".jpeg" -> "image/jpeg"
                      ".png" -> "image/png"
                      _ -> "image/jpeg"
                    end

                  case ClippsterServer.Storage.upload_file_from_path(thumb.path, thumb_key,
                         content_type: thumb_content_type
                       ) do
                    {:ok, thumb_url} -> thumb_url
                    {:error, _} -> nil
                  end

                _ ->
                  nil
              end

            json(conn, %{
              success: true,
              media_url: url,
              thumbnail_url: thumbnail_url
            })

          {:error, reason} ->
            conn
            |> put_status(500)
            |> json(%{success: false, error: "Failed to upload media: #{inspect(reason)}"})
        end

      _ ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "No file provided"})
    end
  end

  # Private functions

  defp get_required_param(params, key) do
    case Map.get(params, key) do
      nil -> {:error, :missing_param, key}
      value -> {:ok, value}
    end
  end

  defp validate_platform(account, expected_platform) do
    if platforms_match?(account.platform, expected_platform) do
      :ok
    else
      {:error, :wrong_platform}
    end
  end

  defp platforms_match?(actual, expected) when actual == expected, do: true

  defp platforms_match?(actual, expected)
       when actual in ["x", "twitter"] and expected in ["x", "twitter"],
       do: true

  defp platforms_match?(actual, expected)
       when actual in ["youtube", "youtube_shorts"] and expected in ["youtube", "youtube_shorts"],
       do: true

  defp platforms_match?(_, _), do: false

  defp get_user_account(user_id, account_id) do
    account = Campaigns.get_social_account(account_id)

    cond do
      is_nil(account) -> {:error, :not_found}
      account.user_id != user_id -> {:error, :not_found}
      !account.is_active -> {:error, :account_inactive}
      true -> {:ok, account}
    end
  end

  defp get_user_post(user_id, post_id) do
    case Campaigns.get_user_post(post_id) do
      nil ->
        {:error, :not_found}

      post ->
        if post.user_id == user_id do
          {:ok, post}
        else
          {:error, :not_found}
        end
    end
  end

  defp publish_via_post_for_me(account, media_url, params) do
    media_url_resolved =
      if String.contains?(media_url, ".r2.cloudflarestorage.com") do
        case ClippsterServer.Storage.presigned_url(media_url, expires_in: 7_200) do
          {:ok, url} -> url
          {:error, _} -> media_url
        end
      else
        media_url
      end

    # Build platform-specific configuration
    platform_config = build_platform_config(account.platform, params)

    post_params = %{
      caption: params["caption"] || "",
      social_accounts: [account.provider_account_id],
      media: [%{url: media_url_resolved}]
    }

    # Add platform_configurations if present
    post_params =
      if platform_config do
        Map.put(post_params, :platform_configurations, platform_config)
      else
        post_params
      end

    case PostForMe.create_social_post(post_params) do
      {:ok, post} ->
        # Try to fetch the post URL from the feed
        post_url = fetch_post_url_from_feed(account.provider_account_id, post.id)
        {:ok, %{post_id: post.id || "pfm_post", post_url: post_url}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Fetch post URL from PostForMe feed by post ID
  defp fetch_post_url_from_feed(provider_account_id, post_id) do
    case fetch_post_for_me_feed(provider_account_id) do
      {:ok, feed_items} ->
        # Find the post in the feed by ID
        case Enum.find(feed_items, fn item ->
          item["id"] == post_id || item["platform_id"] == post_id
        end) do
          nil -> 
            Logger.warning("[UserPosts] Post #{post_id} not found in feed yet, URL will be nil")
            nil
          item -> 
            url = item["platform_url"] || item["permalink"] || item["url"]
            Logger.info("[UserPosts] Found post URL in feed: #{url}")
            url
        end

      {:error, reason} ->
        Logger.warning("[UserPosts] Failed to fetch feed for URL lookup: #{inspect(reason)}")
        nil
    end
  end

  # Backfill missing post_url values by fetching from PostForMe feed
  defp backfill_missing_post_urls(posts, user_id) do
    # Find posts missing post_url
    posts_needing_urls = Enum.filter(posts, fn post ->
      is_nil(post.post_url) || post.post_url == ""
    end)

    if length(posts_needing_urls) > 0 do
      Logger.info("[sync_user_posts_analytics] Attempting to backfill #{length(posts_needing_urls)} posts with missing post_url")

      # Get user's social accounts
      case Campaigns.list_user_social_accounts(user_id) do
        accounts when is_list(accounts) ->
          # Group posts by platform
          posts_by_platform = Enum.group_by(posts_needing_urls, & &1.platform)

          # Fetch URLs for each platform
          updated_posts = for {platform, platform_posts} <- posts_by_platform do
            # Normalize platform name
            lookup_platform = if platform == "twitter", do: "x", else: platform

            # Find active account with provider_account_id
            account = Enum.find(accounts, fn acc ->
              normalized = if acc.platform == "twitter", do: "x", else: acc.platform
              normalized == lookup_platform && acc.is_active && is_binary(acc.provider_account_id)
            end)

            if account do
              # Fetch feed for this platform
              case fetch_post_for_me_feed(account.provider_account_id) do
                {:ok, feed_items} ->
                  # Try to find URL for each post
                  Enum.map(platform_posts, fn post ->
                    if post.provider_post_id do
                      case Enum.find(feed_items, fn item ->
                        item["id"] == post.provider_post_id || item["platform_id"] == post.provider_post_id
                      end) do
                        nil ->
                          Logger.warning("[sync_user_posts_analytics] Post #{post.id} (provider_post_id: #{post.provider_post_id}) not found in feed")
                          post
                        item ->
                          url = item["platform_url"] || item["permalink"] || item["url"]
                          if url do
                            Logger.info("[sync_user_posts_analytics] Backfilling post_url for post #{post.id}: #{url}")
                            # Update the post in the database
                            case Campaigns.update_user_post(post, %{post_url: url}) do
                              {:ok, updated_post} -> updated_post
                              {:error, _} -> post
                            end
                          else
                            post
                          end
                      end
                    else
                      Logger.warning("[sync_user_posts_analytics] Post #{post.id} has no provider_post_id, cannot backfill")
                      post
                    end
                  end)

                {:error, reason} ->
                  Logger.error("[sync_user_posts_analytics] Failed to fetch feed for backfill: #{inspect(reason)}")
                  platform_posts
              end
            else
              Logger.warning("[sync_user_posts_analytics] No active #{platform} account found for backfill")
              platform_posts
            end
          end
          |> List.flatten()

          # Merge updated posts back into the full list
          updated_post_ids = MapSet.new(updated_posts, & &1.id)
          posts
          |> Enum.map(fn post ->
            if MapSet.member?(updated_post_ids, post.id) do
              Enum.find(updated_posts, fn up -> up.id == post.id end) || post
            else
              post
            end
          end)

        _ ->
          Logger.warning("[sync_user_posts_analytics] No social accounts found for backfill")
          posts
      end
    else
      posts
    end
  end

  defp build_platform_config("youtube", params) do
    # YouTube requires specific configuration
    youtube_config = %{
      "title" => params["title"],
      "privacy" => params["privacy"] || "public",
      "madeForKids" => params["made_for_kids"] || false
    }

    # Add optional category if provided
    youtube_config =
      if params["category_id"] do
        Map.put(youtube_config, "categoryId", params["category_id"])
      else
        youtube_config
      end

    %{"youtube" => youtube_config}
  end

  defp build_platform_config(_platform, _params), do: nil

  defp fetch_insights(_account, _post) do
    # Insights are fetched via PostForMe feed API in the scheduling controller
    {:error, :not_supported}
  end

  defp serialize_post(%UserPost{} = post) do
    %{
      id: post.id,
      platform: post.platform,
      post_id: post.post_id,
      post_url: post.post_url,
      caption: post.caption,
      media_url: post.media_url,
      thumbnail_url: post.thumbnail_url,
      media_type: post.media_type,
      status: post.status,
      view_count: post.view_count,
      like_count: post.like_count,
      comment_count: post.comment_count,
      save_count: post.save_count,
      reach_count: post.reach_count,
      impressions_count: post.impressions_count,
      synced_at: post.synced_at,
      published_at: post.inserted_at,
      inserted_at: post.inserted_at,
      updated_at: post.updated_at
    }
  end

  defp extract_changeset_error(changeset) do
    errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _opts} -> msg end)

    errors
    |> Enum.map(fn {field, msgs} -> "#{field}: #{Enum.join(msgs, ", ")}" end)
    |> Enum.join("; ")
  end

  # ---------------------------------------------------------------------------
  # Dual-tracking: create a PostSubmission so the org sees personal-account
  # posts in their analytics when the clip is tied to a creator profile/campaign.
  # ---------------------------------------------------------------------------
  defp maybe_create_org_post_submission(user, account, post_data, params, platform) do
    creator_profile_id = params["creator_profile_id"]
    campaign_id = params["campaign_id"]

    # Only dual-track if there's an org linkage
    cond do
      not is_nil(creator_profile_id) ->
        case Organizations.get_creator_profile(creator_profile_id) do
          nil ->
            Logger.warning("[UserPosts] Dual-track skipped: creator profile #{creator_profile_id} not found")

          profile ->
            create_org_submission(user, account, post_data, params, platform, profile, campaign_id)
        end

      not is_nil(campaign_id) ->
        case Campaigns.get_campaign(campaign_id) do
          nil ->
            Logger.warning("[UserPosts] Dual-track skipped: campaign #{campaign_id} not found")

          campaign ->
            # Campaign belongs to an org; look up the creator profile if linked
            creator_profile = if campaign.creator_profile_id,
              do: Organizations.get_creator_profile(campaign.creator_profile_id),
              else: nil

            submission_attrs = %{
              organization_id: campaign.organization_id,
              organization_creator_profile_id: creator_profile && creator_profile.id,
              campaign_id: campaign.id,
              user_social_account_id: account.id,
              submitted_by_user_id: user.id,
              platform: platform,
              provider: "post_for_me",
              provider_post_id: post_data.post_id,
              media_type: params["media_type"] || "video",
              caption: params["caption"],
              media_url: params["media_url"],
              thumbnail_url: params["thumbnail_url"],
              owner_type: "user",
              post_id: post_data.post_id,
              post_url: post_data.post_url,
              posted_at: DateTime.utc_now() |> DateTime.truncate(:second),
              status: "published"
            }

            case Social.create_immediate_post(submission_attrs, user) do
              {:ok, submission} ->
                # Mark it published immediately
                Social.mark_post_published(submission, %{
                  post_id: post_data.post_id,
                  post_url: post_data.post_url
                })
                Logger.info("[UserPosts] Dual-tracked to org #{campaign.organization_id} via campaign #{campaign.id}")

              {:error, reason} ->
                Logger.warning("[UserPosts] Dual-track failed for campaign #{campaign_id}: #{inspect(reason)}")
            end
        end

      true ->
        :ok
    end
  end

  # Sync analytics for user posts using PostForMe feed API
  defp sync_user_posts_analytics(user_id) do
    Logger.info("[sync_user_posts_analytics] Starting sync for user #{user_id}")

    # Get all published user posts
    posts = Campaigns.list_user_posts(user_id)
    Logger.info("[sync_user_posts_analytics] Found #{length(posts)} user posts")

    # First, try to backfill missing post_url values
    posts_with_urls = backfill_missing_post_urls(posts, user_id)

    # Filter to posts with post_url and supported platforms
    filtered_posts =
      Enum.filter(posts_with_urls, fn post ->
        has_post_url = is_binary(post.post_url) && post.post_url != ""
        is_supported = post.platform in ["instagram", "x", "twitter", "tiktok", "youtube"]

        if not has_post_url do
          Logger.warning("[sync_user_posts_analytics] Post #{post.id} (#{post.platform}) has no post_url - cannot sync analytics")
        end

        if not is_supported do
          Logger.debug("[sync_user_posts_analytics] Post #{post.id} platform #{post.platform} not supported")
        end

        has_post_url && is_supported
      end)

    Logger.info("[sync_user_posts_analytics] #{length(filtered_posts)} posts after filtering")

    # Get user's social accounts
    case Campaigns.list_user_social_accounts(user_id) do
      accounts when is_list(accounts) ->
        # Group posts by platform
        posts_by_platform = Enum.group_by(filtered_posts, & &1.platform)

        for {platform, platform_posts} <- posts_by_platform do
          # Normalize platform name
          lookup_platform = if platform == "twitter", do: "x", else: platform

          # Find active account with provider_account_id
          account =
            Enum.find(accounts, fn acc ->
              normalized = if acc.platform == "twitter", do: "x", else: acc.platform
              normalized == lookup_platform && acc.is_active && is_binary(acc.provider_account_id)
            end)

          if account do
            Logger.info("[sync_user_posts_analytics] Processing #{length(platform_posts)} #{platform} posts for account #{account.provider_account_id}")

            # Fetch feed once per platform
            case fetch_post_for_me_feed(account.provider_account_id) do
              {:ok, feed_items} ->
                Logger.info("[sync_user_posts_analytics] Fetched #{length(feed_items)} feed items from PostForMe")

                for post <- platform_posts do
                  case extract_post_identifier(post.platform, post.post_url) do
                    {:ok, post_identifier} ->
                      Logger.debug("[sync_user_posts_analytics] Post #{post.id}: extracted identifier #{post_identifier} from #{post.post_url}")

                      case match_feed_item(post.platform, feed_items, post_identifier) do
                        nil ->
                          Logger.warning("[sync_user_posts_analytics] Post #{post.id}: identifier #{post_identifier} NOT FOUND in feed")
                          :ok

                        item ->
                          Logger.info("[sync_user_posts_analytics] Post #{post.id}: MATCHED feed item")
                          analytics = extract_feed_analytics(post.platform, item, account)
                          Logger.info("[sync_user_posts_analytics] Post #{post.id}: extracted analytics: #{inspect(analytics)}")

                          if map_size(analytics) > 0 do
                            case Campaigns.update_user_post_analytics(post, analytics) do
                              {:ok, _} -> Logger.info("[sync_user_posts_analytics] Post #{post.id}: analytics synced successfully")
                              {:error, reason} -> Logger.error("[sync_user_posts_analytics] Post #{post.id}: sync failed: #{inspect(reason)}")
                            end
                          end
                      end

                    {:error, reason} ->
                      Logger.warning("[sync_user_posts_analytics] Post #{post.id}: failed to extract identifier from #{post.post_url}: #{inspect(reason)}")
                      :ok
                  end
                end

              {:error, reason} ->
                Logger.error("[sync_user_posts_analytics] Failed to fetch PostForMe feed for account #{account.provider_account_id}: #{inspect(reason)}")
                :ok
            end
          else
            Logger.warning("[sync_user_posts_analytics] No active #{platform} account with provider_account_id found")
          end
        end

      _ ->
        Logger.warning("[sync_user_posts_analytics] User #{user_id} has no social accounts")
    end
  end

  # Fetch feed from PostForMe API
  defp fetch_post_for_me_feed(provider_account_id) do
    case PostForMe.get_social_account_feed(provider_account_id, %{limit: 50}) do
      {:ok, %{data: feed_items}} when is_list(feed_items) ->
        {:ok, feed_items}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Extract platform-specific identifier from post URL
  defp extract_post_identifier("instagram", url) when is_binary(url) do
    case Regex.run(~r{instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)}, url) do
      [_, shortcode] -> {:ok, shortcode}
      _ -> {:error, :invalid_url}
    end
  end

  defp extract_post_identifier(platform, url) when platform in ["x", "twitter"] and is_binary(url) do
    case Regex.run(~r{(?:twitter\.com|x\.com)/.+/status/(\d+)}, url) do
      [_, tweet_id] -> {:ok, tweet_id}
      _ -> {:error, :invalid_url}
    end
  end

  defp extract_post_identifier("tiktok", url) when is_binary(url) do
    case Regex.run(~r{tiktok\.com/.+/video/(\d+)}, url) do
      [_, video_id] -> {:ok, video_id}
      _ -> {:error, :invalid_url}
    end
  end

  defp extract_post_identifier("youtube", url) when is_binary(url) do
    cond do
      match = Regex.run(~r{youtube\.com/shorts/([A-Za-z0-9_-]+)}, url) ->
        {:ok, Enum.at(match, 1)}

      match = Regex.run(~r{youtube\.com/watch\?v=([A-Za-z0-9_-]+)}, url) ->
        {:ok, Enum.at(match, 1)}

      match = Regex.run(~r{youtu\.be/([A-Za-z0-9_-]+)}, url) ->
        {:ok, Enum.at(match, 1)}

      true ->
        {:error, :invalid_url}
    end
  end

  defp extract_post_identifier(_platform, _url), do: {:error, :unsupported_platform}

  # Match feed item against post identifier
  defp match_feed_item("instagram", feed_items, shortcode) do
    Enum.find(feed_items, fn item ->
      item_shortcode =
        item["shortcode"] || item["code"] ||
          extract_shortcode_from_url(item["permalink"]) ||
          extract_shortcode_from_url(item["platform_url"])

      item_shortcode == shortcode
    end)
  end

  defp match_feed_item(platform, feed_items, post_id) when platform in ["x", "twitter"] do
    Enum.find(feed_items, fn item ->
      item["id"] == post_id || item["platform_id"] == post_id
    end)
  end

  defp match_feed_item("tiktok", feed_items, video_id) do
    Enum.find(feed_items, fn item ->
      item["id"] == video_id || item["platform_id"] == video_id
    end)
  end

  defp match_feed_item("youtube", feed_items, video_id) do
    Enum.find(feed_items, fn item ->
      item["id"] == video_id || item["platform_id"] == video_id
    end)
  end

  defp match_feed_item(_platform, _feed_items, _identifier), do: nil

  defp extract_shortcode_from_url(nil), do: nil

  defp extract_shortcode_from_url(url) when is_binary(url) do
    case Regex.run(~r{/(?:p|reel|tv)/([A-Za-z0-9_-]+)}, url) do
      [_, shortcode] -> shortcode
      _ -> nil
    end
  end

  # Extract analytics from feed item
  defp extract_feed_analytics("instagram", item, _account) do
    %{
      view_count: item["play_count"] || item["view_count"] || 0,
      like_count: item["like_count"] || 0,
      comment_count: item["comment_count"] || item["comments_count"] || 0,
      save_count: item["save_count"] || 0,
      reach_count: item["reach"] || 0,
      impressions_count: item["impressions"] || 0
    }
  end

  defp extract_feed_analytics(platform, item, _account) when platform in ["x", "twitter"] do
    %{
      view_count: item["view_count"] || item["impression_count"] || 0,
      like_count: item["like_count"] || item["favorite_count"] || 0,
      comment_count: item["reply_count"] || 0,
      reach_count: item["reach"] || 0,
      impressions_count: item["impression_count"] || 0
    }
  end

  defp extract_feed_analytics("tiktok", item, _account) do
    %{
      view_count: item["view_count"] || item["play_count"] || 0,
      like_count: item["like_count"] || item["digg_count"] || 0,
      comment_count: item["comment_count"] || 0,
      share_count: item["share_count"] || 0
    }
  end

  defp extract_feed_analytics("youtube", item, _account) do
    %{
      view_count: item["view_count"] || 0,
      like_count: item["like_count"] || 0,
      comment_count: item["comment_count"] || 0
    }
  end

  defp extract_feed_analytics(_platform, _item, _account), do: %{}

  defp create_org_submission(user, account, post_data, params, platform, profile, campaign_id) do
    submission_attrs = %{
      organization_id: profile.organization_id,
      organization_creator_profile_id: profile.id,
      campaign_id: campaign_id,
      user_social_account_id: account.id,
      submitted_by_user_id: user.id,
      platform: platform,
      provider: "post_for_me",
      provider_post_id: post_data.post_id,
      media_type: params["media_type"] || "video",
      caption: params["caption"],
      media_url: params["media_url"],
      thumbnail_url: params["thumbnail_url"],
      owner_type: "user",
      post_id: post_data.post_id,
      post_url: post_data.post_url,
      posted_at: DateTime.utc_now() |> DateTime.truncate(:second),
      status: "published"
    }

    case Social.create_immediate_post(submission_attrs, user) do
      {:ok, submission} ->
        Social.mark_post_published(submission, %{
          post_id: post_data.post_id,
          post_url: post_data.post_url
        })
        Logger.info("[UserPosts] Dual-tracked to org #{profile.organization_id} via creator profile #{profile.id}")

      {:error, reason} ->
        Logger.warning("[UserPosts] Dual-track failed for creator profile #{profile.id}: #{inspect(reason)}")
    end
  end
end
