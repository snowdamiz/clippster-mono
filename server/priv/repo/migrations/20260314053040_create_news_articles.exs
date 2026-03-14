defmodule ClippsterServer.Repo.Migrations.CreateNewsArticles do
  use Ecto.Migration

  def change do
    create table(:news_articles) do
      add :uuid, :string, null: false
      add :title, :text, null: false
      add :description, :text
      add :snippet, :text
      add :url, :text, null: false
      add :image_url, :text
      add :published_at, :utc_datetime, null: false
      add :source, :string
      add :categories, {:array, :string}, default: []
      add :locale, :string
      add :relevance_score, :float
      add :is_featured, :boolean, default: false

      timestamps()
    end

    create unique_index(:news_articles, [:uuid])
    create index(:news_articles, [:published_at])
    create index(:news_articles, [:is_featured])
    create index(:news_articles, [:categories], using: :gin)
  end
end
