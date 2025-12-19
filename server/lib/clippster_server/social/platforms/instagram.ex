defmodule ClippsterServer.Social.Platforms.Instagram do
  @moduledoc """
  Instagram Graph API integration for publishing and insights.
  
  Authentication is handled client-side via Facebook JavaScript SDK.
  This module handles:
  - Content publishing (images, videos, reels)
  - Insights/analytics retrieval
  - Token refresh (for Page Access Tokens)
  
  Required: Access token from Facebook Page (obtained via client-side FB SDK)
  """

  @behaviour ClippsterServer.Social.Platform

  @facebook_graph_url "https://graph.facebook.com/v18.0"

  # ============================================================================
  # Platform Callbacks
  # ============================================================================

  @impl true
  def platform_id, do: "instagram"

  @impl true
  def platform_name, do: "Instagram"

  @impl true
  def authorize_url(_opts) do
    # OAuth is handled client-side via Facebook SDK
    # This returns a message indicating the flow has changed
    raise "OAuth is handled client-side via Facebook JavaScript SDK. Use FB.login() in the browser."
  end

  @impl true
  def exchange_code(_code, _opts \\ %{}) do
    # OAuth is handled client-side via Facebook SDK
    {:error, "OAuth is handled client-side via Facebook JavaScript SDK"}
  end

  @impl true
  def refresh_tokens(page_access_token) do
    # Page Access Tokens from Facebook that were obtained with pages_read_engagement
    # permission are long-lived and don't expire. But we can verify the token is still valid.
    url = "#{@facebook_graph_url}/debug_token?" <> URI.encode_query(%{
      "input_token" => page_access_token,
      "access_token" => page_access_token
    })

    case HTTPoison.get(url) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"data" => %{"is_valid" => true, "expires_at" => 0}}} ->
            # Token doesn't expire (expires_at: 0 means never)
            {:ok, %{access_token: page_access_token, expires_in: nil}}

          {:ok, %{"data" => %{"is_valid" => true, "expires_at" => expires_at}}} ->
            # Token has expiration
            expires_in = expires_at - System.system_time(:second)
            {:ok, %{access_token: page_access_token, expires_in: max(0, expires_in)}}

          {:ok, %{"data" => %{"is_valid" => false}}} ->
            {:error, "Token is no longer valid. Please reconnect the Instagram account."}

          _ ->
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        IO.puts("Instagram token validation failed: #{status} - #{body}")
        {:error, :token_validation_failed}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def get_user_profile(page_access_token, instagram_account_id) when is_binary(instagram_account_id) do
    url = "#{@facebook_graph_url}/#{instagram_account_id}?" <> URI.encode_query(%{
      "fields" => "id,username,name,profile_picture_url,followers_count,media_count",
      "access_token" => page_access_token
    })

    case HTTPoison.get(url) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, profile} ->
            {:ok, %{
              user_id: profile["id"],
              username: profile["username"],
              display_name: profile["name"] || profile["username"],
              profile_image_url: profile["profile_picture_url"],
              followers_count: profile["followers_count"],
              media_count: profile["media_count"]
            }}

          {:error, _} ->
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        IO.puts("Instagram profile fetch failed: #{status} - #{body}")
        {:error, extract_error(body, :profile_fetch_failed)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Single-argument version for compatibility with Platform behavior
  @impl true
  def get_user_profile(_access_token) do
    {:error, "Instagram user profile requires both access_token and instagram_account_id. Use get_user_profile/2 instead."}
  end

  @impl true
  def publish_media(page_access_token, media_url, opts) do
    ig_user_id = Map.get(opts, :ig_user_id)
    caption = Map.get(opts, :caption, "")
    media_type = detect_media_type(media_url, opts)

    unless ig_user_id do
      {:error, :missing_ig_user_id}
    else
      case media_type do
        "image" -> publish_image(page_access_token, ig_user_id, media_url, caption)
        "video" -> publish_video(page_access_token, ig_user_id, media_url, caption)
        "reel" -> publish_reel(page_access_token, ig_user_id, media_url, caption)
        _ -> {:error, :unsupported_media_type}
      end
    end
  end

  @impl true
  def get_insights(page_access_token, post_id) do
    # First, get the media type to determine which metrics to request
    media_url = "#{@facebook_graph_url}/#{post_id}?" <> URI.encode_query(%{
      "fields" => "media_type,like_count,comments_count",
      "access_token" => page_access_token
    })

    case HTTPoison.get(media_url) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
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

            insights_url = "#{@facebook_graph_url}/#{post_id}/insights?" <> URI.encode_query(%{
              "metric" => metrics,
              "access_token" => page_access_token
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

          {:ok, %{"error" => error}} ->
            {:error, error["message"] || "Failed to get media info"}

          {:error, _} ->
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        IO.puts("Instagram insights fetch failed: #{status} - #{body}")
        {:error, extract_error(body, :insights_fetch_failed)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # ============================================================================
  # Publishing Functions
  # ============================================================================

  defp publish_image(access_token, ig_user_id, image_url, caption) do
    # Step 1: Create media container
    container_url = "#{@facebook_graph_url}/#{ig_user_id}/media"
    container_body = URI.encode_query(%{
      "image_url" => image_url,
      "caption" => caption,
      "access_token" => access_token
    })

    case create_media_container(container_url, container_body) do
      {:ok, container_id} ->
        # Step 2: Publish the container
        publish_container(access_token, ig_user_id, container_id, "image")

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp publish_video(access_token, ig_user_id, video_url, caption) do
    # Step 1: Create video container
    container_url = "#{@facebook_graph_url}/#{ig_user_id}/media"
    container_body = URI.encode_query(%{
      "video_url" => video_url,
      "caption" => caption,
      "media_type" => "VIDEO",
      "access_token" => access_token
    })

    case create_media_container(container_url, container_body) do
      {:ok, container_id} ->
        # Step 2: Wait for video processing
        case wait_for_media_ready(access_token, container_id) do
          :ok ->
            publish_container(access_token, ig_user_id, container_id, "video")
          {:error, reason} ->
            {:error, reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp publish_reel(access_token, ig_user_id, video_url, caption) do
    # Step 1: Create reel container
    container_url = "#{@facebook_graph_url}/#{ig_user_id}/media"
    container_body = URI.encode_query(%{
      "video_url" => video_url,
      "caption" => caption,
      "media_type" => "REELS",
      "access_token" => access_token
    })

    case create_media_container(container_url, container_body) do
      {:ok, container_id} ->
        # Step 2: Wait for video processing
        case wait_for_media_ready(access_token, container_id) do
          :ok ->
            publish_container(access_token, ig_user_id, container_id, "reel")
          {:error, reason} ->
            {:error, reason}
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
      url = "#{@facebook_graph_url}/#{container_id}?" <> URI.encode_query(%{
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
              IO.puts("Media processing status: #{status}, waiting...")
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
    url = "#{@facebook_graph_url}/#{ig_user_id}/media_publish"
    body = URI.encode_query(%{
      "creation_id" => container_id,
      "access_token" => access_token
    })
    headers = [{"Content-Type", "application/x-www-form-urlencoded"}]

    case HTTPoison.post(url, body, headers) do
      {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
        case Jason.decode(response_body) do
          {:ok, %{"id" => post_id}} ->
            # Get the permalink for the post
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
    url = "#{@facebook_graph_url}/#{post_id}?" <> URI.encode_query(%{
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
    explicit_type = Map.get(opts, :media_type)
    
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
      {:ok, %{"error" => error}} when is_binary(error) -> error
      _ -> default_error
    end
  end
  defp extract_error(_, default_error), do: default_error
end
