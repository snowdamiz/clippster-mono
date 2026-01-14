defmodule ClippsterServer.Repo.Migrations.CreateOrganizationApplications do
  use Ecto.Migration

  def change do
    create table(:organization_applications) do
      add :user_id, references(:users, on_delete: :delete_all), null: false
      add :name, :string, null: false
      add :description, :text, null: false
      add :website, :string
      add :team_size, :string, null: false
      add :use_case, :text, null: false
      add :contact_email, :string, null: false
      add :logo_url, :string
      add :status, :string, null: false, default: "pending"
      add :admin_notes, :text
      add :reviewed_by_id, references(:users, on_delete: :nilify_all)
      add :reviewed_at, :utc_datetime

      timestamps(type: :utc_datetime)
    end

    create index(:organization_applications, [:user_id])
    create index(:organization_applications, [:status])
    create index(:organization_applications, [:reviewed_by_id])
  end
end
