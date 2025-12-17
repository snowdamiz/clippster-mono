defmodule ClippsterServer.Repo.Migrations.AddCreatedByOrganizationToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      # Track which organization created this account (if any)
      # Accounts created directly by an org admin have this set
      add :created_by_organization_id, references(:organizations, on_delete: :nilify_all)
    end

    create index(:users, [:created_by_organization_id])
  end
end

