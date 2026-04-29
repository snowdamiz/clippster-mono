defmodule ClippsterServer.News do
  @moduledoc """
  The News context - manages news articles for AI context enrichment.
  """

  import Ecto.Query, warn: false
  alias ClippsterServer.Repo
  alias ClippsterServer.News.{NewsArticle, TheNewsAPIClient}

  require Logger

  @doc """
  Returns the list of recent news articles.

  ## Options
    * `:limit` - Number of articles to return (default: 20)
    * `:featured_only` - Only return featured articles (default: false)
    * `:categories` - Filter by categories (list of strings)
  """
  def list_news_articles(opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)
    featured_only = Keyword.get(opts, :featured_only, false)
    categories = Keyword.get(opts, :categories)
    keywords = Keyword.get(opts, :keywords, [])

    NewsArticle
    |> maybe_filter_featured(featured_only)
    |> maybe_filter_categories(categories)
    |> order_by([a], desc: a.published_at)
    |> limit(50)
    |> Repo.all()
    |> rank_articles(keywords, categories)
    |> Enum.take(limit)
  end

  @doc """
  Gets a single news article by UUID.
  """
  def get_news_article(uuid) do
    Repo.get_by(NewsArticle, uuid: uuid)
  end

  @doc """
  Creates a news article.
  """
  def create_news_article(attrs \\ %{}) do
    %NewsArticle{}
    |> NewsArticle.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a news article.
  """
  def update_news_article(%NewsArticle{} = news_article, attrs) do
    news_article
    |> NewsArticle.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a news article.
  """
  def delete_news_article(%NewsArticle{} = news_article) do
    Repo.delete(news_article)
  end

  @doc """
  Deletes news articles older than the specified number of hours.
  Returns the number of deleted articles.
  """
  def delete_old_articles(hours_ago \\ 24) do
    cutoff_time =
      DateTime.utc_now()
      |> DateTime.add(-hours_ago, :hour)

    {count, _} =
      from(a in NewsArticle, where: a.published_at < ^cutoff_time)
      |> Repo.delete_all()

    count
  end

  @doc """
  Fetches and stores breaking news from TheNewsAPI.

  Returns {:ok, count} where count is the number of new articles stored.
  """
  def fetch_and_store_breaking_news(opts \\ []) do
    case TheNewsAPIClient.fetch_breaking_news(opts) do
      {:ok, articles} ->
        stored_count =
          Enum.reduce(articles, 0, fn article_data, acc ->
            case upsert_article(article_data) do
              {:ok, _article} -> acc + 1
              {:error, _changeset} -> acc
            end
          end)

        Logger.info("Fetched and stored #{stored_count} news articles")
        {:ok, stored_count}

      {:error, :api_key_not_configured} ->
        Logger.warning("TheNewsAPI key not configured, skipping news fetch")
        {:error, :api_key_not_configured}

      {:error, reason} ->
        Logger.error("Failed to fetch breaking news: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  Searches for news articles and optionally stores them.
  """
  def search_and_store_news(query, opts \\ []) do
    store = Keyword.get(opts, :store, true)

    case TheNewsAPIClient.search_news(query, opts) do
      {:ok, articles} ->
        if store do
          stored_count =
            Enum.reduce(articles, 0, fn article_data, acc ->
              case upsert_article(article_data) do
                {:ok, _article} -> acc + 1
                {:error, _changeset} -> acc
              end
            end)

          Logger.info("Searched and stored #{stored_count} articles for query: #{query}")
          {:ok, articles, stored_count}
        else
          {:ok, articles, 0}
        end

      {:error, reason} ->
        Logger.error("Failed to search news for '#{query}': #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  Gets recent news context for AI enrichment.
  Returns formatted news string ready to inject into AI prompts.
  """
  def get_ai_context(limit \\ 10, opts \\ []) do
    articles = list_news_articles(Keyword.merge(opts, limit: limit))
    format_for_ai_context(articles)
  end

  @doc """
  Formats news articles for AI context.
  Returns a formatted string suitable for inclusion in AI prompts.
  """
  def format_for_ai_context(articles) when is_list(articles) do
    if Enum.empty?(articles) do
      "No recent breaking news available."
    else
      formatted_articles =
        articles
        |> Enum.take(10)
        |> Enum.map_join("\n\n", fn article ->
          score = article.relevance_score || fallback_relevance_score(article, [])

          """
          **#{article.title}**
          Source: #{article.source || "Unknown"}
          Published: #{format_datetime(article.published_at)}
          Relevance: #{Float.round(score, 2)}
          #{if article.description, do: article.description, else: article.snippet || ""}
          Categories: #{Enum.join(article.categories, ", ")}
          """
          |> String.trim()
        end)

      """
      ## Recent Breaking News (Last 6 Hours)

      #{formatted_articles}
      """
    end
  end

  # Private functions

  defp upsert_article(article_data) do
    case get_news_article(article_data.uuid) do
      nil ->
        create_news_article(article_data)

      existing_article ->
        update_news_article(existing_article, article_data)
    end
  end

  defp maybe_filter_featured(query, false), do: query

  defp maybe_filter_featured(query, true) do
    where(query, [a], a.is_featured == true)
  end

  defp maybe_filter_categories(query, nil), do: query

  defp maybe_filter_categories(query, categories) when is_list(categories) do
    where(query, [a], fragment("? && ?", a.categories, ^categories))
  end

  defp rank_articles(articles, keywords, categories) do
    articles
    |> Enum.map(fn article -> {article, article_rank(article, keywords, categories)} end)
    |> Enum.sort_by(fn {_article, score} -> -score end)
    |> Enum.map(fn {article, score} ->
      %{article | relevance_score: article.relevance_score || score}
    end)
  end

  defp article_rank(article, keywords, categories) do
    fallback_relevance_score(article, keywords) +
      featured_boost(article) +
      recency_score(article.published_at) +
      category_score(article.categories || [], categories)
  end

  defp fallback_relevance_score(article, keywords) do
    base = article.relevance_score || 0.0

    text =
      [article.title, article.description, article.snippet, article.source]
      |> Enum.filter(&is_binary/1)
      |> Enum.join(" ")
      |> String.downcase()

    keyword_score =
      keywords
      |> List.wrap()
      |> Enum.filter(&is_binary/1)
      |> Enum.uniq()
      |> Enum.count(fn keyword -> String.contains?(text, String.downcase(keyword)) end)
      |> Kernel.*(0.18)

    base + keyword_score
  end

  defp featured_boost(%{is_featured: true}), do: 0.75
  defp featured_boost(_), do: 0.0

  defp recency_score(nil), do: 0.0

  defp recency_score(%DateTime{} = published_at) do
    hours_old = DateTime.diff(DateTime.utc_now(), published_at, :hour)

    cond do
      hours_old <= 2 -> 0.7
      hours_old <= 6 -> 0.45
      hours_old <= 12 -> 0.25
      true -> 0.0
    end
  end

  defp category_score(_article_categories, nil), do: 0.0

  defp category_score(article_categories, categories) when is_list(categories) do
    if Enum.any?(article_categories, &(&1 in categories)), do: 0.35, else: 0.0
  end

  defp format_datetime(nil), do: "Unknown"

  defp format_datetime(%DateTime{} = dt) do
    Calendar.strftime(dt, "%B %d, %Y at %I:%M %p UTC")
  end
end
