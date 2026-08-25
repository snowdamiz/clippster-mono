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
  alias ClippsterServer.Social.PostSubmission
  alias ClippsterServer.Social.PostForMeConnectionSync
  alias ClippsterServer.Social.PostForMeAccountHealth
  alias ClippsterServer.Social.UserPostsAnalyticsSync
  alias ClippsterServer.Social.PostForMeFeedAnalytics
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

  @doc """
  Publish a post to user's Tokend account (native provider; mock until partner APIs).

  POST /api/user/tokend/publish
  """
  def publish_tokend(conn, params) do
    publish_to_tokend(conn, params)
  end

  defp publish_to_tokend(conn, params) do
    user = conn.assigns.current_user

    with {:ok, account_id} <- get_required_param(params, "account_id"),
         {:ok, media_url} <- get_required_param(params, "media_url"),
         {:ok, account} <- get_user_account(user.id, account_id),
         :ok <- validate_platform(account, "tokend") do
      access_token =
        ClippsterServer.Campaigns.ClipperSocialAccount.get_access_token(account) || ""

      case ClippsterServer.Tokend.Client.publish_media(access_token, media_url, %{
             media_type: params["media_type"] || "video",
             caption: params["caption"]
           }) do
        {:ok, post_data} ->
          post_attrs = %{
            user_id: user.id,
            clipper_social_account_id: account.id,
            platform: "tokend",
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
              conn
              |> put_status(201)
              |> json(%{
                success: true,
                post: serialize_post(post),
                message: "Published to Tokend successfully (#{post_data[:mode] || "mock"})"
              })

            {:error, changeset} ->
              conn
              |> put_status(422)
              |> json(%{success: false, error: extract_changeset_error(changeset)})
          end
      end
    else
      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{success: false, error: "Account not found"})

      {:error, :account_inactive} ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: "Tokend account is inactive"})

      {:error, :wrong_platform} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Account is not a Tokend account"})

      {:error, :missing_param, field} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Missing required field: #{field}"})

      {:error, reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: inspect(reason)})
    end
  end

  defp publish_to_platform(conn, params, platform, platform_label) do
    user = conn.assigns.current_user

    with {:ok, account_id} <- get_required_param(params, "account_id"),
         {:ok, media_url} <- get_required_param(params, "media_url"),
         {:ok, account} <- get_user_account(user.id, account_id),
         :ok <- validate_platform(account, platform),
         {:ok, account} <- PostForMeConnectionSync.ensure_user_publish_ready(account, platform_label),
         {:ok, post_data} <- publish_via_post_for_me(account, media_url, params) do
      post_attrs = %{
        user_id: user.id,
        clipper_social_account_id: account.id,
        platform: platform,
        post_id: post_data.post_id,
        post_url: post_data.post_url,
        provider_post_id: post_data.provider_post_id,
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

      {:error, :account_inactive} ->
        conn
        |> put_status(422)
        |> json(%{
          success: false,
          error: PostForMeAccountHealth.disconnected_message(platform_label),
          error_code: "social_token_expired",
          platform: platform
        })

      {:error, :wrong_platform} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Account is not a #{platform_label} account"})

      {:error, :token_expired, message} ->
        conn
        |> put_status(422)
        |> json(%{
          success: false,
          error: message,
          error_code: "social_token_expired",
          platform: platform
        })

      {:error, :missing_param, param} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Missing required parameter: #{param}"})

      {:error, reason} when is_binary(reason) ->
        if PostForMeAccountHealth.social_token_expired_error?(reason) do
          conn
          |> put_status(422)
          |> json(%{
            success: false,
            error: reason,
            error_code: "social_token_expired",
            platform: platform
          })
        else
          conn
          |> put_status(422)
          |> json(%{success: false, error: reason})
        end

      {:error, %PostForMe.ApiError{} = api_error} ->
        message = api_error.message || "Post For Me publish failed"

        if PostForMeAccountHealth.social_token_expired_error?(api_error) do
          conn
          |> put_status(422)
          |> json(%{
            success: false,
            error: message,
            error_code: "social_token_expired",
            platform: platform
          })
        else
          conn
          |> put_status(422)
          |> json(%{success: false, error: message})
        end

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
        nil -> Campaigns.list_all_user_posts(user.id)
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
      UserPostsAnalyticsSync.sync_for_user(user.id)
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
  Generate thumbnail for a post that's missing one.

  POST /api/user/posts/:id/generate-thumbnail
  """
  def generate_thumbnail(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    with {:ok, post, post_type} <- find_user_post_for_thumbnail(user.id, id),
         :ok <- validate_needs_thumbnail(post),
         {:ok, thumbnail_url} <- generate_thumbnail_from_video(post.media_url) do
      case update_post_thumbnail(post, post_type, thumbnail_url) do
        {:ok, updated_post} ->
          conn
          |> json(%{
            success: true,
            post: serialize_post_map(updated_post),
            thumbnail_url: thumbnail_url,
            message: "Thumbnail generated successfully"
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
        |> json(%{success: false, error: "Post not found"})

      {:error, :has_thumbnail} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Post already has a thumbnail"})

      {:error, :no_media_url} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Post has no media URL"})

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
        Logger.info(
          "[UserPosts] PostForMe post created - id: #{post.id}, status: #{post.status}, scheduled_at: #{inspect(post.scheduled_at)}"
        )

        Logger.info("[UserPosts] PostForMe raw response: #{inspect(post.raw)}")

        with :ok <- validate_post_for_me_account_token(post, account.provider_account_id),
             :ok <-
               verify_post_for_me_publish_result(
                 post.id,
                 account.provider_account_id,
                 post.status
               ) do
          {post_url, provider_post_id} =
            fetch_post_data_from_feed(account.provider_account_id, post.id)

          {:ok,
           %{
             post_id: post.id || "pfm_post",
             post_url: post_url,
             provider_post_id: provider_post_id
           }}
        end

      {:error, reason} ->
        Logger.error("[UserPosts] PostForMe post creation failed: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp token_expired_message(platform_label) do
    PostForMeAccountHealth.token_expired_message(platform_label)
  end

  defp validate_post_for_me_account_token(post, provider_account_id) do
    post.raw
    |> Map.get("social_accounts", [])
    |> Enum.find(fn account -> account["id"] == provider_account_id end)
    |> case do
      %{"access_token_expires_at" => expires_at} when is_binary(expires_at) ->
        if post_for_me_token_expired?(expires_at) do
          Logger.error(
            "[UserPosts] PostForMe reports expired token for account #{provider_account_id} (expires #{expires_at})"
          )

          {:error, :token_expired,
           token_expired_message(
             post.raw
             |> Map.get("social_accounts", [])
             |> account_platform_label(provider_account_id)
           )}
        else
          :ok
        end

      _ ->
        :ok
    end
  end

  defp account_platform_label(accounts, provider_account_id) do
    accounts
    |> Enum.find_value("social", fn account ->
      if account["id"] == provider_account_id do
        account["platform"] || "social"
      end
    end)
    |> String.capitalize()
  end

  defp post_for_me_token_expired?(expires_at) do
    case DateTime.from_iso8601(expires_at) do
      {:ok, dt, _} -> DateTime.compare(dt, DateTime.utc_now()) == :lt
      _ -> false
    end
  end

  # PostForMe's social-post-results list may include unrelated rows when filtered by
  # social_post_id; only trust results that match both the post and target account.
  # Instagram video uploads often exceed 30s; poll briefly then accept in-flight PostForMe jobs.
  @post_for_me_verify_retries 15
  @post_for_me_verify_interval_ms 2_000

  defp verify_post_for_me_publish_result(
         post_id,
         provider_account_id,
         initial_status,
         retries_left \\ @post_for_me_verify_retries
       ) do
    case fetch_post_for_me_result_for_account(post_id, provider_account_id) do
      {:ok, _result} ->
        Logger.info(
          "[UserPosts] PostForMe publishing succeeded for post #{post_id} (account #{provider_account_id})"
        )

        :ok

      {:error, :failed, error_message} ->
        Logger.error(
          "[UserPosts] PostForMe publishing failed for post #{post_id} (account #{provider_account_id}): #{error_message}"
        )

        {:error, error_message}

      :pending when retries_left > 0 ->
        Logger.info(
          "[UserPosts] PostForMe result not ready for post #{post_id} (status=#{initial_status}), retrying in #{div(@post_for_me_verify_interval_ms, 1000)}s (#{retries_left} left)"
        )

        Process.sleep(@post_for_me_verify_interval_ms)

        verify_post_for_me_publish_result(
          post_id,
          provider_account_id,
          initial_status,
          retries_left - 1
        )

      :pending ->
        case classify_post_for_me_pending_outcome(post_id, provider_account_id) do
          :accept ->
            Logger.warning(
              "[UserPosts] PostForMe publish still in progress for #{post_id} after retries; accepting (Instagram may finish shortly)"
            )

            :ok

          {:error, :failed, message} ->
            {:error, message}

          :reject ->
            Logger.warning(
              "[UserPosts] PostForMe publish result unavailable for post #{post_id} after retries"
            )

            {:error,
             "Publish could not be confirmed. Please check your social account and try again."}
        end

      {:error, :api, reason} ->
        Logger.warning(
          "[UserPosts] Could not verify PostForMe publish result for post #{post_id}: #{inspect(reason)}"
        )

        {:error, format_post_for_me_error(reason)}
    end
  end

  defp fetch_post_for_me_result_for_account(post_id, provider_account_id) do
    result_status =
      case PostForMe.list_social_post_results(%{"social_post_id" => post_id}) do
        {:ok, %{data: results}} when is_list(results) ->
          matching =
            Enum.filter(results, fn result ->
              result.post_id == post_id and result.social_account_id == provider_account_id
            end)

          case matching do
            [] ->
              :pending

            results ->
              failures = Enum.filter(results, &(&1.success == false))

              if failures != [] do
                error_message =
                  failures
                  |> Enum.map(fn r -> r.error || "Unknown publish error" end)
                  |> Enum.join("; ")

                {:error, :failed, error_message}
              else
                {:ok, List.first(results)}
              end
          end

        {:error, reason} ->
          {:error, :api, reason}
      end

    case result_status do
      :pending -> fetch_post_status_fallback(post_id)
      other -> other
    end
  end

  defp fetch_post_status_fallback(post_id) do
    case PostForMe.get_social_post(post_id) do
      {:ok, %{status: status}} when status in ["published", "completed", "success"] ->
        {:ok, %{success: true}}

      {:ok, %{status: status}} when status in ["failed", "error"] ->
        {:error, :failed, "Post For Me reported status: #{status}"}

      {:ok, %{status: status}} when status in ["processing", "scheduled", "pending"] ->
        :pending

      {:ok, _} ->
        :pending

      {:error, reason} ->
        {:error, :api, reason}
    end
  end

  # When polling times out, only accept if PostForMe confirms success for this account.
  defp classify_post_for_me_pending_outcome(post_id, provider_account_id) do
    case fetch_post_for_me_result_for_account(post_id, provider_account_id) do
      {:ok, _} ->
        :accept

      {:error, :failed, message} ->
        {:error, :failed, message}

      _ ->
        case PostForMe.get_social_post(post_id) do
          {:ok, %{status: status}} when status in ["failed", "error"] ->
            {:error, :failed, "Post For Me reported status: #{status}"}

          _ ->
            :reject
        end
    end
  end

  defp format_post_for_me_error(%ClippsterServer.Social.Providers.PostForMe.ApiError{} = error),
    do: error.message

  defp format_post_for_me_error(reason) when is_binary(reason), do: reason
  defp format_post_for_me_error(reason), do: inspect(reason)

  # Fetch post URL and provider_post_id from PostForMe feed by post ID
  # Retries up to 3 times with 3-second delays to allow PostForMe's feed to index the post
  defp fetch_post_data_from_feed(provider_account_id, post_id) do
    fetch_post_data_from_feed_with_retry(provider_account_id, post_id, 3)
  end

  defp fetch_post_data_from_feed_with_retry(provider_account_id, post_id, retries_left) do
    case PostForMeFeedAnalytics.resolve_publish_metadata(provider_account_id, post_id) do
      {:ok, %{post_url: url, provider_post_id: provider_id}}
      when is_binary(url) or is_binary(provider_id) ->
        {url, provider_id}

      {:error, {:publish_failed, _error}} ->
        {nil, nil}

      {:error, :not_found} when retries_left > 0 ->
        Logger.info(
          "[UserPosts] Post #{post_id} publish metadata not ready, retrying in 3 seconds (#{retries_left} retries left)"
        )

        Process.sleep(3000)
        fetch_post_data_from_feed_with_retry(provider_account_id, post_id, retries_left - 1)

      _ ->
        fetch_post_data_from_feed_legacy(provider_account_id, post_id, retries_left)
    end
  end

  defp fetch_post_data_from_feed_legacy(provider_account_id, post_id, retries_left) do
    case fetch_post_for_me_feed(provider_account_id) do
      {:ok, feed_items} ->
        case Enum.find(feed_items, fn item ->
               to_string(item["platform_post_id"] || "") == post_id or
                 feed_item_has_social_post_id?(item, post_id)
             end) do
          nil when retries_left > 0 ->
            Logger.info(
              "[UserPosts] Post #{post_id} not found in feed yet, retrying in 3 seconds (#{retries_left} retries left)"
            )

            Process.sleep(3000)
            fetch_post_data_from_feed_with_retry(provider_account_id, post_id, retries_left - 1)

          nil ->
            Logger.warning(
              "[UserPosts] Post #{post_id} not found in feed after all retries, URL and provider_post_id will be nil"
            )

            {nil, nil}

          item ->
            url = item["platform_url"]
            provider_id = item["platform_post_id"]

            Logger.info(
              "[UserPosts] Found post data in feed: url=#{url}, provider_post_id=#{provider_id}"
            )

            {url, provider_id}
        end

      {:error, reason} when retries_left > 0 ->
        Logger.warning(
          "[UserPosts] Failed to fetch feed for data lookup: #{inspect(reason)}, retrying in 3 seconds"
        )

        Process.sleep(3000)
        fetch_post_data_from_feed_with_retry(provider_account_id, post_id, retries_left - 1)

      {:error, reason} ->
        Logger.warning(
          "[UserPosts] Failed to fetch feed for data lookup after all retries: #{inspect(reason)}"
        )

        {nil, nil}
    end
  end

  defp feed_item_has_social_post_id?(item, post_id) do
    to_string(item["social_post_id"] || "") == post_id
  end

  defp fetch_post_for_me_feed(provider_account_id),
    do: PostForMeFeedAnalytics.fetch_feed(provider_account_id)

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

  defp serialize_post(%{} = post) when is_map(post) do
    # Generate presigned URLs for R2 storage URLs
    thumbnail_url =
      if post.thumbnail_url && String.contains?(post.thumbnail_url, ".r2.cloudflarestorage.com") do
        ClippsterServer.Storage.presigned_url!(post.thumbnail_url, expires_in: 3600)
      else
        post.thumbnail_url
      end

    media_url =
      if post.media_url && String.contains?(post.media_url, ".r2.cloudflarestorage.com") do
        ClippsterServer.Storage.presigned_url!(post.media_url, expires_in: 3600)
      else
        post.media_url
      end

    %{
      id: post.id,
      platform: post.platform,
      post_id: post.post_id,
      post_url: post.post_url,
      caption: post.caption,
      media_url: media_url,
      thumbnail_url: thumbnail_url,
      media_type: post.media_type,
      status: post.status,
      view_count: post.view_count || 0,
      like_count: post.like_count || 0,
      comment_count: post.comment_count || 0,
      save_count: post.save_count || 0,
      reach_count: post.reach_count || 0,
      impressions_count: post.impressions_count || 0,
      synced_at: Map.get(post, :synced_at),
      published_at: post.published_at,
      inserted_at: post.inserted_at,
      updated_at: Map.get(post, :updated_at),
      source: Map.get(post, :source)
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
            Logger.warning(
              "[UserPosts] Dual-track skipped: creator profile #{creator_profile_id} not found"
            )

          profile ->
            create_org_submission(
              user,
              account,
              post_data,
              params,
              platform,
              profile,
              campaign_id
            )
        end

      not is_nil(campaign_id) ->
        case Campaigns.get_campaign(campaign_id) do
          nil ->
            Logger.warning("[UserPosts] Dual-track skipped: campaign #{campaign_id} not found")

          campaign ->
            # Campaign belongs to an org; look up the creator profile if linked
            creator_profile =
              if campaign.creator_profile_id,
                do: Organizations.get_creator_profile(campaign.creator_profile_id),
                else: nil

            submission_attrs = %{
              organization_id: campaign.organization_id,
              organization_creator_profile_id: creator_profile && creator_profile.id,
              campaign_id: campaign.id,
              clip_id: params["clip_id"],
              clip_build_id: params["clip_build_id"],
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

                # Submit to campaign - clip_url will be populated later from PostForMe feed sync
                Logger.info(
                  "[UserPosts] Attempting to submit clip to campaign #{campaign.id} for user #{user.id}"
                )

                campaign_submission_attrs = %{
                  platform: platform,
                  platform_post_id: post_data.post_id,
                  social_account_id: account.id
                }

                Logger.info(
                  "[UserPosts] Campaign submission attrs: #{inspect(campaign_submission_attrs)}"
                )

                case Campaigns.submit_clip(campaign, user, campaign_submission_attrs) do
                  {:ok, campaign_submission} ->
                    Logger.info(
                      "[UserPosts] ✅ Successfully submitted clip to campaign #{campaign.id}, submission ID: #{campaign_submission.id}"
                    )

                  {:error, :not_a_participant} ->
                    Logger.error(
                      "[UserPosts] ❌ User #{user.id} is not a participant in campaign #{campaign.id}"
                    )

                  {:error, :campaign_not_active} ->
                    Logger.error("[UserPosts] ❌ Campaign #{campaign.id} is not active")

                  {:error, :campaign_not_started} ->
                    Logger.error("[UserPosts] ❌ Campaign #{campaign.id} has not started yet")

                  {:error, :campaign_ended} ->
                    Logger.error("[UserPosts] ❌ Campaign #{campaign.id} has ended")

                  {:error, :platform_not_allowed} ->
                    Logger.error(
                      "[UserPosts] ❌ Platform #{platform} is not allowed for campaign #{campaign.id}"
                    )

                  {:error, reason} ->
                    Logger.error("[UserPosts] ❌ Failed to submit to campaign: #{inspect(reason)}")
                end

                Logger.info(
                  "[UserPosts] Dual-tracked to org #{campaign.organization_id} via campaign #{campaign.id}"
                )

              {:error, reason} ->
                Logger.warning(
                  "[UserPosts] Dual-track failed for campaign #{campaign_id}: #{inspect(reason)}"
                )
            end
        end

      true ->
        :ok
    end
  end

  # Thumbnail generation helpers

  defp find_user_post_for_thumbnail(user_id, post_id) do
    # Try user_posts table first
    case Campaigns.get_user_post(post_id) do
      %UserPost{user_id: ^user_id} = post ->
        {:ok, post, :user_post}

      %UserPost{} ->
        {:error, :not_found}

      nil ->
        # Try post_submissions table
        case Social.get_post_submission(post_id) do
          %PostSubmission{submitted_by_user_id: ^user_id} = post ->
            {:ok, post, :post_submission}

          %PostSubmission{} ->
            {:error, :not_found}

          nil ->
            {:error, :not_found}
        end
    end
  end

  defp update_post_thumbnail(post, :user_post, thumbnail_url) do
    Campaigns.update_user_post(post, %{thumbnail_url: thumbnail_url})
  end

  defp update_post_thumbnail(post, :post_submission, thumbnail_url) do
    # Use Repo.update directly with a simple changeset
    post
    |> Ecto.Changeset.change(%{thumbnail_url: thumbnail_url})
    |> ClippsterServer.Repo.update()
  end

  defp serialize_post_map(%UserPost{} = post), do: serialize_post(post)

  defp serialize_post_map(%PostSubmission{} = post) do
    # Generate presigned URLs for R2 storage URLs
    thumbnail_url =
      if post.thumbnail_url && String.contains?(post.thumbnail_url, ".r2.cloudflarestorage.com") do
        ClippsterServer.Storage.presigned_url!(post.thumbnail_url, expires_in: 3600)
      else
        post.thumbnail_url
      end

    media_url =
      if post.media_url && String.contains?(post.media_url, ".r2.cloudflarestorage.com") do
        ClippsterServer.Storage.presigned_url!(post.media_url, expires_in: 3600)
      else
        post.media_url
      end

    %{
      id: post.id,
      platform: post.platform,
      post_id: post.post_id,
      post_url: post.post_url,
      caption: post.caption,
      media_url: media_url,
      thumbnail_url: thumbnail_url,
      media_type: post.media_type,
      status: post.status,
      view_count: post.view_count || 0,
      like_count: post.like_count || 0,
      comment_count: post.comment_count || 0,
      save_count: post.save_count || 0,
      reach_count: post.reach_count || 0,
      impressions_count: post.impressions_count || 0,
      published_at: post.posted_at,
      inserted_at: post.inserted_at,
      source: "organization"
    }
  end

  defp validate_needs_thumbnail(post) do
    cond do
      is_nil(post.media_url) or post.media_url == "" ->
        {:error, :no_media_url}

      not is_nil(post.thumbnail_url) and post.thumbnail_url != "" ->
        {:error, :has_thumbnail}

      true ->
        :ok
    end
  end

  defp generate_thumbnail_from_video(media_url) do
    # Use FFmpeg to extract a frame from the video
    timestamp = DateTime.utc_now() |> DateTime.to_unix()
    unique_id = :crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)
    thumbnail_key = "social-media/thumbnails/#{timestamp}_#{unique_id}.jpg"

    # Download video to temp file
    with {:ok, video_data} <- download_video(media_url),
         {:ok, temp_video_path} <- write_temp_file(video_data, ".mp4"),
         {:ok, thumbnail_data} <- extract_frame_with_ffmpeg(temp_video_path),
         {:ok, thumbnail_url} <- upload_thumbnail(thumbnail_data, thumbnail_key) do
      # Clean up temp file
      File.rm(temp_video_path)
      {:ok, thumbnail_url}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp download_video(url) do
    # Extract the key from the R2 URL
    case ClippsterServer.Storage.extract_key_from_url(url) do
      {:ok, key} ->
        # Download directly from R2 using ExAws
        bucket = ClippsterServer.Storage.bucket()
        config = ClippsterServer.Storage.config()

        case ExAws.S3.get_object(bucket, key) |> ExAws.request(config) do
          {:ok, %{body: body}} ->
            {:ok, body}

          {:error, reason} ->
            Logger.error("[download_video] S3 download failed for key #{key}: #{inspect(reason)}")
            {:error, reason}
        end

      {:error, _} ->
        # Not an R2 URL, try direct HTTP download
        headers = [{"User-Agent", "ClippsterServer/1.0"}]
        options = [timeout: 30_000, recv_timeout: 30_000, follow_redirect: true, max_redirect: 5]

        case HTTPoison.get(url, headers, options) do
          {:ok, %{status_code: 200, body: body}} ->
            {:ok, body}

          {:ok, %{status_code: status, body: body}} ->
            Logger.error("[download_video] HTTP #{status} for URL: #{url}")
            Logger.error("[download_video] Response body: #{inspect(body)}")
            {:error, "HTTP #{status}"}

          {:error, reason} ->
            Logger.error("[download_video] Request failed: #{inspect(reason)}")
            {:error, reason}
        end
    end
  end

  defp write_temp_file(data, ext) do
    temp_dir = System.tmp_dir!()
    filename = "video_#{:crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)}#{ext}"
    path = Path.join(temp_dir, filename)

    case File.write(path, data) do
      :ok -> {:ok, path}
      {:error, reason} -> {:error, reason}
    end
  end

  defp extract_frame_with_ffmpeg(video_path) do
    output_path = "#{video_path}_thumb.jpg"

    # Extract frame at 1 second with scale to 640px width
    args = [
      "-i",
      video_path,
      "-ss",
      "00:00:01",
      "-vframes",
      "1",
      "-vf",
      "scale=640:-1",
      "-q:v",
      "2",
      output_path
    ]

    case System.cmd("ffmpeg", args, stderr_to_stdout: true) do
      {_, 0} ->
        case File.read(output_path) do
          {:ok, data} ->
            File.rm(output_path)
            {:ok, data}

          {:error, reason} ->
            {:error, reason}
        end

      {output, _} ->
        Logger.error("[generate_thumbnail] FFmpeg failed: #{output}")
        {:error, :ffmpeg_failed}
    end
  end

  defp upload_thumbnail(data, key) do
    case ClippsterServer.Storage.upload_file(data, key, content_type: "image/jpeg") do
      {:ok, url} -> {:ok, url}
      {:error, reason} -> {:error, reason}
    end
  end

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
      clip_id: params["clip_id"],
      clip_build_id: params["clip_build_id"],
      aspect_ratio: params["aspect_ratio"],
      build_type: params["build_type"],
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

        Logger.info(
          "[UserPosts] Dual-tracked to org #{profile.organization_id} via creator profile #{profile.id}"
        )

      {:error, reason} ->
        Logger.warning(
          "[UserPosts] Dual-track failed for creator profile #{profile.id}: #{inspect(reason)}"
        )
    end
  end
end
