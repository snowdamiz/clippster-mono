defmodule ClippsterServerWeb.UserPostsController do
  @moduledoc """
  Controller for managing user Instagram posts and analytics.
  """

  use ClippsterServerWeb, :controller

  require Logger

  alias ClippsterServer.Campaigns
  alias ClippsterServer.Campaigns.{ClipperSocialAccount, UserPost}
  alias ClippsterServer.Social.Platforms.Instagram
  alias ClippsterServer.Social.Platforms.Twitter

  @doc """
  Publish a post to user's Instagram account.

  POST /api/user/instagram/publish
  """
  def publish(conn, params) do
    user = conn.assigns.current_user

    with {:ok, account_id} <- get_required_param(params, "account_id"),
         {:ok, media_url} <- get_required_param(params, "media_url"),
         {:ok, account} <- get_user_account(user.id, account_id),
         {:ok, post_data} <- publish_to_instagram(account, media_url, params) do

      # Create post record
      post_attrs = %{
        user_id: user.id,
        clipper_social_account_id: account.id,
        platform: "instagram",
        post_id: post_data.post_id,
        post_url: post_data.post_url,
        caption: params["caption"],
        media_url: media_url,
        thumbnail_url: params["thumbnail_url"],
        media_type: params["media_type"] || "reel",
        status: "published"
      }

      case Campaigns.create_user_post(user, post_attrs) do
        {:ok, post} ->
          conn
          |> put_status(201)
          |> json(%{
            success: true,
            post: serialize_post(post),
            message: "Published successfully"
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

      {:error, :missing_param, param} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: "Missing required parameter: #{param}"})

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: inspect(reason)})
    end
  end

  @doc """
  Publish a post to user's X (Twitter) account.

  POST /api/user/twitter/publish
  """
  def publish_twitter(conn, params) do
    user = conn.assigns.current_user

    with {:ok, account_id} <- get_required_param(params, "account_id"),
         {:ok, media_url} <- get_required_param(params, "media_url"),
         {:ok, account} <- get_user_account(user.id, account_id),
         :ok <- validate_platform(account, "twitter"),
         {:ok, post_data} <- publish_to_twitter(account, media_url, params) do

      post_attrs = %{
        user_id: user.id,
        clipper_social_account_id: account.id,
        platform: "x",
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
            message: "Published to X successfully"
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
        |> json(%{success: false, error: "Account is not a Twitter/X account"})

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
      Logger.error("[UserPosts] publish_twitter crashed: #{Exception.message(e)}\n#{Exception.format_stacktrace(__STACKTRACE__)}")
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

    posts = case params["account_id"] do
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
    opts = if params["days"], do: Keyword.put(opts, :days, String.to_integer(params["days"])), else: opts
    opts = if params["account_id"], do: Keyword.put(opts, :account_id, String.to_integer(params["account_id"])), else: opts

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
        content_type = case ext do
          ".mp4" -> "video/mp4"
          ".mov" -> "video/quicktime"
          ".webm" -> "video/webm"
          ".jpg" -> "image/jpeg"
          ".jpeg" -> "image/jpeg"
          ".png" -> "image/png"
          ".gif" -> "image/gif"
          _ -> "application/octet-stream"
        end

        case ClippsterServer.Storage.upload_file_from_path(upload.path, key, content_type: content_type) do
          {:ok, url} ->
            # Handle optional thumbnail upload
            thumbnail_url = case params["thumbnail"] do
              %Plug.Upload{} = thumb ->
                thumb_ext = Path.extname(thumb.filename) |> String.downcase()
                thumb_key = "social-media/users/#{user.id}/#{timestamp}_#{unique_id}_thumb#{thumb_ext}"
                thumb_content_type = case thumb_ext do
                  ".jpg" -> "image/jpeg"
                  ".jpeg" -> "image/jpeg"
                  ".png" -> "image/png"
                  _ -> "image/jpeg"
                end

                case ClippsterServer.Storage.upload_file_from_path(thumb.path, thumb_key, content_type: thumb_content_type) do
                  {:ok, thumb_url} -> thumb_url
                  {:error, _} -> nil
                end
              _ -> nil
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
      nil -> {:error, :not_found}
      post ->
        if post.user_id == user_id do
          {:ok, post}
        else
          {:error, :not_found}
        end
    end
  end

  defp publish_to_instagram(account, media_url, params) do
    access_token = ClipperSocialAccount.get_access_token(account)

    opts = %{
      caption: params["caption"] || "",
      media_type: params["media_type"] || "reel",
      ig_user_id: account.platform_user_id
    }

    Instagram.publish_media(access_token, media_url, opts)
  end

  defp publish_to_twitter(account, media_url, params) do
    {:ok, account} = maybe_refresh_twitter_token(account)
    access_token = ClipperSocialAccount.get_access_token(account)
    caption = params["caption"] || ""

    opts = [
      filename: "video.mp4",
      media_type: params["media_type"] || "video"
    ]

    with {:ok, %{media_id: media_id}} <- Twitter.publish_media(access_token, media_url, opts),
         {:ok, tweet_data} <- Twitter.create_tweet(access_token, caption, media_ids: [media_id]) do
      {:ok, %{post_id: tweet_data.post_id, post_url: tweet_data.post_url}}
    end
  end

  defp maybe_refresh_twitter_token(%ClipperSocialAccount{} = account) do
    needs_refresh = account.token_expires_at == nil or ClipperSocialAccount.token_needs_refresh?(account)
    if needs_refresh do
      Logger.info("[UserPosts] X token needs refresh for account #{account.id}")
      refresh_token = ClipperSocialAccount.get_refresh_token(account)

      case Twitter.refresh_tokens(refresh_token) do
        {:ok, new_tokens} ->
          expires_at = if new_tokens[:expires_in] do
            DateTime.utc_now()
            |> DateTime.add(new_tokens[:expires_in], :second)
            |> DateTime.truncate(:second)
          else
            nil
          end

          attrs = %{
            access_token: new_tokens[:access_token],
            token_expires_at: expires_at
          }

          attrs = if new_tokens[:refresh_token] do
            Map.put(attrs, :refresh_token, new_tokens[:refresh_token])
          else
            attrs
          end

          case Campaigns.update_social_account_tokens(account, attrs) do
            {:ok, updated_account} ->
              Logger.info("[UserPosts] Successfully refreshed X token for account #{account.id}")
              {:ok, updated_account}
            {:error, reason} ->
              Logger.warning("[UserPosts] Failed to save refreshed X token: #{inspect(reason)}")
              {:ok, account}
          end

        {:error, reason} ->
          Logger.error("[UserPosts] Failed to refresh X token: #{inspect(reason)}")
          {:error, {:token_refresh_failed, reason}}
      end
    else
      {:ok, account}
    end
  end

  defp fetch_insights(account, post) do
    access_token = ClipperSocialAccount.get_access_token(account)
    Instagram.get_insights(access_token, post.post_id)
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
end
