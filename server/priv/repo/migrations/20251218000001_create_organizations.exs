defmodule ClippsterServer.Repo.Migrations.CreateOrganizations do
  use Ecto.Migration

  def change do
    # Create organizations table
    create table(:organizations) do
      add :name, :string, null: false
      add :slug, :string, null: false
      add :description, :text
      add :logo_url, :string
      add :owner_id, references(:users, on_delete: :restrict), null: false
      add :settings, :map, default: %{}

      timestamps(type: :utc_datetime)
    end

    create unique_index(:organizations, [:slug])
    create index(:organizations, [:owner_id])

    # Create organization_members table
    create table(:organization_members) do
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :role, :string, null: false, default: "member"
      add :joined_at, :utc_datetime, null: false, default: fragment("NOW()")

      timestamps(type: :utc_datetime)
    end

    create unique_index(:organization_members, [:organization_id, :user_id])
    create index(:organization_members, [:user_id])
    create index(:organization_members, [:organization_id])

    # Create organization_invitations table
    create table(:organization_invitations) do
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      add :email, :string, null: false
      add :token, :string, null: false
      add :role, :string, null: false, default: "member"
      add :status, :string, null: false, default: "pending"
      add :invited_by, references(:users, on_delete: :nilify_all)
      add :expires_at, :utc_datetime, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:organization_invitations, [:token])
    create index(:organization_invitations, [:organization_id])
    create index(:organization_invitations, [:email])
    create index(:organization_invitations, [:status])

    # Create organization_credits table (similar to user_credits)
    create table(:organization_credits, primary_key: false) do
      add :organization_id, references(:organizations, on_delete: :delete_all), primary_key: true
      add :hours_remaining, :decimal, default: 0, null: false
      add :hours_used, :decimal, default: 0, null: false

      timestamps(type: :utc_datetime)
    end

    # Create member_credit_allocations table (for individual allocations from org pool)
    create table(:member_credit_allocations, primary_key: false) do
      add :organization_id, references(:organizations, on_delete: :delete_all), null: false
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :hours_allocated, :decimal, default: 0, null: false
      add :hours_used, :decimal, default: 0, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:member_credit_allocations, [:organization_id, :user_id])
    create index(:member_credit_allocations, [:user_id])

    # Modify users table - add account_type and owned_organization_id
    alter table(:users) do
      # "personal" | "organization" | null (pending selection)
      add :account_type, :string
      add :owned_organization_id, references(:organizations, on_delete: :nilify_all)
    end

    create index(:users, [:account_type])
    create index(:users, [:owned_organization_id])
  end
end
