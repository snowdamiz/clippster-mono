defmodule ClippsterServer.Repo.Migrations.AddPublicProfileFieldsToOrganizations do
  use Ecto.Migration

  def change do
    alter table(:organizations) do
      add :bio, :text
      add :website_url, :string
      add :public_contact_email, :string
      add :content_type_tags, {:array, :string}, default: []
    end
  end
end
