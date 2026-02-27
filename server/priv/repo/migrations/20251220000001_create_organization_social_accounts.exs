defmodule ClippsterServer.Repo.Migrations.CreateOrganizationSocialAccounts do
  use Ecto.Migration

  def change do
    # Create organization_social_accounts table
    create table(:organization_social_accounts) do
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      add :platform, :string, null: false
      add :platform_user_id, :string, null: false
      add :username, :string, null: false
      add :display_name, :string
      add :profile_image_url, :string
      add :access_token_encrypted, :binary
      add :refresh_token_encrypted, :binary
      add :token_expires_at, :utc_datetime
      add :connected_at, :utc_datetime, null: false
      add :is_active, :boolean, default: true, null: false

      timestamps()
    end

    create index(:organization_social_accounts, [:organization_id])
    create index(:organization_social_accounts, [:platform])
    create index(:organization_social_accounts, [:is_active])

    create unique_index(
             :organization_social_accounts,
             [:organization_id, :platform, :platform_user_id],
             name: :org_social_accounts_unique
           )

    # Create social_account_assignments table (many-to-many)
    create table(:social_account_assignments) do
      add :organization_social_account_id,
          references(:organization_social_accounts, on_delete: :delete_all), null: false

      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :assigned_at, :utc_datetime, null: false
      add :assigned_by_user_id, references(:users, on_delete: :nilify_all)

      timestamps(updated_at: false)
    end

    create index(:social_account_assignments, [:organization_social_account_id])
    create index(:social_account_assignments, [:user_id])

    create unique_index(:social_account_assignments, [:organization_social_account_id, :user_id],
             name: :social_account_assignments_unique
           )
  end
end
