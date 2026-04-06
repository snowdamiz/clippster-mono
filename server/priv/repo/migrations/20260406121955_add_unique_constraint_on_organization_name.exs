defmodule ClippsterServer.Repo.Migrations.AddUniqueConstraintOnOrganizationName do
  use Ecto.Migration

  def up do
    # First, fix existing slugs by removing the random suffix
    # The suffix is always 8 hex characters after a hyphen (e.g., eyekon-a395afee -> eyekon)
    execute """
    UPDATE organizations
    SET slug = regexp_replace(slug, '-[a-f0-9]{8}$', '')
    WHERE slug ~ '-[a-f0-9]{8}$'
    """

    # Add unique constraint on name (case-insensitive via unique index on lower(name))
    create unique_index(:organizations, ["lower(name)"], name: :organizations_name_unique_index)
  end

  def down do
    drop index(:organizations, ["lower(name)"], name: :organizations_name_unique_index)
  end
end
