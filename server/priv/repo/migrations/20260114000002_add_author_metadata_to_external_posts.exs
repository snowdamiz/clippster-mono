defmodule ClippsterServer.Repo.Migrations.AddAuthorMetadataToExternalPosts do
  use Ecto.Migration

  def change do
    alter table(:external_post_submissions) do
      # Author metadata from platform API
      add :author_username, :string
      add :author_name, :string
      add :author_profile_image, :string
    end
  end
end
