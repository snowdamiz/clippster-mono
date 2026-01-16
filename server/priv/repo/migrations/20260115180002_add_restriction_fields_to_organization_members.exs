defmodule ClippsterServer.Repo.Migrations.AddRestrictionFieldsToOrganizationMembers do
  use Ecto.Migration

  def change do
    alter table(:organization_members) do
      # Flag indicating this is a restricted account
      add :is_restricted, :boolean, default: false

      # Per-member overrides (NULL values inherit from org defaults)
      # Only non-null values override the org default
      # Example: {"allow_ai": true, "require_clip_approval": false}
      add :restriction_overrides, :jsonb, default: nil
    end

    create index(:organization_members, [:is_restricted])
  end
end
