defmodule ClippsterServer.Repo.Migrations.AlterPostSubmissionsUrlsToText do
  use Ecto.Migration

  def change do
    alter table(:post_submissions) do
      modify :media_url, :text, from: :string
      modify :thumbnail_url, :text, from: :string
    end
  end
end
