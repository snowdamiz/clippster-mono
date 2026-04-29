defmodule ClippsterServer.News.TheNewsAPIClient do
  @moduledoc """
  Client for TheNewsAPI - fetches breaking news articles for AI context.

  API Documentation: https://www.thenewsapi.com/documentation
  """

  require Logger

  @base_url "https://api.thenewsapi.com/v1"
  @default_timeout 30_000

  @doc """
  Fetches breaking news from the last 6 hours.

  Returns articles sorted by published_at (newest first).

  ## Options
    * `:limit` - Number of articles to fetch (default: 10, max: 100)
    * `:categories` - Comma-separated categories (e.g., "general,tech,sports")
    * `:language` - Language code (default: "en")
  """
  def fetch_breaking_news(opts \\ []) do
    api_key = get_api_key()

    if is_nil(api_key) or api_key == "" do
      {:error, :api_key_not_configured}
    else
      limit = Keyword.get(opts, :limit, 10)
      categories = Keyword.get(opts, :categories, "general,tech,sports,business,entertainment")
      language = Keyword.get(opts, :language, "en")

      # Calculate timestamp for 6 hours ago
      # TheNewsAPI expects format: YYYY-MM-DDTHH:MM:SS (no timezone suffix)
      six_hours_ago =
        DateTime.utc_now()
        |> DateTime.add(-6, :hour)
        |> DateTime.truncate(:second)
        |> DateTime.to_iso8601()
        |> String.replace("Z", "")

      params = %{
        "api_token" => api_key,
        "language" => language,
        "categories" => categories,
        "published_after" => six_hours_ago,
        "limit" => limit,
        "sort" => "published_at"
      }

      url = "#{@base_url}/news/all"

      case make_request(url, params) do
        {:ok, %{"data" => articles}} when is_list(articles) ->
          {:ok, parse_articles(articles)}

        {:ok, response} ->
          Logger.warning("Unexpected TheNewsAPI response format: #{inspect(response)}")
          {:error, :unexpected_response_format}

        {:error, reason} = error ->
          Logger.error("TheNewsAPI request failed: #{inspect(reason)}")
          error
      end
    end
  end

  @doc """
  Searches for news articles by keyword.

  ## Options
    * `:limit` - Number of articles to fetch (default: 10, max: 100)
    * `:language` - Language code (default: "en")
    * `:published_after` - ISO8601 timestamp
  """
  def search_news(query, opts \\ []) do
    api_key = get_api_key()

    if is_nil(api_key) or api_key == "" do
      {:error, :api_key_not_configured}
    else
      limit = Keyword.get(opts, :limit, 10)
      language = Keyword.get(opts, :language, "en")
      published_after = Keyword.get(opts, :published_after)

      params =
        %{
          "api_token" => api_key,
          "language" => language,
          "search" => query,
          "limit" => limit,
          "sort" => "published_at"
        }
        |> maybe_add_published_after(published_after)

      url = "#{@base_url}/news/all"

      case make_request(url, params) do
        {:ok, %{"data" => articles}} when is_list(articles) ->
          {:ok, parse_articles(articles)}

        {:ok, response} ->
          Logger.warning("Unexpected TheNewsAPI response format: #{inspect(response)}")
          {:error, :unexpected_response_format}

        {:error, reason} = error ->
          Logger.error("TheNewsAPI search failed: #{inspect(reason)}")
          error
      end
    end
  end

  # Private functions

  defp get_api_key do
    Application.get_env(:clippster_server, :thenewsapi)[:api_key]
  end

  defp make_request(url, params) do
    headers = [{"Accept", "application/json"}]
    query_string = URI.encode_query(params)
    full_url = "#{url}?#{query_string}"

    case HTTPoison.get(full_url, headers,
           timeout: @default_timeout,
           recv_timeout: @default_timeout
         ) do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          {:ok, data} -> {:ok, data}
          {:error, reason} -> {:error, {:json_decode_error, reason}}
        end

      {:ok, %HTTPoison.Response{status_code: status_code, body: body}} ->
        Logger.error("TheNewsAPI returned status #{status_code}: #{body}")
        {:error, {:http_error, status_code, body}}

      {:error, %HTTPoison.Error{reason: reason}} ->
        {:error, {:request_failed, reason}}
    end
  end

  defp parse_articles(articles) do
    Enum.map(articles, fn article ->
      %{
        uuid: article["uuid"],
        title: article["title"],
        description: article["description"],
        snippet: article["snippet"],
        url: article["url"],
        image_url: article["image_url"],
        published_at: parse_datetime(article["published_at"]),
        source: article["source"],
        categories: article["categories"] || [],
        locale: article["locale"],
        relevance_score: parse_relevance_score(article["relevance_score"])
      }
    end)
  end

  defp parse_relevance_score(nil), do: nil
  defp parse_relevance_score(score) when is_number(score), do: score * 1.0

  defp parse_relevance_score(score) when is_binary(score) do
    case Float.parse(score) do
      {value, _} -> value
      _ -> nil
    end
  end

  defp parse_relevance_score(_), do: nil

  defp parse_datetime(nil), do: nil

  defp parse_datetime(datetime_string) when is_binary(datetime_string) do
    case DateTime.from_iso8601(datetime_string) do
      {:ok, datetime, _offset} -> datetime
      {:error, _} -> nil
    end
  end

  defp parse_datetime(_), do: nil

  defp maybe_add_published_after(params, nil), do: params

  defp maybe_add_published_after(params, published_after) do
    Map.put(params, "published_after", published_after)
  end
end
