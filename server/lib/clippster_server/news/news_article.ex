defmodule ClippsterServer.News.NewsArticle do
  @moduledoc """
  Schema for news articles fetched from TheNewsAPI.
  """
  use Ecto.Schema
  import Ecto.Changeset

  schema "news_articles" do
    field :uuid, :string
    field :title, :string
    field :description, :string
    field :snippet, :string
    field :url, :string
    field :image_url, :string
    field :published_at, :utc_datetime
    field :source, :string
    field :categories, {:array, :string}
    field :locale, :string
    field :relevance_score, :float
    field :is_featured, :boolean, default: false

    timestamps()
  end

  @doc false
  def changeset(news_article, attrs) do
    news_article
    |> cast(attrs, [
      :uuid,
      :title,
      :description,
      :snippet,
      :url,
      :image_url,
      :published_at,
      :source,
      :categories,
      :locale,
      :relevance_score,
      :is_featured
    ])
    |> validate_required([:uuid, :title, :url, :published_at])
    |> unique_constraint(:uuid)
  end
end
