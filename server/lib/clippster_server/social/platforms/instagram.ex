defmodule ClippsterServer.Social.Platforms.Instagram do
  @moduledoc """
  Instagram API with Instagram Login integration.

  Handles:
  - OAuth token exchange (Instagram Business Login)
  - User profile retrieval
  - Content publishing (images, videos, reels)
  - Insights/analytics retrieval
  - Token refresh

  Documentation: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
  """

  @behaviour ClippsterServer.Social.Platform

  # Instagram OAuth endpoints
  @instagram_oauth_url "https://api.instagram.com/oauth/access_token"
  @instagram_graph_url "https://graph.instagram.com"

  # ============================================================================
  # Platform Callbacks
  # ============================================================================

  @impl true
  def platform_id, do: "instagram"

  @impl true
  def platform_name, do: "Instagram"

  @impl true
  def authorize_url(opts) do
    # Build the Instagram authorization URL
    # This is typically built on the client side, but provided here for completeness
    app_id = opts[:app_id] || raise "app_id required"
    redirect_uri = opts[:redirect_uri] || raise "redirect_uri required"
    scope = opts[:scope] || "instagram_business_basic,instagram_business_content_publish"
    state = opts[:state]

    params = %{
      "client_id" => app_id,
      "redirect_uri" => redirect_uri,
      "response_type" => "code",
      "scope" => scope
    }

    params = if state, do: Map.put(params, "state", state), else: params

    "https://www.instagram.com/oauth/authorize?" <> URI.encode_query(params)
  end

  @impl true
  def exchange_code(code, opts) do
    app_id = opts[:app_id] || raise "app_id required"
    app_secret = opts[:app_secret] || raise "app_secret required"
    redirect_uri = opts[:redirect_uri] || raise "redirect_uri required"

    # Step 1: Exchange code for short-lived token
    case exchange_code_for_short_lived_token(code, app_id, app_secret, redirect_uri) do
      {:ok, short_lived_data} ->
        # Step 2: Exchange short-lived token for long-lived token
        case exchange_for_long_lived_token(short_lived_data.access_token, app_secret) do
          {:ok, long_lived_data} ->
            {:ok, %{
              access_token: long_lived_data.access_token,
              user_id: short_lived_data.user_id,
              expires_in: long_lived_data.expires_in,
              permissions: short_lived_data.permissions
            }}

          {:error, reason} ->
            # Fall back to short-lived token if long-lived exchange fails
            IO.puts("[Instagram] Long-lived token exchange failed: #{inspect(reason)}, using short-lived token")
            {:ok, %{
              access_token: short_lived_data.access_token,
              user_id: short_lived_data.user_id,
              expires_in: 3600, # Short-lived tokens last 1 hour
              permissions: short_lived_data.permissions
            }}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def refresh_tokens(access_token) do
    # Refresh a long-lived token for another 60 days
    # Only works if token is at least 24 hours old and not expired
    url = "#{@instagram_graph_url}/refresh_access_token?" <> URI.encode_query(%{
      "grant_type" => "ig_refresh_token",
      "access_token" => access_token
    })

    case HTTPoison.get(url) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"access_token" => new_token, "expires_in" => expires_in}} ->
            {:ok, %{access_token: new_token, expires_in: expires_in}}

          {:ok, %{"error" => error}} ->
            {:error, error["message"] || "Token refresh failed"}

          _ ->
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        IO.puts("[Instagram] Token refresh failed: #{status} - #{body}")
        {:error, extract_error(body, :token_refresh_failed)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def get_user_profile(access_token) do
    # Get the authenticated user's profile
    url = "#{@instagram_graph_url}/me?" <> URI.encode_query(%{
      "fields" => "id,username,name,profile_picture_url,account_type,followers_count,media_count",
      "access_token" => access_token
    })

    case HTTPoison.get(url) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"error" => error}} ->
            {:error, error["message"] || "Failed to get profile"}

          {:ok, profile} ->
            {:ok, %{
              user_id: profile["id"],
              username: profile["username"],
              display_name: profile["name"] || profile["username"],
              profile_image_url: profile["profile_picture_url"],
              account_type: profile["account_type"],
              followers_count: profile["followers_count"],
              media_count: profile["media_count"]
            }}

          {:error, _} ->
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        IO.puts("[Instagram] Profile fetch failed: #{status} - #{body}")
        {:error, extract_error(body, :profile_fetch_failed)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def publish_media(access_token, media_url, opts) do
    # Get the user ID from opts or fetch it
    ig_user_id = opts[:ig_user_id] || opts[:user_id]
    caption = opts[:caption] || ""
    media_type = detect_media_type(media_url, opts)

    unless ig_user_id do
      # Try to get the user ID from the access token
      case get_user_profile(access_token) do
        {:ok, profile} ->
          do_publish_media(access_token, profile.user_id, media_url, caption, media_type)
        {:error, reason} ->
          {:error, "Cannot determine user ID: #{inspect(reason)}"}
      end
    else
      do_publish_media(access_token, ig_user_id, media_url, caption, media_type)
    end
  end

  @impl true
  def get_insights(access_token, post_id) do
    # First, get basic media info
    media_url = "#{@instagram_graph_url}/#{post_id}?" <> URI.encode_query(%{
      "fields" => "media_type,like_count,comments_count",
      "access_token" => access_token
    })

    case HTTPoison.get(media_url) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"error" => error}} ->
            {:error, error["message"] || "Failed to get media info"}

          {:ok, media_data} ->
            media_type = media_data["media_type"]
            base_insights = %{
              like_count: media_data["like_count"] || 0,
              comment_count: media_data["comments_count"] || 0,
              view_count: 0,
              share_count: 0,
              save_count: 0,
              reach_count: 0,
              impressions_count: 0
            }

            # Get additional insights based on media type
            metrics = case media_type do
              "VIDEO" -> "impressions,reach,saved,video_views"
              "REELS" -> "impressions,reach,saved,plays,shares"
              _ -> "impressions,reach,saved"
            end

            insights_url = "#{@instagram_graph_url}/#{post_id}/insights?" <> URI.encode_query(%{
              "metric" => metrics,
              "access_token" => access_token
            })

            case HTTPoison.get(insights_url) do
              {:ok, %HTTPoison.Response{status_code: 200, body: insights_body}} ->
                case Jason.decode(insights_body) do
                  {:ok, %{"data" => metrics_data}} ->
                    {:ok, parse_insights(metrics_data, base_insights)}
                  _ ->
                    {:ok, base_insights}
                end
              _ ->
                {:ok, base_insights}
            end

          {:error, _} ->
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        IO.puts("[Instagram] Insights fetch failed: #{status} - #{body}")
        {:error, extract_error(body, :insights_fetch_failed)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # ============================================================================
  # Token Exchange Functions
  # ============================================================================

  defp exchange_code_for_short_lived_token(code, app_id, app_secret, redirect_uri) do
    # POST to Instagram OAuth endpoint
    body = URI.encode_query(%{
      "client_id" => app_id,
      "client_secret" => app_secret,
      "grant_type" => "authorization_code",
      "redirect_uri" => redirect_uri,
      "code" => code
    })

    headers = [{"Content-Type", "application/x-www-form-urlencoded"}]

    case HTTPoison.post(@instagram_oauth_url, body, headers) do
      {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
        case Jason.decode(response_body) do
          {:ok, %{"data" => [data | _]}} ->
            # New format with data array
            {:ok, %{
              access_token: data["access_token"],
              user_id: data["user_id"],
              permissions: data["permissions"]
            }}

          {:ok, %{"access_token" => token, "user_id" => user_id} = data} ->
            # Legacy format
            {:ok, %{
              access_token: token,
              user_id: to_string(user_id),
              permissions: data["permissions"]
            }}

          {:ok, %{"error_type" => error_type, "error_message" => error_message}} ->
            {:error, "#{error_type}: #{error_message}"}

          _ ->
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} ->
        IO.puts("[Instagram] Code exchange failed: #{status} - #{response_body}")
        {:error, extract_error(response_body, :code_exchange_failed)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp exchange_for_long_lived_token(short_lived_token, app_secret) do
    # GET to exchange short-lived for long-lived token
    url = "#{@instagram_graph_url}/access_token?" <> URI.encode_query(%{
      "grant_type" => "ig_exchange_token",
      "client_secret" => app_secret,
      "access_token" => short_lived_token
    })

    case HTTPoison.get(url) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"access_token" => token, "expires_in" => expires_in}} ->
            {:ok, %{access_token: token, expires_in: expires_in}}

          {:ok, %{"error" => error}} ->
            {:error, error["message"] || "Long-lived token exchange failed"}

          _ ->
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        IO.puts("[Instagram] Long-lived token exchange failed: #{status} - #{body}")
        {:error, extract_error(body, :long_lived_token_exchange_failed)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # ============================================================================
  # Publishing Functions
  # ============================================================================

  defp do_publish_media(access_token, ig_user_id, media_url, caption, media_type) do
    case media_type do
      "image" -> publish_image(access_token, ig_user_id, media_url, caption)
      "video" -> publish_video(access_token, ig_user_id, media_url, caption)
      "reel" -> publish_reel(access_token, ig_user_id, media_url, caption)
      _ -> {:error, :unsupported_media_type}
    end
  end

  defp publish_image(access_token, ig_user_id, image_url, caption) do
    container_url = "#{@instagram_graph_url}/#{ig_user_id}/media"
    container_body = URI.encode_query(%{
      "image_url" => image_url,
      "caption" => caption,
      "access_token" => access_token
    })

    case create_media_container(container_url, container_body) do
      {:ok, container_id} ->
        publish_container(access_token, ig_user_id, container_id, "image")
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp publish_video(access_token, ig_user_id, video_url, caption) do
    container_url = "#{@instagram_graph_url}/#{ig_user_id}/media"
    container_body = URI.encode_query(%{
      "video_url" => video_url,
      "caption" => caption,
      "media_type" => "VIDEO",
      "access_token" => access_token
    })

    case create_media_container(container_url, container_body) do
      {:ok, container_id} ->
        case wait_for_media_ready(access_token, container_id) do
          :ok -> publish_container(access_token, ig_user_id, container_id, "video")
          {:error, reason} -> {:error, reason}
        end
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp publish_reel(access_token, ig_user_id, video_url, caption) do
    container_url = "#{@instagram_graph_url}/#{ig_user_id}/media"
    container_body = URI.encode_query(%{
      "video_url" => video_url,
      "caption" => caption,
      "media_type" => "REELS",
      "access_token" => access_token
    })

    case create_media_container(container_url, container_body) do
      {:ok, container_id} ->
        case wait_for_media_ready(access_token, container_id) do
          :ok -> publish_container(access_token, ig_user_id, container_id, "reel")
          {:error, reason} -> {:error, reason}
        end
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp create_media_container(url, body) do
    headers = [{"Content-Type", "application/x-www-form-urlencoded"}]

    case HTTPoison.post(url, body, headers) do
      {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
        case Jason.decode(response_body) do
          {:ok, %{"id" => container_id}} ->
            {:ok, container_id}
          {:ok, %{"error" => error}} ->
            {:error, error["message"] || "Container creation failed"}
          _ ->
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{body: body}} ->
        {:error, extract_error(body, :container_creation_failed)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp wait_for_media_ready(access_token, container_id, attempts \\ 0) do
    max_attempts = 30  # 5 minutes with 10 second intervals

    if attempts >= max_attempts do
      {:error, :media_processing_timeout}
    else
      url = "#{@instagram_graph_url}/#{container_id}?" <> URI.encode_query(%{
        "fields" => "status_code",
        "access_token" => access_token
      })

      case HTTPoison.get(url) do
        {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
          case Jason.decode(body) do
            {:ok, %{"status_code" => "FINISHED"}} ->
              :ok
            {:ok, %{"status_code" => "ERROR"}} ->
              {:error, :media_processing_failed}
            {:ok, %{"status_code" => status}} ->
              IO.puts("[Instagram] Media processing status: #{status}, waiting...")
              Process.sleep(10_000)
              wait_for_media_ready(access_token, container_id, attempts + 1)
            _ ->
              {:error, :invalid_response}
          end

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp publish_container(access_token, ig_user_id, container_id, media_type) do
    url = "#{@instagram_graph_url}/#{ig_user_id}/media_publish"
    body = URI.encode_query(%{
      "creation_id" => container_id,
      "access_token" => access_token
    })
    headers = [{"Content-Type", "application/x-www-form-urlencoded"}]

    case HTTPoison.post(url, body, headers) do
      {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
        case Jason.decode(response_body) do
          {:ok, %{"id" => post_id}} ->
            permalink = get_post_permalink(access_token, post_id)
            {:ok, %{
              post_id: post_id,
              post_url: permalink || "https://www.instagram.com/",
              media_type: media_type
            }}
          {:ok, %{"error" => error}} ->
            {:error, error["message"] || "Publish failed"}
          _ ->
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{body: body}} ->
        {:error, extract_error(body, :publish_failed)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp get_post_permalink(access_token, post_id) do
    url = "#{@instagram_graph_url}/#{post_id}?" <> URI.encode_query(%{
      "fields" => "permalink",
      "access_token" => access_token
    })

    case HTTPoison.get(url) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"permalink" => permalink}} -> permalink
          _ -> nil
        end
      _ -> nil
    end
  end

  # ============================================================================
  # Helper Functions
  # ============================================================================

  defp parse_insights(metrics, base_insights) when is_list(metrics) do
    Enum.reduce(metrics, base_insights, fn metric, acc ->
      value = get_metric_value(metric)
      case metric["name"] do
        "impressions" -> %{acc | impressions_count: value}
        "reach" -> %{acc | reach_count: value}
        "saved" -> %{acc | save_count: value}
        "shares" -> %{acc | share_count: value}
        "video_views" -> %{acc | view_count: value}
        "plays" -> %{acc | view_count: value}
        _ -> acc
      end
    end)
  end

  defp get_metric_value(%{"values" => [%{"value" => value} | _]}), do: value
  defp get_metric_value(_), do: 0

  defp detect_media_type(url, opts) do
    explicit_type = opts[:media_type]

    if explicit_type do
      explicit_type
    else
      cond do
        String.match?(url, ~r/\.(jpg|jpeg|png|gif|webp)$/i) -> "image"
        String.match?(url, ~r/\.(mp4|mov|avi|mkv|webm)$/i) -> "video"
        true -> "video"  # Default to video for clips
      end
    end
  end

  defp extract_error(body, default_error) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, %{"error" => %{"message" => message}}} -> message
      {:ok, %{"error_message" => message}} -> message
      {:ok, %{"error" => error}} when is_binary(error) -> error
      _ -> default_error
    end
  end
  defp extract_error(_, default_error), do: default_error
end
