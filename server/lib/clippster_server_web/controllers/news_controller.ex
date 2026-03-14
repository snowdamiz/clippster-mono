defmodule ClippsterServerWeb.NewsController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.News
  alias ClippsterServer.News.NewsPoller

  require Logger

  @doc """
  GET /api/news
  
  Returns recent breaking news articles.
  
  Query params:
    - limit: Number of articles (default: 20, max: 100)
    - featured_only: true/false (default: false)
    - categories: Comma-separated list (e.g., "tech,sports")
  """
  def index(conn, params) do
    limit = parse_limit(params["limit"])
    featured_only = params["featured_only"] == "true"
    categories = parse_categories(params["categories"])

    articles =
      News.list_news_articles(
        limit: limit,
        featured_only: featured_only,
        categories: categories
      )

    render(conn, :index, articles: articles)
  end

  @doc """
  GET /api/news/:uuid
  
  Returns a single news article by UUID.
  """
  def show(conn, %{"uuid" => uuid}) do
    case News.get_news_article(uuid) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Article not found"})

      article ->
        render(conn, :show, article: article)
    end
  end

  @doc """
  POST /api/news/search
  
  Searches for news articles by keyword.
  
  Body params:
    - query: Search query (required)
    - limit: Number of articles (default: 10)
    - store: Whether to store results (default: false)
  """
  def search(conn, %{"query" => query} = params) do
    limit = parse_limit(params["limit"])
    store = params["store"] == "true"

    case News.search_and_store_news(query, limit: limit, store: store) do
      {:ok, articles, _stored_count} ->
        render(conn, :index, articles: articles)

      {:error, :api_key_not_configured} ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{error: "News API not configured"})

      {:error, reason} ->
        Logger.error("News search failed: #{inspect(reason)}")

        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "Failed to search news"})
    end
  end

  def search(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "Query parameter is required"})
  end

  @doc """
  POST /api/news/fetch
  
  Manually triggers a news fetch (admin only).
  """
  def fetch(conn, _params) do
    # Note: In production, you'd want to add admin authentication here
    NewsPoller.fetch_now()

    conn
    |> put_status(:accepted)
    |> json(%{message: "News fetch triggered"})
  end

  @doc """
  GET /api/news/ai-context
  
  Returns formatted news for AI context enrichment.
  """
  def ai_context(conn, params) do
    limit = parse_limit(params["limit"], 10)

    articles = News.list_news_articles(limit: limit)
    formatted_context = News.format_for_ai_context(articles)

    json(conn, %{
      context: formatted_context,
      article_count: length(articles)
    })
  end

  @doc """
  PATCH /admin/news/:uuid
  
  Updates a news article (admin only).
  """
  def update(conn, %{"uuid" => uuid} = params) do
    case News.get_news_article(uuid) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Article not found"})

      article ->
        update_attrs = %{}
        update_attrs = if Map.has_key?(params, "is_featured"), do: Map.put(update_attrs, :is_featured, params["is_featured"]), else: update_attrs
        update_attrs = if Map.has_key?(params, "relevance_score"), do: Map.put(update_attrs, :relevance_score, params["relevance_score"]), else: update_attrs

        case News.update_news_article(article, update_attrs) do
          {:ok, updated_article} ->
            render(conn, :show, article: updated_article)

          {:error, changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{error: "Failed to update article", details: changeset})
        end
    end
  end

  @doc """
  DELETE /admin/news/:uuid
  
  Deletes a news article (admin only).
  """
  def delete(conn, %{"uuid" => uuid}) do
    case News.get_news_article(uuid) do
      nil ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Article not found"})

      article ->
        case News.delete_news_article(article) do
          {:ok, _deleted_article} ->
            json(conn, %{message: "Article deleted successfully"})

          {:error, changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{error: "Failed to delete article", details: changeset})
        end
    end
  end

  # Private functions

  defp parse_limit(nil), do: 20
  defp parse_limit(limit_str) when is_binary(limit_str) do
    case Integer.parse(limit_str) do
      {limit, _} when limit > 0 and limit <= 100 -> limit
      {limit, _} when limit > 100 -> 100
      _ -> 20
    end
  end
  defp parse_limit(_), do: 20

  defp parse_limit(nil, default), do: default
  defp parse_limit(limit_str, default) when is_binary(limit_str) do
    case Integer.parse(limit_str) do
      {limit, _} when limit > 0 and limit <= 100 -> limit
      {limit, _} when limit > 100 -> 100
      _ -> default
    end
  end
  defp parse_limit(_, default), do: default

  defp parse_categories(nil), do: nil
  defp parse_categories(categories_str) when is_binary(categories_str) do
    categories_str
    |> String.split(",")
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end
  defp parse_categories(_), do: nil
end
