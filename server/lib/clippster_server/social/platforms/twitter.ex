defmodule ClippsterServer.Social.Platforms.Twitter do
  @moduledoc """
  Twitter/X platform integration using twitterapi.io for read-only analytics.
  This is a third-party API that provides tweet data without requiring OAuth.
  """

  require Logger

  @base_url "https://api.twitterapi.io"

  @doc """
  Fetches analytics for a tweet by its ID.
  Returns view count, like count, reply count, and author metadata.
  """
  def get_tweet_analytics(tweet_id) when is_binary(tweet_id) do
    api_key = get_api_key()

    if is_nil(api_key) do
      Logger.warning("[Twitter] API key not configured")
      {:error, :api_key_not_configured}
    else
      url = "#{@base_url}/twitter/tweets?tweet_ids=#{tweet_id}"

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

  # Private functions

  defp get_api_key do
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
