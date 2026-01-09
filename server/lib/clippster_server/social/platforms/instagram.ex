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

  require Logger

  @behaviour ClippsterServer.Social.Platform

  # PulseKit helper for safe event capture
  defp pulse_capture(event) do
    if Code.ensure_loaded?(PulseKit) do
      try do
        PulseKit.capture(event)
      rescue
        _ -> :ok
      end
    end
  end

  # Instagram OAuth endpoints
  @instagram_oauth_url "https://api.instagram.com/oauth/access_token"
  @instagram_graph_url "https://graph.instagram.com"

  # HTTP timeout configuration - Instagram API can be slow
  @http_timeout 30_000  # 30 seconds
  @http_options [timeout: @http_timeout, recv_timeout: @http_timeout]

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
    scope = opts[:scope] || "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights"
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

    case HTTPoison.get(url, [], @http_options) do
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

    case HTTPoison.get(url, [], @http_options) do
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
    Logger.info("[Instagram] publish_media called")
    Logger.info("[Instagram] Media URL: #{media_url}")
    Logger.info("[Instagram] Options: #{inspect(opts)}")

    # Generate a presigned URL if this is an R2 storage URL (private bucket)
    # Instagram needs to be able to download the media, so we create a temporary public URL
    accessible_url = if String.contains?(media_url, ".r2.cloudflarestorage.com") do
      case ClippsterServer.Storage.presigned_url(media_url, expires_in: 7200) do
        {:ok, presigned} ->
          Logger.info("[Instagram] Generated presigned URL for R2 media (expires in 2 hours)")
          presigned
        {:error, reason} ->
          Logger.warning("[Instagram] Failed to generate presigned URL: #{inspect(reason)}, using original URL")
          media_url
      end
    else
      media_url
    end

    # PulseKit: Log publish start
    pulse_capture(%{
      type: "instagram.publish.start",
      level: :info,
      message: "Instagram publish initiated",
      metadata: %{
        media_url: media_url,
        accessible_url: accessible_url,
        media_type: opts[:media_type],
        ig_user_id: opts[:ig_user_id] || opts[:user_id],
        has_caption: !is_nil(opts[:caption]) && opts[:caption] != ""
      },
      tags: %{platform: "instagram", action: "publish_start"}
    })

    # Get the user ID from opts or fetch it
    ig_user_id = opts[:ig_user_id] || opts[:user_id]
    caption = opts[:caption] || ""
    media_type = detect_media_type(accessible_url, opts)

    Logger.info("[Instagram] Detected media_type: #{media_type}, ig_user_id: #{ig_user_id}")

    unless ig_user_id do
      Logger.info("[Instagram] No user ID in opts, fetching from token...")
      # Try to get the user ID from the access token
      case get_user_profile(access_token) do
        {:ok, profile} ->
          Logger.info("[Instagram] Got profile, user_id: #{profile.user_id}")
          do_publish_media(access_token, profile.user_id, accessible_url, caption, media_type)
        {:error, reason} ->
          Logger.error("[Instagram] Cannot get user profile: #{inspect(reason)}")
          pulse_capture(%{
            type: "instagram.publish.error",
            level: :error,
            message: "Cannot determine user ID: #{inspect(reason)}",
            metadata: %{error: inspect(reason), stage: "get_user_profile"},
            tags: %{platform: "instagram", action: "publish_error"}
          })
          {:error, "Cannot determine user ID: #{inspect(reason)}"}
      end
    else
      do_publish_media(access_token, ig_user_id, accessible_url, caption, media_type)
    end
  end

  @impl true
  def get_insights(access_token, post_id) do
    # First, get basic media info
    # Note: like_count and comments_count are available on the media object
    media_url = "#{@instagram_graph_url}/#{post_id}?" <> URI.encode_query(%{
      "fields" => "media_type,like_count,comments_count",
      "access_token" => access_token
    })

    Logger.info("[Instagram] Fetching insights for post #{post_id}")

    case HTTPoison.get(media_url, [], @http_options) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"error" => error}} ->
            Logger.error("[Instagram] Media info error: #{inspect(error)}")
            {:error, error["message"] || "Failed to get media info"}

          {:ok, media_data} ->
            media_type = media_data["media_type"]
            Logger.info("[Instagram] Media type: #{media_type}")

            base_insights = %{
              like_count: media_data["like_count"] || 0,
              comment_count: media_data["comments_count"] || 0,
              view_count: 0,
              save_count: 0,
              reach_count: 0,
              impressions_count: 0
            }

            # Get insights metrics from the insights endpoint
            # As of 2024-2025: 'plays', 'video_views', 'impressions' are DEPRECATED
            # Use 'views' as the new unified consumption metric for all media types
            # 'reach', 'saved' are still available
            metrics = case media_type do
              "VIDEO" -> "views,reach,saved"
              "REELS" -> "views,reach,saved"
              _ -> "reach,saved"
            end

            insights_url = "#{@instagram_graph_url}/#{post_id}/insights?" <> URI.encode_query(%{
              "metric" => metrics,
              "access_token" => access_token
            })

            case HTTPoison.get(insights_url, [], @http_options) do
              {:ok, %HTTPoison.Response{status_code: 200, body: insights_body}} ->
                case Jason.decode(insights_body) do
                  {:ok, %{"data" => metrics_data}} ->
                    Logger.info("[Instagram] Insights data: #{inspect(metrics_data)}")
                    {:ok, parse_insights(metrics_data, base_insights)}
                  {:ok, %{"error" => error}} ->
                    Logger.warning("[Instagram] Insights API error: #{inspect(error)}")
                    {:ok, base_insights}
                  other ->
                    Logger.warning("[Instagram] Unexpected insights response: #{inspect(other)}")
                    {:ok, base_insights}
                end
              {:ok, %HTTPoison.Response{status_code: status, body: error_body}} ->
                Logger.warning("[Instagram] Insights API returned #{status}: #{error_body}")
                {:ok, base_insights}
              {:error, reason} ->
                Logger.warning("[Instagram] Insights API request failed: #{inspect(reason)}")
                {:ok, base_insights}
            end

          {:error, _} ->
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        Logger.error("[Instagram] Insights fetch failed: #{status} - #{body}")
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

    case HTTPoison.post(@instagram_oauth_url, body, headers, @http_options) do
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

    case HTTPoison.get(url, [], @http_options) do
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
    Logger.info("[Instagram] do_publish_media: type=#{media_type}, user_id=#{ig_user_id}")
    Logger.info("[Instagram] Caption: #{String.slice(caption || "", 0, 50)}...")

    pulse_capture(%{
      type: "instagram.publish.dispatch",
      level: :info,
      message: "Dispatching publish for media_type: #{media_type}",
      metadata: %{
        media_type: media_type,
        ig_user_id: ig_user_id,
        media_url: media_url,
        caption_length: String.length(caption || "")
      },
      tags: %{platform: "instagram", action: "dispatch", media_type: media_type}
    })

    result = case media_type do
      "image" ->
        Logger.info("[Instagram] Publishing as IMAGE")
        publish_image(access_token, ig_user_id, media_url, caption)
      "video" ->
        Logger.info("[Instagram] Publishing as VIDEO")
        publish_video(access_token, ig_user_id, media_url, caption)
      "reel" ->
        Logger.info("[Instagram] Publishing as REEL")
        publish_reel(access_token, ig_user_id, media_url, caption)
      _ ->
        Logger.error("[Instagram] Unsupported media type: #{inspect(media_type)}")
        pulse_capture(%{
          type: "instagram.publish.error",
          level: :error,
          message: "Unsupported media type: #{inspect(media_type)}",
          metadata: %{media_type: media_type, ig_user_id: ig_user_id},
          tags: %{platform: "instagram", action: "publish_error"}
        })
        {:error, :unsupported_media_type}
    end

    # Log final result
    case result do
      {:ok, post_data} ->
        pulse_capture(%{
          type: "instagram.publish.success",
          level: :info,
          message: "Successfully published to Instagram",
          metadata: %{
            post_id: post_data.post_id,
            post_url: post_data.post_url,
            media_type: post_data.media_type,
            ig_user_id: ig_user_id
          },
          tags: %{platform: "instagram", action: "publish_success"}
        })
      {:error, reason} ->
        pulse_capture(%{
          type: "instagram.publish.failed",
          level: :error,
          message: "Failed to publish to Instagram: #{inspect(reason)}",
          metadata: %{
            error: inspect(reason),
            media_type: media_type,
            ig_user_id: ig_user_id,
            media_url: media_url
          },
          tags: %{platform: "instagram", action: "publish_failed"}
        })
    end

    result
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
    Logger.info("[Instagram] Creating media container at: #{url}")
    headers = [{"Content-Type", "application/x-www-form-urlencoded"}]

    pulse_capture(%{
      type: "instagram.container.create_start",
      level: :info,
      message: "Creating media container",
      metadata: %{url: url},
      tags: %{platform: "instagram", action: "container_create"}
    })

    case HTTPoison.post(url, body, headers, @http_options) do
      {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
        Logger.info("[Instagram] Container response (200): #{response_body}")
        case Jason.decode(response_body) do
          {:ok, %{"id" => container_id}} ->
            Logger.info("[Instagram] Container created: #{container_id}")
            pulse_capture(%{
              type: "instagram.container.created",
              level: :info,
              message: "Container created successfully",
              metadata: %{container_id: container_id},
              tags: %{platform: "instagram", action: "container_created"}
            })
            {:ok, container_id}
          {:ok, %{"error" => error}} ->
            error_msg = error["message"] || "Container creation failed"
            Logger.error("[Instagram] Container creation error: #{inspect(error)}")
            pulse_capture(%{
              type: "instagram.container.error",
              level: :error,
              message: "Container creation returned error in response",
              metadata: %{error: error, error_message: error_msg, response_body: response_body},
              tags: %{platform: "instagram", action: "container_error"}
            })
            {:error, error_msg}
          _ ->
            Logger.error("[Instagram] Invalid container response: #{response_body}")
            pulse_capture(%{
              type: "instagram.container.error",
              level: :error,
              message: "Invalid container response format",
              metadata: %{response_body: response_body},
              tags: %{platform: "instagram", action: "container_error"}
            })
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} ->
        Logger.error("[Instagram] Container creation failed (#{status}): #{response_body}")
        error = extract_error(response_body, :container_creation_failed)
        pulse_capture(%{
          type: "instagram.container.error",
          level: :error,
          message: "Container creation failed with HTTP #{status}",
          metadata: %{status_code: status, response_body: response_body, error: error},
          tags: %{platform: "instagram", action: "container_error"}
        })
        {:error, error}

      {:error, reason} ->
        Logger.error("[Instagram] HTTP error creating container: #{inspect(reason)}")
        pulse_capture(%{
          type: "instagram.container.error",
          level: :error,
          message: "HTTP error creating container",
          metadata: %{error: inspect(reason)},
          tags: %{platform: "instagram", action: "container_http_error"}
        })
        {:error, reason}
    end
  end

  defp wait_for_media_ready(access_token, container_id, attempts \\ 0) do
    max_attempts = 30  # 5 minutes with 10 second intervals

    if attempts >= max_attempts do
      pulse_capture(%{
        type: "instagram.status.timeout",
        level: :error,
        message: "Media processing timeout after #{max_attempts} attempts",
        metadata: %{container_id: container_id, attempts: attempts, max_attempts: max_attempts},
        tags: %{platform: "instagram", action: "status_timeout"}
      })
      {:error, :media_processing_timeout}
    else
      url = "#{@instagram_graph_url}/#{container_id}?" <> URI.encode_query(%{
        "fields" => "status_code,status",
        "access_token" => access_token
      })

      case HTTPoison.get(url, [], @http_options) do
        {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
          case Jason.decode(body) do
            {:ok, %{"status_code" => "FINISHED"}} ->
              pulse_capture(%{
                type: "instagram.status.ready",
                level: :info,
                message: "Media processing finished",
                metadata: %{container_id: container_id, attempts: attempts},
                tags: %{platform: "instagram", action: "status_ready"}
              })
              :ok
            {:ok, %{"status_code" => "ERROR"} = response} ->
              error_reason = Map.get(response, "status", "Unknown error")
              Logger.error("[Instagram] Media processing failed: #{error_reason}")
              pulse_capture(%{
                type: "instagram.status.error",
                level: :error,
                message: "Media processing failed: #{error_reason}",
                metadata: %{container_id: container_id, attempts: attempts, error_reason: error_reason},
                tags: %{platform: "instagram", action: "status_error"}
              })
              {:error, {:media_processing_failed, error_reason}}
            {:ok, %{"status_code" => status}} ->
              IO.puts("[Instagram] Media processing status: #{status}, waiting...")
              # Log every 5th poll to avoid flooding
              if rem(attempts, 5) == 0 do
                pulse_capture(%{
                  type: "instagram.status.poll",
                  level: :debug,
                  message: "Media processing status: #{status}",
                  metadata: %{container_id: container_id, status: status, attempt: attempts},
                  tags: %{platform: "instagram", action: "status_poll"}
                })
              end
              Process.sleep(10_000)
              wait_for_media_ready(access_token, container_id, attempts + 1)
            _ ->
              pulse_capture(%{
                type: "instagram.status.error",
                level: :error,
                message: "Invalid status response format",
                metadata: %{container_id: container_id, response_body: body},
                tags: %{platform: "instagram", action: "status_error"}
              })
              {:error, :invalid_response}
          end

        {:error, %HTTPoison.Error{reason: :timeout}} ->
          # Timeout during status check - retry instead of failing
          Logger.warning("[Instagram] Status check timed out, retrying... (attempt #{attempts + 1})")
          Process.sleep(5_000)
          wait_for_media_ready(access_token, container_id, attempts + 1)

        {:error, reason} ->
          pulse_capture(%{
            type: "instagram.status.error",
            level: :error,
            message: "HTTP error checking media status",
            metadata: %{container_id: container_id, error: inspect(reason)},
            tags: %{platform: "instagram", action: "status_http_error"}
          })
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

    pulse_capture(%{
      type: "instagram.container.publish_start",
      level: :info,
      message: "Publishing container to Instagram",
      metadata: %{container_id: container_id, ig_user_id: ig_user_id, media_type: media_type},
      tags: %{platform: "instagram", action: "container_publish"}
    })

    case HTTPoison.post(url, body, headers, @http_options) do
      {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
        case Jason.decode(response_body) do
          {:ok, %{"id" => post_id}} ->
            permalink = get_post_permalink(access_token, post_id)
            pulse_capture(%{
              type: "instagram.container.published",
              level: :info,
              message: "Container published successfully",
              metadata: %{
                container_id: container_id,
                post_id: post_id,
                permalink: permalink,
                media_type: media_type
              },
              tags: %{platform: "instagram", action: "container_published"}
            })
            {:ok, %{
              post_id: post_id,
              post_url: permalink || "https://www.instagram.com/",
              media_type: media_type
            }}
          {:ok, %{"error" => error}} ->
            error_msg = error["message"] || "Publish failed"
            pulse_capture(%{
              type: "instagram.container.publish_error",
              level: :error,
              message: "Container publish returned error in response",
              metadata: %{container_id: container_id, error: error, error_message: error_msg},
              tags: %{platform: "instagram", action: "container_publish_error"}
            })
            {:error, error_msg}
          _ ->
            pulse_capture(%{
              type: "instagram.container.publish_error",
              level: :error,
              message: "Invalid publish response format",
              metadata: %{container_id: container_id, response_body: response_body},
              tags: %{platform: "instagram", action: "container_publish_error"}
            })
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} ->
        error = extract_error(response_body, :publish_failed)
        pulse_capture(%{
          type: "instagram.container.publish_error",
          level: :error,
          message: "Container publish failed with HTTP #{status}",
          metadata: %{container_id: container_id, status_code: status, response_body: response_body, error: error},
          tags: %{platform: "instagram", action: "container_publish_error"}
        })
        {:error, error}

      {:error, reason} ->
        pulse_capture(%{
          type: "instagram.container.publish_error",
          level: :error,
          message: "HTTP error publishing container",
          metadata: %{container_id: container_id, error: inspect(reason)},
          tags: %{platform: "instagram", action: "container_publish_http_error"}
        })
        {:error, reason}
    end
  end

  defp get_post_permalink(access_token, post_id) do
    url = "#{@instagram_graph_url}/#{post_id}?" <> URI.encode_query(%{
      "fields" => "permalink",
      "access_token" => access_token
    })

    case HTTPoison.get(url, [], @http_options) do
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
        # Current metrics (2024-2025)
        "views" -> %{acc | view_count: value}
        "reach" -> %{acc | reach_count: value}
        "saved" -> %{acc | save_count: value}
        # Legacy metrics (deprecated but kept for backwards compatibility)
        "impressions" -> %{acc | impressions_count: value}
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
