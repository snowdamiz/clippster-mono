defmodule ClippsterServer.Repo.Migrations.CreateAnnouncements do
  use Ecto.Migration

  def change do
    create table(:announcements) do
      add :title, :string, null: false
      add :body, :text, null: false
      add :type, :string, null: false, default: "info"
      add :audience, :string, null: false, default: "everyone"
      add :is_active, :boolean, null: false, default: false
      add :published_at, :utc_datetime
      add :expires_at, :utc_datetime
      add :created_by, references(:users, on_delete: :nilify_all)

      timestamps(type: :utc_datetime)
    end

    create index(:announcements, [:is_active])
    create index(:announcements, [:audience])
    create index(:announcements, [:published_at])
  end
end
