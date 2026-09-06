defmodule ClippsterServer.Repo.Migrations.AddPublicProfileEnabledToOrganizations do
  use Ecto.Migration

  def change do
    alter table(:organizations) do
      add :public_profile_enabled, :boolean, default: false, null: false
    end

    create index(:organizations, [:public_profile_enabled])

    # Opt in orgs that already look intentionally public (bio or description + slug).
    execute("""
    UPDATE organizations
    SET public_profile_enabled = true
    WHERE slug IS NOT NULL
      AND trim(slug) <> ''
      AND (
        (description IS NOT NULL AND trim(description) <> '')
        OR (bio IS NOT NULL AND trim(bio) <> '')
      )
    """)
  end
end
