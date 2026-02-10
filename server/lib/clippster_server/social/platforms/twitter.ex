defmodule ClippsterServer.Social.Platforms.Twitter do
  @moduledoc """
  X (Twitter) API integration with OAuth 2.0 PKCE authentication.

  Handles:
  - OAuth 2.0 PKCE token exchange (X Official API for posting)
  - User profile retrieval
  - Token refresh (single-use refresh tokens)
  - Content publishing (stub for Phase 2)
  - Insights/analytics (stub for Phase 3)
  - Read-only tweet analytics via twitterapi.io (preserved for existing analytics system)

  OAuth Documentation: https://developer.x.com/en/docs/authentication/oauth-2-0/authorization-code
  """

  require Logger

  @behaviour ClippsterServer.Social.Platform

  # X OAuth 2.0 endpoints
  @x_authorize_url "https://x.com/i/oauth2/authorize"
  @x_token_url "https://api.x.com/2/oauth2/token"
  @x_users_me_url "https://api.x.com/2/users/me"

  # HTTP timeout configuration - X API can be slow
  @http_timeout 30_000  # 30 seconds
  @http_options [timeout: @http_timeout, recv_timeout: @http_timeout]

  # ============================================================================
  # Platform Callbacks
  # ============================================================================

  @impl true
  def platform_id, do: "twitter"

  @impl true
  def platform_name, do: "X (Twitter)"

  @impl true
  def authorize_url(opts) do
    # Generate PKCE pair
    %{code_verifier: code_verifier, code_challenge: code_challenge} = generate_pkce_pair()

    # Build authorization URL with PKCE
    client_id = opts[:client_id] || raise "client_id required"
    redirect_uri = opts[:redirect_uri] || raise "redirect_uri required"
    scope = opts[:scope] || "tweet.read tweet.write users.read offline.access"
    state = opts[:state] || %{}

    # Merge code_verifier into state for later retrieval
    state_with_verifier = Map.put(state, :code_verifier, code_verifier)
    encoded_state = state_with_verifier |> Jason.encode!() |> Base.url_encode64(padding: false)

    params = %{
      "response_type" => "code",
      "client_id" => client_id,
      "redirect_uri" => redirect_uri,
      "scope" => scope,
      "state" => encoded_state,
      "code_challenge" => code_challenge,
      "code_challenge_method" => "S256"
    }

    @x_authorize_url <> "?" <> URI.encode_query(params)
  end

  @impl true
  def exchange_code(code, opts) do
    client_id = opts[:client_id] || raise "client_id required"
    client_secret = opts[:client_secret] || raise "client_secret required"
    redirect_uri = opts[:redirect_uri] || raise "redirect_uri required"
    code_verifier = opts[:code_verifier] || raise "code_verifier required"

    # Build request body
    body = URI.encode_query(%{
      "code" => code,
      "grant_type" => "authorization_code",
      "client_id" => client_id,
      "redirect_uri" => redirect_uri,
      "code_verifier" => code_verifier
    })

    # Build Basic Auth header
    auth_string = "#{client_id}:#{client_secret}"
    auth_header = "Basic #{Base.encode64(auth_string)}"

    headers = [
      {"Content-Type", "application/x-www-form-urlencoded"},
      {"Authorization", auth_header}
    ]

    case HTTPoison.post(@x_token_url, body, headers, @http_options) do
      {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
        case Jason.decode(response_body) do
          {:ok, %{"access_token" => access_token} = data} ->
            {:ok, %{
              access_token: access_token,
              refresh_token: data["refresh_token"],
              expires_in: data["expires_in"] || 7200
            }}

          {:ok, %{"error" => error}} ->
            {:error, error}

          _ ->
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: response_body}} ->
        IO.puts("[Twitter] Code exchange failed: #{status} - #{response_body}")
        {:error, extract_error(response_body, :code_exchange_failed)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def refresh_tokens(refresh_token) do
    # Read OAuth config from application environment
    oauth_config = Application.get_env(:clippster_server, :twitter_oauth, [])
    client_id = oauth_config[:client_id]
    client_secret = oauth_config[:client_secret]

    unless client_id && client_secret do
      {:error, :oauth_not_configured}
    else
      # Build request body
      body = URI.encode_query(%{
        "refresh_token" => refresh_token,
        "grant_type" => "refresh_token",
        "client_id" => client_id
      })

      # Build Basic Auth header
      auth_string = "#{client_id}:#{client_secret}"
      auth_header = "Basic #{Base.encode64(auth_string)}"

      headers = [
        {"Content-Type", "application/x-www-form-urlencoded"},
        {"Authorization", auth_header}
      ]

      case HTTPoison.post(@x_token_url, body, headers, @http_options) do
        {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
          case Jason.decode(response_body) do
            {:ok, %{"access_token" => access_token} = data} ->
              # CRITICAL: X uses single-use refresh tokens, must return new refresh_token
              {:ok, %{
                access_token: access_token,
                refresh_token: data["refresh_token"],
                expires_in: data["expires_in"] || 7200
              }}

            {:ok, %{"error" => _error}} ->
              {:error, :refresh_failed}

            _ ->
              {:error, :invalid_response}
          end

        {:ok, %HTTPoison.Response{status_code: 401}} ->
          # Refresh token expired or revoked - user must re-authenticate
          {:error, :refresh_token_expired}

        {:ok, %HTTPoison.Response{status_code: _status, body: _response_body}} ->
          {:error, :refresh_failed}

        {:error, _reason} ->
          {:error, :refresh_failed}
      end
    end
  end

  @impl true
  def get_user_profile(access_token) do
    url = "#{@x_users_me_url}?user.fields=profile_image_url,name,username"

    headers = [
      {"Authorization", "Bearer #{access_token}"}
    ]

    case HTTPoison.get(url, headers, @http_options) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, %{"data" => user_data}} ->
            {:ok, %{
              user_id: user_data["id"],
              username: user_data["username"],
              display_name: user_data["name"],
              profile_image_url: user_data["profile_image_url"]
            }}

          {:ok, %{"errors" => errors}} ->
            error_message = extract_error_from_errors(errors)
            {:error, error_message}

          _ ->
            {:error, :invalid_response}
        end

      {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
        IO.puts("[Twitter] Profile fetch failed: #{status} - #{body}")
        {:error, extract_error(body, :profile_fetch_failed)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def publish_media(_access_token, _media_url, _opts) do
    # Stub implementation - Phase 2 will implement this
    {:error, :not_implemented}
  end

  @impl true
  def get_insights(_access_token, _post_id) do
    # Stub implementation - Phase 3 will implement this
    {:error, :not_implemented}
  end

  # ============================================================================
  # PKCE Helper Functions
  # ============================================================================

  defp generate_pkce_pair do
    # Generate cryptographically secure random code_verifier
    code_verifier = :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)

    # Generate code_challenge using SHA256 hash of code_verifier
    code_challenge = :crypto.hash(:sha256, code_verifier) |> Base.url_encode64(padding: false)

    %{
      code_verifier: code_verifier,
      code_challenge: code_challenge
    }
  end

  # ============================================================================
  # Error Handling
  # ============================================================================

  defp extract_error(body, default_error) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, %{"error" => %{"message" => message}}} -> message
      {:ok, %{"error_description" => message}} -> message
      {:ok, %{"error" => error}} when is_binary(error) -> error
      _ -> default_error
    end
  end
  defp extract_error(_, default_error), do: default_error

  defp extract_error_from_errors(errors) when is_list(errors) do
    case List.first(errors) do
      %{"message" => message} -> message
      %{"detail" => detail} -> detail
      _ -> "Profile fetch failed"
    end
  end
  defp extract_error_from_errors(_), do: "Profile fetch failed"

  # ============================================================================
  # Analytics Functions (twitterapi.io - preserved from original implementation)
  # ============================================================================

  @analytics_base_url "https://api.twitterapi.io"

  @doc """
  Fetches analytics for a tweet by its ID using twitterapi.io.
  Returns view count, like count, reply count, and author metadata.

  This function uses the read-only twitterapi.io API and is separate from
  the OAuth 2.0 implementation above. It's preserved for the existing analytics system.
  """
  def get_tweet_analytics(tweet_id) when is_binary(tweet_id) do
    api_key = get_analytics_api_key()

    if is_nil(api_key) do
      Logger.warning("[Twitter] Analytics API key not configured")
      {:error, :api_key_not_configured}
    else
      url = "#{@analytics_base_url}/twitter/tweets?tweet_ids=#{tweet_id}"

      headers = [
        {"X-API-Key", api_key},
        {"Content-Type", "application/json"}
      ]

      Logger.debug("[Twitter] Fetching tweet #{tweet_id}")

      case HTTPoison.get(url, headers, recv_timeout: 15_000) do
        {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
          case Jason.decode(body) do
            {:ok, %{"tweets" => [tweet | _]}} ->
              analytics = extract_analytics(tweet)
              {:ok, analytics}

            {:ok, %{"tweets" => []}} ->
              Logger.warning("[Twitter] Tweet not found: #{tweet_id}")
              {:error, :tweet_not_found}

            {:ok, other} ->
              Logger.warning("[Twitter] Unexpected response format: #{inspect(other)}")
              {:error, :unexpected_response}

            {:error, decode_error} ->
              Logger.error("[Twitter] Failed to decode response: #{inspect(decode_error)}")
              {:error, :decode_error}
          end

        {:ok, %HTTPoison.Response{status_code: 401}} ->
          Logger.error("[Twitter] Unauthorized - check API key")
          {:error, :unauthorized}

        {:ok, %HTTPoison.Response{status_code: 429}} ->
          Logger.warning("[Twitter] Rate limited")
          {:error, :rate_limited}

        {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
          Logger.error("[Twitter] API error #{status}: #{body}")
          {:error, {:api_error, status}}

        {:error, %HTTPoison.Error{reason: reason}} ->
          Logger.error("[Twitter] HTTP error: #{inspect(reason)}")
          {:error, {:http_error, reason}}
      end
    end
  end

  @doc """
  Extracts tweet ID from various Twitter/X URL formats.
  Supports:
  - https://twitter.com/user/status/123456789
  - https://x.com/user/status/123456789
  - https://twitter.com/user/status/123456789?s=20
  """
  def extract_tweet_id(url) when is_binary(url) do
    # Match patterns like /status/123456789 or /statuses/123456789
    case Regex.run(~r{/status(?:es)?/(\d+)}, url) do
      [_, tweet_id] -> {:ok, tweet_id}
      nil -> {:error, :invalid_url}
    end
  end

  def extract_tweet_id(_), do: {:error, :invalid_url}

  @doc """
  Checks if a URL is a Twitter/X URL.
  """
  def is_twitter_url?(url) when is_binary(url) do
    String.contains?(url, "twitter.com") or String.contains?(url, "x.com")
  end

  def is_twitter_url?(_), do: false

  # Private functions for analytics

  defp get_analytics_api_key do
    Application.get_env(:clippster_server, :twitter)[:api_key]
  end

  defp extract_analytics(tweet) do
    author = tweet["author"] || %{}

    %{
      view_count: tweet["viewCount"] || 0,
      like_count: tweet["likeCount"] || 0,
      comment_count: tweet["replyCount"] || 0,
      retweet_count: tweet["retweetCount"] || 0,
      quote_count: tweet["quoteCount"] || 0,
      tweet_id: tweet["id"],
      tweet_url: tweet["url"],
      text: tweet["text"],
      created_at: tweet["createdAt"],
      # Author metadata
      author_username: author["userName"],
      author_name: author["name"],
      author_profile_image: author["profilePicture"]
    }
  end
end
