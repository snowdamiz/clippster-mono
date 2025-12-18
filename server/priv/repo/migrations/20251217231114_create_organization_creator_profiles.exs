defmodule ClippsterServer.Repo.Migrations.CreateOrganizationCreatorProfiles do
  use Ecto.Migration

  def change do
    # Create organization_creator_profiles table
    create table(:organization_creator_profiles) do
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      add :name, :string, null: false
      add :description, :text
      add :profile_image_url, :string
      add :intro_id, references(:organization_assets, on_delete: :nilify_all)
      add :outro_id, references(:organization_assets, on_delete: :nilify_all)
      add :watermark_id, references(:organization_assets, on_delete: :nilify_all)
      add :watermark_settings, :map

      timestamps()
    end

    create index(:organization_creator_profiles, [:organization_id])
    create index(:organization_creator_profiles, [:intro_id])
    create index(:organization_creator_profiles, [:outro_id])
    create index(:organization_creator_profiles, [:watermark_id])

    # Create organization_creator_platform_links table
    create table(:organization_creator_platform_links) do
      add :organization_creator_profile_id, references(:organization_creator_profiles, on_delete: :delete_all), null: false
      add :platform, :string, null: false
      add :platform_id, :string, null: false
      add :display_name, :string
      add :profile_image_url, :string
      add :is_primary, :boolean, default: false, null: false

      timestamps(updated_at: false)
    end

    create index(:organization_creator_platform_links, [:organization_creator_profile_id])
    create index(:organization_creator_platform_links, [:platform])
    create unique_index(:organization_creator_platform_links, [:organization_creator_profile_id, :platform, :platform_id],
      name: :org_creator_platform_links_unique)

    # Create organization_profile_assignments table
    create table(:organization_profile_assignments) do
      add :organization_creator_profile_id, references(:organization_creator_profiles, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false

      timestamps(updated_at: false)
    end

    create index(:organization_profile_assignments, [:organization_creator_profile_id])
    create index(:organization_profile_assignments, [:user_id])
    create unique_index(:organization_profile_assignments, [:organization_creator_profile_id, :user_id],
      name: :org_profile_assignments_unique)
  end
end

