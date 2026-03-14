defmodule ClippsterServerWeb.NewsJSON do
  @moduledoc """
  JSON views for NewsController.
  """

  alias ClippsterServer.News.NewsArticle

  @doc """
  Renders a list of news articles.
  """
  def index(%{articles: articles}) do
    %{data: for(article <- articles, do: data(article))}
  end

  @doc """
  Renders a single news article.
  """
  def show(%{article: article}) do
    %{data: data(article)}
  end

  defp data(%NewsArticle{} = article) do
    %{
      id: article.id,
      uuid: article.uuid,
      title: article.title,
      description: article.description,
      snippet: article.snippet,
      url: article.url,
      image_url: article.image_url,
      published_at: article.published_at,
      source: article.source,
      categories: article.categories,
      locale: article.locale,
      relevance_score: article.relevance_score,
      is_featured: article.is_featured,
      inserted_at: article.inserted_at,
      updated_at: article.updated_at
    }
  end
end
